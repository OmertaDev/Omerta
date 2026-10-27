// THE WORKER-SWEEP SUITE — the nightly jobs that reap, refund and reconcile, and the property every
// one of them CLAIMS in a comment but almost none proves: running it a second time changes nothing.
//
// The worker fans out to ~35 sweeps a tick. Each is meant to be idempotent (a poison row is skipped
// and caught up next run — src/worker.js:236), but until this file eight of them had ZERO test
// coverage at all: sweepDiplomacy, sweepRivals, sweepSocialClaims, sweepStaleRaids, and the two that
// reconcile REAL-MONEY entitlements — sweepUncreditedFees / sweepUncreditedStore. A reconcile that
// double-grants, or a housekeeping DELETE that throws on an empty table, fails at 3am into a log
// nobody reads. `chaos.js` interrupts a subset on real Postgres; this proves the base properties on
// pg-mem, in-process, in `npm test`, for EVERY sweep the worker calls.
//
// Two things are asserted here that a per-feature suite structurally can't:
//   (1) NO SWEEP CRASHES on an empty database, and RUNNING IT TWICE is a clean no-op — swept once,
//       the second pass reaps nothing. The generic loop below covers all ~35 at once, so a new sweep
//       that forgets `IF EXISTS` / a NULL guard / a `rowCount || 0` return trips here.
//   (2) The eight previously-untested sweeps do their JOB (reap the due row, leave the fresh one),
//       and the two reconcile sweeps are IDEMPOTENT AT THE MONEY LAYER — a second run grants nothing
//       and never burns a second credit.
import assert from 'node:assert';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import { M4, RIVALS } from '../src/rules.js';

// every sweep the worker actually calls, with the module it lives in. Kept in step with
// src/worker.js's imports — a new sweep added there without a line here is the gap this file exists
// to close, and `test/docs.js`/the reader could later assert the two lists agree.
import { sweepDiplomacy } from '../src/diplomacy.js';
import { sweepRivals } from '../src/rivals.js';
import { capoBoard, sweepCapoLicense, sweepSocialClaims } from '../src/growth.js';
import { sweepGrandReferrals } from '../src/game.js';
import { sweepStaleRaids, sweepUprisings } from '../src/world.js';
import { sweepUncreditedFees } from '../src/fees.js';
import { sweepUncreditedStore } from '../src/store.js';
import { sweepMarket } from '../src/market.js';
import { sweepLoans } from '../src/loans.js';
import { sweepAuctions, sweepConsignments } from '../src/auction.js';
import { sweepLaw } from '../src/law.js';
import { sweepFavors } from '../src/favors.js';
import { sweepSecrets } from '../src/secrets.js';
import { sweepCalls, generateContactCalls } from '../src/contacts.js';
import { sweepConvoyHauls } from '../src/convoy.js';
import { sweepWire, sweepWireAlerts, sweepStandingWatches } from '../src/wire.js';
import { sweepStaleHeists } from '../src/heists.js';
import { sweepStaleBreaks } from '../src/pen.js';
import { sweepPassStipends } from '../src/pass.js';
import { sweepMainEvents } from '../src/boxing.js';
import { sweepTournaments, sweepTrackEntries, sweepFuturity } from '../src/casino.js';
import { sweepRingTables } from '../src/ring.js';
import { sweepGrandPrix } from '../src/races.js';
import { sweepStakes } from '../src/stable.js';
import { sweepExpiredBounties, sweepContests, huntWanted } from '../src/social.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { migrateSocialProofReceipts } from '../src/db.js';
import { takeAccountDailyClaims } from '../src/accountdaily.js';

