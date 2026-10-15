import {ensureComponentDDL} from './lib/company-middle-five-fixture-schema.js';
import assert from 'node:assert/strict';
const native = process.argv.includes('--postgres'); let version = 'memory';
assert(!process.env.DATABASE_URL, 'Production integration refuses ambient database endpoints');
if (native) {
  const url = new URL(process.env.DEPOT_ACQUISITION_RUNTIME_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci); assert(!url.search && !url.hash); assert.match(url.pathname, /^\/depot_acquisition_runtime_test_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href }); await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY'); version = (await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', DEPOT_PILOT: 'on', INVITE_MODE: 'off',
  JWT_SECRET: 'production-combined-native-fixture-secret', MARKET_SEED: 'production-combined-fixture-market-seed-long', MOD_KEY: 'production-combined-fixture-moderator' });
const { buildServer } = await import('./server-fixture.js'), G = await import('../src/game.js');
const I = await import('../src/items.js'), { runEstate } = await import('../src/social/estate.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app=await buildServer(),P=await import('../src/businesspartnerships.js'),V=await import('../src/companygovernance.js'),A=await import('../src/companyacquisitions.js'),R=await import('../src/depotacquisitionruntime.js'),{default:Fastify}=await import('fastify');await ensureComponentDDL(app.pool,P.businessPartnershipDDL,["business_partnerships","business_partnership_requests","business_partnership_distributions","business_partnership_contributions"]);await ensureComponentDDL(app.pool,V.companyGovernanceDDL,["company_governance","company_governance_proposals","company_governance_votes","company_governance_requests"]);await ensureComponentDDL(app.pool,A.companyAcquisitionsDDL,["company_acquisitions","company_acquisition_requests"]);const service=A.companyAcquisitions(R.canonicalDepotAcquisitionRuntime);const {withAcquisitionCharacters}=await import('../src/company-middle-five-runtime.js');let sequence=0;
// Global schema and real root registrations/hooks only: no component DDL or
// registration/admission/mystery-completion scaffold is installed by this test.
async function call(p, method, url, body, key = `combined-${++sequence}`, agent = false) {
  const r = await app.inject({ method, url, payload: body, headers: { ...(p ? { authorization: `Bearer ${agent ? p.agent : p.token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json(), headers: r.headers };
}
async function ok(...args) { const r = await call(...args); assert.equal(r.code, 200, JSON.stringify(r)); return r.body; }
async function sameKeyReplay(...args) {
  const deadline = Date.now() + 10000;
  for (;;) {
    const result = await call(...args);
    if (result.code === 200) return result.body;
    assert.equal(result.code, 409, JSON.stringify(result));
    assert.equal(result.body.error, 'in_progress');
    assert.equal(result.headers['retry-after'], '1');
    assert(Date.now() < deadline, 'Original-key receipt must settle within the fixture bound');
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
async function refusal(...args) { const r = await call(...args); assert([400, 409, 422].includes(r.code), JSON.stringify(r)); return r; }
async function player() {
  const p = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
  await ok(p, 'POST', '/v1/character', { name: `Combined Factory ${++sequence}` }); p.account = app.jwt.verify(p.token).sub;
  const row = (await app.pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0]; p.id = row.id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000 WHERE id=$1", [p.id]);
  await G.ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'crime:combined-production-fixture' });
  await app.pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [p.id]);
  await ok(p, 'POST', '/v1/resources/company', { expectedRevision: 0, name: `Private Factory ${sequence}`, published: false, premises: null });
  p.business = (await ok(p, 'POST', '/v1/depot', { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 })).id;
  p.agent = (await ok(p, 'POST', '/v1/auth/agent-key')).token; assert.equal(app.jwt.verify(p.agent).agent, true); return p;
}
const base='/v1/company/acquisitions',config={salePrice:1000,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000};
const pair=(s,b,fn)=>withAcquisitionCharacters(app.pool,s.account,b.id,fn);
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const snapshot=async d=>({depot:(await app.pool.query('SELECT * FROM business_depots WHERE id=$1',[d])).rows[0],journals:(await app.pool.query('SELECT * FROM business_depot_journal WHERE depot_id=$1 ORDER BY id',[d])).rows});
async function deal(s,b,seconds=600){const q=await ok(s,'POST',base+'/quote',{depotId:s.business,buyerCharacter:b.id});const body={depotId:s.business,buyerCharacter:b.id,price:10000,sourceHash:q.sourceHash,expiresInSeconds:seconds,consent:true},r=await ok(s,'POST',base,body,'offer-'+(++sequence),true);assert.equal((await call(b,'POST',base+'/'+r.acquisition.id+'/accept',{consent:true,maxPrice:9999,termsHash:r.acquisition.termsHash},'wrong-price-'+(++sequence))).body.message,'buyer_consent');await ok(b,'POST',base+'/'+r.acquisition.id+'/accept',{consent:true,maxPrice:10000,termsHash:r.acquisition.termsHash},'accept-'+(++sequence),true);return r.acquisition;}
async function buyer(){const p=await player();await ok(p,'POST',`/v1/depot/${p.business}/close`,{});return p;}
async function global(){const checks=(await runLedgerInvariants(app.pool,{alert:false})).checks;assert.deepEqual(checks.filter(c=>!c.ok),[]);assert.equal(Number((await app.pool.query("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE reason IN ('company_acquisition:pay','company_acquisition:receive') AND currency='cash'")).rows[0].n),0);}


const W=await import('../src/workshopfloor.js');
async function premises(p){await app.pool.query('UPDATE account_persistent SET omr=omr+240 WHERE account_id=$1',[p.account]);await G.ledger(app.pool,{accountId:p.account,currency:'omr',amount:240,reason:'mission:explicit-synthetic-floor-premises-fixture'});const paid=await ok(p,'POST','/v1/estate/upgrade',{});assert.equal(paid.tier,1);assert.equal(paid.omr,240);await ok(p,'POST','/v1/resources/company',{expectedRevision:1,name:'Original paid workshop',published:false,premises:'estate'});}
const floor='/v1/company/workshop-floor/configure';
try{
const seller=await player(),purchaser=await buyer(),supplier=await player();await premises(seller);await premises(purchaser);
const oldBody={businessId:seller.business,expectedRevision:0,allocations:[{slot:1,use:'storage',toolItemId:null},{slot:2,use:'service',toolItemId:null}],consent:true};
const oldAck=await ok(seller,'POST',floor,oldBody,'old-floor');const oldPlan=(await app.pool.query('SELECT * FROM workshop_floorplans WHERE business_id=$1',[seller.business])).rows[0];const oldRequests=(await app.pool.query('SELECT * FROM workshop_floor_requests ORDER BY run_id')).rows;
await ok(seller,'POST','/v1/depot/'+seller.business+'/fund',{amount:5000});const order=await ok(seller,'POST','/v1/depot/'+seller.business+'/restock',{});
assert.equal((await call(seller,'POST',base+'/quote',{depotId:seller.business,buyerCharacter:purchaser.id})).body.message,'market');
const Economy=await import('../src/economy.js'),Market=await import('../src/market.js');await G.withCharacter(app.pool,supplier.account,(ch,c,h)=>Economy.buyGood(ch,'gin',2,c,h));await G.withCharacter(app.pool,supplier.account,(ch,c,h)=>Market.fillOrder(ch,order.id,2,c,h));await ok(seller,'POST','/v1/depot/'+seller.business+'/orders/'+order.id+'/receive',{});
const before=await snapshot(seller.business),balances=[await cash(seller),await cash(purchaser)],items=(await app.pool.query('SELECT * FROM item_instances ORDER BY id')).rows;
const a=await deal(seller,purchaser);await ok(seller,'POST',base+'/'+a.id+'/execute',{termsHash:a.termsHash},'actual-transfer');
assert.deepEqual(await snapshot(seller.business),{...before,depot:{...before.depot,owner_character:purchaser.id}});assert.deepEqual([await cash(seller),await cash(purchaser)],[balances[0]+10000,balances[1]-10000]);assert.deepEqual((await app.pool.query('SELECT * FROM item_instances ORDER BY id')).rows,items);
assert.deepEqual(await ok(seller,'POST',floor,oldBody,'old-floor'),oldAck);assert.deepEqual((await app.pool.query('SELECT * FROM workshop_floor_requests ORDER BY run_id')).rows,oldRequests);
const denied=await call(purchaser,'POST','/v1/depot/'+seller.business+'/restock',{});assert.equal(denied.code,400,JSON.stringify(denied));assert.equal(denied.body.error,'workshop_floor');
assert.equal((await call(seller,'POST',floor,{...oldBody,expectedRevision:1},'old-fresh')).body.message,'business');
const next=await ok(purchaser,'POST',floor,{...oldBody,expectedRevision:1},'new-owner-floor');assert.equal(next.revision,2);const current=(await app.pool.query('SELECT * FROM workshop_floorplans WHERE business_id=$1',[seller.business])).rows[0];assert.notEqual(current.id,oldPlan.id);assert.equal(current.account_id,purchaser.account);assert.equal(current.original_character,purchaser.id);assert.equal(current.source_json.premises.key,purchaser.account);
assert.deepEqual((await app.pool.query('SELECT * FROM workshop_floor_requests WHERE run_id=$1',[oldPlan.id])).rows,[oldRequests[0]]);assert.deepEqual(await W.collectWorkshopFloorIssues(app.pool),[]);await global();
const restructureTerms={depotId:seller.business,steps:[{kind:'configure',config:{salePrice:1100,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:2000}}],maxWithdrawalCash:0,reserveCash:1000};await ok(purchaser,'POST','/v1/company/restructuring/quote',restructureTerms);const nextBuyer=await buyer();await app.pool.query('CREATE TABLE unknown_floor_reference(id TEXT PRIMARY KEY,business_ref TEXT)');const unknown=await call(purchaser,'POST',base+'/quote',{depotId:seller.business,buyerCharacter:nextBuyer.id});assert.equal(unknown.body.message,'unsupported_schema');assert.equal((await call(purchaser,'POST','/v1/company/restructuring/quote',restructureTerms)).body.message,'unsupported_schema');await app.pool.query('DROP TABLE unknown_floor_reference');await app.pool.query('ALTER TABLE workshop_floor_requests RENAME COLUMN business_ref TO missing_business_ref');assert.equal((await call(purchaser,'POST',base+'/quote',{depotId:seller.business,buyerCharacter:nextBuyer.id})).body.message,'unsupported_schema');assert.equal((await call(purchaser,'POST','/v1/company/restructuring/quote',restructureTerms)).body.message,'unsupported_schema');await app.pool.query('ALTER TABLE workshop_floor_requests RENAME COLUMN missing_business_ref TO business_ref');
await global();console.log('N13 actual canonical F15 paid transfer / current owner floor replacement / stale fresh-use refusal / original ACK history / paid estate premises / stock-title-cash preservation / old market obligation / unknown business_ref refusal PASS memory. No native claim.');
}finally{await app.close();}
