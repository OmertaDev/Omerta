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

// Execute the production mutation function too: an uncertain retry must reuse
// the original key and body, including after the board has been invalidated.
const mutationStart = main.indexOf('  async function worldMutation(');
const mutationEnd = main.indexOf('  function paintWorld(', mutationStart);
const keys = [], storage = new Map(); let generated = 0;
const mutationContext = vm.createContext({
  token: 'A', me: { id: 'one' }, worldBusy: false, worldRetry: null, worldSelection: null,
  projections: { snapshot: () => ({}), current: () => true, world: async () => {} },
  uuid: () => `key-${++generated}`, paintWorld() {}, toast() {}, refresh: async () => {},
  sessionStorage: { setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
  api: async (_method, _path, _body, options) => { keys.push(options.idempotencyKey); return keys.length === 1 ? { code: 503, body: {} } : { code: 200, body: {} }; },
});
vm.runInContext(main.slice(mutationStart, mutationEnd) + '\nthis.mutate = worldMutation;', mutationContext);
await mutationContext.mutate({ label: 'Craft', path: '/v1/worldgraph/kernel/recipes/key/craft', body: {} });
assert.equal(storage.size, 1);
await mutationContext.mutate(null, true);
assert.deepEqual(keys, ['key-1', 'key-1']);
assert.equal(generated, 1);
assert.equal(storage.size, 0);
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
assert(/socket\.onopen[^\n]+projections\.world\(worldSelection\)/.test(main), 'reconnect refreshes projection state to recover missed invalidations');
console.log('world-projection-client: real coordinator stale/session/revocation/replacement queues and preserved mutation retry keys PASS');
