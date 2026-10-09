#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { open, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planComputeExperiment, analyzeComputeExperiment } from '../src/computeexperiment.js';

const MAX_BODY = 1048576;

export async function readComputeExperimentInput(path) {
  const before = await lstat(path);
  if (!before.isFile() || before.isSymbolicLink() || before.size > MAX_BODY) throw new Error('Invalid experiment input');
  const handle = await open(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const stat = await handle.stat(); const current = await lstat(path);
    if (!stat.isFile() || !current.isFile() || current.isSymbolicLink() || stat.size > MAX_BODY
        || stat.dev !== before.dev || stat.ino !== before.ino || current.dev !== stat.dev || current.ino !== stat.ino) throw new Error('Invalid experiment input');
    const buffer = Buffer.alloc(MAX_BODY + 1); let bytes = 0;
    while (bytes < buffer.length) {
      const read = await handle.read(buffer, bytes, buffer.length - bytes, null);
      if (!read.bytesRead) break;
      bytes += read.bytesRead;
    }
    if (bytes > MAX_BODY) throw new Error('Experiment input too large');
    return JSON.parse(buffer.subarray(0, bytes).toString('utf8'));
  } finally { await handle.close(); }
}

export function computeExperimentDemo() {
  const plan = planComputeExperiment({ baselineModel: 'fixture-baseline', candidateModel: 'fixture-candidate', seed: 1947,
    tasks: Array.from({ length: 10 }, (_, index) => ({ taskId: `task_${index + 1}`,
      inputHash: createHash('sha256').update(`synthetic-market-analysis-${index + 1}`).digest('hex') })) });
  const trials = plan.assignments.flatMap(pair => ['baseline', 'candidate'].map(condition => ({
    pairId: pair.pairId, condition, model: condition === 'baseline' ? plan.baselineModel : plan.candidateModel,
    order: condition === 'baseline' ? pair.baselineOrder : pair.candidateOrder,
    graderId: 'fixture-grader', graderBlind: true, status: 'succeeded',
    costUsdMicros: condition === 'baseline' ? 100 : 200, latencyMs: condition === 'baseline' ? 1000 : 1500,
    scores: Object.fromEntries(['accuracy', 'evidence', 'relevance', 'uncertainty'].map(key => [key, condition === 'baseline' ? 7000 : 8000])), accepted: null,
  })));
  return { mode: 'offline', synthetic: true, organicRealRevenueUsdMicros: 0, financialRequests: 0,
    plan, analysis: analyzeComputeExperiment({ version: 1, plan, trials }) };
}

export async function runComputeExperimentCli(args) {
  if (args.length === 1 && args[0] === '--demo') return computeExperimentDemo();
  if (args.length !== 2 || !['--plan', '--analyze'].includes(args[0]) || !args[1]) throw new Error('Invalid experiment option');
  const input = await readComputeExperimentInput(args[1]);
  return args[0] === '--plan' ? planComputeExperiment(input) : analyzeComputeExperiment(input);
}

export function computeExperimentJson(value) {
  const json = JSON.stringify(value);
  if (typeof json !== 'string' || Buffer.byteLength(json) + 1 > MAX_BODY) throw new Error('Experiment output too large');
  return `${json}\n`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runComputeExperimentCli(process.argv.slice(2)).then(result => process.stdout.write(computeExperimentJson(result)))
    .catch(() => { process.stderr.write('compute_experiment_error\n'); process.exitCode = 1; });
}
