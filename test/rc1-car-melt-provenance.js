import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createCarMeltCommitObserver, verifySoloCarMelt, CAR_MELT_SOURCE_PINS } from '../tools/rc1-car-melt-provenance.js';
import { carMelt } from '../src/rules.js';

const source = fs.readFileSync(new URL('../src/game.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const bulk = source.match(/const bulk = await client\.query\(`([\s\S]*?)`,\s*\[ch\.id, ch\.account_id, today\]\)/)[1];
const persist = (table, name, key) => {
  const cols = [...source.match(new RegExp('export const ' + name + '_PERSIST_COLUMNS = \\[([\\s\\S]*?)\\];'))[1].matchAll(/\['([^']+)'/g)].map(m => m[1]);
  return 'UPDATE ' + table + ' SET ' + cols.map((c, i) => c + '=$' + (i + 2)).join(', ') + ' WHERE ' + key + '=$1';
};
const ch = { id: 'person', account_id: 'account', is_npc: false, alive: true, ammo: 10 };
const acct = { account_id: 'account', staked: '0', made_until: null, stake_lock_until: null, stake_lock_mult: 1 };
const car = { id: 'car', character_id: ch.id, model_id: 'junker', trim_id: 'stock', dmg: 20,
  run_id: null, listed: false, pledged: false, minted_onchain: false };
const rounds = carMelt(car.model_id, car.trim_id, car.dmg);
const receipt = { id: 'receipt', character_id: ch.id, account_id: null, currency: 'ammo', amount: rounds, reason: 'melt', counterparty: null };
const before = { tables: { characters: [ch], account_persistent: [acct], cars: [car], transactions: [], gang_members: [] } };
const after = structuredClone(before); after.tables.cars = []; after.tables.characters[0].ammo += rounds; after.tables.transactions = [receipt];
const entries = [
  ['BEGIN', [], 'BEGIN', null, []],
  ['SELECT * FROM characters WHERE account_id = $1 AND alive FOR UPDATE', [ch.account_id], 'SELECT', 1, [ch]],
  ['SELECT * FROM account_persistent WHERE account_id = $1 FOR UPDATE', [ch.account_id], 'SELECT', 1, [acct]],
  [bulk, [ch.id, ch.account_id, '2026-09-20'], 'SELECT', 0, []],
  ['SELECT * FROM cars WHERE character_id=$1 ORDER BY created_at', [ch.id], 'SELECT', 1, [car]],
  ['DELETE FROM cars WHERE id=$1', [car.id], 'DELETE', 1, []],
  ['INSERT INTO transactions (id, character_id, account_id, currency, amount, reason, counterparty) VALUES ($1,$2,$3,$4,$5,$6,$7)',
    [receipt.id, ch.id, null, 'ammo', rounds, 'melt', null], 'INSERT', 1, []],
  [persist('characters', 'CHARACTER', 'id'), [ch.id], 'UPDATE', 1, []],
  ['DELETE FROM stash WHERE character_id=$1', [ch.id], 'DELETE', 0, []],
  ['DELETE FROM makings WHERE character_id=$1', [ch.id], 'DELETE', 0, []],
  [persist('account_persistent', 'ACCOUNT', 'account_id'), [ch.account_id], 'UPDATE', 1, []],
  ['COMMIT', [], 'COMMIT', null, []],
];
const trace = { format: 1, sourcePins: CAR_MELT_SOURCE_PINS, boundary: { transactionId: 1, outcome: 'COMMITTED' }, unsupported: null,
  queries: entries.map(([sql, parameters, command, rowCount, rows]) => ({ sql, parameters, command, rowCount, rows, logicalAt: 1 })) };
assert.equal(verifySoloCarMelt(before, after, trace).rounds, rounds);
assert.equal(verifySoloCarMelt(before, after, null), null);
let controls = 0;
function rejects(edit, pattern) {
  const input = JSON.parse(JSON.stringify({ before, after, trace })); edit(input);
  assert.throws(() => verifySoloCarMelt(input.before, input.after, input.trace), pattern); controls++;
}
rejects(({ trace: t }) => t.sourcePins['src/game.js'] = 'wrong', /source pins/);
rejects(({ trace: t }) => t.boundary.outcome = 'ROLLED_BACK', /not committed/);
rejects(({ trace: t }) => t.queries.pop(), /COMMIT/);
rejects(({ trace: t }) => t.queries[5].parameters[0] = 'other-car', /absent/);
rejects(({ trace: t }) => t.queries[5].rowCount = 0, /exactly one/);
rejects(({ trace: t }) => t.queries[6].parameters[4]++, /yield\/owner/);
rejects(({ trace: t }) => t.queries[6].parameters[0] = 'another-receipt', /Missing or duplicate/);
rejects(({ after: a }) => a.tables.transactions[0].amount++, /receipt mismatch/);
rejects(({ after: a }) => a.tables.characters[0].ammo++, /ammo delta/);
rejects(({ before: b }) => b.tables.cars[0].dmg++, /read differs/);
rejects(({ trace: t }) => t.queries[4].rows[0].character_id = 'other', /another owner/);
rejects(({ trace: t }) => t.queries[6].logicalAt++, /clock boundary/);
rejects(({ trace: t }) => t.queries.splice(2, 0, t.queries[2]), /ambiguous/);
rejects(({ after: a }) => a.tables.cars.push({ ...car, id: 'new' }), /Compound car/);
rejects(({ after: a }) => a.tables.gang_members.push({ character_id: ch.id }), /Family membership/);
for (const edit of [
  t => t.unsupported = 'bounded-trace-overflow',
  t => t.queries[1].rows[0].is_npc = true,
  t => t.queries[3].rows.push({ src: 'gm', k: 'family' }),
  t => t.queries[3].rows.push({ src: 'sk', k: 'fence_network' }),
  t => t.queries[2].rows[0].staked = 100,
  t => t.queries[4].rows[0].run_id = 'limited',
  t => t.queries.splice(-1, 0, { sql: 'UPDATE gangs SET ammo_bank=ammo_bank+1', parameters: [], command: 'UPDATE', rowCount: 1, rows: [], logicalAt: 1 }),
  t => t.queries.splice(-1, 0, { ...t.queries[5] }),
  t => t.queries.splice(5, 0, { sql: 'SAVEPOINT p', command: 'SAVEPOINT' }),
]) { const t = structuredClone(trace); edit(t); assert.equal(verifySoloCarMelt(before, after, t), null); controls++; }

// Actual composition ordering and defensive copies. Synthetic driver control,
// explicitly not a native execution proof (the companion PG test provides it).
let recorded, duringBoundary = false, index = 0;
const observer = createCarMeltCommitObserver({ onBoundary: async (b, p) => { recorded = p; duringBoundary = true; } });
const query = observer.wrapQuery({}, async () => {
  const e = entries[index++]; return { command: e[2], rowCount: e[3], rows: structuredClone(e[4]) };
});
observer.arm();
for (const e of entries) {
  const result = await query(e[0], e[1]);
  if (result.rows[0]) result.rows[0].callerMutated = true;
}
assert(duringBoundary); assert(recorded); assert(!recorded.queries.some(e => e.rows.some(r => r.callerMutated)));
assert.equal(recorded.queries.at(-1).command, 'COMMIT'); observer.assertComplete(); observer.disarm();
const overflow = createCarMeltCommitObserver({ maxQueries: 1, onBoundary: async (b, p) => { recorded = p; } });
const oq = overflow.wrapQuery({}, async sql => ({ command: sql, rowCount: null, rows: [] })); overflow.arm();
await oq('BEGIN'); await oq('COMMIT'); assert.equal(recorded.unsupported, 'bounded-trace-overflow'); overflow.disarm();
const rollback = createCarMeltCommitObserver({ onBoundary: async (b, p) => { recorded = p; } });
const rq = rollback.wrapQuery({}, async sql => ({ command: sql, rowCount: null, rows: [] })); rollback.arm();
await rq('BEGIN'); await rq('ROLLBACK'); assert.equal(recorded, null); rollback.disarm();
console.log(JSON.stringify({ status: 'PASS', controls, collectorControls: ['native-return-before-boundary', 'caller-mutation-copy', 'overflow-remains-unknown', 'rollback-no-witness'] }));
