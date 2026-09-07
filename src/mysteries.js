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
import { rewardAssetDeclarations, validateGraph } from './worldgraph-validate.js';

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
const CONDITION_ALIASES = Object.freeze({
  graph_dependency: Object.freeze({ target: ['nodeId', 'id', 'value'] }),
  location: Object.freeze({ target: ['value', 'locationId', 'district'] }),
  level: Object.freeze({ target: ['value', 'minimumLevel', 'level'] }),
  skill: Object.freeze({ target: ['skillId', 'id', 'value'] }),
  item_ownership: Object.freeze({ target: ['templateId', 'itemTemplateId', 'nodeId'] }),
  owns_item: Object.freeze({ target: ['templateId', 'itemTemplateId', 'nodeId'] }),
  material_quantity: Object.freeze({
    target: ['templateId', 'materialId', 'nodeId'],
    quantity: ['quantity', 'minimumQuantity', 'amount'],
    optional: ['quality'],
  }),
  evidence: Object.freeze({ target: ['evidenceId', 'nodeId'] }),
  time_window: Object.freeze({
    target: ['windowId', 'value'],
    start: ['start', 'startsAt'],
    end: ['end', 'endsAt'],
  }),
  explicit_interaction: Object.freeze({ target: ['interactionId', 'id', 'value'] }),
});
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
const MYSTERY_NODE_FIELDS = Object.freeze({
  mystery_step: new Set([
    'id', 'type', 'version', 'visibility', 'requires', 'requiresAny', 'excludes',
    'conditions', 'effects', 'metadata', 'packageId',
  ]),
  world_gate: new Set([
    'id', 'type', 'version', 'visibility', 'requires', 'requiresAny', 'excludes',
    'conditions', 'effects', 'metadata', 'packageId',
  ]),
  choice: new Set([
    'id', 'type', 'version', 'visibility', 'requires', 'requiresAny', 'excludes',
    'conditions', 'effects', 'metadata', 'options', 'packageId',
  ]),
});
const MYSTERY_TARGET_FIELDS = new Set([
  'id', 'type', 'version', 'visibility', 'requires', 'metadata', 'packageId',
]);
const MYSTERY_METADATA_FIELDS = new Set([
  'title', 'description', 'lore', 'secret', 'roleId', 'terminal',
]);
const MYSTERY_EVIDENCE_METADATA_FIELDS = new Set([
  'title', 'description', 'lore', 'secret',
]);
const MYSTERY_REWARD_METADATA_FIELDS = new Set([
  'title', 'description', 'lore', 'inert', 'rewardType',
]);
const PRESENTATION_FIELDS = new Set(['title', 'description', 'lore', 'secret']);

const fail = (code, message, data) => { throw new GameError(code, message, data); };

function canonical(value, label, code = 'bad_mystery_request') {
  if (typeof value !== 'string' || value.trim() !== value || !value || value.length > 200) {
    fail(code, `${label} must be a canonical string of at most 200 characters.`);
  }
  return value;
}

