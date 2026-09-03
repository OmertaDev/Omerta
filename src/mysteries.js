// Data-defined Phase 1 mystery runtime.
//
// Server call shape:
//
//   const ctx = createMysteryContext({ registry, accountId, now, timeWindows });
//   await withItemTransaction(pool, (client) =>
//     completeNode(client, ctx, owner, graphId, nodeId, {
//       idempotencyKey, interactionId,
//     }));
//
// `registry` must be the immutable result of loadGraphPackages/loadAndValidateGraphPackages and is
// revalidated when the server context is created. `accountId`, the pinned request time, and named
// windows are the only context authority. Actor, character, location, level, skills, inventory,
// evidence, and graph progress are re-read under the item transaction after the aggregate replay
// guard is reserved. Content supplies data only: no callback, SQL, cash, or OMR adapter exists.
import crypto from 'node:crypto';
import { GameError } from './game.js';
import {
  consumeItem,
  createItem,
  escrowItem,
  registerItemTransactionUndo,
  releaseEscrow,
  withItemMutation,
} from './items.js';
import { levelOf } from './rules.js';
import { isWorldGraphRegistry, nodeOf } from './worldgraph.js';
import { validateGraph } from './worldgraph-validate.js';

const CONTEXTS = new WeakSet();
const ROOT_SCOPES = new Set(['account', 'character']);
const ACTION_NODE_TYPES = new Set(['mystery_step', 'world_gate']);
const BOARD_NODE_TYPES = new Set(['mystery_step', 'world_gate', 'choice', 'evidence', 'reward']);
const CONDITION_ADAPTERS = new Set([
  'graph_dependency',
  'location',
  'level',
  'skill',
  'item_ownership',
  'owns_item',
  'material_quantity',
  'evidence',
  'time_window',
  'explicit_interaction',
]);
const EFFECT_FIELDS = Object.freeze({
  discover: new Set(['adapter', 'nodeId']),
  complete: new Set(['adapter', 'nodeId']),
  evidence_grant: new Set(['adapter', 'nodeId']),
  item_escrow: new Set(['adapter', 'templateId']),
  item_consume: new Set(['adapter', 'templateId']),
  unique_item_award: new Set(['adapter', 'templateId']),
  status_award: new Set(['adapter', 'nodeId']),
});
const MYSTERY_EFFECT_ADAPTERS = new Set(Object.keys(EFFECT_FIELDS));

const fail = (code, message, data) => { throw new GameError(code, message, data); };

function canonical(value, label, code = 'bad_mystery_request') {
  if (typeof value !== 'string' || value.trim() !== value || !value || value.length > 200) {
    fail(code, `${label} must be a canonical string of at most 200 characters.`);
  }
  return value;
}

function ownerOf(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || !ROOT_SCOPES.has(value.scope)) {
    fail('bad_mystery_owner', 'Mystery owner scope must be account or character.');
  }
  return Object.freeze({
    scope: value.scope,
    id: canonical(value.id, 'Mystery owner id', 'bad_mystery_owner'),
  });
}

function dateString(value) {
  return value == null ? null : new Date(value).toISOString();
}

function plainFrozenWindows(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.getPrototypeOf(value) !== Object.prototype) {
    fail('bad_mystery_context', 'Mystery timeWindows must be a plain object.');
  }
  const result = {};
  for (const [idValue, window] of Object.entries(value)) {
    const id = canonical(idValue, 'Time-window id', 'bad_mystery_context');
    if (!window || typeof window !== 'object' || Array.isArray(window)
      || Object.getPrototypeOf(window) !== Object.prototype
      || Object.keys(window).some((key) => !['startsAt', 'endsAt'].includes(key))) {
      fail('bad_mystery_context', `Time window ${id} must contain only startsAt and endsAt.`);
    }
    const startsAt = canonical(window.startsAt, 'Time-window start', 'bad_mystery_context');
    const endsAt = canonical(window.endsAt, 'Time-window end', 'bad_mystery_context');
    if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))
      || Date.parse(startsAt) >= Date.parse(endsAt)) {
      fail('bad_mystery_context', `Time window ${id} has invalid bounds.`);
    }
    result[id] = Object.freeze({ startsAt, endsAt });
  }
  return Object.freeze(result);
}

function packageDependencies(registry, packageId, result = new Set()) {
  const pkg = registry.byPackage.get(packageId);
  for (const raw of pkg?.dependsOn || []) {
    const dependencyId = typeof raw === 'string' ? raw : raw.id;
    if (result.has(dependencyId)) continue;
    result.add(dependencyId);
    packageDependencies(registry, dependencyId, result);
  }
  return result;
}

function assertEffectTarget(registry, packageId, effect, adapter) {
  const targetId = effect.nodeId || effect.templateId;
  const target = nodeOf(registry, targetId);
  if (!target) {
    fail('bad_mystery_effect', `Mystery effect ${adapter} references missing node ${targetId}.`);
  }
  const visiblePackages = packageDependencies(registry, packageId);
  if (target.packageId !== packageId && !visiblePackages.has(target.packageId)) {
    fail('bad_mystery_effect', `Mystery effect ${adapter} crosses an undeclared package boundary.`);
  }
  if (['item_escrow', 'item_consume', 'unique_item_award'].includes(adapter)
    && target.type !== 'item_template') {
    fail('bad_mystery_effect', `Mystery effect ${adapter} requires an item_template target.`);
  }
  if (adapter === 'evidence_grant' && target.type !== 'evidence') {
    fail('bad_mystery_effect', 'Evidence grants require an evidence target.');
  }
  if (target.visibility === 'role_private') {
    fail('bad_mystery_effect',
      `Task 5 mystery effects cannot mutate role-private state through ${adapter}.`);
  }
  if (['discover', 'complete'].includes(adapter)
    && (!BOARD_NODE_TYPES.has(target.type) || target.type === 'choice')) {
    fail('bad_mystery_effect', `Mystery effect ${adapter} requires a runtime-state node target.`);
  }
  if (adapter === 'complete' && target.metadata?.terminal === true) {
    fail('bad_mystery_effect',
      'Terminal mystery nodes may be completed only through their canonical direct action.');
  }
  if (adapter === 'status_award') {
    const metadata = target.metadata || {};
    const containsCurrencyAuthority = (value, seen = new WeakSet()) => {
      if (!value || typeof value !== 'object' || seen.has(value)) return false;
      seen.add(value);
      for (const [key, child] of Object.entries(value)) {
        const normalizedKey = key.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (['currency', 'asset', 'assettype', 'tokensymbol'].includes(normalizedKey)
          && ['cash', 'omr', '$omr'].includes(String(child).trim().toLowerCase())) return true;
        if (containsCurrencyAuthority(child, seen)) return true;
      }
      return false;
    };
    if (target.type !== 'reward' || metadata.inert !== true
      || metadata.rewardType !== 'status' || containsCurrencyAuthority(target)) {
      fail('unsafe_mystery_reward', 'Status awards must target an explicitly inert reward node.');
    }
  }
}

