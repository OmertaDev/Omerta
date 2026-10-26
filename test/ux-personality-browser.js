// Real-page integration of private identity, atmosphere, working tools, story and Crew writing.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';
import { masteryXpFor } from '../src/rules.js';
import { grantStack, withItemTransaction } from '../src/items.js';

assert(!process.env.DATABASE_URL, 'Personality browser proof uses disposable pg-mem.');
process.env.INVITE_MODE = 'off'; process.env.RATE_LIMIT = 'off';
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(candidate => fs.existsSync(candidate));
assert.ok(executablePath, 'Set CHROMIUM_PATH to installed Chromium.');
const app = await buildServer(), pool = app.pool, errors = [], artifacts = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-ux-personality-'));
let browser;
const api = async (method, url, player, payload) => {
  const reply = await app.inject({ method, url, payload, headers: { ...(player ? { authorization: 'Bearer ' + player.token } : {}), ...(method === 'POST' ? { 'idempotency-key': randomUUID() } : {}) } });
  assert.equal(reply.statusCode, 200, `${method} ${url}: ${reply.body}`); return reply.json();
};
const disclosure = async locator => { if (!await locator.evaluate(element => element.open)) await locator.locator(':scope > summary').click(); };
const jump = async (page, tab) => { await page.locator('#btn-jump').click(); await page.locator('#jump-q').fill(tab); await page.locator(`#jump-list [data-jump="${tab}"]`).first().click(); await page.locator(`#tab-${tab}.on`).waitFor(); };
const noOverflow = async (page, where) => { const widths = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]); assert.ok(widths[0] <= widths[1] + 2, `${where} overflows: ${widths}`); };
const eventuallySaved = async (player, check) => { for (let attempt = 0; attempt < 30; attempt++) { const saved = await api('GET', '/v1/ux/workspace', player); if (check(saved.values)) return saved.values; await new Promise(resolve => setTimeout(resolve, 100)); } assert.fail('Expected account workspace edit to finish saving.'); };
const snapshot = async player => ({
  character: (await pool.query('SELECT cash,bank,respect,muscle,cunning,speed,ammo,loc FROM characters WHERE id=$1', [player.ch.id])).rows,
  items: (await pool.query('SELECT * FROM item_stacks WHERE owner_id=$1', [player.account])).rows,
  cars: (await pool.query('SELECT id,character_id,model_id,trim_id,dmg FROM cars WHERE character_id=$1', [player.ch.id])).rows,
});
try {
  const create = async name => { const { token } = await api('POST', '/v1/auth/guest'); const player = { token, account: app.jwt.verify(token).sub }; await api('POST', '/v1/character', player, { name }); player.ch = (await pool.query('SELECT * FROM characters WHERE account_id=$1 AND alive', [player.account])).rows[0]; return player; };
  const alice = await create('Personality Reader'), mate = await create('Personality Teammate'), other = await create('Personality Stranger');
  await pool.query('UPDATE characters SET respect=100000,cash=100000,loc=$1 WHERE id=$2', ['docks', alice.ch.id]);
  await pool.query("INSERT INTO masteries(character_id,track_id,xp) VALUES ($1,'larceny',$2)", [alice.ch.id, masteryXpFor(2)]);
  await pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES ('personality-car',$1,'muscle','stock',17)", [alice.ch.id]);
  await withItemTransaction(pool, client => grantStack(client, { scope: 'account', id: alice.account }, 'mat:scrap_steel', 8, 'standard', 'disposable personality fixture', 'personality:steel'));
  await pool.query("INSERT INTO crews(id,name,leader_account) VALUES ('personality-crew','The Reading Room',$1)", [alice.account]);
  for (const player of [alice, mate]) await pool.query("INSERT INTO crew_members(crew_id,account_id,name,joined_at) VALUES ('personality-crew',$1,$2,$3)", [player.account, player.ch.name, new Date(Date.now() - 3600000)]);
  await api('POST', '/v1/worldgraph/mysteries/property-investigation/start', alice, {});
  for (const [suffix, interactionId] of [['briefing', 'property_briefing'], ['ledger', 'property_inspect_ledger']]) await api('POST', '/v1/worldgraph/mysteries/property-investigation/nodes/' + encodeURIComponent('mystery:property-' + suffix) + '/complete', alice, { interactionId });
  await api('POST', '/v1/worldgraph/mysteries/property-investigation/choices/choice%3Aproperty-approach', alice, { interactionId: 'property_choose_approach', optionId: 'witness' });
  await pool.query('UPDATE characters SET loc=$1 WHERE id=$2', ['neon', alice.ch.id]);
  await api('POST', '/v1/worldgraph/mysteries/property-investigation/nodes/mystery%3Aproperty-witness/complete', alice, { interactionId: 'property_interview_witness' });
  const gameBefore = await snapshot(alice);
  await app.listen({ host: '127.0.0.1', port: 0 }); const base = 'http://127.0.0.1:' + app.server.address().port;
  browser = await chromium.launch({ executablePath, headless: true });
  const open = async (player, mobile = false) => {
    const context = await browser.newContext({ viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 1050 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.addInitScript(token => { localStorage.setItem('omerta_token', token); for (const key of ['omerta_tour2', 'omerta_welcomed', 'omerta_alltabs']) localStorage.setItem(key, '1'); }, player.token);
    const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (['warning', 'error'].includes(message.type()) && /UI .*unavailable|UI enhancement unavailable|renderSheet failed/.test(message.text())) errors.push(message.text()); });
    await page.goto(base, { waitUntil: 'domcontentloaded' }); await page.locator('#screen-main:not(.hidden)').waitFor();
    await page.evaluate(() => document.querySelectorAll('.modal-bg:not(.hidden)').forEach(element => element.classList.add('hidden')));
    if (mobile) await page.locator('#ux-screen-tools > summary').click();
    await page.locator('select[data-ux-density]').waitFor();
    if (mobile) {
      await page.locator('.ux-screen-tools-close').click();
      assert.equal(await page.locator('#ux-screen-tools').evaluate(node => node.open), false);
      assert.equal(await page.evaluate(() => document.activeElement === document.querySelector('#ux-screen-tools > summary')), true, 'closing mobile screen tools returns focus to its disclosure');
    }
    return page;
  };
  const page = await open(alice), writes = [], reads = new Set();
  page.on('request', request => { if (!request.url().startsWith(base + '/v1/')) return; const url = new URL(request.url()); if (request.method() === 'GET') reads.add(url.pathname); else if (url.pathname !== '/v1/ux/workspace') writes.push(url.pathname); });
  assert.equal(await page.evaluate(() => ['Workspace', 'Feedback', 'Progression', 'Social', 'Navigation', 'Tactics', 'Investigation', 'Coordination', 'Feel', 'Tools', 'Identity', 'Story', 'Community', 'World'].every(name => typeof window['createOmerta' + name] === 'function')), true, 'all fourteen factories load on the actual page');

  await jump(page, 'profile'); const identity = page.locator('#tab-profile .ux-identity'); await identity.waitFor();
  const office = identity.locator('[data-identity-section="office"]'); await disclosure(office); await office.locator('[data-office-add]').selectOption('plant');
  await office.locator('[data-office-position="plant"]').selectOption('0'); assert.equal(await office.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant');
  const wardrobe = identity.locator('[data-identity-section="wardrobe"]'); await disclosure(wardrobe); await wardrobe.locator('[data-identity-setting="coat"]').selectOption('wine');
  await wardrobe.locator('[data-identity-setting="hat"]').selectOption('fedora'); assert.match(await wardrobe.locator('svg').innerHTML(), /#713d43/);
  const trophies = identity.locator('[data-identity-section="trophies"]'); await disclosure(trophies); await trophies.locator('[data-trophy="trade:larceny"]').check();
  assert.match(await trophies.locator('.ux-trophy-shelf').innerText(), /Larceny/);
  const fleet = identity.locator('[data-identity-section="fleet"]'); await disclosure(fleet);
  const nickname = fleet.locator('[data-identity-form="nickname:personality-car"]'); await nickname.locator('[name="nickname"]').fill('The Quiet Reader'); await nickname.locator('button').click();
  assert.match(await fleet.innerText(), /The Quiet Reader.*Official record:.*Damage 17%/s);
  await eventuallySaved(alice, values => values.identity?.nicknames?.['personality-car'] === 'The Quiet Reader' && values.identity?.wardrobe?.hat === 'fedora');
  await office.scrollIntoViewIfNeeded(); await page.screenshot({ path: path.join(artifacts, 'personality-office-desktop.png'), fullPage: false });
  await page.evaluate(() => { window.personalityPanel = document.querySelector('#tab-profile > .ux-identity'); window.personalityLoadControl = personalityPanel.querySelector('[data-identity-load]'); window.personalityOrderBefore = [...personalityPanel.parentElement.children].map(element => element.dataset.uxPanel).filter(Boolean); });
  await disclosure(page.locator('#ux-workspace-toolbar .ux-workspace-controls > details'));
  const identityOrder = page.locator('.ux-panel-order-row').filter({ has: page.locator('span', { hasText: /^A place of your own$/ }) });
  const orderControl = await identityOrder.getByRole('button', { name: /^Up:/ }).isEnabled() ? identityOrder.getByRole('button', { name: /^Up:/ }) : identityOrder.getByRole('button', { name: /^Down:/ });
  await orderControl.focus(); await page.keyboard.press('Enter');
  assert.equal(await page.evaluate(() => personalityPanel === document.querySelector('#tab-profile > .ux-identity') && personalityLoadControl === personalityPanel.querySelector('[data-identity-load]')), true, 'keyboard panel ordering preserves original identity nodes and handlers');
  await page.waitForFunction(() => [...personalityPanel.parentElement.children].map(element => element.dataset.uxPanel).filter(key => personalityOrderBefore.includes(key)).indexOf('identity') !== personalityOrderBefore.indexOf('identity'), null, { timeout: 5000 });
  const personalRecordRead = page.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/bloodline' && reply.status() === 200);
  await identity.locator('[data-identity-load]').click(); await personalRecordRead; await identity.locator('[data-identity-load]:not([disabled])').waitFor();

  const originalWarmth = await page.evaluate(() => document.body.style.getPropertyValue('--ux-feel-warmth'));
  await page.locator('[data-feel-open]').focus(); await page.keyboard.press('Enter'); const room = page.locator('dialog.ux-feel-dialog[open]'); await room.waitFor();
  await room.locator('[data-feel-pref="warmth"]').press('End'); assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--ux-feel-warmth')), '0.2');
  await page.keyboard.press('Control+k'); assert.equal(await page.locator('#jumpmodal:not(.hidden)').count(), 0, 'native Room dialog suppresses the actual background palette');
  assert.equal(await room.evaluate(element => element.contains(document.activeElement)), true, 'native Room dialog keeps keyboard focus');
  await room.getByRole('button', { name: 'Cancel preview', exact: true }).click();
  assert.equal(await page.evaluate(() => document.body.style.getPropertyValue('--ux-feel-warmth')), originalWarmth, 'Room cancel restores its actual preview');
  assert.equal(await page.locator('[data-feel-open]').evaluate(element => element === document.activeElement), true, 'Room returns keyboard focus to its toolbar control');
  assert.equal(await page.evaluate(() => document.body.classList.contains('ux-feel-tactile')), false, 'reduced motion suppresses tactile movement');

  await page.locator('[data-tools-open]').focus(); await page.keyboard.press('Enter'); const desk = page.locator('dialog.ux-tools-dialog[open]'); await desk.waitFor();
  await desk.locator('[data-tools-tray]').first().waitFor();
  assert.match(await desk.locator('.ux-tools-inventory').innerText(), /8 ×.*Account/s, 'working desk reads the actual account-owned stack');
  await desk.locator('.ux-tools-inventory li').filter({ hasText: 'scrap' }).first().locator('[data-tools-tray]').click();
  await desk.locator('[data-tools-view="materials"]').click(); const recipes = await api('GET', '/v1/worldgraph/recipes', alice);
  const steelRecipe = recipes.recipes.find(recipe => recipe.inputs.some(input => input.templateId === 'mat:scrap_steel'));
  assert.ok(steelRecipe); await desk.locator(`[data-tools-recipe="${steelRecipe.id}"]`).fill('1'); await desk.locator(`[data-tools-recipe="${steelRecipe.id}"]`).dispatchEvent('change');
  assert.match(await desk.locator('tbody').innerText(), /8/, 'material totals use the actual inventory quantity');
  await desk.locator('[data-tools-view="builds"]').click(); await desk.locator('[data-tools-name]').fill('The Patient Reader'); await desk.locator('[data-tools-save-build]').click();
  assert.match(await desk.locator('.ux-tools-list').innerText(), /The Patient Reader/);
  await desk.locator('[data-tools-view="history"]').click(); assert.match(await desk.locator('.ux-tools-list').innerText(), /Change cosmetic outfit|Save nickname|Save named gear/);
  await desk.locator('[data-tools-close]').click();
  assert.ok(['/v1/worldgraph/inventory', '/v1/worldgraph/recipes', '/v1/ux/investigation-items', '/v1/ux/tactics'].every(url => reads.has(url)), 'working desk fetched all actual inventory and rules projections');
  await eventuallySaved(alice, values => values.tools?.builds?.some(build => build.name === 'The Patient Reader') && values.tools?.tray?.length);

  await jump(page, 'fieldwork'); await page.locator('[data-fieldwork-view="mysteries"]').click(); await page.locator('[data-fieldwork-mystery="property-investigation"]').click();
  const story = page.locator('[data-ux-story="case"]'); await story.locator('.story-cold-open').waitFor();
  assert.equal(await story.locator('[data-story-section^="epilogue:"]').count(), 0, 'active case has no invented ending');
  await disclosure(story.locator('[data-story-section="documents"]'));
  assert.equal(await story.locator('[data-story-transcript]').count(), 2, 'active case exposes exactly its two already revealed documents');
  const document = story.locator('[data-story-transcript]').first(); await disclosure(document); const source = await document.locator('.story-transcript-text').innerText();
  await story.getByLabel('Exact passage to highlight', { exact: true }).fill(source.slice(0, 22)); await story.getByLabel('Your private annotation', { exact: true }).fill('My private cross-reference');
  await story.getByRole('button', { name: 'Save private highlight', exact: true }).click(); await story.locator('.story-private-highlight').first().waitFor({ state: 'attached' });
  await eventuallySaved(alice, values => values.story?.annotations?.some(annotation => annotation.note === 'My private cross-reference'));
  await page.locator('#tab-fieldwork [data-feel-loading]').waitFor({ state: 'hidden' });
  let heldRoute, sawHeld;
  const heldRead = new Promise(resolve => { sawHeld = resolve; });
  await page.route('**/v1/worldgraph/inventory', route => { heldRoute = route; sawHeld(); });
  await page.locator('[data-fieldwork-refresh]').click(); await heldRead;
  await page.locator('#tab-fieldwork [data-feel-loading] .ux-feel-silhouette-cards').waitFor();
  assert.match(await page.locator('#tab-fieldwork [data-feel-loading]').innerText(), /Reading.*records/);
  await page.screenshot({ path: path.join(artifacts, 'personality-loading-desktop.png'), fullPage: false });
  await heldRoute.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'disposable_read_failure', message: 'Disposable record read unavailable.' }) });
  await page.unroute('**/v1/worldgraph/inventory');
  await page.locator('#tab-fieldwork [data-feel-loading]').waitFor({ state: 'hidden' });
  await page.locator('[data-fieldwork-refresh]:not([disabled])').waitFor();
  assert.equal(await page.locator('#tab-fieldwork [data-feel-loading]').count(), 0, 'the real failed GET finishes and clears its skeleton');
  await page.locator('[data-fieldwork-refresh]').click(); await page.locator('[data-fieldwork-refresh]:not([disabled])').waitFor();
  assert.deepEqual(writes, [], 'identity, Room, inventory planning, builds, history and story annotation execute no gameplay write');
  assert.deepEqual(await snapshot(alice), gameBefore, 'integrated presentation leaves actual currency, materials, owned car and gameplay stats unchanged');

  await jump(page, 'crew'); const community = page.locator('#ux-community'); await community.locator('h3').waitFor();
  const threadForm = community.locator('form[data-community-form="thread"]'); await disclosure(threadForm.locator('..'));
  await threadForm.locator('[name="anchor"]').selectOption('question'); await threadForm.locator('[name="title"]').fill('Compare the corrected dates');
  await threadForm.locator('[name="body"]').fill('The witness account agrees with the corrected registry.'); await threadForm.locator('[name="spoiler"]').check();
  const threadSaved = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/community') && reply.request().method() === 'POST' && reply.status() === 200);
  await threadForm.locator('button[type="submit"]').click(); await threadSaved;
  const thread = community.locator('.ux-community-thread').filter({ hasText: 'Compare the corrected dates' }); await thread.waitFor();
  assert.equal(await thread.locator(':scope > .ux-community-spoiler').evaluate(element => element.open), false, 'author-marked clue spoiler is initially curtained');
  const pins = community.getByText('Crew map planning pins', { exact: true }).locator('..'); await disclosure(pins);
  const pinForm = community.locator('form[data-community-form="pin"]'); await disclosure(pinForm.locator('..'));
  await pinForm.locator('[name="title"]').fill('Read together by the canal'); await pinForm.locator('[name="destinationId"]').selectOption('canal'); await pinForm.locator('[name="note"]').fill('A public destination for later.');
  const pinSaved = page.waitForResponse(reply => reply.url().endsWith('/v1/ux/community') && reply.request().method() === 'POST' && reply.status() === 200); await pinForm.locator('button[type="submit"]').click(); await pinSaved;
  const teammateBoard = await api('GET', '/v1/ux/community', mate); assert.ok(teammateBoard.entries.some(entry => entry.kind === 'thread' && entry.data.title === 'Compare the corrected dates'));
  await jump(page, 'map'); await page.locator('#ux-community-pins').waitFor(); assert.match(await page.locator('#ux-community-pins').innerText(), /Read together by the canal/);
  assert.ok(writes.every(url => url === '/v1/ux/community'), 'only explicitly posted Crew writing leaves the private workspace');

  const teammatePage = await open(mate); await jump(teammatePage, 'crew'); const teammateThread = teammatePage.locator('.ux-community-thread').filter({ hasText: 'Compare the corrected dates' }); await teammateThread.waitFor();
  assert.equal(await teammateThread.locator(':scope > .ux-community-spoiler').evaluate(element => element.open), false);
  await teammateThread.locator(':scope > .ux-community-spoiler > summary').click(); assert.match(await teammateThread.innerText(), /witness account agrees/);

  const mobile = await open(alice, true); await jump(mobile, 'profile'); const mobileIdentity = mobile.locator('#tab-profile .ux-identity'); await mobileIdentity.waitFor();
  const mobileOffice = mobileIdentity.locator('[data-identity-section="office"]'); await disclosure(mobileOffice); await mobileOffice.locator('[data-office-position="plant"]').waitFor();
  assert.equal(await mobileOffice.locator('.ux-office-prop').first().getAttribute('data-office-prop'), 'plant', 'fresh device hydrates private office arrangement');
  await disclosure(mobileIdentity.locator('[data-identity-section="wardrobe"]')); assert.equal(await mobileIdentity.locator('[data-identity-setting="hat"]').inputValue(), 'fedora');
  await disclosure(mobileIdentity.locator('[data-identity-section="fleet"]')); assert.match(await mobileIdentity.locator('.ux-identity-gallery').innerText(), /The Quiet Reader/);
  await noOverflow(mobile, 'mobile private office'); await mobile.screenshot({ path: path.join(artifacts, 'personality-office-mobile.png'), fullPage: false });
  await mobile.locator('[data-tools-open]').click(); const mobileDesk = mobile.locator('dialog.ux-tools-dialog[open]'); await mobileDesk.locator('[data-tools-view="builds"]').click(); await mobileDesk.getByText('The Patient Reader', { exact: true }).waitFor();
  const rect = await mobileDesk.boundingBox(); assert.ok(rect.x >= 0 && rect.x + rect.width <= 391); await noOverflow(mobile, 'mobile working desk');
  await mobile.screenshot({ path: path.join(artifacts, 'personality-desk-mobile.png'), fullPage: false }); await mobileDesk.locator('[data-tools-close]').click();
  await jump(mobile, 'fieldwork'); await mobile.locator('[data-fieldwork-view="mysteries"]').click(); await mobile.locator('[data-fieldwork-mystery="property-investigation"]').click();
  const mobileStory = mobile.locator('[data-ux-story="case"]'); await mobileStory.locator('.story-cold-open').waitFor(); await disclosure(mobileStory.locator('[data-story-section="documents"]'));
  assert.match(await mobileStory.innerText(), /My private cross-reference/, 'fresh-device story highlights hydrate beside the revealed passage');
  await mobileStory.getByRole('button', { name: 'Compare two found documents', exact: true }).click(); await noOverflow(mobile, 'mobile story dialog');
  await mobile.getByRole('button', { name: 'Close story reading', exact: true }).click();
  await jump(mobile, 'crew'); await mobile.locator('#ux-community h3').waitFor(); await noOverflow(mobile, 'mobile Crew writing');
  await mobile.screenshot({ path: path.join(artifacts, 'personality-crew-mobile.png'), fullPage: false });

  const stranger = await open(other); await jump(stranger, 'profile'); const strangerIdentity = stranger.locator('#tab-profile .ux-identity'); await strangerIdentity.waitFor();
  assert.ok(!(await strangerIdentity.innerText()).includes('The Quiet Reader')); assert.equal(await strangerIdentity.locator('[data-identity-setting="hat"]').inputValue(), 'none');
  assert.equal((await api('GET', '/v1/ux/workspace', other)).values.identity, undefined); assert.equal((await api('GET', '/v1/ux/workspace', other)).values.story, undefined);
  await stranger.locator('[data-tools-open]').click(); const strangerDesk = stranger.locator('dialog.ux-tools-dialog[open]'); await strangerDesk.locator('[data-tools-view="builds"]').click(); assert.ok(!(await strangerDesk.innerText()).includes('The Patient Reader')); await strangerDesk.locator('[data-tools-close]').click();
  const strangerCrewRead = stranger.waitForResponse(reply => new URL(reply.url()).pathname === '/v1/crew' && reply.request().method() === 'GET');
  await jump(stranger, 'crew'); await strangerCrewRead;
  assert.equal(await stranger.locator('#ux-community .ux-community-thread').count(), 0, 'an unrelated account has no Crew thread projection');
  assert.deepEqual(errors, []); console.log(`Personality integration proof passed: all fourteen factories, real fleet/mastery, private office/outfits, Room keyboard preview/cancel, current inventory/material/build/history tools, active revealed story documents, actual Crew thread/spoiler/pin, fresh-device private sync, unrelated-account privacy and 390px/reduced-motion UI. Screenshots: ${artifacts}`);
} finally { await browser?.close(); await app.close(); }