function plainRecord(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

// Mystery actions are exactly-once instance state transitions. Any content field that purports to
// add another clock, repeatability rule, failure path, economy input/output, season, expiry, or
// death policy would otherwise validate but be silently ignored by the runtime. Keep this schema
// closed so executable authority can only enter through fields this module actually interprets.
function validateMysteryNodeSchema(registry, node) {
  const allowed = MYSTERY_NODE_FIELDS[node.type];
  const unsupported = Object.keys(node).filter((key) => !allowed.has(key));
  if (unsupported.length) {
    fail('unsupported_mystery_semantics',
      `Mystery node ${node.id} contains unsupported executable fields: ${unsupported.join(', ')}.`);
  }
  const pkg = registry.byPackage.get(node.packageId);
  if (node.version !== undefined && node.version !== pkg?.version) {
    fail('unsupported_mystery_semantics',
      `Mystery node ${node.id} version must equal its package version when declared.`);
  }
  if (node.metadata === undefined) return;
  if (!plainRecord(node.metadata)) {
    fail('unsupported_mystery_semantics', `Mystery node ${node.id} metadata must be plain data.`);
  }
  const unsupportedMetadata = Object.keys(node.metadata)
    .filter((key) => !MYSTERY_METADATA_FIELDS.has(key));
  if (unsupportedMetadata.length) {
    fail('unsupported_mystery_semantics',
      `Mystery node ${node.id} metadata contains unsupported executable fields: ${unsupportedMetadata.join(', ')}.`);
  }
  for (const field of PRESENTATION_FIELDS) {
    const value = node.metadata[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim() !== value || !value
      || value.length > (field === 'title' ? 200 : 1000)) {
      fail('unsupported_mystery_semantics',
        `Mystery node ${node.id} metadata.${field} must be bounded canonical text.`);
    }
  }
  if (node.metadata.roleId !== undefined) {
    canonical(node.metadata.roleId, `Mystery node ${node.id} role`,
      'unsupported_mystery_semantics');
  }
}

function operationOwnerRoot(registry, node) {
  const operationId = node.metadata?.operationId;
  if (typeof operationId !== 'string') return null;
  const root = nodeOf(registry, operationId);
  if (!root || root.type !== 'social_gate' || root.packageId !== node.packageId
    || (root.roles !== undefined && root.metadata?.roles !== undefined)) return null;
  const roles = root.roles ?? root.metadata?.roles;
  return Array.isArray(roles) && roles.length > 0 ? root : null;
}

function isMysteryStateNode(registry, node) {
  return BOARD_NODE_TYPES.has(node.type) && !operationOwnerRoot(registry, node);
}

function validateMysteryTargetSchema(registry, node) {
  const unsupported = Object.keys(node).filter((key) => !MYSTERY_TARGET_FIELDS.has(key));
  if (unsupported.length) {
    fail('unsupported_mystery_semantics',
      `Mystery ${node.type} target ${node.id} contains unsupported executable fields: ${unsupported.join(', ')}.`);
  }
  const pkg = registry.byPackage.get(node.packageId);
  if (node.version !== undefined && node.version !== pkg?.version) {
    fail('unsupported_mystery_semantics',
      `Mystery ${node.type} target ${node.id} version must equal its package version when declared.`);
  }
  if (node.metadata !== undefined && !plainRecord(node.metadata)) {
    fail('unsupported_mystery_semantics',
      `Mystery ${node.type} target ${node.id} metadata must be plain data.`);
  }
  const metadata = node.metadata || {};
  const allowed = node.type === 'evidence'
    ? MYSTERY_EVIDENCE_METADATA_FIELDS : MYSTERY_REWARD_METADATA_FIELDS;
  const unsupportedMetadata = Object.keys(metadata).filter((key) => !allowed.has(key));
  if (unsupportedMetadata.length) {
    fail('unsupported_mystery_semantics',
      `Mystery ${node.type} target ${node.id} metadata contains unsupported executable fields: ${unsupportedMetadata.join(', ')}.`);
  }
  for (const field of PRESENTATION_FIELDS) {
    const value = metadata[field];
    if (value === undefined) continue;
    if (typeof value !== 'string' || value.trim() !== value || !value
      || value.length > (field === 'title' ? 200 : 1000)) {
      fail('unsupported_mystery_semantics',
        `Mystery ${node.type} target ${node.id} metadata.${field} must be bounded canonical text.`);
    }
  }
  if (node.type === 'reward'
    && (metadata.inert !== true || metadata.rewardType !== 'status')) {
    fail('unsafe_mystery_reward',
      `Mystery reward target ${node.id} must be an explicitly inert status.`);
  }
}

function assertMysteryCompletionEdge(registry, source, target) {
  if (operationOwnerRoot(registry, target) || target.metadata?.operationId !== undefined) {
    fail('bad_mystery_effect',
      `Mystery node ${source.id} cannot complete operation-owned target ${target.id}.`);
  }
  if (!Array.isArray(target.requires) || target.requires.length !== 1
    || target.requires[0] !== source.id) {
    fail('bad_mystery_effect',
      `Mystery target ${target.id} must require exactly its granting node ${source.id}.`);
  }
  if (target.requiresAny !== undefined || target.conditions !== undefined
    || target.excludes !== undefined) {
    fail('bad_mystery_effect',
      `Mystery target ${target.id} declares preconditions its direct completion cannot evaluate.`);
  }
}

function oneAlias(condition, names, label, { required = true } = {}) {
  const declared = names.filter((name) => condition[name] !== undefined);
  if (declared.length > 1) {
    fail('conflicting_mystery_condition_alias',
      `${label} must use exactly one supported alias, not ${declared.join(', ')}.`);
  }
  if (required && declared.length !== 1) {
    fail('bad_mystery_condition', `${label} is required.`);
  }
  return declared.length === 1 ? condition[declared[0]] : undefined;
}

// This is the sole Phase 1 mystery-condition vocabulary. Validation and execution both consume
// this normalized immutable form, so an accepted alias can never degrade into an undefined target,
// a default quantity, or a different quality at request time.
function normalizeMysteryCondition(registry, node, condition, { timeWindows = null } = {}) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)
    || Object.getPrototypeOf(condition) !== Object.prototype) {
    fail('bad_mystery_condition', `Mystery node ${node.id} contains a malformed condition.`);
  }
  const adapter = oneAlias(condition, ['adapter', 'type', 'kind'], 'Mystery condition adapter');
  if (!CONDITION_ADAPTERS.has(adapter)) {
    fail('unsupported_mystery_condition',
      `Mystery node ${node.id} uses unsupported condition adapter ${String(adapter)}.`);
  }
  const aliases = CONDITION_ALIASES[adapter];
  const allowed = new Set(['adapter', 'type', 'kind',
    ...Object.values(aliases).flat()]);
  if (Object.keys(condition).some((key) => !allowed.has(key))) {
    fail('bad_mystery_condition',
      `Mystery condition ${adapter} on ${node.id} contains unsupported authority fields.`);
  }

  if (adapter === 'time_window') {
    const windowId = oneAlias(condition, aliases.target, 'Mystery time-window id', {
      required: false,
    });
    const startsAt = oneAlias(condition, aliases.start, 'Mystery time-window start', {
      required: false,
    });
    const endsAt = oneAlias(condition, aliases.end, 'Mystery time-window end', {
      required: false,
    });
    if (windowId !== undefined) {
      canonical(windowId, 'Mystery time-window id', 'bad_mystery_condition');
      if (startsAt !== undefined || endsAt !== undefined) {
        fail('bad_mystery_condition',
          'A named mystery time window cannot also declare inline bounds.');
      }
      if (!timeWindows || !Object.hasOwn(timeWindows, windowId)) {
        fail('unsupported_mystery_condition',
          `Mystery node ${node.id} names a time window with no immutable server definition.`);
      }
      const declared = timeWindows[windowId];
      return Object.freeze({
        adapter, windowId, startsAt: declared.startsAt, endsAt: declared.endsAt,
      });
    }
    canonical(startsAt, 'Mystery time-window start', 'bad_mystery_condition');
    canonical(endsAt, 'Mystery time-window end', 'bad_mystery_condition');
    if (!Number.isFinite(Date.parse(startsAt)) || !Number.isFinite(Date.parse(endsAt))
      || Date.parse(startsAt) >= Date.parse(endsAt)) {
      fail('bad_mystery_condition', `Mystery node ${node.id} has invalid time-window bounds.`);
    }
    return Object.freeze({ adapter, windowId: null, startsAt, endsAt });
  }

  const rawTarget = oneAlias(condition, aliases.target, `Mystery ${adapter} target`);
  const target = adapter === 'level' ? Number(rawTarget)
    : canonical(rawTarget, `Mystery ${adapter} target`, 'bad_mystery_condition');
  if (adapter === 'level' && (!Number.isInteger(target) || target < 1)) {
    fail('bad_mystery_condition', `Mystery node ${node.id} requires a positive integer level.`);
  }
  if (adapter === 'material_quantity') {
    const quantity = Number(oneAlias(
      condition, aliases.quantity, 'Mystery material quantity',
    ));
    if (!Number.isInteger(quantity) || quantity < 1) {
      fail('bad_mystery_condition',
        `Mystery node ${node.id} requires a positive integer material quantity.`);
    }
    const quality = condition.quality === undefined ? 'standard'
      : canonical(condition.quality, 'Mystery material quality', 'bad_mystery_condition');
    if (quality !== 'standard') {
      fail('unsupported_mystery_condition',
        `Mystery node ${node.id} uses unsupported material quality ${quality}.`);
    }
    const template = nodeOf(registry, target);
    if (!template || template.type !== 'material') {
      fail('bad_mystery_condition',
        `Mystery material condition on ${node.id} must target a material node.`);
    }
    return Object.freeze({ adapter, target, quantity, quality });
  }
  if (adapter === 'item_ownership' || adapter === 'owns_item') {
    const template = nodeOf(registry, target);
    if (!template || template.type !== 'item_template') {
      fail('bad_mystery_condition',
        `Mystery item condition on ${node.id} must target an item_template node.`);
    }
  }
  if (adapter === 'graph_dependency' || adapter === 'evidence') {
    const dependency = nodeOf(registry, target);
    if (!dependency || dependency.packageId !== node.packageId
      || !isMysteryStateNode(registry, dependency)) {
      fail('bad_mystery_condition',
        `Mystery ${adapter} on ${node.id} must target its own mystery graph.`);
    }
    if (adapter === 'evidence' && dependency.type !== 'evidence') {
      fail('bad_mystery_condition', `Mystery evidence condition on ${node.id} requires evidence.`);
    }
  }
  return Object.freeze({ adapter, target });
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

