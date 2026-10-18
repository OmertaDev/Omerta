import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { managementFixture } from './managementteams-fixture.js';
import { canonicalDatabaseSnapshot } from '../tools/rc1-native-proof.js';
import * as E from '../src/commercialcampaigns.js';
import * as P from '../src/protectioncontracts.js';
import * as I from '../src/items.js';
import * as Courier from '../src/multihopcourier.js';
import * as Defense from '../src/social/defense.js';
import * as Skills from '../src/skills.js';
import { INTEL_FORECAST } from '../src/intelforecasts.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { PROTECTION_CONTRACT_OPERATIONS, PROTECTION_CONTRACT_SCHEMAS } from '../src/protectioncontracts-contracts.js';

assert(process.argv.slice(2).every(value => value === '--postgres'), 'Only the original native selector is supported.');
const native = process.argv.includes('--postgres');
Object.assign(process.env, { CHAIN_ENABLED: 'off', RESOURCE_ECONOMY: 'off',
  LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City',
  PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent', DMCA_AGENT_EMAIL: 'copyright@example.test',
  DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City', DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true',
  PAYMENT_REFUND_POLICY: 'Explicit isolated native fixture policy; not a production policy.' });
const ajv = new Ajv({ allErrors: true, strict: false }); addFormats(ajv);
for (const [name, schema] of Object.entries(PROTECTION_CONTRACT_SCHEMAS)) ajv.addSchema(schema, '#/components/schemas/' + name);
const validateReceipt = ajv.compile({ $ref: '#/components/schemas/ProtectionContractReceipt' });
const validateBoard = ajv.compile({ $ref: '#/components/schemas/ProtectionContractBoard' });
const validateFund = ajv.compile(PROTECTION_CONTRACT_SCHEMAS.ProtectionContractFundBody);
const validateReference = ajv.compile(PROTECTION_CONTRACT_SCHEMAS.ProtectionContractReferenceBody);
const f = await managementFixture(), pool = f.app.pool;
let serial = 0;
const tx = fn => I.withItemTransaction(pool, fn);
const ref = result => ({ campaignId: result.campaign.campaignId, sourceHash: result.campaign.sourceHash, consent: true });
const invoke = async (who, action, body, key = 'provenance-campaign-' + (++serial)) => {
  const result = await f.call(who, 'POST', '/v1/company/commercial-campaigns/' + action, body, key, true);
  assert.equal(result.code, 200, JSON.stringify(result)); return result.body;
};
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

