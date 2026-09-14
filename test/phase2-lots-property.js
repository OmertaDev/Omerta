import assert from 'node:assert/strict';
import { withItemFixture, lotRequest, injectSqlFailure, prepareDormantOperationFixture, runTrustedDormantItemAction } from './lib/phase2-item-fixtures.js';
import { compileFixture, materialSource } from './lib/phase2-definition-fixtures.js';
import { storeSealedBundle } from '../src/content/artifacts.js';
import { definitionByHash } from '../src/itemdefinitions.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { lotOutput } from './phase2-lots.js';

// Test-local native LCG, following tools/arena.js without importing its executable entrypoint.
function generator(seed) {
  let state = (Math.imul(seed, 2654435761) + 1) >>> 0;
  return (bound) => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return Math.floor(state / 4294967296 * bound); };
}
const smoke = process.argv.includes('--smoke');
assert(process.argv.slice(2).every((arg) => arg === '--smoke'), 'unknown property lane');
const seeds = smoke ? 2 : 100, steps = smoke ? 40 : 250, started = performance.now();
const kinds = ['grant_lot', 'grant_unique', 'split', 'consume_lot', 'escrow_lot', 'escrow_unique', 'release_lot',
  'release_unique', 'consume_escrow_lot', 'consume_unique', 'consume_escrow_unique', 'transfer_unique', 'fault_grant', 'bad_quantity'];
const forced = ['grant_lot', 'grant_unique', 'split', 'escrow_lot', 'release_lot', 'escrow_unique', 'release_unique',
  'transfer_unique', 'consume_unique', 'consume_lot', 'fault_grant', 'bad_quantity', 'escrow_lot', 'consume_escrow_lot',
  'grant_unique', 'escrow_unique', 'consume_escrow_unique'];
