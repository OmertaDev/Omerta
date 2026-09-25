import assert from 'node:assert/strict';
import { exactSum, equation, reconcileStacks } from '../tools/rc1-resource-journal.js';
assert.equal(exactSum(['900719925474099312345678.123456789', '-900719925474099312345678', '0.000000001']), '0.12345679');
assert.equal(exactSum(['1.00', '-1']), '0');
assert.throws(() => exactSum(['1e-7']), /Nondecimal/);
assert.throws(() => equation({ resource: 'cash', owner: 'a', before: '1', after: '2', authority: [{ rule: 'unchanged' }] }), /Unreconciled/);
const stack = { owner_scope: 'account', owner_id: 'a', template_id: 'steel', quality: 'standard', quantity: 4 };
const before = { stacks: [stack], itemEvents: [] };
assert.throws(() => reconcileStacks(before, { stacks: [{ ...stack, quantity: 5 }], itemEvents: [] }), /Unreconciled/);
assert.throws(() => reconcileStacks(before, { stacks: [{ ...stack, quantity: 3 }], itemEvents: [{ id: 'e', event_kind: 'stack_consumed',
  template_id: 'steel', quality: 'standard', from_owner_scope: 'account', from_owner_id: 'a', quantity_delta: -1,
  quantity_before: 4, quantity_after: 2 }] }), /Internal item-event/);
console.log('RC1 resource journal: exact decimals, missing receipts and deliberately corrupted internal movements rejected');
