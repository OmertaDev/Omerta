// Read-only scoped observer. Canonical ledgers remain the resource authorities.
import assert from 'node:assert/strict';
import { DESK, DESK_RECYCLE_REASON } from '../src/rules.js';
import { exactSum, negate, sha256 } from './rc1-resource-journal.js';

export const WORLD_RESOURCE_TABLES = Object.freeze([
  'characters', 'account_persistent', 'transactions', 'gangs', 'amm_pool', 'street_tax', 'stake_pool', 'dev_fund',
  'rwa_dividend_pool', 'rwa_family_dividend_pool', 'family_yield_pool', 'desk_inventory', 'loans', 'auctions', 'auction_consignments',
  'item_stacks', 'item_instances', 'item_lots', 'item_events', 'item_mutation_inputs', 'item_mutation_outputs', 'item_mutation_guards',
  'operation_escrow', 'world_operation_capital', 'world_operation_events', 'world_operation_commitments',
  'cars', 'boats', 'account_gear', 'market_listings', 'listings', 'bounties', 'commission_proposals', 'favors',
  'loan_house', 'convoy_insurance', 'poker_tournaments', 'poker_entries', 'grand_prix', 'grand_prix_entries',
  'stakes_races', 'stakes_entries', 'district_bids', 'shipment_days', 'shipment_takes', 'bespoke_pieces', 'bespoke_serials',
  'campaign_progress', 'drop_allocations', 'chain_reserve', 'vouchers', 'rng_audit', 'telemetry', 'season_records', 'season_recaps',
]);
const json = (value) => JSON.stringify(value);
const tuple = (...parts) => json(parts);
const sorted = (rows) => rows.sort((a, b) => json(a).localeCompare(json(b)));
const columnsCache = new WeakMap();
const rows = (state, table) => { assert(Array.isArray(state.tables[table]), `Missing observed table ${table}`); return state.tables[table]; };
const stable = ({ boundary, ...value }) => value;
export const worldResourceHash = (state) => sha256(stable(state));
const canonical = value => Array.isArray(value) ? `[${value.map(canonical).join(',')}]`
  : value && typeof value === 'object' ? `{${Object.keys(value).sort().map(key => `${json(key)}:${canonical(value[key])}`).join(',')}}` : json(value);
const rowBytes = values => values.map(canonical).sort();
const multiset = values => { const counts = new Map(); for (const value of values) counts.set(value, (counts.get(value) || 0) + 1); return counts; };

// Restricted evidence, never an actor projection or a public coverage summary.
// Removed/added row multisets preserve every field and duplicate. They make no
// unsupported guess about which identity or owner a changed row represents.
export function resourceTableChanges(before, after) {
  const tables = [];
  for (const table of WORLD_RESOURCE_TABLES) {
    const prior = rowBytes(rows(before, table)), final = rowBytes(rows(after, table));
    if (json(prior) === json(final)) continue;
    const a = multiset(prior), b = multiset(final), beforeRows = [], afterRows = [];
    for (const key of new Set([...a.keys(), ...b.keys()])) {
      for (let i = b.get(key) || 0; i < (a.get(key) || 0); i++) beforeRows.push(JSON.parse(key));
      for (let i = a.get(key) || 0; i < (b.get(key) || 0); i++) afterRows.push(JSON.parse(key));
    }
    tables.push({ table, beforeHash: sha256(prior), afterHash: sha256(final), beforeCount: prior.length, afterCount: final.length,
      unchangedCount: prior.length - beforeRows.length, beforeRows, afterRows });
  }
  return { format: 1, classification: 'RESTRICTED_RESOURCE_EVIDENCE', beforeHash: worldResourceHash(before),
    afterHash: worldResourceHash(after), tables, statement: 'Exact observed row changes only; unsupported lineage remains unsupported' };
}

