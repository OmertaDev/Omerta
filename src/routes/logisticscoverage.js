import * as G from '../game.js';
import * as Coverage from '../logisticscoverage.js';

function emptyBody(body) {
  if (body != null && (typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length))
    throw new G.GameError('logistics_coverage', 'This action accepts no authority or payment fields.');
}

export function register(app, { pool, auth }) {
  app.get('/v1/logistics-coverage', { preHandler: auth }, async req =>
    G.readCharacter(pool, req.user.sub, async (ch, client) => ({ ok: true, policies: await Coverage.coverageBoard(client, req.user.sub) })));
  app.post('/v1/logistics-coverage/offers', { preHandler: auth }, async req => {
    const lease = (await pool.query('SELECT tenant_character FROM business_warehouse_leases WHERE id=$1', [req.body?.leaseId])).rows[0];
    if (!lease) throw new G.GameError('logistics_coverage', 'No warehouse lease.');
    return G.withTwoCharacters(pool, req.user.sub, lease.tenant_character, (insurer, tenant, client, h) =>
      Coverage.offerCoverage(insurer, tenant, req.body, req.headers['idempotency-key'], client, h), { meet: false });
  });
  app.post('/v1/logistics-coverage/:id/accept', { preHandler: auth }, async req => {
    emptyBody(req.body);
    const policy = (await pool.query('SELECT insurer_character,state FROM logistics_coverage_policies WHERE id=$1', [req.params.id])).rows[0];
    if (!policy) throw new G.GameError('logistics_coverage', 'No coverage offer.');
    if (policy.state !== 'offered') return G.withCharacter(pool, req.user.sub, (tenant, client, h) =>
      Coverage.acceptCoverage(tenant, null, req.params.id, client, h));
    return G.withTwoCharacters(pool, req.user.sub, policy.insurer_character, (tenant, insurer, client, h) =>
      Coverage.acceptCoverage(tenant, insurer, req.params.id, client, h), { meet: false });
  });
  for (const [action, command] of [['cancel', Coverage.cancelCoverage], ['claim', Coverage.claimCoverage], ['refund', Coverage.refundCoverage]]) {
    app.post(`/v1/logistics-coverage/:id/${action}`, { preHandler: auth }, async req => {
      emptyBody(req.body);
      return G.withCharacter(pool, req.user.sub, (actor, client, h) => command(actor, req.params.id, client, h));
    });
  }
}
