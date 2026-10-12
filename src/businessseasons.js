import crypto from 'node:crypto';
import fs from 'node:fs';
import { GameError } from './game.js';

const sourceFiles = ['businessseasons.js', 'depot.js', 'depotbook.js', 'warehouseleases.js', 'franchiselicenses.js'];
const sourceFingerprint = crypto.createHash('sha256').update(sourceFiles.map(name => `${name}\n${fs.readFileSync(new URL(name, import.meta.url), 'utf8').replace(/\r\n/g, '\n')}`).join('\n')).digest('hex');
export const BUSINESS_SEASONS = Object.freeze({ maxCompanies: 10, journalLimit: 1000, graceSeconds: 60,
  accountingVersion: 'depot-realized-journal-v1', canonicalRevision: '07dd9d862e353a39cd06fa90af87620fc0d8a79f', sourceFingerprint });
const fail = reason => { throw new GameError('business_season', reason); };
const person = ch => { if (!ch?.alive || ch.is_npc || !ch.account_id) fail('character'); };
const id = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) fail('identifier'); return value; };
const exact = (body, fields) => { if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).sort().join(',') !== [...fields].sort().join(',')) fail('terms'); };
const hash = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const clock = async client => new Date((await client.query('SELECT clock_timestamp() AS at')).rows[0].at);
const one = async (client, sql, args) => (await client.query(sql, args)).rows[0] || null;
const sourcePin = () => ({ accountingVersion: BUSINESS_SEASONS.accountingVersion, canonicalRevision: BUSINESS_SEASONS.canonicalRevision, sourceFingerprint });
const neutral = new Set(['fund', 'withdraw', 'restock_escrow', 'restock_refund', 'receive', 'inventory_withdrawal', 'warehouse_deposit', 'warehouse_withdraw', 'warehouse_tenant_death']);

export function businessSeasonJournalResult(rows) {
  let revenue = 0, cogs = 0, expenses = 0, sales = 0, stockouts = 0, unitsSold = 0;
  for (const row of rows) {
    const cash = Number(row.cash_delta), stock = Number(row.stock_delta), cost = Number(row.cost_delta), expense = Number(row.expense);
    if (![cash, stock, cost, expense].every(Number.isSafeInteger) || expense < 0) return { known: false, reason: 'source_values' };
    if (row.reason === 'sale') {
      if (cash <= 0 || stock >= 0 || cost > 0 || expense !== 0 || !Number.isSafeInteger(row.stock_after) || row.stock_after < 0 || row.stock_after > 40) return { known: false, reason: 'source_values' };
      revenue += cash; cogs -= cost; unitsSold -= stock; sales++; if (Number(row.stock_after) === 0) stockouts++;
    } else if (['warehouse_rent', 'royalty_income'].includes(row.reason)) {
      if (cash <= 0 || cost !== 0 || stock !== 0 || expense !== 0) return { known: false, reason: 'source_values' };
      revenue += cash;
    } else if (['restock_fee', 'royalty_expense'].includes(row.reason)) {
      if (expense !== -cash || cash >= 0 || stock !== 0 || cost !== 0) return { known: false, reason: 'source_values' };
      expenses += expense;
    } else if (row.reason === 'open') {
      if (cash !== 0 || stock !== 0 || cost !== 0 || expense <= 0) return { known: false, reason: 'source_values' };
      expenses += expense;
    } else if (!neutral.has(row.reason) || expense !== 0) return { known: false, reason: 'unknown_reason' };
  }
  const result = revenue - cogs - expenses;
  if (![revenue, cogs, expenses, result, unitsSold].every(Number.isSafeInteger)) return { known: false, reason: 'source_values' };
  return { known: true, revenue, costOfGoodsSold: cogs, expenses, operatingResult: result, sales, stockoutSales: stockouts, unitsSold };
}
async function snapshot(client, depot, at) {
  const rows = (await client.query('SELECT id,reason,cash_delta,stock_delta,cost_delta,expense,stock_after FROM business_depot_journal WHERE depot_id=$1 ORDER BY id LIMIT 1001', [depot.id])).rows;
  if (depot.status !== 'open') return { known: false, reason: 'depot_closed', observedAt: at.toISOString(), ...sourcePin() };
  if (rows.length > BUSINESS_SEASONS.journalLimit) return { known: false, reason: 'source_limit', observedAt: at.toISOString(), ...sourcePin() };
  const normalized = rows.map(r => ({ id: r.id, reason: r.reason, cash_delta: Number(r.cash_delta), stock_delta: Number(r.stock_delta), cost_delta: Number(r.cost_delta), expense: Number(r.expense), stock_after: r.stock_after === null ? null : Number(r.stock_after) }));
  return { ...businessSeasonJournalResult(normalized), observedAt: at.toISOString(), rows: normalized, sourceHash: hash(normalized), ...sourcePin() };
}
async function visible(client, account) {
  const company = await one(client, 'SELECT name,published FROM agent_company_profiles WHERE account_id=$1', [account]);
  const reputation = await one(client, 'SELECT published FROM commercial_reputation_publications WHERE account_id=$1', [account]);
  return company?.published && reputation?.published ? company.name : null;
}
const seasonView = row => ({ id: row.id, name: row.name, enrollmentClosesAt: new Date(row.starts_at).toISOString(), endsAt: new Date(row.ends_at).toISOString(), maxCompanies: Number(row.max_companies), prize: 0, accounting: BUSINESS_SEASONS.accountingVersion, observationGraceSeconds: 60 });

