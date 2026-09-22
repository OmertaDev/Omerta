// Bounded native reproduction of the retained alliance restart's extra resident turn.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createWorkerSchedule, installWorkerInstrumentation, makeWorkerDatabase } from '../tools/rc1-native-worker.js';
import { installSerialRuntime } from '../tools/rc1-native-determinism.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, restoreCheckpoint, canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';

const arg = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const output = arg('output'), retained = arg('retained'), mode = arg('mode');
assert(output && retained && process.env.COORDINATION_TEST_DATABASE_URL);
if (!mode) {
  for (const step of ['uninterrupted', 'restarted']) execFileSync(process.execPath,
    [fileURLToPath(import.meta.url), `--output=${output}`, `--retained=${retained}`, `--mode=${step}`], { stdio: 'inherit' });
} else {
  const source = await sourceIdentity(), directory = path.join(output, mode);
  const read = async (base, file) => JSON.parse(await fs.readFile(path.join(base, file), 'utf8'));
  const parent = mode === 'uninterrupted' ? retained : path.join(output, 'uninterrupted');
  const label = mode === 'uninterrupted' ? 'alliance-hour24' : 'resident-checkpoint';
  const checkpoint = await read(parent, `${label}-checkpoint.json`);
  const saved = mode === 'uninterrupted' ? await read(parent, `${label}-continuation.json`) : await read(parent, 'resident-cursor.json');
  const tape = mode === 'uninterrupted' ? (await read(parent, `${label}-random-tape.json`)).draws : saved.draws;
  const seed = 'rc1-alpha', start = saved.logicalAt;
  const database = planOwnedWorldDatabase({ controlUrl: process.env.COORDINATION_TEST_DATABASE_URL,
    runId: `resident-${mode}`, sourceRevision: source.revision });
  const proof = await createProofRecorder({ directory, source, runId: `resident-${mode}`, seed,
    scenarioId: 'retained-resident-restart', population: 25,
    configuration: { retainedCheckpoint: checkpoint, mode, scope: 'Original resident-turn transition only; all tables and sequences compared. No whole-worker or matrix claim.' } });
  const runtime = installSerialRuntime(seed, new Date(start).toISOString());
  let at = start; runtime.bindClock(() => at); runtime.restoreTape(tape);
  const controller = createWorkerSchedule({ start, setClock: value => { at = value; } });
  const seam = installWorkerInstrumentation(controller, { namespace: checkpoint.schema });
  process.env.DATABASE_URL = database.url;
  let pool, result = { status: 'FAIL' };
  try {
    await proof.record({ kind: 'database-created', ...await database.create() });
    pool = await restoreCheckpoint(checkpoint, path.join(parent, `${label}.dump`), database.url, { poolFactory: seam.clock.poolFactory });
    const { runResidentBehaviour } = await import('../src/population.js');
    if (mode === 'uninterrupted') {
      // Apply the real additive schema migration to the exact retained native checkpoint.
      const migrated = await makeWorkerDatabase(controller); await migrated.end();
      const first = await runResidentBehaviour(pool); assert(first.acted > 0);
      await proof.artifact('first-turn.json', first);
      await proof.checkpoint(pool, 'resident-checkpoint', database.url);
      await proof.artifact('resident-cursor.json', { logicalAt: at, draws: runtime.tape });
    } else {
      const before = await canonicalDatabaseSnapshot(pool), draws = runtime.tape.length;
      const duplicate = await runResidentBehaviour(pool);
      assert.deepEqual(duplicate, { acted: 0, actions: {} });
      assert.equal(runtime.tape.length, draws, 'Restart consumed authoritative randomness');
      assert.equal((await canonicalDatabaseSnapshot(pool)).stateSha256, before.stateSha256, 'Restart added a resident effect');
      await proof.artifact('duplicate-control.json', { unchangedStateSha256: before.stateSha256, newRandomDraws: 0, duplicate });
    }
    at += 3600000;
    const next = await runResidentBehaviour(pool); assert(next.acted > 0);
    const final = await proof.snapshot(pool, 'final');
    await proof.artifact('random-tape.json', { draws: runtime.tape });
    if (mode === 'restarted') {
      assert.equal(final.stateSha256, (await read(parent, 'final.json')).stateSha256, 'Authoritative continuation differs');
      assert.deepEqual(runtime.tape, (await read(parent, 'random-tape.json')).draws, 'Continuation randomness differs');
    }
    result = { status: 'PASS_SCOPED', mode, finalStateSha256: final.stateSha256,
      comparedTables: Object.keys(final.tables).length, canonicalExclusions: [], next,
      restartedEqual: mode === 'restarted', randomDraws: runtime.tape.length };
  } catch (error) {
    result = { status: 'FAIL', mode, error: error.message, stack: error.stack }; process.exitCode = 1;
  } finally {
    if (pool) await pool.end();
    await proof.record({ kind: 'database-cleanup', ...await database.close() });
    seam.restore(); runtime.restore();
    await verifyArtifactIndex(directory, await proof.finish(result));
  }
  console.log(JSON.stringify(result));
}
