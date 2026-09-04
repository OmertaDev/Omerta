#!/usr/bin/env node
// Deterministic Phase 1 world-graph acceptance gate.
//
// This is intentionally separate from tools/content.js. The authored-content compiler validates
// activated JSON bundles; Phase 1 uses immutable JavaScript data packages loaded by the generic
// world-graph runtime. Both lanes must fail closed before deployment, without pretending one gate
// covers a format it never reads.
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
import {
  loadAndValidateGraphPackages,
  validateGraph,
} from '../src/worldgraph-validate.js';

export { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
}

export function validatePhase1WorldGraph() {
  const registry = loadAndValidateGraphPackages(PHASE1_WORLD_GRAPH_PACKAGES);
  const validation = validateGraph(registry);
  const contentHash = crypto.createHash('sha256')
    .update(JSON.stringify(canonical(PHASE1_WORLD_GRAPH_PACKAGES)))
    .digest('hex');
  return Object.freeze({
    ok: true,
    contentHash,
    packageIds: Object.freeze([...registry.byPackage.keys()]),
    ...validation.reports,
    warnings: validation.warnings,
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const report = validatePhase1WorldGraph();
    console.log(JSON.stringify(report, null, 2));
    console.log(`✅ Phase 1 world graph accepted — ${report.packages} packages, ${report.nodes} nodes, `
      + `${report.recipes} recipes, ${report.omrRewards} OMR rewards; sha256 ${report.contentHash}`);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error?.code || 'world_graph_validation_failed',
      message: error?.message || String(error),
    }, null, 2));
    process.exitCode = 1;
  }
}
