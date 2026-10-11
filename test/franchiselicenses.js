import assert from 'node:assert/strict';
import { FRANCHISE, franchiseLicenseTerms, franchiseRoyalty, franchiseLicenseView, settleFranchiseSale,
  offerFranchiseLicense, acceptFranchiseLicense, endFranchiseLicense, prepareFranchiseSale } from '../src/franchiselicenses.js';

const now = Date.parse('2026-10-11T12:00:00Z');
const terms = { companyRevision: 1, presetId: 'gin_storefront', royaltyBps: 100, royaltyCap: 1000,
  expiresAt: new Date(now + 86400000).toISOString() };
const license = changes => ({ id: 'license', operator_depot_id: 'operator', recipient_depot_id: 'recipient',
  brand_name: 'Independent shop', preset_id: 'gin_storefront', company_revision: 1, royalty_bps: 100,
  royalty_cap: 1000, paid: 0, earned_net: 0, created_at: new Date(now), expires_at: terms.expiresAt, status: 'active', ...changes });
assert.deepEqual(franchiseLicenseTerms(terms, now), terms);
for (const change of [{ royaltyBps: 0 }, { royaltyBps: 1001 }, { royaltyBps: '1' }, { royaltyCap: 1000001 },
  { companyRevision: 0 }, { presetId: 'code' }, { execute: 'anything' }, { expiresAt: new Date(now).toISOString() },
  { expiresAt: new Date(now + FRANCHISE.maxTermMs + 1).toISOString() }, { expiresAt: null }])
  assert.throws(() => franchiseLicenseTerms({ ...terms, ...change }, now), error => error.code === 'franchise_terms');
assert.deepEqual(franchiseRoyalty(license(), 12345, now), { royaltyCash: 123, earnedNet: 12345, paidCash: 123, eligible: true });
assert.equal(franchiseRoyalty(license({ paid: 999 }), 1000, now).royaltyCash, 1, 'total cap stops charges without debt');
for (const change of [{ status: 'offered' }, { status: 'ended' }, { expires_at: new Date(now) }, { paid: 1000 }])
  assert.deepEqual(franchiseRoyalty(license(change), 100, now), { royaltyCash: 0, earnedNet: 0, paidCash: change.paid || 0, eligible: false });
for (const change of [{ earned_net: -1 }, { paid: 1001 }, { royalty_bps: NaN }, { status: 'unknown' }, { expires_at: 'bad' }])
  assert.throws(() => franchiseRoyalty(license(change), 100, now));
for (const net of [0, -1, 1.5, '100', Infinity, FRANCHISE.maxSaleNet + 1]) assert.throws(() => franchiseRoyalty(license(), net, now));
assert.throws(() => franchiseRoyalty(license({ earned_net: FRANCHISE.maxEarnedNet }), 1, now), 'overflow never silently truncates');
const view = franchiseLicenseView(license({ secret: 'do not expose' }));
assert.equal(view.secret, undefined); assert.equal(view.gameCashOnly, true);
await assert.rejects(settleFranchiseSale({ query: () => assert.fail('forged context must not reach storage') },
  { licenseId: 'invented', operatorId: 'operator' }, 'sale'), error => error.code === 'franchise_proof');

// Partitioning a sale cannot avoid cumulative rounding; paired native entries will
// prove cash conservation separately once the coordinator supplies journal hooks.
let seed = 1947; const random = () => (seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0);
for (let i = 0; i < 1000; i++) {
  const bps = random() % 1000 + 1, cap = random() % 1000000 + 1;
  let row = license({ royalty_bps: bps, royalty_cap: cap }), total = 0;
  for (let j = 0; j < 20; j++) {
    const net = random() % 10000 + 1; total += net;
    const quote = franchiseRoyalty(row, net, now);
    assert(quote.royaltyCash >= 0 && quote.royaltyCash <= net);
    row = { ...row, earned_net: quote.earnedNet, paid: quote.paidCash };
  }
  assert.equal(row.paid, Math.min(cap, Math.floor(total * bps / 10000)), 'partition-independent capped royalty');
}
console.log('franchiselicenses: pure terms/expiry/cap/rounding PASS; seed1947 1000 partition cases; native settlement not yet proven');

