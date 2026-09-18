import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { parse } from 'acorn';

const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const main = html.slice(html.lastIndexOf('<script>') + 8, html.lastIndexOf('</script>'));
parse(main, { ecmaVersion: 'latest' });
const extract = (start, end) => main.slice(main.indexOf(start), main.indexOf(end, main.indexOf(start)));
const escape = (value) => String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
const plain = (value) => JSON.parse(JSON.stringify(value));
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const command = (id, fields = {}) => ({ commandId: id, commandType: 'test_command', label: id, description: '', availability: 'AVAILABLE',
  subject: { type: 'mystery', id: 'case-one' }, target: null, executionIdentity: { executionId: `execution-${id}` },
  confirmation: { required: false }, costs: [], blockers: [], risk: [], ...fields });
const board = (commands = []) => ({ schemaVersion: 1, commandSchemaVersion: 1,
  player: { id: 'account-one', character: { id: 'one', name: 'One', locationId: 'docks' } }, commands, opportunities: [] });

const restoreContext = vm.createContext({});
vm.runInContext(extract('  function restoreWorldCommand(', '  const projections =') + '\nthis.restore = restoreWorldCommand;', restoreContext);
const saved = { accountId: 'account-one', characterId: 'one', executionId: 'execution-craft', idempotencyKey: 'execution-craft', confirmed: false, label: 'Craft' };
assert.deepEqual(plain(restoreContext.restore({ ...saved, path: '/admin', body: { anything: true }, token: 'secret' }, board())), saved,
  'restoration keeps the server identity and drops arbitrary routes, body and credentials');
for (const changed of [{ accountId: 'other-account' }, { characterId: 'heir' }, { idempotencyKey: 'new-key' }, { confirmed: 'true' }, { executionId: '' }]) {
  assert.equal(restoreContext.restore({ ...saved, ...changed }, board()), null, 'restored retries must match both account and character');
}
assert.equal(restoreContext.restore(saved, null), null, 'no retry restoration without a current authenticated board');

