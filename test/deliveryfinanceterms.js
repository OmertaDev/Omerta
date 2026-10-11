import assert from 'node:assert/strict';
import { LOAN, loanOwed, loanVig } from '../src/rules.js';
import { trunkCap } from '../src/game.js';
import { deliveryFinanceTerms, deliveryFinanceQuote } from '../src/deliveryfinanceterms.js';
const now = Date.parse('2026-10-11T16:00:00.000Z'), iso = ms => new Date(ms).toISOString();
const party = id => ({ id, account_id: id + '_account', alive: true, is_npc: false, cash: '10000.5' });
const terms = extra => ({ supplierId: 'supplier', lenderId: 'lender', commitmentId: 'commitment', principal: 5000, rate: 0.1, hours: 1, ...extra });
const source = () => ({ supplier: party('supplier'), lender: party('lender'), buyer: party('buyer'),
  commitment: { id: 'commitment', order_id: 'order', depot_id: 'depot', supplier_character: 'supplier', buyer_character: 'buyer',
    status: 'accepted', good_id: 'gin', district: 'docks', unit_price: '1000', quantity: 10, remaining: 10,
    spend_limit: '100000', spent: '0', take_bps: 200, deadline: iso(now + 600000) },
  order: { id: 'order', depot_id: 'depot', seller_character: 'buyer', kind: 'order', status: 'live', good_id: 'gin',
    district: 'docks', price: '1000', qty: 10, expires_at: iso(now + 3600000) },
  owned: { assets: [], cargo: {}, skills: new Set() }, acct: { omr: 0 } });
let cases = 0;
const test = (name, fn) => { fn(); cases++; };
const rejects = (body, context, reason) => {
  const q = deliveryFinanceQuote(body, context, now); assert.equal(q.eligible, false); if (reason) assert.equal(q.reason, reason);
  assert.equal(q.fundsReserved, false); assert.equal(q.guaranteedIncome, false);
};
test('canonical term boundaries and known one-debt limit', () => {
  for (const principal of [LOAN.MIN, LOAN.MAX]) for (const rate of [0.0001, LOAN.RATE_MAX]) for (const hours of [LOAN.TERM_MIN_H, LOAN.TERM_MAX_H]) {
    const body = terms({ principal, rate, hours }); assert.deepEqual(deliveryFinanceTerms(body), body);
  }
  const q = deliveryFinanceQuote(terms(), source(), now);
  assert.equal(q.eligible, true); assert.equal(q.maxActiveLoans, 1); assert.equal(LOAN.MAX_ACTIVE, 1);
  assert.equal(q.owed, 5500); assert.equal(q.vig, 275); assert.equal(q.projectedLenderReceipt, 5225);
  assert.equal(q.fullSettlementNet, 9800); assert.equal(q.projectedCashRemainder, 4300);
  assert.equal(q.trunkCapacity, trunkCap({ owned: source().owned, acct: source().acct }));
  assert.equal(q.fundsReserved, false); assert.equal(q.guaranteedIncome, false); assert.match(q.scope, /no backing, payout or profit guarantee/);
});
test('strict request schema rejects malformed and extra authority terms', () => {
  for (const [field, values] of [['principal', [4999, 1000001, 5000.5, '5000', NaN]], ['rate', [0, -1, 0.5001, '0.1', Infinity]],
    ['hours', [0, 73, 1.5, '1']], ['supplierId', ['', null, 'a/b']], ['lenderId', ['supplier', {}, '']], ['commitmentId', ['', null]]])
    for (const value of values) assert.throws(() => deliveryFinanceTerms(terms({ [field]: value })), TypeError);
  for (const field of ['ownerAuthority', 'collateralOmr', 'providerId', 'cashBacking', 'quantity', 'takeBps', 'maxOwed'])
    assert.throws(() => deliveryFinanceTerms(terms({ [field]: 1 })), TypeError);
  for (const field of Object.keys(terms())) { const body = terms(); delete body[field]; assert.throws(() => deliveryFinanceTerms(body), TypeError); }
  for (const body of [null, [], Object.create(terms())]) assert.throws(() => deliveryFinanceTerms(body), TypeError);
  const symbolic = terms(); symbolic[Symbol('authority')] = true; assert.throws(() => deliveryFinanceTerms(symbolic), TypeError);
  const accessor = terms(); Object.defineProperty(accessor, 'rate', { get: () => 0.1 }); assert.throws(() => deliveryFinanceTerms(accessor), TypeError);
});
test('original supplier lender buyer accounts are all independent and alive', () => {
  for (const who of ['supplier', 'lender', 'buyer']) for (const flag of ['alive', 'is_npc']) {
    const s = source(); s[who][flag] = flag === 'alive' ? false : true; rejects(terms(), s, 'parties');
  }
  for (const [a,b] of [['supplier','lender'],['supplier','buyer'],['lender','buyer']]) {
    const s = source(); s[a].account_id = s[b].account_id; rejects(terms(), s, 'independent_parties');
  }
  rejects(terms({ supplierId: 'foreign' }), source(), 'independent_parties');
  rejects(terms({ lenderId: 'foreign' }), source(), 'independent_parties');
  const w = source(); w.supplier.welsher = true; rejects(terms(), w, 'welsher');
  for (const who of ['supplier','lender']) { const s = source(); s[who].jail_until = iso(Date.now() + 60000); rejects(terms(),s,'status'); }
});
test('only untouched accepted full gin delivery against matching live order', () => {
  for (const [field,value] of [['status','delivered'],['status','expired'],['good_id','ammo'],['supplier_character','foreign'],
    ['buyer_character','foreign'],['order_id','foreign'],['depot_id','foreign'],['district','unknown'],['quantity',0],['remaining',9],['spent',1]]) {
    const s = source(); s.commitment[field] = value; rejects(terms(),s);
  }
  for (const [field,value] of [['status','cancelled'],['status','expired'],['kind','good'],['good_id','ammo'],['price',1001],
    ['seller_character','foreign'],['qty',9],['depot_id','foreign'],['district','neon']]) {
    const s = source(); s.order[field] = value; rejects(terms(),s);
  }
  const small = source(); small.commitment.unit_price = 400; small.order.price = 400; rejects(terms(),small,'settlement_too_small');
  const budget = source(); budget.commitment.spend_limit = 4999; rejects(terms(),budget,'procurement_budget');
});
test('exact deadline/expiry and carrying capacity boundaries', () => {
  const expired = source(); expired.commitment.deadline = iso(now); rejects(terms(),expired,'deadline');
  const before = source(); before.order.expires_at = iso(Date.parse(before.commitment.deadline)-1); rejects(terms(),before,'deadline');
  const equal = source(); equal.order.expires_at = equal.commitment.deadline; assert.equal(deliveryFinanceQuote(terms(),equal,now).eligible,true);
  const full = source(); full.owned.cargo.gin = 10; assert.equal(deliveryFinanceQuote(terms(),full,now).eligible,true);
  const other = source(); other.owned.cargo.ammo = 1; rejects(terms(),other,'trunk');
  const badCargo = source(); badCargo.owned.cargo.gin = -1; rejects(terms(),badCargo,'trunk');
  for (const clock of [NaN, Infinity, -1, 'now']) assert.equal(deliveryFinanceQuote(terms(),source(),clock).reason,'clock');
});
test('fractional source cash stays source cash and never becomes reserved funding', () => {
  for (const cash of ['5000.5',5000.5]) {
    const s = source(); s.lender.cash = cash; s.supplier.cash = '0.5';
    const before = structuredClone(s), q = deliveryFinanceQuote(terms(),s,now);
    assert.equal(q.eligible,true); assert.equal(q.principal,5000); assert.equal(q.fundsReserved,false);
    assert.deepEqual(s,before); assert(!Object.hasOwn(q,'cashBacking')); assert(!Object.hasOwn(q,'availableCash'));
  }
  for (const cash of ['0.5',0.5,4999.5,'Infinity','0x2000',NaN,Infinity]) { const s=source();s.lender.cash=cash;rejects(terms(),s,'lender_cash'); }
});
test('cumulative delivery fee and loan vig are both charged with their actual conventions', () => {
  const s = source(); s.commitment.quantity = s.commitment.remaining = s.order.qty = 7;
  s.commitment.unit_price = s.order.price = 1234;
  const q = deliveryFinanceQuote(terms({principal:7000,rate:0.2}),s,now);
  assert.equal(q.eligible,true);assert.equal(q.gross,8638);assert.equal(q.take,173);assert.equal(q.fullSettlementNet,8465);
  assert.notEqual(q.take,Math.ceil(1234*0.02)*7,'Per-unit rounding must not replace committed cumulative rounding');
  assert.equal(q.owed,8400);assert.equal(q.vig,420);assert.equal(q.projectedLenderReceipt,7980);assert.equal(q.projectedCashRemainder,65);
  const lowRate = deliveryFinanceQuote(terms({rate:0.01}),source(),now);
  assert.equal(lowRate.owed,5050); assert.equal(lowRate.vig,253); assert.equal(lowRate.projectedLenderReceipt,4797);
  assert(lowRate.projectedLenderReceipt<lowRate.principal,'Eligible arithmetic is not a guarantee of lender profit');
});

