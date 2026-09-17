// Admission for a source-controlled composition of existing domain engines. This
// checks the actual compiled references; a manifest never grants runtime authority.
import crypto from 'node:crypto';
import { GameError } from '../game.js';
import { canonicalBytes } from './canonical.js';
import { loadAndValidateGraphPackages } from '../worldgraph-validate.js';
import { validateCraftingDefinitions } from '../crafting.js';
import { validateMysteryDefinitions, mysteryDefinitionHash } from '../mysteries.js';
import { createCoordinationRegistry, coordinationGraphs } from '../coordination/graph.js';
import { compileWorldObjects } from '../world-kernel.js';
import { compileFamilyOperations } from '../coordination/operation-definitions.js';
import { isWorldGraphRegistry } from '../worldgraph.js';

const fail = (code = 'progression_definition_invalid') => {
  throw new GameError(code, 'The authored progression does not satisfy its admission contract.');
};
const hash = (value) => crypto.createHash('sha256').update(canonicalBytes(value)).digest('hex');
const freeze = (value) => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function record(value, fields) {
  if (!value || Array.isArray(value) || Object.keys(value).length !== fields.length
    || fields.some((key) => !Object.hasOwn(value, key))) fail();
}
function list(value, minimum = 1, maximum = 64) {
  if (!Array.isArray(value) || value.length < minimum || value.length > maximum) fail();
  return value;
}
function strings(value) {
  list(value);
  if (value.some((id) => typeof id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(id))
    || new Set(value).size !== value.length) fail();
  return value;
}
function walk(value, visit) {
  if (!value || typeof value !== 'object') return;
  visit(value);
  for (const entry of Object.values(value)) walk(entry, visit);
}
function acyclic(edges) {
  const visiting = new Set(), seen = new Set();
  function visit(id) {
    if (visiting.has(id)) fail('progression_dependency_cycle');
    if (seen.has(id)) return;
    visiting.add(id);
    for (const target of edges.get(id) || []) visit(target);
    visiting.delete(id); seen.add(id);
  }
  for (const id of edges.keys()) visit(id);
}

