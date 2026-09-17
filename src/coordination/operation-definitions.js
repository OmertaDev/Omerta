// Bounded, inert Family operation blueprints. Runtime authority still comes from
// locked characters, memberships, custody and knowledge, never these declarations.
import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { levelOf } from '../rules.js';
import { canonicalBytes } from '../content/canonical.js';
import { isWorldGraphRegistry, nodeOf } from '../worldgraph.js';
import { normalizeKnowledgeRequirement, normalizeWorldPrerequisite, knowledgeRequirementKey, worldPrerequisiteKey } from '../world-knowledge.js';
import { compileWorldObjects } from '../world-kernel.js';

export const FAMILY_OPERATION_SKILLS = Object.freeze(['level', 'muscle', 'cunning', 'speed']);
const fail = () => { throw new GameError('bad_family_operation_definition', 'Invalid Family operation definition.'); };
const id = (value, maximum = 128) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value) || value.length > maximum) fail();
  return value;
};
const integer = (value, min, max) => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < min || value > max) fail();
  return value;
};
const title = (value) => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > 120
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) fail();
  return value;
};
function record(value, fields) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== fields.length
    || fields.some((field) => !Object.hasOwn(value, field))
    || Reflect.ownKeys(value).some((key) => !fields.includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail();
}
function array(value, min, max) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length < min || value.length > max) fail();
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length
      || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail();
  }
  for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) fail();
  return value;
}
const skill = (value) => {
  if (!FAMILY_OPERATION_SKILLS.includes(value)) fail();
  return value;
};

/** Only actual character columns and the existing respect-to-level rule are supported. */
export function operationSkillValue(character, skillId) {
  skill(skillId);
  const raw = skillId === 'level' ? character?.respect
    : skillId === 'muscle' ? character?.muscle : skillId === 'cunning' ? character?.cunning : character?.speed;
  if (!['number', 'string'].includes(typeof raw) || (typeof raw === 'string' && !/^\d+$/.test(raw))) fail();
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < 0) fail();
  return skillId === 'level' ? levelOf(value) : value;
}

function requirement(registry, input) {
  // Inspect descriptors before reading kind so accessors cannot execute during validation.
  if (!input || ![Object.prototype, null].includes(Object.getPrototypeOf(input))) fail();
  const kindDescriptor = Object.getOwnPropertyDescriptor(input, 'kind');
  if (!kindDescriptor?.enumerable || !Object.hasOwn(kindDescriptor, 'value')) fail();
  const kind = kindDescriptor.value;
  if (typeof kind !== 'string') fail();
  const extra = ({ participation: [], item: ['templateId'], resource: ['templateId'], capital: [],
    information: ['knowledge'], capability: ['skill', 'minimum'], prerequisite: ['predicate'] })[kind];
  if (!Object.hasOwn({ participation: 1, item: 1, resource: 1, capital: 1, information: 1, capability: 1, prerequisite: 1 }, kind)) fail();
  record(input, ['id', 'kind', 'quantity', ...extra]);
  const result = { id: id(input.id), kind, quantity: integer(input.quantity, 1,
    ['capital', 'resource'].includes(kind) ? 1000000 : 1) };
  if (kind === 'item' || kind === 'resource') {
    result.templateId = id(input.templateId);
    if (nodeOf(registry, result.templateId)?.type !== (kind === 'item' ? 'item_template' : 'material')) fail();
  } else if (kind === 'information') {
    try { result.knowledge = normalizeKnowledgeRequirement(input.knowledge); } catch { fail(); }
  } else if (kind === 'capability') {
    result.skill = skill(input.skill);
    result.minimum = integer(input.minimum, 1, 1000000);
  } else if (kind === 'prerequisite') {
    try { result.predicate = normalizeWorldPrerequisite(input.predicate); } catch { fail(); }
  }
  return Object.freeze(result);
}

