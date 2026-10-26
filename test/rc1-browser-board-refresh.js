// Controlled browser/HTTP lifecycle evidence; this is not native gameplay proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';

let reads = 0, posts = [], browser, heldReadGate;
const source = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const extract = (start, end, expected) => {
  assert.equal(source.split(start).length, 2); assert.equal(source.split(end).length, 2);
  const text = source.slice(source.indexOf(start), source.indexOf(end));
  assert.equal(crypto.createHash('sha256').update(text).digest('hex'), expected, 'Canonical client seam changed: review the extracted source'); return text;
};
const predecessorCoordinatorSha = 'a693944e6e8bde4e4bee829865ce813ec588d860bf5e45fad95545fecc48b2da';
const currentCoordinatorSha = '53aa1a9767d2568e3969eb0ecb069ed9c282fcc0d873dcc0bafec318d6416125';
const playerContentionRetry = `          if (kind === 'player' && result.code === 409 && result.body?.error === 'contention') {
            try { result = await request(path, { ...ticket, isCurrent }); }
            catch { result = { code: 503, body: { error: 'offline' } }; }
            if (!isCurrent()) continue;
          }
`;
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
function removePlayerRetry(text) {
  assert.equal(text.split(playerContentionRetry).length, 2, 'The reviewed player retry has one exact inverse');
  return text.replace(playerContentionRetry, '');
}
function reviewedCoordinator(text) {
  const digest = sha(text);
  if (digest === predecessorCoordinatorSha) return digest;
  assert.equal(digest, currentCoordinatorSha, 'Only the exact reviewed coordinator successor is accepted');
  assert.equal(sha(removePlayerRetry(text)), predecessorCoordinatorSha, 'The complete predecessor coordinator must reconstruct exactly');
  return digest;
}
const coordinatorSource = source.slice(source.indexOf('  function createProjectionRefresh('), source.indexOf('  // End projection refresh coordinator.'));
const coordinator = extract('  function createProjectionRefresh(', '  // End projection refresh coordinator.', reviewedCoordinator(coordinatorSource));
// The inverse preserves the previously pinned world lane. Player recovery has separate direct
// unit/browser coverage; this controlled world-board harness does not qualify its gameplay.
if (sha(coordinator) === currentCoordinatorSha) {
  const predecessor = removePlayerRetry(coordinator);
  assert.notEqual(predecessor, coordinator);
  assert.equal(reviewedCoordinator(predecessor), predecessorCoordinatorSha);
  const duplicate = coordinator.replace(playerContentionRetry, playerContentionRetry.repeat(2));
  assert.notEqual(duplicate, coordinator);
  assert.throws(() => removePlayerRetry(duplicate), /one exact inverse/);
  for (const tampered of [duplicate,
    coordinator.replace("result.body?.error === 'contention'", "result.body?.error === 'anything'"),
    coordinator.replace("if (kind === 'world' && worldPath", "if (kind === 'player' && worldPath"),
    coordinator + '\n', predecessor.replace('apply(kind, result);', 'apply(kind, {});')]) {
    assert.notEqual(tampered, coordinator);
    assert.notEqual(tampered, predecessor);
    assert.throws(() => reviewedCoordinator(tampered), /exact reviewed coordinator successor/);
  }
}
const predecessorApiQueueSha = '61ffdfc08a79dca5491f95abf333f1fc9c9d125f344206a5233063ecaddeeba7';
const currentApiQueueSha = '0a1714c6aa971e3d16365f390eb03005a820dc19312c8f904c87a7471e2e22fd';
const cityActivityApiQueueSha = '490beb898976f6e3d94b2adea953b916fa5e9ac0ee1c35fd5fc0cebae9dbcf73';
const classicApiQueueSha = '49ce4b2026c6c277aff5cf9f62ad67c6ba19f650245ea7d683f1f673101866ca';
const uxApiQueueSha = 'cea97ea66a2c269be072117b0a0a0de8946c83f91eb2af124eeb0a2b859bd839';
const uxWorkspaceExemption = ", '/v1/ux/workspace'";
function removeUxWorkspaceExemption(text) {
  assert.equal(text.split(uxWorkspaceExemption).length, 2, 'The reviewed private workspace exemption has one exact inverse');
  return text.replace(uxWorkspaceExemption, '');
}
const cityActivityKey = `    if (method !== 'GET') options = { ...options, idempotencyKey: options.idempotencyKey || uuid() };
`;
const cityActivityPresence = `      // Direct API controls (chat, for example) do not refresh the player through
      // act(). Read the server's scoped owner receipt instead of animating cached me.
      if (valid() && method !== 'GET' && !options.activityHandled && result.code >= 200 && result.code < 300 && !result.replayed) scheduleCityPresence();
`;
function removeCityActivity(text) {
  for (const chunk of [cityActivityKey, cityActivityPresence]) {
    assert.equal(text.split(chunk).length, 2, 'Each reviewed City activity addition has one exact inverse');
    text = text.replace(chunk, '');
  }
  return text;
}
const beforeDispatchGuard = `      if (options.beforeDispatch && !options.beforeDispatch()) return { ignored: true, code: 499, body: {} };
`;
function removeBeforeDispatchGuard(text) {
  assert.equal(text.split(beforeDispatchGuard).length, 2, 'The reviewed dispatch guard has one exact inverse');
  return text.replace(beforeDispatchGuard, '');
}
function removeClassicIdempotencyKey(text) {
  assert.equal(text.split(cityActivityKey).length, 2, 'The retained classic idempotency key has one exact inverse');
  return text.replace(cityActivityKey, '');
}
function reviewedClassicApiQueue(text) {
  const digest = sha(text);
  assert.equal(digest, classicApiQueueSha, 'Only the exact reviewed classic API queue is accepted');
  const previous = removeClassicIdempotencyKey(text);
  assert.equal(sha(previous), currentApiQueueSha, 'The complete pre-key queue must reconstruct exactly');
  assert.equal(sha(removeBeforeDispatchGuard(previous)), predecessorApiQueueSha, 'The original queue must reconstruct exactly');
  return digest;
}
function reviewedUxApiQueue(text) {
  const digest = sha(text);
  assert.equal(digest, uxApiQueueSha, 'Only the exact reviewed UX API queue is accepted');
  const previous = removeUxWorkspaceExemption(text);
  assert.equal(reviewedClassicApiQueue(previous), classicApiQueueSha, 'The complete classic queue reconstructs exactly');
  return digest;
}
function reviewedApiQueue(text) {
  const digest = sha(text);
  if (digest === uxApiQueueSha) return reviewedUxApiQueue(text);
  if (digest === predecessorApiQueueSha) return digest;
  if (digest === classicApiQueueSha) return reviewedClassicApiQueue(text);
  if (digest === cityActivityApiQueueSha) {
    const previous = removeCityActivity(text);
    assert.equal(sha(previous), currentApiQueueSha, 'The complete pre-activity queue must reconstruct exactly');
    assert.equal(sha(removeBeforeDispatchGuard(previous)), predecessorApiQueueSha, 'The original queue must reconstruct exactly');
    return digest;
  }
  assert.equal(digest, currentApiQueueSha, 'Only the exact reviewed API queue successor is accepted');
  assert.equal(sha(removeBeforeDispatchGuard(text)), predecessorApiQueueSha, 'The complete predecessor API queue must reconstruct exactly');
  return digest;
}
const apiQueueSource = source.slice(source.indexOf('  async function api(method,'), source.indexOf('  async function apiNow('));
const extractedApiQueue = extract('  async function api(method,', '  async function apiNow(', reviewedApiQueue(apiQueueSource));
const classicQueueForGuards = sha(extractedApiQueue) === uxApiQueueSha ? removeUxWorkspaceExemption(extractedApiQueue) : extractedApiQueue;
const apiQueue = sha(extractedApiQueue) === cityActivityApiQueueSha ? removeCityActivity(extractedApiQueue)
  : sha(classicQueueForGuards) === classicApiQueueSha ? removeClassicIdempotencyKey(classicQueueForGuards) : extractedApiQueue;
