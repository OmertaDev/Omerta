import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
parse(main, { ecmaVersion: 'latest' });
const start = main.indexOf('  function createProjectionRefresh(');
const end = main.indexOf('  // End projection refresh coordinator.', start);
assert(start > 0 && end > start);
const context = vm.createContext({});
vm.runInContext(main.slice(start, end) + '\nthis.create = createProjectionRefresh;', context);
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const player = (id) => ({ code: 200, body: { schemaVersion: 1, player: { id, name: id } } });
const world = (id, secret) => ({ code: 200, body: { schemaVersion: 1, player: { character: { id } }, secret } });
function setup() {
  const calls = [], applied = [], cleared = []; let unauthorized = 0;
  const controller = context.create({
    request: (path, ticket) => new Promise((resolve) => calls.push({ path, ticket, resolve })),
    apply: (kind, result) => applied.push({ kind, result }), clear: (kind) => cleared.push(kind),
    unauthorized: () => { unauthorized++; },
  });
  controller.setSession('A');
  return { controller, calls, applied, cleared, revoked: () => unauthorized };
}
{
  const h = setup();
  const first = h.controller.player(), newest = h.controller.player();
  assert.equal(h.calls.length, 1, 'one request per lane while a refresh is in flight');
  h.calls[0].resolve(player('old')); await flush();
  assert.equal(h.applied.length, 0, 'a newer queued request invalidates the old response immediately');
  assert.equal(h.calls.length, 2, 'the newest refresh is queued, never dropped');
  h.calls[1].resolve(player('new')); await Promise.all([first, newest]);
  assert.equal(h.applied.at(-1).result.body.player.id, 'new');
}
{
  const h = setup();
  const old = h.controller.player();
  h.controller.setSession('B');
  const fresh = h.controller.player();
  h.calls[1].resolve(player('B-character')); await fresh;
  h.calls[0].resolve({ code: 401, body: { error: 'revoked' } }); await old; await flush();
  assert.equal(h.revoked(), 0, 'an old 401 cannot log out the replacement session');
  assert.equal(h.controller.snapshot().token, 'B');
  assert.equal(h.applied.length, 1);
}
{
  const h = setup();
  const old = h.controller.world('private-old');
  h.controller.setSession(null);
  h.calls[0].resolve(world('old', 'must remain hidden')); await old; await flush();
  assert.equal(h.applied.length, 0, 'logout discards delayed private responses');
  assert.equal((await h.controller.world()).ignored, true);
}
{
  const h = setup();
  const p = h.controller.player(); h.calls[0].resolve(player('one')); await p;
  const old = h.controller.world('first');
  const clearCount = h.cleared.length;
  const newest = h.controller.world('second');
  assert(h.cleared.length > clearCount, 'refresh invalidation immediately clears old private controls');
  h.calls[1].resolve(world('one', 'obsolete')); await flush();
  assert(h.calls[2].path.endsWith('operationId=second'));
  h.calls[2].resolve({ code: 403, body: { error: 'revoked' } }); await Promise.all([old, newest]);
  assert.equal(h.applied.filter((entry) => entry.kind === 'world' && entry.result.code < 400).length, 0);
  assert.equal(h.revoked(), 0, 'world ACL loss clears the board without inventing token revocation');
}
{
  const h = setup();
  const p = h.controller.player(); h.calls[0].resolve(player('one')); await p;
  const old = h.controller.world();
  const newest = h.controller.invalidate('world', true);
  h.calls[1].resolve(world('one', 'invalidated')); await flush();
  h.calls[2].resolve(world('one', 'current')); await newest; await old;
  assert.equal(h.applied.filter((entry) => entry.kind === 'world').length, 1);
  assert.equal(h.applied.at(-1).result.body.secret, 'current');
}
{
  const h = setup();
  const p = h.controller.player(); h.calls[0].resolve(player('one')); await p;
  const oldWorld = h.controller.world();
  const replacement = h.controller.player();
  h.calls[2].resolve(player('heir')); await replacement; await flush();
  h.calls[1].resolve(world('one', 'dead character equipment')); await oldWorld;
  h.calls[3].resolve(world('heir', 'current equipment')); await flush();
  assert.equal(h.applied.filter((entry) => entry.kind === 'world').length, 1);
  assert.equal(h.applied.at(-1).result.body.secret, 'current equipment');
}
{
  const h = setup();
  const pending = h.controller.player();
  h.calls[0].resolve({ code: 404, body: { error: 'no_character' } }); await pending;
  assert(h.cleared.includes('player'));
  const revoked = h.controller.player();
  h.calls[1].resolve({ code: 401, body: {} }); await revoked; await flush();
  assert.equal(h.revoked(), 1);
  assert.equal(h.controller.snapshot().token, null);
}
{
  const h = setup();
  const first = h.controller.world('operation-one', 'case-one');
  assert(h.calls[0].path.endsWith('operationId=operation-one&mysteryGraphId=case-one'));
  const second = h.controller.world('operation-one', 'case/two');
  h.calls[0].resolve(world('one', 'old case details')); await flush();
  assert.equal(h.applied.length, 0, 'changing case selection immediately rejects delayed private case data');
  assert(h.calls[1].path.endsWith('operationId=operation-one&mysteryGraphId=case%2Ftwo'));
  h.calls[1].resolve(world('one', 'current case')); await Promise.all([first, second]);
  const reload = h.controller.invalidate('world', true);
  assert(h.calls[2].path.endsWith('operationId=operation-one&mysteryGraphId=case%2Ftwo'), 'invalidation keeps independent operation and case selections');
  h.calls[2].resolve({ code: 404, body: { error: 'case_unavailable' } }); await reload;
  assert.equal(h.applied.at(-1).result.code, 404, 'lost admission replaces the selected board with its unavailable state');
}
{
  const h = setup();
  const initial = h.controller.player(); h.calls[0].resolve(player('first')); await initial;
  const selected = h.controller.world('old-operation', 'old-case'); h.calls[1].resolve(world('first', 'old notes')); await selected;
  const replacement = h.controller.player(); h.calls[2].resolve(player('replacement')); await replacement; await flush();
  assert(h.cleared.includes('character'));
  assert.equal(h.calls[3].path, '/v1/projections/world', 'replacement character never inherits old case/operation selection');
  h.calls[3].resolve(world('replacement', 'fresh board')); await flush();
}
{
  const h = setup();
  const initial = h.controller.player(); h.calls[0].resolve(player('old')); await initial;
  const selected = h.controller.world('old-operation', 'old-case'); h.calls[1].resolve(world('old', 'old notes')); await selected;
  const noCharacter = h.controller.player(); h.calls[2].resolve({ code: 404, body: { error: 'no_character' } }); await noCharacter;
  assert(h.cleared.includes('character'), 'known character loss clears pending character-bound selection and retry state');
  const heir = h.controller.player(); h.calls[3].resolve(player('heir')); await heir; await flush();
  assert.equal(h.calls[4].path, '/v1/projections/world', 'old → no character → heir never reuses old operation or case selectors');
  h.calls[4].resolve(world('heir', 'heir notes')); await flush();
}
{
  const h = setup();
  const bootstrap = h.controller.player(); h.calls[0].resolve({ code: 404, body: { error: 'no_character' } }); await bootstrap;
  assert(!h.cleared.includes('character'), 'bootstrap absence preserves saved retry until its current character can be identified');
  const known = h.controller.player(); h.calls[1].resolve(player('current')); await known;
  assert(!h.cleared.includes('character'), 'first identified character follows normal saved retry restoration checks');
}

