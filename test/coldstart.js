// ── LAUNCH DAY, SCALE 1 — the first player on a world with no history ───────────────────────────
//
// Every other guard here checks a system that HAS data. This one checks the opposite, because it is
// the state the game is actually in the hour it opens: no season has ended, no monument has been
// funded, no event has resolved, no leaderboard has anyone on it, and — with POPULATION_OFF — there
// is not even scenery to fill the boards. A board that divides by a total of zero, or reads `[0]` of
// an empty ranking, or assumes a `current` row exists, is correct in every test that seeds a fixture
// and 500s on the first person through the door.
//
// So: boot the emptiest possible world, create ONE character, and issue every authed GET the server
// mounts. Every one must answer 2xx, or be a DECLARED tombstone — a route deliberately kept mounted
// so a client that still calls it learns what happened instead of 404-guessing (the /v1/wage
// precedent). Catalog-or-declare, the same discipline as the client guard's NOT_API list: a new
// refusal is a decision on the record rather than a silent regression.
//
// This is deliberately the SERVER's half of a pair. `tools/mobile.js` drives the screens in a real
// browser and would catch a page that renders `undefined`; nothing before this asserted that the
// endpoints behind them answer at all when the world is empty.
process.env.MOD_KEY = 'test-mod-key';
process.env.POPULATION_OFF = 'on';   // no residents: the emptiest world the game can be in
process.env.WORLD_GRAPH_KERNEL = 'off';
process.env.COORDINATION_OPERATIONS = 'off';
process.env.CHAIN_RPC_URL = ''; // this fixture deliberately has no funded-chain configuration
import assert from 'node:assert';
import crypto from 'node:crypto';
import { buildServer } from './server-fixture.js';
import * as Game from '../src/game.js';
import * as Depot from '../src/depot.js';
import * as Items from '../src/items.js';
import * as Craft from '../src/crafting.js';

const app = await buildServer();

const j = async (method, url, token, payload, extraHeaders = {}) => {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  if (token) headers.authorization = `Bearer ${token}`;
  const res = await app.inject({ method, url, headers, payload });
  let body = null;
  try { body = res.json(); } catch { /* a static/HTML route */ }
  return { code: res.statusCode, body };
};

// ── A DECLARED refusal, with the reason it is not a defect ──────────────────────────────────────
// The rule for adding a line here: the refusal must be something a player is SUPPOSED to see. A
// route that refuses because the world is empty does not belong here — that is the bug this file
// exists to find.
const DECLARED = {
  '/v1/genesis-auction': 'genesis payments stay unavailable until deployed code, funding and binding are verified through the pinned production manifest',
  '/v1/identity/readiness': 'NFT checkout is dormant without chain configuration; readiness must refuse with chain_unconfigured rather than offer an unchecked payment',
  '/v1/wage': 'retired — the Street Wage faucet is gone (economy v3 step 1); the route stays mounted so a polling client learns that instead of 404-guessing',
  '/v1/portfolio': 'retired — D11 removed the stock layer; the tombstone tells a stale client why',
  '/v1/leaderboard/portfolio': 'retired with the portfolio (D11)',
  '/v1/leaderboard/family-portfolio': 'retired with the portfolio (D11)',
  '/v1/rwa/health': 'dormant until the finalized StockTokenRegistryV2 authority is configured; failing closed with health_registry_unavailable is safer than publishing fabricated health for an unknown registry',
  '/v1/worldgraph/state': 'the kernel pilot is explicitly disabled by default; its authenticated state facade refuses with world_unavailable',
  '/v1/worldgraph/objects': 'the kernel pilot is explicitly disabled by default; its authenticated object catalog refuses with world_unavailable',
  '/v1/worldgraph/kernel/recipes': 'the kernel pilot is explicitly disabled by default; its authenticated recipe catalog refuses with world_unavailable',
  '/v1/coordination/operations': 'Family operation coordination is explicitly disabled by default; its authenticated catalog refuses with coordination_operation_unavailable',
  '/v1/projections/world': 'World projections reuse the explicitly disabled kernel rollout and refuse with projection_unavailable',
  '/v1/commands': 'the command pilot reuses the explicitly disabled kernel rollout; its opaque command_unavailable refusal intentionally does not distinguish disabled rollout, excluded cohort or unavailable current state',
  '/v1/city/nearby-chat': 'nearby chat requires explicit consent; a first player who has not joined must receive city_chat_opt_in_required, even when the district has no messages',
  '/v1/city/home/interior': 'a scoped interior requires a canonical owned deed or an accepted current invitation; a first player without either receives the opaque home_unavailable gate',
  '/v1/crew/logistics': 'private Crew logistics requires current membership; the first unaffiliated player must receive no_crew rather than a fabricated or foreign Crew view',
  // Not an endpoint: the websocket upgrade path. A plain GET is correctly not a thing it serves.
  '/v1/ws': 'the websocket upgrade path, not a GET endpoint',
};