// The inverse below is only for historical guard and tamper controls. Current
// queue probes and the browser board execute the actual extracted source with
// presentation dependencies stubbed; City/economic qualification is not inherited.
if (sha(extractedApiQueue) === cityActivityApiQueueSha) {
  assert.equal(reviewedApiQueue(apiQueue), currentApiQueueSha);
  for (const chunk of [cityActivityKey, cityActivityPresence]) {
    const duplicate = extractedApiQueue.replace(chunk, chunk.repeat(2));
    assert.notEqual(duplicate, extractedApiQueue);
    assert.throws(() => removeCityActivity(duplicate), /one exact inverse/);
    assert.throws(() => reviewedApiQueue(duplicate), /exact reviewed API queue successor/);
    assert.throws(() => reviewedApiQueue(extractedApiQueue.replace(chunk, '')), /exact reviewed API queue successor/);
  }
  for (const [before, after] of [
    ['options.idempotencyKey || uuid()', 'uuid()'],
    ['!result.replayed', 'result.replayed'],
    ['!options.activityHandled', 'options.activityHandled'],
    ['result.code < 300', 'result.code < 400'],
    ['scheduleCityPresence();', 'scheduleCityPresence(true);'],
    ['token === authToken', 'token !== authToken'],
    ['return valid() ? result : neutral;', 'return result;'],
  ]) {
    const tampered = extractedApiQueue.replace(before, after);
    assert.notEqual(tampered, extractedApiQueue);
    assert.throws(() => reviewedApiQueue(tampered), /exact reviewed API queue successor/);
  }
  assert.throws(() => reviewedApiQueue(extractedApiQueue + '\n'), /exact reviewed API queue successor/);
}
if (sha(classicQueueForGuards) === classicApiQueueSha) {
  const extractedApiQueue = classicQueueForGuards;
  assert.equal(reviewedApiQueue(apiQueue), currentApiQueueSha);
  const duplicate = extractedApiQueue.replace(cityActivityKey, cityActivityKey.repeat(2));
  assert.notEqual(duplicate, extractedApiQueue);
  assert.throws(() => removeClassicIdempotencyKey(duplicate), /one exact inverse/);
  // Key loss remains valid historical input, but cannot pass as the current classic queue.
  for (const tampered of [duplicate, apiQueue,
    extractedApiQueue.replace('options.idempotencyKey || uuid()', 'uuid()'),
    extractedApiQueue.replace("method !== 'GET'", "method === 'GET'"),
    extractedApiQueue.replace('!options.beforeDispatch()', 'options.beforeDispatch()'),
    extractedApiQueue.replace('token === authToken', 'token !== authToken'),
    extractedApiQueue.replace('return valid() ? result : neutral;', 'return result;'),
    extractedApiQueue.replace("projections.invalidate('world')", "projections.invalidate('player')"),
    extractedApiQueue + '\n']) {
    assert.notEqual(tampered, extractedApiQueue);
    assert.throws(() => reviewedClassicApiQueue(tampered), /exact reviewed classic API queue/);
  }
}
if (sha(extractedApiQueue) === uxApiQueueSha) {
  assert.equal(reviewedApiQueue(extractedApiQueue), uxApiQueueSha);
  assert.equal(sha(removeUxWorkspaceExemption(extractedApiQueue)), classicApiQueueSha);
  const duplicate = extractedApiQueue.replace(uxWorkspaceExemption, uxWorkspaceExemption.repeat(2));
  assert.throws(() => removeUxWorkspaceExemption(duplicate), /one exact inverse/);
  for (const tampered of [duplicate, classicQueueForGuards,
    extractedApiQueue.replace("'/v1/ux/workspace'", "'/v1/ux/'"),
    extractedApiQueue.replace("'/v1/ux/workspace'", "'/controlled-action'"),
    extractedApiQueue.replace("method !== 'GET'", "method === 'GET'"),
    extractedApiQueue.replace('!options.beforeDispatch()', 'options.beforeDispatch()'),
    extractedApiQueue.replace('token === authToken', 'token !== authToken'),
    extractedApiQueue.replace('return valid() ? result : neutral;', 'return result;'),
    extractedApiQueue.replace("projections.invalidate('world')", "projections.invalidate('player')"),
    extractedApiQueue + '\n']) {
    assert.notEqual(tampered, extractedApiQueue);
    assert.throws(() => reviewedUxApiQueue(tampered), /exact reviewed UX API queue/);
  }
}
// The only successor addition is an opt-in check before apiNow. The world-board
// reads below do not opt in and keep the exact predecessor queue/token behavior.
// These bounded transport probes qualify the hook's timing, not City gameplay.
async function probeApiQueue(text, phase) {
  let release, entered;
  const held = new Promise(resolve => { release = resolve; }), started = new Promise(resolve => { entered = resolve; });
  const calls = [], view = { open: true, current: true };
  const scope = { token: 'first', uuid: () => 'controlled-receipt', scheduleCityPresence() {},
    projections: { invalidate() {} }, apiNow: async (method, path) => {
    calls.push({ method, path }); entered(); await held; return { code: 200, body: { ok: true } };
  } };
  vm.runInNewContext('let _authQueue = Promise.resolve();\n' + text + '\nthis.call = api;', scope);
  let first;
  if (['queued', 'default'].includes(phase)) { first = scope.call('GET', '/held'); await started; }
  const pending = scope.call('POST', '/controlled-action', {}, phase === 'default' ? {}
    : { beforeDispatch: () => view.open, isCurrent: () => view.current });
  if (!first) await started;
  view.open = false;
  if (phase === 'revoked') scope.token = 'replacement';
  if (phase === 'owner-revoked') view.current = false;
  release(); if (first) await first;
  return { reply: await pending, posts: calls.filter(call => call.method === 'POST').length };
}
if (sha(apiQueue) === currentApiQueueSha) {
  const predecessor = removeBeforeDispatchGuard(apiQueue);
  assert.notEqual(predecessor, apiQueue);
  assert.equal(reviewedApiQueue(predecessor), predecessorApiQueueSha);
  const duplicate = apiQueue.replace(beforeDispatchGuard, beforeDispatchGuard.repeat(2));
  assert.notEqual(duplicate, apiQueue);
  assert.throws(() => removeBeforeDispatchGuard(duplicate), /one exact inverse/);
  const afterSend = predecessor.replace('      return valid() ? result : neutral;', beforeDispatchGuard + '      return valid() ? result : neutral;');
  for (const tampered of [duplicate, afterSend,
    apiQueue.replace('!options.beforeDispatch()', 'options.beforeDispatch()'),
    apiQueue.replace('token === authToken', 'token !== authToken'),
    apiQueue.replace('return valid() ? result : neutral;', 'return result;'),
    apiQueue.replace("projections.invalidate('world')", "projections.invalidate('player')"),
    apiQueue + '\n', predecessor.replace('return valid() ? result : neutral;', 'return result;')]) {
    assert.notEqual(tampered, apiQueue); assert.notEqual(tampered, predecessor);
    assert.throws(() => reviewedApiQueue(tampered), /exact reviewed API queue successor/);
  }
  for (const phase of ['queued', 'dispatched', 'revoked', 'owner-revoked', 'default']) {
    const { reply, posts } = await probeApiQueue(apiQueue, phase);
    assert.equal(reply.code, ['queued', 'revoked', 'owner-revoked'].includes(phase) ? 499 : 200, phase + ' preserves dispatch/privacy semantics');
    assert.equal(posts, phase === 'queued' ? 0 : 1, phase + ' reaches the expected actual transport count');
  }
  const oldQueued = await probeApiQueue(predecessor, 'queued'), lateQueued = await probeApiQueue(afterSend, 'queued');
  assert.equal(oldQueued.posts, 1, 'The actual predecessor dispatches without the opt-in hook');
  assert.equal(oldQueued.reply.code, 200);
  assert.equal(lateQueued.posts, 1, 'Moving the hook after apiNow cannot cancel a queued dispatch');
  assert.equal(lateQueued.reply.code, 499);
}
if ([cityActivityApiQueueSha, classicApiQueueSha, uxApiQueueSha].includes(sha(extractedApiQueue))) {
  for (const phase of ['queued', 'dispatched', 'revoked', 'owner-revoked', 'default']) {
    const { reply, posts } = await probeApiQueue(extractedApiQueue, phase);
    assert.equal(reply.code, ['queued', 'revoked', 'owner-revoked'].includes(phase) ? 499 : 200, 'Current queue: ' + phase);
    assert.equal(posts, phase === 'queued' ? 0 : 1, 'Current queue transport count: ' + phase);
  }
}
if ([classicApiQueueSha, uxApiQueueSha].includes(sha(extractedApiQueue))) {
  let generated = 0;
  const calls = [], scope = { token: 'classic-session', uuid: () => 'generated-' + ++generated,
    projections: { invalidate() {} }, apiNow: async (method, path, body, options) => {
      calls.push({ method, key: options.idempotencyKey, authToken: options.authToken });
      return { code: 200, body: { ok: true } };
    } };
  vm.runInNewContext('let _authQueue = Promise.resolve();\n' + extractedApiQueue + '\nthis.call = api;', scope);
  await scope.call('POST', '/controlled-action', {}, { idempotencyKey: 'retained-receipt' });
  await scope.call('POST', '/controlled-action', {});
  await scope.call('GET', '/controlled-read');
  assert.equal(generated, 1, 'Only a mutation without a supplied receipt generates a key');
  assert.deepEqual(calls, [
    { method: 'POST', key: 'retained-receipt', authToken: 'classic-session' },
    { method: 'POST', key: 'generated-1', authToken: 'classic-session' },
    { method: 'GET', key: undefined, authToken: 'classic-session' },
  ], 'The actual classic queue preserves supplied keys, creates missing mutation keys and leaves reads keyless');
}
if (sha(extractedApiQueue) === uxApiQueueSha) {
  const invalidated = [], calls = [];
  const scope = { token: 'ux-session', uuid: () => assert.fail('Explicit receipts must be retained'), scheduleCityPresence() {},
    projections: { invalidate: kind => invalidated.push(kind) }, apiNow: async (method, path, body, options) => {
      calls.push({ method, path, key: options.idempotencyKey, authToken: options.authToken });
      return { code: 200, body: { ok: true } };
    } };
  vm.runInNewContext('let _authQueue = Promise.resolve();\n' + extractedApiQueue + '\nthis.call = api;', scope);
  await scope.call('PUT', '/v1/ux/workspace', { preferences: {} }, { idempotencyKey: 'private-receipt' });
  assert.deepEqual(invalidated, [], 'Private workspace synchronization invalidates neither game projection');
  await scope.call('POST', '/controlled-action', {}, { idempotencyKey: 'game-receipt' });
  assert.deepEqual(invalidated, ['player', 'world'], 'Ordinary game mutations still invalidate both projections');
  assert.deepEqual(calls, [
    { method: 'PUT', path: '/v1/ux/workspace', key: 'private-receipt', authToken: 'ux-session' },
    { method: 'POST', path: '/controlled-action', key: 'game-receipt', authToken: 'ux-session' },
  ], 'The actual UX queue dispatches both authenticated requests with their original receipts');
}
const command = executionId => ({ commandId: 'craft', commandType: 'recipe.craft', label: 'Craft key', parameters: {},
  availability: 'AVAILABLE', confirmation: { required: false }, executionIdentity: { executionId } });
