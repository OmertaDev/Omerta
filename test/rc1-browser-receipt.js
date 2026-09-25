// Controlled rendered lifecycle only; native gameplay remains a separate gate.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import { chromium } from 'playwright-core';
import { waitForWorldReceipt } from './lib/rc1-browser-controls.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const commandRequested = deferred(), refreshRequested = deferred();
let releaseCommand, releaseRefresh, browser;
const label = 'Investigate: The Missing Carbon Index';
const html = `<!doctype html><div id="tab-world"><button id="move">Move</button></div><script>
document.querySelector('#move').onclick=async()=>{
  const target=document.querySelector('#tab-world');
  target.innerHTML='<div class="world-notice" role="status"><b>A move needs checking</b><p>${label}. Its outcome is not yet confirmed.</p></div>';
  await fetch('/command');
  target.innerHTML='<div class="world-card" role="status">Refreshing your street…</div>';
  await fetch('/refresh');
  target.innerHTML='<div class="world-notice" role="status"><b>${label}</b><p>1 new opportunity</p></div>';
};</script>`;
const server = http.createServer((req, res) => {
  const release = () => { if (!res.writableEnded) { res.writeHead(200); res.end('{}'); } };
  if (req.url === '/command') { releaseCommand = release; commandRequested.resolve(); return; }
  if (req.url === '/refresh') { releaseRefresh = release; refreshRequested.resolve(); return; }
  res.writeHead(200, { 'content-type': 'text/html' }); res.end(html);
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const binary = [process.env.CHROMIUM_PATH, 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome']
  .find(file => file && fs.existsSync(file));
try {
  browser = await chromium.launch({ ...(binary ? { executablePath: binary } : {}), headless: true });
  const page = await browser.newPage(); await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.locator('#move').click(); await commandRequested.promise;
  // The previous generic wait returns before a completion exists.
  await page.locator('#tab-world .world-notice[role="status"]').waitFor();
  assert.equal(await page.locator('#tab-world b').innerText(), 'A move needs checking');
  await assert.rejects(waitForWorldReceipt(page, label, { timeout: 100 }), /Timeout/);
  let completed = false;
  const completion = waitForWorldReceipt(page, label); completion.then(() => { completed = true; }, () => {});
  releaseCommand(); await refreshRequested.promise;
  await page.locator('#tab-world .world-card').waitFor();
  // The old immediate whole-tab assertion now fails during the actual refresh state.
  const refreshingText = await page.locator('#tab-world').innerText();
  assert.throws(() => assert(refreshingText.includes(label), 'player sees the action receipt'), /player sees/);
  assert.equal(completed, false);
  releaseRefresh(); assert.equal(await completion, label); assert(completed);
  await assert.rejects(waitForWorldReceipt(page, 'A different move', { timeout: 100 }), /Timeout/);
  await page.setContent(`<style>@keyframes tabIn { from { transform: translateY(7px); } to { transform: none; } }
    #tab { animation: tabIn .26s ease; position: absolute; top: 2030px; }
    button { width: 100px; height: 44px; min-height: 44px; padding: 0; border: 0; }</style>
    <div id="tab"><button>Move</button></div>`);
  const reached = page.getByRole('button', { name: 'Move', exact: true });
  await reached.scrollIntoViewIfNeeded();
  assert.equal(await page.locator('#tab').evaluate(node => getComputedStyle(node).transform), 'none');
  assert.equal((await reached.boundingBox()).height, 44, 'Unchanged44px criterion after finite entrance motion');
  console.log(JSON.stringify({ status: 'PASS_SCOPED', browser: browser.version(), checks: [
    'generic-status-returns-on-pending', 'pending-not-a-receipt', 'refresh-gap-reproduces-old-assertion',
    'completed-exact-label-required', 'wrong-label-fails', 'finite-motion-stabilized-before44px-measurement' ] }));
} finally {
  releaseCommand?.(); releaseRefresh?.(); if (browser) await browser.close();
  await new Promise(resolve => server.close(resolve));
}
