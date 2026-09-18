import assert from 'node:assert/strict';
import { createDockWarContent } from '../src/content/dock-war.js';
import { createDockWarDefinitions, dockWarDefinitionCatalog, dockWarDefinitionSources } from '../src/director/dock-war.js';
import { compileDirectorDefinitions, compileSituationDefinitions, evaluateDirectorPredicate, evaluateDirectorPressures,
  verifyDirectorDefinition, matchesDirectorFacts } from '../src/director/definitions.js';

const content = createDockWarContent(), catalog = dockWarDefinitionCatalog(content);
const fresh = () => structuredClone(dockWarDefinitionSources(content));
const compile = (input = fresh()) => compileDirectorDefinitions(input, catalog);
let checks = 0;
function invalid(edit, label) {
  const source = fresh(); edit(source);
  assert.throws(() => compile(source), { code: 'bad_director_definition' }, label); checks++;
}
function frozen(value) {
  if (value && typeof value === 'object') {
    assert(Object.isFrozen(value)); Object.values(value).forEach(frozen);
  }
}
const admitted = createDockWarDefinitions(content);
frozen(admitted);
assert.equal(admitted.situations.length, 4);
assert.equal(admitted.campaigns[0].branches.length, 3);
assert(admitted.situations.every(verifyDirectorDefinition));
assert(admitted.campaigns.every(verifyDirectorDefinition));
assert(!verifyDirectorDefinition(structuredClone(admitted.situations[0])), 'A hash alone is not admission authority');
assert(!verifyDirectorDefinition({ ...admitted.situations[0], version: 999 }));
assert.deepEqual(compile(), admitted, 'Deterministic compilation pins identical authority dependencies');
const reorder = fresh(); reorder.situations[0] = Object.fromEntries(Object.entries(reorder.situations[0]).reverse());
assert.equal(compile(reorder).situations[0].contentHash, admitted.situations[0].contentHash);
const mutable = fresh(), detached = compile(mutable);
mutable.situations[0].audiences[0].knowledge.value.value = 'edited-after-admission';
assert.equal(detached.situations[0].contentHash, admitted.situations[0].contentHash);
assert.notEqual(detached.situations[0].audiences[0].knowledge.value.value, 'edited-after-admission');

