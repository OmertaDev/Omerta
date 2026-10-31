import crypto from 'node:crypto';
import {
  CONSTANTS, CITY_EVENTS, CORNER, M4, assetIncome, dailyJobsOf, drugOf,
  levelOf, pathFx, racketIncomeLeveled, rankIdxOf,
} from './rules.js';

const DAY_MS = 86400000;
export const ECONOMY_MONITOR_INTERVAL_MS = 5 * 60000;
const positive = value => Number.isFinite(value) && value >= 0;
const stamp = value => value == null ? NaN : +new Date(value);
const tolerance = value => Math.max(0.01, Math.abs(value) * 1e-9);

// Capture the state actually used by the next accrual, before upgrades, transfers or estate
// processing can replace it. These are independent upper bounds, not a second payout calculator.
export function captureAccrualEconomy(ch, owned = {}) {
  const invalid = [];
  const number = (value, field, fallback = 0) => {
    const result = Number(value ?? fallback);
    if (!positive(result)) invalid.push(field);
    return result;
  };
  const before = {
    characterId: ch.id, accountId: ch.account_id,
    lastAt: stamp(ch.last_accrued_at), bank: number(ch.bank, 'bank'),
    bankCredit: number(ch.bank_credit_ms, 'bank_credit_ms', CONSTANTS.OFFLINE_CAP_MS),
    racketCredit: number(ch.racket_credit_ms, 'racket_credit_ms', CONSTANTS.OFFLINE_CAP_MS),
    crew: number(ch.crew, 'crew'), crewCredit: number(ch.crew_sale_credit_ms, 'crew_sale_credit_ms'),
    crewPaidAt: stamp(ch.crew_paid_at), invalid,
  };
  if (!Number.isFinite(before.lastAt)) invalid.push('last_accrued_at');
  try {
    const held = [...(owned.held || []), ...(owned.deedPerk || owned.deedHeld || [])];
    const maximumEvent = Math.max(1, ...CITY_EVENTS.map(event => Number(event.racketMult || 1)));
    before.incomePerMinute = ((owned.rackets || []).reduce((sum, id) =>
      sum + racketIncomeLeveled(id, owned.racketLevels?.[id]), 0) + assetIncome(owned.assets || []))
      * maximumEvent * (held.includes('neon') ? 1.15 : 1)
      * pathFx(ch, 'racketIncome') * (rankIdxOf(levelOf(Number(ch.respect))) >= 7 ? 1.1 : 1);
    before.stashUnits = 0; before.maximumSalePrice = 0;
    for (const row of owned.stash || []) {
      const quantity = number(row.qty, 'stash.qty');
      const quality = number(row.quality || 1, 'stash.quality', 1);
      before.stashUnits += quantity;
      before.maximumSalePrice = Math.max(before.maximumSalePrice, Number(drugOf(row.drug_id)?.base || 0) * quality * 0.8);
    }
    if (!positive(before.incomePerMinute)) invalid.push('income_rate');
    if (!positive(before.stashUnits) || !positive(before.maximumSalePrice)) invalid.push('stash_value');
  } catch {
    invalid.push('income_context'); before.incomePerMinute = 0;
    before.stashUnits = 0; before.maximumSalePrice = 0;
  }
  return before;
}

