// Browser-level negative controls for the journey adapter, not gameplay proof.
// A controlled HTTP response holds the normal refresh in flight without sleeps.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';

let releaseRefresh, enteredRefresh, onDiagnostic;
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
  const command = { commandType: 'operation.create', label: 'Expected move', parameters: {}, confirmation: { required: false }, executionIdentity: { executionId: 'issued-original' } };
  const result = { controls: [], recoveries: [] }, { engine } = browserControls({ width: 360, result,
    save() { if (result.reachabilityDiagnostics?.at(-1)?.refreshing) onDiagnostic?.(); },
    pageFor: async () => ({ page, board: { commands: [command] } }) });
  const invoke = () => engine.execute('fixture-account', { executionId: 'issued-original' }, 'issued-original');
  const origin = `http://127.0.0.1:${server.address().port}`;
  await page.goto(origin);
  // A genuinely missing button on a settled board must remain a hard failure.
  await assert.rejects(invoke, error => error.code === 'ERR_ASSERTION' && /No reachable/.test(error.message));
  assert.equal(result.reachabilityDiagnostics.at(-1).refreshing, false);
  assert.equal(await engine.retryIssuedCommand('fixture-account', command, { statusCode: 409, body: { error: 'browser_board_refresh' } }), false,
    'A server-shaped refresh error without observed rendered state cannot authorize retry');
  const diagnosed = new Promise(resolve => { onDiagnostic = resolve; });
  await page.locator('#world-refresh').click(); await requested;
  const running = invoke(); running.catch(() => {}); await diagnosed; releaseRefresh();
  let refreshError;
  try { await running; assert.fail('Expected a refresh-specific reissue signal'); } catch (error) { refreshError = error; }
  assert.equal(refreshError.observedBrowserRefresh, true);
  assert.equal(refreshError.body.error, 'browser_board_refresh');
  assert.equal(await engine.retryIssuedCommand('fixture-account', command, refreshError), true);
  assert.equal(result.recoveries.length, 1); assert.equal(posts, 0, 'Neither missing control nor interrupted identity is submitted');
  assert.equal(result.reachabilityDiagnostics.at(-1).refreshing, true);
  // A disabled settled control is not a refresh and must also fail closed.
  await page.getByRole('button', { name: 'Expected move', exact: true }).evaluate(node => { node.disabled = true; });
  await assert.rejects(invoke, error => error.code === 'ERR_ASSERTION' && /No reachable/.test(error.message));
  assert.equal(result.reachabilityDiagnostics.at(-1).refreshing, false);
  assert.equal(posts, 0);
  console.log(JSON.stringify({ status: 'PASS_SCOPED', browser: browser.version(), checks: ['stable-missing-fails', 'unobserved-refresh-not-retried', 'rendered-refresh-reissues', 'disabled-settled-fails', 'zero-premature-submissions'] }));
} finally { if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
