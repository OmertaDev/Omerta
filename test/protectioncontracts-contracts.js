import assert from 'node:assert/strict';
import { protectionContractTerms, PROTECTION_CONTRACTS, PROTECTION_CONTRACT_ACTIONS } from '../src/protectioncontracts-contracts.js';
const body = { campaignId: 'actual-campaign', campaignSourceHash: 'a'.repeat(64), priceCash: 10000,
  lifetimeSeconds: 600, service: 'canonical_nonexclusive_single_save', consent: true };
assert.deepEqual(protectionContractTerms('fund', body), body);
for (const change of [{ priceCash: 9999 }, { priceCash: 100001 }, { priceCash: 10000.5 }, { priceCash: NaN },
  { lifetimeSeconds: 59 }, { lifetimeSeconds: 3601 }, { service: 'building_armor' }, { service: 'guaranteed_no_attack' },
  { consent: false }, { guardId: 'override' }, { payerAccountId: 'peer' }, { receipt: {} }, { currency: 'USDC' },
  { campaignSourceHash: 'A'.repeat(64) }, { campaignId: {} }, { helper: 'installer' }]) {
  assert.throws(() => protectionContractTerms('fund', { ...body, ...change }), TypeError);
}
for (const action of PROTECTION_CONTRACT_ACTIONS.filter(action => action !== 'fund')) {
  const reference = { contractId: 'contract', sourceHash: 'b'.repeat(64), consent: true };
  assert.deepEqual(protectionContractTerms(action, reference), reference);
  assert.throws(() => protectionContractTerms(action, { ...reference, originalGuard: 'fake' }), TypeError);
}
const accessor = { ...body };
Object.defineProperty(accessor, 'priceCash', { enumerable: true, get() { throw Error('Accessor executed'); } });
assert.throws(() => protectionContractTerms('fund', accessor), TypeError);
assert.throws(() => protectionContractTerms('fund', { ...body, [Symbol('override')]: true }), TypeError);
assert.throws(() => protectionContractTerms('fund', Object.assign(Object.create({}), body)), TypeError);
assert.equal(PROTECTION_CONTRACTS.payerIsProtectedOriginal, true);
assert.equal(PROTECTION_CONTRACTS.outstandingPerPayer, 1);
console.log('PASS closed self-funded nonexclusive protection terms, actual price floor, strict caps, original-only references and no caller coverage/receipt/authority override. No runtime or native funding claim.');
