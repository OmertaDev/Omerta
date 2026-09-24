// Test-only measurements. Consume isolated committed world snapshots; never
// import game/db or feed this observer's information back to actor policies.
import assert from 'node:assert/strict';
import { CRIMES, CAMPAIGNS } from '../src/rules.js';
import { exactDecimal, exactSum, negate, sha256 } from './rc1-resource-journal.js';

const DAY = 86400000;
const clone = value => structuredClone(value);
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`
    : JSON.stringify(value);
export const economyDigest = value => sha256(canonical(value));
const rows = (state, table) => state.tables[table] || [];
const quantity = value => {
  assert(typeof value !== 'number' || Number.isSafeInteger(value), 'Use decimal strings for noninteger/large quantities');
  return exactSum([value]);
};
const positive = value => exactDecimal(value).coefficient > 0n;
const add = (object, key, value) => { object[key] = exactSum([object[key] || '0', value]); };
const multiply = (value, integer) => {
  const { coefficient, scale } = exactDecimal(value), product = coefficient * BigInt(integer);
  const sign = product < 0n ? '-' : '', digits = (product < 0n ? -product : product).toString().padStart(scale + 1, '0');
  return quantity(scale ? `${sign}${digits.slice(0, -scale)}.${digits.slice(-scale)}` : `${sign}${digits}`);
};
const ratio = (numerator, denominator) => {
  const a = exactDecimal(numerator), b = exactDecimal(denominator);
  return b.coefficient === 0n ? null : { numerator: (a.coefficient * 10n ** BigInt(b.scale)).toString(),
    denominator: (b.coefficient * 10n ** BigInt(a.scale)).toString() };
};
export const economySnapshotHash = ({ boundary, ...state }) => sha256(state);
const resourceId = (kind, ...parts) => `${kind}:${JSON.stringify(parts)}`;

export const WORLD_ECONOMY_METRICS_CONTRACT = Object.freeze({
  format: 1,
  inputs: 'Existing isolated native boundary event, resource journal, and full before/after world snapshots. No SQL or telemetry added.',
  velocity: 'Exact classified units per logical day, separately created/destroyed/transferred/custody. Transfer turnover = transferred units / time-weighted mean of the named observed stock. It is not whole-economy money velocity or OMR sink-return velocity.',
  transfer: 'One source-to-destination movement counted once. Same economic owner moving custody is separate. Purchases can contain a transfer and a destruction; their components are disjoint.',
  rewards: 'Positive canonical crime/check-in/campaign/interest/season awards and competitive loot, separated by resource and taxonomy. Purchases, refunds, tribute and NPC starting inventory are not rewards. Notifications and parity checks are not award authority.',
  denominators: 'Elapsed zero => rate null; positive elapsed with zero classified flow => rate zero; zero observed stock => turnover null; zero total reward => concentration shares/Gini null. Declared accounts with zero rewards remain in distributions.',
  coverage: 'Reports measurements and observed local missing coverage independently of the all-resource journal qualification. No minimum number of resource classes and no launch verdict.',
  sourceRules: ['src/game.js doCrime, checkIn, bank interest; src/campaigns.js claimCampaign',
    'src/rules.js CRIMES/CAMPAIGNS catalogs; source-bound observer movement classifiers'],
  hooks: 'Observe only after journal reconciliation. Record returned incremental flows with the existing boundary. sample at daily/final logical time; persist checkpoint beside native checkpoint. restore requires matching native snapshot and a new streamId if observer sequence resets.',
});

// Named reference holdings, not a claim that every escrow/backing/house pool is
// spendable float. In-transit bank markers, funded reward liabilities, item lots
// backing items, race entry mirrors, and garrison power are never added here.
export function economyStocks(state) {
  assert.equal(state.format, 1); assert(state.tables);
  const values = { cash: '0', ammo: '0', cb: '0', omr: '0', prestige: '0', 'season-crowns': '0' };
  const scopes = {
    cash: 'All characters.cash + characters.bank + gangs.treasury; excludes escrow and house pools',
    ammo: 'All characters.ammo + gangs.ammo_bank; excludes listed/operation escrow rounds',
    cb: 'All characters.cb',
    omr: 'account_persistent.omr + staked + unbonding + gangs.omr_reserve; excludes house/escrow pools and rewards liability',
    prestige: 'account_persistent.prestige', 'season-crowns': 'account_persistent.season_crowns',
  };
  function field(table, fields, resource) {
    for (const row of rows(state, table)) for (const name of fields) add(values, resource, quantity(row[name] ?? '0'));
  }
  field('characters', ['cash', 'bank'], 'cash'); field('gangs', ['treasury'], 'cash');
  field('characters', ['ammo'], 'ammo'); field('gangs', ['ammo_bank'], 'ammo'); field('characters', ['cb'], 'cb');
  field('account_persistent', ['omr', 'staked', 'unbonding'], 'omr'); field('gangs', ['omr_reserve'], 'omr');
  field('account_persistent', ['prestige'], 'prestige'); field('account_persistent', ['season_crowns'], 'season-crowns');
  const inventory = (table, kind, fields, amount, scope, predicate = () => true) => {
    for (const row of rows(state, table).filter(predicate)) {
      const key = resourceId(kind, ...fields.map(name => row[name] ?? null));
      add(values, key, quantity(amount(row))); scopes[key] = scope;
    }
  };
  inventory('cars', 'car', ['model_id', 'rarity'], () => '1', 'Existing car rows, by model and rarity; count, not appraised value');
  inventory('boats', 'boat', ['kind', 'rarity'], () => '1', 'Existing boat rows, by kind and rarity; count, not appraised value');
  inventory('character_cargo', 'cargo', ['good_id'], row => row.qty, 'Character cargo quantity by good; excludes listed cargo');
  inventory('item_stacks', 'stack', ['template_id', 'quality'], row => row.quantity, 'Item stack quantity by template/quality; excludes lot backing');
  inventory('item_instances', 'item', ['template_id'], () => '1', 'Active or escrowed unique item rows by template; excludes consumed rows and lot backing', row => ['active', 'escrowed'].includes(row.state));
  for (const value of Object.values(values)) assert(exactDecimal(value).coefficient >= 0n, 'Negative reference stock');
  return { values, scopes };
}

function appendOnly(before, after, table) {
  const index = state => {
    const map = new Map();
    for (const row of rows(state, table)) { assert(row.id != null && !map.has(String(row.id)), `Duplicate ${table} identity`); map.set(String(row.id), row); }
    return map;
  };
  const old = index(before), next = index(after);
  for (const [id, row] of old) assert.deepEqual(next.get(id), row, `Immutable ${table} receipt removed or rewritten: ${id}`);
  return [...next].filter(([id]) => !old.has(id)).map(([, row]) => row);
}

// Only movement objects produced by the established observer classifiers are
// accepted here. Their receipt claims are consumed once, independent of how many
// redundant parity equations describe the same economic event.
export function classifyEconomyBoundary({ journal, before, after }) {
  const fresh = appendOnly(before, after, 'transactions');
  const events = appendOnly(before, after, 'item_events');
  const sorted = values => values.map(canonical).sort();
  assert.deepEqual(sorted(journal.receipts || []), sorted(fresh), 'Journal must contain exactly fresh committed receipts');
  assert.deepEqual(sorted(journal.itemEvents || []), sorted(events), 'Journal must contain exactly fresh committed item events');
  const receipts = new Map(fresh.map(row => [String(row.id), row])), used = new Set(), flows = [], missing = [];
  const people = new Map([...rows(before, 'characters'), ...rows(after, 'characters')].map(row => [row.id, row]));
  const person = id => { assert(people.has(id), `Unknown movement character ${id}`); return `account:${people.get(id).account_id}`; };
  const family = id => `family:${id}`;
  const referenceIds = movement => [...new Set([...(movement.receiptIds || []), ...(movement.receiptId != null ? [movement.receiptId] : []),
    ...(Array.isArray(movement.authority) ? movement.authority : []).filter(row => row.table === 'transactions').map(row => row.id)].map(String))];
  function claim(ids) {
    for (const id of ids) { assert(receipts.has(id), `Movement references nonfresh receipt ${id}`); assert(!used.has(id), `Duplicate economic receipt claim ${id}`); used.add(id); }
  }
  function flow(resource, type, amount, from, to, category, ids, reward = null) {
    amount = quantity(amount); assert(exactDecimal(amount).coefficient >= 0n, 'Negative movement amount');
    if (amount === '0') return;
    assert(['created', 'destroyed', 'transferred', 'custody'].includes(type));
    if (type === 'transferred' && from === to) type = 'custody';
    flows.push({ resource, type, amount, from, to, category, receiptIds: ids, ...(reward ? { reward } : {}) });
  }
  function movement(group, m) {
    const ids = referenceIds(m), kind = m.kind || (group === 'seasonCrowns' ? 'season-crown' : null), pending = [];
    const emit = (...args) => pending.push(args);
    const own = () => person(m.characterId ?? m.owner);
    const reward = (category, account = m.accountId || people.get(m.characterId)?.account_id) => ({ accountId: account, category });
    switch (kind) {
      case 'checkin': emit('cash', 'created', m.cashCreated, null, own(), kind, ids, reward('check-in')); break;
      case 'armory-ammo':
        emit('cash', 'destroyed', m.cashDestroyed, own(), null, kind, ids);
        emit('ammo', 'created', m.ammoCreated, null, own(), kind, ids); break;
      case 'bank-deposit': emit('cash', 'custody', m.amount, own(), own(), kind, ids); break;
      case 'ammo-list': case 'ammo-cancel': emit('ammo', 'custody', m.quantity, person(m.seller), person(m.seller), kind, ids); break;
      case 'ammo-buy':
        assert.equal(exactSum([m.net, m.tax, m.sink]), quantity(m.gross), 'Sale cash components must partition gross');
        emit('ammo', 'transferred', m.quantity, person(m.seller), person(m.buyer), kind, ids);
        emit('cash', 'transferred', m.net, person(m.buyer), person(m.seller), kind, ids);
        emit('cash', 'transferred', m.tax, person(m.buyer), 'house:street_tax.pool', kind, ids);
        emit('cash', 'destroyed', m.sink, person(m.buyer), null, kind, ids); break;
      case 'family-formation-sink': case 'npc-family-formation-cash-sink':
        emit('cash', 'destroyed', m.amount ?? m.fee, own(), null, kind, ids); break;
      case 'family-cash-tribute': case 'family-omr-tribute':
        emit(m.currency, 'transferred', m.amount, own(), family(m.familyId), kind, ids); break;
      case 'family-dissolution':
        for (const part of m.disposition) emit(part.currency, part.kind === 'destroyed' ? 'destroyed' : 'transferred', part.amount,
          family(m.familyId), part.kind === 'destroyed' ? null : 'house:desk_inventory.balance', kind, ids); break;
      case 'turf-contest-terminal':
        emit('cash', 'custody', m.refunded, family(m.familyId), family(m.familyId), kind, ids);
        emit('cash', 'destroyed', m.burned, family(m.familyId), null, kind, ids); break;
      case 'exchange-tax-funding': emit('cash', 'transferred', m.amount, `house:${m.source}`, `house:${m.destination}`, kind, ids); break;
      case 'npc-market-order-placement':
        emit('cash', 'custody', m.escrow, own(), own(), kind, ids);
        emit('cash', 'destroyed', m.fee, own(), null, kind, ids); break;
      case 'NPC-freight-purchase': {
        // The source-pinned NPC classifier already checked the original price.
        const cost = BigInt(quantity(m.unit)) * BigInt(quantity(m.qty)), tax = (cost + 99n) / 100n;
        assert.equal(quantity(receipts.get(ids[0])?.amount), String(-(cost + 2n * tax)), 'Freight receipt partition');
        emit('cash', 'destroyed', String(cost + tax), own(), null, kind, ids);
        emit('cash', 'transferred', String(tax), own(), 'house:street_tax.pool', kind, ids);
        emit(resourceId('cargo', m.goodId), 'created', m.qty, null, own(), kind, ids); break;
      }
      case 'market-order-expiry-refund': emit('cash', 'custody', m.amount, own(), own(), kind, ids); break;
      case 'player-order-funding':
        emit('cash', 'custody', m.held, own(), own(), kind, ids);
        emit('cash', 'destroyed', m.feeBurned, own(), null, kind, ids); break;
      case 'jump-cash-transfer':
        emit('cash', 'transferred', m.amount, person(m.source), person(m.destination), kind, ids,
          reward('competitive-loot', people.get(m.destination).account_id)); break;
      case 'law-plea-transfer': emit('cash', 'transferred', m.amount, person(m.source), `house:${m.destination}`, kind, ids); break;
      case 'player-death-order-and-pocket':
        emit('cash', 'transferred', exactSum([m.escrowLoot, m.pocketLoot]), person(m.source), person(m.destination), kind, ids,
          reward('competitive-loot', people.get(m.destination).account_id));
        emit('cash', 'destroyed', m.escrowBurn, person(m.source), null, kind, ids); break;
      case 'unoccupied-turf-cash-sink': emit('cash', 'destroyed', m.burned, family(m.familyId), null, kind, ids); break;
      case 'turf-stake-funding': emit('cash', 'custody', m.amount, family(m.familyId), family(m.familyId), kind, ids); break;
      case 'season-prestige-conversion': emit('prestige', 'created', m.prestigeGained, null, own(), kind, ids, reward('season-prestige')); break;
      case 'season-status-only':
        for (const id of ids) assert.equal(quantity(receipts.get(id)?.amount), '0', 'Status-only receipt cannot grant a resource'); break;
      case 'season-crown': emit('season-crowns', 'created', m.crownDelta, null, own(), kind, ids, reward('season-standing')); break;
      case 'exact-npc-spawn-car-source': case 'exact-salvage-sink': case 'exact-solo-melt-sink': {
        const car = [...rows(before, 'cars'), ...rows(after, 'cars')].find(row => row.id === m.carId); assert(car, 'Missing car identity');
        const created = kind === 'exact-npc-spawn-car-source';
        emit(resourceId('car', car.model_id, car.rarity), created ? 'created' : 'destroyed', '1', created ? null : own(), created ? own() : null, kind, ids);
        if (kind === 'exact-solo-melt-sink') emit('ammo', 'created', m.rounds, null, own(), kind, ids); break;
      }
      case 'exact-npc-spawn-boat-source': {
        const boat = rows(after, 'boats').find(row => row.id === m.boatId); assert(boat, 'Missing boat identity');
        emit(resourceId('boat', boat.kind, boat.rarity), 'created', '1', null, own(), kind, ids); break;
      }
      case 'market-lock': case 'market-cancel-release': break; // car remains one owned object
      default:
        // Family counters may reference the same crime receipt as its actual
        // reward. Metadata must not consume that receipt's economic authority.
        if (m.economicGrant === false) return;
        missing.push({ kind: 'unclassified-movement', group, movementKind: kind }); return;
    }
    claim(ids); for (const args of pending) flow(...args);
  }
  for (const group of ['pressureCash', 'ammoEscrow', 'familyEntry', 'familyDissolution', 'turfTerminal', 'workerTransitions',
    'npcMarketOrder', 'orderExpiry', 'orderResources', 'lifecycleCash', 'turfFunding', 'seasonConversions', 'seasonCrowns', 'boats', 'membership', 'npcRecruitment', 'npcCargo']) {
    for (const m of journal[group]?.movements || []) movement(group, m);
  }
  for (const m of journal.cars?.lineage || []) movement('cars', m);
  const crimeSources = new Set(CRIMES.map(crime => `crime:${crime.id}`));
  for (const receipt of fresh) {
    const id = String(receipt.id); if (used.has(id)) continue;
    const amount = quantity(receipt.amount), currency = receipt.currency, reason = receipt.reason;
    const accountId = receipt.account_id || people.get(receipt.character_id)?.account_id;
    const owner = accountId ? `account:${accountId}` : null;
    const earned = category => ({ accountId, category });
    if (reason === 'crime:take' && currency === 'cash') {
      if (!positive(amount)) continue; // consumed when its reciprocal credit is processed
      const matches = fresh.filter(row => row.currency === currency && row.reason === reason && row.character_id === receipt.counterparty
        && row.counterparty === receipt.character_id && quantity(row.amount) === negate(amount) && row.at === receipt.at);
      assert.equal(matches.length, 1, 'Funded crime reward needs exactly one reciprocal debit');
      const ids = [id, String(matches[0].id)]; claim(ids);
      flow(currency, 'transferred', amount, person(receipt.counterparty), owner, reason, ids, earned('crime-funded')); continue;
    }
    let category = null;
    if (crimeSources.has(reason) && currency === 'cash' && receipt.counterparty == null) category = 'crime-source';
    if (reason.endsWith(':cb') && crimeSources.has(reason.slice(0, -3)) && currency === 'cb' && receipt.counterparty == null) category = 'crime-contraband';
    if (reason === 'bank:interest' && currency === 'cash' && receipt.counterparty == null) category = 'bank-interest';
    if (reason === 'campaign:reward' && currency === 'cash') {
      const candidates = rows(after, 'campaign_progress').filter(progress => progress.character_id === receipt.character_id && progress.claimed
        && !rows(before, 'campaign_progress').find(old => old.character_id === progress.character_id && old.campaign_id === progress.campaign_id)?.claimed)
        .filter(progress => CAMPAIGNS.some(c => c.id === progress.campaign_id && c.npc === receipt.counterparty
          && exactSum([c.reward.cash || 0, progress.branch ? c.steps.find(s => s.choice?.some(b => b.id === progress.branch))?.choice.find(b => b.id === progress.branch)?.cash || 0 : 0]) === amount));
      assert.equal(candidates.length, 1, 'Campaign award must match one fresh canonical claim/quote'); category = 'campaign';
    }
    if (category && positive(amount) && owner) { claim([id]); flow(currency, 'created', amount, null, owner, reason, [id], earned(category)); continue; }
    if (reason === 'npc:seed' && currency === 'cash' && positive(amount) && people.get(receipt.character_id)?.is_npc) {
      claim([id]); flow(currency, 'created', amount, null, owner, reason, [id]); continue;
    }
    // Exact authored consumptions, never rewards. Other reasons remain visible.
    if ((currency === 'ammo' && ['fire', 'jump'].includes(reason) || currency === 'cash' && ['death:estate', 'travel'].includes(reason))
      && positive(negate(amount)) && owner) { claim([id]); flow(currency, 'destroyed', negate(amount), owner, null, reason, [id]); }
  }
  for (const receipt of fresh) if (!used.has(String(receipt.id))) missing.push({ kind: 'unclassified-receipt', resource: receipt.currency,
    reason: receipt.reason, receiptId: String(receipt.id), amount: quantity(receipt.amount) });
  // Stack grants/consumes may be the two legs of one transfer or a conversion.
  // Keep them missing until the mutation classifier supplies owner-aware flows.
  for (const event of events) missing.push({ kind: 'item-mutation-flow', eventId: event.id, eventKind: event.event_kind,
    resource: event.item_id ? resourceId('item', event.template_id) : resourceId('stack', event.template_id, event.quality),
    hook: 'Observer must bind mutation input/output and event IDs to one created/destroyed/transfer/custody movement; paired stack events alone are ambiguous.' });
  const priorCharacters = new Set(rows(before, 'characters').map(row => row.id));
  for (const character of rows(after, 'characters')) if (!priorCharacters.has(character.id)) missing.push({ kind: 'character-entry-stock',
    characterId: character.id, hook: 'Bind unledgered starting cash/ammo to canonical entry separately from any NPC seed receipt.' });
  if (journal.omrBuckets?.movements?.length && !flows.some(flow => flow.resource === 'omr')) missing.push({ kind: 'omr-bucket-flow', resource: 'omr',
    bucketChanges: journal.omrBuckets.movements.length,
    hook: 'Supply exact source/destination bucket movement and receipt/provenance IDs. Signed net bucket changes cannot recover gross transfers or rewards.' });
  for (const observation of journal.unsupported || []) missing.push({ kind: 'observer-lineage', observation });
  return { flows, missingCoverage: missing, freshReceipts: fresh.length, freshItemEvents: events.length };
}

function concentration(roster, rewards) {
  const perPlayer = roster.map(accountId => ({ accountId, quantity: rewards[accountId] || '0' }));
  const decimals = perPlayer.map(row => exactDecimal(row.quantity)), scale = Math.max(0, ...decimals.map(row => row.scale));
  const values = decimals.map(row => row.coefficient * 10n ** BigInt(scale - row.scale)).sort((a, b) => a < b ? -1 : a > b ? 1 : 0);
  const total = values.reduce((sum, value) => sum + value, 0n), n = BigInt(values.length), topCount = Math.ceil(values.length / 10);
  return { perPlayer, total: exactSum(perPlayer.map(row => row.quantity)), allObservedRecipientsTotal: exactSum(Object.values(rewards)), recipients: values.filter(value => value > 0n).length,
    largestShare: total ? ratio(values.at(-1), total) : null,
    topDecile: { players: topCount, share: total ? ratio(values.slice(-topCount).reduce((sum, value) => sum + value, 0n), total) : null },
    gini: total ? ratio(values.reduce((sum, value, index) => sum + (2n * BigInt(index) - n + 1n) * value, 0n), n * total) : null,
    outsideRoster: Object.entries(rewards).filter(([accountId]) => !roster.includes(accountId)).map(([accountId, amount]) => ({ accountId, quantity: amount })) };
}

export function createWorldEconomyMetrics({ roster, initial, logicalAt, streamId }) {
  assert(Array.isArray(roster) && roster.length && roster.every(id => typeof id === 'string' && id));
  assert.equal(new Set(roster).size, roster.length); assert(Number.isSafeInteger(logicalAt)); assert(typeof streamId === 'string' && streamId);
  const config = { format: 1, roster: [...roster].sort(), contract: economyDigest(WORLD_ECONOMY_METRICS_CONTRACT) };
  let state = { config, startAt: logicalAt, logicalAt, streamId, lastSequence: 0, lastBoundary: null,
    nativeHash: economySnapshotHash(initial), stocks: economyStocks(initial), stockTime: {}, flows: {}, playerFlows: {}, rewards: {}, rewardCategories: {},
    missing: {}, boundaries: 0, freshReceipts: 0, freshItemEvents: 0, samples: [], chain: economyDigest(config) };
  function integrate(at) {
    assert(Number.isSafeInteger(at) && at >= state.logicalAt, 'Logical time must be monotonic');
    const elapsed = at - state.logicalAt;
    for (const [resource, value] of Object.entries(state.stocks.values)) add(state.stockTime, resource, multiply(value, elapsed));
    state.logicalAt = at;
  }
  function result(label) {
    const elapsed = state.logicalAt - state.startAt;
    const resources = [...new Set([...Object.keys(state.stocks.values), ...Object.keys(state.flows), ...Object.keys(state.rewards)])].sort();
    return { format: 1, label, logicalAt: state.logicalAt, elapsedMs: elapsed, nativeHash: state.nativeHash, boundaryChain: state.chain,
      boundaries: state.boundaries, freshReceipts: state.freshReceipts, freshItemEvents: state.freshItemEvents,
      resources: resources.map(resource => {
        const flows = { created: '0', destroyed: '0', transferred: '0', custody: '0', ...state.flows[resource] };
        return { resource, stockScope: state.stocks.scopes[resource] || 'No observed reference holdings for this resource',
          observedStock: state.stocks.values[resource] || '0', stockTimeUnitsMs: state.stockTime[resource] || '0',
          meanObservedStock: elapsed ? ratio(state.stockTime[resource] || '0', elapsed) : null,
          flows, flowScope: 'Classified observed movements only; missingCoverage can contain additional unclassified activity',
          unitsPerLogicalDay: Object.fromEntries(Object.entries(flows).map(([type, amount]) => [type, elapsed ? ratio(multiply(amount, DAY), elapsed) : null])),
          transferTurnover: elapsed ? ratio(multiply(flows.transferred, elapsed), state.stockTime[resource] || '0') : null,
          perPlayerFlows: config.roster.map(accountId => ({ accountId, created: '0', destroyed: '0', transferredIn: '0', transferredOut: '0', custody: '0',
            ...state.playerFlows[resource]?.[accountId] })),
          reward: concentration(config.roster, state.rewards[resource] || {}),
          rewardCategories: Object.entries(state.rewardCategories[resource] || {}).map(([category, rewards]) => ({ category, ...concentration(config.roster, rewards) })) };
      }), missingCoverage: Object.values(state.missing), scope: WORLD_ECONOMY_METRICS_CONTRACT.coverage };
  }
  return {
    observe({ event, journal, before, after }) {
      assert(Number.isSafeInteger(event.sequence) && event.sequence > 0);
      assert(['COMMITTED', 'AUTOCOMMITTED', 'ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome));
      assert.deepEqual(journal.identity, event, 'Journal belongs to another boundary');
      assert.equal(journal.beforeHash, economySnapshotHash(before)); assert.equal(journal.afterHash, economySnapshotHash(after));
      const boundary = economyDigest({ streamId: state.streamId, event, journal });
      if (event.sequence === state.lastSequence && boundary === state.lastBoundary) return { duplicate: true, flows: [], missingCoverage: [] };
      assert(event.sequence > state.lastSequence, 'Stale/reordered native boundary');
      assert.equal(journal.beforeHash, state.nativeHash, 'Native state continuity lost');
      const at = event.context?.logicalAt; assert(Number.isSafeInteger(at) && at >= state.logicalAt, 'Boundary logical time regressed/missing');
      if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome)) assert.equal(journal.beforeHash, journal.afterHash, 'Aborted boundary changed committed resource state');
      const measured = classifyEconomyBoundary({ journal, before, after });
      const stocks = economyStocks(after);
      for (const flow of measured.flows) if (flow.reward) assert(flow.reward.accountId, 'Reward must have a canonical account recipient');
      // All validation completes before the accumulator changes.
      integrate(at);
      for (const flow of measured.flows) {
        state.flows[flow.resource] ||= {}; add(state.flows[flow.resource], flow.type, flow.amount);
        const playerFlow = (owner, type) => {
          if (!owner?.startsWith('account:')) return;
          const accountId = owner.slice(8); state.playerFlows[flow.resource] ||= {}; state.playerFlows[flow.resource][accountId] ||= {};
          add(state.playerFlows[flow.resource][accountId], type, flow.amount);
        };
        if (flow.type === 'created') playerFlow(flow.to, 'created');
        if (flow.type === 'destroyed') playerFlow(flow.from, 'destroyed');
        if (flow.type === 'custody') playerFlow(flow.from, 'custody');
        if (flow.type === 'transferred') { playerFlow(flow.from, 'transferredOut'); playerFlow(flow.to, 'transferredIn'); }
        if (flow.reward) {
          state.rewards[flow.resource] ||= {}; add(state.rewards[flow.resource], flow.reward.accountId, flow.amount);
          state.rewardCategories[flow.resource] ||= {}; state.rewardCategories[flow.resource][flow.reward.category] ||= {};
          add(state.rewardCategories[flow.resource][flow.reward.category], flow.reward.accountId, flow.amount);
        }
      }
      for (const missing of measured.missingCoverage) {
        const key = JSON.stringify([missing.kind, missing.resource, missing.reason, missing.group, missing.movementKind, missing.eventKind,
          missing.observation?.kind, missing.observation?.table]);
        state.missing[key] ||= { key: JSON.parse(key), count: 0, firstBoundary: event.sequence, firstStreamId: state.streamId, example: missing };
        state.missing[key].count++;
      }
      // Preserve stock definitions for resources that have reached zero.
      stocks.scopes = { ...state.stocks.scopes, ...stocks.scopes };
      for (const resource of Object.keys(state.stocks.values)) stocks.values[resource] ??= '0';
      state.stocks = stocks; state.nativeHash = journal.afterHash; state.lastSequence = event.sequence; state.lastBoundary = boundary;
      state.boundaries++; state.freshReceipts += measured.freshReceipts; state.freshItemEvents += measured.freshItemEvents;
      state.chain = economyDigest({ prior: state.chain, boundary, measured });
      return { duplicate: false, ...measured, boundaryChain: state.chain };
    },
    sample(at = state.logicalAt, label = null) {
      integrate(at); const sample = result(label); state.samples.push(sample); return clone(sample);
    },
    summary() { return { ...clone(result('final')), timeSeries: clone(state.samples), definitions: WORLD_ECONOMY_METRICS_CONTRACT }; },
    checkpoint() { return { format: 1, state: clone(state), sha256: economyDigest(state) }; },
    restore(checkpoint, nativeSnapshot, options = {}) {
      assert.equal(checkpoint.format, 1); assert.equal(checkpoint.sha256, economyDigest(checkpoint.state), 'Economy checkpoint digest mismatch');
      assert.deepEqual(checkpoint.state.config, config, 'Economy checkpoint roster/contract mismatch');
      assert.equal(checkpoint.state.nativeHash, economySnapshotHash(nativeSnapshot), 'Economy checkpoint native state mismatch');
      const restored = clone(checkpoint.state);
      if (options.streamId != null && options.streamId !== restored.streamId) {
        assert(typeof options.streamId === 'string' && options.streamId); restored.streamId = options.streamId;
        restored.lastSequence = 0; restored.lastBoundary = null;
      }
      state = restored; return this;
    },
  };
}
