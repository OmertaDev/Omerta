import assert from 'node:assert/strict';
import crypto from 'node:crypto';
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.MARKET_FEED_TEST_DATABASE_URL || 'http://missing');
  assert(url.protocol === 'postgresql:' && url.hostname === '127.0.0.1'
    && /^\/market_feed_api_[a-z0-9_]+$/.test(url.pathname) && !url.search && !url.hash
    && ((url.port === '35439' && url.username === 'pilot_runner' && !url.password)
      || (url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck')),
  'Use a fresh isolated local market_feed_api_ PostgreSQL database');
  const { default: pg } = await import('pg');
  const preflight = new pg.Pool({ connectionString: url.href });
  try { assert.equal((await preflight.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0); }
  finally { await preflight.end(); }
  process.env.DATABASE_URL = url.href; process.env.MARKET_SEED = 'market-feed-api-local-seed-only';
} else assert(!process.env.DATABASE_URL, 'Memory proof refuses ambient DATABASE_URL');
process.env.RATE_LIMIT = 'off'; process.env.JWT_SECRET = 'market-feed-api-local-secret-only';
process.env.MOD_KEY = 'market-feed-api-local-mod-only'; process.env.SOCIAL_VERIFY_MODE = 'off';
process.env.RESOURCE_ECONOMY = 'off'; process.env.DEPOT_PILOT = 'off';
const { buildServer } = await import('../src/server.js');
const { marketPrices } = await import('../src/streets.js');
const { canonicalBytes } = await import('../src/content/canonical.js');
const { priceBlock } = await import('../src/rules.js');
const app = await buildServer();
const originalQuery = app.pool.query.bind(app.pool);
try {
  await originalQuery('INSERT INTO goods_market_liquidity(good_id,district,price_block,bought,sold) VALUES($1,$2,$3,$4,$5)', ['gin','docks',priceBlock(),17,9]);
  const queries = [];
  app.pool.query = async (sql, args) => {
    assert(/^SELECT\s/.test(typeof sql === 'string' ? sql : sql.text), 'Public feed HTTP request performs no writes');
    queries.push(sql); return originalQuery(sql,args);
  };
  const response = await app.inject({ method: 'GET', url: '/v1/market/feed?districtId=docks&goodId=gin' });
  assert.equal(response.statusCode, 200, response.body);
  assert.equal(queries.length, 1, 'One canonical liquidity read supplies the public projection');
  const feed = response.json(), canonical = await marketPrices(app.pool, feed.priceBlock);
  assert.deepEqual(feed.data, { unitPrice: canonical.goods.docks.gin,
    availableStock: canonical.liquidity.districts.docks.gin.stock,
    buyingDemand: canonical.liquidity.districts.docks.gin.buying });
  assert.equal(feed.source, '/v1/market/prices'); assert.equal(feed.paymentRequired, false);
  assert.equal(feed.financialActivation, false); assert.equal(feed.refreshAt, canonical.liquidity.refreshAt);
  assert.equal(priceBlock(Date.parse(feed.observedAt)), feed.priceBlock);
  const { sourceHash, ...payload } = feed;
  assert.equal(sourceHash, crypto.createHash('sha256').update(canonicalBytes(payload)).digest('hex'));
  assert.deepEqual(Object.keys(feed).sort(), ['schema','source','observedAt','priceBlock','refreshAt','scope','data','paymentRequired','financialActivation','sourceHash'].sort());
  for (const suffix of ['', '?districtId=docks', '?districtId=docks&goodId=other',
    '?districtId=unknown&goodId=gin', '?districtId=docks&goodId=gin&accountId=private',
    '?districtId=docks&goodId=gin&block=1', '?districtId=docks&goodId=gin&goodId=gin',
    '?districtId=docks&goodId=gin&ownerToken=private']) {
    const before = queries.length;
    const rejected = await app.inject({ method: 'GET', url: '/v1/market/feed'+suffix });
    assert.equal(rejected.statusCode, 400, rejected.body);
    assert.equal(rejected.json().error, 'market_feed');
    assert.equal(queries.length, before, 'Unsupported filters reject before accessing any source');
  }
  const spec = (await app.inject({ method: 'GET', url: '/openapi.json' })).json();
  assert.equal(spec.paths['/v1/market/feed'].get.operationId, 'getPublicGameMarketFeed');
  assert(!spec.paths['/v1/market/feed'].get.security?.length, 'Public feed discovery requires no account credentials');
  const parameters = spec.paths['/v1/market/feed'].get.parameters;
  assert.deepEqual(parameters.map(parameter => parameter.name).sort(), ['districtId','goodId']);
  assert(parameters.every(parameter => parameter.in === 'query' && parameter.required === true && parameter.schema.type === 'string'));
  const { DISTRICTS } = await import('../src/rules.js');
  assert.deepEqual(parameters.find(parameter => parameter.name === 'districtId').schema.enum, DISTRICTS.map(district => district.id));
  const good = parameters.find(parameter => parameter.name === 'goodId').schema;
  assert(good.const === 'gin' || (good.enum?.length === 1 && good.enum[0] === 'gin'));
  assert.deepEqual((await originalQuery('SELECT bought,sold FROM goods_market_liquidity')).rows, [{bought:17,sold:9}]);
  console.log(`public market feed API ${native ? 'PostgreSQL' : 'memory'} tests passed`);
} finally { app.pool.query = originalQuery; await app.close(); }
