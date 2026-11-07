import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import Ajv from 'ajv';
import { buildOpenApi } from '../src/agentgateway.js';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { compileContentPack, validateRuntimeContentPack } from '../src/content/compiler.js';
import {
  activateContentBundle, actOnContentInstance, claimContentRewards, contentBoard,
  contentInstanceBoard, createContentInstance,
} from '../src/content/runtime.js';

const gates = [{ kind: 'party_role', role: 'investigator' }];
const items = [
  { id: 'arrival', label: 'The courier arrives', description: 'The receipt is stamped before the bell.' },
  { id: 'bell', label: 'The ferry bell rings', description: 'The workshop clock stops at this sound.' },
  { id: 'rumor', label: 'A rumor of a late delivery', description: 'A neighbor only consulted the stopped clock.' },
];
function source(namespace = 'test.narrative.case') {
  const nodes = [
    { id: 'case', type: 'mystery', payload: { title: 'The Clock Case', expectations: { durationMinutes: 10, reasoning: 'Reconstruct events' } } },
    { id: 'policy', type: 'party_policy', payload: { organizationScopes: ['personal'], uniqueParticipants: true, roleLockOnStart: true, recheckConsent: true } },
    { id: 'quorum', type: 'quorum', payload: { minimumParticipants: 1, minimumOrganizations: 1, uniqueParticipants: true } },
    { id: 'investigator', type: 'role', payload: { title: 'Investigator', participantKinds: ['human_eligible_non_agent', 'agent'] } },
    { id: 'chapter', type: 'chapter', payload: { title: 'The Stopped Hand' } },
    { id: 'timeline', type: 'puzzle', payload: {
      title: 'Reconstruct the Morning', prompt: 'Put the events in order.', gates,
      answerMode: 'server_owned_canonical', answerSpecId: 'timeline-answer',
      interaction: { kind: 'timeline', items }, hints: ['Compare the receipt with the ferry bell.', 'The clock stopped after the courier arrived.'],
      suspicion: { onWrong: 1, max: 2 }, failForward: { afterAttempts: 2, nextNodeId: 'complication', summary: 'The witness loses patience; check the physical record.' },
      successNextNodeIds: ['method'],
    } },
    { id: 'timeline-answer', type: 'answer_spec', payload: { verifier: 'ordered_ids', solution: ['arrival', 'bell', 'rumor'] } },
    { id: 'complication', type: 'puzzle', payload: {
      title: 'Recover the Receipt', prompt: 'Choose the document that proves timing.', gates,
      answerMode: 'server_owned_canonical', answerSpecId: 'recovery-answer',
      interaction: { kind: 'deduction', items },
    } },
    { id: 'recovery-answer', type: 'answer_spec', payload: { verifier: 'unordered_ids', solution: ['arrival'] } },
    { id: 'method', type: 'choice', payload: {
      title: 'Choose a Method', unlockMode: 'any', gates, options: [
        { id: 'talk', label: 'Interview Ada', nextNodeIds: ['interview'], summary: 'You give Ada a chance to explain.' },
        { id: 'inspect', label: 'Match the documents', nextNodeIds: ['documents'], summary: 'You trust the physical record.' },
      ],
    } },
    { id: 'interview', type: 'puzzle', payload: {
      title: 'Test the Testimony', prompt: 'Select what contradicts the late-delivery claim.', gates,
      answerMode: 'server_owned_canonical', answerSpecId: 'interview-answer',
      interaction: { kind: 'interrogation', items },
    } },
    { id: 'interview-answer', type: 'answer_spec', payload: { verifier: 'unordered_ids', solution: ['arrival', 'bell'] } },
    { id: 'documents', type: 'puzzle', payload: {
      title: 'File the Documents', prompt: 'Match each record to the fact it supports.', gates,
      answerMode: 'server_owned_canonical', answerSpecId: 'documents-answer',
      interaction: { kind: 'inventory', items, slots: [{ id: 'timing', label: 'Reliable timing' }, { id: 'failure', label: 'Broken clock' }] },
    } },
    { id: 'documents-answer', type: 'answer_spec', payload: { verifier: 'mapping', solution: { timing: 'arrival', failure: 'bell' } } },
    { id: 'resolution', type: 'choice', payload: { title: 'Publish the Finding', gates, unlockMode: 'any', options: [
      { id: 'correct', label: 'Print the correction', storyFlagIds: ['access'] },
      { id: 'archive', label: 'Archive the evidence', storyFlagIds: ['archive-access'] },
    ] } },
    { id: 'access', type: 'story_flag', payload: { key: `${namespace}.access`, kind: 'future_scene_variant', value: 'press-room', title: 'A Key to the Press Room', gameplayPower: 'none' } },
    { id: 'archive-access', type: 'story_flag', payload: { key: `${namespace}.access`, kind: 'future_scene_variant', value: 'archive', title: 'A Place in the Archive', gameplayPower: 'none' } },
    { id: 'reward', type: 'reward_bundle', payload: { claimOnce: true, cash: 0, tradeableItems: 0 } },
    { id: 'memento', type: 'collectible_def', payload: { title: 'Corrected Receipt', gameplayPower: 'none' } },
    { id: 'closed', type: 'terminal', payload: { title: 'The Record Is Clear', effects: [{ kind: 'award_collectible', collectibleId: 'memento', recipientPolicy: 'all_participants', claimPolicy: 'self' }] } },
  ];
  return {
    schemaVersion: 1, namespace, version: 1,
    growth: { role: 'internal_only', exemptReason: 'Narrative engine verification' },
    runtime: { experienceId: 'case', entryNodeId: 'case', partyPolicyId: 'policy', quorumId: 'quorum', terminalNodeId: 'closed', nodeIds: nodes.map((node) => node.id), actionNodeIds: nodes.filter((node) => ['puzzle', 'choice'].includes(node.type)).map((node) => node.id) },
    nodes, edges: [
      { from: 'case', type: 'REQUIRES', to: 'policy' }, { from: 'policy', type: 'REQUIRES', to: 'quorum' },
      { from: 'policy', type: 'PERFORMED_BY_ROLE', to: 'investigator' },
      ...[['case', 'chapter'], ['chapter', 'timeline'], ['timeline', 'method'], ['timeline', 'complication'], ['complication', 'method'],
        ['method', 'interview'], ['method', 'documents'], ['interview', 'resolution'], ['documents', 'resolution'], ['resolution', 'reward'], ['reward', 'closed']]
        .map(([from, to]) => ({ from, type: 'UNLOCKS', to })),
    ],
  };
}

