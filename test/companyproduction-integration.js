import assert from 'node:assert/strict';
const native = process.argv.includes('--postgres'); let version = 'memory';
assert(!process.env.DATABASE_URL, 'Production integration refuses ambient database endpoints');
if (native) {
  const url = new URL(process.env.COMPANY_PRODUCTION_INTEGRATION_TEST_DATABASE_URL);
  assert(['postgres:', 'postgresql:'].includes(url.protocol)); assert.equal(url.hostname, '127.0.0.1');
  const local = ['35439', '35449'].includes(url.port) && url.username === 'pilot_runner' && !url.password;
  const ci = url.port === '5432' && url.username === 'postgres' && url.password === 'pgcheck';
  assert(local || ci); assert(!url.search && !url.hash); assert.match(url.pathname, /^\/company_production_integration_test_[a-z0-9_]+$/);
  const { default: pg } = await import('pg'), pre = new pg.Client({ connectionString: url.href }); await pre.connect();
  try {
    await pre.query('BEGIN READ ONLY'); version = (await pre.query('SHOW server_version')).rows[0].server_version;
    assert.match(version, local ? /^18\.4\b/ : /^(?:16\b|18\.4\b)/);
    assert.equal((await pre.query("SELECT tablename FROM pg_tables WHERE schemaname='public'")).rows.length, 0);
    await pre.query('ROLLBACK');
  } finally { await pre.end(); }
  process.env.DATABASE_URL = url.href;
}
Object.assign(process.env, { RATE_LIMIT: 'off', SOCIAL_VERIFY_MODE: 'off', DEPOT_PILOT: 'on', INVITE_MODE: 'off',
  JWT_SECRET: 'production-combined-native-fixture-secret', MARKET_SEED: 'production-combined-fixture-market-seed-long', MOD_KEY: 'production-combined-fixture-moderator' });
const { buildServer } = await import('../src/server.js'), G = await import('../src/game.js');
const I = await import('../src/items.js'), { runEstate } = await import('../src/social/estate.js');
const { runLedgerInvariants } = await import('../src/invariants.js');
const app = await buildServer(); let sequence = 0;
// Global schema and real root registrations/hooks only: no component DDL or
// registration/admission/mystery-completion scaffold is installed by this test.
async function call(p, method, url, body, key = `combined-${++sequence}`, agent = false) {
  const r = await app.inject({ method, url, payload: body, headers: { ...(p ? { authorization: `Bearer ${agent ? p.agent : p.token}` } : {}), 'idempotency-key': key } });
  return { code: r.statusCode, body: r.json(), headers: r.headers };
}
async function ok(...args) { const r = await call(...args); assert.equal(r.code, 200, JSON.stringify(r)); return r.body; }
async function refusal(...args) { const r = await call(...args); assert([400, 409, 422].includes(r.code), JSON.stringify(r)); return r; }
const base = '/v1/company/production', profiles = '/v1/company/specializations';
const standard = p => ({ businessId: p.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 1 }, { recipeId: 'recipe:precision_lock_tool', repeat: 1 }] });
const tempered = p => ({ businessId: p.business, steps: [{ recipeId: 'recipe:hardened_steel', repeat: 2 }, { recipeId: 'recipe:tempered_precision_lock_tool', repeat: 1 }] });
const run = (p, body = standard(p), key = `run-${++sequence}`, agent = true) => ok(p, 'POST', `${base}/run`, body, key, agent);
async function player() {
  const p = { token: (await ok(null, 'POST', '/v1/auth/guest')).token };
  await ok(p, 'POST', '/v1/character', { name: `Combined Factory ${++sequence}` }); p.account = app.jwt.verify(p.token).sub;
  const row = (await app.pool.query('SELECT id,cash,bank FROM characters WHERE account_id=$1 AND alive', [p.account])).rows[0]; p.id = row.id;
  await app.pool.query("UPDATE characters SET cash=100000,bank=0,loc='foundry',respect=10000,last_accrued_at=$2 WHERE id=$1", [p.id, new Date(Date.now() + 3600000)]);
  await G.ledger(app.pool, { characterId: p.id, currency: 'cash', amount: 100000 - Number(row.cash) - Number(row.bank), reason: 'crime:combined-production-fixture' });
  await app.pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [p.id]);
  await ok(p, 'POST', '/v1/resources/company', { expectedRevision: 0, name: `Private Factory ${sequence}`, published: false, premises: null });
  p.business = (await ok(p, 'POST', '/v1/depot', { salePrice: 1000, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 })).id;
  p.agent = (await ok(p, 'POST', '/v1/auth/agent-key')).token; assert.equal(app.jwt.verify(p.agent).agent, true); return p;
}
async function materials(p, count = 1) {
  for (let i = 0; i < count; i++) {
    await app.pool.query('UPDATE characters SET gta_at=$2,energy=100 WHERE id=$1', [p.id, new Date(0)]);
    const random = Math.random; let boost;
    try { Math.random = () => 0.001; boost = await ok(p, 'POST', '/v1/garage/boost', {}); } finally { Math.random = random; }
    assert.equal(boost.success, true); assert.equal(boost.car.model, 'junker');
    await ok(p, 'POST', `/v1/worldgraph/recipes/recipe:car_salvage_basic/salvage/${boost.car.id}`, {});
    assert.equal((await app.pool.query('SELECT id FROM cars WHERE id=$1', [boost.car.id])).rows.length, 0);
  }
}
async function operatingPolicy(p) {
  return ok(p, 'POST', `/v1/depot/${p.business}/policy`, { expectedRevision: 0, enabled: true, allowRestock: true,
    allowReceive: true, businessPriority: true, maxSpend: 0, reserveCash: 1000, expiresInSeconds: 3600 });
}
const grantBody = (p, revision = 0, max = 300, lifetime = 600) => ({ businessId: p.business, expectedRevision: revision,
  kind: 'volume', recipeIds: [], toolItemId: null, allowAgentProduction: true, maxBatchCashCost: max,
  maxGrantCashCost: lifetime, agentGrantSeconds: 60, renewAgentGrant: false });
