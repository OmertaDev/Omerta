// Data-defined Phase 1 crafting and salvage. Domain callers must enter through:
//
//   withItemTransaction(pool, (client) =>
//     craftWorldGraphRecipe(client, { accountId, owned? }, recipeId, idempotencyKey))
//
// `client` is the branded client issued by src/items.js. `accountId` comes from authenticated
// server context; `owned` is optional and is updated only as a response-cache convenience. Every
// mutation authority (living character, location, level, skill, car, quantities, and templates) is
// resolved again from locked rows and the validated immutable graph.
import { GameError, ledger } from './game.js';
import { phase1CraftReason } from './content/phase1-policy.js';
import {
  carMatchesGraphSelector,
  consumeOwnedCarForItemMutation,
} from './economy.js';
import {
  consumeItem,
  consumeStack,
  createItem,
  grantStack,
  registerItemTransactionUndo,
  withItemMutation,
} from './items.js';
import { levelOf } from './rules.js';
import { isWorldGraphRegistry, loadGraphPackages, nodeOf } from './worldgraph.js';
import { validateGraph } from './worldgraph-validate.js';
import { PHASE1_WORLD_GRAPH_PACKAGES } from './content/phase1.js';

const RECIPE_ADAPTERS = new Set(['location', 'skill', 'level', 'owns_car']);
const CASH_COST_KEYS = new Set(['cashcost', 'costcash', 'cost']);
const OMR_COST_KEYS = new Set(['omrcost', 'costomr']);
const CRAFT_CAP_KEYS = new Set(['maxcrafts', 'claimcap', 'cap']);
const QUALITY = 'standard';
const CRAFTING_CONTEXTS = new WeakSet();
const CRAFTING_DEFINITIONS = new WeakMap();
const RECIPE_FIELDS = new Set([
  'id', 'type', 'version', 'visibility', 'repeatability', 'repeatable',
  'consumes', 'inputs', 'produces', 'outputs', 'catalysts', 'catalystInputs',
  'conditions', 'metadata', 'packageId', 'title', 'description', 'lore',
  'cashCost', 'costCash', 'cost', 'omrCost', 'costOmr',
  'maxCrafts', 'claimCap', 'cap',
]);
const RECIPE_METADATA_FIELDS = new Set([
  'title', 'description', 'lore',
  'repeatability', 'repeatable', 'cashCost', 'costCash', 'cost', 'omrCost', 'costOmr',
  'maxCrafts', 'claimCap', 'cap',
]);

const fail = (code, message, data) => { throw new GameError(code, message, data); };

function canonicalString(value, label) {
  if (typeof value !== 'string' || value.trim() !== value || !value || value.length > 200) {
    fail('bad_crafting_request', `${label} must be a canonical string.`);
  }
  return value;
}

function conditionValue(condition, names) {
  for (const name of names) if (condition?.[name] !== undefined) return condition[name];
  return undefined;
}

function graphCarSelector(condition) {
  if (condition?.selector && typeof condition.selector === 'object') return condition.selector;
  for (const kind of ['value', 'carId', 'carType', 'vehicleClass', 'assetType']) {
    if (condition?.[kind] !== undefined) return { kind, value: condition[kind] };
  }
  return null;
}

function conditionsOf(recipe) {
  return Array.isArray(recipe.conditions) ? recipe.conditions : [];
}

function entriesOf(recipe, primary, alias) {
  if (recipe[primary] !== undefined && recipe[alias] !== undefined) {
    fail('bad_recipe', `Recipe ${recipe.id} declares both ${primary} and ${alias}.`);
  }
  return recipe[primary] || recipe[alias] || [];
}

const inputsOf = (recipe) => entriesOf(recipe, 'consumes', 'inputs');
const outputsOf = (recipe) => entriesOf(recipe, 'produces', 'outputs');

const RECIPE_REFERENCE_ALIASES = Object.freeze([
  'templateId', 'nodeId', 'materialId', 'itemTemplateId', 'id',
]);
const RECIPE_CONDITION_ALIASES = Object.freeze({
  location: Object.freeze(['value', 'locationId', 'district']),
  level: Object.freeze(['value', 'minimumLevel', 'level']),
  skill: Object.freeze(['skillId', 'id', 'value']),
  owns_car: Object.freeze(['value', 'carId', 'carType', 'vehicleClass', 'assetType']),
});

