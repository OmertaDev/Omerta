import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres'); assert(!process.env.DATABASE_URL,'Refuse ambient database endpoints'); let nativeVersion;
if(native) {
  const url=new URL(process.env.BUYER_COOPERATIVE_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1'); assert(!url.search&&!url.hash);
  const local=['35439','35449'].includes(url.port)&&url.username==='pilot_runner'&&url.password==='';
  const ci=url.port==='5432'&&url.username==='postgres'&&url.password==='pgcheck'; assert(local||ci); assert(/^\/buyer_cooperative_[a-z0-9_]+$/.test(url.pathname));
  const { default:pg }=await import('pg'), pre=new pg.Pool({ connectionString:url.href });
  try { const version=(await pre.query('SHOW server_version')).rows[0].server_version; nativeVersion=version.split(' ')[0]; assert.match(version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/); assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{ DEPOT_PILOT:'on',DELIVERY_CONTRACTS:'on',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',JWT_SECRET:'cooperative-integration-local-proof-secret',MARKET_SEED:'cooperative-integration-native-local-seed',MOD_KEY:'cooperative-integration-local-mod' });
const { buildServer }=await import('../src/server.js'), G=await import('../src/game.js'), Market=await import('../src/market.js');
const Cooperative=await import('../src/buyercooperatives.js'), { runEstate }=await import('../src/social/estate.js');
const { buyGood }=await import('../src/economy.js'), { runLedgerInvariants }=await import('../src/invariants.js'), { M3,seasonModOf }=await import('../src/rules.js');
const { expireBuyerCooperativeFunding }=await import('../src/buyercooperativerunner.js');
const app=await buildServer(); let serial=0;
assert(app.hasRoute({ method:'POST',url:'/v1/buyer-cooperatives' }),'Actual server must register cooperative routes; no route seam');
async function call(p,method,url,payload,key=`coop-integrated-${++serial}`) {
  const r=await app.inject({ method,url,payload,headers:{ ...(p?{ authorization:`Bearer ${p.token}` }:{}),'idempotency-key':key } });
  return { code:r.statusCode,body:r.json(),text:r.body,headers:r.headers };
}
const ok=r=>{ assert.equal(r.code,200,r.text); return r.body; };
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn), pair=(p,target,fn)=>G.withTwoCharacters(app.pool,p.account,target.id,fn,{ meet:false });
async function player(agent=false) {
  const ownerToken=ok(await call(null,'POST','/v1/auth/guest')).token, token=agent?ok(await call({ token:ownerToken },'POST','/v1/auth/agent-key')).token:ownerToken;
  const p={ token,ownerToken }; ok(await call(p,'POST','/v1/character',{ name:`Joint Buyer ${++serial}` }));
  const ch=ok(await call(p,'GET','/v1/me')).character, row=(await app.pool.query('SELECT account_id,cash,bank FROM characters WHERE id=$1',[ch.id])).rows[0]; p.id=ch.id; p.account=row.account_id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1",[p.id,new Date(Date.now()+3600000)]);
  await G.ledger(app.pool,{ characterId:p.id,currency:'cash',amount:100000-Number(row.cash)-Number(row.bank),reason:'crime:cooperative-integration-fixture' }); return p;
}
async function fixture(published=false) {
  const members=[await player(true),await player(),await player()], seller=await player(), stranger=await player();
  const body={ members:members.map((member,i)=>({ accountId:member.account,units:[4,3,1][i] })),unitPrice:100,feeCap:16,fundingSeconds:3600,orderHours:1,published,partialPolicy:'proportional' };
  const created=ok(await call(members[0],'POST','/v1/buyer-cooperatives',body,'create'));
  return { members,seller,stranger,body,id:created.cooperative.id,termsHash:created.cooperative.termsHash };
}
async function own(f,p) { return ok(await call(p,'GET','/v1/buyer-cooperatives')).cooperatives.find(row=>row.id===f.id).ownShare; }
async function fund(f,p,key='fund') { const share=await own(f,p); return ok(await call(p,'POST',`/v1/buyer-cooperatives/${f.id}/fund`,{ consent:true,termsHash:f.termsHash,maxCash:Number(share.maximumCash) },key)); }
const launch=async(f,key='launch')=>ok(await call(f.members[0],'POST',`/v1/buyer-cooperatives/${f.id}/launch`,{ termsHash:f.termsHash },key));
async function ready(f) { for(const p of f.members) await fund(f,p); const result=await launch(f); f.orderId=result.orderId; return result; }
async function fill(f,qty) { await single(f.seller,(ch,c,h)=>buyGood(ch,'gin',qty,c,h)); return ok(await call(f.seller,'POST',`/v1/market/${f.orderId}/fill`,{ qty })); }
async function claim(f,p,key='claim') { const share=await own(f,p); return ok(await call(p,'POST',`/v1/buyer-cooperatives/${f.id}/claim`,{ cash:true,ginQty:Number(share.ginClaimable) },key)); }
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const coop=async f=>(await app.pool.query('SELECT * FROM buyer_cooperatives WHERE id=$1',[f.id])).rows[0];
async function checks(label) { const result=await runLedgerInvariants(app.pool,{ alert:false }); assert.equal(result.ok,true,`${label}: ${JSON.stringify(result.checks.filter(check=>!check.ok))}`); for(const name of ['buyer cooperative cash custody','buyer cooperative GIN custody','buyer cooperative settlement provenance']) assert(result.checks.some(check=>check.name===name&&check.ok),name); }
async function heir(p,id) { await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1',[id,new Date(Date.now()+3600000)]); return { ...p,id }; }
async function waiting(pid) { for(let n=0;n<100;n++) { if((await app.pool.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[pid])).rows[0]?.wait_event_type==='Lock') return; await new Promise(resolve=>setTimeout(resolve,10)); } assert.fail('Must observe actual native source wait'); }
try {
  const f=await fixture(true); assert.equal(ok(await call(f.stranger,'GET','/v1/buyer-cooperatives')).cooperatives.length,0);
  const publicBody=ok(await call(null,'GET','/v1/buyer-cooperatives/public')); assert(publicBody.cooperatives.some(row=>row.id===f.id)); for(const p of f.members) assert(!JSON.stringify(publicBody).includes(p.account));
  const before=await cash(f.members[0]); await fund(f,f.members[0]); assert.equal(await cash(f.members[0]),before-408);
  const fundReplay=await call(f.members[0],'POST',`/v1/buyer-cooperatives/${f.id}/fund`,{ consent:true,termsHash:f.termsHash,maxCash:408 },'fund'); ok(fundReplay); assert.equal(fundReplay.headers['x-idempotent-replay'],'true'); assert.equal(await cash(f.members[0]),before-408);
  await fund(f,f.members[1]); await fund(f,f.members[2]); const pocket=await cash(f.members[0]); const posted=await launch(f); f.orderId=posted.orderId;
  assert.equal(posted.organizerPocketDebit,0); assert.equal(await cash(f.members[0]),pocket); assert.equal(Number((await coop(f)).cash_balance),6);
  const funding=(await app.pool.query("SELECT character_id,amount,reason FROM transactions WHERE counterparty=$1 AND reason IN ('market:order','market:list')",[f.id])).rows;
  assert.equal(funding.length,2); assert(funding.every(row=>row.character_id===null)); assert.equal(funding.reduce((sum,row)=>sum+Number(row.amount),0),-810);
  assert.equal((await app.pool.query('SELECT depot_id FROM market_listings WHERE id=$1',[f.orderId])).rows[0].depot_id,null);
  assert.equal((await call(f.seller,'POST',`/v1/market/${f.orderId}/accept-delivery`,{ qty:1,unitPrice:100,maxProcurementCash:1000,deadlineSeconds:60 })).body.error,'no_order');
  assert.equal((await call(f.members[0],'POST',`/v1/market/${f.orderId}/cancel`,{})).code,400,'Even organizer cannot use personal cancellation');
  await checks('live joint treasury and canonical market escrow');
  await fill(f,5); assert.equal((await call(f.members[0],'POST',`/v1/market/${f.orderId}/claim`,{})).code,400,'Even organizer cannot use personal GIN claim');
  const settled=ok(await call(f.members[1],'POST',`/v1/buyer-cooperatives/${f.id}/settle`,{ cancel:true },'settle')); assert.equal(settled.captured,5); assert.equal(settled.marketRefund,300);
  await checks('captured unclaimed joint cash and GIN buckets');
  assert.deepEqual(await Promise.all(f.members.map(async p=>Number((await own(f,p)).cashClaimable))),[153,115,38]);
  assert.deepEqual(await Promise.all(f.members.map(async p=>Number((await own(f,p)).ginClaimable))),[2,2,1]);
  for(const p of f.members) { const received=await claim(f,p); assert.equal(received.refunded,[153,115,38][f.members.indexOf(p)]); }
  assert.equal(Number((await coop(f)).cash_balance),0); assert.equal(Number((await coop(f)).gin_balance),0); await checks('joint funding NULL payer, partial allocation and claims');
  const expired=await fixture(); await fund(expired,expired.members[1]); const fundingPockets=await Promise.all(expired.members.map(cash));
  await expireBuyerCooperativeFunding(app.pool); assert.equal((await coop(expired)).status,'funding','Worker must not close early funding');
  await app.pool.query("UPDATE buyer_cooperatives SET funding_deadline=clock_timestamp()-interval '1 second' WHERE id=$1",[expired.id]);
  const expiredRun=await expireBuyerCooperativeFunding(app.pool); assert(expiredRun.results.some(row=>row.cooperativeId===expired.id&&row.cancelled));
  assert.equal((await coop(expired)).status,'cancelled'); assert.deepEqual(await Promise.all(expired.members.map(cash)),fundingPockets,'Expiry worker allocates rights without paying members');
  assert.equal(Number((await own(expired,expired.members[1])).cashClaimable),306); assert.equal((await app.pool.query('SELECT order_id FROM buyer_cooperative_orders WHERE cooperative_id=$1',[expired.id])).rows.length,0);
  await claim(expired,expired.members[1]); assert.equal(await cash(expired.members[1]),100000); await checks('actual partial-funding expiry worker and original member refund');
  const sweep=await fixture(); await ready(sweep); await fill(sweep,3);
  await app.pool.query("UPDATE market_listings SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[sweep.orderId]);
  const sweepPockets=await Promise.all(sweep.members.map(cash)); await Market.sweepMarket(app.pool); assert.equal((await coop(sweep)).status,'settled'); assert.deepEqual(await Promise.all(sweep.members.map(cash)),sweepPockets,'Market sweep must refund joint treasury, never organizer');
  for(const p of sweep.members) await claim(sweep,p); await checks('actual market sweep joint settlement');
  const founder=await fixture(); await ready(founder); await fill(founder,3); const founderOther=await Promise.all(founder.members.slice(1).map(cash)), killer=await player(), beforeKill=await cash(killer);
  const rate=Math.min(0.5,M3.CASH_LOOT_RATE*(seasonModOf().lootMult||1)*2);
  const death=await pair(killer,founder.members[0],(ch,target,c,h)=>runEstate(c,h,target,ch.name,{ killerCh:ch,loot:true,bloodOathMult:2 }));
  const founderRights=(await app.pool.query('SELECT * FROM buyer_cooperative_members WHERE cooperative_id=$1 AND account_id=$2',[founder.id,founder.members[0].account])).rows[0];
  assert.equal(Number(founderRights.death_cash),253); assert.equal(Number(founderRights.death_gin),2); assert.equal(Number(founderRights.death_loot),Math.floor(253*rate)); assert.equal(await cash(killer),beforeKill+Math.floor(253*rate));
  assert.deepEqual(await Promise.all(founder.members.slice(1).map(cash)),founderOther); assert((await app.pool.query('SELECT id FROM market_listings WHERE id=$1',[founder.orderId])).rows.length,'Founder generic estate must not delete joint source');
  for(const p of founder.members.slice(1)) await claim(founder,p);
  const successor=await heir(founder.members[0],death.heirId), heirBefore=await cash(successor); const history=await call(successor,'POST',`/v1/buyer-cooperatives/${founder.id}/fund`,{ consent:true,termsHash:founder.termsHash,maxCash:408 },'fund'); ok(history); assert.equal(history.headers['x-idempotent-replay'],'true'); assert.equal(await cash(successor),heirBefore);
  assert.equal((await call(successor,'POST',`/v1/buyer-cooperatives/${founder.id}/claim`,{ cash:true,ginQty:0 },'no-inherited-claim')).code,400); await checks('actual founder estate only its own unclaimed rights');
  const member=await fixture(); await ready(member); await fill(member,5); ok(await call(member.members[0],'POST',`/v1/buyer-cooperatives/${member.id}/settle`,{ cancel:true }));
  ok(await call(member.members[1],'POST',`/v1/buyer-cooperatives/${member.id}/claim`,{ cash:false,ginQty:1 },'part-gin'));
  const memberBefore=await cash(killer); const memberDeath=await pair(killer,member.members[1],(ch,target,c,h)=>runEstate(c,h,target,ch.name,{ killerCh:ch,loot:true })); await heir(member.members[1],memberDeath.heirId);
  const memberRights=(await app.pool.query('SELECT * FROM buyer_cooperative_members WHERE cooperative_id=$1 AND account_id=$2',[member.id,member.members[1].account])).rows[0];
  assert.equal(Number(memberRights.death_cash),115); assert.equal(Number(memberRights.death_gin),1); assert.equal(await cash(killer),memberBefore+Math.floor(115*Math.min(0.5,M3.CASH_LOOT_RATE*(seasonModOf().lootMult||1))));
  await claim(member,member.members[0]); await claim(member,member.members[2]); await checks('actual nonfounder estate excludes already claimed GIN rights');
  if(native) {
    const concurrent=await fixture(); await Promise.all(concurrent.members.map(p=>fund(concurrent,p))); const launchBody={ termsHash:concurrent.termsHash };
    const launches=await Promise.all([call(concurrent.members[0],'POST',`/v1/buyer-cooperatives/${concurrent.id}/launch`,launchBody,'launch-race'),call(concurrent.members[0],'POST',`/v1/buyer-cooperatives/${concurrent.id}/launch`,launchBody,'launch-race')]); assert(launches.some(result=>result.code===200)); for(const result of launches) assert([200,409].includes(result.code),result.text);
    concurrent.orderId=ok(await call(concurrent.members[0],'POST',`/v1/buyer-cooperatives/${concurrent.id}/launch`,launchBody,'launch-race')).orderId; assert.equal((await app.pool.query('SELECT order_id FROM buyer_cooperative_orders WHERE cooperative_id=$1',[concurrent.id])).rows.length,1);
    const rolled=await fixture(); for(const p of rolled.members) await fund(rolled,p); const ordersBefore=Number((await app.pool.query('SELECT COUNT(*) n FROM market_listings')).rows[0].n);
    await assert.rejects(single(rolled.members[0],async(ch,c,h)=>{ await Cooperative.launchBuyerCooperative(ch,rolled.id,{ termsHash:rolled.termsHash },'rollback',c,h); throw new Error('joint launch rollback'); }),/joint launch rollback/);
    assert.equal(Number((await coop(rolled)).cash_balance),816); assert.equal((await coop(rolled)).order_id,null); assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM market_listings')).rows[0].n),ordersBefore);
    const wait=await fixture(), holder=await app.pool.connect(); let signal,pid; const reached=new Promise(resolve=>{ signal=resolve; }); const max=Number((await own(wait,wait.members[0])).maximumCash);
    try { await holder.query('BEGIN'); await holder.query('SELECT id FROM buyer_cooperatives WHERE id=$1 FOR UPDATE',[wait.id]);
      const pending=single(wait.members[0],(ch,c,h)=>{ const query=c.query.bind(c); c.query=(sql,...args)=>{ if(sql==='SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE') { pid=c.processID; signal(); } return query(sql,...args); }; return Cooperative.fundBuyerCooperative(ch,wait.id,{ consent:true,termsHash:wait.termsHash,maxCash:max },'wait-source',c,h); });
      await Promise.race([reached,pending.then(()=>{ throw new Error('fund completed before source wait'); })]); await waiting(pid); await holder.query('UPDATE buyer_cooperatives SET funding_deadline=clock_timestamp() WHERE id=$1',[wait.id]); await holder.query('COMMIT'); await assert.rejects(pending,e=>e.reason==='funding_state'); assert.equal(await cash(wait.members[0]),100000);
    } finally { await holder.query('ROLLBACK'); holder.release(); }
    const raced=await fixture(); for(const p of raced.members) await fund(raced,p); let postedSignal,releaseLaunch,deathSignal,deathPid;
    const posted=new Promise(resolve=>{ postedSignal=resolve; }), release=new Promise(resolve=>{ releaseLaunch=resolve; }), deathReached=new Promise(resolve=>{ deathSignal=resolve; });
    const launching=single(raced.members[0],async(ch,c,h)=>{ const result=await Cooperative.launchBuyerCooperative(ch,raced.id,{ termsHash:raced.termsHash },'race-launch',c,h); postedSignal(); await release; return result; }); await posted;
    const dying=pair(killer,raced.members[1],(ch,target,c,h)=>{ const query=c.query.bind(c); c.query=(sql,...args)=>{ if(sql==='SELECT * FROM buyer_cooperatives WHERE id=$1 FOR UPDATE') { deathPid=c.processID; deathSignal(); } return query(sql,...args); }; return runEstate(c,h,target,ch.name,{ killerCh:ch,loot:true }); });
    await deathReached; await waiting(deathPid); const rejectedDeath=assert.rejects(dying,e=>e.reason==='source_changed');
    releaseLaunch(); const [launched]=await Promise.all([launching,rejectedDeath]); raced.orderId=launched.orderId; assert.equal((await app.pool.query('SELECT alive FROM characters WHERE id=$1',[raced.members[1].id])).rows[0].alive,true);
    const retried=await pair(killer,raced.members[1],(ch,target,c,h)=>runEstate(c,h,target,ch.name,{ killerCh:ch,loot:true })); await heir(raced.members[1],retried.heirId); for(const p of [raced.members[0],raced.members[2]]) await claim(raced,p);
    const settleRace=await fixture(); await ready(settleRace); await fill(settleRace,3); await app.pool.query("UPDATE market_listings SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[settleRace.orderId]);
    const results=await Promise.allSettled([Market.sweepMarket(app.pool),call(settleRace.members[1],'POST',`/v1/buyer-cooperatives/${settleRace.id}/settle`,{ cancel:false },'race-settle')]); assert(results.every(result=>result.status==='fulfilled'));
    assert.equal((await coop(settleRace)).status,'settled'); for(const p of settleRace.members) await claim(settleRace,p); await checks('native funding rollback expiry death-retry and sweep contention');
  }
  console.log(`buyercooperative-integration ${native?`PostgreSQL${nativeVersion}`:'memory'}: real three-member treasury order, partial refunds/GIN, guarded market/sweep, actual estates, original rights and all global joint books PASS`);
} catch(error) { console.error(error); throw error; } finally { await app.close(); }
