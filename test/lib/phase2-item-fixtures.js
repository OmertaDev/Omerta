import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { database, compileFixture, materialSource, snapshotPhase2, forwardPool } from './phase2-definition-fixtures.js';
import { storeSealedBundle } from '../../src/content/artifacts.js';
import { definitionByHash } from '../../src/itemdefinitions.js';

export async function withItemFixture(callback, existingPool = null) {
  const pool = existingPool || (await database()).pool;
  try {
    const artifact = compileFixture(materialSource());
    await storeSealedBundle(pool, artifact.request);
    const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const accountOwner = { scope: 'account', id: randomUUID() };
    await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,$2,$3)',
      [accountOwner.id, 'guest', accountOwner.id]);
    const snapshot = async () => {
      const { withItemRead } = await import('../../src/items.js');
      return withItemRead(pool, async (q) => {
        const result = await snapshotPhase2(q);
        for (const [table, order] of [['item_mutation_guards', 'idempotency_key'], ['item_stacks', 'owner_scope,owner_id,template_id,quality'],
          ['item_instances', 'id'], ['operation_escrow', 'item_id'], ['item_events', 'sequence']]) {
          result[table] = JSON.parse(JSON.stringify((await q.query(`SELECT * FROM ${table} ORDER BY ${order}`)).rows));
        }
        return result;
      });
    };
    return await callback({ pool, accountOwner, definition, snapshot });
  } finally { if (!existingPool) await pool.end(); }
}

// Forward all real SQL. The fault can land on either side of the actual write acknowledgement.
export function injectSqlFailure(pool, { table, occurrence, timing }) {
  assert(['item_mutation_guards', 'item_events', 'item_stacks', 'item_instances', 'transactions'].includes(table));
  assert(Number.isSafeInteger(occurrence) && occurrence > 0);
  assert(['before', 'after'].includes(timing));
  let count = 0, enabled = true;
  const forwarded = forwardPool(pool, { [timing]: async (sql) => {
    if (enabled && sql.startsWith(`INSERT INTO ${table} `) && ++count === occurrence) {
      throw Object.assign(Error('injected item write failure'), { code: 'injected_failure' });
    }
  } });
  return { pool: forwarded, restore() { enabled = false; } };
}

export function lotRequest(owner, definition, overrides = {}) {
  return { actorAccountId: owner.id, actionKind: 'craft', idempotencyKey: randomUUID(), owner,
    request: { input: { recipe: 'fixture' }, authority: { issuedActionId: 'issued-1',
      aggregate: { kind: 'recipe', id: 'fixture' }, resolvedOwner: { ...owner },
      bundleHash: 'a'.repeat(64), namespace: 'omerta.phase2.fixture', activationRevision: 1,
      eventId: '1', inputDefinitionHashes: [definition.definitionHash],
      outputDefinitionHashes: [definition.definitionHash] } }, ...overrides };
}

// Literal pre-4.1 guard DDL from dispatch c80d6794. Never derive this fixture from CURRENT schema:
// doing so would silently turn an upgrade rehearsal into a second clean-schema test.
const PRE_41_GUARDS = `CREATE TABLE item_mutation_guards (
  idempotency_key TEXT PRIMARY KEY, mutation_kind TEXT NOT NULL, owner_scope TEXT NOT NULL,
  owner_id TEXT NOT NULL, request_hash TEXT NOT NULL, reservation_id TEXT NOT NULL, result_json TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
  CONSTRAINT item_guard_key CHECK (char_length(idempotency_key) BETWEEN 1 AND 200),
  CONSTRAINT item_guard_kind CHECK (mutation_kind IN (
    'grant_stack','consume_stack','create_item','transfer_item','consume_item','escrow_item','release_escrow',
    'assign_current_character','craft','salvage_car','mystery_action','operation_action','reward_claim')),
  CONSTRAINT item_guard_owner_scope CHECK (owner_scope IN ('character','account','operation')),
  CONSTRAINT item_guard_owner_id CHECK (char_length(owner_id) BETWEEN 1 AND 200),
  CONSTRAINT item_guard_request_hash CHECK (char_length(request_hash) = 64),
  CONSTRAINT item_guard_reservation_id CHECK (char_length(reservation_id) BETWEEN 1 AND 200),
  CONSTRAINT item_guard_completion CHECK ((result_json IS NULL AND completed_at IS NULL)
    OR (result_json IS NOT NULL AND completed_at IS NOT NULL))
);
CREATE INDEX ix_item_mutation_guards_created ON item_mutation_guards (created_at);`;

