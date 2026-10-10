#!/usr/bin/env node
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { planShadowComputeRoutes, reconcileShadowComputeOutcomes } from '../src/computerouting.js';
import { readComputeExperimentInput, computeExperimentJson } from './compute-experiment.js';

export async function runComputeRouterCli(args) {
  if (args.length !== 2 || !['--plan', '--reconcile'].includes(args[0]) || typeof args[1] !== 'string' || !args[1]) throw new Error('Invalid compute routing option');
  const input = await readComputeExperimentInput(args[1]);
  return args[0] === '--plan' ? planShadowComputeRoutes(input) : reconcileShadowComputeOutcomes(input);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runComputeRouterCli(process.argv.slice(2)).then(result => process.stdout.write(computeExperimentJson(result)))
    .catch(() => { process.stderr.write('compute_router_error\n'); process.exitCode = 1; });
}
