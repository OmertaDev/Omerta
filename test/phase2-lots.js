import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { withItemTransaction, withLotMutation, withItemMutation, assertLotCandidateRoot, assertLotDefinitionPin, createItem, consumeItem, transferItem, escrowItem, releaseEscrow, grantStack, registerItemTransactionUndo } from '../src/items.js';
import { ledger } from '../src/game.js';
import { canonicalBytes } from '../src/content/canonical.js';
import { withItemFixture, lotRequest, injectSqlFailure, runTrustedDormantLotGrant, runTrustedDormantItemAction, prepareDormantOperationFixture } from './lib/phase2-item-fixtures.js';
import { compileFixture, materialSource, forwardPool, deferred } from './lib/phase2-definition-fixtures.js';
import { storeSealedBundle } from '../src/content/artifacts.js';
import { definitionByHash } from '../src/itemdefinitions.js';
import { createItemLockTrace } from '../src/item-lock-trace.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { withPhase2Read } from '../src/content/phase2-transactions.js';
import { dbCaps } from '../src/db.js';

export function lotOutput(owner, definition, overrides = {}) {
  return { logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
    owner, custody: { state: 'direct', scope: null, id: null }, qualityBand: null,
    qualityStateDigest: null, tradePolicyHash: definition.definitionHash, binding: null,
    transferRestriction: null, seasonId: null, runId: null, sourceCapId: null,
    expiresAt: null, ageBasisAt: null, provenanceCoalescingClass: 'fixture', quantity: 10,
    provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64), ...overrides };
}
export function lotSelector(owner, definition, quantity = 1, overrides = {}) {
  const { provenanceClass, provenanceDigest, ...identity } = lotOutput(owner, definition);
  return { ...identity, quantity, selection: 'compatible', lotIds: null, ...overrides };
}

export function lotLeafPrivateCases(lots, owner, definition, uniqueDefinition) {
  const uniqueOutput = { logicalItemId: uniqueDefinition.logicalItemId, definitionHash: uniqueDefinition.definitionHash,
    owner, qualityBand: null, qualityStateDigest: null, tradePolicyHash: uniqueDefinition.definitionHash,
    conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) };
  return [
    ['consumeLotsFifo', (q, token) => lots.consumeLotsFifo(q, token, lotSelector(owner, definition))],
    ['consumeExactLot', (q, token) => lots.consumeExactLot(q, token, 'private-boundary-subject', 1)],
    ['splitLot', (q, token) => lots.splitLot(q, token, 'private-boundary-subject', 1, { state: 'direct', scope: null, id: null })],
    ['grantUnique', (q, token) => lots.grantUnique(q, token, uniqueDefinition, uniqueOutput)],
    ['applyItemTransition', (q, token) => lots.applyItemTransition(q, token, 0)],
  ];
}