function oneDeclared(object, names, label) {
  const declared = names.filter((name) => object[name] !== undefined);
  if (declared.length !== 1) {
    fail('unsupported_recipe_semantics',
      `${label} must declare exactly one supported alias; found ${declared.join(', ') || 'none'}.`);
  }
  return { name: declared[0], value: object[declared[0]] };
}

function normalizedRecipeEntry(registry, recipe, entry, direction) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)
    || Object.getPrototypeOf(entry) !== Object.prototype) {
    fail('unsupported_recipe_semantics',
      `Recipe ${recipe.id} has a malformed ${direction} entry.`);
  }
  const references = RECIPE_REFERENCE_ALIASES.filter((name) => entry[name] !== undefined);
  const hasExternal = entry.assetType !== undefined;
  if ((references.length === 0) === !hasExternal || references.length > 1) {
    fail('unsupported_recipe_semantics',
      `Recipe ${recipe.id} ${direction} entries must be exactly one internal template or external asset.`);
  }
  const quantity = Number(entry.quantity);
  if (!Number.isInteger(quantity) || quantity < 1) {
    fail('unsupported_recipe_semantics',
      `Recipe ${recipe.id} ${direction} quantity must be a positive integer.`);
  }
  if (hasExternal) {
    if (direction !== 'input' || entry.assetType !== 'car'
      || Object.keys(entry).some((key) => !['assetType', 'quantity'].includes(key))) {
      fail('unsupported_recipe_semantics',
        `Recipe ${recipe.id} supports only a closed-shape external car input.`);
    }
    return Object.freeze({ assetType: 'car', quantity });
  }

  const { value } = oneDeclared(entry, RECIPE_REFERENCE_ALIASES,
    `Recipe ${recipe.id} ${direction} template`);
  const templateId = canonicalString(value, 'Recipe template id');
  const template = nodeOf(registry, templateId);
  if (!template || !['material', 'item_template'].includes(template.type)) {
    fail('unsupported_recipe_semantics',
      `Recipe ${recipe.id} ${direction} must target a material or item template.`);
  }
  const allowed = new Set([...RECIPE_REFERENCE_ALIASES, 'quantity', 'quality']);
  if (Object.keys(entry).some((key) => !allowed.has(key))) {
    fail('unsupported_recipe_semantics',
      `Recipe ${recipe.id} ${direction} contains unsupported authority fields.`);
  }
  const quality = entry.quality === undefined ? QUALITY
    : canonicalString(entry.quality, 'Recipe material quality');
  if (quality.length > 80) {
    fail('unsupported_recipe_semantics', 'Recipe material quality exceeds the storage contract.');
  }
  if (template.type === 'item_template' && quality !== QUALITY) {
    fail('unsupported_recipe_semantics',
      `Unique recipe entry ${templateId} cannot declare a nonstandard quality.`);
  }
  return Object.freeze({ templateId, quantity, quality });
}

function normalizedRecipeCondition(recipe, condition) {
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)
    || Object.getPrototypeOf(condition) !== Object.prototype) {
    fail('unsupported_recipe_adapter', `Recipe ${recipe.id} has a malformed condition.`);
  }
  const { value: adapter } = oneDeclared(
    condition, ['adapter', 'type', 'kind'], `Recipe ${recipe.id} condition adapter`,
  );
  if (!RECIPE_ADAPTERS.has(adapter)) {
    fail('unsupported_recipe_adapter',
      `Recipe ${recipe.id} uses unsupported crafting condition adapter ${String(adapter)}.`);
  }
  const aliases = RECIPE_CONDITION_ALIASES[adapter];
  const { name, value } = oneDeclared(
    condition, aliases, `Recipe ${recipe.id} ${adapter} condition`,
  );
  const allowed = new Set(['adapter', 'type', 'kind', ...aliases]);
  if (Object.keys(condition).some((key) => !allowed.has(key))) {
    fail('unsupported_recipe_semantics',
      `Recipe ${recipe.id} ${adapter} condition contains unsupported authority fields.`);
  }
  if (adapter === 'level') {
    const minimumLevel = Number(value);
    if (!Number.isInteger(minimumLevel) || minimumLevel < 1) {
      fail('unsupported_recipe_semantics', `Recipe ${recipe.id} requires a positive integer level.`);
    }
    return Object.freeze({ adapter, minimumLevel });
  }
  const target = canonicalString(value, `Recipe ${adapter} condition target`);
  if (adapter === 'location') return Object.freeze({ adapter, value: target });
  if (adapter === 'skill') return Object.freeze({ adapter, skillId: target });
  return Object.freeze({ adapter, selector: Object.freeze({ kind: name, value: target }) });
}

