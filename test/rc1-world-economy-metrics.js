import assert from 'node:assert/strict';
import { createWorldEconomyMetrics, economyDigest, economySnapshotHash } from '../tools/rc1-world-economy-metrics.js';
import { exactSum } from '../tools/rc1-resource-journal.js';

const DAY = 86400000, roster = ['a', 'b', 'zero'];
const initial = () => ({ format: 1, tables: {
  characters: ['a', 'b', 'zero', 'npc'].map(id => ({ id: `c-${id}`, account_id: id, is_npc: id === 'npc',
    cash: '1000', bank: '0', ammo: '25', cb: '0', alive: true })),
  account_persistent: roster.map(account_id => ({ account_id, omr: '0', staked: '0', unbonding: '0', prestige: '0', season_crowns: '0' })),
  transactions: [], item_events: [], gangs: [], item_stacks: [], item_instances: [], character_cargo: [], cars: [], boats: [],
}, boundary: { snapshot: 'ignored' } });
const receipt = (id, character, amount, reason, options = {}) => ({ id, character_id: `c-${character}`, account_id: null,
  currency: 'cash', amount, reason, counterparty: null, at: '2026-09-24T00:00:00.000Z', ...options });
function boundary(before, { sequence = 1, at = DAY, receipts = [], sections = {}, change = () => {}, outcome = 'COMMITTED' } = {}) {
  const after = structuredClone(before); after.tables.transactions.push(...receipts); change(after.tables);
  const event = { sequence, outcome, context: { authority: 'test-control', logicalAt: at } };
  const journal = { format: 1, identity: event, beforeHash: economySnapshotHash(before), afterHash: economySnapshotHash(after),
    receipts, itemEvents: [], unsupported: [], ...sections };
  return { before, after, event, journal };
}
const engine = state => createWorldEconomyMetrics({ initial: state, roster, logicalAt: 0, streamId: 'first' });
const resource = (metrics, name) => metrics.summary().resources.find(row => row.resource === name);
const ratio = value => Number(value.numerator) / Number(value.denominator);
let cases = 0;
function test(name, fn) { fn(); cases++; }

test('reciprocal funded reward is one transfer and source reward is exact', () => {
  const state = initial(), metrics = engine(state);
  const request = boundary(state, { receipts: [
    receipt('debit', 'npc', '-40.125', 'crime:take', { counterparty: 'c-a' }),
    receipt('credit', 'a', '40.125', 'crime:take', { counterparty: 'c-npc' }),
    receipt('source', 'a', '90.0001', 'crime:pick'),
  ], change: tables => { tables.characters[0].cash = '1130.1251'; tables.characters[3].cash = '959.875'; } });
  metrics.observe(request); metrics.sample(DAY);
  const cash = resource(metrics, 'cash');
  assert.deepEqual(cash.flows, { created: '90.0001', destroyed: '0', transferred: '40.125', custody: '0' });
  assert.equal(cash.reward.total, '130.1251'); assert.equal(cash.reward.perPlayer.length, 3);
  assert.equal(cash.reward.perPlayer[2].quantity, '0'); assert.equal(ratio(cash.reward.gini), 2 / 3);
  assert.equal(cash.reward.topDecile.players, 1); assert.equal(ratio(cash.unitsPerLogicalDay.transferred), 40.125);
  assert.equal(ratio(cash.transferTurnover), 40.125 / 4000);
  assert.equal(cash.perPlayerFlows.find(row => row.accountId === 'a').transferredIn, '40.125');
  assert.equal(metrics.summary().missingCoverage.length, 0);
});

