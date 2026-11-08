import assert from 'node:assert/strict';
import { qualityFixture } from './lib/quest-quality-fixture.js';
import { projectQualityRuntime, newQualityActor, newQualityShared } from '../src/content/quality-runtime.js';
import { activateContentBundle, createContentInstance } from '../src/content/runtime.js';
import { compileContentPack } from '../src/content/compiler.js';

const design = { version: 1, question: 'What can we establish?', assumptions: [], clauses: [],
  questions: [{ id: 'hidden', nodeId: 'ending', text: 'Unrevealed verdict question' }],
  spoilers: [{ nodeId: 'ending', requiresNodeIds: ['proof'] }] };
const projected = projectQualityRuntime(design, { instance: { id: 'test', status: 'active' }, accountId: 'actor', members: [],
  visibleNodes: [{ id: 'ending', type: 'choice', state: 'available' }, { id: 'proof', type: 'puzzle', state: 'available' }],
  completed: new Set(), actions: [], now: 0 }, newQualityActor(), newQualityShared(), []);
assert.equal(projected.questions.length, 0, 'An available prerequisite is not a completed reveal condition.');
assert.equal(projected.currentQuestion, design.question);
assert(!JSON.stringify(projected).includes('Unrevealed verdict question'));

const f = await qualityFixture();
try {
  const source = structuredClone(f.packs.get('three-witnesses'));
  const previousNamespace = source.namespace;
  source.namespace = 'test.quality-spoiler-evidence';
  for (const node of source.nodes.filter(node => node.type === 'story_flag')) node.payload.key = node.payload.key.replace(previousNamespace, source.namespace);
  const root = source.nodes.find(node => node.id === source.runtime.entryNodeId);
  root.payload.quality.spoilers.push({ nodeId: 'door-image', requiresNodeIds: ['clock-check'] });
  const bundle = compileContentPack(source);
  await activateContentBundle(f.pool, { bundle, expectedHash: bundle.contentHash });
  const who = await f.identity('Spoiler prerequisite investigator');
  let board = await f.as(who, (ch, client, h) => createContentInstance(ch, source.namespace,
    { scopeKind: 'personal', roleId: 'investigator' }, client, h));
  board = await f.act(who, board, board.instance.actions[0]);
  for (const nodeId of ['clock-procedure', 'clock-check', 'photo']) {
    const action = board.instance.actions.find(item => item.nodeId === nodeId);
    assert(action, `${nodeId} is issued`);
    const input = action.kind === 'choose' ? { choiceId: root.payload.quality.procedures[0].learnOptionId } : f.answer(board, action);
    board = await f.act(who, board, action, input);
  }
  assert(board.instance.nodes.some(node => node.id === 'door-image'), 'Ordinary evidence reveals after its prerequisites, without waiting for the final debrief.');
  assert(board.instance.quality.evidence.some(node => node.id === 'door-image'));
  const proofAction = board.instance.actions.find(action => action.nodeId === 'finding');
  assert(proofAction.interaction.items.some(item => item.evidenceNodeId === 'door-image'), 'Proof projection and submission share the same known-evidence authority.');
  board = await f.finish(who, board);
  assert.equal(board.instance.status, 'completed', 'A spoiler-marked ordinary clue cannot deadlock completion.');
  assert.equal(board.instance.quality.debrief.opened, false);
  console.log('quest quality spoilers: hidden questions, completed prerequisites, usable ordinary clues and independent finale reveal passed');
} finally { await f.pool.end(); }
