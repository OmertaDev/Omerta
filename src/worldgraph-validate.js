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

function validateConditions(node) {
  if (node.conditions === undefined) return [];
  if (!Array.isArray(node.conditions)) {
    fail('malformed_condition', `Node ${node.id} conditions must be an array`, { nodeId: node.id });
  }
  for (const condition of node.conditions) {
    const adapter = conditionAdapter(condition);
    if (!nonEmptyString(adapter)) {
      fail('malformed_condition',
        `Node ${node.id} has a condition without a named adapter`, { nodeId: node.id });
    }
    if (!CONDITION_ADAPTERS.has(adapter)) {
      fail('unsupported_condition_adapter',
        `Node ${node.id} uses unsupported condition adapter ${adapter}`,
        { nodeId: node.id, adapter });
    }
  }
  return node.conditions;
}

function conditionReference(condition) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return null;
  const adapter = conditionAdapter(condition);
  if (adapter === 'graph_dependency') return condition.nodeId || condition.id || condition.value || null;
  if (adapter === 'item_ownership' || adapter === 'owns_item') {
    return condition.templateId || condition.itemTemplateId || condition.nodeId || null;
  }
  if (adapter === 'material_quantity') {
    return condition.templateId || condition.materialId || condition.nodeId || null;
  }
  if (adapter === 'evidence') return condition.evidenceId || condition.nodeId || null;
  return null;
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
    const conditions = validateConditions(node);
    references.push(...conditions.map(conditionReference).filter(Boolean));

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
        .filter((condition) => conditionAdapter(condition) === 'graph_dependency')
        .map(conditionReference)
        .filter(Boolean),
    ]);
    quantityByNode.set(nodeId, quantities);
  }
  return { dependencyEdges, quantityByNode };
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

function hasPositiveCost(node) {
  const candidates = [node.cashCost, node.cost, node.metadata?.cashCost, node.metadata?.cost];
  if (candidates.some((value) => typeof value === 'number' && value > 0)) return true;
  const costs = node.costs || node.metadata?.costs;
  return !!costs && typeof costs === 'object'
    && Object.values(costs).some((value) => typeof value === 'number' && value > 0);
}

function validateZeroCostRecipeCycles(registry, quantityByNode) {
  const edges = new Map();
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'recipe' || hasPositiveCost(node)) continue;
    const quantities = quantityByNode.get(nodeId);
    const inputs = [...quantities.consumes, ...quantities.inputs]
      .filter(({ external }) => !external);
    const outputs = [...quantities.produces, ...quantities.outputs]
      .filter(({ external }) => !external);
    for (const output of outputs) {
      const outputEdges = edges.get(output.id) || [];
      for (const input of inputs) outputEdges.push({ templateId: input.id, recipeId: nodeId });
      edges.set(output.id, outputEdges);
    }
  }

  const visiting = new Set();
  const visited = new Set();
  const path = [];
  function visit(templateId) {
    if (visiting.has(templateId)) {
      const start = path.findIndex((entry) => entry.templateId === templateId);
      const cycleEntries = path.slice(start);
      const cycle = [...cycleEntries.map((entry) => entry.templateId), templateId];
      fail('zero_cost_recipe_cycle',
        `Zero-cost recursive recipe ancestor detected: ${cycle.join(' -> ')}`,
        { cycle, recipeIds: cycleEntries.map((entry) => entry.recipeId).filter(Boolean) });
    }
    if (visited.has(templateId)) return;
    visiting.add(templateId);
    for (const edge of edges.get(templateId) || []) {
      path.push({ templateId, recipeId: edge.recipeId });
      visit(edge.templateId);
      path.pop();
    }
    visiting.delete(templateId);
    visited.add(templateId);
  }
  for (const templateId of edges.keys()) visit(templateId);
}

function roleDefinitions(node) {
  return node.roles || node.metadata?.roles || null;
}

function roleRequirementContradiction(role) {
  const required = new Set(Array.isArray(role.requires) ? role.requires : []);
  const excluded = new Set(Array.isArray(role.excludes) ? role.excludes : []);
  if ([...required].some((requirement) => excluded.has(requirement))) return true;

  const byAdapter = new Map();
  for (const condition of Array.isArray(role.conditions) ? role.conditions : []) {
    if (!condition || typeof condition !== 'object' || Array.isArray(condition)) continue;
    const adapter = conditionAdapter(condition);
    const value = condition.value ?? condition.id ?? condition.nodeId;
    if (byAdapter.has(adapter) && byAdapter.get(adapter) !== value
      && ['location', 'owns_car'].includes(adapter)) return true;
    byAdapter.set(adapter, value);
  }
  return false;
}

