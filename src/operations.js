// Server-authoritative, data-defined social operations for the Phase 1 world graph.
//
// The authenticated account is sealed into createOperationContext. Every actor, Crew membership,
// role assignment, graph prerequisite, item, and terminal recipient is then resolved from locked
// server state. Graph packages are immutable data; this module exposes no callback, SQL, cash, OMR,
// or transaction-ledger adapter.
import crypto from 'node:crypto';
import { dbCaps } from './db.js';
import { GameError } from './game.js';
import {
  awaitItemReadBarrier,
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
const PROOF_ROLES = Object.freeze(['investigator', 'driver', 'mechanic', 'enforcer']);
const CONDITION_ADAPTERS = new Set([
  'graph_dependency', 'location', 'level', 'skill', 'item_ownership', 'owns_item',
  'material_quantity', 'evidence', 'explicit_interaction',
]);
const CONTRIBUTION_EFFECTS = new Set(['evidence_grant', 'item_escrow']);
const COMPLETION_EFFECTS = new Set(['unique_item_award', 'status_award']);
const GRAPH_STATE_TYPES = new Set(['social_gate', 'operation_step', 'evidence', 'reward']);
const MYSTERY_BRIDGE_NODE_TYPES = new Set([
  'mystery_step', 'world_gate', 'choice', 'evidence', 'reward',
]);

const fail = (code, message, data) => { throw new GameError(code, message, data); };

function canonical(value, label, code = 'bad_operation_request', max = 200) {
  if (typeof value !== 'string' || value.trim() !== value || !value || value.length > max) {
    fail(code, `${label} must be a canonical string of at most ${max} characters.`);
  }
  return value;
}

const dateString = (value) => value == null ? null : new Date(value).toISOString();
const rolesOf = (root) => root.roles || root.metadata?.roles || [];
const completionRequires = (root) => root.metadata?.completionRequires || [];

function packageDependencies(registry, packageId, result = new Set()) {
  const pkg = registry.byPackage.get(packageId);
  for (const raw of pkg?.dependsOn || []) {
    const id = typeof raw === 'string' ? raw : raw.id;
    if (result.has(id)) continue;
    result.add(id);
    packageDependencies(registry, id, result);
  }
  return result;
}

function assertVisibleTarget(registry, source, target) {
  const dependencies = packageDependencies(registry, source.packageId);
  if (target.packageId !== source.packageId && !dependencies.has(target.packageId)) {
    fail('bad_operation_definition', `Operation node ${source.id} crosses a package boundary.`);
  }
}

function assertCondition(condition, owner) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)
    || Object.getPrototypeOf(condition) !== Object.prototype) {
    fail('bad_operation_definition', `${owner} has a malformed condition.`);
  }
  const adapter = condition.adapter || condition.type || condition.kind;
  if (!CONDITION_ADAPTERS.has(adapter)) {
    fail('unsupported_operation_condition', `${owner} uses unsupported condition ${String(adapter)}.`);
  }
}

function assertRolePrivate(node, roleIds, operationId) {
  if (node.visibility !== 'role_private') return;
  const roleId = node.metadata?.roleId;
  if (!roleIds.has(roleId) || node.metadata?.operationId !== operationId) {
    fail('bad_operation_definition', `Role-private node ${node.id} needs a declared role.`);
  }
}

function assertOperationReference(registry, root, id, label) {
  const target = nodeOf(registry, id);
  if (!target || target.packageId !== root.packageId
    || (target.id !== root.id && target.metadata?.operationId !== root.id)) {
    fail('bad_operation_definition', `${label} crosses an operation boundary.`);
  }
  return target;
}

function validateMysteryBridge(registry, root) {
  const gate = root.metadata?.mysteryGate;
  const dependencies = [
    ...(root.requires || []),
    ...(root.requiresAny || []).flat(),
    ...(root.excludes || []),
  ];
  if (!gate) {
    if (dependencies.length) {
      fail('bad_operation_definition',
        `Operation ${root.id} graph gates require an explicit mystery bridge.`);
    }
    return;
  }
  if (!gate || typeof gate !== 'object' || Array.isArray(gate)
    || Object.getPrototypeOf(gate) !== Object.prototype
    || Object.keys(gate).some((key) => ![
      'graphId', 'graphVersion', 'ownerScope', 'requiredStatus',
    ].includes(key))
    || typeof gate.graphId !== 'string' || !Number.isInteger(gate.graphVersion)
    || gate.graphVersion < 1 || !['account', 'character'].includes(gate.ownerScope)
    || !['active', 'completed'].includes(gate.requiredStatus)) {
    fail('bad_operation_definition', `Operation ${root.id} has a malformed mystery bridge.`);
  }
  const pkg = registry.byPackage.get(gate.graphId);
  if (!pkg || Number(pkg.version) !== gate.graphVersion) {
    fail('bad_operation_definition', `Operation ${root.id} mystery bridge version is unavailable.`);
  }
  for (const id of dependencies) {
    const target = nodeOf(registry, id);
    if (!target || target.packageId !== gate.graphId || !MYSTERY_BRIDGE_NODE_TYPES.has(target.type)) {
      fail('bad_operation_definition',
        `Operation ${root.id} mystery bridge references an invalid graph node.`);
    }
  }
}

function assertEffect(registry, root, source, effect, allowed, roleIds) {
  if (!effect || typeof effect !== 'object' || Array.isArray(effect)
    || Object.getPrototypeOf(effect) !== Object.prototype) {
    fail('bad_operation_effect', `Operation node ${source.id} has a malformed effect.`);
  }
  const adapter = effect.adapter;
  if (!allowed.has(adapter)) {
    fail('unsupported_operation_effect', `Unsupported operation effect ${String(adapter)}.`);
  }
  const fields = adapter === 'evidence_grant' || adapter === 'status_award'
    ? new Set(['adapter', 'nodeId'])
    : adapter === 'item_escrow'
      ? new Set(['adapter', 'templateId'])
      : new Set(['adapter', 'templateId', 'recipientRoleId']);
  if (Object.keys(effect).some((key) => !fields.has(key))) {
    fail('bad_operation_effect', `Operation effect ${adapter} contains authority fields.`);
  }
  const targetId = canonical(effect.nodeId || effect.templateId, 'Operation effect target');
  const target = nodeOf(registry, targetId);
  if (!target) fail('bad_operation_effect', `Operation effect target ${targetId} is missing.`);
  assertVisibleTarget(registry, source, target);
  if (adapter === 'evidence_grant') {
    if (target.type !== 'evidence') {
      fail('bad_operation_effect', 'Evidence grants require an evidence node.');
    }
    if (target.visibility === 'role_private'
      && target.metadata?.roleId !== source.metadata?.roleId) {
      fail('bad_operation_effect', 'Private evidence must belong to the contributing role.');
    }
    if (target.metadata?.operationId !== root.id) {
      fail('bad_operation_effect', 'Operation evidence must be scoped to its graph root.');
    }
  }
  if (adapter === 'item_escrow' && target.type !== 'item_template') {
    fail('bad_operation_effect', 'Operation escrow requires a unique item template.');
  }
  if (adapter === 'unique_item_award') {
    if (target.type !== 'item_template' || !roleIds.has(effect.recipientRoleId)) {
      fail('bad_operation_effect', 'Unique operation awards require a declared recipient role.');
    }
  }
  if (adapter === 'status_award') {
    if (target.type !== 'reward' || target.metadata?.inert !== true
      || target.metadata?.rewardType !== 'status'
      || target.metadata?.operationId !== root.id) {
      fail('unsafe_operation_reward', 'Operation status rewards must be explicitly inert.');
    }
  }
}

