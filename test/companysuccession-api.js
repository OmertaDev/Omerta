import assert from 'node:assert/strict';

const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.COMPANY_SUCCESSION_TEST_DATABASE_URL || 'http://missing');
  assert(url.protocol === 'postgresql:' && url.hostname === '127.0.0.1'
    && /^\/company_succession_api_[a-z0-9_]+$/.test(url.pathname) && !url.search && !url.hash
    && ((url.port === '35439' && url.username === 'pilot_runner' && url.password === '')
      || (url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck')),
  'Use an isolated local company_succession_api_ PostgreSQL database');
  const { default: pg } = await import('pg');
  const check = new pg.Pool({ connectionString: url.href });
  try { assert.equal((await check.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0); }
  finally { await check.end(); }
  process.env.DATABASE_URL = url.href;
  process.env.MARKET_SEED = 'company-succession-api-local-seed';
} else assert(!process.env.DATABASE_URL, 'Memory proof refuses ambient DATABASE_URL');
process.env.RATE_LIMIT = 'off'; process.env.SOCIAL_VERIFY_MODE = 'off'; process.env.DEPOT_PILOT = 'on';
process.env.JWT_SECRET = 'company-succession-api-local-test-secret'; process.env.MOD_KEY = 'company-succession-api-local-mod';
const { buildServer } = await import('../src/server.js');
const { ledger } = await import('../src/game.js');
const app = await buildServer();
// pg-mem misuses the open-only partial index for closed history. Native keeps it.
if (!native) await app.pool.query('DROP INDEX ix_depot_owner_open');
let serial = 0;
const call = async (method, url, player, body, key = `succession-api-${++serial}`) => {
  const response = await app.inject({ method, url, payload: body,
    headers: { ...(player ? { authorization: `Bearer ${player.token}` } : {}),
      ...(key === null ? {} : { 'idempotency-key': key }) } });
  return { code: response.statusCode, body: response.json() };
};
const balance = async p => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash);
const setCash = async (p, value) => {
  const before = await balance(p);
  await app.pool.query('UPDATE characters SET cash=$2,last_accrued_at=$3 WHERE id=$1', [p.id, value, new Date(Date.now() + 3600000)]);
  await ledger(app.pool, { characterId: p.id, currency: 'cash', amount: value - before, reason: 'crime:succession-api-fixture' });
};
const player = async () => {
  const ownerToken = (await call('POST', '/v1/auth/guest')).body.token;
  const token = (await call('POST', '/v1/auth/agent-key', { token: ownerToken })).body.token;
  const p = { token, ownerToken };
  assert.equal((await call('POST', '/v1/character', p, { name: `Company Successor ${++serial}` })).code, 200);
  p.id = (await call('GET', '/v1/me', p)).body.character.id;
  p.account = JSON.parse(Buffer.from(ownerToken.split('.')[1], 'base64url').toString()).sub;
  await setCash(p, 50000.5);
  return p;
};
const kill = async p => {
  const result = await app.inject({ method: 'POST', url: '/v1/mod/kill',
    payload: { characterId: p.id }, headers: { 'x-mod-key': process.env.MOD_KEY } });
  assert.equal(result.statusCode, 200, result.body);
  const heir = (await call('GET', '/v1/me', p)).body.character;
  assert.notEqual(heir.id, p.id);
  const next = { ...p, id: heir.id }; await setCash(next, 5000.5);
  return next;
};
const config = { salePrice: 2000, bidPrice: 500, targetStock: 4, reorderAt: 0, restockBudget: 3000 };
const prepare = async () => {
  const founder = await player();
  // Owned premises fixture only; succession eligibility is an actual canonical
  // depot opening and MOD estate, never a fabricated death journal/receipt.
  await app.pool.query('INSERT INTO estates(account_id,tier) VALUES($1,1)', [founder.account]);
  const profile = await call('POST', '/v1/resources/company', { ...founder, token: founder.ownerToken },
    { expectedRevision: 0, name: 'Continuing API Company', published: true, premises: 'estate' });
  assert.equal(profile.code, 200, JSON.stringify(profile.body));
  const opened = await call('POST', '/v1/depot', founder, config);
  assert.equal(opened.code, 200, JSON.stringify(opened.body));
  const heir = await kill(founder);
  const old = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [opened.body.id])).rows[0];
  assert.equal(old.status, 'closed'); assert.equal(Number(old.treasury), 0);
  assert.equal(Number(old.stock), 0); assert.equal(Number(old.stock_cost), 0);
  assert((await app.pool.query("SELECT id FROM business_depot_journal WHERE depot_id=$1 AND reason='death'", [old.id])).rows.length);
  return { founder, heir, old, body: { expectedCompanyRevision: 1, predecessorCharacterId: founder.id,
    maxOpeningCash: 5000, consent: true } };
};
try {
  assert.equal((await call('GET', '/v1/company-succession')).code, 401);
  assert.equal((await call('POST', '/v1/company-succession', null, {})).code, 401);
  const f = await prepare(), outsider = await player();
  assert.deepEqual((await call('GET', '/v1/company-succession', f.heir)).body.succession, []);
  for (const body of [{ ...f.body, consent: false }, { ...f.body, accountId: outsider.account },
    { ...f.body, ownerToken: f.founder.ownerToken }, { ...f.body, maxOpeningCash: 4999 },
    { ...f.body, expectedCompanyRevision: 2 }, { ...f.body, predecessorCharacterId: outsider.id }]) {
    const rejected = await call('POST', '/v1/company-succession', f.heir, body);
    assert(rejected.code >= 400 && rejected.code < 500, JSON.stringify(rejected));
    assert.equal(await balance(f.heir), 5000.5);
  }
  assert((await call('POST', '/v1/company-succession', f.heir, f.body, null)).code >= 400);
  assert((await call('POST', '/v1/company-succession', outsider, f.body)).code >= 400);
  process.env.DEPOT_PILOT = 'off';
  assert((await call('POST', '/v1/company-succession', f.heir, f.body)).code >= 400);
  assert.equal(await balance(f.heir), 5000.5);
  process.env.DEPOT_PILOT = 'on';
  const resumed = await call('POST', '/v1/company-succession', { ...f.heir, token: f.heir.ownerToken }, f.body, 'company-human-resume');
  assert.equal(resumed.code, 200, JSON.stringify(resumed.body));
  assert.equal(resumed.body.succession.openingCash, 5000);
  assert.equal(await balance(f.heir), 0.5, 'Canonical opening preserves fractional remaining cash');
  const depot = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [resumed.body.succession.depotId])).rows[0];
  assert.notEqual(depot.id, f.old.id); assert.equal(depot.owner_character, f.heir.id);
  assert.equal(depot.status, 'open'); assert.equal(Number(depot.treasury), 0); assert.equal(Number(depot.stock), 0);
  const opening = (await app.pool.query("SELECT amount FROM transactions WHERE character_id=$1 AND reason='depot:open'", [f.heir.id])).rows;
  assert.deepEqual(opening.map(row => Number(row.amount)), [-5000], 'Exactly one canonical opening sink');
  assert.equal(resumed.body.company.revision, 2);
  assert.equal((await app.pool.query('SELECT revision FROM agent_company_profiles WHERE account_id=$1', [f.heir.account])).rows[0].revision, 2);
  const retry = await call('POST', '/v1/company-succession', f.heir, f.body, 'company-human-resume');
  assert.equal(retry.code, 200); assert.deepEqual(retry.body.succession, resumed.body.succession);
  assert.equal(await balance(f.heir), 0.5);
  assert((await call('POST', '/v1/company-succession', f.heir, { ...f.body, consent: false }, 'company-human-resume')).code >= 400);
  const own = await call('GET', '/v1/company-succession', f.heir);
  assert.equal(own.body.succession.length, 1);
  assert.deepEqual(own.body.succession[0].succession, resumed.body.succession);
  assert.deepEqual(own.body.succession[0].depot, resumed.body.depot);
  assert.deepEqual((await call('GET', '/v1/company-succession', { ...f.heir, token: f.heir.ownerToken })).body, own.body);
  assert.deepEqual((await call('GET', '/v1/company-succession', outsider)).body.succession, []);
  const oldAfter = (await app.pool.query('SELECT * FROM business_depots WHERE id=$1', [f.old.id])).rows[0];
  assert.deepEqual(oldAfter, f.old, 'Historical destroyed predecessor assets are not resurrected');
  const later = await kill(f.heir), beforeLater = await balance(later);
  // Evict only the HTTP response cache to prove the durable native receipt,
  // rather than infer library recovery from a cached transport response.
  await app.pool.query('DELETE FROM idempotency WHERE account_id=$1 AND key=$2', [later.account, 'company-human-resume']);
  process.env.DEPOT_PILOT = 'off';
  const laterRetry = await call('POST', '/v1/company-succession', later, f.body, 'company-human-resume');
  assert.equal(laterRetry.code, 200);
  assert.equal(laterRetry.body.replayed, true, 'Native receipt survives HTTP cache eviction and later estate');
  assert.deepEqual(laterRetry.body.succession, resumed.body.succession);
  assert.equal(await balance(later), beforeLater, 'Later generation OFF replay never opens or spends');
  process.env.DEPOT_PILOT = 'on';
  const g = await prepare();
  const agentResume = await call('POST', '/v1/company-succession', g.heir, g.body, 'company-agent-resume');
  assert.equal(agentResume.code, 200, JSON.stringify(agentResume.body));
  assert.equal(await balance(g.heir), 0.5, 'Agent executes the same canonical opening as human');
  const spec = (await call('GET', '/openapi.json')).body;
  assert.equal(spec.paths['/v1/company-succession'].get.operationId, 'getOwnGameCompanySuccession');
  assert(spec.paths['/v1/company-succession'].post.security.length);
  const { companySuccessionFaults } = await import('../src/companysuccessioninvariants.js');
  assert.equal(await companySuccessionFaults(app.pool), 0);
  const stored = (await app.pool.query('SELECT * FROM company_succession_receipts WHERE id=$1', [resumed.body.succession.id])).rows[0];
  await app.pool.query('UPDATE company_succession_receipts SET request_terms=$2 WHERE id=$1',
    [stored.id, { ...stored.request_terms, consent: false }]);
  assert(await companySuccessionFaults(app.pool) > 0);
  await app.pool.query('UPDATE company_succession_receipts SET request_terms=$2 WHERE id=$1', [stored.id, stored.request_terms]);
  assert.equal(await companySuccessionFaults(app.pool), 0);
  await app.pool.query('UPDATE company_succession_receipts SET receipt=$2 WHERE id=$1',
    [stored.id, { ...stored.receipt, succession: { ...stored.receipt.succession, accountId: outsider.account } }]);
  assert(await companySuccessionFaults(app.pool) > 0);
  await app.pool.query('UPDATE company_succession_receipts SET receipt=$2 WHERE id=$1', [stored.id, stored.receipt]);
  assert.equal(await companySuccessionFaults(app.pool), 0);
  const debit = (await app.pool.query("SELECT id FROM transactions WHERE reason='depot:open' AND counterparty=$1", [stored.depot_id])).rows[0];
  await app.pool.query('UPDATE transactions SET amount=-4999 WHERE id=$1', [debit.id]);
  assert(await companySuccessionFaults(app.pool) > 0);
  await app.pool.query('UPDATE transactions SET amount=-5000 WHERE id=$1', [debit.id]);
  assert.equal(await companySuccessionFaults(app.pool), 0);
  console.log(`company succession API ${native ? 'PostgreSQL' : 'memory'} tests passed`);
} finally { process.env.DEPOT_PILOT = 'on'; await app.close(); }
