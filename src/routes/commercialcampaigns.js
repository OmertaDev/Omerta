import { GameError } from '../game.js';
import { withItemRead } from '../items.js';
import { COMMERCIAL_CAMPAIGN_ACTIONS } from '../commercialcampaigns-contracts.js';
import { commercialCampaignAction, commercialCampaignBoard } from '../commercialcampaigns.js';

export function register(app, { pool, auth }) {
  if (typeof pool?.connect !== 'function' || typeof auth !== 'function') throw Error('Commercial campaigns require canonical authenticated transactions.');
  const base = '/v1/company/commercial-campaigns';
  app.get(base, { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).some(key => key !== 'after')) throw new GameError('commercial_campaign', 'terms');
    return withItemRead(pool, c => commercialCampaignBoard(c, req.user.sub, req.query?.after ?? ''));
  });
  for (const action of COMMERCIAL_CAMPAIGN_ACTIONS) app.post(base + '/' + action, { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).length) throw new GameError('commercial_campaign', 'terms');
    return commercialCampaignAction(pool, req.user.sub, action, req.body, req.headers['idempotency-key'],
      { agentCredential: req.user.agent === true });
  });
}
