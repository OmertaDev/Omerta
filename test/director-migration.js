// Upgrade exact main, populated through existing world/knowledge/item/operation
// services. Reapplying migration must preserve both that history and Director state.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import pg from 'pg';
import { dbCaps, migrateSchemaUnderLock } from '../src/db.js';
import { withCharacter, travel } from '../src/game.js';
import { boostCar } from '../src/economy.js';
import { createCrew } from '../src/crew.js';
import { createGang } from '../src/social.js';
import { createWorldKernel } from '../src/world-kernel.js';
import { createFamilyOperations } from '../src/coordination/operations.js';
import { createDockWarContent, DOCK_WAR_IDS as ids } from '../src/content/dock-war.js';
import { createLivingWorldDirector } from '../src/director/runtime.js';
import { createDockWarDefinitions } from '../src/director/dock-war.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { addPlayer, issueAndExecute } from './lib/player-command-support.js';
import { createCityGameplayMigrationCatalog, readCityGameplayMigrationMetadata,
  cityGameplayMigrationEndpoint, CITY_GAMEPLAY_MIGRATION_TABLES, CITY_GAMEPLAY_MIGRATION_REPLACED_KEYS } from './lib/city-gameplay-migration-catalog.js';

const BASELINE = '44f48a743e549591bd125a1f678099b8382dd78f';
const address = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
assert(address, 'An explicit isolated PostgreSQL database URL is required');
const endpoint = cityGameplayMigrationEndpoint(address);
const namespace = `director_migration_${crypto.randomBytes(8).toString('hex')}`;
const admin = new pg.Pool({ connectionString: endpoint.toString() });
let pool, created = false;
const inventory = JSON.parse(fs.readFileSync(new URL('./lib/phase2-architecture-upgrade-catalog.json', import.meta.url), 'utf8'));
const directorTables = Object.keys(inventory.notNullColumns).filter((name) => name.startsWith('director_')).sort();
const economyTables = ['business_depots', 'business_depot_journal', 'business_operating_policies', 'business_external_costs', 'delivery_commitments', 'business_supply_contracts'];
// Optional stacked features are recognized only by explicit identity and frozen
// inventory. Nothing discovered from the backend becomes an expected constraint.
const featureManifest = Object.freeze({ supply_tenders: [8, 9], supply_tender_offers: [9, 10],
  business_warehouse_leases: [14, 13], logistics_coverage_policies: [17, 18], crew_logistics_links: [8, 9], depot_brand_licenses: [14, 16],
  intel_forecast_jobs: [16, 11], delivery_loan_requests: [10, 11], strategy_versions: [13, 14], strategy_licenses: [10, 8], company_succession_receipts: [13, 12], strategy_leagues: [13, 9], strategy_league_entries: [9, 8],
  company_operators: [6, 8], company_operator_receipts: [5, 7],
  game_employment_jobs: [13, 13], game_employment_assignments: [9, 8], game_employment_requests: [3, 5],
  company_workflows: [13, 13], company_workflow_receipts: [3, 5], company_workflow_proofs: [5, 6],
  commercial_premises_offers: [13, 13], commercial_premises_leases: [16, 15], commercial_premises_requests: [3, 5],
  company_bank_portfolios: [5, 9], company_bank_portfolio_receipts: [3, 5],
  company_bank_portfolio_loans: [5, 6],
  company_logistics_hubs: [12, 13], company_logistics_hub_sources: [10, 6],
  company_logistics_hub_requests: [3, 5],
  buyer_cooperatives: [13, 17], buyer_cooperative_members: [18, 15],
  buyer_cooperative_orders: [3, 2], buyer_cooperative_receipts: [3, 5], buyer_cooperative_journal: [5, 7],
  company_opportunity_subscriptions: [3, 5], company_opportunity_notices: [5, 7],
  commercial_reputation_publications: [3, 3], commercial_reputation_proofs: [5, 6],
  commercial_reputation_settlements: [4, 3],
  business_seasons: [6, 9], business_season_entries: [8, 9] });
const featureTables = Object.keys(featureManifest).filter(table => Object.hasOwn(inventory.notNullColumns, table));
const featureConstraints = inventory.added.filter(row => featureTables.includes(row.table_name))
  .sort((a, b) => `${a.table_name}.${a.name}`.localeCompare(`${b.table_name}.${b.name}`));
