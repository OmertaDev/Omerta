// Browser-level negative controls for the journey adapter, not gameplay proof.
// A controlled HTTP response holds the normal refresh in flight without sleeps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';

let releaseRefresh, enteredRefresh;
const requested = new Promise(resolve => { enteredRefresh = resolve; });
let posts = 0;
const html = `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><div id="tab-world">
  <div class="world-summary">Current board</div><button id="world-refresh">Refresh world</button></div>
  <script>document.querySelector('#world-refresh').onclick=async()=>{
    document.querySelector('#tab-world').innerHTML='<div class="world-card" role="status">Refreshing your street…</div>';
    await fetch('/v1/commands');
    document.querySelector('#tab-world').innerHTML='<div class="world-summary">Current board</div><button>Expected move</button>';
  };</script>`;
const server = http.createServer((req, res) => {
  if (req.method === 'POST') posts++;
  if (req.url === '/v1/commands') { releaseRefresh = () => { res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); }; enteredRefresh(); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
let browser;
try {
  browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 800 } });
  let boardReads = 0;
  page.on('request', request => {
    if (request.method() === 'GET' && new URL(request.url()).pathname === '/v1/commands') boardReads++;
  });
  const command = { commandType: 'operation.create', label: 'Expected move', parameters: {}, confirmation: { required: false }, executionIdentity: { executionId: 'issued-original' } };
  // This fixture supplies the selected board directly. Keep its session and
  // observed read generation, as the real adapter's snapshot does.
  const session = { page, board: { commands: [command] }, boardRead: boardReads };
  const result = { controls: [], recoveries: [] }, { engine } = browserControls({ width: 360, result,
    save() {},
    pageFor: async () => session });
  const invoke = () => engine.execute('fixture-account', { executionId: 'issued-original' }, 'issued-original');
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  // A genuinely missing button on a settled board must remain a hard failure.
  await assert.rejects(invoke, error => error.code === 'ERR_ASSERTION' && /No reachable/.test(error.message));
  assert.equal(result.reachabilityDiagnostics.at(-1).refreshing, false);
  assert.equal(await engine.retryIssuedCommand('fixture-account', command, { statusCode: 409, body: { error: 'browser_board_refresh' } }), false,
    'A server-shaped refresh error without observed rendered state cannot authorize retry');
  const refreshed = page.waitForResponse(response => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/commands');
  refreshed.catch(() => {});
  await page.locator('#world-refresh').click(); await requested;
  assert.equal(boardReads, 1, 'Reissue must be backed by the actual held HTTP read');
  let refreshError;
  try { await invoke(); assert.fail('Expected a refresh-specific reissue signal'); }
  catch (error) { refreshError = error; }
  finally { releaseRefresh(); }
  assert.equal(refreshError.observedBrowserRefresh, true);
  assert.equal(refreshError.body.error, 'browser_board_refresh');
  assert.equal(await engine.retryIssuedCommand('fixture-account', command, refreshError), true);
  assert.equal(result.recoveries.length, 1); assert.equal(posts, 0, 'Neither missing control nor interrupted identity is submitted');
  assert.equal(result.boardLifecycleDiagnostics.at(-1).stage, 'observed-refresh-before-submission');
  assert.equal(result.boardLifecycleDiagnostics.at(-1).dom.state.loading, true);
  assert.equal(result.boardLifecycleDiagnostics.at(-1).submissions, 0);
  await refreshed;
  await page.locator('#tab-world .world-summary').waitFor({ state: 'visible' });
  session.boardRead = boardReads;
  // A disabled settled control is not a refresh and must also fail closed.
  await page.getByRole('button', { name: 'Expected move', exact: true }).evaluate(node => { node.disabled = true; });
  await assert.rejects(invoke, error => error.code === 'ERR_ASSERTION' && /No reachable/.test(error.message));
  assert.equal(result.reachabilityDiagnostics.at(-1).refreshing, false);
  assert.equal(posts, 0);
  console.log(JSON.stringify({ status: 'PASS_SCOPED', browser: browser.version(), checks: ['stable-missing-fails', 'unobserved-refresh-not-retried', 'rendered-refresh-reissues', 'disabled-settled-fails', 'zero-premature-submissions'] }));
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
