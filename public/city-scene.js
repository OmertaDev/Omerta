/* The neighborhood is a local exploration view. Venues open the existing game screens. */
(function () {
  'use strict';

  const WORLD = { width: 960, height: 640 };
  const CELL = 16;
  const PLAYER_RADIUS = 7;
  const SPEED = 176;
  const ART = {
    'city-art-background': '/art/city-neighborhood-v1.png',
    'city-art-player-down': '/art/city-player-down-v1.png',
    'city-art-player-up': '/art/city-player-up-v1.png',
    'city-art-player-left': '/art/city-player-left-v1.png',
    'city-art-player-right': '/art/city-player-right-v1.png',
    'city-art-player-step': '/art/city-player-step-v1.png',
    'city-art-fixer': '/art/city-fixer-v1.png',
    'city-art-worker': '/art/city-worker-v1.png',
    'city-art-neighbor': '/art/city-neighbor-v1.png'
  };
  const VENUES = [
    { id: 'fixer', name: 'The Fixer', detail: 'Find a job', tab: 'streets', x: 144, y: 224,
      building: { x: 30, y: 0, width: 226, height: 194 }, labelY: 120, sign: 'BELLINI & SONS',
      description: 'Meet the neighborhood fixer. Pick a street job and see its requirements, risks, and rewards.' },
    { id: 'workshop', name: 'The Workshop', detail: 'Gear & crafting', tab: 'garage', x: 196, y: 504,
      building: { x: 54, y: 300, width: 285, height: 179 }, labelY: 410, sign: 'MOTOR WORKS',
      description: 'Open the garage to manage your cars and equipment, or craft consumables and ammunition in its workshop.' },
    { id: 'training', name: 'The Training Room', detail: 'Build your skills', tab: 'life', x: 606, y: 504,
      building: { x: 497, y: 294, width: 322, height: 185 }, labelY: 410, sign: 'IRON & BLOOD',
      description: 'Open The Life to inspect your skills, mastery, and progress toward the next milestone.' },
    { id: 'clubhouse', name: 'The Clubhouse', detail: 'Meet your crew', tab: 'crew', x: 784, y: 224,
      building: { x: 664, y: 0, width: 277, height: 196 }, labelY: 120, sign: 'THE SOCIAL CLUB',
      description: 'Open your crew headquarters to find shared operations and coordinate the next move.' },
    { id: 'stories', name: 'The Newsroom', detail: 'Follow a story', tab: 'desk', x: 396, y: 224,
      building: { x: 285, y: 0, width: 224, height: 194 }, labelY: 120, sign: 'THE EVENING POST',
      description: 'Visit the Content Desk to browse stories, mysteries, and authored jobs unfolding across the city.' },
    { id: 'waterfront', name: 'The Waterfront', detail: 'Travel & freight', tab: 'city', x: 740, y: 524,
      description: 'Check the city travel board, or visit the port to manage freight and shipments.' },
    { id: 'directory', name: 'The Street Directory', detail: 'Every place to play', tab: 'start', x: 404, y: 318,
      description: 'Find your next move, inspect your character, or choose any operation across the city.' }
  ];
  const OBSTACLES = VENUES.filter(v => v.building).map(v => ({ ...v.building })).concat([
    { x: 16, y: 286, width: 26, height: 38 },
    { x: 864, y: 428, width: 48, height: 50 },
    { x: 832, y: 502, width: 32, height: 34 }
  ]);

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function traversable(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 12 || x > WORLD.width - 12 || y < 20 || y > 540) return false;
    return !OBSTACLES.some(r => x + PLAYER_RADIUS > r.x && x - PLAYER_RADIUS < r.x + r.width &&
      y + PLAYER_RADIUS > r.y && y - PLAYER_RADIUS < r.y + r.height);
  }

  // Cardinal grid movement prevents paths cutting diagonally through building corners.
  function route(start, end) {
    const cols = WORLD.width / CELL;
    const rows = 34;
    const center = i => ({ x: (i % cols) * CELL + CELL / 2, y: Math.floor(i / cols) * CELL + CELL / 2 });
    const index = p => Math.max(0, Math.min(rows - 1, Math.floor(p.y / CELL))) * cols +
      Math.max(0, Math.min(cols - 1, Math.floor(p.x / CELL)));
    function closest(p) {
      let chosen = -1, distance = Infinity;
      for (let i = 0; i < cols * rows; i++) {
        const q = center(i);
        const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
        if (d < distance && traversable(q.x, q.y)) { distance = d; chosen = i; }
      }
      return chosen;
    }
    const originCandidate = index(start);
    const origin = traversable(center(originCandidate).x, center(originCandidate).y) ? originCandidate : closest(start);
    const goal = closest(end);
    if (origin < 0 || goal < 0) return [];
    const queue = [origin], previous = new Map([[origin, -1]]);
    for (let head = 0; head < queue.length; head++) {
      const current = queue[head];
      if (current === goal) break;
      const x = current % cols, y = Math.floor(current / cols);
      const neighbors = [];
      if (x > 0) neighbors.push(current - 1);
      if (x < cols - 1) neighbors.push(current + 1);
      if (y > 0) neighbors.push(current - cols);
      if (y < rows - 1) neighbors.push(current + cols);
      for (const next of neighbors) {
        const p = center(next);
        if (!previous.has(next) && traversable(p.x, p.y)) { previous.set(next, current); queue.push(next); }
      }
    }
    if (!previous.has(goal)) return [];
    const result = [];
    for (let step = goal; step !== -1; step = previous.get(step)) result.push(center(step));
    result.reverse();
    // Keep the origin cell so an off-grid player approaches its center before turning.
    return result;
  }

  function mount(host, options) {
    options = options || {};
    let district = options.district || {};
    let character = options.character || {};
    const reducedMotion = Boolean(options.reducedMotion);
    let destroyed = false, ready = false, game = null, scene = null, bootTimer = null;
    let player = null, selected = null, pendingVenue = null, path = [];
    let pathInk = null, destinationInk = null;
    const requestedPosition = options.position || {};
    const validPosition = traversable(requestedPosition.x, requestedPosition.y);
    const initialPosition = validPosition
      ? { x: requestedPosition.x, y: requestedPosition.y } : { x: 430, y: 366 };
    let playerFacing = validPosition && ['up', 'down', 'left', 'right'].includes(requestedPosition.facing) ? requestedPosition.facing : 'down';
    let lastPositionAt = 0, lastPosition = null;
    const artState = { background: 'fallback', player: 'fallback', npcs: 'fallback' };
    const keys = new Set();
    const heldMoves = new Set();
    const listeners = [];
    const root = element('section', 'omerta-city');
    root.setAttribute('aria-label', 'Explore your current neighborhood');
    const header = element('div', 'omerta-city__header');
    const heading = element('div');
    heading.append(element('div', 'omerta-city__eyebrow', 'The neighborhood'));
    const districtTitle = element('h3', 'omerta-city__title');
    heading.append(districtTitle);
    const territoryLabel = element('div', 'omerta-city__territory');
    header.append(heading, territoryLabel);
    function updateLabels() {
      districtTitle.textContent = String(district.name || 'Your district');
      const holder = district.occupier || district.holder;
      let territory = 'Territory · ' + String(district.state || 'unknown').replace(/_/g, ' ');
      const holderName = holder && typeof holder === 'object' ? holder.tag || holder.name : holder;
      if (holderName && typeof holderName === 'string') territory += ' · ' + holderName;
      territoryLabel.textContent = territory;
      if (scene && ready) scene.data.get('playerName').setText(String(character.name || 'You').slice(0, 26));
    }
    updateLabels();
    const hud = element('div', 'omerta-city__hud');
    hud.setAttribute('role', 'group');
    hud.setAttribute('aria-label', 'Character resources');
    const resourceGrid = element('dl', 'omerta-city__resources');
    resourceGrid.classList.add('omerta-city__resources--summary');
    const worldHud = element('div', 'omerta-city__world-hud');
    worldHud.setAttribute('role', 'group');
    worldHud.setAttribute('aria-label', 'Walking resources and readiness');
    const worldResources = element('dl', 'omerta-city__resources omerta-city__resources--walking');
    const resourceNodes = new Map();
    for (const [key, label] of [['cash', 'Cash'], ['health', 'Health'], ['energy', 'Energy'], ['nerve', 'Nerve'], ['heat', 'Heat'], ['level', 'Level']]) {
      const group = element('div', 'omerta-city__resource');
      group.dataset.cityResource = key;
      const value = element('dd');
      value.setAttribute('data-city-value', '');
      const meter = element('progress', 'omerta-city__resource-meter');
      meter.setAttribute('aria-label', label);
      meter.hidden = true;
      group.append(element('dt', '', label), value, meter);
      (['cash', 'health', 'energy', 'nerve'].includes(key) ? worldResources : resourceGrid).append(group);
      resourceNodes.set(key, { group, value, meter });
    }
    const progressRow = element('div', 'omerta-city__progress');
    const progressCopy = element('span');
    progressCopy.setAttribute('data-city-progress-text', '');
    const progressMeter = element('progress');
    progressMeter.setAttribute('data-city-progress', '');
    progressRow.append(progressCopy, progressMeter);
    const readiness = element('div', 'omerta-city__readiness');
    readiness.setAttribute('role', 'status');
    readiness.setAttribute('aria-live', 'polite');
    readiness.setAttribute('aria-atomic', 'true');
    const readinessLabel = element('strong');
    const readinessCopy = element('span');
    readiness.append(readinessLabel, readinessCopy);
    const journal = element('button', 'omerta-city__journal', 'Quest journal & fieldwork →');
    journal.type = 'button';
    journal.setAttribute('data-city-journal', '');
    hud.append(resourceGrid, progressRow, journal);
    worldHud.append(worldResources, readiness);
    const nextMove = element('div', 'omerta-city__next-move');
    const nextCopy = element('div');
    nextCopy.setAttribute('role', 'status');
    nextCopy.setAttribute('aria-live', 'polite');
    nextCopy.setAttribute('aria-atomic', 'true');
    nextCopy.append(element('span', 'omerta-city__eyebrow', 'Your next move'));
    const nextTitle = element('strong');
    const nextHint = element('p');
    nextCopy.append(nextTitle, nextHint);
    const nextButton = element('button', '', 'Go →');
    nextButton.type = 'button';
    nextButton.setAttribute('data-city-nextmove', '');
    nextMove.append(nextCopy, nextButton);
    const viewport = element('div', 'omerta-city__viewport');
    const mapLayer = element('div', 'omerta-city__map-layer');
    const canvasHost = element('div', 'omerta-city__canvas');
    const status = element('div', 'omerta-city__status', 'Opening the neighborhood…');
    status.setAttribute('role', 'status');
    const card = element('div', 'omerta-city__interaction');
    card.hidden = true;
    card.setAttribute('role', 'region');
    card.setAttribute('aria-label', 'Venue details');
    const cardTitle = element('h4', 'omerta-city__interaction-title');
    const cardText = element('p');
    const open = element('button', '', 'Open');
    open.type = 'button';
    open.setAttribute('data-city-open', '');
    const close = element('button', '', '×');
    close.type = 'button';
    close.setAttribute('data-city-close', '');
    close.setAttribute('aria-label', 'Close venue details');
    const cardControls = element('div', 'omerta-city__interaction-controls');
    cardControls.append(close);
    const actionList = element('div', 'omerta-city__actions');
    actionList.setAttribute('aria-label', 'Venue operations');
    const questCard = element('div', 'omerta-city__dialogue');
    const questTitle = element('strong');
    const questDialogue = element('p');
    const questButtons = element('div', 'omerta-city__quest-actions');
    questCard.append(questTitle, questDialogue, questButtons);
    questCard.hidden = true;
    let renderedActionSignature = '', renderedQuestSignature = '';
    card.append(cardControls, cardTitle, cardText, questCard, open, actionList);
    mapLayer.append(canvasHost, status, card);
    viewport.append(worldHud, mapLayer);
    const instructions = element('p', 'omerta-city__instructions');
    const walking = element('span');
    walking.append(element('strong', '', 'Tap to walk.'), document.createTextNode(' Focus the map for WASD / arrows.'));
    instructions.append(walking, element('span', '', 'E / Enter at a venue · Or choose a destination below'));
    const controls = element('div', 'omerta-city__controls');
    controls.setAttribute('aria-label', 'Neighborhood movement controls');
    const dpad = element('div', 'omerta-city__dpad');
    const moveButtons = new Map();
    for (const [direction, glyph] of [['up', '↑'], ['left', '←'], ['down', '↓'], ['right', '→']]) {
      const button = element('button', 'omerta-city__move', glyph);
      button.type = 'button';
      button.dataset.cityMove = direction;
      button.disabled = true;
      button.setAttribute('aria-label', 'Walk ' + direction);
      dpad.append(button);
      moveButtons.set(direction, button);
      listen(button, 'pointerdown', event => {
        if (!ready || !game || destroyed) return;
        event.preventDefault();
        game.canvas.focus({ preventScroll: true });
        hideVenue(false);
        stopMovement();
        heldMoves.add(direction);
        button.classList.add('is-held');
        button.setPointerCapture(event.pointerId);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, event, () => stopMovement());
      listen(button, 'keydown', event => {
        if (!ready || ![' ', 'Enter'].includes(event.key)) return;
        event.preventDefault();
        if (!event.repeat) { stopMovement(); heldMoves.add(direction); button.classList.add('is-held'); }
      });
      listen(button, 'keyup', event => { if ([' ', 'Enter'].includes(event.key)) { event.preventDefault(); stopMovement(); } });
      listen(button, 'blur', () => stopMovement());
    }
    const controlActions = element('div', 'omerta-city__control-actions');
    const interact = element('button', 'omerta-city__interact', 'Interact');
    interact.type = 'button';
    interact.disabled = true;
    interact.setAttribute('data-city-interact', '');
    const cancel = element('button', '', 'Stop walking');
    cancel.type = 'button';
    cancel.setAttribute('data-city-cancel', '');
    controlActions.append(interact, cancel, element('span', '', 'Hold an arrow to walk.'));
    controls.append(dpad, controlActions);
    listen(interact, 'click', () => { const venue = nearVenue(); if (venue) showVenue(venue); });
    listen(cancel, 'click', () => { stopMovement(); hideVenue(false); reportPosition(true); });
    const destinations = element('nav', 'omerta-city__destinations');
    destinations.setAttribute('aria-label', 'Neighborhood destinations');
    const buttons = new Map();
    for (const [i, venue] of VENUES.entries()) {
      const button = element('button', 'omerta-city__destination');
      button.type = 'button';
      button.dataset.destination = venue.id;
      button.setAttribute('aria-expanded', 'false');
      const copy = element('span');
      copy.append(element('span', 'omerta-city__destination-name', venue.name),
        element('span', 'omerta-city__destination-detail', venue.detail));
      button.append(element('span', 'omerta-city__destination-number', String(i + 1)), copy);
      destinations.append(button);
      buttons.set(venue.id, button);
      listen(button, 'click', () => showVenue(venue));
    }
    root.append(header, hud, nextMove, viewport, instructions, controls, destinations);
    host.replaceChildren(root);
    updateHud();

    function listen(target, event, callback, config) {
      target.addEventListener(event, callback, config);
      listeners.push(() => target.removeEventListener(event, callback, config));
    }
    function numeric(value) {
      if (value === null || value === undefined || value === '') return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }
    function format(value) { return value === null ? '—' : value.toLocaleString('en-US', { maximumFractionDigits: 1 }); }
    function setText(node, value) { if (node.textContent !== value) node.textContent = value; }
    function resourceState() {
      const progress = options.progress;
      return {
        cash: numeric(character.cash), health: numeric(character.health), maxHealth: numeric(character.maxHealth) ?? 100,
        energy: numeric(character.energy), maxEnergy: numeric(character.maxEnergy),
        nerve: numeric(character.nerve), maxNerve: numeric(character.maxNerve),
        heat: numeric(character.heat), level: numeric(character.level),
        progress: progress ? { respect: numeric(progress.respect), floor: numeric(progress.floor), next: numeric(progress.next), level: numeric(progress.level) } : null
      };
    }
    function updateHud() {
      const resources = resourceState();
      for (const [key, nodes] of resourceNodes) {
        const value = resources[key];
        const maximum = resources['max' + key[0].toUpperCase() + key.slice(1)];
        const copy = key === 'cash' && value !== null ? '$' + format(value)
          : format(value) + (maximum !== undefined && maximum !== null ? ' / ' + format(maximum) : '');
        setText(nodes.value, copy);
        nodes.meter.hidden = value === null || maximum === undefined || maximum === null || maximum <= 0;
        if (!nodes.meter.hidden) { nodes.meter.max = maximum; nodes.meter.value = Math.max(0, Math.min(value, maximum)); }
        nodes.group.classList.toggle('is-low', key === 'health' && value !== null && value < 30);
        nodes.group.classList.toggle('is-hot', key === 'heat' && value !== null && value >= 60);
      }
      const p = resources.progress;
      progressRow.hidden = !p || p.respect === null || p.floor === null || p.next === null || p.level === null || p.next <= p.floor;
      if (!progressRow.hidden) {
        setText(progressCopy, format(Math.max(0, p.next - p.respect)) + ' respect to level ' + format(p.level + 1));
        progressMeter.max = p.next - p.floor;
        progressMeter.value = Math.max(0, Math.min(p.respect - p.floor, progressMeter.max));
        progressMeter.setAttribute('aria-label', 'Progress to level ' + (p.level + 1));
      }
      let condition = { label: 'ON THE STREET', detail: 'Open a venue to see its operations.', tone: 'ready' };
      if (numeric(character.jailSeconds) > 0) condition = { label: 'LOCKUP', detail: 'Street actions are restricted. Open the Pen for your options.', tone: 'blocked' };
      else if (numeric(character.safeSeconds) > 0) condition = { label: 'SAFEHOUSE', detail: 'Offense and payouts are restricted while you are under.', tone: 'caution' };
      else if (character.law?.indicted) condition = { label: 'INDICTED', detail: 'Open The Law to inspect your case.', tone: 'blocked' };
      else if (character.wanted) condition = { label: 'WANTED', detail: 'Check The Law and your protection before taking another risk.', tone: 'blocked' };
      else if (numeric(character.hospSeconds) > 0) condition = { label: "DOC'S CARE", detail: 'Fighting is restricted while you recover.', tone: 'caution' };
      else if (resources.health !== null && resources.health < 30) condition = { label: 'LOW HEALTH', detail: 'Heal before taking a risky fight.', tone: 'caution' };
      readiness.dataset.tone = condition.tone;
      setText(readinessLabel, condition.label);
      setText(readinessCopy, condition.detail);
      fitWorldFrame();
      const quest = nextQuest(), coach = character.coach;
      nextMove.hidden = !quest && (!coach || (!coach.label && !coach.hint));
      nextMove.dataset.cityGuidance = quest ? 'quest' : 'coach';
      if (!nextMove.hidden) {
        setText(nextTitle, String(quest ? quest.title || 'Continue your quest' : coach.label || 'Your next move'));
        setText(nextHint, quest ? 'Visit ' + quest.venue.name + ' to continue your quest.' : String(coach.hint || ''));
        setText(nextButton, quest ? 'Visit →' : 'Go →');
        if (quest) nextButton.setAttribute('aria-label', 'Visit ' + quest.venue.name);
        else nextButton.removeAttribute('aria-label');
        nextButton.hidden = !quest && (typeof coach.tab !== 'string' || !coach.tab);
      } else {
        setText(nextTitle, ''); setText(nextHint, '');
        nextButton.hidden = true;
        nextButton.removeAttribute('aria-label');
      }
      journal.hidden = !VENUES.some(v => actionsFor(v).some(action => action.tab === 'fieldwork'));
    }
    function nextQuest() {
      for (const venue of VENUES) {
        const quest = options.npcQuests?.[venue.id];
        if (Array.isArray(quest?.actions) && quest.actions.some(action => action && typeof action.id === 'string'
          && action.id && action.id !== 'cancel' && action.available === true)) return { ...quest, venue };
      }
      return null;
    }
    function actionsFor(venue) {
      const supplied = options.venueActions || {};
      const source = venue.id === 'directory' ? Object.values(supplied).flatMap(list => Array.isArray(list) ? list : []) : supplied[venue.id] || [];
      const result = new Map([[venue.tab, { tab: venue.tab, label: venue.name, detail: '' }]]);
      for (const action of Array.isArray(source) ? source : []) {
        if (!action || typeof action.tab !== 'string' || !action.tab) continue;
        result.set(action.tab, { tab: action.tab, label: String(action.label || action.tab), detail: String(action.detail || '') });
      }
      return Array.from(result.values());
    }
    function navigate(tab, venueId) {
      reportPosition(true);
      if (typeof options.onNavigate === 'function') options.onNavigate(tab, { venueId });
    }
    function renderActions(venue) {
      const actions = actionsFor(venue);
      const signature = venue.id + ':' + JSON.stringify(actions);
      if (signature === renderedActionSignature) return;
      renderedActionSignature = signature;
      const focused = actionList.contains(document.activeElement) ? document.activeElement.dataset.cityAction : null;
      actionList.replaceChildren();
      for (const action of actions) {
        if (action.tab === venue.tab) continue;
        const button = element('button', 'omerta-city__action');
        button.type = 'button';
        button.dataset.cityAction = action.tab;
        button.append(element('strong', '', action.label));
        if (action.detail) button.append(element('span', '', action.detail));
        actionList.append(button);
      }
      actionList.hidden = !actionList.childElementCount;
      if (focused) (Array.from(actionList.children).find(button => button.dataset.cityAction === focused) || open).focus({ preventScroll: true });
    }
    function renderQuest(venue) {
      const quest = options.npcQuests?.[venue.id];
      const signature = venue.id + ':' + JSON.stringify(quest || null);
      if (signature === renderedQuestSignature) return;
      renderedQuestSignature = signature;
      const focused = questButtons.contains(document.activeElement) ? document.activeElement.dataset.cityQuestAction : null;
      questCard.hidden = !quest;
      questButtons.replaceChildren();
      if (quest) {
        setText(questTitle, String(quest.title || 'A word on the street'));
        setText(questDialogue, String(quest.dialogue || ''));
        for (const action of Array.isArray(quest.actions) ? quest.actions : []) {
          if (!action || typeof action.id !== 'string' || !action.id) continue;
          const button = element('button', '', String(action.label || action.id));
          button.type = 'button';
          button.dataset.cityQuestAction = action.id;
          button.disabled = action.available === false;
          const blockers = Array.isArray(action.blockedBy) ? action.blockedBy : action.blockedBy ? [action.blockedBy] : [];
          const blockerText = blockers.map(reason => typeof reason === 'string' ? reason : reason?.message || reason?.label || reason?.reason || reason?.code || '').filter(Boolean).join(' · ');
          if (button.disabled && blockerText) { button.title = blockerText; button.append(element('small', '', blockerText)); }
          questButtons.append(button);
        }
      }
      if (focused) (Array.from(questButtons.children).find(button => button.dataset.cityQuestAction === focused && !button.disabled) || open).focus({ preventScroll: true });
    }
    function stopMovement() {
      keys.clear(); heldMoves.clear(); path = []; pendingVenue = null;
      for (const button of moveButtons.values()) button.classList.remove('is-held');
      redrawPath();
    }
    function positionState() {
      const position = player || lastPosition || initialPosition;
      return { x: position.x, y: position.y, facing: playerFacing };
    }
    function reportPosition(force) {
      if (!player) return;
      const now = performance.now(), position = positionState();
      if (!force && (now - lastPositionAt < 500 || lastPosition && position.x === lastPosition.x && position.y === lastPosition.y && position.facing === lastPosition.facing)) return;
      lastPositionAt = now; lastPosition = position;
      if (typeof options.onPositionChange === 'function') {
        try { options.onPositionChange({ ...position }); } catch (_) { /* A storage failure must not stop play or teardown. */ }
      }
    }
    listen(nextButton, 'click', () => {
      const quest = nextQuest();
      if (quest) { showVenue(quest.venue); return; }
      const tab = character.coach?.tab;
      if (typeof tab === 'string' && tab) navigate(tab, VENUES.find(v => actionsFor(v).some(a => a.tab === tab))?.id || 'directory');
    });
    listen(journal, 'click', () => navigate('fieldwork', 'directory'));
    listen(questButtons, 'click', event => {
      const button = event.target.closest('[data-city-quest-action]');
      if (button && !button.disabled && selected && questButtons.contains(button) && typeof options.onQuestAction === 'function') {
        options.onQuestAction(selected.id, button.dataset.cityQuestAction);
      }
    });
    listen(actionList, 'click', event => {
      const button = event.target.closest('[data-city-action]');
      if (button && selected && actionList.contains(button)) navigate(button.dataset.cityAction, selected.id);
    });
    function showVenue(venue) {
      if (destroyed) return;
      selected = venue;
      pendingVenue = null;
      stopMovement();
      cardTitle.textContent = venue.name;
      cardText.textContent = venue.description;
      open.textContent = 'Open ' + venue.name + ' →';
      renderActions(venue);
      renderQuest(venue);
      card.hidden = false;
      card.scrollTop = 0;
      for (const [id, button] of buttons) button.setAttribute('aria-expanded', String(id === venue.id));
      revealVenue();
      open.focus({ preventScroll: true });
      open.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    function revealVenue(target = card, scroll = true) {
      const height = window.innerHeight;
      let top = 0, bottom = height;
      for (const id of ['top', 'vitals', 'bnav', 'toast']) {
        const chrome = document.getElementById(id);
        if (!chrome || !['fixed', 'sticky'].includes(window.getComputedStyle(chrome).position)) continue;
        if (id === 'toast' && !chrome.classList.contains('show')) continue;
        const bounds = chrome.getBoundingClientRect();
        if (!bounds.height || bounds.bottom <= 0 || bounds.top >= height) continue;
        if (id === 'bnav' || id === 'toast') bottom = Math.min(bottom, bounds.top);
        else top = Math.max(top, bounds.bottom);
      }
      card.style.setProperty('--city-card-height', Math.max(88, bottom - top - 16) + 'px');
      target.style.scrollMarginTop = (top + 8) + 'px';
      target.style.scrollMarginBottom = (height - bottom + 8) + 'px';
      if (scroll) target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    }
    function hideVenue(focusCanvas) {
      const previousVenue = selected;
      card.hidden = true;
      selected = null;
      for (const button of buttons.values()) button.setAttribute('aria-expanded', 'false');
      if (focusCanvas && game && game.canvas) game.canvas.focus({ preventScroll: true });
      else if (focusCanvas && previousVenue) {
        const destination = buttons.get(previousVenue.id);
        revealVenue(destination);
        destination.focus({ preventScroll: true });
      }
    }
    listen(open, 'click', () => {
      if (selected) navigate(selected.tab, selected.id);
    });
    listen(close, 'click', () => hideVenue(true));
    listen(card, 'keydown', event => {
      if (event.key === 'Escape') { event.preventDefault(); hideVenue(true); }
    });
    listen(window, 'resize', () => {
      if (card.hidden || !selected) return;
      // Address-bar and keyboard resizes must preserve the player's reading position.
      revealVenue(card, false);
    });
    function unavailable() {
      ready = false;
      if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
      root.classList.add('omerta-city--unavailable');
      status.textContent = 'The neighborhood view is unavailable. Choose a destination below to keep playing.';
      controls.hidden = true;
      if (game) { game.destroy(true); game = null; }
      scene = null; player = null;
    }
    function redrawPath() {
      if (!pathInk || !player) return;
      pathInk.clear();
      destinationInk.clear();
      if (!path.length) return;
      pathInk.lineStyle(2, 0xe8b34b, 0.28);
      pathInk.beginPath();
      pathInk.moveTo(player.x, player.y);
      for (const p of path) pathInk.lineTo(p.x, p.y);
      pathInk.strokePath();
      const goal = path[path.length - 1];
      destinationInk.lineStyle(2, 0xe8b34b, 0.8);
      destinationInk.strokeRect(goal.x - 6, goal.y - 6, 12, 12);
    }
    function nearVenue() {
      if (!player) return null;
      return VENUES.find(v => Math.hypot(v.x - player.x, v.y - player.y) < 42) || null;
    }
    function dimensions() {
      const phone = window.innerWidth <= 680;
      return { width: Math.max(phone ? 160 : 280, Math.round(canvasHost.clientWidth)), height: Math.max(phone ? 96 : 320, Math.round(canvasHost.clientHeight)) };
    }
    function fitWorldFrame() {
      if (destroyed) return;
      if (window.innerWidth > 680) {
        if (canvasHost.style.getPropertyValue('--city-map-height')) {
          canvasHost.style.removeProperty('--city-map-height');
          fitCamera();
        }
        return;
      }
      let top = 0, bottom = window.innerHeight;
      for (const id of ['top', 'vitals', 'bnav', 'toast']) {
        const chrome = document.getElementById(id), style = chrome && getComputedStyle(chrome);
        if (!chrome || !['fixed', 'sticky'].includes(style.position) || (id === 'toast' && !chrome.classList.contains('show'))) continue;
        const bounds = chrome.getBoundingClientRect();
        if (!bounds.height || bounds.bottom <= 0 || bounds.top >= window.innerHeight) continue;
        if (id === 'bnav' || id === 'toast') bottom = Math.min(bottom, bounds.top);
        else { const pinned = parseFloat(style.top); top = Math.max(top, style.position === 'sticky' && Number.isFinite(pinned) ? pinned + bounds.height : bounds.bottom); }
      }
      const height = Math.max(96, Math.min(440, Math.floor(bottom - top - worldHud.getBoundingClientRect().height - 16)));
      const value = height + 'px';
      if (canvasHost.style.getPropertyValue('--city-map-height') !== value) {
        canvasHost.style.setProperty('--city-map-height', value);
        fitCamera();
      }
    }
    const hudObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitWorldFrame) : null;
    if (hudObserver) hudObserver.observe(worldHud);
    listen(window, 'resize', fitWorldFrame);
    function fitCamera() {
      if (!scene || !game || !player) return;
      const size = dimensions();
      if (game.scale.width !== size.width || game.scale.height !== size.height) game.scale.resize(size.width, size.height);
      const camera = scene.cameras.main;
      const zoom = size.width >= 720 ? Math.min(size.width / WORLD.width, size.height / WORLD.height) : 0.82;
      camera.setZoom(zoom);
      camera.setBounds(0, 0, WORLD.width, WORLD.height);
      // Retain the avatar and its name above the feet in a short phone viewport.
      const followOffsetY = size.height < 160 ? (160 - size.height) / (2 * zoom) : 0;
      camera.startFollow(player, true, reducedMotion ? 1 : 0.16, reducedMotion ? 1 : 0.16, 0, followOffsetY);
      camera.centerOn(player.x, player.y - followOffsetY);
    }
    const resizeObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitCamera) : null;
    if (resizeObserver) resizeObserver.observe(canvasHost);
    else listen(window, 'resize', fitCamera);

    if (window.Phaser && typeof window.Phaser.Game === 'function') {
      try {
        const size = dimensions();
        game = new window.Phaser.Game({
          type: window.Phaser.CANVAS,
          width: size.width, height: size.height, parent: canvasHost,
          backgroundColor: '#273238', pixelArt: true, roundPixels: true,
          banner: false, audio: { noAudio: true },
          input: { keyboard: false, mouse: { preventDefaultWheel: false }, touch: { capture: false } },
          loader: { timeout: 8000, maxRetries: 0, maxParallelDownloads: 9 },
          scene: {
            preload: function () {
              if (destroyed) return;
              for (const [key, url] of Object.entries(ART)) this.load.image(key, url);
            },
            create: function () {
              if (destroyed) return;
              scene = this;
              try { createScene(this); } catch (error) { unavailable(); }
            },
            update: function (time, delta) { if (ready && !destroyed) updateScene(time, delta); }
          }
        });
        if (ready) fitCamera();
        else bootTimer = setTimeout(() => { if (!destroyed && !ready) unavailable(); }, 15000);
      } catch (error) { unavailable(); }
    } else unavailable();

    function createScene(s) {
      const label = (x, y, text, size, color, center) => s.add.text(x, y, text, {
        fontFamily: 'monospace', fontSize: size || 10, color: color || '#dfd1ad',
        resolution: 2, stroke: '#161719', strokeThickness: 2, padding: { x: 1, y: 1 }
      }).setOrigin(center ? 0.5 : 0, 0).setDepth(2);
      if (s.textures.exists('city-art-background')) {
        artState.background = 'generated';
        s.add.image(0, 0, 'city-art-background').setOrigin(0).setDisplaySize(WORLD.width, WORLD.height).setDepth(0);
        for (const v of VENUES.filter(v => v.building)) {
          s.add.text(v.building.x + v.building.width / 2, v.labelY, v.name.toUpperCase(), {
            fontFamily: 'monospace', fontSize: 14, fontStyle: 'bold', resolution: 2,
            color: '#f4dfad', backgroundColor: '#17191c',
            padding: { x: 7, y: 4 }
          }).setOrigin(0.5, 0).setDepth(2);
        }
      } else {
        let seed = 17;
        for (const c of String(district.id || district.name || 'omerta')) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
        const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const palette = [0x775247, 0x725b4c, 0x686152][seed % 3];
        const g = s.add.graphics();
        const rect = (x, y, w, h, color, alpha) => g.fillStyle(color, alpha === undefined ? 1 : alpha).fillRect(x, y, w, h);
        // Cobblestones, drainage channels, and the worn main road.
        rect(0, 0, 960, 640, 0x55564d);
        for (let y = 0; y < 560; y += 12) for (let x = 0; x < 960; x += 22) {
          const offset = y % 24 ? 11 : 0;
          const shade = [0x616256, 0x55574f, 0x5c5d51, 0x67655a][Math.floor(random() * 4)];
          rect(x + offset, y + 1, 20, 10, shade);
          rect(x + offset + 2, y + 2, 16, 1, 0x767468, 0.3);
        }
        rect(0, 248, 960, 48, 0x3e4445);
        rect(334, 226, 140, 326, 0x3e4445);
        rect(732, 210, 44, 342, 0x3e4445);
        for (let x = 0; x < 960; x += 24) { rect(x, 247, 21, 3, 0x9b9279); rect(x, 297, 21, 3, 0x9b9279); }
        for (let y = 306; y < 542; y += 24) { rect(331, y, 3, 21, 0x9b9279); rect(475, y, 3, 21, 0x9b9279); }
        for (let i = 0; i < 130; i++) {
          const x = Math.floor(random() * 960), y = 250 + Math.floor(random() * 43);
          rect(x, y, 2 + Math.floor(random() * 7), 1, 0x7c7967, 0.4);
        }
        // Canal and old stone quay; the water is a physical boundary.
        rect(0, 554, 960, 86, 0x243b43);
        for (let y = 562; y < 640; y += 12) for (let x = 0; x < 960; x += 48) {
          rect(x + Math.floor(random() * 25), y, 18 + Math.floor(random() * 26), 2, 0x456571, 0.55);
        }
        rect(0, 546, 960, 8, 0x8b8270);
        rect(0, 554, 960, 5, 0x1c2a30);
        for (let x = 0; x < 960; x += 36) { rect(x, 546, 2, 8, 0x514e46); rect(x + 6, 543, 15, 3, 0xb3a17b); }
        // Moored canal launch, ropes, bollards, and a timber landing.
        rect(724, 566, 188, 23, 0x222827);
        rect(724, 562, 182, 20, 0x775743);
        for (let x = 728; x < 903; x += 12) rect(x, 562, 2, 20, 0x483c33);
        rect(815, 586, 107, 33, 0x151e23);
        rect(805, 589, 114, 22, 0x775b42);
        rect(816, 592, 91, 16, 0xc1ad7d);
        rect(832, 580, 48, 18, 0x363e3b);
        rect(839, 582, 34, 11, 0x9faaa0);
        rect(891, 591, 8, 17, 0x3d4a46);
        for (let x = 68; x < 930; x += 160) { rect(x, 536, 6, 14, 0x25292a); rect(x - 3, 535, 12, 4, 0x2c3030); }
        label(480, 600, 'THE CANAL', 10, '#9bada8', true);

        function windowPane(x, y, w, h, lit) {
          rect(x - 3, y - 3, w + 6, h + 7, 0x3b3330);
          rect(x, y, w, h, lit ? 0xcc9e5c : 0x34423f);
          rect(x + 2, y + 2, Math.floor(w / 2) - 2, h - 5, lit ? 0xf2cc89 : 0x5d6b60);
          rect(x + Math.floor(w / 2), y, 3, h, 0x4b4135);
          rect(x - 4, y + h + 2, w + 8, 3, 0xa18b6f);
          rect(x, y + Math.floor(h / 2), w, 2, 0x594b39);
        }
        function building(venue, i) {
          const b = venue.building;
          rect(b.x + 8, b.y + 8, b.width, b.height, 0x1b2223, 0.62);
          rect(b.x, b.y, b.width, b.height, palette);
          for (let y = b.y + 20; y < b.y + b.height; y += 9) {
            rect(b.x + 4, y, b.width - 8, 1, 0x342f2b, 0.6);
            for (let x = b.x + (y % 18 ? 5 : 17); x < b.x + b.width - 5; x += 28) rect(x, y - 8, 1, 8, 0x3c322d, 0.45);
          }
          rect(b.x - 4, b.y, b.width + 8, 7, 0x2e3432);
          rect(b.x, b.y + 7, b.width, 11, 0x8e8170);
          rect(b.x + 8, b.y + 9, b.width - 16, 3, 0xb0a28c);
          rect(b.x - 3, b.y + 18, b.width + 6, 5, 0x3d3a34);
          rect(b.x - 3, b.y + b.height - 7, b.width + 6, 7, 0xaaa08a);
          rect(b.x + 20, b.y - 12, 24, 12, 0x5a4b40);
          rect(b.x + 17, b.y - 15, 30, 4, 0x938371);
          const count = i === 2 ? 3 : 4;
          const spacing = (b.width - 36) / count;
          for (let j = 0; j < count; j++) windowPane(Math.round(b.x + 18 + spacing * j), b.y + 37, Math.round(spacing - 16), 30, (j + i) % 3 !== 0);
          const doorX = venue.x - 13, doorY = b.y + b.height - 46;
          rect(doorX - 4, doorY - 4, 34, 46, 0x3a3330);
          rect(doorX, doorY, 26, 40, i === 3 ? 0x496152 : 0x554532);
          rect(doorX + 4, doorY + 4, 18, 14, 0xd0a163);
          rect(doorX + 4, doorY + 22, 18, 15, 0x3d352c);
          rect(doorX + 20, doorY + 23, 3, 3, 0xddbd72);
          rect(doorX - 6, b.y + b.height, 38, 5, 0xb3a389);
          rect(doorX - 10, b.y + b.height + 5, 46, 4, 0x8a8171);
          const signY = b.y + b.height - 74;
          rect(b.x + 10, signY, b.width - 20, 22, i === 3 ? 0x233d34 : 0x23282a);
          rect(b.x + 12, signY + 2, b.width - 24, 1, 0x9a7f51);
          label(b.x + b.width / 2, signY + 5, venue.sign, 10, '#ead6a1', true);
          if (i === 0 || i === 4) {
            const awningY = b.y + b.height - 48;
            rect(b.x + 9, awningY + 3, 48, 26, 0x8a594c);
            for (let x = b.x + 9; x < b.x + 57; x += 12) rect(x, awningY + 3, 6, 26, 0xd2b58a);
            rect(b.x + 8, awningY + 28, 50, 3, 0x332e29);
            windowPane(b.x + b.width - 54, b.y + b.height - 43, 32, 29, true);
          } else if (i === 1) {
            rect(b.x + 14, b.y + b.height - 48, 70, 40, 0x343b39);
            for (let y = b.y + b.height - 45; y < b.y + b.height - 8; y += 6) rect(b.x + 15, y, 68, 2, 0x65716a);
            rect(b.x + b.width - 40, b.y + 46, 14, 34, 0x403f39);
            rect(b.x + b.width - 43, b.y + 80, 20, 6, 0x8c8570);
          } else windowPane(b.x + 18, b.y + b.height - 43, 28, 29, true);
        }
        VENUES.filter(v => v.building).forEach(building);

        function lamp(x, y) {
          g.fillStyle(0xe8bc6c, 0.045).fillCircle(x, y, 40);
          g.fillStyle(0xe8bc6c, 0.05).fillCircle(x, y, 26);
          rect(x - 2, y - 37, 4, 37, 0x252b29);
          rect(x - 5, y - 2, 10, 4, 0x2c302c);
          rect(x - 8, y - 43, 16, 11, 0x3d4036);
          rect(x - 5, y - 41, 10, 8, 0xf4cf89);
          rect(x - 9, y - 46, 18, 3, 0x292e2b);
        }
        [[264, 244], [514, 252], [686, 250], [312, 518], [705, 528], [58, 526], [916, 272]].forEach(p => lamp(p[0], p[1]));
        function crate(x, y) {
          rect(x + 3, y + 3, 26, 26, 0x202725, 0.7);
          rect(x, y, 26, 26, 0x8a704b);
          rect(x + 3, y + 3, 20, 20, 0x604e35);
          rect(x, y + 10, 26, 4, 0xa48659);
          rect(x + 10, y, 4, 26, 0xa48659);
          rect(x, y, 26, 2, 0xc29d65);
        }
        crate(864, 428); crate(886, 452); crate(833, 506);
        function tree(x, y) {
          rect(x - 3, y - 8, 6, 28, 0x574737);
          rect(x - 16, y + 19, 32, 8, 0x464a3d);
          rect(x - 16, y - 32, 32, 22, 0x263e35);
          rect(x - 22, y - 24, 43, 16, 0x344a3b);
          rect(x - 13, y - 39, 26, 24, 0x405540);
          rect(x - 8, y - 36, 13, 5, 0x61704b);
          rect(x + 3, y - 15, 15, 5, 0x2b4035);
        }
        tree(28, 302);
        tree(942, 335);
        // A parked car, street drain, laundry line, and seating give the block a lived-in scale.
        rect(520, 268, 54, 24, 0x222a2b);
        rect(524, 264, 46, 23, 0x536d67);
        rect(535, 261, 23, 25, 0x718378);
        rect(538, 263, 17, 8, 0xabb6a0);
        rect(538, 276, 17, 8, 0x354d51);
        rect(525, 272, 4, 7, 0xdac79c);
        rect(566, 273, 3, 6, 0xc47d64);
        rect(527, 262, 8, 3, 0x202927); rect(558, 262, 8, 3, 0x202927);
        rect(527, 287, 8, 3, 0x202927); rect(558, 287, 8, 3, 0x202927);
        for (let x = 614; x < 634; x += 4) rect(x, 280, 2, 10, 0x252e2e);
        rect(554, 102, 99, 2, 0xa59978);
        [559, 580, 605, 631].forEach((x, i) => {
          rect(x, 105, 14, 19 + i % 2 * 7, [0xd2bb8a, 0x737b6c, 0x8f6755, 0xb8ad94][i]);
          rect(x + 5, 104, 3, 4, 0x463d2d);
        });
        rect(818, 335, 55, 6, 0x866d4b); rect(818, 346, 55, 6, 0x866d4b);
        rect(822, 341, 4, 17, 0x2b302a); rect(864, 341, 4, 17, 0x2b302a);
        label(404, 310, 'CANAL STREET', 10, '#b4b09b', true);
        // Bake thousands of masonry and paving pixels once, keeping mobile redraws light.
        g.generateTexture('city-neighborhood', WORLD.width, WORLD.height);
        g.destroy();
        s.add.image(0, 0, 'city-neighborhood').setOrigin(0).setDepth(0);
      }

      function personTexture(key, coat, hat, scarf) {
        const p = s.make.graphics({ x: 0, y: 0, add: false });
        const r = (x, y, w, h, color) => p.fillStyle(color).fillRect(x, y, w, h);
        p.fillStyle(0x101c20, 0.35).fillEllipse(12, 29, 20, 7);
        r(7, 24, 4, 5, 0x222c2b); r(14, 24, 4, 5, 0x222c2b);
        r(6, 12, 13, 14, coat); r(3, 14, 3, 10, coat); r(19, 14, 3, 10, coat);
        r(4, 23, 2, 3, 0xc39e75); r(19, 23, 2, 3, 0xc39e75);
        r(8, 6, 9, 9, 0xcfa97c); r(15, 9, 2, 2, 0x353b35);
        r(6, 6, 14, 3, hat); r(9, 2, 8, 5, hat); r(9, 3, 7, 1, 0x716652);
        r(9, 14, 7, 3, scarf); r(11, 17, 3, 7, scarf);
        r(8, 18, 1, 8, 0x85775b); r(16, 18, 1, 8, 0x85775b);
        p.generateTexture(key, 24, 34); p.destroy();
      }
      personTexture('city-player', 0x9b8966, 0x363d39, 0xd1af66);
      personTexture('city-fixer', 0x444d48, 0x252f2f, 0x9e6b55);
      personTexture('city-worker', 0x5e7270, 0x6e7160, 0x3f4a42);
      personTexture('city-neighbor', 0x896859, 0x403f35, 0xc0ab86);
      artState.player = s.textures.exists('city-art-player-down') ? 'generated' : 'fallback';
      const generatedNpcs = ['fixer', 'worker', 'neighbor'].filter(type => s.textures.exists('city-art-' + type)).length;
      artState.npcs = generatedNpcs === 3 ? 'generated' : generatedNpcs ? 'mixed' : 'fallback';
      pathInk = s.add.graphics().setDepth(3);
      destinationInk = s.add.graphics().setDepth(3);
      const markerObjects = [];
      VENUES.forEach((v, i) => {
        const marker = s.add.graphics().setDepth(4);
        marker.lineStyle(2, 0xe8b34b, 0.9).strokeRect(v.x - 10, v.y - 10, 20, 20);
        marker.fillStyle(0x1d2426, 0.95).fillRect(v.x - 8, v.y - 8, 16, 16);
        markerObjects.push(marker);
        s.add.text(v.x, v.y, String(i + 1), { fontFamily: 'monospace', fontSize: 12, color: '#e8b34b' }).setOrigin(0.5).setDepth(5);
      });
      const npcs = [
        { x: 117, y: 234, key: 'city-fixer', title: 'FIXER · NPC' },
        { x: 222, y: 526, key: 'city-worker', title: 'MECHANIC · NPC' },
        { x: 629, y: 502, key: 'city-fixer', title: 'TRAINER · NPC' },
        { x: 812, y: 224, key: 'city-fixer', title: 'DOORMAN · NPC' },
        { x: 418, y: 244, key: 'city-neighbor', title: 'EDITOR · NPC' },
        { x: 875, y: 398, key: 'city-neighbor' },
        { x: 322, y: 280, key: 'city-worker' }
      ].map(n => {
        const generatedKey = n.key.replace('city-', 'city-art-');
        const generated = s.textures.exists(generatedKey);
        const sprite = s.add.sprite(n.x, n.y, generated ? generatedKey : n.key)
          .setOrigin(0.5, generated ? 58 / 60 : 0.85).setDepth(n.y);
        if (n.title) label(n.x, n.y - (generated ? 72 : 48), n.title, generated ? 11 : 9, '#e5dfc7', true).setDepth(n.y + 1);
        return { ...n, sprite };
      });
      const playerRing = s.add.graphics().setDepth(350);
      playerRing.lineStyle(2, 0xe8b34b, 0.95).strokeEllipse(0, 0, artState.player === 'generated' ? 34 : 25, 13);
      player = s.add.sprite(initialPosition.x, initialPosition.y, artState.player === 'generated' ? 'city-art-player-down' : 'city-player')
        .setOrigin(0.5, artState.player === 'generated' ? 58 / 60 : 0.85).setDepth(initialPosition.y);
      const playerName = s.add.text(initialPosition.x, initialPosition.y - 72, String(character.name || 'You').slice(0, 26), {
        fontFamily: 'monospace', fontSize: artState.player === 'generated' ? 14 : 10, resolution: 2,
        color: '#f3d187', stroke: '#151d1e', strokeThickness: 3
      }).setOrigin(0.5).setDepth(367);
      s.data.set('playerRing', playerRing);
      s.data.set('playerName', playerName);
      s.data.set('npcs', npcs);
      s.data.set('markers', markerObjects);
      const canvas = s.sys.game.canvas;
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Playable neighborhood map. Tap to walk, or focus and use arrow keys or WASD. E or Enter opens a nearby venue. Destination buttons below provide the same access.');
      listen(canvas, 'keydown', event => {
        if (document.activeElement !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
          event.preventDefault();
          keys.add(key); heldMoves.clear(); path = []; pendingVenue = null; redrawPath();
        } else if (key === 'e' || key === 'enter') {
          event.preventDefault(); const venue = nearVenue(); if (venue) showVenue(venue);
        } else if (key === 'escape') { event.preventDefault(); stopMovement(); hideVenue(false); }
      });
      listen(canvas, 'keyup', event => {
        const key = event.key.toLowerCase();
        if (keys.has(key)) { keys.delete(key); event.preventDefault(); }
      });
      listen(canvas, 'blur', () => stopMovement());
      listen(window, 'blur', () => stopMovement());
      listen(document, 'visibilitychange', () => {
        if (document.hidden) stopMovement();
      });
      s.input.on('pointerdown', pointer => {
        canvas.focus({ preventScroll: true });
        hideVenue(false);
        stopMovement();
        const point = s.cameras.main.getWorldPoint(pointer.x, pointer.y);
        const venue = VENUES.find(v => Math.hypot(point.x - v.x, point.y - v.y) < 35 ||
          (v.building && point.x >= v.building.x && point.x <= v.building.x + v.building.width &&
           point.y >= v.building.y && point.y <= v.building.y + v.building.height));
        if (venue && Math.hypot(player.x - venue.x, player.y - venue.y) < 42) { showVenue(venue); return; }
        const target = venue || point;
        pendingVenue = venue || null;
        path = route(player, target);
        redrawPath();
      });
      ready = true;
      for (const button of moveButtons.values()) button.disabled = false;
      if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
      status.textContent = '';
      fitCamera();
      updateScene(0, 0);
      reportPosition(true);
    }

    function updateScene(time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      const previousX = player.x, previousY = player.y;
      let dx = 0, dy = 0, moving = false;
      if (game && document.activeElement === game.canvas) {
        dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
        dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      }
      dx += Number(heldMoves.has('right')) - Number(heldMoves.has('left'));
      dy += Number(heldMoves.has('down')) - Number(heldMoves.has('up'));
      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        const stepX = dx / length * SPEED * dt, stepY = dy / length * SPEED * dt;
        if (traversable(player.x + stepX, player.y)) player.x += stepX;
        if (traversable(player.x, player.y + stepY)) player.y += stepY;
        moving = true;
      } else if (path.length) {
        const point = path[0];
        const distance = Math.hypot(point.x - player.x, point.y - player.y);
        if (distance < SPEED * dt + 0.25) {
          player.setPosition(point.x, point.y);
          path.shift();
          if (!path.length) { redrawPath(); if (pendingVenue) showVenue(pendingVenue); }
        } else {
          const nextX = player.x + (point.x - player.x) / distance * SPEED * dt;
          const nextY = player.y + (point.y - player.y) / distance * SPEED * dt;
          if (traversable(nextX, nextY)) player.setPosition(nextX, nextY);
          else { path = []; pendingVenue = null; redrawPath(); }
        }
        moving = true;
      }
      const movedX = player.x - previousX, movedY = player.y - previousY;
      moving = Math.hypot(movedX, movedY) > 0.01;
      if (moving) {
        if (Math.abs(movedX) > Math.abs(movedY)) playerFacing = movedX < 0 ? 'left' : 'right';
        else playerFacing = movedY < 0 ? 'up' : 'down';
      }
      if (artState.player === 'generated') {
        let texture = 'city-art-player-' + playerFacing;
        if (!scene.textures.exists(texture)) texture = 'city-art-player-down';
        if (!reducedMotion && moving && playerFacing === 'down' && Math.floor(time / 150) % 2 && scene.textures.exists('city-art-player-step')) {
          texture = 'city-art-player-step';
        }
        if (player.texture.key !== texture) player.setTexture(texture);
        player.setFlipX(false).setScale(1);
      } else {
        if (moving && movedX) player.setFlipX(movedX < 0);
        player.setScale(1, !reducedMotion && moving ? 1 + Math.sin(time / 95) * 0.025 : 1);
      }
      player.setDepth(player.y);
      const ring = scene.data.get('playerRing');
      ring.setPosition(Math.round(player.x), Math.round(player.y + 1)).setDepth(player.y - 1);
      const name = scene.data.get('playerName');
      name.setPosition(Math.round(player.x), Math.round(player.y - (artState.player === 'generated' ? 72 : 40))).setDepth(player.y + 1);
      if (!reducedMotion) {
        scene.data.get('npcs').forEach((npc, i) => {
          if (!npc.title) npc.sprite.x = npc.x + Math.sin(time / 2300 + i) * 13;
        });
      }
      const nearby = nearVenue();
      interact.disabled = !nearby;
      interact.textContent = nearby ? 'Talk at ' + nearby.name : 'Interact';
      const nextStatus = nearby && card.hidden ? nearby.name + ' · Press E / Enter or tap to open' : '';
      if (status.textContent !== nextStatus) status.textContent = nextStatus;
      reportPosition(false);
    }

    return {
      update: function (nextOptions) {
        if (destroyed || !nextOptions) return;
        if (nextOptions.district) district = nextOptions.district;
        if (nextOptions.character) character = nextOptions.character;
        if (typeof nextOptions.onNavigate === 'function') options.onNavigate = nextOptions.onNavigate;
        if (typeof nextOptions.onPositionChange === 'function') options.onPositionChange = nextOptions.onPositionChange;
        if (typeof nextOptions.onQuestAction === 'function') options.onQuestAction = nextOptions.onQuestAction;
        for (const key of ['venueActions', 'progress', 'npcQuests']) if (key in nextOptions) options[key] = nextOptions[key];
        updateLabels();
        updateHud();
        if (selected) { renderActions(selected); renderQuest(selected); }
      },
      destroy: function () {
        if (destroyed) return;
        reportPosition(true);
        destroyed = true; ready = false;
        if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
        if (resizeObserver) resizeObserver.disconnect();
        if (hudObserver) hudObserver.disconnect();
        listeners.forEach(remove => remove());
        keys.clear(); heldMoves.clear(); path = []; selected = null; pendingVenue = null;
        if (game) { game.destroy(true); game = null; }
        player = null; scene = null;
        root.remove();
      },
      getState: function () {
        const camera = scene && scene.cameras.main;
        return {
          ready, reducedMotion, art: { ...artState }, facing: playerFacing,
          resources: resourceState(), position: positionState(), selectedVenue: selected?.id || null,
          actions: Object.fromEntries(VENUES.map(v => [v.id, actionsFor(v)])),
          player: player ? { x: player.x, y: player.y } : null,
          destinations: VENUES.map(v => ({ id: v.id, x: v.x, y: v.y, tab: v.tab })),
          obstacles: OBSTACLES.map(r => ({ ...r })),
          ambient: scene && ready ? scene.data.get('npcs').filter(n => !n.title).map(n => ({ x: n.sprite.x, y: n.sprite.y })) : [],
          camera: camera ? { x: camera.worldView.x, y: camera.worldView.y, zoom: camera.zoom, width: camera.width, height: camera.height } : null,
          world: { ...WORLD }, pathLength: path.length
        };
      }
    };
  }

  window.OmertaCityScene = { mount };
})();
