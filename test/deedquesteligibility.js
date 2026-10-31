import assert from 'node:assert/strict';
import { makeDb } from '../src/db.js';
import { withItemTransaction } from '../src/items.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import { loadAndValidatePhase1WorldGraph } from '../src/content/phase1-validation.js';
import { commitChoice, completeNode, createMysteryContext, discoverNode, startMystery } from '../src/mysteries.js';
import { isApprovedDeedQuestSource, QUEST_DEED_SOURCE, verifiedQuestDeedEligibility } from '../src/deedquesteligibility.js';
import { claimDeed } from '../src/deeds.js';
import { deedDiscoveryBoard, investigateDeed } from '../src/deeddiscovery.js';
import { cityQuestNodePresentation, cityQuestPresentation } from '../src/content/city-quest-presentation.js';
import { PACING } from '../src/rules.js';

const source = QUEST_DEED_SOURCE;
const current = PHASE1_WORLD_GRAPH_PACKAGES.find((pkg) => pkg.id === source.graphId);
assert(isApprovedDeedQuestSource(PHASE1_WORLD_GRAPH_PACKAGES), 'the shipped playable quest has an explicit economic policy pin');
assert.equal(isApprovedDeedQuestSource([]), false, 'retiring a package removes its deed qualification');
assert.equal(isApprovedDeedQuestSource([current, current]), false, 'ambiguous duplicate packages fail closed');
assert.equal(isApprovedDeedQuestSource(PHASE1_WORLD_GRAPH_PACKAGES.filter((pkg) => pkg.id === 'neighborhood-initiation')), false,
  'the easy newcomer introduction no longer qualifies an account for a deed');
assert.equal(cityQuestPresentation(source.graphId).title, 'A House With a Past');
assert.equal(cityQuestNodePresentation(source.graphId, 'mystery:property-witness').districtId, 'neon');
assert.equal(cityQuestNodePresentation(source.graphId, 'mystery:property-survey').districtId, 'foundry');
for (const change of [
  (pkg) => { pkg.version++; },
  (pkg) => { pkg.nodes.find((node) => node.id === source.nodeId).metadata.terminal = false; },
  (pkg) => { pkg.nodes.find((node) => node.id === source.nodeId).requires = []; },
  (pkg) => { pkg.nodes.find((node) => node.id === source.nodeId).metadata.title = 'Edited reward'; },
  (pkg) => { pkg.id = 'arbitrary-cosmetic-reward'; },
]) {
  const changed = structuredClone(current);
  change(changed);
  assert.equal(isApprovedDeedQuestSource([changed]), false, 'unreviewed graph edits cannot gain economic authority');
}

const pool = await makeDb();
const accountId = 'deed-quest-account';
const characterId = 'deed-quest-character';
const otherAccountId = 'deed-quest-other-account';
const otherCharacterId = 'deed-quest-other-character';
const owner = { scope: 'character', id: characterId };
const { registry } = loadAndValidatePhase1WorldGraph();
const context = createMysteryContext({ registry, accountId, now: '2026-10-16T12:00:00.000Z' });
const tx = (fn) => withItemTransaction(pool, fn);
const act = (fn, ...args) => tx((client) => fn(client, context, owner, source.graphId, ...args));
const eligibility = (identity = { accountId, characterId }) => tx((client) => verifiedQuestDeedEligibility(client, identity));

