import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { runComputeRouterCli } from '../tools/compute-router.js';
import { computeExperimentJson } from '../tools/compute-experiment.js';

const execute = promisify(execFile);
const directory = await mkdtemp(join(tmpdir(), 'omerta-compute-router-'));
const paths = ['invalid.json', 'large.json', 'plan.json'].map(name => join(directory, name));
const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Offline routing attempted network access'); };
try {
  await writeFile(paths[2], JSON.stringify({ version: 1, nowMs: 1947, availableBudgetUsdMicros: 10000,
    policies: [], evidence: [], tasks: [] }), { mode: 0o600, flag: 'wx' });
  const planned = await runComputeRouterCli(['--plan', paths[2]]);
  assert.equal(planned.mode, 'shadow'); assert.equal(planned.eligibleToExecute, false);
  assert.equal(planned.financialRequests, 0); assert.deepEqual(planned.decisions, []);
  const serialized = computeExperimentJson(planned);
  assert(Buffer.byteLength(serialized) <= 1048576);
  const success = await execute(process.execPath, ['tools/compute-router.js', '--plan', paths[2]], { cwd: process.cwd() });
  assert.equal(success.stdout, serialized); assert.equal(success.stderr, '');
  for (const args of [[], ['--token', 'private-credential'], ['--plan'], ['--plan', 'file', '--other']]) await assert.rejects(() => runComputeRouterCli(args));
  await writeFile(paths[0], '{private-credential-invalid-json', { mode: 0o600, flag: 'wx' });
  await assert.rejects(() => runComputeRouterCli(['--plan', paths[0]]));
  await writeFile(paths[1], 'x'.repeat(1048577), { mode: 0o600, flag: 'wx' });
  await assert.rejects(() => runComputeRouterCli(['--plan', paths[1]]), /input/);
  await assert.rejects(() => runComputeRouterCli(['--plan', directory]), /input/);
  try {
    await execute(process.execPath, ['tools/compute-router.js', '--plan', paths[0]], { cwd: process.cwd() });
    assert.fail('Malformed file must fail');
  } catch (error) {
    assert.equal(error.code, 1);
    assert.equal(error.stdout, '');
    assert.equal(error.stderr, 'compute_router_error\n');
    assert(!error.stderr.includes('private-credential'));
  }
  assert.throws(() => computeExperimentJson({ oversized: 'x'.repeat(1048576) }), /output/);
} finally {
  globalThis.fetch = originalFetch;
  for (const path of paths) { try { await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  await rmdir(directory);
}
console.log('compute-router-cli: strict offline options, bounded inputs and sanitized errors passed');
