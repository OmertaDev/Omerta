import * as A from '../collateralauction.js';
import { GameError } from '../game.js';
export function register(app, { pool, auth }) {
  if (typeof auth !== 'function' || typeof pool?.connect !== 'function') throw Error('Collateral auctions require canonical authentication and custody.');
  const base = '/v1/loans/equipment/auctions';
  const query = req => { if (Object.keys(req.query || {}).length) throw new GameError('collateral_auction', 'terms'); };
  app.get(base + '/availability', { preHandler: auth }, req => { query(req); return A.collateralAuctionAvailability(); });
  app.get(base, { preHandler: auth }, req => { query(req); return A.collateralAuctionBoard(pool, req.user.sub); });
  for (const action of ['prepare', 'approve', 'open', 'bid', 'settle', 'refund', 'cancel']) app.post(base + '/' + action, { preHandler: auth }, req => {
    query(req); return A.collateralAuctionAction(pool, req.user.sub, action, req.body, req.headers['idempotency-key']);
  });
}