function assertEffect(registry, packageId, effect) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)
    || Object.getPrototypeOf(effect) !== Object.prototype) {
    fail('bad_mystery_effect', 'Mystery effects must be plain data objects.');
  }
  const adapter = effect.adapter;
  if (!MYSTERY_EFFECT_ADAPTERS.has(adapter)) {
    fail('unsupported_mystery_effect', `Unsupported mystery effect ${String(adapter)}.`);
  }
  const fields = EFFECT_FIELDS[adapter];
  if (Object.keys(effect).some((key) => !fields.has(key))) {
    fail('bad_mystery_effect', `Mystery effect ${adapter} contains unsupported authority fields.`);
  }
  canonical(effect.nodeId || effect.templateId, 'Mystery effect target', 'bad_mystery_effect');
  assertEffectTarget(registry, packageId, effect, adapter);
}

function assertEffects(registry, node, effects) {
  if (effects === undefined) return;
  if (!Array.isArray(effects)) {
    fail('bad_mystery_effect', `Mystery node ${node.id} effects must be an array.`);
  }
  for (const effect of effects) assertEffect(registry, node.packageId, effect);
}

function validateMysteryDefinitions(registry) {
  for (const node of registry.nodes.values()) {
    if (!['mystery_step', 'world_gate', 'choice'].includes(node.type)) continue;
    if (node.conditions !== undefined && (!Array.isArray(node.conditions)
      || node.conditions.some((condition) => !CONDITION_ADAPTERS.has(
        condition?.adapter || condition?.type || condition?.kind,
      )))) {
      fail('unsupported_mystery_condition',
        `Mystery node ${node.id} uses an unsupported condition adapter.`);
    }
    for (const excludedId of node.excludes || []) {
      const excluded = nodeOf(registry, excludedId);
      if (!excluded || excluded.packageId !== node.packageId || !BOARD_NODE_TYPES.has(excluded.type)) {
        fail('bad_mystery_exclusion',
          `Mystery node ${node.id} has an invalid branch exclusion ${excludedId}.`);
      }
    }
    const nodeCompletedTargets = new Set((Array.isArray(node.effects) ? node.effects : [])
      .filter((effect) => ['complete', 'evidence_grant', 'status_award'].includes(effect.adapter))
      .map((effect) => effect.nodeId));
    if ((node.excludes || []).some((id) => id === node.id || nodeCompletedTargets.has(id))) {
      fail('bad_mystery_exclusion',
        `Mystery node ${node.id} cannot complete and exclude the same branch.`);
    }
    if (node.effect !== undefined || node.action !== undefined || node.actions !== undefined) {
      fail('bad_mystery_effect', `Mystery node ${node.id} must use the effects array only.`);
    }
    if (node.metadata?.terminal !== undefined
      && (node.metadata.terminal !== true || !ACTION_NODE_TYPES.has(node.type)
        || node.visibility === 'role_private')) {
      fail('bad_mystery_terminal',
        `Mystery node ${node.id} has invalid terminal semantics.`);
    }
    assertEffects(registry, node, node.effects);
    if (node.type !== 'choice') continue;
    if (!Array.isArray(node.options) || node.options.length < 1) {
      fail('bad_mystery_choice', `Choice node ${node.id} requires at least one option.`);
    }
    const seen = new Set();
    for (const option of node.options) {
      if (!option || typeof option !== 'object' || Array.isArray(option)
        || Object.getPrototypeOf(option) !== Object.prototype
        || Object.keys(option).some((key) => !['id', 'title', 'excludes', 'effects'].includes(key))) {
        fail('bad_mystery_choice', `Choice node ${node.id} contains a malformed option.`);
      }
      const optionId = canonical(option.id, 'Choice option id', 'bad_mystery_choice');
      if (seen.has(optionId)) fail('bad_mystery_choice', `Choice node ${node.id} repeats ${optionId}.`);
      seen.add(optionId);
      if (option.excludes !== undefined
        && (!Array.isArray(option.excludes)
          || option.excludes.some((id) => typeof id !== 'string' || !nodeOf(registry, id)))) {
        fail('bad_mystery_choice', `Choice option ${optionId} has invalid exclusions.`);
      }
      for (const targetId of option.excludes || []) {
        const target = nodeOf(registry, targetId);
        if (target.packageId !== node.packageId || !BOARD_NODE_TYPES.has(target.type)) {
          fail('bad_mystery_choice', 'Choice exclusions must stay inside their mystery package.');
        }
      }
      assertEffects(registry, node, option.effects);
      const optionCompletedTargets = new Set([...(node.effects || []), ...(option.effects || [])]
        .filter((effect) => ['complete', 'evidence_grant', 'status_award'].includes(effect.adapter))
        .map((effect) => effect.nodeId));
      if ((option.excludes || []).some((id) => id === node.id || optionCompletedTargets.has(id))) {
        fail('bad_mystery_choice',
          `Choice option ${optionId} cannot complete and exclude the same branch.`);
      }
    }
  }
}

/**
 * Build the immutable server authority passed to every mystery call.
 *
 * The context accepts no functions. `now` is sampled by the server per request and named time
 * windows are copied/frozen. Actor and eligibility state deliberately do not belong here.
 */
