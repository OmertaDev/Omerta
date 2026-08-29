// CONTENT GRAPH — deterministic authored-content compiler and promotion gate.
//
// Break caught: removing the compiler CLI, accepting a malformed pack, or reporting a vacuous
// zero-node build makes this suite fail at the public tool boundary rather than by grepping source.
import assert from 'node:assert';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as ContentCompiler from '../src/content/compiler.js';

const { compileContentPack, validateRuntimeContentPack } = ContentCompiler;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const fixture = path.join(ROOT, 'test', 'fixtures', 'content', 'valid-minimal.json');
const run = spawnSync(process.execPath, ['tools/content.js', 'check', fixture], {
  cwd: ROOT,
  encoding: 'utf8',
});

assert.equal(run.status, 0, `content check failed:\n${run.stdout}\n${run.stderr}`);
const summary = JSON.parse(run.stdout);
assert.deepEqual(
  { ok: summary.ok, namespace: summary.namespace, version: summary.version, nodes: summary.nodes, edges: summary.edges },
  { ok: true, namespace: 'test.minimal', version: 1, nodes: 2, edges: 1 },
  'the CLI validates and counts the authored graph',
);
assert.match(summary.contentHash, /^[a-f0-9]{64}$/, 'the compiled bundle carries a full SHA-256 content hash');

console.log('✓ content CLI validates a non-vacuous pack and emits its deterministic bundle identity');

// Break caught: traversing filesystem/agent output in a different order must not create a new bundle.
const ordered = {
  schemaVersion: 1,
  namespace: 'test.determinism',
  version: 3,
  growth: { role: 'internal_only', exemptReason: 'Determinism fixture.' },
  nodes: [
    { id: 'a', type: 'mystery', payload: { title: 'Start', difficulty: 1 } },
    { id: 'b', type: 'puzzle', payload: { answer: { kind: 'text' } } },
    { id: 'c', type: 'terminal', payload: {} },
  ],
  edges: [
    { from: 'a', type: 'UNLOCKS', to: 'b' },
    { from: 'b', type: 'UNLOCKS', to: 'c' },
  ],
};
const reordered = {
  version: 3,
  namespace: 'test.determinism',
  schemaVersion: 1,
  edges: [...ordered.edges].reverse(),
  nodes: [
    { payload: {}, type: 'terminal', id: 'c' },
    { payload: { answer: { kind: 'text' } }, id: 'b', type: 'puzzle' },
    { payload: { difficulty: 1, title: 'Start' }, type: 'mystery', id: 'a' },
  ],
  growth: { exemptReason: 'Determinism fixture.', role: 'internal_only' },
};
assert.equal(
  compileContentPack(ordered).contentHash,
  compileContentPack(reordered).contentHash,
  'semantic node/edge ordering does not change the bundle hash',
);
console.log('✓ canonical bundle identity is independent of author/object/node/edge ordering');

// Break caught: a typo in an agent-authored dependency must fail promotion instead of creating a
// permanently unreachable mystery branch.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.dangling',
    edges: [{ from: 'a', type: 'UNLOCKS', to: 'missing' }],
  }),
  /edge a -\[UNLOCKS\]-> missing references a missing node/,
  'dangling graph edges fail closed',
);
console.log('✓ dangling authored dependencies fail closed with the exact edge named');

// Break caught: arbitrary agent-authored node/evaluator kinds must never enter the runtime DSL.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.unknown-node',
    nodes: [{ id: 'a', type: 'eval_javascript', payload: { source: 'return true' } }],
    edges: [],
  }),
  /node a has unknown type eval_javascript/,
  'unknown node kinds are rejected',
);
console.log('✓ node ontology is allowlisted; authored executable kinds fail closed');

// Break caught: an agent cannot invent an edge verb whose runtime meaning was never reviewed.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.unknown-edge',
    edges: [{ from: 'a', type: 'RUNS_SQL', to: 'b' }],
  }),
  /edge a -\[RUNS_SQL\]-> b has unknown type/,
  'unknown dependency verbs are rejected',
);
console.log('✓ edge ontology is allowlisted; unknown dependency verbs fail closed');

// Break caught: two authoring agents cannot silently overwrite or ambiguously target the same node.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.duplicate-node',
    nodes: [
      { id: 'a', type: 'mystery', payload: { title: 'First' } },
      { id: 'a', type: 'terminal', payload: {} },
    ],
    edges: [],
  }),
  /duplicate node id a/,
  'node ids are unique within a versioned namespace',
);
console.log('✓ duplicate node identities fail closed before dependency resolution');

// Break caught: duplicate dependencies with the same ordinal otherwise hash according to authoring
// traversal order and can double-apply a runtime contribution.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.duplicate-edge',
    edges: [
      { from: 'a', type: 'UNLOCKS', to: 'b' },
      { from: 'a', type: 'UNLOCKS', to: 'b' },
    ],
  }),
  /duplicate edge a -\[UNLOCKS\]-> b at ordinal 0/,
  'dependency identities are unique',
);
console.log('✓ duplicate dependencies fail closed before hashing or runtime application');

// Break caught: content authors may compose reviewed gate primitives, never inject evaluators.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.unknown-gate',
    nodes: [
      { id: 'a', type: 'mystery', payload: { gates: [{ kind: 'javascript', source: 'return true' }] } },
    ],
    edges: [],
  }),
  /node a gate 0 has unknown kind javascript/,
  'gate kinds are declarative and allowlisted',
);
console.log('✓ arbitrary authored gate evaluators cannot enter the compiled bundle');

// Break caught: effects remain a finite server-owned vocabulary, including money movement.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.unknown-effect',
    nodes: [
      { id: 'a', type: 'terminal', payload: { effects: [{ kind: 'run_sql', sql: 'UPDATE users' }] } },
    ],
    edges: [],
  }),
  /node a effect 0 has unknown kind run_sql/,
  'effect kinds are declarative and allowlisted',
);
console.log('✓ arbitrary authored effects cannot execute through the content runtime');

// Break caught: every pack must either declare a growth role or explain why it is intentionally
// internal, so mass authoring cannot quietly produce an acquisition-dead catalog.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.missing-growth-exemption',
    growth: { role: 'internal_only' },
  }),
  /internal_only growth role requires exemptReason/,
  'internal-only packs carry an explicit growth exemption',
);
console.log('✓ growth intent is mandatory even for intentionally internal content');