export function verifyResourceTableChanges(before, after, changes) {
  assert.equal(changes.classification, 'RESTRICTED_RESOURCE_EVIDENCE');
  assert.equal(changes.beforeHash, worldResourceHash(before)); assert.equal(changes.afterHash, worldResourceHash(after));
  const changed = indexed(changes.tables, r => r.table, 'changed tables');
  for (const table of WORLD_RESOURCE_TABLES) {
    const prior = rowBytes(rows(before, table)), final = rowBytes(rows(after, table)), delta = changed.get(table);
    if (!delta) { assert.deepEqual(final, prior, `Missing changed table ${table}`); continue; }
    assert.equal(delta.beforeHash, sha256(prior)); assert.equal(delta.afterHash, sha256(final));
    assert.equal(delta.beforeCount, prior.length); assert.equal(delta.afterCount, final.length);
    assert.equal(delta.unchangedCount, prior.length - delta.beforeRows.length);
    const reconstructed = multiset(prior);
    for (const removed of rowBytes(delta.beforeRows)) {
      assert((reconstructed.get(removed) || 0) > 0, `Missing exact before row for ${table}`);
      reconstructed.set(removed, reconstructed.get(removed) - 1);
    }
    for (const added of rowBytes(delta.afterRows)) reconstructed.set(added, (reconstructed.get(added) || 0) + 1);
    assert.deepEqual([...reconstructed].flatMap(([row, count]) => Array(count).fill(row)).sort(), final,
      `Changed rows cannot reconstruct ${table}; owner/custody/value detail was lost`);
  }
  assert([...changed.keys()].every(table => WORLD_RESOURCE_TABLES.includes(table)), 'Unobserved table in diagnostics');
  return true;
}

