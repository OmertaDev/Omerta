// Scoped native daily-cap proof. Domain transactions are real; this is not an
// HTTP idempotency or full-worker simulation (those have separate proof runners).
import assert from 'node:assert/strict';
import path from 'node:path';
import { commandDatabase, addPlayer } from './lib/player-command-support.js';
import { installSerialRuntime, serialDatabaseOptions } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { equation, exactSum, addedRows } from '../tools/rc1-resource-journal.js';
import { verifyLedgerChecks } from '../tools/rc1-sim.js';
import { withCharacter, withCharacterRead, travel } from '../src/game.js';
import { shipmentBoard, takeShipment } from '../src/shipment.js';
import { SHIPMENT, dayOf, shipmentDistrictOf, shipmentCityCap } from '../src/rules.js';
import { runLedgerInvariants } from '../src/invariants.js';

assert(process.argv.includes('--postgres'), 'This proof requires real PostgreSQL');
const output = process.env.RC1_SHIPMENT_OUTPUT;
assert(output, 'Set RC1_SHIPMENT_OUTPUT to a new restricted directory outside the checkout');
const source = await sourceIdentity(), population = 18, seed = 'rc1-shipment-midnight-v1';
const epoch = '2026-09-20T23:59:59.999Z', epochMs = Date.parse(epoch);
const proof = await createProofRecorder({ directory: path.resolve(output), source, runId: 'shipment-boundaries', seed,
  scenarioId: 'scoped-shipment-two-midnights', population, configuration: { epoch, population, seed,
    authority: 'Unmodified withCharacter/withCharacterRead, shipmentBoard, takeShipment and travel',
    clock: 'Test application Date and isolated PostgreSQL transaction/statement clocks advance together',
    entryMode: 'Declared accounts with schema defaults plus 100000 cash, 10000 respect and 50 physical stats',
    workers: 'No background worker executes; no full-world or rollover claim',
    identity: 'Each domain invocation is recorded; HTTP receipt replay is covered by the separate resource runner' } });
const runtime = installSerialRuntime(seed, epoch);
let logicalTime = epochMs, db, pool, baseline, sequence = 0, result, canonicalCalls = 0;
runtime.bindClock(() => logicalTime);
const actors = Array.from({ length: population }, (_, index) => `shipment-boundary-${index}`);
const checks = [];
const readState = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const state = {};
    for (const [name, sql] of Object.entries({
      characters: 'SELECT id,account_id,alive,cash::text,shipment FROM characters ORDER BY id',
      days: 'SELECT * FROM shipment_days ORDER BY day',
      takes: 'SELECT * FROM shipment_takes ORDER BY day,character_id',
      transactions: 'SELECT id,character_id,currency,amount::text,reason FROM transactions ORDER BY id',
    })) state[name] = (await client.query(sql)).rows;
    const clock = (await client.query('SELECT now() AS transaction,clock_timestamp() AS statement')).rows[0];
    assert.equal(clock.transaction.getTime(), logicalTime);
    assert.equal(clock.statement.getTime(), logicalTime);
    await client.query('COMMIT');
    return state;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
