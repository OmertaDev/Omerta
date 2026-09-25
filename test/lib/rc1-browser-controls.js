// Real rendered controls only. Reads identify the server-issued command; every
// measured mutation must be observed from a normal hit-tested browser click.
import assert from 'node:assert/strict';
import { installBoardDiagnostics } from './rc1-board-diagnostics.js';

export async function waitForWorldReceipt(page, label, { timeout = 30000 } = {}) {
  assert.equal(typeof label, 'string'); assert(label.trim(), 'Expected completed command label');
  const exactLabel = new RegExp(`^${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`);
  // The same status class also renders the pending request before refresh.
  // Its "A move needs checking" heading is not the completed action receipt.
  const heading = page.locator('#tab-world .world-notice[role="status"] > b').filter({ hasText: exactLabel });
  await heading.waitFor({ state: 'visible', timeout });
  return heading.innerText({ timeout });
}

export function browserControls({ pageFor, width, result, save }) {
  const traffic = new WeakMap();
  function track(page) {
    if (!traffic.has(page)) {
      const state = { reads: 0, submissions: 0, requests: new WeakMap(), events: [] };
      state.diagnostics = installBoardDiagnostics(page);
      const event = kind => { state.events.push({ kind, at: Date.now(), reads: state.reads, submissions: state.submissions }); if (state.events.length > 40) state.events.shift(); };
      page.on('request', request => {
        const route = new URL(request.url()).pathname;
        if (request.method() === 'GET' && route === '/v1/commands') { state.requests.set(request, ++state.reads); event('board.request'); }
        if (request.method() === 'POST' && route === '/v1/commands/execute') { state.submissions++; event('command.submission'); }
      });
      page.on('response', response => { if (state.requests.has(response.request())) event('board.response'); });
      traffic.set(page, state);
    }
    return traffic.get(page);
  }
  async function reach(page, locator, label) {
    const tip = page.locator('[data-tipok]');
    if (await tip.isVisible()) {
      await tip.evaluate((element) => element.scrollIntoView({ block: 'center', behavior: 'instant' }));
      const box = await tip.boundingBox(); await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await tip.waitFor({ state: 'hidden' });
    }
    let geometry, waitedForToast = false;
    for (let attempt = 0; attempt < 12; attempt++) {
      await locator.waitFor({ state: 'visible' });
      await locator.evaluate((element) => element.scrollIntoView({ block: 'center', inline: 'nearest', behavior: 'instant' }));
      // Social tabs can replace their DOM after a live refresh. Re-resolve the
      // locator before reading it, and bound this stabilization wait.
      await page.waitForTimeout(100);
      geometry = await locator.evaluate((element) => {
      const box = element.getBoundingClientRect(), x = box.x + box.width / 2, y = box.y + box.height / 2;
      const hit = document.elementFromPoint(x, y);
      const toast = hit?.closest('#toast.show');
      return { x: box.x, y: box.y, width: box.width, height: box.height, viewportHeight: innerHeight,
        hit: hit === element || element.contains(hit), hitTag: hit?.tagName, hitId: hit?.id, scrollWidth: document.documentElement.scrollWidth,
        toastObstruction: toast ? (toast.querySelector('.toast-act') ? 'actionable' : 'finite') : null,
        dialogs: [...document.querySelectorAll('.modal-bg[data-managed-dialog]')].filter((node) => node.getBoundingClientRect().height > 0).length };
      });
      if (geometry.width >= 44 && geometry.height >= 44 && geometry.hit) break;
      if (!geometry.hit && geometry.toastObstruction === 'finite' && !waitedForToast) {
        // A simple runtime toast auto-hides after 3400ms. Observe its actual
        // disappearance once; actionable/permanent obstructions still fail.
        waitedForToast = true;
        (result.reachabilityDiagnostics ||= []).push({ event: 'rc1-finite-toast-obstruction', width }); save();
        await page.locator('#toast.show').waitFor({ state: 'hidden', timeout: 5000 });
      }
    }
    result.controls.push({ label, ...geometry }); save();
    assert(geometry.hit, `${label}: another control or overlay covers the hit area: ${geometry.hitTag}#${geometry.hitId}`);
    assert(geometry.x >= -1 && geometry.x + geometry.width <= width + 1, `${label}: control outside phone width`);
    assert(geometry.scrollWidth <= width + 1, `${label}: horizontal page overflow`);
    assert(geometry.width >= 44 && geometry.height >= 44, `${label}: critical touch target ${geometry.width}x${geometry.height}`);
    assert(geometry.dialogs <= 1, `${label}: overlapping managed dialogs`);
    return geometry;
  }
  async function tap(page, locator, label) {
    const box = await reach(page, locator, label);
    // A real touch event still goes through browser hit-testing; no force option,
    // synthetic DOM click, overlay removal or disabled-control bypass is used.
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  }
  async function openTab(account, id) {
    const { page } = await pageFor(account);
    if (await page.locator(`#tab-${id}.on`).isVisible()) { await page.waitForLoadState('networkidle'); return page; }
    if (await page.locator('#tabs-more:not(.hidden)').count()) await page.locator('#tabs-more').click();
    const groups = await page.locator('#grouprail [data-group]').evaluateAll((nodes) => nodes.map((node) => node.dataset.group));
    for (const group of groups) {
      await page.locator(`#grouprail [data-group="${group}"]`).click();
      const tab = page.locator(`[data-tab="${id}"]`);
      if (await tab.isVisible()) { await tab.click(); break; }
    }
    await page.locator(`#tab-${id}.on`).waitFor(); await page.waitForLoadState('networkidle');
    return page;
  }
  async function clickMutation(account, selector, route, payloadCheck = () => {}) {
    const { page } = await pageFor(account), control = page.locator(selector);
    const waiting = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === route);
    waiting.catch(() => {}); await tap(page, control, selector);
    const response = await waiting, body = await response.json();
    assert.equal(response.status(), 200, JSON.stringify(body)); payloadCheck(body);
    await page.waitForLoadState('networkidle');
    result.interactions.push({ account, route, result: body }); save(); return body;
  }
  const engine = {
    async retryIssuedCommand(account, command, error) {
      const observedRefresh = error.observedBrowserRefresh === true && error.body?.error === 'browser_board_refresh';
      if (!observedRefresh && (error.statusCode !== 409 || !['command_stale', 'command_unavailable', 'command_expired'].includes(error.body?.error))) return false;
      result.recoveries.push({ account, type: command.commandType, error: error.body.error, action: 'visible refresh and reissue once' }); save(); return true;
    },
    async snapshot(account, options = {}) {
      const session = await pageFor(account), state = track(session.page), page = await openTab(account, 'world');
      state.diagnostics = installBoardDiagnostics(page); // A test page may have navigated since tracking began.
      await state.diagnostics;
      const update = async (control) => {
        for (let attempt = 0; attempt < 3; attempt++) {
          const waiting = page.waitForResponse((response) => response.request().method() === 'GET' && new URL(response.url()).pathname === '/v1/commands');
          waiting.catch(() => {});
          await reach(page, control, (await control.innerText()).trim());
          await control.click();
          const response = await waiting; assert.equal(response.status(), 200, await response.text());
          session.board = await response.json(); await page.locator('#tab-world .world-summary').waitFor(); await page.waitForLoadState('networkidle');
          session.boardRead = state.requests.get(response.request());
          if (session.boardRead === state.reads) return;
          (result.reachabilityDiagnostics ||= []).push({ event: 'rc1-board-read-superseded', width }); save();
          control = page.locator('#world-refresh');
        }
        assert.fail('Board reads did not settle within three visible refreshes');
      };
      await update(page.locator('#world-refresh'));
      if (options.operationId && session.board.operations.selected?.id !== options.operationId) {
        const index = session.board.operations.instances.findIndex((entry) => entry.id === options.operationId); assert(index >= 0);
        await update(page.locator(`[data-world-instance="${index}"]`));
      }
      if (options.mysteryGraphId && session.board.cases.selected?.graph?.id !== options.mysteryGraphId) {
        const index = session.board.cases.catalog.findIndex((entry) => entry.graphId === options.mysteryGraphId && entry.started);
        if (index >= 0) await update(page.locator(`[data-world-case="${index}"]`));
      }
      return session.board;
    },
    async execute(account, input, key) {
      const session = await pageFor(account), { page, board } = session, state = track(page), submissions = state.submissions;
      const readDiagnostics = await state.diagnostics;
      const diagnostic = async (stage, detail = {}) => {
        const entry = { event: 'rc1-board-lifecycle', stage, at: Date.now(), width, boardRead: session.boardRead,
          reads: state.reads, submissions: state.submissions - submissions, ...detail, dom: await readDiagnostics(), requests: state.events.slice() };
        (result.boardLifecycleDiagnostics ||= []).push(entry); save();
      };
      const refreshedBeforeSubmission = async ({ awaitQueuedRead = false } = {}) => {
        if (awaitQueuedRead && session.boardRead !== undefined && session.boardRead === state.reads) {
          // The production projection coordinator clears controls before the
          // serialized authenticated API queue necessarily starts its GET.
          // Loading alone never authorizes reissue: require that actual GET.
          const loading = await page.locator('#tab-world .world-card[role="status"]')
            .filter({ hasText: 'Refreshing your street' }).isVisible();
          if (loading && session.boardRead === state.reads) {
            assert.equal(state.submissions, submissions, 'A submitted command cannot await refresh for reissue');
            try {
              await page.waitForRequest(request => request.method() === 'GET' && new URL(request.url()).pathname === '/v1/commands', { timeout: 5000 });
            } catch (error) { if (error.name !== 'TimeoutError') throw error; }
          }
        }
        if (session.boardRead === undefined || session.boardRead === state.reads) return false;
        assert.equal(state.submissions, submissions, 'A submitted command cannot be retried as a board refresh');
        await diagnostic('observed-refresh-before-submission');
        assert.equal(state.submissions, submissions, 'A submitted command cannot be retried after refresh diagnostics');
        (result.reachabilityDiagnostics ||= []).push({ event: 'rc1-board-refreshed-before-click', width }); save();
        throw Object.assign(new Error('Observed a newer board request before command submission'), {
          observedBrowserRefresh: true, statusCode: 409, body: { error: 'browser_board_refresh' },
        });
      };
      await refreshedBeforeSubmission();
      assert.equal(key, input.executionId);
      const command = board.commands.find((entry) => entry.executionIdentity?.executionId === key); assert(command);
      const contextual = (type, id) => board.commands.filter((entry) => [entry.subject, entry.target].some((ref) => ref?.type === type && ref.id === id));
      let buttons = page.locator('#tab-world').getByRole('button', { name: command.label, exact: true });
      if (command.parameters?.operationId && board.operations.selected?.id === command.parameters.operationId) {
        const selected = board.operations.selected;
        const context = page.locator('#tab-world article.world-entry').filter({ has: page.getByRole('heading', { level: 3, name: selected.title, exact: true }) });
        buttons = context.locator(':scope > .world-command > button').nth(contextual('operation', selected.id).findIndex((entry) => entry.commandId === command.commandId));
      } else if (command.commandType === 'discovery.act') {
        const id = command.parameters.instanceId, instanceIndex = board.discovery.instances.findIndex((entry) => entry.id === id);
        const context = page.locator('#tab-world section.world-card').filter({ has: page.getByRole('heading', { level: 3, name: 'What have I discovered?', exact: true }) })
          .locator(':scope > article.world-entry').nth(instanceIndex);
        buttons = context.locator(':scope > .world-command > button').nth(contextual('discovery', id).findIndex((entry) => entry.commandId === command.commandId));
      }
      const visible = async () => { for (const button of await buttons.all()) if (await button.isVisible() && await button.isEnabled()) return button; };
      let chosen = await visible();
      if (!chosen) for (const details of await page.locator('#tab-world details').all()) {
        if (await details.getAttribute('open') === null) await details.locator('summary').click();
        chosen = await visible(); if (chosen) break;
      }
      if (!chosen) {
        // A websocket/normal refresh can clear the board after snapshot() has
        // returned. Reissue only when the real loading state is observed; a
        // settled board with a missing control still fails the assertion below.
        const refreshing = await page.locator('#tab-world .world-card[role="status"]')
          .filter({ hasText: 'Refreshing your street' }).isVisible();
        const diagnostic = { event: 'rc1-golden-control-unavailable', width, commandType: command.commandType,
          refreshing, matchingButtons: await buttons.count(), summaryPresent: await page.locator('#tab-world .world-summary').count() > 0 };
        (result.reachabilityDiagnostics ||= []).push(diagnostic); save();
        // Public-safe aggregate only: no account IDs, issued identities, tokens,
        // request bodies or private DOM content enters the retained CI log.
        console.error(JSON.stringify(diagnostic));
        if (refreshing) {
          await refreshedBeforeSubmission({ awaitQueuedRead: true });
        }
      }
      assert(chosen, `No reachable ${command.commandType}: ${command.label}`);
      // A Locator can silently choose a replacement with the same label after a
      // live refresh. Pin this actual node; a detached node cannot submit a new
      // board identity. Any reissue requires an observed read and zero submits.
      const selectedNode = await chosen.elementHandle(); assert(selectedNode);
      await reach(page, chosen, command.label); await refreshedBeforeSubmission();
      const connected = await selectedNode.evaluate(node => node.isConnected);
      if (!connected) await diagnostic('detached-connectivity-read', { connected });
      // The read-generation check above precedes an awaited browser round trip.
      // Recheck after it; a newer GET can begin in precisely that interval.
      await refreshedBeforeSubmission({ awaitQueuedRead: !connected });
      assert(connected, 'Selected command detached without an observed board refresh');
      const waiting = page.waitForResponse((response) => response.request().method() === 'POST' && new URL(response.url()).pathname === '/v1/commands/execute');
      waiting.catch(() => {});
      try { await selectedNode.click(); }
      catch (error) { await refreshedBeforeSubmission({ awaitQueuedRead: true }); throw error; }
      if (command.confirmation.required) {
        const confirm = page.locator('[data-world-choice-confirm]'); await reach(page, confirm, `confirm ${command.label}`); await confirm.click();
      }
      const response = await waiting, body = await response.json();
      assert(response.request().postDataJSON().executionId === key, 'UI must execute the selected issued identity');
      if (response.status() !== 200) throw Object.assign(new Error(JSON.stringify(body)), { statusCode: response.status(), body });
      assert.equal(body.status, 'COMPLETED');
      await page.waitForFunction(() => sessionStorage.getItem('omerta_world_pending') === null);
      const notice = page.locator('#tab-world .world-notice[role="status"]'); await notice.waitFor();
      assert((await notice.innerText()).includes(command.label), 'Visible receipt identifies the completed action');
      await page.waitForLoadState('networkidle');
      result.commands.push({ account, type: command.commandType, label: command.label, parameters: command.parameters,
        receipt: await notice.innerText(), response: body }); save(); return body;
    },
  };
  return { engine, openTab, clickMutation, reach };
}
