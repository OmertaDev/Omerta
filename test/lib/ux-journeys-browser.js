import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';

export async function runJourneyBrowserProof() {
  const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(existsSync);
  assert(executablePath, 'Set CHROMIUM_PATH for journey browser checks');
  const server = createServer((req, res) => {
    res.setHeader('Content-Type', 'text/html');
    res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;background:#161712;color:#eee}button{padding:8px}section[hidden]{display:none}*{box-sizing:border-box}</style><div id="tabs"><button data-tab="start">Start</button><button data-tab="streets">Streets</button><button data-tab="empire">Empire</button><button data-tab="life">Life</button></div><div id="sheet-body"></div><main id="tabbodies"><section id="tab-start"></section><section id="tab-streets" hidden><button id="real-job">Original job action</button><details class="ux-tactics"><summary>Current job comparison</summary><p>Current costs and chances</p></details></section><section id="tab-empire" hidden><button data-asbuy="beater">Original Beater purchase</button></section><section id="tab-life" hidden></section></main>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch({ executablePath, headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    for (const name of ['navigation', 'progression']) {
      await page.addStyleTag({ content: readFileSync(new URL(`../../public/ux-${name}.css`, import.meta.url), 'utf8') });
      await page.addScriptTag({ content: readFileSync(new URL(`../../public/ux-${name}.js`, import.meta.url), 'utf8') });
    }
    await page.evaluate(async () => {
      window.state = { currentTab: 'start', me: { id: 'alice1', accountId: 'alice', generation: 1, level: 1,
        cash: 5100, assets: [], eff: { speed: 5 }, trades: [], loc: 'docks' }, rules: {} };
      window.calls = []; window.actions = 0; document.querySelector('.ux-tactics').dataset.uxTactics = '';
      window.offer = { id: 'beater', name: 'Beater Sedan', stat: 'speed', boost: 2,
        cost: { price: 5000, fee: 50, tax: 50, total: 5100 }, affordable: true };
      window.read = async path => { calls.push(path); if (window.holdNext) { holdNext = false; return new Promise(resolve => { window.releaseQuote = resolve; }); }
        return { code: 200, body: { tactics: { characterId: state.me.id, generatedAt: new Date().toISOString(), openingUpgrades: [structuredClone(offer)] } } }; };
      window.navigate = async tab => { state.currentTab = tab; for (const node of document.querySelectorAll('#tabbodies>section')) node.hidden = node.id !== `tab-${tab}`;
        await progression.render(); navigation.afterRender(); };
      window.createModules = () => {
        window.progression = createOmertaProgression({ getState: () => state, read, navigate, notify: () => {} });
        window.navigation = createOmertaNavigation({ getState: () => state, navigate, notify: () => {} });
      };
      createModules(); await progression.render(); navigation.render();
      document.getElementById('real-job').onclick = () => actions++;
      document.querySelector('[data-asbuy]').onclick = () => actions++;
    });
    assert.equal(await page.locator('#ux-tool-discovery').count(), 1, 'Only one contextual introduction is shown');
    assert.equal(await page.locator('#ux-screen-tools').getAttribute('open'), null, 'Mobile tools remain collapsed');
    await page.locator('#ux-screen-tools > summary').click();
    await page.getByRole('button', { name: 'See the upgrade journey', exact: true }).click();
    assert.equal(await page.locator('#ux-screen-tools').getAttribute('open'), null);
    assert.equal(await page.locator('.ux-opening').getAttribute('open'), '');
    assert.equal(await page.locator('.ux-opening > summary').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => actions), 0, 'Discovery focuses the real tool without executing an action');
    await page.getByRole('button', { name: 'Find a useful upgrade', exact: true }).click();
    await page.getByLabel('Choose your first upgrade').waitFor();
    assert.match(await page.getByLabel('Choose your first upgrade').textContent(), /5,100/);
    await page.getByRole('button', { name: 'Start this journey', exact: true }).click();
    assert.match(await page.locator('.ux-opening-budget').textContent(), /5,100.*100 house take/);
    assert.equal(await page.locator('.ux-opening-steps [data-complete=true]').count(), 0);
    await page.evaluate(async () => {
      const before = structuredClone(state.me); state.me.cash += 200;
      progression.recordOperation({ actor: 'alice1:1', feedbackId: 'job1', feedbackState: 'confirmed', resourceCurrent: true,
        state: 'success', method: 'POST', path: '/v1/crimes/pickpocket', label: 'Pickpocket', atIso: new Date().toISOString() }, before, structuredClone(state.me),
      { code: 200, body: { ok: true, success: true, take: 200, decisionContext: { crimeId: 'pickpocket', projectedAt: new Date().toISOString() } } }); await progression.render();
    });
    assert.equal(await page.locator('.ux-opening-steps [data-complete=true]').count(), 1);
    await page.getByRole('button', { name: 'Review this purchase', exact: true }).click();
    assert.equal(await page.locator('[data-asbuy]').evaluate(node => node === document.activeElement), true);
    assert.equal(await page.evaluate(() => actions), 0, 'Review never buys on the player’s behalf');
    await page.locator('#tab-empire .ux-opening > summary').click();
    await page.evaluate(async () => {
      const before = structuredClone(state.me); state.me.cash -= 5100; state.me.assets = ['beater']; state.me.eff.speed = 7;
      progression.recordOperation({ actor: 'alice1:1', feedbackId: 'purchase1', feedbackState: 'confirmed', resourceCurrent: true,
        state: 'success', method: 'POST', path: '/v1/assets/beater/buy', atIso: new Date().toISOString() }, before, structuredClone(state.me),
      { code: 200, body: { ok: true, asset: 'beater', spent: 5100 } }); await progression.render();
    });
    assert.equal(await page.locator('#tab-empire .ux-opening-steps [data-complete=true]').count(), 3);
    assert.match(await page.locator('#tab-empire .ux-opening-complete').textContent(), /Journey complete.*current chance/);
    assert.match(await page.locator('#tab-empire .ux-opening-steps').textContent(), /speed: 5 → 7/);
    await page.evaluate(async () => { navigation.destroy(); createModules(); await navigate('start'); });
    assert.equal(await page.locator('#tab-start .ux-opening-steps [data-complete=true]').count(), 3, 'The private journey survives reload');
    assert.equal(await page.locator('#ux-tool-discovery').count(), 0, 'An introduced tool is not repeatedly announced');
    await page.evaluate(async () => {
      const value = JSON.parse(localStorage.getItem('omerta_progression_v1:alice'));
      delete value.opening.purchase; delete value.opening.gain;
      localStorage.setItem('omerta_progression_v1:alice', JSON.stringify(value));
      progression = createOmertaProgression({ getState: () => state, read, navigate, notify: () => {} }); await progression.render();
    });
    assert.match(await page.locator('#tab-start .ux-opening').textContent(), /already own this upgrade.*nothing needs to be bought again/);
    assert.equal(await page.getByRole('button', { name: 'Review this purchase', exact: true }).count(), 0, 'An unobserved acquisition never points at a missing buy control');
    await page.evaluate(async () => {
      state.me = { ...state.me, accountId: 'bob', id: 'bob1', assets: [], cash: 5100, eff: { speed: 5 } };
      await navigate('start');
    });
    assert.equal(await page.locator('#tab-start .ux-opening-steps [data-complete=true]').count(), 0, 'Another account cannot inherit completion');
    assert.doesNotMatch(await page.locator('#tab-start .ux-opening').textContent(), /speed: 5 → 7/);
    await page.locator('#tab-start .ux-opening > summary').click();
    await page.evaluate(() => { holdNext = true; });
    await page.getByRole('button', { name: 'Find a useful upgrade', exact: true }).click();
    await page.evaluate(async () => {
      state.me = { ...state.me, id: 'bob2', generation: 2 }; await progression.render();
      releaseQuote({ code: 200, body: { tactics: { characterId: 'bob1', generatedAt: new Date().toISOString(), openingUpgrades: [{ ...offer, name: 'Previous character quote' }] } } });
      await new Promise(requestAnimationFrame);
    });
    assert.doesNotMatch(await page.locator('#tab-start .ux-opening').textContent(), /Previous character quote/,
      'Delayed quotes from a predecessor cannot populate an heir’s journey');
    await page.evaluate(async () => { await navigate('streets'); });
    await page.locator('#ux-screen-tools > summary').click();
    await page.getByRole('button', { name: 'Open job comparison', exact: true }).click();
    assert.equal(await page.locator('.ux-tactics').getAttribute('open'), '');
    assert.equal(await page.evaluate(() => actions), 0);
    await page.evaluate(async () => { await navigate('life'); });
    await page.locator('#ux-screen-tools > summary').click();
    await page.locator('[data-ux-tips]').click();
    assert.equal(await page.locator('[data-ux-tips]').getAttribute('aria-pressed'), 'false');
    assert.equal(await page.locator('#ux-tool-discovery').count(), 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, 'Journey and discovery fit a phone');
    assert.deepEqual(errors, []);
    console.log('UX journeys browser: contextual reveal/dismissal, real-control focus, total costs, confirmed earn→purchase→gain, reload, account/heir isolation and phone layout passed.');
  } finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
}
