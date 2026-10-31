import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { accrue } from '../src/accrual.js';
import { CONSTANTS, CORNER, DRUGS, M4, RACKETS } from '../src/rules.js';
import { captureAccrualEconomy, accrualEconomyIssues, runEconomyMonitor } from '../src/economy-monitor.js';
import { alertDrift } from '../src/invariants.js';

const minute = 60000, hour = 60 * minute, day = 24 * hour;
const start = +new Date('2026-10-31T00:05:00Z');
const makeAccrual = ({ principal = 1000000, credit = CONSTANTS.OFFLINE_CAP_MS } = {}) => ({
  ch: { id: 'accrual-player', account_id: 'accrual-account', respect: 10000, cash: 0, bank: principal,
    energy: 0, nerve: 0, health: 100, heat: 0, crew: 3, crew_paid_at: new Date(start),
    crew_sale_credit_ms: 59000, last_accrued_at: new Date(start), bank_credit_ms: credit, racket_credit_ms: credit },
  owned: { rackets: [RACKETS[0].id], racketLevels: { [RACKETS[0].id]: 3 }, assets: [], held: ['neon'],
    deedPerk: ['cathedral'], stash: [{ drug_id: DRUGS[0].id, qty: 10000, quality: 1.2 }] },
});
for (const principal of [1000000, 9990000, 30000000]) {
  for (const credit of [0, CONSTANTS.OFFLINE_CAP_MS]) {
    for (const elapsed of [500, 1000, hour, 2 * day]) {
      const { ch, owned } = makeAccrual({ principal, credit });
      const before = captureAccrualEconomy(ch, owned);
      accrue(ch, null, { ...owned, deedHeld: owned.deedPerk, preview: true }, new Date(start + elapsed));
      assert.deepEqual(accrualEconomyIssues(before, ch), [], `legitimate accrual ${principal}/${credit}/${elapsed}`);
    }
  }
}
{
  const { ch, owned } = makeAccrual();
  owned.stash[0].quality = 0;
  const before = captureAccrualEconomy(ch, owned);
  accrue(ch, null, { ...owned, preview: true }, new Date(start + hour));
  assert.deepEqual(accrualEconomyIssues(before, ch), [], 'legacy zero quality uses the same documented sale fallback');
}
{
  const { ch, owned } = makeAccrual();
  ch.bank += 5000000; owned.racketLevels[RACKETS[0].id] = 5;
  const before = captureAccrualEconomy(ch, owned);
  accrue(ch, null, { ...owned, preview: true }, new Date(start + hour));
  assert.deepEqual(accrualEconomyIssues(before, ch), [], 'a deposit/upgrade is observed in the new pre-state');
  ch.bank += 10000000; ch._bankInterest += 10000000;
  ch._accruedIncome += 10000000; ch._crewSale = { units: 20000, proceeds: 1000000000 };
  const sources = accrualEconomyIssues(before, ch).map(issue => issue.source);
  for (const source of ['bank:interest', 'racket:income', 'crew:units', 'crew:sales']) assert(sources.includes(source));
  ch.bank = NaN;
  assert.equal(accrualEconomyIssues(before, ch)[0].name, 'accrual_invalid_values');
  assert.doesNotThrow(() => captureAccrualEconomy({ ...ch, last_accrued_at: 'invalid' }, { stash: 7 }));
}

