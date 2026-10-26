import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { chromium } from 'playwright-core';
import { renderPathResultPage } from '../src/path-pages.js';

const executablePath = process.env.CHROMIUM_PATH || [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
].find(existsSync);
assert(executablePath, 'Set CHROMIUM_PATH to a Chromium executable.');
const source = readFileSync(new URL('../public/ux-navigation.js', import.meta.url));
const style = readFileSync(new URL('../public/ux-navigation.css', import.meta.url));
const feedbackSource = readFileSync(new URL('../public/ux-feedback.js', import.meta.url));
const feedbackStyle = readFileSync(new URL('../public/ux-feedback.css', import.meta.url));
const fixture = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/ux-navigation.css"><style>.hidden{display:none}.act{padding:8px}body{margin:20px;background:#171814;color:#eee}#tabbodies{height:1800px}#bnav{position:fixed;bottom:0;height:56px}</style></head><body>
<main id="landing-main"><div class="hero"><div id="enter-city"></div></div><section id="omr-economy"><div class="omr-state">ON-CHAIN FEATURES INACTIVE IN PRODUCTION</div><div class="omr-pillars">Detailed economy information</div></section></main>
<main id="screen-main"><div id="top"><button id="btn-jump">Find</button></div><div id="vitals"><span class="v-cash">$500</span><span data-stathelp="energy">20 energy</span></div><div id="sheet"><div class="row"><span class="k">respect</span>10</div></div><div id="tabs">${['start', 'streets', 'life', 'garage', 'crew', 'pvp', 'law', 'wire', 'empire', 'portfolio', 'kitchen', 'city', 'port', 'scores', 'pen'].map(id => `<button data-tab="${id}">${id}</button>`).join('')}</div><div id="tabbodies"><section id="tab-streets"></section><section id="tab-start" hidden></section><section id="tab-life" hidden></section><section id="tab-garage" hidden></section></div></main>
<script src="/ux-feedback.js"></script><script src="/ux-navigation.js"></script><script>
window.appState={me:{accountId:'one',id:'character',name:'Test',trainSeconds:1,streetActionSeconds:30,gtaSeconds:80,heistSeconds:120},rules:{},currentTab:'streets'};
window.notices=[];window.actions=0;window.jumpCount=0;window.audioSyncs=0;document.getElementById('btn-jump').onclick=()=>jumpCount++;
window.feedback=createOmertaFeedback({getState:()=>appState,notify:message=>notices.push(message),syncAudio:()=>audioSyncs++});feedback.render();
window.jobMarkup=()=>'<div class="card"><b>Sample job</b><div id="job-terms" class="operation-action-terms">COST 2 nerve · PAY from current rules · RISK jail<div class="operation-choice-terms">QUIET safer · STANDARD baseline · LOUD more heat</div></div><div class="verbrow"><button class="act prime" data-do="POST /v1/crimes/example" aria-describedby="job-terms">do it</button></div></div><label>Quantity <input id="quantity" type="number" value="1"></label><input id="provider-token" value="initial"><details id="expanded"><summary>Read the board</summary>Details</details><button disabled title="Requires level 5. You are level 1.">Locked</button>';
window.fillPanel=()=>{document.getElementById('tab-streets').innerHTML=jobMarkup();document.querySelector('[data-do]').onclick=()=>actions++};fillPanel();
window.initialTabsMarkup=document.getElementById('tabs').innerHTML;
if(new URLSearchParams(location.search).has('delayed-tabs')){localStorage.setItem('omerta_ux_navigation:one',JSON.stringify({favorites:['streets'],resume:null}));document.getElementById('tabs').replaceChildren()}
window.navigateFixture=(id,render)=>{appState.currentTab=id;document.querySelectorAll('#tabbodies>section').forEach(p=>p.hidden=p.id!=='tab-'+id);const root=document.getElementById('tab-'+id);navigation.beforeRender(root);render?.();navigation.afterRender(root)};
window.navigation=createOmertaNavigation({getState:()=>({...appState,me:appState.me?{...appState.me}:null}),navigate:id=>navigateFixture(id),notify:message=>notices.push(message)});
navigation.render();navigation.afterRender();
</script></body></html>`;
let browser;
const server = createServer((req, res) => {
  if (req.url === '/ux-navigation.js') { res.setHeader('content-type', 'application/javascript'); res.end(source); }
  else if (req.url === '/ux-navigation.css') { res.setHeader('content-type', 'text/css'); res.end(style); }
  else if (req.url === '/ux-feedback.js') { res.setHeader('content-type', 'application/javascript'); res.end(feedbackSource); }
  else if (req.url === '/ux-feedback.css') { res.setHeader('content-type', 'text/css'); res.end(feedbackStyle); }
  else { res.setHeader('content-type', 'text/html'); res.end(fixture); }
});
try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  const errors = [], requests = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('request', request => requests.push({ url: request.url(), method: request.method() }));
  await page.goto(base);
  await page.locator('#ux-navigation').waitFor();
  await page.locator('[data-ux-pin]').click();
  assert.equal(await page.locator('.ux-shortcut').count(), 1);
  assert.equal(await page.locator('[data-ux-pin]').getAttribute('aria-pressed'), 'true');
  await page.evaluate(() => { appState.currentTab = 'life'; navigation.afterRender(); });
  await page.locator('[data-ux-pin]').click();
  await page.evaluate(() => { appState.currentTab = 'garage'; navigation.afterRender(); });
  await page.locator('[data-ux-pin]').click();
  await page.evaluate(() => { appState.currentTab = 'start'; navigation.afterRender(); });
  await page.locator('[data-ux-pin]').click();
  assert.equal(await page.locator('.ux-shortcut').count(), 3, 'A fourth favorite is never silently substituted.');
  assert.match((await page.evaluate(() => notices)).at(-1), /Three favorites/);
  assert.equal(await page.locator('.ux-resume').getAttribute('data-ux-go'), 'garage', 'Resume links to the last meaningful activity.');
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('omerta_ux_navigation:one')));
  assert.equal(stored.resume.tab, 'garage');
  await page.keyboard.press('Control+k');
  assert.equal(await page.evaluate(() => jumpCount), 1, 'Keyboard search opens the established accessible palette.');
  await page.locator('[data-feedback-settings]').click();
  assert.equal(await page.locator('dialog[open]').count(), 1);
  await page.keyboard.press('Control+k');
  assert.equal(await page.evaluate(() => jumpCount), 1, 'A native settings dialog keeps keyboard shortcuts inside it.');
  await page.locator('#ux-effects-volume').focus();
  await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#ux-volume-output').innerText(), '69%');
  await page.locator('#ux-haptics').focus();
  await page.keyboard.press('Space');
  await page.locator('#ux-celebration').selectOption('quiet');
  assert.equal(await page.locator('body').getAttribute('data-celebration'), 'quiet');
  assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('omerta_feedback')).haptics), false);
  assert.equal(await page.evaluate(() => audioSyncs >= 3), true, 'Keyboard and selector changes update presentation preferences immediately.');
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('[data-feedback-settings]').evaluate(el => el === document.activeElement), true, 'Escape restores the settings opener.');
  assert.equal(await page.locator('#vitals .ux-resource-icon').count(), 2);
  await page.evaluate(() => {
    window.realNow=Date.now; window.clockNow=realNow(); Date.now=()=>clockNow;
    appState.me={...appState.me,trainSeconds:3}; navigation.observe('/v1/me'); navigation.render();
    clockNow+=2000; navigation.render();
  });
  assert.equal(await page.locator('.ux-clock').filter({ hasText: 'Gym' }).locator('b').innerText(), '0:01', 'Rendering a cloned me projection does not restart an unchanged server clock.');
  await page.evaluate(() => { delete appState.me.streetActionSeconds; navigation.observe('/v1/me'); navigation.render(); });
  assert.equal(await page.locator('.ux-clock').filter({ hasText: 'Street jobs' }).count(), 0, 'A model without a street clock never gets an invented readiness timer.');
  await page.evaluate(() => { Date.now=realNow; appState.me={...appState.me,trainSeconds:1}; navigation.observe('/v1/me'); navigation.render(); });
  await page.waitForFunction(() => notices.some(n => n.startsWith('Gym cooldown ended.')));
  await page.evaluate(() => navigation.render());
  assert.equal((await page.evaluate(() => notices)).filter(n => n.startsWith('Gym cooldown ended.')).length, 1, 'A completed clock signals once.');
  assert.match(await page.locator('#ux-readiness').innerText(), /Clock clear/);
  await page.evaluate(() => document.querySelector('.ux-clock').classList.add('ux-clock--ready'));
  assert.equal(await page.locator('.ux-clock--ready').first().evaluate(el => getComputedStyle(el).animationName), 'none', 'Quiet feedback keeps readiness static.');
  await page.evaluate(() => document.body.dataset.celebration='full');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  assert.equal(await page.locator('.ux-clock--ready').first().evaluate(el => getComputedStyle(el).animationName), 'none', 'Device reduced motion also keeps readiness static.');
  await page.emulateMedia({ reducedMotion: 'no-preference' });

  await page.evaluate(() => { appState.currentTab = 'streets'; document.getElementById('tab-streets').hidden = false; navigation.afterRender(); });
  await page.locator('#quantity').fill('7');
  await page.locator('#provider-token').fill('do not preserve');
  await page.locator('#expanded').evaluate(el => el.open = true);
  await page.locator('#tab-streets [data-ux-rules]').evaluate(el => el.open = true);
  await page.evaluate(() => { window.scrollTo(0, 250); navigation.beforeRender(); fillPanel(); navigation.afterRender(); });
  assert.equal(await page.locator('#quantity').inputValue(), '7', 'An edited quantity survives the same board refresh.');
  assert.equal(await page.locator('#provider-token').inputValue(), 'initial', 'Credential fields are excluded from snapshots.');
  assert.equal(await page.locator('#expanded').getAttribute('open'), '', 'Expanded sections survive refresh.');
  assert.equal(await page.locator('#tab-streets [data-ux-rules]').getAttribute('open'), '', 'Expanded contextual rules survive refresh.');
  assert.equal(await page.evaluate(() => window.scrollY), 250);
  assert.match(await page.locator('[data-ux-blocker]').innerText(), /Requires level 5/);
  assert.equal(await page.locator('#tab-streets [data-ux-rules] summary').count(), 1);

  await page.locator('#expanded').evaluate(el => el.open = false);
  await page.evaluate(() => navigateFixture('life'));
  assert.equal(await page.locator('#expanded').getAttribute('open'), null, 'The retained Streets board is closed while another screen is active.');
  await page.evaluate(() => navigateFixture('streets', () => {
    fillPanel();
    // Match a City training-door destination: the renderer deliberately opens its gym.
    document.getElementById('expanded').open = true;
  }));
  assert.equal(await page.locator('#expanded').getAttribute('open'), '', 'Cross-screen entry keeps the destination renderer’s explicit open preference instead of restoring its retained closed board.');
  assert.equal(await page.locator('#quantity').inputValue(), '1', 'Cross-screen entry uses current destination inputs rather than a stale hidden-panel draft.');

  const beforePractice = requests.length;
  await page.locator('#ux-practice').evaluate(el => el.open = true);
  await page.locator('[data-practice="standard"]').click();
  assert.match(await page.locator('.ux-practice-receipt').innerText(), /None · practice only/);
  assert.equal(await page.evaluate(() => actions), 0);
  assert.equal(requests.length, beforePractice, 'The local practice does not call the server.');
  assert.equal(await page.locator('#omr-economy>.omr-state').isVisible(), true, 'Inactive production status stays outside the disclosure.');
  assert.equal(await page.locator('#omr-economy>.ux-landing-details').getAttribute('open'), null);

  await page.evaluate(() => { sessionStorage.setItem('omerta_path_interest', JSON.stringify({path:'shadow',at:Date.now()})); appState.currentTab='start'; document.getElementById('tab-start').hidden=false; document.getElementById('tab-start').innerHTML=''; navigation.afterRender(); });
  assert.equal(await page.locator('#ux-interest-select').inputValue(), 'shadow');
  assert.match(await page.locator('#ux-interest-tour').innerText(), /never declares or switches a Path/);
  assert.equal(await page.locator('[data-ux-tour-go]').getAttribute('data-ux-tour-go'), 'streets');
  await page.locator('[data-ux-tour-next]').click();
  assert.equal(await page.locator('[data-ux-tour-go]').getAttribute('data-ux-tour-go'), 'law');

  await page.evaluate(() => { appState.currentTab='streets'; navigation.afterRender(); window.originalAction=document.querySelector('[data-do]'); });
  await page.evaluate(() => {
    const competitor = document.createElement('div'); competitor.id = 'mobile-order-competitor'; competitor.className = 'card';
    competitor.innerHTML = '<b>Another job</b><div class="verbrow"><button class="act" data-do="POST /v1/crimes/another">Another job</button></div>';
    document.getElementById('tab-streets').append(competitor);
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator('#ux-action-pocket').waitFor();
  const screenTools = page.locator('#ux-screen-tools'), toolsSummary = screenTools.locator(':scope > summary');
  assert.equal(await screenTools.evaluate(node => node.open), false, 'Mobile screen tools start collapsed so the operation keeps its place.');
  await toolsSummary.click(); await page.locator('[data-ux-pin]').waitFor();
  const toolsBox = await page.locator('.ux-screen-tools-body').evaluate(node => {
    const box = node.getBoundingClientRect();
    return { top: box.top, bottom: box.bottom, height: innerHeight, overflow: getComputedStyle(node).overflowY };
  });
  assert.ok(toolsBox.top >= 0 && toolsBox.bottom < toolsBox.height && toolsBox.overflow === 'auto', 'Expanded tools fit the phone and scroll within their drawer.');
  await page.locator('.ux-screen-tools-close').click();
  assert.equal(await screenTools.evaluate(node => node.open), false);
  assert.equal(await toolsSummary.evaluate(node => node === document.activeElement), true, 'Touch close returns keyboard focus to the disclosure.');
  await toolsSummary.press('Enter'); assert.equal(await screenTools.evaluate(node => node.open), true);
  await page.locator('[data-ux-pin]').focus(); await page.keyboard.press('Escape');
  assert.equal(await screenTools.evaluate(node => node.open), false);
  assert.equal(await toolsSummary.evaluate(node => node === document.activeElement), true, 'Escape closes the mobile drawer and restores its focus.');
  await page.evaluate(() => { window.originalPocket = document.getElementById('ux-action-pocket'); navigation.afterRender(); navigation.afterRender(); });
  assert.equal(await page.evaluate(() => document.getElementById('ux-action-pocket') === originalPocket), true, 'Repeated enhancement passes keep the live region and its controls stable.');
  assert.equal(await page.evaluate(() => document.querySelector('#ux-action-pocket [data-do]') === originalAction), true, 'Mobile keeps the original action node and listener.');
  assert.equal(await page.evaluate(() => document.querySelector('#tab-streets [data-do]') === originalAction), true, 'Floating the first activity preserves its document and keyboard order.');
  assert.equal(await page.evaluate(() => document.querySelectorAll('#tab-streets [data-do]')[1] === document.querySelector('#mobile-order-competitor [data-do]')), true, 'A later job cannot replace the first choice while its real controls move into the pocket.');
  await page.locator('#mobile-order-competitor').evaluate(node => node.remove());
  assert.equal(await page.locator('[data-do]').count(), 1, 'There is one actionable copy.');
  assert.equal(await page.locator('#ux-action-pocket #job-terms').count(), 1, 'Actual cost terms travel with the control.');
  assert.match(await page.locator('#ux-action-pocket [data-do]').evaluate(node => node.closest('.card')?.querySelector('.operation-choice-terms')?.textContent || ''), /QUIET.*STANDARD.*LOUD/, 'The original action retains its card context and approach terms while floating.');
  assert.equal(await page.locator('#ux-action-pocket .ux-action-pocket-title').innerText(), 'Sample job', 'The reachable control identifies its job while the player scrolls.');
  await page.locator('#ux-action-pocket [data-do]').click();
  assert.equal(await page.evaluate(() => actions), 1);
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.waitForFunction(() => !document.querySelector('#ux-action-pocket'));
  assert.equal(await page.evaluate(() => document.querySelector('.card [data-do]') === originalAction), true);

  await page.evaluate(() => { appState.me={...appState.me,accountId:'two'}; navigation.render(); });
  assert.equal(await page.locator('.ux-shortcut').count(), 0, 'Favorites are scoped to the current account.');
  assert.equal(await page.locator('.ux-resume').count(), 0, 'A new account does not inherit another player’s activity.');
  const coldBoot = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await coldBoot.goto(base + '/?delayed-tabs=1');
  await coldBoot.evaluate(() => {
    // Account workspace hydration can run its reload hook before buildTabs.
    navigation.reloadWorkspace();
    document.getElementById('tabs').innerHTML=initialTabsMarkup;
    navigation.afterRender();
  });
  assert.equal(await coldBoot.locator('[data-ux-pin]').getAttribute('aria-pressed'), 'true', 'Hydration before the tab catalog mounts preserves intentional favorites.');
  assert.deepEqual(await coldBoot.evaluate(() => JSON.parse(localStorage.getItem('omerta_ux_navigation:one')).favorites), ['streets']);
  await coldBoot.close();
  const shortcuts = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await shortcuts.goto(base);
  await shortcuts.evaluate(() => { navigateFixture('start'); navigateFixture('life'); });
  await shortcuts.locator('[data-ux-pin]').click();
  assert.deepEqual(await shortcuts.evaluate(() => JSON.parse(localStorage.getItem('omerta_ux_navigation:one')).favorites), ['life'], 'An unchanged shortcut layout still pins the screen currently being read.');
  await shortcuts.close();
  assert.deepEqual(errors, []);
  const resultHtml = renderPathResultPage('shadow');
  assert.match(resultHtml, /link\.dataset\.pathCta==='play'.*sessionStorage\.setItem\('omerta_path_interest'/s,
    'Only the deliberate play CTA carries a quiz interest into the first-session tour.');
  console.log('Navigation UX browser checks passed: favorites, resume, keyboard search, clocks, same-screen continuity, cross-screen destination state, blockers, practice, quiz tour, mobile controls, account isolation.');
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