export function createMysteryContext({
  registry,
  accountId: accountIdValue,
  now = new Date().toISOString(),
  timeWindows = {},
} = {}) {
  if (!isWorldGraphRegistry(registry)) {
    fail('bad_mystery_context', 'Mystery context requires an immutable world-graph registry.');
  }
  validateGraph(registry);
  validateMysteryDefinitions(registry);
  const accountId = canonical(
    accountIdValue, 'Authenticated account id', 'bad_mystery_context',
  );
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(nowMs)) fail('bad_mystery_context', 'Mystery context requires a valid time.');
  const context = Object.freeze({
    registry,
    accountId,
    now: new Date(nowMs).toISOString(),
    nowMs,
    timeWindows: plainFrozenWindows(timeWindows),
  });
  CONTEXTS.add(context);
  return context;
}

function contextOf(value) {
  if (!value || typeof value !== 'object' || !CONTEXTS.has(value)) {
    fail('bad_mystery_context', 'Use createMysteryContext for mystery runtime authority.');
  }
  return value;
}

function packageOf(context, graphIdValue, version = null) {
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  const pkg = context.registry.byPackage.get(graphId);
  if (!pkg) fail('mystery_graph', 'No such mystery graph package.');
  const hasMystery = [...context.registry.nodes.values()].some((node) => (
    node.packageId === graphId && ['mystery_step', 'world_gate', 'choice'].includes(node.type)
  ));
  if (!hasMystery) fail('mystery_graph', 'That package does not define a mystery graph.');
  if (version !== null && Number(version) !== Number(pkg.version)) {
    fail('graph_version', 'That graph package version is not loaded.', {
      graphId, requestedVersion: Number(version), loadedVersion: Number(pkg.version),
    });
  }
  return pkg;
}

async function authorizeOwner(client, context, owner) {
  if (owner.scope === 'account') {
    if (owner.id !== context.accountId) {
      fail('mystery_owner_forbidden', 'That account cannot control this mystery owner.');
    }
    return context.accountId;
  }
  const row = (await client.query(
    'SELECT account_id FROM characters WHERE id=$1', [owner.id],
  )).rows[0];
  if (!row || row.account_id !== context.accountId) {
    fail('mystery_owner_forbidden', 'That account cannot control this mystery owner.');
  }
  return row.account_id;
}

async function actorOf(client, context, owner) {
  const row = (await client.query(owner.scope === 'account'
    ? `SELECT id,account_id,loc,respect
         FROM characters WHERE account_id=$1 AND alive
         ORDER BY created_at DESC,id LIMIT 1 FOR UPDATE`
    : `SELECT id,account_id,loc,respect
         FROM characters WHERE id=$1 AND alive FOR UPDATE`, [owner.id])).rows[0];
  if (!row || row.account_id !== context.accountId) {
    fail('no_character', 'A living character owned by this account is required.');
  }
  const skills = await client.query(
    'SELECT skill_id FROM character_skills WHERE character_id=$1', [row.id],
  );
  return Object.freeze({
    id: row.id,
    accountId: row.account_id,
    location: row.loc,
    level: levelOf(Number(row.respect || 0)),
    skills: new Set(skills.rows.map(({ skill_id: id }) => id)),
  });
}

function graphIdentity(pkg) {
  return Object.freeze({ id: pkg.id, version: Number(pkg.version), season: pkg.season || null });
}

function instanceProjection(row) {
  return {
    instanceId: row.id,
    owner: { scope: row.owner_scope, id: row.owner_id },
    graph: { id: row.graph_id, version: Number(row.graph_version) },
    status: row.status,
    createdAt: dateString(row.created_at),
    completedAt: dateString(row.completed_at),
    failedAt: dateString(row.failed_at),
    canceledAt: dateString(row.canceled_at),
  };
}

function startKey(owner, graphId, version) {
  const hash = crypto.createHash('sha256')
    .update(JSON.stringify({ owner, graphId, version }))
    .digest('hex');
  return `mystery:start:${hash}`;
}

async function instanceFor(client, owner, graphId, { lock = false } = {}) {
  return (await client.query(
    `SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
            created_at,updated_at,completed_at,failed_at,canceled_at
       FROM mystery_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND graph_id=$3${lock ? ' FOR UPDATE' : ''}`,
    [owner.scope, owner.id, graphId],
  )).rows[0] || null;
}

function assertPinned(instance, pkg) {
  if (Number(instance.graph_version) !== Number(pkg.version)) {
    fail('stale_graph_version', 'The mystery is pinned to another graph package version.', {
      graphId: instance.graph_id,
      pinnedVersion: Number(instance.graph_version),
      loadedVersion: Number(pkg.version),
    });
  }
}

/** Start one owner/package instance. The server-derived deterministic key makes retries exact. */
export async function startMystery(client, contextValue, ownerValue, graphIdValue, version) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const pkg = packageOf(context, graphIdValue, version);
  await authorizeOwner(client, context, owner);
  const graph = graphIdentity(pkg);
  const existing = await instanceFor(client, owner, pkg.id);
  if (existing) {
    if (existing.authority_account_id !== context.accountId) {
      fail('mystery_owner_forbidden', 'That account cannot control this mystery instance.');
    }
    if (Number(existing.graph_version) !== Number(pkg.version)) {
      fail('graph_version_pinned', 'That owner already has this mystery pinned to another version.', {
        graphId: pkg.id,
        pinnedVersion: Number(existing.graph_version),
        requestedVersion: Number(pkg.version),
      });
    }
    return { ok: true, ...instanceProjection(existing) };
  }
  return withItemMutation(
    client,
    owner,
    'mystery_action',
    startKey(owner, pkg.id, Number(pkg.version)),
    { action: 'start', graph },
    async () => {
      await actorOf(client, context, owner);
      const id = crypto.randomUUID();
      const inserted = await client.query(
        `INSERT INTO mystery_instances
           (id,owner_scope,owner_id,authority_account_id,graph_id,graph_version)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (owner_scope,owner_id,graph_id) DO NOTHING
         RETURNING id`,
        [id, owner.scope, owner.id, context.accountId, pkg.id, Number(pkg.version)],
      );
      if (inserted.rowCount === 1) {
        registerItemTransactionUndo(client, async () => {
          await client.query('DELETE FROM mystery_choices WHERE instance_id=$1', [id]);
          await client.query('DELETE FROM mystery_node_state WHERE instance_id=$1', [id]);
          await client.query('DELETE FROM mystery_instances WHERE id=$1', [id]);
        });
      }
      const instance = await instanceFor(client, owner, pkg.id, { lock: true });
      if (!instance) fail('mystery_start_failed', 'The mystery instance could not be created.');
      if (instance.authority_account_id !== context.accountId) {
        fail('mystery_owner_forbidden', 'That account cannot control this mystery instance.');
      }
      if (Number(instance.graph_version) !== Number(pkg.version)) {
        fail('graph_version_pinned', 'That owner already has this mystery pinned to another version.', {
          graphId: pkg.id,
          pinnedVersion: Number(instance.graph_version),
          requestedVersion: Number(pkg.version),
        });
      }
      return { ok: true, ...instanceProjection(instance) };
    },
  );
}

