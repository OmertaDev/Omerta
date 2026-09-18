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
  historicalSamples: 'number', shortageWindows: 'number', repeatedFamilyFailures: 'number',
  dominanceSeconds: 'number', recentTerritoryChanges: 'number', recentMysteryDiscoveries: 'number',
  peacefulResolutions: 'number', violentEvents: 'number', recentActivity: 'number', historyAvailable: 'number',
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
  instability: Object.freeze({ category: 'family', inputs: Object.freeze(['historyAvailable', 'repeatedFamilyFailures', 'recentTerritoryChanges']),
    semantics: 'Verified recent failures and control changes, capped at eight; unavailable history contributes zero.' }),
  smuggling: Object.freeze({ category: 'economic', inputs: Object.freeze(['historyAvailable', 'shortageWindows']),
    semantics: 'Six-hour canonical shortage observations within seven days, capped at eight.' }),
  resistance: Object.freeze({ category: 'territory', inputs: Object.freeze(['historyAvailable', 'dominanceSeconds', 'activeFamilies', 'recentActivity']),
    semantics: 'Observed continuous control up to seven days, only with active rivals and recent canonical activity.' }),
  law: Object.freeze({ category: 'law', inputs: Object.freeze(['historyAvailable', 'violentEvents']),
    semantics: 'Authored violence labels on committed world events within seven days, capped at eight.' }),
  diplomacy: Object.freeze({ category: 'family', inputs: Object.freeze(['historyAvailable', 'peacefulResolutions']),
    semantics: 'Authored peaceful labels on committed world events within seven days, capped at eight.' }),
  investigation: Object.freeze({ category: 'information', inputs: Object.freeze(['historyAvailable', 'recentMysteryDiscoveries']),
    semantics: 'Authenticated recent discovery sources, capped at 32; unavailable history contributes zero.' }),
});
const factMaximum = (fact) => fact === 'worldRevision' ? Number.MAX_SAFE_INTEGER
  : ({ historicalSamples: 28, shortageWindows: 28, repeatedFamilyFailures: 128, dominanceSeconds: 604800,
    recentTerritoryChanges: 31, recentMysteryDiscoveries: 32, peacefulResolutions: 32, violentEvents: 32,
    recentActivity: 192, historyAvailable: 1 }[fact] ?? 1000000);
export const COMPETITION_CLASSES = Object.freeze(['EXCLUSIVE', 'CONTESTED', 'COOPERATIVE', 'PARALLEL', 'SECRET', 'ESCALATING', 'CASCADE']);
export const INFORMATION_LAYERS = Object.freeze(['PUBLIC_SIGNAL', 'LOCAL_RUMOR', 'FAMILY_INTELLIGENCE', 'CREW_INTELLIGENCE',
  'DISCOVERED_INTELLIGENCE', 'SECRET_KNOWLEDGE', 'PUBLIC_AFTERMATH']);
export const CONSEQUENCE_KINDS = Object.freeze(['territory_control', 'route_access', 'infrastructure', 'material_availability',
  'family_relations', 'law_pressure', 'knowledge', 'evidence', 'operation_availability']);
export const DIRECTOR_RECOVERY_TRIGGERS = Object.freeze(['participant_unavailable', 'crew_dissolved',
  'membership_changed', 'item_lost', 'expiry', 'restart', 'season_changed']);
// Other player commands are derived by their existing authority. A Director
// adapter needs a complete, presently implemented target shape.
export const DIRECTOR_COMMAND_TYPES = Object.freeze(['discovery.start', 'operation.create', 'mystery.start']);