function recipeOf(context, recipeId) {
  const id = canonicalString(recipeId, 'Recipe id');
  const recipe = CRAFTING_DEFINITIONS.get(context)?.get(id);
  if (!recipe) fail('bad_recipe', 'No such public crafting recipe.');
  return recipe;
}

function graphIdentity(context, recipe) {
  const pkg = context.registry.byPackage.get(recipe.packageId);
  return Object.freeze({
    packageId: recipe.packageId,
    packageVersion: Number(pkg.version),
    recipeId: recipe.id,
    recipeVersion: Number(recipe.version),
  });
}

function graphMutationAuthority(context, recipe) {
  return {
    ...graphIdentity(context, recipe),
    consumes: inputsOf(recipe),
    produces: outputsOf(recipe),
    conditions: conditionsOf(recipe),
    cashCost: cashCostOf(recipe),
  };
}

const normalizedKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');

function numericDeclaration(recipe, keys) {
  const declarations = [];
  for (const container of [recipe, recipe.metadata]) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    for (const [key, value] of Object.entries(container)) {
      if (keys.has(normalizedKey(key))) declarations.push(Number(value));
    }
  }
  return declarations[0];
}

// validateGraph has already rejected non-positive or conflicting canonical aliases. Runtime still
// resolves all aliases so the mutation hash and debit use the exact same validated authority.
function cashCostOf(recipe) {
  return numericDeclaration(recipe, CASH_COST_KEYS) || 0;
}

function hasNumericDeclaration(recipe, keys) {
  for (const container of [recipe, recipe.metadata]) {
    if (!container || typeof container !== 'object' || Array.isArray(container)) continue;
    if (Object.keys(container).some((key) => keys.has(normalizedKey(key)))) return true;
  }
  return false;
}

function conditionAdapter(condition) {
  return condition?.adapter || condition?.type || condition?.kind;
}