async function observe(label, work, expectedGrant = 0) {
  const before = await readState();
  const value = await proof.invoke('canonical-domain-transaction', label, async () => { canonicalCalls++; return work(); });
  const after = await readState(), receipts = addedRows(before.transactions, after.transactions);
  const movements = [equation({ resource: 'shipment-material', owner: 'all-living-characters',
    before: exactSum(before.characters.filter((row) => row.alive).map((row) => row.shipment)),
    after: exactSum(after.characters.filter((row) => row.alive).map((row) => row.shipment)), created: expectedGrant,
    authority: expectedGrant ? [{ rule: 'SHIPMENT.PER_PLAYER within stamped daily city cap', day: dayOf(),
      takes: after.takes.filter((row) => row.day === dayOf()) }] : [{ rule: 'Read, travel or rejected take creates no material' }] })];
  for (const ch of after.characters) {
    const prior = before.characters.find((row) => row.id === ch.id); assert(prior);
    movements.push(equation({ resource: 'shipment-material', owner: ch.id, before: prior.shipment, after: ch.shipment,
      created: ch.id === value?.character?.id ? expectedGrant : 0,
      authority: [{ rule: expectedGrant ? 'Only the canonical take recipient receives the granted material' : 'No material change permitted' }] }));
    const entries = receipts.filter((row) => row.character_id === ch.id && row.currency === 'cash');
    assert.equal(exactSum([ch.cash, `-${prior.cash}`]), exactSum(entries.map((row) => row.amount)), 'Cash change lacks canonical ledger receipt');
  }
  for (const day of after.days) {
    assert(day.taken <= day.cap && day.taken >= 0);
    assert.equal(day.cap, shipmentCityCap(Number(day.pop)));
    const takes = after.takes.filter((row) => row.day === day.day);
    assert(takes.every((row) => row.n > 0 && row.n <= SHIPMENT.PER_PLAYER));
    assert.equal(exactSum(takes.map((row) => row.n)), String(day.taken));
  }
  const invariants = verifyLedgerChecks(baseline, await runLedgerInvariants(pool, { alert: false }), population);
  await proof.record({ kind: 'resource-boundary', label, logicalTime: new Date().toISOString(), before, after, receipts, movements, invariants });
  await proof.snapshot(pool, `boundary-${++sequence}`);
  checks.push(label); return value;
}
const take = (actor) => withCharacter(pool, actor, takeShipment);
const board = (actor) => withCharacterRead(pool, actor, shipmentBoard);
async function refusal(actor, code) {
  let caught;
  try { await take(actor); } catch (error) { caught = error; }
  assert(caught, `Expected ${code} refusal`); assert.equal(caught.code, code);
  return { refused: code };
}
async function emptyDay(label) {
  const cap = shipmentCityCap(population);
  assert.equal(cap % SHIPMENT.PER_PLAYER, 0, 'Adapt this workload if the legal population cap changes');
  assert(cap / SHIPMENT.PER_PLAYER < population, 'The city-cap probe needs an actor who has not taken material today');
  for (const actor of actors.slice(0, cap / SHIPMENT.PER_PLAYER)) {
    // Policy uses the actor's canonical authorized board to choose its district.
    const view = await observe(`${label}:board:${actor}`, () => board(actor));
    if (!view.here) await observe(`${label}:travel:${actor}`, () => withCharacter(pool, actor,
      (ch, client, hooks) => travel(ch, view.district, client, hooks)));
    const response = await observe(`${label}:take:${actor}`, () => take(actor), SHIPMENT.PER_PLAYER);
    assert.equal(response.took, SHIPMENT.PER_PLAYER);
  }
  await observe(`${label}:same-player-cap`, () => refusal(actors[0], 'taken'));
  const spare = actors.at(-1), view = await observe(`${label}:spare-board`, () => board(spare));
  if (!view.here) await observe(`${label}:spare-travel`, () => withCharacter(pool, spare,
    (ch, client, hooks) => travel(ch, view.district, client, hooks)));
  await observe(`${label}:city-exhausted`, () => refusal(spare, 'gone'));
}
try {
  db = await commandDatabase('shipment_boundary', serialDatabaseOptions()); pool = db.pool;
  for (const actor of actors) await addPlayer(pool, actor, actor, shipmentDistrictOf());
  baseline = await runLedgerInvariants(pool, { alert: false });
  verifyLedgerChecks(baseline, baseline, population);
  await proof.record({ kind: 'initialization', actors, entryMode: 'fixture-assisted',
    grant: { cash: 100000, respect: 10000, muscle: 50, cunning: 50, speed: 50 },
    shipmentGrant: 0, location: shipmentDistrictOf(), schemaDefaultsRetained: true });
  await proof.snapshot(pool, 'initial');
  const firstDay = dayOf();
  await emptyDay('one-ms-before-midnight');
  const exhausted = (await readState()).days;
  logicalTime++;
  assert.equal(dayOf(), firstDay + 1);
  await proof.record({ kind: 'clock-advance', milliseconds: 1, logicalTime: new Date().toISOString(),
    authority: 'Test clock only; no deadline, status, balance or cap row rewritten' });
  const newBoard = await observe('midnight:authorized-board', () => board(actors[0]));
  assert.equal(newBoard.yourTakeToday, 0); assert.equal(newBoard.cityLeft, shipmentCityCap(population));
  assert.deepEqual((await readState()).days, exhausted, 'Board read must not materialize the new day');
  await emptyDay('at-midnight');
  assert.deepEqual((await readState()).days.filter((row) => row.day === firstDay), exhausted, 'New day must not change yesterday');
  await pool.end(); pool = db.reopen();
  await observe('restart:today-cap-persists', () => refusal(actors[0], 'taken'));
  await observe('restart:city-cap-persists', () => refusal(actors.at(-1), 'gone'));
  logicalTime += 86400000;
  await proof.record({ kind: 'clock-advance', milliseconds: 86400000, logicalTime: new Date().toISOString(),
    authority: 'Test clock only; no worker interval coverage claimed' });
  await emptyDay('second-midnight');
  const final = await proof.snapshot(pool, 'final');
  await proof.record({ kind: 'random-decisions', tape: runtime.tape });
  result = { status: 'PASS_SCOPED', logicalDurationMs: logicalTime - epochMs, midnightBoundaries: 2,
    population, activeActors: shipmentCityCap(population) / SHIPMENT.PER_PLAYER + 1, canonicalCalls,
    observedBoundaries: checks.length, checks,
    finalStateSha256: final.stateSha256, invariants: verifyLedgerChecks(baseline, await runLedgerInvariants(pool, { alert: false }), population),
    exclusions: ['No HTTP receipt/key replay in this runner', 'No recorded concurrent boundary race',
      'No shipment loot branch', 'No complete worker schedule, simulation matrix or deployment attestation'] };
} catch (error) {
  await proof.record({ kind: 'failure', message: error.message, stack: error.stack });
  if (pool) await proof.snapshot(pool, 'failure-state');
  result = { status: 'FAIL', canonicalCalls, checks, error: error.message };
  process.exitCode = 1;
} finally {
  if (db) await db.cleanup(pool);
  runtime.restore();
  const record = await proof.finish(result);
  await verifyArtifactIndex(path.resolve(output), record);
}
console.log(JSON.stringify({ status: result.status, source: source.revision, checks: checks.length,
  midnightBoundaries: result.midnightBoundaries, matrixQualifying: false }));
