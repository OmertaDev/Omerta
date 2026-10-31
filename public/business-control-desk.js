/* A desk for canonical game-cash trading, production, delivery and sales. */
(function () {
  'use strict';
  const READS = {
    me: ['/v1/me', 'Character'], desk: ['/v1/company/desk', 'Cash movements'],
    inventory: ['/v1/worldgraph/inventory', 'Inventory'], recipes: ['/v1/worldgraph/recipes', 'Crafting requirements'],
    market: ['/v1/market', 'Vehicle market'], depot: ['/v1/depot', 'Your depot'], depots: ['/v1/depots', 'Depot availability'],
    company: ['/v1/resources/company', 'Company profile'], operators: ['/v1/company/operator', 'Operators'],
    production: ['/v1/company/production', 'Production'], courier: ['/v1/company/courier-networks', 'Couriers'],
    consignments: ['/v1/consignments', 'Consignments'],
  };
  const DISTRICTS = [['docks', 'The Docks'], ['neon', 'The Neon Mile'], ['foundry', 'Old Foundry'], ['brick', 'Brick Yards'], ['canal', 'Canal Row'], ['cathedral', 'Cathedral Hill']];
  const list = value => Array.isArray(value) ? value : [];
  const escape = value => String(value == null ? '' : value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = value => String(value || '').replace(/^[^:]+:/, '').replace(/[_-]+/g, ' ');
  const title = value => value?.title || value?.name || words(value?.templateId || value?.id || 'Item');
  const districtName = id => DISTRICTS.find(([key]) => key === id)?.[1] || words(id);
  const actorOf = value => value?.character || value?.player?.character || value?.player || value;
  const actorKey = value => value?.id ? String(value.id) + ':' + String(value.generation ?? '') : '';
  const decimal = value => typeof value === 'string' && /^-?[0-9]+(?:\.[0-9]+)?$/.test(value);
  function money(value) {
    const text = String(value ?? '');
    if (!decimal(text)) return 'Unavailable';
    const negative = text.startsWith('-'), [whole, fraction] = (negative ? text.slice(1) : text).split('.');
    return (negative ? '−' : '') + '$' + whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',') + (fraction ? '.' + fraction : '');
  }
  const hasCash = (value, required) => decimal(String(value ?? '')) && !String(value).startsWith('-')
    && Number.isSafeInteger(required) && BigInt(String(value).split('.')[0]) >= BigInt(required);
  function blockerText(value) {
    if (typeof value === 'string') return words(value);
    if (!value || typeof value !== 'object') return 'A server requirement is not met.';
    if (value.message) return value.message;
    const code = value.code || value.adapter;
    if (code === 'location') return 'Visit ' + districtName(value.required || value.district) + '.';
    if (code === 'level') return 'Requires level ' + (value.required ?? '') + '.';
    if (code === 'skill') return 'Requires ' + words(value.required || value.skillId) + '.';
    if (code === 'cash') return 'Requires ' + money(value.required) + ' game cash.';
    if (code === 'material_quantity') return 'Needs ' + value.required + ' ' + words(value.templateId) + '; ' + (value.current ?? 0) + ' held.';
    return words(code || 'A server requirement is not met') + (value.required ? ': ' + words(value.required) : '') + '.';
  }
  const reasons = values => list(values).length ? '<ul class="business-requirements">' + [...new Set(values.map(v => typeof v === 'string' ? v : blockerText(v)))].map(v => '<li>' + escape(v) + '</li>').join('') + '</ul>' : '';
  const empty = text => '<p class="business-empty">' + escape(text) + '</p>';
  const hidden = (name, value) => '<input type="hidden" name="' + name + '" value="' + escape(value) + '">';
  const stamp = text => '<span class="business-stamp">' + escape(words(text)) + '</span>';
  function field(name, label, value = '', terms = {}, scope = '') {
    const id = 'business-' + (scope ? scope + '-' : '') + name;
    return '<label for="' + id + '">' + escape(label) + '<input id="' + id + '" name="' + name + '" type="' + (terms.type || 'text') + '" value="' + escape(value) + '"'
      + (terms.required === false ? '' : ' required') + (terms.min !== undefined ? ' min="' + terms.min + '"' : '')
      + (terms.max !== undefined && terms.type === 'number' ? ' max="' + terms.max + '"' : '') + (terms.type === 'number' ? ' step="1" inputmode="numeric"' : ' maxlength="' + (terms.max ?? 128) + '" autocomplete="off"') + '></label>';
  }
  function select(name, label, choices, selected, scope = '') {
    const id = 'business-' + (scope ? scope + '-' : '') + name;
    return '<label for="' + id + '">' + escape(label) + '<select id="' + id + '" name="' + name + '">' + choices.map(([value, text]) => '<option value="' + escape(value) + '"' + (value === selected ? ' selected' : '') + '>' + escape(text) + '</option>').join('') + '</select></label>';
  }
  const consent = text => '<label class="business-consent"><input type="checkbox" name="consent" value="true" required><span>' + escape(text) + '</span></label>';
  const materials = (values, label) => list(values).length ? '<p class="business-materials"><b>' + label + '</b> ' + values.map(v => escape(String(v.quantity ?? v.qty ?? 1) + ' × ' + title(v))).join(', ') + '</p>' : '';

  function mount(host, initialOptions) {
    let options = { ...initialOptions }, destroyed = false, loading = false, busy = false, epoch = 0, readVersion = 0;
    let identity = options.identity, characterKey = actorKey(options.character), session = null, sessionUnavailable = false;
    let notice = '', noticeBad = false, retry = null;
    const boards = {}, errors = {}, drafts = new Map(), issuedSalvage = new Map();
    const root = document.createElement('section');
    root.className = 'business-desk'; root.setAttribute('aria-label', 'Business control desk'); host.replaceChildren(root);
    const active = () => !destroyed && host.isConnected && (!options.isActive || options.isActive());
    const current = token => !destroyed && token === epoch;
    const character = () => actorOf(boards.me) || options.character || {};
    const ready = (...keys) => !!session && !sessionUnavailable && keys.every(key => !!boards[key] && !errors[key]);
    const locked = (...keys) => busy || loading || !!retry || !ready(...keys);
    const button = (action, label, disabled = false) => '<button type="submit" data-business-action="' + action + '"' + (disabled || busy || loading || retry || sessionUnavailable ? ' disabled' : '') + '>' + escape(label) + '</button>';
    const form = (key, contents, id = '') => '<form data-business-form="' + escape(key) + '"' + (id ? ' data-business-id="' + escape(id) + '"' : '') + '>' + contents + '</form>';
    const card = (id, contents) => '<article class="business-card" data-business-id="' + escape(id) + '">' + contents + '</article>';
    const missing = keys => keys.filter(key => !ready(key)).map(key => READS[key][1] + (errors[key] ? ' unavailable. Refresh to retry.' : ' has not loaded.'));
    const draft = (key, name, fallback) => drafts.get(key)?.[name] ?? fallback;
    const availableItems = () => list(boards.inventory?.items).filter(item => item.templateId === 'item:precision_lock_tool' && item.state === 'active' && !item.escrowed);
    const liveCourier = itemId => list(boards.courier?.networks).some(row => row.itemId === itemId && ['offered', 'ready', 'first_leg', 'second_leg'].includes(row.status) && Date.parse(row.expiresAt) > Date.now());
    const offeredSale = itemId => list(boards.consignments?.rows).some(row => row.itemId === itemId && ['offered', 'active'].includes(row.status));

    function captureDrafts() {
      root.querySelectorAll('form[data-business-form]').forEach(element => {
        const values = {};
        for (const input of element.elements) {
          if (!input.name || ['hidden', 'submit', 'checkbox'].includes(input.type)) continue;
          values[input.name] = input.value;
        }
        drafts.set(element.dataset.businessForm + ':' + (element.dataset.businessId || ''), values);
      });
    }
    function restoreDrafts() {
      root.querySelectorAll('form[data-business-form]').forEach(element => {
        const values = drafts.get(element.dataset.businessForm + ':' + (element.dataset.businessId || ''));
        if (!values) return;
        for (const input of element.elements) {
          if (!input.name || ['hidden', 'submit', 'checkbox'].includes(input.type) || values[input.name] === undefined) continue;
          if (input.tagName !== 'SELECT' || [...input.options].some(option => option.value === values[input.name])) input.value = values[input.name];
        }
      });
    }

    function cashView() {
      const board = boards.desk, flow = board?.cashflow;
      if (!board || errors.desk) return '<section class="business-summary" aria-label="Game cash">' + empty(errors.desk || 'Loading exact game-cash balances…') + '</section>';
      return '<section class="business-summary" aria-label="Game cash"><div><span>Cash on hand</span><strong>' + escape(money(board.character.cash)) + '</strong></div><div><span>Bank</span><strong>' + escape(money(board.character.bank)) + '</strong></div><div><span>Location</span><strong class="business-place">' + escape(districtName(character().loc)) + '</strong></div></section>'
        + '<details class="business-ledger"><summary>Cash movement · ' + list(flow?.rows).length + ' returned rows</summary><p>Selected movements for this character only. Incoming ' + escape(money(flow?.income)) + ' · outgoing ' + escape(money(flow?.outflow)) + ' · net movement ' + escape(money(flow?.netCashflow)) + '.</p><p>These rows include escrow, refunds and depot treasury transfers. Totals cover only this returned page; they are not accounting profit or a reconciliation of your balance.' + (flow?.hasMore ? ' More rows exist.' : '') + '</p>'
        + (list(flow?.rows).length ? '<ul class="business-movements">' + flow.rows.map(row => '<li><time datetime="' + escape(row.at) + '">' + escape(new Date(row.at).toLocaleString()) + '</time><span>' + escape(row.reason) + '</span><b>' + escape(money(row.amount)) + '</b></li>').join('') + '</ul>' : empty('No selected cash movements on this page.')) + '</details>';
    }

    function setupView() {
      const company = boards.company?.company, depot = boards.depot?.depot;
      const operator = list(boards.operators?.operators).find(row => row.depot_id === depot?.id);
      const companyForm = form('company', hidden('expectedRevision', company?.revision ?? 0)
        + field('name', 'Company name', company?.name || '', { max: 64 }, 'company')
        + select('premises', 'Premises claim', [['', 'No premises claim'], ['estate', 'Owned estate'], ['street', 'Owned street']], company?.premises?.kind || '', 'company')
        + '<label class="business-consent"><input type="checkbox" name="published"' + (company?.published ? ' checked' : '') + '><span>Publish this company profile</span></label>'
        + '<p class="business-help">Requires the separate owner session. Premises claims are checked by the server.</p>' + button('save-company', company ? 'Save company profile' : 'Create company profile', locked('company')));
      const depotForm = form('depot', '<p>Opening at your current district costs ' + escape(money(boards.depots?.catalog?.openingCost ?? 5000)) + ' game cash.</p><div class="business-fields">'
        + field('salePrice', 'Sale price', 180, { type: 'number', min: 50, max: 1000000 }, 'depot')
        + field('bidPrice', 'Procurement bid', 100, { type: 'number', min: 50, max: 1000000 }, 'depot')
        + field('targetStock', 'Target stock', 10, { type: 'number', min: 1, max: 40 }, 'depot')
        + field('reorderAt', 'Reorder below', 3, { type: 'number', min: 0, max: 39 }, 'depot')
        + field('restockBudget', 'Restock budget', 1000, { type: 'number', min: 50, max: 100000000 }, 'depot') + '</div>'
        + reasons(!ready('depots') ? missing(['depots']) : boards.depots.enabled !== true ? ['Depot opening is currently closed by the server.'] : !hasCash(character().cash, boards.depots.catalog?.openingCost ?? 5000) ? ['Not enough game cash to open a depot.'] : [])
        + button('open-depot', 'Pay game cash & open depot', locked('depot', 'depots', 'me') || boards.depots?.enabled !== true || !hasCash(character().cash, boards.depots?.catalog?.openingCost ?? 5000)));
      return '<details class="business-setup"' + (ready('company', 'depot') && (!company || !depot) ? ' open' : '') + '><summary>Business setup' + (company && depot ? ' · company and depot recorded' : ' · production prerequisites') + '</summary><div class="business-grid">'
        + '<div class="business-card"><h3>' + escape(company?.name || 'Company profile') + '</h3>' + (company ? '<p>Revision ' + escape(company.revision) + ' · ' + (company.published ? 'published' : 'private') + '</p>' : '<p>Create the account company profile required for company production.</p>') + reasons(missing(['company'])) + companyForm + '</div>'
        + '<div class="business-card"><h3>Your depot</h3>' + (depot ? '<p>' + escape(districtName(depot.district)) + ' · stock ' + escape(depot.stock) + ' · treasury ' + escape(money(depot.treasury)) + ' game cash</p><p class="business-help">Operator: ' + (!ready('operators') ? 'record unavailable' : operator?.enabled ? 'enabled' : 'not enabled') + '. Delegated and production permissions remain server controlled.</p>' : reasons(missing(['depot'])) + depotForm) + '</div></div></details>';
    }

    function marketView() {
      const listings = list(boards.market?.listings).filter(row => row.kind === 'car' && row.car);
      return '<section id="business-supply" class="business-section"><div class="business-heading"><span>01 / 06</span><h2>Buy materials · reinvest</h2></div><p>Buy an ordinary junker, then use the issued salvage action below. Buy your next vehicle here after a sale. Every purchase spends game cash at the shown buy-now price.</p>'
        + reasons(missing(['market', 'me'])) + '<div class="business-grid">' + (listings.map(row => {
          const own = [character().id, session?.accountId].includes(row.sellerId), expired = Date.parse(row.expiresAt) <= Date.now();
          const allowed = !!row.buyNow && !own && !expired && hasCash(character().cash, Number(row.buyNow));
          return card(row.id, '<header><h3>' + escape(row.car.model || 'Vehicle') + (row.car.trim ? ' · ' + escape(row.car.trim) : '') + '</h3>' + stamp('buy now') + '</header><p class="business-price">' + escape(money(row.buyNow)) + ' <small>game cash</small></p><p>Damage ' + escape(row.car.dmg ?? 'unknown') + ' · seller ' + escape(row.seller || 'undisclosed') + '</p>'
            + reasons(own ? ['This is your listing.'] : expired ? ['This listing has expired.'] : !row.buyNow ? ['No buy-now price is available.'] : !allowed ? ['Not enough cash on hand.'] : [])
            + form('market', hidden('listingId', row.id) + '<div class="business-actions">' + button('buy-input', 'Buy for materials', locked('market', 'me') || !allowed) + button('reinvest', 'Buy next vehicle', locked('market', 'me') || !allowed) + '</div>', row.id));
        }).join('') || empty('No car listings are returned. Refresh to check the market again.')) + '</div></section>';
    }

    function salvageAction(action) {
      if (!action || action.method !== 'POST' || typeof action.available !== 'boolean' || typeof action.path !== 'string') return null;
      const match = /^\/v1\/worldgraph\/recipes\/([^/?#]+)\/salvage\/([^/?#]+)$/.exec(action.path), body = action.body ?? {};
      if (!match || !body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).length) return null;
      try {
        const id = decodeURIComponent(match[2]);
        if (decodeURIComponent(match[1]) !== 'recipe:car_salvage_basic' || /[/?#]/.test(id) || !list(character().cars).some(car => car.id === id)) return null;
        return { id, action: { ...action, body: { ...body } } };
      } catch { return null; }
    }
    function salvageView() {
      const recipe = list(boards.recipes?.recipes).find(row => row.id === 'recipe:car_salvage_basic');
      const actions = list(recipe?.actions).map(salvageAction).filter(Boolean); issuedSalvage.clear();
      return '<section class="business-section"><div class="business-heading"><span>02 / 06</span><h2>Salvage the vehicle</h2></div><p>Salvage permanently consumes the exact vehicle. Only choices issued for your current garage appear here.</p>' + reasons(missing(['recipes', 'me']))
        + (recipe ? materials(recipe.outputs, 'Produces') + reasons(recipe.blockedBy) : '') + '<div class="business-grid">' + (actions.map(({ id, action }) => {
          issuedSalvage.set(id, action); const car = list(character().cars).find(row => row.id === id);
          return card(id, '<h3>' + escape(car?.model || 'Vehicle') + '</h3><p class="business-id">' + escape(id) + '</p>' + reasons(action.blockedBy)
            + form('salvage', hidden('carId', id) + '<p class="business-help">This consumes this vehicle and the recipe’s listed costs.</p>' + button('salvage', 'Consume vehicle & salvage', locked('recipes', 'me') || !action.available), id));
        }).join('') || empty('No eligible salvage vehicle has been issued. Buy a suitable junker and visit Old Foundry; listed, pledged or otherwise committed vehicles may be ineligible.')) + '</div></section>';
    }

    function productionSelection() {
      const recipes = list(boards.production?.recipes), choices = new Set(recipes.map(row => row.id));
      const first = draft('production:', 'recipeId', choices.has('recipe:hardened_steel') ? 'recipe:hardened_steel' : recipes[0]?.id || '');
      const second = draft('production:', 'secondRecipeId', choices.has('recipe:precision_lock_tool') ? 'recipe:precision_lock_tool' : '');
      return [first, second].filter(Boolean);
    }
    function productionReasons(ids) {
      const result = missing(['production', 'recipes', 'inventory', 'company', 'depot', 'me']);
      if (result.length) return result;
      if (!boards.company.company) result.push('Create a company profile first.');
      if (!boards.depot.depot) result.push('An open depot owned by this character is required.');
      if (!ids.length) result.push('Choose an issued production recipe.');
      const stock = new Map(list(boards.inventory.stacks).map(row => [row.templateId + ':' + (row.quality || 'standard'), Number(row.qty ?? row.quantity)]));
      let cost = 0;
      for (const id of ids) {
        const recipe = list(boards.production.recipes).find(row => row.id === id), issued = list(boards.recipes.recipes).find(row => row.id === id);
        if (!recipe || !issued) { result.push('This recipe is not currently issued.'); continue; }
        const other = list(issued.blockedBy).filter(row => !['cash', 'material_quantity'].includes(row.adapter || row.code));
        result.push(...other.map(blockerText));
        if (issued.available === false && !list(issued.blockedBy).length) result.push(title(issued) + ' is unavailable.');
        for (const input of list(recipe.inputs)) {
          const key = input.templateId + ':' + (input.quality || 'standard'), quantity = Number(input.quantity ?? input.qty);
          if (!Number.isSafeInteger(quantity) || (stock.get(key) || 0) < quantity) result.push('Needs ' + quantity + ' ' + title(input) + ' for ' + title(recipe) + '.');
          stock.set(key, (stock.get(key) || 0) - quantity);
        }
        for (const output of list(recipe.outputs)) {
          const key = output.templateId + ':' + (output.quality || 'standard'); stock.set(key, (stock.get(key) || 0) + Number(output.quantity ?? output.qty ?? 1));
        }
        cost += Number(recipe.cashCost || 0);
      }
      if (!hasCash(character().cash, cost)) result.push('Requires ' + money(cost) + ' game cash for this batch.');
      return [...new Set(result)];
    }
    function productionView() {
      const recipes = list(boards.production?.recipes), selected = productionSelection(), blocked = productionReasons(selected);
      const choices = recipes.map(recipe => [recipe.id, title(recipe)]);
      return '<section id="business-production" class="business-section"><div class="business-heading"><span>03 / 06</span><h2>Make the next product</h2></div><p>Run one craft of each chosen recipe in order. Earlier outputs can supply the next step. New tools stay in account custody.</p>'
        + form('production', hidden('businessId', boards.depot?.depot?.id || '') + '<div class="business-fields">' + select('recipeId', 'First recipe', choices.length ? choices : [['', 'No recipes loaded']], selected[0] || '')
          + select('secondRecipeId', 'Then make (optional)', [['', 'No second step'], ...choices], selected[1] || '') + '</div>'
          + selected.map((id, index) => { const recipe = recipes.find(row => row.id === id); return recipe ? '<div class="business-recipe"><h3>' + (index + 1) + '. ' + escape(title(recipe)) + '</h3>' + materials(recipe.inputs, 'Consumes') + materials(recipe.outputs, 'Creates') + '<p>Game-cash cost: ' + escape(money(recipe.cashCost ?? 0)) + '</p></div>' : ''; }).join('')
          + reasons(blocked) + button('produce', 'Run production batch', blocked.length > 0 || locked('production', 'recipes', 'inventory', 'company', 'depot', 'me')))
        + '<details class="business-receipts"><summary>Production receipts · returned page (' + list(boards.production?.receipts).length + ')</summary><p>This is a bounded page of recorded runs, ordered by request key.</p>'
        + (list(boards.production?.receipts).map(row => '<p><b>' + escape(row.receipt?.totalCrafts ?? 'Unknown') + ' crafts</b> · ' + escape(money(row.receipt?.totalCashCost)) + ' game cash · <span class="business-id">' + escape(row.receipt?.runId || row.requestKey) + '</span></p>').join('') || empty('No production receipts are returned.'))
        + (boards.production?.nextCursor ? '<p>More receipt pages exist.</p>' : '') + '</details></section>';
    }

    function referenceForm(kind, row, action, label, explanation, disabled = false) {
      const network = kind === 'courier', id = network ? row.networkId : row.consignmentId;
      return form(kind + '-' + action, hidden(network ? 'networkId' : 'consignmentId', id) + hidden('sourceHash', row.sourceHash)
        + consent(explanation) + button(action, label, disabled), id);
    }
    function courierView() {
      const items = availableItems().filter(item => !liveCourier(item.id) && !offeredSale(item.id)), location = character().loc;
      const selectedOrigin = DISTRICTS.some(([id]) => id === location) ? location : 'foundry';
      const publish = form('courier', '<div class="business-fields">' + select('itemId', 'Exact account-owned tool', items.length ? items.map(item => [item.id, title(item) + ' · ' + item.id]) : [['', 'No available account-owned tool']], items[0]?.id, 'courier')
        + field('firstCarrier', 'First courier account ID', '', {}, 'courier') + field('secondCarrier', 'Second courier account ID', '', {}, 'courier')
        + select('origin', 'Origin', DISTRICTS, selectedOrigin, 'courier') + select('handoff', 'Handoff', DISTRICTS, selectedOrigin === 'docks' ? 'foundry' : 'docks', 'courier') + select('destination', 'Destination', DISTRICTS, 'neon', 'courier')
        + field('firstFee', 'First courier fee · game cash', 30, { type: 'number', min: 1, max: 1000 }, 'courier') + field('secondFee', 'Second courier fee · game cash', 40, { type: 'number', min: 1, max: 1000 }, 'courier')
        + field('expiresInSeconds', 'Expires in seconds', 3600, { type: 'number', min: 60, max: 3600 }, 'courier') + '</div>'
        + '<p class="business-help">Choose three different districts and two different courier accounts, separate from your own. Publishing does not accept for either courier. Dispatch reserves both fees.</p>'
        + consent('I offer this exact tool and these fees. Each courier must accept separately.') + reasons(missing(['inventory', 'courier', 'consignments', 'me']))
        + (!items.length ? empty('No uncommitted account-owned precision tool is available. Finish production or delivery, or release an existing offer first.') : '')
        + button('publish-courier', 'Offer two-leg delivery', locked('inventory', 'courier', 'consignments', 'me') || !items.length));
      const networks = list(boards.courier?.networks).map(row => {
        const owner = row.ownerOriginal === character().id, first = row.firstOriginal === character().id, second = row.secondOriginal === character().id;
        const expired = Date.parse(row.expiresAt) <= Date.now(), disabled = locked('courier', 'me') || expired;
        let controls = '', explanation = '';
        if (row.status === 'offered') {
          explanation = 'First courier: ' + (row.firstConsent ? 'accepted' : 'awaiting consent') + '. Second courier: ' + (row.secondConsent ? 'accepted' : 'awaiting consent') + '.';
          if ((first && !row.firstConsent) || (second && !row.secondConsent)) controls += referenceForm('courier', row, 'consent-courier', 'Accept my courier role', 'I accept my own courier role and the shown route, fee and deadline.', disabled);
        }
        if (row.status === 'ready') {
          explanation = 'Both couriers accepted. Owner and first courier must be at ' + districtName(row.origin) + ' to dispatch. Fees reserved: ' + money(Number(row.firstFee) + Number(row.secondFee)) + ' game cash.';
          if (owner) controls += referenceForm('courier', row, 'dispatch-courier', 'Dispatch exact tool', 'I commit this tool to delivery and reserve both courier fees.', disabled || location !== row.origin);
        }
        if (row.status === 'first_leg') {
          explanation = 'First courier takes the recorded trip to ' + districtName(row.handoff) + ' and hands the tool to the second courier there. The owner must travel separately to ' + districtName(row.destination) + '.';
          if (first) controls += referenceForm('courier', row, 'travel-courier', 'Travel first courier leg', 'I take my recorded courier trip and pay its ordinary game-cash travel cost.', disabled || location !== row.origin)
            + referenceForm('courier', row, 'handoff-courier', 'Hand tool to second courier', 'I hand off this exact tool to the second courier at the handoff district.', disabled || location !== row.handoff);
        }
        if (row.status === 'second_leg') {
          explanation = 'Second courier travels to ' + districtName(row.destination) + '. The owner must also be there before the second courier records arrival.';
          if (second) controls += referenceForm('courier', row, 'travel-courier', 'Travel second courier leg', 'I take my recorded courier trip and pay its ordinary game-cash travel cost.', disabled || location !== row.handoff)
            + referenceForm('courier', row, 'arrive-courier', 'Deliver tool to owner', 'I record delivery of this exact tool to its original owner at the destination.', disabled || location !== row.destination);
        }
        if (row.status === 'completed') explanation = 'Delivery completed. The same tool has returned to its original account custody; it can now be offered for consignment.';
        if (owner && ['offered', 'ready', 'first_leg', 'second_leg'].includes(row.status)) controls += referenceForm('courier', row, 'cancel-courier', 'Cancel delivery', 'I cancel this delivery under its current game rules; only unearned reserved fees are returned.', locked('courier', 'me'));
        return card(row.networkId, '<header><h3>' + escape(districtName(row.origin)) + ' → ' + escape(districtName(row.handoff)) + ' → ' + escape(districtName(row.destination)) + '</h3>' + stamp(row.status) + '</header><p>Your role: ' + (owner ? 'owner' : first ? 'first courier' : second ? 'second courier' : 'unavailable') + ' · tool <span class="business-id">' + escape(row.itemId) + '</span></p><p>Courier fees: ' + escape(money(row.firstFee)) + ' + ' + escape(money(row.secondFee)) + ' game cash. Deadline: ' + escape(new Date(row.expiresAt).toLocaleString()) + '.</p><p>' + escape(explanation) + '</p>' + (expired && ['offered', 'ready', 'first_leg', 'second_leg'].includes(row.status) ? reasons(['The delivery deadline has passed. The server determines cancellation and recovery.']) : '') + controls);
      }).join('');
      return '<section id="business-delivery" class="business-section"><div class="business-heading"><span>04 / 06</span><h2>Move the exact tool</h2></div><p>Two couriers, two recorded legs, one item ID. Each actor uses their own session and consents to their own role.</p><details class="business-offer"' + (items.length ? ' open' : '') + '><summary>Offer a new courier delivery</summary>' + publish + '</details><div class="business-grid">' + (networks || empty('No courier networks are returned for your account.')) + '</div>'
        + '<div class="business-travel"><h3>Your own travel</h3><p>You are at ' + escape(districtName(location)) + '. Owners travel separately; this does not complete either courier’s recorded leg. The server determines the ordinary game-cash travel cost.</p>'
        + form('travel', select('district', 'Travel to district', DISTRICTS, location === 'neon' ? 'foundry' : 'neon') + button('travel', 'Travel to district', locked('me'))) + '</div></section>';
    }

    function consignmentView() {
      const items = availableItems().filter(item => !liveCourier(item.id) && !offeredSale(item.id));
      const offer = form('consignment', '<div class="business-fields">' + select('itemId', 'Exact account-owned tool', items.length ? items.map(item => [item.id, title(item) + ' · ' + item.id]) : [['', 'No available account-owned tool']], items[0]?.id, 'sale')
        + field('hostAccountId', 'Consignment host account ID', '', {}, 'sale') + field('price', 'Buyer price · game cash', 10000, { type: 'number', min: 1, max: 1000000 }, 'sale')
        + field('hostFeeBps', 'Host commission · basis points (100 = 1%)', 1000, { type: 'number', min: 0, max: 2000 }, 'sale')
        + field('lifetimeSeconds', 'Offer lifetime · seconds', 86400, { type: 'number', min: 60, max: 86400 }, 'sale') + '</div>'
        + '<p class="business-help">The distinct host must accept in their own session. A third account must pay the price at the host’s pickup district. Seller proceeds are price minus the host commission.</p>'
        + consent('I offer this exact item at this price, commission and deadline. The host must accept separately.') + reasons(missing(['inventory', 'courier', 'consignments', 'me']))
        + button('create-consignment', 'Offer tool for consignment', locked('inventory', 'courier', 'consignments', 'me') || !items.length));
      const rows = list(boards.consignments?.rows).map(row => {
        const owner = row.originalOwner === character().id, hostRole = row.originalHost === character().id;
        const expired = Date.parse(row.expiresAt) <= Date.now(), closed = !['offered', 'active'].includes(row.status);
        let controls = '', explanation = '';
        if (row.status === 'offered') explanation = owner ? 'Waiting for the host’s own acceptance. The offer has not sold.' : hostRole ? 'You are the proposed host. Review the terms before accepting custody.' : 'Waiting for host acceptance.';
        if (row.status === 'active') explanation = 'Pickup: ' + districtName(row.pickupDistrict) + '. A distinct buyer must pay here; owner and host cannot buy their own consignment.';
        if (row.status === 'sold') explanation = 'Buyer-paid sale recorded. Refresh cash movements and buy the next vehicle above when funds are available.';
        if (hostRole && row.status === 'offered') controls += referenceForm('sale', row, 'accept-consignment', 'Accept as consignment host', 'I accept hosting this exact consignment at the shown commission and deadline.', locked('consignments', 'me') || expired);
        if (!owner && !hostRole && row.status === 'active') controls += referenceForm('sale', row, 'buy-consignment', 'Pay & buy consigned tool', 'I pay the shown game-cash price for this consignment in my own account.', locked('consignments', 'me') || !row.available || expired || character().loc !== row.pickupDistrict || !hasCash(character().cash, Number(row.price)));
        if ((owner || hostRole) && !closed) controls += referenceForm('sale', row, 'cancel-consignment', 'Cancel consignment', 'I cancel this offer or return the active consignment to its recorded original owner.', locked('consignments', 'me'));
        return card(row.consignmentId, '<header><h3>Consigned precision tool</h3>' + stamp(row.status) + '</header><p class="business-price">' + escape(money(row.price)) + ' <small>game cash</small></p><p>Host commission ' + escape(Number(row.hostFeeBps) / 100) + '% · deadline ' + escape(new Date(row.expiresAt).toLocaleString()) + '</p>'
          + (row.itemId ? '<p class="business-id">Tool: ' + escape(row.itemId) + '</p>' : '<p class="business-help">Item identity is private to the owner and host until purchase.</p>') + '<p>' + escape(explanation) + '</p>'
          + (!owner && !hostRole && row.available && character().loc !== row.pickupDistrict ? reasons(['Travel to ' + districtName(row.pickupDistrict) + ' before purchasing.']) : '') + controls);
      }).join('');
      return '<section id="business-sales" class="business-section"><div class="business-heading"><span>05 / 06</span><h2>Make a buyer-paid sale</h2></div><details class="business-offer"' + (items.length ? ' open' : '') + '><summary>Offer a new consignment</summary>' + offer + '</details><div class="business-grid">' + (rows || empty('No consignment rows are returned.')) + '</div><p class="business-help">This is a bounded consignment page.' + (boards.consignments?.next ? ' More rows exist.' : '') + '</p></section>';
    }

    function inventoryView() {
      return '<section class="business-section"><div class="business-heading"><span>06 / 06</span><h2>Check custody · repeat</h2></div><p>Sale proceeds become game cash. Use “Buy next vehicle” above to start another cycle.</p>' + reasons(missing(['inventory']))
        + '<div class="business-inventory">' + (list(boards.inventory?.stacks).map(row => '<p><b>' + escape(row.qty ?? row.quantity) + ' × ' + escape(title(row)) + '</b> <span>' + escape(words(row.quality || 'standard')) + '</span></p>').join('') || empty('No material stacks are returned.')) + '</div>'
        + list(boards.inventory?.items).map(row => '<p><b>' + escape(title(row)) + '</b> · ' + escape(words(row.state)) + (row.escrowed ? ' · committed to work' : '') + ' · <span class="business-id">' + escape(row.id) + '</span></p>').join('')
        + (list(boards.inventory?.currentCharacterItems).length ? '<p class="business-help">This character also carries ' + list(boards.inventory.currentCharacterItems).length + ' assigned items. Courier and consignment controls use available account-owned tools.</p>' : '') + '</section>';
    }

    function draw() {
      if (destroyed) return;
      captureDrafts();
      const failed = Object.keys(errors).filter(key => errors[key]);
      root.innerHTML = '<header class="business-mast"><div><span>Game-cash business</span><h1>Business control desk</h1><p>Buy → salvage → produce → deliver → sell → reinvest.</p></div><button type="button" data-business-refresh' + (busy || loading ? ' disabled' : '') + '>' + (loading ? 'Updating records…' : 'Refresh records') + '</button></header>'
        + '<nav class="business-nav" aria-label="Business desk sections">' + [['supply', 'Supply & reinvest'], ['production', 'Production'], ['delivery', 'Delivery & travel'], ['sales', 'Sales']].map(([id, label]) => '<button type="button" data-business-section="' + id + '">' + label + '</button>').join('') + '</nav>'
        + (notice ? '<div class="business-notice' + (noticeBad ? ' business-notice--error' : '') + '" role="' + (noticeBad ? 'alert' : 'status') + '"><p>' + escape(notice) + '</p>' + (retry ? '<p>Other changes are locked until this exact request has a confirmed result. Refreshing records does not resolve an unknown result.</p><button type="button" data-business-retry' + (busy || loading || sessionUnavailable ? ' disabled' : '') + '>Retry the same request</button>' : '') + '</div>' : '')
        + (failed.length ? '<div class="business-partial" role="status"><b>Some records could not load.</b> ' + escape(failed.map(key => READS[key][1] + ': ' + errors[key]).join(' ')) + ' Dependent actions are locked. Refresh records to retry.</div>' : '')
        + '<div class="business-body" aria-busy="' + String(loading || busy) + '">' + (sessionUnavailable ? empty('Your current session could not be verified. Restore the session, then refresh records. No previous actor’s records are shown.')
          : !session ? empty('Checking your current session…') : cashView() + setupView() + marketView() + salvageView() + productionView() + courierView() + consignmentView() + inventoryView()) + '</div>';
      restoreDrafts();
    }

    function validBoard(key, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
      if (key === 'me') return actorOf(body)?.id === session?.character?.id;
      if (key === 'desk') return body.currency === 'game_cash' && body.character?.id === session?.character?.id && decimal(body.character.cash) && decimal(body.character.bank)
        && body.cashflow?.totalsScope === 'returned_rows' && ['income', 'outflow', 'netCashflow'].every(name => decimal(body.cashflow[name])) && Array.isArray(body.cashflow.rows);
      if (key === 'inventory') return Array.isArray(body.stacks) && Array.isArray(body.items);
      if (key === 'depot') return Object.hasOwn(body, 'depot') && (body.depot === null || typeof body.depot?.id === 'string');
      if (key === 'company') return Object.hasOwn(body, 'company') && (body.company === null || (typeof body.company?.name === 'string' && Number.isInteger(body.company?.revision)));
      if (key === 'depots') return typeof body.enabled === 'boolean' && !!body.catalog && Array.isArray(body.businesses);
      if (key === 'production') return Array.isArray(body.recipes) && Array.isArray(body.receipts);
      return Array.isArray(body[{ recipes: 'recipes', market: 'listings', operators: 'operators', courier: 'networks', consignments: 'rows' }[key]]);
    }
    const responseError = response => response?.body?.message || response?.body?.error || 'The record is unavailable.';
    function validSession(body) {
      if (!body?.authed || typeof body.accountId !== 'string' || !body.character?.id) return false;
      if (options.character?.id && body.character.id !== options.character.id) return false;
      return options.character?.generation === undefined || body.character.generation === options.character.generation;
    }
    function invalidate(message, changedActor = false) {
      epoch++; readVersion++; loading = busy = false; session = null; sessionUnavailable = true;
      if (changedActor) retry = null;
      drafts.clear(); issuedSalvage.clear();
      for (const key of Object.keys(boards)) delete boards[key];
      for (const key of Object.keys(errors)) delete errors[key];
      notice = message; noticeBad = true; root.replaceChildren(); draw();
    }
    async function load() {
      if (!active() || busy || loading) return;
      const token = epoch, version = ++readVersion, isCurrent = () => current(token) && version === readVersion;
      loading = true; draw();
      try {
        const response = await options.api('GET', '/v1/session', undefined, { beforeDispatch: isCurrent, isCurrent });
        if (!isCurrent()) return;
        if (response?.ignored || !(response?.code >= 200 && response.code < 300) || !validSession(response.body)) { invalidate('Session verification failed. Refresh after restoring your current character.', response?.code >= 200 && response.code < 300); return; }
        if ((session && (session.accountId !== response.body.accountId || actorKey(session.character) !== actorKey(response.body.character)))
          || (retry && (retry.accountId !== response.body.accountId || retry.character !== actorKey(response.body.character)))) { invalidate('Your session changed. Previous records and pending controls have been cleared.', true); return; }
        session = response.body; sessionUnavailable = false;
        const results = await Promise.allSettled(Object.entries(READS).map(async ([key, [path]]) => {
          const record = await options.api('GET', path, undefined, { beforeDispatch: isCurrent, isCurrent });
          if (!isCurrent()) return;
          if (record?.ignored || !(record?.code >= 200 && record.code < 300)) {
            if (record?.code === 401 || ['no_character', 'token_revoked'].includes(record?.body?.error)) { invalidate('Your session needs to be restored before business can continue.'); return; }
            errors[key] = responseError(record); return;
          }
          if ((key === 'me' && actorOf(record.body)?.id && actorOf(record.body).id !== session.character.id)
            || (key === 'desk' && record.body?.character?.id && record.body.character.id !== session.character.id)) { invalidate('Your character changed while records were loading. Previous records have been cleared.', true); return; }
          if (!validBoard(key, record.body)) { errors[key] = 'The returned record is incomplete or belongs to another character.'; return; }
          boards[key] = record.body; delete errors[key];
        }));
        if (!isCurrent()) return;
        results.forEach((result, index) => { if (result.status === 'rejected') errors[Object.keys(READS)[index]] = 'The response could not be read. Refresh to retry.'; });
      } catch {
        if (isCurrent()) invalidate('Session verification is unavailable. Refresh to try again.');
      } finally {
        if (isCurrent()) { loading = false; draw(); }
      }
    }

    function describeAction(element, action) {
      const data = new FormData(element), get = name => String(data.get(name) ?? ''), number = name => Number(get(name));
      const accepted = () => { if (data.get('consent') !== 'true') throw new Error('Read the terms and explicitly consent before continuing.'); };
      const result = (path, body, label, keys) => { if (!ready(...keys)) throw new Error('Refresh the required records before acting.'); return { path, body, label }; };
      if (['buy-input', 'reinvest'].includes(action)) {
        const row = list(boards.market?.listings).find(row => row.id === get('listingId') && row.kind === 'car' && row.car);
        if (!row?.buyNow || [character().id, session.accountId].includes(row.sellerId) || Date.parse(row.expiresAt) <= Date.now()) throw new Error('This buy-now listing is not available.');
        return result('/v1/market/' + encodeURIComponent(row.id) + '/buy', {}, action === 'reinvest' ? 'Buy next vehicle' : 'Buy vehicle for materials', ['market', 'me']);
      }
      if (action === 'salvage') {
        const issued = issuedSalvage.get(get('carId')), checked = salvageAction(issued);
        if (!checked || !issued.available) throw new Error('This salvage choice is not currently issued and available.');
        return result(issued.path, { ...issued.body }, 'Salvage exact vehicle', ['recipes', 'me']);
      }
      if (action === 'produce') {
        const ids = [get('recipeId'), get('secondRecipeId')].filter(Boolean), blocked = productionReasons(ids);
        if (blocked.length || get('businessId') !== boards.depot?.depot?.id) throw new Error(blocked[0] || 'Your depot changed. Refresh before production.');
        return result('/v1/company/production/run', { businessId: get('businessId'), steps: ids.map(recipeId => ({ recipeId, repeat: 1 })) }, 'Run production batch', ['production', 'recipes', 'inventory', 'company', 'depot', 'me']);
      }
      if (action === 'travel') {
        if (!DISTRICTS.some(([id]) => id === get('district'))) throw new Error('Choose a known district.');
        return result('/v1/travel/' + encodeURIComponent(get('district')), {}, 'Travel to ' + districtName(get('district')), ['me']);
      }
      if (action === 'save-company') return result('/v1/resources/company', { expectedRevision: number('expectedRevision'), name: get('name').trim(), published: data.has('published'), premises: get('premises') || null }, 'Save company profile', ['company']);
      if (action === 'open-depot') {
        if (boards.depots?.enabled !== true || boards.depot?.depot) throw new Error('Depot opening is not available.');
        return result('/v1/depot', Object.fromEntries(['salePrice', 'bidPrice', 'targetStock', 'reorderAt', 'restockBudget'].map(name => [name, number(name)])), 'Open depot with game cash', ['depot', 'depots', 'me']);
      }
      accepted();
      if (action === 'publish-courier') {
        if (!availableItems().some(item => item.id === get('itemId')) || liveCourier(get('itemId')) || offeredSale(get('itemId'))) throw new Error('Select an available account-owned tool.');
        if (new Set([get('origin'), get('handoff'), get('destination')]).size !== 3 || !['origin', 'handoff', 'destination'].every(name => DISTRICTS.some(([id]) => id === get(name)))) throw new Error('The route must use three different districts.');
        if (new Set([get('firstCarrier'), get('secondCarrier'), session.accountId]).size !== 3) throw new Error('Choose two distinct courier accounts, separate from your own.');
        return result('/v1/company/courier-networks/publish', { itemId: get('itemId'), firstCarrier: get('firstCarrier'), secondCarrier: get('secondCarrier'), origin: get('origin'), handoff: get('handoff'), destination: get('destination'), firstFee: number('firstFee'), secondFee: number('secondFee'), expiresInSeconds: number('expiresInSeconds'), consent: true }, 'Offer two-leg courier delivery', ['inventory', 'courier', 'consignments', 'me']);
      }
      if (['consent-courier', 'dispatch-courier', 'travel-courier', 'handoff-courier', 'arrive-courier', 'cancel-courier'].includes(action)) {
        const row = list(boards.courier?.networks).find(row => row.networkId === get('networkId') && row.sourceHash === get('sourceHash'));
        if (!row) throw new Error('This courier source changed. Refresh before acting.');
        return result('/v1/company/courier-networks/' + action.replace('-courier', ''), { networkId: row.networkId, sourceHash: row.sourceHash, consent: true }, words(action), ['courier', 'me']);
      }
      if (action === 'create-consignment') {
        if (!availableItems().some(item => item.id === get('itemId')) || liveCourier(get('itemId')) || offeredSale(get('itemId'))) throw new Error('Select an available account-owned tool.');
        if (get('hostAccountId') === session.accountId) throw new Error('Choose a distinct consignment host.');
        return result('/v1/consignments/create', { itemId: get('itemId'), hostAccountId: get('hostAccountId'), price: number('price'), hostFeeBps: number('hostFeeBps'), lifetimeSeconds: number('lifetimeSeconds'), consent: true }, 'Offer exact tool for consignment', ['inventory', 'courier', 'consignments', 'me']);
      }
      if (['accept-consignment', 'buy-consignment', 'cancel-consignment'].includes(action)) {
        const row = list(boards.consignments?.rows).find(row => row.consignmentId === get('consignmentId') && row.sourceHash === get('sourceHash'));
        if (!row) throw new Error('This consignment source changed. Refresh before acting.');
        return result('/v1/consignments/' + action.replace('-consignment', ''), { consignmentId: row.consignmentId, sourceHash: row.sourceHash, consent: true }, words(action), ['consignments', 'me']);
      }
      throw new Error('This action is not available.');
    }

    async function run(entry, previous) {
      if (!active() || busy || loading || sessionUnavailable || (retry && !previous)) return;
      const token = epoch, originalSession = session, isCurrent = () => current(token), canDispatch = () => isCurrent() && active();
      const pending = previous || { entry: { ...entry, body: JSON.parse(JSON.stringify(entry.body)) }, key: crypto.randomUUID(), accountId: session?.accountId, character: actorKey(session?.character) };
      let sent = false;
      busy = true; notice = 'Checking your session before sending ' + pending.entry.label.toLowerCase() + '…'; noticeBad = false; draw();
      try {
        const probe = await options.api('GET', '/v1/session', undefined, { beforeDispatch: canDispatch, isCurrent });
        if (!isCurrent()) return;
        if (probe?.ignored || !(probe?.code >= 200 && probe.code < 300) || !validSession(probe.body) || probe.body.accountId !== originalSession?.accountId || actorKey(probe.body.character) !== actorKey(originalSession?.character)) {
          if (probe?.code === 401) invalidate('Restore your session before continuing. No new action was sent.');
          else if (probe?.code >= 200 && probe.code < 300) invalidate('Your session changed. No action was sent; previous records were cleared.', true);
          else { notice = 'The session check could not finish. No new action was sent. Refresh records to retry.'; noticeBad = true; }
          return;
        }
        if (!canDispatch()) return;
        sent = true; notice = 'Submitting ' + pending.entry.label.toLowerCase() + '…'; draw();
        const response = await options.act('POST', pending.entry.path, pending.entry.body, { label: pending.entry.label, idempotencyKey: pending.key, beforeDispatch: canDispatch, isCurrent });
        if (!isCurrent()) return;
        if (!response || response.ignored || !Number.isInteger(response.code) || response.code < 200 || response.code >= 500 || [408, 425].includes(response.code) || (previous && response.code === 429)
          || [response.body?.error, response.body?.message, response.body?.reason].some(value => ['offline', 'in_progress', 'idempotency_in_progress', 'request_in_progress'].includes(value))) {
          retry = pending; notice = 'The result is unknown. Retry the same request to recover its recorded result.'; noticeBad = true;
        } else if (response.code >= 400) {
          retry = null; notice = responseError(response); noticeBad = true;
          if (response.code === 401 || ['no_character', 'token_revoked'].includes(response.body?.error)) { invalidate('Restore your session before continuing.'); return; }
        } else if (!response.body || typeof response.body !== 'object' || response.body.error) {
          retry = pending; notice = 'The response was incomplete. Retry the same request to confirm its result.'; noticeBad = true;
        } else {
          retry = null; notice = pending.entry.label + ' completed.'; noticeBad = false;
        }
      } catch {
        if (isCurrent()) {
          if (sent) { retry = pending; notice = 'The result is unknown. Retry the same request to recover its recorded result.'; }
          else notice = 'The session check could not finish. No new action was sent. Refresh records to retry.';
          noticeBad = true;
        }
      } finally {
        if (isCurrent()) { busy = false; draw(); if (active() && !retry && !sessionUnavailable) await load(); }
      }
    }

    root.addEventListener('submit', event => {
      const element = event.target.closest('form[data-business-form]'), submitter = event.submitter;
      if (!element || !root.contains(element)) return;
      event.preventDefault();
      if (!submitter?.dataset.businessAction || submitter.disabled || busy || loading || retry || sessionUnavailable || !active()) return;
      if (!element.reportValidity()) return;
      try { const entry = describeAction(element, submitter.dataset.businessAction); run(entry); }
      catch (error) { notice = error.message || 'Review the form before continuing.'; noticeBad = true; draw(); }
    });
    root.addEventListener('click', event => {
      const target = event.target.closest('button'); if (!target || !root.contains(target) || target.disabled) return;
      if (target.hasAttribute('data-business-refresh')) load();
      if (target.hasAttribute('data-business-retry') && retry) run(retry.entry, retry);
      if (target.dataset.businessSection) {
        const section = root.querySelector('#business-' + target.dataset.businessSection);
        if (section) { section.tabIndex = -1; section.scrollIntoView({ block: 'start', behavior: 'instant' }); section.focus({ preventScroll: true }); }
      }
    });
    root.addEventListener('change', event => {
      if (event.target.closest('[data-business-form="production"]')) {
        const name = event.target.name; captureDrafts(); draw(); root.querySelector('[data-business-form="production"] [name="' + name + '"]')?.focus({ preventScroll: true });
      }
    });
    draw(); load();
    return {
      update(next) {
        const nextOptions = { ...options, ...next }, nextIdentity = nextOptions.identity, nextCharacterKey = actorKey(nextOptions.character);
        const changed = nextIdentity !== identity || nextCharacterKey !== characterKey;
        options = nextOptions;
        if (changed) {
          identity = nextIdentity; characterKey = nextCharacterKey; epoch++; readVersion++; loading = busy = false; retry = null; session = null; sessionUnavailable = false;
          notice = ''; noticeBad = false; drafts.clear(); issuedSalvage.clear();
          for (const key of Object.keys(boards)) delete boards[key];
          for (const key of Object.keys(errors)) delete errors[key];
          root.replaceChildren(); draw(); load(); return;
        }
        if (!busy && !loading) load();
      },
      destroy() { destroyed = true; epoch++; readVersion++; drafts.clear(); issuedSalvage.clear(); root.remove(); },
    };
  }
  window.OmertaBusinessDesk = Object.freeze({ mount });
})();