function assertEffectTarget(registry, source, effect, adapter) {
  const targetId = effect.nodeId || effect.templateId;
  const target = nodeOf(registry, targetId);
  if (!target) {
    fail('bad_mystery_effect', `Mystery effect ${adapter} references missing node ${targetId}.`);
  }
  const visiblePackages = packageDependencies(registry, source.packageId);
  if (target.packageId !== source.packageId && !visiblePackages.has(target.packageId)) {
    fail('bad_mystery_effect', `Mystery effect ${adapter} crosses an undeclared package boundary.`);
  }
  if (['item_escrow', 'item_consume', 'unique_item_award'].includes(adapter)
    && target.type !== 'item_template') {
    fail('bad_mystery_effect', `Mystery effect ${adapter} requires an item_template target.`);
  }
  if (['unique_item_award', 'status_award'].includes(adapter)
    && rewardAssetDeclarations(target).some(({ asset }) => ['OMR', 'CASH'].includes(asset))) {
    fail('unsafe_mystery_reward',
      `Mystery effect ${adapter} cannot target a currency-bearing definition.`);
  }
  if (adapter === 'evidence_grant' && target.type !== 'evidence') {
    fail('bad_mystery_effect', 'Evidence grants require an evidence target.');
  }
  if (['discover', 'complete', 'evidence_grant', 'status_award'].includes(adapter)
    && !isMysteryStateNode(registry, target)) {
    fail('bad_mystery_effect',
      `Mystery effect ${adapter} cannot target operation-owned graph state.`);
  }
  if (['complete', 'evidence_grant', 'status_award'].includes(adapter)) {
    assertMysteryCompletionEdge(registry, source, target);
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
    if (target.type !== 'reward' || metadata.inert !== true
      || metadata.rewardType !== 'status') {
      fail('unsafe_mystery_reward', 'Status awards must target an explicitly inert reward node.');
    }
  }
}

