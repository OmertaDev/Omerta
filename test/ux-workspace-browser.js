// The real browser service speaks to the real disposable workspace API; only its UI context is a harness.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';
import { buildServer } from './server-fixture.js';

if (process.env.DATABASE_URL) throw new Error('Workspace browser checks require disposable pg-mem.');
const executablePath = process.env.CHROMIUM_PATH || ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find((p) => fs.existsSync(p));
assert.ok(executablePath, 'Set CHROMIUM_PATH to Chromium.');
const app = await buildServer(); let browser; const errors = [];
const guest = async () => { const token = (await app.inject({ method: 'POST', url: '/v1/auth/guest' })).json().token; return { token, account: app.jwt.verify(token).sub }; };
const remote = async (player) => (await app.inject({ method: 'GET', url: '/v1/ux/workspace', headers: { authorization: `Bearer ${player.token}` } })).json();
try {
  const alice = await guest(), bob = await guest(); await app.listen({ port: 0, host: '127.0.0.1' });
  const base = `http://127.0.0.1:${app.server.address().port}`;
  browser = await chromium.launch({ executablePath, headless: true });
  const setup = async (page, player, { offline = false, seeds = null } = {}) => {
    await page.route('**/__ux_workspace_harness', (route) => route.fulfill({ contentType: 'text/html', body: '<button id="interaction">Interact with the workspace</button>' }));
    await page.goto(base + '/__ux_workspace_harness'); await page.addScriptTag({ path: path.resolve('public/ux-workspace.js') });
    page.on('pageerror', (e) => errors.push(e.message));
    await page.evaluate(({ player, offline, seeds }) => {
      window.harnessState = { session: { accountId: player.account } }; window.harnessToken = player.token;
      window.harnessMode = { offline, hold: false }; window.harnessRequests = []; window.heldReads = []; window.hydrates = 0;
      if (seeds) for (const [key, value] of Object.entries(seeds)) localStorage.setItem(key, JSON.stringify(value));
      const request = async (method, url, body) => {
        const account = window.harnessState.session.accountId;
        window.harnessRequests.push({ method, account, body });
        if (window.harnessMode.offline) return { code: 503, body: { error: 'offline' } };
        const response = await fetch(url, { method, headers: { authorization: `Bearer ${window.harnessToken}`, ...(body ? { 'content-type': 'application/json' } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
        const result = { code: response.status, body: await response.json() };
        if (method === 'GET' && window.harnessMode.hold) await new Promise((resolve) => window.heldReads.push(resolve));
        return result;
      };
      window.workspace = window.createOmertaWorkspace({ getState: () => window.harnessState, read: (url) => request('GET', url), write: (url, body) => request('PUT', url, body), notify() {}, onHydrate: () => { window.hydrates++; } });
    }, { player, offline, seeds });
  };
  const contextA = await browser.newContext(), contextB = await browser.newContext();
  const a = await contextA.newPage(), b = await contextB.newPage();
  const legacyNavigation = { favorites: ['streets'], resume: { tab: 'crew', at: Date.now() } }, legacyCosmetics = { theme: 'blue', cover: 'skyline', title: 'earned' };
  await setup(a, alice, { seeds: { [`omerta_ux_navigation:${alice.account}`]: legacyNavigation, [`omerta_progression_v1:${alice.account}`]: legacyCosmetics } });
  await a.evaluate(async () => { await workspace.hydrate(); await workspace.flush(); });
  assert.deepEqual((await remote(alice)).values.navigation, legacyNavigation, 'existing navigation choices migrate to the account service');
  assert.deepEqual((await remote(alice)).values.progression, legacyCosmetics, 'existing cosmetic choices migrate unchanged');
  await setup(b, alice); await b.evaluate(() => workspace.hydrate());
  assert.deepEqual(await b.evaluate(() => workspace.get('navigation')), legacyNavigation, 'a new device loads saved choices');
  assert.deepEqual(await b.evaluate((account) => JSON.parse(localStorage.getItem(`omerta_progression_v1:${account}`)), alice.account), legacyCosmetics, 'hydration updates the legacy module cache');
  await a.evaluate(async () => { workspace.set('layout', { density: 'large' }); await workspace.flush(); });
  await b.evaluate(async () => { workspace.set('layout', { density: 'compact' }); await workspace.flush(); });
  assert.equal(await b.evaluate(() => workspace.status().state), 'conflict', 'a stale device must present a conflict');
  await b.evaluate(() => workspace.resolveConflict(false));
  assert.equal(await b.evaluate(() => workspace.get('layout').density), 'large');

  // Keep only intended local changes; unrelated clean namespaces must hydrate from the newer account record.
  await a.evaluate(async () => {
    workspace.set('navigation', { favorites: ['crew'] });
    localStorage.setItem(`omerta_ux_navigation:${harnessState.session.accountId}`, JSON.stringify({ favorites: ['crew'] }));
    workspace.set('layout', { density: 'comfortable' }); await workspace.flush();
  });
  await b.evaluate(async () => { workspace.set('layout', { density: 'compact' }); await workspace.flush(); });
  assert.equal(await b.evaluate(() => workspace.status().state), 'conflict');
  await b.evaluate(() => workspace.resolveConflict(true));
  assert.deepEqual(await b.evaluate(() => workspace.get('navigation')), { favorites: ['crew'] }, 'keeping a layout edit does not revert clean navigation from another device');
  await b.evaluate(() => workspace.flush());
  assert.equal((await remote(alice)).values.layout.density, 'compact');

  // Offline edits are durable. A reload that discovers a newer record must not silently overwrite it.
  await setup(b, alice); await b.evaluate(() => workspace.hydrate());
  await b.evaluate(async () => { harnessMode.offline = true; workspace.set('layout', { density: 'large' }); await workspace.flush(); });
  assert.equal(await b.evaluate(() => workspace.status().state), 'offline');
  await a.evaluate(async () => { workspace.set('layout', { density: 'comfortable', focus: true }); await workspace.flush(); if (workspace.status().state === 'conflict') { workspace.resolveConflict(true); await workspace.flush(); } });
  const beforeReload = await remote(alice);
  await setup(b, alice);
  assert.equal(await b.evaluate(() => workspace.get('layout').density), 'large', 'unsynced local edits survive a reload');
  await b.evaluate(() => workspace.flush());
  assert.equal(await b.evaluate(() => workspace.status().state), 'conflict', 'rehydration conflict requires a deliberate choice');
  assert.equal((await remote(alice)).revision, beforeReload.revision, 'flush cannot bypass a hydration conflict');
  assert.equal(await b.evaluate(() => harnessRequests.filter((r) => r.method === 'PUT').length), 0);
  await b.evaluate(() => workspace.resolveConflict(false));

  // Choosing the account copy also discards a local-only legacy namespace rather than recapturing it.
  await b.evaluate((account) => localStorage.setItem(`omerta_ux_social_${account}`, JSON.stringify({ feedScope: 'circle' })), alice.account);
  await b.locator('#interaction').click();
  await a.evaluate(async () => { workspace.set('layout', { density: 'compact', focus: false }); await workspace.flush(); });
  await b.evaluate(async () => { workspace.set('layout', { density: 'large' }); await workspace.flush(); });
  assert.equal(await b.evaluate(() => workspace.status().state), 'conflict');
  await b.evaluate(() => workspace.resolveConflict(false));
  await b.locator('#interaction').click();
  assert.equal(await b.evaluate(() => workspace.get('social', null)), null, 'discarded local-only legacy settings cannot resurrect on the next interaction');

  // A delayed reply for one account cannot replace the next account's workspace.
  const contextC = await browser.newContext(), c = await contextC.newPage(); await setup(c, alice);
  await c.evaluate(() => { harnessMode.hold = true; window.delayedHydrate = workspace.hydrate(); });
  await c.waitForFunction(() => heldReads.length === 1);
  await c.evaluate((player) => { harnessState.session.accountId = player.account; harnessToken = player.token; harnessMode.hold = false; workspace.get('layout', {}); }, bob);
  await c.evaluate(() => { heldReads.splice(0).forEach((release) => release()); });
  await c.evaluate(async () => { await delayedHydrate; await workspace.hydrate(); });
  assert.equal(await c.evaluate(() => workspace.status().account), bob.account);
  assert.equal(await c.evaluate(() => workspace.get('navigation', null)), null, 'the next account cannot inherit a delayed previous account reply');
  assert.deepEqual((await remote(bob)).values, {});

  // Automatic startup defaults must not compete with an already saved workspace on a fresh device.
  const savedDefaults = { tactics: { tab: 'port', view: 'sea', plan: [{ id: 'saved-move', wait: 120 }] }, world: { samples: [{ id: 'saved-character', respect: 42, at: '2026-10-24T00:00:00.000Z' }], memories: [] }, navigation: { favorites: ['crew', 'life'] } };
  const existing = await remote(alice);
  const seed = await app.inject({ method: 'PUT', url: '/v1/ux/workspace', headers: { authorization: `Bearer ${alice.token}` }, payload: { revision: existing.revision, changes: savedDefaults } });
  assert.equal(seed.statusCode, 200);
  const contextD = await browser.newContext(), d = await contextD.newPage(); await setup(d, alice);
  await d.evaluate(() => { harnessMode.hold = true; window.delayedHydrate = workspace.hydrate(); });
  await d.waitForFunction(() => heldReads.length === 1);
  await d.evaluate(() => {
    workspace.set('tactics', { tab: 'start', view: 'plan', plan: [] }, { passive: true });
    workspace.set('world', { samples: [{ id: 'initial-character', respect: 0 }], memories: [] }, { passive: true });
    workspace.set('navigation', { favorites: [], resume: { tab: 'start', at: Date.now() } }, { passive: true });
    heldReads.splice(0).forEach((release) => release());
  });
  await d.evaluate(() => delayedHydrate);
  assert.equal(await d.evaluate(() => workspace.status().state), 'saved', 'derived defaults do not create a hydration conflict');
  for (const [namespace, value] of Object.entries(savedDefaults)) assert.deepEqual(await d.evaluate((name) => workspace.get(name), namespace), value, `${namespace} loads the saved account value over passive startup defaults`);
  assert.equal(await d.evaluate(() => harnessRequests.filter((r) => r.method === 'PUT').length), 0);

  // Real edits during the same held GET remain intentional, even if a later render produces defaults.
  const contextE = await browser.newContext(), e = await contextE.newPage(); await setup(e, alice);
  await e.evaluate(() => { harnessMode.hold = true; window.delayedHydrate = workspace.hydrate(); });
  await e.waitForFunction(() => heldReads.length === 1);
  const intentional = { tab: 'streets', view: 'plan', plan: [{ id: 'my-new-move', wait: 60 }] };
  await e.evaluate((draft) => {
    workspace.set('tactics', draft);
    workspace.set('tactics', { tab: 'start', view: 'plan', plan: [] }, { passive: true });
    heldReads.splice(0).forEach((release) => release());
  }, intentional);
  await e.evaluate(() => delayedHydrate);
  assert.equal(await e.evaluate(() => workspace.status().state), 'conflict', 'intentional pre-hydration edits still require a choice');
  assert.deepEqual(await e.evaluate(() => workspace.get('tactics')), intentional, 'a later automatic default cannot overwrite an intentional pending edit');
  assert.equal(await e.evaluate(() => harnessRequests.filter((r) => r.method === 'PUT').length), 0);
  await e.evaluate(() => workspace.resolveConflict(false));
  // Undo touches only private presentation, survives a local reload, and never crosses accounts.
  const contextF = await browser.newContext(), f = await contextF.newPage(); await setup(f, alice);
  await f.evaluate(async () => {
    await workspace.hydrate();
    workspace.set('identity', { room: ['lamp', 'files'] }, { label: 'First office arrangement' });
    workspace.set('identity', { room: ['files', 'lamp'] }, { label: 'Move the case files' });
    workspace.set('feel', { warmth: 30 }, { passive: true });
  });
  assert.equal((await f.evaluate(() => workspace.history('identity'))).length, 2);
  assert.equal((await f.evaluate(() => workspace.history('feel'))).length, 0, 'derived passive observations do not fill the user undo log');
  const lastEdit = (await f.evaluate(() => workspace.history('identity')))[0]; assert.equal(lastEdit.label, 'Move the case files');
  await setup(f, alice, { offline: true });
  assert.equal(await f.evaluate(id => workspace.undo(id), lastEdit.id), true, 'a local reload retains the private edit snapshot');
  assert.deepEqual(await f.evaluate(() => workspace.get('identity').room), ['lamp', 'files']);
  assert.equal(await f.evaluate(() => workspace.undo()), true);
  assert.deepEqual(await f.evaluate(() => workspace.get('identity').room), ['files', 'lamp'], 'restoring a snapshot can itself be undone without losing the later private writing');
  assert.equal(await f.evaluate(() => workspace.undo('missing-edit')), false);
  await f.evaluate(() => { for (let i = 0; i < 30; i++) workspace.set('feel', { warmth: i }, { label: 'Preview choice ' + i }); });
  assert.equal((await f.evaluate(() => workspace.history())).length, 16, 'private undo history stays bounded');
  await f.evaluate(player => { harnessState.session.accountId = player.account; harnessToken = player.token; workspace.get('identity'); }, bob);
  assert.deepEqual(await f.evaluate(() => workspace.history()), [], 'another account cannot undo or inspect the previous account history');
  assert.equal(await f.evaluate(id => workspace.undo(id), lastEdit.id), false);
  assert.deepEqual(errors, []);
  console.log('ux-workspace-browser: PASS (real API cross-device sync, legacy migration, conflict choices, offline reload, passive startup defaults, deliberate early edits, and delayed account response isolation)');
} finally { await browser?.close(); await app.close(); }
