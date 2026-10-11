import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const postgres = process.argv.includes('--postgres');
if (postgres) {
  const url = new URL(process.env.INTEL_FORECAST_TEST_DATABASE_URL || 'http://missing');
  const local = url.hostname === '127.0.0.1' && ((url.port === '35439' && url.username === 'pilot_runner') || (url.port === '5432' && url.username === 'postgres'));
  if (url.protocol !== 'postgresql:' || !local || !/^\/intel_forecasts_[a-z0-9_]+$/.test(url.pathname))
    throw Error('Use an explicitly isolated local intel_forecasts_ PostgreSQL test database.');
  process.env.DATABASE_URL = url.href;
} else process.env.DATABASE_URL = '';
Object.assign(process.env, { RATE_LIMIT: 'off', JWT_SECRET: 'intel-forecast-local-test-only-secret-2026',
  SOCIAL_VERIFY_MODE: 'off', MOD_KEY: 'intel-forecast-local-mod-only', DEPOT_PILOT: 'on', MARKET_SEED: 'intel-forecast-local-test-only' });
const { buildServer } = await import('../src/server.js');
const { ledger, withCharacter, withTwoCharacters } = await import('../src/game.js');
const Jobs = await import('../src/intelforecastjobs.js');
const { priceBlock } = await import('../src/rules.js');
const app = await buildServer(), suffix = crypto.randomUUID().slice(0, 6);
const req = async (method, url, token, body) => {
  const r = await app.inject({ method, url, payload: body, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), 'idempotency-key': crypto.randomUUID() } });
  assert.equal(r.statusCode, 200, r.body); return r.json();
};
async function actor(name) {
  const token = (await req('POST', '/v1/auth/guest')).token;
  await req('POST', '/v1/character', token, { name: `${name} ${suffix}` });
  const ch = (await req('GET', '/v1/me', token)).character;
  const accountId = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0].account_id;
  await app.pool.query('UPDATE characters SET cash=50000,bank=0 WHERE id=$1', [ch.id]);
  await ledger(app.pool, { characterId: ch.id, currency: 'cash', amount: 50000 - ch.cash - ch.bank, reason: 'crime:intel-fixture' });
  return { id: ch.id, accountId, token };
}
const pair = (a,b,fn) => withTwoCharacters(app.pool,a.accountId,b.id,(ch,other,client,h)=>fn(ch,other,client,h),{meet:false});
const single = (a,fn) => withCharacter(app.pool,a.accountId,(ch,client,h)=>fn(ch,client,h));
const cash = async p => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1',[p.id])).rows[0].cash);
const row = async id => (await app.pool.query('SELECT * FROM intel_forecast_jobs WHERE id=$1',[id])).rows[0];
const body = () => ({districtId:'docks',minimumStock:10,feeCash:100,targetAt:new Date(Date.now()+600000).toISOString()});
const create = (a,b,terms=body(),key=crypto.randomUUID()) => pair(a,b,(ch,other,c,h)=>Jobs.createIntelForecastJob(ch,other,terms,key,c,h));
const submit = (seller,buyer,id,predictsAvailable=true) => pair(seller,buyer,(ch,other,c,h)=>Jobs.submitIntelForecastJob(ch,other,id,{predictsAvailable},c,h));
const resolve = (a,id) => single(a,(ch,c)=>Jobs.resolveIntelForecastOutcome(ch,id,c));
const count = async(reason,id)=>Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE reason=$1 AND counterparty=$2',[reason,id])).rows[0].n);
try {
  const buyer=await actor('IntelBuyer'),reporter=await actor('IntelReporter'),foreign=await actor('IntelForeign');
  for(const p of [buyer,reporter]) {
    await app.pool.query('UPDATE characters SET cash=cash+0.5 WHERE id=$1',[p.id]);
    await ledger(app.pool,{characterId:p.id,currency:'cash',amount:0.5,reason:'crime:intel-fraction-fixture'});
  }
  const terms=body(), key='intel-fixed-request';
  const first=(await create(buyer,reporter,terms,key)).job;
  assert.equal(await cash(buyer),49900.5);assert.equal(await cash(reporter),50000.5);
  assert.equal((await create(buyer,reporter,terms,key)).job.id,first.id);
  await assert.rejects(create(buyer,reporter,{...terms,feeCash:101},key),e=>e.code==='intel_forecast');
  await app.pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[buyer.id,new Date(Date.now()+120000)]);
  const paid=(await submit(reporter,buyer,first.id)).job;
  await app.pool.query('UPDATE characters SET jail_until=NULL WHERE id=$1',[buyer.id]);
  assert.equal(paid.status,'reported');assert.equal(await cash(reporter),50100.5);assert.equal(await cash(buyer)+await cash(reporter),100001);assert.equal(await count('intel_job:pay',first.id),1);
  assert.equal((await submit(reporter,buyer,first.id)).job.reportedAt,paid.reportedAt);
  await assert.rejects(submit(reporter,buyer,first.id,false),e=>e.code==='intel_forecast');
  assert.equal((await resolve(buyer,first.id)).pending,true);
  await assert.rejects(resolve(foreign,first.id),e=>e.code==='intel_forecast');
  assert.equal((await Jobs.intelForecastJobBoard(app.pool,foreign.accountId)).length,0);
  // Translate only fixture temporal context, not production clocks: exercise actual current public sampling.
  const sampleTarget=Date.now()-1, oldReported=sampleTarget-120000, observation={...paid.observation,observedAt:new Date(oldReported).toISOString()};
  await app.pool.query('UPDATE intel_forecast_jobs SET created_at=$2,target_at=$3,reported_at=$4,observation=$5 WHERE id=$1',
    [first.id,new Date(oldReported-120000),new Date(sampleTarget),new Date(oldReported),observation]);
  const scored=(await resolve(buyer,first.id)).job;
  assert.equal(scored.outcome,'correct');assert.equal(scored.outcomeDefinition,'first_server_snapshot_in_window');assert.ok(scored.sampledAt);
  const frozen=JSON.stringify(scored);
  assert.equal(JSON.stringify((await resolve(reporter,first.id)).job),frozen);
  const cancelled=(await create(buyer,reporter)).job;
  const before=await cash(buyer);
  await single(buyer,(ch,c,h)=>Jobs.cancelIntelForecastJob(ch,cancelled.id,c,h));
  await single(buyer,(ch,c,h)=>Jobs.cancelIntelForecastJob(ch,cancelled.id,c,h));
  assert.equal(await cash(buyer),before+100);assert.equal(await count('intel_job:refund',cancelled.id),1);
  const expired=(await create(buyer,reporter)).job;
  await app.pool.query('UPDATE intel_forecast_jobs SET created_at=$2,target_at=$3 WHERE id=$1',[expired.id,new Date(Date.now()-600000),new Date(Date.now()+30000)]);
  assert.equal((await Jobs.expireIntelForecastJobs(app.pool)).refunded,1);
  assert.equal((await Jobs.expireIntelForecastJobs(app.pool)).refunded,0);
  assert.equal((await row(expired.id)).status,'expired');
  const doomed=(await create(buyer,reporter)).job;
  const killerBefore=await cash(foreign);
  const killed=await pair(foreign,buyer,async(k,v,c,h)=>{
    const result=await Jobs.voidIntelForecastJobsAtDeath(c,v.id,k,0.25);
    await c.query('UPDATE characters SET alive=false,cash=0 WHERE id=$1',[v.id]);v.alive=false;return result;
  });
  assert.equal(killed.looted,25);assert.equal(await cash(foreign),killerBefore+25);assert.equal((await row(doomed.id)).status,'buyer_dead');
  assert.equal(await count('intel_job:loot',doomed.id),1);assert.equal(await count('intel_job:death',doomed.id),1);
  assert.equal((await Jobs.expireIntelForecastJobs(app.pool)).refunded,0);
  assert.equal((await single(reporter,(ch,c)=>Jobs.replayIntelForecastReport(ch,first.id,{predictsAvailable:true},c))).job.id,first.id);
  await assert.rejects(single(foreign,(ch,c)=>Jobs.replayIntelForecastReport(ch,first.id,{predictsAvailable:true},c)),e=>e.code==='intel_forecast');
  await assert.rejects(single(reporter,(ch,c)=>Jobs.replayIntelForecastReport(ch,first.id,{predictsAvailable:false},c)),e=>e.code==='intel_forecast');
  assert.equal(await count('intel_job:pay',first.id),1,'Dead buyer receipt replay cannot pay again');
  assert.equal((await Jobs.intelForecastJobBoard(app.pool,buyer.accountId)).length,4,'Original account keeps private history without revived spending authority');
  if(postgres){
    const a=await actor('IntelRaceBuyer'),b=await actor('IntelRaceReporter');
    const raced=(await create(a,b)).job;
    const settled=await Promise.all([submit(b,a,raced.id),submit(b,a,raced.id)]);
    assert(settled.every(r=>r.job.status==='reported'));assert.equal(await count('intel_job:pay',raced.id),1);assert.equal(await cash(b),50100);
    const rollback=(await create(a,b)).job;
    await app.pool.query("CREATE FUNCTION intel_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='intel_job:pay' THEN RAISE EXCEPTION 'intel ledger fixture failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER intel_fail BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION intel_fail()');
    const pre=await cash(b);await assert.rejects(submit(b,a,rollback.id));
    assert.equal(await cash(b),pre);assert.equal((await row(rollback.id)).status,'open');assert.equal(await count('intel_job:pay',rollback.id),0);
    await app.pool.query('DROP TRIGGER intel_fail ON transactions');
    await submit(b,a,rollback.id);
    const cap=(await create(a,b)).job;
    await assert.rejects(create(a,b),e=>e.code==='intel_forecast');
    await single(a,(ch,c,h)=>Jobs.cancelIntelForecastJob(ch,cap.id,c,h));
    // Distinct jobs share the consenting reporter lock: only one may consume slot3.
    const capA=(await create(a,b)).job,capB=(await create(foreign,b)).job;
    const capResults=await Promise.allSettled([submit(b,a,capA.id),submit(b,foreign,capB.id)]);
    assert.equal(capResults.filter(r=>r.status==='fulfilled').length,1);
    const rejected=capResults.find(r=>r.status==='rejected');assert.equal(rejected.reason.code,'intel_forecast');
    assert.equal(await count('intel_job:pay',capA.id)+await count('intel_job:pay',capB.id),1);
  }
  // Unsolicited assignments must not reserve another player's voluntary capacity.
  const attacker=await actor('QAttacker'),victim=await actor('QVictim'),helper=await actor('QHelper'),legit=await actor('QLegit');
  const malicious=[];
  for(let i=0;i<3;i++) malicious.push((await create(attacker,victim)).job);
  const own=(await create(victim,helper)).job;
  assert.equal(own.status,'open');
  const chosen=(await create(legit,victim)).job;
  await submit(victim,legit,chosen.id);
  await submit(victim,attacker,malicious[0].id);
  const victimCash=await cash(victim);
  await assert.rejects(submit(victim,attacker,malicious[1].id),e=>e.code==='intel_forecast');
  assert.equal(await cash(victim),victimCash,'Voluntary capacity refusal cannot pay');
  assert.equal((await row(malicious[1].id)).status,'open');
  assert.equal(await count('intel_job:pay',malicious[1].id),0);
  const serverVersion=postgres?(await app.pool.query('SHOW server_version')).rows[0].server_version:null;
  console.log(JSON.stringify({status:'PASS',database:postgres?'native PostgreSQL':'pg-mem',serverVersion,fixedFee:100,houseTake:0,
    scope:'Canonical wrappers/cash/escrow/replay/privacy/cancel/expiry/estate hook/sampling; temporal contexts translated by fixture SQL; actual full runEstate/API integration owned separately'}));
} finally { await app.close(); }
