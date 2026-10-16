import assert from 'node:assert/strict';
import { managementFixture } from './managementteams-fixture.js';
import * as E from '../src/commercialcampaigns.js';
import {inspectCommercialCampaignBusinessHistory} from '../src/commercialcampaignruntime.js';
import {assertDepotFeatureObligations} from '../src/depotacquisitionruntime.js';

assert(process.argv.includes('--postgres'), 'Actual native metadata activation/ownership phase only; no memory fallback.');
const f = await managementFixture(), pool = f.app.pool;
assert.equal(f.native,true,'Native activation never uses the memory adapter.');
let sequence = 0;
const invoke = (player, action, body, key = 'commercial-metadata-' + (++sequence)) =>
  E.commercialCampaignMetadataAction(pool, player.account, action, body, key);
const ref = result => ({ campaignId: result.campaign.campaignId, sourceHash: result.campaign.sourceHash, consent: true });
async function relation(owner, scout, depotId) {
  const made = await f.call(owner, 'POST', '/v1/company/partnerships', {
    depotId, partnerCharacter: scout.id, ownerCapital: 1000, partnerCapital: 1000, partnerBps: 3333,
    maxDistributionCash: 1000, reserveCash: 1000, expiresInSeconds: 3600, contributionAtRisk: true,
    distributionMode: 'voluntary_realized_gin_profit', noPrincipalRefund: true, noOwnerAuthority: true,
  });
  assert.equal(made.code, 200, JSON.stringify(made));
  const r = made.body.partnership, path = '/v1/company/partnerships/' + r.id;
  assert.equal((await f.call(scout, 'POST', path + '/accept', { consent: true, termsHash: r.termsHash })).code, 200);
  for (const player of [owner, scout]) {
    assert.equal((await f.call(player, 'POST', path + '/contribute', { amount: 1000, termsHash: r.termsHash })).code, 200);
  }
  for (const player of [owner, scout]) {
    assert.equal((await f.call(player, 'POST', path + '/governance/optin', { consent: true, mode: 'depot_config_two_of_two', partnershipHash: r.termsHash })).code, 200);
  }
  for (const player of [owner, scout]) {
    const opted = await f.call(player, 'POST', path + '/team/optin', {
      consent: true, partnershipHash: r.termsHash, role: player === owner ? 'operator' : 'planner', shareMemorySelection: true,
    });
    assert.equal(opted.code, 200, JSON.stringify(opted));
  }
  return r;
}
const metadataState = async () => ({
  campaigns: (await pool.query('SELECT * FROM commercial_campaigns ORDER BY id')).rows,
  roles: (await pool.query('SELECT * FROM commercial_campaign_roles ORDER BY campaign_id,role')).rows,
  stages: (await pool.query('SELECT * FROM commercial_campaign_stages ORDER BY campaign_id,kind')).rows,
  requests: (await pool.query('SELECT * FROM commercial_campaign_requests ORDER BY account_id,key_hash')).rows,
  cash: (await pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows,
  ledger: (await pool.query('SELECT * FROM transactions ORDER BY id')).rows,
});
try {
  const manufacturer = f.customer, guard = f.stranger, first = f.supplier, second = await f.create();
  const businessId = (await f.open(manufacturer)).id;
  const team = await relation(f.owner, f.partner, f.depotId);
  const otherOwner = await f.create(), otherScout = await f.create(), otherDepot = (await f.open(otherOwner)).id;
  const otherTeam = await relation(otherOwner, otherScout, otherDepot);
  const scoutTargetAt = new Date(Date.now() + 600000).toISOString();
  const body = r => ({
    partnershipId: r.id, relationshipHash: r.termsHash, teamRevision: 1, businessId,
    manufacturerAccountId: manufacturer.account, guardAccountId: guard.account,
    firstCarrierAccountId: first.account, secondCarrierAccountId: second.account,
    origin: 'foundry', handoff: 'docks', destination: 'neon', scoutFeeCash: 50, minimumStock: 1,
    scoutTargetAt, manufacturingFeeCash: 100, guardPriceCash: 10000,
    firstFeeCash: 30, secondFeeCash: 40, lifetimeSeconds: 600, consent: true,
  });
  const beforeMoney = await metadataState();
  const one = await invoke(f.owner, 'create', body(team), 'original-create');
  assert.equal(one.campaign.state, 'offered');
  assert.equal(one.campaign.executionAuthority, false);await f.single(manufacturer,(_ch,c)=>assertDepotFeatureObligations(c,businessId));
  assert.deepEqual(await invoke(f.owner, 'create', body(team), 'original-create'), one);
  const two = await invoke(otherOwner, 'create', body(otherTeam));
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM commercial_campaign_roles WHERE state='active'")).rows[0].n), 0);
  await assert.rejects(invoke(f.owner, 'create', body(team)), e => e.code === 'commercial_campaign' && e.message === 'owner_capacity');
  for (const player of [f.partner, manufacturer, guard, first, second]) await invoke(player, 'consent', ref(one));
  assert.equal((await pool.query('SELECT state FROM commercial_campaigns WHERE id=$1', [one.campaign.campaignId])).rows[0].state, 'active');const held=await inspectCommercialCampaignBusinessHistory(pool,businessId);assert.deepEqual(held.issues,[]);assert(held.activeCampaigns.includes(one.campaign.campaignId));await assert.rejects(f.single(manufacturer,(_ch,c)=>assertDepotFeatureObligations(c,businessId)),e=>e.code==='depot_acquisition_runtime'&&e.message==='commercial_campaign_obligation');
  for (const player of [otherScout, manufacturer, guard, first]) await invoke(player, 'consent', ref(two));
  const capacity = await metadataState();
  await assert.rejects(invoke(second, 'consent', ref(two)), e => e.code === 'commercial_campaign' && e.message === 'active_capacity');
  assert.deepEqual(await metadataState(), capacity, 'A genuine other active membership refuses the complete metadata change and request ACK');
  const oldConsent = await pool.query("SELECT receipt FROM commercial_campaign_requests WHERE campaign_id=$1 AND account_id=$2 AND action='consent'", [one.campaign.campaignId, guard.account]);
  const withdrawn = await invoke(guard, 'withdraw', ref(one));
  assert.equal(withdrawn.campaign.state, 'suspended');
  assert.equal(withdrawn.retiredMetadataOnly, true);
  assert.equal((await pool.query('SELECT receipt FROM commercial_campaign_requests WHERE campaign_id=$1 AND account_id=$2 AND action=$3', [one.campaign.campaignId, guard.account, 'consent'])).rows[0].receipt.campaign.sourceHash, oldConsent.rows[0].receipt.campaign.sourceHash);
  await assert.rejects(invoke(guard, 'consent', ref(one)), e => e.code === 'commercial_campaign' && e.message === 'closed');

  const beforeAck = await metadataState(), connect = pool.connect.bind(pool);
  let acknowledged = false, injected = false;
  pool.connect = async (...args) => {
    if (args.length) return connect(...args);
    const c = await connect(), query = c.query.bind(c), release = c.release.bind(c);
    c.query = async (sql, values, ...rest) => {
      const result = await query(sql, values, ...rest);
      if (typeof sql === 'string' && sql.startsWith('INSERT INTO commercial_campaign_requests') && values?.[2] === 'consent') acknowledged = true;
      if (acknowledged && !injected && typeof sql === 'string' && sql.startsWith('UPDATE account_persistent SET') && values?.[0] === second.account) {
        injected = true;
        throw Error('Actual final campaign account ACK fault');
      }
      return result;
    };
    c.release = (...args) => { c.query = query; c.release = release; return release(...args); };
    return c;
  };
  try { await assert.rejects(invoke(second, 'consent', ref(two)), /Actual final campaign account ACK fault/); }
  finally { pool.connect = connect; }
  assert(acknowledged && injected);
  assert.deepEqual(await metadataState(), beforeAck, 'Memory metadata undo follows the genuine final account ACK; not a native allocator qualification');
  const activeTwo = await invoke(second, 'consent', ref(two));
  assert.equal(activeTwo.campaign.state, 'active');
  assert.equal((await invoke(otherOwner, 'cancel', ref(two))).campaign.state, 'cancelled');
  const afterMoney = await metadataState();
  assert.deepEqual(afterMoney.cash, beforeMoney.cash);
  assert.deepEqual(afterMoney.ledger, beforeMoney.ledger, 'Campaign metadata grants no fee, reserve, reward or peer cash authority');
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM commercial_campaign_roles WHERE state='active'")).rows[0].n), 0);

  const stale = await invoke(f.owner, 'create', body(team));
  for (const player of [f.partner, manufacturer, guard, first, second]) await invoke(player, 'consent', ref(stale));
  const pending = await invoke(otherOwner, 'create', body(otherTeam));
  for (const player of [otherScout, manufacturer, guard, first]) await invoke(player, 'consent', ref(pending));
  const killer = await f.create(), oldGuard = guard.id;
  process.env.PEN_YARD_EVENT = 'quiet';
  process.env.SHANK_P = '1';
  for (const player of [killer, guard]) await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1', [player.id, new Date(Date.now() + 1800000)]);
  assert.equal((await f.call(killer, 'POST', '/v1/pen/buy/shiv')).code, 200);
  const killed = await f.call(killer, 'POST', '/v1/pen/shank/' + oldGuard);
  assert.equal(killed.code, 200, JSON.stringify(killed));
  assert.equal(killed.body.kill, true);
  assert.equal((await pool.query('SELECT state FROM commercial_campaigns WHERE id=$1', [stale.campaign.campaignId])).rows[0].state, 'suspended');
  const afterDeath = await metadataState();
  await assert.rejects(invoke(second, 'consent', ref(pending)), e => e.code === 'commercial_campaign' && e.message === 'original_changed');
  assert.deepEqual(await metadataState(), afterDeath, 'An actual provider replacement cannot activate old original terms');
  await invoke(otherOwner, 'cancel', ref(pending));
  const currentGuard = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [guard.account])).rows[0];
  assert.notEqual(currentGuard.id, oldGuard);
  const fresh = await invoke(otherOwner, 'create', body(otherTeam));
  const beforeFresh = await metadataState();
  for (const player of [otherScout, manufacturer, guard, first, second]) await invoke(player, 'consent', ref(fresh));
  const old = (await pool.query('SELECT state,closure_reason,closure_original FROM commercial_campaigns WHERE id=$1', [stale.campaign.campaignId])).rows[0];
  assert.deepEqual(old, { state: 'suspended', closure_reason: 'estate_scope', closure_original: oldGuard });
  assert.equal((await pool.query('SELECT state FROM commercial_campaigns WHERE id=$1', [fresh.campaign.campaignId])).rows[0].state, 'active');
  const afterFresh = await metadataState();
  assert.deepEqual(afterFresh.cash, beforeFresh.cash);
  assert.deepEqual(afterFresh.ledger, beforeFresh.ledger, 'The heir clears only inert indexed metadata; no old task, reserve or peer cash execution');
  await invoke(otherOwner, 'cancel', ref(fresh));
  assert.deepEqual((await inspectCommercialCampaignBusinessHistory(pool,businessId)).issues,[]);await f.single(manufacturer,(_ch,c)=>assertDepotFeatureObligations(c,businessId));
  await f.invariants();
  console.log('PASS actual consenting management-team metadata, six distinct canonical originals/business, unsigned proposal freedom, explicit active capacity, final-account-ACK undo, terminal withdrawal, genuine public provider death between signatures, original-replacement refusal, heir stale-index retirement and zero campaign cash movement. No paid stage or native source proof claimed.');
} finally { await f.close(); }