function normalizedCraftingDefinitions(registry) {
  if (!isWorldGraphRegistry(registry)) {
    fail('bad_crafting_context', 'Crafting requires an authentic world-graph registry.');
  }
  validateGraph(registry);
  const definitions = new Map();
  for (const node of registry.nodes.values()) {
    if (node.type !== 'recipe') continue;
    const pkg = registry.byPackage.get(node.packageId);
    if (!Number.isInteger(node.version) || node.version < 1
      || !pkg || node.version !== pkg.version) {
      fail('unsupported_recipe_semantics',
        `Recipe ${node.id} version must be a positive integer equal to its package version.`);
    }
    if (Object.keys(node).some((key) => !RECIPE_FIELDS.has(key))
      || (node.metadata && Object.keys(node.metadata)
        .some((key) => !RECIPE_METADATA_FIELDS.has(key)))) {
      fail('unsupported_recipe_semantics',
        `Recipe ${node.id} contains authority fields outside the Phase 1 executable schema.`);
    }
    if (node.visibility !== 'public') {
      fail('unsupported_recipe_visibility',
        `Recipe ${node.id} is not public; Phase 1 has no durable recipe-discovery authority.`);
    }
    if (node.consumes !== undefined && node.inputs !== undefined) {
      fail('unsupported_recipe_semantics',
        `Recipe ${node.id} cannot declare both consumes and inputs.`);
    }
    if (node.produces !== undefined && node.outputs !== undefined) {
      fail('unsupported_recipe_semantics',
        `Recipe ${node.id} cannot declare both produces and outputs.`);
    }
    assertNoUnsupportedEconomy(node);
    if ((Array.isArray(node.catalysts) && node.catalysts.length > 0)
      || (Array.isArray(node.catalystInputs) && node.catalystInputs.length > 0)) {
      fail('unsupported_recipe_semantics',
        `Recipe ${node.id} uses catalysts, which Phase 1 crafting does not implement.`);
    }

    const repeatability = [node.repeatability, node.metadata?.repeatability]
      .filter((value) => value !== undefined)
      .map((value) => String(value).trim().toLowerCase());
    const repeatable = [node.repeatable, node.metadata?.repeatable]
      .filter((value) => value !== undefined);
    const explicitlyUnbounded = repeatability.includes('repeatable') || repeatable.includes(true);
    if (!explicitlyUnbounded || repeatability.some((value) => value !== 'repeatable')
      || repeatable.some((value) => value !== true)
      || hasNumericDeclaration(node, CRAFT_CAP_KEYS)) {
      fail('unsupported_recipe_repeatability',
        `Recipe ${node.id} must be explicitly repeatable and unbounded in Phase 1.`);
    }

    const conditions = conditionsOf(node).map((condition) => (
      normalizedRecipeCondition(node, condition)
    ));
    const consumes = inputsOf(node).map((entry) => (
      normalizedRecipeEntry(registry, node, entry, 'input')
    ));
    const produces = outputsOf(node).map((entry) => (
      normalizedRecipeEntry(registry, node, entry, 'output')
    ));
    const externalInputs = consumes.filter((entry) => entry.assetType !== undefined);
    const ownsCar = conditions.filter((condition) => conditionAdapter(condition) === 'owns_car');
    if (externalInputs.length > 0) {
      if (externalInputs.length !== 1 || externalInputs[0].assetType !== 'car'
        || Number(externalInputs[0].quantity) !== 1
        || consumes.some((entry) => entry.assetType === undefined)
        || ownsCar.length < 1 || ownsCar.some((condition) => !graphCarSelector(condition))) {
        fail('unsupported_salvage_recipe',
          `Recipe ${node.id} must consume exactly one car and declare an owns_car selector.`);
      }
    } else if (ownsCar.length > 0) {
      fail('unsupported_salvage_recipe',
        `Recipe ${node.id} cannot gate on a car without consuming that car.`);
    }

    definitions.set(node.id, Object.freeze({
      id: node.id,
      type: node.type,
      packageId: node.packageId,
      version: node.version,
      visibility: node.visibility,
      repeatability: 'repeatable',
      consumes,
      produces,
      conditions,
      cashCost: cashCostOf(node),
      metadata: node.metadata,
    }));
  }
  return definitions;
}

/** Validate the exact executable subset implemented by this Phase 1 runtime. */
export function validateCraftingDefinitions(registry) {
  const definitions = normalizedCraftingDefinitions(registry);
  return Object.freeze({
    ok: true,
    recipes: definitions.size,
    recipeIds: Object.freeze([...definitions.keys()].sort()),
  });
}

/** Mint opaque runtime authority from an authentic, validated graph registry. */
export function createCraftingContext({ registry } = {}) {
  const definitions = normalizedCraftingDefinitions(registry);
  const context = Object.freeze({ registry });
  CRAFTING_CONTEXTS.add(context);
  CRAFTING_DEFINITIONS.set(context, definitions);
  return context;
}

function contextOf(value) {
  if (!value || typeof value !== 'object' || !CRAFTING_CONTEXTS.has(value)) {
    fail('bad_crafting_context', 'Use createCraftingContext for crafting runtime authority.');
  }
  return value;
}

const CANONICAL_CRAFTING_REGISTRY = loadGraphPackages(PHASE1_WORLD_GRAPH_PACKAGES);
export const DEFAULT_CRAFTING_CONTEXT = createCraftingContext({
  registry: CANONICAL_CRAFTING_REGISTRY,
});

function asSkillSet(value) {
  if (value instanceof Set) return value;
  return new Set(Array.isArray(value) ? value : []);
}

function normalizedCar(car) {
  if (!car || typeof car !== 'object') return null;
  return {
    id: car.id,
    modelId: car.modelId ?? car.model_id,
    trimId: car.trimId ?? car.trim_id,
    listed: !!car.listed,
    pledged: !!car.pledged,
    mintedOnchain: !!(car.mintedOnchain ?? car.minted_onchain),
    raceLimit: car.raceLimit ?? car.race_limit ?? null,
    pinkSlip: !!(car.pinkSlip ?? car.pink_slip),
    rarity: car.rarity ?? null,
    vehicleClass: car.vehicleClass ?? car.vehicle_class ?? car.carClass ?? car.car_class
      ?? car.class ?? null,
  };
}