for (const table of featureTables) {
  assert.equal(featureConstraints.filter(row => row.table_name === table).length, featureManifest[table][0], `${table} has its reviewed frozen constraint count`);
  assert.equal(inventory.notNullColumns[table].length, featureManifest[table][1], `${table} has its reviewed required-column count`);
}
const economyExtensionNames = Object.freeze([
  'business_depots.business_depots_warehouse_cash_per_unit_day_check',
  'business_depots.business_depots_warehouse_revision_check',
  'business_depots.business_depots_warehouse_slots_check',
  'business_depot_journal.business_depot_journal_lease_id_fkey',
  'business_depot_journal.business_depot_journal_lease_sequence_check',
  'business_depot_journal.business_depot_journal_lease_stock_after_check',
  'business_depot_journal.business_depot_journal_lease_stock_delta_check',
  'business_depot_journal.business_depot_journal_warehouse_rent_lease_id_fkey',
  'business_depot_journal.business_depot_journal_warehouse_rent_lease_id_key',
  'business_depot_journal.business_depot_journal_franchise_license_id_fkey',
  'business_depot_journal.business_depot_journal_source_journal_id_fkey',
]);
const resourceTables = ['resource_treasuries', 'resource_ledger', 'resource_compute_policies', 'resource_rounds', 'resource_bids', 'resource_credits', 'resource_calls', 'resource_payments', 'resource_payment_intents', 'resource_services', 'resource_jobs', 'resource_bounties', 'resource_labor_bids'];
const goodsMarketTables = ['goods_market_liquidity'];
const companyTables = ['agent_company_profiles'];
const playerIntelConstraints = Object.freeze([
  { table_name: 'player_intel', name: 'player_intel_pkey', definition: 'PRIMARY KEY (owner_account, target_character)' },
]);
const playerIntelColumns = Object.freeze(['facts', 'learned_at', 'observed_at', 'owner_account', 'source', 'target_character']);
const companyConstraints = inventory.added.filter(row => companyTables.includes(row.table_name))
  .sort((a, b) => `${a.table_name}.${a.name}`.localeCompare(`${b.table_name}.${b.name}`));
assert.equal(companyConstraints.length, 6, 'All company PK/FK/CHECK constraints must be frozen');
const verifyCompanyConstraints = rows => assert.deepEqual(rows.filter(row => companyTables.includes(row.table_name)), companyConstraints,
  'Company migration installs exactly its frozen ownership and premises constraints');
