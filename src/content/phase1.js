// Canonical production manifest for the Phase 1 world-graph runtime and release validator.
// Adding a package is incomplete until this manifest, its validator census, and documentation agree.
import { AUTOMOTIVE_SALVAGE_PACKAGE } from './automotive-salvage.js';
import { BELLADONNA_PACKAGE } from './belladonna.js';
import { CORE_MATERIALS_PACKAGE } from './core-materials.js';
import { NEIGHBORHOOD_INITIATION_PACKAGE } from './neighborhood-initiation.js';
import { COMPANY_PRODUCTION_QUALITY_PACKAGE } from './company-production-quality.js';
import { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';
import { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';
import { FIRST_ERRAND_CASE_PACKAGE } from './first-errand-case.js';
import { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';
import { CREW_CROSSCURRENT_PACKAGE } from './crew-crosscurrent.js';

export const PHASE1_WORLD_GRAPH_PACKAGES = Object.freeze([
  CORE_MATERIALS_PACKAGE,
  AUTOMOTIVE_SALVAGE_PACKAGE,
  BELLADONNA_PACKAGE,
  NEIGHBORHOOD_INITIATION_PACKAGE,
  COMPANY_PRODUCTION_QUALITY_PACKAGE,
  ...DISTRICT_STORY_ARC_PACKAGES,
  STAGED_CREW_MISSIONS_PACKAGE,
  ...CITY_WORLD_OPPORTUNITY_PACKAGES,
  FIRST_ERRAND_CASE_PACKAGE,
  CREW_CROSSCURRENT_PACKAGE,
]);
