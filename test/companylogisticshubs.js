import assert from 'node:assert/strict';
import * as Hub from '../src/companylogisticshubs.js';
import { logisticsHubInvariant } from '../src/companylogisticshubsinvariants.js';
const native=process.argv.includes('--postgres'); assert(!process.env.DATABASE_URL,'Hub proofs reject ambient DATABASE_URL');
if(native) {
  const url=new URL(process.env.COMPANY_LOGISTICS_HUB_TEST_DATABASE_URL);
  assert.equal(url.hostname,'127.0.0.1'); assert(['35439','35449'].includes(url.port)); assert.equal(url.username,'pilot_runner'); assert.match(url.pathname,/^\/logistics_hub_proof_[a-z0-9_]+$/);
  const { default:pg }=await import('pg'), p=new pg.Pool({ connectionString:url.href });
  try { assert.match((await p.query('SHOW server_version')).rows[0].server_version,/^18\.4/); assert.equal((await p.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); } finally { await p.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',DELIVERY_CONTRACTS:'on',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'logistics-hub-local-proof-secret',MARKET_SEED:'logistics-hub-local-native-seed',MOD_KEY:'logistics-hub-local-test-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js'), D=await import('../src/depot.js');
const W=await import('../src/warehouseleases.js'), P=await import('../src/commercialpremises.js'), F=await import('../src/deliveryfinance.js'), Delivery=await import('../src/delivery.js');
const { setAgentCompany }=await import('../src/agentcompany.js'), { runEstate }=await import('../src/social/estate.js');
const { buyGood }=await import('../src/economy.js');
const app=await buildServer(); let serial=0;
if(!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
if(!app.hasRoute({ method:'GET',url:'/v1/company/logistics-hubs' })) (await import('../src/routes/companylogisticshubs.js')).register(app,{ pool:app.pool,auth:async req=>req.jwtVerify() });
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn);
const pair=(p,other,fn)=>G.withTwoCharacters(app.pool,p.account,other.id,fn,{ meet:false });
async function player() {
  const token=(await app.inject({ method:'POST',url:'/v1/auth/guest' })).json().token;
  const response=await app.inject({ method:'POST',url:'/v1/character',headers:{ authorization:`Bearer ${token}`,'idempotency-key':`hub-player-${++serial}` },payload:{ name:`Hub Player ${serial}` } }); assert.equal(response.statusCode,200,response.body);
  const account=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub, ch=(await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive',[account])).rows[0];
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1",[ch.id,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:ch.id,currency:'cash',amount:100000-Number(ch.cash),reason:'crime:hub-proof-fixture' });
  return { id:ch.id,account,token };
}
const config={ salePrice:8000,bidPrice:5000,targetStock:4,reorderAt:0,restockBudget:25000 };
async function fixture(count=2) {
  const supplier=await player(),landlord=await player(),buyer=await player(),foreign=await player();
  await app.pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)',[landlord.account]);
  await setAgentCompany(app.pool,landlord.account,{ expectedRevision:0,name:`Warehouse Credit ${serial}`,published:false,premises:'estate' });
  await setAgentCompany(app.pool,supplier.account,{ expectedRevision:0,name:`Hub Operator ${serial}`,published:false,premises:null });
  const warehouseDepot=await single(landlord,(ch,client,h)=>D.openDepot(ch,config,client,h));
  await single(landlord,(ch,client)=>W.configureWarehouseOffer(ch,warehouseDepot.id,{ expectedRevision:0,enabled:true,slots:10,cashPerUnitDay:25 },client));
  const premisesOffer=await single(landlord,(ch,client)=>P.offerPremises(ch,{ expectedRevision:0,expectedCompanyRevision:1,depotId:warehouseDepot.id,slots:2,rentCash:100,durationSeconds:3600,offerExpiresAt:new Date(Date.now()+7200000).toISOString(),published:false },'premises-offer',client));
  const premises=await pair(supplier,landlord,(ch,owner,client,h)=>P.leasePremises(ch,owner,premisesOffer.offer.id,{ expectedRevision:1,slot:1,maxRentCash:100,consent:true },'premises-lease',client,h));
  const warehouse=await pair(supplier,landlord,(ch,owner,client,h)=>W.leaseWarehouse(ch,owner,warehouseDepot.id,{ units:count*2,expectedOfferRevision:1,maxTotalCash:count*50 },client,h));
  const buyerDepot=await single(buyer,(ch,client,h)=>D.openDepot(ch,config,client,h));
  await single(buyer,(ch,client,h)=>D.fundDepot(ch,buyerDepot.id,30000,client,h));
  const order=await single(buyer,(ch,client,h)=>D.restockDepot(ch,buyerDepot.id,client,h));
  const financed=[];
  await single(supplier,(ch,client,h)=>buyGood(ch,'gin',count*2,client,h));
  await single(supplier,(ch,client,h)=>W.depositWarehouseCargo(ch,warehouse.lease.id,count*2,client,h));
  for(let i=0;i<count;i++) {
    const commitment=await single(supplier,(ch,client)=>Delivery.acceptDelivery(ch,order.id,{ qty:2,maxProcurementCash:10000,deadlineSeconds:1800,unitPrice:5000 },client));
    const request=await pair(supplier,landlord,(ch,owner,client,h)=>F.requestDeliveryAdvance(ch,owner,{ supplierId:ch.id,lenderId:owner.id,commitmentId:commitment.id,principal:5000,rate:0.1,hours:1 },`finance-${i}`,client,h));
    await pair(landlord,supplier,(ch,other,client,h)=>F.offerDeliveryAdvance(ch,other,request.request.id,client,h));
    if(i===0) await pair(supplier,landlord,(ch,other,client,h)=>F.takeDeliveryAdvance(ch,other,request.request.id,client,h));
    financed.push({ requestId:request.request.id,commitmentId:commitment.id });
  }
  const body={ premisesLeaseId:premises.lease.id,warehouseLeaseId:warehouse.lease.id,financeRequestIds:financed.map(row=>row.requestId) };
  return { supplier,landlord,buyer,foreign,warehouse,premises,warehouseDepot,financed,body };
}
const setup=f=>pair(f.supplier,f.landlord,(ch,owner,client)=>Hub.setupLogisticsHub(ch,owner,f.body,'setup',client));
const accept=(f,id)=>pair(f.supplier,f.landlord,(ch,owner,client)=>Hub.acceptLogisticsHub(ch,owner,id,{ expectedRevision:1,consent:true },'accept',client));
const run=(f,id,rev,key='run')=>pair(f.supplier,f.landlord,(ch,owner,client,h)=>Hub.runLogisticsHub(ch,owner,id,{ expectedRevision:rev },key,client,h));
async function state(f,id) {
  return { cash:(await app.pool.query('SELECT id,cash FROM characters WHERE id IN ($1,$2)',[f.supplier.id,f.landlord.id])).rows,
    cargo:(await app.pool.query('SELECT * FROM character_cargo WHERE character_id=$1',[f.supplier.id])).rows,
    warehouse:(await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1',[f.warehouse.lease.id])).rows,
    hub:(await app.pool.query('SELECT state,revision FROM company_logistics_hubs WHERE id=$1',[id])).rows,
    sources:(await app.pool.query('SELECT state,settlement,withdrawal_journal_id FROM company_logistics_hub_sources WHERE hub_id=$1 ORDER BY position',[id])).rows,
    requests:(await app.pool.query('SELECT state,settlement FROM delivery_loan_requests WHERE id IN ($1,$2)',[f.financed[0].requestId,f.financed[1]?.requestId||f.financed[0].requestId])).rows };
}
try {
  const f=await fixture();
  await assert.rejects(pair(f.supplier,f.landlord,(ch,owner,client)=>Hub.setupLogisticsHub(ch,owner,{ ...f.body,financeRequestIds:[...f.body.financeRequestIds].reverse() },'wrong-active-order',client)),/active_advance_must_be_first/);
  const draft=await setup(f); assert.equal(draft.hub.totalUnits,4);
  assert.equal((await setup(f)).replayed,true); await accept(f,draft.hub.id);
  const first=await run(f,draft.hub.id,2); assert.equal(first.withdrawn,2); assert.equal(first.settlement.delivery.delivered,2); assert.equal(first.alreadySettled,false);
  const beforeReplay=await state(f,draft.hub.id); assert.equal((await run(f,draft.hub.id,2)).replayed,true); assert.deepEqual(await state(f,draft.hub.id),beforeReplay);
  await assert.rejects(run(f,draft.hub.id,2,'different-key'),/revision/);
  const second=await run(f,draft.hub.id,3,'run-two'); assert.equal(second.hub.state,'completed'); assert.equal(Number((await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1',[f.warehouse.lease.id])).rows[0].held_qty),0);
  assert.equal((await app.pool.query('SELECT qty FROM character_cargo WHERE character_id=$1 AND good_id=$2',[f.supplier.id,'gin'])).rows.length,0);
  const history=await Hub.logisticsHubBoard(app.pool,f.foreign.account); assert.equal(history.hubs.length,0);
  const privateHTTP=await app.inject({ method:'GET',url:'/v1/company/logistics-hubs',headers:{ authorization:`Bearer ${f.foreign.token}` } });
  assert.equal(privateHTTP.statusCode,200,privateHTTP.body); assert.equal(privateHTTP.json().hubs.length,0);
  const agent=await fixture(1), agentToken=(await app.inject({ method:'POST',url:'/v1/auth/agent-key',headers:{ authorization:`Bearer ${agent.supplier.token}`,'idempotency-key':'hub-agent-key' } })).json().token;
  const agentSetup=await app.inject({ method:'POST',url:'/v1/company/logistics-hubs',headers:{ authorization:`Bearer ${agentToken}`,'idempotency-key':'hub-agent-setup' },payload:agent.body });
  assert.equal(agentSetup.statusCode,200,agentSetup.body); assert.equal(agentSetup.json().hub.advances[0].terms.principal,5000);
  const agentAccept=await app.inject({ method:'POST',url:`/v1/company/logistics-hubs/${agentSetup.json().hub.id}/accept`,headers:{ authorization:`Bearer ${agentToken}`,'idempotency-key':'hub-agent-accept' },payload:{ consent:true,expectedRevision:1 } });
  assert.equal(agentAccept.statusCode,200,agentAccept.body);
  const agentRun=await app.inject({ method:'POST',url:`/v1/company/logistics-hubs/${agentSetup.json().hub.id}/run`,headers:{ authorization:`Bearer ${agentToken}`,'idempotency-key':'hub-agent-run' },payload:{ expectedRevision:2 } });
  assert.equal(agentRun.statusCode,200,agentRun.body); assert.equal(agentRun.json().settlement.delivery.delivered,2);
  const invalid=await fixture(1);
  for(const change of [{ financeRequestIds:[invalid.financed[0].requestId,invalid.financed[0].requestId] },{ financeRequestIds:[] },{ address:'external' },{ fees:100 }]) await assert.rejects(pair(invalid.supplier,invalid.landlord,(ch,owner,client)=>Hub.setupLogisticsHub(ch,owner,{ ...invalid.body,...change },`invalid-${serial++}`,client)),/terms/);
  await assert.rejects(pair(invalid.foreign,invalid.landlord,(ch,owner,client)=>Hub.setupLogisticsHub(ch,owner,invalid.body,'foreign',client)),/access_expired|party/);
  const foreignWarehouse=await pair(invalid.foreign,invalid.landlord,(ch,owner,client,h)=>W.leaseWarehouse(ch,owner,invalid.warehouseDepot.id,{ units:2,expectedOfferRevision:1,maxTotalCash:50 },client,h));
  await single(invalid.foreign,(ch,client,h)=>buyGood(ch,'gin',2,client,h));
  await single(invalid.foreign,(ch,client,h)=>W.depositWarehouseCargo(ch,foreignWarehouse.lease.id,2,client,h));
  await assert.rejects(pair(invalid.supplier,invalid.landlord,(ch,owner,client)=>Hub.setupLogisticsHub(ch,owner,{ ...invalid.body,warehouseLeaseId:foreignWarehouse.lease.id },'foreign-cargo',client)),/custody_pairing/);
  assert.equal(Number((await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1',[foreignWarehouse.lease.id])).rows[0].held_qty),2);
  const wrongLender=await fixture(1);
  const wrongLoan=(await app.pool.query('SELECT loan_id FROM delivery_loan_requests WHERE id=$1',[wrongLender.financed[0].requestId])).rows[0].loan_id;
  await app.pool.query('UPDATE loans SET lender_character=$2 WHERE id=$1',[wrongLoan,wrongLender.foreign.id]);
  await assert.rejects(setup(wrongLender),/supported_landlord_financier/);
  const externallySettled=await fixture(1), externalHub=await setup(externallySettled); await accept(externallySettled,externalHub.hub.id);
  await pair(externallySettled.supplier,externallySettled.landlord,async (ch,owner,client,h)=>{
    await W.withdrawWarehouseCargo(ch,externallySettled.warehouse.lease.id,2,client,h);
    await F.deliverFinancedCommitment(ch,owner,externallySettled.financed[0].commitmentId,2,client,h);
  });
  const advanced=await run(externallySettled,externalHub.hub.id,2); assert.equal(advanced.alreadySettled,true); assert.equal(advanced.withdrawn,0);
  const drift=await fixture(1), driftHub=await setup(drift); await accept(drift,driftHub.hub.id);
  await single(drift.supplier,(ch,client)=>P.cancelPremisesLease(ch,drift.premises.lease.id,{ expectedRevision:1 },'revoke',client));
  await assert.rejects(run(drift,driftHub.hub.id,2),/access_expired/);
  const expired=await fixture(1), expiredHub=await setup(expired); await accept(expired,expiredHub.hub.id);
  await app.pool.query("UPDATE business_warehouse_leases SET created_at=clock_timestamp()-interval '2 hours',expires_at=clock_timestamp()-interval '1 hour' WHERE id=$1",[expired.warehouse.lease.id]);
  await assert.rejects(run(expired,expiredHub.hub.id,2),/lease_expired/);
  const dead=await fixture(1), deadHub=await setup(dead); await accept(dead,deadHub.hub.id);
  const estate=await pair(dead.landlord,dead.supplier,async (_ch,target,client,h)=>{
    const result=await runEstate(client,h,target,'hub actual estate proof'); await Hub.voidLogisticsHubsAtDeath(client,target); return result;
  });
  assert.equal((await app.pool.query('SELECT state FROM company_logistics_hubs WHERE id=$1',[deadHub.hub.id])).rows[0].state,'closed');
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[estate.heirId,new Date(Date.now()+3600000)]);
  const heir={ ...dead.supplier,id:estate.heirId };
  assert.equal((await pair(heir,dead.landlord,(ch,owner,client)=>Hub.setupLogisticsHub(ch,owner,dead.body,'setup',client))).replayed,true);
  await assert.rejects(pair(heir,dead.landlord,(ch,owner,client)=>Hub.acceptLogisticsHub(ch,owner,deadHub.hub.id,{ expectedRevision:3,consent:true },'new-authority',client)),/party/);
  if(native) {
    const rebound=await fixture(1), reboundHub=await setup(rebound); await accept(rebound,reboundHub.hub.id);
    const foreign=await fixture(1), beforeRebound=await state(rebound,reboundHub.hub.id);
    const leaseHold=await app.pool.connect();
    try {
      await leaseHold.query('BEGIN');
      await leaseHold.query('SELECT id FROM business_warehouse_leases WHERE id=$1 FOR UPDATE',[rebound.warehouse.lease.id]);
      const pending=run(rebound,reboundHub.hub.id,2,'warehouse-binding-wait');
      let observed=false;
      for(let attempt=0;attempt<60;attempt++) {
        if((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM business_warehouse_leases%' LIMIT 1")).rows.length){observed=true;break;}
        await new Promise(resolve=>setTimeout(resolve,5));
      }
      assert.equal(observed,true,'Canonical pair waits on the warehouse leaf after the unlocked hint');
      await leaseHold.query('UPDATE business_warehouse_leases SET depot_id=$2 WHERE id=$1',[rebound.warehouse.lease.id,foreign.warehouseDepot.id]);
      await leaseHold.query('COMMIT');
      await assert.rejects(pending,/custody_pairing/,'Authoritative locked lease must still match its hinted and premises depot');
    } finally { await leaseHold.query('ROLLBACK'); leaseHold.release(); }
    await app.pool.query('UPDATE business_warehouse_leases SET depot_id=$2 WHERE id=$1',[rebound.warehouse.lease.id,rebound.warehouseDepot.id]);
    assert.deepEqual(await state(rebound,reboundHub.hub.id),beforeRebound,'Drift refusal withdraws nothing and leaves source settlement/progress unchanged');
    await run(rebound,reboundHub.hub.id,2,'warehouse-binding-restored');
    const raced=await fixture(2), racedHub=await setup(raced); await accept(raced,racedHub.hub.id);
    const result=await Promise.allSettled([run(raced,racedHub.hub.id,2,'race-a'),run(raced,racedHub.hub.id,2,'race-b')]); assert.equal(result.filter(row=>row.status==='fulfilled').length,1);
    assert.equal((await app.pool.query("SELECT position FROM company_logistics_hub_sources WHERE hub_id=$1 AND state='pending'",[racedHub.hub.id])).rows.length,1);
    assert.equal((await run(raced,racedHub.hub.id,3,'race-next')).hub.state,'completed');
    const rollback=await fixture(1), rollbackHub=await setup(rollback); await accept(rollback,rollbackHub.hub.id); const original=await state(rollback,rollbackHub.hub.id);
    await assert.rejects(pair(rollback.supplier,rollback.landlord,async (ch,owner,client,h)=>{ await Hub.runLogisticsHub(ch,owner,rollbackHub.hub.id,{ expectedRevision:2 },'rollback',client,h); throw new Error('rollback'); }),/rollback/);
    assert.deepEqual(await state(rollback,rollbackHub.hub.id),original); await run(rollback,rollbackHub.hub.id,2);
    const wait=await fixture(1), waitHub=await setup(wait); await accept(wait,waitHub.hub.id);
    const loan=(await app.pool.query('SELECT loan_id FROM delivery_loan_requests WHERE id=$1',[wait.financed[0].requestId])).rows[0].loan_id;
    const holder=await app.pool.connect(); try {
      await holder.query('BEGIN'); await holder.query('SELECT id FROM loans WHERE id=$1 FOR UPDATE',[loan]);
      const pending=run(wait,waitHub.hub.id,2,'source-wait');
      await app.pool.query("UPDATE company_logistics_hubs SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[waitHub.hub.id]);
      await holder.query('COMMIT'); await assert.rejects(pending,/hub_expired/);
    } finally { await holder.query('ROLLBACK'); holder.release(); }
  }
  const invariant=await logisticsHubInvariant(app.pool); assert.equal(invariant.ok,true,JSON.stringify(invariant));
  const original=(await app.pool.query('SELECT settlement FROM company_logistics_hub_sources WHERE hub_id=$1 AND position=1',[draft.hub.id])).rows[0].settlement;
  await app.pool.query('UPDATE company_logistics_hub_sources SET settlement=$2 WHERE hub_id=$1 AND position=1',[draft.hub.id,{ delivery:{ delivered:999 },repayment:{ paid:0 } }]);
  assert.equal((await logisticsHubInvariant(app.pool)).ok,false,'Fake progress/settlement JSON cannot satisfy canonical source invariant');
  await app.pool.query('UPDATE company_logistics_hub_sources SET settlement=$2 WHERE hub_id=$1 AND position=1',[draft.hub.id,original]);
  assert.equal((await logisticsHubInvariant(app.pool)).ok,true);
  console.log(`companylogisticshubs ${native?'PostgreSQL18.4 race/rollback/source-expiry':'memory'}: actual warehouse withdrawal+financed settlement, batch bounds, replay, foreign custody/privacy, premises/warehouse expiry and canonical death passed`);
} finally { await app.close(); }
