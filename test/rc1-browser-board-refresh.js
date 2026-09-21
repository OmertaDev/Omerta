// Controlled browser/HTTP lifecycle evidence; this is not native gameplay proof.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';

let reads = 0, posts = [], browser;
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
async function refresh(){
  target.innerHTML='<div class="world-card" role="status">Refreshing your street…</div>';
  paint(await(await fetch('/v1/commands')).json());
}
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
    res.end(JSON.stringify({ commands: [command(`board-${++reads}.craft`)], operations: {}, cases: {} })); return;
  }
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

  board = await reset(); await page.evaluate(() => { window.wrongIdentity = true; });
  let mismatch;
  await assert.rejects(execute(board), error => { mismatch = error; return /selected issued identity/.test(error.message); });
  assert.equal(posts.length, 1); assert.equal(await engine.retryIssuedCommand('fixture', board.commands[0], mismatch), false);
  console.log(JSON.stringify({ status: 'PASS_SCOPED', browser: browser.version(), checks: [
    'former-locator-submits-new-board', 'refresh-during-reach-submits-zero', 'visible-reissue-submits-exactly-once',
    'unexplained-detachment-fails', 'submitted-identity-mismatch-still-fails-without-retry' ] }));
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
