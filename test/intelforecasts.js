import assert from 'node:assert/strict';
import { DISTRICTS, GOODS, priceBlock } from '../src/rules.js';
import { marketPrices } from '../src/streets.js';
import { INTEL_FORECAST as F, intelForecastTerms, intelForecastSnapshot,
  validateIntelForecastReport, intelForecastOutcome } from '../src/intelforecasts.js';

const now = priceBlock(Date.parse('2026-10-11T12:00:00.000Z')) * F.blockMs + 3600000;
const iso = value => new Date(value).toISOString(), place = DISTRICTS.find(d => d.id === 'docks');
const terms = extra => ({ districtId: place.id, minimumStock: 10, feeCash: 100, targetAt: iso(now + 600000), ...extra });
const publicBoard = (at, stock = 500) => ({ block: priceBlock(at),
  liquidity: { refreshAt: iso((priceBlock(at) + 1) * F.blockMs), districts: { [place.id]: { gin: { stock, buying: 499 } } } } });
const snapshot = (at, stock = 500) => intelForecastSnapshot(publicBoard(at, stock), place.id, at);
const report = extra => ({ districtId: place.id, minimumStock: 10, targetAt: iso(now + 600000),
  reportedAt: iso(now), predictsAvailable: true, observation: snapshot(now), ...extra });
let cases = 0;
const test = (name, fn) => { fn(); cases++; };

test('exact terms preserve fixed consent and every inclusive bound', () => {
  for (const minimumStock of [1, 40]) for (const feeCash of [50, 5000]) for (const lead of [F.minLeadMs, F.maxLeadMs]) {
    const body = terms({ minimumStock, feeCash, targetAt: iso(now + lead) });
    assert.deepEqual(intelForecastTerms(body, now), body);
  }
  assert(Object.isFrozen(F)); assert.equal(F.maxOpen, 3);
});
test('terms reject extra, missing, inherited, accessor and malformed inputs', () => {
  for (const key of ['provider', 'owner', 'spendingAuthority', 'priceBlock']) assert.throws(() => intelForecastTerms(terms({ [key]: 'private' }), now));
  for (const key of Object.keys(terms())) { const body = terms(); delete body[key]; assert.throws(() => intelForecastTerms(body, now)); }
  for (const value of [null, [], 'terms', 1, Object.create(terms())]) assert.throws(() => intelForecastTerms(value, now));
  const symbol = terms(); symbol[Symbol('extra')] = true; assert.throws(() => intelForecastTerms(symbol, now));
  const accessor = terms(); Object.defineProperty(accessor, 'feeCash', { get: () => 100 }); assert.throws(() => intelForecastTerms(accessor, now));
  for (const value of ['unknown', '', null, 7]) assert.throws(() => intelForecastTerms(terms({ districtId: value }), now));
  for (const [field, invalids] of [['minimumStock', [0, 41, 1.5, '10', NaN]], ['feeCash', [49, 5001, 100.1, '100', Infinity]]])
    for (const value of invalids) assert.throws(() => intelForecastTerms(terms({ [field]: value }), now));
  for (const value of [iso(now), iso(now + F.minLeadMs - 1), iso(now + F.maxLeadMs + 1), '2026-02-30T13:00:00.000Z', 'yesterday', now, null])
    assert.throws(() => intelForecastTerms(terms({ targetAt: value }), now));
  for (const clock of [NaN, Infinity, -1, 0.5, 'now', Number.MAX_SAFE_INTEGER]) assert.throws(() => intelForecastTerms(terms(), clock));
});
test('same-block target only; grace crossing reset is not an extra admission rule', () => {
  const end = (priceBlock(now) + 1) * F.blockMs, created = end - 600001;
  assert.equal(intelForecastTerms(terms({ targetAt: iso(end - 1) }), created).targetAt, iso(end - 1));
  assert.throws(() => intelForecastTerms(terms({ targetAt: iso(end) }), created));
});
test('submitted content is only an exact boolean prediction', () => {
  for (const predictsAvailable of [true, false]) assert.deepEqual(validateIntelForecastReport({ predictsAvailable }), { predictsAvailable });
  for (const body of [{}, { predictsAvailable: 'true' }, { predictsAvailable: 1 }, { predictsAvailable: true, observation: snapshot(now) },
    { predictsAvailable: false, targetAt: iso(now) }, null, []]) assert.throws(() => validateIntelForecastReport(body));
});
test('public projection excludes unrelated and private fields without reading them', () => {
  const board = publicBoard(now, 321); board.accountId = 'private'; board.liquidity.districts[place.id].gin.holdings = 99;
  Object.defineProperty(board, 'wiretaps', { get() { throw Error('Private data must not be read'); } });
  const result = intelForecastSnapshot(board, place.id, now);
  assert.deepEqual(result, { good: 'gin', goodName: GOODS.find(g => g.id === 'gin').name, districtId: place.id,
    districtName: place.name, block: priceBlock(now), observedAt: iso(now), refreshAt: board.liquidity.refreshAt, stock: 321 });
  result.stock = 0; assert.equal(board.liquidity.districts[place.id].gin.stock, 321, 'Projection must not alias source data');
});
test('canonical public snapshot rejects bad block, refresh, stock or missing source', () => {
  for (const stock of [-1, 501, 2.5, '40', NaN, Infinity, undefined]) {
    const b = publicBoard(now); b.liquidity.districts[place.id].gin.stock = stock;
    assert.throws(() => intelForecastSnapshot(b, place.id, now));
  }
  for (const block of [priceBlock(now) - 1, '1', 0.5, Infinity]) { const b = publicBoard(now); b.block = block; assert.throws(() => intelForecastSnapshot(b, place.id, now)); }
  for (const refreshAt of [iso(now), iso((priceBlock(now) + 1) * F.blockMs + 1), 'bad', null]) {
    const b = publicBoard(now); b.liquidity.refreshAt = refreshAt; assert.throws(() => intelForecastSnapshot(b, place.id, now));
  }
  for (const board of [null, {}, { block: priceBlock(now) }, { ...publicBoard(now), liquidity: {} }])
    assert.throws(() => intelForecastSnapshot(board, place.id, now));
  assert.throws(() => intelForecastSnapshot(publicBoard(now), 'unknown', now));
});
test('correct and incorrect depend on actual availability, with equality included', () => {
  for (const predictsAvailable of [false, true]) for (const stock of [0, 9, 10, 11, 500]) {
    const r = report({ predictsAvailable }), sample = snapshot(now + 600000, stock);
    assert.equal(intelForecastOutcome(r, sample, now + 600000), predictsAvailable === (stock >= 10) ? 'correct' : 'incorrect');
  }
});
test('report cutoff and scoring grace have exact millisecond boundaries', () => {
  const target = now + 600000;
  for (const age of [60000, 60001]) {
    const at = target - age, r = report({ reportedAt: iso(at), observation: snapshot(at) });
    for (const delay of [0, 30000]) assert.equal(intelForecastOutcome(r, snapshot(target + delay, 10), target + delay), 'correct');
  }
  const lateReportAt = target - 59999;
  assert.equal(intelForecastOutcome(report({ reportedAt: iso(lateReportAt), observation: snapshot(lateReportAt) }), snapshot(target, 10), target), 'unknown');
  for (const offset of [-1, 30001]) assert.equal(intelForecastOutcome(report(), snapshot(target + offset, 10), target + Math.max(0, offset)), 'unknown');
  assert.equal(intelForecastOutcome(report(), snapshot(target, 10), target - 1), 'unknown');
});
test('missing, future, reset, impossible growth and tampered contexts remain unknown', () => {
  const target = now + 600000, valid = snapshot(target, 10);
  for (const r of [null, {}, report({ observation: null }), report({ minimumStock: 0 }), report({ minimumStock: '10' }),
    report({ predictsAvailable: 'true' }), report({ reportedAt: iso(now + 1) }), report({ districtId: 'neon' }), report({ targetAt: 'bad' })])
    assert.equal(intelForecastOutcome(r, valid, target), 'unknown');
  for (const field of Object.keys(valid)) {
    const changed = { ...valid, [field]: ['stock', 'block'].includes(field) ? -1 : 'tampered' };
    assert.equal(intelForecastOutcome(report(), changed, target), 'unknown');
  }
  assert.equal(intelForecastOutcome(report(), { ...valid, privateData: 'hidden' }, target), 'unknown');
  assert.equal(intelForecastOutcome(report(), null, target), 'unknown');
  assert.equal(intelForecastOutcome(report({ observation: snapshot(now, 5) }), valid, target), 'unknown', 'Stock cannot refill within a block');
  const reset = (priceBlock(now) + 1) * F.blockMs;
  assert.equal(intelForecastOutcome(report(), snapshot(reset, 500), reset), 'unknown');
  assert.equal(intelForecastOutcome(report(), valid, reset), 'unknown', 'Scoring after a block reset cannot claim current certainty');
  const r = report(); Object.defineProperty(r, 'predictsAvailable', { get() { throw Error('Untrusted accessor'); } });
  assert.equal(intelForecastOutcome(r, valid, target), 'unknown');
});

