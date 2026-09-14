// Dormant exact lot storage and normalized lineage under the existing private item mutation root.
// Trusted producers derive output quality; this module validates and preserves its representation.
import { randomUUID } from 'node:crypto';
import { types } from 'node:util';
import { GameError } from './game.js';
import { canonicalBytes } from './content/canonical.js';
import { definitionByHash } from './itemdefinitions.js';
import { itemMutationContext, nextItemMutationOrdinal, assertLotDefinitionPin,
  assertLotCandidateRoot, assertAndUseLotTransition, registerItemTransactionUndo, poisonItemTransaction, withItemRead } from './items.js';
import { compareItemLockEntries } from './item-lock-trace.js';
import { dbCaps } from './db.js';

const IDENTITY_KEYS = Object.freeze(['logicalItemId', 'definitionHash', 'owner', 'custody',
  'qualityBand', 'qualityStateDigest', 'tradePolicyHash', 'binding', 'transferRestriction',
  'seasonId', 'runId', 'sourceCapId', 'expiresAt', 'ageBasisAt', 'provenanceCoalescingClass']);
const CANDIDATE_PLANS = new WeakMap();
const CANDIDATE_CREATED_AT = new WeakMap();
const fail = (code = 'bad_item_request') => { throw new GameError(code, 'Exact item request cannot be applied.'); };
const equal = (a, b) => canonicalBytes(a).equals(canonicalBytes(b));
const instant = (value) => value == null ? null : new Date(value).toISOString();
const databaseSnapshot = (value) => JSON.parse(JSON.stringify(value));
function text(value, max = 200) {
  if (typeof value !== 'string' || !value.length || value.length > max || value.trim() !== value) fail();
  return value;
}
function exact(value, keys) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || types.isProxy(value)
    || Reflect.ownKeys(value).length !== keys.length) fail();
  const result = {};
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value') || !descriptor.enumerable) fail();
    result[key] = descriptor.value;
  }
  return result;
}
function detach(value) {
  const queue = [{ value, depth: 0 }]; let count = 0;
  while (queue.length) {
    const current = queue.pop();
    if (++count > 4096 || current.depth > 32) fail();
    if (current.value && typeof current.value === 'object') {
      if (types.isProxy(current.value)) fail();
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(current.value))) {
        if (!Object.hasOwn(descriptor, 'value') || ['__proto__', 'constructor', 'prototype'].includes(key)) fail();
        queue.push({ value: descriptor.value, depth: current.depth + 1 });
      }
    }
  }
  try {
    const bytes = canonicalBytes(value);
    if (bytes.length > 65536) fail();
    return JSON.parse(bytes.toString('utf8'));
  } catch { fail(); }
}
function hash(value) { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) fail(); return value; }
function owner(value) {
  const result = exact(value, ['scope', 'id']);
  if (!['character', 'account', 'operation'].includes(result.scope)) fail();
  text(result.id); return result;
}
function custody(value) {
  const result = exact(value, ['state', 'scope', 'id']);
  if (result.state === 'direct') { if (result.scope !== null || result.id !== null) fail(); }
  else if (result.state === 'escrowed' && result.scope === 'operation') text(result.id);
  else fail();
  return result;
}
function token(value, nullable = true) {
  if (nullable && value === null) return null;
  if (typeof value !== 'string' || Buffer.byteLength(value) > 128
    || !/^[a-z][a-z0-9]*(?:[._-][a-z0-9]+)*$/.test(value)) fail();
  return value;
}
function quantity(value, maximum = 1000000) {
  if (!Number.isSafeInteger(value) || value < 1 || value > maximum) fail('qty');
  return value;
}
function validateLotQuality(definition, value) {
  const tuple = exact(value, ['qualityBand', 'qualityStateDigest']);
  if (tuple.qualityBand !== null) text(tuple.qualityBand, 80);
  if (tuple.qualityStateDigest !== null) hash(tuple.qualityStateDigest);
  const any = tuple.qualityBand !== null || tuple.qualityStateDigest !== null;
  if ((definition.qualityMode === 'none' && any)
    || (['fixed', 'bounded'].includes(definition.qualityMode) && !any)
    || !['none', 'fixed', 'inherited', 'bounded'].includes(definition.qualityMode)) fail();
  return Object.freeze(tuple);
}
function validateIdentity(input) {
  text(input.logicalItemId, 258); hash(input.definitionHash); hash(input.tradePolicyHash);
  input.owner = owner(input.owner); input.custody = custody(input.custody);
  token(input.binding); token(input.transferRestriction); token(input.provenanceCoalescingClass, false);
  for (const key of ['seasonId', 'runId', 'sourceCapId']) if (input[key] !== null) text(input[key]);
  for (const key of ['expiresAt', 'ageBasisAt']) {
    if (input[key] !== null && (typeof input[key] !== 'string'
      || !Number.isFinite(Date.parse(input[key])) || instant(input[key]) !== input[key])) fail();
  }
  if ((input.owner.scope === 'operation') !== (input.custody.state === 'escrowed')
    || (input.custody.state === 'escrowed' && input.custody.id !== input.owner.id)) fail();
  return input;
}
async function verifiedDefinition(client, input, supplied = null, depositor = null) {
  const definition = await definitionByHash(client, input.definitionHash);
  if (supplied && !equal(definition, supplied)) fail();
  if (!['material', 'item'].includes(definition.kind) || definition.stackable !== true
    || definition.logicalItemId !== input.logicalItemId || definition.tradePolicyHash !== input.tradePolicyHash
    || input.tradePolicyHash !== input.definitionHash
    || !(input.owner.scope === 'operation' ? depositor && definition.ownerScopes.includes('project')
      && definition.ownerScopes.includes(depositor.scope) : definition.ownerScopes.includes(input.owner.scope))) fail();
  quantity(input.quantity, definition.maximumLotQuantity);
  validateLotQuality(definition, { qualityBand: input.qualityBand, qualityStateDigest: input.qualityStateDigest });
  return definition;
}
function projection(row) {
  return { lotId: row.lot_id, logicalItemId: row.logical_item_id, definitionHash: row.definition_hash,
    owner: { scope: row.owner_scope, id: row.owner_id },
    custody: row.state === 'exhausted' ? null : { state: row.custody_state, scope: row.custody_scope, id: row.custody_id },
    qualityBand: row.quality_band, qualityStateDigest: row.quality_state_digest,
    tradePolicyHash: row.trade_policy_hash, binding: row.binding, transferRestriction: row.transfer_restriction,
    seasonId: row.season_id, runId: row.run_id, sourceCapId: row.source_cap_id,
    expiresAt: instant(row.expires_at), ageBasisAt: instant(row.age_basis_at), ageBasis: instant(row.age_basis_at),
    provenanceCoalescingClass: row.provenance_coalescing_class,
    originalQuantity: row.original_quantity, remainingQuantity: row.remaining_quantity, state: row.state,
    mutationId: row.mutation_id, outputOrdinal: row.output_ordinal, sourceInputOrdinal: row.source_input_ordinal,
    createdAt: instant(row.created_at), updatedAt: instant(row.updated_at) };
}
function uniqueProjection(row, escrow = null) {
  return { id: row.id, logicalItemId: row.logical_item_id, definitionHash: row.definition_hash,
    owner: { scope: row.owner_scope, id: row.owner_id }, state: row.state,
    custody: row.state === 'consumed' ? null : row.state === 'escrowed'
      ? { state: 'escrowed', scope: 'operation', id: escrow?.operation_id ?? row.owner_id }
      : { state: 'direct', scope: null, id: null },
    qualityBand: row.quality_band, qualityStateDigest: row.quality_state_digest,
    tradePolicyHash: row.trade_policy_hash, conditionSummary: null, exportPolicy: row.export_policy,
    mutationId: row.mutation_id, outputOrdinal: row.output_ordinal,
    createdAt: instant(row.created_at), updatedAt: instant(row.updated_at), consumedAt: instant(row.consumed_at) };
}
export async function grantUnique(client, mutation, rawDefinition, rawOutput) {
  try {
    const context = itemMutationContext(client, mutation);
    const supplied = detach(rawDefinition);
    const input = exact(detach(rawOutput), ['logicalItemId', 'definitionHash', 'owner', 'qualityBand',
      'qualityStateDigest', 'tradePolicyHash', 'conditionSummary', 'exportPolicy', 'provenanceClass', 'provenanceDigest']);
    input.owner = owner(input.owner); text(input.logicalItemId, 258); hash(input.definitionHash); hash(input.tradePolicyHash); hash(input.provenanceDigest);
    if (input.owner.scope === 'operation' || input.conditionSummary !== null || input.exportPolicy !== 'ineligible'
      || !['crafted', 'salvaged', 'awarded', 'imported'].includes(input.provenanceClass)) fail();
    assertLotDefinitionPin(client, mutation, { owner: input.owner, definitionHash: input.definitionHash, direction: 'output' });
    const definition = await definitionByHash(client, input.definitionHash);
    if (!equal(definition, supplied) || !['material', 'item'].includes(definition.kind)
      || definition.stackable !== false || definition.logicalItemId !== input.logicalItemId
      || input.tradePolicyHash !== input.definitionHash || definition.tradePolicyHash !== input.tradePolicyHash
      || !definition.ownerScopes.includes(input.owner.scope)) fail();
    quantity(1, definition.maximumLotQuantity); validateLotQuality(definition, {
      qualityBand: input.qualityBand, qualityStateDigest: input.qualityStateDigest });
    const id = randomUUID(), eventId = randomUUID(), ordinal = nextItemMutationOrdinal(client, mutation);
    registerItemTransactionUndo(client, () => client.query('DELETE FROM item_instances WHERE id=$1', [id]));
    const row = (await client.query(`INSERT INTO item_instances
      (id,template_id,logical_item_id,definition_hash,owner_scope,owner_id,quality_band,quality_state_digest,
       trade_policy_hash,export_policy,provenance_class,provenance_digest,mutation_id,output_ordinal)
      VALUES ($1,$2,$2,$3,$4,$5,$6,$7,$3,'ineligible',$8,$9,$10,$11) RETURNING *`,
    [id, input.logicalItemId, input.definitionHash, input.owner.scope, input.owner.id, input.qualityBand,
      input.qualityStateDigest, input.provenanceClass, input.provenanceDigest, context.mutationId, ordinal])).rows[0];
    const result = uniqueProjection(row), snapshot = canonicalBytes({ ...result,
      provenanceClass: input.provenanceClass, provenanceDigest: input.provenanceDigest }).toString('utf8');
    await client.query(`INSERT INTO item_events
      (id,event_key,event_kind,template_id,quality,quantity_delta,quantity_before,quantity_after,
       to_owner_scope,to_owner_id,reason,idempotency_key,event_branch,mutation_id,event_ordinal,item_id,definition_hash,snapshot_json)
      VALUES ($1,$2,'unique_granted',$3,'standard',1,0,1,$4,$5,'exact unique output',$6,'unique',$7,$8,$9,$10,$11)`,
    [eventId, `unique:${ordinal}`, input.logicalItemId, input.owner.scope, input.owner.id, context.key,
      context.mutationId, ordinal, id, input.definitionHash, snapshot]);
    await client.query(`INSERT INTO item_mutation_outputs
      (mutation_id,output_ordinal,event_id,event_branch,definition_hash,item_id,quantity,transition_kind,snapshot_json,
       attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
      VALUES ($1,$2,$3,'unique',$4,$5,1,'grant',$6,$1,$2,1)`, [context.mutationId, ordinal, eventId, input.definitionHash, id, snapshot]);
    return result;
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}
async function writeGrant(client, mutation, input, sourceInputOrdinal = null, depositor = null) {
  const context = itemMutationContext(client, mutation), ordinal = nextItemMutationOrdinal(client, mutation);
  const lotId = randomUUID(), eventId = randomUUID(), split = sourceInputOrdinal !== null;
  registerItemTransactionUndo(client, () => client.query('DELETE FROM item_lots WHERE lot_id=$1', [lotId]));
  const row = (await client.query(`INSERT INTO item_lots
    (lot_id,logical_item_id,definition_hash,owner_scope,owner_id,custody_state,custody_scope,custody_id,
     quality_band,quality_state_digest,trade_policy_hash,binding,transfer_restriction,season_id,run_id,
     source_cap_id,expires_at,age_basis_at,provenance_coalescing_class,provenance_class,provenance_digest,
     original_quantity,remaining_quantity,mutation_id,output_ordinal,source_input_ordinal,state,depositor_scope,depositor_id)
    VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22,$23,$24,$25,$26,$27,$28)
    RETURNING *`, [lotId, input.logicalItemId, input.definitionHash, input.owner.scope, input.owner.id,
    input.custody.state, input.custody.scope, input.custody.id, input.qualityBand, input.qualityStateDigest,
    input.tradePolicyHash, input.binding, input.transferRestriction, input.seasonId, input.runId,
    input.sourceCapId, input.expiresAt, input.ageBasisAt, input.provenanceCoalescingClass,
    input.provenanceClass, input.provenanceDigest, input.quantity, context.mutationId, ordinal, sourceInputOrdinal,
    input.custody.state === 'escrowed' ? 'escrowed' : 'active', depositor?.scope ?? null, depositor?.id ?? null])).rows[0];
  const result = projection(row), snapshot = canonicalBytes({ ...result,
    provenanceClass: row.provenance_class, provenanceDigest: row.provenance_digest, depositor }).toString('utf8');
  await client.query(`INSERT INTO item_events
    (id,event_key,event_kind,template_id,quality,quantity_delta,quantity_before,quantity_after,
     to_owner_scope,to_owner_id,reason,idempotency_key,event_branch,mutation_id,event_ordinal,lot_id,definition_hash,snapshot_json)
    VALUES ($1,$2,$3,$4,'standard',$5,0,$5,$6,$7,'exact lot output',$8,'lot',$9,$10,$11,$12,$13)`,
  [eventId, `lot:${ordinal}`, split ? 'lot_split_output' : 'lot_granted', input.logicalItemId, input.quantity,
    input.owner.scope, input.owner.id, context.key, context.mutationId, ordinal, lotId, input.definitionHash, snapshot]);
  await client.query(`INSERT INTO item_mutation_outputs
    (mutation_id,output_ordinal,event_id,event_branch,definition_hash,lot_id,quantity,source_input_ordinal,
     source_transition_kind,transition_kind,snapshot_json,attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
    VALUES ($1,$2,$3,'lot',$4,$5,$6,$7,$8,$9,$10,$1,$2,$6)`,
  [context.mutationId, ordinal, eventId, input.definitionHash, lotId, input.quantity, sourceInputOrdinal,
    split ? 'split' : null, split ? 'split' : 'grant', snapshot]);
  return result;
}
export async function grantLot(client, mutation, rawDefinition, rawOutput) {
  try {
    itemMutationContext(client, mutation);
    const supplied = detach(rawDefinition);
    const shape = exact(rawOutput, [...IDENTITY_KEYS, 'quantity', 'provenanceClass', 'provenanceDigest']);
    quantity(shape.quantity);
    const input = validateIdentity(detach(shape));
    hash(input.provenanceDigest);
    if (!['crafted', 'salvaged', 'awarded', 'imported'].includes(input.provenanceClass)) fail();
    assertLotDefinitionPin(client, mutation, { owner: input.owner, definitionHash: input.definitionHash, direction: 'output' });
    await verifiedDefinition(client, input, supplied);
    return await writeGrant(client, mutation, input);
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}

function selector(raw) {
  const shape = exact(raw, [...IDENTITY_KEYS, 'quantity', 'selection', 'lotIds']);
  quantity(shape.quantity);
  const input = validateIdentity(detach(shape));
  if (input.selection === 'compatible') { if (input.lotIds !== null) fail(); }
  else if (input.selection === 'lot_ids') {
    if (!Array.isArray(input.lotIds) || !input.lotIds.length || input.lotIds.length > 4096) fail();
    input.lotIds.forEach((id) => text(id));
    if (new Set(input.lotIds).size !== input.lotIds.length
      || !equal(input.lotIds, [...input.lotIds].sort())) fail();
  } else fail();
  return input;
}
const economicIdentity = (value) => Object.fromEntries(IDENTITY_KEYS.map((key) => [key, value[key]]));
const rowIdentity = (row) => economicIdentity(projection(row));
const lockEntry = (subtype, id) => ({ className: 'item', subtype, key: id, id, generation: 0 });
const recordedDepositor = (row) => row.depositor_scope == null ? null : { scope: row.depositor_scope, id: row.depositor_id };
const subjectKey = (row) => row.lot_id ? `lot:${row.lot_id}` : `unique:${row.id}`;
const transitionFor = (root, requirement) => root.authority.itemTransitions?.find((entry) =>
  requirement.kind === 'lot_exact' ? entry.subject.storageKind === 'lot' && entry.subject.lotId === requirement.lotId
    : requirement.kind === 'unique_exact' && entry.subject.storageKind === 'unique' && entry.subject.itemId === requirement.itemId);
function uniqueExpected(value) {
  const input = exact(detach(value), ['definitionHash', 'owner', 'state', 'custody', 'qualityBand',
    'qualityStateDigest', 'conditionSummary', 'exportPolicy']);
  hash(input.definitionHash); owner(input.owner); custody(input.custody);
  if (input.qualityBand !== null) text(input.qualityBand, 80);
  if (input.qualityStateDigest !== null) hash(input.qualityStateDigest);
  if (!['active', 'escrowed'].includes(input.state) || input.conditionSummary !== null || input.exportPolicy !== 'ineligible') fail();
  if ((input.state === 'escrowed') !== (input.custody.state === 'escrowed')
    || (input.owner.scope === 'operation') !== (input.state === 'escrowed')
    || (input.state === 'escrowed' && input.owner.id !== input.custody.id)) fail();
  return input;
}
function checkPinnedSubject(actual, expected, unique = false) {
  if (!equal(actual.owner, expected.owner) || !equal(actual.custody, expected.custody)
    || (unique && actual.state !== expected.state)) fail('item_unavailable');
  if (!equal(actual, expected)) fail();
}
function candidateLotSelect() {
  return dbCaps.skipLocked
    ? `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS candidate_created_at FROM item_lots`
    : 'SELECT * FROM item_lots';
}
function candidateLotRows(rows) {
  return rows.map(({ candidate_created_at, ...row }) => {
    // Native precision belongs only to the private plan, never its physical rows or leaf snapshots.
    CANDIDATE_CREATED_AT.set(row, candidate_created_at ?? instant(row.created_at));
    return row;
  });
}
function candidateSnapshot(row) {
  return { row: databaseSnapshot(row), createdAt: row.lot_id ? CANDIDATE_CREATED_AT.get(row) : null };
}
async function resolveRequirement(client, mutation, requirement, root) {
  const transition = transitionFor(root, requirement);
  if (requirement.kind === 'unique_exact') {
    const row = (await client.query('SELECT * FROM item_instances WHERE id=$1', [requirement.itemId])).rows[0];
    if (!row || !row.definition_hash || row.state === 'consumed') fail('item_unavailable');
    const escrow = (await client.query('SELECT * FROM operation_escrow WHERE item_id=$1', [row.id])).rows[0] ?? null;
    const view = uniqueProjection(row, escrow), actual = Object.fromEntries(Object.keys(requirement.expected).map((key) => [key, view[key]]));
    checkPinnedSubject(actual, requirement.expected, true);
    if (!root.authority.inputDefinitionHashes.includes(row.definition_hash)) fail();
    if (transition && !equal(transition.subject.expected, requirement.expected)) fail();
    if (!transition && !equal(view.owner, root.owner)) fail('item_unavailable');
    if ((row.state === 'escrowed') !== Boolean(escrow)) fail('item_unavailable');
    return [{ ...row, _escrow: escrow }];
  }
  if (requirement.kind === 'lot_fifo') {
    const input = requirement.selector;
    assertLotDefinitionPin(client, mutation, { owner: input.owner, definitionHash: input.definitionHash, direction: 'input' });
    if (input.owner.scope === 'operation') fail('item_mutation_authority');
    await verifiedDefinition(client, input);
    // Column names are closed server literals. All nonnull values, including explicit IDs, bind
    // as scalars; null means exact SQL null rather than an omitted/wildcard predicate.
    const dimensions = [
      ['owner_scope', input.owner.scope], ['owner_id', input.owner.id], ['definition_hash', input.definitionHash],
      ['logical_item_id', input.logicalItemId], ['custody_state', input.custody.state],
      ['custody_scope', input.custody.scope], ['custody_id', input.custody.id],
      ['quality_band', input.qualityBand], ['quality_state_digest', input.qualityStateDigest],
      ['trade_policy_hash', input.tradePolicyHash], ['binding', input.binding], ['transfer_restriction', input.transferRestriction],
      ['season_id', input.seasonId], ['run_id', input.runId], ['source_cap_id', input.sourceCapId],
      ['expires_at', input.expiresAt], ['age_basis_at', input.ageBasisAt],
      ['provenance_coalescing_class', input.provenanceCoalescingClass],
    ];
    const params = [], predicates = dimensions.map(([column, value]) => value === null
      ? `${column} IS NULL` : `${column}=$${params.push(value)}`);
    if (input.selection === 'lot_ids') predicates.push(`lot_id IN (${input.lotIds.map(id => `$${params.push(id)}`).join(',')})`);
    const order = dbCaps.skipLocked ? 'created_at,lot_id COLLATE "C"' : 'created_at,lot_id';
    return candidateLotRows((await client.query(`${candidateLotSelect()} WHERE ${predicates.join(' AND ')}
      AND remaining_quantity>0 ORDER BY ${order} LIMIT 4097`, params)).rows);
  }
  const row = candidateLotRows((await client.query(`${candidateLotSelect()} WHERE lot_id=$1`, [requirement.lotId])).rows)[0];
  if (!row) fail('item_unavailable');
  const identity = rowIdentity(row);
  if (!root.authority.inputDefinitionHashes.includes(row.definition_hash)) fail();
  if (transition) {
    if (row.remaining_quantity < 1) fail('item_unavailable');
    if (requirement.quantity !== transition.subject.expected.remainingQuantity) fail();
    checkPinnedSubject({ ...identity, remainingQuantity: row.remaining_quantity }, transition.subject.expected);
  } else {
    if (!equal(identity.owner, root.owner)) fail('item_unavailable');
    assertLotDefinitionPin(client, mutation, { owner: identity.owner, definitionHash: identity.definitionHash, direction: 'input' });
    if (identity.owner.scope === 'operation' && (!['operation', 'mystery'].includes(root.authority.aggregate.kind)
      || root.authority.aggregate.id !== identity.owner.id)) fail('item_mutation_authority');
  }
  await verifiedDefinition(client, { ...identity, quantity: requirement.quantity }, null, recordedDepositor(row));
  return [row];
}
async function resolveCompleteRequirements(client, mutation, requirements, root) {
  const selected = new Map(), available = new Map(), allocations = [], shortfalls = [];
  let physicalKeys = 0;
  for (const requirement of requirements) {
    let remaining = requirement.kind === 'lot_fifo' ? requirement.selector.quantity
      : requirement.kind === 'unique_exact' ? 1 : requirement.quantity;
    const parts = [];
    // At most 4097 filtered rows are returned for this requirement. Any exhausted shadow row
    // already owns a selected key; needing a row beyond that prefix must exceed the root budget.
    // Do not retain unused tails across requirements or reserve later exact inputs out of order.
    for (const row of await resolveRequirement(client, mutation, requirement, root)) {
      const key = subjectKey(row), prior = selected.get(key);
      if (prior && !equal(candidateSnapshot(prior), candidateSnapshot(row))) fail('contention');
      const before = available.get(key) ?? (row.lot_id ? row.remaining_quantity : 1);
      const removed = Math.min(before, remaining);
      if (!removed && requirement.kind === 'lot_fifo') continue;
      if (!prior) {
        physicalKeys += row._escrow ? 2 : 1;
        if (physicalKeys > 4096) fail('contention');
        selected.set(key, row);
      }
      if (removed) {
        parts.push({ row: prior ?? row, before, removed, after: before - removed });
        available.set(key, before - removed); remaining -= removed;
      }
      if (!remaining) break;
    }
    allocations.push(parts); shortfalls.push(remaining);
  }
  return { selected, allocations, shortfalls };
}
function completeSnapshot(resolved) {
  return { selected: [...resolved.selected.values()].map(candidateSnapshot), shortfalls: resolved.shortfalls,
    allocations: resolved.allocations.map(parts => parts.map(({ row, before, removed, after }) =>
      ({ key: subjectKey(row), before, removed, after }))) };
}
export async function withCompleteItemCandidates(client, mutation, trace, rawRequest, action) {
  let plan;
  try {
    itemMutationContext(client, mutation);
    const request = exact(detach(rawRequest), ['root', 'requirements']);
    assertLotCandidateRoot(client, mutation, request.root);
    if (CANDIDATE_PLANS.has(mutation) || typeof action !== 'function'
      || !Array.isArray(request.requirements) || request.requirements.length > 256) fail('contention');
    const requirements = request.requirements.map((value) => {
      if (!value || typeof value !== 'object') fail();
      if (value.kind === 'lot_fifo') { exact(value, ['kind', 'selector']); return { kind: 'lot_fifo', selector: selector(value.selector) }; }
      if (value.kind === 'unique_exact') {
        const unique = exact(value, ['kind', 'itemId', 'expected']); text(unique.itemId);
        return { kind: 'unique_exact', itemId: unique.itemId, expected: uniqueExpected(unique.expected) };
      }
      const exactLot = exact(value, ['kind', 'lotId', 'quantity']);
      if (exactLot.kind !== 'lot_exact') fail();
      text(exactLot.lotId); quantity(exactLot.quantity); return exactLot;
    });
    plan = { client, root: request.root, requirements, allocations: [], used: new Set(), active: false };
    CANDIDATE_PLANS.set(mutation, plan); // reserve once before resolving or locking any candidate
    const resolved = await resolveCompleteRequirements(client, mutation, requirements, request.root);
    for (const entry of request.root.authority.itemTransitions ?? []) {
      if (requirements.filter((requirement) => transitionFor(request.root, requirement) === entry).length !== 1) fail('contention');
    }
    const uniqueRows = resolved.selected;
    const entries = [...uniqueRows.values()].flatMap((row) => row.lot_id ? [lockEntry('lot', row.lot_id)]
      : [...(row._escrow ? [lockEntry('custody', row.id)] : []), lockEntry('unique', row.id)]).sort(compareItemLockEntries);
    trace.admitCandidates('item', entries);
    for (const entry of entries) {
      trace.record(entry);
      const sql = entry.subtype === 'lot' ? 'SELECT * FROM item_lots WHERE lot_id=$1 FOR UPDATE'
        : entry.subtype === 'unique' ? 'SELECT * FROM item_instances WHERE id=$1 FOR UPDATE'
          : 'SELECT * FROM operation_escrow WHERE item_id=$1 FOR UPDATE';
      const locked = (await client.query(sql, [entry.id])).rows[0];
      const prior = uniqueRows.get(`${entry.subtype === 'lot' ? 'lot' : 'unique'}:${entry.id}`);
      const { _escrow, ...instance } = prior;
      const expected = entry.subtype === 'custody' ? _escrow : entry.subtype === 'unique' ? instance : prior;
      if (!locked || !equal(databaseSnapshot(locked), databaseSnapshot(expected))) fail('contention');
    }
    const current = await resolveCompleteRequirements(client, mutation, requirements, request.root);
    if (!equal(completeSnapshot(current), completeSnapshot(resolved))) fail('contention');
    if (resolved.shortfalls.some(Boolean)) fail('materials');
    plan.allocations = resolved.allocations; plan.active = true;
    const result = await action();
    if (plan.used.size !== requirements.length) fail('contention');
    return result;
  } catch (error) { poisonItemTransaction(client, error); throw error; }
  finally { if (plan) plan.active = false; } // retain one-admission history until the private token is collected
}
function takeRequirement(client, mutation, expected, transition = false) {
  itemMutationContext(client, mutation);
  const plan = CANDIDATE_PLANS.get(mutation);
  if (!plan?.active || plan.client !== client) fail('contention');
  const index = plan.requirements.findIndex((requirement, i) => !plan.used.has(i) && equal(requirement, expected));
  if (index < 0 || (!transition && transitionFor(plan.root, expected))) fail('contention');
  plan.used.add(index); return plan.allocations[index];
}
function transitionState(row, storageKind, escrow = null) {
  const value = storageKind === 'lot' ? projection(row) : uniqueProjection(row, escrow);
  return { owner: value.owner, custody: value.custody, uniqueState: storageKind === 'unique' ? value.state : null,
    remainingQuantity: storageKind === 'lot' ? row.remaining_quantity : row.state === 'consumed' ? 0 : 1 };
}
async function restoreUnique(client, row) {
  // This single inverse restores the live composite FK in the same dependency-safe order as forward DML.
  await client.query('DELETE FROM operation_escrow WHERE item_id=$1', [row.id]);
  await client.query(`UPDATE item_instances SET owner_scope=$2,owner_id=$3,state=$4,updated_at=$5,consumed_at=$6 WHERE id=$1`,
    [row.id, row.owner_scope, row.owner_id, row.state, row.updated_at, row.consumed_at]);
  if (row._escrow) await client.query(`INSERT INTO operation_escrow
    (item_id,owner_scope,operation_id,item_state,depositor_scope,depositor_id,created_at)
    VALUES ($1,$2,$3,$4,$5,$6,$7)`, [row.id, row._escrow.owner_scope, row._escrow.operation_id,
    row._escrow.item_state, row._escrow.depositor_scope, row._escrow.depositor_id, row._escrow.created_at]);
}
export async function applyItemTransition(client, mutation, transitionIndex) {
  try {
    const context = itemMutationContext(client, mutation), plan = CANDIDATE_PLANS.get(mutation);
    if (!Number.isSafeInteger(transitionIndex) || transitionIndex < 0) fail();
    if (!plan?.active || plan.client !== client || !Array.isArray(plan.root.authority.itemTransitions)) fail('item_mutation_authority');
    const entry = plan.root.authority.itemTransitions[transitionIndex];
    if (!entry) fail();
    const { storageKind } = entry.subject, unique = storageKind === 'unique';
    const requirement = plan.requirements.find((value) => transitionFor(plan.root, value) === entry);
    if (!requirement) fail('contention');
    const [part] = takeRequirement(client, mutation, requirement, true), row = part.row;
    const subjectId = unique ? row.id : row.lot_id, oldDepositor = recordedDepositor(unique ? row._escrow ?? {} : row);
    const before = transitionState(row, storageKind, row._escrow);
    if (before.remainingQuantity < 1 || (!unique && part.removed !== row.remaining_quantity)) fail('item_unavailable');
    const definition = await definitionByHash(client, row.definition_hash);
    if (!['material', 'item'].includes(definition.kind) || definition.stackable !== !unique
      || definition.logicalItemId !== row.logical_item_id || definition.tradePolicyHash !== row.trade_policy_hash
      || row.trade_policy_hash !== row.definition_hash || (unique && (row.export_policy !== 'ineligible' || row.condition_summary !== null))) fail();
    validateLotQuality(definition, { qualityBand: row.quality_band, qualityStateDigest: row.quality_state_digest });
    quantity(unique ? 1 : row.original_quantity, definition.maximumLotQuantity);
    const root = plan.root, aggregate = root.authority.aggregate, escrowed = before.custody?.state === 'escrowed';
    const needsOperation = entry.kind === 'escrow' || escrowed || entry.kind === 'release' || entry.kind === 'consume_escrow_lot';
    const operationId = entry.kind === 'escrow' ? entry.operationId : before.custody?.id;
    if (needsOperation && (!['operation', 'mystery'].includes(aggregate.kind) || aggregate.id !== operationId)) fail('item_mutation_authority');
    if (!escrowed && !equal(before.owner, root.owner)) fail('item_unavailable');
    if (needsOperation && (!definition.ownerScopes.includes('project')
      || !definition.ownerScopes.includes((escrowed ? oldDepositor : before.owner)?.scope))) fail('item_mutation_authority');
    if (!unique && (row.binding !== null || row.transfer_restriction !== null)) fail('item_mutation_authority');
    let afterOwner = before.owner, afterCustody = before.custody, afterDepositor = oldDepositor, consumed = false;
    switch (entry.kind) {
      case 'escrow':
        if (escrowed || !['character', 'account'].includes(before.owner.scope)) fail('item_unavailable');
        afterOwner = { scope: 'operation', id: entry.operationId };
        afterCustody = { state: 'escrowed', scope: 'operation', id: entry.operationId }; afterDepositor = before.owner;
        break;
      case 'release':
        if (!escrowed || !equal(oldDepositor, entry.depositor)) fail('item_unavailable');
        afterOwner = entry.depositor; afterCustody = { state: 'direct', scope: null, id: null }; afterDepositor = null;
        break;
      case 'consume_unique':
        if (!unique || (escrowed ? !equal(oldDepositor, entry.depositor) : entry.depositor !== null)) fail('item_unavailable');
        consumed = true; break;
      case 'consume_escrow_lot':
        if (unique || !escrowed || !equal(oldDepositor, entry.depositor)) fail('item_unavailable');
        consumed = true; break;
      case 'transfer_unique':
        if (!unique || escrowed) fail('item_unavailable');
        if (equal(entry.destination, before.owner) || definition.tradePolicy.mode !== 'ordinary'
          || definition.tradePolicy.transferable !== true || !definition.ownerScopes.includes(entry.destination.scope)
          || !definition.ownerScopes.includes(before.owner.scope)) fail('item_mutation_authority');
        afterOwner = entry.destination; break;
      default: fail('item_mutation_authority');
    }
    if (consumed) { afterCustody = null; afterDepositor = null; }
    const after = { owner: afterOwner, custody: afterCustody, uniqueState: unique ? consumed ? 'consumed' : afterCustody.state === 'escrowed' ? 'escrowed' : 'active' : null,
      remainingQuantity: consumed ? 0 : before.remainingQuantity };
    const current = (await client.query(unique ? 'SELECT * FROM item_instances WHERE id=$1' : 'SELECT * FROM item_lots WHERE lot_id=$1', [subjectId])).rows[0];
    const { _escrow, ...priorUnique } = row;
    if (!current || !equal(databaseSnapshot(current), databaseSnapshot(unique ? priorUnique : row))) fail('contention');
    if (unique) {
      const live = (await client.query('SELECT * FROM operation_escrow WHERE item_id=$1', [subjectId])).rows[0] ?? null;
      if (!equal(databaseSnapshot(live), databaseSnapshot(_escrow))) fail('contention');
    }
    assertAndUseLotTransition(client, mutation, transitionIndex, entry);
    const ordinal = nextItemMutationOrdinal(client, mutation), eventId = randomUUID();
    if (unique) {
      registerItemTransactionUndo(client, () => restoreUnique(client, row));
      if (_escrow) await client.query('DELETE FROM operation_escrow WHERE item_id=$1', [subjectId]);
      const changed = await client.query(`UPDATE item_instances SET owner_scope=$2,owner_id=$3,state=$4,
        updated_at=now(),consumed_at=$5 WHERE id=$1 AND owner_scope=$6 AND owner_id=$7 AND state=$8`,
      [subjectId, afterOwner.scope, afterOwner.id, after.uniqueState, consumed ? new Date().toISOString() : null,
        row.owner_scope, row.owner_id, row.state]);
      if (changed.rowCount !== 1) fail('contention');
      if (afterDepositor) await client.query(`INSERT INTO operation_escrow
        (item_id,operation_id,depositor_scope,depositor_id) VALUES ($1,$2,$3,$4)`,
      [subjectId, afterOwner.id, afterDepositor.scope, afterDepositor.id]);
    } else {
      registerItemTransactionUndo(client, () => client.query(`UPDATE item_lots SET owner_scope=$2,owner_id=$3,
        custody_state=$4,custody_scope=$5,custody_id=$6,depositor_scope=$7,depositor_id=$8,
        remaining_quantity=$9,state=$10,updated_at=$11 WHERE lot_id=$1`, [subjectId, row.owner_scope, row.owner_id,
        row.custody_state, row.custody_scope, row.custody_id, row.depositor_scope, row.depositor_id,
        row.remaining_quantity, row.state, row.updated_at]));
      const changed = await client.query(`UPDATE item_lots SET owner_scope=$2,owner_id=$3,custody_state=$4,
        custody_scope=$5,custody_id=$6,depositor_scope=$7,depositor_id=$8,remaining_quantity=$9,state=$10,updated_at=now()
        WHERE lot_id=$1 AND owner_scope=$11 AND owner_id=$12 AND remaining_quantity=$13`,
      [subjectId, afterOwner.scope, afterOwner.id, afterCustody?.state ?? null, afterCustody?.scope ?? null,
        afterCustody?.id ?? null, afterDepositor?.scope ?? null, afterDepositor?.id ?? null, after.remainingQuantity,
        consumed ? 'exhausted' : afterCustody.state === 'escrowed' ? 'escrowed' : 'active', row.owner_scope, row.owner_id, row.remaining_quantity]);
      if (changed.rowCount !== 1) fail('contention');
    }
    const result = { kind: entry.kind, storageKind, subjectId, definitionHash: row.definition_hash, before, after,
      movedQuantity: consumed ? 0 : before.remainingQuantity, removedQuantity: consumed ? before.remainingQuantity : 0,
      mutationId: context.mutationId, eventOrdinal: ordinal, inputOrdinal: ordinal, outputOrdinal: consumed ? null : ordinal };
    const snapshot = canonicalBytes({ ...result, beforeDepositor: oldDepositor, afterDepositor,
      identity: unique ? uniqueProjection(row, _escrow) : rowIdentity(row),
      provenanceClass: row.provenance_class, provenanceDigest: row.provenance_digest }).toString('utf8');
    const eventKind = unique ? { escrow: 'unique_escrowed', release: 'unique_released', consume_unique: 'unique_consumed', transfer_unique: 'unique_transferred' }[entry.kind]
      : { escrow: 'lot_escrowed', release: 'lot_released', consume_escrow_lot: 'lot_escrow_consumed' }[entry.kind];
    await client.query(`INSERT INTO item_events
      (id,event_key,event_kind,template_id,quality,quantity_delta,quantity_before,quantity_after,from_owner_scope,from_owner_id,
       to_owner_scope,to_owner_id,reason,idempotency_key,event_branch,mutation_id,event_ordinal,lot_id,item_id,definition_hash,snapshot_json)
      VALUES ($1,$2,$3,$4,'standard',$5,$6,$7,$8,$9,$10,$11,'exact item transition',$12,$13,$14,$15,$16,$17,$18,$19)`,
    [eventId, `transition:${ordinal}`, eventKind, row.logical_item_id, -result.removedQuantity, before.remainingQuantity,
      after.remainingQuantity, before.owner.scope, before.owner.id, afterOwner.scope, afterOwner.id, context.key,
      storageKind, context.mutationId, ordinal, unique ? null : subjectId, unique ? subjectId : null, row.definition_hash, snapshot]);
    await client.query(`INSERT INTO item_mutation_inputs
      (mutation_id,input_ordinal,event_id,event_branch,definition_hash,lot_id,item_id,quantity_before,removed_quantity,
       quantity_after,transition_kind,snapshot_json,attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)`,
    [context.mutationId, ordinal, eventId, storageKind, row.definition_hash, unique ? null : subjectId, unique ? subjectId : null,
      before.remainingQuantity, result.removedQuantity, after.remainingQuantity, entry.kind, snapshot,
      row.mutation_id, row.output_ordinal, unique ? 1 : row.original_quantity]);
    if (!consumed) await client.query(`INSERT INTO item_mutation_outputs
      (mutation_id,output_ordinal,event_id,event_branch,definition_hash,lot_id,item_id,quantity,transition_kind,snapshot_json,
       attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
    [context.mutationId, ordinal, eventId, storageKind, row.definition_hash, unique ? null : subjectId, unique ? subjectId : null,
      after.remainingQuantity, entry.kind, snapshot, row.mutation_id, row.output_ordinal, unique ? 1 : row.original_quantity]);
    return result;
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}
async function writeDebit(client, mutation, part, split = false) {
  const { row, before, removed, after } = part;
  if (!split && row.custody_state === 'escrowed') fail('item_mutation_authority');
  const context = itemMutationContext(client, mutation), ordinal = nextItemMutationOrdinal(client, mutation);
  const current = (await client.query('SELECT * FROM item_lots WHERE lot_id=$1', [row.lot_id])).rows[0];
  if (!current || current.remaining_quantity !== before || !equal(rowIdentity(current), rowIdentity(row))) fail('contention');
  registerItemTransactionUndo(client, () => client.query(`UPDATE item_lots SET remaining_quantity=$2,state=$3,updated_at=$4,
    custody_state=$5,custody_scope=$6,custody_id=$7,depositor_scope=$8,depositor_id=$9 WHERE lot_id=$1`,
  [row.lot_id, current.remaining_quantity, current.state, current.updated_at, current.custody_state, current.custody_scope,
    current.custody_id, current.depositor_scope, current.depositor_id]));
  const changed = await client.query(`UPDATE item_lots SET remaining_quantity=$2,state=$3,updated_at=now(),
    custody_state=$8,custody_scope=$9,custody_id=$10,depositor_scope=$11,depositor_id=$12
    WHERE lot_id=$1 AND remaining_quantity=$4 AND owner_scope=$5 AND owner_id=$6 AND custody_state=$7 RETURNING *`,
  [row.lot_id, after, after ? current.state : 'exhausted', before, row.owner_scope, row.owner_id, row.custody_state,
    after ? current.custody_state : null, after ? current.custody_scope : null, after ? current.custody_id : null,
    after ? current.depositor_scope : null, after ? current.depositor_id : null]);
  if (changed.rowCount !== 1) fail('contention');
  const result = { lotId: row.lot_id, definitionHash: row.definition_hash, beforeQuantity: before,
    removedQuantity: removed, afterQuantity: after, inputOrdinal: ordinal, eventOrdinal: ordinal };
  const snapshot = canonicalBytes({ ...result, identity: rowIdentity(row), depositor: recordedDepositor(row) }).toString('utf8'), eventId = randomUUID();
  await client.query(`INSERT INTO item_events
    (id,event_key,event_kind,template_id,quality,quantity_delta,quantity_before,quantity_after,
     from_owner_scope,from_owner_id,reason,idempotency_key,event_branch,mutation_id,event_ordinal,lot_id,definition_hash,snapshot_json)
    VALUES ($1,$2,$3,$4,'standard',$5,$6,$7,$8,$9,'exact lot debit',$10,'lot',$11,$12,$13,$14,$15)`,
  [eventId, `lot:${ordinal}`, split ? 'lot_split_debit' : 'lot_consumed', row.logical_item_id, -removed,
    before, after, row.owner_scope, row.owner_id, context.key, context.mutationId, ordinal, row.lot_id, row.definition_hash, snapshot]);
  await client.query(`INSERT INTO item_mutation_inputs
    (mutation_id,input_ordinal,event_id,event_branch,definition_hash,lot_id,quantity_before,removed_quantity,
     quantity_after,transition_kind,snapshot_json,attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
    VALUES ($1,$2,$3,'lot',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
  [context.mutationId, ordinal, eventId, row.definition_hash, row.lot_id, before, removed, after, split ? 'split' : 'consume', snapshot,
    row.mutation_id, row.output_ordinal, row.original_quantity]);
  return result;
}
export async function consumeLotsFifo(client, mutation, rawSelector) {
  try {
    const input = selector(rawSelector), parts = takeRequirement(client, mutation, { kind: 'lot_fifo', selector: input });
    const result = [];
    for (const part of parts) result.push(await writeDebit(client, mutation, part));
    return Object.freeze(result);
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}
export async function consumeExactLot(client, mutation, lotId, amount) {
  try {
    text(lotId); quantity(amount);
    const parts = takeRequirement(client, mutation, { kind: 'lot_exact', lotId, quantity: amount });
    return await writeDebit(client, mutation, parts[0]);
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}
export async function splitLot(client, mutation, lotId, amount, rawCustody) {
  try {
    text(lotId); quantity(amount);
    const expectedCustody = custody(detach(rawCustody));
    const parts = takeRequirement(client, mutation, { kind: 'lot_exact', lotId, quantity: amount });
    const part = parts[0];
    if (!equal(expectedCustody, projection(part.row).custody)) fail();
    const debit = await writeDebit(client, mutation, part, true);
    return await writeGrant(client, mutation, { ...rowIdentity(part.row), quantity: amount,
      provenanceClass: part.row.provenance_class, provenanceDigest: part.row.provenance_digest }, debit.inputOrdinal, recordedDepositor(part.row));
  } catch (error) { poisonItemTransaction(client, error); throw error; }
}

export async function lotInventoryBoard(queryable, rawOwner, rawOptions) {
  const heldBy = owner(detach(rawOwner)), options = exact(detach(rawOptions), ['cursor', 'limit', 'includeLots']);
  if (!Number.isSafeInteger(options.limit) || options.limit < 1 || options.limit > 100
    || typeof options.includeLots !== 'boolean') fail();
  let after = null;
  if (options.cursor !== null) {
    text(options.cursor, 4096);
    try {
      if (!/^[A-Za-z0-9_-]+$/.test(options.cursor)) fail();
      const cursor = exact(JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8')), ['owner', 'after']);
      if (!equal(owner(cursor.owner), heldBy)) fail();
      after = exact(cursor.after, ['createdAt', 'lotId']);
      text(after.lotId);
      // Preserve native microseconds; Date alone rounds away a valid key's last three digits.
      if (typeof after.createdAt !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}(?:\d{3})?Z$/.test(after.createdAt)
        || after.createdAt.startsWith('0000-')
        || !Number.isFinite(Date.parse(after.createdAt))
        || instant(after.createdAt) !== after.createdAt.replace(/(\.\d{3})\d{3}Z$/, '$1Z')) fail();
    } catch { fail(); }
  }
  return withItemRead(queryable, async (client) => {
    const params = [heldBy.scope, heldBy.id, options.limit + 1];
    if (after) params.push(after.createdAt, after.lotId);
    // Native row comparison is the range bound on item_lot_owner_idx; pg-mem lacks tuple comparison.
    // Keep each backend/page branch as closed SQL; every caller value remains a bound parameter.
    const sql = dbCaps.skipLocked ? after
      ? `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
         FROM item_lots WHERE owner_scope=$1 AND owner_id=$2 AND remaining_quantity>0
         AND (created_at,lot_id)>($4,$5) ORDER BY created_at,lot_id LIMIT $3`
      : `SELECT *,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS cursor_created_at
         FROM item_lots WHERE owner_scope=$1 AND owner_id=$2 AND remaining_quantity>0
         ORDER BY created_at,lot_id LIMIT $3`
      : after
        ? `SELECT * FROM item_lots WHERE owner_scope=$1 AND owner_id=$2 AND remaining_quantity>0
           AND (created_at>$4 OR (created_at=$4 AND lot_id>$5)) ORDER BY created_at,lot_id LIMIT $3`
        : `SELECT * FROM item_lots WHERE owner_scope=$1 AND owner_id=$2 AND remaining_quantity>0
           ORDER BY created_at,lot_id LIMIT $3`;
    const rows = (await client.query(sql, params)).rows;
    const page = rows.slice(0, options.limit), more = rows.length > options.limit;
    const groups = new Map();
    for (const row of page) {
      const identity = rowIdentity(row), key = canonicalBytes(identity).toString('utf8');
      const group = groups.get(key) || { ...identity, quantity: 0, lotCount: 0 };
      group.quantity += row.remaining_quantity; group.lotCount++;
      if (!Number.isSafeInteger(group.quantity)) fail('item_integrity_error');
      groups.set(key, group);
    }
    const last = page.at(-1);
    return { owner: heldBy, groups: [...groups].sort(([a], [b]) => Buffer.compare(Buffer.from(a), Buffer.from(b))).map(([, group]) => group),
      lots: options.includeLots ? page.map(projection) : [],
      nextCursor: more ? Buffer.from(JSON.stringify({ owner: heldBy,
        after: { createdAt: last.cursor_created_at ?? instant(last.created_at), lotId: last.lot_id } })).toString('base64url') : null };
  });
}

// Immediate FKs validate present attachments. The root checks reverse total participation before completing its receipt.
export async function assertLotMutationParity(client, mutation) {
  const context = itemMutationContext(client, mutation);
  const events = (await client.query('SELECT * FROM item_events WHERE mutation_id=$1 ORDER BY event_ordinal', [context.mutationId])).rows;
  const outputs = (await client.query('SELECT * FROM item_mutation_outputs WHERE mutation_id=$1', [context.mutationId])).rows;
  const inputs = (await client.query('SELECT * FROM item_mutation_inputs WHERE mutation_id=$1', [context.mutationId])).rows;
  const lots = (await client.query('SELECT * FROM item_lots WHERE mutation_id=$1', [context.mutationId])).rows;
  const uniques = (await client.query('SELECT * FROM item_instances WHERE mutation_id=$1', [context.mutationId])).rows;
  const creations = outputs.filter((row) => ['grant', 'split'].includes(row.transition_kind));
  if (creations.length !== lots.length + uniques.length) fail('item_integrity_error');
  for (const row of lots) if (outputs.filter((out) => out.lot_id === row.lot_id && out.output_ordinal === row.output_ordinal).length !== 1) fail('item_integrity_error');
  for (const row of uniques) if (outputs.filter((out) => out.item_id === row.id && out.output_ordinal === row.output_ordinal).length !== 1) fail('item_integrity_error');
  for (const event of events) {
    const incoming = inputs.filter((io) => io.event_id === event.id), outgoing = outputs.filter((io) => io.event_id === event.id);
    const creation = ['lot_granted', 'lot_split_output', 'unique_granted'].includes(event.event_kind);
    const move = ['lot_escrowed', 'lot_released', 'unique_escrowed', 'unique_released', 'unique_transferred'].includes(event.event_kind);
    if (incoming.length !== (creation ? 0 : 1) || outgoing.length !== (creation || move ? 1 : 0)
      || [...incoming, ...outgoing].some((io) => io.snapshot_json !== event.snapshot_json)) fail('item_integrity_error');
  }
  const guard = (await client.query('SELECT request_json FROM item_mutation_guards WHERE mutation_id=$1', [context.mutationId])).rows[0];
  const declared = JSON.parse(guard.request_json).request.authority.itemTransitions ?? [];
  const transitions = inputs.filter((row) => !['consume', 'split'].includes(row.transition_kind));
  if (transitions.length !== declared.length || declared.some((entry) => transitions.filter((row) =>
    row.transition_kind === entry.kind && (entry.subject.storageKind === 'lot' ? row.lot_id === entry.subject.lotId
      : row.item_id === entry.subject.itemId)).length !== 1)) fail('item_integrity_error');
}
