import crypto from 'node:crypto';

import {
  HASH_DOMAINS,
  canonicalBytes,
  compareCanonicalText,
  hashFrame,
} from './canonical.js';
import { assertDiscoveredContentPackage } from './discovery.js';
import { safeDiagnostic } from './diagnostics.js';
import {
  ECONOMY_ADAPTER_REGISTRY_VERSION,
  ECONOMY_ADAPTER_REGISTRY_OMR_AUTHORITY,
  PHASE2_LIMITS,
  compileEconomyAdapter,
  economyAdapterDescriptor,
  economyAdapterRegistryLock,
  inspectOmrAuthority,
  normalizeEconomyPackage,
  validateEconomyIrSafety,
} from './economy-profile.js';
import { parseAuthoredJson } from './json-source.js';

const COMPILER_VERSION = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,63})$/;
const SHA256 = /^[a-f0-9]{64}$/;
const ARTIFACT_TYPE = 'omerta.compiled-content-bundle';
const FORMAT_VERSION = 1;
const IR_VERSION = 1;
const MAX_ARTIFACT_BYTES = 64 * 1024 * 1024;
const COMPOSABLE_DEPENDENCY_LIFECYCLE_ERRORS = new Set([
  'economy_orphan_definition',
  'economy_missing_source',
  'economy_missing_use',
  'economy_missing_sink',
  'economy_entry_unreachable',
  'economy_unreachable_use',
  'economy_unreachable_sink',
  'economy_missing_durable_use',
]);
export class ContentCompileError extends Error {
  constructor(code, phase, message, { path = '$', details } = {}) {
    super(safeDiagnostic(message));
    this.name = 'ContentCompileError';
    this.code = code;
    this.phase = phase;
    this.path = safeDiagnostic(path, 512);
    if (details !== undefined) this.details = details;
  }
}

function raiseFor(phase) {
  return (code, message, path = '$', details) => {
    throw new ContentCompileError(code, phase, message, { path, details });
  };
}

const EFFECTIVE_RESOURCE_FIELDS = Object.freeze([
  ['packages', 'maxPackages', 'effectivePackages'],
  ['canonicalInputBytes', 'maxCorpusBytes', 'effectiveCanonicalInputBytes'],
  ['canonicalOutputBytes', 'maxCatalogBytes', 'effectiveCanonicalOutputBytes'],
  ['nodes', 'maxCatalogNodes', 'effectiveNodes'],
  ['edges', 'maxCatalogEdges', 'effectiveEdges'],
  ['references', 'maxCatalogReferences', 'effectiveReferences'],
]);

export function validateEffectiveCorpusBudget(
  counts,
  limits = PHASE2_LIMITS,
  raise = raiseFor('compile'),
) {
  if (!plainObject(counts)) {
    raise('content_schema_invalid', 'effective corpus resource counts must be an object', '$.resources');
  }
  const normalized = {};
  for (const [field, limitField, limitKind] of EFFECTIVE_RESOURCE_FIELDS) {
    const actual = counts[field];
    const expected = limits[limitField];
    if (!Number.isSafeInteger(actual) || actual < 0
        || !Number.isSafeInteger(expected) || expected < 0) {
      raise('content_schema_invalid', `effective corpus ${field} count is invalid`, '$.resources');
    }
    normalized[field] = actual;
    if (actual > expected) {
      raise('content_input_limit', `effective corpus exceeds the ${field} budget`, '$.resources', {
        limitKind, expected, actual,
      });
    }
  }
  return normalized;
}

function addEffectiveResources(totals, addition, raise) {
  for (const [field] of EFFECTIVE_RESOURCE_FIELDS) {
    totals[field] += addition[field] ?? 0;
    if (!Number.isSafeInteger(totals[field])) {
      raise('content_input_limit', `effective corpus ${field} count overflowed`, '$.resources', {
        limitKind: field, expected: Number.MAX_SAFE_INTEGER, actual: totals[field],
      });
    }
  }
  validateEffectiveCorpusBudget(totals, PHASE2_LIMITS, raise);
}

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function exactFields(value, fields, path, raise) {
  if (!plainObject(value)) raise('unsupported_content_feature', `${path} must be an object`, path);
  const keys = Object.keys(value).sort(compareCanonicalText);
  const expected = [...fields].sort(compareCanonicalText);
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) {
    raise('unsupported_content_feature', `${path} has an invalid field set`, path);
  }
}

function canonicalEqual(left, right) {
  try { return canonicalBytes(left).equals(canonicalBytes(right)); }
  catch { return false; }
}

function hashCanonical(value) {
  return crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
}

function cloneCanonical(value) {
  return parseAuthoredJson(canonicalBytes(value), {
    maxBytes: MAX_ARTIFACT_BYTES,
    maxDepth: PHASE2_LIMITS.maxJsonDepth,
    maxStringBytes: PHASE2_LIMITS.maxStringBytes,
    maxObjectMembers: 100_000,
    maxArrayItems: 100_000,
  });
}

function without(value, omitted) {
  return Object.fromEntries(Object.entries(value).filter(([key]) => !omitted.has(key)));
}

function definitionHash(input) {
  return hashFrame(HASH_DOMAINS.definition, [
    ['definitionFormatVersion', input.definitionFormatVersion],
    ['packageQualifiedLogicalId', input.packageQualifiedLogicalId],
    ['definitionVersion', input.definitionVersion],
    ['canonicalImmutableDefinition', input.canonicalImmutableDefinition],
  ]);
}

function sourceHash(input) {
  return hashFrame(HASH_DOMAINS.source, [['canonicalPublicAuthoredInputs', input]]);
}

function secretOverlayHash(input) {
  return hashFrame(HASH_DOMAINS.secretOverlay, [['canonicalPrivateOverlay', input]]);
}

function dependencyLockHash(input) {
  return hashFrame(HASH_DOMAINS.dependencyLock, [['canonicalResolvedDependencyClosure', input]]);
}

function irHash(input) {
  return hashFrame(HASH_DOMAINS.ir, [['canonicalCompiledIR', input]]);
}

function bundleHash(input) {
  return hashFrame(HASH_DOMAINS.bundle, [
    ['formatVersion', input.formatVersion],
    ['compilerVersion', input.compilerVersion],
    ['profile', input.profile],
    ['packageId', input.packageId],
    ['packageVersion', input.packageVersion],
    ['sourceHash', input.sourceHash],
    ['secretOverlayHash', input.secretOverlayHash],
    ['dependencyLockHash', input.dependencyLockHash],
    ['irHash', input.irHash],
  ]);
}

function publicManifestHash(input) {
  return hashFrame(HASH_DOMAINS.publicManifest, [['canonicalSafePublicManifest', input]]);
}

function edgeKey(edge) {
  return canonicalBytes({
    from: edge.from,
    kind: edge.kind,
    quantity: edge.quantity ?? null,
    to: edge.to,
  }).toString('utf8');
}

function compareDependency(left, right) {
  return compareCanonicalText(left.packageId, right.packageId)
    || left.version - right.version
    || compareCanonicalText(left.bundleHash, right.bundleHash);
}

function compareImport(left, right) {
  return compareCanonicalText(left.id, right.id)
    || compareCanonicalText(left.definitionHash, right.definitionHash)
    || compareCanonicalText(left.dependencyBundleHash, right.dependencyBundleHash);
}

function canonicalAuthoredSource(normalized) {
  const dequalifiedDefinitionId = (candidate) => {
    const prefix = `${normalized.packageId}::`;
    return typeof candidate === 'string' && candidate.startsWith(prefix)
      ? candidate.slice(prefix.length)
      : candidate;
  };
  const definitions = normalized.definitions.map((definition) => ({
    ...without(definition, new Set(['localId'])),
    id: definition.localId,
  })).sort((left, right) => compareCanonicalText(left.id, right.id));
  const nodes = normalized.nodes.map((node) => {
    const authored = { id: node.localId, kind: node.kind };
    const adapterDefinitionId = node.adapter?.args?.definitionId;
    if (node.adapter !== undefined) {
      authored.adapter = {
        ...node.adapter,
        ...(adapterDefinitionId === undefined ? {} : {
          args: {
            ...node.adapter.args,
            definitionId: dequalifiedDefinitionId(adapterDefinitionId),
          },
        }),
      };
    }
    if (node.refs.length > 0) {
      authored.refs = node.refs.map((ref) => (
        ref.startsWith(`${normalized.packageId}::`) ? ref.slice(normalized.packageId.length + 2) : ref
      ));
    }
    if (node.public) authored.public = true;
    if (node.metadata !== undefined) authored.metadata = node.metadata;
    return authored;
  }).sort((left, right) => compareCanonicalText(left.id, right.id));
  const edges = normalized.edges.map((edge) => ({
    ...edge,
    from: edge.from.startsWith(`${normalized.packageId}::`)
      ? edge.from.slice(normalized.packageId.length + 2) : edge.from,
    to: edge.to.startsWith(`${normalized.packageId}::`)
      ? edge.to.slice(normalized.packageId.length + 2) : edge.to,
  })).sort((left, right) => compareCanonicalText(edgeKey(left), edgeKey(right)));
  const source = {
    packageId: normalized.packageId,
    version: normalized.version,
    kind: normalized.authoredKind,
    profile: normalized.profile,
  };
  if (definitions.length > 0) source.definitions = definitions;
  if (nodes.length > 0) source.nodes = nodes;
  if (edges.length > 0) source.edges = edges;
  if (normalized.exports.length > 0) {
    source.exports = normalized.exports.map((id) => id.slice(normalized.packageId.length + 2));
  }
  if (normalized.dependencies.length > 0) source.dependencies = normalized.dependencies;
  if (normalized.imports.length > 0) source.imports = normalized.imports;
  if (normalized.entrypoint !== undefined) {
    source.entrypoint = normalized.entrypoint.slice(normalized.packageId.length + 2);
  }
  if (normalized.metadata !== undefined) source.metadata = normalized.metadata;
  return source;
}

function compiledGraphNode(node) {
  const compiled = without(node, new Set(['localId']));
  if (compiled.adapter !== undefined) compiled.adapter = compileEconomyAdapter(compiled.adapter);
  compiled.nodeClass = 'graph';
  return compiled;
}

function dependencyEconomyIndex(bundle) {
  const definitions = new Map(bundle.ir.nodes
    .filter((node) => node.nodeClass === 'definition')
    .map((node) => [node.id, node]));
  const errors = new Map();
  for (const error of bundle.reports.economy.errors) {
    if (typeof error.definitionId !== 'string') continue;
    const entries = errors.get(error.definitionId) ?? [];
    entries.push(canonicalClone(error));
    errors.set(error.definitionId, entries);
  }
  return { definitions, errors };
}

function importedDefinitionNode(imported, dependencyBundle, index, raise) {
  const definition = index.definitions.get(imported.id);
  if (!definition || definition.definitionHash !== imported.definitionHash) {
    raise('content_dependency_drift', 'imported definition snapshot is unavailable', '$.imports');
  }
  const kind = definition.kind;
  return {
    id: imported.id,
    nodeClass: 'import',
    kind,
    definitionVersion: definition.definitionVersion,
    definitionHash: imported.definitionHash,
    semantic: canonicalClone(definition.semantic),
    dependencyBundleHash: imported.dependencyBundleHash,
    dependencyEconomyErrors: canonicalClone(index.errors.get(imported.id) ?? []),
  };
}

