import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { getAddress } from 'viem';
import { dbCaps, makeDb } from '../src/db.js';
import { buildServer } from '../src/server.js';
import {
  canonicalTickerBallotTallyHashV2,
  castTickerVoteV2,
  closeTickerBallotV2,
  openTickerBallotV2,
  tallyTickerBallotV2,
  tickerBallotBoardV2,
} from '../src/commission.js';
import { finalizedStockCatalogForBallotV2 } from '../src/stockcatalogv2.js';
import { removeMember } from '../src/social/gangs.js';

const REGISTRY = getAddress(`0x${'a'.repeat(40)}`);
const OTHER_REGISTRY = getAddress(`0x${'b'.repeat(40)}`);
const ZERO_HASH = `0x${'0'.repeat(64)}`;
const hash = (char) => `0x${char.repeat(64)}`;
const address = (char) => getAddress(`0x${char.repeat(40)}`);
const DAY = '20700';
const NEXT_DAY = '20701';
const WALL = '2026-09-04T00:00:00.000Z';
const CLOSE = '2026-09-05T00:00:00.000Z';
const PURCHASE_UNTIL = '2026-09-05T02:00:00.000Z';
const DETAILS = hash('d');
// pg-mem implements PostgreSQL NUMERIC through JavaScript doubles. Keep its integration values
// above MAX_SAFE_INTEGER but exactly representable; the independent ABI vector below deliberately
// uses adjacent, non-representable uint256 values to kill any Number coercion in authority code.
const CATALOG_VERSION = '9007199254740992';
const MAX_ETH_WEI = '9007199254742016';

const originalEnv = {
  CHAIN_RPC_URL: process.env.CHAIN_RPC_URL,
  STOCK_TOKEN_REGISTRY_V2_ADDRESS: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
  STOCK_TOKEN_REGISTRY_V2_START_BLOCK: process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
  MOD_KEY: process.env.MOD_KEY,
  RATE_LIMIT: process.env.RATE_LIMIT,
};
process.env.CHAIN_RPC_URL = 'https://finalized-rpc.example/';
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK = '0';
process.env.MOD_KEY = 'task-five-mod-key';
process.env.RATE_LIMIT = 'off';

const candidate = (n, overrides = {}) => ({
  assetVersionKey: overrides.assetVersionKey ?? hash(String(n)),
  tickerHash: overrides.tickerHash ?? hash(String.fromCharCode(96 + n)),
  ticker: overrides.ticker ?? `T${n}`,
  name: overrides.name ?? `Token ${n}`,
  tokenAddress: overrides.tokenAddress ?? address(String(n)),
  tokenDecimals: overrides.tokenDecimals ?? 18,
  robinhoodAssetIdHash: overrides.robinhoodAssetIdHash ?? hash(String.fromCharCode(102 + n)),
  registryIndex: overrides.registryIndex ?? String(n - 1),
  active: overrides.active ?? true,
  activatedAt: overrides.activatedAt ?? '2026-09-03T23:59:59.999Z',
  deactivatedAt: overrides.deactivatedAt ?? null,
});

async function seedCatalog(pool, {
  assets = [candidate(1), candidate(2)],
  catalogVersion = CATALOG_VERSION,
  snapshotHash = hash('c'),
  registryAddress = REGISTRY,
  syncedAt = WALL,
  foReady = true,
} = {}) {
  await pool.query('DELETE FROM stock_catalog_getter_inbox_v2');
  await pool.query('DELETE FROM stock_catalog_getter_checkpoint_v2');
  await pool.query('DELETE FROM stock_asset_active_heads_v2');
  await pool.query('DELETE FROM stock_asset_versions_v2');
  await pool.query('DELETE FROM stock_catalog_sync_state_v2');
  await pool.query(
    `INSERT INTO stock_catalog_sync_state_v2
      (id,chain_id,registry_address,catalog_version,finalized_block_number,
       finalized_block_hash,snapshot_hash,observation_hash,finalized_horizon_number,
       finalized_horizon_hash,caught_up,verified_at,ready_verified_at,synced_at)
     VALUES (1,4663,$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)`,
    [registryAddress, catalogVersion, '9007199254743040', hash('f'), snapshotHash,
      foReady ? hash('e') : null, foReady ? '9007199254743040' : null,
      foReady ? hash('f') : null, foReady, foReady ? syncedAt : null,
      foReady ? syncedAt : null, syncedAt],
  );
  if (foReady) {
    await pool.query(
      `INSERT INTO stock_catalog_getter_checkpoint_v2
        (consumer_key,chain_id,contract_address,start_block_number,last_applied_block_number,
         last_applied_block_hash,last_observation_hash,finalized_horizon_number,
         finalized_horizon_hash,caught_up,verified_at,ready_verified_at)
       VALUES ('stock_catalog_getter_v2',4663,$1,$2,$3,$4,$5,$6,$7,true,$8,$8)`,
      [registryAddress, process.env.STOCK_TOKEN_REGISTRY_V2_START_BLOCK,
        '9007199254743040', hash('f'), hash('e'), '9007199254743040', hash('f'), syncedAt],
    );
  }
  for (const asset of assets) {
    await pool.query(
      `INSERT INTO stock_asset_versions_v2
        (asset_version_key,chain_id,ticker_hash,ticker,name,token_address,token_decimals,
         robinhood_asset_id_hash,registry_index,active,registered_at,activated_at,
         deactivated_at,last_catalog_version,synced_at)
       VALUES ($1,4663,$2,$3,$4,$5,$6,$7,$8,$9,'2026-09-01T00:00:00Z',$10,
         $11,$12,$13)`,
      [asset.assetVersionKey, asset.tickerHash, asset.ticker, asset.name, asset.tokenAddress,
        asset.tokenDecimals, asset.robinhoodAssetIdHash, asset.registryIndex, asset.active,
        asset.activatedAt, asset.active ? null : (asset.deactivatedAt ?? asset.activatedAt),
        catalogVersion, syncedAt],
    );
    if (asset.active) {
      for (const [dimension, value] of [
        ['tickerHash', asset.tickerHash],
        ['tokenAddress', asset.tokenAddress],
        ['robinhoodAssetIdHash', asset.robinhoodAssetIdHash],
      ]) {
        await pool.query(
          `INSERT INTO stock_asset_active_heads_v2
            (dimension_type,dimension_value,asset_version_key) VALUES ($1,$2,$3)`,
          [dimension, value, asset.assetVersionKey],
        );
      }
    }
  }
  return assets;
}

function epochSeconds(wall) {
  const milliseconds = Date.parse(wall);
  if (!Number.isFinite(milliseconds)) throw new Error(`invalid test wall ${wall}`);
  return String(milliseconds / 1000);
}

function clockedQuery(query, wall, currentDay = DAY) {
  return async (sql, params = []) => {
    if (sql.includes('ticker_ballot_v2_clock')) {
      const closesAt = String(params[0]) === NEXT_DAY
        ? '2026-09-06T00:00:00.000Z'
        : CLOSE;
      return { rows: [{
        wall_now: new Date(wall), current_day: currentDay, closes_at: new Date(closesAt),
        epoch_seconds: epochSeconds(wall),
      }] };
    }
    if (sql.includes('ticker_ballot_v2_dissolution_clock')) {
      return { rows: [{ epoch_seconds: epochSeconds(wall) }] };
    }
    return query(sql, params);
  };
}

function clockedPool(pool, wall, statements = null, currentDay = DAY) {
  return {
    query: clockedQuery(pool.query.bind(pool), wall, currentDay),
    async connect() {
      const client = await pool.connect();
      const query = clockedQuery(client.query.bind(client), wall, currentDay);
      return {
        query: async (sql, params) => {
          statements?.push(sql);
          return query(sql, params);
        },
        release: () => client.release(),
      };
    },
  };
}

async function seedFamilies(pool, standings = [
  '9007199254747136',
  '9007199254746112',
  '9007199254745088',
  '9007199254744064',
  '9007199254743040',
  '9007199254742016',
]) {
  const families = [];
  for (let i = 0; i < standings.length; i++) {
    const familyId = `family-${String.fromCharCode(97 + i)}`;
    const characterId = `character-${i}`;
    const accountId = `account-${i}`;
    await pool.query(
      'INSERT INTO characters (id,account_id,name,season) VALUES ($1,$2,$3,0)',
      [characterId, accountId, `Ballot Actor ${i}`],
    );
    await pool.query(
      'INSERT INTO gangs (id,name,tag,season_tribute) VALUES ($1,$2,$3,$4)',
      [familyId, `Ballot Family ${i}`, `B${i}`, standings[i]],
    );
    await pool.query(
      "INSERT INTO gang_members (gang_id,character_id,role) VALUES ($1,$2,'boss')",
      [familyId, characterId],
    );
    families.push({
      familyId,
      ch: { id: characterId, account_id: accountId },
      h: {
        owned: { gangId: familyId, gangRole: 'boss' },
        track: async () => {},
      },
      standing: standings[i],
    });
  }
  return families;
}

async function withClockedClient(pool, wall, fn) {
  const raw = await pool.connect();
  const client = {
    query: clockedQuery(raw.query.bind(raw), wall),
    release: () => raw.release(),
  };
  try { return await fn(client); } finally { raw.release(); }
}

async function expectCode(promise, code) {
  await assert.rejects(promise, (error) => error?.code === code,
    `expected stable error code ${code}`);
}

async function plantBallotVotes(pool, day, assetVersionKey, count, { prefix = 'planted' } = {}) {
  const params = [];
  const values = [];
  for (let i = 0; i < count; i++) {
    const at = params.length;
    params.push(day, `${prefix}-${String(i).padStart(3, '0')}`, assetVersionKey, 'T1', String(1000 + i));
    values.push(`($${at + 1},$${at + 2},$${at + 3},$${at + 4},$${at + 5})`);
  }
  if (values.length) await pool.query(
    `INSERT INTO commission_ticker_votes_v2
      (day,family_id,asset_version_key,ticker,standing) VALUES ${values.join(',')}`,
    params,
  );
}