export function accrualEconomyIssues(before, ch) {
  const issues = [];
  const invalid = [...(before.invalid || [])];
  const elapsed = Math.max(0, stamp(ch.last_accrued_at) - before.lastAt);
  const bank = Number(ch.bank), bankMarker = Number(ch._bankInterest ?? 0);
  const income = Number(ch._accruedIncome ?? 0);
  const units = Number(ch._crewSale?.units ?? 0), proceeds = Number(ch._crewSale?.proceeds ?? 0);
  for (const [name, value] of Object.entries({ elapsed, bank, bankMarker, income, units, proceeds,
    bank_credit_ms: Number(ch.bank_credit_ms ?? before.bankCredit),
    racket_credit_ms: Number(ch.racket_credit_ms ?? before.racketCredit),
    crew_sale_credit_ms: Number(ch.crew_sale_credit_ms ?? before.crewCredit) }))
    if (!positive(value)) invalid.push(name);
  for (const [name, value] of [['bank_credit_ms', Number(ch.bank_credit_ms ?? before.bankCredit)],
    ['racket_credit_ms', Number(ch.racket_credit_ms ?? before.racketCredit)]])
    if (value > CONSTANTS.OFFLINE_CAP_MS + 1) invalid.push(name);
  if (invalid.length) issues.push({ name: 'accrual_invalid_values', source: 'accrual', fields: [...new Set(invalid)] });
  if (!Number.isFinite(elapsed) || invalid.length) return issues;
  const eligible = (credit, daily) => elapsed < 1000 ? 0 : Math.min(elapsed, CONSTANTS.OFFLINE_CAP_MS,
    Math.min(CONSTANTS.OFFLINE_CAP_MS, credit + elapsed * daily / DAY_MS));
  const bankEligible = eligible(before.bankCredit, CONSTANTS.BANK_DAILY_CAP_MS);
  const racketEligible = eligible(before.racketCredit, CONSTANTS.RACKET_DAILY_CAP_MS);
  // Effective principal grows no faster than the untapered continuous rate; crossing the taper
  // slows it further. Its continuous envelope bounds both discrete closed forms independently.
  const taper = CONSTANTS.BANK_TAPER_KEEP, threshold = CONSTANTS.BANK_TAPER_ABOVE;
  const effectivePrincipal = Math.min(before.bank, threshold) + Math.max(0, before.bank - threshold) * taper;
  const bankMaximum = threshold >= 0 && taper >= 0 && taper <= 1
    ? effectivePrincipal * Math.expm1(CONSTANTS.BANK_RATE * bankEligible / CONSTANTS.BANK_PERIOD_MS) : Infinity;
  const incomeMaximum = before.incomePerMinute * racketEligible / 60000;
  const crewEligible = !Number.isFinite(before.crewPaidAt) || elapsed < 1000 ? 0 :
    Math.min(elapsed, CONSTANTS.OFFLINE_CAP_MS, Math.max(0,
      Math.min(stamp(ch.last_accrued_at), before.crewPaidAt + M4.CREW_WAGE_COLD_MS)
      - Math.max(before.lastAt, before.crewPaidAt)));
  const unitMaximum = Math.min(before.stashUnits, Math.floor((before.crewCredit + before.crew * crewEligible) / 60000));
  const compare = (source, observed, maximum) => {
    if (!Number.isFinite(maximum)) issues.push({ name: 'accrual_bound_unavailable', source });
    else if (observed > maximum + tolerance(maximum)) issues.push({ name: 'accrual_payout_bound', source, observed, maximum });
  };
  compare('bank:interest', Math.max(bankMarker, bank - before.bank), bankMaximum);
  compare('racket:income', income, incomeMaximum);
  compare('crew:units', units, unitMaximum);
  compare('crew:sales', proceeds, unitMaximum * before.maximumSalePrice);
  return issues;
}

const parse = value => typeof value === 'string' ? JSON.parse(value) : value;
function option(value, fallback, name, maximum = Number.MAX_SAFE_INTEGER) {
  const result = Number(value ?? fallback);
  if (!Number.isFinite(result) || result <= 0 || result > maximum)
    throw new Error(`Invalid economy monitor option: ${name}`);
  return result;
}
const issueKey = issue => [issue.name, issue.accountId || '', issue.source || '', issue.currency || '', issue.day ?? ''].join('|');
const utcDay = value => Math.floor(stamp(value) / DAY_MS);
const dailyKind = row => row.reason === 'checkin' && row.currency === 'cash' ? 'checkin'
  : row.reason === 'daily:all' && row.currency === 'omr' ? 'daily-envelope'
  : row.reason?.startsWith('daily:') && row.currency === 'cash' ? 'daily'
  : row.reason === 'corner:job' && row.currency === 'cash' ? 'corner' : null;

