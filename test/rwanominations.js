import assert from 'node:assert/strict';
import { getAddress, keccak256, toBytes } from 'viem';
import { makeDb } from '../src/db.js';
import { computeStockAssetVersionKey } from '../src/stockcatalogv2.js';
import {
  claimRwaNominationReview,
  createRwaNomination,
  disposeRwaNominationReview,
  expireRwaNominations,
  refreshRwaNominationSeatState,
  renewRwaNominationSponsorSupport,
  rwaNominationBoard,
  setRwaNominationEndorsement,
} from '../src/rwanominations.js';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const BASE_TIME = new Date('2026-01-01T00:00:00.000Z');
const hash = (byte) => `0x${byte.repeat(64)}`;
const address = (byte) => getAddress(`0x${byte.repeat(40)}`);
const iso = (value) => new Date(value).toISOString();

function asset(n, overrides = {}) {
  const ticker = overrides.ticker ?? `T${n}`;
  const candidate = {
    chainId: overrides.chainId ?? '4663',
    ticker,
    name: overrides.name ?? `Provider Asset ${n}`,
    tokenAddress: overrides.tokenAddress ?? address(String(n).slice(-1)),
    tokenDecimals: overrides.tokenDecimals ?? 18,
    robinhoodAssetIdHash: overrides.robinhoodAssetIdHash ?? hash(String(n).slice(-1)),
    rationale: overrides.rationale ?? `The family submits provider evidence for ${ticker}.`,
    evidenceHash: overrides.evidenceHash ?? hash('a'),
    evidenceUri: Object.hasOwn(overrides, 'evidenceUri')
      ? overrides.evidenceUri
      : `https://evidence.example/${ticker}`,
  };
  if (overrides.assetVersionKey != null) candidate.assetVersionKey = overrides.assetVersionKey;
  else {
    try { candidate.assetVersionKey = computeStockAssetVersionKey(candidate); }
    catch {
      candidate.assetVersionKey = computeStockAssetVersionKey({
        chainId: '4663', ticker: `T${n}`, tokenAddress: address(String(n).slice(-1)),
        robinhoodAssetIdHash: hash(String(n).slice(-1)),
      });
    }
  }
  return candidate;
}

async function fixture() {
  const pool = await makeDb();
  const actors = [];
  for (let i = 1; i <= 6; i++) {
    const accountId = `account-${i}`;
    const characterId = `character-${i}`;
    const familyId = `family-${i}`;
    await pool.query(
      'INSERT INTO characters (id, account_id, name, season) VALUES ($1,$2,$3,0)',
      [characterId, accountId, `Actor ${i}`],
    );
    await pool.query(
      'INSERT INTO gangs (id, name, tag, season_tribute) VALUES ($1,$2,$3,$4)',
      [familyId, `Family ${i}`, `F${i}`, 700 - i * 100],
    );
    await pool.query(
      'INSERT INTO gang_members (gang_id, character_id, role) VALUES ($1,$2,$3)',
      [familyId, characterId, 'boss'],
    );
    actors.push({ id: characterId, account_id: accountId, familyId });
  }
  return { pool, actors };
}

function adaptedClient(client, { now = BASE_TIME, barrier, log } = {}) {
  return {
    query: async (text, params) => {
      const sql = typeof text === 'string' ? text : text.text;
      log?.push(sql);
      if (sql.includes('rwa_wall_clock')) {
        return { rows: [{ wall_now: new Date(now) }], rowCount: 1 };
      }
      if (barrier && /^\s*INSERT\s+INTO\s+rwa_nominations_v2/i.test(sql)) await barrier();
      return client.query(text, params);
    },
  };
}

