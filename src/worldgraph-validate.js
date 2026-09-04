import { loadGraphPackages } from './worldgraph.js';

const CONDITION_ADAPTERS = new Set([
  'graph_dependency',
  'location',
  'level',
  'skill',
  'item_ownership',
  'owns_item',
  'material_quantity',
  'evidence',
  'time_window',
  'explicit_interaction',
  'owns_car',
]);

const QUANTITY_FIELDS = [
  'consumes', 'produces', 'inputs', 'outputs', 'catalysts', 'catalystInputs',
];
const SEEDED_FLAGS = ['administratorSeeded', 'adminSeeded', 'seasonalSeeded'];
const EXTERNAL_ASSET_TYPES = new Set(['car']);
const VISIBILITIES = new Set(['public', 'discovered', 'hidden', 'role_private']);
// Exact simple-cycle analysis is deliberately fail-closed above this Phase 1 boundary.
const MAX_EXACT_RECIPE_SCC_TEMPLATES = 8;
const MAX_EXACT_RECIPE_SCC_EDGES = MAX_EXACT_RECIPE_SCC_TEMPLATES ** 2;
const MAX_EXACT_RECIPE_CYCLES = 20_000;
const MAX_GRAPH_WITNESSES_PER_NODE = 128;
// Phase 1 ships four-seat operations; eight bounds the exact coloring solver with headroom.
const MAX_PHASE1_SOCIAL_ROLES = 8;

export class GraphValidationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GraphValidationError';
    this.code = code;
    this.details = Object.freeze({ ...details });
  }
}

function fail(code, message, details) {
  throw new GraphValidationError(code, message, details);
}

function nonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function positiveInteger(value) {
  return Number.isInteger(value) && value > 0;
}

function packageDependency(dependency, packageId) {
  if (nonEmptyString(dependency)) return { id: dependency };
  if (!dependency || typeof dependency !== 'object' || Array.isArray(dependency)
    || !nonEmptyString(dependency.id)) {
    fail('malformed_package_dependency',
      `Package ${packageId} has a malformed package dependency; expected an ID or version constraint`,
      { packageId, dependency });
  }

  for (const field of ['version', 'minVersion', 'maxVersion']) {
    if (dependency[field] !== undefined && !positiveInteger(dependency[field])) {
      fail('malformed_package_dependency',
        `Package ${packageId} has a malformed package dependency ${dependency.id}: ${field} must be a positive integer`,
        { packageId, dependencyId: dependency.id, field });
    }
  }
  if (dependency.minVersion !== undefined && dependency.maxVersion !== undefined
    && dependency.minVersion > dependency.maxVersion) {
    fail('malformed_package_dependency',
      `Package ${packageId} has a malformed package dependency ${dependency.id}: minVersion exceeds maxVersion`,
      { packageId, dependencyId: dependency.id });
  }
  return dependency;
}

function validatePackageDependencies(registry) {
  const edges = new Map();
  for (const [packageId, pkg] of registry.byPackage) {
    if (!nonEmptyString(packageId) || !positiveInteger(pkg.version)) {
      fail('malformed_package',
        `Graph package ${String(packageId)} requires a stable ID and positive integer version`,
        { packageId });
    }
    if (!Array.isArray(pkg.dependsOn)) {
      fail('malformed_package_dependency',
        `Package ${packageId} dependsOn must be an array`, { packageId });
    }

    const packageEdges = [];
    const seen = new Set();
    for (const rawDependency of pkg.dependsOn) {
      const dependency = packageDependency(rawDependency, packageId);
      if (seen.has(dependency.id)) {
        fail('duplicate_package_dependency',
          `Package ${packageId} declares duplicate dependency ${dependency.id}`,
          { packageId, dependencyId: dependency.id });
      }
      seen.add(dependency.id);
      if (dependency.id === packageId) {
        fail('package_dependency_cycle',
          `Package dependency cycle: ${packageId} depends on itself`, { packageId });
      }
      const loaded = registry.byPackage.get(dependency.id);
      if (!loaded) {
        fail('missing_package_dependency',
          `Package ${packageId} has missing package dependency ${dependency.id}`,
          { packageId, dependencyId: dependency.id });
      }
      const incompatible = (dependency.version !== undefined && loaded.version !== dependency.version)
        || (dependency.minVersion !== undefined && loaded.version < dependency.minVersion)
        || (dependency.maxVersion !== undefined && loaded.version > dependency.maxVersion);
      if (incompatible) {
        fail('incompatible_package_version',
          `Package ${packageId} requires an incompatible version of ${dependency.id}; loaded version is ${loaded.version}`,
          { packageId, dependencyId: dependency.id, loadedVersion: loaded.version });
      }
      packageEdges.push(dependency.id);
    }
    edges.set(packageId, packageEdges);
  }

  const visiting = new Set();
  const visited = new Set();
  const path = [];
  function visit(packageId) {
    if (visiting.has(packageId)) {
      const start = path.indexOf(packageId);
      const cycle = [...path.slice(start), packageId];
      fail('package_dependency_cycle',
        `Package dependency cycle: ${cycle.join(' -> ')}`, { cycle });
    }
    if (visited.has(packageId)) return;
    visiting.add(packageId);
    path.push(packageId);
    for (const dependencyId of edges.get(packageId) || []) visit(dependencyId);
    path.pop();
    visiting.delete(packageId);
    visited.add(packageId);
  }
  for (const packageId of edges.keys()) visit(packageId);
  return edges;
}

function validateDependencyList(node, field) {
  const value = node[field];
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((id) => !nonEmptyString(id))) {
    fail('malformed_dependency',
      `Node ${node.id} field ${field} must be an array of node IDs`,
      { nodeId: node.id, field });
  }
  return value;
}

function validateRequiresAny(node) {
  if (node.requiresAny === undefined) return [];
  if (!Array.isArray(node.requiresAny)
    || node.requiresAny.some((group) => (
      !Array.isArray(group) || group.length === 0 || group.some((id) => !nonEmptyString(id))
    ))) {
    fail('malformed_dependency',
      `Node ${node.id} field requiresAny must be an array of non-empty arrays of node IDs`,
      { nodeId: node.id, field: 'requiresAny' });
  }
  return node.requiresAny.flat();
}

function quantityReference(entry) {
  if (nonEmptyString(entry)) return { id: entry, external: false };
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return null;
  const id = entry.templateId || entry.nodeId || entry.materialId || entry.itemTemplateId || entry.id;
  if (nonEmptyString(id)) return { id, external: false };
  if (nonEmptyString(entry.assetType) && EXTERNAL_ASSET_TYPES.has(entry.assetType)) {
    return { id: `asset:${entry.assetType}`, external: true };
  }
  return null;
}

function quantityEntries(node, field, { recipe = false } = {}) {
  const value = node[field];
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fail(recipe ? 'invalid_recipe_quantity' : 'malformed_reference',
      `${node.type} ${node.id} field ${field} must be an array`,
      { nodeId: node.id, field });
  }
  return value.map((entry) => {
    const reference = quantityReference(entry);
    if (!reference) {
      fail(recipe ? 'invalid_recipe_quantity' : 'malformed_reference',
        `${node.type} ${node.id} has a malformed ${field} reference`,
        { nodeId: node.id, field });
    }
    const { id, external } = reference;
    const quantity = typeof entry === 'object' && entry !== null ? entry.quantity : undefined;
    if (recipe && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity))) {
      fail('invalid_recipe_quantity',
        `Recipe ${node.id} requires a positive quantity for ${id} in ${field}`,
        { nodeId: node.id, field, templateId: id, quantity });
    }
    if (!recipe && quantity !== undefined
      && (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity))) {
      fail('invalid_quantity',
        `${node.type} ${node.id} requires a positive quantity for ${id} in ${field}`,
        { nodeId: node.id, field, templateId: id, quantity });
    }
    return { id, external, quantity: quantity ?? 1, entry };
  });
}

function conditionAdapter(condition) {
  if (typeof condition === 'string') return condition;
  if (condition && typeof condition === 'object' && !Array.isArray(condition)) {
    return condition.adapter || condition.type || condition.kind;
  }
  return null;
}

function conditionField(condition, fields, context = {}) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return undefined;
  const declared = fields
    .filter((field) => condition[field] !== undefined)
    .map((field) => ({ field, value: condition[field] }));
  const normalized = [];
  for (const { value } of declared) {
    const comparable = typeof value === 'string' ? value.trim() : value;
    if (!normalized.some((candidate) => Object.is(candidate, comparable))) {
      normalized.push(comparable);
    }
  }
  if (normalized.length > 1) {
    fail('conflicting_condition_alias',
      `${context.owner || 'Condition'} has conflicting ${context.adapter || 'condition'} aliases: ${declared.map(({ field }) => field).join(', ')}`,
      { ...context, aliases: declared.map(({ field }) => field) });
  }
  return declared[0]?.value;
}

