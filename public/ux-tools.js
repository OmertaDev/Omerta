/* Private working notes. Every game action still uses its original issued control. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = value => Array.isArray(value) ? value : [];
  const words = value => String(value || '').replace(/^[^:]+:/, '').replace(/[_-]+/g, ' ');
  const title = item => item.title || item.name || words(item.templateId || item.id);
  const num = value => Math.max(0, Number(value) || 0);
  const clone = value => JSON.parse(JSON.stringify(value));
  const rowKey = row => `${row.templateId || row.assetType}|${row.quality || 'standard'}`;
  function inventoryRows(board = {}, custody = []) {
    const result = [], seen = new Set();
    for (const [scope, stacks, items] of [['Account', board.stacks, board.items], ['Current character', board.currentCharacterStacks, board.currentCharacterItems || board.characterItems]]) {
      for (const row of list(stacks)) result.push({ ...row, key: `${scope}:${rowKey(row)}`, title: title(row), qty: num(row.qty ?? row.quantity), scope, available: true, state: 'held', quality: row.quality || 'standard' });
      for (const row of list(items)) { seen.add(row.id); const record = custody.find(item => item.id === row.id) || {}; result.push({ ...record, ...row, key: row.id, title: title(row), qty: 1, scope, available: !record.operationId && !row.escrowed && (!row.state || ['active', 'held', 'available'].includes(row.state)), quality: row.quality || 'standard' }); }
    }
    for (const row of list(custody)) if (!seen.has(row.id)) result.push({ ...row, key: row.id, title: title(row), qty: 1, scope: row.operationId ? 'Committed work' : 'Account custody record', available: false, quality: row.quality || 'standard' });
    return result;
  }
  function materialNeeds(recipes, selected, rows) {
    const needs = new Map();
    for (const recipe of list(recipes)) {
      const batches = Math.min(99, num(selected[recipe.id])); if (!batches) continue;
      for (const input of list(recipe.inputs)) {
        const key = rowKey(input), current = needs.get(key) || { templateId: input.templateId || input.assetType, external: !!input.assetType, title: input.title || words(input.templateId || input.assetType), quality: input.quality || 'standard', needed: 0, recipes: [] };
        current.needed += num(input.quantity ?? input.qty) * batches; current.recipes.push(title(recipe)); needs.set(key, current);
      }
    }
    return [...needs.values()].map(need => { if (need.external) return { ...need, held: null, committed: null, short: null }; const matching = rows.filter(row => row.templateId === need.templateId && row.quality === need.quality); const held = matching.filter(row => row.available && row.scope === 'Account').reduce((sum, row) => sum + row.qty, 0); return { ...need, held, committed: matching.filter(row => !row.available || row.scope !== 'Account').reduce((sum, row) => sum + row.qty, 0), short: Math.max(0, need.needed - held) }; });
  }
  function create({ getState, read, navigate, notify = () => {}, workspace }) {
    let owner = '', character = '', data = {}, inventory = {}, inventoryRead = false, custody = [], recipes = [], tactics = null, cases = new Map(), loading = false, sequence = 0;
    let dialog = null, view = 'inventory', query = '', nameDrafts = {}, selection = {}, compare = [], comparison = null, message = '', currentContext = null, pendingBookmark = null, formDrafts = new Map();
    const state = () => getState() || {};
    const account = () => String(state().session?.accountId || state().me?.accountId || '');
    const root = () => document.getElementById(`tab-${state().currentTab}`);
    const storage = () => workspace?.get?.('tools', {}) || {};
    function scope() {
      const next = account(), nextCharacter = String(state().me?.id || '');
      if (owner === next && character === nextCharacter) return !!owner;
      owner = next; character = nextCharacter; sequence++; inventory = {}; inventoryRead = false; custody = []; recipes = []; tactics = null; cases = new Map(); currentContext = null; comparison = null; loading = false; selection = {}; nameDrafts = {}; pendingBookmark = null; formDrafts.clear(); dialog?.close();
      data = storage() || {}; return !!owner;
    }
    const save = label => workspace?.set?.('tools', data, { label });
    const rows = () => [...inventoryRows(inventory, custody), ...Object.entries(state().me?.items || {}).map(([id, qty]) => { const item = list(state().rules?.consumables).find(item => item.id === id); return { key: 'consumable:' + id, templateId: id, title: item?.name || words(id), qty: num(qty), scope: 'Current consumables', available: true, state: 'held', quality: 'standard', origin: item?.desc || 'Current character consumable inventory' }; })];
    const catalog = () => [...list(tactics?.planner), ...list(tactics?.jobs).flatMap(job => list(job.actual))].filter((move, i, all) => all.findIndex(other => other.id === move.id) === i);
    function ensureDialog() {
      if (dialog) return dialog;
      dialog = document.createElement('dialog'); dialog.className = 'ux-tools-dialog'; dialog.setAttribute('aria-labelledby', 'ux-tools-title'); document.body.append(dialog);
      return dialog;
    }
    async function load() {
      scope(); const requested = owner, actor = character, seq = ++sequence; loading = true; paint();
      const responses = await Promise.allSettled(['/v1/worldgraph/inventory', '/v1/worldgraph/recipes', '/v1/ux/investigation-items', '/v1/ux/tactics'].map(path => read(path).then(reply => ({ path, reply }))));
      if (requested !== account() || actor !== String(state().me?.id || '') || seq !== sequence) return;
      const failures = [];
      for (const response of responses) { if (response.status !== 'fulfilled') { failures.push('A current record could not be read.'); continue; } const { path, reply } = response.value; if (reply?.code >= 400) failures.push(reply.body?.message || `Could not read ${path.split('/').at(-1)}.`); else observe(path, reply.body); }
      loading = false; message = failures.join(' '); paint();
    }
    function open(next = 'inventory') { if (!scope()) return; view = next; ensureDialog(); paint(); dialog.showModal(); load(); }
    function inventoryMarkup() {
      const all = rows();
      const shown = all.filter(row => {
        const uses = recipes.filter(recipe => list(recipe.inputs).some(input => input.templateId === row.templateId || input.assetType === row.templateId)).map(recipe => title(recipe)).join(' ');
        const sources = recipes.filter(recipe => list(recipe.outputs).some(output => output.templateId === row.templateId)).map(recipe => title(recipe)).join(' ');
        const caseText = [...cases.values()].filter(board => JSON.stringify(board).includes(row.templateId)).map(board => board.title || board.graphId).join(' ');
        return `${row.title} ${row.templateId} ${row.scope} ${row.origin || ''} ${row.graphId || ''} ${row.titleOfWork || ''} ${uses} ${sources} ${caseText} ${row.quality}`.toLowerCase().includes(query.toLowerCase());
      });
      return `<label class="ux-tools-search">Find by name, use, source, material or revealed case<input type="search" data-tools-search value="${esc(query)}" placeholder="e.g. brass, workshop, docks"></label><p>Live ownership records. Committed and other custody records are excluded from preparation totals.</p><ul class="ux-tools-inventory">${shown.map(row => `<li><div><b>${esc(row.title)}</b><span>${row.qty} × · ${esc(row.scope)} · ${esc(row.quality)}</span><small>${row.available ? 'Available in this inventory' : `Unavailable for preparation · ${esc(words(row.state))}`}${row.origin ? ` · source: ${esc(words(row.origin))}` : ''}${row.titleOfWork ? ` · ${esc(row.titleOfWork)}` : ''}</small>${row.returnConditions ? `<details><summary>Return conditions</summary>${esc(row.returnConditions)}</details>` : ''}</div><button type="button" data-tools-tray="${esc(row.key)}" aria-pressed="${list(data.tray).includes(row.key)}">${list(data.tray).includes(row.key) ? 'Unpin' : 'Pin to tray'}</button></li>`).join('') || '<li>No items match this search.</li>'}</ul>`;
    }
    function materialsMarkup() {
      const needs = materialNeeds(recipes, selection, rows()), cash = recipes.reduce((sum, recipe) => sum + num(recipe.cashCost) * num(selection[recipe.id]), 0);
      return `<p>Combine batches before choosing a normal Craft action. Published recipes consume account-held materials. Character-held and committed items are excluded. Materials and cash are never reserved here.</p><div class="ux-tools-recipes">${recipes.map(recipe => `<label>${esc(title(recipe))}<input type="number" min="0" max="99" step="1" data-tools-recipe="${esc(recipe.id)}" value="${num(selection[recipe.id])}" aria-label="Batches of ${esc(title(recipe))}"></label>`).join('') || '<p>No published recipes on this board.</p>'}</div><p>Combined cash cost: $${cash.toLocaleString()}</p><div class="ux-tools-scroll"><table><thead><tr><th>Consumed material</th><th>Needed</th><th>Available</th><th>Unavailable</th><th>Missing</th></tr></thead><tbody>${needs.map(need => `<tr><th>${esc(need.title)} · ${esc(need.quality)}</th><td>${need.needed}</td>${need.external ? `<td colspan="3">Choose an eligible ${esc(need.templateId)} with the issued recipe control; availability is checked there.</td>` : `<td>${need.held}</td><td>${need.committed}</td><td>${need.short}</td>`}</tr>`).join('')}</tbody></table></div><button type="button" data-tools-go="recipes">Review issued crafting controls →</button>`;
    }
    function buildsMarkup() {
      const draft = workspace?.get?.('tactics', {}) || {}, gear = list(draft.gear || tactics?.loadout?.actual), skills = list(draft.skills || tactics?.skills?.known);
      const builds = list(data.builds).filter(build => build.characterId === character);
      return `<p>Save the current planning-table selections (${gear.length} gear, ${skills.length} skills). Hypothetical sets never equip gear or spend points. Sets belong to this character.</p><label>Name<input data-tools-name maxlength="60" placeholder="Dock runner"></label><button type="button" data-tools-save-build>Save selected build</button><ul class="ux-tools-list">${builds.map(build => `<li><label><input type="checkbox" data-tools-compare="${esc(build.id)}"${compare.includes(build.id) ? ' checked' : ''}> ${esc(build.name)}</label><span>${build.gear.length} gear · ${build.skills.length} skills</span><button type="button" data-tools-delete-build="${esc(build.id)}">Delete</button></li>`).join('') || '<li>No saved builds for this character.</li>'}</ul><button type="button" data-tools-compare-builds${compare.length !== 2 ? ' disabled' : ''}>Compare two builds with current rules</button>${comparison ? comparison.map(entry => `<section class="ux-tools-build"><h3>${esc(entry.name)}</h3>${entry.error ? `<p role="alert">${esc(entry.error)}</p>` : `<p>${['muscle', 'cunning', 'speed'].map(stat => `${stat}: ${entry.board.loadout.proposedStats[stat]}`).join(' · ')}</p><p>Prerequisites: ${esc(list(entry.board.skills.conflicts).join(' ') || 'Current skill prerequisites and point budget pass.')}</p><ul>${list(entry.board.loadout.catalog).filter(gear => entry.gear.includes(gear.id) && (!gear.owned || gear.extracted)).map(gear => `<li>${esc(gear.name)}: ${gear.extracted ? 'extracted, not in play' : 'not owned'}.</li>`).join('')}</ul><details><summary>Actual action estimates for this proposed build</summary><div class="ux-tools-scroll"><table><thead><tr><th>Job / approach</th><th>Chance</th><th>Jail on failure</th></tr></thead><tbody>${list(entry.board.jobs).flatMap(job => list(job.proposed).map(quote => `<tr><th>${esc(job.name)} / ${esc(quote.approach)}</th><td>${(quote.probability * 100).toFixed(1)}%</td><td>${quote.jailSeconds ?? '—'} sec</td></tr>`)).join('')}</tbody></table></div></details>`}</section>`).join('') : ''}`;
    }
    function plansMarkup() {
      const draft = workspace?.get?.('tactics', {}) || {}, plans = list(data.plans).filter(plan => plan.characterId === character);
      return `<p>Save up to three moves from the planning table. Loading rechecks current resources and cooldowns; execution stays manual.</p><label>Name<input data-tools-name maxlength="60" placeholder="Before the docks"></label><button type="button" data-tools-save-plan${!list(draft.plan).length ? ' disabled' : ''}>Save current three-move plan</button><ul class="ux-tools-list">${plans.map(plan => { const checked = window.createOmertaTactics?.analyzePlan?.(plan.moves, catalog(), state().me || {}) || []; return `<li><div><b>${esc(plan.name)}</b><ol>${checked.map(move => `<li>${esc(move.move?.name || move.entry.id)}${move.conflicts.length ? `<small>${esc(move.conflicts.join(' '))}</small>` : ' · current checks pass'}</li>`).join('')}</ol></div><button type="button" data-tools-load-plan="${esc(plan.id)}">Load and review</button><button type="button" data-tools-delete-plan="${esc(plan.id)}">Delete</button></li>`; }).join('') || '<li>No saved plans for this character.</li>'}</ul><button type="button" data-tools-planning>Open planning table →</button>`;
    }
    function bookmarksMarkup() { return `<p>Private markers point to an exact revealed passage. Changed or unavailable passages are reported instead of jumping to different text.</p><ul class="ux-tools-list">${list(data.bookmarks).filter(mark => mark.characterId === character).map(mark => `<li><div><b>${esc(mark.title)}</b><blockquote>${esc(mark.text)}</blockquote><small>${esc(mark.graphId)} / ${esc(mark.nodeId)} / passage ${mark.index + 1}</small></div><button type="button" data-tools-bookmark-open="${esc(mark.id)}">Return to passage</button><button type="button" data-tools-bookmark-delete="${esc(mark.id)}">Remove</button></li>`).join('') || '<li>Use Bookmark passage beside revealed dialogue or documents.</li>'}</ul>`; }
    function historyMarkup() { return `<p>Restore returns this private workspace section to the point before that edit, including its later edits. Gameplay, messages sent, crafted items and spending are never reversed here.</p><ul class="ux-tools-list">${list(workspace?.history?.()).map(entry => `<li><div><b>${esc(entry.label)}</b><small>${esc(entry.namespace)} · ${esc(new Date(entry.at).toLocaleString())}</small></div><button type="button" data-tools-undo="${esc(entry.id)}">Restore before this edit</button></li>`).join('') || '<li>No reversible private edits in this account history.</li>'}</ul>`; }
    function paint() {
      if (!dialog || !owner) return;
      const active = document.activeElement, field = active?.getAttribute('data-tools-search'), focusName = active?.hasAttribute('data-tools-name'), at = active?.selectionStart;
      const sections = { inventory: inventoryMarkup, materials: materialsMarkup, builds: buildsMarkup, plans: plansMarkup, bookmarks: bookmarksMarkup, history: historyMarkup };
      dialog.innerHTML = `<header><div><small>PRIVATE WORKSPACE</small><h2 id="ux-tools-title">Your working desk</h2></div><div><button type="button" data-tools-palette-open>Find screen control · Ctrl+Shift+K</button> <button type="button" data-tools-close aria-label="Close working desk">Close</button></div></header><nav aria-label="Working desk sections">${Object.keys(sections).map(key => `<button type="button" data-tools-view="${key}" aria-pressed="${view === key}">${words(key)}</button>`).join('')}</nav>${loading ? '<p role="status">Reading current inventory and rules…</p>' : ''}${message ? `<p role="status">${esc(message)}</p>` : ''}<div class="ux-tools-content">${(sections[view] || inventoryMarkup)()}</div>`;
      dialog.onclick = onClick; dialog.onchange = onChange; dialog.oninput = event => { if (event.target.hasAttribute('data-tools-name')) nameDrafts[view] = event.target.value; };
      const name = dialog.querySelector('[data-tools-name]'); if (name) name.value = nameDrafts[view] || '';
      dialog.querySelector('[data-tools-search]')?.addEventListener('input', event => { query = event.target.value; paint(); });
      if (field !== null && active?.hasAttribute('data-tools-search')) { const input = dialog.querySelector('[data-tools-search]'); input?.focus(); try { input?.setSelectionRange(at, at); } catch {} }
      if (focusName && name) { name.focus(); try { name.setSelectionRange(at, at); } catch {} }
    }
    async function compareBuilds() {
      const selected = list(data.builds).filter(build => compare.includes(build.id) && build.characterId === character); if (selected.length !== 2) return;
      const requested = owner, actor = character, seq = ++sequence; message = 'Calculating both builds from the current server rules…'; paint();
      const replies = await Promise.allSettled(selected.map(async build => { const query = new URLSearchParams({ gear: build.gear.join(',') || 'none', skills: build.skills.join(',') || 'none' }); const reply = await read(`/v1/ux/tactics?${query}`); return { ...build, board: reply.body?.tactics, error: reply.code >= 400 ? reply.body?.message || 'This saved setup is unavailable.' : '' }; }));
      if (requested !== account() || actor !== String(state().me?.id || '') || seq !== sequence) return;
      comparison = replies.map((reply, i) => reply.status === 'fulfilled' ? reply.value : { ...selected[i], error: 'The comparison could not be read.' }); message = ''; paint();
    }
    function onClick(event) {
      const button = event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-tools-palette-open')) { dialog.close(); palette(); }
      else if (button.hasAttribute('data-tools-close')) dialog.close();
      else if (button.dataset.toolsView) { view = button.dataset.toolsView; message = ''; paint(); }
      else if (button.hasAttribute('data-tools-tray')) { const selected = new Set(list(data.tray)); selected.has(button.dataset.toolsTray) ? selected.delete(button.dataset.toolsTray) : selected.add(button.dataset.toolsTray); data.tray = [...selected].slice(-24); save('Edit personal inventory tray'); paint(); renderTray(); }
      else if (button.hasAttribute('data-tools-save-build') || button.hasAttribute('data-tools-save-plan')) {
        const name = dialog.querySelector('[data-tools-name]')?.value.trim(); if (!name) { dialog.querySelector('[data-tools-name]')?.focus(); message = 'Give this private template a name.'; return; }
        const draft = workspace?.get?.('tactics', {}) || {}, id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        if (button.hasAttribute('data-tools-save-build')) { data.builds = [...list(data.builds), { id, name, characterId: character, gear: list(draft.gear || tactics?.loadout?.actual), skills: list(draft.skills || tactics?.skills?.known) }].slice(-12); save('Save named gear and skill build'); }
        else { if (!list(draft.plan).length) return; data.plans = [...list(data.plans), { id, name, characterId: character, moves: clone(draft.plan.slice(0, 3)) }].slice(-12); save('Save three-move plan template'); }
        nameDrafts[view] = ''; paint();
      } else if (button.dataset.toolsDeleteBuild) { data.builds = list(data.builds).filter(build => build.id !== button.dataset.toolsDeleteBuild); compare = compare.filter(id => id !== button.dataset.toolsDeleteBuild); comparison = null; save('Delete saved build'); paint(); }
      else if (button.dataset.toolsDeletePlan) { data.plans = list(data.plans).filter(plan => plan.id !== button.dataset.toolsDeletePlan); save('Delete plan template'); paint(); }
      else if (button.hasAttribute('data-tools-compare-builds')) compareBuilds();
      else if (button.dataset.toolsLoadPlan) { const plan = list(data.plans).find(plan => plan.id === button.dataset.toolsLoadPlan && plan.characterId === character); if (!plan) return; document.dispatchEvent(new CustomEvent('omerta:tactics-apply-plan', { detail: { characterId: character, plan: clone(plan.moves) } })); dialog.close(); navigate('streets'); notify('Template loaded for manual review. Current conflicts remain visible in the planning table.'); }
      else if (button.hasAttribute('data-tools-planning')) { dialog.close(); navigate('streets'); document.dispatchEvent(new CustomEvent('omerta:tactics-open', { detail: { view: 'plan' } })); }
      else if (button.dataset.toolsGo) { dialog.close(); navigate('fieldwork'); setTimeout(() => document.dispatchEvent(new CustomEvent('omerta:fieldwork-navigate', { detail: { view: button.dataset.toolsGo } })), 0); }
      else if (button.dataset.toolsUndo) { if (workspace?.undo?.(button.dataset.toolsUndo)) { data = storage() || {}; paint(); renderTray(); } }
      else if (button.dataset.toolsBookmarkDelete) { data.bookmarks = list(data.bookmarks).filter(mark => mark.id !== button.dataset.toolsBookmarkDelete); save('Remove passage bookmark'); paint(); }
      else if (button.dataset.toolsBookmarkOpen) { pendingBookmark = list(data.bookmarks).find(mark => mark.id === button.dataset.toolsBookmarkOpen && mark.characterId === character); if (!pendingBookmark) return; dialog.close(); navigate('fieldwork'); document.dispatchEvent(new CustomEvent('omerta:fieldwork-navigate', { detail: { view: 'mysteries', graphId: pendingBookmark.graphId } })); }
    }
    function onChange(event) {
      const input = event.target;
      if (input.dataset.toolsRecipe) { selection[input.dataset.toolsRecipe] = Math.min(99, Math.floor(num(input.value))); paint(); }
      if (input.dataset.toolsCompare) { const set = new Set(compare); input.checked ? set.add(input.dataset.toolsCompare) : set.delete(input.dataset.toolsCompare); if (set.size > 2) { input.checked = false; notify('Choose two builds to compare.'); return; } compare = [...set]; paint(); }
    }
    function renderTray() {
      document.querySelectorAll('[data-tools-personal-tray]').forEach(node => { if (node.parentElement !== root() || node.dataset.toolsOwner !== owner) node.remove(); });
      const current = root(); if (!owner || !current) return;
      const pinned = rows().filter(row => list(data.tray).includes(row.key)); let host = current.querySelector('[data-tools-personal-tray]'); if (!pinned.length && !list(data.tray).length) { host?.remove(); return; }
      let added = false; if (!host) { host = document.createElement('aside'); host.className = 'ux-tools-tray'; host.dataset.toolsPersonalTray = ''; host.dataset.toolsOwner = owner; host.dataset.uxPanel = 'inventory-tray'; current.append(host); added = true; }
      const markup = `<b>YOUR INVENTORY TRAY</b><ul>${pinned.map(row => `<li>${esc(row.title)} <strong>${row.qty} ×</strong> · ${row.available ? 'available' : esc(words(row.state))}</li>`).join('') || `<li>${inventoryRead ? 'Pinned items are no longer in the current inventory record.' : 'Read current quantities to resolve your saved pins.'}</li>`}</ul><button type="button">Review current quantities</button>`;
      if (host.innerHTML !== markup) { host.innerHTML = markup; host.querySelector('button').onclick = () => open(); }
      if (added) document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));
    }
    function passages(node) {
      const dialogue = typeof node.dialogue === 'string' ? [node.dialogue] : list(node.dialogue).map(line => typeof line === 'string' ? line : line.text);
      return [...dialogue, node.description, node.prompt].filter(text => typeof text === 'string' && text.trim());
    }
    function bookmarkControls(detail) {
      if (!scope() || !detail?.root) return;
      const board = detail.mysteryDetail || detail, graphId = board.graphId || board.graph?.id || detail.graphId;
      if (!graphId) return;
      const nodes = list(board.nodes || detail.nodes); cases.set(graphId, { graphId, title: board.title, nodes });
      for (const node of nodes) {
        const card = [...detail.root.querySelectorAll('[data-fieldwork-node],[data-story-document],[data-story-transcript]')].find(el => el.dataset.fieldworkNode === node.id || el.dataset.storyDocument === node.id || el.dataset.storyTranscript === node.id);
        if (!card || card.querySelector('[data-tools-bookmarks]')) continue;
        const host = document.createElement('details'); host.dataset.toolsBookmarks = ''; host.className = 'ux-tools-passage'; host.innerHTML = '<summary>Bookmark a passage</summary>';
        passages(node).forEach((text, index) => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `Bookmark passage ${index + 1}: ${text.slice(0, 65)}${text.length > 65 ? '…' : ''}`; button.onclick = () => { const mark = { id: `${graphId}:${node.id}:${index}`, graphId, nodeId: node.id, index, text, title: title(node), characterId: character }; data.bookmarks = [...list(data.bookmarks).filter(item => item.id !== mark.id || item.characterId !== character), mark].slice(-60); save('Bookmark exact revealed passage'); notify('Passage bookmarked in your private working desk.'); }; host.append(button); }); card.append(host);
      }
      if (pendingBookmark && detail.loading !== true && graphId === pendingBookmark.graphId) {
        const mark = pendingBookmark; pendingBookmark = null;
        const node = nodes.find(node => node.id === mark.nodeId), texts = node ? passages(node) : [];
        if (texts[mark.index] !== mark.text) { notify('That exact passage is unavailable or has changed. Your bookmark remains saved.'); return; }
        const card = [...detail.root.querySelectorAll('[data-fieldwork-node]')].find(el => el.dataset.fieldworkNode === mark.nodeId); if (!card) return;
        const target = [...card.querySelectorAll('p')].find(el => el.textContent === mark.text) || card; target.tabIndex = -1; target.scrollIntoView({ block: 'center', behavior: 'instant' }); target.focus({ preventScroll: true }); target.classList.add('ux-tools-bookmarked'); setTimeout(() => target.classList.remove('ux-tools-bookmarked'), 2200); notify(`Returned to ${mark.title}, passage ${mark.index + 1}.`);
      }
    }
    function palette() {
      if (!scope() || document.querySelector('dialog[open],.modal-bg:not(.hidden)')) return;
      const controls = [...(root()?.querySelectorAll('button:not(:disabled),a[href],input[type="submit"]:not(:disabled)') || [])].filter(node => node.getClientRects().length && !node.closest('[data-tools-personal-tray],[data-ux-tools]')).slice(0, 100);
      const pop = document.createElement('dialog'); pop.className = 'ux-tools-dialog ux-tools-palette'; pop.setAttribute('aria-label', 'Current screen controls');
      pop.innerHTML = '<h2>Find a control on this screen</h2><p>Choosing a result focuses its original control. Its normal action and confirmation stay unchanged.</p><label>Control name<input type="search" data-tools-palette-query></label><div data-tools-palette-results></div><button type="button" data-tools-palette-close>Close</button>'; document.body.append(pop);
      const draw = () => { const q = pop.querySelector('input').value.toLowerCase(), results = pop.querySelector('[data-tools-palette-results]'); results.replaceChildren(); controls.filter(node => (node.textContent || node.getAttribute('aria-label') || node.value || '').toLowerCase().includes(q)).forEach(node => { const button = document.createElement('button'); button.type = 'button'; button.textContent = `${(node.textContent || node.getAttribute('aria-label') || node.value).trim()}${node.closest('article,.card,section')?.querySelector('h2,h3') ? ` · ${node.closest('article,.card,section').querySelector('h2,h3').textContent}` : ''}`; button.onclick = () => { pop.close(); if (node.isConnected) { node.scrollIntoView({ block: 'center', behavior: 'instant' }); node.focus({ preventScroll: true }); } }; results.append(button); }); };
      pop.onclose = () => pop.remove(); pop.querySelector('input').oninput = draw; pop.querySelector('[data-tools-palette-close]').onclick = () => pop.close(); draw(); pop.showModal(); pop.querySelector('input').focus();
    }
    const safeFields = form => [...form.querySelectorAll('input,textarea,select')].filter(input => !['password', 'hidden', 'file', 'submit', 'button'].includes(input.type) && !/token|secret|credential|password/i.test(`${input.id} ${input.name}`));
    const fieldSignature = input => JSON.stringify([input.tagName, input.type, input.id, input.name, input.getAttribute('aria-label'), input.getAttribute('placeholder'), [...(input.labels || [])].map(label => label.textContent.trim()), ['checkbox', 'radio'].includes(input.type) ? input.getAttribute('value') : null]);
    const formSignature = form => JSON.stringify([form.id, form.getAttribute('name'), form.getAttribute('action'), form.getAttribute('method'), Object.entries(form.dataset).sort(([a], [b]) => a.localeCompare(b)), form.closest('[data-ux-panel]')?.dataset.uxPanel, safeFields(form).map(fieldSignature).sort()]);
    function formKey(form) {
      const signature = formSignature(form), matches = [...(root()?.querySelectorAll('form') || [])].filter(candidate => formSignature(candidate) === signature);
      return matches.length === 1 ? `${state().currentTab}:${signature}` : null;
    }
    function fieldKey(input, form) { const key = fieldSignature(input); return safeFields(form).filter(candidate => fieldSignature(candidate) === key).length === 1 ? key : null; }
    function rememberForm(form) { if (!form || !root()?.contains(form)) return; const key = formKey(form); if (!key) return; formDrafts.set(key, safeFields(form).map(input => ({ key: fieldKey(input, form), value: input.value, checked: input.checked, invalid: !input.validity.valid })).filter(field => field.key)); }
    function restoreForms() {
      root()?.querySelectorAll('form').forEach(form => { const key = formKey(form), draft = key && formDrafts.get(key); if (!draft) return; let invalid = null; safeFields(form).forEach(input => { const field = fieldKey(input, form), saved = field && draft.find(saved => saved.key === field); if (!saved) return; input.value = saved.value; if (['checkbox', 'radio'].includes(input.type)) input.checked = saved.checked; if (saved.invalid && !input.validity.valid) { input.setAttribute('aria-invalid', 'true'); invalid ||= input; } }); if (invalid) { invalid.focus({ preventScroll: true }); if (!form.querySelector('[data-tools-form-error]')) { const note = document.createElement('p'); note.dataset.toolsFormError = ''; note.setAttribute('role', 'alert'); note.textContent = `Your draft is preserved. ${invalid.validationMessage}`; form.prepend(note); } } });
    }
    document.addEventListener('input', event => { if (scope() && event.target.closest('form') && !event.target.closest('dialog')) rememberForm(event.target.closest('form')); });
    document.addEventListener('invalid', event => { if (!scope() || !root()?.contains(event.target)) return; rememberForm(event.target.form); event.target.setAttribute('aria-invalid', 'true'); queueMicrotask(() => event.target.form?.querySelector(':invalid')?.focus()); }, true);
    document.addEventListener('keydown', event => { if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'k') { event.preventDefault(); palette(); } });
    document.addEventListener('omerta:fieldwork-rendered', event => { scope(); currentContext = event.detail; if (event.detail.boards?.inventory) { inventory = event.detail.boards.inventory; inventoryRead = true; } if (event.detail.boards?.recipes) recipes = list(event.detail.boards.recipes.recipes); bookmarkControls(event.detail); renderTray(); });
    document.addEventListener('omerta:story-rendered', event => bookmarkControls(event.detail));
    document.addEventListener('omerta:workspace-undo', () => { scope(); data = storage() || {}; renderTray(); if (dialog?.open) paint(); });
    function observe(path, body) { if (!scope()) return; if (path === '/v1/worldgraph/inventory') { inventory = body || {}; inventoryRead = true; } else if (path === '/v1/worldgraph/recipes') recipes = list(body?.recipes); else if (path === '/v1/ux/investigation-items') custody = list(body?.items); else if (path === '/v1/ux/tactics' && body?.tactics?.characterId === character) tactics = body.tactics; renderTray(); }
    function render() {
      if (!scope()) { document.querySelector('[data-tools-open]')?.remove(); document.querySelectorAll('[data-tools-personal-tray]').forEach(node => node.remove()); return; }
      data = storage() || {};
      const host = document.querySelector('#ux-workspace-toolbar .ux-workspace-controls') || document.getElementById('top');
      let button = document.querySelector('[data-tools-open]'); if (host && !button) { button = document.createElement('button'); button.type = 'button'; button.className = 'act'; button.dataset.toolsOpen = ''; button.textContent = 'Working desk'; button.title = 'Inventory tray, builds, plans, bookmarks and undo'; button.onclick = () => open(); }
      if (host && button && button.parentElement !== host) host.append(button);
      renderTray();
    }
    return { render, observe, open, afterRender() { render(); restoreForms(); }, beforeRender() { if (scope()) root()?.querySelectorAll('form').forEach(rememberForm); }, reloadWorkspace() { scope(); data = storage() || {}; render(); if (dialog?.open) paint(); }, palette };
  }
  create.inventoryRows = inventoryRows; create.materialNeeds = materialNeeds;
  window.createOmertaTools = create;
})();