const app = await buildServer();
const pool = app.pool;
const call = async (method, url, { token, body } = {}) => {
  const res = await app.inject({ method, url, headers: token ? { authorization: `Bearer ${token}` } : {}, payload: body });
  return { code: res.statusCode, body: res.json() };
};
const meOf = async (t) => (await call('GET', '/v1/me', { token: t })).body.character;
const mk = async (name) => {
  const { body: { token } } = await call('POST', '/v1/auth/guest');
  await call('POST', '/v1/character', { token, body: { name } });
  const c = await meOf(token);
  return { token, id: c.id, acct: c.account_id };
};
const acctOf = async (chId) => (await pool.query("SELECT account_id FROM characters WHERE id=$1", [chId])).rows[0].account_id;
const noDrift = async (label) => {
  const r = await runLedgerInvariants(pool, { alert: false });
  const bad = r.checks.filter((c) => !c.ok);
  assert.equal(bad.length, 0, `${label}: §10.4 drift — ${bad.map((c) => c.name).join(', ')}`);
};

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (1) EVERY SWEEP: no crash on an empty DB, and running it twice is a clean no-op.
//
// This is the property ~35 comments claim and none proved. A sweep that throws on an empty table,
// or that isn't safe to re-run, fails HERE rather than at 3am. Each is called with the pool exactly
// as src/worker.js calls it. A couple carry a partner the worker pairs them with (generateContactCalls
// before sweepCalls) — included so the pairing itself is exercised.
const ALL_SWEEPS = [
  ['sweepDiplomacy', () => sweepDiplomacy(pool)],
  ['sweepRivals', () => sweepRivals(pool)],
  ['sweepSocialClaims', () => sweepSocialClaims(pool)],
  ['sweepCapoLicense', () => sweepCapoLicense(pool)],
  ['sweepGrandReferrals', () => sweepGrandReferrals(pool)],
  ['sweepStaleRaids', () => sweepStaleRaids(pool)],
  ['sweepUprisings', () => sweepUprisings(pool)],
  ['sweepUncreditedFees', () => sweepUncreditedFees(pool)],
  ['sweepUncreditedStore', () => sweepUncreditedStore(pool)],
  ['sweepMarket', () => sweepMarket(pool)],
  ['sweepLoans', () => sweepLoans(pool)],
  ['sweepAuctions', () => sweepAuctions(pool)],
  ['sweepConsignments', () => sweepConsignments(pool)],
  ['sweepLaw', () => sweepLaw(pool)],
  ['sweepFavors', () => sweepFavors(pool)],
  ['sweepSecrets', () => sweepSecrets(pool)],
  ['generateContactCalls', () => generateContactCalls(pool)],
  ['sweepCalls', () => sweepCalls(pool)],
  ['sweepConvoyHauls', () => sweepConvoyHauls(pool)],
  ['sweepWire', () => sweepWire(pool)],
  ['sweepWireAlerts', () => sweepWireAlerts(pool)],
  ['sweepStandingWatches', () => sweepStandingWatches(pool)],
  ['sweepStaleHeists', () => sweepStaleHeists(pool)],
  ['sweepStaleBreaks', () => sweepStaleBreaks(pool)],
  ['sweepPassStipends', () => sweepPassStipends(pool)],
  ['sweepMainEvents', () => sweepMainEvents(pool)],
  ['sweepTournaments', () => sweepTournaments(pool)],
  ['sweepTrackEntries', () => sweepTrackEntries(pool)],
  ['sweepFuturity', () => sweepFuturity(pool)],
  ['sweepRingTables', () => sweepRingTables(pool)],
  ['sweepGrandPrix', () => sweepGrandPrix(pool)],
  ['sweepStakes', () => sweepStakes(pool)],
  ['sweepExpiredBounties', () => sweepExpiredBounties(pool)],
  ['sweepContests', () => sweepContests(pool)],
  ['huntWanted', () => huntWanted(pool)],
];
for (const [name, run] of ALL_SWEEPS) {
  await run();          // must not throw on an empty database
  await run();          // must be safe to run again immediately
}
await noDrift('after an empty-DB double-sweep of every worker job');
console.log(`✅ all ${ALL_SWEEPS.length} worker sweeps run clean on an empty DB and are safe to re-run`);

// ─────────────────────────────────────────────────────────────────────────────────────────────
// (2) sweepDiplomacy — expired coalitions and their member rows are deleted; a live one survives.
{
  const now = Date.now();
  await pool.query("INSERT INTO coalitions (id, target_gang, formed_by, expires_at) VALUES ('coa-dead','tgt','g1', $1)", [new Date(now - 1000)]);
  await pool.query("INSERT INTO coalition_members (coalition_id, gang_id) VALUES ('coa-dead','g2')");
  await pool.query("INSERT INTO coalitions (id, target_gang, formed_by, expires_at) VALUES ('coa-live','tgt','g1', $1)", [new Date(now + 3600000)]);
  await pool.query("INSERT INTO coalition_members (coalition_id, gang_id) VALUES ('coa-live','g3')");
  await sweepDiplomacy(pool);
  assert.equal((await pool.query("SELECT 1 FROM coalitions WHERE id='coa-dead'")).rowCount, 0, 'expired coalition reaped');
  assert.equal((await pool.query("SELECT 1 FROM coalition_members WHERE coalition_id='coa-dead'")).rowCount, 0, 'its members reaped');
  assert.equal((await pool.query("SELECT 1 FROM coalitions WHERE id='coa-live'")).rowCount, 1, 'the live coalition survives');
  await sweepDiplomacy(pool);   // idempotent
  assert.equal((await pool.query("SELECT 1 FROM coalitions WHERE id='coa-live'")).rowCount, 1, 'a second sweep leaves the live one alone');
  console.log('✅ sweepDiplomacy reaps expired coalitions + members, keeps the live one, idempotent');
}

