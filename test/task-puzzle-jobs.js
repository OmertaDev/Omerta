import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import { withCharacter, doCrime } from '../src/game.js';
import { doMission } from '../src/growth.js';
import { advanceHustle } from '../src/hustle.js';
import { CRIMES, MISSIONS, PACING, HUSTLE, hustleOf, dayOf } from '../src/rules.js';
import { solveTaskPuzzle } from './task-puzzle-solver.js';
import { taskPuzzlePostgresTarget } from './task-puzzle-postgres.js';
import { issueTaskPuzzle } from '../src/task-puzzles.js';

process.env.CLUE_DROP_P = '0'; // Hold optional random trail state equal for paired crime runs.

const app = await buildServer(), pool = app.pool;
const call = async (method, url, token, body) => {
  const res = await app.inject({ method, url, payload: body, headers: token ? { authorization: `Bearer ${token}` } : {} });
  return { code: res.statusCode, body: res.json() };
};
const actor = async name => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', token, { name });
  const ch = (await call('GET', '/v1/me', token)).body.character;
  const { account_id: account } = (await pool.query('SELECT account_id FROM characters WHERE id=$1', [ch.id])).rows[0];
  await pool.query('UPDATE characters SET respect=10000,cunning=100,speed=100,muscle=100,cash=50000,nerve=50,mission_at=NULL WHERE id=$1', [ch.id]);
  return { token, id: ch.id, account };
};
const issue = async (who, scope, targetId) => {
  const r = await call('POST', '/v1/task-puzzles', who.token, { scope, targetId });
  assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body.puzzle;
};
const as = (who, fn) => withCharacter(pool, who.account, fn);
const rejects = (fn, code) => assert.rejects(fn, error => error.code === code);
const snapshot = async who => ({
  character: (await pool.query('SELECT cash,respect,nerve,mission_at,street_action_at,crime_puzzle_revision FROM characters WHERE id=$1', [who.id])).rows[0],
  jobs: (await pool.query('SELECT mission_id FROM missions_done WHERE character_id=$1', [who.id])).rows,
});
try {
  for (const unsafe of [undefined, 'postgresql://example.com/omerta_task_puzzles', 'postgresql://127.0.0.1/omerta',
    'postgresql://127.0.0.1/omerta_task_puzzles?options=-csearch_path=public', 'https://127.0.0.1/omerta_task_puzzles'])
    assert.throws(() => taskPuzzlePostgresTarget(unsafe));
  assert.equal((await call('POST', '/v1/task-puzzles', null, { scope: 'mission', targetId: 'm2' })).code, 401);
  assert.equal((await call('GET', '/v1/task-puzzles?scope=mission&targetId=m2')).code, 401);
  const a = await actor('Task Jobs'), b = await actor('Other Tasks');
  const before = await snapshot(a);
  // Removing the authoritative guard would make this direct-call bypass pay out.
  await rejects(as(a, (ch, c, h) => doMission(ch, 'm2', c, h)), 'task_puzzle_required');
  assert.deepEqual(await snapshot(a), before);
  for (const id of ['m11', 'm12']) await rejects(as(a, (ch, c, h) => doMission(ch, id, c, h)), 'task_puzzle_required');
  assert.equal((await call('POST', '/v1/missions/m2', a.token, { completed: true })).body.error, 'task_puzzle_required');
  assert.equal((await call('GET', '/v1/task-puzzles?scope=mission&targetId=m2', a.token)).body.puzzle, null);
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM task_puzzles')).rows[0].n), 0, 'GET does not issue');
  for (const body of [{ scope: 'mission', targetId: 'm1' }, { scope: 'crime', targetId: 'no-such-crime' },
    { scope: 'mission', targetId: 'm2', contextKey: 'forged' }, { scope: 'mission', targetId: 'm2', characterId: b.id }])
    assert.equal((await call('POST', '/v1/task-puzzles', a.token, body)).code, 400);
  const p = await issue(a, 'mission', 'm2'), answer = solveTaskPuzzle(p);
  assert.deepEqual(await issue(a, 'mission', 'm2'), p);
  assert.doesNotMatch(JSON.stringify(p), /"(?:seed|answer|contextKey|structuralSignature)"\s*:/);
  await rejects(as(a, (ch, c, h) => doMission(ch, 'm2', c, h, { id: p.id, answer: {} })), 'bad_task_puzzle_answer');
  await rejects(as(a, (ch, c, h) => doMission(ch, 'm11', c, h, answer)), 'stale_task_puzzle');
  await rejects(as(b, (ch, c, h) => doMission(ch, 'm2', c, h, answer)), 'stale_task_puzzle');
  assert.equal((await call('POST', '/v1/missions/m2', a.token, { puzzle: { id: p.id, answer: {} } })).body.error, 'bad_task_puzzle_answer');
  assert.equal((await call('POST', '/v1/missions/m11', a.token, { puzzle: answer })).body.error, 'stale_task_puzzle');
  assert.equal((await call('POST', '/v1/missions/m2', b.token, { puzzle: answer })).body.error, 'stale_task_puzzle');
  assert.deepEqual(await snapshot(a), before, 'bad and cross-context answers cannot mutate the job');
  const paid = await call('POST', '/v1/missions/m2', a.token, { puzzle: answer });
  assert.equal(paid.code, 200, JSON.stringify(paid.body));
  assert.equal(paid.body.puzzle.completed, true);
  const after = await snapshot(a), m2 = MISSIONS.find(m => m.id === 'm2');
  assert.equal(Number(after.character.cash) - Number(before.character.cash), m2.reward.cash);
  assert.equal(Number(after.character.respect) - Number(before.character.respect), Math.round(m2.reward.respect * PACING.MISSION_RESPECT_MULT));
  assert.equal((await call('POST', '/v1/missions/m2', a.token, { puzzle: answer })).body.error, 'done');
  assert.equal((await issue(a, 'mission', 'm2')).status, 'consumed');
  await pool.query('UPDATE characters SET mission_at=NULL WHERE id=$1', [a.id]);
  assert.equal((await call('POST', '/v1/missions/m1', a.token)).code, 200, 'unselected jobs remain compatible');
  for (const id of ['m11', 'm12']) {
    await pool.query('UPDATE characters SET mission_at=NULL WHERE id=$1', [a.id]);
    const start = await snapshot(a), required = solveTaskPuzzle(await issue(a, 'mission', id));
    const result = await call('POST', `/v1/missions/${id}`, a.token, { puzzle: required });
    assert.equal(result.code, 200, JSON.stringify(result.body));
    const finish = await snapshot(a), mission = MISSIONS.find(m => m.id === id);
    assert.equal(Number(finish.character.cash) - Number(start.character.cash), mission.reward.cash);
    assert.equal(Number(finish.character.respect) - Number(start.character.respect), Math.round(mission.reward.respect * PACING.MISSION_RESPECT_MULT));
  }
  await pool.query('UPDATE characters SET mission_at=NULL,cunning=0 WHERE id=$1', [b.id]);
  assert.equal((await call('POST', '/v1/missions/m2', b.token)).body.error, 'reqs');
  await pool.query('UPDATE characters SET cunning=100,mission_at=$2 WHERE id=$1', [b.id, new Date(Date.now() + 60000)]);
  assert.equal((await call('POST', '/v1/missions/m2', b.token)).body.error, 'cooldown');

  const h = hustleOf(a.id, dayOf());
  assert.equal((await call('POST', '/v1/task-puzzles', a.token, { scope: 'hustle', targetId: 'legwork' })).body.error, 'hustle_step');
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, h.stops[0]]);
  assert.equal((await call('POST', '/v1/hustle/advance', a.token)).body.step, 1);
  const hp = solveTaskPuzzle(await issue(a, 'hustle', 'legwork'));
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, h.stops[1]]);
  assert.equal((await call('POST', '/v1/hustle/advance', a.token, { puzzle: hp })).body.error, 'legwork', 'puzzle cannot replace real work');
  await pool.query('INSERT INTO daily_progress (character_id,day,counters) VALUES ($1,$2,$3) ON CONFLICT (character_id,day) DO UPDATE SET counters=$3',
    [a.id, dayOf(), JSON.stringify({ [h.leg.kind]: 10 })]);
  await rejects(as(a, (ch, c, hooks) => advanceHustle(ch, c, hooks)), 'task_puzzle_required');
  let yesterday;
  await as(a, async (ch, c) => { yesterday = await issueTaskPuzzle(ch, { scope: 'hustle', targetId: 'legwork', contextKey: `day:${dayOf() - 1}:step:1` }, c); return {}; });
  assert.equal((await call('POST', '/v1/hustle/advance', a.token, { puzzle: solveTaskPuzzle(yesterday) })).body.error, 'stale_task_puzzle');
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, h.stops[0]]);
  assert.equal((await call('POST', '/v1/hustle/advance', a.token, { puzzle: hp })).body.error, 'district');
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, h.stops[1]]);
  assert.equal((await call('POST', '/v1/hustle/advance', a.token, { puzzle: hp })).body.step, 2);
  await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [a.id, h.stops[2]]);
  const payout = await call('POST', '/v1/hustle/advance', a.token);
  assert.equal(payout.body.pay, Math.max(HUSTLE.PAY_MIN, HUSTLE.PAY_PER_LVL * (await call('GET', '/v1/me', a.token)).body.character.level));
  assert.equal((await call('POST', '/v1/hustle/advance', a.token)).body.error, 'done');

  // All attempts, including failures and attempts at other crimes, invalidate prep.
  const crime = CRIMES.find(c => c.id === 'pick'), cp = await issue(a, 'crime', crime.id);
  const oldPrep = solveTaskPuzzle(cp), random = Math.random;
  try {
    Math.random = () => 0.999999;
    const fail = await call('POST', '/v1/crimes/pick', a.token);
    assert.equal(fail.code, 200, JSON.stringify(fail.body)); assert.equal(fail.body.success, false);
    await pool.query('UPDATE characters SET jail_until=NULL,street_action_at=NULL,nerve=50 WHERE id=$1', [a.id]);
    assert.equal((await call('POST', '/v1/crimes/pick', a.token, { puzzle: oldPrep })).body.error, 'stale_task_puzzle');
    const fresh = await issue(a, 'crime', crime.id); assert.notEqual(fresh.id, cp.id);
    assert.deepEqual(await issue(a, 'crime', crime.id), fresh);
  } finally { Math.random = random; }

  // Same state and random stream: optional preparation cannot change odds, draws or payout.
  for (const roll of [0.01, 0.99999]) {
    const run = async prep => {
      const puzzle = prep ? solveTaskPuzzle(await issue(b, 'crime', 'pick')) : undefined;
      await pool.query('UPDATE characters SET cash=50000,respect=10000,heat=0,cb=0,nerve=30,lc_crime=0,jail_until=NULL,street_action_at=NULL,last_accrued_at=now() WHERE id=$1', [b.id]);
      let draws = 0;
      return as(b, async (ch, c, hooks) => {
        let result;
        const xpBefore = Number(hooks.owned.mastery.larceny || 0);
        try {
          Math.random = () => { draws++; return roll; };
          result = await doCrime(ch, 'pick', c, hooks, 'standard', puzzle);
        } finally { Math.random = random; }
        const { puzzle: feedback, ...outcome } = result;
        if (prep) assert.equal(feedback.completed, true);
        return { outcome, draws, cash: ch.cash, respect: ch.respect, nerve: ch.nerve, cb: ch.cb,
          xp: Number(hooks.owned.mastery.larceny || 0) - xpBefore };
      });
    };
    const prepared = await run(true), ordinary = await run(false);
    delete prepared.character; delete ordinary.character;
    assert.deepEqual(prepared, ordinary, 'preparation is feedback only');
  }
  const rules = (await call('GET', '/v1/rules', a.token)).body;
  assert.deepEqual(rules.missions.filter(m => m.puzzle?.required).map(m => m.id).sort(), ['m11', 'm12', 'm2']);
  const api = (await call('GET', '/openapi.json')).body;
  assert(api.paths['/v1/task-puzzles'].post.requestBody.content['application/json'].schema.required.includes('scope'));
  assert(api.paths['/v1/task-puzzles'].get.parameters.some(p => p.name === 'targetId' && p.required));
  assert(api.paths['/v1/missions/{id}'].post.requestBody.content['application/json'].schema.properties.puzzle);
  assert(rules.crimes.every(crime => crime.puzzle?.scope === 'crime' && crime.puzzle.required === false && crime.puzzle.benefit === 'feedback_only'));
  const oldLife = solveTaskPuzzle(await issue(b, 'mission', 'm11'));
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [b.id]);
  await pool.query('INSERT INTO characters (id,account_id,name,season,respect,cunning) VALUES ($1,$2,$3,1,10000,100)', [crypto.randomUUID(), b.account, 'Task Puzzle Heir']);
  assert.equal((await call('POST', '/v1/missions/m11', b.token, { puzzle: oldLife })).body.error, 'stale_task_puzzle');
  console.log('PASS task-puzzle jobs: authoritative gates, HTTP contracts, contexts, real legwork, rewards and RNG equivalence');
} finally { await app.close(); }