export async function snapshotWorldResources(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    let columns = columnsCache.get(pool);
    if (!columns) {
      columns = (await client.query(`SELECT table_name,column_name,data_type FROM information_schema.columns
        WHERE table_schema=current_schema() AND table_name=ANY($1::text[]) ORDER BY table_name,ordinal_position`, [WORLD_RESOURCE_TABLES])).rows;
      for (const table of WORLD_RESOURCE_TABLES) assert(columns.some(c => c.table_name === table), `Required resource table missing: ${table}`);
      columnsCache.set(pool, columns);
    }
    const tables = {};
    for (const table of WORLD_RESOURCE_TABLES) {
      const selection = columns.filter(c => c.table_name === table).map(c => {
        assert(/^[a-z_][a-z_0-9]*$/.test(c.column_name));
        return `"${c.column_name}"${['numeric', 'decimal', 'bigint'].includes(c.data_type) ? '::text' : ''} AS "${c.column_name}"`;
      }).join(',');
      // JSON roundtrip normalizes pg Date objects, never NUMERIC (explicitly text).
      tables[table] = sorted(JSON.parse(json((await client.query(`SELECT ${selection} FROM "${table}"`)).rows)));
    }
    const boundary = (await client.query('SELECT pg_current_snapshot()::text AS snapshot')).rows[0];
    await client.query('COMMIT'); return { format: 1, tables, boundary };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function indexed(values, key, label) {
  const result = new Map();
  for (const row of values) { const id = key(row); assert(!result.has(id), `${label}: duplicate identity ${id}`); result.set(id, row); }
  return result;
}
function appendOnly(before, after, table, key = row => row.id) {
  const prior = indexed(rows(before, table), key, table), final = indexed(rows(after, table), key, table);
  for (const [id, row] of prior) assert.deepEqual(final.get(id), row, `Immutable ${table} receipt removed or rewritten: ${id}`);
  return [...final].filter(([id]) => !prior.has(id)).map(([, row]) => row);
}
const net = (receipts, predicate) => exactSum(receipts.filter(predicate).map(row => row.amount));
function parity(checks, { resource, owner, before, after, expectedDelta = '0', authority, kind = 'receipt-parity' }) {
  const expected = exactSum([before, expectedDelta]), drift = exactSum([after, negate(expected)]);
  const check = { kind, resource, owner, before: exactSum([before]), after: exactSum([after]), expectedDelta: exactSum([expectedDelta]), expected, drift, authority };
  checks.push(check); assert.equal(drift, '0', `Unexplained ${resource} movement for ${owner}: ${json(check)}`);
}
const reference = (table, entries) => entries.map(row => ({ table, id: row.id ?? tuple(row.mutation_id, row.input_ordinal ?? row.output_ordinal) }));

export function omrBuckets(state) {
  const result = [];
  const add = (table, field, predicate = () => true) => {
    for (const row of rows(state, table).filter(predicate)) result.push({ table, owner: row.account_id ?? row.id, field, amount: exactSum([row[field]]) });
  };
  // rewards is a claim on the funded pool, not an additional supply bucket.
  for (const field of ['omr', 'staked', 'unbonding']) add('account_persistent', field);
  for (const [table, field] of [['amm_pool', 'omr_reserve'], ['street_tax', 'fund'], ['gangs', 'omr_reserve'],
    ['stake_pool', 'balance'], ['dev_fund', 'omr'], ['rwa_dividend_pool', 'pool'], ['rwa_family_dividend_pool', 'pool'],
    ['family_yield_pool', 'balance'], ['desk_inventory', 'balance']]) add(table, field);
  add('loans', 'collateral_omr', row => row.status === 'active');
  for (const table of ['auctions', 'auction_consignments']) add(table, 'current_bid', row => row.status === 'live');
  return result;
}
const matches = (reason, pattern) => pattern.endsWith('%') ? reason.startsWith(pattern.slice(0, -1)) : reason === pattern;
const reasonClasses = [
  ['cash', /^crime:/, 'crime cash receipt'], ['cash', /^npc:seed$/, 'resident birth cash source'],
  ['cash', /^gang:found$/, 'Family formation cash sink'], ['cash', /^loan:(offer|take|refund|repay|death|loot|paper|collect|vig|house:)/, 'loan custody receipt'],
  ['cash', /^coordination:capital:(deposit|refund|spend|forfeit)$/, 'operation capital receipt'],
  ['cash', /^(campaign:|craft:hardening$|death:(estate|legacy)$|travel$)/, 'focused native cash receipt'],
  ['ammo', /^(melt|craft:ammo|ammo:buy|death:|fire$|jump$)/, 'ammo receipt'], ['cb', /^(crime:|craft:|death:|cook:)/, 'contraband receipt'],
  ['omr', /^(loan:|desk:|gang:tribute$|vanity:|rarity:upgrade$|death:duty$|yield:|stake:|swap:|auction:|withdraw:omr$|drop:claim$)/, 'OMR custody or supply receipt'],
];

export function reconcileWorldResources(before, after, { identity = null, includeRestrictedChanges = false } = {}) {
  assert.equal(before.format, 1); assert.equal(after.format, 1);
  const checks = [], unsupported = [];
  const receipts = appendOnly(before, after, 'transactions');
  const events = appendOnly(before, after, 'item_events');
  const inputs = appendOnly(before, after, 'item_mutation_inputs', r => tuple(r.mutation_id, r.input_ordinal));
  const outputs = appendOnly(before, after, 'item_mutation_outputs', r => tuple(r.mutation_id, r.output_ordinal));
  appendOnly(before, after, 'world_operation_events');
  const priorGuards = rows(before, 'item_mutation_guards').filter(r => r.completed_at && r.result_json);
  const finalGuards = indexed(rows(after, 'item_mutation_guards'), r => r.idempotency_key, 'guards');
  for (const guard of priorGuards) assert.deepEqual(finalGuards.get(guard.idempotency_key), guard, 'Completed mutation guard rewritten');
  for (const event of events) {
    const guard = finalGuards.get(event.idempotency_key);
    assert(guard?.completed_at && guard.result_json, `Item event lacks completed mutation guard: ${event.id}`);
    if (event.mutation_id) {
      assert.equal(guard.mutation_id, event.mutation_id, 'Event mutation identity mismatch');
      const creation = ['lot_granted', 'lot_split_output', 'unique_granted', 'migration_origin'].includes(event.event_kind);
      const linked = (creation ? outputs : inputs).filter(r => r.event_id === event.id);
      assert.equal(linked.length, 1, 'Normalized event must have exactly one matching input/output');
      assert.equal(linked[0][creation ? 'output_ordinal' : 'input_ordinal'], event.event_ordinal, 'Mutation ordinal mismatch');
    }
  }
  for (const receipt of receipts) if (!reasonClasses.some(([currency, pattern]) => currency === receipt.currency && pattern.test(receipt.reason)))
    unsupported.push({ kind: 'receipt-reason', currency: receipt.currency, reason: receipt.reason, receiptId: receipt.id });

  const priorPeople = indexed(rows(before, 'characters'), r => r.id, 'characters'), finalPeople = indexed(rows(after, 'characters'), r => r.id, 'characters');
  for (const id of priorPeople.keys()) assert(finalPeople.has(id), `Character row deleted without supported birth/retirement lineage: ${id}`);
  for (const [id, person] of finalPeople) {
    const prior = priorPeople.get(id);
    for (const currency of ['cash', 'ammo', 'cb']) {
      const matched = receipts.filter(r => r.character_id === id && r.currency === currency);
      const birth = prior ? '0' : currency === 'cash' ? '500' : currency === 'ammo' ? '25' : '0';
      parity(checks, { resource: currency, owner: `character:${id}`,
        before: prior ? currency === 'cash' ? exactSum([prior.cash, prior.bank]) : prior[currency] : '0',
        after: currency === 'cash' ? exactSum([person.cash, person.bank]) : person[currency],
        expectedDelta: exactSum([birth, ...matched.map(r => r.amount)]),
        authority: [...reference('transactions', matched), ...(!prior ? [{ rule: 'Canonical character defaults: cash500/ammo25/cb0' }] : [])] });
    }
  }
  for (const receipt of receipts.filter(r => r.character_id && ['cash', 'ammo', 'cb'].includes(r.currency)))
    assert(finalPeople.has(receipt.character_id), `Personal receipt references an unobserved character: ${receipt.id}`);

  const omrBefore = omrBuckets(before), omrAfter = omrBuckets(after), omrReceipts = receipts.filter(r => r.currency === 'omr');
  const mint = r => r.reason.startsWith('mission:') || r.reason.startsWith('emission:') || ['prize:omr', 'desk:buyback', 'yield:buyback', 'drop:claim'].includes(r.reason);
  const burn = r => [...DESK.SINK_REASONS, DESK_RECYCLE_REASON].some(pattern => matches(r.reason, pattern));
  parity(checks, { resource: 'omr', owner: 'all-canonical-in-game-buckets', before: exactSum(omrBefore.map(r => r.amount)),
    after: exactSum(omrAfter.map(r => r.amount)), expectedDelta: exactSum([net(omrReceipts, mint), net(omrReceipts, burn)]),
    authority: reference('transactions', omrReceipts), kind: 'exact-supply-parity' });
  // Preserve every bucket delta even where source/destination lineage is not implemented yet.
  const bucketKey = r => tuple(r.table, r.owner, r.field), oldBuckets = indexed(omrBefore, bucketKey, 'OMR bucket'), newBuckets = indexed(omrAfter, bucketKey, 'OMR bucket');
  const omrMovements = [...new Set([...oldBuckets.keys(), ...newBuckets.keys()])].map(key => ({ key,
    before: oldBuckets.get(key)?.amount ?? '0', after: newBuckets.get(key)?.amount ?? '0' }))
    .filter(r => exactSum([r.after, negate(r.before)]) !== '0');
  if (omrMovements.length) unsupported.push({ kind: 'omr-owner-lineage', detail: 'Aggregate exact supply checked; full per-owner transfer attribution is not yet implemented', buckets: omrMovements.map(r => r.key) });

  const stackKey = r => tuple(r.owner_scope, r.owner_id, r.template_id, r.quality);
  const oldStacks = indexed(rows(before, 'item_stacks'), stackKey, 'stacks'), newStacks = indexed(rows(after, 'item_stacks'), stackKey, 'stacks');
  const stackEvents = events.filter(e => ['stack_granted', 'stack_consumed'].includes(e.event_kind));
  const eventStackKey = e => tuple(e.event_kind === 'stack_granted' ? e.to_owner_scope : e.from_owner_scope,
    e.event_kind === 'stack_granted' ? e.to_owner_id : e.from_owner_id, e.template_id, e.quality);
  for (const key of new Set([...oldStacks.keys(), ...newStacks.keys(), ...stackEvents.map(eventStackKey)])) {
    const matched = stackEvents.filter(e => eventStackKey(e) === key).sort((a,b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);
    let quantity = oldStacks.get(key)?.quantity ?? 0;
    for (const event of matched) {
      assert.equal(exactSum([event.quantity_before]), exactSum([quantity]), 'Stack event prior quantity mismatch');
      assert.equal(exactSum([event.quantity_before, event.quantity_delta]), exactSum([event.quantity_after]), 'Stack event internal quantity mismatch');
      quantity = event.quantity_after;
    }
    parity(checks, { resource: 'stack', owner: key, before: oldStacks.get(key)?.quantity ?? 0, after: newStacks.get(key)?.quantity ?? 0,
      expectedDelta: exactSum(matched.map(e => e.quantity_delta)), authority: reference('item_events', matched) });
  }

  const eventById = indexed(rows(after, 'item_events'), r => r.id, 'item events');
  for (const input of inputs) {
    const event = eventById.get(input.event_id); assert(event, 'Input lacks immutable event');
    assert.equal(input.mutation_id, event.mutation_id); assert.equal(input.definition_hash, event.definition_hash);
    assert.equal(input.snapshot_json, event.snapshot_json); assert.equal(input.lot_id, event.lot_id); assert.equal(input.item_id, event.item_id);
    assert.equal(exactSum([input.quantity_before, negate(input.removed_quantity)]), exactSum([input.quantity_after]), 'Input internal quantity mismatch');
  }
  for (const output of outputs) {
    const event = eventById.get(output.event_id); assert(event, 'Output lacks immutable event');
    assert.equal(output.mutation_id, event.mutation_id); assert.equal(output.definition_hash, event.definition_hash);
    assert.equal(output.snapshot_json, event.snapshot_json); assert.equal(output.lot_id, event.lot_id); assert.equal(output.item_id, event.item_id);
    assert.equal(exactSum([output.quantity]), event.event_branch === 'observation' ? '0' : exactSum([event.quantity_after]), 'Output quantity mismatch');
  }
  for (const [table, field, idField] of [['item_lots', 'remaining_quantity', 'lot_id'], ['item_instances', null, 'id']]) {
    const old = indexed(rows(before, table), r => r[idField], table), next = indexed(rows(after, table), r => r[idField], table);
    for (const id of new Set([...old.keys(), ...next.keys()])) {
      assert(next.has(id), `Audited item disappeared: ${table}/${id}`);
      const prior = old.get(id), final = next.get(id), quantity = r => !r ? 0 : field ? r[field] : r.state === 'consumed' ? 0 : 1;
      const matched = events.filter(e => field ? e.lot_id === id : e.item_id === id).sort((a,b) => BigInt(a.sequence) < BigInt(b.sequence) ? -1 : 1);
      let current = quantity(prior), owner = prior ? tuple(prior.owner_scope, prior.owner_id) : null;
      for (const event of matched) {
        if (event.event_branch === 'observation') { assert(prior, 'Observation cannot create an item'); continue; }
        const created = ['created', 'lot_granted', 'lot_split_output', 'unique_granted'].includes(event.event_kind);
        const consumed = ['consumed', 'unique_consumed'].includes(event.event_kind);
        const beforeQuantity = event.quantity_before ?? (created ? 0 : 1), afterQuantity = event.quantity_after ?? (consumed ? 0 : 1);
        assert.equal(exactSum([beforeQuantity]), exactSum([current]), 'Item event prior quantity mismatch');
        if (event.from_owner_scope) assert.equal(tuple(event.from_owner_scope, event.from_owner_id), owner, 'Item event owner mismatch');
        if (event.to_owner_scope) owner = tuple(event.to_owner_scope, event.to_owner_id);
        current = afterQuantity;
        if (event.quantity_delta != null) assert.equal(exactSum([beforeQuantity, event.quantity_delta]), exactSum([afterQuantity]), 'Item event internal quantity mismatch');
      }
      assert.equal(exactSum([current]), exactSum([quantity(final)]), 'Item final quantity lacks event lineage');
      assert.equal(owner, tuple(final.owner_scope, final.owner_id), 'Item final owner lacks event lineage');
      if (!matched.length) assert.deepEqual(final, prior, 'Item state changed without an event');
      checks.push({ kind: 'event-quantity-owner-parity', resource: table, owner: id, before: exactSum([quantity(prior)]), after: exactSum([quantity(final)]), drift: '0', authority: reference('item_events', matched) });
    }
  }

  const held = (state, id) => exactSum(rows(state, 'world_operation_capital').filter(r => r.operation_id === id && r.state === 'held').map(r => r.amount));
  const oldCapital = indexed(rows(before, 'world_operation_capital'), r => tuple(r.operation_id, r.role_id, r.requirement_id), 'operation capital');
  const newCapital = indexed(rows(after, 'world_operation_capital'), r => tuple(r.operation_id, r.role_id, r.requirement_id), 'operation capital');
  for (const [key, prior] of oldCapital) {
    const final = newCapital.get(key); assert(final, 'Capital disposition row removed');
    if (prior.state === 'held' && ['account_id', 'character_id', 'amount'].some(field => final[field] !== prior[field])) {
      const closed = receipts.some(r => r.currency === 'cash' && r.counterparty === prior.operation_id
        && ['coordination:capital:refund', 'coordination:capital:spend', 'coordination:capital:forfeit'].includes(r.reason)
        && exactSum([String(r.amount).startsWith('-') ? negate(r.amount) : r.amount]) === exactSum([prior.amount]));
      const reopened = receipts.some(r => r.currency === 'cash' && r.counterparty === final.operation_id
        && r.reason === 'coordination:capital:deposit' && r.character_id === final.character_id
        && exactSum([negate(r.amount)]) === exactSum([final.amount]));
      assert(closed && reopened, 'Held capital owner/amount rewritten without a disposition');
      // Multiple commits in one job can close then refill a role. These receipts
      // prevent accepting an unexplained rewrite; exact role attribution remains
      // explicitly unsupported until operation revision events are replayed.
    }
  }
  for (const id of new Set([...rows(before, 'world_operation_capital'), ...rows(after, 'world_operation_capital')].map(r => r.operation_id))) {
    const matched = receipts.filter(r => r.currency === 'cash' && r.counterparty === id && r.reason.startsWith('coordination:capital:'));
    const term = reason => net(matched, r => r.reason === `coordination:capital:${reason}`);
    parity(checks, { resource: 'cash', owner: `operation:${id}`, before: held(before, id), after: held(after, id),
      expectedDelta: exactSum([negate(term('deposit')), negate(term('refund')), term('spend'), term('forfeit')]), authority: reference('transactions', matched) });
  }
  if (json(rows(before, 'world_operation_capital')) !== json(rows(after, 'world_operation_capital')))
    unsupported.push({ kind: 'capital-role-lineage', detail: 'Exact personal and per-operation held cash checked; full role/revision event linkage remains to be integrated' });
  const loanHeld = state => exactSum(rows(state, 'loans').filter(r => r.status === 'open').map(r => r.principal));
  parity(checks, { resource: 'cash', owner: 'open-loan-escrow', before: loanHeld(before), after: loanHeld(after),
    expectedDelta: exactSum([negate(net(receipts, r => r.currency === 'cash' && ['loan:offer', 'loan:take', 'loan:refund'].includes(r.reason))),
      net(receipts, r => r.currency === 'cash' && ['loan:death', 'loan:loot'].includes(r.reason))]),
    authority: reference('transactions', receipts.filter(r => r.reason.startsWith('loan:'))) });
  const observedOnly = ['cars', 'boats', 'account_gear', 'market_listings', 'listings', 'bounties', 'commission_proposals', 'favors',
    'loan_house', 'convoy_insurance', 'poker_tournaments', 'poker_entries', 'grand_prix', 'grand_prix_entries', 'stakes_races',
    'stakes_entries', 'district_bids', 'shipment_days', 'shipment_takes', 'bespoke_pieces', 'bespoke_serials', 'campaign_progress',
    'drop_allocations', 'chain_reserve', 'vouchers', 'season_records', 'season_recaps', 'operation_escrow'];
  for (const table of observedOnly) if (json(rows(before, table)) !== json(rows(after, table)))
    unsupported.push({ kind: 'observed-table-change', table, detail: 'Change observed; complete resource disposition classifier is not implemented' });
  if (json(rows(before, 'gangs')) !== json(rows(after, 'gangs')))
    unsupported.push({ kind: 'family-lineage', detail: 'Family rows retained; per-Family cash/ammo/spoils attribution is not implemented' });
  const restrictedChanges = unsupported.length ? resourceTableChanges(before, after) : null;
  if (restrictedChanges) verifyResourceTableChanges(before, after, restrictedChanges);
  return { format: 1, identity, beforeHash: worldResourceHash(before), afterHash: worldResourceHash(after), receipts,
    itemEvents: events, mutationInputs: inputs, mutationOutputs: outputs, checks, omrBuckets: { before: omrBefore, after: omrAfter, movements: omrMovements },
    unsupported, restrictedChangesSha256: restrictedChanges ? sha256(restrictedChanges) : null,
    ...(includeRestrictedChanges && restrictedChanges ? { restrictedChanges } : {}),
    status: unsupported.length ? 'PASS_PARITY_WITH_UNSUPPORTED_LINEAGE' : 'PASS_SCOPED_PARITY', qualifyingFullResourcePass: false,
    coverageMissing: ['Complete cash creation/destruction/transfer taxonomy', 'Every OMR per-owner transfer lineage and real-chain backing',
      'Full lot definitions, mutation provenance and custody semantics (retain canonical invariant checks)',
      'Legacy inventory and remaining escrow/Family/season/contract lineage', 'Per-commit proxy integration, overlapping transactions and compound abort traces'] };
}

export function createWorldResourceObserver({ pool, record = async () => {}, requireSupportedReasons = false }) {
  let active = false;
  return { snapshot: () => snapshotWorldResources(pool),
    async observe(identity, work) {
      assert(!active, 'Resource observations must be isolated; overlapping/nested before-after scopes misattribute commits'); active = true;
      let before, after, value, actionError, journal;
      try {
        before = await snapshotWorldResources(pool);
        try { value = await work(); } catch (error) { actionError = error; }
        after = await snapshotWorldResources(pool); journal = reconcileWorldResources(before, after, { identity });
        await record({ kind: 'world-resource-boundary', journal, actionOutcome: actionError ? 'THREW' : 'RETURNED',
          ...(actionError ? { actionError: { code: actionError.code, message: actionError.message } } : {}) });
        if (requireSupportedReasons) assert.equal(journal.unsupported.length, 0, 'Unsupported resource transition encountered');
        if (actionError) throw actionError;
        return value;
      } catch (error) {
        await record({ kind: 'world-resource-failure', identity, before, after, journal, error: { code: error.code, message: error.message, stack: error.stack } });
        throw error;
      } finally { active = false; }
    },
  };
}