const pool = await makeDb();
const schemas = buildOpenApi([]).components.schemas;
const receiptSchema = new Ajv({ strict: false, validateFormats: false, allowUnionTypes: true }).compile({
  components: { schemas }, $ref: '#/components/schemas/ContentReceipt',
});
function publicReceipt(value) {
  assert.equal(receiptSchema(JSON.parse(JSON.stringify(value))), true, JSON.stringify(receiptSchema.errors));
  return value;
}
const identities = [];
const as = (identity, fn) => withCharacter(pool, identity.accountId, fn);
async function identity() {
  const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'guest', accountId]);
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
  await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, `Detective ${identities.length}`]);
  const result = { accountId, characterId }; identities.push(result); return result;
}
async function activate(pack) {
  const bundle = compileContentPack(pack); validateRuntimeContentPack(bundle);
  await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash }); return bundle;
}
async function start(who, namespace) {
  let board = await as(who, (ch, client, h) => createContentInstance(ch, namespace, { scopeKind: 'personal', roleId: 'investigator' }, client, h));
  publicReceipt(board);
  return act(who, board, {});
}
async function act(who, board, input) {
  return publicReceipt(await as(who, (ch, client, h) => actOnContentInstance(ch, board.instance.id, {
    expectedRevision: board.instance.revision, actionId: board.instance.actions[0].id, ...input,
  }, client, h)));
}
const pack = source(); await activate(pack);
const solver = await identity(); let run = await start(solver, pack.namespace);
assert.deepEqual(run.instance.actions[0].interaction.items, items);
assert.equal(run.instance.actions[0].submissionKind, 'ordered_ids');
assert.ok(!JSON.stringify(run).includes('solution'), 'private solutions are absent from projections');
const beforeHint = run.instance.revision;
run = await act(solver, run, { hint: true });
assert.equal(run.instance.revision, beforeHint + 1);
assert.deepEqual(run.instance.actions[0].hints, ['Compare the receipt with the ferry bell.']);
assert.equal(run.instance.actions[0].attempts, 0, 'requesting help does not count as a failed attempt');
await assert.rejects(() => act(solver, run, { submission: { ids: ['foreign-item'] } }), (error) => error.code === 'bad_request');
run = await act(solver, run, { submission: { ids: ['arrival', 'bell', 'rumor'] } });
assert.equal(run.instance.actions[0].nodeId, 'method');
run = await act(solver, run, { choiceId: 'inspect' });
assert.deepEqual(run.instance.actions.map((action) => action.nodeId), ['documents'], 'unchosen branch cannot be executed');
run = await act(solver, run, { submission: { assignments: { timing: 'arrival', failure: 'bell' } } });
assert.equal(run.instance.actions[0].nodeId, 'resolution', 'any-branch convergence does not wait on the unchosen branch');
run = await act(solver, run, { choiceId: 'correct' });
assert.equal(run.instance.status, 'completed');
assert.ok(run.instance.journal.some((entry) => entry.nodeId === 'documents'));
assert.equal(run.instance.expectations.durationMinutes, 10);