const agentCashPack = {
  schemaVersion: 1,
  namespace: 'test.agent-cash',
  version: 1,
  growth: {
    role: 'human_collaboration',
    audienceHypothesis: 'puzzle_communities',
    publicHook: 'hook',
    attributionPolicy: 'direct_once_with_consent',
    qualificationPolicy: 'agent_human_v1',
    rewardProfile: 'agent_cash_capability_status',
    externalActionPolicy: 'approved_asset_only',
    retentionCheckpoint: 'retained',
  },
  nodes: [
    { id: 'hook', type: 'public_hook', payload: { disclosure: 'ai_agent_promoting_omerta' } },
    { id: 'campaign', type: 'acquisition_campaign', payload: { externalActionPolicy: 'approved_asset_only' } },
    { id: 'entry', type: 'referral_entry', payload: { attributionPolicy: 'direct_once_with_consent' } },
    { id: 'activated', type: 'newcomer_activation', payload: { qualificationPolicy: 'agent_human_v1' } },
    { id: 'agent-role', type: 'role', payload: { participantKinds: ['agent'] } },
    { id: 'human-role', type: 'role', payload: { participantKinds: ['human_eligible_non_agent'], consentRequired: true } },
    { id: 'collaboration', type: 'human_agent_collaboration', payload: { consentRequired: true, uniqueParticipants: true } },
    { id: 'retained', type: 'retention_checkpoint', payload: { distinctActiveDays: 3 } },
    {
      id: 'cash-budget',
      type: 'budget',
      payload: { currency: 'cash', liabilityCap: 10000, reserved: 10000, maxRecruits: 20 },
    },
    {
      id: 'qualified-cash',
      type: 'agent_recruitment_reward',
      payload: {
        milestone: 'qualified_activation',
        currency: 'cash',
        amount: 250,
        budgetId: 'cash-budget',
        ledgerReason: 'referral:agent_qualified',
        claimKey: 'direct_recruiter_recruit_campaign_milestone',
        directOnly: true,
        eligibleRecruiterKinds: ['agent'],
        eligibleRecruitKinds: ['human_eligible_non_agent'],
      },
    },
    { id: 'done', type: 'terminal', payload: {} },
  ],
  edges: [
    { from: 'hook', type: 'ATTRACTS_TO', to: 'campaign' },
    { from: 'campaign', type: 'ATTRACTS_TO', to: 'entry' },
    { from: 'entry', type: 'ACTIVATES', to: 'activated' },
    { from: 'activated', type: 'COLLABORATES_WITH', to: 'collaboration' },
    { from: 'collaboration', type: 'PERFORMED_BY_ROLE', to: 'agent-role' },
    { from: 'collaboration', type: 'PERFORMED_BY_ROLE', to: 'human-role' },
    { from: 'collaboration', type: 'RETURNS_FOR', to: 'retained' },
    { from: 'activated', type: 'REWARDS_RECRUITER', to: 'qualified-cash' },
    { from: 'qualified-cash', type: 'REQUIRES', to: 'cash-budget' },
    { from: 'retained', type: 'UNLOCKS', to: 'done' },
  ],
};

// Break caught: agents are eligible for real referral cash, but never for raw reach or signup.
const rawSignupCash = structuredClone(agentCashPack);
rawSignupCash.nodes.find((node) => node.id === 'qualified-cash').payload.milestone = 'signup';
assert.throws(
  () => compileContentPack(rawSignupCash),
  /agent reward qualified-cash cannot reward raw signal signup/,
  'raw signup is not an agent-cash milestone',
);
console.log('✓ agent cash is confined to qualified activation/retention, never raw signup');

// Break caught: a valid milestone still cannot mint an unfunded cash liability.
const underfundedAgentCash = structuredClone(agentCashPack);
underfundedAgentCash.nodes.find((node) => node.id === 'cash-budget').payload.reserved = 100;
assert.throws(
  () => compileContentPack(underfundedAgentCash),
  /agent reward qualified-cash exceeds reserved cash budget cash-budget/,
  'agent cash is bounded by an explicit reserve',
);
console.log('✓ agent referral cash must fit inside an explicit reserved liability');

// Break caught: a future blanket "no bots get cash" edit cannot silently erase the explicitly
// requested agent-recruiter payout profile.
const excludesAgentRecruiter = structuredClone(agentCashPack);
excludesAgentRecruiter.nodes.find((node) => node.id === 'qualified-cash').payload.eligibleRecruiterKinds = ['human'];
assert.throws(
  () => compileContentPack(excludesAgentRecruiter),
  /agent reward qualified-cash must target agent recruiters/,
  'agent recruitment rewards explicitly admit agent recruiters',
);
const compiledAgentCash = compileContentPack(agentCashPack);
assert.match(compiledAgentCash.contentHash, /^[a-f0-9]{64}$/);
console.log('✓ the reviewed graph explicitly compiles cash rewards for agent recruiters');

// Break caught: an accidental dependency loop generated by separate authors cannot deadlock an
// activation graph. Repeatable economy loops need an explicit future runtime contract.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.cycle',
    edges: [
      { from: 'a', type: 'UNLOCKS', to: 'b' },
      { from: 'b', type: 'UNLOCKS', to: 'c' },
      { from: 'c', type: 'REQUIRES', to: 'a' },
    ],
  }),
  /dependency cycle: a -> b -> c -> a/,
  'dependency cycles fail promotion',
);
console.log('✓ accidental content dependency cycles fail with the exact cycle path');

// Break caught: a validated graph must be materializable as immutable, byte-stable runtime input.
const buildDir = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-content-build-'));
try {
  const outputPath = path.join(buildDir, 'minimal-v1.json');
  const firstBuild = spawnSync(process.execPath, ['tools/content.js', 'build', fixture, outputPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(firstBuild.status, 0, `content build failed:\n${firstBuild.stdout}\n${firstBuild.stderr}`);
  const firstBytes = fs.readFileSync(outputPath, 'utf8');
  const artifact = JSON.parse(firstBytes);
  assert.equal(artifact.contentHash, summary.contentHash, 'check and build compile the same identity');

  const secondBuild = spawnSync(process.execPath, ['tools/content.js', 'build', fixture, outputPath], {
    cwd: ROOT,
    encoding: 'utf8',
  });
  assert.equal(secondBuild.status, 0, 'rebuilding the identical immutable version is idempotent');
  assert.equal(fs.readFileSync(outputPath, 'utf8'), firstBytes, 'rebuild output is byte-identical');
} finally {
  fs.rmSync(buildDir, { recursive: true, force: true });
}
console.log('✓ build emits a byte-identical immutable bundle and supports idempotent rebuilds');

// Break caught: content can motivate and prepare a creative campaign, but the runtime cannot grant
// agents an unreviewed publishing/contact capability.
const autonomousOutreach = structuredClone(agentCashPack);
autonomousOutreach.growth.externalActionPolicy = 'autonomous_posting';
assert.throws(
  () => compileContentPack(autonomousOutreach),
  /growth role human_collaboration requires externalActionPolicy approved_asset_only/,
  'recruitment-aware content is constrained to approved assets',
);
console.log('✓ recruitment graphs cannot authorize autonomous outreach or publication');

// Break caught: seasonal OMR can sit behind an achievement graph only as a pre-funded finite
// allocation; merely waiting must never manufacture claimable OMR.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.omr-time-faucet',
    nodes: [{
      id: 'omr',
      type: 'funded_omr_allocation',
      payload: {
        currency: 'OMR',
        amountAtomic: '1000000000000000000',
        funding: 'season_precommitted',
        trigger: 'elapsed_time',
        timeEmission: true,
        claimLimit: 1,
        allocationId: 'test.season.omr',
      },
    }],
    edges: [],
  }),
  /OMR allocation omr must be achievement-triggered and never time-emitting/,
  'time-based OMR is rejected at compile time',
);
console.log('✓ the compiler rejects time-based OMR faucets');

