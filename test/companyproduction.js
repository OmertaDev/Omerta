import assert from 'node:assert/strict';
import { PRODUCTION_DDL } from './companyproduction-schema.js';
const native = process.argv.includes('--postgres');
assert(!process.env.DATABASE_URL, 'Refuse ambient database endpoints');
if (native) {
  const url = new URL(process.env.COMPANY_PRODUCTION_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci); assert(!url.search && !url.hash); assert.match(url.pathname, /^\/company_production_test_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href }); await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY'); const version = (await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    await pre.query('ROLLBACK'); console.log(`production native ${version}, fresh owned database`);
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', DEPOT_PILOT: 'on', INVITE_MODE: 'off',
  JWT_SECRET: 'company-production-isolated-fixture-secret', MARKET_SEED: 'production-fixture-seed-long-enough-for-native', MOD_KEY: 'production-fixture-moderator' });
const { buildServer } = await import('../src/server.js'), G = await import('../src/game.js');
const Items = await import('../src/items.js'), Crafting = await import('../src/crafting.js');
const Production = await import('../src/companyproduction.js'), Routes = await import('../src/routes/companyproduction.js');
const { runLedgerInvariants } = await import('../src/invariants.js'), { runEstate } = await import('../src/social/estate.js');
assert.throws(() => Routes.register({}, { pool: {} }), /authenticated canonical item transactions/);
const app = await buildServer();
// Isolated component route fixture; the real server owns its separate mandatory F03 registration.
const { default: Fastify } = await import('fastify');
const component = Fastify();
component.setErrorHandler((error,req,reply)=>reply.code(error.statusCode || (error instanceof G.GameError ? 400 : 500)).send({error:error.code||'internal',message:error.message}));
Routes.register(component, { pool: app.pool, auth: async req => { try { if (!String(req.headers.authorization || '').startsWith('Bearer ')) throw Error('auth'); req.user = app.jwt.verify(req.headers.authorization.slice(7)); } catch { throw Object.assign(Error('Authentication required'), { statusCode: 401 }); } },
  beforeCraft: async () => ({ productionAuthorized: true, agentGrantExpiresAt: null }) });
let serial = 0;
const call = (p, method, url, body, key = `production-http-${++serial}`, agent = false) => (url.startsWith('/v1/company/production') ? component : app).inject({ method, url, payload: body,
  headers: { ...(p ? { authorization: `Bearer ${agent ? p.agent : p.token}` } : {}), 'idempotency-key': key } });