function assertConditionReference({
  registry, packageClosures, packageId, nodeId, roleId, adapter, targetId, targetType,
}) {
  const owner = roleId ? `Social role ${roleId}` : `Node ${nodeId}`;
  if (!nonEmptyString(targetId)) {
    fail('malformed_condition',
      `${owner} ${adapter} condition requires a ${targetType || 'node'} template reference`,
      { nodeId, roleId, adapter });
  }
  const target = registry.nodes.get(targetId);
  if (!target) {
    fail('missing_node_dependency', `${owner} has missing dependency ${targetId}`,
      { nodeId, roleId, adapter, dependencyId: targetId });
  }
  if (targetType && target.type !== targetType) {
    fail('invalid_condition_target',
      `${owner} ${adapter} condition must reference a ${targetType}, not ${target.type}`,
      { nodeId, roleId, adapter, dependencyId: targetId, expectedType: targetType });
  }
  if (target.packageId !== packageId && !packageClosures.get(packageId).has(target.packageId)) {
    fail('undeclared_package_dependency',
      `${owner} references ${targetId} but package ${packageId} does not declare package dependency ${target.packageId}`,
      {
        nodeId,
        roleId,
        dependencyId: targetId,
        packageId,
        requiredPackageId: target.packageId,
      });
  }
  return target;
}

function validateConditionList({
  registry, packageClosures, packageId, nodeId, roleId = null, conditions,
}) {
  const owner = roleId ? `Social role ${roleId}` : `Node ${nodeId}`;
  if (conditions === undefined) return [];
  if (!Array.isArray(conditions)) {
    fail('malformed_condition', `${owner} conditions must be an array`, { nodeId, roleId });
  }

  const descriptors = [];
  const locations = new Set();
  for (const condition of conditions) {
    const adapter = conditionAdapter(condition);
    if (!nonEmptyString(adapter)) {
      fail('malformed_condition', `${owner} has a condition without a named adapter`,
        { nodeId, roleId });
    }
    if (!CONDITION_ADAPTERS.has(adapter)) {
      fail('unsupported_condition_adapter',
        `${owner} uses unsupported condition adapter ${adapter}`,
        { nodeId, roleId, adapter });
    }
    const field = (fields) => conditionField(condition, fields, {
      owner, nodeId, roleId, adapter,
    });

    let targetId = null;
    let targetType = null;
    if (adapter === 'graph_dependency') {
      targetId = field(['nodeId', 'id', 'value']);
    } else if (adapter === 'item_ownership' || adapter === 'owns_item') {
      targetId = field(['templateId', 'itemTemplateId', 'nodeId']);
      targetType = 'item_template';
    } else if (adapter === 'material_quantity') {
      targetId = field(['templateId', 'materialId', 'nodeId']);
      targetType = 'material';
      const quantity = field(['quantity', 'minimumQuantity', 'amount']);
      if (!positiveInteger(quantity)) {
        fail('malformed_condition',
          `${owner} material_quantity condition requires a positive integer quantity`,
          { nodeId, roleId, adapter, quantity });
      }
    } else if (adapter === 'evidence') {
      targetId = field(['evidenceId', 'nodeId']);
      targetType = 'evidence';
    } else if (adapter === 'location') {
      const location = field(['value', 'locationId', 'district']);
      if (!nonEmptyString(location)) {
        fail('malformed_condition', `${owner} location condition requires a location`,
          { nodeId, roleId, adapter });
      }
      locations.add(location);
    } else if (adapter === 'level') {
      const level = field(['value', 'minimumLevel', 'level']);
      if (!positiveInteger(level)) {
        fail('malformed_condition', `${owner} level condition requires a positive integer level`,
          { nodeId, roleId, adapter, level });
      }
    } else if (adapter === 'skill') {
      const skillId = field(['skillId', 'id', 'value']);
      if (!nonEmptyString(skillId)) {
        fail('malformed_condition', `${owner} skill condition requires a skillId`,
          { nodeId, roleId, adapter });
      }
    } else if (adapter === 'time_window') {
      const windowId = field(['windowId', 'value']);
      const start = field(['start', 'startsAt']);
      const end = field(['end', 'endsAt']);
      if (!nonEmptyString(windowId) && !(nonEmptyString(start) && nonEmptyString(end))) {
        fail('malformed_condition',
          `${owner} time_window condition requires a windowId or start and end`,
          { nodeId, roleId, adapter });
      }
      if (start !== undefined || end !== undefined) {
        if (!nonEmptyString(start) || !nonEmptyString(end)
          || !Number.isFinite(Date.parse(start)) || !Number.isFinite(Date.parse(end))) {
          fail('malformed_condition',
            `${owner} time_window condition requires valid timestamps`,
            { nodeId, roleId, adapter, start, end });
        }
        if (Date.parse(start) >= Date.parse(end)) {
          fail('malformed_condition',
            `${owner} time_window condition requires start before end`,
            { nodeId, roleId, adapter, start, end });
        }
      }
    } else if (adapter === 'explicit_interaction') {
      const interactionId = field(['interactionId', 'id', 'value']);
      if (!nonEmptyString(interactionId)) {
        fail('malformed_condition',
          `${owner} explicit_interaction condition requires an interactionId`,
          { nodeId, roleId, adapter });
      }
    } else if (adapter === 'owns_car') {
      const carSelector = field([
        'value', 'carId', 'carType', 'vehicleClass', 'assetType',
      ]);
      if (!nonEmptyString(carSelector)) {
        fail('malformed_condition', `${owner} owns_car condition requires a car selector`,
          { nodeId, roleId, adapter });
      }
    }

    if (targetId !== null) {
      assertConditionReference({
        registry,
        packageClosures,
        packageId,
        nodeId,
        roleId,
        adapter,
        targetId,
        targetType,
      });
    }
    descriptors.push(Object.freeze({ adapter, targetId, targetType }));
  }

  if (locations.size > 1) {
    fail('impossible_condition_set',
      `${owner} has conflicting location conditions: ${[...locations].join(', ')}`,
      { nodeId, roleId, adapter: 'location', values: [...locations] });
  }
  return descriptors;
}

function dependencyClosure(packageEdges, packageId, result = new Set()) {
  for (const dependencyId of packageEdges.get(packageId) || []) {
    if (result.has(dependencyId)) continue;
    result.add(dependencyId);
    dependencyClosure(packageEdges, dependencyId, result);
  }
  return result;
}

function validateNodeReferences(registry, packageEdges) {
  const dependencyEdges = new Map();
  const quantityByNode = new Map();
  const conditionByNode = new Map();
  const packageClosures = new Map();
  for (const packageId of registry.byPackage.keys()) {
    packageClosures.set(packageId, dependencyClosure(packageEdges, packageId));
  }
  for (const [nodeId, node] of registry.nodes) {
    if (!nonEmptyString(nodeId) || !nonEmptyString(node.type)) {
      fail('malformed_node', `Graph node ${String(nodeId)} requires a stable ID and type`, { nodeId });
    }
    if (node.visibility !== undefined && !VISIBILITIES.has(node.visibility)) {
      fail('invalid_visibility',
        `Node ${nodeId} has unsupported visibility ${String(node.visibility)}`,
        { nodeId, visibility: node.visibility });
    }
    const required = validateDependencyList(node, 'requires');
    const excluded = validateDependencyList(node, 'excludes');
    const requiredAlternatives = validateRequiresAny(node);
    const contradictory = required.find((dependencyId) => excluded.includes(dependencyId));
    if (contradictory) {
      fail('contradictory_dependency',
        `Node ${nodeId} both requires and excludes ${contradictory}`,
        { nodeId, dependencyId: contradictory });
    }
    const blockedAlternativeGroup = (node.requiresAny || []).find((group) => (
      group.every((dependencyId) => excluded.includes(dependencyId))
    ));
    if (blockedAlternativeGroup) {
      fail('contradictory_dependency',
        `Node ${nodeId} excludes every option in a requiresAny group`,
        { nodeId, dependencyIds: blockedAlternativeGroup });
    }
    const references = [];
    references.push(...required, ...excluded);
    references.push(...requiredAlternatives);
    const quantities = {};
    for (const field of QUANTITY_FIELDS) {
      quantities[field] = quantityEntries(node, field, { recipe: node.type === 'recipe' });
      references.push(...quantities[field].filter(({ external }) => !external).map(({ id }) => id));
    }
    const conditions = validateConditionList({
      registry,
      packageClosures,
      packageId: node.packageId,
      nodeId,
      conditions: node.conditions,
    });

    for (const dependencyId of references) {
      const dependency = registry.nodes.get(dependencyId);
      if (!dependency) {
        fail('missing_node_dependency',
          `Node ${node.id} has missing dependency ${dependencyId}`,
          { nodeId: node.id, dependencyId });
      }
      if (dependency.packageId !== node.packageId
        && !packageClosures.get(node.packageId).has(dependency.packageId)) {
        fail('undeclared_package_dependency',
          `Node ${node.id} references ${dependencyId} but package ${node.packageId} does not declare package dependency ${dependency.packageId}`,
          {
            nodeId: node.id,
            dependencyId,
            packageId: node.packageId,
            requiredPackageId: dependency.packageId,
          });
      }
    }
    dependencyEdges.set(nodeId, [
      ...required,
      ...requiredAlternatives,
      ...conditions
        .map(({ targetId }) => targetId)
        .filter(Boolean),
    ]);
    quantityByNode.set(nodeId, quantities);
    conditionByNode.set(nodeId, conditions);
  }
  return { conditionByNode, dependencyEdges, packageClosures, quantityByNode };
}