function sqlStateError(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function commitFaultPool(pool, codes) {
  const stats = { connects: 0, releases: 0, rollbacks: 0, commits: 0 };
  return {
    stats,
    async connect() {
      const attempt = stats.connects++;
      const raw = await pool.connect();
      return {
        async query(sql, params) {
          if (sql === 'ROLLBACK') stats.rollbacks++;
          if (sql === 'COMMIT') {
            stats.commits++;
            const result = await raw.query(sql, params);
            const code = codes[attempt];
            if (code) throw sqlStateError(code, `injected ${code} on attempt ${attempt + 1}`);
            return result;
          }
          return raw.query(sql, params);
        },
        release() {
          stats.releases++;
          raw.release();
        },
      };
    },
  };
}

const fixRegressionFailures = [];
async function fixRegression(name, fn) {
  try {
    await fn();
  } catch (error) {
    fixRegressionFailures.push({ name, error });
  }
}

await fixRegression('pre-FO catalog fixtures fail closed until explicitly caught up', async () => {
  const pool = await makeDb();
  try {
    await seedCatalog(pool, { foReady: false });
    const unavailable = await withClockedClient(pool, WALL, (client) =>
      finalizedStockCatalogForBallotV2(client, {
        canonicalClose: CLOSE,
        observedEpochSeconds: epochSeconds(WALL),
      }));
    assert.equal(unavailable.available, false);
    assert.equal(unavailable.reason, 'identity');

    await seedCatalog(pool, { foReady: true });
    const ready = await withClockedClient(pool, WALL, (client) =>
      finalizedStockCatalogForBallotV2(client, {
        canonicalClose: CLOSE,
        observedEpochSeconds: epochSeconds(WALL),
      }));
    assert.equal(ready.available, true,
      'only a coherent caught-up FO fixture enables the existing ballot catalog cases');
    assert.equal(ready.activeAssets.length, 2);
  } finally {
    await pool.end();
  }
});

// Independent literal Solidity ABI vector. The expected hash was produced once from the frozen
// type list, then checked in; this expectation never calls the production helper or builder.
const LITERAL_TALLY_HASH = '0x0884872988bf5b6da04a42955e08473a4664834e44ae18081ec3b33363f1ed23';
const literalCommitment = {
  chainId: '4663',
  day: '20700',
  catalogVersion: '900719925474099312345',
  catalogSnapshotHash: hash('1'),
  maxEthWei: '900719925474099399999',
  votes: [
    { familyId: 'family-a', assetVersionKey: hash('3'), standing: '900719925474099399997', weight: 4 },
    { familyId: 'family-z', assetVersionKey: hash('2'), standing: '900719925474099399998', weight: 5 },
  ],
  decidedByCode: 1,
  resultAssetVersionKey: hash('2'),
};
assert.equal(canonicalTickerBallotTallyHashV2(literalCommitment), LITERAL_TALLY_HASH,
  'canonical tally is the literal Solidity ABI vector and sorts exact standings without Number');
const tallyMutations = [
  { day: '20701' },
  { catalogVersion: '900719925474099312346' },
  { catalogSnapshotHash: hash('4') },
  { maxEthWei: '900719925474099400000' },
  { votes: literalCommitment.votes.map((vote, i) => i ? vote : { ...vote, familyId: 'family-b' }) },
  { votes: literalCommitment.votes.map((vote, i) => i ? vote : { ...vote, assetVersionKey: hash('4') }) },
  { votes: literalCommitment.votes.map((vote, i) => i ? vote : { ...vote, standing: '900719925474099399996' }) },
  { votes: literalCommitment.votes.map((vote, i) => i ? vote : { ...vote, weight: 3 }) },
  { decidedByCode: 2 },
  { resultAssetVersionKey: hash('3') },
];
for (const mutation of tallyMutations) {
  assert.notEqual(canonicalTickerBallotTallyHashV2({ ...literalCommitment, ...mutation }), LITERAL_TALLY_HASH,
    `authority mutation ${Object.keys(mutation)[0]} changes the tally commitment`);
}
assert.throws(() => canonicalTickerBallotTallyHashV2({ ...literalCommitment, chainId: '4664' }),
  /chain/i, 'the commitment cannot silently target another chain');

// Review fix RED matrix. Each case exercises a consumer-visible failure independently so the
// initial run reports every review finding instead of stopping at the first missing correction.
await fixRegression('canonical cutoff keeps a winner deactivated only after close', async () => {
  const pool = await makeDb();
  try {
    const assets = await seedCatalog(pool);
    const families = await seedFamilies(pool, ['500', '400']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '11', detailsHash: DETAILS, actorId: 'mod',
    });
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[0].ch, { assetVersionKey: assets[1].assetVersionKey }, client, families[0].h,
    ));
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[1].ch, { assetVersionKey: assets[0].assetVersionKey }, client, families[1].h,
    ));
    await pool.query('DELETE FROM stock_asset_active_heads_v2 WHERE asset_version_key=$1',
      [assets[1].assetVersionKey]);
    await pool.query(
      `UPDATE stock_asset_versions_v2
          SET active=false,deactivated_at='2026-09-05T00:00:00.001Z'
        WHERE asset_version_key=$1`,
      [assets[1].assetVersionKey],
    );
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-05T00:00:01Z',verified_at='2026-09-05T00:00:01Z',ready_verified_at='2026-09-05T00:00:01Z',caught_up=true WHERE id=1");
    const closed = await closeTickerBallotV2(clockedPool(pool, '2026-09-05T00:00:02.000Z'), DAY);
    assert.equal(closed.assetVersionKey, assets[1].assetVersionKey,
      'post-close deactivation cannot replace the canonical-cutoff winner');
  } finally { await pool.end(); }
});

await fixRegression('pre-close deactivation is frozen as an excluded closed vote', async () => {
  const pool = await makeDb();
  try {
    const assets = await seedCatalog(pool);
    const families = await seedFamilies(pool, ['500', '400']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '12', detailsHash: DETAILS, actorId: 'mod',
    });
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[0].ch, { assetVersionKey: assets[1].assetVersionKey }, client, families[0].h,
    ));
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[1].ch, { assetVersionKey: assets[0].assetVersionKey }, client, families[1].h,
    ));
    await pool.query('DELETE FROM stock_asset_active_heads_v2 WHERE asset_version_key=$1',
      [assets[1].assetVersionKey]);
    await pool.query(
      `UPDATE stock_asset_versions_v2
          SET active=false,deactivated_at='2026-09-04T23:00:00Z'
        WHERE asset_version_key=$1`,
      [assets[1].assetVersionKey],
    );
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    const closed = await closeTickerBallotV2(clockedPool(pool, CLOSE), DAY);
    assert.equal(closed.assetVersionKey, assets[0].assetVersionKey);
    const board = await tickerBallotBoardV2(clockedPool(pool, '2026-09-05T00:00:01Z'));
    const excluded = board.votes.find((vote) => vote.assetVersionKey === assets[1].assetVersionKey);
    assert.deepEqual({ valid: excluded?.valid, counted: excluded?.counted, weight: excluded?.weight,
      exclusionReason: excluded?.exclusionReason }, {
      valid: false, counted: false, weight: 0, exclusionReason: 'candidate_inactive_at_cutoff',
    }, 'pre-close deactivation remains reconstructible on the closed board');
  } finally { await pool.end(); }
});

await fixRegression('same-key churn fails closed without substituting the runner-up', async () => {
  const pool = await makeDb();
  try {
    const assets = await seedCatalog(pool);
    const families = await seedFamilies(pool, ['500', '400']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '13', detailsHash: DETAILS, actorId: 'mod',
    });
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[0].ch, { assetVersionKey: assets[0].assetVersionKey }, client, families[0].h,
    ));
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[1].ch, { assetVersionKey: assets[1].assetVersionKey }, client, families[1].h,
    ));
    await pool.query('DELETE FROM stock_asset_active_heads_v2 WHERE asset_version_key=$1',
      [assets[0].assetVersionKey]);
    await pool.query(
      `UPDATE stock_asset_versions_v2
          SET active=false,activated_at='2026-09-04T13:00:00Z',deactivated_at='2026-09-04T14:00:00Z'
        WHERE asset_version_key=$1`,
      [assets[0].assetVersionKey],
    );
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    const closed = await closeTickerBallotV2(clockedPool(pool, CLOSE), DAY);
    assert.deepEqual({ status: closed.status, assetVersionKey: closed.assetVersionKey,
      skipReason: closed.skipReason }, {
      status: 'skipped_no_valid_candidate', assetVersionKey: null, skipReason: 'no_valid_candidate',
    }, 'unprovable winner history terminates the day instead of reranking to another asset');
  } finally { await pool.end(); }
});

await fixRegression('owned transactions retry 40001 and 40P01 on fresh clients exactly', async () => {
  for (const code of ['40001', '40P01']) {
    const pool = await makeDb();
    try {
      await seedCatalog(pool);
      const faulted = commitFaultPool(clockedPool(pool, WALL), [code]);
      const opened = await openTickerBallotV2(faulted, {
        day: DAY, maxEthWei: code === '40001' ? '21' : '22', detailsHash: DETAILS, actorId: 'mod',
      });
      assert.equal(opened.candidates.length, 2);
      assert.deepEqual(faulted.stats, { connects: 2, releases: 2, rollbacks: 1, commits: 2 },
        `${code} retries the whole owned transaction once on a fresh checked-out client`);
      assert.equal((await pool.query(
        'SELECT count(*)::int AS n FROM ticker_ballot_days_v2 WHERE day=$1', [DAY],
      )).rows[0].n, 1, 'an uncertain exact retry returns one immutable day');
      assert.equal((await pool.query(
        'SELECT count(*)::int AS n FROM ticker_ballot_candidates_v2 WHERE day=$1', [DAY],
      )).rows[0].n, 2, 'an uncertain exact retry never duplicates or truncates candidates');
    } finally { await pool.end(); }
  }
});

