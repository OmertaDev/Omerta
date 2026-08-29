import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { DataType, newDb } from 'pg-mem';

import {
  migrateRwaHealthOverlayV2,
  registerPgMemCompatibility,
} from '../src/db.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SCHEMA = fs.readFileSync(path.join(here, '..', 'schema.sql'), 'utf8');
const UINT64_MAX = '18446744073709551615';
const UINT256_MAX = '115792089237316195423570985008687907853269984665640564039457584007913129639935';
const INT64_MAX = '9223372036854775807';

const TABLES = Object.freeze([
  'rwa_health_overlay_lock_v2',
  'rwa_health_overlay_checkpoint_v2',
  'rwa_health_overlay_runtime_v2',
  'rwa_health_overlay_attempts_v2',
  'rwa_health_overlay_asset_state_v2',
  'rwa_health_overlay_inbox_v2',
  'rwa_health_clearance_attestations_v2',
  'rwa_health_clearance_recovery_evidence_v2',
  'rwa_health_clearance_safe_proposals_v2',
  'rwa_health_overlay_event_results_v2',
  'rwa_health_overlay_incidents_v2',
  'rwa_health_finalized_clearances_v2',
]);

const FOREIGN_KEYS = Object.freeze([
  Object.freeze({
    table: 'rwa_health_episodes_v2',
    name: 'fk_rwa_health_episode_h2_clearance_v2',
    source: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id', 'generation',
      'clearance_generation', 'clearance_block_number', 'clearance_block_hash',
      'clearance_applied_at',
    ]),
    referenced: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'h1_clearance_generation', 'execution_block_number',
      'execution_block_hash', 'finalized_applied_at',
    ]),
  }),
  Object.freeze({
    table: 'rwa_health_episode_events_v2',
    name: 'fk_rwa_health_event_h2_clearance_v2',
    source: Object.freeze([
      'source_clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'event_id', 'evidence_hash',
    ]),
    referenced: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'h1_clearance_event_id', 'recovery_evidence_hash',
    ]),
  }),
  Object.freeze({
    table: 'rwa_health_current_v2',
    name: 'fk_rwa_health_current_h2_clearance_v2',
    source: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'current_episode_id',
      'current_episode_generation', 'clearance_generation', 'clearance_applied_at',
      'latest_episode_event_id',
    ]),
    referenced: Object.freeze([
      'clearance_id', 'registry_address', 'asset_version_key', 'episode_id',
      'episode_generation', 'h1_clearance_generation', 'finalized_applied_at',
      'h1_clearance_event_id',
    ]),
  }),
]);

