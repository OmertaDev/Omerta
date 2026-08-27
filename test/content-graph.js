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
import { compileContentPack } from '../src/content/compiler.js';

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
