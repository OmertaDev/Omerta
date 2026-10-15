// Intelligence orchestration and confirmation. All game authority stays in existing services.
import crypto from 'node:crypto';
import { GatewayError, canonical, fail, hash, identifier, validate, object } from './security.js';
import { actionTarget } from './actions.js';

export function createAgentGateway({ pool, security, context, capabilities, dispatch, resolveReceipt, now = Date.now }) {
  const registry = new Map(capabilities.map((capability) => [capability.name, capability]));
  function allowed(principal, capability) {
    if (!capability) fail('unknown_capability', 404);
    if (!capability.scopes.every((scope) => principal.scopes.includes(scope))) fail('insufficient_scope', 403);
  }
  const previewView = (row, player = false) => ({ id: row.id, capability: row.capability,
    arguments: JSON.parse(row.arguments_json), summary: JSON.parse(row.preview_json), digest: row.digest,
    state: row.state, expiresAt: row.expires_at, confirmationRequired: true,
    confirmationUrl: '/consigliere?preparation=' + encodeURIComponent(row.id),
    ...(player ? { nonce: row.nonce, target: JSON.parse(row.target_json) } : {}),
    ...(row.result_json ? { result: JSON.parse(row.result_json) } : {}),
  });
  async function loadPreparation(accountId, preparationId) {
    validate(preparationId, identifier);
    const row = (await pool.query('SELECT * FROM agent_gateway_preparations WHERE id=$1 AND account_id=$2',
      [preparationId, accountId])).rows[0];
    if (!row) fail('preparation_unavailable', 404);
    return row;
  }
  async function prepare(principal, name, args, requestId) {
    const prior = (await pool.query(`SELECT * FROM agent_gateway_preparations
      WHERE connection_id=$1 AND request_id=$2`, [principal.connectionId, requestId])).rows[0];
    if (prior && prior.state !== 'pending') return { id: prior.id, state: prior.state,
      confirmationRequired: true, confirmationUrl: '/consigliere?preparation=' + encodeURIComponent(prior.id) };
    const target = actionTarget(name, args);
    const preview = await context.prepare(name, principal.accountId, args, { scopes: principal.scopes });
    if (preview.available === false) fail('action_not_available', 409);
    if (prior) {
      if (new Date(prior.expires_at).getTime() <= now()) fail('preparation_expired', 409);
      if (hash(canonical({ name, args, preview, target })) !== prior.digest) fail('stale_preparation', 409);
      return previewView(prior);
    }
    const id = crypto.randomUUID(), nonce = crypto.randomBytes(32).toString('base64url');
    const digest = hash(canonical({ name, args, preview, target }));
    const expiresAt = new Date(now() + 10 * 60000).toISOString();
    await pool.query(`INSERT INTO agent_gateway_preparations
      (id,connection_id,account_id,request_id,capability,arguments_json,preview_json,target_json,digest,nonce,expires_at)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) ON CONFLICT (connection_id,request_id) DO NOTHING`,
    [id, principal.connectionId, principal.accountId, requestId, name, canonical(args), canonical(preview), canonical(target), digest, nonce, expiresAt]);
    const row = (await pool.query(`SELECT * FROM agent_gateway_preparations
      WHERE connection_id=$1 AND request_id=$2`, [principal.connectionId, requestId])).rows[0];
    return previewView(row);
  }
  async function execute(rawPrincipal, name, args, { requestId } = {}) {
    const principal = await security.revalidate(rawPrincipal);
    await security.rateLimit(principal);
    validate(requestId, identifier);
    validate(name, { type: 'string', maxLength: 100, pattern: '^[a-z][a-z0-9_]+$' });
    const capability = registry.get(name);
    const requestHash = hash(canonical({ name, args }));
    await pool.query(`INSERT INTO agent_gateway_requests
      (connection_id,request_id,request_hash,capability,action_class) VALUES ($1,$2,$3,$4,$5)
      ON CONFLICT (connection_id,request_id) DO NOTHING`,
    [principal.connectionId, requestId, requestHash, name, capability?.actionClass || 'UNKNOWN']);
    const request = (await pool.query(`SELECT * FROM agent_gateway_requests
      WHERE connection_id=$1 AND request_id=$2`, [principal.connectionId, requestId])).rows[0];
    if (request.request_hash !== requestHash) fail('request_id_reused', 409);
    try {
      allowed(principal, capability);
      validate(args, capability.inputSchema);
      // READ results are recomputed on retries: a saved snapshot cannot outlive discovery or membership permissions.
      const data = ['READ', 'ANALYZE'].includes(capability.actionClass)
        ? await context.execute(name, principal.accountId, args, { scopes: principal.scopes })
        : await prepare(principal, name, args, requestId);
      await pool.query(`UPDATE agent_gateway_requests SET state='completed',completed_at=$1,result_code='ok',preparation_id=$2
        WHERE connection_id=$3 AND request_id=$4`,
      [new Date(now()).toISOString(), data?.confirmationRequired ? data.id : null, principal.connectionId, requestId]);
      return { schemaVersion: 1, requestId, capability: name, actionClass: capability.actionClass,
        generatedAt: new Date(now()).toISOString(), contentType: 'untrusted_game_data', data };
    } catch (error) {
      await pool.query(`UPDATE agent_gateway_requests SET state='failed',completed_at=$1,result_code=$2
        WHERE connection_id=$3 AND request_id=$4`,
      [new Date(now()).toISOString(), error instanceof GatewayError ? error.code : 'capability_failed', principal.connectionId, requestId]);
      throw error;
    }
  }
  async function confirm(accountId, preparationId, input, playerAuthorization) {
    validate(input, object({ nonce: { type: 'string', pattern: '^[A-Za-z0-9_-]{43}$' },
      digest: { type: 'string', pattern: '^[a-f0-9]{64}$' } }, ['nonce', 'digest']));
    const row = await loadPreparation(accountId, preparationId);
    if (row.nonce !== input.nonce || row.digest !== input.digest) fail('confirmation_mismatch', 409);
    const principal = await security.revalidate({ accountId, connectionId: row.connection_id });
    allowed(principal, registry.get(row.capability));
    if (row.state === 'completed') return previewView(row, true);
    const args = JSON.parse(row.arguments_json), target = actionTarget(row.capability, args);
    // Recover ONLY a committed authoritative receipt. An uncertain transport response is not
    // permission to execute a new command with changed terms, even after the player retries.
    if (resolveReceipt) {
      const receipt = await resolveReceipt({ ...target, accountId, idempotencyKey: 'gateway-' + row.id });
      if (receipt?.statusCode >= 200 && receipt.statusCode < 300) {
        await pool.query(`UPDATE agent_gateway_preparations SET state='completed',result_json=$1
          WHERE id=$2 AND state<>'completed'`, [canonical({ status: receipt.statusCode, ok: true, deepLink: '/' }), row.id]);
        return previewView(await loadPreparation(accountId, row.id), true);
      }
    }
    if (!['pending', 'executing'].includes(row.state)) fail('preparation_unavailable', 409);
    if (new Date(row.expires_at).getTime() <= now()) fail('preparation_expired', 409);
    const preview = await context.prepare(row.capability, accountId, args, { scopes: principal.scopes });
    if (preview.available === false || hash(canonical({ name: row.capability, args, preview, target })) !== row.digest) fail('stale_preparation', 409);
    await pool.query(`UPDATE agent_gateway_preparations SET state='executing',confirmed_at=COALESCE(confirmed_at,$1)
      WHERE id=$2 AND state IN ('pending','executing')`, [new Date(now()).toISOString(), row.id]);
    // Target is re-derived from an allowlist, never loaded as executable authority from agent input.
    const response = await dispatch({ ...target, accountId, authorization: playerAuthorization,
      idempotencyKey: 'gateway-' + row.id });
    const result = { status: response.statusCode,
      ok: response.statusCode >= 200 && response.statusCode < 300,
      ...(response.error ? { error: response.error } : {}), deepLink: '/' };
    // Retryable failures keep the immutable command key. Terminal game refusals require a fresh preparation.
    const state = result.ok ? 'completed' : response.statusCode === 429 || response.error === 'contention' ? 'pending'
      : response.statusCode >= 500 || response.error === 'in_progress' ? 'executing' : 'refused';
    if (result.ok) {
      // A concurrent pre-execution throttle may have reset the row to pending while this
      // request committed. Committed success dominates any delayed refusal for the same key.
      await pool.query(`UPDATE agent_gateway_preparations SET state='completed',result_json=$1 WHERE id=$2 AND state<>'completed'`,
        [canonical(result), row.id]);
    } else await pool.query(`UPDATE agent_gateway_preparations SET state=$1,result_json=$2 WHERE id=$3 AND state='executing'`,
      [state, canonical(result), row.id]);
    return previewView(await loadPreparation(accountId, row.id), true);
  }
  async function activity(accountId) {
    const rows = (await pool.query(`SELECT r.*,c.provider,c.scopes_json,p.state AS confirmation_state
      FROM agent_gateway_requests r JOIN agent_gateway_connections c ON c.id=r.connection_id
      LEFT JOIN agent_gateway_preparations p ON p.id=r.preparation_id
      WHERE c.account_id=$1 ORDER BY r.created_at DESC,r.request_id LIMIT 100`, [accountId])).rows;
    return { activity: rows.map((row) => ({ agent: row.connection_id, provider: row.provider,
      capability: row.capability, timestamp: row.created_at, requestId: row.request_id,
      permissionScopes: JSON.parse(row.scopes_json), actionClass: row.action_class,
      confirmationRequired: ['PREPARE', 'COMMIT'].includes(row.action_class),
      confirmationState: row.confirmation_state || null, result: row.result_code, state: row.state })) };
  }
  // Transport reads and subscription preferences change no game state, but are still visible
  // in the player's activity log. No event payload or credential is retained in the audit row.
  async function observe(principal, capability, run) {
    const requestId = crypto.randomUUID();
    await pool.query(`INSERT INTO agent_gateway_requests
      (connection_id,request_id,request_hash,capability,action_class) VALUES ($1,$2,$3,$4,'READ')`,
    [principal.connectionId, requestId, hash(capability), capability]);
    try {
      const value = await run();
      await pool.query(`UPDATE agent_gateway_requests SET state='completed',completed_at=$1,result_code='ok'
        WHERE connection_id=$2 AND request_id=$3`, [new Date(now()).toISOString(), principal.connectionId, requestId]);
      return value;
    } catch (error) {
      await pool.query(`UPDATE agent_gateway_requests SET state='failed',completed_at=$1,result_code='transport_failed'
        WHERE connection_id=$2 AND request_id=$3`, [new Date(now()).toISOString(), principal.connectionId, requestId]);
      throw error;
    }
  }
  return { execute, confirm, activity, observe,
    capabilities: (principal) => capabilities.filter((c) => c.scopes.every((scope) => principal.scopes.includes(scope))),
    preparation: async (accountId, id) => previewView(await loadPreparation(accountId, id), true),
  };
}
