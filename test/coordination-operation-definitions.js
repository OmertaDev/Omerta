import assert from 'node:assert/strict';
import { compileFamilyOperations, FAMILY_OPERATION_SKILLS, operationSkillValue } from '../src/coordination/operation-definitions.js';
import { COORDINATION_OPERATION_PILOT } from '../src/content/coordination-operation-pilot.js';
import { WORLD_KERNEL_OBJECTS, WORLD_KERNEL_REGISTRY } from '../src/content/world-kernel-pilot.js';
import { compileWorldObjects } from '../src/world-kernel.js';
import { levelOf } from '../src/rules.js';

const worlds = compileWorldObjects(WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS);
const fresh = () => structuredClone(COORDINATION_OPERATION_PILOT[0]);
const compile = (inputs = [fresh()], objects = worlds) => compileFamilyOperations(WORLD_KERNEL_REGISTRY, objects, inputs);
const invalid = (edit, label) => {
  const input = fresh();
  edit(input);
  assert.throws(() => compile([input]), { code: 'bad_family_operation_definition' }, label);
};
const frozen = (value) => {
  if (!value || typeof value !== 'object') return;
  assert(Object.isFrozen(value));
  for (const child of Object.values(value)) frozen(child);
};
const [pilot] = compile();
frozen(compile());
frozen(COORDINATION_OPERATION_PILOT);
assert.equal(pilot.roles.length, 4);
assert.equal(pilot.resolution.chancePermille, 1000);
assert.equal(pilot.executorRoleId, 'organizer');
assert.match(pilot.contentHash, /^[a-f0-9]{64}$/);
const reversed = Object.fromEntries(Object.entries(fresh()).reverse());
assert.equal(compile([reversed])[0].contentHash, pilot.contentHash, 'source property order cannot alter the pin');
const mutable = fresh();
const [detached] = compile([mutable]);
mutable.roles[3].requirements[0].knowledge.value.value = 'tampered';
assert.equal(detached.roles[3].requirements[0].knowledge.value.value, pilot.roles[3].requirements[0].knowledge.value.value);
assert.equal(detached.contentHash, pilot.contentHash, 'compiled knowledge is detached from input mutation');
const changedWorlds = compileWorldObjects(WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS.map((source) => ({
  ...source, title: 'A revised archive definition',
})));
assert.notEqual(compile([fresh()], changedWorlds)[0].contentHash, pilot.contentHash, 'the operation pin includes its world content dependency');
assert.throws(() => compileFamilyOperations(Object.freeze({}), worlds, [fresh()]), { code: 'bad_family_operation_definition' });
assert.throws(() => compile([fresh()], [{ ...worlds[0], contentHash: 'a'.repeat(64) }]), { code: 'bad_family_operation_definition' });
assert.throws(() => compile([fresh(), fresh()]), { code: 'bad_family_operation_definition' });
const storageBoundary = fresh();
storageBoundary.roles[1].id = 'r'.repeat(80);
storageBoundary.roles[1].requirements[0].id = 'q'.repeat(119);
storageBoundary.world.itemRoleId = storageBoundary.roles[1].id;
storageBoundary.world.itemRequirementId = storageBoundary.roles[1].requirements[0].id;
assert.equal(compile([storageBoundary]).length, 1, '80-character role and 200-character contribution key fit the existing storage authority');
const wideRole = structuredClone(storageBoundary);
wideRole.roles[1].id += 'r';
wideRole.roles[1].requirements[0].id = 'key';
wideRole.world.itemRoleId = wideRole.roles[1].id;
wideRole.world.itemRequirementId = 'key';
assert.throws(() => compile([wideRole]), { code: 'bad_family_operation_definition' }, 'an 81-character role cannot reach SQL storage');
const wideContribution = structuredClone(storageBoundary);
wideContribution.roles[1].requirements[0].id += 'q';
wideContribution.world.itemRequirementId = wideContribution.roles[1].requirements[0].id;
assert.throws(() => compile([wideContribution]), { code: 'bad_family_operation_definition' }, 'a 201-character contribution key cannot reach SQL storage');

