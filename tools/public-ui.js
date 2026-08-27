#!/usr/bin/env node
// High-leverage public/IA browser contract. This is intentionally narrower than tools/mobile.js:
// it catches truth, first-paint, payload, public empty/search states, and intent navigation.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import { buildServer } from '../src/server.js';

function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    '/usr/bin/chromium', '/usr/bin/google-chrome',
  ]) if (fs.existsSync(p)) return p;
  return null;
}

const exe = resolveBrowser();
if (!exe) {
  console.error('✗ PUBLIC UI CONTRACT CANNOT RUN — set CHROMIUM_PATH to a Chromium/Chrome binary.');
  process.exit(1);
}
if (process.env.DATABASE_URL) {
  console.error('✗ PUBLIC UI CONTRACT REFUSES DATABASE_URL — it requires disposable pg-mem.');
  process.exit(1);
}

const app = await buildServer();
await app.listen({ port: 0, host: '127.0.0.1' });
const BASE = `http://127.0.0.1:${app.server.address().port}`;
const browser = await chromium.launch({ executablePath: exe });
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

try {
  const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await desktop.goto(BASE, { waitUntil: 'domcontentloaded' });
  const firstFrame = await desktop.evaluate(() => ({
    ctaOpacity: Number(getComputedStyle(document.querySelector('#btn-guest')).opacity),
    heroOpacity: Number(getComputedStyle(document.querySelector('.hero .tag')).opacity),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    editorial: document.querySelector('.wire-ticker')?.dataset.feedMode === 'editorial',
    announcesLive: !!document.querySelector('.wire-ticker[role="status"], .wire-ticker[aria-live]'),
  }));
  check(firstFrame.ctaOpacity === 1 && firstFrame.heroOpacity === 1,
    `landing comprehension is opacity-gated on first paint — ${JSON.stringify(firstFrame)}`);
  check(firstFrame.over <= 1, `desktop landing scrolls sideways by ${firstFrame.over}px`);
  check(firstFrame.editorial && !firstFrame.announcesLive,
    'the fictional landing feed is not programmatically identified as editorial flavor');
  // A 1728px MacBook Pro report exposed the hero's right edge as black while the animated layer played.
  // Both the first-paint still and the progressively-mounted video must be centered on the VIEWPORT,
  // not sized from the 1080px copy column that happens to own them in the DOM.
  await desktop.setViewportSize({ width: 1728, height: 1117 });
  const wideHero = await desktop.evaluate(() => {
    const hero = document.querySelector('#screen-auth .hero');
    const still = document.querySelector('#screen-auth .hero-art').getBoundingClientRect();
    const probe = document.createElement('div');
    probe.className = 'herovid';
    hero.prepend(probe);
    const motion = probe.getBoundingClientRect();
    probe.remove();
    const shape = (rect) => ({ left: Math.round(rect.left), right: Math.round(rect.right), width: Math.round(rect.width) });
    return { viewport: innerWidth, still: shape(still), motion: shape(motion) };
  });
  check(wideHero.still.left === 0 && wideHero.still.right === wideHero.viewport
    && wideHero.motion.left === 0 && wideHero.motion.right === wideHero.viewport,
  `1728px landing hero media does not cover both viewport edges — ${JSON.stringify(wideHero)}`);
  await desktop.setViewportSize({ width: 1440, height: 900 });
  const gameProof = await desktop.evaluate(() => ({
    approaches: document.querySelectorAll('.operation-proof .operation-approach').length,
    receipt: document.querySelectorAll('.operation-proof .operation-receipt').length,
  }));
  check(gameProof.approaches === 3 && gameProof.receipt === 1,
    `landing does not prove one game decision and its recorded consequence — ${JSON.stringify(gameProof)}`);
  await desktop.waitForLoadState('networkidle');
  const landingLoad = await desktop.evaluate(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    const resources = performance.getEntriesByType('resource').map((r) => ({
      name: new URL(r.name).pathname, bytes: r.transferSize || r.encodedBodySize || 0,
    })).sort((a, b) => b.bytes - a.bytes);
    return { bytes: (nav?.transferSize || nav?.encodedBodySize || 0) + resources.reduce((sum, r) => sum + r.bytes, 0),
      heroFallbackBytes: resources.find((r) => r.name === '/art/hero-poster.jpg')?.bytes || 0,
      resources: resources.slice(0, 6) };
  });
  check(landingLoad.bytes <= 768 * 1024,
    `cold landing transfers ${Math.round(landingLoad.bytes / 1024)} KB; budget is 768 KB — ${JSON.stringify(landingLoad.resources)}`);
  check(landingLoad.heroFallbackBytes === 0,
    `the responsive landing still fetched the 630 KB hero fallback — ${JSON.stringify(landingLoad.resources)}`);

  // THE PATH FINDER — one real seven-decision walk, not a DOM snapshot. This catches a quiz whose
  // progressive controls render but cannot complete, a result whose share image 404s, and dossiers
  // that push their exact modifier cards sideways at ordinary desktop widths.
  await desktop.goto(`${BASE}/path`, { waitUntil: 'networkidle' });
  let pathShape = await desktop.evaluate(() => ({
    form: document.querySelector('#path-quiz')?.tagName,
    options: document.querySelectorAll('.quiz-option').length,
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    question: document.querySelector('.quiz-prompt')?.textContent.trim(),
  }));
  check(pathShape.form === 'FORM' && pathShape.options === 6 && pathShape.question,
    `Path quiz does not open as one semantic six-choice decision — ${JSON.stringify(pathShape)}`);
  check(pathShape.over <= 1, `desktop Path quiz scrolls sideways by ${pathShape.over}px`);
  for (let i = 0; i < 7; i++) await desktop.locator('.quiz-option').first().click();
  await desktop.waitForURL(/\/path\/gun\?secondary=/);
  await desktop.waitForLoadState('networkidle');
  const resultShape = await desktop.evaluate(async () => {
    const image = document.querySelector('meta[property="og:image"]')?.content;
    const localImage = image ? new URL(new URL(image).pathname, location.origin).href : '';
    const natural = await new Promise((resolve) => {
      const probe = new Image(); probe.onload = () => resolve([probe.naturalWidth, probe.naturalHeight]);
      probe.onerror = () => resolve([0, 0]); probe.src = localImage;
    });
    const downloads = [...document.querySelectorAll('.social-download')];
    const socialNatural = await Promise.all(downloads.map((link) => new Promise((resolve) => {
      const probe = new Image(); probe.onload = () => resolve([probe.naturalWidth, probe.naturalHeight]);
      probe.onerror = () => resolve([0, 0]); probe.src = link.href;
    })));
    return {
      path: document.body.dataset.path,
      effects: document.querySelectorAll('.effect-card').length,
      costs: document.querySelectorAll('.effect-card[data-impact="cost"]').length,
      play: document.querySelector('[data-path-cta="play"]')?.getAttribute('href'),
      codex: document.querySelector('[data-path-cta="codex"]')?.getAttribute('href'),
      natural,
      social: downloads.map((link) => ({ href: link.getAttribute('href'), download: link.getAttribute('download') })),
      socialNatural,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check(resultShape.path === 'gun' && resultShape.effects === 3 && resultShape.costs === 1,
    `Gun result does not expose every signed edge and its one cost — ${JSON.stringify(resultShape)}`);
  check(resultShape.play === '/#enter-city' && resultShape.codex === '/wiki#paths',
    `Path result CTAs do not close the guest-play/Codex loop — ${JSON.stringify(resultShape)}`);
  check(resultShape.natural[0] === 1200 && resultShape.natural[1] === 630,
    `Path Open Graph card is missing or not 1200×630 — ${JSON.stringify(resultShape.natural)}`);
  check(resultShape.social.length === 2
    && /path-gun-1080x1350\.png\?v=[a-f0-9]{12}$/.test(resultShape.social[0].href)
    && /path-gun-1080x1920\.png\?v=[a-f0-9]{12}$/.test(resultShape.social[1].href)
    && resultShape.social[0].download === 'omerta-path-gun-portrait.png'
    && resultShape.social[1].download === 'omerta-path-gun-story.png',
  `Path result social-kit links are incomplete — ${JSON.stringify(resultShape.social)}`);
  check(JSON.stringify(resultShape.socialNatural) === JSON.stringify([[1080, 1350], [1080, 1920]]),
    `Path social-kit image dimensions drifted — ${JSON.stringify(resultShape.socialNatural)}`);
  check(resultShape.over <= 1, `desktop Path result scrolls sideways by ${resultShape.over}px`);
  await desktop.close();

  const mobile = await browser.newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  const landingMobile = await mobile.evaluate(() => {
    const px = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    const wire = document.querySelector('#wire-toggle').getBoundingClientRect();
    const video = document.querySelector('.landing .band video');
    const hero = document.querySelector('.hero-art img');
    return {
      inner: innerWidth,
      scroll: document.documentElement.scrollWidth,
      hero: new URL(hero.currentSrc).pathname,
      heroNaturalWidth: hero.naturalWidth,
      wire: { width: wire.width, height: wire.height },
      type: {
        heroSupport: px('.landing .hero .sub2'),
        ctaHint: px('.landing .ctahint'),
        wireLine: px('#wire-line'),
        receiptRow: px('.operation-receipt span'),
        receiptNote: px('.operation-receipt small'),
        pillCopy: px('.landing .pill p'),
        bandCopy: px('.landing .band p'),
      },
      videoDeferred: !video.hasAttribute('poster') && [...video.querySelectorAll('source')].every((source) => !source.hasAttribute('src')),
      tourDeferred: !document.querySelector('#tour-art').style.backgroundImage,
    };
  });
  check(landingMobile.scroll <= 321, `320px landing scrolls sideways — ${JSON.stringify(landingMobile)}`);
  check(/hero-poster-(640|960)\.webp$/.test(landingMobile.hero) && landingMobile.heroNaturalWidth <= 960,
    `phone selected a desktop hero source — ${JSON.stringify(landingMobile)}`);
  check(landingMobile.wire.width >= 44 && landingMobile.wire.height >= 44,
    `city-scenes control is not a 44px touch target — ${JSON.stringify(landingMobile.wire)}`);
  check(landingMobile.type.heroSupport >= 16 && landingMobile.type.pillCopy >= 16 && landingMobile.type.bandCopy >= 16,
    `public reading copy fell below 16px — ${JSON.stringify(landingMobile.type)}`);
  check(landingMobile.type.ctaHint >= 14 && landingMobile.type.wireLine >= 14
    && landingMobile.type.receiptRow >= 14 && landingMobile.type.receiptNote >= 14,
  `dense support copy fell below 14px — ${JSON.stringify(landingMobile.type)}`);
  check(landingMobile.videoDeferred && landingMobile.tourDeferred,
    `below-fold/hidden media was exposed on the cold visit — ${JSON.stringify(landingMobile)}`);
  await mobile.goto(`${BASE}/path`, { waitUntil: 'networkidle' });
  pathShape = await mobile.evaluate(() => {
    const choices = [...document.querySelectorAll('.quiz-option')];
    return {
      options: choices.length,
      minTarget: Math.min(...choices.map((button) => button.getBoundingClientRect().height)),
      promptVisible: !!document.querySelector('.quiz-prompt')?.getClientRects().length,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check(pathShape.options === 6 && pathShape.promptVisible && pathShape.minTarget >= 44,
    `320px Path quiz loses choices, prompt, or touch targets — ${JSON.stringify(pathShape)}`);
  check(pathShape.over <= 1, `320px Path quiz scrolls sideways by ${pathShape.over}px`);
  await mobile.goto(`${BASE}/path/shadow?secondary=wheel`, { waitUntil: 'networkidle' });
  const mobileResult = await mobile.evaluate(() => ({
    title: document.querySelector('#result-title')?.textContent.replace(/\s+/g, ' ').trim(),
    secondary: document.querySelector('[data-secondary]')?.dataset.visible,
    buttons: [...document.querySelectorAll('.path-actions .path-button')].every((button) => button.getBoundingClientRect().height >= 44),
    socialDownloads: [...document.querySelectorAll('.social-download')].map((button) => ({
      width: button.getBoundingClientRect().width, height: button.getBoundingClientRect().height,
    })),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check(/shadow/i.test(mobileResult.title || '') && mobileResult.secondary === 'true' && mobileResult.buttons
    && mobileResult.socialDownloads.length === 2
    && mobileResult.socialDownloads.every((button) => button.width >= 44 && button.height >= 44),
    `320px result loses its identity, secondary read, or touch targets — ${JSON.stringify(mobileResult)}`);
  check(mobileResult.over <= 1, `320px Path result scrolls sideways by ${mobileResult.over}px`);

  await mobile.goto(`${BASE}/wiki`, { waitUntil: 'networkidle' });
  let publicWidth = await mobile.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
  check(publicWidth.inner <= 320 && publicWidth.scroll <= 321,
    `320px Codex expands its layout viewport — ${JSON.stringify(publicWidth)}`);
  const searchVisible = await mobile.locator('#q').isVisible();
  check(searchVisible, 'Codex search is hidden behind Browse sections on mobile');
  if (!searchVisible) await mobile.click('#nav-toggle');
  await mobile.fill('#q', 'death');
  await mobile.waitForTimeout(100);
  const searchShape = await mobile.evaluate(() => ({
    results: document.querySelectorAll('#search-results a').length,
    snippets: [...document.querySelectorAll('#search-results .search-hit__snippet')]
      .filter((x) => x.textContent.trim()).length,
    marks: document.querySelectorAll('#search-results mark').length,
  }));
  check(searchShape.results > 0 && searchShape.snippets === searchShape.results && searchShape.marks > 0,
    `Codex search lacks direct, highlighted result snippets — ${JSON.stringify(searchShape)}`);

  await mobile.goto(`${BASE}/arena`, { waitUntil: 'networkidle' });
  await mobile.waitForFunction(() => !document.querySelector('#board')?.hasAttribute('aria-busy'));
  publicWidth = await mobile.evaluate(() => ({ inner: innerWidth, scroll: document.documentElement.scrollWidth }));
  check(publicWidth.inner <= 320 && publicWidth.scroll <= 321,
    `320px Arena expands its layout viewport — ${JSON.stringify(publicWidth)}`);
  const arenaEmpty = await mobile.evaluate(() => ({
    metrics: document.querySelectorAll('#stats .stat').length,
    artifact: document.querySelectorAll('#stats .arena-empty').length,
  }));
  check(arenaEmpty.metrics === 0 && arenaEmpty.artifact === 1,
    `empty Arena repeats zero metrics instead of teaching the first-entry path — ${JSON.stringify(arenaEmpty)}`);

  await mobile.goto(BASE, { waitUntil: 'networkidle' });
  await mobile.click('#btn-guest');
  await mobile.waitForSelector('#screen-create:not(.hidden)');
  await mobile.fill('#new-name', 'Intent ' + Math.random().toString(36).slice(2, 8));
  await mobile.click('#btn-create');
  await mobile.waitForSelector('#screen-main:not(.hidden)');
  if (await mobile.locator('#welcome:not(.hidden)').count()) await mobile.click('#tour-skip');
  const operationDesk = await mobile.evaluate(() => {
    const desk = document.querySelector('#operation-desk');
    const primary = desk?.querySelector('[data-operation-primary]');
    const rect = desk?.getBoundingClientRect();
    return {
      visible: !!desk && getComputedStyle(desk).display !== 'none',
      region: desk?.getAttribute('role'),
      labelled: !!desk?.getAttribute('aria-labelledby'),
      primary: primary?.textContent.trim(),
      top: rect?.top,
      feed: !!desk?.querySelector('#operation-feed[aria-live="polite"]'),
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    };
  });
  check(operationDesk.visible && operationDesk.region === 'region' && operationDesk.labelled
      && operationDesk.primary && operationDesk.feed,
    `Your Turn is not one labelled, actionable operation surface — ${JSON.stringify(operationDesk)}`);
  check(operationDesk.top < 260 && operationDesk.over <= 1,
    `Your Turn is buried or causes mobile overflow — ${JSON.stringify(operationDesk)}`);
  const actionTerms = await mobile.evaluate(() => {
    const crime = document.querySelector('#tab-streets .card [data-do^="POST /v1/crimes/"]')?.closest('.card');
    const crimeButton = crime?.querySelector('[data-do^="POST /v1/crimes/"]');
    const terms = crimeButton?.getAttribute('aria-describedby');
    const locked = document.querySelector('#tab-streets [data-do^="POST /v1/crimes/"][disabled]');
    return {
      crimeTerms: terms ? document.getElementById(terms)?.textContent.replace(/\s+/g, ' ').trim() : '',
      crimeChoice: crime?.querySelector('.operation-choice-terms')?.textContent.replace(/\s+/g, ' ').trim(),
      lockedReason: locked?.getAttribute('title'),
      gym: document.querySelector('#streets-gym-terms')?.textContent.replace(/\s+/g, ' ').trim(),
      bank: document.querySelector('#streets-bank-terms')?.textContent.replace(/\s+/g, ' ').trim(),
    };
  });
  check(/cost.*nerve/i.test(actionTerms.crimeTerms) && /quiet/i.test(actionTerms.crimeChoice)
      && /standard/i.test(actionTerms.crimeChoice) && /loud/i.test(actionTerms.crimeChoice),
    `crime controls do not expose standardized cost and approach risk — ${JSON.stringify(actionTerms)}`);
  check(/requires level/i.test(actionTerms.lockedReason || ''),
    `locked crime has no visible/programmatic reason — ${JSON.stringify(actionTerms.lockedReason)}`);
  check(/10 energy/i.test(actionTerms.gym || '') && /deposit/i.test(actionTerms.bank || '') && /transit/i.test(actionTerms.bank || ''),
    `gym or bank terms are missing before action — ${JSON.stringify(actionTerms)}`);

  // A server-side in-progress response is the dangerous retry case: the same logical operation MUST
  // reuse its idempotency key. Hold the first response long enough to observe the scoped pending state,
  // then let the recovery control repeat the request against the real disposable server.
  const checkinKeys = [];
  let heldCheckin = true;
  await mobile.route('**/v1/checkin', async (route) => {
    checkinKeys.push(route.request().headers()['idempotency-key']);
    if (heldCheckin) {
      heldCheckin = false;
      await new Promise((resolve) => setTimeout(resolve, 180));
      await route.fulfill({ status: 409, contentType: 'application/json',
        body: JSON.stringify({ error: 'in_progress', message: 'That move is still being recorded.' }) });
    } else await route.continue();
  });
  const checkin = mobile.locator('#sheet [data-do="POST /v1/checkin"]');
  await checkin.click();
  await mobile.waitForTimeout(40);
  const pending = await mobile.evaluate(() => ({
    deskBusy: document.querySelector('#operation-desk')?.getAttribute('aria-busy'),
    bodyBusy: document.body.hasAttribute('aria-busy'),
    label: document.querySelector('#operation-pending')?.textContent.trim(),
    buttonBusy: document.querySelector('#sheet [data-do="POST /v1/checkin"]')?.getAttribute('aria-busy'),
  }));
  check(pending.deskBusy === 'true' && pending.buttonBusy === 'true' && !pending.bodyBusy && /check in/i.test(pending.label),
    `action pending state is not specific and locally scoped — ${JSON.stringify(pending)}`);
  await mobile.waitForSelector('#operation-feed .operation-receipt--error [data-operation-retry]');
  await mobile.click('#operation-feed .operation-receipt--error [data-operation-retry]');
  await mobile.waitForSelector('#operation-feed .operation-receipt--success');
  check(checkinKeys.length === 2 && checkinKeys[0] && checkinKeys[0] === checkinKeys[1],
    `in-progress retry changed its idempotency key — ${JSON.stringify(checkinKeys)}`);
  const receipt = await mobile.evaluate(() => {
    const row = document.querySelector('#operation-feed .operation-receipt--success');
    return { summary: row?.querySelector('.operation-receipt__summary')?.textContent.trim(),
      delta: row?.querySelector('.operation-receipt__delta')?.textContent.trim(),
      count: document.querySelectorAll('#operation-feed .operation-receipt').length };
  });
  check(receipt.count >= 2 && receipt.summary && receipt.delta,
    `completed actions do not leave a durable result + resource receipt — ${JSON.stringify(receipt)}`);

  await mobile.fill('#bank-amt', '999999999');
  await mobile.click('#bank-dep');
  await mobile.waitForSelector('#operation-feed .operation-receipt--error .operation-receipt__recovery');
  const recovery = await mobile.locator('#operation-feed .operation-receipt--error .operation-receipt__recovery').first().textContent();
  check(/lower|cash|earn/i.test(recovery || ''), `cash refusal has no concrete recovery guidance — ${JSON.stringify(recovery)}`);
  for (const [query, expected] of [['heal', 'life'], ['sell car', 'garage'], ['take loan', 'loans']]) {
    await mobile.click('#btn-jump');
    await mobile.fill('#jump-q', query);
    const got = await mobile.locator('#jump-list [data-jump]').first().getAttribute('data-jump').catch(() => null);
    check(got === expected, `quick jump “${query}” should lead with ${expected}, got ${got || 'no result'}`);
    await mobile.press('#jump-q', 'Escape');
  }
  const chatLabel = await mobile.locator('#chatinput').getAttribute('aria-label');
  check(!!chatLabel, 'city chat input has no programmatic accessible name');
  const typeFloor = await mobile.evaluate(() => {
    const px = (selector) => Number.parseFloat(getComputedStyle(document.querySelector(selector)).fontSize);
    return { cardDetail: px('#tab-streets .card .d'), coachHint: px('#coach .ch'), bottomNav: px('#bnav button') };
  });
  check(typeFloor.cardDetail >= 14 && typeFloor.coachHint >= 14 && typeFloor.bottomNav >= 11.5,
    `operational type floor is still too small — ${JSON.stringify(typeFloor)}`);
  await mobile.close();
} finally {
  await browser.close();
  await app.close();
}

if (failures.length) {
  console.error(`\n✗ PUBLIC UI CONTRACT FAILED — ${failures.length} problem(s):\n`);
  failures.forEach((f) => console.error('   • ' + f));
  process.exit(1);
}
console.log('\n✅ public UI contract passed — first paint, payload, Path quiz/results, truth register, Codex search, Arena empty state, intent jump, and chat labeling.');
