// Coordination profiles contain bounded declarative predicates only. Schema 1 preserves the
// private foundation; schema 2 adds exact-source knowledge declarations, never economic effects.
import crypto from 'node:crypto';
import { canonicalBytes, compareCanonicalText } from '../content/canonical.js';

export const COORDINATION_GRAPH_LIMITS = Object.freeze({
  nodes: 64, ruleDepth: 8, rules: 512, identifierLength: 128,
  titleLength: 200, descriptionLength: 2_000, registryGraphs: 64,
  claimTextLength: 200,
});
const REGISTRIES = new WeakSet();
const IDENTIFIER = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const CONTROLS = /[\u0000-\u001f\u007f-\u009f]/u;

export class CoordinationGraphError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'CoordinationGraphError';
    this.code = code;
  }
}
const fail = (code, message) => { throw new CoordinationGraphError(code, message); };

function record(value, allowed, required, code) {
  if (!value || typeof value !== 'object' || Array.isArray(value)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    fail(code, 'Expected a plain declarative object.');
  }
  const keys = Reflect.ownKeys(value);
  for (const key of keys) {
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !allowed.includes(key)
      || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) {
      fail(code, 'Definition fields must be declared enumerable data properties.');
    }
  }
  if (required.some((key) => !Object.hasOwn(value, key))) fail(code, 'A required field is missing.');
}

function array(value, maximum, code) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
      || !value.length || value.length > maximum) {
    fail(code, 'Expected a nonempty bounded array.');
  }
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key)
      || Number(key) >= value.length || !descriptor?.enumerable
      || !Object.hasOwn(descriptor, 'value')) fail(code, 'Invalid array data property.');
  }
  for (let index = 0; index < value.length; index++) {
    if (!Object.hasOwn(value, index)) fail(code, 'Sparse arrays are not supported.');
  }
}

function identifier(value, code) {
  if (typeof value !== 'string' || !IDENTIFIER.test(value)) fail(code, 'Invalid canonical identifier.');
  return value;
}

function text(value, maximum, code) {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim()
    || value.length > maximum || CONTROLS.test(value)) fail(code, 'Invalid bounded text.');
  return value;
}

function integer(value, minimum, maximum, code) {
  if (!Number.isSafeInteger(value) || Object.is(value, -0)
    || value < minimum || value > maximum) fail(code, 'Invalid bounded integer.');
  return value;
}

function normalizeClaimValue(value, code) {
  record(value, ['type', 'value'], ['type', 'value'], code);
  switch (value.type) {
    case 'boolean':
      if (typeof value.value !== 'boolean') fail(code, 'Claim booleans must be exact booleans.');
      return { type: 'boolean', value: value.value };
    case 'integer':
      return { type: 'integer', value: integer(value.value, -Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, code) };
    case 'text': {
      const normalized = text(value.value, COORDINATION_GRAPH_LIMITS.claimTextLength, code);
      try { canonicalBytes(normalized); } catch { fail(code, 'Claim text must be valid canonical Unicode.'); }
      return { type: 'text', value: normalized };
    }
    default:
      fail(code, 'Unknown coordination claim value type.');
  }
}

function normalizeClaim(value) {
  const code = 'coordination_claim_invalid';
  const fields = ['domain', 'proposition', 'sourceRoot', 'value'];
  record(value, fields, fields, code);
  return { domain: identifier(value.domain, code), proposition: identifier(value.proposition, code),
    sourceRoot: identifier(value.sourceRoot, code), value: normalizeClaimValue(value.value, code) };
}