function matchesCar(car, selector, selectedCarId = null) {
  const normalized = normalizedCar(car);
  if (!normalized || normalized.listed || normalized.pledged || normalized.mintedOnchain
    || normalized.raceLimit !== null || normalized.pinkSlip) return false;
  if (selectedCarId && normalized.id !== selectedCarId) return false;
  return carMatchesGraphSelector(normalized, selector);
}

function ownsCarSelectors(recipe) {
  return conditionsOf(recipe)
    .filter((condition) => conditionAdapter(condition) === 'owns_car')
    .map(graphCarSelector);
}

function previewContext(ctx = {}) {
  const character = ctx.character || ctx.ch || {};
  const suppliedLevel = Number(character.level);
  const level = Number.isInteger(suppliedLevel) && suppliedLevel > 0
    ? suppliedLevel : levelOf(Number(character.respect || 0));
  return {
    character: {
      id: character.id || null,
      loc: character.loc || character.location || null,
      level,
    },
    skills: asSkillSet(ctx.skills ?? ctx.owned?.skills),
    cars: (ctx.cars ?? ctx.owned?.cars ?? []).map(normalizedCar).filter(Boolean),
  };
}

function blockerFor(condition, context, { selectedCarId = null, deferOwnsCar = false } = {}) {
  const adapter = conditionAdapter(condition);
  if (!RECIPE_ADAPTERS.has(adapter)) {
    fail('unsupported_recipe_adapter', `Unsupported crafting condition adapter ${String(adapter)}.`);
  }
  if (adapter === 'location') {
    const required = conditionValue(condition, ['value', 'locationId', 'district']);
    return context.character.loc === required ? null : { adapter, required };
  }
  if (adapter === 'level') {
    const required = Number(conditionValue(condition, ['value', 'minimumLevel', 'level']));
    return context.character.level >= required ? null
      : { adapter, required, current: context.character.level };
  }
  if (adapter === 'skill') {
    const required = conditionValue(condition, ['skillId', 'id', 'value']);
    return context.skills.has(required) ? null : { adapter, required };
  }
  if (deferOwnsCar) return null;
  const selector = graphCarSelector(condition);
  return context.cars.some((car) => matchesCar(car, selector, selectedCarId))
    ? null : { adapter, required: selector?.value, carId: selectedCarId };
}

function recipeBlockers(recipe, context, options = {}) {
  const conditions = conditionsOf(recipe);
  const blockers = conditions
    .filter((condition) => conditionAdapter(condition) !== 'owns_car')
    .map((condition) => blockerFor(condition, context, options))
    .filter(Boolean);
  const carConditions = conditions.filter((condition) => conditionAdapter(condition) === 'owns_car');
  if (!options.deferOwnsCar && carConditions.length > 0) {
    const selectors = carConditions.map(graphCarSelector);
    const matchesConjunction = context.cars.some((car) => (
      selectors.every((selector) => matchesCar(car, selector, options.selectedCarId))
    ));
    if (!matchesConjunction) blockers.push({
      adapter: 'owns_car',
      required: selectors.length === 1 ? selectors[0]?.value
        : selectors.map((selector) => ({ ...selector })),
      carId: options.selectedCarId || null,
    });
  }
  return blockers;
}