export async function runLots(existingPool = null) {
  // Missing storage is an explicit assertion failure, not an accidental import error.
  const lots = await import('../src/itemlots.js').catch((error) => {
    if (error.code === 'ERR_MODULE_NOT_FOUND' && error.url?.endsWith('/src/itemlots.js')) return {};
    throw error;
  });
  assert.equal(typeof lots.grantLot, 'function', 'exact lot storage must provide grantLot');
  await withItemFixture(async ({ pool, accountOwner: owner, snapshot }) => {
    assert.equal(typeof lots.applyItemTransition, 'function', 'exact storage must provide applyItemTransition');
    const fixture = { pool, permissions: { actorAccountId: owner.id, alive: true, role: 'custodian', revision: 1, consent: true },
      issuedActions: Object.freeze({}) };
    await prepareDormantOperationFixture(fixture);
    const operationId = fixture.operation.id;
    let serial = 0;
    const issue = (definition, instruction, rootOwner = owner) => {
      const id = `issued-transition-${++serial}`, request = lotRequest(rootOwner, definition, { actorAccountId: owner.id, actionKind: 'operation_action' });
      request.request.authority.issuedActionId = id; request.request.authority.aggregate = { kind: 'operation', id: operationId };
      if (instruction.transition) request.request.authority.itemTransitions = [instruction.transition];
      const descriptor = Object.freeze({ ...instruction, request, definition, role: 'custodian', revision: 1 });
      fixture.issuedActions = Object.freeze({ ...fixture.issuedActions, [id]: descriptor });
      return { id, request, run: () => runTrustedDormantItemAction(fixture, { issuedActionId: id }) };
    };
    const refuseLegacyExact = async (definition, itemId, heldOwner) => {
      const escrowed = heldOwner.scope === 'operation', destination = { scope: 'account', id: 'legacy-other-owner' };
      const leaves = escrowed ? [
        ['consume', (q, key, id) => consumeItem(q, heldOwner, id, 'legacy boundary', key), 'item_unavailable'],
        ['release', (q, key, id) => releaseEscrow(q, operationId, owner, id, 'legacy boundary', key), 'item_not_escrowed'],
      ] : [
        ['consume', (q, key, id) => consumeItem(q, heldOwner, id, 'legacy boundary', key), 'item_unavailable'],
        ['transfer', (q, key, id) => transferItem(q, heldOwner, destination, id, 'legacy boundary', key), 'item_unavailable'],
        ['escrow', (q, key, id) => escrowItem(q, heldOwner, operationId, id, 'legacy boundary', key), 'item_unavailable'],
      ];
      for (const mode of ['v2', 'v2-empty', 'string', 'v1']) for (const [name, leaf, unavailable] of leaves) {
        const key = randomUUID(), request = lotRequest(heldOwner, definition, { actorAccountId: owner.id, idempotencyKey: key });
        request.request.authority.inputDefinitionHashes = []; request.request.authority.outputDefinitionHashes = [];
        if (mode === 'v2-empty') request.request.authority.itemTransitions = [];
        if (escrowed) request.request.authority.aggregate = { kind: 'operation', id: operationId };
        const expected = mode.startsWith('v2') && name !== 'consume' ? 'item_mutation_authority' : unavailable;
        const execute = (id, caught) => withItemTransaction(pool, async (q) => {
          const action = async (token) => {
            await grantStack(q, heldOwner, 'legacy:preceding-write', 1, 'standard', 'boundary rollback', token);
            if (!caught) return leaf(q, token, id);
            try { await leaf(q, token, id); } catch (error) { assert.equal(error.code, expected); }
            return 'caught error must still poison root';
          };
          if (mode.startsWith('v2')) return withLotMutation(q, request, action);
          if (mode === 'v1') return withItemMutation(q, heldOwner, 'craft', key,
            { itemAuthority: { destinations: [owner, destination], operations: [operationId] } }, action);
          await grantStack(q, heldOwner, 'legacy:preceding-write', 1, 'standard', 'boundary rollback', `${key}:prior`);
          if (!caught) return leaf(q, key, id);
          try { await leaf(q, key, id); } catch (error) { assert.equal(error.code, expected); }
          return 'caught string-key leaf must still poison transaction';
        });
        const before = await snapshot();
        await assert.rejects(() => execute(itemId, true), { code: expected }, `${mode}/${name} exact attachment must refuse legacy mutation`);
        assert.deepEqual(await snapshot(), before, `${mode}/${name} caught rejection unwinds preceding write and fresh guard`);
        await assert.rejects(() => execute(itemId, false), { code: expected }, `${mode}/${name} same-key retry cannot bypass exact authority`);
        assert.deepEqual(await snapshot(), before);
        await assert.rejects(() => execute('absent-private-subject', false), { code: expected },
          `${mode}/${name} exact attachment does not reveal more than an absent legacy subject`);
        assert.deepEqual(await snapshot(), before);
      }
    };
    for (const storageKind of ['lot', 'unique']) {
      const source = materialSource({ kind: storageKind === 'lot' ? 'material' : 'item', stackable: storageKind === 'lot',
        ownerScopes: ['character', 'account', 'project'], maximumLotQuantity: storageKind === 'lot' ? 100 : 1,
        definitionVersion: storageKind === 'lot' ? 40 : 41 }); source.version = storageKind === 'lot' ? 40 : 41;
      const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
      const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
      const output = storageKind === 'lot' ? lotOutput(owner, definition) : {
        logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash, owner,
        qualityBand: null, qualityStateDigest: null, tradePolicyHash: definition.definitionHash,
        conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) };
      const grant = issue(definition, { kind: storageKind === 'lot' ? 'grant_lot' : 'grant_unique', output });
      const created = await grant.run(), subjectId = created.lotId ?? created.id;
      if (storageKind === 'unique') await refuseLegacyExact(definition, subjectId, owner);
      const history = [grant];
      const subject = async (selectedId = subjectId) => {
        if (storageKind === 'unique') {
          const row = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [selectedId])).rows[0];
          return { storageKind, itemId: selectedId, expected: { definitionHash: row.definition_hash,
            owner: { scope: row.owner_scope, id: row.owner_id }, state: row.state,
            custody: row.state === 'escrowed' ? { state: 'escrowed', scope: 'operation', id: row.owner_id } : { state: 'direct', scope: null, id: null },
            qualityBand: row.quality_band, qualityStateDigest: row.quality_state_digest, conditionSummary: null, exportPolicy: 'ineligible' } };
        }
        const row = (await pool.query('SELECT * FROM item_lots WHERE lot_id=$1', [selectedId])).rows[0];
        const { quantity, provenanceClass, provenanceDigest, ...identity } = output;
        return { storageKind, lotId: selectedId, expected: { ...identity, owner: { scope: row.owner_scope, id: row.owner_id },
          custody: { state: row.custody_state, scope: row.custody_scope, id: row.custody_id }, remainingQuantity: row.remaining_quantity } };
      };
      const move = async (kind, extra) => {
        const pin = await subject(), transition = { kind, subject: pin, ...extra };
        const requirements = [storageKind === 'lot' ? { kind: 'lot_exact', lotId: subjectId, quantity: pin.expected.remainingQuantity }
          : { kind: 'unique_exact', itemId: subjectId, expected: pin.expected }];
        const action = issue(definition, { kind: 'transition', transition, requirements });
        const result = await action.run(); history.push(action); return result;
      };
      const initialPin = await subject(), initialRequirements = [storageKind === 'lot'
        ? { kind: 'lot_exact', lotId: subjectId, quantity: 10 } : { kind: 'unique_exact', itemId: subjectId, expected: initialPin.expected }];
      const wrongOperation = issue(definition, { kind: 'transition', transition: { kind: 'escrow', subject: initialPin, operationId: 'arbitrary-operation' },
        requirements: initialRequirements });
      const wrongAggregate = issue(definition, { kind: 'transition', transition: { kind: 'escrow', subject: initialPin, operationId }, requirements: initialRequirements });
      wrongAggregate.request.request.authority.aggregate.id = 'arbitrary-aggregate';
      for (const action of [wrongOperation, wrongAggregate]) {
        const before = await snapshot();
        await assert.rejects(action.run, { code: 'item_mutation_authority' });
        await assert.rejects(action.run, { code: 'item_mutation_authority' });
        assert.deepEqual(await snapshot(), before, 'fresh arbitrary operation/aggregate authority leaves no committed effects');
      }
      if (storageKind === 'lot') {
        const partial = issue(definition, { kind: 'transition', transition: { kind: 'escrow', subject: initialPin, operationId },
          requirements: [{ kind: 'lot_exact', lotId: subjectId, quantity: 9 }] });
        const before = await snapshot(); await assert.rejects(partial.run, { code: 'bad_item_request' });
        assert.deepEqual(await snapshot(), before, 'whole-lot custody cannot authorize a partial movement');
        for (const restriction of [{ binding: 'bound' }, { transferRestriction: 'restricted' }]) {
          const restricted = await issue(definition, { kind: 'grant_lot', output: { ...output, ...restriction } }).run();
          const pin = await subject(restricted.lotId); Object.assign(pin.expected, restriction);
          const action = issue(definition, { kind: 'transition', transition: { kind: 'escrow', subject: pin, operationId },
            requirements: [{ kind: 'lot_exact', lotId: restricted.lotId, quantity: 10 }] });
          const before = await snapshot(); await assert.rejects(action.run, { code: 'item_mutation_authority' });
          assert.deepEqual(await snapshot(), before, 'unsupported bound/restricted custody fails closed');
        }
      }
      // Every transition acknowledgement boundary must restore the same physical subject and original receipt.
      for (const [table, operation] of [[storageKind === 'lot' ? 'item_lots' : 'item_instances', 'UPDATE'],
        ...(storageKind === 'unique' ? [['operation_escrow', 'INSERT']] : []), ['item_events', 'INSERT'],
        ['item_mutation_inputs', 'INSERT'], ['item_mutation_outputs', 'INSERT'], ['item_mutation_guards', 'UPDATE']]) {
        for (const timing of ['before', 'after']) {
          const pin = await subject(), requirements = [storageKind === 'lot' ? { kind: 'lot_exact', lotId: subjectId, quantity: pin.expected.remainingQuantity }
            : { kind: 'unique_exact', itemId: subjectId, expected: pin.expected }];
          const action = issue(definition, { kind: 'transition', transition: { kind: 'escrow', subject: pin, operationId }, requirements });
          const before = await snapshot(), fault = injectSqlFailure(pool, { table, operation, timing, occurrence: 1 });
          fixture.pool = fault.pool;
          try { await assert.rejects(action.run, { code: 'injected_failure' }); }
          finally { fault.restore(); fixture.pool = pool; }
          assert.deepEqual(await snapshot(), before, `${storageKind} ${table} ${operation}/${timing}: exact root rollback`);
          const retried = await action.run(); history.push(action);
          assert.equal(retried.before.remainingQuantity, storageKind === 'lot' ? 10 : 1);
          const committed = await snapshot(); assert.deepEqual(await action.run(), retried);
          assert.deepEqual(await snapshot(), committed);
          await move('release', { depositor: owner });
        }
      }
      const escrow = await move('escrow', { operationId });
      assert.equal(escrow.after.owner.scope, 'operation'); assert.equal(escrow.movedQuantity, storageKind === 'lot' ? 10 : 1);
      if (storageKind === 'unique') await refuseLegacyExact(definition, subjectId, { scope: 'operation', id: operationId });
      const alternate = await issue(definition, { kind: storageKind === 'lot' ? 'grant_lot' : 'grant_unique', output }).run();
      if (storageKind === 'lot') {
        const directBoard = await lots.lotInventoryBoard(pool, owner, { cursor: null, limit: 100, includeLots: true });
        const escrowBoard = await lots.lotInventoryBoard(pool, { scope: 'operation', id: operationId },
          { cursor: null, limit: 100, includeLots: true });
        for (const [board, expectedId, expectedOwner, expectedCustody] of [
          [directBoard, alternate.lotId, owner, { state: 'direct', scope: null, id: null }],
          [escrowBoard, subjectId, { scope: 'operation', id: operationId }, { state: 'escrowed', scope: 'operation', id: operationId }],
        ]) {
          const unrestricted = (row) => row.binding === null && row.transferRestriction === null;
          assert.deepEqual(board.lots.filter(unrestricted).map((row) => row.lotId), [expectedId],
            'owner/custody board cannot include another owner physical lot');
          const groups = board.groups.filter(unrestricted);
          assert.equal(groups.length, 1); assert.equal(groups[0].quantity, 10);
          assert.deepEqual(groups[0].owner, expectedOwner);
          assert.deepEqual(groups[0].custody, expectedCustody);
        }
      }
      for (const branch of ['input', 'output']) {
        const table = `item_mutation_${branch}s`, idColumn = storageKind === 'lot' ? 'lot_id' : 'item_id';
        const constraint = `item_${branch}_${storageKind}_event_fk`, before = await snapshot();
        await assert.rejects(() => pool.query(`UPDATE ${table} SET ${idColumn}=$2,attachment_mutation_id=$3,
          attachment_output_ordinal=$4 WHERE mutation_id=$1`,
        [escrow.mutationId, alternate.lotId ?? alternate.id, alternate.mutationId, alternate.outputOrdinal]),
        (error) => dbCaps.skipLocked ? error.code === '23503' && error.constraint === constraint
          : String(error.message).includes(constraint), `${storageKind} ${branch}: present same-definition event must bind its exact subject`);
        assert.deepEqual(await snapshot(), before, 'wrong existing subject cannot redirect normalized movement history');
      }
      for (const dimension of ['quality', 'depositor']) {
        const pin = await subject(), action = issue(definition, { kind: 'transition', transition: { kind: 'release', subject: pin, depositor: owner },
          requirements: [storageKind === 'lot' ? { kind: 'lot_exact', lotId: subjectId, quantity: 10 }
            : { kind: 'unique_exact', itemId: subjectId, expected: pin.expected }] });
        const table = dimension === 'depositor' && storageKind === 'unique' ? 'operation_escrow'
          : storageKind === 'lot' ? 'item_lots' : 'item_instances';
        const column = dimension === 'quality' ? 'quality_band' : 'depositor_id';
        const idColumn = table === 'item_lots' ? 'lot_id' : table === 'operation_escrow' ? 'item_id' : 'id';
        const previous = (await pool.query(`SELECT ${column} FROM ${table} WHERE ${idColumn}=$1`, [subjectId])).rows[0][column];
        const before = await snapshot(); let changed = false;
        fixture.pool = forwardPool(pool, { before: async (sql, values, q) => {
          if (!changed && sql === `SELECT * FROM ${table} WHERE ${idColumn}=$1 FOR UPDATE`) {
            changed = true; await q.query(`UPDATE ${table} SET ${column}=$2 WHERE ${idColumn}=$1`, [subjectId, 'changed-after-admission']);
          }
        } });
        try { await assert.rejects(action.run, { code: 'contention' }); }
        finally { fixture.pool = pool; await pool.query(`UPDATE ${table} SET ${column}=$2 WHERE ${idColumn}=$1`, [subjectId, previous]); }
        assert.equal(changed, true); assert.deepEqual(await snapshot(), before, `${storageKind} ${dimension} drift creates no root effects`);
        assert.deepEqual((await action.run()).after.owner, owner); history.push(action);
        await move('escrow', { operationId });
      }
      const pin = await subject(), requirements = [storageKind === 'lot' ? { kind: 'lot_exact', lotId: subjectId, quantity: pin.expected.remainingQuantity }
        : { kind: 'unique_exact', itemId: subjectId, expected: pin.expected }];
      const badRelease = issue(definition, { kind: 'transition', transition: { kind: 'release', subject: pin,
        depositor: { ...owner, id: 'replacement-depositor' } }, requirements });
      const beforeBad = await snapshot();
      await assert.rejects(badRelease.run, { code: 'item_unavailable' });
      assert.deepEqual(await snapshot(), beforeBad);
      let child;
      if (storageKind === 'lot') {
        const operationOwner = { scope: 'operation', id: operationId };
        const illicit = lotRequest(operationOwner, definition, { actorAccountId: owner.id });
        illicit.request.authority.aggregate = { kind: 'operation', id: operationId };
        await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, illicit, (token) =>
          lots.withCompleteItemCandidates(q, token, createItemLockTrace(), { root: { owner: operationOwner,
            authority: illicit.request.authority }, requirements: [{ kind: 'lot_exact', lotId: subjectId, quantity: 1 }] },
          () => lots.consumeExactLot(q, token, subjectId, 1)))), { code: 'item_mutation_authority' });
        assert.deepEqual(await snapshot(), beforeBad, 'quantity-only leaf cannot bypass escrow-consumption entry');
        const split = issue(definition, { kind: 'split', requirements: [{ kind: 'lot_exact', lotId: subjectId, quantity: 3 }],
          custody: pin.expected.custody }, operationOwner);
        child = await split.run(); history.push(split);
        const childRow = (await pool.query('SELECT * FROM item_lots WHERE lot_id=$1', [child.lotId])).rows[0];
        assert.equal(childRow.depositor_id, owner.id); assert.equal(childRow.depositor_scope, owner.scope);
        const creation = (await pool.query("SELECT * FROM item_events WHERE lot_id=$1 AND event_kind='lot_split_output'", [child.lotId])).rows[0];
        for (const field of ['depositor', 'owner-custody']) {
          const before = await snapshot(), forged = JSON.parse(creation.snapshot_json);
          if (field === 'depositor') {
            forged.depositor = { scope: owner.scope, id: 'forged-depositor' };
            await pool.query("UPDATE item_lots SET depositor_id='forged-depositor' WHERE lot_id=$1", [child.lotId]);
          } else {
            forged.owner = { scope: 'operation', id: 'forged-operation' };
            forged.custody = { state: 'escrowed', scope: 'operation', id: 'forged-operation' };
            await pool.query("UPDATE item_lots SET owner_id='forged-operation',custody_id='forged-operation' WHERE lot_id=$1", [child.lotId]);
          }
          const bytes = canonicalBytes(forged).toString('utf8');
          await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [creation.id, bytes]);
          await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE event_id=$1', [creation.id, bytes]);
          const checks = (await runLedgerInvariants(pool, { alert: false })).checks;
          assert.equal(checks.find((row) => row.name === 'item lot custody integrity').ok, true,
            'coherently forged child still agrees with its own current custody');
          assert.equal(checks.find((row) => row.name === 'item lot lineage parity').ok, false,
            `historical source inheritance independently rejects coherent ${field} forgery`);
          await pool.query('UPDATE item_lots SET owner_id=$2,custody_id=$2,depositor_id=$3 WHERE lot_id=$1',
            [child.lotId, operationId, owner.id]);
          await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [creation.id, creation.snapshot_json]);
          await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE event_id=$1', [creation.id, creation.snapshot_json]);
          assert.deepEqual(await snapshot(), before);
        }
        const childPin = await subject(child.lotId);
        const wholeSplit = issue(definition, { kind: 'split', requirements: [{ kind: 'lot_exact', lotId: child.lotId, quantity: 3 }],
          custody: childPin.expected.custody }, operationOwner);
        const grandchild = await wholeSplit.run(); history.push(wholeSplit);
        const exhausted = (await pool.query('SELECT * FROM item_lots WHERE lot_id=$1', [child.lotId])).rows[0];
        assert.equal(exhausted.state, 'exhausted'); assert.equal(exhausted.owner_id, operationId);
        for (const field of ['custody_state', 'custody_scope', 'custody_id', 'depositor_scope', 'depositor_id']) assert.equal(exhausted[field], null);
        const grandchildPin = await subject(grandchild.lotId);
        const childRelease = issue(definition, { kind: 'transition', transition: { kind: 'release', subject: grandchildPin, depositor: owner },
          requirements: [{ kind: 'lot_exact', lotId: grandchild.lotId, quantity: 3 }] });
        assert.deepEqual((await childRelease.run()).after.owner, owner); history.push(childRelease);
      }
      const release = await move('release', { depositor: owner }); assert.deepEqual(release.after.owner, owner);
      if (storageKind === 'unique') {
        // DELETE acknowledgement failures restore the custody claim before a same-key retry.
        for (const kind of ['release', 'consume_unique']) for (const timing of ['before', 'after']) {
          const fresh = await issue(definition, { kind: 'grant_unique', output }).run();
          const direct = (await subject(fresh.id)).expected;
          await issue(definition, { kind: 'transition', transition: { kind: 'escrow',
            subject: { storageKind, itemId: fresh.id, expected: direct }, operationId },
            requirements: [{ kind: 'unique_exact', itemId: fresh.id, expected: direct }] }).run();
          const pin = await subject(fresh.id), action = issue(definition, { kind: 'transition',
            transition: { kind, subject: pin, depositor: owner },
            requirements: [{ kind: 'unique_exact', itemId: fresh.id, expected: pin.expected }] });
          const before = await snapshot(), fault = injectSqlFailure(pool, { table: 'operation_escrow', operation: 'DELETE', timing, occurrence: 1 });
          fixture.pool = fault.pool;
          try { await assert.rejects(action.run, { code: 'injected_failure' }); }
          finally { fixture.pool = pool; fault.restore(); }
          assert.deepEqual(await snapshot(), before, `${kind} custody DELETE/${timing} is atomic`);
          const retried = await action.run(); assert.deepEqual(await action.run(), retried);
          assert.equal(retried.after.uniqueState, kind === 'release' ? 'active' : 'consumed');
        }
        const destination = { scope: 'account', id: `${owner.id}-recipient` };
        await pool.query('INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,\'guest\',$1)', [destination.id]);
        const transfer = await move('transfer_unique', { destination });
        assert.deepEqual(transfer.after.owner, destination); assert.equal(transfer.after.uniqueState, 'active');
        const pin = await subject(), transition = { kind: 'consume_unique', subject: pin, depositor: null };
        const request = lotRequest(destination, definition); request.request.authority.itemTransitions = [transition];
        const recipient = { pool, permissions: { actorAccountId: destination.id, alive: true, role: 'holder', revision: 1, consent: true },
          issuedActions: Object.freeze({ consume: Object.freeze({ kind: 'transition', request, role: 'holder', revision: 1,
            requirements: [{ kind: 'unique_exact', itemId: subjectId, expected: pin.expected }] }) }) };
        const consumed = await runTrustedDormantItemAction(recipient, { issuedActionId: 'consume' });
        assert.equal(consumed.after.uniqueState, 'consumed'); assert.equal(consumed.removedQuantity, 1);
        recipient.permissions.alive = false;
        assert.deepEqual(await runTrustedDormantItemAction(recipient, { issuedActionId: 'consume' }), consumed);
        // A separate exact unique proves escrow consumption without reusing a consumed identity.
        const another = issue(definition, { kind: 'grant_unique', output });
        const fresh = await another.run(); history.push(another);
        const expected = { definitionHash: definition.definitionHash, owner, state: 'active', custody: { state: 'direct', scope: null, id: null },
          qualityBand: null, qualityStateDigest: null, conditionSummary: null, exportPolicy: 'ineligible' };
        const escrowAction = issue(definition, { kind: 'transition', transition: { kind: 'escrow', subject: { storageKind, itemId: fresh.id, expected }, operationId },
          requirements: [{ kind: 'unique_exact', itemId: fresh.id, expected }] });
        await escrowAction.run(); history.push(escrowAction);
        const escrowExpected = { ...expected, owner: { scope: 'operation', id: operationId }, state: 'escrowed',
          custody: { state: 'escrowed', scope: 'operation', id: operationId } };
        const consumeAction = issue(definition, { kind: 'transition', transition: { kind: 'consume_unique',
          subject: { storageKind, itemId: fresh.id, expected: escrowExpected }, depositor: owner },
          requirements: [{ kind: 'unique_exact', itemId: fresh.id, expected: escrowExpected }] });
        assert.equal((await consumeAction.run()).after.uniqueState, 'consumed'); history.push(consumeAction);
        // Replacing the living actor must never replace the recorded character depositor.
        const originalOperation = fixture.operation, deadOwner = { scope: 'character', id: originalOperation.characterId };
        const held = await issue(definition, { kind: 'grant_unique', output: { ...output, owner: deadOwner } }, deadOwner).run();
        const heldExpected = { ...expected, owner: deadOwner };
        await issue(definition, { kind: 'transition', transition: { kind: 'escrow', operationId,
          subject: { storageKind, itemId: held.id, expected: heldExpected } },
          requirements: [{ kind: 'unique_exact', itemId: held.id, expected: heldExpected }] }, deadOwner).run();
        await pool.query('UPDATE characters SET alive=false WHERE id=$1', [deadOwner.id]);
        const replacementId = `replacement-${randomUUID()}`;
        await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES ($1,$2,$1,1)', [replacementId, owner.id]);
        await pool.query('UPDATE world_operation_roles SET character_id=$2 WHERE operation_id=$1', [operationId, replacementId]);
        fixture.operation = Object.freeze({ ...originalOperation, characterId: replacementId });
        const heldEscrow = { ...heldExpected, owner: { scope: 'operation', id: operationId }, state: 'escrowed',
          custody: { state: 'escrowed', scope: 'operation', id: operationId } };
        const releaseDead = issue(definition, { kind: 'transition', transition: { kind: 'release', depositor: deadOwner,
          subject: { storageKind, itemId: held.id, expected: heldEscrow } },
          requirements: [{ kind: 'unique_exact', itemId: held.id, expected: heldEscrow }] });
        const recovered = await releaseDead.run(); assert.deepEqual(recovered.after.owner, deadOwner);
        assert.equal((await pool.query('SELECT alive FROM characters WHERE id=$1', [deadOwner.id])).rows[0].alive, false);
        assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [held.id])).rows[0].owner_id, deadOwner.id);
        const returnedState = await snapshot(); assert.deepEqual(await releaseDead.run(), recovered);
        assert.deepEqual(await snapshot(), returnedState, 'dead depositor receipt cannot retarget the replacement actor');
        await pool.query('UPDATE characters SET alive=false WHERE id=$1', [replacementId]);
        await pool.query('UPDATE characters SET alive=true WHERE id=$1', [deadOwner.id]);
        await pool.query('UPDATE world_operation_roles SET character_id=$2 WHERE operation_id=$1', [operationId, deadOwner.id]);
        fixture.operation = originalOperation;
      } else {
      await move('escrow', { operationId });
      const consume = await move(storageKind === 'lot' ? 'consume_escrow_lot' : 'consume_unique', { depositor: owner });
      assert.equal(consume.after.remainingQuantity, 0); assert.equal(consume.after.custody, null); assert.equal(consume.outputOrdinal, null);
      }
      const before = await snapshot(); fixture.permissions.alive = false; fixture.permissions.role = 'removed'; fixture.permissions.revision = 9;
      for (const action of history) await action.run();
      assert.deepEqual(await snapshot(), before, 'closed issued receipts survive complete custody lifecycle and mutable permission changes');
      fixture.permissions.alive = true; fixture.permissions.role = 'custodian'; fixture.permissions.revision = 1;
      for (const action of history.filter((action) => action.request.request.authority.itemTransitions)) {
        const changes = [
          (r, e) => { e.subject[e.subject.storageKind === 'lot' ? 'lotId' : 'itemId'] = 'different-subject'; },
          (r, e) => { e.subject.expected.qualityBand = 'different-quality'; },
          (r, e) => { e.subject.expected.qualityStateDigest = 'b'.repeat(64); },
          (r, e) => { e.subject.expected.owner.id = 'different-owner'; if (e.subject.expected.custody.state === 'escrowed') e.subject.expected.custody.id = 'different-owner'; },
          (r, e) => { e.subject.expected.definitionHash = 'b'.repeat(64); r.request.authority.inputDefinitionHashes = ['b'.repeat(64)];
            if (e.subject.storageKind === 'lot') e.subject.expected.tradePolicyHash = 'b'.repeat(64); },
          ...(action.request.request.authority.itemTransitions[0].operationId ? [(r, e) => { e.operationId = 'different-operation'; }] : []),
          ...(action.request.request.authority.itemTransitions[0].depositor ? [(r, e) => { e.depositor.id = 'different-depositor'; }] : []),
          ...(action.request.request.authority.itemTransitions[0].destination ? [(r, e) => { e.destination.id = 'different-destination'; }] : []),
        ];
        const before = await snapshot();
        for (const change of changes) {
          const changed = structuredClone(action.request); change(changed, changed.request.authority.itemTransitions[0]);
          await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, changed,
            () => assert.fail('changed pinned transition replay entered callback'))), { code: 'idempotency_conflict' });
        }
        assert.deepEqual(await snapshot(), before, 'each exact transition pin participates in unchanged scoped receipt hashing');
      }
      // These are actual locked permission rows, not merely the producer's secondary policy object.
      for (const [change, restore] of [
        ["UPDATE characters SET alive=false WHERE id=$1", "UPDATE characters SET alive=true WHERE id=$1"],
        ["UPDATE world_operations SET graph_version=9 WHERE id=$1", "UPDATE world_operations SET graph_version=1 WHERE id=$1"],
        ["UPDATE world_operation_roles SET role_id='removed' WHERE operation_id=$1", "UPDATE world_operation_roles SET role_id='custodian' WHERE operation_id=$1"],
      ]) {
        const id = change.includes('characters') ? fixture.operation.characterId : operationId;
        await pool.query(change, [id]); const changed = await snapshot();
        for (const action of history) await action.run();
        assert.deepEqual(await snapshot(), changed, 'matching receipt precedes actual actor/operation/role revalidation');
        const fresh = issue(definition, { kind: storageKind === 'lot' ? 'grant_lot' : 'grant_unique', output });
        await assert.rejects(fresh.run, { code: 'item_mutation_authority' });
        await assert.rejects(fresh.run, { code: 'item_mutation_authority' });
        assert.deepEqual(await snapshot(), changed, 'same-key fresh permission rejection leaves no committed effects');
        await pool.query(restore, [id]);
      }
      for (const extra of [{ qualityBand: 'forged' }, { qualityStateDigest: 'b'.repeat(64) }, { operationId: 'other' }, { depositor: owner }]) {
        const before = await snapshot();
        await assert.rejects(() => runTrustedDormantItemAction(fixture, { issuedActionId: grant.id, ...extra }), { code: 'bad_item_request' });
        assert.deepEqual(await snapshot(), before, 'client cannot augment even a replayed closed issued action');
      }
    }
    const invariant = await runLedgerInvariants(pool, { alert: false });
    assert.equal(invariant.ok, true, JSON.stringify(invariant.checks.filter((check) => !check.ok)));
    const released = (await pool.query("SELECT * FROM item_events WHERE event_kind='unique_released' ORDER BY sequence LIMIT 1")).rows[0];
    await pool.query("UPDATE item_events SET event_kind='unique_escrowed' WHERE id=$1", [released.id]);
    assert.equal((await runLedgerInvariants(pool, { alert: false })).checks.find((row) => row.name === 'item lot lineage parity').ok, false,
      'valid SQL event name cannot disagree with its normalized transition branch');
    await pool.query("UPDATE item_events SET event_kind='unique_released' WHERE id=$1", [released.id]);
    // Task5 owns migration. This SQL-only observation fixture must preserve already-consumed
    // legacy creation/history; it is not a grant/transition producer or migration implementation.
    const legacy = await withItemTransaction(pool, (q) => createItem(q, owner, 'historical:unique', 'awarded', randomUUID()));
    const historicalConsumeKey = randomUUID();
    const historicalConsume = () => withItemTransaction(pool, (q) => consumeItem(q, owner, legacy.id, 'historical consumed fixture', historicalConsumeKey));
    const historicalResult = await historicalConsume();
    const old = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [legacy.id])).rows[0];
    const oldHistory = (await pool.query('SELECT * FROM item_events WHERE item_id=$1 ORDER BY sequence', [legacy.id])).rows;
    const source = materialSource({ kind: 'item', stackable: false, qualityMode: 'fixed', maximumLotQuantity: 1,
      tradePolicy: { mode: 'closed', transferable: false }, definitionVersion: 42 }); source.version = 42;
    const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
    const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const mutationId = randomUUID(), eventId = randomUUID(), key = `migration-observation:${randomUUID()}`;
    await pool.query(`INSERT INTO item_mutation_guards
      (idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,reservation_id,mutation_id,result_json,completed_at)
      VALUES ($1,'craft','account',$2,$3,$4,$5,'{"observation":true}',now())`, [key, owner.id, 'a'.repeat(64), randomUUID(), mutationId]);
    await pool.query(`UPDATE item_instances SET logical_item_id=$2,definition_hash=$3,quality_band='standard',
      trade_policy_hash=$3,export_policy='ineligible',provenance_class='migration_origin',provenance_digest=$4,
      mutation_id=$5,output_ordinal=0 WHERE id=$1`, [legacy.id, definition.logicalItemId, definition.definitionHash, 'a'.repeat(64), mutationId]);
    const observed = { id: legacy.id, logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
      owner, state: 'consumed', custody: null, qualityBand: 'standard', qualityStateDigest: null,
      tradePolicyHash: definition.definitionHash, conditionSummary: null, exportPolicy: 'ineligible',
      mutationId, outputOrdinal: 0, createdAt: new Date(old.created_at).toISOString(), updatedAt: new Date(old.updated_at).toISOString(),
      consumedAt: new Date(old.consumed_at).toISOString(), provenanceClass: 'migration_origin', provenanceDigest: 'a'.repeat(64) };
    const bytes = canonicalBytes(observed).toString('utf8');
    await pool.query(`INSERT INTO item_events
      (id,event_key,event_kind,item_id,template_id,quality,quantity_delta,quantity_before,quantity_after,
       reason,idempotency_key,event_branch,mutation_id,event_ordinal,definition_hash,snapshot_json)
      VALUES ($1,'observation:0','migration_origin',$2,'historical:unique','standard',0,0,0,
        'migration observation fixture',$3,'observation',$4,0,$5,$6)`, [eventId, legacy.id, key, mutationId, definition.definitionHash, bytes]);
    await pool.query(`INSERT INTO item_mutation_outputs
      (mutation_id,output_ordinal,event_id,event_branch,definition_hash,item_id,quantity,transition_kind,snapshot_json,
       attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
      VALUES ($1,0,$2,'observation',$3,$4,0,'migration_origin',$5,$1,0,1)`, [mutationId, eventId, definition.definitionHash, legacy.id, bytes]);
    const migrated = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [legacy.id])).rows[0];
    for (const field of ['id', 'template_id', 'owner_scope', 'owner_id', 'state', 'created_at', 'updated_at', 'consumed_at']) assert.deepEqual(migrated[field], old[field]);
    assert.deepEqual((await pool.query("SELECT * FROM item_events WHERE item_id=$1 AND event_branch='legacy' ORDER BY sequence", [legacy.id])).rows, oldHistory);
    const beforeHistoricalReplay = await snapshot();
    assert.deepEqual(await historicalConsume(), historicalResult, 'completed legacy receipt replays even after an exact migration observation attaches');
    assert.deepEqual(await snapshot(), beforeHistoricalReplay);
    for (const mode of ['string', 'v1', 'v2']) {
      const created = await withItemTransaction(pool, (q) => createItem(q, owner, `legacy:compat-${mode}`, 'awarded', randomUUID()));
      const destination = { scope: 'account', id: `legacy-compatible-${mode}` }, history = [];
      const legacyAction = async (rootOwner, leaf) => {
        const key = randomUUID(), request = lotRequest(rootOwner, definition, { actorAccountId: owner.id, idempotencyKey: key });
        request.request.authority.inputDefinitionHashes = []; request.request.authority.outputDefinitionHashes = [];
        const run = () => withItemTransaction(pool, (q) => mode === 'string' ? leaf(q, key)
          : mode === 'v1' ? withItemMutation(q, rootOwner, 'craft', key,
            { itemAuthority: { destinations: [owner, destination], operations: [operationId] } }, (token) => leaf(q, token))
            : withLotMutation(q, request, (token) => leaf(q, token)));
        const result = await run(); history.push({ run, result }); return result;
      };
      let heldOwner = owner;
      if (mode !== 'v2') {
        assert.deepEqual((await legacyAction(owner, (q, key) => transferItem(q, owner, destination, created.id, 'legacy transfer', key))).owner, destination);
        heldOwner = destination;
        assert.equal((await legacyAction(destination, (q, key) => escrowItem(q, destination, operationId, created.id, 'legacy escrow', key))).state, 'escrowed');
        assert.deepEqual((await legacyAction({ scope: 'operation', id: operationId },
          (q, key) => releaseEscrow(q, operationId, destination, created.id, 'legacy release', key))).owner, destination);
      }
      assert.equal((await legacyAction(heldOwner, (q, key) => consumeItem(q, heldOwner, created.id, 'legacy consume', key))).state, 'consumed');
      const row = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [created.id])).rows[0];
      for (const field of ['logical_item_id', 'definition_hash', 'quality_band', 'quality_state_digest', 'trade_policy_hash',
        'condition_summary', 'export_policy', 'provenance_class', 'provenance_digest', 'mutation_id', 'output_ordinal']) assert.equal(row[field], null);
      const beforeReplay = await snapshot();
      for (const action of history) assert.deepEqual(await action.run(), action.result, `${mode} completed receipt precedes current-state lookup`);
      assert.deepEqual(await snapshot(), beforeReplay, `${mode} legacy compatibility remains all-null and exactly replayable`);
    }
    const afterObservation = await runLedgerInvariants(pool, { alert: false });
    assert.equal(afterObservation.ok, true, JSON.stringify(afterObservation.checks.filter((check) => !check.ok)));
  }, existingPool);
  await withItemFixture(async ({ pool, accountOwner: owner, definition: lotDefinition, snapshot }) => {
    assert.equal(typeof lots.grantUnique, 'function', 'exact storage must provide grantUnique');
    for (const [index, mode] of ['none', 'bounded'].entries()) {
      const source = materialSource({ kind: 'item', stackable: false, qualityMode: mode,
        maximumLotQuantity: 1, definitionVersion: index + 20 });
      source.version = index + 20;
      const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
      const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
      const output = { logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
        owner, qualityBand: null, qualityStateDigest: mode === 'none' ? null : '3594c544fc56792bc96af930461e8859ea7b2997fcf32cb8d570422f717e30ec',
        tradePolicyHash: definition.definitionHash, conditionSummary: null, exportPolicy: 'ineligible',
        provenanceClass: 'crafted', provenanceDigest: 'b'.repeat(64) };
      for (const initiallyValid of [true, false]) {
        const supplied = structuredClone(definition); if (!initiallyValid) supplied.stackable = true;
        const entered = deferred(), release = deferred(); let paused = false;
        const lookupPool = forwardPool(pool, { before: async (sql) => {
          if (!paused && sql.includes('FROM item_definition_versions')) { paused = true; entered.resolve(); await release.promise; }
        } });
        const before = await snapshot(), lookupRequest = lotRequest(owner, definition);
        const running = withItemTransaction(lookupPool, (q) => withLotMutation(q, lookupRequest,
          (token) => lots.grantUnique(q, token, supplied, output)));
        const settled = running.then((value) => ({ value }), (error) => ({ error }));
        await entered.promise; supplied.stackable = initiallyValid; release.resolve();
        const result = await settled;
        if (initiallyValid) {
          assert.equal(result.error, undefined, 'valid unique definition is detached before lookup suspension');
          assert.equal(result.value.definitionHash, definition.definitionHash);
        } else {
          assert.equal(result.error?.code, 'bad_item_request', 'correcting a contradictory unique definition after entry cannot admit it');
          assert.deepEqual(await snapshot(), before);
        }
      }
      for (const hostile of ['accessor', 'proxy']) {
        let evaluations = 0, lookups = 0;
        const supplied = hostile === 'proxy' ? new Proxy(definition, { get() { evaluations++; throw Error('must not inspect proxy'); } })
          : Object.defineProperty(structuredClone(definition), 'stackable', { enumerable: true, get() { evaluations++; return false; } });
        const checkedPool = forwardPool(pool, { before: async (sql) => { if (sql.includes('FROM item_definition_versions')) lookups++; } });
        const before = await snapshot();
        await assert.rejects(() => withItemTransaction(checkedPool, (q) => withLotMutation(q, lotRequest(owner, definition),
          (token) => lots.grantUnique(q, token, supplied, output))), { code: 'bad_item_request' });
        assert.equal(evaluations, 0); assert.equal(lookups, 0, 'malformed unique definition rejects before intrinsic I/O');
        assert.deepEqual(await snapshot(), before);
      }
      const request = lotRequest(owner, definition);
      const fixture = { pool, permissions: { actorAccountId: owner.id, alive: true, role: 'maker', revision: 1, consent: true },
        issuedActions: Object.freeze({ 'unique-grant': Object.freeze({ kind: 'grant_unique', request,
          role: 'maker', revision: 1, definition, output }) }) };
      const result = await runTrustedDormantItemAction(fixture, { issuedActionId: 'unique-grant' });
      assert.equal(result.definitionHash, definition.definitionHash); assert.equal(result.qualityBand, null);
      assert.equal(result.qualityStateDigest, output.qualityStateDigest); assert.equal(result.outputOrdinal, 0);
      assert.deepEqual(result.custody, { state: 'direct', scope: null, id: null });
      assert.equal(result.state, 'active'); assert.equal(result.exportPolicy, 'ineligible');
      assert.equal(Object.hasOwn(result, 'provenanceDigest'), false);
      const committed = await snapshot(); fixture.permissions.alive = false; fixture.permissions.role = 'removed'; fixture.permissions.revision++;
      assert.deepEqual(await runTrustedDormantItemAction(fixture, { issuedActionId: 'unique-grant' }), result);
      assert.deepEqual(await snapshot(), committed, 'closed producer resolves completed grant before mutable permission checks');
      for (const change of [{ qualityBand: 'injected' }, { destination: owner }, { quantity: 50 }, { effect: 'mint' }]) {
        await assert.rejects(() => runTrustedDormantItemAction(fixture, { issuedActionId: 'unique-grant', ...change }), { code: 'bad_item_request' });
      }
      for (const alter of [{ provenanceClass: 'migration_origin' }, { conditionSummary: {} }, { exportPolicy: 'eligible' },
        { qualityStateDigest: 'bad' }, { owner: { ...owner, id: 'other-owner' } }, { definitionHash: 'c'.repeat(64) }]) {
        await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition),
          (token) => lots.grantUnique(q, token, definition, { ...output, ...alter }))), { code: 'bad_item_request' });
      }
      for (const table of ['item_instances', 'item_events', 'item_mutation_outputs']) for (const timing of ['before', 'after']) {
        const before = await snapshot(), fault = injectSqlFailure(pool, { table, timing, occurrence: 1 });
        try { await assert.rejects(() => withItemTransaction(fault.pool, (q) => withLotMutation(q, lotRequest(owner, definition),
          (token) => lots.grantUnique(q, token, definition, output))), { code: 'injected_failure' }); }
        finally { fault.restore(); }
        assert.deepEqual(await snapshot(), before, `unique ${table}/${timing} restores all attachments`);
      }
      const mixed = lotRequest(owner, definition); mixed.request.authority.outputDefinitionHashes.push(lotDefinition.definitionHash);
      const pair = await withItemTransaction(pool, (q) => withLotMutation(q, mixed, async (token) => [
        await lots.grantLot(q, token, lotDefinition, lotOutput(owner, lotDefinition)),
        await lots.grantUnique(q, token, definition, output) ]));
      assert.equal(pair[0].outputOrdinal, 0); assert.equal(pair[1].outputOrdinal, 1);
      const beforeCollision = await snapshot();
      await assert.rejects(() => pool.query("UPDATE item_mutation_outputs SET output_ordinal=0,transition_kind='escrow' WHERE item_id=$1", [pair[1].id]),
        (error) => dbCaps.skipLocked ? error.code === '23505' && error.constraint === 'item_output_pk'
          : String(error.message).includes('item_output_event_fk'), // pg-mem checks the immutable event FK before its PK
      'unique output cannot collide with the same-root lot ordinal');
      assert.deepEqual(await snapshot(), beforeCollision, 'cross-kind collision refusal changes no attachment/event/guard bytes');
      const characterId = `external-${randomUUID()}`, carId = randomUUID();
      await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES ($1,$2,$1,1)', [characterId, owner.id]);
      await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES ($1,$2,'fixture','base',17)", [carId, characterId]);
      const externalRequest = lotRequest(owner, definition); externalRequest.request.authority.outputDefinitionHashes.push(lotDefinition.definitionHash);
      const externalAction = (target) => withItemTransaction(target, (q) => withLotMutation(q, externalRequest, async (token) => {
        const cash = (await q.query('SELECT cash FROM characters WHERE id=$1 FOR UPDATE', [characterId])).rows[0].cash;
        registerItemTransactionUndo(q, () => q.query('UPDATE characters SET cash=$2 WHERE id=$1', [characterId, cash]));
        await q.query('UPDATE characters SET cash=cash - 13 WHERE id=$1', [characterId]);
        const damage = (await q.query('SELECT dmg FROM cars WHERE id=$1 FOR UPDATE', [carId])).rows[0].dmg;
        registerItemTransactionUndo(q, () => q.query('UPDATE cars SET dmg=$2 WHERE id=$1', [carId, damage]));
        await q.query('UPDATE cars SET dmg=23 WHERE id=$1', [carId]);
        await ledger(q, { characterId, currency: 'cash', amount: -13, reason: 'craft:dormant-fixture' }, {
          beforeInsert: (id) => registerItemTransactionUndo(q, () => q.query('DELETE FROM transactions WHERE id=$1', [id])),
        });
        return [await lots.grantLot(q, token, lotDefinition, lotOutput(owner, lotDefinition)),
          await lots.grantUnique(q, token, definition, output)];
      }));
      for (const timing of ['before', 'after']) {
        const before = await snapshot(), fault = injectSqlFailure(pool, { table: 'item_mutation_outputs', timing, occurrence: 2 });
        try { await assert.rejects(() => externalAction(fault.pool), { code: 'injected_failure' }); }
        finally { fault.restore(); }
        assert.deepEqual(await snapshot(), before, `mixed lot/unique + cash/ledger/car output ${timing} restores the original root snapshot`);
      }
      const retried = await externalAction(pool), externalCommitted = await snapshot();
      assert.deepEqual(await externalAction(pool), retried); assert.deepEqual(await snapshot(), externalCommitted);
      assert.equal(String((await pool.query('SELECT cash FROM characters WHERE id=$1', [characterId])).rows[0].cash), '487');
      assert.equal((await pool.query('SELECT dmg FROM cars WHERE id=$1', [carId])).rows[0].dmg, 23);
    }
    for (const [version, kind, stackable] of [[22, 'concept', false], [23, 'item', true], [24, 'material', false]]) {
      const source = materialSource({ kind, stackable, maximumLotQuantity: 1, definitionVersion: version,
        tradePolicy: { mode: 'closed', transferable: false } }); source.version = version;
      if (kind === 'concept') source.definitions[0] = { id: source.definitions[0].id, kind, definitionVersion: version };
      const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
      const pinned = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
      const uniqueOutput = { logicalItemId: pinned.logicalItemId, definitionHash: pinned.definitionHash, owner,
        qualityBand: null, qualityStateDigest: null, tradePolicyHash: pinned.definitionHash, conditionSummary: null,
        exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) };
      const before = await snapshot();
      const uniqueGrant = () => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, pinned),
        (token) => lots.grantUnique(q, token, pinned, uniqueOutput)));
      const lotGrant = () => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, pinned),
        (token) => lots.grantLot(q, token, pinned, lotOutput(owner, pinned, { quantity: 1 }))));
      if (kind === 'concept' || stackable) await assert.rejects(uniqueGrant, { code: 'bad_item_request' });
      if (kind === 'concept' || !stackable) await assert.rejects(lotGrant, { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before, 'real intrinsic kind/stackability rejection is independent of caller projection substitution');
      if (stackable) assert.equal((await lotGrant()).originalQuantity, 1, 'stackable economic item definitions are accepted');
      if (kind === 'material') {
        const item = await uniqueGrant(), expected = { definitionHash: pinned.definitionHash, owner, state: 'active',
          custody: item.custody, qualityBand: null, qualityStateDigest: null, conditionSummary: null, exportPolicy: 'ineligible' };
        const request = lotRequest(owner, pinned); request.request.authority.itemTransitions = [{ kind: 'transfer_unique',
          subject: { storageKind: 'unique', itemId: item.id, expected }, destination: { scope: 'account', id: 'other-holder' } }];
        const current = await snapshot();
        await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, request, (token) =>
          lots.withCompleteItemCandidates(q, token, createItemLockTrace(), { root: { owner, authority: request.request.authority },
            requirements: [{ kind: 'unique_exact', itemId: item.id, expected }] }, () => lots.applyItemTransition(q, token, 0)))),
        { code: 'item_mutation_authority' });
        assert.deepEqual(await snapshot(), current, 'closed nontransferable unique cannot enter ordinary transfer');
      }
    }
  }, existingPool);
  await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    const definitions = new Map([['none', definition]]);
    for (const [index, mode] of ['fixed', 'inherited', 'bounded'].entries()) {
      const source = materialSource({ qualityMode: mode, definitionVersion: index + 2 });
      source.version = index + 2;
      const artifact = compileFixture(source);
      await storeSealedBundle(pool, artifact.request);
      definitions.set(mode, await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash));
    }
    for (const [policyId, mode, band] of [['fixed', 'fixed', 'Pristine Ω'], ['categorical', 'bounded', 'categorical'], ['numeric', 'bounded', 'fine']]) {
      const result = await withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definitions.get(mode)),
        (mutation) => runTrustedDormantLotGrant({ client, mutation, definitions, owner }, { policyId, quantity: 2 })));
      assert.equal(result.qualityBand, band);
      if (policyId === 'numeric') assert.equal(result.qualityStateDigest, '3594c544fc56792bc96af930461e8859ea7b2997fcf32cb8d570422f717e30ec');
      else assert.equal(result.qualityStateDigest, null);
    }
    for (const input of [{ policyId: 'fixed', quantity: 2, qualityBand: 'injected' },
      { policyId: 'fixed', quantity: 2, qualityStateDigest: 'a'.repeat(64) },
      { policyId: 'fixed', quantity: 2, quality: 100 }, { policyId: 'invalidNumeric', quantity: 2 }]) {
      const before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definitions.get('bounded')),
        (mutation) => runTrustedDormantLotGrant({ client, mutation, definitions, owner }, input))), { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before, 'client quality never reaches grant or successful guard');
    }
    const accepted = [
      ['none', null, null], ['fixed', 'standard', null], ['fixed', null, 'a'.repeat(64)],
      ['fixed', 'Pristine Ω', 'b'.repeat(64)], ['inherited', null, null],
      ['inherited', 'standard', null], ['inherited', null, 'c'.repeat(64)],
      ['inherited', 'pristine', 'd'.repeat(64)], ['bounded', 'categorical', null],
      ['bounded', null, 'e'.repeat(64)], ['bounded', 'fine', 'f'.repeat(64)],
      ['fixed', 'x', null], ['fixed', 'x'.repeat(80), null],
    ];
    for (const [mode, qualityBand, qualityStateDigest] of accepted) {
      const exact = definitions.get(mode), request = lotRequest(owner, exact);
      const result = await withItemTransaction(pool, (client) => withLotMutation(client, request,
        (mutation) => lots.grantLot(client, mutation, exact,
          lotOutput(owner, exact, { qualityBand, qualityStateDigest }))));
      assert.equal(result.qualityBand, qualityBand);
      assert.equal(result.qualityStateDigest, qualityStateDigest);
      assert.equal(result.originalQuantity, 10); assert.equal(result.remainingQuantity, 10);
      assert.equal(Object.hasOwn(result, 'provenanceDigest'), false);
      assert.equal(Object.hasOwn(exact, 'bundleHash'), false);
      const row = (await pool.query('SELECT * FROM item_lots WHERE lot_id=$1', [result.lotId])).rows[0];
      assert.equal(row.definition_hash, exact.definitionHash);
      const outputs = (await pool.query('SELECT * FROM item_mutation_outputs WHERE mutation_id=$1', [result.mutationId])).rows;
      assert.equal(outputs.length, 1); assert.equal(outputs[0].lot_id, result.lotId);
      assert.equal(outputs[0].output_ordinal, result.outputOrdinal);
      assert.equal((await pool.query('SELECT * FROM item_events WHERE mutation_id=$1', [result.mutationId])).rows.length, 1);
      const replay = await withItemTransaction(pool, (client) => withLotMutation(client, request,
        () => assert.fail('completed grant must replay before producer re-entry')));
      assert.deepEqual(replay, result);
    }
    const rejected = [['none', 'standard', null], ['none', null, '0'.repeat(64)],
      ['fixed', null, null], ['bounded', null, null], ['fixed', '', null],
      ['fixed', ' padded', null], ['fixed', 'padded ', null], ['fixed', 'x'.repeat(81), null],
      ['fixed', 1, null], ['fixed', {}, null], ['fixed', 'good', 'A'.repeat(64)],
      ['fixed', 'good', 'a'.repeat(63)], ['fixed', 'good', 'a'.repeat(65)],
      ['fixed', 'good', 'g'.repeat(64)], ['fixed', 'good', 4]];
    for (const [mode, qualityBand, qualityStateDigest] of rejected) {
      const exact = definitions.get(mode), before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, exact),
        (mutation) => lots.grantLot(client, mutation, exact,
          lotOutput(owner, exact, { qualityBand, qualityStateDigest })))), { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before, 'invalid representation leaves no durable writes');
    }
    const malformed = [
      (o) => { delete o.qualityBand; return o; },
      (o) => ({ ...o, qualityBand: undefined }), (o) => ({ ...o, quality: 'caller' }),
      (o) => Object.defineProperty(o, 'qualityBand', { get() { assert.fail('accessor evaluated'); } }),
      (o) => new Proxy(o, { ownKeys() { assert.fail('proxy evaluated'); } }),
      (o) => ({ ...o, owner: { ...owner, extra: 1 } }),
      (o) => ({ ...o, tradePolicyHash: 'b'.repeat(64) }),
      (o) => ({ ...o, logicalItemId: 'substituted::material' }),
      (o) => ({ ...o, provenanceClass: 'migration_origin' }),
      (o) => ({ ...o, provenanceCoalescingClass: 'bad token' }),
      (o) => ({ ...o, binding: 'a'.repeat(129) }),
      (o) => ({ ...o, provenanceDigest: null }),
      (o) => ({ ...o, custody: { state: 'escrowed', scope: 'operation', id: 'untrusted' } }),
    ];
    for (const change of malformed) {
      const before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
        (mutation) => lots.grantLot(client, mutation, definition, change(lotOutput(owner, definition))))), { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before);
    }
    for (const change of [ { maximumLotQuantity: 999999 }, { kind: 'concept' }, { stackable: false },
      { ownerScopes: ['character'] }, { qualityMode: 'invented' }, { bundleHash: 'a'.repeat(64) } ]) {
      const before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
        (mutation) => lots.grantLot(client, mutation, { ...definition, ...change }, lotOutput(owner, definition)))), { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before, 'caller definition projection cannot substitute immutable registry policy');
    }
    const capSource = materialSource({ definitionVersion: 5, maximumLotQuantity: 7 }); capSource.version = 5;
    const capArtifact = compileFixture(capSource); await storeSealedBundle(pool, capArtifact.request);
    const capped = await definitionByHash(pool, capArtifact.expectedDefinitions[0].definitionHash);
    await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, capped),
      (mutation) => lots.grantLot(client, mutation, capped, lotOutput(owner, capped, { quantity: 8 })))), { code: 'qty' });
    const boundaryOutput = lotOutput(owner, definition);
    await assert.rejects(() => lots.grantLot(pool, {}, definition, boundaryOutput), { code: 'item_transaction_required' });
    await assert.rejects(() => withPhase2Read(pool, (client) => lots.grantLot(client, {}, definition, boundaryOutput)), { code: 'item_transaction_required' });
    let expired;
    await withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition), async (mutation) => { expired = mutation; return null; }));
    for (const token of [{}, expired]) {
      const before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
        () => lots.grantLot(client, token, definition, boundaryOutput))), { code: 'item_transaction_required' });
      assert.deepEqual(await snapshot(), before);
    }
    await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
      (mutation) => lots.grantLot({ query: (...args) => client.query(...args) }, mutation, definition, boundaryOutput))), { code: 'item_transaction_required' });
    await assert.rejects(() => withItemTransaction(pool, (client) => withItemMutation(client, owner, 'craft', 'v1-grant-refusal', {},
      (mutation) => lots.grantLot(client, mutation, definition, boundaryOutput))), { code: 'item_transaction_required' });
    const privateSource = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1, definitionVersion: 6 });
    privateSource.version = 6;
    const privateArtifact = compileFixture(privateSource); await storeSealedBundle(pool, privateArtifact.request);
    const privateDefinition = await definitionByHash(pool, privateArtifact.expectedDefinitions[0].definitionHash);
    for (const [name, invoke] of lotLeafPrivateCases(lots, owner, definition, privateDefinition)) {
      const cases = [
        ['raw', () => invoke(pool, {})],
        ['registry-only', () => withPhase2Read(pool, (q) => invoke(q, {}))],
        ['fake', () => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition), () => invoke(q, {})))],
        ['expired', () => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition), () => invoke(q, expired)))],
        ['unbranded-client-alias', () => withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition),
          (token) => invoke({ query: (...args) => q.query(...args) }, token)))],
      ];
      for (const [context, run] of cases) {
        const before = await snapshot();
        await assert.rejects(run, { code: 'item_transaction_required' }, `${name}/${context}`);
        assert.deepEqual(await snapshot(), before, `${name}/${context} leaves no committed effects`);
      }
    }
    for (const field of ['binding', 'transferRestriction', 'provenanceCoalescingClass']) {
      for (const length of [1, 128, 129]) {
        const before = await snapshot(), value = 'a'.repeat(length), request = lotRequest(owner, definition);
        const run = () => withItemTransaction(pool, (q) => withLotMutation(q, request,
          (token) => lots.grantLot(q, token, definition, lotOutput(owner, definition, { [field]: value }))));
        if (length === 129) {
          await assert.rejects(run, { code: 'bad_item_request' });
          assert.deepEqual(await snapshot(), before, `${field} rejects 129 bytes without writes`);
        } else assert.equal((await run())[field], value, `${field} accepts and preserves ${length} bytes`);
      }
    }
    for (const changed of [{ owner: { ...owner, id: 'another' } }, { definitionHash: 'f'.repeat(64) }, { direction: 'unknown' }]) {
      const before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
        async (mutation) => assertLotDefinitionPin(client, mutation, { owner, definitionHash: definition.definitionHash, direction: 'output', ...changed }))), { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before);
    }
    const pinnedRequest = lotRequest(owner, definition);
    await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, pinnedRequest,
      async (mutation) => assertLotCandidateRoot(client, mutation,
        { owner, authority: { ...pinnedRequest.request.authority, issuedActionId: 'substituted' } }))), { code: 'bad_item_request' });
    for (const invalid of [0, -1, 1.1, 1000001, Number.MAX_SAFE_INTEGER + 1, NaN, Infinity]) {
      const before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
        (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition, { quantity: invalid })))), { code: 'qty' });
      assert.deepEqual(await snapshot(), before);
    }
    for (const table of ['item_lots', 'item_events', 'item_mutation_outputs']) {
      for (const timing of ['before', 'after']) {
        const before = await snapshot(), request = lotRequest(owner, definition);
        const fault = injectSqlFailure(pool, { table, occurrence: 1, timing });
        await assert.rejects(() => withItemTransaction(fault.pool, (client) => withLotMutation(client, request,
          (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition)))), { code: 'injected_failure' });
        fault.restore(); assert.deepEqual(await snapshot(), before, `${table}/${timing} full rollback`);
        await withItemTransaction(pool, (client) => withLotMutation(client, request,
          (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition))));
      }
    }
    const standardRow = (await pool.query("SELECT * FROM item_lots WHERE definition_hash=$1 AND quality_band='standard'", [definitions.get('inherited').definitionHash])).rows[0];
    const pristineRow = (await pool.query("SELECT * FROM item_lots WHERE definition_hash=$1 AND quality_band='pristine'", [definitions.get('inherited').definitionHash])).rows[0];
    await pool.query("UPDATE item_lots SET quality_band='pristine' WHERE lot_id=$1", [standardRow.lot_id]);
    await pool.query("UPDATE item_lots SET quality_band='standard' WHERE lot_id=$1", [pristineRow.lot_id]);
    const swapped = await runLedgerInvariants(pool, { alert: false });
    assert.equal(swapped.checks.find((row) => row.name === 'item lot lineage parity').ok, false,
      'equal-and-opposite quality swaps cannot erase exact historical attachment identity');
    await pool.query("UPDATE item_lots SET quality_band='standard' WHERE lot_id=$1", [standardRow.lot_id]);
    await pool.query("UPDATE item_lots SET quality_band='pristine' WHERE lot_id=$1", [pristineRow.lot_id]);
    await pool.query('UPDATE item_lots SET provenance_digest=$2 WHERE lot_id=$1', [standardRow.lot_id, 'b'.repeat(64)]);
    assert.equal((await runLedgerInvariants(pool, { alert: false })).checks.find((row) => row.name === 'item lot lineage parity').ok, false,
      'private source provenance remains attached to immutable history');
    await pool.query('UPDATE item_lots SET provenance_digest=$2 WHERE lot_id=$1', [standardRow.lot_id, standardRow.provenance_digest]);
  }, existingPool);
  await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    // A server-ID/clock fixture at the SQL boundary makes FIFO deliberately oppose key order.
    let nextId = 'z-old', nextTime = '2026-01-01T00:00:00.000Z';
    const ids = new Map();
    const fixturePool = forwardPool(pool, {
      before: async (sql, values) => {
        if (sql.startsWith('INSERT INTO item_lots ') || sql.startsWith('INSERT INTO item_instances ')) ids.set(values[0], nextId);
        if (values) for (let i = 0; i < values.length; i++) if (ids.has(values[i])) values[i] = ids.get(values[i]);
      },
      after: async (sql, values, result, q) => {
        if (sql.startsWith('INSERT INTO item_lots ')) {
          await q.query('UPDATE item_lots SET created_at=$2 WHERE lot_id=$1', [values[0], nextTime]);
          result.rows[0].created_at = new Date(nextTime);
        }
      },
    });
    for (const [id, time] of [['z-old', '2026-01-01T00:00:00.000Z'], ['a-new', '2026-01-02T00:00:00.000Z']]) {
      nextId = id; nextTime = time;
      await withItemTransaction(fixturePool, (client) => withLotMutation(client, lotRequest(owner, definition),
        (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition))));
    }
    const admissionLots = [];
    for (const id of ['z-admission', 'a-admission']) {
      nextId = id;
      admissionLots.push(await withItemTransaction(fixturePool, (q) => withLotMutation(q, lotRequest(owner, definition),
        (token) => lots.grantLot(q, token, definition, lotOutput(owner, definition, { binding: 'admission', quantity: 3 })))));
    }
    const admissionPlan = (q, token, request, ids, action) => lots.withCompleteItemCandidates(q, token, createItemLockTrace(),
      { root: { owner, authority: request.request.authority }, requirements: ids.map((lotId) => ({ kind: 'lot_exact', lotId, quantity: 1 })) }, action);
    for (const discoverChild of [false, true]) {
      const request = lotRequest(owner, definition), before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, request, async (token) => {
        const first = await admissionPlan(q, token, request, ['z-admission'], () => discoverChild
          ? lots.splitLot(q, token, 'z-admission', 1, admissionLots[0].custody) : lots.consumeExactLot(q, token, 'z-admission', 1));
        // A fresh trace must not reopen this root after the earlier successful write.
        try { await admissionPlan(q, token, request, [discoverChild ? first.lotId : 'a-admission'],
          () => lots.consumeExactLot(q, token, discoverChild ? first.lotId : 'a-admission', 1)); } catch (error) {
          assert.equal(error.code, 'contention'); // deliberately catch it: root must remain poisoned
        }
        return 'cannot commit a second admission';
      })), { code: 'contention' });
      assert.deepEqual(await snapshot(), before, 'sequential admission/new-child discovery rolls back the entire root');
      const retry = () => withItemTransaction(pool, (q) => withLotMutation(q, request, (token) =>
        admissionPlan(q, token, request, ['a-admission', 'z-admission'], async () => [
          await lots.consumeExactLot(q, token, 'a-admission', 1), await lots.consumeExactLot(q, token, 'z-admission', 1)])));
      const result = await retry(), committed = await snapshot(); assert.deepEqual(await retry(), result);
      assert.deepEqual(await snapshot(), committed, 'fresh same-key root admits one complete set and replays once');
    }
    const overlapRequest = lotRequest(owner, definition), beforeOverlap = await snapshot();
    const entered = deferred(), release = deferred(); let blocked = false;
    const overlapPool = forwardPool(pool, { before: async (sql) => {
      if (!blocked && sql === 'SELECT * FROM item_lots WHERE lot_id=$1') { blocked = true; entered.resolve(); await release.promise; }
    } });
    await assert.rejects(() => withItemTransaction(overlapPool, (q) => withLotMutation(q, overlapRequest, async (token) => {
      await lots.grantLot(q, token, definition, lotOutput(owner, definition, { binding: 'before-overlap' }));
      const first = admissionPlan(q, token, overlapRequest, ['z-admission'], () => lots.consumeExactLot(q, token, 'z-admission', 1));
      const firstSettled = first.then(() => null, (error) => error);
      await entered.promise;
      let secondError;
      try { await admissionPlan(q, token, overlapRequest, [], async () => 'overlap'); } catch (error) { secondError = error; }
      finally { release.resolve(); }
      await firstSettled;
      assert.equal(secondError?.code, 'contention', 'admission must be reserved before the first lookup await');
      return 'caught overlap';
    })), { code: 'contention' });
    assert.deepEqual(await snapshot(), beforeOverlap, 'overlapping admission poisons and restores preceding writes');
    await withItemTransaction(pool, (q) => withLotMutation(q, overlapRequest, (token) =>
      admissionPlan(q, token, overlapRequest, ['z-admission'], () => lots.consumeExactLot(q, token, 'z-admission', 1))));
    const uniqueSource = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1, definitionVersion: 2 });
    uniqueSource.version = 2;
    const uniqueArtifact = compileFixture(uniqueSource); await storeSealedBundle(pool, uniqueArtifact.request);
    const uniqueDefinition = await definitionByHash(pool, uniqueArtifact.expectedDefinitions[0].definitionHash);
    nextId = 'm-middle';
    const uniqueOutput = { logicalItemId: uniqueDefinition.logicalItemId, definitionHash: uniqueDefinition.definitionHash,
      owner, qualityBand: null, qualityStateDigest: null, tradePolicyHash: uniqueDefinition.definitionHash,
      conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) };
    const unique = await withItemTransaction(fixturePool, (q) => withLotMutation(q, lotRequest(owner, uniqueDefinition),
      (token) => lots.grantUnique(q, token, uniqueDefinition, uniqueOutput)));
    assert.equal(unique.id, 'm-middle');
    const expected = { definitionHash: uniqueDefinition.definitionHash, owner, state: 'active',
      custody: { state: 'direct', scope: null, id: null }, qualityBand: null, qualityStateDigest: null,
      conditionSummary: null, exportPolicy: 'ineligible' };
    for (const requirement of [null, { kind: 'unique_exact', itemId: unique.id, expected: { ...expected, state: 'escrowed' } },
      { kind: 'unique_exact', itemId: unique.id, expected: { ...expected, owner: { scope: 'operation', id: 'op-other' } } }]) {
      const bad = lotRequest(owner, uniqueDefinition), before = await snapshot();
      await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, bad, (token) =>
        lots.withCompleteItemCandidates(q, token, createItemLockTrace(), { root: { owner, authority: bad.request.authority },
          requirements: [requirement] }, () => assert.fail('malformed candidate admitted')))), { code: 'bad_item_request' });
      assert.deepEqual(await snapshot(), before);
    }
    const request = lotRequest(owner, definition), one = lotSelector(owner, definition, 4), two = lotSelector(owner, definition, 8);
    request.request.authority.inputDefinitionHashes.push(uniqueDefinition.definitionHash);
    request.request.authority.itemTransitions = [{ kind: 'consume_unique', depositor: null,
      subject: { storageKind: 'unique', itemId: unique.id, expected } }];
    const trace = createItemLockTrace();
    const results = await withItemTransaction(pool, (client) => withLotMutation(client, request,
      (mutation) => lots.withCompleteItemCandidates(client, mutation, trace,
        { root: { owner, authority: request.request.authority }, requirements: [{ kind: 'lot_fifo', selector: one },
          { kind: 'lot_fifo', selector: two }, { kind: 'unique_exact', itemId: unique.id, expected }] },
        async () => {
          assert.deepEqual(trace.snapshot().map((entry) => [entry.subtype, entry.id]),
            [['lot', 'a-new'], ['lot', 'z-old'], ['unique', 'm-middle']], 'all mixed keys lock before the first FIFO leaf');
          return [await lots.consumeLotsFifo(client, mutation, one), await lots.consumeLotsFifo(client, mutation, two),
            await lots.applyItemTransition(client, mutation, 0)];
        })));
    assert.deepEqual(trace.snapshot().map((entry) => entry.id), ['a-new', 'z-old', 'm-middle']);
    assert.equal(results[2].after.uniqueState, 'consumed');
    assert.equal(results[0][0].lotId, 'z-old'); assert.equal(results[1][0].lotId, 'z-old');
    assert.equal(results[1][0].removedQuantity, 6); assert.equal(results[1][1].lotId, 'a-new');
    const before = await snapshot(), driftRequest = lotRequest(owner, definition);
    let injected = false;
    const drift = forwardPool(pool, { before: async (sql, values, q) => {
      if (!injected && sql.includes('FROM item_lots WHERE lot_id=$1 FOR UPDATE')) {
        injected = true;
        await q.query('UPDATE item_lots SET remaining_quantity=remaining_quantity - 1 WHERE lot_id=$1', [values[0]]);
      }
    } });
    await assert.rejects(() => withItemTransaction(drift, (client) => withLotMutation(client, driftRequest,
      (mutation) => lots.withCompleteItemCandidates(client, mutation, createItemLockTrace(),
        { root: { owner, authority: driftRequest.request.authority }, requirements: [{ kind: 'lot_fifo', selector: one }] },
        () => lots.consumeLotsFifo(client, mutation, one)))), { code: 'contention' });
    // The injected external writer is independent of the aborted root. Restore that fixture-only drift.
    await pool.query('UPDATE item_lots SET remaining_quantity=8 WHERE lot_id=$1', ['a-new']);
    assert.deepEqual(await snapshot(), before, 'candidate drift creates no item/event/IO/guard writes');
    const retry = await withItemTransaction(pool, (client) => withLotMutation(client, driftRequest,
      (mutation) => lots.withCompleteItemCandidates(client, mutation, createItemLockTrace(),
        { root: { owner, authority: driftRequest.request.authority }, requirements: [{ kind: 'lot_fifo', selector: one }] },
        () => lots.consumeLotsFifo(client, mutation, one))));
    assert.equal(retry[0].beforeQuantity, 8); assert.equal(retry[0].afterQuantity, 4);
  }, existingPool);
  await withItemFixture(async ({ pool, accountOwner: owner, definition }) => {
    const output = await withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
      (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition))));
    const clean = await runLedgerInvariants(pool, { alert: false });
    const check = clean.checks.find((row) => row.name === 'item lot lineage parity');
    assert.ok(check, 'invariants must independently detect lot attachments and normalized lineage');
    assert.equal(check.ok, true); assert.equal(clean.ok, true);
    await pool.query('UPDATE item_lots SET remaining_quantity=9 WHERE lot_id=$1', [output.lotId]);
    const corrupt = await runLedgerInvariants(pool, { alert: false });
    assert.equal(corrupt.checks.find((row) => row.name === 'item lot conservation').ok, false,
      'direct quantity drift cannot pass the independent ledger oracle');
    await pool.query('UPDATE item_lots SET remaining_quantity=10 WHERE lot_id=$1', [output.lotId]);
    const violations = [
      ['item_lot_custody_ck', '23514', 'UPDATE item_lots SET custody_state=NULL WHERE lot_id=$1', [output.lotId]],
      ['item_lot_custody_ck', '23514', "UPDATE item_lots SET depositor_id='unclaimed' WHERE lot_id=$1", [output.lotId]],
      ['item_output_branch_ck', '23514', 'UPDATE item_mutation_outputs SET lot_id=NULL WHERE lot_id=$1', [output.lotId]],
      ['item_event_quantities', '23514', 'UPDATE item_events SET quantity_delta=0,quantity_after=0 WHERE lot_id=$1', [output.lotId]],
      ['item_lot_quantity_ck', '23514', 'UPDATE item_lots SET remaining_quantity=-1 WHERE lot_id=$1', [output.lotId]],
      ['item_output_lot_fk', '23503', 'UPDATE item_mutation_outputs SET quantity=11,attachment_quantity=11 WHERE lot_id=$1', [output.lotId]],
      ['item_output_event_fk', '23503', "UPDATE item_mutation_outputs SET event_id='absent' WHERE lot_id=$1", [output.lotId]],
      ['item_output_branch_ck', '23514', "UPDATE item_mutation_outputs SET source_input_ordinal=output_ordinal,source_transition_kind='split',transition_kind='split' WHERE lot_id=$1", [output.lotId]],
      ['item_event_kind', '23514', "UPDATE item_events SET event_kind='invented' WHERE lot_id=$1", [output.lotId]],
      ['item_output_pk', '23505', 'INSERT INTO item_mutation_outputs SELECT * FROM item_mutation_outputs WHERE lot_id=$1', [output.lotId]],
    ];
    for (const [constraint, code, sql, values] of violations) {
      await assert.rejects(() => pool.query(sql, values), (error) => dbCaps.skipLocked
        ? error.code === code && error.constraint === constraint
        : String(error.message).includes(constraint === 'item_output_pk' ? 'item_mutation_outputs_pkey' : constraint),
      `${constraint} (${code}) must enforce exact normalized identity`);
    }
  }, existingPool);
  assert.equal(typeof lots.withCompleteItemCandidates, 'function', 'consumption must admit the complete input set before locks');
  await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    const grant = () => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
      (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition))));
    const parent = await grant(), other = await grant();
    for (const table of ['item_events', 'item_mutation_inputs', 'item_lots', 'item_mutation_outputs']) {
      for (const timing of ['before', 'after']) {
        const before = await snapshot(), failedRequest = lotRequest(owner, definition);
        const fault = injectSqlFailure(pool, { table, occurrence: 1, timing });
        await assert.rejects(() => withItemTransaction(fault.pool, (client) => withLotMutation(client, failedRequest,
          (mutation) => lots.withCompleteItemCandidates(client, mutation, createItemLockTrace(),
            { root: { owner, authority: failedRequest.request.authority }, requirements: [{ kind: 'lot_exact', lotId: parent.lotId, quantity: 3 }] },
            () => lots.splitLot(client, mutation, parent.lotId, 3, parent.custody)))), { code: 'injected_failure' });
        fault.restore(); assert.deepEqual(await snapshot(), before, `split ${table}/${timing} unwinds references before physical rows`);
      }
    }
    const beforeOrphan = await snapshot();
    const missingOutput = forwardPool(pool, { after: async (sql, values, result, q) => {
      if (sql.startsWith('INSERT INTO item_mutation_outputs ')) await q.query('DELETE FROM item_mutation_outputs WHERE mutation_id=$1', [values[0]]);
    } });
    await assert.rejects(() => withItemTransaction(missingOutput, (client) => withLotMutation(client, lotRequest(owner, definition),
      (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition)))), { code: 'item_integrity_error' });
    assert.deepEqual(await snapshot(), beforeOrphan, 'reverse participation is checked before guard completion');
    const beforeCaught = await snapshot();
    await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition), async (mutation) => {
      await lots.grantLot(client, mutation, definition, lotOutput(owner, definition));
      try { await lots.grantLot(client, mutation, definition, lotOutput(owner, definition, { quantity: 0 })); } catch {}
      return 'caught';
    })), { code: 'qty' });
    assert.deepEqual(await snapshot(), beforeCaught, 'catching a failed leaf cannot commit preceding lots');
    await pool.query("UPDATE item_lots SET created_at='2026-01-01T00:00:00Z' WHERE lot_id=$1", [parent.lotId]);
    const request = lotRequest(owner, definition), trace = createItemLockTrace();
    const child = await withItemTransaction(pool, (client) => withLotMutation(client, request,
      (mutation) => lots.withCompleteItemCandidates(client, mutation, trace,
        { root: { owner, authority: request.request.authority }, requirements: [{ kind: 'lot_exact', lotId: parent.lotId, quantity: 3 }] },
        () => lots.splitLot(client, mutation, parent.lotId, 3, parent.custody))));
    const parentAfter = (await pool.query('SELECT * FROM item_lots WHERE lot_id=$1', [parent.lotId])).rows[0];
    assert.equal(parentAfter.remaining_quantity + child.remainingQuantity, 10);
    assert.equal(child.originalQuantity, 3); assert.equal(child.definitionHash, parent.definitionHash);
    assert.equal(child.ageBasis, parent.ageBasis); assert.notEqual(child.createdAt, '2026-01-01T00:00:00.000Z');
    const input = (await pool.query('SELECT * FROM item_mutation_inputs WHERE mutation_id=$1', [child.mutationId])).rows[0];
    assert.equal(child.sourceInputOrdinal, input.input_ordinal);
    assert.notEqual(child.outputOrdinal, input.input_ordinal);
    assert.equal(child.sourceInputOrdinal, 0); assert.equal(child.outputOrdinal, 1);
    const consumeRequest = lotRequest(owner, definition), selector = lotSelector(owner, definition, 8);
    const consumed = await withItemTransaction(pool, (client) => withLotMutation(client, consumeRequest,
      (mutation) => lots.withCompleteItemCandidates(client, mutation, createItemLockTrace(),
        { root: { owner, authority: consumeRequest.request.authority }, requirements: [{ kind: 'lot_fifo', selector }] },
        () => lots.consumeLotsFifo(client, mutation, selector))));
    assert.equal(consumed[0].lotId, parent.lotId); assert.equal(consumed[0].removedQuantity, 7);
    assert.equal(consumed.reduce((sum, row) => sum + row.removedQuantity, 0), 8);
    assert.equal((await pool.query('SELECT state FROM item_lots WHERE lot_id=$1', [parent.lotId])).rows[0].state, 'exhausted');
    const debitEvent = (await pool.query("SELECT * FROM item_events WHERE lot_id=$1 AND event_kind='lot_consumed'", [parent.lotId])).rows[0];
    const debitSnapshot = JSON.parse(debitEvent.snapshot_json);
    debitSnapshot.identity.binding = 'forged';
    const forgedSnapshot = canonicalBytes(debitSnapshot).toString('utf8');
    await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [debitEvent.id, forgedSnapshot]);
    await pool.query('UPDATE item_mutation_inputs SET snapshot_json=$2 WHERE event_id=$1', [debitEvent.id, forgedSnapshot]);
    assert.equal((await runLedgerInvariants(pool, { alert: false })).checks.find((row) => row.name === 'item lot lineage parity').ok, false,
      'matching event and IO cannot forge immutable debit identity');
    await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [debitEvent.id, debitEvent.snapshot_json]);
    await pool.query('UPDATE item_mutation_inputs SET snapshot_json=$2 WHERE event_id=$1', [debitEvent.id, debitEvent.snapshot_json]);
    const before = await snapshot(), shortRequest = lotRequest(owner, definition);
    await assert.rejects(() => withItemTransaction(pool, (client) => withLotMutation(client, shortRequest,
      (mutation) => lots.withCompleteItemCandidates(client, mutation, createItemLockTrace(),
        { root: { owner, authority: shortRequest.request.authority }, requirements: [{ kind: 'lot_exact', lotId: parent.lotId, quantity: 1 }] },
        () => lots.consumeExactLot(client, mutation, parent.lotId, 1)))), { code: 'materials' });
    assert.deepEqual(await snapshot(), before, 'exact request cannot fall back to another available lot');
    assert.ok(other.lotId);
    assert.equal(typeof lots.lotInventoryBoard, 'function', 'inventory board must aggregate exact identities without merging lots');
    const board = await lots.lotInventoryBoard(pool, owner, { cursor: null, limit: 100, includeLots: true });
    assert.equal(board.groups.length, 1); assert.equal(board.groups[0].quantity, 12);
    assert.equal(board.lots.length, 2); assert.equal(board.nextCursor, null);
    const identities = [ { binding: 'bound' }, { transferRestriction: 'locked' }, { seasonId: 'season:1' },
      { runId: 'run:1' }, { sourceCapId: 'source:1' }, { expiresAt: '2027-01-01T00:00:00.000Z' },
      { ageBasisAt: '2025-01-01T00:00:00.000Z' }, { provenanceCoalescingClass: 'alternate' } ];
    for (const change of identities) await withItemTransaction(pool, (client) => withLotMutation(client, lotRequest(owner, definition),
      (mutation) => lots.grantLot(client, mutation, definition, lotOutput(owner, definition, change))));
    const grouped = await lots.lotInventoryBoard(pool, owner, { cursor: null, limit: 100, includeLots: true });
    assert.equal(grouped.groups.length, 9, 'each individual identity change separates its aggregate');
    assert.equal(grouped.lots.length, 10, 'matching physical lots remain distinct');
    const first = await lots.lotInventoryBoard(pool, owner, { cursor: null, limit: 3, includeLots: true });
    const second = await lots.lotInventoryBoard(pool, owner, { cursor: first.nextCursor, limit: 3, includeLots: true });
    assert.equal(first.lots.length, 3); assert.equal(second.lots.length, 3);
    assert.equal(new Set([...first.lots, ...second.lots].map((row) => row.lotId)).size, 6);
    await assert.rejects(() => lots.lotInventoryBoard(pool, { ...owner, id: 'other' },
      { cursor: first.nextCursor, limit: 3, includeLots: true }), { code: 'bad_item_request' });
    const boardExpected = [], boardHashes = [];
    for (const version of [2, 3]) {
      const source = materialSource({ definitionVersion: version, qualityMode: 'inherited' }); source.version = version;
      const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
      const exact = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash); boardHashes.push(exact.definitionHash);
      assert.equal(exact.logicalItemId, definition.logicalItemId);
      const tuples = [[null, null, 2], ['standard', null, 3], ['standard', 'a'.repeat(64), 5],
        ['fine', 'a'.repeat(64), 7], ['standard', 'b'.repeat(64), 11]];
      for (const [qualityBand, qualityStateDigest, quantity] of tuples) {
        const physical = [];
        for (const amount of [quantity, 1]) {
          physical.push(await withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, exact),
            (token) => lots.grantLot(q, token, exact, lotOutput(owner, exact, { qualityBand, qualityStateDigest, quantity: amount })))));
        }
        boardExpected.push({ definitionHash: exact.definitionHash, tradePolicyHash: exact.definitionHash,
          qualityBand, qualityStateDigest, quantity: quantity + 1, lotIds: physical.map((row) => row.lotId).sort() });
      }
    }
    assert.notEqual(boardHashes[0], boardHashes[1], 'exact versions carry distinct intrinsic/policy pins');
    const qualityBoard = await lots.lotInventoryBoard(pool, owner, { cursor: null, limit: 100, includeLots: true });
    const actualGroups = qualityBoard.groups.filter((group) => boardHashes.includes(group.definitionHash)).map((group) => ({
      definitionHash: group.definitionHash, tradePolicyHash: group.tradePolicyHash,
      qualityBand: group.qualityBand, qualityStateDigest: group.qualityStateDigest,
      quantity: group.quantity, lotIds: qualityBoard.lots.filter((row) => row.definitionHash === group.definitionHash
        && row.qualityBand === group.qualityBand && row.qualityStateDigest === group.qualityStateDigest)
        .map((row) => row.lotId).sort(),
    }));
    const byIdentity = (a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b));
    assert.deepEqual(actualGroups.sort(byIdentity), boardExpected.sort(byIdentity),
      'literal per-version/band/digest quantities and physical memberships remain separated, while identical pairs aggregate');
    const otherOwner = { scope: 'account', id: `board-other-${randomUUID()}` };
    await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,'guest',$1)", [otherOwner.id]);
    const otherDefinition = await definitionByHash(pool, boardHashes[1]);
    const separatelyOwned = await withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(otherOwner, otherDefinition),
      (token) => lots.grantLot(q, token, otherDefinition, lotOutput(otherOwner, otherDefinition,
        { qualityBand: 'standard', qualityStateDigest: 'a'.repeat(64), quantity: 13 }))));
    const otherBoard = await lots.lotInventoryBoard(pool, otherOwner, { cursor: null, limit: 100, includeLots: true });
    assert.deepEqual(otherBoard.lots.map((row) => row.lotId), [separatelyOwned.lotId]);
    assert.equal(otherBoard.groups.length, 1); assert.equal(otherBoard.groups[0].quantity, 13);
    assert.deepEqual(otherBoard.groups[0].owner, otherOwner);
    assert.deepEqual(await lots.lotInventoryBoard(pool, owner, { cursor: null, limit: 100, includeLots: true }), qualityBoard,
      'changing only direct owner cannot affect the original owner aggregate or physical membership');
    const lineageParent = await grant(), prelude = await grant(), lineageRequest = lotRequest(owner, definition);
    const lineageChild = await withItemTransaction(pool, (q) => withLotMutation(q, lineageRequest, (token) =>
      lots.withCompleteItemCandidates(q, token, createItemLockTrace(), {
        root: { owner, authority: lineageRequest.request.authority }, requirements: [
          { kind: 'lot_exact', lotId: prelude.lotId, quantity: 1 },
          { kind: 'lot_exact', lotId: lineageParent.lotId, quantity: 3 }],
      }, async () => {
        await lots.consumeExactLot(q, token, prelude.lotId, 1);
        return lots.splitLot(q, token, lineageParent.lotId, 3, lineageParent.custody);
      })));
    assert.equal(lineageChild.sourceInputOrdinal, 1); assert.equal(lineageChild.outputOrdinal, 2);
    const lineageEvent = (await pool.query("SELECT * FROM item_events WHERE lot_id=$1 AND event_kind='lot_split_output'",
      [lineageChild.lotId])).rows[0];
    const lineageRow = (await pool.query('SELECT * FROM item_lots WHERE lot_id=$1', [lineageChild.lotId])).rows[0];
    const parity = async () => (await runLedgerInvariants(pool, { alert: false })).checks
      .find((row) => row.name === 'item lot lineage parity').ok;
    assert.equal(await parity(), true);
    for (const ordinal of [null, 0]) {
      await pool.query('UPDATE item_lots SET source_input_ordinal=$2 WHERE lot_id=$1', [lineageChild.lotId, ordinal]);
      assert.equal(await parity(), false, `physical split source ${ordinal} must match its actual debit`);
      await pool.query('UPDATE item_lots SET source_input_ordinal=1 WHERE lot_id=$1', [lineageChild.lotId]);
    }
    const inheritedChanges = [
      ['binding', 'binding', 'forged'], ['transferRestriction', 'transfer_restriction', 'forged'],
      ['seasonId', 'season_id', 'forged'], ['runId', 'run_id', 'forged'], ['sourceCapId', 'source_cap_id', 'forged'],
      ['expiresAt', 'expires_at', '2028-01-01T00:00:00.000Z'], ['ageBasisAt', 'age_basis_at', '2025-02-01T00:00:00.000Z'],
      ['provenanceCoalescingClass', 'provenance_coalescing_class', 'forged'],
      ['provenanceClass', 'provenance_class', 'crafted'], ['provenanceDigest', 'provenance_digest', 'b'.repeat(64)],
      ['qualityBand', 'quality_band', 'forged'], ['qualityStateDigest', 'quality_state_digest', 'c'.repeat(64)],
      ['owner', 'owner_id', 'forged-owner'], ['sourceInputOrdinal', null, 0],
    ];
    for (const [field, column, value] of inheritedChanges) {
      const forged = JSON.parse(lineageEvent.snapshot_json);
      forged[field] = field === 'owner' ? { scope: 'account', id: value } : value;
      if (field === 'ageBasisAt') forged.ageBasis = value;
      const bytes = canonicalBytes(forged).toString('utf8');
      if (column) await pool.query(`UPDATE item_lots SET ${column}=$2 WHERE lot_id=$1`, [lineageChild.lotId, value]);
      await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [lineageEvent.id, bytes]);
      await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE event_id=$1', [lineageEvent.id, bytes]);
      assert.equal(await parity(), false, `split must inherit ${field} from historical source, not merely its own creation`);
      if (column) await pool.query(`UPDATE item_lots SET ${column}=$2 WHERE lot_id=$1`, [lineageChild.lotId, lineageRow[column]]);
      await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [lineageEvent.id, lineageEvent.snapshot_json]);
      await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE event_id=$1', [lineageEvent.id, lineageEvent.snapshot_json]);
    }
    for (const field of ['custody', 'depositor']) {
      const forged = JSON.parse(lineageEvent.snapshot_json);
      forged[field] = field === 'custody' ? { state: 'escrowed', scope: 'operation', id: 'forged-operation' }
        : { scope: 'account', id: 'forged-depositor' };
      const bytes = canonicalBytes(forged).toString('utf8');
      await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [lineageEvent.id, bytes]);
      await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE event_id=$1', [lineageEvent.id, bytes]);
      assert.equal(await parity(), false, `split must inherit historical ${field}`);
      await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [lineageEvent.id, lineageEvent.snapshot_json]);
      await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE event_id=$1', [lineageEvent.id, lineageEvent.snapshot_json]);
    }
    assert.equal(await parity(), true, 'restored lineage and earlier legal escrow/split/release remain valid');
  }, existingPool);
  console.log('phase2-lots: exact lots/uniques, complete mixed candidates, custody/owner transitions, historical lineage, SQL constraints, recovery and replay PASS');
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runLots();
