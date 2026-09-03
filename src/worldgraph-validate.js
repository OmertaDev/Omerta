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

const DEPENDENCY_FIELDS = ['requires', 'excludes'];
const QUANTITY_FIELDS = [
  'consumes', 'produces', 'inputs', 'outputs', 'catalysts', 'catalystInputs',
];
const SEEDED_FLAGS = ['administratorSeeded', 'adminSeeded', 'seasonalSeeded'];
const EXTERNAL_ASSET_TYPES = new Set(['car']);

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

function conditionField(condition, fields) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return undefined;
  return fields.map((field) => condition[field]).find((value) => value !== undefined);
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

    let targetId = null;
    let targetType = null;
    if (adapter === 'graph_dependency') {
      targetId = conditionField(condition, ['nodeId', 'id', 'value']);
    } else if (adapter === 'item_ownership' || adapter === 'owns_item') {
      targetId = conditionField(condition, ['templateId', 'itemTemplateId', 'nodeId']);
      targetType = 'item_template';
    } else if (adapter === 'material_quantity') {
      targetId = conditionField(condition, ['templateId', 'materialId', 'nodeId']);
      targetType = 'material';
      const quantity = conditionField(condition, ['quantity', 'minimumQuantity', 'amount']);
      if (!positiveInteger(quantity)) {
        fail('malformed_condition',
          `${owner} material_quantity condition requires a positive integer quantity`,
          { nodeId, roleId, adapter, quantity });
      }
    } else if (adapter === 'evidence') {
      targetId = conditionField(condition, ['evidenceId', 'nodeId']);
      targetType = 'evidence';
    } else if (adapter === 'location') {
      const location = conditionField(condition, ['value', 'locationId', 'district']);
      if (!nonEmptyString(location)) {
        fail('malformed_condition', `${owner} location condition requires a location`,
          { nodeId, roleId, adapter });
      }
      locations.add(location);
    } else if (adapter === 'level') {
      const level = conditionField(condition, ['value', 'minimumLevel', 'level']);
      if (!positiveInteger(level)) {
        fail('malformed_condition', `${owner} level condition requires a positive integer level`,
          { nodeId, roleId, adapter, level });
      }
    } else if (adapter === 'skill') {
      const skillId = conditionField(condition, ['skillId', 'id', 'value']);
      if (!nonEmptyString(skillId)) {
        fail('malformed_condition', `${owner} skill condition requires a skillId`,
          { nodeId, roleId, adapter });
      }
    } else if (adapter === 'time_window') {
      const windowId = conditionField(condition, ['windowId', 'value']);
      const start = conditionField(condition, ['start', 'startsAt']);
      const end = conditionField(condition, ['end', 'endsAt']);
      if (!nonEmptyString(windowId) && !(nonEmptyString(start) && nonEmptyString(end))) {
        fail('malformed_condition',
          `${owner} time_window condition requires a windowId or start and end`,
          { nodeId, roleId, adapter });
      }
    } else if (adapter === 'explicit_interaction') {
      const interactionId = conditionField(condition, ['interactionId', 'id', 'value']);
      if (!nonEmptyString(interactionId)) {
        fail('malformed_condition',
          `${owner} explicit_interaction condition requires an interactionId`,
          { nodeId, roleId, adapter });
      }
    } else if (adapter === 'owns_car') {
      const carSelector = conditionField(condition, [
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
    const references = [];
    for (const field of DEPENDENCY_FIELDS) references.push(...validateDependencyList(node, field));
    references.push(...validateRequiresAny(node));
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
      ...validateDependencyList(node, 'requires'),
      ...validateRequiresAny(node),
      ...conditions
        .filter(({ adapter }) => adapter === 'graph_dependency')
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

function validateRecipeClasses(registry, quantityByNode) {
  let recipes = 0;
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'recipe') continue;
    recipes += 1;
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
  const repeatability = node.repeatability || node.metadata?.repeatability;
  return node.repeatable === true || node.metadata?.repeatable === true
    || ['repeatable', 'capped'].includes(repeatability);
}

function recipeConversionGraph(registry, quantityByNode) {
  const vertices = new Set();
  const edges = [];
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'recipe') continue;
    const quantities = quantityByNode.get(nodeId);
    const inputs = aggregateQuantities([...quantities.consumes, ...quantities.inputs]);
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

function conversionCycles(component, edges) {
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

    const recipeIds = [...new Set(internalEdges.map(({ recipeId }) => recipeId))];
    const undeclared = recipeIds.filter((recipeId) => (
      !recipeDeclaresRepeatable(registry.nodes.get(recipeId))
    ));
    if (undeclared.length > 0) {
      fail('undeclared_recipe_cycle',
        `Recursive recipe SCC must be explicitly declared repeatable: ${undeclared.join(', ')}`,
        { templates: component, recipeIds, undeclaredRecipeIds: undeclared });
    }
    for (const cycle of conversionCycles(component, internalEdges)) {
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

  const vertices = [...groups.keys()];
  return {
    minimum: minimumGraphColors(vertices, adjacency),
    maximum: vertices.length,
  };
}

function validateSocialOperations(registry, packageClosures) {
  const reports = [];
  const materialConditions = [];
  for (const [nodeId, node] of registry.nodes) {
    const roles = roleDefinitions(node);
    if (roles === null) continue;
    if (!['social_gate', 'operation_step'].includes(node.type) || !Array.isArray(roles)
      || roles.length === 0) {
      fail('malformed_social_operation',
        `Node ${nodeId} has malformed social role definitions`, { nodeId });
    }

    const byId = new Map();
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
      if (roleRequirementContradiction(role)) {
        fail('impossible_social_role',
          `Social operation ${nodeId} has impossible role requirements for ${role.id}`,
          { nodeId, roleId: role.id });
      }
    }

    const feasible = socialAccountConstraints(nodeId, roles, byId);
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
  return { materialConditions, reports };
}

function contextSeen(seen, value, contextual) {
  const bucket = contextual ? seen.contextual : seen.plain;
  if (bucket.has(value)) return true;
  bucket.add(value);
  return false;
}

function containsRandomTrigger(value, seen = {
  plain: new WeakSet(), contextual: new WeakSet(),
}, triggerContext = false) {
  if (triggerContext && typeof value === 'string'
    && value.toLowerCase().includes('random')) return true;
  if (!value || typeof value !== 'object' || contextSeen(seen, value, triggerContext)) return false;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    if (['random', 'israndom', 'randomized', 'israndomized'].includes(normalizedKey)
      && (child === true || (typeof child === 'number' && child > 0))) return true;
    if (['chance', 'probability', 'randomweight'].includes(normalizedKey)
      && typeof child === 'number' && child > 0) return true;
    if (['trigger', 'selection', 'mode', 'strategy'].includes(normalizedKey)
      && typeof child === 'string' && child.toLowerCase().includes('random')) return true;
    const childContext = triggerContext
      || ['trigger', 'selection', 'randomizer', 'rng'].includes(normalizedKey);
    if (containsRandomTrigger(child, seen, childContext)) return true;
  }
  return false;
}

function containsMintEffect(value, seen = {
  plain: new WeakSet(), contextual: new WeakSet(),
}, effectContext = false) {
  if (effectContext && typeof value === 'string'
    && normalizedObjectKey(value).includes('mint')) return true;
  if (!value || typeof value !== 'object' || contextSeen(seen, value, effectContext)) return false;
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = key.replace(/[^a-z0-9]/gi, '').toLowerCase();
    const childEffectContext = effectContext
      || ['effect', 'effects', 'action', 'actions'].includes(normalizedKey);
    if (['effect', 'effects', 'action', 'actions', 'adapter'].includes(normalizedKey)) {
      const values = Array.isArray(child) ? child : [child];
      if (values.some((entry) => typeof entry === 'string'
        && normalizedObjectKey(entry).includes('mint'))) return true;
    }
    if (normalizedKey.includes('mint')
      && child !== false && child !== null && child !== undefined) return true;
    if (['type', 'kind', 'mode', 'strategy'].includes(normalizedKey)
      && typeof child === 'string' && normalizedObjectKey(child).includes('mint')) return true;
    if (containsMintEffect(child, seen, childEffectContext)) return true;
  }
  return false;
}

function normalizedObjectKey(key) {
  return key.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function normalizedAsset(value) {
  if (!nonEmptyString(value)) return null;
  const normalized = value.replace(/[$\s_-]/g, '').toUpperCase();
  if (['CURRENCY', 'TOKEN', 'ASSET', 'REWARD', 'FUNGIBLE'].includes(normalized)) return null;
  if (['OMR', 'OMERTA', 'OMERTAREWARD', 'OMERTATOKEN'].includes(normalized)) return 'OMR';
  return normalized;
}

function rewardAssetDeclarations(value, seen = {
  plain: new WeakSet(), contextual: new WeakSet(),
}, assetContext = false, result = []) {
  if (!value || typeof value !== 'object' || contextSeen(seen, value, assetContext)) return result;
  const identityKeys = new Set([
    'asset', 'assettype', 'currency', 'currencytype', 'rewardasset', 'rewardcurrency',
    'symbol', 'token', 'tokensymbol',
  ]);
  for (const [key, child] of Object.entries(value)) {
    const normalizedKey = normalizedObjectKey(key);
    const identityField = identityKeys.has(normalizedKey)
      || (assetContext && ['id', 'name', 'type'].includes(normalizedKey));
    if (identityField && typeof child === 'string') {
      const asset = normalizedAsset(child);
      if (asset) result.push({ asset, pathKey: key, value: child });
    }
    const childContext = assetContext || identityKeys.has(normalizedKey);
    rewardAssetDeclarations(child, seen, childContext, result);
  }
  return result;
}

function namedScalars(value, names, seen = new Set(), result = []) {
  if (!value || typeof value !== 'object' || seen.has(value)) return result;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (names.has(normalizedObjectKey(key)) && (child === null || typeof child !== 'object')) {
      result.push(child);
    }
    namedScalars(child, names, seen, result);
  }
  return result;
}

function unsafeRepeatAlias(node) {
  const aliases = namedScalars(node, new Set([
    'repeat', 'repeatable', 'isrepeatable', 'repeats', 'recurring', 'isrecurring',
    'repeatevery',
  ]));
  return aliases.some((value) => value === true || (typeof value === 'number' && value > 0)
    || (typeof value === 'string' && !['false', 'no', 'never'].includes(value.toLowerCase())));
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
    if (unsafeRepeatAlias(node)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} cannot set repeatable:true or an equivalent repeatable alias`,
        { nodeId: node.id });
    }
    const allocationIds = namedScalars(node, new Set(['allocationid']))
      .filter(nonEmptyString);
    if (allocationIds.length === 0 || !nonEmptyString(pkg?.season) || pkg.season === 'core') {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} requires a finite seasonal allocationId`, { nodeId: node.id });
    }
    if (namedScalars(node, new Set(['claimkey', 'idempotencykey'])).filter(nonEmptyString).length === 0) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} requires an idempotent claimKey`, { nodeId: node.id });
    }
    const repeatabilities = namedScalars(node, new Set(['repeatability', 'claimrule']))
      .filter(nonEmptyString)
      .map((value) => value.toLowerCase());
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
    const caps = namedScalars(node, new Set(['claimcap', 'maxclaims', 'cap']));
    if (repeatability === 'capped' && !caps.some(positiveInteger)) {
      fail('invalid_omr_reward',
        `Capped OMR reward ${node.id} requires a positive finite claim cap`, { nodeId: node.id });
    }
    if (containsRandomTrigger(node)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} cannot use a random trigger`, { nodeId: node.id });
    }
    if (containsMintEffect(node)) {
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

function buildMaterialDiagnostics({
  registry, quantityByNode, conditionByNode, socialMaterialConditions, packageClosures,
}) {
  const producedBy = new Map();
  const consumedBy = new Map();
  const producers = [];
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
    if (['source', 'recipe'].includes(node.type)) {
      const outputs = materialEntryIds(registry, [
        ...quantities.produces,
        ...quantities.outputs,
      ]);
      if (outputs.length > 0) {
        producers.push({
          nodeId,
          packageId: node.packageId,
          outputs,
          requirements: [...new Set([...materialInputs, ...conditionMaterials])],
        });
      }
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

  const reachableCache = new Map();
  function accessiblePackages(packageId) {
    return new Set([packageId, ...(packageClosures.get(packageId) || [])]);
  }
  function reachableFor(packageId) {
    if (reachableCache.has(packageId)) return reachableCache.get(packageId);
    const accessible = accessiblePackages(packageId);
    const reachable = new Set();
    for (const [nodeId, node] of registry.nodes) {
      if (node.type === 'material' && accessible.has(node.packageId) && isSeeded(node)) {
        reachable.add(nodeId);
      }
    }
    let changed = true;
    while (changed) {
      changed = false;
      for (const producer of producers) {
        if (!accessible.has(producer.packageId)
          || !producer.requirements.every((id) => reachable.has(id))) continue;
        for (const outputId of producer.outputs) {
          if (reachable.has(outputId)) continue;
          reachable.add(outputId);
          changed = true;
        }
      }
    }
    reachableCache.set(packageId, reachable);
    return reachable;
  }

  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'material') continue;
    for (const consumer of consumedBy.get(nodeId) || []) {
      if (!reachableFor(consumer.packageId).has(nodeId)) {
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
        accessiblePackages(packageId).has(node.packageId)
      ))
    ))) {
      orphanedSources.push(nodeId);
    }
  }
  const reachableMaterials = new Set();
  for (const packageId of registry.byPackage.keys()) {
    for (const materialId of reachableFor(packageId)) reachableMaterials.add(materialId);
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
  const {
    conditionByNode, dependencyEdges, packageClosures, quantityByNode,
  } = validateNodeReferences(registry, packageEdges);
  validateMysteryCycles(registry, dependencyEdges);
  const recipes = validateRecipeClasses(registry, quantityByNode);
  const social = validateSocialOperations(registry, packageClosures);
  const omrRewards = validateOmrRewards(registry);
  const materials = buildMaterialDiagnostics({
    registry,
    quantityByNode,
    conditionByNode,
    socialMaterialConditions: social.materialConditions,
    packageClosures,
  });
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

export default validateGraph;
