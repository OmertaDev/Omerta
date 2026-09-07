import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import * as items from '../src/items.js';
import { dbCaps } from '../src/db.js';
import { withPhase2Read, withPhase2Transaction } from '../src/content/phase2-transactions.js';
import { definitionByHash } from '../src/itemdefinitions.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { craftWorldGraphRecipe } from '../src/crafting.js';
import { ledger } from '../src/game.js';
import { deferred, forwardPool } from './lib/phase2-definition-fixtures.js';
import { withItemFixture, injectSqlFailure, lotRequest } from './lib/phase2-item-fixtures.js';

const rejects = (fn, code) => assert.rejects(fn, { code });
const grant = (q, owner, key) => items.grantStack(q, owner, 'mat:fixture', 2, 'standard', 'fixture', key);
const turn = () => new Promise((resolve) => setImmediate(resolve));

// Losing any written reservation UUID on an in-transaction retry must not strand its guard/events.
export async function reservationRetryRegression({ pool, accountOwner: owner, definition, snapshot }, version, timing) {
  const key = crypto.randomUUID(), input = lotRequest(owner, definition, { idempotencyKey: key });
  const invoke = (q, action) => version === 1
    ? items.withItemMutation(q, owner, 'craft', key, { recipe: 'fixture' }, action)
    : items.withLotMutation(q, input, action);
  const before = await snapshot();
  const fault = timing === 'callback' ? null
    : injectSqlFailure(pool, { table: 'item_mutation_guards', occurrence: 1, timing: timing === 'before-insert' ? 'before' : 'after' });
  const traced = forwardPool(fault?.pool || pool);
  let callbacks = 0, inverses = 0, firstError;
  await assert.rejects(() => items.withItemTransaction(traced, async (q) => {
    const failAfterWrite = async (token) => {
      callbacks++;
      await grant(q, owner, token);
      items.registerItemTransactionUndo(q, async () => { inverses++; });
      throw Object.assign(Error('root callback refused after item write'), { code: 'callback_refused' });
    };
    try {
      await invoke(q, failAfterWrite);
      assert.fail('first root must fail');
    } catch (error) {
      firstError = error;
      assert.equal(error.code, timing === 'callback' ? 'callback_refused' : 'injected_failure');
    }
    // A first intent with no SQL write must not hide the second reservation that really writes.
    if (timing === 'before-insert') await rejects(() => invoke(q, failAfterWrite), 'callback_refused');
    await rejects(() => invoke(q, async () => assert.fail('same-transaction retry entered callback')), 'idempotency_in_progress');
  }), (error) => error === firstError, 'owner preserves the first raw failure');
  fault?.restore();
  assert.equal(callbacks, timing === 'after-insert' ? 0 : 1);
  assert.equal(inverses, !dbCaps.skipLocked && timing !== 'after-insert' ? 1 : 0);
  if (dbCaps.skipLocked) assert.equal(traced.statements.filter((sql) => /^DELETE FROM item_(events|mutation_guards)/.test(sql)).length, 0,
    'PostgreSQL restores natively, without item compensation');
  assert.deepEqual(await snapshot(), before, `v${version} ${timing}: failed same-key retry restores every guard, event and item row`);
  let freshCallbacks = 0;
  const fresh = () => items.withItemTransaction(pool, (q) => invoke(q, async (token) => {
    freshCallbacks++; await grant(q, owner, token); return { retried: true };
  }));
  assert.deepEqual(await fresh(), { retried: true });
  const committed = await snapshot();
  assert.deepEqual(await fresh(), { retried: true });
  assert.equal(freshCallbacks, 1, 'fresh-transaction retry executes exactly once');
  assert.deepEqual(await snapshot(), committed, 'completed receipt replays unchanged');

  // Neither repeated incomplete attempts nor completed replays may adopt an earlier owner's receipt.
  const controlInput = lotRequest(owner, definition), controlKey = controlInput.idempotencyKey;
  const control = (q, action) => version === 1
    ? items.withItemMutation(q, owner, 'craft', controlKey, {}, action)
    : items.withLotMutation(q, controlInput, action);
  await items.withItemTransaction(pool, (q) => control(q, async () => ({ preexisting: true })));
  const completedControl = await snapshot();
  const priorGuard = completedControl.item_mutation_guards.find((row) => version === 1
    ? row.idempotency_key === controlKey : row.external_key === controlKey);
  assert(priorGuard);
  await rejects(() => items.withItemTransaction(pool, async (q) => {
    for (let i = 0; i < 2; i++) assert.deepEqual(await control(q, async () => assert.fail('completed control callback')),
      { preexisting: true });
    throw Object.assign(Error('unrelated later failure'), { code: 'control_failure' });
  }), 'control_failure');
  assert.deepEqual(await snapshot(), completedControl, 'failed owner preserves pre-existing completed receipt');
  await pool.query('UPDATE item_mutation_guards SET result_json=NULL,completed_at=NULL WHERE idempotency_key=$1', [priorGuard.idempotency_key]);
  const incompleteControl = await snapshot();
  await rejects(() => items.withItemTransaction(pool, async (q) => {
    for (let i = 0; i < 2; i++) await rejects(() => control(q, async () => assert.fail('incomplete control callback')), 'idempotency_in_progress');
  }), 'idempotency_in_progress');
  assert.deepEqual(await snapshot(), incompleteControl, 'failed owner preserves pre-existing incomplete reservation');
  console.log(`phase2-lot-boundary: v${version} ${timing} same-transaction retry recovery, fresh retry once and pre-existing receipt preservation pass`);
}

