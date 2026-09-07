// One pure Phase 1 acceptance boundary shared by server boot and the release CLI.
//
// The reusable world-graph validator intentionally validates graph shape rather than every
// executable mystery/operation adapter contract. Phase 1 must validate both layers before serving:
// malformed content must never survive until a request constructs a runtime context.
import crypto from 'node:crypto';
import { validateCraftingDefinitions } from '../crafting.js';
import { validateMysteryDefinitions } from '../mysteries.js';
import { validateOperationDefinitions } from '../operations.js';
import {
  loadAndValidateGraphPackages,
  validateGraph,
} from '../worldgraph-validate.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from './phase1.js';
import { validatePhase1EconomyPolicy } from './phase1-policy.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

export function loadAndValidatePhase1WorldGraph(packages = PHASE1_WORLD_GRAPH_PACKAGES) {
  const registry = loadAndValidateGraphPackages(packages);
  const validation = validateGraph(registry);
  if (validation.reports.omrRewards !== 0) {
    const error = new Error('Phase 1 executable content permits no OMR reward authority.');
    error.code = 'phase1_economy_policy';
    error.details = Object.freeze({ kind: 'omr', omrRewards: validation.reports.omrRewards });
    throw error;
  }
  const economyPolicy = validatePhase1EconomyPolicy(packages);
  validateCraftingDefinitions(registry);
  validateMysteryDefinitions(registry);
  validateOperationDefinitions(registry);
  const contentHash = crypto.createHash('sha256')
    .update(JSON.stringify(canonical(packages)))
    .digest('hex');
  const report = Object.freeze({
    ok: true,
    contentHash,
    packageIds: Object.freeze([...registry.byPackage.keys()]),
    ...validation.reports,
    executableDefinitions: Object.freeze({ crafting: true, mysteries: true, operations: true }),
    economyPolicy,
    warnings: validation.warnings,
  });
  return Object.freeze({ registry, report });
}

export function validatePhase1WorldGraph(packages = PHASE1_WORLD_GRAPH_PACKAGES) {
  return loadAndValidatePhase1WorldGraph(packages).report;
}
