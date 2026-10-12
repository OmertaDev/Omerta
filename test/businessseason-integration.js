import assert from 'node:assert/strict';
const native = process.argv.includes('--postgres'); let serverVersion = 'memory';
assert(!process.env.DATABASE_URL, 'Season integration rejects ambient DATABASE_URL');
if (native) {
  const url = new URL(process.env.BUSINESS_SEASON_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert(['127.0.0.1', 'localhost'].includes(url.hostname));
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && url.password === '';
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Only owned local pilot or CI endpoint'); assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/business_season_proof_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href }); await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY'); serverVersion = (await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(serverVersion, local ? /^18\.4(?:[.\s]|$)/ : /^(?:16(?:[.\s]|$)|18\.4(?:[.\s]|$))/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0); await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', JWT_SECRET: 'business-season-api-isolated-secret', SOCIAL_VERIFY_MODE: 'off',
  DEPOT_PILOT: 'on', MARKET_SEED: 'business-season-api-seed', MOD_KEY: 'business-season-api-mod' });

const { buildServer } = await import('../src/server.js');
import * as G from '../src/game.js';
import * as D from '../src/depot.js';
import * as Market from '../src/market.js';
import * as Loans from '../src/loans.js';
import * as S from '../src/businessseasons.js';
import { buyGood } from '../src/economy.js';
import { LOAN } from '../src/rules.js';
import { runEstate } from '../src/social/estate.js';
const { runBusinessSeasons } = await import('../src/businessseasonrunner.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer(); let sequence = 0, requestSequence = 0;
const base = '/v1/company/seasons';
async function api(p, method, url, payload, key = `season-api-${++requestSequence}`, agent = false) {
  const r = await app.inject({ method, url, payload, headers: { ...(p ? { authorization: `Bearer ${agent ? p.agent : p.token}` } : {}), 'idempotency-key': key } });
  assert.equal(r.statusCode, 200, r.body); return r.json();
}
async function global() { assert.deepEqual((await runLedgerInvariants(app.pool, { alert: false })).checks.filter(c => !c.ok), []); }
if (!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
async function player() {
  const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const made = await app.inject({ method: 'POST', url: '/v1/character', payload: { name: `Season Player ${++sequence}` }, headers: { authorization: `Bearer ${token}` } });
  assert.equal(made.statusCode, 200, made.body);
  const account = JSON.parse(Buffer.from(token.split('.')[1], 'base64url')).sub;
  const row = (await app.pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [account])).rows[0];
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='docks',last_accrued_at=$2 WHERE id=$1", [row.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: row.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'crime:season-integration-fixture' });
  await api({ token }, 'POST', '/v1/resources/company', { expectedRevision: 0, name: `Season Company ${sequence}`, published: true, premises: null });
  await api({ token }, 'POST', '/v1/company/reputation', { expectedRevision: 0, published: true });
  const agent = (await api({ token }, 'POST', '/v1/auth/agent-key')).token;
  assert.equal(JSON.parse(Buffer.from(agent.split('.')[1], 'base64url')).agent, true);
  return { id: row.id, account, token, agent };
}
const single = (p, fn) => G.withCharacter(app.pool, p.account, fn);
const pair = (p, other, fn) => G.withTwoCharacters(app.pool, p.account, other.id, fn, { meet: false });
const terms = { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 };
const seasonTerms = { name: 'Realized Cash Season', enrollmentSeconds: 60, durationSeconds: 600, maxCompanies: 2 };
const make = (p, key, agent = true) => api(p, 'POST', base, seasonTerms, key, agent);
const observe = (p, season, agent = true) => api(p, 'POST', `${base}/${season}/observe`, {}, undefined, agent);
const enroll = (p, body) => api(p, 'POST', `${base}/enroll`, body, undefined, true);
const finishClock = season => app.pool.query('UPDATE business_seasons SET ends_at=$2 WHERE id=$1', [season, new Date(Date.now() - 1)]);
const startClock = season => app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [season, new Date(Date.now() - 1), new Date(Date.now() + 600000)]);
try {
  const owner = await player(), supplier = await player(), customer = await player();
  const depot = (await api(owner, 'POST', '/v1/depot', terms)).id;
  await api(owner, 'POST', `/v1/depot/${depot}/fund`, { amount: 10000 });
  const preOrder = await api(owner, 'POST', `/v1/depot/${depot}/restock`, {});
  await api(supplier, 'POST', '/v1/goods/buy', { goodId: 'gin', qty: 2 });
  await api(supplier, 'POST', `/v1/market/${preOrder.id}/fill`, { qty: 2 });
  await api(owner, 'POST', `/v1/depot/${depot}/orders/${preOrder.id}/receive`, {});
  const created = await make(owner, 'season-create'); const season = created.season.id;
  const replay = await make(owner, 'season-create', false); delete replay.replayed; assert.deepEqual(replay, created);
  const backfill = await app.inject({ method: 'POST', url: base, payload: { ...seasonTerms, startsAt: new Date().toISOString() }, headers: { authorization: `Bearer ${owner.agent}`, 'idempotency-key': 'backfill-api' } });
  assert.equal(backfill.statusCode, 400);
  assert.equal((await app.inject({ method: 'GET', url: base })).statusCode, 401);
  assert.equal((await app.inject({ method: 'POST', url: `${base}/${season}/observe`, payload: { timestamp: 'backfilled' }, headers: { authorization: `Bearer ${owner.token}` } })).statusCode, 400);
  const enrollment = { seasonId: season, depotId: depot, published: true };
  const enrolled = await enroll(owner, enrollment);
  assert.deepEqual(await enroll(owner, enrollment), enrolled);
  const foreignEnroll = await app.inject({ method: 'POST', url: `${base}/enroll`, payload: enrollment, headers: { authorization: `Bearer ${customer.agent}`, 'idempotency-key': 'foreign-enrollment' } });
  assert.equal(foreignEnroll.statusCode, 400); assert.match(foreignEnroll.body, /original_owner/);
  assert.equal((await observe(owner, season)).phase, 'waiting');
  await startClock(season);
  const baselines = native ? await Promise.all([observe(owner, season), observe(owner, season)]) : [await observe(owner, season)];
  assert.equal(baselines[0].phase, 'running');
  for (const baseline of baselines) assert.equal(baseline.baseline.sourceHash, baselines[0].baseline.sourceHash);
  const baselineCash = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [owner.id])).rows[0].cash);
  const borrowed = await single(supplier, (ch, db, h) => Loans.offerLoan(ch, { amount: LOAN.MIN, rate: 0.05, hours: Math.max(3, LOAN.TERM_MIN_H), to: owner.id }, db, h));
  await single(owner, (ch, db, h) => Loans.takeLoan(ch, borrowed.id, null, db, h));
  await api(owner, 'POST', `/v1/depot/${depot}/fund`, { amount: LOAN.MIN });
  await api(customer, 'POST', `/v1/depot/${depot}/buy`, { qty: 2, maxUnitPrice: 1000 });
  await app.pool.query("UPDATE business_depot_journal SET created_at=$2 WHERE depot_id=$1 AND reason='sale'", [depot, new Date(+new Date(baselines[0].baseline.observedAt) - 3600000)]);
  const freshOrder = await api(owner, 'POST', `/v1/depot/${depot}/restock`, {});
  await api(supplier, 'POST', '/v1/goods/buy', { goodId: 'gin', qty: 2 });
  await api(supplier, 'POST', `/v1/market/${freshOrder.id}/fill`, { qty: 2 });
  await api(owner, 'POST', `/v1/depot/${depot}/orders/${freshOrder.id}/receive`, {});
  await api(owner, 'POST', `/v1/depot/${depot}/withdraw`, { amount: 1000 });
  await api(owner, 'POST', `/v1/depot/${depot}/fund`, { amount: 1000 });
  await global();
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
  const publicResult = await api(null, 'GET', `${base}/public/${season}`);
  assert.equal(publicResult.standings[0].operatingResultBand, 'positive');
  assert.equal(publicResult.standings[0].observedSaleDepletion, 'observed');
  for (const secret of [owner.id, owner.account, depot, supplier.id, customer.id, borrowed.id, result.baselineHash, 'operatingResult":', 'costOfGoodsSold']) assert.equal(JSON.stringify(publicResult).includes(secret), false, secret);
  await api(owner, 'POST', '/v1/company/reputation', { expectedRevision: 1, published: false }, undefined, true);
  assert.equal((await api(null, 'GET', `${base}/public/${season}`)).standings.length, 0);
  await api(owner, 'POST', '/v1/company/reputation', { expectedRevision: 2, published: true }, undefined, false);
  await api(owner, 'POST', '/v1/resources/company', { expectedRevision: 1, name: 'Season Company Revoked', published: false, premises: null });
  assert.equal((await api(null, 'GET', `${base}/public/${season}`)).standings.length, 0);
  await api(owner, 'POST', '/v1/resources/company', { expectedRevision: 2, name: 'Season Company Restored', published: true, premises: null });
  await api(owner, 'POST', `${base}/visibility`, { seasonId: season, published: false, expectedRevision: 1 }, undefined, false);
  assert.equal((await S.publicBusinessSeason(app.pool, season)).standings.length, 0);
  const missing = (await make(owner, 'missing-baseline')).season.id;
  await enroll(owner, { ...enrollment, seasonId: missing });
  await app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [missing, new Date(Date.now() - 120000), new Date(Date.now() - 1)]);
  assert.equal((await observe(owner, missing)).result.reason, 'missing_baseline');
  const partial = (await make(owner, 'partial-window')).season.id;
  await enroll(owner, { ...enrollment, seasonId: partial });
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
  assert.equal((await api(customer, 'GET', base)).entries.length, 0);
  const sourceChanged = (await make(owner, 'source-mutated')).season.id;
  await enroll(owner, { ...enrollment, seasonId: sourceChanged });
  await startClock(sourceChanged); await observe(owner, sourceChanged);
  const oldFund = (await app.pool.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='fund' ORDER BY id LIMIT 1", [depot])).rows[0].id;
  await app.pool.query('UPDATE business_depot_journal SET cash_delta=cash_delta+1 WHERE id=$1', [oldFund]);
  await finishClock(sourceChanged); assert.equal((await observe(owner, sourceChanged)).result.reason, 'source_changed');
  await app.pool.query('UPDATE business_depot_journal SET cash_delta=cash_delta - 1 WHERE id=$1', [oldFund]);
  if (native) {
    const cohort = (await make(owner, 'cohort-race')).season.id;
    await enroll(owner, { ...enrollment, seasonId: cohort });
    const contenders = [];
    for (const p of [supplier, customer]) contenders.push({ player: p, depot: (await single(p, (ch, db, h) => D.openDepot(ch, terms, db, h))).id });
    const joins = await Promise.allSettled(contenders.map(p => single(p.player, (ch, db) => S.enrollBusinessSeason(ch, { seasonId: cohort, depotId: p.depot, published: true }, db))));
    assert.equal(joins.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(joins.filter(r => r.status === 'rejected' && /cohort_limit/.test(r.reason.message)).length, 1);
    await app.pool.query('UPDATE business_seasons SET starts_at=$2,ends_at=$3 WHERE id=$1', [cohort, new Date(Date.now() - 120000), new Date(Date.now() - 1)]);
    const rollback = (await make(owner, 'snapshot-rollback')).season.id;
    await enroll(owner, { ...enrollment, seasonId: rollback });
    await startClock(rollback); await observe(owner, rollback); await finishClock(rollback);
    const connect = app.pool.connect; let witnessed = 0;
    const wrap = client => {
      const query = client.query, release = client.release;
      client.query = async function(sql, ...args) {
        const result = await query.call(this, sql, ...args);
        if (typeof sql === 'string' && sql.startsWith('UPDATE business_season_entries SET end_snapshot')) { witnessed++; throw new Error('injected late snapshot failure'); }
        return result;
      };
      client.release = function(...args) { client.query = query; client.release = release; return release.apply(this, args); }; return client;
    };
    app.pool.connect = function(...args) {
      if (typeof args.at(-1) === 'function') { const cb = args.pop(); return connect.call(this, ...args, (error, client) => { if (error) return cb(error); const c = wrap(client); cb(null, c, c.release); }); }
      return connect.apply(this, args).then(wrap);
    };
    try { const failed = await app.inject({ method: 'POST', url: `${base}/${rollback}/observe`, payload: {}, headers: { authorization: `Bearer ${owner.agent}`, 'idempotency-key': 'snapshot-late-failure' } }); assert.equal(failed.statusCode, 500); }
    finally { app.pool.connect = connect; }
    assert.equal(witnessed, 1, 'Actual snapshot write preceded late route failure');
    const rolledBack = (await app.pool.query('SELECT final_result,end_snapshot FROM business_season_entries WHERE season_id=$1', [rollback])).rows[0];
    assert.deepEqual(rolledBack, { final_result: null, end_snapshot: null });
    assert.equal((await api(owner, 'POST', `${base}/${rollback}/observe`, {}, 'snapshot-late-failure', false)).phase, 'finished');
    const afterLock = (await make(owner, 'expired-while-locked')).season.id;
    await enroll(owner, { ...enrollment, seasonId: afterLock });
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
  await enroll(owner, { ...enrollment, seasonId: bounded });
  await startClock(bounded);
  for (let index = 0; index < 1001; index++) await app.pool.query("INSERT INTO business_depot_journal(id,depot_id,reason) VALUES($1,$2,'fund')", [`season-limit-${index}`, depot]);
  assert.equal((await observe(owner, bounded)).baseline.reason, 'source_limit');
  await finishClock(bounded); assert.equal((await observe(owner, bounded)).result.known, false);
  await app.pool.query("DELETE FROM business_depot_journal WHERE depot_id=$1 AND id LIKE 'season-limit-%'", [depot]);
  const terminal = (await make(owner, 'original-estate-close')).season.id;
  await enroll(owner, { ...enrollment, seasonId: terminal });
  await startClock(terminal); assert.equal((await observe(owner, terminal)).baseline.known, true);
  await finishClock(terminal);
  assert.equal((await S.dueBusinessSeasonEntries(app.pool, 25)).some(e => e.season_id === terminal), true);
  await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [owner.id]);
  assert.equal((await S.dueBusinessSeasonEntries(app.pool, 25)).some(e => e.account_id === owner.account), false, 'no-living account never occupies the dispatcher window');
  await app.pool.query('UPDATE characters SET alive=true WHERE id=$1', [owner.id]);
  const estate = await pair(customer, owner, (ch, target, db, h) => runEstate(db, h, target, 'business season canonical estate closure'));
  const prestige = Number((await app.pool.query('SELECT prestige FROM account_persistent WHERE account_id=$1', [owner.account])).rows[0].prestige);
  const heirCash = Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [estate.heirId])).rows[0].cash);
  assert.equal(heirCash, 500 + 100 * prestige, 'No season award or extra inherited cash');
  const heir = (await app.pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [owner.account])).rows[0];
  assert(heir); assert.notEqual(heir.id, owner.id);
  assert.equal((await S.dueBusinessSeasonEntries(app.pool, 25)).some(e => e.season_id === terminal), true, 'same original-account heir is eligible only to observe historical source');
  const terminalResult = await observe({ ...owner, id: heir.id }, terminal);
  assert.equal(terminalResult.result.known, false); assert.equal(terminalResult.result.reason, 'source_identity');
  assert.equal((await app.pool.query('SELECT status FROM business_depots WHERE id=$1', [depot])).rows[0].status, 'closed');
  // Real finite dispatcher snapshots; changes below race after candidate selection.
  const postpone = () => app.pool.query('UPDATE business_season_entries SET next_observation_at=$1 WHERE final_result IS NULL', [new Date(Date.now() + 3600000)]);
  async function workerFixture(key) {
    const p = await player(), d = await api(p, 'POST', '/v1/depot', terms);
    const id = (await make(p, key)).season.id;
    await enroll(p, { seasonId: id, depotId: d.id, published: true }); await startClock(id);
    return { p, id, depot: d.id };
  }
  async function afterCandidates(fn, limit = 25) {
    const query = app.pool.query; let fired = false;
    app.pool.query = async function(sql, ...args) {
      const result = await query.call(this, sql, ...args);
      if (!fired && typeof sql === 'string' && sql.startsWith('SELECT e.season_id,e.account_id,e.original_character')) { fired = true; await fn(result.rows); }
      return result;
    };
    try { const result = await runBusinessSeasons(app.pool, limit); assert.equal(fired, true); return result; }
    finally { app.pool.query = query; }
  }
  await postpone();
  const bad = await workerFixture('worker-first-stale'), later = await workerFixture('worker-later-good');
  await app.pool.query('UPDATE business_season_entries SET next_observation_at=$2 WHERE season_id=$1', [bad.id, new Date(Date.now() - 100000)]);
  await app.pool.query('UPDATE business_season_entries SET next_observation_at=$2 WHERE season_id=$1', [later.id, new Date(Date.now() - 50000)]);
  const beforeWorkers = (await app.pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows;
  const fair = await afterCandidates(async rows => { assert.equal(rows[0].season_id, bad.id); await app.pool.query('UPDATE characters SET alive=false WHERE id=$1', [bad.p.id]); }, 2);
  assert.equal(fair.candidates, 2); assert(fair.results[0].skipped); assert.equal(fair.results[1].phase, 'running');
  const retryRow = (await app.pool.query('SELECT next_observation_at,baseline FROM business_season_entries WHERE season_id=$1', [bad.id])).rows[0];
  assert.equal(retryRow.baseline, null); assert(+new Date(retryRow.next_observation_at) > Date.now() + 20000);
  await app.pool.query('UPDATE characters SET alive=true WHERE id=$1', [bad.p.id]);
  assert.deepEqual((await app.pool.query('SELECT id,cash,bank FROM characters ORDER BY id')).rows, beforeWorkers, 'Worker has no money or prizes');
  assert.equal((await runBusinessSeasons(app.pool, 2)).candidates, 0, 'Failed original candidate yields queue until finite retry');
  await app.pool.query('UPDATE business_season_entries SET next_observation_at=$2 WHERE season_id=$1', [bad.id, new Date(Date.now() - 1)]);
  assert.equal((await runBusinessSeasons(app.pool, 2)).results[0].phase, 'running');
  await postpone(); const rev = await workerFixture('worker-revision-cas');
  const revStamp = (await app.pool.query('SELECT next_observation_at FROM business_season_entries WHERE season_id=$1', [rev.id])).rows[0].next_observation_at;
  const revised = await afterCandidates(async () => { await api(rev.p, 'POST', `${base}/visibility`, { seasonId: rev.id, published: false, expectedRevision: 1 }, undefined, false); });
  assert.equal(revised.results[0].phase, 'running');
  const revRow = (await app.pool.query('SELECT visibility_revision,next_observation_at FROM business_season_entries WHERE season_id=$1', [rev.id])).rows[0];
  assert.equal(Number(revRow.visibility_revision), 2); assert.equal(+new Date(revRow.next_observation_at), +new Date(revStamp), 'Stale revision cannot reschedule current consent');
  await postpone(); const final = await workerFixture('worker-final-cas'); await observe(final.p, final.id); await finishClock(final.id);
  const finalStamp = (await app.pool.query('SELECT next_observation_at FROM business_season_entries WHERE season_id=$1', [final.id])).rows[0].next_observation_at;
  let finalProof; const finished = await afterCandidates(async () => { finalProof = await observe(final.p, final.id); });
  assert.equal(finished.results[0].phase, 'finished');
  const finalRow = (await app.pool.query('SELECT final_result,next_observation_at FROM business_season_entries WHERE season_id=$1', [final.id])).rows[0];
  assert.deepEqual(finalRow.final_result, finalProof.result); assert.equal(+new Date(finalRow.next_observation_at), +new Date(finalStamp), 'Final-result CAS prevents scheduling a finished source');
  assert.equal((await runBusinessSeasons(app.pool, 25)).candidates, 0);
  const stampRace = await workerFixture('worker-stamp-cas'), movedStamp = new Date(Date.now() + 7200000);
  await afterCandidates(async () => { await app.pool.query('UPDATE business_season_entries SET next_observation_at=$2 WHERE season_id=$1', [stampRace.id, movedStamp]); });
  assert.equal(+new Date((await app.pool.query('SELECT next_observation_at FROM business_season_entries WHERE season_id=$1', [stampRace.id])).rows[0].next_observation_at), +movedStamp, 'Stale original scheduling stamp cannot replace newer scheduling');
  if (native) {
    // This prospective window uses real server-generated clocks, no fixture acceleration.
    await postpone(); const realOwner = await player(), realSupplier = await player(), realBuyer = await player();
    const realDepot = (await api(realOwner, 'POST', '/v1/depot', terms)).id;
    await api(realOwner, 'POST', `/v1/depot/${realDepot}/fund`, { amount: 10000 });
    const realOrder = await api(realOwner, 'POST', `/v1/depot/${realDepot}/restock`, {});
    await api(realSupplier, 'POST', '/v1/goods/buy', { goodId: 'gin', qty: 2 });
    await api(realSupplier, 'POST', `/v1/market/${realOrder.id}/fill`, { qty: 2 });
    await api(realOwner, 'POST', `/v1/depot/${realDepot}/orders/${realOrder.id}/receive`, {});
    const real = await api(realOwner, 'POST', base, { ...seasonTerms, durationSeconds: 60 }, 'real-clock-window', false);
    const realId = real.season.id; await enroll(realOwner, { seasonId: realId, depotId: realDepot, published: true });
    assert.equal((await observe(realOwner, realId, false)).phase, 'waiting');
    console.log('Native prospective clock proof: waiting for canonical60s enrollment then60s observed trading window');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, +new Date(real.season.enrollmentClosesAt) - Date.now() + 100)));
    assert.equal((await runBusinessSeasons(app.pool, 25)).results.find(r => r.seasonId === realId).phase, 'running');
    await api(realBuyer, 'POST', `/v1/depot/${realDepot}/buy`, { qty: 2, maxUnitPrice: 1000 });
    await api(realOwner, 'POST', `/v1/depot/${realDepot}/withdraw`, { amount: 1000 });
    await api(realOwner, 'POST', `/v1/depot/${realDepot}/fund`, { amount: 1000 });
    await global(); console.log('Native prospective clock proof: canonical in-window sale complete; waiting for canonical end');
    await new Promise(resolve => setTimeout(resolve, Math.max(0, +new Date(real.season.endsAt) - Date.now() + 100)));
    assert.equal((await runBusinessSeasons(app.pool, 25)).results.find(r => r.seasonId === realId).phase, 'finished');
    const realized = (await api(realOwner, 'GET', base)).entries.find(e => e.season.id === realId).result;
    assert.equal(realized.known, true); assert.equal(realized.coverage, 'observed'); assert.equal(realized.operatingResult, 960);
    assert.equal(realized.expenses, 0); assert.equal(realized.costOfGoodsSold, 1000);
    assert.equal((await api(null, 'GET', `${base}/public/${realId}`)).standings[0].operatingResultBand, 'positive');
    console.log('Native prospective clock proof: unmodified canonical start/end clocks, worker baseline/final and actual realized sale PASS');
  }
  await global();
  console.log(`business seasons integrated API: canonical prospective net sales/COGS/fees, borrowed principal exclusion, unsold inventory exclusion, source baseline, explicit observed/partial/missed windows, private/coarse standings, revocation and metadata-only replay; finite worker fairness/retry/revision/final/stamp CAS passed${native ? '; native concurrent snapshots and atomic rollback passed' : ''}`);
} finally { await app.close(); await app.pool.end(); }