export async function runLotBoundary(existingPool = null) {
  await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    for (const version of [1, 2]) for (const timing of ['callback', 'after-insert', 'before-insert']) {
      await reservationRetryRegression({ pool, accountOwner: owner, definition, snapshot }, version, timing);
    }
    // A raw SQL handle, registry brand, or another async flow must never acquire item authority.
    const raw = await pool.connect();
    try {
      assert.equal(typeof items.assertItemTransaction, 'function', 'missing assertItemTransaction interface');
      assert.throws(() => items.assertItemTransaction(raw), { code: 'item_transaction_required' });
      assert.throws(() => items.itemMutationContext(raw, {}), { code: 'item_transaction_required' });
    } finally { raw.release(); }
    await items.withItemTransaction(pool, async (q) => {
      await rejects(() => items.withItemTransaction(pool, async () => null), 'item_transaction_nested');
      assert.throws(() => items.itemMutationContext(q, {}), { code: 'item_transaction_required' });
    });
    for (const alias of [pool, forwardPool(pool), new Proxy(forwardPool(pool), {})]) {
      const before = await snapshot();
      await withPhase2Read(alias, async (q) => {
        assert.throws(() => items.assertItemTransaction(q), { code: 'item_transaction_required' });
        await rejects(() => items.withItemTransaction(typeof q.connect === 'function' ? q : { connect: async () => q }, async () => {
          assert.fail('registry read cannot enter item write callback');
        }), 'item_transaction_nested');
        await items.withItemRead(q, async (same) => assert.equal(same, q));
      });
      await withPhase2Transaction(alias, async (q) => {
        assert.throws(() => items.assertItemTransaction(q), { code: 'item_transaction_required' });
      });
      const trace = forwardPool(alias);
      await items.withItemTransaction(trace, async (q) => {
        assert.deepEqual(await definitionByHash(q, definition.definitionHash), definition);
        await rejects(() => withPhase2Transaction(alias, async () => assert.fail('registry write entered')), 'content_transaction_nested');
      });
      assert.equal(trace.statements.filter((sql) => sql.startsWith('BEGIN')).length, 1, 'item owns exactly one BEGIN');
      assert.deepEqual(await snapshot(), before);
    }
    const beforeNullV2 = await snapshot();
    await assert.rejects(() => pool.query(`INSERT INTO item_mutation_guards
      (idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,reservation_id,envelope_version,
       mutation_id,actor_account_id,external_key,request_json)
      VALUES ('boundary-null-v2','craft','account',$1,$2,'null-v2-reservation',2,NULL,$1,'null-key','{}')`,
    [owner.id, definition.definitionHash]), /item_guard_envelope/, 'clean-schema v2 SQL rejects null mutation UUID');
    assert.deepEqual(await snapshot(), beforeNullV2);
    console.log('phase2-lot-boundary: raw/registry/nested authority, null-ID v2 SQL refusal and distinct-client pinned definition participation pass');

    // A shared token must preserve legacy event numbering while exposing one zero-based IO sequence.
    let expired, freshLegacyId, executions = 0;
    const rootKey = crypto.randomUUID();
    const result = await items.withItemTransaction(pool, (q) => items.withItemMutation(q, owner, 'craft', rootKey,
      { recipe: 'fixture', itemAuthority: { destinations: [owner] } }, async (token) => {
        expired = token; executions++;
        const context = items.itemMutationContext(q, token);
        assert.equal(context.key, rootKey); assert.equal(context.envelopeVersion, 1); assert(Object.isFrozen(context));
        assert.match(context.mutationId, /^[0-9a-f-]{36}$/, 'fresh v1 mutation context has permanent UUID identity');
        freshLegacyId = context.mutationId;
        assert.equal(items.itemMutationContext(q, token).mutationId, freshLegacyId);
        assert.equal(items.nextItemMutationOrdinal(q, token), 0);
        await grant(q, owner, token); await grant(q, owner, token);
        assert.equal(items.nextItemMutationOrdinal(q, token), 3);
        assert.throws(() => items.itemMutationContext(new Proxy(q, {}), token), { code: 'item_transaction_required' });
        return { semantic: 'legacy', ids: ['kept'], count: 2 };
      }));
    await items.withItemTransaction(pool, async (q) => {
      assert.throws(() => items.itemMutationContext(q, expired), { code: 'item_transaction_required' });
    });
    const baseline = await snapshot();
    const events = baseline.item_events.filter((row) => row.idempotency_key === rootKey);
    assert.deepEqual(events.map((row) => row.event_key), ['0001:grant_stack', '0002:grant_stack']);
    const guard = baseline.item_mutation_guards.find((row) => row.idempotency_key === rootKey);
    assert.equal(guard.mutation_id, freshLegacyId);
    assert.equal(guard.request_hash, crypto.createHash('sha256').update(JSON.stringify({ kind: 'craft', owner, request: { recipe: 'fixture' } })).digest('hex'));
    assert.equal(guard.result_json, JSON.stringify(result));
    for (const itemAuthority of [{ destinations: [] }, { destinations: 'historical participants unavailable' }]) {
      assert.deepEqual(await items.withItemTransaction(pool, (q) => items.withItemMutation(q, owner, 'craft', rootKey,
        { recipe: 'fixture', itemAuthority }, () => { executions++; assert.fail('completed legacy callback entered'); })), result);
    }
    assert.equal(executions, 1); assert.deepEqual(await snapshot(), baseline);
    for (const [otherOwner, kind] of [[{ ...owner, id: 'replacement' }, 'craft'], [owner, 'reward_claim']]) {
      await rejects(() => items.withItemTransaction(pool, (q) => items.withItemMutation(q, otherOwner, kind, rootKey,
        { recipe: 'fixture' }, async () => null)), 'idempotency_conflict');
    }
    console.log('phase2-lot-boundary: legacy exact digest/result, raw-key conflicts, replay before authority and unchanged guards/events pass');

    // Every private authority dimension is bound; neither a caller mutation after entry nor a retry can replace it.
    const input = lotRequest(owner, definition); let sideEffects = 0;
    const execute = (request = input) => items.withItemTransaction(pool, (q) => items.withLotMutation(q, request, async (token) => {
      sideEffects++;
      const context = items.itemMutationContext(q, token);
      assert.equal(context.envelopeVersion, 2); assert.match(context.mutationId, /^[0-9a-f-]{36}$/);
      return { mutationId: context.mutationId, ordinal: items.nextItemMutationOrdinal(q, token), nested: { kept: true } };
    }));
    const first = await execute(); const stored = structuredClone(first); first.nested.kept = false;
    assert.deepEqual(await execute(), stored); assert.equal(sideEffects, 1);
    const completed = await snapshot();
    const changes = [
      (r) => { r.request.input.recipe = 'changed'; }, (r) => { r.owner.id = 'changed'; },
      (r) => { r.request.authority.issuedActionId = 'changed'; },
      (r) => { r.request.authority.aggregate.kind = 'changed'; }, (r) => { r.request.authority.aggregate.id = 'changed'; },
      (r) => { r.request.authority.resolvedOwner.scope = 'character'; }, (r) => { r.request.authority.resolvedOwner.id = 'changed'; },
      (r) => { r.request.authority.bundleHash = 'b'.repeat(64); }, (r) => { r.request.authority.namespace = 'changed'; },
      (r) => { r.request.authority.activationRevision = 2; }, (r) => { r.request.authority.eventId = '2'; },
      (r) => { r.request.authority.inputDefinitionHashes = ['b'.repeat(64)]; },
      (r) => { r.request.authority.outputDefinitionHashes = ['b'.repeat(64)]; },
    ];
    for (const change of changes) { const altered = structuredClone(input); change(altered); await rejects(() => execute(altered), 'idempotency_conflict'); }
    assert.equal(sideEffects, 1); assert.deepEqual(await snapshot(), completed);
    // A historical raw key may occupy the exact framed v2 hash. Neither envelope can adopt it.
    const collisionInput = lotRequest(owner, definition);
    const collisionKey = independentStorageKey(collisionInput);
    await items.withItemTransaction(pool, (q) => grant(q, owner, collisionKey));
    const collisionBefore = await snapshot();
    await rejects(() => execute(collisionInput), 'idempotency_conflict');
    assert.deepEqual(await snapshot(), collisionBefore);
    const storedV2 = completed.item_mutation_guards.find((row) => row.mutation_id === stored.mutationId);
    assert.equal(storedV2.idempotency_key, independentStorageKey(input));
    assert.equal(storedV2.envelope_version, 2); assert.equal(storedV2.actor_account_id, owner.id);
    assert.equal(storedV2.external_key, input.idempotencyKey);
    const incomplete = lotRequest(owner, definition), incompleteKey = independentStorageKey(incomplete);
    await pool.query(`INSERT INTO item_mutation_guards(idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,
      reservation_id,envelope_version,mutation_id,actor_account_id,external_key,request_json)
      SELECT $1,mutation_kind,owner_scope,owner_id,request_hash,$2,2,$3,actor_account_id,$4,request_json
      FROM item_mutation_guards WHERE mutation_id=$5`,
    [incompleteKey, crypto.randomUUID(), crypto.randomUUID(), incomplete.idempotencyKey, stored.mutationId]);
    const incompleteBefore = await snapshot();
    await rejects(() => execute(incomplete), 'idempotency_in_progress');
    assert.deepEqual(await snapshot(), incompleteBefore);
    await execute({ ...input, actorAccountId: crypto.randomUUID() });
    await execute({ ...input, actionKind: 'reward_claim' }); assert.equal(sideEffects, 3);
    const pendingInput = lotRequest(owner, definition), frozenInput = structuredClone(pendingInput);
    await items.withItemTransaction(pool, async (q) => {
      const pending = items.withLotMutation(q, pendingInput, async () => ({ frozen: true }));
      pendingInput.request.input.recipe = 'changed after entry';
      assert.deepEqual(await pending, { frozen: true });
    });
    assert.deepEqual(await items.withItemTransaction(pool, (q) => items.withLotMutation(q, frozenInput, () => assert.fail('snapshot was not retained'))), { frozen: true });
    console.log('phase2-lot-boundary: v2 private snapshot, every authority conflict, permanent detached result and account/action independence pass');

    // After-write acknowledgement faults must restore both the owned receipt and actual ledger rows.
    for (const table of ['item_mutation_guards', 'item_events']) for (const timing of ['before', 'after']) {
      const before = await snapshot(), fault = injectSqlFailure(pool, { table, occurrence: 1, timing });
      try { await rejects(() => items.withItemTransaction(fault.pool, (q) => grant(q, owner, crypto.randomUUID())), 'injected_failure'); }
      finally { fault.restore(); }
      assert.deepEqual(await snapshot(), before, `${table}/${timing} rollback restores exact rows`);
    }
    const beforeCaught = await snapshot();
    await rejects(() => items.withItemTransaction(pool, (q) => items.withItemMutation(q, owner, 'craft', crypto.randomUUID(), {}, async (token) => {
      await grant(q, owner, token);
      try { await items.consumeStack(q, owner, 'mat:missing', 1, 'standard', 'fixture', token); } catch {}
      return { incorrectly: 'success' };
    })), 'materials');
    assert.deepEqual(await snapshot(), beforeCaught);
    // Register external row inverse before sending the write, including an after-write fault.
    const beforeExternal = await snapshot();
    const external = forwardPool(pool, { after: async (sql) => {
      if (sql.startsWith('UPDATE accounts SET auth_subject=')) throw Object.assign(Error(), { code: 'external_after_write' });
    } });
    await rejects(() => items.withItemTransaction(external, async (q) => {
      const previous = (await q.query('SELECT auth_subject FROM accounts WHERE id=$1', [owner.id])).rows[0].auth_subject;
      items.registerItemTransactionUndo(q, () => pool.query('UPDATE accounts SET auth_subject=$2 WHERE id=$1', [owner.id, previous]));
      await q.query('UPDATE accounts SET auth_subject=$2 WHERE id=$1', [owner.id, 'temporary']);
    }), 'external_after_write');
    assert.equal((await pool.query('SELECT auth_subject FROM accounts WHERE id=$1', [owner.id])).rows[0].auth_subject, owner.id);
    assert.deepEqual(await snapshot(), beforeExternal);
    await rejects(() => items.withItemTransaction(pool, (q) => items.withLotMutation(q, lotRequest(owner, definition), async () => {
      await grant(q, owner, crypto.randomUUID());
      return true;
    })), 'item_mutation_nested');
    assert.deepEqual(await snapshot(), beforeExternal);
    const rootFault = injectSqlFailure(pool, { table: 'item_mutation_guards', occurrence: 1, timing: 'after' });
    try {
      await rejects(() => items.withItemTransaction(rootFault.pool, async (q) => {
        try { await items.withItemMutation(q, owner, 'craft', crypto.randomUUID(), {}, async () => true); } catch {}
      }), 'injected_failure');
    } finally { rootFault.restore(); }
    assert.deepEqual(await snapshot(), beforeExternal);
    await rejects(() => items.withItemTransaction(pool, (q) => items.withItemMutation(q, owner, 'craft', crypto.randomUUID(), {}, async () => {
      try { await items.withItemMutation(q, owner, 'craft', crypto.randomUUID(), {}, async () => true); } catch {}
      return true;
    })), 'item_mutation_nested');
    assert.deepEqual(await snapshot(), beforeExternal);
    await rejects(() => items.withItemTransaction(pool, async (q) => {
      await grant(q, owner, crypto.randomUUID());
      try { await items.grantStack(q, owner, 'mat:fixture', 0, 'standard', 'invalid', crypto.randomUUID()); } catch {}
      return true;
    }), 'qty');
    assert.deepEqual(await snapshot(), beforeCaught);
    await rejects(() => items.withItemTransaction(pool, async (q) => {
      items.poisonItemTransaction(q, Object.assign(Error(), { code: 'poison_probe' })); return true;
    }), 'poison_probe');
    console.log('phase2-lot-boundary: before/after guard/event faults and swallowed leaf/root poison restore exact snapshots');

    // Admission failures must release the acquired distinct handle before callback entry.
    for (const code of ['40001', '23514']) {
      let releases = 0, entered = false;
      const alias = { connect: async () => { const q = await pool.connect(); return {
        query: async (sql, args) => { if (sql === 'BEGIN') throw Object.assign(Error(), { code }); return q.query(sql, args); },
        release: (...args) => { releases++; q.release(...args); },
      }; } };
      await rejects(() => items.withItemTransaction(alias, async () => { entered = true; }), code === '40001' ? 'contention' : 'item_integrity_error');
      assert.equal(releases, 1); assert.equal(entered, false);
    }
    await rejects(() => items.withItemTransaction({ connect: async () => {
      throw Object.assign(Error(), { code: 'acquire_refused' });
    } }, async () => assert.fail('acquisition failure entered callback')), 'acquire_refused');
    for (const mutate of [
      (r) => { r.actionKind = 'arbitrary_route'; }, (r) => { r.extra = true; },
      (r) => { r.request.authority.extra = true; }, (r) => { r.request.input = { amount: 1.5 }; },
      (r) => { r.request.input = { value: 'x'.repeat(65537) }; },
      (r) => { r.request.input = new Proxy({}, {}); },
      (r) => { Object.defineProperty(r.request, 'input', { enumerable: true, get() { assert.fail('getter executed'); } }); },
    ]) {
      const invalid = lotRequest(owner, definition); mutate(invalid);
      await rejects(() => items.withItemTransaction(pool, (q) => items.withLotMutation(q, invalid, async () => assert.fail('invalid envelope executed'))), 'bad_item_request');
    }
    for (const json of ['{"__proto__":{"polluted":true}}', '{"nested":[{"constructor":{"prototype":{"polluted":true}}}]}',
      '{"nested":{"prototype":{}}}', '{"nested":[{"constructor":"data"}]}']) {
      const invalid = lotRequest(owner, definition), before = await snapshot(); let entered = 0;
      invalid.request.input = JSON.parse(json);
      await assert.rejects(() => items.withItemTransaction(pool, (q) => items.withLotMutation(q, invalid, async () => {
        entered++; return true;
      })), { code: 'bad_item_request' }, `S2 prohibits reserved own-data keys: ${json}`);
      assert.equal(entered, 0); assert.deepEqual(await snapshot(), before);
    }
    console.log('phase2-lot-boundary: S2 reserved own-data keys reject recursively before callback or guard insertion');
    for (const field of ['bundleHash', 'inputDefinitionHashes', 'outputDefinitionHashes']) {
      for (const malformed of [['a'.repeat(64)], [['a'.repeat(64)]], null, false, 1, {}]) {
        const invalid = lotRequest(owner, definition), before = await snapshot(); let entered = 0;
        invalid.request.authority[field] = field === 'bundleHash' ? malformed : [malformed];
        await assert.rejects(() => items.withItemTransaction(pool, (q) => items.withLotMutation(q, invalid, async () => {
          entered++; return true;
        })), { code: 'bad_item_request' }, `S4 ${field} requires exact string hash values`);
        assert.equal(entered, 0); assert.deepEqual(await snapshot(), before);
      }
    }
    console.log('phase2-lot-boundary: S4 exact hashes reject arrays and other inert non-string values without state changes');
    await craftingAuditFailure(pool, owner, snapshot);
    await historicalReceipts(pool, owner, snapshot);
    await dormantTrace();
    if (!dbCaps.skipLocked) await gateSchedules(pool, owner, snapshot);
    else await postgresDisposition(pool, owner, definition, snapshot);
  }, existingPool);
  console.log('phase2-lot-boundary: PASS');
}

