// Observer-only, source-pinned sufficient paths for the frozen world assertions.
// A missing sufficient path is UNKNOWN, never proof of a dead world. No SQL/actor reads.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { canonicalRecoveryWitnesses, joinWorldCheckpointAssertions, verifyWorldRecoverySources } from './rc1-world-qualification.js';
import { compileCoordinationGraph } from '../src/coordination/graph.js';
import { CONSTANTS, levelOf, PACING, M3, CRIMES, CITY_EVENTS } from '../src/rules.js';

const hash = value => sha256(canonicalJson(value));
const EXTENSION_PINS = Object.freeze({
  'src/mysteries.js': 'c520c727c15bd5829c1b2467511260c61e01b73038bce42ba9a48a8a55c6d070',
  'src/crafting.js': '2eeaa2eb1378fdc2c237727226d132a85b8b009d0890485e18fa7b6290251012',
  'src/items.js': '0172726d784cc9faa430280e91374b5f2296cb5294adfac19ae91f307c9f107a',
  'src/recipe-scarcity.js': '5fc404a872d946360dc9d523c34dadc5d96dff19d807be83bfe3d19855c7a7a9',
  'src/coordination/graph.js': '4d5de1c54159048710b1b4695617710965074fd886f2b3b7fb87a08a0e8b545f',
  'src/coordination/runtime.js': 'a965a4ec667f3faec243e19f90bd501d13981dd6abcf421f39b15b9c38a0eb0e',
  'src/routes/coordination.js': '7902665fad7db1dedee8a92c8d6d4ac6c8f7076658da1da81cc8880264a59198',
  'src/routes/worldgraph.js': '5a96afa156930a5cb6cd6656fe1fb92fc716eeddd5243d954a46cf5a619b96c7',
  'src/world-prerequisites.js': 'c6548363a93bb481b44e4528ea78e6b77c1f694546d6a6229784b40b1ea8587d',
  'src/world-knowledge.js': '73a5f37738dcd73e2299643f5e23422b1770ee04a890142fafbca49f864daeda',
  'src/crew.js': 'e13d9e745f62292ef47766c756ece7c9d14e10368cc30784053a8e5e4c2487ed',
  'src/content/automotive-salvage.js': 'bcaea48b77cdab85cb8cab3724ebfd2bc777c9f61e5df50de1086bf2c6b9a3ad',
  'src/content/core-progression.js': '7516f9b5cc0c9a249ac8b89d117b5397de4aa57175cfcd99c9409890a03a252e',
  'src/made.js': 'f871cf72aa3f4f65488c77ad16b257100569d40e3cf9b96dd4877e6c22be0e02',
  'src/world-kernel.js': '141f71783dd1f9126b74c78123d1fccfd403dc4a87c2eb8b6536f9ad8190c810',
});
export const CHECKPOINT_RECOVERY_REVIEW = Object.freeze({
  format: 1, sourcePins: EXTENSION_PINS,
  catalogSha256: 'acadfb880100493a1bc5e8513c0c1d01395faeb8ca997535e9d807b53b69f139',
  scope: 'Current eligible roster and one compatible meaningful/recovery/authorized-propagation path per required subject. Verified empty-escrow mystery and discovery cancellation has no item/Knowledge prerequisite. Optional authored completion branches retain a separate supplemental inventory; simultaneous completion of every optional branch is not a frozen gate. No hypothetical path is claimed executed.',
  materialPath: 'Original boostCar has a positive success/junker branch, consumes10 energy, and creates an owned unlisted/unpledged/unminted/unraced car. One250-cash journey to foundry plus original car_salvage_basic produces6 scrap,2 wire,2 salvage parts. This is existential reachability, not a guaranteed finite number of random attempts. No OMR faucet or fixture item is transferred into the proof.',
  baseKnowledge: 'Docks manifest/ledger/register claims use original discover/complete actions; furnace manifest and dock tide admissions use the original free own mystery node. Countermark/chart additionally need the exact crafted key/seal. Fresh account-target tokens use an eligible coactor public character name; current claim owner and ACL revision authorize sharing, without Crew/Family membership.',
  composedPaths: 'Original quiet pickpocket has positive success probability, no heat and no failure jail; nerve regenerates6/min and each success gives at least2 respect and35 cash before any optional soldier cut. The sufficient ordinary-state proof excludes assigned soldiers, personal loans, heat and existing upkeep. It supplies Crew level3 and, for two eligible solo coactors, Family level5/25000 fee. A fresh uniform two-person Crew/Family can establish dock shortage, then register/intercept/establish/expose the canal through four original1000-permille operations. Exact seals/wire, original cooldowns, fresh revisions and returned item IDs are retained; acquisition happens before any remaining objective retirement. This is a possible canonical path, not an observed or guaranteed random schedule.',
  limits: 'Existing operation/campaign/crew-objective recovery has its own proof adapters; this review does not silently replace them. Nonordinary material/progression guards, incompatible physical world states and unfamiliar content remain UNKNOWN. These are evaluator coverage limits, not additional launch requirements. Paid-route availability and all future adversarial states are outside these sufficient paths.',
});
export async function verifyCheckpointRecoverySources(input) {
  const base = await verifyWorldRecoverySources(input);
  for (const [file, expected] of Object.entries(EXTENSION_PINS)) assert.equal(sha256(String(await input.readFile(file)).replace(/\r\n/g, '\n')), expected, 'Checkpoint review source changed: ' + file);
  return { ...base, checkpointReviewSha256: hash(CHECKPOINT_RECOVERY_REVIEW), extensionPins: { ...EXTENSION_PINS } };
}
export function recoveryCatalog(content) {
  return { nodes: [...content.registry.nodes.values()], graphs: content.coordinationRegistry.graphs,
    operations: content.operations, objects: content.objects };
}
const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
const knownRoots = new Set(['docks.manifest', 'foundry.impression', 'docks.canal-register', 'docks.shipping-register',
  'docks.tide-ledger', 'docks.carbon-manifest', 'foundry.reversed-countermark', 'foundry.survey-plate']);