function mutationHarness(commands = [command('craft')]) {
  const calls = [], storage = new Map(), toasts = [], dialogs = [], selections = [];
  let reply = () => ({ code: 200, body: { status: 'COMPLETED', feedback: { immediateResult: { label: 'Move recorded' } } } });
  const context = vm.createContext({ token: 'session-A', me: { id: 'one' }, worldAccountId: 'account-one', worldBusy: false,
    worldRetry: null, worldFeedback: null, worldSelection: 'operation-one', worldMysterySelection: 'case-one',
    worldProjection: board(commands), worldChoiceConfirmation: null,
    projections: { snapshot: () => ({}), current: () => true, world: async (...selection) => { selections.push(selection); return { code: 200 }; } },
    esc: escape, paintWorld() {}, toast: (...args) => toasts.push(args), refresh: async () => {},
    sessionStorage: { setItem: (key, value) => storage.set(key, value), removeItem: (key) => storage.delete(key) },
    api: async (method, path, body, options) => { calls.push({ method, path, body, key: options.idempotencyKey }); return reply(); },
    dialog: (markup) => {
      const controls = new Map(), bg = { querySelector(selector) { if (!controls.has(selector)) controls.set(selector, {}); return controls.get(selector); } };
      const dialog = { markup, bg, controls, closed: false }; dialogs.push(dialog);
      return { bg, close: () => { dialog.closed = true; } };
    },
  });
  vm.runInContext(extract('  function confirmWorldChoice(', '  function paintWorld(') + '\nthis.mutate = worldMutation;', context);
  return { context, calls, storage, toasts, dialogs, selections, respond: (fn) => { reply = fn; } };
}
{
  const h = mutationHarness();
  h.respond(() => ({ code: 503, body: { error: 'offline' } }));
  await h.context.mutate(h.context.worldProjection.commands[0]);
  assert.equal(h.storage.size, 1); assert.equal(h.context.worldRetry.executionId, 'execution-craft');
  assert.deepEqual(plain(h.calls[0]), { method: 'POST', path: '/v1/commands/execute', body: { executionId: 'execution-craft', confirmed: false }, key: 'execution-craft' });
  h.context.worldProjection = null;
  await h.context.mutate(command('new-attempt'));
  assert.equal(h.calls.length, 1, 'uncertain outcome blocks fresh commands');
  h.respond(() => ({ code: 200, body: { replayed: true, feedback: { immediateResult: { label: 'Craft recorded' } }, projection: null } }));
  await h.context.mutate(null, true);
  assert.equal(h.calls.length, 2); assert.deepEqual(plain(h.calls[0]), plain(h.calls[1]));
  assert.equal(h.storage.size, 0); assert.equal(h.context.worldRetry, null);
  assert(h.toasts.at(-1)[0].includes('already recorded'));
  assert.deepEqual(h.selections.at(-1), ['operation-one', 'case-one']);
  assert.equal(h.context.worldFeedback.immediateResult.label, 'Craft recorded');
}
{
  const h = mutationHarness(); let finish;
  h.respond(() => new Promise((resolve) => { finish = resolve; }));
  const first = h.context.mutate(h.context.worldProjection.commands[0]);
  await h.context.mutate(h.context.worldProjection.commands[0]);
  assert.equal(h.calls.length, 1, 'double click is suppressed while the issued command is running');
  finish({ code: 200, body: {} }); await first;
  assert.equal(h.context.worldBusy, false);
  const expired = command('expired', { availability: 'EXPIRED' }); h.context.worldProjection = board([expired]);
  await h.context.mutate(expired); await h.context.mutate(command('invented'));
  assert.equal(h.calls.length, 1, 'expired and non-issued commands never dispatch');
}
{
  const choice = command('choice', { label: 'Choose: <private option>', confirmation: { required: true, message: 'This choice is permanent for this case. Other branches may close.' } });
  const h = mutationHarness([choice]);
  let pending = h.context.mutate(choice);
  assert.equal(h.calls.length, 0); assert.equal(h.storage.size, 0);
  assert(h.dialogs[0].markup.includes('&lt;private option&gt;')); assert(h.dialogs[0].markup.includes('permanent for this case'));
  h.dialogs[0].controls.get('[data-world-choice-back]').onclick(); await pending;
  assert(h.dialogs[0].closed); assert.equal(h.calls.length, 0);
  pending = h.context.mutate(choice); h.context.worldChoiceConfirmation(); await pending;
  assert(h.dialogs[1].closed); assert.equal(h.calls.length, 0, 'revocation cancels pending confirmation');
  pending = h.context.mutate(choice); h.context.worldProjection = board([choice]);
  h.dialogs[2].controls.get('[data-world-choice-confirm]').onclick(); await pending;
  assert.equal(h.calls.length, 0, 'a changed projection cannot submit an old confirmation');
  h.respond(() => ({ code: 503, body: {} })); pending = h.context.mutate(choice);
  h.dialogs[3].controls.get('[data-world-choice-confirm]').onclick(); await pending;
  assert.equal(h.calls.length, 1); assert.equal(h.calls[0].body.confirmed, true);
  h.respond(() => ({ code: 200, body: {} })); await h.context.mutate(null, true);
  assert.equal(h.dialogs.length, 4, 'saved confirmed retry needs no second commitment');
  assert.deepEqual(plain(h.calls[0]), plain(h.calls[1])); assert.equal(h.storage.size, 0);
}
{
  const h = mutationHarness(); let finish;
  h.respond(() => new Promise((resolve) => { finish = resolve; }));
  const old = h.context.mutate(h.context.worldProjection.commands[0]);
  h.context.worldAccountId = 'account-two'; h.context.me = { id: 'two' };
  h.context.worldRetry = null; h.context.worldBusy = false;
  finish({ code: 200, body: { feedback: { immediateResult: { label: 'private old reply' } } } }); await old;
  assert.equal(h.context.worldFeedback, null); assert.equal(h.toasts.length, 0); assert.equal(h.selections.length, 0,
    'replacement account cannot receive old action feedback or followup reads');
  h.context.worldRetry = saved; await h.context.mutate(null, true);
  assert.equal(h.calls.length, 1, 'a saved command cannot cross account or character boundaries');
}