function assertEffect(registry, source, effect) {
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
  assertEffectTarget(registry, source, effect, adapter);
}

function assertEffects(registry, node, effects) {
  if (effects === undefined) return;
  if (!Array.isArray(effects)) {
    fail('bad_mystery_effect', `Mystery node ${node.id} effects must be an array.`);
  }
  for (const effect of effects) assertEffect(registry, node, effect);
}

function validateMysteryDependencyCycles(registry, timeWindows) {
  // Evidence and rewards may be shared with the operation runtime, but only a positively claimed
  // node under a real same-package operation root leaves the mystery dependency graph. A bogus
  // operationId can therefore never hide a choice/evidence cycle from both runtimes.
  const candidates = [...registry.nodes.values()].filter((node) => (
    isMysteryStateNode(registry, node)
  ));
  const byId = new Map(candidates.map((node) => [node.id, node]));
  const edges = new Map(candidates.map((node) => {
    const conditionTargets = (node.conditions || []).map((condition) => (
      normalizeMysteryCondition(registry, node, condition, { timeWindows })
    )).filter(({ adapter }) => ['graph_dependency', 'evidence'].includes(adapter))
      .map(({ target }) => target);
    return [node.id, [
      ...(node.requires || []), ...(node.requiresAny || []).flat(), ...conditionTargets,
    ].filter((id) => byId.get(id)?.packageId === node.packageId)];
  }));
  const visiting = new Set();
  const visited = new Set();
  const path = [];
  const visit = (id) => {
    if (visiting.has(id)) {
      const start = path.indexOf(id);
      const cycle = [...path.slice(start), id];
      fail('mystery_dependency_cycle',
        `Mystery executable dependency cycle: ${cycle.join(' -> ')}`);
    }
    if (visited.has(id)) return;
    visiting.add(id);
    path.push(id);
    for (const next of edges.get(id) || []) visit(next);
    path.pop();
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of [...edges.keys()].sort()) visit(id);
}