// Caller owns G.withCharacter transaction. Replay binds original actor and terms.
export async function createBusinessSeason(ch, body, requestKey, client) {
  person(ch); exact(body, ['name', 'enrollmentSeconds', 'durationSeconds', 'maxCompanies']); id(requestKey);
  if (typeof body.name !== 'string' || !/^[A-Za-z0-9 ._-]{3,64}$/.test(body.name)
      || !Number.isSafeInteger(body.enrollmentSeconds) || body.enrollmentSeconds < 60 || body.enrollmentSeconds > 3600
      || !Number.isSafeInteger(body.durationSeconds) || body.durationSeconds < 60 || body.durationSeconds > 86400
      || !Number.isSafeInteger(body.maxCompanies) || body.maxCompanies < 2 || body.maxCompanies > 10) fail('terms');
  const bodyHash = hash([ch.account_id, ch.id, body.name, body.enrollmentSeconds, body.durationSeconds, body.maxCompanies]);
  const prior = await one(client, 'SELECT * FROM business_seasons WHERE creator_account=$1 AND request_key=$2', [ch.account_id, requestKey]);
  if (prior) { if (prior.body_hash !== bodyHash) fail('request_conflict'); return { ok: true, season: seasonView(prior) }; }
  if (!(await one(client, 'SELECT account_id FROM agent_company_profiles WHERE account_id=$1', [ch.account_id]))) fail('company');
  if ((await client.query('SELECT id FROM business_seasons WHERE creator_account=$1 AND ends_at>clock_timestamp() LIMIT 2', [ch.account_id])).rows.length >= 2) fail('active_limit');
  const now = await clock(client), starts = new Date(+now + body.enrollmentSeconds * 1000), ends = new Date(+starts + body.durationSeconds * 1000);
  const row = { id: crypto.randomUUID(), creator_account: ch.account_id, name: body.name, starts_at: starts, ends_at: ends, max_companies: body.maxCompanies };
  await client.query('INSERT INTO business_seasons(id,creator_account,request_key,body_hash,name,starts_at,ends_at,max_companies,source_pin) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)', [row.id, ch.account_id, requestKey, bodyHash, row.name, starts, ends, body.maxCompanies, JSON.stringify(sourcePin())]);
  return { ok: true, season: seasonView(row) };
}
export async function enrollBusinessSeason(ch, body, client) {
  person(ch); exact(body, ['seasonId', 'depotId', 'published']); id(body.seasonId); id(body.depotId); if (typeof body.published !== 'boolean') fail('terms');
  const bodyHash = hash([ch.account_id, ch.id, body.seasonId, body.depotId, body.published]);
  const prior = await one(client, 'SELECT * FROM business_season_entries WHERE season_id=$1 AND account_id=$2', [body.seasonId, ch.account_id]);
  if (prior) { if (prior.body_hash !== bodyHash) fail('enrollment_conflict'); return prior.enrollment_receipt; }
  const depot = await one(client, 'SELECT * FROM business_depots WHERE id=$1 AND owner_character=$2 FOR UPDATE', [body.depotId, ch.id]);
  const season = await one(client, 'SELECT * FROM business_seasons WHERE id=$1 FOR UPDATE', [body.seasonId]);
  const now = await clock(client);
  if (!depot || depot.status !== 'open') fail('original_owner');
  if (!season || +now >= +new Date(season.starts_at)) fail('enrollment_closed');
  if (!(await one(client, 'SELECT account_id FROM agent_company_profiles WHERE account_id=$1', [ch.account_id]))) fail('company');
  if (body.published && !(await visible(client, ch.account_id))) fail('publication');
  const entries = (await client.query('SELECT account_id FROM business_season_entries WHERE season_id=$1 LIMIT 10', [season.id])).rows;
  if (entries.length >= Number(season.max_companies)) fail('cohort_limit');
  const ownActive = (await client.query('SELECT e.season_id FROM business_season_entries e JOIN business_seasons s ON s.id=e.season_id WHERE e.account_id=$1 AND s.ends_at>clock_timestamp() LIMIT 3', [ch.account_id])).rows;
  if (ownActive.length >= 3) fail('active_limit');
  const receipt = { ok: true, seasonId: season.id, depotId: depot.id, enrolledAt: now.toISOString(), published: body.published, revision: 1 };
  await client.query('INSERT INTO business_season_entries(season_id,account_id,original_character,depot_id,body_hash,published,enrollment_receipt) VALUES($1,$2,$3,$4,$5,$6,$7)', [season.id, ch.account_id, ch.id, depot.id, bodyHash, body.published, JSON.stringify(receipt)]);
  return receipt;
}
export async function setBusinessSeasonVisibility(ch, body, client) {
  person(ch); exact(body, ['seasonId', 'published', 'expectedRevision']); id(body.seasonId);
  if (typeof body.published !== 'boolean' || !Number.isSafeInteger(body.expectedRevision) || body.expectedRevision < 1 || body.expectedRevision >= 2147483647) fail('terms');
  const entry = await one(client, 'SELECT * FROM business_season_entries WHERE season_id=$1 AND account_id=$2 FOR UPDATE', [body.seasonId, ch.account_id]);
  if (!entry) fail('entry'); if (Number(entry.visibility_revision) !== body.expectedRevision) fail('revision');
  if (body.published && !(await visible(client, ch.account_id))) fail('publication');
  await client.query('UPDATE business_season_entries SET published=$3,visibility_revision=$4 WHERE season_id=$1 AND account_id=$2', [body.seasonId, ch.account_id, body.published, body.expectedRevision + 1]);
  return { ok: true, published: body.published, revision: body.expectedRevision + 1 };
}