async function stateRows(client, instanceId) {
  return (await client.query(
    `SELECT instance_id,node_id,state,result_json,discovered_at,completed_at,failed_at,updated_at
       FROM mystery_node_state WHERE instance_id=$1`, [instanceId],
  )).rows;
}

function stateMap(rows) {
  return new Map(rows.map((row) => [row.node_id, row]));
}

async function setNodeState(client, instanceId, nodeId, state, result = null) {
  const previous = (await client.query(
    `SELECT instance_id,node_id,state,result_json,discovered_at,completed_at,failed_at,updated_at
       FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2`,
    [instanceId, nodeId],
  )).rows[0] || null;
  if (state === 'discovered' && previous) return { ...previous, unchanged: true };
  if (state === 'completed' && previous?.state === 'completed') {
    return { ...previous, unchanged: true };
  }
  if (['discovered', 'completed'].includes(state)
    && ['failed', 'excluded'].includes(previous?.state)) {
    fail('mystery_excluded', 'A closed mystery branch cannot be reopened.');
  }
  registerItemTransactionUndo(client, async () => {
    if (!previous) {
      await client.query(
        'DELETE FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',
        [instanceId, nodeId],
      );
      return;
    }
    await client.query(
      `UPDATE mystery_node_state
          SET state=$3,result_json=$4,discovered_at=$5,completed_at=$6,failed_at=$7,updated_at=$8
        WHERE instance_id=$1 AND node_id=$2`,
      [instanceId, nodeId, previous.state, previous.result_json, previous.discovered_at,
        previous.completed_at, previous.failed_at, previous.updated_at],
    );
  });
  const discoveredAt = state === 'completed'
    ? (previous?.discovered_at || new Date())
    : state === 'discovered' ? (previous?.discovered_at || new Date()) : previous?.discovered_at;
  const completedAt = state === 'completed' ? new Date() : null;
  const failedAt = ['failed', 'excluded'].includes(state) ? new Date() : null;
  return (await client.query(
    `INSERT INTO mystery_node_state
       (instance_id,node_id,state,result_json,discovered_at,completed_at,failed_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,now())
     ON CONFLICT (instance_id,node_id) DO UPDATE SET
       state=$3,result_json=$4,
       discovered_at=COALESCE(mystery_node_state.discovered_at,$5),
       completed_at=$6,failed_at=$7,updated_at=now()
     RETURNING instance_id,node_id,state,result_json,discovered_at,completed_at,failed_at,updated_at`,
    [instanceId, nodeId, state, result === null ? null : JSON.stringify(result),
      discoveredAt, completedAt, failedAt],
  )).rows[0];
}

async function saveNodeResult(client, instanceId, nodeId, result) {
  await client.query(
    'UPDATE mystery_node_state SET result_json=$3 WHERE instance_id=$1 AND node_id=$2',
    [instanceId, nodeId, JSON.stringify(result)],
  );
}

function conditionValue(condition, names) {
  for (const name of names) if (condition?.[name] !== undefined) return condition[name];
  return undefined;
}

async function conditionBlocker({
  client, context, owner, actor, instance, states, condition, interactionId, lock,
}) {
  const adapter = condition?.adapter || condition?.type || condition?.kind;
  if (!CONDITION_ADAPTERS.has(adapter)) {
    fail('unsupported_mystery_condition', `Unsupported mystery condition ${String(adapter)}.`);
  }
  if (adapter === 'graph_dependency') {
    const nodeId = conditionValue(condition, ['nodeId', 'id', 'value']);
    return states.get(nodeId)?.state === 'completed' ? null : { adapter, nodeId };
  }
  if (adapter === 'location') {
    const required = conditionValue(condition, ['value', 'locationId', 'district']);
    return actor?.location === required ? null : { adapter, required, current: actor?.location || null };
  }
  if (adapter === 'level') {
    const required = Number(conditionValue(condition, ['value', 'minimumLevel', 'level']));
    return actor?.level >= required ? null : { adapter, required, current: actor?.level || 0 };
  }
  if (adapter === 'skill') {
    const required = conditionValue(condition, ['skillId', 'id', 'value']);
    return actor?.skills?.has(required) ? null : { adapter, required };
  }
  if (adapter === 'item_ownership' || adapter === 'owns_item') {
    const templateId = conditionValue(condition, ['templateId', 'itemTemplateId', 'nodeId']);
    const row = (await client.query(
      `SELECT id FROM item_instances
        WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND state='active'
        ORDER BY created_at,id LIMIT 1${lock ? ' FOR UPDATE' : ''}`,
      [owner.scope, owner.id, templateId],
    )).rows[0];
    return row ? null : { adapter, templateId };
  }
  if (adapter === 'material_quantity') {
    const templateId = conditionValue(condition, ['templateId', 'materialId', 'nodeId']);
    const required = Number(conditionValue(condition, ['quantity', 'minimumQuantity', 'amount']));
    const row = (await client.query(
      `SELECT quantity FROM item_stacks
        WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality='standard'${
  lock ? ' FOR UPDATE' : ''}`,
      [owner.scope, owner.id, templateId],
    )).rows[0];
    const current = Number(row?.quantity || 0);
    return current >= required ? null : { adapter, templateId, required, current };
  }
  if (adapter === 'evidence') {
    const nodeId = conditionValue(condition, ['evidenceId', 'nodeId']);
    return states.get(nodeId)?.state === 'completed' ? null : { adapter, nodeId };
  }
  if (adapter === 'time_window') {
    const windowId = conditionValue(condition, ['windowId', 'value']);
    const declared = windowId ? context.timeWindows[windowId] : null;
    const startsAt = conditionValue(condition, ['start', 'startsAt']) || declared?.startsAt;
    const endsAt = conditionValue(condition, ['end', 'endsAt']) || declared?.endsAt;
    const open = startsAt && endsAt
      && context.nowMs >= Date.parse(startsAt) && context.nowMs < Date.parse(endsAt);
    return open ? null : { adapter, windowId: windowId || null };
  }
  const required = conditionValue(condition, ['interactionId', 'id', 'value']);
  return interactionId === required ? null : { adapter };
}

