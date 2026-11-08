import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { makeDb } from '../src/db.js';
import { withCharacter } from '../src/game.js';
import { QUEST_QUALITY_PACKS, QUEST_QUALITY_PACK_NAMES } from '../src/content/quest-quality-packs.js';
import { compileContentPack } from '../src/content/compiler.js';
import { activateContentBundle, createContentInstance, actOnContentInstance, actOnContentQuality,
  contentInstanceBoard, joinContentInstance } from '../src/content/runtime.js';
import { QUALITY_MOTIVATION_SCENARIOS } from '../tools/quest-quality-studio.js';

const pool = await makeDb(), byName = new Map(QUEST_QUALITY_PACK_NAMES.map((name, i) => [name, QUEST_QUALITY_PACKS[i]]));
const as = (person, fn) => withCharacter(pool, person.accountId, fn);
const read = (person, id) => as(person, (ch, client, h) => contentInstanceBoard(ch, id, client, h));
const act = (person, board, action, input = {}) => as(person, (ch, client, h) => actOnContentInstance(ch, board.instance.id,
  { expectedRevision: board.instance.revision, actionId: action.id, ...input }, client, h));
const op = (person, board, operation, input = {}) => as(person, (ch, client, h) => actOnContentQuality(ch, board.instance.id,
  { expectedRevision: board.instance.revision, expectedQualityRevision: board.instance.quality.revision, operation, ...input }, client, h));
async function identity(name) {
  const accountId = crypto.randomUUID(), characterId = crypto.randomUUID();
  await pool.query('INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,$2,$3)', [accountId, 'guest', accountId]);
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
  await pool.query('INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,1)', [characterId, accountId, name]);
  return { accountId, characterId, name };
}
async function start(person, name) {
  const board = await as(person, (ch, client, h) => createContentInstance(ch, byName.get(name).namespace,
    { scopeKind: 'personal', roleId: 'investigator' }, client, h));
  return act(person, board, board.instance.actions.find(action => action.kind === 'start_instance'));
}
function answer(pack, board, action, proofIndex) {
  const node = pack.nodes.find(node => node.id === action.nodeId), spec = pack.nodes.find(candidate => candidate.id === node?.payload?.answerSpecId)?.payload;
  if (!spec) return null;
  if (spec.verifier === 'proof_sets') {
    const known = new Set(board.instance.quality.evidence.map(row => row.id));
    const proof = proofIndex === undefined ? spec.proofs.find(row => row.evidenceIds.every(id => known.has(node.payload.interaction.items.find(item => item.id === id).evidenceNodeId))) : spec.proofs[proofIndex];
    return proof ? { submission: { conclusionId: proof.conclusionId, evidenceIds: proof.evidenceIds } } : null;
  }
  return { submission: spec.verifier === 'mapping' ? { assignments: spec.solution } : { ids: spec.solution } };
}
async function solve(person, pack, board, nodeId, choiceId) {
  const action = board.instance.actions.find(action => action.nodeId === nodeId);
  assert(action, `${pack.namespace}/${nodeId} must actually be issued`);
  const input = action.kind === 'choose' ? { choiceId: choiceId || action.options.find(option => option.available).id } : answer(pack, board, action);
  assert(input, `The issued ${nodeId}/${action.kind} has a known test solution`);
  return act(person, board, action, input);
}
async function finish(person, name, choices = {}, existing, preferred = []) {
  const pack = byName.get(name), visited = new Set(); let board = existing || await start(person, name);
  for (let step = 0; board.instance.status === 'active' && step < 50; step++) {
    const issued = board.instance.actions.filter(action => action.kind === 'choose' || answer(pack, board, action));
    const action = preferred.map(id => issued.find(action => action.nodeId === id)).find(Boolean) || issued[0];
    assert(action, `${name} requires a satisfiable next action`);
    visited.add(action.nodeId);
    const choice = choices[action.nodeId] || (action.nodeId === 'clock-procedure' && action.options?.some(option => option.id === 'skip' && option.available) ? 'skip' : undefined);
    board = await solve(person, pack, board, action.nodeId, choice);
    assert(!JSON.stringify(board).includes('"proofs"') && !JSON.stringify(board).includes('"solution"'), 'Canonical answers stay private through actual projection.');
  }
  assert.equal(board.instance.status, 'completed', name);
  return { board, visited };
}

