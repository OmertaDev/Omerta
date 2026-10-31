import assert from 'node:assert/strict';

assert(!process.env.DATABASE_URL, 'Business desk tests refuse ambient database endpoints.');
const native = process.argv.includes('--postgres');
if (native) {
  const url = new URL(process.env.BUSINESS_DESK_API_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  assert(!url.search && !url.hash); assert.match(url.pathname, /^\/business_desk_api_test_[a-z0-9_]+$/);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href });
  await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY');
    assert.match((await pre.query('SHOW server_version')).rows[0].server_version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on',
  DEPOT_PILOT: 'off', CHAIN_ENABLED: 'off', RESOURCE_ECONOMY: 'off', RESOURCE_COMPUTE_ENABLED: 'off', RESOURCE_PAYMENTS_MODE: 'test',
  // Explicit disposable-fixture identity; production legal preflight remains enabled.
  LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City',
  PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent',
  DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City',
  DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true', PAYMENT_REFUND_POLICY: 'Test fixture policy; not a production policy.',
  JWT_SECRET: 'business-desk-owned-fixture-secret', MARKET_SEED: 'business-desk-owned-fixture-market-seed', MOD_KEY: 'business-desk-owned-fixture-moderator' });
const { buildServer } = await import('./server-fixture.js');
const app = await buildServer(), pool = app.pool, base = '/v1/company/desk';
async function guest(name) {
  const response = await app.inject({ method: 'POST', url: '/v1/auth/guest', payload: {} });
  assert.equal(response.statusCode, 200, response.body);
  const token = response.json().token, account = app.jwt.decode(token).sub;
  if (!name) return { token, account };
  const birth = await app.inject({ method: 'POST', url: '/v1/character', payload: { name }, headers: { authorization: 'Bearer ' + token } });
  assert.equal(birth.statusCode, 200, birth.body);
  return { token, account, id: (await pool.query('SELECT id FROM characters WHERE account_id=$1 AND alive', [account])).rows[0].id };
}
const read = (player, query = '') => app.inject({ method: 'GET', url: base + query,
  headers: player ? { authorization: 'Bearer ' + player.token } : {} });
const ok = async (player, query = '') => { const response = await read(player, query); assert.equal(response.statusCode, 200, response.body); return response; };
const stamp = ordinal => new Date(Date.UTC(2026, 0, 1, 0, 0, ordinal));
async function transaction(id, character, amount, reason, ordinal, currency = 'cash', account = null, counterparty = null) {
  await pool.query('INSERT INTO transactions(id,at,character_id,account_id,currency,amount,reason,counterparty) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',
    [id, stamp(ordinal), character, account, currency, amount, reason, counterparty]);
}
const state = async () => ({ characters: (await pool.query('SELECT * FROM characters ORDER BY id')).rows,
  accounts: (await pool.query('SELECT * FROM account_persistent ORDER BY account_id')).rows,
  ledger: (await pool.query('SELECT * FROM transactions ORDER BY id')).rows,
  profiles: (await pool.query('SELECT * FROM agent_company_profiles ORDER BY account_id')).rows,
  depots: (await pool.query('SELECT * FROM business_depots ORDER BY id')).rows });
