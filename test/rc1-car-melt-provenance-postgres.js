// Ordinary native HTTP entry and per-COMMIT resource evidence, not a world run.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import pg from 'pg';
import { createCarMeltCommitObserver, CAR_MELT_SOURCE_PINS, verifySoloCarMelt } from '../tools/rc1-car-melt-provenance.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime, serialDatabaseOptions } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation } from '../tools/rc1-native-worker.js';

assert(process.argv.includes('--postgres'));
const output = process.env.RC1_CAR_MELT_OUTPUT, controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(output && controlUrl);
const source = await sourceIdentity();
const database = planOwnedWorldDatabase({ controlUrl, runId: 'car-melt-commit', sourceRevision: source.revision });
const epoch = '2026-09-20T12:00:00.000Z';
const configuration = { sourcePins: CAR_MELT_SOURCE_PINS, database: database.descriptor, epoch,
  fixture: 'Two ordinary guest/character entrants; two initial junker/stock cars owned by the first entrant (damage 0 and 60). No account, progression, balance, deadline or membership fixture. All fixtures precede measured baseline.',
  scope: 'Original serial HTTP solo melt transaction at its actual COMMIT, including native reads/deletion/ledger insertion and complete resource before/after snapshots. Retry and unauthorized owner denial are ordinary HTTP paths. Exact neutral skill/ladder branch only.',
  clocks: 'Original application/SQL logical clock seam at one instant. No worker is imported; no timer advancement or scheduled-worker coverage is claimed.',
  exclusions: ['Family/NPC/limited-car melt', 'non-neutral skill/ladder yield', 'compound transaction lineage', 'boost selection identity', 'full resource qualification', 'world/matrix/90-day/production coverage', 'concurrent per-commit ordering'] };