// ── the first player, on an empty world ─────────────────────────────────────────────────────────
const guest = await j('POST', '/v1/auth/guest', null, {});
assert.equal(guest.code, 200, 'a guest can sign in on an empty world');
const token = guest.body?.token;
assert(token, 'and gets a token');

const made = await j('POST', '/v1/character', token, { name: 'Cold Start' });
assert(made.code < 400, `the first character can be created (got ${made.code} ${JSON.stringify(made.body)})`);

// A scoped recovery read needs genuine owned business/tool provenance, even for the first player.
// Explicit memory-fixture cash/materials fund the real canonical depot and standard craft.
const recoveryAccount = app.jwt.verify(token).sub;
const recoveryActor = (await app.pool.query('SELECT id,cash FROM characters WHERE account_id=$1 AND alive=true', [recoveryAccount])).rows[0];
assert(recoveryActor, 'the original first player owns the recovery fixture');
await app.pool.query("UPDATE characters SET cash=20000,loc='foundry',respect=10000 WHERE id=$1", [recoveryActor.id]);
await Game.ledger(app.pool, { characterId: recoveryActor.id, currency: 'cash',
  amount: 20000 - Number(recoveryActor.cash), reason: 'crime:cold-start-equipment-fixture' });
const originalDepotPilot = process.env.DEPOT_PILOT;
let recoveryBusinessId;
try {
  process.env.DEPOT_PILOT = 'on';
  recoveryBusinessId = (await Game.withCharacter(app.pool, recoveryAccount, (ch, c, h) =>
    Depot.openDepot(ch, { salePrice: 600, bidPrice: 500, targetStock: 2, reorderAt: 0, restockBudget: 2000 }, c, h))).id;
} finally {
  if (originalDepotPilot === undefined) delete process.env.DEPOT_PILOT;
  else process.env.DEPOT_PILOT = originalDepotPilot;
}
await app.pool.query("INSERT INTO character_skills(character_id,skill_id) VALUES($1,'fence_network')", [recoveryActor.id]);
const recoveryOwner = { scope: 'account', id: recoveryAccount };
const recoveryCraft = await Items.withItemTransaction(app.pool, async c => {
  await Items.grantStack(c, recoveryOwner, 'mat:hardened_steel', 1, 'standard', 'explicit cold-start recovery test input', 'cold-start-recovery-steel');
  await Items.grantStack(c, recoveryOwner, 'mat:salvage_parts', 2, 'standard', 'explicit cold-start recovery test input', 'cold-start-recovery-parts');
  return Craft.craftWorldGraphRecipe(c, { accountId: recoveryAccount }, 'recipe:precision_lock_tool', 'cold-start-recovery-craft');
});
assert.equal(recoveryCraft.outputs.length, 1, 'the actual standard recipe creates one supported tool');
const recoveryItemId = recoveryCraft.outputs[0].id;
const equipmentRecoveryReadPath = '/v1/equipment-recovery?' + new URLSearchParams({ businessId: recoveryBusinessId, itemId: recoveryItemId });
const assertEquipmentRecoveryInspection = response => {
  assert.equal(response.code, 200, 'a valid owned equipment query must serve the first player');
  assert.deepEqual(Object.keys(response.body).sort(), ['businessId', 'eligible', 'itemId', 'maximum', 'originalCharacterId', 'remaining', 'revision', 'sourceHash']);
  assert.equal(response.body.businessId, recoveryBusinessId);
  assert.equal(response.body.itemId, recoveryItemId);
  assert.equal(response.body.originalCharacterId, recoveryActor.id);
  assert.equal(response.body.remaining, 100);
  assert.equal(response.body.maximum, 100);
  assert.equal(response.body.eligible, false, 'inspection does not turn a new tool into worn recovery');
  assert(Number.isSafeInteger(response.body.revision) && response.body.revision >= 0);
  assert.match(response.body.sourceHash, /^[a-f0-9]{64}$/);
};
for (const [url, error, message] of [
  ['/v1/equipment-recovery', 'equipment_recovery_terms', 'query'],
  [equipmentRecoveryReadPath + '&owner=foreign', 'equipment_recovery_terms', 'query'],
  ['/v1/equipment-recovery?' + new URLSearchParams({ businessId: recoveryBusinessId, itemId: '' }), 'equipment_recovery_identity', 'Phase 2 registry operation could not complete.'],
]) {
  const malformed = await j('GET', url, token);
  assert.equal(malformed.code, 400, 'missing, additional and invalid query terms remain malformed');
  assert.equal(malformed.body?.error, error); assert.equal(malformed.body?.message, message);
  assert.throws(() => assertEquipmentRecoveryInspection(malformed), { name: 'AssertionError' },
    'a malformed equipment request cannot pass as a successful inspection');
}
assertEquipmentRecoveryInspection(await j('GET', equipmentRecoveryReadPath, token));