async function asActor(pool, actor, fn, options = {}) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ch = (await client.query('SELECT * FROM characters WHERE id=$1 FOR UPDATE', [actor.id])).rows[0];
    const db = adaptedClient(client, options);
    const h = {
      owned: options.owned ?? { gangId: 'stale-family', gangRole: 'soldier' },
      accountId: actor.account_id,
    };
    const result = await fn(ch, db, h);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function nominate(pool, actor, candidate, now = BASE_TIME, options = {}) {
  return asActor(
    pool,
    actor,
    (ch, client, h) => createRwaNomination(ch, candidate, client, h),
    { ...options, now },
  );
}

async function endorse(pool, actor, nominationId, input, now = BASE_TIME) {
  return asActor(
    pool,
    actor,
    (ch, client, h) => setRwaNominationEndorsement(ch, nominationId, input, client, h),
    { now },
  );
}

async function renew(pool, actor, nominationId, now = BASE_TIME) {
  return asActor(
    pool,
    actor,
    (ch, client, h) => renewRwaNominationSponsorSupport(ch, nominationId, client, h),
    { now },
  );
}

async function rows(pool, sql, params = []) {
  return (await pool.query(sql, params)).rows;
}

async function rejectsCode(promise, code, label) {
  await assert.rejects(promise, (error) => error?.code === code, label);
}

// Authority is re-read from membership + the current chamber in the mutation transaction. A stale
// h.owned snapshot must neither grant a soldier authority nor deny a real underboss authority.
{
  const { pool, actors } = await fixture();
  await pool.query("UPDATE gang_members SET role='soldier' WHERE character_id=$1", [actors[0].id]);
  await rejectsCode(nominate(pool, actors[0], asset(1), BASE_TIME, {
    owned: { gangId: actors[0].familyId, gangRole: 'boss' },
  }), 'rank', 'a stale in-memory boss role cannot nominate');
  await pool.query("UPDATE gang_members SET role='underboss' WHERE character_id=$1", [actors[0].id]);
  const made = await nominate(pool, actors[0], asset(1), BASE_TIME, {
    owned: { gangId: null, gangRole: 'soldier' },
  });
  assert.equal(made.duplicate, false);
  await rejectsCode(nominate(pool, actors[5], asset(2), BASE_TIME), 'no_seat',
    'the sixth family cannot nominate without a current seat');
  await pool.end();
}

// Candidate identity/evidence is canonical and bounded. The submitted key is a stale-client
// confirmation, independently recomputed by the implementation rather than trusted.
{
  const invalid = [
    [asset(1, { chainId: 4663 }), 'bad_chain'],
    [asset(1, { ticker: 'aapl' }), 'bad_ticker'],
    [asset(1, { assetVersionKey: hash('f') }), 'asset_key_mismatch'],
    [asset(1, { tokenAddress: '0x1234' }), 'bad_address'],
    [asset(1, { tokenDecimals: '18' }), 'bad_decimals'],
    [asset(1, { robinhoodAssetIdHash: hash('0') }), 'bad_hash'],
    [asset(1, { evidenceHash: hash('0') }), 'bad_evidence'],
    [asset(1, { rationale: '' }), 'bad_rationale'],
    [asset(1, { rationale: 'r'.repeat(2001) }), 'bad_rationale'],
    [asset(1, { evidenceUri: 'http://evidence.example/a' }), 'bad_evidence_uri'],
    [asset(1, { evidenceUri: 'https://evidence.example/' + 'x'.repeat(2030) }), 'bad_evidence_uri'],
  ];
  for (const [candidate, code] of invalid) {
    const { pool, actors } = await fixture();
    await rejectsCode(nominate(pool, actors[0], candidate), code, `${code} is stable`);
    assert.equal((await rows(pool, 'SELECT * FROM rwa_nominations_v2')).length, 0);
    await pool.end();
  }
  const { pool, actors } = await fixture();
  const candidate = asset(1, { evidenceUri: 'ipfs://bafybeigdyrzt' });
  const made = await nominate(pool, actors[0], candidate);
  assert.equal(made.nomination.assetVersionKey, candidate.assetVersionKey);
  assert.equal(made.nomination.chainId, '4663');
  assert.equal(made.nomination.tickerHash, keccak256(toBytes('T1')));
  assert.equal(made.nomination.tokenAddress, candidate.tokenAddress);
  assert.equal(made.nomination.tokenDecimals, 18);
  assert.equal(made.nomination.robinhoodAssetIdHash, candidate.robinhoodAssetIdHash);
  await pool.end();
}