async function craftingAuditFailure(pool, owner, snapshot) {
  const characterId = crypto.randomUUID(), key = crypto.randomUUID();
  await pool.query(`INSERT INTO characters(id,account_id,name,season,loc,respect,cash)
    VALUES ($1,$2,'Boundary Crafter',1,'foundry',10000,1000)`, [characterId, owner.id]);
  await pool.query('INSERT INTO account_persistent(account_id) VALUES ($1)', [owner.id]);
  const plainId = await ledger(pool, { characterId, currency: 'cash', amount: 1, reason: 'boundary:default-ledger' });
  assert.match(plainId, /^[0-9a-f-]{36}$/);
  assert.equal(Number((await pool.query('SELECT amount FROM transactions WHERE id=$1', [plainId])).rows[0].amount), 1);
  await rejects(() => ledger(pool, { characterId, currency: 'cash', amount: 1, reason: 'boundary:invalid-hook' },
    { beforeInsert: false }), 'bad_ledger_hook');
  await rejects(() => ledger(pool, { characterId, currency: 'cash', amount: 1, reason: 'boundary:refused-hook' },
    { beforeInsert: async (id) => { assert.match(id, /^[0-9a-f-]{36}$/); throw Object.assign(Error(), { code: 'hook_refused' }); } }), 'hook_refused');
  assert.equal((await pool.query('SELECT COUNT(*) AS n FROM transactions WHERE character_id=$1', [characterId])).rows[0].n.toString(), '1');
  await items.withItemTransaction(pool, (q) => items.grantStack(q, owner, 'mat:scrap_steel', 4, 'standard', 'fixture', crypto.randomUUID()));
  const state = async () => ({ items: await snapshot(),
    character: (await pool.query('SELECT * FROM characters WHERE id=$1', [characterId])).rows,
    transactions: (await pool.query('SELECT * FROM transactions WHERE character_id=$1 ORDER BY id', [characterId])).rows });
  const before = await state();
  const fault = injectSqlFailure(pool, { table: 'transactions', occurrence: 1, timing: 'after' });
  const craft = (p) => items.withItemTransaction(p, (q) => craftWorldGraphRecipe(q, { accountId: owner.id }, 'recipe:hardened_steel', key));
  try { await rejects(() => craft(fault.pool), 'injected_failure'); }
  finally { fault.restore(); }
  assert.deepEqual(await state(), before, 'after audit INSERT failure restores exact character/transactions/stacks/events/guards');
  if (dbCaps.skipLocked) assert.equal(fault.pool.statements.slice(fault.pool.statements.indexOf('ROLLBACK') + 1).filter((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql)).length, 0);
  const result = await craft(pool), committed = await state();
  assert.equal(result.cashCost, 300); assert.equal(result.cashAfter, 700);
  assert.equal(committed.transactions.length, before.transactions.length + 1);
  assert.deepEqual(await craft(pool), result); assert.deepEqual(await state(), committed);
  console.log('phase2-lot-boundary: actual craft audit after-INSERT failure restores exact cash/ledger/item snapshot; same-key retry spends once');
}

