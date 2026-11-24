#!/usr/bin/env node
// Offline structural review of already encoded plans. No ABI encoder or execution transport.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { isProxy } from 'node:util/types';

export const ACCEPTED_DAG_SHA256 = '80d69dc0d673df93766bf9a84413ab2036e2398e8cebd603f885a6460482bc83';
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
const hash = value => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) && !/^0{64}$/.test(value);
const address = value => typeof value === 'string' && /^0x[0-9a-fA-F]{40}$/.test(value) && !/^0x0{40}$/i.test(value);
const uint = value => typeof value === 'string' && value.length <= 78 && /^(0|[1-9][0-9]*)$/.test(value) && BigInt(value) < 2n ** 256n;
const label = value => typeof value === 'string' ? value : JSON.stringify(value);
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const forbidden = /private.?key|mnemonic|password|secret|seed.?phrase|rpc.?url|^signature|^signed|^raw(Transaction|Payload|$)/i;

// Never invoke accessors/toJSON, drop undefined/functions, or silently accept sparse arrays.
function jsonData(value, at = 'input', seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (!value || typeof value !== 'object' || isProxy(value) || seen.has(value)) throw Error(`${at}: plain JSON data required`);
  if (!Array.isArray(value) && ![Object.prototype, null].includes(Object.getPrototypeOf(value))) throw Error(`${at}: plain object required`);
  if (Object.getOwnPropertySymbols(value).length) throw Error(`${at}: symbol fields forbidden`);
  seen.add(value);
  const result = Array.isArray(value) ? [] : Object.create(null);
  if (Array.isArray(value) && (value.length > 10000 || Object.keys(value).length !== value.length
    || Array.from({ length: value.length }, (_, i) => String(i)).some(k => !Object.hasOwn(value, k)))) throw Error(`${at}: bounded dense array required`);
  for (const key of Object.keys(value)) {
    if (forbidden.test(key) || ['__proto__', 'prototype', 'constructor'].includes(key)) throw Error(`${at}.${key}: forbidden payload field`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!('value' in descriptor)) throw Error(`${at}.${key}: accessor forbidden`);
    result[key] = jsonData(descriptor.value, `${at}.${key}`, seen);
  }
  seen.delete(value);
  return result;
}
function parseBytes(bytes, label, max = 10 * 1024 * 1024) {
  if (typeof bytes !== 'string') throw Error(`${label}: exact primitive UTF-8 JSON string required`);
  if (Buffer.byteLength(bytes) > max) throw Error(`${label}: byte limit exceeded`);
  return JSON.parse(bytes);
}
function topLevelData(input) {
  if (!input || typeof input !== 'object' || isProxy(input) || Array.isArray(input)
    || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) throw Error('input: plain data object required');
  if (Object.getOwnPropertySymbols(input).length) throw Error('input: symbol fields forbidden');
  const result = Object.create(null);
  for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(input))) {
    if (!('value' in descriptor)) throw Error(`input.${key}: accessor forbidden`);
    result[key] = descriptor.value;
  }
  return result;
}

/**
 * Input pins/evidence are supplied metadata, not authenticated observations. Plans contain
 * exact planBytes/sha256 and a steps[] array in existing market-plan format. Every step
 * must have exactly one binding. Source and ABI semantics are never inferred from calldata.
 * release contains id/chainId/candidateRevision/scope/branch/selectedNodeIds and arrays:
 * roles{id,address}, evidence{id,sha256}, artifacts{id,nodeId,sha256},
 * nodeAddresses{nodeId,address}, preexisting{nodeId,runtimeHash,evidenceIds,methods},
 * groupRequirements{nodeId,methods,omittedMethods:[{method,reason,evidenceIds}]}, and
 * externalBindings{id:"consumer:argumentPath",address,evidenceIds}. Getter scope also
 * needs getterObservation{positionManager,returnedAddress,returnedCodeHash,evidenceIds}.
 * A step binding identifies planId/stepIndex/nodeId/evidenceIds, plus roleId/artifactId
 * for transactions and method/targetNodeId for calls. Plans bind artifact hashes through
 * artifacts[contract].artifactSha256; no artifact file or ABI is evaluated here.
 * Metadata must be plain JSON data. The top-level data holder and nested metadata
 * reject proxies/accessors before their properties are read; dagBytes and planBytes
 * must be primitive UTF-8 JSON strings. Every transaction requires its own explicit decimal nonce;
 * an absent Safe/EOA envelope is unresolved, never inferred from sibling transactions.
 * CLI config replaces dagBytes with dagPath and each planBytes with explicit planPath.
 */