// Rolling family cadence is exact: 167h59m59.999s refuses; exactly 168h permits. Duplicate handling
// runs before cadence consumption and returns the citywide row without an endorsement side effect.
{
  const { pool, actors } = await fixture();
  const first = await nominate(pool, actors[0], asset(1), BASE_TIME);
  await rejectsCode(
    nominate(pool, actors[0], asset(2), new Date(BASE_TIME.getTime() + 168 * HOUR - 1)),
    'nomination_cooldown',
    'the rolling cooldown remains closed one millisecond early',
  );
  const second = await nominate(pool, actors[0], asset(2), new Date(BASE_TIME.getTime() + 168 * HOUR));
  assert.equal(second.duplicate, false, 'exactly 168 hours permits another nomination');

  const duplicate = await nominate(pool, actors[1], asset(1), new Date(BASE_TIME.getTime() + HOUR));
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.nomination.id, first.nomination.id);
  assert.equal(duplicate.endorsementAvailable, true);
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_endorsements_v2')).length, 0,
    'duplicate creation never silently endorses');
  const own = await nominate(pool, actors[1], asset(3), new Date(BASE_TIME.getTime() + HOUR));
  assert.equal(own.duplicate, false, 'the duplicate loser retained its family cadence');
  await pool.end();
}

// Same display ticker with a different immutable identity is not conflated. Immutable sponsorship,
// evidence and deadline do not move when support changes.
{
  const { pool, actors } = await fixture();
  const a = asset(1, { ticker: 'AAPL', tokenAddress: address('1'), robinhoodAssetIdHash: hash('1') });
  const b = asset(2, { ticker: 'AAPL', tokenAddress: address('2'), robinhoodAssetIdHash: hash('2') });
  const one = await nominate(pool, actors[0], a, BASE_TIME);
  const two = await nominate(pool, actors[1], b, BASE_TIME);
  assert.notEqual(one.nomination.assetVersionKey, two.nomination.assetVersionKey);
  await endorse(pool, actors[2], one.nomination.id, { active: true, rationale: 'Independent support.' });
  const persisted = (await rows(pool, 'SELECT * FROM rwa_nominations_v2 WHERE id=$1', [one.nomination.id]))[0];
  assert.equal(persisted.sponsor_family_id, actors[0].familyId);
  assert.equal(persisted.sponsor_account_id, actors[0].account_id);
  assert.equal(iso(persisted.created_at), BASE_TIME.toISOString());
  assert.equal(iso(persisted.pending_until), new Date(BASE_TIME.getTime() + 30 * DAY).toISOString());
  assert.equal(persisted.evidence_hash, a.evidenceHash);
  assert.equal(persisted.rationale, a.rationale);
  await pool.end();
}

// A stale open-key row is not a duplicate forever. At its exact deadline it expires first, and the
// new family receives a fresh linked nomination whose immutable 30-day clock starts at that instant.
{
  const { pool, actors } = await fixture();
  const candidate = asset(1);
  const first = await nominate(pool, actors[0], candidate, BASE_TIME);
  const deadline = new Date(BASE_TIME.getTime() + 30 * DAY);
  const fresh = await nominate(pool, actors[1], candidate, deadline);
  assert.equal(fresh.duplicate, false);
  assert.equal(fresh.nomination.priorNominationId, first.nomination.id);
  assert.equal(fresh.nomination.createdAt, deadline.toISOString());
  assert.equal((await rows(pool, 'SELECT status FROM rwa_nominations_v2 WHERE id=$1',
    [first.nomination.id]))[0].status, 'expired');
  await pool.end();
}