function validateMysteryCycles(registry, dependencyEdges) {
  const visited = new Set();
  function visit(nodeId, visiting, path) {
    if (visiting.has(nodeId)) {
      const start = path.indexOf(nodeId);
      const cycle = [...path.slice(start), nodeId];
      fail('mystery_prerequisite_cycle',
        `Mystery cycle detected: ${cycle.join(' -> ')}`, { cycle });
    }
    if (visited.has(nodeId)) return;
    visiting.add(nodeId);
    path.push(nodeId);
    for (const dependencyId of dependencyEdges.get(nodeId) || []) {
      visit(dependencyId, visiting, path);
    }
    path.pop();
    visiting.delete(nodeId);
    visited.add(nodeId);
  }
  for (const [nodeId, node] of registry.nodes) {
    if (node.type === 'mystery_step') visit(nodeId, new Set(), []);
  }
}

function inventoryClass(node) {
  return node.metadata?.inventoryClass || (node.type === 'material' ? 'stack'
    : node.type === 'item_template' ? 'unique' : null);
}

function recipeNumericDeclarations(node, names) {
  const declarations = [];
  for (const [prefix, container] of [['recipe', node], ['recipe.metadata', node.metadata]]) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    for (const [key, value] of Object.entries(container)) {
      if (names.has(normalizedObjectKey(key))) {
        declarations.push({ path: `${prefix}.${key}`, value });
      }
    }
  }
  return declarations;
}

function recipeCap(node) {
  const declarations = recipeNumericDeclarations(node, new Set([
    'maxcrafts', 'claimcap', 'cap',
  ]));
  if (declarations.some(({ value }) => !positiveInteger(value))) {
    fail('invalid_recipe_cap',
      `Recipe ${node.id} craft-cap declarations must be positive integers`,
      { nodeId: node.id, declarations });
  }
  const values = [...new Set(declarations.map(({ value }) => value))];
  if (values.length > 1) {
    fail('conflicting_recipe_authority',
      `Recipe ${node.id} has conflicting craft-cap declarations`,
      { nodeId: node.id, declarations });
  }
  return values[0];
}

function recipeCashCost(node) {
  const declarations = recipeNumericDeclarations(node, new Set([
    'cashcost', 'costcash', 'cost',
  ]));
  if (declarations.some(({ value }) => !Number.isFinite(value) || value <= 0)) {
    fail('invalid_recipe_cost',
      `Recipe ${node.id} cash-cost declarations must be positive finite numbers`,
      { nodeId: node.id, declarations });
  }
  const values = [...new Set(declarations.map(({ value }) => value))];
  if (values.length > 1) {
    fail('conflicting_recipe_authority',
      `Recipe ${node.id} has conflicting cash-cost declarations`,
      { nodeId: node.id, declarations });
  }
  return values[0];
}

function recipePolicy(node) {
  const declarations = [node.repeatability, node.metadata?.repeatability]
    .filter((value) => value !== undefined);
  if (declarations.some((value) => !nonEmptyString(value))) {
    fail('invalid_recipe_repeatability',
      `Recipe ${node.id} repeatability must be once, repeatable, or capped`,
      { nodeId: node.id, declarations });
  }
  const policies = [...new Set(declarations.map((value) => value.trim().toLowerCase()))];
  if (policies.length > 1) {
    fail('conflicting_recipe_authority',
      `Recipe ${node.id} has conflicting repeatability declarations`,
      { nodeId: node.id, declarations });
  }
  const repeatability = policies[0];
  if (repeatability !== undefined
    && !['once', 'repeatable', 'capped'].includes(repeatability)) {
    fail('invalid_recipe_repeatability',
      `Recipe ${node.id} repeatability must be once, repeatable, or capped`,
      { nodeId: node.id, repeatability });
  }

  const flags = [node.repeatable, node.metadata?.repeatable]
    .filter((value) => value !== undefined);
  if (flags.some((value) => typeof value !== 'boolean') || new Set(flags).size > 1) {
    fail('conflicting_recipe_authority',
      `Recipe ${node.id} has conflicting repeatable aliases`,
      { nodeId: node.id, repeatable: flags });
  }
  const repeatable = flags[0];
  if ((repeatable === true && repeatability === 'once')
    || (repeatable === false && ['repeatable', 'capped'].includes(repeatability))) {
    fail('conflicting_recipe_authority',
      `Recipe ${node.id} has contradictory repeatability and repeatable declarations`,
      { nodeId: node.id, repeatability, repeatable });
  }

  const cap = recipeCap(node);
  const cashCost = recipeCashCost(node);
  if (repeatability === 'capped' && !positiveInteger(cap)) {
    fail('invalid_recipe_repeatability',
      `Capped recipe ${node.id} requires a positive finite craft cap`,
      { nodeId: node.id, cap });
  }
  return {
    repeatable: repeatable === true || ['repeatable', 'capped'].includes(repeatability),
    finite: repeatability === 'once' || positiveInteger(cap),
    hasEconomicCost: cashCost !== undefined,
  };
}

function validateRecipeClasses(registry, quantityByNode) {
  let recipes = 0;
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'recipe') continue;
    recipes += 1;
    recipePolicy(node);
    const quantities = quantityByNode.get(nodeId);
    for (const field of [
      'consumes', 'inputs', 'catalysts', 'catalystInputs', 'produces', 'outputs',
    ]) {
      for (const entry of quantities[field]) {
        if (entry.external) {
          if (!['consumes', 'inputs'].includes(field)) {
            fail('invalid_recipe_inventory_class',
              `Recipe ${nodeId} cannot produce external asset ${entry.id}`,
              { nodeId, field, templateId: entry.id });
          }
          continue;
        }
        const template = registry.nodes.get(entry.id);
        if (!['material', 'item_template'].includes(template.type)) {
          fail('invalid_recipe_inventory_class',
            `Recipe ${nodeId} ${field} must reference a material or item template, not ${template.type}`,
            { nodeId, field, templateId: entry.id });
        }
        const declaredClass = inventoryClass(template);
        if ((template.type === 'material' && declaredClass !== 'stack')
          || (template.type === 'item_template' && declaredClass !== 'unique')) {
          fail('invalid_recipe_inventory_class',
            `Recipe ${nodeId} references ${entry.id} with incompatible inventory class ${declaredClass}`,
            { nodeId, field, templateId: entry.id, inventoryClass: declaredClass });
        }
        if (declaredClass === 'unique' && entry.quantity !== 1) {
          fail('invalid_recipe_inventory_class',
            `Recipe ${nodeId} must use unique item ${entry.id} at quantity 1`,
            { nodeId, field, templateId: entry.id, quantity: entry.quantity });
        }
      }
    }
  }
  return recipes;
}

function aggregateQuantities(entries) {
  const quantities = new Map();
  for (const entry of entries) {
    if (entry.external) continue;
    quantities.set(entry.id, (quantities.get(entry.id) || 0) + entry.quantity);
  }
  return quantities;
}

function recipeDeclaresRepeatable(node) {
  return recipePolicy(node).repeatable;
}

function recipeConversionGraph(registry, quantityByNode) {
  const vertices = new Set();
  const edges = [];
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'recipe') continue;
    const quantities = quantityByNode.get(nodeId);
    const inputs = aggregateQuantities([
      ...quantities.consumes,
      ...quantities.inputs,
      ...quantities.catalysts,
      ...quantities.catalystInputs,
    ]);
    const outputs = aggregateQuantities([...quantities.produces, ...quantities.outputs]);
    for (const [inputId, inputQuantity] of inputs) {
      vertices.add(inputId);
      for (const [outputId, outputQuantity] of outputs) {
        vertices.add(outputId);
        edges.push({
          from: inputId,
          to: outputId,
          recipeId: nodeId,
          inputQuantity,
          outputQuantity,
          ratio: outputQuantity / inputQuantity,
        });
      }
    }
  }
  return { edges, vertices };
}

function stronglyConnectedComponents(vertices, edges) {
  const adjacency = new Map([...vertices].map((vertex) => [vertex, []]));
  for (const edge of edges) adjacency.get(edge.from).push(edge.to);
  const indices = new Map();
  const lowLinks = new Map();
  const stack = [];
  const onStack = new Set();
  const components = [];
  let nextIndex = 0;

  function connect(vertex) {
    indices.set(vertex, nextIndex);
    lowLinks.set(vertex, nextIndex);
    nextIndex += 1;
    stack.push(vertex);
    onStack.add(vertex);

    for (const target of adjacency.get(vertex)) {
      if (!indices.has(target)) {
        connect(target);
        lowLinks.set(vertex, Math.min(lowLinks.get(vertex), lowLinks.get(target)));
      } else if (onStack.has(target)) {
        lowLinks.set(vertex, Math.min(lowLinks.get(vertex), indices.get(target)));
      }
    }

    if (lowLinks.get(vertex) === indices.get(vertex)) {
      const component = [];
      let member;
      do {
        member = stack.pop();
        onStack.delete(member);
        component.push(member);
      } while (member !== vertex);
      components.push(component);
    }
  }

  for (const vertex of vertices) if (!indices.has(vertex)) connect(vertex);
  return components;
}

