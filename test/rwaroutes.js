import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress, keccak256 } from 'viem';
import { newDb } from 'pg-mem';
import { buildServer } from '../src/server.js';
import { buildStockTokenActivationV2, computeStockAssetVersionKey } from '../src/stockcatalogv2.js';
import {
  disposeRwaNominationReviewWithSafePackage, expireRwaApprovals, rwaNominationReviewQueue,
} from '../src/rwanominations.js';

const SCHEMA = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql'), 'utf8');

// Checked-in independent fixture: expected package, calldata, and raw-calldata hash are literals.
// No production builder participates in constructing the expected side of this assertion.
const LITERAL_ACTIVATION_DATA = '0xf87ca0a10000000000000000000000000000000000000000000000000000000000000020'
  + '0000000000000000000000001111111111111111111111111111111111111111'
  + '3333333333333333333333333333333333333333333333333333333333333333'
  + '0000000000000000000000000000000000000000000000000000000000000120'
  + '0000000000000000000000000000000000000000000000000000000000000160'
  + '0000000000000000000000000000000000000000000000000000000000000012'
  + '2222222222222222222222222222222222222222222222222222222222222222'
  + '4444444444444444444444444444444444444444444444444444444444444444'
  + '0000000000000000000000000000000000000000000000000000000077359400'
  + '00000000000000000000000000000000000000000000000000000000773ece80'
  + '0000000000000000000000000000000000000000000000000000000000000003'
  + '5254450000000000000000000000000000000000000000000000000000000000'
  + '000000000000000000000000000000000000000000000000000000000000000c'
  + '526f757465204571756974790000000000000000000000000000000000000000';
const LITERAL_ACTIVATION_PACKAGE = {
  to: '0x9999999999999999999999999999999999999999', value: '0', operation: 0,
  data: LITERAL_ACTIVATION_DATA,
  assetVersionKey: '0x2776f4b4ae019e0b245c2d15891a3e2a193d5e4a8e40e4143f0b7e0e21edaa19',
  chainId: '4663', ticker: 'RTE', name: 'Route Equity',
  tokenAddress: '0x1111111111111111111111111111111111111111', tokenDecimals: 18,
  robinhoodAssetIdHash: `0x${'3'.repeat(64)}`, evidenceHash: `0x${'2'.repeat(64)}`,
  reviewId: `0x${'4'.repeat(64)}`, approvedAt: '2000000000', validUntil: '2000604800',
};
assert.deepEqual(buildStockTokenActivationV2({
  asset: {
    chainId: '4663', ticker: 'RTE', name: 'Route Equity',
    tokenAddress: '0x1111111111111111111111111111111111111111', tokenDecimals: 18,
    robinhoodAssetIdHash: `0x${'3'.repeat(64)}`,
  },
  registryAddress: '0x9999999999999999999999999999999999999999',
  evidenceHash: `0x${'2'.repeat(64)}`, reviewId: `0x${'4'.repeat(64)}`, approvedAt: '2000000000',
}), LITERAL_ACTIVATION_PACKAGE);
assert.equal(keccak256(LITERAL_ACTIVATION_DATA),
  '0x761ec9b204b5d4d5d9e1a65acb242785f5137bf2fe53c0e04742ec6ba986724c');

const prior = {
  key: process.env.RWA_REVIEWER_KEY,
  id: process.env.RWA_REVIEWER_ID,
  rate: process.env.RATE_LIMIT,
};
delete process.env.RWA_REVIEWER_KEY;
delete process.env.RWA_REVIEWER_ID;
process.env.RATE_LIMIT = 'off';

const app = await buildServer();
try {
  const expected = [
    ['GET', '/v1/rwa/nominations'],
    ['POST', '/v1/rwa/nominations'],
    ['POST', '/v1/rwa/nominations/:id/endorsement'],
    ['POST', '/v1/rwa/nominations/:id/sponsor-renewal'],
    ['POST', '/v1/rwa/reviewer/nominations/:id/claim'],
    ['POST', '/v1/rwa/reviewer/nominations/:id/disposition'],
    ['POST', '/v1/rwa/reviewer/nominations/:id/submission'],
    ['GET', '/v1/rwa/reviewer/queue'],
  ];
  for (const [method, url] of expected) {
    assert(app.routes.some((route) => route.method === method && route.url === url),
      `${method} ${url} must be mounted`);
  }

  const board = await app.inject({ method: 'GET', url: '/v1/rwa/nominations?limit=2' });
  assert.equal(board.statusCode, 200, board.body);
  assert.deepEqual(board.json(), { items: [], hasMore: false, nextCursor: null });
  const unauthenticatedCreate = await app.inject({ method: 'POST', url: '/v1/rwa/nominations', payload: {} });
  assert.equal(unauthenticatedCreate.statusCode, 401, 'player writes remain JWT authenticated');

  const reviewer = await app.inject({
    method: 'GET', url: '/v1/rwa/reviewer/queue', headers: { 'x-rwa-reviewer-key': 'anything' },
  });
  assert.equal(reviewer.statusCode, 503, reviewer.body);
  assert.deepEqual(reviewer.json(), { error: 'rwa_reviewer_disabled' });
} finally {
  await app.close();
  if (prior.key === undefined) delete process.env.RWA_REVIEWER_KEY;
  else process.env.RWA_REVIEWER_KEY = prior.key;
  if (prior.id === undefined) delete process.env.RWA_REVIEWER_ID;
  else process.env.RWA_REVIEWER_ID = prior.id;
  if (prior.rate === undefined) delete process.env.RATE_LIMIT;
  else process.env.RATE_LIMIT = prior.rate;
}

console.log('✅ RWA HTTP routes passed');