// Pure executable-definition validation used both by request contexts and the Phase 1 boot/release
// gate. It reads only the immutable registry and performs no database or runtime side effects.
export function validateMysteryDefinitions(registry, { timeWindows = null } = {}) {
  for (const node of registry.nodes.values()) {
    if (!['evidence', 'reward'].includes(node.type)) continue;
    if (operationOwnerRoot(registry, node)) continue;
    if (node.metadata?.operationId !== undefined) {
      fail('unsupported_mystery_semantics',
        `Graph-state target ${node.id} claims an unknown operation owner.`);
    }
    validateMysteryTargetSchema(registry, node);
  }
  for (const node of registry.nodes.values()) {
    if (!['mystery_step', 'world_gate', 'choice'].includes(node.type)) continue;
    validateMysteryNodeSchema(registry, node);
    if (node.conditions !== undefined && !Array.isArray(node.conditions)) {
      fail('bad_mystery_condition', `Mystery node ${node.id} conditions must be an array.`);
    }
    for (const condition of node.conditions || []) {
      normalizeMysteryCondition(registry, node, condition, { timeWindows });
    }
    for (const requiredId of [
      ...(node.requires || []), ...(node.requiresAny || []).flat(),
    ]) {
      const required = nodeOf(registry, requiredId);
      if (!required || required.packageId !== node.packageId
        || !isMysteryStateNode(registry, required)) {
        fail('bad_mystery_condition',
          `Mystery node ${node.id} has an invalid graph prerequisite ${requiredId}.`);
      }
    }
    for (const excludedId of node.excludes || []) {
      const excluded = nodeOf(registry, excludedId);
      if (!excluded || excluded.packageId !== node.packageId
        || !isMysteryStateNode(registry, excluded)) {
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
      if (option.title !== undefined) {
        canonical(option.title, `Choice option ${optionId} title`, 'bad_mystery_choice');
      }
      if (seen.has(optionId)) fail('bad_mystery_choice', `Choice node ${node.id} repeats ${optionId}.`);
      seen.add(optionId);
      if (option.excludes !== undefined
        && (!Array.isArray(option.excludes)
          || option.excludes.some((id) => typeof id !== 'string' || !nodeOf(registry, id)))) {
        fail('bad_mystery_choice', `Choice option ${optionId} has invalid exclusions.`);
      }
      for (const targetId of option.excludes || []) {
        const target = nodeOf(registry, targetId);
        if (target.packageId !== node.packageId || !isMysteryStateNode(registry, target)) {
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
  validateMysteryDependencyCycles(registry, timeWindows);
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
  const immutableTimeWindows = plainFrozenWindows(timeWindows);
  validateMysteryDefinitions(registry, { timeWindows: immutableTimeWindows });
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
    timeWindows: immutableTimeWindows,
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

async function instanceFor(client, owner, graphId, graphVersion, { lock = false } = {}) {
  const params = [owner.scope, owner.id, graphId, Number(graphVersion)];
  if (lock) return (await client.query(
    `SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
            created_at,updated_at,completed_at,failed_at,canceled_at
       FROM mystery_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND graph_id=$3 AND graph_version=$4 FOR UPDATE`,
    params,
  )).rows[0] || null;
  return (await client.query(
    `SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
            created_at,updated_at,completed_at,failed_at,canceled_at
       FROM mystery_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND graph_id=$3 AND graph_version=$4`,
    params,
  )).rows[0] || null;
}

async function instanceById(client, instanceIdValue, { lock = false } = {}) {
  const instanceId = canonical(instanceIdValue, 'Mystery instance id');
  if (lock) {
    return (await client.query(
      `SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
              created_at,updated_at,completed_at,failed_at,canceled_at
         FROM mystery_instances WHERE id=$1 FOR UPDATE`,
      [instanceId],
    )).rows[0] || null;
  }
  return (await client.query(
    `SELECT id,owner_scope,owner_id,authority_account_id,graph_id,graph_version,status,
            created_at,updated_at,completed_at,failed_at,canceled_at
       FROM mystery_instances WHERE id=$1`,
    [instanceId],
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
export async function startMystery(
  client, contextValue, ownerValue, graphIdValue, version, idempotencyKeyValue = null,
) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const pkg = packageOf(context, graphIdValue, version);
  await authorizeOwner(client, context, owner);
  const graph = graphIdentity(pkg);
  const existing = await instanceFor(client, owner, pkg.id, pkg.version);
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
    idempotencyKeyValue === null
      ? startKey(owner, pkg.id, Number(pkg.version))
      : canonical(idempotencyKeyValue, 'Idempotency key', 'bad_idempotency_key'),
    { action: 'start', graph },
    async () => {
      await actorOf(client, context, owner);
      const id = crypto.randomUUID();
      const inserted = await client.query(
        `INSERT INTO mystery_instances
           (id,owner_scope,owner_id,authority_account_id,graph_id,graph_version)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (owner_scope,owner_id,graph_id,graph_version) DO NOTHING
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
      const instance = await instanceFor(client, owner, pkg.id, pkg.version, { lock: true });
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

async function conditionBlocker({
  client, context, owner, actor, instance, states, node, condition, interactionId, lock,
}) {
  const normalized = normalizeMysteryCondition(context.registry, node, condition, {
    timeWindows: context.timeWindows,
  });
  const { adapter } = normalized;
  if (adapter === 'graph_dependency') {
    const nodeId = normalized.target;
    return states.get(nodeId)?.state === 'completed' ? null : { adapter, nodeId };
  }
  if (adapter === 'location') {
    const required = normalized.target;
    return actor?.location === required ? null : { adapter, required, current: actor?.location || null };
  }
  if (adapter === 'level') {
    const required = normalized.target;
    return actor?.level >= required ? null : { adapter, required, current: actor?.level || 0 };
  }
  if (adapter === 'skill') {
    const required = normalized.target;
    return actor?.skills?.has(required) ? null : { adapter, required };
  }
  if (adapter === 'item_ownership' || adapter === 'owns_item') {
    const templateId = normalized.target;
    const params = [owner.scope, owner.id, templateId];
    const row = lock ? (await client.query(
      `SELECT id FROM item_instances
        WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND state='active'
        ORDER BY created_at,id LIMIT 1 FOR UPDATE`, params,
    )).rows[0] : (await client.query(
      `SELECT id FROM item_instances
        WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND state='active'
        ORDER BY created_at,id LIMIT 1`, params,
    )).rows[0];
    return row ? null : { adapter, templateId };
  }
  if (adapter === 'material_quantity') {
    const templateId = normalized.target;
    const required = normalized.quantity;
    const params = [owner.scope, owner.id, templateId, normalized.quality];
    const row = lock ? (await client.query(
      `SELECT quantity FROM item_stacks
        WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4 FOR UPDATE`, params,
    )).rows[0] : (await client.query(
      `SELECT quantity FROM item_stacks
        WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4`, params,
    )).rows[0];
    const current = Number(row?.quantity || 0);
    return current >= required ? null
      : { adapter, templateId, quality: normalized.quality, required, current };
  }
  if (adapter === 'evidence') {
    const nodeId = normalized.target;
    return states.get(nodeId)?.state === 'completed' ? null : { adapter, nodeId };
  }
  if (adapter === 'time_window') {
    const open = context.nowMs >= Date.parse(normalized.startsAt)
      && context.nowMs < Date.parse(normalized.endsAt);
    return open ? null : { adapter, windowId: normalized.windowId };
  }
  const required = normalized.target;
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
      client, context, owner, actor, instance, states, node, condition, interactionId, lock,
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
  const instance = await instanceFor(client, owner, pkg.id, pkg.version);
  if (!instance) fail('mystery_not_started', 'Start this mystery first.');
  if (instance.authority_account_id !== context.accountId) {
    fail('mystery_owner_forbidden', 'That account cannot control this mystery instance.');
  }
  assertPinned(instance, pkg);
  return { pkg, instance };
}

// Cancellation is a release-only recovery path. It deliberately binds the stored instance and its
// immutable owner/version tuple without interpreting nodes or executing effects from either the old
// or current package. This keeps old-version escrow recoverable after an activation bump while every
// gameplay action continues to require assertPinned against the current registry.
async function cancellationAuthority(client, context, owner, graphId, instanceId) {
  const instance = await instanceById(client, instanceId);
  if (!instance || instance.owner_scope !== owner.scope || instance.owner_id !== owner.id
    || instance.graph_id !== graphId || instance.authority_account_id !== context.accountId) {
    fail('mystery_unavailable', 'That mystery instance is unavailable.');
  }
  return { instance };
}

async function lockedActionInstance(client, authority, context, { allowClosed = false } = {}) {
  const instance = await instanceFor(
    client,
    { scope: authority.instance.owner_scope, id: authority.instance.owner_id },
    authority.pkg.id,
    authority.pkg.version,
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

async function lockedCancellationInstance(client, authority, context) {
  const instance = await instanceById(client, authority.instance.id, { lock: true });
  if (!instance || instance.id !== authority.instance.id
    || instance.owner_scope !== authority.instance.owner_scope
    || instance.owner_id !== authority.instance.owner_id
    || instance.graph_id !== authority.instance.graph_id
    || instance.authority_account_id !== context.accountId
    || Number(instance.graph_version) !== Number(authority.instance.graph_version)) {
    fail('mystery_owner_forbidden', 'Mystery instance authority changed.');
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
    .filter((node) => node.packageId === instance.graph_id
      && isMysteryStateNode(context.registry, node));
  let changed = true;
  while (changed) {
    changed = false;
    for (const node of packageNodes) {
      if (closed.has(node.id)) continue;
      const requiredClosed = (node.requires || []).some((id) => closed.has(id));
      const alternativeClosed = (node.requiresAny || [])
        .some((group) => group.every((id) => closed.has(id)));
      const conditionClosed = (node.conditions || []).some((condition) => (
        normalizeMysteryCondition(context.registry, node, condition, {
          timeWindows: context.timeWindows,
        }).adapter === 'graph_dependency'
        && closed.has(normalizeMysteryCondition(context.registry, node, condition, {
          timeWindows: context.timeWindows,
        }).target)
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
  client, context, owner, actor, instance, node, interactionId, mutation, extraEffects = [],
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
      // Canonical mutation lock order is actor character -> mystery instance -> item rows. The
      // social-operation opener uses the same suffix after its Crew/operation locks.
      const actor = await actorOf(client, context, owner);
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
      // Lock and authenticate the actor before the instance so terminal completion cannot invert
      // the operation-open path's character -> mystery lock order.
      const actor = await actorOf(client, context, owner);
      const instance = await lockedActionInstance(client, authority, context);
      return completeGraphNode({
        client, context, owner, actor, instance, node,
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
      const actor = await actorOf(client, context, owner);
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
  client, contextValue, ownerValue, graphIdValue, instanceIdValue, optionsValue,
) {
  const context = contextOf(contextValue);
  const owner = ownerOf(ownerValue);
  const graphId = canonical(graphIdValue, 'Mystery graph id');
  const instanceId = canonical(instanceIdValue, 'Mystery instance id');
  const options = mutationOptions(optionsValue);
  const authority = await cancellationAuthority(client, context, owner, graphId, instanceId);
  return withItemMutation(
    client,
    owner,
    'mystery_action',
    options.idempotencyKey,
    {
      action: 'cancel',
      graph: {
        id: authority.instance.graph_id,
        version: Number(authority.instance.graph_version),
      },
      itemAuthority: {
        operations: [authority.instance.id],
        destinations: [owner],
      },
    },
    async (mutation) => {
      const instance = await lockedCancellationInstance(client, authority, context);
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
  const instance = await instanceFor(client, owner, graphId, pkg.version);
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
    if (node.packageId !== graphId || !isMysteryStateNode(context.registry, node)
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