await fixRegression('owned transaction retry exhaustion preserves the third SQLSTATE failure', async () => {
  const pool = await makeDb();
  try {
    await seedCatalog(pool);
    const faulted = commitFaultPool(clockedPool(pool, WALL), ['40001', '40001', '40001']);
    let failure;
    try {
      await openTickerBallotV2(faulted, {
        day: DAY, maxEthWei: '23', detailsHash: DETAILS, actorId: 'mod',
      });
    } catch (error) { failure = error; }
    assert.equal(failure?.code, '40001');
    assert.equal(failure?.message, 'injected 40001 on attempt 3');
    assert.deepEqual(faulted.stats, { connects: 3, releases: 3, rollbacks: 3, commits: 3 },
      'maximum three owned attempts each rollback and release');
  } finally { await pool.end(); }
});

await fixRegression('caller-owned checked clients are never transacted, retried, or released', async () => {
  const failure = sqlStateError('40001', 'caller transaction serialization failure');
  let queries = 0;
  let releases = 0;
  const checkedClient = {
    async query(sql) {
      queries++;
      assert.equal(/^(?:BEGIN|COMMIT|ROLLBACK)/.test(sql), false);
      throw failure;
    },
    release() { releases++; },
  };
  await assert.rejects(tallyTickerBallotV2(checkedClient, DAY), (error) => error === failure);
  assert.equal(queries, 1);
  assert.equal(releases, 0);
});

await fixRegression('exact open replay survives midnight', async () => {
  const pool = await makeDb();
  try {
    await seedCatalog(pool);
    const input = { day: DAY, maxEthWei: '31', detailsHash: DETAILS, actorId: 'mod' };
    const opened = await openTickerBallotV2(clockedPool(pool, '2026-09-04T23:59:59.999Z'), input);
    const replay = await openTickerBallotV2(
      clockedPool(pool, '2026-09-05T00:00:00.001Z', null, NEXT_DAY), input,
    );
    assert.deepEqual(replay, opened, 'immutable exact retry is read before a new-day past check');
  } finally { await pool.end(); }
});

await fixRegression('changed midnight replay remains an immutable conflict', async () => {
  const pool = await makeDb();
  try {
    await seedCatalog(pool);
    await openTickerBallotV2(clockedPool(pool, '2026-09-04T23:59:59.999Z'), {
      day: DAY, maxEthWei: '32', detailsHash: DETAILS, actorId: 'mod',
    });
    await expectCode(openTickerBallotV2(
      clockedPool(pool, '2026-09-05T00:00:00.001Z', null, NEXT_DAY), {
        day: DAY, maxEthWei: '33', detailsHash: DETAILS, actorId: 'mod',
      },
    ), 'ballot_conflict');
  } finally { await pool.end(); }
});

await fixRegression('unavailable catalog provenance is categorical and nullable', async () => {
  const pool = await makeDb();
  try {
    const opened = await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '41', detailsHash: DETAILS, actorId: 'mod',
    });
    assert.deepEqual(opened.catalog, {
      available: false,
      source: 'registry_unavailable',
      finality: null,
      chainId: '4663',
      registryAddress: null,
      catalogVersion: null,
      snapshotHash: null,
    }, 'zero storage sentinels are not emitted as finalized registry authority');
    const board = await tickerBallotBoardV2(clockedPool(pool, WALL));
    assert.deepEqual(board.catalog, opened.catalog,
      'the public board preserves the same explicit unavailable provenance');
  } finally { await pool.end(); }
});

await fixRegression('closed vote commitments survive dissolution and reconstruct the tally', async () => {
  const pool = await makeDb();
  try {
    const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
    const [family] = await seedFamilies(pool, ['500']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '51', detailsHash: DETAILS, actorId: 'mod',
    });
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
    ));
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    const closed = await closeTickerBallotV2(clockedPool(pool, CLOSE), DAY);
    await expectCode(withClockedClient(pool, '2026-09-05T00:00:00.001Z', (client) => castTickerVoteV2(
      family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
    )), 'ballot_closed');
    await pool.query('UPDATE gangs SET season_tribute=999999 WHERE id=$1', [family.familyId]);
    const raw = await pool.connect();
    const client = { query: clockedQuery(raw.query.bind(raw), '2026-09-05T00:00:00.001Z') };
    try {
      await client.query('BEGIN');
      await removeMember(client, family.familyId, family.ch.id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { raw.release(); }
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1 AND family_id=$2',
      [DAY, family.familyId],
    )).rows[0].n, 1, 'post-close dissolution cannot delete frozen vote evidence');
    const board = await tickerBallotBoardV2(clockedPool(pool, '2026-09-05T00:00:01Z'));
    assert.deepEqual(board.votes.map((vote) => ({
      familyId: vote.familyId, assetVersionKey: vote.assetVersionKey, standing: vote.standing,
      valid: vote.valid, counted: vote.counted, weight: vote.weight,
      exclusionReason: vote.exclusionReason,
    })), [{
      familyId: family.familyId, assetVersionKey: asset.assetVersionKey, standing: '500',
      valid: true, counted: true, weight: 5, exclusionReason: null,
    }], 'closed board reads the frozen commitment rather than current family/standing state');
    const reconstructed = canonicalTickerBallotTallyHashV2({
      chainId: board.catalog.chainId,
      day: board.day,
      catalogVersion: board.catalog.catalogVersion,
      catalogSnapshotHash: board.catalog.snapshotHash,
      maxEthWei: board.maxEthWei,
      votes: board.votes.filter((vote) => vote.valid && vote.counted).map((vote) => ({
        familyId: vote.familyId,
        assetVersionKey: vote.assetVersionKey,
        standing: vote.standing,
        weight: vote.weight,
      })),
      decidedByCode: closed.decidedByCode,
      resultAssetVersionKey: closed.assetVersionKey,
    });
    assert.equal(reconstructed, closed.tallyHash,
      'public frozen vote tuples reconstruct the stored exact ABI tally hash');
    const rolled = await tickerBallotBoardV2(
      clockedPool(pool, '2026-09-05T00:00:01Z', null, NEXT_DAY),
    );
    assert.deepEqual(rolled.lastResult.voteEvidence, board.votes,
      'after UTC day rollover the last closed result still exposes its reconstructible tuples');
  } finally { await pool.end(); }
});

await fixRegression('real open-cast-close tie defaults deterministically with literal ABI evidence', async () => {
  const pool = await makeDb();
  try {
    const assets = await seedCatalog(pool);
    const families = await seedFamilies(pool, [
      '9007199254747136', '9007199254746112', '9007199254745088', '9007199254744064',
    ]);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod',
    });
    for (const [index, assetIndex] of [[0, 0], [1, 1], [2, 1], [3, 0]]) {
      await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
        families[index].ch, { assetVersionKey: assets[assetIndex].assetVersionKey },
        client, families[index].h,
      ));
    }
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    const closed = await closeTickerBallotV2(clockedPool(pool, CLOSE), DAY);
    assert.deepEqual({ assetVersionKey: closed.assetVersionKey, ticker: closed.ticker,
      decidedBy: closed.decidedBy, decidedByCode: closed.decidedByCode,
      votes: closed.votes, weighted: closed.weighted, tallyHash: closed.tallyHash }, {
      assetVersionKey: assets[0].assetVersionKey,
      ticker: assets[0].ticker,
      decidedBy: 'default_tie',
      decidedByCode: 3,
      votes: 0,
      weighted: 0,
      tallyHash: '0x2c4e81048400f6696dca93c1ee3c48278811fb6ecc9812ddd80d380c84efd81b',
    }, '5+2 versus 4+3 reaches the real equal-weight/equal-count default branch');
    const board = await tickerBallotBoardV2(clockedPool(pool, '2026-09-05T00:00:01Z'));
    assert.deepEqual(board.votes.map((vote) => vote.weight), [5, 4, 3, 2],
      'the tie hash is backed by the production-path frozen vote tuples');
  } finally { await pool.end(); }
});

await fixRegression('catalog freshness carries exact database numeric epoch precision', async () => {
  const pool = await makeDb();
  try {
    await seedCatalog(pool, { assets: [candidate(1)], syncedAt: '2026-09-03T23:50:00.000Z' });
    const exactEpoch = epochSeconds(WALL);
    const firstStaleEpoch = `${exactEpoch}.000001`;
    const exactParams = [];
    const exactClient = {
      query: async (sql, params = []) => {
        const result = await pool.query(sql, params);
        if (sql.includes('ticker_ballot_v2_catalog_state')
            || sql.includes('ticker_ballot_v2_catalog_confirm')) {
          exactParams.push(params[0]);
          result.rows[0].mirror_stale = String(params[0]) !== exactEpoch;
        }
        return result;
      },
    };
    const exactlyFresh = await finalizedStockCatalogForBallotV2(exactClient, {
      canonicalClose: CLOSE,
      observedEpochSeconds: exactEpoch,
    });
    assert.equal(exactlyFresh.available, true, 'exactly 600.000000 seconds remains fresh');
    assert(exactParams.every((value) => value === exactEpoch),
      'freshness SQL receives the exact database numeric epoch, never a Date');

    const staleParams = [];
    const staleClient = {
      query: async (sql, params = []) => {
        const result = await pool.query(sql, params);
        if (sql.includes('ticker_ballot_v2_catalog_state')
            || sql.includes('ticker_ballot_v2_catalog_confirm')) {
          staleParams.push(params[0]);
          result.rows[0].mirror_stale = String(params[0]) === firstStaleEpoch;
        }
        return result;
      },
    };
    const firstStale = await finalizedStockCatalogForBallotV2(staleClient, {
      canonicalClose: CLOSE,
      observedEpochSeconds: firstStaleEpoch,
    });
    assert.equal(firstStale.available, false, 'the first database microsecond after 600 seconds is stale');
    assert(staleParams.every((value) => value === firstStaleEpoch));
  } finally { await pool.end(); }
});