test('sale components, custody and duplicated parity equations never double count', () => {
  const state = initial(), metrics = engine(state);
  const request = boundary(state, { receipts: [receipt('buy', 'b', '-100', 'exchange:buy', { counterparty: 'c-a' }),
    receipt('sale', 'a', '90', 'exchange:sale', { counterparty: 'c-b' }), receipt('deposit', 'a', '0', 'bank:deposit:30')],
  sections: { checks: Array(10).fill({ resource: 'cash', created: '100', drift: '0' }), ammoEscrow: { movements: [
    { kind: 'ammo-buy', seller: 'c-a', buyer: 'c-b', quantity: '10', gross: '100', net: '90', tax: '6', sink: '4', receiptIds: ['buy', 'sale'] },
  ] }, pressureCash: { movements: [{ kind: 'bank-deposit', characterId: 'c-a', amount: '30', receiptId: 'deposit' }] } },
  change: tables => { tables.characters[0].cash = '1060'; tables.characters[0].bank = '30'; tables.characters[1].cash = '900'; } });
  metrics.observe(request);
  assert.deepEqual(resource(metrics, 'cash').flows, { created: '0', destroyed: '4', transferred: '96', custody: '30' });
  assert.equal(resource(metrics, 'ammo').flows.transferred, '10'); assert.equal(resource(metrics, 'cash').reward.total, '0');
  assert.equal(resource(metrics, 'cash').reward.gini, null);
  const duplicate = structuredClone(request); duplicate.journal.pressureCash.movements.push({ kind: 'bank-deposit', characterId: 'c-a', amount: '30', receiptId: 'deposit' });
  assert.throws(() => engine(state).observe(duplicate), /Duplicate economic receipt/);
  const bad = structuredClone(request); bad.journal.ammoEscrow.movements[0].gross = '101';
  assert.throws(() => engine(state).observe(bad), /partition gross/);
});

test('new supply and conversion are not automatically player rewards', () => {
  const state = initial(), metrics = engine(state);
  const request = boundary(state, { receipts: [receipt('seed', 'npc', '500', 'npc:seed'),
    receipt('cash', 'a', '-2000', 'ammo:buy'), receipt('ammo', 'a', '50', 'ammo:buy', { currency: 'ammo' })],
  sections: { pressureCash: { movements: [{ kind: 'armory-ammo', characterId: 'c-a', cashDestroyed: '2000', ammoCreated: '50', receiptIds: ['cash', 'ammo'] }] } } });
  metrics.observe(request); assert.equal(resource(metrics, 'cash').flows.created, '500');
  assert.equal(resource(metrics, 'ammo').flows.created, '50'); assert.equal(resource(metrics, 'ammo').reward.total, '0');
  assert.equal(resource(metrics, 'cash').reward.allObservedRecipientsTotal, '0');
});

test('family progress references do not consume or duplicate a crime reward', () => {
  const state = initial(), metrics = engine(state), request = boundary(state, { receipts: [receipt('crime', 'a', '100', 'crime:pick')],
    sections: { workerTransitions: { movements: [{ kind: 'family-crime-progress', familyId: 'g', economicGrant: false, receiptIds: ['crime'] }] } } });
  metrics.observe(request); assert.equal(resource(metrics, 'cash').reward.total, '100'); assert.equal(resource(metrics, 'cash').flows.created, '100');
  assert.equal(metrics.summary().missingCoverage.length, 0);
});

test('exact amounts above IEEE integer range and zero-activity denominators', () => {
  const state = initial(); state.tables.characters[0].cash = '9007199254740993.00000001';
  const metrics = engine(state); const zero = metrics.sample(0);
  assert.equal(zero.resources.find(row => row.resource === 'cash').unitsPerLogicalDay.created, null);
  const request = boundary(state, { receipts: [receipt('source', 'a', '9007199254740993.00000009', 'crime:pick')] });
  metrics.observe(request); assert.equal(resource(metrics, 'cash').reward.total, '9007199254740993.00000009');
  const empty = resource(metrics, 'omr'); assert.equal(empty.transferTurnover, null);
  assert.equal(empty.unitsPerLogicalDay.transferred.numerator, '0'); assert.equal(empty.reward.largestShare, null);
});

test('only exact fresh append-only receipts are accepted', () => {
  const state = initial(); state.tables.transactions.push(receipt('old', 'a', '1', 'crime:pick'));
  for (const change of [tables => { tables.transactions[0].amount = '2'; }, tables => { tables.transactions = []; }]) {
    assert.throws(() => engine(state).observe(boundary(state, { change })), /Immutable transactions/);
  }
  const stale = boundary(state); stale.journal.receipts.push(state.tables.transactions[0]);
  assert.throws(() => engine(state).observe(stale), /exactly fresh/);
  const altered = boundary(state); altered.journal.afterHash = 'bad'; assert.throws(() => engine(state).observe(altered));
  const duplicate = boundary(state, { receipts: [receipt('old', 'a', '1', 'crime:pick')] });
  assert.throws(() => engine(state).observe(duplicate), /Duplicate transactions/);
});