// Resource snapshots are presentation inputs only. The HTTP board supplies them from authoritative
// reads; domain mutation still re-reads and locks cash/items independently. Keeping this optional
// preserves pure callers that only need location/skill/car eligibility.
export function recipeResourceBlockers(recipe, ctx, craftingContext = DEFAULT_CRAFTING_CONTEXT) {
  const context = contextOf(craftingContext);
  const blockers = [];
  const rawCash = ctx.cash ?? ctx.character?.cash ?? ctx.ch?.cash;
  const cash = Number(rawCash);
  const cashCost = cashCostOf(recipe);
  if (Number.isFinite(cash) && cash < cashCost) {
    blockers.push({ adapter: 'cash', required: cashCost, current: cash });
  }

  const inventory = ctx.inventory;
  if (!inventory || !Array.isArray(inventory.stacks) || !Array.isArray(inventory.items)) {
    return blockers;
  }
  const stackQuantities = new Map();
  for (const stack of inventory.stacks) {
    const key = `${stack.templateId}\n${stack.quality || QUALITY}`;
    stackQuantities.set(key, (stackQuantities.get(key) || 0) + Number(stack.qty || 0));
  }
  const uniqueQuantities = new Map();
  for (const item of inventory.items) {
    if (item.state !== 'active' || item.escrowed) continue;
    uniqueQuantities.set(item.templateId, (uniqueQuantities.get(item.templateId) || 0) + 1);
  }
  const requiredStacks = new Map();
  const requiredItems = new Map();
  for (const entry of inputsOf(recipe)) {
    if (entry.assetType) continue;
    const templateNode = nodeOf(context.registry, entry.templateId);
    if (templateNode?.type === 'material') {
      const quality = entry.quality || QUALITY;
      const key = `${entry.templateId}\n${quality}`;
      const prior = requiredStacks.get(key) || {
        templateId: entry.templateId, quality, quantity: 0,
      };
      prior.quantity += Number(entry.quantity);
      requiredStacks.set(key, prior);
    } else if (templateNode?.type === 'item_template') {
      requiredItems.set(
        entry.templateId,
        (requiredItems.get(entry.templateId) || 0) + Number(entry.quantity),
      );
    }
  }
  for (const [key, required] of requiredStacks) {
    const current = stackQuantities.get(key) || 0;
    if (current < required.quantity) blockers.push({
      adapter: 'material_quantity', templateId: required.templateId,
      quality: required.quality, required: required.quantity, current,
    });
  }
  for (const [templateId, required] of requiredItems) {
    const current = uniqueQuantities.get(templateId) || 0;
    if (current < required) blockers.push({
      adapter: 'item_ownership', templateId, required, current,
    });
  }
  return blockers;
}

function throwBlocker(blocker) {
  if (blocker.adapter === 'location') {
    fail('location', 'That work must be done at the declared facility.', {
      district: blocker.required,
    });
  }
  if (blocker.adapter === 'level') {
    fail('level', `That recipe requires level ${blocker.required}.`, {
      level: blocker.required, current: blocker.current,
    });
  }
  if (blocker.adapter === 'skill') {
    fail('skill', `That recipe requires the ${blocker.required} skill.`, {
      skillId: blocker.required,
    });
  }
  fail('no_car', 'No matching car is available in this garage.');
}

function assertRequirements(recipe, context, options) {
  const blocker = recipeBlockers(recipe, context, options)[0];
  if (blocker) throwBlocker(blocker);
}

function publicEntry(entry) {
  if (entry.assetType) return { assetType: entry.assetType, quantity: Number(entry.quantity) };
  return {
    templateId: entry.templateId,
    quantity: Number(entry.quantity),
    quality: entry.quality || QUALITY,
  };
}

/**
 * Pure recipe preview. `ctx` is a presentation snapshot:
 * `{ character:{id,loc,level|respect,cash?}, skills:Set|string[], cars:object[], discovered?:Set,
 *    inventory?:{stacks,items}, cash?:number }`.
 * It is never mutation authority; craft/salvage re-read the database.
 */
export function recipeCatalog(ctx = {}, craftingContext = DEFAULT_CRAFTING_CONTEXT) {
  const runtime = contextOf(craftingContext);
  const context = previewContext(ctx);
  return [...CRAFTING_DEFINITIONS.get(runtime).values()]
    .map((recipe) => {
      const blockedBy = [
        ...recipeBlockers(recipe, context),
        ...recipeResourceBlockers(recipe, ctx, runtime),
      ];
      return {
        ...graphIdentity(runtime, recipe),
        id: recipe.id,
        title: recipe.metadata?.title || recipe.id,
        inputs: inputsOf(recipe).map(publicEntry),
        outputs: outputsOf(recipe).map(publicEntry),
        cashCost: cashCostOf(recipe),
        available: blockedBy.length === 0,
        blockedBy,
      };
    });
}