const postgres = process.argv.includes('--postgres');
if (postgres) {
  const value = process.env.FRANCHISE_TEST_DATABASE_URL;
  if (!value) throw new Error('Set FRANCHISE_TEST_DATABASE_URL to a dedicated fresh local franchise database.');
  const url = new URL(value);
  const isolatedIdentity = (url.port === '35439' && url.username === 'pilot_runner')
    || (url.port === '5432' && url.username === 'postgres');
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || url.hostname !== '127.0.0.1' || !isolatedIdentity
      || !/^\/franchise_[a-z0-9_]+$/.test(url.pathname))
    throw new Error('Franchise native proofs require the isolated loopback task database.');
  const { Pool } = await import('pg'); const check = new Pool({ connectionString: value });
  try { assert.equal((await check.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'native proof database must be empty'); }
  finally { await check.end(); }
  process.env.DATABASE_URL = value;
} else {
  if (process.env.DATABASE_URL) throw new Error('Memory proof refuses an existing DATABASE_URL.');
}
process.env.DEPOT_PILOT = 'on'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'local-franchise-proof-not-production-secret'; process.env.MOD_KEY = 'franchise-local-proof';
process.env.MARKET_SEED = 'franchise-local-proof-seed';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js'), D = await import('../src/depot.js');
const { bookDepot, closeDepotsAtDeath } = await import('../src/depotbook.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer();
const actors = [];
async function player(name) {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const accountId = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  const created = await app.inject({ method: 'POST', url: '/v1/character', payload: { name },
    headers: { authorization: `Bearer ${token}`, 'idempotency-key': name } });
  assert.equal(created.statusCode, 200, created.body);
  const ch = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1', [accountId])).rows[0];
  await app.pool.query('UPDATE characters SET cash=1000000 WHERE id=$1', [ch.id]);
  const actor = { id: ch.id, accountId }; actors.push(actor); return actor;
}
const paired = (actor, target, fn) => G.withTwoCharacters(app.pool, actor.accountId, target.id, fn, { meet: false });
const owned = (actor, fn) => G.withCharacter(app.pool, actor.accountId, fn);
const config = { salePrice: 101, bidPrice: 50, targetStock: 40, reorderAt: 0, restockBudget: 5000 };
async function depot(actor) { return (await owned(actor, (ch, client, h) => D.openDepot(ch, config, client, h))).id; }
async function stock(actor, id, qty = 20) {
  await owned(actor, async (ch, client) => {
    const row = (await client.query('SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [id])).rows[0];
    await bookDepot(client, row, 'fixture_stock', { stock: qty, cost: qty * 50 });
  });
}
const state = async id => (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [id])).rows[0];
const journal = async id => (await app.pool.query('SELECT * FROM business_depot_journal WHERE franchise_license_id=$1', [id])).rows;
let offered;
try {
  const operator = await player('Franchise Operator'), licensor = await player('Franchise Licensor'), buyer = await player('Franchise Buyer');
  const operatorId = await depot(operator), recipientId = await depot(licensor);
  await stock(operator, operatorId);
  await app.pool.query("INSERT INTO agent_company_profiles(account_id,revision,name,published) VALUES($1,1,'Native Brand',true)", [licensor.accountId]);
  const body = { ...terms, expiresAt: new Date(Date.now() + 86400000).toISOString() };
  const offer = (changes = {}, recipient = recipientId, op = operatorId) => paired(licensor, operator,
    (ch, target, client) => offerFranchiseLicense(ch, target, recipient, op, { ...body, ...changes }, client));
  await assert.rejects(offer({ companyRevision: 2 }), e => e.code === 'franchise_company');
  await assert.rejects(offer({}, operatorId, operatorId), e => e.code === 'franchise_owner');
  offered = (await offer()).license;
  assert.equal(offered.status, 'offered'); assert.equal(offered.paidCash, 0);
  assert.equal(Number((await state(recipientId)).treasury), 0, 'offer never transfers principal');
  await assert.rejects(paired(buyer, licensor, (ch, target, client) => acceptFranchiseLicense(ch, target, offered.id, client)), e => e.code === 'franchise_owner');
  const accept = id => paired(operator, licensor, (ch, target, client) => acceptFranchiseLicense(ch, target, id, client));
  assert.equal((await accept(offered.id)).license.status, 'active');
  assert.equal((await accept(offered.id)).license.id, offered.id, 'accept replay retains immutable consent');
  const rival = (await offer({ royaltyBps: 500 })).license;
  await assert.rejects(accept(rival.id), e => e.code === 'franchise_active');
  await owned(licensor, (ch, client) => endFranchiseLicense(ch, rival.id, client));
  await assert.rejects(accept(rival.id), e => e.code === 'franchise_ended');
  // The canonical purchase itself performs prepare/book/settle. An explicit
  // post-sale settle below tests cached source replay, never funds the royalty.
  const buy = (repeat = true) => paired(buyer, operator, async (ch, owner, client, h) => {
    ch.loc = owner.loc;
    const beforeRow = (await client.query('SELECT * FROM business_depots WHERE id=$1', [operatorId])).rows[0];
    const stale = { cash: Number(beforeRow.treasury), stock: Number(beforeRow.stock), cost: Number(beforeRow.stock_cost) };
    const prior = new Set((await client.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='sale'", [operatorId])).rows.map(row => row.id));
    const sale = await D.buyFromDepot(ch, owner, operatorId, 1, 101, client, h);
    const receipt = (await client.query("SELECT * FROM business_depot_journal WHERE depot_id=$1 AND reason='sale'", [operatorId])).rows.find(row => !prior.has(row.id));
    assert(receipt); assert.equal(Number(receipt.cash_delta), sale.businessRevenue);
    const credit = (await client.query("SELECT cash_delta FROM business_depot_journal WHERE source_journal_id=$1 AND reason='royalty_income'", [receipt.id])).rows[0];
    const royalty = { royaltyCash: credit ? Number(credit.cash_delta) : 0 };
    if (repeat) {
      assert(credit, 'native buy must itself create the royalty pair, including zero royalties');
      const prepared = await prepareFranchiseSale(client, operatorId);
      assert.deepEqual(await settleFranchiseSale(client, prepared.context, receipt.id), { ...royalty, replayed: true });
    }
    const after = (await client.query('SELECT * FROM business_depots WHERE id=$1', [operatorId])).rows[0];
    assert.equal(Number(after.treasury), stale.cash + sale.businessRevenue - royalty.royaltyCash);
    assert.equal(Number(after.stock), stale.stock - 1, 'settlement must not restore stale pre-sale stock');
    assert.equal(Number(after.stock_cost), stale.cost - 50, 'settlement must not restore pre-sale inventory cost');
    return { sale, royalty, receiptId: receipt.id };
  });
  const first = await buy(); assert.equal(first.royalty.royaltyCash, 0, 'first small sale retains fractional royalty');
  const second = await buy(); assert.equal(second.royalty.royaltyCash, 1, 'cumulative sales eventually pay without rounding evasion');
  let entries = await journal(offered.id);
  assert.equal(entries.length, 4, 'zero and positive royalty sales each journal once per side');
  for (const saleId of [first.receiptId, second.receiptId]) {
    const pair = entries.filter(row => row.source_journal_id === saleId);
    assert.equal(pair.length, 2); assert.equal(pair.reduce((sum, row) => sum + Number(row.cash_delta), 0), 0);
    assert.deepEqual(pair.map(row => row.reason).sort(), ['royalty_expense', 'royalty_income']);
    assert.equal(pair.filter(row => row.reason === 'royalty_expense').reduce((sum, row) => sum + Number(row.expense), 0),
      pair.find(row => row.reason === 'royalty_income').cash_delta * 1);
  }
  assert.equal(Number((await state(recipientId)).treasury), 1);
  const franchiseChecks = async () => (await runLedgerInvariants(app.pool, { alert: false })).checks.filter(c => c.name.startsWith('franchise '));
  const assertFranchiseClean = async () => {
    const checks = await franchiseChecks(); assert(checks.length >= 5);
    assert.deepEqual(checks.filter(c => !c.ok), [], 'all franchise checks must reconcile real canonical sales');
  };
  await assertFranchiseClean();
  const zeroCredit = entries.find(row => row.source_journal_id === first.receiptId && row.reason === 'royalty_income');
  const positiveDebit = entries.find(row => row.source_journal_id === second.receiptId && row.reason === 'royalty_expense');
  const positiveCredit = entries.find(row => row.source_journal_id === second.receiptId && row.reason === 'royalty_income');
  const corrupt = async (write, restore, expected) => {
    await write();
    try { assert((await franchiseChecks()).some(c => c.name === expected && !c.ok), `detect ${expected}`); }
    finally { await restore(); }
    await assertFranchiseClean();
  };
  await corrupt(() => app.pool.query('UPDATE business_depot_journal SET franchise_license_id=NULL,source_journal_id=NULL WHERE id=$1', [zeroCredit.id]),
    () => app.pool.query('UPDATE business_depot_journal SET franchise_license_id=$2,source_journal_id=$3 WHERE id=$1', [zeroCredit.id, offered.id, first.receiptId]),
    'franchise royalty provenance');
  await corrupt(() => app.pool.query('UPDATE business_depot_journal SET depot_id=$2 WHERE id=$1', [positiveCredit.id, operatorId]),
    () => app.pool.query('UPDATE business_depot_journal SET depot_id=$2 WHERE id=$1', [positiveCredit.id, recipientId]), 'franchise royalty provenance');
  const nonsale = (await app.pool.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='fixture_stock'", [operatorId])).rows[0].id;
  await corrupt(() => app.pool.query('UPDATE business_depot_journal SET source_journal_id=$2 WHERE source_journal_id=$1', [second.receiptId, nonsale]),
    () => app.pool.query('UPDATE business_depot_journal SET source_journal_id=$2 WHERE source_journal_id=$1', [nonsale, second.receiptId]), 'franchise royalty provenance');
  await corrupt(() => app.pool.query('UPDATE business_depot_journal SET expense=2 WHERE id=$1', [positiveDebit.id]),
    () => app.pool.query('UPDATE business_depot_journal SET expense=1 WHERE id=$1', [positiveDebit.id]), 'franchise royalty provenance');
  await corrupt(() => app.pool.query('UPDATE depot_brand_licenses SET paid=2 WHERE id=$1', [offered.id]),
    () => app.pool.query('UPDATE depot_brand_licenses SET paid=1 WHERE id=$1', [offered.id]), `franchise paid:${offered.id}`);
  await corrupt(() => app.pool.query('UPDATE depot_brand_licenses SET earned_net=1 WHERE id=$1', [offered.id]),
    () => app.pool.query('UPDATE depot_brand_licenses SET earned_net=$2 WHERE id=$1', [offered.id, first.sale.businessRevenue + second.sale.businessRevenue]), `franchise earned:${offered.id}`);
  console.log('franchiselicenses canonical sale + invariant provenance/zero-half/recipient/source/expense/counter tamper detection PASS');
  await owned(operator, async (ch, client) => {
    const prepared = await prepareFranchiseSale(client, operatorId);
    const row = (await client.query('SELECT * FROM business_depots WHERE id=$1', [operatorId])).rows[0];
    for (const reason of ['fund', 'warehouse_rent']) {
      const id = await bookDepot(client, row, reason, { cash: 10 });
      await assert.rejects(settleFranchiseSale(client, prepared.context, id), e => e.code === 'franchise_proof');
    }
    await assert.rejects(settleFranchiseSale(client, prepared.context, positiveCredit.id), e => e.code === 'franchise_proof', 'royalty income never becomes a retail sale');
    await assert.rejects(settleFranchiseSale({ query: () => assert.fail('different client must reject before storage') },
      prepared.context, second.receiptId), e => e.code === 'franchise_proof');
  });
  if (postgres) {
    const snapshot = async () => ({
      depots: (await app.pool.query('SELECT id,treasury,stock,stock_cost FROM business_depots ORDER BY id')).rows,
      buyer: (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [buyer.id])).rows,
      cargo: (await app.pool.query('SELECT good_id,qty FROM character_cargo WHERE character_id=$1 ORDER BY good_id', [buyer.id])).rows,
      licenses: (await app.pool.query('SELECT id,paid,earned_net,status FROM depot_brand_licenses ORDER BY id')).rows,
      journals: (await app.pool.query('SELECT id FROM business_depot_journal ORDER BY id')).rows,
    });
    const before = await snapshot();
    await app.pool.query("CREATE FUNCTION franchise_proof_reject_income() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='royalty_income' THEN RAISE EXCEPTION 'forced_franchise_rollback'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER franchise_proof_reject_income BEFORE INSERT ON business_depot_journal FOR EACH ROW EXECUTE FUNCTION franchise_proof_reject_income()');
    try { await assert.rejects(buy(), e => e.message.includes('forced_franchise_rollback')); }
    finally {
      await app.pool.query('DROP TRIGGER franchise_proof_reject_income ON business_depot_journal');
      await app.pool.query('DROP FUNCTION franchise_proof_reject_income()');
    }
    assert.deepEqual(await snapshot(), before, 'recipient journal failure rolls back sale, both treasuries, inventory, cargo and royalty counters');
    const replayRace = await Promise.all([1, 2].map(() => paired(buyer, operator, async (ch, owner, client) => {
      const prepared = await prepareFranchiseSale(client, operatorId);
      return settleFranchiseSale(client, prepared.context, second.receiptId);
    })));
    assert(replayRace.every(result => result.replayed && result.royaltyCash === 1));
    assert.deepEqual(await snapshot(), before, 'concurrent same-source settlement replay never repeats charge');
    await owned(operator, (ch, client) => endFranchiseLicense(ch, offered.id, client));
    const a = (await offer({ royaltyBps: 1000 })).license, b = (await offer({ royaltyBps: 500 })).license;
    const raced = await Promise.allSettled([accept(a.id), accept(b.id)]);
    assert.equal(raced.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(raced.filter(result => result.status === 'rejected' && result.reason.code === 'franchise_active').length, 1);
    offered = raced.find(result => result.status === 'fulfilled').value.license;
    assert.equal((await app.pool.query("SELECT id FROM depot_brand_licenses WHERE operator_depot_id=$1 AND status='active'", [operatorId])).rows.length, 1);
    console.log('franchiselicenses PostgreSQL rollback/paired replay/competing acceptance PASS');
  }
  const switchLicense = async changes => {
    await owned(operator, (ch, client) => endFranchiseLicense(ch, offered.id, client));
    offered = (await offer(changes)).license; await accept(offered.id);
  };
  await switchLicense({ royaltyBps: 1000, royaltyCap: 3 });
  const capped = await buy(); assert.equal(capped.royalty.royaltyCash, 3);
  const capEntries = (await journal(offered.id)).length;
  assert.equal((await buy(false)).royalty.royaltyCash, 0); assert.equal((await journal(offered.id)).length, capEntries);
  await switchLicense({ royaltyBps: 1000 });
  await app.pool.query('UPDATE depot_brand_licenses SET expires_at=$2 WHERE id=$1', [offered.id, new Date(Date.now() - 1000)]);
  assert.equal((await buy(false)).royalty.royaltyCash, 0); assert.equal((await journal(offered.id)).length, 0);
  await switchLicense({ royaltyBps: 1000 });
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [licensor.id]);
  assert.equal((await buy(false)).royalty.royaltyCash, 0, 'recipient death stops royalties before separate closure');
  await app.pool.query('UPDATE characters SET alive=true WHERE id=$1', [licensor.id]);
  await owned(licensor, (ch, client, h) => closeDepotsAtDeath(client, ch.id, h.ledger));
  assert.equal((await buy(false)).royalty.royaltyCash, 0, 'closed recipient stops future royalties');
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [operator.id]);
  await assert.rejects(buy(false), e => ['dead', 'no_depot', 'no_target'].includes(e.code));
  await assertFranchiseClean();
  console.log(`franchiselicenses ${postgres ? 'PostgreSQL' : 'memory'} domain PASS: consent/lifecycle, real buy/cargo/net journals, cumulative zero-pair replay, refreshed stock/cost, caps/expiry/death; root route integration separate`);
} finally { await app.close(); }
