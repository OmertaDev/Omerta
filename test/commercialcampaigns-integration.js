import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { managementFixture } from './managementteams-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
import * as E from '../src/commercialcampaigns.js';
import {inspectCommercialCampaignBusinessHistory} from '../src/commercialcampaignruntime.js';
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
const proofs = process.env.COMMERCIAL_CAMPAIGN_PROOF_DIRECTORY;
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
function faultPool(action, who, onFault, onRoot = null) {
  let acknowledged = false, injected = false, captured = false;
  const transport = new Proxy(pool, { get(target, key) {
    if (key === 'connect') return async () => {
      const c = await target.connect();
      const proxy = new Proxy(c, { get(client, name) {
        if (name === 'query') return async (...args) => {
          if (onRoot && !captured) {
            let owned = false;
            try { I.assertItemTransaction(proxy); owned = true; } catch { /* Canonical standalone clock settlement is a separate phase. */ }
            if (owned) { captured = true; await onRoot(); }
          }
          const result = await client.query(...args), sql = args[0], values = args[1];
          if (typeof sql === 'string' && sql.startsWith('INSERT INTO commercial_campaign_requests') && values?.[2] === action) acknowledged = true;
          const at = action === 'manufacture-complete'
            ? acknowledged && typeof sql === 'string' && sql.startsWith('INSERT INTO commercial_campaign_requests')
            : acknowledged && typeof sql === 'string' && sql.startsWith('UPDATE account_persistent SET') && values?.[0] === who.account;
          if (action && at && !injected) {
            injected = true;
            if (await onFault(client) !== 'continue-to-actual-finalizer') throw Error('actual-source-and-campaign-ACK-' + action);
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
async function lateFailure(a, action, campaign, who, expectedEvents) {
  let before = await snapshot(action + '-before-canonical-clock-settlement');
  let attempted;
  const fault = faultPool(action, who, async c => {
    attempted = await transactionSnapshot(c);
    save(action + '-attempted-after-actual-ACK', attempted);
  }, async () => { before = await snapshot(action + '-owned-Items-entry'); });
  await assert.rejects(invoke(who, action, ref(campaign), 'same-key-' + action, fault.transport), new RegExp('actual-source-and-campaign-ACK-' + action));
  assert(fault.witnessed());
  const after = await snapshot(action + '-after');
  assert.deepEqual(after.tables, before.tables, 'Every native table including actual source/items/cash/ACKs rolls back.');
  const count = attempted.tables.item_events.length - before.tables.item_events.length;
  assert.equal(count, expectedEvents, 'Only genuine source-generated item events were attempted.');
  for (let n = 0; n < before.sequences.length; n++) {
    const b = before.sequences[n], x = attempted.sequences[n], y = after.sequences[n];
    assert.equal(x.sequencename, b.sequencename);
    assert.deepEqual(y, x, 'Nontransactional allocators retain exactly the actually observed attempted advances.');
    if (b.sequencename === 'item_events_sequence_seq') assert.equal(BigInt(x.last_value) - BigInt(b.last_value), BigInt(count));
    else assert.deepEqual(x, b, 'No unrelated allocator advanced.');
  }
  console.log('PASS whole native rollback after genuine source + campaign ACK:', action, 'actual events:', count);
  if (action === 'courier-dispatch') {
    let reached = 0, release;
    const gate = new Promise(resolve => { release = resolve; });
    const timer = setTimeout(() => release(), 5000);
    const key = 'commercial:' + ref(campaign).campaignId + ':courier:dispatch:' + who.account;
    const barrier = new Proxy(pool, { get(target, property) {
      if (property === 'query') return async (...args) => {
        const result = await target.query(...args);
        if (args[0] === 'SELECT body_hash,receipt FROM multi_hop_courier_requests WHERE account_id=$1 AND request_key=$2'
          && args[1]?.[1] === key && result.rows.length === 0) {
          reached++; if (reached === 2) release(); await gate;
        }
        return result;
      };
      const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
    } });
    try {
      const retry = await Promise.all([invoke(who, action, ref(campaign), 'same-key-' + action, barrier),
        invoke(who, action, ref(campaign), 'same-key-' + action, barrier)]);
      assert.equal(reached, 2, 'Both genuine canonical source preflight reads must precede dispatch.');
      assert.deepEqual(retry[0], retry[1], 'Native private replay returns only the exact original campaign ACK.');
      assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM multi_hop_courier_requests WHERE account_id=$1 AND request_key=$2', [who.account, key])).rows[0].n), 1);
      console.log('PASS same-key concurrent dispatch reaches actual source replay, returns exact campaign ACK twice, one source reserve/UID deposit.');
      return retry[0];
    } finally { clearTimeout(timer); }
  }
  return invoke(who, action, ref(campaign), 'same-key-' + action);
}
// These projections tamper only this SELECT-only reader's returned immutable records.
// They never delete or rewrite canonical rows and use the real completed source ACKs.
async function historyRefusal(campaignId,businessId,mutate,label) {
  const reader={query:async(sql,args)=>{
    assert(sql.startsWith('SELECT ')&&!/\bFOR\s+(?:UPDATE|SHARE)|;|--/i.test(sql));
    const result=await pool.query(sql,args);return{...result,rows:mutate(sql,args,structuredClone(result.rows))};
  }};
  const inspected=await inspectCommercialCampaignBusinessHistory(reader,businessId);
  assert(inspected.issues.some(issue=>issue.campaignId===campaignId),label+': corrupt original history refused');
  return{label,reasons:inspected.issues.map(issue=>issue.reason)};
}
async function courierHistory(r,label) {
  const business=(await pool.query('SELECT business_id FROM commercial_campaigns WHERE id=$1',[r.campaignId])).rows[0].business_id;
  const before=await snapshot('history-'+label+'-before');
  assert.deepEqual((await inspectCommercialCampaignBusinessHistory(pool,business)).issues,[]);
  const requests=(await pool.query("SELECT * FROM commercial_campaign_requests WHERE campaign_id=$1 ORDER BY account_id,key_hash",[r.campaignId])).rows.filter(q=>q.action.startsWith('courier-'));
  assert(requests.length>0,'genuine nonempty courier lineage');const results=[];
  for(const request of requests){
    results.push(await historyRefusal(r.campaignId,business,(sql,args,rows)=>sql==='SELECT * FROM commercial_campaign_requests WHERE campaign_id=$1 ORDER BY account_id,key_hash'&&args[0]===r.campaignId?rows.filter(q=>q.account_id!==request.account_id||q.key_hash!==request.key_hash):rows,label+' missing campaign '+request.action+':'+request.account_id));
    const canonicalKey='commercial:'+r.campaignId+':courier:'+request.action.slice(8)+':'+request.account_id;
    results.push(await historyRefusal(r.campaignId,business,(sql,args,rows)=>sql==='SELECT * FROM multi_hop_courier_requests WHERE account_id=$1 AND request_key=$2'&&args[0]===request.account_id&&args[1]===canonicalKey?[]:rows,label+' missing canonical '+request.action+':'+request.account_id));
  }
  const stage=(await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='courier'",[r.campaignId])).rows[0],proof=stage.proof_json;
  const events=[];
  if(proof.reservedCash||proof.earnedFirst||proof.earnedSecond)events.push(['courier:'+stage.courier_network_id+':deposit',[0]]);
  if(proof.earnedFirst)events.push(['courier:'+stage.courier_network_id+':handoff',[0,1]]);
  if(proof.earnedSecond)events.push(['courier:'+stage.courier_network_id+':arrival',[0]]);
  for(const[key,positions]of events){
    results.push(await historyRefusal(r.campaignId,business,(sql,args,rows)=>sql==='SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence'&&args[0]===key?[]:rows,label+' missing '+key));
    for(const at of positions)for(const field of['from_owner_scope','from_owner_id','to_owner_scope','to_owner_id'])results.push(await historyRefusal(r.campaignId,business,(sql,args,rows)=>{if(sql==='SELECT * FROM item_events WHERE idempotency_key=$1 ORDER BY sequence'&&args[0]===key){assert(rows[at]);rows[at][field]='foreign';}return rows;},label+' wrong '+key+':'+at+'.'+field));
  }
  const after=await snapshot('history-'+label+'-after');assert.deepEqual(after.tables,before.tables);assert.deepEqual(after.sequences,before.sequences);save('history-'+label+'-refusals',results);
}
async function allHistorySourceDTOs(r) {
  const business=(await pool.query('SELECT business_id FROM commercial_campaigns WHERE id=$1',[r.campaignId])).rows[0].business_id;
  const before=await snapshot('history-all-source-dtos-before'),requests=(await pool.query('SELECT * FROM commercial_campaign_requests WHERE campaign_id=$1 ORDER BY account_id,key_hash',[r.campaignId])).rows.filter(q=>q.receipt.source),results=[];
  assert.deepEqual([...new Set(requests.map(q=>q.action.split('-')[0]))].sort(),['courier','guard','manufacture','scout']);
  for(const request of requests)for(const field of Object.keys(request.receipt.source)){
    results.push(await historyRefusal(r.campaignId,business,(sql,args,rows)=>{if(sql==='SELECT * FROM commercial_campaign_requests WHERE campaign_id=$1 ORDER BY account_id,key_hash'&&args[0]===r.campaignId){const saved=rows.find(q=>q.account_id===request.account_id&&q.key_hash===request.key_hash);assert(saved);const v=saved.receipt.source[field];saved.receipt.source[field]=typeof v==='number'?v+1:typeof v==='boolean'?!v:typeof v==='string'?v+'x':v===null?{}:null;}return rows;},request.action+':'+request.account_id+'.'+field));
  }
  const after=await snapshot('history-all-source-dtos-after');assert.deepEqual(after.tables,before.tables);assert.deepEqual(after.sequences,before.sequences);save('history-all-source-dto-refusals',results);
}

async function books() {
  for(const {business_id} of(await pool.query('SELECT DISTINCT business_id FROM commercial_campaigns ORDER BY business_id')).rows){const before=await canonicalDatabaseSnapshot(pool),history=await inspectCommercialCampaignBusinessHistory(pool,business_id);assert.deepEqual(history.issues,[],JSON.stringify(history));assert.deepEqual(await canonicalDatabaseSnapshot(pool),before,'Paid/terminal history is read only after canonical transfers/refunds');}
  assert.deepEqual(await Commission.collectCommissionedCraftingIssues(pool), []);
  assert.deepEqual(await Courier.collectMultiHopCourierIssues(pool), []);
  for (const row of (await pool.query('SELECT id,cash,bank FROM characters WHERE is_npc=false ORDER BY id')).rows) {
    const sum = Number((await pool.query("SELECT COALESCE(SUM(amount),0) n FROM transactions WHERE character_id=$1 AND currency='cash'", [row.id])).rows[0].n);
    assert.equal(Number(row.cash) + Number(row.bank) - 500, sum, 'Actual character books: ' + row.id);
  }
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM transactions WHERE reason LIKE 'commercial_campaign:%'")).rows[0].n), 0, 'No new money bucket or manufactured income');
}
try {
  assert.equal((await f.call(null, 'GET', '/v1/company/commercial-campaigns')).code, 401);
  assert.deepEqual((await f.call(f.stranger, 'GET', '/v1/company/commercial-campaigns')).body.campaigns, []);
  assert.equal((await f.call(f.owner, 'GET', '/v1/company/commercial-campaigns?authority=owner')).code, 400);
  const a = await actors(), campaign = await start(a), r = ref(campaign);
  await unchanged('wrong-stage-guard', transport => invoke(a.owner, 'guard-hire', r, undefined, transport));
  await unchanged('foreign-source-capability', () => tx(c => Commission.consumeCommercialCommission(c, { commissionId: 'forged' })));
  await unchanged('foreign-courier-capability', () => tx(c => Courier.consumeCommercialCourier(c, { networkId: 'forged' })));
  await unchanged('foreign-guard-capability', () => tx(c => Defense.consumeCommercialGuard(c, { guard: a.guard.id })));
  await throughManufacture(a, campaign);
  await unchanged('wrong-manufacturer-original', transport => invoke(a.scout, 'manufacture-complete', r, undefined, transport));
  const produced = await lateFailure(a, 'manufacture-complete', campaign, a.maker, 8);
  const output = produced.source.outputItemId;
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [output])).rows[0].owner_id, a.owner.account);
  await f.single(a.guard, (ch, c, h) => Defense.offerBodyguard(ch, 10001, c, h));
  await unchanged('changed-original-guard-price', transport => invoke(a.owner, 'guard-hire', r, undefined, transport));
  await f.single(a.guard, (ch, c, h) => Defense.offerBodyguard(ch, 10000, c, h));
  const coverage = await invoke(a.owner, 'guard-hire', r);
  assert.deepEqual([coverage.source.priceCash, coverage.source.paidGuardCash, coverage.source.canonicalFeeCash, coverage.source.streetTaxCash], [10000, 9800, 100, 100]);
  assert.equal(coverage.source.evidence, 'purchased_bodyguard_coverage');
  assert(!JSON.stringify(coverage).includes('intercepted'));
  const published = await invoke(a.owner, 'courier-publish', r);
  assert.equal(published.source.itemId, output);
  await courierHistory(r, 'published');
  await invoke(a.first, 'courier-consent', r);
  await unchanged('missing-second-real-courier-consent', transport => invoke(a.owner, 'courier-dispatch', r, undefined, transport));
  await invoke(a.second, 'courier-consent', r);
  await courierHistory(r, 'both-consented');
  await lateFailure(a, 'courier-dispatch', campaign, a.owner, 1);
  await courierHistory(r, 'dispatched');
  await invoke(a.first, 'courier-travel', r);
  const race = await Promise.allSettled([invoke(a.first, 'courier-handoff', r, 'handoff-race-a'), invoke(a.first, 'courier-handoff', r, 'handoff-race-b')]);
  assert.equal(race.filter(value => value.status === 'fulfilled').length, 1);
  await courierHistory(r, 'handed-off');
  await f.single(a.owner, (ch, c, h) => f.G.travel(ch, 'neon', c, h));
  await invoke(a.second, 'courier-travel', r);
  const done = await lateFailure(a, 'courier-arrive', campaign, a.second, 1);
  assert.equal(done.campaign.state, 'completed');
  await courierHistory(r, 'arrived');
  await allHistorySourceDTOs(r);
  assert.equal(done.source.itemId, output);
  assert.deepEqual([done.source.paidFirstCash, done.source.paidSecondCash], [30, 40]);
  const stages = (await pool.query('SELECT kind,state FROM commercial_campaign_stages WHERE campaign_id=$1 ORDER BY kind', [r.campaignId])).rows;
  assert.equal(stages.length, 4); assert(stages.every(stage => stage.state === 'completed'));
  assert.equal(Number((await pool.query("SELECT COUNT(*) n FROM commercial_campaign_roles WHERE campaign_id=$1 AND state='active'", [r.campaignId])).rows[0].n), 0);
  assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [output])).rows[0], { owner_scope: 'account', owner_id: a.owner.account, state: 'active' });
  await books();
  console.log('PASS actual F24 six-original consent → paid public market report → funded N03 precision manufacturing → paid canonical 2% guard coverage → two real N06 travel legs, same manufactured UID, earned30/40, original title and all4 completed stages.');

  // A real post-ACK 60-second metadata expiry uses the actual final signer and
  // actual clocks, with read-only keepalives on the same transaction client.
  const expiring = await invoke(a.owner, 'create', await body(a, 60));
  for (const who of [a.scout, a.maker, a.guard, a.first]) await invoke(who, 'consent', ref(expiring));
  let before = await snapshot('real-post-ACK-expiry-before-canonical-clock-settlement');
  const started = Date.now();
  const expiryFault = faultPool('consent', a.second, async c => {
    let remaining;
    do {
      remaining = +new Date(expiring.campaign.expiresAt) - +new Date((await c.query('SELECT clock_timestamp() AS observed')).rows[0].observed);
      if (remaining >= 0) await new Promise(resolve => setTimeout(resolve, Math.min(1000, remaining + 5)));
    } while (remaining >= 0);
    save('real-post-ACK-expiry-attempted', await transactionSnapshot(c));
    return 'continue-to-actual-finalizer';
  }, async () => { before = await snapshot('real-post-ACK-expiry-owned-Items-entry'); });
  // The fixture resumes the genuine finalizer after the wait; the actual
  // campaign clock check must reject the already acknowledged final consent.
  await assert.rejects(invoke(a.second, 'consent', ref(expiring), 'real-expiry-last-signer', expiryFault.transport), /expired_after_ack/);
  assert(expiryFault.witnessed()); assert(Date.now() - started > 45000);
  const after = await snapshot('real-post-ACK-expiry-after');
  assert.deepEqual(after.tables, before.tables); assert.deepEqual(after.sequences, before.sequences);
  await assert.rejects(invoke(a.second, 'consent', ref(expiring), 'real-expiry-last-signer'), /expired/);
  await invoke(a.owner, 'cancel', ref(expiring));
  console.log('PASS actual final signer account ACK held past actual fixed60-second expiry, full native metadata/account undo and zero attempted item allocation.');

  const b = await actors(true), retired = await start(b), q = ref(retired);
  await throughManufacture(b, retired);
  const ordinaryStage = (await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='manufacture'", [q.campaignId])).rows[0];
  const actualCommission = (await pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1', [ordinaryStage.commission_id])).rows[0];
  const independent = await tx(c => Commission.completeCommission(c, b.maker.account, { commissionId: actualCommission.id,
    sourceHash: actualCommission.source_hash, consent: true }, 'actual-independent-ordinary-completion', { agentCredential: true }));
  assert(independent.outputItemId);
  const board = await E.commercialCampaignBoard(pool, b.owner.account);
  const blocked = board.campaigns.find(row => row.campaignId === q.campaignId);
  assert.equal(blocked.blockedReason, 'canonical_source_completed_independently');
  assert.deepEqual(blocked.retireActions, ['cancel']);
  const unchangedMoney = (await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows;
  await invoke(b.owner, 'cancel', q);
  assert.deepEqual((await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows, unchangedMoney);
  assert.equal((await pool.query('SELECT status FROM commissioned_crafting_contracts WHERE id=$1', [actualCommission.id])).rows[0].status, 'completed');
  assert.equal((await pool.query("SELECT state FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='manufacture'", [q.campaignId])).rows[0].state, 'retired');
  await books();
  console.log('PASS ordinary canonical completion keeps actual cash/output, produces no fabricated campaign ACK; bounded DTO exposes blocked stage and owner metadata retirement with zero peer cash movement.');

  const estateCampaign = await start(b), er = ref(estateCampaign);
  await throughManufacture(b, estateCampaign);
  const pendingCommission = (await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='manufacture'", [er.campaignId])).rows[0];
  const completedScout = (await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='scout'", [er.campaignId])).rows[0];
  const sourceBeforeDeath = (await pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1', [pendingCommission.commission_id])).rows[0];
  const peerIds = [b.owner, b.scout, b.maker, b.first, b.second].map(who => who.id).sort();
  const peersBefore = (await pool.query('SELECT id,cash,bank FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [peerIds])).rows;
  const killer = await f.create(), deadGuard = b.guard.id;
  process.env.PEN_YARD_EVENT = 'quiet'; process.env.SHANK_P = '1';
  for (const who of [killer, b.guard]) await pool.query('UPDATE characters SET jail_until=$2 WHERE id=$1', [who.id, new Date(Date.now() + 1800000)]);
  assert.equal((await f.call(killer, 'POST', '/v1/pen/buy/shiv')).code, 200);
  const killed = await f.call(killer, 'POST', '/v1/pen/shank/' + deadGuard);
  assert.equal(killed.code, 200, JSON.stringify(killed)); assert.equal(killed.body.kill, true);
  assert.deepEqual((await pool.query('SELECT state,closure_reason,closure_original FROM commercial_campaigns WHERE id=$1', [er.campaignId])).rows[0],
    { state: 'suspended', closure_reason: 'estate_scope', closure_original: deadGuard });
  assert.deepEqual((await pool.query('SELECT id,cash,bank FROM characters WHERE id=ANY($1::text[]) ORDER BY id', [peerIds])).rows, peersBefore, 'Guard estate retires metadata without peer cash writes or added spending authority');
  assert.deepEqual((await pool.query('SELECT * FROM commissioned_crafting_contracts WHERE id=$1', [sourceBeforeDeath.id])).rows[0], sourceBeforeDeath, 'Independent accepted source remains exact and executable');
  assert.deepEqual((await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='scout'", [er.campaignId])).rows[0], completedScout, 'Completed historical stage stays immutable');
  await unchanged('dead-replaced-original-campaign-execution', transport => invoke(b.guard, 'guard-hire', er, undefined, transport));
  const returned = await tx(c => Commission.refundCommission(c, b.owner.account, { commissionId: sourceBeforeDeath.id,
    sourceHash: sourceBeforeDeath.source_hash, consent: true }, 'actual-original-refund-after-campaign-estate'));
  assert.equal(returned.refundedFee, 100);
  const replacement = (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive=true', [b.guard.account])).rows[0];
  assert.notEqual(replacement.id, deadGuard); b.guard.id = replacement.id;
  const fresh = await start(b);
  assert.equal((await pool.query('SELECT guard_character FROM commercial_campaigns WHERE id=$1', [ref(fresh).campaignId])).rows[0].guard_character, replacement.id);
  await invoke(b.owner, 'cancel', ref(fresh));
  await books();
  console.log('PASS real public original-guard estate releases only bounded metadata capacity, preserves completed history and accepted original-source obligations, writes no peer cash, refuses replaced-original execution, permits canonical original refund and fresh separately consented heir enrollment.');

  const d = await actors(true), delivery = await start(d), dr = ref(delivery);
  await throughManufacture(d, delivery);
  const manufactured = await invoke(d.maker, 'manufacture-complete', dr);
  await invoke(d.owner, 'guard-hire', dr);
  const network = await invoke(d.owner, 'courier-publish', dr);
  await invoke(d.first, 'courier-consent', dr); await invoke(d.second, 'courier-consent', dr);
  await invoke(d.owner, 'courier-dispatch', dr);
  const beforeRetirement = (await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows;
  await invoke(d.owner, 'cancel', dr);
  assert.deepEqual((await pool.query('SELECT id,cash FROM characters ORDER BY id')).rows, beforeRetirement, 'Metadata cancellation spends or refunds no source cash');
  const retiredStage = (await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='courier'", [dr.campaignId])).rows[0];
  assert.equal(retiredStage.state, 'retired');
  const canonicalTerms = { networkId: network.source.sourceId, sourceHash: network.source.sourceHash, consent: true };
  const cancelled = await Courier.multiHopCourierAction(pool, d.owner.account, 'cancel', canonicalTerms, 'ordinary-cancel-after-metadata-retired');
  assert.equal(cancelled.status, 'cancelled');
  assert.deepEqual(await Courier.multiHopCourierAction(pool, d.owner.account, 'cancel', canonicalTerms, 'ordinary-cancel-after-metadata-retired'), cancelled);
  assert.equal((await pool.query('SELECT owner_id FROM item_instances WHERE id=$1', [manufactured.source.outputItemId])).rows[0].owner_id, d.owner.account);
  const source = (await pool.query('SELECT reserved_cash,refunded_cash FROM multi_hop_couriers WHERE id=$1', [network.source.sourceId])).rows[0];
  assert.deepEqual([Number(source.reserved_cash), Number(source.refunded_cash)], [0, 70]);
  assert.deepEqual((await pool.query("SELECT * FROM commercial_campaign_stages WHERE campaign_id=$1 AND kind='courier'", [dr.campaignId])).rows[0], retiredStage, 'Ordinary source recovery leaves terminal campaign history exact');
  await unchanged('old-ordinary-source-cannot-relabel', transport => invoke(d.second, 'courier-arrive', dr, undefined, transport));
  await books();
  console.log('PASS independent original N06 API remains executable after metadata cancellation: original UID returned, exact unearned70 refunded once, canonical replay exact and terminal campaign history unchanged.');
  save('final-state', await canonicalDatabaseSnapshot(pool));
  console.log('PASS N20 bounded actual native composition; no financial activation, external payment, real compute or attack evidence.');
} finally { await f.close(); }
