// One admitted content selection shared by every core route. Definitions never
// activate themselves; operators must enable the existing foundations and the
// explicit progression switch. Player services still enforce their account cohort.
import { createFurnaceLedger } from './furnace-ledger.js';
import { WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS, WORLD_KERNEL_RECIPE } from './world-kernel-pilot.js';
import { COORDINATION_OPERATION_PILOT } from './coordination-operation-pilot.js';
import { COORDINATION_ALL_PILOTS } from '../coordination/pilot.js';
import { createCoordinationRegistry, coordinationGraphs } from '../coordination/graph.js';
import { createCampaignNetworkContent } from './campaign-network.js';

const legacy = Object.freeze({ registry: WORLD_KERNEL_REGISTRY, objects: WORLD_KERNEL_OBJECTS,
  operations: COORDINATION_OPERATION_PILOT, recipeIds: Object.freeze([WORLD_KERNEL_RECIPE]),
  coordinationRegistry: COORDINATION_ALL_PILOTS, mysteryGraphIds: Object.freeze([]), progression: false });
let admitted, directorAdmitted;
export function coreProgressionContent() {
  const enabled = process.env.CORE_PROGRESSION === 'on' && ['WORLD_GRAPH_KERNEL', 'COORDINATION_ENGINE',
    'COORDINATION_KNOWLEDGE', 'COORDINATION_KNOWLEDGE_SHARING', 'COORDINATION_OPERATIONS']
    .every((flag) => process.env[flag] === 'on');
  if (!enabled) return legacy;
  if (!admitted) {
    const chain = createFurnaceLedger();
    admitted = Object.freeze({ ...chain, progression: true,
      objects: Object.freeze([...WORLD_KERNEL_OBJECTS, ...chain.objects]),
      operations: Object.freeze([...COORDINATION_OPERATION_PILOT, ...chain.operations]),
      recipeIds: Object.freeze([WORLD_KERNEL_RECIPE, ...chain.recipeIds]),
      coordinationRegistry: createCoordinationRegistry([
        ...coordinationGraphs(COORDINATION_ALL_PILOTS), ...coordinationGraphs(chain.coordinationRegistry),
      ].map(({ contentHash: _hash, ...definition }) => definition)),
    });
  }
  if (!['LIMITED_COHORT', 'LIVE'].includes(process.env.LIVING_WORLD_DIRECTOR)) return admitted;
  if (!directorAdmitted) {
    const dock = createCampaignNetworkContent(admitted);
    directorAdmitted = Object.freeze({ ...admitted, registry: dock.registry, directorContent: dock,
      consequencePolicies: dock.consequencePolicies,
      objects: Object.freeze([...admitted.objects, ...dock.objects]),
      operations: Object.freeze([...admitted.operations, ...dock.operations]),
      recipeIds: Object.freeze([...admitted.recipeIds, ...dock.recipeIds]),
      mysteryGraphIds: Object.freeze([...admitted.mysteryGraphIds, ...dock.mysteryGraphIds]),
      coordinationRegistry: createCoordinationRegistry([
        ...coordinationGraphs(admitted.coordinationRegistry), ...coordinationGraphs(dock.coordinationRegistry),
      ].map(({ contentHash: _hash, ...definition }) => definition)),
    });
  }
  return directorAdmitted;
}
