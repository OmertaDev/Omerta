import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { newDb } from 'pg-mem';
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
const SCHEMA = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql'), 'utf8');
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

async function fixture(existingPool) {
  const pool = existingPool ?? await makeDb();
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

function adaptedClient(client, { now = BASE_TIME, barrier, log, trace, afterQuery } = {}) {
  return {
    query: async (text, params) => {
      const sql = typeof text === 'string' ? text : text.text;
      log?.push(sql);
      trace?.push({ sql, params: params ?? [] });
      if (sql.includes('rwa_wall_clock')) {
        return { rows: [{ wall_now: new Date(now) }], rowCount: 1 };
      }
      if (barrier && /^\s*INSERT\s+INTO\s+rwa_nominations_v2/i.test(sql)) await barrier();
      const result = await client.query(text, params);
      await afterQuery?.(sql, params, client, result);
      return result;
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

async function rollbackCapableFixture() {
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  await pool.query('CREATE TABLE task4_safe_package_probe (nomination_id TEXT PRIMARY KEY, payload TEXT NOT NULL)');
  const seeded = await fixture(pool);
  let backup = null;
  const controls = [];
  mem.public.interceptQueries((sql) => {
    const command = sql.trim().toUpperCase();
    if (command === 'BEGIN') {
      controls.push('BEGIN');
      backup = mem.backup();
      return [];
    }
    if (command === 'COMMIT') {
      controls.push('COMMIT');
      backup = null;
      return [];
    }
    if (command === 'ROLLBACK') {
      controls.push('ROLLBACK');
      backup?.restore();
      backup = null;
      return [];
    }
    return null;
  });
  return { ...seeded, controls };
}

function ownedPool(pool, log = []) {
  const counts = { connect: 0, release: 0 };
  return {
    counts,
    db: {
      connect: async () => {
        counts.connect++;
        const client = await pool.connect();
        const rawQuery = client.query.bind(client);
        const rawRelease = client.release.bind(client);
        client.query = async (text, params) => {
          log.push(typeof text === 'string' ? text : text.text);
          return rawQuery(text, params);
        };
        client.release = () => {
          counts.release++;
          return rawRelease();
        };
        return client;
      },
    },
  };
}

function ownedAdaptedPool(pool, options = {}) {
  const counts = { connect: 0, release: 0 };
  return {
    counts,
    db: {
      connect: async () => {
        counts.connect++;
        const raw = await pool.connect();
        const client = adaptedClient(raw, options);
        client.release = () => {
          counts.release++;
          raw.release();
        };
        return client;
      },
    },
  };
}

async function insertBulkNominations(pool, count, {
  prefix = 'bulk', start = 0, ticker = (i) => `B${i}`, status = 'pending',
  createdAt = (i) => new Date(BASE_TIME.getTime() + i),
  pendingUntil = (i) => new Date(BASE_TIME.getTime() + 20 * DAY + i),
} = {}) {
  for (let batchStart = 0; batchStart < count; batchStart += 250) {
    const values = [];
    const params = [];
    const batchEnd = Math.min(count, batchStart + 250);
    for (let local = batchStart; local < batchEnd; local++) {
      const i = start + local;
      const offset = params.length;
      values.push(`($${offset + 1},$${offset + 2},4663,$${offset + 3},$${offset + 4},$${offset + 5},18,
        $${offset + 6},'Bulk','family-1','account-1',true,'Bulk rationale',$${offset + 7},NULL,
        $${offset + 8},'not_applicable',$${offset + 9},$${offset + 10})`);
      params.push(
        `${prefix}-${String(i).padStart(5, '0')}`,
        `${prefix}-key-${String(i).padStart(5, '0')}`,
        ticker(i),
        keccak256(toBytes(`${prefix}-ticker-${i}`)),
        address(String((i % 9) + 1)),
        keccak256(toBytes(`${prefix}-provider-${i}`)),
        keccak256(toBytes(`${prefix}-evidence-${i}`)),
        status,
        createdAt(i),
        pendingUntil(i),
      );
    }
    await pool.query(`INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,sponsor_support_active,
       rationale,evidence_hash,evidence_uri,status,execution_status,created_at,pending_until)
      VALUES ${values.join(',')}`, params);
  }
}

async function insertBulkEndorsements(pool, nominationId, count, { active = true, prefix = 'old-family' } = {}) {
  for (let batchStart = 0; batchStart < count; batchStart += 500) {
    const values = [];
    const params = [];
    const batchEnd = Math.min(count, batchStart + 500);
    for (let i = batchStart; i < batchEnd; i++) {
      const offset = params.length;
      values.push(`($${offset + 1},$${offset + 2},$${offset + 3},$${offset + 4},NULL,$${offset + 5})`);
      params.push(nominationId, `${prefix}-${String(i).padStart(5, '0')}`,
        `${prefix}-account-${i}`, active, BASE_TIME);
    }
    await pool.query(`INSERT INTO rwa_nomination_endorsements_v2
      (nomination_id,family_id,account_id,active,rationale,updated_at) VALUES ${values.join(',')}`, params);
  }
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

// Player mutations follow the repository's family-before-membership order, then lock the domain
// row. Membership is re-read after the family lock, so a move at the seam cannot grant stale-family
// authority. pg-mem proves the SQL/interleaving contract here, not real deadlock behavior.
{
  const { pool, actors } = await fixture();
  const sql = [];
  await nominate(pool, actors[0], asset(1), BASE_TIME, { log: sql });
  const familyLock = sql.findIndex((query) => /FROM\s+gangs\s+WHERE\s+id=\$1\s+FOR UPDATE/i.test(query));
  const membershipLock = sql.findIndex((query) => /FROM\s+gang_members.*FOR UPDATE/i.test(query));
  const nominationLock = sql.findIndex((query) => /FROM\s+rwa_nominations_v2.*FOR UPDATE/is.test(query));
  assert(familyLock >= 0 && membershipLock > familyLock && nominationLock > membershipLock,
    'family, membership, and nomination locks are acquired in canonical order');

  let moved = false;
  await rejectsCode(nominate(pool, actors[1], asset(2), BASE_TIME, {
    afterQuery: async (query, params, raw) => {
      if (!moved && /FROM\s+gangs\s+WHERE\s+id=\$1\s+FOR UPDATE/i.test(query)) {
        moved = true;
        await raw.query('UPDATE gang_members SET gang_id=$2 WHERE character_id=$1',
          [actors[1].id, actors[2].familyId]);
      }
    },
  }), 'contention', 'membership change after the family lock never grants stale authority');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nominations_v2')).length, 1);
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
  const fresh = await nominate(pool, actors[1], asset(1, { evidenceHash: hash('b') }), deadline);
  assert.equal(fresh.duplicate, false);
  assert.equal(fresh.nomination.priorNominationId, first.nomination.id);
  assert.equal(fresh.nomination.createdAt, deadline.toISOString());
  assert.equal((await rows(pool, 'SELECT status FROM rwa_nominations_v2 WHERE id=$1',
    [first.nomination.id]))[0].status, 'expired');
  await pool.end();
}

// A linked same-version nomination must carry genuinely new evidence. Reusing the predecessor's
// nonzero hash fails without consuming cadence, writing a nomination, or appending an event; the
// same URI remains acceptable when its content hash changes.
{
  const { pool, actors } = await fixture();
  const original = asset(1);
  const first = await nominate(pool, actors[0], original, BASE_TIME);
  await claimRwaNominationReview(adaptedClient(pool, { now: BASE_TIME }), first.nomination.id, 'reviewer:freshness');
  await disposeRwaNominationReview(adaptedClient(pool, { now: BASE_TIME }), first.nomination.id,
    'reviewer:freshness', { disposition: 'rejected', reason: 'Superseded provider evidence.' });
  assert.deepEqual((await rows(pool,
    'SELECT status,evidence_hash,asset_version_key FROM rwa_nominations_v2 WHERE id=$1', [first.nomination.id]))[0], {
    status: 'rejected', evidence_hash: original.evidenceHash, asset_version_key: original.assetVersionKey,
  });
  const attemptAt = new Date(BASE_TIME.getTime() + 7 * DAY);
  const beforeEvents = (await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length;
  await rejectsCode(nominate(pool, actors[0], original, attemptAt), 'evidence_not_fresh',
    'a direct predecessor hash cannot be reused');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nominations_v2')).length, 1);
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length, beforeEvents);
  const fresh = await nominate(pool, actors[0], asset(1, { evidenceHash: hash('b') }), attemptAt);
  assert.equal(fresh.nomination.priorNominationId, first.nomination.id,
    'failed freshness validation did not consume the exact seven-day cadence');
  const board = await rwaNominationBoard(adaptedClient(pool, { now: attemptAt }));
  assert.equal(board.items[0].tickerConflicts.some((conflict) => conflict.id === first.nomination.id), false,
    'a same-key predecessor is history, not a ticker/version conflict');
  await pool.end();
}

// The same freshness rule applies once expiry has already been durably observed by a worker.
{
  const { pool, actors } = await fixture();
  const original = asset(1);
  const first = await nominate(pool, actors[0], original, BASE_TIME);
  const deadline = new Date(BASE_TIME.getTime() + 30 * DAY);
  await expireRwaNominations(adaptedClient(pool, { now: deadline }), { limit: 1 });
  const beforeEvents = (await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length;
  await rejectsCode(nominate(pool, actors[1], original, deadline), 'evidence_not_fresh',
    'an expired direct predecessor still requires a new evidence hash');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nominations_v2')).length, 1);
  assert.equal((await rows(pool, 'SELECT status FROM rwa_nominations_v2 WHERE id=$1',
    [first.nomination.id]))[0].status, 'expired');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length, beforeEvents);
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

// Domain helpers treat an actual checked-out PoolClient as caller-owned. They must not nest a
// transaction, reconnect, commit, roll back, or release it: Task 4 composes the terminal fact and
// Safe package in one outer transaction. pg-mem does not implement rollback, so this fixture uses
// its documented backup/restore hook while still passing the actual adapter PoolClient.
{
  const { pool, actors, controls } = await rollbackCapableFixture();
  const at = new Date();
  const made = await nominate(pool, actors[0], asset(1), at);
  await claimRwaNominationReview(adaptedClient(pool, { now: at }), made.nomination.id, 'reviewer:atomic');
  const beforeEvents = (await rows(pool, 'SELECT * FROM rwa_nomination_events_v2 WHERE nomination_id=$1',
    [made.nomination.id])).length;
  controls.length = 0;
  const client = await pool.connect();
  let nestedConnects = 0;
  let domainReleases = 0;
  const rawConnect = client.connect.bind(client);
  const rawRelease = client.release.bind(client);
  client.connect = async (...args) => {
    nestedConnects++;
    return rawConnect(...args);
  };
  client.release = (...args) => {
    domainReleases++;
    return rawRelease(...args);
  };
  await client.query('BEGIN');
  await assert.rejects(async () => {
    await disposeRwaNominationReview(client, made.nomination.id, 'reviewer:atomic', {
      disposition: 'approved', reason: 'Atomic package probe.',
    });
    await client.query(
      'INSERT INTO task4_safe_package_probe (nomination_id,payload) VALUES ($1,NULL)',
      [made.nomination.id],
    );
  });
  await client.query('ROLLBACK');
  assert.equal(nestedConnects, 0, 'caller-owned PoolClient is never reconnected');
  assert.equal(domainReleases, 0, 'caller-owned PoolClient is never released by a domain helper');
  assert.deepEqual(controls, ['BEGIN', 'ROLLBACK'], 'the domain emitted no nested transaction control');
  assert.equal((await rows(pool, 'SELECT status FROM rwa_nominations_v2 WHERE id=$1',
    [made.nomination.id]))[0].status, 'under_review');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_events_v2 WHERE nomination_id=$1',
    [made.nomination.id])).length, beforeEvents, 'outer rollback removes the disposition event');
  rawRelease();
  await pool.end();
}

// A pool call owns exactly one checkout and transaction. This adapter is intentionally pool-shaped
// (connect, no release); query-only adapters remain explicitly caller-owned elsewhere in this file.
{
  const { pool, actors } = await fixture();
  const made = await nominate(pool, actors[0], asset(1), new Date());
  const callerSql = [];
  await claimRwaNominationReview(adaptedClient(pool, { now: new Date(), log: callerSql }),
    made.nomination.id, 'reviewer:pool-owner');
  assert.equal(callerSql.some((query) => /^(BEGIN|COMMIT|ROLLBACK)\b/i.test(query.trim())), false,
    'a query-only adapter remains explicitly caller-owned');
  const sql = [];
  const owner = ownedPool(pool, sql);
  await claimRwaNominationReview(owner.db, made.nomination.id, 'reviewer:pool-owner');
  assert.equal(owner.counts.connect, 1);
  assert.equal(owner.counts.release, 1);
  assert.equal(sql.filter((query) => /^BEGIN\b/i.test(query.trim())).length, 1);
  assert.equal(sql.filter((query) => /^COMMIT\b/i.test(query.trim())).length, 1);
  assert.equal(sql.filter((query) => /^ROLLBACK\b/i.test(query.trim())).length, 0);
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

// Public board work is bounded by its live page, not historical cardinality or returned-item count.
// Enrichment is batched, every owned pool read is one REPEATABLE READ snapshot, and pagination
// support/cursor values come from the same generation.
{
  const { pool, actors } = await fixture();
  const made = [];
  for (let i = 0; i < 5; i++) {
    made.push((await nominate(pool, actors[i], asset(i + 1), new Date(BASE_TIME.getTime() + i * HOUR))).nomination);
  }
  await pool.query("UPDATE rwa_nominations_v2 SET status='rejected',disposition_by='history',disposition_at=$2 WHERE id=$1",
    [made[4].id, BASE_TIME]);
  const oneSql = [];
  const one = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: oneSql }), { limit: 1 });
  const manySql = [];
  const many = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: manySql }), { limit: 4 });
  const maxSql = [];
  await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: maxSql }), { limit: 500 });
  assert.equal(one.items.length, 1);
  assert.equal(many.items.length, 4);
  assert.equal(many.items.some((item) => item.id === made[4].id), false,
    'terminal history is outside the procedural board domain');
  assert.equal(oneSql.length, manySql.length,
    'batch enrichment keeps query count constant as page size grows without state transitions');
  assert.equal(oneSql.length, 8, 'one mutation-free board page uses eight hard-bounded domain queries');
  assert.equal(maxSql.length, manySql.length, 'the accepted 500-row cap retains the constant query budget');
  assert.match(manySql.find((sql) => sql.includes('rwa_board_candidates')),
    /status\s+IN\s*\('pending','review_requested','under_review'\)/i);

  const page1Sql = [];
  const page1 = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: page1Sql }), { limit: 2 });
  const page2Sql = [];
  const page2 = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: page2Sql }), {
    limit: 2, cursor: page1.nextCursor,
  });
  assert.deepEqual([...page1.items, ...page2.items].map((item) => item.id), made.slice(0, 4).map((item) => item.id));
  assert.equal(page1Sql.length, page2Sql.length, 'later keyset pages keep the same constant query budget');

  const poolSql = [];
  const poolOwner = ownedPool(pool, poolSql);
  await rwaNominationBoard(poolOwner.db, { limit: 2 });
  assert.equal(poolOwner.counts.connect, 1);
  assert.equal(poolOwner.counts.release, 1);
  assert.equal(poolSql.filter((sql) => /^BEGIN\s+ISOLATION\s+LEVEL\s+REPEATABLE\s+READ$/i.test(sql.trim())).length, 1,
    'pool-owned public board uses one coherent repeatable-read transaction');
  assert.equal(poolSql.filter((sql) => /^COMMIT\b/i.test(sql.trim())).length, 1);
  await pool.end();
}