invalid((s) => { s.situations[0].version = 0; }, 'Invalid definition version');
invalid((s) => { s.situations.push(s.situations[0]); }, 'Duplicate definitions');
invalid((s) => { s.situations[0].eligibility.push({ fact: 'worldState', op: 'eq', value: 'protected' }); }, 'Impossible world prerequisites');
invalid((s) => { s.situations[0].excludedWorldFacts.push({ fact: 'worldState', op: 'eq', value: 'shortage' }); }, 'Excluded mandatory state');
invalid((s) => { s.situations[0].eligibility.push({ fact: 'activePlayers', op: 'gte', value: 5 }, { fact: 'activePlayers', op: 'lte', value: 4 }); }, 'Impossible count bounds');
invalid((s) => { s.situations[0].requiredWorldFacts.push({ fact: 'controllerFamilyId', op: 'eq', value: null }); }, 'Controller required and forbidden');
invalid((s) => { s.situations[0].eligibility.push({ fact: 'activePlayers', op: 'eq', value: 3 }); s.situations[0].excludedWorldFacts.push({ fact: 'activePlayers', op: 'gte', value: 3 }); }, 'Excluded numerical range');
invalid((s) => { s.situations[0].requiredWorldFacts.push({ fact: 'omrBalance', op: 'gte', value: 10 }); }, 'Undeclared fact adapter');
invalid((s) => { s.situations[0].pressureInputs.push('arbitraryFearScore'); }, 'Undefined pressure semantics');
invalid((s) => { s.situations[0].states.push('unreachable'); }, 'Unreachable lifecycle state');
invalid((s) => { s.situations[0].possibleEscalations.push({ id: 'loop', from: 'urgent', to: 'rumor', afterSeconds: 60, when: [] }); }, 'Unbounded lifecycle loop');
invalid((s) => { s.situations[0].possibleEscalations[0].from = 'protected'; }, 'Transition from terminal outcome');
invalid((s) => { s.situations[0].possibleEscalations[0].when = [{ fact: 'worldState', op: 'eq', value: 'fabricated' }]; }, 'Unknown escalation world state');
invalid((s) => { s.situations[0].possibleResolutions[0].to = 'rumor'; }, 'Resolution must be terminal');
invalid((s) => { s.situations[0].possibleResolutions[1].consequenceId = s.situations[0].possibleResolutions[0].consequenceId; }, 'Conflicting canonical outcomes');
invalid((s) => { delete s.situations[0].recoveryPolicy; }, 'Missing recovery');
invalid((s) => { s.situations[0].recoveryPolicy.on.pop(); }, 'Uncovered season recovery');
invalid((s) => { s.situations[0].recoveryPolicy.maxAttempts = 100; }, 'Unbounded recovery');
invalid((s) => { s.situations[0].recoveryPolicy.maxAttempts = 2; }, 'Undeclared recovery retry adapter');
invalid((s) => { s.situations[0].recoveryPolicy.afterSeconds = 60; }, 'A separate recovery delay has no runtime implementation');
invalid((s) => { s.situations[0].recoveryPolicy.to = 'rumor'; }, 'Recovery cannot quietly rewind progress');
invalid((s) => { s.situations[0].cooldownPolicy.seconds = 0; }, 'Missing cooldown');
invalid((s) => { s.situations[0].cooldownPolicy.quietSeconds = 999999; }, 'Contradictory quiet period');
invalid((s) => { s.situations[0].expiryPolicy.to = 'rumor'; }, 'Expiry must be terminal');
invalid((s) => { s.situations[0].participants.minimumFamilies = 3; }, 'More required Families than participants');
invalid((s) => { s.situations[0].participants.minimumPlayers = 1; }, 'An operation needs two occupied roles');
invalid((s) => { s.situations[0].eligibility.push({ fact: 'activePlayers', op: 'lte', value: 1 }); }, 'Population predicates contradict required roles');
invalid((s) => { s.situations[0].concurrencyPolicy.perTerritory = 0; }, 'Invalid concurrency bound');
invalid((s) => { s.situations[0].commandAdapters[0].commandType = 'economy.mint'; }, 'Unknown command framework');
invalid((s) => { s.situations[0].commandAdapters[2].targetId = 'operation:forged'; }, 'Unknown operation');
invalid((s) => { s.situations[0].coordinationAdapters[0].definitionId = 'operation:forged'; }, 'Unknown coordination target');
invalid((s) => { s.situations[0].mysteryAdapters[0].nodeId = 'mystery:forged'; }, 'Unknown authored evidence');
invalid((s) => { s.situations[0].consequenceContracts[0].actionId = 'mint_reward'; }, 'Invalid World Graph mutation');
invalid((s) => { s.situations[0].consequenceContracts[0].toState = 'settled'; }, 'Wrong canonical action effect');
invalid((s) => { s.situations[0].consequenceContracts[0].economicEffects = 'mint_100_omr'; }, 'Undeclared economic effects');
invalid((s) => { s.situations[0].consequenceContracts[0].reward = 100; }, 'Unknown economic payload');
invalid((s) => { s.situations[0].audiences[0].knowledge.contentHash = 'a'.repeat(64); }, 'Forged knowledge source');
invalid((s) => { s.situations[0].audiences[0].kind = 'public'; }, 'Private fact to public audience');
invalid((s) => { s.situations[0].initialSignals[0].knowledgeLevel = 'known'; }, 'Known signal lacks knowledge proof');
invalid((s) => { s.situations[0].initialSignals[0].commandAdapterIds.push('protect'); }, 'Cross-audience objective leak');
invalid((s) => { s.situations[0].initialSignals[0].description = 'Current state: ${worldState}'; }, 'Canonical interpolation leak');
invalid((s) => { s.campaigns[0].nodes.push({ id: 'orphan', situationId: s.situations[1].id, terminal: true }); }, 'Unreachable campaign branch');
invalid((s) => { s.campaigns[0].branches[0].outcome = 'fake'; }, 'No canonical branch outcome');
invalid((s) => { s.campaigns[0].branches[0].when = [{ fact: 'worldState', op: 'eq', value: 'intercepted' }]; }, 'Impossible outcome branch');
invalid((s) => { s.campaigns[0].nodes[1].terminal = false; s.campaigns[0].branches.push({ id: 'rewind', from: 'protected', to: 'shortage', outcome: 'settle', when: [] }); }, 'Campaign cycles cannot rewind canonical reality');
invalid((s) => { s.campaigns[0].branches.push({ ...s.campaigns[0].branches[0], id: 'ambiguous' }); }, 'Ambiguous duplicate outcome');
invalid((s) => { s.campaigns[0].nodes[0].terminal = true; }, 'Terminal campaign node with outgoing transition');
invalid((s) => { s.campaigns[0].recoveryPolicy.to = 'shortage'; }, 'Campaign recovery preserves abandonment');
invalid((s) => { s.campaigns[0].recoveryPolicy.afterSeconds = 60; }, 'Campaign recovery deadline must match its actual timer');
invalid((s) => { s.situations[0].eligibility[0].value = () => true; }, 'Executable content is forbidden');
invalid((s) => { Object.defineProperty(s.situations[0], 'id', { enumerable: true, get() { throw new Error('Getter must not execute'); } }); }, 'Accessors rejected without execution');
invalid((s) => { s.situations[0].eligibility[5] = s.situations[0].eligibility[0]; }, 'Sparse author data');
invalid((s) => { s.situations[0].initialSignals[0].description = '\ud800'; }, 'Invalid canonical Unicode');