// Break caught: selected rare items may opt into export, but tokenization cannot create a second
// gameplay copy or grant stronger stats.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.pay-to-win-export',
    nodes: [{
      id: 'seal',
      type: 'collectible_def',
      payload: {
        exportPolicy: {
          mode: 'automatic',
          gameplayEffect: 'stat_boost',
          identityPolicy: 'duplicate_on_chain',
        },
      },
    }],
    edges: [],
  }),
  /collectible seal export must be optional, gameplay-inert, and identity-preserving/,
  'NFT export does not alter gameplay power or duplicate identity',
);
console.log('✓ collectible export is optional and gameplay-inert by construction');

// Break caught: agent-authored crafting graphs cannot require an ingredient that the world never
// sources or produces.
assert.throws(
  () => compileContentPack({
    ...ordered,
    namespace: 'test.recipe-dead-input',
    nodes: [
      { id: 'ore', type: 'item_def', payload: { tier: 1 } },
      { id: 'ingot', type: 'item_def', payload: { tier: 2 } },
      { id: 'forge', type: 'recipe', payload: { skill: 'metalwork', minMastery: 1 } },
      { id: 'wear', type: 'sink', payload: { kind: 'durability' } },
    ],
    edges: [
      { from: 'forge', type: 'CONSUMES', to: 'ore', quantity: 2 },
      { from: 'forge', type: 'PRODUCES', to: 'ingot', quantity: 1 },
      { from: 'ingot', type: 'SINKS_TO', to: 'wear' },
    ],
  }),
  /recipe forge input ore has no source or producing recipe/,
  'mandatory recipe inputs have reachable supply',
);
console.log('✓ crafting recipes cannot compile with impossible ingredients');

const itemEconomyPack = {
  ...ordered,
  namespace: 'test.item-economy',
  nodes: [
    { id: 'salvage-budget', type: 'budget', payload: { kind: 'source', maxUnitsPerEpoch: 1000, epoch: 'season' } },
    { id: 'car-salvage', type: 'source', payload: { budgetId: 'salvage-budget', sourceKind: 'car_salvage' } },
    { id: 'ore', type: 'item_def', payload: { tier: 1 } },
    { id: 'ingot', type: 'item_def', payload: { tier: 2 } },
    { id: 'forge', type: 'recipe', payload: { skill: 'metalwork', minMastery: 1 } },
    { id: 'wear', type: 'sink', payload: { kind: 'durability' } },
  ],
  edges: [
    { from: 'car-salvage', type: 'REQUIRES', to: 'salvage-budget' },
    { from: 'car-salvage', type: 'PRODUCES', to: 'ore', quantity: 10 },
    { from: 'forge', type: 'CONSUMES', to: 'ore', quantity: 2 },
    { from: 'forge', type: 'PRODUCES', to: 'ingot', quantity: 1 },
    { from: 'ingot', type: 'SINKS_TO', to: 'wear' },
  ],
};
const unbudgetedSalvage = structuredClone(itemEconomyPack);
unbudgetedSalvage.edges = unbudgetedSalvage.edges.filter((edge) => edge.from !== 'car-salvage' || edge.type !== 'REQUIRES');
assert.throws(
  () => compileContentPack(unbudgetedSalvage),
  /source car-salvage must require finite source budget salvage-budget/,
  'raw-material sources are epoch-budgeted',
);
assert.match(compileContentPack(itemEconomyPack).contentHash, /^[a-f0-9]{64}$/);
console.log('✓ raw material sources compile only with finite epoch budgets');

// Break caught: a recruiter cannot satisfy both sides of a nominal "human collaboration" alone.
const noHumanSeat = structuredClone(agentCashPack);
noHumanSeat.nodes.find((node) => node.id === 'human-role').payload.participantKinds = ['agent'];
assert.throws(
  () => compileContentPack(noHumanSeat),
  /collaboration collaboration requires distinct agent and consenting human-eligible roles/,
  'human-agent collaboration has asymmetric participant requirements',
);
console.log('✓ collaboration graphs require distinct agent and consenting human roles');

// Break caught: the compiler must ship with a non-trivial vertical slice that exercises social
// roles, crafting/salvage, growth, optional export, and finite seasonal OMR together.
const sixthChairPath = path.join(ROOT, 'content', 'packs', 'sixth-chair', 'pack.json');
const sixthChairRun = spawnSync(process.execPath, ['tools/content.js', 'check', sixthChairPath], {
  cwd: ROOT,
  encoding: 'utf8',
});
assert.equal(
  sixthChairRun.status,
  0,
  `Sixth Chair pack failed validation:\n${sixthChairRun.stdout}\n${sixthChairRun.stderr}`,
);
const sixthChairSummary = JSON.parse(sixthChairRun.stdout);
assert.ok(sixthChairSummary.nodes >= 30, 'the vertical slice is not a token example');
assert.ok(sixthChairSummary.edges >= 35, 'the vertical slice exercises an interconnected graph');
const sixthChair = JSON.parse(fs.readFileSync(sixthChairPath, 'utf8'));
const sixthChairTypes = new Set(sixthChair.nodes.map((node) => node.type));
for (const type of [
  'mystery', 'role', 'human_agent_collaboration', 'source', 'recipe', 'sink',
  'agent_recruitment_reward', 'funded_omr_allocation', 'collectible_def',
]) {
  assert.ok(sixthChairTypes.has(type), `Sixth Chair exercises ${type}`);
}
console.log('✓ Sixth Chair vertical slice spans mysteries, social growth, items, export, and finite OMR');

// Break caught: compile-only packs remain broad authoring artifacts, but a pack promoted for live
// execution needs an explicit, closed, capability-checked runtime manifest.
assert.equal(typeof validateRuntimeContentPack, 'function', 'the compiler exports the live-runtime validator');

const runtimeFixturePath = path.join(ROOT, 'test', 'fixtures', 'content', 'runtime-minimal.json');
const runtimePack = JSON.parse(fs.readFileSync(runtimeFixturePath, 'utf8'));

const compiledRuntime = compileContentPack(runtimePack);
assert.strictEqual(
  validateRuntimeContentPack(compiledRuntime),
  compiledRuntime,
  'a supported runtime manifest validates without replacing the immutable bundle object',
);
assert.throws(
  () => validateRuntimeContentPack(compileContentPack(ordered)),
  /runtime manifest is required/,
  'compile-only packs remain valid authoring artifacts but cannot be activated as live runtime content',
);

const invalidRuntime = (mutate) => {
  const pack = structuredClone(runtimePack);
  mutate(pack);
  return () => validateRuntimeContentPack(compileContentPack(pack));
};

