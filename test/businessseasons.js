process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'business-season-isolated-proof-secret';
process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.DEPOT_PILOT = 'on';
process.env.MARKET_SEED = 'business-season-isolated-seed'; process.env.MOD_KEY = 'business-season-isolated-mod';
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.BUSINESS_SEASON_TEST_DATABASE_URL);
  if (!['127.0.0.1', 'localhost'].includes(url.hostname) || !url.pathname.startsWith('/business_season_test_')) throw new Error('Only a fresh owned local season test database is accepted.');
  process.env.DATABASE_URL = url.href;
} else delete process.env.DATABASE_URL;
import assert from 'node:assert/strict';
import { buildServer } from '../src/server.js';
import * as G from '../src/game.js';
import * as D from '../src/depot.js';
import * as Market from '../src/market.js';
import * as Loans from '../src/loans.js';
import * as S from '../src/businessseasons.js';
import { buyGood } from '../src/economy.js';
import { LOAN } from '../src/rules.js';
const app = await buildServer(); let sequence = 0;
async function player() {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const made = await app.inject({ method: 'POST', url: '/v1/character', payload: { name: `Season Player ${++sequence}` }, headers: { authorization: `Bearer ${token}` } });
  assert.equal(made.statusCode, 200, made.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
  const row = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1", [row.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'pilot:capital' });
  await app.pool.query('INSERT INTO agent_company_profiles(account_id,revision,name,published) VALUES($1,1,$2,true)', [account, `Season Company ${sequence}`]);
  await app.pool.query('INSERT INTO commercial_reputation_publications(account_id,published,revision) VALUES($1,true,1)', [account]);
  return { id: row.id, account };
}
const single = (p, fn) => G.withCharacter(app.pool, p.account, fn);
const pair = (p, other, fn) => G.withTwoCharacters(app.pool, p.account, other.id, fn, { meet: false });
const terms = { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 };
const seasonTerms = { name: 'Realized Cash Season', enrollmentSeconds: 60, durationSeconds: 600, maxCompanies: 2 };
const make = (p, key) => single(p, (ch, db) => S.createBusinessSeason(ch, seasonTerms, key, db));
const observe = (p, season) => single(p, (ch, db) => S.observeBusinessSeason(ch, season, db));
const finishClock = season => app.pool.query('UPDATE business_seasons SET ends_at=$2 WHERE id=$1', [season, new Date(Date.now() - 1)]);
const startClock = season => app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [season, new Date(Date.now() - 1), new Date(Date.now() + 600000)]);
try {
  const owner = await player(), supplier = await player(), customer = await player();
  const depot = (await single(owner, (ch, db, h) => D.openDepot(ch, terms, db, h))).id;
  await single(owner, (ch, db, h) => D.fundDepot(ch, depot, 10000, db, h));
  const preOrder = await single(owner, (ch, db, h) => D.restockDepot(ch, depot, db, h));
  await single(supplier, (ch, db, h) => buyGood(ch, 'gin', 2, db, h));
  await single(supplier, (ch, db, h) => Market.fillOrder(ch, preOrder.id, 2, db, h));
  await single(owner, (ch, db) => D.receiveDepot(ch, depot, preOrder.id, db));
  const created = await make(owner, 'season-create'); const season = created.season.id;
  assert.deepEqual(await make(owner, 'season-create'), created);
  await assert.rejects(single(owner, (ch, db) => S.createBusinessSeason(ch, { ...seasonTerms, startsAt: new Date().toISOString() }, 'backfill', db)), /terms/);
  const enrollment = { seasonId: season, depotId: depot, published: true };
  const enrolled = await single(owner, (ch, db) => S.enrollBusinessSeason(ch, enrollment, db));
  assert.deepEqual(await single(owner, (ch, db) => S.enrollBusinessSeason(ch, enrollment, db)), enrolled);
  await assert.rejects(single(customer, (ch, db) => S.enrollBusinessSeason(ch, enrollment, db)), /original_owner/);
  assert.equal((await observe(owner, season)).phase, 'waiting');
  await startClock(season);
  const baselines = native ? await Promise.all([observe(owner, season), observe(owner, season)]) : [await observe(owner, season)];
  assert.equal(baselines[0].phase, 'running');
  for (const baseline of baselines) assert.equal(baseline.baseline.sourceHash, baselines[0].baseline.sourceHash);
  const baselineCash = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [owner.id])).rows[0].cash);
  const borrowed = await single(supplier, (ch, db, h) => Loans.offerLoan(ch, { amount: LOAN.MIN, rate: 0.05, hours: Math.max(3, LOAN.TERM_MIN_H), to: owner.id }, db, h));
  await single(owner, (ch, db, h) => Loans.takeLoan(ch, borrowed.id, null, db, h));
  await single(owner, (ch, db, h) => D.fundDepot(ch, depot, LOAN.MIN, db, h));
  await pair(customer, owner, (ch, merchant, db, h) => D.buyFromDepot(ch, merchant, depot, 2, 1000, db, h));
  await app.pool.query("UPDATE business_depot_journal SET created_at=$2 WHERE depot_id=$1 AND reason='sale'", [depot, new Date(+new Date(baselines[0].baseline.observedAt) - 3600000)]);
  const freshOrder = await single(owner, (ch, db, h) => D.restockDepot(ch, depot, db, h));
  await single(supplier, (ch, db, h) => buyGood(ch, 'gin', 2, db, h));
  await single(supplier, (ch, db, h) => Market.fillOrder(ch, freshOrder.id, 2, db, h));
  await single(owner, (ch, db) => D.receiveDepot(ch, depot, freshOrder.id, db));
  await finishClock(season);
  const ends = native ? await Promise.all([observe(owner, season), observe(owner, season)]) : [await observe(owner, season)];
  const result = ends[0].result;
  for (const end of ends) assert.deepEqual(end.result, result);
  assert.equal(result.known, true); assert.equal(result.coverage, 'observed');
  assert.equal(result.revenue, 1960); assert.equal(result.costOfGoodsSold, 1000);
  assert.equal(result.expenses, freshOrder.fee); assert.equal(result.operatingResult, 960 - freshOrder.fee);
  assert.equal(result.stockoutSales, 1); assert.equal(result.sales, 1);
  assert.equal(Number((await app.pool.query('SELECT stock_cost FROM business_depots WHERE id=$1', [depot])).rows[0].stock_cost), 1000, 'unsold inventory is never income or a second expense');
  assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [owner.id])).rows[0].cash), baselineCash, 'loan principal was only funded into Depot; season operations move no money');
  const publicResult = await S.publicBusinessSeason(app.pool, season);
  assert.equal(publicResult.standings[0].operatingResultBand, 'positive');
  assert.equal(publicResult.standings[0].observedSaleDepletion, 'observed');
  for (const secret of [owner.id, owner.account, depot, supplier.id, customer.id, borrowed.id, result.baselineHash, 'operatingResult":', 'costOfGoodsSold']) assert.equal(JSON.stringify(publicResult).includes(secret), false, secret);
  await app.pool.query('UPDATE commercial_reputation_publications SET published=false WHERE account_id=$1', [owner.account]);
  assert.equal((await S.publicBusinessSeason(app.pool, season)).standings.length, 0);
  await app.pool.query('UPDATE commercial_reputation_publications SET published=true WHERE account_id=$1', [owner.account]);
  await single(owner, (ch, db) => S.setBusinessSeasonVisibility(ch, { seasonId: season, published: false, expectedRevision: 1 }, db));
  assert.equal((await S.publicBusinessSeason(app.pool, season)).standings.length, 0);
  const missing = (await make(owner, 'missing-baseline')).season.id;
  await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: missing }, db));
  await app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [missing, new Date(Date.now() - 120000), new Date(Date.now() - 1)]);
  assert.equal((await observe(owner, missing)).result.reason, 'missing_baseline');
  const partial = (await make(owner, 'partial-window')).season.id;
  await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: partial }, db));
  await app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [partial, new Date(Date.now() - 120000), new Date(Date.now() + 600000)]);
  await observe(owner, partial); await finishClock(partial);
  assert.equal((await observe(owner, partial)).result.coverage, 'partial');
  assert.equal((await S.publicBusinessSeason(app.pool, partial)).standings[0].ranked, false);
  const royaltyRows = [
    { reason: 'sale', cash_delta: 1960, stock_delta: -2, cost_delta: -1000, expense: 0, stock_after: 0 },
    { reason: 'royalty_expense', cash_delta: -196, stock_delta: 0, cost_delta: 0, expense: 196 },
    { reason: 'royalty_income', cash_delta: 100, stock_delta: 0, cost_delta: 0, expense: 0 },
  ];
  assert.equal(S.businessSeasonJournalResult(royaltyRows).operatingResult, 864, 'sale net and royalty fee count exactly once');
  assert.equal(S.businessSeasonJournalResult([{ reason: 'unknown', cash_delta: 100000, stock_delta: 0, cost_delta: 0, expense: 0 }]).known, false);
  await assert.rejects(S.dueBusinessSeasonEntries(app.pool, 26), /candidate_limit/);
  assert.equal((await S.businessSeasonBoard(app.pool, customer.account)).entries.length, 0);
  const sourceChanged = (await make(owner, 'source-mutated')).season.id;
  await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: sourceChanged }, db));
  await startClock(sourceChanged); await observe(owner, sourceChanged);
  const oldFund = (await app.pool.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='fund' ORDER BY id LIMIT 1", [depot])).rows[0].id;
  await app.pool.query('UPDATE business_depot_journal SET cash_delta=cash_delta+1 WHERE id=$1', [oldFund]);
  await finishClock(sourceChanged); assert.equal((await observe(owner, sourceChanged)).result.reason, 'source_changed');
  await app.pool.query('UPDATE business_depot_journal SET cash_delta=cash_delta - 1 WHERE id=$1', [oldFund]);
  if (native) {
    const cohort = (await make(owner, 'cohort-race')).season.id;
    await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: cohort }, db));
    const contenders = [];
    for (const p of [supplier, customer]) contenders.push({ player: p, depot: (await single(p, (ch, db, h) => D.openDepot(ch, terms, db, h))).id });
    const joins = await Promise.allSettled(contenders.map(p => single(p.player, (ch, db) => S.enrollBusinessSeason(ch, { seasonId: cohort, depotId: p.depot, published: true }, db))));
    assert.equal(joins.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(joins.filter(r => r.status === 'rejected' && /cohort_limit/.test(r.reason.message)).length, 1);
    await app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [cohort, new Date(Date.now() - 120000), new Date(Date.now() - 1)]);
    const rollback = (await make(owner, 'snapshot-rollback')).season.id;
    await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: rollback }, db));
    await startClock(rollback); await observe(owner, rollback); await finishClock(rollback);
    await assert.rejects(single(owner, (ch, db) => S.observeBusinessSeason(ch, rollback, { query: (sql, args) => {
      if (sql.startsWith('UPDATE business_season_entries SET end_snapshot')) throw new Error('injected snapshot failure'); return db.query(sql, args);
    } })), /injected/);
    assert.equal((await app.pool.query('SELECT final_result FROM business_season_entries WHERE season_id=$1', [rollback])).rows[0].final_result, null);
    assert.equal((await observe(owner, rollback)).phase, 'finished');
    const afterLock = (await make(owner, 'expired-while-locked')).season.id;
    await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: afterLock }, db));
    await app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [afterLock, new Date(Date.now() - 1000), new Date(Date.now() + 500)]);
    const blocker = await app.pool.connect(); await blocker.query('BEGIN');
    await blocker.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE', [depot]);
    const waiting = observe(owner, afterLock);
    try {
      let observed = false;
      for (let attempt = 0; attempt < 40; attempt++) {
        const rows = (await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT * FROM business_depots%' LIMIT 1")).rows;
        if (rows.length) { observed = true; break; } await new Promise(resolve => setTimeout(resolve, 5));
      }
      assert.equal(observed, true); await new Promise(resolve => setTimeout(resolve, 550));
      await blocker.query('COMMIT'); assert.equal((await waiting).result.reason, 'missing_baseline', 'fresh post-lock clock prohibits retroactive baseline');
    } finally { await blocker.query('ROLLBACK'); blocker.release(); }
  }
  const bounded = (await make(owner, 'bounded-source')).season.id;
  await single(owner, (ch, db) => S.enrollBusinessSeason(ch, { ...enrollment, seasonId: bounded }, db));
  await startClock(bounded);
  for (let index = 0; index < 1001; index++) await app.pool.query("INSERT INTO business_depot_journal(id,depot_id,reason) VALUES($1,$2,'fund')", [`season-limit-${index}`, depot]);
  assert.equal((await observe(owner, bounded)).baseline.reason, 'source_limit');
  await finishClock(bounded); assert.equal((await observe(owner, bounded)).result.known, false);
  console.log(`business seasons: canonical prospective net sales/COGS/fees, borrowed principal exclusion, unsold inventory exclusion, source baseline, explicit observed/partial/missed windows, private/coarse standings, revocation and metadata-only replay passed${native ? '; native concurrent snapshots and atomic rollback passed' : ''}`);
} finally { await app.close(); await app.pool.end(); }