assert(evaluateDirectorPredicate({ fact: 'resourceDeficit', op: 'gte', value: 1 }, { resourceDeficit: 1 }));
assert(!evaluateDirectorPredicate({ fact: 'resourceDeficit', op: 'gte', value: 1 }, { resourceDeficit: '1' }));
assert(!evaluateDirectorPredicate({ fact: 'controllerFamilyId', op: 'present', value: false }, {}), 'Missing facts fail closed');
assert(evaluateDirectorPredicate({ fact: 'controllerFamilyId', op: 'present', value: false }, { controllerFamilyId: null }));
const readyFacts = { worldState: 'shortage', controllerFamilyId: 'family:a', resourceDeficit: 1 };
assert(matchesDirectorFacts(admitted.situations[0].eligibility, readyFacts));
assert(!matchesDirectorFacts(admitted.situations[0].eligibility, { ...readyFacts, worldState: 'idle' }));
for (const situation of admitted.situations.slice(1)) {
  assert(!matchesDirectorFacts(situation.eligibility, readyFacts), 'Second generation requires a real outcome');
  const state = situation.eligibility[0].value;
  assert(matchesDirectorFacts(situation.eligibility, { ...readyFacts, worldState: state }));
}
const pressure = (facts) => evaluateDirectorPressures(['resourceDeficit'], facts)[0];
assert.equal(pressure({ resourceQuantity: 1, resourceDemand: 2 }).valuePermille, 500);
assert.equal(pressure({ resourceQuantity: 100, resourceDemand: 2 }).valuePermille, 0);
assert.equal(pressure({ resourceQuantity: 0, resourceDemand: 2 }).valuePermille, 1000);
assert.equal(pressure({ resourceQuantity: 0, resourceDemand: 0 }).valuePermille, 0);
assert.equal(pressure({ resourceQuantity: -1, resourceDemand: 2 }).available, false);
const changedCatalog = { ...catalog, worldDefinitions: catalog.worldDefinitions.map((world) => ({ ...world, contentHash: 'a'.repeat(64) })) };
assert.notEqual(compileSituationDefinitions(fresh().situations, changedCatalog)[0].contentHash, admitted.situations[0].contentHash,
  'Authority changes invalidate admitted situation pins');
console.log(`director definitions: ${checks} rejection checks, immutable admission, semantic pressures, three canonical campaign branches passed`);
