import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { canonicalBytes } from '../src/content/canonical.js';
import { createDockWarContent } from '../src/content/dock-war.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';
import { createCampaignNetworkContent } from '../src/content/campaign-network.js';
import { createCampaignNetworkDefinitions, CAMPAIGN_NETWORK_SITUATION_IDS, CAMPAIGN_NETWORK_CAMPAIGN_IDS } from '../src/director/campaign-network.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { mysteryBoard } from '../src/mysteries.js';
import { executeIssued, key } from './lib/player-command-support.js';
import { campaignNetworkFixture } from './lib/campaign-network-support.js';

const original = createDockWarContent(), expanded = createCampaignNetworkContent();
assert.deepEqual(expanded.worldDefinitions.find((entry) => entry.id === original.ids.object), original.worldDefinitions[0]);
for (const operation of original.operationDefinitions)
  assert.deepEqual(expanded.operationDefinitions.find((entry) => entry.id === operation.id), operation);
const compiled = createCampaignNetworkDefinitions(expanded), dockDefinitions = createDockWarDefinitions(original);
for (const definition of dockDefinitions.situations)
  assert.deepEqual(compiled.situations.find((entry) => entry.id === definition.id), definition, 'Dock War v1 remains immutable');
assert.deepEqual(compiled.campaigns.find((entry) => entry.id === dockDefinitions.campaigns[0].id), dockDefinitions.campaigns[0]);

const f = await campaignNetworkFixture('gold_network');
let engine;
const director = createLivingWorldDirector({ pool: f.pool, content: f.content,
  definitions: createCampaignNetworkDefinitions(f.content), mode: 'LIVE', clock: f.clock });