// Nearby reads require the current viewer tuple issued by the private social board.
const social = await j('GET', '/v1/city/social', token);
assert.equal(social.code, 200, 'the first player can read their social preferences');
assert.equal(social.body?.preferences?.chatEnabled, false, 'nearby consent begins off');
assert.equal(social.body?.chat?.available, false);
const nearbyReadPath = social.body?.chat?.readPath;
const nearbyUrl = new URL(nearbyReadPath, 'http://cold-start.invalid');
assert.equal(nearbyUrl.pathname, '/v1/city/nearby-chat');
assert.deepEqual([...nearbyUrl.searchParams].sort(),
  Object.entries(social.body.viewer).map(([key, value]) => [key, String(value)]).sort(),
  'the issued nearby read is bound to the current character, generation and district');
const assertNearbyRefusal = response => {
  assert.equal(response.code, 403, 'an issued nearby read must refuse only because consent is off');
  assert.equal(response.body?.error, 'city_chat_opt_in_required', 'nearby must report its exact consent gate');
};
const missingViewer = await j('GET', '/v1/city/nearby-chat', token);
assert.equal(missingViewer.code, 400, 'omitting mandatory viewer query is malformed, not a declared opt-out');
assert.throws(() => assertNearbyRefusal(missingViewer), { name: 'AssertionError' }, 'the same declaration oracle rejects the actual malformed request');
assert.throws(() => assertNearbyRefusal({ code: 403, body: { error: 'unrelated_refusal' } }),
  { name: 'AssertionError' }, 'a different refusal can never inherit the consent declaration');