async function actorContext(client, accountId) {
  const character = (await client.query(
    `SELECT id, account_id, loc, respect, cash
       FROM characters WHERE account_id=$1 AND alive FOR UPDATE`,
    [accountId],
  )).rows[0];
  if (!character) fail('no_character', 'Create a character first.');
  // One node-pg client executes sequentially. Overlapping queries on a checked-out client are
  // deprecated and disappear in pg@9; pg-mem would hide that production-only failure mode.
  const skills = await client.query(
    'SELECT skill_id FROM character_skills WHERE character_id=$1', [character.id],
  );
  const cars = await client.query(
    `SELECT id, model_id, trim_id, rarity, listed, pledged, minted_onchain, race_limit, pink_slip
       FROM cars WHERE character_id=$1`,
    [character.id],
  );
  return {
    owner: { scope: 'account', id: accountId },
    character: {
      id: character.id,
      loc: character.loc,
      level: levelOf(Number(character.respect || 0)),
      cash: Number(character.cash || 0),
    },
    skills: new Set(skills.rows.map((row) => row.skill_id)),
    cars: cars.rows.map(normalizedCar),
  };
}

function assertNoUnsupportedEconomy(recipe) {
  if (numericDeclaration(recipe, OMR_COST_KEYS) !== undefined
    || [...inputsOf(recipe), ...outputsOf(recipe)].some((entry) => (
      normalizedKey(entry?.assetType) === 'omr' || normalizedKey(entry?.currency) === 'omr'
    ))) {
    fail('unsupported_recipe_cost', 'This crafting runtime does not support OMR costs or outputs.');
  }
  for (const entry of [...inputsOf(recipe), ...outputsOf(recipe)]) {
    if (!entry.assetType && !RECIPE_REFERENCE_ALIASES.some((name) => entry?.[name] !== undefined)) {
      fail('bad_recipe', `Recipe ${recipe.id} contains a non-item economy entry.`);
    }
  }
}

async function debitRecipeCash(client, actor, recipe) {
  const cashCost = cashCostOf(recipe);
  if (!cashCost) return { cashCost: 0, cashAfter: actor.character.cash };
  if (actor.character.cash < cashCost) {
    fail('cash', `That recipe costs $${cashCost.toLocaleString()}.`, {
      required: cashCost, current: actor.character.cash,
    });
  }

  // Real PostgreSQL rolls both rows back with the surrounding item transaction. pg-mem does not,
  // so preserve the exact locked balance and exact audit-row identity in the module compensation log.
  registerItemTransactionUndo(client, () => client.query(
    'UPDATE characters SET cash=$2 WHERE id=$1',
    [actor.character.id, actor.character.cash],
  ));
  const debited = await client.query(
    `UPDATE characters SET cash=cash-$2
      WHERE id=$1 AND alive AND cash >= $2
      RETURNING cash`,
    [actor.character.id, cashCost],
  );
  if (debited.rowCount !== 1) {
    fail('cash', `That recipe costs $${cashCost.toLocaleString()}.`, {
      required: cashCost, current: actor.character.cash,
    });
  }
  const transactionId = await ledger(client, {
    characterId: actor.character.id,
    currency: 'cash',
    amount: -cashCost,
    reason: phase1CraftReason(recipe.id),
  });
  registerItemTransactionUndo(client, () => client.query(
    'DELETE FROM transactions WHERE id=$1', [transactionId],
  ));
  return { cashCost, cashAfter: Number(debited.rows[0].cash) };
}

function templateFor(context, entry) {
  const template = nodeOf(context.registry, entry.templateId);
  if (!template || !['material', 'item_template'].includes(template.type)) {
    fail('bad_recipe', `Recipe output ${String(entry.templateId)} is not an item template.`);
  }
  return template;
}

async function uniqueInput(client, owner, entry) {
  const row = (await client.query(
    `SELECT id FROM item_instances
      WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND state='active'
      ORDER BY created_at,id LIMIT 1 FOR UPDATE`,
    [owner.scope, owner.id, entry.templateId],
  )).rows[0];
  if (!row) fail('item_unavailable', 'That unique recipe input is not available.');
  return row.id;
}

async function consumeRecipeInputs(client, context, owner, recipe, mutation) {
  const consumed = [];
  for (const entry of inputsOf(recipe)) {
    if (entry.assetType) {
      fail('salvage_required', 'External assets can only be consumed through salvageCar.');
    }
    const template = templateFor(context, entry);
    if (template.type === 'material') {
      consumed.push(await consumeStack(
        client, owner, entry.templateId, Number(entry.quantity), entry.quality || QUALITY,
        `craft ${recipe.id} input`, mutation,
      ));
    } else {
      const itemId = await uniqueInput(client, owner, entry);
      consumed.push(await consumeItem(
        client, owner, itemId, `craft ${recipe.id} input`, mutation,
      ));
    }
  }
  return consumed;
}

