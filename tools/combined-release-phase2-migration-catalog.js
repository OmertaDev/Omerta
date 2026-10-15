// Test-only C2 native catalog proof. This grants no financial, seed-DML, payment,
// deployment, or historical qualification. Historical native helpers stay separate.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import fs from 'node:fs';
import pg from 'pg';

export const RELEASE_PHASE2_SOURCE = Object.freeze({"revision":"9540d9aa21905229f9101b950ea4dd21ed6e648e","file":"schema.sql","blob":"328f92083c8c9b9a94e3da103efbda1750cc2bed","sha256":"03aecb8a4a997b22732e2a5190fec2dcef3acda8a2744e4369b59cd4228f85db"});
export const RELEASE_PHASE2_PREDECESSOR = Object.freeze({"revision":"0c72a29748df6b1c6955ebcb648efe5f20fec6a1","file":"schema.sql","blob":"94fa33fea977d185870a108f23b3c06db17095e2","sha256":"c24abb3e7a3863dabeecbb683671a12e95c447918a2b385b38cc36691fbb9dc9"});
const RESET_SOURCE = Object.freeze({ revision: 'b90bd95dee6e0fda851247cc660288f4bbf8fdc0', file: 'src/db.js',
  blob: 'ce9dd3d53b9c6e22b409b1ca7150a27dad16ea13', sha256: 'dabe71959257fe28a99c08be900e5b9ad0979144af41a121b0fcab24f9326808' });
const RESET_DDL = 'CREATE TABLE IF NOT EXISTS player_reset_migrations (\n    id TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now()\n  )';
const LEGACY_PROFILES = Object.freeze({
  phase2: Object.freeze({ revision: '8dbe85846035dc0fcdba76992834e411632c6f1b',
    blob: 'ba2c528efe09153899c7fc1ef3c543d95b1f7285', sha256: '2313bee0087bc90c5987ab6482d1cdc176a3060da8e24f487453a518d79a27c0',
    boundary: '-- Phase 2 sealed definition plane;', prefixOffset: 395041, prefixBytes: 397948,
    prefixSha256: '1a8a4ca56a11d2eef29f91b9807f87720fe3b6b4f41cc1c36b3d584767e3a2ad' }),
  director: Object.freeze({ revision: '44f48a743e549591bd125a1f678099b8382dd78f',
    blob: 'fa7314cba442dd0a9935b08647319162587e4819', sha256: '6be8c8b0f8cd99559713bb0552302fc399f1b3d88a98705f74c571090c18ca18' }),
});
export const RELEASE_PHASE2_TABLES = Object.freeze(['agent_gateway_connections', 'agent_gateway_preparations',
  'agent_gateway_rate_buckets', 'agent_gateway_requests', 'agent_gateway_subscriptions', 'payment_receipts', 'street_deed_supply']);
const ADDED_INDEX_KEYS = Object.freeze([
  'agent_gateway_connections.agent_gateway_connections_pkey', 'agent_gateway_connections.agent_gateway_connections_token_hash_key',
  'agent_gateway_connections.ix_agent_gateway_connections_account', 'agent_gateway_preparations.agent_gateway_preparations_connection_id_request_id_key',
  'agent_gateway_preparations.agent_gateway_preparations_pkey', 'agent_gateway_preparations.ix_agent_gateway_preparations_account',
  'agent_gateway_rate_buckets.agent_gateway_rate_buckets_pkey', 'agent_gateway_requests.agent_gateway_requests_pkey',
  'agent_gateway_subscriptions.agent_gateway_subscriptions_pkey', 'agent_gateway_subscriptions.ix_agent_gateway_subscriptions_connection',
  'coordination_events.ix_agent_gateway_coordination_cursor', 'notifications.ix_agent_gateway_notifications_cursor',
  'payment_receipts.payment_receipts_due_idx', 'payment_receipts.payment_receipts_pkey', 'street_deed_supply.street_deed_supply_pkey']);
