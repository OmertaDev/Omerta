import { saleAttributionAction, saleAttributionBoard } from './saleattribution.js';
import { GameError } from './game.js';
import { withItemRead, withItemTransaction } from './items.js';

export function register(app, { pool, auth }) {
  if (typeof pool?.connect !== 'function' || typeof auth !== 'function') throw Error('Sale attribution requires canonical transactions and authentication.');
  app.get('/v1/sale-attribution', { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).some(key => key !== 'after')) throw new GameError('sale_attribution', 'terms');
    return withItemRead(pool, c => saleAttributionBoard(c, req.user.sub, req.query?.after ?? ''));
  });
  for (const action of ['open', 'accept', 'attribute', 'buy', 'cancel', 'expire']) {
    app.post('/v1/sale-attribution/' + action, { preHandler: auth }, req =>
      withItemTransaction(pool, c => saleAttributionAction(c, req.user.sub, action, req.body, req.headers['idempotency-key'])));
  }
}
