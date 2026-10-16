import * as C from '../collaterallending.js';
import { GameError } from '../game.js';

export function register(app, { pool, auth }) {
  if (typeof auth !== 'function' || typeof pool?.connect !== 'function') throw Error('Collateral lending requires canonical authentication and database custody.');
  const base = '/v1/loans/equipment';
  const query = req => { if (Object.keys(req.query || {}).length) throw new GameError('collateral_lending', 'terms'); };
  app.get(base + '/availability', { preHandler: auth }, req => { query(req); return C.collateralLendingAvailability(); });
  app.get(base, { preHandler: auth }, req => { query(req); return C.collateralLendingBoard(pool, req.user.sub); });
  app.post(base + '/quote', { preHandler: auth }, req => { query(req); return C.collateralLendingQuote(pool, req.user.sub, req.body); });
  for (const action of ['pledge', 'repay', 'release']) app.post(base + '/' + action, { preHandler: auth }, req => {
    query(req); return C.collateralLendingAction(pool, req.user.sub, action, req.body, req.headers['idempotency-key']);
  });
}