// (3) sweepRivals — a rival event past the retention window is dropped; a fresh one is kept.
{
  const old = new Date(Date.now() - (RIVALS.RETENTION_D + 1) * 86400000);
  const fresh = new Date(Date.now() - 3600000);
  await pool.query("INSERT INTO rival_events (id, victim_account, aggressor_account, kind, at) VALUES ($1,$2,$3,'jump',$4)",
    [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), old]);
  await pool.query("INSERT INTO rival_events (id, victim_account, aggressor_account, kind, at) VALUES ($1,$2,$3,'jump',$4)",
    [crypto.randomUUID(), crypto.randomUUID(), crypto.randomUUID(), fresh]);
  const r = await sweepRivals(pool);
  assert.equal(r.swept, 1, 'exactly the stale grudge is swept');
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM rival_events")).rows[0].n, 1, 'the fresh grudge is kept');
  assert.equal((await sweepRivals(pool)).swept, 0, 'a second sweep reaps nothing');
  console.log('✅ sweepRivals drops grudges past the retention window, keeps fresh ones, idempotent');
}

// (4) sweepSocialClaims — a long-paid claim and a lapsed unpaid registration are dropped; a fresh one stays.
{
  const acc = 'sc-acct';
  const oldPaid = new Date(Date.now() - 8 * 86400000);
  const oldPending = new Date(Date.now() - 3 * 86400000);   // > 48h SOCIAL_PENDING_TTL
  const fresh = new Date(Date.now() - 3600000);
  await pool.query("INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 1, 'sw_post', $2, true)", [acc, oldPaid]);
  await pool.query("INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof) VALUES ($1, 4, 'sw_post', $2, true, $3)",
    [acc, oldPaid, 'https://twitter.com/legacy/statuses/12345678909999']);
  await pool.query("INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof) VALUES ($1, 5, 'sw_post', $2, true, $3)",
    [acc, oldPaid, 'legacy trust prose']);
  await pool.query("INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 2, 'sw_invite', $2, false)", [acc, oldPending]);
  await pool.query("INSERT INTO social_claims (account_id, day, task_id, posted_at, paid) VALUES ($1, 3, 'sw_boost', $2, false)", [acc, fresh]);
  const r = await sweepSocialClaims(pool);
  assert.equal(r.swept, 4, 'spent paid rows and the lapsed pending row are dropped');
  assert.equal((await pool.query("SELECT COUNT(*)::int n FROM social_claims WHERE account_id=$1", [acc])).rows[0].n, 1, 'the fresh registration survives');
  assert.equal(Number((await pool.query(
    `SELECT COUNT(*) n FROM account_daily_claims
      WHERE account_id='social-proof:x:12345678909999' AND day=0
        AND scope='social-proof' AND claim_id='used'`)).rows[0].n), 1,
  'the paid canonical proof is permanently receipted before its row is deleted');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_daily_claims WHERE account_id='social-proof:x:legacy trust prose'"
  )).rows[0].n), 0, 'malformed predecessor trust prose never becomes a synthetic X receipt');
  assert.equal((await sweepSocialClaims(pool)).swept, 0, 'idempotent');

  const rollbackProof = 'https://x.com/legacy/status/12345678910000';
  await pool.query("INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof) VALUES ($1, 6, 'sw_post', $2, true, $3)",
    [acc, oldPaid, rollbackProof]);
  const failingPool = { connect: async () => {
    const client = await pool.connect();
    return {
      query: async (sql, params) => {
        if (/DELETE FROM social_claims/.test(String(sql))) throw new Error('injected post-receipt failure');
        return client.query(sql, params);
      },
      release: () => client.release(),
    };
  } };
  await assert.rejects(sweepSocialClaims(failingPool), /injected post-receipt failure/,
    'a post-receipt failure aborts the sweep');
  assert.equal((await pool.query(
    'SELECT COUNT(*)::int n FROM social_claims WHERE account_id=$1 AND day=6 AND task_id=$2',
    [acc, 'sw_post'])).rows[0].n, 1, 'failure never deletes the paid evidence');
  // pg-mem retains the just-inserted receipt across ROLLBACK; PostgreSQL rolls it back. Both states
  // are conservative and retry-safe, so this portable suite asserts only evidence retention/recovery.
  assert.equal((await sweepSocialClaims(pool)).swept, 1, 'the retained row is recoverable on the next sweep');

  for (let i = 0; i < 3; i++) {
    await pool.query(
      `INSERT INTO social_claims (account_id, day, task_id, posted_at, paid, proof)
       VALUES ($1,$2,'sw_post',$3,true,$4),($5,$6,'sw_invite',$7,false,NULL)`,
      [`page-paid-${i}`, 20 + i, oldPaid, `https://x.com/legacy/status/${12345678920000 + i}`,
        `page-pending-${i}`, 30 + i, oldPending]);
  }
  const page = await sweepSocialClaims(pool, { batchSize: 1, maxBatches: 1 });
  assert.deepEqual([page.swept, page.batches, page.more], [2, 1, true],
    'one bounded cycle advances one paid and one pending page without starvation');
  assert.equal((await sweepSocialClaims(pool, { batchSize: 1, maxBatches: 5 })).swept, 4,
    'later cycles resume and exhaust both backlogs');

  // A rolling boot can overlap this worker sweep. Feed the two paths inverse evidence order and
  // prove they still acquire every overlapping synthetic receipt PK in the same global order.
  const proofs = [
    'https://x.com/legacy/status/99999999999999',
    'https://x.com/legacy/status/11111111111111',
    'https://twitter.com/legacy/statuses/99999999999999',
  ];
  const migrationOrder = [];
  const migrationClient = { query: async (sql, params = []) => {
    const text = String(sql);
    if (/SELECT 1 FROM economy_migrations/.test(text)) return { rowCount: 1, rows: [{}] };
    if (/AS cutoff_at/.test(text))
      return { rowCount: 1, rows: [{ cutoff_at: new Date() }] };
    if (/SELECT id FROM economy_migrations/.test(text)) return { rowCount: 0, rows: [] };
    if (/AS cursor_posted_at/.test(text))
      return { rowCount: proofs.length, rows: proofs.map((proof) => ({ proof })) };
    if (/INSERT INTO account_daily_claims/.test(text)) {
      migrationOrder.push(...params.filter((_, index) => index % 4 === 0));
      return { rowCount: migrationOrder.length, rows: [] };
    }
    if (/^(?:BEGIN|COMMIT|ROLLBACK)$/.test(text)
        || /(?:INSERT INTO|DELETE FROM) economy_migrations/.test(text))
      return { rowCount: 0, rows: [] };
    throw new Error(`unexpected migration lock-order query: ${text}`);
  } };
  await migrateSocialProofReceipts(migrationClient, { maxBatches: 1 });

  const sweepOrder = [];
  const sweepClient = { query: async (sql, params = []) => {
    const text = String(sql);
    if (/SELECT account_id, day, task_id, proof FROM social_claims/.test(text)) return {
      rowCount: proofs.length,
      rows: proofs.map((proof, index) => ({ account_id: `acct-${index}`, day: index, task_id: 'sw_post', proof })),
    };
    if (/SELECT account_id, day, task_id FROM social_claims/.test(text)) return { rowCount: 0, rows: [] };
    if (/INSERT INTO account_daily_claims/.test(text)) {
      sweepOrder.push(...params.filter((_, index) => index % 4 === 0));
      return { rowCount: sweepOrder.length, rows: [] };
    }
    if (/DELETE FROM social_claims/.test(text)) return { rowCount: proofs.length, rows: [] };
    if (/^(?:BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rowCount: 0, rows: [] };
    throw new Error(`unexpected sweep lock-order query: ${text}`);
  }, release() {} };
  await sweepSocialClaims({ connect: async () => sweepClient });
  const canonicalOrder = [
    'social-proof:x:11111111111111',
    'social-proof:x:99999999999999',
  ];
  assert.deepEqual(migrationOrder, canonicalOrder, 'boot repair acquires deduplicated receipt PKs canonically');
  assert.deepEqual(sweepOrder, canonicalOrder, 'worker sweep uses the identical receipt PK lock order');
  let oversizedQuery = false;
  await assert.rejects(takeAccountDailyClaims({ query: async () => { oversizedQuery = true; } },
    Array.from({ length: 1001 }, (_, index) => `social-proof:x:${10000000000000 + index}`),
    0, 'social-proof', 'used'), /exceeds 1000/);
  assert.equal(oversizedQuery, false, 'the bulk helper refuses an unbounded SQL parameter fan-out');
  console.log('✅ sweepSocialClaims drops spent/lapsed rows, keeps live registrations, idempotent');
}