function validateRoleConditions(nodeId, role) {
  if (role.conditions === undefined) return;
  if (!Array.isArray(role.conditions)) {
    fail('malformed_condition',
      `Social role ${role.id} conditions must be an array`, { nodeId, roleId: role.id });
  }
  for (const condition of role.conditions) {
    const adapter = conditionAdapter(condition);
    if (!nonEmptyString(adapter)) {
      fail('malformed_condition',
        `Social role ${role.id} has a condition without a named adapter`,
        { nodeId, roleId: role.id });
    }
    if (!CONDITION_ADAPTERS.has(adapter)) {
      fail('unsupported_condition_adapter',
        `Social role ${role.id} uses unsupported condition adapter ${adapter}`,
        { nodeId, roleId: role.id, adapter });
    }
  }
}

function validateSocialOperations(registry) {
  const reports = [];
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
      validateRoleConditions(nodeId, role);
      for (const condition of role.conditions || []) {
        const dependencyId = conditionReference(condition);
        if (dependencyId && !registry.nodes.has(dependencyId)) {
          fail('missing_node_dependency',
            `Social role ${role.id} has missing dependency ${dependencyId}`,
            { nodeId, roleId: role.id, dependencyId });
        }
      }
      if (roleRequirementContradiction(role)) {
        fail('impossible_social_role',
          `Social operation ${nodeId} has impossible role requirements for ${role.id}`,
          { nodeId, roleId: role.id });
      }
    }

    for (const role of roles) {
      if (role.sameAccountAs !== undefined) {
        if (!nonEmptyString(role.sameAccountAs) || !byId.has(role.sameAccountAs)) {
          fail('invalid_social_role_reference',
            `Social role ${role.id} references unknown social role ${String(role.sameAccountAs)}`,
            { nodeId, roleId: role.id, referencedRoleId: role.sameAccountAs });
        }
        if (role.sameAccountAs === role.id || role.distinct === true
          || byId.get(role.sameAccountAs).distinct === true) {
          fail('impossible_social_role',
            `Social operation ${nodeId} has impossible role requirements: ${role.id} cannot be both distinct and share an account`,
            { nodeId, roleId: role.id, referencedRoleId: role.sameAccountAs });
        }
      }
    }

    const distinctRoleCount = roles.filter((role) => role.distinct === true).length;
    const declared = node.minimumDistinctAccounts ?? node.metadata?.minimumDistinctAccounts;
    if (declared !== undefined && !positiveInteger(declared)) {
      fail('invalid_social_minimum',
        `Social operation ${nodeId} minimumDistinctAccounts must be a positive integer`,
        { nodeId, minimumDistinctAccounts: declared });
    }
    if (declared !== undefined && declared < distinctRoleCount) {
      fail('invalid_social_minimum',
        `Social operation ${nodeId} minimumDistinctAccounts cannot be lower than its distinct roles`,
        { nodeId, minimumDistinctAccounts: declared, distinctRoleCount });
    }
    const minimumDistinctAccounts = Math.max(declared || 0, distinctRoleCount);
    if (minimumDistinctAccounts > roles.length) {
      fail('impossible_social_operation',
        `Social operation ${nodeId} minimumDistinctAccounts exceeds its ${roles.length} roles`,
        { nodeId, minimumDistinctAccounts, roleCount: roles.length });
    }
    reports.push({
      nodeId,
      packageId: node.packageId,
      minimumDistinctAccounts,
      requiredRoles: roles.map((role) => role.id),
      rolesMayShareAccounts: minimumDistinctAccounts < roles.length,
    });
  }
  return reports;
}

function containsRandomTrigger(value, seen = new Set()) {
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    if (key === 'random' && child === true) return true;
    if (['trigger', 'selection', 'mode'].includes(key)
      && typeof child === 'string' && child.toLowerCase().includes('random')) return true;
    if (containsRandomTrigger(child, seen)) return true;
  }
  return false;
}

function containsMintEffect(value, seen = new Set(), effectContext = false) {
  if (effectContext && typeof value === 'string' && /(^|_)mint($|_)/i.test(value)) return true;
  if (!value || typeof value !== 'object' || seen.has(value)) return false;
  seen.add(value);
  for (const [key, child] of Object.entries(value)) {
    const childEffectContext = effectContext
      || ['effect', 'effects', 'action', 'actions'].includes(key);
    if (['effect', 'effects', 'action', 'actions', 'adapter'].includes(key)) {
      const values = Array.isArray(child) ? child : [child];
      if (values.some((entry) => typeof entry === 'string'
        && /(^|_)mint($|_)/i.test(entry))) return true;
    }
    if (key === 'mint' && child === true) return true;
    if (containsMintEffect(child, seen, childEffectContext)) return true;
  }
  return false;
}