const html = `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<style>button{min-width:100px;height:44px}body{margin:8px}</style><div id="tab-world" class="on"></div><script>
window.refreshOnScroll=false; window.detachOnScroll=false; window.wrongIdentity=false;
const target=document.querySelector('#tab-world');
function paint(board){
  target.innerHTML='<div class="world-summary">Current board</div><button id="world-refresh">Refresh world</button><button id="move">Craft key</button>';
  target.querySelector('#world-refresh').onclick=refresh;
  target.querySelector('#move').onclick=async()=>{
    const executionId=window.wrongIdentity?'unexpected-board.craft':board.commands[0].executionIdentity.executionId;
    sessionStorage.setItem('omerta_world_pending',executionId);
    await fetch('/v1/commands/execute',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({executionId,confirmed:false})});
    sessionStorage.removeItem('omerta_world_pending');
    target.insertAdjacentHTML('beforeend','<div class="world-notice" role="status"><b>Craft key</b>Recorded</div>');
  };
}
${coordinator}
let token='controlled-session', _authQueue=Promise.resolve();
const uuid=()=>crypto.randomUUID();
function scheduleCityPresence(){}
${extractedApiQueue}
async function apiNow(method,path){const response=await fetch(path,{method});return {code:response.status,body:await response.json()};}
const projections=createProjectionRefresh({worldPath:'/v1/commands',request:(path,ticket)=>api('GET',path,undefined,{isCurrent:ticket.isCurrent}),
  clear:()=>{target.innerHTML='<div class="world-card" role="status">Refreshing your street…</div>';},
  apply:(_,result)=>paint(result.body),unauthorized:()=>{throw Error('Unexpected unauthorized');}});
projections.setSession(token);
function refresh(){return projections.world();}
window.queueRefresh=()=>{_authQueue=fetch('/read-gate');return refresh();};
window.loadingWithoutRequest=()=>{target.innerHTML='<div class="world-card" role="status">Refreshing your street…</div>';};
const original=Element.prototype.scrollIntoView;
Element.prototype.scrollIntoView=function(...args){
  original.apply(this,args);
  if(this.id==='move'&&window.refreshOnScroll){window.refreshOnScroll=false;refresh();}
  if(this.id==='move'&&window.detachOnScroll){window.detachOnScroll=false;this.replaceWith(this.cloneNode(true));}
};
refresh();</script>`;
const server = http.createServer((req, res) => {
  if (req.url === '/v1/commands') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ schemaVersion: 1, commandSchemaVersion: 1, opportunities: [], commands: [command(`board-${++reads}.craft`)], operations: {}, cases: {} })); return;
  }
  if (req.url === '/read-gate') { assert(!heldReadGate); heldReadGate = res; return; }
  if (req.url === '/v1/commands/execute') {
    let body = ''; req.on('data', chunk => { body += chunk; }); req.on('end', () => {
      const input = JSON.parse(body); posts.push(input); res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: 'COMPLETED', executionId: input.executionId }));
    }); return;
  }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
