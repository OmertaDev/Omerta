import * as G from '../game.js';
import * as Workflow from '../companyworkflows.js';

export function register(app, { pool, auth }) {
  app.get('/v1/company/workflows', { preHandler: auth }, req =>
    G.withCharacterReadLocked(pool, req.user.sub, async (ch, client) => ({ ok: true, workflows: await Workflow.companyWorkflowBoard(client, ch.account_id), limits: Workflow.COMPANY_WORKFLOW })));
  app.post('/v1/company/workflows', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Workflow.createCompanyWorkflow(ch, req.body, req.headers['idempotency-key'], client)));
  app.post('/v1/company/workflows/:id/advance', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client, h) => Workflow.advanceCompanyWorkflow(ch, req.params.id, req.body, req.headers['idempotency-key'], client, h)));
  app.post('/v1/company/workflows/:id/cancel', { preHandler: auth }, req =>
    G.withCharacter(pool, req.user.sub, (ch, client) => Workflow.cancelCompanyWorkflow(ch, req.params.id, req.body || {}, req.headers['idempotency-key'], client)));
}
