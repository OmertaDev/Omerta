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


const Warehouse=await import('../src/warehouseleases.js'),Economy=await import('../src/economy.js');
const one=(p,fn)=>G.withCharacter(app.pool,p.account,fn),tx=fn=>I.withItemTransaction(app.pool,fn),quote=(s,b)=>call(s,'POST',base+'/quote',{depotId:s.business,buyerCharacter:b.id});
async function inputs(p){await tx(async c=>{for(const [id,n]of [['mat:hardened_steel',1],['mat:salvage_parts',2]])await I.grantStack(c,{scope:'account',id:p.account},id,n,'standard','explicit synthetic acquisition relationship fixture materials','related-material-'+ ++sequence);});}
async function fund(s,c){await inputs(c);return ok(c,'POST','/v1/company/commissions/fund',{businessId:s.business,feeCash:100,lifetimeSeconds:1200,consent:true});}
const cref=q=>({commissionId:q.commissionId,sourceHash:q.sourceHash,consent:true});
try{
 const s=await player(),c=await player(),b=await buyer();
 const q=await fund(s,c),customerCash=await cash(c);assert.equal((await quote(s,b)).code,200,'Customer-only funded proposal cannot veto acquisition');
 const custody=(await app.pool.query("SELECT * FROM item_stacks WHERE owner_scope='operation' ORDER BY owner_id,template_id")).rows;const purchase=await deal(s,b);await ok(s,'POST',base+'/'+purchase.id+'/execute',{termsHash:purchase.termsHash},'transfer-with-unaccepted-customer-claim');assert.deepEqual((await app.pool.query("SELECT * FROM item_stacks WHERE owner_scope='operation' ORDER BY owner_id,template_id")).rows,custody);assert.equal(await cash(c),customerCash);
 assert.equal((await call(s,'POST','/v1/company/commissions/accept',cref(q))).body.message,'business');const refund=await ok(c,'POST','/v1/company/commissions/refund',cref(q),'post-transfer-customer-refund');assert.equal(refund.refundedFee,100);assert.equal(await cash(c),customerCash+100);assert.deepEqual(await ok(c,'POST','/v1/company/commissions/refund',cref(q),'post-transfer-customer-refund'),refund);await global();
 const maker=await player(),customer=await player(),buyer2=await buyer(),accepted=await fund(maker,customer);await ok(maker,'POST','/v1/company/commissions/accept',cref(accepted));assert.equal((await quote(maker,buyer2)).body.message,'commission_accepted');await ok(customer,'POST','/v1/company/commissions/refund',cref(accepted));assert.equal((await quote(maker,buyer2)).code,200,'Verified zero-reserve terminal commission history is retained without a permanent block');
 const manufactured=await fund(maker,customer);await ok(maker,'POST','/v1/company/commissions/accept',cref(manufactured));const finished=await ok(maker,'POST','/v1/company/commissions/complete',cref(manufactured),'real-commission-completed');assert.equal(finished.paidFee,100);assert.equal((await app.pool.query('SELECT owner_id FROM item_instances WHERE id=$1',[finished.outputItemId])).rows[0].owner_id,customer.account);assert.equal((await quote(maker,buyer2)).code,200,'Genuine completed source/output/fee history is not a permanent obligation');const completedBefore=(await app.pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1',[manufactured.commissionId])).rows[0],realSale=await deal(maker,buyer2);await ok(maker,'POST',base+'/'+realSale.id+'/execute',{termsHash:realSale.termsHash},'transfer-after-real-work-and-principal-recovery');assert.deepEqual((await app.pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1',[manufactured.commissionId])).rows[0],completedBefore);assert.deepEqual(await ok(maker,'POST','/v1/company/commissions/complete',cref(manufactured),'real-commission-completed'),finished);await global();
 const provider=await player(),tenant=await player(),warehouseBuyer=await buyer();await ok(provider,'POST','/v1/depot/'+provider.business+'/close',{});await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1 OR id=$2",[provider.id,tenant.id]);
 const Depot=await import('../src/depot.js');provider.business=(await one(provider,(ch,c,h)=>Depot.openDepot(ch,{salePrice:2000,bidPrice:500,targetStock:4,reorderAt:0,restockBudget:3000},c,h))).id;
 await one(provider,(ch,c)=>Warehouse.configureWarehouseOffer(ch,provider.business,{expectedRevision:0,enabled:true,slots:10,cashPerUnitDay:25},c));
 const lease=await G.withTwoCharacters(app.pool,tenant.account,provider.id,(ch,landlord,c,h)=>Warehouse.leaseWarehouse(ch,landlord,provider.business,{units:4,expectedOfferRevision:1,maxTotalCash:100},c,h),{meet:false});await one(tenant,(ch,c,h)=>Economy.buyGood(ch,'gin',4,c,h));await one(tenant,(ch,c,h)=>Warehouse.depositWarehouseCargo(ch,lease.lease.id,4,c,h));
 const pack='/v1/company/picking-packing',request=await ok(tenant,'POST',pack+'/create',{leaseId:lease.lease.id,quantity:1,feeCash:17,expiresInSeconds:600,consent:true});assert.equal((await quote(provider,warehouseBuyer)).body.message,'warehouse_offer','Unaccepted foreign picking request adds no new owner-consented blocker, while actual paid warehouse claims still block');await ok(provider,'POST',pack+'/accept',{jobId:request.jobId,consent:true});assert.equal((await quote(provider,warehouseBuyer)).body.message,'warehouse_offer');await assert.rejects(tx(c=>R.assertDepotFeatureObligations(c,provider.business)),/picking_accepted/);const earned=await ok(provider,'POST',pack+'/fulfill',{jobId:request.jobId},'actual-picking-earned');assert.equal(earned.state,'fulfilled');assert.equal((await quote(provider,warehouseBuyer)).body.message,'warehouse_offer');await one(tenant,(ch,c,h)=>Warehouse.withdrawWarehouseCargo(ch,lease.lease.id,3,c,h));await one(tenant,(ch,c)=>Warehouse.closeWarehouseLease(ch,lease.lease.id,c));await one(provider,(ch,c)=>Warehouse.configureWarehouseOffer(ch,provider.business,{expectedRevision:1,enabled:false,slots:10,cashPerUnitDay:25},c));assert.equal((await quote(provider,warehouseBuyer)).code,200,'Verified earned fee and warehouse withdrawal immutable history do not block after real lease settlement');await global();
 const unknown=await player(),unknownBuyer=await buyer();await app.pool.query('CREATE TABLE unsupported_next_five_depot(id TEXT PRIMARY KEY,business_id TEXT)');assert.equal((await quote(unknown,unknownBuyer)).body.message,'unsupported_schema');await app.pool.query('DROP TABLE unsupported_next_five_depot');
 if(native){
  const owner=await player(),patron=await player(),purchaser=await buyer(),pending=await fund(owner,patron),sale=await deal(owner,purchaser),beforeCash=await cash(patron);
  const saleRequest=Object.freeze([owner,'POST',base+'/'+sale.id+'/execute',Object.freeze({termsHash:sale.termsHash}),'sale-consent-race']);
  const race=await Promise.all([call(owner,'POST','/v1/company/commissions/accept',cref(pending),'maker-consent-race'),call(...saleRequest)]);
  assert.equal(race.filter(x=>x.code===200).length,1,JSON.stringify(race));
  const contract=(await app.pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1',[pending.commissionId])).rows[0];
  if(race[0].code===200){
   let saleRefusal=race[1];
   if(saleRefusal.body.error==='contention'){
    assert.equal(saleRefusal.code,400,JSON.stringify(saleRefusal));
    assert.deepEqual(saleRefusal.body,{error:'contention',message:'Commission counterpart changed; retry the whole action.'});
    // Acceptance may expand the actor union after discovery; retry the unchanged request once.
    saleRefusal=await call(...saleRequest);
    assert.deepEqual((await app.pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1',[pending.commissionId])).rows[0],contract);
   }
   assert.equal(saleRefusal.code,400,JSON.stringify(saleRefusal));
   assert.deepEqual(saleRefusal.body,{error:'depot_acquisition_runtime',message:'commission_accepted'});
   assert.equal(contract.status,'accepted');assert.equal((await app.pool.query('SELECT owner_character FROM business_depots WHERE id=$1',[owner.business])).rows[0].owner_character,owner.id);assert.equal((await app.pool.query('SELECT id FROM transactions WHERE counterparty=$1',[sale.id])).rows.length,0);
  }
  else{assert.equal(race[0].body.message,'business');assert.equal(race[1].code,200);assert.equal(contract.status,'funded');assert.equal((await app.pool.query('SELECT owner_character FROM business_depots WHERE id=$1',[owner.business])).rows[0].owner_character,purchaser.id);assert.equal((await app.pool.query('SELECT id FROM transactions WHERE counterparty=$1',[sale.id])).rows.length,2);}
  assert.equal(await cash(patron),beforeCash);assert.equal(Number(contract.fee_remaining),100);assert.equal((await ok(patron,'POST','/v1/company/commissions/refund',cref(pending),'race-source-refund')).refundedFee,100);assert.equal(await cash(patron),beforeCash+100);await global();
 }
 console.log('Canonical next-five F15 relationships '+(native?'native '+version:'memory')+' PASS: actual customer-funded source survives paid sale and original refund, maker consent blocks, real completed history/ACK preserved, packing consent/earned fee/canonical warehouse recovery, unknown schema closed'+(native?'/concurrent maker acceptance versus sale serialized with exact reserve/refund':'')+'.');
}finally{await app.close();}