// (5) sweepStaleRaids — a stale co-op world-raid PLAN and its crew rows are cleared; a fresh plan is kept.
{
  const oldPlan = new Date(Date.now() - 6 * 3600000);   // past COOP_TTL_MS (1h)
  await pool.query("INSERT INTO world_raids (id, npc_id, leader_character, status, created_at) VALUES ('wr-stale','volkov','ch-x','planning',$1)", [oldPlan]);
  await pool.query("INSERT INTO world_raid_members (raid_id, character_id) VALUES ('wr-stale','ch-x')");
  await pool.query("INSERT INTO world_raids (id, npc_id, leader_character, status, created_at) VALUES ('wr-fresh','volkov','ch-y','planning',now())");
  await sweepStaleRaids(pool);
  assert.equal((await pool.query("SELECT status FROM world_raids WHERE id='wr-stale'")).rows[0]?.status !== 'planning', true, 'the stale plan is no longer open');
  assert.equal((await pool.query("SELECT status FROM world_raids WHERE id='wr-fresh'")).rows[0].status, 'planning', 'the fresh plan survives');
  await sweepStaleRaids(pool);   // idempotent
  assert.equal((await pool.query("SELECT status FROM world_raids WHERE id='wr-fresh'")).rows[0].status, 'planning', 'a second sweep leaves the fresh plan');
  console.log('✅ sweepStaleRaids clears stale co-op raid plans, keeps fresh ones, idempotent');
}