function canonicalCycleKey(cycle) {
  const tokens = cycle.map(({ from, to, recipeId }) => `${from}>${recipeId}>${to}`);
  const rotations = tokens.map((_, index) => (
    [...tokens.slice(index), ...tokens.slice(0, index)].join('|')
  ));
  return rotations.sort()[0];
}

function conversionCycles(component, edges, maximumCycles) {
  const members = new Set(component);
  const ordered = [...component].sort();
  const order = new Map(ordered.map((vertex, index) => [vertex, index]));
  const adjacency = new Map(ordered.map((vertex) => [vertex, []]));
  for (const edge of edges) if (members.has(edge.from) && members.has(edge.to)) {
    adjacency.get(edge.from).push(edge);
  }
  const result = new Map();

  function walk(start, current, visited, path) {
    for (const edge of adjacency.get(current)) {
      const nextPath = [...path, edge];
      if (edge.to === start) {
        result.set(canonicalCycleKey(nextPath), nextPath);
        if (result.size > maximumCycles) {
          fail('recipe_cycle_too_complex',
            `Recursive recipe SCC exceeds exact cycle validation budget ${maximumCycles}`,
            {
              templates: component,
              conversions: edges.length,
              maximumCycles,
            });
        }
        continue;
      }
      if (visited.has(edge.to) || order.get(edge.to) < order.get(start)) continue;
      visited.add(edge.to);
      walk(start, edge.to, visited, nextPath);
      visited.delete(edge.to);
    }
  }
  for (const start of ordered) walk(start, start, new Set([start]), []);
  return [...result.values()];
}

function cycleRecipeMultipliers(cycle) {
  const multipliers = new Map();
  let executionMultiplier = 1;
  for (let index = 0; index < cycle.length; index += 1) {
    const edge = cycle[index];
    multipliers.set(edge.recipeId,
      (multipliers.get(edge.recipeId) || 0) + executionMultiplier);
    const nextEdge = cycle[(index + 1) % cycle.length];
    executionMultiplier = (executionMultiplier * edge.outputQuantity) / nextEdge.inputQuantity;
  }
  return multipliers;
}

function recipeConservedTotals(cycle, quantityByNode) {
  let inputs = 0;
  let outputs = 0;
  const multipliers = cycleRecipeMultipliers(cycle);
  for (const [recipeId, multiplier] of multipliers) {
    const quantities = quantityByNode.get(recipeId);
    inputs += [...quantities.consumes, ...quantities.inputs]
      .reduce((total, entry) => total + (entry.quantity * multiplier), 0);
    outputs += [...quantities.produces, ...quantities.outputs]
      .reduce((total, entry) => total + (entry.quantity * multiplier), 0);
  }
  return { inputs, outputs, multipliers: Object.fromEntries(multipliers) };
}

function validateRecipeCycles(registry, quantityByNode) {
  const { edges, vertices } = recipeConversionGraph(registry, quantityByNode);
  for (const component of stronglyConnectedComponents(vertices, edges)) {
    const members = new Set(component);
    const internalEdges = edges.filter(({ from, to }) => members.has(from) && members.has(to));
    const cyclic = component.length > 1 || internalEdges.some(({ from, to }) => from === to);
    if (!cyclic) continue;
    if (component.length > MAX_EXACT_RECIPE_SCC_TEMPLATES) {
      fail('recipe_cycle_too_complex',
        `Recursive recipe SCC size ${component.length} exceeds exact validation limit ${MAX_EXACT_RECIPE_SCC_TEMPLATES}`,
        {
          templates: component,
          size: component.length,
          maximum: MAX_EXACT_RECIPE_SCC_TEMPLATES,
        });
    }

    const recipeIds = [...new Set(internalEdges.map(({ recipeId }) => recipeId))];
    if (internalEdges.length > MAX_EXACT_RECIPE_SCC_EDGES) {
      fail('recipe_cycle_too_complex',
        `Recursive recipe SCC has ${internalEdges.length} conversions, exceeding exact validation limit ${MAX_EXACT_RECIPE_SCC_EDGES}`,
        {
          templates: component,
          size: component.length,
          conversions: internalEdges.length,
          maximumConversions: MAX_EXACT_RECIPE_SCC_EDGES,
        });
    }
    const undeclared = recipeIds.filter((recipeId) => (
      !recipeDeclaresRepeatable(registry.nodes.get(recipeId))
    ));
    if (undeclared.length > 0) {
      fail('undeclared_recipe_cycle',
        `Recursive recipe SCC must be explicitly declared repeatable: ${undeclared.join(', ')}`,
        { templates: component, recipeIds, undeclaredRecipeIds: undeclared });
    }
    for (const cycle of conversionCycles(
      component,
      internalEdges,
      MAX_EXACT_RECIPE_CYCLES,
    )) {
      const totals = recipeConservedTotals(cycle, quantityByNode);
      if (totals.outputs > totals.inputs + 1e-12) {
        const cycleRecipeIds = [...new Set(cycle.map(({ recipeId }) => recipeId))];
        fail('inflationary_recipe_cycle',
          `Inflationary recursive recipe SCC detected across ${component.join(', ')}`,
          { templates: component, recipeIds: cycleRecipeIds, ...totals });
      }
    }
  }
}

function recipeHasSourceConstraint(node) {
  const policy = recipePolicy(node);
  return policy.finite || policy.hasEconomicCost;
}

function validateRecipeSources(registry, quantityByNode) {
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'recipe') continue;
    const quantities = quantityByNode.get(nodeId);
    const outputs = [...quantities.produces, ...quantities.outputs];
    if (outputs.length === 0 || !recipeDeclaresRepeatable(node)) continue;
    const consumedInputs = [...quantities.consumes, ...quantities.inputs];
    if (consumedInputs.length > 0 || recipeHasSourceConstraint(node)) continue;
    fail('unbounded_recipe_source',
      `Repeatable producer ${nodeId} requires a real consumed/external input or explicit finite source semantics`,
      { nodeId });
  }
}

function roleDefinitions(node) {
  return node.roles || node.metadata?.roles || null;
}

function roleRequirementContradiction(role) {
  const required = new Set(Array.isArray(role.requires) ? role.requires : []);
  const excluded = new Set(Array.isArray(role.excludes) ? role.excludes : []);
  if ([...required].some((requirement) => excluded.has(requirement))) return true;

  return false;
}

function minimumGraphColors(vertices, adjacency) {
  if (vertices.length === 0) return 0;
  const ordered = [...vertices].sort((a, b) => adjacency.get(b).size - adjacency.get(a).size);
  function canColor(limit, index = 0, colors = new Map()) {
    if (index === ordered.length) return true;
    const vertex = ordered[index];
    for (let color = 0; color < limit; color += 1) {
      if ([...adjacency.get(vertex)].some((neighbor) => colors.get(neighbor) === color)) continue;
      colors.set(vertex, color);
      if (canColor(limit, index + 1, colors)) return true;
      colors.delete(vertex);
    }
    return false;
  }
  for (let limit = 1; limit <= ordered.length; limit += 1) {
    if (canColor(limit)) return limit;
  }
  return ordered.length;
}

