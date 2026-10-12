import assert from 'node:assert/strict';
const postgres=process.argv.includes('--postgres');
if(postgres){const u=new URL(process.env.LOGISTICS_COVERAGE_TEST_DATABASE_URL||'http://missing');
  if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||!((u.port==='35439'&&u.username==='pilot_runner')||(u.port==='5432'&&u.username==='postgres'))||!/^\/logistics_coverage_[a-z0-9_]+$/.test(u.pathname))throw Error('Use a fresh isolated local logistics_coverage_ database.');
  process.env.DATABASE_URL=u.href;process.env.MARKET_SEED='logistics-event-clock-fixture-1947';
}else delete process.env.DATABASE_URL;
process.env.RATE_LIMIT='off';process.env.JWT_SECRET='logistics-clock-fixture-secret-1947';process.env.SOCIAL_VERIFY_MODE='off';process.env.MOD_KEY='logistics-clock-local';process.env.DEPOT_PILOT='on';
const {buildServer}=await import('../src/server.js');
const {logisticsCoverageBenefit}=await import('../src/logisticscoverageterms.js');
const app=await buildServer();let seq=0;
async function call(method,url,p,payload){return app.inject({method,url,payload,headers:{...(p?{authorization:`Bearer ${p.token}`}:{ }),'idempotency-key':`clock-${++seq}`}});}
async function player(name){const token=(await call('POST','/v1/auth/guest')).json().token;const p={token};assert.equal((await call('POST','/v1/character',p,{name})).statusCode,200);p.id=(await call('GET','/v1/me',p)).json().character.id;await app.pool.query('UPDATE characters SET cash=50000 WHERE id=$1',[p.id]);return p;}
async function fixture(n){const owner=await player(`Clock Owner ${n}`),tenant=await player(`Clock Tenant ${n}`);const opened=await call('POST','/v1/depot',owner,{salePrice:2000,bidPrice:123,targetStock:4,reorderAt:0,restockBudget:3000});assert.equal(opened.statusCode,200,opened.body);const depot=opened.json().id;
  assert.equal((await call('POST',`/v1/depot/${depot}/warehouse-offer`,owner,{expectedRevision:0,enabled:true,slots:10,cashPerUnitDay:25})).statusCode,200);
  const rented=await call('POST',`/v1/warehouses/${depot}/lease`,tenant,{units:10,expectedOfferRevision:1,maxTotalCash:250});assert.equal(rented.statusCode,200,rented.body);const id=rented.json().lease.id;
  await app.pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',3)",[tenant.id]);
  const deposited=await call('POST',`/v1/warehouse-leases/${id}/deposit`,tenant,{qty:3});assert.equal(deposited.statusCode,200,deposited.body);return {owner,tenant,depot,id};}