assert.throws(
  invalidRuntime((pack) => { pack.runtime.entryNodeId = 'missing'; }),
  /runtime entryNodeId missing references a missing node/,
  'the live entry point must exist',
);
assert.throws(
  invalidRuntime((pack) => { pack.runtime.partyPolicyId = 'quorum'; }),
  /runtime partyPolicyId quorum must reference party_policy/,
  'manifest references carry exact node types',
);
assert.throws(
  invalidRuntime((pack) => { pack.runtime.nodeIds = pack.runtime.nodeIds.filter((id) => id !== 'closed'); }),
  /runtime nodeIds must contain terminalNodeId closed/,
  'the terminal cannot sit outside the executable closure',
);
assert.throws(
  invalidRuntime((pack) => { pack.runtime.actionNodeIds.push('clue'); }),
  /runtime action node clue must be puzzle or choice/,
  'passive definitions cannot become client actions',
);
assert.throws(
  invalidRuntime((pack) => { pack.runtime.actionNodeIds = ['puzzle']; }),
  /runtime actionNodeIds must include action node choice/,
  'an in-profile choice or puzzle cannot become unreachable by omission from the action manifest',
);
assert.throws(
  invalidRuntime((pack) => { pack.runtime.nodeIds.push('case'); }),
  /runtime nodeIds must be a non-empty unique string array/,
  'the executable closure has one stable identity per node',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.nodes.find((node) => node.id === 'witness').payload.participantKinds = ['human_eligible_non_agent', 'moderator'];
  }),
  /runtime role witness has unsupported participant kind moderator/,
  'participant authority comes from the reviewed agent/human vocabulary',
);
assert.throws(
  invalidRuntime((pack) => { pack.nodes.find((node) => node.id === 'puzzle').payload.answerSpecId = 'missing'; }),
  /runtime puzzle puzzle answerSpecId missing references a missing node/,
  'canonical puzzles require a server-side answer specification',
);
assert.throws(
  invalidRuntime((pack) => { pack.nodes.find((node) => node.id === 'puzzle-answer').payload.verifier = 'javascript'; }),
  /runtime answer spec puzzle-answer has unsupported verifier javascript/,
  'answer verification is a finite server-owned vocabulary',
);
assert.throws(
  invalidRuntime((pack) => { pack.nodes.find((node) => node.id === 'puzzle-answer').payload.acceptedValues = []; }),
  /runtime answer spec puzzle-answer requires non-empty acceptedValues/,
  'canonical answer sets cannot be vacuous',
);
assert.throws(
  invalidRuntime((pack) => { pack.nodes.find((node) => node.id === 'choice').payload.options = [{ id: 'only', label: 'Only one road' }]; }),
  /runtime choice choice requires at least two stable options/,
  'choices expose real stable alternatives',
);
assert.throws(
  invalidRuntime((pack) => { pack.nodes.find((node) => node.id === 'choice').payload.options[1].id = 'keep'; }),
  /runtime choice choice has duplicate option id keep/,
  'choice identity never depends on author array order',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.nodes.push({ id: 'deferred-source', type: 'source', payload: { budgetId: 'deferred-budget' } });
    pack.nodes.push({ id: 'deferred-budget', type: 'budget', payload: { kind: 'source', maxUnitsPerEpoch: 1, epoch: 'day' } });
    pack.nodes.push({ id: 'deferred-item', type: 'item_def', payload: {} });
    pack.edges.push({ from: 'deferred-source', type: 'REQUIRES', to: 'deferred-budget' });
    pack.edges.push({ from: 'deferred-source', type: 'PRODUCES', to: 'deferred-item', quantity: 1 });
    pack.runtime.nodeIds.push('deferred-source', 'deferred-budget', 'deferred-item');
  }),
  /runtime node deferred-source has unsupported type source/,
  'deferred crafting/economy nodes fail closed when placed inside the executable profile',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.nodes.find((node) => node.id === 'puzzle').payload.gates = [{ kind: 'stat_at_least', stat: 'muscle', value: 1 }];
  }),
  /runtime node puzzle has unsupported gate stat_at_least/,
  'the runtime cannot accidentally execute an unimplemented gate adapter',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.nodes.find((node) => node.id === 'closed').payload.effects[0].recipientPolicy = undefined;
  }),
  /runtime terminal closed effect 0 requires recipientPolicy all_participants and claimPolicy self/,
  'terminal effects state exactly who earns and who may claim them',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.nodes.find((node) => node.id === 'closed').payload.effects.push({
      kind: 'enqueue_omr_allocation_transfer', allocationId: 'unfunded',
      recipientPolicy: 'all_participants', claimPolicy: 'self',
    });
  }),
  /runtime node closed has unsupported effect enqueue_omr_allocation_transfer/,
  'live OMR settlement remains unavailable until its adapter and funding invariants exist',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.edges.push({ from: 'reward', type: 'REWARDS', to: 'title' });
  }),
  /runtime reward title has duplicate authority from edge and terminal effect/,
  'one terminal effect path, not an edge plus an effect, owns each award',
);
assert.throws(
  invalidRuntime((pack) => {
    pack.nodes.find((node) => node.id === 'clue').payload.shareScope = 'actor_private';
  }),
  /runtime evidence clue has unsupported shareScope actor_private/,
  'the runtime rejects evidence visibility modes it cannot enforce',
);
console.log('✓ live runtime manifests are strict, capability-gated, private-answer-complete, and single-authority');

// Break caught: the runtime contract must ship as reusable authored fixtures, not exist only in this
// test's in-memory object, and the live Sixth Chair version must leave every deferred adapter inert.
const compiledRuntimeFixture = compileContentPack(runtimePack);
assert.strictEqual(validateRuntimeContentPack(compiledRuntimeFixture), compiledRuntimeFixture,
  'the file-backed minimal runtime fixture compiles and runtime-validates');

const sixthChairV2Path = path.join(ROOT, 'content', 'packs', 'sixth-chair-v2', 'pack.json');
const sixthChairV2 = JSON.parse(fs.readFileSync(sixthChairV2Path, 'utf8'));
const compiledSixthChairV2 = compileContentPack(sixthChairV2);
assert.strictEqual(validateRuntimeContentPack(compiledSixthChairV2), compiledSixthChairV2,
  'Sixth Chair v2 is activation-ready for the supported narrative runtime');
assert.equal(sixthChairV2.namespace, 'omerta.sixth-chair');
assert.equal(sixthChairV2.version, 2, 'the live contract is a new immutable version, never an edit to v1');

const v2NodeById = new Map(sixthChairV2.nodes.map((node) => [node.id, node]));
const v2RuntimeIds = new Set(sixthChairV2.runtime.nodeIds);
const v2ProfileTypes = new Set(sixthChairV2.runtime.nodeIds.map((id) => v2NodeById.get(id).type));
for (const deferredType of [
  'public_hook', 'acquisition_campaign', 'referral_entry', 'newcomer_activation',
  'source', 'budget', 'item_def', 'recipe', 'sink', 'tool', 'facility', 'skill_track',
  'retention_checkpoint', 'agent_recruitment_reward', 'funded_omr_allocation', 'season_overlay',
]) {
  assert.equal(v2ProfileTypes.has(deferredType), false, `Sixth Chair v2 keeps ${deferredType} outside the executable profile`);
}
assert(sixthChairV2.nodes.some((node) => node.type === 'source' && !v2RuntimeIds.has(node.id)),
  'the deferred salvage graph remains authored and explicitly inert');
assert(sixthChairV2.nodes.some((node) => node.type === 'funded_omr_allocation' && !v2RuntimeIds.has(node.id)),
  'the deferred OMR allocation remains authored and explicitly inert');