function socialAccountConstraints(nodeId, roles, byId) {
  const parent = new Map(roles.map(({ id }) => [id, id]));
  function find(roleId) {
    const direct = parent.get(roleId);
    if (direct === roleId) return roleId;
    const root = find(direct);
    parent.set(roleId, root);
    return root;
  }
  function union(left, right) {
    const leftRoot = find(left);
    const rightRoot = find(right);
    if (leftRoot !== rightRoot) parent.set(rightRoot, leftRoot);
  }
  function referencedRoles(role, fields) {
    const result = [];
    for (const field of fields) {
      if (role[field] === undefined) continue;
      result.push(...(Array.isArray(role[field]) ? role[field] : [role[field]]));
    }
    for (const referencedRoleId of result) {
      if (!nonEmptyString(referencedRoleId) || !byId.has(referencedRoleId)) {
        fail('invalid_social_role_reference',
          `Social role ${role.id} references unknown social role ${String(referencedRoleId)}`,
          { nodeId, roleId: role.id, referencedRoleId });
      }
    }
    return result;
  }

  for (const role of roles) {
    for (const target of referencedRoles(role, ['sameAccountAs'])) union(role.id, target);
  }

  const groups = new Map();
  for (const role of roles) {
    const root = find(role.id);
    const members = groups.get(root) || [];
    members.push(role.id);
    groups.set(root, members);
  }
  const adjacency = new Map([...groups.keys()].map((root) => [root, new Set()]));
  function requireDifferent(leftRoleId, rightRoleId) {
    const left = find(leftRoleId);
    const right = find(rightRoleId);
    if (left === right) {
      fail('impossible_social_role',
        `Social operation ${nodeId} requires ${leftRoleId} to both share and not share an account with ${rightRoleId}`,
        { nodeId, roleId: leftRoleId, referencedRoleId: rightRoleId });
    }
    adjacency.get(left).add(right);
    adjacency.get(right).add(left);
  }

  for (const role of roles) {
    if (role.distinct === true) {
      for (const other of roles) {
        if (other.id !== role.id) requireDifferent(role.id, other.id);
      }
    }
    for (const target of referencedRoles(role, ['distinctFrom', 'differentAccountFrom'])) {
      requireDifferent(role.id, target);
    }
  }
  for (let leftIndex = 0; leftIndex < roles.length; leftIndex += 1) {
    const left = roles[leftIndex];
    const leftRequires = new Set(left.requires || []);
    const leftExcludes = new Set(left.excludes || []);
    for (let rightIndex = leftIndex + 1; rightIndex < roles.length; rightIndex += 1) {
      const right = roles[rightIndex];
      const incompatible = (right.excludes || []).some((entry) => leftRequires.has(entry))
        || (right.requires || []).some((entry) => leftExcludes.has(entry));
      if (incompatible) requireDifferent(left.id, right.id);
    }
  }

  const vertices = [...groups.keys()];
  return {
    minimum: minimumGraphColors(vertices, adjacency),
    maximum: vertices.length,
    accountGroups: [...groups.values()].map((members) => [...members]),
  };
}

function validateSocialOperations(registry, packageClosures) {
  const reports = [];
  const materialConditions = [];
  const conditionRequirementGroups = [];
  for (const [nodeId, node] of registry.nodes) {
    const roles = roleDefinitions(node);
    if (roles === null) continue;
    if (!['social_gate', 'operation_step'].includes(node.type) || !Array.isArray(roles)
      || roles.length === 0) {
      fail('malformed_social_operation',
        `Node ${nodeId} has malformed social role definitions`, { nodeId });
    }
    if (roles.length > MAX_PHASE1_SOCIAL_ROLES) {
      fail('social_solver_too_complex',
        `Social operation ${nodeId} has ${roles.length} roles, exceeding the Phase 1 limit ${MAX_PHASE1_SOCIAL_ROLES}`,
        { nodeId, roles: roles.length, maximumRoles: MAX_PHASE1_SOCIAL_ROLES });
    }

    const byId = new Map();
    const requirementsByRole = new Map();
    for (const role of roles) {
      if (!role || typeof role !== 'object' || Array.isArray(role) || !nonEmptyString(role.id)) {
        fail('malformed_social_role',
          `Social operation ${nodeId} has a role without a stable ID`, { nodeId });
      }
      if (byId.has(role.id)) {
        fail('duplicate_social_role',
          `Social operation ${nodeId} has duplicate social role ${role.id}`,
          { nodeId, roleId: role.id });
      }
      byId.set(role.id, role);
      if (role.requires !== undefined && (!Array.isArray(role.requires)
        || role.requires.some((entry) => !nonEmptyString(entry)))) {
        fail('malformed_social_role',
          `Social role ${role.id} requires must be an array`, { nodeId, roleId: role.id });
      }
      if (role.excludes !== undefined && (!Array.isArray(role.excludes)
        || role.excludes.some((entry) => !nonEmptyString(entry)))) {
        fail('malformed_social_role',
          `Social role ${role.id} excludes must be an array`, { nodeId, roleId: role.id });
      }
      const conditions = validateConditionList({
        registry,
        packageClosures,
        packageId: node.packageId,
        nodeId,
        roleId: role.id,
        conditions: role.conditions,
      });
      materialConditions.push(...conditions
        .filter(({ adapter }) => adapter === 'material_quantity')
        .map(({ targetId }) => ({ nodeId, roleId: role.id, targetId })));
      requirementsByRole.set(role.id,
        conditions.map(({ targetId }) => targetId).filter(Boolean));
      if (roleRequirementContradiction(role)) {
        fail('impossible_social_role',
          `Social operation ${nodeId} has impossible role requirements for ${role.id}`,
          { nodeId, roleId: role.id });
      }
    }

    const feasible = socialAccountConstraints(nodeId, roles, byId);
    conditionRequirementGroups.push({
      nodeId,
      groups: feasible.accountGroups
        .map((roleIds) => [...new Set(roleIds.flatMap((roleId) => (
          requirementsByRole.get(roleId) || []
        )))])
        .filter((requirements) => requirements.length > 0),
    });
    const declared = node.minimumDistinctAccounts ?? node.metadata?.minimumDistinctAccounts;
    if (declared !== undefined && !positiveInteger(declared)) {
      fail('invalid_social_minimum',
        `Social operation ${nodeId} minimumDistinctAccounts must be a positive integer`,
        { nodeId, minimumDistinctAccounts: declared });
    }
    if (declared !== undefined && declared < feasible.minimum) {
      fail('invalid_social_minimum',
        `Social operation ${nodeId} minimumDistinctAccounts cannot be lower than the feasible constraint minimum ${feasible.minimum}`,
        { nodeId, minimumDistinctAccounts: declared, constraintMinimum: feasible.minimum });
    }
    const minimumDistinctAccounts = Math.max(declared || 1, feasible.minimum);
    if (minimumDistinctAccounts > feasible.maximum) {
      fail('impossible_social_operation',
        `Social operation ${nodeId} minimumDistinctAccounts exceeds the maximum feasible ${feasible.maximum}`,
        { nodeId, minimumDistinctAccounts, maximumDistinctAccounts: feasible.maximum });
    }
    reports.push({
      nodeId,
      packageId: node.packageId,
      minimumDistinctAccounts,
      maximumDistinctAccounts: feasible.maximum,
      requiredRoles: roles.map((role) => role.id),
      rolesMayShareAccounts: minimumDistinctAccounts < roles.length,
    });
  }
  return { conditionRequirementGroups, materialConditions, reports };
}

function normalizedObjectKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizedAsset(value) {
  if (!nonEmptyString(value)) return null;
  const normalized = value.replace(/[$\s_-]/g, '').toUpperCase();
  if (['CURRENCY', 'TOKEN', 'ASSET', 'REWARD', 'FUNGIBLE'].includes(normalized)) return null;
  if ([
    'OMR', 'OMERTA', 'OMRTOKEN', 'OMRCURRENCY', 'OMERTAREWARD', 'OMERTATOKEN',
    'OMERTACURRENCY', 'OMERTACOIN',
  ].includes(normalized)) return 'OMR';
  return normalized;
}

function canonicalRewardContainers(node) {
  return [
    ['reward', node],
    ['reward.metadata', node.metadata],
    ['reward.reward', node.reward],
    ['reward.payout', node.payout],
    ['reward.metadata.reward', node.metadata?.reward],
    ['reward.metadata.payout', node.metadata?.payout],
  ].filter(([, value]) => value && typeof value === 'object' && !Array.isArray(value));
}

function declaredEffectActionContainers(node) {
  const result = [];
  const seen = new WeakSet();
  const effectKeys = new Set(['effect', 'effects', 'action', 'actions']);
  function collect(value, path) {
    if (!value || typeof value !== 'object' || seen.has(value)) return;
    seen.add(value);
    if (Array.isArray(value)) {
      value.forEach((entry, index) => collect(entry, `${path}[${index}]`));
      return;
    }
    result.push([path, value]);
    for (const [key, child] of Object.entries(value)) {
      if (effectKeys.has(normalizedObjectKey(key))) collect(child, `${path}.${key}`);
    }
  }
  for (const [path, container] of canonicalRewardContainers(node)) {
    for (const [key, value] of Object.entries(container)) {
      if (effectKeys.has(normalizedObjectKey(key))) collect(value, `${path}.${key}`);
    }
  }
  return result;
}

function rewardAssetDeclarations(node) {
  const identityKeys = new Set([
    'asset', 'assettype', 'currency', 'currencytype', 'rewardasset', 'rewardcurrency',
    'symbol', 'token', 'tokensymbol', 'assetid', 'currencyid', 'currencycode',
    'rewardassettype', 'rewardcurrencytype', 'tokentype',
  ]);
  const nestedIdentityKeys = new Set(['id', 'name', 'type', 'symbol']);
  const declarations = [];
  for (const [path, container] of [
    ...canonicalRewardContainers(node),
    ...declaredEffectActionContainers(node),
  ]) {
    for (const [key, value] of Object.entries(container)) {
      if (!identityKeys.has(normalizedObjectKey(key))) continue;
      if (typeof value === 'string') {
        const asset = normalizedAsset(value);
        if (asset) declarations.push({ asset, path: `${path}.${key}`, value });
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        for (const [nestedKey, nestedValue] of Object.entries(value)) {
          if (!nestedIdentityKeys.has(normalizedObjectKey(nestedKey))
            || typeof nestedValue !== 'string') continue;
          const asset = normalizedAsset(nestedValue);
          if (asset) {
            declarations.push({
              asset,
              path: `${path}.${key}.${nestedKey}`,
              value: nestedValue,
            });
          }
        }
      }
    }
  }
  return declarations;
}