const ok = async (...args) => { const reply = await call(...args); assert.equal(reply.statusCode, 200, reply.body); return reply.json(); };
const tx = action => Items.withItemTransaction(app.pool, action);
async function player() {
  const token = (await ok(null, 'POST', '/v1/auth/guest')).token, p = { token };
  await ok(p, 'POST', '/v1/character', { name: `Production Player ${++serial}` });
  p.account = app.jwt.verify(token).sub;
  const row = (await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0]; p.id = row.id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000,last_accrued_at=$2 WHERE id=$1", [p.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 100000 - Number(row.cash), reason: 'crime:production-fixture' });
  await ok(p, 'POST', '/v1/resources/company', { expectedRevision: 0, name: `Production Company ${serial}`, published: false, premises: null });
  p.business = (await ok(p, 'POST', '/v1/depot', { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 })).id;
  p.agent = (await ok(p, 'POST', '/v1/auth/agent-key')).token;
  await app.pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [p.id]);
  return p;
}
async function materials(p, count = 1) {
  // Deterministic test dice drive the real GTA acquisition and audit faucet;
  // all materials then come from the canonical concrete-owned-car salvage.
  for (let i = 0; i < count; i++) {
    await app.pool.query("UPDATE characters SET gta_at=$2,energy=100 WHERE id=$1", [p.id, new Date(0)]);
    const random = Math.random; let boosted;
    try { Math.random = () => 0.001; boosted = await ok(p, 'POST', '/v1/garage/boost', {}); }
    finally { Math.random = random; }
    assert.equal(boosted.success, true); assert.equal(boosted.car.model, 'junker');
    const id = boosted.car.id;
    const receipt = await tx(client => Crafting.salvageCar(client, { accountId: p.account }, id, 'recipe:car_salvage_basic', `production-salvage-${id}`));
    assert.equal(receipt.kind, 'salvage_car'); assert.equal((await app.pool.query('SELECT id FROM cars WHERE id=$1', [id])).rows.length, 0);
  }
}
const chain = p => ({ businessId: p.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }, { recipeId: 'recipe:precision_lock_tool', repeat: 1 }] });
const run = (p, body, key, options = {}) => tx(client => Production.runCompanyProduction(client, p.account, body, key, { agentCredential: false, beforeCraft: async () => undefined, ...options }));
async function state(p) {
  return { cash: (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash,
    stacks: (await app.pool.query('SELECT template_id,quality,quantity AS qty FROM item_stacks WHERE owner_scope=$1 AND owner_id=$2 ORDER BY template_id,quality', ['account', p.account])).rows,
    items: (await app.pool.query('SELECT id,template_id,state FROM item_instances WHERE owner_scope=$1 AND owner_id=$2 ORDER BY id', ['account', p.account])).rows,
    events: Number((await app.pool.query('SELECT COUNT(*) n FROM item_events WHERE to_owner_id=$1 OR from_owner_id=$1', [p.account])).rows[0].n),
    roots: (await app.pool.query('SELECT request_key,receipt FROM company_production_receipts WHERE account_id=$1 ORDER BY request_key', [p.account])).rows };
}
async function global() { const result = await runLedgerInvariants(app.pool, { alert: false }); assert.deepEqual(result.checks.filter(c => !c.ok), []); }
try {
  const p = await player(), foreign = await player(); await materials(p);
  const before = await state(p), contexts = [];
  const result = await run(p, chain(p), 'real-chain', { beforeCraft: async (_client, context) => { contexts.push(context); return { admitted: true }; } });
  assert.equal(result.businessId, p.business); assert.equal(result.originalCharacter, p.id); assert.equal(result.totalCrafts, 2);
  assert.deepEqual(contexts.map(c => [c.businessId, c.originalCharacter, c.ordinal, c.totalCrafts]), [[p.business, p.id, 0, 2], [p.business, p.id, 1, 2]]);
  assert.deepEqual(contexts.map(c => [c.totalCashCost, c.recipeCashCost, c.agent]), [[300, 300, false], [300, 0, false]]);
  assert.equal(result.crafts[0].receipt.cashCost, 300); assert.equal(result.crafts[1].receipt.cashCost, 0);
  const after = await state(p); assert.equal(Number(after.cash), Number(before.cash) - 300); assert.equal(after.items.length, 1);
  assert.equal(after.items[0].template_id, 'item:precision_lock_tool'); assert.equal(after.stacks.find(s => s.template_id === 'mat:scrap_steel').qty, 2);
  assert.equal(after.stacks.some(s => s.template_id === 'mat:hardened_steel' && s.qty > 0), false);
  assert.match(result.sourcePin.code['crafting.js'], /^[a-f0-9]{64}$/); assert.equal(result.sourcePin.recipes.length, 2);
  for (const craft of result.crafts) {
    const guard = (await app.pool.query('SELECT mutation_kind,result_json FROM item_mutation_guards WHERE idempotency_key=$1', [craft.key])).rows[0];
    assert.equal(guard.mutation_kind, 'craft'); assert.deepEqual(JSON.parse(guard.result_json), craft.receipt);
    assert((await app.pool.query('SELECT id FROM item_events WHERE idempotency_key=$1', [craft.key])).rows.length >= 2);
  }
  assert.deepEqual(await run(p, chain(p), 'real-chain', { beforeCraft: () => { throw new Error('Replay must bypass new admission'); } }), result);
  assert.deepEqual(await run(p, chain(p), 'real-chain', { beforeCraft: undefined }), result);
  await assert.rejects(run(p, chain(p), 'missing-admission', { beforeCraft: undefined }), /admission_unavailable/);
  assert.deepEqual(await state(p), after);
  await assert.rejects(run(p, { ...chain(p), businessId: foreign.business }, 'real-chain'), e => e.code === 'company_production' && e.message === 'request_conflict');
  await assert.rejects(run(foreign, chain(p), 'foreign-source'), e => e.message === 'business_owner');
  await assert.rejects(run(p, { ...chain(p), quality: 'rare' }, 'caller-quality'), /terms/);
  await assert.rejects(run(p, { businessId: p.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 7 }] }, 'too-many'), /batch_limit/);
  await assert.rejects(run(p, { businessId: p.business, steps: [{ recipeId: 'arbitrary-mint', repeat: 1 }] }, 'mint'), /recipe_unavailable/);
  await assert.rejects(run(p, { businessId: p.business, steps: [{ recipeId: 'recipe:car_salvage_basic', repeat: 1 }] }, 'wrong-adapter'), /recipe_unavailable/);
  await app.pool.query("UPDATE characters SET loc='docks' WHERE id=$1", [p.id]);
  await assert.rejects(run(p, chain(p), 'wrong-location'), e => e.code === 'location');
  await app.pool.query("UPDATE characters SET loc='foundry',respect=0 WHERE id=$1", [p.id]);
  await assert.rejects(run(p, chain(p), 'wrong-level'), e => e.code === 'level');
  await app.pool.query('UPDATE characters SET respect=10000 WHERE id=$1', [p.id]);
  assert.deepEqual(await state(p), after, 'Admission cannot bypass canonical location or level');
  const rolled = await player(); await materials(rolled); const rollbackState = await state(rolled);
  await assert.rejects(tx(async client => { try { await Production.runCompanyProduction(client, rolled.account, chain(rolled), 'late-hook', { agentCredential: false, beforeCraft: (_c, ctx) => { if (ctx.ordinal === 1) throw new Error('late admission failure'); } }); } catch {} }), /late admission failure/);
  assert.deepEqual(await state(rolled), rollbackState, 'Caught late callback failure still poisons and compensates entire canonical batch');
  const missing = { businessId: rolled.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }, { recipeId: 'recipe:precision_lock_tool', repeat: 2 }] };
  await assert.rejects(run(rolled, missing, 'late-input'), e => e.code === 'materials');
  assert.deepEqual(await state(rolled), rollbackState, 'Late missing input rolls back earlier fee, input, output, guards and root');
  await app.pool.query("DELETE FROM character_skills WHERE character_id=$1 AND skill_id='fence_network'", [rolled.id]);
  await assert.rejects(run(rolled, chain(rolled), 'late-skill'), e => e.code === 'skill');
  assert.deepEqual(await state(rolled), rollbackState, 'Late canonical skill refusal rolls back the prior stage');
  const http = await player(); await materials(http);
  const first = await ok(http, 'POST', '/v1/company/production/run', chain(http), 'http-run', true);
  const replay = await ok(http, 'POST', '/v1/company/production/run', chain(http), 'http-run', false); delete replay.replayed; assert.deepEqual(replay, first);
  assert.equal((await call(null, 'POST', '/v1/company/production/run', chain(http))).statusCode, 401);
  assert.equal((await ok(foreign, 'GET', '/v1/company/production')).receipts.length, 0);
  assert.equal((await ok(http, 'GET', '/v1/company/production')).receipts[0].receipt.runId, first.runId);
  assert.equal((await call(http, 'GET', '/v1/company/production?accountId=foreign')).statusCode, 400);
  const delegated = await player(); await materials(delegated);
  await ok(delegated, 'POST', `/v1/depot/${delegated.business}/policy`, { expectedRevision: 0, enabled: true, allowRestock: true,
    allowReceive: true, businessPriority: true, maxSpend: 0, reserveCash: 1000, expiresInSeconds: 3600 });
  const delegatedBefore = await state(delegated);
  await assert.rejects(run(delegated, chain(delegated), 'old-policy-no-new-grant', { agentCredential: true }), e => e.code === 'owner_authority');
  assert.deepEqual(await state(delegated), delegatedBefore);
  const approved = await run(delegated, chain(delegated), 'trusted-production-action-grant', { agentCredential: true,
    beforeCraft: async (_client, ctx) => { assert.equal(ctx.totalCashCost, 300); assert.equal(ctx.businessId, delegated.business); return { productionAuthorized: true,
      agentGrantExpiresAt: new Date(Date.now() + 60000).toISOString(), fixtureAdmission: 'trusted-action-specific-hook' }; } });
  assert.equal(approved.totalCashCost, 300);
  assert.equal(Number((await app.pool.query('SELECT spent FROM business_operating_policies WHERE depot_id=$1', [delegated.business])).rows[0].spent), 0,
    'A trusted action-specific grant never borrows the old restock budget');
  await global();
  if (native) {
    const raced = await player(); await materials(raced);
    const races = await Promise.all([run(raced, chain(raced), 'one-key'), run(raced, chain(raced), 'one-key')]);
    assert.deepEqual(races[0], races[1]); assert.equal((await state(raced)).items.length, 1);
    const competing = await player(); await materials(competing);
    const competingRuns = await Promise.allSettled([run(competing, chain(competing), 'one'), run(competing, chain(competing), 'two')]);
    assert.equal(competingRuns.filter(r => r.status === 'fulfilled').length, 1);
    assert.equal(competingRuns.filter(r => r.status === 'rejected').length, 1); assert.equal((await state(competing)).items.length, 1);
    async function waiting(pid) {
      for (let attempt = 0; attempt < 100; attempt++) {
        if ((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock'", [pid])).rows.length) return;
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      assert.fail('The genuine canonical source lock wait must be observed');
    }
    const expired = await player(); await materials(expired); const expiryBefore = await state(expired), inputHolder = await app.pool.connect();
    let inputReached, inputPid, grantExpiry; const atInput = new Promise(resolve => { inputReached = resolve; });
    try {
      await inputHolder.query('BEGIN');
      await inputHolder.query('SELECT quantity FROM item_stacks WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4 FOR UPDATE', ['account', expired.account, 'mat:scrap_steel', 'standard']);
      const pending = tx(async client => { const query = client.query; client.query = function(sql, ...args) {
        if (typeof sql === 'string' && sql.startsWith('SELECT quantity, created_at, updated_at FROM item_stacks')) { inputPid = client.processID; inputReached(); }
        return query.call(this, sql, ...args);
      }; try { return await Production.runCompanyProduction(client, expired.account, chain(expired), 'grant-ended-during-input-wait', { agentCredential: true,
        beforeCraft: async () => { grantExpiry ||= new Date(Date.now() + 500).toISOString(); return { productionAuthorized: true, agentGrantExpiresAt: grantExpiry }; } }); }
      finally { client.query = query; } });
      const refused = assert.rejects(pending, /production_grant_expired/); await atInput; await waiting(inputPid);
      await new Promise(resolve => setTimeout(resolve, Math.max(0, Date.parse(grantExpiry) - Date.now() + 50)));
      await inputHolder.query('COMMIT'); await refused;
      assert.deepEqual(await state(expired), expiryBefore, 'Expiry after canonical input wait rolls back fee, items, child guards and metadata');
    } finally { await inputHolder.query('ROLLBACK'); inputHolder.release(); }
    const drift = await player(); await materials(drift); const driftBefore = await state(drift), holder = await app.pool.connect();
    let reached, pid; const atBusiness = new Promise(resolve => { reached = resolve; });
    try {
      await holder.query('BEGIN'); await holder.query('SELECT id FROM business_depots WHERE id=$1 FOR UPDATE', [drift.business]);
      const pending = tx(async client => { const query = client.query; client.query = function(sql, ...args) {
        if (sql === 'SELECT id,owner_character,status FROM business_depots WHERE id=$1 FOR UPDATE') { pid = client.processID; reached(); }
        return query.call(this, sql, ...args);
      }; try { return await Production.runCompanyProduction(client, drift.account, chain(drift), 'business-lock-drift', { agentCredential: false, beforeCraft: async () => undefined }); }
      finally { client.query = query; } });
      const refused = assert.rejects(pending, /business_owner/); await atBusiness; await waiting(pid);
      await holder.query("UPDATE business_depots SET status='closed' WHERE id=$1", [drift.business]); await holder.query('COMMIT'); await refused;
      assert.deepEqual(await state(drift), driftBefore, 'Business source drift after a real wait changes no items, cash, guards or root');
    } finally { await holder.query('ROLLBACK'); holder.release(); }
    const dead = await player(); await materials(dead); const deadBefore = await state(dead);
    let staged, releaseEstate; const estateStaged = new Promise(resolve => { staged = resolve; }), release = new Promise(resolve => { releaseEstate = resolve; });
    const dying = G.withTwoCharacters(app.pool, foreign.account, dead.id, async (_ch, target, client, h) => {
      const result = await runEstate(client, h, target, 'production blocked by actual estate'); staged(); await release; return result;
    }, { meet: false }); await estateStaged;
    let reachedActor, actorPid; const atActor = new Promise(resolve => { reachedActor = resolve; });
    const producing = tx(async client => { const query = client.query; client.query = function(sql, ...args) {
      if (sql === 'SELECT id,account_id,alive,is_npc FROM characters WHERE id=$1 AND account_id=$2 FOR UPDATE') { actorPid = client.processID; reachedActor(); }
      return query.call(this, sql, ...args);
    }; try { return await Production.runCompanyProduction(client, dead.account, chain(dead), 'dead-after-lock', { agentCredential: false, beforeCraft: async () => undefined }); }
    finally { client.query = query; } });
    const deadRefused = assert.rejects(producing, /living_character/); await atActor; await waiting(actorPid); releaseEstate();
    const [estate] = await Promise.all([dying, deadRefused]); assert.notEqual(estate.heirId, dead.id);
    const deadAfter = await state(dead); assert.deepEqual(deadAfter.stacks, deadBefore.stacks); assert.deepEqual(deadAfter.items, deadBefore.items); assert.equal(deadAfter.roots.length, 0);
    const page = await player(); await materials(page, 15);
    for (let index = 0; index < 22; index++) await run(page, { businessId: page.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }] }, `page-${String(index).padStart(2, '0')}`);
    const firstPage = await tx(client => Production.companyProductionBoard(client, page.account));
    assert.equal(firstPage.receipts.length, 20); assert.equal(firstPage.nextCursor, 'page-19');
    const nextPage = await tx(client => Production.companyProductionBoard(client, page.account, firstPage.nextCursor));
    assert.equal(nextPage.receipts.length, 2); assert.equal(nextPage.nextCursor, null);
  }
  const death = await G.withTwoCharacters(app.pool, foreign.account, p.id, (_ch, target, client, h) => runEstate(client, h, target, 'production canonical estate'), { meet: false });
  assert.notEqual(death.heirId, p.id); assert.equal((await app.pool.query('SELECT status FROM business_depots WHERE id=$1', [p.business])).rows[0].status, 'closed');
  assert.deepEqual(await run({ ...p, id: death.heirId }, chain(p), 'real-chain'), result, 'Heir reads immutable original production history only');
  await assert.rejects(run({ ...p, id: death.heirId }, chain(p), 'fresh-old-business'), /business_owner/);
  await global();
  console.log(`company production PASS ${native ? 'native PostgreSQL' : 'memory'}: owned open business, actual salvage-to-authored multi-stage inputs/output/provenance, canonical fee, atomic poisoned rollback, human/agent routes, exact replay/foreign boundaries, estate history${native ? ', same/different-key contention' : ''}`);
} finally { await component.close(); await app.close(); await app.pool.end(); }