export async function seedPre41ItemGuards(q) {
  await q.query(PRE_41_GUARDS);
  const owner = { scope: 'account', id: 'historical-owner' };
  const request = { recipeId: 'historical-recipe', quantity: 4 };
  const key = 'historical:raw:guard-key';
  const resultJson = '{"output":{"id":"historical-unique"},"delta":1}';
  const hash = createHash('sha256').update(JSON.stringify({ kind: 'craft', owner, request })).digest('hex');
  await q.query(`INSERT INTO item_mutation_guards
    (idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,reservation_id,result_json,created_at,completed_at)
    VALUES ($1,'craft',$2,$3,$4,'historical-reservation',$5,'2026-01-02T03:04:05Z','2026-01-02T03:04:06Z')`,
  [key, owner.scope, owner.id, hash, resultJson]);
  await q.query(`INSERT INTO item_mutation_guards
    (idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,reservation_id,created_at)
    VALUES ('historical:incomplete','craft',$1,$2,$3,'historical-incomplete-reservation','2026-01-02T03:04:05Z')`,
  [owner.scope, owner.id, hash]);
  const rows = (await q.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key')).rows;
  assert.equal(Object.hasOwn(rows[0], 'envelope_version'), false, 'upgrade fixture really predates envelope columns');
  await assert.rejects(() => q.query('SELECT mutation_id FROM item_mutation_guards'), /mutation_id/,
    'pre-migration UUID read must fail; current DDL is not a pre-4.1 fixture');
  console.log('phase2-lot-boundary: upgrade precondition — populated old guard DDL has no envelope/UUID columns');
  return { owner, request, key, resultJson, hash, rows };
}

export async function verifyPre41ItemGuardUpgrade(q, fixture) {
  const { withItemTransaction, withItemMutation } = await import('../../src/items.js');
  const rows = (await q.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key')).rows;
  assert.equal(rows.length, fixture.rows.length);
  for (let i = 0; i < rows.length; i++) {
    assert.deepEqual(Object.fromEntries(Object.keys(fixture.rows[i]).map((key) => [key, rows[i][key]])), fixture.rows[i],
      'migration preserves every old raw guard field, including digest, result bytes and timestamps');
    assert.equal(rows[i].envelope_version, 1); assert.equal(rows[i].mutation_id, null);
    assert.equal(rows[i].request_json, null); assert.equal(rows[i].actor_account_id, null); assert.equal(rows[i].external_key, null);
  }
  let entered = 0;
  const result = await withItemTransaction(q, (client) => withItemMutation(client, fixture.owner, 'craft', fixture.key,
    { ...fixture.request, itemAuthority: { destinations: 'original actor unavailable' } }, async () => { entered++; return false; }));
  assert.equal(entered, 0); assert.deepEqual(result, JSON.parse(fixture.resultJson));
  assert.deepEqual((await q.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key')).rows, rows);
  assert.equal(Number((await q.query('SELECT COUNT(*) AS n FROM item_events')).rows[0].n), 0);
  // A missing v2 UUID must fail at the durable SQL boundary, regardless of application validation.
  await assert.rejects(() => q.query(`INSERT INTO item_mutation_guards
    (idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,reservation_id,envelope_version,
     mutation_id,actor_account_id,external_key,request_json)
    VALUES ('null-v2','craft','account','owner',$1,'null-v2-reservation',2,NULL,'actor','external','{}')`, [fixture.hash]),
  /item_guard_envelope/, 'null UUID v2 receipt must violate the durable envelope constraint');
  assert.deepEqual((await q.query('SELECT * FROM item_mutation_guards ORDER BY idempotency_key')).rows, rows);
}
