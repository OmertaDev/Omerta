// RC1 release evidence. This is a bounded, sequential service simulation, not
// a browser, network load, PostgreSQL concurrency or retention experiment.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { campaignNetworkFixture } from '../test/lib/campaign-network-support.js';
import { addPlayer, executeIssued, findCommand, key } from '../test/lib/player-command-support.js';
import { createCrew, inviteToCrew, acceptInvite, CREW_FIRST_CHARACTER_LOCKS } from '../src/crew.js';
import { createGang, joinGang } from '../src/social.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createCampaignNetworkDefinitions } from '../src/director/campaign-network.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { sourceIdentity, createProofRecorder, validateScenarioManifest } from './rc1-native-proof.js';

export const ARCHETYPES = Object.freeze(['solo', 'high_activity', 'low_activity', 'crew_focused',
  'family_focused', 'economic', 'information_focused', 'aggressive', 'cooperative', 'opportunistic',
  'disappearing', 'repeated_failure', 'hoarder']);
const digest = (value) => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const sample = (...value) => Number.parseInt(digest(value).slice(0, 8), 16);
const sum = (values) => values.reduce((total, value) => total + Number(value), 0);
const counts = (values) => Object.fromEntries([...new Set(values)].sort().map((key) => [key, values.filter((v) => v === key).length]));
export function rosterFor(population, seed, replicate) {
  assert(Number.isSafeInteger(population) && population >= 5);
  return Array.from({ length: population - 5 }, (_, index) => ({
    id: `sim-${index}`, archetype: ARCHETYPES[(index + sample(seed, replicate)) % ARCHETYPES.length],
    priority: sample(seed, replicate, index),
  })).sort((a, b) => a.priority - b.priority);
}

// Policy randomness must not depend on generated command/instance IDs. Resolve
// only the actor's authorized projection; hidden discover nodes remain hidden.
export function policyCommandKey(view, command) {
  const parameters = command.parameters || {};
  if (command.commandType === 'discovery.act') {
    const instance = view.discovery.instances.find((entry) => entry.id === parameters.instanceId);
    assert(instance, 'A policy may only select an authorized discovery instance');
    const ordinal = instance.actions.findIndex((entry) => entry.id === parameters.actionId);
    assert(ordinal >= 0, 'A policy may only select an authorized discovery action');
    const action = instance.actions[ordinal];
    return JSON.stringify([command.commandType, instance.graphId, instance.revision, action.kind, action.nodeId || null, ordinal]);
  }
  assert(['discovery.start', 'mystery.start', 'mystery.complete'].includes(command.commandType));
  return JSON.stringify([command.commandType, parameters.graphId, parameters.nodeId || null, parameters.optionId || null]);
}
export function chooseSeededCommand(view, seed, replicate, actorId, round) {
  const ranked = view.commands.filter((command) => command.availability === 'AVAILABLE'
    && ['discovery.start', 'discovery.act', 'mystery.start', 'mystery.complete'].includes(command.commandType))
    .map((command) => ({ command, key: policyCommandKey(view, command) }));
  ranked.sort((a, b) => sample(seed, replicate, actorId, round, a.key) - sample(seed, replicate, actorId, round, b.key)
    || a.key.localeCompare(b.key, 'en'));
  return ranked[0]?.command;
}

export function verifyLedgerChecks(baseline, final, population) {
  const initialByName = new Map(baseline.checks.map((check) => [check.name, check]));
  assert.equal(initialByName.size, baseline.checks.length);
  assert.equal(final.checks.length, baseline.checks.length, 'The final audit must retain every baseline invariant');
  assert.equal(new Set(final.checks.map((c) => c.name)).size, final.checks.length);
  for (const check of baseline.checks) {
    if (check.name === 'character cash') assert.equal(check.drift, population * (100000 - 500));
    else assert(check.ok, `Unexpected baseline corruption: ${check.name}`);
  }
  return final.checks.map((check) => {
    const initial = initialByName.get(check.name); assert(initial, check.name);
    const ok = check.name === 'character cash'
      ? Math.abs(check.drift - initial.drift) < 0.000001 : check.ok;
    assert(ok, `Conservation/provenance invariant failed: ${JSON.stringify(check)}`);
    return { name: check.name, baselineDrift: initial.drift, finalDrift: check.drift, ok,
      ...(check.issues ? { issues: check.issues } : {}) };
  });
}

