import crypto from 'node:crypto';
import { getAddress } from 'viem';
import {
  claimRwaNominationReview,
  createRwaNomination,
  disposeRwaNominationReviewWithSafePackage,
  recordRwaSafeSubmission,
  renewRwaNominationSponsorSupport,
  rwaNominationBoard,
  rwaNominationReviewQueue,
  setRwaNominationEndorsement,
} from '../rwanominations.js';
import { GameError } from '../game.js';
import { checkAuthRateLimit, rateLimitsEnabled } from '../ratelimit.js';

const ZERO_ADDRESS = /^0x0{40}$/i;
const fail = (code, message) => { throw new GameError(code, message); };

function configuredReviewer() {
  const key = process.env.RWA_REVIEWER_KEY;
  const id = process.env.RWA_REVIEWER_ID;
  if (typeof key !== 'string' || !key || typeof id !== 'string' || !id) return null;
  if (typeof process.env.MOD_KEY === 'string' && process.env.MOD_KEY === key) return null;
  return { key, id };
}

function reviewerKeyMatches(expected, supplied) {
  if (typeof supplied !== 'string') return false;
  const a = Buffer.from(supplied);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function latchReviewer(pool, reviewerId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `INSERT INTO rwa_nomination_reviewer_state_v2 (id,reviewer_id,updated_at)
       VALUES (1,$1,now()) ON CONFLICT (id) DO NOTHING`, [reviewerId],
    );
    const row = (await client.query(
      'SELECT reviewer_id FROM rwa_nomination_reviewer_state_v2 WHERE id=1 FOR UPDATE',
    )).rows[0];
    if (!row || row.reviewer_id !== reviewerId) {
      await client.query('ROLLBACK');
      return false;
    }
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function canonicalRegistryAddress() {
  const raw = process.env.STOCK_TOKEN_REGISTRY_V2_ADDRESS;
  if (typeof raw !== 'string' || !raw.trim()) fail('rwa_registry_disabled', 'The registry V2 address is not configured.');
  let address;
  try { address = getAddress(raw.trim()); }
  catch { fail('rwa_registry_disabled', 'The registry V2 address is invalid.'); }
  if (ZERO_ADDRESS.test(address)) fail('rwa_registry_disabled', 'The registry V2 address is invalid.');
  return address;
}

function exactBody(body, required, optional = []) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail('bad_body', 'Invalid request body.');
  const allowed = new Set([...required, ...optional]);
  const keys = Object.keys(body);
  if (required.some((key) => !Object.hasOwn(body, key)) || keys.some((key) => !allowed.has(key))) {
    fail('bad_body', 'Request body has unknown or missing fields.');
  }
  return body;
}

function exactQuery(query, allowed) {
  const value = query ?? {};
  if (Object.keys(value).some((key) => !allowed.includes(key))) fail('bad_query', 'Unknown query field.');
  return value;
}

function publicNomination(value) {
  if (!value) return value;
  const {
    status, claimedBy, dispositionBy, requestingFamilyId, ...safe
  } = value;
  return {
    ...safe,
    reviewStatus: status,
    reviewerId: claimedBy || dispositionBy || null,
  };
}

function publicResult(result) {
  if (!result || typeof result !== 'object') return result;
  if (Array.isArray(result.items)) return { ...result, items: result.items.map(publicNomination) };
  return { ...result, ...(result.nomination ? { nomination: publicNomination(result.nomination) } : {}) };
}

function requestHash(req) {
  const path = String(req.url).split('?')[0];
  const body = JSON.stringify(req.body ?? null);
  return {
    path,
    hash: crypto.createHash('sha256').update(`${req.method}\n${path}\n${body}`).digest('hex'),
  };
}

async function reserveReviewerMutation(pool, reviewerId, req) {
  const key = req.headers['idempotency-key'];
  if (typeof key !== 'string' || !key || key.length > 200) fail('idempotency_key_required', 'A valid Idempotency-Key is required.');
  const { path, hash } = requestHash(req);
  const token = crypto.randomUUID();
  await pool.query(
    `INSERT INTO rwa_reviewer_idempotency_v2
      (reviewer_id,key,method,path,body_hash,status,response)
     VALUES ($1,$2,$3,$4,$5,0,$6) ON CONFLICT (reviewer_id,key) DO NOTHING`,
    [reviewerId, key, req.method, path, hash, token],
  );
  const row = (await pool.query(
    `SELECT method,path,body_hash,status,response FROM rwa_reviewer_idempotency_v2
      WHERE reviewer_id=$1 AND key=$2`, [reviewerId, key],
  )).rows[0];
  if (!row) fail('contention', 'Idempotency reservation contended; retry.');
  if (Number(row.status) === 0 && row.response === token) return { key, hash, path, token, fresh: true };
  if (row.method !== req.method || row.path !== path || row.body_hash !== hash) {
    return { conflict: true };
  }
  if (Number(row.status) === 0) return { inProgress: true };
  return { replay: true, status: Number(row.status), response: row.response };
}

