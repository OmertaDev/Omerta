// PUBLIC FAMILY RWA NOMINATIONS — immutable candidate/evidence snapshots, current seated-family
// support, append-only events, one reviewer claim, and hard original deadlines. HTTP/reviewer
// authentication and Safe packages deliberately belong to the next slice.
import crypto from 'node:crypto';
import { getAddress, keccak256, toBytes } from 'viem';
import { seatedGangs } from './commission.js';
import { dbCaps } from './db.js';
import { GameError } from './game.js';
import { computeStockAssetVersionKey, ROBINHOOD_CHAIN_ID_V2 } from './stockcatalogv2.js';

const OPEN = new Set(['pending', 'review_requested', 'under_review']);
const TERMINAL = new Set(['approved', 'rejected', 'not_eligible', 'expired']);
const DISPOSITIONS = new Set(['approved', 'rejected', 'not_eligible']);
const SUPPORT_THRESHOLD = 3;
const CADENCE_MS = 168 * 60 * 60 * 1000;
const PENDING_MS = 30 * 24 * 60 * 60 * 1000;
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const ZERO_HASH = `0x${'00'.repeat(32)}`;
const SAFE_TEXT = /^[^<>"\x60\x00-\x1f\x7f]*$/;

const fail = (code, message, data) => { throw new GameError(code, message, data); };
const sameId = (a, b) => String(a) === String(b);

function strictText(value, field, { min = 1, max, optional = false } = {}) {
  if (value == null && optional) return null;
  if (typeof value !== 'string' || value !== value.trim() || value.length < min || value.length > max
      || !SAFE_TEXT.test(value)) {
    fail(`bad_${field}`, `Invalid ${field.replaceAll('_', ' ')}.`);
  }
  return value;
}

function strictHash(value, field, code = `bad_${field}`) {
  if (typeof value !== 'string' || !/^0x[0-9a-f]{64}$/.test(value) || value === ZERO_HASH) {
    fail(code, `Invalid ${field.replaceAll('_', ' ')}.`);
  }
  return value;
}

function strictAddress(value) {
  if (typeof value !== 'string') fail('bad_address', 'Invalid token address.');
  let normalized;
  try { normalized = getAddress(value); }
  catch { fail('bad_address', 'Invalid token address.'); }
  if (/^0x0{40}$/i.test(normalized)) fail('bad_address', 'Invalid token address.');
  return normalized;
}

function evidenceUri(value) {
  if (value == null) return null;
  const uri = strictText(value, 'evidence_uri', { max: 2048 });
  let parsed;
  try { parsed = new URL(uri); }
  catch { fail('bad_evidence_uri', 'Evidence URI must be HTTPS or IPFS.'); }
  if (!['https:', 'ipfs:'].includes(parsed.protocol) || !parsed.hostname) {
    fail('bad_evidence_uri', 'Evidence URI must be HTTPS or IPFS.');
  }
  return uri;
}

function candidateInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail('bad_nomination', 'Invalid nomination.');
  if (input.chainId !== ROBINHOOD_CHAIN_ID_V2) fail('bad_chain', 'RWA nominations are pinned to chain 4663.');
  if (typeof input.ticker !== 'string' || !/^[A-Z0-9._-]{1,24}$/.test(input.ticker)) {
    fail('bad_ticker', 'Ticker must already be normalized uppercase ASCII.');
  }
  const name = strictText(input.name, 'name', { max: 120 });
  const tokenAddress = strictAddress(input.tokenAddress);
  if (typeof input.tokenDecimals !== 'number' || !Number.isInteger(input.tokenDecimals)
      || input.tokenDecimals < 0 || input.tokenDecimals > 255) {
    fail('bad_decimals', 'Token decimals must be an integer from 0 through 255.');
  }
  const robinhoodAssetIdHash = strictHash(input.robinhoodAssetIdHash, 'hash', 'bad_hash');
  const evidenceHash = strictHash(input.evidenceHash, 'evidence', 'bad_evidence');
  const rationale = strictText(input.rationale, 'rationale', { max: 2000 });
  const uri = evidenceUri(input.evidenceUri);
  const submittedKey = strictHash(input.assetVersionKey, 'asset_key', 'bad_asset_key');
  const computedKey = computeStockAssetVersionKey({
    chainId: input.chainId,
    ticker: input.ticker,
    tokenAddress,
    robinhoodAssetIdHash,
  });
  if (submittedKey !== computedKey) fail('asset_key_mismatch', 'Candidate identity does not match its version key.');
  return {
    assetVersionKey: computedKey,
    chainId: input.chainId,
    ticker: input.ticker,
    tickerHash: keccak256(toBytes(input.ticker)),
    tokenAddress,
    tokenDecimals: input.tokenDecimals,
    robinhoodAssetIdHash,
    name,
    rationale,
    evidenceHash,
    evidenceUri: uri,
  };
}

