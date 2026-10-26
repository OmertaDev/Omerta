/* Optional atmosphere and tactile presentation, with no game-state writes. */
(() => {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = value => Array.isArray(value) ? value : [];
  const words = value => String(value || '').replace(/^[^:]+:/, '').replace(/[_-]+/g, ' ');
  const title = value => value.title || value.name || words(value.templateId || value.id);
  const defaults = () => ({ warmth: 35, grain: 15, accent: 'brass', tactile: true, connections: true, panorama: false, sound: false, bed: 'auto', volume: 50 });
  const normalize = value => ({ ...defaults(), ...value, warmth: Math.max(0, Math.min(100, Number(value?.warmth ?? 35))), grain: Math.max(0, Math.min(50, Number(value?.grain ?? 15))), accent: ['brass', 'sage', 'slate'].includes(value?.accent) ? value.accent : 'brass', volume: Math.max(0, Math.min(100, Number(value?.volume ?? 50))) });
  const art = { docks: 'district-v2-docks', neon: 'district-v2-neon-interior', cathedral: 'district-cathedral', foundry: 'district-v2-foundry', canal: 'district-canal', brick: 'district-brick' };
  const beds = { port: 'bed-docks', den: 'bed-den', speakeasy: 'bed-speakeasy', law: 'bed-law', pen: 'bed-pen', crew: 'bed-family', family: 'bed-family', portfolio: 'bed-legit' };
  function create({ getState, navigate, notify = () => {}, workspace, getSoundscapes = () => [], setSoundscape = () => {} }) {
    let owner = '', character = '', preferences = defaults(), preview = null, settings = null, inspect = null, arrival = null, source = null, sourceAt = 0, loading = new Map(), previousTab = '', context = null, preparation = new Map(), coaster = 45, speech = null;
    const state = () => getState() || {};
    const account = () => String(state().session?.accountId || state().me?.accountId || '');
    const panel = () => document.getElementById(`tab-${state().currentTab}`);
    const reduce = () => matchMedia('(prefers-reduced-motion:reduce)').matches;
    const quiet = () => { try { return JSON.parse(localStorage.getItem('omerta_feedback') || '{}')?.celebration === 'quiet'; } catch { return false; } };
    function scope() {
      const next = account(), actor = String(state().me?.id || ''); if (owner === next && character === actor) return !!owner;
      owner = next; character = actor; preferences = normalize(workspace?.get?.('feel', {}) || {}); preview = null; loading.clear(); preparation.clear(); context = null; source = null; settings?.close(); inspect?.close(); arrival?.remove(); arrival = null; stopSpeech(); apply(); return !!owner;
    }
    function apply(value = preview || preferences) {
      document.body.style.setProperty('--ux-feel-warmth', `${value.warmth / 500}`); document.body.style.setProperty('--ux-feel-grain', `${value.grain / 100}`); document.body.dataset.feelAccent = value.accent; document.body.classList.toggle('ux-feel-tactile', !!value.tactile && !reduce() && !quiet());
      const key = value.bed === 'auto' ? beds[state().currentTab] || 'bed-streets' : value.bed;
      setSoundscape({ enabled: !!owner && !!value.sound, key: getSoundscapes().includes(key) ? key : '', volume: value.volume });
      document.querySelectorAll('[data-feel-lamp]').forEach(node => node.setAttribute('aria-pressed', String(value.warmth > 50)));
    }
    function save(label) { workspace?.set?.('feel', preferences, { label }); }
    function settingsMarkup() {
      const value = preview || preferences;
      return `<header><div><small>OPTIONAL ATMOSPHERE</small><h2 id="ux-feel-title">Set the room</h2></div><button type="button" data-feel-cancel>Close</button></header><p>Preview changes immediately. Save stores private presentation preferences; Cancel restores the previous room.</p><label>Lamp warmth <output data-feel-value="warmth">${value.warmth}</output><input type="range" min="0" max="100" value="${value.warmth}" data-feel-pref="warmth"></label><label>Desk grain <output data-feel-value="grain">${value.grain}</output><input type="range" min="0" max="50" value="${value.grain}" data-feel-pref="grain"></label><label>Accent<select data-feel-pref="accent">${['brass', 'sage', 'slate'].map(key => `<option value="${key}"${value.accent === key ? ' selected' : ''}>${key}</option>`).join('')}</select></label><label><input type="checkbox" data-feel-pref="tactile"${value.tactile ? ' checked' : ''}> Tactile button presses</label><label><input type="checkbox" data-feel-pref="connections"${value.connections ? ' checked' : ''}> Connect navigation source to destination</label><label><input type="checkbox" data-feel-pref="panorama"${value.panorama ? ' checked' : ''}> Show a dismissible arrival panorama after a confirmed ride</label><p>Reduced motion and Quiet feedback suppress movement.</p><fieldset><legend>Venue soundscape · optional</legend><label><input type="checkbox" data-feel-pref="sound"${value.sound ? ' checked' : ''}> Use a room soundscape</label><label>Room<select data-feel-pref="bed"><option value="auto"${value.bed === 'auto' ? ' selected' : ''}>Follow the current venue</option>${getSoundscapes().map(key => `<option value="${esc(key)}"${value.bed === key ? ' selected' : ''}>${esc(words(key.replace('bed-', '')))}</option>`).join('')}</select></label><label>Room volume <output data-feel-value="volume">${value.volume}</output><input type="range" min="0" max="100" data-feel-pref="volume" value="${value.volume}"></label><p>Uses the existing audio engine and still respects its master sound, ambience, data-saving and hidden-page controls. Your first gesture unlocks playback.</p></fieldset><div class="ux-feel-buttons"><button type="button" data-feel-save>Save room preferences</button><button type="button" data-feel-cancel>Cancel preview</button><button type="button" data-feel-undo${!workspace?.history?.('feel')?.length ? ' disabled' : ''}>Undo last saved room edit</button></div><div class="ux-feel-preview" aria-label="Live cosmetic preview"><b>THE PRIVATE DESK</b><p>The lamp falls across the paper. No balances, odds or actions change.</p></div>`;
    }
    function openSettings() {
      if (!scope()) return;
      if (!settings) { settings = document.createElement('dialog'); settings.className = 'ux-feel-dialog'; settings.setAttribute('aria-labelledby', 'ux-feel-title'); settings.onclose = () => { preview = null; apply(); document.querySelector('[data-feel-open]')?.focus({ preventScroll: true }); }; document.body.append(settings); }
      preview = { ...preferences }; settings.innerHTML = settingsMarkup();
      settings.oninput = settings.onchange = event => { const input = event.target, key = input.dataset.feelPref; if (!key) return; preview[key] = input.type === 'checkbox' ? input.checked : input.type === 'range' ? Number(input.value) : input.value; settings.querySelector(`[data-feel-value="${key}"]`)?.replaceChildren(String(input.value)); apply(); };
      settings.onclick = event => { const button = event.target.closest('button'); if (!button) return; if (button.hasAttribute('data-feel-cancel')) { preview = null; apply(); settings.close(); } if (button.hasAttribute('data-feel-save')) { preferences = normalize(preview); preview = null; save('Save room atmosphere preferences'); settings.close(); apply(); } if (button.hasAttribute('data-feel-undo')) { const entry = workspace?.history?.('feel')?.[0]; if (entry && workspace.undo(entry.id)) { preferences = normalize(workspace.get('feel', {})); preview = { ...preferences }; settings.innerHTML = settingsMarkup(); apply(); } } };
      settings.showModal(); apply();
    }
    function inspectText(heading, text) {
      if (!inspect) { inspect = document.createElement('dialog'); inspect.className = 'ux-feel-dialog'; inspect.setAttribute('aria-label', 'Quick inspection'); document.body.append(inspect); }
      inspect.innerHTML = `<h2>${esc(heading)}</h2><p class="ux-feel-inspection">${esc(text)}</p><p class="ux-feel-muted">From the currently revealed record. Use the original screen controls for any action.</p><button type="button">Close inspection</button>`; inspect.querySelector('button').onclick = () => inspect.close(); inspect.showModal(); connected(inspect.querySelector('h2'));
    }
    function stopSpeech() { if (speech) { window.speechSynthesis?.cancel(); speech = null; } document.querySelectorAll('[data-feel-narrate]').forEach(button => { button.textContent = 'Read this aloud'; button.setAttribute('aria-pressed', 'false'); }); }
    function narrate(button, text) {
      if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) { notify('Spoken playback is unavailable in this browser. The full text remains visible.'); return; }
      if (speech?.button === button) { stopSpeech(); return; }
      stopSpeech(); const utterance = new SpeechSynthesisUtterance(text); utterance.rate = 0.95; speech = { button, utterance }; button.textContent = 'Stop reading'; button.setAttribute('aria-pressed', 'true'); utterance.onend = utterance.onerror = () => { if (speech?.utterance === utterance) stopSpeech(); }; window.speechSynthesis.speak(utterance);
    }
    function readingControls(detail) {
      if (!scope() || !detail?.root) return;
      const board = detail.mysteryDetail || detail, nodes = list(board.nodes || detail.nodes);
      for (const node of nodes) {
        const cards = [...detail.root.querySelectorAll('[data-fieldwork-node],[data-story-document],[data-story-transcript]')].filter(card => [card.dataset.fieldworkNode, card.dataset.storyDocument, card.dataset.storyTranscript].includes(node.id));
        const lines = typeof node.dialogue === 'string' ? [node.dialogue] : list(node.dialogue).map(line => typeof line === 'string' ? line : `${line.speaker ? `${line.speaker}: ` : ''}${line.text || ''}`), text = [...lines, node.description, node.prompt].filter(Boolean).join('\n');
        if (!text) continue;
        for (const card of cards) {
          if (card.querySelector('[data-feel-reading]')) continue;
          const controls = document.createElement('div'); controls.className = 'ux-feel-reading'; controls.dataset.feelReading = '';
          const speak = document.createElement('button'); speak.type = 'button'; speak.dataset.feelNarrate = ''; speak.textContent = 'Read this aloud'; speak.setAttribute('aria-pressed', 'false'); speak.onclick = () => narrate(speak, text);
          const quick = document.createElement('button'); quick.type = 'button'; quick.textContent = 'Quick inspect'; quick.dataset.feelInspect = ''; quick.onclick = () => inspectText(title(node), text); controls.append(speak, quick); card.append(controls);
        }
      }
    }
    const ownedRows = () => window.createOmertaTools?.inventoryRows?.(context?.boards?.inventory || {}, []) || [];
    function preparationTray(detail) {
      if (detail.view !== 'recipes' || !detail.root) return;
      const focused = document.activeElement, focusKind = focused?.hasAttribute('data-feel-add') ? 'data-feel-add' : focused?.hasAttribute('data-feel-remove') ? 'data-feel-remove' : '', focusKey = focusKind ? focused.getAttribute(focusKind) : '';
      const recipes = list(detail.boards?.recipes?.recipes), rows = ownedRows().filter(row => row.available && row.scope === 'Account'), relevant = rows.filter(row => recipes.some(recipe => list(recipe.inputs).some(input => input.templateId === row.templateId && (input.quality || 'standard') === row.quality)));
      let host = detail.root.querySelector('[data-feel-preparation]'); if (!host) { host = document.createElement('section'); host.dataset.feelPreparation = ''; host.className = 'ux-feel-preparation'; const body = detail.root.querySelector('.fieldwork-body'); if (body) body.prepend(host); else detail.root.append(host); }
      host.innerHTML = `<h3>Preparation tray</h3><p>Drag owned materials here, or use Add. This private arrangement does not reserve, consume or craft anything.</p><div class="ux-feel-owned">${relevant.map(row => `<div draggable="true" data-feel-material="${esc(row.key)}"><b>${esc(row.title)}</b> · ${row.qty} available <button type="button" data-feel-add="${esc(row.key)}">Add to tray</button></div>`).join('') || '<p>No matching owned materials in the current inventory record. Open Inventory, then return here to load your materials.</p>'}</div><div class="ux-feel-drop" tabindex="0" aria-label="Preparation tray drop area"><ul>${[...preparation].map(([key, qty]) => { const row = rows.find(item => item.key === key); return row ? `<li>${qty} × ${esc(row.title)} <button type="button" data-feel-remove="${esc(key)}">Remove one</button></li>` : ''; }).join('') || '<li>Place materials here to compare them with recipe requirements.</li>'}</ul></div><div>${recipes.map(recipe => { const selected = list(recipe.inputs).map(input => { if (input.assetType) return (input.quantity || 0) + ' ' + input.assetType + ': choose an eligible asset with its issued control'; const held = rows.filter(row => row.templateId === input.templateId && row.quality === (input.quality || 'standard')).reduce((sum, row) => sum + (preparation.get(row.key) || 0), 0); return `${held}/${input.quantity ?? input.qty ?? 0} ${input.title || words(input.templateId || input.assetType)}`; }); return `<p><b>${esc(title(recipe))}</b>: ${esc(selected.join(' · '))}. Use its original Craft control below for the real confirmation.</p>`; }).join('')}</div>`;
      const add = key => { const row = rows.find(row => row.key === key); if (!row) return; preparation.set(key, Math.min(row.qty, (preparation.get(key) || 0) + 1)); preparationTray(detail); };
      host.querySelectorAll('[data-feel-material]').forEach(node => { node.ondragstart = event => { event.dataTransfer.setData('application/x-omerta-material', node.dataset.feelMaterial); event.dataTransfer.effectAllowed = 'copy'; }; });
      host.querySelectorAll('[data-feel-add]').forEach(button => { button.onclick = () => add(button.dataset.feelAdd); });
      host.querySelectorAll('[data-feel-remove]').forEach(button => { button.onclick = () => { const key = button.dataset.feelRemove, next = (preparation.get(key) || 0) - 1; next ? preparation.set(key, next) : preparation.delete(key); preparationTray(detail); }; });
      const drop = host.querySelector('.ux-feel-drop'); drop.ondragover = event => { if ([...event.dataTransfer.types].includes('application/x-omerta-material')) event.preventDefault(); }; drop.ondrop = event => { event.preventDefault(); add(event.dataTransfer.getData('application/x-omerta-material')); };
      if (focusKind) [...host.querySelectorAll(`[${focusKind}]`)].find(button => button.getAttribute(focusKind) === focusKey)?.focus({ preventScroll: true });
    }
    function quickInspect(detail) {
      const root = detail.root;
      root.querySelectorAll('.fieldwork-item,.fieldwork-blockers').forEach(card => { if (card.querySelector('[data-feel-quick]')) return; const text = card.textContent.trim(); if (!text) return; const button = document.createElement('button'); button.type = 'button'; button.dataset.feelQuick = ''; button.textContent = 'Inspect record'; button.onclick = () => inspectText(card.querySelector('h3')?.textContent || 'Requirements', text); card.append(button); });
    }
    function desk() {
      const active = panel(); if (!active || !['start', 'den', 'fieldwork', 'speakeasy'].includes(state().currentTab) || active.querySelector('[data-feel-desk]')) return;
      const host = document.createElement('details'); host.dataset.feelDesk = ''; host.dataset.uxPanel = 'room-desk'; host.className = 'ux-feel-desk'; host.innerHTML = '<summary>A moment at your desk · cosmetic only</summary><div class="ux-feel-desktop"><button type="button" data-feel-lamp aria-pressed="false">Desk lamp</button><button type="button" data-feel-record aria-pressed="false">Turn the record</button><div class="ux-feel-coaster-track"><button type="button" data-feel-coaster aria-label="Slide the coaster" title="Drag, or use left and right arrow keys">◉</button></div><p data-feel-desk-status role="status">No cost, reward or gameplay effect.</p></div>'; active.append(host);
      const status = host.querySelector('[data-feel-desk-status]');
      host.querySelector('[data-feel-lamp]').onclick = () => { preferences.warmth = preferences.warmth > 50 ? 25 : 80; save('Turn private desk lamp'); apply(); status.textContent = preferences.warmth > 50 ? 'A warmer circle of lamplight.' : 'The lamp settles to a low glow.'; };
      host.querySelector('[data-feel-record]').onclick = event => { const on = event.currentTarget.getAttribute('aria-pressed') !== 'true'; event.currentTarget.setAttribute('aria-pressed', String(on)); event.currentTarget.classList.toggle('ux-feel-record-turn', on && !reduce() && !quiet()); status.textContent = on ? 'The record turns in your hand. Cosmetic only.' : 'The record rests in its sleeve.'; };
      const puck = host.querySelector('[data-feel-coaster]'), track = host.querySelector('.ux-feel-coaster-track'), update = value => { coaster = Math.max(0, Math.min(88, value)); puck.style.left = `${coaster}%`; status.textContent = 'The coaster slides across the desk. Cosmetic only.'; };
      puck.onpointerdown = event => { puck.setPointerCapture(event.pointerId); }; puck.onpointermove = event => { if (!puck.hasPointerCapture(event.pointerId)) return; const rect = track.getBoundingClientRect(); update((event.clientX - rect.left) / rect.width * 100 - 6); }; puck.onpointerup = event => { if (puck.hasPointerCapture(event.pointerId)) puck.releasePointerCapture(event.pointerId); }; puck.onkeydown = event => { if (['ArrowLeft', 'ArrowRight'].includes(event.key)) { event.preventDefault(); update(coaster + (event.key === 'ArrowLeft' ? -8 : 8)); } }; puck.style.left = `${coaster}%`; apply(); document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));
    }
    function loadingPaint() {
      document.querySelectorAll('[data-feel-loading]').forEach(node => node.remove());
      const active = panel(), reads = [...loading.values()].filter(read => read.accountId === owner && read.tab === state().currentTab); if (!owner || !active || !reads.length) return;
      const host = document.createElement('aside'); host.dataset.feelLoading = ''; host.className = 'ux-feel-loading'; host.setAttribute('role', 'status');
      const map = ['map', 'city'].includes(state().currentTab), inventory = ['garage', 'fieldwork', 'life'].includes(state().currentTab);
      host.innerHTML = `<span>Reading ${esc(state().tabs?.[state().currentTab] || words(state().currentTab))} records…</span><div aria-hidden="true" class="ux-feel-silhouette ${map ? 'ux-feel-silhouette-map' : inventory ? 'ux-feel-silhouette-cards' : 'ux-feel-silhouette-rows'}">${Array.from({ length: map ? 6 : 3 }, () => '<i></i>').join('')}</div>`; active.prepend(host);
    }
    function connected(targetNode) {
      if (!source || Date.now() - sourceAt > 6000 || !preferences.connections || reduce() || quiet()) return;
      const target = targetNode || panel()?.querySelector('h1,h2,h3,summary'); if (!target) return; const destination = target.getBoundingClientRect(), start = source; source = null;
      const mote = document.createElement('span'); mote.className = 'ux-feel-connection'; mote.setAttribute('aria-hidden', 'true'); mote.style.left = `${start.x}px`; mote.style.top = `${start.y}px`;
      if (start.label) { mote.classList.add('ux-feel-connection-object'); mote.dataset.feelConnectionObject = start.label; if (start.image) { const image = document.createElement('img'); image.src = start.image; image.alt = ''; mote.append(image); } const label = document.createElement('b'); label.textContent = start.label; mote.append(label); }
      (inspect?.open ? inspect : document.body).append(mote);
      const animation = mote.animate([{ transform: 'translate(0,0) scale(1)', opacity: .8 }, { transform: `translate(${destination.left - start.x + 12}px,${destination.top - start.y + 12}px) scale(.4)`, opacity: 0 }], { duration: 360, easing: 'cubic-bezier(.2,.8,.2,1)' }); animation.onfinish = animation.oncancel = () => mote.remove();
    }
    function recordOperation(receipt, before, after, result) {
      if (!scope() || !preferences.panorama || !/^\/v1\/travel\//.test(receipt.path || '') || result?.code >= 400 || !result?.body?.ok || !after?.loc || before?.id !== after?.id) return;
      const location = after.loc, plate = art[location]; if (!plate) return;
      arrival?.remove(); arrival = document.createElement('aside'); arrival.className = 'ux-feel-arrival'; arrival.dataset.feelArrival = ''; arrival.setAttribute('aria-label', 'Confirmed arrival');
      const name = list(state().rules?.districts).find(district => district.id === location)?.name || words(location);
      arrival.innerHTML = `<img src="/art/${plate}.jpg" alt="Illustrated view of ${esc(name)}"><div><small>CONFIRMED ARRIVAL</small><h2>${esc(name)}</h2><p>${esc(words(before.loc))} → ${esc(name)} · actual fare $${Number(result.body.cost || 0).toLocaleString()}</p><p>Your ride has already completed. You can continue using the city immediately.</p><button type="button">Close arrival view</button></div>`; document.body.append(arrival); arrival.querySelector('button').onclick = () => { arrival.remove(); arrival = null; }; if (!reduce() && !quiet()) arrival.classList.add('ux-feel-arrival-enter');
    }
    document.addEventListener('pointerdown', event => { const control = event.target.closest('button,a,[role="button"]'); if (!control || control.disabled) return; if (scope() && preferences.tactile && !reduce() && !quiet()) { control.classList.add('ux-feel-pressed'); const clear = () => { control.classList.remove('ux-feel-pressed'); document.removeEventListener('pointerup', clear); document.removeEventListener('pointercancel', clear); }; document.addEventListener('pointerup', clear, { once: true }); document.addEventListener('pointercancel', clear, { once: true }); } }, { passive: true });
    document.addEventListener('click', event => {
      const control = event.target.closest('[data-tab],[data-jump],[data-ux-go],[data-world-go],.bn,.grp,[data-fieldwork-mystery],[data-fieldwork-action],[data-feel-inspect],[data-feel-quick]'); if (!control) return;
      const card = control.closest('[data-fieldwork-case],[data-fieldwork-node],.fieldwork-item,.ux-npc-memory'), rect = control.getBoundingClientRect();
      source = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, label: card?.querySelector('h3,h4')?.textContent.trim().slice(0, 85) || '', image: card?.querySelector('img')?.getAttribute('src') || '', object: card?.dataset.fieldworkCase || card?.dataset.fieldworkNode || '' }; sourceAt = Date.now();
    }, true);
    document.addEventListener('keydown', event => { if (event.key === 'Escape') { stopSpeech(); arrival?.remove(); arrival = null; } if (['Enter', ' '].includes(event.key) && event.target.matches('button') && preferences.tactile && !reduce() && !quiet()) { event.target.classList.add('ux-feel-pressed'); setTimeout(() => event.target.classList.remove('ux-feel-pressed'), 120); } });
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopSpeech(); });
    document.addEventListener('omerta:fieldwork-before-render', stopSpeech);
    document.addEventListener('omerta:fieldwork-rendered', event => {
      if (!scope()) return; context = event.detail; readingControls(event.detail); preparationTray(event.detail); quickInspect(event.detail);
      const graphId = context.mysteryDetail?.graphId || context.mysteryDetail?.graph?.id;
      if (!context.loading && !context.busy && source?.label && source.object && context.view === 'mysteries' && graphId === source.object) connected(context.root.querySelector('.fieldwork-case__heading h2'));
    });
    document.addEventListener('omerta:story-rendered', event => readingControls(event.detail));
    document.addEventListener('omerta:workspace-undo', event => { if (event.detail?.namespace === 'feel') { preferences = normalize(workspace?.get?.('feel', {}) || {}); apply(); } });
    function render() {
      if (!scope()) { document.querySelector('[data-feel-open]')?.remove(); document.querySelectorAll('[data-feel-loading],[data-feel-desk]').forEach(node => node.remove()); return; }
      if (!preview) preferences = normalize(workspace?.get?.('feel', {}) || {});
      const host = document.querySelector('#ux-workspace-toolbar .ux-workspace-controls') || document.getElementById('top');
      let button = document.querySelector('[data-feel-open]'); if (host && !button) { button = document.createElement('button'); button.type = 'button'; button.className = 'act'; button.dataset.feelOpen = ''; button.textContent = 'Room'; button.title = 'Optional room atmosphere and soundscape'; button.onclick = openSettings; }
      if (host && button && button.parentElement !== host) host.append(button);
      desk(); apply(); loadingPaint();
      panel()?.querySelectorAll('.ux-npc-memory').forEach(card => { if (card.querySelector('[data-feel-quick]')) return; const text = card.textContent.trim(), button = document.createElement('button'); button.type = 'button'; button.dataset.feelQuick = ''; button.textContent = 'Inspect recorded dealing'; button.onclick = () => inspectText(card.querySelector('h4')?.textContent || 'Recorded dealing', text); card.append(button); });
    }
    return { render, recordOperation, afterRender() { render(); if (previousTab !== state().currentTab) { stopSpeech(); connected(); previousTab = state().currentTab; } }, readStarted(read) { scope(); if (read?.id && read.accountId === owner) { loading.set(read.id, read); loadingPaint(); } }, readFinished(read) { loading.delete(read?.id); loadingPaint(); }, reloadWorkspace() { scope(); preferences = normalize(workspace?.get?.('feel', {}) || {}); apply(); render(); }, open: openSettings };
  }
  window.createOmertaFeel = create;
})();
