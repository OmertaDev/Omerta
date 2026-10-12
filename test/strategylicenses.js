import assert from 'node:assert/strict';
const native=process.argv.includes('--postgres');
if(native){const u=new URL(process.env.STRATEGY_LICENSE_TEST_DATABASE_URL||'http://missing');if(u.protocol!=='postgresql:'||u.hostname!=='127.0.0.1'||u.search||u.hash||!((u.port==='35439'&&u.username==='pilot_runner'&&!u.password)||(u.port==='5432'&&u.username==='postgres'&&u.password==='pgcheck'))||!/^\/strategy_license_[a-z0-9_]+$/.test(u.pathname))throw Error('Use a fresh dedicated local strategy_license_ database.');
  const {default:pg}=await import('pg');const preflight=new pg.Pool({connectionString:u.href});try{assert.equal((await preflight.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length,0,'Native strategy proof requires its own empty database');}finally{await preflight.end();}
  process.env.DATABASE_URL=u.href;process.env.MARKET_SEED='strategy-license-local-fixture-1947';}
else if(process.env.DATABASE_URL)throw Error('Memory fixture refuses ambient DATABASE_URL.');
process.env.DEPOT_PILOT='on';process.env.RATE_LIMIT='off';process.env.JWT_SECRET='strategy-license-local-test-secret';process.env.SOCIAL_VERIFY_MODE='off';process.env.MOD_KEY='strategy-license-local-mod';
const {buildServer}=await import('../src/server.js');const G=await import('../src/game.js');const L=await import('../src/strategylicenses.js');const {DISTRICTS,priceBlock}=await import('../src/rules.js');const {INTEL_FORECAST}=await import('../src/intelforecasts.js');
const app=await buildServer();let seq=0;
async function character(p,name){const r=await app.inject({method:'POST',url:'/v1/character',headers:{authorization:`Bearer ${p.token}`,'idempotency-key':`strategy-char-${++seq}`},payload:{name}});assert.equal(r.statusCode,200,r.body);p.id=r.json().character?.id || (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive',[p.account])).rows[0].id;await app.pool.query('UPDATE characters SET cash=50000.5,last_accrued_at=$2 WHERE id=$1',[p.id,new Date(Date.now()+3600000)]);return p;}
async function player(name){const token=(await app.inject({method:'POST',url:'/v1/auth/guest'})).json().token;return character({token,account:JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub},name);}
const single=(p,fn)=>G.withCharacter(app.pool,p.account,fn);
const pair=(buyer,seller,fn)=>G.withTwoCharacters(app.pool,buyer.account,seller.id,fn,{meet:false});
const body={title:'Public gin availability',rule:{kind:'gin_availability_v1',districtId:DISTRICTS[0].id,minimumStock:1,triggerStock:1},feeCash:125};
const publish=(p,b=body,key=`publish-${++seq}`)=>single(p,(ch,client,h)=>L.publishStrategy(ch,b,key,client,h));
const buy=(buyer,seller,v,key=`purchase-${++seq}`)=>pair(buyer,seller,(ch,s,client,h)=>L.buyStrategy(ch,s,v,key,client,h));
const cash=async p=>Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const ledgers=id=>app.pool.query('SELECT * FROM transactions WHERE reason=$1 OR reason=$2',[`strategy:buy:${id}`,`strategy:sell:${id}`]);
const kill=async p=>{const r=await app.inject({method:'POST',url:'/v1/mod/kill',payload:{characterId:p.id},headers:{'x-mod-key':process.env.MOD_KEY}});assert.equal(r.statusCode,200,r.body);};
try{
  // Admission needs a real five-minute future target in this block. Observe readiness
  // before creating valid fixtures; do not retry publication or change either clock.
  const readyDeadline=Date.now()+310100;
  while(priceBlock(Date.now()+310000)!==priceBlock(Date.now())) {
    const now=Date.now();assert(now<readyDeadline,'Real market block readiness exceeded its bounded window');
    const until=(priceBlock(now)+1)*INTEL_FORECAST.blockMs-now;
    assert(until>0&&until<=310000,'Only the imminent real block boundary may delay setup');
    console.log(JSON.stringify({waitingForRealBlock:true,remainingMs:until}));
    await new Promise(r=>setTimeout(r,Math.min(10000,until+5)));
  }
  const seller=await player('Strategy Seller'),buyer=await player('Strategy Buyer'),outsider=await player('Strategy Outsider');
  for(const b of [{...body,code:'eval'}, {...body,rule:{...body.rule,spendCash:10}}, {...body,feeCash:49}, {...body,rule:{...body.rule,triggerStock:'1'}}, {...body,rule:{...body.rule,districtId:'private'}}, {...body,title:'\nunsafe'}])await assert.rejects(publish(seller,b),e=>e.code==='strategy_license');
  const published=await publish(seller,body,'main-rule'),v=published.strategy.id,target=Date.parse(published.strategy.targetAt);assert.equal(target-Date.parse(published.strategy.reportedAt),300000);assert.equal(published.strategy.ruleHash.length,64);
  assert.equal((await publish(seller,body,'main-rule')).strategy.id,v);await assert.rejects(publish(seller,{...body,feeCash:126},'main-rule'),e=>e.code==='strategy_license');
  if(native&&process.argv.includes('--schema-only')) {
    await assert.rejects(app.pool.query("UPDATE strategy_versions SET outcome='invented',resolved_at=clock_timestamp() WHERE id=$1",[v]),e=>e.code==='23514');
    await assert.rejects(app.pool.query("UPDATE strategy_versions SET outcome='correct',resolved_at=clock_timestamp() WHERE id=$1",[v]),e=>e.code==='23514');
    assert.equal((await app.pool.query('SELECT outcome FROM strategy_versions WHERE id=$1',[v])).rows[0].outcome,null);
    console.log(JSON.stringify({status:'PASS',database:'PostgreSQL',version:(await app.pool.query('SHOW server_version')).rows[0].server_version,scope:'Fresh current schema: actual pending publication accepted, invalid outcome and correct-without-sample refused; no five-minute scoring claim.'}));
  } else {
  const pending=await single(seller,(ch,c)=>L.resolveStrategyHoldout(ch,v,c));assert.equal(pending.pending,true);
  assert.equal((await L.strategyLibrary(app.pool,outsider.account)).length,0);const catalog=await L.strategyCatalog(app.pool);assert(!Object.hasOwn(catalog[0],'rule'));assert(!Object.hasOwn(catalog[0],'observation'));assert.deepEqual(catalog[0].publisherOutcomes,{correct:0,incorrect:0,unknown:0,pending:1,total:1});
  await assert.rejects(buy(seller,seller,v),e=>['self','strategy_license'].includes(e.code));
  await app.pool.query('UPDATE characters SET cash=124.5 WHERE id=$1',[outsider.id]);await assert.rejects(buy(outsider,seller,v),e=>e.code==='strategy_license');assert.equal((await L.strategyLibrary(app.pool,outsider.account)).length,0);
  const before=[await cash(buyer),await cash(seller)];const results=native?await Promise.all([buy(buyer,seller,v,'race-one'),buy(buyer,seller,v,'race-one')]):[await buy(buyer,seller,v,'race-one'),await buy(buyer,seller,v,'race-one')];assert.equal(results[0].license.id,results[1].license.id);const license=results[0].license.id;
  await assert.rejects(buy(buyer,seller,v,'unbound-alias'),e=>e.code==='strategy_license'&&e.message.includes('original purchase identity'));
  assert.equal((await app.pool.query('SELECT id FROM strategy_licenses WHERE buyer_account=$1 AND request_key=$2',[buyer.account,'unbound-alias'])).rows.length,0);
  assert.deepEqual([await cash(buyer),await cash(seller)],[before[0]-125,before[1]+125]);assert.equal((await ledgers(license)).rows.length,2);assert.equal((await ledgers(license)).rows.reduce((n,r)=>n+Number(r.amount),0),0);assert.deepEqual((await L.strategyLibrary(app.pool,buyer.account))[0].rule,body.rule);
  const second=(await publish(seller,{...body,title:'Second prospective holdout'})).strategy,v2=second.id;await assert.rejects(buy(buyer,seller,v2,'race-one'),e=>e.code==='strategy_license');
  if(native){const rollbackBuyer=await player('Strategy Rollback Buyer');await app.pool.query("CREATE FUNCTION reject_strategy_sale() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason LIKE 'strategy:sell:%' THEN RAISE EXCEPTION 'strategy fixture rollback'; END IF; RETURN NEW; END $$");await app.pool.query('CREATE TRIGGER reject_strategy_sale BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION reject_strategy_sale()');const beforeRollback=[await cash(rollbackBuyer),await cash(seller)];await assert.rejects(buy(rollbackBuyer,seller,v2),/strategy fixture rollback/);assert.deepEqual([await cash(rollbackBuyer),await cash(seller)],beforeRollback);assert.equal((await L.strategyLibrary(app.pool,rollbackBuyer.account)).length,0);await app.pool.query('DROP TRIGGER reject_strategy_sale ON transactions');await app.pool.query('DROP FUNCTION reject_strategy_sale()');}
  // Ten immutable versions are bounded. Every registered holdout remains in publisher counts.
  for(let i=0;i<8;i++)await publish(seller,{...body,title:`Bounded rule ${i}`});await assert.rejects(publish(seller),e=>e.code==='strategy_license');assert.equal((await L.strategyCatalog(app.pool))[0].publisherOutcomes.total,10);
  const oldBuyer={...buyer};await kill(buyer);buyer.id=(await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive',[buyer.account])).rows[0].id;assert.notEqual(buyer.id,oldBuyer.id);await kill(seller);const sellerHeir={...seller,id:(await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive',[seller.account])).rows[0].id};
  await assert.rejects(buy(buyer,sellerHeir,v2),e=>e.code==='strategy_license');process.env.DEPOT_PILOT='off';
  const replay=await single(buyer,(ch,c,h)=>L.buyStrategy(ch,null,v,'race-one',c,h));assert.equal(replay.replayed,true);assert.equal(replay.license.id,license);assert.equal(replay.license.buyerCharacterId,oldBuyer.id);assert.equal((await ledgers(license)).rows.length,2);assert.equal((await L.strategyLibrary(app.pool,buyer.account)).length,1);
  await assert.rejects(single(outsider,(ch,c)=>L.resolveStrategyHoldout(ch,v,c)),e=>e.code==='strategy_license');
  if(native){while(Date.now()<target){const wait=Math.min(10000,target-Date.now()+10);console.log(JSON.stringify({waitingForRealHoldout:true,targetAt:new Date(target).toISOString(),remainingMs:target-Date.now()}));await new Promise(r=>setTimeout(r,wait));}
    const score=await single(buyer,(ch,c)=>L.resolveStrategyHoldout(ch,v,c));assert.equal(score.strategy.outcome,'correct');assert(Date.parse(score.strategy.sampledAt)>=target);assert(Date.parse(score.strategy.sampledAt)<=target+30000);const recorded=JSON.stringify(score.strategy);
    assert.equal(JSON.stringify((await single(buyer,(ch,c)=>L.resolveStrategyHoldout(ch,v,c))).strategy),recorded);
    while(Date.now()<=Date.parse(second.windowEndsAt)){await new Promise(r=>setTimeout(r,Math.min(10000,Date.parse(second.windowEndsAt)-Date.now()+20)));}
    const late=await single(sellerHeir,(ch,c)=>L.resolveStrategyHoldout(ch,v2,c));assert.equal(late.strategy.outcome,'unknown');assert.equal(late.strategy.sample,null);
    const counts=(await L.strategyCatalog(app.pool))[0].publisherOutcomes;assert.deepEqual(counts,{correct:1,incorrect:0,unknown:1,pending:8,total:10});
    // The current explicit CASE constraint must reject a claimed correct outcome without a canonical sample.
    await assert.rejects(app.pool.query("UPDATE strategy_versions SET outcome='correct',resolved_at=clock_timestamp() WHERE id=$1",[v2]),e=>e.code==='23514');
    console.log(JSON.stringify({realHoldout:score.strategy.outcome,reportedAt:score.strategy.reportedAt,targetAt:score.strategy.targetAt,sampledAt:score.strategy.sampledAt}));
  }
  console.log(JSON.stringify({status:'PASS',database:native?'PostgreSQL':'pg-mem',version:native?(await app.pool.query('SHOW server_version')).rows[0].server_version:null,feeCash:125,scope:'Actual atomic license cash transfer, bounded private finite rules, account estate replay, full native real five-minute holdout/race/ledger rollback when postgres; API/full ledger wiring excluded.'}));
  }
}finally{await app.close();await app.pool.end();}
