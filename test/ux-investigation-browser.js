import assert from 'node:assert/strict';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
const candidates = [process.env.CHROMIUM_PATH];
for (const root of [process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, 'ms-playwright'), process.env.PLAYWRIGHT_BROWSERS_PATH].filter(Boolean)) {
  if (!existsSync(root)) continue;
  for (const version of readdirSync(root).filter(name => name.startsWith('chromium')).sort().reverse())
    for (const binary of ['chrome-win64/chrome.exe', 'chrome-win/chrome.exe', 'chrome-headless-shell-win64/headless_shell.exe']) candidates.push(join(root, version, binary));
}
const executablePath = candidates.find(path => path && existsSync(path)); assert.ok(executablePath, 'Set CHROMIUM_PATH for the investigation browser proof.');
const server = createServer((_req, res) => { res.setHeader('content-type', 'text/html'); res.end('<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:12px;background:#221d16;color:#eee1ca}*{box-sizing:border-box}</style><main id="desk"></main>'); });
await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath, headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } }), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.addStyleTag({ content: readFileSync(new URL('../public/ux-investigation.css', import.meta.url), 'utf8') });
  await page.addScriptTag({ content: readFileSync(new URL('../public/ux-investigation.js', import.meta.url), 'utf8') });
  await page.evaluate(() => {
    window.state = { me: { id: 'a1', accountId: 'alice' }, currentTab: 'fieldwork' };
    window.values = {}, window.requests = [], window.navigation = [];
    window.detail = { graph: { id: 'neighborhood-initiation' }, instanceId: 'case1', status: 'active', choices: [{ nodeId: 'choice:neighborhood-approach', choiceId: 'listen' }], nodes: [
      { id: 'choice:neighborhood-approach', type: 'choice', title: 'Choose Your First Approach', status: 'completed', options: [{ id: 'listen', title: 'Listen' }, { id: 'ask', title: 'Ask' }] },
      { id: 'evidence:neighborhood-timing', type: 'evidence', status: 'completed', title: 'The Stopped Workshop Clock', dialogue: 'The receipt predates the ferry horn; the clock is stuck.' },
      { id: 'mystery:neighborhood-newsroom', type: 'mystery_step', status: 'discovered', title: 'Set the Record Straight', dialogue: 'Put Ada’s account beside your evidence.' },
    ] };
    window.meta = { graphId: 'neighborhood-initiation', status: 'active', visibleState: detail.nodes.map(node => `${node.id}:${node.status}`).join('|'), nodes: [
      { id: 'choice:neighborhood-approach', prerequisites: [] },
      { id: 'evidence:neighborhood-timing', document: 'receipt', detail: 'Receipt before the horn; a stuck clock hand.', hintCount: 0 },
      { id: 'mystery:neighborhood-newsroom', speaker: 'Elena Serra', expression: 'considering', lore: 'A supported correction can prevent an accusation.', hintCount: 3, evidence: ['evidence:neighborhood-timing'] },
    ] };
    window.catalog = { cases: [{ graphId: 'neighborhood-initiation', title: 'A Name Worth Remembering', experience: { mode: 'solo', length: 'short', label: 'A short introduction', nonexpiring: true, trail: [{ place: 'workshop', title: 'Follow the workshop account' }] } },
      { graphId: 'property-investigation', title: 'A House With a Past', experience: { mode: 'solo', length: 'extended', label: 'A multi-district inquiry' } }] };
    window.ctx = { root: document.querySelector('#desk'), view: 'mysteries', mysteryDetail: detail, boards: { recipes: { recipes: [
      { id: 'salvage', title: 'Strip a Wreck', inputs: [{ assetType: 'car', quantity: 1 }], outputs: [{ templateId: 'mat:steel', quantity: 6 }] },
      { id: 'harden', title: 'Harden Steel', inputs: [{ templateId: 'mat:steel', quantity: 4, quality: 'standard' }], outputs: [{ templateId: 'mat:hard', quantity: 1 }], cashCost: 300 },
      { id: 'tool', title: 'Machine a Lock Tool', inputs: [{ templateId: 'mat:hard', quantity: 1 }], outputs: [{ templateId: 'item:tool', quantity: 1 }] },
    ] }, inventory: { stacks: [{ templateId: 'mat:steel', title: 'Steel', qty: 6 }], items: [{ id: 'tool1', templateId: 'item:tool', title: 'Lock Tool', description: 'An account-held precision tool.' }] } } };
    window.ux = createOmertaInvestigation({ getState: () => state, workspace: { get: (key, fallback) => values[key] || fallback, set: (key, value) => { values[key] = structuredClone(value); } },
      notify: () => {}, navigate: tab => { navigation.push(tab); }, read: async path => {
        requests.push(path);
        if (path === '/v1/ux/investigations') return { code: 200, body: catalog };
        if (path.includes('/hints/')) { const level = Number(path.split('/').at(-1)); return { code: 200, body: { level, label: ['Nudge', 'Clue reference', 'Explicit guidance'][level - 1], text: ['Keep evidence beside the account.', 'Review the stopped clock.', 'Sign the correction using the issued action.'][level - 1] } }; }
        if (path === '/v1/ux/investigation-items') return { code: 200, body: { items: [{ id: 'held1', title: 'Committed Tool', kind: 'operation', operationId: 'op1', titleOfWork: 'Lockbox Operation', returnConditions: 'Returns to its recorded depositor on completion or cancellation.' }] } };
        return { code: 200, body: structuredClone(meta) };
      } });
    window.drawCore = () => {
      document.dispatchEvent(new CustomEvent('omerta:fieldwork-before-render'));
      ctx.root.replaceChildren(); const intro = document.createElement('div'); intro.className = 'fieldwork-intro'; ctx.root.append(intro);
      if (ctx.view === 'mysteries') {
        for (const entry of catalog.cases) { const card = document.createElement('article'); card.dataset.fieldworkCase = entry.graphId; card.textContent = entry.title; ctx.root.append(card); }
        for (const node of detail.nodes) { const card = document.createElement('article'); card.dataset.fieldworkNode = node.id; card.textContent = node.title; ctx.root.append(card); }
      }
      if (ctx.view === 'recipes') for (const recipe of ctx.boards.recipes.recipes) { const card = document.createElement('article'); card.dataset.fieldworkRecipe = recipe.id; card.textContent = recipe.title; ctx.root.append(card); }
      document.dispatchEvent(new CustomEvent('omerta:fieldwork-rendered', { detail: ctx }));
    };
    drawCore();
  });
  await page.waitForSelector('.investigation-speaker');
  assert.equal(await page.evaluate(() => requests.filter(path => path.includes('/hints/')).length), 0, 'opening a case never requests a hint');
  assert.match(await page.locator('.investigation-evidence-beside').textContent(), /receipt predates/, 'completed evidence appears beside the dialogue');
  assert.match(await page.locator('.investigation-speaker img').getAttribute('alt'), /Elena Serra, considering/);
  await page.getByLabel('Case experience', { exact: true }).selectOption('short');
  assert.equal(await page.locator('[data-fieldwork-case="property-investigation"]').isVisible(), false);
  await page.getByLabel('Pin a found clue', { exact: true }).selectOption('evidence:neighborhood-timing');
  assert.equal(await page.locator('.investigation-pin').count(), 1);
  await page.getByText('Add a person or possibility to compare', { exact: true }).click();
  await page.getByLabel('Person or suspect', { exact: true }).fill('The courier <script id="unsafe">');
  await page.getByLabel('Why are you considering them?', { exact: true }).fill('A possibility to test, not a proven accusation.');
  await page.getByRole('button', { name: 'Pin my possibility', exact: true }).click();
  assert.equal(await page.locator('.investigation-pin').count(), 2);
  assert.equal(await page.locator('#unsafe').count(), 0);
  await page.getByText('Connect two clues', { exact: true }).click();
  await page.getByLabel('Second clue', { exact: true }).selectOption({ index: 1 });
  await page.getByLabel('What connects them?', { exact: true }).fill('Compare the delivery account with the receipt.');
  await page.getByRole('button', { name: 'Save connection', exact: true }).click();
  assert.match(await page.locator('.investigation-connection').textContent(), /Compare the delivery account/);
  await page.getByLabel('I think…', { exact: true }).fill('The shared clock caused the confusion');
  await page.getByLabel('Because…', { exact: true }).fill('The receipt precedes the horn.');
  await page.getByRole('button', { name: 'Add hypothesis', exact: true }).click();
  await page.getByLabel('Revise hypothesis', { exact: true }).fill('The clock misled the room');
  await page.getByRole('button', { name: 'Save revision', exact: true }).click();
  assert.equal(await page.evaluate(() => values.investigation['neighborhood-initiation'].hypotheses[0].claim), 'The clock misled the room');
  await page.evaluate(() => { values.investigation['neighborhood-initiation'].hypotheses[0].claim = 'A revision from my other device'; ux.reloadWorkspace(); });
  assert.equal(await page.getByLabel('Revise hypothesis', { exact: true }).inputValue(), 'A revision from my other device', 'hydrated workspace notes replace the old presentation cache');
  await page.getByLabel('I think…', { exact: true }).fill('An unfinished private thought');
  await page.evaluate(() => drawCore()); await page.waitForSelector('.investigation-speaker');
  assert.equal(await page.getByLabel('I think…', { exact: true }).inputValue(), 'An unfinished private thought', 'drafts survive the core renderer replacing its content');
  await page.getByText('Inspect the objects on your case desk', { exact: true }).click();
  await page.locator('.investigation-desk-object').first().click();
  assert.equal(await page.locator('dialog[open]').count(), 1);
  assert.match(await page.locator('dialog [open]').textContent(), /receipt predates/);
  await page.getByLabel('Clue detail zoom', { exact: true }).press('End');
  await page.getByLabel('Pan horizontally', { exact: true }).press('End');
  assert.match(await page.locator('.investigation-zoom-plate').getAttribute('style'), /translate\(120px,\s*0px\) scale\(2.4\)/);
  await page.getByRole('button', { name: 'Close inspection', exact: true }).click();
  await page.getByText('A voluntary mastery challenge', { exact: true }).click();
  await page.getByRole('button', { name: 'Accept the no-further-hints challenge', exact: true }).click();
  await page.getByText('Request guidance for this step', { exact: true }).click();
  await page.getByRole('button', { name: 'Request a nudge', exact: true }).click();
  await page.waitForSelector('.investigation-hint');
  assert.equal(await page.evaluate(() => requests.filter(path => path.includes('/hints/')).length), 1, 'one deliberate request reveals only one rung');
  await page.getByRole('button', { name: 'Request a clue reference', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.investigation-hint').length === 2);
  assert.equal(await page.evaluate(() => requests.filter(path => path.includes('/hints/')).length), 2);
  await page.evaluate(() => { ux.render(); });
  assert.equal(await page.locator('.investigation-hint').count(), 2, 'requested hints survive presentation refresh without another request');
  await page.evaluate(() => {
    detail.status = 'completed'; detail.nodes[2].status = 'completed'; meta.status = 'completed'; meta.visibleState = detail.nodes.map(node => `${node.id}:${node.status}`).join('|');
    meta.explanation = { evidence: [{ title: 'The Stopped Workshop Clock', text: detail.nodes[1].dialogue }], conclusions: [{ title: 'Set the Record Straight', text: 'The completed timing evidence supported the published correction.' }] };
    ux.observe('/v1/worldgraph/mysteries/neighborhood-initiation', detail); drawCore();
  });
  await page.waitForSelector('.investigation-conclusion');
  assert.match(await page.locator('.investigation-challenge-stamp').textContent(), /guidance was requested/);
  assert.match(await page.locator('.investigation-conclusion').textContent(), /completed timing evidence/);
  assert.match(await page.locator('.investigation-branch').textContent(), /Chosen: Listen/);
  await page.evaluate(() => {
    delete values.investigation['neighborhood-initiation'].challenge;
    detail.status = 'active'; meta.status = 'active'; ux.observe('/v1/worldgraph/mysteries/neighborhood-initiation', detail); drawCore();
  });
  await page.waitForSelector('.investigation-reading-desk');
  await page.getByRole('button', { name: 'Accept the no-further-hints challenge', exact: true }).click();
  await page.evaluate(() => { detail.status = 'completed'; meta.status = 'completed'; ux.observe('/v1/worldgraph/mysteries/neighborhood-initiation', detail); drawCore(); });
  assert.match(await page.locator('.investigation-challenge-stamp').textContent(), /UNAIDED FINISH/, 'a voluntarily accepted finish without subsequent hints earns only its cosmetic stamp');
  await page.evaluate(() => { ctx.view = 'recipes'; drawCore(); });
  await page.locator('[data-fieldwork-recipe="tool"] summary').first().click();
  await page.getByText('Trace sources for hard', { exact: true }).click();
  assert.match(await page.locator('[data-fieldwork-recipe="tool"]').textContent(), /Harden Steel.*Strip a Wreck/s, 'dependency trace follows actual known outputs back to their sources');
  await page.locator('[data-fieldwork-recipe="harden"] summary').first().click();
  assert.match(await page.locator('[data-fieldwork-recipe="harden"]').textContent(), /4 × steel · standard.*Cash consumed: \$300/s);
  await page.evaluate(() => { ctx.view = 'inventory'; drawCore(); });
  await page.getByText('Steel', { exact: true }).click();
  assert.match(await page.locator('.investigation-inventory-aids').textContent(), /Consumed by recipe: Harden Steel/);
  await page.getByText('Item origins and committed equipment', { exact: true }).click();
  await page.getByRole('button', { name: 'Read my item custody records', exact: true }).click();
  await page.waitForSelector('.investigation-custody-item');
  assert.match(await page.locator('.investigation-custody-item').textContent(), /recorded depositor on completion or cancellation/);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'the reading desk fits a mobile viewport');
  await page.evaluate(() => { state.me = { id: 'b1', accountId: 'bob' }; ux.render(); });
  assert.equal(await page.locator('[data-investigation-ux]').count(), 0, 'account switching removes prior private workspace content');
  assert.deepEqual(errors, []);
  console.log('Investigation browser proof passed: clue/suspect board, connections, revised hypotheses, draft retention, authored hints, evidence/dialogue, scene inspection, transcription, zoom/pan, filters, final explanation, craft dependency trace, custody and account isolation.');
} finally { await browser.close(); await new Promise(resolve => server.close(resolve)); }