// This is an observation, not authorization to pay or a balance repair. Queries overlap by design;
// durable episode keys suppress repeated alerts while recovery allows a later episode to alert again.
export async function runEconomyMonitor(pool, options = {}) {
  const now = options.now == null ? new Date() : new Date(options.now);
  if (!Number.isFinite(+now)) throw new Error('Invalid economy monitor time');
  const windowMs = option(options.windowMs, 15 * 60000, 'windowMs', DAY_MS);
  const rowLimit = option(options.rowLimit, 10000, 'rowLimit', 50000);
  if (!Number.isInteger(rowLimit)) throw new Error('Invalid economy monitor option: rowLimit');
  const ledgerRowsWarn = option(options.ledgerRowsWarn ?? process.env.ECONOMY_MONITOR_LEDGER_ROWS_WARN, 1000, 'ledgerRowsWarn');
  const netCashWarn = option(options.netCashWarn ?? process.env.ECONOMY_MONITOR_NET_CASH_WARN, 10000000, 'netCashWarn');
  const netOmrWarn = option(options.netOmrWarn ?? process.env.ECONOMY_MONITOR_NET_OMR_WARN, 1000, 'netOmrWarn');
  const since = new Date(+now - windowMs), dailySince = new Date((utcDay(now) - 1) * DAY_MS);
  const issues = []; let issueCount = 0, issueOverflow = false;
  let complete = true;
  const add = issue => {
    issueCount++;
    if (issues.length < 99) issues.push(issue);
    else { issueOverflow = true; complete = false; }
  };
  const previousRows = (await pool.query("SELECT props FROM telemetry WHERE event='economy_monitor' ORDER BY at DESC,id DESC LIMIT 1")).rows;
  let previous = {};
  try {
    previous = previousRows.length ? parse(previousRows[0].props) : {};
    if (!previous || typeof previous !== 'object' || Array.isArray(previous)) throw new Error('invalid checkpoint');
  }
  catch { previous = {}; add({ name: 'monitor_checkpoint_invalid' }); complete = false; }
  const readRows = async (sql, params, source) => {
    const rows = (await pool.query(sql, params)).rows;
    if (rows.length > rowLimit) { complete = false; add({ name: 'monitor_scan_overflow', source, maximum: rowLimit }); }
    return rows.slice(0, rowLimit);
  };
  const columns = 't.id,t.at,t.character_id,COALESCE(t.account_id,c.account_id) AS account_id,t.currency,t.amount,t.reason,t.counterparty';
  const rows = await readRows(`SELECT ${columns} FROM transactions t LEFT JOIN characters c ON c.id=t.character_id
    WHERE t.at >= $1 AND t.at <= $2 ORDER BY t.at DESC,t.id DESC LIMIT $3`, [since, now, rowLimit + 1], 'recent_ledger');
  // Exact source predicates use (currency,reason,at), rather than filtering a two-day global scan.
  // Unknown older board IDs still appear in recent-ledger statistics, but are not assigned a claim
  // ceiling by a newer rules catalog. Keep this coverage boundary in the retained summary.
  const dailySources = [['cash', 'checkin'], ['cash', 'corner:job'], ['omr', 'daily:all'],
    ...[...new Set([utcDay(now) - 1, utcDay(now)].flatMap(day => dailyJobsOf(day).map(job => job.id)))].map(id => ['cash', 'daily:' + id])];
  const dailyRows = [];
  for (const [currency, reason] of dailySources) {
    const available = rowLimit - dailyRows.length;
    const found = (await pool.query(`SELECT ${columns} FROM transactions t LEFT JOIN characters c ON c.id=t.character_id
      WHERE t.at >= $1 AND t.at <= $2 AND t.currency=$3 AND t.reason=$4
      ORDER BY t.at DESC,t.id DESC LIMIT $5`, [dailySince, now, currency, reason, available + 1])).rows;
    dailyRows.push(...found.slice(0, available));
    if (found.length > available) { complete = false; add({ name: 'monitor_scan_overflow', source: 'daily_rewards', maximum: rowLimit }); break; }
  }
  const anomalies = await readRows("SELECT id,account_id,props FROM telemetry WHERE event='economy_payout_bound' AND at >= $1 AND at <= $2 ORDER BY at DESC,id DESC LIMIT $3",
    [dailySince, now, rowLimit + 1], 'source_bounds');
  const groups = new Map(), accounts = new Map(), duplicates = new Map(), daily = new Map();
  for (const row of rows) {
    const amount = Number(row.amount);
    if (!Number.isFinite(amount) || !row.currency || !row.reason) {
      add({ name: 'invalid_ledger_value', source: row.reason || 'unknown', transactionId: row.id }); continue;
    }
    const accountId = row.account_id || null, groupKey = JSON.stringify([accountId, row.currency, row.reason]);
    const group = groups.get(groupKey) || { accountId, currency: row.currency, source: row.reason, rows: 0, credits: 0, debits: 0, net: 0 };
    group.rows++; group.credits += Math.max(0, amount); group.debits += Math.max(0, -amount); group.net += amount;
    groups.set(groupKey, group);
    if (accountId) {
      const key = JSON.stringify([accountId, row.currency]), account = accounts.get(key) || { accountId, currency: row.currency, net: 0 };
      account.net += amount; accounts.set(key, account);
    }
    if (amount > 0) {
      const duplicate = JSON.stringify([stamp(row.at), row.character_id, accountId, row.currency, amount, row.reason, row.counterparty]);
      const found = duplicates.get(duplicate) || { row, count: 0 }; found.count++; duplicates.set(duplicate, found);
    }
  }
  for (const group of groups.values()) if (group.rows > ledgerRowsWarn)
    add({ name: 'ledger_row_velocity', accountId: group.accountId, source: group.source, currency: group.currency, observed: group.rows, maximum: ledgerRowsWarn, heuristic: true });
  for (const account of accounts.values()) {
    const maximum = account.currency === 'cash' ? netCashWarn : account.currency === 'omr' ? netOmrWarn : null;
    if (maximum != null && account.net > maximum)
      add({ name: 'ledger_net_credit_velocity', ...account, observed: account.net, maximum, heuristic: true });
  }
  for (const { row, count } of duplicates.values()) if (count > 1)
    add({ name: 'duplicate_positive_rows', accountId: row.account_id, source: row.reason, currency: row.currency, observed: count, heuristic: true });
  for (const row of dailyRows) {
    const amount = Number(row.amount), kind = dailyKind(row);
    if (!(amount > 0) || !kind) continue;
    if (!row.account_id) { add({ name: 'unattributed_daily_reward', source: row.reason }); continue; }
    const day = utcDay(row.at), key = JSON.stringify([row.account_id, day, kind]);
    const group = daily.get(key) || { accountId: row.account_id, day, source: kind, count: 0 };
    group.count++; daily.set(key, group);
    const maximum = kind === 'daily-envelope' ? M4.DAILY_ALL_OMR : kind === 'corner' ? CORNER.CASH + CORNER.CHAIN_BONUS : null;
    if (maximum != null && amount > maximum + tolerance(maximum))
      add({ name: 'daily_reward_amount_bound', accountId: row.account_id, source: row.reason, currency: row.currency, observed: amount, maximum, day });
  }
  for (const group of daily.values()) {
    const maximum = group.source === 'daily' ? dailyJobsOf(group.day).length : group.source === 'corner' ? CORNER.MAX_DAY : 1;
    // Ledger timestamps are transaction-start times, not claim-day receipts. A transaction crossing
    // UTC midnight can move a legitimate claim across this grouping, so this is an alerting signal.
    if (group.count > maximum) add({ name: 'daily_reward_count_bound', ...group, observed: group.count, maximum, heuristic: true });
  }
  for (const row of anomalies) {
    try {
      const props = parse(row.props);
      if (!Array.isArray(props?.issues) || !props.issues.length) throw new Error('invalid source receipt');
      for (const issue of props.issues.slice(0, 10)) add({ name: 'source_payout_bound', accountId: row.account_id,
        source: typeof issue.source === 'string' ? issue.source : 'accrual', receiptId: row.id, issue });
    } catch { add({ name: 'source_receipt_invalid', accountId: row.account_id, receiptId: row.id }); }
  }
  if (issueOverflow) issues.push({ name: 'monitor_issue_overflow', observed: issueCount, maximum: 99 });
  const keys = [...new Set(issues.map(issueKey))].sort();
  const notifiedBefore = Array.isArray(previous.notifiedKeys) ? previous.notifiedKeys : [];
  const newIssues = issues.filter((issue, index) => !notifiedBefore.includes(issueKey(issue))
    && issues.findIndex(other => issueKey(other) === issueKey(issue)) === index);
  let notification = newIssues.length ? 'not_configured' : 'unchanged';
  let deliveryError;
  let notifiedKeys = keys.filter(key => notifiedBefore.includes(key));
  if (newIssues.length && typeof options.alert === 'function') {
    // A resolved callback records an alert episode; it cannot attest external webhook delivery.
    try {
      const result = await options.alert(pool, newIssues, 'economy');
      if (result?.webhook === 'failed') throw new Error('Economy webhook delivery exhausted');
      notifiedKeys = keys; notification = result?.webhook === 'not_configured' ? 'not_configured' : 'recorded';
    }
    catch (error) { notification = 'failed'; deliveryError = error; }
  }
  const summary = {
    version: 1, at: now.toISOString(), since: since.toISOString(), complete, ok: complete && issues.length === 0,
    rows: rows.length, dailyRows: dailyRows.length, sourceReceipts: anomalies.length,
    sourceSince: dailySince.toISOString(),
    dailySources, dailyCoverage: 'current-rule-ids-and-fixed-rewards; unknown older IDs are recent-ledger statistics only',
    groupCount: groups.size, groups: [...groups.values()].sort((a, b) => b.credits - a.credits).slice(0, 20),
    issues, issueCount, activeKeys: keys, notifiedKeys, notification,
    recoveredKeys: (Array.isArray(previous.activeKeys) ? previous.activeKeys : []).filter(key => !keys.includes(key)),
    thresholds: { ledgerRowsWarn, netCashWarn, netOmrWarn },
  };
  await pool.query('INSERT INTO telemetry (id,event,props,at) VALUES ($1,$2,$3,$4)',
    [crypto.randomUUID(), 'economy_monitor', JSON.stringify(summary), now]);
  if (deliveryError) throw new Error('Economy monitor alert delivery failed', { cause: deliveryError });
  return summary;
}
