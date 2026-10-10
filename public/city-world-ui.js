/* In-world tools use confirmed player data and the host's guarded API callbacks. */
(function () {
  'use strict';
  const PANELS = [['map', 'Map'], ['bag', 'Bag'], ['skills', 'Skills'], ['room', 'Hideout'], ['style', 'Style'], ['chat', 'Nearby chat']];
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
    let options = { ...input }, destroyed = false, panel = '', opening = 0, readTickets = Object.create(null), pending = false, pollTimer = null;
    let boards = Object.create(null), notice = '', lastFrame = null, lastMapPaint = 0, lastSpeech = '', speechUntil = 0, lastChatId = '', lastChatAt = 0, renderedOpening = -1;
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
    if (options.toolsHost) { options.toolsHost.append(tools); tools.textContent = String(options.toolsLabel || 'World tools'); tools.setAttribute('aria-label', 'Open world tools: map, bag, skills, hideout, style and nearby chat'); }
    if (options.trackerHost) options.trackerHost.append(tracker);
    const dock = el('section', 'city-world__dock'); dock.hidden = true; dock.setAttribute('aria-label', 'World tools');
    const bar = el('div', 'city-world__dock-bar');
    const title = el('strong', '', 'World tools');
    const closeButton = el('button', 'city-world__close', '×'); closeButton.type = 'button'; closeButton.dataset.cityWorldClose = ''; closeButton.setAttribute('aria-label', 'Close world tools');
    bar.append(title, closeButton);
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
    function setNotice(value) { notice = String(value || ''); state.textContent = notice; }
    function current(token, owner) { return !destroyed && token === opening && owner === scope && owner === identity(); }
    function resultBody(result) { return result?.body && typeof result.body === 'object' ? result.body : {}; }
    async function read(kind, token = opening) {
      if (typeof options.onRead !== 'function') return null;
      const owner = scope, socialAtStart = boards.social, ticket = (readTickets[kind] || 0) + 1; readTickets[kind] = ticket;
      try {
        const result = await options.onRead(kind, { isCurrent: () => !destroyed && owner === scope && owner === identity() });
        if (!current(token, owner) || ticket !== readTickets[kind] || result?.ignored) return null;
        if (!result || result.code >= 400) {
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
        boards[kind] = resultBody(result);
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
      } catch { if (current(token, owner)) setNotice('Could not refresh this panel. Try again.'); return null; }
    }
    async function action(kind, payload) {
      if (pending || destroyed || !panel || typeof options.onAction !== 'function') return;
      if (options.recovery === true) { setNotice('Resolve your pending action receipt before making another choice.'); return; }
      const owner = scope, token = opening;
      pending = true; setNotice('Confirming your choice…'); render();
      try {
        const result = await options.onAction(kind, payload, {
          beforeDispatch: () => current(token, owner) && !!panel,
          isCurrent: () => !destroyed && owner === scope && owner === identity()
        });
        if (destroyed || owner !== scope || owner !== identity() || result?.ignored) return;
        if (result?.code >= 400) {
          if (current(token, owner)) setNotice(result.code === 499 ? 'That opening was closed before the choice was sent.'
            : result.code >= 500 ? 'Confirmation is unavailable. Check the action receipt before trying a new choice.'
            : caption(resultBody(result).error || 'Your choice could not be applied.'));
          return;
        }
        if (current(token, owner)) {
          if (kind === 'send-chat') { const field = content.querySelector('[data-city-nearby-input]'); if (field) field.value = ''; }
          setNotice(kind === 'send-chat' ? 'Message delivered to this district.' : kind === 'emote' ? 'Emote shared with your nearby room.' : 'Your choice is saved.');
          if (kind === 'send-chat' || kind === 'emote') showChatMessage(resultBody(result).message, true);
          await read(kind === 'equip' ? 'inventory' : kind === 'send-chat' || kind === 'emote' ? 'chat' : 'social', token);
        }
      } catch { if (current(token, owner)) setNotice('Confirmation is unavailable. Check the action receipt before trying a new choice.'); }
      finally { if (!destroyed && owner === scope && owner === identity()) { pending = false; if (panel) render(); } }
    }
    function open(id = 'map') {
      if (destroyed || !tabs.has(id)) return;
      if (typeof options.onBeforeOpen === 'function') options.onBeforeOpen();
      stopPolling(); clearSpeech(); opening++; readTickets = Object.create(null); panel = id; dock.hidden = false; dock.scrollTop = 0; tools.setAttribute('aria-expanded', 'true');
      setNotice(''); render(); changed(); content.focus({ preventScroll: true });
      if (id === 'bag') read('inventory');
      if (['room', 'style', 'chat'].includes(id)) read('social');
      else if (socialPreferences().chatEnabled === true) startPolling();
    }
    function close(focus = true) {
      clearSpeech();
      if (dock.hidden) return;
      stopPolling(); opening++; readTickets = Object.create(null); panel = ''; dock.hidden = true; clearRenderedListeners(); content.replaceChildren(); receiptBox.replaceChildren();
      tools.setAttribute('aria-expanded', 'false'); changed(); if (focus) tools.focus({ preventScroll: true });
      if (!destroyed && socialPreferences().chatEnabled === true) startPolling();
    }
    on(tools, 'click', () => dock.hidden ? open('map') : close());
    on(closeButton, 'click', () => close());
    on(navigation, 'click', event => { const tab = event.target.closest('[data-city-world-panel]'); if (tab && navigation.contains(tab)) open(tab.dataset.cityWorldPanel); });
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
    function renderMap() {
      heading(String(options.district?.name || 'Your neighborhood'), 'Choose a waypoint to walk there. People markers show approximate district presence.');
      const map = el('canvas', 'city-world__minimap'); map.width = 480; map.height = 320; map.dataset.cityMinimap = '';
      map.setAttribute('role', 'img'); map.setAttribute('aria-label', 'Neighborhood minimap with venue waypoints and your local walking position. Accessible destinations follow.');
      content.append(map);
      const grid = el('div', 'city-world__destination-grid');
      for (const venue of list(options.venues, 16)) {
        const go = button(venue.name, () => { close(false); options.onWaypoint?.(venue.id); });
        go.dataset.cityWaypoint = venue.id; grid.append(go);
      }
      content.append(grid); paintMap();
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
      if (!feed.children.length) feed.append(el('li', 'city-world__hint', 'The room is quiet. Say hello.'));
      content.append(feed);
      const form = el('form', 'city-world__chat-form'), text = el('input');
      text.type = 'text'; text.maxLength = 240; text.autocomplete = 'off'; text.placeholder = 'Say something to the neighborhood…'; text.setAttribute('aria-label', 'Message to nearby chat'); text.dataset.cityNearbyInput = '';
      const send = el('button', '', 'Send'); send.type = 'submit'; send.dataset.worldControl = 'send-chat'; send.disabled = pending || options.recovery === true; form.append(text, send);
      onRender(form, 'submit', event => { event.preventDefault(); if (!text.value.trim()) return; action('send-chat', { text: text.value }); });
      content.append(form, button('Refresh messages', () => read('chat')));
    }
    function render() {
      if (destroyed || !panel) return;
      const scroll = dock.scrollTop, active = document.activeElement;
      const focused = content.contains(active) || receiptBox.contains(active);
      const focusKey = active?.dataset?.worldControl || active?.getAttribute('aria-label');
      const preserveDraft = renderedOpening === opening;
      const drafts = new Map(preserveDraft ? Array.from(content.querySelectorAll('input,select'), field => [field.getAttribute('aria-label'), field.value]) : []);
      const selection = preserveDraft && active?.matches('input[type="text"]') ? [active.selectionStart, active.selectionEnd] : null;
      clearRenderedListeners(); content.replaceChildren(); receiptBox.replaceChildren();
      title.textContent = PANELS.find(([id]) => id === panel)?.[1] || 'World tools';
      for (const [id, tab] of tabs) tab.setAttribute('aria-pressed', String(id === panel));
      if (panel === 'map') renderMap(); else if (panel === 'bag') renderBag(); else if (panel === 'skills') renderSkills();
      else if (panel === 'room') renderRoom(); else if (panel === 'style') renderStyle(); else if (panel === 'chat') renderChat();
      for (const field of content.querySelectorAll('input,select')) if (drafts.has(field.getAttribute('aria-label'))) field.value = drafts.get(field.getAttribute('aria-label'));
      renderedOpening = opening;
      state.textContent = notice; dock.scrollTop = scroll;
      if (options.receipt) {
        receiptBox.append(el('strong', '', options.receipt.label || 'World action'), el('p', '', options.receipt.summary || ''));
        if (options.receipt.delta) receiptBox.append(el('p', '', options.receipt.delta));
        if (options.recovery === true && options.receipt.recovery?.sameKey === true && typeof options.onRetry === 'function') {
          const retry = button('Recover the same action', async () => {
            if (pending) return; const owner = scope, recover = options.onRetry; pending = true; render();
            try { await recover(); } finally { if (!destroyed && owner === scope && owner === identity()) { pending = false; if (panel) render(); } }
          }); retry.disabled = pending; retry.dataset.cityWorldRetry = ''; receiptBox.append(retry);
        }
      }
      if (focused) {
        const target = Array.from(dock.querySelectorAll('button,input,select')).find(node => !node.disabled && (node.dataset.worldControl || node.getAttribute('aria-label')) === focusKey) || content;
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
      context.fillStyle = '#47554b'; context.fillRect(0, 96, canvas.width, 72); context.fillRect(145, 0, 55, canvas.height);
      for (const obstacle of list(state.obstacles, 30)) { context.fillStyle = '#927854'; context.fillRect(obstacle.x * sx, obstacle.y * sy, obstacle.width * sx, obstacle.height * sy); }
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
      speech.replaceChildren(el('strong', '', name), el('span', '', copy)); speech.hidden = !roomy;
      dialogue.textContent = name + ': ' + copy; dialogue.hidden = roomy; speechUntil = now + 6500;
    }
    function clearSpeech() { speech.hidden = true; dialogue.hidden = true; speech.replaceChildren(); dialogue.textContent = ''; speechUntil = 0; }
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
    return {
      update(next) {
        if (destroyed || !next) return;
        options = { ...options, ...next }; const owner = identity();
        if (owner !== scope) {
          close(false); stopPolling(); scope = owner; boards = Object.create(null); options.social = null; options.chat = null; options.receipt = null; options.recovery = false;
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
        if (next.social) { boards.social = next.social; options.onLook?.(socialPreferences().outfit || 'classic'); if (socialPreferences().chatEnabled !== true) { delete boards.chat; options.chat = null; readTickets.chat = (readTickets.chat || 0) + 1; stopPolling(); clearSpeech(); } else startPolling(); }
        if (next.chat && socialPreferences().chatEnabled === true) boards.chat = next.chat;
        renderTracker(); if (panel) render();
      },
      frame(frame) {
        if (destroyed) return; lastFrame = frame;
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
      isOpen: () => !dock.hidden,
      panelHeight: () => dock.hidden ? 0 : dock.getBoundingClientRect().height,
      setHeight(value) { if (Number.isFinite(value)) { dock.style.setProperty('--city-world-height', Math.max(64, value) + 'px'); dock.classList.toggle('is-compact', value < 112); } },
      getState: () => ({ panel, opening, pending, scope, chatJoined: socialPreferences().chatEnabled === true }),
      destroy() { if (destroyed) return; close(false); destroyed = true; stopPolling(); readTickets = Object.create(null); boards = Object.create(null); clearRenderedListeners(); listeners.forEach(remove => remove()); tools.remove(); tracker.remove(); toolbar.remove(); dock.remove(); speech.remove(); }
    };
  }
  window.OmertaCityWorldUI = { mount, ambientPose };
})();