// Independent byte fixture: fixed tag, ordered named UTF-8 string fields, explicit type and size.
function independentStorageKey({ actorAccountId, actionKind, idempotencyKey }) {
  const chunks = ['4f4d4552544100'];
  const sized = (text, digits) => Buffer.byteLength(text).toString(16).padStart(digits, '0') + Buffer.from(text).toString('hex');
  chunks.push(sized('omerta:item-mutation-key:v1', 8), '00000003');
  for (const [name, value] of [['actorAccountId', actorAccountId], ['actionKind', actionKind], ['externalKey', idempotencyKey]]) {
    chunks.push(sized(name, 8), '04', sized(value, 16));
  }
  return crypto.createHash('sha256').update(Buffer.from(chunks.join(''), 'hex')).digest('hex');
}

async function historicalReceipts(pool, owner, snapshot) {
  const cases = [
    ['craft', { recipeId: 'legacy-recipe', characterId: 'dead-character' }, { itemId: 'old-output', characterId: 'dead-character' }],
    ['salvage_car', { carId: 'deleted-car' }, { carId: 'deleted-car', salvage: ['mat:old'] }],
    ['operation_action', { operationId: 'old-operation', action: 'assign' }, { assigned: ['old-participant'] }],
    ['mystery_action', { instanceId: 'retired-instance', action: 'cancel' }, { cancelled: true, released: ['original-item'] }],
  ];
  for (const [kind, request, result] of cases) {
    const key = crypto.randomUUID();
    const hash = crypto.createHash('sha256').update(JSON.stringify({ kind, owner, request })).digest('hex');
    await pool.query(`INSERT INTO item_mutation_guards(idempotency_key,mutation_kind,owner_scope,owner_id,
      request_hash,reservation_id,result_json,completed_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now())`,
    [key, kind, owner.scope, owner.id, hash, crypto.randomUUID(), JSON.stringify(result)]);
    const before = await snapshot(); let entered = 0;
    assert.equal(before.item_mutation_guards.find((row) => row.idempotency_key === key).mutation_id, null);
    const replay = await items.withItemTransaction(pool, (q) => items.withItemMutation(q, owner, kind, key,
      { ...request, itemAuthority: { destinations: [null], operations: 'historical authority unavailable' } }, async () => {
        entered++; throw Object.assign(Error(), { code: 'historical_target_unavailable' });
      }));
    assert.deepEqual(replay, result); assert.equal(entered, 0); assert.deepEqual(await snapshot(), before);
  }
  console.log('phase2-lot-boundary: permanent v1 dead/replaced actor, deleted car, participant drift and retired cancellation receipt fixtures pass');
}

