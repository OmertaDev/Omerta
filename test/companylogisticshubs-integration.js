import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres'); let serverVersion='memory';
assert(!process.env.DATABASE_URL,'Hub integration rejects ambient DATABASE_URL');
if(native) {
  const url=new URL(process.env.LOGISTICS_HUB_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgresql:','postgres:'].includes(url.protocol)); assert(['127.0.0.1','localhost'].includes(url.hostname));
  const localPilot=['35439','35449'].includes(url.port) && url.username==='pilot_runner' && url.password==='';
  const ci=url.port==='5432' && url.username==='postgres' && url.password==='pgcheck';
  assert(localPilot||ci,'Only approved fresh local pilot or CI endpoint'); assert(!url.search && !url.hash); assert.match(url.pathname,/^\/logistics_hub_proof_[a-z0-9_]+$/);
  const { default:pg }=await import('pg'), pre=new pg.Pool({ connectionString:url.href });
  try {
    await pre.query('BEGIN READ ONLY'); serverVersion=(await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(serverVersion,localPilot?/^18\.4(?:[.\s]|$)/:/^(?:16(?:[.\s]|$)|18\.4(?:[.\s]|$))/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0,'Own a fresh empty integration database'); await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',DELIVERY_CONTRACTS:'on',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'logistics-hub-integration-isolated-secret',
  MARKET_SEED:'logistics-hub-integration-fixture-seed',MOD_KEY:'logistics-hub-integration-fixture-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js');
const { runEstate }=await import('../src/social/estate.js'), { runLedgerInvariants }=await import('../src/invariants.js');
const { LOAN,loanVig }=await import('../src/rules.js');
const app=await buildServer(); let serial=0,keySerial=0;
if(!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
const base='/v1/company/logistics-hubs';
const call=async (p,method,url,body,key=`hub-api-${++keySerial}`,agent=false)=>{
  const response=await app.inject({ method,url,payload:body,headers:{ ...(p?{ authorization:`Bearer ${agent?p.agent:p.token}` }:{}),'idempotency-key':key } });
  return { code:response.statusCode,body:response.json() };
};
const ok=async (...args)=>{ const result=await call(...args); assert.equal(result.code,200,JSON.stringify(result)); return result.body; };
const reject=async (...args)=>{ const result=await call(...args); assert([400,409].includes(result.code)||(result.code===422&&result.body.error==='idempotency_key_reuse'),JSON.stringify(result)); return result.body; };
const recovered=(original,retry)=>{ const {replayed,...body}=retry; assert.deepEqual(body,original); if(replayed!==undefined) assert.equal(replayed,true); };
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
async function player() {
  const p={ token:(await ok(null,'POST','/v1/auth/guest')).token };
  await ok(p,'POST','/v1/character',{ name:`Hub API ${++serial}` }); p.account=JSON.parse(Buffer.from(p.token.split('.')[1],'base64url')).sub;
  const ch=(await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive',[p.account])).rows[0]; p.id=ch.id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1",[p.id,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:p.id,currency:'cash',amount:100000-Number(ch.cash),reason:'crime:hub-integration-fixture' });
  p.agent=(await ok(p,'POST','/v1/auth/agent-key')).token; assert.equal(JSON.parse(Buffer.from(p.agent.split('.')[1],'base64url')).agent,true); return p;
}
const depotTerms={ salePrice:8000,bidPrice:5000,targetStock:4,reorderAt:0,restockBudget:25000 };
async function fixture(count=2) {
  const supplier=await player(),landlord=await player(),buyer=await player(),foreign=await player();
  await app.pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)',[landlord.account]);
  await ok(landlord,'POST','/v1/resources/company',{ expectedRevision:0,name:`Private Hub Financier ${serial}`,published:false,premises:'estate' });
  for(const p of [supplier,foreign]) await ok(p,'POST','/v1/resources/company',{ expectedRevision:0,name:`Private Hub Operator ${++serial}`,published:false,premises:null });
  const warehouseDepot=await ok(landlord,'POST','/v1/depot',depotTerms);
  await ok(landlord,'POST',`/v1/depot/${warehouseDepot.id}/warehouse-offer`,{ expectedRevision:0,enabled:true,slots:10,cashPerUnitDay:25 });
  const offer=await ok(landlord,'POST','/v1/company/premises/offers',{ expectedRevision:0,expectedCompanyRevision:1,depotId:warehouseDepot.id,slots:2,rentCash:100,durationSeconds:3600,offerExpiresAt:new Date(Date.now()+7200000).toISOString(),published:false });
  const premises=await ok(supplier,'POST',`/v1/company/premises/offers/${offer.offer.id}/lease`,{ expectedRevision:1,slot:1,maxRentCash:100,consent:true },undefined,true);
  const warehouse=await ok(supplier,'POST',`/v1/warehouses/${warehouseDepot.id}/lease`,{ units:count*2,expectedOfferRevision:1,maxTotalCash:count*50 });
  const buyerDepot=await ok(buyer,'POST','/v1/depot',depotTerms);
  await ok(buyer,'POST',`/v1/depot/${buyerDepot.id}/fund`,{ amount:30000 });
  const order=await ok(buyer,'POST',`/v1/depot/${buyerDepot.id}/restock`,{});
  await ok(supplier,'POST','/v1/goods/buy',{ goodId:'gin',qty:count*2 });
  await ok(supplier,'POST',`/v1/warehouse-leases/${warehouse.lease.id}/deposit`,{ qty:count*2 });
  const financed=[];
  for(let position=0;position<count;position++) {
    const commitment=await ok(supplier,'POST',`/v1/market/${order.id}/accept-delivery`,{ qty:2,maxProcurementCash:10000,deadlineSeconds:1800,unitPrice:5000 });
    const request=await ok(supplier,'POST','/v1/delivery-finance/requests',{ supplierId:supplier.id,lenderId:landlord.id,commitmentId:commitment.id,principal:5000,rate:0.1,hours:1 });
    const offered=await ok(landlord,'POST',`/v1/delivery-finance/${request.request.id}/offer`,{});
    if(position===0) await ok(supplier,'POST',`/v1/delivery-finance/${request.request.id}/take`,{});
    financed.push({ requestId:request.request.id,commitmentId:commitment.id,loanId:offered.request.loanId });
  }
  return {supplier,landlord,buyer,foreign,warehouseDepot,buyerDepot,order,premises,warehouse,financed,
    body:{ premisesLeaseId:premises.lease.id,warehouseLeaseId:warehouse.lease.id,financeRequestIds:financed.map(r=>r.requestId) }};
}
const setup=(f,key=`hub-setup-${++keySerial}`,agent=true)=>ok(f.supplier,'POST',base,f.body,key,agent);
const accept=(f,id,key=`hub-accept-${++keySerial}`,agent=false)=>ok(f.supplier,'POST',`${base}/${id}/accept`,{ expectedRevision:1,consent:true },key,agent);
const run=(f,id,revision,key=`hub-run-${++keySerial}`,agent=true)=>ok(f.supplier,'POST',`${base}/${id}/run`,{ expectedRevision:revision },key,agent);
async function state(f,id) {
  return {
    cash:(await app.pool.query('SELECT id,cash FROM characters WHERE id IN ($1,$2) ORDER BY id',[f.supplier.id,f.landlord.id])).rows,
    cargo:(await app.pool.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id',[f.supplier.id])).rows,
    warehouse:(await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1',[f.warehouse.lease.id])).rows,
    loans:(await app.pool.query('SELECT id,status,borrower_character FROM loans WHERE id IN ($1,$2) ORDER BY id',[f.financed[0].loanId,f.financed[1]?.loanId||f.financed[0].loanId])).rows,
    finance:(await app.pool.query('SELECT id,state,settlement FROM delivery_loan_requests WHERE id IN ($1,$2) ORDER BY id',[f.financed[0].requestId,f.financed[1]?.requestId||f.financed[0].requestId])).rows,
    market:(await app.pool.query('SELECT qty,filled_qty FROM market_listings WHERE id=$1',[f.order.id])).rows,
    hub:(await app.pool.query('SELECT state,revision FROM company_logistics_hubs WHERE id=$1',[id])).rows,
    sources:(await app.pool.query('SELECT position,state,withdrawal_journal_id,settlement FROM company_logistics_hub_sources WHERE hub_id=$1 ORDER BY position',[id])).rows,
    withdrawalCount:Number((await app.pool.query("SELECT COUNT(*) AS n FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_withdraw'",[f.warehouse.lease.id])).rows[0].n),
    transactionCount:Number((await app.pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n),
  };
}
async function global() {
  const checks=(await runLedgerInvariants(app.pool,{ alert:false })).checks;
  assert(checks.some(c=>c.name==='company logistics hub canonical work'),'Actual global collector includes canonical hub invariant');
  assert.deepEqual(checks.filter(c=>!c.ok),[],'Actual global cash/gin/custody/source invariants reconcile');
}
async function die(killer,victim) {
  const result=await G.withTwoCharacters(app.pool,killer.account,victim.id,(_ch,target,db,h)=>runEstate(db,h,target,'logistics hubs actual integration'),{meet:false});
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[result.heirId,new Date(Date.now()+3600000)]);
  const heir={...victim,id:result.heirId},prestige=Number((await app.pool.query('SELECT prestige FROM account_persistent WHERE account_id=$1',[victim.account])).rows[0].prestige);
  assert.equal(await cash(heir),500+100*prestige,'No hub cash or authority is inherited beyond canonical estate stake'); return heir;
}
try {
  assert.equal((await call(null,'GET',base)).code,401); assert(app.hasRoute({ method:'POST',url:`${base}/:id/run` }));
  assert.equal(LOAN.MAX_ACTIVE,1,'Frozen bundle preserves original active loan cap');
  const f=await fixture(),before=await state(f,'no-hub');
  await reject(f.supplier,'POST',base,{...f.body,wallet:'external'});
  await reject(f.supplier,'POST',base,{...f.body,financeRequestIds:[...f.body.financeRequestIds].reverse()});
  await reject(f.supplier,'POST',base,{...f.body,financeRequestIds:[f.financed[0].requestId,f.financed[0].requestId]});
  await reject(f.foreign,'POST',base,f.body);
  const drafted=await setup(f,'main-setup'); recovered(drafted,await setup(f,'main-setup',false));
  const id=drafted.hub.id;
  const draftState=await state(f,id); assert.deepEqual(draftState.cash,before.cash); assert.deepEqual(draftState.warehouse,before.warehouse);
  await reject(f.foreign,'POST',`${base}/${id}/accept`,{ expectedRevision:1,consent:true });
  await reject(f.foreign,'POST',`${base}/${id}/run`,{ expectedRevision:2 });
  await reject(f.supplier,'POST',`${base}/${id}/accept`,{ expectedRevision:1,consent:false });
  const accepted=await accept(f,id,'main-accept'); recovered(accepted,await accept(f,id,'main-accept',true));
  assert.deepEqual((await state(f,id)).cash,before.cash); assert.equal(accepted.hub.newFees,0);
  assert.equal((await ok(f.foreign,'GET',base)).hubs.length,0); assert.equal((await ok(f.landlord,'GET',base)).hubs.length,0);
  assert.equal(Number((await app.pool.query("SELECT COUNT(*) AS n FROM loans WHERE borrower_character=$1 AND status='active'",[f.supplier.id])).rows[0].n),1);
  await reject(f.supplier,'POST',`/v1/delivery-finance/${f.financed[1].requestId}/take`,{});
  assert.equal((await app.pool.query('SELECT state FROM delivery_loan_requests WHERE id=$1',[f.financed[1].requestId])).rows[0].state,'offered','Cannot pre-take staged source while first loan remains active');
  const firstSupplier=await cash(f.supplier),firstLender=await cash(f.landlord),first=await run(f,id,2,'main-run-one',false);
  assert.equal(first.withdrawn,2); assert.equal(first.settlement.delivery.delivered,2); assert.equal(first.settlement.repayment.paid,5500);
  assert.equal(await cash(f.supplier),firstSupplier+9800-5500); assert.equal(await cash(f.landlord),firstLender+5500-loanVig(5500));
  const firstState=await state(f,id); recovered(first,await run(f,id,2,'main-run-one',true)); assert.deepEqual(await state(f,id),firstState);
  assert.equal(firstState.withdrawalCount,1); assert.equal(Number(firstState.warehouse[0].held_qty),2);
  assert.equal(Number((await app.pool.query("SELECT COUNT(*) AS n FROM loans WHERE borrower_character=$1 AND status='active'",[f.supplier.id])).rows[0].n),0);
  assert.equal((await app.pool.query('SELECT state FROM delivery_loan_requests WHERE id=$1',[f.financed[1].requestId])).rows[0].state,'offered');
  await global();
  const secondSupplier=await cash(f.supplier),second=await run(f,id,3,'main-run-two',true);
  assert.equal(second.hub.state,'completed'); assert.equal(second.withdrawn,2); assert.equal(await cash(f.supplier),secondSupplier+5000+9800-5500,'Only canonical staged loan take supplies principal');
  const final=await state(f,id); assert.equal(final.withdrawalCount,2); assert.equal(Number(final.warehouse[0].held_qty),0); assert.equal(final.cargo.length,0);
  assert(final.loans.every(r=>r.status==='repaid')); assert(final.finance.every(r=>r.state==='settled')); assert.equal(Number(final.market[0].filled_qty),4);
  recovered(second,await run(f,id,3,'main-run-two',false)); assert.deepEqual(await state(f,id),final); await global();
  const cancelled=await fixture(1),cancelledHub=await setup(cancelled); await accept(cancelled,cancelledHub.hub.id);
  const cancellationState=await state(cancelled,cancelledHub.hub.id);
  const closed=await ok(cancelled.supplier,'POST',`${base}/${cancelledHub.hub.id}/cancel`,{ expectedRevision:2 },'cancel-bundle',true); assert.equal(closed.hub.state,'closed');
  const afterCancel=await state(cancelled,cancelledHub.hub.id); assert.deepEqual(afterCancel.cash,cancellationState.cash); assert.deepEqual(afterCancel.warehouse,cancellationState.warehouse); assert.deepEqual(afterCancel.finance,cancellationState.finance);
  await reject(cancelled.supplier,'POST',`${base}/${cancelledHub.hub.id}/run`,{ expectedRevision:3 });
  const drift=await fixture(1),driftHub=await setup(drift); await accept(drift,driftHub.hub.id); const beforeDrift=await state(drift,driftHub.hub.id);
  await ok(drift.supplier,'POST',`/v1/company/premises/leases/${drift.premises.lease.id}/cancel`,{ expectedRevision:1 });
  await reject(drift.supplier,'POST',`${base}/${driftHub.hub.id}/run`,{ expectedRevision:2 }); assert.deepEqual(await state(drift,driftHub.hub.id),beforeDrift);
  const death=await fixture(1),deathHub=await setup(death,'death-setup'); await accept(death,deathHub.hub.id);
  const heir=await die(death.landlord,death.supplier);
  assert.equal((await app.pool.query('SELECT state FROM company_logistics_hubs WHERE id=$1',[deathHub.hub.id])).rows[0].state,'closed');
  recovered(deathHub,await ok(heir,'POST',base,death.body,'death-setup',true));
  await reject(heir,'POST',`${base}/${deathHub.hub.id}/accept`,{ expectedRevision:3,consent:true });
  assert.equal(await cash(heir),500); await global();
  const landlordDeath=await fixture(1),landlordHub=await setup(landlordDeath,'landlord-death-setup'); await accept(landlordDeath,landlordHub.hub.id);
  const landlordHeir=await die(landlordDeath.foreign,landlordDeath.landlord);
  assert.equal((await app.pool.query('SELECT state FROM company_logistics_hubs WHERE id=$1',[landlordHub.hub.id])).rows[0].state,'closed');
  assert.equal((await app.pool.query('SELECT state FROM commercial_premises_leases WHERE id=$1',[landlordDeath.premises.lease.id])).rows[0].state,'landlord_dead');
  await reject(landlordDeath.supplier,'POST',`${base}/${landlordHub.hub.id}/run`,{ expectedRevision:3 });
  assert.equal(await cash(landlordHeir),500); await global();
  if(native) {
    const raced=await fixture(2),racedHub=await setup(raced); await accept(raced,racedHub.hub.id);
    const races=await Promise.all([
      call(raced.supplier,'POST',`${base}/${racedHub.hub.id}/run`,{expectedRevision:2},'race-human',false),
      call(raced.supplier,'POST',`${base}/${racedHub.hub.id}/run`,{expectedRevision:2},'race-agent',true),
    ]);
    assert.equal(races.filter(r=>r.code===200).length,1); assert.equal(races.filter(r=>r.code===400&&r.body.message==='revision').length,1);
    const racedState=await state(raced,racedHub.hub.id); assert.equal(racedState.withdrawalCount,1); assert.equal(racedState.sources.filter(r=>r.state==='pending').length,1);
    assert.equal((await run(raced,racedHub.hub.id,3,'race-next')).hub.state,'completed'); await global();
    const rollback=await fixture(1),rollbackHub=await setup(rollback); await accept(rollback,rollbackHub.hub.id);
    const originalState=await state(rollback,rollbackHub.hub.id),originalConnect=app.pool.connect,witnessed={withdrawal:0,settlement:0,hub:0};
    const wrapClient=client=>{
      const originalQuery=client.query,originalRelease=client.release;
      client.query=async function(sql,values,...rest) {
        if(sql.startsWith('INSERT INTO company_logistics_hub_requests')&&values?.[1]==='run'&&values?.[2]==='api-hub-rollback') throw new Error('injected hub final receipt failure');
        const response=await originalQuery.call(this,sql,values,...rest);
        if(sql.startsWith('INSERT INTO business_depot_journal')&&values?.[2]==='warehouse_withdraw') witnessed.withdrawal++;
        if(sql.startsWith("UPDATE delivery_loan_requests SET state='settled'")) witnessed.settlement++;
        if(sql.startsWith('UPDATE company_logistics_hubs SET state=$3')) witnessed.hub++;
        return response;
      };
      client.release=function(...args) { client.query=originalQuery;client.release=originalRelease;return originalRelease.apply(this,args); }; return client;
    };
    app.pool.connect=function(...args) {
      if(typeof args.at(-1)==='function') { const callback=args.pop(); return originalConnect.call(this,...args,(error,client)=>{if(error)return callback(error);const wrapped=wrapClient(client);callback(null,wrapped,wrapped.release);}); }
      return originalConnect.apply(this,args).then(wrapClient);
    };
    try { assert.equal((await call(rollback.supplier,'POST',`${base}/${rollbackHub.hub.id}/run`,{expectedRevision:2},'api-hub-rollback',true)).code,500); }
    finally { app.pool.connect=originalConnect; }
    assert.deepEqual(witnessed,{withdrawal:1,settlement:1,hub:1},'Actual owned withdrawal, canonical paid settlement and hub completion preceded late injected failure');
    assert.deepEqual(await state(rollback,rollbackHub.hub.id),originalState,'Cash, gin, sources, journals and progress roll back together');
    await run(rollback,rollbackHub.hub.id,2,'api-hub-rollback',false); await global();
    const waited=await fixture(1),waitedHub=await setup(waited); await accept(waited,waitedHub.hub.id);
    const beforeWait=await state(waited,waitedHub.hub.id),blocker=await app.pool.connect();
    await blocker.query('BEGIN'); await blocker.query('SELECT id FROM loans WHERE id=$1 FOR UPDATE',[waited.financed[0].loanId]);
    const pending=call(waited.supplier,'POST',`${base}/${waitedHub.hub.id}/run`,{expectedRevision:2},'after-source-lock',true);
    try {
      let observed=false;
      for(let attempt=0;attempt<40;attempt++) {
        if((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM loans%' LIMIT 1")).rows.length){observed=true;break;}
        await new Promise(resolve=>setTimeout(resolve,5));
      }
      assert.equal(observed,true,'Real HTTP bundle waits on canonical source loan row');
      await app.pool.query('UPDATE company_logistics_hubs SET expires_at=$2 WHERE id=$1',[waitedHub.hub.id,new Date(Date.now()-1000)]);
      await blocker.query('COMMIT'); const expired=await pending; assert.equal(expired.code,400);assert.equal(expired.body.message,'hub_expired');
      assert.deepEqual(await state(waited,waitedHub.hub.id),beforeWait,'Expired source wait performs no withdrawal, settlement or new credit');
    } finally { await blocker.query('ROLLBACK');blocker.release(); }
    await global();
  }
  const recorded=(await app.pool.query('SELECT settlement FROM company_logistics_hub_sources WHERE hub_id=$1 AND position=1',[id])).rows[0].settlement;
  await app.pool.query('UPDATE company_logistics_hub_sources SET settlement=$2 WHERE hub_id=$1 AND position=1',[id,{delivery:{delivered:999},repayment:{paid:0}}]);
  assert.equal((await runLedgerInvariants(app.pool,{alert:false})).checks.find(c=>c.name==='company logistics hub canonical work').ok,false,'Actual global collector rejects fabricated settlement JSON');
  await app.pool.query('UPDATE company_logistics_hub_sources SET settlement=$2 WHERE hub_id=$1 AND position=1',[id,recorded]);await global();
  console.log(`logistics hubs integration ${native?`PostgreSQL ${serverVersion}`:'memory'}: real JWT frozen bundle, paid occupancy/owned custody, staged canonical funding, actual withdrawal/delivery/repayment, MAX_ACTIVE=1, no hub fees, replay/private foreign, revocation/cancel, actual supplier/landlord estate/no heir authority and global cash/gin books passed${native?'; HTTP source race, witnessed atomic rollback and post-source-lock expiry passed':''}`);
} finally { await app.close(); await app.pool.end(); }