async function nodeBlockers({
  client, context, owner, actor, instance, states, node, interactionId = null, lock = false,
}) {
  const blockers = [];
  const current = states.get(node.id);
  if (current?.state === 'excluded' || current?.state === 'failed') {
    blockers.push({ adapter: 'excluded' });
  }
  for (const dependencyId of node.requires || []) {
    if (states.get(dependencyId)?.state !== 'completed') {
      blockers.push({ adapter: 'graph_dependency', nodeId: dependencyId });
    }
  }
  for (const group of node.requiresAny || []) {
    if (!group.some((dependencyId) => states.get(dependencyId)?.state === 'completed')) {
      blockers.push({ adapter: 'graph_dependency_any', nodeIds: [...group] });
    }
  }
  for (const excludedId of node.excludes || []) {
    if (states.get(excludedId)?.state === 'completed') {
      blockers.push({ adapter: 'excluded_by', nodeId: excludedId });
    }
  }
  for (const condition of node.conditions || []) {
    const blocker = await conditionBlocker({
      client, context, owner, actor, instance, states, condition, interactionId, lock,
    });
    if (blocker) blockers.push(blocker);
  }
  return blockers;
}

function throwBlocker(blocker) {
  if (blocker.adapter === 'excluded' || blocker.adapter === 'excluded_by') {
    fail('mystery_excluded', 'That mystery branch is closed.');
  }
  if (blocker.adapter === 'location') {
    fail('location', 'That mystery interaction requires another district.', {
      district: blocker.required, current: blocker.current,
    });
  }
  if (blocker.adapter === 'level') {
    fail('level', `That mystery interaction requires level ${blocker.required}.`, blocker);
  }
  if (blocker.adapter === 'skill') {
    fail('skill', 'That mystery interaction requires another skill.', { skillId: blocker.required });
  }
  if (blocker.adapter === 'item_ownership' || blocker.adapter === 'owns_item') {
    fail('item_unavailable', 'The required unique item is not held by this mystery owner.');
  }
  if (blocker.adapter === 'material_quantity') {
    fail('materials', 'The mystery owner lacks the required material quantity.', {
      required: blocker.required, current: blocker.current,
    });
  }
  if (blocker.adapter === 'evidence') {
    fail('evidence', 'The required evidence has not been established.');
  }
  if (blocker.adapter === 'time_window') {
    fail('time_window', 'That mystery interaction is outside its server-defined time window.');
  }
  if (blocker.adapter === 'explicit_interaction') {
    fail('interaction', 'That mystery node requires its exact explicit interaction.');
  }
  fail('mystery_prerequisite', 'That mystery node has unmet graph prerequisites.');
}

function actionNode(context, graphId, nodeIdValue, expectedType = null, { discovery = false } = {}) {
  const nodeId = canonical(nodeIdValue, 'Mystery node id');
  const node = nodeOf(context.registry, nodeId);
  if (!node || node.packageId !== graphId) fail('mystery_node', 'No such node in this mystery graph.');
  if (expectedType && node.type !== expectedType) {
    fail('mystery_node_type', `Mystery node ${nodeId} is not a ${expectedType}.`);
  }
  if (!expectedType && !ACTION_NODE_TYPES.has(node.type)
    && !(discovery && node.type === 'choice')) {
    fail('mystery_node_type', `Mystery node ${nodeId} is not directly completable.`);
  }
  if (node.visibility === 'role_private') {
    fail('mystery_role_private', 'Role-private nodes require the social operation runtime.');
  }
  return node;
}

function mutationOptions(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !['idempotencyKey', 'interactionId'].includes(key))) {
    fail('bad_mystery_request', 'Mystery action options are malformed.');
  }
  return {
    idempotencyKey: canonical(value.idempotencyKey, 'Idempotency key', 'bad_idempotency_key'),
    interactionId: value.interactionId === undefined ? null
      : canonical(value.interactionId, 'Interaction id'),
  };
}

async function actionAuthority(client, context, owner, graphId) {
  await authorizeOwner(client, context, owner);
  const pkg = packageOf(context, graphId);
  const instance = await instanceFor(client, owner, pkg.id);
  if (!instance) fail('mystery_not_started', 'Start this mystery first.');
  if (instance.authority_account_id !== context.accountId) {
    fail('mystery_owner_forbidden', 'That account cannot control this mystery instance.');
  }
  assertPinned(instance, pkg);
  return { pkg, instance };
}

async function lockedActionInstance(client, authority, context, { allowClosed = false } = {}) {
  const instance = await instanceFor(
    client,
    { scope: authority.instance.owner_scope, id: authority.instance.owner_id },
    authority.pkg.id,
    { lock: true },
  );
  if (!instance || instance.id !== authority.instance.id
    || instance.authority_account_id !== context.accountId) {
    fail('mystery_owner_forbidden', 'Mystery instance authority changed.');
  }
  assertPinned(instance, authority.pkg);
  if (!allowClosed && instance.status !== 'active') {
    fail('mystery_closed', 'That mystery instance is not active.');
  }
  return instance;
}

async function setInstanceStatus(client, instance, status) {
  const prior = { ...instance };
  registerItemTransactionUndo(client, () => client.query(
    `UPDATE mystery_instances
        SET status=$2,updated_at=$3,completed_at=$4,failed_at=$5,canceled_at=$6
      WHERE id=$1`,
    [prior.id, prior.status, prior.updated_at, prior.completed_at, prior.failed_at, prior.canceled_at],
  ));
  const completedAt = status === 'completed' ? new Date() : null;
  const failedAt = status === 'failed' ? new Date() : null;
  const canceledAt = status === 'canceled' ? new Date() : null;
  const changed = await client.query(
    `UPDATE mystery_instances
        SET status=$2,updated_at=now(),completed_at=$3,failed_at=$4,canceled_at=$5
      WHERE id=$1 AND status='active'
      RETURNING id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
                created_at,updated_at,completed_at,failed_at,canceled_at`,
    [instance.id, status, completedAt, failedAt, canceledAt],
  );
  if (changed.rowCount !== 1) fail('mystery_closed', 'That mystery instance is not active.');
  return changed.rows[0];
}

