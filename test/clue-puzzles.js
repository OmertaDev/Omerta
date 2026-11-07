import assert from 'node:assert/strict';
import { clueStepOf, CLUES, cityHourOf } from '../src/rules.js';
import { cluePuzzleOf, isStructuredClueSalt, newClueSalt, publicCluePuzzle } from '../src/clue-puzzles.js';
import { buildServer } from './server-fixture.js';
import { systemEligibility } from '../src/explore.js';

process.env.MOD_KEY = 'test-clue-puzzles';
process.env.CLUE_RELIC_P = '0';
const kinds = new Set();
for (let index = 0; index < 120; index++) {
  for (let step = 1; step <= 7; step++) {
    const legacySalt = `legacy-${index}`;
    assert.deepEqual(cluePuzzleOf(legacySalt, step), clueStepOf(legacySalt, step), 'stored legacy scrolls retain their exact puzzle');
    const salt = `trail-v2:test-${index}`, puzzle = cluePuzzleOf(salt, step);
    assert.deepEqual(puzzle, cluePuzzleOf(salt, step), 'new puzzles are deterministic');
    assert.equal(puzzle.district, clueStepOf(salt, step).district);
    assert.deepEqual(puzzle.window, clueStepOf(salt, step).window, 'the existing time-window derivation is conserved');
    assert.equal(puzzle.choices.length, 3);
    assert.equal(new Set(puzzle.choices.map((choice) => choice.id)).size, 3);
    assert.equal(puzzle.choices.filter((choice) => choice.id === puzzle.answerId).length, 1);
    const publicPuzzle = publicCluePuzzle(puzzle);
    assert.doesNotMatch(JSON.stringify(publicPuzzle), /"(?:answerId|district|window|salt)"/);
    kinds.add(puzzle.kind);
    // Independently solve each generated presentation rather than trusting the
    // private answer field or merely checking that it appears among choices.
    let candidates;
    if (puzzle.kind === 'surveillance') {
      const [, startHour, startMinute, endHour, endMinute] = puzzle.prompt.match(/from (\d+):(\d+) to (\d+):(\d+)/);
      const start = Number(startHour) * 60 + Number(startMinute), end = Number(endHour) * 60 + Number(endMinute);
      candidates = puzzle.choices.filter((choice) => {
        const observation = puzzle.observations.find((text) => text.startsWith(choice.label));
        const [, arrivalHour, arrivalMinute, departureHour, departureMinute] = observation.match(/at (\d+):(\d+) and left at (\d+):(\d+)/);
        return Number(arrivalHour) * 60 + Number(arrivalMinute) <= start && Number(departureHour) * 60 + Number(departureMinute) >= end;
      });
    } else if (puzzle.kind === 'route') {
      const constraints = puzzle.observations.map((text) => text.match(/from (.+) was issued before the receipt from (.+)\./).slice(1));
      candidates = puzzle.choices.filter((choice) => constraints.every(([before, after]) => {
        const route = choice.label.split(' → '); return route.indexOf(before) < route.indexOf(after);
      }));
    } else if (puzzle.kind === 'landmark') {
      const [, color, mark] = puzzle.observations[0].match(/records (\w+) paint and a (\w+) mark/);
      candidates = puzzle.choices.filter((choice) => choice.label.includes(`${color} paint, ${mark} mark`));
    } else {
      const claims = puzzle.observations.map((text) => text.match(/says: “(.+) carried/)[1]);
      candidates = puzzle.choices.filter((choice) => claims.filter((claim) => claim === choice.label).length === 1);
    }
    assert.equal(candidates.length, 1, `${puzzle.kind} has one independently verifiable solution`);
    assert.equal(candidates[0].id, puzzle.answerId);
  }
  assert.equal(new Set([1, 2, 3, 4].map((step) => cluePuzzleOf(`trail-v2:test-${index}`, step).kind)).size, 4, 'every four-step trail uses all four mechanics');
}
assert.equal(kinds.size, 4);
assert(isStructuredClueSalt(newClueSalt()));
assert.equal(publicCluePuzzle(cluePuzzleOf('legacy', 1)), null);
const readiness = (scroll) => systemEligibility({ eligibility: 'clue' },
  { ch: { energy: CLUES.DIG_ENERGY }, acct: {}, owned: {}, live: { clueBoard: { scroll } } });
assert.equal(readiness({ riddle: 'Legacy scroll' }).operation, 'clue:dig');
assert.equal(readiness({ interaction: publicCluePuzzle(cluePuzzleOf('trail-v2:readiness', 1)) }).operation, 'clue:answer');

