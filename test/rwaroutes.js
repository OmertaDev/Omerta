import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getAddress, keccak256 } from 'viem';
import { newDb } from 'pg-mem';
import { buildServer } from '../src/server.js';
import { buildStockTokenActivationV2, computeStockAssetVersionKey } from '../src/stockcatalogv2.js';
import { disposeRwaNominationReviewWithSafePackage, expireRwaApprovals } from '../src/rwanominations.js';

const SCHEMA = fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql'), 'utf8');

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
  const claimedByRoute = await live.inject({
    method: 'POST', url: `/v1/rwa/reviewer/nominations/${playerNomination.json().nomination.id}/claim`,
    headers: { ...queueHeaders, 'idempotency-key': 'claim-player-nomination' }, payload: {},
  });
  assert.equal(claimedByRoute.statusCode, 200, claimedByRoute.body);
  assert.equal(claimedByRoute.json().nomination.reviewStatus, 'under_review');
  assert.equal(claimedByRoute.json().nomination.reviewerId, process.env.RWA_REVIEWER_ID);
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
  const first = await limitedApp.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/missing/claim',
    headers: { ...headers, 'idempotency-key': 'rate-1' }, payload: {},
  });
  assert.equal(first.statusCode, 400, first.body);
  const second = await limitedApp.inject({
    method: 'POST', url: '/v1/rwa/reviewer/nominations/missing/claim',
    headers: { ...headers, 'idempotency-key': 'rate-2' }, payload: {},
  });
  assert.equal(second.statusCode, 429, second.body);
  assert.equal(second.json().error, 'rate_limited');
} finally {
  await limitedApp.close();
  for (const key of ['RATE_LIMIT', 'RATE_AUTH_BURST', 'RATE_AUTH_PER_SEC', 'RWA_REVIEWER_KEY', 'RWA_REVIEWER_ID']) {
    delete process.env[key];
  }
}

console.log('✅ RWA reviewer mutations have a bounded reviewer-only rate namespace');