async function dormantTrace() {
  const module = await import('../src/item-lock-trace.js').catch(() => ({}));
  assert.equal(typeof module.createItemLockTrace, 'function', 'missing dormant createItemLockTrace');
  const { createItemLockTrace } = module;
  const row = (className, subtype, id = 'a', generation = 0) => ({ className, subtype, key: id, id, generation });
  const candidates = [row('crew', 'crew'), row('item', 'lot'), row('item', 'unique')];
  const trace = createItemLockTrace(); trace.admitCandidates('crew', [candidates[0]]);
  for (const entry of [row('definition', 'definition'), candidates[0], row('character', 'character'), row('account', 'account'),
    row('social_mapping', 'mapping'), row('subject_generation', 'subject'), row('organization', 'gang'), row('guard', 'guard'),
    row('aggregate', 'operation')]) trace.record(entry);
  trace.admitCandidates('item', [candidates[1], candidates[2]]);
  for (const entry of [candidates[1], candidates[2], row('budget', 'singleton')]) trace.record(entry);
  assert.equal(trace.snapshot().length, 12); assert(Object.isFrozen(trace.snapshot()[0]));
  for (const entry of [row('organization', 'crew'), row('unknown', 'unknown'), row('character', 'character')]) {
    assert.throws(() => trace.record(entry), { code: 'item_lock_order' });
  }
  const late = createItemLockTrace(); late.admitCandidates('item', [row('item', 'lot', 'b')]); late.record(row('item', 'lot', 'b'));
  assert.throws(() => late.record(row('item', 'lot', 'a')), { code: 'contention' });
  assert.throws(() => late.record(row('item', 'unique', 'z')), { code: 'contention' });
  assert.throws(() => late.admitCandidates('item', [row('item', 'lot', 'a')]), { code: 'contention' });
  assert.throws(() => trace.admitCandidates('crew', [row('crew', 'crew', 'z')]), { code: 'contention' });
  assert.throws(() => trace.record(row('crew', 'crew', 'z')), { code: 'contention' });
  const missedCrew = createItemLockTrace(); missedCrew.record(row('character', 'character'));
  assert.throws(() => missedCrew.admitCandidates('crew', [row('crew', 'crew')]), { code: 'contention' });
  const missedItems = createItemLockTrace(); missedItems.record(row('budget', 'budget'));
  assert.throws(() => missedItems.admitCandidates('item', []), { code: 'contention' });
  const repeated = createItemLockTrace(); repeated.admitCandidates('crew', []);
  assert.throws(() => repeated.admitCandidates('crew', []), { code: 'contention' });
  assert.throws(() => repeated.admitCandidates('organization', []), { code: 'item_lock_order' });
  const generation = createItemLockTrace(); generation.record(row('subject_generation', 'subject', 'a', 2));
  assert.throws(() => generation.record(row('subject_generation', 'subject', 'a', 1)), { code: 'item_lock_order' });
  console.log('phase2-lot-boundary: S1 Crew admission/locks precede owner/aggregate locks and separate item admission; late or repeated sets reject');
}

