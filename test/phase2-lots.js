import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { withItemTransaction, withLotMutation, withItemMutation, assertLotCandidateRoot, assertLotDefinitionPin, createItem, consumeItem, transferItem, escrowItem, releaseEscrow, grantStack, registerItemTransactionUndo, inventoryBoard } from '../src/items.js';
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

async function runCustodyIndexInvariants(existingPool) {
  await withItemFixture(async ({ pool, accountOwner: owner }) => {
    const source = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1,
      ownerScopes: ['account', 'project'], definitionVersion: 44 }); source.version = 44;
    const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
    const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const lots = await import('../src/itemlots.js'), exactIds = new Set();
    for (const size of [4, 8]) {
      for (let i = exactIds.size; i < size; i++) {
        const row = await withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, definition),
          m => lots.grantUnique(q, m, definition, { logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
            owner, qualityBand: null, qualityStateDigest: null, tradePolicyHash: definition.definitionHash,
            conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) })));
        exactIds.add(row.id);
        const legacy = await withItemTransaction(pool, q => createItem(q, owner, `custody-scale:${i}`, 'awarded', randomUUID()));
        await withItemTransaction(pool, q => escrowItem(q, owner, 'custody-scale-operation', legacy.id, 'scale custody', randomUUID()));
      }
      // Observe real collector Map operations, not private source text or elapsed time. Only
      // maps populated with actual custody-query row identities count as custody indexes.
      const claims = new Set(), indexes = new Set();
      let custodyReads = 0, indexVisits = 0, uniqueLookups = 0;
      const measured = forwardPool(pool, { after: async (sql, values, result) => {
        if (/^SELECT .* FROM operation_escrow(?: ORDER BY item_id)?$/.test(sql)) {
          custodyReads++; for (const row of result.rows) claims.add(row);
        }
      } });
      const originalSet = Map.prototype.set, originalGet = Map.prototype.get;
      let checked;
      try {
        Map.prototype.set = function (key, value) {
          if (claims.has(value)) { indexes.add(this); indexVisits++; }
          return originalSet.call(this, key, value);
        };
        Map.prototype.get = function (key) {
          if (indexes.has(this) && exactIds.has(key)) uniqueLookups++;
          return originalGet.call(this, key);
        };
        checked = await runLedgerInvariants(measured, { alert: false });
      } finally { Map.prototype.set = originalSet; Map.prototype.get = originalGet; }
      assert.equal(checked.ok, true, JSON.stringify(checked.checks.filter(check => !check.ok)));
      assert.equal(uniqueLookups, size, `${size} direct uniques use one indexed custody lookup each, even with unrelated claims`);
      assert.equal(indexVisits, size, `${size} claims populate the custody index once`);
      assert.equal(indexes.size, 1, 'legacy and normalized reconciliation share one custody index');
      assert.equal(custodyReads, 1, 'the collector reuses the caller custody projection without a duplicate table scan');
    }
    console.log('invariant correction: C custody index visits plus U exact-unique lookups at two scales PASS');
  }, existingPool);
}

