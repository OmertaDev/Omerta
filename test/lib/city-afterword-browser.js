// The real Fieldwork journal exposes the earned NPC continuation through original controls.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright-core';
import { cityAfterwordFixture, afterwordGraph as graph, mysteryRoot } from './city-afterword-fixture.js';

export async function runCityAfterwordBrowserProof() {
  const executablePath = [process.env.CHROMIUM_PATH, chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome'].find(file => file && fs.existsSync(file));
  assert(executablePath, 'Use an installed Chromium/Chrome executable.');
  const fixture = await cityAfterwordFixture();
  const { app, actor, finishBroadcast, board, economy } = fixture;
  let browser;
  const errors = [], proof = [];
  try {
    await app.listen({ host: '127.0.0.1', port: 0 });
    const base = 'http://127.0.0.1:' + app.server.address().port;
    browser = await chromium.launch({ executablePath, headless: true });
    for (const [branch, viewport] of [['live', { width: 1440, height: 1000 }], ['archive', { width: 390, height: 844 }]]) {
      const owner = await actor('Afterword Browser ' + branch), other = branch === 'live' ? 'archive' : 'live';
      await finishBroadcast(owner, branch);
      const before = await economy(owner);
      const context = await browser.newContext({ viewport, serviceWorkers: 'block', reducedMotion: 'reduce' });
      await context.addInitScript(token => {
        localStorage.setItem('omerta_token', token);
        for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1');
      }, owner.token);
      const page = await context.newPage(), sent = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('request', request => {
        const path = new URL(request.url()).pathname;
        if (request.method() === 'POST' && path.startsWith(mysteryRoot(graph))) sent.push({ path, body: request.postDataJSON() });
      });
      const settled = () => page.locator('#tab-fieldwork .fieldwork-body[aria-busy="false"]').waitFor();
      const open = async () => {
        await page.goto(base, { waitUntil: 'domcontentloaded' });
        await page.locator('#screen-main:not(.hidden)').waitFor();
        await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));
        await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill('fieldwork');
        await page.locator('#jump-list [data-jump="fieldwork"]').first().click();
        await page.locator('#tab-fieldwork.on').waitFor();
        await page.locator('[data-fieldwork-view="mysteries"]').click(); await settled();
      };
      const perform = async (control, path) => {
        const response = page.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === path);
        await control.click(); assert.equal((await response).status(), 200); await settled();
      };
      const detail = page.locator('#tab-fieldwork .fieldwork-case');
      const discover = async step => {
        await perform(detail.getByRole('button', { name: 'Investigate the next lead', exact: true }), mysteryRoot(graph) + '/explore');
        await detail.locator(`[data-fieldwork-node="mystery:afterword-${branch}-${step}"]`).waitFor();
        assert.equal(await detail.locator(`[data-fieldwork-node*="afterword-${other}"]`).count(), 0,
          'The actual journal never renders the unchosen continuation.');
      };
      const complete = async step => {
        const id = `mystery:afterword-${branch}-${step}`;
        await perform(detail.locator(`[data-fieldwork-node="${id}"] [data-fieldwork-action]`), mysteryRoot(graph) + '/nodes/' + encodeURIComponent(id) + '/complete');
      };
      await open();
      await perform(page.locator(`[data-fieldwork-case="${graph}"]`).getByRole('button', { name: 'Begin What Your Choice Set in Motion', exact: true }), mysteryRoot(graph) + '/start');
      await discover('invitation');
      assert.match(await detail.innerText(), branch === 'live' ? /restored the live transmitter/ : /saved the old recording/);
      await complete('invitation'); await discover('work');
      await page.reload({ waitUntil: 'domcontentloaded' }); await open();
      await page.locator(`[data-fieldwork-mystery="${graph}"]`).click(); await settled();
      await detail.locator(`[data-fieldwork-node="mystery:afterword-${branch}-work"]`).waitFor();
      await complete('work'); await discover('finale'); await complete('finale');
      assert.equal((await board(owner)).status, 'completed');
      await detail.getByRole('heading', { name: 'Case closed', exact: true }).waitFor();
      const ending = page.locator('[data-ux-story="case"] [data-story-section^="epilogue:"]');
      await ending.waitFor();
      if (!await ending.evaluate(element => element.open)) await ending.locator(':scope > summary').click();
      assert.match(await ending.innerText(), branch === 'live' ? /The neighborhood knows whom to call/ : /The archive remembers another name/);
      assert.equal(sent.filter(request => request.path.endsWith('/complete')).length, 3, 'Three deliberate original controls perform the three real story steps.');
      assert.deepEqual(await economy(owner), before);
      const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
      assert(widths[0] <= widths[1] + 2, 'The full journal and continuation fit the actual viewport.');
      proof.push(`${branch}: ${viewport.width}px real journal, remembered invitation, new NPC work, reload and lasting epilogue`);
      await context.close();
    }
    assert.deepEqual(errors, []);
    console.log('city-afterword-browser: ' + proof.join('; ') + ' PASS');
  } finally { if (browser) await browser.close(); await app.close(); }
}
