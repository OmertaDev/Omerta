// Frozen OFFREPO canonical relocation prototype only. No production/release clearance.
import assert from 'node:assert/strict';
assert(!process.env.DATABASE_URL,'Reject ambient database endpoints');
assert(!process.env.NODE_OPTIONS&&!process.env.PGHOST&&!process.env.PGPORT&&!process.env.PGUSER&&!process.env.PGDATABASE&&!process.env.PGSERVICE,'Reject preload and ambient connection overrides');
assert(process.argv.includes('--postgres'),'This fixture requires explicit owned native admission');
const u=new URL(process.env.BUSINESS_RELOCATION_TEST_DATABASE_URL);
assert(['postgres:','postgresql:'].includes(u.protocol));assert.equal(u.hostname,'127.0.0.1');assert(!u.search&&!u.hash);assert.match(u.pathname,/^\/business_relocation_test_[a-z0-9_]+$/);
const local=(u.port==='35439'||u.port==='35449')&&u.username==='pilot_runner'&&!u.password,ci=u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck';assert(local||ci,'Closed exact owned39/49 or explicit CI only');
const {default:pg}=await import('pg'),pre=new pg.Client({connectionString:u.href});await pre.connect();
try{
 await pre.query('BEGIN READ ONLY');const version=(await pre.query('SHOW server_version')).rows[0].server_version;assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
 if(local)assert.equal((await pre.query('SHOW data_directory')).rows[0].data_directory.replaceAll('\\','/').toLowerCase(),u.port==='35439'?'c:/users/jorge/appdata/local/temp/omerta-economy-oct15-pg184':'c:/users/jorge/appdata/local/temp/omerta-employment-pg184-proof');
 const owner=(await pre.query('SELECT current_user AS role,pg_get_userbyid(datdba) AS owner FROM pg_database WHERE datname=current_database()')).rows[0];assert.equal(owner.role,u.username);assert.equal(owner.owner,u.username);
 assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0);await pre.query('ROLLBACK');console.log('Owned fresh backend',version,u.pathname);
}finally{await pre.end();}
process.env.DATABASE_URL=u.href;
Object.assign(process.env,{RATE_LIMIT:'off',INVITE_MODE:'off',SOCIAL_VERIFY_MODE:'off',DEPOT_PILOT:'on',JWT_SECRET:'relocation-native-synthetic-fixture-only-secret',MARKET_SEED:'relocation-native-synthetic-seed-a1b2c3',MOD_KEY:'relocation-native-synthetic-moderator',LEGAL_OPERATOR_NAME:'CI Test Operator',LEGAL_POSTAL_ADDRESS:'123 Fixture Street, Test City',PRIVACY_CONTACT_EMAIL:'privacy@example.test',DMCA_AGENT_NAME:'CI Test Agent',DMCA_AGENT_EMAIL:'copyright@example.test',DMCA_AGENT_ADDRESS:'123 Fixture Street, Test City',DMCA_AGENT_PHONE:'+1 202 555 0100',DMCA_AGENT_REGISTERED:'true',PAYMENT_REFUND_POLICY:'Test fixture policy; not a production policy.'});
const {buildServer}=await import('./server-fixture.js');const app=await buildServer(),pool=app.pool;
const G=await import('../src/game.js'),R=await import('../src/businessrelocation.js');
const {runLedgerInvariants}=await import('../src/invariants.js'),{canonicalDatabaseSnapshot}=await import('../tools/rc1-native-proof.js'),{collectBusinessRelocationIssues}=await import('../src/businessrelocationhistory.js');
let sequence=0;const call=(p,method,url,body,key='relocation-'+(++sequence),agent=false)=>app.inject({method,url,payload:body,headers:{...(p?{authorization:'Bearer '+(agent?p.agent:p.token)}:{}),'idempotency-key':key}});
async function ok(p,method,url,body,key,agent=false){const r=await call(p,method,url,body,key,agent);assert.equal(r.statusCode,200,r.body);return r.json();}
const base='/v1/business/relocations',config={salePrice:2000,bidPrice:500,targetStock:2,reorderAt:0,restockBudget:3000};
const books=async()=>{assert.deepEqual(await collectBusinessRelocationIssues(pool),[]);const b=await runLedgerInvariants(pool,{alert:false});assert(b.ok,JSON.stringify(b));};
async function player(label){const p={token:(await ok(null,'POST','/v1/auth/guest')).token};await ok(p,'POST','/v1/character',{name:'Relocation '+label});p.account=app.jwt.verify(p.token).sub;const ch=(await pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive=true',[p.account])).rows[0];p.id=ch.id;
 // Explicit synthetic starting-resource fixture, with the exact existing cash ledger leg.
 await pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000 WHERE id=$1",[p.id]);await G.ledger(pool,{characterId:p.id,currency:'cash',amount:100000-Number(ch.cash)-Number(ch.bank),reason:'crime:business-relocation-fixture'});p.agent=(await ok(p,'POST','/v1/auth/agent-key')).token;return p;}
async function manufacturingInputs(p){
 // Actual first GTA action and authored salvage. No cooldown/clock override and
 // no grantStack, fabricated completion, or manufactured origin event.
 await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network') ON CONFLICT DO NOTHING",[p.id]);
 await ok(p,'POST','/v1/resources/company',{expectedRevision:0,name:'Relocation Source '+(++sequence),published:false,premises:null});
 const factory=(await ok(p,'POST','/v1/depot',config)).id;let boosted;const random=Math.random;
 try{Math.random=()=>0.001;boosted=await ok(p,'POST','/v1/garage/boost',{});}finally{Math.random=random;}
 assert.equal(boosted.success,true);assert.equal(boosted.car.model,'junker');
 await ok(p,'POST','/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/'+boosted.car.id,{});
 await ok(p,'POST','/v1/company/production/run',{businessId:factory,steps:[{recipeId:'recipe:hardened_steel',repeat:1}]},undefined,true);
}
async function plan(p,id,destination,seconds=600){const q=await ok(p,'POST',base+'/quote',{businessId:id,destination});return ok(p,'POST',base+'/create',{businessId:id,destination,sourceHash:q.sourceHash,durationSeconds:seconds});}
const ref=p=>({planId:p.planId,sourceHash:p.sourceHash});
async function waitForLock(fragment){for(let n=0;n<100;n++){const rows=(await pool.query("SELECT query FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'")).rows;if(rows.some(r=>r.query.includes(fragment)))return;await new Promise(r=>setTimeout(r,25));}assert.fail('Actual native source wait not delivered');}
async function waitUntil(at){for(;;){const left=at-Date.now();if(left<=0)return;await new Promise(r=>setTimeout(r,Math.min(left,10000)));}}
try{
 assert.equal((await call(null,'GET',base)).statusCode,401);
 const owner=await player('Owner'),supplier=await player('Supplier'),buyer=await player('Buyer'),killer=await player('Killer');
 const opened=await ok(owner,'POST','/v1/depot',config),id=opened.id;
 await ok(owner,'POST','/v1/resources/company',{expectedRevision:0,name:'Portable Original Maker',published:false,premises:null});
 await pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network') ON CONFLICT DO NOTHING",[owner.id]);
 await ok(owner,'POST','/v1/company/specializations',{businessId:id,expectedRevision:0,kind:'volume',recipeIds:[],toolItemId:null,allowAgentProduction:false,maxBatchCashCost:0,maxGrantCashCost:0,agentGrantSeconds:0,renewAgentGrant:false});
 await manufacturingInputs(supplier);await manufacturingInputs(buyer);
 const commissionBase='/v1/company/commissions',commissionTerms={businessId:id,feeCash:100,lifetimeSeconds:3600,consent:true};
 const oldRequest=await ok(supplier,'POST',commissionBase+'/fund',commissionTerms),refundRequest=await ok(buyer,'POST',commissionBase+'/fund',commissionTerms);
 const commissionRef=r=>({commissionId:r.commissionId,sourceHash:r.sourceHash,consent:true});
 const frozenRequests=(await pool.query('SELECT id,source_pin,source_hash,fee_remaining FROM commissioned_crafting_contracts ORDER BY id')).rows;
 const oldProfile=(await pool.query('SELECT * FROM company_specializations WHERE business_id=$1',[id])).rows[0];
 await ok(owner,'POST',`/v1/depot/${id}/warehouse-offer`,{expectedRevision:0,enabled:true,slots:1,cashPerUnitDay:10});
 const paidLease=await ok(supplier,'POST',`/v1/warehouses/${id}/lease`,{units:1,expectedOfferRevision:1,maxTotalCash:10});
 await ok(owner,'POST',`/v1/depot/${id}/warehouse-offer`,{expectedRevision:1,enabled:false,slots:0,cashPerUnitDay:0});
 assert.equal((await call(owner,'POST',base+'/quote',{businessId:id,destination:'docks'})).statusCode,400,'Paid active capacity blocks even after the offer closes');
 const closedLease=await ok(supplier,'POST','/v1/warehouse-leases/'+paidLease.lease.id+'/close',{});assert.equal(closedLease.refunded,0);await books();
 await ok(owner,'POST',`/v1/depot/${id}/fund`,{amount:6000});const order=await ok(owner,'POST',`/v1/depot/${id}/restock`,{});
 await ok(supplier,'POST','/v1/goods/buy',{goodId:'gin',qty:2});await ok(supplier,'POST',`/v1/market/${order.id}/fill`,{qty:2});await ok(owner,'POST',`/v1/depot/${id}/orders/${order.id}/receive`,{});
 await ok(owner,'POST','/v1/goods/buy',{goodId:'gin',qty:1});await books();
 const original=(await pool.query('SELECT * FROM business_depots WHERE id=$1',[id])).rows[0],cargo=(await pool.query('SELECT * FROM character_cargo WHERE character_id=$1 ORDER BY good_id',[owner.id])).rows;
 // Trace the actual quote/create authority reads only after their operator lock;
 // obligations' earlier floor read cannot hide an inverted authorities() order.
 // This proves SQL order, not an actual two-transaction40P01 or a lock on an absent row.
 const authorityLocks=[];let authorityRead=false,ready;const authorityConnect=pool.connect.bind(pool);
 pool.connect=(...args)=>{if(args.length)return authorityConnect(...args);return authorityConnect().then(client=>new Proxy(client,{get(target,name){
  if(name==='query')return async(...queryArgs)=>{const sql=typeof queryArgs[0]==='string'?queryArgs[0]:queryArgs[0]?.text,values=queryArgs[1],result=await target.query(...queryArgs);
   if(sql==='SELECT * FROM company_operators WHERE depot_id=$1 FOR UPDATE'&&values?.[0]===id)authorityRead=true;
   if(authorityRead&&values?.[0]===id){if(sql==='SELECT * FROM workshop_floorplans WHERE business_id=$1 FOR UPDATE')authorityLocks.push('workshop_floorplans');if(sql==='SELECT * FROM company_specializations WHERE business_id=$1 FOR UPDATE'){authorityLocks.push('company_specializations');authorityRead=false;}}
   return result;};const value=Reflect.get(target,name);return typeof value==='function'?value.bind(target):value;}}));};
 try{ready=await plan(owner,id,'docks');}finally{pool.connect=authorityConnect;}
 assert(authorityLocks.length>=2&&authorityLocks.length%2===0,'Actual relocation authority reads were delivered');
 for(let n=0;n<authorityLocks.length;n+=2)assert.deepEqual(authorityLocks.slice(n,n+2),['workshop_floorplans','company_specializations'],'Relocation follows workshop quality floor-before-specialization order');
 const body=ref(ready),block=await pool.connect();let first;
 try{
  await block.query('BEGIN');await block.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[id]);
  first=call(owner,'POST',base+'/execute',body,'actual-pending-execute',true);await waitForLock('business_depots');
  const pending=await call(owner,'POST',base+'/execute',body,'actual-pending-execute',true);assert.equal(pending.statusCode,409,pending.body);assert.equal(pending.json().error,'in_progress');assert.equal(String(pending.headers['retry-after']),'1');
  assert.equal((await pool.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='inventory_relocation_return'",[id])).rows.length,0);await block.query('COMMIT');
 }finally{await block.query('ROLLBACK');block.release();}
 const completedResponse=await first;assert.equal(completedResponse.statusCode,200,completedResponse.body);const completed=completedResponse.json();
 await new Promise(r=>setTimeout(r,1000));assert.deepEqual(await ok(owner,'POST',base+'/execute',body,'actual-pending-execute',true),completed);
 const moved=(await pool.query('SELECT * FROM business_depots WHERE id=$1',[id])).rows[0];assert.deepEqual(moved,{...original,district:'docks'});assert.deepEqual((await pool.query('SELECT * FROM character_cargo WHERE character_id=$1 ORDER BY good_id',[owner.id])).rows,cargo);assert.equal(completed.outcome.stockMoved,2);assert.equal(completed.outcome.stockCostPreserved,1000);assert(completed.outcome.travelCost>0);await books();
 assert.deepEqual((await pool.query('SELECT * FROM company_specializations WHERE business_id=$1',[id])).rows[0],oldProfile);
 assert.deepEqual((await pool.query('SELECT id,source_pin,source_hash,fee_remaining FROM commissioned_crafting_contracts ORDER BY id')).rows,frozenRequests);
 await ok(owner,'POST',commissionBase+'/accept',commissionRef(oldRequest),undefined,true);
 // Canonical authored recipe location, not an invented business-presence rule.
 const wrongLocation=await call(owner,'POST',commissionBase+'/complete',commissionRef(oldRequest),'wrong-authored-location',true);assert.equal(wrongLocation.statusCode,400,wrongLocation.body);
 assert.equal((await call(owner,'POST',base+'/quote',{businessId:id,destination:'foundry'})).statusCode,400,'Accepted original work blocks relocation');
 assert.deepEqual((await pool.query('SELECT * FROM company_specializations WHERE business_id=$1',[id])).rows[0],oldProfile,'Failed actual crafting must roll back cadence/budget');
 await ok(owner,'POST','/v1/travel/foundry',{});
 const made=await ok(owner,'POST',commissionBase+'/complete',commissionRef(oldRequest),'old-request-real-completion',true);
 assert.equal(made.paidFee,100);assert.equal(made.production.originalCharacterId,owner.id);assert.equal(made.production.totalCrafts,1);assert.equal(made.production.totalCashCost,0);
 assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1',[made.outputItemId])).rows[0],{owner_scope:'account',owner_id:supplier.account,state:'active'});
 const fee=(await pool.query('SELECT character_id,currency,amount,reason FROM transactions WHERE id=$1',[made.feeTransaction])).rows[0];assert.equal(fee.character_id,owner.id);assert.equal(fee.currency,'cash');assert.equal(Number(fee.amount),100);assert.equal(fee.reason,'commissioned_crafting:fee');
 const refunded=await ok(buyer,'POST',commissionBase+'/refund',commissionRef(refundRequest));assert.equal(refunded.refundedFee,100);assert.equal(refunded.returnedInputs.length,2);await books();
 await ok(owner,'POST','/v1/travel/docks',{});
 assert.equal((await call(buyer,'POST',`/v1/depot/${id}/buy`,{qty:1,maxUnitPrice:2000})).statusCode,400);await ok(buyer,'POST','/v1/travel/docks',{});await ok(buyer,'POST',`/v1/depot/${id}/buy`,{qty:1,maxUnitPrice:2000});await books();
 const afterCraftProfile=(await pool.query('SELECT * FROM company_specializations WHERE business_id=$1',[id])).rows[0];
 const concurrent=await plan(owner,id,'foundry');const attempts=await Promise.all([call(owner,'POST',base+'/execute',ref(concurrent),'one-winner-a',true),call(owner,'POST',base+'/execute',ref(concurrent),'one-winner-b',true)]);assert.equal(attempts.filter(r=>r.statusCode===200).length,1);assert.equal(attempts.filter(r=>r.statusCode===400).length,1);assert.deepEqual((await pool.query('SELECT * FROM company_specializations WHERE business_id=$1',[id])).rows[0],afterCraftProfile);await books();
 const stale=await plan(owner,id,'docks');await ok(owner,'POST',`/v1/depot/${id}/configure`,{...config,salePrice:2100});assert.equal((await call(owner,'POST',base+'/execute',ref(stale),'stale-source',true)).statusCode,400);await ok(owner,'POST',base+'/cancel',ref(stale));await books();
 await ok(owner,'POST',base+'/quote',{businessId:id,destination:'docks'});await pool.query('CREATE TABLE business_relocation_unknown_ref(business_id TEXT)');try{assert.equal((await call(owner,'POST',base+'/quote',{businessId:id,destination:'docks'})).statusCode,400);}finally{await pool.query('DROP TABLE business_relocation_unknown_ref');}
 const faultPlan=await plan(owner,id,'docks');let before,delivered=0;const faultPool=Object.create(pool);faultPool.query=pool.query.bind(pool);faultPool.connect=async()=>{const real=await pool.connect();return new Proxy(real,{get(target,prop){if(prop==='query')return async(...args)=>{const sql=typeof args[0]==='string'?args[0]:args[0]?.text;if(!before&&sql==='SELECT id FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2')before=await canonicalDatabaseSnapshot(pool);if(sql?.startsWith('UPDATE business_relocation_requests SET receipt=')){assert(before,'Baseline must be captured after independent phase1 and before actual gameplay effects');await target.query(...args);delivered++;throw Object.assign(Error('Actual post-relocation receipt failure'),{code:'business_relocation_native_fault'});}return target.query(...args);};const value=Reflect.get(target,prop);return typeof value==='function'?value.bind(target):value;}});};
 await assert.rejects(R.runBusinessRelocation(faultPool,owner.account,'execute',ref(faultPlan),'late-receipt-fault',{agent:true}),e=>e.code==='business_relocation_native_fault');assert.equal(delivered,1);const after=await canonicalDatabaseSnapshot(pool);assert.deepEqual(after.tables,before.tables);assert.deepEqual(after.sequences,before.sequences);await books();await ok(owner,'POST',base+'/execute',ref(faultPlan),'late-receipt-fault',true);await books();
 const expiring=await plan(owner,id,'foundry',60);await waitUntil(+new Date(expiring.expiresAt)-1500);const held=await pool.connect();let waiting;
 try{await held.query('BEGIN');await held.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE',[id]);waiting=call(owner,'POST',base+'/execute',ref(expiring),'actual-expiry-wait',true);await waitForLock('business_depots');assert(+new Date((await pool.query('SELECT clock_timestamp() AS observed')).rows[0].observed)<+new Date(expiring.expiresAt),'Wait must genuinely begin before deadline');await waitUntil(+new Date(expiring.expiresAt)+80);await held.query('COMMIT');}finally{await held.query('ROLLBACK');held.release();}
 const expired=await waiting;assert.equal(expired.statusCode,400,expired.body);assert.equal((await pool.query('SELECT state FROM business_relocation_plans WHERE id=$1',[expiring.planId])).rows[0].state,'ready');await ok(owner,'POST',base+'/cancel',ref(expiring));await books();
 const dying=await plan(owner,id,'foundry');process.env.PEN_YARD_EVENT='quiet';process.env.SHANK_P='1';for(const p of [owner,killer])await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[p.id,new Date(Date.now()+1800000)]);await ok(killer,'POST','/v1/pen/buy/shiv');const death=await ok(killer,'POST','/v1/pen/shank/'+owner.id,{},'public-relocation-estate');assert.equal(death.kill,true);
 owner.agent=(await ok(owner,'POST','/v1/auth/agent-key')).token;assert.equal((await pool.query('SELECT state FROM business_relocation_plans WHERE id=$1',[dying.planId])).rows[0].state,'owner_dead');assert.equal((await call(owner,'POST',base+'/execute',ref(dying),'heir-refusal',true)).statusCode,400);assert.deepEqual(await ok(owner,'POST',base+'/execute',body,'actual-pending-execute',true),completed);await books();
 console.log('PASS actual native HTTP owner/agent canonical stocked same-ID relocation, normal paid travel/purchase district, pending409+exact replay, one winner, source/unknown refusal, allrows+allseq late rollback, actual60s source-wait expiry, public estate/heir/history/global books.');
}finally{await app.close();}