const kill=p=>app.inject({method:'POST',url:'/v1/mod/kill',payload:{characterId:p.id},headers:{'x-mod-key':process.env.MOD_KEY}});
const burns=id=>app.pool.query("SELECT * FROM business_depot_journal WHERE lease_id=$1 AND reason='warehouse_tenant_death'",[id]);
try{
  const f=await fixture(1);let enrolledAt,expiresAt,releaseAt;
  if(postgres){const holder=await app.pool.connect();try{await holder.query('BEGIN');await holder.query('SELECT id FROM business_warehouse_leases WHERE id=$1 FOR UPDATE',[f.id]);
    const pending=kill(f.tenant);pending.catch(()=>{});
    // Observe the real estate transaction blocked on the actual lease row, not a mocked clock.
    let waiting=false;for(let i=0;i<100;i++){const r=await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE '%business_warehouse_leases%' AND pid<>pg_backend_pid()");if(r.rows.length){waiting=true;break;}await new Promise(r=>setTimeout(r,20));}assert(waiting,'Actual estate must wait on the held lease lock');
    enrolledAt=(await holder.query('SELECT clock_timestamp() AS t')).rows[0].t;
    await holder.query('SELECT pg_sleep(0.06)');expiresAt=(await holder.query('SELECT clock_timestamp() AS t')).rows[0].t;
    releaseAt=(await holder.query('SELECT clock_timestamp() AS t')).rows[0].t;await holder.query('COMMIT');const result=await pending;assert.equal(result.statusCode,200,result.body);
  }finally{await holder.query('ROLLBACK');holder.release();}}
  else {const result=await kill(f.tenant);assert.equal(result.statusCode,200,result.body);}
  const rows=(await burns(f.id)).rows;assert.equal(rows.length,1);const event=rows[0];assert(event.event_at);assert.equal(event.customer_character,f.tenant.id);assert.equal(Number(event.lease_stock_delta),-3);assert.equal(Number(event.lease_stock_after),0);
  assert.equal((await app.pool.query('SELECT alive FROM characters WHERE id=$1',[f.tenant.id])).rows[0].alive,false);
  assert.equal((await app.pool.query('SELECT status FROM business_warehouse_leases WHERE id=$1',[f.id])).rows[0].status,'tenant_dead');
  if(postgres){assert(new Date(event.created_at)<new Date(enrolledAt),'Transaction began before enrollment');assert(new Date(event.event_at)>=new Date(releaseAt),'Burn clock occurs after actual lock release');assert(new Date(event.event_at)>=new Date(expiresAt),'Expired coverage cannot use transaction-start timestamp');}
  assert((await app.pool.query("SELECT event_at FROM business_depot_journal WHERE reason<>'warehouse_tenant_death'")).rows.every(r=>r.event_at===null),'Ordinary journal reasons have no event clock');
  const lease=(await app.pool.query('SELECT * FROM business_warehouse_leases WHERE id=$1',[f.id])).rows[0];
  const account=(await app.pool.query('SELECT account_id FROM characters WHERE id=$1',[f.tenant.id])).rows[0].account_id;
  const policy={coveredEvent:'warehouse_tenant_death',good:'gin',leaseId:f.id,depotId:f.depot,tenantCharacterId:f.tenant.id,tenantAccountId:account,beneficiaryAccountId:account,coveredUnits:3,cashPerUnit:10,maxBenefitCash:30,enrollmentSequence:1,enrolledAt:new Date(lease.created_at).toISOString(),expiresAt:new Date(lease.expires_at).toISOString()};
  assert.throws(()=>logisticsCoverageBenefit(policy,lease,{...event,event_at:null},{encumberedCash:30}),'Legacy missing clocks cannot qualify');
  if(postgres){assert.equal(logisticsCoverageBenefit({...policy,enrolledAt:new Date(enrolledAt).toISOString()},lease,event,{encumberedCash:30}).benefitCash,30,'Post-lock event qualifies enrollment even when transaction began before it');assert.throws(()=>logisticsCoverageBenefit({...policy,enrolledAt:new Date(enrolledAt).toISOString(),expiresAt:new Date(expiresAt).toISOString()},lease,event,{encumberedCash:30}),'Post-expiry burn must refuse benefit');
    const rollback=await fixture(2);await app.pool.query("CREATE FUNCTION reject_clock_journal() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='warehouse_tenant_death' THEN RAISE EXCEPTION 'clock fixture rollback'; END IF; RETURN NEW; END $$");await app.pool.query('CREATE TRIGGER reject_clock_journal BEFORE INSERT ON business_depot_journal FOR EACH ROW EXECUTE FUNCTION reject_clock_journal()');
    assert.equal((await kill(rollback.tenant)).statusCode,500);assert.equal((await burns(rollback.id)).rows.length,0);assert.equal((await app.pool.query('SELECT alive FROM characters WHERE id=$1',[rollback.tenant.id])).rows[0].alive,true);assert.equal(Number((await app.pool.query('SELECT held_qty FROM business_warehouse_leases WHERE id=$1',[rollback.id])).rows[0].held_qty),3);await app.pool.query('DROP TRIGGER reject_clock_journal ON business_depot_journal');
  }
  console.log(JSON.stringify({status:'PASS',database:postgres?'PostgreSQL':'pg-mem',version:postgres?(await app.pool.query('SHOW server_version')).rows[0].server_version:null,eventAt:event.event_at,createdAt:event.created_at,enrolledAt,expiresAt,releaseAt,scope:'Actual mod death estate journal; ordinary/legacy null clocks; native real lease-lock wait and transaction rollback; no runtime payout'}));
}finally{await app.close();await app.pool.end();}