const app = await buildServer();
const pool = app.pool;
const request = async (method, url, token, body) => {
  const reply = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  return { status: reply.statusCode, body: reply.json() };
};
const privateFree = (value) => assert.doesNotMatch(JSON.stringify(value), /"(?:answerId|district|salt)"/);
let openSalt, closedSalt;
for (let index = 0; index < 5000 && (!openSalt || !closedSalt); index++) {
  const salt = `trail-v2:api-${index}`;
  const steps = [1, 2, 3, 4].map((step) => cluePuzzleOf(salt, step));
  if (!openSalt && steps.every((step) => !step.window)) openSalt = salt;
  const first = steps[0], hour = cityHourOf().hour;
  if (!closedSalt && first.window && (hour < first.window.lo || hour > first.window.hi)) closedSalt = salt;
}
assert(openSalt && closedSalt);
try {
  const { body: { token } } = await request('POST', '/v1/auth/guest');
  await request('POST', '/v1/character', token, { name: 'Clue Puzzle Reader' });
  const ch = (await pool.query("SELECT * FROM characters WHERE name='Clue Puzzle Reader'")).rows[0];
  await pool.query('UPDATE characters SET energy=200 WHERE id=$1', [ch.id]);
  await pool.query("INSERT INTO clue_scrolls (character_id,salt,step,steps,tier) VALUES ($1,$2,1,4,'easy')", [ch.id, openSalt]);
  assert.equal((await request('POST', '/v1/clues/answer', null, { step: 1, answerId: 'a'.repeat(20) })).status, 401);
  let board = await request('GET', '/v1/clues', token);
  assert.equal(board.status, 200);
  assert.equal(board.body.scroll.interaction.version, 2);
  privateFree(board.body);
  const first = cluePuzzleOf(openSalt, 1), valid = { step: 1, answerId: first.answerId };
  for (const bad of [{ ...valid, accountId: 'foreign' }, { ...valid, step: '1' }, { ...valid, answerId: 'unknown' }, { ...valid, step: 0 }]) {
    assert.equal((await request('POST', '/v1/clues/answer', token, bad)).body.error, 'bad_clue_answer');
  }
  assert.equal((await request('POST', '/v1/clues/dig', token, {})).body.error, 'clue_answer_required');
  assert.equal((await request('POST', '/v1/clues/answer', token, { ...valid, answerId: '0'.repeat(20) })).body.error, 'stale_clue_answer');
  await pool.query('UPDATE characters SET loc=$2,energy=200 WHERE id=$1', [ch.id, first.district === 'docks' ? 'canal' : 'docks']);
  let result = await request('POST', '/v1/clues/answer', token, valid);
  assert.equal(result.body.cold, true);
  assert.equal(Number((await pool.query('SELECT step FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0].step), 1);
  await pool.query('UPDATE characters SET loc=$2,energy=200 WHERE id=$1', [ch.id, first.district]);
  result = await request('POST', '/v1/clues/answer', token, { step: 1, answerId: first.choices.find((choice) => choice.id !== first.answerId).id });
  assert.equal(result.body.cold, true);
  privateFree(result.body);
  assert.equal(Number((await pool.query('SELECT energy FROM characters WHERE id=$1', [ch.id])).rows[0].energy), 200 - CLUES.DIG_ENERGY);
  // Timed v2 clues enforce the same authoritative city-hour window.
  const closed = cluePuzzleOf(closedSalt, 1);
  await pool.query('UPDATE clue_scrolls SET salt=$2 WHERE character_id=$1', [ch.id, closedSalt]);
  await pool.query('UPDATE characters SET loc=$2,energy=200 WHERE id=$1', [ch.id, closed.district]);
  result = await request('POST', '/v1/clues/answer', token, { step: 1, answerId: closed.answerId });
  assert.equal(result.body.cold, true);
  assert.match(result.body.hint, /wrong hour/);
  await pool.query('UPDATE clue_scrolls SET salt=$2 WHERE character_id=$1', [ch.id, openSalt]);
  const cashBefore = Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [ch.id])).rows[0].cash);
  for (let step = 1; step <= 4; step++) {
    const puzzle = cluePuzzleOf(openSalt, step);
    await pool.query('UPDATE characters SET loc=$2,energy=200 WHERE id=$1', [ch.id, puzzle.district]);
    result = await request('POST', '/v1/clues/answer', token, { step, answerId: puzzle.answerId });
    assert.equal(result.status, 200, JSON.stringify(result.body));
    assert.equal(result.body.ok, true);
    privateFree(result.body);
    if (step < 4) {
      assert.equal(result.body.step, step + 1);
      assert(result.body.interaction);
      assert.equal((await request('POST', '/v1/clues/answer', token, { step, answerId: puzzle.answerId })).body.error, 'stale_clue_answer');
    }
  }
  assert.equal(result.body.casket, true);
  const tier = CLUES.TIERS.find((item) => item.id === 'easy');
  assert(result.body.take >= tier.casketMin && result.body.take <= tier.casketMax);
  const after = (await pool.query('SELECT cash,clue_at FROM characters WHERE id=$1', [ch.id])).rows[0];
  assert.equal(Number(after.cash) - cashBefore, result.body.take);
  const remaining = new Date(after.clue_at).getTime() - Date.now();
  assert(remaining <= CLUES.CLUE_CD_MS && remaining >= CLUES.CLUE_CD_MS - 10000, 'existing casket cooldown is unchanged');
  assert.equal(Number((await pool.query('SELECT caskets FROM account_persistent WHERE account_id=$1', [ch.account_id])).rows[0].caskets), 1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0].n), 0);
  assert.equal((await request('POST', '/v1/clues/answer', token, { step: 4, answerId: cluePuzzleOf(openSalt, 4).answerId })).body.error, 'no_scroll');
  process.env.CLUE_DROP_P = '1';
  let dropped;
  for (let attempt = 0; attempt < 20 && !dropped; attempt++) {
    await pool.query('UPDATE characters SET clue_at=NULL,nerve=50,energy=200,jail_until=NULL,street_action_at=NULL WHERE id=$1', [ch.id]);
    const crime = await request('POST', '/v1/crimes/pick', token, {});
    assert.equal(crime.status, 200);
    if (crime.body.success && crime.body.clue) dropped = crime.body.clue;
  }
  assert(dropped, 'a successful forced-drop crime issues a structured scroll');
  const issued = (await pool.query('SELECT salt FROM clue_scrolls WHERE character_id=$1', [ch.id])).rows[0];
  assert(isStructuredClueSalt(issued.salt), 'new issuance activates v2 without migrating existing salts');
  assert.equal(dropped.riddle, cluePuzzleOf(issued.salt, 1).riddle);
  console.log('clue puzzles: legacy preservation, four deterministic solvable mechanics, hidden answers, strict API, stale guards, geography, timing and unchanged casket economics passed');
} finally { await app.close(); }
