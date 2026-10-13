(function () {
  'use strict';
  function node(tag, text, className) {
    const element = document.createElement(tag); if (text != null) element.textContent = String(text);
    if (className) element.className = className; return element;
  }
  const list = value => Array.isArray(value) ? value.slice(0, 64) : [];
  const ingredientTitle = item => String(item.title || (item.kind === 'car' ? 'Car' : item.kind === 'material' ? 'Material' : 'Item'))
    .replace(/^[^:]+:/, '').replace(/[_-]+/g, ' ');
  const recipeBlocker = reason => ({
    recipe_location: 'Visit the required crafting location.',
    recipe_owns_car: 'An eligible car is required.',
    recipe_skill: 'Learn the required skill.',
    recipe_level: 'Reach the required level.',
    recipe_cash: 'More cash is required.',
    salvage_required: 'Use Crafting for car salvage.',
  }[reason?.code] || 'A recipe requirement has not been met.');
  function render(root, { board, invitations, recovery, history, homes, actors, pending, onRead, onAction, onBind }) {
    const bind = (element, name, handler) => onBind(element, name, handler);
    const button = (label, handler, disabled = false, readOnly = false) => {
      const control = node('button', label); control.type = 'button'; control.disabled = disabled || pending && !readOnly;
      bind(control, 'click', handler); return control;
    };
    const paragraph = text => root.append(node('p', text, 'city-world__hint'));
    const heading = text => root.append(node('h4', text));
    const issued = (action, fields = {}, label = action?.label) => button(label || 'Confirm', () => onAction(action, fields), action?.available !== true);
    const input = (type, label) => {
      const field = node('input'); field.type = type; field.setAttribute('aria-label', label); return field;
    };
    heading('Deed homes');
    paragraph('Storage and workbenches belong to an activated deed home. Travel to its district to enter. Visitors require an invitation and explicit acceptance.');
    const directory = node('div', null, 'city-world__emotes'); directory.dataset.cityHomeDirectory = '';
    const own = homes?.myHome;
    if (own?.key) directory.append(button('Enter ' + own.street, () => onRead('home-interior', { homeKey: own.key }),false,true));
    else paragraph('You have no published deed home in this district. Find your street in the World Map, or claim or purchase a deed through the property controls.');
    directory.append(button('Refresh homes', () => onRead('home-list'),false,true),
      button('Invitations & consent', () => onRead('home-invitations'),false,true),
      button('Recover stored belongings', () => onRead('home-recovery'),false,true),
      button('Your puzzle history', () => onRead('home-history'),false,true));
    root.append(directory);
    for (const invitation of list(invitations?.invitations)) {
      const card = node('section', null, 'city-world__card');
      card.append(node('strong', invitation.street || 'Home invitation'), node('p', 'Invited by ' + (invitation.host?.name || 'the host')),
        issued(invitation.action)); root.append(card);
    }
    for (const grant of list(invitations?.permissions)) {
      const card = node('section', null, 'city-world__card');
      card.append(node('strong', grant.street || grant.homeKey || 'Visitor consent'), node('p', grant.status || 'Permission'));
      if (grant.status === 'active') card.append(button('Enter home', () => onRead('home-interior', { homeKey: grant.homeKey }),false,true));
      if (grant.action) card.append(issued(grant.action)); root.append(card);
    }
    for (const item of list(recovery?.items)) {
      const card = node('section', null, 'city-world__card');
      card.append(node('strong', item.title || item.templateId), node('p', 'Your archived belongings from ' + item.homeKey), issued(item.action)); root.append(card);
    }
    for (const record of list(history?.outcomes)) {
      const card=node('section',null,'city-world__card');card.append(node('strong',record.title),node('p','Historical completion · generation '+record.generation+' · '+record.outcome.solvedAt));
      root.append(card);
    }
    if (!board?.home) return;
    heading(board.home.street + ' · ' + (board.access?.role === 'owner' ? 'Your home' : 'Visiting'));
    paragraph(board.room?.active ? 'Confirmed room revision ' + board.home.revision + '. Room access does not change safehouse protection.' : 'Activate your room to use its storage and workbench.');
    const actions = list(board.actions), activate = actions.find(action => action.id === 'activate');
    if (activate) root.append(issued(activate));
    const leave = actions.find(action => action.id === 'leave'); if (leave) root.append(issued(leave));
    if (!board.room?.active) return;
    const floor = node('div', null, 'city-world__room'); floor.dataset.cityDeedRoom = ''; floor.setAttribute('role', 'group'); floor.setAttribute('aria-label', 'Confirmed six by six deed room');
    for (let y = 0; y < 6; y++) for (let x = 0; x < 6; x++) {
      const tile = node('span', null, 'city-world__floor'); tile.style.gridColumn = String(x + 1); tile.style.gridRow = String(y + 1); floor.append(tile);
    }
    const catalog = list(board.room.catalog), furniture = list(board.room.furniture);
    for (const item of furniture) {
      const definition = catalog.find(entry => entry.id === item.id);
      if (!definition || !['chair','table','lamp','window'].includes(item.id) || !Number.isInteger(item.x) || !Number.isInteger(item.y) || item.x < 0 || item.x > 5 || item.y < 0 || item.y > 5) continue;
      const piece = node('span', null, 'city-world__furniture city-world__furniture--' + item.id);
      piece.setAttribute('role', 'img'); piece.setAttribute('aria-label', definition.name || item.id);
      piece.style.gridColumn = String(item.x + 1); piece.style.gridRow = String(item.y + 1); floor.append(piece);
    }
    root.append(floor);
    const layout = actions.find(action => action.id === 'layout');
    if (layout) {
      const controls = node('div', null, 'city-world__room-controls'), select = node('select'); select.setAttribute('aria-label', 'Home furnishing');
      for (const item of catalog) { const option = node('option', item.name || item.id); option.value = item.id; select.append(option); }
      const x = input('number', 'Home column'), y = input('number', 'Home row');
      for (const field of [x,y]) { field.min = '1'; field.max = '6'; field.value = '2'; }
      controls.append(select, x, y, button('Save furnishing', () => onAction(layout, { room: { furniture:
        furniture.filter(item => item.id !== select.value).concat({ id: select.value, x: Number(x.value) - 1, y: Number(y.value) - 1 }) } }), layout.available !== true));
      root.append(controls);
    }
    if (board.storage) {
      heading('Private storage · ' + list(board.storage.items).length + '/' + board.storage.capacity);
      paragraph('Items keep their original account owner. Stored items cannot be spent or equipped; withdraw them first. After resale, recover your own archived contents.');
      for (const item of list(board.storage.items)) {
        const card = node('section', null, 'city-world__card'); card.append(node('strong', item.title || item.templateId), issued(item.action)); root.append(card);
      }
      for (const item of list(board.storage.availableItems)) {
        const card = node('section', null, 'city-world__card'); card.append(node('strong', item.title || item.templateId), issued(item.action)); root.append(card);
      }
      if (!list(board.storage.availableItems).length) paragraph('No eligible durable account items are available. Character-bound keepsakes, exact lots and operation escrow stay in their existing custody.');
    }
    heading('Workbench');
    paragraph('Craft using your own materials and the existing recipe, skill, location and cash requirements. Stored inputs must be withdrawn.');
    for (const recipe of list(board.workbench?.recipes)) {
      const card = node('section', null, 'city-world__card'); card.append(node('strong', recipe.title || recipe.id));
      card.append(node('p', list(recipe.inputs).map(item => (item.quantity || item.qty || 1) + ' × ' + ingredientTitle(item)).join(', ')));
      if (recipe.cashCost) card.append(node('p', 'Existing cash cost: $' + recipe.cashCost));
      if (list(recipe.blockedBy).length) card.append(node('p', recipe.blockedBy.map(recipeBlocker).join(' ')));
      card.append(issued(recipe.action)); root.append(card);
    }
    const invite = actions.find(action => action.id === 'invite');
    if (invite) {
      heading('Visitor permissions');
      const target = node('select'); target.setAttribute('aria-label', 'Home visitor');
      for (const person of list(actors)) {
        const id = person.characterId || person.id; if (!id || id === board.viewer?.characterId) continue;
        const option = node('option', person.name || 'Nearby person'); option.value = id; target.append(option);
      }
      const craft = input('checkbox', 'Allow visitor workbench'); craft.checked = false;
      const label = node('label', 'Allow workbench with their own materials'); label.prepend(craft);
      root.append(target, label, button('Send invitation', () => onAction(invite,
        { targetCharacterId: target.value, ...(list(invite.inputFields).includes('rights') ? { rights: craft.checked ? ['visit','workbench'] : ['visit'] } : {}) }), !target.options.length || invite.available !== true));
      paragraph('Inviting sends permission only. The guest must accept. You can revoke; the guest can withdraw consent while away.');
    }
    for (const visitor of list(board.visitors)) {
      const card = node('section', null, 'city-world__card'); card.append(node('strong', visitor.name || visitor.guest?.name || 'Visitor'), node('p', visitor.status));
      if (visitor.action) card.append(issued(visitor.action)); root.append(card);
    }
    heading('Host a room puzzle');
    paragraph('Puzzles use the furnishings you placed. Joining explicitly shares your name with admitted guests in this room. Changing the layout, selling the deed or withdrawing consent ends current participation.');
    const active=board.activity?.active;
    if(active){
      const party=node('section',null,'city-world__card');party.dataset.cityHomeActivity=active.id;
      party.append(node('strong',active.title),node('p','Participants '+list(active.roster).length+'/'+active.capacity+': '+list(active.roster).map(member=>member.name).join(', ')));
      if(active.self){
        party.append(node('p','Your progress '+active.self.step+'/3 · '+active.self.status));
        if(active.self.clue)party.append(node('p',active.self.clue));
        if(active.self.outcome)party.append(node('p','Confirmed solved: '+active.self.outcome.solvedAt));
      }
      for(const action of list(active.actions)){
        if(list(action.inputFields).includes('consent')){
          const consent=input('checkbox','Share my name and join this home puzzle');consent.checked=false;
          const label=node('label','Share my name in this room and join this puzzle');label.prepend(consent);
          const message=node('p','', 'city-world__hint');message.setAttribute('role','status');
          party.append(label,button(action.label,()=>{if(!consent.checked){message.textContent='Select the consent checkbox before joining.';return;}onAction(action,{consent:true});},action.available!==true),message);
        }else party.append(issued(action));
      }
      const cells=node('div',null,'city-world__emotes');
      for(const cell of list(active.cells))if(cell.action){const choice=issued(cell.action,{},cell.label);choice.dataset.cityHomePuzzleCell=cell.key;cells.append(choice);}
      party.append(cells);root.append(party);
    }else for(const puzzle of list(board.activity?.catalog)){
      const card=node('section',null,'city-world__card');card.append(node('strong',puzzle.title),node('p','Place '+list(puzzle.requires).join(', ')+' in your room before hosting.'));
      if(puzzle.action)card.append(issued(puzzle.action));root.append(card);
    }
    root.append(button('Refresh this room', () => onRead('home-interior', { homeKey: board.home.key }),false,true));
  }
  window.CityHomeUi = Object.freeze({ render });
})();