export function validateImplementedReleasePacket(input) {
  const blockers = [];
  const fail = (code, detail) => blockers.push({ code, detail });
  let dag, release, pins, plans, bindings;
  try {
    input = topLevelData(input);
    dag = parseBytes(input.dagBytes, 'dag');
    ({ release, candidateSourcePins: pins, componentPlans: plans, stepBindings: bindings } = jsonData({
      release: input.release, candidateSourcePins: input.candidateSourcePins,
      componentPlans: input.componentPlans, stepBindings: input.stepBindings,
    }));
  } catch (error) {
    return finish(null, [], [], [{ code: 'INVALID_INPUT', detail: error.message }]);
  }
  if (input.expectedDagSha256 !== ACCEPTED_DAG_SHA256 || sha(input.dagBytes) !== ACCEPTED_DAG_SHA256
    || dag.schema !== 'OMERTA_IMPLEMENTED_SOURCE_DEPLOY_SETUP_DAG_V1') {
    return finish(release, [], [], [{ code: 'DAG_PIN_MISMATCH', detail: 'Only the exact accepted V4 graph is supported; do not repin it to changed sources.' }]);
  }
  const array = (value, name) => { if (!Array.isArray(value)) { fail('MISSING_ARRAY', name); return []; } return value; };
  const index = (rows, key, label) => {
    const result = new Map();
    for (const row of array(rows, label)) {
      if (!row || typeof row !== 'object' || typeof row[key] !== 'string' || !row[key]) { fail('INVALID_ROW', label); continue; }
      if (result.has(row[key])) fail('DUPLICATE_ID', `${label}:${row[key]}`);
      else result.set(row[key], row);
    }
    return result;
  };
  const nodes = new Map([...dag.nodes, ...dag.setupNodes].map(node => [node.id, node]));
  const deployments = new Set(dag.nodes.map(node => node.id));
  if (!release || release.schemaVersion !== 1 || release.scope !== 'implemented-components'
    || typeof release.id !== 'string' || !release.id || !/^[a-f0-9]{40}$/.test(release.candidateRevision || '')
    || !Number.isSafeInteger(release.chainId) || release.chainId <= 0) fail('RELEASE_METADATA', 'Explicit id, chainId, full candidate revision and implemented-components scope required');
  release ||= {};
  const releaseKeys = ['schemaVersion', 'id', 'chainId', 'candidateRevision', 'scope', 'branch', 'selectedNodeIds', 'roles',
    'evidence', 'artifacts', 'nodeAddresses', 'preexisting', 'groupRequirements', 'externalBindings', 'getterObservation'];
  for (const key of Object.keys(release)) if (!releaseKeys.includes(key)) fail('UNKNOWN_RELEASE_FIELD', key);
  if (release.candidateRevision !== dag.sourceRevision) fail('DAG_CANDIDATE_REVISION', 'The historical graph cannot be rebound to another candidate revision by declaration');
  const selected = new Set();
  for (const id of array(release.selectedNodeIds, 'selectedNodeIds')) {
    if (typeof id !== 'string' || !nodes.has(id)) fail('UNKNOWN_NODE', label(id));
    else if (selected.has(id)) fail('DUPLICATE_SELECTION', id);
    else selected.add(id);
  }
  if (!selected.size) fail('EMPTY_SCOPE', 'Select the bounded implemented components explicitly');
  const branch = release.branch || {};
  if (!['ZERO', 'NONZERO'].includes(branch.selectedSettlementHook)
    || !['SELECTED_MANIFEST_POOL_MANAGER', 'EXTERNAL'].includes(branch.positionManagerPoolManagerGetter)) fail('BRANCH_UNRESOLVED', 'Explicit hook and resolved getter branches required');
  const roles = index(release.roles, 'id', 'roles');
  const evidence = index(release.evidence, 'id', 'evidence');
  const artifacts = index(release.artifacts, 'id', 'artifacts');
  const addresses = index(release.nodeAddresses, 'nodeId', 'nodeAddresses');
  const preexisting = index(release.preexisting, 'nodeId', 'preexisting');
  const groups = index(release.groupRequirements, 'nodeId', 'groupRequirements');
  const sourcePins = index(pins, 'path', 'candidateSourcePins');
  const occupied = new Map();
  for (const row of roles.values()) if (!address(row.address)) fail('ROLE_ADDRESS', row.id);
  for (const row of evidence.values()) if (!hash(row.sha256)) fail('EVIDENCE_PIN', row.id);
  for (const row of artifacts.values()) if (!hash(row.sha256) || !selected.has(row.nodeId)) fail('ARTIFACT_PIN', row.id);
  for (const row of addresses.values()) if (!nodes.has(row.nodeId) || !address(row.address)) fail('NODE_ADDRESS', row.nodeId);
  for (const row of addresses.values()) if (deployments.has(row.nodeId) && address(row.address)) {
    const key = row.address.toLowerCase();
    if (occupied.has(key)) fail('DEPLOYMENT_ADDRESS_COLLISION', `${occupied.get(key)}:${row.nodeId}`);
    occupied.set(key, row.nodeId);
  }
  function refs(ids, at) {
    if (!Array.isArray(ids) || !ids.length || new Set(ids).size !== ids.length) { fail('MISSING_EVIDENCE', at); return; }
    for (const id of ids) if (typeof id !== 'string' || !evidence.has(id) || !hash(evidence.get(id).sha256)) fail('MISSING_EVIDENCE', `${at}:${label(id)}`);
  }
  for (const id of selected) {
    const node = nodes.get(id);
    const sources = [node.source, node.sourceExcerpt?.source, ...(node.methods || []).map(m => m.source)].filter(Boolean);
    for (const source of sources) if (sourcePins.get(source.path)?.sha256 !== source.sha256) fail('SOURCE_PIN_MISMATCH', `${id}:${source.path}`);
  }
  for (const row of sourcePins.values()) if (!hash(row.sha256)) fail('SOURCE_PIN_MISMATCH', row.path);
  for (const row of preexisting.values()) {
    const node = nodes.get(row.nodeId);
    if (!selected.has(row.nodeId)) { fail('UNSELECTED_PREREQUISITE', row.nodeId); continue; }
    refs(row.evidenceIds, `preexisting:${row.nodeId}`);
    if (deployments.has(row.nodeId) && (!addresses.has(row.nodeId) || !hash(row.runtimeHash))) fail('PREEXISTING_RUNTIME', row.nodeId);
  }
  // Known addresses do not become code-before-construction edges.
  const knownBindings = [];
  for (const binding of dag.requiredAddressBindings) if (selected.has(binding.consumer)) {
    const supplied = addresses.get(binding.dependency);
    if (!supplied || !address(supplied.address)) fail('KNOWN_ADDRESS_MISSING', binding.id);
    knownBindings.push({ id: binding.id, dependency: binding.dependency, consumer: binding.consumer,
      argumentPath: binding.argumentPath, address: supplied?.address ?? null, deploymentPrerequisite: false });
  }
  const external = index(release.externalBindings, 'id', 'externalBindings');
  const requiredExternal = new Set();
  for (const binding of dag.externalConstructorBindingsUnresolved) if (selected.has(binding.consumer)) {
    const id = `${binding.consumer}:${binding.argumentPath}`; requiredExternal.add(id);
    const supplied = external.get(id);
    if (!supplied || !address(supplied.address)) fail('EXTERNAL_BINDING_MISSING', id);
    refs(supplied?.evidenceIds, `external:${id}`);
  }
  for (const id of external.keys()) if (!requiredExternal.has(id)) fail('UNKNOWN_EXTERNAL_BINDING', id);
  const planIndex = index(plans, 'id', 'componentPlans');
  const bindingIndex = new Map();
  for (const binding of array(bindings, 'stepBindings')) {
    if (!binding || typeof binding.planId !== 'string' || !Number.isSafeInteger(binding.stepIndex) || binding.stepIndex < 0) { fail('STEP_BINDING', 'Explicit planId and nonnegative stepIndex required'); continue; }
    const key = `${binding.planId}:${binding.stepIndex}`;
    if (bindingIndex.has(key)) fail('DUPLICATE_MAPPING', key); else bindingIndex.set(key, binding);
  }
  const steps = [], usedBindings = new Set(), spans = new Map(), methods = new Map(), nonces = new Map();
  for (const id of preexisting.keys()) spans.set(id, { first: -1, last: -1 });
  for (const plan of planIndex.values()) {
    let parsed;
    try {
      if (!hash(plan.sha256) || typeof plan.planBytes !== 'string' || sha(plan.planBytes) !== plan.sha256) throw Error('Exact plan byte digest required');
      parsed = jsonData(parseBytes(plan.planBytes, plan.id));
      if (!(parsed.mode === 'offline-unsigned' || parsed.unsigned === true) || parsed.broadcasts === true || parsed.networkAccess === true) throw Error('Explicit offline unsigned plan required');
      if (parsed.sourceRevision !== release.candidateRevision) throw Error('Component plan candidate revision differs');
      if (parsed.chainId !== release.chainId) throw Error('Component plan chain differs');
      if (!Array.isArray(parsed.steps)) throw Error('Existing encoded steps[] required');
    } catch (error) { fail('COMPONENT_PLAN', `${plan.id}:${error.message}`); continue; }
    for (const [stepIndex, step] of parsed.steps.entries()) {
      const key = `${plan.id}:${stepIndex}`, binding = bindingIndex.get(key), position = steps.length;
      steps.push({ planId: plan.id, stepIndex, nodeId: binding?.nodeId ?? null, step });
      if (!step || typeof step !== 'object' || Array.isArray(step)) { fail('STEP_SHAPE', key); continue; }
      if (!binding) { fail('UNMAPPED_STEP', key); continue; }
      usedBindings.add(key);
      const node = nodes.get(binding.nodeId);
      if (!node || !selected.has(binding.nodeId)) { fail('UNKNOWN_MAPPING', key); continue; }
      if (preexisting.has(binding.nodeId)) fail('PREEXISTING_AND_PLANNED', binding.nodeId);
      refs(binding.evidenceIds, key);
      const span = spans.get(binding.nodeId);
      if (span && (deployments.has(binding.nodeId) || node.type === 'PREDEPLOYMENT_READ_ONLY_GATE')) fail('DUPLICATE_NODE_MAPPING', binding.nodeId);
      spans.set(binding.nodeId, { first: span?.first ?? position, last: position });
      if (node.type === 'PREDEPLOYMENT_READ_ONLY_GATE') {
        if (step.kind !== 'readiness' || step.transaction) fail('READ_GATE_TRANSACTION', key);
        continue;
      }
      const tx = step.transaction, role = roles.get(binding.roleId), artifact = artifacts.get(binding.artifactId);
      if (!role || !address(role.address)) fail('MISSING_ROLE', key);
      if (!artifact || artifact.nodeId !== binding.nodeId || !hash(artifact.sha256)) fail('MISSING_ARTIFACT', key);
      if (parsed.artifacts?.[node.contract]?.artifactSha256 !== artifact?.sha256) fail('COMPONENT_ARTIFACT_BINDING', key);
      if (!tx || typeof tx !== 'object') { fail('MISSING_TRANSACTION', key); continue; }
      if (!uint(tx.nonce)) fail('NONCE_MISSING', key);
      const allowed = ['chainId', 'from', 'to', 'data', 'value', 'nonce', 'gas', 'gasPrice', 'maxFeePerGas', 'maxPriorityFeePerGas'];
      for (const k of Object.keys(tx)) if (!allowed.includes(k)) fail('UNSUPPORTED_TRANSACTION_FIELD', `${key}:${k}`);
      if (!Number.isSafeInteger(tx.chainId) || tx.chainId <= 0 || tx.chainId !== parsed.chainId) fail('CHAIN_BINDING', key);
      if (!address(tx.from) || tx.from.toLowerCase() !== role?.address?.toLowerCase()) fail('CALLER_BINDING', key);
      if (typeof tx.data !== 'string' || !/^0x(?:[a-fA-F0-9]{2})+$/.test(tx.data) || !uint(tx.value)) fail('UNSIGNED_TRANSACTION', key);
      for (const k of allowed.slice(5)) if (k in tx && !uint(tx[k])) fail('TRANSACTION_INTEGER', `${key}:${k}`);
      if ('nonce' in tx && uint(tx.nonce) && Number.isSafeInteger(tx.chainId) && address(tx.from)) {
        const identity = `${tx.chainId}:${tx.from.toLowerCase()}`, previous = nonces.get(identity), nonce = BigInt(tx.nonce);
        if (previous !== undefined && nonce !== previous + 1n) fail('NONCE_SEQUENCE', key);
        nonces.set(identity, nonce);
      }
      if (deployments.has(binding.nodeId)) {
        if (step.kind !== 'deployment' || !uint(tx.nonce)) fail('DEPLOYMENT_SHAPE', key);
        if (!['CREATE', 'CREATE2'].includes(step.method) || (step.method === 'CREATE' && 'to' in tx)
          || (step.method === 'CREATE2' && !address(tx.to))) fail('DEPLOYMENT_METHOD', key);
        if (!address(step.expectedAddress) || step.expectedAddress.toLowerCase() !== addresses.get(binding.nodeId)?.address?.toLowerCase()) fail('DEPLOYMENT_ADDRESS', key);
        if (step.contract !== node.contract) fail('CONTRACT_BINDING', key);
      } else {
        if (step.kind !== 'call' || !address(tx.to) || !deployments.has(binding.targetNodeId)
          || !selected.has(binding.targetNodeId) || nodes.get(binding.targetNodeId)?.contract !== node.contract
          || tx.to.toLowerCase() !== addresses.get(binding.targetNodeId)?.address?.toLowerCase()) fail('CALL_TARGET', key);
        if (typeof step.functionName !== 'string' || step.functionName.startsWith('_') || binding.method !== step.functionName
          || !(node.methods || []).some(m => m.method === step.functionName && !m.method.startsWith('_'))) fail('PUBLIC_METHOD_BINDING', key);
        if (!methods.has(binding.nodeId)) methods.set(binding.nodeId, new Set());
        methods.get(binding.nodeId).add(step.functionName);
        if (binding.nodeId === 'setup-pool-key') {
          const hook = parsed.canonicalPool?.hooks;
          if (typeof hook !== 'string' || (branch.selectedSettlementHook === 'ZERO' ? !/^0x0{40}$/i.test(hook)
            : !address(hook) || hook.toLowerCase() !== addresses.get('historical-hook')?.address?.toLowerCase())) fail('HOOK_BRANCH_BINDING', key);
        }
      }
    }
  }
  for (const key of bindingIndex.keys()) if (!usedBindings.has(key)) fail('UNKNOWN_STEP_MAPPING', key);
  for (const id of selected) {
    const node = nodes.get(id);
    if (!spans.has(id)) fail('NODE_UNACCOUNTED', id);
    if (deployments.has(id) || node.type === 'PREDEPLOYMENT_READ_ONLY_GATE') continue;
    if (preexisting.has(id)) {
      const suppliedMethods = array(preexisting.get(id).methods, `preexisting.methods:${id}`);
      if (new Set(suppliedMethods).size !== suppliedMethods.length) fail('DUPLICATE_GROUP_METHOD', id);
      methods.set(id, new Set(suppliedMethods));
    }
    const group = groups.get(id), publicMethods = [...new Set(node.methods.filter(m => !m.method.startsWith('_')).map(m => m.method))];
    if (!group || !Array.isArray(group.methods) || !group.methods.length || group.methods.some(m => typeof m !== 'string')
      || new Set(group.methods).size !== group.methods.length) { fail('GROUP_REQUIREMENTS', id); continue; }
    const omitted = index(group.omittedMethods, 'method', `omittedMethods:${id}`);
    for (const method of group.methods) if (!publicMethods.includes(method) || !methods.get(id)?.has(method) || omitted.has(method)) fail('GROUP_CALL_MISSING', `${id}:${method}`);
    for (const method of publicMethods) if (!group.methods.includes(method) && !omitted.has(method)) fail('GROUP_METHOD_UNACCOUNTED', `${id}:${method}`);
    for (const [method, omission] of omitted) { if (!publicMethods.includes(method) || typeof omission.reason !== 'string' || !omission.reason.trim()) fail('GROUP_OMISSION', `${id}:${method}`); refs(omission.evidenceIds, `${id}:${method}`); }
    for (const method of methods.get(id) || []) if (!group.methods.includes(method)) fail('UNREVIEWED_GROUP_CALL', `${id}:${label(method)}`);
  }
  for (const id of groups.keys()) if (!selected.has(id) || deployments.has(id) || nodes.get(id).type === 'PREDEPLOYMENT_READ_ONLY_GATE') fail('UNKNOWN_GROUP', id);
  const applies = edge => !edge.condition || Object.entries(edge.condition).every(([k, v]) => branch[k] === v);
  const edges = [...dag.strictConstructorDependencies.map(e => ({ from: e.dependency, to: e.consumer, kind: 'STRICT_CONSTRUCTOR' })),
    ...dag.constructorAndPredeploymentStateEdges, ...dag.setupActivationEdges,
    ...dag.setupNodes.flatMap(node => (node.dependsOn || []).map(from => ({ from, to: node.id, kind: 'SETUP_PREREQUISITE' }))),
    ...dag.conditionalConstructorDependencies.filter(applies), ...dag.conditionalSetupActivationEdges.filter(applies)];
  for (const edge of edges) if (selected.has(edge.to)) {
    const from = spans.get(edge.from), to = spans.get(edge.to);
    if (!selected.has(edge.from) || !from) fail('OMITTED_PREDECESSOR', `${edge.from}>${edge.to}`);
    else if (to && !(preexisting.has(edge.from) && preexisting.has(edge.to)) && from.last >= to.first) fail('DEPENDENCY_ORDER', `${edge.from}>${edge.to}`);
  }
  if (selected.has('check-positionmanager-poolmanager-code')) {
    const observation = release.getterObservation;
    refs(observation?.evidenceIds, 'getterObservation');
    if (!observation || !address(observation.positionManager) || !address(observation.returnedAddress) || !hash(observation.returnedCodeHash)
      || observation.positionManager.toLowerCase() !== addresses.get('historical-positionmanager')?.address?.toLowerCase()
      || (branch.positionManagerPoolManagerGetter === 'SELECTED_MANIFEST_POOL_MANAGER'
        && observation.returnedAddress.toLowerCase() !== addresses.get('historical-poolmanager')?.address?.toLowerCase())
      || (branch.positionManagerPoolManagerGetter === 'EXTERNAL'
        && observation.returnedAddress.toLowerCase() === addresses.get('historical-poolmanager')?.address?.toLowerCase())) fail('GETTER_OBSERVATION', 'Explicit getter/runtime response binding required; supplied evidence is not live authentication');
  }
  return finish(release, steps, knownBindings, blockers, [...planIndex.values()].map(({ id, sha256 }) => ({ id, sha256 })), dag.missingCapabilities, pins);
}