{
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  await pool.query(
    "INSERT INTO gangs (id,name,tag,season_tribute) VALUES ('bigint-family','BigInt Family','BIG',1000)",
  );
  const bigintToken = getAddress(`0x${'3'.repeat(40)}`);
  const bigintProvider = `0x${'3'.repeat(64)}`;
  const bigintEvidence = `0x${'2'.repeat(64)}`;
  await pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,claimed_by,claimed_at)
     VALUES ('bigint-name',$1,4663,'BIG',$2,$3,18,$4,'BigInt Holdings','bigint-family',
       'bigint-account','A string is not a bigint value.',$5,'under_review','not_applicable',
       '2030-01-01T00:00:00Z','2030-02-01T00:00:00Z','bigint-reviewer','2030-01-01T00:00:00Z')`,
    [computeStockAssetVersionKey({
      chainId: '4663', ticker: 'BIG', tokenAddress: bigintToken,
      robinhoodAssetIdHash: bigintProvider,
    }), keccak256(Buffer.from('BIG')), bigintToken, bigintProvider, bigintEvidence],
  );
  const result = await disposeRwaNominationReviewWithSafePackage({
    query: (sql, params) => sql.includes('rwa_wall_clock')
      ? Promise.resolve({ rows: [{ wall_now: new Date('2030-01-02T00:00:00.900Z') }] })
      : pool.query(sql, params),
  }, 'bigint-name', 'bigint-reviewer', {
    disposition: 'approved', reason: 'Literal text is valid.', evidenceHash: bigintEvidence,
  }, { registryAddress: getAddress(`0x${'4'.repeat(40)}`) });
  assert.equal(result.nomination.reviewStatus ?? result.nomination.status, 'approved');
  assert.equal(result.proposal.safeTransaction.data.startsWith('0x'), true,
    'a literal BigInt substring is valid when the package contains no bigint-typed value');
  const typedBigintKey = computeStockAssetVersionKey({
    chainId: '4663', ticker: 'BGV', tokenAddress: bigintToken,
    robinhoodAssetIdHash: bigintProvider,
  });
  await pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,claimed_by,claimed_at)
     VALUES ('typed-bigint',$1,4663,'BGV',$2,$3,18,$4,'Typed Value','bigint-family',
       'bigint-account','A typed bigint cannot cross JSON.',$5,'under_review','not_applicable',
       '2020-01-01T00:00:00Z','2030-02-01T00:00:00Z','bigint-reviewer','2020-01-01T00:00:00Z')`,
    [typedBigintKey, keccak256(Buffer.from('BGV')), bigintToken, bigintProvider, bigintEvidence],
  );
  await assert.rejects(disposeRwaNominationReviewWithSafePackage(
    pool, 'typed-bigint', 'bigint-reviewer', {
      disposition: 'approved', reason: 'Typed bigints must fail.', evidenceHash: bigintEvidence,
    }, {
      registryAddress: getAddress(`0x${'4'.repeat(40)}`),
      buildActivation: () => ({
        assetVersionKey: typedBigintKey, data: '0x00', nested: { forbidden: 1n },
      }),
    },
  ), (error) => error?.code === 'safe_package_failed');
  await pool.end();
}

console.log('✅ RWA Safe package validation rejects types, not valid BigInt text');