test('same boundary retry is a no-op, reordered or changed retries fail, aborts do not pay', () => {
  const state = initial(), metrics = engine(state), request = boundary(state);
  metrics.observe(request); const checkpoint = metrics.checkpoint(); assert.equal(metrics.observe(request).duplicate, true);
  assert.deepEqual(metrics.checkpoint(), checkpoint);
  const changed = structuredClone(request); changed.journal.unsupported.push({ kind: 'changed' });
  assert.throws(() => metrics.observe(changed), /Stale/);
  assert.throws(() => metrics.observe(boundary(state, { sequence: 2, at: 0 })), /time/);
  const aborted = boundary(state, { outcome: 'ROLLED_BACK' }); engine(state).observe(aborted);
  assert.throws(() => engine(state).observe(boundary(state, { outcome: 'STATEMENT_ABORTED', receipts: [receipt('bad', 'a', '5', 'crime:pick')] })), /Aborted boundary/);
});

test('time-weighted stock, full checkpoint continuation and tamper controls', () => {
  const state = initial(), first = boundary(state, { at: DAY / 2, receipts: [receipt('1', 'a', '4000', 'crime:pick')],
    change: tables => { tables.characters[0].cash = '5000'; } });
  const second = boundary(first.after, { sequence: 2, at: DAY, receipts: [receipt('2', 'a', '10', 'bank:interest')] });
  const continuous = engine(state); continuous.observe(first); continuous.sample(DAY / 2, 'half'); const checkpoint = continuous.checkpoint();
  continuous.observe(second); continuous.sample(DAY, 'day');
  const resumed = engine(state).restore(checkpoint, first.after); resumed.observe(second); resumed.sample(DAY, 'day');
  assert.deepEqual(resumed.summary(), continuous.summary()); assert.equal(ratio(resource(resumed, 'cash').meanObservedStock), 6000);
  const reorder = value => Array.isArray(value) ? value.map(reorder) : value && typeof value === 'object'
    ? Object.fromEntries(Object.keys(value).sort().map(key => [key, reorder(value[key])])) : value;
  const serialized = JSON.parse(JSON.stringify(reorder(checkpoint)));
  assert.deepEqual(engine(state).restore(serialized, first.after).checkpoint(), checkpoint);
  const newProcess = engine(state).restore(checkpoint, first.after, { streamId: 'second' });
  const reset = structuredClone(second); reset.event.sequence = 1; reset.journal.identity = reset.event;
  newProcess.observe(reset); assert.deepEqual(resource(newProcess, 'cash').flows, resource(continuous, 'cash').flows);
  assert.throws(() => engine(state).restore(checkpoint, state), /native state/);
  const corrupt = structuredClone(checkpoint); corrupt.state.flows.cash.created = '1';
  assert.throws(() => engine(state).restore(corrupt, first.after), /digest/);
  corrupt.state.config.roster.push('intruder'); corrupt.sha256 = economyDigest(corrupt.state);
  assert.throws(() => engine(state).restore(corrupt, first.after), /roster/);
});

test('unknown receipts and ambiguous item pairs report local missing coverage', () => {
  const state = initial(), metrics = engine(state);
  const request = boundary(state, { receipts: [receipt('unknown', 'a', '10', 'unclassified:windfall')],
    change: tables => { tables.item_events = [{ id: 'in', event_kind: 'stack_consumed', template_id: 'x', quality: 'base', quantity_delta: '-2' },
      { id: 'out', event_kind: 'stack_granted', template_id: 'x', quality: 'base', quantity_delta: '2' }]; } });
  request.journal.itemEvents = request.after.tables.item_events;
  request.journal.coverageMissing = ['old all-resource self-exclusion'];
  metrics.observe(request); assert.equal(resource(metrics, 'cash').reward.total, '0');
  assert.equal(metrics.summary().missingCoverage.length, 3);
  assert(!JSON.stringify(metrics.summary().missingCoverage).includes('old all-resource'));
});

test('unpaired OMR bucket nets remain local missing flow coverage', () => {
  const state = initial(), metrics = engine(state), request = boundary(state, { sections: {
    omrBuckets: { movements: [{ key: 'personal/a', before: '10', after: '5' }, { key: 'house/pool', before: '0', after: '5' }] },
  } });
  metrics.observe(request); assert.equal(resource(metrics, 'omr').flows.transferred, '0');
  assert.equal(metrics.summary().missingCoverage[0].example.kind, 'omr-bucket-flow');
});

