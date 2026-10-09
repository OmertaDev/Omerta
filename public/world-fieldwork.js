/* Server-issued inventory, crafting, journals, and Crew fieldwork. */
(function () {
  'use strict';
  const VIEWS = [['inventory', 'Inventory'], ['recipes', 'Crafting'], ['mysteries', 'Journal'], ['operations', 'Crew operations']];
  const READS = { inventory: '/v1/worldgraph/inventory', recipes: '/v1/worldgraph/recipes', mysteries: '/v1/worldgraph/mysteries', operations: '/v1/worldgraph/operations' };
  const ACTION_PATH = /^\/v1\/worldgraph\/(?:items\/[^/?#]+\/assign-current-character|recipes\/[^/?#]+\/(?:craft|salvage\/[^/?#]+)|mysteries\/[^/?#]+\/(?:start|cancel|explore|nodes\/[^/?#]+\/(?:discover|complete)|choices\/[^/?#]+)|operations\/(?:[^/?#]+\/[^/?#]+\/open|[^/?#]+\/(?:roles\/[^/?#]+|contributions\/[^/?#]+|complete|cancel)))$/;
  const list = value => Array.isArray(value) ? value : [];
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
  const words = value => String(value || '').replace(/^[^:]+:/, '').replace(/[_-]+/g, ' ');
  const title = item => {
    const value = item.title || item.name;
    return value ? (String(value).includes(':') ? words(value) : value) : words(item.templateId || item.id || 'Item');
  };
  const count = value => Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '0';
  const textLines = value => typeof value === 'string' ? [value] : Array.isArray(value) ? value.filter(line => typeof line === 'string')
    : value && typeof value === 'object' ? Object.values(value).filter(line => typeof line === 'string') : [];

  function validAction(action) {
    if (!action || action.method !== 'POST' || typeof action.available !== 'boolean' || typeof action.path !== 'string' || !ACTION_PATH.test(action.path)) return false;
    const body = action.body === undefined ? {} : action.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
    return Object.entries(body).every(([key, value]) => ['optionId', 'interactionId', 'instanceId'].includes(key)
      && typeof value === 'string' && value.length > 0 && value.length <= 200 && value.trim() === value);
  }

  function blockerText(blocker) {
    if (typeof blocker === 'string') return words(blocker);
    if (!blocker || typeof blocker !== 'object') return 'An entry requirement is not met.';
    if (blocker.message) return blocker.message;
    const kind = blocker.code || blocker.adapter;
    if (kind === 'location') return 'Visit ' + words(blocker.required || blocker.district) + ' first.';
    if (kind === 'level') return 'Requires level ' + count(blocker.required) + '.';
    if (kind === 'cash') return 'Requires $' + count(blocker.required) + '; $' + count(blocker.current) + ' available.';
    if (kind === 'skill') return 'Requires the ' + words(blocker.required || blocker.skillId) + ' skill.';
    if (kind === 'material_quantity') return 'Needs ' + count(blocker.required) + ' ' + words(blocker.templateId || blocker.requiredTemplateId || 'materials') + '; ' + count(blocker.current) + ' held.';
    if (kind === 'no_crew') return 'Join a Crew to take this operation.';
    if (kind === 'operation_locked') return 'Finish the required investigation to unlock this operation.';
    if (kind === 'explicit_interaction') return 'Use the issued interaction for this step.';
    if (kind === 'graph_dependency' || kind === 'graph_dependency_any' || kind === 'evidence') return 'Complete the preceding evidence or step first.';
    if (kind === 'excluded' || kind === 'excluded_by') return 'This branch is closed by an earlier choice.';
    if (kind === 'owns_car' || kind === 'car') return 'An eligible vehicle is required.';
    return words(kind || 'Entry requirement not met') + (blocker.required ? ': ' + words(blocker.required) : '') + '.';
  }

  function mount(host, initialOptions) {
    let options = { ...initialOptions }, destroyed = false, busy = false, loading = false, revision = 0, sessionUnavailable = false, recoveryRequired = false;
    let view = 'inventory', selectedMystery = '', selectedOperation = '', mysteryDetail = null, operationDetail = null, roleDetail = null;
    let notice = '', noticeBad = false, retry = null, cancelConfirmation = null;
    let characterId = options.character && options.character.id;
    const boards = {}, actions = new Map();
    const panes = Object.fromEntries(VIEWS.map(([key]) => [key, { loading: false, error: '' }]));
    let actionSequence = 0;
    const root = document.createElement('section');
    root.className = 'world-fieldwork';
    root.setAttribute('aria-label', 'Inventory and fieldwork');
    host.replaceChildren(root);
    const active = () => !destroyed && host.isConnected && (!options.isActive || options.isActive());
    const blockers = value => list(value).length ? '<ul class="fieldwork-blockers">' + [...new Set(list(value).map(blockerText))].map(text => '<li>' + escape(text) + '</li>').join('') + '</ul>' : '';
    const stamp = value => '<span class="fieldwork-stamp">' + escape(words(value || 'available')) + '</span>';
    const empty = text => '<div class="fieldwork-empty">' + escape(text) + '</div>';

    function actionButtons(entity, context, parentBlockersShown = false) {
      const shown = parentBlockersShown ? new Set(list(entity.blockedBy).map(blockerText)) : new Set();
      return list(entity && (entity.uiActions || entity.actions)).map(action => {
        if (!validAction(action)) return '';
        const key = String(++actionSequence);
        actions.set(key, { action, context });
        return '<div class="fieldwork-action"><button type="button" data-fieldwork-action="' + key + '"'
          + (busy || loading || panes[view].error || sessionUnavailable || action.available === false ? ' disabled' : '') + '>' + escape(action.label || 'Continue') + '</button>'
          + (action.consequence ? '<p class="fieldwork-consequence">' + escape(action.consequence) + '</p>' : '')
          + (action.available === false ? blockers(list(action.blockedBy).filter(blocker => !shown.has(blockerText(blocker)))) : '') + '</div>';
      }).join('');
    }

    function inventoryView() {
      const board = boards.inventory || {};
      const stackCards = list(board.stacks).map(item => '<article class="fieldwork-item"><span class="fieldwork-item__mark" aria-hidden="true">◇</span><div><h3>' + escape(title(item)) + '</h3><p>' + count(item.qty ?? item.quantity) + ' held · ' + escape(words(item.quality || 'standard')) + '</p></div></article>').join('');
      const itemCards = list(board.items).map(item => '<article class="fieldwork-item"><span class="fieldwork-item__mark" aria-hidden="true">◆</span><div><h3>' + escape(title(item)) + '</h3><p>' + escape(words(item.state || 'active')) + (item.escrowed ? ' · committed to work' : '') + '</p>' + actionButtons(item, title(item)) + '</div></article>').join('');
      const assigned = list(board.currentCharacterItems || board.characterItems);
      const carriedStacks = list(board.currentCharacterStacks);
      return '<div class="fieldwork-intro"><h2>Your inventory</h2><p>Materials stay with the account. Assigned tools belong to the life carrying them. Work and custody follow the server record.</p></div>'
        + '<div class="fieldwork-grid">' + (stackCards + itemCards || empty('No materials or items are held yet. Visit Crafting for available sources.')) + '</div>'
        + (assigned.length || carriedStacks.length ? '<h2 class="fieldwork-section-title">Carried by this character</h2><div class="fieldwork-grid">'
          + carriedStacks.map(item => '<article class="fieldwork-item"><span class="fieldwork-item__mark" aria-hidden="true">◇</span><div><h3>' + escape(title(item)) + '</h3><p>' + count(item.qty ?? item.quantity) + ' held</p></div></article>').join('')
          + assigned.map(item => '<article class="fieldwork-item"><span class="fieldwork-item__mark" aria-hidden="true">◆</span><div><h3>' + escape(title(item)) + '</h3><p>' + escape(words(item.state || 'active')) + '</p>' + actionButtons(item, title(item)) + '</div></article>').join('') + '</div>' : '')
        + actionButtons(board, 'Inventory');
    }

    function ingredients(items, caption) {
      if (!list(items).length) return '';
      return '<div class="fieldwork-materials"><span>' + escape(caption) + '</span>' + list(items).map(item => '<b>' + count(item.quantity ?? item.qty) + '× ' + escape(item.title || words(item.templateId || item.assetType || 'item')) + '</b>').join('') + '</div>';
    }

    function recipesView() {
      const recipes = list(boards.recipes && boards.recipes.recipes);
      return '<div class="fieldwork-intro"><h2>The workbench</h2><p>Inspect the materials and costs before committing. Eligible sources and actions are issued by the server.</p></div><div class="fieldwork-grid">'
        + (recipes.map(recipe => '<article class="fieldwork-card" data-fieldwork-recipe="' + escape(recipe.id) + '"><header><h3>' + escape(title(recipe)) + '</h3>' + stamp(recipe.available ? 'ready' : 'requirements') + '</header>'
          + (recipe.description ? '<p>' + escape(recipe.description) + '</p>' : '') + ingredients(recipe.inputs, 'Consumes') + ingredients(recipe.outputs, 'Creates')
          + (recipe.cashCost ? '<p class="fieldwork-cost">Cost: $' + count(recipe.cashCost) + '</p>' : '') + blockers(recipe.blockedBy)
          + actionButtons(recipe, title(recipe), true) + '</article>').join('') || empty('No recipes are currently issued.')) + '</div>';
    }

    function dialogue(node) {
      const lines = typeof node.dialogue === 'string' ? [{ text: node.dialogue }] : list(node.dialogue);
      return lines.map(line => {
        if (typeof line === 'string') line = { text: line };
        if (!line || typeof line.text !== 'string') return '';
        return '<blockquote class="fieldwork-dialogue">' + (line.speaker ? '<cite>' + escape(line.speaker) + '</cite>' : '') + '<p>' + escape(line.text) + '</p></blockquote>';
      }).join('') + (node.description ? '<p>' + escape(node.description) + '</p>' : '') + (node.prompt ? '<p class="fieldwork-prompt">' + escape(node.prompt) + '</p>' : '');
    }

    function progress(board) {
      const nodes = list(board && board.nodes);
      const completed = Number(board && board.progress && board.progress.completed) || nodes.filter(node => node.status === 'completed').length;
      const total = Number(board && board.progress && board.progress.total) || nodes.length;
      return total ? '<div class="fieldwork-progress"><span>' + completed + ' / ' + total + (board.progress ? ' steps' : ' visible steps') + ' complete</span><progress value="' + completed + '" max="' + total + '">' + completed + '/' + total + '</progress></div>' : '';
    }

    function nodeCard(node, showActions = true) {
      return '<article class="fieldwork-node' + (node.status === 'completed' ? ' fieldwork-node--complete' : '') + '" data-fieldwork-node="' + escape(node.id) + '"><header><h3>' + escape(title(node)) + '</h3>' + stamp(node.status) + '</header>'
        + dialogue(node) + (node.privateEvidence ? textLines(node.privateEvidence).map(line => '<blockquote class="fieldwork-clue">' + escape(line) + '</blockquote>').join('') : '')
        + (node.type === 'choice' ? '<div class="fieldwork-choices">' + list(node.options).map(option => '<div><b>' + escape(option.title || words(option.id)) + '</b>'
          + (option.description ? '<p>' + escape(option.description) + '</p>' : '') + (option.consequence ? '<small>' + escape(option.consequence) + '</small>' : '') + '</div>').join('') + '</div>' : '')
        + blockers(node.blockedBy) + (showActions ? actionButtons(node, title(node), true) : '') + '</article>';
    }

    function mysteriesView() {
      const board = boards.mysteries || {}, cases = list(board.mysteries);
      const index = cases.map(item => '<article class="fieldwork-card" data-fieldwork-case="' + escape(item.graphId) + '"><header><h3>' + escape(item.title || words(item.graphId)) + '</h3>' + stamp(item.status) + '</header>'
        + dialogue(item) + (item.instanceId ? '<button type="button" data-fieldwork-mystery="' + escape(item.graphId) + '">Read this journal</button>' : '')
        + actionButtons(item, item.title || 'Investigation') + '</article>').join('');
      const detail = mysteryDetail ? '<section class="fieldwork-case"><div class="fieldwork-case__heading"><h2>' + escape(cases.find(item => item.graphId === selectedMystery)?.title || 'Investigation') + '</h2>' + stamp(mysteryDetail.status) + '</div>'
        + dialogue(mysteryDetail) + progress(mysteryDetail) + list(mysteryDetail.nodes).map(node => nodeCard(node)).join('') + actionButtons(mysteryDetail, 'Investigation') + '</section>' : '';
      const historical = list(board.historicalInstances).map(instance => '<article class="fieldwork-card"><header><h3>' + escape(instance.title || words(instance.graphId)) + '</h3>' + stamp(instance.status) + '</header><p>Recorded work from a previous character. Custody and escrow stay attached to that history.</p>' + actionButtons(instance, 'Historical investigation') + '</article>').join('');
      return '<div class="fieldwork-intro"><h2>Your journal</h2><p>Follow the people, places and evidence you have discovered. Choices and progress persist in the case record.</p></div><div class="fieldwork-grid">' + (index || empty('No investigations are issued yet.')) + '</div>'
        + detail + (historical ? '<h2 class="fieldwork-section-title">Unfinished records</h2><div class="fieldwork-grid">' + historical + '</div>' : '');
    }

    function operationsView() {
      const board = boards.operations || {}, operations = list(board.operations);
      const index = operations.map(item => '<article class="fieldwork-card"><header><h3>' + escape(item.title || words(item.operationNodeId)) + '</h3>' + stamp(item.status || (item.available ? 'ready' : 'requirements')) + '</header>'
        + '<p>' + count(item.minimumDistinctAccounts) + ' distinct Crew members required.</p>' + blockers(item.blockedBy)
        + (item.operationId ? '<button type="button" data-fieldwork-operation="' + escape(item.operationId) + '">Open operation board</button>' : '')
        + actionButtons(item, item.title || 'Crew operation', true) + '</article>').join('');
      const detail = operationDetail ? '<section class="fieldwork-case"><div class="fieldwork-case__heading"><h2>Crew operation</h2>' + stamp(operationDetail.status) + '</div>'
        + '<p>' + count(operationDetail.filledRoleCount) + ' / ' + count(operationDetail.requiredRoleCount) + ' roles filled</p>'
        + '<div class="fieldwork-grid">' + list(operationDetail.roles).map(role => '<article class="fieldwork-card" data-fieldwork-role="' + escape(role.roleId) + '"><header><h3>' + escape(role.title || words(role.roleId)) + '</h3>' + stamp(role.filled ? 'filled' : 'open') + '</header><p>' + count(role.contributions) + ' contributions</p>' + actionButtons(role, role.title || 'Crew role') + '</article>').join('') + '</div>'
        + progress(operationDetail) + list(operationDetail.nodes).map(node => nodeCard(node, false)).join('')
        + (roleDetail ? '<div class="fieldwork-role"><h2>Your role</h2><p>Only your assigned role receives these clues and contribution actions.</p>' + list(roleDetail.nodes).filter(node => list(node.actions).length || node.privateEvidence).map(node => nodeCard(node)).join('') + '</div>' : '')
        + actionButtons(operationDetail, 'Crew operation') + '</section>' : '';
      const currentIds = new Set(operations.map(item => item.operationId).filter(Boolean));
      const recovery = list(board.recoverableOperations).filter(item => !currentIds.has(item.operationId))
        .map(item => '<article class="fieldwork-card"><header><h3>' + escape(item.title || 'Recorded Crew operation') + '</h3>' + stamp(item.status) + '</header><p>Work you opened with an earlier Crew. Closing it returns held items to their recorded depositors.</p>' + actionButtons(item, 'Recorded Crew operation') + '</article>').join('');
      return '<div class="fieldwork-intro"><h2>The shared job</h2><p>Take an issued role, follow its clues and contribute your part. Private evidence stays with the assigned player.</p></div><div class="fieldwork-grid">' + (index || empty('No shared operations are currently issued.')) + '</div>' + detail
        + (recovery ? '<h2 class="fieldwork-section-title">Recover earlier work</h2><div class="fieldwork-grid">' + recovery + '</div>' : '');
    }

    function draw() {
      if (destroyed) return;
      actions.clear(); actionSequence = 0;
      const pane = panes[view], label = VIEWS.find(([key]) => key === view)[1];
      const content = view === 'recipes' ? recipesView() : view === 'mysteries' ? mysteriesView() : view === 'operations' ? operationsView() : inventoryView();
      const paneNotice = pane.error ? '<div class="fieldwork-pane-error" role="alert"><b>' + escape(label) + ' could not load.</b><p>' + escape(pane.error) + '</p>'
        + (boards[view] ? '<p>Your last loaded record is shown. Retry to use current actions.</p>' : '')
        + '<button type="button" data-fieldwork-pane-retry="' + view + '"' + (loading || busy ? ' disabled' : '') + '>Retry ' + escape(label) + '</button></div>' : '';
      root.innerHTML = '<header class="fieldwork-mast"><div><span>Inventory &amp; fieldwork</span><h1>The field office</h1><p>Your materials, investigations and shared work in one place.</p></div><button type="button" data-fieldwork-city' + (busy ? ' disabled' : '') + '>Return to the neighborhood</button></header>'
        + '<div class="fieldwork-toolbar"><nav aria-label="Fieldwork sections">' + VIEWS.map(([id, label]) => '<button type="button" data-fieldwork-view="' + id + '" aria-pressed="' + String(view === id) + '"' + (busy ? ' disabled' : '') + '>' + label + '</button>').join('') + '</nav><button type="button" data-fieldwork-refresh' + (loading || busy || sessionUnavailable ? ' disabled' : '') + '>' + (loading ? 'Updating…' : 'Refresh') + '</button></div>'
        + (notice ? '<div class="fieldwork-notice' + (noticeBad ? ' fieldwork-notice--error' : '') + '" role="' + (noticeBad ? 'alert' : 'status') + '">' + escape(notice)
          + (retry ? '<button type="button" data-fieldwork-retry' + (busy || loading ? ' disabled' : '') + '>Retry this same action</button><button type="button" data-fieldwork-dismiss>Dismiss</button>' : '') + '</div>' : '')
        + '<div class="fieldwork-body" aria-busy="' + String(busy || pane.loading) + '">'
        + (sessionUnavailable ? '<div class="fieldwork-empty" role="status">Restore your session to read your records.</div>' : paneNotice
          + (boards[view] ? content : pane.loading ? '<div class="fieldwork-empty" role="status">Opening ' + escape(label) + '…</div>' : '')) + '</div>';
      root.querySelectorAll('[data-fieldwork-view]').forEach(button => { button.onclick = () => { view = button.dataset.fieldworkView; draw(); }; });
      root.querySelector('[data-fieldwork-city]').onclick = () => { if (options.onNavigate) options.onNavigate('map'); };
      root.querySelector('[data-fieldwork-refresh]').onclick = () => { recoveryRequired = false; load(); };
      root.querySelector('[data-fieldwork-pane-retry]')?.addEventListener('click', async event => {
        const button = event.currentTarget, key = view, identity = characterId;
        recoveryRequired = false; await load([key]);
        if (active() && key === view && identity === characterId && document.activeElement === document.body) {
          (root.querySelector('[data-fieldwork-pane-retry]') || root.querySelector('[data-fieldwork-view="' + key + '"]'))?.focus({ preventScroll: true });
        }
      });
      root.querySelector('[data-fieldwork-retry]')?.addEventListener('click', () => run(retry.entry, retry.key, true));
      root.querySelector('[data-fieldwork-dismiss]')?.addEventListener('click', () => { retry = null; notice = ''; draw(); });
      root.querySelectorAll('[data-fieldwork-action]').forEach(button => { button.onclick = () => { const entry = actions.get(button.dataset.fieldworkAction); if (entry) run(entry); }; });
      root.querySelectorAll('[data-fieldwork-mystery]').forEach(button => { button.onclick = () => { selectedMystery = button.dataset.fieldworkMystery; mysteryDetail = null; load(['mysteries']); }; });
      root.querySelectorAll('[data-fieldwork-operation]').forEach(button => { button.onclick = () => { selectedOperation = button.dataset.fieldworkOperation; operationDetail = roleDetail = null; load(['operations']); }; });
    }

    function readError(response) {
      const error = new Error(response?.body?.message || 'The record could not be read. Retry to try again.');
      error.status = response?.code; error.code = response?.body?.error;
      return error;
    }
    const sessionError = error => error.status === 401 || ['no_character', 'token_revoked'].includes(error.code);

    async function read(path, token) {
      const response = await options.api('GET', path);
      if (destroyed || token !== revision) return null;
      if (!response || response.code >= 400) throw readError(response);
      if (!response.body || typeof response.body !== 'object' || Array.isArray(response.body)) throw new Error('The record is incomplete. Retry to read it again.');
      return response.body;
    }

    async function restoreSession(error) {
      sessionUnavailable = true; revision++; loading = false;
      for (const key of Object.keys(boards)) delete boards[key];
      for (const pane of Object.values(panes)) { pane.loading = false; pane.error = ''; }
      selectedMystery = selectedOperation = ''; mysteryDetail = operationDetail = roleDetail = null;
      retry = null; cancelConfirmation?.(); notice = error.message; noticeBad = true; draw();
      const token = revision;
      // The existing session refresh owns logout and character-recovery screens.
      try {
        const refreshed = options.refresh ? await options.refresh() : null;
        if (!active() || token !== revision) return;
        const who = refreshed?.body?.player?.character || refreshed?.body?.player || refreshed?.body?.character || refreshed?.body;
        if (refreshed?.code < 400 && typeof who?.id === 'string') {
          const changed = who.id !== characterId;
          options.character = who; characterId = who.id; sessionUnavailable = false; recoveryRequired = !changed;
          notice = changed ? '' : 'Your session is available. Reload your records to continue.'; noticeBad = false;
          if (changed) await load();
          else {
            for (const pane of Object.values(panes)) pane.error = 'Retry this record after the session check.';
            draw();
          }
        }
      } catch { /* records remain hidden until the session is restored */ }
    }

    async function load(requested = Object.keys(READS)) {
      if (!active() || sessionUnavailable) return;
      const token = ++revision;
      const keys = [...new Set(requested)].filter(key => Object.hasOwn(READS, key));
      for (const pane of Object.values(panes)) pane.loading = false;
      for (const key of keys) { panes[key].loading = true; panes[key].error = ''; }
      loading = true; draw();
      try {
        for (const key of keys) {
          try {
            const board = await read(READS[key], token);
            if (!board) return;
            const fields = key === 'inventory' ? ['stacks', 'items'] : [key];
            if (fields.some(field => !Array.isArray(board[field]))) throw new Error('The record is incomplete. Retry to read it again.');
            boards[key] = board;
            if (key === 'mysteries') {
              if (!selectedMystery) selectedMystery = board.mysteries.find(item => item.instanceId)?.graphId || '';
              if (selectedMystery && board.mysteries.some(item => item.graphId === selectedMystery && item.instanceId)) {
                const detail = await read('/v1/worldgraph/mysteries/' + encodeURIComponent(selectedMystery), token);
                if (!detail) return;
                if (!Array.isArray(detail.nodes)) throw new Error('The journal is incomplete. Retry to read it again.');
                mysteryDetail = detail;
              } else mysteryDetail = null;
            }
            if (key === 'operations') {
              if (!selectedOperation) selectedOperation = board.operations.find(item => item.operationId)?.operationId || '';
              if (selectedOperation && board.operations.some(item => item.operationId === selectedOperation)) {
                const detail = await read('/v1/worldgraph/operations/' + encodeURIComponent(selectedOperation), token);
                if (!detail) return;
                if (!Array.isArray(detail.nodes) || !Array.isArray(detail.roles)) throw new Error('The operation is incomplete. Retry to read it again.');
                operationDetail = detail;
                const role = await options.api('GET', '/v1/worldgraph/operations/' + encodeURIComponent(selectedOperation) + '/role');
                if (destroyed || token !== revision) return;
                if (sessionError(readError(role))) throw readError(role);
                if (!role || (role.code >= 400 && !([400, 403].includes(role.code) && role.body?.error === 'operation_unavailable'))) throw readError(role);
                if (role.code < 400 && !Array.isArray(role.body?.nodes)) throw new Error('The role record is incomplete. Retry to read it again.');
                roleDetail = role.code < 400 ? role.body : null;
              } else operationDetail = roleDetail = null;
            }
            panes[key].error = '';
          } catch (error) {
            if (token !== revision || destroyed) return;
            if (sessionError(error)) { await restoreSession(error); return; }
            panes[key].error = error.message || 'The record could not be read.';
          } finally {
            if (token === revision && !destroyed) { panes[key].loading = false; draw(); }
          }
        }
      } finally {
        if (token === revision && !destroyed) { loading = false; draw(); }
      }
    }

    function consequence(action, context) {
      if (action.consequence) return action.consequence;
      if (action.path.includes('/salvage/')) return 'This consumes the selected vehicle. The server determines the materials recovered.';
      if (action.path.endsWith('/craft')) return 'This consumes the listed materials and cash cost for ' + context + '.';
      if (action.path.endsWith('/assign-current-character')) return 'This transfers the item to the current character. It does not automatically pass to another life.';
      if (action.path.includes('/choices/')) return 'This commits a branch in the case. You cannot replace it with another choice later.';
      if (action.path.endsWith('/cancel')) return 'This ends the run and returns its recorded escrow according to the game rules.';
      return '';
    }

    async function confirmAction(action, context) {
      const description = consequence(action, context);
      if (!description) return true;
      if (options.confirm) return await options.confirm(action.label || 'Confirm this action', description, { yes: 'Confirm', danger: true }) === true;
      return new Promise(resolve => {
        const returnFocus = document.activeElement;
        const panel = document.createElement('div');
        panel.className = 'fieldwork-confirm'; panel.setAttribute('role', 'alertdialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-label', action.label || 'Confirm this action');
        panel.innerHTML = '<div><h2>' + escape(action.label || 'Confirm this action') + '</h2><p>' + escape(description) + '</p><button type="button" data-fieldwork-cancel>Cancel</button><button type="button" data-fieldwork-confirm>Confirm</button></div>';
        root.append(panel);
        const finish = result => { cancelConfirmation = null; panel.remove(); if (returnFocus?.isConnected) returnFocus.focus(); resolve(result); };
        cancelConfirmation = () => finish(false);
        panel.querySelector('[data-fieldwork-cancel]').onclick = () => finish(false);
        panel.querySelector('[data-fieldwork-confirm]').onclick = () => finish(true);
        panel.addEventListener('keydown', event => { if (event.key === 'Escape') { event.preventDefault(); finish(false); } });
        panel.querySelector('[data-fieldwork-cancel]').focus();
      });
    }

    async function run(entry, retainedKey, alreadyConfirmed = false) {
      if (!active() || sessionUnavailable || busy || loading || !entry || !validAction(entry.action) || entry.action.available === false
        || (!alreadyConfirmed && panes[view].error)) return;
      const action = entry.action;
      const key = retainedKey || crypto.randomUUID();
      const attemptedCharacter = characterId;
      busy = true; draw();
      try {
        if (!alreadyConfirmed && !await confirmAction(action, entry.context)) return;
        if (!active() || attemptedCharacter !== characterId) return;
        const response = await options.act(action.method, action.path, action.body || {}, { label: action.label || entry.context, idempotencyKey: key });
        if (destroyed) return;
        if (attemptedCharacter !== characterId) { await load(); return; }
        if (sessionError(readError(response))) { await restoreSession(readError(response)); return; }
        if (!response || response.code >= 400) {
          notice = response?.body?.message || 'The action was not confirmed. Refresh the record before deciding what to do next.';
          noticeBad = true;
          retry = !response || response.code >= 500 || ['offline', 'in_progress', 'idempotency_in_progress'].includes(response.body?.error) ? { entry, key } : null;
        } else {
          notice = (action.label || entry.context) + ' completed.'; noticeBad = false; retry = null;
          const started = action.path.match(/^\/v1\/worldgraph\/mysteries\/([^/]+)\/start$/);
          if (started) { selectedMystery = decodeURIComponent(started[1]); mysteryDetail = null; }
          if (action.path.endsWith('/open') && response.body?.operationId) {
            selectedOperation = response.body.operationId; operationDetail = roleDetail = null;
          }
          if (options.refresh) {
            const refreshed = await options.refresh();
            if (refreshed?.code < 400 && refreshed.body) options.character = refreshed.body.character || refreshed.body;
          }
          await load();
        }
      } catch (error) {
        if (!destroyed) { notice = 'The response could not be confirmed. Retry this same action to recover its result.'; noticeBad = true; retry = { entry, key }; }
      } finally {
        if (!destroyed) { busy = false; draw(); }
      }
    }

    draw(); load();
    return {
      update(nextOptions) {
        const nextId = nextOptions?.character && nextOptions.character.id;
        options = { ...options, ...nextOptions };
        if (nextId && nextId !== characterId) {
          characterId = nextId; revision++; selectedMystery = selectedOperation = ''; mysteryDetail = operationDetail = roleDetail = null;
          for (const key of Object.keys(boards)) delete boards[key];
          for (const pane of Object.values(panes)) { pane.loading = false; pane.error = ''; }
          sessionUnavailable = false; recoveryRequired = false;
          retry = null; cancelConfirmation?.();
          loading = false; load(); return;
        }
        if (!busy && !loading && !recoveryRequired) load();
      },
      destroy() { destroyed = true; revision++; cancelConfirmation?.(); actions.clear(); root.remove(); },
    };
  }

  window.OmertaFieldwork = Object.freeze({ mount });
})();
