#!/usr/bin/env node
// High-leverage public/IA browser contract. This is intentionally narrower than tools/mobile.js:
// it catches truth, first-paint, payload, public empty/search states, and intent navigation.
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { buildServer } from '../src/server.js';

function resolveBrowser() {
  if (process.env.CHROMIUM_PATH) return fs.existsSync(process.env.CHROMIUM_PATH) ? process.env.CHROMIUM_PATH : null;
  const caches = [...new Set([
    process.env.PLAYWRIGHT_BROWSERS_PATH,
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'ms-playwright'),
    process.env.HOME && path.join(process.env.HOME, '.cache', 'ms-playwright'),
  ].filter(Boolean))];
  for (const cache of caches) {
    let versions;
    try { versions = fs.readdirSync(cache).filter((entry) => entry.startsWith('chromium')).sort().reverse(); }
    catch { continue; }
    for (const version of versions) for (const relative of [
      'chrome-win64/chrome.exe', 'chrome-win/chrome.exe',
      'chrome-headless-shell-win64/headless_shell.exe',
      'chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-linux/headless_shell',
      'chrome-headless-shell-linux64/headless_shell',
      'chrome-mac/Chromium.app/Contents/MacOS/Chromium',
      'chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
      'chrome-mac-x64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing',
    ]) {
      const candidate = path.join(cache, version, relative);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  for (const p of [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome',
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
let browser;
try {
  browser = await chromium.launch({ executablePath: exe, timeout: 20000 });
} catch (error) {
  await app.close();
  console.error(`✗ PUBLIC UI CONTRACT CANNOT LAUNCH ${exe}\n${error.message}\nSet CHROMIUM_PATH to a working Chromium/Chrome binary.`);
  process.exit(1);
}
const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };
const startedAt = Date.now();
let stage = 'starting';
const reportStage = (name) => { stage = name; console.log(`  • ${name}`); };
async function newPage(options) {
  const page = await browser.newPage({ locale: 'en-US', ...options });
  page.setDefaultTimeout(15000);
  page.on('pageerror', (error) => check(false, `${new URL(page.url()).pathname}: uncaught browser error: ${error.message}`));
  return page;
}

// Keep these checks behavioral: a labelled overlay can still strand a real keyboard user.
async function checkDialogKeyboard(page, opener, overlay, name) {
  await page.locator(opener).focus();
  await page.keyboard.press('Enter');
  await page.locator(`${overlay}:not(.hidden)`).waitFor();
  await page.waitForFunction((selector) => document.querySelector(selector)?.contains(document.activeElement), overlay);
  const shape = await page.locator(overlay).evaluate((bg) => {
    const panel = bg.querySelector('[role="dialog"], [role="alertdialog"]');
    const label = panel?.getAttribute('aria-label') || panel?.getAttribute('aria-labelledby')?.split(/\s+/)
      .map((id) => document.getElementById(id)?.textContent.trim()).filter(Boolean).join(' ');
    return { modal: panel?.getAttribute('aria-modal'), label, hidden: bg.getAttribute('aria-hidden') };
  });
  check(shape.modal === 'true' && shape.label && shape.hidden !== 'true',
    `${name} has no announced modal name/state — ${JSON.stringify(shape)}`);
  const initial = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160));
  await page.keyboard.press('Shift+Tab');
  check(await page.locator(overlay).evaluate((bg) => bg.contains(document.activeElement)),
    `${name}: Shift+Tab escaped into the background`);
  const reverse = await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160));
  // Opening callbacks must not steal focus after a user has already moved it.
  await page.waitForTimeout(80);
  check(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160)) === reverse,
    `${name}: a delayed callback stole keyboard focus after Shift+Tab`);
  await page.keyboard.press('Tab');
  check(await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 160)) === initial,
    `${name}: reverse/forward focus loop did not return to the initial control`);
  await page.keyboard.press('Escape');
  await page.locator(overlay).waitFor({ state: 'hidden' });
  check(await page.locator(opener).evaluate((element) => element === document.activeElement),
    `${name}: Escape did not restore the opener's keyboard focus`);
}

