import { getAddress } from 'viem';
import {
  adminDefiActions, buildAdminDefiTransaction, buildDefiTransaction,
  makeDefiClient, readDefiSnapshot, unavailableDefiSnapshot,
} from '../defi.js';

// One short-lived shared snapshot protects the public RPC from a dashboard refresh stampede. Wallet
// projections are not cached here: they are address-specific and bounded to an explicit request.
export function register(app, { modAuth, env = process.env, client = null } = {}) {
  const publicClient = client || makeDefiClient(env);
  let baseCache = null;
  let basePending = null;

  const baseSnapshot = async () => {
    const now = Date.now();
    if (baseCache && baseCache.expiresAt > now) return baseCache.value;
    if (basePending) return basePending;
    basePending = readDefiSnapshot({ client: publicClient, env, now })
      .catch((error) => unavailableDefiSnapshot(error, { now }))
      .then((value) => {
        // Successful reads can be shared briefly. An outage is retried sooner so a transient RPC
        // failure does not stay painted across the public and operator dashboards.
        baseCache = { value, expiresAt: now + (value.status === 'unavailable' ? 3_000 : 12_000) };
        return value;
      }).finally(() => { basePending = null; });
    return basePending;
  };

  app.get('/v1/defi', async (req, reply) => {
    const account = req.query?.account;
    const projection = account
      ? await readDefiSnapshot({ account, client: publicClient, env }).catch((error) => unavailableDefiSnapshot(error))
      : await baseSnapshot();
    reply.header('cache-control', account ? 'public, max-age=5' : 'public, max-age=10, stale-while-revalidate=20');
    return projection;
  });

  // Public in the HTTP sense, but never a mutation: this prepares a fixed, allowlisted call and
  // simulates it from the supplied wallet. The wallet still presents, signs and sends the actual
  // transaction. Targets, selectors, value and chain cannot be nominated by the caller.
  app.post('/v1/defi/tx', async (req, reply) => {
    const body = req.body || {};
    let account;
    try { account = getAddress(body.account); }
    catch { return reply.code(400).send({ error: 'invalid_account', message: 'Connect a valid wallet first.' }); }
    let projection;
    try { projection = await readDefiSnapshot({ account, client: publicClient, env }); }
    catch (error) {
      return reply.code(503).header('retry-after', '5')
        .send({ error: 'defi_state_unavailable', message: 'Live chain state could not be verified. Try again.' });
    }
    const availability = projection.actions.items.find((item) => item.id === body.action);
    if (!availability) return reply.code(400).send({ error: 'unknown_defi_action' });
    if (!availability.enabled) return reply.code(409).send({
      error: 'defi_action_blocked', action: body.action, blockedBy: availability.blockedBy,
      snapshot: projection.snapshot,
    });
    let tx;
    try { tx = buildDefiTransaction(body, env); }
    catch (error) { return reply.code(400).send({ error: error.code || 'invalid_defi_input', field: error.detail || null }); }
    try {
      await publicClient.call({
        account, to: tx.to, data: tx.data, value: 0n,
        blockNumber: BigInt(projection.snapshot.blockNumber),
      });
    } catch (error) {
      // Contract revert details can contain implementation internals. The wallet gets a stable refusal
      // and the reviewed call summary, while server logs retain the ordinary request context.
      return reply.code(409).send({ error: 'defi_simulation_failed', action: body.action,
        message: 'The call would revert against the current confirmed state.', snapshot: projection.snapshot });
    }
    return { ...tx, account, snapshot: projection.snapshot,
      validUntil: new Date(Date.now() + 60_000).toISOString() };
  });

  app.get('/v1/mod/defi', { preHandler: modAuth }, async () => {
    const projection = await baseSnapshot();
    return {
      ...projection,
      operations: {
        chainConfigured: !!env.CHAIN_RPC_URL,
        liquidityAutomationEnabled: env.LIQUIDITY_AUTOMATION_ENABLED === 'on',
        genesisLaunchPhase: env.GENESIS_LAUNCH_PHASE || 'legacy',
        manifestPinnedForAutomation: !!(env.LIQUIDITY_AUTOMATION_MANIFEST_PATH
          && env.LIQUIDITY_AUTOMATION_MANIFEST_SHA256),
        sourceVerificationComplete: projection.acceptance.sourceVerifiedContracts === projection.contracts.length,
      },
      safeActions: adminDefiActions(),
      security: {
        signer: 'governance Safe only', threshold: 2,
        dashboardAuthority: 'prepare-only',
        note: 'The API has no Safe owner key and cannot sign or execute these calls.',
      },
    };
  });

  app.post('/v1/mod/defi/tx', { preHandler: modAuth }, async (req, reply) => {
    try { return buildAdminDefiTransaction(req.body?.action, env); }
    catch (error) { return reply.code(400).send({ error: error.code || 'invalid_defi_admin_action' }); }
  });
}

