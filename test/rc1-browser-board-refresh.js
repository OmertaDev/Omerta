// Controlled browser/HTTP lifecycle evidence; this is not native gameplay proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import crypto from 'node:crypto';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';

let reads = 0, posts = [], browser, heldReadGate;
const source = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const extract = (start, end, expected) => {
  assert.equal(source.split(start).length, 2); assert.equal(source.split(end).length, 2);
  const text = source.slice(source.indexOf(start), source.indexOf(end));
  assert.equal(crypto.createHash('sha256').update(text).digest('hex'), expected, 'Canonical client seam changed: review the extracted source'); return text;
};
const coordinator = extract('  function createProjectionRefresh(', '  // End projection refresh coordinator.', 'a693944e6e8bde4e4bee829865ce813ec588d860bf5e45fad95545fecc48b2da');
const apiQueue = extract('  async function api(method,', '  async function apiNow(', '61ffdfc08a79dca5491f95abf333f1fc9c9d125f344206a5233063ecaddeeba7');
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
${apiQueue}
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
