// The Director admits inert, bounded content. These declarations confer no world,
// inventory, knowledge or operation authority on their caller.
import crypto from 'node:crypto';
import { canonicalBytes } from '../content/canonical.js';
import { normalizeKnowledgeRequirement } from '../world-knowledge.js';

const ADMITTED = new WeakSet();
export const DIRECTOR_LIMITS = Object.freeze({ definitions: 64, states: 16, facts: 16,
  transitions: 32, audiences: 8, signals: 16, adapters: 16, campaignNodes: 32, campaignBranches: 64 });
export const DIRECTOR_FACTS = Object.freeze({
  worldState: 'text', controllerFamilyId: 'nullable_text', worldRevision: 'number',
  resourceQuantity: 'number', resourceDemand: 'number', resourceDeficit: 'number', activePlayers: 'number',
  activeFamilies: 'number', activeCrews: 'number', completedOperations: 'number',
  failedOperations: 'number', discoveredSources: 'number', priorWorldAction: 'nullable_text',
  priorOutcome: 'nullable_text', season: 'number', familyActivity: 'number',
});
export const DIRECTOR_PRESSURES = Object.freeze({
  resourceDeficit: Object.freeze({ category: 'economic', inputs: Object.freeze(['resourceQuantity', 'resourceDemand']),
    semantics: 'Fraction of admitted material demand missing from existing stock; zero demand means zero pressure.' }),
  territoryControl: Object.freeze({ category: 'territory', inputs: Object.freeze(['controllerFamilyId']),
    semantics: 'One when the canonical territory has a controller; zero otherwise.' }),
  operationFailure: Object.freeze({ category: 'operational', inputs: Object.freeze(['completedOperations', 'failedOperations']),
    semantics: 'Failed operations divided by completed plus failed operations in the observation window.' }),
  discoveryActivity: Object.freeze({ category: 'information', inputs: Object.freeze(['discoveredSources']),
    semantics: 'Distinct observed discovery sources divided by the bounded sample size of 32, capped at one.' }),
});
export const DIRECTOR_RECOVERY_TRIGGERS = Object.freeze(['participant_unavailable', 'crew_dissolved',
  'membership_changed', 'item_lost', 'expiry', 'restart', 'season_changed']);
// Other player commands are derived by their existing authority. A Director
// adapter needs a complete, presently implemented target shape.
export const DIRECTOR_COMMAND_TYPES = Object.freeze(['discovery.start', 'operation.create', 'mystery.start']);

export class DirectorDefinitionError extends Error {
  constructor(message) { super(message); this.name = 'DirectorDefinitionError'; this.code = 'bad_director_definition'; }
}
const fail = (message) => { throw new DirectorDefinitionError(message); };
const id = (value) => {
  if (typeof value !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(value)) fail('Invalid identifier.');
  return value;
};
const integer = (value, minimum, maximum) => {
  if (!Number.isSafeInteger(value) || Object.is(value, -0) || value < minimum || value > maximum) fail('Integer outside its declared bound.');
  return value;
};
const text = (value, maximum = 600) => {
  if (typeof value !== 'string' || !value.trim() || value !== value.trim() || value.length > maximum
    || /[\u0000-\u001f\u007f-\u009f]/u.test(value)) fail('Invalid bounded text.');
  return value;
};
const choice = (value, values) => {
  if (!values.includes(value)) fail('Unknown closed catalog value.');
  return value;
};
function record(value, fields) {
  if (!value || ![Object.prototype, null].includes(Object.getPrototypeOf(value))
    || Reflect.ownKeys(value).length !== fields.length || fields.some((field) => !Object.hasOwn(value, field))
    || Reflect.ownKeys(value).some((key) => !fields.includes(key)
      || !Object.getOwnPropertyDescriptor(value, key)?.enumerable
      || !Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'))) fail('Unexpected or missing declaration field.');
}
function array(value, minimum, maximum) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype
    || value.length < minimum || value.length > maximum) fail('Array outside its declared bound.');
  for (const key of Reflect.ownKeys(value)) {
    if (key === 'length') continue;
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (typeof key !== 'string' || !/^(0|[1-9][0-9]*)$/.test(key) || Number(key) >= value.length
      || !descriptor?.enumerable || !Object.hasOwn(descriptor, 'value')) fail('Arrays require enumerable data indices.');
  }
  for (let index = 0; index < value.length; index++) if (!Object.hasOwn(value, index)) fail('Sparse arrays are forbidden.');
  return value;
}
function unique(values, key = (value) => value) {
  if (new Set(values.map(key)).size !== values.length) fail('Duplicate declaration.');
  return values;
}
function freeze(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
}
function inertCopy(input) {
  // canonicalBytes rejects accessors, custom prototypes, undefined, functions,
  // sparse arrays, cycles and invalid Unicode before any field is evaluated.
  try { return JSON.parse(canonicalBytes(input).toString('utf8')); } catch { fail('Definitions require canonical inert JSON.'); }
}
export function definitionHash(source) {
  return crypto.createHash('sha256').update(canonicalBytes({ domain: 'omerta.director.definition.v1', source })).digest('hex');
}
function admit(source) {
  const compiled = freeze({ ...source, contentHash: definitionHash(source) });
  ADMITTED.add(compiled); return compiled;
}
export function verifyDirectorDefinition(definition) {
  if (!ADMITTED.has(definition)) return false;
  const { contentHash, ...source } = definition;
  return contentHash === definitionHash(source);
}