const v2Puzzles = sixthChairV2.runtime.actionNodeIds.map((id) => v2NodeById.get(id)).filter((node) => node.type === 'puzzle');
assert.equal(v2Puzzles.length, 3, 'Archivist, Driver, and Broker each get a canonical puzzle');
for (const puzzle of v2Puzzles) {
  const answerSpec = v2NodeById.get(puzzle.payload.answerSpecId);
  assert(answerSpec && answerSpec.type === 'answer_spec' && v2RuntimeIds.has(answerSpec.id),
    `${puzzle.id} has one private in-profile answer specification`);
  assert.equal(JSON.stringify(puzzle.payload).includes(answerSpec.payload.acceptedValues[0]), false,
    `${puzzle.id} does not inline its canonical answer in the public puzzle payload`);
}
const v2Choice = v2NodeById.get('witness-puzzle');
assert(v2Choice.payload.options.length >= 2 && new Set(v2Choice.payload.options.map((option) => option.id)).size === v2Choice.payload.options.length,
  'the Witness owns stable visible choices');
const v2Terminal = v2NodeById.get(sixthChairV2.runtime.terminalNodeId);
assert.deepEqual(v2Terminal.payload.effects.map((effect) => effect.kind).sort(), ['award_collectible', 'award_status'],
  'the live terminal is value-neutral: status and collectible only');
assert(v2Terminal.payload.effects.every((effect) => effect.recipientPolicy === 'all_participants' && effect.claimPolicy === 'self'),
  'every participant earns and self-claims the live terminal awards');
assert.equal(sixthChairV2.edges.some((edge) => edge.from === 'party-completion-reward'
  && edge.type === 'REWARDS' && ['sixth-chair-title', 'sixth-chair-seal'].includes(edge.to)), false,
  'terminal effects are the only title/seal award authority');
console.log('✓ Sixth Chair v2 activates only its complete, private-answer-backed, value-neutral mystery spine');

// The first district sampler is six independently promotable personal graphs. Each starts only in
// its authored neighborhood, reveals two to four actions in a strict sequence, and ends in one
// inert, exact-once memory rather than a new faucet or power reward.
const districtStorylets = [
  ['docks-missed-tide', 'docks', 'The Man Who Missed the Tide'],
  ['canal-water-cellar', 'canal', 'Water in the Cellar'],
  ['brick-last-kiln', 'brick', 'The Last Kiln'],
  ['neon-house-lights', 'neon', 'House Lights'],
  ['foundry-furnace-ledger', 'foundry', 'The Furnace Ledger'],
  ['cathedral-saints-account', 'cathedral', "A Saint's Account"],
];
const storyletNamespaces = new Set();
const storyletAwards = new Set();
for (const [directory, districtId, title] of districtStorylets) {
  const sourcePath = path.join(ROOT, 'content', 'packs', directory, 'pack.json');
  const source = JSON.parse(fs.readFileSync(sourcePath, 'utf8'));
  const compiled = compileContentPack(source);
  assert.strictEqual(validateRuntimeContentPack(compiled), compiled,
    `${title} compiles into the supported live runtime profile`);
  const cli = spawnSync(process.execPath, ['tools/content.js', 'check', sourcePath], {
    cwd: ROOT, encoding: 'utf8',
  });
  assert.equal(cli.status, 0, `${title} fails the public content promotion gate:\n${cli.stdout}\n${cli.stderr}`);
  assert.equal(storyletNamespaces.has(source.namespace), false, `${title} has an independent namespace`);
  storyletNamespaces.add(source.namespace);

  const nodeById = new Map(source.nodes.map((node) => [node.id, node]));
  const root = nodeById.get(source.runtime.entryNodeId);
  assert.equal(root.payload.title, title, `${directory} carries its approved player-facing title`);
  const rootLocationGate = root.payload.gates.find((gate) => gate.kind === 'at_location');
  const location = nodeById.get(rootLocationGate?.locationId);
  assert.equal(location?.type, 'location', `${title} has a typed runtime location`);
  assert.equal(location?.payload?.districtId, districtId, `${title} is gated to ${districtId}`);
  const policy = nodeById.get(source.runtime.partyPolicyId);
  assert.deepEqual(policy.payload.organizationScopes, ['personal'], `${title} is a living-street storylet`);
  const roles = source.edges.filter((edge) => edge.from === policy.id
    && edge.type === 'PERFORMED_BY_ROLE').map((edge) => nodeById.get(edge.to));
  assert.equal(roles.length, 1, `${title} requires one self-owned role`);
  assert.deepEqual([...roles[0].payload.participantKinds].sort(), ['agent', 'human_eligible_non_agent'],
    `${title} is equally playable by agents and humans`);

  const actionIds = source.runtime.actionNodeIds;
  assert(actionIds.length >= 2 && actionIds.length <= 4,
    `${title} has the approved two-to-four-stage storylet length`);
  for (const [index, actionId] of actionIds.entries()) {
    const action = nodeById.get(actionId);
    assert(action.payload.gates.some((gate) => gate.kind === 'at_location'
      && gate.locationId === location.id), `${title}/${actionId} rechecks its district`);
    assert(action.payload.gates.some((gate) => gate.kind === 'party_role'
      && gate.role === roles[0].id), `${title}/${actionId} is performed by the self-owned role`);
    if (index > 0) {
      assert(source.edges.some((edge) => edge.from === actionIds[index - 1]
        && edge.type === 'UNLOCKS' && edge.to === actionId),
      `${title} reveals action ${index + 1} only after action ${index}`);
    }
    if (action.type === 'puzzle') {
      const answer = nodeById.get(action.payload.answerSpecId);
      assert.equal(answer?.type, 'answer_spec', `${title}/${actionId} has a private canonical answer`);
      for (const accepted of answer.payload.acceptedValues) {
        assert.equal(JSON.stringify(action.payload).toLowerCase().includes(accepted), false,
          `${title}/${actionId} does not inline ${accepted} into its public prompt`);
      }
    }
  }

  const terminal = nodeById.get(source.runtime.terminalNodeId);
  assert.deepEqual(terminal.payload.effects.map((effect) => effect.kind), ['award_collectible'],
    `${title} has no status, cash, OMR, item, or power reward`);
  const awardId = terminal.payload.effects[0].collectibleId;
  assert.equal(storyletAwards.has(awardId), false, `${title} owns a globally unique memory identity`);
  storyletAwards.add(awardId);
  assert.equal(nodeById.get(awardId)?.payload?.gameplayPower, 'none', `${title}'s memory is inert`);
}
assert.equal(storyletNamespaces.size, 6, 'all six district storylets are independently activatable');
assert.equal(storyletAwards.size, 6, 'all six district memories are exact logical entitlements');
console.log('✓ six district storylets are personal, location-gated, sequential, private-answer-safe, and value-neutral');

// The late-game spine needs declarative rank/build/social approaches and durable narrative memory,
// without opening a generic predicate language or a new economy adapter. Choice-owned account facts
// are definitions in the signed bundle; clients may select only options whose server-owned gates pass.
const rankCaseSource = JSON.parse(fs.readFileSync(
  path.join(ROOT, 'content', 'packs', 'docks-missed-tide', 'pack.json'), 'utf8'));