assert.equal(directorTables.length, 7);
try {
  await admin.query(`CREATE SCHEMA ${namespace}`); created = true;
  pool = new pg.Pool({ connectionString: endpoint.toString(),
    options: `-c search_path=${namespace} -c lock_timeout=8000 -c statement_timeout=30000` });
  assert.equal((await pool.query('SELECT current_schema() AS namespace')).rows[0].namespace, namespace);
  const serverVersion = Number((await pool.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
  dbCaps.skipLocked = true;
  await pool.query(execFileSync('git', ['show', `${BASELINE}:schema.sql`], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }));
  assert.equal((await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema=current_schema() AND table_name LIKE 'director_%'")).rows.length, 0);
  const account = 'director-migration-owner';
  await addPlayer(pool, account); await addPlayer(pool, 'director-migration-neighbor');
  const social = (work) => withCharacter(pool, account, work);
  await social((ch, client, h) => createCrew(ch, 'Migration Dock Crew', client, h));
  await social((ch, client, h) => createGang(ch, 'Migration Dock Family', 'DMIG', client, h));
  const content = createDockWarContent();
  const engine = (director = null) => createPlayerCommandEngine({ pool, content, director,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  let commands = engine();
  const act = (type, parameters = {}) => issueAndExecute(commands, account, type, parameters);
  await act('discovery.start', { graphId: ids.coordination });
  for (let count = 0; count < 24; count++) {
    const run = (await commands.snapshot(account)).discovery.instances[0];
    const action = run.actions.find((entry) => entry.kind === 'complete') || run.actions.find((entry) => entry.kind === 'discover');
    if (!action) break;
    await act('discovery.act', { instanceId: run.id, actionId: action.id });
    assert(count < 23, 'Discovery must finish inside its authored bound');
  }
  await social((ch, client, h) => travel(ch, 'foundry', client, h));
  const random = Math.random; let acquired;
  try { Math.random = () => 0.01; acquired = await social((ch, client, h) => boostCar(ch, client, h)); }
  finally { Math.random = random; }
  assert.equal(acquired.car.model, 'junker');
  await act('item.salvage', { carId: acquired.car.id });
  await act('recipe.craft', { recipeId: ids.recipe });
  await social((ch, client, h) => travel(ch, 'docks', client, h));
  await act('world.execute', { objectId: ids.object, actionId: 'establish_route' });
  const kernel = createWorldKernel({ pool, registry: content.registry, objects: content.objects,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true });
  const family = createFamilyOperations({ pool, registry: content.registry, kernel, definitions: content.operations,
    enabled: true, knowledgeEnabled: true, sharingEnabled: true, prerequisitesEnabled: true });
  const createKey = crypto.randomUUID();
  const operation = await family.create(account, { definitionId: ids.protectOperation }, createKey);
  for (const [action, input] of [['publish', {}], ['join', { roleId: 'organizer' }], ['commit', { requirementId: 'presence' }]])
    await family.command(account, operation.operationId, action, input, crypto.randomUUID());
  const canonicalTables = ['world_kernel_objects', 'world_kernel_events', 'item_instances', 'item_stacks', 'item_events',
    'item_mutation_guards', 'coordination_instances', 'coordination_claims', 'coordination_commands', 'world_operations',
    'world_operation_roles', 'world_operation_commitments', 'world_operation_events', 'player_command_boards'];
  const capture = async (tables) => Object.fromEntries(await Promise.all(tables.map(async (table) => [table,
    (await pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)))])));
  const constraints = async () => (await pool.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,
    pg_get_constraintdef(c.oid,true) AS definition FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() AND c.contype<>'n'
    ORDER BY t.relname,c.conname`)).rows;
  const oldRows = await capture(canonicalTables), oldConstraints = await constraints();
  assert.equal(oldConstraints.filter((row) => goodsMarketTables.includes(row.table_name)).length, 0,
    'The pinned baseline predates the goods-market liquidity table');
  assert.equal(oldConstraints.filter(row => companyTables.includes(row.table_name)).length, 0,
    'The pinned baseline predates the company registry');
  assert.equal(oldConstraints.filter((row) => row.table_name === 'city_intel_progress').length, 0,
    'The pinned baseline predates the private City intel table');
  assert.equal(oldConstraints.filter((row) => row.table_name === 'city_social_preferences').length, 0,
    'The pinned baseline predates opt-in City social preferences');
  assert.equal(oldConstraints.filter((row) => row.table_name === 'player_intel').length, 0,
    'The pinned baseline predates account-owned player observations');
  for (const table of canonicalTables) assert(oldRows[table].length > 0, `${table} must be populated before migration`);
  const gameplayCatalog = await createCityGameplayMigrationCatalog(admin, address);
  const migrate = async () => {
    const client = await pool.connect();
    try {
      await client.query('SELECT pg_advisory_lock(774139)');
      assert.equal((await migrateSchemaUnderLock(client)).migration.failed, 0);
    } finally { await client.query('SELECT pg_advisory_unlock(774139)'); client.release(); }
  };
  await migrate();
  assert.deepEqual(await capture(canonicalTables), oldRows, 'Migration preserves all existing canonical rows and receipts');
  const upgradedConstraints = await constraints();
  const verifyPreservedConstraints = (rows) => assert.deepEqual(rows.filter((row) => !row.table_name.startsWith('director_') && row.table_name !== 'player_reset_migrations' && row.table_name !== 'deed_upgrades' && row.table_name !== 'city_intel_progress' && row.table_name !== 'city_social_preferences' && row.table_name !== 'player_intel' && !economyTables.includes(row.table_name) && !featureTables.includes(row.table_name) && !resourceTables.includes(row.table_name) && !goodsMarketTables.includes(row.table_name) && !companyTables.includes(row.table_name)), oldConstraints,
    'Director migration may not remove or alter any reviewed existing constraint');
  // The original complete oracle is unchanged. Only independently verified, pinned
  // gameplay additions/replacements are removed/restored before entering it.
  const verifyCompletePreservedConstraints = rows => verifyPreservedConstraints(gameplayCatalog.normalize(rows, oldConstraints));
  verifyCompletePreservedConstraints(upgradedConstraints);
  const gameplayMetadata = await readCityGameplayMigrationMetadata(pool);
  gameplayCatalog.verifyMetadata(gameplayMetadata);
  const cityConstraints = inventory.added.filter((row) => row.table_name === 'city_intel_progress');
  assert.equal(cityConstraints.length, 4, 'All four native-reviewed City PK/FK/CHECK constraints must be catalogued');
  const verifyCityConstraints = (rows) => assert.deepEqual(rows.filter((row) => row.table_name === 'city_intel_progress'), cityConstraints,
    'City migration installs exactly its reviewed constraints, without waiving existing preservation');
  verifyCityConstraints(upgradedConstraints);
  const cityColumns = inventory.notNullColumns.city_intel_progress;
  assert.equal(cityColumns.length, 5, 'All five reviewed City columns must remain non-null');
  const verifyCityNotNull = (columns) => assert.deepEqual(columns, cityColumns, 'City migration preserves exact reviewed nullability');
  const cityNotNull = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='city_intel_progress' AND is_nullable='NO' ORDER BY column_name")).rows.map((row) => row.column_name);
  verifyCityNotNull(cityNotNull);
  const socialConstraints = inventory.added.filter(row => row.table_name === 'city_social_preferences');
  assert.equal(socialConstraints.length, 4, 'Four independently reviewed social owner/identity/generation/outfit constraints are required');
  const verifySocialConstraints = rows => assert.deepEqual(rows.filter(row => row.table_name === 'city_social_preferences'), socialConstraints,
    'Social migration installs exactly its reviewed constraints and never alters predecessor rows');
  verifySocialConstraints(upgradedConstraints);
  const socialColumns = inventory.notNullColumns.city_social_preferences;
  assert.deepEqual(socialColumns, ['character_id', 'chat_enabled', 'generation', 'outfit', 'room_layout']);
  const verifySocialNotNull = columns => assert.deepEqual(columns, socialColumns, 'All five social ownership/consent/presentation columns remain non-null');
  const socialNotNull = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='city_social_preferences' AND is_nullable='NO' ORDER BY column_name")).rows.map(row => row.column_name);
  verifySocialNotNull(socialNotNull);
  const verifyPlayerIntelConstraints = rows => assert.deepEqual(rows.filter(row => row.table_name === 'player_intel'), playerIntelConstraints,
    'Player intel migration installs exactly its account-and-character observation identity');
  verifyPlayerIntelConstraints(upgradedConstraints);
  const verifyPlayerIntelNotNull = columns => assert.deepEqual(columns, playerIntelColumns,
    'Player intel migration preserves exactly its required observation columns');
  const playerIntelNotNull = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='player_intel' AND is_nullable='NO' ORDER BY column_name")).rows.map(row => row.column_name);
  verifyPlayerIntelNotNull(playerIntelNotNull);
  const mutateConstraint = (table, name, change) => {
    const rows = upgradedConstraints.map((row) => ({ ...row })), index = rows.findIndex((row) => row.table_name === table && row.name === name);
    assert(index >= 0, `Causal constraint target ${table}.${name} exists`); change(rows, index); return rows;
  };
  const rejected = (verify, label, candidate) => assert.throws(() => verify(candidate), (error) => error?.code === 'ERR_ASSERTION', label);
  rejected(verifyCompletePreservedConstraints, 'legacy character identity removed', mutateConstraint('characters', 'characters_pkey',
    (rows, index) => rows.splice(index, 1)));
  rejected(verifyCompletePreservedConstraints, 'legacy character identity altered', mutateConstraint('characters', 'characters_pkey',
    (rows, index) => { rows[index].definition = 'PRIMARY KEY (account_id)'; }));
  rejected(verifyCompletePreservedConstraints, 'unreviewed City table added', [...upgradedConstraints,
    { table_name: 'city_unreviewed', name: 'city_unreviewed_pkey', definition: 'PRIMARY KEY (id)' }]);
  rejected(verifyCityConstraints, 'City character ownership removed', mutateConstraint('city_intel_progress', 'city_intel_progress_character_id_fkey',
    (rows, index) => rows.splice(index, 1)));
  rejected(verifyCityConstraints, 'City generation identity weakened', mutateConstraint('city_intel_progress', 'city_intel_progress_pkey',
    (rows, index) => { rows[index].definition = 'PRIMARY KEY (character_id)'; }));
  rejected(verifyCityConstraints, 'City safe sequence bound weakened', mutateConstraint('city_intel_progress', 'city_intel_progress_sequence_check',
    (rows, index) => { rows[index].definition = rows[index].definition.replace('9007199254740991', '9007199254740992'); }));
  for (const column of cityColumns) rejected(verifyCityNotNull, 'City '+column+' nullability removed', cityColumns.filter((name) => name !== column));
  rejected(verifySocialConstraints, 'Social owner foreign key removed', mutateConstraint('city_social_preferences', 'city_social_preferences_character_id_fkey',
    (rows, index) => rows.splice(index, 1)));
  rejected(verifySocialConstraints, 'Social owner generation identity weakened', mutateConstraint('city_social_preferences', 'city_social_preferences_pkey',
    (rows, index) => { rows[index].definition = 'PRIMARY KEY (character_id)'; }));
  rejected(verifySocialConstraints, 'Social generation minimum removed', mutateConstraint('city_social_preferences', 'city_social_preferences_generation_check',
    (rows, index) => rows.splice(index, 1)));
  rejected(verifySocialConstraints, 'Social free outfit catalog widened', mutateConstraint('city_social_preferences', 'city_social_preferences_outfit_check',
    (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  for (const column of socialColumns) rejected(verifySocialNotNull, 'Social '+column+' nullability removed', socialColumns.filter(name => name !== column));
  rejected(verifyPlayerIntelConstraints, 'Player intel identity removed', mutateConstraint('player_intel', 'player_intel_pkey',
    (rows, index) => rows.splice(index, 1)));
  rejected(verifyPlayerIntelConstraints, 'Player intel identity weakened', mutateConstraint('player_intel', 'player_intel_pkey',
    (rows, index) => { rows[index].definition = 'PRIMARY KEY (target_character)'; }));
  rejected(verifyPlayerIntelConstraints, 'Player intel unreviewed constraint added', [...upgradedConstraints,
    { table_name: 'player_intel', name: 'unexpected_player_intel_constraint', definition: 'CHECK (true)' }]);
  for (const column of playerIntelColumns) rejected(verifyPlayerIntelNotNull, 'Player intel '+column+' nullability removed', playerIntelColumns.filter(name => name !== column));
  rejected(verifyPlayerIntelNotNull, 'Player intel source label remains optional', [...playerIntelColumns, 'source_name'].sort());
  assert.deepEqual(upgradedConstraints.filter((row) => goodsMarketTables.includes(row.table_name)), [
    { table_name: 'goods_market_liquidity', name: 'goods_market_liquidity_bought_check', definition: 'CHECK (bought >= 0)' },
    { table_name: 'goods_market_liquidity', name: 'goods_market_liquidity_pkey', definition: 'PRIMARY KEY (good_id, district)' },
    { table_name: 'goods_market_liquidity', name: 'goods_market_liquidity_price_block_check', definition: 'CHECK (price_block >= 0)' },
    { table_name: 'goods_market_liquidity', name: 'goods_market_liquidity_sold_check', definition: 'CHECK (sold >= 0)' },
  ], 'Goods-market migration installs exactly its four reviewed constraints, without waiving existing preservation');
  const economyConstraints = inventory.added.filter((row) => economyTables.includes(row.table_name))
    .sort((a, b) => `${a.table_name}.${a.name}`.localeCompare(`${b.table_name}.${b.name}`));
  const economyExtensions = economyConstraints.filter(row => {
    if (!economyExtensionNames.includes(`${row.table_name}.${row.name}`)) return false;
    const franchise = row.name === 'business_depot_journal_franchise_license_id_fkey'
      || row.name === 'business_depot_journal_source_journal_id_fkey';
    return featureTables.includes(franchise ? 'depot_brand_licenses' : 'business_warehouse_leases');
  });
  assert.equal(economyConstraints.length - economyExtensions.length, 31, 'All original reviewed economy constraints remain frozen alongside only named reviewed extensions');
  assert.equal(economyConstraints.filter(row => row.table_name === 'business_supply_contracts').length, 8,
    'All eight reviewed supply cadence constraints must be catalogued');
  assert.deepEqual(inventory.notNullColumns.business_supply_contracts,
    ['created_at', 'depot_id', 'dispatched', 'enabled', 'expires_at', 'id', 'interval_seconds', 'max_cycles', 'next_dispatch_at', 'revision'],
    'All ten reviewed supply cadence columns must remain non-null');
  const resourceConstraints = inventory.added.filter(row => resourceTables.includes(row.table_name))
    .sort((a, b) => `${a.table_name}.${a.name}`.localeCompare(`${b.table_name}.${b.name}`));
  assert.equal(resourceConstraints.length, 89, 'All resource constraints must be frozen');
  assert.deepEqual(upgradedConstraints.filter(row => resourceTables.includes(row.table_name)), resourceConstraints);
  verifyCompanyConstraints(upgradedConstraints);
  assert.throws(() => verifyCompanyConstraints(upgradedConstraints.filter(row => row.name !== 'agent_company_profiles_account_id_fkey')),
    error => error.code === 'ERR_ASSERTION', 'Company ownership foreign key removal must fail the exact group verifier');
  assert.throws(() => verifyCompanyConstraints(upgradedConstraints.map(row => row.table_name === 'agent_company_profiles' && row.name === 'agent_company_profiles_check'
    ? { ...row, definition: 'CHECK (true)' } : row)), error => error.code === 'ERR_ASSERTION',
  'Company premises binding weakening must fail the exact group verifier');
  const companyNotNull = (await pool.query("SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name=$1 AND is_nullable='NO' ORDER BY column_name", companyTables)).rows;
  assert.deepEqual(companyNotNull.map(row => row.column_name), inventory.notNullColumns.agent_company_profiles,
    'Company required columns match the frozen inventory on every PostgreSQL version');
  const resourceNotNull = (await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) AND is_nullable='NO' ORDER BY table_name,column_name", resourceTables)).rows;
  assert.deepEqual(Object.fromEntries(resourceTables.map(table => [table, resourceNotNull.filter(row => row.table_name === table).map(row => row.column_name)])),
    Object.fromEntries(resourceTables.map(table => [table, inventory.notNullColumns[table]])));
  const verifyEconomyConstraints = rows => assert.deepEqual(rows.filter((row) => economyTables.includes(row.table_name)), economyConstraints,
    'Economy migration installs exactly its frozen constraints, without waiving existing preservation');
  verifyEconomyConstraints(upgradedConstraints);
  assert.throws(() => verifyEconomyConstraints(upgradedConstraints.filter(row => row.name !== 'business_supply_contracts_check')),
    error => error.code === 'ERR_ASSERTION', 'Supply cadence cycle-bound removal must fail the exact economy verifier');
  assert.throws(() => verifyEconomyConstraints(upgradedConstraints.map(row => row.name === 'business_supply_contracts_policy_id_fkey'
    ? { ...row, definition: 'FOREIGN KEY (policy_id) REFERENCES unrelated(id)' } : row)), error => error.code === 'ERR_ASSERTION',
  'Supply cadence policy foreign-key alteration must fail the exact economy verifier');
  assert.throws(() => verifyEconomyConstraints([...upgradedConstraints,
    { table_name: 'business_supply_contracts', name: 'unexpected_supply_constraint', definition: 'CHECK (true)' }]),
  error => error.code === 'ERR_ASSERTION', 'Unexpected supply constraints must fail the exact economy verifier');
  const economyNotNull = (await pool.query("SELECT table_name,column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name IN ($1,$2,$3,$4,$5,$6) AND is_nullable='NO' ORDER BY table_name,column_name", economyTables)).rows;
  assert.deepEqual(Object.fromEntries(economyTables.map((table) => [table, economyNotNull.filter((row) => row.table_name === table).map((row) => row.column_name)])),
    Object.fromEntries(economyTables.map((table) => [table, inventory.notNullColumns[table]])),
    'Economy required columns match the frozen schema on every PostgreSQL version');
  const verifyFeatureConstraints = rows => assert.deepEqual(rows.filter(row => featureTables.includes(row.table_name)), featureConstraints,
    'Named additive features install exactly their frozen definitions; unknown additions are never waived');
  verifyFeatureConstraints(upgradedConstraints);
  const featureNotNull = featureTables.length ? (await pool.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name IN (${featureTables.map((_, index) => `$${index + 1}`).join(',')})
    AND is_nullable='NO' ORDER BY table_name,column_name`, featureTables)).rows : [];
  const verifyFeatureNotNull = columns => assert.deepEqual(
    Object.fromEntries(featureTables.map(table => [table, columns.filter(row => row.table_name === table).map(row => row.column_name)])),
    Object.fromEntries(featureTables.map(table => [table, inventory.notNullColumns[table]])),
    'Named feature required columns match exact frozen nullability');
  verifyFeatureNotNull(featureNotNull);
  for (const table of featureTables) {
    const constraint = featureConstraints.find(row => row.table_name === table);
    rejected(verifyFeatureConstraints, `${table} missing frozen constraint`, mutateConstraint(table, constraint.name, (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${table} altered frozen constraint`, mutateConstraint(table, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
    rejected(verifyFeatureConstraints, `${table} unknown constraint`, [...upgradedConstraints,
      { table_name: table, name: 'unexpected_feature_constraint', definition: 'CHECK (true)' }]);
    for (const column of inventory.notNullColumns[table]) rejected(verifyFeatureNotNull, `${table}.${column} nullability removed`,
      featureNotNull.filter(row => row.table_name !== table || row.column_name !== column));
    rejected(verifyFeatureNotNull, `${table} unexpected required column`, [...featureNotNull,
      { table_name: table, column_name: 'unexpected_required_column' }]);
  }
  rejected(verifyCompletePreservedConstraints, 'unknown feature table is not classified', [...upgradedConstraints,
    { table_name: 'supply_unreviewed_feature', name: 'unreviewed_pkey', definition: 'PRIMARY KEY (id)' }]);
  // Frozen operator catalog was reviewed once against source/native PG18.4.
  // Every operator FK/PK/CHECK is causal; live rows never define expectations.
  for (const constraint of featureConstraints.filter(row => ['company_operators', 'company_operator_receipts'].includes(row.table_name))) {
    rejected(verifyFeatureConstraints, `${constraint.name} operator constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} operator constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  // Each bank identity, authority and cap constraint is independently causal.
  for (const constraint of featureConstraints.filter(row => row.table_name.startsWith('company_bank_'))) {
    rejected(verifyFeatureConstraints, `${constraint.name} bank constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} bank constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  for (const constraint of featureConstraints.filter(row => row.table_name.startsWith('company_logistics_hub'))) {
    rejected(verifyFeatureConstraints, `${constraint.name} hub constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} hub constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  for (const column of ['withdrawal_journal_id', 'settlement', 'completed_at'])
    rejected(verifyFeatureNotNull, `hub pending ${column} remains optional`, [...featureNotNull,
      { table_name: 'company_logistics_hub_sources', column_name: column }]);
  for (const constraint of featureConstraints.filter(row => row.table_name.startsWith('buyer_cooperative'))) {
    rejected(verifyFeatureConstraints, `${constraint.name} cooperative constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} cooperative constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  for (const [table, column] of [['buyer_cooperatives', 'order_id'], ['buyer_cooperative_journal', 'order_id'],
    ['buyer_cooperative_journal', 'member_account']])
    rejected(verifyFeatureNotNull, `${table}.${column} remains optional`, [...featureNotNull, { table_name: table, column_name: column }]);
  for (const constraint of featureConstraints.filter(row => row.table_name.startsWith('company_opportunity_'))) {
    rejected(verifyFeatureConstraints, `${constraint.name} opportunity constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} opportunity constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  rejected(verifyFeatureNotNull, 'opportunity acknowledgment remains optional', [...featureNotNull,
    { table_name: 'company_opportunity_notices', column_name: 'acknowledged_at' }]);
  for (const constraint of featureConstraints.filter(row => row.table_name.startsWith('commercial_reputation_'))) {
    rejected(verifyFeatureConstraints, `${constraint.name} reputation constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} reputation constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  for (const constraint of featureConstraints.filter(row => ['business_seasons', 'business_season_entries'].includes(row.table_name))) {
    rejected(verifyFeatureConstraints, `${constraint.name} season constraint removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyFeatureConstraints, `${constraint.name} season constraint altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  rejected(verifyFeatureNotNull, 'season observation clock must remain required',
    featureNotNull.filter(row => row.table_name !== 'business_season_entries' || row.column_name !== 'next_observation_at'));
  for (const column of ['baseline', 'end_snapshot', 'final_result'])
    rejected(verifyFeatureNotNull, `season prospective ${column} remains optional`, [...featureNotNull,
      { table_name: 'business_season_entries', column_name: column }]);
  rejected(verifyFeatureNotNull, 'bank finance request identity remains optional', [...featureNotNull,
    { table_name: 'company_bank_portfolio_loans', column_name: 'finance_request_id' }]);
  rejected(verifyFeatureNotNull, 'operator price policy must remain optional', [...featureNotNull,
    { table_name: 'company_operators', column_name: 'price_policy' }]);
  for (const constraint of economyExtensions) {
    rejected(verifyEconomyConstraints, `${constraint.name} reviewed extension removed`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => rows.splice(index, 1)));
    rejected(verifyEconomyConstraints, `${constraint.name} reviewed extension altered`, mutateConstraint(constraint.table_name, constraint.name,
      (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  for (const key of gameplayCatalog.keys) {
    const [table, name] = key.split('.');
    rejected(verifyCompletePreservedConstraints, `${key} gameplay constraint removed`,
      mutateConstraint(table, name, (rows, index) => rows.splice(index, 1)));
    rejected(verifyCompletePreservedConstraints, `${key} gameplay constraint altered`,
      mutateConstraint(table, name, (rows, index) => { rows[index].definition = 'CHECK (true)'; }));
  }
  for (const table of [...CITY_GAMEPLAY_MIGRATION_TABLES, 'item_instances', 'unreviewed_gameplay_table']) {
    rejected(verifyCompletePreservedConstraints, `${table} unknown gameplay constraint rejected`, [...upgradedConstraints,
      { table_name: table, name: 'unreviewed_gameplay_constraint', definition: 'CHECK (true)' }]);
  }
  for (const key of CITY_GAMEPLAY_MIGRATION_REPLACED_KEYS) {
    const [table, name] = key.split('.');
    const original = oldConstraints.findIndex(row => row.table_name === table && row.name === name);
    assert(original >= 0);
    const unknown = structuredClone(oldConstraints); unknown[original].definition = 'CHECK (true)';
    assert.throws(() => gameplayCatalog.normalize(upgradedConstraints, unknown), undefined, `${key} unknown predecessor cannot be restored`);
  }
  for (const column of gameplayMetadata.columns) {
    const altered = structuredClone(gameplayMetadata), key = `${column.table_name}.${column.column_name}`;
    const index = altered.columns.findIndex(row => row.table_name === column.table_name && row.column_name === column.column_name);
    altered.columns[index].not_null = !column.not_null;
    rejected(gameplayCatalog.verifyMetadata, `${key} gameplay nullability altered`, altered);
    const type = structuredClone(gameplayMetadata); type.columns[index].type = column.type === 'text' ? 'character varying(10)' : 'text';
    rejected(gameplayCatalog.verifyMetadata, `${key} gameplay type/typmod altered`, type);
    const defaults = structuredClone(gameplayMetadata); defaults.columns[index].default_expression = 'NULL::text';
    rejected(gameplayCatalog.verifyMetadata, `${key} gameplay default altered`, defaults);
    const missing = structuredClone(gameplayMetadata); missing.columns.splice(index, 1);
    rejected(gameplayCatalog.verifyMetadata, `${key} gameplay column removed`, missing);
  }
  for (const table of CITY_GAMEPLAY_MIGRATION_TABLES) {
    rejected(gameplayCatalog.verifyMetadata, `${table} unknown gameplay column rejected`, { ...gameplayMetadata,
      columns: [...gameplayMetadata.columns, { table_name: table, column_name: 'unreviewed_column', type: 'text', default_expression: null, not_null: false }] });
  }
  for (const constraint of gameplayMetadata.constraints) {
    const altered = structuredClone(gameplayMetadata), index = altered.constraints.findIndex(row => row.table_name === constraint.table_name && row.name === constraint.name);
    altered.constraints[index].validated = false;
    rejected(gameplayCatalog.verifyMetadata, `${constraint.table_name}.${constraint.name} unvalidated gameplay constraint rejected`, altered);
  }
  assert.deepEqual(upgradedConstraints.filter((row) => row.table_name.startsWith('director_')),
    inventory.added.filter((row) => row.table_name.startsWith('director_')),
    'Native Director constraints match the explicitly reviewed architecture inventory');
  assert.deepEqual(upgradedConstraints.filter((row) => row.table_name === 'player_reset_migrations'),
    [{ table_name: 'player_reset_migrations', name: 'player_reset_migrations_pkey', definition: 'PRIMARY KEY (id)' }],
    'The one-time player reset installs only its reviewed identity constraint');
  const deedConstraints = inventory.added.filter((row) => row.table_name === 'deed_upgrades');
  assert.equal(deedConstraints.length, 5, 'All five reviewed deed PK/FK/CHECK constraints must be catalogued');
  assert.deepEqual(upgradedConstraints.filter((row) => row.table_name === 'deed_upgrades'), deedConstraints,
    'Deed upgrades install exactly the reviewed ownership, cap, cost, and uniqueness constraints');
  const notNull = (await pool.query(`SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema=current_schema() AND table_name LIKE 'director_%' AND is_nullable='NO' ORDER BY table_name,column_name`)).rows;
  assert.deepEqual(Object.fromEntries(directorTables.map((table) => [table, notNull.filter((row) => row.table_name === table).map((row) => row.column_name)])),
    Object.fromEntries(directorTables.map((table) => [table, inventory.notNullColumns[table]])));
  assert.deepEqual(await family.create(account, { definitionId: ids.protectOperation }, createKey), operation,
    'Pre-upgrade Family execution identity still reconciles after migration');

  // This assertion is about migration/replay, not the wall clock crossing the
  // scheduler's five-minute bucket while two real migrations run.
  const observedAt = Date.now();
  const director = createLivingWorldDirector({ pool, content, definitions: createDockWarDefinitions(content), mode: 'LIVE', clock: () => observedAt });
  const tick = await director.tick(); assert.equal(tick.selected.length, 1);
  commands = engine(director);
  await act('situation.act', { actionId: 'protect' });
  const currentRows = await capture([...canonicalTables, ...directorTables]);
  for (const table of directorTables) assert(currentRows[table].length > 0, `${table} must be populated before reapplication`);
  await migrate();
  assert.deepEqual(await capture([...canonicalTables, ...directorTables]), currentRows,
    'Second migration preserves populated Director definitions, campaigns, lifecycle, selections, intents and domain receipts');
  assert.deepEqual(await constraints(), upgradedConstraints);
  verifyCompletePreservedConstraints(await constraints());
  gameplayCatalog.verifyMetadata(await readCityGameplayMigrationMetadata(pool));
  assert.equal((await director.tick()).replayed, true);
  await assert.rejects(pool.query('UPDATE director_situations SET revision=0 WHERE id=$1', [tick.selected[0].situationId]), { code: '23514' });
  await assert.rejects(pool.query("UPDATE director_situations SET campaign_id='missing-campaign' WHERE id=$1", [tick.selected[0].situationId]), { code: '23503' });
  await assert.rejects(pool.query('INSERT INTO director_receipts SELECT * FROM director_receipts LIMIT 1'), { code: '23505' });
  console.log(`director-migration: populated ${BASELINE}, two production migrations, original/canonical/Director preservation, exact frozen ${featureTables.length} optional feature tables/${featureConstraints.length} constraints and required columns, missing/altered/unknown causal negatives PASS (PostgreSQL ${serverVersion})`);
  console.log(`director-migration gameplay delta: immutable ${gameplayCatalog.source.revision}, ${gameplayCatalog.tableCount} tables/${gameplayCatalog.constraintCount} constraints, exact prior predicate restoration, type/default/nullable/unknown/unvalidated causal controls PASS`);
} finally {
  if (pool) await pool.end();
  if (created) await admin.query(`DROP SCHEMA ${namespace} CASCADE`);
  await admin.end();
}
