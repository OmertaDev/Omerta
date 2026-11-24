// Pure HOST regressions against the actual accepted graph, not a reconstructed graph.
// node test/implemented-release-packet.mjs --dag <accepted implemented-deployment-dag-v4/DAG.json>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ACCEPTED_DAG_SHA256, validateImplementedReleasePacket } from '../tools/implemented-release-packet.mjs';

assert.equal(process.argv.length, 4, 'Supply --dag with the actual accepted V4 JSON');
assert.equal(process.argv[2], '--dag');
const dagPath = path.resolve(process.argv[3]), dagBytes = fs.readFileSync(dagPath, 'utf8');
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
assert.equal(digest(dagBytes), ACCEPTED_DAG_SHA256);
const dag = JSON.parse(dagBytes), nodes = new Map([...dag.nodes, ...dag.setupNodes].map(n => [n.id, n]));
const H = 'a'.repeat(64), addr = n => `0x${BigInt(n).toString(16).padStart(40, '0')}`;
const clone = value => JSON.parse(JSON.stringify(value));
const code = (result, name) => result.blockers.some(row => row.code === name);
let passed = 0;
function test(name, run) { run(); passed++; console.log(`PASS ${name}`); }

function fixture(actions, hook = 'ZERO', getter = 'SELECTED_MANIFEST_POOL_MANAGER') {
  const branch = { selectedSettlementHook: hook, positionManagerPoolManagerGetter: getter };
  const applies = e => !e.condition || Object.entries(e.condition).every(([k, v]) => branch[k] === v);
  const edges = [...dag.constructorAndPredeploymentStateEdges, ...dag.setupActivationEdges,
    ...dag.strictConstructorDependencies.map(e => ({ from: e.dependency, to: e.consumer })),
    ...dag.setupNodes.flatMap(n => n.dependsOn.map(from => ({ from, to: n.id }))),
    ...dag.conditionalConstructorDependencies.filter(applies), ...dag.conditionalSetupActivationEdges.filter(applies)];
  const selected = new Set(actions);
  for (let changed = true; changed;) {
    changed = false;
    for (const e of edges) if (selected.has(e.to) && !selected.has(e.from)) { selected.add(e.from); changed = true; }
  }
  const addresses = new Map([...nodes.keys()].map((id, i) => [id, addr(i + 1)]));
  const selectedNodes = [...selected].map(id => nodes.get(id));
  const sourcePins = new Map();
  for (const n of selectedNodes) for (const s of [n.source, n.sourceExcerpt?.source, ...(n.methods || []).map(m => m.source)].filter(Boolean)) sourcePins.set(s.path, { path: s.path, sha256: s.sha256 });
  const publicMethods = n => [...new Set((n.methods || []).filter(m => !m.method.startsWith('_')).map(m => m.method))];
  const groups = selectedNodes.filter(n => !dag.nodes.some(d => d.id === n.id) && n.type !== 'PREDEPLOYMENT_READ_ONLY_GATE');
  const release = { schemaVersion: 1, id: 'synthetic-structural-review-only', chainId: 31337,
    candidateRevision: dag.sourceRevision, scope: 'implemented-components', branch,
    selectedNodeIds: [...selected], roles: [{ id: 'deployer', address: addr(500) }, { id: 'safe', address: addr(501) }],
    evidence: [{ id: 'supplied-synthetic-evidence', sha256: H }], artifacts: [],
    nodeAddresses: [...addresses].map(([nodeId, address]) => ({ nodeId, address })),
    preexisting: selectedNodes.filter(n => !actions.includes(n.id)).map(n => ({ nodeId: n.id, runtimeHash: H,
      evidenceIds: ['supplied-synthetic-evidence'], methods: publicMethods(n) })),
    groupRequirements: groups.map(n => ({ nodeId: n.id, methods: publicMethods(n), omittedMethods: [] })),
    externalBindings: dag.externalConstructorBindingsUnresolved.filter(b => selected.has(b.consumer)).map((b, i) => ({
      id: `${b.consumer}:${b.argumentPath}`, address: addr(1000 + i), evidenceIds: ['supplied-synthetic-evidence'] })),
    getterObservation: { positionManager: addresses.get('historical-positionmanager'),
      returnedAddress: getter === 'EXTERNAL' ? addr(900) : addresses.get('historical-poolmanager'), returnedCodeHash: H, evidenceIds: ['supplied-synthetic-evidence'] },
  };
  const steps = [], bindings = [], artifacts = {};
  let nonce = 0, safeNonce = 0;
  for (const id of actions) {
    const n = nodes.get(id), deployment = dag.nodes.some(n => n.id === id);
    if (n.type === 'PREDEPLOYMENT_READ_ONLY_GATE') {
      bindings.push({ planId: 'encoded', stepIndex: steps.length, nodeId: id, evidenceIds: ['supplied-synthetic-evidence'] });
      steps.push({ kind: 'readiness', label: 'Supplied observation only' }); continue;
    }
    artifacts[n.contract] = { artifactSha256: H };
    release.artifacts.push({ id, nodeId: id, sha256: H });
    for (const method of deployment ? [null] : publicMethods(n)) {
      const target = dag.nodes.find(d => d.contract === n.contract);
      bindings.push({ planId: 'encoded', stepIndex: steps.length, nodeId: id, roleId: deployment ? 'deployer' : 'safe', artifactId: id,
        ...(method ? { method, targetNodeId: target.id } : {}), evidenceIds: ['supplied-synthetic-evidence'] });
      // Opaque already encoded bytes: deliberately no ABI/cryptographic meaning is asserted.
      steps.push(deployment ? { kind: 'deployment', method: 'CREATE', contract: n.contract, expectedAddress: addresses.get(id),
        transaction: { chainId: 31337, from: addr(500), nonce: String(nonce++), value: '0', data: '0x60006000' } }
        : { kind: 'call', functionName: method, transaction: { chainId: 31337, from: addr(501), nonce: String(safeNonce++), to: addresses.get(target.id), value: '0', data: '0x12345678' } });
    }
  }
  const bytes = JSON.stringify({ mode: 'offline-unsigned', sourceRevision: dag.sourceRevision, chainId: 31337,
    canonicalPool: { hooks: hook === 'ZERO' ? addr(0) : addresses.get('historical-hook') }, artifacts, steps });
  return { dagBytes, expectedDagSha256: ACCEPTED_DAG_SHA256, release, candidateSourcePins: [...sourcePins.values()],
    componentPlans: [{ id: 'encoded', sha256: digest(bytes), planBytes: bytes }], stepBindings: bindings };
}
const validate = input => validateImplementedReleasePacket(input);
function editPlan(input, edit) {
  const plan = JSON.parse(input.componentPlans[0].planBytes); edit(plan);
  const bytes = JSON.stringify(plan); input.componentPlans[0].planBytes = bytes; input.componentPlans[0].sha256 = digest(bytes);
}
function good(input) { const result = validate(input); assert.deepEqual(result.blockers, []); return result; }