function validateOperationDefinitions(registry) {
  const operationRoots = [...registry.nodes.values()].filter((node) => (
    node.type === 'social_gate' && rolesOf(node).length > 0
  ));
  const rootById = new Map(operationRoots.map((root) => [root.id, root]));
  for (const root of operationRoots) {
    if (root.visibility === 'role_private') {
      fail('bad_operation_definition', 'An operation root cannot be role-private.');
    }
    if (root.effect !== undefined || root.action !== undefined || root.actions !== undefined
      || (root.effects !== undefined && !Array.isArray(root.effects))) {
      fail('bad_operation_effect', `Operation ${root.id} must use an effects data array only.`);
    }
    const roles = rolesOf(root);
    const roleIds = new Set(roles.map((role) => role.id));
    if (roleIds.size !== roles.length || roles.length < 2 || roles.length > 8
      || roles.some((role) => role.distinct !== true)
      || Number(root.minimumDistinctAccounts ?? root.metadata?.minimumDistinctAccounts)
        !== roles.length) {
      fail('bad_operation_definition',
        `Operation ${root.id} must declare an all-distinct Phase 1 role set.`);
    }
    if (root.metadata?.phase1Proof === true
      && (roles.length !== PROOF_ROLES.length
        || PROOF_ROLES.some((id) => !roleIds.has(id)))) {
      fail('bad_operation_definition',
        `Phase 1 proof operation ${root.id} requires the canonical four roles.`);
    }
    const closerRoleId = root.metadata?.closerRoleId;
    if (!roleIds.has(closerRoleId)) {
      fail('bad_operation_definition',
        `Operation ${root.id} requires one declared closer role.`);
    }
    validateMysteryBridge(registry, root);
    for (const role of roles) {
      for (const condition of role.conditions || []) assertCondition(condition, `Role ${role.id}`);
    }
    const steps = [...registry.nodes.values()].filter((node) => (
      node.packageId === root.packageId && node.type === 'operation_step'
      && node.metadata?.operationId === root.id
    ));
    const stepIds = new Set(steps.map((step) => step.id));
    const required = completionRequires(root);
    if (!Array.isArray(required) || required.length < roles.length
      || new Set(required).size !== required.length
      || required.some((id) => !stepIds.has(id))) {
      fail('bad_operation_definition',
        `Operation ${root.id} requires an explicit convergent contribution set.`);
    }
    const coveredRoles = new Set(required.map((id) => nodeOf(registry, id).metadata?.roleId));
    if ([...roleIds].some((id) => !coveredRoles.has(id))) {
      fail('bad_operation_definition', `Operation ${root.id} does not converge every role.`);
    }
    const orders = new Set();
    for (const step of steps) {
      const roleId = step.metadata?.roleId;
      if (!roleIds.has(roleId)) {
        fail('bad_operation_definition', `Operation step ${step.id} has no declared role.`);
      }
      assertRolePrivate(step, roleIds, root.id);
      for (const requiredId of [
        ...(step.requires || []), ...(step.requiresAny || []).flat(), ...(step.excludes || []),
      ]) assertOperationReference(registry, root, requiredId, `Operation step ${step.id}`);
      const order = step.metadata?.order;
      if (order !== undefined && (!Number.isInteger(order) || order < 1 || orders.has(order))) {
        fail('bad_operation_definition', `Operation step ${step.id} has an invalid order.`);
      }
      if (order !== undefined) orders.add(order);
      for (const condition of step.conditions || []) assertCondition(condition, `Step ${step.id}`);
      if (step.effect !== undefined || step.action !== undefined || step.actions !== undefined) {
        fail('bad_operation_effect', `Operation step ${step.id} must use effects data only.`);
      }
      if (step.effects !== undefined && !Array.isArray(step.effects)) {
        fail('bad_operation_effect', `Operation step ${step.id} effects must be an array.`);
      }
      for (const effect of step.effects || []) {
        assertEffect(registry, root, step, effect, CONTRIBUTION_EFFECTS, roleIds);
      }
    }
    for (const effect of root.effects || []) {
      assertEffect(registry, root, root, effect, COMPLETION_EFFECTS, roleIds);
    }
  }
  // A role-private graph-state node in a package that defines social operations must belong to one
  // explicit operation root. This prevents orphan or cross-vocabulary private content while still
  // allowing several unrelated operations in one immutable package.
  for (const node of registry.nodes.values()) {
    if (node.metadata?.privateEvidence !== undefined
      && (node.type !== 'evidence' || node.visibility !== 'role_private'
        || typeof node.metadata.privateEvidence !== 'string'
        || node.metadata.privateEvidence.trim() !== node.metadata.privateEvidence
        || node.metadata.privateEvidence.length < 1
        || node.metadata.privateEvidence.length > 1000)) {
      fail('bad_operation_definition',
        `Private evidence ${node.id} must be canonical role-private evidence text.`);
    }
    if (node.visibility !== 'role_private' || !GRAPH_STATE_TYPES.has(node.type)) continue;
    const packageHasOperation = operationRoots.some((root) => root.packageId === node.packageId);
    if (!packageHasOperation) continue;
    const root = rootById.get(node.metadata?.operationId);
    if (!root || root.packageId !== node.packageId) {
      fail('bad_operation_definition',
        `Role-private node ${node.id} must declare its owning operation.`);
    }
    assertRolePrivate(node, new Set(rolesOf(root).map((role) => role.id)), root.id);
  }
}

/** Create opaque request authority from an authentic immutable world-graph registry. */
export function createOperationContext({ registry, accountId: rawAccountId, now = Date.now() } = {}) {
  if (!isWorldGraphRegistry(registry)) {
    fail('bad_operation_context', 'Operation context requires an authentic world-graph registry.');
  }
  validateGraph(registry);
  validateOperationDefinitions(registry);
  const accountId = canonical(rawAccountId, 'Authenticated account id', 'bad_operation_context');
  const nowMs = typeof now === 'number' ? now : Date.parse(now);
  if (!Number.isFinite(nowMs)) fail('bad_operation_context', 'Operation time is invalid.');
  const context = Object.freeze({ registry, accountId, now: new Date(nowMs).toISOString() });
  CONTEXTS.add(context);
  return context;
}

