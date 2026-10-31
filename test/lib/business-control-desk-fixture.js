import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { adultAuthFixture } from '../auth-fixture.js';

export const PRODUCTION_STEPS = Object.freeze([
  Object.freeze({ recipeId: 'recipe:hardened_steel', repeat: 1 }),
  Object.freeze({ recipeId: 'recipe:precision_lock_tool', repeat: 1 }),
]);
export const SALVAGE_RECIPE = '/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/';
export const courierReference = row => ({ networkId: row.networkId, sourceHash: row.sourceHash, consent: true });
export const consignmentReference = row => ({ consignmentId: row.consignmentId, sourceHash: row.sourceHash, consent: true });

// Only the owner of the disposable database creates/drops it. This fixture never
// discovers a server, accepts ambient DATABASE_URL, or falls back from native mode.
async function nativeEndpoint() {
  assert(!process.env.DATABASE_URL, 'Refuse ambient DATABASE_URL.');
  if (!process.argv.includes('--postgres')) return null;
  assert(process.env.BUSINESS_CONTROL_DESK_TEST_DATABASE_URL, 'An explicitly owned disposable database is required.');
  const url = new URL(process.env.BUSINESS_CONTROL_DESK_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol));
  assert.equal(url.hostname, '127.0.0.1');
  assert(!url.search && !url.hash);
  assert.match(url.pathname, /^\/business_control_desk_test_[a-z0-9_]+$/);
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci, 'Refuse an unrecognized disposable database endpoint.');
  const { Pool } = await import('pg');
  const control = new Pool({ connectionString: url.href, max: 1 });
  try {
    const row = (await control.query("SELECT current_user AS role,current_setting('server_version') AS version,(SELECT pg_get_userbyid(datdba) FROM pg_database WHERE datname=current_database()) AS owner")).rows[0];
    assert.equal(row.role, url.username); assert.equal(row.owner, url.username);
    assert.match(row.version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await control.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0, 'Require a new, empty, owned fixture database.');
  } finally { await control.end(); }
  return url.href;
}