function canonicalAuthority(node, field) {
  return [
    { path: `reward.${field}`, value: node[field] },
    { path: `reward.metadata.${field}`, value: node.metadata?.[field] },
  ].filter(({ value }) => value !== undefined);
}

function assertedAuthority(node, field, missingMessage) {
  const declarations = canonicalAuthority(node, field);
  if (declarations.some(({ value }) => !nonEmptyString(value))) {
    fail('invalid_omr_reward', missingMessage, { nodeId: node.id, field, declarations });
  }
  const values = [...new Set(declarations.map(({ value }) => value.trim()))];
  if (values.length > 1) {
    fail('conflicting_omr_authority',
      `OMR reward ${node.id} has conflicting ${field} declarations`,
      { nodeId: node.id, field, declarations });
  }
  if (values.length === 0) fail('invalid_omr_reward', missingMessage, { nodeId: node.id, field });
  return values[0];
}

function truthyRepeatAlias(container) {
  if (!container || typeof container !== 'object' || Array.isArray(container)) return false;
  const aliases = new Set([
    'repeat', 'repeatable', 'isrepeatable', 'repeats', 'recurring', 'isrecurring',
    'repeatevery',
  ]);
  return Object.entries(container).some(([key, value]) => (
    aliases.has(normalizedObjectKey(key))
    && (value === true || (typeof value === 'number' && value > 0)
      || (typeof value === 'string'
        && !['', 'false', 'no', 'never', '0'].includes(value.trim().toLowerCase())))
  ));
}

function triggerIsRandom(value, seen = new WeakSet()) {
  if (typeof value === 'string') return normalizedObjectKey(value).includes('random');
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = normalizedObjectKey(key);
    if (['random', 'israndom', 'randomized', 'israndomized'].includes(normalizedKey)) {
      return child !== false && child !== null && child !== undefined
        && child !== 0 && child !== '0' && child !== 'false';
    }
    if (['chance', 'probability', 'randomweight'].includes(normalizedKey)) {
      return (typeof child === 'number' && child > 0)
        || (typeof child === 'string' && Number(child) > 0);
    }
    if (typeof child === 'string'
      && ['type', 'kind', 'selection', 'mode', 'strategy', 'adapter'].includes(normalizedKey)
      && normalizedObjectKey(child).includes('random')) return true;
    return triggerIsRandom(child, seen);
  });
}

function containsCanonicalRandom(node) {
  for (const [, container] of [
    ...canonicalRewardContainers(node),
    ...declaredEffectActionContainers(node),
  ]) {
    for (const [key, value] of Object.entries(container)) {
      const normalizedKey = normalizedObjectKey(key);
      if (['random', 'israndom', 'randomized', 'israndomized'].includes(normalizedKey)
        && value !== false && value !== null && value !== undefined
        && value !== 0 && value !== '0' && value !== 'false') return true;
      if (['chance', 'probability', 'randomweight'].includes(normalizedKey)
        && ((typeof value === 'number' && value > 0)
          || (typeof value === 'string' && Number(value) > 0))) return true;
      if (['trigger', 'selection'].includes(normalizedKey) && triggerIsRandom(value)) return true;
    }
  }
  return false;
}

function effectMints(value, seen = new WeakSet(), verbContext = true) {
  if (typeof value === 'string') {
    return verbContext && normalizedObjectKey(value).includes('mint');
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  if (Array.isArray(value)) {
    return value.some((entry) => effectMints(entry, seen, verbContext));
  }
  const verbKeys = new Set(['type', 'kind', 'adapter', 'action', 'effect', 'verb']);
  return Object.entries(value).some(([key, child]) => {
    const normalizedKey = normalizedObjectKey(key);
    if (['mint', 'directmint'].includes(normalizedKey) && child !== false && child !== null
      && child !== undefined) return true;
    return effectMints(child, seen, verbKeys.has(normalizedKey));
  });
}

function containsCanonicalMint(node) {
  const effectKeys = new Set(['effect', 'effects', 'action', 'actions']);
  for (const [, container] of canonicalRewardContainers(node)) {
    for (const [key, value] of Object.entries(container)) {
      const normalizedKey = normalizedObjectKey(key);
      if (effectKeys.has(normalizedKey) && effectMints(value)) return true;
      if (['mint', 'directmint'].includes(normalizedKey)
        && value !== false && value !== null && value !== undefined) return true;
    }
  }
  return false;
}

function validateOmrRewards(registry) {
  let count = 0;
  for (const [, node] of registry.nodes) {
    if (node.type !== 'reward') continue;
    const declarations = rewardAssetDeclarations(node);
    const assets = [...new Set(declarations.map(({ asset }) => asset))];
    if (assets.length > 1) {
      fail('conflicting_reward_asset',
        `Reward ${node.id} has conflicting reward asset declarations: ${assets.join(', ')}`,
        { nodeId: node.id, assets, declarations });
    }
    if (!assets.includes('OMR')) continue;
    count += 1;
    const pkg = registry.byPackage.get(node.packageId);
    if ([...canonicalRewardContainers(node), ...declaredEffectActionContainers(node)]
      .some(([, container]) => truthyRepeatAlias(container))) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} cannot set repeatable:true or an equivalent repeatable alias`,
        { nodeId: node.id });
    }
    if (!nonEmptyString(pkg?.season) || pkg.season.trim().toLowerCase() === 'core') {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} requires a finite seasonal allocationId`, { nodeId: node.id });
    }
    assertedAuthority(node, 'allocationId',
      `OMR reward ${node.id} requires a finite seasonal allocationId`);
    assertedAuthority(node, 'claimKey',
      `OMR reward ${node.id} requires an idempotent claimKey`);
    const repeatabilities = canonicalAuthority(node, 'repeatability')
      .map(({ value }) => (nonEmptyString(value) ? value.trim().toLowerCase() : value));
    const distinctRepeatabilities = [...new Set(repeatabilities)];
    if (distinctRepeatabilities.length > 1) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} has conflicting repeatability declarations`,
        { nodeId: node.id, repeatabilities: distinctRepeatabilities });
    }
    const repeatability = distinctRepeatabilities[0];
    if (!['once', 'capped'].includes(repeatability)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} repeatability must be once or capped`, { nodeId: node.id });
    }
    const caps = [
      node.claimCap, node.maxClaims, node.cap,
      node.metadata?.claimCap, node.metadata?.maxClaims, node.metadata?.cap,
    ].filter((value) => value !== undefined);
    if (repeatability === 'capped'
      && (caps.length === 0 || caps.some((cap) => !positiveInteger(cap))
        || new Set(caps).size > 1)) {
      fail('invalid_omr_reward',
        `Capped OMR reward ${node.id} requires a positive finite claim cap`, { nodeId: node.id });
    }
    if (containsCanonicalRandom(node)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} cannot use a random trigger`, { nodeId: node.id });
    }
    if (containsCanonicalMint(node)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} cannot mint or directly mint OMR`, { nodeId: node.id });
    }
  }
  return count;
}

function isSeeded(node) {
  if (SEEDED_FLAGS.some((flag) => node[flag] === true || node.metadata?.[flag] === true)) return true;
  for (const source of [node, node.metadata || {}]) {
    for (const [key, value] of Object.entries(source)) {
      const normalizedKey = normalizedObjectKey(key);
      if (['administratorseeded', 'adminseeded', 'seasonalseeded'].includes(normalizedKey)
        && value === true) return true;
      if (['seeded', 'seededby', 'seedsource'].includes(normalizedKey)
        && typeof value === 'string'
        && ['administrator', 'admin', 'seasonal', 'season'].includes(value.toLowerCase())) return true;
    }
  }
  return false;
}

function materialEntryIds(registry, entries) {
  return entries
    .filter(({ external, id }) => !external && registry.nodes.get(id)?.type === 'material')
    .map(({ id }) => id);
}