function contextOf(value) {
  if (!value || typeof value !== 'object' || !CONTEXTS.has(value)) {
    fail('bad_operation_context', 'Use createOperationContext for operation authority.');
  }
  return value;
}

function packageOf(context, graphIdValue, version = null) {
  const graphId = canonical(graphIdValue, 'Operation graph id');
  const pkg = context.registry.byPackage.get(graphId);
  if (!pkg) fail('operation_graph', 'No such operation graph package.');
  if (version !== null && Number(version) !== Number(pkg.version)) {
    fail('graph_version', 'That operation graph version is not loaded.');
  }
  return pkg;
}

function rootOf(context, graphIdValue, nodeIdValue, version = null) {
  const pkg = packageOf(context, graphIdValue, version);
  const nodeId = canonical(nodeIdValue, 'Operation node id');
  const root = nodeOf(context.registry, nodeId);
  if (!root || root.packageId !== pkg.id || root.type !== 'social_gate' || rolesOf(root).length === 0) {
    fail('operation_graph', 'No such social operation in that graph package.');
  }
  return { pkg, root };
}

function graphIdentity(pkg, root) {
  return { id: pkg.id, version: Number(pkg.version), operationNodeId: root.id };
}

function operationProjection(row) {
  return {
    operationId: row.id,
    graph: {
      id: row.graph_id,
      version: Number(row.graph_version),
      operationNodeId: row.operation_node_id,
    },
    status: row.status,
    closeReason: row.close_reason || null,
    createdAt: dateString(row.created_at),
    activatedAt: dateString(row.activated_at),
    completedAt: dateString(row.completed_at),
    canceledAt: dateString(row.canceled_at),
    abandonedAt: dateString(row.abandoned_at),
  };
}

function mutationOptions(value, { interaction = false } = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || Object.keys(value).some((key) => !['idempotencyKey', 'interactionId'].includes(key))) {
    fail('bad_operation_request', 'Operation action options are malformed.');
  }
  return {
    idempotencyKey: canonical(value.idempotencyKey, 'Idempotency key', 'bad_idempotency_key'),
    interactionId: interaction && value.interactionId !== undefined
      ? canonical(value.interactionId, 'Interaction id') : null,
  };
}

async function actorProjection(client, row, crewId) {
  const skills = (await client.query(
    'SELECT skill_id FROM character_skills WHERE character_id=$1', [row.id],
  )).rows.map(({ skill_id: id }) => id);
  return {
    id: row.id,
    accountId: row.account_id,
    location: row.loc,
    level: levelOf(Number(row.respect || 0)),
    skills: new Set(skills),
    crewId,
  };
}

// Opening has no operation row to serialize on yet. Resolve a snapshot Crew id without authority
// and lock that Crew first, matching the Crew lifecycle wrapper.
async function lockOpenCrew(client, context) {
  const snapshotMembership = (await client.query(
    'SELECT crew_id FROM crew_members WHERE account_id=$1', [context.accountId],
  )).rows[0];
  if (!snapshotMembership) fail('no_crew', 'A Crew membership is required for this operation.');
  const crew = dbCaps.skipLocked ? (await client.query(
    'SELECT id FROM crews WHERE id=$1 FOR NO KEY UPDATE', [snapshotMembership.crew_id],
  )).rows[0] : (await client.query(
    'SELECT id FROM crews WHERE id=$1 FOR UPDATE', [snapshotMembership.crew_id],
  )).rows[0];
  if (!crew) fail('no_crew', 'The current Crew no longer exists.');
  return crew;
}

// Once Crew and any pre-existing operation row are locked, lock the exact character snapshot and
// then its membership. Existing-operation mutations use the same character -> membership suffix.
async function lockOpenActor(client, context, crewId) {
  const snapshotCharacter = (await client.query(
    `SELECT id FROM characters
      WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`,
    [context.accountId],
  )).rows[0];
  if (!snapshotCharacter) {
    fail('no_character', 'A living character is required for this operation action.');
  }
  const row = (await client.query(
    `SELECT id,account_id,loc,respect,alive FROM characters
      WHERE id=$1 FOR UPDATE`, [snapshotCharacter.id],
  )).rows[0];
  if (!row || row.account_id !== context.accountId || row.alive !== true) {
    fail('no_character', 'A living character is required for this operation action.');
  }
  const membership = (await client.query(
    'SELECT account_id,crew_id FROM crew_members WHERE account_id=$1 FOR UPDATE',
    [context.accountId],
  )).rows[0];
  if (!membership || membership.crew_id !== crewId) {
    fail('no_crew', 'The Crew membership changed before this operation opened.');
  }
  return actorProjection(client, row, crewId);
}

async function mysteryBridgeState(client, context, actor, root) {
  const gate = root.metadata?.mysteryGate;
  if (!gate) return new Map();
  const ownerId = gate.ownerScope === 'account' ? context.accountId : actor.id;
  const instance = (await client.query(
    `SELECT id,graph_version,status FROM mystery_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND authority_account_id=$3 AND graph_id=$4
      FOR UPDATE`,
    [gate.ownerScope, ownerId, context.accountId, gate.graphId],
  )).rows[0];
  // The owner tuple is deterministic: durable account for an account bridge, or the currently
  // locked living street for a character bridge. A version mismatch never falls through to a
  // different historical instance and all missing/status failures share one non-enumerating code.
  if (!instance || Number(instance.graph_version) !== gate.graphVersion
    || instance.status !== gate.requiredStatus) {
    fail('operation_locked', 'The authenticated mystery path has not unlocked this operation.');
  }
  const rows = (await client.query(
    `SELECT node_id,state,completed_at,failed_at AS excluded_at
       FROM mystery_node_state WHERE instance_id=$1`, [instance.id],
  )).rows;
  return stateMap(rows);
}

function assertRootGraphGate(root, states) {
  if ((root.excludes || []).some((id) => states.get(id)?.state === 'completed')) {
    fail('operation_excluded', 'The authenticated mystery path closed this operation.');
  }
  if ((root.requires || []).some((id) => states.get(id)?.state !== 'completed')
    || (root.requiresAny || []).some((group) => (
      !group.some((id) => states.get(id)?.state === 'completed')
    ))) {
    fail('operation_locked', 'The authenticated mystery path has not unlocked this operation.');
  }
}