rankCaseSource.namespace = 'omerta.case.iron-election.test';
rankCaseSource.nodes.find((node) => node.id === 'missed-tide').payload.gates.push(
  { kind: 'level_at_least', level: 35 },
);
const rankChoice = rankCaseSource.nodes.find((node) => node.id === 'tide-choice');
rankChoice.payload.options = [
  { id: 'patient', label: 'Work the ward honestly', storyFlagIds: ['iron-patient'] },
  { id: 'expert', label: 'Read the ward like a thief',
    gates: [{ kind: 'mastery_at_least', trackId: 'gambling', level: 10 }],
    storyFlagIds: ['iron-expert'] },
  { id: 'crew', label: 'Put your crew on every ballot box',
    gates: [{ kind: 'crew_membership' }], storyFlagIds: ['iron-crew'] },
];
rankCaseSource.nodes.push(
  { id: 'iron-patient', type: 'story_flag', payload: {
    key: 'omerta.case.iron-election.test.outcome', kind: 'public_reputation',
    value: 'patient', title: 'The Patient Ward', gameplayPower: 'none',
  } },
  { id: 'iron-expert', type: 'story_flag', payload: {
    key: 'omerta.case.iron-election.test.outcome', kind: 'future_scene_variant',
    value: 'expert', title: 'The Quiet Count', gameplayPower: 'none',
  } },
  { id: 'iron-crew', type: 'story_flag', payload: {
    key: 'omerta.case.iron-election.test.outcome', kind: 'family_debt',
    value: 'crew', title: 'The Ward Owes the Crew', gameplayPower: 'none',
  } },
);
rankCaseSource.runtime.nodeIds.push('iron-patient', 'iron-expert', 'iron-crew');
const compiledRankCase = compileContentPack(rankCaseSource);
assert.strictEqual(validateRuntimeContentPack(compiledRankCase), compiledRankCase,
  'rank, mastery, optional-crew, and account-story-fact declarations fit the bounded runtime');

const invalidRankCase = (change) => {
  const pack = structuredClone(rankCaseSource); change(pack);
  return () => validateRuntimeContentPack(compileContentPack(pack));
};
assert.throws(invalidRankCase((pack) => {
  pack.nodes.find((node) => node.id === 'missed-tide').payload.gates.at(-1).level = 34.5;
}), /level_at_least.*positive integer/, 'rank gates cannot smuggle fractional or ambiguous levels');
assert.throws(invalidRankCase((pack) => {
  pack.nodes.find((node) => node.id === 'tide-choice').payload.options[1].gates[0].trackId = 'counterfeiting';
}), /mastery_at_least.*unknown track counterfeiting/, 'build-sensitive routes use the canonical mastery catalog');
const identityGateSource = structuredClone(rankCaseSource);
identityGateSource.namespace = 'omerta.case.identity-gates.test';
for (const node of identityGateSource.nodes.filter((node) => node.type === 'story_flag')) {
  node.payload.key = `${identityGateSource.namespace}.outcome`;
}
identityGateSource.nodes.find((node) => node.id === 'missed-tide').payload.gates.push(
  { kind: 'path_is', pathId: 'gun' },
);
identityGateSource.nodes.find((node) => node.id === 'tide-choice').payload.options[1].gates.push(
  { kind: 'skill_owned', skillId: 'executioner' },
  { kind: 'discipline_at_least', disciplineId: 'marksmanship', level: 8 },
  { kind: 'honor_at_least', honor: 25 },
  { kind: 'underworld_standing_at_least', npcId: 'fixer', standing: 25 },
);
identityGateSource.nodes.find((node) => node.id === 'tide-choice').payload.options[2].gates.push(
  { kind: 'honor_at_most', honor: -25 },
);
assert.strictEqual(
  validateRuntimeContentPack(compileContentPack(identityGateSource)).namespace,
  identityGateSource.namespace,
  'Path, skill, regimen, honor, and Underworld declarations fit the closed identity-gate DSL',
);
const invalidIdentityGate = (change) => {
  const pack = structuredClone(identityGateSource); change(pack);
  return () => validateRuntimeContentPack(compileContentPack(pack));
};
const identityRootGate = (pack) => pack.nodes.find((node) => node.id === 'missed-tide').payload.gates.at(-1);
const identityChoiceGates = (pack) => pack.nodes.find((node) => node.id === 'tide-choice').payload.options[1].gates;
assert.throws(invalidIdentityGate((pack) => { identityRootGate(pack).pathId = 'counterfeiter'; }),
  /path_is.*unknown path counterfeiter/, 'Path gates use the canonical six-Path catalog');
assert.throws(invalidIdentityGate((pack) => { identityChoiceGates(pack)[1].skillId = 'forger'; }),
  /skill_owned.*unknown skill forger/, 'skill gates use the canonical skill tree');
assert.throws(invalidIdentityGate((pack) => { identityChoiceGates(pack)[2].disciplineId = 'luck'; }),
  /discipline_at_least.*unknown discipline luck/, 'regimen gates use the canonical discipline catalog');
assert.throws(invalidIdentityGate((pack) => { identityChoiceGates(pack)[2].level = 26; }),
  /discipline_at_least.*level 1-25/, 'regimen gates cannot exceed the signed discipline cap');
assert.throws(invalidIdentityGate((pack) => { identityChoiceGates(pack)[3].honor = 25.5; }),
  /honor_at_least.*integer honor -100-100/, 'honor gates reject fractional thresholds');
assert.throws(invalidIdentityGate((pack) => { identityChoiceGates(pack)[4].npcId = 'capone'; }),
  /underworld_standing_at_least.*unknown NPC capone/, 'Underworld gates use the canonical fixture catalog');
assert.throws(invalidIdentityGate((pack) => { identityChoiceGates(pack)[4].standing = 101; }),
  /underworld_standing_at_least.*standing 0-100/, 'Underworld gates stay within the published standing range');
assert.throws(invalidRankCase((pack) => {
  pack.nodes.find((node) => node.id === 'iron-expert').payload.kind = 'income_multiplier';
}), /story flag iron-expert has unknown kind income_multiplier/,
'persistent consequences stay inside the reviewed narrative vocabulary');
assert.throws(invalidRankCase((pack) => {
  pack.nodes.find((node) => node.id === 'iron-expert').payload.gameplayPower = 'cash_bonus';
}), /story flag iron-expert must be gameplay-inert/,
'account story facts cannot become hidden permanent power');
assert.throws(invalidRankCase((pack) => {
  pack.nodes.find((node) => node.id === 'tide-choice').payload.options[1].storyFlagIds = ['missing-fact'];
}), /storyFlagIds missing-fact references a missing node/,
'choice consequences are typed bundle references rather than caller-supplied keys');
console.log('✓ late-game content declarations are rank-gated, build-reactive, optionally social, and narratively persistent');
console.log('✓ identity content declarations are closed over canonical Path, skill, regimen, honor, and Underworld catalogs');

