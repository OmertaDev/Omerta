import { GameError } from '../game.js';
import { withItemTransaction } from '../items.js';
import { companyProductionBoard, runCompanyProduction } from '../companyproduction.js';

export function register(app, { pool, auth, beforeCraft }) {
  if (typeof auth !== 'function' || typeof pool?.connect !== 'function') throw new Error('Company production requires authenticated canonical item transactions.');
  app.get('/v1/company/production', { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).some(key => key !== 'after')) throw new GameError('company_production', 'terms');
    return withItemTransaction(pool, client => companyProductionBoard(client, req.user.sub, req.query?.after ?? null));
  });
  app.post('/v1/company/production/run', { preHandler: auth }, req => withItemTransaction(pool,
    client => runCompanyProduction(client, req.user.sub, req.body, req.headers['idempotency-key'], { beforeCraft, agentCredential: req.user.agent === true })));
}