// (6) sweepUncreditedFees — a pay-BEFORE-link mint fee is granted at the sweep, EXACTLY ONCE.
// This is the real-money reconcile path: the row waits (account_id NULL) until the wallet links,
// then the sweep discovers it by the linked address and grants the entitlement. The idempotency here
// is a MONEY property — a second run must not mint a second credit.
{
  const player = await mk('Fee Payer');
  const acct = await acctOf(player.id);
  const addr = '0x' + crypto.randomBytes(20).toString('hex');
  await pool.query("UPDATE account_persistent SET wallet_address=$1 WHERE account_id=$2", [addr, acct]);
  const before = Number((await pool.query("SELECT mint_credits FROM account_persistent WHERE account_id=$1", [acct])).rows[0].mint_credits);
  await pool.query("INSERT INTO fee_payments (nonce, kind, payer_address, amount_wei, credited) VALUES (900001, 'mint', $1, '10000000000000000', false)", [addr]);
  const r = await sweepUncreditedFees(pool);
  assert.equal(r.credited, 1, 'the parked fee is credited at the sweep');
  const after = Number((await pool.query("SELECT mint_credits FROM account_persistent WHERE account_id=$1", [acct])).rows[0].mint_credits);
  assert.equal(after, before + 1, 'exactly one mint credit granted');
  assert.equal((await pool.query("SELECT credited FROM fee_payments WHERE nonce=900001")).rows[0].credited, true, 'the row is flagged credited');
  const r2 = await sweepUncreditedFees(pool);
  assert.equal(r2.credited, 0, 'a second sweep grants nothing');
  const after2 = Number((await pool.query("SELECT mint_credits FROM account_persistent WHERE account_id=$1", [acct])).rows[0].mint_credits);
  assert.equal(after2, after, 'no second mint credit — idempotent at the money layer');
  await noDrift('after a fee reconcile');
  console.log('✅ sweepUncreditedFees grants a parked fee exactly once; a re-run mints nothing');
}

// (7) sweepUncreditedStore — the Store twin: a pay-before-link package grants exactly once.
{
  const player = await mk('Store Payer');
  const acct = await acctOf(player.id);
  const addr = '0x' + crypto.randomBytes(20).toString('hex');
  await pool.query("UPDATE account_persistent SET wallet_address=$1 WHERE account_id=$2", [addr, acct]);
  const before = Number((await pool.query("SELECT mint_credits FROM account_persistent WHERE account_id=$1", [acct])).rows[0].mint_credits);
  await pool.query("INSERT INTO store_payments (nonce, sku, payer_address, amount_wei, granted) VALUES (900002, 'made_man', $1, '10000000000000000', false)", [addr]);
  const r = await sweepUncreditedStore(pool);
  assert.equal(r.granted, 1, 'the parked package is granted at the sweep');
  const after = Number((await pool.query("SELECT mint_credits FROM account_persistent WHERE account_id=$1", [acct])).rows[0].mint_credits);
  assert.equal(after, before + 1, 'the made_man SKU granted its mint credit');
  assert.equal((await pool.query("SELECT granted FROM store_payments WHERE nonce=900002")).rows[0].granted, true, 'the row is flagged granted');
  const r2 = await sweepUncreditedStore(pool);
  assert.equal(r2.granted, 0, 'a second sweep grants nothing');
  assert.equal(Number((await pool.query("SELECT mint_credits FROM account_persistent WHERE account_id=$1", [acct])).rows[0].mint_credits), after, 'idempotent at the money layer');
  await noDrift('after a store reconcile');
  console.log('✅ sweepUncreditedStore grants a parked package exactly once; a re-run grants nothing');
}