const sequel = source('test.narrative.sequel');
sequel.nodes[0].payload.gates = [{ kind: 'story_flag_is', key: `${pack.namespace}.access`, value: 'press-room' }, { kind: 'collectible_owned', collectibleId: 'memento' }];
await activate(sequel);
let board = await as(solver, contentBoard);
assert.equal(board.experiences.find((entry) => entry.namespace === sequel.namespace).eligible, false, 'a pending memento is not owned');
await as(solver, (ch, client, h) => claimContentRewards(ch, run.instance.id, { expectedRevision: run.instance.revision }, client, h));
board = await as(solver, contentBoard);
assert.equal(board.experiences.find((entry) => entry.namespace === sequel.namespace).eligible, true, 'claimed memento and earlier choice unlock a later story');

const struggler = await identity(); let failed = await start(struggler, pack.namespace);
const wrong = { submission: { ids: ['bell', 'arrival', 'rumor'] } };
failed = await act(struggler, failed, wrong);
assert.equal(failed.instance.actions[0].attempts, 1); assert.equal(failed.instance.suspicion, 1);
failed = await act(struggler, failed, wrong);
assert.equal(failed.instance.actions[0].nodeId, 'complication');
assert.equal(failed.instance.nodes.find((node) => node.id === 'timeline').outcome, 'complication');
failed = await act(struggler, failed, { submission: { ids: ['arrival'] } });
failed = await act(struggler, failed, { choiceId: 'talk' });
failed = await act(struggler, failed, { submission: { ids: ['bell', 'arrival'] } });
failed = await act(struggler, failed, { choiceId: 'archive' });
assert.equal(failed.instance.status, 'completed', 'mistakes open a playable recovery path');
await assert.rejects(() => start(struggler, sequel.namespace), (error) => error.code === 'content_gate');

const varied = source('test.narrative.variants');
varied.nodes.find((node) => node.id === 'timeline').payload.variants = [
  { id: 'receipt-first', prompt: 'Put the receipt first.', answerSpecId: 'timeline-answer', interaction: { kind: 'timeline', items } },
  { id: 'bell-first', prompt: 'The bell preceded this courier. Reconstruct this other morning.', answerSpecId: 'alternate-answer', interaction: { kind: 'timeline', items } },
];
varied.nodes.push({ id: 'alternate-answer', type: 'answer_spec', payload: { verifier: 'ordered_ids', solution: ['bell', 'arrival', 'rumor'] } });
varied.runtime.nodeIds.push('alternate-answer'); await activate(varied);
const variedRun = await start(solver, varied.namespace);
const refreshed = await as(solver, (ch, client, h) => contentInstanceBoard(ch, variedRun.instance.id, client, h));
assert.deepEqual(refreshed.instance.actions, variedRun.instance.actions, 'variants are pinned to instance identity across refreshes');
const selectedIds = variedRun.instance.actions[0].prompt.startsWith('Put') ? ['arrival', 'bell', 'rumor'] : ['bell', 'arrival', 'rumor'];
assert.equal((await act(solver, variedRun, { submission: { ids: selectedIds } })).instance.actions[0].nodeId, 'method');

const legacy = source('test.narrative.account-legacy');
legacy.nodes.find((node) => node.id === 'policy').payload.accountLegacyContinuity = true;
await activate(legacy);
let inherited = await start(struggler, legacy.namespace);
await pool.query('UPDATE characters SET alive=false WHERE id=$1', [struggler.characterId]);
struggler.characterId = crypto.randomUUID();
await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [struggler.characterId, struggler.accountId, 'The Successor']);
inherited = await as(struggler, (ch, client, h) => contentInstanceBoard(ch, inherited.instance.id, client, h));
inherited = await act(struggler, inherited, { submission: { ids: ['arrival', 'bell', 'rumor'] } });
assert.equal(inherited.instance.actions[0].nodeId, 'method', 'only an opted-in account legacy continues through a living successor');

const invalid = structuredClone(pack); invalid.nodes.find((node) => node.id === 'timeline-answer').payload.solution.push('unissued-item');
assert.throws(() => validateRuntimeContentPack(compileContentPack(invalid)), /unknown public item/);
console.log('✓ narrative play validates structured evidence, hints, suspicion, recovery, branching, stable variants, and cross-case claimed access');
await pool.end();
