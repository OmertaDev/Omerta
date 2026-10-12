import { publicMarketFeed } from '../marketfeed.js';

export function register(app, { pool }) {
  app.get('/v1/market/feed', req => publicMarketFeed(pool, req.query));
}