// Migration is not implemented here: only the observation attachment is fixture SQL.
// Every legacy history and subsequent exact transition uses its real owned mutation path.
async function runObservedUniqueInvariants(existingPool) {
  await withItemFixture(async ({ pool, accountOwner: owner, snapshot }) => {
    const source = materialSource({ kind: 'item', stackable: false, qualityMode: 'fixed', maximumLotQuantity: 1,
      ownerScopes: ['account', 'character', 'project'], definitionVersion: 43 }); source.version = 43;
    const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
    const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const fixture = { pool, permissions: { actorAccountId: owner.id, alive: true, role: 'custodian', revision: 1, consent: true },
      issuedActions: Object.freeze({}) };
    await prepareDormantOperationFixture(fixture);
    const operationId = fixture.operation.id, character = { scope: 'character', id: fixture.operation.characterId };
    const legacyReceipts = [], exactReceipts = [], observedItems = [];
    const legacyAction = async (leaf) => {
      const key = randomUUID(), run = () => withItemTransaction(pool, q => leaf(q, key));
      const result = await run(); legacyReceipts.push({ run, result }); return result;
    };
    const observe = async (mode) => {
      const initialOwner = mode === 'transferred' ? character : owner;
      const item = await legacyAction((q, key) => createItem(q, initialOwner, `historical:${mode}`, 'awarded', key));
      if (mode === 'transferred') await legacyAction((q, key) => transferItem(q, character, owner, item.id, 'historical transfer', key));
      if (['escrowed', 'released', 'escrow-consumed'].includes(mode)) {
        await legacyAction((q, key) => escrowItem(q, owner, operationId, item.id, 'historical escrow', key));
      }
      if (mode === 'released') await legacyAction((q, key) => releaseEscrow(q, operationId, owner, item.id, 'historical release', key));
      if (['consumed', 'escrow-consumed'].includes(mode)) {
        await legacyAction((q, key) => consumeItem(q, mode === 'consumed' ? owner : { scope: 'operation', id: operationId },
          item.id, 'historical consumption', key));
      }
      const old = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [item.id])).rows[0];
      const oldHistory = (await pool.query('SELECT * FROM item_events WHERE item_id=$1 ORDER BY sequence', [item.id])).rows;
      const mutationId = randomUUID(), eventId = randomUUID(), key = `migration-observation:${randomUUID()}`;
      await pool.query(`INSERT INTO item_mutation_guards
        (idempotency_key,mutation_kind,owner_scope,owner_id,request_hash,reservation_id,mutation_id,result_json,completed_at)
        VALUES ($1,'craft','account',$2,$3,$4,$5,'{"observation":true}',now())`, [key, owner.id, 'a'.repeat(64), randomUUID(), mutationId]);
      await pool.query(`UPDATE item_instances SET logical_item_id=$2,definition_hash=$3,quality_band='standard',
        trade_policy_hash=$3,export_policy='ineligible',provenance_class='migration_origin',provenance_digest=$4,
        mutation_id=$5,output_ordinal=0 WHERE id=$1`, [item.id, definition.logicalItemId, definition.definitionHash, 'a'.repeat(64), mutationId]);
      const observed = { id: item.id, logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
        owner: { scope: old.owner_scope, id: old.owner_id }, state: old.state,
        custody: old.state === 'consumed' ? null : old.state === 'escrowed'
          ? { state: 'escrowed', scope: 'operation', id: operationId } : { state: 'direct', scope: null, id: null },
        ...(old.state === 'escrowed' ? { depositor: owner } : {}),
        qualityBand: 'standard', qualityStateDigest: null, tradePolicyHash: definition.definitionHash,
        conditionSummary: null, exportPolicy: 'ineligible', mutationId, outputOrdinal: 0,
        createdAt: new Date(old.created_at).toISOString(), updatedAt: new Date(old.updated_at).toISOString(),
        consumedAt: old.consumed_at === null ? null : new Date(old.consumed_at).toISOString(),
        provenanceClass: 'migration_origin', provenanceDigest: 'a'.repeat(64) };
      const bytes = canonicalBytes(observed).toString('utf8'), quantity = old.state === 'consumed' ? 0 : 1;
      await pool.query(`INSERT INTO item_events
        (id,event_key,event_kind,item_id,template_id,quality,quantity_delta,quantity_before,quantity_after,
         reason,idempotency_key,event_branch,mutation_id,event_ordinal,definition_hash,snapshot_json)
        VALUES ($1,'observation:0','migration_origin',$2,$3,'standard',0,$4,$4,
          'migration observation fixture',$5,'observation',$6,0,$7,$8)`,
      [eventId, item.id, old.template_id, quantity, key, mutationId, definition.definitionHash, bytes]);
      await pool.query(`INSERT INTO item_mutation_outputs
        (mutation_id,output_ordinal,event_id,event_branch,definition_hash,item_id,quantity,transition_kind,snapshot_json,
         attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
        VALUES ($1,0,$2,'observation',$3,$4,0,'migration_origin',$5,$1,0,1)`,
      [mutationId, eventId, definition.definitionHash, item.id, bytes]);
      const record = { item, old, oldHistory, mutationId, eventId, observed };
      observedItems.push(record); return record;
    };
    const move = async (record, kind, extra = {}, expectedOverride = {}) => {
      const row = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [record.item.id])).rows[0];
      const expected = { definitionHash: definition.definitionHash, owner: { scope: row.owner_scope, id: row.owner_id },
        state: row.state, custody: row.state === 'escrowed' ? { state: 'escrowed', scope: 'operation', id: row.owner_id }
          : { state: 'direct', scope: null, id: null }, qualityBand: 'standard', qualityStateDigest: null,
        conditionSummary: null, exportPolicy: 'ineligible', ...expectedOverride };
      const subject = { storageKind: 'unique', itemId: row.id, expected }, transition = { kind, subject, ...extra };
      const id = `observed-transition-${randomUUID()}`, request = lotRequest(row.owner_scope === 'character' ? character : owner,
        definition, { actorAccountId: owner.id, actionKind: 'operation_action' });
      request.request.authority.issuedActionId = id; request.request.authority.aggregate = { kind: 'operation', id: operationId };
      request.request.authority.itemTransitions = [transition];
      fixture.issuedActions = Object.freeze({ ...fixture.issuedActions, [id]: Object.freeze({ kind: 'transition', request,
        definition, requirements: [{ kind: 'unique_exact', itemId: row.id, expected }], role: 'custodian', revision: 1 }) });
      const run = () => runTrustedDormantItemAction(fixture, { issuedActionId: id }), result = await run();
      exactReceipts.push({ run, result }); return result;
    };
    const clean = async (label) => {
      const result = await runLedgerInvariants(pool, { alert: false });
      assert.equal(result.ok, true, `${label}: ${JSON.stringify(result.checks.filter(check => !check.ok))}`);
    };
    const live = await observe('active'); await clean('live observation');
    // SQL-valid corruptions go through real DML and unmodified collector reads. Every case
    // restores exact fixture bytes in finally, including when the invariant assertion fails.
    let persistedCases = 0;
    const persistedFailure = async (name, damage, restore, expectedFamily = null) => {
      const before = await snapshot();
      try {
        await damage();
        assert.notDeepEqual(await snapshot(), before, `${name} actually changes stored fixture rows`);
        const result = await runLedgerInvariants(pool, { alert: false });
        assert.equal(result.ok, false, `${name} must reject persisted corruption through real queries`);
        if (expectedFamily) assert.equal(result.checks.find(check => check.name === expectedFamily).ok, false, name);
        persistedCases++;
      } finally {
        await restore();
        assert.deepEqual(await snapshot(), before, `${name} restores exact bytes before another case`);
        await clean(`${name} restored fixture`);
      }
    };
    const persistedSnapshot = async (name, record, mutate, expectedFamily = null, forgeDepositor = false) => {
      const event = (await pool.query('SELECT snapshot_json FROM item_events WHERE id=$1', [record.eventId])).rows[0];
      const output = (await pool.query('SELECT snapshot_json FROM item_mutation_outputs WHERE mutation_id=$1 AND output_ordinal=0',
        [record.mutationId])).rows[0];
      const custody = forgeDepositor
        ? (await pool.query('SELECT depositor_id FROM operation_escrow WHERE item_id=$1', [record.item.id])).rows[0] : null;
      const value = JSON.parse(event.snapshot_json); mutate(value);
      const bytes = canonicalBytes(value).toString('utf8');
      await persistedFailure(name, async () => {
        await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [record.eventId, bytes]);
        await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE mutation_id=$1 AND output_ordinal=0',
          [record.mutationId, bytes]);
        if (forgeDepositor) await pool.query('UPDATE operation_escrow SET depositor_id=$2 WHERE item_id=$1', [record.item.id, character.id]);
        assert.equal((await pool.query('SELECT snapshot_json FROM item_events WHERE id=$1', [record.eventId])).rows[0].snapshot_json, bytes);
        assert.equal((await pool.query('SELECT snapshot_json FROM item_mutation_outputs WHERE mutation_id=$1 AND output_ordinal=0',
          [record.mutationId])).rows[0].snapshot_json, bytes, 'both canonical snapshots are persisted, not substituted on read');
      }, async () => {
        await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [record.eventId, event.snapshot_json]);
        await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE mutation_id=$1 AND output_ordinal=0',
          [record.mutationId, output.snapshot_json]);
        if (forgeDepositor) await pool.query('UPDATE operation_escrow SET depositor_id=$2 WHERE item_id=$1', [record.item.id, custody.depositor_id]);
      }, expectedFamily);
    };
    // Controlled SELECT fixtures below are reserved for FK/CHECK/unique-key violations or
    // driver representations which cannot be retained by the native column type.
    const readTable = (sql) => {
      if (sql.includes("FROM item_events WHERE event_branch<>'legacy'")) return 'events';
      if (sql.includes("FROM item_events WHERE item_id IS NOT NULL AND event_branch='legacy'")) return 'legacy';
      if (sql.startsWith('SELECT * FROM item_mutation_outputs ')) return 'outputs';
      if (sql.startsWith('SELECT * FROM item_mutation_inputs ')) return 'inputs';
      if (sql.startsWith('SELECT * FROM item_mutation_guards WHERE mutation_id IS NOT NULL')) return 'guards';
      if (sql.startsWith('SELECT * FROM item_instances WHERE definition_hash IS NOT NULL')) return 'uniques';
      if (/^SELECT .* FROM operation_escrow(?: ORDER BY item_id)?$/.test(sql)) return 'custody';
      return null;
    };
    const corruptRead = async (name, change, expectedFamily = null) => {
      let touched = 0;
      const corrupt = forwardPool(pool, { after: async (sql, values, result) => {
        const table = readTable(sql); if (!table) return;
        const rows = structuredClone(result.rows), before = JSON.stringify(rows);
        change(table, rows); result.rows = rows;
        if (JSON.stringify(rows) !== before) touched++;
      } });
      const result = await runLedgerInvariants(corrupt, { alert: false });
      assert(touched > 0, `${name} reached its named real query boundary`);
      assert.equal(result.ok, false, `${name} must remain loud rather than certify an observation boundary`);
      if (expectedFamily) assert.equal(result.checks.find(check => check.name === expectedFamily).ok, false, name);
      return result;
    };
    for (const [name, mutate] of [
      ['snapshot item identity', value => { value.id = 'forged-permanent-item'; }],
      ['snapshot root UUID', value => { value.mutationId = randomUUID(); }],
      ['snapshot output ordinal', value => { value.outputOrdinal = 1; }],
      ['snapshot logical definition', value => { value.logicalItemId = 'forged::item'; }],
      ['snapshot exact definition', value => { value.definitionHash = 'b'.repeat(64); }],
      ['snapshot quality band', value => { value.qualityBand = 'forged'; }],
      ['snapshot quality digest', value => { value.qualityStateDigest = 'b'.repeat(64); }],
      ['snapshot trade policy', value => { value.tradePolicyHash = 'b'.repeat(64); }],
      ['snapshot provenance class', value => { value.provenanceClass = 'awarded'; }],
      ['snapshot provenance digest', value => { value.provenanceDigest = 'b'.repeat(64); }],
      ['snapshot creation timestamp', value => { value.createdAt = '2000-01-01T00:00:00.000Z'; }],
      ['non-scalar historical timestamp', value => { value.updatedAt = { toString: 'not-callable', valueOf: 'not-callable' }; }],
      ['live observation consumed time', value => { value.consumedAt = '2000-01-01T00:00:00.000Z'; }],
      ['snapshot owner', value => { value.owner = character; }],
      ['snapshot state', value => { value.state = 'consumed'; }],
      ['snapshot custody', value => { value.custody = { state: 'escrowed', scope: 'operation', id: operationId }; }],
      ['snapshot depositor', value => { value.depositor = owner; }],
    ]) await persistedSnapshot(name, live, mutate);
    const originEvent = (await pool.query('SELECT * FROM item_events WHERE id=$1', [live.eventId])).rows[0];
    const originOutput = (await pool.query('SELECT * FROM item_mutation_outputs WHERE mutation_id=$1 AND output_ordinal=0',
      [live.mutationId])).rows[0];
    const insertOriginOutput = (row) => pool.query(`INSERT INTO item_mutation_outputs
      (mutation_id,output_ordinal,event_id,event_branch,definition_hash,item_id,quantity,transition_kind,snapshot_json,
       attachment_mutation_id,attachment_output_ordinal,attachment_quantity)
      VALUES ($1,0,$2,$3,$4,$5,$6,$7,$8,$1,0,1)`,
    [row.mutation_id, row.event_id, row.event_branch, row.definition_hash, row.item_id, row.quantity, row.transition_kind, row.snapshot_json]);
    await persistedFailure('missing origin output',
      () => pool.query('DELETE FROM item_mutation_outputs WHERE mutation_id=$1 AND output_ordinal=0', [live.mutationId]),
      () => insertOriginOutput(originOutput));
    await persistedFailure('wrong event template',
      () => pool.query('UPDATE item_events SET template_id=$2 WHERE id=$1', [live.eventId, 'forged:legacy']),
      () => pool.query('UPDATE item_events SET template_id=$2 WHERE id=$1', [live.eventId, originEvent.template_id]));
    // Native timestamps may contain sub-millisecond precision; pg-mem has only Date
    // precision and does not implement timestamptz::text. Preserve each backend's bytes.
    const readOriginGuard = () => pool.query(dbCaps.skipLocked
      ? 'SELECT result_json,completed_at::text AS completed_at FROM item_mutation_guards WHERE mutation_id=$1'
      : 'SELECT result_json,completed_at FROM item_mutation_guards WHERE mutation_id=$1', [live.mutationId]);
    const originGuard = (await readOriginGuard()).rows[0];
    await persistedFailure('uncompleted observation guard with SQL-valid null pair',
      () => pool.query('UPDATE item_mutation_guards SET result_json=NULL,completed_at=NULL WHERE mutation_id=$1', [live.mutationId]),
      async () => {
        await pool.query('UPDATE item_mutation_guards SET result_json=$2,completed_at=$3 WHERE mutation_id=$1',
          [live.mutationId, originGuard.result_json, originGuard.completed_at]);
        assert.deepEqual((await readOriginGuard()).rows[0], originGuard, 'native timestamp precision is restored without a JavaScript Date roundtrip');
      });
    await persistedFailure('noncanonical observation bytes', async () => {
      await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [live.eventId, originEvent.snapshot_json + ' ']);
      await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE mutation_id=$1 AND output_ordinal=0',
        [live.mutationId, originOutput.snapshot_json + ' ']);
    }, async () => {
      await pool.query('UPDATE item_events SET snapshot_json=$2 WHERE id=$1', [live.eventId, originEvent.snapshot_json]);
      await pool.query('UPDATE item_mutation_outputs SET snapshot_json=$2 WHERE mutation_id=$1 AND output_ordinal=0',
        [live.mutationId, originOutput.snapshot_json]);
    });
    // Remove the referencing output before changing its composite event FK, then restore
    // in the same dependency order. The stored substituted grant is individually SQL-valid.
    await persistedFailure('ordinary grant substituted for observation', async () => {
      await pool.query('DELETE FROM item_mutation_outputs WHERE mutation_id=$1 AND output_ordinal=0', [live.mutationId]);
      await pool.query(`UPDATE item_events SET event_branch='unique',event_kind='unique_granted',
        quantity_delta=1,quantity_before=0,quantity_after=1 WHERE id=$1`, [live.eventId]);
      await insertOriginOutput({ ...originOutput, event_branch: 'unique', transition_kind: 'grant', quantity: 1 });
    }, async () => {
      await pool.query('DELETE FROM item_mutation_outputs WHERE mutation_id=$1 AND output_ordinal=0', [live.mutationId]);
      await pool.query(`UPDATE item_events SET event_branch=$2,event_kind=$3,
        quantity_delta=$4,quantity_before=$5,quantity_after=$6 WHERE id=$1`,
      [live.eventId, originEvent.event_branch, originEvent.event_kind, originEvent.quantity_delta, originEvent.quantity_before, originEvent.quantity_after]);
      await insertOriginOutput(originOutput);
    });
    for (const [name, change] of [
      ['missing observation event', (table, rows) => { if (table === 'events') rows.splice(rows.findIndex(row => row.id === live.eventId), 1); }],
      ['missing observation guard', (table, rows) => { if (table === 'guards') rows.splice(rows.findIndex(row => row.mutation_id === live.mutationId), 1); }],
      ['incomplete observation guard', (table, rows) => { if (table === 'guards') rows.find(row => row.mutation_id === live.mutationId).completed_at = null; }],
      ['extra observation guard', (table, rows) => { if (table === 'guards') rows.push({ ...rows.find(row => row.mutation_id === live.mutationId) }); }],
      ['invalid guard completion time', (table, rows) => { if (table === 'guards') rows.find(row => row.mutation_id === live.mutationId).completed_at = 'not-a-time'; }],
      ['wrong guard key', (table, rows) => { if (table === 'guards') rows.find(row => row.mutation_id === live.mutationId).idempotency_key = 'unlinked'; }],
      ['extra observation event', (table, rows) => { if (table === 'events') rows.push({ ...rows.find(row => row.id === live.eventId), id: randomUUID() }); }],
      ['extra origin output', (table, rows) => { if (table === 'outputs') rows.push({ ...rows.find(row => row.event_id === live.eventId), output_ordinal: 1 }); }],
      ['observation input', (table, rows) => { if (table === 'inputs') rows.push({ mutation_id: live.mutationId, input_ordinal: 0,
        event_id: live.eventId, event_branch: 'observation', definition_hash: definition.definitionHash, lot_id: null,
        item_id: live.item.id, attachment_mutation_id: live.mutationId, attachment_output_ordinal: 0, attachment_quantity: 1,
        quantity_before: 1, removed_quantity: 0, quantity_after: 1, transition_kind: 'migration_origin', snapshot_json: canonicalBytes(live.observed).toString('utf8') }); }],
      ['wrong origin branch', (table, rows) => { if (table === 'outputs') rows.find(row => row.event_id === live.eventId).event_branch = 'unique'; }],
      ['wrong event root', (table, rows) => { if (table === 'events') rows.find(row => row.id === live.eventId).mutation_id = randomUUID(); }],
      ['wrong event ordinal', (table, rows) => { if (table === 'events') rows.find(row => row.id === live.eventId).event_ordinal = 1; }],
      ['wrong output attachment', (table, rows) => { if (table === 'outputs') rows.find(row => row.event_id === live.eventId).attachment_mutation_id = randomUUID(); }],
      ['nonzero observation output', (table, rows) => { if (table === 'outputs') rows.find(row => row.event_id === live.eventId).quantity = 1; }],
      ['wrong observation attachment quantity', (table, rows) => { if (table === 'outputs') rows.find(row => row.event_id === live.eventId).attachment_quantity = 2; }],
      ['observation supply delta', (table, rows) => { if (table === 'events') rows.find(row => row.id === live.eventId).quantity_delta = 1; }],
      ['observation balance mismatch', (table, rows) => { if (table === 'events') rows.find(row => row.id === live.eventId).quantity_after = 0; }],
    ]) await corruptRead(name, change);
    const forgedHistoryIds = [randomUUID(), randomUUID()];
    await persistedFailure('post-observation legacy roundtrip', async () => {
      for (const [index, from, to] of [[0, owner, character], [1, character, owner]]) {
        await pool.query(`INSERT INTO item_events (sequence,id,event_key,event_kind,provenance_kind,item_id,template_id,
          from_owner_scope,from_owner_id,to_owner_scope,to_owner_id,reason,idempotency_key)
          VALUES ($1,$2,$2,'transferred','transferred',$3,$4,$5,$6,$7,$8,'forged post-observation roundtrip',$9)`,
        [String(BigInt(originEvent.sequence) + BigInt(index + 1)), forgedHistoryIds[index], live.item.id, originEvent.template_id,
          from.scope, from.id, to.scope, to.id, originEvent.idempotency_key]);
      }
    }, () => pool.query('DELETE FROM item_events WHERE id IN ($1,$2)', forgedHistoryIds), 'world graph unique custody and provenance');
    for (const sequence of ['0', '-1']) {
      await persistedFailure(`invalid observation sequence ${sequence}`,
        () => pool.query('UPDATE item_events SET sequence=$2 WHERE id=$1', [live.eventId, sequence]),
        () => pool.query('UPDATE item_events SET sequence=$2 WHERE id=$1', [live.eventId, originEvent.sequence]));
    }
    for (const sequence of [9007199254740992, '01', '1.5', '9223372036854775808']) {
      await corruptRead(`invalid observation sequence ${sequence}`, (table, rows) => {
        if (table === 'events') rows.find(row => row.id === live.eventId).sequence = sequence;
      });
    }
    const largeSequences = (inverted) => forwardPool(pool, { after: async (sql, values, result) => {
      const table = readTable(sql);
      if (table === 'legacy') for (const row of result.rows) if (row.item_id === live.item.id) row.sequence = '9007199254740992';
      if (table === 'events') for (const row of result.rows) if (row.id === live.eventId) row.sequence = inverted ? '9007199254740992' : '9007199254740993';
    } });
    assert.equal((await runLedgerInvariants(largeSequences(false), { alert: false })).ok, true,
      'adjacent valid BIGINT sequences beyond Number precision preserve strict legacy-before-observation order');
    assert.equal((await runLedgerInvariants(largeSequences(true), { alert: false })).ok, false,
      'an equal legacy/observation sequence cannot certify chronology');
    await move(live, 'consume_unique', { depositor: null });
    await clean('observed-live exact consumption reconciles both legacy and normalized histories');
    const consumedOwner = (await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [live.item.id])).rows[0].owner_id;
    await persistedFailure('current normalized owner remains independently checked',
      () => pool.query('UPDATE item_instances SET owner_id=$2 WHERE id=$1', [live.item.id, character.id]),
      () => pool.query('UPDATE item_instances SET owner_id=$2 WHERE id=$1', [live.item.id, consumedOwner]), 'item lot custody integrity');
    await corruptRead('normalized transition must follow observation', (table, rows) => {
      if (table === 'events') rows.find(row => row.item_id === live.item.id && row.id !== live.eventId).sequence = originEvent.sequence;
    }, 'item lot lineage parity');
    const travelling = await observe('active'); await clean('second live observation');
    await move(travelling, 'transfer_unique', { destination: character }); await clean('observed exact transfer');
    await move(travelling, 'escrow', { operationId }); await clean('observed exact escrow');
    await move(travelling, 'release', { depositor: character }); await clean('observed exact release');
    await move(travelling, 'consume_unique', { depositor: null }); await clean('released observed exact consumption');
    const held = await observe('escrowed'); await clean('escrowed observation');
    await persistedSnapshot('forged historical depositor cannot be legitimized by current custody', held,
      value => { value.depositor = character; }, 'world graph unique custody and provenance', true);
    const readHeldCustody = () => pool.query(dbCaps.skipLocked
      ? 'SELECT *,created_at::text AS retained_created_at FROM operation_escrow WHERE item_id=$1'
      : 'SELECT *,created_at AS retained_created_at FROM operation_escrow WHERE item_id=$1', [held.item.id]);
    const heldCustody = (await readHeldCustody()).rows[0];
    await persistedFailure('missing current exact custody',
      () => pool.query('DELETE FROM operation_escrow WHERE item_id=$1', [held.item.id]),
      async () => {
        await pool.query(`INSERT INTO operation_escrow
          (item_id,owner_scope,operation_id,item_state,depositor_scope,depositor_id,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [heldCustody.item_id, heldCustody.owner_scope, heldCustody.operation_id, heldCustody.item_state,
          heldCustody.depositor_scope, heldCustody.depositor_id, heldCustody.retained_created_at]);
        assert.deepEqual((await readHeldCustody()).rows[0], heldCustody, 'native custody timestamp precision survives delete/restore');
      }, 'item lot custody integrity');
    await persistedFailure('current custody depositor_id',
      () => pool.query('UPDATE operation_escrow SET depositor_id=$2 WHERE item_id=$1', [held.item.id, character.id]),
      () => pool.query('UPDATE operation_escrow SET depositor_id=$2 WHERE item_id=$1', [held.item.id, heldCustody.depositor_id]),
      'item lot custody integrity');
    for (const [field, value] of [['owner_scope', 'account'], ['operation_id', 'another-operation'],
      ['item_state', 'active']]) {
      await corruptRead(`current custody ${field}`, (table, rows) => {
        if (table === 'custody') rows.find(row => row.item_id === held.item.id)[field] = value;
      }, 'item lot custody integrity');
    }
    const duplicate = await corruptRead('duplicate custody retains first claim and reports duplicate', (table, rows) => {
      if (table === 'custody') rows.push({ ...rows.find(row => row.item_id === held.item.id), depositor_id: character.id });
    }, 'item lot custody integrity');
    assert.equal(duplicate.checks.find(check => check.name === 'item lot custody integrity').lhs, 1,
      'duplicate evidence is counted, but its conflicting second claim cannot overwrite the first valid claim');
    await corruptRead('orphan custody evidence survives indexing', (table, rows) => {
      if (table === 'custody') rows.push({ ...rows.find(row => row.item_id === held.item.id), item_id: 'orphan-observed-custody' });
    }, 'world graph unique custody and provenance');
    await move(held, 'release', { depositor: owner }); await clean('release after escrowed observation');
    await move(held, 'escrow', { operationId }); await clean('re-escrow after escrowed observation');
    await move(held, 'consume_unique', { depositor: owner }); await clean('observed escrow consumption');
    for (const mode of ['released', 'transferred', 'consumed', 'escrow-consumed']) {
      const record = await observe(mode); await clean(`${mode} legacy history at observation`);
      if (mode === 'released') {
        const middle = record.oldHistory.find(row => row.event_kind === 'escrowed');
        await persistedFailure('forged middle legacy transition remains loud after observation',
          () => pool.query('UPDATE item_events SET from_owner_id=$2 WHERE id=$1', [middle.id, character.id]),
          () => pool.query('UPDATE item_events SET from_owner_id=$2 WHERE id=$1', [middle.id, middle.from_owner_id]),
          'world graph unique custody and provenance');
      }
      if (mode.endsWith('consumed')) {
        for (const consumedAt of [null, '2000-01-01T00:00:00.000Z']) {
          await persistedSnapshot('consumed observation retains exact terminal consumption time', record,
            value => { value.consumedAt = consumedAt; }, 'item lot lineage parity');
        }
        const before = await snapshot();
        await assert.rejects(() => move(record, 'consume_unique', { depositor: null },
          { state: 'active', owner, custody: { state: 'direct', scope: null, id: null } }), { code: 'item_unavailable' });
        assert.deepEqual(await snapshot(), before, 'consumed observation cannot resurrect or consume again');
        const lots = await import('../src/itemlots.js');
        for (const extra of [{ provenanceClass: 'migration_origin' }, { id: record.item.id }]) {
          await assert.rejects(() => withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, definition),
            m => lots.grantUnique(q, m, definition, { logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash,
              owner, qualityBand: 'standard', qualityStateDigest: null, tradePolicyHash: definition.definitionHash,
              conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64), ...extra }))),
          { code: 'bad_item_request' });
          assert.deepEqual(await snapshot(), before, 'ordinary grants cannot remigrate or reissue a consumed permanent identity');
        }
      }
    }
    for (const record of observedItems) {
      const row = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [record.item.id])).rows[0];
      for (const field of ['id', 'template_id', 'created_at']) assert.deepEqual(row[field], record.old[field]);
      assert.equal(row.mutation_id, record.mutationId); assert.equal(row.output_ordinal, 0);
      assert.deepEqual((await pool.query("SELECT * FROM item_events WHERE item_id=$1 AND event_branch='legacy' ORDER BY sequence",
        [row.id])).rows, record.oldHistory, 'post-observation transitions preserve every historical event byte');
    }
    const beforeReplay = await snapshot();
    for (const receipt of [...legacyReceipts, ...exactReceipts]) assert.deepEqual(await receipt.run(), receipt.result);
    assert.deepEqual(await snapshot(), beforeReplay, 'legacy and exact completed receipts replay without writes after movement/consumption');
    await clean('post-observation replay');
    assert.equal(persistedCases, 34, 'every SQL-valid named corruption traversed the persisted real-query path and exact restoration');
    console.log(`invariant correction: ${persistedCases} persisted SQL-valid corruptions rejected, exact fixture restoration and clean rechecks PASS`);
    console.log('invariant correction: observed active/escrowed/released/transferred/consumed histories and exact transitions PASS');
  }, existingPool);
}

export async function runLots(existingPool = null) {
  await runObservedUniqueInvariants(existingPool);
  await runCustodyIndexInvariants(existingPool);
  await runExternalCorrections(existingPool);
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
      if (!blocked && /^SELECT .* FROM item_lots WHERE lot_id=\$1$/.test(sql)) { blocked = true; entered.resolve(); await release.promise; }
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

export async function runExternalCorrections(existingPool = null, only = null) {
  const lots = await import('../src/itemlots.js');
  if (!only || only.startsWith('fifo-')) await runFifoCorrections(existingPool, only);
  if ((!only || only === 'microseconds') && dbCaps.skipLocked) await withItemFixture(async ({ pool, accountOwner: owner, definition }) => {
    const ids = [], stamps = ['2026-01-01T00:00:00.000001Z', '2026-01-01T00:00:00.000002Z', '2026-01-01T00:00:00.001001Z'];
    const clocked = forwardPool(pool, { after: async (sql, values, result, q) => {
      if (!sql.startsWith('INSERT INTO item_lots ')) return;
      const timestamp = stamps[ids.length], row = result.rows[0]; ids.push(row.lot_id);
      await q.query('UPDATE item_lots SET created_at=$2 WHERE lot_id=$1', [row.lot_id, timestamp]);
      row.created_at = new Date(timestamp);
    } });
    await withItemTransaction(clocked, q => withLotMutation(q, lotRequest(owner, definition), async m => {
      for (let i = 0; i < 3; i++) await lots.grantLot(q, m, definition, lotOutput(owner, definition));
      return { created: 3 };
    }));
    let cursor = null;
    for (let index = 0; index < 3; index++) {
      const board = await lots.lotInventoryBoard(pool, owner, { cursor, limit: 1, includeLots: true });
      assert.equal(board.lots[0].lotId, ids[index], 'native keyset retains distinct microseconds within one JS millisecond');
      cursor = board.nextCursor;
      if (index < 2) assert.equal(JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')).after.createdAt, stamps[index]);
    }
    assert.equal(cursor, null);
    console.log('external-correction native microseconds: three one-row pages preserve .000001/.000002/.001001 and terminate PASS');
  }, existingPool);
  for (const mode of ['crafting', 'mysteries', 'operations']) if (!only || only === mode) {
    await withItemFixture(async ({ pool, accountOwner: owner }) => {
      const { loadAndValidateGraphPackages } = await import('../src/worldgraph-validate.js');
      const templateId = 'omerta.phase2.collision::tool';
      const source = materialSource({ id: 'tool', kind: 'item', stackable: false, maximumLotQuantity: 1 });
      source.packageId = 'omerta.phase2.collision'; source.exports = []; source.nodes = []; source.edges = [];
      const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
      const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
      const exactItem = await withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, definition), m => lots.grantUnique(q, m, definition, {
        logicalItemId: templateId, definitionHash: definition.definitionHash, owner, qualityBand: null, qualityStateDigest: null,
        tradePolicyHash: definition.definitionHash, conditionSummary: null, exportPolicy: 'ineligible',
        provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64),
      })));
      const exactSnapshot = async () => ({
        row: (await pool.query('SELECT * FROM item_instances WHERE id=$1', [exactItem.id])).rows,
        events: (await pool.query('SELECT * FROM item_events WHERE item_id=$1 ORDER BY sequence', [exactItem.id])).rows,
        outputs: (await pool.query('SELECT * FROM item_mutation_outputs WHERE item_id=$1', [exactItem.id])).rows,
      });
      const historical = await exactSnapshot();
      const characterId = `collision-${mode}-character`;
      await pool.query('INSERT INTO characters(id,account_id,name,season) VALUES ($1,$2,$1,1)', [characterId, owner.id]);
      const core = { id: 'collision-core', version: 1, season: 'core', dependsOn: [], nodes: [
        { id: templateId, type: 'item_template', visibility: 'public', metadata: { inventoryClass: 'unique' } },
        { id: 'mat:external_collision_result', type: 'material', visibility: 'public', metadata: { inventoryClass: 'stack' } },
        { id: 'source:collision', type: 'source', visibility: 'public', produces: [{ templateId, quantity: 1 }] },
      ] };
      let execute, checkEligibility = async () => {};
      if (mode === 'crafting') {
        const { createCraftingContext, craftWorldGraphRecipe } = await import('../src/crafting.js');
        const registry = loadAndValidateGraphPackages([core, { id: 'collision-craft', version: 1, season: 'core', dependsOn: ['collision-core'], nodes: [
          { id: 'recipe:collision', type: 'recipe', version: 1, visibility: 'public', repeatability: 'repeatable',
            consumes: [{ templateId, quantity: 1 }], produces: [{ templateId: 'mat:external_collision_result', quantity: 1, quality: 'standard' }] },
        ] }]);
        const context = createCraftingContext({ registry });
        execute = () => withItemTransaction(pool, q => craftWorldGraphRecipe(q, { accountId: owner.id }, 'recipe:collision', 'collision-craft-key', context));
      } else if (mode === 'mysteries') {
        const { createMysteryContext, startMystery, mysteryBoard, completeNode } = await import('../src/mysteries.js');
        const registry = loadAndValidateGraphPackages([core, { id: 'collision-mystery', version: 1, season: 'core', dependsOn: ['collision-core'], nodes: [
          { id: 'm:collision', type: 'mystery_step', version: 1, visibility: 'public',
            conditions: [{ adapter: 'item_ownership', templateId }], effects: [{ adapter: 'item_consume', templateId }] },
        ] }]);
        const context = createMysteryContext({ registry, accountId: owner.id });
        await withItemTransaction(pool, q => startMystery(q, context, owner, 'collision-mystery', 1));
        checkEligibility = async (available) => {
          const board = await mysteryBoard(pool, context, owner, 'collision-mystery');
          assert.equal(board.nodes.find(node => node.id === 'm:collision').available, available,
            'exact-only cannot satisfy the read-side legacy ownership condition');
        };
        execute = () => withItemTransaction(pool, q => completeNode(q, context, owner, 'collision-mystery', 'm:collision', { idempotencyKey: 'collision-mystery-key' }));
      } else {
        const { createOperationContext, openOperation, assignRole, contribute } = await import('../src/operations.js');
        const registry = loadAndValidateGraphPackages([core, { id: 'collision-operation', version: 1, season: 'core', dependsOn: ['collision-core'], nodes: [
          { id: 'op:collision', type: 'social_gate', visibility: 'public', minimumDistinctAccounts: 2,
            roles: [{ id: 'keeper', distinct: true }, { id: 'witness', distinct: true }],
            metadata: { closerRoleId: 'keeper', completionRequires: ['op:collision-keep', 'op:collision-witness'] } },
          { id: 'op:collision-keep', type: 'operation_step', visibility: 'public', requires: ['op:collision'],
            metadata: { operationId: 'op:collision', roleId: 'keeper' },
            conditions: [{ adapter: 'item_ownership', templateId }], effects: [{ adapter: 'item_escrow', templateId }] },
          { id: 'op:collision-witness', type: 'operation_step', visibility: 'public', requires: ['op:collision'],
            metadata: { operationId: 'op:collision', roleId: 'witness' } },
          { id: 'op:collision-condition', type: 'operation_step', visibility: 'public', requires: ['op:collision'],
            metadata: { operationId: 'op:collision', roleId: 'keeper' }, conditions: [{ adapter: 'owns_item', templateId }] },
        ] }]);
        const otherAccount = 'collision-witness-account', crewId = 'collision-crew';
        await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,'guest',$1)", [otherAccount]);
        await pool.query("INSERT INTO characters(id,account_id,name,season) VALUES ('collision-witness',$1,'Witness',1)", [otherAccount]);
        await pool.query('INSERT INTO crews(id,name,leader_account) VALUES ($1,$1,$2)', [crewId, owner.id]);
        for (const accountId of [owner.id, otherAccount]) await pool.query('INSERT INTO crew_members(crew_id,account_id,name) VALUES ($1,$2,$2)', [crewId, accountId]);
        const context = createOperationContext({ registry, accountId: owner.id });
        const other = createOperationContext({ registry, accountId: otherAccount });
        const opened = await withItemTransaction(pool, q => openOperation(q, context, 'collision-operation', 'op:collision', 1, 'collision-open'));
        await withItemTransaction(pool, q => assignRole(q, context, opened.operationId, 'keeper', { idempotencyKey: 'collision-keeper' }));
        await withItemTransaction(pool, q => assignRole(q, other, opened.operationId, 'witness', { idempotencyKey: 'collision-witness' }));
        checkEligibility = async (available) => {
          if (available) return;
          await assert.rejects(() => withItemTransaction(pool, q => contribute(q, context, opened.operationId,
            'op:collision-condition', { idempotencyKey: 'collision-condition' })), { code: 'item_unavailable' },
          'exact-only cannot satisfy a condition-only legacy operation step');
        };
        execute = () => withItemTransaction(pool, q => contribute(q, context, opened.operationId, 'op:collision-keep', { idempotencyKey: 'collision-operation-key' }));
      }
      await checkEligibility(false);
      await assert.rejects(execute, { code: 'item_unavailable' }, `${mode} exact-only is unavailable`);
      const legacy = await withItemTransaction(pool, q => createItem(q, owner, templateId, 'awarded', `collision-${mode}-legacy`));
      const ordered = (await pool.query('SELECT id FROM item_instances WHERE template_id=$1 ORDER BY created_at,id', [templateId])).rows;
      assert.equal(ordered[0].id, exactItem.id, 'exact collision sorts before the usable legacy subject');
      await checkEligibility(true);
      const result = await execute(); assert.deepEqual(await execute(), result, `${mode} same-key replay`);
      assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [legacy.id])).rows[0].state,
        mode === 'operations' ? 'escrowed' : 'consumed');
      assert.deepEqual(await exactSnapshot(), historical, `${mode} leaves the exact item and normalized history untouched`);
      console.log(`external-correction ${mode}: exact-only refusal, exact-first collision selects legacy, exact history and replay PASS`);
    }, existingPool);
  }
  if (!only || ['paging', 'fifo-bounds'].includes(only)) await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    const frozen = [];
    const clocked = forwardPool(pool, { after: async (sql, values, result, q) => {
      if (!sql.startsWith('INSERT INTO item_lots ')) return;
      // Fix the inserted timestamp before the real grant derives its immutable snapshot and result.
      const row = result.rows[0];
      await q.query("UPDATE item_lots SET created_at='2026-01-01T00:00:00Z' WHERE lot_id=$1", [row.lot_id]);
      row.created_at = new Date('2026-01-01T00:00:00Z');
    } });
    // Real grants provide complete guards, immutable definitions, event snapshots and normalized outputs.
    // Each root stays below its existing candidate/ordinal budget; no orphan rows stand in for inventory.
    for (let start = 0; start < 4097; start += 64) {
      await withItemTransaction(clocked, (q) => withLotMutation(q, lotRequest(owner, definition), async (m) => {
        for (let index = start; index < Math.min(start + 64, 4097); index++) {
          const row = await lots.grantLot(q, m, definition, lotOutput(owner, definition, { quantity: 2 }));
          frozen.push(row);
        }
        return { count: Math.min(64, 4097 - start) };
      }));
    }
    frozen.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || Buffer.compare(Buffer.from(a.lotId), Buffer.from(b.lotId)));
    assert(frozen.some((row, index) => index && row.createdAt === frozen[index - 1].createdAt), 'fixture covers equal creation instants');
    let lastRead;
    const boundedReader = forwardPool(pool, { after: async (sql, values, result) => {
      if (sql.startsWith('SELECT *') && sql.includes(' FROM item_lots ')) {
        assert(result.rows.length <= values[2], 'the SQL result itself is bounded by limit+1');
        lastRead = { sql, values };
      }
    } });
    const board = (cursor = null, limit = 100, includeLots = true) => lots.lotInventoryBoard(boundedReader, owner, { cursor, limit, includeLots });
    const first = await board(null, 1);
    assert.equal(first.lots[0].lotId, frozen[0].lotId);
    assert.equal(first.groups.length, 1); assert.equal(first.groups[0].quantity, 2); assert.equal(first.groups[0].lotCount, 1);
    const hidden = await board(first.nextCursor, 100, false);
    assert.deepEqual(hidden.lots, []); assert.equal(hidden.groups[0].quantity, 200); assert.equal(hidden.groups[0].lotCount, 100);
    const seen = []; let cursor = null, lastPage;
    do {
      lastPage = await board(cursor); seen.push(...lastPage.lots.map(row => row.lotId)); cursor = lastPage.nextCursor;
      assert(lastPage.lots.length <= 100); assert.equal(lastPage.groups[0].quantity, lastPage.lots.length * 2);
    } while (cursor);
    assert.equal(lastPage.lots.length, 97); assert.equal(lastPage.groups[0].quantity, 194);
    assert.deepEqual(seen, frozen.map(row => row.lotId), 'FIFO traversal contains all 4097 frozen rows exactly once');
    if (dbCaps.skipLocked) {
      await pool.query('ANALYZE item_lots');
      const plan = (await pool.query(`EXPLAIN (FORMAT JSON) ${lastRead.sql}`, lastRead.values)).rows[0]['QUERY PLAN'][0].Plan;
      const nodes = [plan]; for (let index = 0; index < nodes.length; index++) nodes.push(...(nodes[index].Plans ?? []));
      const range = nodes.find(node => node['Index Name'] === 'item_lot_owner_idx');
      assert(range, 'late native page uses the existing owner/FIFO index');
      assert.match(range['Index Cond'], /created_at.*lot_id.*>/, 'cursor tuple belongs to the native index range, not a post-scan filter');
      console.log(`external-correction native late-page plan: ${JSON.stringify(plan)}`);
    }
    const consumeRequest = lotRequest(owner, definition);
    await withItemTransaction(pool, q => withLotMutation(q, consumeRequest, m => lots.withCompleteItemCandidates(q, m, createItemLockTrace(),
      { root: { owner, authority: consumeRequest.request.authority }, requirements: [{ kind: 'lot_exact', lotId: first.lots[0].lotId, quantity: 2 }] },
      () => lots.consumeExactLot(q, m, first.lots[0].lotId, 2))));
    assert.equal((await board(first.nextCursor, 1)).lots[0].lotId, frozen[1].lotId, 'exhausted cursor anchor cannot strand continuation');
    const decoded = JSON.parse(Buffer.from(first.nextCursor, 'base64url').toString('utf8'));
    const encode = value => Buffer.from(JSON.stringify(value)).toString('base64url');
    for (const invalid of ['', '!', encode({ ...decoded, extra: 1 }), encode({ ...decoded, after: null }),
      ...['invalid', '0000-01-01T00:00:00.000Z', '2026-02-30T00:00:00.000Z', '2026-01-01', 1].map(createdAt => encode({ ...decoded, after: { ...decoded.after, createdAt } })),
      ...['', ' padded', 'x'.repeat(201), 1, []].map(lotId => encode({ ...decoded, after: { ...decoded.after, lotId } })),
      encode({ ...decoded, after: { ...decoded.after, extra: 1 } }), encode({ ...decoded, owner: { ...owner, extra: 1 } })]) {
      await assert.rejects(() => board(invalid), { code: 'bad_item_request' });
    }
    const pastLast = await board(encode({ owner, after: { createdAt: frozen.at(-1).createdAt, lotId: frozen.at(-1).lotId } }));
    assert.deepEqual(pastLast.groups, []); assert.deepEqual(pastLast.lots, []); assert.equal(pastLast.nextCursor, null);
    await assert.rejects(() => lots.lotInventoryBoard(pool, { ...owner, id: 'other-owner' },
      { cursor: first.nextCursor, limit: 1, includeLots: true }), { code: 'bad_item_request' });
    const empty = await lots.lotInventoryBoard(pool, { ...owner, id: 'empty-owner' }, { cursor: null, limit: 1, includeLots: true });
    assert.deepEqual(empty.groups, []); assert.deepEqual(empty.lots, []); assert.equal(empty.nextCursor, null);
    console.log('external-correction paging: 4097 complete grants, FIFO 1/100 pages, page-local groups, hidden details, exhausted anchor, closed cursor PASS');
    if (!only || only === 'fifo-bounds') await exerciseLargeFifo({ pool, owner, definition, snapshot }, frozen);
  }, existingPool);
  if (!only || only === 'ids') await withItemFixture(async ({ pool, accountOwner: owner, snapshot }) => {
    for (const length of [200, 201, 258]) for (const unique of [false, true]) {
      const source = materialSource({ id: 'b'.repeat(length - 130), kind: unique ? 'item' : 'material',
        stackable: !unique, maximumLotQuantity: unique ? 1 : 100, ownerScopes: ['account', 'project'] });
      source.packageId = (unique ? 'u' : 'l').repeat(128);
      source.exports = []; source.nodes = []; source.edges = []; source.version = length;
      source.definitions[0].definitionVersion = length;
      const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
      const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
      assert.equal(definition.logicalItemId.length, length);
      const request = lotRequest(owner, definition), output = unique ? {
        logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash, owner,
        qualityBand: null, qualityStateDigest: null, tradePolicyHash: definition.definitionHash,
        conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64),
      } : lotOutput(owner, definition);
      const grant = () => withItemTransaction(pool, (q) => withLotMutation(q, request,
        (m) => unique ? lots.grantUnique(q, m, definition, output) : lots.grantLot(q, m, definition, output)));
      const created = await grant(); assert.deepEqual(await grant(), created);
      const event = (await pool.query('SELECT template_id FROM item_events WHERE mutation_id=$1', [created.mutationId])).rows[0];
      assert.equal(event.template_id, definition.logicalItemId);
      if (unique) {
        assert.equal((await pool.query('SELECT template_id FROM item_instances WHERE id=$1', [created.id])).rows[0].template_id, definition.logicalItemId);
      } else {
        const debitRequest = lotRequest(owner, definition), selected = lotSelector(owner, definition, 1);
        await withItemTransaction(pool, q => withLotMutation(q, debitRequest, m => lots.withCompleteItemCandidates(q, m,
          createItemLockTrace(), { root: { owner, authority: debitRequest.request.authority },
            requirements: [{ kind: 'lot_fifo', selector: selected }] }, () => lots.consumeLotsFifo(q, m, selected))));
        const { quantity, provenanceClass, provenanceDigest, ...identity } = output;
        const transition = { kind: 'escrow', subject: { storageKind: 'lot', lotId: created.lotId,
          expected: { ...identity, remainingQuantity: 9 } }, operationId: 'long-id-operation' };
        const moveRequest = lotRequest(owner, definition);
        moveRequest.request.authority.aggregate = { kind: 'operation', id: 'long-id-operation' };
        moveRequest.request.authority.itemTransitions = [transition];
        const move = () => withItemTransaction(pool, (q) => withLotMutation(q, moveRequest, (m) =>
          lots.withCompleteItemCandidates(q, m, createItemLockTrace(), { root: { owner, authority: moveRequest.request.authority },
            requirements: [{ kind: 'lot_exact', lotId: created.lotId, quantity: 9 }] }, () => lots.applyItemTransition(q, m, 0))));
        assert.deepEqual(await move(), await move());
      }
      for (const logicalItemId of ['a'.repeat(259), 'bad::id::extra', 'bad:: padded']) {
        const before = await snapshot(), invalid = lotRequest(owner, definition);
        await assert.rejects(() => withItemTransaction(pool, (q) => withLotMutation(q, invalid,
          (m) => unique ? lots.grantUnique(q, m, definition, { ...output, logicalItemId })
            : lots.grantLot(q, m, definition, { ...output, logicalItemId }))), { code: 'bad_item_request' });
        assert.deepEqual(await snapshot(), before);
      }
    }
    const legacy = await withItemTransaction(pool, (q) => createItem(q, owner, 't'.repeat(200), 'awarded', randomUUID()));
    await assert.rejects(() => withItemTransaction(pool, (q) => createItem(q, owner, 't'.repeat(201), 'awarded', randomUUID())), { code: 'bad_item_request' });
    await assert.rejects(() => pool.query('UPDATE item_instances SET template_id=$2 WHERE id=$1', [legacy.id, 't'.repeat(201)]), /item_instance_template_id/);
    await assert.rejects(() => pool.query('UPDATE item_events SET template_id=$2 WHERE item_id=$1', [legacy.id, 't'.repeat(201)]), /item_event_template_id/);
    console.log('external-correction ids: 200/201/258 exact lot/unique grants, events, transition/replay and legacy bounds PASS');
  }, existingPool);
  if (!only || ['errors', 'errors-aborted'].includes(only)) await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    const created = await withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition),
      (m) => lots.grantLot(q, m, definition, lotOutput(owner, definition))));
    const modes = only === 'errors-aborted' ? ['operational-aborted']
      : ['registry', 'missing', 'integrity', 'operational', 'operational-aborted', 'malformed', 'candidate'];
    for (const mode of modes) {
      const request = lotRequest(owner, definition), before = await snapshot(); let armed = true, locked = false, aborted = false, postPoisonSql = 0;
      const alias = forwardPool(pool, { before: async (sql, values, q) => {
        // Reproduce PostgreSQL's aborted-transaction semantics on pg-mem after an actual failed SQL read.
        if (aborted && sql === 'ROLLBACK') aborted = false;
        if (aborted) {
          postPoisonSql++;
          throw Object.assign(Error('SQL after a poisoned native transaction'), { code: '25P02' });
        }
        if (sql === 'SELECT * FROM item_lots WHERE lot_id=$1 FOR UPDATE') locked = true;
        if (armed && locked && ['integrity', 'operational', 'operational-aborted'].includes(mode) && sql.startsWith('SELECT * FROM item_definition_versions')) {
          armed = false;
          try {
            if (mode === 'integrity') return await q.query('UPDATE item_lots SET remaining_quantity=-1 WHERE lot_id=$1', [created.lotId]);
            return await q.query('SELECT * FROM missing_revalidation_table');
          } catch (error) {
            // pg-mem omits SQLSTATE; retain the actual failed SQL/error and supply its native classification.
            error.code ??= mode === 'integrity' ? '23514' : '42P01';
            aborted = mode === 'operational-aborted'; throw error;
          }
        }
      }, after: async (sql, values, result) => {
        if (!armed || !locked) return;
        if (sql.startsWith('SELECT * FROM item_definition_versions')) {
          armed = false;
          if (mode === 'registry') result.rows[0] = { ...result.rows[0], definition_kind: 'corrupt' };
          if (mode === 'missing') result.rows = [];
        } else if (['malformed', 'candidate'].includes(mode) && /^SELECT .* FROM item_lots WHERE lot_id=\$1$/.test(sql)) {
          armed = false;
          result.rows[0] = { ...result.rows[0], ...(mode === 'malformed' ? { quality_band: 'invalid-for-none-mode' }
            : { remaining_quantity: result.rows[0].remaining_quantity - 1 }) };
        }
      } });
      const execute = (target, caught) => withItemTransaction(target, (q) => withLotMutation(q, request, async (m) => {
        await lots.grantLot(q, m, definition, lotOutput(owner, definition));
        const action = () => lots.withCompleteItemCandidates(q, m, createItemLockTrace(),
          { root: { owner, authority: request.request.authority }, requirements: [{ kind: 'lot_exact', lotId: created.lotId, quantity: 1 }] },
          () => lots.consumeExactLot(q, m, created.lotId, 1));
        if (!caught) return action();
        try { await action(); } catch { return 'caught leaf'; }
      }));
      const expected = { registry: 'content_registry_corrupt', missing: 'definition_not_found',
        integrity: 'item_integrity_error', operational: '42P01', 'operational-aborted': '42P01', malformed: 'bad_item_request', candidate: 'contention' }[mode];
      await assert.rejects(() => execute(alias, true), (error) => {
        const actualCode = /^[a-zA-Z0-9_]{1,64}$/.test(error?.code ?? '') ? error.code : 'unavailable';
        console.log(`external-correction error observation: ${JSON.stringify({ mode, actualCode, expected })}`);
        assert.equal(error.code, expected, `${mode} revalidation classification`); return true;
      });
      assert.equal(postPoisonSql, 0, 'caught leaf poison must reach rollback before parity or guard SQL');
      assert.equal(armed, false, `${mode} injection reached post-lock resolution`);
      assert.deepEqual(await snapshot(), before, `${mode} poisons root and removes preceding grant and guard`);
      const retried = await execute(pool, false); assert.equal(retried.removedQuantity, 1);
      assert.deepEqual(await execute(pool, false), retried);
    }
    console.log('external-correction errors: revalidation classification, poisoned-root rollback and same-key retry PASS');
  }, existingPool);
  if (!only || ['legacy-board', 'assignment'].includes(only)) await withItemFixture(async ({ pool, accountOwner: owner }) => {
    const source = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1, definitionVersion: 70 }); source.version = 70;
    const artifact = compileFixture(source);
    await storeSealedBundle(pool, artifact.request);
    const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const item = await withItemTransaction(pool, (q) => withLotMutation(q, lotRequest(owner, definition),
      (m) => lots.grantUnique(q, m, definition, { logicalItemId: definition.logicalItemId,
        definitionHash: definition.definitionHash, owner, qualityBand: null, qualityStateDigest: null,
        tradePolicyHash: definition.definitionHash, conditionSummary: null, exportPolicy: 'ineligible',
        provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) })));
    assert.deepEqual((await inventoryBoard(pool, owner)).items, [], 'legacy board must exclude exact unique');
    assert.equal((await pool.query('SELECT state FROM item_instances WHERE id=$1', [item.id])).rows[0].state, 'active');
    console.log('external-correction legacy-board: exact unique stays stored and invisible to legacy inventory PASS');
    if (!only || only === 'assignment') {
      const { assignItemToCurrentCharacter } = await import('../src/routes/worldgraph.js');
      // Adversarial corruption of the legacy-shaped alias must not let an exact attachment through the legacy precheck.
      // Its logical ID, exact definition and immutable normalized records are unchanged.
      await pool.query("UPDATE item_instances SET template_id='item:precision_lock_tool' WHERE id=$1", [item.id]);
      const row = (await pool.query('SELECT * FROM item_instances WHERE id=$1', [item.id])).rows[0];
      await assert.rejects(() => withItemTransaction(pool, q => assignItemToCurrentCharacter(q, owner.id, item.id, 'exact-assignment-key')),
        { code: 'item_assignment_unavailable' });
      assert.deepEqual((await pool.query('SELECT * FROM item_instances WHERE id=$1', [item.id])).rows[0], row);
      console.log('external-correction assignment: corrupted legacy-shaped alias on exact row refused at precheck PASS');
    }
  }, existingPool);
}

// These regressions exercise the complete real root. The SQL wrapper only supplies deterministic
// fixture IDs/clocks before the grant writes its history, or observes the actual selected/locked rows.
async function runFifoCorrections(existingPool, only) {
  const lots = await import('../src/itemlots.js');
  if (!only || only === 'fifo-drift') await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    for (const mode of ['quantity', 'identity', 'earlier-prefix', 'shortfall', 'unused-tail', ...(dbCaps.skipLocked ? ['microsecond'] : [])]) {
      const granted = [], stamps = ['2026-01-01T00:00:00.000001Z', '2026-01-02T00:00:00.000001Z', '2026-01-03T00:00:00.000001Z'];
      const clocked = forwardPool(pool, { after: async (sql, values, result, q) => {
        if (!sql.startsWith('INSERT INTO item_lots ')) return;
        const stamp = stamps[granted.length];
        await q.query('UPDATE item_lots SET created_at=$2 WHERE lot_id=$1', [result.rows[0].lot_id, stamp]);
        result.rows[0].created_at = new Date(stamp);
      } });
      await withItemTransaction(clocked, q => withLotMutation(q, lotRequest(owner, definition), async m => {
        for (let i = 0; i < 3; i++) granted.push(await lots.grantLot(q, m, definition, lotOutput(owner, definition, { binding: mode })));
        return { granted: 3 };
      }));
      const request = lotRequest(owner, definition), before = await snapshot();
      const selector = lotSelector(owner, definition, mode === 'shortfall' ? 25 : 2, { binding: mode });
      const target = mode === 'earlier-prefix' || mode === 'shortfall' || mode === 'unused-tail' ? 2 : 0;
      const column = mode === 'identity' ? 'binding' : mode === 'earlier-prefix' || mode === 'microsecond' ? 'created_at' : 'remaining_quantity';
      const changed = mode === 'identity' ? 'changed-identity' : mode === 'earlier-prefix' ? '2025-12-31T00:00:00.000001Z'
        : mode === 'microsecond' ? '2026-01-01T00:00:00.000002Z' : mode === 'shortfall' ? 4 : 9;
      const original = column === 'binding' ? mode : column === 'created_at' ? stamps[target] : 10;
      let activeClient, injected = false, entered = 0; const locked = [];
      const drift = forwardPool(pool, { after: async (sql, values, result, q) => {
        if (sql !== 'SELECT * FROM item_lots WHERE lot_id=$1 FOR UPDATE') return;
        locked.push(values[0]);
        if (injected) return;
        injected = true;
        registerItemTransactionUndo(activeClient, () => activeClient.query(`UPDATE item_lots SET ${column}=$2 WHERE lot_id=$1`, [granted[target].lotId, original]));
        await q.query(`UPDATE item_lots SET ${column}=$2 WHERE lot_id=$1`, [granted[target].lotId, changed]);
      } });
      const execute = targetPool => withItemTransaction(targetPool, q => { activeClient = q; return withLotMutation(q, request, m =>
        lots.withCompleteItemCandidates(q, m, createItemLockTrace(), { root: { owner, authority: request.request.authority },
          requirements: [{ kind: 'lot_fifo', selector }] }, async () => { entered++; return lots.consumeLotsFifo(q, m, selector); })); });
      if (mode === 'unused-tail') {
        const result = await execute(drift); assert.equal(result[0].lotId, granted[0].lotId);
        assert.equal((await pool.query('SELECT remaining_quantity FROM item_lots WHERE lot_id=$1', [granted[2].lotId])).rows[0].remaining_quantity, 9,
          'an unselected tail change which cannot affect selection does not abort the root');
        // Restore the separate fixture-only tail edit so later invariant/snapshot checks stay meaningful.
        await pool.query('UPDATE item_lots SET remaining_quantity=10 WHERE lot_id=$1', [granted[2].lotId]);
        assert.deepEqual(await execute(pool), result); assert.equal(entered, 1);
      } else {
        await assert.rejects(() => execute(drift), { code: 'contention' });
        assert.equal(entered, 0, `${mode}: drift cannot reach any leaf`); assert.equal(injected, true);
        assert.deepEqual(await snapshot(), before, `${mode}: native rollback/pg-mem compensation removes every guard/item/event/IO effect`);
        assert(locked.every(id => (mode === 'shortfall' ? granted : granted.slice(0, 1)).some(row => row.lotId === id)),
          `${mode}: revalidation cannot acquire a newly eligible prefix key late`);
        const result = await execute(pool), committed = await snapshot();
        assert.deepEqual(await execute(pool), result); assert.deepEqual(await snapshot(), committed); assert.equal(entered, 1);
      }
    }
    console.log(`fifo-correction drift: quantity, identity, earlier prefix, changed shortfall, irrelevant tail${dbCaps.skipLocked ? ', native same-millisecond timestamp' : ''}, zero-write abort and same-key retry/replay PASS`);
  }, existingPool);
  if (!only || only === 'fifo-filter') await withItemFixture(async ({ pool, accountOwner: owner }) => {
    const source = materialSource({ qualityMode: 'inherited', definitionVersion: 2 }); source.version = 2;
    const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
    const definition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const dimensions = [
      ['qualityBand', 'Pristine Ω'], ['qualityStateDigest', 'b'.repeat(64)], ['binding', 'bound'],
      ['transferRestriction', 'restricted'], ['seasonId', 'season-1'], ['runId', 'run-1'], ['sourceCapId', 'cap-1'],
      ['expiresAt', '2028-01-01T00:00:00.000Z'], ['ageBasisAt', '2025-01-01T00:00:00.000Z'],
      ['provenanceCoalescingClass', 'other-source'],
    ];
    for (const [index, [field, value]] of dimensions.entries()) {
      const base = { provenanceCoalescingClass: `filter-${index}`, ...(field === 'provenanceCoalescingClass' ? { binding: 'class-filter' } : {}) };
      const granted = [];
      await withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, definition), async m => {
        granted.push(await lots.grantLot(q, m, definition, lotOutput(owner, definition, base)));
        granted.push(await lots.grantLot(q, m, definition, lotOutput(owner, definition, { ...base, [field]: value })));
        return { granted: 2 };
      }));
      for (let selected = 0; selected < 2; selected++) {
        const selector = lotSelector(owner, definition, 1, { ...base, ...(selected ? { [field]: value } : {}) });
        let queries = 0;
        const observed = forwardPool(pool, { after: async (sql, values, result) => {
          if (!sql.includes('FROM item_lots') || !sql.includes('LIMIT 4097')) return;
          queries++;
          assert.deepEqual(result.rows.map(row => row.lot_id), [granted[selected].lotId],
            `${field}/${selected}: exact identity, including null, filters the SQL result before its bound`);
          assert(values.every(value => !Array.isArray(value)), 'every SQL bind is scalar; no array ANY/SOME coercion');
        } });
        const request = lotRequest(owner, definition);
        const consumed = await withItemTransaction(observed, q => withLotMutation(q, request, m => lots.withCompleteItemCandidates(q, m,
          createItemLockTrace(), { root: { owner, authority: request.request.authority }, requirements: [{ kind: 'lot_fifo', selector }] },
          () => lots.consumeLotsFifo(q, m, selector))));
        assert.equal(queries, 2, 'the same filtered selection is resolved before and after locking');
        assert.equal(consumed[0].lotId, granted[selected].lotId);
      }
    }
    console.log('fifo-correction filtering: ten exact economic dimensions, null/non-null SQL selection and scalar binds PASS');
  }, existingPool);
  if ((!only || only === 'fifo-precision') && dbCaps.skipLocked) await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    let index = 0; const replacements = new Map();
    const ids = ['z-micro-old', 'a-micro-new', 'Z-tie-first', 'a-tie-second'];
    const stamps = ['2026-01-01T00:00:00.000001Z', '2026-01-01T00:00:00.000002Z',
      '2026-01-02T00:00:00.000001Z', '2026-01-02T00:00:00.000001Z'];
    const fixture = forwardPool(pool, { before: async (sql, values) => {
      if (sql.startsWith('INSERT INTO item_lots ')) replacements.set(values[0], ids[index]);
      if (values) for (let i = 0; i < values.length; i++) if (replacements.has(values[i])) values[i] = replacements.get(values[i]);
    }, after: async (sql, values, result, q) => {
      if (!sql.startsWith('INSERT INTO item_lots ')) return;
      await q.query('UPDATE item_lots SET created_at=$2 WHERE lot_id=$1', [result.rows[0].lot_id, stamps[index]]);
      result.rows[0].created_at = new Date(stamps[index++]);
    } });
    await withItemTransaction(fixture, q => withLotMutation(q, lotRequest(owner, definition), async m => {
      for (let i = 0; i < ids.length; i++) await lots.grantLot(q, m, definition, lotOutput(owner, definition, { quantity: 1 }));
      return { granted: 4 };
    }));
    const precise = (await pool.query("SELECT lot_id,to_char(created_at AT TIME ZONE 'UTC','YYYY-MM-DD\"T\"HH24:MI:SS.US\"Z\"') AS stamp FROM item_lots ORDER BY created_at,lot_id COLLATE \"C\"")).rows;
    assert.deepEqual(precise.map(row => [row.lot_id, row.stamp]), ids.map((id, i) => [id, stamps[i]]));
    const uniqueSource = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1,
      ownerScopes: ['account', 'project'], definitionVersion: 2 }); uniqueSource.version = 2;
    const artifact = compileFixture(uniqueSource); await storeSealedBundle(pool, artifact.request);
    const uniqueDefinition = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
    const unique = await withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, uniqueDefinition), m => lots.grantUnique(q, m,
      uniqueDefinition, { logicalItemId: uniqueDefinition.logicalItemId, definitionHash: uniqueDefinition.definitionHash,
        owner, qualityBand: null, qualityStateDigest: null, tradePolicyHash: uniqueDefinition.definitionHash,
        conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) })));
    const directExpected = { definitionHash: uniqueDefinition.definitionHash, owner, state: 'active',
      custody: { state: 'direct', scope: null, id: null }, qualityBand: null, qualityStateDigest: null,
      conditionSummary: null, exportPolicy: 'ineligible' };
    const operationFixture = { pool, permissions: { actorAccountId: owner.id, role: 'custodian' } };
    await prepareDormantOperationFixture(operationFixture);
    const operationId = operationFixture.operation.id, escrowRequest = lotRequest(owner, uniqueDefinition);
    escrowRequest.request.authority.aggregate = { kind: 'operation', id: operationId };
    escrowRequest.request.authority.itemTransitions = [{ kind: 'escrow', operationId,
      subject: { storageKind: 'unique', itemId: unique.id, expected: directExpected } }];
    await withItemTransaction(pool, q => withLotMutation(q, escrowRequest, m => lots.withCompleteItemCandidates(q, m, createItemLockTrace(),
      { root: { owner, authority: escrowRequest.request.authority }, requirements: [{ kind: 'unique_exact', itemId: unique.id, expected: directExpected }] },
      () => lots.applyItemTransition(q, m, 0))));
    const expected = { ...directExpected, owner: { scope: 'operation', id: operationId }, state: 'escrowed',
      custody: { state: 'escrowed', scope: 'operation', id: operationId } };
    const request = lotRequest(owner, definition), selector = lotSelector(owner, definition, 3), trace = createItemLockTrace();
    request.request.authority.inputDefinitionHashes = [definition.definitionHash, uniqueDefinition.definitionHash].sort();
    request.request.authority.aggregate = { kind: 'operation', id: operationId };
    request.request.authority.itemTransitions = [{ kind: 'consume_unique', depositor: owner,
      subject: { storageKind: 'unique', itemId: unique.id, expected } }];
    const result = await withItemTransaction(pool, q => withLotMutation(q, request, m => lots.withCompleteItemCandidates(q, m, trace,
      { root: { owner, authority: request.request.authority }, requirements: [{ kind: 'lot_fifo', selector }, { kind: 'unique_exact', itemId: unique.id, expected }] },
      async () => { const parts = await lots.consumeLotsFifo(q, m, selector); await lots.applyItemTransition(q, m, 0); return parts; })));
    assert.deepEqual(result.map(row => row.lotId), ['z-micro-old', 'a-micro-new', 'Z-tie-first'],
      'actual consumption preserves microseconds and canonical bytewise equal-time ID ties');
    assert.deepEqual(trace.snapshot().map(row => [row.subtype, row.id]), [['custody', unique.id], ['lot', 'Z-tie-first'],
      ['lot', 'a-micro-new'], ['lot', 'z-micro-old'], ['unique', unique.id]],
    'canonical mixed custody/lot/unique acquisition remains independent of precise native FIFO');
    const committed = await snapshot();
    assert(!JSON.stringify(committed).includes('candidate_created_at'), 'private precision evidence never reaches physical rows/history/IO');
    assert.equal(committed.item_lots.find(row => row.lot_id === 'a-tie-second').remaining_quantity, 1);
    console.log('fifo-correction native precision: .000001/.000002 consumption, C-collation timestamp ties and independent lock order PASS');
  }, existingPool);
  if (!only || only === 'fifo-overlap') await withItemFixture(async ({ pool, accountOwner: owner, definition, snapshot }) => {
    const cases = [
      { name: 'sufficient-prefix', quantities: [2], want: [[['z-old', 10, 2, 8]]], locks: ['z-old'] },
      { name: 'repeated-fifo', quantities: [10, 10], want: [[['z-old', 10, 10, 0]], [['a-next', 10, 10, 0]]], locks: ['a-next', 'z-old'] },
      { name: 'partial-oldest', quantities: [4, 8], want: [[['z-old', 10, 4, 6]], [['z-old', 6, 6, 0], ['a-next', 10, 2, 8]]], locks: ['a-next', 'z-old'] },
      { name: 'explicit-before-compatible', quantities: [10, 3], kinds: ['ids', 'fifo'], want: [[['z-old', 10, 10, 0]], [['a-next', 10, 3, 7]]], locks: ['a-next', 'z-old'] },
      { name: 'exact-before-fifo', quantities: [10, 3], kinds: ['exact', 'fifo'], want: [[['z-old', 10, 10, 0]], [['a-next', 10, 3, 7]]], locks: ['a-next', 'z-old'] },
      { name: 'fifo-before-exact-partial', quantities: [3, 7], kinds: ['fifo', 'exact'], want: [[['z-old', 10, 3, 7]], [['z-old', 7, 7, 0]]], locks: ['z-old'] },
      { name: 'fifo-before-exact-shortage', quantities: [10, 1], kinds: ['fifo', 'exact'], shortage: true, locks: ['z-old'] },
    ];
    for (const test of cases) {
      let index = 0; const replacements = new Map();
      const names = ['z-old', 'a-next', 'm-tail'], ids = names.map(id => `${test.name}-${id}`);
      const fixture = forwardPool(pool, { before: async (sql, values) => {
        if (sql.startsWith('INSERT INTO item_lots ')) replacements.set(values[0], ids[index]);
        if (values) for (let i = 0; i < values.length; i++) if (replacements.has(values[i])) values[i] = replacements.get(values[i]);
      }, after: async (sql, values, result, q) => {
        if (!sql.startsWith('INSERT INTO item_lots ')) return;
        const stamp = `2026-01-0${++index}T00:00:00.000Z`;
        await q.query('UPDATE item_lots SET created_at=$2 WHERE lot_id=$1', [result.rows[0].lot_id, stamp]);
        result.rows[0].created_at = new Date(stamp);
      } });
      await withItemTransaction(fixture, q => withLotMutation(q, lotRequest(owner, definition), async m => {
        for (let i = 0; i < 3; i++) await lots.grantLot(q, m, definition, lotOutput(owner, definition, { binding: test.name }));
        return { granted: 3 };
      }));
      const requirements = test.quantities.map((quantity, i) => (test.kinds?.[i] === 'exact'
        ? { kind: 'lot_exact', lotId: ids[0], quantity }
        : { kind: 'lot_fifo', selector: lotSelector(owner, definition, quantity, { binding: test.name,
          ...(test.kinds?.[i] === 'ids' ? { selection: 'lot_ids', lotIds: [ids[0]] } : {}) }) }));
      const request = lotRequest(owner, definition), trace = createItemLockTrace();
      const before = await snapshot(); let entered = 0;
      const execute = () => withItemTransaction(pool, q => withLotMutation(q, request, m => lots.withCompleteItemCandidates(q, m, trace,
        { root: { owner, authority: request.request.authority }, requirements }, async () => {
          entered++;
          assert.deepEqual(trace.snapshot().map(row => row.id), test.locks.map(id => `${test.name}-${id}`),
            `${test.name}: only the sufficient whole-root selection locks, canonically, before any leaf`);
          const results = [];
          for (const requirement of requirements) results.push(requirement.kind === 'lot_exact'
            ? [await lots.consumeExactLot(q, m, requirement.lotId, requirement.quantity)]
            : await lots.consumeLotsFifo(q, m, requirement.selector));
          return results;
        })));
      if (test.shortage) {
        await assert.rejects(execute, { code: 'materials' }); assert.equal(entered, 0);
        assert.deepEqual(await snapshot(), before, 'unchanged ordered exact/FIFO shortage writes nothing');
      } else {
        const results = await execute();
        assert.deepEqual(results.map(parts => parts.map(row => [row.lotId.slice(test.name.length + 1), row.beforeQuantity,
          row.removedQuantity, row.afterQuantity])), test.want, `${test.name}: shared shadow balances preserve ordered allocation`);
        const committed = await snapshot(); assert.deepEqual(await execute(), results); assert.deepEqual(await snapshot(), committed);
        assert.equal(entered, 1, 'matching receipt returns before candidate admission and leaves');
        assert.deepEqual(committed.item_lots.find(row => row.lot_id === ids[2]), before.item_lots.find(row => row.lot_id === ids[2]),
          'unused tail row remains byte-equivalent');
        assert.deepEqual(committed.item_events.filter(row => row.lot_id === ids[2]), before.item_events.filter(row => row.lot_id === ids[2]),
          'unused tail history remains byte-equivalent');
      }
    }
    console.log('fifo-correction overlap: sufficient prefix, repeated/partial/explicit/exact ordering, unchanged shortage and replay PASS');
  }, existingPool);
}

async function exerciseLargeFifo({ pool, owner, definition, snapshot }, frozen) {
  const lots = await import('../src/itemlots.js');
  const grant = output => withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, definition), m =>
    lots.grantLot(q, m, definition, lotOutput(owner, definition, output))));
  // The paging fixture exhausted its first row. A fresh real grant restores 4097 compatible
  // positive holdings without editing their authority/history or imposing an owner holding cap.
  const replenished = await grant({ quantity: 2 });
  const narrow = await grant({ quantity: 2, binding: 'fifo-narrow' });
  const eligible = [...frozen.slice(1), replenished];
  const traceFor = () => {
    const inner = createItemLockTrace(); let admitted = null;
    return { trace: { admitCandidates(kind, entries) { admitted = entries; inner.admitCandidates(kind, entries); },
      record: entry => inner.record(entry), snapshot: () => inner.snapshot() }, get admitted() { return admitted; } };
  };
  const execute = (request, requirements, tracker, action, target = pool) => withItemTransaction(target,
    q => withLotMutation(q, request, m => lots.withCompleteItemCandidates(q, m, tracker.trace,
      { root: { owner, authority: request.request.authority }, requirements }, () => action(q, m))));
  let boundedQueries = 0, largestResult = 0;
  const observed = forwardPool(pool, { after: async (sql, values, result) => {
    if (!sql.includes('FROM item_lots') || !sql.includes('LIMIT 4097')) return;
    boundedQueries++; largestResult = Math.max(largestResult, result.rows.length);
    assert(result.rows.length <= 4097, 'each actual FIFO result is bounded even for a large owner');
    assert(values.every(value => !Array.isArray(value)), 'large explicit selectors still bind scalar IDs');
  } });
  for (const test of [
    { name: 'unrelated-identities', selector: lotSelector(owner, definition, 1, { binding: 'fifo-narrow' }), id: narrow.lotId },
    { name: 'explicit-id-after-old-cap', selector: lotSelector(owner, definition, 1, { selection: 'lot_ids', lotIds: [replenished.lotId] }), id: replenished.lotId },
    { name: '4097-compatible-small-spend', selector: lotSelector(owner, definition, 1), id: eligible[0].lotId },
  ]) {
    const before = await snapshot(), request = lotRequest(owner, definition), tracker = traceFor();
    const parts = await execute(request, [{ kind: 'lot_fifo', selector: test.selector }], tracker,
      (q, m) => lots.consumeLotsFifo(q, m, test.selector), observed);
    assert.deepEqual(parts.map(row => row.lotId), [test.id], `${test.name}: unrelated owner cardinality cannot deny an exact spend`);
    assert.deepEqual(tracker.admitted.map(row => row.id), [test.id], `${test.name}: only sufficient physical keys are retained/admitted`);
    const after = await snapshot();
    assert.deepEqual(after.item_lots.filter(row => row.lot_id !== test.id), before.item_lots.filter(row => row.lot_id !== test.id));
    assert.deepEqual(after.item_events.filter(row => row.lot_id !== test.id), before.item_events.filter(row => row.lot_id !== test.id));
  }
  assert.equal(largestResult, 4097, '4097 fully filtered results are evidence, not an automatic overflow');
  const prefixQuantity = count => count * 2 - 1; // oldest is now one; replenished last row is also one.
  const allQuantity = 8192; // 4097*2, less the explicit and compatible one-unit spends above.
  const uniqueSource = materialSource({ kind: 'item', stackable: false, maximumLotQuantity: 1,
    ownerScopes: ['account', 'project'], definitionVersion: 2 }); uniqueSource.version = 2;
  const uniqueArtifact = compileFixture(uniqueSource); await storeSealedBundle(pool, uniqueArtifact.request);
  const uniqueDefinition = await definitionByHash(pool, uniqueArtifact.expectedDefinitions[0].definitionHash);
  const unique = await withItemTransaction(pool, q => withLotMutation(q, lotRequest(owner, uniqueDefinition), m => lots.grantUnique(q, m,
    uniqueDefinition, { logicalItemId: uniqueDefinition.logicalItemId, definitionHash: uniqueDefinition.definitionHash,
      owner, qualityBand: null, qualityStateDigest: null, tradePolicyHash: uniqueDefinition.definitionHash,
      conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) })));
  const directExpected = { definitionHash: uniqueDefinition.definitionHash, owner, state: 'active',
    custody: { state: 'direct', scope: null, id: null }, qualityBand: null, qualityStateDigest: null,
    conditionSummary: null, exportPolicy: 'ineligible' };
  const inputRequest = () => {
    const request = lotRequest(owner, definition);
    request.request.authority.inputDefinitionHashes = [definition.definitionHash, uniqueDefinition.definitionHash].sort();
    return request;
  };
  const unchangedFailure = async (name, request, requirements, code) => {
    const before = await snapshot(), tracker = traceFor(); let entered = 0;
    await assert.rejects(() => execute(request, requirements, tracker, async () => { entered++; return false; }, observed), { code });
    assert.equal(entered, 0, `${name}: no leaf begins`);
    if (code === 'contention') { assert.equal(tracker.admitted, null); assert.deepEqual(tracker.trace.snapshot(), [], `${name}: no late or partial locks`); }
    assert.deepEqual(await snapshot(), before, `${name}: no committed item/history/IO/guard effects`);
  };
  await unchangedFailure('single requirement genuinely needs 4097 lot keys', inputRequest(),
    [{ kind: 'lot_fifo', selector: lotSelector(owner, definition, allQuantity) }], 'contention');
  await unchangedFailure('cumulative requirements genuinely need 4097 lot keys', inputRequest(),
    [4000, allQuantity - 4000].map(quantity => ({ kind: 'lot_fifo', selector: lotSelector(owner, definition, quantity) })), 'contention');
  await unchangedFailure('4096 lot keys plus one direct unique exceed physical budget', inputRequest(),
    [{ kind: 'lot_fifo', selector: lotSelector(owner, definition, prefixQuantity(4096)) },
      { kind: 'unique_exact', itemId: unique.id, expected: directExpected }], 'contention');
  await unchangedFailure('unchanged exact-identity shortage is materials despite large owner', inputRequest(),
    [{ kind: 'lot_fifo', selector: lotSelector(owner, definition, 2, { binding: 'fifo-narrow' }) }], 'materials');
  const operationFixture = { pool, permissions: { actorAccountId: owner.id, role: 'custodian' } };
  await prepareDormantOperationFixture(operationFixture);
  const operationId = operationFixture.operation.id, escrowRequest = lotRequest(owner, uniqueDefinition);
  escrowRequest.request.authority.aggregate = { kind: 'operation', id: operationId };
  escrowRequest.request.authority.itemTransitions = [{ kind: 'escrow', subject: { storageKind: 'unique', itemId: unique.id, expected: directExpected }, operationId }];
  await execute(escrowRequest, [{ kind: 'unique_exact', itemId: unique.id, expected: directExpected }], traceFor(), (q, m) => lots.applyItemTransition(q, m, 0));
  const expected = { ...directExpected, owner: { scope: 'operation', id: operationId }, state: 'escrowed',
    custody: { state: 'escrowed', scope: 'operation', id: operationId } };
  const mixedRequest = () => {
    const request = inputRequest(); request.request.authority.aggregate = { kind: 'operation', id: operationId };
    request.request.authority.itemTransitions = [{ kind: 'consume_unique', depositor: owner,
      subject: { storageKind: 'unique', itemId: unique.id, expected } }];
    return request;
  };
  await unchangedFailure('4095 lot keys plus custody and unique exceed physical budget', mixedRequest(),
    [{ kind: 'unique_exact', itemId: unique.id, expected },
      { kind: 'lot_fifo', selector: lotSelector(owner, definition, prefixQuantity(4095)) }], 'contention');
  const request = mixedRequest(), tracker = traceFor(), before = await snapshot();
  const selectors = [4000, prefixQuantity(4094) - 4000].map(quantity => lotSelector(owner, definition, quantity));
  const requirements = selectors.map(selector => ({ kind: 'lot_fifo', selector }));
  requirements.push({ kind: 'unique_exact', itemId: unique.id, expected });
  const spend = async (q, m) => {
    assert.equal(tracker.admitted.length, 4096, '4094 selected lots plus custody and unique reach exactly 4096 physical keys');
    assert.equal(tracker.trace.snapshot().length, 4096, 'the entire union locks before the first leaf');
    assert.equal(tracker.admitted[0].subtype, 'custody'); assert.equal(tracker.admitted.at(-1).subtype, 'unique');
    const parts = [];
    for (const selector of selectors) parts.push(...await lots.consumeLotsFifo(q, m, selector));
    assert.deepEqual([...new Set(parts.map(row => row.lotId))], eligible.slice(0, 4094).map(row => row.lotId),
      'shared allocation consumes the exactly sufficient FIFO prefix in order at the physical bound');
    const moved = await lots.applyItemTransition(q, m, 0);
    return { removed: parts.reduce((sum, row) => sum + row.removedQuantity, 0), unique: moved.after.uniqueState };
  };
  const result = await execute(request, requirements, tracker, spend, observed);
  assert.deepEqual(result, { removed: 8187, unique: 'consumed' });
  const committed = await snapshot(), untouched = new Set(eligible.slice(4094).map(row => row.lotId));
  assert.deepEqual(committed.item_lots.filter(row => untouched.has(row.lot_id)), before.item_lots.filter(row => untouched.has(row.lot_id)));
  assert.deepEqual(committed.item_events.filter(row => untouched.has(row.lot_id)), before.item_events.filter(row => untouched.has(row.lot_id)));
  assert.deepEqual(await execute(request, requirements, tracker, spend, observed), result); assert.deepEqual(await snapshot(), committed);
  assert(boundedQueries >= 16, 'bounded SQL evidence covers initial resolution, complete revalidation and overflow attempts');
  console.log(`fifo-correction bounds: 4097 real compatible holdings, unrelated/explicit selection, shared overflow/shortage, 4096 mixed-key success and replay PASS (${boundedQueries} bounded queries, max ${largestResult} returned rows; no row-visit/index-performance claim)`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await runLots();
