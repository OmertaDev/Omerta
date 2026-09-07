// Canonical production manifest for the Phase 1 world-graph runtime and release validator.
// Adding a package is incomplete until this manifest, its validator census, and documentation agree.
import { AUTOMOTIVE_SALVAGE_PACKAGE } from './automotive-salvage.js';
import { BELLADONNA_PACKAGE } from './belladonna.js';
import { CORE_MATERIALS_PACKAGE } from './core-materials.js';

export const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([
  CORE_MATERIALS_PACKAGE,
  AUTOMOTIVE_SALVAGE_PACKAGE,
  BELLADONNA_PACKAGE,
]);