async function checkPublicKeyboard(page, route) {
  await page.goto(`${BASE}${route}`, { waitUntil: 'networkidle' });
  await page.keyboard.press('Tab');
  const skip = await page.evaluate(() => {
    const focused = document.activeElement;
    const rect = focused?.getBoundingClientRect();
    return { text: focused?.textContent.trim(), href: focused?.getAttribute('href'),
      visible: rect?.top >= 0 && rect?.bottom <= innerHeight && rect?.width > 0 };
  });
  check(skip.href?.startsWith('#') && /skip/i.test(skip.text || '') && skip.visible,
    `${route}: first keyboard stop is not a visible skip link — ${JSON.stringify(skip)}`);
  if (!skip.href?.startsWith('#')) return;
  await page.keyboard.press('Enter');
  check(await page.evaluate((href) => {
    const target = document.getElementById(href.slice(1));
    return !!target && (document.activeElement === target || target.contains(document.activeElement));
  }, skip.href), `${route}: skip link scrolls without moving keyboard focus to its destination`);
  const landmarks = await page.evaluate(() => ({
    main: [...document.querySelectorAll('main, [role="main"]')].filter((element) => element.getClientRects().length).length,
    navigation: !!document.querySelector('nav[aria-label], [role="navigation"][aria-label]'),
    language: document.documentElement.lang,
    title: document.title,
  }));
  check(landmarks.main === 1 && landmarks.navigation && landmarks.language && landmarks.title,
    `${route}: public landmark/language/title contract failed — ${JSON.stringify(landmarks)}`);
}