const native = process.argv.includes('--postgres');
let pool, admin, schema;
if (native) {
  const endpoint = new URL(process.env.ECONOMY_MONITOR_TEST_DATABASE_URL || 'about:blank');
  assert(['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)
    && endpoint.pathname.length > 1 && ['postgres:', 'postgresql:'].includes(endpoint.protocol),
  'Native monitor tests require an explicit loopback database and use a fresh isolated schema');
  const { default: pg } = await import('pg');
  admin = new pg.Client({ connectionString: endpoint.href }); await admin.connect();
  schema = 'economy_monitor_test_' + crypto.randomBytes(8).toString('hex');
  assert.match(schema, /^economy_monitor_test_[a-f0-9]{16}$/);
  await admin.query('CREATE SCHEMA ' + schema);
  pool = new pg.Pool({ connectionString: endpoint.href, options: '-c search_path=' + schema });
} else {
  const { newDb } = await import('pg-mem');
  const mem = newDb(); const pg = mem.adapters.createPg(); pool = new pg.Pool();
}
const alerts = [];
const notify = async (_pool, issues, kind) => { assert.equal(kind, 'economy'); alerts.push(issues); };
const run = (at = start, options = {}) => runEconomyMonitor(pool, { now: new Date(at), alert: notify, ...options });
const reset = async () => {
  await pool.query('DELETE FROM transactions'); await pool.query('DELETE FROM telemetry'); await pool.query('DELETE FROM characters');
  alerts.length = 0;
};
const character = async (id, account) => pool.query('INSERT INTO characters (id,account_id) VALUES ($1,$2)', [id, account]);
const transaction = async ({ id = crypto.randomUUID(), at = start - minute, characterId = null, accountId = null,
  currency = 'cash', amount = 10, reason = 'transfer', counterparty = null } = {}) => pool.query(
  'INSERT INTO transactions (id,at,character_id,account_id,currency,amount,reason,counterparty) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)',
  [id, new Date(at), characterId, accountId, currency, amount, reason, counterparty]);
const receipt = async (at = start - minute) => pool.query('INSERT INTO telemetry (id,event,props,account_id,at) VALUES ($1,$2,$3,$4,$5)',
  [crypto.randomUUID(), 'economy_payout_bound', JSON.stringify({ issues: [{ name: 'accrual_payout_bound', source: 'bank:interest', observed: 1000, maximum: 5 }] }), 'player', new Date(at)]);
try {
  await pool.query('CREATE TABLE characters (id TEXT PRIMARY KEY, account_id TEXT NOT NULL)');
  await pool.query('CREATE TABLE transactions (id TEXT PRIMARY KEY, at TIMESTAMPTZ NOT NULL, character_id TEXT, account_id TEXT, currency TEXT NOT NULL, amount NUMERIC NOT NULL, reason TEXT NOT NULL, counterparty TEXT)');
  await pool.query('CREATE TABLE telemetry (id TEXT PRIMARY KEY,event TEXT NOT NULL,props TEXT,account_id TEXT,at TIMESTAMPTZ NOT NULL DEFAULT now())');
  await pool.query('CREATE INDEX ix_monitor_tx_at ON transactions(at,id)');
  await pool.query('CREATE INDEX ix_monitor_tx_source_at ON transactions(currency,reason,at)');
  await pool.query('CREATE INDEX ix_monitor_telemetry_event_at ON telemetry(event,at,id)');
  if (native) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN'); await client.query('SET LOCAL enable_seqscan=off');
      const plan = (await client.query("EXPLAIN SELECT id FROM transactions WHERE currency='cash' AND reason='checkin' AND at >= $1 AND at <= $2 ORDER BY at DESC,id DESC LIMIT 10001",
        [new Date(start - day), new Date(start)])).rows.map(row => row['QUERY PLAN']).join('\n');
      assert(plan.includes('ix_monitor_tx_source_at'), 'exact source/time query uses the composite index on native PostgreSQL');
      await client.query('ROLLBACK');
    } finally { client.release(); }
  }

  await character('old', 'player'); await character('heir', 'player');
  await transaction({ characterId: 'old', at: start - 6 * minute, reason: 'checkin', amount: 950 });
  await transaction({ characterId: 'heir', at: start - 4 * minute, reason: 'checkin', amount: 950 });
  await transaction({ accountId: 'player', reason: 'daily:all', currency: 'omr', amount: M4.DAILY_ALL_OMR });
  await transaction({ characterId: 'heir', reason: 'corner:job', amount: CORNER.CASH + CORNER.CHAIN_BONUS });
  await transaction({ accountId: 'player', reason: 'transfer:received', amount: 50000000 });
  await transaction({ accountId: 'player', reason: 'transfer:spent', amount: -50000000 });
  let result = await run();
  assert(result.ok && result.complete, 'adjacent UTC-day claims and offsetting large transfers are valid');
  assert.equal(result.groups.find(group => group.source === 'transfer:received').credits, 50000000);
  assert.equal(result.groups.find(group => group.source === 'transfer:spent').debits, 50000000);
  assert.equal(alerts.length, 0);

  await reset(); await character('old', 'player'); await character('heir', 'player');
  await transaction({ characterId: 'old', at: start + hour, reason: 'checkin', amount: 350 });
  await transaction({ characterId: 'heir', at: start + 4 * hour, reason: 'checkin', amount: 350 });
  result = await run(start + 4 * hour + minute);
  assert(result.issues.some(issue => issue.name === 'daily_reward_count_bound' && issue.source === 'checkin'),
    'same-account reward duplication across generations is detected even outside the rolling window');
  assert.equal(result.rows, 1);

  await reset();
  await transaction({ accountId: 'player', reason: 'daily:all', currency: 'omr', amount: M4.DAILY_ALL_OMR + 1 });
  await transaction({ accountId: 'player', reason: 'corner:job', amount: CORNER.CASH + CORNER.CHAIN_BONUS + 1 });
  result = await run();
  assert.equal(result.issues.filter(issue => issue.name === 'daily_reward_amount_bound').length, 2);

  await reset();
  for (let i = 0; i < 3; i++) await transaction({ accountId: 'player', reason: 'bank:interest', amount: 10 });
  result = await run(start, { ledgerRowsWarn: 2, netCashWarn: 20 });
  assert(result.issues.some(issue => issue.name === 'ledger_row_velocity' && issue.heuristic));
  assert(result.issues.some(issue => issue.name === 'ledger_net_credit_velocity' && issue.heuristic));
  assert(result.issues.some(issue => issue.name === 'duplicate_positive_rows' && issue.heuristic));
  const before = (await pool.query('SELECT SUM(amount) AS n FROM transactions')).rows[0].n;
  await run(start + minute, { ledgerRowsWarn: 2, netCashWarn: 20 });
  assert.equal(alerts.length, 1, 'persisted episode survives separate invocations and suppresses repeat delivery');
  assert.equal(Number((await pool.query('SELECT SUM(amount) AS n FROM transactions')).rows[0].n), Number(before), 'observation never repairs or modifies value');

  await reset(); await receipt();
  result = await run(); assert.equal(result.sourceReceipts, 1); assert.equal(alerts.length, 1);
  result = await run(start + 5 * minute); assert.equal(alerts.length, 1);
  result = await run(start + 2 * day); assert(result.ok); assert.equal(result.recoveredKeys.length, 1);
  await receipt(start + 2 * day + minute); await run(start + 2 * day + 2 * minute);
  assert.equal(alerts.length, 2, 'a later episode alerts after a recorded recovery');

  await reset(); await run();
  await receipt(start - 2 * hour);
  result = await run(start + minute);
  assert.equal(result.sourceReceipts, 1, 'a delayed commit is found beyond the ordinary 15-minute ledger window');
  assert.equal(alerts.length, 1);

  await reset(); await receipt();
  await assert.rejects(run(start, { alert: async () => { throw new Error('fixture delivery failure'); } }), /alert delivery failed/);
  result = JSON.parse((await pool.query("SELECT props FROM telemetry WHERE event='economy_monitor'")).rows[0].props);
  assert.equal(result.notification, 'failed'); assert.equal(result.notifiedKeys.length, 0);
  result = await run(start + minute); assert.equal(result.notification, 'recorded'); assert.equal(alerts.length, 1);

  await reset(); await receipt();
  const originalFetch = globalThis.fetch, originalWebhook = process.env.INVARIANT_WEBHOOK_URL;
  const originalError = console.error;
  let fetches = 0;
  try {
    process.env.INVARIANT_WEBHOOK_URL = 'https://alerts.invalid/economy-fixture';
    globalThis.fetch = async () => { fetches++; return { ok: false, status: 503 }; };
    console.error = () => {};
    const actualAlert = (p, issues, kind) => alertDrift(p, issues, kind, [0, 0]);
    await assert.rejects(run(start, { alert: actualAlert }), /alert delivery failed/);
    await assert.rejects(run(start + 5 * minute, { alert: actualAlert }), /alert delivery failed/);
    assert.equal(fetches, 6, 'exhausted real webhook delivery retries on the next monitor sample');
    globalThis.fetch = async () => { fetches++; return { ok: true, status: 204 }; };
    result = await run(start + 10 * minute, { alert: actualAlert });
    assert.equal(result.notification, 'recorded');
    await run(start + 11 * minute, { alert: actualAlert });
    assert.equal(fetches, 7, 'only confirmed delivery suppresses subsequent external retries');
    delete process.env.INVARIANT_WEBHOOK_URL;
    const local = await alertDrift(pool, [{ name: 'fixture-local' }], 'economy', []);
    assert.deepEqual(local, { recorded: true, webhook: 'not_configured' });
  } finally {
    globalThis.fetch = originalFetch; console.error = originalError;
    if (originalWebhook === undefined) delete process.env.INVARIANT_WEBHOOK_URL;
    else process.env.INVARIANT_WEBHOOK_URL = originalWebhook;
  }

  await reset();
  for (let i = 0; i < 4; i++) await transaction({ accountId: 'player', at: start - (i + 1) * 1000 });
  result = await run(start, { rowLimit: 2 });
  assert(!result.ok && !result.complete && result.rows === 2);
  assert(result.issues.some(issue => issue.name === 'monitor_scan_overflow'), 'a capped scan never claims clean coverage');
  await reset();
  for (let i = 0; i < 120; i++) await transaction({ accountId: 'player-' + i, reason: 'daily:all', currency: 'omr', amount: M4.DAILY_ALL_OMR + 1 });
  result = await run();
  assert(!result.ok && !result.complete && result.issueCount >= 120);
  assert.equal(result.issues.length, 100);
  assert.equal(result.issues.at(-1).name, 'monitor_issue_overflow', 'bounded diagnostic output cannot silently hide uncovered issues');
  await reset();
  await pool.query('INSERT INTO telemetry (id,event,props,at) VALUES ($1,$2,$3,$4)',
    [crypto.randomUUID(), 'economy_monitor', 'null', new Date(start - minute)]);
  result = await run();
  assert(!result.ok && !result.complete && result.issues.some(issue => issue.name === 'monitor_checkpoint_invalid'));
  await assert.rejects(run(start, { rowLimit: 0 }), /Invalid economy monitor option/);
  await assert.rejects(run(start, { netCashWarn: NaN }), /Invalid economy monitor option/);
  console.log(`Economy monitor ${native ? 'PostgreSQL' : 'pg-mem'}: legitimate accrual/UTC days, malicious bounds, lineage duplication, velocity, durable episodes/recovery, delivery retry and bounded scans passed.`);
} finally {
  await pool.end();
  if (admin) {
    if (schema) await admin.query('DROP SCHEMA ' + schema + ' CASCADE');
    await admin.end();
  }
}