export class DirectorDefinitionError extends Error {
  constructor(message) { super(message); this.name = 'DirectorDefinitionError'; this.code = 'bad_director_definition'; }
}
function atField(field, work) {
  try { return work(); } catch (error) {
    if (error instanceof DirectorDefinitionError && !error.field) error.field = field;
    throw error;
  }
}
function atDefinition(kind, source, work) {
  const context = { field: 'definition' };
  try { return work(context); } catch (error) {
    if (error instanceof DirectorDefinitionError) {
      error.definitionId = source.id; error.definitionKind = kind; error.field ||= context.field;
      error.message = `${kind} ${source.id || '(unnamed)'}, field ${error.field}: ${error.message}`;
    }
    throw error;
  }
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
function playerText(value, maximum = 600) {
  text(value, maximum);
  if (/\$\{|\{\{|contentHash|definitionHash|definition_hash|dependencyHashes|valuePermille|pressureInputs|selectorWeight|worldRevision|world_revision|director_receipts|starting_world_revision/.test(value))
    fail('Player text cannot expose canonical or scheduler internals.');
  return value;
}
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
  } else if (type === 'number') integer(input.value, 0, factMaximum(input.fact));
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
      let low = 0, high = factMaximum(fact);
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
  if (type === 'number' && (!Number.isSafeInteger(value) || value < 0 || value > factMaximum(rule.fact))) return false;
  if (type === 'text' && typeof value !== 'string' || type === 'nullable_text' && value !== null && typeof value !== 'string') return false;
  return testPredicate(rule, value);
}
export function matchesDirectorFacts(rules, facts) { return rules.every((rule) => evaluateDirectorPredicate(rule, facts)); }
function pressureRatio(input, facts) {
  if (input === 'resourceDeficit') return facts.resourceDemand ? Math.max(0, facts.resourceDemand - facts.resourceQuantity) / facts.resourceDemand : 0;
  if (input === 'territoryControl') return facts.controllerFamilyId === null ? 0 : 1;
  if (input === 'operationFailure') return facts.completedOperations + facts.failedOperations
    ? facts.failedOperations / (facts.completedOperations + facts.failedOperations) : 0;
  if (input === 'discoveryActivity') return facts.discoveredSources / 32;
  if (facts.historyAvailable !== 1) return 0;
  if (input === 'instability') return (facts.repeatedFamilyFailures + facts.recentTerritoryChanges) / 8;
  if (input === 'smuggling') return facts.shortageWindows / 8;
  if (input === 'resistance') return facts.activeFamilies > 1 && facts.recentActivity > 0 ? facts.dominanceSeconds / 604800 : 0;
  if (input === 'law') return facts.violentEvents / 8;
  if (input === 'diplomacy') return facts.peacefulResolutions / 8;
  if (input === 'investigation') return facts.recentMysteryDiscoveries / 32;
  return 0;
}
export function evaluateDirectorPressures(inputs, facts) {
  return inputs.map((input) => {
    if (!Object.hasOwn(DIRECTOR_PRESSURES, input)) fail('Unknown pressure input.');
    const definition = DIRECTOR_PRESSURES[input];
    const valid = definition.inputs.every((fact) => Object.hasOwn(facts, fact)
      && (DIRECTOR_FACTS[fact] === 'nullable_text' ? facts[fact] === null || typeof facts[fact] === 'string'
        : Number.isSafeInteger(facts[fact]) && facts[fact] >= 0 && facts[fact] <= factMaximum(fact)));
    if (!valid) return { id: input, valuePermille: 0, available: false, facts: definition.inputs };
    const ratio = pressureRatio(input, facts);
    return { id: input, valuePermille: Math.floor(Math.min(1, Math.max(0, ratio)) * 1000), available: true, facts: definition.inputs };
  });
}

// Optional for existing immutable definitions; required by network authors. This
// is descriptive content and read dependencies, never a new execution authority.
function networkContract(source, worlds, world) {
  const n = source.network;
  record(n, ['competition', 'domains', 'relatedWorld', 'information', 'implications']);
  atField('network.competition', () => {
    unique(array(n.competition, 1, COMPETITION_CLASSES.length)).forEach((value) => choice(value, COMPETITION_CLASSES));
    if (n.competition.includes('EXCLUSIVE') && n.competition.includes('PARALLEL')) fail('Exclusive and parallel ownership conflict.');
    if (n.competition.includes('SECRET') && source.audiences.some((a) => !a.knowledge)) fail('Secret opportunities require knowledge for every audience.');
    if (n.competition.includes('COOPERATIVE') && (source.participants.minimumPlayers < 2 || !source.coordinationAdapters.length)) fail('Cooperation needs participants and a coordination authority.');
    if (n.competition.includes('ESCALATING') && !source.possibleEscalations.length) fail('Escalation needs a bounded transition.');
    if (n.competition.includes('CASCADE') && !n.implications.length) fail('Cascade needs a canonical implication.');
  });
  atField('network.domains', () => unique(array(n.domains, 1, 6)).forEach((value) => choice(value,
    ['territory', 'family', 'economy', 'law', 'mystery', 'infrastructure'])));
  atField('network.relatedWorld', () => {
    unique(array(n.relatedWorld, 0, 8), (rule) => rule.objectId);
    for (const rule of n.relatedWorld) {
      record(rule, ['objectId', 'states']); const dependency = worlds.get(rule.objectId);
      if (!dependency || rule.objectId === world.id) fail('Related prerequisites require another admitted world object.');
      unique(array(rule.states, 1, 16));
      if (rule.states.some((state) => !dependency.states.includes(state))) fail('Unknown related world state.');
    }
  });
  atField('network.information', () => {
    unique(array(n.information, source.initialSignals.length, source.initialSignals.length), (entry) => entry.signalId);
    for (const entry of n.information) {
      record(entry, ['signalId', 'layer', 'whyKnown', 'stakes']);
      const signal = source.initialSignals.find((s) => s.id === entry.signalId);
      const audience = source.audiences.find((a) => a.id === signal?.audienceId);
      if (!signal || !audience) fail('Information must name an authorized signal.');
      choice(entry.layer, INFORMATION_LAYERS); playerText(entry.whyKnown); playerText(entry.stakes);
      const publicLayer = ['PUBLIC_SIGNAL', 'PUBLIC_AFTERMATH'].includes(entry.layer);
      if (publicLayer !== (audience.kind === 'public')) fail('Information layer exceeds its audience.');
      if (entry.layer === 'LOCAL_RUMOR' && signal.knowledgeLevel !== 'rumor') fail('Local rumor must be a rumor signal.');
      if (!publicLayer && entry.layer !== 'LOCAL_RUMOR' && !audience.knowledge) fail('Intelligence requires exact knowledge.');
      if (entry.layer === 'FAMILY_INTELLIGENCE' && !['controller_family', 'rival_family'].includes(audience.kind)) fail('Family intelligence requires a Family audience.');
      if (entry.layer === 'CREW_INTELLIGENCE' && audience.kind !== 'crew') fail('Crew intelligence requires a Crew audience.');
      if (entry.layer === 'PUBLIC_AFTERMATH' && !source.eligibility.some((rule) => rule.fact === 'worldState'
        && rule.op === 'eq' && world.publicStates.includes(rule.value) && rule.value !== world.initialState)) fail('Public aftermath requires a public canonical consequence state.');
    }
  });
  atField('network.implications', () => {
    unique(array(n.implications, 0, 32), (entry) => `${entry.consequenceId}/${entry.kind}`);
    for (const entry of n.implications) {
      record(entry, ['consequenceId', 'kind', ...(Object.hasOwn(entry, 'signals') ? ['signals'] : [])]);
      if (!source.consequenceContracts.some((c) => c.id === entry.consequenceId)) fail('Implication requires an existing canonical consequence.');
      choice(entry.kind, CONSEQUENCE_KINDS);
      if (entry.signals) unique(array(entry.signals, 0, 4)).forEach((signal) => choice(signal, ['violence', 'peaceful', 'route_disruption', 'investigation']));
    }
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
  return Object.freeze(sources.map((source) => atDefinition('situation', source, (context) => {
    record(source, ['id', 'version', 'category', 'scope', 'objectId', 'eligibility', 'pressureInputs',
      'requiredWorldFacts', 'excludedWorldFacts', 'audiences', 'initialSignals', 'states', 'initialState',
      'terminalStates', 'possibleEscalations', 'possibleResolutions', 'expiryPolicy', 'recoveryPolicy',
      'cooldownPolicy', 'consequenceContracts', 'commandAdapters', 'coordinationAdapters', 'mysteryAdapters',
      'rarity', 'weight', 'concurrencyPolicy', 'participants', ...(Object.hasOwn(source, 'network') ? ['network'] : [])]);
    context.field = 'id'; id(source.id); context.field = 'version'; integer(source.version, 1, 2147483647);
    context.field = 'category';
    choice(source.category, ['territory', 'economic', 'social', 'criminal', 'information', 'operational', 'world_history', 'family', 'law', 'mystery', 'infrastructure']);
    context.field = 'scope'; choice(source.scope, ['territory']); context.field = 'objectId'; id(source.objectId);
    const world = worlds.get(source.objectId);
    if (!world || !/^[a-f0-9]{64}$/.test(world.contentHash)) fail('Situation must bind an admitted canonical world object.');
    atField('eligibility', () => predicates(source.eligibility));
    atField('requiredWorldFacts', () => predicates(source.requiredWorldFacts));
    atField('excludedWorldFacts', () => predicates(source.excludedWorldFacts));
    context.field = 'eligibility'; satisfiable([...source.eligibility, ...source.requiredWorldFacts], source.excludedWorldFacts);
    worldPredicates([...source.eligibility, ...source.requiredWorldFacts, ...source.excludedWorldFacts], world);
    atField('pressureInputs', () => unique(array(source.pressureInputs, 1, Object.keys(DIRECTOR_PRESSURES).length))
      .forEach((input) => choice(input, Object.keys(DIRECTOR_PRESSURES))));
    context.field = 'audiences'; const audiences = new Map();
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
    context.field = 'states'; unique(array(source.states, 2, DIRECTOR_LIMITS.states)); source.states.forEach(id); id(source.initialState);
    unique(array(source.terminalStates, 1, DIRECTOR_LIMITS.states));
    if (source.terminalStates.some((state) => !source.states.includes(state)) || source.terminalStates.includes(source.initialState)) fail('Invalid terminal declaration.');
    context.field = 'consequenceContracts'; const consequences = new Map();
    for (const consequence of array(source.consequenceContracts, 1, DIRECTOR_LIMITS.adapters)) {
      record(consequence, ['id', 'adapter', 'objectId', 'actionId', 'fromState', 'toState', 'economicEffects']);
      id(consequence.id); choice(consequence.adapter, ['world_action']); choice(consequence.economicEffects, ['existing_action_only']);
      const action = world.actions.find((entry) => entry.id === consequence.actionId);
      if (consequences.has(consequence.id) || consequence.objectId !== world.id || !action
        || action.from !== consequence.fromState || action.to !== consequence.toState) fail('Unknown or contradictory canonical consequence.');
      consequences.set(consequence.id, consequence);
    }
    context.field = 'possibleEscalations'; const edges = [];
    unique(array(source.possibleEscalations, 0, DIRECTOR_LIMITS.transitions), (entry) => entry.id);
    for (const escalation of source.possibleEscalations) {
      record(escalation, ['id', 'from', 'to', 'afterSeconds', 'when']); id(escalation.id);
      integer(escalation.afterSeconds, 1, 15552000); predicates(escalation.when); satisfiable(escalation.when); worldPredicates(escalation.when, world);
      edges.push(escalation);
    }
    context.field = 'possibleResolutions'; unique(array(source.possibleResolutions, 1, DIRECTOR_LIMITS.transitions), (entry) => entry.id);
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
    context.field = 'expiryPolicy'; record(source.expiryPolicy, ['afterSeconds', 'to']); integer(source.expiryPolicy.afterSeconds, 60, 15552000);
    if (!source.terminalStates.includes(source.expiryPolicy.to)) fail('Expiry must be terminal.');
    context.field = 'recoveryPolicy'; recovery(source.recoveryPolicy, source.terminalStates);
    atField('cooldownPolicy', () => cooldown(source.cooldownPolicy));
    if (source.recoveryPolicy.afterSeconds !== source.expiryPolicy.afterSeconds) fail('Expire recovery must use the implemented expiry deadline.');
    atField('possibleEscalations', () => {
      const earliest = new Map([[source.initialState, 0]]);
      for (let pass = 0; pass < source.states.length; pass++) for (const edge of source.possibleEscalations) {
        if (!earliest.has(edge.from)) continue;
        earliest.set(edge.to, Math.min(earliest.get(edge.to) ?? Infinity, earliest.get(edge.from) + edge.afterSeconds));
      }
      for (const edge of source.possibleEscalations)
        if (!earliest.has(edge.from) || earliest.get(edge.from) + edge.afterSeconds >= source.expiryPolicy.afterSeconds)
          fail('Escalation cannot occur before its expiry.');
    });
    for (const state of source.states.filter((entry) => !source.terminalStates.includes(entry))) {
      edges.push({ from: state, to: source.expiryPolicy.to }, { from: state, to: source.recoveryPolicy.to });
    }
    context.field = 'states'; dag(source.states, edges, source.initialState, source.terminalStates);
    context.field = 'participants';
    record(source.participants, ['minimumPlayers', 'minimumFamilies', 'minimumCrews']);
    integer(source.participants.minimumPlayers, 1, 32); integer(source.participants.minimumFamilies, 0, 8);
    integer(source.participants.minimumCrews, 0, 8);
    if (source.participants.minimumFamilies > source.participants.minimumPlayers || source.participants.minimumCrews > source.participants.minimumPlayers) fail('Impossible participant requirements.');
    satisfiable([...source.eligibility, ...source.requiredWorldFacts,
      { fact: 'activePlayers', op: 'gte', value: source.participants.minimumPlayers },
      { fact: 'activeFamilies', op: 'gte', value: source.participants.minimumFamilies },
      { fact: 'activeCrews', op: 'gte', value: source.participants.minimumCrews }], source.excludedWorldFacts);
    context.field = 'concurrencyPolicy'; record(source.concurrencyPolicy, ['global', 'perScope', 'perPlayer', 'perCrew', 'perFamily', 'perTerritory']);
    for (const [key, value] of Object.entries(source.concurrencyPolicy)) integer(value, 1, key === 'global' ? 100 : 8);
    if (Object.values(source.concurrencyPolicy).some((value) => value > source.concurrencyPolicy.global)) fail('Local budget exceeds global budget.');
    context.field = 'rarity'; choice(source.rarity, ['common', 'uncommon', 'rare']); context.field = 'weight'; integer(source.weight, 1, 1000);
    context.field = 'coordinationAdapters';
    unique(array(source.coordinationAdapters, 0, DIRECTOR_LIMITS.adapters), (entry) => entry.id);
    for (const adapter of source.coordinationAdapters) {
      record(adapter, ['id', 'kind', 'definitionId']); id(adapter.id); choice(adapter.kind, ['family_operation', 'crew_profile']);
      const target = (adapter.kind === 'family_operation' ? operations : profiles).get(adapter.definitionId);
      if (!target || adapter.kind === 'family_operation' && target.world.objectId !== world.id) fail('Unknown coordination adapter.');
      if (adapter.kind === 'family_operation' && target.roles.length > source.participants.minimumPlayers) fail('Required operation roles exceed eligible population.');
    }
    context.field = 'mysteryAdapters'; unique(array(source.mysteryAdapters, 0, DIRECTOR_LIMITS.adapters), (entry) => entry.id);
    for (const adapter of source.mysteryAdapters) {
      record(adapter, ['id', 'graphId', 'nodeId']); id(adapter.id);
      const target = mysteries.get(adapter.graphId);
      if (!target || !target.nodes.some((node) => node.id === adapter.nodeId)) fail('Unknown authored mystery adapter.');
    }
    context.field = 'commandAdapters'; const commands = new Map();
    for (const adapter of array(source.commandAdapters, 1, DIRECTOR_LIMITS.adapters)) {
      record(adapter, ['id', 'commandType', 'targetId', 'audienceId']); id(adapter.id); id(adapter.targetId);
      choice(adapter.commandType, DIRECTOR_COMMAND_TYPES);
      if (commands.has(adapter.id) || !audiences.has(adapter.audienceId)) fail('Unknown command audience or duplicate adapter.');
      if (adapter.commandType.startsWith('discovery.') && !profiles.has(adapter.targetId)
        || adapter.commandType === 'operation.create' && !source.coordinationAdapters.some((entry) => entry.kind === 'family_operation' && entry.definitionId === adapter.targetId)
        || adapter.commandType === 'world.execute' && !world.actions.some((entry) => entry.id === adapter.targetId && entry.execution !== 'family_operation')
        || adapter.commandType === 'mystery.start' && !mysteries.has(adapter.targetId)
        || adapter.commandType === 'knowledge.share' && !profiles.has(adapter.targetId)) fail('Command does not resolve to an existing authority.');
      if (adapter.commandType === 'mystery.start' && !source.mysteryAdapters.some((entry) => entry.graphId === adapter.targetId))
        atField('commandAdapters', () => fail('Mystery commands require a pinned mystery adapter.'));
      commands.set(adapter.id, adapter);
    }
    context.field = 'initialSignals'; unique(array(source.initialSignals, 1, DIRECTOR_LIMITS.signals), (entry) => entry.id);
    for (const signal of source.initialSignals) {
      record(signal, ['id', 'audienceId', 'title', 'description', 'knowledgeLevel', 'commandAdapterIds']); id(signal.id);
      playerText(signal.title, 120); playerText(signal.description); choice(signal.knowledgeLevel, ['rumor', 'known', 'public']);
      const audience = audiences.get(signal.audienceId);
      if (!audience || (audience.kind === 'public') !== (signal.knowledgeLevel === 'public')
        || signal.knowledgeLevel === 'known' && !audience.knowledge) fail('Signal disclosure exceeds its audience authority.');
      unique(array(signal.commandAdapterIds, 0, DIRECTOR_LIMITS.adapters));
      if (signal.commandAdapterIds.some((command) => commands.get(command)?.audienceId !== signal.audienceId)) fail('Signal leaks another audience objective.');
    }
    if (source.network) atField('network', () => networkContract(source, worlds, world));
    // Dependency pins change when an authority changes even when source text does not.
    context.field = 'dependencyHashes'; const dependencyHashes = { world: world.contentHash,
      operations: source.coordinationAdapters.filter((entry) => entry.kind === 'family_operation').map((entry) => ({ id: entry.definitionId, hash: operations.get(entry.definitionId).contentHash })),
      profiles: [...new Set(source.commandAdapters.filter((entry) => entry.commandType.startsWith('discovery.') || entry.commandType === 'knowledge.share').map((entry) => entry.targetId))]
        .map((profileId) => ({ id: profileId, hash: profiles.get(profileId).contentHash })),
      mysteries: [...new Set(source.mysteryAdapters.map((entry) => entry.graphId))].map((graphId) => ({ id: graphId, hash: mysteries.get(graphId).contentHash })),
      ...(source.network ? { relatedWorld: source.network.relatedWorld.map((rule) => ({ id: rule.objectId, hash: worlds.get(rule.objectId).contentHash })) } : {}),
    };
    for (const dependency of [...dependencyHashes.operations, ...dependencyHashes.profiles, ...dependencyHashes.mysteries, ...(dependencyHashes.relatedWorld || [])]) {
      if (!/^[a-f0-9]{64}$/.test(dependency.hash)) fail('Dependency lacks an admitted content hash.');
    }
    return admit({ ...source, dependencyHashes });
  })));
}

export function compileCampaignDefinitions(inputs, situations) {
  const sources = inertCopy(inputs); array(sources, 0, DIRECTOR_LIMITS.definitions); unique(sources, (source) => source.id);
  const catalog = catalogMap(situations);
  if (situations.some((entry) => !verifyDirectorDefinition(entry))) fail('Campaign situations must be admitted definitions.');
  return Object.freeze(sources.map((source) => atDefinition('campaign', source, (context) => {
    record(source, ['id', 'version', 'title', 'entryNode', 'nodes', 'branches', 'maxDurationSeconds', 'recoveryPolicy', 'cooldownPolicy', 'maxActive']);
    context.field = 'id'; id(source.id); context.field = 'version'; integer(source.version, 1, 2147483647);
    context.field = 'title'; text(source.title, 120); context.field = 'entryNode'; id(source.entryNode);
    context.field = 'maxDurationSeconds';
    integer(source.maxDurationSeconds, 3600, 15552000); integer(source.maxActive, 1, 16);
    atField('cooldownPolicy', () => cooldown(source.cooldownPolicy)); context.field = 'recoveryPolicy'; recovery(source.recoveryPolicy);
    if (source.recoveryPolicy.afterSeconds !== source.maxDurationSeconds) fail('Campaign recovery must use the implemented campaign deadline.');
    if (source.recoveryPolicy.to !== 'abandoned') fail('Campaign recovery must retain an abandoned receipt.');
    context.field = 'nodes'; unique(array(source.nodes, 1, DIRECTOR_LIMITS.campaignNodes), (node) => node.id);
    const nodes = new Map();
    for (const node of source.nodes) {
      record(node, ['id', 'situationId', 'terminal']); id(node.id);
      if (typeof node.terminal !== 'boolean' || !catalog.has(node.situationId)) fail('Unknown campaign situation.');
      nodes.set(node.id, node);
    }
    context.field = 'branches'; unique(array(source.branches, 0, DIRECTOR_LIMITS.campaignBranches), (branch) => branch.id);
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
  })));
}

export function compileDirectorDefinitions(input, catalog) {
  record(input, ['situations', 'campaigns']);
  const situations = compileSituationDefinitions(input.situations, catalog);
  return Object.freeze({ situations, campaigns: compileCampaignDefinitions(input.campaigns, situations) });
}