// Expiry also wins when the submitting character lost role authority while waiting. The harmless
// expiry persists, but the stale actor does not receive a new nomination.
{
  const { pool, actors } = await fixture();
  const candidate = asset(1);
  const first = await nominate(pool, actors[0], candidate, BASE_TIME);
  await pool.query("UPDATE gang_members SET role='soldier' WHERE character_id=$1", [actors[1].id]);
  const deadline = new Date(BASE_TIME.getTime() + 30 * DAY);
  const sql = [];
  const expired = await nominate(pool, actors[1], candidate, deadline, { log: sql });
  assert.equal(expired.expired, true);
  assert.equal(expired.creationRefused, 'rank');
  assert.equal((await rows(pool, 'SELECT status FROM rwa_nominations_v2 WHERE id=$1',
    [first.nomination.id]))[0].status, 'expired');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nominations_v2')).length, 1);
  const nominationLock = sql.findIndex((q) => /FROM\s+rwa_nominations_v2.*asset_version_key.*FOR UPDATE/is.test(q));
  const clockRead = sql.findIndex((q) => q.includes('rwa_wall_clock'));
  assert(nominationLock >= 0 && clockRead > nominationLock,
    'deadline authority uses a database wall-clock read after the nomination lock');
  await pool.end();
}

// PostgreSQL's partial unique index is the production race authority. The deterministic barrier lets
// both pg-mem callers reach the exact INSERT path together; it cannot prove PostgreSQL row waiting,
// but it proves one insert result, one duplicate redirect, and no loser cadence/endorsement effect.
{
  const { pool, actors } = await fixture();
  let waiting = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const barrier = async () => {
    waiting++;
    if (waiting === 2) release();
    await gate;
  };
  const sql = [];
  const candidate = asset(1);
  const results = await Promise.all([
    nominate(pool, actors[0], candidate, BASE_TIME, { barrier, log: sql }),
    nominate(pool, actors[1], candidate, BASE_TIME, { barrier, log: sql }),
  ]);
  assert.deepEqual(results.map((r) => r.duplicate).sort(), [false, true]);
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nominations_v2')).length, 1);
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_endorsements_v2')).length, 0);
  const loser = results.find((r) => r.duplicate).requestingFamilyId;
  const loserActor = actors.find((a) => a.familyId === loser);
  assert.equal((await nominate(pool, loserActor, asset(2), BASE_TIME)).duplicate, false,
    'concurrent loser can immediately spend the cadence it retained');
  const insertSql = sql.find((q) => /^\s*INSERT\s+INTO\s+rwa_nominations_v2/i.test(q));
  assert.match(insertSql, /ON\s+CONFLICT\s+DO\s+NOTHING\s+RETURNING/i);
  assert.doesNotMatch(insertSql, /ON\s+CONFLICT\s*\(/i, 'all applicable uniqueness conflicts are handled');
  await pool.end();
}

// Sponsor self-endorsement is forbidden. Every other family owns one mutable current slot while
// append-only events preserve the prior active/withdrawn facts. Three distinct families is fixed.
{
  const { pool, actors } = await fixture();
  const made = await nominate(pool, actors[0], asset(1));
  await rejectsCode(endorse(pool, actors[0], made.nomination.id, { active: true }), 'sponsor_self',
    'the sponsor cannot double-count through an endorsement');
  let result = await endorse(pool, actors[1], made.nomination.id, {
    active: true, rationale: 'Seat two backs the evidence.',
  });
  assert.equal(result.nomination.support, 2);
  result = await endorse(pool, actors[2], made.nomination.id, { active: true });
  assert.equal(result.nomination.support, 3);
  assert.equal(result.nomination.status, 'review_requested');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_endorsements_v2')).length, 2);
  result = await endorse(pool, actors[1], made.nomination.id, {
    active: false, rationale: 'Evidence needs another look.',
  });
  assert.equal(result.nomination.support, 2);
  assert.equal(result.nomination.status, 'pending', 'support drop demotes before claim');
  assert.equal((await rows(pool,
    "SELECT * FROM rwa_nomination_events_v2 WHERE nomination_id=$1 AND event_type LIKE 'endorsement_%' ORDER BY created_at,event_id",
    [made.nomination.id])).length, 3, 'slot mutation never erases public event history');
  await rejectsCode(endorse(pool, actors[2], made.nomination.id, { active: 'true' }), 'bad_endorsement',
    'active is a strict boolean');
  await rejectsCode(endorse(pool, actors[2], made.nomination.id, {
    active: true, rationale: 'x'.repeat(1001),
  }), 'bad_rationale', 'endorsement rationale is bounded');
  await pool.end();
}

// Mutation-time seat authority wins over stale request context. Observed endorsement and sponsor
// seat loss clears active support permanently; reseating alone does not resurrect it.
{
  const { pool, actors } = await fixture();
  const made = await nominate(pool, actors[0], asset(1));
  await endorse(pool, actors[1], made.nomination.id, { active: true });
  await pool.query('UPDATE gangs SET season_tribute=0 WHERE id=$1', [actors[1].familyId]);
  await rejectsCode(endorse(pool, actors[1], made.nomination.id, { active: false }), 'no_seat',
    'seat loss after request context load removes write authority');
  let refreshed = await refreshRwaNominationSeatState(adaptedClient(pool, { now: BASE_TIME }));
  assert.equal(refreshed.processed, 1);
  assert.equal((await rows(pool,
    'SELECT active FROM rwa_nomination_endorsements_v2 WHERE nomination_id=$1 AND family_id=$2',
    [made.nomination.id, actors[1].familyId]))[0].active, false);
  await pool.query('UPDATE gangs SET season_tribute=500 WHERE id=$1', [actors[1].familyId]);
  await refreshRwaNominationSeatState(adaptedClient(pool, { now: BASE_TIME }));
  assert.equal((await rows(pool,
    'SELECT active FROM rwa_nomination_endorsements_v2 WHERE nomination_id=$1 AND family_id=$2',
    [made.nomination.id, actors[1].familyId]))[0].active, false,
  'reseating does not restore an observed-lost endorsement');
  await endorse(pool, actors[1], made.nomination.id, { active: true });

  await pool.query('UPDATE gangs SET season_tribute=0 WHERE id=$1', [actors[0].familyId]);
  await refreshRwaNominationSeatState(adaptedClient(pool, { now: BASE_TIME }));
  assert.equal((await rows(pool, 'SELECT sponsor_support_active FROM rwa_nominations_v2 WHERE id=$1',
    [made.nomination.id]))[0].sponsor_support_active, false);
  await pool.query('UPDATE gangs SET season_tribute=600 WHERE id=$1', [actors[0].familyId]);
  await refreshRwaNominationSeatState(adaptedClient(pool, { now: BASE_TIME }));
  assert.equal((await rows(pool, 'SELECT sponsor_support_active FROM rwa_nominations_v2 WHERE id=$1',
    [made.nomination.id]))[0].sponsor_support_active, false,
  'reseating alone never restores sponsor support');
  await rejectsCode(renew(pool, actors[1], made.nomination.id), 'sponsor_owner',
    'a different seated family cannot renew the original sponsor');
  const renewed = await renew(pool, actors[0], made.nomination.id);
  assert.equal(renewed.nomination.sponsorSupportActive, true);
  assert.equal((await rows(pool,
    "SELECT * FROM rwa_nomination_events_v2 WHERE nomination_id=$1 AND event_type IN ('sponsor_seat_lost','sponsor_support_renewed')",
    [made.nomination.id])).length, 2, 'loss and renewal remain enumerable');
  await pool.end();
}

// Reviewer identity is opaque but nonempty/bounded. Manual below-threshold claim is allowed; once
// claimed, support loss never demotes under_review and only the claim owner may dispose it.
{
  const { pool, actors } = await fixture();
  const made = await nominate(pool, actors[0], asset(1));
  await rejectsCode(claimRwaNominationReview(adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, '  '),
    'bad_reviewer', 'blank reviewer identities are not authority');
  const claimed = await claimRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:alpha',
  );
  assert.equal(claimed.nomination.status, 'under_review');
  assert.equal(claimed.nomination.support, 1, 'below-threshold manual claim is permitted');
  const retry = await claimRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:alpha',
  );
  assert.equal(retry.nomination.id, made.nomination.id, 'same-owner claim retry is idempotent');
  await rejectsCode(claimRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:beta',
  ), 'review_claimed', 'a second opaque reviewer cannot steal the claim');
  await pool.query('UPDATE gangs SET season_tribute=0 WHERE id=$1', [actors[0].familyId]);
  await refreshRwaNominationSeatState(adaptedClient(pool, { now: BASE_TIME }));
  assert.equal((await rows(pool, 'SELECT status FROM rwa_nominations_v2 WHERE id=$1',
    [made.nomination.id]))[0].status, 'under_review', 'claimed review never demotes on support loss');
  await rejectsCode(disposeRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:beta',
    { disposition: 'rejected', reason: 'Identity could not be verified.' },
  ), 'review_owner', 'only the claim owner may dispose');
  const disposed = await disposeRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:alpha',
    { disposition: 'rejected', reason: 'Identity could not be verified.' },
  );
  assert.equal(disposed.nomination.status, 'rejected');
  assert.equal(disposed.nomination.executionStatus, 'not_applicable',
    'Task 3 records terminal review fact without fabricating a Safe package');
  const terminalRetry = await disposeRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:alpha',
    { disposition: 'rejected', reason: 'Identity could not be verified.' },
  );
  assert.equal(terminalRetry.nomination.status, 'rejected');
  await rejectsCode(disposeRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer:alpha',
    { disposition: 'approved', reason: 'Changed outcome.' },
  ), 'review_terminal', 'conflicting terminal retry cannot rewrite history');
  await pool.end();
}