export async function observeBusinessSeason(ch, seasonId, client) {
  person(ch); id(seasonId);
  const hint = await one(client, 'SELECT depot_id FROM business_season_entries WHERE season_id=$1 AND account_id=$2', [seasonId, ch.account_id]);
  if (!hint) fail('entry');
  const depot = await one(client, 'SELECT * FROM business_depots WHERE id=$1 FOR UPDATE', [hint.depot_id]);
  const season = await one(client, 'SELECT * FROM business_seasons WHERE id=$1 FOR UPDATE', [seasonId]);
  const entry = await one(client, 'SELECT * FROM business_season_entries WHERE season_id=$1 AND account_id=$2 FOR UPDATE', [seasonId, ch.account_id]);
  if (entry.final_result) return { ok: true, phase: 'finished', result: entry.final_result };
  const now = await clock(client);
  if (+now < +new Date(season.starts_at)) return { ok: true, phase: 'waiting' };
  const original = await one(client, 'SELECT account_id,alive FROM characters WHERE id=$1', [entry.original_character]);
  let current = depot?.owner_character === entry.original_character && original?.account_id === ch.account_id && original.alive
    ? await snapshot(client, depot, now) : { known: false, reason: 'source_identity', observedAt: now.toISOString(), ...sourcePin() };
  if (season.source_pin.sourceFingerprint !== sourceFingerprint || season.source_pin.accountingVersion !== BUSINESS_SEASONS.accountingVersion)
    current = { known: false, reason: 'source_version', observedAt: now.toISOString(), ...sourcePin() };
  if (+now < +new Date(season.ends_at)) {
    if (!entry.baseline) await client.query('UPDATE business_season_entries SET baseline=$3 WHERE season_id=$1 AND account_id=$2', [seasonId, ch.account_id, JSON.stringify(current)]);
    return { ok: true, phase: 'running', baseline: entry.baseline || current };
  }
  let result = { known: false, reason: 'missing_baseline', observedAt: now.toISOString(), ...sourcePin() };
  if (entry.baseline) {
    const baseline = entry.baseline;
    if (!baseline.known || !current.known) result = { known: false, reason: current.reason || baseline.reason, observedAt: now.toISOString(), ...sourcePin() };
    else if (baseline.sourceFingerprint !== current.sourceFingerprint || baseline.accountingVersion !== current.accountingVersion) result = { known: false, reason: 'source_version', observedAt: now.toISOString(), ...sourcePin() };
    else {
      const old = new Map(baseline.rows.map(row => [row.id, row]));
      const preserved = baseline.sourceHash === hash(baseline.rows) && baseline.rows.every(row => current.rows.some(latest => latest.id === row.id && hash(latest) === hash(row)));
      if (!preserved) result = { known: false, reason: 'source_changed', observedAt: now.toISOString(), ...sourcePin() };
      else {
        const added = current.rows.filter(row => !old.has(row.id));
        const metrics = businessSeasonJournalResult(added);
        const coverage = +new Date(baseline.observedAt) - +new Date(season.starts_at) <= 60000 && +now - +new Date(season.ends_at) <= 60000 ? 'observed' : 'partial';
        result = { ...metrics, coverage, startObservedAt: baseline.observedAt, endObservedAt: now.toISOString(), scheduledStartsAt: new Date(season.starts_at).toISOString(), scheduledEndsAt: new Date(season.ends_at).toISOString(), journalCount: added.length, baselineHash: baseline.sourceHash, endHash: current.sourceHash, ...sourcePin() };
      }
    }
  }
  await client.query('UPDATE business_season_entries SET end_snapshot=$3,final_result=$4 WHERE season_id=$1 AND account_id=$2', [seasonId, ch.account_id, JSON.stringify(current), JSON.stringify(result)]);
  return { ok: true, phase: 'finished', result };
}