async function gateSchedules(pool, owner, snapshot) {
  for (const outer of ['item', 'registry']) {
    const entered = deferred(), resume = deferred(); let writerEntered = false;
    const protect = outer === 'item' ? items.withItemRead : withPhase2Read;
    const reading = protect(forwardPool(pool), (q) => items.withItemRead(q, async (c) => {
      const first = await c.query('SELECT * FROM item_stacks ORDER BY template_id'); entered.resolve(); await resume.promise;
      assert.deepEqual((await c.query('SELECT * FROM item_stacks ORDER BY template_id')).rows, first.rows);
    }));
    await entered.promise;
    const writing = items.withItemTransaction(new Proxy(forwardPool(pool), {}), async (q) => {
      writerEntered = true; await grant(q, owner, crypto.randomUUID());
    });
    await turn(); await turn(); assert.equal(writerEntered, false); resume.resolve(); await Promise.all([reading, writing]);
    const before = await snapshot(), writeEntered = deferred(), recover = deferred(); let readerEntered = false;
    const failed = items.withItemTransaction(forwardPool(pool), async (q) => {
      await grant(q, owner, crypto.randomUUID()); writeEntered.resolve(); await recover.promise;
      throw Object.assign(Error(), { code: 'recover_probe' });
    });
    const rejected = rejects(() => failed, 'recover_probe'); await writeEntered.promise;
    const reader = protect(new Proxy(forwardPool(pool), {}), (q) => items.withItemRead(q, async () => { readerEntered = true; }));
    await turn(); await turn(); assert.equal(readerEntered, false); recover.resolve(); await rejected; await reader;
    assert.deepEqual(await snapshot(), before);
  }
  console.log('phase2-lot-boundary: both gate directions and alias recovery exclude interleaving for whole callbacks');
}

