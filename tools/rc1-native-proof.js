// Evidence tooling only. PostgreSQL remains the authoritative game state.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object' && !(value instanceof Date)) return `{${Object.keys(value).sort()
    .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export const NORMALIZATION = Object.freeze({ version: 1,
  rows: 'Sort rows by their complete canonical JSON representation; order is not stored table state.',
  keys: 'Sort object property names only.',
  exclusions: [],
  retained: 'All generated IDs, timestamps, balances, visibility, state, outcomes, and sequence values. No semantic fields are removed.' });
const git = (...args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 }).trim();
export async function sourceIdentity() {
  assert.equal(git('status', '--porcelain', '--untracked-files=normal'), '', 'Evidence requires a clean committed checkout');
  const revision = git('rev-parse', 'HEAD');
  const files = git('ls-files', '-z').split('\0').filter(Boolean);
  const contents = [];
  for (const file of files) contents.push([file, sha256(await fs.readFile(file))]);
  return { revision, gitTree: git('rev-parse', 'HEAD^{tree}'), checkoutSha256: sha256(canonicalJson(contents)),
    lockfileSha256: sha256(await fs.readFile('package-lock.json')), schemaSha256: sha256(await fs.readFile('schema.sql')) };
}
export async function assertSourceUnchanged(source) {
  assert.deepEqual(await sourceIdentity(), source, 'Source changed while evidence was generated');
}
export function validateScenarioManifest(manifest) {
  assert.equal(manifest.format, 1);
  assert.deepEqual(manifest.populations, [25, 100, 250, 500, 1000]);
  assert.deepEqual(manifest.seeds, ['rc1-alpha', 'rc1-beta', 'rc1-gamma']);
  assert.equal(manifest.scenarios.length, 15);
  assert.equal(new Set(manifest.scenarios.map((s) => s.id)).size, 15);
  const expected = manifest.scenarios.flatMap((s) => manifest.populations.flatMap((population) =>
    manifest.seeds.map((seed) => `${s.id}/${population}/${seed}`))).sort();
  assert.deepEqual(manifest.cells.map((c) => `${c.scenarioId}/${c.population}/${c.seed}`).sort(), expected);
  assert.equal(manifest.requiredRuns, 225);
  assert.equal(manifest.thresholds.minimumLogicalDays, 90);
  assert.equal(manifest.thresholds.minimumApplicableSeasonalRollovers, 2);
  assert.equal(manifest.thresholds.minimumLongestLifecycleExecutions, 2);
  assert.equal(manifest.thresholds.soak.wallClockHours, 12);
  assert.equal(manifest.thresholds.soak.population, 1000);
  assert.equal(manifest.thresholds.soak.minimumActiveActorsPerHour, 250);
  assert.equal(manifest.thresholds.soak.minimumInFlightBurst, 100);
  return manifest;
}

const identifier = (value) => { assert(/^[a-z_][a-z_0-9]*$/.test(value), `Unsafe PostgreSQL identifier: ${value}`); return `"${value}"`; };
export async function canonicalDatabaseSnapshot(pool) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY');
    const { schema, version, at } = (await client.query('SELECT current_schema() AS schema, version() AS version, transaction_timestamp() AS at')).rows[0];
    const tables = (await client.query("SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename", [schema])).rows;
    const state = {};
    for (const { tablename } of tables) {
      // to_json preserves exact numeric/atomic SQL values as JSON number text until
      // PostgreSQL serializes the whole row; node receives text, not rounded numbers.
      const rows = (await client.query(`SELECT row_to_json(t)::text AS value FROM ${identifier(schema)}.${identifier(tablename)} AS t`)).rows;
      state[tablename] = rows.map(({ value }) => value).sort();
    }
    const sequences = (await client.query('SELECT sequencename,last_value FROM pg_sequences WHERE schemaname=$1 ORDER BY sequencename', [schema])).rows;
    await client.query('COMMIT');
    const canonical = canonicalJson({ tables: state, sequences });
    return { schema, version, capturedAt: at, stateSha256: sha256(canonical), tables: state, sequences, normalization: NORMALIZATION };
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}