async function operationRow(client, operationIdValue, { lock = false } = {}) {
  const id = canonical(operationIdValue, 'Operation id');
  if (lock) return (await client.query(
    `SELECT id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
            close_reason,created_at,updated_at,activated_at,completed_at,canceled_at,abandoned_at
       FROM world_operations WHERE id=$1 FOR UPDATE`,
    [id],
  )).rows[0] || null;
  return (await client.query(
    `SELECT id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
            close_reason,created_at,updated_at,activated_at,completed_at,canceled_at,abandoned_at
       FROM world_operations WHERE id=$1`,
    [id],
  )).rows[0] || null;
}

function pinnedDefinition(context, row) {
  const pkg = packageOf(context, row.graph_id);
  if (Number(pkg.version) !== Number(row.graph_version)) {
    fail('stale_graph_version', 'The operation is pinned to another graph version.');
  }
  const root = nodeOf(context.registry, row.operation_node_id);
  if (!root || root.packageId !== pkg.id || root.type !== 'social_gate') {
    fail('operation_graph', 'The pinned operation definition is unavailable.');
  }
  return { pkg, root };
}

async function callerAssignment(client, operationId, accountId) {
  return (await client.query(
    `SELECT role_id,character_id FROM world_operation_roles
      WHERE operation_id=$1 AND account_id=$2`, [operationId, accountId],
  )).rows[0] || null;
}

async function authorizeOperation(client, context, operationId, {
  requireAssignment = false, requireCrew = true, lock = false,
} = {}) {
  const row = await operationRow(client, operationId, { lock });
  if (!row) fail('operation_not_found', 'No such social operation.');
  const assignment = await callerAssignment(client, row.id, context.accountId);
  const isOpener = row.opened_by_account_id === context.accountId;
  let currentCrew = null;
  if (requireCrew || (!assignment && !isOpener)) {
    currentCrew = (await client.query(
      'SELECT crew_id FROM crew_members WHERE account_id=$1', [context.accountId],
    )).rows[0]?.crew_id || null;
  }
  if ((requireAssignment && !assignment)
    || (requireCrew && currentCrew !== row.crew_id)
    || (!requireCrew && !assignment && !isOpener && currentCrew !== row.crew_id)) {
    fail('operation_forbidden', 'This account cannot access that operation.');
  }
  return { row, assignment, ...pinnedDefinition(context, row) };
}

async function roleRows(client, operationId) {
  return (await client.query(
    `SELECT role_id,account_id,character_id,assigned_at FROM world_operation_roles
      WHERE operation_id=$1 ORDER BY assigned_at,role_id`, [operationId],
  )).rows;
}

async function stateRows(client, operationId) {
  return (await client.query(
    `SELECT node_id,state,completed_at,excluded_at FROM world_operation_node_state
      WHERE operation_id=$1`, [operationId],
  )).rows;
}

const stateMap = (rows) => new Map(rows.map((row) => [row.node_id, row]));

async function insertNodeState(client, operationId, nodeId, state) {
  const existing = (await client.query(
    'SELECT state,completed_at,excluded_at FROM world_operation_node_state WHERE operation_id=$1 AND node_id=$2',
    [operationId, nodeId],
  )).rows[0];
  if (existing) {
    if (existing.state === state) return existing;
    fail('operation_branch_closed', 'That operation branch has already resolved.');
  }
  registerItemTransactionUndo(client, () => client.query(
    'DELETE FROM world_operation_node_state WHERE operation_id=$1 AND node_id=$2',
    [operationId, nodeId],
  ));
  return (await client.query(
    `INSERT INTO world_operation_node_state
       (operation_id,node_id,state,completed_at,excluded_at)
     VALUES ($1,$2,$3,$4,$5)
     RETURNING node_id,state,completed_at,excluded_at`,
    [operationId, nodeId, state, state === 'completed' ? new Date() : null,
      state === 'excluded' ? new Date() : null],
  )).rows[0];
}

async function setStatus(client, row, status, closeReason = null) {
  const prior = { ...row };
  registerItemTransactionUndo(client, () => client.query(
    `UPDATE world_operations SET status=$2,close_reason=$3,updated_at=$4,activated_at=$5,
       completed_at=$6,canceled_at=$7,abandoned_at=$8 WHERE id=$1`,
    [prior.id, prior.status, prior.close_reason, prior.updated_at, prior.activated_at,
      prior.completed_at, prior.canceled_at, prior.abandoned_at],
  ));
  const values = {
    activated: status === 'active' ? new Date() : row.activated_at,
    completed: status === 'completed' ? new Date() : null,
    canceled: status === 'canceled' ? new Date() : null,
    abandoned: status === 'abandoned' ? new Date() : null,
  };
  const changed = await client.query(
    `UPDATE world_operations
        SET status=$2,close_reason=$3,updated_at=now(),activated_at=$4,
            completed_at=$5,canceled_at=$6,abandoned_at=$7
      WHERE id=$1 AND status=$8
      RETURNING id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
                close_reason,created_at,updated_at,activated_at,completed_at,canceled_at,abandoned_at`,
    [row.id, status, closeReason, values.activated, values.completed, values.canceled,
      values.abandoned, row.status],
  );
  if (changed.rowCount !== 1) fail('contention', 'The operation state changed; retry.');
  return changed.rows[0];
}

async function destinationsFor(client, operationId) {
  const rows = (await client.query(
    `SELECT depositor_scope AS scope,depositor_id AS id FROM operation_escrow
      WHERE operation_id=$1
     UNION
     SELECT 'account' AS scope,account_id AS id FROM world_operation_roles
      WHERE operation_id=$1`, [operationId],
  )).rows;
  // This server-derived authority is deliberately separate from the logical replay digest. Its
  // canonical ordering still keeps execution deterministic as roles and escrow are resolved.
  return [...new Map(rows.map(({ scope, id }) => [`${scope}:${id}`, { scope, id }])).values()]
    .sort((left, right) => `${left.scope}:${left.id}`.localeCompare(`${right.scope}:${right.id}`));
}

async function releaseAllEscrow(client, operationId, mutation) {
  const custody = (await client.query(
    `SELECT item_id,depositor_scope,depositor_id FROM operation_escrow
      WHERE operation_id=$1 ORDER BY item_id`, [operationId],
  )).rows;
  for (const row of custody) {
    await releaseEscrow(
      client, operationId, { scope: row.depositor_scope, id: row.depositor_id }, row.item_id,
      'social operation release', mutation,
    );
  }
  return custody.length;
}