const TABLE_COLUMNS = Object.freeze({
  rwa_health_overlay_checkpoint_v2: Object.freeze([
    'consumer_key', 'chain_id', 'registry_address', 'overlay_address', 'safe_address',
    'start_block_number', 'last_applied_block_number', 'last_applied_block_hash',
    'last_observation_hash', 'finalized_horizon_block_number',
    'finalized_horizon_block_hash', 'caught_up', 'halted', 'verified_at',
    'ready_verified_at',
  ]),
  rwa_health_overlay_runtime_v2: Object.freeze([
    'id', 'consumer_key', 'chain_id', 'registry_address', 'overlay_address', 'safe_address',
    'start_block_number', 'sync_in_progress', 'attempt_id', 'last_attempt_at',
    'last_success_at', 'ready_verified_at', 'caught_up', 'halted', 'failure_code',
    'unresolved_authority_incident_count', 'last_incident_id',
  ]),
  rwa_health_overlay_inbox_v2: Object.freeze([
    'inbox_id', 'consumer_key', 'chain_id', 'contract_address', 'block_number',
    'block_hash', 'block_timestamp', 'transaction_hash', 'transaction_index', 'log_index',
    'topic0', 'topics_json', 'data_hex', 'decoded_hash', 'observation_hash',
    'clearance_id', 'asset_version_key', 'overlay_generation', 'registry_address',
    'activation_generation', 'catalog_snapshot_hash', 'episode_id', 'episode_generation',
    'current_severity', 'state_sequence', 'latest_episode_event_id',
    'latest_material_evidence_hash', 'recovery_evidence_hash',
    'fresh_healthy_evaluation_id', 'fresh_healthy_evidence_hash', 'reviewer_id_hash',
    'clearance_payload_hash', 'safe_call_intent_hash', 'approved_at',
    'clearance_deadline',
  ]),
  rwa_health_clearance_attestations_v2: Object.freeze([
    'clearance_id', 'semantic_request_hash', 'chain_id', 'registry_address',
    'overlay_address', 'safe_address', 'catalog_version', 'catalog_snapshot_hash',
    'asset_version_key', 'activation_generation', 'activation_block_number',
    'activation_block_hash', 'activation_transaction_hash', 'activation_log_index',
    'activation_evidence_hash', 'activation_review_id', 'activation_approved_at',
    'activation_valid_until', 'activation_included_at', 'episode_id',
    'episode_generation', 'current_severity', 'state_sequence', 'latest_episode_event_id',
    'latest_material_event_id', 'latest_material_evidence_hash',
    'fresh_healthy_evaluation_id', 'fresh_healthy_evaluation_status',
    'fresh_healthy_evaluation_kind', 'fresh_healthy_evidence_hash',
    'fresh_healthy_evaluation_applied_at', 'reviewer_id', 'reviewer_id_hash',
    'recovery_evidence_hash', 'approved_at', 'clearance_deadline',
    'expected_overlay_generation', 'expected_safe_nonce', 'clearance_payload_hash',
    'safe_call_intent_hash', 'calldata_hash', 'first_transport_key_hash',
  ]),
  rwa_health_clearance_safe_proposals_v2: Object.freeze([
    'clearance_id', 'semantic_request_hash', 'registry_address', 'asset_version_key',
    'expected_overlay_generation', 'safe_address', 'to_address', 'value_wei', 'operation',
    'calldata_hex', 'calldata_hash', 'expected_safe_nonce',
    'safe_service_transaction_hash', 'execution_transaction_hash', 'status',
    'approved_at', 'clearance_deadline', 'submitted_at', 'finalized_at',
  ]),
  rwa_health_overlay_event_results_v2: Object.freeze([
    'inbox_id', 'clearance_id', 'asset_version_key', 'overlay_generation', 'disposition',
  ]),
  rwa_health_overlay_incidents_v2: Object.freeze([
    'inbox_id', 'incident_id', 'clearance_id', 'disposition', 'authority_incident',
  ]),
  rwa_health_finalized_clearances_v2: Object.freeze([
    'clearance_id', 'disposition', 'registry_address', 'overlay_address',
    'asset_version_key', 'activation_generation', 'overlay_generation', 'episode_id',
    'episode_generation', 'h1_clearance_generation', 'execution_block_number',
    'execution_block_hash', 'execution_transaction_hash', 'execution_log_index',
    'event_inbox_id', 'h1_clearance_event_id', 'recovery_evidence_hash',
    'finalized_applied_at',
  ]),
});

function tableBody(table) {
  const match = SCHEMA.match(new RegExp(
    `CREATE TABLE IF NOT EXISTS ${table}\\s*\\(([\\s\\S]*?)\\n\\);`, 'i',
  ));
  assert(match, `fresh schema must create ${table}`);
  return match[1];
}

for (const table of TABLES) tableBody(table);
for (const [table, columns] of Object.entries(TABLE_COLUMNS)) {
  const body = tableBody(table);
  for (const column of columns) {
    assert.match(body, new RegExp(`\\b${column}\\b`, 'i'), `${table} must retain ${column}`);
  }
}

assert.match(tableBody('rwa_health_overlay_checkpoint_v2'),
  /consumer_key\s+TEXT[\s\S]{0,100}?CHECK\s*\(consumer_key\s*=\s*'rwa_health_overlay_v2'\)/i);
assert.match(tableBody('rwa_health_overlay_checkpoint_v2'),
  /chain_id\s+NUMERIC\(78,0\)[\s\S]{0,100}?CHECK\s*\(chain_id\s*=\s*4663\)/i);
assert.match(tableBody('rwa_health_overlay_runtime_v2'),
  /ready_verified_at\s+IS NULL[\s\S]*unresolved_authority_incident_count\s*=\s*0/i);
assert.match(tableBody('rwa_health_overlay_incidents_v2'),
  /inbox_id\s+TEXT\s+PRIMARY KEY/i);