let seed = 1947;
const random = max => { seed = (Math.imul(seed,1664525)+1013904223)>>>0; return seed%max; };
for(let i=0;i<1500;i++) {
  const principal=5000+random(95001),rate=(1+random(5000))/10000,quantity=1+random(10),takeBps=random(501);
  const owed=loanOwed(principal,rate),unitPrice=Math.ceil((owed+1)/quantity/(1-takeBps/10000));
  const s=source();s.lender.cash=principal+0.5;s.commitment.quantity=s.commitment.remaining=s.order.qty=quantity;
  s.commitment.unit_price=s.order.price=unitPrice;s.commitment.take_bps=takeBps;
  const b=terms({principal,rate,hours:1+random(72)}),before=structuredClone(s),q=deliveryFinanceQuote(b,s,now);
  assert.equal(q.eligible,true);assert.equal(q.owed,owed);assert.equal(q.vig,loanVig(owed));
  assert.equal(q.take,Number((BigInt(q.gross)*BigInt(takeBps)+9999n)/10000n));
  assert.equal(q.fullSettlementNet+q.take,q.gross);assert.equal(q.projectedLenderReceipt+q.vig,q.owed);
  assert.equal(q.projectedCashRemainder+q.owed,q.fullSettlementNet);assert(q.owed<=q.fullSettlementNet);
  assert.equal(q.principal,principal);assert.equal(q.fundsReserved,false);assert.equal(q.guaranteedIncome,false);assert.deepEqual(s,before);
  s.commitment.remaining--;rejects(b,s,'untouched_full_delivery');
}
console.log(JSON.stringify({status:'PASS',cases,seed:1947,seededTrials:1500,maxActiveLoans:LOAN.MAX_ACTIVE,
  scope:'Pure bounded admission and canonical loan/delivery rounding quote only; no money, reserve, authority, debt or payout execution'}));