async function lockOperationAuthorityRows(
  client, operation, { candidateAccountId = null } = {},
) {
  // The operation row is already locked by authorizeOperation, so the assignment set is stable.
  // PostgreSQL rejects FOR UPDATE on the nullable side of an outer join; lock the two authority
  // tables independently, in globally deterministic character/account order, then compare the
  // complete pinned sets in memory.
  const assignments = await roleRows(client, operation.id);
  const candidateCharacter = candidateAccountId ? (await client.query(
    `SELECT id FROM characters
      WHERE account_id=$1 AND alive ORDER BY created_at DESC,id LIMIT 1`,
    [candidateAccountId],
  )).rows[0] : null;
  const characterIds = [...new Set([
    ...assignments.map(({ character_id: id }) => id),
    ...(candidateCharacter ? [candidateCharacter.id] : []),
  ])].sort();
  const characters = [];
  // At most the four declared roles plus one candidate. Lock them one at a time in the already
  // sorted global order: static SQL remains preparable, pg-mem avoids indexed ANY(array), and the
  // lock-order proof stays visible instead of hiding behind generated placeholder text.
  for (const characterId of characterIds) {
    const row = (await client.query(
      `SELECT id,account_id,loc,respect,alive FROM characters
        WHERE id=$1 FOR UPDATE`, [characterId],
    )).rows[0];
    if (row) characters.push(row);
  }
  const accountIds = [...new Set([
    ...assignments.map(({ account_id: id }) => id),
    ...(candidateAccountId ? [candidateAccountId] : []),
  ])].sort();
  const memberships = [];
  for (const accountId of accountIds) {
    const row = (await client.query(
      `SELECT account_id,crew_id FROM crew_members
        WHERE account_id=$1 FOR UPDATE`, [accountId],
    )).rows[0];
    if (row) memberships.push(row);
  }
  const characterById = new Map(characters.map((row) => [row.id, row]));
  const membershipByAccount = new Map(memberships.map((row) => [row.account_id, row]));
  const dead = assignments.some((assignment) => {
    const character = characterById.get(assignment.character_id);
    return !character || character.account_id !== assignment.account_id || character.alive !== true;
  });
  const moved = assignments.some((assignment) => (
    membershipByAccount.get(assignment.account_id)?.crew_id !== operation.crew_id
  ));
  return {
    assignments,
    characterById,
    membershipByAccount,
    candidateCharacterId: candidateCharacter?.id || null,
    invalidReason: dead ? 'participant_dead' : moved ? 'crew_changed' : null,
  };
}

async function candidateActor(client, operation, accountId, authority) {
  const character = authority.characterById.get(authority.candidateCharacterId);
  if (!character || character.account_id !== accountId || character.alive !== true) {
    fail('no_character', 'A living character is required for this operation action.');
  }
  const membership = authority.membershipByAccount.get(accountId);
  if (!membership) fail('no_crew', 'A Crew membership is required for this operation.');
  if (membership.crew_id !== operation.crew_id) {
    fail('operation_forbidden', 'This account is not in that Crew.');
  }
  return actorProjection(client, character, membership.crew_id);
}

async function abandonIfInvalid(client, operation, mutation, authority) {
  if (!['forming', 'active'].includes(operation.status)) return null;
  const reason = authority.invalidReason;
  if (!reason) return null;
  const releasedEscrowCount = await releaseAllEscrow(client, operation.id, mutation);
  const abandoned = await setStatus(client, operation, 'abandoned', reason);
  return { ok: true, ...operationProjection(abandoned), releasedEscrowCount };
}

function conditionValue(condition, fields) {
  for (const field of fields) if (condition?.[field] !== undefined) return condition[field];
  return undefined;
}

async function conditionBlocker(client, actor, operation, states, condition, interactionId) {
  const adapter = condition.adapter || condition.type || condition.kind;
  if (adapter === 'graph_dependency') {
    const id = conditionValue(condition, ['nodeId', 'id', 'value']);
    return states.get(id)?.state === 'completed' ? null : { adapter };
  }
  if (adapter === 'location') {
    const required = conditionValue(condition, ['value', 'locationId', 'district']);
    return actor.location === required ? null : { adapter, required };
  }
  if (adapter === 'level') {
    const required = Number(conditionValue(condition, ['minimumLevel', 'level', 'value']));
    return actor.level >= required ? null : { adapter, required, current: actor.level };
  }
  if (adapter === 'skill') {
    const required = conditionValue(condition, ['skillId', 'id', 'value']);
    return actor.skills.has(required) ? null : { adapter, required };
  }
  if (adapter === 'item_ownership' || adapter === 'owns_item') {
    const templateId = conditionValue(condition, ['templateId', 'itemId', 'value']);
    const row = (await client.query(
      `SELECT 1 FROM item_instances WHERE owner_scope='account' AND owner_id=$1
        AND template_id=$2 AND state='active' LIMIT 1 FOR UPDATE`,
      [actor.accountId, templateId],
    )).rows[0];
    return row ? null : { adapter };
  }
  if (adapter === 'material_quantity') {
    const templateId = conditionValue(condition, ['templateId', 'materialId', 'value']);
    const qty = Number(conditionValue(condition, ['quantity', 'qty', 'minimum']) || 1);
    const row = (await client.query(
      `SELECT quantity FROM item_stacks WHERE owner_scope='account' AND owner_id=$1
        AND template_id=$2 AND quality=$3 FOR UPDATE`,
      [actor.accountId, templateId, condition.quality || 'standard'],
    )).rows[0];
    return Number(row?.quantity || 0) >= qty ? null : { adapter, required: qty };
  }
  if (adapter === 'evidence') {
    const id = conditionValue(condition, ['evidenceId', 'nodeId', 'id', 'value']);
    return states.get(id)?.state === 'completed' ? null : { adapter };
  }
  const required = conditionValue(condition, ['interactionId', 'id', 'value']);
  return interactionId === required ? null : { adapter };
}

function throwBlocker(blocker) {
  if (blocker.adapter === 'location') fail('location', 'This role action requires another district.');
  if (blocker.adapter === 'level') fail('level', 'This role action requires more progression.');
  if (blocker.adapter === 'skill') fail('skill', 'This role action requires another skill.');
  if (blocker.adapter === 'item_ownership' || blocker.adapter === 'owns_item') {
    fail('item_unavailable', 'This role lacks its required item.');
  }
  if (blocker.adapter === 'material_quantity') fail('materials', 'This role lacks required materials.');
  if (blocker.adapter === 'explicit_interaction') fail('interaction', 'The required interaction is missing.');
  fail('operation_prerequisite', 'A required operation branch is incomplete.');
}

async function assertConditions(client, actor, operation, states, conditions, interactionId) {
  for (const condition of conditions || []) {
    const blocker = await conditionBlocker(
      client, actor, operation, states, condition, interactionId,
    );
    if (blocker) throwBlocker(blocker);
  }
}

async function selectOwnedItem(client, accountId, templateId) {
  const row = (await client.query(
    `SELECT id FROM item_instances WHERE owner_scope='account' AND owner_id=$1
      AND template_id=$2 AND state='active' ORDER BY created_at,id LIMIT 1 FOR UPDATE`,
    [accountId, templateId],
  )).rows[0];
  if (!row) fail('item_unavailable', 'This role lacks its required item.');
  return row.id;
}