// Command mutations, confirmations and entity rendering are covered by player-command-client.js.
const apiStart = main.indexOf('  async function api('), apiEnd = main.indexOf('  async function apiNow(', apiStart);
let resolveApi;
const apiContext = vm.createContext({ token: 'old', _authQueue: Promise.resolve(), projections: { invalidate() {} },
  apiNow: () => new Promise((resolve) => { resolveApi = resolve; }) });
vm.runInContext(main.slice(apiStart, apiEnd) + '\nthis.callApi = api;', apiContext);
const oldApi = apiContext.callApi('GET', '/private'); await flush();
apiContext.token = 'new'; resolveApi({ code: 200, body: { private: 'old session' } });
assert.equal((await oldApi).code, 499, 'even non-projection API responses discard private bodies after session replacement');
let startQueued; apiContext._authQueue = new Promise((resolve) => { startQueued = resolve; });
let currentCharacter = true, callsAfterReplacement = 0;
apiContext.apiNow = async () => { callsAfterReplacement++; return { code: 200 }; };
const queued = apiContext.callApi('POST', '/v1/worldgraph/objects/a/actions/b', {}, { isCurrent: () => currentCharacter });
currentCharacter = false; startQueued();
assert.equal((await queued).code, 499);
assert.equal(callsAfterReplacement, 0, 'queued world commands cannot start after character replacement');
assert(main.includes('worldRetry = null; worldBusy = false;'), 'replacement clears pending command UI state');
assert(!main.includes("api('GET', '/v1/me')"), 'all production player refreshes use the player projection');
assert(main.indexOf("if (ev.channel === 'projection')") < main.indexOf("feedLine(ev.channel || '?', ev)"));
assert(/socket\.onopen[^\n]+projections\.world\(worldSelection, worldMysterySelection\)/.test(main), 'reconnect refreshes both selections to recover missed invalidations');
console.log('world-projection-client: stale/session/selection/revocation queues and queued mutation isolation PASS');