function pgArguments(url) {
  const endpoint = new URL(url);
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname), 'Only disposable loopback databases are supported');
  return { args: ['--host', endpoint.hostname, '--port', endpoint.port || '5432', '--username', decodeURIComponent(endpoint.username),
    '--dbname', decodeURIComponent(endpoint.pathname.slice(1)), '--no-password'],
    env: { ...process.env, PGPASSWORD: decodeURIComponent(endpoint.password) } };
}
function pgTool(name) { return process.env.RC1_PG_BIN ? path.join(process.env.RC1_PG_BIN, `${name}${process.platform === 'win32' ? '.exe' : ''}`) : name; }
export async function writeCheckpoint(pool, destination, databaseUrl) {
  // Call only at a quiescent barrier; compare complete state around pg_dump so
  // concurrent writers cannot silently produce an inconsistent claimed checkpoint.
  const before = await canonicalDatabaseSnapshot(pool);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  const connection = pgArguments(databaseUrl);
  execFileSync(pgTool('pg_dump'), [...connection.args, '--format=custom', '--schema', before.schema,
    '--no-owner', '--no-acl', '--file', destination], { env: connection.env, stdio: 'pipe' });
  const after = await canonicalDatabaseSnapshot(pool);
  assert.equal(after.stateSha256, before.stateSha256, 'Checkpoint requires a quiescent database');
  return { schema: before.schema, stateSha256: before.stateSha256, sha256: sha256(await fs.readFile(destination)),
    bytes: (await fs.stat(destination)).size, databaseVersion: before.version,
    toolVersion: execFileSync(pgTool('pg_dump'), ['--version'], { encoding: 'utf8' }).trim(),
    normalization: NORMALIZATION };
}
export async function restoreCheckpoint(checkpoint, destination, targetUrl) {
  assert.equal(sha256(await fs.readFile(destination)), checkpoint.sha256, 'Checkpoint bytes changed');
  const { Pool } = await import('pg');
  const base = new Pool({ connectionString: targetUrl });
  try {
    // Never drop or overwrite a preexisting schema, even in the disposable DB.
    const exists = await base.query('SELECT 1 FROM pg_namespace WHERE nspname=$1', [checkpoint.schema]);
    assert.equal(exists.rowCount, 0, 'Restore target already contains the checkpoint schema');
    const connection = pgArguments(targetUrl);
    execFileSync(pgTool('pg_restore'), [...connection.args, '--exit-on-error', '--no-owner', '--no-acl', destination],
      { env: connection.env, stdio: 'pipe' });
    const pool = new Pool({ connectionString: targetUrl, options: `-c search_path=${checkpoint.schema}` });
    try {
      assert.equal((await canonicalDatabaseSnapshot(pool)).stateSha256, checkpoint.stateSha256, 'Restored canonical state differs');
      return pool;
    } catch (error) { await pool.end(); throw error; }
  } finally { await base.end(); }
}