const craftedRoot = { 'foundry.reversed-countermark': 'item:furnace_archive_key', 'foundry.survey-plate': 'item:dock_route_seal' };
const corroborationRoots = { 'corroborated.carbon-index': ['docks.carbon-manifest', 'foundry.reversed-countermark'],
  'corroborated.dock-canal': ['docks.tide-ledger', 'foundry.survey-plate'],
  'corroborated.public-disclosure': ['docks.posted-notice', 'foundry.printer-copy'] };
const supportedCrafts = new Set(['item:furnace_archive_key', 'item:dock_route_seal', 'item:canal_cargo_seal']);
const ownItem = condition => condition.adapter === 'item_ownership' ? condition.requirement?.templateId || condition.templateId : null;

// configurationEvidence must bind the caller's frozen effective local rollout, not
// infer it from process.env or an empty table. artifact references are byte-verified
// by the runner, as with the existing native evidence joins.
export function reviewCanonicalCheckpoint({ manifest, source, checkpoint, snapshot, diagnostics, diagnosticEvidence,
  roster, catalog, configurationEvidence, inventoryEvidence, reviewEvidence, lifecycleWindows = null }) {
  assert.equal(source.checkpointReviewSha256, hash(CHECKPOINT_RECOVERY_REVIEW)); assert.deepEqual(source.extensionPins, EXTENSION_PINS);
  const bound = { sourceRevision: source.sourceRevision, ...checkpoint };
  assert.deepEqual(configurationEvidence.binding, { sourceRevision: source.sourceRevision, configurationSha256: checkpoint.configurationSha256 });
  const fullCatalog = hash(catalog) === CHECKPOINT_RECOVERY_REVIEW.catalogSha256;
  const enabled = fullCatalog && configurationEvidence.coreProgression === true && configurationEvidence.coordination === true
    && configurationEvidence.knowledge === true && configurationEvidence.sharing === true && configurationEvidence.unrestrictedCohort === true;
  const tables = Object.fromEntries(Object.entries(snapshot.tables).map(([name, rows]) => [name, rows.map(parse)]));
  const table = name => { assert(Array.isArray(tables[name]), 'Missing checkpoint table ' + name); return tables[name]; };
  const base = canonicalRecoveryWitnesses({ source, checkpoint, snapshot, roster });
  const witnesses = [...base.witnesses], details = [], resourceNeeds = new Map(), knowledgeNeeds = new Map();
  const inventories = Object.fromEntries(['actors', 'resources', 'objectives', 'family', 'knowledge'].map(scope => [scope,
    { binding: bound, complete: true, evidence: inventoryEvidence, obligations: [] }]));
  for (const accountId of roster) {
    inventories.actors.obligations.push({ id: 'actor:' + accountId, goal: 'meaningful-action-or-legal-wait' });
    inventories.family.obligations.push({ id: 'family:' + accountId, goal: 'family-access-or-legal-exit' });
  }
  const actors = new Map(roster.map(accountId => [accountId, table('characters').find(row => row.account_id === accountId && row.alive && !row.is_npc)]));
  const active = accountId => actors.get(accountId) && table('accounts').some(row => row.id === accountId && row.status === 'active');
  const emit = (scope, obligation, status, reason, evidence = {}) => {
    inventories[scope].obligations.push(obligation);
    witnesses.push({ ...bound, scope, ...obligation, status, method: 'source-pinned-review', evidence: reviewEvidence });
    details.push({ scope, id: obligation.id, status, reason, ...evidence });
  };
  const needItem = (accountId, templateId, quantity, cause) => {
    const id = 'resource:' + accountId + ':' + templateId, prior = resourceNeeds.get(id);
    resourceNeeds.set(id, { id, accountId, templateId, quantity: Math.max(quantity, prior?.quantity || 0), causes: [...(prior?.causes || []), cause] });
  };
  const needKnowledge = (accountId, requirement, cause) => {
    const id = 'knowledge:' + accountId + ':' + hash(requirement), prior = knowledgeNeeds.get(id);
    knowledgeNeeds.set(id, { id, accountId, requirement, causes: [...(prior?.causes || []), cause] });
    if (craftedRoot[requirement.sourceRoot]) needItem(accountId, craftedRoot[requirement.sourceRoot], 1, cause);
    if (requirement.sourceRoot === 'foundry.printer-copy') needItem(accountId, 'item:canal_cargo_seal', 1, cause);
  };
  const inspectConditions = (accountId, conditions, cause) => {
    for (const condition of conditions || []) {
      const item = ownItem(condition); if (item) needItem(accountId, item, 1, cause);
      if (condition.adapter === 'knowledge') needKnowledge(accountId, condition.requirement, cause);
    }
  };
  const definitions = new Map();
  for (const row of table('coordination_definitions')) {
    try {
      const graph = compileCoordinationGraph(parse(row.definition_json));
      if (graph.id === row.graph_id && graph.version === Number(row.graph_version) && graph.contentHash === row.content_hash)
        definitions.set(graph.id + ':' + graph.version, graph);
    } catch { /* A corrupt original definition has no proved cancellation projection. */ }
  }
  for (const subject of diagnostics.objectiveInventory.subjects) {
    const obligation = { id: subject.type + ':' + subject.id, goal: 'objective.completed-or-canonically-retired' };
    if (subject.type === 'mystery') {
      const instance = table('mystery_instances').find(row => row.id === subject.id);
      const ch = instance?.owner_scope === 'character' && table('characters').find(row => row.id === instance.owner_id);
      const accountId = instance?.authority_account_id;
      const account = table('accounts').find(row => row.id === accountId && row.status === 'active');
      const ownerMatches = instance && account && (instance.owner_scope === 'account' ? instance.owner_id === accountId : ch?.account_id === accountId);
      // Custody-bearing recovery remains the existing escrow proof's responsibility.
      const emptyEscrow = !table('operation_escrow').some(row => row.operation_id === subject.id);
      const reachable = ownerMatches && instance.status === 'active' && emptyEscrow;
      emit('objectives', obligation, reachable ? 'REACHABLE' : 'UNKNOWN', reachable
        ? 'Original cancellation binds immutable stored owner/account/graph/version; no recipe, current definition or living-character completion gate; this instance has no escrow.'
        : 'Stored cancellation owner/status or custody recovery requires an additional exact proof.', { instance: instance || null,
        canonicalRequest: instance ? { method: 'POST', path: '/v1/worldgraph/mysteries/' + instance.graph_id + '/cancel', body: { instanceId: instance.id } } : null });
      const nodes = catalog.nodes.filter(node => node.packageId === instance?.graph_id);
      if (!fullCatalog || !nodes.length || !roster.includes(accountId)) {
        inventories.resources.complete = false; inventories.knowledge.complete = false;
      } else for (const node of nodes) inspectConditions(accountId, node.conditions, obligation.id + '/' + node.id);
    } else if (subject.type === 'discovery') {
      const instance = table('coordination_instances').find(row => row.id === subject.id);
      const graph = instance && definitions.get(instance.graph_id + ':' + instance.graph_version);
      let stateValid = false;
      try { const state = parse(instance.state_json), ids = new Set(graph.nodes.map(node => node.id));
        stateValid = Object.keys(state).sort().join(',') === 'completed,discovered' && ['completed', 'discovered'].every(key => Array.isArray(state[key])
          && new Set(state[key]).size === state[key].length && state[key].every(id => ids.has(id))) && state.completed.every(id => state.discovered.includes(id));
      } catch { /* UNKNOWN */ }
      const reachable = instance?.status === 'active' && Number.isSafeInteger(Number(instance.revision)) && Number(instance.revision) < 2147483647
        && graph?.contentHash === instance.content_hash && stateValid && table('accounts').some(row => row.id === instance.owner_account_id && row.status === 'active');
      emit('objectives', obligation, reachable ? 'REACHABLE' : 'UNKNOWN', reachable
        ? 'Stored definition recompiles to the exact content hash; valid state, active owning account and current revision permit original cancellation and projection.'
        : 'Original definition/state/account/revision cancellation guards are not all established.', { instance: instance || null,
        canonicalRequest: instance ? { method: 'POST', path: '/v1/coordination/instances/' + instance.id + '/cancel', body: { expectedRevision: Number(instance.revision) } } : null });
      if (!enabled || !graph || !roster.includes(instance.owner_account_id) || !catalog.graphs.some(row => row.contentHash === graph.contentHash)) {
        inventories.resources.complete = false; inventories.knowledge.complete = false;
      } else for (const node of graph.nodes) if (node.claim) needKnowledge(instance.owner_account_id, { ...node.claim, contentHash: graph.contentHash }, obligation.id + '/' + node.id);
    } else {
      emit('objectives', obligation, 'UNKNOWN', 'Join the existing exact operation/campaign/crew-objective completion or recovery proof for this subject.');
      inventories.resources.complete = false; inventories.knowledge.complete = false;
    }
  }
  const collaborations = new Map();
  for (const need of knowledgeNeeds.values()) {
    const roots = corroborationRoots[need.requirement.sourceRoot]; if (!roots) continue;
    const origin = roster.indexOf(need.accountId), peer = [...roster.slice(origin + 1), ...roster.slice(0, origin)].find(id => active(id));
    const graph = catalog.graphs.find(row => row.contentHash === need.requirement.contentHash);
    if (!peer || !graph) continue;
    const originals = roots.map((root, index) => ({ accountId: index ? peer : need.accountId,
      requirement: { ...graph.nodes.find(node => node.claim?.sourceRoot === root).claim, contentHash: graph.contentHash } }));
    for (const original of originals) needKnowledge(original.accountId, original.requirement, need.id + ':independent-original');
    collaborations.set(need.id, originals);
  }
  // Expand finite authored item prerequisites to their input recipes and exact
  // Knowledge requirements. This does not demand unrelated recipes or all branches.
  for (const need of resourceNeeds.values()) {
    const recipe = catalog.nodes.find(node => node.type === 'recipe' && node.produces?.some(output => output.templateId === need.templateId));
    if (recipe) {
      for (const condition of recipe.conditions || []) if (condition.adapter === 'knowledge') needKnowledge(need.accountId, condition.requirement, need.id + '/' + recipe.id);
      for (const input of recipe.consumes || []) if (input.templateId) needItem(need.accountId, input.templateId, input.quantity, need.id + '/' + recipe.id);
    }
  }
  const travelProofs = new Map(canonicalRecoveryWitnesses({ source, checkpoint, snapshot, roster, resourceRequirements:
    roster.map(accountId => ({ id: 'travel:' + accountId, accountId, resource: 'cash', quantity: 250, goal: 'cash>=250' }))
  }).witnesses.filter(row => row.scope === 'resources').map(row => [row.id, row]));
  const materialProof = accountId => {
    const ch = actors.get(accountId); if (!enabled || !active(accountId)) return { ok: false, reason: 'Missing applicable enabled catalog/current own character' };
    const cars = table('cars').filter(row => row.character_id === ch.id);
    // Existing cars may be pledged/listed/etc. This sufficient path creates a fresh one.
    if (cars.length >= CONSTANTS.GARAGE_CAP || !Number.isFinite(Number(ch.energy)) || Number(ch.energy) < 10 || new Date(ch.jail_until).getTime() > checkpoint.logicalAt
      || new Date(ch.gta_at).getTime() + CONSTANTS.GTA_CD_MS > checkpoint.logicalAt
      || ![ch.speed, ch.cunning].every(value => Number.isFinite(Number(value)) && Number(value) >= 0))
      return { ok: false, reason: 'Fresh original boost guard needs a current owned-car disposition or original timer/accrual recovery witness' };
    const cash = travelProofs.get('travel:' + accountId);
    if (ch.loc !== 'foundry' && cash.status !== 'REACHABLE') return { ok: false, reason: 'Foundry fare needs a specific bounded legal wait/cash witness' };
    return { ok: true, characterId: ch.id, energy: Number(ch.energy), garageCount: cars.length,
      reason: 'Currently legal fresh boost has a positive junker outcome; fresh car custody satisfies salvage flags. Docks/Foundry knowledge is acquired before spending the single250 fare; one original salvage provides6 scrap/2 wire/2 parts.', cashActions: cash.canonicalActions || [] };
  };
  const materialCache = new Map();
  for (const need of resourceNeeds.values()) {
    if (!materialCache.has(need.accountId)) materialCache.set(need.accountId, materialProof(need.accountId));
    const material = materialCache.get(need.accountId), recipe = catalog.nodes.find(node => node.type === 'recipe' && node.produces?.some(output => output.templateId === need.templateId));
    const basic = { 'mat:scrap_steel': 6, 'mat:wire': 2, 'mat:salvage_parts': 2 }[need.templateId];
    let ok = material.ok && (basic >= need.quantity || supportedCrafts.has(need.templateId) && need.quantity === 1 && actors.get(need.accountId)?.loc === 'docks');
    if (need.templateId === 'item:furnace_archive_key') {
      const usage = table('world_recipe_usage').filter(row => row.recipe_id === recipe.id && row.period_kind === 'lifetime');
      const ownUsed = Number(usage.find(row => row.scope === 'account' && row.subject_id === need.accountId)?.used || 0);
      const globalUsed = Number(usage.find(row => row.scope === 'global')?.used || 0);
      const prospectiveOwners = [...resourceNeeds.values()].filter(row => row.templateId === need.templateId).length;
      ok &&= ownUsed < 2 && globalUsed + prospectiveOwners <= 64;
      if (!ok && material.ok) details.push({ scope: 'resources', id: need.id, reason: 'Current source path cannot promise every selected owner a fresh key within the exact lifetime caps; sharing/reuse/retirement may supply another legal path. Not proof of global exhaustion.' });
    }
    const obligation = { id: need.id, goal: need.templateId + '>=' + need.quantity, accountId: need.accountId, causes: need.causes };
    emit('resources', obligation, ok ? 'REACHABLE' : 'UNKNOWN', ok ? material.reason + (recipe ? ' Exact authored recipe/Knowledge/scarcity prerequisites are retained.' : '') : material.reason,
      { recipeId: recipe?.id || null, quantity: need.quantity, currentPath: material });
  }
  const resourceStatus = id => witnesses.find(row => row.scope === 'resources' && row.id === id)?.status;
  const claimRows = table('coordination_claims'), grants = table('coordination_claim_grants');
  const crewOf = accountId => table('crew_members').find(row => row.account_id === accountId)?.crew_id;
  const familyOf = accountId => table('gang_members').find(row => row.character_id === actors.get(accountId)?.id)?.gang_id;
  const visible = (accountId, claim) => claim.owner_account_id === accountId || grants.some(grant => grant.claim_id === claim.id && grant.active
    && (grant.recipient_kind === 'account' && grant.recipient_id === accountId || grant.recipient_kind === 'crew' && grant.recipient_id === crewOf(accountId)
      || grant.recipient_kind === 'family' && grant.recipient_id === familyOf(accountId)));
  const planned = accountId => [...knowledgeNeeds.values()].filter(row => row.accountId === accountId).length + 1;
  const capacity = (accountId, requirement) => {
    const owned = claimRows.filter(claim => claim.owner_account_id === accountId).length;
    // Production bounds owned issuance at2048 and the visible candidate UNION
    // for the exact graph rule/requirement queries at256, not all visible claims.
    const queries = [], graph = catalog.graphs.find(row => row.contentHash === requirement.contentHash);
    const visit = rule => { if (rule?.kind === 'independent_evidence') queries.push(rule);
      for (const child of rule?.rules || []) visit(child); };
    for (const node of graph?.nodes || []) { visit(node.discover); visit(node.requires); }
    queries.push(requirement); // the separately checked exact cross-domain requirement
    const candidates = claimRows.filter(claim => visible(accountId, claim) && claim.content_hash === requirement.contentHash
      && queries.some(query => claim.domain === query.domain && claim.proposition === query.proposition
        && (!query.sourceRoot || claim.source_root === query.sourceRoot)));
    return owned + planned(accountId) <= 2048 && candidates.length + planned(accountId) + 2 <= 256;
  };
  const freshSource = (accountId, requirement) => {
    const graph = catalog.graphs.find(row => row.contentHash === requirement.contentHash);
    const node = graph?.nodes.find(row => row.claim?.sourceRoot === requirement.sourceRoot && row.claim.proposition === requirement.proposition);
    if (!node) return false;
    const instance = table('coordination_instances').find(row => row.owner_character_id === actors.get(accountId)?.id && row.graph_id === graph.id);
    if (!instance) return true;
    // A cancelled/completed original graph cannot simply be created anew for
    // this character. Existing claim reuse needs its original source/ACL proof.
    let state;
    try { state = parse(instance.state_json); } catch { return false; }
    return instance.status === 'active' && instance.owner_account_id === accountId && Number(instance.graph_version) === graph.version
      && instance.content_hash === graph.contentHash && Number.isSafeInteger(Number(instance.revision)) && Number(instance.revision) >= 0
      && Number(instance.revision) < 2147483647 && Array.isArray(state?.discovered) && !state.discovered.includes(node.id);
  };
  const admissionPath = (accountId, requirement) => {
    const graph = catalog.graphs.find(row => row.contentHash === requirement.contentHash);
    const node = graph?.nodes.find(row => row.claim?.sourceRoot === requirement.sourceRoot && row.claim.proposition === requirement.proposition);
    return (node?.admission || []).every(predicate => {
      if (predicate.adapter === 'social') return predicate.requirement.relation === 'crew_member'; // separately proved by crewProof
      if (predicate.adapter !== 'mystery_state') return false;
      const q = predicate.requirement, instance = table('mystery_instances').find(row => row.owner_scope === 'character'
        && row.owner_id === actors.get(accountId)?.id && row.graph_id === q.graphId);
      if (!instance) return true; // original start; the exact reviewed source-node guards follow
      if (instance.authority_account_id !== accountId || Number(instance.graph_version) !== q.graphVersion
        || instance.definition_hash !== q.definitionHash) return false;
      return instance.status === 'active' || table('mystery_node_state').some(row => row.instance_id === instance.id && row.node_id === q.nodeId && row.state === 'completed');
    });
  };
  const quietProgression = (accountId, targetLevel = 3, reserveCash = 500) => {
    const ch = actors.get(accountId), pick = CRIMES.find(row => row.id === 'pick'), quiet = M3.CRIME_APPROACHES.quiet;
    const ordinary = ch && active(accountId) && Number(ch.heat || 0) === 0 && Number(ch.crew || 0) === 0
      && new Date(ch.jail_until).getTime() <= checkpoint.logicalAt
      && [ch.respect, ch.cash, ch.speed, ch.cunning].every(value => Number.isFinite(Number(value)) && Number(value) >= 0)
      && !table('soldiers').some(row => JSON.stringify(row).includes(ch.id))
      && !table('loans').some(row => [ch.id, accountId].some(id => JSON.stringify(row).includes(id)));
    if (!ordinary) return { ok: false, reason: 'Progression requires current Law/upkeep/soldier/loan disposition' };
    const pay = base.witnesses.find(row => row.id === 'actor:' + accountId)?.canonicalActions?.[0]?.quotedCash || 0;
    const minimumCash = Math.floor(pick.cash[0] * quiet.payMult * Math.min(...CITY_EVENTS.map(event => event.jobPay || 1)));
    const minimumRep = Math.round(pick.respect * quiet.repMult * Math.min(...CITY_EVENTS.map(event => event.crimeRep || 1)));
    assert(minimumCash > 0 && minimumRep > 0 && pick.jail === 0 && quiet.heat === 0 && pick.base > M3.CRIME_STAT.OFFSET);
    const successes = Math.max(0, Math.ceil((PACING.LEVEL_DIVISOR * (targetLevel - 1) ** 2 - Number(ch.respect)) / minimumRep),
      Math.ceil((reserveCash - Number(ch.cash) - pay) / minimumCash));
    const possibleWaitMs = Math.ceil(successes * pick.nerve / PACING.NERVE_REGEN_PER_MIN * 60000);
    const seasonEnd = (Math.floor(checkpoint.logicalAt / (28 * 86400000)) + 1) * 28 * 86400000;
    return { ok: checkpoint.logicalAt + possibleWaitMs + 3600000 < seasonEnd, accountId, successes, targetLevel, reserveCash,
      minimumCashPerSuccess: minimumCash, minimumRespectPerSuccess: minimumRep, possibleWaitMs,
      reason: 'Positive-success quiet pick path with original nerve accrual, no heat/failure jail, no loan/upkeep/soldier cut, and enough time before next season. It is not a bound on stochastic attempts.' };
  };
  const crewProof = accountId => {
    const crewId = crewOf(accountId);
    if (crewId && table('crews').some(row => row.id === crewId)) return { ok: true, crewId, reason: 'Existing current Crew membership' };
    if (canalPath.ok && [canalPath.boss, canalPath.runner].includes(accountId)) return { ok: true, reason: 'Shared canal path creates the two-person uniform Crew before investigation' };
    const progress = quietProgression(accountId);
    let name = null;
    for (let i = roster.indexOf(accountId); i <= table('crews').length * roster.length + roster.length; i += roster.length)
      if (!table('crews').some(row => row.name === 'Recovery Crew ' + i)) { name = 'Recovery Crew ' + i; break; }
    return { ...progress, ok: progress.ok && !!name, name,
      reason: progress.reason + '; original createCrew costs no currency and needs level3 and this unused valid name.' };
  };
  const worldRows = table('world_kernel_objects');
  const canal = worldRows.find(row => row.id === 'infrastructure:canal_supply_depot');
  const dock = worldRows.find(row => row.id === 'territory:dock_supply_route');
  const worldHashes = new Map(catalog.nodes.flatMap(node => (node.conditions || []).filter(condition => condition.adapter === 'world_state')
    .map(condition => [condition.requirement.objectId, condition.requirement.definitionHash])));
  const state = (row, id) => row ? row.definition_hash === worldHashes.get(id) ? row.state : 'UNKNOWN' : 'idle';
  const canalState = state(canal, 'infrastructure:canal_supply_depot'), dockState = state(dock, 'territory:dock_supply_route');
  const solo = roster.filter(accountId => active(accountId) && !crewOf(accountId) && !familyOf(accountId)
    && actors.get(accountId).loc === 'docks' && materialProof(accountId).ok).sort((a, b) => Number(actors.get(b).cash) - Number(actors.get(a).cash));
  const boss = solo[0], runner = solo[1], bossProgress = boss && quietProgression(boss, 5, 27000), runnerProgress = runner && quietProgression(runner, 3, 3000);
  let familyName = null;
  for (let i = 0; i <= table('gangs').length && i < 36 ** 4; i++) {
    const tag = i.toString(36).toUpperCase().padStart(4, '0'), name = 'Recovery Family ' + tag;
    if (!table('gangs').some(row => row.tag === tag || row.name === name)) { familyName = { name, tag }; break; }
  }
  const states = ['idle', 'stranded', 'diverted', 'market_open'];
  const chain = ['register_shipment', 'intercept_shipment', 'establish_market', 'expose_market'].slice(Math.max(0, states.indexOf(canalState)));
  const operationWire = [2, 2, 1, 1].slice(Math.max(0, states.indexOf(canalState))).reduce((sum, value) => sum + value, 0);
  const routeRequirement = root => {
    const graph = catalog.graphs.find(row => row.nodes.some(node => node.claim?.sourceRoot === root));
    return { ...graph.nodes.find(node => node.claim?.sourceRoot === root).claim, contentHash: graph.contentHash };
  };
  const routesAvailable = !!boss && !!runner && [boss, runner].every(accountId => ['docks.shipping-register', 'docks.canal-register'].every(root => {
    const requirement = routeRequirement(root); return freshSource(accountId, requirement) && capacity(accountId, requirement);
  }));
  const canalPath = { ok: !!(enabled && (canalState === 'exposed' || states.includes(canalState)
    && ['idle', 'shortage'].includes(dockState) && !!familyName && routesAvailable && bossProgress?.ok && runnerProgress?.ok)),
    canalState, dockState, boss: boss || null, runner: runner || null, familyName,
    bossProgress: bossProgress || null, runnerProgress: runnerProgress || null,
    path: canalState === 'exposed' ? [] : ['original quiet progression and check-in', 'create Family; runner joins; create Crew; invite/accept runner',
      'original dock/canal free route claims', 'original fresh salvage/craft allocation in compatible-material-schedule',
      'return both to docks; direct establish_route if idle', ...chain.map(action => 'Family operation ' + action + ': create/publish/join/commit/contribute/approve/execute')],
    custody: 'One boss salvage yields6 scrap/2 wire/2 parts; dock seal consumes2 scrap/1 part and route establishment1 wire. Three runner salvages yield18 scrap/6 wire/6 parts; four seals consume8 scrap/4 parts, and operations consume2+2+1+1 wire. Fresh returned item IDs and fresh revisions are used. Extra boosts wait the original5 minutes; all four operations have24h lifetimes and1000-permille success. Progression reserves500+ cash for each round trip.',
    semantics: 'One compatible shared-world path; all Knowledge/mystery acquisitions precede remaining cancellation. Completed graphs already meet the completion-or-retirement goal; still-active graphs cancel using their refreshed revision. No hidden state drives an actor.' };
  details.push({ scope: 'knowledge', id: 'shared-canal-path', ...canalPath });
  const materialSchedule = [];
  for (const accountId of new Set([...resourceNeeds.values()].map(row => row.accountId).concat(canalPath.ok && canalState !== 'exposed' ? [boss, runner] : []))) {
    const craftCounts = new Map([...resourceNeeds.values()].filter(row => row.accountId === accountId && supportedCrafts.has(row.templateId)).map(row => [row.templateId, row.quantity]));
    const stock = { 'mat:scrap_steel': 0, 'mat:wire': 0, 'mat:salvage_parts': 0 };
    if (canalPath.ok && canalState !== 'exposed') {
      if (accountId === boss && dockState === 'idle') { craftCounts.set('item:dock_route_seal', Math.max(1, craftCounts.get('item:dock_route_seal') || 0)); stock['mat:wire'] += 1; }
      if (accountId === runner) { craftCounts.set('item:canal_cargo_seal', (craftCounts.get('item:canal_cargo_seal') || 0) + chain.length); stock['mat:wire'] += operationWire; }
    }
    for (const [templateId, count] of craftCounts) {
      const recipe = catalog.nodes.find(node => node.type === 'recipe' && node.produces?.some(output => output.templateId === templateId));
      for (const input of recipe.consumes) stock[input.templateId] += input.quantity * count;
    }
    const junkers = Math.max(1, Math.ceil(stock['mat:scrap_steel'] / 6), Math.ceil(stock['mat:wire'] / 2), Math.ceil(stock['mat:salvage_parts'] / 2));
    materialSchedule.push({ accountId, craftCounts: Object.fromEntries(craftCounts), consumedMaterials: stock, junkers,
      originalCooldownBetweenBoostsMs: CONSTANTS.GTA_CD_MS, possibleWaitMs: Math.max(0, junkers - 1) * CONSTANTS.GTA_CD_MS,
      roundTripFunding: quietProgression(accountId, 1, 500),
      semantics: 'One joint supply allocation, including operation consumptions and retained investigation items. Salvage each fresh car before the next boost. No consumed seal or material is reused; inspect the boss dock seal before route establishment consumes it.' });
  }
  details.push({ scope: 'resources', id: 'compatible-material-schedule', schedules: materialSchedule });
  const knowledgePath = need => {
    const ch = actors.get(need.accountId), root = need.requirement.sourceRoot;
    const graph = catalog.graphs.find(row => row.contentHash === need.requirement.contentHash);
    const exactDeclaration = graph?.nodes.some(node => node.claim && ['domain', 'proposition', 'sourceRoot'].every(key => node.claim[key] === need.requirement[key])
      && hash(node.claim.value) === hash(need.requirement.value));
    if (!enabled || !active(need.accountId) || !exactDeclaration || !capacity(need.accountId, need.requirement)
      || !freshSource(need.accountId, need.requirement) || !admissionPath(need.accountId, need.requirement)) return false;
    if (corroborationRoots[root]) {
      const originals = collaborations.get(need.id);
      return originals?.length === 2 && originals[0].accountId !== originals[1].accountId && crewProof(need.accountId).ok
        && originals.every(original => knowledgePath({ ...original, id: 'knowledge:' + original.accountId + ':' + hash(original.requirement) }));
    }
    if (['docks.posted-notice', 'foundry.printer-copy'].includes(root)) return canalPath.ok && ch.loc === 'docks'
      && (root === 'docks.posted-notice' || resourceStatus('resource:' + need.accountId + ':item:canal_cargo_seal') === 'REACHABLE'
        && quietProgression(need.accountId, 1, 500).ok);
    const item = craftedRoot[root], material = item ? resourceStatus('resource:' + need.accountId + ':' + item) === 'REACHABLE' : true;
    const located = ch && (ch.loc === 'docks' || root === 'foundry.impression' && ch.loc === 'foundry');
    return knownRoots.has(root) && material && located && (!item || quietProgression(need.accountId, 1, 500).ok)
      && (root !== 'foundry.impression' || materialProof(need.accountId).ok && quietProgression(need.accountId, 1, 500).ok);
  };
  // A crafted resource cannot be certified separately from its exact Knowledge
  // prerequisite. Propagate UNKNOWN through this finite reviewed recipe DAG.
  for (let pass = 0; pass < resourceNeeds.size; pass++) {
    let changed = false;
    for (const need of resourceNeeds.values()) {
      const witness = witnesses.find(row => row.scope === 'resources' && row.id === need.id);
      if (witness.status !== 'REACHABLE') continue;
      const recipe = catalog.nodes.find(node => node.type === 'recipe' && node.produces?.some(output => output.templateId === need.templateId));
      if ((recipe?.conditions || []).some(condition => condition.adapter === 'knowledge'
        && !knowledgePath({ accountId: need.accountId, requirement: condition.requirement }))) {
        witness.status = 'UNKNOWN'; changed = true;
        const detail = details.find(row => row.scope === 'resources' && row.id === need.id && row.status);
        detail.status = 'UNKNOWN'; detail.reason = 'Exact authored recipe Knowledge prerequisite needs an additional authorized acquisition/reuse proof.';
      }
    }
    if (!changed) break;
  }
  for (const need of knowledgeNeeds.values()) {
    const root = need.requirement.sourceRoot, ok = knowledgePath(need);
    const obligation = { id: need.id, goal: 'authorized-acquisition:' + hash(need.requirement), accountId: need.accountId, requirement: need.requirement, causes: need.causes };
    emit('knowledge', obligation, ok ? 'REACHABLE' : 'UNKNOWN', ok
      ? corroborationRoots[root] ? 'Original Crew admission plus two distinct discoverers, exact independent roots and authorized fresh account grants; the shared world/material paths are composed before remaining objective retirement.'
        : 'Exact authored original claim path: free own briefing/source nodes, named own mystery admission, original material path and, where required, the single compatible canal-exposure path. No claim/grant is fabricated.'
      : root?.startsWith('corroborated.') ? 'Needs a composed current Crew admission + independent original discoverers/roots proof; a copied claim is not independent evidence.'
        : /posted-notice|printer-copy/.test(root || '') ? 'Needs canonical canal-world transition to exposed and own notice/copy admissions; idle/missing world rows are not proof that this chain ran.'
          : 'Current location, declaration, original claim state, material, rollout or actor-visible evidence capacity needs a more specific source/native path.',
      { originals: collaborations.get(need.id) || [], ...(corroborationRoots[root] ? { crew: crewProof(need.accountId) } : {}) });
  }
  const propagationSources = ['docks.canal-register', 'docks.shipping-register', 'docks.manifest', 'docks.carbon-manifest', 'docks.tide-ledger'];
  for (const [index, accountId] of roster.entries()) {
    const recipient = actors.get(roster[(index + 1) % roster.length]);
    // These source nodes require only their free briefing/own free mystery node.
    // Issuance has the2048 owned bound; a false optional independent-evidence gate
    // elsewhere in the projection does not disable these source actions.
    const claim = actors.get(accountId)?.loc === 'docks' && claimRows.filter(row => row.owner_account_id === accountId).length < 2048
      ? propagationSources.map(routeRequirement).find(requirement => freshSource(accountId, requirement) && admissionPath(accountId, requirement)) : null;
    const ok = enabled && active(accountId) && recipient && recipient.account_id !== accountId && active(recipient.account_id)
      && !!claim;
    emit('knowledge', { id: 'propagation:' + accountId, goal: 'authorized-claim-acquisition-and-propagation', accountId }, ok ? 'REACHABLE' : 'UNKNOWN', ok
      ? 'One own fresh original free source claim, fresh server target token for the named active coactor, original current ACL revision, original share, then authorized recipient paginated read. New claims have zero grants. Receiving/reading this fresh grant does not run a256-candidate independent-evidence query.'
      : 'Needs an exact currently authorized coactor/claim/ACL capacity path; no hidden row is treated as player-visible Knowledge.',
    { recipientName: recipient?.name || null, selectedRequirement: claim || null });
  }
  const supplemental = { scope: 'Optional completion branches, not additional simultaneous gate obligations',
    inventories: { resources: inventories.resources.obligations, knowledge: inventories.knowledge.obligations.filter(row => !row.id.startsWith('propagation:')) } };
  const optionalIds = new Set([...supplemental.inventories.resources, ...supplemental.inventories.knowledge].map(row => row.id));
  supplemental.results = witnesses.filter(row => optionalIds.has(row.id)).map(row => ({ scope: row.scope, id: row.id, status: row.status }));
  inventories.resources.obligations = [];
  inventories.knowledge.obligations = inventories.knowledge.obligations.filter(row => row.id.startsWith('propagation:'));
  const recoveryComplete = diagnostics.objectiveInventory.tablesComplete && witnesses.filter(row => row.scope === 'objectives').every(row => row.status === 'REACHABLE');
  inventories.resources.complete &&= recoveryComplete;
  inventories.resources.derivation = 'Chosen original cancellation/retirement paths for all stored subjects require no consumable prerequisite. Optional completion recipes are retained separately, not required to coexist.';
  if (!recoveryComplete) inventories.knowledge.complete = false;
  if (!enabled) { inventories.resources.complete = false; inventories.knowledge.complete = false; }
  const joined = joinWorldCheckpointAssertions({ manifest, source, checkpoint, diagnostics, diagnosticEvidence, roster, inventories, witnesses, lifecycleWindows });
  return { binding: bound, sourceReviewSha256: source.checkpointReviewSha256, catalogApplicable: enabled, inventories, witnesses, details, supplemental, joined,
    limits: CHECKPOINT_RECOVERY_REVIEW.limits, matrixQualifying: false };
}
