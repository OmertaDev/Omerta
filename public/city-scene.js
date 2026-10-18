/* One connected city; district access and home ownership remain server-authoritative. */
(function () {
  'use strict';

  const WORLD = { width: 960, height: 640 };
  const CELL = 16;
  const PLAYER_RADIUS = 7;
  const SPEED = 176;
  const ART = {
    'city-art-background': '/art/city-neighborhood-v2.png',
    'city-art-player-down': '/art/city-player-down-v2.png',
    'city-art-player-up': '/art/city-player-up-v2.png',
    'city-art-player-left': '/art/city-player-left-v2.png',
    'city-art-player-right': '/art/city-player-right-v2.png',
    'city-art-player-step': '/art/city-player-step-v2.png',
    'city-art-fixer': '/art/city-fixer-v2.png',
    'city-art-worker': '/art/city-worker-v2.png',
    'city-art-neighbor': '/art/city-neighbor-v2.png'
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
  const ACTOR_PAGE_SIZE = 24;
  const ACTIVITY_AGE = 60000, ACTIVITY_DURATION = 6000, ACTIVITY_MEMORY = 256;
  const ACTIVITY_KINDS = {
    work: ['WORK', 0xe8b34b], train: ['TRAINING', 0xb9d99b], trade: ['TRADE', 0xe2c48b],
    social: ['SOCIAL', 0x9ccfbe], move: ['TRAVEL', 0xa9cae5], fight: ['FIGHT', 0xe5a49a],
    craft: ['CRAFT', 0xd2bc99], rest: ['REST', 0x9fc7d1], property: ['PROPERTY', 0xcab8df],
    play: ['PLAY', 0xcbb1db], race: ['RACE', 0x9bbfdc]
  };
  const REGIONS = {
    docks: { ground: 0x55564d, road: 0x3e4445, water: 0x243b43 },
    brick: { ground: 0x735c4d, road: 0x493b35, water: 0x3e4037, landmark: { name: 'Kiln Square', x: 548, y: 52, width: 80, height: 112 } },
    cathedral: { ground: 0x63705d, road: 0x444d47, water: 0x35483e, landmark: { name: 'Bell Gardens', x: 530, y: 32, width: 112, height: 144 } },
    foundry: { ground: 0x645f57, road: 0x373d40, water: 0x2d393b, landmark: { name: 'Iron Yard', x: 544, y: 48, width: 88, height: 120 } },
    canal: { ground: 0x5f6c63, road: 0x3d4946, water: 0x294e51, landmark: { name: 'Lockkeeper Garden', x: 542, y: 44, width: 96, height: 128 } },
    neon: { ground: 0x635860, road: 0x3d3540, water: 0x353a4b, landmark: { name: 'Lantern Court', x: 544, y: 44, width: 88, height: 128 } }
  };
  let instanceSequence = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function traversable(x, y, world = WORLD, obstacles = OBSTACLES, walkBottom = 540) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
    if (x < 12 || x > world.width - 12 || y < 20 || y > walkBottom) return false;
    return !obstacles.some(r => x + PLAYER_RADIUS > r.x && x - PLAYER_RADIUS < r.x + r.width &&
      y + PLAYER_RADIUS > r.y && y - PLAYER_RADIUS < r.y + r.height);
  }

  // Cardinal grid movement prevents paths cutting diagonally through building corners.
  function route(start, end, world = WORLD, obstacles = OBSTACLES, walkBottom = 540) {
    const cols = Math.floor(world.width / CELL);
    const rows = Math.ceil(walkBottom / CELL);
    const walk = (x, y) => traversable(x, y, world, obstacles, walkBottom);
    const center = i => ({ x: (i % cols) * CELL + CELL / 2, y: Math.floor(i / cols) * CELL + CELL / 2 });
    const index = p => Math.max(0, Math.min(rows - 1, Math.floor(p.y / CELL))) * cols +
      Math.max(0, Math.min(cols - 1, Math.floor(p.x / CELL)));
    function closest(p) {
      let chosen = -1, distance = Infinity;
      for (let i = 0; i < cols * rows; i++) {
        const q = center(i);
        const d = Math.abs(q.x - p.x) + Math.abs(q.y - p.y);
        if (d < distance && walk(q.x, q.y)) { distance = d; chosen = i; }
      }
      return chosen;
    }
    const originCandidate = index(start);
    const origin = walk(center(originCandidate).x, center(originCandidate).y) ? originCandidate : closest(start);
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
        if (!previous.has(next) && walk(p.x, p.y)) { previous.set(next, current); queue.push(next); }
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
    let region = REGIONS[district.id] || REGIONS.docks;
    const layout = window.CityWorldLayout;
    let origin = layout?.getDistrict(district.id)?.origin || { x: 0, y: 0 };
    const world = layout ? { x: -origin.x, y: -origin.y, width: layout.world.width, height: layout.world.height, origin: { ...origin } } : { ...WORLD };
    const globalPoint = p => ({ x: p.x + origin.x, y: p.y + origin.y });
    const localPoint = p => ({ x: p.x - origin.x, y: p.y - origin.y });
    const localRect = r => ({ ...r, ...localPoint(r) });
    const cityNavigator = layout?.createNavigator({ obstacles: layout.districts.flatMap(place => {
      const items = [...OBSTACLES];
      if (REGIONS[place.id]?.landmark) items.push(REGIONS[place.id].landmark);
      // The docks keep their quay; the suburb can be reached around either end.
      if (place.id === 'docks') items.push({ x: 0, y: 554, width: WORLD.width, height: 86 });
      return items.map(r => ({ x: r.x + place.origin.x, y: r.y + place.origin.y, width: r.width, height: r.height }));
    }) });
    let cityRoads = layout?.roads.map(localRect) || null;
    let walkBottom = district.id === 'docks' || !REGIONS[district.id] ? 540 : WORLD.height - 20;
    let obstacles = baseObstacles();
    let homeBoard = null, homes = [], exits = [], selectedHome = null, selectedExit = null;
    const homeSlots = new Map(), homeMarkers = new Map(), exitLabels = new Map(), permeableHomes = new Set();
    let extensionGround = null, regionInk = null, cityGround = null, suburbInk = null, suburbStamp = '', visiblePlots = 0;
    const cityLabels = [];
    let crossingPending = false, crossingMessage = '', crossingSequence = 0, pendingPlot = null;
    const canWalk = (x, y) => cityNavigator ? cityNavigator.isWalkable(globalPoint({ x, y })) : traversable(x, y, world, obstacles, walkBottom);
    const findRoute = (start, end) => cityNavigator ? cityNavigator.route(globalPoint(start), globalPoint(end)).map(localPoint) : route(start, end, world, obstacles, walkBottom);
    if (!layout) world.width = widthForHomes(district.deeds);
    const reducedMotion = Boolean(options.reducedMotion);
    let destroyed = false, ready = false, game = null, scene = null, bootTimer = null;
    let worldUI = null, worldOpening = false, look = 'classic';
    let trackedObjectiveId = null, trackedVenueId = null, venueStateSignature = '';
    let routePreview = [], routePreviewVenue = null;
    let zoomPreference = 1, resourceReceipt = null;
    const seenResourceReceipts = new Set();
    let externalPanel = options.externalPanel === true, activityTimer = null, activitySignature = '', activityHudLayout = '';
    const activities = new Map(), seenActivities = new Set();
    const lookTints = { classic: 0xffffff, moss: 0x9aad80, wine: 0xba8790, ink: 0x8795ae };
    let player = null, selected = null, pendingVenue = null, pendingHome = null, pendingExit = null, queuedHome = null, queuedVenue = null, path = [];
    let gameKind = '', gameOpening = 0, gameReturn = null, venueOpening = 0;
    let pathInk = null, destinationInk = null;
    let clearPlayerNameClamp = null;
    const actorSprites = new Map();
    let actorPage = 0, selectedActor = null, pendingActor = null, actorOpening = 0, actorView = '', actorReturn = null;
    let paging = false, encounterPending = false, pagingNotice = '', actorNotice = '', actorRenderSignature = '', presenceSignature = '';
    const sceneIdentity = () => [character.id, character.generation, district.id].join(':');
    const requestedPosition = options.position || {};
    const validPosition = canWalk(requestedPosition.x, requestedPosition.y) && (!layout || layout.regionAt(globalPoint(requestedPosition))?.id === district.id);
    const initialPosition = validPosition
      ? { x: requestedPosition.x, y: requestedPosition.y } : { x: 430, y: 366 };
    let playerFacing = validPosition && ['up', 'down', 'left', 'right'].includes(requestedPosition.facing) ? requestedPosition.facing : 'down';
    let lastPositionAt = 0, lastPosition = null;
    const artState = { background: 'fallback', player: 'fallback', npcs: 'fallback' };
    const keys = new Set();
    const heldMoves = new Set();
    const listeners = [];
    listen(document, 'keydown', event => { if (queuedHome && (event.key === 'Escape' || /^(arrow(up|down|left|right)|[wasd])$/i.test(event.key))) queuedHome = null; });
    listen(document, 'visibilitychange', () => { if (document.hidden) queuedHome = null; });
    listen(window, 'blur', () => { queuedHome = null; });
    const root = element('section', 'omerta-city');
    root.setAttribute('aria-label', layout ? 'Explore the connected city' : 'Explore your current neighborhood');
    for (const type of ['click', 'pointerdown', 'keydown']) listen(root, type, event => {
      if (externalPanel && event.target?.closest('button, a, input, select, textarea, canvas, summary')) {
        event.preventDefault(); event.stopImmediatePropagation();
      }
    }, true);
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
    const worldHead = element('div', 'omerta-city__world-head');
    const worldMapButton = element('button', 'omerta-city__world-map', 'Travel');
    worldMapButton.type = 'button'; worldMapButton.setAttribute('data-city-world-map', '');
    worldMapButton.setAttribute('aria-label', 'Travel: district routes and street homes');
    listen(worldMapButton, 'click', openWorldMap);
    const recenter = element('button', 'omerta-city__recenter', 'Find me');
    recenter.type = 'button'; recenter.setAttribute('data-city-recenter', '');
    recenter.setAttribute('aria-label', 'Center the map on your character');
    listen(recenter, 'click', centerPlayer);
    const zoomOut = element('button', 'omerta-city__zoom', '−');
    const zoomIn = element('button', 'omerta-city__zoom', '+');
    for (const [button, direction, label] of [[zoomOut, -1, 'Zoom out'], [zoomIn, 1, 'Zoom in']]) {
      button.type = 'button'; button.dataset.cityZoom = String(direction);
      button.setAttribute('aria-label', label);
      listen(button, 'click', () => {
        zoomPreference = Math.max(.65, Math.min(1.6, Math.round((zoomPreference + direction * .15) * 100) / 100));
        fitCamera();
      });
    }
    const resourceHelp = element('div', 'omerta-city__resource-help');
    resourceHelp.hidden = true; resourceHelp.setAttribute('role', 'region');
    resourceHelp.id = 'city-resource-help-' + (++instanceSequence);
    resourceHelp.setAttribute('aria-label', 'Resource help');
    const helpCopy = element('p');
    const helpAction = element('button'); helpAction.type = 'button';
    const helpClose = element('button', '', 'Close'); helpClose.type = 'button';
    let helpVenue = null, helpTrigger = null, helpKey = null;
    listen(helpAction, 'click', () => { closeResourceHelp(false); if (helpVenue) showVenue(helpVenue); });
    listen(helpClose, 'click', () => closeResourceHelp(true));
    listen(resourceHelp, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); closeResourceHelp(true); } });
    resourceHelp.append(helpCopy, helpAction, helpClose);
    const resourceNodes = new Map();
    for (const [key, label] of [['cash', 'Cash'], ['health', 'Health'], ['energy', 'Energy'], ['nerve', 'Nerve'], ['heat', 'Heat'], ['level', 'Level']]) {
      const group = element('div', 'omerta-city__resource');
      group.dataset.cityResource = key;
      const value = element('dd');
      value.setAttribute('data-city-value', '');
      const meter = element('progress', 'omerta-city__resource-meter');
      meter.setAttribute('aria-label', label);
      meter.hidden = true;
      const term = element('dt');
      const explain = element('button', 'omerta-city__resource-label', label);
      explain.type = 'button'; explain.setAttribute('aria-label', label + ' help');
      explain.setAttribute('aria-expanded', 'false'); explain.setAttribute('aria-controls', resourceHelp.id);
      listen(explain, 'click', () => showResourceHelp(key, explain));
      term.append(explain);
      const bonus = element('span', 'omerta-city__resource-bonus'); bonus.hidden = true;
      const delta = element('span', 'omerta-city__resource-delta'); delta.hidden = true;
      delta.setAttribute('data-city-resource-delta', '');
      group.append(term, value, bonus, delta, meter);
      (['cash', 'health', 'energy', 'nerve'].includes(key) ? worldResources : resourceGrid).append(group);
      resourceNodes.set(key, { group, value, meter, bonus, delta });
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
    hud.append(resourceGrid, progressRow);
    const mapTools = element('div', 'omerta-city__map-tools');
    mapTools.append(recenter, worldMapButton, zoomOut, zoomIn);
    worldHead.append(worldResources);
    worldHud.append(worldHead, readiness, mapTools, resourceHelp);
    const presenceCaption = element('p', 'omerta-city__presence-caption', 'District presence · positions and activity paths are approximate');
    presenceCaption.hidden = true;
    worldHud.append(presenceCaption);
    const activityStatus = element('div', 'omerta-city__activity');
    activityStatus.dataset.cityActivity = ''; activityStatus.hidden = true;
    activityStatus.setAttribute('role', 'status'); activityStatus.setAttribute('aria-live', 'polite');
    activityStatus.setAttribute('aria-atomic', 'true');
    worldHud.append(activityStatus);
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
    const actorDock = element('section', 'omerta-city__actor-dock');
    actorDock.hidden = true;
    actorDock.setAttribute('aria-label', 'People and street intel');
    const actorDockControls = element('div', 'omerta-city__actor-controls');
    const actorClose = element('button', '', '×');
    actorClose.type = 'button'; actorClose.setAttribute('data-city-actor-close', '');
    actorClose.setAttribute('aria-label', 'Close people and intel');
    actorDockControls.append(actorClose);
    const actorBody = element('div', 'omerta-city__actor-body');
    actorBody.tabIndex = -1;
    actorDock.append(actorDockControls, actorBody);
    const gameDock = element('section', 'omerta-city__training omerta-city__gameplay');
    gameDock.hidden = true;
    const gameControls = element('div', 'omerta-city__training-controls');
    const gameClose = element('button', '', '×');
    gameClose.type = 'button'; gameClose.setAttribute('data-city-gameplay-close', '');
    gameClose.setAttribute('data-city-training-close', '');
    const gameBody = element('div', 'omerta-city__training-body');
    gameBody.tabIndex = -1;
    gameControls.append(gameClose); gameDock.append(gameControls, gameBody);
    viewport.append(worldHud, mapLayer, actorDock, gameDock);
    const instructions = element('p', 'omerta-city__instructions');
    const walking = element('span');
    walking.append(element('strong', '', 'Tap a place to walk there.'));
    const keyboardHelp = element('span', 'omerta-city__keyboard-help', 'WASD / arrows to walk · E / Enter to interact');
    instructions.append(walking, keyboardHelp);
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
        if (!ready || !game || destroyed || externalPanel || crossingPending) return;
        event.preventDefault();
        game.canvas.focus({ preventScroll: true });
        hideGameDock(false);
        hideVenue(false);
        stopMovement();
        heldMoves.add(direction);
        button.classList.add('is-held');
        button.setPointerCapture(event.pointerId);
      });
      for (const event of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(button, event, () => stopMovement());
      listen(button, 'keydown', event => {
        if (!ready || externalPanel || crossingPending || ![' ', 'Enter'].includes(event.key)) return;
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
    const nearbyCopy = element('span', 'omerta-city__nearby', 'Move near a person or place to interact.');
    nearbyCopy.id = 'city-nearby-' + (++instanceSequence);
    interact.setAttribute('aria-describedby', nearbyCopy.id);
    const cancel = element('button', '', 'Stop walking');
    cancel.type = 'button';
    cancel.setAttribute('data-city-cancel', '');
    controlActions.append(interact, cancel, nearbyCopy);
    controls.append(dpad, controlActions);
    listen(interact, 'click', () => inspectNearby());
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
      const state = element('span', 'omerta-city__destination-state'); state.setAttribute('data-city-destination-state', '');
      copy.append(state);
      button.append(element('span', 'omerta-city__destination-number', String(i + 1)), copy);
      destinations.append(button);
      buttons.set(venue.id, button);
      listen(button, 'click', () => showVenue(venue));
    }
    const presence = element('section', 'omerta-city__presence');
    presence.setAttribute('aria-label', 'People reported in this district');
    const presenceHead = element('div', 'omerta-city__presence-heading');
    const presenceTitle = element('h4', '', 'People in this district');
    presenceTitle.tabIndex = -1;
    const intelOpen = element('button', '', 'Street intel & objectives');
    intelOpen.type = 'button'; intelOpen.setAttribute('data-city-intel-open', '');
    presenceHead.append(presenceTitle, intelOpen);
    const placement = element('p', 'omerta-city__placement', 'District presence · marker positions and activity paths are approximate. Activity shows recently confirmed actions.');
    const actorList = element('div', 'omerta-city__actor-list');
    const actorPager = element('div', 'omerta-city__actor-pager');
    const actorsPrevious = element('button', '', 'Previous people');
    actorsPrevious.type = 'button'; actorsPrevious.setAttribute('data-city-actors-previous', '');
    const actorsMore = element('button', '', 'More people');
    actorsMore.type = 'button'; actorsMore.setAttribute('data-city-actors-more', '');
    const actorCount = element('span');
    actorCount.setAttribute('role', 'status');
    actorPager.append(actorsPrevious, actorCount, actorsMore);
    presence.append(presenceHead, placement, actorList, actorPager);
    const homeSection = element('section', 'omerta-city__homes'); homeSection.hidden = true;
    homeSection.setAttribute('aria-label', 'Confirmed street homes and district routes');
    const homeCaption = element('p', 'omerta-city__placement');
    const homeList = element('div', 'omerta-city__home-list');
    const exitList = element('div', 'omerta-city__exit-list');
    homeSection.append(element('h4', '', 'Street homes & district routes'), homeCaption, exitList, homeList);
    header.append(hud);
    viewport.insertBefore(controls, actorDock);
    root.append(header, nextMove, viewport, instructions, journal, destinations, homeSection, presence);
    listen(homeList, 'click', event => {
      const button = event.target.closest('[data-city-home]');
      if (button && homeList.contains(button) && !walkHome(button.dataset.cityHome)) showHome(button.dataset.cityHome, button);
    });
    listen(exitList, 'click', event => {
      const button = event.target.closest('[data-city-exit]');
      if (button && exitList.contains(button)) walkExit(button.dataset.cityExit, button);
    });
    renderPresence();
    host.replaceChildren(root);
    acceptResourceReceipt(options.resourceReceipt);
    if (typeof window.OmertaCityWorldUI?.mount === 'function') {
      try {
        worldUI = window.OmertaCityWorldUI.mount(root, { ...worldOptions(), viewport, mapLayer,
          toolbar: worldHud, toolsHost: document.getElementById('player-view-switch'), toolsLabel: 'Tools', trackerHost: nextMove,
          venues: VENUES, getState: sceneState, onOpenIntel: showIntel, onNavigate: navigate,
          onInspectVenue: id => { const venue = VENUES.find(venue => venue.id === id); if (venue) showVenue(venue); },
          onBeforeOpen: () => {
            pauseRoute(); hideVenue(false); hideActor(false); hideGameDock(false);
            worldOpening = true;
          },
          onPanelChange: () => {
            if (destroyed) return;
            fitWorldFrame();
            if (worldOpening && worldUI?.isOpen()) { worldOpening = false; revealVenue(viewport); syncPointerBounds(); }
          },
          onWaypoint: walkToVenue,
          onTrackObjective: id => {
            if (id !== null && !trackableObjective(id)) return false;
            trackedObjectiveId = id;
            updateHud();
            worldUI?.update(worldOptions());
            return true;
          },
          onHome: key => { if (!walkHome(key)) showHome(key); }, onHomes: acceptHomes,
          onPlotInspect: options.onPlotInspect,
          onTravel: options.onWorldTravel,
          onRead: options.onWorldRead, onAction: options.onWorldAction, onRetry: options.onWorldRetry,
          onCrew: () => showGameDock('crew'),
          onLook: preset => { look = Object.hasOwn(lookTints, preset) ? preset : 'classic'; player?.setTint(lookTints[look]); } });
        document.getElementById('player-view-switch')?.classList.add('has-world-tools');
      } catch (_) { /* A tools failure must preserve the playable neighborhood and original doors. */ }
    }
    acceptHomes(options.worldHomes);
    updateGeometry();
    updateHud();

    function worldOptions() {
      const tracked = !!trackedObjectiveId || !nextQuest() && (Array.isArray(options.objectives) ? options.objectives : []).some(objective => objective?.status === 'available' && objective.available !== false);
      return { character, district, rules: options.rules, actors: options.actors || [], objectives: options.objectives || [],
        trackedObjectiveId,
        intel: options.intel || [], npcQuests: options.npcQuests || {}, progress: options.progress, reducedMotion,
        scopeKey: options.worldScopeKey, receipt: options.worldReceipt, resourceReceipt, recovery: options.worldRecovery === true,
        social: options.worldSocial, chat: options.worldChat, atlas: options.worldAtlas,
        collection: options.worldCollection, homes: options.worldHomes, onTravel: options.onWorldTravel, onPlotInspect: options.onPlotInspect, trackerVisible: tracked };
    }
    function widthForHomes(count) {
      const bounded = Math.max(0, Math.min(64, Math.floor(Number(count) || 0)));
      return bounded ? WORLD.width + 64 + Math.ceil(bounded / 2) * 192 : WORLD.width;
    }
    function baseObstacles() {
      const result = OBSTACLES.map(item => ({ ...item }));
      if (region.landmark) {
        const { x, y, width, height } = region.landmark;
        result.push({ x, y, width, height });
      }
      return result;
    }
    function homeState() {
      return homes.map(home => ({ key: home.key, buildingId: home.buildingId || null, street: home.street, districtId: home.districtId,
        owner: home.owner ? { ...home.owner } : null, mine: home.mine, ownership: home.ownership,
        x: home.entrance.x, y: home.entrance.y, entrance: { ...home.entrance }, building: { ...home.building } }));
    }
    function roadState() {
      if (cityRoads) return cityRoads;
      const roads = [{ x: 0, y: 248, width: world.width, height: 48 }, { x: 334, y: 226, width: 140, height: 326 },
        { x: 732, y: 210, width: 44, height: 342 }];
      for (let x = WORLD.width + 208; x < world.width; x += 192) roads.push({ x, y: 192, width: 32, height: Math.max(336, walkBottom - 192) });
      if (district.id !== 'docks') roads.push({ x: 510, y: 180, width: 154, height: 32 });
      return roads;
    }
    function acceptHomes(board) {
      if (destroyed || !board || board.placement !== 'illustrative' || board.districtId !== district.id
        || board.viewer?.characterId !== character.id || Number(board.viewer?.generation) !== Number(character.generation)
        || board.viewer?.district !== district.id) return false;
      const rows = new Map();
      for (const item of [...(Array.isArray(board.homes) ? board.homes : []), board.myHome]) {
        if (!item || typeof item.key !== 'string' || !item.key || item.districtId !== district.id
          || typeof item.street !== 'string' || !['city', 'external', 'estate'].includes(item.ownership)) continue;
        const owner = item.owner && typeof item.owner.name === 'string' && ['player', 'agent', 'npc'].includes(item.owner.kind)
          ? { name: item.owner.name, kind: item.owner.kind } : null;
        const plot = layout?.getPlot(item.buildingId);
        if (layout && (!plot || plot.districtId !== district.id)) continue;
        rows.set(item.key, { key: item.key, buildingId: plot?.id || null, street: item.street, districtId: item.districtId, owner,
          mine: item.mine === true, ownership: item.ownership });
      }
      const own = board.myHome?.key;
      const ordered = Array.from(rows.values()).sort((a, b) => a.key < b.key ? -1 : a.key > b.key ? 1 : 0);
      homes = ordered.slice(0, 64);
      if (own && rows.has(own) && !homes.some(home => home.key === own)) homes[63] = rows.get(own);
      const active = new Set(homes.map(home => home.key));
      for (const key of homeSlots.keys()) if (!active.has(key)) homeSlots.delete(key);
      const used = new Set(homeSlots.values());
      const capacity = Math.max(1, Math.min(64, Math.max(homes.length, Number(district.deeds) || 0)));
      for (const home of homes) {
        if (layout) {
          const plot = layout.getPlot(home.buildingId);
          home.building = localRect(plot.building); home.entrance = localPoint(plot.entrance);
          continue;
        }
        if (!homeSlots.has(home.key)) {
          let hash = 0; for (const c of home.key) hash = (Math.imul(hash, 31) + c.charCodeAt(0)) >>> 0;
          let slot = hash % capacity; while (used.has(slot)) slot = (slot + 1) % 64;
          homeSlots.set(home.key, slot); used.add(slot);
        }
        const slot = homeSlots.get(home.key), upper = slot % 2 === 0;
        home.building = { x: WORLD.width + 48 + Math.floor(slot / 2) * 192, y: upper ? 52 : 330, width: 144, height: upper ? 140 : 132 };
        home.entrance = { x: home.building.x + 72, y: upper ? 224 : 504 };
      }
      homeBoard = { total: Math.max(homes.length, Number(board.total) || 0), nextCursor: board.nextCursor || null };
      updateGeometry(); renderActorDock(); return true;
    }
    function updateGeometry() {
      if (layout) {
        origin = layout.getDistrict(district.id)?.origin || origin;
        Object.assign(world, { x: -origin.x, y: -origin.y, origin: { ...origin } });
        cityRoads = layout.roads.map(localRect);
        obstacles = baseObstacles(); exits = [];
        suburbStamp = '';
        renderHomeDirectory(); drawHomes(); fitCamera(); return;
      }
      const count = Math.max(Number(district.deeds) || 0, homes.length, ...Array.from(homeSlots.values(), slot => slot + 1));
      // A page window or failed read cannot erase the ground below a walking player.
      world.width = Math.max(world.width, widthForHomes(count));
      for (const key of permeableHomes) if (!homes.some(home => home.key === key)) permeableHomes.delete(key);
      for (const home of homes) {
        const pose = player || initialPosition, b = home.building;
        if (!homeMarkers.has(home.key) && pose.x + PLAYER_RADIUS > b.x && pose.x - PLAYER_RADIUS < b.x + b.width
          && pose.y + PLAYER_RADIUS > b.y && pose.y - PLAYER_RADIUS < b.y + b.height) permeableHomes.add(home.key);
      }
      obstacles = baseObstacles().concat(homes.filter(home => !permeableHomes.has(home.key)).map(home => ({ ...home.building })));
      const atlas = options.worldAtlas?.districts || [];
      const here = atlas.find(item => item?.id === district.id);
      exits = (Array.isArray(here?.neighbours) ? here.neighbours : []).filter(id => REGIONS[id]).slice(0, 3).map((id, index) => ({
        id, name: atlas.find(item => item?.id === id)?.name || id,
        x: index === 0 ? world.width - 32 : index === 1 ? 32 : 560,
        y: index < 2 ? 264 : walkBottom - 28
      }));
      renderHomeDirectory(); drawHomes(); fitCamera();
    }
    function renderHomeDirectory() {
      const focused = homeList.contains(document.activeElement) ? document.activeElement.dataset.cityHome : null;
      homeSection.hidden = !homes.length && !exits.length && !(Number(district.deeds) > 0);
      homeSection.classList.toggle('is-empty', homes.length === 0);
      homeCaption.textContent = homes.length ? 'Showing ' + homes.length + ' of ' + (homeBoard?.total || homes.length) + ' confirmed street homes. Markers show plots, not the steward’s live position.'
        : Number(district.deeds) > 0 && !homeBoard ? 'The street directory is loading.' : 'Explore another district. Street homes appear here when available.';
      homeList.replaceChildren(); exitList.replaceChildren();
      for (const exit of exits) {
        const button = element('button', '', 'Route to ' + exit.name); button.type = 'button'; button.dataset.cityExit = exit.id;
        exitList.append(button);
      }
      for (const home of homes) {
        const button = element('button', 'omerta-city__home'); button.type = 'button'; button.dataset.cityHome = home.key;
        button.append(element('strong', '', home.street), element('span', '', home.owner ? home.owner.name + ' · ' + home.owner.kind.toUpperCase() : home.ownership === 'external' ? 'External deed · no in-city steward' : home.ownership === 'estate' ? 'Estate street · no living steward' : 'Steward not published'));
        if (home.mine) button.append(element('span', '', 'Your street'));
        homeList.append(button);
      }
      if (focused) (Array.from(homeList.children).find(button => button.dataset.cityHome === focused) || worldMapButton).focus({ preventScroll: true });
    }
    function drawHomes() {
      if (!scene || !ready) return;
      if (layout) { drawConnectedCity(); return; }
      if (!extensionGround) extensionGround = scene.add.graphics().setDepth(0);
      extensionGround.clear();
      if (world.width > WORLD.width) {
        extensionGround.fillStyle(region.ground).fillRect(WORLD.width, 0, world.width - WORLD.width, WORLD.height);
        extensionGround.fillStyle(region.road).fillRect(WORLD.width, 248, world.width - WORLD.width, 48);
        for (const road of roadState().filter(road => road.x > WORLD.width)) extensionGround.fillRect(road.x, road.y, road.width, road.height);
        for (let y = 252; y < 294; y += 10) for (let x = WORLD.width + (y % 20 ? 12 : 0); x < world.width; x += 24) {
          extensionGround.fillStyle(y % 20 ? 0x55534c : 0x484a45).fillRect(x, y, 21, 7);
        }
        extensionGround.fillStyle(region.water).fillRect(WORLD.width, walkBottom + 14, world.width - WORLD.width, WORLD.height - walkBottom - 14);
        extensionGround.lineStyle(2, 0xb0a184, 0.6).lineBetween(WORLD.width, 246, world.width, 246).lineBetween(WORLD.width, 298, world.width, 298);
      }
      if (!regionInk) regionInk = scene.add.graphics().setDepth(1);
      regionInk.clear();
      if (region.landmark) {
        const mark = region.landmark;
        regionInk.fillStyle(district.id === 'cathedral' ? 0x87937b : 0x8b6552).fillRect(mark.x, mark.y, mark.width, mark.height);
        regionInk.fillStyle(district.id === 'cathedral' ? 0xd3c6a5 : 0x42342d).fillRect(mark.x + mark.width / 2 - 12, mark.y + 18, 24, mark.height - 34);
      }
      const exitIds = new Set(exits.map(exit => exit.id));
      for (const [id, label] of exitLabels) if (!exitIds.has(id)) { label.destroy(); exitLabels.delete(id); }
      for (const exit of exits) {
        regionInk.lineStyle(2, 0xe8b34b, 0.8).strokeRect(exit.x - 10, exit.y - 10, 20, 20);
        let label = exitLabels.get(exit.id);
        if (!label) { label = scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: 10, color: '#e8d7b2', stroke: '#18201e', strokeThickness: 2 }).setOrigin(0.5); exitLabels.set(exit.id, label); }
        label.setPosition(exit.x, exit.y - 25).setText('→ ' + exit.name).setDepth(3);
      }
      const active = new Set(homes.map(home => home.key));
      for (const [key, marker] of homeMarkers) if (!active.has(key)) { marker.ink.destroy(); marker.name.destroy(); homeMarkers.delete(key); }
      for (const home of homes) {
        let marker = homeMarkers.get(home.key);
        if (!marker) {
          marker = { ink: scene.add.graphics().setDepth(1), name: scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: 10,
            color: '#e8d7b2', stroke: '#18201e', strokeThickness: 2, align: 'center', wordWrap: { width: 136 } }).setOrigin(0.5) };
          homeMarkers.set(home.key, marker);
        }
        const b = home.building, g = marker.ink; g.clear();
        const roof = home.mine ? 0x706c49 : home.owner?.kind === 'agent' ? 0x506275 : 0x73544b;
        g.fillStyle(0x111819, 0.4).fillRect(b.x + 10, b.y + 9, b.width, b.height);
        g.fillStyle(0x272b28).fillRect(b.x - 4, b.y - 4, b.width + 8, b.height + 8);
        g.fillStyle(0x79634e).fillRect(b.x, b.y, b.width, b.height);
        for (let y = b.y + 32; y < b.y + b.height; y += 8) {
          g.fillStyle(0x9a8060, 0.4).fillRect(b.x + 2, y, b.width - 4, 1);
          for (let x = b.x + (y % 16 ? 10 : 2); x < b.x + b.width - 4; x += 20) g.fillStyle(0x493e33, 0.55).fillRect(x, y, 1, 7);
        }
        g.fillStyle(roof).fillTriangle(b.x - 5, b.y + 30, b.x + b.width / 2, b.y - 12, b.x + b.width + 5, b.y + 30);
        g.lineStyle(1, 0xb5a37c, 0.45);
        for (let y = b.y - 3; y < b.y + 30; y += 7) {
          const inset = (b.y + 30 - y) * b.width / 84;
          g.lineBetween(b.x + inset, y, b.x + b.width - inset, y);
        }
        g.fillStyle(0x252e2c).fillRect(b.x - 6, b.y + 30, b.width + 12, 6);
        for (const x of [b.x + 17, b.x + b.width - 40]) {
          g.fillStyle(0x2d332e).fillRect(x - 3, b.y + 49, 29, 35);
          g.fillStyle(0xc7ac70).fillRect(x, b.y + 52, 23, 29);
          g.fillStyle(0x675e47).fillRect(x + 10, b.y + 52, 2, 29).fillRect(x, b.y + 65, 23, 2);
        }
        g.fillStyle(0x262621).fillRect(b.x + b.width / 2 - 16, b.y + b.height - 40, 32, 40);
        g.fillStyle(0x66503b).fillRect(b.x + b.width / 2 - 12, b.y + b.height - 36, 24, 36);
        g.fillStyle(0xd2b879).fillRect(b.x + b.width / 2 + 7, b.y + b.height - 18, 2, 3);
        g.fillStyle(0x9b9174).fillRect(home.entrance.x - 16, b.y + b.height, 32, home.entrance.y - b.y - b.height + 4);
        g.fillStyle(0x252e2c).fillRect(b.x + 8, b.y + 102, b.width - 16, 28);
        g.lineStyle(2, home.mine ? 0xe8b34b : 0x9da99b, 0.8).strokeRect(home.entrance.x - 9, home.entrance.y - 9, 18, 18);
        const sign = home.street.length > 32 ? home.street.slice(0, 31) + '…' : home.street;
        marker.name.setPosition(b.x + b.width / 2, b.y + 112).setText(sign + '\n' + (home.owner ? home.owner.kind.toUpperCase() : home.ownership.toUpperCase())).setDepth(b.y + 1);
      }
    }
    function drawConnectedCity() {
      if (!scene || !ready || !layout || !player) return;
      if (!cityGround) {
        cityGround = scene.add.graphics().setDepth(-50000);
        for (const place of layout.districts) {
          const b = localRect(place.bounds), palette = REGIONS[place.id];
          cityGround.fillStyle(palette.ground).fillRect(b.x, b.y, b.width, b.height);
        }
        cityGround.lineStyle(1, 0xb8a78b, .35);
        for (const road of cityRoads) {
          cityGround.fillStyle(0x3e4441).fillRect(road.x, road.y, road.width, road.height);
          cityGround.strokeRect(road.x, road.y, road.width, road.height);
        }
        for (const place of layout.districts) {
          const core = localRect(place.core);
          if (place.id !== district.id) {
            const palette = REGIONS[place.id];
            cityGround.fillStyle(palette.ground).fillRect(core.x, core.y, WORLD.width, WORLD.height);
            cityGround.fillStyle(palette.road).fillRect(core.x, core.y + 248, WORLD.width, 48)
              .fillRect(core.x + 334, core.y + 226, 140, 326).fillRect(core.x + 732, core.y + 210, 44, 342);
            for (const venue of VENUES.filter(item => item.building)) {
              const b = { ...venue.building, x: core.x + venue.building.x, y: core.y + venue.building.y };
              cityGround.fillStyle(0x24312d).fillRect(b.x, b.y, b.width, b.height);
              cityGround.fillStyle(0x8b7962).fillRect(b.x + 7, b.y + 8, b.width - 14, b.height - 8);
              cityGround.fillStyle(place.id === 'neon' ? 0x624957 : 0x59483e).fillRect(b.x - 3, b.y, b.width + 6, 28);
              for (let x = b.x + 20; x < b.x + b.width - 25; x += 38)
                for (let y = b.y + 46; y < b.y + b.height - 28; y += 40)
                  cityGround.fillStyle(0xbda878).fillRect(x, y, 18, 24);
            }
            if (place.id === 'docks') cityGround.fillStyle(palette.water).fillRect(core.x, core.y + 554, WORLD.width, 86);
            else if (palette.landmark) {
              const mark = palette.landmark;
              cityGround.fillStyle(0x839174).fillRect(core.x + mark.x, core.y + mark.y, mark.width, mark.height);
            }
          }
          cityLabels.push(scene.add.text(core.x + WORLD.width / 2, core.y - 38, place.name.toUpperCase(), {
            fontFamily: 'monospace', fontSize: 18, color: '#ecddba', stroke: '#24312d', strokeThickness: 4
          }).setOrigin(.5).setDepth(-20000));
          cityLabels.push(scene.add.text(core.x + WORLD.width / 2, core.y + WORLD.height + 52, 'RESIDENTIAL STREETS · ' + place.capacity + ' HOMES', {
            fontFamily: 'monospace', fontSize: 12, color: '#d9cfb6', stroke: '#24312d', strokeThickness: 3
          }).setOrigin(.5).setDepth(-20000));
        }
      }
      const camera = scene.cameras.main, view = camera.worldView;
      // Only the nearby city blocks need detailed house art and labels.
      const stamp = [Math.floor(player.x / 128), Math.floor(player.y / 128), Math.round(camera.zoom * 100), Math.round(view.width), Math.round(view.height)].join(':');
      if (suburbStamp === stamp) return;
      suburbStamp = stamp;
      if (!suburbInk) suburbInk = scene.add.graphics().setDepth(-10000);
      const g = suburbInk; g.clear();
      const radiusX = Math.max(760, view.width), radiusY = Math.max(540, view.height);
      const nearby = layout.nearPlots({ x: player.x + origin.x - radiusX, y: player.y + origin.y - radiusY, width: radiusX * 2, height: radiusY * 2 });
      visiblePlots = nearby.length;
      for (const plot of nearby) {
        const b = localRect(plot.building), entrance = localPoint(plot.entrance);
        const home = homes.find(home => home.buildingId === plot.id);
        const roof = [0x74534b, 0x59685e, 0x696376, 0x7a6850][plot.number % 4];
        g.fillStyle(0x7e806b, .3);
        for (let x = b.x - 10; x < b.x + 80; x += 16) {
          g.fillRect(x, b.y + 59, 13, 1).fillRect(x + 5, b.y + 69, 13, 1);
          g.fillRect(x, b.y + 60, 1, 6).fillRect(x + 5, b.y + 70, 1, 6);
        }
        g.fillStyle(0x172522, .4).fillRect(b.x + 5, b.y + 5, b.width, b.height);
        g.fillStyle(0x84745d).fillRect(b.x, b.y + 12, b.width, b.height - 12);
        g.fillStyle(0xb0a085, .3);
        for (let y = b.y + 26; y < b.y + 53; y += 6) g.fillRect(b.x + 2, y, b.width - 4, 1);
        g.fillStyle(0x5a4d40, .5);
        for (let x = b.x + 7; x < b.x + b.width - 5; x += 14) g.fillRect(x, b.y + 26, 1, 5).fillRect(x + 5, b.y + 38, 1, 5);
        g.fillStyle(0xaca080, .65).fillRect(b.x + 1, b.y + 35, b.width - 2, 2);
        g.fillStyle(roof).fillTriangle(b.x - 3, b.y + 20, b.x + b.width / 2, b.y - 8, b.x + b.width + 3, b.y + 20);
        g.lineStyle(1, 0xb9ac8c, .4);
        for (let y = 0; y < 20; y += 5) {
          const inset = (20 - y) * 1.3;
          g.lineBetween(b.x + inset, b.y + y, b.x + b.width - inset, b.y + y);
        }
        g.fillStyle(0x6b594b).fillRect(b.x + 52, b.y - 5, 7, 12);
        g.fillStyle(0xb3a082).fillRect(b.x + 51, b.y - 7, 9, 3);
        g.fillStyle(0x242f2b).fillRect(b.x - 3, b.y + 20, b.width + 6, 4);
        for (const x of [b.x + 11, b.x + b.width - 22]) {
          g.fillStyle(0x283a36).fillRect(x - 2, b.y + 28, 14, 16);
          g.fillStyle(plot.number % 3 ? 0xc3a66a : 0x8da39b).fillRect(x, b.y + 30, 10, 12);
          g.fillStyle(0x635b47).fillRect(x + 4, b.y + 30, 2, 12);
          g.fillStyle(0x3b4c38).fillRect(x - 2, b.y + 43, 14, 4);
          g.fillStyle(plot.number % 2 ? 0xad8666 : 0x86a174).fillRect(x, b.y + 42, 3, 2).fillRect(x + 7, b.y + 42, 3, 2);
        }
        g.fillStyle(0x362f27).fillRect(b.x + 29, b.y + 34, 14, 20);
        g.fillStyle(0x6a523d).fillRect(b.x + 32, b.y + 36, 8, 18);
        g.fillStyle(0xd2b57c).fillRect(b.x + 38, b.y + 45, 1, 2);
        g.fillStyle(0x9a9076).fillRect(entrance.x - 8, b.y + b.height, 16, 15);
        if (home) g.lineStyle(2, home.mine ? 0xe8b34b : 0x9da99b, .9).strokeRect(entrance.x - 6, entrance.y - 6, 12, 12);
      }
      const shown = new Set(nearby.map(plot => plot.id));
      for (const [key, marker] of homeMarkers) {
        if (!homes.some(home => home.key === key && shown.has(home.buildingId))) { marker.name.destroy(); homeMarkers.delete(key); }
      }
      for (const home of homes) {
        if (!shown.has(home.buildingId)) continue;
        let marker = homeMarkers.get(home.key);
        if (!marker) {
          marker = { name: scene.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: 9, color: '#efdfba',
            stroke: '#172923', strokeThickness: 3, align: 'center', wordWrap: { width: 86 } }).setOrigin(.5) };
          homeMarkers.set(home.key, marker);
        }
        marker.name.setPosition(home.building.x + 36, home.building.y - 16).setText(home.street).setDepth(10000);
      }
    }
    function nearbyPlots(point, distance = 90) {
      if (!layout) return [];
      const p = globalPoint(point);
      return layout.nearPlots({ x: p.x - distance, y: p.y - distance, width: distance * 2, height: distance * 2 });
    }
    function inspectPlot(plot) {
      if (destroyed || externalPanel || !plot) return;
      stopMovement();
      options.onPlotInspect?.({ buildingId: plot.id, districtId: plot.districtId });
    }
    function walkPlot(plot) {
      if (destroyed || externalPanel || crossingPending || !plot) return;
      const entrance = localPoint(plot.entrance);
      if (Math.hypot(player.x - entrance.x, player.y - entrance.y) < 42) { inspectPlot(plot); return; }
      pendingPlot = plot; path = findRoute(player, entrance); redrawPath();
    }
    function advanceTo(x, y) {
      if (crossingPending || !canWalk(x, y)) return false;
      const target = layout?.regionAt(globalPoint({ x, y }));
      if (target && target.id !== district.id) {
        requestCrossing(target, { ...globalPoint({ x, y }), facing: playerFacing });
        return false;
      }
      player.setPosition(x, y); return true;
    }
    async function requestCrossing(target, worldPosition) {
      if (destroyed || externalPanel || crossingPending || options.worldRecovery || typeof options.onWorldTravel !== 'function') return;
      stopMovement(); crossingPending = true;
      const identity = sceneIdentity(), scope = options.worldScopeKey, sequence = ++crossingSequence;
      const current = () => !destroyed && identity === sceneIdentity() && scope === options.worldScopeKey && sequence === crossingSequence;
      crossingMessage = 'Crossing to ' + target.name + ' requires a confirmed ride.';
      try {
        const result = await options.onWorldTravel(target.id, { worldPosition, isCurrent: current });
        if (!current()) return;
        if (result?.ignored) crossingMessage = 'You stayed in ' + district.name + '.';
        else if (result?.code >= 400) {
          crossingMessage = result.body?.message || 'The crossing is not confirmed. Check Travel before trying again.';
          openWorldMap(target.id);
        }
      } catch (_) {
        if (current()) { crossingMessage = 'The crossing is not confirmed. Check Travel to recover the result.'; openWorldMap(target.id); }
      } finally { if (current()) crossingPending = false; }
    }
    function openWorldMap(districtId, fallback = true) {
      if (destroyed || externalPanel || (!fallback && typeof worldUI?.openMapOverview !== 'function')) return false;
      pauseRoute(); hideVenue(false); hideActor(false); hideGameDock(false);
      if (typeof worldUI?.openMapOverview === 'function') {
        worldUI.openMapOverview(typeof districtId === 'string' ? districtId : undefined);
        const state = worldUI.getState();
        return worldUI.isOpen() && state.panel === 'map' && state.mapView === 'world';
      }
      else if (worldUI) worldUI.open('map');
      else navigate('city', 'waterfront');
      return false;
    }
    function walkHome(key) {
      const home = homes.find(item => item.key === key);
      if (destroyed || externalPanel || !home) return false;
      if (!ready || !player) {
        if (root.classList.contains('omerta-city--unavailable')) showHome(key);
        else queuedHome = { key, identity: sceneIdentity(), scope: options.worldScopeKey };
        return true;
      }
      worldUI?.close(false); stopMovement(); hideVenue(false); hideActor(false); hideGameDock(false); game.canvas.focus({ preventScroll: true });
      if (Math.hypot(player.x - home.entrance.x, player.y - home.entrance.y) < 42) showHome(key);
      else { pendingHome = key; path = findRoute(player, home.entrance); redrawPath(); revealVenue(viewport); }
      return true;
    }
    function showHome(key, trigger) {
      if (destroyed || externalPanel || !homes.some(home => home.key === key)) return;
      worldUI?.close(false); stopMovement(); hideVenue(false); hideActor(false); hideGameDock(false);
      selectedHome = key; selectedExit = null; selectedActor = null; actorView = 'home'; actorOpening++;
      actorReturn = trigger; actorNotice = ''; actorRenderSignature = ''; actorDock.hidden = false; actorDock.scrollTop = 0;
      renderActorDock(); fitWorldFrame(); revealVenue(viewport); actorBody.focus({ preventScroll: true }); syncPointerBounds();
    }
    function walkExit(id, trigger) {
      const exit = exits.find(item => item.id === id); if (destroyed || externalPanel || !exit) return;
      if (!ready || !player) { showExit(id, trigger); return; }
      worldUI?.close(false); stopMovement(); hideVenue(false); hideActor(false); hideGameDock(false); game.canvas.focus({ preventScroll: true });
      if (Math.hypot(player.x - exit.x, player.y - exit.y) < 42) showExit(id, trigger);
      else { pendingExit = id; path = findRoute(player, exit); redrawPath(); revealVenue(viewport); }
    }
    function showExit(id, trigger) {
      if (destroyed || externalPanel || !exits.some(item => item.id === id)) return;
      worldUI?.close(false); stopMovement(); hideVenue(false); hideActor(false); hideGameDock(false);
      selectedExit = id; selectedHome = null; selectedActor = null; actorView = 'exit'; actorOpening++;
      actorReturn = trigger; actorNotice = ''; actorRenderSignature = ''; actorDock.hidden = false; actorDock.scrollTop = 0;
      renderActorDock(); fitWorldFrame(); revealVenue(viewport); actorBody.focus({ preventScroll: true }); syncPointerBounds();
    }

    function publicActors() {
      const result = new Map();
      for (const actor of Array.isArray(options.actors) ? options.actors : []) {
        if (!actor || typeof actor.id !== 'string' || !actor.id || actor.id === character.id
          || !['npc', 'agent', 'player'].includes(actor.kind) || actor.district !== district.id) continue;
        result.set(actor.id, actor);
      }
      return Array.from(result.values());
    }
    function pageActors() { return publicActors().slice(actorPage * ACTOR_PAGE_SIZE, (actorPage + 1) * ACTOR_PAGE_SIZE); }
    function findActor(id) { return publicActors().find(actor => actor.id === id); }
    function actorName(actor) {
      return String(actor?.name || (actor?.kind === 'npc' ? 'Unnamed resident' : actor?.kind === 'agent' ? 'Unknown agent' : 'Unknown player'));
    }
    function actorActions(actor) {
      return (Array.isArray(actor?.actions) ? actor.actions : []).filter(action => action && typeof action.id === 'string'
        && action.method === 'POST' && action.path === '/v1/city/encounters/' + encodeURIComponent(actor.id));
    }
    function renderPresence() {
      presence.hidden = !('actors' in options || 'intel' in options || 'objectives' in options);
      const actors = publicActors();
      presence.classList.toggle('is-empty', actors.length === 0);
      placement.hidden = actors.length === 0;
      actorPager.hidden = !actors.length && !options.hasMore && !pagingNotice;
      presenceCaption.hidden = actors.length === 0;
      actorPage = Math.min(actorPage, Math.max(0, Math.ceil(actors.length / ACTOR_PAGE_SIZE) - 1));
      const signature = JSON.stringify([pageActors(), selectedActor, actorDock.hidden]);
      if (signature !== presenceSignature) {
        presenceSignature = signature;
        const focused = actorList.contains(document.activeElement) ? document.activeElement.dataset.cityActor : null;
        actorList.replaceChildren();
        for (const actor of pageActors()) {
          const button = element('button', 'omerta-city__actor');
          button.type = 'button'; button.dataset.cityActor = actor.id;
          button.setAttribute('aria-expanded', String(selectedActor === actor.id && !actorDock.hidden));
          button.append(element('strong', '', actorName(actor)),
            element('span', '', actor.kind.toUpperCase() + (Number.isFinite(actor.level) ? ' · ' + (actor.kind === 'npc' ? 'Level ' : 'Last known level ') + actor.level : '')));
          actorList.append(button);
        }
        if (!actors.length) actorList.append(element('p', '', 'No public visitors reported yet. Meet the neighborhood locals on the map.'));
        if (focused) (Array.from(actorList.children).find(button => button.dataset.cityActor === focused) || presenceTitle).focus({ preventScroll: true });
      }
      actorsPrevious.disabled = paging || actorPage === 0;
      actorsMore.disabled = paging || (actorPage + 1) * ACTOR_PAGE_SIZE >= actors.length && !options.hasMore;
      actorsMore.textContent = paging ? 'Loading people…' : 'More people';
      actorCount.textContent = pagingNotice || (actors.length ? (actorPage * ACTOR_PAGE_SIZE + 1) + '–' + Math.min(actors.length, (actorPage + 1) * ACTOR_PAGE_SIZE)
        + ' of ' + actors.length + ' loaded' : '0 reported people');
      syncActorSprites();
    }
    function actorSlots() {
      const slots = [];
      for (let y = 224; y <= 532; y += 44) for (let x = 64; x < 930; x += 44) {
        if (canWalk(x, y) && Math.hypot(x - initialPosition.x, y - initialPosition.y) > 54
          && !VENUES.some(venue => Math.hypot(x - venue.x, y - venue.y) < 42)) slots.push({ x, y });
      }
      return slots;
    }
    function syncActorSprites() {
      if (!scene || !ready) return;
      const actors = pageActors(), ids = new Set(actors.map(actor => actor.id)), slots = actorSlots(), used = new Set();
      for (const [id, marker] of actorSprites) if (!ids.has(id)) {
        removeActivity(id);
        marker.sprite.destroy(); marker.name.destroy(); marker.ring.destroy(); actorSprites.delete(id);
      }
      if (!slots.length) return;
      for (const actor of actors) {
        let hash = 0; for (const char of actor.id) hash = (Math.imul(hash, 31) + char.charCodeAt(0)) >>> 0;
        let index = hash % slots.length;
        while (used.has(index)) index = (index + 1) % slots.length;
        used.add(index); const position = slots[index];
        let marker = actorSprites.get(actor.id);
        if (!marker) {
          const base = actor.kind === 'npc' ? 'worker' : actor.kind === 'agent' ? 'fixer' : 'neighbor';
          const generated = scene.textures.exists('city-art-' + base);
          const sprite = scene.add.sprite(position.x, position.y, generated ? 'city-art-' + base : 'city-' + base)
            .setOrigin(0.5, generated ? 58 / 60 : 0.85);
          const name = scene.add.text(position.x, position.y - 73, '', {
            fontFamily: 'monospace', fontSize: 10, resolution: 2, align: 'center', color: '#d8e7e0', stroke: '#151d1e', strokeThickness: 3
          }).setOrigin(0.5);
          const ring = scene.add.graphics();
          ring.lineStyle(1, actor.kind === 'agent' ? 0x9ec5ef : actor.kind === 'npc' ? 0xc6b696 : 0xa5d9c6, 0.8).strokeEllipse(0, 0, 28, 10);
          marker = { sprite, name, ring }; actorSprites.set(actor.id, marker);
        }
        if (!marker.actor || marker.actor.generation !== actor.generation || !canWalk(marker.x, marker.y)) {
          if (marker.actor && marker.actor.generation !== actor.generation) rememberActivity(actor.activity, actor);
          removeActivity(actor.id);
          marker.x = position.x; marker.y = position.y;
        }
        marker.actor = actor;
        marker.sprite.setPosition(marker.x, marker.y).setDepth(marker.y);
        marker.name.setPosition(marker.x, marker.y - 73).setText(actor.kind.toUpperCase()).setDepth(marker.y + 1);
        marker.ring.setPosition(marker.x, marker.y).setDepth(marker.y - 1);
        acceptActivity(actor.activity, actor);
      }
      renderActivityStatus();
    }
    function intelLead(entry) {
      const venue = VENUES.find(venue => venue.id === entry.lead?.venueId);
      const districtId = entry.lead?.districtId || entry.source?.district;
      if (!venue || typeof districtId !== 'string' || !Object.hasOwn(REGIONS, districtId)) return null;
      const districts = [...(options.worldAtlas?.districts || []), ...(options.rules?.districts || [])];
      const name = districtId === district.id ? district.name : districts.find(place => place.id === districtId)?.name;
      return { venue, districtId, districtName: name || districtId.charAt(0).toUpperCase() + districtId.slice(1) };
    }
    function intelCard(entry, confirmed = false) {
      const item = element('article', 'omerta-city__intel');
      if (confirmed) { item.dataset.cityEncounterIntel = String(entry.id || ''); item.tabIndex = -1; }
      else item.dataset.cityIntel = String(entry.id || '');
      if (entry.category === 'rumor') item.append(element('small', 'omerta-city__rumor-label', 'Street rumor · unverified'));
      item.append(element('strong', '', String(entry.title || 'Neighborhood lead')), element('p', '', String(entry.description || '')));
      if (entry.sourceContext) item.append(element('p', 'omerta-city__intel-context', String(entry.sourceContext)));
      if (entry.source) {
        const attribution = entry.attribution === 'resident' && entry.source.kind === 'npc' ? 'Heard from ' : 'Recorded after meeting ';
        item.append(element('small', '', attribution + actorName(entry.source) + ' · ' + String(entry.source.district || district.id)));
      }
      const collectedAt = new Date(entry.collectedAt || '').getTime();
      if (Number.isFinite(collectedAt)) {
        const time = element('time', '', 'Recorded ' + new Date(collectedAt).toLocaleString());
        time.dateTime = new Date(collectedAt).toISOString(); item.append(time);
      }
      const destination = intelLead(entry);
      if (destination && typeof entry.id === 'string') {
        const lead = element('button', '', destination.districtId === district.id
          ? String(entry.lead.label || 'Follow this lead at ' + destination.venue.name) : 'Travel to ' + destination.districtName + ' to follow up');
        lead.type = 'button'; lead.dataset.cityIntelLead = entry.id; item.append(lead);
        item.append(element('small', '', 'Visit ' + destination.venue.name + ' in ' + destination.districtName + ' to follow up.'));
      }
      return item;
    }
    function renderActorDock() {
      if (actorDock.hidden) return;
      const actor = findActor(selectedActor);
      const journalEntries = Array.isArray(options.intel) ? options.intel : options.intel?.journal || [];
      const objectives = Array.isArray(options.objectives) ? options.objectives : [];
      const home = homes.find(item => item.key === selectedHome), exit = exits.find(item => item.id === selectedExit);
      const signature = JSON.stringify([actorView, actor, home, exit, journalEntries, objectives, options.encounterReceipt, options.encounterRecovery, actorNotice, encounterPending]);
      if (signature === actorRenderSignature) return;
      actorRenderSignature = signature;
      const oldFocus = actorBody.contains(document.activeElement) ? document.activeElement.dataset.cityEncounter || document.activeElement.dataset.cityIntelAction || document.activeElement.dataset.cityHomeAction || document.activeElement.dataset.cityIntelLead || '' : null;
      const focusedIntel = actorBody.contains(document.activeElement) ? document.activeElement.dataset.cityEncounterIntel : null;
      const scroll = actorDock.scrollTop;
      actorBody.replaceChildren();
      if (actorView === 'person') {
        actorBody.append(element('h4', '', actor ? actorName(actor) : 'This person is no longer on the current district list.'));
        if (actor) {
          actorBody.append(element('p', 'omerta-city__actor-facts', actor.kind.toUpperCase() + ' · Reported in ' + String(district.name || district.id)
            + (actor.kind === 'npc' && Number.isFinite(actor.level) ? ' · Level ' + actor.level : '') + (actor.gangTag ? ' · ' + actor.gangTag : '')));
          if (actor.kind !== 'npc') {
            const observation = new Date(actor.observedAt || '').getTime();
            actorBody.append(element('p', '', actor.name ? 'Last learned: ' + actorName(actor)
              + (Number.isFinite(actor.level) ? ' · Level ' + actor.level : '')
              + (actor.lastSeenDistrict ? ' · ' + String(actor.lastSeenDistrict) : '')
              + (Number.isFinite(observation) ? ' · observed ' + new Date(observation).toLocaleString() : '')
              + '. These are recorded facts, not live tracking.' : 'Meet this person or hear about them to learn their name and other facts.'));
          }
          for (const action of actorActions(actor)) {
            if (action.topic?.teaser) actorBody.append(element('p', 'omerta-city__intel-teaser', String(action.topic.teaser)));
            const button = element('button', '', String(action.label || 'Review a neighborhood lead'));
            button.type = 'button'; button.dataset.cityEncounter = action.id;
            button.disabled = action.available !== true || encounterPending || options.encounterRecovery === true || typeof options.onEncounter !== 'function';
            appendActionPreview(button, action);
            actorBody.append(button);
          }
          const nextObjective = objectives.find(objective => objective?.status === 'available');
          if (nextObjective) {
            const guidance = element('aside', 'omerta-city__objective');
            guidance.append(element('strong', '', 'Next objective: ' + String(nextObjective.title || 'Follow the next lead')),
              element('p', '', String(nextObjective.description || '')));
            actorBody.append(guidance);
          } else if (objectives.length && objectives.every(objective => objective?.status === 'completed')) {
            actorBody.append(element('p', '', 'Your issued encounter objectives are complete.'));
          }
        }
      } else if (actorView === 'home') {
        actorBody.append(element('h4', '', home?.street || 'Street directory'));
        if (home) {
          actorBody.append(element('p', 'omerta-city__actor-facts', home.owner ? home.owner.name + ' · ' + home.owner.kind.toUpperCase() + ' steward'
            : home.ownership === 'external' ? 'External deed · no in-city steward published' : home.ownership === 'estate' ? 'Estate street · no living steward published' : 'Steward not published'));
          actorBody.append(element('p', '', 'This is an illustrative home plot for a confirmed street deed. It does not show where the steward is standing.'));
          if (!ready) actorBody.append(element('p', '', 'Walking is unavailable. You can inspect the street or use Travel and the deed board.'));
          if (home.mine) {
            actorBody.append(element('p', '', 'This is your street. Your account keeps the deed across character generations.'));
            for (const [kind, label] of [['hideout', 'Your hideout'], ['deeds', 'Your deed board']]) {
              const button = element('button', '', label); button.type = 'button'; button.dataset.cityHomeAction = kind; actorBody.append(button);
              if (kind === 'hideout' && !worldUI) button.disabled = true;
            }
          }
        } else actorBody.append(element('p', '', 'This street is outside the current directory window. Open Travel to inspect more homes.'));
        const map = element('button', '', 'Travel'); map.type = 'button'; map.dataset.cityHomeAction = 'map'; actorBody.append(map);
      } else if (actorView === 'exit') {
        actorBody.append(element('h4', '', exit ? 'Route to ' + exit.name : 'District routes'));
        const fare = Number(options.rules?.travelCost);
        actorBody.append(element('p', '', 'Choose your destination in Travel. District travel is an explicit choice'
          + (Number.isFinite(fare) ? ' with a $' + fare.toLocaleString('en-US') + ' ride fare.' : '; check its current fare before confirming.')));
        const map = element('button', '', 'Travel: choose a district'); map.type = 'button'; map.dataset.cityHomeAction = 'map'; actorBody.append(map);
      } else {
        actorBody.append(element('h4', '', 'Street intel & objectives'));
        actorBody.append(element('p', '', 'Rumors and leads recorded around the neighborhood. Compare sources, then visit the people and places named in your notes.'));
        for (const objective of objectives.filter(Boolean)) {
          const item = element('article', 'omerta-city__objective'); item.dataset.cityObjective = String(objective.id || '');
          item.append(element('strong', '', String(objective.title || 'Objective')), element('span', '', String(objective.status || '')),
            element('p', '', String(objective.description || '')));
          for (const action of Array.isArray(objective.actions) ? objective.actions : []) if (action && typeof action.id === 'string' && action.method === 'POST') {
            const button = element('button', '', String(action.label || 'Continue'));
            button.type = 'button'; button.dataset.cityIntelAction = action.id;
            button.disabled = action.available !== true || typeof options.onIntelAction !== 'function';
            appendActionPreview(button, action); item.append(button);
          }
          actorBody.append(item);
        }
        if (!journalEntries.length) actorBody.append(element('p', '', 'Your notebook is empty. Inspect someone in the neighborhood and choose a topic to hear about.'));
        for (const entry of Array.isArray(journalEntries) ? journalEntries.filter(Boolean) : []) {
          actorBody.append(intelCard(entry));
        }
      }
      const receipt = ['person', 'journal'].includes(actorView) ? options.encounterReceipt : null;
      if (receipt) {
        const region = element('section', 'omerta-city__encounter-receipt');
        region.setAttribute('data-city-encounter-receipt', ''); region.setAttribute('aria-label', 'Encounter receipt');
        region.append(element('strong', '', String(receipt.label || 'Encounter result')), element('p', '', String(receipt.summary || '')));
        if (receipt.state === 'success' && receipt.intel && typeof receipt.intel === 'object') region.append(intelCard(receipt.intel, true));
        if (typeof receipt.delta === 'string' && receipt.delta) region.append(element('p', '', receipt.delta));
        else if (Array.isArray(receipt.delta) && receipt.delta.length) region.append(element('p', '', receipt.delta.map(String).join(' · ')));
        if (receipt.recoveryText) region.append(element('p', '', String(receipt.recoveryText)));
        if (options.encounterRecovery === true && typeof options.onEncounterRetry === 'function') {
          const retry = element('button', '', String(receipt.recoveryLabel || 'Recover previous encounter'));
          retry.type = 'button'; retry.setAttribute('data-city-encounter-retry', ''); retry.disabled = encounterPending; region.append(retry);
        }
        actorBody.append(region);
      }
      if (actorNotice) { const notice = element('p', 'omerta-city__actor-notice', actorNotice); notice.setAttribute('role', 'status'); actorBody.append(notice); }
      actorDock.scrollTop = scroll;
      if (focusedIntel) (Array.from(actorBody.querySelectorAll('[data-city-encounter-intel]')).find(item => item.dataset.cityEncounterIntel === focusedIntel) || actorBody).focus({ preventScroll: true });
      else if (oldFocus !== null) (Array.from(actorBody.querySelectorAll('button')).find(button => !button.disabled && (button.dataset.cityEncounter === oldFocus || button.dataset.cityIntelAction === oldFocus || button.dataset.cityHomeAction === oldFocus || button.dataset.cityIntelLead === oldFocus)) || actorBody).focus({ preventScroll: true });
    }
    function showActor(id, trigger) {
      if (destroyed || externalPanel || !findActor(id)) return;
      worldUI?.close(false);
      hideGameDock(false);
      stopMovement(); hideVenue(false); selectedHome = null; selectedExit = null; selectedActor = id; actorView = 'person'; actorOpening++;
      actorReturn = trigger || Array.from(actorList.children).find(button => button.dataset.cityActor === id);
      actorNotice = ''; actorRenderSignature = ''; actorDock.hidden = false; actorDock.scrollTop = 0;
      renderActorDock(); renderPresence(); fitWorldFrame(); revealVenue(viewport);
      // A short desktop can fit the map and HUD while clipping the taller action
      // preview. Reveal it inside this dock only when the person is first opened.
      const action = actorBody.querySelector('[data-city-encounter]');
      if (action && window.innerWidth > 680) {
        const bounds = action.getBoundingClientRect(), dock = actorDock.getBoundingClientRect();
        actorDock.scrollTop += Math.max(0, Math.min(bounds.bottom - dock.bottom + 8, bounds.top - dock.top - 8));
      }
      actorBody.focus({ preventScroll: true }); syncPointerBounds();
    }
    function showIntel() {
      if (destroyed || externalPanel) return;
      worldUI?.close(false);
      hideGameDock(false);
      stopMovement(); hideVenue(false); selectedHome = null; selectedExit = null; selectedActor = null; actorView = 'journal'; actorOpening++;
      actorReturn = intelOpen; actorNotice = ''; actorRenderSignature = ''; actorDock.hidden = false; actorDock.scrollTop = 0;
      renderActorDock(); fitWorldFrame(); revealVenue(viewport); actorBody.focus({ preventScroll: true }); syncPointerBounds();
    }
    function hideActor(focus) {
      if (actorDock.hidden) return;
      const previousActor = selectedActor;
      actorDock.hidden = true; selectedActor = null; selectedHome = null; selectedExit = null; actorView = ''; actorOpening++; actorRenderSignature = '';
      actorBody.replaceChildren(); renderPresence(); fitWorldFrame();
      if (focus) {
        const currentButton = Array.from(actorList.children).find(button => button.dataset.cityActor === previousActor);
        const target = game?.canvas || currentButton || (actorReturn?.isConnected ? actorReturn : intelOpen);
        revealVenue(game?.canvas ? viewport : target); target.focus({ preventScroll: true });
      }
      syncPointerBounds();
    }
    listen(actorList, 'click', event => { const button = event.target.closest('[data-city-actor]'); if (button && actorList.contains(button)) showActor(button.dataset.cityActor, button); });
    listen(actorClose, 'click', () => hideActor(true));
    listen(intelOpen, 'click', showIntel);
    listen(actorDock, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); hideActor(true); } });
    listen(actorBody, 'click', event => {
      const button = event.target.closest('[data-city-intel-lead]'); if (!button || !actorBody.contains(button)) return;
      const entries = Array.isArray(options.intel) ? options.intel : options.intel?.journal || [];
      const confirmed = options.encounterReceipt?.state === 'success' ? options.encounterReceipt.intel : null;
      const entry = [confirmed, ...entries].find(entry => entry && entry.id === button.dataset.cityIntelLead);
      const destination = entry && intelLead(entry);
      if (destination) {
        if (destination.districtId === district.id) walkToVenue(destination.venue.id);
        else openWorldMap(destination.districtId);
      }
    });
    listen(actorBody, 'click', event => {
      const button = event.target.closest('[data-city-home-action]'); if (!button || !actorBody.contains(button)) return;
      if (button.dataset.cityHomeAction === 'map') openWorldMap(selectedExit || district.id);
      else if (homes.some(home => home.key === selectedHome && home.mine)) {
        if (button.dataset.cityHomeAction === 'hideout') { hideActor(false); worldUI?.open('room'); }
        else if (button.dataset.cityHomeAction === 'deeds') navigate('deeds', 'directory');
      }
    });
    listen(actorsPrevious, 'click', () => { if (actorPage && !paging) { actorPage--; renderPresence(); } });
    listen(actorsMore, 'click', async () => {
      if (paging || destroyed) return;
      const count = publicActors().length;
      if ((actorPage + 1) * ACTOR_PAGE_SIZE < count) { actorPage++; renderPresence(); return; }
      if (!options.hasMore || typeof options.onPresencePage !== 'function') return;
      const identity = sceneIdentity(); pagingNotice = ''; paging = true; renderPresence();
      try { await options.onPresencePage(); }
      catch { pagingNotice = 'People could not load. Try More people again.'; }
      finally { if (!destroyed && identity === sceneIdentity()) { paging = false; if (publicActors().length > count) actorPage++; renderPresence(); } }
    });
    listen(actorBody, 'click', async event => {
      const button = event.target.closest('[data-city-encounter], [data-city-intel-action], [data-city-encounter-retry]');
      if (!button || button.disabled || !actorBody.contains(button) || encounterPending || destroyed) return;
      const actor = findActor(selectedActor), action = actorActions(actor).find(entry => entry.id === button.dataset.cityEncounter);
      if (button.dataset.cityEncounter && (!action?.available || typeof options.onEncounter !== 'function')) return;
      if (button.dataset.cityIntelAction && typeof options.onIntelAction !== 'function') return;
      const retrying = button.hasAttribute('data-city-encounter-retry');
      if (retrying && (options.encounterRecovery !== true || typeof options.onEncounterRetry !== 'function')) return;
      const identity = sceneIdentity(), opening = actorOpening; let confirmedIntelId = ''; encounterPending = true;
      actorNotice = retrying ? 'Recovering the previous encounter…' : 'Recording the encounter…'; renderActorDock();
      try {
        const result = retrying ? await options.onEncounterRetry() : button.dataset.cityEncounter
          ? await options.onEncounter(actor.id, action.id) : await options.onIntelAction(button.dataset.cityIntelAction);
        if (result?.code < 400 && typeof result.body?.intel?.id === 'string') confirmedIntelId = result.body.intel.id;
        if (!destroyed && identity === sceneIdentity() && opening === actorOpening) actorNotice = options.encounterRecovery === true
          ? 'This encounter is not confirmed. Recover the previous encounter before recording another.' : result?.code >= 400
          ? String(result.body?.message || 'The encounter could not be recorded. Check the current requirements and retry.')
          : result?.body?.intel ? 'Intel recorded: ' + String(result.body.intel.title || 'World tip') : 'Review your journal for the encounter result.';
      } catch {
        if (!destroyed && identity === sceneIdentity() && opening === actorOpening) actorNotice = 'The encounter result is unavailable. Use the game receipt to recover it safely.';
      } finally { if (!destroyed && identity === sceneIdentity()) {
        encounterPending = false; renderActorDock(); fitWorldFrame();
        const revealed = opening === actorOpening && Array.from(actorBody.querySelectorAll('[data-city-encounter-intel]')).find(item => item.dataset.cityEncounterIntel === confirmedIntelId);
        if (revealed) { revealed.focus({ preventScroll: true }); actorDock.scrollTop += revealed.getBoundingClientRect().top - actorDock.getBoundingClientRect().top - 8; }
      } }
    });

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
    function acceptResourceReceipt(next) {
      if (!next || next.state !== 'confirmed' || !['string', 'number'].includes(typeof next.id) || !String(next.id)) {
        resourceReceipt = null; return;
      }
      const id = String(next.id);
      if (String(resourceReceipt?.id) === id || seenResourceReceipts.has(id)) return;
      seenResourceReceipts.add(id);
      resourceReceipt = next;
    }
    function activityId(event, actor) {
      return event && ['string', 'number'].includes(typeof event.id) && String(event.id).length > 0 && String(event.id).length <= 200
        ? JSON.stringify([actor.id, actor.generation, String(event.id)]) : null;
    }
    function rememberActivity(event, actor) {
      const id = activityId(event, actor);
      if (!id) return;
      seenActivities.add(id);
      while (seenActivities.size > ACTIVITY_MEMORY) seenActivities.delete(seenActivities.values().next().value);
    }
    function removeActivity(actorId) {
      const activity = activities.get(actorId);
      if (!activity) return;
      activity.badge?.destroy(); activity.ring?.destroy();
      const sprite = activity.self ? player : actorSprites.get(actorId)?.sprite;
      sprite?.setAngle(0).setScale(1);
      activities.delete(actorId);
    }
    function renderActivityStatus() {
      const lines = Array.from(activities.values()).reverse().slice(0, 3).map(activity => ({ id: activity.id,
        text: (activity.self ? 'You' : actorName(findActor(activity.actorId))) + ' · ' + activity.label }));
      const signature = JSON.stringify(lines);
      if (signature === activitySignature) return;
      activitySignature = signature;
      activityStatus.replaceChildren(); activityStatus.hidden = !lines.length;
      if (lines.length) {
        activityStatus.append(element('strong', 'omerta-city__activity-title', 'Confirmed activity'));
        for (const line of lines) {
          const item = element('span', 'omerta-city__activity-line', line.text);
          item.dataset.cityActivityId = line.id; activityStatus.append(item);
        }
      }
      fitWorldFrame();
    }
    function expireActivities() {
      if (activityTimer) { clearTimeout(activityTimer); activityTimer = null; }
      const now = Date.now();
      for (const [id, activity] of activities) if (activity.expiresAt <= now) removeActivity(id);
      renderActivityStatus();
      if (activities.size) activityTimer = setTimeout(expireActivities,
        Math.max(1, Math.min(...Array.from(activities.values(), activity => activity.expiresAt)) - now));
    }
    function acceptActivity(event, actor = character) {
      const self = actor === character, now = Date.now();
      if (!event || self && (event.state !== 'confirmed' || event.actorId !== character.id
        || event.generation !== character.generation || event.district !== district.id)
        || !self && event.state !== undefined && event.state !== 'confirmed') return;
      const id = activityId(event, actor);
      const at = typeof event.at === 'number' ? event.at : typeof event.at === 'string' ? Date.parse(event.at) : NaN;
      if (!id || seenActivities.has(id) || !Number.isFinite(at) || at < now - ACTIVITY_AGE || at > now + 5000) return;
      const kind = Object.hasOwn(ACTIVITY_KINDS, event.kind) ? event.kind : 'work';
      const label = typeof event.label === 'string' && event.label.trim() ? event.label.trim().slice(0, 160) : 'Action confirmed';
      const venue = VENUES.find(venue => venue.id === event.venueId);
      rememberActivity(event, actor); removeActivity(actor.id);
      const marker = self ? null : actorSprites.get(actor.id);
      activities.set(actor.id, { id: String(event.id), actorId: actor.id, generation: actor.generation, self, kind, label,
        at, startedAt: now, expiresAt: Math.min(now + ACTIVITY_DURATION, at + ACTIVITY_AGE),
        // These few steps illustrate the public action; they are never a live location claim.
        path: marker && venue && !reducedMotion ? findRoute(marker, venue).slice(0, 5) : [] });
      expireActivities();
    }
    function clearActivities(nextOptions = {}) {
      for (const source of [options, nextOptions]) {
        const owner = source.character || character;
        rememberActivity(source.activityReceipt, owner);
        for (const actor of Array.isArray(source.actors) ? source.actors : []) rememberActivity(actor.activity, actor);
      }
      for (const id of activities.keys()) removeActivity(id);
      if (activityTimer) { clearTimeout(activityTimer); activityTimer = null; }
      renderActivityStatus();
    }
    function updateActivities(time, dt, playerMoving) {
      const now = Date.now();
      for (const [id, activity] of activities) {
        const marker = activity.self ? null : actorSprites.get(id), sprite = activity.self ? player : marker?.sprite;
        if (!sprite || activity.expiresAt <= now || !activity.self && marker.actor.generation !== activity.generation) {
          removeActivity(id); renderActivityStatus(); continue;
        }
        if (marker && activity.path.length && !reducedMotion) {
          if (id === selectedActor || id === pendingActor) activity.path = [];
          else {
            const point = activity.path[0], distance = Math.hypot(point.x - marker.x, point.y - marker.y), step = Math.min(distance, dt * 42);
            const x = distance ? marker.x + (point.x - marker.x) / distance * step : point.x;
            const y = distance ? marker.y + (point.y - marker.y) / distance * step : point.y;
            if (canWalk(x, y)) {
              if (x !== marker.x) sprite.setFlipX(x < marker.x);
              marker.x = x; marker.y = y;
              sprite.setPosition(x, y).setDepth(y); marker.name.setPosition(x, y - 73).setDepth(y + 1);
              marker.ring.setPosition(x, y).setDepth(y - 1);
              if (distance <= step + 0.25) activity.path.shift();
            } else activity.path = [];
          }
        }
        if (!activity.badge) {
          activity.badge = scene.add.text(0, 0, ACTIVITY_KINDS[activity.kind][0], { fontFamily: 'monospace', fontSize: 10,
            resolution: 2, color: '#f4e8d2', backgroundColor: '#25382f', padding: { x: 4, y: 3 } }).setOrigin(0.5);
          activity.ring = scene.add.graphics();
        }
        const phase = (now - activity.startedAt) / 180, pulse = reducedMotion ? 0 : Math.sin(phase) * 2;
        activity.ring.clear().lineStyle(2, ACTIVITY_KINDS[activity.kind][1], .9).strokeEllipse(0, 0, 37 + pulse, 15 + pulse);
        activity.ring.setPosition(sprite.x, sprite.y + 1).setDepth(sprite.y - 1);
        let badgeX = sprite.x, badgeY = sprite.y - (activity.self && artState.player !== 'generated' ? 55 : 90);
        if (externalPanel && activity.self) {
          // Keep the confirmation beside the avatar in the compact operation view.
          const view = scene.cameras.main.worldView, marginX = activity.badge.displayWidth / 2 + 6,
            marginY = activity.badge.displayHeight / 2 + 6;
          badgeX = Math.max(view.x + marginX, Math.min(view.right - marginX, sprite.x + 64));
          badgeY = Math.max(view.y + marginY, Math.min(view.bottom - marginY, sprite.y - 42));
        }
        activity.badge.setPosition(badgeX, badgeY).setDepth(sprite.y + 3);
        if (!reducedMotion && !(activity.self && playerMoving)) {
          const energetic = ['work', 'train', 'fight', 'craft'].includes(activity.kind);
          sprite.setAngle(energetic ? Math.sin(phase) * 3 : 0).setScale(1, energetic ? 1 + Math.sin(phase * 2) * .025 : 1);
        } else sprite.setAngle(0);
      }
    }
    function appendActionPreview(button, action) {
      const label = element('span', '', button.textContent);
      label.setAttribute('data-city-action-label', '');
      button.setAttribute('aria-label', label.textContent);
      button.replaceChildren(label);
      const preview = element('span', 'omerta-city__action-preview');
      preview.setAttribute('data-city-action-preview', '');
      preview.id = 'city-action-preview-' + (++instanceSequence);
      button.setAttribute('aria-describedby', preview.id);
      preview.append(element('strong', '', 'Before you act'), element('span', '',
        typeof action.consequence === 'string' && action.consequence.trim() ? action.consequence : 'No cost or reward estimate is available for this action.'));
      const blockers = Array.isArray(action.blockedBy) ? action.blockedBy : action.blockedBy ? [action.blockedBy] : [];
      const reasons = blockers.map(reason => typeof reason === 'string' ? reason : reason?.message || reason?.label || reason?.reason || reason?.code || '').filter(Boolean).join(' · ');
      if (reasons) preview.append(element('span', '', 'Requires: ' + reasons));
      button.append(preview);
    }
    function nerveRecoveryCopy() {
      const rate = numeric(options.rules?.pacing?.nerveRegenPerMin);
      return 'Nerve is used by street jobs and recovers over time up to your normal capacity. '
        + (rate !== null && rate > 0 ? 'Base recovery: ' + format(rate) + ' Nerve/min; bonuses may increase this.' : 'Check your current Nerve before choosing a job.');
    }
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
    function closeResourceHelp(restoreFocus) {
      resourceHelp.hidden = true;
      helpTrigger?.setAttribute('aria-expanded', 'false');
      fitWorldFrame();
      if (restoreFocus && helpTrigger?.isConnected) {
        helpTrigger.focus({ preventScroll: true });
        revealHudControl(helpTrigger);
      }
    }
    function revealHudControl(control) {
      if (!worldHud.contains(control)) return;
      const bounds = control.getBoundingClientRect(), frame = worldHud.getBoundingClientRect();
      if (bounds.bottom > frame.bottom) worldHud.scrollTop += bounds.bottom - frame.bottom;
      else if (bounds.top < frame.top) worldHud.scrollTop -= frame.top - bounds.top;
    }
    function showResourceHelp(key, trigger) {
      const notes = {
        cash: 'Cash pays for street operations and equipment. Inspect a job before choosing its costs and risks.',
        health: 'Health is your current condition. Low health makes fighting risky. The Life shows your recovery options.',
        energy: 'Energy is spent by training and other operations. The Life shows your current recovery and training options.',
        nerve: nerveRecoveryCopy(),
        heat: 'Heat reflects attention on your character. Check the risks and requirements of a job before acting.',
        level: 'Earn respect through confirmed activities to progress. The Life shows your skills and next milestone.'
      };
      helpVenue = VENUES.find(venue => venue.id === (['cash', 'nerve', 'heat'].includes(key) ? 'fixer' : 'training'));
      helpCopy.textContent = notes[key];
      helpKey = key;
      helpAction.textContent = 'Inspect ' + helpVenue.name;
      helpTrigger?.setAttribute('aria-expanded', 'false');
      helpTrigger = trigger; helpTrigger.setAttribute('aria-expanded', 'true');
      resourceHelp.hidden = false;
      fitWorldFrame();
      helpAction.focus({ preventScroll: true });
      revealHudControl(helpAction);
    }
    function updateHud() {
      const resources = resourceState();
      for (const [key, nodes] of resourceNodes) {
        const value = resources[key];
        const maximum = resources['max' + key[0].toUpperCase() + key.slice(1)];
        const copy = key === 'cash' && value !== null ? '$' + format(value)
          : format(value) + (maximum !== undefined && maximum !== null ? '/' + format(maximum) : '');
        setText(nodes.value, copy);
        const overcap = value !== null && maximum > 0 && value > maximum;
        nodes.bonus.hidden = !overcap;
        setText(nodes.bonus, overcap ? '+' + format(value - maximum) + ' bonus' : '');
        const change = (Array.isArray(resourceReceipt?.changes) ? resourceReceipt.changes : []).find(change => change?.key === key && typeof change.value === 'number' && Number.isFinite(change.value) && change.value !== 0);
        nodes.delta.hidden = !change;
        setText(nodes.delta, change ? (change.value > 0 ? '+' : '−') + (key === 'cash' ? '$' : '') + format(Math.abs(change.value)) : '');
        nodes.delta.dataset.direction = (key === 'heat' ? change?.value < 0 : change?.value > 0) ? 'gain' : 'cost';
        nodes.delta.setAttribute('aria-label', change ? String(change.label || key) + ' ' + (change.value > 0 ? 'increased by ' : 'decreased by ') + format(Math.abs(change.value)) + ', ' + String(resourceReceipt.label || 'confirmed action') : '');
        nodes.value.setAttribute('aria-label', key + ': ' + format(value) + (maximum > 0 ? ' of ' + format(maximum) : '') + (overcap ? ', above normal capacity' : ''));
        nodes.meter.hidden = value === null || maximum === undefined || maximum === null || maximum <= 0;
        if (!nodes.meter.hidden) { nodes.meter.max = maximum; nodes.meter.value = Math.max(0, Math.min(value, maximum)); }
        nodes.group.classList.toggle('is-low', key === 'health' && value !== null && value < 30);
        nodes.group.classList.toggle('is-hot', key === 'heat' && value !== null && value >= 60);
      }
      if (!resourceHelp.hidden && helpKey === 'nerve') setText(helpCopy, nerveRecoveryCopy());
      const p = resources.progress;
      progressRow.hidden = !p || p.respect === null || p.floor === null || p.next === null || p.level === null || p.next <= p.floor;
      if (!progressRow.hidden) {
        setText(progressCopy, format(Math.max(0, p.next - p.respect)) + ' respect to level ' + format(p.level + 1));
        progressMeter.max = p.next - p.floor;
        progressMeter.value = Math.max(0, Math.min(p.respect - p.floor, progressMeter.max));
        progressMeter.setAttribute('aria-label', 'Progress to level ' + (p.level + 1));
      }
      updateReadiness();
      const quest = nextQuest(), coach = character.coach;
      nextMove.hidden = !quest && (!coach || (!coach.label && !coach.hint));
      nextMove.dataset.cityGuidance = quest ? 'quest' : 'coach';
      if (!nextMove.hidden) {
        setText(nextTitle, String(quest ? quest.title || 'Continue your quest' : coach.label || 'Your next move'));
        setText(nextHint, quest ? 'Visit ' + quest.venue.name + ' to continue your quest.' : String(coach.hint || ''));
        setText(nextButton, quest ? 'Visit ' + quest.venue.name : 'Go →');
        if (quest) nextButton.setAttribute('aria-label', 'Visit ' + quest.venue.name);
        else nextButton.removeAttribute('aria-label');
        nextButton.hidden = !quest && (typeof coach.tab !== 'string' || !coach.tab);
      } else {
        setText(nextTitle, ''); setText(nextHint, '');
        nextButton.hidden = true;
        nextButton.removeAttribute('aria-label');
      }
      journal.hidden = !VENUES.some(v => actionsFor(v).some(action => action.tab === 'fieldwork'));
      const trackedObjective = trackedObjectiveId && trackableObjective(trackedObjectiveId);
      if (!trackedObjective) trackedObjectiveId = null;
      trackedVenueId = trackedObjective && VENUES.some(venue => venue.id === trackedObjective.venueId) ? trackedObjective.venueId : null;
      const tracked = !!worldUI && worldOptions().trackerVisible;
      nextCopy.hidden = tracked;
      if (tracked) { nextMove.hidden = false; nextButton.hidden = true; }
      updateVenueStates();
      fitWorldFrame();
    }
    function trackableObjective(id) {
      return (Array.isArray(options.objectives) ? options.objectives : []).find(objective => objective?.id === id && objective.available !== false
        && !['complete', 'completed', 'locked', 'unavailable'].includes(objective.status));
    }
    function questVenueId() { return trackedObjectiveId ? trackedVenueId : nextQuest()?.venue.id || null; }
    function updateVenueStates() {
      const nearby = nearVenue()?.id || null, quest = questVenueId();
      const signature = [nearby, quest, selected?.id, pendingVenue?.id].join(':');
      if (signature === venueStateSignature) return;
      venueStateSignature = signature;
      for (const [id, button] of buttons) {
        const states = [id === quest ? 'Quest' : '', id === selected?.id ? 'Selected' : id === pendingVenue?.id ? 'Walking' : '', id === nearby ? 'Nearby' : ''].filter(Boolean);
        button.classList.toggle('is-quest', id === quest);
        button.classList.toggle('is-nearby', id === nearby);
        button.dataset.cityVenueState = states.join(' ').toLowerCase();
        setText(button.querySelector('[data-city-destination-state]'), states.join(' · '));
      }
      if (scene && ready) for (const [index, marker] of (scene.data.get('markers') || []).entries()) {
        const venue = VENUES[index], active = venue.id === quest, near = venue.id === nearby;
        marker.clear();
        marker.lineStyle(active ? 3 : 2, active ? 0xffd876 : near ? 0xb3d8c5 : 0xc5a46b, active || near ? 1 : .7).strokeRoundedRect(venue.x - 11, venue.y - 11, 22, 22, 5);
        marker.fillStyle(active ? 0x715120 : 0x26332e, .96).fillRoundedRect(venue.x - 9, venue.y - 9, 18, 18, 4);
        if (active) marker.lineStyle(2, 0xffd876, .65).strokeCircle(venue.x, venue.y, 17);
      }
    }
    function updateReadiness() {
      let condition = { label: 'ON THE STREET', detail: 'Open a venue to see its operations.', tone: 'ready' };
      if (numeric(character.jailSeconds) > 0) condition = { label: 'LOCKUP', detail: 'Street actions are restricted. Open the Pen for your options.', tone: 'blocked' };
      else if (numeric(character.safeSeconds) > 0) condition = { label: 'SAFEHOUSE', detail: 'Offense and payouts are restricted while you are under.', tone: 'caution' };
      else if (character.law?.indicted) condition = { label: 'INDICTED', detail: 'Open The Law to inspect your case.', tone: 'blocked' };
      else if (character.wanted) condition = { label: 'WANTED', detail: 'Check The Law and your protection before taking another risk.', tone: 'blocked' };
      else if (numeric(character.hospSeconds) > 0) condition = { label: "DOC'S CARE", detail: 'Fighting is restricted while you recover.', tone: 'caution' };
      else if (numeric(character.health) !== null && numeric(character.health) < 30) condition = { label: 'LOW HEALTH', detail: 'Heal before taking a risky fight.', tone: 'caution' };
      const destinationName = pendingHome ? homes.find(home => home.key === pendingHome)?.street
        : pendingExit ? exits.find(exit => exit.id === pendingExit)?.name : pendingVenue?.name;
      const walking = path.length && destinationName ? 'Walking to ' + destinationName + '…' : '';
      const copy = walking ? (condition.tone === 'ready' ? walking : condition.detail + ' · ' + walking) : condition.detail;
      const changed = readinessCopy.textContent !== copy;
      if (readiness.dataset.tone !== condition.tone) readiness.dataset.tone = condition.tone;
      setText(readinessLabel, condition.label);
      setText(readinessCopy, copy);
      if (changed) fitWorldFrame();
    }
    function nextQuest() {
      let next = null;
      for (const venue of VENUES) {
        const quest = options.npcQuests?.[venue.id];
        for (const action of Array.isArray(quest?.actions) ? quest.actions : []) {
          if (!action || typeof action.id !== 'string' || !action.id || action.id === 'cancel'
            || action.isCancel === true || action.available !== true) continue;
          const phase = action.started === false ? 1 : 0;
          const order = Number.isSafeInteger(action.questOrder) && action.questOrder >= 0 ? action.questOrder : 0;
          if (!next || phase < next.phase || (phase === next.phase && order < next.order)) {
            next = { phase, order, quest: { ...quest, title: action.questTitle || quest.title, venue } };
          }
        }
      }
      return next?.quest || null;
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
    function navigate(tab, context) {
      if (destroyed || externalPanel) return;
      reportPosition(true);
      const details = context && Object.getPrototypeOf(context) === Object.prototype ? { ...context } : { venueId: context };
      if (typeof options.onNavigate === 'function') options.onNavigate(tab, details);
    }
    function renderActions(venue) {
      const actions = actionsFor(venue);
      const coreTraining = venue.id === 'training' && ready && typeof options.renderTraining === 'function';
      const signature = venue.id + ':' + coreTraining + ':' + JSON.stringify(actions);
      if (signature === renderedActionSignature) return;
      renderedActionSignature = signature;
      const focused = actionList.contains(document.activeElement) ? document.activeElement.dataset.cityAction : null;
      actionList.replaceChildren();
      for (const action of actions) {
        if (action.tab === venue.tab && !coreTraining) continue;
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
      const signature = venue.id + ':' + String(options.worldRecovery === true) + ':' + JSON.stringify(quest || null);
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
          button.disabled = action.available === false || options.worldRecovery === true;
          appendActionPreview(button, action);
          questButtons.append(button);
        }
      }
      if (focused) (Array.from(questButtons.children).find(button => button.dataset.cityQuestAction === focused && !button.disabled) || open).focus({ preventScroll: true });
    }
    function stopMovement() {
      routePreview = []; routePreviewVenue = null;
      queuedVenue = null;
      keys.clear(); heldMoves.clear(); path = []; pendingVenue = null; pendingActor = null; pendingHome = null; pendingPlot = null; pendingExit = null; queuedHome = null;
      for (const button of moveButtons.values()) button.classList.remove('is-held');
      redrawPath();
      updateReadiness();
    }
    function closePanels() {
      stopMovement(); worldUI?.close(false); hideVenue(false); hideActor(false); hideGameDock(false); closeResourceHelp(false);
    }
    function syncExternalPanel() {
      root.classList.toggle('has-external-panel', externalPanel);
      for (const node of [controls, destinations, nextMove, presence, homeSection, mapTools, resourceHelp]) node.inert = externalPanel;
      journal.disabled = externalPanel;
      for (const button of moveButtons.values()) button.disabled = externalPanel || !ready;
      for (const button of buttons.values()) button.disabled = externalPanel;
      const toolbar = root.querySelector('.city-world__toolbar'); if (toolbar) toolbar.inert = externalPanel;
      const tools = document.getElementById('player-view-switch')?.querySelector('[data-city-world-tools]') || root.querySelector('[data-city-world-tools]');
      if (tools) tools.disabled = externalPanel;
      if (game?.canvas) {
        game.canvas.tabIndex = externalPanel ? -1 : 0;
        game.canvas.setAttribute('aria-disabled', String(externalPanel));
      }
      if (externalPanel) { interact.disabled = true; cancel.disabled = true; }
    }
    function pauseRoute() {
      const preview = (path.length ? path : routePreview).map(point => ({ ...point }));
      const venue = pendingVenue?.id || routePreviewVenue;
      stopMovement();
      routePreview = preview; routePreviewVenue = venue;
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
    listen(journal, 'click', () => navigate('fieldwork', { venueId: 'directory', initialView: 'mysteries' }));
    listen(questButtons, 'click', event => {
      const button = event.target.closest('[data-city-quest-action]');
      if (button && !button.disabled && selected && questButtons.contains(button) && typeof options.onQuestAction === 'function') {
        const venue = selected, opening = venueOpening;
        options.onQuestAction(venue.id, button.dataset.cityQuestAction, {
          beforeDispatch: () => !destroyed && !card.hidden && !gameKind && selected === venue && venueOpening === opening,
        });
      }
    });
    listen(actionList, 'click', event => {
      const button = event.target.closest('[data-city-action]');
      if (button && selected && actionList.contains(button)) {
        if (button.dataset.cityAction === 'streets' && showGameDock(selected.id)) return;
        navigate(button.dataset.cityAction, selected.id);
      }
    });
    function renderGameDock() {
      if (!gameKind || gameDock.hidden) return;
      const render = gameKind === 'training' ? options.renderTraining : gameKind === 'crew' ? options.renderCrew : options.renderFixer;
      if (typeof render === 'function') render(gameBody);
    }
    function showGameDock(kind) {
      if (kind === 'clubhouse') kind = 'crew';
      const render = kind === 'training' ? options.renderTraining : kind === 'fixer' ? options.renderFixer : kind === 'crew' ? options.renderCrew : null;
      if (destroyed || externalPanel || !ready || typeof render !== 'function') return false;
      worldUI?.close(false);
      stopMovement(); hideActor(false); hideGameDock(false);
      gameReturn = selected?.id || kind; hideVenue(false);
      gameKind = kind; gameOpening++;
      gameBody.dataset.trainingOpening = gameBody.dataset.fixerOpening = gameBody.dataset.crewOpening = String(gameOpening);
      gameDock.setAttribute('aria-label', kind === 'training' ? 'The Training Room · core training' : kind === 'crew' ? 'The Clubhouse · crew missions' : 'The Fixer · street jobs');
      gameClose.setAttribute('aria-label', kind === 'training' ? 'Close core training' : kind === 'crew' ? 'Close crew missions' : 'Close street jobs');
      gameDock.dataset.cityGameplay = kind; gameDock.hidden = false; gameDock.scrollTop = 0;
      root.classList.add('is-gameplay'); root.classList.toggle('is-training', kind === 'training');
      renderGameDock(); fitWorldFrame(); revealVenue(viewport);
      const firstAction = gameBody.querySelector('[data-city-train]:not(:disabled), [data-city-crime]:not(:disabled)') || gameBody;
      firstAction.focus({ preventScroll: true });
      if (firstAction !== gameBody) firstAction.scrollIntoView({ block: 'nearest', behavior: 'instant' });
      syncPointerBounds(); return true;
    }
    function hideGameDock(focusCanvas) {
      if (!gameKind) return;
      if (gameKind === 'crew') options.retireCrew?.();
      gameKind = ''; gameOpening++;
      gameBody.dataset.trainingOpening = gameBody.dataset.fixerOpening = gameBody.dataset.crewOpening = String(gameOpening);
      gameDock.hidden = true; root.classList.remove('is-gameplay', 'is-training');
      gameBody.replaceChildren(); delete gameBody.dataset.trainingContent; delete gameBody.dataset.fixerContent;
      fitWorldFrame();
      if (focusCanvas) {
        const target = game?.canvas || buttons.get(gameReturn);
        if (target) { revealVenue(game?.canvas ? viewport : target); target.focus({ preventScroll: true }); }
      }
      syncPointerBounds();
    }
    listen(gameClose, 'click', () => hideGameDock(true));
    listen(gameDock, 'keydown', event => { if (event.key === 'Escape') { event.preventDefault(); hideGameDock(true); } });
    function showVenue(venue) {
      if (destroyed || externalPanel) return;
      venueOpening++;
      worldUI?.close(false);
      hideGameDock(false);
      hideActor(false);
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
      updateVenueStates();
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
        else {
          const style = window.getComputedStyle(chrome), pinned = parseFloat(style.top);
          top = Math.max(top, style.position === 'sticky' && Number.isFinite(pinned) ? pinned + bounds.height : bounds.bottom);
        }
      }
      card.style.setProperty('--city-card-height', Math.max(88, bottom - top - 16) + 'px');
      target.style.scrollMarginTop = (top + 8) + 'px';
      target.style.scrollMarginBottom = (height - bottom + 8) + 'px';
      if (scroll) {
        window.scrollTo({ top: window.scrollY, left: window.scrollX, behavior: 'instant' });
        target.scrollIntoView({ block: 'nearest', behavior: 'instant' });
        const bounds = target.getBoundingClientRect();
        if (bounds.height <= bottom - top - 16) {
          const delta = bounds.bottom > bottom - 8 ? bounds.bottom - bottom + 8 : bounds.top < top + 8 ? bounds.top - top - 8 : 0;
          if (delta) window.scrollBy({ top: delta, behavior: 'instant' });
        }
        syncPointerBounds();
      }
    }
    function hideVenue(focusCanvas) {
      const previousVenue = selected;
      venueOpening++;
      card.hidden = true;
      selected = null;
      for (const button of buttons.values()) button.setAttribute('aria-expanded', 'false');
      updateVenueStates();
      if (focusCanvas && game && game.canvas) game.canvas.focus({ preventScroll: true });
      else if (focusCanvas && previousVenue) {
        const destination = buttons.get(previousVenue.id);
        revealVenue(destination);
        destination.focus({ preventScroll: true });
      }
    }
    listen(open, 'click', () => {
      if (selected && !showGameDock(selected.id)) navigate(selected.tab, selected.id);
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
      clearPlayerNameClamp?.(); clearPlayerNameClamp = null;
      if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
      root.classList.add('omerta-city--unavailable');
      status.textContent = 'The neighborhood view is unavailable. Choose a destination below to keep playing.';
      controls.hidden = true;
      if (game) { game.destroy(true); game = null; }
      homeMarkers.clear(); exitLabels.clear(); extensionGround = null; regionInk = null;
      scene = null; player = null;
      const waiting = queuedHome; queuedHome = null;
      if (waiting && waiting.identity === sceneIdentity() && waiting.scope === options.worldScopeKey) showHome(waiting.key);
      const waitingVenue = queuedVenue; queuedVenue = null;
      if (waitingVenue && waitingVenue.identity === sceneIdentity() && waitingVenue.scope === options.worldScopeKey) {
        const venue = VENUES.find(venue => venue.id === waitingVenue.id);
        if (venue) showVenue(venue);
      }
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
    function nearActor() {
      if (!player) return null;
      let nearest = null, distance = 42;
      for (const [id, marker] of actorSprites) {
        const next = Math.hypot(marker.x - player.x, marker.y - player.y);
        if (next < distance) { nearest = { id, ...marker }; distance = next; }
      }
      return nearest;
    }
    function nearTarget() {
      const venue = nearVenue(), actor = nearActor();
      if (!player) return null;
      const targets = [];
      if (actor) targets.push({ actor, x: actor.x, y: actor.y });
      if (venue) targets.push({ venue, x: venue.x, y: venue.y });
      for (const home of homes) if (Math.hypot(home.entrance.x - player.x, home.entrance.y - player.y) < 42) targets.push({ home, ...home.entrance });
      for (const plot of nearbyPlots(player)) {
        if (homes.some(home => home.buildingId === plot.id)) continue;
        const entrance = localPoint(plot.entrance);
        if (Math.hypot(entrance.x - player.x, entrance.y - player.y) < 42) targets.push({ plot, ...entrance });
      }
      for (const exit of exits) if (Math.hypot(exit.x - player.x, exit.y - player.y) < 42) targets.push({ exit, x: exit.x, y: exit.y });
      targets.sort((a, b) => Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
      return targets[0] || null;
    }
    function inspectNearby() {
      if (externalPanel) return;
      const target = nearTarget();
      if (target?.actor) showActor(target.actor.id); else if (target?.home) showHome(target.home.key);
      else if (target?.plot) inspectPlot(target.plot); else if (target?.exit) showExit(target.exit.id); else if (target?.venue) showVenue(target.venue);
    }
    function walkToVenue(id) {
      const venue = VENUES.find(venue => venue.id === id);
      if (!venue || destroyed || externalPanel) return false;
      if (root.classList.contains('omerta-city--unavailable')) { showVenue(venue); return true; }
      if (!ready || !player || !game) { queuedVenue = { id, identity: sceneIdentity(), scope: options.worldScopeKey }; return true; }
      worldUI?.close(false);
      stopMovement(); hideVenue(false); hideActor(false); hideGameDock(false);
      game.canvas.focus({ preventScroll: true });
      if (Math.hypot(player.x - venue.x, player.y - venue.y) < 42) showVenue(venue);
      else { pendingVenue = venue; path = findRoute(player, venue); redrawPath(); }
      updateVenueStates();
      revealVenue(viewport);
      return true;
    }
    function centerPlayer() {
      if (!ready || !game || !player || destroyed || externalPanel) return false;
      fitCamera();
      revealVenue(viewport);
      game.canvas.focus({ preventScroll: true });
      return true;
    }
    function dimensions() {
      const phone = window.innerWidth <= 680;
      const fitted = !!canvasHost.style.getPropertyValue('--city-map-height');
      return { width: Math.max(phone ? 160 : 280, Math.round(canvasHost.clientWidth)), height: Math.max(phone || fitted ? 96 : 320, Math.round(canvasHost.clientHeight)) };
    }
    function syncPointerBounds() { if (game?.canvas) game.scale.updateBounds(); }
    function fitWorldFrame() {
      if (destroyed) return;
      const phone = window.innerWidth <= 680;
      const inspecting = Boolean(externalPanel || !actorDock.hidden || !gameDock.hidden || worldUI?.isOpen());
      viewport.classList.toggle('is-inspecting', inspecting);
      root.classList.toggle('is-inspecting', inspecting);
      if (!externalPanel && ((!phone && (!document.body.classList.contains('city-player-view') || actorDock.hidden || actorView !== 'person')) || !inspecting)) {
        worldHud.style.removeProperty('--city-hud-height');
        worldHud.removeAttribute('tabindex');
        worldHud.setAttribute('aria-label', 'Walking resources and readiness');
      }
      if (!externalPanel && !phone && !document.body.classList.contains('city-player-view')) {
        actorDock.style.removeProperty('--city-actor-height');
        gameDock.style.removeProperty('--city-training-height');
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
      const shortFrame = phone && bottom - top < 500;
      root.classList.toggle('is-short-frame', shortFrame);
      controls.style.setProperty('--city-controls-bottom', Math.max(0, window.innerHeight - bottom) + 'px');
      const guidanceHeight = document.body.classList.contains('city-player-view') && !inspecting && !nextMove.hidden
        ? nextMove.getBoundingClientRect().height : 0;
      if (externalPanel) {
        worldHud.style.setProperty('--city-hud-height', (phone ? 120 : 160) + 'px');
        worldHud.tabIndex = 0;
        worldHud.setAttribute('aria-label', 'Character resources and confirmed activity. Scroll to read all resources, warnings and latest feedback.');
      } else if (phone && (inspecting || shortFrame)) {
        // Reserve the real map and dock floors before measuring the HUD. Long
        // warnings and confirmed feedback remain available by keyboard scroll.
        const loadingWorld = worldUI?.isOpen() && root.querySelector('.city-world__content[aria-busy="true"]');
        let hudHeight = Math.max(0, bottom - top - 16 - 96 - (loadingWorld ? 120 : inspecting ? 64 : controls.getBoundingClientRect().height));
        // Keep the issued objective with the map when the resource row still
        // fits. More severe chrome pressure retains the existing scroll budget.
        if (guidanceHeight && hudHeight - guidanceHeight >= worldHead.getBoundingClientRect().height) hudHeight -= guidanceHeight;
        worldHud.style.setProperty('--city-hud-height', hudHeight + 'px');
        const overflow = worldHud.scrollHeight > worldHud.clientHeight;
        if (overflow) worldHud.tabIndex = 0; else worldHud.removeAttribute('tabindex');
        worldHud.setAttribute('aria-label', overflow ? 'Walking resources and readiness. Scroll to read all resources, warnings, district details and latest feedback.' : 'Walking resources and readiness');
      } else if (!phone && !actorDock.hidden && actorView === 'person') {
        // Confirmed feedback can make the HUD taller than a short desktop's
        // remaining frame. Keep one complete action preview beside the map.
        const action = actorBody.querySelector('[data-city-encounter]');
        const dockFloor = Math.max(64, Math.min(240, Math.ceil(action?.getBoundingClientRect().height || 0) + 16));
        const hudHeight = Math.max(0, bottom - top - 16 - 96 - controls.getBoundingClientRect().height - dockFloor);
        worldHud.style.setProperty('--city-hud-height', hudHeight + 'px');
        const overflow = worldHud.scrollHeight > worldHud.clientHeight;
        if (overflow) worldHud.tabIndex = 0; else worldHud.removeAttribute('tabindex');
        worldHud.setAttribute('aria-label', overflow ? 'Walking resources and readiness. Scroll to read all resources, warnings, district details and latest feedback.' : 'Walking resources and readiness');
      }
      const activityLayout = externalPanel ? [worldHud.clientHeight, worldHud.scrollHeight, activitySignature].join(':') : '';
      if (activityLayout !== activityHudLayout && externalPanel && activities.size) {
        worldHud.scrollTop = worldHud.scrollHeight - worldHud.clientHeight;
      }
      activityHudLayout = activityLayout;
      const frameAvailable = bottom - top - worldHud.getBoundingClientRect().height - controls.getBoundingClientRect().height - 16;
      const available = frameAvailable - (guidanceHeight + 96 <= frameAvailable ? guidanceHeight : 0);
      if (!actorDock.hidden) actorDock.style.setProperty('--city-actor-height', Math.max(64, Math.min(240, available - 96)) + 'px');
      if (!gameDock.hidden) gameDock.style.setProperty('--city-training-height', Math.max(64, Math.min(240, available - 96)) + 'px');
      if (worldUI?.isOpen()) {
        const panel = worldUI.getState().panel, preferred = ['room', 'map'].includes(panel) ? 360 : 240;
        worldUI.setHeight(Math.max(64, Math.min(preferred, available - 96)));
      }
      const maximum = externalPanel ? (phone ? 128 : 300) : phone ? 440 : Math.min(640, canvasHost.clientWidth * 2 / 3);
      const panelHeight = (actorDock.hidden ? 0 : actorDock.getBoundingClientRect().height) + (gameDock.hidden ? 0 : gameDock.getBoundingClientRect().height) + (worldUI?.panelHeight() || 0);
      const height = Math.max(96, Math.min(maximum, Math.floor(available - panelHeight)));
      const value = height + 'px';
      if (canvasHost.style.getPropertyValue('--city-map-height') !== value) {
        canvasHost.style.setProperty('--city-map-height', value);
        fitCamera();
      }
      syncPointerBounds();
    }
    const hudObserver = typeof ResizeObserver === 'function' ? new ResizeObserver(fitWorldFrame) : null;
    if (hudObserver) { for (const node of [worldHud, nextMove, controls, actorDock, gameDock]) hudObserver.observe(node); }
    listen(window, 'resize', fitWorldFrame);
    function fitPlayerName() {
      const name = scene.data.get('playerName'), camera = scene.cameras.main;
      if (!name) return 0;
      name.setScale(Math.min(Math.max(1, 13 / (parseFloat(name.style.fontSize) * camera.zoom)),
        (camera.width - 4) / (name.width * camera.zoom)));
      const halfHeight = name.displayHeight / 2, gap = 2 / camera.zoom;
      name.y = Math.min(Math.round(player.y - (artState.player === 'generated' ? 72 : 40)),
        player.getBounds().top - halfHeight - gap);
      return player.y - name.y + halfHeight + gap;
    }
    function fitCamera() {
      if (!scene || !game || !player) return;
      const size = dimensions();
      if (game.scale.width !== size.width || game.scale.height !== size.height) game.scale.resize(size.width, size.height);
      const camera = scene.cameras.main;
      // Scale the neighborhood to the usable width; narrow phones retain context
      // without shrinking labels or revealing empty bars around the town art.
      const automaticZoom = size.width <= 680
        ? Math.max(.65, Math.min(1, size.width / 430))
        : Math.max(.9, Math.min(1.35, size.width / WORLD.width));
      const maximumZoom = Math.min(2, size.height / 110);
      const minimumZoom = Math.min(maximumZoom, Math.max(.35, size.width / world.width, size.height / world.height));
      const zoom = Math.max(minimumZoom, Math.min(maximumZoom, automaticZoom * zoomPreference));
      camera.setZoom(zoom);
      zoomOut.disabled = zoomPreference <= .65 || zoom <= minimumZoom + .001;
      zoomIn.disabled = zoomPreference >= 1.6 || zoom >= maximumZoom - .001;
      zoomOut.title = zoomIn.title = 'Neighborhood zoom: ' + Math.round(zoom * 100) + '%';
      camera.setBounds(world.x || 0, world.y || 0, world.width, world.height);
      // Reserve the measured label and sprite extent, including legible text at low zoom.
      const followOffsetY = Math.max(0, fitPlayerName() - size.height / (2 * zoom));
      camera.startFollow(player, true, reducedMotion ? 1 : 0.16, reducedMotion ? 1 : 0.16, 0, followOffsetY);
      camera.centerOn(player.x, player.y - followOffsetY);
      syncPointerBounds();
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
          input: { keyboard: false, mouse: { preventDefaultWheel: false }, touch: { capture: true } },
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
      const placeNames = [];
      const label = (x, y, text, size, color, center) => s.add.text(x, y, text, {
        fontFamily: 'monospace', fontSize: size || 10, color: color || '#dfd1ad',
        resolution: 2, stroke: '#161719', strokeThickness: 2, padding: { x: 1, y: 1 }
      }).setOrigin(center ? 0.5 : 0, 0).setDepth(2);
      if (s.textures.exists('city-art-background') && district.id === 'docks') {
        artState.background = 'generated';
        s.add.image(0, 0, 'city-art-background').setOrigin(0).setDisplaySize(WORLD.width, WORLD.height).setDepth(0);
        for (const v of VENUES.filter(v => v.building)) {
          placeNames.push(s.add.text(v.building.x + v.building.width / 2, v.labelY, v.name, {
            fontFamily: 'Arial, sans-serif', fontSize: 15, fontStyle: 'bold', resolution: 2,
            color: '#fff0cd', backgroundColor: '#352d26',
            padding: { x: 6, y: 3 }
          }).setOrigin(0.5, 0).setDepth(2).setData('venueId', v.id).setData('anchorX', v.building.x + v.building.width / 2));
        }
      } else {
        let seed = 17;
        for (const c of String(district.id || district.name || 'omerta')) seed = (seed * 31 + c.charCodeAt(0)) >>> 0;
        const random = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
        const palette = [0x775247, 0x725b4c, 0x686152][seed % 3];
        const g = s.add.graphics();
        const rect = (x, y, w, h, color, alpha) => g.fillStyle(color, alpha === undefined ? 1 : alpha).fillRect(x, y, w, h);
        // Cobblestones, drainage channels, and the worn main road.
        rect(0, 0, 960, 640, region.ground);
        for (let y = 0; y < 560; y += 12) for (let x = 0; x < 960; x += 22) {
          const offset = y % 24 ? 11 : 0;
          const shade = [0x616256, 0x55574f, 0x5c5d51, 0x67655a][Math.floor(random() * 4)];
          rect(x + offset, y + 1, 20, 10, shade);
          rect(x + offset + 2, y + 2, 16, 1, 0x767468, 0.3);
        }
        rect(0, 248, 960, 48, region.road);
        rect(334, 226, 140, 326, 0x3e4445);
        rect(732, 210, 44, 342, 0x3e4445);
        for (let x = 0; x < 960; x += 24) { rect(x, 247, 21, 3, 0x9b9279); rect(x, 297, 21, 3, 0x9b9279); }
        for (let y = 306; y < 542; y += 24) { rect(331, y, 3, 21, 0x9b9279); rect(475, y, 3, 21, 0x9b9279); }
        for (let i = 0; i < 130; i++) {
          const x = Math.floor(random() * 960), y = 250 + Math.floor(random() * 43);
          rect(x, y, 2 + Math.floor(random() * 7), 1, 0x7c7967, 0.4);
        }
        // Canal and old stone quay; the water is a physical boundary.
        rect(0, 554, 960, 86, region.water);
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
          placeNames.push(label(b.x + b.width / 2, signY + 5, venue.sign, 10, '#ead6a1', true));
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
        if (district.id !== 'docks') {
          rect(0, 546, 960, 94, region.ground);
          rect(0, 552, 960, 36, region.road);
          for (let x = 24; x < 930; x += 120) {
            rect(x, 604, 48, 12, district.id === 'cathedral' ? 0x87937b : 0x8b6552);
            rect(x + 8, 600, 32, 4, 0xb6ab89);
          }
        }
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
      if (region.landmark) placeNames.push(label(region.landmark.x + region.landmark.width / 2, region.landmark.y + 10, region.landmark.name, 10, '#ead6a1', true));
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
        { x: 117, y: 234, key: 'city-fixer', title: 'FIXER · NPC', venue: 'fixer' },
        { x: 222, y: 526, key: 'city-worker', title: 'MECHANIC · NPC', venue: 'workshop' },
        { x: 629, y: 502, key: 'city-fixer', title: 'TRAINER · NPC', venue: 'training' },
        { x: 812, y: 224, key: 'city-fixer', title: 'DOORMAN · NPC', venue: 'clubhouse' },
        { x: 418, y: 244, key: 'city-neighbor', title: 'EDITOR · NPC', venue: 'stories' },
        { x: 875, y: 398, key: 'city-neighbor' },
        { x: 322, y: 280, key: 'city-worker' }
      ].map(n => {
        const generatedKey = n.key.replace('city-', 'city-art-');
        const generated = s.textures.exists(generatedKey);
        const sprite = s.add.sprite(n.x, n.y, generated ? generatedKey : n.key)
          .setOrigin(0.5, generated ? 58 / 60 : 0.85).setDepth(n.y);
        if (n.title) {
          const role = n.title.split(' · ')[0].toLowerCase();
          placeNames.push(label(n.x, n.y - (generated ? 65 : 48), role[0].toUpperCase() + role.slice(1), 13, '#f6e4bb', true)
            .setDepth(n.y + 1).setData('npcVenue', n.venue));
        }
        return { ...n, sprite };
      });
      const playerRing = s.add.graphics().setDepth(350);
      playerRing.fillStyle(0x171f1c, .55).fillEllipse(0, 0, 42, 17);
      playerRing.lineStyle(3, 0xffdf87, 1).strokeEllipse(0, 0, artState.player === 'generated' ? 38 : 29, 14);
      playerRing.lineStyle(1, 0x35251b, 1).strokeEllipse(0, 0, artState.player === 'generated' ? 44 : 35, 19);
      player = s.add.sprite(initialPosition.x, initialPosition.y, artState.player === 'generated' ? 'city-art-player-down' : 'city-player')
        .setOrigin(0.5, artState.player === 'generated' ? 58 / 60 : 0.85).setDepth(initialPosition.y);
      player.setTint(lookTints[look]);
      const playerName = s.add.text(initialPosition.x, initialPosition.y - 72, String(character.name || 'You').slice(0, 26), {
        fontFamily: 'monospace', fontSize: artState.player === 'generated' ? 14 : 10, resolution: 2,
        color: '#f3d187', stroke: '#151d1e', strokeThickness: 3
      }).setOrigin(0.5).setDepth(367);
      const nameCamera = s.cameras.main, nameEvents = s.sys.events;
      function placePlayerName() {
        if (destroyed || !ready || !player || !playerName.scene) return;
        fitPlayerName();
        // Followupdate runs after the camera's rendered transform is refreshed,
        // including stationary frames and viewport resizes. Keep the full label.
        const half = playerName.displayWidth / 2, y = nameCamera.y + nameCamera.height / 2;
        const left = nameCamera.getWorldPoint(nameCamera.x + 2, y).x + half;
        const right = nameCamera.getWorldPoint(nameCamera.x + nameCamera.width - 2, y).x - half;
        playerName.x = Math.max(left, Math.min(right, Math.round(player.x)));
        // Keep the player's full name legible in a crowd. Other names stay
        // available in the roster, venue buttons and inspector while occluded.
        const bounds = playerName.getBounds(), gap = 2 / nameCamera.zoom;
        const reveal = label => {
          label.setScale(Math.min(Math.max(1, 12 / (parseFloat(label.style.fontSize) * nameCamera.zoom)),
            (nameCamera.width - 10) / (label.width * nameCamera.zoom)));
          const npcVenue = label.getData?.('npcVenue'), venueId = label.getData?.('venueId');
          const focusVenue = selected?.id || pendingVenue?.id || nearVenue()?.id;
          if (npcVenue && npcVenue !== focusVenue) { label.setVisible(false); return; }
          if (venueId) {
            const anchor = label.getData('anchorX'), half = label.displayWidth / 2;
            const screenLeft = nameCamera.worldView.x + 5 / nameCamera.zoom;
            const screenRight = nameCamera.worldView.right - 5 / nameCamera.zoom;
            const important = venueId === focusVenue || venueId === questVenueId();
            if (!important && (anchor - half < screenLeft || anchor + half > screenRight)) { label.setVisible(false); return; }
            label.x = important ? Math.max(screenLeft + half, Math.min(screenRight - half, anchor)) : anchor;
            label.setColor(venueId === questVenueId() ? '#ffe194' : '#fff0cd');
          }
          const other = label.getBounds();
          label.setVisible(!(other.right > bounds.left - gap && other.left < bounds.right + gap
            && other.bottom > bounds.top - gap && other.top < bounds.bottom + gap));
        };
        placeNames.forEach(reveal);
        for (const marker of actorSprites.values()) reveal(marker.name);
        for (const marker of homeMarkers.values()) reveal(marker.name);
        for (const label of exitLabels.values()) reveal(label);
      }
      nameCamera.on('followupdate', placePlayerName);
      function removePlayerNameClamp() {
        nameCamera.off('followupdate', placePlayerName);
        nameEvents.off('shutdown', removePlayerNameClamp); nameEvents.off('destroy', removePlayerNameClamp);
      }
      nameEvents.once('shutdown', removePlayerNameClamp); nameEvents.once('destroy', removePlayerNameClamp);
      clearPlayerNameClamp = removePlayerNameClamp;
      listeners.push(clearPlayerNameClamp);
      s.data.set('playerRing', playerRing);
      s.data.set('playerName', playerName);
      s.data.set('npcs', npcs);
      s.data.set('markers', markerObjects);
      const canvas = s.sys.game.canvas;
      canvas.tabIndex = 0;
      canvas.setAttribute('role', 'img');
      canvas.setAttribute('aria-label', 'Playable neighborhood map. Tap to walk, or focus and use arrow keys or WASD. E or Enter opens a nearby venue. Destination buttons below provide the same access.');
      listen(canvas, 'keydown', event => {
        if (externalPanel || crossingPending || document.activeElement !== canvas || event.ctrlKey || event.metaKey || event.altKey) return;
        const key = event.key.toLowerCase();
        if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'w', 'a', 's', 'd'].includes(key)) {
          event.preventDefault();
          if (event.repeat) return;
          worldUI?.close(false);
          hideGameDock(false);
          keys.add(key); heldMoves.clear(); path = []; routePreview = []; routePreviewVenue = null; pendingVenue = null; pendingActor = null; pendingHome = null; pendingPlot = null; pendingExit = null; redrawPath();
        } else if (key === 'e' || key === 'enter') {
          event.preventDefault(); inspectNearby();
        } else if (key === 'escape') { event.preventDefault(); stopMovement(); hideGameDock(true); hideVenue(false); hideActor(false); }
      });
      listen(canvas, 'keyup', event => {
        const key = event.key.toLowerCase();
        if (keys.has(key)) { keys.delete(key); event.preventDefault(); }
      });
      listen(canvas, 'blur', event => {
        if (event.relatedTarget?.closest('[data-city-zoom], [data-city-recenter]')) { keys.clear(); heldMoves.clear(); }
        else if (event.relatedTarget?.closest('[data-city-world-map], [data-city-world-tools], .city-world__dock')) pauseRoute();
        else stopMovement();
      });
      listen(window, 'blur', () => stopMovement());
      listen(document, 'visibilitychange', () => {
        if (document.hidden) stopMovement();
      });
      s.input.on('pointerdown', pointer => {
        if (externalPanel || crossingPending) return;
        const point = s.cameras.main.getWorldPoint(pointer.x, pointer.y);
        worldUI?.close(false);
        hideGameDock(false);
        hideActor(false);
        canvas.focus({ preventScroll: true });
        hideVenue(false);
        stopMovement();
        const hitSprite = sprite => {
          const box = sprite.getBounds(), extra = Math.max(8, (44 / s.cameras.main.zoom - box.width) / 2);
          return point.x >= box.left - extra && point.x <= box.right + extra && point.y >= box.top - 6 && point.y <= box.bottom + 10;
        };
        // Extra touch padding must yield to the sprite the player actually tapped.
        const actor = Array.from(actorSprites, ([id, marker]) => ({ id, ...marker }))
          .filter(marker => hitSprite(marker.sprite)).sort((a, b) =>
            Number(b.sprite.getBounds().contains(point.x, point.y)) - Number(a.sprite.getBounds().contains(point.x, point.y))
            || Math.hypot(point.x - a.x, point.y - a.y) - Math.hypot(point.x - b.x, point.y - b.y))[0];
        if (actor) {
          pointer.event?.stopPropagation();
          if (Math.hypot(player.x - actor.x, player.y - actor.y) < 42) showActor(actor.id);
          else { pendingActor = actor.id; path = findRoute(player, actor); redrawPath(); }
          return;
        }
        const local = npcs.filter(npc => npc.venue && hitSprite(npc.sprite))
          .sort((a, b) => Math.hypot(point.x - a.x, point.y - a.y) - Math.hypot(point.x - b.x, point.y - b.y))[0];
        if (local) { walkToVenue(local.venue); return; }
        const home = homes.find(home => point.x >= home.building.x && point.x <= home.building.x + home.building.width
          && point.y >= home.building.y - 12 && point.y <= home.entrance.y + 14);
        if (home) { walkHome(home.key); return; }
        const plot = nearbyPlots(point).find(plot => {
          const b = localRect(plot.building);
          return point.x >= b.x - 3 && point.x <= b.x + b.width + 3 && point.y >= b.y - 8 && point.y <= b.y + b.height + 18;
        });
        if (plot) { walkPlot(plot); return; }
        const exit = exits.find(exit => Math.hypot(point.x - exit.x, point.y - exit.y) < 30);
        if (exit) { walkExit(exit.id); return; }
        const venue = VENUES.find(v => Math.hypot(point.x - v.x, point.y - v.y) < 35 ||
          (v.building && point.x >= v.building.x && point.x <= v.building.x + v.building.width &&
           point.y >= v.building.y && point.y <= v.building.y + v.building.height));
        if (venue && Math.hypot(player.x - venue.x, player.y - venue.y) < 42) { showVenue(venue); return; }
        const target = venue || point;
        pendingVenue = venue || null;
        path = findRoute(player, target);
        redrawPath();
      });
      ready = true;
      venueStateSignature = '';
      updateVenueStates();
      syncActorSprites();
      drawHomes();
      syncExternalPanel();
      if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
      status.textContent = '';
      fitCamera();
      updateScene(0, 0);
      fitWorldFrame();
      reportPosition(true);
      const waiting = queuedHome; queuedHome = null;
      if (waiting && waiting.identity === sceneIdentity() && waiting.scope === options.worldScopeKey) walkHome(waiting.key);
      const waitingVenue = queuedVenue; queuedVenue = null;
      if (waitingVenue && waitingVenue.identity === sceneIdentity() && waitingVenue.scope === options.worldScopeKey) walkToVenue(waitingVenue.id);
    }

    function updateScene(time, delta) {
      const dt = Math.min(delta / 1000, 0.05);
      for (const key of permeableHomes) {
        const home = homes.find(item => item.key === key), b = home?.building;
        if (!b || !(player.x + PLAYER_RADIUS > b.x && player.x - PLAYER_RADIUS < b.x + b.width
          && player.y + PLAYER_RADIUS > b.y && player.y - PLAYER_RADIUS < b.y + b.height)) {
          permeableHomes.delete(key);
          obstacles = baseObstacles().concat(homes.filter(home => !permeableHomes.has(home.key)).map(home => ({ ...home.building })));
        }
      }
      const previousX = player.x, previousY = player.y;
      let dx = 0, dy = 0, moving = false;
      if (!externalPanel && !crossingPending && game && document.activeElement === game.canvas) {
        dx = Number(keys.has('arrowright') || keys.has('d')) - Number(keys.has('arrowleft') || keys.has('a'));
        dy = Number(keys.has('arrowdown') || keys.has('s')) - Number(keys.has('arrowup') || keys.has('w'));
      }
      if (!externalPanel && !crossingPending) {
        dx += Number(heldMoves.has('right')) - Number(heldMoves.has('left'));
        dy += Number(heldMoves.has('down')) - Number(heldMoves.has('up'));
      }
      if (dx || dy) {
        const length = Math.hypot(dx, dy);
        const stepX = dx / length * SPEED * dt, stepY = dy / length * SPEED * dt;
        advanceTo(player.x + stepX, player.y);
        if (!crossingPending) advanceTo(player.x, player.y + stepY);
        moving = true;
      } else if (!externalPanel && !crossingPending && path.length) {
        const point = path[0];
        const distance = Math.hypot(point.x - player.x, point.y - player.y);
        if (distance < SPEED * dt + 0.25) {
          if (advanceTo(point.x, point.y)) {
            path.shift();
            if (!path.length) { redrawPath(); if (pendingActor) showActor(pendingActor); else if (pendingHome) showHome(pendingHome); else if (pendingPlot) inspectPlot(pendingPlot); else if (pendingExit) showExit(pendingExit); else if (pendingVenue) showVenue(pendingVenue); }
          } else if (!crossingPending) stopMovement();
        } else {
          const nextX = player.x + (point.x - player.x) / distance * SPEED * dt;
          const nextY = player.y + (point.y - player.y) / distance * SPEED * dt;
          if (!advanceTo(nextX, nextY) && !crossingPending) stopMovement();
        }
        moving = true;
      }
      const movedX = player.x - previousX, movedY = player.y - previousY;
      moving = Math.hypot(movedX, movedY) > 0.01;
      if (moving) {
        crossingMessage = '';
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
        let decorative = 0;
        scene.data.get('npcs').forEach((npc, i) => {
          if (!npc.title) {
            const pose = window.OmertaCityWorldUI?.ambientPose?.(decorative++, time);
            if (pose && canWalk(pose.x, pose.y)) npc.sprite.setPosition(pose.x, pose.y).setDepth(pose.y);
            else npc.sprite.x = npc.x + Math.sin(time / 2300 + i) * 13;
          }
        });
      }
      const target = nearTarget(), nearby = target?.venue || target?.actor || target?.home || target?.plot || target?.exit;
      interact.disabled = externalPanel || crossingPending || !nearby;
      const nearbyName = target?.actor ? actorName(target.actor.actor) : target?.home?.street || target?.plot?.id || target?.exit?.name || target?.venue?.name;
      const interactionCopy = target?.actor ? 'Talk to ' + nearbyName : target?.home ? 'Inspect street' : target?.plot ? 'Inspect property' : target?.exit ? 'Route to ' + nearbyName
        : target?.venue ? 'Enter ' + nearbyName : 'Move closer to interact';
      const controlsChanged = interact.textContent !== interactionCopy || cancel.disabled !== (!moving && !path.length && !keys.size && !heldMoves.size);
      setText(interact, interactionCopy);
      cancel.disabled = externalPanel || !moving && !path.length && !keys.size && !heldMoves.size;
      root.classList.toggle('is-walking', !cancel.disabled);
      if (controlsChanged && !hudObserver) fitWorldFrame();
      for (const [id, marker] of actorSprites) {
        const copy = id === selectedActor || id === target?.actor?.id
          ? actorName(marker.actor).slice(0, 22) + '\n' + marker.actor.kind.toUpperCase() : marker.actor.kind.toUpperCase();
        if (marker.name.text !== copy) marker.name.setText(copy);
      }
      const nearbyText = nearbyName ? 'Nearby: ' + nearbyName : 'Move near a person or place to interact.';
      if (nearbyCopy.textContent !== nearbyText) nearbyCopy.textContent = nearbyText;
      if (status.textContent !== crossingMessage) status.textContent = crossingMessage;
      if (layout) drawConnectedCity();
      updateActivities(time, dt, moving);
      updateReadiness();
      updateVenueStates();
      reportPosition(false);
      worldUI?.frame({ position: positionState(), world: { ...world }, obstacles, homes: homeState(), roads: roadState(), exits: exits.map(exit => ({ ...exit })),
        actorMarkers: Array.from(actorSprites, ([id, marker]) => ({ id, kind: marker.actor.kind, x: marker.x, y: marker.y })),
        trackedObjectiveId, questVenueId: questVenueId(), selectedVenue: selected?.id || pendingVenue?.id || routePreviewVenue || null,
        nearbyVenue: nearVenue()?.id || null, route: (path.length ? path : routePreview).map(point => ({ ...point })), routeActive: path.length > 0 });
    }

    function sceneState() {
        const camera = scene && scene.cameras.main;
        return {
          ready, reducedMotion, externalPanel, art: { ...artState }, facing: playerFacing,
          connected: !!layout, plotCount: layout?.plots.length || homes.length, visiblePlots, crossingPending,
          activities: Array.from(activities.values(), activity => ({ id: activity.id, actorId: activity.actorId,
            generation: activity.generation, self: activity.self, kind: activity.kind, label: activity.label,
            startedAt: activity.startedAt, expiresAt: activity.expiresAt, pathLength: activity.path.length,
            rendered: !!activity.badge, moving: !reducedMotion && activity.path.length > 0,
            badge: activity.badge ? { x: activity.badge.x, y: activity.badge.y,
              width: activity.badge.displayWidth, height: activity.badge.displayHeight } : null })),
          resources: resourceState(), position: positionState(), selectedVenue: selected?.id || null,
          selectedActor, actorOpening, actorPage,
          trainingOpen: gameKind === 'training', gameDock: gameKind || null, gameOpening, worldUI: worldUI?.getState() || null, look,
          actorMarkers: Array.from(actorSprites, ([id, marker]) => ({ id, kind: marker.actor.kind, x: marker.x, y: marker.y })),
          actions: Object.fromEntries(VENUES.map(v => [v.id, actionsFor(v)])),
          player: player ? { x: player.x, y: player.y } : null,
          destinations: VENUES.map(v => ({ id: v.id, x: v.x, y: v.y, tab: v.tab })),
          obstacles: obstacles.map(r => ({ ...r })), homes: homeState(), roads: roadState(), exits: exits.map(exit => ({ ...exit })),
          selectedHome, selectedExit, region: { id: district.id, landmark: region.landmark?.name || 'The Waterfront' },
          ambient: scene && ready ? scene.data.get('npcs').filter(n => !n.title).map(n => ({ x: n.sprite.x, y: n.sprite.y })) : [],
          camera: camera ? { x: camera.worldView.x, y: camera.worldView.y, zoom: camera.zoom, preference: zoomPreference, width: camera.width, height: camera.height } : null,
          world: { ...world }, pathLength: path.length,
          trackedObjectiveId, questVenueId: questVenueId(), nearbyVenue: nearVenue()?.id || null,
          routeVenueId: pendingVenue?.id || routePreviewVenue || null, route: (path.length ? path : routePreview).map(point => ({ ...point })), routeActive: path.length > 0
        };
      }

    syncExternalPanel();
    acceptActivity(options.activityReceipt);
    return {
      update: function (nextOptions) {
        if (destroyed || !nextOptions) return;
        const identity = sceneIdentity();
        const previousDistrict = district.id;
        const worldScopeChanged = 'worldScopeKey' in nextOptions && nextOptions.worldScopeKey !== options.worldScopeKey;
        if (nextOptions.district) district = nextOptions.district;
        if (nextOptions.character) character = nextOptions.character;
        if (identity !== sceneIdentity() || worldScopeChanged) {
          crossingSequence++; crossingPending = false; crossingMessage = '';
          hideGameDock(false);
          hideActor(false); actorPage = 0; actorNotice = ''; paging = false; encounterPending = false;
          options.actors = []; options.intel = []; options.objectives = []; options.encounterReceipt = null; options.encounterRecovery = false;
        }
        if (identity !== sceneIdentity() || worldScopeChanged) {
          clearActivities(nextOptions);
          for (const receipt of [resourceReceipt, nextOptions.resourceReceipt]) if (receipt?.id !== undefined) seenResourceReceipts.add(String(receipt.id));
          resourceReceipt = null;
          trackedObjectiveId = null; trackedVenueId = null;
          hideGameDock(false); hideVenue(false);
          options.worldSocial = null; options.worldChat = null; options.worldReceipt = null; options.worldRecovery = false;
          options.worldAtlas = null; options.worldCollection = null; options.worldHomes = null;
          homeBoard = null; homes = []; homeSlots.clear(); permeableHomes.clear(); hideActor(false); stopMovement();
          look = 'classic'; player?.setTint(lookTints.classic);
        }
        if (layout && previousDistrict !== district.id) {
          cityGround?.destroy(); cityGround = null; suburbInk?.destroy(); suburbInk = null;
          cityLabels.splice(0).forEach(label => label.destroy()); suburbStamp = '';
          player?.setPosition(430, 366);
        }
        if (typeof nextOptions.onNavigate === 'function') options.onNavigate = nextOptions.onNavigate;
        if (typeof nextOptions.onPositionChange === 'function') options.onPositionChange = nextOptions.onPositionChange;
        if (typeof nextOptions.onQuestAction === 'function') options.onQuestAction = nextOptions.onQuestAction;
        for (const key of ['renderTraining', 'renderFixer']) if (key in nextOptions) options[key] = typeof nextOptions[key] === 'function' ? nextOptions[key] : null;
        for (const key of ['onPresencePage', 'onEncounter', 'onIntelAction', 'onEncounterRetry']) if (key in nextOptions) options[key] = typeof nextOptions[key] === 'function' ? nextOptions[key] : null;
        for (const key of ['venueActions', 'progress', 'npcQuests', 'actors', 'hasMore', 'intel', 'objectives', 'encounterReceipt', 'encounterRecovery']) if (key in nextOptions) options[key] = nextOptions[key];
        for (const key of ['worldScopeKey', 'worldReceipt', 'worldRecovery', 'worldSocial', 'worldChat', 'worldAtlas', 'worldCollection', 'worldHomes', 'onWorldTravel', 'onPlotInspect', 'rules']) if (key in nextOptions) options[key] = nextOptions[key];
        if ('resourceReceipt' in nextOptions && identity === sceneIdentity() && !worldScopeChanged) acceptResourceReceipt(nextOptions.resourceReceipt);
        if ('activityReceipt' in nextOptions) {
          options.activityReceipt = nextOptions.activityReceipt;
          if (identity === sceneIdentity() && !worldScopeChanged) acceptActivity(nextOptions.activityReceipt);
        }
        if ('externalPanel' in nextOptions) {
          const wasExternal = externalPanel;
          externalPanel = nextOptions.externalPanel === true;
          syncExternalPanel();
          if (externalPanel && !wasExternal) closePanels();
        }
        region = REGIONS[district.id] || REGIONS.docks;
        walkBottom = district.id === 'docks' || !REGIONS[district.id] ? 540 : WORLD.height - 20;
        if ('worldHomes' in nextOptions && nextOptions.worldHomes === null) { homeBoard = null; homes = []; homeSlots.clear(); permeableHomes.clear(); }
        if (!worldUI) acceptHomes(options.worldHomes);
        updateGeometry();
        updateLabels();
        updateHud();
        if (selected) { renderActions(selected); renderQuest(selected); }
        renderPresence(); renderActorDock(); renderGameDock();
        worldUI?.update(worldOptions()); syncExternalPanel(); fitWorldFrame();
      },
      destroy: function () {
        if (destroyed) return;
        clearActivities();
        if (gameKind === 'crew') options.retireCrew?.();
        reportPosition(true);
        destroyed = true; ready = false;
        if (bootTimer) { clearTimeout(bootTimer); bootTimer = null; }
        if (resizeObserver) resizeObserver.disconnect();
        if (hudObserver) hudObserver.disconnect();
        worldUI?.destroy(); worldUI = null;
        document.getElementById('player-view-switch')?.classList.remove('has-world-tools');
        listeners.forEach(remove => remove());
        clearPlayerNameClamp = null;
        keys.clear(); heldMoves.clear(); path = []; selected = null; pendingVenue = null; pendingActor = null; pendingHome = null; pendingExit = null; queuedHome = null;
        selectedActor = null; actorOpening++; actorBody.replaceChildren(); options.intel = []; options.objectives = []; options.actors = [];
        gameKind = ''; gameOpening++; gameBody.replaceChildren();
        options.encounterReceipt = null; options.encounterRecovery = false;
        actorSprites.clear();
        homeMarkers.clear(); exitLabels.clear(); homeSlots.clear(); permeableHomes.clear(); homes = []; homeBoard = null;
        if (game) { game.destroy(true); game = null; }
        player = null; scene = null;
        root.remove();
      },
      getState: sceneState,
      walkToVenue,
      recenter: centerPlayer,
      cancelNavigation: stopMovement,
      closePanels,
      walkHome,
      showWorldMap: districtId => openWorldMap(districtId, false)
    };
  }

  window.OmertaCityScene = { mount };
})();