assert.match(tableBody('rwa_health_overlay_incidents_v2'),
  /authority_incident\s*=\s*\(disposition\s+IN/i);
assert.match(tableBody('rwa_health_finalized_clearances_v2'),
  /disposition\s+TEXT[\s\S]{0,100}?CHECK\s*\(disposition\s*=\s*'applied'\)/i);

for (const [name, columns] of [
  ['uq_rwa_health_finalized_episode_v2', FOREIGN_KEYS[0].referenced],
  ['uq_rwa_health_finalized_event_v2', FOREIGN_KEYS[1].referenced],
  ['uq_rwa_health_finalized_current_v2', FOREIGN_KEYS[2].referenced],
]) {
  const literal = columns.join('\\s*,\\s*');
  assert.match(tableBody('rwa_health_finalized_clearances_v2'), new RegExp(
    `CONSTRAINT\\s+${name}\\s+UNIQUE\\s*\\(\\s*${literal}\\s*\\)`, 'i',
  ), `${name} must expose the exact applied-only referenced tuple`);
}

for (const spec of FOREIGN_KEYS) {
  const literal = `CONSTRAINT\\s+${spec.name}\\s+FOREIGN KEY\\s*\\(\\s*`
    + `${spec.source.join('\\s*,\\s*')}\\s*\\)\\s*REFERENCES\\s+`
    + `rwa_health_finalized_clearances_v2\\s*\\(\\s*`
    + `${spec.referenced.join('\\s*,\\s*')}\\s*\\)\\s*ON DELETE RESTRICT`;
  assert.match(tableBody(spec.table), new RegExp(literal, 'i'),
    `${spec.name} must be present literally in the fresh H1 table`);
}

for (const index of [
  'ix_rwa_health_overlay_attempts_status_v2',
  'ix_rwa_health_overlay_asset_generation_v2',
  'ux_rwa_health_overlay_inbox_identity_v2',
  'ix_rwa_health_overlay_inbox_order_v2',
  'ix_rwa_health_overlay_inbox_asset_generation_v2',
  'ix_rwa_health_clearance_attestations_asset_v2',
  'ux_rwa_health_clearance_open_generation_v2',
  'ux_rwa_health_clearance_open_semantic_v2',
  'ix_rwa_health_clearance_expiry_v2',
  'ix_rwa_health_overlay_event_results_disposition_v2',
  'ix_rwa_health_overlay_incidents_authority_v2',
  'ix_rwa_health_finalized_clearances_asset_v2',
]) {
  assert.match(SCHEMA, new RegExp(`CREATE (?:UNIQUE )?INDEX IF NOT EXISTS ${index}\\b`, 'i'),
    `fresh schema must create ${index}`);
}

assert.match(SCHEMA,
  /ux_rwa_health_clearance_open_generation_v2[\s\S]*WHERE status IN\s*\('safe_package_ready','safe_submitted'\)/i);
assert.match(SCHEMA,
  /ux_rwa_health_clearance_open_semantic_v2[\s\S]*WHERE status IN\s*\('safe_package_ready','safe_submitted'\)/i);

const ABI_WIDTHS = Object.freeze({
  uint256: Object.freeze({
    rwa_health_overlay_checkpoint_v2: Object.freeze([
      ['start_block_number', 0], ['last_applied_block_number', 0],
      ['finalized_horizon_block_number', 0],
    ]),
    rwa_health_overlay_runtime_v2: Object.freeze([
      ['start_block_number', 0], ['last_applied_block_number', 0],
      ['finalized_horizon_block_number', 0], ['unresolved_authority_incident_count', 0],
    ]),
    rwa_health_overlay_asset_state_v2: Object.freeze([
      ['overlay_generation', 1], ['last_block_number', 0], ['last_log_index', 0],
    ]),
    rwa_health_overlay_inbox_v2: Object.freeze([
      ['block_number', 0], ['block_timestamp', 0], ['transaction_index', 0],
      ['log_index', 0], ['overlay_generation', 1], ['activation_generation', 1],
      ['episode_generation', 1],
    ]),
    rwa_health_clearance_attestations_v2: Object.freeze([
      ['catalog_version', 0], ['activation_generation', 1], ['activation_block_number', 0],
      ['activation_log_index', 0], ['episode_generation', 1],
      ['expected_overlay_generation', 1], ['expected_safe_nonce', 0],
    ]),
    rwa_health_clearance_safe_proposals_v2: Object.freeze([
      ['expected_overlay_generation', 1], ['expected_safe_nonce', 0],
    ]),
    rwa_health_overlay_event_results_v2: Object.freeze([['overlay_generation', 1]]),
    rwa_health_finalized_clearances_v2: Object.freeze([
      ['activation_generation', 1], ['overlay_generation', 1], ['episode_generation', 1],
      ['h1_clearance_generation', 1], ['execution_block_number', 0],
      ['execution_log_index', 0],
    ]),
  }),
  uint64: Object.freeze({
    rwa_health_overlay_inbox_v2: Object.freeze(['approved_at', 'clearance_deadline']),
    rwa_health_clearance_attestations_v2: Object.freeze(['approved_at', 'clearance_deadline']),
    rwa_health_clearance_safe_proposals_v2: Object.freeze(['approved_at', 'clearance_deadline']),
  }),
  signedSequence: Object.freeze({
    rwa_health_overlay_inbox_v2: Object.freeze(['state_sequence']),
    rwa_health_clearance_attestations_v2: Object.freeze(['state_sequence']),
  }),
});

for (const [table, columns] of Object.entries(ABI_WIDTHS.uint256)) {
  const body = tableBody(table);
  for (const [column, minimum] of columns) {
    assert.match(body, new RegExp(
      `${column}\\s+NUMERIC\\(78,0\\)[\\s\\S]{0,280}?${column}\\s+BETWEEN\\s+${minimum}\\s+AND\\s+${UINT256_MAX}`,
      'i',
    ), `${table}.${column} must enforce its frozen uint256 width`);
  }
}
for (const [table, columns] of Object.entries(ABI_WIDTHS.uint64)) {
  const body = tableBody(table);
  for (const column of columns) {
    assert.match(body, new RegExp(
      `${column}\\s+NUMERIC\\(20,0\\)[\\s\\S]{0,180}?${column}\\s+BETWEEN\\s+0\\s+AND\\s+${UINT64_MAX}`,
      'i',
    ), `${table}.${column} must enforce its frozen uint64 width`);
  }
}
for (const [table, columns] of Object.entries(ABI_WIDTHS.signedSequence)) {
  const body = tableBody(table);
  for (const column of columns) {
    assert.match(body, new RegExp(
      `${column}\\s+BIGINT[\\s\\S]{0,120}?${column}\\s+BETWEEN\\s+1\\s+AND\\s+${INT64_MAX}`,
      'i',
    ), `${table}.${column} must remain inside the signed H1 sequence domain`);
  }
}
for (const table of TABLES) {
  const body = tableBody(table);
  if (/\bchain_id\b/i.test(body)) {
    assert.match(body, /chain_id\s+NUMERIC\(78,0\)[\s\S]{0,100}?CHECK\s*\(chain_id\s*=\s*4663\)/i,
      `${table}.chain_id must be the literal overlay chain`);
  }
}
assert.match(tableBody('rwa_health_clearance_safe_proposals_v2'),
  /value_wei\s+NUMERIC\(78,0\)[\s\S]{0,100}?CHECK\s*\(value_wei\s*=\s*0\)/i,
  'Safe proposal value is exact zero, so it cannot exceed its uint256 ABI width');

const mem = newDb();
registerPgMemCompatibility(mem, DataType);
const { Pool } = mem.adapters.createPg();
const pool = new Pool();
await pool.query(SCHEMA);
const materialized = new Set((await pool.query(
  `SELECT table_name FROM information_schema.tables
    WHERE table_schema='public' AND table_name LIKE 'rwa_health%_v2'`,
)).rows.map((row) => row.table_name));
for (const table of TABLES) assert(materialized.has(table), `pg-mem materialized ${table}`);
assert.equal((await pool.query('SELECT count(*)::int AS n FROM rwa_health_overlay_lock_v2')).rows[0].n, 1);
assert.equal((await pool.query('SELECT count(*)::int AS n FROM rwa_health_overlay_checkpoint_v2')).rows[0].n, 1);
assert.equal((await pool.query('SELECT count(*)::int AS n FROM rwa_health_overlay_runtime_v2')).rows[0].n, 1);
const compatibility = await migrateRwaHealthOverlayV2(pool, { compatibility: 'pg-mem' });
assert.deepEqual(compatibility,
  { compatibility: 'pg-mem', verified: false, installed: 0 },
  'pg-mem is an explicit compatibility lane, never reported as PostgreSQL verification');
await pool.end();

function definition(spec) {
  return `FOREIGN KEY (${spec.source.join(',')}) REFERENCES rwa_health_finalized_clearances_v2 `
    + `(${spec.referenced.join(',')}) ON DELETE RESTRICT`;
}

function metadata(spec, overrides = {}) {
  return {
    conname: spec.name,
    contype: 'f',
    convalidated: true,
    confdeltype: 'r',
    definition: definition(spec),
    referenced_table: 'rwa_health_finalized_clearances_v2',
    source_columns: [...spec.source],
    referenced_columns: [...spec.referenced],
    ...overrides,
  };
}

function productionClient(initial = new Map(), { failValidationFor = null } = {}) {
  const constraints = new Map(initial);
  const statements = [];
  return {
    constraints,
    statements,
    async query(sql, params = []) {
      statements.push(sql);
      if (/FROM pg_constraint c/i.test(sql)) {
        const row = constraints.get(params[0]);
        return { rows: row ? [{ ...row }] : [] };
      }
      const add = sql.match(/ADD CONSTRAINT\s+(fk_rwa_health_[a-z0-9_]+_v2)\s+/i);
      if (add) {
        const spec = FOREIGN_KEYS.find((candidate) => candidate.name === add[1]);
        constraints.set(spec.name, metadata(spec, { convalidated: false }));
      }
      const validate = sql.match(/VALIDATE CONSTRAINT\s+(fk_rwa_health_[a-z0-9_]+_v2)/i);
      if (validate) {
        if (validate[1] === failValidationFor) {
          throw Object.assign(new Error('legacy tuple has no applied clearance'), { code: '23503' });
        }
        constraints.set(validate[1], { ...constraints.get(validate[1]), convalidated: true });
      }
      return { rows: [], rowCount: 0 };
    },
  };
}

{
  const client = productionClient();
  const result = await migrateRwaHealthOverlayV2(client);
  assert.deepEqual(result, { compatibility: 'postgres', verified: true, installed: 3 });
  assert.equal(client.statements[0], 'BEGIN');
  assert.match(client.statements[2],
    /LOCK TABLE rwa_health_finalized_clearances_v2,rwa_health_episodes_v2,[\s\S]*ACCESS EXCLUSIVE MODE/i);
  assert.equal(client.statements.filter((sql) => /ADD CONSTRAINT .* NOT VALID/i.test(sql)).length, 3);
  assert.equal(client.statements.filter((sql) => /VALIDATE CONSTRAINT/i.test(sql)).length, 3);
  assert.equal(client.statements.at(-1), 'COMMIT');
  const before = client.statements.length;
  const rerun = await migrateRwaHealthOverlayV2(client);
  assert.deepEqual(rerun, { compatibility: 'postgres', verified: true, installed: 0 });
  assert.equal(client.statements.slice(before).some((sql) => /ADD CONSTRAINT|VALIDATE CONSTRAINT/i.test(sql)), false,
    'an exact validated rerun performs no authority DDL');
}

for (const [label, override] of [
  ['definition', { definition: `${definition(FOREIGN_KEYS[0])} MATCH FULL` }],
  ['source order', { source_columns: [...FOREIGN_KEYS[0].source].reverse() }],
  ['reference order', { referenced_columns: [...FOREIGN_KEYS[0].referenced].reverse() }],
  ['delete action', { confdeltype: 'c' }],
  ['referenced table', { referenced_table: 'wrong_clearances_v2' }],
  ['type', { contype: 'c' }],
]) {
  const client = productionClient(new Map([
    [FOREIGN_KEYS[0].name, metadata(FOREIGN_KEYS[0], override)],
  ]));
  await assert.rejects(migrateRwaHealthOverlayV2(client), (error) => (
    error.code === 'rwa_health_overlay_migration_invalid'
      && error.message.includes(`drifted constraint ${FOREIGN_KEYS[0].name}`)
  ), `${label} drift must fail closed`);
  assert.equal(client.statements.at(-1), 'ROLLBACK');
}

{
  const client = productionClient(new Map([
    [FOREIGN_KEYS[0].name, metadata(FOREIGN_KEYS[0], { convalidated: false })],
  ]));
  await assert.rejects(migrateRwaHealthOverlayV2(client), (error) => (
    error.code === 'rwa_health_overlay_migration_invalid'
      && error.message.includes(`unvalidated constraint ${FOREIGN_KEYS[0].name}`)
  ));
  assert.equal(client.statements.some((sql) => /VALIDATE CONSTRAINT/i.test(sql)), false,
    'a pre-existing unvalidated name is rejected, not silently adopted');
  assert.equal(client.statements.at(-1), 'ROLLBACK');
}

{
  const client = productionClient(new Map(), { failValidationFor: FOREIGN_KEYS[1].name });
  await assert.rejects(migrateRwaHealthOverlayV2(client), (error) => error.code === '23503');
  assert.equal(client.statements.includes('COMMIT'), false);
  assert.equal(client.statements.at(-1), 'ROLLBACK',
    'invalid legacy non-null tuples abort before a schema stamp can follow');
}

{
  const client = productionClient();
  await assert.rejects(
    migrateRwaHealthOverlayV2(client, { compatibility: 'unknown' }),
    (error) => error.code === 'rwa_health_overlay_migration_invalid',
  );
  assert.equal(client.statements.at(-1), 'ROLLBACK');
}

console.log('✅ RWA health H2 schema passed — 12 tables, 12 operational indexes, 3 applied-only unique tuples, 3 exact H1 foreign keys, fresh pg-mem materialization, and fail-closed production migration verification.');