await fixRegression('result DDL enforces status-decision-reason-analytics relationships', async () => {
  const pool = await makeDb();
  try {
    const insert = (day, status, votes, weighted, decidedBy, code, reason, ready) => pool.query(
      `INSERT INTO ticker_ballot_results_v2
        (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
         catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
         decided_by_code,skip_reason,tally_hash,closed_at,purchase_until)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'1',$8,'1',$9,$10,$11,$12,$13,$14,$15,$16)`,
      [day, status, ready ? hash('1') : null, ready ? 'T1' : null,
        ready ? address('1') : null, ready ? 18 : null, ready ? '0' : null,
        hash('c'), votes, weighted, decidedBy, code, reason, hash('f'), CLOSE,
        ready ? PURCHASE_UNTIL : null],
    );
    await assert.rejects(insert(91001, 'closed_ready', 0, 0, 'skipped', 4, null, true));
    await assert.rejects(insert(91002, 'closed_ready', 1, 5, 'default_tie', 3, null, true));
    await assert.rejects(insert(
      91003, 'skipped_no_valid_candidate', 0, 0, 'skipped', 5, 'catalog_empty', false,
    ));
    await assert.rejects(insert(
      91004, 'skipped_no_valid_candidate', 1, 5, 'skipped', 6, 'no_valid_candidate', false,
    ));
  } finally { await pool.end(); }
});

await fixRegression('ballot day caps at the shared PostgreSQL-JavaScript timestamp boundary', async () => {
  assert.doesNotThrow(() => canonicalTickerBallotTallyHashV2({
    ...literalCommitment, day: '99999999',
  }), 'day 99,999,999 closes at JavaScript Date maximum');
  assert.throws(() => canonicalTickerBallotTallyHashV2({
    ...literalCommitment, day: '100000000',
  }), /day.*range/i, 'day 100,000,000 closes beyond JavaScript timestamp range');
  const untouched = {
    async query() { throw new Error('database must not be touched for an out-of-range day'); },
  };
  await expectCode(openTickerBallotV2(untouched, {
    day: '100000000', maxEthWei: '1', detailsHash: DETAILS, actorId: 'mod',
  }), 'bad_ballot_open');
});

// Round-2 review RED matrix. The production change each case kills is named in the assertion:
// stale pre-lock time, unbounded work, broad insert-error swallowing, false migrated evidence,
// incomplete publication tuples, or empty-current-projection misclassification.
await fixRegression('cast samples cutoff authority after the day lock, including exact equality', async () => {
  const pool = await makeDb();
  try {
    const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
    const [family] = await seedFamilies(pool, ['500']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '61', detailsHash: DETAILS, actorId: 'mod',
    });
    let dayLocked = false;
    let clockReads = 0;
    const raw = await pool.connect();
    const client = {
      async query(sql, params = []) {
        if (sql.includes('ticker_ballot_v2_clock')) {
          clockReads++;
          const wall = dayLocked ? CLOSE : '2026-09-04T23:59:59.999Z';
          return { rows: [{
            wall_now: new Date(wall), current_day: DAY, closes_at: new Date(CLOSE),
            epoch_seconds: epochSeconds(wall),
          }] };
        }
        if (sql.includes('FROM ticker_ballot_days_v2') && sql.includes('FOR UPDATE')) dayLocked = true;
        return raw.query(sql, params);
      },
    };
    try {
      await expectCode(castTickerVoteV2(
        family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
      ), 'ballot_closed');
    } finally { raw.release(); }
    assert.equal(dayLocked, true, 'the immutable day is locked before cutoff authority is sampled');
    assert.equal(clockReads, 2, 'the first clock selects a day and a second post-lock clock authorizes mutation');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1', [DAY],
    )).rows[0].n, 0, 'a lock wait crossing exact cutoff creates no vote');
  } finally { await pool.end(); }
});

await fixRegression('dissolution locks family then ballot days before exact cutoff authority', async () => {
  const pool = await makeDb();
  try {
    const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
    const [family] = await seedFamilies(pool, ['500']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '62', detailsHash: DETAILS, actorId: 'mod',
    });
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
    ));
    const order = [];
    let ballotDaysLocked = false;
    const raw = await pool.connect();
    const client = {
      async query(sql, params = []) {
        if (sql.includes('SELECT 1 FROM gangs') && sql.includes('FOR UPDATE')) order.push('family');
        if (sql.includes('ticker_ballot_v2_dissolution_days')) {
          ballotDaysLocked = true;
          order.push('days');
        }
        if (sql.includes('ticker_ballot_v2_dissolution_clock')) {
          order.push('clock');
          const wall = ballotDaysLocked ? CLOSE : '2026-09-04T23:59:59.999Z';
          return { rows: [{ epoch_seconds: epochSeconds(wall) }] };
        }
        return raw.query(sql, params);
      },
    };
    try {
      await client.query('BEGIN');
      await removeMember(client, family.familyId, family.ch.id);
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally { raw.release(); }
    assert.deepEqual(order.slice(0, 3), ['family', 'days', 'clock'],
      'global order is family then ascending ballot-day locks then authoritative DB time');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1', [DAY],
    )).rows[0].n, 1, 'exact cutoff equality preserves the frozen vote');
  } finally { await pool.end(); }
});

await fixRegression('the 100-slot wall admits 99 to 100, updates at capacity, and rejects slot 101', async () => {
  const pool = await makeDb();
  try {
    const assets = await seedCatalog(pool);
    const families = await seedFamilies(pool, ['500', '400']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '63', detailsHash: DETAILS, actorId: 'mod',
    });
    await plantBallotVotes(pool, DAY, assets[0].assetVersionKey, 99);
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[0].ch, { assetVersionKey: assets[0].assetVersionKey }, client, families[0].h,
    ));
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1', [DAY],
    )).rows[0].n, 100, 'the 100th distinct family slot is admitted');
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[0].ch, { assetVersionKey: assets[1].assetVersionKey }, client, families[0].h,
    ));
    await expectCode(withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      families[1].ch, { assetVersionKey: assets[0].assetVersionKey }, client, families[1].h,
    )), 'ballot_overloaded');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1', [DAY],
    )).rows[0].n, 100, 'capacity rejection neither evicts nor overwrites prior evidence');
  } finally { await pool.end(); }
});

async function overloadedBallotFixture() {
  const pool = await makeDb();
  const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
  await openTickerBallotV2(clockedPool(pool, WALL), {
    day: DAY, maxEthWei: '64', detailsHash: DETAILS, actorId: 'mod',
  });
  await plantBallotVotes(pool, DAY, asset.assetVersionKey, 101, { prefix: 'overflow' });
  return { pool, asset };
}

await fixRegression('tally reads at most limit plus one and fails closed on planted row 101', async () => {
  const { pool } = await overloadedBallotFixture();
  try {
    const statements = [];
    await expectCode(tallyTickerBallotV2(clockedPool(pool, WALL, statements), DAY), 'ballot_overloaded');
    assert(statements.some((sql) => sql.includes('commission_ticker_votes_v2') && /LIMIT\s+101/i.test(sql)),
      'the tally authority query carries the literal limit+1 sentinel');
  } finally { await pool.end(); }
});

await fixRegression('close refuses planted row 101 before any tuple freeze or result', async () => {
  const { pool } = await overloadedBallotFixture();
  try {
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    await expectCode(closeTickerBallotV2(clockedPool(pool, CLOSE), DAY), 'ballot_overloaded');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1 AND closed_valid IS NOT NULL',
      [DAY],
    )).rows[0].n, 0, 'overflow closes no partial tuple commitment');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM ticker_ballot_results_v2 WHERE day=$1', [DAY],
    )).rows[0].n, 0, 'overflow writes no partial result');
  } finally { await pool.end(); }
});

await fixRegression('close freezes exactly 100 tuples with a 100-statement ceiling', async () => {
  const pool = await makeDb();
  try {
    const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '640', detailsHash: DETAILS, actorId: 'mod',
    });
    await plantBallotVotes(pool, DAY, asset.assetVersionKey, 100, { prefix: 'ceiling' });
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    const statements = [];
    const result = await closeTickerBallotV2(clockedPool(pool, CLOSE, statements), DAY);
    assert.equal(result.voteEvidenceVersion, 1);
    assert.equal(statements.filter((sql) => /^UPDATE commission_ticker_votes_v2/i.test(
      sql.trim(),
    )).length, 100, 'the per-row compatibility freeze loop cannot exceed the reviewed work cap');
    assert.equal((await pool.query(
      'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE closed_valid IS NOT NULL',
    )).rows[0].n, 100);
  } finally { await pool.end(); }
});

await fixRegression('current board refuses planted row 101 and publishes the fixed work limit', async () => {
  const { pool } = await overloadedBallotFixture();
  try {
    await expectCode(tickerBallotBoardV2(clockedPool(pool, WALL)), 'ballot_overloaded');
    await pool.query('DELETE FROM commission_ticker_votes_v2 WHERE family_id=$1', ['overflow-100']);
    const bounded = await tickerBallotBoardV2(clockedPool(pool, WALL));
    assert.equal(bounded.voteWorkLimit, 100);
    assert.equal(bounded.votes.length, 100, 'bounded public evidence is complete rather than truncated');
  } finally { await pool.end(); }
});