// The home directory requires a real district, even when that district has no deeds.
const homesReadPath = '/v1/city/homes?' + new URLSearchParams({ district: social.body.viewer.district });
const assertEmptyHomes = response => {
  assert.equal(response.code, 200, 'the first player can inspect their actual district');
  assert.deepEqual(response.body.viewer, social.body.viewer);
  assert.equal(response.body.districtId, social.body.viewer.district);
  assert.equal(response.body.placement, 'illustrative');
  assert.deepEqual(response.body.homes, []);
  assert.equal(response.body.myHome, null);
  assert.equal(response.body.nextCursor, null);
  assert.equal(response.body.total, 0);
};
const missingDistrict = await j('GET', '/v1/city/homes', token);
assert.equal(missingDistrict.code, 400, 'omitting the mandatory district is malformed');
assert.equal(missingDistrict.body?.error, 'city_homes_district');
assert.throws(() => assertEmptyHomes(missingDistrict), { name: 'AssertionError' },
  'a malformed home query cannot pass as an empty directory');

// Interior reads require an explicit address, even before the first player owns a deed.
const interiorReadPath = '/v1/city/home/interior?' + new URLSearchParams({ homeKey: 'cold-start-home' });
const assertInteriorRefusal = response => {
  assert.equal(response.code, 400, 'a scoped unavailable interior must refuse access');
  assert.equal(response.body?.error, 'home_unavailable', 'interiors must report only the opaque deed/consent gate');
};
const missingHome = await j('GET', '/v1/city/home/interior', token);
assert.equal(missingHome.code, 400, 'omitting the mandatory home address is malformed');
assert.equal(missingHome.body?.error, 'bad_home_request');
assert.throws(() => assertInteriorRefusal(missingHome), { name: 'AssertionError' },
  'a malformed interior query cannot inherit the deed/consent declaration');
assert.throws(() => assertInteriorRefusal({ code: 400, body: { error: 'unrelated_refusal' } }),
  { name: 'AssertionError' }, 'a different refusal cannot inherit the home declaration');

// Decision replay requires an explicit supported history kind, even on an empty world.
const decisionReplayReadPath = '/v1/agent/decision-replay?kind=intelligence_purchase';
const assertEmptyDecisionReplay = (response, kind) => {
  assert.equal(response.code, 200, 'a valid history query serves the first player');
  assert.equal(response.body?.kind, kind);
  assert.deepEqual(response.body?.candidates, []);
  assert.equal(response.body?.next, null);
  assert.equal(response.body?.windowDays, 30);
  assert.equal(response.body?.readOnly, true);
  assert.equal(response.body?.performanceClaim, 'none');
};
const missingReplayKind = await j('GET', '/v1/agent/decision-replay', token);
assert.equal(missingReplayKind.code, 400, 'omitting the required history kind is malformed');
assert.equal(missingReplayKind.body?.error, 'decision_replay');
assert.equal(missingReplayKind.body?.message, 'terms');
assert.throws(() => assertEmptyDecisionReplay(missingReplayKind, 'intelligence_purchase'),
  { name: 'AssertionError' }, 'a malformed history query cannot pass as a valid empty board');
for (const kind of ['intelligence_purchase', 'forecast_memory'])
  assertEmptyDecisionReplay(await j('GET', '/v1/agent/decision-replay?kind=' + kind, token), kind);

// Every mounted authed GET, minus the mod perimeter (its own credential) and param routes (they need
// an id, which by definition means data exists — that is what the client guard's fixtures cover).
const parameterlessGets = (app.routes || [])
  .filter((r) => r.method === 'GET')
  .filter((r) => r.url.startsWith('/v1/'))
  .filter((r) => !r.url.includes('/mod/'))
  .filter((r) => !r.url.includes(':'));
const reviewerGets = parameterlessGets.filter((r) => r.authKind === 'rwaReviewerAuth');
const delegatedGets = parameterlessGets.filter((r) => r.authKind === 'gatewayAuth');
assert.deepEqual(delegatedGets.map((r) => r.url).sort(), [
  '/v1/gateway/capabilities', '/v1/gateway/events', '/v1/gateway/events/catalog',
  '/v1/gateway/events/stream', '/v1/gateway/subscriptions',
], 'the delegated perimeter uses its own credential and subscription context');
for (const route of delegatedGets) assert.equal((await j('GET', route.url, token)).code, 401,
  'ordinary player JWTs cannot substitute for a scoped connection: ' + route.url);
