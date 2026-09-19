// Complement existing player-command/director/campaign-network journeys with
// canonical branches absent from their end-to-end assertions. Accounts and their
// starting stats are fixtures; acquisition/preparation use production domains.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { canonicalBytes } from '../src/content/canonical.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createCampaignNetworkDefinitions } from '../src/director/campaign-network.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { worldKernelInvariants } from '../src/world-kernel-invariants.js';
import { familyOperationInvariants } from '../src/coordination/operation-invariants.js';
import { campaignNetworkFixture } from './lib/campaign-network-support.js';
import { key, issueAndExecute, executeIssued } from './lib/player-command-support.js';

const results = [];
const scenarios = [
  { action: 'recover_shipment', state: 'recovered', recovery: 'completed' },
  { action: 'destroy_shipment', state: 'destroyed' },
  { action: 'secure_records', state: 'secured', market: true },
  { action: 'publish_allegation', state: 'unproven', market: true },
  { action: 'preserve_uncertainty', state: 'unproven', recovery: 'failed' },
];
for (const scenario of scenarios) {
  const f = await campaignNetworkFixture(`rc1_${scenario.action}`);
  const director = createLivingWorldDirector({ pool: f.pool, content: f.content,
    definitions: createCampaignNetworkDefinitions(f.content), mode: 'LIVE', clock: f.clock });
  const engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, director,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const tick = () => { f.advance(); return director.tick(); };
  let prefix = 'a', operation;
  try {
    const empty = await engine.snapshot(f.actors.aBoss);
    assert(!empty.commands.some((command) => command.availability === 'AVAILABLE'
      && command.commandType === 'situation.act' && command.parameters.actionId === 'establish_market'),
    'Director cannot offer market establishment before canonical diversion');
    await f.networkEstablish(); await tick();
    if (scenario.market) {
      prefix = 'b';
      for (const action of ['intercept_shipment', 'establish_market', 'expose_market']) {
        const previous = await f.networkPrepare(action, { prefix, engine });
        await previous.command('organizer', 'execute'); await tick();
      }
      await f.move(f.actors.bBoss, 'docks');
      await f.networkMystery(f.actors.bBoss, f.ids.informantEvidence, 'start', engine);
      await f.networkMystery(f.actors.bBoss, f.ids.informantEvidence, 'complete', engine);
      await f.networkLearn(f.actors.bBoss, f.ids.intelligenceGraph, engine);
    }
    if (scenario.recovery) {
      const definition = f.content.operationDefinitions.find((entry) => entry.id === 'operation:canal_recover_shipment');
      let selected;
      for (let attempt = 0; attempt < 64; attempt++) {
        const created = await f.family.create(f.actors.aBoss, { definitionId: definition.id }, key());
        const row = (await f.pool.query('SELECT resolution_seed FROM world_operations WHERE id=$1', [created.operationId])).rows[0];
        const digest = crypto.createHash('sha256').update(canonicalBytes([row.resolution_seed, created.operationId, definition.contentHash])).digest('hex');
        const outcome = parseInt(digest.slice(0, 12), 16) % 1000 < definition.resolution.chancePermille ? 'completed' : 'failed';
        if (outcome === scenario.recovery) { selected = created.operationId; break; }
        await f.family.command(f.actors.aBoss, created.operationId, 'cancel', {}, key());
      }
      assert(selected, 'Bounded ordinary creation obtains the requested recovery branch without rewriting outcomes');
      operation = await f.networkPrepare('recover_shipment', { existingOperationId: selected });
      if (scenario.recovery === 'failed') {
        await issueAndExecute(engine, operation.boss, 'operation.execute', { operationId: selected }, { operationId: selected });
        assert.equal((await f.family.get(operation.boss, selected)).status, 'failed');
        await tick(); await f.move(operation.boss, 'docks');
        await f.networkMystery(operation.boss, f.ids.failureEvidence, 'start', engine);
        await f.networkMystery(operation.boss, f.ids.failureEvidence, 'complete', engine);
        operation = await f.networkPrepare(scenario.action, { engine });
      }
    } else operation = await f.networkPrepare(scenario.action, { prefix, engine });
    const before = await engine.snapshot(operation.boss);
    const execution = await issueAndExecute(engine, operation.boss, 'operation.execute',
      { operationId: operation.operationId }, { operationId: operation.operationId });
    assert.equal((await f.kernel.get(operation.boss, f.ids.object)).state, scenario.state);
    assert.equal((await f.family.get(operation.boss, operation.operationId)).status, 'completed');
    assert.equal((await executeIssued(engine, operation.boss, execution.command)).replayed, true);
    const transitions = [];
    for (let count = 0; count < 4; count++) transitions.push(await tick());
    const after = await engine.snapshot(operation.boss);
    const events = (await f.pool.query('SELECT id,action_id,next_state,operation_id FROM world_kernel_events WHERE object_id=$1 ORDER BY revision', [f.ids.object])).rows;
    assert.equal(events.filter((event) => event.operation_id === operation.operationId).length, 1, 'Exactly one canonical branch consequence');
    assert.equal(new Set(events.map((event) => event.id)).size, events.length);
    assert(!after.knowledge.claims.some((claim) => /guilty|traitor/.test(claim.proposition)), 'Neither accusation nor uncertainty creates a guilt claim');
    const consequences = after.consequences.filter((event) => !before.consequences.some((previous) => previous.id === event.id));
    assert(consequences.length > 0, 'The actor receives a visible canonical consequence');
    if (scenario.state === 'unproven') {
      assert(consequences.some((event) => /concern remains unresolved/.test(event.description)
        && /does not establish betrayal/.test(event.description)), 'Uncertainty must remain explicit in the player consequence');
    }
    if (scenario.state === 'secured') assert(consequences.some((event) => /shipping records are secured/.test(event.description)
      && /does not establish/.test(event.description)), 'Securing records must not read as a finding of guilt');
    assert.deepEqual(await worldKernelInvariants(f.pool), { ok: true, issues: [] });
    assert.deepEqual(await familyOperationInvariants(f.pool), { ok: true, historyIssues: [], custodyIssues: [], capitalIssues: [] });
    const entry = { action: scenario.action, state: scenario.state, status: 'PASS', operationId: operation.operationId,
      events, consequences, newOpportunities: after.opportunities.filter((opportunity) =>
        !before.opportunities.some((previous) => previous.opportunityId === opportunity.opportunityId)),
      downstreamSelections: transitions.flatMap((result) => result.selected),
      remainingSituations: after.situations.map(({ title, description, objective }) => ({ title, description, objective })) };
    results.push(entry);
    console.log(`PASS ${scenario.action}: ${scenario.state}, issued command/replay, visible consequence, custody/kernel invariants; downstream selections=${entry.downstreamSelections.length}`);
  } finally { await f.cleanup(); }
}
fs.mkdirSync('docs/release/evidence/player', { recursive: true });
fs.writeFileSync(`docs/release/evidence/player/rc1-branches${process.argv.includes('--postgres') ? '-postgres' : ''}.json`, JSON.stringify({
  database: process.argv.includes('--postgres') ? 'PostgreSQL with private schema per story' : 'pg-mem',
  scope: 'Complementary domain journeys, not new-account browser journeys; initial stats and bounded outcome selection are fixtures', results,
}, null, 2));