try {
  browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 800 }, hasTouch: true });
  const session = { page, board: null }, result = { controls: [], recoveries: [], commands: [] };
  const { engine, reach } = browserControls({ pageFor: async () => session, width: 360, result, save() {} });
  const origin = `http://127.0.0.1:${server.address().port}`;
  const reset = async () => { posts = []; await page.goto(origin, { waitUntil: 'networkidle' }); return engine.snapshot('fixture'); };
  const execute = board => { const key = board.commands[0].executionIdentity.executionId; return engine.execute('fixture', { executionId: key }, key); };

  // Pause only the test driver's protocol boundary after its generation check.
  // The real node, pinned canonical coordinator/API queue, HTTP and click remain intact.
  async function duringConnectivityRead(work, action) {
    const original = page.locator; let invoked = false;
    page.locator = function (...args) {
      const locator = original.apply(this, args), byRole = locator.getByRole;
      locator.getByRole = function (...roleArgs) {
        const matches = byRole.apply(this, roleArgs), all = matches.all;
        matches.all = async function (...allArgs) {
          const rows = await all.apply(this, allArgs);
          for (const row of rows) { const handle = row.elementHandle;
            row.elementHandle = async function (...handleArgs) {
              const element = await handle.apply(this, handleArgs), evaluate = element.evaluate;
              element.evaluate = async function (...evaluateArgs) {
                if (!invoked) { invoked = true; await work(); } return evaluate.apply(this, evaluateArgs);
              }; return element;
            };
          } return rows;
        }; return matches;
      }; return locator;
    };
    try { return await action(); } finally { page.locator = original; assert(invoked, 'Connectivity boundary must actually be reached'); }
  }

  // Reproduce the former Locator behavior against a real replacement DOM and HTTP request.
  let board = await reset(), selected = board.commands[0].executionIdentity.executionId;
  const locator = page.getByRole('button', { name: 'Craft key', exact: true });
  await page.evaluate(() => { window.refreshOnScroll = true; });
  await reach(page, locator, 'Craft key');
  const response = page.waitForResponse(res => new URL(res.url()).pathname === '/v1/commands/execute');
  await locator.click(); await response;
  assert.equal(posts.length, 1); assert.notEqual(posts[0].executionId, selected, 'Old Locator submits a newer board identity');

  board = await reset(); await page.evaluate(() => { window.refreshOnScroll = true; });
  let interruption;
  await assert.rejects(execute(board), error => { interruption = error; return error.observedBrowserRefresh === true; });
  assert.equal(posts.length, 0, 'Refreshed replacement must not be submitted');
  assert.equal(await engine.retryIssuedCommand('fixture', board.commands[0], interruption), true);
  board = await engine.snapshot('fixture'); selected = board.commands[0].executionIdentity.executionId;
  assert.equal((await execute(board)).executionId, selected); assert.deepEqual(posts.map(row => row.executionId), [selected]);

  board = await reset(); await page.evaluate(() => { window.detachOnScroll = true; });
  await assert.rejects(execute(board), /detached without an observed board refresh/); assert.equal(posts.length, 0);

  const legacyExpected = process.env.RC1_EXPECT_DETACHMENT_RACE === '1', timing = [];
  for (const mode of ['refresh-during-connectivity-await', 'clear-before-queued-get']) {
    board = await reset(); const beforeReads = reads; let release;
    const actualRead = page.waitForRequest(request => request.method() === 'GET' && new URL(request.url()).pathname === '/v1/commands', { timeout: 5000 });
    actualRead.catch(() => {});
    const work = async () => {
      if (mode === 'refresh-during-connectivity-await') await page.evaluate(() => refresh());
      else {
        await page.evaluate(() => { window.queueRefresh(); });
        assert.equal(reads, beforeReads, 'The board clears before its queued GET starts');
        release = setInterval(() => { if (heldReadGate) { const r = heldReadGate; heldReadGate = null; clearInterval(release); r.end('released'); } }, 100);
      }
    };
    let failure;
    await assert.rejects(duringConnectivityRead(work, () => execute(board)), error => {
      failure = error; return legacyExpected ? /detached without an observed board refresh/.test(error.message) : error.observedBrowserRefresh === true;
    });
    assert.equal(posts.length, 0, 'No submission in either protocol race');
    await actualRead; await page.waitForLoadState('networkidle'); assert(reads > beforeReads, 'The test must observe the actual queued board GET');
    timing.push({ mode, zeroSubmissions: true, observedReads: reads - beforeReads, legacyAssertionReproduced: legacyExpected });
    if (!legacyExpected) {
      assert.equal(await engine.retryIssuedCommand('fixture', board.commands[0], failure), true);
      board = await engine.snapshot('fixture'); const chosen = board.commands[0].executionIdentity.executionId;
      assert.equal((await execute(board)).executionId, chosen); assert.deepEqual(posts.map(row => row.executionId), [chosen]);
    }
  }
  board = await reset();
  await assert.rejects(duringConnectivityRead(() => page.evaluate(() => window.loadingWithoutRequest()), () => execute(board)), /detached without an observed board refresh/);
  assert.equal(posts.length, 0, 'A loading message alone is not proof of an actual refresh');

  board = await reset(); await page.evaluate(() => { window.wrongIdentity = true; });
  let mismatch;
  await assert.rejects(execute(board), error => { mismatch = error; return /selected issued identity/.test(error.message); });
  assert.equal(posts.length, 1); assert.equal(await engine.retryIssuedCommand('fixture', board.commands[0], mismatch), false);
  console.log(JSON.stringify({ status: 'PASS_SCOPED', browser: browser.version(), timing, diagnostics: result.boardLifecycleDiagnostics, checks: [
    'former-locator-submits-new-board', 'refresh-during-reach-submits-zero', 'visible-reissue-submits-exactly-once',
    'unexplained-detachment-fails', 'loading-without-actual-request-fails', 'submitted-identity-mismatch-still-fails-without-retry' ] }));
} finally { if (heldReadGate) heldReadGate.end('cleanup'); if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