async function selectOwnedItem(client, owner, templateId) {
  const row = (await client.query(
    `SELECT id FROM item_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND state='active'
      ORDER BY created_at,id LIMIT 1 FOR UPDATE`,
    [owner.scope, owner.id, templateId],
  )).rows[0];
  if (!row) fail('item_unavailable', 'The required unique item is not spendable by this owner.');
  return row.id;
}

async function releaseMysteryEscrow(client, owner, instance, mutation) {
  const rows = (await client.query(
    `SELECT item_id,depositor_scope,depositor_id
       FROM operation_escrow WHERE operation_id=$1
       ORDER BY created_at,item_id FOR UPDATE`,
    [instance.id],
  )).rows;
  for (const row of rows) {
    if (row.depositor_scope !== owner.scope || row.depositor_id !== owner.id) {
      fail('mystery_escrow_authority',
        'A mystery instance may release only its root owner\'s escrow.');
    }
  }
  for (const row of rows) {
    await releaseEscrow(
      client,
      instance.id,
      owner,
      row.item_id,
      `mystery ${instance.graph_id} release`,
      mutation,
    );
  }
  return rows.length;
}

async function closeExcludedBranches(client, context, instance, initialIds) {
  const closed = new Set(initialIds);
  const packageNodes = [...context.registry.nodes.values()]
    .filter((node) => node.packageId === instance.graph_id && BOARD_NODE_TYPES.has(node.type));
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of packageNodes) {
      if (closed.has(node.id)) continue;
      const requiredClosed = (node.requires || []).some((id) => closed.has(id));
      const alternativeClosed = (node.requiresAny || [])
        .some((group) => group.every((id) => closed.has(id)));
      const conditionClosed = (node.conditions || []).some((condition) => (
        (condition.adapter || condition.type || condition.kind) === 'graph_dependency'
        && closed.has(conditionValue(condition, ['nodeId', 'id', 'value']))
      ));
      if (requiredClosed || alternativeClosed || conditionClosed) {
        closed.add(node.id);
        changed = true;
      }
    }
  }
  for (const nodeId of closed) {
    const current = (await client.query(
      'SELECT state FROM mystery_node_state WHERE instance_id=$1 AND node_id=$2',
      [instance.id, nodeId],
    )).rows[0];
    if (current?.state === 'completed' || current?.state === 'excluded') continue;
    await setNodeState(client, instance.id, nodeId, 'excluded');
  }
}

async function applyEffects({ client, context, owner, instance, effects, mutation }) {
  const results = [];
  for (const effect of effects || []) {
    if (effect.adapter === 'discover') {
      const row = await setNodeState(client, instance.id, effect.nodeId, 'discovered');
      results.push({ kind: 'discover', nodeId: effect.nodeId, at: dateString(row.discovered_at) });
    } else if (effect.adapter === 'complete' || effect.adapter === 'evidence_grant'
      || effect.adapter === 'status_award') {
      const kind = effect.adapter === 'evidence_grant' ? 'evidence'
        : effect.adapter === 'status_award' ? 'status' : 'complete';
      const effectResult = {
        ok: true, instanceId: instance.id, node: { id: effect.nodeId, status: 'completed' },
        effects: [],
      };
      const row = await setNodeState(
        client, instance.id, effect.nodeId, 'completed', effectResult,
      );
      effectResult.node.completedAt = dateString(row.completed_at);
      if (!row.unchanged) await saveNodeResult(client, instance.id, effect.nodeId, effectResult);
      results.push({ kind, nodeId: effect.nodeId, at: effectResult.node.completedAt });
    } else if (effect.adapter === 'item_consume') {
      const itemId = await selectOwnedItem(client, owner, effect.templateId);
      const item = await consumeItem(
        client, owner, itemId, `mystery ${instance.graph_id} consume`, mutation,
      );
      results.push({ kind: 'item_consume', item });
    } else if (effect.adapter === 'item_escrow') {
      const itemId = await selectOwnedItem(client, owner, effect.templateId);
      const item = await escrowItem(
        client, owner, instance.id, itemId,
        `mystery ${instance.graph_id} escrow`, mutation, 'used_in_mystery',
      );
      results.push({ kind: 'item_escrow', item });
    } else if (effect.adapter === 'unique_item_award') {
      const item = await createItem(
        client, owner, effect.templateId, 'awarded', mutation,
      );
      results.push({ kind: 'unique_item_award', item });
    } else {
      // Context construction validated every executable effect. Keep runtime fail-closed if a
      // compromised registry somehow changes identity after that validation.
      fail('unsupported_mystery_effect', `Unsupported mystery effect ${String(effect.adapter)}.`);
    }
  }
  return results;
}

async function completeGraphNode({
  client, context, owner, instance, node, interactionId, mutation, extraEffects = [],
}) {
  let states = stateMap(await stateRows(client, instance.id));
  const existing = states.get(node.id);
  if (existing?.state === 'completed') {
    return existing.result_json ? JSON.parse(existing.result_json) : {
      ok: true,
      instanceId: instance.id,
      node: { id: node.id, status: 'completed', completedAt: dateString(existing.completed_at) },
      effects: [],
    };
  }
  if (existing?.state === 'excluded' || existing?.state === 'failed') {
    fail('mystery_excluded', 'That mystery branch is closed.');
  }
  if (node.visibility !== 'public' && existing?.state !== 'discovered') {
    fail('mystery_hidden', 'Discover that mystery node before completing it.');
  }
  const actor = await actorOf(client, context, owner);
  states = stateMap(await stateRows(client, instance.id));
  const blockers = await nodeBlockers({
    client, context, owner, actor, instance, states, node, interactionId, lock: true,
  });
  if (blockers.length) throwBlocker(blockers[0]);
  await applyEffects({
    client, context, owner, instance, effects: [...(node.effects || []), ...extraEffects], mutation,
  });
  const row = await setNodeState(client, instance.id, node.id, 'completed');
  await closeExcludedBranches(client, context, instance, node.excludes || []);
  const result = {
    ok: true,
    instanceId: instance.id,
    node: { id: node.id, status: 'completed', completedAt: dateString(row.completed_at) },
  };
  if (node.metadata?.terminal === true) {
    result.releasedEscrowCount = await releaseMysteryEscrow(
      client, owner, instance, mutation,
    );
    const completedInstance = await setInstanceStatus(client, instance, 'completed');
    result.status = completedInstance.status;
    result.completedAt = dateString(completedInstance.completed_at);
  }
  await saveNodeResult(client, instance.id, node.id, result);
  return result;
}