export async function createProofRecorder({ directory, source, configuration, runId, seed, scenarioId, population }) {
  // Output must be outside the checkout so evidence cannot make source checks dirty.
  const root = path.resolve(git('rev-parse', '--show-toplevel'));
  const relative = path.relative(root, path.resolve(directory));
  assert(relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative), 'Restricted evidence directory must be outside the source checkout');
  await fs.mkdir(directory, { recursive: true });
  // Exclusive creation avoids overwriting an earlier failed run or its reproduction.
  await fs.writeFile(path.join(directory, 'run-reserved.json'), canonicalJson({ runId, source }), { flag: 'wx', mode: 0o600 });
  let sequence = 0, invocation = 0, previousHash = null, pendingWrites = Promise.resolve();
  const artifacts = [], startedAt = new Date().toISOString();
  const record = (event) => {
    pendingWrites = pendingWrites.then(async () => {
      const row = { sequence: ++sequence, previousHash, observedAt: new Date().toISOString(), ...event };
      previousHash = sha256(canonicalJson(row));
      await fs.appendFile(path.join(directory, 'history.jsonl'), `${canonicalJson({ ...row, hash: previousHash })}\n`, { mode: 0o600 });
      return row.sequence;
    });
    return pendingWrites;
  };
  const put = async (name, value) => {
    assert(/^[a-z0-9-]+\.json$/.test(name));
    const bytes = `${JSON.stringify(value, null, 2)}\n`;
    await fs.writeFile(path.join(directory, name), bytes, { flag: 'wx', mode: 0o600 });
    artifacts.push({ path: name, sha256: sha256(bytes), bytes: Buffer.byteLength(bytes) });
  };
  return {
    record,
    async invoke(kind, identity, work) {
      const id = ++invocation;
      await record({ kind: 'invocation', invocation: id, authority: kind, identity });
      try {
        const value = await work();
        await record({ kind: 'completion', invocation: id, outcome: 'RETURNED', result: value });
        return value;
      } catch (error) {
        await record({ kind: 'completion', invocation: id, outcome: 'THREW', error: { message: error.message, code: error.code || null } });
        throw error;
      }
    },
    async snapshot(pool, label) { const value = await canonicalDatabaseSnapshot(pool); await put(`${label}.json`, value); return value; },
    async checkpoint(pool, label, url) {
      const name = `${label}.dump`, value = await writeCheckpoint(pool, path.join(directory, name), url);
      artifacts.push({ path: name, sha256: value.sha256, bytes: value.bytes });
      await put(`${label}-checkpoint.json`, value); return value;
    },
    async finish(result) {
      assert(['PASS_SCOPED', 'FAIL'].includes(result.status), 'A scoped recorder cannot issue release or matrix clearance');
      await pendingWrites;
      let sourceFailure;
      try { await assertSourceUnchanged(source); } catch (error) { sourceFailure = error.message; }
      const history = await fs.readFile(path.join(directory, 'history.jsonl'));
      artifacts.push({ path: 'history.jsonl', sha256: sha256(history), bytes: history.length });
      const record = { format: 1, runId, seed, scenarioId, population, source, configuration,
        configurationSha256: sha256(canonicalJson(configuration)), startedAt, endedAt: new Date().toISOString(),
        runtime: { node: process.version, platform: process.platform, architecture: process.arch, cpuCount: os.cpus().length,
          totalMemoryBytes: os.totalmem(), availableParallelism: os.availableParallelism(),
          productionEquivalent: false, hardwareLimits: 'Local machine; no enforced process CPU/RAM quota.' },
        status: sourceFailure ? 'FAIL' : result.status, result, artifacts,
        ...(sourceFailure ? { sourceFailure } : {}),
        evidenceKind: 'native-postgresql-scoped-fixture', matrixQualifying: false,
        coverageExclusions: ['90 simulated days', 'two seasonal rollovers', 'all due production worker intervals',
          'full thirteen-resource transition coverage', 'same-seed normalized fresh-world equivalence',
          'transaction-commit total order / deterministic concurrency scheduler', '12-hour production-equivalent soak',
          'natural entry', 'real people and deployed environment'],
        traceSemantics: 'Invocation and response-completion observation order, not PostgreSQL commit order. Raw IDs/results retained in restricted output.' };
      await put('run.json', record);
      if (sourceFailure) throw Error(sourceFailure);
      return record;
    },
  };
}

export async function verifyArtifactIndex(directory, record) {
  assert(Array.isArray(record.artifacts) && record.artifacts.length > 0, 'Missing artifact index');
  for (const artifact of record.artifacts) {
    assert(/^[a-z0-9-]+\.(json|jsonl|dump)$/.test(artifact.path), 'Invalid evidence path');
    const bytes = await fs.readFile(path.join(directory, artifact.path));
    assert.equal(bytes.length, artifact.bytes, `Artifact size mismatch: ${artifact.path}`);
    assert.equal(sha256(bytes), artifact.sha256, `Artifact hash mismatch: ${artifact.path}`);
  }
  assert.equal(record.configurationSha256, sha256(canonicalJson(record.configuration)), 'Configuration changed');
  assert.equal(record.status, record.result.status, 'Result status mismatch');
  assert.equal(record.matrixQualifying, false, 'Scoped harness cannot qualify a matrix cell');
  const history = (await fs.readFile(path.join(directory, 'history.jsonl'), 'utf8')).trim().split('\n').map((line) => JSON.parse(line));
  const unfinished = new Set();
  let previousHash = null;
  for (const [index, { hash, ...event }] of history.entries()) {
    assert.equal(event.sequence, index + 1, 'History sequence gap');
    assert.equal(event.previousHash, previousHash, 'History chain gap');
    assert.equal(hash, sha256(canonicalJson(event)), 'History hash mismatch');
    previousHash = hash;
    if (event.kind === 'invocation') { assert(!unfinished.has(event.invocation), 'Duplicate invocation'); unfinished.add(event.invocation); }
    if (event.kind === 'completion') { assert(unfinished.delete(event.invocation), 'Unknown/repeated completion'); }
  }
  assert.equal(unfinished.size, 0, 'Unfinished authority invocations');
  return true;
}