for (const edit of [
  (value) => { value.execute = () => {}; },
  (value) => { value.roles[0].seats = 2; },
  (value) => { value.roles[0].requirements[0].templateId = 'item:archive_turn_key'; },
  (value) => { value.world.contentHash = worlds[0].contentHash; },
  (value) => { value.resolution.script = 'execute()'; },
  (value) => { value.id = 'bad id'; },
  (value) => { value.version = 0; },
  (value) => { value.version = 1.5; },
  (value) => { value.version = 2147483648; },
  (value) => { value.title = '\ud800'; },
  (value) => { value.lifetimeSeconds = 59; },
  (value) => { value.lifetimeSeconds = 604801; },
  (value) => { value.executorRoleId = 'outsider'; },
  (value) => { value.roles[1].id = value.roles[0].id; },
  (value) => { value.roles = [value.roles[0]]; },
  (value) => { value.roles = Array.from({ length: 9 }, (_, i) => ({ id: `r${i}`, title: `Role ${i}`, requirements: [] })); },
  (value) => { value.roles[0].requirements[1].id = 'presence'; },
  (value) => { value.roles[0].requirements[1].quantity = 1000001; },
  (value) => { value.roles[1].requirements[0].quantity = 2; },
  (value) => { value.roles[0].requirements[0].quantity = 0; },
  (value) => { value.roles[0].requirements[0].quantity = 1n; },
  (value) => { value.roles[0].requirements[0].kind = '__proto__'; },
  (value) => { value.roles[0].requirements[0].kind = 'exec'; },
  (value) => { value.roles[1].requirements[0].templateId = 'mat:wire'; },
  (value) => { value.roles[2].requirements[0].templateId = 'item:archive_turn_key'; },
  (value) => { value.roles[3].requirements[0].knowledge.value.extra = true; },
  (value) => { value.roles[3].requirements[0].knowledge.contentHash = 'bad'; },
  (value) => { value.world.objectId = 'facility:missing'; },
  (value) => { value.world.actionId = 'missing'; },
  (value) => { value.world.itemRoleId = 'organizer'; },
  (value) => { value.world.itemRequirementId = 'missing'; },
  (value) => { value.roles[1].requirements = []; },
  (value) => { value.roles[0].requirements.push({ ...value.roles[1].requirements[0], id: 'extra_key' }); },
  (value) => { value.roles[2].requirements = []; },
  (value) => { value.roles[2].requirements[0].quantity = 2; },
  (value) => { value.roles[2].requirements.push({ id: 'extra', kind: 'resource', templateId: 'mat:scrap_steel', quantity: 1 }); },
  (value) => { value.resolution.chancePermille = -0; },
  (value) => { value.resolution.chancePermille = NaN; },
  (value) => { value.resolution.chancePermille = 1001; },
  (value) => { value.resolution.skillBonuses = [{ skill: 'unknown', perLevelPermille: 1, maxBonusPermille: 10 }]; },
  (value) => { value.resolution.skillBonuses = [{ skill: 'level', perLevelPermille: 1, maxBonusPermille: 1001 }]; },
  (value) => { value.resolution.skillBonuses = Array(2).fill({ skill: 'level', perLevelPermille: 1, maxBonusPermille: 10 }); },
  (value) => { value.roles[0].requirements.push({ id: 'cap', kind: 'capability', skill: 'level', minimum: 2, quantity: 2 }); },
  (value) => { value.roles[0].requirements.push({ id: 'cap', kind: 'capability', skill: 'cash', minimum: 2, quantity: 1 }); },
]) invalid(edit);

invalid((value) => {
  for (let index = value.roles[0].requirements.length; index < 9; index++) {
    value.roles[0].requirements.push({ id: `presence${index}`, kind: 'participation', quantity: 1 });
  }
}, 'each role has at most eight requirements');
invalid((value) => {
  value.roles.push({ id: 'fifth', title: 'Fifth', requirements: [] });
  for (const role of value.roles) {
    for (let index = role.requirements.length; index < 7; index++) {
      role.requirements.push({ id: `presence${index}`, kind: 'participation', quantity: 1 });
    }
  }
}, 'the operation has at most 32 requirements');

