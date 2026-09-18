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

// Execute the production mutation function too: an uncertain retry must reuse
// the original key and body, including after the board has been invalidated.
const mutationStart = main.indexOf('  async function worldMutation(');
const mutationEnd = main.indexOf('  function paintWorld(', mutationStart);
const keys = [], storage = new Map(); let generated = 0;
const mutationContext = vm.createContext({
  token: 'A', me: { id: 'one' }, worldBusy: false, worldRetry: null, worldSelection: null, worldMysterySelection: null,
  worldProjection: {}, worldChoiceConfirmation: null,
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
// A real choice-confirmation function must finish before a key or POST exists.
// Refresh/revocation cancels the dialog through its production cancellation hook.
const confirmStart = main.indexOf('  function confirmWorldChoice(');
const dialogCalls = [], choiceRequests = [], savedChoices = new Map(); let choiceKeys = 0, choiceCurrent = true;
const choiceContext = vm.createContext({
  token: 'A', me: { id: 'one' }, worldBusy: false, worldRetry: null, worldSelection: 'family-selected', worldMysterySelection: 'case-one',
  worldProjection: {}, worldChoiceConfirmation: null,
  projections: { snapshot: () => ({}), current: () => choiceCurrent, world: async () => {} },
  esc: (value) => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'),
  dialog: (markup) => {
    const controls = new Map(), bg = { querySelector: (selector) => { if (!controls.has(selector)) controls.set(selector, {}); return controls.get(selector); } };
    const call = { markup, bg, controls, closed: false }; dialogCalls.push(call);
    return { bg, close: () => { call.closed = true; } };
  },
  uuid: () => `choice-${++choiceKeys}`, paintWorld() {}, toast() {}, refresh: async () => {},
  sessionStorage: { setItem: (key, value) => savedChoices.set(key, value), removeItem: (key) => savedChoices.delete(key) },
  api: async (method, path, body, options) => { choiceRequests.push({ method, path, body, key: options.idempotencyKey });
    return choiceRequests.length === 1 ? { code: 503, body: {} } : { code: 200, body: {} }; },
});
vm.runInContext(main.slice(confirmStart, mutationEnd) + '\nthis.mutate = worldMutation;', choiceContext);
const choiceMove = { label: 'Choose: <private option>', mysteryGraphId: 'case-one', irreversible: true,
  path: '/v1/worldgraph/mysteries/case-one/choices/decision', body: { optionId: 'left', interactionId: 'desk' } };
const canceledChoice = choiceContext.mutate(choiceMove);
assert.equal(choiceKeys, 0); assert.equal(choiceRequests.length, 0); assert.equal(savedChoices.size, 0);
assert(dialogCalls[0].markup.includes('&lt;private option&gt;'));
assert(dialogCalls[0].markup.includes('permanent for this case'));
dialogCalls[0].controls.get('[data-world-choice-back]').onclick(); await canceledChoice;
assert(dialogCalls[0].closed); assert.equal(choiceKeys, 0);
const revokedChoice = choiceContext.mutate(choiceMove);
choiceContext.worldChoiceConfirmation(); await revokedChoice;
assert(dialogCalls[1].closed); assert.equal(choiceRequests.length, 0);
const replacedChoice = choiceContext.mutate(choiceMove);
choiceContext.worldProjection = {}; dialogCalls[2].controls.get('[data-world-choice-confirm]').onclick(); await replacedChoice;
assert.equal(choiceRequests.length, 0, 'a changed snapshot cannot submit an old confirmation');
const acceptedChoice = choiceContext.mutate(choiceMove);
dialogCalls[3].controls.get('[data-world-choice-confirm]').onclick(); await acceptedChoice;
assert.equal(choiceKeys, 1); assert.equal(savedChoices.size, 1);
await choiceContext.mutate(null, true);
assert.equal(dialogCalls.length, 4, 'uncertain confirmed choice retry does not ask for a second commitment');
assert.equal(choiceRequests.length, 2); assert.equal(choiceRequests[0].key, choiceRequests[1].key);
assert.deepEqual(choiceRequests[0].body, choiceRequests[1].body);
assert.equal(choiceContext.worldSelection, 'family-selected', 'case mutation preserves the selected Family operation');
assert.equal(choiceContext.worldMysterySelection, 'case-one'); assert.equal(savedChoices.size, 0);
for (const [path, body] of [
  ['/v1/worldgraph/mysteries/case-one/start', {}],
  ['/v1/worldgraph/mysteries/case-one/nodes/lead/discover', { interactionId: 'desk' }],
  ['/v1/worldgraph/mysteries/case-one/nodes/lead/complete', {}],
]) {
  await choiceContext.mutate({ label: 'Case action', path, body, mysteryGraphId: 'case-one' });
  assert.equal(choiceRequests.at(-1).path, path); assert.deepEqual(choiceRequests.at(-1).body, body);
}
const allowedCount = choiceRequests.length;
await choiceContext.mutate({ label: 'Unsupported saved move', path: '/v1/worldgraph/mysteries/case-one/admin', body: {} });
assert.equal(choiceRequests.length, allowedCount, 'restored retries cannot expand the explicit mutation route list');
// Render the exact production case UI with an inert DOM harness. Every action
// handler is collected from the rendered buttons, never reconstructed by tests.
const paintStart = main.indexOf('  function paintWorld('), paintEnd = main.indexOf('  // A toast can carry', paintStart);
const renderMoves = [], renderSelections = [];
const surface = {
  html: '', controls: new Map(),
  set innerHTML(value) {
    this.html = value; this.controls = new Map();
    for (const [attribute, datasetKey] of [['data-world-move', 'worldMove'], ['data-world-case', 'worldCase'], ['data-world-instance', 'worldInstance']]) {
      this.controls.set(`[${attribute}]`, [...value.matchAll(new RegExp(`<button[^>]*${attribute}="([^"]+)"[^>]*>`, 'g'))].map((match) => ({
        dataset: { [datasetKey]: match[1] }, disabled: /\sdisabled(?:\s|>)/.test(match[0]), listeners: {},
        addEventListener(kind, fn) { this.listeners[kind] = fn; },
      })));
    }
  },
  querySelectorAll(selector) { return this.controls.get(selector) || []; },
  querySelector(selector) {
    if (!this.html.includes(`id="${selector.slice(1)}"`)) return null;
    if (!this.controls.has(selector)) this.controls.set(selector, { listeners: {}, addEventListener(kind, fn) { this.listeners[kind] = fn; } });
    return this.controls.get(selector);
  },
};
const fixtureBoard = {
  player: { character: { id: 'one', name: 'One', locationId: 'docks' } },
  cases: { catalog: [{ graphId: 'case-one', title: 'Case <script>unsafe</script>', started: true, canStart: false, status: 'active' },
    { graphId: 'case-two', title: 'Second case', started: true, canStart: false, status: 'completed' },
    { graphId: 'case-three', title: 'Third case', started: false, canStart: true, status: 'available' }],
  selected: { graph: { id: 'case-one' }, status: 'active', nodes: [
    { id: 'visible-note', title: 'Read the ledger', description: '<img src=x onerror=alert(1)>', status: 'available', available: true },
    { id: 'decision', title: 'Pick a branch', status: 'available', options: [{ id: 'left', title: 'Public route' }, { id: 'right', title: 'Unissued route' }] },
  ], choices: [], actions: [{ kind: 'complete', nodeId: 'visible-note', interactionId: 'ledger-desk' },
    { kind: 'discover', nodeId: 'private:dispatch-only' }, { kind: 'choice', nodeId: 'decision', optionId: 'left' }] } },
  operations: { catalog: [], instances: [{ id: 'op-one', status: 'recruiting' }], selected: null },
};
const renderContext = vm.createContext({
  worldProjection: fixtureBoard, worldSelection: 'op-one', worldMysterySelection: 'case-one', worldBusy: false, worldRetry: null,
  worldStatus: 'Refreshing your world…', me: { name: 'One' }, $: (selector) => selector === '#tab-world' ? surface : null,
  esc: choiceContext.esc, worldMutation: (move) => renderMoves.push(move),
  projections: { world: (...selection) => renderSelections.push(selection) },
});
vm.runInContext(main.slice(paintStart, paintEnd) + '\nthis.paint = paintWorld;', renderContext);
renderContext.paint();
assert(surface.html.includes('data-world-mystery="case-one"'));
assert(surface.html.includes('data-world-selected-case="case-one"'));
assert(surface.html.includes('Case &lt;script&gt;unsafe&lt;/script&gt;'));
assert(surface.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert(!surface.html.includes('<script>') && !surface.html.includes('<img '), 'server-visible prose remains escaped');
assert(surface.html.includes('Investigate lead'));
assert(!surface.html.includes('private:dispatch-only'), 'a hidden dispatch identifier does not become user-facing prose');
assert(!surface.html.includes('Unissued route'), 'visible option metadata never invents a choice action');
for (const control of surface.querySelectorAll('[data-world-move]')) if (!control.disabled) control.listeners.click();
assert.equal(renderMoves.length, 4, 'only the catalog start and three server-issued actions produce controls');
const hiddenMove = renderMoves.find((move) => move.label === 'Investigate lead');
assert(hiddenMove.path.endsWith('/nodes/private%3Adispatch-only/discover'));
assert.deepEqual(JSON.parse(JSON.stringify(renderMoves.find((move) => move.label === 'Complete: Read the ledger').body)), { interactionId: 'ledger-desk' });
assert.equal(renderMoves.find((move) => move.label === 'Choose: Public route').irreversible, true);
for (const status of ['completed', 'excluded', 'failed']) {
  renderContext.worldProjection = { ...fixtureBoard, cases: { ...fixtureBoard.cases, selected: { ...fixtureBoard.cases.selected,
    nodes: [{ id: 'closed-note', title: 'Closed note', status, blockedBy: [{ adapter: 'explicit_interaction' }] }], actions: [],
  } } }; renderContext.paint();
  assert(!surface.html.includes('Requires: explicit interaction'), `${status} notes do not advertise obsolete action requirements`);
}
renderContext.worldProjection = { ...fixtureBoard, cases: { ...fixtureBoard.cases, selected: { ...fixtureBoard.cases.selected,
  nodes: [{ id: 'pending-note', title: 'Pending note', status: 'available', blockedBy: [{ adapter: 'explicit_interaction' }] }], actions: [],
} } }; renderContext.paint();
assert(surface.html.includes('Requires: explicit interaction'), 'unfinished notes retain their current requirement explanation');
renderContext.worldProjection = fixtureBoard; renderContext.paint();
surface.querySelectorAll('[data-world-case]')[1].listeners.click();
assert.deepEqual(renderSelections.at(-1), ['op-one', 'case-two'], 'case navigation preserves operation selection');
surface.querySelectorAll('[data-world-instance]')[0].listeners.click();
assert.deepEqual(renderSelections.at(-1), ['op-one', 'case-two']);
renderContext.worldProjection = { ...fixtureBoard, cases: { catalog: [], selected: null } }; renderContext.paint();
assert(surface.html.includes('No cases are available to this character yet.'));
assert(!surface.html.includes('data-world-selected-case') && surface.querySelectorAll('[data-world-move]').length === 0, 'revoked case data removes old controls');
renderContext.worldProjection = null; renderContext.paint();
assert(surface.html.includes('role="status"') && surface.html.includes('Refreshing your world…'));
assert(!surface.html.includes('unsafe') && surface.querySelectorAll('[data-world-move]').length === 0, 'refresh hides private notes immediately');
assert(surface.html.includes('Back to World overview'));
surface.querySelector('#world-overview').listeners.click();
assert.deepEqual(renderSelections.at(-1), [null, null], 'an unavailable selection has a working escape back to the current catalog');
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
console.log('world-projection-client: stale/session/selection/revocation queues, canceled irreversible confirmation and preserved mutation retry keys PASS');