await fixRegression('rolled last-result evidence keeps the same limit plus one fail-closed wall', async () => {
  const pool = await makeDb();
  try {
    await seedCatalog(pool, { assets: [candidate(1)] });
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '641', detailsHash: DETAILS, actorId: 'mod',
    });
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:59Z',verified_at='2026-09-04T23:59:59Z',ready_verified_at='2026-09-04T23:59:59Z',caught_up=true WHERE id=1");
    await closeTickerBallotV2(clockedPool(pool, CLOSE), DAY);
    await plantBallotVotes(pool, DAY, hash('1'), 101, { prefix: 'rolled-overflow' });
    const statements = [];
    await expectCode(
      tickerBallotBoardV2(clockedPool(pool, '2026-09-06T00:00:00Z', statements)),
      'ballot_overloaded',
    );
    assert(statements.some((sql) => sql.includes('commission_ticker_votes_v2')
      && /LIMIT\s+101/i.test(sql)), 'rolled evidence uses the literal limit+1 sentinel');
  } finally { await pool.end(); }
});

await fixRegression('first-cast maps only the expected vote primary-key conflict', async () => {
  const errors = [
    Object.assign(new Error('serialization'), { code: '40001' }),
    Object.assign(new Error('deadlock'), { code: '40P01' }),
    Object.assign(new Error('another unique wall'), { code: '23505', constraint: 'other_unique' }),
    Object.assign(new Error('schema missing'), { code: '42703' }),
    new Error('arbitrary insert failure'),
  ];
  for (const injected of errors) {
    const pool = await makeDb();
    try {
      const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
      const [family] = await seedFamilies(pool, ['500']);
      await openTickerBallotV2(clockedPool(pool, WALL), {
        day: DAY, maxEthWei: '65', detailsHash: DETAILS, actorId: 'mod',
      });
      const raw = await pool.connect();
      const client = {
        query: async (sql, params = []) => {
          if (sql.includes('INSERT INTO commission_ticker_votes_v2')) throw injected;
          return clockedQuery(raw.query.bind(raw), WALL)(sql, params);
        },
      };
      try {
        await assert.rejects(castTickerVoteV2(
          family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
        ), (error) => error === injected, `${injected.code ?? 'arbitrary'} is rethrown by identity`);
      } finally { raw.release(); }
    } finally { await pool.end(); }
  }
  for (const constraint of ['commission_ticker_votes_v2_pkey', undefined]) {
    const pool = await makeDb();
    try {
      const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
      const [family] = await seedFamilies(pool, ['500']);
      await openTickerBallotV2(clockedPool(pool, WALL), {
        day: DAY, maxEthWei: '66', detailsHash: DETAILS, actorId: 'mod',
      });
      const duplicate = Object.assign(new Error('duplicate family slot'), {
        code: '23505', ...(constraint ? { constraint } : {}),
      });
      const raw = await pool.connect();
      const client = {
        query: async (sql, params = []) => {
          if (sql.includes('INSERT INTO commission_ticker_votes_v2')) throw duplicate;
          return clockedQuery(raw.query.bind(raw), WALL)(sql, params);
        },
      };
      try {
        await expectCode(castTickerVoteV2(
          family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
        ), 'again');
      } finally { raw.release(); }
    } finally { await pool.end(); }
  }
  const pool = await makeDb();
  try {
    const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
    const [family] = await seedFamilies(pool, ['500']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '660', detailsHash: DETAILS, actorId: 'mod',
    });
    const unnamed = Object.assign(new Error('unnamed production duplicate'), { code: '23505' });
    const raw = await pool.connect();
    const client = {
      query: async (sql, params = []) => {
        if (sql.includes('INSERT INTO commission_ticker_votes_v2')) throw unnamed;
        return clockedQuery(raw.query.bind(raw), WALL)(sql, params);
      },
    };
    const previous = dbCaps.skipLocked;
    dbCaps.skipLocked = true;
    try {
      await assert.rejects(castTickerVoteV2(
        family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
      ), (error) => error === unnamed,
      'an absent constraint name is accepted only by the pg-mem compatibility seam');
    } finally {
      dbCaps.skipLocked = previous;
      raw.release();
    }
  } finally { await pool.end(); }
});

await fixRegression('fresh result DDL enforces every publication/finality tuple shape', async () => {
  const pool = await makeDb();
  try {
    const tx = hash('a');
    const blockHash = hash('b');
    const insert = (day, publicationStatus, fields = {}, status = 'closed_ready') => {
      const ready = status === 'closed_ready';
      const decided = ready ? ['chamber', 1, null, 1, 5] : ['skipped', 6, 'no_valid_candidate', 0, 0];
      return pool.query(
        `INSERT INTO ticker_ballot_results_v2
          (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
           catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
           decided_by_code,skip_reason,tally_hash,closed_at,purchase_until,publication_status,
           registry_tx_hash,finalized_block_number,finalized_block_hash,finalized_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'1',$8,'1',$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21)`,
        [day, status, ready ? hash('1') : null, ready ? 'T1' : null,
          ready ? address('1') : null, ready ? 18 : null, ready ? '0' : null,
          hash('c'), decided[3], decided[4], decided[0], decided[1], decided[2], hash('f'), CLOSE,
          ready ? PURCHASE_UNTIL : null, publicationStatus, fields.tx ?? null,
          fields.number ?? null, fields.blockHash ?? null, fields.at ?? null],
      );
    };
    let day = 92000;
    for (const [state, fields] of [
      ['not_submitted', {}],
      ['publisher_submitted', { tx }],
      ['published_pending_finality', { tx }],
      ['finalized', { tx, number: '7', blockHash, at: CLOSE }],
      ['reorged', { tx }],
      ['failed', {}],
      ['failed', { tx }],
    ]) await insert(day++, state, fields);
    for (const [state, fields] of [
      ['not_submitted', { tx }],
      ['publisher_submitted', {}],
      ['publisher_submitted', { tx: `0x${'A'.repeat(64)}` }],
      ['publisher_submitted', { tx: `0x${'z'.repeat(64)}` }],
      ['publisher_submitted', { tx: `0x${'a'.repeat(63)}` }],
      ['publisher_submitted', { tx, number: '7' }],
      ['published_pending_finality', { tx, blockHash }],
      ['finalized', { tx, number: '7', blockHash }],
      ['finalized', { tx, number: '7', blockHash: 'not-a-hash', at: CLOSE }],
      ['finalized', { tx, number: '7', blockHash: `0x${'B'.repeat(64)}`, at: CLOSE }],
      ['reorged', {}],
      ['reorged', { tx, at: CLOSE }],
      ['failed', { tx, number: '7' }],
    ]) await assert.rejects(insert(day++, state, fields), undefined,
      `${state} rejects publication fields ${JSON.stringify(fields)}`);
    await assert.rejects(insert(day++, 'not_submitted', { tx }, 'skipped_no_valid_candidate'));
    await assert.rejects(insert(day++, 'failed', {}, 'skipped_no_valid_candidate'));
  } finally { await pool.end(); }
});

await fixRegression('legacy result version zero is public as unavailable evidence, never a null tuple commitment', async () => {
  const pool = await makeDb();
  try {
    await pool.query(
      `INSERT INTO ticker_ballot_days_v2
        (day,state,chain_id,registry_address,catalog_version,catalog_snapshot_hash,max_eth_wei,
         opened_by,open_details_hash,opened_at,closes_at,closed_at,purchase_until)
       VALUES ($1,'closed_ready',4663,$2,'1',$3,'1','legacy',$4,$5,$6,$6,$7)`,
      [DAY, REGISTRY, hash('c'), DETAILS, WALL, CLOSE, PURCHASE_UNTIL],
    );
    await pool.query(
      `INSERT INTO ticker_ballot_candidates_v2
        (day,asset_version_key,ticker,token_address,token_decimals,registry_index,
         activation_evidence_version,activated_at)
       VALUES ($1,$2,'T1',$3,18,'0',0,NULL)`,
      [DAY, hash('1'), address('1')],
    );
    await pool.query(
      `INSERT INTO commission_ticker_votes_v2
        (day,family_id,asset_version_key,ticker,standing) VALUES ($1,'legacy-family',$2,'T1','500')`,
      [DAY, hash('1')],
    );
    await pool.query(
      `INSERT INTO ticker_ballot_results_v2
        (day,status,asset_version_key,ticker,token_address,token_decimals,registry_index,
         catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,decided_by,
         decided_by_code,skip_reason,tally_hash,closed_at,purchase_until,publication_status,
         vote_evidence_version)
       VALUES ($1,'closed_ready',$2,'T1',$3,18,'0','1',$4,'1',1,5,'chamber',1,NULL,$5,$6,$7,
         'not_submitted',0)`,
      [DAY, hash('1'), address('1'), hash('c'), hash('f'), CLOSE, PURCHASE_UNTIL],
    );
    const board = await tickerBallotBoardV2(clockedPool(pool, '2026-09-05T00:00:01Z'));
    assert.equal(board.voteEvidenceAvailable, false);
    assert.equal(board.voteEvidenceStatus, 'legacy_unproven');
    assert.deepEqual(board.votes, [], 'nullable legacy vote fields are not mapped into a fake commitment');
    assert.equal(board.result.voteEvidenceVersion, 0);
    assert.equal(board.result.voteEvidenceAvailable, false);
  } finally { await pool.end(); }
});