try {
  const old = fs.readFileSync('content/packs/quest-three-witnesses/pack.json', 'utf8').replaceAll('\r\n', '\n');
  assert.equal(crypto.createHash('sha256').update(old).digest('hex'),
    '51d148474967f738490e8410850b7175171e1a1ffab05a6ee736dd837a69554a', 'Three Witnesses v1 remains immutable.');
  for (const pack of QUEST_QUALITY_PACKS) {
    const bundle = compileContentPack(pack); await activateContentBundle(pool, { bundle, expectedHash: bundle.contentHash });
  }
  const alice = await identity('Quality investigator'), bob = await identity('Independent investigator');
  const pack = byName.get('quest-three-witnesses-v2');
  let board = await start(alice, 'quest-three-witnesses-v2');
  assert(board.instance.quality.assumptions.length >= 2 && board.instance.quality.question);
  assert(!board.instance.quality.evidence.some(item => item.id === 'no-orsini-entry'), 'Absence is not evidence before its expected source is checked.');
  board = await solve(alice, pack, board, 'clock-procedure', 'learn');
  board = await solve(alice, pack, board, 'clock-check');
  const finding = board.instance.actions.find(action => action.nodeId === 'finding'); assert(finding);
  await assert.rejects(() => act(alice, board, finding, { submission: { conclusionId: 'luca', evidenceIds: ['photo-proof', 'register-proof'] } }),
    error => error.code === 'bad_request', 'Guessing hidden item IDs cannot supply unrevealed proof.');
  board = await solve(alice, pack, board, 'registry'); board = await solve(alice, pack, board, 'photo');
  board = await op(alice, board, 'disclose', { evidenceId: 'door-image', npcId: 'rosa' });
  board = await solve(alice, pack, board, 'rosa');
  assert(board.instance.quality.evidence.some(item => item.id === 'rosa-corrected'), 'A sincere witness has a playable, evidence-backed correction.');
  board = await solve(alice, pack, board, 'absence');
  assert(board.instance.quality.evidence.some(item => item.id === 'complete-exit-scope') && board.instance.quality.evidence.some(item => item.id === 'no-orsini-entry'));
  assert(board.instance.quality.clauses.some(row => row.text.includes('every departure required an entry')));
  const short = await finish(alice, 'quest-three-witnesses-v2', { commission: 'challenge' }, board, ['finding', 'commission', 'authority', 'closing']);
  assert(short.visited.has('authority') && !short.visited.has('driver') && !short.visited.has('ticket') && !short.visited.has('pocket'));
  assert.equal(short.board.instance.quality.debrief.opened, false);
  let alternate = await start(bob, 'quest-three-witnesses-v2');
  for (const nodeId of ['clock-procedure', 'clock-check', 'driver', 'pocket', 'ticket']) alternate = await solve(bob, pack, alternate, nodeId, nodeId === 'clock-procedure' ? 'learn' : undefined);
  const altFinding = alternate.instance.actions.find(action => action.nodeId === 'finding');
  alternate = await act(bob, alternate, altFinding, answer(pack, alternate, altFinding, 1));
  const alt = await finish(bob, 'quest-three-witnesses-v2', { commission: 'limited' }, alternate, ['commission', 'limits', 'closing']);
  assert(!alt.visited.has('photo') && !alt.visited.has('registry'), 'The independent second proof ends without the first chain.');
  const collector = await identity('Collector of every clue'); let collected = await start(collector, 'quest-three-witnesses-v2');
  for (const nodeId of ['clock-procedure', 'clock-check', 'photo', 'registry', 'driver', 'ticket', 'pocket']) collected = await solve(collector, pack, collected, nodeId, nodeId === 'clock-procedure' ? 'learn' : undefined);
  collected = await act(collector, collected, collected.instance.actions.find(action => action.nodeId === 'finding'),
    { submission: { conclusionId: 'luca', evidenceIds: ['photo-proof', 'register-proof', 'swap-proof', 'exit-proof', 'pocket-proof'] } });
  assert.equal(collected.instance.status, 'active');
  assert(collected.instance.actions.find(action => action.nodeId === 'finding').feedback.includes('complete chain'), 'Selecting every known clue receives diagnostic public-premise feedback.');
  await finish(collector, 'quest-three-witnesses-v2', { commission: 'limited' }, collected, ['finding', 'commission', 'limits', 'closing']);
  const payday = await finish(alice, 'quest-quality-payday', {}, undefined, ['clock-procedure', 'handoff', 'repair', 'test', 'closing']);
  assert(!payday.visited.has('clock-check') && payday.visited.has('repair') && payday.visited.has('test'), 'Demonstrated procedure mastery skips repetition but retains a new repair and test.');
  for (const scenario of QUALITY_MOTIVATION_SCENARIOS.filter(row => row.pack !== 'quest-quality-small-fire')) {
    const person = await identity(scenario.id); let initial = await start(person, scenario.pack);
    const publicRevision = initial.instance.revision;
    initial = await op(person, initial, 'set_motive', { motiveId: 'care' });
    assert.equal(initial.instance.revision, publicRevision, 'A player-owned motive creates no public moral score or shared revision.');
    const result = await finish(person, scenario.pack, scenario.choices, initial,
      scenario.pack === 'quest-three-witnesses-v2' ? ['clock-procedure', 'clock-check', 'photo', 'registry', 'finding', 'commission', 'authority', 'closing'] : []);
    for (const id of scenario.requiredNodes) assert(result.visited.has(id), scenario.id + ':' + id);
    for (const id of scenario.avoidedNodes) assert(!result.visited.has(id), scenario.id + ' avoids ' + id);
  }
  for (const name of ['quest-quality-truce', 'quest-quality-night-edition', 'quest-quality-favors', 'quest-quality-shared-meaning', 'quest-quality-last-ferry']) {
    const result = await finish(await identity(name), name); assert(result.visited.size >= 3);
  }
  const field = await identity('Fieldwork commissioner'); let fieldBoard = await start(field, 'quest-quality-field-notes');
  assert(!fieldBoard.instance.actions.some(action => action.nodeId === 'review'), 'Review requires a real commissioned report.');
  for (const [questionId, methodId] of [['registered', 'observe'], ['registered', 'registry'], ['present', 'observe']]) {
    fieldBoard = await op(field, fieldBoard, 'fieldwork', { assignmentId: 'permit-check', questionId, methodId });
  }
  assert(fieldBoard.instance.quality.fieldworkReports.some(row => row.report.includes('cannot establish')));
  fieldBoard = await solve(field, byName.get('quest-quality-field-notes'), fieldBoard, 'review');
  for (const [evidenceId, npcId] of [['registry-report', 'clerk'], ['quay-report', 'porter']]) fieldBoard = await op(field, fieldBoard, 'disclose', { evidenceId, npcId });
  const fieldResult = await finish(field, 'quest-quality-field-notes', {}, fieldBoard);
  assert.equal(fieldResult.board.instance.quality.disclosureReports.length, 2);
  const records = await identity('Records spotlight'), residents = await identity('Residents spotlight'), crewId = crypto.randomUUID();
  await pool.query('INSERT INTO crews (id,name,leader_account) VALUES ($1,$2,$3)', [crewId, 'Quality crew', records.accountId]);
  for (const who of [records, residents]) await pool.query('INSERT INTO crew_members (crew_id,account_id,name) VALUES ($1,$2,$3)', [crewId, who.accountId, who.name]);
  const firePack = byName.get('quest-quality-small-fire');
  let shared = await as(records, (ch, client, h) => createContentInstance(ch, firePack.namespace, { scopeKind: 'crew', roleId: 'records', consent: true }, client, h));
  shared = await as(residents, (ch, client, h) => joinContentInstance(ch, shared.instance.id, { expectedRevision: shared.instance.revision, roleId: 'residents', consent: true }, client, h));
  shared = await read(records, shared.instance.id); shared = await act(records, shared, shared.instance.actions.find(action => action.kind === 'start_instance'));
  for (const id of ['whistle', 'register', 'stove', 'join']) shared = await solve(records, firePack, shared, id);
  assert(shared.instance.quality.evidence.some(row => row.id === 'flue-report'), 'The physical cause is acquired before the finding.');
  for (const [nodeId, choiceId] of [['brief', 'bounded'], ['closing', 'people']]) {
    shared = await read(records, shared.instance.id);
    shared = await op(records, shared, 'propose_mandate', { nodeId, delegateAccountId: shared.instance.quality.ownMemberId });
    let other = await read(residents, shared.instance.id); await op(residents, other, 'acknowledge_mandate', { nodeId });
    shared = await read(records, shared.instance.id); shared = await solve(records, firePack, shared, nodeId, choiceId);
    if (nodeId === 'brief') shared = await solve(records, firePack, shared, 'account');
  }
  assert.equal(shared.instance.status, 'completed');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM transactions')).rows[0].n), 0);
  console.log(JSON.stringify({ phase: 'QUEST_QUALITY_AUTHORED_RUNTIME', packsPlayed: 10, independentProofChains: 2,
    earlyOptionalLeadsSkipped: true, adversarialMotivations: 3, actualFieldworkAndDisclosure: true,
    publicSpotlightVolunteer: true, oldVersionUntouched: true, economicTransactions: 0, evidenceType: 'automated-runtime-test', playerResearchConducted: false }));
} finally { await pool.end(); }