function finish(release, steps, knownAddressBindings, blockers, componentPlans = [], missingCapabilities = [], candidateSourcePins = []) {
  return freeze(JSON.parse(JSON.stringify({ schemaVersion: 1, kind: 'unsigned-implemented-release-review',
    release: release ?? null, requiredDagSha256: ACCEPTED_DAG_SHA256, candidateSourcePins, componentPlans, steps, knownAddressBindings,
    preparationComplete: blockers.length === 0, blockers, unresolvedFullLaunchCapabilities: missingCapabilities,
    productionApproved: false, fullPrivateLaunchReady: false, broadcast: false, signingAuthorized: false,
    limits: { suppliedMetadataOnly: true, evidenceAuthenticated: false, candidateFilesRead: false,
      candidateCommitAuthenticated: false, reviewedGraphSourceSnapshotWasDirty: true,
      calldataABISemanticsVerified: false, runtimeOrSourceCurrentStateVerified: false,
      nonceReservationOrSafeEnvelopeVerified: false, deploymentSimulationExecuted: false,
      scope: 'Structural review only. Existing encoders and independent ABI/source/runtime/release review remain required.' } })));
}

function localJSON(file) {
  if (!fs.lstatSync(file).isFile() || fs.statSync(file).size > 10 * 1024 * 1024) throw Error('Bounded regular local input required');
  return fs.readFileSync(file, 'utf8');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 6 || process.argv[2] !== '--input' || process.argv[4] !== '--output') throw Error('Usage: node tools/implemented-release-packet.mjs --input PUBLIC.json --output NEW.json');
    const inputPath = path.resolve(process.argv[3]), base = path.dirname(inputPath), config = JSON.parse(localJSON(inputPath));
    const packet = validateImplementedReleasePacket({ ...config,
      dagBytes: localJSON(path.resolve(base, config.dagPath)),
      componentPlans: config.componentPlans.map(({ id, sha256, planPath }) => ({ id, sha256, planBytes: localJSON(path.resolve(base, planPath)) })),
    });
    fs.writeFileSync(path.resolve(process.argv[5]), JSON.stringify(packet, null, 2) + '\n', { flag: 'wx' });
    console.log(JSON.stringify({ preparationComplete: packet.preparationComplete, blockers: packet.blockers.length, productionApproved: false }));
    process.exitCode = packet.preparationComplete ? 0 : 2;
  } catch (error) { console.error(`implemented-release-packet: ${error.message}`); process.exitCode = 1; }
}
