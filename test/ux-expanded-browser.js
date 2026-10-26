// Actual app integration for the expanded planning, investigation, coordination and world UX.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { MEGAPROJECT } from '../src/rules.js';
import { recordEventResult } from '../src/events.js';
assert(!process.env.DATABASE_URL, 'Expanded UX browser checks require disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, 'Set CHROMIUM_PATH to installed Chromium.');
const app = await buildServer(), pool = app.pool, faults = [], artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-ux-expanded-'));
let browser;
const api = async (method, url, token, payload) => {
  const reply = await app.inject({ method, url, payload, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}) } });
  assert.equal(reply.statusCode, 200, `${method} ${url}: ${reply.body}`); return reply.json();
};
const create = async name => { const { token } = await api('POST', '/v1/auth/guest'); await api('POST', '/v1/character', token, { name }); return { token, ch: (await pool.query('SELECT * FROM characters WHERE name=$1', [name])).rows[0] }; };
const jump = async (page, tab) => {
  await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab);
  await page.locator(`#jump-list [data-jump="${tab}"]`).first().click(); await page.locator(`#tab-${tab}.on`).waitFor();
};
const disclosure = async (locator) => { if (!await locator.evaluate(node => node.open)) await locator.locator(':scope > summary').click(); };
const noOverflow = async (page, label) => { const widths = await page.evaluate(() => ({ viewport: innerWidth, document: document.documentElement.scrollWidth })); assert.ok(widths.document <= widths.viewport + 2, `${label}: ${JSON.stringify(widths)}`); };
const snapshot = async player => {
  const ch = (await pool.query('SELECT respect,cash,muscle,cunning,speed,loc FROM characters WHERE id=$1', [player.ch.id])).rows[0];
  const skills = (await pool.query('SELECT skill_id FROM character_skills WHERE character_id=$1 ORDER BY skill_id', [player.ch.id])).rows;
  return { ch: { ...ch, respect: Number(ch.respect), cash: Number(ch.cash) }, skills };
};
try {
  const player = await create('Expanded UX Reader'), mate = await create('Expanded UX Mate'), other = await create('Expanded UX Other');
  for (const person of [player, mate]) await pool.query('UPDATE characters SET respect=10000,cash=200000,energy=100,nerve=40,health=80 WHERE id=$1', [person.ch.id]);
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES ('expanded-crew','Expanded Planning Crew',$1)", [player.ch.account_id]);
  for (const person of [player, mate]) await pool.query("INSERT INTO crew_members(crew_id,account_id,name,joined_at) VALUES ('expanded-crew',$1,$2,$3)", [person.ch.account_id, person.ch.name, new Date(Date.now() - 3600000)]);
  await pool.query("INSERT INTO gangs(id,name,tag) VALUES ('expanded-family','The Expanded Family','EXPD')");
  await pool.query("UPDATE districts SET holder_gang='expanded-family',npc_holder=NULL,garrison=50000 WHERE id='docks'");
  const monument = MEGAPROJECT.MONUMENTS[0], projectId = monument.id + ':0', progress = Math.floor(monument.target * .58);
  await pool.query('INSERT INTO megaprojects(id,monument,seq,target,progress) VALUES($1,$2,0,$3,$4)', [projectId, monument.id, monument.target, progress]);
  await recordEventResult(pool, { kind: 'boxing', icon: '🥊', headline: 'Expanded fixture: the ring has a new name', winnerName: player.ch.name, pool: 100 });
  // Give the real journal one discovered clue before opening the application.
  await api('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/start', player.token, {});
  await api('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/nodes/mystery%3Aneighborhood-fixer/complete', player.token, { interactionId: 'meet_neighborhood_fixer' });
  await api('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/choices/choice%3Aneighborhood-approach', player.token, { interactionId: 'choose_neighborhood_approach', optionId: 'listen' });
  await api('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/nodes/mystery%3Aneighborhood-listen/complete', player.token, { interactionId: 'inspect_neighborhood_watch' });
  await api('POST', '/v1/worldgraph/mysteries/neighborhood-initiation/explore', player.token, {});
  await app.listen({ host: '127.0.0.1', port: 0 }); const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const contexts = [];
  const authenticate = async (person, mobile = false) => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 }, reducedMotion: 'reduce', serviceWorkers: 'block' }); contexts.push(context);
    await context.addInitScript(token => { localStorage.setItem('omerta_token', token); localStorage.setItem('omerta_tour2', '1'); localStorage.setItem('omerta_welcomed', '1'); localStorage.setItem('omerta_alltabs', '1'); }, person.token);
    const page = await context.newPage();
    page.on('pageerror', error => faults.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type()) && /UI .*unavailable|UI enhancement unavailable|renderSheet failed/.test(message.text())) faults.push(message.text()); });
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    // Only the old welcome UI is suppressed; feature rendering and all data reads are real.
    await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(node => node.classList.add('hidden')));
    await page.locator('select[data-ux-density]').waitFor(); return page;
  };
  const page = await authenticate(player), gameWrites = [];
  page.on('request', request => { if (request.url().startsWith(base + '/v1/') && !['GET', 'HEAD'].includes(request.method()) && !request.url().endsWith('/v1/ux/workspace')) gameWrites.push({ path: new URL(request.url()).pathname, method: request.method() }); });
  assert.equal(await page.evaluate(() => ['createOmertaWorkspace', 'createOmertaTactics', 'createOmertaInvestigation', 'createOmertaCoordination', 'createOmertaWorld'].every(name => typeof window[name] === 'function')), true);
  await jump(page, 'streets'); const beforePreview = await snapshot(player);
  await disclosure(page.locator('#tab-streets [data-ux-tactics]'));
  await page.locator('#tab-streets .ux-tactics-comparison').waitFor();
  assert.match(await page.locator('#tab-streets .ux-tactics-comparison').innerText(), /Success chance/);
  await page.locator('#tab-streets [data-tactics-add]').first().click();
  await page.locator('#tab-streets [data-tactics-view="plan"]').click();
  await page.locator('#tab-streets .ux-tactics-plan li').waitFor();
  await page.locator('#tab-streets [data-tactics-view="loadout"]').click();
  await page.locator('#tab-streets [data-tactics-field="unowned"]').check();
  await page.locator('#tab-streets [data-tactics-gear]').first().check();
  const previewResponse = page.waitForResponse(reply => reply.url().includes('/v1/ux/tactics?') && reply.request().method() === 'GET');
  await page.locator('#tab-streets [data-tactics-preview]').click(); assert.equal((await previewResponse).status(), 200);
  assert.deepEqual(await snapshot(player), beforePreview, 'comparison, planning and hypothetical preview leave gameplay state unchanged');
  assert.deepEqual(gameWrites, [], 'planning sends only reads and account workspace preferences');
  await noOverflow(page, 'desktop planning');
  await page.screenshot({ path: path.join(artifacts, 'expanded-planning-desktop.png'), fullPage: false });

  await jump(page, 'fieldwork'); await page.locator('.world-fieldwork').waitFor();
  await page.locator('[data-fieldwork-view="mysteries"]').click();
  await page.locator('.investigation-workspace').waitFor(); await page.locator('.investigation-speaker').first().waitFor();
  await page.getByLabel('Pin a found clue', { exact: true }).selectOption('evidence:neighborhood-timing');
  await page.locator('.investigation-pin').waitFor();
  await disclosure(page.locator('.investigation-scene'));
  await page.locator('.investigation-desk-object').first().click();
  await page.locator('dialog.investigation-inspector[open]').waitFor();
  assert.match(await page.locator('dialog.investigation-inspector').innerText(), /receipt predates the ferry horn/i);
  await page.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();
  assert.deepEqual(gameWrites, [], 'opening and arranging the private case does not execute a game action');

  await jump(page, 'crew'); await page.locator('#ux-coordination [data-coord-scope]').waitFor();
  assert.match(await page.locator('#ux-coordination').innerText(), /Expanded Planning Crew/);
  const planForm = page.locator('#ux-coordination form[data-coord-form="plan"]'); await disclosure(planForm.locator('..'));
  await planForm.locator('[name="title"]').fill('Expanded integration plan'); await planForm.locator('[name="nextStep"]').fill('Review the journal together.');
  const planResponse = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/crew-workspace') && reply.request().method() === 'POST');
  await planForm.locator('button[type="submit"]').click(); assert.equal((await planResponse).status(), 200);
  await page.locator('.ux-coord-note h4').filter({ hasText: 'Expanded integration plan' }).waitFor();
  assert.equal((await api('GET', '/v1/ux/crew-workspace', mate.token)).notes.some(note => note.data.title === 'Expanded integration plan'), true, 'the actual teammate sees the saved planning note');

  await jump(page, 'start'); await page.locator('#tab-start .ux-world-panel').waitFor();
  await jump(page, 'city'); await page.locator('#tab-city .ux-turf-sign').filter({ hasText: 'EXPD' }).waitFor();
  const liveMap = await api('GET', '/v1/map', player.token), docks = liveMap.districts.find(district => district.id === 'docks');
  assert.equal(docks.holder.tag, 'EXPD');
  assert.match(await page.locator('#tab-city .ux-district-scene').filter({ hasText: 'Turf held by EXPD' }).innerText(), /EXPD/);
  await page.locator('#tab-city [data-world-layer]').selectOption('venues'); await page.locator('#tab-city .ux-venue-links button').first().waitFor();
  await page.locator('#tab-city [data-world-layer]').selectOption('ownership');
  const works = page.locator('#tab-city .ux-world-panel details[data-section="works"]'); await disclosure(works);
  const mega = await api('GET', '/v1/megaproject', player.token), actualPct = Math.round(Number(mega.current.progress) / Number(mega.current.target) * 100);
  assert.equal(actualPct, 58); assert.match(await works.locator('.ux-project-art').first().getAttribute('aria-label'), /58 percent/);
  assert.match(await works.innerText(), /58% recorded construction/);
  const news = page.locator('#tab-city .ux-world-panel details[data-section="news"]'); await disclosure(news);
  const headline = news.locator('.ux-world-news').filter({ hasText: 'Expanded fixture: the ring has a new name' }); await headline.waitFor();
  await headline.locator('[data-world-go="boxing"]').click(); await page.locator('#tab-boxing.on').waitFor();

  await jump(page, 'life'); await page.locator('#tab-life [data-uwgift="doc"]').waitFor();
  const oldStanding = (await api('GET', '/v1/underworld', player.token)).npcs.find(npc => npc.id === 'doc').standing;
  const giftResponse = page.waitForResponse(reply => reply.url().endsWith('/v1/underworld/doc/gift') && reply.request().method() === 'POST');
  const giftBoardSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);
  await page.locator('#tab-life [data-uwgift="doc"]').click(); const gift = await giftResponse; assert.equal(gift.status(), 200);
  await giftBoardSettled;
  await page.locator('#tab-life .ux-npc-memory').waitFor({ state: 'attached' });
  const memories = page.locator('#tab-life .ux-world-panel details[data-section="memory"]'); await disclosure(memories);
  assert.match(await memories.innerText(), /brought an envelope/);
  assert.ok((await api('GET', '/v1/underworld', player.token)).npcs.find(npc => npc.id === 'doc').standing > oldStanding);
  const priorRespect = Number((await pool.query('SELECT respect FROM characters WHERE id=$1', [player.ch.id])).rows[0].respect);
  await pool.query('UPDATE characters SET respect=respect+123 WHERE id=$1', [player.ch.id]);
  const learningBoardSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);
  await jump(page, 'life'); await learningBoardSettled; await page.locator('#tab-life .ux-learning-curve').waitFor({ state: 'attached' });
  const learning = page.locator('#tab-life .ux-world-panel details[data-section="learning"]'); await disclosure(learning); await disclosure(learning.locator('details'));
  assert.match(await learning.locator('tbody tr').last().innerText(), new RegExp((priorRespect + 123).toLocaleString('en-US')), 'curve table reflects actual newly recorded server respect');

  const comfortableSize = await page.locator('#tab-life .ux-world-panel p').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize));
  await page.locator('select[data-ux-density]').selectOption('large');
  const largeSize = await page.locator('#tab-life .ux-world-panel p').first().evaluate(node => parseFloat(getComputedStyle(node).fontSize)); assert.ok(largeSize > comfortableSize, 'large reading mode changes visible typography');
  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), false, 'focus mode visibly removes the side column');
  assert.match(await page.locator('#ux-focus-vitals').innerText(), /Health.*nerve/);
  await page.locator('[data-ux-focus]').click(); assert.equal(await page.locator('#leftcol').isVisible(), true);
  await disclosure(page.locator('#ux-workspace-toolbar .ux-workspace-controls > details'));
  await page.evaluate(() => { window.originalWorldPanel = document.querySelector('#tab-life > .ux-world-panel'); window.originalWorldParent = originalWorldPanel.parentElement; window.worldIndex = [...originalWorldParent.children].indexOf(originalWorldPanel); });
  const worldOrder = page.locator('.ux-panel-order-row').filter({ has: page.locator('span', { hasText: 'Your place in the city' }) });
  await worldOrder.getByRole('button', { name: /^Up:/ }).focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => originalWorldPanel === document.querySelector('#tab-life > .ux-world-panel')), true, 'keyboard arrangement moves the original node with its handlers');
  assert.notEqual(await page.evaluate(() => [...originalWorldParent.children].indexOf(originalWorldPanel)), await page.evaluate(() => worldIndex), 'keyboard Up visibly changes panel order');
  await page.evaluate(() => { window.originalTacticsPanel = document.querySelector('#tab-life > [data-ux-tactics]'); window.originalGiftControl = document.querySelector('#tab-life [data-uwgift="doc"]'); });
  const orderOfPanels = () => page.evaluate(() => [...document.querySelector('#tab-life').children].filter(node => node.dataset.uxPanel).map(node => node.dataset.uxPanel));
  const beforeDrag = await orderOfPanels();
  const dragHandle = page.locator('#tab-life > .ux-world-panel > .ux-panel-handle'), targetHandle = page.locator('#tab-life > [data-ux-tactics] > .ux-panel-handle');
  await dragHandle.dragTo(targetHandle);
  if (JSON.stringify(await orderOfPanels()) === JSON.stringify(beforeDrag)) {
    // Chromium headless sometimes misses native HTML drag delivery across a long scrolling panel.
    // Dispatch the same drag events with a real DataTransfer through the production handlers.
    const transfer = await page.evaluateHandle(() => new DataTransfer());
    await dragHandle.dispatchEvent('dragstart', { dataTransfer: transfer });
    await targetHandle.dispatchEvent('dragover', { dataTransfer: transfer });
    await targetHandle.dispatchEvent('drop', { dataTransfer: transfer });
  }
  const draggedOrder = await orderOfPanels(); assert.notDeepEqual(draggedOrder, beforeDrag, 'drag/drop changes panel order in the same parent');
  assert.equal(await page.evaluate(() => originalWorldPanel === document.querySelector('#tab-life > .ux-world-panel')
    && originalTacticsPanel === document.querySelector('#tab-life > [data-ux-tactics]')
    && originalGiftControl === document.querySelector('#tab-life [data-uwgift="doc"]') && typeof originalGiftControl.onclick === 'function'), true,
  'dragging preserves the original panels, gameplay control and handlers');
  await jump(page, 'streets');
  const reorderedLifeSettled = page.waitForResponse(reply => reply.url().endsWith('/v1/season/recap') && reply.status() === 200);
  await jump(page, 'life'); await reorderedLifeSettled;
  await page.waitForFunction(expected => JSON.stringify([...document.querySelector('#tab-life').children].filter(node => node.dataset.uxPanel).map(node => node.dataset.uxPanel)) === JSON.stringify(expected), draggedOrder);
  assert.deepEqual(await orderOfPanels(), draggedOrder, 'saved order survives leaving the screen and its complete core rerender');
  await noOverflow(page, 'desktop world workspace');
  await page.screenshot({ path: path.join(artifacts, 'expanded-workspace-preferences-desktop.png'), fullPage: false });
  await page.locator('#tab-life > .ux-world-panel').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: path.join(artifacts, 'expanded-world-desktop.png'), fullPage: false });

  await page.waitForFunction(() => document.querySelector('#ux-workspace-status')?.textContent.includes('saved to your account'), { timeout: 15000 });
  const saved = await api('GET', '/v1/ux/workspace', player.token); assert.equal(saved.values.layout.density, 'large'); assert.ok(saved.values.investigation['neighborhood-initiation'].pins.includes('evidence:neighborhood-timing'));
  const fresh = await authenticate(player);
  try { await fresh.waitForFunction(() => document.body.dataset.uxDensity === 'large', undefined, { timeout: 10000 }); }
  catch (error) {
    console.log('Fresh-device workspace diagnostic: ' + JSON.stringify(await fresh.evaluate(() => ({ status: document.querySelector('#ux-workspace-status')?.textContent, density: document.body.dataset.uxDensity,
      namespaces: Object.keys(JSON.parse(localStorage.getItem(Object.keys(localStorage).find(key => key.startsWith('omerta_workspace:'))) || '{}')) }))));
    await fresh.screenshot({ path: path.join(artifacts, 'expanded-fresh-device-failure.png'), fullPage: false }); throw error;
  }
  assert.equal(await fresh.locator('select[data-ux-density]').inputValue(), 'large', 'the visible preference control matches the hydrated typography');
  await jump(fresh, 'fieldwork'); await fresh.locator('[data-fieldwork-view="mysteries"]').click(); await fresh.locator('.investigation-pin').waitFor();
  assert.match(await fresh.locator('.investigation-pin').first().innerText(), /Stopped Workshop Clock/, 'private workspace pins hydrate on a fresh device');
  const otherPage = await authenticate(other); assert.equal(await otherPage.locator('body').getAttribute('data-ux-density'), 'comfortable');
  await jump(otherPage, 'crew'); await otherPage.locator('#tab-crew.on').waitFor();
  assert.doesNotMatch(await otherPage.locator('#tab-crew').innerText(), /Expanded integration plan|Expanded Planning Crew/, 'an unrelated account sees no crew plan');
  assert.equal((await api('GET', '/v1/ux/workspace', other.token)).values.investigation?.['neighborhood-initiation'], undefined, 'private deduction workspace is account-isolated');
  const mobile = await authenticate(player, true); await mobile.waitForFunction(() => document.body.dataset.uxDensity === 'large');
  assert.equal(await mobile.locator('select[data-ux-density]').inputValue(), 'large');
  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view="mysteries"]').click(); await mobile.locator('.investigation-workspace').waitFor();
  await noOverflow(mobile, 'mobile investigation'); await disclosure(mobile.locator('.investigation-scene')); await mobile.locator('.investigation-desk-object').first().click();
  await mobile.locator('dialog.investigation-inspector[open]').waitFor(); await noOverflow(mobile, 'mobile document dialog');
  await mobile.screenshot({ path: path.join(artifacts, 'expanded-investigation-mobile.png'), fullPage: false });
  await mobile.locator('dialog.investigation-inspector').getByRole('button', { name: 'Close inspection', exact: true }).click();
  await jump(mobile, 'crew'); await mobile.locator('#ux-coordination [data-coord-scope]').waitFor(); await noOverflow(mobile, 'mobile crew coordination');
  await mobile.locator('#ux-coordination').evaluate(node => node.scrollIntoView({ block: 'start' }));
  await mobile.screenshot({ path: path.join(artifacts, 'expanded-coordination-mobile.png'), fullPage: false });
  assert.deepEqual(faults, [], 'the actual page has no runtime errors or unavailable UX module warnings');
  console.log('Expanded actual-page browser proof passed. Screenshots: ' + artifacts);
  for (const context of contexts) await context.close();
} finally { if (browser) await browser.close(); await app.close(); }
