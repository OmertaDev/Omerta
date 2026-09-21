import assert from 'node:assert/strict';
import { NPC_CAR_SQL as SQL, NPC_CAR_SOURCE_PINS, assertNpcCarSources, verifyNpcCarAcquisition,
  createNpcCarAcquisitionCommitObserver } from '../tools/rc1-npc-car-acquisition.js';
import { reconcileCarResources } from '../tools/rc1-car-journal.js';
import { PACING, rollRarity } from '../src/rules.js';
const sites = assertNpcCarSources(), at = Date.parse('2026-09-20T12:00:00Z'), roll = 0.42, rarity = rollRarity(roll);
const character = { id: 'npc', account_id: 'npc-account', name: 'Native fixture', is_npc: true, alive: true,
  season: 1, respect: PACING.LEVEL_DIVISOR * 11 ** 2, cash: 4000, muscle: 15, cunning: 15, speed: 15, loc: 'docks' };
const car = { id: 'npc-car', character_id: character.id, model_id: 'garden', trim_id: 'stock', dmg: 18, rarity,
  listed: false, pledged: false, minted_onchain: false, pink_slip: false, run_id: null, serial: null,
  race_limit: null, plate: null, tune: 0, nos: 0, created_at: new Date(at).toISOString() };
const origin = line => ({ kind: 'native-stack-source-site-v1', frames: [
  { file: 'src/population.js', caller: 'spawnResident', line, column: 20 },
  { file: 'src/population.js', caller: 'runPopulation', line: sites.defaultCall, column: 26 },
] });
const statements = [
  ['BEGIN', []], [SQL.account, ['npc-account', 'npc', 'npc:npc-account']], [SQL.persistent, ['npc-account']],
  [SQL.character, ['npc', 'npc-account', character.name, 1, character.respect, 4000, 15, 15, 15, 'docks']],
  [SQL.car, ['npc-car', 'npc', 'garden', 'stock', 18, rarity]],
  [SQL.grant, ['grant', 'npc', 'npc:car', 'grant']], [SQL.rarity, ['rarity', 'npc', 'rarity:car', roll, rarity]], ['COMMIT', []],
];
const trace = { format: 1, boundary: { outcome: 'COMMITTED', transactionId: 1 }, unsupported: null,
  extensions: { npcCarAcquisition: { format: 1, sourcePins: NPC_CAR_SOURCE_PINS } },
  queries: statements.map(([sql, parameters]) => ({ sql, parameters, command: sql.split(' ')[0], rowCount: sql.startsWith('INSERT') ? 1 : null,
    rows: [], logicalAt: at, origin: origin(sql === SQL.car ? sites.carInsert : 100) })) };
const before = { tables: Object.fromEntries(['cars', 'characters', 'account_persistent', 'rng_audit', 'transactions', 'item_events', 'item_mutation_guards', 'market_listings'].map(t => [t, []])) };
const after = structuredClone(before);
after.tables.cars = [car]; after.tables.characters = [character]; after.tables.account_persistent = [{ account_id: 'npc-account', npc_flag: true }];
after.tables.rng_audit = [{ id: 'grant', character_id: 'npc', action: 'npc:car', roll: 0, outcome: 'grant' },
  { id: 'rarity', character_id: 'npc', action: 'rarity:car', roll, outcome: rarity }];
