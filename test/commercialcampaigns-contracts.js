import assert from 'node:assert/strict';
import { COMMERCIAL_CAMPAIGN_ACTIONS, COMMERCIAL_CAMPAIGNS, commercialCampaignTerms } from '../src/commercialcampaigns-contracts.js';

const create = {
  partnershipId: 'partnership', relationshipHash: 'a'.repeat(64), teamRevision: 1, businessId: 'maker_business',
  manufacturerAccountId: 'maker', guardAccountId: 'guard', firstCarrierAccountId: 'carrier_one', secondCarrierAccountId: 'carrier_two',
  origin: 'docks', handoff: 'brick', destination: 'downtown', scoutFeeCash: 50, minimumStock: 1, scoutTargetAt: '2026-10-16T01:00:00.000Z',
  manufacturingFeeCash: 1, guardPriceCash: 10000, firstFeeCash: 1, secondFeeCash: 1, lifetimeSeconds: 600, consent: true,
};
// Use real supported districts without relying on invented district fixtures.
const { DISTRICTS } = await import('../src/rules.js');
[create.origin, create.handoff, create.destination] = DISTRICTS.slice(0, 3).map(row => row.id);
assert.deepEqual(commercialCampaignTerms('create', create), create);
for (const change of [
  { consent: false }, { guardPriceCash: 9999 }, { scoutFeeCash: 49 }, { firstFeeCash: 1001 },
  { manufacturingFeeCash: 0 }, { lifetimeSeconds: 59 }, { lifetimeSeconds: 3601 },
  { teamRevision: 0 }, { relationshipHash: 'A'.repeat(64) }, { scoutTargetAt: 'tomorrow' },
  { scoutTargetAt: '2026-10-16T01:00:00Z' }, { scoutTargetAt: new Date() },
  { secondCarrierAccountId: 'carrier_one' }, { handoff: create.origin },
  { businessId: {} }, { minimumStock: NaN }, { scoutFeeCash: 50.5 },
  { callback: 'complete' }, { ownerAccountId: 'forged' }, { paid: true }, { currency: 'OMR' },
]) assert.throws(() => commercialCampaignTerms('create', { ...create, ...change }), TypeError);
assert.equal(commercialCampaignTerms('create', { ...create, lifetimeSeconds: 60 }).lifetimeSeconds, 60,
  'The paid timely scout report is independent of its later unclaimed accuracy outcome');
const accessor = { ...create };
Object.defineProperty(accessor, 'guardPriceCash', { enumerable: true, get() { throw Error('Accessor executed'); } });
assert.throws(() => commercialCampaignTerms('create', accessor), TypeError);
assert.throws(() => commercialCampaignTerms('create', Object.assign(Object.create({}), create)), TypeError);
assert.throws(() => commercialCampaignTerms('create', { ...create, [Symbol('hidden')]: true }), TypeError);
const ref = { campaignId: 'campaign', sourceHash: 'b'.repeat(64), consent: true };
for (const action of COMMERCIAL_CAMPAIGN_ACTIONS.filter(value => !['create', 'scout-report'].includes(value))) {
  assert.deepEqual(commercialCampaignTerms(action, ref), ref);
  assert.throws(() => commercialCampaignTerms(action, { ...ref, proof: {} }), TypeError);
}
assert.deepEqual(commercialCampaignTerms('scout-report', { ...ref, predictsAvailable: false }), { ...ref, predictsAvailable: false });
assert.throws(() => commercialCampaignTerms('scout-report', { ...ref, predictsAvailable: 'false' }), TypeError);
for (const action of ['execute-anything', 'claim-attack', 'onchain-burn', 'mint', 'pay']) {
  assert.throws(() => commercialCampaignTerms(action, ref), TypeError);
}
assert(Object.isFrozen(COMMERCIAL_CAMPAIGNS));
assert(Object.isFrozen(COMMERCIAL_CAMPAIGNS.roles));
assert.equal(COMMERCIAL_CAMPAIGNS.guardEvidence, 'purchased_bodyguard_coverage');
console.log('PASS closed commercial campaign terms, real source caps, distinct roles/routes, private-source boundary and no caller payment/attack authority.');