const donCases = [
  ['iron-election', 'omerta.don.iron-election', 'The Iron Election', 35, 'brick',
    ['crimes', 'favors', 'deeds', 'law'], 'gambling', 10],
  ['house-made-of-glass', 'omerta.don.house-made-of-glass', 'A House Made of Glass', 50, 'neon',
    ['casino', 'wire', 'secrets', 'larceny'], 'larceny', 10],
  ['port-no-return', 'omerta.don.port-no-return', 'Port of No Return', 65, 'docks',
    ['port', 'convoys', 'contracts', 'seamanship'], 'seamanship', 10],
  ['empty-seat', 'omerta.don.empty-seat', 'The Empty Seat', 80, 'cathedral',
    ['family', 'commission', 'diplomacy', 'vouching'], 'scores', 25],
  ['two-funerals', 'omerta.don.two-funerals', 'Two Funerals', 95, 'foundry',
    ['bloodline', 'vendetta', 'marriage', 'honor'], 'wetwork', 25],
  ['federal-ledger', 'omerta.don.federal-ledger', 'The Federal Ledger', 110, 'canal',
    ['law', 'loans', 'black-market', 'informants'], 'commerce', 25],
  ['don-of-the-city', 'omerta.don.don-of-the-city', 'Don of the City', 125, 'brick',
    ['all-districts', 'family-politics', 'megaproject', 'legacy'], 'muscle', 40],
];
const donNamespaces = new Set();
const donMementos = new Set();
for (const [directory, namespace, title, level, districtId, systems, trackId, masteryLevel] of donCases) {
  const source = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'content', 'packs', directory, 'pack.json'), 'utf8'));
  const bundle = compileContentPack(source);
  assert.strictEqual(validateRuntimeContentPack(bundle), bundle, `${title} passes the live capability profile`);
  assert.equal(source.namespace, namespace, `${title} owns its expected stable namespace`);
  assert.equal(donNamespaces.has(namespace), false, `${title} is independently activatable`);
  donNamespaces.add(namespace);
  const nodeById = new Map(source.nodes.map((node) => [node.id, node]));
  const root = nodeById.get(source.runtime.entryNodeId);
  assert.equal(root.payload.title, title, `${directory} publishes the approved title`);
  assert.deepEqual(root.payload.systems, systems, `${title} reconnects the approved existing systems`);
  assert.deepEqual(root.payload.gates.find((gate) => gate.kind === 'level_at_least'),
    { kind: 'level_at_least', level }, `${title} opens at its approved Don-rank threshold`);
  const locationGate = root.payload.gates.find((gate) => gate.kind === 'at_location');
  assert.equal(nodeById.get(locationGate.locationId)?.payload?.districtId, districtId,
    `${title} is rooted in its approved district`);
  const policy = nodeById.get(source.runtime.partyPolicyId);
  assert.deepEqual(policy.payload.organizationScopes, ['personal'], `${title} remains a personal case`);
  assert(source.runtime.actionNodeIds.length >= 5 && source.runtime.actionNodeIds.length <= 8,
    `${title} has five to eight authored action stages`);
  for (const actionId of source.runtime.actionNodeIds) {
    const action = nodeById.get(actionId);
    assert(['puzzle', 'choice'].includes(action?.type), `${title} action ${actionId} is executable`);
    const kinds = new Set((action.payload.gates || []).map((gate) => gate.kind));
    assert(kinds.has('party_role') && kinds.has('at_location'),
      `${title} action ${actionId} rechecks actor and district authority`);
  }
  const ending = source.nodes.find((node) => node.type === 'choice'
    && node.payload?.options?.every((option) => option.storyFlagIds?.length));
  assert(ending, `${title} ends in a persistent authored decision`);
  assert.equal(ending.payload.options.length, 3, `${title} has baseline, build, and social resolutions`);
  assert.equal(ending.payload.options.filter((option) => !(option.gates || []).length).length, 1,
    `${title} always retains one ungated resolution`);
  assert.deepEqual(ending.payload.options.find((option) => option.gates?.[0]?.kind === 'mastery_at_least')
    ?.gates[0], { kind: 'mastery_at_least', trackId, level: masteryLevel },
  `${title} uses the approved mastery-sensitive resolution`);
  assert(ending.payload.options.some((option) => option.gates?.some((gate) => gate.kind === 'crew_membership')),
    `${title} has an optional social resolution without requiring a crew`);
  const outcomeFlags = ending.payload.options.flatMap((option) => option.storyFlagIds)
    .map((id) => nodeById.get(id));
  assert.equal(new Set(outcomeFlags.map((node) => node.payload.key)).size, 1,
    `${title} writes exactly one stable decision key`);
  assert.equal(new Set(outcomeFlags.map((node) => node.payload.value)).size, 3,
    `${title} records three distinguishable outcomes`);
  assert(outcomeFlags.every((node) => node.type === 'story_flag' && node.payload.gameplayPower === 'none'),
    `${title} consequences are narrative facts, not permanent power`);
  const reward = source.nodes.find((node) => node.type === 'reward_bundle');
  assert.equal(Number(reward.payload.cash || 0), 0, `${title} cannot author cash`);
  assert.equal(Number(reward.payload.omr || 0), 0, `${title} cannot author OMR`);
  assert.equal(Number(reward.payload.tradeableItems || 0), 0, `${title} cannot author tradeable loot`);
  const terminal = nodeById.get(source.runtime.terminalNodeId);
  assert.equal(terminal.payload.effects.length, 1, `${title} has one terminal memento entitlement`);
  assert.equal(terminal.payload.effects[0].kind, 'award_collectible', `${title}'s reward is collectible-only`);
  const mementoId = terminal.payload.effects[0].collectibleId;
  assert.equal(donMementos.has(mementoId), false, `${title}'s memento identity is globally unique`);
  donMementos.add(mementoId);
  assert.equal(nodeById.get(mementoId)?.payload?.gameplayPower, 'none', `${title}'s memento is inert`);
}
assert.equal(donNamespaces.size, 7, 'all seven Don Cases can be promoted independently');
assert.equal(donMementos.size, 7, 'all seven Don Cases own distinct inert memories');
console.log('✓ seven Don Cases form a rank-gated, build-reactive, persistent, value-neutral late-game spine');

