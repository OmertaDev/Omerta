import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import pg from 'pg';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase, bootOriginalWorker } from '../tools/rc1-native-worker.js';
import { createNpcFamilyCommitObserver } from '../tools/rc1-npc-family-provenance.js';
import { createNpcBoatAcquisitionCommitObserver, verifyNpcBoatAcquisition, NPC_BOAT_SOURCE_PINS, NPC_BOAT_INSERT } from '../tools/rc1-npc-boat-journal.js';
import { npcBoatCorruptions } from './lib/rc1-npc-boat-controls.js';
assert(process.argv.includes('--postgres'));
const source = await sourceIdentity(), seed = 'rc1-alpha', epoch = Date.parse('2026-09-24T00:00:00Z');
const runId = `npc-boat-${source.revision.slice(0, 8)}-${crypto.randomBytes(4).toString('hex')}`;
const output = process.env.RC1_NPC_BOAT_OUTPUT || path.join(os.tmpdir(), runId);
const database = planOwnedWorldDatabase({ controlUrl: process.env.RC1_RESOURCE_DATABASE_URL, runId, sourceRevision: source.revision });
const configuration = { scope: 'Serial original-worker NPC dinghy grant and late rollback with actual source/query/RNG provenance', sourcePins: NPC_BOAT_SOURCE_PINS,
  seed, epoch: new Date(epoch).toISOString(), maximumHours: 12,
  fixtures: '25 initial ordinary birth-default accounts and characters only. Original worker creates all NPC eligibility, resources and assets.',
  fault: 'Prebaseline diagnostic sequence/AFTER INSERT trigger aborts the first original boat write after birth and cash receipt checks; sequence is intentionally nontransactional diagnostic state. Remove after the enclosing worker callback.',
  exclusions: ['Boat retirement, sale, estate, NFT, cargo and compound disposition', 'HTTP or natural player eligibility', 'Concurrency order, full world taxonomy/matrix, chain and external backing'] };
