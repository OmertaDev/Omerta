/* Public city facts, personal recorded dealings, and an account-owned reading workspace. */
(() => {
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = value => Array.isArray(value) ? value : [];
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = value => num(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  function projectSvg(pct, complete = false) {
    const stage = complete ? 4 : Math.min(3, Math.floor(Math.max(0, Math.min(100, pct)) / 25));
    const floors = Array.from({ length: 4 }, (_, i) => `<rect x="70" y="${130 - i * 26}" width="150" height="24" fill="${i <= stage ? '#b99b56' : '#272625'}"/><path d="M${86 + i * 8} ${134 - i * 26}v16m30-16v16m30-16v16m30-16v16" stroke="#171717" stroke-width="5"/>`).join('');
    return `<svg viewBox="0 0 300 180" class="ux-project-art" role="img" aria-label="${complete ? 'Completed monument' : `Construction visualization at ${Math.round(pct)} percent`}"><rect width="300" height="180" fill="#101316"/><path d="M15 155h270M44 155V25h205v130M44 50h205M44 77h205M44 103h205M44 129h205" stroke="#59544a" fill="none"/>${floors}<path d="M64 155h165M130 28h40l12 8H118Z" stroke="#d3b16c" fill="#a58a50"/></svg>`;
  }
  function curveSvg(samples, metric) {
    const points = samples.map(sample => metric === 'respect' ? num(sample.respect) : num(sample.trades?.[metric]));
    if (!points.length) return '';
    const floor = Math.min(...points), span = Math.max(1, Math.max(...points) - floor);
    const coordinates = points.map((value, i) => `${20 + i * 560 / Math.max(1, points.length - 1)},${130 - (value - floor) * 110 / span}`).join(' ');
    return `<svg viewBox="0 0 600 155" class="ux-learning-curve" role="img" aria-label="${esc(metric)} recorded progression; accessible values below"><path d="M20 10v120h560" fill="none" stroke="#777062"/><polyline points="${coordinates}" fill="none" stroke="#d3b16c" stroke-width="3"/><text x="20" y="150" fill="#c7c0ad" font-size="11">${esc(new Date(samples[0].at).toLocaleDateString())}</text><text x="580" y="150" fill="#c7c0ad" font-size="11" text-anchor="end">${esc(new Date(samples.at(-1).at).toLocaleDateString())}</text></svg>`;
  }
  window.createOmertaWorld = ({ getState, read, navigate, notify, workspace }) => {
    let account = '', boards = {}, layer = 'ownership', metric = 'respect', request = null, renderedTab = '', panelSignature = '', disclosures = {};
    const state = () => getState();
    const data = () => workspace?.get('world', { samples: [], memories: [] }) || { samples: [], memories: [] };
    const layout = () => workspace?.get('layout', { density: 'comfortable', focus: false, order: {} }) || { density: 'comfortable', focus: false, order: {} };
    function scope() {
      const next = String(state().session?.accountId || '');
      if (next !== account) { account = next; boards = {}; request = null; renderedTab = ''; panelSignature = ''; disclosures = {}; }
      return !!account && !!state().me;
    }
    const saveLayout = patch => { workspace.set('layout', { ...layout(), ...patch }); applyLayout(); };
    function syncStatus() {
      const host = document.getElementById('ux-workspace-status'); if (!host) return;
      const status = workspace.status(), words = { local: 'Saved in this browser', pending: 'Account sync pending', syncing: 'Saving to your account', saved: 'Workspace saved to your account', offline: 'Saved locally · account sync unavailable', conflict: 'Another device has a different workspace' };
      host.textContent = words[status.state] || words.local;
      if (status.state === 'conflict') {
        for (const [label, keep] of [['Keep this device’s edits', true], ['Load account workspace', false]]) {
          const button = document.createElement('button'); button.className = 'act'; button.type = 'button'; button.textContent = label; button.onclick = () => workspace.resolveConflict(keep); host.append(button);
        }
      } else if (status.state === 'offline') {
        const button = document.createElement('button'); button.className = 'act'; button.type = 'button'; button.textContent = 'Retry sync'; button.onclick = () => workspace.flush(); host.append(button);
      }
    }
    function applyLayout() {
      const prefs = layout();
      document.body.dataset.uxDensity = ['compact', 'large'].includes(prefs.density) ? prefs.density : 'comfortable';
      document.body.classList.toggle('ux-operation-focus', !!prefs.focus && !!state().me);
      const density = document.querySelector('select[data-ux-density]'); if (density && document.activeElement !== density) density.value = prefs.density || 'comfortable';
      const focus = document.querySelector('[data-ux-focus]'); if (focus) { focus.setAttribute('aria-pressed', String(!!prefs.focus)); focus.textContent = prefs.focus ? 'Exit focus view' : 'Focus on this operation'; }
      const vitals = document.getElementById('ux-focus-vitals'), me = state().me;
      if (vitals) vitals.textContent = me && prefs.focus ? `Health ${fmt(me.health)} · nerve ${fmt(me.nerve)}/${fmt(me.maxNerve)} · energy ${fmt(me.energy)}/${fmt(me.maxEnergy)} · heat ${fmt(me.heat)}` : '';
      syncStatus();
    }
    function mountToolbar() {
      const tabs = document.getElementById('tabs'); if (!tabs) return;
      let toolbar = document.getElementById('ux-workspace-toolbar');
      if (!toolbar) {
        toolbar = document.createElement('section'); toolbar.id = 'ux-workspace-toolbar'; toolbar.className = 'ux-workspace-toolbar'; toolbar.setAttribute('aria-label', 'Reading and workspace preferences');
        toolbar.innerHTML = '<div class="ux-workspace-controls"><label>Reading <select data-ux-density aria-label="Reading density"><option value="comfortable">Comfortable</option><option value="compact">Compact</option><option value="large">Large text</option></select></label><button class="act" type="button" data-ux-focus aria-pressed="false">Focus on this operation</button><details><summary>Arrange workspace panels</summary><p>Drag a panel handle, or use its up/down controls. Gameplay controls keep their original handlers.</p><div id="ux-panel-order"></div></details></div><div id="ux-focus-vitals" role="status"></div><div id="ux-workspace-status" role="status" aria-live="polite"></div>';
        const screenTools = document.querySelector('#ux-screen-tools .ux-screen-tools-body');
        if (screenTools) screenTools.append(toolbar); else tabs.before(toolbar);
        toolbar.querySelector('[data-ux-density]').onchange = event => saveLayout({ density: event.target.value });
        toolbar.querySelector('[data-ux-focus]').onclick = () => saveLayout({ focus: !layout().focus });
      }
      applyLayout();
    }
    function panelGroups() {
      const panel = document.getElementById('tab-' + state().currentTab); if (!panel) return [];
      const candidates = [...panel.querySelectorAll('.ux-progression,.ux-tactics,.ux-investigation,.ux-coordination,.ux-world-panel,[data-investigation-ux],[data-ux-panel]')];
      const parents = [...new Set(candidates.map(node => node.parentElement))];
      return parents.map((parent, index) => ({ parent, key: parent === panel ? 'root' : (parent.id || parent.className || 'group') + ':' + index,
        nodes: candidates.filter(node => node.parentElement === parent) }));
    }
    function orderPanels() {
      const prefs = layout(), saved = prefs.order?.[state().currentTab], groups = panelGroups();
      for (const group of groups) {
        group.nodes.forEach((node, index) => {
          const key = node.dataset.uxPanel || node.dataset.uxProgression || node.dataset.investigationUx || node.id || 'panel-' + index; node.dataset.uxPanel = key;
          if (node.querySelector(':scope > .ux-panel-handle')) return;
          const handle = document.createElement('button'); handle.type = 'button'; handle.className = 'ux-panel-handle'; handle.draggable = true; handle.textContent = '⠿ Move panel';
          handle.setAttribute('aria-label', 'Drag ' + key + ' panel; keyboard controls in Arrange workspace panels');
          handle.ondragstart = event => { event.dataTransfer.setData('text/plain', JSON.stringify({ group: group.key, key })); event.dataTransfer.effectAllowed = 'move'; };
          node.ondragover = event => event.preventDefault();
          node.ondrop = event => { event.preventDefault(); try { const from = JSON.parse(event.dataTransfer.getData('text/plain')); if (from.group === group.key) movePanel(from.key, key, group.key); } catch {} };
          const summary = node.tagName === 'DETAILS' ? node.querySelector(':scope > summary') : null;
          if (summary) summary.after(handle); else node.prepend(handle);
        });
        const order = Array.isArray(saved) && group.key === 'root' ? saved : list(saved?.[group.key]);
        const actual = [...group.parent.children].filter(node => group.nodes.includes(node));
        const ordered = order.map(key => group.nodes.find(item => item.dataset.uxPanel === key)).filter(Boolean);
        const desired = [...actual.filter(node => !ordered.includes(node)), ...ordered];
        if (desired.some((node, index) => node !== actual[index])) for (const node of desired) group.parent.append(node);
      }
      const settings = document.getElementById('ux-panel-order'); if (!settings) return;
      const focusedRow = document.activeElement?.closest('.ux-panel-order-row');
      const focusedKey = focusedRow?.dataset.orderPanel, focusedAction = document.activeElement?.dataset.orderAction;
      settings.replaceChildren();
      for (const group of groups) {
        const actual = [...group.parent.children].filter(node => group.nodes.includes(node));
        actual.forEach((node, index) => {
          const row = document.createElement('div'); row.className = 'ux-panel-order-row'; row.dataset.orderPanel = node.dataset.uxPanel;
          const label = document.createElement('span'); label.textContent = node.querySelector('h2,h3,summary')?.textContent || node.dataset.uxPanel; row.append(label);
          for (const [text, step] of [['Up', -1], ['Down', 1]]) {
            const button = document.createElement('button'); button.className = 'act'; button.type = 'button'; button.textContent = text; button.dataset.orderAction = text;
            button.disabled = index + step < 0 || index + step >= actual.length; button.setAttribute('aria-label', text + ': ' + label.textContent);
            button.onclick = () => movePanel(node.dataset.uxPanel, actual[index + step]?.dataset.uxPanel, group.key); row.append(button);
          }
          settings.append(row);
        });
      }
      if (focusedKey) {
        const row = [...settings.children].find(node => node.dataset.orderPanel === focusedKey);
        const button = [...(row?.querySelectorAll('button') || [])].find(node => node.dataset.orderAction === focusedAction && !node.disabled)
          || row?.querySelector('button:not([disabled])');
        button?.focus({ preventScroll: true });
      }
    }
    function movePanel(from, to, groupKey) {
      const group = panelGroups().find(item => item.key === groupKey); if (!group) return;
      const nodes = [...group.parent.children].filter(node => group.nodes.includes(node));
      const a = nodes.findIndex(node => node.dataset.uxPanel === from), b = nodes.findIndex(node => node.dataset.uxPanel === to);
      if (a < 0 || b < 0 || a === b) return;
      nodes.splice(b, 0, nodes.splice(a, 1)[0]);
      const prefs = layout(), old = prefs.order?.[state().currentTab];
      saveLayout({ order: { ...prefs.order, [state().currentTab]: { ...(Array.isArray(old) ? { root: old } : old), [groupKey]: nodes.map(node => node.dataset.uxPanel) } } });
      orderPanels(); notify('Workspace panel order saved.');
    }
    function cityMarkup() {
      const map = boards.map, events = list(boards.events?.events), cases = Object.values(boards.cases || {});
      const tabs = state().tabs || {}, validTab = tab => Object.hasOwn(tabs, tab);
      if (!map) return '<p>Your public city map opens here when its current record is available.</p><button class="act" type="button" data-world-refresh>Load current public city facts</button>';
      let content;
      if (layer === 'ownership') content = `<div class="ux-district-scenes">${list(map.districts).map(d => `<article class="ux-district-scene"><div class="ux-shopfront" aria-hidden="true"><i></i><i></i><i></i></div><h4>${esc(d.name)}</h4><div class="ux-turf-sign">${d.holder ? `Turf held by ${esc(d.holder.tag || d.holder.name)}` : d.occupier ? `Occupied by ${esc(d.occupier.name)}` : 'Unclaimed turf'}</div><p>${esc(d.state)}${d.racket ? ` · ${esc(d.racket.typeName)}` : ''}${d.sov ? ` · ${esc(d.sov.name)}` : ''}</p><small>Public district state · neighboring districts: ${esc(list(d.neighbours).join(', '))}</small></article>`).join('')}</div>`;
      else if (layer === 'events') content = events.map(event => `<article class="ux-world-news"><h4>${esc(event.title)}</h4><p>${esc(event.subtitle)}</p>${validTab(event.tab) ? `<button class="act" type="button" data-world-go="${esc(event.tab)}">Open the event</button>` : ''}</article>`).join('') || '<p>No timed public events appear in the current city record.</p>';
      else if (layer === 'venues') content = `<div class="ux-venue-links">${list(state().venues).map(venue => `<button class="act" type="button" data-world-go="${esc(venue.tab)}">${esc(venue.name)}</button>`).join('')}</div>`;
      else content = cases.flatMap(board => list(board.nodes).filter(node => node.venueId && node.status !== 'excluded').map(node => `<article><h4>${esc(node.title)}</h4><p>${esc(node.venueId)} · ${esc(node.status)}</p><button class="act" type="button" data-world-go="fieldwork">Open your investigation</button></article>`)).join('') || '<p>Open an investigation to add its discovered destinations. Unrevealed locations stay private.</p>';
      return `<label>Map layer <select data-world-layer aria-label="Public city map layer">${['ownership', 'events', 'venues', 'investigation'].map(value => `<option value="${value}" ${layer === value ? 'selected' : ''}>${value}</option>`).join('')}</select></label>${content}<button type="button" class="act" data-world-refresh>Refresh public city facts</button>`;
    }
    function projectMarkup() {
      const mega = boards.mega;
      if (!mega) return '<p>Open the City to read the current public works record.</p>';
      const current = mega.current, pct = current ? Math.max(0, Math.min(100, num(current.progress) / Math.max(1, num(current.target)) * 100)) : 0;
      return `${current ? `<article>${projectSvg(pct)}<h4>${esc(current.name || current.monument || 'Current public work')}</h4><p>${fmt(current.progress)} / ${fmt(current.target)} · ${Math.round(pct)}% recorded construction</p><small>The illustrated construction stage follows actual progress. Contributions use the existing City controls.</small></article>` : '<p>No monument is currently under construction.</p>'}<div class="ux-world-skyline">${list(mega.skyline).map(project => `<article>${projectSvg(100, true)}<h4>${esc(project.name)}</h4><p>${esc(project.district)} · Architect ${esc(project.architect || 'record unavailable')}</p></article>`).join('')}</div>`;
    }
    function learningMarkup() {
      const me = state().me, samples = list(data().samples).filter(sample => sample.id === me.id).slice(-80), tracks = list(me.trades);
      if (metric !== 'respect' && !tracks.some(track => track.id === metric)) metric = 'respect';
      return `<label>Learning curve <select data-world-metric aria-label="Learning curve metric"><option value="respect">Respect</option>${tracks.map(track => `<option value="${esc(track.id)}" ${metric === track.id ? 'selected' : ''}>${esc(track.name)} XP</option>`).join('')}</select></label><p>Recorded changes for this character, synchronized through your workspace. Earlier unrecorded play is not reconstructed.</p>${samples.length > 1 ? curveSvg(samples, metric) : '<p>Your next recorded progression change will give this curve its second point.</p>'}<details data-section="learning-values"><summary>Read recorded values</summary><table><thead><tr><th>Recorded</th><th>Value</th><th>Level</th></tr></thead><tbody>${samples.map(sample => `<tr><td>${esc(new Date(sample.at).toLocaleString())}</td><td>${fmt(metric === 'respect' ? sample.respect : sample.trades?.[metric])}</td><td>${fmt(sample.level)}</td></tr>`).join('')}</tbody></table></details>`;
    }
    function memoriesMarkup() {
      const me = state().me, board = boards.underworld;
      return list(board?.npcs).map(npc => {
        const memory = list(data().memories).filter(item => item.characterId === me.id && item.npc === npc.id).at(-1);
        const task = board.lead?.npc === npc.id && board.lead?.done ? board.lead.taskLabel : null;
        if (!memory && !task) return '';
        const line = task ? `You handled ${task}. That work is in my book.` : memory.dialogue;
        return `<article class="ux-npc-memory"><img src="/v1/art/npc/${encodeURIComponent(npc.id)}" alt="" loading="lazy"><div><h4>${esc(npc.name)}</h4><blockquote>${esc(line)}</blockquote><small>${task ? 'From your current server lead record.' : `Based on your confirmed dealing recorded ${esc(new Date(memory.at).toLocaleString())}.`}</small></div></article>`;
      }).join('') || '<p>Complete a named NPC’s lead or deal with them to record a specific remembered exchange here.</p>';
    }
    async function refreshFacts() {
      if (request) return request;
      const owner = account, tab = state().currentTab;
      request = Promise.all([read('/v1/map'), read('/v1/events'), read('/v1/megaproject')]).then(replies => {
        if (account !== owner || state().currentTab !== tab) return;
        for (const reply of replies) if (reply.code >= 400) notify('Some city records could not be refreshed. You can try again.', true);
        panelSignature = ''; render();
      }).finally(() => { if (owner === account) request = null; }); return request;
    }
    function render() {
      if (!scope()) { document.body.classList.remove('ux-operation-focus'); return; }
      mountToolbar(); orderPanels();
      const tab = state().currentTab, active = document.getElementById(`tab-${tab}`);
      if (!active || !['map', 'city', 'life', 'profile', 'start'].includes(tab)) return;
      let host = active.querySelector(':scope > .ux-world-panel');
      const signature = JSON.stringify([tab, layer, metric, boards, data()]);
      if (host && signature === panelSignature) return;
      if (host?.contains(document.activeElement) && document.activeElement.matches('input,select,textarea')) return;
      const remembered = disclosures[tab] ||= {};
      host?.querySelectorAll('details[data-section]').forEach(node => { remembered[node.dataset.section] = node.open; });
      if (!host) { host = document.createElement('section'); host.className = 'ux-world-panel'; host.dataset.uxPanel = 'world'; active.append(host); }
      host.innerHTML = `<h3>${['map', 'city'].includes(tab) ? 'The city answers back' : 'Your place in the city'}</h3>${['map', 'city'].includes(tab) ? `<details data-section="layers" open><summary>Public map layers and district signs</summary>${cityMarkup()}</details><details data-section="works"><summary>Public works taking shape</summary>${projectMarkup()}</details>` : ''}${['life', 'profile'].includes(tab) ? `<details data-section="memory"><summary>They remember your dealings</summary>${memoriesMarkup()}</details>` : ''}<details data-section="learning"><summary>Your learning curve</summary>${learningMarkup()}</details>${tab === 'start' || tab === 'city' ? `<details data-section="news"><summary>Read the public headlines</summary>${list(boards.results?.results || boards.results).map(item => `<article class="ux-world-news"><h4>${esc(item.headline)}</h4><p>${esc(item.winnerName || item.winner || '')}</p><button type="button" class="act" data-world-go="${esc(({ boxing: 'boxing', megaproject: 'city', grandprix: 'races', stakes: 'stable', poker: 'den' })[item.kind] || 'city')}">Read the relevant city record</button></article>`).join('') || '<p>No public result headlines are in the current record.</p>'}</details>` : ''}`;
      host.querySelectorAll('details[data-section]').forEach(node => {
        const key = node.dataset.section;
        if (Object.hasOwn(remembered, key)) node.open = remembered[key];
        node.querySelector(':scope > summary')?.addEventListener('click', () => { remembered[key] = !node.open; });
        node.addEventListener('toggle', () => { if (node.isConnected) remembered[key] = node.open; });
      });
      host.querySelector('[data-world-layer]')?.addEventListener('change', event => { layer = event.target.value; event.target.blur(); panelSignature = ''; render(); });
      host.querySelector('[data-world-metric]')?.addEventListener('change', event => { metric = event.target.value; event.target.blur(); panelSignature = ''; render(); });
      host.querySelectorAll('[data-world-go]').forEach(button => button.onclick = () => navigate(button.dataset.worldGo));
      host.querySelectorAll('[data-world-refresh]').forEach(button => button.onclick = refreshFacts);
      panelSignature = signature; orderPanels();
      if (tab !== renderedTab) { renderedTab = tab; if (['map', 'city'].includes(tab) && (!boards.map || !boards.mega)) refreshFacts(); }
    }
    function observe(path, body) {
      if (!scope()) return;
      const route = String(path).split('?')[0];
      if (route === '/v1/map') boards.map = body;
      else if (route === '/v1/events') boards.events = body;
      else if (route === '/v1/megaproject') boards.mega = body;
      else if (route === '/v1/underworld') boards.underworld = body;
      else if (route === '/v1/results') boards.results = body;
      else if (route === '/v1/home') { boards.events = body.cityEvents; boards.results = body.results; }
      else if (/^\/v1\/worldgraph\/mysteries\/[^/]+$/.test(route)) { boards.cases ||= {}; boards.cases[route] = body; }
      if (route === '/v1/me') {
        const me = body.character || body, current = data(), sample = { id: me.id, at: new Date().toISOString(), level: num(me.level), respect: num(me.respect), trades: Object.fromEntries(list(me.trades).map(track => [track.id, num(track.xp)])) };
        const previous = list(current.samples).at(-1);
        if (me.id && (!previous || JSON.stringify([previous.id, previous.level, previous.respect, previous.trades]) !== JSON.stringify([sample.id, sample.level, sample.respect, sample.trades]))) workspace.set('world', { ...current, samples: [...list(current.samples), sample].slice(-200) }, { passive: true });
      }
    }
    function recordOperation(receipt, before, after, result) {
      const body = result?.body;
      if (!scope() || result.code >= 400 || !body?.npc || !body.npcName) return;
      const name = body.npcName, detail = /\/gift$/.test(receipt.path) ? 'You brought an envelope. I remember who came through my door.' : body.standing != null ? `Our last dealing left your standing at ${fmt(body.standing)}. Your work is on the record.` : null;
      if (!detail) return;
      const current = data(); workspace.set('world', { ...current, memories: [...list(current.memories), { characterId: after?.id || state().me.id, npc: body.npc, npcName: name, dialogue: detail, at: receipt.atIso }].slice(-40) });
    }
    workspace?.subscribe(syncStatus);
    for (const event of ['omerta:identity-rendered', 'omerta:ux-panels-changed']) document.addEventListener(event, orderPanels);
    document.addEventListener('omerta:fieldwork-rendered', () => { if (state().currentTab === 'fieldwork') orderPanels(); });
    return { render, observe, recordOperation, afterRender() { orderPanels(); }, projectSvg, curveSvg };
  };
})();