function normalizeRule(value, budget, depth = 1) {
  const code = 'coordination_rule_invalid';
  if (depth > COORDINATION_GRAPH_LIMITS.ruleDepth || ++budget.count > COORDINATION_GRAPH_LIMITS.rules) {
    fail('coordination_definition_limit', 'Coordination rule complexity exceeds the compiled limit.');
  }
  record(value, ['kind', 'rules', 'count', 'nodeId', 'level', 'districtId', 'seconds',
    'domain', 'proposition', 'value', 'sourceRoots'], ['kind'], code);
  switch (value.kind) {
    case 'always':
      record(value, ['kind'], ['kind'], code);
      return { kind: value.kind };
    case 'all':
    case 'any':
    case 'at_least': {
      const threshold = value.kind === 'at_least';
      const fields = threshold ? ['kind', 'count', 'rules'] : ['kind', 'rules'];
      record(value, fields, fields, code);
      array(value.rules, COORDINATION_GRAPH_LIMITS.rules, code);
      const rules = value.rules.map((rule) => normalizeRule(rule, budget, depth + 1));
      const ordered = rules.map((rule) => ({ rule, key: canonicalBytes(rule).toString('utf8') }))
        .sort((left, right) => compareCanonicalText(left.key, right.key));
      if (ordered.some((entry, index) => index && entry.key === ordered[index - 1].key)) {
        fail(code, 'Logical groups require distinct predicates.');
      }
      return {
        kind: value.kind,
        ...(threshold ? { count: integer(value.count, 1, rules.length, code) } : {}),
        rules: ordered.map(({ rule }) => rule),
      };
    }
    case 'node_completed':
      record(value, ['kind', 'nodeId'], ['kind', 'nodeId'], code);
      budget.references.add(identifier(value.nodeId, code));
      return { kind: value.kind, nodeId: value.nodeId };
    case 'level_at_least':
      record(value, ['kind', 'level'], ['kind', 'level'], code);
      return { kind: value.kind, level: integer(value.level, 1, Number.MAX_SAFE_INTEGER, code) };
    case 'at_district':
      record(value, ['kind', 'districtId'], ['kind', 'districtId'], code);
      return { kind: value.kind, districtId: identifier(value.districtId, code) };
    case 'elapsed_at_least':
      record(value, ['kind', 'seconds'], ['kind', 'seconds'], code);
      return { kind: value.kind, seconds: integer(value.seconds, 0, Number.MAX_SAFE_INTEGER, code) };
    case 'independent_evidence': {
      if (budget.schemaVersion !== 2) fail(code, 'Knowledge predicates require schema version 2.');
      const fields = ['kind', 'domain', 'proposition', 'value', 'sourceRoots'];
      record(value, fields, fields, code);
      array(value.sourceRoots, 2, code);
      if (value.sourceRoots.length !== 2) fail(code, 'Independent evidence requires exactly two source roots.');
      const sourceRoots = value.sourceRoots.map((root) => identifier(root, code)).sort(compareCanonicalText);
      if (sourceRoots[0] === sourceRoots[1]) fail(code, 'Independent evidence requires distinct source roots.');
      return { kind: value.kind, domain: identifier(value.domain, code),
        proposition: identifier(value.proposition, code), value: normalizeClaimValue(value.value, code), sourceRoots };
    }
    default:
      fail(code, 'Unknown coordination predicate.');
  }
}

function freeze(value) {
  if (value && typeof value === 'object') {
    for (const member of Object.values(value)) freeze(member);
    Object.freeze(value);
  }
  return value;
}