function safeItem(item) {
  return { id: item.id, templateId: item.templateId, state: item.state };
}

async function applyContributionEffects(client, context, operation, step, actor, mutation) {
  const effects = [];
  for (const effect of step.effects || []) {
    if (effect.adapter === 'evidence_grant') {
      const state = await insertNodeState(client, operation.id, effect.nodeId, 'completed');
      const target = nodeOf(context.registry, effect.nodeId);
      // A private node id is itself discovery information. The assigned role reads both identity
      // and clue text from roleBoard after the state commits; mutation results (including exact
      // replays) intentionally carry neither.
      effects.push(target?.visibility === 'role_private'
        ? { kind: 'evidence', completedAt: dateString(state.completed_at) }
        : { kind: 'evidence', nodeId: effect.nodeId, completedAt: dateString(state.completed_at) });
    } else if (effect.adapter === 'item_escrow') {
      const itemId = await selectOwnedItem(client, actor.accountId, effect.templateId);
      const item = await escrowItem(
        client, { scope: 'account', id: actor.accountId }, operation.id, itemId,
        `operation ${operation.operation_node_id} contribution`, mutation, 'used_in_operation',
      );
      effects.push({ kind: 'item_escrow', item: safeItem(item) });
    } else {
      fail('unsupported_operation_effect', 'The operation effect is not executable.');
    }
  }
  return effects;
}

async function closeExcluded(client, context, operation, initialIds) {
  const closed = new Set(initialIds);
  const nodes = [...context.registry.nodes.values()].filter((node) => (
    node.packageId === operation.graph_id && ['operation_step', 'evidence'].includes(node.type)
    && node.metadata?.operationId === operation.operation_node_id
  ));
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of nodes) {
      if (closed.has(node.id)) continue;
      if ((node.requires || []).some((id) => closed.has(id))
        || (node.requiresAny || []).some((group) => group.every((id) => closed.has(id)))) {
        closed.add(node.id);
        changed = true;
      }
    }
  }
  const states = stateMap(await stateRows(client, operation.id));
  if ([...closed].some((id) => states.get(id)?.state === 'completed')) {
    fail('operation_choice_conflict', 'That branch conflicts with completed operation work.');
  }
  for (const id of closed) await insertNodeState(client, operation.id, id, 'excluded');
}

/** Open one graph-pinned operation for the authenticated account's current Crew. */
export async function openOperation(
  client, contextValue, graphIdValue, operationNodeIdValue, version, idempotencyKeyValue,
) {
  const context = contextOf(contextValue);
  const { pkg, root } = rootOf(context, graphIdValue, operationNodeIdValue, version);
  const key = canonical(idempotencyKeyValue, 'Idempotency key', 'bad_idempotency_key');
  const owner = { scope: 'account', id: context.accountId };
  return withItemMutation(
    client, owner, 'operation_action', key,
    { action: 'open', graph: graphIdentity(pkg, root) },
    async () => {
      const crew = await lockOpenCrew(client, context);
      const existing = (await client.query(
        `SELECT id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
                close_reason,created_at,updated_at,activated_at,completed_at,canceled_at,abandoned_at
           FROM world_operations
          WHERE crew_id=$1 AND graph_id=$2 AND graph_version=$3 AND operation_node_id=$4 FOR UPDATE`,
        [crew.id, pkg.id, Number(pkg.version), root.id],
      )).rows[0];
      const actor = await lockOpenActor(client, context, crew.id);
      if (existing) return { ok: true, ...operationProjection(existing) };
      const bridgeStates = await mysteryBridgeState(client, context, actor, root);
      assertRootGraphGate(root, bridgeStates);
      await assertConditions(client, actor, null, bridgeStates, root.conditions, null);
      const id = crypto.randomUUID();
      registerItemTransactionUndo(client, () => client.query(
        'DELETE FROM world_operations WHERE id=$1', [id],
      ));
      const row = (await client.query(
        `INSERT INTO world_operations
           (id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id)
         VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,
                   close_reason,created_at,updated_at,activated_at,completed_at,canceled_at,abandoned_at`,
        [id, pkg.id, Number(pkg.version), root.id, actor.crewId, context.accountId],
      )).rows[0];
      return { ok: true, ...operationProjection(row) };
    },
  );
}

/** Claim one role for the authenticated account. Client input never contains an account/character/Crew. */
export async function assignRole(
  client, contextValue, operationIdValue, roleIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const operationId = canonical(operationIdValue, 'Operation id');
  const roleId = canonical(roleIdValue, 'Role id', 'bad_operation_request', 80);
  const options = mutationOptions(optionsValue);
  const destinations = await destinationsFor(client, operationId);
  return withItemMutation(
    client, { scope: 'account', id: context.accountId }, 'operation_action', options.idempotencyKey,
    {
      action: 'assign_role', operationId, roleId,
      itemAuthority: { operations: [operationId], destinations },
    },
    async (mutation) => {
      const authority = await authorizeOperation(client, context, operationId, { lock: true });
      const { row, root } = authority;
      const participantAuthority = await lockOperationAuthorityRows(
        client, row, { candidateAccountId: context.accountId },
      );
      const abandoned = await abandonIfInvalid(client, row, mutation, participantAuthority);
      if (abandoned) return abandoned;
      const role = rolesOf(root).find((candidate) => candidate.id === roleId);
      if (!role) fail('operation_role', 'No such role exists in this operation.');
      const existingRoles = participantAuthority.assignments;
      const existing = existingRoles.find((candidate) => candidate.role_id === roleId);
      if (existing) {
        if (existing.account_id !== context.accountId) fail('operation_role_taken', 'That role is filled.');
        return {
          ok: true, operationId: row.id, status: row.status,
          assignment: { roleId, assignedAt: dateString(existing.assigned_at) },
        };
      }
      if (!['forming', 'active'].includes(row.status)) fail('operation_closed', 'That operation is closed.');
      if (existingRoles.some((candidate) => candidate.account_id === context.accountId)) {
        fail('operation_distinct_account', 'One account cannot occupy two operation roles.');
      }
      const actor = await candidateActor(client, row, context.accountId, participantAuthority);
      await assertConditions(client, actor, row, stateMap(await stateRows(client, row.id)), role.conditions, null);
      registerItemTransactionUndo(client, () => client.query(
        'DELETE FROM world_operation_roles WHERE operation_id=$1 AND role_id=$2', [row.id, roleId],
      ));
      const assignment = (await client.query(
        `INSERT INTO world_operation_roles (operation_id,role_id,account_id,character_id)
         VALUES ($1,$2,$3,$4) RETURNING role_id,assigned_at`,
        [row.id, roleId, context.accountId, actor.id],
      )).rows[0];
      let status = row.status;
      if (existingRoles.length + 1 === rolesOf(root).length && row.status === 'forming') {
        await insertNodeState(client, row.id, root.id, 'completed');
        status = (await setStatus(client, row, 'active')).status;
      }
      return {
        ok: true, operationId: row.id, status,
        assignment: { roleId, assignedAt: dateString(assignment.assigned_at) },
      };
    },
  );
}