const proof = await createProofRecorder({ directory: output, source, configuration, runId: 'car-melt-commit', seed: 'rc1-car-melt', scenarioId: 'scoped-car-melt-commit', population: 2 });
const runtime = installSerialRuntime('rc1-car-melt', epoch);
Object.assign(process.env, { DATABASE_URL: database.url, RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', POPULATION_OFF: 'on',
  WORLD_GRAPH_KERNEL: 'on', CORE_PROGRESSION: 'on', LIQUIDITY_AUTOMATION_ENABLED: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex') });
const controller = createWorkerSchedule({ start: Date.parse(epoch), setClock: () => {}, expectedDormant: [] });
const namespace = 'rc1_worker_car_melt_' + process.pid;
let app, diagnostic, result, currentResources, observerModule, armed = false, sequence = 0, label = 'initialization';
const exact = [], boundaries = [], saved = [], completions = new Map();
const commitObserver = createCarMeltCommitObserver({ context: () => ({ label }), onAttempt: e => proof.record({ kind: 'native-query-attempt', ...e }),
  async onBoundary(boundary, carMeltProvenance) {
    const before = currentResources, after = await observerModule.snapshotWorldResources(diagnostic);
    const artifact = 'boundary-' + String(boundaries.length + 1).padStart(4, '0');
    let journal;
    try {
      journal = observerModule.reconcileWorldResources(before, after, { identity: boundary, includeRestrictedChanges: true, carMeltProvenance });
      const found = journal.cars.lineage.filter(e => e.kind === 'exact-solo-melt-sink');
      if (found.length) { exact.push(...found); saved.push({ before, after, carMeltProvenance }); }
      await proof.artifact(artifact + '.json', { boundary, before, after, carMeltProvenance, journal });
      boundaries.push({ artifact, outcome: boundary.outcome, exactMelt: found.length, unknowns: journal.unsupported.length });
      currentResources = after;
    } catch (error) {
      await proof.artifact(artifact + '-failure.json', { boundary, before, after, carMeltProvenance, error: error.message }); throw error;
    }
  } });
const seam = installWorkerInstrumentation(controller, { namespace, commitObserver });
const base = new pg.Pool({ connectionString: database.url });
let requestSequence = 0;
async function request(actor, method, path, body, key, expected = 200) {
  const completion = String(++requestSequence), completed = new Promise(resolve => completions.set(completion, resolve));
  return proof.invoke('ordinary-http', { accountId: actor?.accountId || null, method, path, key: key || null }, async () => {
    const response = await app.inject({ method, url: path, headers: { 'x-rc1-response-completion': completion,
      ...(actor ? { authorization: 'Bearer ' + actor.token } : {}), ...(key ? { 'idempotency-key': key } : {}) },
      ...(body === undefined ? {} : { payload: body }) });
    let timer;
    try { await Promise.race([completed, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Original response lifecycle timeout')), 10000); })]); }
    finally { clearTimeout(timer); }
    assert.equal(response.statusCode, expected, response.body);
    return { status: response.statusCode, replayed: response.headers['x-idempotent-replay'] === 'true', body: response.json() };
  });
}
try {
  await proof.record({ kind: 'database-created', ...await database.create() });
  await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap);
  const [{ buildServer }, { runLedgerInvariants }, resources] = await Promise.all([
    import('../src/server.js'), import('../src/invariants.js'), import('../tools/rc1-world-resource-observer.js')]);
  observerModule = resources; app = await buildServer();
  diagnostic = serialDatabaseOptions().poolFactory({ connectionString: database.url, options: '-c search_path=' + namespace, max: 1 }, namespace);
  // Hash-bound existing terminal hook, with its original header/map names.
  const runner = (await fs.readFile(new URL('./rc1-native-world-workload.js', import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  const blocks = runner.match(/      app\.addHook\('onResponse', async req => \{[\s\S]*?\n      \}\);/g);
  assert.equal(blocks?.length, 1); assert.equal(sha256(blocks[0]), 'e831c10a2b0cfab13526261975224a9bf35c26f0d1ecb08482879200098e9ec7');
  new Function('app', 'responseCompletions', 'assert', blocks[0])(app, completions, assert);
  const actors = [];
  for (const name of ['Melt Owner', 'Melt Outsider']) {
    const guest = await request(null, 'POST', '/v1/auth/guest', { bootstrapSecret: crypto.randomBytes(32).toString('base64url') });
    const actor = { token: guest.body.token, accountId: app.jwt.verify(guest.body.token).sub };
    const entry = await request(actor, 'POST', '/v1/character', { name }, 'entry-' + actors.length);
    actor.characterId = entry.body.id; actors.push(actor);
  }
  const fixture = [];
  for (const [id, damage] of [['rc1-melt-car-a', 0], ['rc1-melt-car-b', 60]]) {
    await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',$3)", [id, actors[0].characterId, damage]);
    fixture.push({ id, characterId: actors[0].characterId, modelId: 'junker', trimId: 'stock', damage });
  }
  await proof.record({ kind: 'initialization-complete', fixture, ordinaryEntrants: 2, noFurtherFixtureWrites: true });
  await proof.snapshot(diagnostic, 'baseline');
  const baselineInvariant = await runLedgerInvariants(diagnostic, { alert: false }); assert(baselineInvariant.ok, JSON.stringify(baselineInvariant));
  await proof.record({ kind: 'canonical-invariants', label: 'baseline', checks: baselineInvariant.checks });
  currentResources = await resources.snapshotWorldResources(diagnostic); commitObserver.arm(); armed = true;
  const responses = [];
  label = 'outsider-denial'; responses.push(await request(actors[1], 'POST', '/v1/garage/rc1-melt-car-a/melt', {}, 'denied-owner', 400));
  assert.equal(responses.at(-1).body.error, 'no_car'); assert.equal(exact.length, 0);
  label = 'first-melt'; const first = await request(actors[0], 'POST', '/v1/garage/rc1-melt-car-a/melt', {}, 'melt-first'); responses.push(first);
  assert.equal(exact.length, 1); const receiptCount = currentResources.tables.transactions.filter(r => r.reason === 'melt').length;
  label = 'exact-retry'; const retry = await request(actors[0], 'POST', '/v1/garage/rc1-melt-car-a/melt', {}, 'melt-first'); responses.push(retry);
  assert(retry.replayed); assert.deepEqual(retry.body, first.body); assert.equal(exact.length, 1);
  assert.equal(currentResources.tables.transactions.filter(r => r.reason === 'melt').length, receiptCount);
  label = 'already-removed'; responses.push(await request(actors[0], 'POST', '/v1/garage/rc1-melt-car-a/melt', {}, 'melt-fresh-retry', 400));
  assert.equal(exact.length, 1);
  label = 'damaged-melt'; responses.push(await request(actors[0], 'POST', '/v1/garage/rc1-melt-car-b/melt', {}, 'melt-second'));
  assert.equal(exact.length, 2); assert.notEqual(exact[0].rounds, exact[1].rounds);
  commitObserver.assertComplete(); commitObserver.disarm(); armed = false;
  const controls = [];
  for (const [name, mutate, pattern] of [
    ['wrong-car-identity', x => { x.carMeltProvenance.queries.find(q => q.sql === 'DELETE FROM cars WHERE id=$1').parameters[0] = 'wrong'; }, /absent/],
    ['corrupt-committed-yield', x => { x.after.tables.transactions.find(t => t.id === exact[0].receiptId).amount = String(exact[0].rounds + 1); }, /receipt mismatch/],
    ['corrupt-ammo-custody', x => { x.after.tables.characters.find(c => c.id === exact[0].owner).ammo++; }, /ammo delta/],
    ['wrong-source', x => { x.carMeltProvenance.sourcePins['src/economy.js'] = 'wrong'; }, /source pins/],
  ]) {
    const input = structuredClone(saved[0]); mutate(input);
    assert.throws(() => verifySoloCarMelt(input.before, input.after, input.carMeltProvenance), pattern);
    controls.push(name); await proof.artifact('control-' + name + '.json', { type: 'counterfactual retained native boundary; no database write', ...input });
  }
  for (const savedBoundary of saved) {
    const legacy = resources.reconcileWorldResources(savedBoundary.before, savedBoundary.after);
    assert(legacy.cars.unsupported.some(u => u.kind === 'car-sink-identity-yield-provenance'), 'Absent collector must remain unknown');
  }
  const final = await proof.snapshot(diagnostic, 'final');
  const report = await runLedgerInvariants(diagnostic, { alert: false }); assert(report.ok, JSON.stringify(report));
  await proof.record({ kind: 'canonical-invariants', label: 'final', checks: report.checks });
  await proof.artifact('boundaries.json', boundaries); await proof.artifact('responses.json', responses);
  result = { status: 'PASS_SCOPED', source: source.revision, exactMelts: exact.map(e => ({ carId: e.carId, rounds: e.rounds, provenanceSha256: e.provenanceSha256 })),
    boundaries: boundaries.length, committedBoundaries: boundaries.filter(b => b.outcome === 'COMMITTED').length,
    unknownOccurrences: boundaries.reduce((n, b) => n + b.unknowns, 0), controls, ordinaryEntrants: 2, initialCarFixtures: 2,
    postBaselineFixtureWrites: 0, canonicalInvariantChecks: report.checks.length, finalStateSha256: final.stateSha256,
    retryExtraMeltReceipts: 0, fullResourceQualification: false, exclusions: configuration.exclusions };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack, label, boundaries: boundaries.length };
  process.exitCode = 1; await proof.record({ kind: 'failure', ...result });
} finally {
  if (armed) { try { commitObserver.disarm(); } catch (error) { await proof.record({ kind: 'observer-cleanup-failure', error: error.message }); } }
  for (const close of [async () => { if (app) await app.close(); }, () => controller.close(), async () => { if (diagnostic) await diagnostic.end(); },
    () => base.end(), async () => proof.record({ kind: 'database-cleanup', ...await database.close() })]) {
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; await proof.record({ kind: 'cleanup-failure', error: error.message }); }
  }
  seam.restore(); runtime.restore(); const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
console.log(JSON.stringify(result));