await fixRegression('sole cutoff winner survives an empty current active projection after close', async () => {
  const pool = await makeDb();
  try {
    const [asset] = await seedCatalog(pool, { assets: [candidate(1)] });
    const [family] = await seedFamilies(pool, ['500']);
    await openTickerBallotV2(clockedPool(pool, WALL), {
      day: DAY, maxEthWei: '67', detailsHash: DETAILS, actorId: 'mod',
    });
    await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
      family.ch, { assetVersionKey: asset.assetVersionKey }, client, family.h,
    ));
    await pool.query('DELETE FROM stock_asset_active_heads_v2');
    await pool.query(
      `UPDATE stock_asset_versions_v2
          SET active=false,deactivated_at='2026-09-05T00:00:00.001Z'
        WHERE asset_version_key=$1`, [asset.assetVersionKey],
    );
    await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-05T00:00:01Z',verified_at='2026-09-05T00:00:01Z',ready_verified_at='2026-09-05T00:00:01Z',caught_up=true WHERE id=1");
    const closed = await closeTickerBallotV2(
      clockedPool(pool, '2026-09-05T00:00:02Z'), DAY,
    );
    assert.deepEqual({
      status: closed.status,
      assetVersionKey: closed.assetVersionKey,
      catalogAvailable: closed.catalogAvailable,
      voteEvidenceVersion: closed.voteEvidenceVersion,
    }, {
      status: 'closed_ready',
      assetVersionKey: asset.assetVersionKey,
      catalogAvailable: true,
      voteEvidenceVersion: 1,
    }, 'empty current heads stay an available finalized projection and preserve the cutoff winner');
  } finally { await pool.end(); }
});

if (fixRegressionFailures.length) {
  for (const { name, error } of fixRegressionFailures) {
    console.error(`RED ${name}: ${error?.message ?? error}`);
  }
  throw new AggregateError(
    fixRegressionFailures.map(({ error }) => error),
    `${fixRegressionFailures.length} Task 5 review regressions remain`,
  );
}

// The new Task 2 seam must accept a checked-out query-only client, enforce exact active heads,
// preserve huge catalog values as text, and use strict activated-before-close/freshness walls.
{
  const pool = await makeDb();
  const before = candidate(1, { ticker: 'BEFORE', activatedAt: '2026-09-04T23:59:59.999Z' });
  const atClose = candidate(2, { ticker: 'ATCLOSE', activatedAt: CLOSE });
  await seedCatalog(pool, { assets: [before, atClose] });
  const queryOnly = { query: pool.query.bind(pool) };
  const catalog = await finalizedStockCatalogForBallotV2(queryOnly, {
    canonicalClose: CLOSE,
    observedEpochSeconds: epochSeconds(WALL),
  });
  assert.equal(catalog.available, true);
  assert.equal(catalog.catalogVersion, CATALOG_VERSION);
  assert.deepEqual(catalog.activeAssets.map((asset) => asset.assetVersionKey), [before.assetVersionKey],
    'activation strictly before close is eligible; activation exactly at close is excluded');

  await pool.query(
    "DELETE FROM stock_asset_active_heads_v2 WHERE dimension_type='tickerHash' AND dimension_value=$1",
    [before.tickerHash],
  );
  const headMismatch = await finalizedStockCatalogForBallotV2(queryOnly, {
    canonicalClose: CLOSE,
    observedEpochSeconds: epochSeconds(WALL),
  });
  assert.deepEqual(headMismatch.activeAssets, [], 'all three current reverse heads must identify the asset');

  await seedCatalog(pool, { assets: [before], syncedAt: '2026-09-03T23:50:00.000Z' });
  const exactlyFresh = await finalizedStockCatalogForBallotV2(queryOnly, {
    canonicalClose: CLOSE,
    observedEpochSeconds: epochSeconds('2026-09-04T00:00:00.000Z'),
  });
  assert.equal(exactlyFresh.available, true, 'exactly 600 seconds is fresh');
  const firstStale = await finalizedStockCatalogForBallotV2(queryOnly, {
    canonicalClose: CLOSE,
    observedEpochSeconds: epochSeconds('2026-09-04T00:00:00.001Z'),
  });
  assert.equal(firstStale.available, false, 'the first PostgreSQL instant after 600 seconds is stale');

  await seedCatalog(pool, { assets: [before] });
  let advancedDuringRead = false;
  const shiftingCatalog = {
    query: async (sql, params) => {
      if (!advancedDuringRead && sql.includes('ticker_ballot_v2_current_heads')) {
        advancedDuringRead = true;
        await seedCatalog(pool, {
          assets: [candidate(3, { ticker: 'SHIFTED' })],
          catalogVersion: '9007199254742016',
          snapshotHash: hash('e'),
        });
      }
      return pool.query(sql, params);
    },
  };
  const incoherent = await finalizedStockCatalogForBallotV2(shiftingCatalog, {
    canonicalClose: CLOSE,
    observedEpochSeconds: epochSeconds(WALL),
  });
  assert.equal(incoherent.available, false,
    'a catalog commit between evidence and active-head reads fails closed instead of mixing versions');

  process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = OTHER_REGISTRY;
  const wrongRegistry = await finalizedStockCatalogForBallotV2(queryOnly, {
    canonicalClose: CLOSE,
    observedEpochSeconds: epochSeconds(WALL),
  });
  assert.equal(wrongRegistry.available, false, 'configured and mirrored registry identity must agree');
  process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = REGISTRY;
  await pool.end();
}

// First open freezes exact catalog/budget/provenance. Retry never resnapshots after catalog advance;
// changed retry conflicts. DB time alone authorizes current/future days and rejects a past day.
let mainPool;
let mainFamilies;
let first;
{
  mainPool = await makeDb();
  const assets = await seedCatalog(mainPool);
  mainFamilies = await seedFamilies(mainPool);
  const openStatements = [];
  const db = clockedPool(mainPool, WALL, openStatements);
  first = await openTickerBallotV2(db, {
    day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod',
  });
  assert.match(openStatements[0], /^BEGIN ISOLATION LEVEL REPEATABLE READ$/,
    'catalog evidence, candidate snapshot, and day insert share one coherent repeatable-read view');
  assert.deepEqual({
    day: first.day,
    state: first.state,
    closesAt: first.closesAt,
    maxEthWei: first.maxEthWei,
    openedBy: first.openedBy,
    openDetailsHash: first.openDetailsHash,
    catalogVersion: first.catalog.catalogVersion,
    snapshotHash: first.catalog.snapshotHash,
    candidateKeys: first.candidates.map((asset) => asset.assetVersionKey),
  }, {
    day: DAY,
    state: 'open',
    closesAt: CLOSE,
    maxEthWei: MAX_ETH_WEI,
    openedBy: 'mod',
    openDetailsHash: DETAILS,
    catalogVersion: CATALOG_VERSION,
    snapshotHash: hash('c'),
    candidateKeys: assets.map((asset) => asset.assetVersionKey),
  });

  const advanced = candidate(3, { ticker: 'NEW', registryIndex: '2' });
  await seedCatalog(mainPool, {
    assets: [...assets, advanced],
    catalogVersion: '9007199254742016',
    snapshotHash: hash('e'),
  });
  const retry = await openTickerBallotV2(db, {
    day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod',
  });
  assert.deepEqual(retry, first, 'exact retry returns the original immutable snapshot after catalog advance');
  for (const changed of [
    { maxEthWei: '9007199254743040' },
    { detailsHash: hash('e') },
    { actorId: 'another-operator' },
  ]) {
    await expectCode(openTickerBallotV2(db, {
      day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod', ...changed,
    }), 'ballot_conflict');
  }

  const future = await openTickerBallotV2(db, {
    day: NEXT_DAY, maxEthWei: '1', detailsHash: hash('a'), actorId: 'mod',
  });
  assert.equal(future.day, NEXT_DAY, 'a future UTC day may be prepared');
  assert.equal(future.closesAt, '2026-09-06T00:00:00.000Z');
  await expectCode(openTickerBallotV2(db, {
    day: '20699', maxEthWei: '1', detailsHash: hash('a'), actorId: 'mod',
  }), 'past_day');
  for (const bad of [
    { day: 20702 }, { day: '020702' }, { day: '-1' },
    { day: '20702', maxEthWei: 1 }, { day: '20702', maxEthWei: '0' },
    { day: '20702', maxEthWei: '01' }, { day: '20702', maxEthWei: `${1n << 256n}` },
    { day: '20702', detailsHash: ZERO_HASH },
  ]) {
    await expectCode(openTickerBallotV2(db, {
      day: '20702', maxEthWei: '1', detailsHash: hash('a'), actorId: 'mod', ...bad,
    }), 'bad_ballot_open');
  }
}