function validateOmrRewards(registry) {
  let count = 0;
  for (const [, node] of registry.nodes) {
    const currencies = [node.currency, node.metadata?.currency]
      .filter((currency) => currency !== undefined)
      .map((currency) => String(currency).toUpperCase());
    if (node.type !== 'reward' || !currencies.includes('OMR')) continue;
    count += 1;
    const metadata = node.metadata || {};
    const pkg = registry.byPackage.get(node.packageId);
    if (!nonEmptyString(node.allocationId || metadata.allocationId)
      || !nonEmptyString(pkg?.season) || pkg.season === 'core') {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} requires a finite seasonal allocationId`, { nodeId: node.id });
    }
    if (!nonEmptyString(node.claimKey || metadata.claimKey)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} requires an idempotent claimKey`, { nodeId: node.id });
    }
    const repeatability = node.repeatability || metadata.repeatability;
    if (!['once', 'capped'].includes(repeatability)) {
      fail('invalid_omr_reward',
        `OMR reward ${node.id} repeatability must be once or capped`, { nodeId: node.id });
    }
    const cap = node.claimCap ?? node.cap ?? metadata.claimCap ?? metadata.cap;
    if (repeatability === 'capped' && !positiveInteger(cap)) {
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
  return SEEDED_FLAGS.some((flag) => node[flag] === true || node.metadata?.[flag] === true);
}

function buildMaterialDiagnostics(registry, quantityByNode) {
  const producedBy = new Map();
  const consumedBy = new Map();
  for (const [nodeId, node] of registry.nodes) {
    const quantities = quantityByNode.get(nodeId);
    for (const { id, external } of [...quantities.produces, ...quantities.outputs]) {
      if (external) continue;
      const producers = producedBy.get(id) || [];
      producers.push(nodeId);
      producedBy.set(id, producers);
    }
    for (const { id, external } of [...quantities.consumes, ...quantities.inputs]) {
      if (external) continue;
      const consumers = consumedBy.get(id) || [];
      consumers.push(nodeId);
      consumedBy.set(id, consumers);
    }
    for (const condition of node.conditions || []) {
      if (conditionAdapter(condition) !== 'material_quantity') continue;
      const id = conditionReference(condition);
      if (!id) continue;
      const consumers = consumedBy.get(id) || [];
      consumers.push(nodeId);
      consumedBy.set(id, consumers);
    }
  }

  const requiredMaterials = new Set();
  const sourcedMaterials = new Set();
  const sinklessMaterials = [];
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'material') continue;
    if (consumedBy.has(nodeId)) requiredMaterials.add(nodeId);
    if (producedBy.has(nodeId) || isSeeded(node)) sourcedMaterials.add(nodeId);
    if (requiredMaterials.has(nodeId) && !sourcedMaterials.has(nodeId)) {
      fail('unsourced_material',
        `Required material ${nodeId} has no valid source and is not administrator- or seasonal-seeded`,
        { nodeId, consumers: consumedBy.get(nodeId) });
    }
    if (!consumedBy.has(nodeId) && node.metadata?.economySignificant !== false) {
      sinklessMaterials.push(nodeId);
    }
  }

  const orphanedSources = [];
  for (const [nodeId, node] of registry.nodes) {
    if (node.type !== 'source') continue;
    const outputs = [...quantityByNode.get(nodeId).produces, ...quantityByNode.get(nodeId).outputs];
    if (outputs.length === 0 || outputs.every(({ id }) => !consumedBy.has(id))) {
      orphanedSources.push(nodeId);
    }
  }
  return {
    required: requiredMaterials.size,
    sourced: [...requiredMaterials].filter((id) => sourcedMaterials.has(id)).length,
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
  const { dependencyEdges, quantityByNode } = validateNodeReferences(registry, packageEdges);
  validateMysteryCycles(registry, dependencyEdges);
  const recipes = validateRecipeClasses(registry, quantityByNode);
  validateZeroCostRecipeCycles(registry, quantityByNode);
  const socialOperations = validateSocialOperations(registry);
  const omrRewards = validateOmrRewards(registry);
  const materials = buildMaterialDiagnostics(registry, quantityByNode);

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
      socialOperations: Object.freeze(socialOperations.map((report) => Object.freeze(report))),
    }),
  });
}

export const SUPPORTED_WORLD_GRAPH_CONDITION_ADAPTERS = Object.freeze([...CONDITION_ADAPTERS]);

export default validateGraph;