// (8) sweepCapoLicense — bounded pages persist their high-water cursor and eventually wrap.
{
  await pool.query('UPDATE account_persistent SET agent_flag=false');
  const values = [], params = [];
  for (let i = 0; i < 5; i++) {
    const n = params.length;
    values.push(`($${n + 1},true,$${n + 2})`);
    params.push(`sweep-capo-${String(i).padStart(4, '0')}`, 1);
  }
  await pool.query(
    `INSERT INTO account_persistent (account_id, agent_flag, capo_recruits) VALUES ${values.join(',')}`,
    params,
  );
  const first = await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 });
  assert.deepEqual({ updated: first.updated, processed: first.processed, pages: first.pages, hasMore: first.hasMore },
    { updated: 2, processed: 2, pages: 1, hasMore: true }, 'one invocation obeys its page budget');
  const saved = (await pool.query(
    "SELECT after_key, upper_key FROM worker_sweep_cursors WHERE sweep_key='capo-license'")).rows[0];
  assert.equal(saved.after_key, 'sweep-capo-0001', 'the committed cursor identifies the last processed agent');
  assert.equal(saved.upper_key, 'sweep-capo-0004', 'the cycle keeps its captured high-water mark');
  await pool.query(
    `INSERT INTO account_persistent (account_id,agent_flag,capo_recruits) VALUES
       ('sweep-capo-0000a',true,1),('sweep-capo-9999',true,1)`);
  assert.equal((await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 })).updated, 2,
    'a new process resumes after the persisted cursor');
  const finish = await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 });
  assert.deepEqual({ updated: finish.updated, processed: finish.processed, hasMore: finish.hasMore, wrapped: finish.wrapped },
    { updated: 1, processed: 1, hasMore: false, wrapped: true }, 'the captured cycle finishes and wraps');
  assert.equal(Number((await pool.query(
    "SELECT capo_recruits FROM account_persistent WHERE account_id='sweep-capo-9999'"
  )).rows[0].capo_recruits), 1, 'an agent beyond the high-water mark waits for the next cycle');
  assert.equal(Number((await pool.query(
    "SELECT capo_recruits FROM account_persistent WHERE account_id='sweep-capo-0000a'"
  )).rows[0].capo_recruits), 1, 'an insert behind the committed cursor also waits for the next cycle');
  await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 });
  await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 });
  await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 });
  await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 });
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_persistent WHERE account_id LIKE 'sweep-capo-%' AND capo_recruits=0",
  )).rows[0].n), 7, 'the next bounded cycle reaches inserts above and behind the old cursor');

  // Recruit fan-out is aggregated inside the database. The query binds only the bounded agent page,
  // so even more than PostgreSQL's 65k parameter ceiling of recruits cannot overflow a bind list.
  await pool.query('UPDATE account_persistent SET agent_flag=false');
  const captain = await mk('Capo Chunk Captain');
  const captainAccount = await acctOf(captain.id);
  await pool.query('UPDATE account_persistent SET agent_flag=true, capo_recruits=99 WHERE account_id=$1', [captainAccount]);
  for (let i = 0; i < 5; i++) {
    const recruit = await mk(`Capo Chunk Recruit ${i}`);
    const recruitAccount = await acctOf(recruit.id);
    await pool.query(
      'UPDATE account_persistent SET minted=true,referred_by=$2,referral_same_ip_hold=false WHERE account_id=$1',
      [recruitAccount, captainAccount]);
    await pool.query('UPDATE characters SET respect=1000000000 WHERE id=$1', [recruit.id]);
    await pool.query("INSERT INTO telemetry (id,account_id,event) VALUES ($1,$2,'capo_chunk')",
      [crypto.randomUUID(), recruitAccount]);
  }
  let maxParams = 0;
  const measuredPool = { connect: async () => {
    const client = await pool.connect();
    return { query: (sql, params = []) => { maxParams = Math.max(maxParams, params.length); return client.query(sql, params); },
      release: () => client.release() };
  } };
  const aggregated = await sweepCapoLicense(measuredPool, { pageSize: 1, pageBudget: 1 });
  assert.equal(aggregated.updated, 1);
  assert(maxParams <= 2, 'qualification never binds the unbounded recruit fan-out');
  assert.equal(Number((await pool.query(
    'SELECT capo_recruits FROM account_persistent WHERE account_id=$1', [captainAccount])).rows[0].capo_recruits), 5,
  'database aggregation counts every qualified recruit exactly');
  await pool.query(
    "UPDATE account_persistent SET capo_recruits=5,capo_recruits_at=now()-interval '49 hours' WHERE account_id=$1",
    [captainAccount]);
  const staleBoard = await capoBoard(pool, captainAccount);
  assert.deepEqual({ recruits: staleBoard.recruits, tier: staleBoard.tier, actionsPerSec: staleBoard.actionsPerSec },
    { recruits: 0, tier: null, actionsPerSec: null }, 'an expired worker stamp fails closed to zero Capo privilege');

  if (process.env.DATABASE_URL) {
    // Native PostgreSQL only: pg-mem parses transaction control but does not roll DML back. Inject a
    // failure after the first effect and prove PostgreSQL restores both the page and cursor atomically.
    await pool.query('UPDATE account_persistent SET agent_flag=false');
    await pool.query("DELETE FROM worker_sweep_cursors WHERE sweep_key='capo-license'");
    await pool.query(
      `INSERT INTO account_persistent (account_id,agent_flag,capo_recruits) VALUES
         ('sweep-capo-crash-0',true,1),('sweep-capo-crash-1',true,1)`);
    let injected = false;
    const failingPool = { connect: async () => {
      const client = await pool.connect();
      return { query: async (sql, params = []) => {
        const result = await client.query(sql, params);
        if (!injected && /^UPDATE account_persistent SET capo_recruits=/i.test(String(sql))) {
          injected = true;
          throw new Error('injected capo page crash');
        }
        return result;
      }, release: () => client.release() };
    } };
    await assert.rejects(() => sweepCapoLicense(failingPool, { pageSize: 2, pageBudget: 1 }),
      /injected capo page crash/);
    assert.equal(Number((await pool.query(
      "SELECT COUNT(*) n FROM account_persistent WHERE account_id LIKE 'sweep-capo-crash-%' AND capo_recruits=1"
    )).rows[0].n), 2, 'a failed page leaves every count unchanged');
    assert.equal(Number((await pool.query(
      "SELECT COUNT(*) n FROM worker_sweep_cursors WHERE sweep_key='capo-license'"
    )).rows[0].n), 0, 'a failed first page does not advance or create its cursor');
    assert.equal((await sweepCapoLicense(pool, { pageSize: 2, pageBudget: 1 })).updated, 2,
      'the rolled-back page is retried in full');
  }

  // Overlapping worker processes serialize on the persisted state row. Each committed page owns a
  // distinct cursor range; the final page still wraps normally.
  await pool.query('UPDATE account_persistent SET agent_flag=false');
  await pool.query("DELETE FROM worker_sweep_cursors WHERE sweep_key='capo-license'");
  await pool.query(
    `INSERT INTO account_persistent (account_id,agent_flag,capo_recruits) VALUES
       ('sweep-capo-race-0',true,1),('sweep-capo-race-1',true,1),('sweep-capo-race-2',true,1)`);
  // pg-mem parses FOR UPDATE but does not implement its blocking semantics. The native PostgreSQL
  // leg runs the calls concurrently; the in-memory leg still proves the same continuation serially.
  const raceCalls = [
    () => sweepCapoLicense(pool, { pageSize: 1, pageBudget: 1 }),
    () => sweepCapoLicense(pool, { pageSize: 1, pageBudget: 1 }),
  ];
  const raced = process.env.DATABASE_URL
    ? await Promise.all(raceCalls.map((callSweep) => callSweep()))
    : [await raceCalls[0](), await raceCalls[1]()];
  assert.equal(raced.reduce((sum, result) => sum + result.updated, 0), 2,
    'overlapping invocations commit two distinct pages');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_persistent WHERE account_id LIKE 'sweep-capo-race-%' AND capo_recruits=0"
  )).rows[0].n), 2, 'the cursor lock prevents duplicate page work');
  const raceFinish = await sweepCapoLicense(pool, { pageSize: 1, pageBudget: 1 });
  assert.deepEqual({ updated: raceFinish.updated, hasMore: raceFinish.hasMore, wrapped: raceFinish.wrapped },
    { updated: 1, hasMore: false, wrapped: true }, 'the remaining raced page completes and wraps');

  if (process.env.DATABASE_URL) {
    // Native PostgreSQL only: SKIP LOCKED is a production capability pg-mem cannot model. A hot middle
    // account cannot pin later agents; after its lock clears it is picked up in the next cycle.
    await pool.query('UPDATE account_persistent SET agent_flag=false');
    await pool.query("DELETE FROM worker_sweep_cursors WHERE sweep_key='capo-license'");
    await pool.query(
      `INSERT INTO account_persistent (account_id,agent_flag,capo_recruits) VALUES
         ('sweep-capo-hot-0',true,1),('sweep-capo-hot-1',true,1),('sweep-capo-hot-2',true,1)`);
    const locker = await pool.connect();
    await locker.query('BEGIN');
    await locker.query("SELECT 1 FROM account_persistent WHERE account_id='sweep-capo-hot-1' FOR UPDATE");
    try {
      const skipped = await sweepCapoLicense(pool, { pageSize: 3, pageBudget: 1 });
      assert.equal(skipped.updated, 2, 'a locked middle agent does not block later rows');
      assert.equal(Number((await pool.query(
        "SELECT capo_recruits FROM account_persistent WHERE account_id='sweep-capo-hot-1'"
      )).rows[0].capo_recruits), 1, 'the locked agent remains pending without blocking the cycle');
    } finally { await locker.query('ROLLBACK'); locker.release(); }
    assert.equal((await sweepCapoLicense(pool, { pageSize: 3, pageBudget: 1 })).updated, 1,
      'the skipped agent retries after its lock clears');
  }
  console.log('✅ sweepCapoLicense bounds work, persists/resumes/wraps its cursor, and aggregates recruit qualification');
}