function reviewerMutation(pool, handler) {
  return async function rwaReviewerMutation(req, reply) {
    const reservation = await reserveReviewerMutation(pool, req.rwaReviewerId, req);
    if (reservation.conflict) return reply.code(422).send({ error: 'idempotency_key_reuse' });
    if (reservation.inProgress) return reply.code(409).send({ error: 'in_progress' });
    if (reservation.replay) {
      reply.header('x-idempotent-replay', 'true').code(reservation.status);
      return reply.send(JSON.parse(reservation.response));
    }
    try {
      const result = await handler(req, reply);
      const status = result?.rwaHttpStatus ?? 200;
      const body = result?.rwaHttpStatus ? result.body : result;
      const response = JSON.stringify(body);
      const stored = await pool.query(
        `UPDATE rwa_reviewer_idempotency_v2 SET status=$3,response=$4
          WHERE reviewer_id=$1 AND key=$2 AND status=0 AND response=$5 RETURNING key`,
        [req.rwaReviewerId, reservation.key, status, response, reservation.token],
      );
      if (stored.rows.length !== 1) throw new Error('reviewer idempotency completion lost');
      if (status !== 200) return reply.code(status).send(body);
      return body;
    } catch (error) {
      await pool.query(
        'DELETE FROM rwa_reviewer_idempotency_v2 WHERE reviewer_id=$1 AND key=$2 AND status=0 AND response=$3',
        [req.rwaReviewerId, reservation.key, reservation.token],
      ).catch(() => {});
      throw error;
    }
  };
}

export function registerRwa(app, { pool, auth, withCharacter }) {
  const rwaReviewerAuth = async function rwaReviewerAuth(req, reply) {
    const configured = configuredReviewer();
    if (!configured) return reply.code(503).send({ error: 'rwa_reviewer_disabled' });
    if (rateLimitsEnabled() && req.method === 'POST') {
      const limited = await checkAuthRateLimit({ ip: `rwa-reviewer-auth:${req.ip}` });
      if (limited) return reply.code(429).header('retry-after', limited.retryAfter)
        .send({ error: 'rate_limited', retryAfter: limited.retryAfter });
    }
    if (!reviewerKeyMatches(configured.key, req.headers['x-rwa-reviewer-key'])) {
      return reply.code(401).send({ error: 'rwa_reviewer_auth' });
    }
    if (rateLimitsEnabled() && req.method === 'POST') {
      const limited = await checkAuthRateLimit({ ip: `rwa-reviewer-action:${configured.id}` });
      if (limited) return reply.code(429).header('retry-after', limited.retryAfter)
        .send({ error: 'rate_limited', retryAfter: limited.retryAfter });
    }
    if (!await latchReviewer(pool, configured.id)) {
      return reply.code(503).send({ error: 'rwa_reviewer_mismatch' });
    }
    req.rwaReviewerId = configured.id;
  };

  app.get('/v1/rwa/nominations', async (req) => {
    const query = exactQuery(req.query, ['limit', 'cursor', 'finalizedOnly']);
    return publicResult(await rwaNominationBoard(pool, {
      limit: query.limit == null ? undefined : Number(query.limit),
      cursor: query.cursor,
      finalizedOnly: query.finalizedOnly == null ? undefined
        : query.finalizedOnly === 'true' ? true : query.finalizedOnly === 'false' ? false : query.finalizedOnly,
    }));
  });

  app.post('/v1/rwa/nominations', { preHandler: auth }, async (req) => {
    const body = exactBody(req.body, [
      'assetVersionKey', 'chainId', 'ticker', 'name', 'tokenAddress', 'tokenDecimals',
      'robinhoodAssetIdHash', 'rationale', 'evidenceHash',
    ], ['evidenceUri']);
    return publicResult(await withCharacter(pool, req.user.sub,
      (ch, client, h) => createRwaNomination(ch, body, client, h)));
  });
  app.post('/v1/rwa/nominations/:id/endorsement', { preHandler: auth }, async (req) => {
    const body = exactBody(req.body, ['active'], ['rationale']);
    return publicResult(await withCharacter(pool, req.user.sub,
      (ch, client, h) => setRwaNominationEndorsement(ch, req.params.id, body, client, h)));
  });
  app.post('/v1/rwa/nominations/:id/sponsor-renewal', { preHandler: auth }, async (req) => {
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
      fail('bad_body', 'Sponsor renewal takes no authority fields.');
    }
    return publicResult(await withCharacter(pool, req.user.sub,
      (ch, client, h) => renewRwaNominationSponsorSupport(ch, req.params.id, client, h)));
  });

  const reviewerPost = (handler) => ({
    preHandler: rwaReviewerAuth,
    handler: reviewerMutation(pool, handler),
  });
  app.post('/v1/rwa/reviewer/nominations/:id/claim', reviewerPost(async (req) => {
    if (req.body != null && (typeof req.body !== 'object' || Array.isArray(req.body) || Object.keys(req.body).length)) {
      fail('bad_body', 'Claim takes no body fields.');
    }
    return publicResult(await claimRwaNominationReview(pool, req.params.id, req.rwaReviewerId));
  }));
  app.post('/v1/rwa/reviewer/nominations/:id/disposition', reviewerPost(async (req) => {
    const body = exactBody(req.body, ['disposition', 'reason', 'evidenceHash']);
    return publicResult(await disposeRwaNominationReviewWithSafePackage(
      pool, req.params.id, req.rwaReviewerId, body,
      { registryAddress: body.disposition === 'approved' ? canonicalRegistryAddress() : undefined },
    ));
  }));
  app.post('/v1/rwa/reviewer/nominations/:id/submission', reviewerPost(async (req) => {
    const body = exactBody(req.body, ['safeTxHash']);
    const result = await recordRwaSafeSubmission(pool, req.params.id, req.rwaReviewerId, body.safeTxHash);
    if (result.stale) return { rwaHttpStatus: 409, body: { error: 'approval_stale' } };
    return result;
  }));
  app.get('/v1/rwa/reviewer/queue', { preHandler: rwaReviewerAuth }, async (req) => publicResult(
    await rwaNominationReviewQueue(pool, {
      reviewerId: req.rwaReviewerId,
      limit: exactQuery(req.query, ['limit', 'cursor']).limit == null ? undefined : Number(req.query.limit),
      cursor: req.query?.cursor,
    }),
  ));
}
