import crypto from 'node:crypto';
import fs from 'node:fs';
import { GameError } from './game.js';
import { assertItemTransaction, registerItemTransactionUndo, poisonItemTransaction } from './items.js';
import { craftWorldGraphRecipe, recipeCatalog, DEFAULT_CRAFTING_CONTEXT } from './crafting.js';
import { nodeOf } from './worldgraph.js';
import { canonicalBytes } from './content/canonical.js';
import { guardDelegatedControl } from './operatingpolicy.js';

export const COMPANY_PRODUCTION = Object.freeze({ maxSteps: 3, maxCrafts: 6, receiptPage: 20,
  authority: 'canonical-authored-worldgraph-recipes', quality: 'canonical-recipe-output' });
const fail = reason => { throw new GameError('company_production', reason); };
const text = value => typeof value === 'string' && value.length >= 1 && value.length <= 128 && value.trim() === value;
const exact = (value, keys) => value && typeof value === 'object' && !Array.isArray(value)
  && Object.keys(value).sort().join(',') === [...keys].sort().join(',');
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const codePin = Object.freeze(Object.fromEntries(['crafting.js', 'items.js'].map(name => [name,
  crypto.createHash('sha256').update(fs.readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')).digest('hex')])));

function batch(body) {
  if (!exact(body, ['businessId', 'steps']) || !text(body.businessId) || !Array.isArray(body.steps) || body.steps.length < 1 || body.steps.length > COMPANY_PRODUCTION.maxSteps) fail('terms');
  let totalCrafts = 0;
  const steps = body.steps.map(step => {
    if (!exact(step, ['recipeId', 'repeat']) || !text(step.recipeId) || !Number.isSafeInteger(step.repeat) || step.repeat < 1) fail('terms');
    totalCrafts += step.repeat;
    if (totalCrafts > COMPANY_PRODUCTION.maxCrafts) fail('batch_limit');
    return { recipeId: step.recipeId, repeat: step.repeat };
  });
  return { businessId: body.businessId, steps, totalCrafts };
}

// This is the same immutable authored catalog used by canonical crafting. It is
// a terms projection, not an inventory, discovery or execution eligibility grant.
export function companyProductionRecipes() {
  return recipeCatalog().filter(recipe => recipe.inputs && !recipe.inputs.some(input => input.assetType))
    .map(({ id, title, inputs, outputs, cashCost }) => ({ id, title, inputs, outputs, cashCost }));
}

// Caller owns Items.withItemTransaction, never G.withCharacter. The pending root
// binds the original actor and random child-key namespace before any craft. It
// commits only with all canonical guards, inputs, outputs and the final receipt.
async function runProduction(client, accountId, body, requestKey, options) {
  assertItemTransaction(client);
  if (!text(accountId) || !text(requestKey)) fail('identifier');
  if (!exact(options, ['beforeCraft', 'agentCredential']) || typeof options.agentCredential !== 'boolean'
      || (options.beforeCraft !== undefined && typeof options.beforeCraft !== 'function')) fail('internal_context');
  const normalized = batch(body), bodyHash = digest([accountId, normalized.businessId, normalized.steps]);
  const prior = (await client.query('SELECT body_hash,receipt FROM company_production_receipts WHERE account_id=$1 AND request_key=$2', [accountId, requestKey])).rows[0];
  if (prior) {
    if (prior.body_hash !== bodyHash) fail('request_conflict');
    if (!prior.receipt) fail('request_in_progress');
    return prior.receipt;
  }
  if (typeof options.beforeCraft !== 'function') fail('admission_unavailable');
  const actors = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE account_id=$1 AND alive=true ORDER BY id LIMIT 2', [accountId])).rows;
  if (actors.length !== 1 || actors[0].is_npc) fail('living_character');
  const declared = new Map(companyProductionRecipes().map(recipe => [recipe.id, recipe]));
  if (normalized.steps.some(step => !declared.has(step.recipeId))) fail('recipe_unavailable');
  const totalCashCost = normalized.steps.reduce((sum, step) => sum + declared.get(step.recipeId).cashCost * step.repeat, 0);
  const sourcePin = { authority: COMPANY_PRODUCTION.authority, code: codePin,
    recipes: [...new Set(normalized.steps.map(step => step.recipeId))].map(recipeId => ({ recipeId,
      definitionHash: crypto.createHash('sha256').update(canonicalBytes(nodeOf(DEFAULT_CRAFTING_CONTEXT.registry, recipeId))).digest('hex') })) };
  const originalCharacter = actors[0].id, runId = crypto.randomUUID();
  registerItemTransactionUndo(client, () => client.query('DELETE FROM company_production_receipts WHERE account_id=$1 AND request_key=$2 AND run_id=$3', [accountId, requestKey, runId]));
  await client.query('INSERT INTO company_production_receipts(account_id,request_key,run_id,body_hash,source_pin,normalized_body) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT(account_id,request_key) DO NOTHING', [accountId, requestKey, runId, bodyHash, JSON.stringify(sourcePin), JSON.stringify({ businessId: normalized.businessId, steps: normalized.steps })]);
  const root = (await client.query('SELECT run_id,original_character,body_hash,receipt FROM company_production_receipts WHERE account_id=$1 AND request_key=$2 FOR UPDATE', [accountId, requestKey])).rows[0];
  if (root.body_hash !== bodyHash) fail('request_conflict');
  if (root.receipt) return root.receipt;
  if (root.run_id !== runId) fail('request_in_progress');
  const actor = (await client.query('SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE', [originalCharacter, accountId])).rows[0];
  if (!actor?.alive || actor.is_npc) fail('living_character');
  const account = (await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR UPDATE', [accountId])).rows[0];
  if (account?.status !== 'active') fail('active_account');
  const business = (await client.query('SELECT id,owner_character,status FROM business_depots WHERE id=$1 FOR UPDATE', [normalized.businessId])).rows[0];
  if (!business || business.status !== 'open' || business.owner_character !== originalCharacter) fail('business_owner');
  if (!(await client.query('SELECT account_id FROM agent_company_profiles WHERE account_id=$1', [accountId])).rows[0]) fail('company');
  const crafts = []; let ordinal = 0;
  for (const step of normalized.steps) for (let repetition = 0; repetition < step.repeat; repetition++) {
    const key = `company-production:${runId}:${ordinal}`;
    if ((await client.query('SELECT idempotency_key FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0]) fail('source_conflict');
    const recipeCashCost = declared.get(step.recipeId).cashCost;
    const context = Object.freeze({ accountId, originalCharacter, businessId: business.id, requestKey, recipeId: step.recipeId,
      ordinal, totalCrafts: normalized.totalCrafts, agent: options.agentCredential, totalCashCost, recipeCashCost });
    const admission = await options.beforeCraft(client, context);
    if (options.agentCredential && admission?.productionAuthorized !== true) {
      await guardDelegatedControl(client, business.id, true);
      fail('production_consent');
    }
    const receipt = await craftWorldGraphRecipe(client, { accountId, expectedCharacterId: originalCharacter }, step.recipeId, key);
    if (receipt.cashCost !== recipeCashCost) fail('source_changed');
    crafts.push({ ordinal, key, receipt, ...(admission === undefined ? {} : { admission }) }); ordinal++;
  }
  const receipt = { ok: true, runId, originalCharacter, businessId: business.id, sourcePin, steps: normalized.steps, totalCrafts: normalized.totalCrafts, totalCashCost,
    authority: COMPANY_PRODUCTION.authority, quality: COMPANY_PRODUCTION.quality, crafts };
  const saved = await client.query('UPDATE company_production_receipts SET receipt=$4,original_character=$5,business_id=$6,account_ref=$1 WHERE account_id=$1 AND request_key=$2 AND run_id=$3 AND receipt IS NULL', [accountId, requestKey, runId, JSON.stringify(receipt), originalCharacter, business.id]);
  if (saved.rowCount !== 1) fail('source_conflict');
  return receipt;
}

export async function runCompanyProduction(client, accountId, body, requestKey, options = {}) {
  assertItemTransaction(client);
  try { return await runProduction(client, accountId, body, requestKey, options); }
  catch (error) { poisonItemTransaction(client, error); throw error; }
}

export async function companyProductionBoard(client, accountId, after = null) {
  assertItemTransaction(client);
  if (!text(accountId) || (after !== null && !text(after))) fail('identifier');
  const rows = after === null
    ? (await client.query('SELECT request_key,receipt FROM company_production_receipts WHERE account_id=$1 AND receipt IS NOT NULL ORDER BY request_key LIMIT 21', [accountId])).rows
    : (await client.query('SELECT request_key,receipt FROM company_production_receipts WHERE account_id=$1 AND request_key>$2 AND receipt IS NOT NULL ORDER BY request_key LIMIT 21', [accountId, after])).rows;
  const page = rows.slice(0, COMPANY_PRODUCTION.receiptPage);
  return { recipes: companyProductionRecipes(), receipts: page.map(row => ({ requestKey: row.request_key, receipt: row.receipt })),
    nextCursor: rows.length > COMPANY_PRODUCTION.receiptPage ? page.at(-1).request_key : null, limits: COMPANY_PRODUCTION };
}
