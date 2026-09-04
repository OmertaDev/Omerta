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
import { loadGraphPackages, nodeOf } from './worldgraph.js';
import { validateGraph } from './worldgraph-validate.js';
import { CORE_MATERIALS_PACKAGE } from './content/core-materials.js';
import { AUTOMOTIVE_SALVAGE_PACKAGE } from './content/automotive-salvage.js';

const RECIPE_ADAPTERS = new Set(['location', 'skill', 'level', 'owns_car']);
const CASH_COST_KEYS = new Set(['cashcost', 'costcash', 'cost']);
const OMR_COST_KEYS = new Set(['omrcost', 'costomr']);
const QUALITY = 'standard';

export const CRAFTING_GRAPH = loadGraphPackages([
  CORE_MATERIALS_PACKAGE,
  AUTOMOTIVE_SALVAGE_PACKAGE,
]);
export const CRAFTING_GRAPH_VALIDATION = validateGraph(CRAFTING_GRAPH);

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

function recipeOf(recipeId) {
  const id = canonicalString(recipeId, 'Recipe id');
  const recipe = nodeOf(CRAFTING_GRAPH, id);
  if (!recipe || recipe.type !== 'recipe') fail('bad_recipe', 'No such crafting recipe.');
  return recipe;
}

function graphIdentity(recipe) {
  const pkg = CRAFTING_GRAPH.byPackage.get(recipe.packageId);
  return Object.freeze({
    packageId: recipe.packageId,
    packageVersion: Number(pkg.version),
    recipeId: recipe.id,
    recipeVersion: Number(recipe.version),
  });
}

function graphMutationAuthority(recipe) {
  return {
    ...graphIdentity(recipe),
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
    .filter((condition) => (condition?.adapter || condition?.type || condition?.kind) === 'owns_car')
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
  const adapter = condition?.adapter || condition?.type || condition?.kind;
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

function recipeBlockers(recipe, context, options) {
  return conditionsOf(recipe)
    .map((condition) => blockerFor(condition, context, options))
    .filter(Boolean);
}

// Resource snapshots are presentation inputs only. The HTTP board supplies them from authoritative
// reads; domain mutation still re-reads and locks cash/items independently. Keeping this optional
// preserves pure callers that only need location/skill/car eligibility.
export function recipeResourceBlockers(recipe, ctx) {
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
    const templateNode = nodeOf(CRAFTING_GRAPH, entry.templateId);
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
export function recipeCatalog(ctx = {}) {
  const context = previewContext(ctx);
  const discovered = ctx.discovered instanceof Set ? ctx.discovered : new Set(ctx.discovered || []);
  return [...CRAFTING_GRAPH.nodes.values()]
    .filter((node) => node.type === 'recipe'
      && (node.visibility === 'public' || discovered.has(node.id)))
    .map((recipe) => {
      const blockedBy = [
        ...recipeBlockers(recipe, context),
        ...recipeResourceBlockers(recipe, ctx),
      ];
      return {
        ...graphIdentity(recipe),
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
    `SELECT id, model_id, trim_id, listed, pledged, minted_onchain, race_limit, pink_slip
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
    if (!entry.assetType && !entry.templateId) {
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

function templateFor(entry) {
  const template = nodeOf(CRAFTING_GRAPH, entry.templateId);
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

async function consumeRecipeInputs(client, owner, recipe, mutation) {
  const consumed = [];
  for (const entry of inputsOf(recipe)) {
    if (entry.assetType) {
      fail('salvage_required', 'External assets can only be consumed through salvageCar.');
    }
    const template = templateFor(entry);
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

async function produceRecipeOutputs(client, owner, recipe, mutation, provenanceKind) {
  const produced = [];
  for (const entry of outputsOf(recipe)) {
    if (entry.assetType) fail('bad_recipe', 'A recipe cannot produce an external asset.');
    const template = templateFor(entry);
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
export async function craftWorldGraphRecipe(client, h, recipeId, idempotencyKey) {
  const accountId = canonicalString(h?.accountId, 'Authenticated account id');
  const owner = { scope: 'account', id: accountId };
  const recipe = recipeOf(recipeId);
  assertNoUnsupportedEconomy(recipe);
  if (inputsOf(recipe).some((entry) => entry.assetType === 'car')) {
    fail('salvage_required', 'Vehicle recipes must use salvageCar.');
  }
  return withItemMutation(
    client,
    owner,
    'craft',
    idempotencyKey,
    graphMutationAuthority(recipe),
    async (mutation) => {
      const actor = await actorContext(client, accountId);
      assertRequirements(recipe, actor);
      const cash = await debitRecipeCash(client, actor, recipe);
      const inputs = await consumeRecipeInputs(client, owner, recipe, mutation);
      const outputs = await produceRecipeOutputs(
        client, owner, recipe, mutation, 'crafted',
      );
      return {
        ok: true,
        kind: 'craft',
        recipe: graphIdentity(recipe),
        ...cash,
        inputs,
        outputs,
      };
    },
  );
}

/** Execute one exact-car salvage recipe inside an active `withItemTransaction` callback. */
export async function salvageCar(client, h, carIdValue, recipeId, idempotencyKey) {
  const accountId = canonicalString(h?.accountId, 'Authenticated account id');
  const owner = { scope: 'account', id: accountId };
  const carId = canonicalString(carIdValue, 'Car id');
  const recipe = recipeOf(recipeId);
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
    { ...graphMutationAuthority(recipe), carId },
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
        client, owner, recipe, mutation, 'salvaged',
      );
      return {
        ok: true,
        kind: 'salvage_car',
        recipe: graphIdentity(recipe),
        ...cash,
        car,
        inputs: [{ assetType: 'car', quantity: 1, id: car.id }],
        outputs,
      };
    },
  );
}