/** Reveal one non-public node after all server-derived discovery conditions pass. */
export async function discoverNode(
  client, contextValue, ownerValue, graphIdValue, nodeIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  const options = mutationOptions(optionsValue);
  const authority = await actionAuthority(client, context, owner, graphId);
  const node = actionNode(context, graphId, nodeIdValue, null, { discovery: true });
  return withItemMutation(
    client,
    owner,
    'mystery_action',
    options.idempotencyKey,
    {
      action: 'discover', graph: graphIdentity(authority.pkg), nodeId: node.id,
      interactionId: options.interactionId,
      itemAuthority: { operations: [authority.instance.id] },
    },
    async () => {
      const instance = await lockedActionInstance(client, authority, context);
      let states = stateMap(await stateRows(client, instance.id));
      const existing = states.get(node.id);
      if (existing?.state === 'completed' && existing.result_json) {
        return JSON.parse(existing.result_json);
      }
      if (existing?.state === 'discovered') {
        return {
          ok: true, instanceId: instance.id,
          node: { id: node.id, status: 'discovered', discoveredAt: dateString(existing.discovered_at) },
        };
      }
      const actor = await actorOf(client, context, owner);
      states = stateMap(await stateRows(client, instance.id));
      const blockers = await nodeBlockers({
        client, context, owner, actor, instance, states, node,
        interactionId: options.interactionId, lock: true,
      });
      if (blockers.length) throwBlocker(blockers[0]);
      const row = await setNodeState(client, instance.id, node.id, 'discovered');
      return {
        ok: true, instanceId: instance.id,
        node: { id: node.id, status: 'discovered', discoveredAt: dateString(row.discovered_at) },
      };
    },
  );
}

/** Complete one mystery/world-gate node and atomically apply its allow-listed effects. */
export async function completeNode(
  client, contextValue, ownerValue, graphIdValue, nodeIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  const options = mutationOptions(optionsValue);
  const authority = await actionAuthority(client, context, owner, graphId);
  const node = actionNode(context, graphId, nodeIdValue);
  return withItemMutation(
    client,
    owner,
    'mystery_action',
    options.idempotencyKey,
    {
      action: 'complete', graph: graphIdentity(authority.pkg), nodeId: node.id,
      interactionId: options.interactionId,
      itemAuthority: {
        operations: [authority.instance.id],
        ...(node.metadata?.terminal === true ? { destinations: [owner] } : {}),
      },
    },
    async (mutation) => {
      const instance = await lockedActionInstance(client, authority, context);
      return completeGraphNode({
        client, context, owner, instance, node,
        interactionId: options.interactionId, mutation,
      });
    },
  );
}

async function choiceRow(client, instanceId, nodeId) {
  return (await client.query(
    `SELECT instance_id,node_id,choice_id,result_json,committed_at
       FROM mystery_choices WHERE instance_id=$1 AND node_id=$2`,
    [instanceId, nodeId],
  )).rows[0] || null;
}

async function insertChoice(client, instanceId, nodeId, choiceId) {
  registerItemTransactionUndo(client, () => client.query(
    'DELETE FROM mystery_choices WHERE instance_id=$1 AND node_id=$2', [instanceId, nodeId],
  ));
  return (await client.query(
    `INSERT INTO mystery_choices (instance_id,node_id,choice_id,result_json)
     VALUES ($1,$2,$3,'{}')
     RETURNING instance_id,node_id,choice_id,result_json,committed_at`,
    [instanceId, nodeId, choiceId],
  )).rows[0];
}

/** Commit one choice option permanently, close excluded branches, and apply only its safe effects. */
export async function commitChoice(
  client, contextValue, ownerValue, graphIdValue, nodeIdValue, choiceIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  const choiceId = canonical(choiceIdValue, 'Choice id');
  const options = mutationOptions(optionsValue);
  const authority = await actionAuthority(client, context, owner, graphId);
  const node = actionNode(context, graphId, nodeIdValue, 'choice');
  const option = node.options.find(({ id }) => id === choiceId);
  if (!option) fail('mystery_choice', 'No such choice option.');
  return withItemMutation(
    client,
    owner,
    'mystery_action',
    options.idempotencyKey,
    {
      action: 'choice', graph: graphIdentity(authority.pkg), nodeId: node.id, choiceId,
      interactionId: options.interactionId,
      itemAuthority: { operations: [authority.instance.id] },
    },
    async (mutation) => {
      const instance = await lockedActionInstance(client, authority, context);
      const existing = await choiceRow(client, instance.id, node.id);
      if (existing) {
        if (existing.choice_id !== choiceId) {
          fail('choice_committed', 'That mystery choice is already committed.');
        }
        return JSON.parse(existing.result_json);
      }
      let states = stateMap(await stateRows(client, instance.id));
      const current = states.get(node.id);
      if (node.visibility !== 'public' && current?.state !== 'discovered') {
        fail('mystery_hidden', 'Discover that mystery choice before committing it.');
      }
      const exclusionIds = [...new Set([
        ...(node.excludes || []), ...(option.excludes || []),
      ])];
      const committedChoices = new Set((await client.query(
        'SELECT node_id FROM mystery_choices WHERE instance_id=$1', [instance.id],
      )).rows.map(({ node_id: id }) => id));
      const contradictory = exclusionIds.find((id) => (
        states.get(id)?.state === 'completed' || committedChoices.has(id)
      ));
      if (contradictory) {
        fail('choice_conflict', 'That option contradicts an already completed mystery branch.');
      }
      const actor = await actorOf(client, context, owner);
      states = stateMap(await stateRows(client, instance.id));
      const blockers = await nodeBlockers({
        client, context, owner, actor, instance, states, node,
        interactionId: options.interactionId, lock: true,
      });
      if (blockers.length) throwBlocker(blockers[0]);
      const committed = await insertChoice(client, instance.id, node.id, choiceId);
      await applyEffects({
        client, context, owner, instance,
        effects: [...(node.effects || []), ...(option.effects || [])], mutation,
      });
      const completed = await setNodeState(client, instance.id, node.id, 'completed');
      await closeExcludedBranches(client, context, instance, exclusionIds);
      const result = {
        ok: true,
        instanceId: instance.id,
        node: { id: node.id, status: 'completed', completedAt: dateString(completed.completed_at) },
        choice: { id: choiceId, committedAt: dateString(committed.committed_at) },
      };
      await client.query(
        `UPDATE mystery_choices SET result_json=$3
          WHERE instance_id=$1 AND node_id=$2`,
        [instance.id, node.id, JSON.stringify(result)],
      );
      await saveNodeResult(client, instance.id, node.id, result);
      return result;
    },
  );
}