// Task 3 approval closes review only. Task 4 owns the canonical whole-second approvedAt/validUntil
// pair and must be able to add it atomically with the unsigned Safe package.
{
  const { pool, actors } = await fixture();
  const made = await nominate(pool, actors[0], asset(1));
  await claimRwaNominationReview(adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer');
  const approved = await disposeRwaNominationReview(
    adaptedClient(pool, { now: BASE_TIME }), made.nomination.id, 'reviewer',
    { disposition: 'approved', reason: 'Candidate identity is eligible.' },
  );
  assert.equal(approved.nomination.status, 'approved');
  assert.equal(approved.nomination.approvedAt, null);
  assert.equal(approved.nomination.validUntil, null);
  assert.equal(approved.nomination.executionStatus, 'not_applicable');
  await pool.end();
}

// Queue/board ordering is support DESC, created_at ASC, id ASC. Cursors are stable and bounded;
// same-ticker/different-key conflicts remain visible, and finalizedOnly is contextual filtering.
{
  const { pool, actors } = await fixture();
  const n1 = await nominate(pool, actors[0], asset(1, { ticker: 'AAPL' }), BASE_TIME);
  const n2 = await nominate(pool, actors[1], asset(2, { ticker: 'AAPL' }), new Date(BASE_TIME.getTime() + HOUR));
  const n3 = await nominate(pool, actors[2], asset(3), new Date(BASE_TIME.getTime() + 2 * HOUR));
  await endorse(pool, actors[3], n2.nomination.id, { active: true }, new Date(BASE_TIME.getTime() + 3 * HOUR));
  await endorse(pool, actors[4], n2.nomination.id, { active: true }, new Date(BASE_TIME.getTime() + 3 * HOUR));
  await endorse(pool, actors[3], n3.nomination.id, { active: true }, new Date(BASE_TIME.getTime() + 3 * HOUR));
  await pool.query(
    `INSERT INTO stock_asset_versions_v2
      (asset_version_key,chain_id,ticker_hash,ticker,name,token_address,token_decimals,
       robinhood_asset_id_hash,registry_index,active,last_catalog_version,synced_at)
     SELECT asset_version_key,chain_id,ticker_hash,ticker,name,token_address,token_decimals,
       robinhood_asset_id_hash,0,true,1,$2::timestamptz FROM rwa_nominations_v2 WHERE id=$1`,
    [n1.nomination.id, BASE_TIME],
  );
  const page1 = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME }), { limit: 2 });
  assert.deepEqual(page1.items.map((n) => n.id), [n2.nomination.id, n3.nomination.id]);
  assert.deepEqual(page1.items.map((n) => n.support), [3, 2]);
  assert.equal(page1.hasMore, true);
  assert(page1.nextCursor);
  const page2 = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME }), {
    limit: 2, cursor: page1.nextCursor,
  });
  assert.deepEqual(page2.items.map((n) => n.id), [n1.nomination.id]);
  assert.equal(page1.items[0].tickerConflicts.some((c) => c.id === n1.nomination.id), true);
  const finalized = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME }), { finalizedOnly: true });
  assert.deepEqual(finalized.items.map((n) => n.id), [n1.nomination.id]);
  await rejectsCode(rwaNominationBoard(pool, { limit: 501 }), 'bad_limit', 'board hard-caps pages at 500');
  await rejectsCode(rwaNominationBoard(pool, { cursor: 'not-a-cursor' }), 'bad_cursor',
    'opaque cursor corruption fails closed');
  await pool.end();
}

