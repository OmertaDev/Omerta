/* A private place in the city. Cosmetics and player writing never grant game authority. */
(() => {
  const list = value => Array.isArray(value) ? value : [];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const palette = { charcoal: '#343b40', tobacco: '#795b3c', wine: '#713d43', navy: '#31455d' };
  const props = { lamp: 'Brass reading lamp', record: 'Record player', files: 'Case files', plant: 'Window fern', clock: 'Desk clock', glass: 'Water glass' };
  const icon = { lamp: '◒', record: '◎', files: '▤', plant: '♧', clock: '◷', glass: '▱' };
  function wardrobeSvg(outfit = {}) {
    const coat = palette[outfit.coat] || palette.charcoal, scarf = palette[outfit.scarf] || palette.wine;
    return `<svg viewBox="0 0 240 245" role="img" aria-label="Cosmetic outfit preview"><path d="M30 240v-60q0-40 50-58l40 38 40-38q50 18 50 58v60" fill="${coat}" stroke="#bb9c62"/><path d="m80 122 40 38-28 45-20-72m88-11-40 38 28 45 20-72" fill="#212427"/><path d="m105 132 15 28 15-28-5 75h-20Z" fill="${scarf}"/><path d="M95 100h50v38l-25 22-25-22Z" fill="#aa9474"/><ellipse cx="120" cy="70" rx="36" ry="43" fill="#c0ab89"/>${outfit.hat === 'fedora' ? '<path d="M67 54h106l-8 11H75Zm25-3 6-29 23 7 22-7 9 29Z" fill="#302b26" stroke="#bfa46e"/>' : outfit.hat === 'cap' ? '<path d="M83 50q32-42 72 0l18 11H90Z" fill="#453d33" stroke="#bfa46e"/>' : ''}<path d="M102 75h10m17 0h10M114 97h13" stroke="#3e3429" stroke-width="3"/></svg>`;
  }
  function vehicleSvg(kind = 'car') {
    return kind === 'boat' ? '<svg viewBox="0 0 320 150" role="img" aria-label="Illustrated vessel"><path d="M30 93h270l-47 39H76Z" fill="#394851" stroke="#c3a365"/><path d="M110 91V48h86l33 43Z" fill="#b8b09b"/><path d="M122 56h30v25h-30m42-25h25l22 25h-47" fill="#364d5c"/><path d="M15 138q30-9 60 0t60 0t60 0t60 0t60 0" fill="none" stroke="#738d93"/></svg>' : '<svg viewBox="0 0 320 150" role="img" aria-label="Illustrated motor car"><path d="m33 90 36-12 34-43h110l33 43 44 12v34H33Z" fill="#3b454b" stroke="#c3a365"/><path d="m91 75 23-29h88l24 29Z" fill="#819394"/><path d="M158 45v31M44 98h25m181 0h27" stroke="#d9c18d" stroke-width="4"/><circle cx="88" cy="121" r="22" fill="#151619" stroke="#a99b7d"/><circle cx="243" cy="121" r="22" fill="#151619" stroke="#a99b7d"/></svg>';
  }
  function knownContacts(board = {}) {
    const contacts = [...list(board.bonds), ...list(board.guarding), board.guardedBy,
      board.spouse?.street, board.consigliere?.street, board.nemesis?.street].filter(item => item?.id);
    return contacts.filter((item, index) => contacts.findIndex(other => other.id === item.id) === index);
  }
  function trophies(me, boards) {
    const result = list(me?.trades).filter(track => Number(track.lvl) > 1).map(track => ({ id: `trade:${track.id}`, title: `${track.name} · ${track.rank || `level ${track.lvl}`}`, detail: `Level ${track.lvl} in this life` }));
    for (const season of list(boards.seasons?.recaps)) if (season.title) result.push({ id: `season:${season.season}`, title: season.title, detail: `Season ${season.season} · bloodline record` });
    for (const category of list(boards.collection?.categories)) if (Number(category.total) > 0 && Number(category.have) >= Number(category.total)) result.push({ id: `collection:${category.id}`, title: category.name, detail: 'Recorded collection complete' });
    return result;
  }
  window.OmertaIdentityModel = { wardrobeSvg, vehicleSvg, knownContacts, trophies };
  window.createOmertaIdentity = ({ getState, workspace, read, notify = () => {} }) => {
    let account = '', character = '', boards = {}, pending = false, serial = 0, signature = '';
    const opened = {}, drafts = new Map();
    const state = () => getState() || {};
    const value = () => workspace?.get('identity', {}) || {};
    const save = (patch, label) => { workspace?.set('identity', { ...value(), ...patch }, { label }); signature = ''; };
    const generation = () => Number(boards.bloodline?.steward?.generation || state().me?.generation || 1);
    function scope() {
      const next = String(state().session?.accountId || ''), id = String(state().me?.id || '');
      if (next !== account || id !== character) {
        account = next; character = id; boards = {}; pending = false; serial++; signature = ''; drafts.clear();
        for (const key of Object.keys(opened)) delete opened[key];
        document.querySelectorAll('.ux-identity').forEach(node => node.remove());
      }
      return !!account && !!id;
    }
    const section = (key, title, content) => `<details data-identity-section="${key}"><summary>${title}</summary>${content}</details>`;
    const option = (id, name, current) => `<option value="${esc(id)}"${id === current ? ' selected' : ''}>${esc(name)}</option>`;
    const control = (name, text, content) => `<label>${text}<select data-identity-setting="${name}" aria-label="${text}">${content}</select></label>`;
    function roomMarkup(data) {
      const order = list(data.room).filter(id => props[id]);
      const arranged = [...new Set([...order, 'lamp', 'record', 'files'])].slice(0, 6);
      return `<p>A private cosmetic room. Arrange objects by dragging or using the numbered positions.</p><div class="ux-personal-office" role="group" aria-label="Your private office"><div class="ux-office-window" aria-hidden="true"></div><div class="ux-office-name">${esc(data.chapters?.[character]?.title || state().me.name)}’s office</div><div class="ux-office-desk">${arranged.map((id, index) => `<div class="ux-office-prop" draggable="true" data-office-prop="${id}"><span aria-hidden="true">${icon[id]}</span><b>${props[id]}</b><label>Position<select data-office-position="${id}" aria-label="${props[id]} position">${arranged.map((_, i) => option(String(i), String(i + 1), String(index))).join('')}</select></label></div>`).join('')}</div></div><label>Add an office object<select data-office-add aria-label="Add an office object"><option value="">Choose an object</option>${Object.entries(props).filter(([id]) => !arranged.includes(id)).map(([id, title]) => option(id, title, '')).join('')}</select></label>`;
    }
    function trophyMarkup(data) {
      const earned = trophies(state().me, boards), chosen = list(data.trophies).filter(id => earned.some(item => item.id === id)).slice(0, 3);
      return `<p>Curate up to three actual accomplishments. Eligibility follows the current records.</p><div class="ux-trophy-shelf">${chosen.map(id => { const item = earned.find(t => t.id === id); return `<article><span aria-hidden="true">♜</span><h4>${esc(item.title)}</h4><p>${esc(item.detail)}</p></article>`; }).join('') || '<p>The shelf is ready for the accomplishments you choose.</p>'}</div><div class="ux-trophy-choices">${earned.map(item => `<label><input type="checkbox" data-trophy="${esc(item.id)}"${chosen.includes(item.id) ? ' checked' : ''}> ${esc(item.title)}</label>`).join('') || '<p>Open your personal records, or reach another trade level, to find eligible trophies.</p>'}</div>`;
    }
    function wardrobeMarkup(data) {
      const outfit = data.wardrobe || {};
      return `<p>A cosmetic illustrated outfit beside your actual avatar. It changes no equipment, portrait token, or stats.</p><div class="ux-wardrobe-preview"><img src="/v1/avatar/${encodeURIComponent(character)}" alt="${esc(state().me.name)}’s current avatar">${wardrobeSvg(outfit)}</div><div class="ux-identity-fields">${control('hat', 'Cosmetic headwear', [['none', 'No hat'], ['fedora', 'Fedora'], ['cap', 'Newsboy cap']].map(([id, name]) => option(id, name, outfit.hat || 'none')).join(''))}${['coat', 'scarf'].map(key => control(key, `Cosmetic ${key}`, Object.keys(palette).map(id => option(id, id, outfit[key] || (key === 'coat' ? 'charcoal' : 'wine'))).join(''))).join('')}</div>`;
    }
    function galleryMarkup(data) {
      const cars = list(state().me.cars).map(car => ({ ...car, kind: 'car', official: car.model }));
      const boats = list(boards.port?.fleet).map(boat => ({ ...boat, kind: 'boat', official: boat.name || boat.model || boat.type }));
      const fleet = [...cars, ...boats];
      return `<p>Illustrated studies of your current fleet. Nicknames are private labels; official names and conditions remain visible.</p><div class="ux-identity-gallery">${fleet.map(item => `<article>${vehicleSvg(item.kind)}<h4>${esc(data.nicknames?.[item.id] || item.official)}</h4><p>Official record: ${esc(item.official)} · ${esc(item.kind)}</p><p>${item.kind === 'car' ? `Damage ${Number(item.dmg || 0)}%${item.listed ? ' · listed' : ''}${item.pledged ? ' · pledged' : ''}` : esc(item.status || 'Record available')}</p><form data-identity-form="nickname:${esc(item.id)}"><label>Private nickname<input name="nickname" maxlength="60" value="${esc(data.nicknames?.[item.id] || '')}"></label><button class="act" type="submit">Save nickname</button></form></article>`).join('') || '<p>Your owned vehicles will appear here. Open the fleet records to include your boats.</p>'}</div>`;
    }
    function lineageMarkup() {
      const bloodline = boards.bloodline;
      if (!bloodline) return '<p>Load your personal records to open the ancestral hall.</p>';
      return `<p>${esc(bloodline.dynasty || 'Your bloodline')} · recorded generations</p><ol class="ux-ancestral-hall">${list(bloodline.ancestors).map(ancestor => `<li><details><summary>${esc(ancestor.title)} · ${esc(ancestor.epithet)}</summary><p>${esc(ancestor.honorTier)} · level ${Number(ancestor.level)}</p><p>Cause: ${esc(ancestor.cause)}</p><time>${esc(new Date(ancestor.diedAt).toLocaleString())}</time><p>The death date is recorded; an unrecorded lifetime is not reconstructed.</p></details></li>`).join('')}<li aria-current="step"><img src="/v1/avatar/${encodeURIComponent(character)}" alt=""><strong>${esc(bloodline.steward.title)}</strong><p>Current steward · ${esc(bloodline.steward.honorTier)}</p></li></ol>`;
    }
    function lettersMarkup(data) {
      const letters = list(data.letters), inherited = letters.filter(letter => letter.character !== character && Number(letter.generation) < generation());
      return `<p>A private message to a future character on this account. It opens after a later generation takes the street.</p><form data-identity-form="heir"><label>Letter to your heir<textarea name="letter" maxlength="1600" required></textarea></label><button class="act" type="submit">Seal for my heir</button></form><div class="ux-heir-letters">${inherited.map(letter => `<details><summary>Letter from ${esc(letter.name)} · generation ${Number(letter.generation)}</summary><blockquote>${esc(letter.text)}</blockquote><time>${esc(new Date(letter.at).toLocaleString())}</time></details>`).join('')}${letters.filter(letter => letter.character === character).map(letter => `<p>Sealed for your successor · ${esc(new Date(letter.at).toLocaleString())}</p>`).join('')}${!letters.length ? '<p>No letters have been left yet.</p>' : ''}</div>`;
    }
    function chapterMarkup(data) {
      const chapter = data.chapters?.[character] || {};
      return `<p>Your own chapter title and voluntary code. These do not change your rank, permissions or story outcomes.</p><article class="ux-chapter-cover"><small>Generation ${generation()}</small><h4>${esc(chapter.title || 'An unwritten chapter')}</h4><blockquote>${esc(chapter.code || 'What will you stand for?')}</blockquote></article><form data-identity-form="chapter"><label>Name this chapter<input name="title" maxlength="90" value="${esc(chapter.title || '')}"></label><label>My personal code<textarea name="code" maxlength="500">${esc(chapter.code || '')}</textarea></label><label><input type="checkbox" name="showCode"${chapter.showCode ? ' checked' : ''}> Show my code beside revealed story decisions</label><button class="act" type="submit">Save my chapter</button></form>`;
    }
    function notesMarkup(data) {
      const contacts = knownContacts(boards.people);
      return `<p>Private notes beside authorized contacts’ real identities. Nothing here is shared with them.</p>${contacts.map(contact => `<form data-identity-form="contact:${esc(contact.id)}"><h4>${esc(contact.name)}</h4><label>Private nickname<input name="nickname" maxlength="60" value="${esc(data.contacts?.[contact.id]?.nickname || '')}"></label><label>My contact note<textarea name="note" maxlength="600">${esc(data.contacts?.[contact.id]?.note || '')}</textarea></label><button class="act" type="submit">Save private contact note</button></form>`).join('') || '<p>Load your records to see known contacts; no unknown identities are added.</p>'}`;
    }
    async function load() {
      if (pending || !scope()) return; pending = true; const owner = account, life = character, version = serial;
      try {
        for (const path of ['/v1/bloodline', '/v1/people', '/v1/collection', '/v1/season/recap', '/v1/port']) {
          const response = await read(path);
          if (owner !== state().session?.accountId || life !== state().me?.id || version !== serial) return;
          if (response.code >= 400) notify('A personal record could not be read. Try again when you choose.', true);
        }
      } finally { if (version === serial) { pending = false; signature = ''; render(); } }
    }
    function moveProp(id, position) {
      const saved = value(), order = [...new Set([...list(saved.room).filter(key => props[key]), 'lamp', 'record', 'files'])].slice(0, 6);
      const index = order.indexOf(id); if (index < 0) return;
      order.splice(index, 1); order.splice(Math.max(0, Math.min(order.length, Number(position))), 0, id); save({ room: order }, 'Arrange private office'); render();
    }
    function bind(host) {
      host.querySelector('[data-identity-load]').onclick = load;
      host.querySelectorAll('[data-identity-section]').forEach(node => {
        const key = node.dataset.identitySection; if (Object.hasOwn(opened, key)) node.open = opened[key];
        node.querySelector(':scope>summary').onclick = () => { opened[key] = !node.open; };
        node.addEventListener('toggle', () => { if (node.isConnected) opened[key] = node.open; });
      });
      host.querySelectorAll('[data-office-position]').forEach(select => select.onchange = () => moveProp(select.dataset.officePosition, select.value));
      host.querySelectorAll('[data-office-prop]').forEach(node => {
        node.ondragstart = event => event.dataTransfer.setData('text/plain', `office:${node.dataset.officeProp}`);
        node.ondragover = event => event.preventDefault();
        node.ondrop = event => { event.preventDefault(); const source = event.dataTransfer.getData('text/plain'); if (source.startsWith('office:')) moveProp(source.slice(7), [...node.parentElement.children].indexOf(node)); };
      });
      const addObject = host.querySelector('[data-office-add]');
      if (addObject) addObject.onchange = event => { const id = event.target.value; if (props[id]) { const order = [...new Set([...list(value().room), 'lamp', 'record', 'files', id])].slice(0, 6); save({ room: order }, 'Add office object'); render(); } };
      host.querySelectorAll('[data-trophy]').forEach(input => input.onchange = () => {
        const chosen = [...host.querySelectorAll('[data-trophy]:checked')].map(node => node.dataset.trophy);
        if (chosen.length > 3) { input.checked = false; notify('Choose up to three accomplishments for the shelf.'); return; }
        save({ trophies: chosen }, 'Curate trophy shelf'); render();
      });
      host.querySelectorAll('[data-identity-setting]').forEach(select => select.onchange = () => { save({ wardrobe: { ...value().wardrobe, [select.dataset.identitySetting]: select.value } }, 'Change cosmetic outfit'); render(); });
      host.querySelectorAll('[data-identity-form]').forEach(form => {
        for (const field of form.querySelectorAll('[name]')) {
          const key = `${form.dataset.identityForm}:${field.name}`, draft = drafts.get(key);
          if (draft !== undefined) { if (field.type === 'checkbox') field.checked = draft; else field.value = draft; }
          field.oninput = () => drafts.set(key, field.type === 'checkbox' ? field.checked : field.value);
        }
        form.onsubmit = event => {
          event.preventDefault(); const fields = Object.fromEntries(new FormData(form)), current = value(), key = form.dataset.identityForm;
          if (key === 'chapter') save({ chapters: { ...current.chapters, [character]: { title: fields.title.trim(), code: fields.code.trim(), showCode: fields.showCode === 'on' } } }, 'Write personal chapter');
          else if (key === 'heir') {
            if (!fields.letter.trim()) return;
            save({ letters: [...list(current.letters), { character, generation: generation(), name: state().me.name, text: fields.letter.trim(), at: new Date().toISOString() }].slice(-24) }, 'Seal letter to heir');
          } else if (key.startsWith('nickname:')) save({ nicknames: { ...current.nicknames, [key.slice(9)]: fields.nickname.trim() } }, 'Name personal vehicle');
          else if (key.startsWith('contact:')) save({ contacts: { ...current.contacts, [key.slice(8)]: { nickname: fields.nickname.trim(), note: fields.note.trim() } } }, 'Annotate known contact');
          for (const field of form.querySelectorAll('[name]')) drafts.delete(`${key}:${field.name}`);
          notify('Your private presentation is saved.'); signature = ''; render();
        };
      });
    }
    function codeBesideChoices() {
      const code = value().chapters?.[character];
      document.querySelectorAll('[data-identity-code]').forEach(node => node.remove());
      if (!code?.showCode || !code.code || state().currentTab !== 'fieldwork') return;
      const root = document.querySelector('#tab-fieldwork .world-fieldwork'); if (!root) return;
      const note = document.createElement('aside'); note.dataset.identityCode = ''; note.className = 'ux-personal-code';
      const title = document.createElement('strong'); title.textContent = 'My voluntary code';
      const text = document.createElement('p'); text.textContent = code.code; note.append(title, text); root.prepend(note);
    }
    function render() {
      if (!scope()) return; codeBesideChoices();
      const tab = state().currentTab; if (!['profile', 'estate', 'garage', 'port', 'life'].includes(tab)) return;
      const parent = document.getElementById(`tab-${tab}`); if (!parent) return;
      let host = parent.querySelector(':scope > .ux-identity');
      const data = value(), next = JSON.stringify([tab, character, data, state().me.cars, state().me.trades, boards, pending]);
      if (host && next === signature) return;
      const focused = host?.contains(document.activeElement) && document.activeElement.name ? { form: document.activeElement.closest('[data-identity-form]')?.dataset.identityForm, name: document.activeElement.name, start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd } : null;
      if (!host) { host = document.createElement('section'); host.className = 'ux-identity'; host.dataset.uxPanel = 'identity'; parent.append(host); }
      const parts = tab === 'garage' || tab === 'port' ? section('fleet', 'Your private showroom', galleryMarkup(data))
        : section('office', 'Arrange your private office', roomMarkup(data)) + section('trophies', 'Curate your trophy shelf', trophyMarkup(data)) + section('wardrobe', 'Try a cosmetic outfit', wardrobeMarkup(data))
          + section('lineage', 'Walk the ancestral hall', lineageMarkup()) + section('letters', 'Letters to your heir', lettersMarkup(data))
          + section('chapter', 'Name your chapter and personal code', chapterMarkup(data)) + section('contacts', 'Your private contact annotations', notesMarkup(data)) + section('fleet', 'Your private showroom', galleryMarkup(data));
      host.innerHTML = `<header><span class="ux-kicker">PRIVATE · DISPLAY AND PLAYER WRITING</span><h3>A place of your own</h3><p>Personal expression, stored for this account. Actual ownership and accomplishments come from current records.</p><button type="button" class="act" data-identity-load${pending ? ' disabled' : ''}>${pending ? 'Reading personal records…' : 'Load my personal and fleet records'}</button></header>${parts}`;
      bind(host); signature = next;
      if (focused?.form) {
        const form = [...host.querySelectorAll('[data-identity-form]')].find(node => node.dataset.identityForm === focused.form);
        const field = [...(form?.querySelectorAll('[name]') || [])].find(node => node.name === focused.name); field?.focus({ preventScroll: true });
        if (field && focused.start != null) try { field.setSelectionRange(focused.start, focused.end); } catch {}
      }
      document.dispatchEvent(new CustomEvent('omerta:identity-rendered'));
    }
    function observe(path, body) {
      if (!scope()) return;
      const key = ({ '/v1/bloodline': 'bloodline', '/v1/people': 'people', '/v1/collection': 'collection', '/v1/season/recap': 'seasons', '/v1/port': 'port' })[String(path).split('?')[0]];
      if (key) boards[key] = body;
    }
    document.addEventListener('omerta:fieldwork-rendered', codeBesideChoices);
    return { render, observe, afterRender: render, reloadWorkspace() { signature = ''; render(); } };
  };
})();
