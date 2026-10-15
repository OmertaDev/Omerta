import { GameError } from '../game.js';
import { atomicBarterAction, ownAtomicBarterBoard } from '../atomicbarter.js';

export function register(app, { pool, auth }) {
  const noQuery = async req => { if (Object.keys(req.query || {}).length) throw new GameError('atomic_barter','terms'); };
  const key = req => req.headers['idempotency-key'];
  const base = '/v1/items/barter';
  app.get(base, { preHandler: [auth,noQuery] }, req => ownAtomicBarterBoard(pool,req.user.sub));
  for (const action of ['create','accept','cancel']) {
    app.post(base + '/' + action, { preHandler: [auth,noQuery] }, req => atomicBarterAction(pool,req.user.sub,action,req.body,key(req)));
  }
}