async function postgresDisposition(pool, owner, definition, snapshot) {
  const request = lotRequest(owner, definition); let calls = 0, discarded = false;
  const lost = forwardPool(pool, { after: async (sql) => { if (sql === 'COMMIT') throw Error('lost commit acknowledgement'); } });
  const alias = { connect: async () => { const q = await lost.connect(); return { query: q.query,
    release: (discard) => { discarded = discard; q.release(discard); } }; } };
  const apply = (p) => items.withItemTransaction(p, (q) => items.withLotMutation(q, request, async (token) => {
    calls++; return { id: items.itemMutationContext(q, token).mutationId, ordinal: items.nextItemMutationOrdinal(q, token) };
  }));
  await rejects(() => apply(alias), 'item_commit_unknown'); assert.equal(discarded, true);
  assert.equal(lost.statements.includes('ROLLBACK'), false);
  const recovered = await apply(pool); assert.equal(calls, 1); assert.equal(recovered.ordinal, 0);
  const before = await snapshot(); let inverses = 0;
  const trace = forwardPool(pool);
  await rejects(() => items.withItemTransaction(trace, async (q) => {
    items.registerItemTransactionUndo(q, async () => { inverses++; }); await grant(q, owner, crypto.randomUUID());
    await q.query('SELECT 1/0');
  }), 'item_integrity_error');
  assert.equal(inverses, 0); assert.deepEqual(await snapshot(), before);
  assert.equal(trace.statements.slice(trace.statements.indexOf('ROLLBACK') + 1).filter((sql) => /^(INSERT|UPDATE|DELETE)/.test(sql)).length, 0);
  for (const [code, expected] of [['40001', 'contention'], ['40P01', 'contention'], ['55P03', 'contention'], ['23514', 'item_integrity_error']]) {
    const failed = forwardPool(pool, { before: async (sql) => { if (sql === 'COMMIT') throw Object.assign(Error('raw SQLSTATE probe'), { code }); } });
    await rejects(() => items.withItemTransaction(failed, (q) => grant(q, owner, crypto.randomUUID())), expected);
    assert.equal(failed.statements.at(-1), 'ROLLBACK'); assert.deepEqual(await snapshot(), before);
  }
  let timeoutState;
  await rejects(() => items.withItemTransaction(pool, async (q) => {
    await grant(q, owner, crypto.randomUUID()); await q.query("SET LOCAL statement_timeout='20ms'");
    try { await q.query('SELECT pg_sleep(1)'); } catch (error) { timeoutState = error.code; throw error; }
  }), 'contention');
  assert.equal(timeoutState, '57014'); assert.deepEqual(await snapshot(), before);
  let rollbackDiscard = false;
  const refusedRollback = forwardPool(pool, { before: async (sql) => { if (sql === 'ROLLBACK') throw Error('rollback disconnected'); } });
  const broken = { connect: async () => { const q = await refusedRollback.connect(); return { query: q.query,
    release: (discard) => { rollbackDiscard = discard; q.release(discard); } }; } };
  await rejects(() => items.withItemTransaction(broken, async (q) => {
    await grant(q, owner, crypto.randomUUID()); throw Object.assign(Error(), { code: 'action_refused' });
  }), 'item_commit_unknown');
  assert.equal(rollbackDiscard, true); assert.deepEqual(await snapshot(), before);
  // PostgreSQL MVCC readers keep both halves in their original snapshot while another writer commits.
  for (const protect of [items.withItemRead, withPhase2Read]) {
    const start = deferred();
    const writing = start.promise.then(() => items.withItemTransaction(pool, (writeClient) => grant(writeClient, owner, crypto.randomUUID())));
    await protect(forwardPool(pool), (q) => items.withItemRead(q, async (readClient) => {
      const original = (await readClient.query('SELECT * FROM item_stacks ORDER BY template_id')).rows;
      start.resolve(); await writing;
      assert.deepEqual((await readClient.query('SELECT * FROM item_stacks ORDER BY template_id')).rows, original);
    }));
  }
  console.log('phase2-lot-boundary: PostgreSQL lost COMMIT discards/reconciles on fresh connection, native rollback and zero compensation pass');
}