try {
  await pool.query(
    `INSERT INTO characters (id,account_id,name,season,loc,respect,cash)
     VALUES ($1,$2,'Quest Quinn',1,'docks',0,100),($3,$4,'Other Ollie',1,'docks',0,100)`,
    [characterId, accountId, otherCharacterId, otherAccountId],
  );
  assert.equal(await eligibility(), null, 'a player must finish the quest before qualifying');
  await pool.query('INSERT INTO account_persistent (account_id) VALUES ($1)', [accountId]);
  await pool.query('UPDATE characters SET respect=100000000 WHERE id=$1', [characterId]);
  const partial = await tx(async (client) => {
    const ch = (await client.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
    return investigateDeed(ch, { buildingId: 'docks-0001', actionId: 'inspect-site' }, client);
  });
  assert.equal(partial.steps, 1);
  assert.equal(partial.qualified, false, 'one exploration step does not qualify before the quest completes');
  const intro = (fn, ...args) => tx((client) => fn(client, context, owner, 'neighborhood-initiation', ...args));
  await intro(startMystery, 1, 'deed-intro-start');
  await intro(completeNode, 'mystery:neighborhood-fixer', { idempotencyKey: 'deed-intro-fixer', interactionId: 'meet_neighborhood_fixer' });
  await intro(commitChoice, 'choice:neighborhood-approach', 'listen', { idempotencyKey: 'deed-intro-choice', interactionId: 'choose_neighborhood_approach' });
  await intro(completeNode, 'mystery:neighborhood-listen', { idempotencyKey: 'deed-intro-listen', interactionId: 'inspect_neighborhood_watch' });
  await intro(discoverNode, 'mystery:neighborhood-newsroom', { idempotencyKey: 'deed-intro-discover', interactionId: 'publish_neighborhood_note' });
  await intro(completeNode, 'mystery:neighborhood-newsroom', { idempotencyKey: 'deed-intro-finish', interactionId: 'publish_neighborhood_note' });
  assert.equal(await eligibility(), null, 'actually completing the unchanged onboarding quest grants no deed eligibility');

  const started = await act(startMystery, 1, 'deed-quest-start');
  const otherContext = createMysteryContext({ registry, accountId: otherAccountId, now: '2026-10-16T12:00:00.000Z' });
  await assert.rejects(tx((client) => completeNode(client, otherContext, owner, source.graphId,
    'mystery:property-briefing', { idempotencyKey: 'deed-quest-foreign-actor', interactionId: 'property_briefing' })),
  { code: 'mystery_owner_forbidden' }, 'another account cannot drive this character’s quest');
  const perform = (node, interaction) => act(completeNode, node,
    { idempotencyKey: 'deed-quest-' + node, interactionId: interaction });
  const move = (district) => pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [characterId, district]);
  await assert.rejects(perform(source.nodeId, 'property_verify_title'),
    (error) => ['mystery_hidden', 'mystery_node_unavailable'].includes(error.code), 'the final verification cannot be skipped to');
  await move('neon');
  await assert.rejects(perform('mystery:property-briefing', 'property_briefing'), { code: 'location' });
  await move('docks');
  await perform('mystery:property-briefing', 'property_briefing');
  await assert.rejects(act(commitChoice, 'choice:property-approach', 'witness',
    { idempotencyKey: 'deed-quest-skipped-ledger', interactionId: 'property_choose_approach' }),
  (error) => ['graph_dependency', 'mystery_prerequisite'].includes(error.code), 'the approach requires registry evidence');
  await perform('mystery:property-ledger', 'property_inspect_ledger');
  const choice = await act(commitChoice, 'choice:property-approach', 'witness',
    { idempotencyKey: 'deed-quest-choice', interactionId: 'property_choose_approach' });
  assert.deepEqual(await act(commitChoice, 'choice:property-approach', 'witness',
    { idempotencyKey: 'deed-quest-choice', interactionId: 'property_choose_approach' }), choice);
  await assert.rejects(act(commitChoice, 'choice:property-approach', 'records',
    { idempotencyKey: 'deed-quest-change-choice', interactionId: 'property_choose_approach' }), { code: 'choice_committed' });
  await assert.rejects(perform('mystery:property-records', 'property_inspect_records'),
    (error) => ['mystery_excluded', 'mystery_node_unavailable'].includes(error.code));
  await assert.rejects(perform('mystery:property-witness', 'property_interview_witness'), { code: 'location' });
  assert.equal(await eligibility(), null, 'a chosen approach is insufficient');
  await move('neon');
  await perform('mystery:property-witness', 'property_interview_witness');
  await perform('mystery:property-address', 'property_verify_address');
  await assert.rejects(perform('mystery:property-survey', 'property_inspect_survey'), { code: 'location' });
  await move('foundry');
  await perform('mystery:property-survey', 'property_inspect_survey');
  await perform('mystery:property-boundary', 'property_compare_boundary');
  await assert.rejects(perform('mystery:property-reconcile', 'property_reconcile_registry'), { code: 'location' });
  await move('docks');
  await perform('mystery:property-reconcile', 'property_reconcile_registry');
  assert.equal(await eligibility(), null, 'a reconciled file still requires explicit final title verification');
  for (const proof of ['ledger', 'witness', 'address', 'survey', 'boundary', 'title-file']) {
    const nodeId = 'evidence:property-' + proof;
    await pool.query("UPDATE mystery_node_state SET state='discovered',completed_at=NULL WHERE instance_id=$1 AND node_id=$2",
      [started.instanceId, nodeId]);
    await assert.rejects(perform(source.nodeId, 'property_verify_title'),
      (error) => ['graph_dependency', 'graph_dependency_any', 'mystery_prerequisite'].includes(error.code),
      'every required proof must be completed at final verification');
    await pool.query("UPDATE mystery_node_state SET state='completed',completed_at=now() WHERE instance_id=$1 AND node_id=$2",
      [started.instanceId, nodeId]);
  }
  await assert.rejects(perform(source.nodeId, 'forged_verification'), { code: 'interaction' });
  const completion = await act(completeNode, source.nodeId,
    { idempotencyKey: 'deed-quest-finish', interactionId: 'property_verify_title' });
  assert.equal(completion.status, 'completed');
  const expected = { graphId: source.graphId, version: 1, nodeId: source.nodeId, instanceId: started.instanceId };
  assert.deepEqual(await eligibility(), expected, 'the real shipped quest grants exactly its approved eligibility');
  const readOnly = { query(sql, params) {
    assert.match(sql.trim(), /^SELECT\b/i, 'the board verifier issues only reads');
    assert.doesNotMatch(sql, /\bFOR\s+(UPDATE|SHARE)\b/i, 'read-only character boards cannot acquire write locks');
    return pool.query(sql, params);
  } };
  assert.deepEqual(await verifiedQuestDeedEligibility(readOnly, { accountId, characterId }), expected,
    'completed quest eligibility is available through the read-only board client');
  const currentActor = (await pool.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
  const property = (await deedDiscoveryBoard(readOnly, currentActor)).buildings.find((building) => building.id === 'docks-0001');
  assert.equal(property.qualified, true);
  assert.equal(property.source, 'quest', 'quest completion labels a partially investigated property with the actual qualification source');
  assert.deepEqual(await act(completeNode, source.nodeId,
    { idempotencyKey: 'deed-quest-finish', interactionId: 'property_verify_title' }), completion,
  'quest completion replay preserves its exact result');
  assert.deepEqual(await eligibility(), expected, 'eligibility replay keeps a stable source identifier');
  assert.equal(Number((await pool.query('SELECT COUNT(*) AS n FROM street_deeds')).rows[0].n), 0,
    'quest eligibility cannot mint a deed or bypass the shared primary-claim ledger');
  assert.equal(Number((await pool.query('SELECT cash FROM characters WHERE id=$1', [characterId])).rows[0].cash), 100,
    'cosmetic quest reward execution still has no cash adapter');
  const otherOwner = { scope: 'character', id: otherCharacterId };
  const otherAct = (fn, ...args) => tx((client) => fn(client, otherContext, otherOwner, source.graphId, ...args));
  await pool.query('UPDATE characters SET respect=100000000 WHERE id=$1', [otherCharacterId]);
  const otherStarted = await otherAct(startMystery, 1, 'deed-records-start');
  for (const [district, node, interaction] of [
    ['docks', 'briefing', 'property_briefing'], ['docks', 'ledger', 'property_inspect_ledger'],
    ['docks', 'choice', 'property_choose_approach'], ['neon', 'records', 'property_inspect_records'],
    ['neon', 'address', 'property_verify_address'], ['foundry', 'survey', 'property_inspect_survey'],
    ['foundry', 'boundary', 'property_compare_boundary'], ['docks', 'reconcile', 'property_reconcile_registry'],
    ['docks', 'verify-title', 'property_verify_title'],
  ]) {
    await pool.query('UPDATE characters SET loc=$2 WHERE id=$1', [otherCharacterId, district]);
    if (node === 'choice') await otherAct(commitChoice, 'choice:property-approach', 'records',
      { idempotencyKey: 'deed-records-choice', interactionId: interaction });
    else await otherAct(completeNode, 'mystery:property-' + node,
      { idempotencyKey: 'deed-records-' + node, interactionId: interaction });
  }
  assert.deepEqual(await eligibility({ accountId: otherAccountId, characterId: otherCharacterId }),
    { graphId: source.graphId, version: 1, nodeId: source.nodeId, instanceId: otherStarted.instanceId },
    'the document branch completes the same verified multi-district inquiry');
  for (const instanceId of [started.instanceId, otherStarted.instanceId]) {
    const actions = (await pool.query("SELECT node_id FROM mystery_node_state WHERE instance_id=$1 AND state='completed'", [instanceId]))
      .rows.filter((row) => /^(mystery|choice):/.test(row.node_id));
    assert.equal(actions.length, 9, 'both branches require nine completed actions, beyond starting and travel');
  }

  for (const [field, rejected, restored] of [
    ['graph_version', 2, 1], ['graph_id', 'unapproved-quest', source.graphId],
    ['owner_scope', 'account', 'character'], ['owner_id', 'deed-quest-unstarted-character', characterId],
    ['authority_account_id', otherAccountId, accountId],
    ['definition_hash', '0'.repeat(64), source.definitionHash],
    ['definition_hash', null, source.definitionHash],
  ]) {
    await pool.query(`UPDATE mystery_instances SET ${field}=$2 WHERE id=$1`, [started.instanceId, rejected]);
    assert.equal(await eligibility(), null, 'wrong graph/version/owner or incomplete state cannot qualify');
    await pool.query(`UPDATE mystery_instances SET ${field}=$2 WHERE id=$1`, [started.instanceId, restored]);
    assert.deepEqual(await eligibility(), expected);
  }
  await pool.query("UPDATE mystery_instances SET status='active',completed_at=NULL WHERE id=$1", [started.instanceId]);
  assert.equal(await eligibility(), null, 'only a completed quest lifecycle qualifies');
  await pool.query("UPDATE mystery_instances SET status='completed',completed_at=now() WHERE id=$1", [started.instanceId]);
  await pool.query("UPDATE mystery_node_state SET state='discovered',completed_at=NULL WHERE instance_id=$1 AND node_id=$2",
    [started.instanceId, source.nodeId]);
  assert.equal(await eligibility(), null, 'a matching instance requires a completed terminal node too');
  await pool.query("UPDATE mystery_node_state SET state='completed',completed_at=now() WHERE instance_id=$1 AND node_id=$2",
    [started.instanceId, source.nodeId]);
  assert.deepEqual(await eligibility(), expected);
  await assert.rejects(eligibility({ accountId: otherAccountId, characterId }),
    (error) => error?.code === 'no_character', 'a foreign account cannot use another character completion');
  const claimRespect = 24 ** 2 * PACING.LEVEL_DIVISOR;
  await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [characterId, claimRespect - 1]);
  assert.deepEqual(await eligibility(), expected, 'a completed dossier remains valid below the separate claim level');
  await assert.rejects(tx(async (client) => {
    const ch = (await client.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
    return claimDeed(ch, { name: 'Quest Earned House', buildingId: 'docks-0001' }, client);
  }), { code: 'level' }, 'completing the real property quest cannot bypass the Level 25 claim gate');
  await pool.query('UPDATE characters SET respect=$2 WHERE id=$1', [characterId, claimRespect]);
  const claim = await tx(async (client) => {
    const ch = (await client.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
    return claimDeed(ch, { name: 'Quest Earned House', buildingId: 'docks-0001' }, client);
  });
  assert.equal(claim.building.id, 'docks-0001', 'a completed approved quest really qualifies an exact current-district property');
  const receipt = (await pool.query('SELECT * FROM street_deed_primary_claims WHERE account_id=$1', [accountId])).rows[0];
  assert.equal(receipt.source, 'quest');
  assert.equal(receipt.building_id, 'docks-0001');
  const discovery = (await pool.query('SELECT source_ref FROM street_deed_discoveries WHERE account_id=$1 AND building_id=$2',
    [accountId, 'docks-0001'])).rows[0];
  assert.deepEqual(JSON.parse(discovery.source_ref), expected, 'the primary claim records verified quest provenance');
  await pool.query("UPDATE street_deeds SET account_id='onchain:quest-proof' WHERE account_id=$1", [accountId]);
  await assert.rejects(tx(async (client) => {
    const ch = (await client.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows[0];
    return investigateDeed(ch, { buildingId: 'docks-0002', actionId: 'inspect-site' }, client);
  }), (error) => error?.code === 'deed_primary_claimed',
  'a quest reward consumes the shared account lifetime entitlement across the exploration path and extraction');
  await pool.query('UPDATE characters SET alive=false WHERE id=$1', [characterId]);
  await assert.rejects(eligibility(), (error) => error?.code === 'no_character', 'a dead character cannot claim');
  const heirId = 'deed-quest-heir';
  await pool.query(
    "INSERT INTO characters (id,account_id,name,season,loc,respect,cash) VALUES ($1,$2,'Quest Heir',1,'docks',0,100)",
    [heirId, accountId],
  );
  assert.equal(await eligibility({ accountId, characterId: heirId }), null,
    'a replacement character cannot reuse a previous character quest completion');
  console.log('Deed quest eligibility: both nine-action district journeys, required evidence, onboarding exclusion, quest-to-claim, lifetime receipt, source/account/life pins, replay and wrong-state gates passed.');
} finally { await pool.end(); }
