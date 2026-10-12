import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres'); assert(!process.env.DATABASE_URL,'Refuse ambient database endpoints');
let nativeVersion;
if(native) {
  const url=new URL(process.env.COMPANY_WORKFLOW_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1');
  const pilot=url.username==='pilot_runner'&&['35439','35449'].includes(url.port), ci=url.username==='postgres'&&url.port==='5432';
  assert(pilot||ci); assert(/^\/company_workflow_[a-z0-9_]+$/.test(url.pathname)); assert(!url.search&&!url.hash);
  const { default:pg }=await import('pg'), pre=new pg.Pool({ connectionString:url.href });
  try { const version=(await pre.query('SHOW server_version')).rows[0].server_version; nativeVersion=version.split(' ')[0]; assert.match(version,pilot?/^18\.4(?:\D|$)/:/^(?:16(?:\D|$)|18\.4(?:\D|$))/); assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',DELIVERY_CONTRACTS:'on',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'workflow-integration-local-proof-secret',MARKET_SEED:'workflow-integration-native-local-seed',MOD_KEY:'workflow-integration-local-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js');
const { buyGood }=await import('../src/economy.js'), { runLedgerInvariants }=await import('../src/invariants.js');
const Workflow=await import('../src/companyworkflows.js'), { runCompanyWorkflows }=await import('../src/companyworkflowrunner.js');
const app=await buildServer(); let serial=0;
assert(app.hasRoute({ method:'POST',url:'/v1/company/workflows' }),'Actual server workflow registration required; no manual registration');
if(!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
async function call(p,method,url,payload,key=`workflow-integrated-${++serial}`) {
  const r=await app.inject({ method,url,payload,headers:{ ...(p?{ authorization:`Bearer ${p.token}` }:{}),'idempotency-key':key } });
  return { code:r.statusCode,body:r.json(),text:r.body,headers:r.headers };
}
const ok=r=>{ assert.equal(r.code,200,r.text); return r.body; };
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn);
async function player(agent=false) {
  const ownerToken=ok(await call(null,'POST','/v1/auth/guest')).token;
  const token=agent?ok(await call({ token:ownerToken },'POST','/v1/auth/agent-key')).token:ownerToken;
  const p={ token,ownerToken }; ok(await call(p,'POST','/v1/character',{ name:`Workflow Agent ${++serial}` }));
  const ch=ok(await call(p,'GET','/v1/me')).character, row=(await app.pool.query('SELECT account_id,cash,bank FROM characters WHERE id=$1',[ch.id])).rows[0];
  p.id=ch.id; p.account=row.account_id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1",[p.id,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:p.id,currency:'cash',amount:100000-Number(row.cash)-Number(row.bank),reason:'crime:workflow-integration-fixture' });
  return p;
}
async function fixture() {
  const owner=await player(true), merchant=await player(), buyer=await player(), lender=await player(), stockSupplier=await player();
  ok(await call({ ...owner,token:owner.ownerToken },'POST','/v1/resources/company',{ expectedRevision:0,name:`Workflow Company ${serial}`,published:false,premises:null }));
  const own=ok(await call(owner,'POST','/v1/depot',{ salePrice:2500,bidPrice:2000,targetStock:5,reorderAt:0,restockBudget:11000 }));
  const sale=ok(await call(merchant,'POST','/v1/depot',{ salePrice:500,bidPrice:100,targetStock:5,reorderAt:0,restockBudget:1000 }));
  ok(await call(merchant,'POST',`/v1/depot/${sale.id}/fund`,{ amount:2000 }));
  const stockOrder=ok(await call(merchant,'POST',`/v1/depot/${sale.id}/restock`));
  await single(stockSupplier,(ch,client,h)=>buyGood(ch,'gin',5,client,h));
  ok(await call(stockSupplier,'POST',`/v1/market/${stockOrder.id}/fill`,{ qty:5 }));
  ok(await call(merchant,'POST',`/v1/depot/${sale.id}/orders/${stockOrder.id}/receive`,{}));
  ok(await call(merchant,'POST',`/v1/depot/${sale.id}/warehouse-offer`,{ expectedRevision:0,enabled:true,slots:10,cashPerUnitDay:1 }));
  const lease=ok(await call(owner,'POST',`/v1/warehouses/${sale.id}/lease`,{ units:5,expectedOfferRevision:1,maxTotalCash:5 }));
  const buy=ok(await call(buyer,'POST','/v1/depot',{ salePrice:2500,bidPrice:2000,targetStock:5,reorderAt:0,restockBudget:11000 }));
  ok(await call(buyer,'POST',`/v1/depot/${buy.id}/fund`,{ amount:15000 }));
  const order=ok(await call(buyer,'POST',`/v1/depot/${buy.id}/restock`));
  const commitment=ok(await call(owner,'POST',`/v1/market/${order.id}/accept-delivery`,{ qty:5,unitPrice:2000,maxProcurementCash:10000,deadlineSeconds:1200 }));
  const request=ok(await call(owner,'POST','/v1/delivery-finance/requests',{ supplierId:owner.id,lenderId:lender.id,commitmentId:commitment.id,principal:5000,rate:0.1,hours:1 }));
  ok(await call(lender,'POST',`/v1/delivery-finance/${request.request.id}/offer`,{}));
  ok(await call(owner,'POST',`/v1/delivery-finance/${request.request.id}/take`,{}));
  return { owner,merchant,buyer,lender,leaseId:lease.lease.id,commitmentId:commitment.id,financeId:request.request.id,
    terms:{ depotId:own.id,procurementDepotId:sale.id,leaseId:lease.lease.id,commitmentId:commitment.id,financeRequestId:request.request.id,qty:5,deadlineSeconds:600 } };
}
const create=async(f,key='create')=>ok(await call(f.owner,'POST','/v1/company/workflows',f.terms,key));
const advance=async(f,id,body,key)=>ok(await call(f.owner,'POST',`/v1/company/workflows/${id}/advance`,body,key));
async function procure(f) {
  ok(await call(f.owner,'POST',`/v1/deliveries/${f.commitmentId}/depot/${f.terms.procurementDepotId}/buy`,{ qty:5,maxUnitPrice:500 }));
  return (await app.pool.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND customer_character=$2 AND reason='sale' ORDER BY created_at DESC,id LIMIT 1",[f.terms.procurementDepotId,f.owner.id])).rows[0].id;
}
async function custody(f) {
  ok(await call(f.owner,'POST',`/v1/warehouse-leases/${f.leaseId}/deposit`,{ qty:5 }));
  ok(await call(f.owner,'POST',`/v1/warehouse-leases/${f.leaseId}/withdraw`,{ qty:5 }));
  const rows=(await app.pool.query('SELECT id,reason FROM business_depot_journal WHERE lease_id=$1 ORDER BY lease_sequence',[f.leaseId])).rows;
  return { proofId:rows.find(row=>row.reason==='warehouse_deposit').id,withdrawalProofId:rows.find(row=>row.reason==='warehouse_withdraw').id };
}
async function money() { return { cash:(await app.pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows,transactions:Number((await app.pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n) }; }
const row=async id=>(await app.pool.query('SELECT * FROM company_workflows WHERE id=$1',[id])).rows[0];
async function due(id,age=2) { await app.pool.query('UPDATE company_workflows SET next_run_at=$2 WHERE id=$1',[id,new Date(Date.now()-age*3600000)]); }
async function checks(label) { const result=await runLedgerInvariants(app.pool,{ alert:false }); assert.equal(result.ok,true,`${label}: ${JSON.stringify(result.checks.filter(check=>!check.ok))}`); assert(result.checks.find(check=>check.name==='company workflow provenance')?.ok); }
try {
  const f=await fixture(), created=await create(f); assert.equal(created.paid,0); assert.equal(created.workflow.nextStage,'procurement');
  const replay=await call(f.owner,'POST','/v1/company/workflows',f.terms,'create'); ok(replay); assert.equal(replay.headers['x-idempotent-replay'],'true');
  const foreign=await player(); assert.equal(ok(await call(foreign,'GET','/v1/company/workflows')).workflows.length,0);
  assert.equal((await call(foreign,'POST',`/v1/company/workflows/${created.workflow.id}/cancel`,{})).code,400);
  assert.equal((await call(foreign,'POST',`/v1/company/workflows/${created.workflow.id}/advance`,{ stage:'procurement',proofId:'missing' })).code,400);
  const pending=await advance(f,created.workflow.id,{ stage:'procurement',proofId:'missing' },'pending'); assert.equal(pending.pending,true);
  const sale=await procure(f), beforeAdvance=await money();
  const purchased=await advance(f,created.workflow.id,{ stage:'procurement',proofId:sale },'procurement'); assert.equal(purchased.paid,0); assert.equal(purchased.workflow.nextStage,'custody'); assert.deepEqual(await money(),beforeAdvance);
  const stored=await custody(f), beforeCustody=await money();
  await advance(f,created.workflow.id,{ stage:'custody',...stored },'custody'); assert.deepEqual(await money(),beforeCustody);
  ok(await call(f.owner,'POST',`/v1/deliveries/${f.commitmentId}/deliver`,{ qty:5 }));
  const beforeCompletion=await money(), completed=await advance(f,created.workflow.id,{ stage:'delivery',proofId:f.financeId },'delivery');
  assert.equal(completed.workflow.status,'completed'); assert.equal(completed.paid,0); assert.deepEqual(await money(),beforeCompletion);
  const completionReplay=await call(f.owner,'POST',`/v1/company/workflows/${created.workflow.id}/advance`,{ stage:'delivery',proofId:f.financeId },'delivery'); ok(completionReplay); assert.equal(completionReplay.headers['x-idempotent-replay'],'true'); assert.deepEqual(await money(),beforeCompletion);
  await checks('actual procurement, paid custody, financed delivery metadata');
  const cancelled=await fixture(), cancelChain=await create(cancelled); ok(await call(cancelled.owner,'POST',`/v1/company/workflows/${cancelChain.workflow.id}/cancel`,{},'cancel'));
  assert.equal((await row(cancelChain.workflow.id)).status,'cancelled'); assert.equal((await call(cancelled.owner,'POST',`/v1/company/workflows/${cancelChain.workflow.id}/advance`,{ stage:'procurement',proofId:'missing' })).code,400);
  const waiting=await fixture(), waitingChain=await create(waiting), ready=await fixture(), readyChain=await create(ready); await procure(ready);
  await due(waitingChain.workflow.id,4); await due(readyChain.workflow.id,3);
  const beforeWorker=await money(), firstTick=await runCompanyWorkflows(app.pool,1); assert.equal(firstTick.results[0].workflowId,waitingChain.workflow.id); assert.equal(firstTick.results[0].pending,true);
  assert(+new Date((await row(waitingChain.workflow.id)).next_run_at)>Date.now());
  const secondTick=await runCompanyWorkflows(app.pool,1); assert.equal(secondTick.results[0].workflowId,readyChain.workflow.id); assert.equal((await row(readyChain.workflow.id)).completed_stages,1); assert.deepEqual(await money(),beforeWorker);
  // A real ordinary stock purchase is NOT the workflow's committed procurement
  // proof (commitment.spent remains0). The worker must reject, yield and continue.
  const erroneous=await fixture(), errorChain=await create(erroneous), later=await fixture(), laterChain=await create(later); await procure(later);
  ok(await call(erroneous.owner,'POST',`/v1/depot/${erroneous.terms.procurementDepotId}/buy`,{ qty:5,maxUnitPrice:500 }));
  await due(errorChain.workflow.id,6); await due(laterChain.workflow.id,5); const errorMoney=await money();
  const errorTick=await runCompanyWorkflows(app.pool,1); assert.equal(errorTick.results[0].skipped,'company_workflow'); assert.equal((await row(errorChain.workflow.id)).completed_stages,0);
  assert(+new Date((await row(errorChain.workflow.id)).next_run_at)>Date.now());
  const laterTick=await runCompanyWorkflows(app.pool,1); assert.equal(laterTick.results[0].workflowId,laterChain.workflow.id); assert.equal((await row(laterChain.workflow.id)).completed_stages,1); assert.deepEqual(await money(),errorMoney);
  const deceased=await fixture(), oldChain=await create(deceased);
  const death=await app.inject({ method:'POST',url:'/v1/mod/kill',headers:{ 'x-mod-key':process.env.MOD_KEY },payload:{ characterId:deceased.owner.id } }); assert.equal(death.statusCode,200,death.body);
  assert.equal((await row(oldChain.workflow.id)).status,'failed');
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[death.json().heirId,new Date(Date.now()+3600000)]);
  assert.equal((await call(deceased.owner,'POST',`/v1/company/workflows/${oldChain.workflow.id}/advance`,{ stage:'procurement',proofId:'missing' })).code,400);
  const historical=await call(deceased.owner,'POST','/v1/company/workflows',deceased.terms,'create'); ok(historical); assert.equal(historical.headers['x-idempotent-replay'],'true');
  await checks('actual worker fairness and estate');
  if(native) {
    const raced=await fixture(), racedChain=await create(raced), raceSale=await procure(raced);
    const body={ stage:'procurement',proofId:raceSale };
    const results=await Promise.all([call(raced.owner,'POST',`/v1/company/workflows/${racedChain.workflow.id}/advance`,body,'concurrent'),call(raced.owner,'POST',`/v1/company/workflows/${racedChain.workflow.id}/advance`,body,'concurrent')]);
    assert(results.some(result=>result.code===200));
    for(const result of results) { if(result.code===200) assert.equal(result.body.workflow.completedStages,1); else { assert.equal(result.code,409,result.text); assert.equal(result.body.error,'in_progress'); } }
    const retried=await call(raced.owner,'POST',`/v1/company/workflows/${racedChain.workflow.id}/advance`,body,'concurrent'); ok(retried); assert.equal(retried.headers['x-idempotent-replay'],'true');
    assert.equal((await app.pool.query('SELECT source_id FROM company_workflow_proofs WHERE workflow_id=$1',[racedChain.workflow.id])).rows.length,1);
    const rolled=await fixture(), rolledChain=await create(rolled), rolledSale=await procure(rolled), beforeProof=await money();
    await assert.rejects(single(rolled.owner,async(ch,client,h)=>{ await Workflow.advanceCompanyWorkflow(ch,rolledChain.workflow.id,{ stage:'procurement',proofId:rolledSale },'rolledback',client,h); throw new Error('workflow rollback'); }),/workflow rollback/);
    assert.equal((await row(rolledChain.workflow.id)).completed_stages,0); assert.equal((await app.pool.query('SELECT source_id FROM company_workflow_proofs WHERE workflow_id=$1',[rolledChain.workflow.id])).rows.length,0); assert.deepEqual(await money(),beforeProof);
    const holder=await app.pool.connect(); try {
      await holder.query('BEGIN'); await holder.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[rolled.terms.depotId]);
      const blocked=advance(rolled,rolledChain.workflow.id,{ stage:'procurement',proofId:rolledSale },'source-wait');
      await app.pool.query('UPDATE company_workflows SET deadline=clock_timestamp() WHERE id=$1',[rolledChain.workflow.id]);
      await holder.query('COMMIT'); assert.equal((await blocked).workflow.status,'expired');
    } finally { await holder.query('ROLLBACK'); holder.release(); }
    const changed=await fixture(), changedChain=await create(changed); await due(changedChain.workflow.id,9);
    const future=new Date(Date.now()+300000); let interleaved=false;
    const proxy=new Proxy(app.pool,{ get(target,prop){ if(prop!=='query') return Reflect.get(target,prop,target); return async(sql,args)=>{
      const observed=await target.query(sql,args);
      if(!interleaved&&typeof sql==='string'&&sql.startsWith('SELECT id,account_id,original_character,next_run_at FROM company_workflows')) { interleaved=true; await app.pool.query('UPDATE company_workflows SET next_run_at=$2 WHERE id=$1',[changedChain.workflow.id,future]); }
      return observed;
    }; } });
    await runCompanyWorkflows(proxy,1); assert.equal(+new Date((await row(changedChain.workflow.id)).next_run_at),+future,'Dispatcher stale CAS preserves concurrent future schedule');
    await due(changedChain.workflow.id,9); interleaved=false;
    const terminalProxy=new Proxy(app.pool,{ get(target,prop){ if(prop!=='query') return Reflect.get(target,prop,target); return async(sql,args)=>{
      const observed=await target.query(sql,args);
      if(!interleaved&&typeof sql==='string'&&sql.startsWith('SELECT id,account_id,original_character,next_run_at FROM company_workflows')) { interleaved=true; ok(await call(changed.owner,'POST',`/v1/company/workflows/${changedChain.workflow.id}/cancel`,{},'concurrent-cancel')); }
      return observed;
    }; } });
    await runCompanyWorkflows(terminalProxy,1); assert.equal((await row(changedChain.workflow.id)).status,'cancelled','Stale dispatcher does not reopen concurrent cancellation');
    await checks('native workflow races, rollback, expiry and CAS');
  }
  console.log(`companyworkflow-integration ${native?`PostgreSQL${nativeVersion}`:'memory'}: actual JWT/agent API, canonical stock/custody/finance receipts, pending/error worker fairness, no extra payment, estate and global provenance PASS`);
} finally { await app.close(); }