function predicate(input) {
  record(input, ['fact', 'op', 'value']);
  if (!Object.hasOwn(DIRECTOR_FACTS, input.fact)) fail('Unknown canonical fact adapter.');
  choice(input.op, ['eq', 'gte', 'lte', 'present']);
  const type = DIRECTOR_FACTS[input.fact];
  if (input.op === 'present') {
    if (typeof input.value !== 'boolean' || type !== 'nullable_text') fail('Presence applies only to optional canonical references.');
  } else if (type === 'number') integer(input.value, 0, input.fact === 'worldRevision' ? Number.MAX_SAFE_INTEGER : 1000000);
  else {
    if (input.op !== 'eq') fail('Text facts support equality only.');
    if (input.value !== null || type !== 'nullable_text') id(input.value);
  }
  return input;
}
function predicates(input) {
  return unique(array(input, 0, DIRECTOR_LIMITS.facts).map(predicate), (value) => canonicalBytes(value).toString());
}

/** Check satisfiability of this deliberately restricted conjunction language. */
function satisfiable(required, excluded = []) {
  for (const fact of Object.keys(DIRECTOR_FACTS)) {
    const rules = required.filter((rule) => rule.fact === fact);
    const forbidden = excluded.filter((rule) => rule.fact === fact);
    if (DIRECTOR_FACTS[fact] === 'number') {
      let low = 0, high = fact === 'worldRevision' ? Number.MAX_SAFE_INTEGER : 1000000;
      for (const rule of rules) {
        if (rule.op === 'eq' || rule.op === 'gte') low = Math.max(low, rule.value);
        if (rule.op === 'eq' || rule.op === 'lte') high = Math.min(high, rule.value);
      }
      const holes = new Set();
      for (const rule of forbidden) {
        if (rule.op === 'gte') high = Math.min(high, rule.value - 1);
        if (rule.op === 'lte') low = Math.max(low, rule.value + 1);
        if (rule.op === 'eq') holes.add(rule.value);
      }
      if (low > high || high - low + 1 <= holes.size && [...holes].filter((n) => n >= low && n <= high).length === high - low + 1) fail('Impossible canonical fact prerequisites.');
    } else {
      const equal = rules.filter((rule) => rule.op === 'eq').map((rule) => rule.value);
      if (new Set(equal).size > 1) fail('Conflicting canonical fact prerequisites.');
      const presence = rules.filter((rule) => rule.op === 'present').map((rule) => rule.value);
      if (new Set(presence).size > 1) fail('Conflicting presence prerequisites.');
      const unbound = Symbol('unbound canonical text');
      const candidates = equal.length ? equal : presence[0] === false ? [null]
        : DIRECTOR_FACTS[fact] === 'text' || presence[0] === true ? [unbound] : [null, unbound];
      if (!candidates.some((value) => rules.every((rule) => testPredicate(rule, value))
        && forbidden.every((rule) => !testPredicate(rule, value)))) fail('Impossible canonical reference prerequisites.');
    }
  }
}
const testPredicate = (rule, value) => rule.op === 'eq' ? value === rule.value
  : rule.op === 'present' ? (value !== null && value !== undefined) === rule.value
    : rule.op === 'gte' ? value >= rule.value : value <= rule.value;
