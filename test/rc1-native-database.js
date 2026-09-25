// Reproduce the actual cross-schema advisory lock and prove database separation.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import pg from 'pg';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';

assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice(9) || process.env.RC1_DATABASE_OUTPUT;
assert(output, 'New restricted output directory required');
const source = await sourceIdentity(), controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
const first = planOwnedWorldDatabase({ controlUrl, runId: `${path.basename(output)}-a`, sourceRevision: source.revision });
const second = planOwnedWorldDatabase({ controlUrl, runId: `${path.basename(output)}-b`, sourceRevision: source.revision });
const proof = await createProofRecorder({ directory: output, source, runId: path.basename(output), seed: 'database-isolation',
  scenarioId: 'scoped-native-database-advisory-isolation', population: 0,
  configuration: { databases: [first.descriptor, second.descriptor], fixedCanonicalLock: [0x4e57, 0], matrixQualifying: false } });
const owner = new pg.Client({ connectionString: first.url }), independent = new pg.Client({ connectionString: second.url });
const contender = new pg.Pool({ connectionString: first.url, options: '-c search_path=rc1_right' });
const control = new pg.Client({ connectionString: controlUrl });
const priorUrl = process.env.DATABASE_URL; let result;
try {
  await proof.record({ kind: 'database-created', ...await first.create() });
  await proof.record({ kind: 'database-created', ...await second.create() });
  await owner.connect(); await independent.connect(); await control.connect();
  await owner.query('CREATE SCHEMA rc1_left'); await owner.query('CREATE SCHEMA rc1_right');
  await owner.query('SET search_path=rc1_left');
  const acquired = (await owner.query('SELECT pg_try_advisory_lock($1,$2) AS ok', [0x4e57, 0])).rows[0].ok;
  assert.equal(acquired, true);
  process.env.DATABASE_URL = first.url;
  const { sweepNpcAggression } = await import('../src/npcwar.js');
  const sameDatabase = await proof.invoke('canonical-worker:npc-offensive', { database: first.descriptor.name, schema: 'rc1_right' },
    () => sweepNpcAggression(contender));
  assert.deepEqual(sameDatabase, { opened: 0, struck: 0, lapsed: 0, skipped: 'locked' });
  const separateDatabase = (await independent.query('SELECT pg_try_advisory_lock($1,$2) AS ok', [0x4e57, 0])).rows[0].ok;
  assert.equal(separateDatabase, true);
  const changedMarker = `COMMENT ON DATABASE "${second.descriptor.name}" IS 'deliberate-negative-owner'`;
  await control.query(changedMarker);
  try {
    await assert.rejects(second.close(), /ownership marker changed/);
    assert.equal((await control.query('SELECT count(*) n FROM pg_database WHERE datname=$1', [second.descriptor.name])).rows[0].n, '1');
    await proof.record({ kind: 'ownership-negative-control', refused: true, databasePreserved: true });
  } finally {
    const marker = second.descriptor.ownerMarker.replace(/'/g, "''");
    await control.query(`COMMENT ON DATABASE "${second.descriptor.name}" IS '${marker}'`);
  }
  result = { status: 'PASS_SCOPED', sameDatabaseDifferentSchema: sameDatabase, separateDatabaseSameLockAcquired: separateDatabase,
    changedOwnershipCleanupRefused: true, matrixQualifying: false };
} catch (error) {
  result = { status: 'FAIL', message: error.message, stack: error.stack }; process.exitCode = 1;
  await proof.record({ kind: 'failure', ...result });
} finally {
  if (priorUrl === undefined) delete process.env.DATABASE_URL; else process.env.DATABASE_URL = priorUrl;
  for (const connection of [owner, independent, contender, control]) {
    try { await connection.end(); } catch (error) { await proof.record({ kind: 'connection-close-error', message: error.message }); result.status = 'FAIL'; }
  }
  for (const database of [first, second]) {
    try { await proof.record({ kind: 'database-cleanup', ...await database.close() }); }
    catch (error) { await proof.record({ kind: 'cleanup-failure', message: error.message }); result.status = 'FAIL'; process.exitCode = 1; }
  }
  const record = await proof.finish(result); await verifyArtifactIndex(output, record);
}
await fs.access(path.join(output, 'run.json'));
console.log(JSON.stringify({ ...result, source: source.revision }));