// The public board has a reviewed, immutable 5,000-live-row work horizon. The 5,001st live
// candidate fails closed before ranking or mutation; finalizedOnly applies to the lightweight
// candidate probe itself, so unrelated nonfinalized live rows cannot overload a finalized view.
{
  const { pool } = await fixture();
  await insertBulkNominations(pool, 5001, { prefix: 'wall', ticker: (i) => `W${i}` });
  const sql = [];
  const trace = [];
  const beforeEvents = (await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length;
  await rejectsCode(rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: sql, trace }), { limit: 1 }),
    'board_overloaded', 'the 5,001st live candidate fails the whole board closed');
  const probe = trace.find((entry) => entry.sql.includes('rwa_board_candidates'));
  assert(probe, 'board runs the lightweight candidate sentinel before ranking');
  assert.equal(probe.params.at(-1), 5001, 'the reviewed candidate sentinel is exactly 5,001');
  assert.equal(sql.some((query) => /WITH\s+scores/i.test(query)), false,
    'overload performs no support aggregation');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length, beforeEvents);
  assert.equal((await rows(pool, "SELECT * FROM rwa_nominations_v2 WHERE status <> 'pending'")).length, 0,
    'overload performs no partial expiry or cleanup mutation');

  await pool.query(
    `INSERT INTO stock_asset_versions_v2
      (asset_version_key,chain_id,ticker_hash,ticker,name,token_address,token_decimals,
       robinhood_asset_id_hash,registry_index,active,last_catalog_version,synced_at)
     SELECT asset_version_key,chain_id,ticker_hash,ticker,name,token_address,token_decimals,
       robinhood_asset_id_hash,0,true,1,$2::timestamptz FROM rwa_nominations_v2 WHERE id=$1`,
    ['wall-00000', BASE_TIME],
  );
  const finalized = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME }), {
    finalizedOnly: true, limit: 1,
  });
  assert.deepEqual(finalized.items.map((item) => item.id), ['wall-00000']);
  await pool.end();
}