/**
 * Cancel one active mystery and atomically return every item held by that mystery to its original
 * root owner. Cancellation needs no living-character eligibility, so a durable account can recover
 * custody after street replacement and a character owner can recover while its historical row still
 * proves the authenticated account relationship.
 */
export async function cancelMystery(
  client, contextValue, ownerValue, graphIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  const options = mutationOptions(optionsValue);
  const authority = await actionAuthority(client, context, owner, graphId);
  return withItemMutation(
    client,
    owner,
    'mystery_action',
    options.idempotencyKey,
    {
      action: 'cancel', graph: graphIdentity(authority.pkg),
      itemAuthority: {
        operations: [authority.instance.id],
        destinations: [owner],
      },
    },
    async (mutation) => {
      const instance = await lockedActionInstance(
        client, authority, context, { allowClosed: true },
      );
      if (instance.status === 'canceled') {
        return { ok: true, ...instanceProjection(instance), releasedEscrowCount: 0 };
      }
      if (instance.status !== 'active') {
        fail('mystery_closed', 'A completed or failed mystery cannot be canceled.');
      }
      const releasedEscrowCount = await releaseMysteryEscrow(
        client, owner, instance, mutation,
      );
      const canceled = await setInstanceStatus(client, instance, 'canceled');
      return { ok: true, ...instanceProjection(canceled), releasedEscrowCount };
    },
  );
}

function publicNode(node, row, blockers) {
  const status = row?.state || 'available';
  const actionable = ACTION_NODE_TYPES.has(node.type) || node.type === 'choice';
  const projection = {
    id: node.id,
    type: node.type,
    title: node.metadata?.title || node.id,
    status,
    available: actionable && status !== 'excluded' && status !== 'failed'
      && status !== 'completed' && blockers.length === 0,
    blockedBy: blockers,
  };
  if (node.type === 'choice') {
    projection.options = node.options.map(({ id, title }) => ({ id, title: title || id }));
  }
  return projection;
}

function publicBlocker(context, states, blocker) {
  const visibleReference = (id) => {
    const target = nodeOf(context.registry, id);
    if (!target) return true;
    if (target.visibility === 'public') return true;
    if (target.visibility === 'role_private') return false;
    const state = states.get(id);
    return !!state?.discovered_at || state?.state === 'completed';
  };
  const projection = { ...blocker };
  if (projection.nodeId && !visibleReference(projection.nodeId)) delete projection.nodeId;
  if (projection.templateId && !visibleReference(projection.templateId)) delete projection.templateId;
  if (Array.isArray(projection.nodeIds)) {
    const visible = projection.nodeIds.filter(visibleReference);
    if (visible.length) projection.nodeIds = visible;
    else delete projection.nodeIds;
  }
  return projection;
}

/** Read a safe board. Hidden nodes require discovery; role-private nodes belong to Task 6. */
export async function mysteryBoard(client, contextValue, ownerValue, graphIdValue) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  await authorizeOwner(client, context, owner);
  const pkg = packageOf(context, graphId);
  const instance = await instanceFor(client, owner, graphId);
  if (!instance) fail('mystery_not_started', 'Start this mystery first.');
  if (instance.authority_account_id !== context.accountId) {
    fail('mystery_owner_forbidden', 'That account cannot view this mystery instance.');
  }
  assertPinned(instance, pkg);
  const rows = await stateRows(client, instance.id);
  const states = stateMap(rows);
  let actor = null;
  try { actor = await actorOf(client, context, owner); } catch (error) {
    if (error?.code !== 'no_character') throw error;
  }
  const nodes = [];
  for (const node of context.registry.nodes.values()) {
    if (node.packageId !== graphId || !BOARD_NODE_TYPES.has(node.type)
      || node.visibility === 'role_private') continue;
    const row = states.get(node.id);
    if (node.visibility !== 'public' && !row?.discovered_at && row?.state !== 'completed') continue;
    const blockers = await nodeBlockers({
      client, context, owner, actor, instance, states, node, lock: false,
    });
    nodes.push(publicNode(
      node, row, blockers.map((blocker) => publicBlocker(context, states, blocker)),
    ));
  }
  const choices = (await client.query(
    `SELECT node_id,choice_id FROM mystery_choices
      WHERE instance_id=$1 ORDER BY committed_at,node_id`, [instance.id],
  )).rows.filter((row) => {
    const choice = nodeOf(context.registry, row.node_id);
    if (!choice || choice.type !== 'choice' || choice.visibility === 'role_private') return false;
    const state = states.get(row.node_id);
    return choice.visibility === 'public' || !!state?.discovered_at || state?.state === 'completed';
  }).map((row) => ({ nodeId: row.node_id, choiceId: row.choice_id }));
  return {
    ...instanceProjection(instance),
    graph: { ...graphIdentity(pkg), version: Number(instance.graph_version) },
    nodes,
    choices,
  };
}

export const SUPPORTED_MYSTERY_CONDITION_ADAPTERS = Object.freeze([...CONDITION_ADAPTERS]);
export const SUPPORTED_MYSTERY_EFFECT_ADAPTERS = Object.freeze([...MYSTERY_EFFECT_ADAPTERS]);
