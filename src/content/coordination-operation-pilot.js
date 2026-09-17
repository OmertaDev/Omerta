// An opt-in Family blueprint using the existing Foundry Archive and Split Ledger
// authorities. Source content alone never enables the feature or creates rewards.
import { compileWorldObjects } from '../world-kernel.js';
import { compileFamilyOperations } from '../coordination/operation-definitions.js';
import { WORLD_KERNEL_OBJECTS, WORLD_KERNEL_REGISTRY } from './world-kernel-pilot.js';

const worldDefinitions = compileWorldObjects(WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS);
const archive = worldDefinitions.find((definition) => definition.id === 'facility:foundry_archive');
const [compiled] = compileFamilyOperations(WORLD_KERNEL_REGISTRY, worldDefinitions, [{
  id: 'operation:recover_foundry_archive', version: 1, title: 'Recover the Foundry Archive',
  lifetimeSeconds: 86400, executorRoleId: 'organizer',
  roles: [
    { id: 'organizer', title: 'Organizer', requirements: [
      { id: 'presence', kind: 'participation', quantity: 1 },
      { id: 'funding', kind: 'capital', quantity: 100 },
    ] },
    { id: 'locksmith', title: 'Locksmith', requirements: [
      { id: 'archive_key', kind: 'item', templateId: 'item:archive_turn_key', quantity: 1 },
    ] },
    { id: 'supplier', title: 'Supplier', requirements: [
      { id: 'wire', kind: 'resource', templateId: 'mat:wire', quantity: 1 },
    ] },
    { id: 'researcher', title: 'Researcher', requirements: [
      { id: 'ledger', kind: 'information', knowledge: archive.knowledge[0], quantity: 1 },
    ] },
  ],
  world: { objectId: archive.id, actionId: 'open_archive', itemRoleId: 'locksmith', itemRequirementId: 'archive_key' },
  resolution: { chancePermille: 1000, skillBonuses: [] },
}]);
const { contentHash: _contentHash, ...source } = compiled;
export const COORDINATION_OPERATION_PILOT = Object.freeze([Object.freeze(source)]);
