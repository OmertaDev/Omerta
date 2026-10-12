process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'commercial-reputation-isolated-proof-secret';
process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.DEPOT_PILOT = 'on'; process.env.DELIVERY_CONTRACTS = 'on';
process.env.MARKET_SEED = 'commercial-reputation-isolated-seed'; process.env.MOD_KEY = 'commercial-reputation-isolated-mod';
const native = process.argv.includes('--postgres'); assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
function nativeEndpoint(value) {
  const url=new URL(value); assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1'); assert(!url.search&&!url.hash);
  const local=['35439','35449'].includes(url.port)&&url.username==='pilot_runner'&&!url.password;
  const ci=url.port==='5432'&&url.username==='postgres'&&url.password==='pgcheck'; assert(local||ci); assert(/^\/commercial_reputation_[a-z0-9_]+$/.test(url.pathname)); return {url,local};
}
for(const bad of ['postgresql://pilot_runner@remote:35449/commercial_reputation_test_guard','postgresql://pilot_runner@127.0.0.1:35449/omerta','postgresql://postgres:wrong@127.0.0.1:5432/commercial_reputation_test_guard','postgresql://pilot_runner@127.0.0.1:35449/commercial_reputation_test_guard?host=remote']) assert.throws(()=>nativeEndpoint(bad));
if(native) {
  const {url,local}=nativeEndpoint(process.env.COMMERCIAL_REPUTATION_TEST_DATABASE_URL),{default:pg}=await import('pg'),pre=new pg.Pool({connectionString:url.href});
  try { const version=(await pre.query('SHOW server_version')).rows[0].server_version; assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/); assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0,'Fresh owned namespace required'); } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import * as G from '../src/game.js';