// Every nonterminal state expires at the original deadline. Worker batches are bounded and cursor-
// resumable; terminal review facts survive indefinitely.
{
  const { pool, actors } = await fixture();
  const nominations = [];
  for (let i = 0; i < 6; i++) {
    const made = await nominate(pool, actors[i % 5], asset(i + 1),
      new Date(BASE_TIME.getTime() - 90 * DAY + i * 8 * DAY));
    nominations.push(made.nomination);
  }
  await pool.query("UPDATE rwa_nominations_v2 SET status='review_requested' WHERE id=$1", [nominations[1].id]);
  await pool.query("UPDATE rwa_nominations_v2 SET status='under_review',claimed_by='r',claimed_at=$2 WHERE id=$1",
    [nominations[2].id, BASE_TIME]);
  await pool.query("UPDATE rwa_nominations_v2 SET status='approved',disposition_by='r',disposition_at=$2 WHERE id=$1",
    [nominations[3].id, BASE_TIME]);
  await pool.query("UPDATE rwa_nominations_v2 SET status='rejected',disposition_by='r',disposition_at=$2 WHERE id=$1",
    [nominations[4].id, BASE_TIME]);
  await pool.query("UPDATE rwa_nominations_v2 SET status='not_eligible',disposition_by='r',disposition_at=$2 WHERE id=$1",
    [nominations[5].id, BASE_TIME]);
  const first = await expireRwaNominations(adaptedClient(pool, { now: BASE_TIME }), { limit: 2 });
  assert.equal(first.processed, 2);
  assert.equal(first.hasMore, true);
  const second = await expireRwaNominations(adaptedClient(pool, { now: BASE_TIME }), {
    limit: 2, cursor: first.nextCursor,
  });
  assert.equal(second.processed, 1);
  assert.equal(second.hasMore, false);
  assert.deepEqual((await rows(pool, 'SELECT status FROM rwa_nominations_v2 ORDER BY status'))
    .map((r) => r.status).sort(),
  ['approved', 'expired', 'expired', 'expired', 'not_eligible', 'rejected'].sort());
  await pool.end();
}

