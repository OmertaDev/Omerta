import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
].find((candidate) => fs.existsSync(candidate));
assert.ok(executablePath, 'Set CHROMIUM_PATH to an installed Chromium browser.');
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('http://ux-social.test/**', (route) => route.fulfill({ contentType: 'text/html', body: '<main><section id="tab-crew"><input id="crew-say"></section><section id="tab-discover"></section><section id="tab-start"><div class="card"><div class="row"><button id="paper-fold">fold</button></div></div></section><section id="tab-profile"></section><div id="feed"></div></main>' }));
  await page.goto('http://ux-social.test/');
  await page.addScriptTag({ path: path.resolve('public/ux-social.js') });
  await page.evaluate(() => {
    window.state = { me: { accountId: 'account-one', id: 'character-one', name: 'Reader', level: 5, respect: 1000, trades: [{ id: 'larceny', name: 'Larceny', lvl: 2, rank: 'Learner' }] }, currentTab: 'crew' };
    window.calls = []; window.notices = [];
    window.circle = { people: [{ name: 'Mate', relation: 'crew' }], highlights: [{ who: 'Mate', text: 'Closed the canal case', source: 'crew message', relation: 'crew', kind: 'shared' }] };
    window.ux = window.createOmertaSocial({ getState: () => window.state, read: async () => ({ code: 200, body: window.circle }), navigate() {}, notify: (text) => window.notices.push(text), action: async (method, route, body) => { window.calls.push({ method, route, body }); return { code: 200, body: { ok: true } }; } });
    window.ux.observe('/v1/crew', { crew: { id: 'crew-one', name: 'The Canal', members: [{ name: 'Reader', isMe: true }, { name: 'Mate', leader: true }], objective: { label: 'Run jobs', unit: 'jobs', progress: 40, target: 60, pct: 67, mine: 18, contributions: [{ name: 'Reader', n: 18 }, { name: 'Mate', n: 22 }] } } });
    window.ux.observe('/v1/circle', window.circle);
    window.ux.render();
  });
  assert.match(await page.locator('#ux-crew-welcome').innerText(), /Welcome to The Canal/);
  assert.match(await page.locator('#ux-crew-payoff').innerText(), /You supplied 18 jobs of the crew's 40 jobs/);
  assert.equal(await page.evaluate(() => window.calls.length), 0, 'rendering never sends social messages');
  await page.locator('#ux-circle-highlights summary').first().click();
  await page.locator('[data-crew-note]').first().click();
  await page.waitForFunction(() => window.calls.length === 1 && window.notices.length > 0);
  assert.deepEqual(await page.evaluate(() => window.calls[0]), { method: 'POST', route: '/v1/crew/chat', body: { text: 'Well done, Mate — Closed the canal case!' } });
  await page.evaluate(() => {
    window.state.currentTab = 'discover';
    window.ux.observe('/v1/mentor', { me: { level: 5 }, mentor: { name: 'The Veteran', graduated: false }, milestones: [{ lvl: 5, cash: 100 }, { lvl: 10, cash: 200, graduate: true }], proteges: [] });
    window.ux.render();
  });
  assert.equal(await page.locator('.ux-mentor-timeline li.reached').count(), 1);
  assert.match(await page.locator('.ux-mentor-timeline').innerText(), /Graduation/);
  await page.evaluate(() => {
    window.state.currentTab = 'start';
    window.ux.observe('/v1/paper', { fresh: true, headlines: [{ type: 'mastery_up', n: 2 }, { type: 'protege_graduated', n: 1 }] });
    const before = structuredClone(window.state.me);
    window.state.me.level = 6; window.state.me.respect = 1200;
    window.ux.recordOperation({ method: 'POST', path: '/v1/crime' }, before, window.state.me, { code: 200, body: { ok: true } });
  });
  assert.match(await page.locator('.ux-paper-growth').innerText(), /2 mastery advances/);
  assert.match(await page.locator('#ux-session-endpoint').innerText(), /1 confirmed action · 1 level gained · \+200 respect/);
  await page.locator('[data-session-open]').click();
  assert.match(await page.locator('#ux-session-endpoint').innerText(), /Reached level 6/);
  await page.evaluate(() => {
    const feed = document.getElementById('feed');
    for (const [name, urgent] of [['Mate', false], ['Stranger', false], ['Stranger', true]]) {
      const line = document.createElement('div'); line.className = 'ev' + (urgent ? ' urgent' : ''); line.dataset.cat = 'combat'; line.textContent = name;
      window.ux.decorateFeed(line, { channel: 'activity', ev: { who: name }, cat: 'combat', mine: false }); feed.append(line);
    }
  });
  await page.locator('#ux-feed-preferences summary').click();
  await page.locator('[data-feed-scope]').selectOption('circle');
  assert.equal(await page.locator('#feed > .ux-feed-hidden').count(), 1, 'circle preference preserves teammates and urgent notices');
  await page.evaluate(() => { window.state.me = { accountId: 'account-two', id: 'character-two', name: 'Other', level: 1, respect: 0 }; window.ux.render(); });
  assert.equal(await page.locator('[data-feed-scope]').inputValue(), 'all', 'preferences do not cross accounts');
  assert.equal(await page.locator('#feed > .ux-feed-hidden').count(), 0);
  assert.deepEqual(errors, []);
  console.log('ux-social-browser: PASS');
} finally { await browser.close(); }
