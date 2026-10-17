import { GameError } from './game.js';
import { withItemRead, withItemTransaction } from './items.js';
import { shoppingBasketAction, shoppingBasketBoard } from './shoppingbasket.js';
export function register(app, { pool, auth }) {
  if (typeof pool?.connect !== 'function' || typeof auth !== 'function') throw Error('Shopping baskets require canonical transactions and authentication.');
  app.get('/v1/items/shopping-baskets', { preHandler: auth }, req => {
    if (Object.keys(req.query || {}).length) throw new GameError('shopping_basket', 'terms');
    return withItemRead(pool, c => shoppingBasketBoard(c, req.user.sub));
  });
  for (const action of ['quote', 'checkout', 'cancel']) app.post('/v1/items/shopping-baskets/' + action, { preHandler: auth }, req =>
    withItemTransaction(pool, c => shoppingBasketAction(c, req.user.sub, action, req.body, req.headers['idempotency-key'])));
}
