import assert from 'node:assert/strict';
import { LOAN_PROOF_TABLES, reconcileLoanLifecycle } from '../tools/rc1-loan-lifecycle-journal.js';
const initial = () => ({ ...Object.fromEntries(LOAN_PROOF_TABLES.map(table => [table, []])),
  characters: [{ id: 'lender', cash: '10000', bank: '0', ammo: 25, cb: 0, alive: true },
    { id: 'borrower', cash: '10000', bank: '0', ammo: 25, cb: 0, alive: true }],
  street_tax: [{ id: 1, pool: '100000' }], loan_house: [{ id: 1, pool: '0' }], exchange_pool: [{ id: 1, balance: '0' }] });
const receipt = (id, reason, amount, character_id = null) => ({ id, currency: 'cash', reason, amount, character_id });
let before = initial(), after = structuredClone(before);
after.characters[0].cash = '5000'; after.transactions.push(receipt('offer', 'loan:offer', '-5000', 'lender'));
after.loans.push({ id: 'loan', lender_character: 'lender', principal: '5000', rate: '0.1', hours: 1, offered_at: '2026-09-20T12:00:00.000Z',
  offered_to: 'borrower', collateral_min: '5000', collateral_omr: '0', status: 'open' });
reconcileLoanLifecycle(before, after, { label: 'offer' });
const unledgered = structuredClone(after); unledgered.characters[0].cash = '5000.000000001';
assert.throws(() => reconcileLoanLifecycle(before, unledgered, { label: 'offer' }), /Unreconciled/);
before = after; after = structuredClone(before); after.transactions[0].amount = '-4999';
assert.throws(() => reconcileLoanLifecycle(before, after), /Immutable/);
before.cars.push({ id: 'car', character_id: 'borrower', pledged: true, race_limit: '100', pink_slip: true, nos: 1 });
Object.assign(before.loans[0], { status: 'active', borrower_character: 'borrower', collateral_car: 'car', due_at: '2026-09-20T13:00:00.000Z' });
after = structuredClone(before); after.loans[0].status = 'collected'; Object.assign(after.cars[0], { character_id: 'lender', pledged: false, race_limit: null, pink_slip: false, nos: 0 });
assert.equal(reconcileLoanLifecycle(before, after, { label: 'loan sweep' }).carMoves.length, 1);
after.cars[0].character_id = 'unrelated'; assert.throws(() => reconcileLoanLifecycle(before, after, { label: 'loan sweep' }), /owner\/custody/);
after = structuredClone(before); after.loans[0].due_at = '2026-09-20T12:01:00.000Z';
assert.throws(() => reconcileLoanLifecycle(before, after), /deadline rewritten/);
before = initial(); after = structuredClone(before); after.street_tax[0].pool = '75000';
after.bounties.push({ target_character: 'borrower', kind: 'kill', amount: '25000' });
after.bounty_contributors.push({ target_character: 'borrower', kind: 'kill', contributor: 'HOUSE', amount: '25000' });
after.transactions.push(receipt('wanted', 'bounty:wanted', '-25000'));
reconcileLoanLifecycle(before, after, { label: 'loan sweep' });
after.bounty_contributors[0].amount = '24999'; assert.throws(() => reconcileLoanLifecycle(before, after), /contributor custody/);
before = initial(); after = structuredClone(before); after.street_tax[0].pool = '0'; after.exchange_pool[0].balance = '100000';
reconcileLoanLifecycle(before, after, { label: 'buyback', result: { toWindow: 100000 } });
assert.throws(() => reconcileLoanLifecycle(before, after, { label: 'buyback', result: null }), /Unreconciled/);
before = initial(); after = structuredClone(before);
after.characters[0].cash = '15225'; after.characters[1].cash = '4500';
after.street_tax[0].pool = '100138'; after.loan_house[0].pool = '137';
after.transactions.push(receipt('repay-debit', 'loan:repay', '-5500', 'borrower'), receipt('repay-credit', 'loan:repay', '5225', 'lender'),
  receipt('street-vig', 'loan:vig', '-138'), receipt('house-vig', 'loan:house:vig', '137'));
reconcileLoanLifecycle(before, after, { label: 'repay' });
after.loan_house[0].pool = '136'; assert.throws(() => reconcileLoanLifecycle(before, after, { label: 'repay' }), /Unreconciled/);
console.log('PASS: loan/Wanted cash custody, immutable receipts, collateral owner, deadline and contributor corruption controls');
