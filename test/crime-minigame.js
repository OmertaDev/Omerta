import assert from 'node:assert/strict';
import { crimeChallenge, verifyCrimeMinigame } from '../src/crime-minigame.js';
import { doCrime } from '../src/game.js';
import { quoteCrime } from '../src/ux-tactics.js';
import { CRIMES } from '../src/rules.js';

process.env.CLUE_DROP_P = '0';
const character = () => ({ id: 'minigame-character', account_id: 'minigame-account', name: 'Signal Reader',
  generation: 1, respect: 0, muscle: 10, cunning: 200, speed: 200, cash: 5000, bank: 0,
  health: 100, energy: 100, nerve: 40, heat: 0, lc_crime: 0, trade_rep: 0, cb: 0,
  loc: 'docks', path: null, last_accrued_at: new Date(), street_action_at: null, jail_until: null });
const handle = () => ({ acct: { prestige: 0, omr: 0, staked: 0, unbonding: 0, kills: 0, smuggled: 0 },
  owned: { assets: [], gear: [], skills: new Set(), mastery: {}, makings: {}, items: {}, held: [], deedPerk: [] },
  ledger: async () => {}, rngLog: async () => {}, track: async () => {}, bumpDaily: async () => {}, notify: async () => {} });
const crime = CRIMES.find((entry) => entry.id === 'pick');
assert(crime);
const answer = (puzzle, mistakes = 0) => ({ token: puzzle.token,
  moves: [...Array.from({ length: mistakes }, () => (puzzle.rounds[0][0] + 1) % 4), ...puzzle.rounds.flat()] });
const expectError = (fn, code) => assert.throws(fn, (error) => error.code === code);
const ch = character(), puzzle = crimeChallenge(ch, crime.id, 'standard').minigame;
assert.deepEqual(puzzle.rounds.map((round) => round.length), [3, 4, 5]);
assert(puzzle.rounds.flat().every((pad) => Number.isInteger(pad) && pad >= 0 && pad <= 3));
assert.equal(puzzle.kind, 'signal-lock');
assert.equal(puzzle.maxMistakes, 3);
expectError(() => verifyCrimeMinigame(ch, crime.id, 'standard'), 'crime_minigame_required');
for (const invalid of [true, [], {}, { token: puzzle.token, moves: [] }, { ...answer(puzzle), score: 100 },
  { token: puzzle.token, moves: [4] }, { token: puzzle.token, moves: [0.5] },
  { token: puzzle.token, moves: ['0'] }, { token: puzzle.token, moves: [0].concat(Array(64).fill(0)) },
  { token: 'malformed', moves: [] }, { ...answer(puzzle), moves: [...puzzle.rounds.flat(), 0] }]) {
  expectError(() => verifyCrimeMinigame(ch, crime.id, 'standard', invalid), 'bad_crime_minigame');
}
const forged = answer(puzzle); forged.token = `${forged.token.split('.')[0]}.${'a'.repeat(43)}`;
expectError(() => verifyCrimeMinigame(ch, crime.id, 'standard', forged), 'stale_crime_minigame');
for (const other of [{ ...ch, id: 'other' }, { ...ch, account_id: 'other' },
  { ...ch, street_action_at: new Date(Date.now() - 1000) }]) {
  expectError(() => verifyCrimeMinigame(other, crime.id, 'standard', answer(puzzle)), 'stale_crime_minigame');
}
expectError(() => verifyCrimeMinigame(ch, 'stereo', 'standard', answer(puzzle)), 'stale_crime_minigame');
expectError(() => verifyCrimeMinigame(ch, crime.id, 'quiet', answer(puzzle)), 'stale_crime_minigame');
const originalNow = Date.now;
try {
  Date.now = () => new Date(puzzle.expiresAt).getTime() + 1;
  expectError(() => verifyCrimeMinigame(ch, crime.id, 'standard', answer(puzzle)), 'stale_crime_minigame');
} finally { Date.now = originalNow; }

const scores = [0, 1, 2].map((mistakes) => verifyCrimeMinigame(ch, crime.id, 'standard', answer(puzzle, mistakes)));
assert.deepEqual(scores.map((score) => score.multiplier), [1, 0.85, 0.7]);
const wrong = (puzzle.rounds[0][0] + 1) % 4;
const failed = verifyCrimeMinigame(ch, crime.id, 'standard', { token: puzzle.token, moves: [wrong, wrong, wrong] });
assert.deepEqual(failed, { kind: 'signal-lock', completed: false, mistakes: 3, multiplier: 0 });
// A mistake after partial progress really resets the current round: the full
// round has to be replayed, rather than simply continuing from the next pad.
const resetTrace = { token: puzzle.token,
  moves: [puzzle.rounds[0][0], (puzzle.rounds[0][1] + 1) % 4, ...puzzle.rounds.flat()] };
assert.equal(verifyCrimeMinigame(ch, crime.id, 'standard', resetTrace).mistakes, 1);

const client = { query: async (sql) => /^\s*SELECT/i.test(sql) ? { rows: [], rowCount: 0 } : { rows: [], rowCount: 1 } };
const evaluateFormula = (node, inputs) => typeof node === 'number' ? node : node.input ? inputs[node.input]
  : ({ add: (values) => values.reduce((a, b) => a + b, 0), mul: (values) => values.reduce((a, b) => a * b, 1),
    min: (values) => Math.min(...values), max: (values) => Math.max(...values) })[node.op](node.args.map((arg) => evaluateFormula(arg, inputs)));