function stepOf(context, authority, nodeIdValue, callerRoleId) {
  const nodeId = canonical(nodeIdValue, 'Contribution node id');
  const step = nodeOf(context.registry, nodeId);
  if (!step || step.packageId !== authority.row.graph_id || step.type !== 'operation_step'
    || step.metadata?.operationId !== authority.root.id || step.visibility === 'hidden'
    || (step.visibility === 'role_private' && step.metadata?.roleId !== callerRoleId)) {
    // One response for absent IDs, hidden IDs, other operations, and another role's private IDs.
    // This function runs only after caller assignment is authenticated, so it cannot be used as an
    // existence oracle for private content by either an outsider or a different role.
    fail('operation_step_unavailable', 'That operation contribution is unavailable.');
  }
  return step;
}

/** Complete one role-owned, data-defined contribution. */
export async function contribute(
  client, contextValue, operationIdValue, nodeIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const operationId = canonical(operationIdValue, 'Operation id');
  const nodeId = canonical(nodeIdValue, 'Contribution node id');
  const options = mutationOptions(optionsValue, { interaction: true });
  const destinations = await destinationsFor(client, operationId);
  return withItemMutation(
    client, { scope: 'account', id: context.accountId }, 'operation_action', options.idempotencyKey,
    {
      action: 'contribute', operationId, nodeId, interactionId: options.interactionId,
      itemAuthority: { operations: [operationId], destinations },
    },
    async (mutation) => {
      const authority = await authorizeOperation(client, context, operationId, {
        requireAssignment: true, lock: true,
      });
      const { row, assignment, root } = authority;
      if (row.status !== 'active') fail('operation_not_active', 'Fill every role before contributing.');
      const participantAuthority = await lockOperationAuthorityRows(
        client, row, { candidateAccountId: context.accountId },
      );
      const abandoned = await abandonIfInvalid(client, row, mutation, participantAuthority);
      if (abandoned) return abandoned;
      const step = stepOf(context, authority, nodeId, assignment.role_id);
      if (step.metadata?.roleId !== assignment.role_id) {
        fail('operation_role_forbidden', 'Only the assigned role may make that contribution.');
      }
      const existing = (await client.query(
        `SELECT role_id,contributed_at FROM world_operation_contributions
          WHERE operation_id=$1 AND node_id=$2`, [row.id, step.id],
      )).rows[0];
      if (existing) {
        return {
          ok: true, operationId: row.id, status: row.status,
          contribution: {
            nodeId: step.id, roleId: existing.role_id,
            completedAt: dateString(existing.contributed_at),
          }, effects: [],
        };
      }
      const states = stateMap(await stateRows(client, row.id));
      if (states.get(step.id)?.state === 'excluded') fail('operation_branch_closed', 'That branch is closed.');
      if ((step.requires || []).some((id) => states.get(id)?.state !== 'completed')
        || (step.requiresAny || []).some((group) => (
          !group.some((id) => states.get(id)?.state === 'completed')
        )) || (step.excludes || []).some((id) => states.get(id)?.state === 'completed')) {
        fail('operation_prerequisite', 'A required operation branch is incomplete.');
      }
      const order = step.metadata?.order;
      if (order !== undefined) {
        const prior = [...context.registry.nodes.values()].filter((node) => (
          node.packageId === row.graph_id && node.type === 'operation_step'
          && node.metadata?.operationId === root.id
          && Number.isInteger(node.metadata?.order) && node.metadata.order < order
        ));
        if (prior.some((node) => states.get(node.id)?.state !== 'completed')) {
          fail('operation_order', 'An earlier operation contribution must be completed first.');
        }
      }
      const actor = await candidateActor(client, row, context.accountId, participantAuthority);
      if (actor.id !== assignment.character_id || actor.crewId !== row.crew_id) {
        fail('operation_participant_changed', 'The assigned participant is no longer available.');
      }
      await assertConditions(client, actor, row, states, step.conditions, options.interactionId);
      const effects = await applyContributionEffects(
        client, context, row, step, actor, mutation,
      );
      const completed = await insertNodeState(client, row.id, step.id, 'completed');
      await closeExcluded(client, context, row, step.excludes || []);
      registerItemTransactionUndo(client, () => client.query(
        'DELETE FROM world_operation_contributions WHERE operation_id=$1 AND node_id=$2',
        [row.id, step.id],
      ));
      const contribution = (await client.query(
        `INSERT INTO world_operation_contributions
           (operation_id,node_id,role_id,account_id,character_id)
         VALUES ($1,$2,$3,$4,$5) RETURNING role_id,contributed_at`,
        [row.id, step.id, assignment.role_id, context.accountId, actor.id],
      )).rows[0];
      return {
        ok: true, operationId: row.id, status: row.status,
        contribution: {
          nodeId: step.id, roleId: contribution.role_id,
          completedAt: dateString(completed.completed_at),
        }, effects,
      };
    },
  );
}

async function applyCompletionEffects(client, root, assignments, mutation) {
  const effects = [];
  const byRole = new Map(assignments.map((assignment) => [assignment.role_id, assignment]));
  for (const effect of root.effects || []) {
    if (effect.adapter === 'unique_item_award') {
      const recipient = byRole.get(effect.recipientRoleId);
      if (!recipient) fail('operation_incomplete', 'Every reward role must be assigned.');
      await createItem(
        client, { scope: 'account', id: recipient.account_id }, effect.templateId, 'awarded', mutation,
      );
      effects.push({
        kind: 'unique_item_award', recipientRoleId: effect.recipientRoleId,
      });
    } else if (effect.adapter === 'status_award') {
      effects.push({ kind: 'status_award' });
    } else {
      fail('unsupported_operation_effect', 'The operation completion effect is not executable.');
    }
  }
  return effects;
}