// Seeded reference trials check time/stock boundaries and absence of mutation. No cash or DB writes.
let seed = 0x1a7e110;
const random = max => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed % max; };
for (let i = 0; i < 1000; i++) {
  const lead = F.minLeadMs + random(F.maxLeadMs - F.minLeadMs + 1), target = now + lead;
  const minimumStock = 1 + random(40), initialStock = random(501), stock = random(initialStock + 1), predictsAvailable = random(2) === 1;
  const body = terms({ minimumStock, feeCash: 50 + random(4951), targetAt: iso(target) });
  assert.deepEqual(intelForecastTerms(body, now), body);
  const r = report({ minimumStock, targetAt: iso(target), predictsAvailable, observation: snapshot(now, initialStock) });
  const sample = snapshot(target + random(30001), stock), before = JSON.stringify({ r, sample });
  assert.equal(intelForecastOutcome(r, sample, Date.parse(sample.observedAt)), predictsAvailable === (stock >= minimumStock) ? 'correct' : 'incorrect');
  assert.equal(JSON.stringify({ r, sample }), before);
  assert.equal(intelForecastOutcome(r, snapshot(target + 30001, stock), target + 30001), 'unknown');
}

// Exercise the actual public source helper with a bounded read-only fake query, not native DB evidence.
const calls = [];
const source = await marketPrices({ query: async (sql, args) => {
  calls.push({ sql, args });
  return { rows: [{ district: place.id, good_id: 'gin', bought: 123, sold: 9 }] };
} }, priceBlock(now));
assert.equal(calls.length, 1); assert.deepEqual(calls[0].args, [priceBlock(now)]);
assert.match(calls[0].sql, /^SELECT good_id, district, bought, sold FROM goods_market_liquidity/);
assert.equal(intelForecastSnapshot(source, place.id, now).stock, 377);
console.log(JSON.stringify({ status: 'PASS', cases, seededTrials: 1000, canonicalPublicSourceReads: calls.length,
  scope: 'Pure terms, public projection and prediction scoring only; no fee execution, native persistence, model reasoning or financial activation' }));
