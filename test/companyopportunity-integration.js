import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres'); assert(!process.env.DATABASE_URL,'Refuse ambient database endpoints'); let nativeVersion;
if(native) {
  const url=new URL(process.env.COMPANY_OPPORTUNITY_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:','postgresql:'].includes(url.protocol)); assert.equal(url.hostname,'127.0.0.1'); assert(!url.search&&!url.hash);
  const local=['35439','35449'].includes(url.port)&&url.username==='pilot_runner'&&!url.password;
  const ci=url.port==='5432'&&url.username==='postgres'&&url.password==='pgcheck'; assert(local||ci); assert(/^\/company_opportunity_[a-z0-9_]+$/.test(url.pathname));
  const { default:pg }=await import('pg'),pre=new pg.Pool({ connectionString:url.href });
  try { nativeVersion=(await pre.query('SHOW server_version')).rows[0].server_version; assert.match(nativeVersion,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/); assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0); } finally { await pre.end(); }
  process.env.DATABASE_URL=url.href;
}
Object.assign(process.env,{DEPOT_PILOT:'on',DELIVERY_CONTRACTS:'on',RESOURCE_ECONOMY:'off',RATE_LIMIT:'off',SOCIAL_VERIFY_MODE:'off',MOD_KEY:'opportunity-integrated-local-mod',JWT_SECRET:'opportunity-integrated-local-proof-secret',MARKET_SEED:'opportunity-integrated-local-seed'});
const {buildServer}=await import('../src/server.js'),G=await import('../src/game.js'),Market=await import('../src/market.js'),O=await import('../src/companyopportunities.js');
const { runCompanyOpportunities }=await import('../src/companyopportunityrunner.js');
const app=await buildServer(); let serial=0;
const path='/v1/company/opportunities';
async function call(p,method,url,payload) { const r=await app.inject({method,url,payload,headers:p?{authorization:`Bearer ${p.token}`}:{}}); return {code:r.statusCode,body:r.json(),text:r.body}; }
const ok=r=>{assert.equal(r.code,200,r.text);return r.body;};
async function player(agent=false) {
  let token=ok(await call(null,'POST','/v1/auth/guest')).token;
  if(agent) token=ok(await call({token},'POST','/v1/auth/agent-key')).token;
  const p={token}; ok(await call(p,'POST','/v1/character',{name:`Public Scout ${++serial}`}));
  const ch=ok(await call(p,'GET','/v1/me')).character; p.id=ch.id; p.account=(await app.pool.query('SELECT account_id FROM characters WHERE id=$1',[p.id])).rows[0].account_id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1",[p.id,new Date(Date.now()+3600000)]); return p;
}
const subscribe=(p,body)=>call(p,'POST',`${path}/subscription`,body),refresh=p=>call(p,'POST',`${path}/refresh`,{}),inbox=async p=>ok(await call(p,'GET',path));
const terms={enabled:true,expectedRevision:0,kinds:['depot','delivery','warehouse'],district:'docks',good:'gin'};
async function capital() { return { pockets:(await app.pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows,cargo:(await app.pool.query('SELECT * FROM character_cargo ORDER BY character_id,good_id')).rows,messages:Number((await app.pool.query('SELECT COUNT(*) n FROM dm_messages')).rows[0].n) }; }
try {
  assert(app.hasRoute({method:'POST',url:`${path}/subscription`}),'Actual server registration required; no test route registration');
  assert.equal((await call(null,'GET',path)).code,401);
  const owner=await player(),agent=await player(true),foreign=await player();
  // Read-only depot/warehouse metadata is a public-board fixture, not a custody/payment claim.
  await app.pool.query("INSERT INTO business_depots(id,owner_character,district,stock,sale_price,bid_price,target_stock,reorder_at,restock_budget,warehouse_enabled,warehouse_revision,warehouse_slots,warehouse_cash_per_unit_day) VALUES('integrated-public-depot',$1,'docks',0,1000,500,4,0,3000,true,1,10,10)",[owner.id]);
  const order=await G.withCharacter(app.pool,owner.account,(ch,c,h)=>Market.postOrder(ch,{goodId:'gin',qty:4,price:500,hours:1},c,h));
  const before=await capital(),journals=Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  assert.equal(ok(await refresh(agent)).refreshed,false); assert.equal((await inbox(agent)).notices.length,0);
  assert.equal(ok(await subscribe(agent,terms)).revision,1); assert.equal((await subscribe(agent,terms)).code,400);
  assert.equal((await call(agent,'POST',`${path}/refresh`,{url:'https://private.invalid'})).code,400);
  assert.equal(ok(await refresh(agent)).emitted,2); assert.equal(ok(await refresh(agent)).emitted,0);
  const first=await inbox(agent); assert.equal(first.notices.length,2); assert.equal((await inbox(foreign)).notices.length,0);
  for(const forbidden of [owner.account,owner.id,'restock_budget','cash_balance','spend_limit']) assert(!JSON.stringify(first).includes(forbidden),forbidden);
  const notice=first.notices.find(n=>n.kind==='warehouse'),ack={noticeId:notice.id,expectedHash:notice.sourceHash};
  assert.equal((await call(foreign,'POST',`${path}/acknowledge`,ack)).code,400); ok(await call(agent,'POST',`${path}/acknowledge`,ack)); ok(await call(agent,'POST',`${path}/acknowledge`,ack));
  ok(await refresh(agent)); assert((await inbox(agent)).notices.find(n=>n.id===notice.id).acknowledged);
  await app.pool.query("UPDATE business_depots SET warehouse_cash_per_unit_day=11 WHERE id='integrated-public-depot'");
  const changed=(await inbox(agent)).notices.find(n=>n.id===notice.id); assert.equal(changed.status,'changed'); assert.equal(changed.quote,null);
  assert.equal(ok(await refresh(agent)).emitted,1); assert.equal((await call(agent,'POST',`${path}/acknowledge`,ack)).code,400);
  const updated=(await inbox(agent)).notices.find(n=>n.id===notice.id); assert.notEqual(updated.sourceHash,notice.sourceHash); assert.equal(updated.acknowledged,false);
  await app.pool.query("UPDATE market_listings SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[order.id]);
  const absent=(await inbox(agent)).notices.find(n=>n.sourceId===order.id); assert.equal(absent.status,'not_observed'); assert.equal(absent.quote,null);
  assert.equal((await call(agent,'GET',`${path}?limit=51`)).code,400);
  ok(await subscribe(agent,{...terms,expectedRevision:1,enabled:false})); assert.equal(ok(await refresh(agent)).refreshed,false);
  assert.deepEqual(await capital(),before,'Opportunity APIs move no cash/bank/GIN'); assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n),journals,'Opportunity APIs create no economic journals');
  // Orphaned legacy preferences are invalid queue candidates, not consent authority.
  const orphanToken=ok(await call(null,'POST','/v1/auth/guest')).token,orphan=JSON.parse(Buffer.from(orphanToken.split('.')[1],'base64url')).sub;
  await app.pool.query('INSERT INTO company_opportunity_subscriptions(account_id,enabled,revision,filters,next_refresh_at) VALUES($1,true,1,$2,$3)',[orphan,JSON.stringify({kinds:['warehouse'],district:'docks',good:'gin'}),new Date(Date.now()-30000)]);
  ok(await subscribe(foreign,{...terms,district:'neon'})); ok(await subscribe(owner,{...terms,kinds:['warehouse']}));
  await app.pool.query('UPDATE company_opportunity_subscriptions SET next_refresh_at=$2 WHERE account_id=$1',[foreign.account,new Date(Date.now()-20000)]);
  await app.pool.query('UPDATE company_opportunity_subscriptions SET next_refresh_at=$2 WHERE account_id=$1',[owner.account,new Date(Date.now()-10000)]);
  const invalidRun=await runCompanyOpportunities(app.pool,1); assert.equal(invalidRun.candidates,1); assert.equal(invalidRun.results[0].accountId,orphan); assert(invalidRun.results[0].skipped);
  const emptyRun=await runCompanyOpportunities(app.pool,1); assert.equal(emptyRun.results[0].accountId,foreign.account); assert.equal((await inbox(foreign)).notices.length,0);
  const readyRun=await runCompanyOpportunities(app.pool,1); assert.equal(readyRun.results[0].accountId,owner.account); assert.equal((await inbox(owner)).notices.length,1);
  assert.equal((await O.dueCompanyOpportunitySubscriptions(app.pool,25)).length,0); await assert.rejects(runCompanyOpportunities(app.pool,26),/candidate_limit/);
  await app.pool.query('UPDATE company_opportunity_subscriptions SET next_refresh_at=$2 WHERE account_id=$1',[owner.account,new Date(Date.now()-1000)]);
  let intercepted=false; const racePool={connect:app.pool.connect.bind(app.pool),query:async(...args)=>{
    const result=await app.pool.query(...args);
    if(typeof args[0]==='string'&&args[0].startsWith('SELECT s.account_id,s.revision,s.next_refresh_at')&&!intercepted) {
      intercepted=true; ok(await subscribe(owner,{...terms,kinds:['warehouse'],expectedRevision:1,enabled:false}));
      await app.pool.query('UPDATE company_opportunity_subscriptions SET next_refresh_at=$2 WHERE account_id=$1',[owner.account,new Date(Date.now()+600000)]);
    }
    return result;
  }};
  await runCompanyOpportunities(racePool,1); assert(intercepted); const consent=(await app.pool.query('SELECT * FROM company_opportunity_subscriptions WHERE account_id=$1',[owner.account])).rows[0];
  assert.equal(consent.enabled,false); assert.equal(Number(consent.revision),2); assert(new Date(consent.next_refresh_at).getTime()>Date.now()+500000,'Worker CAS preserves intervening consent/cadence');
  if(native) {
    const revisions=await Promise.all([subscribe(agent,{...terms,expectedRevision:2}),subscribe(agent,{...terms,expectedRevision:2,district:'neon'})]);
    assert.equal(revisions.filter(row=>row.code===200).length,1); assert.equal(revisions.filter(row=>row.code===400).length,1);
    const sub=(await inbox(agent)).subscription; ok(await subscribe(agent,{...terms,expectedRevision:sub.revision}));
    const hashBefore=(await inbox(agent)).notices.find(n=>n.kind==='warehouse').sourceHash;
    await app.pool.query("UPDATE business_depots SET warehouse_cash_per_unit_day=12 WHERE id='integrated-public-depot'");
    await assert.rejects(G.withCharacter(app.pool,agent.account,(ch,c)=>O.refreshCompanyOpportunities(ch,{query:(...args)=>{
      if(args[0].startsWith('UPDATE company_opportunity_subscriptions SET next_refresh_at')) throw new Error('opportunity refresh rollback');
      return c.query(...args);
    }})),/opportunity refresh rollback/);
    assert.equal((await inbox(agent)).notices.find(n=>n.kind==='warehouse').sourceHash,hashBefore);
    const refreshes=await Promise.all([refresh(agent),refresh(agent)]); assert.equal(refreshes.reduce((n,row)=>n+ok(row).emitted,0),1,'Actual concurrent refresh emits changed public quote once');
    await app.pool.query('UPDATE company_opportunity_subscriptions SET next_refresh_at=$2 WHERE account_id=$1',[owner.account,new Date(Date.now()-1000)]);
    ok(await subscribe(owner,{...terms,expectedRevision:2,kinds:['warehouse']}));
    let revised=false; const revisedPool={connect:app.pool.connect.bind(app.pool),query:async(...args)=>{
      const result=await app.pool.query(...args);
      if(typeof args[0]==='string'&&args[0].startsWith('SELECT s.account_id,s.revision,s.next_refresh_at')&&!revised) {
        revised=true; ok(await subscribe(owner,{...terms,expectedRevision:3,kinds:['warehouse'],district:'neon'}));
      }
      return result;
    }};
    await runCompanyOpportunities(revisedPool,1); const final=(await inbox(owner)).subscription; assert(revised); assert.equal(final.revision,4); assert.equal(final.district,'neon');
    assert((await inbox(owner)).notices.every(row=>row.quote===null),'Dispatcher uses current revised filters, not candidate authority');
  }
  assert.deepEqual(await capital(),before,'Worker moves no pockets/cargo/messages'); assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n),journals);
  console.log(`companyopportunity-integration ${native?nativeVersion:'memory'}: actual JWT/agent public quotes, consent/hash privacy, finite invalid/empty queue fairness, disabled-consent CAS and no wealth/messages PASS`);
} catch(error) { console.error(error); throw error; } finally { await app.close(); }
