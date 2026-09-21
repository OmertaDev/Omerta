// Controlled DOM/HTTP helper controls, separate from native gameplay evidence.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { browserControls } from './lib/rc1-browser-controls.js';

let releaseToast, requested, browser;
const entered = new Promise(resolve => { requested = resolve; });
const server = http.createServer((req, res) => {
  if (req.url === '/toast-release') { releaseToast = () => { res.writeHead(200); res.end('done'); }; requested(); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end('<!doctype html>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
const html = (overlay, script = '') => `<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
  <style>body{margin:0}button{position:absolute;left:100px;top:100px;width:100px;height:44px;border:0}
  #toast,#obstruction{display:none;position:absolute;left:100px;top:100px;width:100px;height:44px;z-index:2}
  #toast.show,#obstruction.show{display:block}</style><button id="target">Move</button>${overlay}<script>${script}</script>`;
try {
  browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
  const page = await browser.newPage({ viewport: { width: 360, height: 600 }, hasTouch: true });
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  const result = { controls: [] }, { reach } = browserControls({ width: 360, result, pageFor: async () => ({ page }),
    save() { if (result.reachabilityDiagnostics?.at(-1)?.event === 'rc1-finite-toast-obstruction') releaseToast?.(); } });
  await page.setContent(html('<div id="toast" class="show">Saved</div>', "fetch('/toast-release').then(()=>document.querySelector('#toast').classList.remove('show'))"));
  await entered;
  const geometry = await reach(page, page.locator('#target'), 'finite toast');
  assert.equal(result.reachabilityDiagnostics.length, 1); assert(geometry.hit); assert.equal(geometry.height, 44);
  const count = result.reachabilityDiagnostics.length;
  await page.setContent(html('<div id="toast" class="show"><span class="toast-act">Undo</span></div>'));
  await assert.rejects(reach(page, page.locator('#target'), 'actionable toast'), /overlay covers/);
  assert.equal(result.reachabilityDiagnostics.length, count, 'Actionable toast must not authorize the finite wait');
  await page.setContent(html('<div id="obstruction" class="show">Permanent</div>'));
  await assert.rejects(reach(page, page.locator('#target'), 'unknown overlay'), /overlay covers/);
  assert.equal(result.reachabilityDiagnostics.length, count);
  await page.setContent(html('<div id="toast" class="show">Stuck toast</div>'));
  await assert.rejects(reach(page, page.locator('#target'), 'non-disappearing toast'), /Timeout/);
  await page.setContent(html('')); await page.locator('#target').evaluate(node => { node.style.height = '43px'; });
  await assert.rejects(reach(page, page.locator('#target'), 'undersized control'), /critical touch target/);
  console.log(JSON.stringify({ status: 'PASS_SCOPED', browser: browser.version(), checks: [
    'observed-finite-toast-disappearance', 'actionable-toast-fails', 'unknown-overlay-fails', 'non-disappearing-toast-times-out', '44px-minimum-unchanged' ] }));
} finally { releaseToast?.(); if (browser) await browser.close(); await new Promise(resolve => server.close(resolve)); }
