// Observer-only, source-pinned sufficient paths for the frozen world assertions.
// A missing sufficient path is UNKNOWN, never proof of a dead world. No SQL/actor reads.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { canonicalRecoveryWitnesses, joinWorldCheckpointAssertions, verifyWorldRecoverySources } from './rc1-world-qualification.js';
import { compileCoordinationGraph } from '../src/coordination/graph.js';
import { CONSTANTS, levelOf } from '../src/rules.js';

const hash = value => sha256(canonicalJson(value));
const EXTENSION_PINS = Object.freeze({
  'src/mysteries.js': '9906386dff887b4ab528c6472418b00ae3d8b65ba971379e74065833bf2ea66b',
  'src/crafting.js': '68bc2f9f430b8b5d274a89ac1a6e4c330febcdccc58825c84058276dfaf035e8',
  'src/items.js': 'f086d9a45ab5cb7bbd063bf84e91886ebc754efc7acc1a39dc6858e2634ae5e8',
  'src/recipe-scarcity.js': '27e2132897c05909c3c594df92abcef32985404e2429c14317a648ab30c32d74',
  'src/coordination/graph.js': 'f2c0841a1fe995826f5c79843a0aee00bce41c70ce8fb20629c3276852b5ae5d',
  'src/coordination/runtime.js': '972abc70cb75b232929e1f1907e556ed00eea22e42567da9e68ad83ef1082d99',
  'src/routes/coordination.js': 'ae2ec43e4428d27f0c4e4b2d4bbd5e73a08c9a100860f45f7ad7e81ecc474165',
  'src/routes/worldgraph.js': '79f36c58583b3d4ce498227d28f27cee93a68091fb72fd144bc1ded14822a158',
  'src/world-prerequisites.js': 'b10249c0a66af084db8437e426d1f7659c5212390b3113a49e9583503820c2c9',
  'src/world-knowledge.js': 'b5bb787e2a6a5af60a04f28f98061232e936176f114d8ee4e929777cac52e816',
  'src/crew.js': '55c80abdc0043d2bb1a3cd1b0aac58b1a97c0637d547f2d5b7f5806543fb7d28',
  'src/content/automotive-salvage.js': 'b09eee77ec92a55131a1768b6ade37f3485654ff79a126c22256ff55e0f46266',
  'src/content/core-progression.js': '06a5e38a2dc3e1c1df1f1180734f5bc27f662487ee2b42788ae3078cf72691f7',
  'src/made.js': '87eaeda135d22ec07857a230124a8d569301deb53e198aa66b06575596ab51ab',
});
export const CHECKPOINT_RECOVERY_REVIEW = Object.freeze({
  format: 1, sourcePins: EXTENSION_PINS,
  catalogSha256: 'acadfb880100493a1bc5e8513c0c1d01395faeb8ca997535e9d807b53b69f139',
  scope: 'Current eligible roster, stored unresolved subjects, their authored item/Knowledge prerequisites and canonical retirement. No claim that every optional outcome can coexist or that these hypothetical paths were executed.',
  materialPath: 'Original boostCar has a positive success/junker branch, consumes10 energy, and creates an owned unlisted/unpledged/unminted/unraced car. One250-cash journey to foundry plus original car_salvage_basic produces6 scrap,2 wire,2 salvage parts. This is existential reachability, not a guaranteed finite number of random attempts. No OMR faucet or fixture item is transferred into the proof.',
  baseKnowledge: 'Docks manifest/ledger/register claims use original discover/complete actions; furnace manifest and dock tide admissions use the original free own mystery node. Countermark/chart additionally need the exact crafted key/seal. Fresh account-target tokens use an eligible coactor public character name; current claim owner and ACL revision authorize sharing, without Crew/Family membership.',
  limits: 'Corroborated Crew admissions and the informant exposed-world chain remain UNKNOWN until an applicable composed proof is supplied. Existing operation/campaign/crew-objective recovery has its own proof adapters; this review does not silently replace them. Nonordinary material guards and unfamiliar content remain UNKNOWN. These are evaluator coverage limits, not additional launch requirements.',
});
export async function verifyCheckpointRecoverySources(input) {
  const base = await verifyWorldRecoverySources(input);
  for (const [file, expected] of Object.entries(EXTENSION_PINS)) assert.equal(sha256(await input.readFile(file)), expected, 'Checkpoint review source changed: ' + file);
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
  const claimRows = table('coordination_claims');
  for (const need of knowledgeNeeds.values()) {
    const ch = actors.get(need.accountId), root = need.requirement.sourceRoot;
    const exactDeclaration = catalog.graphs.some(graph => graph.contentHash === need.requirement.contentHash && graph.nodes.some(node => node.claim
      && ['domain', 'proposition', 'sourceRoot'].every(key => node.claim[key] === need.requirement[key]) && hash(node.claim.value) === hash(need.requirement.value)));
    const item = craftedRoot[root], material = item ? resourceStatus('resource:' + need.accountId + ':' + item) === 'REACHABLE' : true;
    const located = ch && (ch.loc === 'docks' || root === 'foundry.impression' && ch.loc === 'foundry');
    const simpleTravel = root !== 'foundry.impression' || materialProof(need.accountId).ok;
    const headroom = claimRows.length < 256; // sufficient conservative bound; larger worlds can join exact per-requirement proofs
    const ok = enabled && active(need.accountId) && exactDeclaration && knownRoots.has(root) && material && located && simpleTravel && headroom;
    const obligation = { id: need.id, goal: 'authorized-acquisition:' + hash(need.requirement), accountId: need.accountId, requirement: need.requirement, causes: need.causes };
    emit('knowledge', obligation, ok ? 'REACHABLE' : 'UNKNOWN', ok
      ? 'Exact authored original claim path: free own briefing/source nodes, any named free mystery admission, and the retained exact material path where required. No claim/grant is fabricated.'
      : root?.startsWith('corroborated.') ? 'Needs a composed current Crew admission + independent original discoverers/roots proof; a copied claim is not independent evidence.'
        : /posted-notice|printer-copy/.test(root || '') ? 'Needs canonical canal-world transition to exposed and own notice/copy admissions; idle/missing world rows are not proof that this chain ran.'
          : 'Current location, declaration, material, rollout or bounded evidence-headroom guards need a more specific source/native path.');
  }
  for (const [index, accountId] of roster.entries()) {
    const recipient = actors.get(roster[(index + 1) % roster.length]);
    const ok = enabled && active(accountId) && recipient && recipient.account_id !== accountId && active(recipient.account_id)
      && actors.get(accountId).loc === 'docks' && claimRows.length < 256 && table('coordination_claim_grants').length === 0;
    emit('knowledge', { id: 'propagation:' + accountId, goal: 'authorized-claim-acquisition-and-propagation', accountId }, ok ? 'REACHABLE' : 'UNKNOWN', ok
      ? 'Own free canal-register claim, fresh server target token for the named active coactor, current ACL revision, original share, then authorized recipient read. Zero existing grants and bounded claims leave original limits available.'
      : 'Needs an exact currently authorized coactor/claim/ACL capacity path; no hidden row is treated as player-visible Knowledge.', { recipientName: recipient?.name || null });
  }
  if (!enabled) { inventories.resources.complete = false; inventories.knowledge.complete = false; }
  const joined = joinWorldCheckpointAssertions({ manifest, source, checkpoint, diagnostics, diagnosticEvidence, roster, inventories, witnesses, lifecycleWindows });
  return { binding: bound, sourceReviewSha256: source.checkpointReviewSha256, catalogApplicable: enabled, inventories, witnesses, details, joined,
    limits: CHECKPOINT_RECOVERY_REVIEW.limits, matrixQualifying: false };
}
