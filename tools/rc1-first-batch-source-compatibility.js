import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const lf=t=>t.replaceAll('\r\n','\n'),hash=t=>crypto.createHash('sha256').update(t).digest('hex'),blob=t=>crypto.createHash('sha1').update('blob '+Buffer.byteLength(t)+'\0').update(t).digest('hex');
export const FIRST_BATCH_SOURCE_REVISION="066808b48500c2132207e851f1a998e788f4e7a2";
export const FIRST_BATCH_SOURCE_PREDECESSOR="f254c64a54a019665d7a516d382d56b46f2dcd82";
export const FIRST_BATCH_SOURCE_PHASE='exact-source-transfer-only; no historical native/world/financial clearance';
export const FIRST_BATCH_SOURCE_DOMAINS=Object.freeze({
  "schema.sql": {
    "currentSha256": "220780ae48a8a6ce9a3a1970110c4d420720c777c80217811c7166cf53e36390",
    "currentBlob": "dbca5a839e79ee66e5502fe7308270f9c7e28851",
    "baselineSha256": "d45c84e1b364d82f0834975f08a58675c8e3930dc35f0dd47534c5bed4741c9f",
    "baselineBlob": "8216351a092c94922ab33beef5eac465048715b1",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "\nALTER TABLE business_season_entries ADD COLUMN IF NOT EXISTS next_observation_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();\nCREATE INDEX IF NOT EXISTS business_season_due ON business_season_entries(next_observation_at,season_id,account_id) WHERE final_result IS NULL;\n\n-- Canonical business production, scoped game-only policies, and immutable physical equipment condition.\nCREATE TABLE IF NOT EXISTS company_production_receipts (\n  account_id TEXT NOT NULL,\n  account_ref TEXT REFERENCES accounts(id),\n  request_key TEXT NOT NULL CHECK(char_length(request_key) BETWEEN 1 AND 128),\n  run_id TEXT NOT NULL UNIQUE,\n  original_character TEXT REFERENCES characters(id),\n  business_id TEXT REFERENCES business_depots(id),\n  body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),\n  source_pin JSONB NOT NULL,\n  normalized_body JSONB NOT NULL,\n  receipt JSONB,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),\n  PRIMARY KEY(account_id,request_key),\n  CHECK((receipt IS NULL AND account_ref IS NULL AND original_character IS NULL AND business_id IS NULL)\n    OR (receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND original_character IS NOT NULL AND business_id IS NOT NULL\n      AND normalized_body->>'businessId' IS NOT NULL AND receipt->>'businessId' IS NOT NULL AND receipt->>'originalCharacter' IS NOT NULL\n      AND normalized_body->>'businessId'=business_id AND receipt->>'businessId'=business_id\n      AND receipt->>'originalCharacter'=original_character))\n);\nCREATE TABLE IF NOT EXISTS company_specializations (\n business_id TEXT PRIMARY KEY REFERENCES business_depots(id), account_id TEXT NOT NULL REFERENCES accounts(id),\n original_character TEXT NOT NULL REFERENCES characters(id), revision INT NOT NULL CHECK(revision BETWEEN 1 AND 2147483647),\n kind TEXT NOT NULL CHECK(kind IN ('volume','quality','speed','niche')), recipe_ids JSONB NOT NULL,\n tool_item_id TEXT REFERENCES item_instances(id), next_run_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n allow_agent_production BOOLEAN NOT NULL DEFAULT false, grant_expires_at TIMESTAMPTZ,\n max_batch_cash INT NOT NULL DEFAULT 0 CHECK(max_batch_cash BETWEEN 0 AND 1800),\n max_grant_cash INT NOT NULL DEFAULT 0 CHECK(max_grant_cash BETWEEN 0 AND 1800),\n grant_spent INT NOT NULL DEFAULT 0 CHECK(grant_spent BETWEEN 0 AND 1800));\nCREATE TABLE IF NOT EXISTS company_specialization_requests (\n account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, identity JSONB NOT NULL, receipt JSONB NOT NULL,\n PRIMARY KEY(account_id,request_key));\nCREATE TABLE IF NOT EXISTS company_specialization_runs (\n account_id TEXT NOT NULL REFERENCES accounts(id), request_key TEXT NOT NULL, business_id TEXT NOT NULL REFERENCES business_depots(id),\n original_character TEXT NOT NULL REFERENCES characters(id), revision INT NOT NULL, total_crafts INT NOT NULL CHECK(total_crafts BETWEEN 1 AND 6),\n PRIMARY KEY(account_id,request_key));\nCREATE TABLE IF NOT EXISTS item_durability_states (\n item_id TEXT PRIMARY KEY REFERENCES item_instances(id), creation_event TEXT NOT NULL REFERENCES item_events(id),\n remaining INT NOT NULL CHECK(remaining BETWEEN 0 AND 150), revision INT NOT NULL CHECK(revision>=1));\nCREATE TABLE IF NOT EXISTS item_durability_uses (\n event_id TEXT PRIMARY KEY REFERENCES item_events(id), item_id TEXT NOT NULL REFERENCES item_durability_states(item_id),\n instance_id TEXT NOT NULL REFERENCES mystery_instances(id), node_id TEXT NOT NULL,\n mutation_key TEXT NOT NULL, before_condition INT NOT NULL CHECK(before_condition BETWEEN 10 AND 150),\n after_condition INT NOT NULL CHECK(after_condition = before_condition - 10),\n UNIQUE(item_id,instance_id,node_id));\nCREATE TABLE IF NOT EXISTS item_durability_birth_quality (\n item_id TEXT PRIMARY KEY REFERENCES item_instances(id), craft_key TEXT NOT NULL UNIQUE REFERENCES item_mutation_guards(idempotency_key),\n creation_event TEXT NOT NULL UNIQUE REFERENCES item_events(id), authority_account TEXT NOT NULL REFERENCES accounts(id),\n request_hash TEXT NOT NULL CHECK(char_length(request_hash)=64), recipe_identity JSONB NOT NULL,\n grade TEXT NOT NULL CHECK(grade='tempered'), maximum INT NOT NULL CHECK(maximum=150));\n",
        "baseline": "\nALTER TABLE business_season_entries ADD COLUMN IF NOT EXISTS next_observation_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp();\nCREATE INDEX IF NOT EXISTS business_season_due ON business_season_entries(next_observation_at,season_id,account_id) WHERE final_result IS NULL;\n"
      }
    ]
  },
  "src/server.js": {
    "currentSha256": "7dc7d0ef4ab1c10b1cfb6fe159bab0da30b49d55116fda4e9c5b4bf861957eb4",
    "currentBlob": "61390e8857f730fde419c64c7b8ef072c7354e92",
    "baselineSha256": "a9947ce55044b785ab7d6fc39f03695336e82f3e691ba912e61eddc29e6273dd",
    "baselineBlob": "4861c65211bd43c1927b8ea78204a52ea86c3666",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "import { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerCompanyProduction } from './routes/companyproduction.js';\nimport { register as registerCompanyDemand } from './routes/companydemand.js';\nimport { register as registerCompanyForecast } from './routes/companyforecast.js';\nimport { register as registerCompanySpecialization } from './routes/companyspecialization.js';\nimport { register as registerItemDurability } from './routes/itemdurability.js';\nimport { assertCompanySpecializationBeforeCraft } from './companyspecialization.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\n",
        "baseline": "import { register as registerMarketFeed } from './routes/marketfeed.js';\nimport { register as registerStrategyLeagues } from './routes/strategyleagues.js';\nimport { register as registerCompanyOperators } from './routes/companyoperators.js';\nimport { register as registerGameEmployment } from './routes/gameemployment.js';\nimport { register as registerCompanyWorkflows } from './routes/companyworkflows.js';\nimport { register as registerCompanyOpportunities } from './routes/companyopportunities.js';\n"
      },
      {
        "current": "  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n  registerCompanyProduction(app, { pool, auth, beforeCraft: assertCompanySpecializationBeforeCraft });\n  registerCompanyDemand(app, { pool, auth });\n  registerCompanyForecast(app, { pool, auth });\n  registerCompanySpecialization(app, { pool, auth });\n  registerItemDurability(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n",
        "baseline": "  registerMarketFeed(app, { pool });\n  registerStrategyLeagues(app, { pool, auth });\n  registerCompanyOperators(app, { pool, auth });\n  registerGameEmployment(app, { pool, auth });\n  registerCompanyWorkflows(app, { pool, auth });\n  registerCompanyOpportunities(app, { pool, auth });\n"
      }
    ]
  },
  "src/invariants.js": {
    "currentSha256": "7dab52fda0727a37e71cbcaa2a35fc2dec4ea0c06bdd6c48d46576629bb236f4",
    "currentBlob": "e97817801a5cb6c9dcd812759fef826f44e53076",
    "baselineSha256": "35b63417a338cca386eff1fabd4d5be95fe3adcec61ba7582bb9a646d06295f1",
    "baselineBlob": "7b56207187c472b3b4465e711545f5a834f4ffa4",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "import { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { logisticsHubInvariant } from './companylogisticshubsinvariants.js';\nimport { runBuyerCooperativeInvariants } from './buyercooperativeinvariants.js';\nimport { collectItemConditionIssues } from './itemdurability.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n",
        "baseline": "import { runCompanyBankPortfolioInvariants } from './companybankportfolioinvariants.js';\nimport { logisticsHubInvariant } from './companylogisticshubsinvariants.js';\nimport { runBuyerCooperativeInvariants } from './buyercooperativeinvariants.js';\nimport { dbCaps } from './db.js';\nimport { withPhase2Read } from './content/phase2-transactions.js';\nimport { withItemRead } from './items.js';\n"
      },
      {
        "current": "  push('buyer cooperative GIN custody', cooperatives.ginEscrow, cooperativeCapturedGin - cooperativeClaimedGin + cooperativeDeathGin, 0);\n  push('buyer cooperative settlement provenance', cooperatives.issues.length, 0, 0, { issues: cooperatives.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  const equipmentIssues = await collectItemConditionIssues(pool);\n  push('physical equipment condition provenance', equipmentIssues.length, 0, 0, { issues: equipmentIssues });\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n  push('strategy league bindings', await strategyLeagueFaults(pool), 0, 0);\n",
        "baseline": "  push('buyer cooperative GIN custody', cooperatives.ginEscrow, cooperativeCapturedGin - cooperativeClaimedGin + cooperativeDeathGin, 0);\n  push('buyer cooperative settlement provenance', cooperatives.issues.length, 0, 0, { issues: cooperatives.issues });\n  push('strategy license transfers', 0, await sum(pool, \"currency='cash' AND reason LIKE 'strategy:%'\"), 0);\n  push('strategy license bindings', await strategyLicenseFaults(pool), 0, 0);\n  push('company succession bindings', await companySuccessionFaults(pool), 0, 0);\n  push('strategy league bindings', await strategyLeagueFaults(pool), 0, 0);\n"
      }
    ]
  },
  "src/items.js": {
    "currentSha256": "26c047fd46a7090a82e1253f94a5f4ed5170d48966ffc61194b468742dd38cec",
    "currentBlob": "eae1d287a7b05983c4b6e64b102242c446364d82",
    "baselineSha256": "d9c03f41a35f2b62b8ddb2a049a5cc515c5d9b25a8d7515a38f01b664f19fa98",
    "baselineBlob": "b36c6dec6898a3a29eaf7d4d18842ef8068c7a37",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "}\n\nexport function assertItemTransaction(client) { transactionClient(client); }\n/** True only for a mutation newly reserved by this branded transaction, not a historical replay. */\nexport async function ownsItemMutationReservation(client, key) {\n  const owned = transactionClient(client).guardReservations.find(([reservedKey]) => reservedKey === key);\n  if (!owned) return false;\n  const row = (await client.query('SELECT reservation_id FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];\n  return row?.reservation_id === owned[1];\n}\n\nfunction mutationState(client, token) {\n  const transaction = transactionClient(client);\n  const state = token && typeof token === 'object' ? MUTATION_CONTEXTS.get(token) : null;\n",
        "baseline": "}\n\nexport function assertItemTransaction(client) { transactionClient(client); }\nfunction mutationState(client, token) {\n  const transaction = transactionClient(client);\n  const state = token && typeof token === 'object' ? MUTATION_CONTEXTS.get(token) : null;\n"
      },
      {
        "current": "  // serialized module-wide below, so a transaction-local inverse log gives the same externally visible\n  // atomicity contract without overwriting a later successful item transaction. Events go first\n  // because they reference both guards and permanent item rows; guards go last.\n  // Dependent adapter rows must release their same-transaction event FKs first.\n  for (let i = transaction.beforeEventUndo.length - 1; i >= 0; i--) await transaction.beforeEventUndo[i]();\n  for (const [key, reservationId] of transaction.guardReservations) {\n    const row = (await client.query('SELECT reservation_id FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];\n    if (row?.reservation_id === reservationId) {\n",
        "baseline": "  // serialized module-wide below, so a transaction-local inverse log gives the same externally visible\n  // atomicity contract without overwriting a later successful item transaction. Events go first\n  // because they reference both guards and permanent item rows; guards go last.\n  for (const [key, reservationId] of transaction.guardReservations) {\n    const row = (await client.query('SELECT reservation_id FROM item_mutation_guards WHERE idempotency_key=$1', [key])).rows[0];\n    if (row?.reservation_id === reservationId) {\n"
      },
      {
        "current": "  return TRANSACTION_SCOPE.run({ active: true }, async () => {\n    const scope = TRANSACTION_SCOPE.getStore();\n    let client = null, discard = false, begun = false, outcome, borrowed = false;\n    const transaction = { active: false, failed: null, guardReservations: [], beforeEventUndo: [], undo: [] };\n    // Keep all raw failures inside the item owner. The registry wrapper sees a private outcome,\n    // never a raw SQLSTATE that it could remap before rollback/commit disposition is known.\n    async function ownedAction() {\n",
        "baseline": "  return TRANSACTION_SCOPE.run({ active: true }, async () => {\n    const scope = TRANSACTION_SCOPE.getStore();\n    let client = null, discard = false, begun = false, outcome, borrowed = false;\n    const transaction = { active: false, failed: null, guardReservations: [], undo: [] };\n    // Keep all raw failures inside the item owner. The registry wrapper sees a private outcome,\n    // never a raw SQLSTATE that it could remap before rollback/commit disposition is known.\n    async function ownedAction() {\n"
      },
      {
        "current": "  registerUndo(client, undo);\n}\n\n/** Internal adapter inverse for rows referencing newly emitted canonical events.\n * Only a branded active transaction can register it; graph content receives no callback capability.\n * The pg-mem inverse runs before deleting events. Native PostgreSQL keeps its ordinary ROLLBACK.\n */\nexport function registerItemTransactionBeforeEventUndo(client, undo) {\n  const transaction = transactionClient(client);\n  if (typeof undo !== 'function') fail('bad_item_request', 'Item event compensation requires a callback.');\n  transaction.beforeEventUndo.push(undo);\n}\n\nasync function beginMutation(client, kind, owner, idempotencyKey, request) {\n  await activeTransaction(client);\n  const key = logicalKey(idempotencyKey);\n",
        "baseline": "  registerUndo(client, undo);\n}\n\nasync function beginMutation(client, kind, owner, idempotencyKey, request) {\n  await activeTransaction(client);\n  const key = logicalKey(idempotencyKey);\n"
      }
    ]
  },
  "src/mysteries.js": {
    "currentSha256": "883d561fc77b4c2b00252b481898f0640a0da25943d40b3c747786652f03bd76",
    "currentBlob": "42d22a22fec0aae01dccfc46b7a2e664a7e62cbb",
    "baselineSha256": "7faa48d86f2cd18659f0a54080f99db18d9f05115b3f797808e2772c6f811091",
    "baselineBlob": "c737b4bcfd9616bca6200a315f029ea68ff6689a",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "// guard is reserved. Content supplies data only: no callback, SQL, cash, or OMR adapter exists.\nimport crypto from 'node:crypto';\nimport { GameError } from './game.js';\nimport { assertEquipmentUsable, recordEquipmentUse } from './itemdurability.js';\nimport {\n  consumeItem,\n  createItem,\n",
        "baseline": "// guard is reserved. Content supplies data only: no callback, SQL, cash, or OMR adapter exists.\nimport crypto from 'node:crypto';\nimport { GameError } from './game.js';\nimport {\n  consumeItem,\n  createItem,\n"
      },
      {
        "current": "      results.push({ kind: 'item_consume', item });\n    } else if (effect.adapter === 'item_escrow') {\n      const itemId = await selectOwnedItem(client, owner, effect.templateId);\n      if (instance.graph_id === 'belladonna-demo' && Number(instance.graph_version) === 1\n        && effect.templateId === 'item:precision_lock_tool') {\n        await assertEquipmentUsable(client, { itemId, owner, mutation });\n      }\n      const item = await escrowItem(\n        client, owner, instance.id, itemId,\n        `mystery ${instance.graph_id} escrow`, mutation, 'used_in_mystery',\n",
        "baseline": "      results.push({ kind: 'item_consume', item });\n    } else if (effect.adapter === 'item_escrow') {\n      const itemId = await selectOwnedItem(client, owner, effect.templateId);\n      const item = await escrowItem(\n        client, owner, instance.id, itemId,\n        `mystery ${instance.graph_id} escrow`, mutation, 'used_in_mystery',\n"
      },
      {
        "current": "    client, context, owner, actor, instance, effects: [...(node.effects || []), ...extraEffects], mutation,\n  });\n  const row = await setNodeState(client, instance.id, node.id, 'completed');\n  if (instance.graph_id === 'belladonna-demo' && Number(instance.graph_version) === 1\n    && node.id === 'mystery:belladonna-lock') {\n    for (const effect of effects) if (effect.kind === 'item_escrow'\n      && effect.item.templateId === 'item:precision_lock_tool') {\n      await recordEquipmentUse(client, { instanceId: instance.id, nodeId: node.id,\n        itemId: effect.item.id, mutation });\n    }\n  }\n  await closeExcludedBranches(client, context, instance, node.excludes || []);\n  const result = {\n    ok: true,\n",
        "baseline": "    client, context, owner, actor, instance, effects: [...(node.effects || []), ...extraEffects], mutation,\n  });\n  const row = await setNodeState(client, instance.id, node.id, 'completed');\n  await closeExcludedBranches(client, context, instance, node.excludes || []);\n  const result = {\n    ok: true,\n"
      }
    ]
  },
  "src/crafting.js": {
    "currentSha256": "e5782603de2b4216af40176b4808589811241f6db2bbf849e7a57ea497ddbd56",
    "currentBlob": "8f0ac649ceea16c03a386b20a96f61cdcb0e4189",
    "baselineSha256": "d35ee5bc9fa4d91fec3db3c303f4751f80703433cee24db170b275f84d59f286",
    "baselineBlob": "bf17382353118644e8f7191b76e4cd632788344c",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "import crypto from 'node:crypto';\n// Data-defined Phase 1 crafting and salvage. Domain callers must enter through:\n//\n//   withItemTransaction(pool, (client) =>\n",
        "baseline": "// Data-defined Phase 1 crafting and salvage. Domain callers must enter through:\n//\n//   withItemTransaction(pool, (client) =>\n"
      },
      {
        "current": "  };\n}\n\n/** Read-only immutable canonical recipe witness for manufacturing provenance adapters. */\nexport function canonicalCraftAuthority(recipeId) {\n  const context = contextOf(DEFAULT_CRAFTING_CONTEXT);\n  const recipe = recipeOf(context, recipeId);\n  return Object.freeze({ recipe: Object.freeze(graphIdentity(context, recipe)),\n    authority: Object.freeze(graphMutationAuthority(context, recipe)),\n    consumes: inputsOf(recipe), produces: outputsOf(recipe), cashCost: cashCostOf(recipe) });\n}\n\nexport function canonicalCraftRequestHash(recipeId, accountId) {\n  const witness = canonicalCraftAuthority(recipeId);\n  return crypto.createHash('sha256').update(JSON.stringify({ kind: 'craft',\n    owner: { scope: 'account', id: canonicalString(accountId, 'Authenticated account id') },\n    request: witness.authority })).digest('hex');\n}\n\nconst normalizedKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');\n\nfunction numericDeclaration(recipe, keys) {\n",
        "baseline": "  };\n}\n\nconst normalizedKey = (value) => String(value).toLowerCase().replace(/[^a-z0-9]/g, '');\n\nfunction numericDeclaration(recipe, keys) {\n"
      },
      {
        "current": "  if (inputsOf(recipe).some((entry) => entry.assetType === 'car')) {\n    fail('salvage_required', 'Vehicle recipes must use salvageCar.');\n  }\n  const result = await withItemMutation(\n    client,\n    owner,\n    'craft',\n",
        "baseline": "  if (inputsOf(recipe).some((entry) => entry.assetType === 'car')) {\n    fail('salvage_required', 'Vehicle recipes must use salvageCar.');\n  }\n  return withItemMutation(\n    client,\n    owner,\n    'craft',\n"
      },
      {
        "current": "    graphMutationAuthority(context, recipe),\n    async (mutation) => {\n      const actor = await actorContext(client, accountId);\n      if (recipe.id === 'recipe:tempered_precision_lock_tool') {\n        const account = (await client.query('SELECT id,status FROM accounts WHERE id=$1 FOR UPDATE', [accountId])).rows[0];\n        if (account?.status !== 'active') fail('crafting_unavailable', 'Crafting is unavailable.');\n      }\n      if (h.expectedCharacterId && actor.character.id !== h.expectedCharacterId) fail('crafting_unavailable', 'Crafting is unavailable.');\n      const asOf = Date.now();\n      await resolveRecipeAuthority(client, context, [recipe], accountId, actor, asOf);\n",
        "baseline": "    graphMutationAuthority(context, recipe),\n    async (mutation) => {\n      const actor = await actorContext(client, accountId);\n      if (h.expectedCharacterId && actor.character.id !== h.expectedCharacterId) fail('crafting_unavailable', 'Crafting is unavailable.');\n      const asOf = Date.now();\n      await resolveRecipeAuthority(client, context, [recipe], accountId, actor, asOf);\n"
      },
      {
        "current": "      };\n    },\n  );\n  if (recipe.id === 'recipe:tempered_precision_lock_tool') {\n    const { recordManufacturedQuality } = await import('./itemdurability.js');\n    await recordManufacturedQuality(client, { requestKey: idempotencyKey, itemId: result.outputs[0].id });\n  }\n  return result;\n}\n\n/** Execute one exact-car salvage recipe inside an active `withItemTransaction` callback. */\n",
        "baseline": "      };\n    },\n  );\n}\n\n/** Execute one exact-car salvage recipe inside an active `withItemTransaction` callback. */\n"
      }
    ]
  },
  "src/content/phase1.js": {
    "currentSha256": "53fdb996a2f82d1e02a219e5f23012dc6eeddaa6e76fe5dbe2a5dc9878f1be8f",
    "currentBlob": "6fda3b76b784904980397001378cb5a481c7146c",
    "baselineSha256": "88f23c44f6ed589d0f9c91c6b6be0035653d6c0754fd8183b55148eb2df6b96a",
    "baselineBlob": "aa2ffed2557910616472f5d517c405c89c929545",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "import { BELLADONNA_PACKAGE } from './belladonna.js';\nimport { CORE_MATERIALS_PACKAGE } from './core-materials.js';\nimport { NEIGHBORHOOD_INITIATION_PACKAGE } from './neighborhood-initiation.js';\nimport { COMPANY_PRODUCTION_QUALITY_PACKAGE } from './company-production-quality.js';\nimport { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';\nimport { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\n",
        "baseline": "import { BELLADONNA_PACKAGE } from './belladonna.js';\nimport { CORE_MATERIALS_PACKAGE } from './core-materials.js';\nimport { NEIGHBORHOOD_INITIATION_PACKAGE } from './neighborhood-initiation.js';\nimport { DISTRICT_STORY_ARC_PACKAGES } from './district-story-arcs.js';\nimport { STAGED_CREW_MISSIONS_PACKAGE } from './staged-crew-missions.js';\nimport { CITY_WORLD_OPPORTUNITY_PACKAGES } from './city-world-opportunities.js';\n"
      },
      {
        "current": "  AUTOMOTIVE_SALVAGE_PACKAGE,\n  BELLADONNA_PACKAGE,\n  NEIGHBORHOOD_INITIATION_PACKAGE,\n  COMPANY_PRODUCTION_QUALITY_PACKAGE,\n  ...DISTRICT_STORY_ARC_PACKAGES,\n  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n",
        "baseline": "  AUTOMOTIVE_SALVAGE_PACKAGE,\n  BELLADONNA_PACKAGE,\n  NEIGHBORHOOD_INITIATION_PACKAGE,\n  ...DISTRICT_STORY_ARC_PACKAGES,\n  STAGED_CREW_MISSIONS_PACKAGE,\n  ...CITY_WORLD_OPPORTUNITY_PACKAGES,\n"
      }
    ]
  },
  "src/content/phase1-policy.js": {
    "currentSha256": "f96edecd74219d94c327e0fa3e02dbfd539b89c9477ea7b05947af8f17bf69f1",
    "currentBlob": "c872f66fa1babf2680eac4a5f4bda70bcc5be9c9",
    "baselineSha256": "c5ccf95f3ccdff5d7485cb26e3a4b38c8fe1e0b38120f164fe0fb6aa5c8b5f44",
    "baselineBlob": "cef10bcbd3c21a50c44b2e3d7d6499dbee17112b",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "  `${PHASE1_CRAFT_REASON_PREFIX}hardened_steel`;\nexport const PHASE1_PACKAGE_IDS = Object.freeze([\n  'core-materials', 'automotive-salvage', 'belladonna-demo', 'neighborhood-initiation',\n  'company-production-quality',\n  'district-docks-story', 'district-neon-story', 'district-foundry-story',\n  'district-brick-story', 'district-canal-story', 'district-cathedral-story',\n  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n",
        "baseline": "  `${PHASE1_CRAFT_REASON_PREFIX}hardened_steel`;\nexport const PHASE1_PACKAGE_IDS = Object.freeze([\n  'core-materials', 'automotive-salvage', 'belladonna-demo', 'neighborhood-initiation',\n  'district-docks-story', 'district-neon-story', 'district-foundry-story',\n  'district-brick-story', 'district-canal-story', 'district-cathedral-story',\n  'staged-crew-missions', 'city-neighbor-favors', 'city-shutter-lock', 'city-loading-route',\n"
      }
    ]
  },
  "package.json": {
    "currentSha256": "14f5f63a940a810c82e4fb595714395b8ee1104774a57ac0951599f2477b088a",
    "currentBlob": "cdd2fce9c34e2c4d5685cc6a47a0f9d1074be317",
    "baselineSha256": "320ce74bc2275b75c659169e088fda489de938d661d4bc5a953f16168d0dc1f7",
    "baselineBlob": "e089ac1cd24ef4dc6c4359b03197e15232891f1f",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"pretest\": \"node test/rc1-first-batch-source-compatibility.js && node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js && node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n",
        "baseline": "    \"test:coordination:postgres\": \"node test/coordination.js --postgres && node test/coordination-knowledge-runtime.js --postgres && node test/coordination-knowledge-postgres.js\",\n    \"start\": \"node src/server.js\",\n    \"worker\": \"node src/worker.js\",\n    \"pretest\": \"node test/player-intel-source-compatibility.js && node test/commercialpremises.js && node test/commercialpremises-integration.js && node test/rc1-commercial-premises-source-compatibility.js && node test/companybankportfolios.js && node test/companybankportfolio-integration.js && node test/rc1-company-bank-source-compatibility.js && node test/companylogisticshubs.js && node test/companylogisticshubs-integration.js && node test/rc1-company-logistics-hub-source-compatibility.js && node test/buyercooperatives.js && node test/buyercooperative-integration.js && node test/rc1-buyer-cooperative-source-compatibility.js && node test/companyopportunities.js && node test/companyopportunity-integration.js && node test/rc1-company-opportunity-source-compatibility.js && node test/commercialreputation.js && node test/commercialreputation-integration.js && node test/rc1-commercial-reputation-source-compatibility.js && node test/businessseasons.js && node test/businessseason-integration.js && node test/rc1-business-season-source-compatibility.js && node test/rc1-game-employment-source-compatibility.js && node test/rc1-company-workflow-source-compatibility.js && node test/companyopportunities-api.js && node test/commercialreputation-api.js && node test/businessseasons-api.js && node test/companyworkflows.js && node test/companyworkflow-integration.js && node test/gameemployment.js && node test/gameemployment-integration.js && node test/companyoperatorrunner.js && node test/rc1-company-operator-source-compatibility.js && node test/companyoperators.js && node test/companyoperators-api.js && node test/storefrontfulfillment.js && node test/storefront-fulfillment-api.js && node test/courierjobs.js && node test/supplycontracts.js && node test/supplycontracts-api.js && node test/earningreceipts.js && node test/resource-deliver.js && node test/identity-checkout.js && node test/identity-checkout-client.js && node test/identity-checkout-api.js && node test/current-copy.js && node test/operation-read-paths.js && node test/world-projection-mysteries.js && node test/world-projection-mysteries-api.js && node test/world-projection-read.js && node test/world-projection.js && node test/world-projection-api.js && node test/projection-events.js && node test/projection-events-ws.js && node test/world-projection-client.js && node test/coordination-operation-definitions.js && node test/coordination-mode-boundary.js && node test/coordination-capital.js && node test/coordination-materials.js && node test/coordination-knowledge-proof.js && node test/world-kernel-transaction.js && node test/family-operations.js && node test/family-operations-api.js && node test/world-knowledge-crafting.js && node test/world-kernel-query.js && node test/world-kernel-input.js && node test/world-kernel.js && node test/world-kernel-api.js && node test/coordination-graph.js && node test/coordination.js && node test/coordination-api.js && node test/coordination-http-receipts.js && node test/coordination-knowledge.js && node test/coordination-knowledge-runtime.js && node test/coordination-knowledge-api.js && node test/finalizedobservation.js && node test/stockballotv2.js && node test/rwanominations.js && node test/rwaroutes.js && node test/rwahealth.js && node test/rwahealth.integration.js && node test/rwahealthclearance.js && node test/rwahealthclearancecontext.js && node test/rwahealthoverlay.readiness.js && node test/rwahealthoverlay.schema.js && node test/rwahealthoverlay.vector.js && node test/rwaregistrylifecycle.js && node test/rwaregistrylifecycle.sync.js && node test/agent-referral-cash.js && node test/phase2-discovery.js && node test/phase2-compiler.js && node test/phase2-review-regressions.js && node test/phase2-scale.js && node test/content-graph.js && node test/content-runtime.js && node test/content-social.js && node test/content-seasonal.js && node test/content-seasonal-case.js && node test/content-crafting.js && node test/content-crafting-jobs.js && node test/content-crafting-tools.js && node test/content-exchange.js && node test/content-api.js && node test/v4oraclekeeper.js && node test/genesiscca.js && node test/genesislaunch.js && node test/genesisrelease.js && node test/worldgraph.js && node test/worldgraph-validation.js && node test/items.js && node test/crafting.js && node test/mysteries.js && node test/operations.js && node test/belladonna.js && node test/worldgraph-api.js && node test/city-rpg.js && node tools/pgcheck-belladonna.js --pg-mem && node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js && node test/phase2-lot-boundary.js && node test/keepertransactions.js && node test/liquiditykeeper.js && node test/genesiskeeper.js && node test/liquidityaccounting.js --memory && node test/liquidityaccounting-review.js && node test/liquiditypolicy.js --memory && node test/bond-unlimited.js --memory && node test/bondquoteexpiry.js && node test/liquidityrpc.js && node tools/liquidity-manifest-example.js --self-test && node test/liquiditypolicy-review.js && node test/liquidityqueue.js --memory && node test/liquidityqueue-review.js && node test/character-mint-policy.js && node test/phase2-lots.js && node test/phase2-lots-property.js && node test/audit/mint-dev-allocation.js --memory && node test/audit/deed-reimport-order.js --memory && node test/progression-admission.js && node test/world-prerequisites.js && node test/recipe-policy.js && node test/furnace-ledger.js && node test/core-progression-api.js && node test/player-commands.js && node test/player-command-journey.js && node test/player-command-api.js && node test/player-command-client.js && node test/director-definitions.js && node test/director-config.js && node test/director-runtime.js && node test/director-recovery.js && node test/director-dock-world.js && node test/director-commands.js && node test/director-api.js && node test/director-journey.js && node test/director-security.js && node test/director-simulation.js && node test/director-network.js && node test/campaign-network-journey.js && node test/director-network-recovery.js && node test/player-opportunities.js && node test/world-consequences.js && node test/rc1-city-gameplay-source-compatibility.js\",\n    \"phase2:definitions:check\": \"node test/phase2-definition-schema.js && node test/phase2-definitions.js && node test/phase2-activation.js && node test/phase2-definition-invariants.js\",\n    \"phase2:lots:check\": \"node test/phase2-lot-boundary.js && node test/phase2-lots.js && node test/phase2-lots-property.js\",\n    \"phase2:lots:postgres\": \"node test/phase2-postgres.js --lots\",\n"
      },
      {
        "current": "    \"test:city-gameplay\": \"node test/city-district-arcs.js && node test/staged-crew-missions.js && node test/staged-crew-missions-api.js && node test/city-home-interiors-api.js && node test/city-encounters.js && node test/city-world-opportunities.js\",\n    \"test:city-gameplay:postgres\": \"node tools/city-gameplay-native.js\",\n    \"test:player-intel:postgres\": \"node tools/player-intel-native.js\",\n    \"test:city-gameplay:browser\": \"node test/city-district-arcs-browser.js && node test/city-gameplay-panels-browser.js\",\n    \"test:company-economy\": \"node test/companyproduction.js && node test/companyspecialization.js && node test/itemdurability.js && node test/itemdurability-quality.js && node test/companydemand.js && node test/companyforecast.js && node test/companyproduction-integration.js && node test/company-economy-contracts.js\",\n    \"test:company-economy:postgres\": \"node test/companyproduction.js --postgres && node test/companyspecialization.js --postgres && node test/itemdurability.js --postgres && node test/itemdurability-quality.js --postgres && node test/companydemand.js --postgres && node test/companyforecast.js --postgres && node test/companyproduction-integration.js --postgres\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n",
        "baseline": "    \"test:city-gameplay\": \"node test/city-district-arcs.js && node test/staged-crew-missions.js && node test/staged-crew-missions-api.js && node test/city-home-interiors-api.js && node test/city-encounters.js && node test/city-world-opportunities.js\",\n    \"test:city-gameplay:postgres\": \"node tools/city-gameplay-native.js\",\n    \"test:player-intel:postgres\": \"node tools/player-intel-native.js\",\n    \"test:city-gameplay:browser\": \"node test/city-district-arcs-browser.js && node test/city-gameplay-panels-browser.js\"\n  },\n  \"dependencies\": {\n    \"@fastify/jwt\": \"^10.2.0\",\n"
      }
    ]
  },
  "src/market.js": {
    "currentSha256": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e",
    "currentBlob": "34d9bb0dac36f554b26e97218d019372d529d1a8",
    "baselineSha256": "542653aab9034940a6624389f502c841908ebade121fe08b6975d6987349df7e",
    "baselineBlob": "34d9bb0dac36f554b26e97218d019372d529d1a8",
    "predecessorAbsent": false,
    "inverses": []
  },
  "src/worker.js": {
    "currentSha256": "61ba29e1cd6fdf6391515a2be7e6031c85e5d76707012eb9d3248aca53e3ff3a",
    "currentBlob": "7cb2ad75443d6fccc0ff93d5a594fa0b2e317775",
    "baselineSha256": "61ba29e1cd6fdf6391515a2be7e6031c85e5d76707012eb9d3248aca53e3ff3a",
    "baselineBlob": "7cb2ad75443d6fccc0ff93d5a594fa0b2e317775",
    "predecessorAbsent": false,
    "inverses": []
  },
  "src/social/estate.js": {
    "currentSha256": "52fb24d52199b946a4cb0dc8c81fa7b21da88c8a1b094c0591c9bf86871a1e8e",
    "currentBlob": "0559adc99ba7b86e46aa339d5cb6070e6555c90e",
    "baselineSha256": "52fb24d52199b946a4cb0dc8c81fa7b21da88c8a1b094c0591c9bf86871a1e8e",
    "baselineBlob": "0559adc99ba7b86e46aa339d5cb6070e6555c90e",
    "predecessorAbsent": false,
    "inverses": []
  },
  "src/content/company-production-quality.js": {
    "currentSha256": "5c7f3fb98a49fec52307948bc8a4bf1070307910a68c098e8145ad470189ebe0",
    "currentBlob": "142d38b7ce77509850b4afec7a0f570315fdc711",
    "baselineSha256": null,
    "baselineBlob": null,
    "predecessorAbsent": true,
    "inverses": []
  },
  "src/agentgateway.js": {
    "currentSha256": "3925cb490dc056d05a2375a1b71a765c8ab8c9d8eeeecad82ca182d0f5ea7659",
    "currentBlob": "6090eef7383404077421a124db02320083b7d439",
    "baselineSha256": "cb7c1113a6cd999f2eee8fde77ded3a8ef5118f744352094005da0bb67dd61c5",
    "baselineBlob": "c9848b1c8b7cf352e402e3af77d8bdc311ff613d",
    "predecessorAbsent": false,
    "inverses": [
      {
        "current": "import { CITY_WORLD_OPPORTUNITY_REQUEST_SCHEMAS, CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA,\n  CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA, CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA } from './city-world-opportunities-contract.js';\nimport { RESOURCE_CONTRACTS } from './resourcecontracts.js';\nimport { COMPANY_ECONOMY_CONTRACTS, COMPANY_ECONOMY_SCHEMAS } from './company-economy-contracts.js';\nimport { DISTRICTS, GOODS } from './rules.js';\n\n// Routes reachable WITHOUT a player token (the discovery + auth surface). Everything else under\n",
        "baseline": "import { CITY_WORLD_OPPORTUNITY_REQUEST_SCHEMAS, CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA,\n  CITY_WORLD_OPPORTUNITY_DETAIL_SCHEMA, CITY_WORLD_OPPORTUNITY_RESULT_SCHEMA } from './city-world-opportunities-contract.js';\nimport { RESOURCE_CONTRACTS } from './resourcecontracts.js';\nimport { DISTRICTS, GOODS } from './rules.js';\n\n// Routes reachable WITHOUT a player token (the discovery + auth surface). Everything else under\n"
      },
      {
        "current": "// COMPLETE path discovery; these overlays replace its generic object body where the server itself\n// emits an action that an agent is expected to send back verbatim.\nconst OPERATION_CONTRACTS = {\n  ...COMPANY_ECONOMY_CONTRACTS,\n  ...CITY_SOCIAL_CONTRACTS,\n  ...CITY_ENCOUNTER_CONTRACTS,\n  'GET /v1/city/opportunities': { operationId:'readCityWorldOpportunities', responseSchema:{ $ref:'#/components/schemas/CityWorldOpportunityIndex' } },\n",
        "baseline": "// COMPLETE path discovery; these overlays replace its generic object body where the server itself\n// emits an action that an agent is expected to send back verbatim.\nconst OPERATION_CONTRACTS = {\n  ...CITY_SOCIAL_CONTRACTS,\n  ...CITY_ENCOUNTER_CONTRACTS,\n  'GET /v1/city/opportunities': { operationId:'readCityWorldOpportunities', responseSchema:{ $ref:'#/components/schemas/CityWorldOpportunityIndex' } },\n"
      },
      {
        "current": "};\n\nconst AGENT_SCHEMAS = {\n  ...COMPANY_ECONOMY_SCHEMAS,\n  ...CITY_SOCIAL_SCHEMAS,\n  ...CITY_ENCOUNTER_SCHEMAS,\n  CityWorldOpportunityIndex:CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA,\n",
        "baseline": "};\n\nconst AGENT_SCHEMAS = {\n  ...CITY_SOCIAL_SCHEMAS,\n  ...CITY_ENCOUNTER_SCHEMAS,\n  CityWorldOpportunityIndex:CITY_WORLD_OPPORTUNITY_INDEX_SCHEMA,\n"
      }
    ]
  },
  "src/company-economy-contracts.js": {
    "currentSha256": "1f9ace395d1ff8856e7d762ba3767c8c9a2752e85a5baeea9a524d608e11f5da",
    "currentBlob": "29048fdf54817da59fad76ca493e92591680b79a",
    "baselineSha256": null,
    "baselineBlob": null,
    "predecessorAbsent": true,
    "inverses": []
  }
});
export function assertFirstBatchSourceTransfer(file,input){
 assert(Object.hasOwn(FIRST_BATCH_SOURCE_DOMAINS,file),'Unknown first-batch source domain');const d=FIRST_BATCH_SOURCE_DOMAINS[file],text=lf(input);
 assert.equal(hash(text),d.currentSha256,'First-batch complete current source drift: '+file);assert.equal(blob(text),d.currentBlob,'First-batch complete current blob drift: '+file);
 let baselineText=text;for(const h of d.inverses){assert(h.current.length,'Empty inverse context');assert.equal(baselineText.split(h.current).length-1,1,'Missing/duplicate/reordered first-batch inverse context: '+file);baselineText=baselineText.replace(h.current,()=>h.baseline);}
 if(d.predecessorAbsent)baselineText=null;else{assert.equal(hash(baselineText),d.baselineSha256,'First-batch complete predecessor source mismatch: '+file);assert.equal(blob(baselineText),d.baselineBlob,'First-batch complete predecessor blob mismatch: '+file);}
 return{file,baselineText,predecessorAbsent:d.predecessorAbsent,sourceRevision:FIRST_BATCH_SOURCE_REVISION,predecessorRevision:FIRST_BATCH_SOURCE_PREDECESSOR,inverseChunks:d.inverses.length,phase:FIRST_BATCH_SOURCE_PHASE};
}
// Unknown bytes survive unchanged for their original rejecting guard. No pattern grants authority.
export function firstBatchSourceBaseline(file,input){const text=lf(input),d=FIRST_BATCH_SOURCE_DOMAINS[file];return d&&!d.predecessorAbsent&&hash(text)===d.currentSha256?assertFirstBatchSourceTransfer(file,text).baselineText:text;}