export async function runNativeSimulation({ population, seed, replicate, rounds = 2, progress = () => {}, proof = null,
  fixtureOptions = {}, fixtureReady = () => {}, serial = false }) {
  assert(Number.isSafeInteger(rounds) && rounds > 0, 'A run must execute at least one round');
  if (proof) assert(process.argv.includes('--postgres'), 'Proof artifacts require real PostgreSQL');
  const started = performance.now(), tag = `rc1_${population}_${replicate}_${digest(seed).slice(0, 6)}`;
  const f = await campaignNetworkFixture(tag, fixtureOptions);
  fixtureReady(f);
  const initialLogicalTime = f.clock();
  const roster = rosterFor(population, seed, replicate);
  const metrics = { snapshots: 0, commandsIssuedAvailable: 0, commandsExecuted: 0, commandReplays: 0,
    rejectedCommands: {}, opportunityCardsShown: 0, opportunityCardsUniquePerActor: 0,
    visitsWithoutAvailableOpportunity: 0, truncatedOpportunityVisits: 0, maximumCardsPerVisit: 0,
    knowledgePrivacyProbes: 0, unauthorizedKnowledgeDisclosures: 0, foreignCommandProbes: 0,
    staleCommandProbes: 0, replayStateChecks: 0, disappearedBeforeCommand: 0,
    directorTicks: 0, directorSelections: 0, directorTransitions: 0, completedOpportunityCommandLinks: 0,
    knowledgeShares: 0, authorizedKnowledgeReads: 0, abandonedOperationsRecovered: 0, concurrentOperationExecuteBursts: 0,
    serialOperationExecuteRetries: 0 };
  const seen = new Set(), attempts = [], playerActions = new Map();
  const definitions = createCampaignNetworkDefinitions(f.content);
  const director = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions, mode: 'LIVE', clock: f.clock });
  const raw = createPlayerCommandEngine({ pool: f.pool, content: f.content, director,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const engine = {
    async snapshot(account, options) {
      const view = proof ? await proof.invoke('player.snapshot', { account, options: options || {} }, () => raw.snapshot(account, options))
        : await raw.snapshot(account, options);
      metrics.snapshots++; metrics.commandsIssuedAvailable += view.commands.filter((c) => c.availability === 'AVAILABLE').length;
      metrics.opportunityCardsShown += view.opportunities.length;
      metrics.maximumCardsPerVisit = Math.max(metrics.maximumCardsPerVisit, view.opportunities.length);
      if (!view.commands.some((c) => c.availability === 'AVAILABLE')) metrics.visitsWithoutAvailableOpportunity++;
      if (view.opportunitiesTruncated) metrics.truncatedOpportunityVisits++;
      for (const card of view.opportunities) seen.add(`${account}/${card.opportunityId}`);
      return view;
    },
    async execute(account, input, key) {
      try {
        const response = proof ? await proof.invoke('player.execute', { account, input, idempotencyKey: key }, () => raw.execute(account, input, key))
          : await raw.execute(account, input, key);
        if (response.replayed) metrics.commandReplays++;
        else { metrics.commandsExecuted++; playerActions.set(account, (playerActions.get(account) || 0) + 1); }
        return response;
      } catch (error) { metrics.rejectedCommands[error.code || error.name] = (metrics.rejectedCommands[error.code || error.name] || 0) + 1; throw error; }
    },
  };
  const tick = async () => {
    f.advance(); const result = proof ? await proof.invoke('director.tick', { logicalTime: f.clock() }, () => director.tick())
      : await director.tick(); metrics.directorTicks++;
    metrics.directorSelections += result.selected?.length || 0;
    metrics.directorTransitions += result.transitions?.length || 0;
    return result;
  };
  const stateCounts = async () => {
    const tables = ['world_kernel_events', 'world_operation_events', 'item_events', 'coordination_commands', 'transactions'];
    const result = {};
    for (const table of tables) result[table] = Number((await f.pool.query(`SELECT count(*) AS n FROM ${table}`)).rows[0].n);
    return result;
  };
  try {
    for (const actor of roster) await addPlayer(f.pool, actor.id);
    const baseline = await runLedgerInvariants(f.pool, { alert: false });
    const socialActors = roster.filter((a) => ['crew_focused', 'family_focused', 'cooperative'].includes(a.archetype));
    for (let i = 0; i < socialActors.length; i += 2) {
      const leader = socialActors[i], mate = socialActors[i + 1];
      const crew = await f.social(leader.id, (ch, client, hooks) => createCrew(ch, `Release Crew ${i}`, client, hooks));
      const family = await f.social(leader.id, (ch, client, hooks) => createGang(ch, `Release Family ${i}`, `R${i.toString(36).toUpperCase()}`, client, hooks));
      if (mate) {
        await f.social(leader.id, (ch, client, hooks) => inviteToCrew(ch, mate.id, client, hooks), CREW_FIRST_CHARACTER_LOCKS);
        await f.social(mate.id, (ch, client, hooks) => acceptInvite(ch, crew.id, client, hooks));
        await f.social(mate.id, (ch, client, hooks) => joinGang(ch, family.gangId, client, hooks));
        leader.mate = mate.id; mate.mate = leader.id;
      }
    }
    if (proof) {
      await proof.record({ kind: 'initialization', roster, fixtureActors: f.actors,
        grants: { perActorCash: 100000, perActorRespect: 10000, perActorMuscleCunningSpeed: 50 },
        entryMode: 'fixture-assisted', clockScope: 'Director application clock only; database NOW remains wall time' });
      await proof.snapshot(f.pool, 'initial-state');
      await proof.checkpoint(f.pool, 'initial', process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL);
    }
    await f.networkEstablish(); await tick();
    const privateClaim = (await f.knowledge.knowledgeBoard(f.actors.aBoss)).claims.find((c) => c.owned);
    assert(privateClaim, 'Privacy control must have an existing private claim');
    const foreignBoard = await engine.snapshot(f.actors.aBoss);
    const foreignCommand = foreignBoard.commands.find((c) => c.availability === 'AVAILABLE');
    assert(foreignCommand);
    for (const [index, actor] of roster.entries()) {
      let view = await engine.snapshot(actor.id);
      metrics.knowledgePrivacyProbes++;
      if (JSON.stringify(view).includes(privateClaim.id)) metrics.unauthorizedKnowledgeDisclosures++;
      assert(!JSON.stringify(view).includes(privateClaim.id), 'Private claim identity leaked to unrelated actor');
      if (actor.archetype === 'disappearing') { metrics.disappearedBeforeCommand++; continue; }
      if (['crew_focused', 'family_focused', 'cooperative', 'information_focused'].includes(actor.archetype)) {
        await f.networkLearn(actor.id, f.ids.routeGraph, engine);
        if (actor.mate) {
          const claimId = await f.share(actor.id, 'depot.route', actor.archetype === 'family_focused' ? 'family' : 'crew');
          metrics.knowledgeShares++;
          assert((await f.knowledge.knowledgeBoard(actor.mate)).claims.some((c) => c.id === claimId), 'Authorized group cannot read shared Knowledge');
          metrics.authorizedKnowledgeReads++;
          assert(!(await f.knowledge.knowledgeBoard(f.actors.outsider)).claims.some((c) => c.id === claimId), 'Unrelated actor read shared Knowledge');
          metrics.knowledgePrivacyProbes++;
        }
        view = await engine.snapshot(actor.id);
      }
      if (['economic', 'hoarder'].includes(actor.archetype)) {
        // Actual boost/salvage authorities, with controlled successful acquisition
        // in the existing fixture; no direct item or resource inserts.
        await f.acquireMaterials(actor.id); view = await engine.snapshot(actor.id);
      }
      if (['aggressive', 'repeated_failure'].includes(actor.archetype)) {
        const before = await stateCounts(); metrics.foreignCommandProbes++;
        await assert.rejects(() => executeIssued(engine, actor.id, foreignCommand), { code: 'command_unavailable' });
        assert.deepEqual(await stateCounts(), before, 'Foreign command changed canonical history');
      }
      const actionRounds = actor.archetype === 'low_activity' || actor.archetype === 'hoarder' ? 1
        : actor.archetype === 'high_activity' ? rounds + 2 : rounds;
      for (let round = 0; round < actionRounds; round++) {
        if (round) view = await engine.snapshot(actor.id);
        const command = chooseSeededCommand(view, seed, replicate, actor.id, round);
        if (!command) break;
        if (proof) await proof.record({ kind: 'policy-choice', actor: actor.id, seed, replicate, round,
          semanticKey: policyCommandKey(view, command), commandId: command.commandId });
        if (actor.archetype === 'repeated_failure') {
          const originalLocation = view.player.character.locationId || view.player.character.loc || 'docks';
          await f.move(actor.id, originalLocation === 'docks' ? 'foundry' : 'docks');
          metrics.staleCommandProbes++;
          await assert.rejects(() => executeIssued(engine, actor.id, command), { code: 'command_stale' });
          await f.move(actor.id, originalLocation); continue;
        }
        const result = await executeIssued(engine, actor.id, command);
        assert.equal(result.status, 'COMPLETED');
        metrics.completedOpportunityCommandLinks += view.opportunities.filter((c) => c.commandIds?.includes(command.commandId)).length;
        if (round === 0 && ['high_activity', 'opportunistic'].includes(actor.archetype)) {
          const before = await stateCounts();
          assert.equal((await executeIssued(engine, actor.id, command)).replayed, true);
          assert.deepEqual(await stateCounts(), before, 'Replay duplicated a canonical mutation'); metrics.replayStateChecks++;
        }
      }
      if ((index + 1) % 100 === 0) progress({ population, seed, replicate, playersVisited: index + 1 });
    }
    // Four designated fixture actors execute complete physical/campaign paths.
    // Other actors above are not falsely counted as operation participants.
    const abandoned = await f.networkPrepare('recover_shipment', { engine });
    const expiresAt = (await f.pool.query('SELECT expires_at FROM world_operations WHERE id=$1', [abandoned.operationId])).rows[0].expires_at;
    const originalNow = Date.now;
    try {
      // Move the process test clock across the actual persisted deadline. No
      // deadline, escrow, outcome or other canonical row is edited by the harness.
      if (serial) {
        f.advance(Math.max(0, (new Date(expiresAt).getTime() + 1 - f.clock()) / 1000));
        Date.now = () => f.clock();
      } else Date.now = () => new Date(expiresAt).getTime() + 1;
      await f.family.command(abandoned.boss, abandoned.operationId, 'expire', {}, key());
    } finally { Date.now = originalNow; }
    assert.equal((await f.family.get(abandoned.boss, abandoned.operationId)).status, 'expired');
    metrics.abandonedOperationsRecovered++;
    const branch = ['recover_shipment', 'intercept_shipment', 'destroy_shipment'][sample(seed, replicate, 'branch') % 3];
    const prefix = branch === 'intercept_shipment' ? 'b' : 'a';
    const action = await f.networkPrepare(branch, { prefix, engine });
    const execute = findCommand(await engine.snapshot(action.boss, { operationId: action.operationId }), 'operation.execute', { operationId: action.operationId });
    const burst = serial
      ? [...await Promise.allSettled([executeIssued(engine, action.boss, execute)]),
        ...await Promise.allSettled([executeIssued(engine, action.boss, execute)])]
      : await Promise.allSettled([executeIssued(engine, action.boss, execute), executeIssued(engine, action.boss, execute)]);
    // Production uses a nonblocking issuance lock: an in-flight duplicate may
    // receive retryable contention, while a later duplicate returns its receipt.
    // Accept only that documented refusal or a durable replay, never two writes.
    assert.equal(burst.filter((r) => r.status === 'fulfilled' && !r.value.replayed).length, 1);
    for (const result of burst) if (result.status === 'rejected') assert.equal(result.reason.code, 'contention');
    if (serial) metrics.serialOperationExecuteRetries++;
    else metrics.concurrentOperationExecuteBursts++;
    const beforeReplay = await stateCounts();
    assert.equal((await executeIssued(engine, action.boss, execute)).replayed, true);
    assert.deepEqual(await stateCounts(), beforeReplay); metrics.replayStateChecks++;
    await tick(); attempts.push(branch);
    if (branch === 'intercept_shipment') {
      for (const actionId of ['establish_market', ['supply_market', 'expose_market', 'seize_market'][sample(seed, replicate, 'market') % 3]]) {
        await tick(); const operation = await f.networkPrepare(actionId, { prefix: 'b', engine });
        await operation.command('organizer', 'execute'); await tick(); attempts.push(actionId);
      }
    }
    const restart = createLivingWorldDirector({ pool: f.pool, content: f.content, definitions, mode: 'LIVE', clock: f.clock });
    const beforeRestart = await stateCounts();
    assert.equal((await restart.tick()).replayed, true); assert.deepEqual(await stateCounts(), beforeRestart);
    const final = await runLedgerInvariants(f.pool, { alert: false });
    const invariantChecks = verifyLedgerChecks(baseline, final, population);
    const situations = (await f.pool.query('SELECT definition_id,campaign_id,state,terminal,outcome,world_event_id FROM director_situations')).rows;
    const campaigns = (await f.pool.query('SELECT definition_id,status FROM director_campaigns')).rows;
    const operations = (await f.pool.query('SELECT id,graph_id,status,resolution_seed FROM world_operations')).rows;
    const resources = (await f.pool.query('SELECT event_kind,quantity_delta,reason FROM item_events')).rows;
    const events = (await f.pool.query('SELECT id,object_id,revision,action_id FROM world_kernel_events ORDER BY object_id,revision')).rows;
    const participation = (await f.pool.query('SELECT character_id FROM world_operation_roles WHERE character_id IS NOT NULL')).rows;
    const claims = (await f.pool.query('SELECT id FROM coordination_claims')).rows;
    metrics.opportunityCardsUniquePerActor = seen.size;
    if (proof) {
      await proof.snapshot(f.pool, 'final-state');
      await proof.checkpoint(f.pool, 'final', process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL);
      await proof.record({ kind: 'assertions', invariantChecks, logicalTime: f.clock(), metrics });
    }
    return { population, seed, replicate, rounds, database: process.argv.includes('--postgres') ? 'postgresql' : 'pg-mem',
      status: 'PASS_SCOPED', durationMs: Math.round(performance.now() - started), archetypes: counts(roster.map((a) => a.archetype)),
      logicalDurationMs: f.clock() - initialLogicalTime, logicalClockScope: 'Director/fixture application clock; database wall clock is not advanced',
      fixturePlayers: 5, actorsExecutingCommands: playerActions.size, metrics, actions: attempts,
      authoritative: { situationsGenerated: situations.length, situationStates: counts(situations.map((s) => s.state)),
        situationsWithCanonicalResolution: situations.filter((s) => s.world_event_id).length,
        campaignsStarted: campaigns.length, campaignStatuses: counts(campaigns.map((c) => c.status)),
        distinctCampaignDefinitions: new Set(campaigns.map((c) => c.definition_id)).size,
        operationsCreated: operations.length, operationStatuses: counts(operations.map((o) => o.status)),
        uniqueOperationParticipants: new Set(participation.map((p) => p.character_id)).size,
        knowledgeClaims: claims.length,
        knowledgeGrants: Number((await f.pool.query('SELECT count(*) AS n FROM coordination_claim_grants')).rows[0].n),
        crews: Number((await f.pool.query('SELECT count(*) AS n FROM crews')).rows[0].n),
        families: Number((await f.pool.query('SELECT count(*) AS n FROM gangs')).rows[0].n),
        operationReceipts: operations,
        itemsCreated: resources.filter((e) => e.event_kind === 'created').length,
        itemsConsumed: resources.filter((e) => e.event_kind === 'consumed').length,
        stackUnitsCreated: sum(resources.filter((e) => e.event_kind === 'stack_granted').map((e) => e.quantity_delta)),
        stackUnitsConsumed: -sum(resources.filter((e) => e.event_kind === 'stack_consumed').map((e) => e.quantity_delta)),
        worldChanges: events.length, worldActions: events.map((e) => ({ object: e.object_id, revision: e.revision, action: e.action_id })),
        duplicateCanonicalConsequences: events.length - new Set(events.map((e) => `${e.object_id}/${e.revision}`)).size,
        omrTransactions: Number((await f.pool.query("SELECT count(*) AS n FROM transactions WHERE currency='omr'")).rows[0].n),
        negativeInventoryRows: Number((await f.pool.query('SELECT count(*) AS n FROM item_stacks WHERE quantity<0')).rows[0].n) },
      invariantChecks, notMeasured: ['distinct commands contending for the same world object', 'sustained concurrent population load', 'long-term starvation',
        'retention', 'real-player opportunity abandonment',
        'independent Crew/Family campaign dynamics', 'engine-caused irreversible dead ends across every branch',
        'reward-bearing operations', 'nonzero OMR movement', 'Knowledge revocation races'],
    };
  } catch (error) {
    if (proof) {
      await proof.record({ kind: 'failure', error: { message: error.message, code: error.code || null, stack: error.stack } });
      try {
        await proof.snapshot(f.pool, 'first-failure-state');
        await proof.checkpoint(f.pool, 'first-failure', process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL);
      } catch (captureError) { await proof.record({ kind: 'failure-capture-error', message: captureError.message }); }
    }
    throw error;
  } finally { await f.cleanup(); }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const options = Object.fromEntries(process.argv.slice(2).filter((arg) => arg.startsWith('--') && arg.includes('='))
    .map((arg) => { const split = arg.indexOf('='); return [arg.slice(2, split), arg.slice(split + 1)]; }));
  const populations = (options.populations || '25,100,500,1000').split(',').map(Number);
  const seeds = (options.seeds || 'rc1-alpha,rc1-beta').split(',');
  const replicates = Number(options.replicates || 2), rounds = Number(options.rounds || 2);
  assert(populations.length && populations.every((p) => Number.isSafeInteger(p) && p >= 5));
  assert(seeds.length && seeds.every((seed) => /^[a-z0-9_-]+$/i.test(seed)));
  assert(Number.isSafeInteger(replicates) && replicates > 0 && Number.isSafeInteger(rounds) && rounds > 0,
    'Empty, partial, or zero-round campaigns cannot pass');
  const proofSource = options['proof-directory'] ? await sourceIdentity() : null;
  if (proofSource) {
    assert(process.argv.includes('--postgres'), 'Proof artifacts require --postgres');
    validateScenarioManifest(JSON.parse(await fs.readFile(new URL('../docs/release/readiness-work/scenario-manifest.json', import.meta.url), 'utf8')));
  }
  const output = path.resolve(options.output || 'docs/release/evidence/simulation');
  await fs.mkdir(output, { recursive: true });
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
  const sourceHash = digest(await fs.readFile(new URL('./rc1-sim.js', import.meta.url), 'utf8'));
  const results = [];
  for (const population of populations) for (const seed of seeds) for (let replicate = 0; replicate < replicates; replicate++) {
    const identity = `${population}-${seed}-${replicate}`;
    console.log(JSON.stringify({ event: 'start', identity }));
    const proof = proofSource ? await createProofRecorder({ directory: path.join(options['proof-directory'], identity),
      source: proofSource, configuration: { population, seed, replicate, rounds, postgres: true, fixtureAssisted: true },
      runId: identity, population, seed, scenarioId: 'scoped-campaign-regression' }) : null;
    let result;
    try { result = await runNativeSimulation({ population, seed, replicate, rounds,
      proof, progress: (data) => console.log(JSON.stringify({ event: 'progress', ...data })) }); }
    catch (error) { result = { population, seed, replicate, status: 'FAIL', error: { message: error.message, code: error.code, stack: error.stack } }; }
    if (proof) await proof.finish(result);
    result.revision = revision; result.harnessSha256 = sourceHash;
    await fs.writeFile(path.join(output, `${identity}.json`), `${JSON.stringify(result, null, 2)}\n`);
    results.push(result);
    await fs.writeFile(path.join(output, 'summary.json'), `${JSON.stringify({ revision, harnessSha256: sourceHash,
      generatedAt: new Date().toISOString(), invocation: process.argv.slice(2), populations, seeds, replicates, rounds,
      status: results.every((r) => r.status === 'PASS_SCOPED') ? 'PASS_SCOPED' : 'FAIL',
      phase4ReleaseGate: 'INCOMPLETE', results: results.map(({ invariantChecks, ...r }) => r) }, null, 2)}\n`);
    console.log(JSON.stringify({ event: 'complete', identity, status: result.status, durationMs: result.durationMs, error: result.error?.message }));
  }
  if (results.some((r) => r.status === 'FAIL')) process.exitCode = 1;
}