export async function businessDeskFixture(definitions) {
  const endpoint = await nativeEndpoint();
  for (const name of Object.keys(process.env)) {
    if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(name)) delete process.env[name];
  }
  Object.assign(process.env, {
    CHAIN_ENABLED: 'off', RESOURCE_ECONOMY: 'off', RESOURCE_COMPUTE_ENABLED: 'off', DEPOT_PILOT: 'on',
    POPULATION_OFF: 'on', RATE_LIMIT: 'off', INVITE_MODE: 'off', SOCIAL_VERIFY_MODE: 'off', STAT_USE_P: '0',
    LEGAL_OPERATOR_NAME: 'CI Test Operator', LEGAL_POSTAL_ADDRESS: '123 Fixture Street, Test City',
    PRIVACY_CONTACT_EMAIL: 'privacy@example.test', DMCA_AGENT_NAME: 'CI Test Agent',
    DMCA_AGENT_EMAIL: 'copyright@example.test', DMCA_AGENT_ADDRESS: '123 Fixture Street, Test City',
    DMCA_AGENT_PHONE: '+1 202 555 0100', DMCA_AGENT_REGISTERED: 'true', PAYMENT_REFUND_POLICY: 'Test fixture policy; not a production policy.',
  });
  for (const key of ['JWT_SECRET', 'MOD_KEY', 'MARKET_SEED']) process.env[key] = crypto.randomBytes(32).toString('hex');
  if (endpoint) process.env.DATABASE_URL = endpoint;
  const { buildServer } = await import('../server-fixture.js');
  const { ledger } = await import('../../src/game.js');
  const app = await buildServer();
  let origin, sealed = false, sequence = 0;
  try {
    origin = await app.listen({ host: '127.0.0.1', port: 0 });
    if (endpoint) assert.match((await app.pool.query('SELECT version() AS version')).rows[0].version, /^PostgreSQL /);
    async function request(actor, method, path, body, key, credential = actor?.credential ?? 'human') {
      assert(path.startsWith('/') && !path.startsWith('//'));
      const headers = { 'accept-encoding': 'gzip' };
      if (actor) headers.authorization = `Bearer ${credential === 'agent' ? actor.agent : actor.token}`;
      if (key) headers['idempotency-key'] = key;
      const payload = adultAuthFixture(method, path, body);
      if (payload !== undefined) headers['content-type'] = 'application/json';
      const response = await fetch(origin + path, { method, headers,
        ...(payload === undefined ? {} : { body: JSON.stringify(payload) }), signal: AbortSignal.timeout(30000) });
      const text = await response.text();
      return { status: response.status, headers: Object.fromEntries(response.headers), text, body: text ? JSON.parse(text) : null };
    }
    async function ok(actor, method, path, body, key = `desk-${++sequence}`, credential) {
      const response = await request(actor, method, path, body, key, credential);
      assert.equal(response.status, 200, `${method} ${path}: ${response.text}`);
      return response.body;
    }
    function setupOnly() { assert(!sealed, 'Fixture writes are forbidden after the baseline.'); }
    async function fund(actor, target) {
      setupOnly();
      const before = (await app.pool.query('SELECT cash,bank FROM characters WHERE id=$1', [actor.id])).rows[0];
      await app.pool.query("UPDATE characters SET cash=$2,bank=0,loc=$3,respect=10000,energy=100,nerve=100,last_accrued_at=$4 WHERE id=$1",
        [actor.id, target, actor.location, new Date(Date.now() + 86400000)]);
      const delta = target - Number(before.cash) - Number(before.bank);
      if (delta) await ledger(app.pool, { characterId: actor.id, currency: 'cash', amount: delta, reason: 'crime:business_desk_fixture' });
    }
    async function player(label, role, location, credential) {
      setupOnly();
      // Credential creation is deliberately non-replayable; never put secrets
      // behind the gameplay HTTP receipt mechanism.
      const token = (await ok(null, 'POST', '/v1/auth/guest', {}, null)).token;
      const actor = { token, location, credential, role };
      await ok(actor, 'POST', '/v1/character', { name: `Desk ${label.slice(0, 5)} ${role.slice(0, 5)} ${crypto.randomBytes(2).toString('hex')}` }, undefined, 'human');
      const me = await ok(actor, 'GET', '/v1/me', undefined, undefined, 'human');
      actor.id = me.character.id;
      actor.account = (await app.pool.query('SELECT account_id FROM characters WHERE id=$1', [actor.id])).rows[0].account_id;
      actor.agent = (await ok(actor, 'POST', '/v1/auth/agent-key', {}, null, 'human')).token;
      assert(actor.agent && actor.agent !== actor.token, 'The public owner-authenticated API issues the agent credential.');
      await fund(actor, 30000);
      for (const skill of ['fast_talker', 'fence_network']) {
        await app.pool.query('INSERT INTO character_skills(character_id,skill_id) VALUES($1,$2) ON CONFLICT DO NOTHING', [actor.id, skill]);
      }
      return actor;
    }
    const scenarios = [];
    for (const definition of definitions) {
      setupOnly();
      const scenario = { label: definition.label, credential: definition.credential ?? 'human', actors: {} };
      for (const [role, location] of Object.entries({ maker: 'foundry', seller: 'foundry', first: 'foundry', second: 'docks', host: 'neon', buyer: 'neon', outsider: 'foundry' })) {
        scenario.actors[role] = await player(definition.label, role, location, scenario.credential);
      }
      const { maker, seller } = scenario.actors;
      await ok(maker, 'POST', '/v1/resources/company', { expectedRevision: 0, name: `Desk Company ${definition.label}`, published: false, premises: null }, undefined, 'human');
      scenario.businessId = (await ok(maker, 'POST', '/v1/depot', { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 }, undefined, 'human')).id;
      await ok(maker, 'POST', `/v1/depot/${scenario.businessId}/policy`, { expectedRevision: 0, enabled: true, allowRestock: true, allowReceive: true,
        businessPriority: true, maxSpend: 0, reserveCash: 1000, expiresInSeconds: 3600 }, undefined, 'human');
      scenario.grantBody = { businessId: scenario.businessId, expectedRevision: 0, kind: 'volume', recipeIds: [], toolItemId: null,
        allowAgentProduction: true, maxBatchCashCost: 300, maxGrantCashCost: 600, agentGrantSeconds: 3600, renewAgentGrant: false };
      await ok(maker, 'POST', '/v1/company/specializations', scenario.grantBody, undefined, 'human');
      scenario.delegatedToken = (await ok(maker, 'POST', '/v1/gateway/connections', {
        provider: 'test', label: 'Business desk boundary', scopes: ['omerta.player.read', 'omerta.actions.prepare'], expiresInSeconds: 3600,
      }, null, 'human')).token;
      scenario.inputs = [];
      for (const price of [1000, 5000]) {
        setupOnly();
        await app.pool.query('UPDATE characters SET gta_at=$2,energy=100,jail_until=NULL,heat=0 WHERE id=$1', [seller.id, new Date(0)]);
        const random = Math.random; let acquired;
        try { Math.random = () => 0.001; acquired = await ok(seller, 'POST', '/v1/garage/boost', {}, undefined, 'human'); }
        finally { Math.random = random; }
        assert.equal(acquired.success, true); assert.equal(acquired.car.model, 'junker');
        const listing = await ok(seller, 'POST', '/v1/market', { carId: acquired.car.id, minBid: price, buyNow: price }, undefined, 'human');
        scenario.inputs.push({ carId: acquired.car.id, listingId: listing.id, price });
      }
      // Only declared initial funding/prerequisites are fixtures. No acquired
      // material, completed production, delivered UID or sale is seeded.
      await fund(maker, 2000);
      scenario.production = { businessId: scenario.businessId, steps: PRODUCTION_STEPS.map(step => ({ ...step })) };
      scenarios.push(scenario);
    }
    const snapshot = async () => {
      const queries = {
        characters: 'SELECT id,account_id,cash,bank,loc,alive FROM characters ORDER BY id',
        transactions: 'SELECT id,character_id,currency,amount,reason,counterparty FROM transactions ORDER BY id',
        cars: 'SELECT * FROM cars ORDER BY id', market: 'SELECT * FROM market_listings ORDER BY id',
        stacks: 'SELECT * FROM item_stacks ORDER BY owner_scope,owner_id,template_id,quality',
        items: 'SELECT * FROM item_instances ORDER BY id', events: 'SELECT * FROM item_events ORDER BY sequence',
        escrow: 'SELECT * FROM operation_escrow ORDER BY item_id',
        production: 'SELECT * FROM company_production_receipts ORDER BY account_id,request_key',
        specialization: 'SELECT * FROM company_specializations ORDER BY business_id',
        runs: 'SELECT * FROM company_specialization_runs ORDER BY account_id,request_key',
        guards: 'SELECT * FROM item_mutation_guards ORDER BY owner_scope,owner_id,idempotency_key',
        couriers: 'SELECT * FROM multi_hop_couriers ORDER BY id',
        consignments: 'SELECT * FROM consignments ORDER BY id',
        http: 'SELECT * FROM idempotency ORDER BY account_id,key',
      };
      const result = {};
      // Sequential reads keep snapshots meaningful without exhausting a native pool.
      for (const [name, sql] of Object.entries(queries)) result[name] = (await app.pool.query(sql)).rows;
      return JSON.parse(JSON.stringify(result));
    };
    const cash = async actor => Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [actor.id])).rows[0].cash);
    const item = async itemId => (await app.pool.query('SELECT * FROM item_instances WHERE id=$1', [itemId])).rows[0];
    const books = async () => {
      const { runLedgerInvariants } = await import('../../src/invariants.js');
      const result = await runLedgerInvariants(app.pool, { alert: false });
      assert.deepEqual(result.checks.filter(check => !check.ok), []);
    };
    sealed = true;
    const baseline = await snapshot();
    async function refused(actor, method, path, body, key = `refused-${++sequence}`, credential) {
      const before = await snapshot(), response = await request(actor, method, path, body, key, credential);
      assert([400, 401, 403, 409, 422].includes(response.status), `${method} ${path}: ${response.text}`);
      assert.deepEqual(await snapshot(), before, 'A refusal preserves every prior canonical stage and has no financial/item/receipt effect.');
      return response;
    }
    async function replay(actor, method, path, body, key = `effect-${++sequence}`) {
      const first = await request(actor, method, path, body, key);
      assert.equal(first.status, 200, `${method} ${path}: ${first.text}`);
      const committed = await snapshot();
      const receipt = committed.http.find(row => row.account_id === actor.account && row.key === key);
      assert.equal(receipt?.status, 200, 'The actual HTTP hook acknowledges the durable successful receipt.');
      assert.equal(receipt.response, first.text, 'A fetch/gzip response retains its original JSON, never compressed bytes.');
      const second = await request(actor, method, path, body, key);
      assert.equal(second.status, 200, second.text); assert.equal(second.headers['x-idempotent-replay'], 'true');
      assert.equal(second.text, first.text); assert.deepEqual(await snapshot(), committed, 'Exact-key replay performs no second debit or custody/event write.');
      // Keep the collision valid at route preValidation: an unknown field could
      // be rejected before the global idempotency hook ever observes the key.
      let changed;
      if (body?.steps) changed = { ...body, steps: body.steps.map((step, index) => index ? step : { ...step, repeat: step.repeat + 1 }) };
      else if (body?.sourceHash) changed = { ...body, sourceHash: '0'.repeat(64) };
      else if (body?.firstCarrier) changed = { ...body, firstFee: body.firstFee + 1 };
      else if (body?.hostAccountId) changed = { ...body, price: body.price + 1 };
      else { assert.deepEqual(body, {}); changed = undefined; } // {} versus an accepted bodyless request hashes differently.
      const collision = await request(actor, method, path, changed, key);
      assert.equal(collision.status, 422, collision.text); assert.equal(collision.body.error, 'idempotency_key_reuse');
      assert.deepEqual(await snapshot(), committed, 'Changed-body key reuse has no effects.');
      return first.body;
    }
    async function assertFinished(scenario, toolId, before) {
      const { maker, seller, first, second, host, buyer } = scenario.actors;
      const end = await snapshot();
      assert.equal(end.cars.find(row => row.id === scenario.inputs[0].carId), undefined, 'The purchased source car was consumed exactly once.');
      assert.equal(end.cars.find(row => row.id === scenario.inputs[1].carId)?.character_id, maker.id, 'Settled proceeds acquired a second distinct input.');
      const sold = await item(toolId); assert.equal(sold.owner_scope, 'account'); assert.equal(sold.owner_id, buyer.account); assert.equal(sold.state, 'active');
      const stacks = end.stacks.filter(row => row.owner_scope === 'account' && row.owner_id === maker.account && Number(row.quantity));
      assert.deepEqual(stacks.map(row => [row.template_id, Number(row.quantity)]).sort(), [['mat:scrap_steel', 2], ['mat:wire', 2]]);
      const births = end.events.filter(row => row.item_id === toolId && row.event_kind === 'created');
      assert.equal(births.length, 1); assert.equal(births[0].template_id, 'item:precision_lock_tool');
      const roots = end.production.filter(row => row.account_id === maker.account);
      assert.equal(roots.length, 1, 'Failed batches and replays cannot leave additional production roots.');
      assert.deepEqual(roots[0].receipt.steps, PRODUCTION_STEPS.map(step => ({ ...step })));
      assert.equal(roots[0].receipt.totalCashCost, 300);
      const initialIds = new Set(before.transactions.map(row => row.id));
      const added = end.transactions.filter(row => !initialIds.has(row.id));
      const totalCash = rows => rows.reduce((sum, row) => sum + Number(row.cash) + Number(row.bank), 0);
      assert.equal(totalCash(end.characters) - totalCash(before.characters),
        added.filter(row => row.character_id !== null && row.currency === 'cash').reduce((sum, row) => sum + Number(row.amount), 0),
        'All actors together reconcile to canonical cash journals, including actual fees and sinks.');
      for (const actor of [maker, seller, first, second, host, buyer]) {
        const initial = before.characters.find(row => row.id === actor.id), final = end.characters.find(row => row.id === actor.id);
        const delta = added.filter(row => row.character_id === actor.id && row.currency === 'cash').reduce((sum, row) => sum + Number(row.amount), 0);
        assert.equal(Number(final.cash) + Number(final.bank) - Number(initial.cash) - Number(initial.bank), delta, `${actor.role} cash is explained entirely by canonical ledger entries.`);
      }
      assert.equal(added.filter(row => row.reason === 'consignment:purchase' && row.character_id === buyer.id).reduce((sum, row) => sum + Number(row.amount), 0), -10000);
      assert.equal(added.filter(row => row.reason === 'consignment:proceeds' && row.character_id === maker.id).reduce((sum, row) => sum + Number(row.amount), 0), 9000);
      assert.equal(added.filter(row => row.reason === 'consignment:host_fee' && row.character_id === host.id).reduce((sum, row) => sum + Number(row.amount), 0), 1000);
      assert.equal(added.filter(row => row.reason === 'multi_hop_courier:fee' && [first.id, second.id].includes(row.character_id)).reduce((sum, row) => sum + Number(row.amount), 0), 70);
      assert.equal(end.escrow.filter(row => row.item_id === toolId).length, 0, 'No completed sale leaves phantom item custody.');
      await books();
    }
    return { app, origin, scenarios, baseline, native: !!endpoint, request, ok, refused, replay, snapshot, cash, item, books, assertFinished,
      close: async () => { await app.close(); await app.pool.end(); } };
  } catch (error) { await app.close(); await app.pool.end(); throw error; }
}
