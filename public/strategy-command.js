/* A read-only city command table. Existing orders keep their original controls. */
(function () {
  'use strict';
  const points = { foundry: [19, 52], cathedral: [32, 41], neon: [61, 22], brick: [37, 71], canal: [51, 61], docks: [79, 41] };
  const modes = [['districts', 'Districts'], ['influence', 'Influence'], ['trade', 'Trade']];
  const descriptions = {
    districts: 'Read the city. Select a district to inspect its control and local advantage.',
    influence: 'Follow the balance of power: family control, garrisons, and active contests.',
    trade: 'Trace the local economy: territory rackets and recorded street deeds.',
  };
  const titles = { open: 'Open territory', occupied: 'Occupied', mine: 'Your family', held: 'Family controlled', contested: 'Contested', unknown: 'Current records unavailable' };
  const text = (node, value) => { const next = String(value ?? ''); if (node && node.textContent !== next) node.textContent = next; };
  const list = value => Array.isArray(value) ? value : [];
  const count = value => value != null && Number.isFinite(Number(value)) ? Number(value).toLocaleString() : 'Not recorded';

  window.createOmertaStrategyCommand = function ({ getState, read, navigate }) {
    let owner = '', epoch = 0, board = null, lastAttempt = 0, lastRead = 0, pending = null, error = '';
    let stage = null, panel = null, selected = '', mode = 'districts', mobileOpen = false;
    let controller = null, rendererHost = null, rendererKey = '', rendering = null, rendererEpoch = 0, rendererFailed = false;
    let labelPoints = {}, destroyed = false;
    const media = matchMedia('(min-width: 1001px)');
    const state = () => getState() || {};
    const scopeKey = () => {
      const current = state();
      return current.me ? `${current.session?.accountId || current.me.accountId || current.me.id || ''}:${current.me.id || ''}` : '';
    };
    const active = () => !destroyed && !!state().me && state().currentTab === 'start';
    const visibleMap = () => active() && (media.matches || stage?.open);
    const districts = () => board ? list(board.districts) : list(state().rules?.districts).map(district => ({ ...district, state: 'unknown', holder: null, occupier: null }));

    function disposeRenderer() {
      rendererEpoch++;
      try { controller?.destroy(); } catch { /* The accessible city controls remain available. */ }
      controller = null; rendererHost = null; rendererKey = ''; rendering = null;
      paintCameraControls();
    }

    function syncOwner() {
      const next = scopeKey();
      if (next === owner) return;
      disposeRenderer(); owner = next; epoch++; board = null; lastAttempt = 0; lastRead = 0; pending = null; error = '';
      selected = state().me?.loc || ''; mode = 'districts'; mobileOpen = false; labelPoints = {}; rendererFailed = false;
      if (stage?.tagName === 'DETAILS') stage.open = false;
    }

    function acceptBoard(value) {
      if (!value || !Array.isArray(value.districts) || !value.districts.every(district => typeof district.id === 'string')) return false;
      board = value; lastRead = Date.now(); error = '';
      return true;
    }

    function readMap() {
      if (!visibleMap() || pending || Date.now() - Math.max(lastAttempt, lastRead) < 30000) return;
      const requestedOwner = owner, requestedEpoch = epoch;
      lastAttempt = Date.now(); error = '';
      const request = Promise.resolve().then(() => read('/v1/map')).then(reply => {
        if (owner !== requestedOwner || epoch !== requestedEpoch) return;
        if (reply.code >= 400 || !acceptBoard(reply.body)) throw new Error('City records could not be refreshed.');
      }).catch(() => {
        if (owner === requestedOwner && epoch === requestedEpoch) error = board ? 'Showing the last city records. Refresh is unavailable.' : 'Live control records are unavailable. District descriptions are from the game rules.';
      }).finally(() => {
        if (owner !== requestedOwner || epoch !== requestedEpoch) return;
        if (pending === request) pending = null;
        if (active()) { paint(); ensureRenderer(); }
      });
      pending = request;
    }

    function createStage(desktop) {
      const root = document.createElement(desktop ? 'section' : 'details');
      root.id = 'strategy-command'; root.className = 'strategy-command'; root.setAttribute('aria-label', 'City command table');
      if (!desktop) {
        const summary = document.createElement('summary'); summary.className = 'strategy-mobile-summary'; summary.textContent = 'City command table'; root.append(summary);
        root.open = mobileOpen;
        root.addEventListener('toggle', () => {
          if (root !== stage) return;
          mobileOpen = root.open;
          if (root.open) { readMap(); paint(); }
        });
      }
      const resources = document.createElement('dl'); resources.className = 'strategy-resource-ribbon'; resources.setAttribute('aria-label', 'Your resources');
      for (const [id, label, icon, hint] of [
        ['cash', 'Cash', '$', 'Cash available to your character'], ['omr', '$OMR', '◈', 'Your liquid $OMR balance'],
        ['respect', 'Respect', '✦', 'Respect earned by your character'], ['energy', 'Energy', 'ϟ', 'Physical work uses energy'],
        ['nerve', 'Nerve', '◇', 'Street crimes use nerve'], ['heat', 'Heat', '♨', 'The attention you have drawn from the law'],
      ]) {
        const item = document.createElement('div'); item.className = 'strategy-resource'; item.dataset.strategyResource = id; item.title = hint;
        item.innerHTML = '<span class="strategy-resource-icon" aria-hidden="true"></span><dt></dt><dd><strong></strong></dd>';
        text(item.querySelector('.strategy-resource-icon'), icon); text(item.querySelector('dt'), label); resources.append(item);
      }
      const overview = document.createElement('header'); overview.className = 'strategy-overview';
      overview.innerHTML = '<div class="strategy-overview-identity"><p class="strategy-overview-kicker"></p><h2>The balance of power</h2></div><dl class="strategy-overview-stats"></dl>';
      for (const [id, label] of [['family', 'Your family'], ['open', 'Open districts'], ['contests', 'Contests']]) {
        const item = document.createElement('div'); item.className = 'strategy-overview-item'; item.dataset.strategyOverview = id;
        item.innerHTML = '<dt></dt><dd><strong></strong></dd>'; text(item.querySelector('dt'), label); overview.querySelector('dl').append(item);
      }
      const map = document.createElement('section'); map.className = 'strategy-map'; map.setAttribute('aria-label', 'Strategic city view');
      map.innerHTML = '<header class="strategy-map-toolbar"><div class="strategy-map-title"><span class="strategy-map-kicker">CITY COMMAND</span><h2>The city</h2></div><div class="strategy-map-modes" role="group" aria-label="Map view"></div></header><div class="strategy-canvas" aria-hidden="true"></div><div class="strategy-map-controls" role="group" aria-label="Map camera"></div><div class="strategy-compass" aria-hidden="true"><svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1"><path d="m16 3 8 13-8 13-8-13Z"/><path d="M16 3v26M3 16h26"/><circle cx="16" cy="16" r="3"/></svg></div><div class="strategy-district-labels" role="group" aria-label="Inspect a district"></div><footer class="strategy-map-footer"><span class="strategy-map-status" role="status" aria-live="polite"></span><span class="strategy-map-context"></span></footer>';
      map.querySelector('.strategy-canvas').style.backgroundImage = 'url("/art/grand-strategy/city-atlas.webp")';
      const guide = document.createElement('div'); guide.className = 'strategy-map-guide';
      guide.innerHTML = '<p class="strategy-mode-description"></p><div class="strategy-map-legend" aria-label="Territory control legend"></div>';
      for (const [id, label] of [['mine', 'Your family'], ['held', 'Other family'], ['occupied', 'Occupied'], ['open', 'Open'], ['contested', 'Contested']]) {
        const item = document.createElement('span'); item.dataset.state = id; item.textContent = label; guide.querySelector('.strategy-map-legend').append(item);
      }
      map.querySelector('.strategy-map-toolbar').after(guide);
      map.querySelector('.strategy-map-modes').addEventListener('keydown', event => {
        if (!event.target.matches('[data-strategy-mode]')) return;
        const buttons = [...map.querySelectorAll('[data-strategy-mode]')], index = buttons.indexOf(event.target);
        const next = keyboardIndex(event.key, index, buttons.length);
        if (next == null) return;
        event.preventDefault(); buttons[next].focus(); buttons[next].click();
      });
      map.querySelector('.strategy-district-labels').addEventListener('keydown', event => {
        if (!event.target.matches('[data-strategy-district]')) return;
        const buttons = [...map.querySelectorAll('[data-strategy-district]')], index = buttons.indexOf(event.target);
        const next = keyboardIndex(event.key, index, buttons.length);
        if (next == null) return;
        event.preventDefault(); buttons[next].focus(); buttons[next].click();
      });
      for (const [id, label, mark] of [['zoomin', 'Zoom in', '+'], ['zoomout', 'Zoom out', '−'], ['reset', 'Reset map view', '⟲']]) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.strategyCamera = id;
        button.setAttribute('aria-label', label); button.title = label; button.textContent = mark; button.disabled = true;
        button.onclick = () => { if (!controller) return; if (id === 'reset') controller.reset?.(); else controller.zoom?.(id === 'zoomin' ? .15 : -.15); };
        map.querySelector('.strategy-map-controls').append(button);
      }
      for (const [id, label] of modes) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.strategyMode = id; button.textContent = label;
        button.onclick = () => { mode = id; paint(); controller?.setMode(id); }; map.querySelector('.strategy-map-modes').append(button);
      }
      const inspector = document.createElement('aside'); inspector.className = 'strategy-inspector'; inspector.setAttribute('aria-label', 'Selected district');
      inspector.innerHTML = '<img class="strategy-district-art" alt=""><div class="strategy-inspector-body"><p class="strategy-inspector-kicker"></p><h3></h3><dl class="strategy-district-facts"></dl><div class="strategy-district-actions"></div></div>';
      const image = inspector.querySelector('img'); image.loading = 'lazy'; image.onerror = () => { image.onerror = null; image.src = '/art/citymap.jpg'; };
      for (const [tab, label] of [['map', 'Explore neighborhood'], ['city', 'Market ledger'], ['streets', 'Street operations'], ['family', 'Family council']]) {
        const button = document.createElement('button'); button.type = 'button'; button.textContent = label; button.dataset.strategyNavigate = tab; button.onclick = () => navigate(tab); inspector.querySelector('.strategy-district-actions').append(button);
      }
      const orders = document.createElement('aside'); orders.className = 'strategy-orders'; orders.setAttribute('aria-label', 'Your next order');
      root.append(resources, overview, map, inspector, orders);
      return root;
    }

    function keyboardIndex(key, index, length) {
      if (!length) return null;
      if (key === 'Home') return 0;
      if (key === 'End') return length - 1;
      if (key === 'ArrowRight' || key === 'ArrowDown') return (index + 1) % length;
      if (key === 'ArrowLeft' || key === 'ArrowUp') return (index + length - 1) % length;
      return null;
    }

    function paintDashboard(values) {
      const me = state().me || {};
      for (const item of stage.querySelectorAll('[data-strategy-resource]')) {
        const key = item.dataset.strategyResource;
        const maximum = key === 'energy' ? me.maxEnergy : key === 'nerve' ? me.maxNerve : null;
        const value = count(me[key]);
        text(item.querySelector('strong'), maximum != null ? `${value} / ${count(maximum)}` : value);
        item.dataset.tone = key === 'heat' && Number(me.heat) >= 60 ? 'caution' : 'normal';
      }
      const district = values.find(value => value.id === me.loc);
      text(stage.querySelector('.strategy-overview-kicker'), [board?.season?.name || 'City command', district?.name].filter(Boolean).join(' · '));
      const overview = { family: board ? `${count(board.mine?.districts)} / ${count(board.total ?? values.length)}` : '—', open: board ? count(values.filter(value => value.state === 'open').length) : '—', contests: board ? count(values.filter(value => value.state === 'contested').length) : '—' };
      for (const item of stage.querySelectorAll('[data-strategy-overview]')) text(item.querySelector('strong'), overview[item.dataset.strategyOverview]);
      text(stage.querySelector('.strategy-mode-description'), descriptions[mode]);
    }

    function paintPowers() {
      const orders = stage.querySelector('.strategy-orders');
      let powers = orders.querySelector('.strategy-powers');
      if (!powers) {
        powers = document.createElement('section'); powers.className = 'strategy-powers'; powers.setAttribute('aria-label', 'Family balance of power');
        powers.innerHTML = '<h3>Families of the city</h3><ol class="strategy-power-list"></ol><p class="strategy-power-empty"></p><button type="button" data-strategy-navigate="family">Open family council</button>';
        powers.querySelector('button').onclick = () => navigate('family'); orders.append(powers);
      }
      const values = list(board?.powers), host = powers.querySelector('ol'), signature = JSON.stringify(values);
      if (host.dataset.signature !== signature) {
        host.replaceChildren();
        values.forEach((family, index) => {
          const row = document.createElement('li'); row.className = 'strategy-power-row'; row.dataset.mine = String(!!family.mine);
          row.innerHTML = '<span class="strategy-power-rank" aria-hidden="true"></span><strong></strong><span class="strategy-power-territory"></span>';
          text(row.querySelector('.strategy-power-rank'), String(index + 1).padStart(2, '0'));
          text(row.querySelector('strong'), [family.tag, family.name].filter(Boolean).join(' · '));
          text(row.querySelector('.strategy-power-territory'), `${count(family.districts)} ${Number(family.districts) === 1 ? 'district' : 'districts'}`);
          if (family.mine) row.querySelector('strong').append(document.createTextNode(' · You'));
          host.append(row);
        });
        host.dataset.signature = signature;
      }
      const empty = powers.querySelector('.strategy-power-empty'); empty.hidden = values.length > 0;
      text(empty, board ? 'No family currently holds a district.' : 'Family standings appear with city records.');
    }

    function mount() {
      const currentPanel = document.getElementById('tab-start');
      if (!currentPanel) return false;
      const desktop = media.matches;
      let root = currentPanel.querySelector(':scope > #strategy-command');
      if (!root || root.tagName !== (desktop ? 'SECTION' : 'DETAILS')) {
        disposeRenderer();
        const firstWeek = root?.querySelector('.start-first-week');
        if (firstWeek) root.before(firstWeek);
        root?.remove(); root = createStage(desktop);
      } else if (panel !== currentPanel || stage !== root) disposeRenderer();
      panel = currentPanel; stage = root;
      const firstWeek = panel.querySelector('.start-first-week'), orders = stage.querySelector('.strategy-orders');
      orders.hidden = !desktop;
      if (desktop) {
        if (panel.firstElementChild !== stage) panel.prepend(stage);
        if (firstWeek && firstWeek.parentElement !== orders) { orders.replaceChildren(); orders.append(firstWeek); }
        else if (!firstWeek) paintOrders(orders);
      } else {
        if (firstWeek?.parentElement === orders) stage.before(firstWeek);
        if (firstWeek) { if (firstWeek.nextElementSibling !== stage) firstWeek.after(stage); }
        else if (!stage.isConnected) panel.append(stage);
      }
      return true;
    }

    function paintOrders(orders) {
      const { me, tabs } = state(), coach = me?.coach;
      const title = coach?.label || 'Choose your next move', hint = coach?.hint || 'Review the work available on the streets and choose an opportunity.';
      let content = orders.querySelector('.strategy-current-order');
      if (!content) {
        content = document.createElement('section'); content.className = 'strategy-current-order'; content.innerHTML = '<p class="strategy-order-kicker">YOUR NEXT ORDER</p><h3></h3><p class="strategy-order-hint"></p><button type="button"></button>'; orders.replaceChildren(content);
      }
      text(content.querySelector('h3'), title); text(content.querySelector('.strategy-order-hint'), hint);
      const target = coach?.tab && tabs?.[coach.tab] ? coach.tab : 'streets', button = content.querySelector('button');
      text(button, `Open ${tabs?.[target] || 'Streets'}`); button.onclick = () => navigate(target);
    }

    function choose(id) {
      if (!districts().some(district => district.id === id)) return;
      selected = id; paint(); controller?.select(id);
    }

    function paintLabels(values) {
      const host = stage.querySelector('.strategy-district-labels'), current = new Map([...host.children].map(button => [button.dataset.strategyDistrict, button]));
      for (const district of values) {
        let button = current.get(district.id);
        if (!button) {
          button = document.createElement('button'); button.type = 'button'; button.dataset.strategyDistrict = district.id;
          button.innerHTML = '<span class="strategy-district-name"></span><small class="strategy-district-state"></small>'; button.onclick = () => choose(district.id); host.append(button);
        }
        current.delete(district.id);
        text(button.querySelector('.strategy-district-name'), district.name || district.id);
        const detail = mode === 'trade' ? district.racket?.typeName || (board ? `${count(district.deeds)} street deeds` : 'District perk')
          : mode === 'influence' ? district.holder?.tag || district.occupier?.name || (board ? 'No family holder' : 'Control unknown')
            : titles[district.state] || 'Control unknown';
        text(button.querySelector('.strategy-district-state'), detail);
        const isSelected = selected === district.id; button.classList.toggle('is-selected', isSelected); button.setAttribute('aria-pressed', String(isSelected)); button.dataset.state = district.state || 'unknown';
        const position = labelPoints[district.id] || points[district.id];
        if (position) { button.style.left = position[0] + '%'; button.style.top = position[1] + '%'; }
      }
      for (const button of current.values()) button.remove();
    }

    function paintInspector(district) {
      const inspector = stage.querySelector('.strategy-inspector'); inspector.hidden = !district;
      if (!district) return;
      const image = inspector.querySelector('img'), source = points[district.id] ? `/art/grand-strategy/district-${district.id}.webp` : '/art/grand-strategy/city-atlas.webp';
      if (image.getAttribute('src') !== source) image.src = source;
      text(inspector.querySelector('.strategy-inspector-kicker'), district.id === state().me?.loc ? 'YOUR CURRENT DISTRICT' : 'DISTRICT INTELLIGENCE');
      text(inspector.querySelector('h3'), district.name || district.id);
      const control = board ? district.holder ? [district.holder.tag, district.holder.name].filter(Boolean).join(' · ') : district.occupier?.name || 'No recorded holder' : 'Current records unavailable';
      const facts = [['Control', control], ['Status', titles[district.state] || district.state || 'Unknown'], ['District perk', typeof district.perk === 'string' ? district.perk : 'No perk description published']];
      if (mode === 'influence' && board) facts.push(['Garrison', count(district.garrison)], ['Contest', district.contest ? `${count(district.contest.families)} families` : 'No active contest']);
      if (mode === 'trade' && board) facts.push(['Local racket', district.racket ? [district.racket.typeName, district.racket.tierName].filter(Boolean).join(' · ') : 'No recorded racket'], ['Street deeds', count(district.deeds)]);
      const dl = inspector.querySelector('dl'), signature = JSON.stringify(facts);
      if (dl.dataset.signature !== signature) {
        dl.replaceChildren();
        for (const [label, value] of facts) { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt, dd); dl.append(row); }
        dl.dataset.signature = signature;
      }
    }

    function paintCameraControls() {
      if (!stage?.isConnected) return;
      const ready = active() && media.matches && !!controller && rendererHost === stage.querySelector('.strategy-canvas');
      for (const button of stage.querySelectorAll('[data-strategy-camera]')) button.disabled = !ready;
    }

    function paint() {
      if (!stage?.isConnected || !active()) return;
      const values = districts();
      if (!values.some(district => district.id === selected)) selected = values.find(district => district.id === state().me?.loc)?.id || values[0]?.id || '';
      stage.dataset.mode = mode;
      for (const button of stage.querySelectorAll('[data-strategy-mode]')) button.setAttribute('aria-pressed', String(button.dataset.strategyMode === mode));
      paintLabels(values); paintInspector(values.find(district => district.id === selected)); paintDashboard(values); paintPowers();
      paintCameraControls();
      const records = error || (pending ? 'Reading city records…' : lastRead ? 'Current city records' : 'District descriptions · live control not loaded');
      text(stage.querySelector('.strategy-map-status'), rendererFailed ? `City map illustration · ${records}` : records);
      const context = [board?.season?.name, board?.mine ? `Your family: ${count(board.mine.districts)} districts` : 'Strategic city view'].filter(Boolean);
      text(stage.querySelector('.strategy-map-context'), context.join(' · '));
    }

    function ensureRenderer() {
      if (!active() || !stage?.isConnected) return;
      const host = stage.querySelector('.strategy-canvas'), values = districts();
      if (rendererFailed) { host.dataset.renderer = 'fallback'; return; }
      if (!media.matches) return;
      if (!values.length) return;
      const key = JSON.stringify(values);
      if ((controller || rendering) && rendererHost === host && rendererKey === key) return;
      disposeRenderer(); rendererHost = host; rendererKey = key;
      const version = rendererEpoch;
      host.dataset.renderer = 'loading';
      const request = import('/vendor/strategy-city-renderer.js?v=20261108-1').then(module => {
        if (version !== rendererEpoch || !active() || !media.matches || !host.isConnected) return null;
        return module.createStrategyMap(host, {
          districts: values, selected,
          onSelect: id => { if (version === rendererEpoch) choose(id); },
          onLabels: labels => {
            if (version !== rendererEpoch || !host.isConnected) return;
            for (const item of list(labels)) if (Number.isFinite(item.x) && Number.isFinite(item.y)) labelPoints[item.id] = [Math.max(0, Math.min(100, item.x)), Math.max(0, Math.min(100, item.y))];
            if (stage?.isConnected) paintLabels(districts());
          },
        });
      }).then(value => {
        if (!value) return;
        if (version !== rendererEpoch || !active() || !media.matches || !host.isConnected) { value.destroy?.(); return; }
        controller = value; host.dataset.renderer = 'ready'; controller.setMode(mode); paintCameraControls();
      }).catch(() => {
        if (version !== rendererEpoch) return;
        rendererFailed = true; host.dataset.renderer = 'fallback';
        paint();
      }).finally(() => { if (rendering === request) rendering = null; });
      rendering = request;
    }

    function render() {
      if (destroyed) return;
      syncOwner();
      if (!active()) { disposeRenderer(); return; }
      if (!mount()) return;
      readMap(); paint(); ensureRenderer();
    }
    const onResize = () => { render(); controller?.resize(); };
    media.addEventListener('change', onResize);
    return {
      render, afterRender: render,
      beforeRender() { if (!active()) disposeRenderer(); },
      observe(path, value) { syncOwner(); if (path === '/v1/map' && acceptBoard(value) && active()) { paint(); ensureRenderer(); } },
      destroy() { destroyed = true; epoch++; disposeRenderer(); media.removeEventListener('change', onResize); },
    };
  };
})();