const identityCases = [
  ['last-clean-contract', 'omerta.case.path.gun.last-clean-contract', 'The Last Clean Contract', 'gun',
    ['contracts', 'streets-combat', 'skills', 'mastery', 'regimen', 'honor', 'underworld'],
    [{ kind: 'skill_owned', skillId: 'executioner' },
      { kind: 'mastery_at_least', trackId: 'wetwork', level: 10 },
      { kind: 'discipline_at_least', disciplineId: 'marksmanship', level: 8 }],
    [{ kind: 'honor_at_least', honor: 25 },
      { kind: 'underworld_standing_at_least', npcId: 'fixer', standing: 25 }]],
  ['hostile-books', 'omerta.case.path.ledger.hostile-books', 'Hostile Books', 'ledger',
    ['business', 'black-market', 'loans', 'skills', 'mastery', 'regimen', 'honor', 'underworld'],
    [{ kind: 'skill_owned', skillId: 'broker' },
      { kind: 'mastery_at_least', trackId: 'commerce', level: 10 },
      { kind: 'discipline_at_least', disciplineId: 'presence', level: 8 }],
    [{ kind: 'honor_at_least', honor: 25 },
      { kind: 'underworld_standing_at_least', npcId: 'madame', standing: 25 }]],
  ['bad-batch', 'omerta.case.path.kitchen.bad-batch', 'The Bad Batch', 'kitchen',
    ['kitchen', 'goods-market', 'skills', 'mastery', 'regimen', 'honor', 'underworld'],
    [{ kind: 'mastery_at_least', trackId: 'chemistry', level: 10 },
      { kind: 'discipline_at_least', disciplineId: 'composure', level: 8 }],
    [{ kind: 'honor_at_least', honor: 25 },
      { kind: 'underworld_standing_at_least', npcId: 'doc', standing: 25 }]],
  ['black-ice', 'omerta.case.path.wheel.black-ice', 'Black Ice', 'wheel',
    ['convoys', 'races', 'garage', 'skills', 'mastery', 'regimen', 'honor', 'underworld'],
    [{ kind: 'skill_owned', skillId: 'road_captain' },
      { kind: 'mastery_at_least', trackId: 'wheels', level: 10 },
      { kind: 'discipline_at_least', disciplineId: 'handling', level: 8 }],
    [{ kind: 'honor_at_least', honor: 25 },
      { kind: 'underworld_standing_at_least', npcId: 'harbor', standing: 25 }]],
  ['nobody-saw-him-leave', 'omerta.case.path.shadow.nobody-saw-him-leave', 'Nobody Saw Him Leave', 'shadow',
    ['streets-crime', 'contracts', 'wire', 'skills', 'mastery', 'regimen', 'honor', 'underworld'],
    [{ kind: 'mastery_at_least', trackId: 'larceny', level: 10 },
      { kind: 'discipline_at_least', disciplineId: 'poise', level: 8 },
      { kind: 'honor_at_most', honor: -25 }],
    [{ kind: 'honor_at_least', honor: 25 },
      { kind: 'underworld_standing_at_least', npcId: 'fixer', standing: 25 }]],
  ['twelve-rounds', 'omerta.case.path.ring.twelve-rounds', 'Twelve Rounds', 'ring',
    ['boxing', 'duels', 'skills', 'mastery', 'regimen', 'honor', 'underworld'],
    [{ kind: 'skill_owned', skillId: 'bruiser' },
      { kind: 'mastery_at_least', trackId: 'fists', level: 10 },
      { kind: 'discipline_at_least', disciplineId: 'conditioning', level: 8 }],
    [{ kind: 'honor_at_least', honor: 25 },
      { kind: 'underworld_standing_at_least', npcId: 'cornerman', standing: 25 }]],
];
const identityNamespaces = new Set();
const identityMementos = new Set();
const identityGateCoverage = new Set();
for (const [directory, namespace, title, pathId, systems, specialistGates, relationshipGates] of identityCases) {
  const source = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'content', 'packs', directory, 'pack.json'), 'utf8'));
  const bundle = compileContentPack(source);
  assert.strictEqual(validateRuntimeContentPack(bundle), bundle, `${title} passes the live capability profile`);
  assert.equal(source.namespace, namespace, `${title} owns its expected stable namespace`);
  assert.equal(identityNamespaces.has(namespace), false, `${title} is independently activatable`);
  identityNamespaces.add(namespace);
  const nodeById = new Map(source.nodes.map((node) => [node.id, node]));
  const root = nodeById.get(source.runtime.entryNodeId);
  assert.equal(root.payload.title, title, `${directory} publishes the approved title`);
  assert.deepEqual(root.payload.systems, systems, `${title} reconnects its approved existing systems`);
  assert.deepEqual(root.payload.gates, [{ kind: 'path_is', pathId }],
    `${title} belongs exclusively to the approved Path`);
  const policy = nodeById.get(source.runtime.partyPolicyId);
  assert.deepEqual(policy.payload.organizationScopes, ['personal'], `${title} remains a personal identity case`);
  assert.equal(source.runtime.actionNodeIds.length, 5, `${title} has four investigations and one resolution`);
  for (const actionId of source.runtime.actionNodeIds) {
    const action = nodeById.get(actionId);
    assert(['puzzle', 'choice'].includes(action?.type), `${title} action ${actionId} is executable`);
    assert((action.payload.gates || []).some((gate) => gate.kind === 'party_role' && gate.role === 'investigator'),
      `${title} action ${actionId} rechecks the personal role`);
  }
  const ending = source.nodes.find((node) => node.type === 'choice'
    && node.payload?.options?.every((option) => option.storyFlagIds?.length));
  assert(ending, `${title} ends in a persistent authored decision`);
  assert.equal(ending.payload.options.length, 3, `${title} has baseline, specialist, and relationship outcomes`);
  assert.equal(ending.payload.options.filter((option) => !(option.gates || []).length).length, 1,
    `${title} always retains one ungated resolution`);
  assert.deepEqual(ending.payload.options[1].gates, specialistGates,
    `${title}'s specialist method reads the approved build identity`);
  assert.deepEqual(ending.payload.options[2].gates, relationshipGates,
    `${title}'s relationship method reads honor and canonical Underworld standing`);
  for (const option of ending.payload.options) {
    for (const gate of option.gates || []) identityGateCoverage.add(gate.kind);
  }
  const outcomeFlags = ending.payload.options.flatMap((option) => option.storyFlagIds).map((id) => nodeById.get(id));
  assert.equal(new Set(outcomeFlags.map((node) => node.payload.key)).size, 1,
    `${title} writes exactly one stable decision key`);
  assert(outcomeFlags.every((node) => node.payload.key === `${namespace}.outcome`),
    `${title}'s narrative fact is namespace-scoped`);
  assert.equal(new Set(outcomeFlags.map((node) => node.payload.value)).size, 3,
    `${title} records three distinguishable outcomes`);
  assert(outcomeFlags.every((node) => node.type === 'story_flag' && node.payload.gameplayPower === 'none'),
    `${title} consequences are narrative facts, not permanent power`);
  const reward = source.nodes.find((node) => node.type === 'reward_bundle');
  assert.equal(Number(reward.payload.cash || 0), 0, `${title} cannot author cash`);
  assert.equal(Number(reward.payload.omr || 0), 0, `${title} cannot author OMR`);
  assert.equal(Number(reward.payload.tradeableItems || 0), 0, `${title} cannot author tradeable loot`);
  const terminal = nodeById.get(source.runtime.terminalNodeId);
  assert.equal(terminal.payload.effects.length, 1, `${title} has one terminal memento entitlement`);
  assert.equal(terminal.payload.effects[0].kind, 'award_collectible', `${title}'s reward is collectible-only`);
  const mementoId = terminal.payload.effects[0].collectibleId;
  assert.equal(identityMementos.has(mementoId) || donMementos.has(mementoId), false,
    `${title}'s memento identity is globally unique across major cases`);
  identityMementos.add(mementoId);
  assert.equal(nodeById.get(mementoId)?.payload?.gameplayPower, 'none', `${title}'s memento is inert`);
}
assert.equal(identityNamespaces.size, 6, 'all six Path Cases can be promoted independently');
assert.equal(identityMementos.size, 6, 'all six Path Cases own distinct inert memories');
assert.deepEqual([...identityGateCoverage].sort(), [
  'discipline_at_least', 'honor_at_least', 'honor_at_most', 'mastery_at_least',
  'skill_owned', 'underworld_standing_at_least',
], 'the identity drop exercises every reviewed build and relationship gate');
console.log('✓ six Path Cases are identity-gated, build-reactive, persistent, and value-neutral');