/** Atomically converge every declared branch, apply non-currency rewards, and return all escrow. */
export async function completeOperation(client, contextValue, operationIdValue, optionsValue) {
  const context = contextOf(contextValue);
  const operationId = canonical(operationIdValue, 'Operation id');
  const options = mutationOptions(optionsValue);
  const destinations = await destinationsFor(client, operationId);
  return withItemMutation(
    client, { scope: 'account', id: context.accountId }, 'operation_action', options.idempotencyKey,
    {
      action: 'complete', operationId,
      itemAuthority: { operations: [operationId], destinations },
    },
    async (mutation) => {
      const authority = await authorizeOperation(client, context, operationId, {
        requireAssignment: true, lock: true,
      });
      const { row, root } = authority;
      if (row.status === 'completed') {
        return {
          ok: true, ...operationProjection(row), effects: [], releasedEscrowCount: 0,
        };
      }
      if (row.status !== 'active') fail('operation_closed', 'That operation is not active.');
      const participantAuthority = await lockOperationAuthorityRows(client, row);
      const abandoned = await abandonIfInvalid(client, row, mutation, participantAuthority);
      if (abandoned) return abandoned;
      const states = stateMap(await stateRows(client, row.id));
      if (completionRequires(root).some((id) => states.get(id)?.state !== 'completed')) {
        fail('operation_incomplete', 'Every required role branch must converge first.');
      }
      const assignment = (await client.query(
        `SELECT role_id,account_id,character_id FROM world_operation_roles
          WHERE operation_id=$1 AND account_id=$2`, [row.id, context.accountId],
      )).rows[0];
      if (assignment.role_id !== root.metadata?.closerRoleId) {
        fail('operation_completion_role', 'The graph-declared closer role must close this operation.');
      }
      const assignments = participantAuthority.assignments;
      const effects = await applyCompletionEffects(client, root, assignments, mutation);
      for (const effect of root.effects || []) {
        if (effect.adapter === 'status_award') {
          await insertNodeState(client, row.id, effect.nodeId, 'completed');
        }
      }
      const releasedEscrowCount = await releaseAllEscrow(client, row.id, mutation);
      const completed = await setStatus(client, row, 'completed', 'completed');
      return {
        ok: true, ...operationProjection(completed), effects, releasedEscrowCount,
      };
    },
  );
}

/** Cancel an open operation and return every escrowed item to its recorded depositor. */
export async function cancelOperation(client, contextValue, operationIdValue, optionsValue) {
  const context = contextOf(contextValue);
  const operationId = canonical(operationIdValue, 'Operation id');
  const options = mutationOptions(optionsValue);
  const destinations = await destinationsFor(client, operationId);
  return withItemMutation(
    client, { scope: 'account', id: context.accountId }, 'operation_action', options.idempotencyKey,
    {
      action: 'cancel', operationId,
      itemAuthority: { operations: [operationId], destinations },
    },
    async (mutation) => {
      const authority = await authorizeOperation(client, context, operationId, {
        requireCrew: false, lock: true,
      });
      const { row } = authority;
      if (row.opened_by_account_id !== context.accountId) {
        fail('operation_cancel_forbidden', 'Only the account that opened this operation may cancel it.');
      }
      // Cancellation remains a recovery action even for an already-invalid party, but it shares the
      // same participant lock boundary so death/Crew mutations cannot cross escrow release.
      await lockOperationAuthorityRows(client, row);
      if (row.status === 'canceled') return { ok: true, ...operationProjection(row), releasedEscrowCount: 0 };
      if (!['forming', 'active'].includes(row.status)) fail('operation_closed', 'That operation is closed.');
      const releasedEscrowCount = await releaseAllEscrow(client, row.id, mutation);
      const canceled = await setStatus(client, row, 'canceled', 'canceled');
      return { ok: true, ...operationProjection(canceled), releasedEscrowCount };
    },
  );
}

function boardNode(node, state) {
  return {
    id: node.id,
    type: node.type,
    title: node.metadata?.title || node.id,
    status: state?.state || 'pending',
    completedAt: dateString(state?.completed_at),
  };
}

function roleBoardNode(node, state, roleId) {
  const projection = boardNode(node, state);
  if (node.type === 'evidence' && node.visibility === 'role_private'
    && node.metadata?.roleId === roleId && state?.state === 'completed') {
    projection.privateEvidence = node.metadata.privateEvidence;
  }
  return projection;
}

function maySeeNode(node, states, roleId = null) {
  if (node.visibility === 'role_private') return roleId === node.metadata?.roleId;
  if (node.visibility === 'public') return true;
  return states.get(node.id)?.state === 'completed';
}

/** Safe shared projection: role slots and public progress, never account/character/Crew identities. */
export async function operationBoard(client, contextValue, operationIdValue) {
  const context = contextOf(contextValue);
  await awaitItemReadBarrier(client);
  const authority = await authorizeOperation(client, context, operationIdValue, { requireCrew: false });
  const { row, root } = authority;
  const roles = await roleRows(client, row.id);
  const contributions = (await client.query(
    'SELECT role_id,COUNT(*) AS n FROM world_operation_contributions WHERE operation_id=$1 GROUP BY role_id',
    [row.id],
  )).rows;
  const countByRole = new Map(contributions.map((entry) => [entry.role_id, Number(entry.n)]));
  const states = stateMap(await stateRows(client, row.id));
  const nodes = [...context.registry.nodes.values()].filter((node) => (
    node.packageId === row.graph_id && GRAPH_STATE_TYPES.has(node.type)
    && (node.id === root.id || node.metadata?.operationId === root.id)
    && (node.id === root.id || node.type === 'operation_step' || states.has(node.id))
    && maySeeNode(node, states)
  )).map((node) => boardNode(node, states.get(node.id)));
  return {
    ...operationProjection(row),
    roles: rolesOf(root).map((role) => ({
      roleId: role.id,
      title: role.title || role.id,
      filled: roles.some((assignment) => assignment.role_id === role.id),
      contributions: countByRole.get(role.id) || 0,
    })),
    filledRoleCount: roles.length,
    requiredRoleCount: rolesOf(root).length,
    nodes,
  };
}

/** Assigned-role projection: shared state plus only the caller's role-private evidence and steps. */
export async function roleBoard(client, contextValue, operationIdValue) {
  const context = contextOf(contextValue);
  await awaitItemReadBarrier(client);
  const authority = await authorizeOperation(client, context, operationIdValue, {
    requireAssignment: true, requireCrew: false,
  });
  const { row, assignment, root } = authority;
  const states = stateMap(await stateRows(client, row.id));
  const nodes = [...context.registry.nodes.values()].filter((node) => (
    node.packageId === row.graph_id && GRAPH_STATE_TYPES.has(node.type)
    && (node.id === root.id || node.metadata?.operationId === root.id)
    && (node.id === root.id || node.type === 'operation_step' || states.has(node.id))
    && maySeeNode(node, states, assignment.role_id)
  )).map((node) => roleBoardNode(node, states.get(node.id), assignment.role_id));
  return {
    ...operationProjection(row),
    role: { roleId: assignment.role_id },
    nodes,
  };
}

export const SUPPORTED_OPERATION_CONDITION_ADAPTERS = Object.freeze([...CONDITION_ADAPTERS]);
export const SUPPORTED_OPERATION_EFFECT_ADAPTERS = Object.freeze([
  ...CONTRIBUTION_EFFECTS, ...COMPLETION_EFFECTS,
]);
export const PHASE1_PROOF_ROLES = PROOF_ROLES;