// Exercise the production renderer and the event handlers actually attached to its controls.
const surface = { html: '', controls: new Map(),
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
const commands = [command('Investigate lead'), command('Choose: Public route', { confirmation: { required: true } }),
  command('Craft key', { subject: { type: 'recipe', id: 'key' }, target: { type: 'item', id: 'tool-one' } }),
  command('Share with Crew', { subject: { type: 'clue', id: 'claim-one' }, target: { type: 'crew', id: 'crew-one' }, confirmation: { required: true } }),
  command('Wait for the Crew', { availability: 'BLOCKED', blockers: [{ message: 'A role is unfilled.' }] }),
  command('Unknown lead', { availability: 'LOCKED', blockers: [{ message: 'secret prerequisite must never appear' }] }),
  command('Run started', { availability: 'IN_PROGRESS' }), command('Closed move', { availability: 'COMPLETED' }), command('Expired move', { availability: 'EXPIRED' })];
const fixtureBoard = { ...board(commands),
  situations: [{ id: 'shipment', title: 'Dock <script>unsafe</script>', description: 'A shipment is overdue.',
    objective: 'Find a safe route.', knownFacts: ['The north pier is closed.'], helpers: [{ label: 'Your Crew <img src=x>' }],
    expiresAt: '2026-09-20T12:00:00Z', outcome: 'Cargo reached its destination.',
    actions: [{ id: 'unissued-situation-action', label: 'Unissued shipment move', canAttempt: true }], internalWeight: 917 }],
  opportunities: [{ opportunityId: 'lead', kind: 'mystery_lead', label: 'A note on your desk', description: 'Someone has been asking questions.', commandIds: ['Investigate lead'] }],
  crew: { id: 'crew-one', name: 'Docks Crew', members: [{ name: 'Sal' }], objective: { kind: 'evidence', progress: 1, target: 2 } }, family: { name: 'Bellini', role: 'soldier', relations: [] },
  knowledge: { claims: [{ id: 'claim-one', proposition: 'Known mark', owned: true, value: { value: 'left' } }] },
  cases: { catalog: [{ graphId: 'case-one', title: 'Case <script>unsafe</script>', started: true, status: 'active' },
    { graphId: 'case-two', title: 'Second case', started: true, status: 'completed' },
    { graphId: 'case-three', title: 'Third case', started: false, canStart: true, status: 'available' }],
  selected: { graph: { id: 'case-one' }, status: 'active', nodes: [
    { id: 'visible-note', title: 'Read the ledger', description: '<img src=x onerror=alert(1)>', status: 'available', available: true, blockedBy: [{ adapter: 'secret_adapter' }] },
    { id: 'decision', title: 'Pick a branch', status: 'available', options: [{ id: 'left', title: 'Public route' }, { id: 'right', title: 'Unissued route' }] },
  ], choices: [], actions: [{ kind: 'discover', nodeId: 'private:dispatch-only' }] } },
  operations: { catalog: [], instances: [{ id: 'op-one', status: 'recruiting' }], selected: null },
  recipes: [{ id: 'key', title: 'A quiet key', consumes: [], produces: [], canAttempt: true }],
  inventory: { resources: [], items: [{ id: 'tool-one', templateId: 'key', state: 'available', provenance: [] }] },
  worldObjects: [{ id: 'safe', title: 'Closed safe', state: 'locked', actions: [{ actionId: 'bypass', canAttempt: true }] }],
};
const moves = [], selections = [];
const renderContext = vm.createContext({ worldProjection: fixtureBoard, worldSelection: 'op-one', worldMysterySelection: 'case-one', worldBusy: false,
  worldRetry: null, worldFeedback: { immediateResult: { label: 'Evidence recorded' }, knowledgeChanges: ['private:do-not-render'] },
  worldStatus: 'Refreshing your world…', me: { name: 'One' }, $: (selector) => selector === '#tab-world' ? surface : null,
  esc: escape, worldMutation: (move) => moves.push(move), projections: { world: (...selection) => selections.push(selection) } });
vm.runInContext(extract('  function paintWorld(', '  // A toast can carry') + '\nthis.paint = paintWorld;', renderContext);
renderContext.paint();
for (const heading of ['What changed?', 'What needs my attention?', 'What can I do?', 'What am I waiting for?', 'What is my Crew doing?', 'What is my Family doing?', 'What have I discovered?']) assert(surface.html.includes(heading));
assert(surface.html.includes('data-world-mystery="case-one"')); assert(surface.html.includes('data-world-selected-case="case-one"'));
assert(surface.html.includes('Case &lt;script&gt;unsafe&lt;/script&gt;')); assert(surface.html.includes('&lt;img src=x onerror=alert(1)&gt;'));
assert(!surface.html.includes('<script>') && !surface.html.includes('<img '), 'all server prose remains escaped');
for (const hidden of ['secret prerequisite', 'private:dispatch-only', 'Unissued route', 'secret_adapter', 'private:do-not-render']) assert(!surface.html.includes(hidden), hidden);
assert(surface.html.includes('A role is unfilled.')); assert(surface.html.includes('1 knowledge changes'));
for (const text of ['What is happening around us?', 'Dock &lt;script&gt;unsafe&lt;/script&gt;', 'Your stake:',
  'The north pier is closed.', 'Your Crew &lt;img src=x&gt;', 'Aftermath:', 'Cargo reached its destination.']) assert(surface.html.includes(text), text);
assert(!surface.html.includes('Unissued shipment move') && !surface.html.includes('internalWeight'), 'world prose cannot invent actions or expose scheduler metadata');
for (const control of surface.querySelectorAll('[data-world-move]')) if (!control.disabled) control.listeners.click();
assert(moves.length > 3, 'shared commands appear in attention, action and entity context');
assert(moves.every((move) => commands.includes(move) && move.availability === 'AVAILABLE'), 'all buttons use exact server-issued commands');
assert.equal(new Set(moves).size, 4, 'legacy canStart, canAttempt, action arrays and options never invent commands');
assert(moves.filter((move) => move.commandId === 'Craft key').length >= 3, 'recipe and item cards share the same issued action');
assert(moves.filter((move) => move.commandId === 'Share with Crew').length >= 3, 'Crew and clue cards share one issued knowledge command');
surface.querySelectorAll('[data-world-case]')[1].listeners.click();
assert.deepEqual(selections.at(-1), ['op-one', 'case-two'], 'case navigation preserves the selected Family operation');
surface.querySelectorAll('[data-world-instance]')[0].listeners.click(); assert.deepEqual(selections.at(-1), ['op-one', 'case-two']);
renderContext.worldBusy = true; renderContext.paint();
assert(surface.querySelectorAll('[data-world-move]').every((control) => control.disabled));
renderContext.worldBusy = false; renderContext.worldRetry = saved; renderContext.paint();
assert(surface.querySelectorAll('[data-world-move]').every((control) => control.disabled), 'uncertain move blocks all fresh action buttons');
renderContext.worldRetry = null; renderContext.worldProjection = { ...fixtureBoard, commands: [], opportunities: [], cases: { catalog: [], selected: null } };
renderContext.paint(); assert(surface.html.includes('No cases are available to this character yet.'));
assert.equal(surface.querySelectorAll('[data-world-move]').length, 0, 'revoked command board removes all old controls');
renderContext.worldProjection = null; renderContext.worldFeedback = null; renderContext.paint();
assert(surface.html.includes('role="status"') && surface.html.includes('Refreshing your world…'));
assert(!surface.html.includes('unsafe') && surface.querySelectorAll('[data-world-move]').length === 0, 'invalidation clears private notes immediately');
surface.querySelector('#world-overview').listeners.click(); assert.deepEqual(selections.at(-1), [null, null]);
assert(!extract('  async function worldMutation(', '  // A toast can carry').includes('/v1/worldgraph/'), 'the command center has no parallel domain mutation route');

// The same projection queue now rejects an incompatible command envelope.
const refreshContext = vm.createContext({});
vm.runInContext(extract('  function createProjectionRefresh(', '  // End projection refresh coordinator.') + '\nthis.create = createProjectionRefresh;', refreshContext);
const requests = [], results = [];
const coordinator = refreshContext.create({ worldPath: '/v1/commands', clear() {}, unauthorized() {}, apply: (kind, result) => results.push(result),
  request: (path) => new Promise((resolve) => requests.push({ path, resolve })) });
coordinator.setSession('A'); const first = coordinator.world('op', 'case');
assert.equal(requests[0].path, '/v1/commands?operationId=op&mysteryGraphId=case');
requests[0].resolve({ code: 200, body: { schemaVersion: 1, player: {} } }); await first;
assert.equal(results.at(-1).code, 502, 'old projection without commands cannot silently become an actionable board');
const delayed = coordinator.world(); coordinator.setSession('B'); requests[1].resolve({ code: 200, body: board(commands) });
await delayed; await flush(); assert.equal(results.length, 1, 'old command responses cannot cross session boundaries');
console.log('player-command-client: issued commands, all availability states, context actions, confirmation, retry/restart identity, double clicks, session isolation and private rendering PASS');