function graphReachability({
  registry, quantityByNode, conditionByNode, packageClosures, socialConditionRequirementGroups,
}) {
  const roleRequirementGroups = new Map(socialConditionRequirementGroups
    .map(({ nodeId, groups }) => [nodeId, groups]));

  const cache = new Map();
  function accessiblePackages(packageId) {
    return new Set([packageId, ...(packageClosures.get(packageId) || [])]);
  }
  function requirementsFor(nodeId, node) {
    const quantities = quantityByNode.get(nodeId);
    const quantityTargets = [
      ...quantities.consumes,
      ...quantities.inputs,
      ...quantities.catalysts,
      ...quantities.catalystInputs,
    ].filter(({ external }) => !external).map(({ id }) => id);
    return [...new Set([
      ...(node.requires || []),
      ...conditionByNode.get(nodeId).map(({ targetId }) => targetId).filter(Boolean),
      ...quantityTargets,
    ])];
  }
  function canUnlock(nodeId, node) {
    const requirements = requirementsFor(nodeId, node);
    const isDefinition = ['material', 'item_template', 'evidence'].includes(node.type);
    const hasUnlock = requirements.length > 0 || (node.requiresAny || []).length > 0;
    if (isDefinition && !hasUnlock) return false;
    if (node.type === 'recipe' && !hasUnlock) {
      const quantities = quantityByNode.get(nodeId);
      const hasExternalInput = [...quantities.consumes, ...quantities.inputs]
        .some(({ external }) => external);
      if (!hasExternalInput && !recipeHasSourceConstraint(node)) return false;
    }
    if (['hidden', 'role_private'].includes(node.visibility)
      && node.type !== 'source' && !hasUnlock) return false;
    return true;
  }

  function setIsSubset(left, right) {
    return [...left].every((value) => right.has(value));
  }
  function witnessDominates(left, right) {
    return setIsSubset(left.completed, right.completed)
      && setIsSubset(left.forbidden, right.forbidden);
  }
  function mergeWitnesses(left, right) {
    const completed = new Set([...left.completed, ...right.completed]);
    const forbidden = new Set([...left.forbidden, ...right.forbidden]);
    if ([...completed].some((nodeId) => forbidden.has(nodeId))) return null;
    return { completed, forbidden };
  }
  function addWitness(collection, witness, nodeId) {
    if (collection.some((existing) => witnessDominates(existing, witness))) return false;
    for (let index = collection.length - 1; index >= 0; index -= 1) {
      if (witnessDominates(witness, collection[index])) collection.splice(index, 1);
    }
    if (collection.length >= MAX_GRAPH_WITNESSES_PER_NODE) {
      fail('graph_reachability_too_complex',
        `Node ${nodeId} exceeds the Phase 1 reachability witness limit ${MAX_GRAPH_WITNESSES_PER_NODE}`,
        { nodeId, maximumWitnesses: MAX_GRAPH_WITNESSES_PER_NODE });
    }
    collection.push(witness);
    return true;
  }
  function extendForNode(witness, nodeId, node) {
    return mergeWitnesses(witness, {
      completed: new Set([nodeId]),
      forbidden: new Set(node.excludes || []),
    });
  }
  function socialRequirementGroupsAreFeasible(nodeId, witnesses) {
    for (const requirements of roleRequirementGroups.get(nodeId) || []) {
      let combinations = [{ completed: new Set(), forbidden: new Set() }];
      let work = 0;
      for (const targetId of requirements) {
        const options = witnesses.get(targetId) || [];
        if (options.length === 0) return false;
        const next = [];
        for (const combination of combinations) {
          for (const option of options) {
            work += 1;
            if (work > MAX_GRAPH_WITNESSES_PER_NODE ** 2) {
              fail('graph_reachability_too_complex',
                `Social operation ${nodeId} exceeds the Phase 1 role-reachability budget`,
                { nodeId, maximumCombinations: MAX_GRAPH_WITNESSES_PER_NODE ** 2 });
            }
            const merged = mergeWitnesses(combination, option);
            if (merged) addWitness(next, merged, nodeId);
          }
        }
        combinations = next;
        if (combinations.length === 0) return false;
      }
    }
    return true;
  }
  function deriveWitnesses(nodeId, node, witnesses) {
    if (!canUnlock(nodeId, node)) return [];
    if (!socialRequirementGroupsAreFeasible(nodeId, witnesses)) return [];
    const requirementGroups = [];
    for (const targetId of requirementsFor(nodeId, node)) {
      const targetWitnesses = witnesses.get(targetId) || [];
      if (targetWitnesses.length === 0) return [];
      requirementGroups.push(targetWitnesses);
    }
    for (const alternatives of node.requiresAny || []) {
      const targetWitnesses = alternatives.flatMap((targetId) => witnesses.get(targetId) || []);
      if (targetWitnesses.length === 0) return [];
      requirementGroups.push(targetWitnesses);
    }

    let combinations = [{ completed: new Set(), forbidden: new Set() }];
    let work = 0;
    for (const options of requirementGroups) {
      const next = [];
      for (const combination of combinations) {
        for (const option of options) {
          work += 1;
          if (work > MAX_GRAPH_WITNESSES_PER_NODE ** 2) {
            fail('graph_reachability_too_complex',
              `Node ${nodeId} exceeds the Phase 1 reachability combination budget`,
              { nodeId, maximumCombinations: MAX_GRAPH_WITNESSES_PER_NODE ** 2 });
          }
          const merged = mergeWitnesses(combination, option);
          if (merged) addWitness(next, merged, nodeId);
        }
      }
      combinations = next;
      if (combinations.length === 0) return [];
    }
    return combinations
      .map((witness) => extendForNode(witness, nodeId, node))
      .filter(Boolean);
  }

  function reachableFor(packageId) {
    if (cache.has(packageId)) return cache.get(packageId);
    const accessible = accessiblePackages(packageId);
    const witnesses = new Map();
    for (const [nodeId, node] of registry.nodes) {
      if (!accessible.has(node.packageId) || !isSeeded(node)) continue;
      const seeded = extendForNode(
        { completed: new Set(), forbidden: new Set() }, nodeId, node,
      );
      if (seeded) witnesses.set(nodeId, [seeded]);
    }

    let changed = true;
    while (changed) {
      changed = false;
      for (const [nodeId, node] of registry.nodes) {
        if (!accessible.has(node.packageId)) continue;
        const nodeWitnesses = witnesses.get(nodeId) || [];
        for (const witness of deriveWitnesses(nodeId, node, witnesses)) {
          if (addWitness(nodeWitnesses, witness, nodeId)) changed = true;
        }
        if (nodeWitnesses.length === 0) continue;
        witnesses.set(nodeId, nodeWitnesses);

        const quantities = quantityByNode.get(nodeId);
        for (const { id, external } of [...quantities.produces, ...quantities.outputs]) {
          if (external) continue;
          const outputNode = registry.nodes.get(id);
          const outputWitnesses = witnesses.get(id) || [];
          for (const witness of nodeWitnesses) {
            const produced = extendForNode(witness, id, outputNode);
            if (produced && addWitness(outputWitnesses, produced, id)) changed = true;
          }
          if (outputWitnesses.length > 0) witnesses.set(id, outputWitnesses);
        }
      }
    }
    const reachable = new Set(witnesses.keys());
    cache.set(packageId, reachable);
    return reachable;
  }

  return { accessiblePackages, reachableFor };
}

function validateTerminalReachability(registry, dependencyEdges, quantityByNode, reachability) {
  const referenced = new Set();
  for (const dependencies of dependencyEdges.values()) {
    for (const dependencyId of dependencies) referenced.add(dependencyId);
  }
  const terminalTypes = new Set([
    'mystery_step', 'operation_step', 'social_gate', 'world_gate', 'choice', 'reward', 'sink',
  ]);
  for (const [nodeId, node] of registry.nodes) {
    if (['hidden', 'role_private'].includes(node.visibility)) continue;
    const reachable = reachability.reachableFor(node.packageId).has(nodeId);
    const quantities = quantityByNode.get(nodeId);
    const isProducer = quantities.produces.length > 0 || quantities.outputs.length > 0;
    if (isProducer && !reachable) {
      fail('unreachable_producer',
        `Non-secret producer node ${nodeId} is not reachable from a valid start`,
        { nodeId, packageId: node.packageId });
    }
    if (terminalTypes.has(node.type) && !referenced.has(nodeId) && !reachable) {
      fail('unreachable_terminal',
        `Non-secret terminal node ${nodeId} is not reachable from a valid start`,
        { nodeId, packageId: node.packageId });
    }
  }
}

