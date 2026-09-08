import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { database, compileFixture, materialSource, snapshotPhase2, forwardPool } from './phase2-definition-fixtures.js';
import { storeSealedBundle } from '../../src/content/artifacts.js';
import { definitionByHash } from '../../src/itemdefinitions.js';
import { types } from 'node:util';
import { GameError } from '../../src/game.js';

const DORMANT_POLICIES = Object.freeze({
  fixed: Object.freeze({ mode: 'fixed', band: 'Pristine Ω', numeric: null }),
  categorical: Object.freeze({ mode: 'bounded', band: 'categorical', numeric: null }),
  numeric: Object.freeze({ mode: 'bounded', band: 'fine', numeric: 37 }),
  invalidNumeric: Object.freeze({ mode: 'bounded', band: 'fine', numeric: 101 }),
});
export async function prepareDormantOperationFixture(fixture) {
  const account = fixture.permissions.actorAccountId, suffix = randomUUID();
  fixture.operation = Object.freeze({ id: `op-${suffix}`, crewId: `crew-${suffix}`, characterId: `actor-${suffix}` });
  const op = fixture.operation;
  await fixture.pool.query('INSERT INTO characters(id,account_id,name,season) VALUES ($1,$2,$1,1)', [op.characterId, account]);
  await fixture.pool.query('INSERT INTO crews(id,name,leader_account) VALUES ($1,$1,$2)', [op.crewId, account]);
  await fixture.pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES ($1,$2,$2)', [op.crewId, account]);
  await fixture.pool.query(`INSERT INTO world_operations
    (id,graph_id,graph_version,operation_node_id,crew_id,opened_by_account_id,status,activated_at)
    VALUES ($1,'dormant-exact-fixture',1,'op:exact',$2,$3,'active',now())`, [op.id, op.crewId, account]);
  await fixture.pool.query(`INSERT INTO world_operation_roles(operation_id,role_id,account_id,character_id)
    VALUES ($1,$2,$3,$4)`, [op.id, fixture.permissions.role, account, op.characterId]);
}
// Server-side issued descriptors are test data, never supplied by the closed client input below.
// Resolve that retained descriptor before entering fresh mutable permission checks, so completed
// receipts still replay after the actor, role, revision or current item state changes.
export async function runTrustedDormantItemAction(fixture, rawInput) {
  const reject = () => { throw new GameError('bad_item_request', 'Invalid dormant issued action.'); };
  if (!rawInput || typeof rawInput !== 'object' || types.isProxy(rawInput)
    || Reflect.ownKeys(rawInput).length !== 1) reject();
  const descriptor = Object.getOwnPropertyDescriptor(rawInput, 'issuedActionId');
  if (!descriptor || !Object.hasOwn(descriptor, 'value') || typeof descriptor.value !== 'string') reject();
  const issued = fixture.issuedActions[descriptor.value];
  if (!issued || !Object.isFrozen(issued) || !Object.isFrozen(fixture.issuedActions)) reject();
  const { withItemTransaction, withLotMutation, itemMutationContext } = await import('../../src/items.js');
  const lots = await import('../../src/itemlots.js');
  const { createItemLockTrace, compareItemLockEntries } = await import('../../src/item-lock-trace.js');
  return withItemTransaction(fixture.pool, async (q) => {
    const trace = createItemLockTrace(), key = (className, subtype, id) => ({ className, subtype, key: id, id, generation: 0 });
    if (fixture.operation) {
      const op = fixture.operation;
      const crew = key('crew', 'crew', op.crewId); trace.admitCandidates('crew', [crew]); trace.record(crew);
      await q.query('SELECT * FROM crews WHERE id=$1 FOR UPDATE', [op.crewId]);
      const owners = [issued.request.owner, { scope: 'account', id: issued.request.actorAccountId },
        { scope: 'character', id: op.characterId }];
      for (const entry of issued.request.request.authority.itemTransitions ?? []) {
        owners.push(entry.subject.expected.owner);
        if (entry.depositor) owners.push(entry.depositor);
        if (entry.destination) owners.push(entry.destination);
      }
      const entries = [...new Map(owners.filter((owner) => owner.scope !== 'operation')
        .map((owner) => [`${owner.scope}:${owner.id}`, key(owner.scope, owner.scope, owner.id)])).values()].sort(compareItemLockEntries);
      for (const entry of entries) {
        trace.record(entry);
        await q.query(entry.className === 'account' ? 'SELECT * FROM accounts WHERE id=$1 FOR UPDATE'
          : 'SELECT * FROM characters WHERE id=$1 FOR UPDATE', [entry.id]);
      }
    } else {
      const actor = key('account', 'account', issued.request.actorAccountId); trace.record(actor);
      await q.query('SELECT * FROM accounts WHERE id=$1 FOR UPDATE', [actor.id]);
    }
    return withLotMutation(q, issued.request, async (mutation) => {
    const resolved = issued.request.owner;
    if (resolved.scope === 'operation' ? issued.kind !== 'split' || resolved.id !== fixture.operation?.id
      : resolved.scope === 'account' ? resolved.id !== issued.request.actorAccountId
        : resolved.id !== fixture.operation?.characterId) {
      throw new GameError('item_mutation_authority', 'Issued actor does not resolve to that owner.');
    }
    if (fixture.operation) {
      const op = fixture.operation, context = itemMutationContext(q, mutation);
      trace.record(key('guard', 'guard', context.key));
      trace.record(key('aggregate', 'operation', op.id));
      const row = (await q.query('SELECT * FROM world_operations WHERE id=$1 FOR UPDATE', [op.id])).rows[0];
      const role = (await q.query('SELECT * FROM world_operation_roles WHERE operation_id=$1 AND account_id=$2 FOR UPDATE',
        [op.id, issued.request.actorAccountId])).rows[0];
      const member = (await q.query('SELECT * FROM crew_members WHERE account_id=$1', [issued.request.actorAccountId])).rows[0];
      const actor = (await q.query('SELECT * FROM characters WHERE id=$1', [op.characterId])).rows[0];
      if (!row || row.status !== 'active' || row.graph_version !== issued.revision || row.crew_id !== op.crewId
        || !role || role.role_id !== issued.role || role.character_id !== op.characterId || member?.crew_id !== op.crewId
        || !actor?.alive || actor.account_id !== issued.request.actorAccountId
        || issued.request.request.authority.aggregate.id !== op.id) {
        throw new GameError('item_mutation_authority', 'Issued operation authority is unavailable.');
      }
    }
    if (fixture.permissions.actorAccountId !== issued.request.actorAccountId || !fixture.permissions.alive
      || fixture.permissions.role !== issued.role || fixture.permissions.revision !== issued.revision
      || !fixture.permissions.consent) throw new GameError('item_mutation_authority', 'Issued action is unavailable.');
    if (issued.kind === 'grant_unique') return lots.grantUnique(q, mutation, issued.definition, issued.output);
    if (issued.kind === 'grant_lot') return lots.grantLot(q, mutation, issued.definition, issued.output);
    if (issued.kind === 'transition' || issued.kind === 'split' || issued.kind === 'consume_lot') {
      return lots.withCompleteItemCandidates(q, mutation, trace, {
        root: { owner: issued.request.owner, authority: issued.request.request.authority }, requirements: issued.requirements,
      }, () => issued.kind === 'transition' ? lots.applyItemTransition(q, mutation, 0)
        : issued.kind === 'consume_lot' ? lots.consumeExactLot(q, mutation, issued.requirements[0].lotId, issued.requirements[0].quantity)
          : lots.splitLot(q, mutation, issued.requirements[0].lotId, issued.requirements[0].quantity, issued.custody));
    }
    reject();
    });
  });
}
export async function runTrustedDormantLotGrant(context, rawInput) {
  const reject = () => { throw new GameError('bad_item_request', 'Invalid dormant producer input.'); };
  if (!rawInput || typeof rawInput !== 'object' || types.isProxy(rawInput)
    || Reflect.ownKeys(rawInput).length !== 2) reject();
  const input = {};
  for (const key of ['policyId', 'quantity']) {
    const descriptor = Object.getOwnPropertyDescriptor(rawInput, key);
    if (!descriptor || !Object.hasOwn(descriptor, 'value')) reject();
    input[key] = descriptor.value;
  }
  if (typeof input.policyId !== 'string' || !Object.hasOwn(DORMANT_POLICIES, input.policyId)) reject();
  const policy = DORMANT_POLICIES[input.policyId];
  if (policy.numeric !== null && (!Number.isSafeInteger(policy.numeric) || policy.numeric < 0 || policy.numeric > 100)) reject();
  const tuple = Object.freeze({ qualityBand: policy.band, qualityStateDigest: policy.numeric === null ? null
    : createHash('sha256').update(JSON.stringify({ value: policy.numeric, maximum: 100 })).digest('hex') });
  const definition = await definitionByHash(context.client, context.definitions.get(policy.mode).definitionHash);
  const { grantLot } = await import('../../src/itemlots.js');
  return grantLot(context.client, context.mutation, definition, {
    logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
    owner: { ...context.owner }, custody: { state: 'direct', scope: null, id: null },
    ...tuple, tradePolicyHash: definition.definitionHash, binding: null, transferRestriction: null,
    seasonId: null, runId: null, sourceCapId: null, expiresAt: null, ageBasisAt: null,
    provenanceCoalescingClass: 'dormant-producer', quantity: input.quantity,
    provenanceClass: 'crafted', provenanceDigest: createHash('sha256').update(input.policyId).digest('hex'),
  });
}