function nominationId(value) {
  return strictText(value, 'nomination', { max: 200 });
}

function reviewerId(value) {
  return strictText(value, 'reviewer', { max: 200 });
}

function pageOptions(options = {}, kind) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) fail('bad_page', 'Invalid page options.');
  const limit = options.limit ?? DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) fail('bad_limit', `Limit must be 1 through ${MAX_LIMIT}.`);
  let cursor = null;
  if (options.cursor != null) {
    if (typeof options.cursor !== 'string' || !options.cursor || options.cursor.length > 1000) {
      fail('bad_cursor', 'Invalid cursor.');
    }
    try {
      cursor = JSON.parse(Buffer.from(options.cursor, 'base64url').toString('utf8'));
    } catch { fail('bad_cursor', 'Invalid cursor.'); }
    if (!cursor || cursor.kind !== kind || typeof cursor.id !== 'string' || typeof cursor.at !== 'string'
        || !Number.isFinite(new Date(cursor.at).getTime())) {
      fail('bad_cursor', 'Invalid cursor.');
    }
    if (kind === 'board' && (!Number.isInteger(cursor.support) || cursor.support < 0 || cursor.support > 5)) {
      fail('bad_cursor', 'Invalid cursor.');
    }
  }
  return { limit, cursor };
}

function nextCursor(kind, row, support) {
  if (!row) return null;
  const payload = { kind, at: new Date(row.created_at ?? row.pending_until).toISOString(), id: String(row.id) };
  if (kind === 'board') payload.support = support;
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

async function wallClock(db) {
  // PostgreSQL now() is transaction-start time and is therefore unsafe after a row-lock wait. The
  // pg-mem adapter has no clock_timestamp(), so its declared capability uses statement-time now();
  // focused tests intercept only this labelled query to drive exact equality deterministically.
  const fn = dbCaps.skipLocked ? 'clock_timestamp()' : 'now()';
  const row = (await db.query(`SELECT ${fn} AS wall_now /* rwa_wall_clock */`)).rows[0];
  const at = new Date(row?.wall_now);
  if (!Number.isFinite(at.getTime())) throw new Error('database wall clock returned an invalid timestamp');
  return at;
}

async function inTransaction(db, fn) {
  if (typeof db?.connect !== 'function') return fn(db);
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function lockCurrentFamily(ch, client) {
  const member = (await client.query(
    'SELECT gang_id, role FROM gang_members WHERE character_id=$1 FOR UPDATE', [ch.id],
  )).rows[0];
  if (!member) return null;
  const family = (await client.query('SELECT id FROM gangs WHERE id=$1 FOR UPDATE', [member.gang_id])).rows[0];
  return family ? member : null;
}

async function authorityState(member, client) {
  if (!member || !['boss', 'underboss'].includes(member.role)) {
    return { error: 'rank' };
  }
  const seats = await seatedGangs(client);
  if (!seats.some((seat) => sameId(seat.id, member.gang_id))) {
    return { error: 'no_seat' };
  }
  return { familyId: String(member.gang_id), role: member.role, seats };
}

async function requireAuthority(member, client) {
  const authority = await authorityState(member, client);
  if (authority.error === 'rank') fail('rank', 'Only a current family boss or underboss may speak here.');
  if (authority.error === 'no_seat') fail('no_seat', 'Only a currently seated Commission family may speak here.');
  return authority;
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

async function appendEvent(client, {
  nominationId: id, eventType, familyId = null, accountId = null,
  actorType, actorId, details = {}, at,
}) {
  const publicDetails = stable(details);
  const detailsHash = keccak256(toBytes(JSON.stringify(publicDetails)));
  await client.query(
    `INSERT INTO rwa_nomination_events_v2
      (event_id,nomination_id,event_type,family_id,account_id,actor_type,actor_id,details_hash,details,created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [crypto.randomUUID(), id, eventType, familyId, accountId, actorType, actorId,
      detailsHash, JSON.stringify(publicDetails), at],
  );
}

async function seatSet(client) {
  return new Set((await seatedGangs(client)).map((seat) => String(seat.id)));
}

async function endorsements(client, id) {
  return (await client.query(
    'SELECT nomination_id,family_id,account_id,active,rationale,updated_at FROM rwa_nomination_endorsements_v2 WHERE nomination_id=$1',
    [id],
  )).rows;
}

function supportOf(row, slots, seats) {
  let support = row.sponsor_support_active && seats.has(String(row.sponsor_family_id)) ? 1 : 0;
  for (const slot of slots) {
    if (slot.active && !sameId(slot.family_id, row.sponsor_family_id) && seats.has(String(slot.family_id))) support++;
  }
  return support;
}

async function expireLocked(client, row, at, actor = { type: 'system', id: 'expiry' }) {
  if (!OPEN.has(row.status) || at.getTime() < new Date(row.pending_until).getTime()) return false;
  await client.query("UPDATE rwa_nominations_v2 SET status='expired' WHERE id=$1", [row.id]);
  row.status = 'expired';
  await appendEvent(client, {
    nominationId: row.id,
    eventType: 'expired',
    actorType: actor.type,
    actorId: actor.id,
    details: { pendingUntil: new Date(row.pending_until).toISOString() },
    at,
  });
  return true;
}

async function refreshLocked(client, row, at, suppliedSeats) {
  if (!OPEN.has(row.status)) {
    const seats = suppliedSeats ?? await seatSet(client);
    return { row, slots: await endorsements(client, row.id), seats, changed: false };
  }
  if (await expireLocked(client, row, at)) {
    const seats = suppliedSeats ?? await seatSet(client);
    return { row, slots: await endorsements(client, row.id), seats, changed: true };
  }
  const seats = suppliedSeats ?? await seatSet(client);
  let changed = false;
  if (row.sponsor_support_active && !seats.has(String(row.sponsor_family_id))) {
    await client.query('UPDATE rwa_nominations_v2 SET sponsor_support_active=false WHERE id=$1', [row.id]);
    row.sponsor_support_active = false;
    changed = true;
    await appendEvent(client, {
      nominationId: row.id,
      eventType: 'sponsor_seat_lost',
      familyId: row.sponsor_family_id,
      accountId: row.sponsor_account_id,
      actorType: 'system',
      actorId: 'seat-refresh',
      details: {},
      at,
    });
  }
  const slots = await endorsements(client, row.id);
  for (const slot of slots) {
    if (slot.active && !seats.has(String(slot.family_id))) {
      await client.query(
        'UPDATE rwa_nomination_endorsements_v2 SET active=false,updated_at=$3 WHERE nomination_id=$1 AND family_id=$2',
        [row.id, slot.family_id, at],
      );
      slot.active = false;
      changed = true;
      await appendEvent(client, {
        nominationId: row.id,
        eventType: 'endorsement_seat_lost',
        familyId: slot.family_id,
        accountId: slot.account_id,
        actorType: 'system',
        actorId: 'seat-refresh',
        details: {},
        at,
      });
    }
  }
  const support = supportOf(row, slots, seats);
  const wanted = support >= SUPPORT_THRESHOLD ? 'review_requested' : 'pending';
  if (['pending', 'review_requested'].includes(row.status) && row.status !== wanted) {
    const prior = row.status;
    await client.query('UPDATE rwa_nominations_v2 SET status=$2 WHERE id=$1', [row.id, wanted]);
    row.status = wanted;
    changed = true;
    await appendEvent(client, {
      nominationId: row.id,
      eventType: wanted === 'review_requested' ? 'review_requested' : 'review_request_demoted',
      actorType: 'system',
      actorId: 'support-threshold',
      details: { from: prior, support, threshold: SUPPORT_THRESHOLD },
      at,
    });
  }
  return { row, slots, seats, changed };
}

function nominationView(row, support, extras = {}) {
  return {
    id: String(row.id),
    assetVersionKey: row.asset_version_key,
    chainId: String(row.chain_id),
    ticker: row.ticker,
    tickerHash: row.ticker_hash,
    tokenAddress: row.token_address,
    tokenDecimals: Number(row.token_decimals),
    robinhoodAssetIdHash: row.robinhood_asset_id_hash,
    name: row.name,
    sponsorFamilyId: String(row.sponsor_family_id),
    sponsorSupportActive: Boolean(row.sponsor_support_active),
    rationale: row.rationale,
    evidenceHash: row.evidence_hash,
    evidenceUri: row.evidence_uri,
    priorNominationId: row.prior_nomination_id,
    status: row.status,
    executionStatus: row.execution_status,
    support,
    supportThreshold: SUPPORT_THRESHOLD,
    createdAt: new Date(row.created_at).toISOString(),
    pendingUntil: new Date(row.pending_until).toISOString(),
    claimedBy: row.claimed_by,
    claimedAt: row.claimed_at ? new Date(row.claimed_at).toISOString() : null,
    dispositionBy: row.disposition_by,
    dispositionAt: row.disposition_at ? new Date(row.disposition_at).toISOString() : null,
    dispositionReason: row.disposition_reason,
    approvedAt: row.approved_at ? new Date(row.approved_at).toISOString() : null,
    validUntil: row.valid_until ? new Date(row.valid_until).toISOString() : null,
    ...extras,
  };
}

async function viewLocked(client, row, at, suppliedSeats, extras) {
  const refreshed = await refreshLocked(client, row, at, suppliedSeats);
  return nominationView(refreshed.row, supportOf(refreshed.row, refreshed.slots, refreshed.seats), extras);
}

async function openByKey(client, key) {
  return (await client.query(
    "SELECT * FROM rwa_nominations_v2 WHERE asset_version_key=$1 AND status IN ('pending','review_requested','under_review') FOR UPDATE",
    [key],
  )).rows[0];
}

export async function createRwaNomination(ch, input, client, h) {
  const candidate = candidateInput(input);
  const member = await lockCurrentFamily(ch, client);
  // The sponsor-family lock serializes same-family different-key cadence checks. Same-key families
  // may proceed independently to PostgreSQL's partial unique index.
  // lockCurrentFamily already holds the actor's current family row when membership exists.
  let authority;
  let existing = await openByKey(client, candidate.assetVersionKey);
  const at = await wallClock(client);
  let justExpiredPriorId = null;
  let justExpiredNomination = null;
  if (existing) {
    const nomination = await viewLocked(client, existing, at);
    if (existing.status !== 'expired') {
      authority = await requireAuthority(member, client);
      return {
        nomination,
        duplicate: true,
        endorsementAvailable: !sameId(authority.familyId, existing.sponsor_family_id),
        requestingFamilyId: authority.familyId,
      };
    }
    justExpiredPriorId = existing.id;
    justExpiredNomination = nomination;
    existing = null;
  }
  const state = await authorityState(member, client);
  if (state.error && justExpiredNomination) {
    return {
      nomination: justExpiredNomination,
      duplicate: false,
      expired: true,
      creationRefused: state.error,
      requestingFamilyId: member?.gang_id ? String(member.gang_id) : null,
    };
  }
  authority = await requireAuthority(member, client);
  const previousByFamily = (await client.query(
    'SELECT id,created_at FROM rwa_nominations_v2 WHERE sponsor_family_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1 FOR UPDATE',
    [authority.familyId],
  )).rows[0];
  if (previousByFamily && at.getTime() - new Date(previousByFamily.created_at).getTime() < CADENCE_MS) {
    const eligibleAt = new Date(new Date(previousByFamily.created_at).getTime() + CADENCE_MS).toISOString();
    if (justExpiredNomination) {
      return {
        nomination: justExpiredNomination,
        duplicate: false,
        expired: true,
        creationRefused: 'nomination_cooldown',
        eligibleAt,
        requestingFamilyId: authority.familyId,
      };
    }
    fail('nomination_cooldown', 'That family has already opened a nomination in the rolling seven-day window.', {
      eligibleAt,
    });
  }
  const prior = (await client.query(
    `SELECT id FROM rwa_nominations_v2 WHERE asset_version_key=$1
       AND status IN ('approved','rejected','not_eligible','expired')
     ORDER BY created_at DESC,id DESC LIMIT 1`,
    [candidate.assetVersionKey],
  )).rows[0];
  const id = crypto.randomUUID();
  const pendingUntil = new Date(at.getTime() + PENDING_MS);
  const inserted = (await client.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,sponsor_support_active,
       rationale,evidence_hash,evidence_uri,prior_nomination_id,status,execution_status,created_at,pending_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,true,$12,$13,$14,$15,'pending','not_applicable',$16,$17)
     ON CONFLICT DO NOTHING RETURNING *`,
    [id, candidate.assetVersionKey, 4663, candidate.ticker, candidate.tickerHash,
      candidate.tokenAddress, candidate.tokenDecimals, candidate.robinhoodAssetIdHash, candidate.name,
      authority.familyId, ch.account_id, candidate.rationale, candidate.evidenceHash, candidate.evidenceUri,
      prior?.id ?? justExpiredPriorId, at, pendingUntil],
  )).rows[0];
  if (!inserted) {
    // In PostgreSQL this statement runs only after the winning unique-index transaction resolves,
    // so the open row is visible in this same READ COMMITTED transaction. Do not translate arbitrary
    // SQL failures into duplicates; only zero RETURNING rows enter this branch.
    existing = await openByKey(client, candidate.assetVersionKey);
    if (!existing) fail('contention', 'The nomination changed while it was being opened; retry.');
    const nomination = await viewLocked(client, existing, at);
    return {
      nomination,
      duplicate: true,
      endorsementAvailable: !sameId(authority.familyId, existing.sponsor_family_id),
      requestingFamilyId: authority.familyId,
    };
  }
  await appendEvent(client, {
    nominationId: id,
    eventType: 'nomination_created',
    familyId: authority.familyId,
    accountId: ch.account_id,
    actorType: 'player',
    actorId: ch.account_id,
    details: { assetVersionKey: candidate.assetVersionKey, evidenceHash: candidate.evidenceHash },
    at,
  });
  return {
    nomination: nominationView(inserted, 1),
    duplicate: false,
    endorsementAvailable: false,
    requestingFamilyId: authority.familyId,
  };
}

function endorsementInput(input) {
  if (!input || typeof input !== 'object' || typeof input.active !== 'boolean') {
    fail('bad_endorsement', 'Endorsement active must be a boolean.');
  }
  const rationale = input.rationale == null
    ? null
    : strictText(input.rationale, 'rationale', { max: 1000 });
  return { active: input.active, rationale };
}

async function lockedNomination(client, id) {
  const row = (await client.query('SELECT * FROM rwa_nominations_v2 WHERE id=$1 FOR UPDATE', [id])).rows[0];
  if (!row) fail('nomination_not_found', 'No such nomination.');
  return row;
}

export async function setRwaNominationEndorsement(ch, idValue, input, client, h) {
  const id = nominationId(idValue);
  const desired = endorsementInput(input);
  // Keep the repository's character→family→domain-row lock order. Authority is evaluated only after
  // deadline handling so an expiry transition still wins over a stale role/seat refusal.
  const member = await lockCurrentFamily(ch, client);
  const row = await lockedNomination(client, id);
  const at = await wallClock(client);
  const pre = await refreshLocked(client, row, at);
  if (row.status === 'expired') return { nomination: nominationView(row, 0), expired: true };
  if (!OPEN.has(row.status)) fail('nomination_closed', 'That nomination is already terminal.');
  const authority = await requireAuthority(member, client);
  if (sameId(authority.familyId, row.sponsor_family_id)) {
    fail('sponsor_self', 'The sponsor already counts once and cannot self-endorse.');
  }
  const current = (await client.query(
    'SELECT * FROM rwa_nomination_endorsements_v2 WHERE nomination_id=$1 AND family_id=$2 FOR UPDATE',
    [id, authority.familyId],
  )).rows[0];
  if (current && current.active === desired.active && current.rationale === desired.rationale) {
    return { nomination: await viewLocked(client, row, at, pre.seats), changed: false };
  }
  if (current) {
    await client.query(
      `UPDATE rwa_nomination_endorsements_v2
          SET account_id=$3,active=$4,rationale=$5,updated_at=$6
        WHERE nomination_id=$1 AND family_id=$2`,
      [id, authority.familyId, ch.account_id, desired.active, desired.rationale, at],
    );
  } else {
    await client.query(
      `INSERT INTO rwa_nomination_endorsements_v2
        (nomination_id,family_id,account_id,active,rationale,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, authority.familyId, ch.account_id, desired.active, desired.rationale, at],
    );
  }
  await appendEvent(client, {
    nominationId: id,
    eventType: desired.active ? 'endorsement_active' : 'endorsement_withdrawn',
    familyId: authority.familyId,
    accountId: ch.account_id,
    actorType: 'player',
    actorId: ch.account_id,
    details: { active: desired.active, rationale: desired.rationale },
    at,
  });
  return { nomination: await viewLocked(client, row, at, pre.seats), changed: true };
}

export async function renewRwaNominationSponsorSupport(ch, idValue, client, h) {
  const id = nominationId(idValue);
  const member = await lockCurrentFamily(ch, client);
  const row = await lockedNomination(client, id);
  const at = await wallClock(client);
  const pre = await refreshLocked(client, row, at);
  if (row.status === 'expired') return { nomination: nominationView(row, 0), expired: true };
  if (!OPEN.has(row.status)) fail('nomination_closed', 'That nomination is already terminal.');
  const authority = await requireAuthority(member, client);
  if (!sameId(authority.familyId, row.sponsor_family_id)) {
    fail('sponsor_owner', 'Only the currently seated original sponsor family may renew support.');
  }
  if (row.sponsor_support_active) {
    return { nomination: await viewLocked(client, row, at, pre.seats), changed: false };
  }
  await client.query('UPDATE rwa_nominations_v2 SET sponsor_support_active=true WHERE id=$1', [id]);
  row.sponsor_support_active = true;
  await appendEvent(client, {
    nominationId: id,
    eventType: 'sponsor_support_renewed',
    familyId: authority.familyId,
    accountId: ch.account_id,
    actorType: 'player',
    actorId: ch.account_id,
    details: {},
    at,
  });
  return { nomination: await viewLocked(client, row, at, pre.seats), changed: true };
}

export async function refreshRwaNominationSeatState(db, options = {}) {
  const page = pageOptions(options, 'refresh');
  return inTransaction(db, async (client) => {
    const params = [];
    let after = '';
    if (page.cursor) {
      params.push(new Date(page.cursor.at), page.cursor.id);
      after = 'AND (created_at > $1 OR (created_at = $1 AND id > $2))';
    }
    params.push(page.limit + 1);
    const selected = (await client.query(
      `SELECT * FROM rwa_nominations_v2
        WHERE status IN ('pending','review_requested','under_review') ${after}
        ORDER BY created_at ASC,id ASC LIMIT $${params.length} FOR UPDATE`,
      params,
    )).rows;
    const hasMore = selected.length > page.limit;
    const work = selected.slice(0, page.limit);
    const at = await wallClock(client);
    const seats = await seatSet(client);
    let updated = 0;
    for (const row of work) if ((await refreshLocked(client, row, at, seats)).changed) updated++;
    const last = work.at(-1);
    return {
      processed: work.length,
      updated,
      hasMore,
      nextCursor: hasMore ? nextCursor('refresh', last) : null,
    };
  });
}

export async function expireRwaNominations(db, options = {}) {
  const page = pageOptions(options, 'expiry');
  return inTransaction(db, async (client) => {
    const params = [];
    let after = '';
    if (page.cursor) {
      params.push(new Date(page.cursor.at), page.cursor.id);
      after = 'AND (pending_until > $1 OR (pending_until = $1 AND id > $2))';
    }
    params.push(page.limit + 1);
    // Lock before reading clock_timestamp(): a worker that waited across the boundary must see the
    // later wall time, not transaction-start time.
    const selected = (await client.query(
      `SELECT * FROM rwa_nominations_v2
        WHERE status IN ('pending','review_requested','under_review') ${after}
        ORDER BY pending_until ASC,id ASC LIMIT $${params.length} FOR UPDATE`,
      params,
    )).rows;
    const at = await wallClock(client);
    const due = selected.filter((row) => at.getTime() >= new Date(row.pending_until).getTime());
    const hasMore = due.length > page.limit;
    const work = due.slice(0, page.limit);
    for (const row of work) await expireLocked(client, row, at);
    const last = work.at(-1);
    return {
      processed: work.length,
      expired: work.length,
      hasMore,
      nextCursor: hasMore ? nextCursor('expiry', last) : null,
    };
  });
}

function inList(values, params) {
  if (!values.length) return 'NULL';
  return values.map((value) => {
    params.push(value);
    return `$${params.length}`;
  }).join(',');
}

export async function rwaNominationBoard(db, options = {}) {
  const page = pageOptions(options, 'board');
  if (options.finalizedOnly != null && typeof options.finalizedOnly !== 'boolean') {
    fail('bad_finalized_filter', 'finalizedOnly must be a boolean.');
  }
  return inTransaction(db, async (client) => {
    const seats = await seatSet(client);
    const seated = [...seats];
    const params = [];
    const sponsorSeats = inList(seated, params);
    const endorsementSeats = inList(seated, params);
    const finalizedWhere = options.finalizedOnly ? 'WHERE v.asset_version_key IS NOT NULL' : '';
    let cursorClause = '';
    if (page.cursor) {
      params.push(page.cursor.support, new Date(page.cursor.at), page.cursor.id);
      const s = `$${params.length - 2}`, at = `$${params.length - 1}`, id = `$${params.length}`;
      cursorClause = `WHERE (support < ${s} OR (support = ${s} AND (created_at > ${at}
        OR (created_at = ${at} AND id > ${id}))))`;
    }
    params.push(page.limit + 1);
    const ranked = (await client.query(
      `WITH scores AS (
         SELECT n.id,n.created_at,
           (CASE WHEN n.sponsor_support_active AND n.sponsor_family_id IN (${sponsorSeats}) THEN 1 ELSE 0 END
            + COALESCE(SUM(CASE WHEN e.active AND e.family_id IN (${endorsementSeats})
                AND e.family_id <> n.sponsor_family_id THEN 1 ELSE 0 END),0))::int AS support
           FROM rwa_nominations_v2 n
           LEFT JOIN rwa_nomination_endorsements_v2 e ON e.nomination_id=n.id
           LEFT JOIN stock_asset_versions_v2 v ON v.asset_version_key=n.asset_version_key
          ${finalizedWhere}
          GROUP BY n.id,n.created_at,n.sponsor_support_active,n.sponsor_family_id
       )
       SELECT id,created_at,support FROM scores ${cursorClause}
       ORDER BY support DESC,created_at ASC,id ASC LIMIT $${params.length}`,
      params,
    )).rows;
    const hasMore = ranked.length > page.limit;
    const selected = ranked.slice(0, page.limit);
    const ids = selected.map((item) => String(item.id));
    if (!ids.length) return { items: [], hasMore: false, nextCursor: null };
    // Lock selected rows in immutable ID order, then take wall time. This keeps seat-loss/expiry
    // observations made by a public board durable without widening the page scan.
    const lockParams = [];
    const placeholders = inList([...ids].sort(), lockParams);
    const locked = (await client.query(
      `SELECT * FROM rwa_nominations_v2 WHERE id IN (${placeholders}) ORDER BY id ASC FOR UPDATE`, lockParams,
    )).rows;
    const byId = new Map(locked.map((row) => [String(row.id), row]));
    const at = await wallClock(client);
    const items = [];
    for (const rank of selected) {
      const row = byId.get(String(rank.id));
      const refreshed = await refreshLocked(client, row, at, seats);
      const conflicts = (await client.query(
        `SELECT id,asset_version_key,status,created_at FROM rwa_nominations_v2
          WHERE ticker=$1 AND id<>$2 ORDER BY created_at ASC,id ASC LIMIT 21`,
        [row.ticker, row.id],
      )).rows;
      const mirror = (await client.query(
        'SELECT active,registry_index,last_catalog_version FROM stock_asset_versions_v2 WHERE asset_version_key=$1',
        [row.asset_version_key],
      )).rows[0];
      items.push(nominationView(row, supportOf(row, refreshed.slots, seats), {
        finalizedCatalog: mirror ? {
          present: true,
          active: Boolean(mirror.active),
          registryIndex: String(mirror.registry_index),
          catalogVersion: String(mirror.last_catalog_version),
        } : { present: false, active: false, registryIndex: null, catalogVersion: null },
        tickerConflicts: conflicts.slice(0, 20).map((conflict) => ({
          id: String(conflict.id),
          assetVersionKey: conflict.asset_version_key,
          status: conflict.status,
          createdAt: new Date(conflict.created_at).toISOString(),
        })),
        tickerConflictsHasMore: conflicts.length > 20,
      }));
    }
    // Refresh may expire rows but cannot change their current seated support, so the selected order
    // remains the authoritative support/created/id order for this transaction.
    const last = selected.at(-1);
    return {
      items,
      hasMore,
      nextCursor: hasMore ? nextCursor('board', { id: last.id, created_at: last.created_at }, Number(last.support)) : null,
    };
  });
}

export async function claimRwaNominationReview(db, idValue, reviewerValue) {
  const id = nominationId(idValue);
  const reviewer = reviewerId(reviewerValue);
  return inTransaction(db, async (client) => {
    const row = await lockedNomination(client, id);
    const at = await wallClock(client);
    const refreshed = await refreshLocked(client, row, at);
    if (row.status === 'expired') {
      return { nomination: nominationView(row, 0), expired: true };
    }
    if (row.status === 'under_review') {
      if (row.claimed_by === reviewer) {
        return { nomination: nominationView(row, supportOf(row, refreshed.slots, refreshed.seats)), changed: false };
      }
      fail('review_claimed', 'That nomination is already owned by another reviewer.');
    }
    if (!['pending', 'review_requested'].includes(row.status)) fail('review_terminal', 'That review is already terminal.');
    await client.query(
      "UPDATE rwa_nominations_v2 SET status='under_review',claimed_by=$2,claimed_at=$3 WHERE id=$1",
      [id, reviewer, at],
    );
    row.status = 'under_review';
    row.claimed_by = reviewer;
    row.claimed_at = at;
    await appendEvent(client, {
      nominationId: id,
      eventType: 'review_claimed',
      actorType: 'reviewer',
      actorId: reviewer,
      details: { support: supportOf(row, refreshed.slots, refreshed.seats) },
      at,
    });
    return { nomination: nominationView(row, supportOf(row, refreshed.slots, refreshed.seats)), changed: true };
  });
}

function dispositionInput(value) {
  const input = typeof value === 'string' ? { disposition: value } : value;
  if (!input || typeof input !== 'object' || !DISPOSITIONS.has(input.disposition)) {
    fail('bad_disposition', 'Disposition must be approved, rejected, or not_eligible.');
  }
  const reason = input.reason == null ? null : strictText(input.reason, 'disposition_reason', { max: 2000 });
  return { disposition: input.disposition, reason };
}

export async function disposeRwaNominationReview(db, idValue, reviewerValue, dispositionValue) {
  const id = nominationId(idValue);
  const reviewer = reviewerId(reviewerValue);
  const disposition = dispositionInput(dispositionValue);
  return inTransaction(db, async (client) => {
    const row = await lockedNomination(client, id);
    const at = await wallClock(client);
    if (TERMINAL.has(row.status)) {
      if (row.status === disposition.disposition && row.disposition_by === reviewer
          && (row.disposition_reason ?? null) === disposition.reason) {
        const seats = await seatSet(client);
        return { nomination: nominationView(row, supportOf(row, await endorsements(client, id), seats)), changed: false };
      }
      fail('review_terminal', 'That review already has a terminal disposition.');
    }
    const refreshed = await refreshLocked(client, row, at);
    if (row.status === 'expired') return { nomination: nominationView(row, 0), expired: true };
    if (row.status !== 'under_review') fail('review_unclaimed', 'Claim the review before disposing it.');
    if (row.claimed_by !== reviewer) fail('review_owner', 'Only the reviewer who owns the claim may dispose it.');
    await client.query(
      `UPDATE rwa_nominations_v2
          SET status=$2,disposition_by=$3,disposition_at=$4,disposition_reason=$5
        WHERE id=$1`,
      [id, disposition.disposition, reviewer, at, disposition.reason],
    );
    row.status = disposition.disposition;
    row.disposition_by = reviewer;
    row.disposition_at = at;
    row.disposition_reason = disposition.reason;
    await appendEvent(client, {
      nominationId: id,
      eventType: `review_${disposition.disposition}`,
      actorType: 'reviewer',
      actorId: reviewer,
      details: { disposition: disposition.disposition, reason: disposition.reason },
      at,
    });
    return {
      nomination: nominationView(row, supportOf(row, refreshed.slots, refreshed.seats)),
      changed: true,
    };
  });
}