// At exact pending_until the deadline wins before endorsement, sponsor renewal, claim, or terminal
// disposition. The state transition persists and no forbidden side effect is written.
{
  const scenarios = [
    async (pool, actors, id, deadline) => endorse(pool, actors[1], id, { active: true }, deadline),
    async (pool, actors, id, deadline) => {
      await pool.query('UPDATE rwa_nominations_v2 SET sponsor_support_active=false WHERE id=$1', [id]);
      return renew(pool, actors[0], id, deadline);
    },
    async (pool, actors, id, deadline) => claimRwaNominationReview(
      adaptedClient(pool, { now: deadline }), id, 'reviewer',
    ),
    async (pool, actors, id, deadline) => {
      await pool.query("UPDATE rwa_nominations_v2 SET status='under_review',claimed_by='reviewer',claimed_at=$2 WHERE id=$1",
        [id, new Date(deadline.getTime() - HOUR)]);
      return disposeRwaNominationReview(adaptedClient(pool, { now: deadline }), id, 'reviewer', {
        disposition: 'approved', reason: 'Complete.',
      });
    },
  ];
  for (const mutate of scenarios) {
    const { pool, actors } = await fixture();
    const made = await nominate(pool, actors[0], asset(1), BASE_TIME);
    const deadline = new Date(BASE_TIME.getTime() + 30 * DAY);
    const result = await mutate(pool, actors, made.nomination.id, deadline);
    assert.equal(result.nomination.status, 'expired');
    assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_endorsements_v2 WHERE nomination_id=$1',
      [made.nomination.id])).length, 0);
    assert.equal((await rows(pool, 'SELECT disposition_by FROM rwa_nominations_v2 WHERE id=$1',
      [made.nomination.id]))[0].disposition_by, null);
    await pool.end();
  }
}