async function poisonProcess() {
  await withItemFixture(async ({ pool, accountOwner: owner }) => {
    const entered = deferred(), resume = deferred();
    const writer = items.withItemTransaction(forwardPool(pool), async (q) => {
      await grant(q, owner, crypto.randomUUID());
      items.registerItemTransactionUndo(q, async () => { throw Error('inverse disconnected'); });
      entered.resolve(); await resume.promise; throw Error('action failed');
    });
    const refused = rejects(() => writer, 'item_recovery_required'); await entered.promise;
    let released = 0;
    const queuedPool = { connect: async () => { const q = await pool.connect(); return { query: q.query.bind(q),
      release: (...args) => { released++; q.release(...args); } }; } };
    const queued = rejects(() => items.withItemTransaction(queuedPool, async () => assert.fail('poisoned queue executed')), 'item_recovery_required');
    resume.resolve(); await refused; await queued; assert.equal(released, 1);
    for (const alias of [pool, forwardPool(pool), new Proxy(pool, {})]) {
      await rejects(() => items.withItemTransaction(alias, async () => assert.fail('poisoned write executed')), 'item_recovery_required');
      await rejects(() => items.withItemRead(alias, async () => assert.fail('poisoned read executed')), 'item_recovery_required');
      await rejects(() => items.inventoryBoard(alias, owner), 'item_recovery_required');
      await rejects(() => runLedgerInvariants(alias, { alert: false }), 'item_recovery_required');
    }
  });
  console.log('phase2-lot-boundary: failed inverse poisons queued/acquired handles and every read/write/invariant alias until process recreation');
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] === '--poison-child') await poisonProcess();
  else {
    await runLotBoundary();
    const child = spawnSync(process.execPath, [fileURLToPath(import.meta.url), '--poison-child'], { encoding: 'utf8', windowsHide: true, timeout: 30000 });
    process.stdout.write(child.stdout || ''); process.stderr.write(child.stderr || '');
    assert.equal(child.status, 0, 'isolated poison process must pass');
  }
}
