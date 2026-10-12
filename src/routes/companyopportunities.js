import * as G from '../game.js';
import * as Opportunities from '../companyopportunities.js';

export function register(app, { pool, auth }) {
  app.get('/v1/company/opportunities', { preHandler: auth }, req => G.readCharacter(pool, req.user.sub,
    (ch, client) => Opportunities.companyOpportunityInbox(ch, req.query || {}, client)));
  app.post('/v1/company/opportunities/subscription', { preHandler: auth }, req => G.withCharacter(pool, req.user.sub,
    (ch, client) => Opportunities.setCompanyOpportunitySubscription(ch, req.body, client)));
  app.post('/v1/company/opportunities/refresh', { preHandler: auth }, req => {
    if (req.body && Object.keys(req.body).length) throw new G.GameError('company_opportunity', 'terms');
    return G.withCharacter(pool, req.user.sub, (ch, client) => Opportunities.refreshCompanyOpportunities(ch, client));
  });
  app.post('/v1/company/opportunities/acknowledge', { preHandler: auth }, req => G.withCharacter(pool, req.user.sub,
    (ch, client) => Opportunities.acknowledgeCompanyOpportunity(ch, req.body, client)));
}