export function evaluateDirectorPredicate(rule, facts) {
  predicate(rule);
  if (!facts || !Object.hasOwn(facts, rule.fact)) return false;
  const value = facts[rule.fact], type = DIRECTOR_FACTS[rule.fact];
  if (type === 'number' && (!Number.isSafeInteger(value) || value < 0 || value > (rule.fact === 'worldRevision' ? Number.MAX_SAFE_INTEGER : 1000000))) return false;
  if (type === 'text' && typeof value !== 'string' || type === 'nullable_text' && value !== null && typeof value !== 'string') return false;
  return testPredicate(rule, value);
}
export function matchesDirectorFacts(rules, facts) { return rules.every((rule) => evaluateDirectorPredicate(rule, facts)); }
export function evaluateDirectorPressures(inputs, facts) {
  return inputs.map((input) => {
    if (!Object.hasOwn(DIRECTOR_PRESSURES, input)) fail('Unknown pressure input.');
    const definition = DIRECTOR_PRESSURES[input];
    const valid = definition.inputs.every((fact) => Object.hasOwn(facts, fact)
      && (DIRECTOR_FACTS[fact] === 'nullable_text' ? facts[fact] === null || typeof facts[fact] === 'string'
        : Number.isSafeInteger(facts[fact]) && facts[fact] >= 0 && facts[fact] <= 1000000));
    if (!valid) return { id: input, valuePermille: 0, available: false, facts: definition.inputs };
    const ratio = input === 'resourceDeficit' ? facts.resourceDemand === 0 ? 0
      : Math.max(0, facts.resourceDemand - facts.resourceQuantity) / facts.resourceDemand
      : input === 'territoryControl' ? facts.controllerFamilyId === null ? 0 : 1
        : input === 'operationFailure' ? facts.completedOperations + facts.failedOperations === 0 ? 0
          : facts.failedOperations / (facts.completedOperations + facts.failedOperations)
          : Math.min(1, facts.discoveredSources / 32);
    return { id: input, valuePermille: Math.floor(Math.min(1, Math.max(0, ratio)) * 1000), available: true, facts: definition.inputs };
  });
}
function cooldown(value) {
  record(value, ['seconds', 'quietSeconds', 'repetitionWindowSeconds', 'maximumPerWindow']);
  integer(value.seconds, 60, 15552000); integer(value.quietSeconds, 0, value.seconds);
  integer(value.repetitionWindowSeconds, value.seconds, 15552000); integer(value.maximumPerWindow, 1, 16);
  return value;
}
function recovery(value, states = null) {
  record(value, ['on', 'policy', 'to', 'maxAttempts', 'afterSeconds']);
  unique(array(value.on, DIRECTOR_RECOVERY_TRIGGERS.length, DIRECTOR_RECOVERY_TRIGGERS.length));
  value.on.forEach((trigger) => choice(trigger, DIRECTOR_RECOVERY_TRIGGERS));
  choice(value.policy, ['expire']); id(value.to);
  // expire is one terminal receipt. A retry/rebind policy requires an actual
  // runtime adapter before authors can declare additional attempts or delays.
  integer(value.maxAttempts, 1, 1); integer(value.afterSeconds, 60, 15552000);
  if (states && !states.includes(value.to)) fail('Recovery requires a terminal destination.');
  return value;
}
function dag(nodes, edges, entry, terminals) {
  const ids = new Set(nodes), terminal = new Set(terminals), adjacent = new Map(nodes.map((node) => [node, []]));
  for (const edge of edges) {
    if (!ids.has(edge.from) || !ids.has(edge.to) || terminal.has(edge.from)) fail('Invalid or conflicting terminal transition.');
    adjacent.get(edge.from).push(edge.to);
  }
  if (!ids.has(entry) || !terminal.size) fail('Missing entry or terminal state.');
  const visiting = new Set(), seen = new Set();
  function visit(node) {
    if (visiting.has(node)) fail('Circular or unbounded progression.');
    if (seen.has(node)) return;
    visiting.add(node);
    if (!terminal.has(node) && !adjacent.get(node).length) fail('Progression dead end.');
    adjacent.get(node).forEach(visit); visiting.delete(node); seen.add(node);
  }
  visit(entry);
  if (seen.size !== ids.size) fail('Unreachable progression state.');
}