// Workers never turn a default tick into an unbounded historical scan.
{
  const { pool } = await fixture();
  const deadline = new Date(BASE_TIME.getTime() - DAY);
  const values = [];
  const params = [];
  for (let i = 0; i < 101; i++) {
    const at = new Date(BASE_TIME.getTime() - (200 + i) * DAY);
    const offset = params.length;
    values.push(`($${offset + 1},$${offset + 2},4663,'B${i}',$${offset + 3},$${offset + 4},18,$${offset + 5},'Bulk',
      'family-1','account-1',true,'Bulk rationale',$${offset + 6},NULL,'pending','not_applicable',$${offset + 7},$${offset + 8})`);
    params.push(`bulk-${String(i).padStart(3, '0')}`, keccak256(toBytes(`bulk-${i}`)), address(String((i % 9) + 1)),
      hash(String((i % 9) + 1)), hash('c'), hash('d'), at, deadline);
  }
  await pool.query(`INSERT INTO rwa_nominations_v2
    (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
     robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,sponsor_support_active,
     rationale,evidence_hash,evidence_uri,status,execution_status,created_at,pending_until)
    VALUES ${values.join(',')}`, params);
  const expired = await expireRwaNominations(adaptedClient(pool, { now: BASE_TIME }));
  assert.equal(expired.processed, 100);
  assert.equal(expired.hasMore, true);
  assert(expired.nextCursor);
  await rejectsCode(expireRwaNominations(pool, { limit: 501 }), 'bad_limit', 'expiry hard-caps at 500');
  await rejectsCode(refreshRwaNominationSeatState(pool, { limit: 0 }), 'bad_limit',
    'refresh rejects nonpositive bounds');
  await pool.end();
}

console.log('✅ RWA nominations v2 domain tests passed — immutable candidate identity, current-seat support, fixed threshold/review ownership, deadline precedence, PostgreSQL duplicate SQL, and bounded stable cursors.');