test('canonical churn enrollment adds zero-reward replacements and retains retired actors', () => {
  const state = initial(), metrics = engine(state), request = boundary(state, { receipts: [receipt('earned', 'a', '12', 'crime:pick')] });
  metrics.observe(request); metrics.sample(DAY, 'before-churn');
  assert.deepEqual(metrics.registerAccounts(['replacement', 'a', 'replacement']), { added: ['replacement'], enrolledAccounts: 4 });
  const cash = resource(metrics, 'cash'); assert.equal(cash.reward.perPlayer.length, 4);
  assert.equal(cash.reward.perPlayer.find(row => row.accountId === 'replacement').quantity, '0');
  assert.equal(cash.perPlayerFlows.find(row => row.accountId === 'replacement').created, '0');
  assert.equal(cash.reward.perPlayer.find(row => row.accountId === 'a').quantity, '12');
  assert.equal(ratio(cash.reward.gini), 3 / 4); assert.equal(metrics.summary().timeSeries[0].enrolledRoster.length, 3);
  const checkpoint = metrics.checkpoint(); metrics.registerAccounts(['replacement']); assert.deepEqual(metrics.checkpoint(), checkpoint);
  assert.deepEqual(engine(state).restore(checkpoint, request.after).summary(), metrics.summary());
  assert.deepEqual(metrics.summary().initialRoster, roster); assert.throws(() => metrics.registerAccounts([null]), /Enrollment/);
  const corrupt = structuredClone(checkpoint); corrupt.state.enrolledRoster.pop(); corrupt.sha256 = economyDigest(corrupt.state);
  assert.throws(() => engine(state).restore(corrupt, request.after), /Enrolled roster/);
});

test('new lifecycle transfer/refund/turf classifiers partition flows without rewards', () => {
  const state = initial(), metrics = engine(state), request = boundary(state, { receipts: [
    receipt('order', 'a', '-100', 'market:order'), receipt('fee', 'a', '-5', 'market:list'),
    receipt('refund', 'b', '50', 'market:refund'), receipt('turf', 'a', '-20', 'turf:claim'),
  ], sections: {
    orderResources: { movements: [{ kind: 'player-order-funding', owner: 'c-a', held: '100', feeBurned: '5', receiptIds: ['order', 'fee'] }] },
    orderExpiry: { movements: [{ kind: 'market-order-expiry-refund', owner: 'c-b', amount: '50', receiptId: 'refund' }] },
    turfFunding: { movements: [{ kind: 'turf-stake-funding', familyId: 'g', amount: '20', receiptId: 'turf' }] },
  } });
  metrics.observe(request); assert.deepEqual(resource(metrics, 'cash').flows, { created: '0', destroyed: '5', transferred: '0', custody: '170' });
});

test('assets retain distinct units and season titles remain non-economic', () => {
  const state = initial(), metrics = engine(state), request = boundary(state, { sections: {
    boats: { movements: [{ kind: 'exact-npc-spawn-boat-source', boatId: 'boat', owner: 'c-npc' }] },
    seasonConversions: { movements: [{ kind: 'season-duel-title', economicGrant: false },
      { kind: 'season-prestige-conversion', characterId: 'c-a', accountId: 'a', prestigeGained: '37' }] },
    seasonCrowns: { movements: [{ characterId: 'c-a', accountId: 'a', crownDelta: 1 }] },
  }, change: tables => { tables.boats.push({ id: 'boat', kind: 'dinghy', rarity: 'common', character_id: 'c-npc' }); } });
  metrics.observe(request); assert.equal(resource(metrics, 'boat:["dinghy","common"]').flows.created, '1');
  assert.equal(resource(metrics, 'prestige').reward.total, '37'); assert.equal(resource(metrics, 'season-crowns').reward.total, '1');
  assert.equal(exactSum(resource(metrics, 'cash').reward.perPlayer.map(row => row.quantity)), '0');
});

console.log(JSON.stringify({ status: 'PASS_SCOPED', controls: cases, metrics: ['resource velocity', 'reward concentration'],
  nativeQualification: false, scope: 'Exact arithmetic, authoritative movement/receipt adapters, duplicate/abort/append-only/checkpoint controls; native runner hooks owned separately' }));