function expectedIrFromNormalizedSource(normalized, raise, importedDefinitionById = new Map()) {
  const directDependencyByHash = new Map();
  for (const dependency of normalized.dependencies) {
    if (directDependencyByHash.has(dependency.bundleHash)) {
      raise('content_dependency_unresolved', 'embedded source contains a duplicate direct dependency', '$.canonicalHashInputs.source');
    }
    directDependencyByHash.set(dependency.bundleHash, dependency);
  }
  for (const imported of normalized.imports) {
    const dependency = directDependencyByHash.get(imported.dependencyBundleHash);
    if (!dependency || !imported.id.startsWith(`${dependency.packageId}::`)) {
      raise(
        'content_dependency_unresolved',
        'embedded source import does not belong to exactly one declared dependency',
        '$.canonicalHashInputs.source',
      );
    }
  }
  const nodes = [];
  for (const definition of normalized.definitions) {
    const canonicalImmutableDefinition = without(definition, new Set(['id', 'localId', 'definitionVersion']));
    const input = {
      definitionFormatVersion: FORMAT_VERSION,
      packageQualifiedLogicalId: definition.id,
      definitionVersion: definition.definitionVersion,
      canonicalImmutableDefinition,
    };
    nodes.push({
      id: definition.id,
      nodeClass: 'definition',
      kind: definition.kind,
      definitionVersion: definition.definitionVersion,
      definitionHash: definitionHash(input),
      semantic: canonicalImmutableDefinition,
    });
  }
  for (const node of normalized.nodes) {
    nodes.push(compiledGraphNode(node));
  }
  for (const imported of normalized.imports) {
    const snapshot = importedDefinitionById.get(imported.id);
    if (!snapshot || snapshot.nodeClass !== 'import'
        || snapshot.dependencyBundleHash !== imported.dependencyBundleHash
        || snapshot.definitionHash !== imported.definitionHash
        || !Number.isSafeInteger(snapshot.definitionVersion) || snapshot.definitionVersion <= 0
        || !plainObject(snapshot.semantic)
        || !Array.isArray(snapshot.dependencyEconomyErrors)) {
      raise('content_artifact_mismatch', 'compiled import snapshot is incomplete', '$.ir.imports');
    }
    const expectedDefinitionHash = definitionHash({
      definitionFormatVersion: FORMAT_VERSION,
      packageQualifiedLogicalId: snapshot.id,
      definitionVersion: snapshot.definitionVersion,
      canonicalImmutableDefinition: snapshot.semantic,
    });
    if (expectedDefinitionHash !== snapshot.definitionHash) {
      raise('content_hash_mismatch', 'compiled import snapshot does not match its definition hash', '$.ir.imports');
    }
    nodes.push(without(snapshot, new Set(['ordinal'])));
  }
  nodes.sort((left, right) => compareCanonicalText(left.id, right.id));
  for (let index = 0; index < nodes.length; index += 1) {
    if (index > 0 && nodes[index].id === nodes[index - 1].id) {
      raise('content_identity_conflict', 'embedded source contains a duplicate qualified ID', '$.canonicalHashInputs.source');
    }
    nodes[index].ordinal = index;
  }
  const knownIds = new Set(nodes.map((node) => node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  const importedIds = new Set(normalized.imports.map((entry) => entry.id));
  for (const node of nodes) {
    for (const ref of node.refs ?? []) {
      if (!knownIds.has(ref)) {
        raise('content_dependency_unresolved', 'embedded source contains an unresolved node reference', '$.canonicalHashInputs.source');
      }
    }
    const definitionId = node.adapter?.args?.definitionId;
    if (definitionId !== undefined && !knownIds.has(definitionId)) {
      raise('content_dependency_unresolved', 'embedded source contains an unresolved adapter reference', '$.canonicalHashInputs.source');
    }
  }
  for (const exported of normalized.exports) {
    const node = nodeById.get(exported);
    if (!node || node.nodeClass !== 'definition' || importedIds.has(exported)
        || !Number.isSafeInteger(node.definitionVersion) || node.definitionVersion <= 0
        || typeof node.definitionHash !== 'string' || !SHA256.test(node.definitionHash)) {
      raise('content_dependency_unresolved', 'embedded source export is not an owned exact definition', '$.canonicalHashInputs.source');
    }
  }
  if (normalized.entrypoint !== undefined
      && !nodes.some((node) => node.id === normalized.entrypoint && node.nodeClass === 'graph')) {
    raise('content_dependency_unresolved', 'embedded source entrypoint is unresolved', '$.canonicalHashInputs.source');
  }
  const edges = normalized.edges.map((edge) => ({ ...edge })).sort((left, right) => (
    compareCanonicalText(edgeKey(left), edgeKey(right))
  ));
  for (let index = 0; index < edges.length; index += 1) {
    if (index > 0 && edgeKey(edges[index]) === edgeKey(edges[index - 1])) {
      raise('content_identity_conflict', 'embedded source contains a duplicate canonical edge', '$.canonicalHashInputs.source');
    }
    edges[index].ordinal = index;
  }
  const ir = {
    formatVersion: FORMAT_VERSION,
    irVersion: IR_VERSION,
    profile: normalized.profile,
    packageId: normalized.packageId,
    packageVersion: normalized.version,
    kind: normalized.kind,
    adapterRegistryVersion: ECONOMY_ADAPTER_REGISTRY_VERSION,
    adapterRegistry: economyAdapterRegistryLock(normalized.nodes),
    nodes,
    edges,
    imports: normalized.imports,
    exports: normalized.exports,
    indexes: buildIndexes(nodes, edges, raise),
  };
  if (normalized.entrypoint !== undefined) ir.entrypoint = normalized.entrypoint;
  return ir;
}

function validatePackageDependencyGraph(packages, raise) {
  const byId = new Map(packages.map((entry) => [entry.normalized.packageId, entry]));
  if (byId.size !== packages.length) {
    raise('content_identity_conflict', 'duplicate package ID reached corpus compilation', '$.packages');
  }
  const indegree = new Map([...byId.keys()].map((id) => [id, 0]));
  const consumers = new Map([...byId.keys()].map((id) => [id, []]));
  for (const entry of packages) {
    const seen = new Map();
    for (const dependency of entry.normalized.dependencies) {
      const existing = seen.get(dependency.packageId);
      if (existing) {
        raise(
          canonicalEqual(existing, dependency) ? 'content_dependency_unresolved' : 'content_dependency_drift',
          canonicalEqual(existing, dependency)
            ? 'duplicate dependency declaration'
            : 'one logical dependency has conflicting exact declarations',
          '$.dependencies',
          { reason: canonicalEqual(existing, dependency) ? 'duplicate' : 'ambiguous' },
        );
      }
      seen.set(dependency.packageId, dependency);
      if (byId.has(dependency.packageId)) {
        indegree.set(entry.normalized.packageId, indegree.get(entry.normalized.packageId) + 1);
        consumers.get(dependency.packageId).push(entry.normalized.packageId);
      }
    }
    const importIds = new Set();
    for (const imported of entry.normalized.imports) {
      if (importIds.has(imported.id)) {
        raise('content_dependency_unresolved', 'duplicate import declaration', '$.imports', {
          reason: 'duplicate',
        });
      }
      importIds.add(imported.id);
    }
  }
  for (const values of consumers.values()) values.sort(compareCanonicalText);
  const ready = [...indegree.entries()].filter(([, count]) => count === 0)
    .map(([id]) => id).sort(compareCanonicalText);
  const order = [];
  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    for (const consumer of consumers.get(id)) {
      const next = indegree.get(consumer) - 1;
      indegree.set(consumer, next);
      if (next === 0) {
        ready.push(consumer);
        ready.sort(compareCanonicalText);
      }
    }
  }
  if (order.length !== packages.length) {
    const remaining = [...indegree.entries()].filter(([, count]) => count > 0)
      .map(([id]) => id).sort(compareCanonicalText);
    raise('content_dependency_cycle', 'package dependency cycle detected', '$.dependencies', {
      witness: remaining.slice(0, PHASE2_LIMITS.maxWitnessIds),
      truncated: remaining.length > PHASE2_LIMITS.maxWitnessIds,
      total: remaining.length,
    });
  }
  return order;
}

function buildIndexes(nodes, edges, raise) {
  const ordinalById = new Map(nodes.map((node) => [node.id, node.ordinal]));
  const outgoing = Array.from({ length: nodes.length }, () => []);
  const incoming = Array.from({ length: nodes.length }, () => []);
  for (const edge of edges) {
    const from = ordinalById.get(edge.from);
    const to = ordinalById.get(edge.to);
    if (from === undefined || to === undefined) {
      raise('content_dependency_unresolved', 'edge endpoint is not resolved into the compiled IR', '$.ir.edges');
    }
    outgoing[from].push(to);
    incoming[to].push(from);
  }
  for (const list of outgoing) list.sort((left, right) => left - right);
  for (const list of incoming) list.sort((left, right) => left - right);
  return { outgoing, incoming };
}

function analyzeGraph(nodes, indexes, limits, raise) {
  const visited = new Uint8Array(nodes.length);
  const finish = [];
  for (let root = 0; root < nodes.length; root += 1) {
    if (visited[root]) continue;
    visited[root] = 1;
    const stack = [{ node: root, cursor: 0 }];
    while (stack.length > 0) {
      const frame = stack.at(-1);
      const targets = indexes.outgoing[frame.node];
      if (frame.cursor < targets.length) {
        const target = targets[frame.cursor];
        frame.cursor += 1;
        if (!visited[target]) {
          visited[target] = 1;
          stack.push({ node: target, cursor: 0 });
        }
      } else {
        finish.push(frame.node);
        stack.pop();
      }
    }
  }

  const assigned = new Uint8Array(nodes.length);
  const sccByOrdinal = new Uint32Array(nodes.length);
  const sccMembers = [];
  const sccSizes = [];
  let sccCount = 0;
  let maximumSccSize = 0;
  let largestSccWitness = [];
  for (let finishIndex = finish.length - 1; finishIndex >= 0; finishIndex -= 1) {
    const root = finish[finishIndex];
    if (assigned[root]) continue;
    sccCount += 1;
    assigned[root] = 1;
    const pending = [root];
    const witness = [];
    const members = [];
    let size = 0;
    while (pending.length > 0) {
      const current = pending.pop();
      size += 1;
      sccByOrdinal[current] = sccCount;
      members.push(current);
      if (witness.length < limits.maxWitnessIds) witness.push(nodes[current].id);
      if (size > limits.maxExactComponentVertices) {
        witness.sort(compareCanonicalText);
        raise('content_input_limit', 'exact-analysis component exceeds the vertex limit', '$.ir', {
          limitKind: 'component', expected: limits.maxExactComponentVertices, actual: size,
          witness, truncated: true,
        });
      }
      const predecessors = indexes.incoming[current];
      for (let index = predecessors.length - 1; index >= 0; index -= 1) {
        const predecessor = predecessors[index];
        if (!assigned[predecessor]) {
          assigned[predecessor] = 1;
          pending.push(predecessor);
        }
      }
    }
    sccMembers.push(members);
    sccSizes.push(size);
    witness.sort(compareCanonicalText);
    if (size > maximumSccSize
        || (size === maximumSccSize
          && compareCanonicalText(witness[0] ?? '', largestSccWitness[0] ?? '') < 0)) {
      maximumSccSize = size;
      largestSccWitness = witness;
    }
  }

  const connected = new Uint8Array(nodes.length);
  let componentCount = 0;
  for (let root = 0; root < nodes.length; root += 1) {
    if (connected[root]) continue;
    componentCount += 1;
    connected[root] = 1;
    const pending = [root];
    while (pending.length > 0) {
      const current = pending.pop();
      for (const adjacent of [...indexes.outgoing[current], ...indexes.incoming[current]]) {
        if (!connected[adjacent]) {
          connected[adjacent] = 1;
          pending.push(adjacent);
        }
      }
    }
  }
  return {
    summary: {
      componentCount,
      sccCount,
      maximumSccSize,
      largestSccWitness,
      maximumWitnessIds: largestSccWitness.length,
    },
    sccByOrdinal,
    sccMembers,
    sccSizes,
  };
}

function deriveEconomyTopology(ir, raise) {
  const nodeById = new Map(ir.nodes.map((node) => [node.id, node]));
  const authorities = ir.nodes.filter((node) => node.adapter).map((node) => {
    const descriptor = economyAdapterDescriptor(node.adapter.kind);
    if (!descriptor) {
      raise('content_schema_invalid', 'compiled adapter is outside the closed registry', '$.ir.nodes');
    }
    return { node, descriptor };
  });
  const valuePaths = authorities.filter(({ descriptor }) => descriptor.valueClass !== 'none')
    .map(({ node, descriptor }) => ({
      nodeId: node.id,
      nodeKind: node.kind,
      adapterKind: node.adapter.kind,
      transactionClass: descriptor.transactionClass,
      lockClasses: [...descriptor.lockClasses],
      replayPolicy: descriptor.replayPolicy,
      visibilityPolicy: descriptor.visibilityPolicy,
      valueClass: descriptor.valueClass,
      reportClass: descriptor.reportClass,
      args: canonicalClone(node.adapter.args),
    }));
  const valueEdges = ir.edges.filter((edge) => ['produces', 'consumes', 'sinks'].includes(edge.kind));
  const valueEdgesByPath = new Map();
  for (const edge of ir.edges) {
    const key = `${edge.kind}\0${edge.from}\0${edge.to}`;
    const matches = valueEdgesByPath.get(key) ?? [];
    matches.push(edge);
    valueEdgesByPath.set(key, matches);
  }
  const matchedEdges = new Set();
  const touchedDefinitions = new Set();
  for (const { node, descriptor } of authorities) {
    const definitionId = node.adapter.args.definitionId;
    if (definitionId === undefined) continue;
    const definition = nodeById.get(definitionId);
    if (!definition || !['definition', 'import'].includes(definition.nodeClass)) {
      raise('content_dependency_unresolved', 'value adapter must reference an exact definition', '$.ir.nodes');
    }
    if (!node.refs.includes(definitionId)) {
      raise('content_schema_invalid', 'value adapter definition must be declared in node refs', '$.ir.nodes');
    }
    let edgeKind;
    let from;
    let to;
    if (descriptor.valueClass === 'create') {
      edgeKind = 'produces';
      from = node.id;
      to = definitionId;
    } else if (descriptor.valueClass === 'consume') {
      edgeKind = 'consumes';
      from = node.id;
      to = definitionId;
    } else if (descriptor.valueClass === 'destroy') {
      edgeKind = 'sinks';
      from = definitionId;
      to = node.id;
    } else if (descriptor.valueClass === 'durable_use') {
      edgeKind = 'requires';
      from = node.id;
      to = definitionId;
    } else {
      raise('content_schema_invalid', 'definition-bearing adapter has an unclassified value path', '$.ir.nodes');
    }
    const matches = valueEdgesByPath.get(`${edgeKind}\0${from}\0${to}`) ?? [];
    if (matches.length !== 1) {
      raise('content_schema_invalid', 'value adapter requires exactly one matching value edge', '$.ir.edges');
    }
    const [edge] = matches;
    if (descriptor.valueClass !== 'durable_use' && edge.quantity === undefined) {
      raise('content_schema_invalid', 'value edge requires a bounded quantity', '$.ir.edges');
    }
    if (descriptor.valueClass === 'durable_use' && edge.quantity !== undefined) {
      raise('content_schema_invalid', 'bounded durable-use edges cannot move quantity', '$.ir.edges');
    }
    if (node.adapter.args.quantity !== undefined && edge.quantity !== node.adapter.args.quantity) {
      raise('content_schema_invalid', 'value edge quantity disagrees with its adapter', '$.ir.edges');
    }
    if (node.adapter.args.maxUnitsPerEpoch !== undefined
        && edge.quantity > node.adapter.args.maxUnitsPerEpoch) {
      raise('content_schema_invalid', 'source edge quantity exceeds its adapter epoch maximum', '$.ir.edges');
    }
    matchedEdges.add(edge.ordinal);
    touchedDefinitions.add(definitionId);
  }
  for (const edge of valueEdges) {
    if (!matchedEdges.has(edge.ordinal)) {
      raise('content_schema_invalid', 'value edge has no matching classified adapter', '$.ir.edges');
    }
  }
  return {
    authorities,
    valuePaths,
    edgeValuePaths: ir.edges.filter((edge) => matchedEdges.has(edge.ordinal))
      .map((edge) => canonicalClone(edge)),
    touchedDefinitions,
  };
}

function makeReports(ir, graphAnalysis, packageMetadata, raise) {
  const analysis = graphAnalysis.summary;
  const nodeById = new Map(ir.nodes.map((node) => [node.id, node]));
  const definitionNodes = ir.nodes.filter((node) => ['definition', 'import'].includes(node.nodeClass));
  const definitions = definitionNodes.map((node) => node.id);
  const economicDefinitions = definitionNodes.filter((node) => ['material', 'item'].includes(node.kind));
  const {
    authorities,
    valuePaths,
    edgeValuePaths,
    touchedDefinitions,
  } = deriveEconomyTopology(ir, raise);
  const edgeValuePathByKey = new Map(edgeValuePaths.map((edge) => [
    `${edge.kind}\0${edge.from}\0${edge.to}`,
    edge,
  ]));
  const sources = authorities.filter(({ descriptor }) => descriptor.reportClass === 'source')
    .map(({ node }) => node.id);
  const sinks = authorities.filter(({ descriptor }) => descriptor.reportClass === 'sink')
    .map(({ node }) => node.id);
  const uses = authorities.filter(({ descriptor }) => descriptor.reportClass === 'use')
    .map(({ node }) => node.id);
  const cashAdapters = authorities.filter(({ descriptor }) => descriptor.reportClass === 'cash')
    .map(({ node, descriptor }) => ({
      id: node.id,
      kind: node.adapter.kind,
      transactionClass: descriptor.transactionClass,
      valueClass: descriptor.valueClass,
      classification: node.adapter.cash.classification,
      grossCashEmission: node.adapter.cash.grossCashEmission,
      netCashDelta: node.adapter.cash.netCashDelta,
    }));
  const omrInspection = inspectOmrAuthority(ir);
  const orphans = economicDefinitions.map((node) => node.id)
    .filter((id) => !touchedDefinitions.has(id));
  const authoritiesByDefinition = new Map();
  for (const { node, descriptor } of authorities) {
    const definitionId = node.adapter.args.definitionId;
    if (definitionId === undefined) continue;
    const entry = authoritiesByDefinition.get(definitionId) ?? {
      sources: [], uses: [], sinks: [],
    };
    if (descriptor.reportClass === 'source') entry.sources.push(node.id);
    else if (descriptor.reportClass === 'use') entry.uses.push(node.id);
    else if (descriptor.reportClass === 'sink') entry.sinks.push(node.id);
    authoritiesByDefinition.set(definitionId, entry);
  }
  const controlOutgoing = Array.from({ length: ir.nodes.length }, () => []);
  const valueEdgeKinds = new Set(['produces', 'consumes', 'sinks']);
  for (const edge of ir.edges) {
    if (valueEdgeKinds.has(edge.kind)) continue;
    const from = nodeById.get(edge.from)?.ordinal;
    const to = nodeById.get(edge.to)?.ordinal;
    if (from !== undefined && to !== undefined) controlOutgoing[from].push(to);
  }
  const visited = new Uint32Array(ir.nodes.length);
  let visitGeneration = 0;
  let reachabilitySteps = 0;
  const hasControlPath = (fromIds, toIds) => {
    if (fromIds.length === 0 || toIds.length === 0) return false;
    visitGeneration += 1;
    if (visitGeneration === 0xffff_ffff) {
      visited.fill(0);
      visitGeneration = 1;
    }
    const targets = new Set(toIds.map((id) => nodeById.get(id).ordinal));
    const pending = [];
    for (const id of fromIds) {
      const ordinal = nodeById.get(id).ordinal;
      if (targets.has(ordinal)) return true;
      if (visited[ordinal] !== visitGeneration) {
        visited[ordinal] = visitGeneration;
        pending.push(ordinal);
      }
    }
    while (pending.length > 0) {
      const current = pending.pop();
      reachabilitySteps += 1;
      if (reachabilitySteps > PHASE2_LIMITS.maxEconomyReachabilitySteps) {
        raise('content_input_limit', 'economy reachability analysis exceeds the work limit', '$.reports.economy', {
          limitKind: 'economyReachabilitySteps',
          expected: PHASE2_LIMITS.maxEconomyReachabilitySteps,
          actual: reachabilitySteps,
        });
      }
      for (const adjacent of controlOutgoing[current]) {
        reachabilitySteps += 1;
        if (reachabilitySteps > PHASE2_LIMITS.maxEconomyReachabilitySteps) {
          raise('content_input_limit', 'economy reachability analysis exceeds the work limit', '$.reports.economy', {
            limitKind: 'economyReachabilitySteps',
            expected: PHASE2_LIMITS.maxEconomyReachabilitySteps,
            actual: reachabilitySteps,
          });
        }
        if (targets.has(adjacent)) return true;
        if (visited[adjacent] !== visitGeneration) {
          visited[adjacent] = visitGeneration;
          pending.push(adjacent);
        }
      }
    }
    return false;
  };
  const economyErrors = [];
  const authorityDetails = (ids, definitionId) => ids.map((id) => {
    const node = nodeById.get(id);
    const descriptor = economyAdapterDescriptor(node.adapter.kind);
    const edgeKind = descriptor.valueClass === 'create'
      ? 'produces'
      : descriptor.valueClass === 'consume'
        ? 'consumes'
        : descriptor.valueClass === 'destroy' ? 'sinks' : 'requires';
    const edge = edgeValuePathByKey.get(edgeKind === 'sinks'
      ? `${edgeKind}\0${definitionId}\0${id}`
      : `${edgeKind}\0${id}\0${definitionId}`);
    return {
      nodeId: id,
      adapterKind: node.adapter.kind,
      transactionClass: descriptor.transactionClass,
      lockClasses: [...descriptor.lockClasses],
      replayPolicy: descriptor.replayPolicy,
      visibilityPolicy: descriptor.visibilityPolicy,
      issuancePolicy: descriptor.issuancePolicy,
      sourceCapIdentity: descriptor.sourceCapIdentity,
      sourceCapId: descriptor.issuancePolicy === 'none' ? null : node.id,
      usagePolicy: descriptor.usagePolicy,
      args: canonicalClone(node.adapter.args),
      edgeQuantity: edge.quantity ?? null,
    };
  });
  const definitionLifecycle = economicDefinitions.map((definition) => {
    const definitionKindName = definition.kind;
    const paths = authoritiesByDefinition.get(definition.id) ?? {
      sources: [], uses: [], sinks: [],
    };
    const sourcesForDefinition = [...paths.sources].sort(compareCanonicalText);
    const usesForDefinition = [...paths.uses].sort(compareCanonicalText);
    const sinksForDefinition = [...paths.sinks].sort(compareCanonicalText);
    const sourceToUse = hasControlPath(sourcesForDefinition, usesForDefinition);
    const useToSink = hasControlPath(usesForDefinition, sinksForDefinition);
    const entryReachable = ir.kind !== 'experience'
      || hasControlPath([ir.entrypoint], sourcesForDefinition);
    const sourceAuthorities = authorityDetails(sourcesForDefinition, definition.id);
    const useAuthorities = authorityDetails(usesForDefinition, definition.id);
    const sinkAuthorities = authorityDetails(sinksForDefinition, definition.id);
    const boundedDurableUses = useAuthorities.filter((entry) => (
      entry.usagePolicy === 'bounded_durable'
        && entry.args.maximumConcurrentUses <= definition.semantic.maximumLotQuantity
    ));
    const durableAlternative = ['finite', 'durable'].includes(definition.semantic.conservationClass)
      && boundedDurableUses.length > 0;
    const sinkDeclared = sinksForDefinition.length > 0 || durableAlternative;
    const sinkSatisfied = sinksForDefinition.length > 0 ? useToSink : durableAlternative;
    const complete = sourcesForDefinition.length > 0
      && usesForDefinition.length > 0
      && entryReachable
      && sourceToUse
      && sinkSatisfied;
    if (sourcesForDefinition.length + usesForDefinition.length + sinksForDefinition.length === 0) {
      economyErrors.push({ code: 'economy_orphan_definition', definitionId: definition.id });
    }
    if (sourcesForDefinition.length === 0) {
      economyErrors.push({ code: 'economy_missing_source', definitionId: definition.id });
    }
    if (usesForDefinition.length === 0) {
      economyErrors.push({ code: 'economy_missing_use', definitionId: definition.id });
    }
    if (!sinkDeclared) {
      economyErrors.push({ code: 'economy_missing_sink', definitionId: definition.id });
    }
    if (!entryReachable && sourcesForDefinition.length > 0) {
      economyErrors.push({ code: 'economy_entry_unreachable', definitionId: definition.id });
    }
    if (sourcesForDefinition.length > 0 && usesForDefinition.length > 0 && !sourceToUse) {
      economyErrors.push({ code: 'economy_unreachable_use', definitionId: definition.id });
    }
    if (usesForDefinition.length > 0 && sinksForDefinition.length > 0 && !useToSink) {
      economyErrors.push({ code: 'economy_unreachable_sink', definitionId: definition.id });
    }
    const conservationClass = definition.semantic.conservationClass;
    if (['finite', 'durable'].includes(conservationClass)
        && sourceAuthorities.some((entry) => entry.issuancePolicy === 'periodic_per_owner_scope')) {
      economyErrors.push({
        code: conservationClass === 'finite'
          ? 'economy_finite_recurring_source' : 'economy_durable_recurring_source',
        definitionId: definition.id,
      });
    }
    if (sourceAuthorities.some((entry) => entry.issuancePolicy === 'one_time_per_owner_scope'
        && entry.edgeQuantity > definition.semantic.maximumLotQuantity)) {
      economyErrors.push({ code: 'economy_source_cap_exceeded', definitionId: definition.id });
    }
    if (conservationClass === 'durable' && boundedDurableUses.length === 0) {
      economyErrors.push({ code: 'economy_missing_durable_use', definitionId: definition.id });
    }
    if (useAuthorities.some((entry) => entry.usagePolicy === 'bounded_durable'
        && entry.args.maximumConcurrentUses > definition.semantic.maximumLotQuantity)) {
      economyErrors.push({ code: 'economy_durable_use_unbounded', definitionId: definition.id });
    }
    for (const dependencyError of definition.dependencyEconomyErrors ?? []) {
      const inheritedCode = dependencyError.code === 'economy_dependency_error'
        ? dependencyError.dependencyErrorCode
        : dependencyError.code;
      // Libraries report package-local lifecycle gaps so operators can inspect
      // them, but those gaps are not immutable defects of an exported
      // definition. The consumer's effective graph has just recomputed every
      // corresponding obligation above. Only intrinsic dependency failures
      // survive composition.
      if (COMPOSABLE_DEPENDENCY_LIFECYCLE_ERRORS.has(inheritedCode)) continue;
      economyErrors.push({
        code: 'economy_dependency_error',
        definitionId: definition.id,
        dependencyBundleHash: definition.dependencyBundleHash,
        dependencyErrorCode: dependencyError.code,
      });
    }
    return {
      definitionId: definition.id,
      definitionHash: definition.definitionHash,
      definitionKind: definitionKindName,
      definitionKindName,
      family: definition.semantic.family,
      conservationClass: definition.semantic.conservationClass,
      ownerScopes: canonicalClone(definition.semantic.ownerScopes),
      tradePolicy: canonicalClone(definition.semantic.tradePolicy),
      qualityMode: definition.semantic.qualityMode,
      maximumLotQuantity: definition.semantic.maximumLotQuantity,
      origin: definition.nodeClass === 'import' ? 'import' : 'local',
      dependencyBundleHash: definition.dependencyBundleHash ?? null,
      sources: sourcesForDefinition,
      uses: usesForDefinition,
      sinks: sinksForDefinition,
      sourceAuthorities,
      useAuthorities,
      sinkAuthorities,
      conservationEquation: {
        createdEdgeUnits: sourceAuthorities.reduce((sum, entry) => sum + (entry.edgeQuantity ?? 0), 0),
        consumedEdgeUnits: useAuthorities.reduce((sum, entry) => sum + (entry.edgeQuantity ?? 0), 0),
        destroyedEdgeUnits: sinkAuthorities.reduce((sum, entry) => sum + (entry.edgeQuantity ?? 0), 0),
        boundedDurableUses: boundedDurableUses.length,
      },
      entryReachable,
      sourceToUse,
      useToSink,
      complete,
    };
  });
  let operationalCycleSteps = 0;
  const chargeOperationalCycleSteps = (count = 1) => {
    operationalCycleSteps += count;
    if (operationalCycleSteps > PHASE2_LIMITS.maxEconomyReachabilitySteps) {
      raise('content_input_limit', 'economy operational-cycle analysis exceeds the work limit', '$.reports.economy', {
        limitKind: 'economyOperationalCycleSteps',
        expected: PHASE2_LIMITS.maxEconomyReachabilitySteps,
        actual: operationalCycleSteps,
      });
    }
  };
  const operationalReachable = new Uint8Array(ir.nodes.length);
  if (ir.kind === 'experience') {
    const entryOrdinal = nodeById.get(ir.entrypoint).ordinal;
    const pending = [entryOrdinal];
    operationalReachable[entryOrdinal] = 1;
    while (pending.length > 0) {
      const current = pending.pop();
      chargeOperationalCycleSteps();
      for (const adjacent of controlOutgoing[current]) {
        chargeOperationalCycleSteps();
        if (!operationalReachable[adjacent]) {
          operationalReachable[adjacent] = 1;
          pending.push(adjacent);
        }
      }
    }
  } else {
    operationalReachable.fill(1);
  }
  const profitableCycle = (lifecycle, scc) => {
    const memberOrdinals = graphAnalysis.sccMembers[scc - 1]
      .filter((ordinal) => operationalReachable[ordinal]);
    const localByOrdinal = new Map(memberOrdinals.map((ordinal, index) => [ordinal, index]));
    const authorityByOrdinal = new Map();
    const weights = new Array(memberOrdinals.length).fill(0);
    for (const authority of [
      ...lifecycle.sourceAuthorities,
      ...lifecycle.useAuthorities,
      ...lifecycle.sinkAuthorities,
    ]) {
      const ordinal = nodeById.get(authority.nodeId).ordinal;
      const local = localByOrdinal.get(ordinal);
      if (local === undefined) continue;
      authorityByOrdinal.set(ordinal, authority);
      if (authority.issuancePolicy === 'periodic_per_owner_scope') {
        weights[local] += authority.edgeQuantity ?? 0;
      } else if (authority.usagePolicy === 'consuming'
          || authority.usagePolicy === 'destructive_sink') {
        weights[local] -= authority.edgeQuantity ?? 0;
      }
    }
    const edges = [];
    for (let from = 0; from < memberOrdinals.length; from += 1) {
      for (const adjacent of controlOutgoing[memberOrdinals[from]]) {
        const to = localByOrdinal.get(adjacent);
        if (to !== undefined) edges.push([from, to]);
      }
    }
    if (edges.length === 0) return null;
    const distances = new Array(memberOrdinals.length).fill(0);
    const predecessor = new Int32Array(memberOrdinals.length);
    predecessor.fill(-1);
    let updated = -1;
    for (let pass = 0; pass < memberOrdinals.length; pass += 1) {
      updated = -1;
      for (const [from, to] of edges) {
        chargeOperationalCycleSteps();
        const candidate = distances[from] + weights[to];
        if (candidate > distances[to]) {
          distances[to] = candidate;
          predecessor[to] = from;
          updated = to;
        }
      }
      if (updated === -1) return null;
    }
    let cursor = updated;
    for (let step = 0; step < memberOrdinals.length; step += 1) {
      cursor = predecessor[cursor];
      if (cursor < 0) return null;
    }
    const path = [];
    const positionByLocal = new Map();
    while (!positionByLocal.has(cursor) && path.length <= memberOrdinals.length) {
      positionByLocal.set(cursor, path.length);
      path.push(cursor);
      cursor = predecessor[cursor];
      if (cursor < 0) return null;
    }
    const cycleLocals = path.slice(positionByLocal.get(cursor));
    const cycleOrdinals = cycleLocals.map((local) => memberOrdinals[local]);
    const cycleAuthorities = cycleOrdinals
      .map((ordinal) => authorityByOrdinal.get(ordinal))
      .filter(Boolean);
    let createdEdgeUnits = 0;
    let consumedEdgeUnits = 0;
    let destroyedEdgeUnits = 0;
    let oneTimeSourceCaps = 0;
    const cadenceCosts = new Set();
    for (const authority of cycleAuthorities) {
      if (authority.issuancePolicy === 'periodic_per_owner_scope') {
        createdEdgeUnits += authority.edgeQuantity ?? 0;
        cadenceCosts.add(authority.args.epoch);
      } else if (authority.issuancePolicy === 'one_time_per_owner_scope') {
        oneTimeSourceCaps += 1;
      } else if (authority.usagePolicy === 'consuming') {
        consumedEdgeUnits += authority.edgeQuantity ?? 0;
      } else if (authority.usagePolicy === 'destructive_sink') {
        destroyedEdgeUnits += authority.edgeQuantity ?? 0;
      }
    }
    const quantityDelta = createdEdgeUnits - consumedEdgeUnits - destroyedEdgeUnits;
    if (createdEdgeUnits <= 0 || quantityDelta <= 0) return null;
    const cycleSet = new Set(cycleOrdinals);
    const skippedAuthorityNodeIds = [
      ...lifecycle.sourceAuthorities,
      ...lifecycle.useAuthorities,
      ...lifecycle.sinkAuthorities,
    ].filter((authority) => {
      const ordinal = nodeById.get(authority.nodeId).ordinal;
      return graphAnalysis.sccByOrdinal[ordinal] === scc && !cycleSet.has(ordinal);
    }).map((authority) => authority.nodeId).sort(compareCanonicalText);
    return {
      definitionId: lifecycle.definitionId,
      witness: cycleOrdinals.map((ordinal) => ir.nodes[ordinal].id)
        .sort(compareCanonicalText)
        .slice(0, PHASE2_LIMITS.maxWitnessIds),
      repeatable: true,
      optionalExternalSinksExcluded: true,
      skippedAuthorityNodeIds: skippedAuthorityNodeIds.slice(0, PHASE2_LIMITS.maxWitnessIds),
      createdEdgeUnits,
      consumedEdgeUnits,
      destroyedEdgeUnits,
      oneTimeSourceCaps,
      cadenceCosts: [...cadenceCosts].sort(compareCanonicalText),
      modeledDeltas: {
        quantity: quantityDelta,
        scarcity: quantityDelta,
        quality: 0,
        power: 0,
        referenceValue: 0,
      },
    };
  };
  const operationalCycles = [];
  for (const lifecycle of definitionLifecycle) {
    const candidateSccs = new Set();
    for (const source of lifecycle.sourceAuthorities) {
      if (source.issuancePolicy !== 'periodic_per_owner_scope') continue;
      const ordinal = nodeById.get(source.nodeId).ordinal;
      if (!operationalReachable[ordinal]) continue;
      const scc = graphAnalysis.sccByOrdinal[ordinal];
      const size = graphAnalysis.sccSizes[scc - 1] ?? 0;
      if (size > 1 || controlOutgoing[ordinal].includes(ordinal)) candidateSccs.add(scc);
    }
    for (const scc of [...candidateSccs].sort((left, right) => left - right)) {
      const cycle = profitableCycle(lifecycle, scc);
      if (cycle) operationalCycles.push(cycle);
    }
  }
  const positiveCycles = operationalCycles
    .sort((left, right) => compareCanonicalText(left.definitionId, right.definitionId)
      || compareCanonicalText(left.witness[0] ?? '', right.witness[0] ?? ''));
  for (const cycle of positiveCycles) {
    economyErrors.push({
      code: 'economy_positive_cycle',
      definitionId: cycle.definitionId,
      witness: cycle.witness,
    });
  }
  const completeDefinitions = definitionLifecycle.filter((entry) => entry.complete).length;
  const scarcity = definitionLifecycle.map((entry) => ({
    definitionId: entry.definitionId,
    conservationClass: entry.conservationClass,
    sourceCount: entry.sources.length,
    cappedSourceCount: entry.sourceAuthorities.filter((authority) => (
      authority.issuancePolicy !== 'none'
    )).length,
  }));
  if (packageMetadata.activatable && economyErrors.length > 0) {
    raise(
      'content_profile_invalid',
      'activatable Phase 2 economy contains blocking lifecycle or conservation errors',
      '$.reports.economy.errors',
      { economyErrors: economyErrors.map((entry) => entry.code) },
    );
  }
  return {
    validation: {
      formatVersion: FORMAT_VERSION,
      packageId: packageMetadata.id,
      profile: packageMetadata.profile,
      counts: {
        nodes: ir.nodes.length,
        edges: ir.edges.length,
        definitions: definitions.length,
        imports: ir.imports.length,
        components: analysis.componentCount,
        stronglyConnectedComponents: analysis.sccCount,
        maximumSccSize: analysis.maximumSccSize,
      },
      largestSccWitness: analysis.largestSccWitness,
      errors: [],
      warnings: [],
    },
    economy: {
      formatVersion: FORMAT_VERSION,
      packageId: packageMetadata.id,
      sources,
      sinks,
      uses,
      orphans,
      scarcity,
      conservation: {
        analyzed: true,
        checkedDefinitions: definitionLifecycle.length,
        completeDefinitions,
        positiveCycles: positiveCycles.length,
        positiveCycleWitnesses: positiveCycles.map((entry) => entry.witness),
      },
      conversionCycles: positiveCycles,
      reachability: {
        analyzed: true,
        components: analysis.componentCount,
        entrypointId: ir.kind === 'experience' ? ir.entrypoint : null,
        entryReachableDefinitions: definitionLifecycle.filter((entry) => entry.entryReachable).length,
        sourceToUseDefinitions: definitionLifecycle.filter((entry) => entry.sourceToUse).length,
        useToSinkDefinitions: definitionLifecycle.filter((entry) => entry.useToSink).length,
        analysisSteps: reachabilitySteps,
      },
      adapterRegistry: {
        registryVersion: ECONOMY_ADAPTER_REGISTRY_VERSION,
        adapters: economyAdapterRegistryLock(authorities.map(({ node }) => node)).adapters,
        omrAuthority: canonicalClone(ECONOMY_ADAPTER_REGISTRY_OMR_AUTHORITY),
      },
      valuePaths,
      edgeValuePaths,
      definitionLifecycle,
      valueAuthority: {
        paths: valuePaths.length,
        creates: authorities.filter(({ descriptor }) => descriptor.valueClass === 'create').length,
        consumes: authorities.filter(({ descriptor }) => descriptor.valueClass === 'consume').length,
        destroys: authorities.filter(({ descriptor }) => descriptor.valueClass === 'destroy').length,
        durableUses: authorities.filter(({ descriptor }) => descriptor.valueClass === 'durable_use').length,
        cash: authorities.filter(({ descriptor }) => descriptor.valueClass.startsWith('cash_')).length,
      },
      cashAuthority: {
        adapters: cashAdapters,
        classified: cashAdapters.length,
        grossCashEmission: cashAdapters.reduce((sum, entry) => sum + entry.grossCashEmission, 0),
        netCashDelta: cashAdapters.reduce((sum, entry) => sum + entry.netCashDelta, 0),
      },
      omrAuthority: {
        references: omrInspection.references.length,
        movement: omrInspection.movement,
      },
      errors: economyErrors,
      warnings: [],
    },
  };
}

function enforceReportBounds(reports, limits, raise) {
  const bytesByName = {};
  for (const [name, report] of Object.entries(reports)) {
    const bytes = canonicalBytes(report).byteLength;
    if (bytes > limits.maxReportBytes) {
      raise('content_input_limit', `report ${name} exceeds the byte limit`, `$.reports.${name}`, {
        limitKind: 'report', expected: limits.maxReportBytes, actual: bytes,
      });
    }
    bytesByName[name] = bytes;
  }
  return bytesByName;
}

function normalizeOverlay(value, raise) {
  if (value === undefined || value === null) {
    return { state: 'absent', bytesBase64: '' };
  }
  if (typeof value === 'string') value = Buffer.from(value, 'utf8');
  if (!(value instanceof Uint8Array)) {
    raise('content_schema_invalid', 'overlayProvider must return bytes, string, null, or undefined', '$.overlay');
  }
  if (value && typeof value.then === 'function') {
    raise('content_schema_invalid', 'overlayProvider must be synchronous', '$.overlay');
  }
  if (value.byteLength > PHASE2_LIMITS.maxPackageBytes) {
    raise('content_input_limit', 'secret overlay exceeds the package byte limit', '$.overlay', {
      limitKind: 'overlayBytes', expected: PHASE2_LIMITS.maxPackageBytes, actual: value.byteLength,
    });
  }
  if (value.byteLength > 0) {
    raise(
      'content_profile_invalid',
      'phase2_economy private overlays are closed until a reviewed schema exists',
      '$.overlay',
    );
  }
  return {
    state: 'present',
    bytesBase64: Buffer.from(value.buffer, value.byteOffset, value.byteLength).toString('base64'),
  };
}

function compileBundle(entry, compilerVersion, catalog) {
  const raise = raiseFor('compile');
  const normalized = entry.normalized;
  const definitionHashById = {};
  const definitionInputs = {};
  const nodes = [];
  for (const definition of normalized.definitions) {
    const canonicalImmutableDefinition = without(definition, new Set(['id', 'localId', 'definitionVersion']));
    const input = {
      definitionFormatVersion: FORMAT_VERSION,
      packageQualifiedLogicalId: definition.id,
      definitionVersion: definition.definitionVersion,
      canonicalImmutableDefinition,
    };
    const hash = definitionHash(input);
    definitionInputs[definition.id] = input;
    definitionHashById[definition.id] = hash;
    nodes.push({
      id: definition.id,
      nodeClass: 'definition',
      kind: definition.kind,
      definitionVersion: definition.definitionVersion,
      definitionHash: hash,
      semantic: canonicalImmutableDefinition,
    });
  }
  for (const node of normalized.nodes) {
    nodes.push(compiledGraphNode(node));
  }

  const dependencyEntries = [];
  const dependencyByHash = new Map();
  for (const dependency of normalized.dependencies) {
    const dependencyBundle = catalog.byHash.get(dependency.bundleHash);
    if (!dependencyBundle) {
      const other = catalog.byPackage.get(dependency.packageId);
      raise(other ? 'content_dependency_drift' : 'content_dependency_unresolved',
        other ? 'dependency bundle hash drifted' : 'dependency bundle is absent from the offline catalog',
        '$.dependencies');
    }
    if (dependencyBundle.package.id !== dependency.packageId
        || dependencyBundle.package.version !== dependency.version) {
      raise('content_dependency_drift', 'dependency identity does not match its exact bundle', '$.dependencies');
    }
    if (normalized.authorityProfile === 'production'
        && dependencyBundle.package.authorityProfile !== 'production') {
      raise('content_profile_invalid', 'production packages cannot depend on fixture artifacts', '$.dependencies');
    }
    dependencyByHash.set(dependency.bundleHash, dependencyBundle);
    dependencyEntries.push({ ...dependency });
  }
  const dependencyClosure = resolveDependencyClosure(
    dependencyEntries,
    catalog,
    { id: normalized.packageId, authorityProfile: normalized.authorityProfile },
    raise,
    '$.dependencies',
  );

  const lockImports = [];
  const importedIds = new Set();
  const dependencyEconomyByHash = new Map();
  for (const imported of normalized.imports) {
    const dependencyBundle = dependencyByHash.get(imported.dependencyBundleHash);
    if (!dependencyBundle) {
      raise('content_dependency_unresolved', 'import does not belong to a declared exact dependency', '$.imports');
    }
    if (!dependencyBundle.ir.exports.includes(imported.id)) {
      raise('content_dependency_unresolved', 'import is not an exported dependency definition', '$.imports');
    }
    const actualDefinitionHash = dependencyBundle.hashes.definitionHashById[imported.id];
    if (!actualDefinitionHash) {
      raise('content_dependency_unresolved', 'imported definition is absent', '$.imports');
    }
    if (actualDefinitionHash !== imported.definitionHash) {
      raise('content_dependency_drift', 'imported definition hash drifted', '$.imports');
    }
    importedIds.add(imported.id);
    lockImports.push({ ...imported });
    let economyIndex = dependencyEconomyByHash.get(imported.dependencyBundleHash);
    if (!economyIndex) {
      economyIndex = dependencyEconomyIndex(dependencyBundle);
      dependencyEconomyByHash.set(imported.dependencyBundleHash, economyIndex);
    }
    nodes.push(importedDefinitionNode(imported, dependencyBundle, economyIndex, raise));
  }

  nodes.sort((left, right) => compareCanonicalText(left.id, right.id));
  for (let index = 0; index < nodes.length; index += 1) {
    if (index > 0 && nodes[index].id === nodes[index - 1].id) {
      raise('content_identity_conflict', `duplicate qualified ID ${nodes[index].id}`, '$.nodes');
    }
    nodes[index].ordinal = index;
  }
  if (nodes.length > entry.limits.maxNodes) {
    raise('content_input_limit', 'compiled nodes exceed the profile limit', '$.nodes', {
      limitKind: 'nodes', expected: entry.limits.maxNodes, actual: nodes.length,
    });
  }
  const knownIds = new Set(nodes.map((node) => node.id));
  const nodeById = new Map(nodes.map((node) => [node.id, node]));
  for (const node of nodes) {
    for (const ref of node.refs ?? []) {
      if (!knownIds.has(ref)) {
        raise(importedIds.has(ref) ? 'content_dependency_unresolved' : 'content_dependency_unresolved',
          'node reference is unresolved', '$.nodes');
      }
    }
    const definitionId = node.adapter?.args?.definitionId;
    if (definitionId !== undefined && !knownIds.has(definitionId)) {
      raise('content_dependency_unresolved', 'adapter definition reference is unresolved', '$.nodes');
    }
  }
  for (const exported of normalized.exports) {
    const node = nodeById.get(exported);
    if (!node || node.nodeClass !== 'definition' || importedIds.has(exported)
        || !Number.isSafeInteger(node.definitionVersion) || node.definitionVersion <= 0
        || definitionHashById[exported] !== node.definitionHash) {
      raise('content_dependency_unresolved', 'export must name an owned exact immutable definition', '$.exports');
    }
  }
  if (normalized.entrypoint !== undefined && !knownIds.has(normalized.entrypoint)) {
    raise('content_dependency_unresolved', 'experience entrypoint is unresolved', '$.entrypoint');
  }

  const edgeKeys = new Set();
  const edges = normalized.edges.map((edge) => ({ ...edge })).sort((left, right) => (
    compareCanonicalText(edgeKey(left), edgeKey(right))
  ));
  for (let index = 0; index < edges.length; index += 1) {
    const key = edgeKey(edges[index]);
    if (edgeKeys.has(key)) {
      raise('content_identity_conflict', 'duplicate canonical edge', '$.edges');
    }
    edgeKeys.add(key);
    if (!knownIds.has(edges[index].from) || !knownIds.has(edges[index].to)) {
      raise('content_dependency_unresolved', 'edge endpoint is unresolved', '$.edges');
    }
    edges[index].ordinal = index;
  }
  const indexes = buildIndexes(nodes, edges, raise);
  const graphAnalysis = analyzeGraph(nodes, indexes, entry.limits, raise);
  const analysis = graphAnalysis.summary;
  const sourceInput = entry.sourceInput;
  const computedSourceHash = entry.computedSourceHash;
  const overlayInput = entry.overlayInput;
  const computedSecretOverlayHash = entry.computedSecretOverlayHash;
  const dependencyInput = {
    formatVersion: FORMAT_VERSION,
    compilerVersion,
    root: {
      packageId: normalized.packageId,
      version: normalized.version,
      profile: normalized.profile,
      sourceHash: computedSourceHash,
    },
    adapterRegistry: economyAdapterRegistryLock(normalized.nodes),
    directDependencies: dependencyEntries,
    dependencies: dependencyClosure,
    imports: lockImports,
  };
  const computedDependencyLockHash = dependencyLockHash(dependencyInput);
  const ir = {
    formatVersion: FORMAT_VERSION,
    irVersion: IR_VERSION,
    profile: normalized.profile,
    packageId: normalized.packageId,
    packageVersion: normalized.version,
    kind: normalized.kind,
    adapterRegistryVersion: ECONOMY_ADAPTER_REGISTRY_VERSION,
    adapterRegistry: economyAdapterRegistryLock(normalized.nodes),
    nodes,
    edges,
    imports: lockImports,
    exports: normalized.exports,
    indexes,
  };
  if (normalized.entrypoint !== undefined) ir.entrypoint = normalized.entrypoint;
  const computedIrHash = irHash(ir);
  const packageMetadata = {
    id: normalized.packageId,
    version: normalized.version,
    authoredKind: normalized.authoredKind,
    kind: normalized.kind,
    profile: normalized.profile,
    authorityProfile: normalized.authorityProfile,
    activatable: normalized.activatable,
  };
  if (normalized.metadata !== undefined) packageMetadata.metadata = normalized.metadata;
  const publicManifestInput = expectedPublicManifest({
    package: packageMetadata,
    ir,
    lock: dependencyInput,
  });
  const computedPublicManifestHash = publicManifestHash(publicManifestInput);
  const publicManifest = { ...publicManifestInput, publicManifestHash: computedPublicManifestHash };
  const reports = makeReports(ir, graphAnalysis, packageMetadata, raise);
  enforceReportBounds(reports, entry.limits, raise);
  const reportHashByName = Object.fromEntries(Object.entries(reports).map(([name, report]) => (
    [name, hashCanonical(report)]
  )));
  const bundleInput = {
    formatVersion: FORMAT_VERSION,
    compilerVersion,
    profile: normalized.profile,
    packageId: normalized.packageId,
    packageVersion: normalized.version,
    sourceHash: computedSourceHash,
    secretOverlayHash: computedSecretOverlayHash,
    dependencyLockHash: computedDependencyLockHash,
    irHash: computedIrHash,
  };
  const computedBundleHash = bundleHash(bundleInput);
  const bundle = {
    artifactType: ARTIFACT_TYPE,
    formatVersion: FORMAT_VERSION,
    compilerVersion,
    package: packageMetadata,
    sourceSummary: { files: 1, bytes: canonicalBytes(sourceInput).byteLength },
    secretOverlay: overlayInput,
    lock: dependencyInput,
    ir,
    analysis,
    reports,
    publicManifest,
    hashes: {
      definitionHashById,
      sourceHash: computedSourceHash,
      secretOverlayHash: computedSecretOverlayHash,
      dependencyLockHash: computedDependencyLockHash,
      irHash: computedIrHash,
      bundleHash: computedBundleHash,
      publicManifestHash: computedPublicManifestHash,
      reportHashByName,
    },
    hashDomains: { ...HASH_DOMAINS },
    canonicalHashInputs: {
      definitionById: definitionInputs,
      source: sourceInput,
      secretOverlay: overlayInput,
      dependencyLock: dependencyInput,
      ir,
      bundle: bundleInput,
      publicManifest: publicManifestInput,
    },
  };
  return validateCompiledBundle(bundle, { authorityProfile: normalized.authorityProfile });
}

function dependencyFromBundle(bundle) {
  return {
    packageId: bundle.package.id,
    version: bundle.package.version,
    bundleHash: bundle.hashes.bundleHash,
  };
}

function insertClosureEntry(closure, dependency, rootPackageId, raise, path) {
  if (dependency.packageId === rootPackageId) {
    raise('content_dependency_cycle', 'dependency closure contains the root package', path, {
      witness: [rootPackageId], truncated: false, total: 1,
    });
  }
  const existing = closure.get(dependency.packageId);
  if (existing && !canonicalEqual(existing, dependency)) {
    raise('content_dependency_drift', 'dependency closure has conflicting exact artifacts', path, {
      reason: 'ambiguous', packageId: dependency.packageId,
    });
  }
  if (!existing) closure.set(dependency.packageId, { ...dependency });
}

function resolveDependencyClosure(directDependencies, catalog, rootPackage, raise, path = '$.lock.dependencies') {
  const closure = new Map();
  for (const direct of directDependencies) {
    const dependencyBundle = catalog.byHash.get(direct.bundleHash);
    if (!dependencyBundle) {
      raise('content_dependency_unresolved', 'dependency artifact is absent from the complete offline catalog', path);
    }
    if (dependencyBundle.package.id !== direct.packageId
        || dependencyBundle.package.version !== direct.version) {
      raise('content_dependency_drift', 'dependency artifact identity does not match its exact lock', path);
    }
    insertClosureEntry(closure, direct, rootPackage.id, raise, path);
    for (const transitive of dependencyBundle.lock.dependencies) {
      insertClosureEntry(closure, transitive, rootPackage.id, raise, path);
    }
  }
  const dependencies = [...closure.values()].sort(compareDependency);
  for (const dependency of dependencies) {
    const artifact = catalog.byHash.get(dependency.bundleHash);
    if (!artifact || artifact.package.id !== dependency.packageId
        || artifact.package.version !== dependency.version) {
      raise('content_dependency_unresolved', 'transitive dependency artifact is absent from the complete catalog', path);
    }
    if (rootPackage.authorityProfile === 'production'
        && artifact.package.authorityProfile !== 'production') {
      raise('content_profile_invalid', 'production dependency closure cannot contain fixture artifacts', path);
    }
  }
  return dependencies;
}

function assertImportsAgainstCatalog(bundle, catalog, raise) {
  const directByHash = new Map(bundle.lock.directDependencies.map((entry) => [entry.bundleHash, entry]));
  const economyIndexByHash = new Map();
  const importedNodeById = new Map(bundle.ir.nodes
    .filter((node) => node.nodeClass === 'import')
    .map((node) => [node.id, node]));
  for (const imported of bundle.lock.imports) {
    const direct = directByHash.get(imported.dependencyBundleHash);
    if (!direct || !imported.id.startsWith(`${direct.packageId}::`)) {
      raise('content_dependency_unresolved', 'import does not belong to a declared direct dependency', '$.lock.imports');
    }
    const artifact = catalog.byHash.get(imported.dependencyBundleHash);
    if (!artifact || !artifact.ir.exports.includes(imported.id)
        || artifact.hashes.definitionHashById[imported.id] !== imported.definitionHash) {
      raise('content_dependency_drift', 'import is not the exact exported dependency definition', '$.lock.imports');
    }
    let economyIndex = economyIndexByHash.get(imported.dependencyBundleHash);
    if (!economyIndex) {
      economyIndex = dependencyEconomyIndex(artifact);
      economyIndexByHash.set(imported.dependencyBundleHash, economyIndex);
    }
    const expectedSnapshot = importedDefinitionNode(imported, artifact, economyIndex, raise);
    const actualSnapshot = importedNodeById.get(imported.id);
    if (!actualSnapshot
        || !canonicalEqual(without(actualSnapshot, new Set(['ordinal'])), expectedSnapshot)) {
      raise('content_dependency_drift', 'imported definition semantics or obligations drifted', '$.ir.imports');
    }
  }
}

function assertBundleClosureAgainstCatalog(bundle, catalog, raise) {
  const expected = resolveDependencyClosure(
    bundle.lock.directDependencies,
    catalog,
    bundle.package,
    raise,
  );
  if (!canonicalEqual(expected, bundle.lock.dependencies)) {
    raise('content_dependency_drift', 'bundle dependency lock is not the complete transitive closure', '$.lock.dependencies');
  }
  assertImportsAgainstCatalog(bundle, catalog, raise);
}

function catalogResourceCounts(record, raise, byteCountByIdentity) {
  const bundle = record.bundle;
  let bytes;
  if (bundle && typeof bundle === 'object' && byteCountByIdentity.has(bundle)) {
    bytes = byteCountByIdentity.get(bundle);
  } else {
    try { bytes = canonicalBytes(bundle).byteLength; }
    catch (error) { raise('content_profile_invalid', `catalog bundle is not canonical data: ${error.message}`, '$.dependencyCatalog'); }
    if (bundle && typeof bundle === 'object') byteCountByIdentity.set(bundle, bytes);
  }
  if (bytes > PHASE2_LIMITS.maxBundleWorkspaceBytes) {
    raise('content_input_limit', 'dependency artifact exceeds the one-bundle workspace limit', '$.dependencyCatalog', {
      limitKind: 'bundleWorkspaceBytes',
      expected: PHASE2_LIMITS.maxBundleWorkspaceBytes,
      actual: bytes,
    });
  }
  const nodes = Array.isArray(bundle?.ir?.nodes) ? bundle.ir.nodes.length : 0;
  const edges = Array.isArray(bundle?.ir?.edges) ? bundle.ir.edges.length : 0;
  let references = 0;
  if (Array.isArray(bundle?.ir?.nodes)) {
    for (const node of bundle.ir.nodes) {
      references += Array.isArray(node?.refs) ? node.refs.length : 0;
    }
  }
  return {
    packages: 1,
    canonicalInputBytes: bytes,
    canonicalOutputBytes: bytes,
    nodes,
    edges,
    references,
  };
}

function sameCorpusDependencyErrorReservationBytes(dependencyEntry, definitionId) {
  const relatedAuthorities = dependencyEntry.normalized.nodes.filter((node) => (
    node.adapter?.args?.definitionId === definitionId
  ));
  const sourceAuthorities = relatedAuthorities.filter((node) => (
    economyAdapterDescriptor(node.adapter.kind).reportClass === 'source'
  )).length;
  let maximumId = definitionId;
  for (const node of [
    ...dependencyEntry.normalized.definitions,
    ...dependencyEntry.normalized.nodes,
    ...dependencyEntry.normalized.imports,
  ]) {
    if (Buffer.byteLength(node.id, 'utf8') > Buffer.byteLength(maximumId, 'utf8')) {
      maximumId = node.id;
    }
  }
  // These are every fixed-shape definition error makeReports can emit. Both
  // mutually exclusive cadence variants are included to keep the bound
  // mechanical rather than condition-dependent.
  const fixedLifecycleErrors = [
    'economy_orphan_definition',
    'economy_missing_source',
    'economy_missing_use',
    'economy_missing_sink',
    'economy_entry_unreachable',
    'economy_unreachable_use',
    'economy_unreachable_sink',
    'economy_finite_recurring_source',
    'economy_durable_recurring_source',
    'economy_source_cap_exceeded',
    'economy_missing_durable_use',
    'economy_durable_use_unbounded',
  ].map((code) => ({ code, definitionId }));
  const fixedBytes = canonicalBytes(fixedLifecycleErrors).byteLength;
  // One positive-cycle error can be emitted per periodic-source candidate SCC.
  // Its only variable-size member is a witness clipped to maxWitnessIds; using
  // the longest actual qualified ID for every slot is a byte upper bound.
  const maximumCycleErrorBytes = canonicalBytes({
    code: 'economy_positive_cycle',
    definitionId,
    witness: Array(PHASE2_LIMITS.maxWitnessIds).fill(maximumId),
  }).byteLength + 1;
  const positiveCycleErrors = sourceAuthorities * maximumCycleErrorBytes;
  return Math.min(
    PHASE2_LIMITS.maxReportBytes,
    fixedBytes + positiveCycleErrors,
  );
}

function importedSnapshotReservationBytes(
  entry,
  catalog,
  rootEntryById,
  sameCorpusErrorReservationByDefinition,
  raise,
) {
  if (entry.normalized.imports.length === 0) return 0;
  const directByHash = new Map(entry.normalized.dependencies.map((dependency) => (
    [dependency.bundleHash, dependency]
  )));
  const economyIndexByHash = new Map();
  let bytes = 0;
  for (const imported of entry.normalized.imports) {
    const direct = directByHash.get(imported.dependencyBundleHash);
    if (!direct || !imported.id.startsWith(`${direct.packageId}::`)) {
      raise('content_dependency_unresolved', 'import does not belong to a declared direct dependency', '$.imports');
    }
    const catalogBundle = catalog.byHash.get(imported.dependencyBundleHash);
    let snapshot;
    if (catalogBundle) {
      if (catalogBundle.package.id !== direct.packageId
          || catalogBundle.package.version !== direct.version
          || !catalogBundle.ir.exports.includes(imported.id)
          || catalogBundle.hashes.definitionHashById[imported.id] !== imported.definitionHash) {
        raise('content_dependency_drift', 'import is not the exact exported dependency definition', '$.imports');
      }
      let economyIndex = economyIndexByHash.get(imported.dependencyBundleHash);
      if (!economyIndex) {
        economyIndex = dependencyEconomyIndex(catalogBundle);
        economyIndexByHash.set(imported.dependencyBundleHash, economyIndex);
      }
      snapshot = importedDefinitionNode(imported, catalogBundle, economyIndex, raise);
    } else {
      const dependencyEntry = rootEntryById.get(direct.packageId);
      if (!dependencyEntry || dependencyEntry.normalized.version !== direct.version) {
        raise('content_dependency_unresolved', 'import dependency is absent from the effective corpus', '$.imports');
      }
      const definition = dependencyEntry.normalized.definitions.find((candidate) => (
        candidate.id === imported.id
      ));
      if (!definition || !dependencyEntry.normalized.exports.includes(imported.id)) {
        raise('content_dependency_unresolved', 'import is not exported by its in-root dependency', '$.imports');
      }
      const semantic = without(definition, new Set(['id', 'localId', 'definitionVersion']));
      const expectedDefinitionHash = definitionHash({
        definitionFormatVersion: FORMAT_VERSION,
        packageQualifiedLogicalId: definition.id,
        definitionVersion: definition.definitionVersion,
        canonicalImmutableDefinition: semantic,
      });
      if (expectedDefinitionHash !== imported.definitionHash) {
        raise('content_dependency_drift', 'in-root import definition hash drifted', '$.imports');
      }
      snapshot = {
        id: imported.id,
        nodeClass: 'import',
        kind: definition.kind,
        definitionVersion: definition.definitionVersion,
        definitionHash: imported.definitionHash,
        semantic,
        dependencyBundleHash: imported.dependencyBundleHash,
        dependencyEconomyErrors: [],
      };
      const reservationKey = `${imported.dependencyBundleHash}\0${imported.id}`;
      let errorReservation = sameCorpusErrorReservationByDefinition.get(reservationKey);
      if (errorReservation === undefined) {
        errorReservation = sameCorpusDependencyErrorReservationBytes(dependencyEntry, imported.id);
        sameCorpusErrorReservationByDefinition.set(reservationKey, errorReservation);
      }
      bytes += errorReservation * 6;
    }
    const snapshotBytes = canonicalBytes(snapshot).byteLength;
    bytes += snapshotBytes * 6;
    if (!Number.isSafeInteger(bytes)) {
      raise('content_input_limit', 'import snapshot reservation overflowed', '$.resources', {
        limitKind: 'bundleWorkspaceBytes',
        expected: PHASE2_LIMITS.maxBundleWorkspaceBytes,
        actual: Number.MAX_SAFE_INTEGER,
      });
    }
  }
  return bytes;
}

function normalizedPackageResourceCounts(
  entry,
  catalog,
  rootEntryById,
  sameCorpusErrorReservationByDefinition,
  raise,
) {
  const normalized = entry.normalized;
  const nodes = normalized.definitions.length + normalized.nodes.length + normalized.imports.length;
  const edges = normalized.edges.length;
  let references = 0;
  for (const node of normalized.nodes) references += node.refs.length;
  const canonicalInputBytes = canonicalBytes(entry.sourceInput).byteLength;
  // A sealed bundle can carry at most six semantic copies of authored data:
  // source; IR and its hash input; definition hash inputs; public manifest and
  // its hash input. Generated qualified identities/index/report wrappers are
  // bounded separately per admitted node, edge, and reference. Keeping this
  // reservation explicit makes future bundle-shape growth fail the post-build
  // assertion instead of silently invalidating an undocumented heuristic.
  const importedReservationBytes = importedSnapshotReservationBytes(
    entry,
    catalog,
    rootEntryById,
    sameCorpusErrorReservationByDefinition,
    raise,
  );
  const canonicalOutputBytes = (canonicalInputBytes * 6)
    + (64 * 1024)
    + (nodes * 2_048)
    + (edges * 1_024)
    + (references * 512)
    + importedReservationBytes;
  if (!Number.isSafeInteger(canonicalOutputBytes)) {
    raise('content_input_limit', 'canonical output reservation overflowed', '$.resources', {
      limitKind: 'bundleWorkspaceBytes',
      expected: PHASE2_LIMITS.maxBundleWorkspaceBytes,
      actual: Number.MAX_SAFE_INTEGER,
    });
  }
  if (canonicalOutputBytes > PHASE2_LIMITS.maxBundleWorkspaceBytes) {
    raise('content_input_limit', 'package exceeds the one-bundle workspace reservation', '$.resources', {
      limitKind: 'bundleWorkspaceBytes',
      expected: PHASE2_LIMITS.maxBundleWorkspaceBytes,
      actual: canonicalOutputBytes,
    });
  }
  return {
    packages: 0,
    canonicalInputBytes,
    canonicalOutputBytes,
    importedReservationBytes,
    nodes,
    edges,
    references,
  };
}

function loadDependencyCatalog(dependencyCatalog, raise, rootPackageCount = 0) {
  if (dependencyCatalog === undefined) dependencyCatalog = { bundles: [] };
  if (!plainObject(dependencyCatalog)
      || Object.keys(dependencyCatalog).length !== 1
      || !Array.isArray(dependencyCatalog.bundles)) {
    raise('content_dependency_unresolved', 'dependencyCatalog must be exactly { bundles: [] }', '$.dependencyCatalog');
  }
  if (dependencyCatalog.bundles.length > PHASE2_LIMITS.maxCatalogBundles
      || dependencyCatalog.bundles.length + rootPackageCount > PHASE2_LIMITS.maxPackages) {
    raise('content_input_limit', 'effective corpus exceeds the dependency artifact limit', '$.dependencyCatalog', {
      limitKind: 'catalogBundles', expected: PHASE2_LIMITS.maxCatalogBundles,
      actual: dependencyCatalog.bundles.length + rootPackageCount,
    });
  }
  const totals = {
    packages: rootPackageCount,
    canonicalInputBytes: 0,
    canonicalOutputBytes: 0,
    nodes: 0,
    edges: 0,
    references: 0,
  };
  validateEffectiveCorpusBudget(totals, PHASE2_LIMITS, raise);
  const byteCountByIdentity = new WeakMap();
  for (const record of dependencyCatalog.bundles) {
    if (!plainObject(record)
        || Object.keys(record).sort(compareCanonicalText).join(',') !== 'authorityProfile,bundle,expectedHashes') {
      raise('content_profile_invalid', 'dependency catalog entries require trusted bundle, authority, and hashes', '$.dependencyCatalog');
    }
    const counts = catalogResourceCounts(record, raise, byteCountByIdentity);
    addEffectiveResources(totals, counts, raise);
  }
  const byHash = new Map();
  const byPackage = new Map();
  for (const record of dependencyCatalog.bundles) {
    if (!['production', 'fixture'].includes(record.authorityProfile)
        || !plainObject(record.expectedHashes)
        || Object.keys(record.expectedHashes).sort(compareCanonicalText).join(',')
          !== 'bundleHash,dependencyLockHash') {
      raise('content_profile_invalid', 'dependency catalog trust record is invalid', '$.dependencyCatalog');
    }
    const validatedInput = validateCompiledBundle(record.bundle, {
      authorityProfile: record.authorityProfile,
    });
    for (const name of ['bundleHash', 'dependencyLockHash']) {
      validateHash(record.expectedHashes[name], `$.dependencyCatalog.expectedHashes.${name}`, raise);
      if (validatedInput.hashes[name] !== record.expectedHashes[name]) {
        raise('content_hash_mismatch', `dependency catalog ${name} does not match trusted identity`, '$.dependencyCatalog');
      }
    }
    const validated = cloneCanonical(validatedInput);
    validateCompiledBundle(validated, { authorityProfile: record.authorityProfile });
    if (byHash.has(validated.hashes.bundleHash)) {
      raise('content_dependency_unresolved', 'dependency catalog contains a duplicate bundle hash', '$.dependencyCatalog');
    }
    const samePackage = byPackage.get(validated.package.id);
    if (samePackage) {
      raise(
        samePackage.hashes.bundleHash === validated.hashes.bundleHash
          ? 'content_dependency_unresolved' : 'content_dependency_drift',
        'dependency catalog contains multiple artifacts for one logical package',
        '$.dependencyCatalog',
      );
    }
    byHash.set(validated.hashes.bundleHash, validated);
    byPackage.set(validated.package.id, validated);
  }
  const catalog = { byHash, byPackage };
  for (const bundle of byHash.values()) {
    assertBundleClosureAgainstCatalog(bundle, catalog, raise);
  }
  return { ...catalog, resources: totals };
}

export function compileContentCorpus({
  packages,
  compilerVersion,
  dependencyCatalog = { bundles: [] },
  overlayProvider,
} = {}) {
  const raise = raiseFor('compile');
  if (!Array.isArray(packages)) throw new TypeError('compileContentCorpus requires packages');
  if (packages.length > PHASE2_LIMITS.maxPackages) {
    raise('content_input_limit', 'corpus exceeds the package limit', '$.packages', {
      limitKind: 'packages', expected: PHASE2_LIMITS.maxPackages, actual: packages.length,
    });
  }
  if (typeof compilerVersion !== 'string' || !COMPILER_VERSION.test(compilerVersion)) {
    raise('content_schema_invalid', 'compilerVersion is invalid', '$.compilerVersion');
  }
  if (overlayProvider !== undefined && typeof overlayProvider !== 'function') {
    raise('content_schema_invalid', 'overlayProvider must be a function', '$.overlayProvider');
  }
  let corpusBytes = 0;
  for (const descriptor of packages) {
    assertDiscoveredContentPackage(descriptor);
    const rawSource = descriptor.source;
    if (!(rawSource instanceof Uint8Array)) throw new TypeError('discovered content source must be bytes');
    corpusBytes += rawSource.byteLength;
    if (corpusBytes > PHASE2_LIMITS.maxCorpusBytes) {
      raise('content_input_limit', 'corpus exceeds the source byte limit', '$.packages', {
        limitKind: 'corpusBytes', expected: PHASE2_LIMITS.maxCorpusBytes, actual: corpusBytes,
      });
    }
  }
  const catalog = loadDependencyCatalog(dependencyCatalog, raise, packages.length);

  const entries = [];
  const effectiveResources = { ...catalog.resources };
  const reservedOutputBytesByPackage = new Map();
  for (const descriptor of packages) {
    const rawSource = descriptor.source;
    const source = parseAuthoredJson(rawSource, {
      maxBytes: PHASE2_LIMITS.maxPackageBytes,
      maxDepth: PHASE2_LIMITS.maxJsonDepth,
      maxStringBytes: PHASE2_LIMITS.maxStringBytes,
      maxObjectMembers: 100_000,
      maxArrayItems: 100_000,
    });
    const { normalized, limits } = normalizeEconomyPackage({
      source,
      authorityProfile: descriptor.authorityProfile,
      raise,
    });
    const entry = {
      normalized,
      limits,
      rawSourceBytes: rawSource.byteLength,
      sourceInput: {
        formatVersion: FORMAT_VERSION,
        files: [{ path: 'pack.json', source: canonicalAuthoredSource(normalized) }],
      },
    };
    entries.push(entry);
  }
  const order = validatePackageDependencyGraph(entries, raise);
  const entryById = new Map(entries.map((entry) => [entry.normalized.packageId, entry]));
  const sameCorpusErrorReservationByDefinition = new Map();
  for (const entry of entries) {
    const resourceCounts = normalizedPackageResourceCounts(
      entry,
      catalog,
      entryById,
      sameCorpusErrorReservationByDefinition,
      raise,
    );
    addEffectiveResources(effectiveResources, resourceCounts, raise);
    reservedOutputBytesByPackage.set(
      entry.normalized.packageId,
      resourceCounts.canonicalOutputBytes,
    );
  }
  let aggregateOverlayBytes = 0;
  for (const entry of [...entries].sort((left, right) => (
    compareCanonicalText(left.normalized.packageId, right.normalized.packageId)
  ))) {
    entry.computedSourceHash = sourceHash(entry.sourceInput);
    const overlayResult = overlayProvider === undefined ? undefined : overlayProvider(Object.freeze({
      packageId: entry.normalized.packageId,
      version: entry.normalized.version,
      profile: entry.normalized.profile,
      sourceHash: entry.computedSourceHash,
    }));
    if (overlayResult && typeof overlayResult.then === 'function') {
      raise('content_schema_invalid', 'overlayProvider must be synchronous', '$.overlay');
    }
    if (typeof overlayResult === 'string') {
      aggregateOverlayBytes += Buffer.byteLength(overlayResult, 'utf8');
    } else if (overlayResult instanceof Uint8Array) {
      aggregateOverlayBytes += overlayResult.byteLength;
    }
    if (aggregateOverlayBytes > PHASE2_LIMITS.maxOverlayBytesPerCorpus) {
      raise('content_input_limit', 'corpus exceeds the secret-overlay byte limit', '$.overlay', {
        limitKind: 'overlayCorpusBytes',
        expected: PHASE2_LIMITS.maxOverlayBytesPerCorpus,
        actual: aggregateOverlayBytes,
      });
    }
    entry.overlayInput = normalizeOverlay(overlayResult, raise);
    entry.computedSecretOverlayHash = secretOverlayHash(entry.overlayInput);
  }
  const compiledById = new Map();
  for (const id of order) {
    const bundle = compileBundle(entryById.get(id), compilerVersion, catalog);
    const actualOutputBytes = canonicalBytes(bundle).byteLength;
    const reservedOutputBytes = reservedOutputBytesByPackage.get(id);
    if (actualOutputBytes > PHASE2_LIMITS.maxBundleWorkspaceBytes) {
      raise('content_input_limit', 'compiled package exceeds the one-bundle workspace limit', '$.resources', {
        limitKind: 'bundleWorkspaceBytes',
        expected: PHASE2_LIMITS.maxBundleWorkspaceBytes,
        actual: actualOutputBytes,
      });
    }
    if (actualOutputBytes > reservedOutputBytes) {
      raise('content_input_limit', 'compiled package exceeded its conservative output reservation', '$.resources', {
        limitKind: 'bundleOutputReservation',
        expected: reservedOutputBytes,
        actual: actualOutputBytes,
      });
    }
    effectiveResources.canonicalOutputBytes -= reservedOutputBytes;
    addEffectiveResources(effectiveResources, { canonicalOutputBytes: actualOutputBytes }, raise);
    const existing = catalog.byHash.get(bundle.hashes.bundleHash);
    if (existing && !canonicalEqual(existing, bundle)) {
      raise('content_dependency_drift', 'same dependency hash has different canonical bytes', '$.dependencyCatalog');
    }
    const samePackage = catalog.byPackage.get(bundle.package.id);
    if (samePackage && samePackage.hashes.bundleHash !== bundle.hashes.bundleHash) {
      raise('content_dependency_drift', 'one logical package has multiple exact artifacts', '$.dependencyCatalog');
    }
    catalog.byHash.set(bundle.hashes.bundleHash, bundle);
    catalog.byPackage.set(bundle.package.id, bundle);
    compiledById.set(id, bundle);
  }
  const bundles = [...compiledById.values()].sort((left, right) => (
    compareCanonicalText(left.package.id, right.package.id)
  ));
  const publicManifests = bundles.map((bundle) => bundle.publicManifest);
  const lock = {
    formatVersion: FORMAT_VERSION,
    compilerVersion,
    packages: bundles.map((bundle) => ({
      packageId: bundle.package.id,
      packageVersion: bundle.package.version,
      sourceHash: bundle.hashes.sourceHash,
      dependencyLockHash: bundle.hashes.dependencyLockHash,
      bundleHash: bundle.hashes.bundleHash,
      publicManifestHash: bundle.hashes.publicManifestHash,
    })),
  };
  const reports = bundles.map((bundle) => ({
    packageId: bundle.package.id,
    reportHashByName: bundle.hashes.reportHashByName,
    reports: bundle.reports,
  }));
  const knowledgeManifest = {
    formatVersion: FORMAT_VERSION,
    packages: bundles.map((bundle) => ({
      packageId: bundle.package.id,
      packageVersion: bundle.package.version,
      kind: bundle.package.kind,
      profile: bundle.package.profile,
      exports: bundle.ir.exports,
      publicNodeCount: bundle.publicManifest.nodes.length,
    })),
  };
  return { bundles, publicManifests, lock, reports, knowledgeManifest };
}

function validateHash(value, path, raise) {
  if (typeof value !== 'string' || !SHA256.test(value)) {
    raise('content_hash_mismatch', `${path} is not a lowercase SHA-256 hash`, path);
  }
}

function expectedPublicManifest(bundle) {
  const exportedIds = new Set(bundle.ir.exports);
  const nodeById = new Map(bundle.ir.nodes.map((node) => [node.id, node]));
  const directDependencyByHash = new Map(bundle.lock.directDependencies.map((dependency) => (
    [dependency.bundleHash, dependency]
  )));
  const exactDefinitionIdentity = (node, owner) => ({
    id: node.id,
    kind: node.kind,
    definitionVersion: node.definitionVersion,
    definitionHash: node.definitionHash,
    ownerPackageId: owner.packageId,
    ownerPackageVersion: owner.packageVersion,
  });
  const exportedDefinitions = bundle.ir.exports.map((id) => ({
    ...exactDefinitionIdentity(nodeById.get(id), {
      packageId: bundle.package.id,
      packageVersion: bundle.package.version,
    }),
    profile: bundle.package.profile,
  }));
  const publicImports = bundle.lock.imports.map((imported) => {
    const node = nodeById.get(imported.id);
    const dependency = directDependencyByHash.get(imported.dependencyBundleHash);
    return {
      ...exactDefinitionIdentity(node, {
        packageId: dependency.packageId,
        packageVersion: dependency.version,
      }),
      dependencyBundleHash: imported.dependencyBundleHash,
    };
  });
  const input = {
    artifactType: 'omerta.public-content-manifest',
    formatVersion: FORMAT_VERSION,
    packageId: bundle.package.id,
    packageVersion: bundle.package.version,
    kind: bundle.package.kind,
    profile: bundle.package.profile,
    dependencies: canonicalClone(bundle.lock.directDependencies),
    imports: publicImports,
    exports: bundle.ir.exports,
    exportedDefinitions,
    nodes: bundle.ir.nodes.filter((node) => node.nodeClass !== 'import' && (node.public === true
      || exportedIds.has(node.id))).map((node, publicOrdinal) => {
      const projected = { id: node.id, ordinal: publicOrdinal, kind: node.kind };
      if (node.nodeClass === 'definition') {
        Object.assign(projected, exactDefinitionIdentity(node, {
          packageId: bundle.package.id,
          packageVersion: bundle.package.version,
        }), { profile: bundle.package.profile });
      }
      if (node.metadata !== undefined) projected.metadata = node.metadata;
      else if (node.semantic?.metadata !== undefined) projected.metadata = node.semantic.metadata;
      return projected;
    }),
  };
  if (bundle.package.metadata !== undefined) input.metadata = bundle.package.metadata;
  return input;
}

export function validateCompiledBundle(bundle, { authorityProfile } = {}) {
  const raise = raiseFor('validate');
  if (!plainObject(bundle)) raise('unsupported_content_feature', 'compiled bundle must be an object', '$');
  const irDescriptor = Object.getOwnPropertyDescriptor(bundle, 'ir');
  if (!irDescriptor || !Object.hasOwn(irDescriptor, 'value') || !plainObject(irDescriptor.value)) {
    raise('unsupported_content_feature', 'compiled bundle IR must be a data object', '$.ir');
  }
  const ir = irDescriptor.value;
  const nodeDescriptor = Object.getOwnPropertyDescriptor(ir, 'nodes');
  const edgeDescriptor = Object.getOwnPropertyDescriptor(ir, 'edges');
  if (!nodeDescriptor || !Array.isArray(nodeDescriptor.value)
      || !edgeDescriptor || !Array.isArray(edgeDescriptor.value)) {
    raise('unsupported_content_feature', 'compiled IR nodes and edges must be arrays', '$.ir');
  }
  const profileLimits = authorityProfile === 'fixture'
    ? { ...PHASE2_LIMITS, maxNodes: 10_000 }
    : PHASE2_LIMITS;
  if (nodeDescriptor.value.length > profileLimits.maxNodes) {
    raise('content_input_limit', 'compiled IR exceeds node limit', '$.ir.nodes', {
      limitKind: 'nodes', expected: profileLimits.maxNodes, actual: nodeDescriptor.value.length,
    });
  }
  if (edgeDescriptor.value.length > profileLimits.maxEdges) {
    raise('content_input_limit', 'compiled IR exceeds edge limit', '$.ir.edges', {
      limitKind: 'edges', expected: profileLimits.maxEdges, actual: edgeDescriptor.value.length,
    });
  }
  if (!plainObject(bundle.reports)) raise('unsupported_content_feature', 'compiled reports are invalid', '$.reports');
  enforceReportBounds(bundle.reports, profileLimits, raise);
  try { canonicalBytes(bundle); }
  catch (error) { raise('unsupported_content_feature', error.message, '$'); }

  exactFields(bundle, [
    'artifactType', 'formatVersion', 'compilerVersion', 'package', 'sourceSummary',
    'secretOverlay', 'lock', 'ir', 'analysis', 'reports', 'publicManifest', 'hashes',
    'hashDomains', 'canonicalHashInputs',
  ], '$', raise);
  if (bundle.artifactType !== ARTIFACT_TYPE || bundle.formatVersion !== FORMAT_VERSION
      || typeof bundle.compilerVersion !== 'string' || !COMPILER_VERSION.test(bundle.compilerVersion)) {
    raise('unsupported_content_feature', 'compiled artifact discriminator/version is invalid', '$');
  }
  exactFields(bundle.package, [
    'id', 'version', 'authoredKind', 'kind', 'profile', 'authorityProfile', 'activatable',
    ...(bundle.package.metadata === undefined ? [] : ['metadata']),
  ], '$.package', raise);
  exactFields(bundle.hashes, [
    'definitionHashById', 'sourceHash', 'secretOverlayHash', 'dependencyLockHash',
    'irHash', 'bundleHash', 'publicManifestHash', 'reportHashByName',
  ], '$.hashes', raise);
  exactFields(bundle.secretOverlay, ['state', 'bytesBase64'], '$.secretOverlay', raise);
  const decodedOverlay = typeof bundle.secretOverlay.bytesBase64 === 'string'
    ? Buffer.from(bundle.secretOverlay.bytesBase64, 'base64')
    : null;
  if (!['absent', 'present'].includes(bundle.secretOverlay.state)
      || typeof bundle.secretOverlay.bytesBase64 !== 'string'
      || (bundle.secretOverlay.state === 'absent' && bundle.secretOverlay.bytesBase64 !== '')
      || decodedOverlay.toString('base64') !== bundle.secretOverlay.bytesBase64) {
    raise('unsupported_content_feature', 'secret overlay envelope is invalid', '$.secretOverlay');
  }
  if (decodedOverlay.byteLength > PHASE2_LIMITS.maxPackageBytes) {
    raise('content_input_limit', 'compiled secret overlay exceeds the package byte limit', '$.secretOverlay', {
      limitKind: 'overlayBytes', expected: PHASE2_LIMITS.maxPackageBytes, actual: decodedOverlay.byteLength,
    });
  }
  if (decodedOverlay.byteLength > 0) {
    raise(
      'content_profile_invalid',
      'phase2_economy private overlays are closed until a reviewed schema exists',
      '$.secretOverlay',
    );
  }
  if (bundle.package.profile !== 'phase2_economy'
      || !['library', 'experience', 'fixture'].includes(bundle.package.kind)
      || !['library', 'experience'].includes(bundle.package.authoredKind)
      || !['production', 'fixture'].includes(bundle.package.authorityProfile)) {
    raise('content_profile_invalid', 'compiled package profile/kind/authority is invalid', '$.package');
  }
  if (bundle.package.authorityProfile !== authorityProfile) {
    raise('content_profile_invalid', 'compiled package authority does not match trusted authority', '$.package.authorityProfile');
  }
  if (authorityProfile === 'fixture') {
    if (bundle.package.kind !== 'fixture' || bundle.package.activatable !== false) {
      raise('content_profile_invalid', 'fixture bundle must be server-assigned and non-activatable', '$.package');
    }
  } else if (bundle.package.kind === 'fixture'
      || bundle.package.activatable !== (bundle.package.authoredKind === 'experience')
      || bundle.package.kind !== bundle.package.authoredKind) {
    raise('content_profile_invalid', 'production bundle cannot claim fixture behavior', '$.package');
  }
  if (!canonicalEqual(bundle.hashDomains, HASH_DOMAINS)) {
    raise('content_hash_mismatch', 'hash-domain registry does not match the reviewed domains', '$.hashDomains');
  }
  exactFields(bundle.sourceSummary, ['files', 'bytes'], '$.sourceSummary', raise);
  exactFields(bundle.canonicalHashInputs, [
    'definitionById', 'source', 'secretOverlay', 'dependencyLock', 'ir', 'bundle', 'publicManifest',
  ], '$.canonicalHashInputs', raise);
  exactFields(bundle.canonicalHashInputs.source, ['formatVersion', 'files'], '$.canonicalHashInputs.source', raise);
  if (bundle.canonicalHashInputs.source.formatVersion !== FORMAT_VERSION
      || !Array.isArray(bundle.canonicalHashInputs.source.files)
      || bundle.canonicalHashInputs.source.files.length !== 1) {
    raise('unsupported_content_feature', 'canonical source envelope is invalid', '$.canonicalHashInputs.source');
  }
  exactFields(bundle.canonicalHashInputs.source.files[0], ['path', 'source'], '$.canonicalHashInputs.source.files[0]', raise);
  if (bundle.canonicalHashInputs.source.files[0].path !== 'pack.json') {
    raise('unsupported_content_feature', 'canonical source path must be package-relative pack.json', '$.canonicalHashInputs.source.files[0].path');
  }
  const embeddedSource = bundle.canonicalHashInputs.source.files[0].source;
  let embeddedSourceBytes;
  try { embeddedSourceBytes = canonicalBytes(embeddedSource).byteLength; }
  catch { raise('unsupported_content_feature', 'canonical authored source is invalid', '$.canonicalHashInputs.source.files[0].source'); }
  if (embeddedSourceBytes > profileLimits.maxPackageBytes) {
    raise('content_input_limit', 'canonical authored source exceeds the package byte limit', '$.canonicalHashInputs.source.files[0].source', {
      limitKind: 'sourceBytes',
      expected: profileLimits.maxPackageBytes,
      actual: embeddedSourceBytes,
    });
  }
  let canonicalSourceBytes;
  try { canonicalSourceBytes = canonicalBytes(bundle.canonicalHashInputs.source).byteLength; }
  catch { raise('unsupported_content_feature', 'canonical source hash input is invalid', '$.canonicalHashInputs.source'); }
  if (canonicalSourceBytes > PHASE2_LIMITS.maxBundleWorkspaceBytes) {
    raise('content_input_limit', 'canonical embedded source exceeds the bundle workspace limit', '$.canonicalHashInputs.source', {
      limitKind: 'canonicalSourceEnvelopeBytes',
      expected: PHASE2_LIMITS.maxBundleWorkspaceBytes,
      actual: canonicalSourceBytes,
    });
  }
  const expectedSourceSummary = {
    files: 1,
    bytes: canonicalSourceBytes,
  };
  if (!canonicalEqual(bundle.sourceSummary, expectedSourceSummary)) {
    raise('content_hash_mismatch', 'source summary does not match the canonical source input', '$.sourceSummary');
  }
  validateEconomyIrSafety(bundle.ir, {
    authorityProfile,
    authoredKind: bundle.package.authoredKind,
    raise,
  });
  const irNodeById = new Map(bundle.ir.nodes.map((node) => [node.id, node]));
  for (const exported of bundle.ir.exports) {
    const node = irNodeById.get(exported);
    if (!node || node.nodeClass !== 'definition'
        || !Number.isSafeInteger(node.definitionVersion) || node.definitionVersion <= 0
        || typeof node.definitionHash !== 'string' || !SHA256.test(node.definitionHash)) {
      raise(
        'content_dependency_unresolved',
        'compiled export is not an owned exact immutable definition',
        '$.ir.exports',
      );
    }
  }
  if (bundle.ir.profile !== bundle.package.profile || bundle.ir.packageId !== bundle.package.id
      || bundle.ir.packageVersion !== bundle.package.version || bundle.ir.kind !== bundle.package.kind
      || bundle.ir.formatVersion !== FORMAT_VERSION || bundle.ir.irVersion !== IR_VERSION) {
    raise('unsupported_content_feature', 'compiled IR package identity is inconsistent', '$.ir');
  }
  if (bundle.package.authoredKind === 'experience') {
    if (typeof bundle.ir.entrypoint !== 'string'
        || bundle.ir.nodes.filter((node) => node.nodeClass === 'graph' && node.kind === 'experience').length !== 1
        || !bundle.ir.nodes.some((node) => node.id === bundle.ir.entrypoint
          && node.nodeClass === 'graph' && node.kind === 'experience')) {
      raise('unsupported_content_feature', 'compiled experience entrypoint is invalid', '$.ir.entrypoint');
    }
  } else if (bundle.ir.entrypoint !== undefined
      || bundle.ir.nodes.some((node) => node.nodeClass === 'graph' && node.kind === 'experience')) {
    raise('unsupported_content_feature', 'compiled library cannot have an experience root', '$.ir.entrypoint');
  }

  for (let index = 0; index < bundle.ir.nodes.length; index += 1) {
    const node = bundle.ir.nodes[index];
    if (!plainObject(node) || node.ordinal !== index
        || (index > 0 && compareCanonicalText(bundle.ir.nodes[index - 1].id, node.id) >= 0)) {
      raise('unsupported_content_feature', 'compiled node order or ordinal is invalid', `$.ir.nodes[${index}]`);
    }
    if ((node.refs?.length ?? 0) > profileLimits.maxReferencesPerNode) {
      raise('content_input_limit', 'compiled node exceeds reference limit', `$.ir.nodes[${index}].refs`, {
        limitKind: 'references', expected: profileLimits.maxReferencesPerNode, actual: node.refs.length,
      });
    }
  }
  for (let index = 0; index < bundle.ir.edges.length; index += 1) {
    const edge = bundle.ir.edges[index];
    if (!plainObject(edge) || edge.ordinal !== index
        || (index > 0 && compareCanonicalText(edgeKey(bundle.ir.edges[index - 1]), edgeKey(edge)) >= 0)) {
      raise('unsupported_content_feature', 'compiled edge order or ordinal is invalid', `$.ir.edges[${index}]`);
    }
  }
  const rebuiltIndexes = buildIndexes(bundle.ir.nodes, bundle.ir.edges, raise);
  if (!canonicalEqual(bundle.ir.indexes, rebuiltIndexes)) {
    raise('unsupported_content_feature', 'compiled adjacency indexes are invalid', '$.ir.indexes');
  }
  const rebuiltGraphAnalysis = analyzeGraph(bundle.ir.nodes, rebuiltIndexes, profileLimits, raise);
  const rebuiltAnalysis = rebuiltGraphAnalysis.summary;
  if (!canonicalEqual(bundle.analysis, rebuiltAnalysis)) {
    raise('unsupported_content_feature', 'compiled graph analysis is invalid', '$.analysis');
  }

  const normalizedEmbeddedSource = normalizeEconomyPackage({
    source: embeddedSource,
    authorityProfile,
    raise,
  }).normalized;
  if (!canonicalEqual(canonicalAuthoredSource(normalizedEmbeddedSource), embeddedSource)
      || normalizedEmbeddedSource.packageId !== bundle.package.id
      || normalizedEmbeddedSource.version !== bundle.package.version
      || normalizedEmbeddedSource.authoredKind !== bundle.package.authoredKind
      || normalizedEmbeddedSource.kind !== bundle.package.kind
      || normalizedEmbeddedSource.profile !== bundle.package.profile
      || !((normalizedEmbeddedSource.metadata === undefined && bundle.package.metadata === undefined)
        || canonicalEqual(normalizedEmbeddedSource.metadata, bundle.package.metadata))) {
    raise('content_artifact_mismatch', 'embedded canonical source is inconsistent with the sealed package', '$.canonicalHashInputs.source');
  }
  const importedDefinitionById = new Map(bundle.ir.nodes
    .filter((node) => node.nodeClass === 'import')
    .map((node) => [node.id, node]));
  const expectedIr = expectedIrFromNormalizedSource(
    normalizedEmbeddedSource,
    raise,
    importedDefinitionById,
  );
  if (!canonicalEqual(expectedIr, bundle.ir)) {
    raise('content_artifact_mismatch', 'embedded canonical source does not match the compiled IR', '$.canonicalHashInputs.source');
  }
  exactFields(bundle.lock, [
    'formatVersion', 'compilerVersion', 'root', 'adapterRegistry', 'directDependencies',
    'dependencies', 'imports',
  ], '$.lock', raise);
  if (!Array.isArray(bundle.lock.directDependencies)
      || !Array.isArray(bundle.lock.dependencies)
      || !Array.isArray(bundle.lock.imports)) {
    raise('unsupported_content_feature', 'dependency lock entries must be arrays', '$.lock');
  }
  if (!canonicalEqual(bundle.lock.directDependencies, normalizedEmbeddedSource.dependencies)
      || !canonicalEqual(bundle.lock.imports, normalizedEmbeddedSource.imports)) {
    raise('content_artifact_mismatch', 'embedded canonical source does not match the dependency lock', '$.lock');
  }
  const expectedAdapterRegistry = economyAdapterRegistryLock(normalizedEmbeddedSource.nodes);
  if (!canonicalEqual(bundle.lock.adapterRegistry, expectedAdapterRegistry)) {
    raise('content_artifact_mismatch', 'embedded source does not match the adapter registry lock', '$.lock.adapterRegistry');
  }
  exactFields(bundle.lock.root, ['packageId', 'version', 'profile', 'sourceHash'], '$.lock.root', raise);
  if (bundle.lock.formatVersion !== FORMAT_VERSION
      || bundle.lock.compilerVersion !== bundle.compilerVersion
      || bundle.lock.root.packageId !== bundle.package.id
      || bundle.lock.root.version !== bundle.package.version
      || bundle.lock.root.profile !== bundle.package.profile
      || bundle.lock.root.sourceHash !== bundle.hashes.sourceHash) {
    raise('content_hash_mismatch', 'dependency lock root identity is invalid', '$.lock.root');
  }
  for (const [field, dependencies] of [
    ['directDependencies', bundle.lock.directDependencies],
    ['dependencies', bundle.lock.dependencies],
  ]) {
    const exactByPackage = new Map();
    for (let index = 0; index < dependencies.length; index += 1) {
      const dependency = dependencies[index];
      exactFields(dependency, ['packageId', 'version', 'bundleHash'], `$.lock.${field}[${index}]`, raise);
      validateHash(dependency.bundleHash, `$.lock.${field}[${index}].bundleHash`, raise);
      if (dependency.packageId === bundle.package.id) {
        raise('content_dependency_cycle', 'dependency lock contains the root package', `$.lock.${field}`);
      }
      if (index > 0 && compareDependency(dependencies[index - 1], dependency) >= 0) {
        raise('unsupported_content_feature', 'dependency lock entries are not canonical', `$.lock.${field}`);
      }
      const previous = exactByPackage.get(dependency.packageId);
      if (previous) {
        raise(
          canonicalEqual(previous, dependency)
            ? 'content_dependency_unresolved' : 'content_dependency_drift',
          'dependency lock contains multiple artifacts for one logical package',
          `$.lock.${field}`,
          { reason: canonicalEqual(previous, dependency) ? 'duplicate' : 'ambiguous' },
        );
      }
      exactByPackage.set(dependency.packageId, dependency);
    }
  }
  const closureByHash = new Map(bundle.lock.dependencies.map((entry) => [entry.bundleHash, entry]));
  for (const direct of bundle.lock.directDependencies) {
    if (!canonicalEqual(closureByHash.get(direct.bundleHash), direct)) {
      raise('content_dependency_unresolved', 'direct dependency is absent from the dependency closure', '$.lock.dependencies');
    }
  }
  for (let index = 0; index < bundle.lock.imports.length; index += 1) {
    exactFields(bundle.lock.imports[index], [
      'id', 'definitionHash', 'dependencyBundleHash',
    ], `$.lock.imports[${index}]`, raise);
    if (index > 0 && compareImport(bundle.lock.imports[index - 1], bundle.lock.imports[index]) >= 0) {
      raise('unsupported_content_feature', 'dependency import entries are not canonical', '$.lock.imports');
    }
  }
  for (const [name, ownHash] of [
    ['source', 'sourceHash'], ['secretOverlay', 'secretOverlayHash'],
    ['dependencyLock', 'dependencyLockHash'], ['ir', 'irHash'], ['bundle', 'bundleHash'],
    ['publicManifest', 'publicManifestHash'],
  ]) {
    if (Object.hasOwn(bundle.canonicalHashInputs[name], ownHash)) {
      raise('content_hash_mismatch', `${name} canonical input contains its own hash`, `$.canonicalHashInputs.${name}`);
    }
  }
  if (!canonicalEqual(bundle.canonicalHashInputs.ir, bundle.ir)
      || !canonicalEqual(bundle.canonicalHashInputs.dependencyLock, bundle.lock)
      || !canonicalEqual(bundle.canonicalHashInputs.secretOverlay, bundle.secretOverlay)) {
    raise('content_hash_mismatch', 'canonical hash inputs do not match the compiled payload', '$.canonicalHashInputs');
  }

  const rebuiltDefinitionHashes = {};
  const irDefinitionById = new Map(bundle.ir.nodes
    .filter((node) => node.nodeClass === 'definition')
    .map((node) => [node.id, node]));
  if (!plainObject(bundle.canonicalHashInputs.definitionById)) {
    raise('unsupported_content_feature', 'definition canonical input index is invalid', '$.canonicalHashInputs.definitionById');
  }
  for (const [id, input] of Object.entries(bundle.canonicalHashInputs.definitionById).sort((a, b) => (
    compareCanonicalText(a[0], b[0])
  ))) {
    exactFields(input, [
      'definitionFormatVersion', 'packageQualifiedLogicalId', 'definitionVersion',
      'canonicalImmutableDefinition',
    ], `$.canonicalHashInputs.definitionById.${id}`, raise);
    if (input.definitionFormatVersion !== FORMAT_VERSION
        || input.packageQualifiedLogicalId !== id) {
      raise('content_hash_mismatch', 'definition canonical identity is invalid', `$.canonicalHashInputs.definitionById.${id}`);
    }
    if (Object.hasOwn(input, 'definitionHash')) {
      raise('content_hash_mismatch', 'definition canonical input contains its own hash', `$.canonicalHashInputs.definitionById.${id}`);
    }
    rebuiltDefinitionHashes[id] = definitionHash(input);
    const irDefinition = irDefinitionById.get(id);
    if (!irDefinition || irDefinition.definitionHash !== rebuiltDefinitionHashes[id]) {
      raise('content_hash_mismatch', 'compiled definition does not match its canonical input', `$.ir.nodes.${id}`);
    }
  }
  if (Object.keys(rebuiltDefinitionHashes).length !== irDefinitionById.size) {
    raise('content_hash_mismatch', 'definition canonical input index is incomplete', '$.canonicalHashInputs.definitionById');
  }
  for (const exported of bundle.ir.exports) {
    const node = irDefinitionById.get(exported);
    if (!node || !Object.hasOwn(rebuiltDefinitionHashes, exported)
        || rebuiltDefinitionHashes[exported] !== node.definitionHash) {
      raise('content_hash_mismatch', 'export is absent from the exact definition hash index', '$.ir.exports');
    }
  }
  if (!canonicalEqual(bundle.hashes.definitionHashById, rebuiltDefinitionHashes)) {
    raise('content_hash_mismatch', 'definition hash index is invalid', '$.hashes.definitionHashById');
  }

  const expectedLock = bundle.canonicalHashInputs.dependencyLock;
  if (!Array.isArray(expectedLock.directDependencies)
      || !Array.isArray(expectedLock.dependencies)
      || !Array.isArray(expectedLock.imports)) {
    raise('unsupported_content_feature', 'dependency lock shape is invalid', '$.lock');
  }
  for (const imported of expectedLock.imports) {
    for (const field of ['definitionHash', 'dependencyBundleHash']) validateHash(imported[field], `$.lock.imports.${field}`, raise);
    if (!bundle.ir.imports.some((entry) => canonicalEqual(entry, imported))) {
      raise('content_hash_mismatch', 'compiled import is not pinned in the IR', '$.ir.imports');
    }
  }

  const expectedManifestInput = expectedPublicManifest(bundle);
  if (!canonicalEqual(bundle.canonicalHashInputs.publicManifest, expectedManifestInput)) {
    raise('content_hash_mismatch', 'public-manifest canonical input is invalid', '$.canonicalHashInputs.publicManifest');
  }
  const expectedManifest = {
    ...expectedManifestInput,
    publicManifestHash: bundle.hashes.publicManifestHash,
  };
  if (!canonicalEqual(bundle.publicManifest, expectedManifest)) {
    raise('content_hash_mismatch', 'safe public manifest is invalid or contains private fields', '$.publicManifest');
  }

  const expectedReports = makeReports(bundle.ir, rebuiltGraphAnalysis, bundle.package, raise);
  if (!canonicalEqual(bundle.reports, expectedReports)) {
    raise('content_hash_mismatch', 'compiled reports do not match independent analysis', '$.reports');
  }
  const expectedReportHashes = Object.fromEntries(Object.entries(expectedReports).map(([name, report]) => (
    [name, hashCanonical(report)]
  )));
  if (!canonicalEqual(bundle.hashes.reportHashByName, expectedReportHashes)) {
    raise('content_hash_mismatch', 'report hash index is invalid', '$.hashes.reportHashByName');
  }

  const recomputed = {
    sourceHash: sourceHash(bundle.canonicalHashInputs.source),
    secretOverlayHash: secretOverlayHash(bundle.canonicalHashInputs.secretOverlay),
    dependencyLockHash: dependencyLockHash(bundle.canonicalHashInputs.dependencyLock),
    irHash: irHash(bundle.canonicalHashInputs.ir),
    publicManifestHash: publicManifestHash(bundle.canonicalHashInputs.publicManifest),
  };
  const expectedBundleInput = {
    formatVersion: FORMAT_VERSION,
    compilerVersion: bundle.compilerVersion,
    profile: bundle.package.profile,
    packageId: bundle.package.id,
    packageVersion: bundle.package.version,
    ...recomputed,
  };
  delete expectedBundleInput.publicManifestHash;
  if (!canonicalEqual(bundle.canonicalHashInputs.bundle, expectedBundleInput)) {
    raise('content_hash_mismatch', 'bundle canonical input is invalid', '$.canonicalHashInputs.bundle');
  }
  recomputed.bundleHash = bundleHash(expectedBundleInput);
  for (const [name, value] of Object.entries(recomputed)) {
    validateHash(bundle.hashes[name], `$.hashes.${name}`, raise);
    if (bundle.hashes[name] !== value) {
      raise('content_hash_mismatch', `${name} does not match its canonical input`, `$.hashes.${name}`);
    }
  }
  return bundle;
}

export function verifyStoredBundleBytes(bytes, expectedHashes, {
  authorityProfile,
  dependencyCatalog = { bundles: [] },
} = {}) {
  const raise = raiseFor('stored-artifact');
  if (!plainObject(expectedHashes)
      || Object.keys(expectedHashes).sort(compareCanonicalText).join(',')
        !== 'bundleHash,dependencyLockHash') {
    throw new TypeError('expectedHashes must contain the trusted bundleHash and dependencyLockHash');
  }
  if (!['production', 'fixture'].includes(authorityProfile)) {
    throw new TypeError('trusted authorityProfile is required for stored bundle verification');
  }
  for (const name of ['bundleHash', 'dependencyLockHash']) {
    validateHash(expectedHashes[name], `$.expectedHashes.${name}`, raise);
  }
  if (typeof bytes === 'string') bytes = Buffer.from(bytes, 'utf8');
  if (!(bytes instanceof Uint8Array)) throw new TypeError('stored bundle bytes must be a string or Uint8Array');
  if (bytes.byteLength > MAX_ARTIFACT_BYTES) {
    raise('content_input_limit', 'stored bundle exceeds the artifact byte limit', '$', {
      limitKind: 'artifactBytes', expected: MAX_ARTIFACT_BYTES, actual: bytes.byteLength,
    });
  }
  const bundle = parseAuthoredJson(bytes, {
    maxBytes: MAX_ARTIFACT_BYTES,
    maxDepth: PHASE2_LIMITS.maxJsonDepth,
    maxStringBytes: PHASE2_LIMITS.maxStringBytes,
    maxObjectMembers: 100_000,
    maxArrayItems: 100_000,
  });
  const encoded = canonicalBytes(bundle);
  const submitted = Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (!encoded.equals(submitted)) {
    raise('content_artifact_mismatch', 'stored bundle bytes are not the canonical sealed byte form', '$');
  }
  const validated = validateCompiledBundle(bundle, {
    authorityProfile,
  });
  for (const [name, expected] of Object.entries(expectedHashes)) {
    if (validated.hashes[name] !== expected) {
      raise('content_hash_mismatch', `stored bundle ${name} does not match the trusted expected hash`, `$.hashes.${name}`);
    }
  }
  const catalog = loadDependencyCatalog(dependencyCatalog, raise, 1);
  assertBundleClosureAgainstCatalog(validated, catalog, raise);
  return validated;
}

export function sealedBundleBytes(bundle, { authorityProfile } = {}) {
  if (!['production', 'fixture'].includes(authorityProfile)) {
    throw new TypeError('trusted authorityProfile is required to seal a compiled bundle');
  }
  validateCompiledBundle(bundle, { authorityProfile });
  return canonicalBytes(bundle);
}

export function corpusSummary(result) {
  return {
    ok: true,
    packageCount: result.bundles.length,
    bundleHashes: result.bundles.map((bundle) => bundle.hashes.bundleHash),
  };
}

export function hashKnowledgeManifest(knowledgeManifest) {
  return hashCanonical(knowledgeManifest);
}

export function canonicalClone(value) {
  return cloneCanonical(value);
}