export async function withItemFixture(callback, existingPool = null) {
  // Native runLots supplies a bounded per-block factory so its isolation matches pg-mem.
  // The factory owns allocation/disposal; no ambient database selection occurs here.
  const owned = typeof existingPool === 'function' ? await existingPool() : null;
  const pool = owned?.pool || existingPool || (await database()).pool;
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
          ['item_instances', 'id'], ['operation_escrow', 'item_id'], ['item_events', 'sequence'],
          ['item_lots', 'lot_id'], ['item_mutation_inputs', 'mutation_id,input_ordinal'],
          ['item_mutation_outputs', 'mutation_id,output_ordinal'], ['characters', 'id'], ['cars', 'id'], ['transactions', 'id'],
          ['world_operations', 'id'], ['world_operation_roles', 'operation_id,role_id'], ['crews', 'id'], ['crew_members', 'account_id']]) {
          result[table] = JSON.parse(JSON.stringify((await q.query(`SELECT * FROM ${table} ORDER BY ${order}`)).rows));
        }
        return result;
      });
    };
    return await callback({ pool, accountOwner, definition, snapshot });
  } finally { if (owned) await owned.dispose(); else if (!existingPool) await pool.end(); }
}

// Forward all real SQL. The fault can land on either side of the actual write acknowledgement.
export function injectSqlFailure(pool, { table, occurrence, timing, operation = 'INSERT' }) {
  assert(['item_mutation_guards', 'item_events', 'item_stacks', 'item_instances', 'transactions',
    'item_lots', 'item_mutation_inputs', 'item_mutation_outputs', 'operation_escrow'].includes(table));
  assert(['INSERT', 'UPDATE', 'DELETE'].includes(operation));
  assert(Number.isSafeInteger(occurrence) && occurrence > 0);
  assert(['before', 'after'].includes(timing));
  let count = 0, enabled = true;
  const forwarded = forwardPool(pool, { [timing]: async (sql) => {
    const prefix = operation === 'INSERT' ? `INSERT INTO ${table} ` : operation === 'DELETE' ? `DELETE FROM ${table} ` : `UPDATE ${table} `;
    if (enabled && sql.startsWith(prefix) && ++count === occurrence) {
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
