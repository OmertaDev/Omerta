// Existing rendered solo journey against a fresh owned PostgreSQL database per width.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createWriteStream } from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import pg from 'pg';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256 } from '../tools/rc1-native-proof.js';

assert(process.argv.includes('--postgres'), 'Native PostgreSQL is required');
const output = process.env.RC1_MOBILE_ADVERSITY_OUTPUT;
assert(output, 'Supply a fresh restricted evidence directory');
const selected = process.argv.find(arg => arg.startsWith('--width='))?.slice(8);
const widths = selected ? [Number(selected)] : [320, 360, 390, 430];
assert(widths.every(width => [320, 360, 390, 430].includes(width)));
const source = await sourceIdentity();
const configuration = { widths, fixtureGrants: [], entry: 'Real guest/character controls and default balances; no privileged grants',
  randomSeam: 'Existing journey pins only the canonical garage boost/model roll to0.01; not a natural random-outcome claim',
  faults: ['Abort one real successful committed command response', 'Reload and retry identical saved command', '800ms committed response delay and double click'],
  sourceOfAuthority: 'Unchanged API, database, command dispatcher and rendered controls',
  terminalBoundary: 'Solo preparation reaches the existing visible Family leadership/Crew requirement; no collective world execution is claimed',
  childTimeoutMs: 240000, worker: 'No worker process; this is a browser command/recovery proof',
  coverageExclusions: ['Collective world action completion', 'Physical devices and wallets', 'Human comprehension', 'All screens and list stress', 'Every major action outcome', 'World matrix and deployed recovery'] };
const proof = await createProofRecorder({ directory: output, source, configuration,
  runId: path.basename(output), seed: 'browser-random-garage-seam', scenarioId: 'native-solo-mobile-adversity', population: widths.length });
const results = [], assets = [];
await proof.record({ kind: 'configuration', configuration });

async function child(width, databaseUrl, directory) {
  await fs.mkdir(directory, { recursive: true });
  const log = createWriteStream(path.join(directory, 'process.log'), { flags: 'wx', mode: 0o600 });
  let timer, timedOut = false;
  try {
    return await new Promise((resolve, reject) => {
      const processHandle = spawn(process.execPath, ['tools/rc1-mobile-journeys.js', '--postgres', `--width=${width}`], {
        cwd: process.cwd(), windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, DATABASE_URL: databaseUrl, RC1_MOBILE_JOURNEY_OUTPUT: directory,
          JWT_SECRET: crypto.randomBytes(32).toString('hex'), MARKET_SEED: crypto.randomBytes(32).toString('hex'),
          MOD_KEY: crypto.randomBytes(32).toString('hex'), SOCIAL_VERIFY_MODE: 'off', POPULATION_OFF: 'on' },
      });
      processHandle.stdout.pipe(log, { end: false }); processHandle.stderr.pipe(log, { end: false });
      log.on('error', reject); processHandle.on('error', reject);
      timer = setTimeout(() => { timedOut = true; processHandle.kill(); }, configuration.childTimeoutMs);
      processHandle.on('close', (exitCode, signal) => resolve({ exitCode, signal, timedOut }));
    });
  } finally {
    clearTimeout(timer);
    await new Promise((resolve, reject) => { log.once('error', reject); log.end(resolve); });
  }
}

for (const width of widths) {
  const directory = path.join(output, `browser-${width}`);
  const database = planOwnedWorldDatabase({ controlUrl: process.env.COORDINATION_TEST_DATABASE_URL,
    runId: `${path.basename(output)}-${width}`, sourceRevision: source.revision });
  const result = { width, status: 'FAIL' }; let pool;
  try {
    await proof.record({ kind: 'database-created', width, ...await database.create() });
    pool = new pg.Pool({ connectionString: database.url });
    result.postgresVersion = (await pool.query('SELECT version() AS version')).rows[0].version;
    await proof.snapshot(pool, `initial-${width}`);
    result.child = await proof.invoke('real-browser-child', { width }, () => child(width, database.url, directory));
    await proof.snapshot(pool, `after-browser-${width}`);
    await proof.checkpoint(pool, `after-browser-${width}`, database.url);
    const browser = JSON.parse(await fs.readFile(path.join(directory, 'results.json'), 'utf8'));
    await proof.artifact(`browser-result-${width}.json`, browser);
    assert.equal(result.child.exitCode, 0, 'Browser journey failed; native state and output retained');
    assert.equal(result.child.timedOut, false); assert.equal(browser.results.length, 1);
    const journey = browser.results[0]; assert.equal(journey.status, 'PASS'); assert.equal(journey.width, width);
    assert(journey.controls.length > 0); assert(journey.controls.every(control => control.hit && control.width >= 44 && control.height >= 44));
    result.browserVersion = browser.browser; result.steps = journey.steps; result.controls = journey.controls.length;
    result.commandRequests = journey.requests.length; result.delayedResponse = journey.delayedResponse;
    result.status = 'PASS_SCOPED';
  } catch (error) {
    result.error = error.message;
    await proof.record({ kind: 'failure', width, message: error.message, stack: error.stack });
  } finally {
    for (const close of [async () => pool?.end(), async () => proof.record({ kind: 'database-cleanup', width, ...await database.close() })]) {
      try { await close(); } catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; }
    }
    try {
      for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
        assert(entry.isFile(), 'Unexpected nested/symlink browser asset');
        const bytes = await fs.readFile(path.join(directory, entry.name));
        assets.push({ path: `browser-${width}/${entry.name}`, bytes: bytes.length, sha256: sha256(bytes) });
      }
    } catch (error) { result.status = 'FAIL'; result.assetError = error.message; }
    results.push(result); await proof.record({ kind: 'width-completed', ...result });
    console.log(JSON.stringify({ width, status: result.status, error: result.error || null }));
  }
}
await proof.artifact('browser-asset-index.json', { classification: 'RESTRICTED_BROWSER_EVIDENCE', assets });
for (const asset of assets) {
  const file = path.resolve(output, asset.path);
  assert(path.relative(path.resolve(output), file).split(path.sep)[0] !== '..');
  const bytes = await fs.readFile(file); assert.equal(bytes.length, asset.bytes); assert.equal(sha256(bytes), asset.sha256);
}
const result = { status: results.length === widths.length && results.every(row => row.status === 'PASS_SCOPED') ? 'PASS_SCOPED' : 'FAIL',
  widths, results, browserAssetsVerified: assets.length, matrixQualifying: false,
  statement: 'Native automated solo command recovery and declared canonical preparation; no human, physical device or complete mobile clearance' };
const run = await proof.finish(result); await verifyArtifactIndex(output, run);
if (result.status !== 'PASS_SCOPED') process.exitCode = 1;
console.log(JSON.stringify({ status: result.status, source: source.revision, widths, matrixQualifying: false }));