// Current role/seat and immutable candidate selection are checked in the same client transaction.
// Storage is always the exact key; ticker is compatibility-only and both fields must agree.
{
  const [head, second] = mainFamilies;
  const firstCandidate = first.candidates[0];
  const secondCandidate = first.candidates[1];
  const cast = await withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    head.ch, { assetVersionKey: firstCandidate.assetVersionKey }, client, head.h,
  ));
  assert.deepEqual({
    day: cast.day,
    assetVersionKey: cast.assetVersionKey,
    ticker: cast.ticker,
    standing: cast.standing,
    weight: cast.weight,
    buysOnDay: cast.buysOnDay,
  }, {
    day: DAY,
    assetVersionKey: firstCandidate.assetVersionKey,
    ticker: firstCandidate.ticker,
    standing: head.standing,
    weight: 5,
    buysOnDay: NEXT_DAY,
  });
  let stored = (await mainPool.query(
    'SELECT asset_version_key,ticker,standing FROM commission_ticker_votes_v2 WHERE day=$1 AND family_id=$2',
    [DAY, head.familyId],
  )).rows[0];
  assert.equal(stored.asset_version_key, firstCandidate.assetVersionKey);
  assert.equal(String(stored.standing), head.standing);

  const recast = await withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    head.ch, { ticker: secondCandidate.ticker.toLowerCase() }, client, head.h,
  ));
  assert.equal(recast.assetVersionKey, secondCandidate.assetVersionKey);
  assert.equal((await mainPool.query(
    'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE day=$1 AND family_id=$2',
    [DAY, head.familyId],
  )).rows[0].n, 1, 'a family owns one mutable daily slot');

  await withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    second.ch,
    { ticker: firstCandidate.ticker, assetVersionKey: firstCandidate.assetVersionKey },
    client,
    second.h,
  ));
  await expectCode(withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    second.ch,
    { ticker: firstCandidate.ticker, assetVersionKey: secondCandidate.assetVersionKey },
    client,
    second.h,
  )), 'candidate_mismatch');
  await expectCode(withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    second.ch, { assetVersionKey: hash('f') }, client, second.h,
  )), 'bad_candidate');

  const soldier = { ...second.h, owned: { ...second.h.owned, gangRole: 'soldier' } };
  await expectCode(withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    second.ch, { assetVersionKey: firstCandidate.assetVersionKey }, client, soldier,
  )), 'rank');
  await mainPool.query('UPDATE gangs SET season_tribute=0,season_wars=0 WHERE id=$1', [second.familyId]);
  await expectCode(withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    second.ch, { assetVersionKey: firstCandidate.assetVersionKey }, client, second.h,
  )), 'no_seat');
  await mainPool.query('UPDATE gangs SET season_tribute=$2 WHERE id=$1', [second.familyId, second.standing]);

  // Frozen ticker aliases may be ambiguous only through old/additive data; compatibility input then
  // fails closed while an exact key remains unambiguous.
  await mainPool.query(
    `INSERT INTO ticker_ballot_candidates_v2
      (day,asset_version_key,ticker,token_address,token_decimals,registry_index,activated_at)
     VALUES ($1,$2,$3,$4,18,'99',$5)`,
    [DAY, hash('9'), firstCandidate.ticker, address('9'), firstCandidate.activatedAt],
  );
  await expectCode(withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    head.ch, { ticker: firstCandidate.ticker }, client, head.h,
  )), 'ambiguous_ticker');
  stored = (await mainPool.query(
    'SELECT asset_version_key FROM commission_ticker_votes_v2 WHERE day=$1 AND family_id=$2',
    [DAY, head.familyId],
  )).rows[0];
  assert.equal(stored.asset_version_key, secondCandidate.assetVersionKey,
    'failed compatibility resolution does not mutate the existing exact-key vote');
  await mainPool.query(
    'DELETE FROM ticker_ballot_candidates_v2 WHERE day=$1 AND asset_version_key=$2',
    [DAY, hash('9')],
  );
}

// Huge standings rank exactly, family-ID bytes break ties, only five votes receive 5..1, and a
// deactivated candidate stays visible but contributes nothing until an allowed pre-close reactivation.
{
  const firstCandidate = first.candidates[0];
  await mainPool.query('DELETE FROM commission_ticker_votes_v2 WHERE day=$1', [DAY]);
  const equalStanding = '9007199254751232';
  await mainPool.query('UPDATE gangs SET season_tribute=$2 WHERE id IN ($1,$3)',
    [mainFamilies[0].familyId, equalStanding, mainFamilies[1].familyId]);
  for (let i = 0; i < 5; i++) {
    const actor = mainFamilies[i];
    await withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
      actor.ch, { assetVersionKey: firstCandidate.assetVersionKey }, client, actor.h,
    ));
  }
  // Seat membership is checked at cast. Rotate the sixth family into a live seat, capture its
  // exact then-current standing, and restore the table; tally must still deterministically keep
  // only the five highest snapshotted voting families.
  await mainPool.query('UPDATE gangs SET season_tribute=0 WHERE id=$1', [mainFamilies[4].familyId]);
  await withClockedClient(mainPool, WALL, (client) => castTickerVoteV2(
    mainFamilies[5].ch, { assetVersionKey: firstCandidate.assetVersionKey }, client, mainFamilies[5].h,
  ));
  await mainPool.query('UPDATE gangs SET season_tribute=$2 WHERE id=$1',
    [mainFamilies[4].familyId, mainFamilies[4].standing]);
  let tally = await tallyTickerBallotV2(clockedPool(mainPool, WALL), DAY);
  assert.deepEqual(tally.votes.filter((vote) => vote.counted).map((vote) => ({
    familyId: vote.familyId, standing: vote.standing, weight: vote.weight,
  })), [
    { familyId: 'family-a', standing: equalStanding, weight: 5 },
    { familyId: 'family-b', standing: equalStanding, weight: 4 },
    { familyId: 'family-c', standing: mainFamilies[2].standing, weight: 3 },
    { familyId: 'family-d', standing: mainFamilies[3].standing, weight: 2 },
    { familyId: 'family-e', standing: mainFamilies[4].standing, weight: 1 },
  ], 'standing uses exact BigInt order, then family-ID bytes, with fixed top-five weights');
  assert.equal(tally.votes.find((vote) => vote.familyId === 'family-f').counted, false);
  assert.equal(tally.votes.find((vote) => vote.familyId === 'family-f').exclusionReason, 'outside_top_five');

  await mainPool.query('DELETE FROM stock_asset_active_heads_v2 WHERE asset_version_key=$1',
    [firstCandidate.assetVersionKey]);
  await mainPool.query(
    'UPDATE stock_asset_versions_v2 SET active=false,deactivated_at=$2 WHERE asset_version_key=$1',
    [firstCandidate.assetVersionKey, '2026-09-04T12:00:00Z'],
  );
  await mainPool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T11:59:00Z',verified_at='2026-09-04T11:59:00Z',ready_verified_at='2026-09-04T11:59:00Z',caught_up=true WHERE id=1");
  tally = await tallyTickerBallotV2(clockedPool(mainPool, '2026-09-04T12:00:01.000Z'), DAY);
  assert(tally.votes.every((vote) => vote.valid === false && vote.exclusionReason === 'candidate_inactive'));
  assert.equal(tally.resultAssetVersionKey, first.candidates[1].assetVersionKey,
    'silence after invalidation defaults only to the first still-valid frozen candidate');
  const board = await tickerBallotBoardV2(clockedPool(mainPool, '2026-09-04T12:00:01.000Z'));
  assert(board.votes.every((vote) => vote.valid === false), 'board preserves invalidated votes publicly');
  assert.equal(board.leading, first.candidates[1].ticker);

  await mainPool.query(
    `UPDATE stock_asset_versions_v2
        SET active=true,activated_at='2026-09-04T13:00:00Z',deactivated_at=NULL
      WHERE asset_version_key=$1`,
    [firstCandidate.assetVersionKey],
  );
  for (const [dimension, value] of [
    ['tickerHash', candidate(1).tickerHash],
    ['tokenAddress', firstCandidate.tokenAddress],
    ['robinhoodAssetIdHash', candidate(1).robinhoodAssetIdHash],
  ]) await mainPool.query(
    `INSERT INTO stock_asset_active_heads_v2
      (dimension_type,dimension_value,asset_version_key) VALUES ($1,$2,$3)`,
    [dimension, value, firstCandidate.assetVersionKey],
  );
  await mainPool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T12:59:00Z',verified_at='2026-09-04T12:59:00Z',ready_verified_at='2026-09-04T12:59:00Z',caught_up=true WHERE id=1");
  tally = await tallyTickerBallotV2(clockedPool(mainPool, '2026-09-04T13:00:01.000Z'), DAY);
  assert(tally.votes.some((vote) => vote.valid), 'same-key reactivation strictly before close may restore voteability');

  await mainPool.query('UPDATE stock_asset_versions_v2 SET activated_at=$2 WHERE asset_version_key=$1',
    [firstCandidate.assetVersionKey, CLOSE]);
  await mainPool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:00Z',verified_at='2026-09-04T23:59:00Z',ready_verified_at='2026-09-04T23:59:00Z',caught_up=true WHERE id=1");
  tally = await tallyTickerBallotV2(clockedPool(mainPool, '2026-09-05T00:00:01.000Z'), DAY);
  assert(tally.votes.every((vote) => vote.valid === false), 'activation exactly at close is never eligible');
}

// Weighted winner, deterministic tie/silence default, exact canonical close, delayed close, frozen
// purchase deadline, and one immutable concurrent result.
{
  const pool = await makeDb();
  const assets = await seedCatalog(pool);
  const families = await seedFamilies(pool);
  const opened = await openTickerBallotV2(clockedPool(pool, WALL), {
    day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod',
  });
  await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
    families[0].ch, { assetVersionKey: assets[1].assetVersionKey }, client, families[0].h,
  ));
  await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
    families[1].ch, { assetVersionKey: assets[0].assetVersionKey }, client, families[1].h,
  ));
  await expectCode(closeTickerBallotV2(clockedPool(pool, '2026-09-04T23:59:59.999Z'), DAY), 'ballot_open');
  await pool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-05T09:16:00Z',verified_at='2026-09-05T09:16:00Z',ready_verified_at='2026-09-05T09:16:00Z',caught_up=true WHERE id=1");
  const closeStatements = [];
  const delayed = clockedPool(pool, '2026-09-05T09:17:00.000Z', closeStatements);
  const [closedA, closedB] = await Promise.all([
    closeTickerBallotV2(delayed, DAY),
    closeTickerBallotV2(delayed, DAY),
  ]);
  assert.equal(closeStatements.filter((sql) => /^BEGIN/.test(sql)).every(
    (sql) => sql === 'BEGIN ISOLATION LEVEL REPEATABLE READ'
  ), true, 'close freezes one coherent catalog/vote/result view under the day lock');
  assert.deepEqual(closedA, closedB, 'concurrent close returns one immutable result');
  assert.deepEqual({
    status: closedA.status,
    assetVersionKey: closedA.assetVersionKey,
    ticker: closedA.ticker,
    tokenAddress: closedA.tokenAddress,
    tokenDecimals: closedA.tokenDecimals,
    catalogVersion: closedA.catalogVersion,
    catalogSnapshotHash: closedA.catalogSnapshotHash,
    maxEthWei: closedA.maxEthWei,
    decidedBy: closedA.decidedBy,
    closedAt: closedA.closedAt,
    purchaseUntil: closedA.purchaseUntil,
    publicationStatus: closedA.publicationStatus,
  }, {
    status: 'closed_ready',
    assetVersionKey: assets[1].assetVersionKey,
    ticker: assets[1].ticker,
    tokenAddress: assets[1].tokenAddress,
    tokenDecimals: assets[1].tokenDecimals,
    catalogVersion: CATALOG_VERSION,
    catalogSnapshotHash: hash('c'),
    maxEthWei: MAX_ETH_WEI,
    decidedBy: 'chamber',
    closedAt: CLOSE,
    purchaseUntil: PURCHASE_UNTIL,
    publicationStatus: 'not_submitted',
  });
  assert.equal((await pool.query('SELECT count(*)::int AS n FROM ticker_ballot_results_v2 WHERE day=$1', [DAY])).rows[0].n, 1);
  assert.deepEqual(await closeTickerBallotV2(delayed, DAY), closedA, 'closed result cannot be regenerated');
  assert.equal(opened.closesAt, closedA.closedAt, 'worker delay never extends the canonical cutoff');
  await pool.end();
}

