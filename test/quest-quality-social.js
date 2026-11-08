import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { qualityFixture } from './lib/quest-quality-fixture.js';
import { createContentInstance, joinContentInstance, leaveContentInstance } from '../src/content/runtime.js';

const f = await qualityFixture();
try {
  const alice = await f.identity('Quality records'), bob = await f.identity('Quality residents');
  let field = await f.start(alice, 'quality-field-notes');
  assert(!field.instance.nodes.some(node => ['registry-report', 'quay-report', 'clerk-reaction', 'porter-reaction'].includes(node.id)),
    'Operation-controlled evidence is not collected automatically.');
  assert(!JSON.stringify(field).includes('P-4 appears in the complete dated register'), 'Unissued fieldwork reports stay private.');
  await assert.rejects(() => f.quality(alice, field, 'disclose', { evidenceId: 'registry-report', npcId: 'clerk' }), error => error.code === 'unknown_evidence');
  await assert.rejects(() => f.quality(alice, field, 'fieldwork', { assignmentId: 'permit-check', questionId: 'invented', methodId: 'registry' }), error => error.code === 'bad_request');
  const beforeDraft = field.instance.revision;
  field = await f.quality(alice, field, 'save_draft', { text: 'Ask the registry before contacting the clerk.', evidenceIds: [] });
  assert.equal(field.instance.revision, beforeDraft);
  assert.equal(field.instance.quality.disclosureReports.length, 0);
  field = await f.quality(alice, field, 'fieldwork', { assignmentId: 'permit-check', questionId: 'registered', methodId: 'observe' });
  assert(field.instance.nodes.some(node => node.id === 'quay-report'));
  assert(!field.instance.nodes.some(node => node.id === 'registry-report'), 'Observation does not invent registry evidence.');
  field = await f.quality(alice, field, 'fieldwork', { assignmentId: 'permit-check', questionId: 'registered', methodId: 'registry' });
  assert.equal(field.instance.quality.fieldworkReports.length, 2, 'A bounded assignment can be re-commissioned with a better method.');
  field = await f.quality(alice, field, 'disclose', { evidenceId: 'registry-report', npcId: 'clerk' });
  assert(field.instance.nodes.some(node => node.id === 'clerk-reaction'));
  assert(!field.instance.nodes.some(node => node.id === 'porter-reaction'));
  await assert.rejects(() => f.quality(alice, field, 'disclose', { evidenceId: 'registry-report', npcId: 'porter' }), error => error.code === 'bad_request');
  field = await f.quality(alice, field, 'disclose', { evidenceId: 'quay-report', npcId: 'porter' });
  assert.equal(field.instance.quality.disclosureReports.length, 2);
  const disclosedRevision = field.instance.revision;
  field = await f.quality(alice, field, 'disclose', { evidenceId: 'quay-report', npcId: 'porter' });
  assert.equal(field.instance.revision, disclosedRevision, 'Repeating a disclosure does not replay public effects.');
  await f.finish(alice, field);

  const crewId = crypto.randomUUID();
  await f.pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [crewId, 'Quality crew', alice.accountId]);
  for (const [who, name] of [[alice, 'Records'], [bob, 'Residents']]) await f.pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [crewId, who.accountId, name]);
  let board = await f.as(alice, (ch, client, h) => createContentInstance(ch, f.packs.get('quality-small-fire').namespace,
    { scopeKind: 'crew', roleId: 'records', consent: true }, client, h));
  board = await f.as(bob, (ch, client, h) => joinContentInstance(ch, board.instance.id,
    { expectedRevision: board.instance.revision, roleId: 'residents', consent: true }, client, h));
  board = await f.read(alice, board);
  board = await f.act(alice, board, board.instance.actions.find(action => action.kind === 'start_instance'));
  board = await f.quality(alice, board, 'first_impression', { text: 'The red mark might mean a follow-up inspection.', unsure: true, share: false });
  assert.equal((await f.read(bob, board)).instance.quality.sharedImpressions.length, 0);
  assert(!JSON.stringify((await f.read(bob, board)).instance.quality).includes('follow-up inspection'));
  board = await f.quality(alice, board, 'first_impression', { text: 'The red mark might mean a follow-up inspection.', unsure: true, share: true });
  assert.equal((await f.read(bob, board)).instance.quality.sharedImpressions[0].text, 'The red mark might mean a follow-up inspection.');
  assert(!JSON.stringify(board.instance.quality.participants).includes(alice.accountId), 'Only instance-scoped participant handles are published.');
  let testedAcknowledgement = false;
  for (let step = 0; board.instance.status === 'active' && step < 40; step++) {
    board = await f.read(alice, board);
    let action = board.instance.actions[0];
    assert(action, 'Public role contributions can be volunteered without a rigid turn lock.');
    if (action.kind === 'choose') {
      const delegate = board.instance.quality.participants.find(member => member.isMe).id;
      board = await f.quality(alice, board, 'propose_mandate', { nodeId: action.nodeId, delegateAccountId: delegate });
      if (!testedAcknowledgement) {
        await assert.rejects(() => f.act(alice, board, board.instance.actions.find(item => item.nodeId === action.nodeId), { choiceId: action.options.find(option => option.available).id }), error => error.code === 'decision_acknowledgement');
        testedAcknowledgement = true;
      }
      let bobBoard = await f.read(bob, board);
      assert(bobBoard.instance.quality.delegations.some(mandate => mandate.nodeId === action.nodeId));
      await f.quality(bob, bobBoard, 'acknowledge_mandate', { nodeId: action.nodeId });
      board = await f.read(alice, board); action = board.instance.actions.find(item => item.nodeId === action.nodeId);
      board = await f.act(alice, board, action, { choiceId: action.options.find(option => option.available).id });
    } else board = await f.act(alice, board, action, f.answer(board, action));
  }
  assert.equal(board.instance.status, 'completed'); assert(testedAcknowledgement);
  const closedRevision = board.instance.revision;
  const bobDebrief = await f.quality(bob, await f.read(bob, board), 'open_debrief');
  assert(bobDebrief.instance.quality.debrief.text);
  board = await f.read(alice, board);
  assert.equal(board.instance.revision, closedRevision);
  assert.equal(board.instance.quality.debrief.opened, false, 'Another participant cannot force the verdict into your case file.');
  assert.equal(board.instance.quality.debrief.text, undefined);
  assert.equal(board.instance.status, 'completed', 'Debrief preferences never block completion.');
  console.log('quest quality social: bounded fieldwork, explicit disclosure, private impressions, acknowledged delegation, volunteer spotlight and individual debrief passed');
} finally { await f.pool.end(); }
