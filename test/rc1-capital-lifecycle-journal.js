import assert from 'node:assert/strict';
import { CAPITAL_LIFECYCLE_TABLES, reconcileCapitalLifecycle } from '../tools/rc1-capital-lifecycle-journal.js';
const epoch = Date.parse('2026-09-20T12:00:00.000Z');
const initial = () => ({ ...Object.fromEntries(CAPITAL_LIFECYCLE_TABLES.map(table => [table, []])),
  characters: [{ id: 'original', account_id: 'account', cash: '500', bank: '0', ammo: 25, cb: 0, alive: true, generation: 1 }],
  account_persistent: [{ account_id: 'account', omr: '0', staked: '0', unbonding: '0', rewards: '0' }],
  world_operations: [{ id: 'operation', status: 'recruiting', created_at: new Date(epoch).toISOString(), expires_at: new Date(epoch + 86400000).toISOString() }] });
const receipt = (id, reason, amount, character_id = 'original', account_id = 'account') =>
  ({ id, reason: `coordination:capital:${reason}`, amount, currency: 'cash', counterparty: 'operation', character_id, account_id });
let before = initial(), after = structuredClone(before);
after.characters[0].cash = '400'; after.transactions.push(receipt('deposit', 'deposit', '-100'));
after.world_operation_capital.push({ operation_id: 'operation', role_id: 'organizer', requirement_id: 'funding', account_id: 'account', character_id: 'original', amount: '100', state: 'held' });
reconcileCapitalLifecycle(before, after);
const wrongOwner = structuredClone(after); wrongOwner.world_operation_capital[0].character_id = 'unrelated';
assert.throws(() => reconcileCapitalLifecycle(before, wrongOwner), /wrong original character/);
const unledgered = structuredClone(after); unledgered.characters[0].cash = '400.000000001';
assert.throws(() => reconcileCapitalLifecycle(before, unledgered), /Unreconciled/);
before = after; after = structuredClone(before); after.characters[0].cash = '500';
after.world_operation_capital[0].state = 'refunded'; after.transactions.push(receipt('refund', 'refund', '100')); after.world_operations[0].status = 'expired';
reconcileCapitalLifecycle(before, after, { logicalAt: epoch + 86400000 });
assert.throws(() => reconcileCapitalLifecycle(before, after, { logicalAt: epoch + 86400000 - 1 }), /expired early/);
const deadRefund = structuredClone(after); deadRefund.characters[0].alive = false;
assert.throws(() => reconcileCapitalLifecycle(before, deadRefund, { logicalAt: epoch + 86400000 }), /dead\/replaced/);
const alteredDeadline = structuredClone(before); alteredDeadline.world_operations[0].expires_at = new Date(epoch + 60000).toISOString();
assert.throws(() => reconcileCapitalLifecycle(before, alteredDeadline), /deadline rewritten/);
before.characters[0].alive = false; after = structuredClone(before); after.world_operation_capital[0].state = 'forfeited';
after.transactions.push(receipt('forfeit', 'forfeit', '-100', null, null));
reconcileCapitalLifecycle(before, after);
const wrongForfeit = structuredClone(after); wrongForfeit.characters[0].alive = true;
assert.throws(() => reconcileCapitalLifecycle(before, wrongForfeit), /Living depositor/);
before = after; after = structuredClone(before); reconcileCapitalLifecycle(before, after);
after.transactions.push(receipt('duplicate', 'forfeit', '-100', null, null));
assert.throws(() => reconcileCapitalLifecycle(before, after), /Replay repeated/);
after = structuredClone(before); after.world_operation_capital[0].character_id = 'heir';
assert.throws(() => reconcileCapitalLifecycle(before, after), /owner\/binding rewritten/);
after = structuredClone(before); after.transactions[0].amount = '-99';
assert.throws(() => reconcileCapitalLifecycle(before, after), /Immutable/);
before.item_mutation_guards.push({ idempotency_key: 'guard', mutation_id: 'mutation', completed_at: new Date(epoch).toISOString(), result_json: '{}' });
after = structuredClone(before); after.item_mutation_guards[0].result_json = '{"changed":true}';
assert.throws(() => reconcileCapitalLifecycle(before, after), /Completed mutation receipt changed/);
after = structuredClone(before); after.item_stacks.push({ owner_character_id: 'heir', quantity: '1' });
assert.throws(() => reconcileCapitalLifecycle(before, after), /Material custody/);
console.log('PASS: exact per-owner capital deposit/refund/forfeit, original deadline, immutable receipt and unexplained movement controls');
