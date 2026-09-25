// Bounded RC1-04 legacy perimeter and direct ownership-transfer regression.
// Native PostgreSQL only. No external signer, provider, webhook or worker is used.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildServer } from '../src/server.js';
import { withItemTransaction, createItem } from '../src/items.js';
import { compileContentPack } from '../src/content/compiler.js';
import { GOODS, GEAR_TOKEN_IDS } from '../src/rules.js';

assert(process.env.COORDINATION_TEST_DATABASE_URL, 'Explicit isolated loopback PostgreSQL required');
assert(['127.0.0.1', 'localhost', '[::1]'].includes(new URL(process.env.COORDINATION_TEST_DATABASE_URL).hostname));
if (!process.argv.includes('--postgres')) process.argv.push('--postgres');
const { commandDatabase, addPlayer, characterId } = await import('./lib/player-command-support.js');
const directory = path.resolve(process.env.RC1_LEGACY_AUTHORITY_OUTPUT || 'output/rc1-legacy-authority');
fs.mkdirSync(directory, { recursive: true }); fs.mkdirSync(path.join(directory, 'states'), { recursive: true });
const output = path.join(directory, 'results.json'); assert(!fs.existsSync(output), 'Retain prior evidence; choose a new output directory');
const sha = (value) => crypto.createHash('sha256').update(value).digest('hex');
const census = JSON.parse(fs.readFileSync('docs/release/readiness-work/authority-inventory.json'));
const modRoutes = census.routes.filter(r => r.mountedAuth.authKind === 'modAuth');
const report = { status: 'RUNNING', source: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  dirty: !!execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim(),
  harnessSha256: sha(fs.readFileSync(new URL(import.meta.url))), startedAt: new Date().toISOString(), node: process.version,
  sourceFiles: Object.fromEntries(['src/server.js', 'src/routes/modtools.js', 'src/routes/content.js', 'src/routes/worldgraph.js',
    'src/social/exchange.js', 'src/market.js', 'src/content/exchange.js', 'src/deeds.js', 'src/chain.js', 'src/game.js', 'src/ratelimit.js', 'package-lock.json']
    .map(file => [file, sha(fs.readFileSync(file))])),
  scope: 'All mounted moderator mutation authentication boundaries and enumerated legacy direct ownership-transfer probes; partial route review.',
  configuration: { database: 'explicit loopback native PostgreSQL private schema', rateLimit: 'off except explicit local in-memory limiter tests',
    developmentTransferOnly: process.argv.includes('--transfers-only'),
    providerAndChainConfiguration: 'external providers, signers, RPC, Redis and webhooks disabled', socialVerification: 'off', coreProgression: 'on' },
  setup: 'Three funded characters and one account without character; initial cars, ammo, deeds and one unsigned foreign voucher are declared SQL fixtures. Assignable item is created by item service. Real Bellini bundle is activated and source materials/listings prepared through canonical HTTP before measured probes. Last-accrued checkpoints are placed one hour ahead before baseline to isolate action effects from the separately committed normal clock settlement.',
  routes: [], cases: [], positives: [], exclusions: ['Full529-route review', 'privileged economic administration effects except local revoke control',
    'vendor purchases and combat rewards', 'loan-note finance', 'production signer/provider/Redis behavior', 'full client DOM XSS/browser CSRF proof', 'all authored transfer definitions'] };
const save = () => fs.writeFileSync(output, JSON.stringify(report, null, 2)); save();
for (const key of ['JWT_SECRET', 'MARKET_SEED', 'MOD_KEY']) process.env[key] = crypto.randomBytes(32).toString('hex');
for (const key of Object.keys(process.env)) if (/^(CHAIN_|VOUCHER_|PRIVY_|X_OAUTH|INVARIANT_WEBHOOK|DISCORD_|REDIS_URL)/.test(key)) delete process.env[key];
Object.assign(process.env, { RATE_LIMIT: 'off', INVITE_MODE: 'off', POPULATION_OFF: 'on', SOCIAL_VERIFY_MODE: 'off',
  CORE_PROGRESSION: 'on', WORLD_GRAPH_KERNEL: 'on' });