const LEGACY_ORDINAL_BINDINGS = Object.freeze({
  "phase2": [
    {
      "key": "item_instances.definition_hash",
      "fresh": 3,
      "upgraded": 10
    },
    {
      "key": "item_instances.owner_scope",
      "fresh": 4,
      "upgraded": 3
    },
    {
      "key": "item_instances.owner_id",
      "fresh": 5,
      "upgraded": 4
    },
    {
      "key": "item_instances.state",
      "fresh": 6,
      "upgraded": 5
    },
    {
      "key": "item_instances.created_at",
      "fresh": 7,
      "upgraded": 6
    },
    {
      "key": "item_instances.updated_at",
      "fresh": 8,
      "upgraded": 7
    },
    {
      "key": "item_instances.consumed_at",
      "fresh": 9,
      "upgraded": 8
    },
    {
      "key": "item_instances.logical_item_id",
      "fresh": 10,
      "upgraded": 9
    },
    {
      "key": "street_deeds.home_authority_token",
      "fresh": 10,
      "upgraded": 16
    },
    {
      "key": "street_deeds.sale_price",
      "fresh": 11,
      "upgraded": 10
    },
    {
      "key": "street_deeds.onchain_token_id",
      "fresh": 12,
      "upgraded": 11
    },
    {
      "key": "street_deeds.onchain_owner",
      "fresh": 13,
      "upgraded": 12
    },
    {
      "key": "street_deeds.extracted_by_account",
      "fresh": 14,
      "upgraded": 13
    },
    {
      "key": "street_deeds.extracted_at",
      "fresh": 15,
      "upgraded": 14
    },
    {
      "key": "street_deeds.attested_at",
      "fresh": 16,
      "upgraded": 15
    }
  ],
  "director": [
    {
      "key": "item_instances.definition_hash",
      "fresh": 3,
      "upgraded": 10
    },
    {
      "key": "item_instances.owner_scope",
      "fresh": 4,
      "upgraded": 3
    },
    {
      "key": "item_instances.owner_id",
      "fresh": 5,
      "upgraded": 4
    },
    {
      "key": "item_instances.state",
      "fresh": 6,
      "upgraded": 5
    },
    {
      "key": "item_instances.created_at",
      "fresh": 7,
      "upgraded": 6
    },
    {
      "key": "item_instances.updated_at",
      "fresh": 8,
      "upgraded": 7
    },
    {
      "key": "item_instances.consumed_at",
      "fresh": 9,
      "upgraded": 8
    },
    {
      "key": "item_instances.logical_item_id",
      "fresh": 10,
      "upgraded": 9
    },
    {
      "key": "market_listings.depot_id",
      "fresh": 3,
      "upgraded": 17
    },
    {
      "key": "market_listings.kind",
      "fresh": 4,
      "upgraded": 3
    },
    {
      "key": "market_listings.car_id",
      "fresh": 5,
      "upgraded": 4
    },
    {
      "key": "market_listings.good_id",
      "fresh": 6,
      "upgraded": 5
    },
    {
      "key": "market_listings.qty",
      "fresh": 7,
      "upgraded": 6
    },
    {
      "key": "market_listings.filled_qty",
      "fresh": 8,
      "upgraded": 7
    },
    {
      "key": "market_listings.district",
      "fresh": 9,
      "upgraded": 8
    },
    {
      "key": "market_listings.price",
      "fresh": 10,
      "upgraded": 9
    },
    {
      "key": "market_listings.buy_now",
      "fresh": 11,
      "upgraded": 10
    },
    {
      "key": "market_listings.reserve",
      "fresh": 12,
      "upgraded": 11
    },
    {
      "key": "market_listings.bid",
      "fresh": 13,
      "upgraded": 12
    },
    {
      "key": "market_listings.bidder",
      "fresh": 14,
      "upgraded": 13
    },
    {
      "key": "market_listings.status",
      "fresh": 15,
      "upgraded": 14
    },
    {
      "key": "market_listings.expires_at",
      "fresh": 16,
      "upgraded": 15
    },
    {
      "key": "market_listings.created_at",
      "fresh": 17,
      "upgraded": 16
    },
    {
      "key": "street_deeds.home_authority_token",
      "fresh": 10,
      "upgraded": 16
    },
    {
      "key": "street_deeds.sale_price",
      "fresh": 11,
      "upgraded": 10
    },
    {
      "key": "street_deeds.onchain_token_id",
      "fresh": 12,
      "upgraded": 11
    },
    {
      "key": "street_deeds.onchain_owner",
      "fresh": 13,
      "upgraded": 12
    },
    {
      "key": "street_deeds.extracted_by_account",
      "fresh": 14,
      "upgraded": 13
    },
    {
      "key": "street_deeds.extracted_at",
      "fresh": 15,
      "upgraded": 14
    },
    {
      "key": "street_deeds.attested_at",
      "fresh": 16,
      "upgraded": 15
    }
  ]
});
const INVERSES = [
  {
    "current": ");\nCREATE UNIQUE INDEX IF NOT EXISTS ix_street_deeds_name ON street_deeds (name_lc);\nCREATE INDEX IF NOT EXISTS ix_street_deeds_district ON street_deeds (district);\n-- Lifetime unique-street issuance. The singleton locks cross-account claims; burns, extraction,\n-- resale and death never decrement it. Seed upgrades from every existing identity, on-chain or not.\nCREATE TABLE IF NOT EXISTS street_deed_supply (\n  id INT PRIMARY KEY CHECK (id = 1),\n  issued INT NOT NULL DEFAULT 0 CHECK (issued >= 0)\n);\nINSERT INTO street_deed_supply (id, issued)\n  SELECT 1, COUNT(*) FROM street_deeds ON CONFLICT (id) DO NOTHING;\n-- Phase 2 — CONTROL + THE CORNER TAKE. The deed (owner) is permanent; CONTROL (who collects the corner\n-- take) is contestable: a rival muscles in for a window, then it lapses back to the owner. `corner_at`\n-- is the corner-take lazy clock (a small bounded cash faucet `deed:corner`); a seizure forfeits pending\n",
    "baseline": ");\nCREATE UNIQUE INDEX IF NOT EXISTS ix_street_deeds_name ON street_deeds (name_lc);\nCREATE INDEX IF NOT EXISTS ix_street_deeds_district ON street_deeds (district);\n-- Phase 2 — CONTROL + THE CORNER TAKE. The deed (owner) is permanent; CONTROL (who collects the corner\n-- take) is contestable: a rival muscles in for a window, then it lapses back to the owner. `corner_at`\n-- is the corner-take lazy clock (a small bounded cash faucet `deed:corner`); a seizure forfeits pending\n"
  },
  {
    "current": "ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS ownership_since_day INT;\nALTER TABLE account_persistent ADD COLUMN IF NOT EXISTS reward_wallet_since_day INT;\n\n-- Provider-neutral Consigliere delegation. Credentials and requests never hold wallet keys.\nCREATE TABLE IF NOT EXISTS agent_gateway_connections (\n  id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES accounts(id),\n  provider TEXT NOT NULL,\n  label TEXT NOT NULL,\n  scopes_json TEXT NOT NULL,\n  token_hash TEXT NOT NULL UNIQUE,\n  token_version INT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  expires_at TIMESTAMPTZ NOT NULL,\n  revoked_at TIMESTAMPTZ\n);\nCREATE INDEX IF NOT EXISTS ix_agent_gateway_connections_account ON agent_gateway_connections(account_id,created_at);\nCREATE TABLE IF NOT EXISTS agent_gateway_rate_buckets (\n  account_id TEXT PRIMARY KEY REFERENCES accounts(id),\n  window_id BIGINT NOT NULL,\n  used INT NOT NULL DEFAULT 0\n);\nCREATE TABLE IF NOT EXISTS agent_gateway_requests (\n  connection_id TEXT NOT NULL REFERENCES agent_gateway_connections(id),\n  request_id TEXT NOT NULL,\n  request_hash TEXT NOT NULL,\n  capability TEXT NOT NULL,\n  action_class TEXT NOT NULL,\n  state TEXT NOT NULL DEFAULT 'started',\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  completed_at TIMESTAMPTZ,\n  result_code TEXT,\n  preparation_id TEXT,\n  PRIMARY KEY (connection_id,request_id)\n);\nCREATE TABLE IF NOT EXISTS agent_gateway_preparations (\n  id TEXT PRIMARY KEY,\n  connection_id TEXT NOT NULL REFERENCES agent_gateway_connections(id),\n  account_id TEXT NOT NULL REFERENCES accounts(id),\n  request_id TEXT NOT NULL,\n  capability TEXT NOT NULL,\n  arguments_json TEXT NOT NULL,\n  preview_json TEXT NOT NULL,\n  target_json TEXT NOT NULL,\n  digest TEXT NOT NULL,\n  nonce TEXT NOT NULL,\n  state TEXT NOT NULL DEFAULT 'pending',\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  expires_at TIMESTAMPTZ NOT NULL,\n  confirmed_at TIMESTAMPTZ,\n  result_json TEXT,\n  UNIQUE (connection_id,request_id)\n);\nCREATE INDEX IF NOT EXISTS ix_agent_gateway_preparations_account ON agent_gateway_preparations(account_id,created_at);\nCREATE TABLE IF NOT EXISTS agent_gateway_subscriptions (\n  id TEXT PRIMARY KEY,\n  connection_id TEXT NOT NULL REFERENCES agent_gateway_connections(id),\n  account_id TEXT NOT NULL REFERENCES accounts(id),\n  topics_json TEXT NOT NULL,\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  revoked_at TIMESTAMPTZ\n);\nCREATE INDEX IF NOT EXISTS ix_agent_gateway_subscriptions_connection ON agent_gateway_subscriptions(connection_id,created_at,id);\nCREATE INDEX IF NOT EXISTS ix_agent_gateway_notifications_cursor ON notifications(character_id,created_at,id);\nCREATE INDEX IF NOT EXISTS ix_agent_gateway_coordination_cursor ON coordination_events(occurred_at,id);\n\n-- Inventory-backed gin depots. No clock-based income or mint authority.\nCREATE TABLE IF NOT EXISTS business_depots (\n  id TEXT PRIMARY KEY,\n",
    "baseline": "ALTER TABLE street_deeds ADD COLUMN IF NOT EXISTS ownership_since_day INT;\nALTER TABLE account_persistent ADD COLUMN IF NOT EXISTS reward_wallet_since_day INT;\n\n-- Inventory-backed gin depots. No clock-based income or mint authority.\nCREATE TABLE IF NOT EXISTS business_depots (\n  id TEXT PRIMARY KEY,\n"
  },
  {
    "current": " account_id TEXT NOT NULL,key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),run_id TEXT NOT NULL UNIQUE,\n receipt JSONB,account_ref TEXT REFERENCES accounts(id),actor_ref TEXT REFERENCES characters(id),PRIMARY KEY(account_id,key_hash),\n CHECK((receipt IS NULL AND account_ref IS NULL AND actor_ref IS NULL) OR(receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND actor_ref IS NOT NULL)));\n\n\n-- Committed purchase receipts, independent of marketing opt-in. Delivery retries\n-- use a stable receipt ID; no email is queued without a verified address.\nCREATE TABLE IF NOT EXISTS payment_receipts (\n  id TEXT PRIMARY KEY,\n  account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,\n  email TEXT NOT NULL,\n  kind TEXT NOT NULL CHECK (kind IN ('made','wire','watch')),\n  amount NUMERIC NOT NULL CHECK (amount >= 0),\n  duration_seconds INT NOT NULL CHECK (duration_seconds > 0),\n  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n  attempts INT NOT NULL DEFAULT 0,\n  first_attempt_at TIMESTAMPTZ,\n  abandoned_at TIMESTAMPTZ,\n  claimed_until TIMESTAMPTZ,\n  lease_id TEXT,\n  sent_at TIMESTAMPTZ\n);\nCREATE INDEX IF NOT EXISTS payment_receipts_due_idx ON payment_receipts(next_attempt_at) WHERE sent_at IS NULL;\n",
    "baseline": " account_id TEXT NOT NULL,key_hash TEXT NOT NULL CHECK(char_length(key_hash)=64),body_hash TEXT NOT NULL CHECK(char_length(body_hash)=64),run_id TEXT NOT NULL UNIQUE,\n receipt JSONB,account_ref TEXT REFERENCES accounts(id),actor_ref TEXT REFERENCES characters(id),PRIMARY KEY(account_id,key_hash),\n CHECK((receipt IS NULL AND account_ref IS NULL AND actor_ref IS NULL) OR(receipt IS NOT NULL AND account_ref=account_id AND account_ref IS NOT NULL AND actor_ref IS NOT NULL)));\n"
  }
];
const repo = fileURLToPath(new URL('../', import.meta.url));
const hash = input => crypto.createHash('sha256').update(input).digest('hex');
const key = row => `${row.table_name}.${row.name}`;
const sorted = rows => rows.map(row => JSON.stringify(row)).sort();
const same = (actual, expected, message) => assert.deepEqual(sorted(actual), sorted(expected), message);
const freeze = value => {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
};
const tables = new Set(RELEASE_PHASE2_TABLES);
const owned = name => { assert.match(name, /^release_phase2_ref_[a-f0-9]{16}$/); return name; };
const sourcePin = pin => {
  const target = `${pin.revision}:${pin.file ?? 'schema.sql'}`;
  assert.equal(execFileSync('git', ['rev-parse', target], { cwd: repo, encoding: 'utf8' }).trim(), pin.blob);
  const source = execFileSync('git', ['show', target], { cwd: repo, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
  assert.equal(hash(source), pin.sha256, 'Complete immutable native schema source matches its independent pin');
  return source;
};

let verifiedSources;
export function releasePhase2MigrationSources() {
  return verifiedSources ??= Object.freeze({ current: sourcePin(RELEASE_PHASE2_SOURCE), predecessor: sourcePin(RELEASE_PHASE2_PREDECESSOR) });
}
export function releasePhase2LegacySchema(profile, input) {
  assert(Object.hasOwn(LEGACY_PROFILES, profile), 'Only two exact caller-bound native legacy profiles exist');
  const pin = LEGACY_PROFILES[profile], full = sourcePin(pin);
  input ??= full;
  assert(input === full || input === full.replaceAll('\n', '\r\n'), 'Complete pinned legacy source required');
  const source = input.replaceAll('\r\n', '\n');
  if (!pin.boundary) return source;
  assert.equal(source.indexOf(pin.boundary), pin.prefixOffset);
  assert.equal(source.lastIndexOf(pin.boundary), pin.prefixOffset);
  const prefix = source.slice(0, pin.prefixOffset);
  assert.equal(Buffer.byteLength(prefix), pin.prefixBytes); assert.equal(hash(prefix), pin.prefixSha256);
  return prefix;
}
function resetTableDdl(input) {
  const reviewed = sourcePin(RESET_SOURCE);
  const actual = fs.readFileSync(new URL('../src/db.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  assert.equal(actual, reviewed, 'Actual runtime db source retains complete canonical C2 pin');
  input ??= reviewed;
  assert.equal(input, reviewed, 'Only complete frozen C2 runtime source binds reset-table DDL');
  assert.equal(reviewed.split('await q.query(`' + RESET_DDL + '`);').length - 1, 1, 'Exact runtime reset-table DDL occurs once');
  return RESET_DDL;
}
export function releasePhase2MigrationPredecessor(input) {
  const sources = releasePhase2MigrationSources();
  assert.equal(typeof input, 'string');
  assert(input === sources.current || input === sources.current.replaceAll('\n', '\r\n'),
    'Only complete frozen C2 LF or CRLF source enters this separate native adapter');
  let reconstructed = input.replaceAll('\r\n', '\n');
  assert.equal(INVERSES.length, 3);
  for (const inverse of INVERSES) {
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, 'Exact release inverse block occurs once');
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, sources.predecessor, 'All three closed C2 blocks reconstruct the entire exact predecessor');
  assert.equal(sources.current.split('\n').length - reconstructed.split('\n').length, 92);
  return reconstructed;
}

// Full schema inventory: there are no existing-table/nullable-column/index exclusions.
// Only generated self-schema identifiers are canonicalized; external FK targets survive.
export async function readReleasePhase2Metadata(pool) {
  const context = (await pool.query('SELECT current_schema() AS schema,current_database() AS database,current_user AS role')).rows[0];
  assert.match(context.schema, /^(?:release_phase2_ref_[a-f0-9]{16}|p2_definitions_[a-f0-9]{32}|director_migration_[a-f0-9]{16})$/);
  const relations = (await pool.query(`SELECT c.relname::text AS name,c.relkind::text AS kind,c.relpersistence::text AS persistence
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname=current_schema() AND c.relkind IN ('r','p','v','m','f','S') ORDER BY c.relname`)).rows;
  const constraints = (await pool.query(`SELECT t.relname::text AS table_name,c.conname::text AS name,c.contype::text AS type,
    c.convalidated AS validated,c.condeferrable AS deferrable,c.condeferred AS deferred,
    pg_get_constraintdef(c.oid,true) AS definition,c.confmatchtype::text AS match_type,
    c.confupdtype::text AS update_action,c.confdeltype::text AS delete_action,
    CASE WHEN rn.nspname=current_schema() THEN '$self' ELSE rn.nspname END::text AS referenced_schema,
    rt.relname::text AS referenced_table,
    ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=t.oid AND a.attnum=k.num ORDER BY k.ord) AS columns,
    ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(num,ord)
      JOIN pg_attribute a ON a.attrelid=rt.oid AND a.attnum=k.num ORDER BY k.ord) AS referenced_columns
    FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    LEFT JOIN pg_class rt ON rt.oid=c.confrelid LEFT JOIN pg_namespace rn ON rn.oid=rt.relnamespace
    WHERE n.nspname=current_schema() ORDER BY t.relname,c.conname`)).rows;
  const columns = (await pool.query(`SELECT t.relname::text AS table_name,a.attname::text AS column_name,a.attnum AS ordinal,
    format_type(a.atttypid,a.atttypmod) AS type,a.atttypmod AS typmod,pg_get_expr(d.adbin,d.adrelid) AS default_expression,
    a.attnotnull AS not_null,a.attidentity::text AS identity,a.attgenerated::text AS generated,
    cn.nspname::text AS collation_schema,co.collname::text AS collation_name
    FROM pg_attribute a JOIN pg_class t ON t.oid=a.attrelid JOIN pg_namespace n ON n.oid=t.relnamespace
    LEFT JOIN pg_attrdef d ON d.adrelid=t.oid AND d.adnum=a.attnum LEFT JOIN pg_collation co ON co.oid=a.attcollation
    LEFT JOIN pg_namespace cn ON cn.oid=co.collnamespace
    WHERE n.nspname=current_schema() AND t.relkind IN ('r','p','v','m','f') AND a.attnum>0 AND NOT a.attisdropped
    ORDER BY t.relname,a.attnum`)).rows;
  const indexes = (await pool.query(`SELECT t.relname::text AS table_name,i.relname::text AS name,
    pg_get_indexdef(i.oid) AS definition,x.indisunique AS unique,x.indisprimary AS primary,
    x.indisvalid AS valid,x.indisready AS ready,x.indislive AS live,x.indnullsnotdistinct AS nulls_not_distinct,
    pg_get_expr(x.indpred,x.indrelid) AS predicate
    FROM pg_index x JOIN pg_class i ON i.oid=x.indexrelid JOIN pg_class t ON t.oid=x.indrelid
    JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname=current_schema() ORDER BY t.relname,i.relname`)).rows.map(row => {
    const prefix = ` ON ${context.schema}.`;
    assert.equal(row.definition.split(prefix).length - 1, 1, 'Index has exactly its verified self-schema qualifier');
    return { ...row, definition: row.definition.replace(prefix, ' ON $self.') };
  });
  return { relations, constraints, columns, indexes };
}

async function compileReference(admin, endpoint, source, { runtimeReset = true, upgradeDdl = false } = {}) {
  const name = owned('release_phase2_ref_' + crypto.randomBytes(8).toString('hex'));
  let created = false, client;
  try {
    assert.equal((await admin.query('SELECT nspname FROM pg_namespace WHERE nspname=$1', [name])).rows.length, 0);
    await admin.query(`CREATE SCHEMA ${name}`); created = true;
    const address = new URL(endpoint); address.searchParams.set('options',
      `-c search_path=${name} -c statement_timeout=30000 -c lock_timeout=5000 -c idle_in_transaction_session_timeout=30000`);
    client = new pg.Client({ connectionString: address.toString() }); await client.connect();
    const settings = (await client.query(`SELECT current_schema() AS schema,current_database() AS database,current_user AS role,
      current_setting('statement_timeout') AS timeout,current_setting('lock_timeout') AS lock_timeout`)).rows[0];
    const parent = (await admin.query('SELECT current_database() AS database,current_user AS role')).rows[0];
    assert.equal(settings.schema, name); assert.equal(settings.database, parent.database); assert.equal(settings.role, parent.role);
    assert.equal(settings.timeout, '30s'); assert.equal(settings.lock_timeout, '5s');
    await client.query(source);
    if (upgradeDdl) await client.query(releasePhase2MigrationSources().current);
    if (runtimeReset) await client.query(resetTableDdl());
    return await readReleasePhase2Metadata(client);
  } finally {
    if (client) await client.end();
    if (created) {
      assert.equal((await admin.query('SELECT nspowner=current_user::regrole AS mine FROM pg_namespace WHERE nspname=$1', [name])).rows[0]?.mine, true);
      await admin.query(`DROP SCHEMA ${owned(name)} CASCADE`);
    }
  }
}

export async function createReleasePhase2MigrationCatalog(pool, endpoint, source, { includeNotNull, legacyProfile } = {}) {
  assert.equal(typeof includeNotNull, 'boolean');
  assert(Object.hasOwn(LEGACY_PROFILES, legacyProfile), 'Closed native caller profile required');
  const callerSchema = (await pool.query('SELECT current_schema() AS schema')).rows[0].schema;
  const main = String(process.argv[1]).replaceAll('\\', '/');
  if (legacyProfile === 'phase2') {
    assert(main.endsWith('/test/phase2-postgres.js') && process.argv[2] === '--definitions'
      && process.env.P2_TEST_CHILD === 'upgrade' && process.env.P2_TEST_SCHEMA === callerSchema);
    assert.match(callerSchema, /^p2_definitions_[a-f0-9]{32}$/); assert.equal(includeNotNull, true);
  } else {
    assert(main.endsWith('/test/director-migration.js')); assert.match(callerSchema, /^director_migration_[a-f0-9]{16}$/);
    assert.equal(includeNotNull, false);
  }
  const address = new URL(endpoint);
  assert(['postgres:', 'postgresql:'].includes(address.protocol) && ['127.0.0.1','localhost','[::1]'].includes(address.hostname));
  assert(['/omerta_check','/omerta_query'].includes(address.pathname) && !address.search && !address.hash);
  const predecessorSource = releasePhase2MigrationPredecessor(source), sources = releasePhase2MigrationSources();
  await verifyCombinedNativeBranches(pool, address);
  const freshCurrent = await compileReference(pool, address, sources.current);
  const predecessor = await compileReference(pool, address, sources.predecessor);
  same(freshCurrent.relations.filter(row => !tables.has(row.name)), predecessor.relations, 'All prior relations remain unchanged');
  same(freshCurrent.relations.filter(row => tables.has(row.name)).map(row => row.name), RELEASE_PHASE2_TABLES, 'Exactly seven added tables');
  same(freshCurrent.columns.filter(row => !tables.has(row.table_name)), predecessor.columns, 'Every prior typed column remains unchanged');
  same(freshCurrent.constraints.filter(row => !tables.has(row.table_name)), predecessor.constraints, 'Every prior native constraint remains unchanged');
  const priorIndexKeys = new Set(predecessor.indexes.map(key));
  const addedIndexes = freshCurrent.indexes.filter(row => !priorIndexKeys.has(key(row)));
  same(addedIndexes.map(key), ADDED_INDEX_KEYS, 'Exactly fifteen closed index additions including constraint-backed and two cursor indexes');
  same(freshCurrent.indexes.filter(row => priorIndexKeys.has(key(row))), predecessor.indexes, 'All prior index metadata remains unchanged');
  const legacy = await compileReference(pool, address, releasePhase2LegacySchema(legacyProfile), { runtimeReset: false, upgradeDdl: true });
  const columnKey = row => `${row.table_name}.${row.column_name}`;
  const currentColumns = new Map(freshCurrent.columns.map(row => [columnKey(row), row]));
  const oldColumns = new Map(legacy.columns.map(row => [columnKey(row), row]));
  for (const identity of oldColumns.keys()) assert(currentColumns.has(identity), 'No ambiguous or undeclared predecessor column can disappear');
  const next = new Map();
  for (const column of legacy.columns) next.set(column.table_name, Math.max(next.get(column.table_name) ?? 0, column.ordinal));
  const columns = freshCurrent.columns.map(column => {
    const old = oldColumns.get(columnKey(column));
    const ordinal = old ? old.ordinal : (next.get(column.table_name) ?? 0) + 1;
    if (!old) next.set(column.table_name, ordinal);
    return { ...column, ordinal };
  });
  const ordinalBindings = columns.filter(column => column.ordinal !== currentColumns.get(columnKey(column)).ordinal);
  same(ordinalBindings.map(column => ({ key: columnKey(column), fresh: currentColumns.get(columnKey(column)).ordinal, upgraded: column.ordinal })),
    LEGACY_ORDINAL_BINDINGS[legacyProfile], 'Exact independently compiled legacy remap identities and positions remain closed');
  assert.equal(ordinalBindings.length, legacyProfile === 'phase2' ? 15 : 30);
  const current = freeze({ ...freshCurrent, columns });
  const addedColumns = current.columns.filter(row => tables.has(row.table_name));
  const addedConstraints = current.constraints.filter(row => tables.has(row.table_name));
  const version = Number((await pool.query("SELECT current_setting('server_version_num') AS version")).rows[0].version);
  assert(version >= 160000 && version < 170000 || version >= 180000 && version < 190000, 'Only native PostgreSQL16/18 is qualified here');
  assert.equal(addedColumns.length, 60); assert.equal(addedColumns.filter(row => row.not_null).length, 48);
  assert.equal(addedConstraints.length, version >= 180000 ? 70 : 22);
  assert.equal(addedConstraints.filter(row => row.type === 'n').length, version >= 180000 ? 48 : 0);
  const canonical = Object.fromEntries(['relations','constraints','columns','indexes'].map(field => [field, sorted(current[field])]));
  const verifyMetadata = actual => {
    for (const field of ['relations','constraints','columns','indexes']) if (actual[field] !== current[field])
      assert.deepEqual(sorted(actual[field]), canonical[field], `Complete actual C2 ${field}: no unknown, missing, altered or duplicate objects`);
  };
  const actualMetadata = await readReleasePhase2Metadata(pool);
  try { verifyMetadata(actualMetadata); }
  catch (error) {
    const delta = {};
    for (const field of Object.keys(canonical)) {
      const expectedRows = new Set(canonical[field]), actualRows = new Set(sorted(actualMetadata[field]));
      const unexpected = [...actualRows].filter(row => !expectedRows.has(row)), missing = [...expectedRows].filter(row => !actualRows.has(row));
      if (unexpected.length || missing.length) {
        const identity = row => field === 'columns' ? `${row.table_name}.${row.column_name}` : field === 'relations' ? row.name : key(row);
        const prior = new Map(current[field].map(row => [identity(row),row]));
        const changes = actualMetadata[field].flatMap(row => {
          const expected = prior.get(identity(row));
          if (!expected) return [];
          const properties = Object.keys(row).filter(property => JSON.stringify(row[property]) !== JSON.stringify(expected[property]));
          return properties.length ? [{ key: identity(row), properties }] : [];
        });
        delta[field] = { unexpectedCount: unexpected.length, missingCount: missing.length, changes,
          unexpected: unexpected.slice(0, 8).map(JSON.parse), missing: missing.slice(0, 8).map(JSON.parse) };
      }
    }
    console.error('release Phase2 initial complete metadata mismatch: ' + JSON.stringify(delta));
    throw error;
  }
  const expectedRows = addedConstraints.filter(row => includeNotNull || row.type !== 'n')
    .map(({ table_name, name, definition }) => ({ table_name, name, definition }));
  const removed = new Set(expectedRows.map(key));
  const normalize = rows => {
    same(rows.filter(row => tables.has(row.table_name)), expectedRows,
      'Every native projection rechecks the complete exact release constraint multiset');
    return rows.filter(row => !removed.has(key(row)));
  };
  return { predecessorSource, normalize, verifyMetadata, reference: current, addedColumns, addedConstraints, addedIndexes,
    source: RELEASE_PHASE2_SOURCE, predecessor: RELEASE_PHASE2_PREDECESSOR, includeNotNull, legacyProfile, ordinalBindings, endpoint: address.href };
}

export async function verifyReleasePhase2CausalNegatives(pool, catalog, rows, verifyRows) {
  let negatives = 0;
  const rejected = (fn, message) => { assert.throws(fn, error => error?.code === 'ERR_ASSERTION', message); negatives++; };
  const sources = releasePhase2MigrationSources();
  assert.equal(releasePhase2MigrationPredecessor(sources.current.replaceAll('\n', '\r\n')), sources.predecessor);
  for (const altered of [sources.current + '\n', sources.current.replace('\n', '\r\n'), sources.predecessor,
    '\ufeff' + sources.current, sources.current.replace('street_deed_supply', 'unreviewed_supply'),
    sources.current.replace('sent_at IS NULL', 'sent_at IS NOT NULL')])
    rejected(() => releasePhase2MigrationPredecessor(altered), 'Unknown/mixed/reordered source cannot gain native admission');
  rejected(() => releasePhase2LegacySchema('unreviewed'), 'Unknown legacy profile rejected');
  for (const legacyProfile of ['unreviewed', catalog.legacyProfile === 'phase2' ? 'director' : 'phase2']) {
    await assert.rejects(() => createReleasePhase2MigrationCatalog(pool, catalog.endpoint, sources.current,
      { legacyProfile, includeNotNull: legacyProfile === 'phase2' }), error => error?.code === 'ERR_ASSERTION'); negatives++;
  }
  for (const profile of Object.keys(LEGACY_PROFILES)) {
    const full = sourcePin(LEGACY_PROFILES[profile]);
    releasePhase2LegacySchema(profile, full.replaceAll('\n', '\r\n'));
    const crossed = sourcePin(LEGACY_PROFILES[profile === 'phase2' ? 'director' : 'phase2']);
    for (const altered of [full + '\n', full.replace('\n','\r\n'), full.replace('accounts', 'unreviewed_accounts'), sources.current, crossed])
      rejected(() => releasePhase2LegacySchema(profile, altered), 'Full legacy source/prefix binding rejects drift');
  }
  rejected(() => resetTableDdl(sourcePin(RESET_SOURCE) + '\n'), 'Unknown runtime DDL source rejected');
  for (const column of catalog.ordinalBindings) {
    const changed = { ...catalog.reference, columns: catalog.reference.columns.map(row => row.table_name === column.table_name
      && row.column_name === column.column_name ? { ...row, ordinal: row.ordinal + 1 } : row) };
    rejected(() => catalog.verifyMetadata(changed), 'Every independently derived predecessor ordinal rejects drift');
  }
  for (const row of rows.filter(row => tables.has(row.table_name))) {
    const index = rows.findIndex(candidate => key(candidate) === key(row));
    for (const change of [(copy) => copy.splice(index, 1), (copy) => copy.push({ ...row }),
      (copy) => { copy[index].definition += ' altered'; }, (copy) => { copy[index].name += '__unknown'; }]) {
      const copy = rows.map(candidate => ({ ...candidate })); change(copy);
      rejected(() => verifyRows(copy), 'Each added constraint removal/duplicate/alteration/rename fails the original composed oracle');
    }
  }
  for (const table_name of [...RELEASE_PHASE2_TABLES,'notifications','unreviewed_release_table'])
    rejected(() => verifyRows([...rows,{ table_name,name:'unreviewed_release_constraint',definition:'CHECK (true)' }]), 'Unknown constraint addition is rejected');
  for (const field of ['relations','columns','constraints','indexes']) {
    const original = catalog.reference[field];
    for (let index = 0; index < original.length; index++) {
      const row = original[index];
      const isAdded = tables.has(row.table_name ?? row.name) || (row.table_name ?? row.name) === 'player_reset_migrations'
        || field === 'indexes' && ADDED_INDEX_KEYS.includes(key(row));
      // Full attestation covers all objects. Exercise every added row and one prior witness per class.
      if (!isAdded && index !== 0) continue;
      const missing = { ...catalog.reference, [field]: [...original] }; missing[field].splice(index, 1);
      rejected(() => catalog.verifyMetadata(missing), `${field} removal rejected`);
      for (const property of Object.keys(row)) {
        const changed = { ...catalog.reference, [field]: [...original] }, value = row[property];
        changed[field][index] = { ...row };
        changed[field][index][property] = typeof value === 'boolean' ? !value : typeof value === 'number' ? value + 1
          : Array.isArray(value) ? [...value,'unknown'] : value === null ? 'unknown' : value + '__unknown';
        rejected(() => catalog.verifyMetadata(changed), `Exact ${field}.${property} alteration rejected`);
      }
    }
    const duplicate = { ...catalog.reference, [field]: [...original,{ ...original[0] }] };
    rejected(() => catalog.verifyMetadata(duplicate), 'Duplicate catalog row rejected');
    const unknown = { ...catalog.reference, [field]: [...original,{ ...original[0], name:'unknown_release_object',table_name:'unknown_release_table' }] };
    rejected(() => catalog.verifyMetadata(unknown), 'Unknown catalog row rejected');
  }
  // Actual transactional DDL exercises the native reader; rollback restores the same full catalog.
  const foreign = owned('release_phase2_ref_' + crypto.randomBytes(8).toString('hex'));
  const cases = [
    ['ALTER TABLE street_deed_supply DROP CONSTRAINT street_deed_supply_issued_check'],
    ['ALTER TABLE payment_receipts DROP CONSTRAINT payment_receipts_amount_check', 'ALTER TABLE payment_receipts ADD CONSTRAINT payment_receipts_amount_check CHECK (amount >= 0) NOT VALID'],
    ['ALTER TABLE agent_gateway_connections ALTER CONSTRAINT agent_gateway_connections_account_id_fkey DEFERRABLE INITIALLY DEFERRED'],
    ['ALTER TABLE payment_receipts ALTER COLUMN amount TYPE numeric(18,2)'],
    ['ALTER TABLE payment_receipts ALTER COLUMN email DROP NOT NULL'],
    ['ALTER TABLE street_deed_supply ALTER COLUMN issued SET DEFAULT 1'],
    ['ALTER TABLE notifications ADD COLUMN unreviewed_release_column text'],
    ['DROP INDEX ix_agent_gateway_connections_account'],
    ['CREATE INDEX unreviewed_release_index ON notifications (created_at)'],
    ['DROP INDEX payment_receipts_due_idx', 'CREATE INDEX payment_receipts_due_idx ON payment_receipts(next_attempt_at) WHERE sent_at IS NOT NULL'],
    ['CREATE TABLE unreviewed_release_table (nullable_column text)'],
    ['ALTER TABLE notifications ADD CONSTRAINT unreviewed_release_constraint CHECK (character_id IS NOT NULL)'],
    [`CREATE SCHEMA ${foreign}`, `CREATE TABLE ${foreign}.accounts (id text PRIMARY KEY)`,
      'ALTER TABLE agent_gateway_connections DROP CONSTRAINT agent_gateway_connections_account_id_fkey',
      `ALTER TABLE agent_gateway_connections ADD CONSTRAINT agent_gateway_connections_account_id_fkey FOREIGN KEY(account_id) REFERENCES ${foreign}.accounts(id)`],
  ];
  const client = await pool.connect();
  try {
    for (const statements of cases) {
      await client.query('BEGIN');
      try {
        for (const statement of statements) await client.query(statement);
        const changed = await readReleasePhase2Metadata(client);
        if (statements[0] === `CREATE SCHEMA ${foreign}`) {
          const target = changed.constraints.find(row => row.table_name === 'agent_gateway_connections'
            && row.name === 'agent_gateway_connections_account_id_fkey');
          assert.equal(target.validated, true, 'External FK namespace negative retains actual native validation');
          assert.equal(target.referenced_schema, foreign, 'Native reader exposes the changed FK namespace independently');
        }
        rejected(() => catalog.verifyMetadata(changed), 'Real transactional DDL reread is rejected');
      } finally { await client.query('ROLLBACK'); }
      catalog.verifyMetadata(await readReleasePhase2Metadata(client));
    }
  } finally { client.release(); }
  console.log(`release Phase2 native catalog: exact C2/fe4 three-block source, 7 tables/60 columns/${catalog.addedConstraints.length} constraints/15 indexes; ${negatives} causal controls including ${cases.length} real transactional DDL rereads PASS`);
  return negatives;
}

const COMBINED_BRANCH_PINS = Object.freeze({"current":{"revision":"9540d9aa21905229f9101b950ea4dd21ed6e648e","file":"schema.sql","blob":"328f92083c8c9b9a94e3da103efbda1750cc2bed","sha256":"03aecb8a4a997b22732e2a5190fec2dcef3acda8a2744e4369b59cd4228f85db"},"iv":{"revision":"0c72a29748df6b1c6955ebcb648efe5f20fec6a1","file":"schema.sql","blob":"94fa33fea977d185870a108f23b3c06db17095e2","sha256":"c24abb3e7a3863dabeecbb683671a12e95c447918a2b385b38cc36691fbb9dc9"},"main":{"revision":"b90bd95dee6e0fda851247cc660288f4bbf8fdc0","file":"schema.sql","blob":"1210ad5ecb4d2417ac1c195c2359177671839e33","sha256":"29b33ee417443a32b5c3a8b73dc5d7f27b518ed66f746e343da530c1768b9d42"},"common":{"revision":"fe4a75a8b21fc41fd3d3bc75cf7720612c581463","file":"schema.sql","blob":"9d613ef4cef422ddf11995b42afad1a2a4ebb4c3","sha256":"9eead996764ec9b0a7211cb28eefb3588e1f2e100d28cd28e05a39f340e558dd"},"catalog":{"revision":"0c72a29748df6b1c6955ebcb648efe5f20fec6a1","file":"test/lib/phase2-architecture-upgrade-catalog.json","blob":"614fb4e55170737c2e7fc479fb1c3854903e35af","sha256":"15183087db6e3b3436e63da45cc60f2a24740bd22f9ca8f122cf9b497aa9dff3"},"hunks":3,"deltaLines":92});
const COMBINED_IV_TABLES=Object.freeze(["company_restructuring_plans","company_restructuring_requests","commercial_disputes","commercial_dispute_requests","equipment_insurance_policies","equipment_insurance_requests","equipment_insurance_claims","infrastructure_concessions","infrastructure_concession_requests","territory_economics_profiles","territory_economics_requests","territory_economics_payments","territory_economics_sources"]);
// Independent branch comparison supplements, never replaces, the old main proof.
export async function verifyCombinedNativeBranches(pool, endpoint) {
  const address = new URL(endpoint);
  assert(['postgres:', 'postgresql:'].includes(address.protocol) && address.hostname === '127.0.0.1' && !address.search && !address.hash);
  assert(['/omerta_check','/omerta_query'].includes(address.pathname) || /^\/combined_native_catalog_test_[a-f0-9]{12}$/.test(address.pathname));
  const local = ['35439','35449'].includes(address.port) && address.username === 'pilot_runner' && !address.password;
  const ci = address.port === '5432' && address.username === 'postgres' && address.password === 'pgcheck'; assert(local || ci);
  const settings = (await pool.query("SELECT current_user AS role,current_database() AS database,current_setting('server_version') AS version")).rows[0];
  assert.equal(settings.role,address.username); assert.equal('/'+settings.database,address.pathname); assert.match(settings.version,local?/^18\.4\b/:/^(?:16\b|18\.4\b)/);
  const pins = COMBINED_BRANCH_PINS;
  // Compile and retire each owned reference sequentially; full schemas consume many locks.
  const current = await compileReference(pool, endpoint, sourcePin(pins.current));
  const iv = await compileReference(pool, endpoint, sourcePin(pins.iv));
  const main = await compileReference(pool, endpoint, sourcePin(pins.main));
  const common = await compileReference(pool, endpoint, sourcePin(pins.common));
  const ivNames = new Set(COMBINED_IV_TABLES), mainNames = new Set(RELEASE_PHASE2_TABLES);
  const name = (field, row) => field === 'relations' ? row.name : row.table_name;
  const belongs = (names, field, row) => field === 'indexes' && names === mainNames ? ADDED_INDEX_KEYS.includes(key(row)) : names.has(name(field, row));
  const without = (metadata, names, field) => metadata[field].filter(row => !belongs(names, field, row));
  const only = (metadata, names, field) => metadata[field].filter(row => belongs(names, field, row));
  for (const field of ['relations', 'columns', 'constraints', 'indexes']) {
    same(without(iv, ivNames, field), common[field], `IV retains every common ${field}`);
    same(without(main, mainNames, field), common[field], `Main retains every common ${field}`);
    same(without(current, mainNames, field), iv[field], `Combined retains complete IV ${field}`);
    same(without(current, ivNames, field), main[field], `Combined retains complete main ${field}`);
    same(only(current, ivNames, field), only(iv, ivNames, field), `All IV additions preserve exact ${field}`);
    same(only(current, mainNames, field), only(main, mainNames, field), `All main additions preserve exact ${field}`);
  }
  same(only(iv, ivNames, 'relations').map(row => row.name), COMBINED_IV_TABLES, 'Exactly thirteen IV tables');
  same(only(main, mainNames, 'relations').map(row => row.name), RELEASE_PHASE2_TABLES, 'Exactly seven main tables');
  same(only(main, mainNames, 'indexes').map(key), ADDED_INDEX_KEYS, 'All fifteen main index additions include two existing-table cursors');
  assert.equal(only(main, mainNames, 'columns').length,60);
  assert.equal(only(main, mainNames, 'columns').filter(row=>row.not_null).length,48);
  const catalog = JSON.parse(sourcePin(pins.catalog));
  const ivConstraints = only(iv, ivNames, 'constraints').filter(row => row.type !== 'n')
    .map(({ table_name, name, definition }) => ({ table_name, name, definition }));
  const expected = catalog.added.filter(row => ivNames.has(row.table_name));
  assert.equal(expected.length, 132); same(ivConstraints, expected, 'All132 frozen IV constraints remain exact');
  let required = 0;
  for (const table of COMBINED_IV_TABLES) {
    const columns = catalog.notNullColumns[table]; assert(Array.isArray(columns)); required += columns.length;
    same(iv.columns.filter(row => row.table_name === table && row.not_null).map(row => row.column_name), columns,
      `All original IV NOT NULL columns remain exact: ${table}`);
  }
  assert.equal(required, 114);
  const verify = metadata => {
    for (const field of ['relations', 'columns', 'constraints', 'indexes']) same(metadata[field], current[field], `Complete combined ${field}`);
  };
  // Every added table in both branches receives full-field remove/change/unknown controls.
  let causal = 0;
  for (const table of [...COMBINED_IV_TABLES, ...RELEASE_PHASE2_TABLES]) {
    for (const field of ['relations', 'columns', 'constraints', 'indexes']) {
      const row = current[field].find(row => name(field, row) === table); assert(row, `${table} has native ${field}`);
      const removed = { ...current, [field]: current[field].filter(value => value !== row) };
      assert.throws(() => verify(removed), error => error?.code === 'ERR_ASSERTION'); causal++;
      for (const property of Object.keys(row)) {
        const changed = { ...row, [property]: typeof row[property] === 'boolean' ? !row[property] : `${row[property]}_changed` };
        assert.throws(() => verify({ ...current, [field]: current[field].map(value => value === row ? changed : value) }), error => error?.code === 'ERR_ASSERTION'); causal++;
      }
      assert.throws(() => verify({ ...current, [field]: [...current[field], { ...row, unexpected: true }] }), error => error?.code === 'ERR_ASSERTION'); causal++;
    }
  }
  return { current, iv, main, common, causal, verify, phase: 'independent native branch/catalog proof; no runtime/deployment clearance' };
}