export async function businessSeasonBoard(client, account) {
  id(account);
  const entries = (await client.query('SELECT e.*,s.name,s.starts_at,s.ends_at,s.max_companies FROM business_season_entries e JOIN business_seasons s ON s.id=e.season_id WHERE e.account_id=$1 ORDER BY s.ends_at DESC,e.season_id LIMIT 10', [account])).rows;
  const open = (await client.query('SELECT * FROM business_seasons WHERE starts_at>clock_timestamp() ORDER BY starts_at,id LIMIT 25')).rows;
  return { entries: entries.map(e => ({ season: seasonView({ ...e, id: e.season_id }), depotId: e.depot_id, originalCharacter: e.original_character, published: e.published, visibilityRevision: Number(e.visibility_revision), baseline: e.baseline ? { known: e.baseline.known, observedAt: e.baseline.observedAt, sourceHash: e.baseline.sourceHash, sourceFingerprint: e.baseline.sourceFingerprint } : null, result: e.final_result })), openSeasons: open.map(seasonView), prize: 0 };
}
export async function dueBusinessSeasonEntries(client, limit = 25) {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 25) fail('candidate_limit');
  return (await client.query('SELECT e.season_id,e.account_id,e.original_character FROM business_season_entries e JOIN business_seasons s ON s.id=e.season_id WHERE e.final_result IS NULL AND s.starts_at<=clock_timestamp() AND (e.baseline IS NULL OR s.ends_at<=clock_timestamp()) ORDER BY s.ends_at,e.season_id,e.account_id LIMIT $1', [limit])).rows;
}
export async function publicBusinessSeason(client, seasonId) {
  id(seasonId);
  const season = await one(client, 'SELECT * FROM business_seasons WHERE id=$1', [seasonId]);
  if (!season) return { available: false };
  const entries = (await client.query('SELECT e.final_result,c.name FROM business_season_entries e JOIN agent_company_profiles c ON c.account_id=e.account_id JOIN commercial_reputation_publications r ON r.account_id=e.account_id WHERE e.season_id=$1 AND e.published AND c.published AND r.published ORDER BY e.account_id LIMIT 10', [seasonId])).rows;
  const standings = [];
  for (const entry of entries) {
    const result = entry.final_result, ranked = result?.known === true && result.coverage === 'observed';
    standings.push({ companyName: entry.name, coverage: result ? result.known ? result.coverage : 'unknown' : 'pending', ranked,
      observedStartsAt: result?.startObservedAt || null, observedEndsAt: result?.endObservedAt || result?.observedAt || null,
      operatingResultBand: ranked ? result.operatingResult > 0 ? 'positive' : result.operatingResult < 0 ? 'negative' : 'flat' : null,
      observedSaleDepletion: ranked ? result.sales > 0 ? result.stockoutSales > 0 ? 'observed' : 'none_observed' : 'no_sales' : null });
  }
  // Cohort results disclose only bands and ties; no exact money, IDs or hidden ranking.
  const order = { positive: 0, flat: 1, negative: 2 };
  standings.sort((a, b) => (a.ranked ? order[a.operatingResultBand] : 3) - (b.ranked ? order[b.operatingResultBand] : 3) || a.companyName.localeCompare(b.companyName));
  return { available: true, season: seasonView(season), standings, prize: 0, measurement: 'Actual observed Depot journal window; sale depletion events only, no fulfillment guarantee.' };
}