const connection = await j('POST', '/v1/gateway/connections', token,
  { provider: 'muse', label: 'Cold-start adviser', scopes: ['omerta.player.read', 'omerta.world.read'] });
assert.equal(connection.code, 200);
for (const url of ['/v1/gateway/capabilities', '/v1/gateway/events/catalog', '/v1/gateway/subscriptions'])
  assert.equal((await j('GET', url, connection.body.token)).code, 200, url + ' works with scoped credentials on an empty world');
const subscription = await j('POST', '/v1/gateway/subscriptions', connection.body.token, { topics: ['world.event.resolved'] });
assert.equal(subscription.code, 200);
const emptyEvents = await j('GET', '/v1/gateway/events?subscriptionId=' + subscription.body.id, connection.body.token);
assert.equal(emptyEvents.code, 200);
assert.deepEqual(emptyEvents.body.events, []);
assert.deepEqual(reviewerGets.map((r) => r.url), ['/v1/rwa/reviewer/queue'],
  'the one trusted reviewer GET is classified and excluded from the player cold-start probe');
const paths = [...new Set(parameterlessGets
  .filter((r) => !['rwaReviewerAuth', 'gatewayAuth'].includes(r.authKind))
  .map((r) => r.url))].sort();
const defaultOff = new Map([
  ['/v1/worldgraph/state', 'world_unavailable'],
  ['/v1/worldgraph/objects', 'world_unavailable'],
  ['/v1/worldgraph/kernel/recipes', 'world_unavailable'],
  ['/v1/coordination/operations', 'coordination_operation_unavailable'],
  ['/v1/projections/world', 'projection_unavailable'],
  ['/v1/commands', 'command_unavailable'],
]);
for (const p of defaultOff.keys()) assert(paths.includes(p), `default-off route disappeared: ${p}`);
assert(paths.includes('/v1/city/nearby-chat'), 'the nearby route remains in the complete cold-start enumeration');
assert(paths.includes('/v1/market/feed'), 'the public feed remains in the complete cold-start enumeration');
assert(paths.includes('/v1/city/homes'), 'the home directory remains in the complete cold-start enumeration');
assert(paths.includes('/v1/city/home/interior'), 'the interior remains in the complete cold-start enumeration');
assert(paths.includes('/v1/agent/decision-replay'), 'the history board remains in the complete cold-start enumeration');
assert(paths.includes('/v1/equipment-recovery'), 'the equipment inspection remains in the complete cold-start enumeration');

// Anti-vacuity: an empty list is what a broken route registry looks like, and it would pass silently.
assert(paths.length >= 120,
  `only ${paths.length} parameterless authed GET route(s) found — the route registry has stopped `
  + 'reporting them, so this check is passing over endpoints it never called');

