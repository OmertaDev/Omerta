import assert from 'node:assert/strict';
import { managementFixture } from './managementteams-fixture.js';
import * as E from '../src/commercialcampaigns.js';
import {inspectCommercialCampaignBusinessHistory} from '../src/commercialcampaignruntime.js';

assert(!process.argv.includes('--postgres'), 'Metadata memory phase only; full native source campaign is separate.');
const f = await managementFixture(), pool = f.app.pool;
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
  const history=async()=>{const before=await metadataState(),seen=[];const result=await inspectCommercialCampaignBusinessHistory({query:async(sql,args)=>{assert(sql.startsWith('SELECT ')&&!/FOR UPDATE|;|--/.test(sql));seen.push(sql);return pool.query(sql,args);}},businessId);assert.deepEqual(result.issues,[]);assert.deepEqual(result.activeCampaigns,[]);assert(seen.length);assert.deepEqual(await metadataState(),before,'History reads mutate no metadata or cash');return result;};
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
  assert.equal(one.campaign.executionAuthority, false);await history();
  assert.deepEqual(await invoke(f.owner, 'create', body(team), 'original-create'), one);
  const two = await invoke(otherOwner, 'create', body(otherTeam));
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM commercial_campaign_roles WHERE state='active'")).rows[0].n), 0);
  await assert.rejects(invoke(f.owner, 'create', body(team)), e => e.code === 'commercial_campaign' && e.message === 'owner_capacity');
  for (const player of [f.partner, manufacturer, guard, first]) await invoke(player, 'consent', ref(one));
  await history();const beforeUnsupported=await metadataState();
  await assert.rejects(invoke(second,'consent',ref(one)),e=>e.code==='commercial_campaign'&&e.message==='activation_nonblocking_backend_required');
  assert.deepEqual(await metadataState(),beforeUnsupported,'Unsupported final activation refuses all request/role changes before any NOWAIT SQL');
  assert.equal((await pool.query('SELECT state FROM commercial_campaigns WHERE id=$1',[one.campaign.campaignId])).rows[0].state,'offered');
  for (const player of [otherScout,manufacturer,guard,first]) await invoke(player,'consent',ref(two));
  const pendingTwo=await metadataState();await assert.rejects(invoke(second,'consent',ref(two)),e=>e.code==='commercial_campaign'&&e.message==='activation_nonblocking_backend_required');assert.deepEqual(await metadataState(),pendingTwo,'Unsigned invitations and partial signatures cannot claim active capacity');
  const oldConsent=(await pool.query("SELECT receipt FROM commercial_campaign_requests WHERE campaign_id=$1 AND account_id=$2 AND action='consent'",[one.campaign.campaignId,guard.account])).rows[0].receipt;
  const withdrawn=await invoke(guard,'withdraw',ref(one));assert.equal(withdrawn.campaign.state,'suspended');assert.equal(withdrawn.retiredMetadataOnly,true);assert.deepEqual((await pool.query("SELECT receipt FROM commercial_campaign_requests WHERE campaign_id=$1 AND account_id=$2 AND action='consent'",[one.campaign.campaignId,guard.account])).rows[0].receipt,oldConsent);await assert.rejects(invoke(guard,'consent',ref(one)),e=>e.code==='commercial_campaign'&&e.message==='closed');
  // Partial consent still goes through the actual final Game account ACK and exact undo.
  const beforeAck=await metadataState(),connect=pool.connect.bind(pool);let acknowledged=false,injected=false;
  pool.connect=async(...args)=>{if(args.length)return connect(...args);const c=await connect(),query=c.query.bind(c),release=c.release.bind(c);c.query=async(sql,values,...rest)=>{const result=await query(sql,values,...rest);if(typeof sql==='string'&&sql.startsWith('INSERT INTO commercial_campaign_requests')&&values?.[2]==='consent')acknowledged=true;if(acknowledged&&!injected&&typeof sql==='string'&&sql.startsWith('UPDATE account_persistent SET')&&values?.[0]===second.account){injected=true;throw Error('Actual final campaign account ACK fault');}return result;};c.release=(...a)=>{c.query=query;c.release=release;return release(...a);};return c;};
  const partial=await invoke(f.owner,'create',body(team)),beforePartialFault=await metadataState();
  try{await assert.rejects(invoke(second,'consent',ref(partial)),/Actual final campaign account ACK fault/);}finally{pool.connect=connect;}assert(acknowledged&&injected);
  const afterPartialFault=await metadataState();assert.deepEqual(afterPartialFault,beforePartialFault,'Only the separate genuine create survives the later partial-consent final-account-ACK fault');
  await invoke(f.owner,'cancel',ref(partial));await invoke(otherOwner,'cancel',ref(two));await history();
  const afterMoney=await metadataState();assert.deepEqual(afterMoney.cash,beforeMoney.cash);assert.deepEqual(afterMoney.ledger,beforeMoney.ledger);assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM commercial_campaign_roles WHERE state='active'")).rows[0].n),0);
  const stale=await invoke(f.owner,'create',body(team));for(const player of[f.partner,manufacturer,guard,first])await invoke(player,'consent',ref(stale));
  const pending=await invoke(otherOwner,'create',body(otherTeam));for(const player of[otherScout,manufacturer,guard,first])await invoke(player,'consent',ref(pending));
  const killer=await f.create(),oldGuard=guard.id;process.env.PEN_YARD_EVENT='quiet';process.env.SHANK_P='1';for(const player of[killer,guard])await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1',[player.id,new Date(Date.now()+1800000)]);assert.equal((await f.call(killer,'POST','/v1/pen/buy/shiv')).code,200);const killed=await f.call(killer,'POST','/v1/pen/shank/'+oldGuard);assert.equal(killed.code,200,JSON.stringify(killed));assert.equal(killed.body.kill,true);
  await history();const afterDeath=await metadataState();await assert.rejects(invoke(second,'consent',ref(pending)),e=>e.code==='commercial_campaign'&&e.message==='original_changed');assert.deepEqual(await metadataState(),afterDeath,'An actual provider replacement cannot activate the old partial signatures');
  // Offered provider proposals were never active obligations: their original owner can retire them.
  await invoke(f.owner,'cancel',ref(stale));await invoke(otherOwner,'cancel',ref(pending));const currentGuard=(await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true',[guard.account])).rows[0];assert.notEqual(currentGuard.id,oldGuard);
  const fresh=await invoke(otherOwner,'create',body(otherTeam)),beforeFresh=await metadataState();for(const player of[otherScout,manufacturer,guard,first])await invoke(player,'consent',ref(fresh));const freshPartial=await metadataState();await assert.rejects(invoke(second,'consent',ref(fresh)),e=>e.code==='commercial_campaign'&&e.message==='activation_nonblocking_backend_required');assert.deepEqual(await metadataState(),freshPartial);const afterFresh=await metadataState();assert.deepEqual(afterFresh.cash,beforeFresh.cash);assert.deepEqual(afterFresh.ledger,beforeFresh.ledger);await invoke(otherOwner,'cancel',ref(fresh));
  await history();
  const sourceRow=(await pool.query('SELECT source_hash FROM commercial_campaigns WHERE id=$1',[one.campaign.campaignId])).rows[0];try{await pool.query('UPDATE commercial_campaigns SET source_hash=$2 WHERE id=$1',[one.campaign.campaignId,'0'.repeat(64)]);assert((await inspectCommercialCampaignBusinessHistory(pool,businessId)).issues.some(i=>i.campaignId===one.campaign.campaignId&&i.reason==='source_hash'));}finally{await pool.query('UPDATE commercial_campaigns SET source_hash=$2 WHERE id=$1',[one.campaign.campaignId,sourceRow.source_hash]);}await history();
  await f.invariants();
  console.log('PASS memory offered/partial original consent, fail-closed unsupported final activation, final-account-ACK undo, withdrawal/cancel recovery, genuine provider death and replacement refusal, zero campaign cash. Former active capacity/final activation assertions are retained in the separate strict native successor and remain unexecuted here.');
} finally { await f.close(); }