// (9) sweepGrandReferrals — blocked rows cannot consume the bounded retry budget ahead of a payee.
{
  await pool.query(
    `INSERT INTO account_persistent (account_id, ref_paid, referred_by) VALUES
       ('sweep-grand-blocked-a',true,NULL),
       ('sweep-grand-blocked-r',true,'sweep-grand-blocked-a'),
       ('sweep-grand-valid-a',true,NULL),
       ('sweep-grand-valid-r',true,'sweep-grand-valid-a'),
       ('sweep-grand-r2-1000',true,'sweep-grand-valid-r')`,
  );
  const values = [], params = [];
  for (let i = 0; i < 1000; i++) {
    const n = params.length;
    values.push(`($${n + 1},true,$${n + 2})`);
    params.push(`sweep-grand-r2-${String(i).padStart(4, '0')}`, 'sweep-grand-blocked-r');
  }
  await pool.query(
    `INSERT INTO account_persistent (account_id, ref_paid, referred_by) VALUES ${values.join(',')}`,
    params,
  );
  await pool.query(
    `INSERT INTO characters (id, account_id, name, season, cash)
       VALUES ('sweep-grand-valid-char','sweep-grand-valid-a','Sweep Grand Payee',1,500)`,
  );
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM account_persistent WHERE account_id LIKE 'sweep-grand-r2-%' AND ref_paid AND NOT ref_l2_paid",
  )).rows[0].n), 1001, 'the retry set contains 1,000 blocked rows followed by the formerly omitted payee');
  const first = await sweepGrandReferrals(pool);
  assert.deepEqual(first, { candidates: 1, paid: 1 }, 'prefiltering spends the bounded budget only on the eligible payee');
  const ledger = (await pool.query(
    "SELECT COUNT(*) n, COALESCE(SUM(amount),0) amount FROM transactions WHERE character_id='sweep-grand-valid-char' AND reason='referral:tier2'",
  )).rows[0];
  assert.equal(Number(ledger.n), 1, 'the eligible chain writes exactly one tier-2 ledger row');
  assert.equal(Number(ledger.amount), M4.REF_TIER2_CASH, 'the one ledger row carries the complete tier-2 payment');
  assert.equal(Number((await pool.query(
    "SELECT cash FROM characters WHERE id='sweep-grand-valid-char'",
  )).rows[0].cash), 500 + M4.REF_TIER2_CASH, 'the eligible grandrecruiter receives exactly one payment');
  assert.equal((await pool.query(
    "SELECT ref_l2_paid FROM account_persistent WHERE account_id='sweep-grand-r2-1000'",
  )).rows[0].ref_l2_paid, true, 'the formerly starved candidate is latched paid');
  assert.deepEqual(await sweepGrandReferrals(pool), { candidates: 0, paid: 0 }, 'the referral sweep rerun pays zero');
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM transactions WHERE character_id='sweep-grand-valid-char' AND reason='referral:tier2'",
  )).rows[0].n), 1, 'the rerun cannot duplicate the ledger row');
  await noDrift('after the bounded grand-referral reconcile');
  console.log('✅ sweepGrandReferrals skips 1,000 blocked candidates, pays the eligible 1,001st once, and reruns at zero');
}

console.log('✅ worker-sweep suite passed');
await app.close();