/** Compile source definitions against the same registry and objects used by the world kernel. */
export function compileFamilyOperations(registry, worldDefinitions, inputs) {
  if (!isWorldGraphRegistry(registry)) fail();
  array(worldDefinitions, 0, 100);
  array(inputs, 0, 100);
  // Revalidate the compiled world surface and its hash before using references. This
  // also prevents mutable or forged content hashes from entering the operation pin.
  let worlds;
  try {
    const sources = worldDefinitions.map((definition) => {
      record(definition, ['id', 'type', 'title', 'locationId', 'states', 'initialState', 'publicStates', 'knowledge', 'actions', 'contentHash']);
      canonicalBytes(definition);
      const { contentHash: _contentHash, ...source } = definition;
      return source;
    });
    worlds = compileWorldObjects(registry, sources);
    if (worlds.some((definition, index) => definition.contentHash !== worldDefinitions[index].contentHash)) fail();
  } catch { fail(); }
  const worldById = new Map(worlds.map((definition) => [definition.id, definition]));
  const ids = new Set();
  let admissionCount = 0;
  return Object.freeze(inputs.map((input) => {
    const hasAdmission = input !== null && typeof input === 'object' && Object.hasOwn(input, 'admission');
    record(input, ['id', 'version', 'title', 'lifetimeSeconds', 'executorRoleId', 'roles', 'world', 'resolution',
      ...(hasAdmission ? ['admission'] : [])]);
    let admission;
    if (hasAdmission) {
      try { admission = Object.freeze(array(input.admission, 1, 16).map(normalizeWorldPrerequisite)); } catch { fail(); }
      if (admission.some((predicate) => predicate.adapter !== 'mystery_state')
        || new Set(admission.map(worldPrerequisiteKey)).size !== admission.length) fail();
      admissionCount += admission.length;
      if (admissionCount > 32) fail();
    }
    const definitionId = id(input.id);
    if (ids.has(definitionId)) fail();
    ids.add(definitionId);
    const roleIds = new Set();
    let requirementCount = 0;
    const roles = Object.freeze(array(input.roles, 2, 8).map((role) => {
      record(role, ['id', 'title', 'requirements']);
      const roleId = id(role.id, 80);
      if (roleIds.has(roleId)) fail();
      roleIds.add(roleId);
      const requirements = Object.freeze(array(role.requirements, 0, 8).map((entry) => requirement(registry, entry)));
      requirementCount += requirements.length;
      if (new Set(requirements.map((entry) => entry.id)).size !== requirements.length
        || requirements.some((entry) => `${roleId}/${entry.id}`.length > 200)) fail();
      return Object.freeze({ id: roleId, title: title(role.title), requirements });
    }));
    if (requirementCount > 32 || !roleIds.has(input.executorRoleId)) fail();
    for (const role of roles) for (const entry of role.requirements) if (entry.kind === 'prerequisite') {
      const predicate = entry.predicate;
      // Physical contributions already use the operation's custody requirements.
      if (predicate.adapter === 'item_ownership') fail();
      if (predicate.adapter === 'social' && predicate.requirement.subject
        && (!roleIds.has(predicate.requirement.subject) || predicate.requirement.subject === role.id)) fail();
      if (predicate.adapter === 'world_state') {
        const source = worldById.get(predicate.requirement.objectId);
        if (!source || source.contentHash !== predicate.requirement.definitionHash || !source.states.includes(predicate.requirement.state)) fail();
      }
    }
    record(input.world, ['objectId', 'actionId', 'itemRoleId', 'itemRequirementId']);
    const world = Object.freeze({ objectId: id(input.world.objectId), actionId: id(input.world.actionId),
      itemRoleId: id(input.world.itemRoleId), itemRequirementId: id(input.world.itemRequirementId) });
    const worldDefinition = worldById.get(world.objectId);
    const action = worldDefinition?.actions.find((entry) => entry.id === world.actionId);
    if (!action) fail();
    const requirements = roles.flatMap((role) => role.requirements.map((entry) => ({ roleId: role.id, ...entry })));
    // Readiness prepares one global proof batch. The executor also proves the
    // world's own predicates, so those consume the same bounded proof budget.
    if (requirements.filter((entry) => entry.kind === 'information').length + worldDefinition.knowledge.length > 32
      || roles.some((role) => role.requirements.filter((entry) => entry.kind === 'information').length
        + (role.id === input.executorRoleId ? worldDefinition.knowledge.length : 0) > 16)) fail();
    const planned = roles.map((role) => [...new Map([
      ...role.requirements.filter((entry) => entry.kind === 'information').map((entry) => entry.knowledge),
      ...role.requirements.filter((entry) => entry.kind === 'prerequisite' && entry.predicate.adapter === 'world_state')
        .flatMap((entry) => worldById.get(entry.predicate.requirement.objectId).knowledge),
      ...(role.id === input.executorRoleId ? worldDefinition.knowledge : []),
    ].map((entry) => [knowledgeRequirementKey(entry), entry])).values()]);
    if (planned.some((group) => group.length > 16) || planned.reduce((count, group) => count + group.length, 0) > 32) fail();
    const items = requirements.filter((entry) => entry.kind === 'item');
    if (items.length !== 1 || items[0].roleId !== world.itemRoleId || items[0].id !== world.itemRequirementId
      || items[0].templateId !== action.itemTemplateId) fail();
    const resources = new Map();
    for (const entry of requirements.filter((value) => value.kind === 'resource')) {
      resources.set(entry.templateId, (resources.get(entry.templateId) || 0) + entry.quantity);
    }
    if (resources.size !== action.materials.length
      || action.materials.some((entry) => resources.get(entry.templateId) !== entry.quantity)) fail();
    record(input.resolution, ['chancePermille', 'skillBonuses']);
    const skillBonuses = Object.freeze(array(input.resolution.skillBonuses, 0, 4).map((bonus) => {
      record(bonus, ['skill', 'perLevelPermille', 'maxBonusPermille']);
      return Object.freeze({ skill: skill(bonus.skill), perLevelPermille: integer(bonus.perLevelPermille, 0, 1000),
        maxBonusPermille: integer(bonus.maxBonusPermille, 0, 1000) });
    }));
    if (new Set(skillBonuses.map((entry) => entry.skill)).size !== skillBonuses.length) fail();
    const definition = { id: definitionId, version: integer(input.version, 1, 2147483647),
      title: title(input.title), lifetimeSeconds: integer(input.lifetimeSeconds, 60, 604800),
      executorRoleId: input.executorRoleId, roles, world,
      ...(admission ? { admission } : {}),
      resolution: Object.freeze({ chancePermille: integer(input.resolution.chancePermille, 0, 1000), skillBonuses }) };
    let contentHash;
    try {
      contentHash = crypto.createHash('sha256').update(canonicalBytes({ definition,
        worldDefinitionHash: worldDefinition.contentHash })).digest('hex');
    } catch { fail(); }
    return Object.freeze({ ...definition, contentHash });
  }));
}