const broke = [];
const declaredHit = new Set();
for (const p of paths) {
  const readPath = p === '/v1/city/nearby-chat' ? nearbyReadPath
    : p === '/v1/market/feed' ? '/v1/market/feed?districtId=docks&goodId=gin'
      : p === '/v1/city/homes' ? homesReadPath
        : p === '/v1/city/home/interior' ? interiorReadPath
          : p === '/v1/agent/decision-replay' ? decisionReplayReadPath
            : p === '/v1/equipment-recovery' ? equipmentRecoveryReadPath : p;
  const r = await j('GET', readPath, token);
  if (p === '/v1/market/feed') assert.equal(r.code, 200, 'the scoped public feed serves an empty world');
  if (p === '/v1/city/homes') assertEmptyHomes(r);
  if (p === '/v1/agent/decision-replay') assertEmptyDecisionReplay(r, 'intelligence_purchase');
  if (p === '/v1/equipment-recovery') assertEquipmentRecoveryInspection(r);
  if (r.code < 400) continue;
  if (DECLARED[p]) {
    if (p === '/v1/genesis-auction') {
      assert.equal(r.code, 503, 'unconfigured genesis must refuse payments');
      assert.equal(r.body?.error, 'genesis_not_ready', 'genesis must report its verified-deployment gate');
    }
    if (p === '/v1/identity/readiness') {
      assert.equal(r.code, 400, 'unconfigured NFT readiness must fail closed');
      assert.equal(r.body?.error, 'chain_unconfigured', 'readiness must report the configuration refusal');
    }
    if (defaultOff.has(p)) {
      assert.equal(r.code, p === '/v1/commands' ? 409 : 404, `${p} must fail closed for its disabled rollout`);
      assert.equal(r.body?.error, defaultOff.get(p), `${p} must return its declared rollout refusal`);
    }
    if (p === '/v1/city/nearby-chat') assertNearbyRefusal(r);
    if (p === '/v1/city/home/interior') assertInteriorRefusal(r);
    if (p === '/v1/crew/logistics') {
      assert.equal(r.code, 400, 'private logistics requires actual Crew membership');
      assert.equal(r.body?.error, 'no_crew', 'logistics must report its exact membership prerequisite');
    }
    declaredHit.add(p); continue;
  }
  broke.push(`${p} → ${r.code} ${JSON.stringify(r.body).slice(0, 120)}`);
}

assert.equal(broke.length, 0,
  'endpoint(s) that fail for the FIRST player on an empty world. This is the launch-hour state, so a\n'
  + '      refusal here is a defect unless it is something the player is supposed to see — in which case\n'
  + `      declare it in DECLARED with the reason:\n   - ${broke.join('\n   - ')}`);

// The declaration list is checked in BOTH directions: a stale entry is a route that has quietly come
// back to life (or been renamed), and leaving it listed would waive a future regression on that path.
const stale = Object.keys(DECLARED).filter((p) => paths.includes(p) && !declaredHit.has(p));
assert.equal(stale.length, 0,
  `DECLARED lists route(s) that no longer refuse — remove them, or the waiver hides the next regression:\n   - ${stale.join('\n   - ')}`);

// After the default-off enumeration, the actual issued Join action opens an empty district feed.
const join = social.body.actions.find(action => action.id === 'chat:enable');
assert(join, 'the first player is issued an explicit Join action');
assert.equal(join.method, 'POST'); assert.equal(join.path, '/v1/city/social/preferences');
assert.equal(join.available, true);
assert.deepEqual(join.body, { ...social.body.viewer, chatEnabled: true });
const joined = await j(join.method, join.path, token, join.body, { 'idempotency-key': crypto.randomUUID() });
assert.equal(joined.code, 200, `issued Join succeeds with its own request key: ${JSON.stringify(joined.body)}`);
const joinedSocial = await j('GET', '/v1/city/social', token);
assert.equal(joinedSocial.code, 200); assert.equal(joinedSocial.body?.preferences?.chatEnabled, true);
assert.equal(joinedSocial.body?.chat?.available, true);
assert.deepEqual(joinedSocial.body.viewer, social.body.viewer);
const emptyNearby = await j('GET', joinedSocial.body.chat.readPath, token);
assert.equal(emptyNearby.code, 200, 'joining explicitly makes a valid empty-world nearby read succeed');
assert.deepEqual(emptyNearby.body?.messages, [], 'the first joined player sees an actual empty feed');

await app.close();
console.log(`✅ cold start passed — all ${paths.length - declaredHit.size} parameterless authed GET routes answer for `
  + 'the FIRST player on a world with no season, no monument, no event, no leaderboard and not even a '
  + `resident to fill the boards; the ${declaredHit.size} that refuse are declared tombstones, checked in `
  + 'both directions so a waiver cannot outlive the thing it waives.');