// Ranking/enrichment work is restricted to the lightweight live universe and current seated active
// slots. This fixture is materially larger than one page and carries terminal nomination history
// plus inactive nonseated slot history, neither of which enters rank or item support.
{
  const { pool } = await fixture();
  await insertBulkNominations(pool, 120, { prefix: 'live-work', ticker: (i) => `L${i}` });
  await insertBulkNominations(pool, 300, {
    prefix: 'terminal-history', ticker: (i) => `H${i}`, status: 'rejected',
    createdAt: (i) => new Date(BASE_TIME.getTime() - DAY - i),
    pendingUntil: (i) => new Date(BASE_TIME.getTime() + DAY + i),
  });
  await pool.query(
    `INSERT INTO rwa_nomination_endorsements_v2
      (nomination_id,family_id,account_id,active,rationale,updated_at)
     SELECT id,'family-2','account-2',true,NULL,$1::timestamptz FROM rwa_nominations_v2 WHERE id LIKE 'live-work-%'`,
    [BASE_TIME],
  );
  await pool.query(
    `INSERT INTO rwa_nomination_endorsements_v2
      (nomination_id,family_id,account_id,active,rationale,updated_at)
     SELECT id,'departed-' || id,'departed-account',false,NULL,$1::timestamptz
       FROM rwa_nominations_v2 WHERE id LIKE 'live-work-%'`,
    [BASE_TIME],
  );
  let candidateRows;
  let activeSlotRows;
  const sql = [];
  const board = await rwaNominationBoard(adaptedClient(pool, {
    now: BASE_TIME,
    log: sql,
    afterQuery: (query, params, raw, result) => {
      if (query.includes('rwa_board_candidates')) candidateRows = result.rows;
      if (query.includes('rwa_board_active_slots')) activeSlotRows = result.rows;
    },
  }), { limit: 100 });
  assert.equal(candidateRows.length, 120, 'the candidate universe excludes 300 terminal rows');
  assert.equal(candidateRows[0].id, 'live-work-00000');
  assert.equal(candidateRows.at(-1).id, 'live-work-00119',
    'the lightweight universe has stable immutable created/id ordering');
  assert.equal(activeSlotRows.length, 100, 'enrichment returns at most one current slot per selected nomination here');
  assert.equal(activeSlotRows.every((slot) => slot.active && slot.family_id === 'family-2'), true,
    'inactive and nonseated historical slots do not enter enrichment');
  assert.equal(board.items.length, 100);
  assert.equal(board.items.every((item) => item.support === 2 && item.id.startsWith('live-work-')), true);
  assert.equal(sql.length, 8, 'query count is constant beyond one full page');
  const ranking = sql.find((query) => /WITH\s+scores/i.test(query));
  assert.match(ranking, /n\.id\s+IN\s*\(/i, 'support aggregation is restricted to candidate IDs');
  assert.match(ranking, /e\.active[\s\S]*e\.family_id\s+IN/i,
    'ranking joins only active current seated endorsement slots');
  await pool.end();
}

// Stale-slot cleanup has its own 5,001-row preflight sentinel. Overflow is rejected before the
// first sponsor/endorsement cleanup update or event, leaving every stored stale slot active.
{
  const { pool } = await fixture();
  await insertBulkNominations(pool, 1, { prefix: 'stale-wall', ticker: () => 'STALE' });
  await pool.query(
    "UPDATE rwa_nominations_v2 SET sponsor_family_id='departed-sponsor' WHERE id='stale-wall-00000'",
  );
  await insertBulkEndorsements(pool, 'stale-wall-00000', 5001);
  const trace = [];
  await rejectsCode(rwaNominationBoard(adaptedClient(pool, {
    now: BASE_TIME,
    trace,
  }), { limit: 1 }), 'board_overloaded', 'the stale-slot sentinel fails before cleanup');
  const preflight = trace.find((entry) => entry.sql.includes('rwa_board_stale_preflight'));
  assert.equal(preflight.params.at(-1), 5001, 'the reviewed stale-slot sentinel is exactly 5,001');
  assert.equal((await rows(pool,
    "SELECT sponsor_support_active FROM rwa_nominations_v2 WHERE id='stale-wall-00000'"))[0]
    .sponsor_support_active, true);
  assert.equal((await rows(pool,
    "SELECT * FROM rwa_nomination_endorsements_v2 WHERE nomination_id='stale-wall-00000' AND active")).length,
  5001, 'stale overflow performs no partial endorsement cleanup');
  assert.equal((await rows(pool, 'SELECT * FROM rwa_nomination_events_v2')).length, 0,
    'stale overflow appends no partial cleanup event');
  await pool.end();
}

// One conflict algorithm serves PostgreSQL and pg-mem: the bounded live candidate universe is
// grouped in memory by ticker, then filtered by different row + different key before the exact 20+1
// sentinel. A dense early ticker cannot starve a later ticker on the same returned page.
{
  const { pool } = await fixture();
  await insertBulkNominations(pool, 45, { prefix: 'aaa', ticker: () => 'AAA' });
  await insertBulkNominations(pool, 22, {
    prefix: 'bbb', ticker: () => 'BBB',
    createdAt: (i) => new Date(BASE_TIME.getTime() + 500 + i),
    pendingUntil: (i) => new Date(BASE_TIME.getTime() + 20 * DAY + 500 + i),
  });
  await insertBulkNominations(pool, 2, {
    prefix: 'zzz', ticker: () => 'ZZZ',
    createdAt: (i) => new Date(BASE_TIME.getTime() + 1000 + i),
    pendingUntil: (i) => new Date(BASE_TIME.getTime() + 20 * DAY + 1000 + i),
  });
  const sql = [];
  const board = await rwaNominationBoard(adaptedClient(pool, { now: BASE_TIME, log: sql }), { limit: 69 });
  const aaa = board.items.filter((item) => item.ticker === 'AAA');
  const bbb = board.items.filter((item) => item.ticker === 'BBB');
  const zzz = board.items.filter((item) => item.ticker === 'ZZZ');
  assert.equal(aaa.length, 45);
  assert.equal(aaa.every((item) => item.tickerConflicts.length === 20 && item.tickerConflictsHasMore), true);
  assert.deepEqual(aaa[0].tickerConflicts.map((item) => item.id),
    Array.from({ length: 20 }, (_, i) => `aaa-${String(i + 1).padStart(5, '0')}`),
  'an early self is removed before taking the 20+1 sentinel');
  assert.equal(bbb.length, 22);
  assert.equal(bbb[0].tickerConflicts.length, 20);
  assert.equal(bbb[0].tickerConflictsHasMore, true,
    'with exactly 22 versions, an early self is excluded before the exact 20+1 sentinel');
  assert.equal(zzz.length, 2);
  assert.deepEqual(zzz.map((item) => item.tickerConflicts.map((conflict) => conflict.id)),
    [['zzz-00001'], ['zzz-00000']]);
  assert.equal(zzz.every((item) => item.tickerConflictsHasMore === false), true);
  assert.equal(sql.some((query) => /ROW_NUMBER\(\)|rwa_board_conflicts/i.test(query)), false,
    'conflict context adds no divergent SQL query or per-item N+1');
  await pool.end();
}

// Deterministic generation seam: an endorsement committed after ranking cannot be mixed into the
// returned support or opaque cursor from that earlier rank generation. Real PostgreSQL supplies the
// stronger repeatable-read visibility guarantee; pg-mem cannot prove MVCC behavior.
{
  const { pool, actors } = await fixture();
  const n1 = await nominate(pool, actors[0], asset(1), BASE_TIME);
  await nominate(pool, actors[1], asset(2), new Date(BASE_TIME.getTime() + HOUR));
  let injected = false;
  const board = await rwaNominationBoard(adaptedClient(pool, {
    now: BASE_TIME,
    afterQuery: async (sql, params, raw) => {
      if (!injected && /WITH\s+scores/i.test(sql)) {
        injected = true;
        await raw.query(
          `INSERT INTO rwa_nomination_endorsements_v2
            (nomination_id,family_id,account_id,active,rationale,updated_at)
           VALUES ($1,$2,$3,true,NULL,$4)`,
          [n1.nomination.id, actors[2].familyId, actors[2].account_id, BASE_TIME],
        );
      }
    },
  }), { limit: 1 });
  const cursor = JSON.parse(Buffer.from(board.nextCursor, 'base64url').toString('utf8'));
  assert.equal(board.items[0].support, 1, 'returned support stays with the ranking generation');
  assert.equal(cursor.support, board.items[0].support, 'cursor support exactly matches the returned row');
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

// Owned expiry uses one repeatable-read selection/lock snapshot. If another worker terminalizes B
// after A,B,C were selected for a limit-2 page, C remains the sentinel and hasMore stays true; the
// next cursor drains C,D instead of falsely declaring the worker empty.
{
  const { pool } = await fixture();
  await insertBulkNominations(pool, 4, {
    prefix: 'expiry-race', ticker: (i) => `ER${i}`,
    createdAt: (i) => new Date(BASE_TIME.getTime() - 40 * DAY + i),
    pendingUntil: (i) => new Date(BASE_TIME.getTime() - (4 - i) * HOUR),
  });
  let terminalized = false;
  const sql = [];
  const owner = ownedAdaptedPool(pool, {
    now: BASE_TIME,
    log: sql,
    afterQuery: async (query, params, raw) => {
      if (!terminalized && /SELECT\s+id,pending_until\s+FROM\s+rwa_nominations_v2/i.test(query)) {
        terminalized = true;
        await raw.query("UPDATE rwa_nominations_v2 SET status='rejected' WHERE id='expiry-race-00001'");
      }
    },
  });
  const first = await expireRwaNominations(owner.db, { limit: 2 });
  assert.equal(first.processed, 1);
  assert.equal(first.hasMore, true, 'the snapshot sentinel survives concurrent terminalization');
  assert(first.nextCursor);
  assert.equal(sql.filter((query) => /^BEGIN\s+ISOLATION\s+LEVEL\s+REPEATABLE\s+READ$/i.test(query.trim())).length, 1);
  assert.equal(owner.counts.connect, 1);
  assert.equal(owner.counts.release, 1);
  const second = await expireRwaNominations(adaptedClient(pool, { now: BASE_TIME }), {
    limit: 2, cursor: first.nextCursor,
  });
  assert.equal(second.processed, 2);
  assert.equal(second.hasMore, false);
  assert.deepEqual((await rows(pool, 'SELECT id,status FROM rwa_nominations_v2 ORDER BY id')),
    [
      { id: 'expiry-race-00000', status: 'expired' },
      { id: 'expiry-race-00001', status: 'rejected' },
      { id: 'expiry-race-00002', status: 'expired' },
      { id: 'expiry-race-00003', status: 'expired' },
    ]);
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

// Every worker first selects in its public cursor order, then acquires the actual multi-row locks
// in immutable nomination-id order. This SQL regression does not claim pg-mem deadlock proof.
{
  const { pool, actors } = await fixture();
  for (let i = 0; i < 3; i++) {
    await nominate(pool, actors[i], asset(i + 1), new Date(BASE_TIME.getTime() + i * HOUR));
  }
  const refreshSql = [];
  await refreshRwaNominationSeatState(adaptedClient(pool, { now: BASE_TIME, log: refreshSql }), { limit: 3 });
  const expirySql = [];
  await expireRwaNominations(adaptedClient(pool, {
    now: new Date(BASE_TIME.getTime() + 31 * DAY), log: expirySql,
  }), { limit: 3 });
  for (const [name, sql] of [['refresh', refreshSql], ['expiry', expirySql]]) {
    const selection = sql.find((query) => /SELECT\s+id,(created_at|pending_until)\s+FROM\s+rwa_nominations_v2/i.test(query));
    const lock = sql.find((query) => /SELECT\s+\*\s+FROM\s+rwa_nominations_v2.*FOR UPDATE/is.test(query));
    assert(selection && !/FOR UPDATE/i.test(selection), `${name} cursor selection does not take locks out of ID order`);
    assert.match(lock, /ORDER BY\s+id\s+ASC\s+FOR UPDATE/i,
      `${name} multi-row lock acquisition is immutable ID ascending`);
  }
  await pool.end();
}

assert.match(SCHEMA, /ix_rwa_nominations_version_history_v2[\s\S]*asset_version_key, created_at DESC, id DESC/i);
assert.match(SCHEMA, /ix_rwa_nominations_live_ticker_version_v2[\s\S]*ticker, asset_version_key, created_at, id[\s\S]*WHERE status IN/i);
assert.match(SCHEMA, /ix_rwa_nominations_live_ticker_order_v2[\s\S]*ticker, created_at, id, asset_version_key[\s\S]*WHERE status IN/i);
assert.match(SCHEMA, /ix_rwa_nominations_live_queue_v2[\s\S]*created_at, id[\s\S]*WHERE status IN/i);

console.log('✅ RWA nominations v2 domain tests passed — immutable candidate identity, current-seat support, fixed threshold/review ownership, deadline precedence, PostgreSQL duplicate SQL, and bounded stable cursors.');
