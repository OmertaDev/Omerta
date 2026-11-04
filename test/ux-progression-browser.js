// Progression proof: real browser interactions, server-derived eligibility, account isolation and stale reads.
import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH,
  process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'),
  process.env.HOME && join(process.env.HOME, '.cache', 'ms-playwright')].filter(Boolean);
const candidates = [process.env.CHROMIUM_PATH];
for (const root of roots) {
  if (!existsSync(root)) continue;
  for (const version of readdirSync(root).filter(name => name.startsWith('chromium')).sort().reverse())
    for (const binary of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-linux/chrome',
      'chrome-headless-shell-win64/headless_shell.exe', 'chrome-linux/headless_shell']) candidates.push(join(root, version, binary));
}
const executablePath = candidates.find(path => path && existsSync(path));
assert.ok(executablePath, 'Install Chromium or set CHROMIUM_PATH for the progression browser proof.');
const js = readFileSync(new URL('../public/ux-progression.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../public/ux-progression.css', import.meta.url), 'utf8');
const server = createServer((req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.end('<!doctype html><div id="sheet-body"></div><div id="tab-life"><button data-learn="basic">Learn basic</button><button data-learn="advanced">Learn advanced</button></div><div id="tab-profile"></div><div id="tab-map"></div><div id="tab-city"></div><div id="tab-streets"></div>');
});
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.addStyleTag({ content: css });
  await page.addScriptTag({ content: js });
  await page.evaluate(async () => {
    window.state = { currentTab: 'life', me: { accountId: 'alice', id: 'alice-one', name: 'Alice', generation: 1, level: 4,
      loc: 'docks', honor: { value: 0, tier: 'Unproven' }, trades: [{ id: 'larceny', name: 'Larceny', lvl: 2,
        rank: 'Green', xp: 15, nextAt: 60, pct: 0, perkNextAt: 10, perkWhat: 'job cooldown' }] },
      rules: { crimes: [{ id: 'job', name: 'Warehouse job', lvl: 5, nerve: 3 }], districts: [{ id: 'docks', name: 'The Docks' }, { id: 'canal', name: 'Canal' }] } };
    window.boards = {
      '/v1/skills': { tree: [{ id: 'basic', name: 'Basic', branch: 'muscle', tier: 1, cost: 1, known: false, desc: 'Your first skill' },
        { id: 'advanced', name: 'Advanced', branch: 'muscle', tier: 2, cost: 2, known: false, desc: 'Your next skill' }], points: { available: 3 } },
      '/v1/mastery': { legend: { total: 15, rank: 'Dabbler' } },
      '/v1/underworld': { thresholds: [25, 60, 90], npcs: [{ id: 'doc', name: 'Doc', standing: 20, tier: 0, perks: ['Discount care'], earn: 'Heal wounds' }] },
      '/v1/season/recap': { recaps: [{ season: 8, title: 'Night Watch', level: 4, kills: 0, prestigeGained: 2 }] },
      '/v1/collection': { categories: [{ id: 'districts', items: [{ id: 'docks', name: 'The Docks', got: true }, { id: 'canal', name: 'Canal', got: false }] }] },
      '/v1/content': { instances: [{ id: 'closed-case', title: 'A closed case', status: 'completed' }] },
    };
    window.requests = [];
    window.ux = window.createOmertaProgression({ getState: () => window.state,
      read: async path => { requests.push(path); return { code: 200, body: boards[path] || {} }; },
      navigate: async tab => { state.currentTab = tab; await ux.render(); }, notify: () => {} });
    // The production Life renderer supplies these boards through successful GET observation.
    for (const path of ['/v1/skills', '/v1/mastery', '/v1/underworld', '/v1/season/recap']) ux.observe(path, boards[path]);
    await ux.render();
  });
  assert.deepEqual(await page.evaluate(() => requests), [], 'Life consumes observed boards without adding duplicate network reads');
  assert.equal(await page.locator('.ux-skill-node.is-available').count(), 1, 'only prerequisite-ready skills are available');
  assert.equal(await page.locator('.ux-skill-node.is-locked').count(), 1, 'the next tier remains locked despite enough points');
  assert.match(await page.locator('.ux-npc-card').textContent(), /5 standing until your next introduction \(25\)/, 'NPC distance comes from live thresholds');
  assert.match(await page.locator('.ux-unlock-preview').textContent(), /Warehouse job.*1 levels away/, 'the next actual catalog unlock is previewed');
  await page.locator('[data-ux-progression="life"] select').first().selectOption('trade:larceny');
  await page.waitForFunction(() => document.querySelector('.ux-goal-card').textContent.includes('45 XP to go'));
  await page.evaluate(async () => {
    const before = structuredClone(state.me);
    state.me.trades[0] = { ...state.me.trades[0], xp: 60, lvl: 3, nextAt: 135, rank: 'Apprentice', pct: 0 };
    ux.recordOperation({}, before, state.me, { ok: true }); await ux.render();
  });
  assert.match(await page.locator('.ux-goal-card').textContent(), /Goal reached/, 'the pinned target stays fixed when the next server threshold changes');
  assert.match(await page.locator('[data-panel="scrapbook"]').textContent(), /Green L2 → Apprentice L3/, 'mastery milestones retain the actual before-and-after values');
  await page.evaluate(async () => { state.currentTab = 'profile'; await ux.render(); });
  assert.match(await page.locator('[data-panel="journal"]').textContent(), /A closed case/, 'closed cases become journal entries');
  assert.equal(await page.locator('.ux-journal-entry').count(), 2, 'undiscovered districts do not become discoveries');
  // The saved keepsake must be an actual self-contained picture, with untrusted text escaped.
  await page.evaluate(async () => {
    state.me.name = 'Alice <script>window.injected=true</script> & Co';
    const seasons = structuredClone(boards['/v1/season/recap']);
    seasons.recaps[0].title = 'Night </text><script>alert(1)</script> "Watch"';
    ux.observe('/v1/season/recap', seasons); await ux.render();
    const createObjectURL = URL.createObjectURL.bind(URL);
    URL.createObjectURL = blob => { window.keepsakeBlob = blob; return createObjectURL(blob); };
  });
  await page.locator('#tab-profile [data-panel="seasons"] summary').click();
  const downloadPromise = page.waitForEvent('download');
  await page.locator('#tab-profile [data-panel="seasons"]').getByRole('button', { name: 'Save dossier', exact: true }).click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'omerta-season-8.svg');
  const svg = readFileSync(await download.path(), 'utf8');
  assert.equal(await page.evaluate(() => keepsakeBlob.type), 'image/svg+xml;charset=utf-8');
  assert.match(svg, /Alice &lt;script&gt;window.injected=true&lt;\/script&gt; &amp; Co/);
  assert.match(svg, /Night &lt;\/text&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt; &quot;Watch&quot;/);
  assert.doesNotMatch(svg, /<script|<image|<use|href=|onload=/i, 'the offline SVG contains no executable markup or external references');
  const savedFacts = await page.evaluate(source => {
    const xml = new DOMParser().parseFromString(source, 'image/svg+xml');
    return { errors: xml.querySelectorAll('parsererror').length, text: xml.documentElement.textContent,
      vectors: xml.querySelectorAll('path').length, scripts: xml.querySelectorAll('script').length };
  }, svg);
  assert.equal(savedFacts.errors, 0, 'the downloaded file is valid SVG XML');
  assert.equal(savedFacts.scripts, 0);
  assert.ok(savedFacts.vectors >= 5, 'the keepsake includes vector illustration');
  assert.match(savedFacts.text, /Level 4, 0 kills, 2 prestige gained/);
  await page.evaluate(async () => { state.me.name = 'Alice'; ux.observe('/v1/season/recap', boards['/v1/season/recap']); await ux.render(); });
  await page.locator('[data-panel="dossier"] summary').click();
  await page.getByLabel('Accent', { exact: true }).selectOption('blue');
  await page.waitForSelector('.ux-dossier-theme-blue');
  await page.getByLabel('Show earned portrait frame', { exact: true }).check();
  await page.waitForSelector('.ux-earned-frame');
  await page.getByLabel('Display an earned title', { exact: true }).selectOption('season:8');
  await page.waitForFunction(() => document.querySelector('.ux-sheet-title')?.textContent.includes('Night Watch'));
  await page.evaluate(async () => {
    ux.beforeRender(document.querySelector('#tab-profile'));
    document.querySelector('#tab-profile').replaceChildren();
    await ux.render();
  });
  assert.equal(await page.locator('[data-panel="dossier"]').evaluate(node => node.open), true, 'dossier disclosure survives the core renderer replacing its panel');
  await page.evaluate(async () => {
    const baseline = requests.length;
    ux.recordOperation({}, structuredClone(state.me), state.me, { code: 200, body: { ok: true } });
    await ux.render();
    window.postActionReads = requests.length - baseline;
  });
  assert.equal(await page.evaluate(() => postActionReads), 0, 'post-action sheet refresh adds no archive fan-out');
  await page.evaluate(async () => { state.currentTab = 'map'; await ux.render(); });
  assert.equal(await page.locator('.ux-map-stamp.is-visited').count(), 1, 'the map stamps visited districts only');
  assert.equal(await page.locator('.ux-map-stamp:not(.is-visited)').count(), 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'the progression UI fits a narrow mobile viewport');

  // Source strings must be rendered as text, never interpreted as markup.
  await page.evaluate(async () => {
    state.me.trades[0].name = '<img id="injected-title" src=x onerror="window.injected=true">';
    state.currentTab = 'streets'; await ux.render();
  });
  assert.equal(await page.locator('#injected-title').count(), 0);
  assert.equal(await page.evaluate(() => window.injected), undefined);

  // A different account on the same browser must not inherit goals, titles, visits or archives.
  await page.evaluate(async () => { state.me = { ...state.me, accountId: 'bob', id: 'bob-one', name: 'Bob', loc: 'canal' }; state.currentTab = 'map'; await ux.render(); });
  assert.doesNotMatch(await page.locator('.ux-goal-card').textContent(), /Goal reached/);
  assert.equal(await page.locator('.ux-sheet-title').count(), 0);
  assert.ok(await page.evaluate(() => localStorage.getItem('omerta_progression_v1:alice')?.includes('trade:larceny')), 'Alice retains her own stored goal');
  assert.ok(!await page.evaluate(() => localStorage.getItem('omerta_progression_v1:bob')?.includes('trade:larceny')), 'Bob does not inherit the goal');

  // A board that finishes after account switching must not populate the new account's panel.
  await page.evaluate(async () => {
    let release;
    window.delayedUx = createOmertaProgression({ getState: () => state, read: () => new Promise(resolve => { release = resolve; }), navigate: async () => {}, notify: () => {} });
    state.currentTab = 'map'; window.delayedRender = delayedUx.render();
    state.me = { ...state.me, accountId: 'carol', id: 'carol-one' };
    release({ code: 200, body: { categories: [{ id: 'districts', items: [{ id: 'docks', name: 'Wrong account', got: true }] }] } });
    await delayedRender;
  });
  assert.equal(await page.locator('[data-ux-progression="map"]').count(), 0, 'stale responses cannot mount another account’s records');
  assert.deepEqual(errors, [], 'no client runtime errors');
  console.log('Progression browser proof passed: goals, unlocks, prerequisites, NPC tiers, journal, cosmetics, keepsakes, mobile sizing, safe text and account isolation.');
} finally {
  await browser.close(); await new Promise(resolve => server.close(resolve));
}
const { runJourneyBrowserProof } = await import('./lib/ux-journeys-browser.js');
await runJourneyBrowserProof();
const { runOpeningLiveBrowserProof } = await import('./lib/ux-opening-live-browser.js');
await runOpeningLiveBrowserProof();
