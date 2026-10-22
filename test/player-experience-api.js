import assert from 'node:assert/strict';
import { buildServer } from './server-fixture.js';
import { CARS, TRIMS } from '../src/rules.js';
const app = await buildServer();
const call = async (method, url, token, payload) => {
  const r = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload });
  return { code: r.statusCode, body: r.json() };
};
const make = async name => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  assert.equal((await call('POST', '/v1/character', token, { name })).code, 200);
  const { body: { character } } = await call('GET', '/v1/me', token);
  return { token, id: character.id };
};
try {
  const script=await app.inject({method:'GET',url:'/player-experience.js'});
  assert.equal(script.statusCode,200);
  assert.match(script.headers['content-type'],/javascript/);
  const a = await make('Experience Ada'), b = await make('Experience Bea'), stranger = await make('Experience Unknown');
  await app.pool.query('UPDATE characters SET respect=5760,cash=100000,muscle=400,cunning=400,speed=100 WHERE id IN ($1,$2)', [a.id,b.id]);
  const plan = await call('POST','/v1/heists/plan',a.token,{ job:'payroll' });
  assert.equal(plan.code,200);
  const open = (await call('GET','/v1/heists',b.token)).body.open.find(x=>x.id===plan.body.id);
  assert(open.rolesOpen.includes(open.recommendedRole));
  await call('POST',`/v1/heists/${plan.body.id}/join`,b.token);
  let mine = (await call('GET','/v1/heists',a.token)).body.mine;
  assert.equal(mine.crewReady,true);
  await app.pool.query("UPDATE characters SET jail_until=now()+interval '1 minute' WHERE id=$1",[b.id]);
  mine = (await call('GET','/v1/heists',a.token)).body.mine;
  assert.equal(mine.crewReady,false,'full crew is not ready when a member is jailed');
  assert.deepEqual(mine.crew.find(x=>x.name==='Experience Bea').blockers,['jailed']);
  assert(!JSON.stringify(mine.crew).includes('jail_until'),'private timestamps stay private');

  const carId=crypto.randomUUID();
  await app.pool.query('INSERT INTO cars (id,character_id,model_id,trim_id,dmg) VALUES ($1,$2,$3,$4,25)',[carId,a.id,CARS[0].id,TRIMS[0].id]);
  const car=(await call('GET','/v1/me',a.token)).body.character.cars.find(x=>x.id===carId);
  assert(car.choices.fence.net>=0);
  const fenced=await call('POST',`/v1/garage/${carId}/fence`,a.token);
  assert.equal(fenced.code,200);
  assert.equal(fenced.body.net,car.choices.fence.net,'owner preview equals the action net');

  const path=`/v1/streets/${b.id}/rescue-quote`;
  assert.equal((await call('GET',path)).code,401,'quote requires authentication');
  assert.equal((await call('GET',path,stranger.token)).body.error,'unknown_player','strangers cannot probe prison status');
  // Existing crew membership introduces the two participants, just as the bust action does.
  await app.pool.query('INSERT INTO player_intel(owner_account,target_character,facts,source,observed_at,learned_at) SELECT account_id,$2,$3::jsonb,$4,now(),now() FROM characters WHERE id=$1',
    [a.id,b.id,JSON.stringify({name:'Experience Bea'}),'encounter']);
  const quote=await call('GET',path,a.token);
  assert.equal(quote.code,200);
  assert.equal(quote.body.jailed,true);
  assert(quote.body.chance>=.1&&quote.body.chance<=.9);
  assert(quote.body.reward>=500);
  assert(quote.body.failureJailSeconds>0);
  assert.equal(quote.body.canAttempt,true);
  const before=(await call('GET','/v1/me',a.token)).body.character;
  await call('GET',path,a.token);
  const after=(await call('GET','/v1/me',a.token)).body.character;
  assert.equal(after.cash,before.cash,'reading a rescue quote never pays a reward');
  assert.equal(after.bustAttemptsLeft,before.bustAttemptsLeft,'reading does not spend an attempt');
  await app.pool.query("UPDATE characters SET safe_until=now()+interval '1 minute' WHERE id=$1",[a.id]);
  const hidden=(await call('GET',path,a.token)).body;
  assert.equal(hidden.canAttempt,false);
  assert(hidden.blockers.includes('safehouse'));
  await app.pool.query('UPDATE characters SET safe_until=NULL WHERE id=$1',[a.id]);
  await app.pool.query('UPDATE characters SET jail_until=NULL WHERE id=$1',[b.id]);
  const free=(await call('GET',path,a.token)).body;
  assert.equal(free.canAttempt,false);
  assert.equal(free.reward,0,'a released target must not advertise a reward');
  console.log('player experience API tests passed');
} finally { await app.close(); }