// Catalog unavailable, empty catalog, and no still-valid candidate are durable terminal skip rows
// with frozen budget provenance, zero selection, no purchase wall, and no revival.
{
  const unavailablePool = await makeDb();
  const unavailable = await openTickerBallotV2(clockedPool(unavailablePool, WALL), {
    day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod',
  });
  assert.deepEqual({
    state: unavailable.state,
    status: unavailable.result.status,
    catalogAvailable: unavailable.result.catalogAvailable,
    catalogVersion: unavailable.result.catalogVersion,
    catalogSnapshotHash: unavailable.result.catalogSnapshotHash,
    maxEthWei: unavailable.result.maxEthWei,
    assetVersionKey: unavailable.result.assetVersionKey,
    purchaseUntil: unavailable.result.purchaseUntil,
    publicationStatus: unavailable.result.publicationStatus,
  }, {
    state: 'skipped_catalog_unavailable',
    status: 'skipped_catalog_unavailable',
    catalogAvailable: false,
    catalogVersion: null,
    catalogSnapshotHash: null,
    maxEthWei: MAX_ETH_WEI,
    assetVersionKey: null,
    purchaseUntil: null,
    publicationStatus: 'not_submitted',
  });
  await seedCatalog(unavailablePool);
  assert.deepEqual(await openTickerBallotV2(clockedPool(unavailablePool, WALL), {
    day: DAY, maxEthWei: MAX_ETH_WEI, detailsHash: DETAILS, actorId: 'mod',
  }), unavailable, 'a terminal unavailable skip never revives after catalog recovery');
  await unavailablePool.end();

  const emptyPool = await makeDb();
  await seedCatalog(emptyPool, { assets: [] });
  const empty = await openTickerBallotV2(clockedPool(emptyPool, WALL), {
    day: DAY, maxEthWei: '7', detailsHash: DETAILS, actorId: 'mod',
  });
  assert.equal(empty.result.status, 'skipped_catalog_empty');
  assert.equal(empty.result.catalogVersion, CATALOG_VERSION);
  assert.equal(empty.result.catalogSnapshotHash, hash('c'));
  assert.equal(empty.result.purchaseUntil, null);
  await emptyPool.end();

  const invalidPool = await makeDb();
  const [asset] = await seedCatalog(invalidPool, { assets: [candidate(1)] });
  await seedFamilies(invalidPool);
  await openTickerBallotV2(clockedPool(invalidPool, WALL), {
    day: DAY, maxEthWei: '9', detailsHash: DETAILS, actorId: 'mod',
  });
  await invalidPool.query('DELETE FROM stock_asset_active_heads_v2');
  // deactivated BEFORE the ballot's close instant on purpose: the eligibility rule is
  // `deactivated_at >= closes_at => still eligible` (it was live when the ballot shut), so
  // now() here makes the assertion below a function of the WALL CLOCK -- it passed while
  // real-now sat before 2026-09-05 and flipped to 'closed_ready' the day it did not.
  await invalidPool.query("UPDATE stock_asset_versions_v2 SET active=false,deactivated_at='2026-09-04T23:59:00Z' WHERE asset_version_key=$1",
    [asset.assetVersionKey]);
  await invalidPool.query("UPDATE stock_catalog_sync_state_v2 SET synced_at='2026-09-04T23:59:00Z',verified_at='2026-09-04T23:59:00Z',ready_verified_at='2026-09-04T23:59:00Z',caught_up=true WHERE id=1");
  const skipped = await closeTickerBallotV2(clockedPool(invalidPool, '2026-09-05T00:00:00.000Z'), DAY);
  assert.equal(skipped.status, 'skipped_no_valid_candidate');
  assert.equal(skipped.assetVersionKey, null);
  assert.equal(skipped.purchaseUntil, null);
  assert.equal(skipped.publicationStatus, 'not_submitted');
  assert.equal((await closeTickerBallotV2(
    clockedPool(invalidPool, '2026-09-06T00:00:00.000Z'), DAY
  )).status, 'skipped_no_valid_candidate', 'terminal no-candidate close cannot revive');
  await invalidPool.end();
}

// Dissolution deletes only the current V2 vote beside the legacy vote; immutable results survive.
{
  const pool = await makeDb();
  await seedCatalog(pool);
  const [family] = await seedFamilies(pool, ['500']);
  await openTickerBallotV2(clockedPool(pool, WALL), {
    day: DAY, maxEthWei: '1', detailsHash: DETAILS, actorId: 'mod',
  });
  await withClockedClient(pool, WALL, (client) => castTickerVoteV2(
    family.ch, { assetVersionKey: candidate(1).assetVersionKey }, client, family.h,
  ));
  await pool.query(
    "INSERT INTO commission_ticker_votes (day,gang_id,ticker,standing) VALUES ($1,$2,'T1',500)",
    [DAY, family.familyId],
  );
  await pool.query(
    `INSERT INTO ticker_ballot_results_v2
      (day,status,catalog_version,catalog_snapshot_hash,max_eth_wei,votes,weighted,
       decided_by,decided_by_code,skip_reason,tally_hash,closed_at,publication_status)
     VALUES ($1,'skipped_no_valid_candidate',$2,$3,'1',0,0,'skipped',6,
       'no_valid_candidate',$4,$5,'not_submitted')`,
    [NEXT_DAY, CATALOG_VERSION, hash('c'), hash('f'), '2026-09-06T00:00:00Z'],
  );
  // Clocked at WALL on purpose. removeMember deletes a ticker vote only while its ballot day is
  // still open (`closes_at > now()`) -- a closed day's vote is deliberately FROZEN -- so a raw
  // client reading real now() makes this assertion a function of the WALL CLOCK: it deleted while
  // real-now sat before this ballot's 2026-09-05 close and preserved the vote the day it did not.
  const client = await clockedPool(pool, WALL).connect();
  try {
    await client.query('BEGIN');
    await removeMember(client, family.familyId, family.ch.id);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM commission_ticker_votes_v2 WHERE family_id=$1', [family.familyId],
  )).rows[0].n, 0);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM commission_ticker_votes WHERE gang_id=$1', [family.familyId],
  )).rows[0].n, 0);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM ticker_ballot_results_v2 WHERE day=$1', [NEXT_DAY],
  )).rows[0].n, 1, 'family dissolution cannot erase immutable closed history');
  await pool.end();
}

// The only HTTP seam is the dormant mod-authenticated preparation action. Actor identity is
// server-derived, body authority is exact, and no player/public ticker route is switched here.
{
  const app = await buildServer();
  try {
    await seedCatalog(app.pool, {
      syncedAt: new Date(),
      assets: [candidate(1, { activatedAt: '2020-01-01T00:00:00Z' })],
    });
    const currentDay = String(Math.floor(Date.now() / 86_400_000));
    const unauthenticated = await app.inject({
      method: 'POST', url: `/v1/rwa/ballots/${currentDay}/open`,
      payload: { maxEthWei: '1', detailsHash: DETAILS },
    });
    assert.equal(unauthenticated.statusCode, 401);
    const forgedActor = await app.inject({
      method: 'POST', url: `/v1/rwa/ballots/${currentDay}/open`,
      headers: { 'x-mod-key': process.env.MOD_KEY },
      payload: { maxEthWei: '1', detailsHash: DETAILS, actorId: 'forged' },
    });
    assert.equal(forgedActor.statusCode, 400);
    assert.equal(forgedActor.json().error, 'bad_body');
    const opened = await app.inject({
      method: 'POST', url: `/v1/rwa/ballots/${currentDay}/open`,
      headers: { 'x-mod-key': process.env.MOD_KEY },
      payload: { maxEthWei: '1', detailsHash: DETAILS },
    });
    assert.equal(opened.statusCode, 200, opened.body);
    assert.equal(opened.json().openedBy, 'mod');
    assert.equal(opened.json().maxEthWei, '1');
  } finally { await app.close(); }
}

// The legacy player/public route remains the production default through Task 5.
{
  const app = await buildServer();
  try {
    const board = await app.inject({ method: 'GET', url: '/v1/commission/ticker' });
    assert.equal(board.statusCode, 200);
    assert.equal(Object.hasOwn(board.json(), 'tickers'), true);
    assert.equal(Object.hasOwn(board.json(), 'state'), false,
      'Task 5 does not cut the current public route to V2 before health/custody authority exists');
  } finally { await app.close(); }
}

await mainPool.end();
for (const [key, value] of Object.entries(originalEnv)) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

console.log('✅ stock ballot v2: DB-time immutable snapshot, exact version votes/standing, ABI tally, durable close/skip preparation');