test('accepted V4 graph and bounded supplied-metadata packet; no full launch or ABI claim', () => {
  const input = fixture(['historical-poolmanager', 'check-positionmanager-poolmanager-code', 'historical-commitment']);
  const result = good(input);
  assert.equal(result.preparationComplete, true); assert.equal(result.productionApproved, false);
  assert.equal(result.fullPrivateLaunchReady, false); assert.equal(result.limits.calldataABISemanticsVerified, false);
  assert.equal(result.unresolvedFullLaunchCapabilities.length, 15);
  assert.deepEqual(result.steps.map(s => s.step), JSON.parse(input.componentPlans[0].planBytes).steps);
});
test('all four actual V4 branch combinations retain manager-before-getter-before-vault', () => {
  for (const hook of ['ZERO', 'NONZERO']) for (const getter of ['EXTERNAL', 'SELECTED_MANIFEST_POOL_MANAGER']) good(fixture([
    'historical-poolmanager', 'check-positionmanager-poolmanager-code', 'historical-commitment'], hook, getter));
});
test('V3 getter-order counterexample rejected in manifest-manager branch, external branch differs', () => {
  const actions = ['check-positionmanager-poolmanager-code', 'historical-poolmanager', 'historical-commitment'];
  const result = validate(fixture(actions));
  assert.ok(result.blockers.some(b => b.code === 'DEPENDENCY_ORDER' && b.detail === 'historical-poolmanager>check-positionmanager-poolmanager-code'));
  good(fixture(actions, 'ZERO', 'EXTERNAL'));
});
test('known future manager address does not become a strict descriptor deployment prerequisite', () => {
  const input = fixture(['historical-descriptor']), result = good(input);
  assert.equal(input.release.selectedNodeIds.includes('historical-poolmanager'), false);
  assert.ok(result.knownAddressBindings.some(b => b.consumer === 'historical-descriptor' && b.dependency === 'historical-poolmanager'));
  input.release.nodeAddresses = input.release.nodeAddresses.filter(n => n.nodeId !== 'historical-poolmanager');
  assert.ok(code(validate(input), 'KNOWN_ADDRESS_MISSING'));
});
test('nonzero-hook pool setup requires completed admission, zero branch does not add that edge', () => {
  const actions = ['setup-pool-key', 'setup-token-admission'];
  assert.ok(validate(fixture(actions, 'NONZERO')).blockers.some(b => b.code === 'DEPENDENCY_ORDER' && b.detail === 'setup-token-admission>setup-pool-key'));
  good(fixture(actions, 'ZERO'));
  good(fixture([...actions].reverse(), 'NONZERO'));
});
test('branch labels cannot contradict the supplied getter response or component pool metadata', () => {
  const getter = fixture(['historical-commitment'], 'ZERO', 'EXTERNAL');
  getter.release.getterObservation.returnedAddress = getter.release.nodeAddresses.find(n => n.nodeId === 'historical-poolmanager').address;
  assert.ok(code(validate(getter), 'GETTER_OBSERVATION'));
  const hook = fixture(['setup-pool-key']); editPlan(hook, p => { p.canonicalPool.hooks = addr(123); });
  assert.ok(code(validate(hook), 'HOOK_BRANCH_BINDING'));
});
test('group completion requires every declared public call; internal evidence methods cannot be calls', () => {
  const input = fixture(['setup-token-admission']); good(input);
  editPlan(input, p => p.steps.pop()); input.stepBindings.pop();
  assert.ok(code(validate(input), 'GROUP_CALL_MISSING'));
  const internal = fixture(['setup-token-admission']);
  editPlan(internal, p => { p.steps[0].functionName = '_bind'; }); internal.stepBindings[0].method = '_bind';
  assert.ok(code(validate(internal), 'PUBLIC_METHOD_BINDING'));
});
test('missing and stale source pins, omitted predecessor and unresolved branch fail closed', () => {
  let input = fixture(['historical-poolmanager']); input.candidateSourcePins.pop(); assert.ok(code(validate(input), 'SOURCE_PIN_MISMATCH'));
  input = fixture(['historical-poolmanager']); input.candidateSourcePins[0].sha256 = H; assert.ok(code(validate(input), 'SOURCE_PIN_MISMATCH'));
  input = fixture(['historical-poolmanager']); input.release.selectedNodeIds = input.release.selectedNodeIds.filter(n => n !== 'historical-omr');
  assert.ok(code(validate(input), 'OMITTED_PREDECESSOR'));
  input = fixture(['historical-poolmanager']); delete input.release.branch; assert.ok(code(validate(input), 'BRANCH_UNRESOLVED'));
});
test('duplicate, unknown, uncovered and duplicate-node mappings are refused', () => {
  let input = fixture(['historical-poolmanager']); input.stepBindings.push(clone(input.stepBindings[0])); assert.ok(code(validate(input), 'DUPLICATE_MAPPING'));
  input = fixture(['historical-poolmanager']); input.stepBindings[0].nodeId = 'invented'; assert.ok(code(validate(input), 'UNKNOWN_MAPPING'));
  input = fixture(['historical-poolmanager']); input.stepBindings = []; assert.ok(code(validate(input), 'UNMAPPED_STEP'));
  input = fixture(['historical-poolmanager']); editPlan(input, p => p.steps.push(clone(p.steps[0])));
  input.stepBindings.push({ ...input.stepBindings[0], stepIndex: 1 }); assert.ok(code(validate(input), 'DUPLICATE_NODE_MAPPING'));
});
test('component digest, candidate revision, chain, artifact and role bindings are enforced', () => {
  let input = fixture(['historical-poolmanager']); input.componentPlans[0].sha256 = H; assert.ok(code(validate(input), 'COMPONENT_PLAN'));
  input = fixture(['historical-poolmanager']); editPlan(input, p => { p.sourceRevision = 'b'.repeat(40); }); assert.ok(code(validate(input), 'COMPONENT_PLAN'));
  input = fixture(['historical-poolmanager']); editPlan(input, p => { p.chainId = 4663; }); assert.ok(code(validate(input), 'COMPONENT_PLAN'));
  input = fixture(['historical-poolmanager']); input.release.artifacts = []; assert.ok(code(validate(input), 'MISSING_ARTIFACT'));
  input = fixture(['historical-poolmanager']); editPlan(input, p => { p.artifacts.OmertaPoolManagerV2.artifactSha256 = 'b'.repeat(64); });
  assert.ok(code(validate(input), 'COMPONENT_ARTIFACT_BINDING'));
  input = fixture(['historical-poolmanager']); input.release.roles = []; assert.ok(code(validate(input), 'MISSING_ROLE'));
});
test('nonce conflict and wrong call target are refused without repairing or reordering', () => {
  const input = fixture(['historical-poolmanager', 'historical-router']);
  editPlan(input, p => { p.steps[1].transaction.nonce = '0'; }); assert.ok(code(validate(input), 'NONCE_SEQUENCE'));
  const calls = fixture(['setup-pool-key']); editPlan(calls, p => { p.steps[0].transaction.to = addr(800); });
  assert.ok(code(validate(calls), 'CALL_TARGET'));
});
test('a graph cannot be rebound to a new revision; collisions and unnumbered deployer calls block', () => {
  let input = fixture(['historical-poolmanager']); input.release.candidateRevision = 'b'.repeat(40);
  editPlan(input, p => { p.sourceRevision = input.release.candidateRevision; });
  assert.ok(code(validate(input), 'DAG_CANDIDATE_REVISION'));
  input = fixture(['historical-poolmanager']); input.release.nodeAddresses[1].address = input.release.nodeAddresses[0].address;
  assert.ok(code(validate(input), 'DEPLOYMENT_ADDRESS_COLLISION'));
  input = fixture(['historical-poolmanager', 'setup-pool-key']);
  input.release.roles[1].address = addr(500); editPlan(input, p => { p.steps[1].transaction.from = addr(500); delete p.steps[1].transaction.nonce; });
  assert.ok(code(validate(input), 'NONCE_MISSING'));
  input = fixture(['historical-poolmanager']); input.release.productionApproved = true;
  assert.ok(code(validate(input), 'UNKNOWN_RELEASE_FIELD'));
});
test('call-only plans with preexisting contracts cannot omit all sender nonces', () => {
  const input = fixture(['setup-token-admission']); good(input);
  editPlan(input, p => { for (const step of p.steps) delete step.transaction.nonce; });
  const result = validate(input);
  assert.equal(result.preparationComplete, false);
  assert.equal(result.blockers.filter(b => b.code === 'NONCE_MISSING').length, 3);
});
test('numbered calls from one sender do not resolve a distinct sender nonce envelope', () => {
  const input = fixture(['setup-token-admission']);
  input.release.roles.push({ id: 'another-explicit-caller', address: addr(502) });
  input.stepBindings[1].roleId = 'another-explicit-caller';
  editPlan(input, p => {
    p.steps[1].transaction.from = addr(502); delete p.steps[1].transaction.nonce;
    p.steps[2].transaction.nonce = '1';
  });
  const result = validate(input);
  assert.deepEqual(result.blockers, [{ code: 'NONCE_MISSING', detail: 'encoded:1' }]);
});
test('top-level accessors and proxies are rejected without invoking them', () => {
  for (const key of ['dagBytes', 'release', 'expectedDagSha256']) {
    const input = fixture(['historical-poolmanager']), value = input[key]; let reads = 0;
    Object.defineProperty(input, key, { enumerable: true, get() { reads++; return value; } });
    assert.ok(code(validate(input), 'INVALID_INPUT')); assert.equal(reads, 0, key);
  }
  let traps = 0;
  const handlers = { get() { traps++; throw Error('unexpected get'); }, ownKeys() { traps++; throw Error('unexpected ownKeys'); },
    getPrototypeOf() { traps++; throw Error('unexpected prototype'); }, getOwnPropertyDescriptor() { traps++; throw Error('unexpected descriptor'); } };
  assert.ok(code(validate(new Proxy({}, handlers)), 'INVALID_INPUT')); assert.equal(traps, 0);
  const nested = fixture(['historical-poolmanager']); nested.release = new Proxy({}, handlers);
  assert.ok(code(validate(nested), 'INVALID_INPUT')); assert.equal(traps, 0);
});
test('signed/raw payloads, credentials, getters, sparse arrays and malformed steps are refused', () => {
  for (const key of ['signature', 'signatures', 'signatureBytes', 'rawTransaction', 'signedTransaction', 'privateKey', 'private_key', 'rpcUrl']) {
    const input = fixture(['historical-poolmanager']); editPlan(input, p => { p.steps[0].transaction[key] = '0x00'; });
    assert.ok(code(validate(input), 'COMPONENT_PLAN'), key);
  }
  const input = fixture(['historical-poolmanager']); Object.defineProperty(input.release, 'secret', { enumerable: true, get() { throw Error('must not invoke'); } });
  assert.ok(code(validate(input), 'INVALID_INPUT'));
  const sparse = fixture(['historical-poolmanager']); sparse.stepBindings = Array(1); sparse.stepBindings.extra = {}; assert.ok(code(validate(sparse), 'INVALID_INPUT'));
  const malformed = fixture(['historical-poolmanager']); editPlan(malformed, p => { p.steps[0] = null; }); assert.ok(code(validate(malformed), 'STEP_SHAPE'));
});
test('missing evidence/external bindings, invalid getters and changed graph cannot become ready', () => {
  let input = fixture(['historical-poolmanager']); input.release.evidence = []; assert.ok(code(validate(input), 'MISSING_EVIDENCE'));
  input = fixture(['historical-poolmanager']); input.release.externalBindings = []; assert.ok(code(validate(input), 'EXTERNAL_BINDING_MISSING'));
  input = fixture(['historical-commitment']); input.release.getterObservation.returnedAddress = addr(999); assert.ok(code(validate(input), 'GETTER_OBSERVATION'));
  input = fixture(['historical-poolmanager']); input.dagBytes = '{}'; assert.ok(code(validate(input), 'DAG_PIN_MISMATCH'));
});
test('Buffer coercion cannot replace pinned graph content or execute a callback', () => {
  const input = fixture(['historical-poolmanager']), buffer = Buffer.from(dagBytes);
  const changedGraph = JSON.parse(dagBytes); changedGraph.conditionalConstructorDependencies = [];
  let calls = 0;
  buffer.toString = () => { calls++; return JSON.stringify(changedGraph); };
  assert.equal(digest(buffer), ACCEPTED_DAG_SHA256, 'raw Buffer still contains the accepted bytes');
  input.dagBytes = buffer;
  const result = validate(input);
  assert.ok(code(result, 'INVALID_INPUT')); assert.equal(result.preparationComplete, false);
  assert.equal(calls, 0); assert.equal(result.productionApproved, false);
  const boxed = fixture(['historical-poolmanager']); boxed.dagBytes = new String(dagBytes);
  assert.ok(code(validate(boxed), 'INVALID_INPUT'));
});
test('malformed nested JSON returns blocked packets instead of invoking coercion or throwing', () => {
  let input = fixture(['historical-poolmanager']); input.release.selectedNodeIds.push({}); assert.ok(code(validate(input), 'UNKNOWN_NODE'));
  input = fixture(['historical-poolmanager']); input.stepBindings[0].evidenceIds = [{}]; assert.ok(code(validate(input), 'MISSING_EVIDENCE'));
  input = fixture(['historical-poolmanager']); editPlan(input, p => { p.steps[0].transaction.from = {}; }); assert.ok(code(validate(input), 'CALLER_BINDING'));
  input = fixture(['setup-token-admission']); input.release.groupRequirements[0].methods = [{}]; assert.ok(code(validate(input), 'GROUP_REQUIREMENTS'));
});
test('returned packet is deeply immutable and detached from inputs', () => {
  const input = fixture(['historical-poolmanager']), result = good(input);
  assert.throws(() => { result.steps[0].step.transaction.value = '99'; }, TypeError);
  input.release.roles[0].address = addr(999); input.candidateSourcePins[0].sha256 = H;
  assert.notEqual(result.release.roles[0].address, addr(999)); assert.notEqual(result.candidateSourcePins[0].sha256, H);
});
test('CLI uses explicit files, preserves new-output-only semantics and writes blocked reviews', () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-release-packet-'));
  try {
    const input = fixture(['historical-descriptor']), plan = input.componentPlans[0], config = { ...input, dagPath, componentPlans: [{ id: plan.id, sha256: plan.sha256, planPath: 'plan.json' }] };
    delete config.dagBytes;
    fs.writeFileSync(path.join(folder, 'plan.json'), plan.planBytes); fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(config));
    const cli = fileURLToPath(new URL('../tools/implemented-release-packet.mjs', import.meta.url));
    const args = [cli, '--input', path.join(folder, 'input.json'), '--output', path.join(folder, 'review.json')];
    assert.equal(spawnSync(process.execPath, args, { encoding: 'utf8' }).status, 0);
    const original = fs.readFileSync(path.join(folder, 'review.json'));
    assert.equal(spawnSync(process.execPath, args, { encoding: 'utf8' }).status, 1);
    assert.deepEqual(fs.readFileSync(path.join(folder, 'review.json')), original);
    config.candidateSourcePins = []; fs.writeFileSync(path.join(folder, 'input.json'), JSON.stringify(config));
    args[4] = path.join(folder, 'blocked.json');
    assert.equal(spawnSync(process.execPath, args, { encoding: 'utf8' }).status, 2);
    assert.equal(JSON.parse(fs.readFileSync(path.join(folder, 'blocked.json'))).productionApproved, false);
  } finally {
    const target = fs.realpathSync(folder), base = fs.realpathSync(os.tmpdir());
    assert.equal(path.dirname(target), base); assert.ok(path.basename(target).startsWith('omerta-release-packet-'));
    fs.rmSync(target, { recursive: true });
  }
});
console.log(`${passed} groups passed; actual accepted V4 graph; supplied synthetic encoded bytes only; no compiler, SDK, network or production.`);