const tick = async () => { f.advance(); return director.tick(); };
const select = async (definitionId) => {
  for (let attempt = 0; attempt < 4; attempt++) {
    const result = await tick(), selected = result.selected.find((entry) => entry.definitionId === definitionId);
    if (selected) return selected;
  }
  assert.fail(`Canonical consequence did not create ${definitionId}`);
};
try {
  engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, director,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const earlyCatalog = await engine.snapshot(f.actors.outsider);
  assert.equal(earlyCatalog.situations.length, 0);
  for (const graphId of [f.ids.shipmentEvidence, f.ids.informantEvidence, f.ids.failureEvidence, f.ids.personalEvidence]) {
    await f.networkMystery(f.actors.outsider, graphId, 'start', engine);
    const board = await mysteryBoard(f.pool, f.context(f.actors.outsider), f.owner(f.actors.outsider), graphId);
    const publicMetadata = f.content.registry.byPackage.get(graphId).nodes.filter((node) => node.visibility === 'public')
      .map((node) => node.metadata);
    const serialized = JSON.stringify({ catalog: earlyCatalog.cases.catalog, board, publicMetadata });
    for (const unearned of ['You participated', 'load is stranded', 'market\'s exposure', 'Your Part in the Disclosure',
      'The Cargo Seal Impressions', 'The Printer Copy', f.ids.disclosureRecord])
      assert(!serialized.includes(unearned), `Early ${graphId} reveals unearned information: ${unearned}`);
    if (graphId !== f.ids.personalEvidence) assert.equal(board.actions.length, 0,
      'Public invitations never authorize missing world facts or operation participation');
    assert(!board.actions.some((entry) => entry.kind === 'discover'), 'Secret evidence remains undiscoverable before its cause');
  }
  await f.networkEstablish();
  const shipment = await select(CAMPAIGN_NETWORK_SITUATION_IDS.shipment);
  const outsider = await engine.snapshot(f.actors.outsider);
  assert(!outsider.situations.some((entry) => entry.id === shipment.situationId));
  for (const secret of ['situation:missing_shipment', 'pressureInputs', 'relatedWorld', 'corroborated.public-disclosure'])
    assert(!JSON.stringify(outsider).includes(secret), `Unauthorized projection leaked ${secret}`);
  const interception = await f.networkPrepare('intercept_shipment', { prefix: 'b', engine, situationAction: 'intercept_shipment' });
  const executed = await interception.command('organizer', 'execute');
  assert.equal((await f.kernel.get(f.actors.bBoss, f.ids.object)).state, 'diverted');
  assert.equal((await executeIssued(engine, interception.boss, executed.command)).replayed, true);
  const afterInterception = await tick();
  assert(afterInterception.transitions.some((entry) => entry.id === shipment.situationId && entry.kind === 'resolution'));
  const blackMarket = await select(CAMPAIGN_NETWORK_SITUATION_IDS.market);
  assert.notEqual(blackMarket.campaignId, shipment.campaignId, 'The new campaign is selected from physical state, not a campaign branch');
  const establishment = await f.networkPrepare('establish_market', { prefix: 'b', engine, situationAction: 'establish_market' });
  await establishment.command('organizer', 'execute');
  await tick(); await select(CAMPAIGN_NETWORK_SITUATION_IDS.marketTrade);
  const exposure = await f.networkPrepare('expose_market', { prefix: 'b', engine, situationAction: 'expose_market' });
  await exposure.command('organizer', 'execute');
  await tick();
  const informant = await select(CAMPAIGN_NETWORK_SITUATION_IDS.informant);
  assert.notEqual(informant.campaignId, blackMarket.campaignId);
  const before = await engine.snapshot(f.actors.bBoss);
  assert(!before.commands.some((entry) => entry.commandType === 'situation.act' && entry.parameters.actionId === 'trace_disclosure'),
    'Route knowledge alone cannot reveal independent corroboration');
  assert(!JSON.stringify(await engine.snapshot(f.actors.outsider)).includes('Two independent records explain the disclosure'));
  for (const account of [f.actors.bBoss, f.actors.aBoss]) {
    await f.move(account, 'docks');
    await f.networkMystery(account, f.ids.personalEvidence, 'start', engine);
    await f.networkMystery(account, f.ids.personalEvidence, 'complete', engine);
  }
  const otherNotes = await engine.snapshot(f.actors.aBoss, { mysteryGraphId: f.ids.personalEvidence });
  assert(!JSON.stringify(otherNotes).includes('Your Part in the Disclosure'));
  assert(!JSON.stringify(otherNotes).includes(f.ids.disclosureRecord));
  assert(!otherNotes.commands.some((entry) => entry.commandType === 'mystery.discover' && entry.parameters.graphId === f.ids.personalEvidence),
    'A rival cannot enumerate or discover another player\'s disclosure participation');
  await f.networkMystery(f.actors.bBoss, f.ids.personalEvidence, 'discover', engine);
  await f.networkMystery(f.actors.bBoss, f.ids.personalEvidence, 'complete', engine);
  const ownNotes = await engine.snapshot(f.actors.bBoss, { mysteryGraphId: f.ids.personalEvidence });
  assert(JSON.stringify(ownNotes).includes('Whether the disclosure was authorized is not established'));
  const seal = await f.publicTrail('b', engine);
  const trace = await f.networkPrepare('trace_disclosure', { prefix: 'b', engine, situationAction: 'trace_disclosure', preparedItem: seal });
  await trace.command('organizer', 'execute');
  await tick();
  assert.equal((await f.kernel.get(f.actors.bBoss, f.ids.object)).state, 'public_trace');
  const campaigns = (await f.pool.query('SELECT definition_id,status FROM director_campaigns WHERE object_id=$1', [f.ids.object])).rows;
  for (const campaignId of [CAMPAIGN_NETWORK_CAMPAIGN_IDS.shipment, CAMPAIGN_NETWORK_CAMPAIGN_IDS.market, CAMPAIGN_NETWORK_CAMPAIGN_IDS.informant])
    assert(campaigns.some((entry) => entry.definition_id === campaignId && entry.status === 'completed'), campaignId);
  const events = (await f.pool.query('SELECT action_id FROM world_kernel_events WHERE object_id=$1 ORDER BY revision', [f.ids.object])).rows;
  assert.deepEqual(events.map((entry) => entry.action_id), ['register_shipment', 'intercept_shipment', 'establish_market', 'expose_market', 'trace_disclosure']);
  assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM world_operation_capital')).rows[0].n, 0);
  assert.deepEqual(await worldKernelInvariants(f.pool), { ok: true, issues: [] });
  assert.deepEqual(await familyOperationInvariants(f.pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
  const restarted = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions: createCampaignNetworkDefinitions(f.content), mode: 'LIVE', clock: f.clock });
  assert.equal((await restarted.tick()).replayed, true);
  assert.equal((await f.pool.query('SELECT count(*)::int AS n FROM world_kernel_events WHERE object_id=$1', [f.ids.object])).rows[0].n, 5);
  console.log('campaign-network-journey: Dock v1 preserved; issued-command shipment → market → corroborated non-traitor Informant; private evidence, conserved custody, restart and replay PASS');
} finally { await f.cleanup(); }

