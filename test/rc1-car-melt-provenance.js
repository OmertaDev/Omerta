import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createCarMeltCommitObserver, verifySoloCarMelt, CAR_MELT_SOURCE_PINS, CAR_MELT_BASELINE_RULES_PIN,
  CAR_MELT_SOURCE_REVIEW_TRANSFER, assertCarMeltRulesCompatibility } from '../tools/rc1-car-melt-provenance.js';
import { GOODS_SOURCE_CURRENT_PINS, GOODS_SOURCE_PREDECESSOR_PINS, GOODS_SOURCE_REVIEWED_REVISION,
  GOODS_SOURCE_PREDECESSOR_REVISION, ECONOMY_SOURCE_CURRENT_PINS, assertGoodsSourceTransfer,
  assertEconomySourceTransfer, assertDeedServerCompatibility, assertGenesisSnapshotServerCompatibility,
  assertGenesisWrapperServerCompatibility, assertHttpReceiptServerCompatibility,
  CITY_PRESENCE_SERVER_PIN, CITY_PRESENCE_SERVER_PREDECESSOR_PIN, assertCityPresenceServerTransfer } from '../tools/rc1-deed-source-compatibility.js';
import { carMelt } from '../src/rules.js';

const hash = text => createHash('sha256').update(text).digest('hex');
assert.equal(CAR_MELT_SOURCE_REVIEW_TRANSFER.predecessorEconomySha256, ECONOMY_SOURCE_CURRENT_PINS['src/economy.js']);
assert.match(CAR_MELT_SOURCE_REVIEW_TRANSFER.scope, /New goods availability, reachability, bucket\/counter accounting and authority.*outside/);
const currentSources = new Map();
for (const file of Object.keys(GOODS_SOURCE_CURRENT_PINS)) {
  const actual = fs.readFileSync(file, 'utf8').replaceAll('\r\n', '\n');
  // Goods/car history binds the reconstructed predecessor, never new City authority.
  const presence = file === 'src/server.js' ? assertCityPresenceServerTransfer(actual) : null;
  const text = presence ? presence.baselineText : actual;
  if (presence) {
    assert.equal(hash(actual), CITY_PRESENCE_SERVER_PIN);
    assert.equal(presence.baselineSha256, CITY_PRESENCE_SERVER_PREDECESSOR_PIN);
    assert.equal(presence.baselineSha256, GOODS_SOURCE_CURRENT_PINS[file]);
    assert.equal(presence.inverseChunks, 2);
  }
  const current = execFileSync('git', ['show', GOODS_SOURCE_REVIEWED_REVISION + ':' + file],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).replaceAll('\r\n', '\n');
  const previous = execFileSync('git', ['show', GOODS_SOURCE_PREDECESSOR_REVISION + ':' + file],
    { encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 }).replaceAll('\r\n', '\n');
  const proof = assertGoodsSourceTransfer(file, text);
  assert.equal(text, current, 'The goods transfer targets exact independent Git source bytes.');
  assert.equal(proof.baselineText, previous, 'Every inverse restores the complete independent Git predecessor.');
  assert.equal(hash(current), GOODS_SOURCE_CURRENT_PINS[file]);
  assert.equal(hash(previous), GOODS_SOURCE_PREDECESSOR_PINS[file]);
  assert.equal(proof.inverseChunks, file === 'src/economy.js' ? 5 : 1);
  currentSources.set(file, text);
}
const economyText = currentSources.get('src/economy.js');
const economyProof = assertEconomySourceTransfer('src/economy.js', economyText);
assert.equal(economyProof.goodsSourceTransfer.baselineSha256, ECONOMY_SOURCE_CURRENT_PINS['src/economy.js']);
assert.equal(assertEconomySourceTransfer('src/economy.js', economyProof.goodsSourceTransfer.baselineText).actualSha256,
  ECONOMY_SOURCE_CURRENT_PINS['src/economy.js'], 'The prior economy pin remains accepted by its unchanged historical guard.');
for (const [file, before, after] of [
  ['src/economy.js', "import { consumeGoodsLiquidity } from './goodsmarket.js';", "import { consumeGoodsLiquidity } from './goodsmarket.js';\nimport { consumeGoodsLiquidity } from './goodsmarket.js';"],
  ['src/economy.js', "await consumeGoodsLiquidity(client, goodId, ch.loc, 'buy', n, block)", 'Promise.resolve({})'],
  ['src/economy.js', "await consumeGoodsLiquidity(client, goodId, ch.loc, 'sell', n, block)", 'Promise.resolve({})'],
  ['src/economy.js', 'const block = priceBlock();', 'const block = priceBlock() + 1;'],
  ['src/economy.js', 'if (Number(ch.cash) < cost + fee + tax)', 'if (false)'],
  ['src/economy.js', "DELETE FROM cars WHERE id=$1", "DELETE FROM cars WHERE id<>$1"],
  ['src/goodsquote.js', 'block = priceBlock()', 'block = 0'],
  ['src/goodsquote.js', 'Math.ceil(subtotal * 0.01)', 'Math.ceil(subtotal * 0.02)'],
  ['src/server.js', 'Block.marketPrices(pool)', 'Block.marketPrices(req.query.pool)'],
  ['src/server.js', "app.get('/v1/market/prices'", "app.post('/v1/market/prices'"],
  ['src/server.js', 'await Chain.assertChainId();', 'await Promise.resolve();'],
]) {
  const text = currentSources.get(file), changed = text.replace(before, after);
  assert.notEqual(changed, text, 'Tamper control must alter actual settlement, car authority, quote or route bytes: ' + before);
  assert.throws(() => assertGoodsSourceTransfer(file, changed), /source changed/);
  if (file === 'src/economy.js') assert.throws(() => assertEconomySourceTransfer(file, changed), /source changed/);
  if (file === 'src/server.js') for (const guard of [assertDeedServerCompatibility, assertGenesisSnapshotServerCompatibility,
    assertGenesisWrapperServerCompatibility, assertHttpReceiptServerCompatibility]) assert.throws(() => guard(changed), /source changed/);
}
for (const [file, text] of currentSources) assert.throws(() => assertGoodsSourceTransfer(file, text + '\n// unsupported authority change\n'), /source changed/);

const rulesText = fs.readFileSync(new URL('../src/rules.tail.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const compatibility = assertCarMeltRulesCompatibility(rulesText);
assert.equal(compatibility.actualSha256, CAR_MELT_SOURCE_PINS['src/rules.tail.js']);
assert.equal(compatibility.baselineSha256, CAR_MELT_BASELINE_RULES_PIN);
assert.equal(assertCarMeltRulesCompatibility(compatibility.baselineText).actualSha256, CAR_MELT_BASELINE_RULES_PIN);
assert(rulesText.includes('MELT_TITHE: 0.25'), 'Negative control must locate the actual car melt rule');
assert.throws(() => assertCarMeltRulesCompatibility(rulesText.replace('MELT_TITHE: 0.25', 'MELT_TITHE: 0.26')), /source changed/);
assert.throws(() => assertCarMeltRulesCompatibility(compatibility.baselineText.replace('MELT_TITHE: 0.25', 'MELT_TITHE: 0.26')), /source changed/);
assert.throws(() => assertCarMeltRulesCompatibility(rulesText.replace('costOmr: 150, bonusBps: 500', 'costOmr: 151, bonusBps: 500')), /source changed/);

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