import * as D from '../src/depot.js';
import * as Delivery from '../src/delivery.js';
import * as E from '../src/gameemployment.js';
import * as W from '../src/warehouseleases.js';
import * as Loans from '../src/loans.js';
import * as R from '../src/commercialreputation.js';
import * as Workflow from '../src/companyworkflows.js';
import * as Finance from '../src/deliveryfinance.js';
import { LOAN } from '../src/rules.js';
import { buyGood } from '../src/economy.js';
const app = await buildServer(); let serial = 0;
async function player() {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const result = await app.inject({ method: 'POST', url: '/v1/character', payload: { name: `Reputation ${++serial}` }, headers: { authorization: `Bearer ${token}` } });
  assert.equal(result.statusCode, 200, result.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
  const row = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1", [row.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'pilot:capital' });
  await app.pool.query('INSERT INTO agent_company_profiles(account_id,revision,name,published) VALUES($1,1,$2,true)', [account, `Company ${serial}`]);
  return { id: row.id, account };
}
const single = (p, fn) => G.withCharacter(app.pool, p.account, fn);
const pair = (p, other, fn) => G.withTwoCharacters(app.pool, p.account, other.id, fn, { meet: false });
const pub = p => R.publicCommercialReputation(app.pool, p.account);
const depotTerms = { salePrice: 600, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 };
async function depot(p) {
  const row = await single(p, (ch, db, h) => D.openDepot(ch, depotTerms, db, h));
  await single(p, (ch, db, h) => D.fundDepot(ch, row.id, 10000, db, h)); return row.id;
}
try {
  const company = await player(), peers = [await player(), await player(), await player()];
  const ownDepot = await depot(company), contracts = [], assignments = [], loans = [];
  await single(company, (ch, db) => W.configureWarehouseOffer(ch, ownDepot, { expectedRevision: 0, enabled: true, slots: 10, cashPerUnitDay: 10 }, db));
  for (const peer of peers) {
    peer.depot = await depot(peer);
    const order = await single(peer, (ch, db, h) => D.restockDepot(ch, peer.depot, db, h));
    const commitment = await single(company, (ch, db) => Delivery.acceptDelivery(ch, order.id, { qty: 2, unitPrice: 500, maxProcurementCash: 5000, deadlineSeconds: 600 }, db));
    contracts.push(commitment.id);
    const job = await single(peer, (ch, db, h) => E.createEmployment(ch, { depotId: peer.depot, slots: 1, wageCash: 100, acceptHumans: true, acceptAgents: true, expiresAt: new Date(Date.now() + 1200000).toISOString() }, `job-${peer.id}`, db, h));
    const assignment = await pair(company, peer, (ch, owner, db) => E.acceptEmployment(ch, owner, { employmentId: job.employmentId, commitmentId: commitment.id, consent: true }, `work-${peer.id}`, db));
    assignments.push(assignment.assignmentId);
    await single(company, (ch, db, h) => buyGood(ch, 'gin', 2, db, h));
    await single(company, (ch, db, h) => Delivery.deliverCommitment(ch, commitment.id, 2, db, h));
    await pair(company, peer, (ch, owner, db, h) => E.claimEmployment(ch, owner, job.employmentId, commitment.id, `claim-${peer.id}`, db, h));
    await single(peer, (ch, db) => D.receiveDepot(ch, peer.depot, order.id, db));
    const rented = await pair(peer, company, (ch, owner, db, h) => W.leaseWarehouse(ch, owner, ownDepot, { units: 1, expectedOfferRevision: 1, maxTotalCash: 10 }, db, h));
    await single(peer, (ch, db) => W.closeWarehouseLease(ch, rented.lease.id, db));
    const loan = await single(company, (ch, db, h) => Loans.offerLoan(ch, { amount: Math.max(500, LOAN.MIN), rate: 0.05, hours: Math.max(3, LOAN.TERM_MIN_H), to: peer.id }, db, h));
    loans.push(loan.id);
    await single(peer, (ch, db, h) => Loans.takeLoan(ch, loan.id, null, db, h));
    await pair(peer, company, (ch, lender, db, h) => Loans.repayLoan(ch, lender, loan.id, db, h));
  }
  const [merchant, buyer, lender] = peers;
  await single(merchant, (ch, db) => W.configureWarehouseOffer(ch, merchant.depot, { expectedRevision: 0, enabled: true, slots: 10, cashPerUnitDay: 10 }, db));
  await single(buyer, (ch, db, h) => D.withdrawDepotStock(ch, buyer.depot, 2, db, h));
  await single(buyer, (ch, db) => D.configureDepot(ch, buyer.depot, { ...depotTerms, salePrice: 6000, bidPrice: 5000, restockBudget: 20000 }, db));
  await single(buyer, (ch, db, h) => D.fundDepot(ch, buyer.depot, 10000, db, h));
  const financedOrder = await single(buyer, (ch, db, h) => D.restockDepot(ch, buyer.depot, db, h));
  const financedDelivery = await single(company, (ch, db) => Delivery.acceptDelivery(ch, financedOrder.id, { qty: 2, unitPrice: 5000, maxProcurementCash: 20000, deadlineSeconds: 600 }, db));
  const request = await pair(company, lender, (ch, owner, db, h) => Finance.requestDeliveryAdvance(ch, owner,
    { supplierId: ch.id, lenderId: owner.id, commitmentId: financedDelivery.id, principal: LOAN.MIN, rate: 0.05, hours: Math.max(3, LOAN.TERM_MIN_H) }, 'reputation-finance', db, h));
  await pair(lender, company, (ch, supplier, db, h) => Finance.offerDeliveryAdvance(ch, supplier, request.request.id, db, h));
  await pair(company, lender, (ch, owner, db, h) => Finance.takeDeliveryAdvance(ch, owner, request.request.id, db, h));
  const lease = await pair(company, merchant, (ch, owner, db, h) => W.leaseWarehouse(ch, owner, merchant.depot, { units: 2, expectedOfferRevision: 1, maxTotalCash: 20 }, db, h));
  const workflow = await single(company, (ch, db) => Workflow.createCompanyWorkflow(ch,
    { depotId: ownDepot, procurementDepotId: merchant.depot, leaseId: lease.lease.id, commitmentId: financedDelivery.id, financeRequestId: request.request.id, qty: 2, deadlineSeconds: 500 }, 'reputation-workflow', db));
  await pair(company, merchant, (ch, owner, db, h) => Delivery.buyCommittedFromDepot(ch, owner, financedDelivery.id, merchant.depot, { qty: 2, maxUnitPrice: 600 }, db, h));
  const sale = (await app.pool.query("SELECT id FROM business_depot_journal WHERE customer_character=$1 AND depot_id=$2 AND reason='sale'", [company.id, merchant.depot])).rows[0];
  await single(company, (ch, db, h) => Workflow.advanceCompanyWorkflow(ch, workflow.workflow.id, { stage: 'procurement', proofId: sale.id }, 'reputation-procurement', db, h));
  await single(company, (ch, db, h) => W.depositWarehouseCargo(ch, lease.lease.id, 2, db, h));
  await single(company, (ch, db, h) => W.withdrawWarehouseCargo(ch, lease.lease.id, 2, db, h));
  await single(company, (ch, db, h) => Workflow.advanceCompanyWorkflowDue(ch, workflow.workflow.id, db, h));
  await pair(company, lender, (ch, owner, db, h) => Finance.deliverFinancedCommitment(ch, owner, financedDelivery.id, 2, db, h));
  assert.equal((await single(company, (ch, db, h) => Workflow.advanceCompanyWorkflow(ch, workflow.workflow.id, { stage: 'delivery', proofId: request.request.id }, 'reputation-workflow-delivery', db, h))).workflow.status, 'completed');
  assert.equal((await single(company, (ch, db) => R.ownCommercialReputation(ch, db))).evidence.find(r => r.category === 'workflows').eligible, true, 'actual paid/custodied/delivered/repaid workflow is revalidated from canonical proof rows');
  assert.deepEqual(await pub(company), { available: false }, 'company publication alone is not reputation consent');
  await assert.rejects(single(company, (ch, db) => R.setCommercialReputation(ch, { published: true, expectedRevision: 0, rating: 100 }, db)), /terms/);
  const before = (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [company.id])).rows[0].cash;
  await single(company, (ch, db) => R.setCommercialReputation(ch, { expectedRevision: 0, published: true }, db));
  const published = await pub(company);
  assert.equal(published.available, true);
  for (const category of ['deliveries', 'paidWork', 'closedStorage', 'repaidLoans']) assert.equal(published.categories[category], '3–9', category);
  assert.equal(published.categories.workflows, null);
  const publicText = JSON.stringify(published);
  for (const secret of [...contracts, ...assignments, ...loans, ...peers.flatMap(p => [p.id, p.account]), 'principal', 'balance', '"rate":', '"rule":']) assert.equal(publicText.includes(secret), false, secret);
  const refreshes = native ? await Promise.all([single(company, (ch, db) => R.refreshCommercialReputation(ch, db)), single(company, (ch, db) => R.refreshCommercialReputation(ch, db))]) : [await single(company, (ch, db) => R.refreshCommercialReputation(ch, db))];
  let validCount = 14;
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS n FROM commercial_reputation_proofs WHERE account_id=$1', [company.account])).rows[0].n), 14);
  assert(refreshes.every(result => result.evidence.filter(r => r.eligible).length === 14));
  await app.pool.query("INSERT INTO loans(id,lender_character,borrower_character,principal,rate,hours,status,offered_at,due_at) SELECT 'duplicate-repayment',lender_character,borrower_character,principal,rate,hours,status,offered_at,due_at FROM loans WHERE id=$1", [loans[0]]);
  assert.equal((await single(company, (ch, db) => R.ownCommercialReputation(ch, db))).evidence.find(r => r.sourceId === 'duplicate-repayment').eligible, false, 'already-bound repayment journal cannot certify copied loan metadata');
  await single(company, (ch, db) => R.refreshCommercialReputation(ch, db));
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS n FROM commercial_reputation_proofs WHERE account_id=$1', [company.account])).rows[0].n), 14);
  await app.pool.query('DELETE FROM loans WHERE id=$1', ['duplicate-repayment']);
  await app.pool.query("UPDATE business_depot_journal SET reason='unknown' WHERE id=$1", [sale.id]);
  assert.equal((await single(company, (ch, db) => R.ownCommercialReputation(ch, db))).evidence.find(r => r.category === 'workflows').eligible, false, 'workflow completion metadata is insufficient without canonical source proof');
  await app.pool.query("UPDATE business_depot_journal SET reason='sale' WHERE id=$1", [sale.id]);
  assert.equal((await single(peers[0], (ch, db) => R.ownCommercialReputation(ch, db))).evidence.some(r => contracts.includes(r.sourceId)), false, 'foreign supplier proofs are not private owned diagnostics');
  await app.pool.query("UPDATE game_employment_assignments SET state='assigned',paid_at=NULL WHERE id=$1", [assignments[0]]);
  assert.equal((await pub(company)).categories.paidWork, null, 'late source failure cannot retain a published success');
  await app.pool.query("UPDATE game_employment_assignments SET state='paid',paid_at=clock_timestamp() WHERE id=$1", [assignments[0]]);
  await app.pool.query('UPDATE characters SET account_id=$2 WHERE id=$1', [peers[0].id, company.account]);
  assert.equal((await pub(company)).categories.deliveries, null, 'same original-account counterparties are excluded');
  await app.pool.query('UPDATE characters SET account_id=$2 WHERE id=$1', [peers[0].id, peers[0].account]);
  await app.pool.query('UPDATE agent_company_profiles SET published=false WHERE account_id=$1', [company.account]);
  assert.deepEqual(await pub(company), { available: false });
  await app.pool.query('UPDATE agent_company_profiles SET published=true WHERE account_id=$1', [company.account]);
  assert.deepEqual(await R.publicCommercialReputation({ query: async (sql, args) => {
    if (sql.startsWith('SELECT category,source_id')) await app.pool.query('UPDATE agent_company_profiles SET published=false WHERE account_id=$1', [company.account]);
    return app.pool.query(sql, args);
  } }, company.account), { available: false }, 'revocation during source traversal is caught before disclosure');
  await app.pool.query('UPDATE agent_company_profiles SET published=true WHERE account_id=$1', [company.account]);
  await single(company, (ch, db) => R.setCommercialReputation(ch, { expectedRevision: 1, published: false }, db));
  assert.deepEqual(await pub(company), { available: false });
  if (native) {
    const freshLease = await pair(peers[0], company, (ch, owner, db, h) => W.leaseWarehouse(ch, owner, ownDepot, { units: 1, expectedOfferRevision: 1, maxTotalCash: 10 }, db, h));
    await single(peers[0], (ch, db) => W.closeWarehouseLease(ch, freshLease.lease.id, db));
    validCount++;
    await assert.rejects(single(company, (ch, db) => R.setCommercialReputation(ch, { expectedRevision: 2, published: true }, { query: (sql, args) => {
      if (sql.startsWith('UPDATE commercial_reputation_publications')) throw new Error('injected publication failure'); return db.query(sql, args);
    } })), /injected/);
    assert.deepEqual(await pub(company), { available: false });
    assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS n FROM commercial_reputation_proofs WHERE account_id=$1', [company.account])).rows[0].n), 14, 'late publication failure rolls back newly validated proof insertion');
  }
  await single(company, (ch, db) => R.setCommercialReputation(ch, { expectedRevision: 2, published: true }, db));
  assert.equal((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [company.id])).rows[0].cash, before, 'reputation operations never change funds');
  for (let n = 0; n < 105; n++) await app.pool.query("INSERT INTO loans(id,lender_character,principal,rate,hours,status) VALUES($1,$2,5000,0.05,3,'open')", [`zzz-window-${n}`, company.id]);
  const window = await single(company, (ch, db) => R.ownCommercialReputation(ch, db));
  assert.equal(window.evidence.filter(r => r.category === 'repaidLoans').length, 100, 'source category window is bounded');
  const count = Number((await app.pool.query('SELECT COUNT(*) AS n FROM commercial_reputation_proofs WHERE account_id=$1', [company.account])).rows[0].n);
  for (let n = count; n < 500; n++) await app.pool.query("INSERT INTO commercial_reputation_proofs(category,source_id,account_id,original_character,evidence_hash) VALUES('workflows',$1,$2,$3,$4)", [`unbacked-cap-${n}`, company.account, company.id, 'a'.repeat(64)]);
  const extraLease = await pair(peers[0], company, (ch, owner, db, h) => W.leaseWarehouse(ch, owner, ownDepot, { units: 1, expectedOfferRevision: 1, maxTotalCash: 10 }, db, h));
  await single(peers[0], (ch, db) => W.closeWarehouseLease(ch, extraLease.lease.id, db)); validCount++;
  assert.equal((await single(company, (ch, db) => R.refreshCommercialReputation(ch, db))).proofLimitReached, true);
  assert.equal(Number((await app.pool.query('SELECT COUNT(*) AS n FROM commercial_reputation_proofs WHERE account_id=$1', [company.account])).rows[0].n), 500);
  assert.equal((await pub(company)).categories.workflows, null, 'metadata alone cannot create public successes at the finite proof cap');
  const original = (await app.pool.query('SELECT * FROM characters WHERE id=$1', [company.id])).rows[0];
  const heir = { ...original, id: 'reputation-heir' };
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [company.id]);
  await app.pool.query("INSERT INTO characters(id,account_id,name,season,generation,cash,loc) VALUES($1,$2,'Reputation heir',1,2,500,'docks')", [heir.id, company.account]);
  const inherited = await R.ownCommercialReputation(heir, app.pool);
  assert.equal(inherited.evidence.filter(r => r.eligible).length, validCount, 'historical original-account evidence follows the account without transferring funds or grants');
  assert.equal((await pub(company)).categories.deliveries, '3–9');
  console.log(`commercial reputation: actual canonical fulfilled deliveries, paid wages, closed paid leases, loan repayments and completed funded workflows; globally unique proofs/repayment journals, self/foreign exclusion, privacy thresholds/revocation, late failure, unchanged funds and heir history passed${native ? '; PostgreSQL concurrent dedup and publication rollback passed' : ''}`);
} finally { await app.close(); await app.pool.end(); }
