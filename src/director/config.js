import { GameError } from '../game.js';
import { createLivingWorldDirector, DIRECTOR_MODES } from './runtime.js';
import { createDockWarDefinitions } from './dock-war.js';
import { createDockWarContent } from '../content/dock-war.js';

// Snapshot only declared deployment inputs. Direct reads keep every operational
// switch visible to the repository's preflight environment inventory.
export function directorConfiguration(env = {
  LIVING_WORLD_DIRECTOR: process.env.LIVING_WORLD_DIRECTOR,
  DIRECTOR_ACCOUNT_IDS: process.env.DIRECTOR_ACCOUNT_IDS,
  CORE_PROGRESSION: process.env.CORE_PROGRESSION,
  WORLD_GRAPH_KERNEL: process.env.WORLD_GRAPH_KERNEL,
  COORDINATION_ENGINE: process.env.COORDINATION_ENGINE,
  COORDINATION_KNOWLEDGE: process.env.COORDINATION_KNOWLEDGE,
  COORDINATION_KNOWLEDGE_SHARING: process.env.COORDINATION_KNOWLEDGE_SHARING,
  COORDINATION_OPERATIONS: process.env.COORDINATION_OPERATIONS,
  COORDINATION_ACCOUNT_IDS: process.env.COORDINATION_ACCOUNT_IDS,
}) {
  const mode = env.LIVING_WORLD_DIRECTOR || 'DIRECTOR_DISABLED';
  const accountIds = String(env.DIRECTOR_ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (!DIRECTOR_MODES.includes(mode) || (mode === 'LIMITED_COHORT' && !accountIds.length))
    throw new GameError('bad_director_configuration', 'Invalid Living World Director mode or cohort.');
  const foundations = ['CORE_PROGRESSION', 'WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE', 'COORDINATION_KNOWLEDGE',
    'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS'];
  if (mode !== 'DIRECTOR_DISABLED' && !foundations.every((flag) => env[flag] === 'on'))
    throw new GameError('bad_director_configuration', 'Living World Director requires the existing world foundations.');
  const worldCohort = String(env.COORDINATION_ACCOUNT_IDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (worldCohort.length && (!accountIds.length || accountIds.some((id) => !worldCohort.includes(id))))
    if (mode !== 'DIRECTOR_DISABLED') throw new GameError('bad_director_configuration', 'Director cohort must fit world admission.');
  if (mode === 'LIMITED_COHORT' && [...new Set(accountIds)].sort().join(',') !== [...new Set(worldCohort)].sort().join(','))
    throw new GameError('bad_director_configuration', 'Limited Director and world cohorts must match so every existing content route remains gated.');
  return Object.freeze({ mode, accountIds });
}

export function createConfiguredDirector(pool, content) {
  const config = directorConfiguration();
  if (config.mode === 'DIRECTOR_DISABLED') return null;
  const dock = content.directorContent || createDockWarContent(content);
  // Shadow/simulation compile privately; ordinary player catalogs retain their
  // existing content. A shadow evaluation can never expose these definitions.
  return createLivingWorldDirector({ pool, content: content.directorContent ? content : dock,
    definitions: createDockWarDefinitions(dock), ...config });
}