export function compileCoordinationGraph(source) {
  const code = 'coordination_definition_invalid';
  const fields = ['schemaVersion', 'id', 'version', 'title', 'nodes'];
  record(source, fields, fields, code);
  if (![1, 2].includes(source.schemaVersion)) fail(code, 'Unsupported coordination schema version.');
  array(source.nodes, COORDINATION_GRAPH_LIMITS.nodes, 'coordination_definition_limit');
  const budget = { count: 0, references: new Set(), schemaVersion: source.schemaVersion };
  const dependencies = new Map();
  const nodes = source.nodes.map((node) => {
    const required = ['id', 'kind', 'title', 'visibility', 'discover', 'requires'];
    record(node, [...required, 'description', ...(source.schemaVersion === 2 ? ['claim'] : [])], required, code);
    const id = identifier(node.id, code);
    if (dependencies.has(id)) fail('coordination_graph_duplicate', 'Node identifiers must be unique.');
    if (!['task', 'terminal'].includes(node.kind) || !['public', 'hidden'].includes(node.visibility)) {
      fail(code, 'Unsupported coordination node kind or visibility.');
    }
    if (Object.hasOwn(node, 'claim') && (node.kind !== 'task' || node.visibility !== 'hidden')) {
      fail('coordination_claim_invalid', 'Only an explicit hidden-task discovery can issue a claim.');
    }
    budget.references = new Set();
    const result = {
      id, kind: node.kind, title: text(node.title, COORDINATION_GRAPH_LIMITS.titleLength, code),
      ...(Object.hasOwn(node, 'description')
        ? { description: text(node.description, COORDINATION_GRAPH_LIMITS.descriptionLength, code) } : {}),
      visibility: node.visibility,
      discover: normalizeRule(node.discover, budget), requires: normalizeRule(node.requires, budget),
      ...(Object.hasOwn(node, 'claim') ? { claim: normalizeClaim(node.claim) } : {}),
    };
    dependencies.set(id, budget.references);
    return result;
  }).sort((left, right) => compareCanonicalText(left.id, right.id));
  const terminals = nodes.filter((node) => node.kind === 'terminal');
  if (terminals.length !== 1) fail(code, 'A coordination graph requires exactly one terminal.');
  const claimSources = new Map();
  for (const node of nodes) {
    if (!node.claim) continue;
    if (claimSources.has(node.claim.sourceRoot)) fail('coordination_claim_invalid', 'Claim source roots must be unique.');
    claimSources.set(node.claim.sourceRoot, node);
  }
  function validateEvidence(rule, nodeId) {
    if (rule.kind === 'independent_evidence') {
      for (const root of rule.sourceRoots) {
        const sourceNode = claimSources.get(root), claim = sourceNode?.claim;
        if (!claim || claim.domain !== rule.domain || claim.proposition !== rule.proposition
            || !canonicalBytes(claim.value).equals(canonicalBytes(rule.value))) {
          fail('coordination_claim_reference', 'Evidence roots must identify matching claims in this exact definition.');
        }
        // These are structural source dependencies, not a requirement that one player collect both.
        dependencies.get(nodeId).add(sourceNode.id);
      }
    }
    for (const child of rule.rules || []) validateEvidence(child, nodeId);
  }
  for (const node of nodes) {
    validateEvidence(node.discover, node.id); validateEvidence(node.requires, node.id);
  }
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('coordination_graph_cycle', 'Coordination dependencies must be acyclic.');
    if (visited.has(id)) return;
    visiting.add(id);
    for (const reference of dependencies.get(id)) {
      if (!dependencies.has(reference)) fail('coordination_graph_reference', 'A dependency node is missing.');
      visit(reference);
    }
    visiting.delete(id); visited.add(id);
  }
  for (const node of nodes) visit(node.id);
  const ancestors = new Set();
  function collect(id) {
    if (ancestors.has(id)) return;
    ancestors.add(id);
    for (const reference of dependencies.get(id)) collect(reference);
  }
  collect(terminals[0].id);
  if (ancestors.size !== nodes.length) {
    fail('coordination_graph_disconnected', 'Every node must have a dependency path to the terminal.');
  }
  const definition = {
    schemaVersion: source.schemaVersion, id: identifier(source.id, code),
    version: integer(source.version, 1, 2_147_483_647, code),
    title: text(source.title, COORDINATION_GRAPH_LIMITS.titleLength, code), nodes,
  };
  let bytes;
  try { bytes = canonicalBytes(definition); }
  catch { fail(code, 'Coordination definitions must contain canonical JSON data.'); }
  const contentHash = crypto.createHash('sha256').update(`omerta:coordination:graph:v${source.schemaVersion}\0`).update(bytes).digest('hex');
  return freeze({ ...JSON.parse(bytes.toString('utf8')), contentHash });
}