const coverage = Object.fromEntries([...kinds, 'retry', 'replay'].map((kind) => [kind, 0]));
const add = (map, key, n) => map.set(key, (map.get(key) ?? 0) + n);
for (let seed = 1; seed <= seeds; seed++) {
  let step = -1;
  try {
    await withItemFixture(async ({ pool, accountOwner, snapshot }) => {
      const random = generator(seed), model = new Map(), minted = new Map(), removed = new Map(), definitions = {};
      const owners = [accountOwner, { scope: 'account', id: `${accountOwner.id}-peer` }], producers = [];
      await pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES ($1,'guest',$1)", [owners[1].id]);
      for (const owner of owners) {
        const fixture = { pool, permissions: { actorAccountId: owner.id, alive: true, role: 'custodian', revision: 1, consent: true }, issuedActions: Object.freeze({}) };
        await prepareDormantOperationFixture(fixture); producers.push(fixture);
      }
      for (const [index, kind] of ['lot', 'unique'].entries()) {
        const source = materialSource({ kind: kind === 'lot' ? 'material' : 'item', stackable: kind === 'lot', qualityMode: 'inherited',
          ownerScopes: ['account', 'project'], maximumLotQuantity: kind === 'lot' ? 100 : 1, definitionVersion: 70 + index }); source.version = 70 + index;
        const artifact = compileFixture(source); await storeSealedBundle(pool, artifact.request);
        definitions[kind] = await definitionByHash(pool, artifact.expectedDefinitions[0].definitionHash);
      }
      const bucket = (entry) => JSON.stringify([definitions[entry.kind].definitionHash, entry.band, entry.digest]);
      for (step = 0; step < steps; step++) {
        let action = forced[step] ?? kinds[random(kinds.length)];
        const kind = action.includes('unique') ? 'unique' : 'lot', escrow = action.startsWith('release') || action.startsWith('consume_escrow');
        const eligible = [...model.values()].filter((entry) => entry.kind === kind && entry.remaining > 0
          && (action === 'split' || (entry.custody.state === 'escrowed') === escrow));
        if (!action.startsWith('grant') && action !== 'fault_grant' && !eligible.length) action = `grant_${kind}`;
        const grant = action.startsWith('grant') || action === 'fault_grant', definition = definitions[kind];
        let entry = grant ? null : eligible[random(eligible.length)], instruction, actor, amount;
        if (grant) {
          actor = random(2); const numeric = random(2) === 1;
          entry = { kind, owner: { ...owners[actor] }, custody: { state: 'direct', scope: null, id: null }, depositor: null,
            original: kind === 'lot' ? 5 + random(5) : 1, band: numeric ? 'fine' : null,
            digest: numeric ? '3594c544fc56792bc96af930461e8859ea7b2997fcf32cb8d570422f717e30ec' : null, parent: null };
          entry.remaining = entry.original;
          const output = kind === 'lot' ? lotOutput(entry.owner, definition, { quantity: entry.original, qualityBand: entry.band, qualityStateDigest: entry.digest })
            : { logicalItemId: definition.logicalItemId, definitionHash: definition.definitionHash, owner: entry.owner,
              qualityBand: entry.band, qualityStateDigest: entry.digest, tradePolicyHash: definition.definitionHash,
              conditionSummary: null, exportPolicy: 'ineligible', provenanceClass: 'awarded', provenanceDigest: 'a'.repeat(64) };
          instruction = { kind: `grant_${kind}`, output };
        } else {
          actor = owners.findIndex((owner) => owner.id === (entry.depositor ?? entry.owner).id);
          amount = action === 'bad_quantity' ? entry.remaining + 1 : 1 + random(entry.remaining);
          const expected = kind === 'lot' ? (() => {
            const { quantity, provenanceClass, provenanceDigest, ...identity } = lotOutput(entry.owner, definition,
              { custody: entry.custody, qualityBand: entry.band, qualityStateDigest: entry.digest });
            return { ...identity, remainingQuantity: entry.remaining };
          })() : { definitionHash: definition.definitionHash, owner: entry.owner, state: entry.custody.state === 'escrowed' ? 'escrowed' : 'active',
            custody: entry.custody, qualityBand: entry.band, qualityStateDigest: entry.digest, conditionSummary: null, exportPolicy: 'ineligible' };
          if (['split', 'consume_lot', 'bad_quantity'].includes(action)) instruction = {
            kind: action === 'split' ? 'split' : 'consume_lot', custody: entry.custody,
            requirements: [{ kind: 'lot_exact', lotId: entry.id, quantity: amount }] };
          else {
            const transitionKind = action.startsWith('escrow') ? 'escrow' : action.startsWith('release') ? 'release'
              : action === 'consume_escrow_unique' ? 'consume_unique' : action;
            const subject = kind === 'lot' ? { storageKind: kind, lotId: entry.id, expected } : { storageKind: kind, itemId: entry.id, expected };
            const extra = transitionKind === 'escrow' ? { operationId: producers[actor].operation.id }
              : transitionKind === 'transfer_unique' ? { destination: owners[1 - actor] } : { depositor: entry.depositor };
            instruction = { kind: 'transition', transition: { kind: transitionKind, subject, ...extra },
              requirements: [kind === 'lot' ? { kind: 'lot_exact', lotId: entry.id, quantity: entry.remaining } : { kind: 'unique_exact', itemId: entry.id, expected }] };
          }
        }
        const producer = producers[actor], rootOwner = action === 'split' ? entry.owner : entry.depositor ?? entry.owner;
        const id = `seed-${seed}-step-${step}`, request = lotRequest(rootOwner, definition,
          { actorAccountId: owners[actor].id, actionKind: 'operation_action' });
        request.request.authority.issuedActionId = id; request.request.authority.aggregate = { kind: 'operation', id: producer.operation.id };
        if (instruction.transition) request.request.authority.itemTransitions = [instruction.transition];
        // Detach server-issued data from the independently mutable oracle before freezing the catalog.
        const issued = JSON.parse(JSON.stringify({ ...instruction, request, definition, role: 'custodian', revision: 1 }));
        producer.issuedActions = Object.freeze({ ...producer.issuedActions, [id]: Object.freeze(issued) });
        const run = () => runTrustedDormantItemAction(producer, { issuedActionId: id });
        if (action === 'bad_quantity') {
          const before = await snapshot(); await assert.rejects(run, { code: 'materials' }); assert.deepEqual(await snapshot(), before); coverage[action]++;
        } else {
          if (action === 'fault_grant') {
            const before = await snapshot(), fault = injectSqlFailure(pool, { table: 'item_mutation_outputs', occurrence: 1, timing: 'after' });
            producer.pool = fault.pool;
            try { await assert.rejects(run, { code: 'injected_failure' }); } finally { fault.restore(); producer.pool = pool; }
            assert.deepEqual(await snapshot(), before); coverage.retry++;
          }
          const result = await run(); coverage[action]++;
          if (grant) {
            entry.id = result.lotId ?? result.id; entry.mutationId = result.mutationId; entry.ordinal = result.outputOrdinal;
            model.set(entry.id, entry); add(minted, bucket(entry), entry.original);
          } else if (action === 'split') {
            const child = { ...entry, owner: { ...entry.owner }, custody: { ...entry.custody }, depositor: entry.depositor && { ...entry.depositor },
              id: result.lotId, original: amount, remaining: amount, parent: entry.id, mutationId: result.mutationId, ordinal: result.outputOrdinal };
            model.set(child.id, child); entry.remaining -= amount;
            if (!entry.remaining) { entry.custody = null; entry.depositor = null; }
          } else if (action.startsWith('consume')) {
            const quantity = action === 'consume_lot' ? amount : entry.remaining;
            add(removed, bucket(entry), quantity); entry.remaining -= quantity;
            if (!entry.remaining) { entry.custody = null; entry.depositor = null; }
          } else if (action.startsWith('escrow')) {
            entry.depositor = entry.owner; entry.owner = { scope: 'operation', id: producer.operation.id };
            entry.custody = { state: 'escrowed', scope: 'operation', id: producer.operation.id };
          } else if (action.startsWith('release')) {
            entry.owner = entry.depositor; entry.depositor = null; entry.custody = { state: 'direct', scope: null, id: null };
          } else if (action === 'transfer_unique') entry.owner = { ...owners[1 - actor] };
          if (step % 10 === 0) {
            const committed = await snapshot(); producer.permissions.role = 'removed-for-replay';
            try { assert.deepEqual(await run(), result); } finally { producer.permissions.role = 'custodian'; }
            assert.deepEqual(await snapshot(), committed); coverage.replay++;
          }
        }
        const rows = [...(await pool.query('SELECT * FROM item_lots')).rows, ...(await pool.query('SELECT * FROM item_instances')).rows];
        const claims = new Map((await pool.query('SELECT * FROM operation_escrow')).rows.map((row) => [row.item_id, row]));
        const inputs = (await pool.query('SELECT * FROM item_mutation_inputs')).rows, outputs = (await pool.query('SELECT * FROM item_mutation_outputs')).rows;
        const events = (await pool.query("SELECT * FROM item_events WHERE event_branch<>'legacy'")).rows;
        const guards = new Map((await pool.query('SELECT * FROM item_mutation_guards')).rows.map((row) => [row.mutation_id, row]));
        const held = new Map(), createdRows = new Map(), removedRows = new Map(), io = new Map();
        assert.equal(rows.length, model.size, 'all physical lineage is retained');
        for (const row of rows) {
          const expected = model.get(row.lot_id ?? row.id); assert.ok(expected);
          assert.equal(row.definition_hash, definitions[expected.kind].definitionHash); assert.equal(row.quality_band, expected.band); assert.equal(row.quality_state_digest, expected.digest);
          assert.equal(row.owner_scope, expected.owner.scope); assert.equal(row.owner_id, expected.owner.id);
          const quantity = expected.kind === 'lot' ? row.remaining_quantity : row.state === 'consumed' ? 0 : 1;
          assert.equal(quantity, expected.remaining); assert.ok(quantity >= 0 && quantity <= expected.original);
          assert.equal(row.state, expected.remaining ? expected.custody.state === 'escrowed' ? 'escrowed' : 'active' : expected.kind === 'lot' ? 'exhausted' : 'consumed');
          const claim = expected.kind === 'lot' ? row : claims.get(row.id);
          if (expected.kind === 'lot') { assert.equal(row.original_quantity, expected.original); assert.equal(row.custody_state, expected.custody?.state ?? null); }
          else assert.equal(Boolean(claim), expected.custody?.state === 'escrowed');
          assert.equal(claim?.depositor_id ?? null, expected.depositor?.id ?? null);
          assert.equal(row.mutation_id, expected.mutationId); assert.equal(row.output_ordinal, expected.ordinal); add(held, bucket(expected), quantity);
          if (expected.parent) {
            const input = inputs.find((value) => value.mutation_id === row.mutation_id && value.input_ordinal === row.source_input_ordinal);
            assert.equal(input.lot_id, expected.parent); assert.equal(input.removed_quantity, expected.original);
          }
        }
        assert.equal(outputs.filter((row) => ['grant', 'split'].includes(row.transition_kind)).length, model.size);
        assert.equal(new Set(outputs.map((row) => `${row.mutation_id}:${row.output_ordinal}`)).size, outputs.length);
        for (const row of inputs) { const counts = io.get(row.event_id) ?? [0, 0]; counts[0]++; io.set(row.event_id, counts);
          if (row.transition_kind.startsWith('consume')) add(removedRows, bucket(model.get(row.lot_id ?? row.item_id)), row.removed_quantity); }
        for (const row of outputs) { const counts = io.get(row.event_id) ?? [0, 0]; counts[1]++; io.set(row.event_id, counts);
          if (row.transition_kind === 'grant') add(createdRows, bucket(model.get(row.lot_id ?? row.item_id)), row.quantity); }
        for (const event of events) {
          const creation = ['lot_granted', 'unique_granted', 'lot_split_output'].includes(event.event_kind);
          const movement = ['lot_escrowed', 'lot_released', 'unique_escrowed', 'unique_released', 'unique_transferred'].includes(event.event_kind);
          assert.deepEqual(io.get(event.id), [creation ? 0 : 1, creation || movement ? 1 : 0]);
          assert.ok(guards.get(event.mutation_id)?.result_json && guards.get(event.mutation_id)?.completed_at);
        }
        for (const key of new Set([...minted.keys(), ...removed.keys(), ...held.keys()])) {
          assert.equal(held.get(key) ?? 0, (minted.get(key) ?? 0) - (removed.get(key) ?? 0), 'independent per-hash/per-quality conservation');
          assert.equal(createdRows.get(key) ?? 0, minted.get(key) ?? 0); assert.equal(removedRows.get(key) ?? 0, removed.get(key) ?? 0);
        }
      }
      const invariant = await runLedgerInvariants(pool, { alert: false });
      assert.equal(invariant.ok, true, JSON.stringify(invariant.checks.filter((check) => !check.ok)));
    });
  } catch (error) { throw new Error(`phase2-lots-property seed=${seed} action=${step}: ${String(error.message).split('\n')[0].slice(0, 240)}`); }
  if (seed === 1 || seed % 10 === 0) console.log(`phase2-lots-property: ${seed}/${seeds} seeds, ${seed * steps} actions, ${((performance.now() - started) / 1000).toFixed(1)}s elapsed`);
}
for (const [kind, count] of Object.entries(coverage)) assert.ok(count > 0, `generated ${kind} coverage is non-vacuous`);
console.log(`phase2-lots-property: ${smoke ? 'SMOKE ONLY' : 'FULL'} ${seeds} seeds x ${steps} actions ${JSON.stringify(coverage)}`);
