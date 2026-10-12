import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as Workflow from '../src/companyworkflows.js';
import * as G from '../src/game.js';
import * as Delivery from '../src/delivery.js';
import * as W from '../src/warehouseleases.js';
import * as F from '../src/deliveryfinance.js';
import { runCompanyWorkflowInvariants } from '../src/companyworkflowinvariants.js';

const native = process.argv.includes('--postgres');
assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
let pool, nativeVersion;
if (native) {
  const url = new URL(process.env.COMPANY_WORKFLOW_TEST_DATABASE_URL || 'http://missing');
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  const pilot=url.username==='pilot_runner'&&['35439','35449'].includes(url.port), ci=url.username==='postgres'&&url.port==='5432';
  assert(pilot||ci,'Only explicit named local pilot or hosted-CI loopback roles/ports'); if(pilot) assert.equal(url.password,'');
  assert(/^\/company_workflow_[a-z0-9_]+$/.test(url.pathname)); assert(!url.search && !url.hash);
  const { default: pg } = await import('pg'); pool = new pg.Pool({ connectionString: url.href });
  const c = await pool.connect(); await c.query('BEGIN READ ONLY');
  assert.equal((await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'Owned empty database required');
  const observedVersion=(await c.query('SHOW server_version')).rows[0].server_version; nativeVersion=observedVersion.split(' ')[0];
  assert.match(observedVersion,pilot?/^18\.4(?:\D|$)/:/^(?:16(?:\D|$)|18\.4(?:\D|$))/);
  await c.query('ROLLBACK'); c.release();
} else {
  const { newDb, DataType } = await import('pg-mem'); const { registerPgMemCompatibility } = await import('../src/db.js');
  const mem = newDb(); registerPgMemCompatibility(mem, DataType); pool = new (mem.adapters.createPg().Pool)();
}
process.env.DEPOT_PILOT = 'on'; process.env.DELIVERY_CONTRACTS = 'on';
await pool.query(fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8'));
if (!native) await pool.query('DROP INDEX ix_depot_owner_open');
const blank = async () => {};
const helper = cargo => ({ owned: { cargo, cars: [], skills: new Set() }, acct: { prestige: 0 }, ledger: G.ledger, notify: blank, track: blank });
let serial = 0;
async function fixture() {
  const prefix = `w${++serial}`;
  const actors = [];
  for (let n = 0; n < 4; n++) {
    const id = `${prefix}_ch${n}`, account_id = `${prefix}_ac${n}`;
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'guest',$1)", [account_id]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [account_id]);
    await pool.query("INSERT INTO characters(id,account_id,name,cash,loc,season) VALUES($1,$2,$1,100000,'docks',1)", [id, account_id]);
    actors.push((await pool.query('SELECT * FROM characters WHERE id=$1', [id])).rows[0]);
  }
  const [owner, merchant, buyer, lender] = actors;
  await pool.query("INSERT INTO agent_company_profiles(account_id,revision,name,published) VALUES($1,1,'Test Company',false)", [owner.account_id]);
  for (const [name, actor] of [['own', owner], ['sale', merchant], ['buyer', buyer]]) {
    await pool.query("INSERT INTO business_depots(id,owner_character,district,sale_price,bid_price,reorder_at,target_stock,restock_budget,stock,stock_cost,warehouse_enabled,warehouse_slots,warehouse_cash_per_unit_day,warehouse_revision) VALUES($1,$2,'docks',100,50,0,4,3000,$3,$4,true,10,1,1)", [`${prefix}_${name}`, actor.id, name === 'sale' ? 4 : 0, name === 'sale' ? 200 : 0]);
  }
  const deadline = new Date(Date.now() + 7200000), lease = `${prefix}_lease`, commitment = `${prefix}_delivery`, finance = `${prefix}_finance`, order = `${prefix}_order`, loan = `${prefix}_loan`;
  await pool.query("INSERT INTO market_listings(id,seller_character,depot_id,kind,good_id,qty,price,district,expires_at) VALUES($1,$2,$3,'order','gin',2,500,'docks',$4)", [order, buyer.id, `${prefix}_buyer`, deadline]);
  await pool.query("INSERT INTO business_depot_journal(id,depot_id,reason,cash_delta,order_id) VALUES($1,$2,'restock_escrow',-1000,$3)", [`${prefix}_funding`, `${prefix}_buyer`, order]);
  await pool.query("INSERT INTO delivery_commitments(id,order_id,depot_id,buyer_character,supplier_character,good_id,district,unit_price,take_bps,quantity,remaining,spend_limit,deadline) VALUES($1,$2,$3,$4,$5,'gin','docks',500,200,2,2,500,$6)", [commitment, order, `${prefix}_buyer`, buyer.id, owner.id, deadline]);
  await pool.query("INSERT INTO loans(id,lender_character,borrower_character,principal,rate,hours,status,due_at) VALUES($1,$2,$3,100,0.05,3,'active',$4)", [loan, lender.id, owner.id, new Date(Date.now() + 10800000)]);
  const advanceTerms = { principal: 100, rate: 0.05, hours: 3 }, quote = { districtId: 'docks', unitPrice: 500, quantity: 2, takeBps: 200, deadline: deadline.toISOString(), fullSettlementNet: 980 };
  await pool.query("INSERT INTO delivery_loan_requests(id,commitment_id,order_id,supplier_character,requested_lender_character,buyer_character,request_key,terms,quote,state,loan_id,funded_at,accepted_at) VALUES($1,$2,$3,$4,$5,$6,'funded',$7,$8,'active',$9,now(),now())", [finance, commitment, order, owner.id, lender.id, buyer.id, advanceTerms, quote, loan]);
  const h = helper({});
  await transaction(owner, client => W.leaseWarehouse(owner, merchant, `${prefix}_sale`, { units: 2, expectedOfferRevision: 1, maxTotalCash: 2 }, client, h));
  const actualLease = (await pool.query('SELECT id FROM business_warehouse_leases WHERE tenant_character=$1', [owner.id])).rows[0].id;
  return { prefix, owner, merchant, buyer, lender, h, deadline, terms: { depotId: `${prefix}_own`, procurementDepotId: `${prefix}_sale`, leaseId: actualLease, commitmentId: commitment, financeRequestId: finance, qty: 2, deadlineSeconds: 3600 } };
}
async function transaction(actor, fn) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await client.query('SELECT id FROM characters WHERE id=$1 FOR UPDATE', [actor.id]); const result = await fn(client); await client.query('COMMIT'); return result; }
  catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
}
const create = f => transaction(f.owner, client => Workflow.createCompanyWorkflow(f.owner, f.terms, 'create', client));
const advance = (f, wf, body, key) => transaction(f.owner, client => Workflow.advanceCompanyWorkflow(f.owner, wf, body, key, client, f.h));
const count = async (table, where = '', values = []) => Number((await pool.query(`SELECT COUNT(*) AS n FROM ${table} ${where}`, values)).rows[0].n);
try {
  const f = await fixture(), created = await create(f), wf = created.workflow.id;
  assert.equal(created.paid, 0); assert.equal(created.workflow.nextStage, 'procurement');
  assert.equal(created.nextAction.kind, 'delivery_depot_buy'); assert.equal(created.nextAction.body.qty, 2);
  assert.equal((await create(f)).replayed, true);
  await assert.rejects(transaction(f.owner, c => Workflow.createCompanyWorkflow(f.owner, { ...f.terms, qty: 1 }, 'create', c)), e => e.reason === 'request_conflict');
  await assert.rejects(advance(f, wf, { stage: 'delivery', proofId: f.terms.financeRequestId }, 'outoforder'), e => e.reason === 'stage_order');
  assert.equal((await advance(f, wf, { stage: 'procurement', proofId: 'missing' }, 'missing')).pending, true);
  await transaction(f.owner, c => Delivery.buyCommittedFromDepot(f.owner, f.merchant, f.terms.commitmentId, f.terms.procurementDepotId, { qty: 2, maxUnitPrice: 100 }, c, f.h));
  const sale = (await pool.query("SELECT id FROM business_depot_journal WHERE customer_character=$1 AND reason='sale'", [f.owner.id])).rows[0].id;
  const moneyBefore = await pool.query('SELECT id,cash FROM characters ORDER BY id');
  const ledgerBefore = await count('transactions');
  const purchased = await advance(f, wf, { stage: 'procurement', proofId: sale }, 'procurement');
  assert.equal(purchased.workflow.nextStage, 'custody'); assert.equal(purchased.proof.canonicalCash, 196);
  assert.equal((await advance(f, wf, { stage: 'procurement', proofId: sale }, 'procurement')).replayed, true);
  assert.deepEqual((await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows, moneyBefore.rows, 'Workflow advancement never pays');
  assert.equal(await count('transactions'), ledgerBefore, 'No extra canonical journal/payment');
  await transaction(f.owner, c => W.depositWarehouseCargo(f.owner, f.terms.leaseId, 2, c, f.h));
  await transaction(f.owner, c => W.withdrawWarehouseCargo(f.owner, f.terms.leaseId, 2, c, f.h));
  const journals = (await pool.query('SELECT id,reason FROM business_depot_journal WHERE lease_id=$1', [f.terms.leaseId])).rows;
  const custody = { stage: 'custody', proofId: journals.find(j => j.reason === 'warehouse_deposit').id, withdrawalProofId: journals.find(j => j.reason === 'warehouse_withdraw').id };
  assert.equal((await transaction(f.owner, c => Workflow.advanceCompanyWorkflowDue(f.owner, wf, c, f.h))).workflow.nextStage, 'delivery');
  assert.equal((await transaction(f.owner, c => Workflow.advanceCompanyWorkflowDue(f.owner, wf, c, f.h))).pending, true);
  await transaction(f.owner, c => F.deliverFinancedCommitment(f.owner, f.lender, f.terms.commitmentId, 2, c, f.h));
  const completed = await advance(f, wf, { stage: 'delivery', proofId: f.terms.financeRequestId }, 'delivery');
  assert.equal(completed.workflow.status, 'completed'); assert.equal(completed.proof.canonicalCash, 980); assert.equal(completed.proof.repaymentCash, 105);
  assert.equal(await count('company_workflow_proofs', 'WHERE workflow_id=$1', [wf]), 5);
  assert.equal((await runCompanyWorkflowInvariants(pool)).ok, true);
  const { runEstate }=await import('../src/social/estate.js');
  const death=await G.withTwoCharacters(pool,f.merchant.account_id,f.owner.id,(_ch,target,client,h)=>runEstate(client,h,target,'workflow canonical estate proof'),{ meet:false });
  const heir=(await pool.query('SELECT * FROM characters WHERE id=$1',[death.heirId])).rows[0];
  assert.equal((await transaction(heir, c => Workflow.createCompanyWorkflow(heir, f.terms, 'create', c))).replayed, true);
  assert.equal((await Workflow.companyWorkflowBoard(pool, heir.account_id))[0].status, 'completed');
  const f2 = await fixture(), second = await create(f2);
  await assert.rejects(transaction(f.merchant, c => Workflow.cancelCompanyWorkflow(f.merchant, second.workflow.id, {}, 'foreign', c)), e => e.reason === 'not_found');
  const old = `${f2.prefix}_old`;
  await pool.query("INSERT INTO business_depot_journal(id,depot_id,reason,customer_character,stock_delta,cash_delta,created_at) VALUES($1,$2,'sale',$3,-2,196,$4)", [old, f2.terms.procurementDepotId, f2.owner.id, new Date(Date.now() - 86400000)]);
  await assert.rejects(advance(f2, second.workflow.id, { stage: 'procurement', proofId: old }, 'old'), e => e.reason === 'proof_clock');
  assert.equal((await Workflow.companyWorkflowBoard(pool, f2.owner.account_id))[0].completedStages, 0);
  await pool.query('UPDATE company_workflows SET deadline=$2 WHERE id=$1', [second.workflow.id, new Date(Date.now() - 1)]);
  assert.equal((await advance(f2, second.workflow.id, { stage: 'procurement', proofId: old }, 'expiry')).workflow.status, 'expired');
  assert.equal((await transaction(f2.owner, c => Workflow.cancelCompanyWorkflow(f2.owner, second.workflow.id, {}, 'cancel', c))).workflow.status, 'expired');
  const failed = await fixture(), failure = await create(failed);
  await pool.query("UPDATE delivery_commitments SET status='supplier_dead' WHERE id=$1", [failed.terms.commitmentId]);
  assert.equal((await advance(failed, failure.workflow.id, { stage: 'procurement', proofId: 'missing' }, 'failed')).workflow.status, 'failed');
  await assert.rejects(advance(failed, failure.workflow.id, { stage: 'custody', proofId: 'missing', withdrawalProofId: 'missing' }, 'downstream'), e => e.reason === 'terminal');
  if (native) {
    const f3 = await fixture();
    const [a, b] = await Promise.all([create(f3), create(f3)]);
    assert.equal(a.workflow.id, b.workflow.id); assert.equal([a, b].filter(r => r.replayed).length, 1);
    await transaction(f3.owner, c => Delivery.buyCommittedFromDepot(f3.owner, f3.merchant, f3.terms.commitmentId, f3.terms.procurementDepotId, { qty: 2, maxUnitPrice: 100 }, c, f3.h));
    const proof = (await pool.query("SELECT id FROM business_depot_journal WHERE customer_character=$1 AND reason='sale'", [f3.owner.id])).rows[0].id;
    const concurrent = await Promise.all([advance(f3, a.workflow.id, { stage: 'procurement', proofId: proof }, 'duplicate'), advance(f3, a.workflow.id, { stage: 'procurement', proofId: proof }, 'duplicate')]);
    assert.equal(concurrent.filter(r => r.replayed).length, 1); assert.equal(await count('company_workflow_proofs', 'WHERE workflow_id=$1', [a.workflow.id]), 1);
    const before = await count('company_workflow_receipts');
    await assert.rejects(transaction(f3.owner, async c => { await Workflow.cancelCompanyWorkflow(f3.owner, a.workflow.id, {}, 'rolledback', c); throw new Error('forced rollback'); }), /forced rollback/);
    assert.equal(await count('company_workflow_receipts'), before);
    assert.equal((await Workflow.companyWorkflowBoard(pool, f3.owner.account_id))[0].status, 'active');
    // Hold source depot, expire after the advance starts waiting, then verify fresh post-lock time.
    const blocker = await pool.connect(); await blocker.query('BEGIN'); await blocker.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE', [f3.terms.depotId]);
    const waiting = advance(f3, a.workflow.id, { stage: 'procurement', proofId: 'missing' }, 'blocked');
    await pool.query('UPDATE company_workflows SET deadline=clock_timestamp() WHERE id=$1', [a.workflow.id]);
    await blocker.query('COMMIT'); blocker.release();
    assert.equal((await waiting).workflow.status, 'expired');
  }
  let seed = 1947;
  for (let n = 0; n < 300; n++) { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; const qty = seed % 10 + 1; assert.equal(Workflow.companyWorkflowTerms({ ...f.terms, qty }).qty, qty); assert.throws(() => Workflow.companyWorkflowTerms({ ...f.terms, qty: qty + 10 })); }
  for (const change of [{ extra: 'https://example.com' }, { qty: '2' }, { deadlineSeconds: 21601 }, { financeRequestId: '${code}' }]) assert.throws(() => Workflow.companyWorkflowTerms({ ...f.terms, ...change }));
  assert.equal((await runCompanyWorkflowInvariants(pool)).ok, true);
  console.log(`companyworkflows: PASS ${native ? `PostgreSQL${nativeVersion} locks/concurrency/rollback/post-lock expiry` : 'memory canonical domain lifecycle'}; procurement→custody→financed delivery; no additional payment; proof order/old/foreign; heir replay; seed1947 300 bounds`);
} finally { await pool.end(); }