try {
  reportStage('Desktop landing, payload, and agent discovery');
  const desktop = await newPage({ viewport: { width: 1440, height: 900 } });
  const landingVideoRequests = [];
  desktop.on('request', (request) => {
    if (/\.(?:mp4|webm)$/.test(new URL(request.url()).pathname)) landingVideoRequests.push(request.url());
  });
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
  console.log(`    Cold landing: ${Math.round(landingLoad.bytes / 1024)} KB / 768 KB transfer budget`);
  check(landingLoad.heroFallbackBytes === 0,
    `the responsive landing still fetched the 630 KB hero fallback — ${JSON.stringify(landingLoad.resources)}`);

  // Merely moving a pointer must not silently begin the large atmosphere transfer.
  // Measure before any explicit play and keep that opt-in transfer outside the cold-load budget.
  await desktop.mouse.move(360, 260);
  await desktop.waitForTimeout(250);
  check(await desktop.locator('.hero .herovid').count() === 0 && landingVideoRequests.length === 0,
    `pointer movement started landing video without consent — ${JSON.stringify(landingVideoRequests)}`);
  await desktop.getByRole('button', { name: 'Animate scene', exact: true }).click();
  await desktop.waitForFunction(() => {
    const video = document.querySelector('.hero video.herovid');
    return video && !video.paused && video.readyState >= 2 && video.videoWidth > 0
      && document.querySelector('#hero-motion')?.getAttribute('aria-pressed') === 'true';
  }, null, { timeout: 10000 });
  const playingHero = await desktop.locator('.hero video.herovid').evaluate((video) => ({
    local: new URL(video.currentSrc).origin === location.origin,
    source: new URL(video.currentSrc).pathname,
    width: video.videoWidth,
    height: video.videoHeight,
  }));
  check(playingHero.local && /\.(mp4|webm)$/.test(playingHero.source)
      && playingHero.width > 0 && playingHero.height > 0,
    `Animate scene did not play valid local video — ${JSON.stringify(playingHero)}`);
  await desktop.getByRole('button', { name: 'Pause scene', exact: true }).click();
  await desktop.waitForFunction(() => document.querySelector('.hero video.herovid')?.paused
    && document.querySelector('#hero-motion')?.getAttribute('aria-pressed') === 'false', null, { timeout: 3000 });

  const cityGuideLinks = await desktop.locator('#city-guide a').evaluateAll((links) => links.map((link) => ({
    href: new URL(link.href).pathname + new URL(link.href).hash,
    name: link.textContent.replace(/\s+/g, ' ').trim(),
  })));
  check(cityGuideLinks.length >= 9 && cityGuideLinks.every((link) => link.name && /^\/wiki#[\w-]+$/.test(link.href)),
    `city guide is missing native, named Codex links — ${JSON.stringify(cityGuideLinks)}`);

  await desktop.locator('#agent-players').scrollIntoViewIfNeeded();
  await desktop.waitForFunction(() => document.querySelector('[data-agent-graphic="overview"]')?.naturalWidth > 0);
  const agentProof = await desktop.evaluate(() => ({
    graphics: document.querySelectorAll('[data-agent-graphic]').length,
    overview: new URL(document.querySelector('[data-agent-graphic="overview"]').currentSrc).pathname,
    overviewWidth: document.querySelector('[data-agent-graphic="overview"]').naturalWidth,
    facts: document.querySelectorAll('.agent-showcase__brief dl > div').length,
    actions: [...document.querySelectorAll('.agent-showcase__actions a')].map((link) => link.getAttribute('href')),
    live: document.querySelector('.agent-showcase__status .is-live')?.textContent.trim(),
    gated: document.querySelector('.agent-showcase__status .is-gated')?.textContent.trim(),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check(agentProof.graphics === 3 && /agent-overview-(1080|1600)\.webp$/.test(agentProof.overview)
    && agentProof.overviewWidth >= 1080 && agentProof.facts === 4,
    `landing agent dossier is missing its responsive system proof — ${JSON.stringify(agentProof)}`);
  check(JSON.stringify(agentProof.actions) === JSON.stringify(['/play', '/agents', '/arena'])
    && agentProof.live === 'AGENT API LIVE' && /DORMANT IN PRODUCTION$/.test(agentProof.gated || ''),
    `landing agent dossier loses its setup, guide, Arena, or production-state truth — ${JSON.stringify(agentProof)}`);
  check(agentProof.over <= 1, `desktop agent dossier scrolls sideways by ${agentProof.over}px`);

  // THE PATH FINDER — one real seven-decision walk, not a DOM snapshot. This catches a quiz whose
  // progressive controls render but cannot complete, a result whose share image 404s, and dossiers
  // that push their exact modifier cards sideways at ordinary desktop widths.
  reportStage('Path quiz, result cards, and downloadable proof');
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

  reportStage('320px public layouts and deferred media');
  const mobile = await newPage({ viewport: { width: 320, height: 568 }, isMobile: true, hasTouch: true });
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
      agentDeferred: [...document.querySelectorAll('[data-agent-graphic]')].every((image) => !image.currentSrc),
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
  check(landingMobile.videoDeferred && landingMobile.agentDeferred && landingMobile.tourDeferred,
    `below-fold/hidden media was exposed on the cold visit — ${JSON.stringify(landingMobile)}`);
  const mobileHeroIndex = await mobile.locator('.hero-index').evaluate((nav) => ({
    label: nav.getAttribute('aria-label'),
    links: [...nav.querySelectorAll('a')].map((link) => {
      const target = document.getElementById(link.hash.slice(1));
      const labelledBy = target?.getAttribute('aria-labelledby');
      return { href: link.getAttribute('href'), text: link.textContent.trim(),
        height: link.getBoundingClientRect().height,
        targetName: target?.getAttribute('aria-label') || (labelledBy && document.getElementById(labelledBy)?.textContent.trim()) };
    }),
  }));
  check(mobileHeroIndex.label && mobileHeroIndex.links.length === 4
      && mobileHeroIndex.links.every((link) => link.href?.startsWith('#') && link.text && link.height >= 44 && link.targetName),
    `320px hero index loses native section links, names, or touch targets — ${JSON.stringify(mobileHeroIndex)}`);
  await mobile.locator('#agent-players').scrollIntoViewIfNeeded();
  await mobile.waitForFunction(() => document.querySelector('[data-agent-graphic="overview"]')?.naturalWidth > 0);
  const agentMobile = await mobile.evaluate(() => {
    const overview = document.querySelector('[data-agent-graphic="overview"]');
    const rail = document.querySelector('.agent-showcase__rail');
    return {
      overview: new URL(overview.currentSrc).pathname,
      overviewWidth: overview.naturalWidth,
      railScrolls: rail.scrollWidth > rail.clientWidth,
      pageOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      links: document.querySelectorAll('.agent-showcase__plate').length,
    };
  });
  check(/agent-cover-(480|720)\.webp$/.test(agentMobile.overview) && agentMobile.overviewWidth <= 720,
    `phone did not select the portrait agent cover — ${JSON.stringify(agentMobile)}`);
  check(agentMobile.railScrolls && agentMobile.links === 2 && agentMobile.pageOver <= 1,
    `phone agent evidence rail is clipped or expands the page — ${JSON.stringify(agentMobile)}`);
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
  const guideDestinations = await mobile.evaluate((links) => links.map((link) => {
    const target = document.getElementById(new URL(link.href, location.origin).hash.slice(1));
    return { href: link.href, heading: target?.querySelector('h1, h2, h3')?.textContent.trim() };
  }), cityGuideLinks);
  check(guideDestinations.every((target) => target.heading),
    `city-guide links reach missing or unnamed Codex sections — ${JSON.stringify(guideDestinations)}`);
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

  reportStage('Guest onboarding and operation receipts');
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
  for (const [query, expected] of [
    ['heal', 'life'], ['sell car', 'garage'], ['take loan', 'loans'],
    ['sell a car', 'garage'], ['take a loan', 'loans'],
  ]) {
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

  // A completed action must refresh its own board even when its keyboard trigger remains
  // focused. Background focus protection must not leave stale, apparently executable costs.
  const gymDrawer = mobile.locator('#tab-streets details[data-sect="streets-train"]');
  if (!await gymDrawer.evaluate((drawer) => drawer.open)) await gymDrawer.locator('summary').click();
  const trainMuscle = mobile.locator('#tab-streets [data-do="POST /v1/train/muscle"]');
  await trainMuscle.focus();
  const [trained] = await Promise.all([
    mobile.waitForResponse((response) => response.request().method() === 'POST'
      && new URL(response.url()).pathname === '/v1/train/muscle'),
    mobile.keyboard.press('Enter'),
  ]);
  const trainingResult = await trained.json();
  check(trained.ok() && trainingResult.gain > 0 && trainingResult.nextTrainSeconds > 0,
    `Gym regression fixture did not complete a stat gain with a recovery clock — ${JSON.stringify(trainingResult)}`);
  if (trained.ok() && trainingResult.nextTrainSeconds > 0) {
    await mobile.waitForFunction(() => {
      const button = document.querySelector('#tab-streets [data-do="POST /v1/train/muscle"]');
      const terms = document.querySelector('#streets-gym-terms')?.textContent || '';
      return button?.disabled && /BLOCKED:.*Gym reopens/i.test(terms);
    }, null, { timeout: 6000 });
    const trainedBoard = await mobile.evaluate(() => ({
      receiptLabels: [...document.querySelectorAll('#operation-feed .operation-receipt--success .operation-receipt__head b')]
        .map((label) => label.textContent.trim()),
      focused: document.querySelector('#tab-streets')?.contains(document.activeElement)
        && document.activeElement?.getClientRects().length > 0,
      focusTarget: document.activeElement?.id || document.activeElement?.tagName,
    }));
    check(trainedBoard.receiptLabels.some((label) => /train muscle/i.test(label)) && trainedBoard.focused,
      `Gym result did not leave its receipt and usable focus in the refreshed screen — ${JSON.stringify(trainedBoard)}`);
  }

  reportStage('Keyboard navigation, modal focus, and accessible destinations');
  await checkDialogKeyboard(mobile, '#btn-jump', '#jumpmodal', 'Quick jump');
  await checkDialogKeyboard(mobile, '#btn-logout', '.modal-bg[data-managed-dialog]', 'Sign-out confirmation');
  await mobile.locator('#btn-jump').focus();
  await mobile.keyboard.press('Enter');
  await mobile.locator('#jump-q').fill('heal');
  await mobile.keyboard.press('ArrowDown');
  const pickedResult = await mobile.evaluate(() => document.activeElement?.getAttribute('data-jump'));
  check(pickedResult === 'life', `quick jump ArrowDown did not focus its leading heal result — ${pickedResult}`);
  await mobile.keyboard.press('Enter');
  await mobile.locator('#tab-life').waitFor({ state: 'visible' });
  const destination = await mobile.locator('#tab-life').evaluate((panel) => ({
    selected: document.getElementById(panel.getAttribute('aria-labelledby'))?.getAttribute('aria-selected'),
    focused: panel === document.activeElement || panel.contains(document.activeElement),
    over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
  }));
  check(destination.selected === 'true' && destination.focused && destination.over <= 1,
    `quick jump did not land keyboard users inside the named destination — ${JSON.stringify(destination)}`);

  // Desktop tablists need repeated arrows, not just one successful selection. A generic
  // "focus the destination" handoff previously stole focus after the first arrow press.
  await mobile.setViewportSize({ width: 1280, height: 900 });
  const visibleTabs = await mobile.locator('#tabs [role="tab"]:visible').evaluateAll((tabs) => tabs.map((tab) => tab.id));
  check(visibleTabs.length >= 2, 'keyboard navigation fixture has fewer than two visible tabs');
  if (visibleTabs.length >= 2) {
    await mobile.locator(`#${visibleTabs[0]}`).focus();
    let at = 0;
    for (const key of ['ArrowRight', 'ArrowRight', 'End', 'Home', 'ArrowLeft']) {
      at = key === 'Home' ? 0 : key === 'End' ? visibleTabs.length - 1
        : (at + (key === 'ArrowRight' ? 1 : -1) + visibleTabs.length) % visibleTabs.length;
      await mobile.keyboard.press(key);
      const state = await mobile.evaluate(() => ({
        focused: document.activeElement?.id,
        selected: [...document.querySelectorAll('#tabs [role="tab"][aria-selected="true"]')].map((tab) => tab.id),
        tabbable: [...document.querySelectorAll('#tabs [role="tab"][tabindex="0"]')].map((tab) => tab.id),
        panels: [...document.querySelectorAll('#tabbodies [role="tabpanel"]')]
          .filter((panel) => panel.getClientRects().length).map((panel) => panel.getAttribute('aria-labelledby')),
      }));
      check(state.focused === visibleTabs[at] && JSON.stringify(state.selected) === JSON.stringify([visibleTabs[at]])
          && JSON.stringify(state.tabbable) === JSON.stringify([visibleTabs[at]])
          && JSON.stringify(state.panels) === JSON.stringify([visibleTabs[at]]),
        `${key}: tab focus, selection, roving stop, and displayed panel diverged — ${JSON.stringify(state)}`);
    }
  }
  await mobile.close();

  reportStage('Public keyboard entry and reduced-motion preferences');
  const quiet = await newPage({ viewport: { width: 320, height: 568 }, reducedMotion: 'reduce' });
  for (const route of ['/', '/wiki', '/play', '/arena']) {
    await checkPublicKeyboard(quiet, route);
    const motion = await quiet.evaluate(() => ({
      preference: matchMedia('(prefers-reduced-motion: reduce)').matches,
      running: document.getAnimations().filter((animation) => animation.playState === 'running').length,
      playing: [...document.querySelectorAll('video')].filter((video) => !video.paused).length,
      scroll: getComputedStyle(document.documentElement).scrollBehavior,
      over: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    }));
    check(motion.preference && motion.running === 0 && motion.playing === 0 && motion.scroll !== 'smooth',
      `${route}: reduced-motion visit still animates, plays video, or smooth-scrolls — ${JSON.stringify(motion)}`);
    check(motion.over <= 1, `${route}: 320px public page scrolls sideways by ${motion.over}px`);
  }
  await quiet.close();
} catch (error) {
  check(false, `${stage}: ${error.stack || error.message}`);
  if (process.env.UI_QUALITY_SHOTS) {
    const directory = path.resolve(process.env.UI_QUALITY_SHOTS);
    fs.mkdirSync(directory, { recursive: true });
    for (const [index, page] of browser.contexts().flatMap((context) => context.pages()).entries()) {
      await page.screenshot({ path: path.join(directory, `failure-${index + 1}.png`), fullPage: true }).catch(() => {});
    }
    console.error(`  Failure screenshots: ${directory}`);
  }
} finally {
  await browser.close();
  await app.close();
}

if (failures.length) {
  console.error(`\n✗ PUBLIC UI CONTRACT FAILED — ${failures.length} problem(s):\n`);
  failures.forEach((f) => console.error('   • ' + f));
  process.exit(1);
}
console.log(`\n✅ public UI contract passed in ${Math.round((Date.now() - startedAt) / 1000)}s — first paint, payload, Path quiz/results, truth register, Codex search, Arena empty state, operation receipts, keyboard navigation, modal focus, public landmarks, reduced motion, and chat labeling.`);
