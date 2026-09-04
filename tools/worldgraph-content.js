#!/usr/bin/env node
// Deterministic Phase 1 world-graph acceptance gate.
//
// This is intentionally separate from tools/content.js. The authored-content compiler validates
// activated JSON bundles; Phase 1 uses immutable JavaScript data packages loaded by the generic
// world-graph runtime. Both lanes must fail closed before deployment, without pretending one gate
// covers a format it never reads.
import { pathToFileURL } from 'node:url';
import { validatePhase1WorldGraph } from '../src/content/phase1-validation.js';

export { PHASE1_WORLD_GRAPH_PACKAGES } from '../src/content/phase1.js';
export { validatePhase1WorldGraph } from '../src/content/phase1-validation.js';

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  try {
    const report = validatePhase1WorldGraph();
    console.log(JSON.stringify(report, null, 2));
    console.log(`✅ Phase 1 world-graph executable definitions and economy policy compliant — `
      + `mysteries and operations validated, zero OMR authority, zero cash rewards/sources, `
      + `and the sole cash cost is recipe:hardened_steel at exactly $300; ${report.packages} packages, `
      + `${report.nodes} nodes, ${report.recipes} recipes; sha256 ${report.contentHash}`);
  } catch (error) {
    console.error(JSON.stringify({
      ok: false,
      error: error?.code || 'world_graph_validation_failed',
      message: error?.message || String(error),
    }, null, 2));
    process.exitCode = 1;
  }
}