export function compileProgressionContent(input, { baseRegistry } = {}) {
  if (!isWorldGraphRegistry(baseRegistry)) fail('progression_base_registry');
  // canonicalBytes rejects functions, getters, inherited authority, cycles, and
  // unsafe numbers before any domain compiler traverses untrusted authored data.
  let source;
  try {
    const bytes = canonicalBytes(input);
    if (bytes.length > 1_000_000) fail('progression_definition_limit');
    source = JSON.parse(bytes.toString('utf8'));
  } catch (error) { if (error instanceof GameError) throw error; fail(); }
  record(source, ['packages', 'coordination', 'worldObjects', 'familyOperations', 'manifest']);
  for (const field of ['packages', 'coordination', 'worldObjects', 'familyOperations']) list(source[field]);
  const manifest = source.manifest;
  record(manifest, ['id', 'version', 'title', 'packageIds', 'coordinationGraphIds', 'worldObjectIds', 'familyOperationIds', 'entry', 'choice', 'branches']);
  strings([manifest.id]);
  if (!Number.isSafeInteger(manifest.version) || manifest.version < 1 || manifest.version > 2147483647
    || typeof manifest.title !== 'string' || !manifest.title.trim() || manifest.title.length > 120) fail();
  for (const field of ['packageIds', 'coordinationGraphIds', 'worldObjectIds', 'familyOperationIds']) strings(manifest[field]);
  const declaredPackages = new Set(manifest.packageIds);
  for (const pkg of source.packages) {
    const baseline = baseRegistry.byPackage.get(pkg.id);
    if (baseline ? declaredPackages.has(pkg.id) || !canonicalBytes(baseline).equals(canonicalBytes(pkg)) : !declaredPackages.has(pkg.id)) {
      fail('progression_unclaimed_definition');
    }
  }
  if ([...baseRegistry.byPackage.keys()].some((id) => !source.packages.some((pkg) => pkg.id === id))) fail('progression_base_registry');
  record(manifest.entry, ['graphId', 'nodeId']); record(manifest.choice, ['graphId', 'nodeId']);
  list(manifest.branches, 2, 4);
  for (const branch of manifest.branches) record(branch, ['optionId', 'nodeId', 'operationId', 'worldState', 'epilogueGraphId', 'epilogueNodeId']);

  const registry = loadAndValidateGraphPackages(source.packages);
  validateCraftingDefinitions(registry); validateMysteryDefinitions(registry);
  const coordinationRegistry = createCoordinationRegistry(source.coordination);
  const graphs = coordinationGraphs(coordinationRegistry);
  const worldDefinitions = compileWorldObjects(registry, source.worldObjects);
  const familyDefinitions = compileFamilyOperations(registry, worldDefinitions, source.familyOperations);
  const graphMap = new Map(graphs.map((graph) => [graph.id, graph]));
  const worlds = new Map(worldDefinitions.map((world) => [world.id, world]));
  const operations = new Map(familyDefinitions.map((operation) => [operation.id, operation]));
  const selected = (ids, map) => { if (ids.some((id) => !map.has(id))) fail('progression_reference'); };
  selected(manifest.packageIds, registry.byPackage); selected(manifest.coordinationGraphIds, graphMap);
  selected(manifest.worldObjectIds, worlds); selected(manifest.familyOperationIds, operations);
  if (graphs.length !== manifest.coordinationGraphIds.length || worlds.size !== manifest.worldObjectIds.length
    || operations.size !== manifest.familyOperationIds.length) fail('progression_unclaimed_definition');
  const managedPackages = new Set(manifest.packageIds);
  const pins = new Map();
  const packagePin = (id) => {
    if (!pins.has(id)) pins.set(id, mysteryDefinitionHash(registry, id));
    return pins.get(id);
  };
  const dependencies = new Map(), flow = new Map(), stages = new Set(), pinChecks = [];
  const edge = (map, from, to) => { if (!map.has(from)) map.set(from, new Set()); map.get(from).add(to); };
  const pkgKey = (id) => `package:${id}`;
  const graphKey = (id) => `coordination:${id}`;
  const worldKey = (id) => `world:${id}`;
  const operationKey = (id) => `family:${id}`;
  const mysteryKey = (id) => `mystery:${id}`;
  const claimKey = (graph, node) => `${graphKey(graph.id)}/${node.id}`;
  const recipes = [...registry.nodes.values()].filter((node) => node.type === 'recipe');
  const producerKeys = (templateId) => recipes.filter((node) => node.produces?.some((output) => output.templateId === templateId)).map((node) => `recipe:${node.id}`);
  const claimSources = [];
  for (const graph of graphs) for (const node of graph.nodes) if (node.claim) {
    claimSources.push({ graph, node });
  }
  function reference(owner, stage, wrapper) {
    if (!wrapper.adapter || !Object.hasOwn(wrapper, 'requirement')) return;
    const value = wrapper.requirement;
    if (wrapper.adapter === 'knowledge') {
      const { contentHash, ...identity } = value;
      const matching = claimSources.filter(({ node }) => canonicalBytes(identity).equals(canonicalBytes(node.claim)));
      if (matching.length !== 1) fail('progression_reference');
      const [claim] = matching;
      pinChecks.push(() => { if (contentHash !== claim.graph.contentHash) fail('progression_reference'); });
      edge(dependencies, owner, graphKey(claim.graph.id)); edge(flow, claimKey(claim.graph, claim.node), stage);
    } else if (wrapper.adapter === 'mystery_state') {
      const node = registry.nodes.get(value.nodeId), pkg = registry.byPackage.get(value.graphId);
      if (!managedPackages.has(value.graphId) || node?.packageId !== value.graphId
        || !['mystery_step', 'world_gate', 'choice', 'evidence', 'reward'].includes(node.type)
        || pkg?.version !== value.graphVersion) fail('progression_reference');
      pinChecks.push(() => { if (packagePin(pkg.id) !== value.definitionHash) fail('progression_reference'); });
      edge(dependencies, owner, pkgKey(pkg.id)); edge(flow, mysteryKey(node.id), stage);
    } else if (wrapper.adapter === 'family_operation_outcome') {
      const operation = operations.get(value.definitionId);
      if (!operation) fail('progression_reference');
      pinChecks.push(() => { if (operation.contentHash !== value.definitionHash) fail('progression_reference'); });
      edge(dependencies, owner, operationKey(operation.id)); edge(flow, operationKey(operation.id), stage);
    } else if (wrapper.adapter === 'world_state') {
      const world = worlds.get(value.objectId);
      if (!world || !world.states.includes(value.state)) fail('progression_reference');
      pinChecks.push(() => { if (world.contentHash !== value.definitionHash) fail('progression_reference'); });
      edge(dependencies, owner, worldKey(world.id));
      for (const operation of familyDefinitions) if (operation.world.objectId === world.id
        && world.actions.find((action) => action.id === operation.world.actionId)?.to === value.state) edge(flow, operationKey(operation.id), stage);
    } else if (wrapper.adapter === 'item_ownership') {
      const template = registry.nodes.get(value.templateId);
      if (template?.type !== 'item_template' || !producerKeys(template.id).length) fail('progression_reference');
      edge(dependencies, owner, pkgKey(template.packageId));
      producerKeys(template.id).forEach((producer) => edge(flow, producer, stage));
    }
  }
  for (const pkg of registry.byPackage.values()) {
    if (!dependencies.has(pkgKey(pkg.id))) dependencies.set(pkgKey(pkg.id), new Set());
    for (const dependency of pkg.dependsOn || []) edge(dependencies, pkgKey(pkg.id), pkgKey(typeof dependency === 'string' ? dependency : dependency.id));
  }
  for (const node of registry.nodes.values()) {
    if (!managedPackages.has(node.packageId)) continue;
    const stage = node.type === 'recipe' ? `recipe:${node.id}` : mysteryKey(node.id);
    if (['mystery_step', 'world_gate', 'choice', 'evidence', 'reward', 'recipe'].includes(node.type)) stages.add(stage);
    walk(node, (value) => reference(pkgKey(node.packageId), stage, value));
    for (const id of [...node.requires || [], ...(node.requiresAny || []).flat()]) edge(flow, mysteryKey(id), stage);
    for (const effect of [...node.effects || [], ...(node.options || []).flatMap((option) => option.effects || [])]) {
      if (effect.nodeId) edge(flow, stage, mysteryKey(effect.nodeId));
    }
    for (const condition of node.conditions || []) if (['item_ownership', 'owns_item'].includes(condition.adapter) && condition.templateId) {
      producerKeys(condition.templateId).forEach((producer) => edge(flow, producer, stage));
    }
  }
  for (const graph of graphs) for (const node of graph.nodes) {
    const stage = claimKey(graph, node);
    // Coordination's terminal only records closure after discovery. Its claimed
    // evidence producers, not that bookkeeping node, feed the next engine.
    if (node.kind !== 'terminal') stages.add(stage);
    walk(node, (value) => {
      reference(graphKey(graph.id), stage, value);
      if (value.kind === 'node_completed') edge(flow, `${graphKey(graph.id)}/${value.nodeId}`, stage);
      if (value.kind === 'independent_evidence') for (const root of value.sourceRoots) {
        const producer = graph.nodes.find((sourceNode) => sourceNode.claim?.sourceRoot === root);
        if (!producer) fail('progression_reference');
        edge(flow, claimKey(graph, producer), stage);
      }
    });
  }
  for (const world of worldDefinitions) {
    for (const requirement of world.knowledge) reference(worldKey(world.id), worldKey(world.id), { adapter: 'knowledge', requirement });
  }
  for (const operation of familyDefinitions) {
    const stage = operationKey(operation.id); stages.add(stage);
    edge(dependencies, stage, worldKey(operation.world.objectId));
    walk(operation, (value) => reference(stage, stage, value));
    for (const role of operation.roles) for (const requirement of role.requirements) {
      if (requirement.kind === 'information') reference(stage, stage, { adapter: 'knowledge', requirement: requirement.knowledge });
      if (requirement.kind === 'item') producerKeys(requirement.templateId).forEach((producer) => edge(flow, producer, stage));
    }
  }
  acyclic(dependencies);
  pinChecks.forEach((check) => check());

  const entry = registry.nodes.get(manifest.entry.nodeId), choice = registry.nodes.get(manifest.choice.nodeId);
  if (entry?.packageId !== manifest.entry.graphId || entry.visibility !== 'public' || entry.type !== 'mystery_step'
    || choice?.packageId !== manifest.choice.graphId || choice.type !== 'choice'
    || !choice.conditions?.some((condition) => condition.adapter === 'knowledge')
    || choice.options.length !== manifest.branches.length) fail('progression_branch');
  const choiceClaims = choice.conditions.filter((condition) => condition.adapter === 'knowledge')
    .map((condition) => claimSources.find(({ graph, node }) => canonicalBytes({ contentHash: graph.contentHash, ...node.claim })
      .equals(canonicalBytes(condition.requirement))));
  if (!choiceClaims.some((sourceClaim) => {
    let independent = false;
    walk(sourceClaim?.node.discover, (rule) => { if (rule.kind === 'independent_evidence') independent = true; });
    return independent && sourceClaim.node.admission?.some((predicate) => predicate.adapter === 'social'
      && predicate.requirement.relation === 'crew_member');
  })) fail('progression_cooperation');
  const branchIds = manifest.branches.map((branch) => branch.nodeId);
  if (new Set(branchIds).size !== branchIds.length
    || new Set(manifest.branches.map((branch) => branch.optionId)).size !== branchIds.length
    || new Set(manifest.branches.map((branch) => branch.operationId)).size !== branchIds.length
    || new Set(manifest.branches.map((branch) => branch.worldState)).size !== branchIds.length) fail('progression_branch');
  const ends = new Set();
  for (const branch of manifest.branches) {
    const option = choice.options.find((entry) => entry.id === branch.optionId), node = registry.nodes.get(branch.nodeId);
    const operation = operations.get(branch.operationId), world = worlds.get(operation?.world.objectId);
    const action = world?.actions.find((entry) => entry.id === operation.world.actionId);
    const epilogue = registry.nodes.get(branch.epilogueNodeId);
    const branchGate = operation?.roles.find((role) => role.id === operation.executorRoleId)?.requirements.find((required) => required.kind === 'prerequisite'
      && required.predicate.adapter === 'mystery_state' && required.predicate.requirement.nodeId === branch.nodeId);
    if (!option || node?.packageId !== choice.packageId || !node.requires?.includes(choice.id)
      || !option.effects?.some((effect) => effect.adapter === 'discover' && effect.nodeId === node.id)
      || branchIds.filter((id) => id !== node.id).some((id) => !option.excludes?.includes(id) || !node.excludes?.includes(id))
      || !branchGate || !operation.admission?.some((predicate) => predicate.adapter === 'mystery_state'
        && predicate.requirement.nodeId === node.id && predicate.requirement.graphId === node.packageId)
      || action?.execution !== 'family_operation' || action.to !== branch.worldState
      || action.from !== world.initialState || world.actions.some((other) => other.from === branch.worldState)
      || !world.publicStates.includes(branch.worldState)
      || epilogue?.packageId !== branch.epilogueGraphId || epilogue.packageId === choice.packageId || epilogue.metadata?.terminal !== true
      || !epilogue.conditions?.some((condition) => condition.adapter === 'family_operation_outcome'
        && condition.requirement.definitionId === operation.id && condition.requirement.definitionHash === operation.contentHash
        && condition.requirement.outcome === 'completed')) fail('progression_branch');
    ends.add(mysteryKey(epilogue.id));
  }
  for (const world of worldDefinitions) {
    const usedActions = familyDefinitions.filter((operation) => operation.world.objectId === world.id).map((operation) => operation.world.actionId);
    if (world.actions.some((action) => action.execution !== 'family_operation' || !usedActions.includes(action.id))
      || world.states.some((state) => state !== world.initialState && !world.actions.some((action) => action.to === state))) fail('progression_branch');
  }
  // Every executable authored stage must lead to a declared terminal. This also
  // catches otherwise legal hidden dangling clues that local validators skip.
  const reaching = new Set(ends);
  let changed = true;
  while (changed) { changed = false; for (const [from, targets] of flow) if (!reaching.has(from) && [...targets].some((to) => reaching.has(to))) { reaching.add(from); changed = true; } }
  if (!reaching.has(mysteryKey(entry.id)) || [...stages].some((stage) => !reaching.has(stage))) fail('progression_dead_end');

  // Public prose cannot embed private IDs, answer values, or secret metadata.
  const secrets = new Set();
  for (const node of registry.nodes.values()) if (managedPackages.has(node.packageId) && node.visibility !== 'public') {
    secrets.add(node.id); if (node.metadata?.secret) secrets.add(node.metadata.secret);
  }
  for (const graph of graphs) for (const node of graph.nodes) if (node.visibility === 'hidden') {
    secrets.add(node.id);
    if (node.claim) { secrets.add(node.claim.sourceRoot); if (node.claim.value.type === 'text') secrets.add(node.claim.value.value); }
  }
  const publicProse = [manifest.title];
  for (const node of registry.nodes.values()) if (managedPackages.has(node.packageId) && node.visibility === 'public') {
    if (node.metadata?.secret) fail('progression_privacy');
    publicProse.push(...Object.values(node.metadata || {}).filter((value) => typeof value === 'string'));
  }
  for (const graph of graphs) { publicProse.push(graph.title); for (const node of graph.nodes) if (node.visibility === 'public') publicProse.push(node.title, node.description || ''); }
  if (publicProse.some((text) => [...secrets].some((secret) => secret.length >= 4 && text.includes(secret)))) fail('progression_privacy');
  const contentHash = hash(source);
  return Object.freeze({ registry, coordinationRegistry, worldDefinitions, familyDefinitions,
    manifest: freeze(manifest), contentHash, source: freeze(source),
    publicCatalog: freeze({ id: manifest.id, version: manifest.version, title: manifest.title }) });
}