async function produceRecipeOutputs(client, context, owner, recipe, mutation, provenanceKind) {
  const produced = [];
  for (const entry of outputsOf(recipe)) {
    if (entry.assetType) fail('bad_recipe', 'A recipe cannot produce an external asset.');
    const template = templateFor(context, entry);
    if (template.type === 'material') {
      produced.push(await grantStack(
        client, owner, entry.templateId, Number(entry.quantity), entry.quality || QUALITY,
        `${recipe.id} output`, mutation,
      ));
    } else {
      // Static validation guarantees a unique template is always produced at quantity one.
      produced.push(await createItem(
        client, owner, entry.templateId, provenanceKind, mutation,
      ));
    }
  }
  return produced;
}

/** Execute one non-salvage recipe inside an active `withItemTransaction` callback. */
export async function craftWorldGraphRecipe(
  client, h, recipeId, idempotencyKey, craftingContext = DEFAULT_CRAFTING_CONTEXT,
) {
  const context = contextOf(craftingContext);
  const accountId = canonicalString(h?.accountId, 'Authenticated account id');
  const owner = { scope: 'account', id: accountId };
  const recipe = recipeOf(context, recipeId);
  assertNoUnsupportedEconomy(recipe);
  if (inputsOf(recipe).some((entry) => entry.assetType === 'car')) {
    fail('salvage_required', 'Vehicle recipes must use salvageCar.');
  }
  return withItemMutation(
    client,
    owner,
    'craft',
    idempotencyKey,
    graphMutationAuthority(context, recipe),
    async (mutation) => {
      const actor = await actorContext(client, accountId);
      assertRequirements(recipe, actor);
      const cash = await debitRecipeCash(client, actor, recipe);
      const inputs = await consumeRecipeInputs(client, context, owner, recipe, mutation);
      const outputs = await produceRecipeOutputs(
        client, context, owner, recipe, mutation, 'crafted',
      );
      return {
        ok: true,
        kind: 'craft',
        recipe: graphIdentity(context, recipe),
        ...cash,
        inputs,
        outputs,
      };
    },
  );
}

/** Execute one exact-car salvage recipe inside an active `withItemTransaction` callback. */
export async function salvageCar(
  client, h, carIdValue, recipeId, idempotencyKey,
  craftingContext = DEFAULT_CRAFTING_CONTEXT,
) {
  const context = contextOf(craftingContext);
  const accountId = canonicalString(h?.accountId, 'Authenticated account id');
  const owner = { scope: 'account', id: accountId };
  const carId = canonicalString(carIdValue, 'Car id');
  const recipe = recipeOf(context, recipeId);
  assertNoUnsupportedEconomy(recipe);
  const externalInputs = inputsOf(recipe).filter((entry) => entry.assetType);
  if (externalInputs.length !== 1 || externalInputs[0].assetType !== 'car'
    || Number(externalInputs[0].quantity) !== 1
    || inputsOf(recipe).some((entry) => !entry.assetType)) {
    fail('bad_salvage_recipe', 'Vehicle salvage requires exactly one graph-declared car input.');
  }
  return withItemMutation(
    client,
    owner,
    'salvage_car',
    idempotencyKey,
    { ...graphMutationAuthority(context, recipe), carId },
    async (mutation) => {
      const actor = await actorContext(client, accountId);
      // The locked car helper is the sole mutation authority for owns_car. Deferring only this
      // adapter preserves specific listed/pledged/on-chain/race errors while all other gates are
      // still enforced from the actor's locked server state.
      assertRequirements(recipe, actor, { selectedCarId: carId, deferOwnsCar: true });
      const cash = await debitRecipeCash(client, actor, recipe);
      const car = await consumeOwnedCarForItemMutation(
        client, h, actor.character.id, carId, ownsCarSelectors(recipe),
      );
      const outputs = await produceRecipeOutputs(
        client, context, owner, recipe, mutation, 'salvaged',
      );
      return {
        ok: true,
        kind: 'salvage_car',
        recipe: graphIdentity(context, recipe),
        ...cash,
        car,
        inputs: [{ assetType: 'car', quantity: 1, id: car.id }],
        outputs,
      };
    },
  );
}
