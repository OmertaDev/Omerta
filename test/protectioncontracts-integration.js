import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { managementFixture } from './managementteams-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
import * as E from '../src/commercialcampaigns.js';
import * as P from '../src/protectioncontracts.js';
import * as I from '../src/items.js';
import * as Commission from '../src/commissionedcrafting.js';
import * as Courier from '../src/multihopcourier.js';
import * as Defense from '../src/social/defense.js';
import * as Skills from '../src/skills.js';
import { INTEL_FORECAST } from '../src/intelforecasts.js';

assert(process.argv.includes('--postgres'), 'Actual paid composition is native-only.');
Object.assign(process.env, { LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City',
  PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test',
  DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true',
  PAYMENT_REFUND_POLICY: 'Explicit isolated native fixture policy; not a production policy.' });
const f = await managementFixture(), pool = f.app.pool;
assert.equal(f.native, true);
assert.equal(await E.commercialCampaignReady(), true, 'Complete literal source proposals required; no source aliases.');
const proofs = process.env.PROTECTION_CONTRACT_PROOF_DIRECTORY;
assert(proofs && path.isAbsolute(proofs), 'Explicit owned native proof directory required.');
fs.mkdirSync(proofs, { recursive: true });
let serial = 0;
const tx = fn => I.withItemTransaction(pool, fn);
const ref = result => ({ campaignId: result.campaign.campaignId, sourceHash: result.campaign.sourceHash, consent: true });
const invoke = async (who, action, body, key = 'commercial-native-' + (++serial), transport = pool) => {
  if (transport !== pool) return E.commercialCampaignAction(transport, who.account, action, body, key, { agentCredential: true });
  const result = await f.call(who, 'POST', '/v1/company/commercial-campaigns/' + action, body, key, true);
  if (result.code !== 200) throw Error(JSON.stringify(result));
  return result.body;
};
const save = (name, value) => fs.writeFileSync(path.join(proofs, name + '.json'), JSON.stringify(value, null, 2) + '\n');
const snapshot = async label => { const value = await canonicalDatabaseSnapshot(pool); save(label, value); return value; };
async function transactionSnapshot(c) {
  const schema = (await c.query('SELECT current_schema() AS schema')).rows[0].schema;
  assert.equal(schema, 'public');
  const names = (await c.query("SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename")).rows;
  const tables = {};
  for (const { tablename } of names) {
    assert.match(tablename, /^[a-z_][a-z_0-9]*$/);
    tables[tablename] = (await c.query('SELECT row_to_json(t)::text AS value FROM "public"."' + tablename + '" AS t')).rows.map(row => row.value).sort();
  }
  return { schema, tables, sequences: (await c.query("SELECT sequencename,last_value FROM pg_sequences WHERE schemaname='public' ORDER BY sequencename")).rows };
}
async function unchanged(label, fn) {
  let before = await snapshot(label + '-before-canonical-clock-settlement');
  const instrument = faultPool(null, null, null, async () => { before = await snapshot(label + '-owned-Items-entry'); });
  await assert.rejects(() => fn(instrument.transport));
  const after = await snapshot(label + '-after');
  assert.deepEqual(after.tables, before.tables, label + ': every native row restored');
  assert.deepEqual(after.sequences, before.sequences, label + ': no attempted allocator');
}
async function relation(owner, scout, depotId) {
  const made = await f.call(owner, 'POST', '/v1/company/partnerships', {
    depotId, partnerCharacter: scout.id, ownerCapital: 1000, partnerCapital: 1000, partnerBps: 3333,
    maxDistributionCash: 1000, reserveCash: 1000, expiresInSeconds: 3600, contributionAtRisk: true,
    distributionMode: 'voluntary_realized_gin_profit', noPrincipalRefund: true, noOwnerAuthority: true,
  });
  assert.equal(made.code, 200, JSON.stringify(made));
  const r = made.body.partnership, url = '/v1/company/partnerships/' + r.id;
  assert.equal((await f.call(scout, 'POST', url + '/accept', { consent: true, termsHash: r.termsHash })).code, 200);
  for (const who of [owner, scout]) assert.equal((await f.call(who, 'POST', url + '/contribute', { amount: 1000, termsHash: r.termsHash })).code, 200);
  for (const who of [owner, scout]) assert.equal((await f.call(who, 'POST', url + '/governance/optin', { consent: true, mode: 'depot_config_two_of_two', partnershipHash: r.termsHash })).code, 200);
  for (const who of [owner, scout]) assert.equal((await f.call(who, 'POST', url + '/team/optin', {
    consent: true, partnershipHash: r.termsHash, role: who === owner ? 'operator' : 'planner', shareMemorySelection: true,
  })).code, 200);
  return r;
}
async function actors(fresh = false) {
  const owner = fresh ? await f.create() : f.owner, scout = fresh ? await f.create() : f.partner;
  const maker = fresh ? await f.create() : f.customer, guard = fresh ? await f.create() : f.stranger;
  const first = fresh ? await f.create() : f.supplier, second = await f.create();
  const depotId = fresh ? (await f.open(owner)).id : f.depotId, businessId = (await f.open(maker)).id;
  for (const who of [owner, scout, maker, guard, first, second]) {
    // Explicit fixture level only. Skills, travel, prices, source payments and
    // produced output are subsequently the genuine canonical game operations.
    await pool.query('UPDATE characters SET respect=10000 WHERE id=$1', [who.id]);
    for (const skill of ['fast_talker', 'fence_network']) await f.single(who, (ch, c, h) => Skills.learnSkill(ch, skill, c, h));
    await f.single(who, (ch, c, h) => f.G.travel(ch, 'foundry', c, h));
  }
  await f.single(second, (ch, c, h) => f.G.travel(ch, 'docks', c, h));
  await f.single(guard, (ch, c, h) => Defense.offerBodyguard(ch, 10000, c, h));
  await tx(async c => {
    await I.grantStack(c, { scope: 'account', id: owner.account }, 'mat:hardened_steel', 4, 'standard', 'explicit native campaign fixture owned input', 'commercial-fixture-steel-' + owner.id);
    await I.grantStack(c, { scope: 'account', id: owner.account }, 'mat:salvage_parts', 8, 'standard', 'explicit native campaign fixture owned input', 'commercial-fixture-parts-' + owner.id);
  });
  return { owner, scout, maker, guard, first, second, businessId, relationship: await relation(owner, scout, depotId) };
}
async function body(a, lifetimeSeconds = 600) {
  const observed = +new Date((await pool.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
  const lead = INTEL_FORECAST.minLeadMs + 30000;
  assert(Math.floor(observed / INTEL_FORECAST.blockMs) === Math.floor((observed + lead) / INTEL_FORECAST.blockMs), 'Actual forecast intake requires one genuine price block.');
  return { partnershipId: a.relationship.id, relationshipHash: a.relationship.termsHash, teamRevision: 1,
    businessId: a.businessId, manufacturerAccountId: a.maker.account, guardAccountId: a.guard.account,
    firstCarrierAccountId: a.first.account, secondCarrierAccountId: a.second.account,
    origin: 'foundry', handoff: 'docks', destination: 'neon', scoutFeeCash: 50, minimumStock: 1,
    scoutTargetAt: new Date(observed + lead).toISOString(), manufacturingFeeCash: 100,
    guardPriceCash: 10000, firstFeeCash: 30, secondFeeCash: 40, lifetimeSeconds, consent: true };
}
async function start(a, lifetimeSeconds = 600) {
  const proposal = await invoke(a.owner, 'create', await body(a, lifetimeSeconds));
  for (const who of [a.scout, a.maker, a.guard, a.first, a.second]) await invoke(who, 'consent', ref(proposal));
  return proposal;
}
async function throughManufacture(a, campaign) {
  const r = ref(campaign);
  await invoke(a.owner, 'scout-fund', r);
  const report = await invoke(a.scout, 'scout-report', { ...r, predictsAvailable: true });
  assert.equal(report.source.paidFeeCash, 50);
  assert(Number.isSafeInteger(report.source.observedStock));
  await invoke(a.owner, 'manufacture-fund', r);
  await invoke(a.maker, 'manufacture-accept', r);
}
const pref = result => ({ contractId: result.contract.contractId, sourceHash: result.contract.sourceHash, consent: true });
const fundTerms = (campaign, seconds = 600) => ({ campaignId: campaign.campaign.campaignId,
  campaignSourceHash: campaign.campaign.sourceHash, priceCash: 10000, lifetimeSeconds: seconds,
  service: 'canonical_nonexclusive_single_save', consent: true });
async function protection(who, action, body, key = 'protection-native-' + (++serial), transport = pool, agent = true) {
  if (transport !== pool) return P.protectionContractAction(transport, who.account, action, body, key);
  const result = await f.call(who, 'POST', '/v1/company/protection-contracts/' + action, body, key, agent);
  if (result.code !== 200) throw Error(JSON.stringify(result));
  return result.body;
}
async function ready(fresh = false) {
  const a = await actors(fresh), campaign = await start(a), r = ref(campaign);
  await throughManufacture(a, campaign);
  await invoke(a.maker, 'manufacture-complete', r);
  await invoke(a.owner, 'guard-hire', r);
  const published = await invoke(a.owner, 'courier-publish', r);
  await invoke(a.first, 'courier-consent', r); await invoke(a.second, 'courier-consent', r);
  await invoke(a.owner, 'courier-dispatch', r);
  return { ...a, campaign, campaignRef: r, network: published.source.sourceId };
}
function faultPool(action, who, onFault, onRoot = null, stage = 'account') {
  let acknowledged = false, injected = false, captured = false;
  const transport = new Proxy(pool, { get(target, key) {
    if (key === 'connect') return async () => {
      const c = await target.connect();
      const proxy = new Proxy(c, { get(client, name) {
        if (name === 'query') return async (...args) => {
          if (onRoot && !captured) {
            let owned = false;
            try { I.assertItemTransaction(proxy); owned = true; } catch { /* Independent canonical clock settlement precedes the owned action. */ }
            if (owned) { captured = true; await onRoot(); }
          }
          const result = await client.query(...args), sql = args[0], values = args[1];
          const sourceACK = typeof sql === 'string' && sql.startsWith('INSERT INTO protection_contract_requests') && values?.[2] === action;
          if (sourceACK) acknowledged = true;
          const at = stage === 'source' ? sourceACK
            : acknowledged && typeof sql === 'string' && sql.startsWith('UPDATE account_persistent SET') && values?.[0] === who.account;
          if (action && at && !injected) {
            injected = true;
            if (await onFault(client) !== 'continue-to-actual-finalizer') throw Error('actual-protection-ACK-' + action);
          }
          return result;
        };
        const value = client[name]; return typeof value === 'function' ? value.bind(client) : value;
      } });
      return proxy;
    };
    const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
  } });
  return { transport, witnessed: () => injected };
}
async function lateFailure(label, who, action, body, finalActor = who, stage = 'account', onFault = null) {
  let before = await snapshot(label + '-before-clock'), attempted;
  const fault = faultPool(action, finalActor, async c => {
    if (onFault) await onFault(c);
    attempted = await transactionSnapshot(c); save(label + '-actual-attempt', attempted);
    if (onFault) return 'continue-to-actual-finalizer';
  }, async () => { before = await snapshot(label + '-owned-Items-entry'); }, stage);
  await assert.rejects(protection(who, action, body, label, fault.transport));
  assert(fault.witnessed(), label + ': actual source ACK and selected original final account ACK reached');
  const after = await snapshot(label + '-after');
  assert.deepEqual(after.tables, before.tables, label + ': every actual native table restored, including accounts, source journals, reserve and source receipt');
  assert.deepEqual(after.sequences, attempted.sequences, label + ': only actually attempted nontransactional allocator advances remain');
  assert.deepEqual(attempted.sequences, before.sequences, label + ': this composition never allocates an item or unrelated sequence');
  console.log('PASS actual source/final ACK whole native rollback:', label);
}
async function books() {
  assert.deepEqual(await Commission.collectCommissionedCraftingIssues(pool), []);
  assert.deepEqual(await Courier.collectMultiHopCourierIssues(pool), []);
  for (const row of (await pool.query('SELECT id,cash,bank,alive FROM characters WHERE is_npc=false ORDER BY id')).rows) {
    const sum = Number((await pool.query("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE character_id=$1 AND currency='cash'", [row.id])).rows[0].n);
    assert.equal(Number(row.cash) + Number(row.bank) - 500, sum, 'Actual original/dead character books: ' + row.id);
  }
  for (const row of (await pool.query('SELECT * FROM protection_contracts ORDER BY id')).rows) {
    assert.equal(Number(row.remaining_cash) + Number(row.paid_cash) + Number(row.refunded_cash), Number(row.price_cash));
    const journals = (await pool.query("SELECT * FROM transactions WHERE counterparty=$1 AND reason LIKE 'protection:%' ORDER BY id", [row.id])).rows;
    assert.equal(journals.length, row.state === 'activated' || ['refunded', 'expired'].includes(row.state) ? 2 : 1);
    assert.equal(journals.reduce((sum, value) => sum + Number(value.amount), 0), Number(row.remaining_cash) === 0 ? 0 : -Number(row.remaining_cash));
    assert(journals.every(value => value.character_id === row.payer_character && value.currency === 'cash'));
  }
}
async function publicKill(who, label, fail = false) {
  const killer = await f.create();
  process.env.PEN_YARD_EVENT = 'quiet'; process.env.SHANK_P = '1';
  for (const player of [killer, who]) await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1', [player.id, new Date(Date.now() + 1800000)]);
  assert.equal((await f.call(killer, 'POST', '/v1/pen/buy/shiv')).code, 200);
  if (fail) {
    let before = await snapshot(label + '-before-clock'), attempted, reached = false;
    const fault = faultPool(null, null, null, async () => { before = await snapshot(label + '-owned-Items-entry'); });
    const transport = new Proxy(fault.transport, { get(target, key) {
      if (key === 'connect') return async () => {
        const c = await target.connect(); return new Proxy(c, { get(client, name) {
          if (name === 'query') return async (...args) => {
            const value = await client.query(...args);
            if (!reached && typeof args[0] === 'string' && args[0].startsWith('UPDATE account_persistent SET') && args[1]?.[0] === who.account) {
              reached = true; attempted = await transactionSnapshot(client); save(label + '-attempted', attempted);
              throw Error('actual-public-estate-final-ACK');
            }
            return value;
          };
          const value = client[name]; return typeof value === 'function' ? value.bind(client) : value;
        } });
      };
      const value = target[key]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    await assert.rejects(() => f.G.withTwoCharacters(transport, killer.account, who.id,
      async (ch, victim, c, h) => (await import('../src/pen.js')).shank(ch, victim, c, h), { requireKnown: false }));
    assert(reached); const after = await snapshot(label + '-after');
    assert.deepEqual(after.tables, before.tables); assert.deepEqual(after.sequences, attempted.sequences);
    console.log('PASS actual public-source estate whole undo after original final account ACK:', label);
  }
  const killed = await f.call(killer, 'POST', '/v1/pen/shank/' + who.id);
  assert.equal(killed.code, 200, JSON.stringify(killed)); assert.equal(killed.body.kill, true);
  return killed;
}
try {
  assert.equal(await P.protectionContractReady(), true, 'Literal fixed Game/source proposals required, no aliases');
  assert.equal((await f.call(null, 'GET', '/v1/company/protection-contracts')).code, 401);
  assert.deepEqual((await f.call(f.owner, 'GET', '/v1/company/protection-contracts')).body.contracts, []);
  assert.equal((await f.call(f.owner, 'GET', '/v1/company/protection-contracts?authority=guard')).code, 400);
  const a = await ready(), b = fundTerms(a.campaign);
  await unchanged('wrong-current-carrier', t => protection(a.second, 'fund', b, undefined, t));
  await unchanged('caller-cannot-create-fresh-guard-proof', () => tx(c => Defense.consumeProtectionGuard(c, { guard: a.guard.id, price: 10000 })));
  await lateFailure('fund-source-ACK', a.first, 'fund', b, a.first, 'source');
  await lateFailure('fund-final-payer-ACK', a.first, 'fund', b);
  await f.single(a.guard, (ch, c, h) => f.G.travel(ch, 'docks', c, h));
  const contactsBefore = (await pool.query('SELECT * FROM contacts WHERE owner_account=$1 AND contact_account=$2', [a.first.account, a.guard.account])).rows;
  assert.equal(contactsBefore.length, 0);
  const pending = await protection(a.first, 'fund', b, 'human-agent-shared-key', pool, false), p = pref(pending);
  assert.deepEqual(await protection(a.first, 'fund', b, 'human-agent-shared-key', pool, true), pending, 'Human and agent credentials share exact original idempotency semantics');
  await unchanged('changed-same-request-body', t => protection(a.first, 'fund', { ...b, lifetimeSeconds: 601 }, 'human-agent-shared-key', t));
  await unchanged('one-outstanding-original-payer', t => protection(a.first, 'fund', b, undefined, t));
  await unchanged('unsigned-offer-no-derived-guard-target', t => protection(a.first, 'activate', p, undefined, t));
  await lateFailure('accept-source-ACK', a.guard, 'accept', p, a.guard, 'source');
  await lateFailure('accept-final-guard-ACK', a.guard, 'accept', p);
  await protection(a.guard, 'accept', p);
  assert.deepEqual((await pool.query('SELECT * FROM contacts WHERE owner_account=$1 AND contact_account=$2', [a.first.account, a.guard.account])).rows, contactsBefore, 'Solo funding and acceptance fabricate no contact');
  await unchanged('remote-unknown-still-refused-by-real-Game', t => protection(a.first, 'activate', p, undefined, t));
  await f.single(a.guard, (ch, c, h) => f.G.travel(ch, 'foundry', c, h));
  await f.single(a.guard, (ch, c, h) => Defense.offerBodyguard(ch, 10001, c, h));
  await unchanged('changed-real-guard-price', t => protection(a.first, 'activate', p, undefined, t));
  await protection(a.first, 'refund', p);
  await f.single(a.guard, (ch, c, h) => Defense.offerBodyguard(ch, 10000, c, h));
  const withdrawn = await protection(a.first, 'fund', b), w = pref(withdrawn);
  await protection(a.guard, 'accept', w);
  const beforeWithdrawal = (await pool.query('SELECT id,cash,bank FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [[a.first.id, a.guard.id]])).rows;
  await protection(a.guard, 'withdraw', w);
  assert.deepEqual((await pool.query('SELECT id,cash,bank FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [[a.first.id, a.guard.id]])).rows, beforeWithdrawal, 'Guard withdrawal changes only metadata, no payer or guard cash');
  await unchanged('withdrawn-source-cannot-spend', t => protection(a.first, 'activate', w, undefined, t));
  await unchanged('withdrawn-consent-cannot-reactivate', t => protection(a.guard, 'accept', w, undefined, t));
  await lateFailure('refund-source-ACK', a.first, 'refund', w, a.first, 'source');
  await lateFailure('refund-final-payer-ACK', a.first, 'refund', w);
  await protection(a.first, 'refund', w);
  console.log('PASS genuine funded carrier, unchanged known-player/quote gates, original consent, metadata-only withdrawal, no unsigned target, strict caps, both credential kinds and own reserve recovery.');

  const expiring = await protection(a.first, 'fund', fundTerms(a.campaign, 60)), x = pref(expiring);
  await protection(a.guard, 'accept', x);
  await lateFailure('activate-source-ACK', a.first, 'activate', x, a.first, 'source');
  await lateFailure('activate-final-payer-ACK', a.first, 'activate', x, a.first);
  await lateFailure('activate-final-guard-ACK', a.first, 'activate', x, a.guard);
  await lateFailure('forged-actual-source-journal-finalizer', a.first, 'activate', x, a.guard, 'account', async c => {
    const row = (await c.query('SELECT guard_payee_journal FROM protection_contracts WHERE id=$1', [x.contractId])).rows[0];
    await c.query('UPDATE transactions SET amount=amount+1 WHERE id=$1', [row.guard_payee_journal]);
  });
  const began = Date.now();
  await lateFailure('actual-post-source-and-final-ACK-clock-expiry', a.first, 'activate', x, a.guard, 'account', async c => {
    for (;;) {
      const left = +new Date(expiring.contract.expiresAt) - +new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
      if (left < 0) break;
      await new Promise(resolve => setTimeout(resolve, Math.min(1000, left + 5)));
    }
    save('actual-post-source-expired-clock', { startedAt: began, finishedAt: Date.now(), actualDeadline: expiring.contract.expiresAt });
  });
  await unchanged('expired-actual-source-cannot-spend', t => protection(a.first, 'activate', x, undefined, t));
  await protection(a.first, 'expire', x);
  console.log('PASS real clock crossed after genuine bodyguard journals, source ACK and original final account ACK; whole reserve, actual coverage, both actors, tax, notifications and ACKs restored, no item allocation.');

  const funded = await protection(a.first, 'fund', b), r = pref(funded);
  await protection(a.guard, 'accept', r);
  const payerBefore = await f.cash(a.first), guardBefore = await f.cash(a.guard), taxBefore = Number((await pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool);
  const races = await Promise.allSettled([protection(a.first, 'activate', r, 'same-activation'), protection(a.first, 'activate', r, 'same-activation')]);
  assert(races.some(value => value.status === 'fulfilled'));
  const actual = races.find(value => value.status === 'fulfilled').value;
  for (const value of races.filter(value => value.status === 'fulfilled')) assert.deepEqual(value.value, actual);
  assert.deepEqual(await protection(a.first, 'activate', r, 'same-activation'), actual);
  assert.deepEqual([actual.contract.reservedCash, actual.contract.paidCash, actual.contract.evidence], [0, 10000, 'purchased_bodyguard_coverage']);
  assert.equal(await f.cash(a.first), payerBefore, 'Only own previously reserved price is released and immediately spent');
  assert.equal(await f.cash(a.guard) - guardBefore, 9800); assert.equal(Number((await pool.query('SELECT pool FROM street_tax WHERE id=1')).rows[0].pool) - taxBefore, 100);
  const payer = (await pool.query('SELECT guarded_by,guarded_until FROM characters WHERE id=$1', [a.first.id])).rows[0];
  assert.equal(payer.guarded_by, a.guard.id); assert.equal(new Date(payer.guarded_until).toISOString(), actual.contract.coverageUntil);
  await unchanged('cannot-reuse-paid-reservation', t => protection(a.first, 'activate', r, undefined, t));
  const priorLeg = await protection(a.first, 'fund', b), lr = pref(priorLeg);
  await protection(a.guard, 'accept', lr);
  await invoke(a.first, 'courier-travel', a.campaignRef);
  await invoke(a.first, 'courier-handoff', a.campaignRef);
  const legBoard = await P.protectionContractBoard(pool, a.first.account);
  assert.equal(legBoard.contracts.find(row => row.contractId === lr.contractId).blockedReason, 'multi_hop_courier:protection_carrier');
  await unchanged('completed-original-leg-cannot-spend', t => protection(a.first, 'activate', lr, undefined, t));
  await protection(a.first, 'refund', lr);
  const stale = await protection(a.second, 'fund', b), sr = pref(stale);
  await protection(a.guard, 'accept', sr);
  await invoke(a.owner, 'cancel', a.campaignRef);
  await unchanged('retired-campaign-cannot-spend', t => protection(a.second, 'activate', sr, undefined, t));
  await protection(a.second, 'refund', sr);
  console.log('PASS actual canonical coverage price10000/net9800/fee100/tax100, native concurrent/replay purchase once, unchanged real courier travel/handoff, second genuine leg eligibility and retirement refusal with direct original refund.');

  const g = await ready(true), gf = await protection(g.first, 'fund', fundTerms(g.campaign)), gr = pref(gf);
  await protection(g.guard, 'accept', gr);
  const guardPeers = [g.owner, g.scout, g.maker, g.first, g.second].map(who => who.id).sort();
  const peerCash = (await pool.query('SELECT id,cash,bank FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [guardPeers])).rows;
  await publicKill(g.guard, 'actual-guard-estate', true);
  assert.deepEqual((await pool.query('SELECT id,cash,bank FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [guardPeers])).rows, peerCash, 'Guard estate does not touch any peer cash');
  assert.deepEqual((await pool.query('SELECT state,remaining_cash,closure_reason FROM protection_contracts WHERE id=$1', [gr.contractId])).rows[0], { state: 'blocked', remaining_cash: 10000, closure_reason: 'guard_death' });
  await unchanged('dead-replaced-guard-cannot-spend', t => protection(g.first, 'activate', gr, undefined, t));
  await protection(g.first, 'refund', gr);
  console.log('PASS real public guard death blocks only one accepted metadata slot, whole estate final-ACK undo and unchanged peers; original payer independently recovers own unused reserve.');

  const d = await ready(true), df = await protection(d.first, 'fund', fundTerms(d.campaign)), dr = pref(df);
  await protection(d.guard, 'accept', dr);
  const originalCash = await f.cash(d.first);
  await publicKill(d.first, 'actual-payer-estate', true);
  const dead = (await pool.query('SELECT alive,cash,bank FROM characters WHERE id=$1', [d.first.id])).rows[0];
  assert.equal(dead.alive, false); assert.equal(Number(dead.cash) + Number(dead.bank), 0);
  const recovery = (await pool.query("SELECT * FROM transactions WHERE character_id=$1 AND counterparty=$2 AND reason='protection:refund'", [d.first.id, dr.contractId])).rows;
  assert.equal(recovery.length, 1); assert.equal(Number(recovery[0].amount), 10000);
  const death = (await pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND currency='cash' AND reason='death:estate'", [d.first.id])).rows;
  assert.equal(death.length, 1); assert.equal(Number(death[0].amount), -originalCash - 10000, 'Only own unused reserve joins actual original estate disposition');
  assert.deepEqual((await pool.query('SELECT state,remaining_cash,refunded_cash,closure_reason FROM protection_contracts WHERE id=$1', [dr.contractId])).rows[0], { state: 'refunded', remaining_cash: 0, refunded_cash: 10000, closure_reason: 'payer_estate' });
  await unchanged('heir-cannot-replay-original-refund', t => protection(d.first, 'refund', dr, undefined, t));
  await books();
  save('final-state', await canonicalDatabaseSnapshot(pool));
  console.log('PASS N28 native actual original-only payer estate, canonical courier recovery, exact game-cash accounting, no extra actor arity/spending authority and financial activation OFF.');
} finally { await f.close(); }