delete process.env.X_TRUST_USER_TOKEN;
let db, app;
try {
  db = await commandDatabase('legacy_authority');
  const schema = (await db.pool.query('SELECT current_schema() AS name')).rows[0].name;
  assert(/^command_legacy_authority_[a-f0-9]+$/.test(schema));
  const endpoint = new URL(process.env.COORDINATION_TEST_DATABASE_URL); endpoint.searchParams.set('options', `-c search_path=${schema}`);
  process.env.DATABASE_URL = endpoint.toString(); app = await buildServer();
  report.postgres = (await app.pool.query('SELECT version() AS version')).rows[0].version;
  const owner = 'legacy-owner', ordinary = 'legacy-ordinary', buyer = 'legacy-buyer', fresh = 'legacy-new';
  for (const account of [owner, ordinary, buyer]) await addPlayer(app.pool, account, account, 'foundry');
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES($1,'guest',$1)", [fresh]);
  await app.pool.query('INSERT INTO account_persistent(account_id) VALUES($1)', [fresh]);
  await app.pool.query('UPDATE characters SET ammo=100 WHERE account_id=$1', [owner]);
  const carId = crypto.randomUUID();
  await app.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',30)", [carId, characterId(owner)]);
  await app.pool.query("INSERT INTO street_deeds(account_id,name,name_lc,district) VALUES($1,'Legacy Test Street','legacy test street','docks')", [owner]);
  await app.pool.query("INSERT INTO vouchers(id,account_id,kind,amount,nonce,to_address,deadline) VALUES('legacy-foreign-voucher',$1,'omr',1,9001,$2,2000000000)", [owner, '0x1111111111111111111111111111111111111111']);
  const assignedItem = await withItemTransaction(app.pool, client => createItem(client, { scope: 'account', id: owner }, 'item:precision_lock_tool', 'crafted', 'legacy-fixture-tool'));
  const tokens = Object.fromEntries([owner, ordinary, buyer, fresh].map(a => [a, app.jwt.sign({ sub: a, tv: 0 })]));
  const privilegedClaim = app.jwt.sign({ sub: ordinary, tv: 0, role: 'admin', isModerator: true });
  const request = (method, url, payload = {}, account = ordinary, headers = {}, key = crypto.randomUUID()) => app.inject({ method, url,
    headers: { ...(account ? { authorization: `Bearer ${tokens[account]}` } : {}), 'idempotency-key': key, ...headers }, payload });
  const ok = async (...args) => { const response = await request(...args); assert.equal(response.statusCode, 200, response.body); return response.json(); };
  const bundle = compileContentPack(JSON.parse(fs.readFileSync('content/packs/bellini-lockbox-v4/pack.json')));
  await ok('POST', '/v1/mod/content/activate', { bundle, expectedHash: bundle.contentHash }, null, { 'x-mod-key': process.env.MOD_KEY });
  const namespace = 'omerta.workshop.bellini-lockbox', contentBase = `/v1/content/${namespace}/exchange`;
  for (const account of [owner, buyer]) for (const source of ['foundry-plate-salvage', 'archive-binding-salvage'])
    await ok('POST', `/v1/content/${namespace}/sources/${source}/collect`, { expectedContentHash: bundle.contentHash }, account);
  const barterBody = { expectedContentHash: bundle.contentHash, offeredItemId: 'ledger-plate', offeredQuantity: 1,
    requestedItemId: 'charred-binding', requestedQuantity: 1 };
  const barter = await ok('POST', `${contentBase}/list`, barterBody, owner);
  const barterId = barter.receipt.id; assert(barterId);
  const listing = await ok('POST', '/v1/exchange/list', { kind: 'ammo', qty: 10, unitPrice: 100 }, owner);
  const carListing = await ok('POST', '/v1/market', { carId, minBid: 1000, buyNow: 2000 }, owner);
  const order = await ok('POST', '/v1/market/order', { goodId: GOODS[0].id, qty: 1, price: 1000 }, owner);
  // withCharacter intentionally commits clock settlement before an action can
  // refuse. Suppress that independent clock phase using a declared initial
  // checkpoint; do not normalize away or rewrite any post-baseline state.
  await app.pool.query("UPDATE characters SET last_accrued_at=now()+interval '1 hour'");
  const mounted = app.routes.filter(r => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(r.method) && r.authKind === 'modAuth');
  assert.deepEqual(mounted.map(r => `${r.method} ${r.url}`).sort(), modRoutes.map(r => r.id).sort());
  const tableNames = (await app.pool.query('SELECT tablename FROM pg_tables WHERE schemaname=$1 ORDER BY tablename', [schema])).rows.map(r => r.tablename);
  assert(tableNames.every(t => /^[a-z_0-9]+$/.test(t)));
  // One statement gives a single native MVCC snapshot. Include every game table;
  // the HTTP cache is transport state and is independently tested by exact retries.
  const compared = tableNames.filter(t => t !== 'idempotency'); report.authorityTables = compared;
  const stateSQL = compared.map(t => `SELECT '${t}' AS name, COALESCE(jsonb_agg(v ORDER BY v::text),'[]'::jsonb)::text AS rows FROM (SELECT to_jsonb(t) AS v FROM "${t}" t) q`).join(' UNION ALL ');
  const snapshot = async () => {
    const rows = (await app.pool.query(stateSQL)).rows.sort((a, b) => a.name.localeCompare(b.name)), text = JSON.stringify(rows), hash = sha(text);
    const file = path.join(directory, 'states', `${hash}.json`); if (!fs.existsSync(file)) fs.writeFileSync(file, text);
    return { hash, rows };
  };
  const deny = async (id, expected, method, url, payload, account, headers = {}, key) => {
    const before = await snapshot(), response = await request(method, url, payload, account, headers, key), after = await snapshot();
    let body; try { body = response.json(); } catch { body = response.body; }
    const evidence = { id, method, url, expectedStatus: expected, actualStatus: response.statusCode, body,
      beforeSha256: before.hash, afterSha256: after.hash, status: 'RUNNING' };
    report.cases.push(evidence); save();
    assert.equal(response.statusCode, expected, `${id}: ${response.body}`);
    assert.doesNotMatch(response.body, /SELECT |INSERT |UPDATE |postgres|stack trace/i);
    assert.deepEqual(after.rows, before.rows, `${id}: rejected request changed authority`);
    evidence.status = 'PASS'; save(); return response;
  };
  const modPayload = { accountId: owner, characterId: characterId(owner), reason: 'isolated boundary probe', amount: 1, omr: 1 };
  for (const route of process.argv.includes('--transfers-only') ? [] : modRoutes) {
    const [method, pattern] = route.id.split(' '), url = pattern.replace(':day', '2026-09-21');
    const body = pattern.endsWith('/content/activate') ? { bundle: {}, expectedHash: '0'.repeat(64) } : modPayload;
    for (const [kind, account, headers] of [['unauthenticated', null, {}], ['new-account', fresh, {}], ['ordinary', ordinary, {}],
      ['privileged-jwt-claims', null, { authorization: `Bearer ${privilegedClaim}` }],
      ['wrong-mod-key', ordinary, { 'x-mod-key': '0'.repeat(64) }], ['cookie-only-mod-key', null, { cookie: `x-mod-key=${process.env.MOD_KEY}`, origin: 'https://untrusted.invalid' }]])
      await deny(`${route.id}:${kind}`, 401, method, url, body, account, headers);
    report.routes.push({ id: route.id, status: 'AUTH_BOUNDARY_VERIFIED_ONLY', source: route.sources,
      cases: report.cases.filter(c => c.id.startsWith(`${route.id}:`)).map(c => c.id),
      remaining: 'Privileged target/cost/effect branches not executed by these credential denials; do not infer payload safety or release clearance.' }); save();
  }
  const gear = Object.keys(GEAR_TOKEN_IDS)[0]; assert(gear);
  const basic = [
    ['POST', '/v1/auth/upgrade', { provider: 'x', token: 'invalid-local-provider-token', accountId: owner }],
    ['POST', '/v1/wallet/verify', { address: '0x1111111111111111111111111111111111111111', signature: '0x00', accountId: owner }],
    ['POST', '/v1/character/mint', {}], ['POST', '/v1/character/reroll', {}], ['POST', '/v1/character/forge', {}],
    ['POST', '/v1/garage/:carId/fence', {}, `/v1/garage/${carId}/fence`], ['POST', '/v1/garage/:carId/melt', {}, `/v1/garage/${carId}/melt`],
    ['POST', '/v1/exchange/list', { kind: 'ammo', qty: 30, unitPrice: 100, seller_character: characterId(owner) }],
    ['DELETE', '/v1/exchange/:id', {}, `/v1/exchange/${listing.listingId}`],
    ['POST', '/v1/exchange/:id/buy', {}, `/v1/exchange/${listing.listingId}/buy`, owner],
    ['POST', '/v1/market', { carId, minBid: 1000 }],
    ['POST', '/v1/market/:id/bid', { amount: 1 }, `/v1/market/${carListing.id}/bid`],
    ['POST', '/v1/market/:id/buy', {}, `/v1/market/${carListing.id}/buy`, owner],
    ['POST', '/v1/market/:id/cancel', {}, `/v1/market/${carListing.id}/cancel`],
    ['POST', '/v1/market/order', { goodId: GOODS[0].id, qty: 1000000000, price: 1000 }],
    ['POST', '/v1/market/:id/fill', { qty: 1 }, `/v1/market/${order.id}/fill`],
    ['POST', '/v1/market/:id/claim', {}, `/v1/market/${order.id}/claim`],
    ['POST', '/v1/content/:namespace/exchange/list', barterBody, `${contentBase}/list`],
    ['POST', '/v1/content/:namespace/exchange/:listingId/cancel', { expectedContentHash: bundle.contentHash }, `${contentBase}/${barterId}/cancel`],
    ['POST', '/v1/content/:namespace/exchange/:listingId/fill', { expectedContentHash: bundle.contentHash }, `${contentBase}/${barterId}/fill`],
    ['POST', '/v1/worldgraph/items/:itemId/assign-current-character', {}, `/v1/worldgraph/items/${assignedItem.id}/assign-current-character`],
    ['POST', '/v1/deeds/claim', { name: '<img onerror=x>', district: 'docks' }],
    ['POST', '/v1/deeds/list', { price: 500000, accountId: owner }], ['POST', '/v1/deeds/unlist', { accountId: owner }],
    ['POST', '/v1/deeds/buy/:sellerCharacterId', {}, `/v1/deeds/buy/${characterId(owner)}`],
    ['POST', '/v1/deeds/extract', { address: '0x1111111111111111111111111111111111111111', attest: true }],
    ['POST', '/v1/gear/:id/mint', {}, `/v1/gear/${gear}/mint`], ['POST', '/v1/gear/:id/withdraw', {}, `/v1/gear/${gear}/withdraw`],
    ['POST', '/v1/nft/:kind/:id/withdraw', {}, `/v1/nft/car/${carId}/withdraw`], ['POST', '/v1/identity/mint', {}],
    ['POST', '/v1/withdraw', { amount: 1 }], ['POST', '/v1/withdraw/:id/cancel', {}, '/v1/withdraw/legacy-foreign-voucher/cancel'],
    ['POST', '/v1/mentor/gift/:protegeCharId', {}, `/v1/mentor/gift/${characterId(owner)}`],
  ];
  for (const [method, pattern, body, concrete, actor = ordinary] of basic) {
    assert(app.routes.some(r => r.method === method && r.url === pattern), pattern);
    const url = concrete || pattern;
    for (const [kind, account, code] of [['unauthenticated', null, 401], ['new-account', fresh, 400], ['ordinary-or-specified-owner', actor, 400]])
      await deny(`${method} ${pattern}:${kind}`, code, method, url, body, account);
    report.routes.push({ id: `${method} ${pattern}`, status: 'SELECTED_DENIAL_BRANCH_VERIFIED',
      cases: report.cases.filter(c => c.id.startsWith(`${method} ${pattern}:`)).map(c => c.id),
      remaining: 'Only the concrete setup/payload/role is proved; authored branches, full role combinations and configured chain/provider execution remain unverified.' }); save();
  }
  await deny('custody:owner-destination-injection', 400, 'POST', `/v1/worldgraph/items/${assignedItem.id}/assign-current-character`, { owner: ordinary, destination: characterId(ordinary) }, owner);
  await deny('exchange:SQL-ID-injection', 400, 'DELETE', `/v1/exchange/${encodeURIComponent("' OR '1'='1")}`, {}, ordinary);
  await deny('exchange:negative-quantity', 400, 'POST', '/v1/exchange/list', { kind: 'ammo', qty: -100, unitPrice: 100 }, owner);
  await deny('exchange:missing-price', 400, 'POST', '/v1/exchange/list', { kind: 'ammo', qty: 1 }, owner);
  await deny('character:stored-XSS-name', 400, 'POST', '/v1/character', { name: 'Legacy<img onerror=x>' }, fresh);
  await deny('character:unauthenticated', 401, 'POST', '/v1/character', { name: 'Legacy New Actor' }, null);
  await deny('character:ordinary-cannot-create-second-character', 400, 'POST', '/v1/character', { name: 'Legacy Duplicate' }, ordinary);
  await deny('cookie-only-player-CSRF', 401, 'DELETE', `/v1/exchange/${listing.listingId}`, {}, null,
    { cookie: `omerta_token=${tokens[owner]}`, origin: 'https://untrusted.invalid' });
  await deny('prototype-pollution-body', 400, 'POST', '/v1/exchange/list', '{"kind":"ammo","qty":1,"unitPrice":100,"__proto__":{"admin":true}}', owner, { 'content-type': 'application/json' });
  await deny('oversized-default-body', 413, 'POST', '/v1/exchange/list', { padding: 'x'.repeat(1024 * 1024 + 100) }, owner);
  await deny('wallet-challenge:unauthenticated', 401, 'POST', '/v1/wallet/challenge', {}, null);
  for (const account of [fresh, ordinary]) {
    const challenge = await ok('POST', '/v1/wallet/challenge', { accountId: owner }, account);
    assert(challenge.message.includes(`account: ${account}\n`));
    assert.equal((await app.pool.query('SELECT account_id FROM wallet_challenges WHERE account_id=$1', [account])).rowCount, 1);
  }
  const ownListing = await ok('POST', '/v1/exchange/list', { kind: 'ammo', qty: 1, unitPrice: 100, seller_character: characterId(owner) }, ordinary);
  assert.equal((await app.pool.query('SELECT seller_character FROM listings WHERE id=$1', [ownListing.listingId])).rows[0].seller_character, characterId(ordinary));
  await ok('POST', '/v1/character', { name: 'Legacy New Actor', accountId: owner }, fresh);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM characters WHERE account_id=$1 AND alive', [fresh])).rows[0].n), 1);
  assert.equal(Number((await app.pool.query('SELECT count(*) AS n FROM characters WHERE account_id=$1 AND alive', [owner])).rows[0].n), 1);
  report.routes.push({ id: 'POST /v1/character', status: 'SELECTED_IDENTITY_BINDING_AND_NAME_DENIALS_VERIFIED',
    cases: ['character:unauthenticated', 'character:stored-XSS-name', 'character:ordinary-cannot-create-second-character'],
    remaining: 'All birth/referral/provider races remain separate suites.' },
  { id: 'POST /v1/wallet/challenge', status: 'CALLER_IDENTITY_BINDING_VERIFIED', cases: ['wallet-challenge:unauthenticated'],
    remaining: 'No real wallet signing or configured provider proof.' });
  report.positives.push({ id: 'account-and-inventory-target-substitution', walletChallengeBoundToCaller: true,
    characterCreatedOnlyForCaller: true, inventoryListingBoundToCaller: true });
  const retryKey = crypto.randomUUID();
  const purchased = await ok('POST', `/v1/exchange/${listing.listingId}/buy`, { total: 0, seller: characterId(ordinary) }, buyer, {}, retryKey);
  assert.equal(purchased.paid, 1000); const bought = await snapshot();
  assert.deepEqual(await ok('POST', `/v1/exchange/${listing.listingId}/buy`, { total: 0, seller: characterId(ordinary) }, buyer, {}, retryKey), purchased);
  assert.equal((await snapshot()).hash, bought.hash);
  await deny('exchange:changed-body-same-key', 422, 'POST', `/v1/exchange/${listing.listingId}/buy`, { total: 1 }, buyer, {}, retryKey);
  report.positives.push({ id: 'exchange-authoritative-price-and-replay', paid: purchased.paid, exactReplayUnchanged: true });
  const custodyKey = crypto.randomUUID(), custodyUrl = `/v1/worldgraph/items/${assignedItem.id}/assign-current-character`;
  await ok('POST', custodyUrl, {}, owner, {}, custodyKey);
  const custody = (await app.pool.query('SELECT owner_scope,owner_id FROM item_instances WHERE id=$1', [assignedItem.id])).rows[0];
  assert.deepEqual(custody, { owner_scope: 'character', owner_id: characterId(owner) });
  const held = await snapshot(); await ok('POST', custodyUrl, {}, owner, {}, custodyKey); assert.equal((await snapshot()).hash, held.hash);
  report.positives.push({ id: 'custody-current-character-only', custody, exactReplayUnchanged: true });
  const revokeKey = crypto.randomUUID(), version = Number((await app.pool.query('SELECT token_version FROM accounts WHERE id=$1', [buyer])).rows[0].token_version);
  await ok('POST', '/v1/mod/revoke', { accountId: buyer }, null, { 'x-mod-key': process.env.MOD_KEY }, revokeKey);
  await deny('moderator-revoke-invalidates-live-player-token', 401, 'DELETE', '/v1/exchange/missing', {}, buyer);
  await ok('POST', '/v1/mod/revoke', { accountId: buyer }, null, { 'x-mod-key': process.env.MOD_KEY }, revokeKey);
  assert.equal(Number((await app.pool.query('SELECT token_version FROM accounts WHERE id=$1', [buyer])).rows[0].token_version), version + 2);
  report.positives.push({ id: 'moderator-revoke', playerTokenRevoked: true,
    replaySemantics: 'Moderator routes intentionally excluded from player HTTP idempotency hook: same key bumps token version twice. This probe does not assert exactly-once privileged effects.' });
  process.env.RATE_LIMIT = 'on'; process.env.RATE_AUTH_BURST = '2'; process.env.RATE_AUTH_PER_SEC = '0.0001';
  await deny('mod-rate:first', 401, 'POST', '/v1/mod/ban', modPayload, null);
  await deny('mod-rate:second', 401, 'POST', '/v1/mod/ban', modPayload, null);
  const limited = await deny('mod-rate:bounded-flood', 429, 'POST', '/v1/mod/ban', modPayload, null); assert(limited.headers['retry-after']);
  process.env.RATE_HUMAN_BURST = '2'; process.env.RATE_HUMAN_PER_SEC = '0.0001';
  await deny('player-rate:first', 400, 'DELETE', '/v1/exchange/missing', {}, ordinary);
  await deny('player-rate:second', 400, 'DELETE', '/v1/exchange/missing', {}, ordinary);
  assert((await deny('player-rate:bounded-flood', 429, 'DELETE', '/v1/exchange/missing', {}, ordinary)).headers['retry-after']);
  assert.equal(execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), report.source);
  for (const [file, digest] of Object.entries(report.sourceFiles)) assert.equal(sha(fs.readFileSync(file)), digest);
  assert.equal(sha(fs.readFileSync(new URL(import.meta.url))), report.harnessSha256);
  report.status = 'PASS_SCOPED'; report.sourceUnchanged = true; report.completedAt = new Date().toISOString(); save();
  console.log(JSON.stringify({ status: report.status, moderatorRoutes: report.routes.filter(r => r.status === 'AUTH_BOUNDARY_VERIFIED_ONLY').length, transferRoutes: basic.length,
    deniedRequests: report.cases.length, authorityTables: compared.length, source: report.source, output }));
} catch (error) { report.status = 'FAIL'; report.error = { message: error.message, stack: error.stack }; report.completedAt = new Date().toISOString(); save(); throw error; }
finally { if (app) { await app.close(); await app.pool.end(); } if (db) await db.cleanup(db.pool); }