for (const branch of ['supply_market', 'restore_supply', 'seize_market']) {
  const g = await campaignNetworkFixture(`gold_${branch}`);
  try {
    await g.networkEstablish();
    for (const action of ['intercept_shipment', 'establish_market', branch]) {
      const response = await g.networkPrepare(action, { prefix: 'b' });
      await response.command('organizer', 'execute');
    }
    const canonical = await g.kernel.get(g.actors.bBoss, g.ids.object);
    assert.equal(canonical.state, { supply_market: 'market_supplied', restore_supply: 'restored', seize_market: 'market_seized' }[branch]);
    assert.deepEqual(await worldKernelInvariants(g.pool), { ok: true, issues: [] });
    assert.deepEqual(await familyOperationInvariants(g.pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    console.log(`campaign-network-journey ${branch}: materially distinct canonical state and actual inventory custody PASS`);
  } finally { await g.cleanup(); }
}

const community = await campaignNetworkFixture('gold_community');
try {
  await community.networkEstablish();
  const boss = community.actors.aBoss;
  await community.networkMystery(boss, community.ids.shipmentEvidence, 'start');
  await community.networkMystery(boss, community.ids.shipmentEvidence, 'complete');
  await community.networkCraft(boss);
  await community.networkMystery(boss, community.ids.shipmentEvidence, 'discover');
  await community.networkMystery(boss, community.ids.shipmentEvidence, 'complete');
  const response = await community.networkPrepare('redistribute_shipment');
  await response.command('organizer', 'execute');
  assert.equal((await community.kernel.get(boss, community.ids.object)).state, 'redistributed');
  assert.deepEqual(await worldKernelInvariants(community.pool), { ok: true, issues: [] });
  console.log('campaign-network-journey redistribution: solo investigation, crafted evidence and same-Crew operation restore a distinct route PASS');
} finally { await community.cleanup(); }

const failure = await campaignNetworkFixture('gold_failed_plan');
try {
  await failure.networkEstablish();
  const boss = failure.actors.aBoss;
  const definition = failure.content.operationDefinitions.find((entry) => entry.id === 'operation:canal_recover_shipment');
  let operationId;
  // Choose an existing deterministic failure seed through normal creation and
  // cancellation. No seed, receipt, resource or operation outcome is rewritten.
  for (let attempt = 0; attempt < 64; attempt++) {
    const created = await failure.family.create(boss, { definitionId: definition.id }, key());
    const row = (await failure.pool.query('SELECT resolution_seed FROM world_operations WHERE id=$1', [created.operationId])).rows[0];
    const digest = crypto.createHash('sha256').update(canonicalBytes([row.resolution_seed, created.operationId, definition.contentHash])).digest('hex');
    if (parseInt(digest.slice(0, 12), 16) % 1000 >= definition.resolution.chancePermille) { operationId = created.operationId; break; }
    await failure.family.command(boss, created.operationId, 'cancel', {}, key());
  }
  assert(operationId, 'The bounded canonical fixture must obtain a failed recovery');
  const recovery = await failure.networkPrepare('recover_shipment', { existingOperationId: operationId });
  await recovery.command('organizer', 'execute');
  assert.equal((await failure.family.get(boss, operationId)).status, 'failed');
  assert.equal((await failure.kernel.get(boss, failure.ids.object)).state, 'stranded');
  const unproven = await failure.family.catalog(failure.actors.bBoss);
  assert(!unproven.operations.some((entry) => entry.id === 'operation:canal_review_failed_plan'),
    'A rival cannot adopt a failed-operation participation receipt');
  await failure.networkMystery(boss, failure.ids.failureEvidence, 'start');
  await failure.networkMystery(boss, failure.ids.failureEvidence, 'complete');
  const corrected = await failure.networkPrepare('review_failed_plan');
  await corrected.command('organizer', 'execute');
  assert.equal((await failure.kernel.get(boss, failure.ids.object)).state, 'secured');
  assert.equal((await failure.family.get(boss, operationId)).status, 'failed', 'Recovery preserves the failed historical outcome');
  assert.deepEqual(await worldKernelInvariants(failure.pool), { ok: true, issues: [] });
  assert.deepEqual(await familyOperationInvariants(failure.pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
  console.log('campaign-network-journey failed plan: actual failed-operation evidence, restricted participants, non-traitor correction and preserved losses PASS');
} finally { await failure.cleanup(); }