export function coordinationEvidenceKey(rule) {
  const normalized = normalizeRule(rule, { count: 0, references: new Set(), schemaVersion: 2 });
  if (normalized.kind !== 'independent_evidence') fail('coordination_rule_invalid', 'An evidence predicate is required.');
  return crypto.createHash('sha256').update('omerta:coordination:evidence-rule:v1\0')
    .update(canonicalBytes(normalized)).digest('hex');
}

// Validate the complete expression before evaluating it: an unknown branch must never be hidden
// by an OR short circuit. No clock reads, coercion, callbacks, or client-selected state providers.
export function evaluateRule(rule, state = {}) {
  try {
    const normalized = normalizeRule(rule, { count: 0, references: new Set(), schemaVersion: 2 });
    const ownState = (key) => {
      if (!state || typeof state !== 'object') return undefined;
      const descriptor = Object.getOwnPropertyDescriptor(state, key);
      return descriptor && Object.hasOwn(descriptor, 'value') ? descriptor.value : undefined;
    };
    const completed = ownState('completed'), level = ownState('level');
    const district = ownState('district'), elapsed = ownState('elapsedSeconds');
    const evidence = ownState('evidence'), contentHash = ownState('contentHash');
    function evaluate(value) {
      switch (value.kind) {
        case 'always': return true;
        case 'all': return value.rules.every(evaluate);
        case 'any': return value.rules.some(evaluate);
        case 'at_least': return value.rules.filter(evaluate).length >= value.count;
        case 'node_completed':
          try { return Set.prototype.has.call(completed, value.nodeId); }
          catch { return false; }
        case 'level_at_least': return Number.isSafeInteger(level) && level >= value.level;
        case 'at_district': return typeof district === 'string' && district === value.districtId;
        case 'elapsed_at_least': return typeof elapsed === 'number' && Number.isFinite(elapsed)
          && elapsed >= 0 && elapsed >= value.seconds;
        case 'independent_evidence': {
          // The checked knowledge resolver owns ACL, original-account/root independence and conflicts.
          // This pure evaluator consumes an exact-rule/hash-bound receipt result, never a callback.
          if (typeof contentHash !== 'string' || !/^[a-f0-9]{64}$/.test(contentHash)) return false;
          const result = Map.prototype.get.call(evidence, coordinationEvidenceKey(value));
          record(result, ['satisfied', 'contentHash', 'receiptIds'], ['satisfied', 'contentHash', 'receiptIds'],
            'coordination_evidence_invalid');
          if (result.satisfied !== true || result.contentHash !== contentHash) return false;
          array(result.receiptIds, 2, 'coordination_evidence_invalid');
          return result.receiptIds.length === 2 && result.receiptIds[0] !== result.receiptIds[1]
            && result.receiptIds.every((id) => identifier(id, 'coordination_evidence_invalid') === id);
        }
        default: return false;
      }
    }
    return evaluate(normalized);
  } catch { return false; }
}

export function createCoordinationRegistry(sources) {
  array(sources, COORDINATION_GRAPH_LIMITS.registryGraphs, 'coordination_registry_invalid');
  const graphs = sources.map(compileCoordinationGraph)
    .sort((left, right) => compareCanonicalText(left.id, right.id));
  if (graphs.some((graph, index) => index && graph.id === graphs[index - 1].id)) {
    fail('coordination_graph_duplicate', 'A registry may select only one version of each graph.');
  }
  const registry = Object.freeze({ graphs: Object.freeze(graphs) });
  REGISTRIES.add(registry);
  return registry;
}

function assertRegistry(registry) {
  if (!registry || !REGISTRIES.has(registry)) {
    fail('coordination_registry_invalid', 'A compiled coordination registry is required.');
  }
}

export function coordinationGraphs(registry) { assertRegistry(registry); return registry.graphs; }
export function coordinationGraph(registry, id) {
  assertRegistry(registry);
  return registry.graphs.find((graph) => graph.id === id) || null;
}
