/* A quieter presentation of the existing city. All moves keep their issued controls. */
(function () {
  'use strict';

  const screens = {
    start: ['Overview', 'Your next move, the work in progress, and the city around you.'],
    business: ['Business desk', 'Review your businesses, production, and the work in progress.'],
    world: ['World affairs', 'Follow the wider city and the opportunities taking shape.'],
    profile: ['Your profile', 'Your identity, bloodline, and the reputation you are building.'],
    streets: ['Streets', 'Choose a job. Watch your nerve, your take, and your heat.'],
    pvp: ['Rivals', 'Read the target, the protections, and the stakes before you move.'],
    kitchen: ['The kitchen', 'Manage your batches, your product, and your next deal.'],
    family: ['Family', 'Your organization, its people, and the business you share.'],
    map: ['The city', 'Explore the neighborhoods and find your next opportunity.'],
    deeds: ['Property', 'Find a place in the city and review its ownership records.'],
    crew: ['Your crew', 'Find your people and coordinate the work ahead.'],
    discover: ['People', 'Find players, make connections, and bring people into the city.'],
    market: ['Black market', 'Browse the trade and review the terms before making an offer.'],
    garage: ['The garage', 'Your vehicles, equipment, and the work on the bench.'],
    empire: ['Your empire', 'Build your operations and keep the business running.'],
    speakeasy: ['The speakeasy', 'A seat at the bar and a different side of the city.'],
    boxing: ['The boxing ring', 'Train your fighter and read the card before the bell.'],
    races: ['Street races', 'Prepare your car and choose your race.'],
    stable: ['The stable', 'Your stable, its training, and the next stakes.'],
    scores: ['Big scores', 'Review the crew, requirements, and stakes of a bigger job.'],
    loans: ['Credit', 'Read the terms of every loan and keep track of your obligations.'],
    portfolio: ['The capital desk', 'Your financial accounts and the terms of each opportunity.'],
    estate: ['Your estate', 'Review the assets and legacy you are putting aside.'],
    life: ['Your character', 'Train your skills and choose how to make your name.'],
    pen: ['The penitentiary', 'Your sentence, your options, and the way forward.'],
    law: ['The law', 'Keep track of your heat and the case against you.'],
    wire: ['Intelligence', 'Read what you know and review the cost of learning more.'],
    store: ['The store', 'Review the available offers and their terms.'],
    city: ['Districts', 'Compare neighborhoods and plan your next stop.'],
    den: ['The gambling den', 'Choose a table and read the stakes before you sit down.'],
    port: ['The port', 'Your fleet, freight, and the business along the waterfront.'],
    desk: ['The case desk', 'Follow the evidence and pick up the work you left unfinished.'],
    fieldwork: ['Quest journal', 'Your cases, discoveries, and the leads you are following.'],
    deck: ['Developer tools', 'Inspect the records and responses behind your current session.'],
  };
  const primary = [
    ['start', 'Overview', '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'],
    ['streets', 'Streets', '<path d="m8 3-4 18m12-18 4 18M12 3v4m0 3v4m0 3v4"/>'],
    ['map', 'City', '<path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3V6Zm6-3v15m6-12v15"/>'],
    ['family', 'Family', '<circle cx="9" cy="8" r="3"/><path d="M3 21v-3a6 6 0 0 1 12 0v3m2-16a3 3 0 0 1 0 6m4 10v-3a6 6 0 0 0-3-5"/>'],
    ['empire', 'Empire', '<path d="M4 21V9h7v12m0-16h9v16M2 21h20M7 12v1m0 3v1m8-9v1m3-1v1m-3 3v1m3-1v1m-3 3v1m3-1v1"/>'],
  ];
  const sectionTabs = {
    start: ['start', 'profile', 'estate', 'store', 'deck'],
    streets: ['streets', 'garage', 'life', 'pvp', 'law', 'pen', 'wire', 'den', 'speakeasy', 'boxing', 'races', 'stable'],
    map: ['map', 'city', 'world', 'deeds', 'discover', 'desk', 'fieldwork'],
    family: ['family', 'crew'],
    empire: ['empire', 'business', 'kitchen', 'scores', 'market', 'port', 'portfolio', 'loans'],
  };
  const optional = '.ux-progression[data-ux-progression],.ux-story[data-ux-story],.ux-world-panel,.ux-identity,.ux-community[data-community-host],#ux-coordination,[data-investigation-ux]';
  const nativeOptional = 'details.ux-tactics[data-ux-tactics],details.ux-context-rules,details[data-investigation-ux]';
  const protectedContent = '[data-do],[data-operation-primary],.operation-action-terms,.operation-choice-terms,.operation-receipt,[data-operation-retry],[data-operation-tab]';
  const words = value => String(value ?? '').replace(/[_-]+/g, ' ').replace(/\b\w/g, letter => letter.toUpperCase());
  const number = value => value !== null && value !== '' && Number.isFinite(Number(value)) ? Number(value).toLocaleString() : '';
  const text = (element, value) => { if (element && element.textContent !== String(value)) element.textContent = value; };

  window.createOmertaNoirShell = function ({ getState, navigate, workspace }) {
    let owner = '', localPanels = {}, localNative = {}, observer = null, watched = null, timer = null, sequence = 0;
    let receipt = null, coachObserver = null, watchedCoach = null, receiptTimer = null;
    const nativePanels = new WeakMap();
    const state = () => getState() || {};
    const account = () => String(state().session?.accountId || state().me?.accountId || state().me?.id || '');
    const localKey = () => `omerta_noir_panels:${owner}`;
    const layout = () => workspace?.get('layout', {}) || {};
    const panelChoices = () => ({ ...localPanels, ...layout().noirPanels });
    const nativeChoices = () => ({ ...localNative, ...layout().noirNativePanels });

    function syncOwner() {
      const next = account();
      if (next === owner) return;
      owner = next; localPanels = {}; localNative = {}; receipt = null;
      try { localPanels = JSON.parse(localStorage.getItem(localKey()) || '{}') || {}; } catch { /* Browser storage is optional. */ }
      try { localNative = JSON.parse(localStorage.getItem(`omerta_noir_native:${owner}`) || '{}') || {}; } catch { /* Browser storage is optional. */ }
    }

    function savePanel(key, open) {
      localPanels = { ...panelChoices(), [key]: open };
      try { localStorage.setItem(localKey(), JSON.stringify(localPanels)); } catch { /* Browser storage is optional. */ }
      workspace?.set('layout', { ...layout(), noirPanels: localPanels }, { label: open ? 'Open an optional panel' : 'Close an optional panel' });
    }

    function saveNative(key, open) {
      localNative = { ...nativeChoices(), [key]: open };
      try { localStorage.setItem(`omerta_noir_native:${owner}`, JSON.stringify(localNative)); } catch { /* Browser storage is optional. */ }
      workspace?.set('layout', { ...layout(), noirNativePanels: localNative }, { label: open ? 'Open an optional tool' : 'Close an optional tool' });
    }

    function mountNavigation() {
      const sidebar = document.getElementById('city-sidebar');
      if (!sidebar) return;
      let nav = document.getElementById('noir-primary-nav');
      if (!nav) {
        nav = document.createElement('nav'); nav.id = 'noir-primary-nav'; nav.className = 'noir-primary-nav'; nav.setAttribute('aria-label', 'Main destinations');
        const label = document.createElement('div'); label.className = 'noir-nav-label'; label.textContent = 'THE CITY'; nav.append(label);
        for (const [id, label, paths] of primary) {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'noir-nav-item'; button.dataset.noirTab = id;
          button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg><span>${label}</span><span class="noir-nav-arrow" aria-hidden="true">›</span>`;
          button.onclick = () => navigate(id); nav.append(button);
        }
        sidebar.prepend(nav);
      }
      const tab = state().currentTab;
      const current = Object.keys(sectionTabs).find(id => sectionTabs[id].includes(tab));
      for (const button of nav.querySelectorAll('[data-noir-tab]')) {
        const active = button.dataset.noirTab === current;
        button.classList.toggle('is-active', active);
        if (active) button.setAttribute('aria-current', 'page'); else button.removeAttribute('aria-current');
      }
    }

    function renderPlayer() {
      const sidebar = document.getElementById('city-sidebar'), me = state().me;
      if (!sidebar || !me) return;
      let card = document.getElementById('noir-player-card');
      if (!card) {
        card = document.createElement('section'); card.id = 'noir-player-card'; card.className = 'noir-player-card'; card.setAttribute('aria-label', 'Your character');
        card.innerHTML = '<div class="noir-player-identity"><span class="noir-avatar" aria-hidden="true"></span><div><div class="noir-player-name"></div><div class="noir-player-meta"></div></div></div><div class="noir-player-location"></div><dl class="noir-player-stats"><div class="noir-player-stat" data-noir-stat="health"><dt>Health</dt><dd></dd></div><div class="noir-player-stat" data-noir-stat="energy"><dt>Energy</dt><dd></dd></div><div class="noir-player-stat" data-noir-stat="nerve"><dt>Nerve</dt><dd></dd></div></dl><div class="noir-player-status"></div>';
        sidebar.append(card);
      }
      const avatar = card.querySelector('.noir-avatar');
      if (me.id) {
        let portrait = avatar.querySelector('img');
        if (!portrait) { portrait = document.createElement('img'); portrait.alt = ''; portrait.width = 52; portrait.height = 66; avatar.replaceChildren(portrait); }
        const source = `/v1/avatar/${encodeURIComponent(me.id)}`;
        if (portrait.getAttribute('src') !== source) portrait.src = source;
      } else text(avatar, Array.from(String(me.name || '')).slice(0, 1).join('').toUpperCase());
      text(card.querySelector('.noir-player-name'), me.name || '');
      text(card.querySelector('.noir-player-meta'), [number(me.level) ? `Level ${number(me.level)}` : '', number(me.generation) ? `Generation ${number(me.generation)}` : ''].filter(Boolean).join(' · '));
      text(card.querySelector('.noir-player-location'), words(me.loc));
      for (const [key, max] of [['health', 'maxHealth'], ['energy', 'maxEnergy'], ['nerve', 'maxNerve']]) {
        const row = card.querySelector(`[data-noir-stat="${key}"]`), current = number(me[key]), limit = number(me[max]);
        row.hidden = !current;
        text(row.querySelector('dd'), current + (limit ? ` / ${limit}` : ''));
      }
      text(card.querySelector('.noir-player-status'), number(me.heat) ? `Heat ${number(me.heat)}` : '');
    }

    function renderHeading() {
      const panel = document.getElementById('tabpanel');
      if (!panel) return;
      let heading = document.getElementById('noir-screen-heading');
      if (!heading) {
        heading = document.createElement('header'); heading.id = 'noir-screen-heading'; heading.className = 'noir-screen-heading';
        heading.innerHTML = '<div class="noir-screen-kicker"></div><div class="noir-heading-row"><h2></h2><a class="noir-codex-link" href="/wiki" target="_blank" rel="noopener">The Codex <span aria-hidden="true">↗</span></a></div><p class="noir-screen-description"></p>';
        panel.prepend(heading);
      }
      const { currentTab, me, tabs } = state(), screen = screens[currentTab];
      const section = primary.find(([id]) => sectionTabs[id].includes(currentTab));
      text(heading.querySelector('.noir-screen-kicker'), [section?.[1], words(me?.loc)].filter(Boolean).join(' / '));
      text(heading.querySelector('h2'), screen?.[0] || tabs?.[currentTab] || words(currentTab));
      text(heading.querySelector('.noir-screen-description'), screen?.[1] || '');
    }

    function renderReceipt() {
      syncOwner();
      if (!state().me) return;
      const latest = document.getElementById('operation-latest');
      const result = latest?.querySelector('[data-operation-receipt]');
      if (!result) return;
      const id = result.dataset.operationReceipt;
      if (!receipt || receipt.owner !== owner || receipt.id !== id) receipt = { owner, id, tab: state().currentTab, open: false };
      let disclosure = latest.parentElement?.matches('details.noir-previous-result') ? latest.parentElement : null;
      if (state().currentTab === receipt.tab) {
        if (disclosure) disclosure.replaceWith(latest);
        return;
      }
      if (!disclosure) {
        disclosure = document.createElement('details'); disclosure.className = 'noir-previous-result';
        const summary = document.createElement('summary'); summary.textContent = 'Last operation · View result';
        disclosure.append(summary); disclosure.open = receipt.open;
        latest.before(disclosure); disclosure.append(latest);
        const current = receipt;
        disclosure.addEventListener('toggle', () => {
          if (disclosure.isConnected && receipt === current && current.owner === owner) current.open = disclosure.open;
        });
      }
    }

    function watchCoach() {
      const coach = document.getElementById('coachwrap');
      if (!coach || watchedCoach === coach) return;
      coachObserver?.disconnect(); watchedCoach = coach;
      coachObserver = new MutationObserver(() => {
        if (receiptTimer) return;
        receiptTimer = setTimeout(() => { receiptTimer = null; renderReceipt(); }, 16);
      });
      coachObserver.observe(coach, { childList: true, subtree: true });
    }

    function placeIntroduction() {
      const bodies = document.getElementById('tabbodies'), intro = document.getElementById('introwrap');
      if (intro?.parentElement === bodies && bodies.lastElementChild !== intro && !intro.contains(document.activeElement)) bodies.append(intro);
    }

    function foldKey(root) {
      const type = root.hasAttribute('data-ux-tactics') ? 'tactics'
        : root.classList.contains('ux-context-rules') ? 'screen-rules'
        : root.dataset.uxProgression ? `progression:${root.dataset.uxProgression}`
        : root.dataset.uxStory ? `story:${root.dataset.uxStory}`
        : root.dataset.investigationUx ? `investigation:${root.dataset.investigationUx}`
        : root.id || root.dataset.uxPanel || root.classList.item(0);
      return `${state().currentTab}:${type}`;
    }

    function foldNative(panel) {
      const choices = nativeChoices();
      for (const root of panel.querySelectorAll(nativeOptional)) {
        if (root.parentElement?.closest(optional) || root.querySelector(protectedContent)) continue;
        const key = foldKey(root), saved = typeof choices[key] === 'boolean' ? choices[key] : undefined;
        let record = nativePanels.get(root);
        if (!record) {
          record = { owner: '', key, saved: undefined, suppress: null };
          nativePanels.set(root, record);
          root.addEventListener('toggle', () => {
            if (!root.isConnected || record.owner !== owner) return;
            if (record.suppress !== null && record.suppress === root.open) { record.suppress = null; return; }
            record.suppress = null;
            record.saved = root.open;
            saveNative(record.key, root.open);
          });
        }
        const firstVisit = record.owner !== owner;
        const hydratedChoice = saved !== undefined && saved !== record.saved;
        if (!firstVisit && !hydratedChoice) continue;
        record.owner = owner; record.key = key; record.saved = saved;
        const open = saved === true;
        // Initialize a native disclosure once. Later renders and reading-state restoration
        // keep the player's current choice; a newly hydrated explicit choice can still apply.
        if (root.open !== open && !root.contains(document.activeElement)) {
          record.suppress = open;
          root.open = open;
        }
      }
    }

    function setFold(root, open, button) {
      const value = String(open);
      if (root.dataset.noirOpen !== value) root.dataset.noirOpen = value;
      if (button.getAttribute('aria-expanded') !== value) button.setAttribute('aria-expanded', value);
    }

    function orderSupplementary(panel) {
      const saved = layout().order?.[state().currentTab];
      const customOrder = Array.isArray(saved) ? saved : saved?.root;
      // An explicitly arranged workspace keeps its chosen panel order.
      if (Array.isArray(customOrder) && customOrder.length) return;
      const children = [...panel.children];
      const tools = children.filter(root => root.matches(`${optional},${nativeOptional}`)
        && !root.querySelector(`${protectedContent},[role="alert"],[aria-invalid="true"],[aria-live="assertive"]`));
      if (!tools.length || tools.some(root => root.contains(document.activeElement))) return;
      const tail = children.slice(-tools.length);
      if (tools.every((root, index) => tail[index] === root)) return;
      // Keep every helper under its original parent; modules rely on direct-child lookups.
      // Comparing the complete tail makes observer-driven passes settle without more moves.
      for (const root of tools) panel.append(root);
    }

    function foldPanels() {
      syncOwner();
      if (!state().me) return;
      const panel = document.getElementById(`tab-${state().currentTab}`);
      if (!panel) return;
      foldNative(panel);
      const choices = panelChoices();
      for (const root of panel.querySelectorAll(optional)) {
        if (root.parentElement?.closest(optional)) continue;
        if (root.querySelector(protectedContent)) {
          root.classList.remove('noir-foldable');
          delete root.dataset.noirOpen;
          root.querySelector(':scope > .noir-panel-toggle')?.remove();
          continue;
        }
        if (root.tagName === 'DETAILS') {
          // Native disclosures use their summary and retain their own DOM placement.
          continue;
        }
        const key = foldKey(root);
        let button = root.querySelector(':scope > .noir-panel-toggle');
        const title = root.querySelector('h2,h3,header strong')?.textContent.trim()
          || (root.dataset.investigationUx ? `${words(root.dataset.investigationUx)} tools` : 'More about your character');
        if (!button) {
          button = document.createElement('button'); button.type = 'button'; button.className = 'noir-panel-toggle';
          const label = document.createElement('span'); label.className = 'noir-panel-title';
          const chevron = document.createElement('span'); chevron.className = 'noir-panel-chevron'; chevron.textContent = '+'; chevron.setAttribute('aria-hidden', 'true');
          button.append(label, chevron); root.prepend(button);
          button.onclick = () => { const open = root.dataset.noirOpen !== 'true'; savePanel(key, open); setFold(root, open, button); };
        }
        root.classList.add('noir-foldable'); root.dataset.noirPanelKey = key;
        text(button.querySelector('.noir-panel-title'), title);
        const controlled = [...root.children].filter(child => child !== button && !child.classList.contains('ux-panel-handle'));
        for (const child of controlled) if (!child.id) child.id = `noir-panel-content-${++sequence}`;
        const controls = controlled.map(child => child.id).join(' ');
        if (button.getAttribute('aria-controls') !== controls) button.setAttribute('aria-controls', controls);
        const editing = root.contains(document.activeElement) && document.activeElement !== button;
        const invalid = !!root.querySelector('[role="alert"],[aria-invalid="true"],[aria-live="assertive"]');
        setFold(root, editing || invalid || choices[key] === true, button);
      }
      orderSupplementary(panel);
    }

    function watchPanels() {
      const bodies = document.getElementById('tabbodies');
      if (!bodies || watched === bodies) return;
      observer?.disconnect(); watched = bodies;
      observer = new MutationObserver(records => {
        const external = records.some(record => [...record.addedNodes, ...record.removedNodes].some(node => node.nodeType === 1 && !node.classList.contains('noir-panel-toggle') && !node.closest('.noir-panel-toggle')));
        if (!external || timer) return;
        timer = setTimeout(() => { timer = null; foldPanels(); }, 32);
      });
      observer.observe(bodies, { childList: true, subtree: true });
    }

    function render() {
      syncOwner();
      if (!state().me) return;
      mountNavigation(); renderPlayer(); renderHeading(); renderReceipt(); foldPanels(); placeIntroduction(); watchPanels(); watchCoach();
    }

    return {
      render,
      beforeRender: renderReceipt,
      afterRender: render,
      reloadWorkspace: render,
      recordOperation(value) {
        syncOwner();
        receipt = { owner, id: String(value.id), tab: state().currentTab, open: false };
        renderReceipt();
      },
      destroy() { observer?.disconnect(); coachObserver?.disconnect(); clearTimeout(timer); clearTimeout(receiptTimer); },
    };
  };
})();
