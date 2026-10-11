import crypto from 'node:crypto';
import { GameError, ledger } from './game.js';
import { jailed, safeHoused, priceBlock } from './rules.js';
import { marketPrices } from './streets.js';
import { INTEL_FORECAST, intelForecastTerms, intelForecastSnapshot, validateIntelForecastReport, intelForecastOutcome } from './intelforecasts.js';

const fail = message => { throw new GameError('intel_forecast', message); };
const key = value => typeof value === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(value);
const request = value => typeof value === 'string' && /^[\x21-\x7e]{1,200}$/.test(value);
const iso = value => value == null ? null : new Date(value).toISOString();
const mobile = ch => { if (!ch?.alive || ch.is_npc || jailed(ch) || safeHoused(ch)) fail('Use a living, surfaced player or agent.'); };
const intake = () => { if (process.env.DEPOT_PILOT !== 'on') fail('The economy pilot is not open for new forecasts.'); };
const money = (cash, delta) => { const next = Number(cash) + delta; if (!Number.isFinite(next) || next < 0 || next > Number.MAX_SAFE_INTEGER) fail('Cash cannot cover this fixed fee or balance.'); return next; };
const termsOf = row => ({ districtId: row.district_id, minimumStock: Number(row.minimum_stock), feeCash: Number(row.fee_cash), targetAt: iso(row.target_at) });
function view(row) {
  return { id: row.id, buyerId: row.buyer_character, reporterId: row.reporter_character, ...termsOf(row),
    good: 'gin', createdAt: iso(row.created_at), status: row.status, predictsAvailable: row.predicts_available,
    reportedAt: iso(row.reported_at), observation: row.observation, outcome: row.outcome,
    resolvedAt: iso(row.resolved_at), sampleStartedAt: iso(row.sample_started_at), sample: row.sample,
    sampledAt: row.sample?.observedAt || null, windowEndsAt: iso(new Date(row.target_at).getTime() + INTEL_FORECAST.scoreGraceMs),
    outcomeDefinition: 'first_server_snapshot_in_window', gameCashOnly: true, accuracyDeterminesPayment: false };
}
async function locked(client, id) {
  if (!key(id)) fail('Choose a valid forecast job.');
  const row = (await client.query('SELECT * FROM intel_forecast_jobs WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row) fail('No forecast job.');
  return row;
}
const buyerOwns = (ch, row) => { if (ch.id !== row.buyer_character) fail('No forecast escrow of yours.'); };
async function authorized(client, ch, row) {
  const parties = (await client.query('SELECT id,account_id FROM characters WHERE id IN ($1,$2)', [row.buyer_character, row.reporter_character])).rows;
  if (!parties.some(p => p.account_id === ch.account_id)) fail('No forecast job of yours.');
}
export async function createIntelForecastJob(buyer, reporter, body, requestKey, client, h) {
  if (!request(requestKey) || !key(buyer?.id) || !key(reporter?.id)) fail('Provide a bounded request identity and reporter.');
  const prior = (await client.query('SELECT * FROM intel_forecast_jobs WHERE buyer_character=$1 AND request_key=$2 FOR UPDATE', [buyer.id, requestKey])).rows[0];
  if (prior) {
    let terms; try { terms = intelForecastTerms(body, new Date(prior.created_at).getTime()); } catch { fail('Original request terms changed.'); }
    if (prior.reporter_character !== reporter.id || JSON.stringify(terms) !== JSON.stringify(termsOf(prior))) fail('This request already has different terms.');
    return { ok: true, job: view(prior) };
  }
  intake(); mobile(buyer); mobile(reporter);
  if (buyer.id === reporter.id || buyer.account_id === reporter.account_id) fail('Choose an independent reporter.');
  const now = Date.now(); let terms;
  try { terms = intelForecastTerms(body, now); } catch { fail('Provide valid fixed forecast terms.'); }
  for (const id of [buyer.id, reporter.id]) {
    const active = (await client.query("SELECT id FROM intel_forecast_jobs WHERE (buyer_character=$1 OR reporter_character=$1) AND (status='open' OR (status='reported' AND outcome IS NULL)) LIMIT 3", [id])).rows;
    if (active.length >= INTEL_FORECAST.maxOpen) fail('This party already has three active forecasts.');
  }
  const cash = money(buyer.cash, -terms.feeCash), id = crypto.randomUUID();
  await client.query("INSERT INTO intel_forecast_jobs(id,buyer_character,reporter_character,request_key,district_id,minimum_stock,fee_cash,price_block,created_at,target_at,status) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'open')",
    [id, buyer.id, reporter.id, requestKey, terms.districtId, terms.minimumStock, terms.feeCash, priceBlock(now), new Date(now), new Date(terms.targetAt)]);
  buyer.cash = cash;
  await h.ledger(client, { characterId: buyer.id, currency: 'cash', amount: -terms.feeCash, reason: 'intel_job:post', counterparty: id });
  return { ok: true, job: view((await client.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [id])).rows[0]) };
}
// Receipt recovery never re-executes paid work, including after either original party dies.
export async function replayIntelForecastReport(ch, id, body, client) {
  let content; try { content = validateIntelForecastReport(body); } catch { fail('Submit only an explicit boolean prediction.'); }
  const row = await locked(client, id);
  const reporter = (await client.query('SELECT account_id FROM characters WHERE id=$1', [row.reporter_character])).rows[0];
  if (reporter?.account_id !== ch.account_id) fail('No assigned forecast receipt of yours.');
  if (row.status !== 'reported') return null;
  if (row.predicts_available !== content.predictsAvailable) fail('This job already has another report.');
  return { ok: true, job: view(row) };
}
export async function submitIntelForecastJob(reporter, buyer, id, body, client, h) {
  let content; try { content = validateIntelForecastReport(body); } catch { fail('Submit only an explicit boolean prediction.'); }
  const row = await locked(client, id);
  if (row.reporter_character !== reporter.id || row.buyer_character !== buyer.id || buyer.account_id === reporter.account_id) fail('No assigned forecast job.');
  if (row.status === 'reported') {
    if (row.predicts_available !== content.predictsAvailable) fail('This job already has another report.');
    return { ok: true, job: view(row) };
  }
  mobile(reporter);
  const start = Date.now(), target = new Date(row.target_at).getTime();
  if (row.status !== 'open' || start > target - INTEL_FORECAST.reportLeadMs) fail('This report is no longer timely.');
  const board = await marketPrices(client, priceBlock(start)), completed = Date.now();
  if (completed > target - INTEL_FORECAST.reportLeadMs || completed < start || priceBlock(completed) !== row.price_block
      || priceBlock(start) !== row.price_block) fail('The public observation crossed its timing boundary.');
  const observation = intelForecastSnapshot(board, row.district_id, completed), fee = Number(row.fee_cash);
  reporter.cash = money(reporter.cash, fee);
  await client.query("UPDATE intel_forecast_jobs SET status='reported',predicts_available=$2,reported_at=$3,observation=$4 WHERE id=$1",
    [id, content.predictsAvailable, new Date(completed), observation]);
  await h.ledger(client, { characterId: reporter.id, currency: 'cash', amount: fee, reason: 'intel_job:pay', counterparty: id });
  return { ok: true, job: view((await client.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [id])).rows[0]) };
}
export async function cancelIntelForecastJob(buyer, id, client, h) {
  const row = await locked(client, id); buyerOwns(buyer, row);
  if (row.status === 'cancelled' || row.status === 'expired') return { ok: true, job: view(row) };
  if (!buyer.alive || row.status !== 'open') fail('Only an open living-buyer escrow can be refunded.');
  buyer.cash = money(buyer.cash, Number(row.fee_cash));
  await h.ledger(client, { characterId: buyer.id, currency: 'cash', amount: Number(row.fee_cash), reason: 'intel_job:refund', counterparty: id });
  await client.query("UPDATE intel_forecast_jobs SET status='cancelled' WHERE id=$1", [id]);
  row.status = 'cancelled'; return { ok: true, job: view(row) };
}
export async function resolveIntelForecastOutcome(ch, id, client) {
  const row = await locked(client, id); await authorized(client, ch, row);
  if (row.status !== 'reported') fail('Only a paid timely report has a forecast outcome.');
  if (row.outcome != null) return { ok: true, job: view(row) };
  const start = Date.now(), target = new Date(row.target_at).getTime(), end = target + INTEL_FORECAST.scoreGraceMs;
  if (start < target) return { ok: true, pending: true, job: view(row) };
  let sample = null, sampleStarted = null, outcome = 'unknown', completed = start;
  if (start <= end && priceBlock(start) === row.price_block) {
    try {
      const board = await marketPrices(client, row.price_block); completed = Date.now();
      if (completed >= start && completed <= end && priceBlock(completed) === row.price_block) {
        sample = intelForecastSnapshot(board, row.district_id, completed); sampleStarted = new Date(start);
        outcome = intelForecastOutcome({ districtId: row.district_id, minimumStock: Number(row.minimum_stock), targetAt: iso(row.target_at),
          reportedAt: iso(row.reported_at), predictsAvailable: row.predicts_available, observation: row.observation }, sample, completed);
      }
    } catch (error) {
      // A database error aborts the transaction and must never be masked as a committed outcome.
      if (error?.code) throw error;
      completed = Date.now();
    }
  }
  await client.query('UPDATE intel_forecast_jobs SET outcome=$2,resolved_at=$3,sample_started_at=$4,sample=$5 WHERE id=$1',
    [id, outcome, new Date(completed), sampleStarted, sample]);
  return { ok: true, job: view((await client.query('SELECT * FROM intel_forecast_jobs WHERE id=$1', [id])).rows[0]) };
}
export async function intelForecastJobBoard(client, accountId) {
  const { rows } = await client.query(`SELECT j.* FROM intel_forecast_jobs j JOIN characters b ON b.id=j.buyer_character
    JOIN characters r ON r.id=j.reporter_character WHERE b.account_id=$1 OR r.account_id=$1 ORDER BY j.created_at DESC,j.id LIMIT 100`, [accountId]);
  return rows.map(view);
}
export async function expireIntelForecastJobs(pool, { limit = 100 } = {}) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) fail('Bound forecast recovery to at most100 jobs.');
  const due = (await pool.query(`SELECT j.id,j.buyer_character FROM intel_forecast_jobs j JOIN characters r ON r.id=j.reporter_character
    WHERE j.status='open' AND (j.target_at<=now()+interval '60 seconds' OR NOT r.alive) ORDER BY j.target_at,j.id LIMIT $1`, [limit])).rows;
  let refunded = 0;
  for (const candidate of due) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const buyer = (await client.query('SELECT id,alive,cash FROM characters WHERE id=$1 FOR UPDATE', [candidate.buyer_character])).rows[0];
      const row = await locked(client, candidate.id);
      if (row.status !== 'open') { await client.query('COMMIT'); continue; }
      if (!buyer?.alive) fail('Dead buyer escrow requires canonical estate recovery.');
      const reporter = (await client.query('SELECT alive FROM characters WHERE id=$1', [row.reporter_character])).rows[0];
      if (reporter?.alive && Date.now() < new Date(row.target_at).getTime() - INTEL_FORECAST.reportLeadMs) { await client.query('COMMIT'); continue; }
      money(buyer.cash, Number(row.fee_cash));
      await client.query('UPDATE characters SET cash=cash+$2 WHERE id=$1', [buyer.id, Number(row.fee_cash)]);
      await ledger(client, { characterId: buyer.id, currency: 'cash', amount: Number(row.fee_cash), reason: 'intel_job:refund', counterparty: row.id });
      await client.query("UPDATE intel_forecast_jobs SET status='expired' WHERE id=$1", [row.id]);
      await client.query('COMMIT'); refunded++;
    } catch (error) { await client.query('ROLLBACK').catch(() => {}); throw error; } finally { client.release(); }
  }
  return { refunded };
}
export async function voidIntelForecastJobsAtDeath(client, victimId, killerCh = null, lootRate = 0) {
  if (!Number.isFinite(lootRate) || lootRate < 0 || lootRate > 1) fail('Invalid canonical estate loot rate.');
  const rows = (await client.query("SELECT * FROM intel_forecast_jobs WHERE buyer_character=$1 AND status='open' ORDER BY id FOR UPDATE", [victimId])).rows;
  let looted = 0;
  for (const row of rows) {
    const fee = Number(row.fee_cash), loot = killerCh ? Math.floor(fee * lootRate) : 0;
    if (loot) {
      killerCh.cash = money(killerCh.cash, loot); looted += loot;
      await ledger(client, { characterId: killerCh.id, currency: 'cash', amount: loot, reason: 'whack:loot', counterparty: victimId });
      await ledger(client, { currency: 'cash', amount: -loot, reason: 'intel_job:loot', counterparty: row.id });
    }
    if (fee > loot) await ledger(client, { currency: 'cash', amount: -(fee - loot), reason: 'intel_job:death', counterparty: row.id });
    await client.query("UPDATE intel_forecast_jobs SET status='buyer_dead' WHERE id=$1", [row.id]);
  }
  return { looted };
}