function catalogMap(values = []) {
  array(values, 0, 100);
  unique(values, (entry) => entry.id);
  return new Map(values.map((entry) => [entry.id, entry]));
}
function worldPredicates(rules, world) {
  for (const rule of rules) {
    if (rule.fact === 'worldState' && !world.states.includes(rule.value)) fail('Unknown canonical world state.');
    if (rule.fact === 'priorWorldAction' && rule.value !== null && !world.actions.some((action) => action.id === rule.value)) fail('Unknown canonical action history.');
    if (rule.fact === 'priorOutcome' && rule.value !== null && !world.states.includes(rule.value)) fail('Unknown canonical outcome history.');
  }
}

export function compileSituationDefinitions(inputs, catalog = {}) {
  const sources = inertCopy(inputs); array(sources, 0, DIRECTOR_LIMITS.definitions); unique(sources, (source) => source.id);
  const worlds = catalogMap(catalog.worldDefinitions), operations = catalogMap(catalog.operationDefinitions);
  const profiles = catalogMap(catalog.coordinationProfiles), mysteries = catalogMap(catalog.mysteryDefinitions);
  const knowledge = (catalog.knowledgeSources || []).map((requirement) => canonicalBytes(normalizeKnowledgeRequirement(requirement)).toString());
  return Object.freeze(sources.map((source) => {
    record(source, ['id', 'version', 'category', 'scope', 'objectId', 'eligibility', 'pressureInputs',
      'requiredWorldFacts', 'excludedWorldFacts', 'audiences', 'initialSignals', 'states', 'initialState',
      'terminalStates', 'possibleEscalations', 'possibleResolutions', 'expiryPolicy', 'recoveryPolicy',
      'cooldownPolicy', 'consequenceContracts', 'commandAdapters', 'coordinationAdapters', 'mysteryAdapters',
      'rarity', 'weight', 'concurrencyPolicy', 'participants']);
    id(source.id); integer(source.version, 1, 2147483647);
    choice(source.category, ['territory', 'economic', 'social', 'criminal', 'information', 'operational', 'world_history']);
    choice(source.scope, ['territory']); id(source.objectId);
    const world = worlds.get(source.objectId);
    if (!world || !/^[a-f0-9]{64}$/.test(world.contentHash)) fail('Situation must bind an admitted canonical world object.');
    predicates(source.eligibility); predicates(source.requiredWorldFacts); predicates(source.excludedWorldFacts);
    satisfiable([...source.eligibility, ...source.requiredWorldFacts], source.excludedWorldFacts);
    worldPredicates([...source.eligibility, ...source.requiredWorldFacts, ...source.excludedWorldFacts], world);
    unique(array(source.pressureInputs, 1, 4)); source.pressureInputs.forEach((input) => choice(input, Object.keys(DIRECTOR_PRESSURES)));
    const audiences = new Map();
    for (const audience of array(source.audiences, 1, DIRECTOR_LIMITS.audiences)) {
      record(audience, ['id', 'kind', 'knowledge']); id(audience.id);
      choice(audience.kind, ['controller_family', 'rival_family', 'crew', 'informed', 'public']);
      if (audiences.has(audience.id)) fail('Duplicate audience.');
      if (audience.knowledge !== null) {
        if (audience.kind === 'public') fail('Public audiences cannot carry private knowledge.');
        let normalized;
        try { normalized = normalizeKnowledgeRequirement(audience.knowledge); } catch { fail('Invalid knowledge adapter.'); }
        if (!knowledge.includes(canonicalBytes(normalized).toString())) fail('Unknown exact knowledge source.');
        audience.knowledge = normalized;
      } else if (audience.kind === 'informed') fail('Informed audiences require an exact knowledge source.');
      audiences.set(audience.id, audience);
    }
    unique(array(source.states, 2, DIRECTOR_LIMITS.states)); source.states.forEach(id); id(source.initialState);
    unique(array(source.terminalStates, 1, DIRECTOR_LIMITS.states));
    if (source.terminalStates.some((state) => !source.states.includes(state)) || source.terminalStates.includes(source.initialState)) fail('Invalid terminal declaration.');
    const consequences = new Map();
    for (const consequence of array(source.consequenceContracts, 1, DIRECTOR_LIMITS.adapters)) {
      record(consequence, ['id', 'adapter', 'objectId', 'actionId', 'fromState', 'toState', 'economicEffects']);
      id(consequence.id); choice(consequence.adapter, ['world_action']); choice(consequence.economicEffects, ['existing_action_only']);
      const action = world.actions.find((entry) => entry.id === consequence.actionId);
      if (consequences.has(consequence.id) || consequence.objectId !== world.id || !action
        || action.from !== consequence.fromState || action.to !== consequence.toState) fail('Unknown or contradictory canonical consequence.');
      consequences.set(consequence.id, consequence);
    }
    const edges = [];
    unique(array(source.possibleEscalations, 0, DIRECTOR_LIMITS.transitions), (entry) => entry.id);
    for (const escalation of source.possibleEscalations) {
      record(escalation, ['id', 'from', 'to', 'afterSeconds', 'when']); id(escalation.id);
      integer(escalation.afterSeconds, 1, 15552000); predicates(escalation.when); satisfiable(escalation.when); worldPredicates(escalation.when, world);
      edges.push(escalation);
    }
    unique(array(source.possibleResolutions, 1, DIRECTOR_LIMITS.transitions), (entry) => entry.id);
    unique([...source.possibleEscalations, ...source.possibleResolutions], (entry) => entry.id);
    const usedConsequences = new Set();
    for (const resolution of source.possibleResolutions) {
      record(resolution, ['id', 'from', 'to', 'consequenceId']); id(resolution.id);
      unique(array(resolution.from, 1, DIRECTOR_LIMITS.states));
      if (!source.terminalStates.includes(resolution.to) || !consequences.has(resolution.consequenceId)
        || usedConsequences.has(resolution.consequenceId)) fail('A canonical outcome must have exactly one terminal interpretation.');
      usedConsequences.add(resolution.consequenceId);
      for (const from of resolution.from) edges.push({ from, to: resolution.to });
    }
    if (usedConsequences.size !== consequences.size) fail('Unused consequence contract.');
    record(source.expiryPolicy, ['afterSeconds', 'to']); integer(source.expiryPolicy.afterSeconds, 60, 15552000);
    if (!source.terminalStates.includes(source.expiryPolicy.to)) fail('Expiry must be terminal.');
    recovery(source.recoveryPolicy, source.terminalStates); cooldown(source.cooldownPolicy);
    if (source.recoveryPolicy.afterSeconds !== source.expiryPolicy.afterSeconds) fail('Expire recovery must use the implemented expiry deadline.');
    for (const state of source.states.filter((entry) => !source.terminalStates.includes(entry))) {
      edges.push({ from: state, to: source.expiryPolicy.to }, { from: state, to: source.recoveryPolicy.to });
    }
    dag(source.states, edges, source.initialState, source.terminalStates);
    record(source.participants, ['minimumPlayers', 'minimumFamilies', 'minimumCrews']);
    integer(source.participants.minimumPlayers, 1, 32); integer(source.participants.minimumFamilies, 0, 8);
    integer(source.participants.minimumCrews, 0, 8);
    if (source.participants.minimumFamilies > source.participants.minimumPlayers || source.participants.minimumCrews > source.participants.minimumPlayers) fail('Impossible participant requirements.');
    satisfiable([...source.eligibility, ...source.requiredWorldFacts,
      { fact: 'activePlayers', op: 'gte', value: source.participants.minimumPlayers },
      { fact: 'activeFamilies', op: 'gte', value: source.participants.minimumFamilies },
      { fact: 'activeCrews', op: 'gte', value: source.participants.minimumCrews }], source.excludedWorldFacts);
    record(source.concurrencyPolicy, ['global', 'perScope', 'perPlayer', 'perCrew', 'perFamily', 'perTerritory']);
    for (const [key, value] of Object.entries(source.concurrencyPolicy)) integer(value, 1, key === 'global' ? 100 : 8);
    if (Object.values(source.concurrencyPolicy).some((value) => value > source.concurrencyPolicy.global)) fail('Local budget exceeds global budget.');
    choice(source.rarity, ['common', 'uncommon', 'rare']); integer(source.weight, 1, 1000);
    unique(array(source.coordinationAdapters, 0, DIRECTOR_LIMITS.adapters), (entry) => entry.id);
    for (const adapter of source.coordinationAdapters) {
      record(adapter, ['id', 'kind', 'definitionId']); id(adapter.id); choice(adapter.kind, ['family_operation', 'crew_profile']);
      const target = (adapter.kind === 'family_operation' ? operations : profiles).get(adapter.definitionId);
      if (!target || adapter.kind === 'family_operation' && target.world.objectId !== world.id) fail('Unknown coordination adapter.');
      if (adapter.kind === 'family_operation' && target.roles.length > source.participants.minimumPlayers) fail('Required operation roles exceed eligible population.');
    }
    unique(array(source.mysteryAdapters, 0, DIRECTOR_LIMITS.adapters), (entry) => entry.id);
    for (const adapter of source.mysteryAdapters) {
      record(adapter, ['id', 'graphId', 'nodeId']); id(adapter.id);
      const target = mysteries.get(adapter.graphId);
      if (!target || !target.nodes.some((node) => node.id === adapter.nodeId)) fail('Unknown authored mystery adapter.');
    }
    const commands = new Map();
    for (const adapter of array(source.commandAdapters, 1, DIRECTOR_LIMITS.adapters)) {
      record(adapter, ['id', 'commandType', 'targetId', 'audienceId']); id(adapter.id); id(adapter.targetId);
      choice(adapter.commandType, DIRECTOR_COMMAND_TYPES);
      if (commands.has(adapter.id) || !audiences.has(adapter.audienceId)) fail('Unknown command audience or duplicate adapter.');
      if (adapter.commandType.startsWith('discovery.') && !profiles.has(adapter.targetId)
        || adapter.commandType === 'operation.create' && !source.coordinationAdapters.some((entry) => entry.kind === 'family_operation' && entry.definitionId === adapter.targetId)
        || adapter.commandType === 'world.execute' && !world.actions.some((entry) => entry.id === adapter.targetId && entry.execution !== 'family_operation')
        || adapter.commandType === 'mystery.start' && !mysteries.has(adapter.targetId)
        || adapter.commandType === 'knowledge.share' && !profiles.has(adapter.targetId)) fail('Command does not resolve to an existing authority.');
      commands.set(adapter.id, adapter);
    }
    unique(array(source.initialSignals, 1, DIRECTOR_LIMITS.signals), (entry) => entry.id);
    for (const signal of source.initialSignals) {
      record(signal, ['id', 'audienceId', 'title', 'description', 'knowledgeLevel', 'commandAdapterIds']); id(signal.id);
      text(signal.title, 120); text(signal.description); choice(signal.knowledgeLevel, ['rumor', 'known', 'public']);
      const audience = audiences.get(signal.audienceId);
      if (!audience || (audience.kind === 'public') !== (signal.knowledgeLevel === 'public')
        || signal.knowledgeLevel === 'known' && !audience.knowledge) fail('Signal disclosure exceeds its audience authority.');
      unique(array(signal.commandAdapterIds, 0, DIRECTOR_LIMITS.adapters));
      if (signal.commandAdapterIds.some((command) => commands.get(command)?.audienceId !== signal.audienceId)) fail('Signal leaks another audience objective.');
      if (/\$\{|\{\{|contentHash|definitionHash|valuePermille|pressureInputs/.test(`${signal.title} ${signal.description}`)) fail('Signals cannot interpolate canonical or scheduler internals.');
    }
    // Dependency pins change when an authority changes even when source text does not.
    const dependencyHashes = { world: world.contentHash,
      operations: source.coordinationAdapters.filter((entry) => entry.kind === 'family_operation').map((entry) => ({ id: entry.definitionId, hash: operations.get(entry.definitionId).contentHash })),
      profiles: [...new Set(source.commandAdapters.filter((entry) => entry.commandType.startsWith('discovery.') || entry.commandType === 'knowledge.share').map((entry) => entry.targetId))]
        .map((profileId) => ({ id: profileId, hash: profiles.get(profileId).contentHash })),
      mysteries: [...new Set(source.mysteryAdapters.map((entry) => entry.graphId))].map((graphId) => ({ id: graphId, hash: mysteries.get(graphId).contentHash })),
    };
    for (const dependency of [...dependencyHashes.operations, ...dependencyHashes.profiles, ...dependencyHashes.mysteries]) {
      if (!/^[a-f0-9]{64}$/.test(dependency.hash)) fail('Dependency lacks an admitted content hash.');
    }
    return admit({ ...source, dependencyHashes });
  }));
}

export function compileCampaignDefinitions(inputs, situations) {
  const sources = inertCopy(inputs); array(sources, 0, DIRECTOR_LIMITS.definitions); unique(sources, (source) => source.id);
  const catalog = catalogMap(situations);
  if (situations.some((entry) => !verifyDirectorDefinition(entry))) fail('Campaign situations must be admitted definitions.');
  return Object.freeze(sources.map((source) => {
    record(source, ['id', 'version', 'title', 'entryNode', 'nodes', 'branches', 'maxDurationSeconds', 'recoveryPolicy', 'cooldownPolicy', 'maxActive']);
    id(source.id); integer(source.version, 1, 2147483647); text(source.title, 120); id(source.entryNode);
    integer(source.maxDurationSeconds, 3600, 15552000); integer(source.maxActive, 1, 16);
    cooldown(source.cooldownPolicy); recovery(source.recoveryPolicy);
    if (source.recoveryPolicy.afterSeconds !== source.maxDurationSeconds) fail('Campaign recovery must use the implemented campaign deadline.');
    if (source.recoveryPolicy.to !== 'abandoned') fail('Campaign recovery must retain an abandoned receipt.');
    unique(array(source.nodes, 1, DIRECTOR_LIMITS.campaignNodes), (node) => node.id);
    const nodes = new Map();
    for (const node of source.nodes) {
      record(node, ['id', 'situationId', 'terminal']); id(node.id);
      if (typeof node.terminal !== 'boolean' || !catalog.has(node.situationId)) fail('Unknown campaign situation.');
      nodes.set(node.id, node);
    }
    unique(array(source.branches, 0, DIRECTOR_LIMITS.campaignBranches), (branch) => branch.id);
    for (const branch of source.branches) {
      record(branch, ['id', 'from', 'to', 'outcome', 'when']); id(branch.id); id(branch.outcome);
      predicates(branch.when); satisfiable(branch.when);
      const definition = catalog.get(nodes.get(branch.from)?.situationId);
      const destination = catalog.get(nodes.get(branch.to)?.situationId);
      const resolution = definition?.possibleResolutions.find((entry) => entry.id === branch.outcome);
      if (!resolution || !destination) fail('Campaign branch must follow a real canonical outcome.');
      const consequence = definition.consequenceContracts.find((entry) => entry.id === resolution.consequenceId);
      if (definition.objectId !== destination.objectId) fail('Campaign branches require the same bounded canonical scope.');
      satisfiable([{ fact: 'worldState', op: 'eq', value: consequence.toState }, ...branch.when,
        ...destination.eligibility, ...destination.requiredWorldFacts], destination.excludedWorldFacts);
    }
    const sameOutcome = new Map();
    for (const branch of source.branches) {
      const key = `${branch.from}/${branch.outcome}`;
      // One canonical outcome chooses one next node. Additional branching must be
      // expressed by another finite situation, never ambiguous equal-priority edges.
      if (sameOutcome.has(key)) fail('Conflicting campaign outcome branches.');
      sameOutcome.set(key, branch.id);
    }
    dag(source.nodes.map((node) => node.id), source.branches, source.entryNode,
      source.nodes.filter((node) => node.terminal).map((node) => node.id));
    return admit({ ...source, situationHashes: source.nodes.map((node) => ({ id: node.situationId, hash: catalog.get(node.situationId).contentHash })) });
  }));
}

export function compileDirectorDefinitions(input, catalog) {
  record(input, ['situations', 'campaigns']);
  const situations = compileSituationDefinitions(input.situations, catalog);
  return Object.freeze({ situations, campaigns: compileCampaignDefinitions(input.campaigns, situations) });
}
