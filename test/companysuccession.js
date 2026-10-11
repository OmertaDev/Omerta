import assert from 'node:assert/strict';
import { resumeCompany, companySuccessionBoard } from '../src/companysuccession.js';
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.COMPANY_SUCCESSION_TEST_DATABASE_URL || 'http://missing');
  assert.equal(url.protocol, 'postgresql:'); assert.equal(url.hostname, '127.0.0.1');
  assert((url.port === '35439' && url.username === 'pilot_runner' && url.password === '')
    || (url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck'));
  assert(/^\/company_succession_[A-Za-z0-9_]+$/.test(url.pathname));
  assert(!url.search && !url.hash, 'No query or fragment endpoint overrides');
  const { default: pg } = await import('pg');
  const preflight = new pg.Pool({ connectionString: url.href });
  try { assert.equal((await preflight.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'Native succession proof requires its own empty database'); }
  finally { await preflight.end(); }
  process.env.DATABASE_URL = url.href; process.env.MARKET_SEED = 'company-succession-test-seed';
} else assert(!process.env.DATABASE_URL, 'Memory proof refuses ambient DATABASE_URL');
process.env.DEPOT_PILOT = 'on'; process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.JWT_SECRET = 'company-succession-module-local-test-secret'; process.env.MOD_KEY = 'company-succession-local-test-mod-secret';
const { buildServer } = await import('../src/server.js');
const G = await import('../src/game.js'), D = await import('../src/depot.js'), W = await import('../src/warehouseleases.js');
const M = await import('../src/market.js'), F = await import('../src/franchiselicenses.js'), Loan = await import('../src/loans.js');
const { setAgentCompany, ownAgentCompany } = await import('../src/agentcompany.js');
const { runEstate } = await import('../src/social/estate.js');
const app = await buildServer(); let serial = 0;
// pg-mem incorrectly uses this open-only partial index for closed-owner history.
// Memory uses a full scan; PostgreSQL retains the real index and native proofs.
if (!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
const config = { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 };
async function player() {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const name = `Succession ${++serial}`;
  const created = await app.inject({ method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${token}`, 'idempotency-key': name }, payload: { name } });
  assert.equal(created.statusCode, 200, created.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
  const ch = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query('UPDATE characters SET cash=100000,last_accrued_at=$2 WHERE id=$1', [ch.id, new Date(Date.now() + 3600000)]);
  return { id: ch.id, account };
}
const single = (who, fn) => G.withCharacter(app.pool, who.account, fn);
const pair = (who, target, fn) => G.withTwoCharacters(app.pool, who.account, target.id, fn, { meet: false });
const balance = async who => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [who.id])).rows[0].cash);
async function death(killer, victim) {
  const died = await pair(killer, victim, (ch, target, client, h) => runEstate(client, h, target, 'succession test estate'));
  await app.pool.query('UPDATE characters SET last_accrued_at=$2 WHERE id=$1', [died.heirId, new Date(Date.now() + 3600000)]);
  return { account: victim.account, id: died.heirId };
}
async function fixture() {
  const founder = await player(), other = await player();
  await app.pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)', [founder.account]);
  await setAgentCompany(app.pool, founder.account, { expectedRevision: 0, name: 'Continuing Firm', published: true, premises: 'estate' });
  const oldDepot = await single(founder, (ch, client, h) => D.openDepot(ch, config, client, h));
  await single(founder, (ch, client, h) => D.fundDepot(ch, oldDepot.id, 5000, client, h));
  const order = await single(founder, (ch, client, h) => D.restockDepot(ch, oldDepot.id, client, h));
  await app.pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',4)", [other.id]);
  await single(other, (ch, client, h) => M.fillOrder(ch, order.id, 4, client, h));
  await single(founder, (ch, client) => D.receiveDepot(ch, oldDepot.id, order.id, client));
  assert.equal(Number((await app.pool.query('SELECT stock FROM business_depots WHERE id=$1', [oldDepot.id])).rows[0].stock), 4);
  const otherDepot = await single(other, (ch, client, h) => D.openDepot(ch, config, client, h));
  const offered = await pair(founder, other, (ch, target, client) => F.offerFranchiseLicense(ch, target, oldDepot.id, otherDepot.id,
    { companyRevision: 1, presetId: 'gin_storefront', royaltyBps: 100, royaltyCap: 1000, expiresAt: new Date(Date.now() + 3600000).toISOString() }, client));
  await pair(other, founder, (ch, target, client) => F.acceptFranchiseLicense(ch, target, offered.license.id, client));
  await single(founder, (ch, client) => W.configureWarehouseOffer(ch, oldDepot.id, { expectedRevision: 0, enabled: true, slots: 20, cashPerUnitDay: 25 }, client));
  const rent = await pair(other, founder, (ch, target, client, h) => W.leaseWarehouse(ch, target, oldDepot.id, { units: 4, expectedOfferRevision: 1, maxTotalCash: 100 }, client, h));
  await app.pool.query("INSERT INTO character_cargo(character_id,good_id,qty) VALUES($1,'gin',4)", [other.id]);
  await single(other, (ch, client, h) => W.depositWarehouseCargo(ch, rent.lease.id, 4, client, h));
  const loan = await single(founder, (ch, client, h) => Loan.offerLoan(ch, { amount: 5000, rate: 0.1, hours: 1, collateral: 0 }, client, h));
  await single(other, (ch, client, h) => Loan.takeLoan(ch, loan.id, null, client, h));
  await app.pool.query("INSERT INTO resource_treasuries(account_id,mode) VALUES($1,'test')", [founder.account]);
  await app.pool.query('INSERT INTO resource_compute_policies(account_id,revision,enabled,providers,max_per_call,max_per_day,minimum_reserve,allow_stored_responses,expires_at) VALUES($1,1,true,$2,100,200,0,false,$3)', [founder.account, JSON.stringify(['test-only-provider']), new Date(Date.now() + 3600000)]);
  const heir = await death(other, founder);
  const old = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [oldDepot.id])).rows[0];
  assert.equal(old.status, 'closed'); assert.equal(Number(old.treasury), 0); assert.equal(Number(old.stock), 0); assert.equal(Number(old.stock_cost), 0);
  assert.equal((await app.pool.query('SELECT lender_character FROM loans WHERE id=$1', [loan.id])).rows[0].lender_character, heir.id, 'canonical lender succession already applied by estate');
  assert.equal((await app.pool.query('SELECT status FROM business_warehouse_leases WHERE id=$1', [rent.lease.id])).rows[0].status, 'landlord_closed');
  const input = { expectedCompanyRevision: 1, predecessorCharacterId: founder.id, maxOpeningCash: 5000, consent: true };
  return { founder, other, heir, oldDepot, input };
}
const resume = (f, body = f.input, key = 'resume') => single(f.heir, (ch, client, h) => resumeCompany(ch, body, key, client, h));
async function protectedSnapshot(f) {
  const snapshot = {};
  for (const table of ['loans', 'business_warehouse_leases', 'depot_brand_licenses', 'crew_logistics_links', 'resource_compute_policies'])
    snapshot[table] = (await app.pool.query(`SELECT * FROM ${table}`)).rows.sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  snapshot.oldDepot = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [f.oldDepot.id])).rows;
  snapshot.oldJournal = (await app.pool.query('SELECT * FROM business_depot_journal WHERE depot_id=$1 ORDER BY id', [f.oldDepot.id])).rows;
  return snapshot;
}
async function verifyOpening(f, result, beforeCash, protectedRows) {
  assert.equal(await balance(f.heir), beforeCash - 5000);
  const depot = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [result.depot.id])).rows[0];
  assert.notEqual(depot.id, f.oldDepot.id); assert.equal(depot.owner_character, f.heir.id); assert.equal(depot.status, 'open');
  assert.equal(Number(depot.treasury), 0); assert.equal(Number(depot.stock), 0); assert.equal(Number(depot.stock_cost), 0);
  const rows = (await app.pool.query("SELECT amount,currency FROM transactions WHERE reason='depot:open' AND counterparty=$1", [depot.id])).rows;
  assert.equal(rows.length, 1); assert.equal(rows[0].currency, 'cash'); assert.equal(Number(rows[0].amount), -5000);
  const journal = (await app.pool.query('SELECT reason,expense,cash_delta,stock_delta FROM business_depot_journal WHERE depot_id=$1', [depot.id])).rows;
  assert.equal(journal.length, 1); assert.equal(journal[0].reason, 'open'); assert.equal(Number(journal[0].expense), 5000);
  assert.equal(Number(journal[0].cash_delta), 0); assert.equal(Number(journal[0].stock_delta), 0);
  assert.deepEqual(await protectedSnapshot(f), protectedRows, 'old estate obligations, custody, franchises and owner grant unchanged');
}
try {
  const f = await fixture(), protectedRows = await protectedSnapshot(f);
  await assert.rejects(resume(f), e => e.code === 'company_succession' && e.reason === 'cash');
  assert.equal((await ownAgentCompany(app.pool, f.heir.account)).company.revision, 1);
  for (const change of [{ consent: false }, { maxOpeningCash: 4999 }, { maxOpeningCash: 5001 }, { beneficiaryAccount: f.other.account }, { expectedCompanyRevision: 0 }])
    await assert.rejects(resume(f, { ...f.input, ...change }), { code: 'company_succession' });
  await assert.rejects(resume(f, { ...f.input, predecessorCharacterId: f.other.id }), { code: 'company_succession' });
  await app.pool.query('UPDATE estates SET tier=0 WHERE account_id=$1', [f.heir.account]);
  await assert.rejects(resume(f), e => e.code === 'company_succession' && e.reason === 'premises');
  await app.pool.query('UPDATE estates SET tier=1 WHERE account_id=$1', [f.heir.account]);
  await app.pool.query('UPDATE business_depots SET treasury=1 WHERE id=$1', [f.oldDepot.id]);
  await assert.rejects(resume(f), e => e.code === 'company_succession' && e.reason === 'estate');
  await app.pool.query('UPDATE business_depots SET treasury=0 WHERE id=$1', [f.oldDepot.id]);
  await app.pool.query('UPDATE characters SET cash=7500.25 WHERE id=$1', [f.heir.id]); // Explicit funded test fixture, not estate wealth restoration.
  const result = await resume(f); assert(result.ok); assert.equal(result.company.revision, 2);
  assert.equal(result.company.name, 'Continuing Firm'); assert.equal(result.company.premises.kind, 'estate');
  await verifyOpening(f, result, 7500.25, protectedRows);
  process.env.DEPOT_PILOT = 'off'; const after = await balance(f.heir);
  assert((await resume(f)).replayed); assert.equal(await balance(f.heir), after);
  await assert.rejects(resume(f, { ...f.input, predecessorCharacterId: f.other.id }), { code: 'company_succession' });
  assert.equal((await companySuccessionBoard(app.pool, f.heir.account)).length, 1);
  assert.equal((await companySuccessionBoard(app.pool, f.other.account)).length, 0);
  const nextHeir = await death(f.other, f.heir); const nextBalance = await balance(nextHeir);
  assert((await single(nextHeir, (ch, client, h) => resumeCompany(ch, f.input, 'resume', client, h))).replayed);
  assert.equal(await balance(nextHeir), nextBalance, 'later successor receipt replay never recharges or restores prior front');
  process.env.DEPOT_PILOT = 'on';
  await assert.rejects(single(nextHeir, (ch, client, h) => resumeCompany(ch,
    { ...f.input, expectedCompanyRevision: 2 }, 'wrong-generation', client, h)), e => e.code === 'company_succession' && e.reason === 'predecessor');

  const revision = await fixture(); await app.pool.query('UPDATE characters SET cash=7500.25 WHERE id=$1', [revision.heir.id]);
  if (native) {
    const race = await Promise.allSettled([resume(revision), setAgentCompany(app.pool, revision.heir.account,
      { expectedRevision: 1, name: 'Owner Edited Firm', published: true, premises: 'estate' })]);
    assert.equal(race.filter(r => r.status === 'fulfilled').length, 1, 'shared account mutex/CAS admits exactly one edit');
    if (race[0].status === 'rejected') {
      assert.equal(await balance(revision.heir), 7500.25);
      assert.equal((await app.pool.query('SELECT id FROM company_succession_receipts WHERE account_id=$1', [revision.heir.account])).rows.length, 0);
      const updated = await resume(revision, { ...revision.input, expectedCompanyRevision: 2 }); assert.equal(updated.company.name, 'Owner Edited Firm');
    }
    const rollback = await fixture(); await app.pool.query('UPDATE characters SET cash=7500.25 WHERE id=$1', [rollback.heir.id]);
    await app.pool.query("CREATE FUNCTION succession_reject_open() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.reason='depot:open' THEN RAISE EXCEPTION 'injected succession open failure'; END IF; RETURN NEW; END $$");
    await app.pool.query('CREATE TRIGGER succession_reject_open BEFORE INSERT ON transactions FOR EACH ROW EXECUTE FUNCTION succession_reject_open()');
    await assert.rejects(resume(rollback), /injected succession open failure/);
    assert.equal(await balance(rollback.heir), 7500.25); assert.equal((await ownAgentCompany(app.pool, rollback.heir.account)).company.revision, 1);
    assert.equal((await companySuccessionBoard(app.pool, rollback.heir.account)).length, 0);
    assert.equal((await app.pool.query('SELECT id FROM business_depots WHERE owner_character=$1', [rollback.heir.id])).rows.length, 0);
    await app.pool.query('DROP TRIGGER succession_reject_open ON transactions'); await app.pool.query('DROP FUNCTION succession_reject_open()');
    const beforeRows = await protectedSnapshot(rollback), opened = await resume(rollback); await verifyOpening(rollback, opened, 7500.25, beforeRows);
  } else {
    await setAgentCompany(app.pool, revision.heir.account, { expectedRevision: 1, name: 'Owner Edited Firm', published: true, premises: 'estate' });
    await assert.rejects(resume(revision), { code: 'company_succession' }); assert.equal(await balance(revision.heir), 7500.25);
  }
  console.log(JSON.stringify({ status: 'PASS', database: native ? 'PostgreSQL' : 'memory',
    scope: 'Explicit successor company consent, canonical newly funded 5000 depot, unchanged prior estate/loan/custody/franchise/grant data and durable account replay. Native additionally proves concurrent profile edit exclusion and injected transaction rollback; no credential or old wealth inheritance.' }));
} finally { await app.close(); }
