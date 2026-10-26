/* Crew planning is explicit metadata. The issued operation controls remain authoritative. */
(() => {
  'use strict';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const words = (v) => String(v || '').replace(/[_:-]+/g, ' ');
  const path = '/v1/ux/crew-workspace';
  window.createOmertaCoordination = ({ getState, read, navigate, notify, action }) => {
    let account = '', character = '', epoch = 0, crewId, observedAt = 0, observeAllowed = true, board = null, loadedAt = 0, loading = false, busy = false, scope = 'crew', pendingFrame = false, unavailable = '';
    const drafts = new Map();
    const localTime = (v) => new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
    const key = () => String(getState().session?.accountId || getState().me?.accountId || getState().me?.id || '');
    const actor = () => String(getState().me?.id || '');
    const context = () => ({ account, character, epoch });
    const current = (requested) => requested.account === key() && requested.character === actor() && requested.epoch === epoch;
    const reset = () => { const next = key(), nextActor = actor(); if (next !== account || nextActor !== character) { account = next; character = nextActor; epoch++; crewId = undefined; observedAt = 0; observeAllowed = true; board = null; loading = busy = false; loadedAt = 0; scope = 'crew'; unavailable = ''; drafts.clear(); document.getElementById('ux-coordination')?.remove(); } };
    const schedule = () => { if (['crew', 'fieldwork'].includes(getState().currentTab) && !pendingFrame) { pendingFrame = true; requestAnimationFrame(() => { pendingFrame = false; render(); }); } };
    const accept = (body, freshRead = false) => {
      const at = Date.parse(body?.serverTime) || 0;
      if (at < observedAt) return false;
      if (body?.available === false && body.reason === 'no_crew' && body.crew === null) {
        epoch++; crewId = null; observedAt = at; observeAllowed = false; board = null; loadedAt = Date.now(); loading = busy = false; scope = 'crew'; unavailable = body.message || 'Join a crew to use its planning room.'; schedule(); return true;
      }
      if (!body?.crew || !body.members?.some((member) => member.mine && member.characterId === character)) return false;
      if (observedAt && (!freshRead && at === observedAt || !observeAllowed && at <= observedAt)) return false;
      if (!freshRead && (!observeAllowed || crewId !== undefined && crewId !== body.crew.id)) return false;
      crewId = body.crew.id; observedAt = at; observeAllowed = true; board = body; loadedAt = Date.now(); unavailable = ''; return true;
    };
    const draftKey = (type, name, subject = scope) => `${account}:${crewId || 'none'}:${type === 'presence' ? 'crew' : subject}:${type}:${name}`;
    const rememberDraft = (event) => {
      const field = event.target, form = field.closest?.('#ux-coordination form[data-coord-form]');
      if (!form || !field.name || !field.matches('input,select,textarea')) return;
      drafts.set(draftKey(form.dataset.coordForm, field.name), field.value);
    };
    document.addEventListener('input', rememberDraft);
    document.addEventListener('change', rememberDraft);
    const operation = () => board?.operations?.find((o) => o.id === scope);
    const subjectBody = () => scope === 'crew' ? {} : { operationId: scope };
    const row = (title, content) => `<div class="ux-coord-block"><h4>${esc(title)}</h4>${content}</div>`;
    const scopeSelect = () => `<label>Planning for<select data-coord-scope><option value="crew">The crew</option>${(board?.operations || []).map((o) => `<option value="${esc(o.id)}"${scope === o.id ? ' selected' : ''}>${esc(o.title)} · ${esc(o.status)}</option>`).join('')}</select></label>`;
    const form = (type, title, content, button) => `<details class="ux-coord-form"><summary>${esc(title)}</summary><form data-coord-form="${type}">${content}<button type="submit" class="act">${esc(button)}</button></form></details>`;
    const signals = (kind) => (board?.signals || []).filter((s) => s.kind === kind && s.subjectId === (kind === 'presence' ? 'crew' : scope));
    const own = (kind) => signals(kind).find((s) => s.mine);
    const field = (label, name, max, value = '', multiline = false, required = true) => `<label>${esc(label)}${multiline ? `<textarea name="${name}" maxlength="${max}"${required ? ' required' : ''}>${esc(value)}</textarea>` : `<input name="${name}" maxlength="${max}" value="${esc(value)}"${required ? ' required' : ''}>`}</label>`;
    const shareText = (note) => {
      const d = note.data;
      if (note.kind === 'help') return `[Crew help] ${d.title}. Next: ${d.nextStep || 'Open the planning room'}`.slice(0, 240);
      if (['handoff', 'debrief'].includes(note.kind)) return `[Crew ${note.kind}] ${d.title}: ${d.status}; ${d.contributionCount} recorded contributions; ${(d.awaitedSteps || []).length} shared steps pending.`.slice(0, 240);
      if (note.kind === 'clue') return `[Shared lead] ${d.title} · ${d.status}. Reference in the crew planning room.`.slice(0, 240);
      return `[Crew planning] ${d.title} · Open the crew planning room to ${['poll', 'availability'].includes(note.kind) ? 'vote' : 'review the next step'}.`.slice(0, 240);
    };
    function operationPanel() {
      const op = operation();
      if (!op) return `<p class="d">Choose a shared operation above to see its issued roles, open positions, and next shared step.</p><button type="button" class="act" data-coord-journal>Open Quest Journal</button>`;
      const pending = op.summary.awaitedSteps || [];
      return `<div class="ux-coord-roles">${op.roles.map((r) => `<div><strong>${esc(r.title)}</strong><span class="chip ${r.filled ? 'good' : ''}">${r.filled ? 'Filled' : 'Open position'}</span><small>${r.contributions} recorded contributions</small></div>`).join('')}</div><p><b>${['forming', 'active'].includes(op.status) ? 'Awaiting' : 'Shared steps left unfinished'}:</b> ${pending.length ? pending.slice(0, 3).map(esc).join(' · ') : 'No pending shared steps on the issued board.'}</p><p class="d">Planning signals do not assign roles or reserve resources. Use the issued controls in the Quest Journal.</p><button type="button" class="act" data-coord-journal>Open operation controls</button>`;
    }
    function memberSignals() {
      const ready = own('readiness'), pledge = own('pledge'), presence = own('presence');
      return row('Ready check', `<p>${signals('readiness').map((s) => `<span class="chip">${esc(s.name)} · ${esc(words(s.data.value))}</span>`).join(' ') || 'No one has marked readiness for this plan.'}</p>${form('readiness', 'Set your readiness', `<label>Your status<select name="value"><option value="ready"${ready?.data.value === 'ready' ? ' selected' : ''}>Ready</option><option value="waiting"${ready?.data.value === 'waiting' ? ' selected' : ''}>Waiting on a step</option><option value="not_ready"${ready?.data.value === 'not_ready' ? ' selected' : ''}>Not ready</option></select></label>${field('Optional note', 'note', 240, ready?.data.note || '', false, false)}`, 'Save my readiness')}`)
        + row('Contribution pledges', `<p class="d">Nonbinding intentions. Nothing is transferred, held, or reserved.</p><ul>${signals('pledge').map((s) => `<li>${esc(s.name)} intends ${Number(s.data.quantity).toLocaleString()} ${esc(s.data.what)}</li>`).join('') || '<li>No pledges for this plan yet.</li>'}</ul>${form('pledge', 'Set your pledge', `${field('What you intend to contribute', 'what', 80, pledge?.data.what || '')}<label>Quantity<input type="number" name="quantity" min="0" max="1000000" step="1" value="${Number(pledge?.data.quantity || 1)}" required></label>`, 'Save nonbinding pledge')}`)
        + row('Working presence', `<p class="d">Only explicit check-ins appear here. This is not online tracking.</p><ul>${signals('presence').map((s) => `<li><b>${esc(s.name)}</b> · ${esc(s.data.message)}<small>Check-in expires ${esc(localTime(s.expiresAt))}</small></li>`).join('') || '<li>No current check-ins.</li>'}</ul>${form('presence', 'Check in for a while', `${field('What you want the crew to know', 'message', 100, presence?.data.message || '')}<label>Expire after<select name="minutes"><option value="10">10 minutes</option><option value="30">30 minutes</option><option value="60">60 minutes</option></select></label>`, 'Publish my timed check-in')}${presence ? '<button type="button" class="act" data-coord-clear-presence>End my check-in</button>' : ''}`);
    }
    function composers() {
      const op = operation(), leads = (op?.nodes || []).filter((n) => ['evidence', 'operation_step'].includes(n.type) && n.status === 'completed');
      return form('plan', 'Start a plan', `${field('Plan title', 'title', 100)}${field('The next action to coordinate', 'nextStep', 240, '', true, false)}`, 'Post plan')
        + form('help', 'Draft an actionable help request', `${field('What you need help with', 'title', 100)}${field('Context you choose to share', 'details', 600, '', true)}${field('A concrete next step', 'nextStep', 240, '', true)}`, 'Post help request')
        + form('poll', 'Ask the crew to choose', `${field('Planning question', 'title', 100)}${field('Choices · one per line, 2–6 choices', 'options', 480, '', true)}<label>Voting closes in<select name="minutes"><option value="30">30 minutes</option><option value="60">1 hour</option><option value="240">4 hours</option><option value="1440">24 hours</option></select></label>`, 'Open planning poll')
        + form('availability', 'Find a time together', `${field('Availability question', 'title', 100, 'When can we meet?')}<p class="d">Enter 2–6 times in your local time. Members see each option in their own timezone.</p>${[0, 1, 2].map((i) => `<label>Time option ${i + 1}${i === 2 ? ' (optional)' : ''}<input type="datetime-local" name="slot${i}"${i < 2 ? ' required' : ''}></label>`).join('')}<small>Your timezone: ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)}</small>`, 'Open availability poll')
        + (op ? row('Shared leads and handoffs', `<p class="d">Only completed shared leads can be referenced here. Role-private evidence stays with its assigned role.</p>${leads.length ? form('clue', 'Share an authorized lead reference', `<label>Completed shared lead<select name="nodeId">${leads.map((n) => `<option value="${esc(n.id)}">${esc(n.title)}</option>`).join('')}</select></label>`, 'Post shared lead reference') : '<p>No completed shared leads are available on this operation yet.</p>'}${form('handoff', 'Prepare a handoff summary', `<label>Current crewmate<select name="targetCharacterId">${(board.members || []).filter((m) => m.characterId && !m.mine).map((m) => `<option value="${esc(m.characterId)}">${esc(m.name)}</option>`).join('')}</select></label>${field('Optional note · share only what the crew should know', 'note', 240, '', true, false)}<p class="d">The server includes the shared status, open positions, and pending shared steps. Role permissions stay unchanged.</p>`, 'Post handoff summary')}${['completed', 'canceled', 'abandoned'].includes(op.status) ? '<button type="button" class="act" data-coord-debrief>Create factual operation debrief</button>' : ''}`) : '');
    }
    function noteMarkup(note) {
      const d = note.data, closed = note.status !== 'open' || (d.closesAt && Date.parse(d.closesAt) <= Date.now()), options = d.options || d.slots;
      const vote = options ? `<div class="ux-coord-votes">${options.map((o, index) => `<button type="button" class="act" data-coord-vote="${esc(note.id)}" data-option="${index}" aria-pressed="${note.myVote === index}"${closed ? ' disabled' : ''}><span>${esc(d.slots ? localTime(o) : o)}</span><b>${Number(note.votes?.[index] || 0)} votes${note.myVote === index ? ' · your choice' : ''}</b></button>`).join('')}</div><small>${d.slots ? `Shown in ${esc(Intl.DateTimeFormat().resolvedOptions().timeZone)} · creator timezone ${esc(d.timezone)}. ` : ''}${closed ? 'Voting closed' : `Closes ${esc(localTime(d.closesAt))}`}. One current vote per crewmate; you can change yours.</small>` : '';
      const summary = ['handoff', 'debrief'].includes(note.kind) ? `<dl><div><dt>Shared status</dt><dd>${esc(d.status)}</dd></div><div><dt>Recorded contributions</dt><dd>${Number(d.contributionCount)}</dd></div><div><dt>Completed steps</dt><dd>${(d.completedSteps || []).map(esc).join(' · ') || 'None recorded'}</dd></div><div><dt>${['forming', 'active'].includes(d.status) ? 'Next shared steps' : 'Uncompleted shared steps'}</dt><dd>${(d.awaitedSteps || []).map(esc).join(' · ') || 'None pending'}</dd></div></dl>` : '';
      const preview = shareText(note);
      return `<article class="ux-coord-note"><div class="ux-coord-note-head"><span class="ux-kicker">${esc(words(note.kind))}</span><span class="chip">${esc(note.status)}</span></div><h4>${esc(d.title)}</h4><small>${esc(note.author)} · ${esc(localTime(note.createdAt))}</small>${d.details ? `<p>${esc(d.details)}</p>` : ''}${d.nextStep ? `<p><b>Next:</b> ${esc(d.nextStep)}</p>` : ''}${d.note ? `<p>${esc(d.note)}</p>` : ''}${summary}${vote}<details class="ux-coord-share"><summary>Preview a Crew Room message</summary><p>${esc(preview)}</p><button type="button" class="act" data-coord-share="${esc(preview)}">Send this message to the crew</button></details>${note.canModerate ? `<div class="row">${note.status === 'open' ? `<button type="button" class="act" data-coord-close="${esc(note.id)}">Close entry</button>` : ''}<button type="button" class="act" data-coord-remove="${esc(note.id)}">Remove entry</button></div>` : ''}</article>`;
    }
    function paint() {
      if (!['crew', 'fieldwork'].includes(getState().currentTab) || !account) return;
      const host = document.getElementById(`tab-${getState().currentTab}`); if (!host) return;
      // refresh() also calls optional renderers while the Crew renderer is still loading.
      // Wait for either settled Crew layout, including the first-player join/form view.
      if (getState().currentTab === 'crew' && !host.querySelector('#crew-room,#crew-form')) return;
      let root = document.getElementById('ux-coordination');
      if (!root || !host.contains(root)) { root?.remove(); root = document.createElement('section'); root.id = 'ux-coordination'; root.className = 'card ux-coordination'; host.append(root); }
      const focused = root.contains(document.activeElement) && document.activeElement.closest('form[data-coord-form]') ? {
        type: document.activeElement.closest('form[data-coord-form]').dataset.coordForm, name: document.activeElement.name,
        start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd,
      } : null;
      if (!board) { root._markup = ""; root.innerHTML = `<h3>Crew planning room</h3><p>${esc(unavailable || 'Opening the shared planning room…')}</p>${unavailable && crewId === null ? '<button class="act" type="button" data-coord-join>Find a crew</button> ' : ''}${unavailable ? '<button class="act" type="button" data-coord-retry>Refresh planning room</button>' : ''}`; root.querySelector('[data-coord-join]')?.addEventListener('click', () => navigate('crew')); root.querySelector('[data-coord-retry]')?.addEventListener('click', () => { loadedAt = 0; render(); }); return; }
      if (scope !== 'crew' && !board.operations.some((o) => o.id === scope)) scope = 'crew';
      const entries = board.notes.filter((n) => scope === 'crew' ? !n.operationId : n.operationId === scope);
      const markup = `<header><span class="ux-kicker">${esc(board.crew.name)} · deliberately shared</span><h3>Crew planning room</h3><p>Plans, check-ins, and intentions. The game's issued controls decide all permissions and outcomes.</p></header>${scopeSelect()}${row('Roleboard and the next step', operationPanel())}<div class="ux-coord-grid">${memberSignals()}</div><div class="ux-coord-composers">${composers()}</div><div class="ux-coord-notes">${entries.map(noteMarkup).join('') || '<p>No entries for this plan yet. Start with a plan or an actionable help request.</p>'}</div><button type="button" class="act" data-coord-retry>Refresh planning room</button>`;
      const open = [...root.querySelectorAll('details[open]')].map((d) => d.querySelector('summary')?.textContent);
      if (root._markup !== markup) {
        root.innerHTML = markup; root._markup = markup;
        root.querySelectorAll('details').forEach((d) => { if (open.includes(d.querySelector('summary')?.textContent)) d.open = true; });
        root.querySelectorAll('form[data-coord-form]').forEach((form) => form.querySelectorAll('input[name],select[name],textarea[name]').forEach((field) => {
          const value = drafts.get(draftKey(form.dataset.coordForm, field.name));
          if (value !== undefined && (field.tagName !== 'SELECT' || [...field.options].some((o) => o.value === value))) field.value = value;
        }));
        if (focused) {
          const form = [...root.querySelectorAll('form[data-coord-form]')].find((f) => f.dataset.coordForm === focused.type);
          const field = [...(form?.querySelectorAll('input,select,textarea') || [])].find((f) => f.name === focused.name);
          field?.focus({ preventScroll: true });
          if (field && focused.start != null) try { field.setSelectionRange(focused.start, focused.end); } catch { /* Number and select controls do not have text selections. */ }
        }
      }
      bind(root);
    }
    async function submit(body, button, submittedDrafts = []) {
      if (busy) return; busy = true; if (button) button.disabled = true;
      const requested = context();
      try {
        const reply = await action('POST', path, body, { label: 'Update crew planning' });
        if (reply?.code >= 200 && reply.code < 300 && current(requested) && accept(reply.body, true)) {
          for (const [fieldKey, value] of submittedDrafts) if (drafts.get(fieldKey) === value) drafts.delete(fieldKey);
          notify('The shared planning room is updated.');
        }
      } catch { if (current(requested)) notify('The planning update could not be confirmed. Refresh the room before trying again.', true); }
      finally { if (current(requested)) { busy = false; if (button?.isConnected) button.disabled = false; paint(); } }
    }
    function bind(root) {
      root.querySelector('[data-coord-scope]').onchange = (e) => { scope = e.target.value; root._markup = ''; paint(); };
      root.querySelectorAll('[data-coord-journal]').forEach((b) => { b.onclick = () => navigate('fieldwork'); });
      root.querySelectorAll('[data-coord-retry]').forEach((b) => { b.onclick = () => { loadedAt = 0; render(); }; });
      root.querySelectorAll('[data-coord-form]').forEach((f) => { f.onsubmit = (event) => {
        event.preventDefault(); const values = Object.fromEntries(new FormData(f)), type = f.dataset.coordForm;
        let body = { type, ...values, ...subjectBody() };
        if (['pledge', 'presence', 'poll'].includes(type)) { const k = type === 'pledge' ? 'quantity' : 'minutes'; body[k] = Number(body[k]); }
        if (type === 'presence') delete body.operationId;
        if (type === 'poll') body.options = values.options.split('\n').map((v) => v.trim()).filter(Boolean);
        if (type === 'availability') { body = { type, title: values.title, slots: [values.slot0, values.slot1, values.slot2].filter(Boolean).map((v) => new Date(v).toISOString()), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone, ...subjectBody() }; }
        const submittedDrafts = [...f.querySelectorAll('input[name],select[name],textarea[name]')].map((field) => [draftKey(type, field.name), field.value]);
        submit(body, f.querySelector('button[type=submit]'), submittedDrafts);
      }; });
      const clearPresence = root.querySelector('[data-coord-clear-presence]'), debrief = root.querySelector('[data-coord-debrief]');
      if (clearPresence) clearPresence.onclick = (e) => submit({ type: 'presence', message: '', minutes: 0 }, e.currentTarget);
      if (debrief) debrief.onclick = (e) => submit({ type: 'debrief', operationId: scope }, e.currentTarget);
      root.querySelectorAll('[data-coord-vote]').forEach((b) => { b.onclick = () => submit({ type: 'vote', noteId: b.dataset.coordVote, option: Number(b.dataset.option) }, b); });
      for (const type of ['close', 'remove']) root.querySelectorAll(`[data-coord-${type}]`).forEach((b) => { b.onclick = () => submit({ type, noteId: b.dataset[type === 'close' ? 'coordClose' : 'coordRemove'] }, b); });
      root.querySelectorAll('[data-coord-share]').forEach((b) => { b.onclick = async () => {
        if (busy) return; busy = true; b.disabled = true;
        try { const r = await action('POST', '/v1/crew/chat', { text: b.dataset.coordShare }, { label: 'Send crew planning message' }); if (r?.code >= 200 && r.code < 300) { b.textContent = 'Sent to the Crew Room'; notify('Your previewed message is in the Crew Room.'); } else b.disabled = false; }
        finally { busy = false; }
      }; });
    }
    async function render() {
      reset(); if (!account || !character || !['crew', 'fieldwork'].includes(getState().currentTab)) return;
      if (!loading && ((!board && !loadedAt) || Date.now() - loadedAt > 30000)) {
        loading = true; const requested = context(), tab = getState().currentTab;
        try { const reply = await read(path); if (!current(requested)) return; loadedAt = Date.now(); if (reply?.code >= 200 && reply.code < 300) accept(reply.body, true); else unavailable = reply?.body?.message || 'Join a crew to use the shared planning room.'; }
        catch { if (current(requested)) { unavailable = 'The planning room could not load. Try refreshing it.'; loadedAt = Date.now(); } }
        finally { if (current(requested)) loading = false; }
        if (!current(requested) || tab !== getState().currentTab) return;
      }
      paint();
    }
    function observe(url, body) {
      reset();
      if (!account || !character) return;
      if (url === path) accept(body);
      if (url === '/v1/crew' && crewId !== (body?.crew?.id || null)) { epoch++; crewId = body?.crew?.id || null; observeAllowed = false; board = null; loading = busy = false; loadedAt = 0; unavailable = ''; }
      if (url === path || url === '/v1/crew' || String(url).startsWith('/v1/worldgraph/')) schedule();
    }
    return { render, observe, recordOperation(receipt, _before, _after, result) { if (result?.code >= 200 && result.code < 300 && String(receipt?.path).startsWith('/v1/worldgraph/')) { loadedAt = 0; render(); } } };
  };
})();