try {
  assert.equal((await read(null)).statusCode, 401);
  const owner = await guest('Desk Reader'), other = await guest('Desk Other'), empty = await guest();
  assert.equal((await read(empty)).statusCode, 400);
  const key = await app.inject({ method: 'POST', url: '/v1/auth/agent-key', payload: {}, headers: { authorization: 'Bearer ' + owner.token } });
  assert.equal(key.statusCode, 200, key.body); const agent = { ...owner, token: key.json().token };
  await pool.query('UPDATE characters SET cash=$2,bank=$3,last_accrued_at=$4 WHERE id=$1', [owner.id, '1234.5', '500.25', new Date(0)]);
  await pool.query("INSERT INTO characters(id,account_id,name,season,alive,cash) VALUES('desk-old-character',$1,'Old Desk Reader',1,false,500)", [owner.account]);
  // Synthetic ledger fixtures test projection and privacy; they are not earned income.
  const entries = [
    ['desk-sale', '1000.25', 'consignment:proceeds'], ['desk-craft', '-300.125', 'craft:recipe:hardened_steel'],
    ['desk-buy', '-200', 'market:bid'], ['desk-reserve', '-20', 'multi_hop_courier:reserve'],
    ['desk-refund', '5.875', 'multi_hop_courier:refund'], ['desk-travel', '-50', 'travel'],
    ['desk-fund', '-100', 'depot:fund'], ['desk-withdraw', '100', 'depot:withdraw'], ['desk-zero', '0', 'consignment:host_fee'],
  ];
  for (const [index, [id, amount, reason]] of entries.entries()) await transaction(id, owner.id, amount, reason, index + 1);
  await transaction('desk-foreign', other.id, '9000', 'consignment:proceeds', 50, 'cash', null, 'foreign-private-contract');
  await transaction('desk-old', 'desk-old-character', '5000', 'consignment:proceeds', 50);
  await transaction('desk-house', null, '5000', 'consignment:proceeds', 50);
  await transaction('desk-account', null, '5000', 'consignment:proceeds', 50, 'cash', owner.account);
  await transaction('desk-omr', owner.id, '5000', 'consignment:proceeds', 50, 'omr');
  await transaction('desk-other-reason', owner.id, '5000', 'crime:fixture', 50);
  await transaction('desk-unknown-reason', owner.id, '5000', 'consignment:unrecognized', 50);
  const before = await state(), response = await ok(owner), board = response.json();
  assert.match(response.headers['cache-control'], /private, no-store/);
  assert.equal(board.currency, 'game_cash'); assert.equal(board.character.cash, '1234.5'); assert.equal(board.character.bank, '500.25');
  assert.equal(board.character.id, owner.id); assert.equal(board.cashflow.scope, 'current_character_selected_business_and_travel');
  assert.equal(board.cashflow.totalsScope, 'returned_rows'); assert.equal(board.cashflow.limit, 20);
  assert.equal(board.cashflow.returned, 9); assert.equal(board.cashflow.hasMore, false);
  assert.equal(board.cashflow.income, '1106.125'); assert.equal(board.cashflow.outflow, '670.125'); assert.equal(board.cashflow.netCashflow, '436');
  assert.deepEqual(board.cashflow.rows.map(row => row.id), entries.map(entry => entry[0]).reverse());
  assert.deepEqual([...new Set(board.cashflow.rows.map(row => row.category))].sort(), ['business_transfer', 'consignment', 'courier', 'market', 'production', 'travel']);
  assert.match(board.cashflow.measurement, /not accounting profit/);
  assert(!JSON.stringify(board).includes('foreign-private-contract')); assert(!JSON.stringify(board).includes('desk-old-character'));
  const agentBoard = (await ok(agent)).json(); assert.deepEqual(agentBoard.character, board.character); assert.deepEqual(agentBoard.cashflow, board.cashflow);
  const small = (await ok(owner, '?limit=3')).json().cashflow;
  assert.equal(small.returned, 3); assert.equal(small.hasMore, true);
  assert.deepEqual([small.income, small.outflow, small.netCashflow], ['100', '100', '0']);
  const foreign = (await ok(other)).json(); assert.deepEqual(foreign.cashflow.rows.map(row => row.id), ['desk-foreign']);
  for (const query of ['?limit=0', '?limit=51', '?limit=1.5', '?limit=01', '?limit=1e1', '?limit=1&limit=2',
    '?characterId=' + other.id, '?accountId=' + other.account, '?currency=omr', '?after=other', '?limit=2&unknown=1']) {
    const refused = await read(owner, query); assert.equal(refused.statusCode, 400, refused.body); assert.equal(refused.json().error, 'business_desk');
  }
  assert.deepEqual(await state(), before, 'All successful and refused reads leave balances, accrual clocks, ledger, company and depot tables unchanged.');
  for (let index = 0; index < 52; index++) await transaction('desk-page-' + String(index).padStart(2, '0'), owner.id, '0.01', 'consignment:proceeds', 100 + index);
  const page = (await ok(owner)).json().cashflow, maximum = (await ok(owner, '?limit=50')).json().cashflow;
  assert.equal(page.returned, 20); assert.equal(page.hasMore, true); assert.equal(page.income, '0.2'); assert.equal(page.netCashflow, '0.2');
  assert.equal(maximum.returned, 50); assert.equal(maximum.hasMore, true); assert.equal(maximum.income, '0.5');
  if (native) {
    await pool.query('UPDATE characters SET cash=$2,bank=$3 WHERE id=$1', [owner.id, '9007199254740993.125', '0.000000000000000001']);
    await transaction('desk-precise-in', owner.id, '9007199254740993.125', 'consignment:proceeds', 200);
    await transaction('desk-precise-out', owner.id, '-9007199254740993.124', 'market:bid', 201);
    const exact = (await ok(owner, '?limit=2')).json();
    assert.equal(exact.character.cash, '9007199254740993.125'); assert.equal(exact.character.bank, '0.000000000000000001');
    assert.equal(exact.cashflow.income, '9007199254740993.125'); assert.equal(exact.cashflow.outflow, '9007199254740993.124'); assert.equal(exact.cashflow.netCashflow, '0.001');
  }
  await pool.query('UPDATE accounts SET token_version=token_version+1 WHERE id=$1', [owner.account]);
  assert.equal((await read(agent)).statusCode, 401);
  assert.equal(process.env.RESOURCE_ECONOMY, 'off'); assert.equal(process.env.RESOURCE_COMPUTE_ENABLED, 'off'); assert.equal(process.env.CHAIN_ENABLED, 'off');
  console.log(`business desk registered API ${native ? 'native' : 'memory'} PASS: actual human/agent authentication, actor-only cash history, exact page totals, limits, privacy and no accrual/writes with financial activation off.`);
} finally { await app.close(); await pool.end(); }
