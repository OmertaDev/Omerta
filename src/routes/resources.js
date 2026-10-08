import { ResourceProviderError } from '../resourceproviders.js';
import { resourceAccounting, setResourcePolicy, resourceEnabled, resourceError } from '../resourcebook.js';
import { resourceComputeCatalog, resourceComputeState, runResourceCompute, reconcileResourceCompute,
  resourceAuctionBoard, createResourceRound, commitResourceBid, revealResourceBid, settleResourceRound } from '../resourcecompute.js';
import { createResourceFunding, settleResourcePayment } from '../resourcepayments.js';
import { setResourceService, resourceServiceBoard, listResourceJobs, createResourceJob, claimResourceJob,
  workResourceJob, acceptResourceJob, disputeResourceJob, adjudicateResourceJob } from '../resourcework.js';

export function register(app, { pool, auth, modAuth }) {
  const ownerOnly = async req => {
    if (req.user.agent === true) throw resourceError('owner_authority', 'Use the separate owner session to approve external spending, funding or a paid service.');
  };
  app.get('/v1/resources/catalog', async () => ({ enabled: resourceEnabled(), capabilities: resourceComputeCatalog() }));
  app.get('/v1/resources/services', async () => ({ enabled: resourceEnabled(), ...await resourceServiceBoard(pool) }));
  app.get('/v1/resources/auctions', async () => resourceAuctionBoard(pool));
  app.get('/v1/resources', { preHandler: auth }, async req => ({
    enabled: resourceEnabled(), accounting: await resourceAccounting(pool, req.user.sub),
    ...await resourceComputeState(pool, req.user.sub), ...await listResourceJobs(pool, req.user.sub)
  }));
  app.get('/v1/resources/policy', { preHandler: auth }, async req => ({
    policy: (await pool.query('SELECT revision,enabled,providers,max_per_call,max_per_day,minimum_reserve,allow_stored_responses,expires_at FROM resource_compute_policies WHERE account_id=$1', [req.user.sub])).rows[0] || null
  }));
  app.post('/v1/resources/policy', { preHandler: [auth, ownerOnly] }, async req => setResourcePolicy(pool, req.user.sub, req.body));
  app.get('/v1/resources/funding', { preHandler: auth }, async req => ({
    payments: (await pool.query('SELECT id,state,amount_usd_micros,mode,checkout_url,created_at,settled_at FROM resource_payments WHERE account_id=$1 ORDER BY created_at DESC LIMIT 100', [req.user.sub])).rows
  }));
  app.post('/v1/resources/funding', { preHandler: [auth, ownerOnly] }, async req => createResourceFunding(pool, req.user.sub, req.body));
  app.post('/v1/resources/service', { preHandler: [auth, ownerOnly] }, async req => setResourceService(pool, req.user.sub, req.body));
  app.get('/v1/resources/compute', { preHandler: auth }, async req => resourceComputeState(pool, req.user.sub));
  app.post('/v1/resources/compute', { preHandler: auth }, async req => {
    if (req.body?.purpose?.kind === 'paid_market_analysis') throw resourceError('purpose', 'Paid service work must use its assigned job endpoint.');
    return runResourceCompute(pool, req.user.sub, req.body);
  });
  app.post('/v1/resources/compute/:id/reconcile', { preHandler: auth }, async req =>
    reconcileResourceCompute(pool, req.user.sub, req.params.id, req.body?.providerRequestId));
  app.get('/v1/resources/jobs', { preHandler: auth }, async req => listResourceJobs(pool, req.user.sub));
  app.post('/v1/resources/jobs', { preHandler: auth }, async req => createResourceJob(pool, req.user.sub, req.body));
  app.post('/v1/resources/jobs/:id/claim', { preHandler: auth }, async req => claimResourceJob(pool, req.user.sub, req.params.id));
  app.post('/v1/resources/jobs/:id/work', { preHandler: auth }, async req => workResourceJob(pool, req.user.sub, req.params.id, req.body));
  app.post('/v1/resources/jobs/:id/accept', { preHandler: auth }, async req => acceptResourceJob(pool, req.user.sub, req.params.id));
  app.post('/v1/resources/jobs/:id/dispute', { preHandler: auth }, async req => disputeResourceJob(pool, req.user.sub, req.params.id));
  app.get('/v1/resources/auctions/mine', { preHandler: auth }, async req => resourceAuctionBoard(pool, req.user.sub));
  app.post('/v1/resources/auctions/:id/commit', { preHandler: auth }, async req => commitResourceBid(pool, req.user.sub, req.params.id, req.body));
  app.post('/v1/resources/auctions/:id/reveal', { preHandler: auth }, async req => revealResourceBid(pool, req.user.sub, req.params.id, req.body));
  app.post('/v1/mod/resources/auctions', { preHandler: modAuth }, async req => createResourceRound(pool, req.body));
  app.post('/v1/mod/resources/auctions/:id/settle', { preHandler: modAuth }, async req => settleResourceRound(pool, req.params.id));
  app.post('/v1/mod/resources/jobs/:id/adjudicate', { preHandler: modAuth }, async req => adjudicateResourceJob(pool, req.params.id, req.body));
  // Signature verification needs exact bytes. The parser is confined to this
  // child plugin; all other JSON endpoints retain their normal object parser.
  app.register(async app => {
    app.removeContentTypeParser('application/json');
    app.addContentTypeParser('application/json', { parseAs: 'buffer', bodyLimit: 65536 }, (_req, body, done) => done(null, body));
    app.post('/v1/resources/payments/webhook', { bodyLimit: 65536 }, async (req, reply) => {
      try { return await settleResourcePayment(pool, req.body, req.headers['stripe-signature']); }
      catch (error) {
        if (error instanceof ResourceProviderError) return reply.code(error.code === 'provider_unconfigured' ? 503 : 400).send({ error: `resource_${error.code}` });
        throw error;
      }
    });
  });
}
