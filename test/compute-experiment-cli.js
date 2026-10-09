import assert from 'node:assert/strict';
import { mkdtemp, writeFile, unlink, rmdir, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { computeExperimentDemo, computeExperimentJson, readComputeExperimentInput, runComputeExperimentCli } from '../tools/compute-experiment.js';

const originalFetch = globalThis.fetch;
globalThis.fetch = () => { throw new Error('Offline experiment attempted network access'); };
const originalToken = process.env.OMERTA_BUSINESS_TOKEN;
process.env.OMERTA_BUSINESS_TOKEN = 'private-offline-experiment-token';
const directory = await mkdtemp(join(tmpdir(), 'omerta-compute-experiment-'));
const paths = ['plan.json', 'dataset.json', 'invalid.json', 'large.json', 'link.json'].map(name => join(directory, name));
try {
  const demo = computeExperimentDemo();
  assert.equal(demo.mode, 'offline'); assert.equal(demo.synthetic, true);
  assert.equal(demo.organicRealRevenueUsdMicros, 0); assert.equal(demo.financialRequests, 0);
  assert.equal(demo.plan.assignments.length, 10);
  assert.deepEqual(await runComputeExperimentCli(['--demo']), demo);
  const output = computeExperimentJson(demo);
  assert(Buffer.byteLength(output) <= 1048576);
  assert(!output.includes(process.env.OMERTA_BUSINESS_TOKEN));
  const input = { baselineModel: demo.plan.baselineModel, candidateModel: demo.plan.candidateModel,
    seed: demo.plan.seed, tasks: demo.plan.tasks };
  await writeFile(paths[0], JSON.stringify(input), { mode: 0o600, flag: 'wx' });
  assert.deepEqual(await runComputeExperimentCli(['--plan', paths[0]]), demo.plan);
  assert.deepEqual(await readComputeExperimentInput(paths[0]), input);
  await writeFile(paths[1], JSON.stringify({ version: 1, plan: demo.plan, trials: [] }), { mode: 0o600, flag: 'wx' });
  const empty = await runComputeExperimentCli(['--analyze', paths[1]]);
  assert(empty && typeof empty === 'object');
  await writeFile(paths[2], '{malformed', { mode: 0o600, flag: 'wx' });
  await assert.rejects(() => readComputeExperimentInput(paths[2]));
  await writeFile(paths[3], 'x'.repeat(1048577), { mode: 0o600, flag: 'wx' });
  await assert.rejects(() => readComputeExperimentInput(paths[3]), /input/);
  await assert.rejects(() => readComputeExperimentInput(directory), /input/);
  try {
    await symlink(paths[0], paths[4], 'file');
    await assert.rejects(() => readComputeExperimentInput(paths[4]), /input/);
  } catch (error) { if (!['EPERM', 'EACCES'].includes(error.code)) throw error; }
  for (const args of [[], ['--token', 'secret'], ['--demo', '--plan'], ['--plan']]) await assert.rejects(() => runComputeExperimentCli(args));
  assert.throws(() => computeExperimentJson({ oversized: 'x'.repeat(1048576) }), /output/);
} finally {
  globalThis.fetch = originalFetch;
  if (originalToken === undefined) delete process.env.OMERTA_BUSINESS_TOKEN; else process.env.OMERTA_BUSINESS_TOKEN = originalToken;
  for (const path of paths) { try { await unlink(path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  await rmdir(directory);
}
console.log('compute-experiment-cli: offline demo, bounded files, safe options and credential isolation passed');