const originalRandom = Math.random;
try {
  for (const score of [...scores, failed]) {
    Math.random = () => score.completed ? 0.9 : 0;
    const actor = character(), h = handle(), before = actor.nerve;
    const projected = quoteCrime(actor, h, crime, 'standard', null, score);
    assert.equal(projected.threshold, projected.probability);
    assert.equal(evaluateFormula(projected.formula.expression, projected.formula.inputs), projected.probability,
      'the explainable formula carries the same minigame multiplier as settlement');
    const result = await doCrime(actor, crime.id, client, h, 'standard', undefined, score);
    assert.equal(result.success, score.mistakes === 0,
      'identical crime and roll succeed with a perfect game and fail after mistakes');
    assert.equal(result.successChance, projected.probability);
    assert.equal(result.minigame.multiplier, score.multiplier);
    assert.equal(actor.nerve, before - crime.nerve, 'terminal failed minigames consume the normal attempt');
    assert(actor.street_action_at, 'terminal minigames reserve the shared street clock');
  }
} finally { Math.random = originalRandom; }
console.log('crime minigame core: strict trace validation, signature and actor/job/approach/clock/expiry binding, reset mechanics, scoring, actual outcome and quote parity passed');

if (!process.argv.includes('--unit-only')) {
  assert(!process.env.DATABASE_URL, 'Crime API verification uses disposable pg-mem.');
  process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
  const { buildServer } = await import('./server-fixture.js');
  const app = await buildServer();
  const request = async (method, url, token, payload, key) => {
    const reply = await app.inject({ method, url, payload,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(key ? { 'idempotency-key': key } : {}) } });
    return { code: reply.statusCode, body: reply.json() };
  };
  try {
    assert.equal((await request('GET', '/v1/crimes/pick/challenge')).code, 401);
    const token = (await request('POST', '/v1/auth/guest')).body.token;
    assert.equal((await request('POST', '/v1/character', token, { name: 'Crime Minigame Reader' })).code, 200);
    const actor = (await app.pool.query("SELECT * FROM characters WHERE name='Crime Minigame Reader'")).rows[0];
    const reset = () => app.pool.query('UPDATE characters SET street_action_at=NULL,jail_until=NULL,nerve=100,cunning=200,speed=200 WHERE id=$1', [actor.id]);
    await reset();
    const issued = (await request('GET', '/v1/crimes/pick/challenge?approach=standard', token)).body.minigame;
    assert(issued?.token);
    const before = Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1', [actor.id])).rows[0].n);
    assert.equal((await request('POST', '/v1/crimes/pick', token, {})).body.error, 'crime_minigame_required');
    assert.equal((await request('POST', '/v1/crimes/pick', token, { minigame: { token: issued.token, moves: [] } })).body.error, 'bad_crime_minigame');
    assert.equal((await request('POST', '/v1/crimes/pick', token, { approach: 'quiet', minigame: answer(issued) })).body.error, 'stale_crime_minigame');
    const unchanged = (await app.pool.query('SELECT nerve,street_action_at FROM characters WHERE id=$1', [actor.id])).rows[0];
    assert.equal(unchanged.street_action_at, null);
    assert.equal(Number((await app.pool.query('SELECT COUNT(*) n FROM transactions WHERE character_id=$1', [actor.id])).rows[0].n), before);
    Math.random = () => 0.9;
    const body = { approach: 'standard', minigame: answer(issued) }, key = 'crime-minigame-once';
    const result = await request('POST', '/v1/crimes/pick', token, body, key);
    assert.equal(result.code, 200, JSON.stringify(result.body));
    assert.equal(result.body.success, true);
    assert.equal(result.body.minigame.completed, true);
    const replay = await request('POST', '/v1/crimes/pick', token, body, key);
    assert.equal(replay.code, 200);
    assert.equal(replay.body.take, result.body.take, 'idempotent retries return the original crime receipt');
    await app.pool.query('UPDATE characters SET street_action_at=$2 WHERE id=$1', [actor.id, new Date(Date.now() - 1000)]);
    assert.equal((await request('POST', '/v1/crimes/pick', token, body)).body.error, 'stale_crime_minigame');
    await reset();
    const turn = (await request('GET', '/v1/agent/turn', token)).body;
    const action = turn.actions.find((entry) => entry.kind === 'crime');
    assert(action, 'the turn exposes an eligible crime');
    assert.equal(action.minigame.required, true);
    const noPuzzle = await request('POST', '/v1/agent/act', token, { turnId: turn.turnId, actionId: action.id });
    assert.equal(noPuzzle.body.error, 'crime_minigame_required', 'Agent Act cannot bypass the required minigame');
    const agentPuzzle = (await request('GET', action.minigame.challengePath, token)).body.minigame;
    const agentResult = await request('POST', '/v1/agent/act', token, { turnId: turn.turnId, actionId: action.id, minigame: answer(agentPuzzle) });
    assert.equal(agentResult.code, 200, JSON.stringify(agentResult.body));
    assert.equal(agentResult.body.result.minigame.completed, true);
    console.log('crime minigame API: authenticated challenge, mandatory direct and agent enforcement, incomplete rejection without mutation, idempotent settlement and replay protection passed');
  } finally { Math.random = originalRandom; await app.close(); }
}