const grant = (p, revision = 0, max = 300, lifetime = 600) => ok(p, 'POST', profiles, grantBody(p, revision, max, lifetime), undefined, false);
async function state(p) {
  return { cash: (await app.pool.query('SELECT cash FROM characters WHERE id=$1', [p.id])).rows[0].cash,
    stacks: (await app.pool.query('SELECT template_id,quality,quantity FROM item_stacks WHERE owner_scope=$1 AND owner_id=$2 ORDER BY template_id,quality', ['account', p.account])).rows,
    items: (await app.pool.query('SELECT id,template_id,state FROM item_instances WHERE owner_scope=$1 AND owner_id=$2 ORDER BY id', ['account', p.account])).rows,
    roots: (await app.pool.query('SELECT request_key,receipt FROM company_production_receipts WHERE account_id=$1 ORDER BY request_key', [p.account])).rows,
    guards: (await app.pool.query('SELECT idempotency_key,result_json FROM item_mutation_guards WHERE owner_scope=$1 AND owner_id=$2 ORDER BY idempotency_key', ['account', p.account])).rows,
    transactions: (await app.pool.query('SELECT id,currency,amount,reason FROM transactions WHERE character_id=$1 ORDER BY id', [p.id])).rows,
    births: (await app.pool.query('SELECT item_id,craft_key,creation_event,grade,maximum FROM item_durability_birth_quality WHERE authority_account=$1 ORDER BY item_id', [p.account])).rows,
    profile: (await app.pool.query('SELECT revision,grant_spent,next_run_at FROM company_specializations WHERE business_id=$1', [p.business])).rows,
    profileRuns: (await app.pool.query('SELECT request_key,total_crafts,revision FROM company_specialization_runs WHERE account_id=$1 ORDER BY request_key', [p.account])).rows,
    eventCount: Number((await app.pool.query('SELECT COUNT(*) n FROM item_events WHERE from_owner_id=$1 OR to_owner_id=$1', [p.account])).rows[0].n) };
}
async function global() {
  const all = await runLedgerInvariants(app.pool, { alert: false }); assert.deepEqual(all.checks.filter(c => !c.ok), []);
  assert(all.checks.some(c => c.name === 'physical equipment condition provenance' && c.ok));
}
async function useMystery(p, itemId, maximum) {
  const creation = (await app.pool.query("SELECT id,template_id,quality,provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='created'", [itemId])).rows;
  await ok(p, 'POST', `/v1/worldgraph/items/${itemId}/assign-current-character`, {});
  const before = (await ok(p, 'GET', '/v1/items/durability')).items.find(i => i.itemId === itemId); assert.equal(before.remaining, maximum);
  const q = '/v1/worldgraph/mysteries/belladonna-demo'; await ok(p, 'POST', `${q}/start`, {});
  await ok(p, 'POST', `${q}/nodes/mystery:belladonna-trace/complete`, { interactionId: 'inspect_belladonna_stamp' });
  await ok(p, 'POST', `${q}/nodes/mystery:belladonna-lock/discover`, {});
  const key = `actual-lock-${++sequence}`, completed = await ok(p, 'POST', `${q}/nodes/mystery:belladonna-lock/complete`, { interactionId: 'set_precision_tumblers' }, key);
  const replay = await ok(p, 'POST', `${q}/nodes/mystery:belladonna-lock/complete`, { interactionId: 'set_precision_tumblers' }, key); delete replay.replayed; assert.deepEqual(replay, completed);
  const held = (await app.pool.query('SELECT remaining FROM item_durability_states WHERE item_id=$1', [itemId])).rows[0]; assert.equal(Number(held.remaining), maximum - 10);
  assert.equal((await app.pool.query('SELECT event_id FROM item_durability_uses WHERE item_id=$1', [itemId])).rows.length, 1);
  await ok(p, 'POST', `${q}/nodes/mystery:belladonna-file-closed/discover`, {});
  await ok(p, 'POST', `${q}/nodes/mystery:belladonna-file-closed/complete`, { interactionId: 'seal_belladonna_file' });
  const after = (await ok(p, 'GET', '/v1/items/durability')).items.find(i => i.itemId === itemId); assert.equal(after.remaining, maximum - 10); assert.equal(after.maximum, maximum);
  assert.deepEqual((await app.pool.query("SELECT id,template_id,quality,provenance_kind FROM item_events WHERE item_id=$1 AND event_kind='created'", [itemId])).rows, creation);
  const board = await ok(p, 'GET', q); assert.equal(board.status, 'completed'); assert(!JSON.stringify(board).includes('privateEvidence'));
}
try {
  assert(app.hasRoute({ method: 'POST', url: `${base}/run` })); assert(app.hasRoute({ method: 'POST', url: profiles }));
  assert.equal((await call(null, 'GET', base)).code, 401);
  const baseline = await player(), foreign = await player(); await materials(baseline);
  const personal = await run(baseline, standard(baseline), 'no-policy-agent-baseline');
  assert.equal(personal.crafts[0].admission.grant, 'canonical_baseline'); assert.equal(personal.crafts[0].admission.agentGrantExpiresAt, null);
  const original = await state(baseline), baselineReplay = await run(baseline, standard(baseline), 'no-policy-agent-baseline', false); delete baselineReplay.replayed; assert.deepEqual(baselineReplay, personal); assert.deepEqual(await state(baseline), original);
  assert.equal((await ok(foreign, 'GET', base)).receipts.length, 0); assert.equal((await ok(foreign, 'GET', profiles)).length, 0);
  await refusal(foreign, 'POST', `${base}/run`, standard(baseline));
  await refusal(baseline, 'POST', `${base}/run`, { ...standard(baseline), quality: 'tempered' });
  const producer = await player(); await materials(producer); await operatingPolicy(producer); const deniedBefore = await state(producer);
  await refusal(producer, 'POST', `${base}/run`, standard(producer), 'no-production-grant', true); assert.deepEqual(await state(producer), deniedBefore);
  const deniedGrant = await refusal(producer, 'POST', profiles, grantBody(producer), 'agent-cannot-grant', true);
  assert.equal(deniedGrant.body.error, 'company_specialization'); assert.match(deniedGrant.body.message, /owner_authority/);
  await grant(producer, 0, 300, 300); const made = await run(producer, standard(producer), 'scoped-owner-grant');
  assert.equal(made.crafts[0].admission.grant, 'explicit_owner_game_grant'); assert.equal(Number((await state(producer)).profile[0].grant_spent), 300);
  assert.equal(Number((await app.pool.query('SELECT spent FROM business_operating_policies WHERE depot_id=$1', [producer.business])).rows[0].spent), 0);
  await refusal(producer, 'POST', `${base}/run`, standard(producer), 'cadence-refusal', true);
  // Negative administrative clock acceleration only; no production permission,
  // source item or completed Mystery node is fabricated.
  await app.pool.query('UPDATE company_specializations SET next_run_at=$2 WHERE business_id=$1', [producer.business, new Date(0)]);
  await refusal(producer, 'POST', `${base}/run`, standard(producer), 'lifetime-budget-refusal', true);
  const replay = await run(producer, standard(producer), 'scoped-owner-grant', false); delete replay.replayed; assert.deepEqual(replay, made);
  await ok(producer, 'POST', profiles, { ...grantBody(producer, 1), allowAgentProduction: false, maxBatchCashCost: 0,
    maxGrantCashCost: 0, agentGrantSeconds: 0 });
  const revoked = await state(producer); assert.equal(Number(revoked.profile[0].grant_spent), 300);
  const revokedDenial = await refusal(producer, 'POST', `${base}/run`, standard(producer), 'revoked-grant', true); assert.match(revokedDenial.body.message, /production_consent/);
  assert.deepEqual(await state(producer), revoked);
  const revokedReplay = await run(producer, standard(producer), 'scoped-owner-grant', true); delete revokedReplay.replayed; assert.deepEqual(revokedReplay, made);
  for (const body of [await ok(producer, 'GET', base), await ok(producer, 'GET', profiles)]) {
    assert(!JSON.stringify(body).includes(producer.token)); assert(!JSON.stringify(body).includes(producer.agent));
  }
  for (const origin of ['crafted', 'salvaged', 'awarded', 'imported']) {
    const p = await player(); const item = await I.withItemTransaction(app.pool, c => I.createItem(c, { scope: 'account', id: p.account }, 'item:precision_lock_tool', origin, `legitimate-${origin}-${++sequence}`));
    await useMystery(p, item.id, 100);
    await ok(p, 'POST', profiles, { businessId: p.business, expectedRevision: 0, kind: 'quality', recipeIds: [], toolItemId: item.id,
      allowAgentProduction: false, maxBatchCashCost: 0, maxGrantCashCost: 0, agentGrantSeconds: 0, renewAgentGrant: false });
    await materials(p); const qualityRun = await run(p); assert.equal(qualityRun.crafts[0].admission.kind, 'quality'); assert.equal(qualityRun.crafts[0].admission.equipmentWear, false);
    assert.equal((await ok(p, 'GET', '/v1/items/durability')).items.find(i => i.itemId === item.id).remaining, 90, 'Production does not invent equipment wear');
    await global();
  }
  const manufacturer = await player(); await materials(manufacturer, 2); await operatingPolicy(manufacturer); await grant(manufacturer, 0, 600, 1200);
  const manufactured = await run(manufacturer, tempered(manufacturer), 'actual-tempered-manufacture'); assert.equal(manufactured.totalCashCost, 600);
  const last = manufactured.crafts.at(-1), tool = last.receipt.outputs[0]; assert.equal(last.receipt.cashCost, 0);
  const birth = (await app.pool.query('SELECT craft_key,grade,maximum FROM item_durability_birth_quality WHERE item_id=$1', [tool.id])).rows[0];
  assert.equal(birth.craft_key, last.key); assert.equal(birth.grade, 'tempered'); assert.equal(Number(birth.maximum), 150);
  const birthReplay = await run(manufacturer, tempered(manufacturer), 'actual-tempered-manufacture', false); delete birthReplay.replayed; assert.deepEqual(birthReplay, manufactured);
  await useMystery(manufacturer, tool.id, 150); await global();
  if (native) {
    const rollback = await player(); await materials(rollback, 2); await operatingPolicy(rollback); await grant(rollback, 0, 600, 1200); const before = await state(rollback);
    const connect = app.pool.connect; let writes = 0, crafts = 0, births = 0;
    const wrap = c => { const query = c.query, release = c.release; c.query = async function(sql, ...args) {
      const result = await query.call(this, sql, ...args);
      if (typeof sql === 'string' && sql.startsWith('UPDATE item_mutation_guards') && sql.includes('result_json=$3')) crafts++;
      if (typeof sql === 'string' && sql.startsWith('INSERT INTO item_durability_birth_quality')) births++;
      if (typeof sql === 'string' && sql.startsWith('UPDATE company_production_receipts SET receipt')) { writes++; throw new Error('late completed production failure'); }
      return result;
    }; c.release = function(...args) { c.query = query; c.release = release; return release.apply(this, args); }; return c; };
    app.pool.connect = function(...args) { if (typeof args.at(-1) === 'function') { const cb = args.pop(); return connect.call(this, ...args, (err, c) => { if (err) return cb(err); const w = wrap(c); cb(null, w, w.release); }); } return connect.apply(this, args).then(wrap); };
    try { assert.equal((await call(rollback, 'POST', `${base}/run`, tempered(rollback), 'late-actual-api-failure', true)).code, 500); } finally { app.pool.connect = connect; }
    assert.equal(writes, 1); assert.equal(crafts, 3); assert.equal(births, 1);
    assert.deepEqual(await state(rollback), before, 'Actual F03 reservation, three canonical crafts and automatic quality birth roll back after caught route failure');
    await run(rollback, tempered(rollback), 'late-actual-api-failure', false); await global();
    const expiring = await player(); await materials(expiring); await operatingPolicy(expiring); await grant(expiring);
    await app.pool.query("UPDATE company_specializations SET grant_expires_at=clock_timestamp()+interval '1 second' WHERE business_id=$1", [expiring.business]);
    const expiryBefore = await state(expiring), hold = await app.pool.connect();
    try {
      await hold.query('BEGIN'); await hold.query('SELECT quantity FROM item_stacks WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4 FOR UPDATE', ['account', expiring.account, 'mat:scrap_steel', 'standard']);
      const pending = call(expiring, 'POST', `${base}/run`, standard(expiring), 'actual-grant-input-wait', true);
      let waited = false;
      for (let attempt = 0; attempt < 100; attempt++) { if ((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT quantity, created_at, updated_at FROM item_stacks%' LIMIT 1")).rows.length) { waited = true; break; } await new Promise(resolve => setTimeout(resolve, 10)); }
      assert.equal(waited, true); await new Promise(resolve => setTimeout(resolve, 1100)); await hold.query('COMMIT');
      const refused = await pending; assert.equal(refused.code, 400); assert.equal(refused.body.error, 'company_production'); assert.match(refused.body.message, /production_grant_expired/);
      assert.deepEqual(await state(expiring), expiryBefore, 'Real F03 spent/cadence, root, children, cash and items revert after input-lock expiry');
    } finally { await hold.query('ROLLBACK'); hold.release(); }
    const raced = await player(); await materials(raced); await operatingPolicy(raced); await grant(raced);
    const racedReplies = await Promise.all([call(raced, 'POST', `${base}/run`, standard(raced), 'same-actual-key', true), call(raced, 'POST', `${base}/run`, standard(raced), 'same-actual-key', true)]);
    assert(racedReplies.some(r => r.code === 200)); assert(racedReplies.every(r => [200, 409].includes(r.code)));
    await run(raced, standard(raced), 'same-actual-key', false); assert.equal((await state(raced)).roots.length, 1); assert.equal(Number((await state(raced)).profile[0].grant_spent), 300); await global();
    const competing = await player(); await materials(competing, 2); await operatingPolicy(competing); await grant(competing);
    const different = await Promise.all([call(competing, 'POST', `${base}/run`, standard(competing), 'different-one', true), call(competing, 'POST', `${base}/run`, standard(competing), 'different-two', true)]);
    assert.equal(different.filter(r => r.code === 200).length, 1); assert.equal(different.filter(r => r.code === 400 && /cadence/.test(r.body.message)).length, 1);
    assert.equal((await state(competing)).roots.length, 1); assert.equal(Number((await state(competing)).profile[0].grant_spent), 300); await global();
    const changing = await player(); await materials(changing); await operatingPolicy(changing); await grant(changing);
    const ownerHold = await app.pool.connect();
    try {
      await ownerHold.query('BEGIN'); await ownerHold.query('SELECT quantity FROM item_stacks WHERE owner_scope=$1 AND owner_id=$2 AND template_id=$3 AND quality=$4 FOR UPDATE', ['account', changing.account, 'mat:scrap_steel', 'standard']);
      const producing = call(changing, 'POST', `${base}/run`, standard(changing), 'production-before-owner-revoke', true);
      let heldInput = false;
      for (let attempt = 0; attempt < 100; attempt++) { if ((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT quantity, created_at, updated_at FROM item_stacks%' LIMIT 1")).rows.length) { heldInput = true; break; } await new Promise(resolve => setTimeout(resolve, 10)); }
      assert.equal(heldInput, true);
      const revoking = call(changing, 'POST', profiles, { ...grantBody(changing, 1), allowAgentProduction: false, maxBatchCashCost: 0, maxGrantCashCost: 0, agentGrantSeconds: 0 }, 'actual-owner-revoke-after-lock', false);
      let heldActor = false;
      for (let attempt = 0; attempt < 100; attempt++) { if ((await app.pool.query("SELECT pid FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock' AND query LIKE 'SELECT id,account_id,alive,is_npc FROM characters WHERE account_id%' LIMIT 1")).rows.length) { heldActor = true; break; } await new Promise(resolve => setTimeout(resolve, 10)); }
      assert.equal(heldActor, true); await ownerHold.query('COMMIT'); const settled = await Promise.all([producing, revoking]); assert(settled.every(r => r.code === 200));
      const afterChange = await state(changing); assert.equal(afterChange.roots.length, 1); assert.equal(Number(afterChange.profile[0].grant_spent), 300);
      const forbidden = await refusal(changing, 'POST', `${base}/run`, standard(changing), 'fresh-after-real-owner-revoke', true); assert.match(forbidden.body.message, /production_consent/); await global();
    } finally { await ownerHold.query('ROLLBACK'); ownerHold.release(); }
  }
  const estate = await G.withTwoCharacters(app.pool, foreign.account, producer.id, (_ch, target, c, h) => runEstate(c, h, target, 'combined production actual estate'), { meet: false });
  assert.notEqual(estate.heirId, producer.id); const prestige = Number((await app.pool.query('SELECT prestige FROM account_persistent WHERE account_id=$1', [producer.account])).rows[0].prestige);
  assert.equal(Number((await app.pool.query('SELECT cash FROM characters WHERE id=$1', [estate.heirId])).rows[0].cash), 500 + 100 * prestige);
  const history = await run(producer, standard(producer), 'scoped-owner-grant', false); delete history.replayed; assert.deepEqual(history, made);
  await refusal(producer, 'POST', `${base}/run`, standard(producer), 'heir-cannot-old-business', true); await global();
  console.log(`combined production ${version} PASS: actual registered F01/F03/F05 JWT APIs, canonical GTA/salvage inputs, baseline and scoped grants, real Mystery four ordinary origins100→90/tempered150→140, source/grade immutability, budgets/replay/estate/privacy${native ? ', native late cross-ledger rollback/input-expiry/same-key contention' : ''}`);
} finally { await app.close(); await app.pool.end(); }