{
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  await pool.query(
    "INSERT INTO gangs (id,name,tag,season_tribute) VALUES ('deadline-family','Deadline Family','DLN',1000)",
  );
  const deadlineToken = getAddress(`0x${'5'.repeat(40)}`);
  const deadlineProvider = `0x${'5'.repeat(64)}`;
  const deadlineEvidence = `0x${'4'.repeat(64)}`;
  await pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,claimed_by,claimed_at)
     VALUES ('deadline-subsecond',$1,4663,'DLN',$2,$3,18,$4,'Deadline Equity','deadline-family',
       'deadline-account','Exact deadline evidence.',$5,'under_review','not_applicable',
       '2030-01-01T00:00:00Z','2030-01-02T00:00:00.100Z','deadline-reviewer','2030-01-01T00:00:00Z')`,
    [computeStockAssetVersionKey({
      chainId: '4663', ticker: 'DLN', tokenAddress: deadlineToken,
      robinhoodAssetIdHash: deadlineProvider,
    }), keccak256(Buffer.from('DLN')), deadlineToken, deadlineProvider, deadlineEvidence],
  );
  const result = await disposeRwaNominationReviewWithSafePackage({
    query: (sql, params) => sql.includes('rwa_wall_clock')
      ? Promise.resolve({ rows: [{ wall_now: new Date('2030-01-02T00:00:00.900Z') }] })
      : pool.query(sql, params),
  }, 'deadline-subsecond', 'deadline-reviewer', {
    disposition: 'approved', reason: 'The exact wall time decides.', evidenceHash: deadlineEvidence,
  }, { registryAddress: getAddress(`0x${'6'.repeat(40)}`) });
  assert.equal(result.expired, true,
    'a .900 post-lock wall time expires a nomination whose exact deadline was .100');
  assert.equal(result.proposal, null);
  assert.equal((await pool.query(
    "SELECT status FROM rwa_nominations_v2 WHERE id='deadline-subsecond'",
  )).rows[0].status, 'expired');
  await pool.end();
}

console.log('✅ RWA disposition compares exact DB wall time before whole-second packaging');

{
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  for (let i = 1; i <= 4; i++) {
    await pool.query(
      'INSERT INTO gangs (id,name,tag,season_tribute) VALUES ($1,$2,$3,$4)',
      [`queue-family-${i}`, `Queue Family ${i}`, `QF${i}`, 5000 - i],
    );
  }
  const queueToken = getAddress(`0x${'7'.repeat(40)}`);
  const queueProvider = `0x${'7'.repeat(64)}`;
  const queueEvidence = `0x${'6'.repeat(64)}`;
  const insertQueueNomination = async ({ id, ticker, name, status, createdAt, claimedBy = null }) => {
    await pool.query(
      `INSERT INTO rwa_nominations_v2
        (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
         robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
         status,execution_status,created_at,pending_until,claimed_by,claimed_at)
       VALUES ($1,$2,4663,$3,$4,$5,18,$6,$7,'queue-family-1','queue-account-1',
         'Dense queue ordering evidence.',$8,$9,'not_applicable',$10,'2030-02-01T00:00:00Z',$11,$12)`,
      [id, computeStockAssetVersionKey({
        chainId: '4663', ticker, tokenAddress: queueToken, robinhoodAssetIdHash: queueProvider,
      }), ticker, keccak256(Buffer.from(ticker)), queueToken, queueProvider, name, queueEvidence,
      status, createdAt, claimedBy, claimedBy ? createdAt : null],
    );
  };
  await insertQueueNomination({
    id: 'queue-demoted', ticker: 'QDM', name: 'Queue Demoted', status: 'review_requested',
    createdAt: '2030-01-01T00:00:00Z',
  });
  await insertQueueNomination({
    id: 'queue-support-three-a', ticker: 'QTA', name: 'Queue Three A', status: 'review_requested',
    createdAt: '2030-01-02T00:00:00Z',
  });
  await insertQueueNomination({
    id: 'queue-support-three-b', ticker: 'QTB', name: 'Queue Three B', status: 'review_requested',
    createdAt: '2030-01-02T00:00:00Z',
  });
  await insertQueueNomination({
    id: 'queue-support-four', ticker: 'QFO', name: 'Queue Four', status: 'review_requested',
    createdAt: '2030-01-03T00:00:00Z',
  });
  await insertQueueNomination({
    id: 'queue-owned', ticker: 'QOW', name: 'Queue Owned', status: 'under_review',
    createdAt: '2030-01-04T00:00:00Z', claimedBy: 'queue-reviewer',
  });
  const endorse = (nominationId, families) => Promise.all(families.map((family) => pool.query(
    `INSERT INTO rwa_nomination_endorsements_v2
      (nomination_id,family_id,account_id,active) VALUES ($1,$2,$3,true)`,
    [nominationId, family, `account-${family}`],
  )));
  await endorse('queue-demoted', ['queue-family-2']);
  await endorse('queue-support-three-a', ['queue-family-2', 'queue-family-3']);
  await endorse('queue-support-three-b', ['queue-family-2', 'queue-family-3']);
  await endorse('queue-support-four', ['queue-family-2', 'queue-family-3', 'queue-family-4']);

  const queueSql = [];
  const queueDb = {
    query: (sql, params) => { queueSql.push(sql); return pool.query(sql, params); },
  };
  const firstPage = await rwaNominationReviewQueue(queueDb, { reviewerId: 'queue-reviewer', limit: 1 });
  assert.deepEqual(firstPage.items.map((item) => [item.id, item.support]), [['queue-support-four', 4]],
    'review queue ranks current support before creation time and demotes stale rows before paging');
  assert.equal(firstPage.hasMore, true);
  const decodedCursor = JSON.parse(Buffer.from(firstPage.nextCursor, 'base64url').toString('utf8'));
  assert.deepEqual(decodedCursor, {
    kind: 'review_queue', support: 4, at: '2030-01-03T00:00:00.000Z', id: 'queue-support-four',
  }, 'review queue cursor carries every authoritative sort field');
  assert.equal(queueSql.filter((sql) => sql.includes('rwa_board_active_slots')).length, 1,
    'current support is fetched in one batch rather than once per nomination');
  assert.equal(queueSql.filter((sql) => /WHERE id=\$1 FOR UPDATE/.test(sql)).length, 0,
    'the dense live universe is locked in a batch, never with a per-row SELECT');
  const secondPage = await rwaNominationReviewQueue(queueDb, {
    reviewerId: 'queue-reviewer', limit: 1, cursor: firstPage.nextCursor,
  });
  const thirdPage = await rwaNominationReviewQueue(queueDb, {
    reviewerId: 'queue-reviewer', limit: 1, cursor: secondPage.nextCursor,
  });
  const fourthPage = await rwaNominationReviewQueue(queueDb, {
    reviewerId: 'queue-reviewer', limit: 1, cursor: thirdPage.nextCursor,
  });
  assert.deepEqual(secondPage.items.map((item) => [item.id, item.support]), [['queue-support-three-a', 3]]);
  assert.deepEqual(thirdPage.items.map((item) => [item.id, item.support]), [['queue-support-three-b', 3]],
    'equal support and creation time use ID as the final stable ordering field');
  assert.deepEqual(fourthPage.items.map((item) => [item.id, item.support]), [['queue-owned', 1]],
    'the current reviewer keeps a below-threshold under-review claim in the dense queue');
  assert.equal((await pool.query(
    "SELECT status FROM rwa_nominations_v2 WHERE id='queue-demoted'",
  )).rows[0].status, 'pending');
  await pool.end();
}

console.log('✅ RWA reviewer queue ranks a dense current-support snapshot without stale holes');

process.env.RATE_LIMIT = 'off';
process.env.MOD_KEY = 'test-moderator-key';
process.env.RWA_REVIEWER_KEY = 'same-secret-and-public-id';
process.env.RWA_REVIEWER_ID = 'same-secret-and-public-id';
const collisionApp = await buildServer();
try {
  const collision = await collisionApp.inject({
    method: 'GET', url: '/v1/rwa/reviewer/queue',
    headers: { 'x-rwa-reviewer-key': 'same-secret-and-public-id' },
  });
  assert.equal(collision.statusCode, 503, collision.body);
  assert.equal(collision.json().error, 'rwa_reviewer_disabled');
  assert.equal(collision.body.includes('same-secret-and-public-id'), false,
    'a credential/public-ID collision never returns the secret');
  assert.equal((await collisionApp.pool.query(
    'SELECT count(*)::int AS n FROM rwa_nomination_reviewer_state_v2',
  )).rows[0].n, 0, 'a colliding secret is never persisted as the public reviewer ID');

  for (const config of [
    { key: 'same-secret-and-public-id', id: '  same-secret-and-public-id  ' },
    { key: 'distinct-reviewer-secret', id: `  ${process.env.MOD_KEY}  ` },
    { key: 'distinct-reviewer-secret', id: '   ' },
    { key: 'distinct-reviewer-secret', id: 'x'.repeat(201) },
  ]) {
    process.env.RWA_REVIEWER_KEY = config.key;
    process.env.RWA_REVIEWER_ID = config.id;
    const disabled = await collisionApp.inject({
      method: 'GET', url: '/v1/rwa/reviewer/queue',
      headers: { 'x-rwa-reviewer-key': config.key },
    });
    assert.equal(disabled.statusCode, 503, disabled.body);
    assert.equal(disabled.json().error, 'rwa_reviewer_disabled');
  }
  process.env.RWA_REVIEWER_KEY = 'trimmed-reviewer-secret';
  process.env.RWA_REVIEWER_ID = '  trimmed-public-reviewer  ';
  const canonical = await collisionApp.inject({
    method: 'GET', url: '/v1/rwa/reviewer/queue',
    headers: { 'x-rwa-reviewer-key': 'trimmed-reviewer-secret' },
  });
  assert.equal(canonical.statusCode, 200, canonical.body);
  assert.deepEqual((await collisionApp.pool.query(
    'SELECT reviewer_id FROM rwa_nomination_reviewer_state_v2 WHERE id=1',
  )).rows[0], { reviewer_id: 'trimmed-public-reviewer' });
} finally {
  await collisionApp.close();
}

process.env.RATE_LIMIT = 'off';
process.env.MOD_KEY = 'test-moderator-key';
process.env.RWA_REVIEWER_KEY = 'reviewer-secret-value';
process.env.RWA_REVIEWER_ID = 'reviewer-public-1';
process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS = getAddress(`0x${'9'.repeat(40)}`);

const live = await buildServer();
try {
  const reviewerRoutes = live.routes.filter((route) => route.url.startsWith('/v1/rwa/reviewer/'));
  assert.equal(reviewerRoutes.length, 4);
  assert(reviewerRoutes.every((route) => route.authKind === 'rwaReviewerAuth'
    && route.isRwaReviewer && !route.isMod), 'reviewer routes have their own runtime perimeter');
  const openapi = (await live.inject({ method: 'GET', url: '/openapi.json' })).json();
  assert.equal(Object.keys(openapi.paths).some((path) => path.startsWith('/v1/rwa/reviewer/')), false,
    'privileged reviewer routes are omitted, never mislabeled bearer/public');

  for (const headers of [{}, { 'x-rwa-reviewer-key': 'wrong' }, { 'x-rwa-reviewer-key': process.env.MOD_KEY }]) {
    const denied = await live.inject({ method: 'GET', url: '/v1/rwa/reviewer/queue', headers });
    assert.equal(denied.statusCode, 401, denied.body);
    assert.equal(denied.body.includes(process.env.RWA_REVIEWER_KEY), false);
  }
  const queueHeaders = { 'x-rwa-reviewer-key': process.env.RWA_REVIEWER_KEY };
  const emptyQueue = await live.inject({ method: 'GET', url: '/v1/rwa/reviewer/queue', headers: queueHeaders });
  assert.equal(emptyQueue.statusCode, 200, emptyQueue.body);
  assert.deepEqual(emptyQueue.json(), { items: [], hasMore: false, nextCursor: null });
  assert.deepEqual((await live.pool.query('SELECT id,reviewer_id FROM rwa_nomination_reviewer_state_v2')).rows,
    [{ id: 1, reviewer_id: 'reviewer-public-1' }]);

  process.env.RWA_REVIEWER_ID = 'reviewer-public-2';
  const mismatch = await live.inject({ method: 'GET', url: '/v1/rwa/reviewer/queue', headers: queueHeaders });
  assert.equal(mismatch.statusCode, 503, mismatch.body);
  assert.equal(mismatch.json().error, 'rwa_reviewer_mismatch');
  process.env.RWA_REVIEWER_ID = 'reviewer-public-1';

  const tokenAddress = getAddress(`0x${'1'.repeat(40)}`);
  const evidenceHash = `0x${'2'.repeat(64)}`;
  const providerHash = `0x${'3'.repeat(64)}`;
  const assetVersionKey = computeStockAssetVersionKey({
    chainId: '4663', ticker: 'RTE', tokenAddress, robinhoodAssetIdHash: providerHash,
  });

  const guest = (await live.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token;
  const playerBody = {
    assetVersionKey, chainId: '4663', ticker: 'RTE', name: 'Route Equity', tokenAddress,
    tokenDecimals: 18, robinhoodAssetIdHash: providerHash, rationale: 'Immutable route evidence',
    evidenceHash, evidenceUri: 'https://evidence.example/route-equity',
  };
  const noCharacter = await live.inject({
    method: 'POST', url: '/v1/rwa/nominations', headers: { authorization: `Bearer ${guest}` }, payload: playerBody,
  });
  assert.equal(noCharacter.statusCode, 400, noCharacter.body);
  assert.equal(noCharacter.json().error, 'no_character');

  const made = await live.inject({
    method: 'POST', url: '/v1/character', headers: { authorization: `Bearer ${guest}` }, payload: { name: 'Route Boss' },
  });
  assert.equal(made.statusCode, 200, made.body);
  const characterId = (await live.inject({
    method: 'GET', url: '/v1/me', headers: { authorization: `Bearer ${guest}` },
  })).json().character.id;
  await live.pool.query(
    "INSERT INTO gangs (id,name,tag,season_tribute) VALUES ('route-family','Route Family','RTEF',1000)",
  );
  await live.pool.query(
    "INSERT INTO gang_members (gang_id,character_id,role) VALUES ('route-family',$1,'boss')", [characterId],
  );
  const playerTokenAddress = getAddress(`0x${'8'.repeat(40)}`);
  const playerProviderHash = `0x${'8'.repeat(64)}`;
  const playerAssetVersionKey = computeStockAssetVersionKey({
    chainId: '4663', ticker: 'PLY', tokenAddress: playerTokenAddress,
    robinhoodAssetIdHash: playerProviderHash,
  });
  const validPlayerBody = {
    assetVersionKey: playerAssetVersionKey, chainId: '4663', ticker: 'PLY', name: 'Player Equity',
    tokenAddress: playerTokenAddress, tokenDecimals: 18, robinhoodAssetIdHash: playerProviderHash,
    rationale: 'A seated family submits immutable evidence.', evidenceHash,
    evidenceUri: 'https://evidence.example/player-equity',
  };
  const badUri = await live.inject({
    method: 'POST', url: '/v1/rwa/nominations', headers: { authorization: `Bearer ${guest}` },
    payload: { ...validPlayerBody, evidenceUri: 'http://not-secure.example/evidence' },
  });
  assert.equal(badUri.statusCode, 400, badUri.body);
  assert.equal(badUri.json().error, 'bad_evidence_uri');
  const playerNomination = await live.inject({
    method: 'POST', url: '/v1/rwa/nominations', headers: { authorization: `Bearer ${guest}` }, payload: validPlayerBody,
  });
  assert.equal(playerNomination.statusCode, 200, playerNomination.body);
  assert.equal(playerNomination.json().duplicate, false);
  assert.equal(playerNomination.json().nomination.reviewStatus, 'pending');
  assert.equal(Object.hasOwn(playerNomination.json().nomination, 'status'), false);
  const duplicate = await live.inject({
    method: 'POST', url: '/v1/rwa/nominations', headers: { authorization: `Bearer ${guest}` }, payload: validPlayerBody,
  });
  assert.equal(duplicate.statusCode, 200, duplicate.body);
  assert.equal(duplicate.json().duplicate, true);
  assert.equal((await live.pool.query(
    'SELECT count(*)::int AS n FROM rwa_nomination_endorsements_v2 WHERE nomination_id=$1',
    [playerNomination.json().nomination.id],
  )).rows[0].n, 0, 'duplicate discovery never implies an endorsement');
  const selfEndorse = await live.inject({
    method: 'POST', url: `/v1/rwa/nominations/${playerNomination.json().nomination.id}/endorsement`,
    headers: { authorization: `Bearer ${guest}` }, payload: { active: true },
  });
  assert.equal(selfEndorse.statusCode, 400, selfEndorse.body);
  assert.equal(selfEndorse.json().error, 'sponsor_self');

  const completionFailureId = 'rwa-completion-store-failure';
  await live.pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until)
     VALUES ($1,$2,4663,'CSF',$3,$4,18,$5,'Completion Store Failure','family-public','private-account',
       'Completion failure must fail closed.',$6,'review_requested','not_applicable',now(),now()+interval '1 day')`,
    [completionFailureId, computeStockAssetVersionKey({
      chainId: '4663', ticker: 'CSF', tokenAddress, robinhoodAssetIdHash: providerHash,
    }), keccak256(Buffer.from('CSF')), tokenAddress, providerHash, evidenceHash],
  );
  const completionFailureUrl = `/v1/rwa/reviewer/nominations/${completionFailureId}/claim`;
  const originalPoolQuery = live.pool.query.bind(live.pool);
  let failedCompletionStore = false;
  live.pool.query = async (sql, params) => {
    if (!failedCompletionStore && /UPDATE\s+rwa_reviewer_idempotency_v2/i.test(sql)) {
      failedCompletionStore = true;
      throw new Error('injected reviewer completion-store failure');
    }
    return originalPoolQuery(sql, params);
  };
  const completionFailure = await live.inject({
    method: 'POST', url: completionFailureUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'completion-store-failure' }, payload: {},
  });
  live.pool.query = originalPoolQuery;
  assert.equal(completionFailure.statusCode, 500, completionFailure.body);
  assert.equal((await live.pool.query(
    'SELECT status FROM rwa_nominations_v2 WHERE id=$1', [completionFailureId],
  )).rows[0].status, 'under_review', 'the domain transaction committed before completion storage failed');
  assert.deepEqual((await live.pool.query(
    `SELECT status FROM rwa_reviewer_idempotency_v2
      WHERE reviewer_id=$1 AND key='completion-store-failure'`, [process.env.RWA_REVIEWER_ID],
  )).rows[0], { status: 0 }, 'a post-commit failure leaves the owned reservation in progress');
  const completionFailureRetry = await live.inject({
    method: 'POST', url: completionFailureUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'completion-store-failure' }, payload: {},
  });
  assert.equal(completionFailureRetry.statusCode, 409, completionFailureRetry.body);
  assert.equal(completionFailureRetry.json().error, 'in_progress');

  const claimedByRoute = await live.inject({
    method: 'POST', url: `/v1/rwa/reviewer/nominations/${playerNomination.json().nomination.id}/claim`,
    headers: {
      ...queueHeaders, authorization: `Bearer ${guest}`, 'idempotency-key': 'claim-player-nomination',
    },
    payload: {},
  });
  assert.equal(claimedByRoute.statusCode, 200, claimedByRoute.body);
  assert.equal(claimedByRoute.json().nomination.reviewStatus, 'under_review');
  assert.equal(claimedByRoute.json().nomination.reviewerId, process.env.RWA_REVIEWER_ID);
  const missingReviewerHeader = await live.inject({
    method: 'POST', url: `/v1/rwa/reviewer/nominations/${playerNomination.json().nomination.id}/claim`,
    headers: { authorization: `Bearer ${guest}`, 'idempotency-key': 'claim-player-nomination' },
    payload: {},
  });
  assert.equal(missingReviewerHeader.statusCode, 401, missingReviewerHeader.body,
    'reviewer authentication runs before any incidental player replay lookup');
  assert.equal((await live.pool.query('SELECT count(*)::int AS n FROM idempotency')).rows[0].n, 0,
    'reviewer mutations are categorically outside the player idempotency namespace');
  const sameClaim = await live.inject({
    method: 'POST', url: `/v1/rwa/reviewer/nominations/${playerNomination.json().nomination.id}/claim`,
    headers: { ...queueHeaders, 'idempotency-key': 'claim-player-nomination-again' }, payload: {},
  });
  assert.equal(sameClaim.statusCode, 200, sameClaim.body);
  assert.equal(sameClaim.json().changed, false);

  const nominationId = 'rwa-route-approval-1';
  await live.pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,claimed_by,claimed_at)
     VALUES ($1,$2,4663,'RTE',$3,$4,18,$5,'Route Equity','family-public','private-account',
       'Immutable route evidence',$6,'under_review','not_applicable',now(),now()+interval '1 day',$7,now())`,
    [nominationId, assetVersionKey, keccak256(Buffer.from('RTE')), tokenAddress, providerHash,
      evidenceHash, process.env.RWA_REVIEWER_ID],
  );

  const queued = await live.inject({ method: 'GET', url: '/v1/rwa/reviewer/queue?limit=10', headers: queueHeaders });
  assert.equal(queued.statusCode, 200, queued.body);
  const queuedApproval = queued.json().items.find((item) => item.id === nominationId);
  assert.equal(queuedApproval.reviewStatus, 'under_review');
  assert.equal(Object.hasOwn(queuedApproval, 'claimedBy'), false);

  const dispositionUrl = `/v1/rwa/reviewer/nominations/${nominationId}/disposition`;
  const approvedBody = { disposition: 'approved', reason: 'Evidence verified.', evidenceHash };
  const wrongEvidence = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'wrong-evidence' },
    payload: { ...approvedBody, evidenceHash: `0x${'4'.repeat(64)}` },
  });
  assert.equal(wrongEvidence.statusCode, 400, wrongEvidence.body);
  assert.equal(wrongEvidence.json().error, 'evidence_conflict');
  assert.equal((await live.pool.query('SELECT status FROM rwa_nominations_v2 WHERE id=$1', [nominationId])).rows[0].status,
    'under_review');

  const approved = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'approve-1' }, payload: approvedBody,
  });
  assert.equal(approved.statusCode, 200, approved.body);
  const approval = approved.json();
  assert.equal(approval.nomination.reviewStatus, 'approved');
  assert.equal(approval.nomination.executionStatus, 'safe_package_ready');
  assert.equal(Object.hasOwn(approval.nomination, 'claimedBy'), false);
  assert.equal(Object.hasOwn(approval.nomination, 'dispositionBy'), false);
  assert.equal(approval.proposal.executionTxHash, null);
  assert.match(approval.proposal.reviewId, /^0x[0-9a-f]{64}$/);
  assert.notEqual(approval.proposal.reviewId, `0x${'0'.repeat(64)}`);
  assert.equal(new Date(approval.proposal.validUntil).getTime() - new Date(approval.proposal.approvedAt).getTime(),
    604800000);
  assert.equal(new Date(approval.proposal.approvedAt).getMilliseconds(), 0);
  assert.equal(approval.proposal.calldataHash, keccak256(approval.proposal.safeTransaction.data));
  assert.doesNotThrow(() => JSON.stringify(approval.proposal.safeTransaction), 'package is exact BigInt-free JSON');
  assert.deepEqual(approval.proposal.safeTransaction, buildStockTokenActivationV2({
    asset: {
      chainId: '4663', ticker: 'RTE', name: 'Route Equity', tokenAddress, tokenDecimals: 18,
      robinhoodAssetIdHash: providerHash,
    },
    registryAddress: process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS,
    evidenceHash, reviewId: approval.proposal.reviewId,
    approvedAt: String(Math.floor(new Date(approval.proposal.approvedAt).getTime() / 1000)),
  }), 'the persisted package is the literal independent Task 2 builder vector');
  const approvalEvent = (await live.pool.query(
    `SELECT actor_id,details FROM rwa_nomination_events_v2
      WHERE nomination_id=$1 AND event_type='review_approved'`, [nominationId],
  )).rows[0];
  assert.equal(approvalEvent.actor_id, process.env.RWA_REVIEWER_ID);
  assert.equal(JSON.stringify(approvalEvent).includes(process.env.RWA_REVIEWER_KEY), false,
    'the reviewer secret never enters the append-only event record');

  const replay = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'approve-1' }, payload: approvedBody,
  });
  assert.equal(replay.statusCode, 200, replay.body);
  assert.equal(replay.headers['x-idempotent-replay'], 'true');
  assert.deepEqual(replay.json(), approval, 'same reviewer request replays the exact stored success');
  const reuse = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'approve-1' },
    payload: { ...approvedBody, reason: 'Different reason.' },
  });
  assert.equal(reuse.statusCode, 422, reuse.body);
  assert.equal(reuse.json().error, 'idempotency_key_reuse');

  const naturalRetry = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'approve-natural-retry' }, payload: approvedBody,
  });
  assert.equal(naturalRetry.statusCode, 200, naturalRetry.body);
  assert.equal(naturalRetry.json().changed, false);
  assert.deepEqual(naturalRetry.json().proposal, approval.proposal, 'natural retry never regenerates package identity or time');
  const reviewConflict = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'approve-conflict' },
    payload: { ...approvedBody, reason: 'A conflicting terminal reason.' },
  });
  assert.equal(reviewConflict.statusCode, 400, reviewConflict.body);
  assert.equal(reviewConflict.json().error, 'review_conflict');

  const rejectedId = 'rwa-route-rejected-1';
  const rejectedKey = computeStockAssetVersionKey({
    chainId: '4663', ticker: 'RJE', tokenAddress, robinhoodAssetIdHash: providerHash,
  });
  await live.pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,claimed_by,claimed_at)
     VALUES ($1,$2,4663,'RJE',$3,$4,18,$5,'Rejected Equity','family-public','private-account',
       'Rejected evidence',$6,'under_review','not_applicable',now(),now()+interval '1 day',$7,now())`,
    [rejectedId, rejectedKey, keccak256(Buffer.from('RJE')), tokenAddress, providerHash,
      evidenceHash, process.env.RWA_REVIEWER_ID],
  );
  const rejected = await live.inject({
    method: 'POST', url: `/v1/rwa/reviewer/nominations/${rejectedId}/disposition`,
    headers: { ...queueHeaders, 'idempotency-key': 'reject-1' },
    payload: { disposition: 'rejected', reason: 'Evidence was insufficient.', evidenceHash },
  });
  assert.equal(rejected.statusCode, 200, rejected.body);
  assert.equal(rejected.json().nomination.reviewStatus, 'rejected');
  assert.equal(rejected.json().nomination.executionStatus, 'not_applicable');
  assert.equal(rejected.json().proposal, null);
  assert.equal((await live.pool.query(
    'SELECT count(*)::int AS n FROM rwa_nomination_safe_proposals_v2 WHERE nomination_id=$1', [rejectedId],
  )).rows[0].n, 0, 'rejection never implies an activation or deactivation package');

  await live.pool.query(
    `INSERT INTO rwa_reviewer_idempotency_v2
      (reviewer_id,key,method,path,body_hash,status,response)
     VALUES ($1,'reserved','POST',$2,$3,0,'')`,
    [process.env.RWA_REVIEWER_ID, dispositionUrl,
      crypto.createHash('sha256').update(`POST\n${dispositionUrl}\n${JSON.stringify(approvedBody)}`).digest('hex')],
  );
  const inProgress = await live.inject({
    method: 'POST', url: dispositionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'reserved' }, payload: approvedBody,
  });
  assert.equal(inProgress.statusCode, 409, inProgress.body);
  assert.equal(inProgress.json().error, 'in_progress', 'an orphan reservation fails closed rather than re-executing');

  const safeTxHash = `0x${'5'.repeat(64)}`;
  const submissionUrl = `/v1/rwa/reviewer/nominations/${nominationId}/submission`;
  const submitted = await live.inject({
    method: 'POST', url: submissionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'submit-1' }, payload: { safeTxHash },
  });
  assert.equal(submitted.statusCode, 200, submitted.body);
  assert.equal(submitted.json().proposal.status, 'safe_submitted');
  assert.equal(submitted.json().proposal.safeTxHash, safeTxHash);
  assert.equal(submitted.json().proposal.executionTxHash, null, 'Safe identity is not execution identity');
  const persisted = (await live.pool.query(
    'SELECT safe_tx_hash,execution_tx_hash,status FROM rwa_nomination_safe_proposals_v2 WHERE nomination_id=$1',
    [nominationId],
  )).rows[0];
  assert.deepEqual(persisted, { safe_tx_hash: safeTxHash, execution_tx_hash: null, status: 'safe_submitted' });
  const sameSubmission = await live.inject({
    method: 'POST', url: submissionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'submit-natural-retry' }, payload: { safeTxHash },
  });
  assert.equal(sameSubmission.statusCode, 200, sameSubmission.body);
  assert.equal(sameSubmission.json().changed, false);
  assert.equal(sameSubmission.json().proposal.executionTxHash, null);
  const differentSubmission = await live.inject({
    method: 'POST', url: submissionUrl,
    headers: { ...queueHeaders, 'idempotency-key': 'submit-conflict' },
    payload: { safeTxHash: `0x${'a'.repeat(64)}` },
  });
  assert.equal(differentSubmission.statusCode, 400, differentSubmission.body);
  assert.equal(differentSubmission.json().error, 'submission_conflict');

  await live.pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,disposition_by,disposition_at,disposition_reason,approved_at,valid_until)
     VALUES ('rwa-expiry-1',$1,4663,'EXP',$2,$3,18,$4,'Expiry Equity','family-public','private-account',
       'Expiry evidence',$5,'approved','safe_package_ready',now(),now()+interval '1 day',$6,now(),'Approved.',
       '2030-01-01T00:00:00Z','2030-01-08T00:00:00Z')`,
    [computeStockAssetVersionKey({ chainId: '4663', ticker: 'EXP', tokenAddress,
      robinhoodAssetIdHash: providerHash }), keccak256(Buffer.from('EXP')), tokenAddress, providerHash,
      evidenceHash, process.env.RWA_REVIEWER_ID],
  );
  await live.pool.query(
    `INSERT INTO rwa_nomination_safe_proposals_v2
      (nomination_id,asset_version_key,registry_address,safe_transaction,calldata_hash,evidence_hash,
       review_id,approved_at,valid_until,status)
     SELECT id,asset_version_key,$2,'{}'::jsonb,$3,evidence_hash,$4,approved_at,valid_until,'safe_package_ready'
       FROM rwa_nominations_v2 WHERE id='rwa-expiry-1'`,
    ['unused', process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS, `0x${'6'.repeat(64)}`, `0x${'7'.repeat(64)}`],
  );
  const expiryClock = new Date('2030-01-08T00:00:00.000Z');
  const expiry = await expireRwaApprovals({
    query: (sql, params) => sql.includes('rwa_wall_clock')
      ? Promise.resolve({ rows: [{ wall_now: expiryClock }] }) : live.pool.query(sql, params),
  }, { limit: 10 });
  assert.equal(expiry.processed, 1, 'unsigned package stales at exact validUntil');
  assert.deepEqual((await live.pool.query(
    `SELECT n.status AS review_status,n.execution_status,p.status AS proposal_status
       FROM rwa_nominations_v2 n JOIN rwa_nomination_safe_proposals_v2 p ON p.nomination_id=n.id
      WHERE n.id='rwa-expiry-1'`,
  )).rows[0], { review_status: 'approved', execution_status: 'approval_stale', proposal_status: 'approval_stale' });
  const staleSubmission = await live.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/rwa-expiry-1/submission',
    headers: { ...queueHeaders, 'idempotency-key': 'submit-stale' }, payload: { safeTxHash: `0x${'b'.repeat(64)}` },
  });
  assert.equal(staleSubmission.statusCode, 400, staleSubmission.body);
  assert.equal(staleSubmission.json().error, 'submission_terminal');
  await live.pool.query(
    "UPDATE rwa_nomination_safe_proposals_v2 SET valid_until='2020-01-01T00:00:00Z' WHERE nomination_id=$1",
    [nominationId],
  );
  const submittedExpiry = await expireRwaApprovals(live.pool, { limit: 10 });
  assert.equal(submittedExpiry.processed, 0, 'submitted package is never wall-clock expired');
  assert.equal((await live.pool.query(
    'SELECT status FROM rwa_nomination_safe_proposals_v2 WHERE nomination_id=$1', [nominationId],
  )).rows[0].status, 'safe_submitted');
  assert.equal((await live.pool.query('SELECT count(*)::int AS n FROM idempotency')).rows[0].n, 0,
    'reviewer replay never fabricates a player idempotency identity');
} finally {
  await live.close();
  delete process.env.RWA_REVIEWER_KEY;
  delete process.env.RWA_REVIEWER_ID;
  delete process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  delete process.env.RATE_LIMIT;
}

console.log('✅ RWA reviewer auth, exact package, replay, and submission routes passed');

// A real rollback-capable pg-mem harness proves package construction occurs inside the same owned
// transaction as the review update/event. The injected builder fails after the update point.
{
  const mem = newDb();
  const { Pool } = mem.adapters.createPg();
  const pool = new Pool();
  await pool.query(SCHEMA);
  const token = getAddress(`0x${'c'.repeat(40)}`);
  const provider = `0x${'c'.repeat(64)}`;
  const evidence = `0x${'d'.repeat(64)}`;
  const key = computeStockAssetVersionKey({
    chainId: '4663', ticker: 'RBK', tokenAddress: token, robinhoodAssetIdHash: provider,
  });
  await pool.query(
    `INSERT INTO rwa_nominations_v2
      (id,asset_version_key,chain_id,ticker,ticker_hash,token_address,token_decimals,
       robinhood_asset_id_hash,name,sponsor_family_id,sponsor_account_id,rationale,evidence_hash,
       status,execution_status,created_at,pending_until,claimed_by,claimed_at)
     VALUES ('rollback-package',$1,4663,'RBK',$2,$3,18,$4,'Rollback Equity','family','account',
       'Rollback evidence',$5,'under_review','not_applicable','2026-01-01','2030-01-01','reviewer',now())`,
    [key, keccak256(Buffer.from('RBK')), token, provider, evidence],
  );
  let backup = null;
  const controls = [];
  mem.public.interceptQueries((sql) => {
    const command = sql.trim().toUpperCase();
    if (command === 'BEGIN') { controls.push('BEGIN'); backup = mem.backup(); return []; }
    if (command === 'COMMIT') { controls.push('COMMIT'); backup = null; return []; }
    if (command === 'ROLLBACK') { controls.push('ROLLBACK'); backup?.restore(); backup = null; return []; }
    return null;
  });
  await assert.rejects(
    disposeRwaNominationReviewWithSafePackage({ connect: () => pool.connect() }, 'rollback-package', 'reviewer', {
      disposition: 'approved', reason: 'This should roll back.', evidenceHash: evidence,
    }, {
      registryAddress: getAddress(`0x${'e'.repeat(40)}`),
      buildActivation: () => { throw new Error('injected package failure'); },
    }),
    (error) => error?.code === 'safe_package_failed',
  );
  assert.deepEqual(controls, ['BEGIN', 'ROLLBACK']);
  assert.deepEqual((await pool.query(
    'SELECT status,execution_status,disposition_by FROM rwa_nominations_v2 WHERE id=$1', ['rollback-package'],
  )).rows[0], { status: 'under_review', execution_status: 'not_applicable', disposition_by: null });
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM rwa_nomination_events_v2 WHERE nomination_id=$1', ['rollback-package'],
  )).rows[0].n, 0);
  assert.equal((await pool.query(
    'SELECT count(*)::int AS n FROM rwa_nomination_safe_proposals_v2 WHERE nomination_id=$1', ['rollback-package'],
  )).rows[0].n, 0);
  await pool.end();
}

console.log('✅ RWA approval package failure rolls review, event, and proposal back together');

process.env.RATE_LIMIT = 'on';
process.env.RATE_AUTH_BURST = '1';
process.env.RATE_AUTH_PER_SEC = '0.001';
process.env.RWA_REVIEWER_KEY = 'bounded-reviewer-key';
process.env.RWA_REVIEWER_ID = 'bounded-reviewer';
const limitedApp = await buildServer();
try {
  const headers = { 'x-rwa-reviewer-key': process.env.RWA_REVIEWER_KEY };
  const badHeaders = { 'x-rwa-reviewer-key': 'wrong-reviewer-key' };
  const denied = await limitedApp.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/missing/claim', remoteAddress: '198.51.100.10',
    headers: { ...badHeaders, 'idempotency-key': 'preauth-rate-1' }, payload: {},
  });
  assert.equal(denied.statusCode, 401, denied.body);
  const preauthLimited = await limitedApp.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/missing/claim', remoteAddress: '198.51.100.10',
    headers: { ...badHeaders, 'idempotency-key': 'preauth-rate-2' }, payload: {},
  });
  assert.equal(preauthLimited.statusCode, 429, preauthLimited.body);
  assert.equal(preauthLimited.json().error, 'rate_limited', 'the pre-auth limiter is source-IP scoped');
  const first = await limitedApp.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/missing/claim',
    remoteAddress: '198.51.100.20',
    headers: { ...headers, 'idempotency-key': 'rate-1' }, payload: {},
  });
  assert.equal(first.statusCode, 400, first.body);
  const second = await limitedApp.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/missing/claim',
    remoteAddress: '198.51.100.21',
    headers: { ...headers, 'idempotency-key': 'rate-2' }, payload: {},
  });
  assert.equal(second.statusCode, 429, second.body);
  assert.equal(second.json().error, 'rate_limited',
    'distinct source IPs prove the post-auth reviewer-ID bucket independently');
} finally {
  await limitedApp.close();
  for (const key of ['RATE_LIMIT', 'RATE_AUTH_BURST', 'RATE_AUTH_PER_SEC', 'RWA_REVIEWER_KEY', 'RWA_REVIEWER_ID']) {
    delete process.env[key];
  }
}

console.log('✅ RWA reviewer mutations have a bounded reviewer-only rate namespace');