assert.equal(verifyNpcCarAcquisition(before, after, trace).carId, car.id);
const exact = reconcileCarResources(before, after, { carAcquisitionProvenance: trace });
assert.equal(exact.fullyClassifiedChanges, 1); assert.equal(exact.unsupported.length, 0);
assert(reconcileCarResources(before, after).unsupported.some(u => u.kind === 'car-acquisition-identity-provenance'));
let rejected = 0;
function rejects(edit, pattern) {
  const input = JSON.parse(JSON.stringify({ before, after, trace })); edit(input);
  assert.throws(() => verifyNpcCarAcquisition(input.before, input.after, input.trace), pattern); rejected++;
}
rejects(({ trace: t }) => t.extensions.npcCarAcquisition.sourcePins['src/population.js'] = 'wrong', /source extension/);
rejects(({ trace: t }) => t.boundary.outcome = 'ROLLED_BACK', /COMMITTED/);
rejects(({ trace: t }) => t.queries.pop(), /COMMIT/);
rejects(({ trace: t }) => t.queries[4].parameters[0] = 'uncommitted-car', /missing or duplicated/);
rejects(({ trace: t }) => t.queries[4].parameters[1] = 'other-owner', /strictly equal/);
rejects(({ trace: t }) => t.queries[4].rowCount = 0, /exactly one/);
rejects(({ trace: t }) => t.queries[4].origin.frames[0].line++, /origin site/);
rejects(({ trace: t }) => t.queries[5].parameters[0] = 'uncommitted-grant', /missing or duplicated/);
rejects(({ trace: t }) => t.queries[5].parameters[1] = 'other-owner', /deep-equal/);
rejects(({ trace: t }) => t.queries[6].parameters[3] = 1.1, /observed rarity roll/);
rejects(({ after: a }) => a.tables.rng_audit[1].roll = '0.2', /receipt differs/);
rejects(({ after: a }) => a.tables.rng_audit[0].outcome = 'retire', /receipt differs/);
rejects(({ after: a }) => a.tables.cars[0].model_id = 'junker', /differs from executed/);
rejects(({ after: a }) => a.tables.cars[0].dmg++, /differs from executed/);
rejects(({ after: a }) => a.tables.cars[0].listed = true, /differs from executed/);
rejects(({ after: a }) => a.tables.cars[0].run_id = 'invented-run', /differs from executed/);
rejects(({ after: a }) => a.tables.cars[0].created_at = new Date(at + 1).toISOString(), /differs from executed/);
rejects(({ after: a }) => a.tables.characters[0].is_npc = false, /strictly equal/);
rejects(({ before: b }) => b.tables.cars.push(car), /preexisting/);
rejects(({ trace: t }) => t.queries.splice(5, 0, t.queries[5]), /duplicate original NPC query/);
let unknown = 0;
for (const edit of [t => delete t.extensions, t => t.unsupported = 'bounded-trace-overflow',
  t => delete t.queries[4].origin, t => t.queries[4].origin.frames[1].line++,
  t => t.queries[4].sql = 'INSERT INTO cars VALUES($1)', t => t.queries.splice(4, 0, t.queries[4]),
  t => t.queries.splice(2, 0, { command: 'SAVEPOINT' })]) {
  const t = structuredClone(trace); edit(t); assert.equal(verifyNpcCarAcquisition(before, after, t), null); unknown++;
}
// Native collector lifecycle controls use a synthetic driver. A rollback never
// issues a witness, and a copied INSERT outside runPopulation cannot gain origin.
let witness;
const observer = createNpcCarAcquisitionCommitObserver({ onBoundary: async (event, value) => { witness = value; } });
const query = observer.wrapQuery({}, async sql => ({ command: sql.split(' ')[0], rowCount: 1, rows: [] }));
observer.arm(); await query('BEGIN'); await query(SQL.car, statements[4][1]); await query('ROLLBACK'); assert.equal(witness, null);
await query('BEGIN'); await query(SQL.car, statements[4][1]); await query('COMMIT');
assert(witness.extensions.npcCarAcquisition); assert.equal(witness.queries[1].origin, undefined);
assert.equal(verifyNpcCarAcquisition(before, after, witness), null); observer.assertComplete(); observer.disarm();
console.log(JSON.stringify({ status: 'PASS', rejected, unsupportedControls: unknown, collectorControls: ['rollback-no-witness', 'copied-SQL-no-spawn-origin'],
  priorUninstrumentedUnknown: true, scope: 'Synthetic controls; actual original-worker acquisition requires the native proof.' }));
