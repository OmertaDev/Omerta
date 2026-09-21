import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { canonicalJson, sha256, NORMALIZATION, validateScenarioManifest, canonicalDatabaseSnapshot,
  writeCheckpoint, restoreCheckpoint, sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { campaignNetworkFixture } from './lib/campaign-network-support.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { executeIssued } from './lib/player-command-support.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { verifyLedgerChecks, policyCommandKey, chooseSeededCommand } from '../tools/rc1-sim.js';

const manifest = JSON.parse(await fs.readFile(new URL('../docs/release/readiness-work/scenario-manifest.json', import.meta.url), 'utf8'));
validateScenarioManifest(manifest);
for (const mutation of [
  (m) => m.cells.pop(), (m) => m.cells.push(m.cells[0]), (m) => m.populations.splice(2, 1),
  (m) => { m.thresholds.minimumLogicalDays = 89; }, (m) => { m.thresholds.soak.wallClockHours = 11; },
  (m) => { m.cells[0].seed = 'unknown-seed'; },
  (m) => { m.scenarios[0].id = 'unrecognized-world'; m.cells.filter((c) => c.scenarioId === 'quiet_world').forEach((c) => { c.scenarioId = 'unrecognized-world'; }); },
  (m) => { m.scenarios[0].policy.dailyActiveFraction = .50; },
  (m) => { m.thresholds.maximumUnexplainedResourceDrift = 1; },
  (m) => { m.thresholds.recovery.maximumRestoreMinutes = 31; },
  (m) => { m.thresholds.cohort.minimumParticipants = 29; },
  (m) => { m.thresholds.cohort.finalCandidateHoursWithoutUnresolvedP0P1 = 71; },
  (m) => { m.qualification.requiresResourceGate = false; },
  (m) => { m.thresholds.load.maximumReadP95Ms = 501; },
  (m) => { m.thresholds.load.maximumAuthoritativeCommandP95Ms = 1501; },
  (m) => { m.thresholds.load.maximumAuthoritativeCommandP99Ms = 3001; },
  (m) => { m.thresholds.load.unexpected5xxOrTimeoutRateExclusiveUpperBound = .002; },
  (m) => { m.thresholds.load.maximumBacklogRecoverySchedulingPeriods = 3; },
]) { const broken = structuredClone(manifest); mutation(broken); assert.throws(() => validateScenarioManifest(broken)); }
assert.equal(canonicalJson({ b: 2, a: 1 }), canonicalJson({ a: 1, b: 2 }));
assert.deepEqual(NORMALIZATION.exclusions, []);
for (const key of ['cash', 'visibility', 'outcome', 'id', 'expires_at']) {
  assert.notEqual(sha256(canonicalJson({ [key]: 1 })), sha256(canonicalJson({ [key]: 2 })));
}
console.log('PASS: frozen 225-cell matrix, thresholds, missing/duplicate cells, semantic state retention');
const actorView = (generated) => ({ discovery: { instances: [{ id: `instance-${generated}`, graphId: 'authorized-graph', revision: 1,
  actions: [{ id: `action-${generated}`, kind: 'discover', label: 'Follow a lead' }] }] }, commands: [
  { commandId: `start-${generated}`, commandType: 'discovery.start', availability: 'AVAILABLE', parameters: { graphId: 'next-graph' } },
  { commandId: `act-${generated}`, commandType: 'discovery.act', availability: 'AVAILABLE',
    parameters: { instanceId: `instance-${generated}`, actionId: `action-${generated}` } },
] });
for (let round = 0; round < 30; round++) {
  const a = actorView('random-one'), b = actorView('random-two');
  assert.equal(policyCommandKey(a, chooseSeededCommand(a, 'fixed-seed', 0, 'actor', round)),
    policyCommandKey(b, chooseSeededCommand(b, 'fixed-seed', 0, 'actor', round)));
}
const unauthorized = actorView('missing'); unauthorized.discovery.instances = [];
assert.throws(() => chooseSeededCommand(unauthorized, 'seed', 0, 'actor', 0), /authorized discovery instance/);
console.log('PASS: seeded actor choices ignore generated IDs and use only authorized projections');

if (process.argv.includes('--postgres')) {
  const source = await sourceIdentity();
  const outputOption = process.argv.find((arg) => arg.startsWith('--output='));
  const directory = outputOption ? path.resolve(outputOption.slice('--output='.length)) : await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-native-proof-'));
  const url = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
  const f = await campaignNetworkFixture('proof_checkpoint');
  const recorder = await createProofRecorder({ directory, source, configuration: { test: 'checkpoint-receipt-replay', postgres: true },
    runId: 'checkpoint-receipt-replay', seed: 'rc1-alpha', scenarioId: 'scoped-checkpoint-regression', population: 5 });
  let cleaned = false, restored;
  try {
    const engine = createPlayerCommandEngine({ pool: f.pool, content: f.content, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    const actor = f.actors.outsider;
    const view = await engine.snapshot(actor);
    const command = view.commands.find((c) => c.commandType === 'discovery.start' && c.availability === 'AVAILABLE');
    assert(command, 'Canonical discovery command must be available');
    const baseline = await runLedgerInvariants(f.pool, { alert: false });
    const burst = await Promise.allSettled([0, 1].map((attempt) => recorder.invoke('player.execute',
      { actor, command, attempt }, () => executeIssued(engine, actor, command))));
    assert.equal(burst.filter((r) => r.status === 'fulfilled' && !r.value.replayed).length, 1);
    for (const result of burst) if (result.status === 'rejected') assert.equal(result.reason.code, 'contention');
    const first = burst.find((r) => r.status === 'fulfilled' && !r.value.replayed).value;
    assert.equal((await executeIssued(engine, actor, command)).replayed, true);
    const invariantChecks = verifyLedgerChecks(baseline, await runLedgerInvariants(f.pool, { alert: false }), 5);
    const checkpoint = await recorder.checkpoint(f.pool, 'restart', url);
    await assert.rejects(() => restoreCheckpoint(checkpoint, path.join(directory, 'restart.dump'), url), /already contains/);
    const snapshot = await recorder.snapshot(f.pool, 'before-restart');
    await f.cleanup(); cleaned = true;
    restored = await restoreCheckpoint(checkpoint, path.join(directory, 'restart.dump'), url);
    assert.equal((await canonicalDatabaseSnapshot(restored)).stateSha256, snapshot.stateSha256);
    const restarted = createPlayerCommandEngine({ pool: restored, content: f.content, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
    const replay = await recorder.invoke('restarted-player.execute', { actor, command }, () => executeIssued(restarted, actor, command));
    assert.equal(replay.replayed, true);
    assert.equal(replay.executionId, first.executionId);
    assert.equal((await canonicalDatabaseSnapshot(restored)).stateSha256, snapshot.stateSha256, 'Receipt replay mutated canonical state');

    // A rolled-back corrupt write must leave every canonical table/sequence intact.
    const client = await restored.connect();
    try {
      await client.query('BEGIN');
      await client.query('UPDATE characters SET cash=cash+1 WHERE account_id=$1', [actor]);
      await client.query('ROLLBACK');
    } finally { client.release(); }
    assert.equal((await canonicalDatabaseSnapshot(restored)).stateSha256, snapshot.stateSha256);
    // Deliberate committed corruption is evidence of harness sensitivity only.
    // Never repair this state or count it as a successful simulation.
    await restored.query('UPDATE characters SET cash=cash+1 WHERE account_id=$1', [actor]);
    const corrupt = await runLedgerInvariants(restored, { alert: false });
    assert.throws(() => verifyLedgerChecks(baseline, corrupt, 5), /Conservation\/provenance invariant failed/);
    assert.notEqual((await canonicalDatabaseSnapshot(restored)).stateSha256, snapshot.stateSha256);
    await recorder.snapshot(restored, 'injected-failure');
    await recorder.checkpoint(restored, 'injected-failure', url);
    await recorder.record({ kind: 'assertions', invariantChecks, checks: ['concurrent duplicate creates exactly one effect',
      'occupied restore refused', 'restored full-state hash equal', 'durable receipt replay unchanged after restore',
      'aborted mutation leaves state unchanged', 'committed unexplained cash detected'], injection: 'deliberate +1 cash, expected invariant failure' });
    const record = await recorder.finish({ status: 'PASS_SCOPED', database: checkpoint.databaseVersion,
      assertionsPassed: 6, deliberateFailureDetected: true, checkpointRestore: true, receiptReplay: true });
    await verifyArtifactIndex(directory, record);
    await assert.rejects(() => verifyArtifactIndex(directory, { ...record, artifacts: [...record.artifacts, record.artifacts[0]] }), /Duplicate artifact/);
    const bytes = await fs.readFile(path.join(directory, 'before-restart.json'));
    await fs.appendFile(path.join(directory, 'before-restart.json'), ' ');
    await assert.rejects(() => verifyArtifactIndex(directory, record), /Artifact size mismatch/);
    await fs.writeFile(path.join(directory, 'before-restart.json'), bytes);
    await verifyArtifactIndex(directory, record);
    console.log(JSON.stringify({ status: 'PASS_SCOPED', source: source.revision, directory,
      checks: record.result, checkpointStateSha256: checkpoint.stateSha256, matrixQualifying: false }));
  } catch (error) {
    await recorder.record({ kind: 'failure', message: error.message });
    try { await recorder.finish({ status: 'FAIL', error: { message: error.message, stack: error.stack } }); } catch {}
    throw error;
  } finally {
    if (!cleaned) await f.cleanup();
    if (restored) { const schema = (await restored.query('SELECT current_schema() AS name')).rows[0].name;
      assert(/^command_proof_checkpoint_[a-f0-9]+$/.test(schema));
      await restored.query(`DROP SCHEMA "${schema}" CASCADE`); await restored.end(); }
  }
}