for (const key of ['POPULATION_OFF', 'SEASON_MOD', 'SEASON_PHASE', 'LAW_BUST_P', 'CHAIN_RPC_URL', 'CHAIN_SIGNER_PK', 'LIQUIDITY_RPC_URL', 'LIQUIDITY_RPC_FALLBACK_URL', 'INVARIANT_WEBHOOK_URL', 'REDIS_URL']) assert(!process.env[key], `Undeclared override ${key}`);
Object.assign(process.env, { DATABASE_URL: database.url, CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on', COORDINATION_ENGINE: 'on', COORDINATION_KNOWLEDGE: 'on',
  COORDINATION_KNOWLEDGE_SHARING: 'on', COORDINATION_OPERATIONS: 'on', LIVING_WORLD_DIRECTOR: 'LIVE', LIQUIDITY_AUTOMATION_ENABLED: 'off', SOCIAL_VERIFY_MODE: 'off',
  RATE_LIMIT: 'off', INVITE_MODE: 'off', JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex') });
const proof = await createProofRecorder({ directory: output, source, configuration, runId, seed, scenarioId: 'npc-boat-lineage', population: 25 });
const runtime = installSerialRuntime(seed, configuration.epoch); let at = epoch; runtime.bindClock(() => at);
const controller = createWorkerSchedule({ start: epoch, setClock: value => { at = value; }, expectedDormant: [{ label: 'RWA health', code: 'health_registry_unavailable' }] });
const namespace = `rc1_npc_boat_${process.pid}`, base = new pg.Pool({ connectionString: database.url });
const readPool = new pg.Pool({ connectionString: database.url, options: `-c search_path=${namespace},pg_catalog -c default_transaction_read_only=on`, max: 1 });
let snapshotWorldResources, reconcileWorldResources, worldResourceHash, previous, firstError, result, pool;
let boundaryCount = 0, rollbackCount = 0, faultInstalled = true;
const candidates = [], controls = [], failedAttempts = [], expectedLogs = [], unknown = {}, nativeConsole = { log: console.log, warn: console.warn, error: console.error };
const commitObserver = createNpcFamilyCommitObserver({
  innerObserverFactory: options => createNpcBoatAcquisitionCommitObserver({ ...options, seed, readRandomTape: () => runtime.tape }),
  context: () => ({ authority: 'original-worker', logicalAt: at }),
  onAttempt: async event => { if (event.outcome === 'THREW' && event.code === 'RNB01') { failedAttempts.push(event); await proof.record({ kind: 'expected-native-boat-abort', event }); } },
  onBoundary: async (event, transaction, npcFamilyProvenance) => {
    if (firstError) throw firstError;
    const before = previous, after = await snapshotWorldResources(readPool);
    const boatWitness = transaction?.queries.some(q => q.sql === NPC_BOAT_INSERT) ? transaction : null;
    try {
      if (['ROLLED_BACK', 'STATEMENT_ABORTED'].includes(event.outcome)) assert.equal(worldResourceHash(after), worldResourceHash(before), 'Aborted native SQL changed resources');
      if (event.outcome === 'ROLLED_BACK' && failedAttempts.some(e => e.transactionId === event.transactionId)) {
        await proof.artifact(`boat-rollback-${++rollbackCount}.json`, { event, before, after, failedAttempt: failedAttempts.find(e => e.transactionId === event.transactionId) });
      }
      const journal = reconcileWorldResources(before, after, { identity: event, npcFamilyProvenance, npcBoatProvenance: boatWitness,
        carAcquisitionProvenance: transaction, carMeltProvenance: transaction, includeRestrictedChanges: true });
      if (boatWitness) {
        const input = { before, after, event, provenance: boatWitness }, movement = verifyNpcBoatAcquisition(before, after, boatWitness, event); assert(movement);
        const random = boatWitness.queries.find(q => q.sql === NPC_BOAT_INSERT).origin.boatRandomInputs;
        for (const { index, ...draw } of [...random.draws, random.boatIdDraw]) assert.deepEqual(runtime.tape[index], draw, 'Witness random entry differs from actual tape');
        assert(!candidates.some(row => row.boatId === movement.boatId), 'Worker duplicated an earlier grant identity');
        const artifact = `boat-candidate-${String(candidates.length + 1).padStart(3, '0')}.json`; await proof.artifact(artifact, input);
        candidates.push({ boatId: movement.boatId, artifact, logicalAt: at, movement });
        for (const control of npcBoatCorruptions(input)) {
          const name = `boat-control-${String(controls.length + 1).padStart(3, '0')}.json`; await proof.artifact(name, control); controls.push({ name: control.name, expected: control.expected, artifact: name });
        }
      }
      for (const item of journal.unsupported) unknown[item.kind] = (unknown[item.kind] || 0) + 1;
      await proof.record({ kind: 'resource-commit-boundary', event, journal }); boundaryCount++; previous = after;
    } catch (error) { firstError = error; await proof.artifact('first-resource-failure.json', { before, after, event, transaction, npcFamilyProvenance, error: { message: error.message, stack: error.stack } }); throw error; }
  },
});
const seam = installWorkerInstrumentation(controller, { namespace, commitObserver });
try {
  for (const key of ['log', 'warn', 'error']) console[key] = (...args) => {
    if (key === 'error' && args.some(value => String(value).includes('RC1_BOAT_LATE_ABORT'))) { expectedLogs.push({ logicalAt: at, message: args.map(String) }); return; }
    controller.log(key, args);
  };
  await proof.record({ kind: 'database-created', ...await database.create() }); await base.query('CREATE SCHEMA ' + namespace);
  const bootstrap = new controller.Pool({ connectionString: database.url, options: '', max: 20 }); await seam.clock.initialize(bootstrap); pool = await makeWorkerDatabase(controller);
  ({ snapshotWorldResources, reconcileWorldResources, worldResourceHash } = await import('../tools/rc1-world-resource-observer.js'));
  const { runLedgerInvariants } = await import('../src/invariants.js');
  for (let i = 0; i < 25; i++) { const id = `npc-boat-proof-human-${i}`;
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'test',$1)", [id]);
    await pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [id]);
    await pool.query('INSERT INTO characters(id,account_id,name,season,loc) VALUES($1,$2,$3,$4,$5)', [id + '-character', id, id, Math.floor(epoch / 86400000 / 28), 'docks']);
  }
  const fault = `CREATE FUNCTION rc1_boat_abort() RETURNS trigger LANGUAGE plpgsql AS $fault$ BEGIN
    IF nextval('rc1_boat_fault_seq')=1 THEN
      IF NEW.kind <> 'dinghy' OR NOT EXISTS(SELECT 1 FROM characters c JOIN account_persistent p ON p.account_id=c.account_id
        WHERE c.id=NEW.character_id AND c.is_npc AND p.npc_flag AND c.npc_seed=c.cash AND c.cash+c.bank=500+COALESCE((SELECT SUM(amount) FROM transactions WHERE character_id=c.id AND currency='cash'),0))
      THEN RAISE EXCEPTION 'Boat birth predecessors missing' USING ERRCODE='RNB02'; END IF;
      RAISE EXCEPTION 'RC1_BOAT_LATE_ABORT after original birth, cash receipt and boat write' USING ERRCODE='RNB01'; END IF; RETURN NEW; END $fault$`;
  await pool.query('CREATE SEQUENCE rc1_boat_fault_seq'); await pool.query(fault); await pool.query('CREATE TRIGGER rc1_boat_abort AFTER INSERT ON boats FOR EACH ROW EXECUTE FUNCTION rc1_boat_abort()');
  await proof.artifact('initialization.json', { configuration, fault, gameplayFixturesAfterBaseline: false }); assert((await runLedgerInvariants(pool, { alert: false })).ok);
  await proof.snapshot(pool, 'initial');
  await bootOriginalWorker(controller, { beforeCallbacks: async () => { previous = await snapshotWorldResources(readPool); commitObserver.arm(); } });
  const afterCallback = async () => {
    if (faultInstalled && failedAttempts.length) {
      assert.equal(failedAttempts.length, 1); assert.equal(rollbackCount, 1);
      await base.query(`SET search_path=${namespace},pg_catalog`); await base.query('DROP TRIGGER rc1_boat_abort ON boats'); await base.query('DROP FUNCTION rc1_boat_abort()');
      faultInstalled = false; await proof.record({ kind: 'diagnostic-trigger-removed', logicalAt: at, gameplayMutation: false });
    }
    const inv = await runLedgerInvariants(pool, { alert: false }); assert(inv.ok); await proof.record({ kind: 'canonical-invariants', logicalAt: at, checks: inv.checks });
  };
  await afterCallback();
  for (let hour = 1; hour <= configuration.maximumHours && candidates.length < 2; hour++) await controller.advanceTo(epoch + hour * 3600000, afterCallback);
  assert.equal(failedAttempts.length, 1); assert.equal(rollbackCount, 1); assert(candidates.length >= 2, 'Two native boat grants not reached within declared original-worker horizon');
  commitObserver.assertComplete(); assert.equal(firstError, undefined); commitObserver.disarm();
  await proof.snapshot(pool, 'final'); await proof.artifact('worker-schedule.json', controller.diagnostic()); await proof.artifact('commit-observer.json', commitObserver.diagnostic());
  await proof.artifact('random-tape.json', { draws: runtime.tape }); await proof.artifact('expected-faults.json', { failedAttempts, expectedLogs }); await proof.artifact('controls.json', controls);
  result = { status: 'PASS_SCOPED', boundaryCount, candidates, rollbackCount, controls: controls.length, unknown, logicalHours: (at - epoch) / 3600000, noAuthoredBoatReceiptInvented: true, fullResourceCoverage: false };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack, boundaryCount, candidates, rollbackCount }; process.exitCode = 1;
  await proof.record({ kind: 'failure', ...result }); await proof.artifact('failure-worker-schedule.json', controller.diagnostic()); await proof.artifact('failure-commit-observer.json', commitObserver.diagnostic());
} finally {
  for (const key of ['log', 'warn', 'error']) console[key] = nativeConsole[key];
  for (const close of [async () => { try { commitObserver.disarm(); } catch {} }, () => controller.close(), () => readPool.end(), () => base.end(), async () => proof.record({ kind: 'database-cleanup', ...await database.close() })])
    try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupFailure = error.message; process.exitCode = 1; }
  seam.restore(); runtime.restore(); const run = await proof.finish(result); await verifyArtifactIndex(output, run);
}
console.log(JSON.stringify({ ...result, candidates: result.candidates.length }));