function buildMaterialDiagnostics({
  registry, quantityByNode, conditionByNode, socialMaterialConditions, reachability,
}) {
  const producedBy = new Map();
  const consumedBy = new Map();
  for (const [nodeId, node] of registry.nodes) {
    const quantities = quantityByNode.get(nodeId);
    for (const { id, external } of [...quantities.produces, ...quantities.outputs]) {
      if (external) continue;
      const producerIds = producedBy.get(id) || [];
      producerIds.push(nodeId);
      producedBy.set(id, producerIds);
    }
    const materialInputs = materialEntryIds(registry, [
      ...quantities.consumes,
      ...quantities.inputs,
      ...quantities.catalysts,
      ...quantities.catalystInputs,
    ]);
    for (const id of materialInputs) {
      const consumers = consumedBy.get(id) || [];
      consumers.push({ consumerId: nodeId, packageId: node.packageId });
      consumedBy.set(id, consumers);
    }
    const conditionMaterials = conditionByNode.get(nodeId)
      .filter(({ adapter }) => adapter === 'material_quantity')
      .map(({ targetId }) => targetId);
    for (const id of conditionMaterials) {
      const consumers = consumedBy.get(id) || [];
      consumers.push({ consumerId: nodeId, packageId: node.packageId });
      consumedBy.set(id, consumers);
    }
  }
  for (const { nodeId, roleId, targetId } of socialMaterialConditions) {
    const consumers = consumedBy.get(targetId) || [];
    consumers.push({
      consumerId: `${nodeId}#${roleId}`,
      packageId: registry.nodes.get(nodeId).packageId,
    });
    consumedBy.set(targetId, consumers);
  }

  const requiredMaterials = new Set();
  const sinklessMaterials = [];
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'material') continue;
    if (consumedBy.has(nodeId)) requiredMaterials.add(nodeId);
  }

  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'material') continue;
    for (const consumer of consumedBy.get(nodeId) || []) {
      if (!reachability.reachableFor(consumer.packageId).has(nodeId)) {
        fail('unsourced_material',
          `Required material ${nodeId} has no reachable source or administrator/season seed in package ${consumer.packageId}'s dependency set`,
          {
            nodeId,
            consumer: consumer.consumerId,
            consumerPackageId: consumer.packageId,
            declaredProducers: producedBy.get(nodeId) || [],
          });
      }
    }
    if (!consumedBy.has(nodeId) && node.metadata?.economySignificant !== false) {
      sinklessMaterials.push(nodeId);
    }
  }

  const orphanedSources = [];
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'source') continue;
    const outputs = [...quantityByNode.get(nodeId).produces, ...quantityByNode.get(nodeId).outputs];
    if (outputs.length === 0 || outputs.every(({ id }) => (
      !(consumedBy.get(id) || []).some(({ packageId }) => (
        reachability.accessiblePackages(packageId).has(node.packageId)
      ))
    ))) {
      orphanedSources.push(nodeId);
    }
  }
  const reachableMaterials = new Set();
  for (const packageId of registry.byPackage.keys()) {
    for (const nodeId of reachability.reachableFor(packageId)) {
      if (registry.nodes.get(nodeId)?.type === 'material') reachableMaterials.add(nodeId);
    }
  }
  return {
    required: requiredMaterials.size,
    sourced: requiredMaterials.size,
    reachable: reachableMaterials.size,
    sinkless: sinklessMaterials.length,
    sinklessMaterials,
    orphanedSources,
  };
}

// Role-private evidence is authored data, but it becomes a player-visible secret through the
// operation runtime. Keep that single escape hatch narrow enough for static acceptance to prove
// that content cannot smuggle objects, executable values, or oversized payloads into projections.
function validatePrivateEvidence(registry) {
  for (const [nodeId, node] of registry.nodes) {
    const privateEvidence = node.metadata?.privateEvidence;
    if (privateEvidence === undefined) continue;
    if (node.type !== 'evidence' || node.visibility !== 'role_private'
      || typeof privateEvidence !== 'string'
      || privateEvidence.trim() !== privateEvidence
      || privateEvidence.length < 1 || privateEvidence.length > 1000) {
      fail('invalid_private_evidence',
        `Node ${nodeId} privateEvidence must be 1-1000 canonical characters on role-private evidence`,
        { nodeId });
    }
  }
}

// This is the sole content flag that may authorize the narrow account -> current-character custody
// bridge. Its placement and type are validated with the graph so a route never trusts an ad-hoc
// template name, a truthy string, or a declaration on a material/recipe node.
function validateCharacterAssignmentFlags(registry) {
  for (const [nodeId, node] of registry.nodes) {
    const characterAssignable = node.metadata?.characterAssignable;
    if (characterAssignable === undefined) continue;
    if (node.type !== 'item_template' || typeof characterAssignable !== 'boolean') {
      fail('invalid_character_assignment_flag',
        `Node ${nodeId} characterAssignable must be boolean metadata on an item_template`,
        { nodeId });
    }
  }
}

/**
 * Validate one immutable registry before it is accepted by a runtime or CI.
 * Validation failures throw GraphValidationError with a stable machine code.
 */
export function validateGraph(registry) {
  if (!registry || !registry.byPackage || !registry.nodes
    || typeof registry.byPackage[Symbol.iterator] !== 'function'
    || typeof registry.nodes[Symbol.iterator] !== 'function') {
    fail('invalid_graph_registry', 'validateGraph requires a registry from loadGraphPackages');
  }

  const packageEdges = validatePackageDependencies(registry);
  validatePrivateEvidence(registry);
  validateCharacterAssignmentFlags(registry);
  const {
    conditionByNode, dependencyEdges, packageClosures, quantityByNode,
  } = validateNodeReferences(registry, packageEdges);
  validateMysteryCycles(registry, dependencyEdges);
  const recipes = validateRecipeClasses(registry, quantityByNode);
  const social = validateSocialOperations(registry, packageClosures);
  const omrRewards = validateOmrRewards(registry);
  validateRecipeSources(registry, quantityByNode);
  const reachability = graphReachability({
    registry,
    quantityByNode,
    conditionByNode,
    packageClosures,
    socialConditionRequirementGroups: social.conditionRequirementGroups,
  });
  const materials = buildMaterialDiagnostics({
    registry,
    quantityByNode,
    conditionByNode,
    socialMaterialConditions: social.materialConditions,
    reachability,
  });
  validateTerminalReachability(registry, dependencyEdges, quantityByNode, reachability);
  validateRecipeCycles(registry, quantityByNode);

  const warnings = [
    ...materials.sinklessMaterials.map((nodeId) => ({
      code: 'sinkless_material',
      nodeId,
      message: `Material ${nodeId} has no declared sink or durable use`,
    })),
    ...materials.orphanedSources.map((nodeId) => ({
      code: 'orphaned_source',
      nodeId,
      message: `Source ${nodeId} produces no material with a declared sink or durable use`,
    })),
  ].sort((a, b) => a.code.localeCompare(b.code) || a.nodeId.localeCompare(b.nodeId));

  return Object.freeze({
    ok: true,
    warnings: Object.freeze(warnings.map((warning) => Object.freeze(warning))),
    reports: Object.freeze({
      packages: registry.byPackage.size,
      nodes: registry.nodes.size,
      recipes,
      omrRewards,
      materials: Object.freeze(materials),
      socialOperations: Object.freeze(social.reports.map((report) => Object.freeze(report))),
    }),
  });
}

function assertRawPackageStructure(packages) {
  if (!Array.isArray(packages)) {
    fail('malformed_graph_packages', 'Graph packages must be provided as an array');
  }
  for (const [packageIndex, pkg] of packages.entries()) {
    if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)
      || !nonEmptyString(pkg.id) || !positiveInteger(pkg.version)) {
      fail('malformed_package',
        `Graph package at index ${packageIndex} requires a stable ID and positive integer version`,
        { packageIndex });
    }
    if (!Array.isArray(pkg.dependsOn)) {
      fail('malformed_package_dependency',
        `Package ${pkg.id} dependsOn must be an array`, { packageId: pkg.id });
    }
    if (!Array.isArray(pkg.nodes)) {
      fail('malformed_package', `Package ${pkg.id} nodes must be an array`, { packageId: pkg.id });
    }
    for (const [nodeIndex, node] of pkg.nodes.entries()) {
      if (!node || typeof node !== 'object' || Array.isArray(node) || !nonEmptyString(node.id)) {
        fail('malformed_node',
          `Package ${pkg.id} node at index ${nodeIndex} requires a stable ID`,
          { packageId: pkg.id, nodeIndex });
      }
      if (!nonEmptyString(node.type)) {
        fail('invalid_node_type',
          `Node ${node.id} requires a valid node type`,
          { packageId: pkg.id, nodeId: node.id });
      }
    }
  }
}

function normalizedLoaderError(error) {
  const message = error instanceof Error ? error.message : String(error);
  const mappings = [
    [/^duplicate package\s+(.+)$/i, 'duplicate_package'],
    [/^duplicate node\s+(.+)$/i, 'duplicate_node'],
    [/^invalid node type\s+(.+)$/i, 'invalid_node_type'],
    [/executable functions/i, 'executable_graph_data'],
    [/plain objects and arrays/i, 'invalid_graph_data'],
  ];
  for (const [pattern, code] of mappings) {
    if (pattern.test(message)) return new GraphValidationError(code, message);
  }
  return new GraphValidationError('invalid_graph_package', message);
}

/**
 * Content-acceptance entry point for untrusted raw packages. Task 1's loader is
 * intentionally unchanged; this wrapper gives every loader/validator failure a
 * stable machine code and returns the accepted immutable registry.
 */
export function loadAndValidateGraphPackages(packages) {
  assertRawPackageStructure(packages);
  let registry;
  try {
    registry = loadGraphPackages(packages);
  } catch (error) {
    if (error instanceof GraphValidationError) throw error;
    throw normalizedLoaderError(error);
  }
  validateGraph(registry);
  return registry;
}

export const SUPPORTED_WORLD_GRAPH_CONDITION_ADAPTERS = Object.freeze([...CONDITION_ADAPTERS]);
export const MAX_EXACT_RECIPE_SCC_SIZE = MAX_EXACT_RECIPE_SCC_TEMPLATES;

export default validateGraph;