let getterCalls = 0;
invalid((value) => Object.defineProperty(value, 'title', { enumerable: true, get() { getterCalls++; return 'Title'; } }));
invalid((value) => Object.defineProperty(value.roles[0].requirements[0], 'kind', {
  enumerable: true, get() { getterCalls++; return 'participation'; },
}));
invalid((value) => { value.roles[0].requirements[0].kind = { toString() { getterCalls++; return 'participation'; } }; });
invalid((value) => Object.defineProperty(value.roles, '0', { enumerable: true, get() { getterCalls++; return {}; } }));
assert.equal(getterCalls, 0, 'declarative validation never executes caller getters or coercion');
invalid((value) => { delete value.roles[0]; });
invalid((value) => { value.roles.extra = true; });
invalid((value) => { value[Symbol('extra')] = true; });
invalid((value) => Object.defineProperty(value, 'title', { enumerable: false, value: 'Hidden' }));
invalid((value) => Object.setPrototypeOf(value, { inherited: true }));
invalid((value) => Object.setPrototypeOf(value.roles, Object.create(Array.prototype)));

// Several contributors may exactly fund one world material requirement; missing,
// extra or excessive material promises above were rejected.
const twoWireWorlds = compileWorldObjects(WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS.map((source) => ({
  ...source, actions: source.actions.map((action) => ({ ...action, materials: [{ templateId: 'mat:wire', quantity: 2 }] })),
})));
const split = fresh();
split.roles[0].requirements.push({ id: 'wire_share', kind: 'resource', templateId: 'mat:wire', quantity: 1 });
assert.equal(compile([split], twoWireWorlds).length, 1);
const manyPredicates = fresh();
const knowledge = manyPredicates.roles[3].requirements[0].knowledge;
manyPredicates.roles[0].requirements = [];
manyPredicates.roles[3].requirements = [];
for (const role of manyPredicates.roles) {
  for (let index = role.requirements.length; index < 8; index++) {
    role.requirements.push({ id: `fact${index}`, kind: 'information', quantity: 1, knowledge });
  }
}
const worldPredicates = (count) => compileWorldObjects(WORLD_KERNEL_REGISTRY, WORLD_KERNEL_OBJECTS.map((source) => ({
  ...source, knowledge: Array.from({ length: count }, (_, index) => ({ ...knowledge, sourceRoot: `root${index}` })),
})));
assert.equal(compile([manyPredicates], worldPredicates(2)).length, 1, '30 authored facts plus two executor world predicates fit the proof batch');
assert.throws(() => compile([manyPredicates], worldPredicates(3)), { code: 'bad_family_operation_definition' },
  'executor world predicates cannot overflow the global 32-requirement proof limit');
const capable = fresh();
capable.roles[0].requirements.push({ id: 'capability', kind: 'capability', quantity: 1, skill: 'level', minimum: 3 });
capable.resolution = { chancePermille: 0, skillBonuses: [{ skill: 'muscle', perLevelPermille: 2, maxBonusPermille: 100 }] };
assert.equal(compile([capable])[0].roles[0].requirements.at(-1).minimum, 3);
assert.deepEqual(FAMILY_OPERATION_SKILLS, ['level', 'muscle', 'cunning', 'speed']);
const character = { respect: '1000', muscle: 5, cunning: '7', speed: 9 };
assert.equal(operationSkillValue(character, 'level'), levelOf(1000));
assert.equal(operationSkillValue(character, 'muscle'), 5);
assert.equal(operationSkillValue(character, 'cunning'), 7);
assert.equal(operationSkillValue(character, 'speed'), 9);
for (const bad of ['cash', '__proto__', 'muscle; DROP TABLE characters']) {
  assert.throws(() => operationSkillValue(character, bad), { code: 'bad_family_operation_definition' });
}
for (const bad of [undefined, null, -1, NaN, Infinity, '', '1e2', {}, '9007199254740992']) {
  assert.throws(() => operationSkillValue({ muscle: bad }, 'muscle'), { code: 'bad_family_operation_definition' });
}
console.log('coordination-operation-definitions: closed data, pins, custody/material matching, bounds, and skills PASS');