let proofs = null, completed = false;
const save = (name, value) => { if (proofs) fs.writeFileSync(path.join(proofs, name + '.json'), JSON.stringify(value, null, 2) + '\n'); };
const history = result => P.inspectProtectionContractHistory(pool, result.contract.contractId, result.contract.sourceHash);
const uidHistory = result => P.inspectProtectionContractUidReference(pool, result.contract.contractId, result.contract.sourceHash, result.contract.itemId);
function noAuthority(value, signed = false) {
  assert.equal(value.executionAuthority, false); assert.equal(value.gameCashOnly, true);
  assert.equal(value.itemHold, false); assert.equal(value.signedGuardMembership, signed);
}
function response(receipt) {
  assert.equal(validateReceipt(receipt), true, JSON.stringify(validateReceipt.errors));
  assert.equal(validateReceipt({ ...receipt, authority: true }), false);
  assert.equal(validateReceipt({ ...receipt, contract: { ...receipt.contract, coverageProof: {} } }), false);
  assert.equal(validateReceipt({ ...receipt, contract: { ...receipt.contract, executionAuthority: true } }), false);
  return receipt;
}
function sameSnapshot(before, after) {
  for (const value of [before, after]) assert(value.capturedAt instanceof Date && Number.isFinite(+value.capturedAt));
  const { capturedAt: beforeObserved, ...beforeState } = before;
  const { capturedAt: afterObserved, ...afterState } = after;
  assert.deepEqual(afterState, beforeState, 'Only observer capturedAt may differ; every persisted field/sequence remains exact.');
}
async function rolledBackHistory(label, result, mutate, shouldRefuse = true) {
  const before = await canonicalDatabaseSnapshot(pool); save(label + '-before', before);
  const rollback = new Error('original-fixture-provenance-rollback');
  let observed = false;
  await assert.rejects(tx(async c => {
    await mutate(c);
    const read = () => P.inspectProtectionContractHistory(c, result.contract.contractId, result.contract.sourceHash);
    if (shouldRefuse) await assert.rejects(read, error => error.code === 'protection_contract');
    else noAuthority(await read());
    observed = true; throw rollback;
  }), error => error === rollback);
  assert.equal(observed, true); const after = await canonicalDatabaseSnapshot(pool); save(label + '-after', after);
  sameSnapshot(before, after); save(label + '-result', { originalOracleObserved: true, typedRefusal: shouldRefuse,
    canonicalRowsAndSequencesRestored: true, source: 'actual current native fixture; no model', auxiliaryBalanceCommitmentClaim: false });
}
async function accounting(expectedReserve, expectedCount) {
  const books = await P.protectionContractAccounting(pool);
  assert.deepEqual(books.issues, []); assert.equal(books.reservedCash, expectedReserve);
  assert.equal(books.contractCount, expectedCount); assert.equal(books.executionAuthority, false);
  const ledger = await runLedgerInvariants(pool, { alert: false });
  const checks = ledger.checks.filter(check => check.name.startsWith('protection contracts '));
  assert.equal(checks.length, 2, 'Both actual production invariant hooks are required.');
  assert.deepEqual(checks.filter(check => !check.ok), []);
  assert.equal(ledger.checks.find(check => check.name === 'reason vocabulary')?.ok, true);
  return books;
}
async function rolledBackJournalCensus(label, row, counterparty, orphan) {
  const before = await canonicalDatabaseSnapshot(pool); save(label + '-before', before);
  const rollback = new Error('original-fixture-global-journal-rollback'); let observed = false;
  await assert.rejects(tx(async c => {
    // Deliberate native test corruption, not a player action or spending grant.
    const reserve = await f.G.ledger(c, { characterId: row.payer_character, currency: 'cash', amount: -10000,
      reason: 'protection:reserve', counterparty });
    const refund = await f.G.ledger(c, { characterId: row.payer_character, currency: 'cash', amount: 10000,
      reason: 'protection:refund', counterparty });
    assert.notEqual(reserve, refund);
    const pair = (await c.query('SELECT id,character_id,account_id,currency,amount,reason,counterparty FROM transactions WHERE id=$1 OR id=$2 ORDER BY id', [reserve, refund])).rows;
    assert.equal(pair.length, 2); assert.equal(pair.reduce((sum, entry) => sum + Number(entry.amount), 0), 0);
    for (const entry of pair) { assert.equal(entry.character_id, row.payer_character); assert.equal(entry.account_id, null); assert.equal(entry.counterparty, counterparty); }
    const book = await P.protectionContractAccounting(c);
    assert.equal(book.reservedCash, 0); assert.equal(book.issues.filter(issue => issue.reason === 'history_unreferenced_journal').length, 2);
    assert.equal(book.issues.filter(issue => issue.reason === 'history_orphan_journal').length, orphan ? 2 : 0);
    if (!orphan) assert(book.issues.some(issue => issue.contractId === row.id && issue.reason === 'funding_source'));
    save(label + '-observed', { pair, book, testOnlyCorruption: true, arbitraryPlayerJournalWriteAuthorityClaim: false });
    observed = true; throw rollback;
  }), error => error === rollback);
  assert.equal(observed, true); const after = await canonicalDatabaseSnapshot(pool); save(label + '-after', after);
  sameSnapshot(before, after);
}
try {
  assert.equal(f.native, native);
  for (const name of ['inspectProtectionContractHistory', 'inspectProtectionContractUidReference', 'protectionContractAccounting'])
    assert.equal(typeof P[name], 'function', 'Current appended oracle required: ' + name);
  const routes = Object.entries(PROTECTION_CONTRACT_OPERATIONS); assert.equal(routes.length, 7);
  const openapi = await f.call(null, 'GET', '/openapi.json'); assert.equal(openapi.code, 200);
  const sample = { campaignId: 'actual-reference', campaignSourceHash: 'a'.repeat(64), priceCash: 10000,
    lifetimeSeconds: 600, service: 'canonical_nonexclusive_single_save', consent: true };
  const reference = { contractId: 'actual-reference', sourceHash: 'b'.repeat(64), consent: true };
  assert.equal(validateFund(sample), true); assert.equal(validateReference(reference), true);
  for (const [name, change] of [['unknown authority', { authority: true }], ['false consent', { consent: false }],
    ['foreign payer', { payerAccount: 'other' }], ['unsupported service', { service: 'building_armor' }],
    ['low price', { priceCash: 9999 }], ['high price', { priceCash: 100001 }], ['fractional price', { priceCash: 10000.5 }],
    ['short lifetime', { lifetimeSeconds: 59 }], ['long lifetime', { lifetimeSeconds: 3601 }]])
    assert.equal(validateFund({ ...sample, ...change }), false, name);
  for (const [route, descriptor] of routes) {
    const [method, url] = route.split(' '), operation = openapi.body.paths[url]?.[method.toLowerCase()];
    assert(operation, 'Actual registered OpenAPI route required: ' + route);
    assert.equal(operation.operationId, descriptor.operationId);
    assert(Array.isArray(operation.security) && operation.security.length > 0, 'Actual authentication metadata required.');
    assert.deepEqual(operation.responses[200].content['application/json'].schema, descriptor.responseSchema);
    const body = url.endsWith('/fund') ? sample : reference;
    assert.equal((await f.call(null, method, url, method === 'POST' ? body : undefined)).code, 401);
    if (method === 'POST') {
      assert.deepEqual(operation.requestBody.content['application/json'].schema, descriptor.requestSchema);
      const key = ajv.compile(descriptor.requestParameters[0].schema);
      assert(key('a')); assert(key('a'.repeat(128))); assert(!key('')); assert(!key('a'.repeat(129))); assert(!key('a b'));
      for (const agent of [false, true]) assert.equal((await f.call(f.owner, method, url,
        { ...body, consent: false, authority: 'forged' }, 'closed-' + (++serial), agent)).code, 400);
    }
  }
  for (const agent of [false, true]) {
    const board = await f.call(f.owner, 'GET', '/v1/company/protection-contracts', undefined, undefined, agent);
    assert.equal(board.code, 200); assert(validateBoard(board.body), JSON.stringify(validateBoard.errors));
    assert.deepEqual(board.body.contracts, []); assert(!validateBoard({ ...board.body, authority: true }));
    assert.equal((await f.call(f.owner, 'GET', '/v1/company/protection-contracts?authority=guard', undefined, undefined, agent)).code, 400);
  }
  await accounting(0, 0);
  await assert.rejects(() => P.inspectProtectionContractHistory(pool, 'missing', 'a'.repeat(64)), error => error.code === 'protection_contract');
  if (!native) {
    assert.equal(await P.protectionContractReady(), false);
    for (const agent of [false, true]) {
      const unavailable = await f.call(f.owner, 'POST', '/v1/company/protection-contracts/fund', sample, 'native-required-' + agent, agent);
      assert.equal(unavailable.code, 400); assert.equal(unavailable.body.error, 'protection_contract_unavailable');
    }
    await accounting(0, 0);
  } else {
    assert.equal(await E.commercialCampaignReady(), true, 'Actual current N20 source graph required.');
    assert.equal(await P.protectionContractReady(), true, 'All genuine Game/N06/N20/Defense hooks required; no fixture aliases.');
    assert(process.env.PROTECTION_CONTRACT_PROOF_DIRECTORY && path.isAbsolute(process.env.PROTECTION_CONTRACT_PROOF_DIRECTORY));
    proofs = path.join(process.env.PROTECTION_CONTRACT_PROOF_DIRECTORY, 'history-followup');
    assert(!fs.existsSync(proofs), 'Refuse replacing old provenance evidence.'); fs.mkdirSync(proofs, { recursive: true });
    const a = await ready(), terms = fundTerms(a.campaign);
    const pending = response(await protection(a.first, 'fund', terms));
    noAuthority(await history(pending)); assert.equal((await history(pending)).reservedCash, 10000);
    assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM protection_contract_acceptances WHERE contract_id=$1', [pending.contract.contractId])).rows[0].n), 0);
    await accounting(10000, 1);
    const signed = response(await protection(a.guard, 'accept', pref(pending)));
    noAuthority(await history(signed), true); assert.equal((await uidHistory(signed)).signedGuardMembership, true);
    const refunded = response(await protection(a.first, 'refund', pref(pending)));
    noAuthority(await history(refunded)); assert.equal(refunded.contract.refundedCash, 10000); await accounting(0, 1);

    const purchase = response(await protection(a.first, 'fund', terms));
    response(await protection(a.guard, 'accept', pref(purchase)));
    const paid = response(await protection(a.first, 'activate', pref(purchase), 'actual-provenance-purchase'));
    noAuthority(await history(paid)); assert.equal(paid.contract.paidCash, 10000);
    assert.deepEqual(await protection(a.first, 'activate', pref(purchase), 'actual-provenance-purchase'), paid);
    const row = (await pool.query('SELECT * FROM protection_contracts WHERE id=$1', [paid.contract.contractId])).rows[0];
    const contract = paid.contract.contractId;
    await rolledBackJournalCensus('unknown-contract-balanced-original-payer-pair', row, 'test-only-unknown-contract', true);
    await rolledBackJournalCensus('known-contract-unreferenced-balanced-original-payer-pair', row, row.id, false);
    await rolledBackHistory('forged-original-activation-ACK', paid, c => c.query(
      "UPDATE protection_contract_requests SET body_hash=$2 WHERE contract_id=$1 AND action='activate'", [contract, 'f'.repeat(64)]));
    await rolledBackHistory('forged-private-receipt-field', paid, async c => {
      const q = (await c.query("SELECT * FROM protection_contract_requests WHERE contract_id=$1 AND action='activate'", [contract])).rows[0];
      await c.query('UPDATE protection_contract_requests SET receipt=$3 WHERE account_id=$1 AND key_hash=$2',
        [q.account_id, q.key_hash, { ...q.receipt, authority: true }]);
    });
    await rolledBackHistory('forged-actual-guard-journal', paid, c => c.query('UPDATE transactions SET amount=amount+1 WHERE id=$1', [row.guard_payee_journal]));
    await rolledBackHistory('forged-original-guard-acceptance', paid, c => c.query(
      'UPDATE protection_contract_acceptances SET source_hash=$2 WHERE contract_id=$1', [contract, 'f'.repeat(64)]));
    await rolledBackHistory('uncommitted-auxiliary-balance-is-not-authority', paid, c => c.query(
      'UPDATE protection_contracts SET coverage_proof=$2 WHERE id=$1', [contract, { ...row.coverage_proof, payerCash: row.coverage_proof.payerCash + 1 }]), false);
    await accounting(0, 2);

    const previousLeg = response(await protection(a.first, 'fund', terms));
    response(await protection(a.guard, 'accept', pref(previousLeg)));
    await invoke(a.first, 'courier-travel', a.campaignRef); await invoke(a.first, 'courier-handoff', a.campaignRef);
    const network = (await pool.query('SELECT * FROM multi_hop_couriers WHERE id=$1', [a.network])).rows[0];
    assert.equal(network.status, 'second_leg');
    assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [network.item_id])).rows[0],
      { owner_scope: 'operation', owner_id: network.id + ':second', state: 'escrowed' });
    noAuthority(await history(paid)); noAuthority(await uidHistory(refunded)); noAuthority(await history(previousLeg), true);
    const staleBoard = await f.call(a.first, 'GET', '/v1/company/protection-contracts');
    assert.equal(staleBoard.code, 200); assert(validateBoard(staleBoard.body));
    assert.equal(staleBoard.body.contracts.find(r => r.contractId === previousLeg.contract.contractId).blockedReason, 'multi_hop_courier:protection_carrier');
    const previousRefund = response(await protection(a.first, 'refund', pref(previousLeg))); noAuthority(await history(previousRefund));
    const secondLeg = response(await protection(a.second, 'fund', terms)); response(await protection(a.guard, 'accept', pref(secondLeg)));
    await invoke(a.owner, 'cancel', a.campaignRef);
    const cannotSpend = await f.call(a.second, 'POST', '/v1/company/protection-contracts/activate', pref(secondLeg));
    assert.equal(cannotSpend.code, 400);
    noAuthority(await history(paid)); noAuthority(await history(secondLeg), true);
    const retiredRefund = response(await protection(a.second, 'refund', pref(secondLeg))); noAuthority(await history(retiredRefund));
    const cancelled = await Courier.multiHopCourierAction(pool, a.owner.account, 'cancel',
      { networkId: network.id, sourceHash: network.source_hash, consent: true }, 'original-network-retirement');
    assert.equal(cancelled.status, 'cancelled');
    assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [network.item_id])).rows[0],
      { owner_scope: 'account', owner_id: a.owner.account, state: 'active' });
    for (const result of [paid, refunded, previousRefund, retiredRefund]) noAuthority(await uidHistory(result));
    await f.single(a.owner, (ch, c) => I.transferItem(c, { scope: 'account', id: ch.account_id },
      { scope: 'account', id: a.maker.account }, network.item_id, 'original-owner protection history proof transfer', 'protection-history-title-transfer'));
    assert.deepEqual((await pool.query('SELECT owner_scope,owner_id,state FROM item_instances WHERE id=$1', [network.item_id])).rows[0],
      { owner_scope: 'account', owner_id: a.maker.account, state: 'active' });
    const events = (await pool.query('SELECT event_kind,from_owner_id,to_owner_id FROM item_events WHERE item_id=$1 ORDER BY sequence', [network.item_id])).rows;
    assert.deepEqual(events.at(-1), { event_kind: 'transferred', from_owner_id: a.owner.account, to_owner_id: a.maker.account });
    for (const result of [paid, refunded, previousRefund, retiredRefund]) noAuthority(await uidHistory(result));
    await assert.rejects(() => P.inspectProtectionContractUidReference(pool, contract, paid.contract.sourceHash, 'wrong-UID'), error => error.code === 'protection_contract');
    assert.deepEqual(await Courier.collectMultiHopCourierIssues(pool), []); await accounting(0, 4);
    const ownBoard = await f.call(a.first, 'GET', '/v1/company/protection-contracts', undefined, undefined, true);
    assert.equal(ownBoard.code, 200); assert(validateBoard(ownBoard.body));
    const privateBoard = await f.call(a.scout, 'GET', '/v1/company/protection-contracts');
    assert.equal(privateBoard.code, 200); assert.deepEqual(privateBoard.body.contracts, []);
    save('final-native-state', await canonicalDatabaseSnapshot(pool));
  }
  completed = true;
} finally { await f.close(); }
assert.equal(completed, true);
save('result', { complete: true, mode: native ? 'actual native fixture' : 'actual memory fixture/native refusal only',
  fixtureClosed: true, financialActivation: 'off', auxiliaryBalanceCommitmentClaim: false });
console.log(native
  ? 'PASS actual N28 unsigned/signed reserve, paid/refunded provenance, strict actual-ACK/journal undo, canonical custody handoff/source retirement/title transfer and closed seven-route schemas. Fixture closed; external activation OFF.'
  : 'PASS actual N28 seven-route OpenAPI/authenticated schemas, closed bodies, empty read-only accounting and unchanged native-only admission. No paid/native positive claim. Fixture closed.');
