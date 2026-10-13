/* In-world tools use confirmed player data and the host's guarded API callbacks. */
(function () {
  'use strict';
  const PANELS = [['map', 'Map'], ['bag', 'Bag'], ['skills', 'Skills'], ['adventures', 'Adventures'], ['room', 'Hideout'], ['style', 'Style'], ['chat', 'Nearby chat']];
  const VOICES = {
    fixer: ['THE FIXER', 'Every job carries a risk. Check your nerve before you step out.'],
    training: ['THE TRAINER', 'Pick a skill. Put in the work. Catch your breath between sessions.'],
    workshop: ['THE MECHANIC', 'Good equipment earns its place. Check what you are carrying.'],
    clubhouse: ['THE DOORMAN', 'Your crew’s next move starts with a conversation.'],
    stories: ['THE EDITOR', 'A clue is a lead. Follow it, then compare what you find.'],
    waterfront: ['THE FERRYMAN', 'Check the travel board before you leave the district.']
  };
  const PATROLS = [
    [{ x: 875, y: 398 }, { x: 915, y: 398 }, { x: 915, y: 370 }, { x: 875, y: 370 }],
    [{ x: 322, y: 280 }, { x: 384, y: 280 }, { x: 384, y: 260 }, { x: 322, y: 260 }]
  ];
  function ambientPose(index, time) {
    const points = PATROLS[index % PATROLS.length], span = 4500;
    const step = Math.floor(Math.max(0, time) / span), start = points[step % points.length], end = points[(step + 1) % points.length];
    const fraction = Math.min(1, Math.max(0, (time % span - 900) / 3300));
    return { x: start.x + (end.x - start.x) * fraction, y: start.y + (end.y - start.y) * fraction };
  }
  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = String(text);
    return node;
  }
  function list(value, max = 64) { return Array.isArray(value) ? value.slice(0, max) : []; }
  function number(value) { const n = Number(value); return Number.isFinite(n) ? n : 0; }
  function caption(value) { return String(value || '').replace(/[_-]/g, ' '); }
  function mount(root, input) {
    let options = { ...input }, destroyed = false, panel = '', opening = 0, readTickets = Object.create(null), readPending = Object.create(null), pending = false, pollTimer = null;
    let boards = Object.create(null), notice = '', lastFrame = null, lastMapPaint = 0, lastSpeech = '', speechUntil = 0, lastChatId = '', lastChatAt = 0, renderedOpening = -1, choicesShown = false;
    let mapView = 'neighborhood', selectedDistrict = '', selectedHome = '', homeDistrict = '', homeRows = [], homeCursor = null, homeTotal = 0, pinnedHome = null, lastHomesInput = null, lastHomesHydration = null, homePaged = false, localHomesBoard = null, localHomesPaged = false;
    const listeners = [], renderListeners = [];
    const identity = () => [String(options.scopeKey || ''), options.character?.id, options.character?.generation, options.district?.id].join(':');
    let scope = identity(), lastCharacter = { ...options.character, stats: { ...options.character?.stats } };
    const toolbar = el('div', 'city-world__toolbar');
    const tools = el('button', 'city-world__tools', 'World tools ▾'); tools.type = 'button'; tools.dataset.cityWorldTools = '';
    const tracker = el('button', 'city-world__tracker'); tracker.type = 'button'; tracker.dataset.cityObjectiveTracker = '';
    const gains = el('span', 'city-world__gains'); gains.setAttribute('role', 'status'); gains.setAttribute('aria-live', 'polite');
    const dialogue = el('span', 'city-world__dialogue'); dialogue.hidden = true; dialogue.setAttribute('role', 'status');
    toolbar.append(tools, tracker, gains, dialogue);
    (options.toolbar || root).append(toolbar);
    if (options.toolsHost) { options.toolsHost.append(tools); tools.textContent = String(options.toolsLabel || 'World tools'); tools.setAttribute('aria-label', 'Open world tools: map, bag, skills, adventures, hideout, style and nearby chat'); }
    if (options.trackerHost) options.trackerHost.append(tracker);
    const dock = el('section', 'city-world__dock'); dock.hidden = true; dock.setAttribute('aria-label', 'World tools');
    const bar = el('div', 'city-world__dock-bar');
    const back = el('button', 'city-world__back', 'Tools ↑'); back.type = 'button'; back.dataset.cityWorldBack = ''; back.setAttribute('aria-label', 'Back to world tool choices');
    const title = el('strong', '', 'World tools');
    const closeButton = el('button', 'city-world__close', '×'); closeButton.type = 'button'; closeButton.dataset.cityWorldClose = ''; closeButton.setAttribute('aria-label', 'Close world tools');
    bar.append(back, title, closeButton);
    const navigation = el('nav', 'city-world__tabs'); navigation.setAttribute('aria-label', 'World tool panels');
    const tabs = new Map();
    for (const [id, label] of PANELS) {
      const button = el('button', '', label); button.type = 'button'; button.dataset.cityWorldPanel = id; button.setAttribute('aria-pressed', 'false');
      tabs.set(id, button); navigation.append(button);
    }
    const content = el('div', 'city-world__content'); content.tabIndex = -1;
    const state = el('p', 'city-world__notice'); state.setAttribute('role', 'status'); state.setAttribute('aria-live', 'polite');
    const receiptBox = el('section', 'city-world__receipt'); receiptBox.setAttribute('aria-label', 'World action receipt');
    dock.append(bar, navigation, content, state, receiptBox); (options.viewport || root).append(dock);
    const speech = el('div', 'city-world__speech'); speech.hidden = true; speech.setAttribute('role', 'status'); speech.setAttribute('aria-live', 'polite');
    (options.mapLayer || root).append(speech);
    const on = (target, name, handler) => { target.addEventListener(name, handler); listeners.push(() => target.removeEventListener(name, handler)); };
    const onRender = (target, name, handler) => { target.addEventListener(name, handler); renderListeners.push(() => target.removeEventListener(name, handler)); };
    function clearRenderedListeners() { renderListeners.splice(0).forEach(remove => remove()); }
    function button(label, action, className) {
      const node = el('button', className, label); node.type = 'button'; node.dataset.worldControl = label; onRender(node, 'click', action); return node;
    }
    function changed() { if (typeof options.onPanelChange === 'function') options.onPanelChange(); }
    const compactTools = () => window.innerWidth <= 680 && document.body.classList.contains('city-player-view');
    function paintChoices() {
      navigation.hidden = compactTools() && !choicesShown;
      back.setAttribute('aria-expanded', String(!navigation.hidden));
      if (navigation.hidden && navigation.contains(document.activeElement)) back.focus({ preventScroll: true });
    }
    function revealChoices() {
      choicesShown = true; paintChoices(); dock.scrollTo({ top: 0, behavior: 'instant' });
      changed(); tabs.values().next().value.focus({ preventScroll: true });
    }
    function setNotice(value) { notice = String(value || ''); paintReadState(); }
    function current(token, owner) { return !destroyed && token === opening && owner === scope && owner === identity(); }
    function paintReadState() {
      let kinds = [];
      if (panel === 'bag') kinds = ['inventory'];
      else if (['room', 'style'].includes(panel)) kinds = ['social'];
      else if (panel === 'chat') kinds = ['social', 'chat'];
      else if (panel === 'map' && mapView === 'world') kinds = ['atlas', 'collection', 'homes'];
      const missing = panel === 'chat' ? !Object.hasOwn(boards, 'social') || (socialPreferences().chatEnabled === true && !Object.hasOwn(boards, 'chat'))
        : kinds.some(kind => kind === 'homes' ? selectedDistrict && homeDistrict !== selectedDistrict : !Object.hasOwn(boards, kind));
      const loading = !!(missing && kinds.some(kind => {
        const marker = readPending[kind];
        return marker && current(marker.token, marker.owner) && marker.ticket === readTickets[kind];
      }));
      const label = PANELS.find(([id]) => id === panel)?.[1] || 'World tools';
      const heading = label + (loading ? ' · Loading…' : ''), busy = String(loading), copy = notice || (loading ? 'Loading ' + label + '…' : '');
      const altered = title.textContent !== heading || content.getAttribute('aria-busy') !== busy || state.textContent !== copy;
      if (title.textContent !== heading) title.textContent = heading;
      if (content.getAttribute('aria-busy') !== busy) content.setAttribute('aria-busy', busy);
      if (state.textContent !== copy) state.textContent = copy;
      return altered;
    }
    function resultBody(result) { return result?.body && typeof result.body === 'object' ? result.body : {}; }
    async function read(kind, token = opening, input = {}) {
      if (typeof options.onRead !== 'function') return null;
      const owner = scope, socialAtStart = boards.social, ticket = (readTickets[kind] || 0) + 1; readTickets[kind] = ticket;
      const marker = { token, owner, ticket, ...input }; readPending[kind] = marker;
      if (panel && paintReadState()) changed();
      try {
        const result = await options.onRead(kind, { ...input, isCurrent: () => !destroyed && owner === scope && owner === identity()
          && (!['atlas', 'collection', 'homes'].includes(kind) || current(token, owner) && ticket === readTickets[kind] && panel === 'map' && mapView === 'world')
          && (kind !== 'homes' || selectedDistrict === input.districtId) });
        if (!current(token, owner) || ticket !== readTickets[kind] || result?.ignored
          || kind === 'homes' && (mapView !== 'world' || selectedDistrict !== input.districtId)) return null;
        if (!result || result.code >= 400) {
          if (kind === 'opportunity-detail' && ['city_npc_unavailable','city_npc_binding_changed','city_opportunity_unavailable'].includes(result?.body?.error)) {
            delete boards['opportunity-detail']; setNotice('This person or lead changed. Choose a current district opportunity.'); render(); read('opportunities',token); return null;
          }
          if (kind === 'chat' && result?.code === 403 && result.body?.error === 'city_chat_opt_in_required') {
            if (boards.social === socialAtStart) {
              boards.social = { ...boards.social, preferences: { ...socialPreferences(), chatEnabled: false } };
              delete boards.chat; options.chat = null; stopPolling(); clearSpeech();
            }
            setNotice('Nearby chat membership changed. Refreshing your current choice…'); render();
            read('social', token);
          } else setNotice('Could not refresh this panel. Your character has not changed. Try again.');
          return null;
        }
        if (kind === 'chat' && socialPreferences().chatEnabled !== true) { delete boards.chat; return null; }
        if (kind === 'homes') {
          if (resultBody(result).districtId !== input.districtId || !acceptHomes(resultBody(result), input.cursor)) return null;
        } else boards[kind] = resultBody(result);
        if(kind==='opportunities'&&boards['opportunity-detail']&&!list(boards.opportunities.npcs,12).some(npc=>npc.id===boards['opportunity-detail'].npc.id&&npc.generation===boards['opportunity-detail'].npc.generation))delete boards['opportunity-detail'];
        if (kind === 'atlas' && panel === 'map' && mapView === 'world') {
          if (!atlasDistricts().some(district => district.id === selectedDistrict)) selectedDistrict = actualDistrict();
          if (atlasDistricts().some(district => district.id === selectedDistrict) && !readPending.homes) readHomes();
        }
        if (kind === 'social') {
          options.onLook?.(socialPreferences().outfit || 'classic');
          if (socialPreferences().chatEnabled !== true) { delete boards.chat; options.chat = null; readTickets.chat = (readTickets.chat || 0) + 1; stopPolling(); clearSpeech(); lastChatId = ''; lastChatAt = 0; }
          else { startPolling(); if (panel === 'chat') read('chat', token); }
        }
        if (kind === 'chat') {
          const latest = list(boards.chat.messages, 50).at(-1);
          if (latest) showChatMessage(latest);
        }
        render(); return boards[kind];
      } catch { if (current(token, owner) && ticket === readTickets[kind]) setNotice('Could not refresh this panel. Try again.'); return null; }
      finally {
        if (current(token, owner) && readPending[kind] === marker) {
          delete readPending[kind]; if (panel && paintReadState()) changed();
        }
      }
    }
    async function action(kind, payload) {
      if (pending || destroyed || !panel || typeof options.onAction !== 'function') return;
      if (options.recovery === true) { setNotice('Resolve your pending action receipt before making another choice.'); return; }
      const owner = scope, token = opening;
      const opportunityAtStart=boards['opportunity-detail'], homeAtStart=boards['home-interior'];
      pending = true; setNotice('Confirming your choice…'); render();
      try {
        const result = await options.onAction(kind, payload, {
          beforeDispatch: () => current(token, owner) && !!panel,
          isCurrent: () => !destroyed && owner === scope && owner === identity()
          ,onResult: result => {
            if(destroyed||owner!==scope||owner!==identity())return;
            if(kind==='home-action'&&result?.code<400&&result.body?.kind==='home_leave') {
              const currentHome=boards['home-interior'], grantId=result.body.effect?.grantId;
              if(currentHome?.home?.key===result.body.homeKey&&(currentHome.actions||[]).some(action=>action.path==='/v1/city/home/visitors/leave'&&action.body?.grantId===grantId)) {
                delete boards['home-interior'];setNotice('Your visitor consent is withdrawn.');if(panel)render();
              }
            }
            if(kind==='adventure-action'&&boards['opportunity-detail']===opportunityAtStart&&['city_npc_unavailable','city_npc_binding_changed','city_opportunity_unavailable'].includes(result?.body?.error)) {
              delete boards['opportunity-detail'];setNotice('This person or lead changed. Choose a current district opportunity.');if(panel)render();
            }
            if(kind==='home-action'&&boards['home-interior']===homeAtStart&&result?.body?.error==='home_authority_changed') {
              delete boards['home-interior'];setNotice('The deed changed. Refresh before entering this home.');if(panel)render();
            }
          }
        });
        if (destroyed || owner !== scope || owner !== identity() || result?.ignored) return;
        if (result?.code >= 400) {
          if(kind==='adventure-action'&&['city_npc_unavailable','city_npc_binding_changed','city_opportunity_unavailable'].includes(resultBody(result).error)) {
            if(boards['opportunity-detail']===opportunityAtStart)delete boards['opportunity-detail']; if(current(token,owner))await read('opportunities',token);
          }
          if (current(token, owner)) setNotice(result.code === 499 ? 'That opening was closed before the choice was sent.'
            : result.code >= 500 ? 'Confirmation is unavailable. Check the action receipt before trying a new choice.'
            : resultBody(result).error === 'city_adventure_refresh_required' ? 'This adventure changed. Refresh it before making your choice.'
            : caption(resultBody(result).error || 'Your choice could not be applied.'));
          return;
        }
        if (current(token, owner)) {
          if (kind === 'send-chat') { const field = content.querySelector('[data-city-nearby-input]'); if (field) field.value = ''; }
          setNotice(kind === 'send-chat' ? 'Message delivered to this district.' : kind === 'emote' ? 'Emote shared with your nearby room.' : 'Your choice is saved.');
          if (kind === 'send-chat' || kind === 'emote') showChatMessage(resultBody(result).message, true);
          if (kind === 'home-action') {
            if (boards['home-interior']?.home?.key) await read('home-interior', token, { homeKey: boards['home-interior'].home.key });
            if (current(token, owner)) await read('home-invitations', token);
            if (current(token, owner)) await read('home-recovery', token);
            if (current(token, owner)) await read('home-history', token);
          } else if (kind === 'adventure-action') {
            await read('encounters',token);
            if(current(token,owner))await read('opportunities',token);
            if(current(token,owner)&&boards['opportunity-detail']?.graph?.id)await read('opportunity-detail',token,
              {npcId:boards['opportunity-detail'].npc.id,graphRef:boards['opportunity-detail'].graph.id});
          } else await read(kind === 'equip' ? 'inventory' : kind === 'send-chat' || kind === 'emote' ? 'chat' : 'social', token);
        }
      } catch { if (current(token, owner)) setNotice('Confirmation is unavailable. Check the action receipt before trying a new choice.'); }
      finally { if (!destroyed && owner === scope && owner === identity()) { pending = false; if (panel) render(); } }
    }
    function open(id = 'map', { world = false, choices = false } = {}) {
      if (destroyed || !tabs.has(id)) return;
      if (typeof options.onBeforeOpen === 'function') options.onBeforeOpen();
      stopPolling(); clearSpeech(); opening++; readTickets = Object.create(null); readPending = Object.create(null); panel = id; dock.hidden = false; dock.scrollTop = 0; tools.setAttribute('aria-expanded', 'true');
      choicesShown = choices; paintChoices();
      if (id === 'map') mapView = world ? 'world' : 'neighborhood';
      setNotice(''); render(); changed();
      if (choices && compactTools()) tabs.values().next().value.focus({ preventScroll: true });
      else content.focus({ preventScroll: true });
      if (id === 'bag') read('inventory');
      if (id === 'adventures') { read('encounters'); read('opportunities'); }
      if (['room', 'style', 'chat'].includes(id)) read('social');
      if (id === 'room') { read('home-list'); read('home-invitations'); read('home-recovery'); read('home-history'); }
      if (id === 'room' && boards['home-interior']?.home?.key) read('home-interior', opening, { homeKey: boards['home-interior'].home.key });
      else if (socialPreferences().chatEnabled === true) startPolling();
      if (id === 'map' && world) {
        if (!selectedDistrict) selectedDistrict = actualDistrict();
        read('atlas'); read('collection');
        if (atlasDistricts().some(district => district.id === selectedDistrict)) readHomes();
      }
    }
    function close(focus = true) {
      if (dock.hidden) return;
      clearSpeech();
      stopPolling(); opening++; readTickets = Object.create(null); readPending = Object.create(null); panel = ''; dock.hidden = true; clearRenderedListeners(); content.replaceChildren(); receiptBox.replaceChildren(); paintReadState();
      tools.setAttribute('aria-expanded', 'false'); changed(); if (focus) tools.focus({ preventScroll: true });
      if (!destroyed && socialPreferences().chatEnabled === true) startPolling();
    }
    on(tools, 'click', () => dock.hidden ? open('map', { choices: true }) : close());
    on(closeButton, 'click', () => close());
    on(back, 'click', () => {
      if (compactTools() && choicesShown && dock.scrollTop === 0) {
        choicesShown = false; paintChoices(); changed(); content.focus({ preventScroll: true });
      } else revealChoices();
    });
    on(navigation, 'click', event => {
      const tab = event.target.closest('[data-city-world-panel]');
      if (!tab || !navigation.contains(tab)) return;
      open(tab.dataset.cityWorldPanel);
    });
    on(window, 'resize', () => { paintChoices(); if (!dock.hidden) changed(); });
    on(dock, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); close(); } });
    on(tracker, 'click', () => { close(false); if (typeof options.onOpenIntel === 'function') options.onOpenIntel(); });
    function stopPolling() { if (pollTimer !== null) { clearInterval(pollTimer); pollTimer = null; } }
    function startPolling() {
      if (pollTimer !== null) return;
      pollTimer = setInterval(() => { if (!destroyed && !document.hidden && socialPreferences().chatEnabled === true && !pending) read('chat'); }, 5000);
    }
    function renderTracker() {
      const objectives = list(options.objectives);
      const next = objectives.find(objective => objective && !['complete', 'completed', 'locked'].includes(objective.status));
      tracker.textContent = next ? '◆ ' + String(next.title || 'Your next objective') : objectives.length ? '✓ Intel objectives complete' : '◆ Meet someone · collect your first clue';
      tracker.title = next?.description || 'Open your intel journal and objectives';
      tracker.setAttribute('aria-label', tracker.textContent + '. Open intel journal');
      tracker.hidden = options.trackerVisible === false;
    }
    function heading(text, copy) { content.append(el('h4', '', text)); if (copy) content.append(el('p', 'city-world__hint', copy)); }
    function catalogName(id, catalog) { return list(catalog).find(item => item?.id === id)?.name || caption(id); }
    function actualDistrict() { return String(options.character?.loc || options.district?.id || ''); }
    function atlasDistricts() { return list(boards.atlas?.districts).filter(district => district && typeof district.id === 'string' && typeof district.name === 'string'); }
    function currentHomes(board) {
      return board && board.viewer?.characterId === options.character?.id
        && Number(board.viewer?.generation) === Number(options.character?.generation)
        && board.viewer?.district === actualDistrict() && typeof board.districtId === 'string' && board.placement === 'illustrative';
    }
    function validHome(home, districtId) {
      return home && typeof home.key === 'string' && typeof home.street === 'string' && home.districtId === districtId
        && ['city', 'external', 'estate'].includes(home.ownership) && typeof home.mine === 'boolean'
        && (home.ownership !== 'external' || home.owner === null && home.mine === false)
        && (home.ownership !== 'estate' || home.owner === null)
        && (home.owner === null || home.owner && typeof home.owner.name === 'string' && ['player', 'agent', 'npc'].includes(home.owner.kind));
    }
    function acceptHomes(board, cursor = null) {
      if (!currentHomes(board) || !Array.isArray(board.homes)) return false;
      if (board === lastHomesInput && homeDistrict === board.districtId) return true;
      const fresh = list(board.homes).filter(home => validHome(home, board.districtId));
      const mine = validHome(board.myHome, board.districtId) ? board.myHome : null;
      const keep = cursor && homeDistrict === board.districtId ? homeRows.filter(home => home.key !== pinnedHome?.key || fresh.some(item => item.key === home.key)) : [];
      const rows = new Map([...keep, ...fresh].map(home => [home.key, home]));
      if (mine) rows.set(mine.key, mine);
      homeRows = Array.from(rows.values()).slice(-64);
      if (mine && !homeRows.some(home => home.key === mine.key)) homeRows = [...homeRows.slice(-63), mine];
      homeDistrict = board.districtId; homeCursor = typeof board.nextCursor === 'string' ? board.nextCursor : null;
      homeTotal = Math.max(0, Math.floor(number(board.total))); pinnedHome = mine;
      homePaged = !!cursor;
      if (!homeRows.some(home => home.key === selectedHome)) selectedHome = '';
      boards.homes = { ...board, homes: homeRows, myHome: mine };
      lastHomesInput = board;
      if (board.districtId === actualDistrict()) { localHomesBoard = boards.homes; localHomesPaged = homePaged; }
      options.onHomes?.(boards.homes);
      return true;
    }
    function mergeHydratedHomes(board, previous, cursor) {
      const fresh = list(board.homes).filter(home => validHome(home, board.districtId));
      const mine = validHome(board.myHome, board.districtId) ? board.myHome : null;
      const known = new Map(fresh.map(home => [home.key, home]));
      const rows = new Map(list(previous).filter(home => validHome(home, board.districtId)).map(home => known.get(home.key) || home)
        .filter(home => !home.mine || home.key === mine?.key).map(home => [home.key, home]));
      if (mine) rows.set(mine.key, mine);
      let visible = Array.from(rows.values()).slice(-64);
      if (mine && !visible.some(home => home.key === mine.key)) visible = [...visible.slice(-63), mine];
      return { ...board, homes: visible, myHome: mine, nextCursor: cursor };
    }
    function hydrateHomes(board) {
      if (!currentHomes(board) || !Array.isArray(board.homes)) return false;
      const fresh = list(board.homes).filter(home => validHome(home, board.districtId));
      const mine = validHome(board.myHome, board.districtId) ? board.myHome : null;
      const fields = home => home && [home.key, home.street, home.districtId, home.mine, home.ownership, home.owner?.name, home.owner?.kind];
      const fingerprint = JSON.stringify([board.viewer, board.districtId, fresh.map(fields), fields(mine), board.nextCursor, board.total]);
      if (fingerprint === lastHomesHydration) return true;
      lastHomesHydration = fingerprint;
      if (homeDistrict && homeDistrict !== board.districtId) {
        // The host's current-district hydration cannot replace an inspected remote page.
        if (board.districtId === actualDistrict()) {
          localHomesBoard = localHomesPaged && currentHomes(localHomesBoard)
            ? mergeHydratedHomes(board, localHomesBoard.homes, localHomesBoard.nextCursor)
            : mergeHydratedHomes(board, fresh, typeof board.nextCursor === 'string' ? board.nextCursor : null);
          options.onHomes?.(localHomesBoard);
        }
        return true;
      }
      if (!homePaged) return acceptHomes(board);
      // Reconcile only published fields for known rows, preserving the loaded
      // window and its issued cursor. An old own peek loses its private links
      // when the fresh first page no longer publishes it as the viewer's deed.
      const merged = mergeHydratedHomes(board, homeRows, homeCursor); homeRows = merged.homes;
      homeTotal = Math.max(0, Math.floor(number(board.total))); pinnedHome = mine;
      if (!homeRows.some(home => home.key === selectedHome)) selectedHome = '';
      boards.homes = merged;
      if (board.districtId === actualDistrict()) { localHomesBoard = boards.homes; localHomesPaged = homePaged; }
      options.onHomes?.(boards.homes); return true;
    }
    function readHomes(cursor = null) {
      if (!atlasDistricts().some(district => district.id === selectedDistrict)) return;
      return read('homes', opening, { districtId: selectedDistrict, cursor });
    }
    function inspectDistrict(id) {
      if (!atlasDistricts().some(district => district.id === id)) return;
      selectedDistrict = id; selectedHome = ''; setNotice(''); render(); changed(); focusMapDetail('[data-city-district-detail]'); readHomes();
    }
    function focusMapDetail(selector) {
      const target = content.querySelector(selector); if (!target) return;
      const bounds = target.getBoundingClientRect(), box = dock.getBoundingClientRect(), barHeight = bar.getBoundingClientRect().height;
      dock.scrollTo({ top: Math.max(0, dock.scrollTop + bounds.top - box.top - barHeight - 8), behavior: 'instant' });
      target.tabIndex = -1; target.focus({ preventScroll: true });
    }
    async function travelDistrict() {
      if (pending || options.recovery === true || typeof options.onTravel !== 'function' || !travelEligible(selectedDistrict)) return;
      const owner = scope, token = opening, district = selectedDistrict;
      const homeKey = homeRows.find(home => home.key === selectedHome && home.mine)?.key;
      pending = true; setNotice('Confirming your destination…'); render();
      try {
        const result = await options.onTravel(district, {
          homeKey,
          beforeDispatch: () => current(token, owner) && panel === 'map' && mapView === 'world' && selectedDistrict === district && travelEligible(district),
          // This describes the view only. The host preserves sent receipts with
          // its own session/character guard across district changes and teardown.
          isCurrent: () => !destroyed && owner === scope && owner === identity()
        });
        if (!current(token, owner) || result?.ignored) return;
        setNotice(result?.code < 400 ? 'Travel confirmed. Updating your district…'
          : result?.code === 499 ? 'That travel choice was closed before it was sent.' : 'Travel is not confirmed. Check the action receipt before trying again.');
      } catch { if (current(token, owner)) setNotice('Travel confirmation is unavailable. Check the action receipt before trying again.'); }
      finally { if (!destroyed && owner === scope && owner === identity()) { pending = false; if (panel) render(); } }
    }
    function travelFare() { const value = options.rules?.travelCost; return value !== null && value !== undefined && value !== '' ? Number(value) : NaN; }
    function travelEligible(id) {
      const fare = travelFare();
      return atlasDistricts().some(district => district.id === id) && id !== actualDistrict() && Number.isFinite(fare) && fare >= 0
        && number(options.character?.jailSeconds) <= 0 && number(options.character?.cash) >= fare;
    }
    function renderMap() {
      const modes = el('div', 'city-world__map-modes');
      for (const [id, label] of [['neighborhood', 'Neighborhood'], ['world', 'World overview']]) {
        const choose = button(label, () => open('map', { world: id === 'world' })); choose.dataset.cityMapView = id;
        choose.setAttribute('aria-pressed', String(mapView === id)); modes.append(choose);
      }
      content.append(modes);
      if (mapView === 'world') { renderAtlas(); return; }
      heading(String(options.district?.name || 'Your neighborhood'), 'Choose a waypoint to walk there. People markers show approximate district presence.');
      const map = el('canvas', 'city-world__minimap'); map.width = 480; map.height = 320; map.dataset.cityMinimap = '';
      map.setAttribute('role', 'img'); map.setAttribute('aria-label', 'Neighborhood minimap with venue waypoints and your local walking position. Accessible destinations follow.');
      content.append(map);
      const grid = el('div', 'city-world__destination-grid');
      for (const venue of list(options.venues, 16)) {
        const go = button(venue.name, () => { close(false); options.onWaypoint?.(venue.id); });
        go.dataset.cityWaypoint = venue.id; grid.append(go);
      }
      content.append(grid);
      const localHomes = currentHomes(localHomesBoard) ? list(lastFrame?.homes || options.getState?.()?.homes).filter(home => localHomesBoard.homes.some(item => item.key === home.key)) : [];
      if (localHomes.length && options.onHome) {
        heading('Neighborhood streets', 'Walk to a recorded street. House placement is illustrative.');
        const homes = el('div', 'city-world__destination-grid');
        for (const home of localHomes) {
          const go = button('Walk to ' + home.street, () => { close(false); options.onHome?.(home.key); });
          go.dataset.cityHomeWalk = home.key; homes.append(go);
        }
        content.append(homes);
      }
      paintMap();
    }
    function renderAtlas() {
      const districts = atlasDistricts(), category = list(boards.collection?.categories).find(item => item.id === 'districts');
      const visits = category ? new Set(list(category.items).filter(item => item.got === true).map(item => item.id)) : null;
      heading('The city beyond this block', 'Inspect districts and their recorded streets. Choosing a district does not travel or spend cash.');
      content.append(el('p', 'city-world__hint', visits ? visits.size + ' / ' + districts.length + ' districts recorded in your Collection' : 'Your recorded visits are loading…'));
      if (!districts.length) { content.append(el('p', 'city-world__hint', 'The world overview is not available yet.')); return; }
      const diagram = el('div', 'city-world__atlas-diagram');
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); svg.setAttribute('viewBox', '0 0 480 280'); svg.setAttribute('aria-hidden', 'true');
      const positions = new Map(districts.map((district, index) => [district.id, { x: 90 + index % 3 * 150, y: 70 + Math.floor(index / 3) * 140 }])), drawn = new Set();
      for (const district of districts) for (const neighbor of list(district.neighbours)) {
        const to = positions.get(neighbor), from = positions.get(district.id), key = [district.id, neighbor].sort().join(':');
        if (!to || drawn.has(key)) continue; drawn.add(key);
        const line = document.createElementNS(svg.namespaceURI, 'line');
        for (const [name, value] of Object.entries({ x1: from.x, y1: from.y, x2: to.x, y2: to.y })) line.setAttribute(name, value);
        svg.append(line);
      }
      for (const district of districts) {
        const point = positions.get(district.id), circle = document.createElementNS(svg.namespaceURI, 'circle');
        circle.setAttribute('cx', point.x); circle.setAttribute('cy', point.y); circle.setAttribute('r', '42'); circle.dataset.cityAtlasDistrict = district.id;
        onRender(circle, 'click', () => inspectDistrict(district.id));
        circle.classList.toggle('is-here', district.id === actualDistrict()); circle.classList.toggle('is-selected', district.id === selectedDistrict); svg.append(circle);
        const name = document.createElementNS(svg.namespaceURI, 'text'); name.setAttribute('x', point.x); name.setAttribute('y', point.y + 56); name.textContent = district.name; svg.append(name);
        onRender(name, 'click', () => inspectDistrict(district.id));
      }
      diagram.append(svg); content.append(diagram, el('p', 'city-world__hint', 'Tap a district or use the list. Overview positions are illustrative.'));
      const grid = el('div', 'city-world__districts');
      for (const district of districts) {
        const choose = button('', () => inspectDistrict(district.id), 'city-world__district'); choose.dataset.cityDistrict = district.id;
        choose.dataset.worldControl = 'district:' + district.id;
        choose.setAttribute('aria-pressed', String(district.id === selectedDistrict));
        choose.append(el('strong', '', district.name), el('span', '', [district.id === actualDistrict() ? 'Here' : '', visits?.has(district.id) ? 'Visited' : visits ? 'Not recorded' : 'Visits loading', number(district.deeds) + ' street deeds'].filter(Boolean).join(' · ')));
        grid.append(choose);
      }
      content.append(grid);
      const district = districts.find(item => item.id === selectedDistrict); if (!district) return;
      const details = el('section', 'city-world__district-detail'); details.dataset.cityDistrictDetail = district.id;
      details.append(el('h4', '', district.name), el('p', '', district.perk || ''), el('p', 'city-world__hint', 'Connected districts: ' + list(district.neighbours).map(id => districts.find(item => item.id === id)?.name || id).join(' · ')));
      const fare = travelFare();
      const here = district.id === actualDistrict(), jailed = number(options.character?.jailSeconds) > 0;
      const travel = button(here ? 'You are here' : Number.isFinite(fare) ? 'Travel here · $' + fare.toLocaleString('en-US') : 'Travel fare unavailable', travelDistrict);
      travel.dataset.cityTravel = district.id; travel.disabled = !travelEligible(district.id) || pending || options.recovery === true || !options.onTravel;
      details.append(travel);
      if (!here && jailed) details.append(el('p', 'city-world__hint', 'Travel is unavailable from lockup.'));
      else if (!here && Number.isFinite(fare) && number(options.character?.cash) < fare) details.append(el('p', 'city-world__hint', 'You need $' + fare.toLocaleString('en-US') + ' cash for the ride.'));
      content.append(details); renderHomes(district);
    }
    function renderHomes(district) {
      const section = el('section', 'city-world__homes'); section.dataset.cityHomesDistrict = district.id;
      section.append(el('h4', '', 'Street directory'), el('p', 'city-world__hint', 'Deed records and public stewards. House placement is illustrative, not a tracked residence.'));
      if (homeDistrict !== district.id) { section.append(el('p', 'city-world__hint', 'This district’s streets have not loaded yet.')); content.append(section); return; }
      section.append(el('p', 'city-world__hint', homeRows.length + ' shown · ' + homeTotal + ' recorded streets'));
      const grid = el('div', 'city-world__home-list');
      for (const home of homeRows) {
        const inspect = button('', () => { selectedHome = home.key; render(); changed(); focusMapDetail('[data-city-home-detail]'); }, 'city-world__home'); inspect.dataset.cityHome = home.key;
        inspect.dataset.worldControl = 'home:' + home.key;
        inspect.setAttribute('aria-pressed', String(selectedHome === home.key));
        inspect.append(el('strong', '', home.street), el('span', '', home.mine ? 'Your street deed' : home.owner ? home.owner.name + ' · ' + caption(home.owner.kind) : home.ownership === 'external' ? 'External deed record' : 'Estate record · no living steward'));
        grid.append(inspect);
      }
      section.append(grid);
      if (!homeRows.length) section.append(el('p', 'city-world__hint', 'No street deeds are recorded in this district.'));
      const selected = homeRows.find(home => home.key === selectedHome);
      if (selected) {
        const detail = el('section', 'city-world__home-detail'); detail.dataset.cityHomeDetail = selected.key;
        detail.append(el('h4', '', selected.street), el('p', '', selected.owner ? 'Public steward: ' + selected.owner.name + ' (' + caption(selected.owner.kind) + ')' : selected.ownership === 'external' ? 'This is an external deed record. No in-city owner is asserted.' : 'An estate record without a living steward.'));
        if (selected.districtId === actualDistrict() && options.onHome && list(lastFrame?.homes || options.getState?.()?.homes).some(home => home.key === selected.key)) {
          const walk = button('Walk to this street →', () => { close(false); options.onHome?.(selected.key); }); walk.dataset.cityHomeWalk = selected.key; detail.append(walk);
        }
        if (selected.mine) {
          detail.append(button('Open Street Deeds →', () => { close(false); options.onNavigate?.('deeds', { venueId: 'clubhouse', streetKey: selected.key, districtId: selected.districtId, focus: 'owned-deed' }); }));
          detail.append(button('Your cosmetic Hideout →', () => open('room')));
        }
        section.append(detail);
      }
      const refresh = button('Refresh streets', () => readHomes()); section.append(refresh);
      if (homeCursor) { const more = button('Load more streets →', () => readHomes(homeCursor)); more.dataset.cityHomesMore = ''; section.append(more); }
      if (homeRows.length >= 64) section.append(button('Back to first streets', () => readHomes()));
      content.append(section);
    }
    function renderBag() {
      const character = options.character || {}, rules = options.rules || {}, owned = list(character.guns);
      heading('Your equipment', 'Equip owned gear here. Purchases and crafting remain available at the Workshop.');
      const equipment = el('dl', 'city-world__stats');
      for (const [name, value] of [['Carrying', character.gun ? catalogName(character.gun, rules.guns) : 'Unarmed'], ['Vest', character.vest ? catalogName(character.vest, rules.vests) : 'None'], ['Ammo', number(character.ammo)], ['Crates', number(character.cb)]]) {
        const row = el('div'); row.append(el('dt', '', name), el('dd', '', value)); equipment.append(row);
      }
      content.append(equipment);
      for (const id of owned) {
        const row = el('article', 'city-world__item');
        row.append(el('strong', '', catalogName(id, rules.guns)));
        const equip = button(character.gun === id ? 'Put away' : 'Equip', () => action('equip', { id: character.gun === id ? null : id }));
        equip.dataset.cityEquip = id; equip.disabled = pending || options.recovery === true || !options.onAction; row.append(equip); content.append(row);
      }
      if (!owned.length) content.append(el('p', 'city-world__hint', 'Your holster is empty. Visit the Workshop to inspect available equipment.'));
      const items = Object.entries(character.items || {}).filter(([, quantity]) => number(quantity) > 0).slice(0, 48);
      if (items.length) {
        content.append(el('h4', '', 'Supplies'));
        for (const [id, quantity] of items) content.append(el('p', 'city-world__item-copy', catalogName(id, rules.consumables) + ' × ' + number(quantity)));
      }
      const world = boards.inventory || {}, unique = list(world.currentCharacterItems || world.items), stacks = list(world.currentCharacterStacks || world.stacks);
      if (unique.length || stacks.length) {
        content.append(el('h4', '', 'World Graph bag'));
        for (const item of unique) content.append(el('p', 'city-world__item-copy', caption(item.templateId || item.template_id || item.name) + ' · ' + caption(item.state)));
        for (const item of stacks) content.append(el('p', 'city-world__item-copy', caption(item.templateId || item.template_id || item.name) + ' × ' + number(item.quantity)));
      }
      content.append(button('Visit the Workshop →', () => { close(false); options.onInspectVenue?.('workshop'); }));
    }
    function renderSkills() {
      const character = options.character || {}, progress = options.progress;
      heading('Your build', 'Base skills and level progress come from your current character. Gains appear after confirmed actions.');
      const grid = el('dl', 'city-world__stats');
      for (const name of ['muscle', 'cunning', 'speed']) {
        const row = el('div'); row.append(el('dt', '', caption(name)), el('dd', '', number(character.stats?.[name]))); grid.append(row);
      }
      content.append(grid, el('p', '', 'Level ' + number(character.level || 1)));
      if (progress && number(progress.next) > number(progress.floor)) {
        const meter = el('progress', 'city-world__level'); meter.max = number(progress.next) - number(progress.floor);
        meter.value = Math.max(0, Math.min(meter.max, number(progress.respect) - number(progress.floor)));
        meter.setAttribute('aria-label', 'Respect toward level ' + (number(progress.level) + 1));
        content.append(meter, el('p', 'city-world__hint', Math.max(0, number(progress.next) - number(progress.respect)) + ' respect to your next level.'));
      }
      content.append(button('Visit the Training Room →', () => { close(false); options.onInspectVenue?.('training'); }));
    }
    function socialPreferences() { return boards.social?.preferences || {}; }
    function renderRoom() {
      const preferences = socialPreferences(), furniture = list(preferences.room?.furniture || preferences.furniture, 12);
      heading('Your hideout', 'Make this corner of the city yours. Furniture is cosmetic; your protection still follows the normal safehouse rules.');
      const room = el('div', 'city-world__room'); room.dataset.cityHideout = ''; room.setAttribute('role', 'group'); room.setAttribute('aria-label', 'Six by six hideout floor');
      for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
        const tile = el('span', 'city-world__floor'); tile.style.gridColumn = String(x + 1); tile.style.gridRow = String(y + 1); room.append(tile);
      }
      const roomPlayer = el('img', 'city-world__room-player'); roomPlayer.src = '/art/city-player-down-v1.png'; roomPlayer.alt = 'Your character in the hideout'; roomPlayer.style.gridColumn = '4'; roomPlayer.style.gridRow = '5'; room.append(roomPlayer);
      const furnitureLabels = { chair: 'Chair', table: 'Table', lamp: 'Lamp', window: 'Window' };
      const useControls = el('div', 'city-world__emotes');
      for (const item of furniture) {
        if (!item || !Object.hasOwn(furnitureLabels, item.id) || !Number.isInteger(item.x) || !Number.isInteger(item.y) || item.x < 0 || item.x > 5 || item.y < 0 || item.y > 5) continue;
        const piece = el('span', 'city-world__furniture city-world__furniture--' + item.id);
        piece.setAttribute('role', 'img'); piece.setAttribute('aria-label', furnitureLabels[item.id]);
        piece.style.gridColumn = String(item.x + 1); piece.style.gridRow = String(item.y + 1); room.append(piece);
        const use = button('Use ' + furnitureLabels[item.id], () => {
          piece.classList.toggle('is-used');
          if (item.id === 'chair') { roomPlayer.style.gridColumn = String(item.x + 1); roomPlayer.style.gridRow = String(item.y + 1); }
          setNotice(item.id === 'chair' ? 'You take a seat.' : item.id === 'lamp' ? 'The lamp switches ' + (piece.classList.contains('is-used') ? 'on.' : 'off.') : 'You inspect your ' + furnitureLabels[item.id].toLowerCase() + '.');
        }); useControls.append(use);
      }
      content.append(room, useControls);
      const editable = list(boards.social?.furnitureCatalog || boards.social?.furniture, 12);
      if (editable.length) {
        const controls = el('div', 'city-world__room-controls');
        const select = el('select'); select.setAttribute('aria-label', 'Furniture to place');
        for (const item of editable) { const option = el('option', '', item.name || caption(item.id)); option.value = item.id; select.append(option); }
        const x = el('input'), y = el('input');
        for (const [field, label] of [[x, 'Furniture column'], [y, 'Furniture row']]) { field.type = 'number'; field.min = '1'; field.max = '6'; field.value = '2'; field.setAttribute('aria-label', label); }
        controls.append(select, x, y);
        const place = button('Place furniture', () => {
          const column = Number(x.value) - 1, row = Number(y.value) - 1;
          if (!Number.isInteger(column) || !Number.isInteger(row) || column < 0 || column > 5 || row < 0 || row > 5) { setNotice('Choose a row and column from 1 to 6.'); return; }
          const updated = furniture.filter(item => item.id !== select.value).concat({ id: select.value, x: column, y: row });
          action('room', { furniture: updated });
        }); place.disabled = pending || options.recovery === true || !options.onAction; controls.append(place); content.append(controls);
      }
      const safe = number(options.character?.safeSeconds);
      content.append(el('p', 'city-world__hint', safe > 0 ? 'Safehouse protection: ' + Math.ceil(safe / 60) + ' minutes remaining.' : 'Decorating does not activate protection.'));
      content.append(button('Safehouse options →', () => { close(false); options.onNavigate?.('streets', { venueId: 'directory' }); }));
      if (window.CityHomeUi) {
        const home = el('section', 'city-world__home-tools'); home.dataset.cityHomeTools = '';
        window.CityHomeUi.render(home, { board: boards['home-interior'], invitations: boards['home-invitations'],
          recovery: boards['home-recovery'], history: boards['home-history'], homes: boards['home-list'], actors: options.actors, pending: pending || options.recovery === true,
          onBind: onRender, onRead: (kind, input) => read(kind, opening, input),
          onAction: (issued, fields) => action('home-action', { id: issued?.id, path: issued?.path, body: issued?.body, fields }) });
        content.append(home);
      }
    }
    function renderStyle() {
      const preferences = socialPreferences();
      heading('Your street style', 'Free cosmetic looks. Your outfit never changes equipment or combat stats.');
      const looks = el('div', 'city-world__looks');
      for (const outfit of list(boards.social?.outfits, 12)) {
        const choose = button(outfit.name || caption(outfit.id), () => action('outfit', { outfit: outfit.id }), 'city-world__look');
        const preview = el('img'); preview.src = '/art/city-player-down-v1.png'; preview.alt = '';
        if (typeof outfit.color === 'string' && /^#[0-9a-f]{6}$/i.test(outfit.color)) choose.style.setProperty('--look-color', outfit.color);
        choose.prepend(preview); choose.dataset.cityOutfit = outfit.id; choose.setAttribute('aria-pressed', String(preferences.outfit === outfit.id)); choose.disabled = pending || options.recovery === true || !options.onAction; looks.append(choose);
      }
      content.append(looks, el('h4', '', 'Emotes'));
      const emotes = el('div', 'city-world__emotes');
      for (const emote of list(boards.social?.emotes, 12)) {
        const send = button(emote.name || caption(emote.id), () => action('emote', { emoteId: emote.id }));
        send.dataset.cityEmote = emote.id; send.disabled = pending || options.recovery === true || preferences.chatEnabled !== true; emotes.append(send);
      }
      content.append(emotes);
      if (preferences.chatEnabled !== true) content.append(el('p', 'city-world__hint', 'Join nearby chat before sharing an emote.'));
      content.append(el('p', 'city-world__hint', 'Your outfit and emotes are shared with nearby participants only while you are joined.'));
    }
    function renderChat() {
      const preferences = socialPreferences();
      heading('Nearby chat', 'An opt-in room for characters in your current district. Messages are shared with that room.');
      content.append(el('p', 'city-world__hint', 'Your choice is remembered for the last district you joined, including when you return. Leave chat to stop sharing.'));
      const join = button(preferences.chatEnabled === true ? 'Leave nearby chat' : 'Join nearby chat', () => action('chat-consent', { enabled: preferences.chatEnabled !== true }));
      join.dataset.cityChatConsent = ''; join.disabled = pending || options.recovery === true || !options.onAction; content.append(join);
      if (preferences.chatEnabled !== true) { content.append(el('p', 'city-world__hint', 'You have not joined. No nearby messages are loaded until you opt in.')); return; }
      const feed = el('ol', 'city-world__chat-feed'); feed.dataset.cityNearbyFeed = '';
      for (const message of list(boards.chat?.messages, 50)) {
        const row = el('li'); row.append(el('strong', '', String(message.who || message.name || message.sender?.name || 'Someone')), document.createTextNode(' · ' + String(message.text || message.body || ''))); feed.append(row);
      }
      if (!feed.children.length) feed.append(el('li', 'city-world__hint', Object.hasOwn(boards, 'chat') ? 'The room is quiet. Say hello.' : 'Messages have not loaded yet.'));
      content.append(feed);
      const form = el('form', 'city-world__chat-form'), text = el('input');
      text.type = 'text'; text.maxLength = 240; text.autocomplete = 'off'; text.placeholder = 'Say something to the neighborhood…'; text.setAttribute('aria-label', 'Message to nearby chat'); text.dataset.cityNearbyInput = '';
      const send = el('button', '', 'Send'); send.type = 'submit'; send.dataset.worldControl = 'send-chat'; send.disabled = pending || options.recovery === true; form.append(text, send);
      onRender(form, 'submit', event => { event.preventDefault(); if (!text.value.trim()) return; action('send-chat', { text: text.value }); });
      content.append(form, button('Refresh messages', () => read('chat')));
    }
    function render() {
      if (destroyed || !panel) return;
      paintChoices();
      const scroll = dock.scrollTop, active = document.activeElement;
      const focused = content.contains(active) || receiptBox.contains(active);
      const focusKey = active?.dataset?.worldControl || active?.getAttribute('aria-label');
      const preserveDraft = renderedOpening === opening;
      const drafts = new Map(preserveDraft ? Array.from(content.querySelectorAll('input,select'), field => [field.getAttribute('aria-label'), { value: field.value, checked: field.checked }]) : []);
      const selection = preserveDraft && active?.matches('input[type="text"]') ? [active.selectionStart, active.selectionEnd] : null;
      clearRenderedListeners(); content.replaceChildren(); receiptBox.replaceChildren();
      for (const [id, tab] of tabs) tab.setAttribute('aria-pressed', String(id === panel));
      if (panel === 'map') renderMap(); else if (panel === 'bag') renderBag(); else if (panel === 'skills') renderSkills();
      else if(panel==='adventures'&&window.CityAdventureUi)window.CityAdventureUi.render(content,{encounters:boards.encounters,index:boards.opportunities,
        detail:boards['opportunity-detail'],pending:pending||options.recovery===true,onBind:onRender,onRead:(kind,input)=>read(kind,opening,input),
        onAction:issued=>action('adventure-action',{id:issued.id,path:issued.path,body:{...issued.body}}),onCrew:()=>options.onCrew?.()});
      else if (panel === 'room') renderRoom(); else if (panel === 'style') renderStyle(); else if (panel === 'chat') renderChat();
      for (const field of content.querySelectorAll('input,select')) if (drafts.has(field.getAttribute('aria-label'))) {
        const draft=drafts.get(field.getAttribute('aria-label'));field.value=draft.value;if(field.type==='checkbox')field.checked=draft.checked;
      }
      renderedOpening = opening;
      paintReadState(); dock.scrollTop = scroll;
      if (options.receipt) {
        receiptBox.append(el('strong', '', options.receipt.label || 'World action'), el('p', '', options.receipt.summary || ''));
        if (options.receipt.delta) receiptBox.append(el('p', '', options.receipt.delta));
        if (options.recovery === true && options.receipt.recovery?.sameKey === true && typeof options.onRetry === 'function') {
          const retry = button('Recover the same action', async () => {
            if (pending) return; const owner = scope, token = opening, recover = options.onRetry; pending = true; render();
            try { const result=await recover(); if(current(token,owner)&&result?.code<400){
              if(panel==='room') { if(boards['home-interior']?.home?.key)await read('home-interior',token,{homeKey:boards['home-interior'].home.key});
                if(current(token,owner))await read('home-invitations',token);if(current(token,owner))await read('home-recovery',token); }
              if(panel==='adventures') { await read('encounters',token);if(current(token,owner))await read('opportunities',token);
                if(current(token,owner)&&boards['opportunity-detail']?.graph?.id)await read('opportunity-detail',token,{npcId:boards['opportunity-detail'].npc.id,graphRef:boards['opportunity-detail'].graph.id}); }
            } } finally { if (!destroyed && owner === scope && owner === identity()) { pending = false; if (panel) render(); } }
          }); retry.disabled = pending; retry.dataset.cityWorldRetry = ''; receiptBox.append(retry);
        }
      }
      if (focused) {
        const target = (focusKey ? Array.from(dock.querySelectorAll('button,input,select')).find(node => !node.disabled && (node.dataset.worldControl || node.getAttribute('aria-label')) === focusKey) : null) || content;
        target.focus({ preventScroll: true }); if (selection && target.matches('input[type="text"]')) target.setSelectionRange(...selection);
      }
      changed();
    }
    function paintMap() {
      const canvas = content.querySelector('[data-city-minimap]'); if (!canvas) return;
      const context = canvas.getContext('2d'); if (!context) return;
      const state = lastFrame || options.getState?.() || {}, world = state.world || { width: 960, height: 640 };
      const sx = canvas.width / world.width, sy = canvas.height / world.height;
      context.fillStyle = '#182c2c'; context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = '#47554b';
      if (Array.isArray(state.roads)) for (const road of list(state.roads, 96)) context.fillRect(road.x * sx, road.y * sy, road.width * sx, road.height * sy);
      else { context.fillRect(0, 96, canvas.width, 72); context.fillRect(145, 0, 55, canvas.height); }
      for (const obstacle of list(state.obstacles, 160)) { context.fillStyle = '#927854'; context.fillRect(obstacle.x * sx, obstacle.y * sy, obstacle.width * sx, obstacle.height * sy); }
      for (const home of list(state.homes)) if (currentHomes(localHomesBoard) && localHomesBoard.homes.some(item => item.key === home.key) && home.entrance) {
        context.fillStyle = home.mine ? '#b1d88f' : '#b0b8a7'; context.fillRect(home.entrance.x * sx - 3, home.entrance.y * sy - 3, 6, 6);
      }
      for (const exit of list(state.exits, 16)) { context.fillStyle = '#9fc4da'; context.fillRect(exit.x * sx - 3, exit.y * sy - 3, 6, 6); }
      for (const venue of list(options.venues, 16)) {
        context.fillStyle = '#e7b65d'; context.fillRect(venue.x * sx - 4, venue.y * sy - 4, 8, 8);
        context.fillStyle = '#eae1c3'; context.font = '10px monospace'; context.fillText(String(venue.name || '').slice(0, 14), Math.max(2, Math.min(canvas.width - 86, venue.x * sx - 30)), venue.y * sy + 17);
      }
      for (const actor of list(state.actorMarkers, 24)) { context.fillStyle = actor.kind === 'agent' ? '#9ec5ef' : actor.kind === 'npc' ? '#c6b696' : '#a5d9c6'; context.fillRect(actor.x * sx - 2, actor.y * sy - 2, 4, 4); }
      const pose = state.position || state.player; if (pose) { context.fillStyle = '#fff4bf'; context.beginPath(); context.arc(pose.x * sx, pose.y * sy, 5, 0, Math.PI * 2); context.fill(); }
    }
    function speak(venueId, now) {
      if (!VOICES[venueId]) return;
      const [name, copy] = VOICES[venueId]; showSpeech(name + ' · NPC', copy, now);
    }
    function showSpeech(name, copy, now) {
      const roomy = (options.mapLayer?.getBoundingClientRect().height || 0) >= 220;
      const wasInline = !dialogue.hidden;
      speech.replaceChildren(el('strong', '', name), el('span', '', copy)); speech.hidden = !roomy;
      dialogue.textContent = name + ': ' + copy; dialogue.hidden = roomy; speechUntil = now + 6500;
      if (!roomy || wasInline) changed();
    }
    function clearSpeech() { const wasInline = !dialogue.hidden; speech.hidden = true; dialogue.hidden = true; speech.replaceChildren(); dialogue.textContent = ''; speechUntil = 0; if (wasInline) changed(); }
    function fitSpeech() {
      if (!speechUntil || !speech.childNodes.length) return;
      const roomy = (options.mapLayer?.getBoundingClientRect().height || 0) >= 220;
      if (dialogue.hidden === roomy && speech.hidden === !roomy) return;
      speech.hidden = !roomy; dialogue.hidden = roomy; changed();
    }
    function showChatMessage(message, own = false) {
      if (!message?.id || message.id === lastChatId || socialPreferences().chatEnabled !== true) return;
      const source = list(boards.chat?.participants, 40).find(actor => actor.id === message.characterId && actor.generation === message.generation);
      const self = options.character;
      if (!source && !(own && self?.id === message.characterId && self?.generation === message.generation)) return;
      const at = typeof message.at === 'number' ? message.at : Date.parse(message.at);
      if (!Number.isFinite(at) || Math.abs(Date.now() - at) > 30000 || at < lastChatAt) return;
      lastChatId = message.id; lastChatAt = at;
      showSpeech(String(message.who || source?.name || self?.name || 'Someone') + (message.kind === 'emote' ? ' · EMOTE' : ' · NEARBY'), String(message.text || ''), performance.now());
    }
    tools.setAttribute('aria-expanded', 'false');
    renderTracker();
    const handle = {
      update(next) {
        if (destroyed || !next) return;
        options = { ...options, ...next }; const owner = identity(), ownerChanged = owner !== scope;
        if (ownerChanged) {
          close(false); stopPolling(); scope = owner; boards = Object.create(null); options.social = null; options.chat = null; options.receipt = null; options.recovery = false;
          options.atlas = null; options.collection = null; options.homes = null;
          selectedDistrict = ''; selectedHome = ''; homeDistrict = ''; homeRows = []; homeCursor = null; homeTotal = 0; pinnedHome = null; lastHomesInput = null; lastHomesHydration = null; homePaged = false; localHomesBoard = null; localHomesPaged = false; lastFrame = null;
          options.onHomes?.(null);
          options.objectives = next.objectives || []; options.intel = next.intel || []; options.actors = next.actors || []; options.npcQuests = next.npcQuests || {};
          pending = false; gains.textContent = ''; lastSpeech = ''; lastChatId = ''; lastChatAt = 0; clearSpeech(); options.onLook?.('classic');
          lastCharacter = { ...options.character, stats: { ...options.character?.stats } };
        }
        else {
          const character = options.character || {}, changes = [];
          for (const key of ['muscle', 'cunning', 'speed']) { const gain = number(character.stats?.[key]) - number(lastCharacter.stats?.[key]); if (gain > 0) changes.push(caption(key) + ' +' + gain); }
          if (number(character.level) > number(lastCharacter.level)) changes.push('Level ' + character.level + ' reached');
          if (changes.length) { gains.textContent = changes.join(' · '); gains.dataset.celebrate = String(Date.now()); }
          lastCharacter = { ...character, stats: { ...character.stats } };
        }
        if (Object.hasOwn(next, 'social')) {
          if (next.social) { boards.social = next.social; options.onLook?.(socialPreferences().outfit || 'classic'); }
          else { delete boards.social; options.social = null; }
          if (socialPreferences().chatEnabled !== true) { delete boards.chat; options.chat = null; readTickets.chat = (readTickets.chat || 0) + 1; stopPolling(); clearSpeech(); }
          else startPolling();
        }
        if (Object.hasOwn(next, 'chat')) {
          if (next.chat && socialPreferences().chatEnabled === true) boards.chat = next.chat;
          else { delete boards.chat; options.chat = null; clearSpeech(); }
        }
        for (const kind of ['atlas', 'collection']) if (!ownerChanged && Object.hasOwn(next, kind)) {
          if (next[kind]) boards[kind] = next[kind]; else delete boards[kind];
        }
        if (!ownerChanged && Object.hasOwn(next, 'homes')) {
          if (next.homes) { if (!readPending.homes) hydrateHomes(next.homes); }
          else { delete boards.homes; homeDistrict = ''; homeRows = []; homeCursor = null; homeTotal = 0; pinnedHome = null; lastHomesInput = null; lastHomesHydration = null; homePaged = false; localHomesBoard = null; localHomesPaged = false; selectedHome = ''; options.onHomes?.(null); }
        }
        renderTracker(); if (panel) render();
      },
      frame(frame) {
        if (destroyed) return; lastFrame = frame;
        fitSpeech();
        const now = performance.now();
        if (panel === 'map' && now - lastMapPaint > 100) { lastMapPaint = now; paintMap(); }
        const pose = frame?.position || frame?.player;
        if (pose && !panel) {
          const venue = list(options.venues, 16).find(item => VOICES[item.id] && Math.hypot(item.x - pose.x, item.y - pose.y) < 55);
          if (venue && lastSpeech !== venue.id && now >= speechUntil) { lastSpeech = venue.id; speak(venue.id, now); }
          if (!venue) lastSpeech = '';
        }
        if (speechUntil && now > speechUntil) clearSpeech();
      },
      open, close,
      openMapOverview(districtId) {
        const allowed = atlasDistricts().some(district => district.id === districtId)
          || list(options.rules?.districts).some(district => (district.id || district) === districtId);
        selectedDistrict = allowed ? districtId : actualDistrict();
        open('map', { world: true });
      },
      inspectHome(key, focus = false) {
        if (panel !== 'map' || mapView !== 'world' || homeDistrict !== selectedDistrict || !homeRows.some(home => home.key === key)) return false;
        selectedHome = key; render(); changed(); if (focus) focusMapDetail('[data-city-home-detail]'); return true;
      },
      isOpen: () => !dock.hidden,
      panelHeight: () => dock.hidden ? 0 : dock.getBoundingClientRect().height,
      setHeight(value) { if (Number.isFinite(value)) { dock.style.setProperty('--city-world-height', Math.max(64, value) + 'px'); dock.classList.toggle('is-compact', value < 112); } },
      getState: () => ({ panel, opening, pending, scope, mapView, districtId: selectedDistrict, selectedHome, chatJoined: socialPreferences().chatEnabled === true }),
      destroy() { if (destroyed) return; close(false); destroyed = true; stopPolling(); readTickets = Object.create(null); boards = Object.create(null); homeRows = []; pinnedHome = null; localHomesBoard = null; localHomesPaged = false; lastHomesHydration = null; lastHomesInput = null; homeCursor = null; homeDistrict = ''; selectedHome = ''; options.homes = null; lastFrame = null; options.onHomes?.(null); clearRenderedListeners(); listeners.forEach(remove => remove()); tools.remove(); tracker.remove(); toolbar.remove(); dock.remove(); speech.remove(); }
    };
    handle.update(input);
    return handle;
  }
  window.OmertaCityWorldUI = { mount, ambientPose };
})();
