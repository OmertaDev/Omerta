/* Crew-authored culture, consent, and recorded history. No automatic public or private messages. */
(() => {
 'use strict';
 const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
 const route = '/v1/ux/community', mentorRoute = '/v1/ux/mentor-subjects';
 const list = (v) => Array.isArray(v) ? v : [];
 const local = (v) => new Date(v).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
 const crestSvg = (d) => {
  const shapes = { shield: 'M20 12h120v72q0 48-60 66Q20 132 20 84Z', diamond: 'M80 8 150 80 80 152 10 80Z', circle: 'M80 10a70 70 0 1 1 0 140 70 70 0 0 1 0-140' };
  const symbols = { key: '⚿', star: '★', laurel: '❧', crown: '♛' };
  const primary = /^#[0-9a-f]{6}$/i.test(d?.primary) ? d.primary : '#1e262b', secondary = /^#[0-9a-f]{6}$/i.test(d?.secondary) ? d.secondary : '#d3b16c';
  return `<svg class="ux-community-crest" viewBox="0 0 160 180" role="img" aria-label="Cosmetic crew crest"><path d="${shapes[d?.shape] || shapes.shield}" fill="${primary}" stroke="${secondary}" stroke-width="4"/><text x="80" y="100" text-anchor="middle" font-size="66" fill="${secondary}">${symbols[d?.symbol] || symbols.key}</text><text x="80" y="174" text-anchor="middle" font-size="10" fill="currentColor">${esc(d?.motto || '')}</text></svg>`;
 };
 window.createOmertaCommunity = ({ getState, read, navigate, notify, action, workspace }) => {
  let account = '', character = '', epoch = 0, board = null, mentors = null, loading = false, mentorLoading = false, loaded = 0, mentorLoaded = 0, busy = false, queued = false, manualRows = 1;
  let error = '', preview = null, playback = null, playIndex = 0, playTimer = null;
  const drafts = new Map(), bases = new Map(), disclosures = new Map();
  let lastFocus = null;
  const currentAccount = () => String(getState().session?.accountId || getState().me?.accountId || getState().me?.id || '');
  const currentCharacter = () => String(getState().me?.id || '');
  const context = () => ({ account, character, epoch });
  const current = (requested) => requested.account === currentAccount() && requested.character === currentCharacter() && requested.epoch === epoch;
  const stop = () => { if (playTimer) clearInterval(playTimer); playTimer = null; };
  const reset = () => { const next = currentAccount(), actor = currentCharacter(); if (next !== account || actor !== character) { stop(); account = next; character = actor; epoch++; board = null; mentors = null; loading = mentorLoading = busy = queued = false; loaded = 0; mentorLoaded = 0; error = ''; preview = null; playback = null; playIndex = 0; manualRows = 1; lastFocus = null; drafts.clear(); bases.clear(); disclosures.clear(); document.querySelectorAll('[data-community-host]').forEach((n) => n.remove()); } };
  const prefs = () => workspace?.get('community', { revealed: [] }) || { revealed: [] };
  const formKey = (f) => `${f.dataset.communityForm}:${f.dataset.subject || ''}`;
  const disclosureKey = (d) => { const f = d.querySelector(':scope > form[data-community-form]'); return f ? `form:${formKey(f)}` : d.dataset.communitySpoiler ? `spoiler:${d.dataset.communitySpoiler}` : `section:${d.querySelector(':scope > summary')?.textContent}`; };
  const fieldKey = (f, field) => `${formKey(f)}:${field.name}${field.name === 'participant' ? ':' + field.value : ''}`;
  const click = (root, selector, handler) => { const node = root.querySelector(selector); if (node) node.onclick = handler; };
  const field = (label, name, max, value = '', multiline = false, required = true) => `<label>${esc(label)}${multiline ? `<textarea name="${name}" maxlength="${max}"${required ? ' required' : ''}>${esc(value)}</textarea>` : `<input name="${name}" maxlength="${max}" value="${esc(value)}"${required ? ' required' : ''}>`}</label>`;
  const checkbox = (label, name, checked = false) => `<label class="ux-community-check"><input name="${name}" type="checkbox"${checked ? ' checked' : ''}> ${esc(label)}</label>`;
  const form = (type, title, content, label, subject = '') => `<details class="ux-community-compose"><summary>${esc(title)}</summary><form data-community-form="${type}" data-subject="${esc(subject)}">${content}<button type="submit" class="act">${esc(label)}</button></form></details>`;
  const spoiler = (text, marked, id) => marked ? `<details class="ux-community-spoiler" data-community-spoiler="${esc(id)}"${list(prefs().revealed).includes(id) ? ' open' : ''}><summary>Player-marked spoiler · reveal when ready</summary><p>${esc(text)}</p></details>` : `<p>${esc(text)}</p>`;
  const bodyValue = (field) => field.type === 'checkbox' ? field.checked : field.value;
  document.addEventListener('input', remember);
  document.addEventListener('change', remember);
  document.addEventListener('toggle', rememberDisclosure, true);
  document.addEventListener('click', rememberDisclosureIntent, true);
  document.addEventListener('focusin', rememberFocus);
  function rememberDisclosure(event) {
   const d = event.target, host = d.closest?.('[data-community-host]');
   if (host?.isConnected && d.matches('details')) disclosures.set(`${host.id}:${disclosureKey(d)}`, d.open);
  }
  function rememberDisclosureIntent(event) {
   const summary = event.target.closest?.('summary'), d = summary?.parentElement, host = d?.closest('[data-community-host]');
   // Native toggle fires asynchronously. Save the deliberate click before a concurrent base
   // renderer can detach this details element and discard its pending toggle event.
   if (host?.isConnected && d.matches('details') && summary === d.querySelector(':scope > summary')) disclosures.set(`${host.id}:${disclosureKey(d)}`, !d.open);
  }
  function rememberFocus(event) {
   const input = event.target, f = input.closest?.('[data-community-host] form[data-community-form]');
   lastFocus = f && input.name && input.matches('input,textarea,select') ? { form: formKey(f), name: input.name, start: input.selectionStart, end: input.selectionEnd, panel: f.closest('[data-community-host]').id } : null;
  }
  function remember(event) {
   const f = event.target.closest?.('[data-community-host] form[data-community-form]');
   if (!f || !event.target.name || !event.target.matches('input,textarea,select')) return;
   drafts.set(fieldKey(f, event.target), bodyValue(event.target));
   rememberFocus(event);
   if (['manual', 'crest'].includes(f.dataset.communityForm) && !bases.has(formKey(f))) bases.set(formKey(f), Number(f.dataset.revision || 0));
  }
  function mount(id, parent, markup) {
   if (!parent) return null;
   let root = document.getElementById(id);
   if (!root || !parent.contains(root)) { root?.remove(); root = document.createElement('section'); root.id = id; root.className = 'card ux-community'; root.dataset.communityHost = ''; parent.append(root); }
   if (root._markup === markup) return root;
   const open = [...root.querySelectorAll('details[open]')].map(disclosureKey);
   const active = document.activeElement, focusedForm = root.contains(active) ? active.closest('form[data-community-form]') : null;
   const focus = focusedForm ? { form: formKey(focusedForm), name: active.name, start: active.selectionStart, end: active.selectionEnd } : lastFocus?.panel === id && document.activeElement === document.body ? lastFocus : null;
   root.innerHTML = markup; root._markup = markup;
   root.querySelectorAll('details').forEach((d) => { const name = disclosureKey(d), key = `${id}:${name}`; if (disclosures.has(key)) d.open = disclosures.get(key); else if (open.includes(name)) d.open = true; });
   root.querySelectorAll('form[data-community-form]').forEach((f) => {
    for (const input of f.querySelectorAll('input[name],textarea[name],select[name]')) {
     const value = drafts.get(fieldKey(f, input)); if (value === undefined) continue;
     if (input.type === 'checkbox') input.checked = value; else if (input.tagName !== 'SELECT' || [...input.options].some((o) => o.value === value)) input.value = value;
    }
    if (focus?.form === formKey(f)) { const input = [...f.querySelectorAll('input,textarea,select')].find((i) => i.name === focus.name); input?.focus({ preventScroll: true }); if (focus.start != null) try { input.setSelectionRange(focus.start, focus.end); } catch {} }
   });
   return root;
  }
  function moderation(entry) { return entry.canModerate ? `<div class="row">${entry.status === 'open' ? `<button class="act" data-community-close="${esc(entry.id)}">Close conversation</button>` : ''}<button class="act" data-community-remove="${esc(entry.id)}">Remove entry</button></div>` : ''; }
  function threadMarkup(thread) {
   const replies = board.entries.filter((e) => e.anchorKind === 'thread' && e.anchorId === thread.id).sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
   return `<article class="ux-community-thread"><span class="ux-kicker">${esc(thread.anchorKind)} · ${esc(thread.data.anchorTitle)}</span><h4>${esc(thread.data.title)}</h4><small>${esc(thread.author)} · ${esc(local(thread.createdAt))}</small>${spoiler(thread.data.body, thread.data.spoiler, thread.id)}<ol class="ux-community-replies">${replies.map((r) => `<li><strong>${esc(r.author)}</strong>${r.kind === 'emote' ? ` ${esc(r.data.text)}` : `${r.data.stepTitle ? `<small>On step: ${esc(r.data.stepTitle)}</small>` : ''}${spoiler(r.data.body, r.data.spoiler, r.id)}`}</li>`).join('')}</ol>${thread.status === 'open' ? form('reply', 'Reply to this conversation', `<label>Attach to a particular planning step<select name="stepId"><option value="">General conversation</option>${list(thread.data.steps).map((s) => `<option value="${esc(s.id)}">${esc(s.title)}</option>`).join('')}</select></label>${field('Your comment', 'body', 1200, '', true)}${checkbox('Mark my comment as a spoiler', 'spoiler')}`, 'Post crew comment', thread.id) + form('emote', 'Respond in character', `<label>Choose an emote<select name="emote">${Object.entries(board.emotes).map(([id, line]) => `<option value="${id}">${esc(line)}</option>`).join('')}</select></label>`, 'Perform this emote', thread.id) : '<p>This conversation is closed.</p>'}${moderation(thread)}</article>`;
  }
  function manualMarkup() {
   const doc = board.documents.manual, sections = list(doc?.data.sections); manualRows = Math.max(manualRows, sections.length, 1);
   return `<details class="ux-community-manual"><summary>The crew field manual · player advice</summary><p>This shared document is editable by current crew members and visible to newcomers. Advice is written by players.</p>${sections.map((s, i) => `<article><h4>${esc(s.heading)}</h4>${spoiler(s.body, s.spoiler, `manual:${doc.revision}:${i}`)}</article>`).join('') || '<p>No crew advice has been added yet.</p>'}<aside><b>Official game facts</b><ul>${board.officialFacts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul></aside>${form('manual', 'Edit the shared manual', `<p>Clearing both fields removes a section. A concurrent edit requires a refresh.</p>${Array.from({ length: Math.min(8, manualRows) }, (_, i) => `${field(`Section ${i + 1} heading`, `heading${i}`, 100, sections[i]?.heading || '', false, false)}${field(`Section ${i + 1} advice`, `body${i}`, 2000, sections[i]?.body || '', true, false)}${checkbox('This section contains spoilers', `spoiler${i}`, !!sections[i]?.spoiler)}`).join('')}<button type="button" class="act" data-community-add-section${manualRows >= 8 ? ' disabled' : ''}>Add a section</button><button type="button" class="act" data-community-reload-manual>Discard my draft and load the latest manual</button>`, 'Save shared player advice')}<small>${doc ? `Revision ${doc.revision} · edited by ${esc(doc.author)}` : 'No shared revision yet'}</small></details>`;
  }
  function crestMarkup() {
   const saved = board.documents.crest, d = preview || saved?.data || { shape: 'shield', symbol: 'key', primary: '#1e262b', secondary: '#d3b16c', motto: '' };
   return `<details><summary>The crew crest · cosmetic design</summary>${crestSvg(d)}<p>${preview ? 'Your private preview' : 'Published crew design'} · a cosmetic mark that grants no power.</p>${form('crest', 'Design a crest', `<label>Shape<select name="shape">${board.crestOptions.shapes.map((s) => `<option value="${s}"${d.shape === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label>Symbol<select name="symbol">${board.crestOptions.symbols.map((s) => `<option value="${s}"${d.symbol === s ? ' selected' : ''}>${s}</option>`).join('')}</select></label><label>Primary color<input name="primary" type="color" value="${esc(d.primary)}"></label><label>Accent color<input name="secondary" type="color" value="${esc(d.secondary)}"></label>${field('Motto', 'motto', 24, d.motto, false, false)}<p>Any member may preview. The current crew leader publishes the shared design.</p>`, 'Preview this design')}${board.crew.leader ? '<button class="act" type="button" data-community-publish-crest>Publish my preview as the crew crest</button>' : ''}</details>`;
  }
  function portraitMarkup(entry) {
   const accepted = entry.participants.filter((p) => p.status === 'accepted'), mine = entry.participants.find((p) => p.mine);
   return `<article class="ux-community-portrait"><h4>${esc(entry.data.caption)}</h4><div class="ux-community-faces">${entry.participants.map((p) => `<div>${p.characterId && p.status === 'accepted' ? `<img src="/v1/avatar/${encodeURIComponent(p.characterId)}" width="80" height="80" alt="${esc(p.name)}'s consenting avatar">` : '<span class="ux-community-no-face" aria-hidden="true">?</span>'}<b>${esc(p.name)}</b><small>${p.status === 'pending' ? 'Awaiting their choice' : esc(p.status)}</small></div>`).join('')}</div><p>Invitations expire ${esc(local(entry.data.expiresAt))}. Only explicitly accepted, currently valid avatars appear in downloads.</p>${mine ? `<button type="button" class="act" data-community-consent="${esc(entry.id)}" data-accept="${mine.status !== 'accepted'}">${mine.status === 'accepted' ? 'Revoke my avatar consent' : 'I consent to include my avatar'}</button>` : ''}<button class="act" type="button" data-community-download="${esc(entry.id)}"${accepted.length < 2 ? ' disabled' : ''}>Download consenting group portrait</button></article>`;
  }
  function pinsMarkup() {
   const pins = board.entries.filter((e) => e.kind === 'pin');
   return `<div class="ux-community-map">${board.destinations.map((d) => { const here = pins.filter((p) => p.data.destinationId === d.id); return `<article><h4>${esc(d.name)}${here.length ? ` · ${here.length} planning ${here.length === 1 ? 'pin' : 'pins'}` : ''}</h4>${here.map((p) => `<div><b>${esc(p.data.title)}</b><small>${esc(p.author)} · planning at a public destination</small>${spoiler(p.data.note, p.data.spoiler, p.id)}${p.canModerate ? `<button type="button" class="act" data-community-remove="${esc(p.id)}">Remove planning pin</button>` : ''}</div>`).join('') || '<small>No crew planning pin here.</small>'}</article>`; }).join('')}</div>`;
  }
  function playbackMarkup() {
   const event = playback?.events[playIndex];
   return `<details class="ux-community-playback"><summary>Recorded operation playback</summary><label>Authorized operation<select data-community-operation>${board.anchors.operations.map((o) => `<option value="${esc(o.id)}"${playback?.operation.id === o.id ? ' selected' : ''}>${esc(o.title)} · ${esc(o.status)}</option>`).join('')}</select></label><button class="act" type="button" data-community-load-playback${board.anchors.operations.length ? '' : ' disabled'}>Load recorded events</button>${playback ? `<p>Chronological records from the server. Role-private step identities and evidence are omitted.</p><p class="ux-community-event" aria-live="polite">${event ? `${esc(local(event.at))} · ${esc(event.label)}` : 'No recorded events.'}</p><div class="row"><button class="act" data-community-back${playIndex > 0 ? '' : ' disabled'}>Previous record</button><button class="act" data-community-play>${playTimer ? 'Pause playback' : 'Play records'}</button><button class="act" data-community-next${playIndex < playback.events.length - 1 ? '' : ' disabled'}>Next record</button></div><ol>${playback.events.map((e, i) => `<li${i === playIndex ? ' aria-current="step"' : ''}>${esc(local(e.at))} · ${esc(e.label)}</li>`).join('')}</ol>` : '<p>Load an operation to play its actual recorded sequence.</p>'}</details>`;
  }
  function crewMarkup() {
   const threads = board.entries.filter((e) => e.kind === 'thread'), portraits = board.entries.filter((e) => e.kind === 'portrait');
   const anchorOptions = `<option value="question">A crew question</option>${board.anchors.operations.map((o) => `<option value="operation|${esc(o.id)}">Operation · ${esc(o.title)}</option>`).join('')}${board.anchors.plans.map((p) => `<option value="plan|${esc(p.id)}">Plan · ${esc(p.title)}</option>`).join('')}`;
   return `<header><span class="ux-kicker">${esc(board.crew.name)} · your crew's shared record</span><h3>People behind the plans</h3><p>Conversations, advice, and commemorations posted deliberately by current members.</p></header>${form('thread', 'Start an attached conversation', `<label>Attach this conversation to<select name="anchor">${anchorOptions}</select></label>${field('Conversation title', 'title', 100)}${field('Your opening question or message', 'body', 1200, '', true)}${field('Optional extra planning steps · one per line for questions or plans', 'steps', 840, '', true, false)}${checkbox('Mark my opening message as a spoiler', 'spoiler')}`, 'Start crew conversation')}<div class="ux-community-threads">${threads.map(threadMarkup).join('') || '<p>No crew conversations yet. Ask a question or attach a conversation to a current plan.</p>'}</div>${form('emote', 'Offer an in-character gesture', `<label>Your deliberate gesture<select name="emote">${Object.entries(board.emotes).map(([id, line]) => `<option value="${id}">${esc(line)}</option>`).join('')}</select></label>`, 'Perform this emote')}<ul>${board.entries.filter((e) => e.kind === 'emote' && !e.anchorId).slice(0, 8).map((e) => `<li>${esc(e.author)} ${esc(e.data.text)} <small>${esc(local(e.createdAt))}</small></li>`).join('')}</ul>${manualMarkup()}<details><summary>Crew map planning pins</summary><p>Public district destinations only. These pins do not reveal anyone's current location.</p>${pinsMarkup()}${form('pin', 'Place a public destination pin', `${field('Planning pin title', 'title', 100)}<label>Public destination<select name="destinationId">${board.destinations.map((d) => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join('')}</select></label>${field('Planning note', 'note', 400, '', true, false)}${checkbox('Mark the note as a spoiler', 'spoiler')}`, 'Post crew planning pin')}<button class="act" data-community-map>Open the public map</button></details><details><summary>Commemorative group portraits</summary><p>Each participant chooses whether their current avatar may be included. Downloaded copies capture consent when generated.</p>${form('portrait', 'Propose a group portrait', `${field('Commemorative caption', 'caption', 140)}<fieldset><legend>Invite current crewmates</legend>${board.members.filter((m) => m.characterId).map((m) => `<label class="ux-community-check"><input type="checkbox" name="participant" value="${esc(m.characterId)}"${m.mine ? ' checked disabled' : ''}>${esc(m.name)}${m.mine ? ' · you' : ''}</label>`).join('')}</fieldset>${checkbox('I consent to include my own current avatar', 'consentSelf')}`, 'Propose portrait and include my avatar')}${portraits.map(portraitMarkup).join('')}</details>${crestMarkup()}${playbackMarkup()}<button class="act" type="button" data-community-refresh>Refresh crew conversations</button>`;
  }
  function mentorMarkup() {
   const me = mentors.me;
   return `<h3>Find the right kind of help</h3><p>Subjects below are explicitly published by players for 30 days. Specialties are self-offered interests.</p>${form('mentor', 'Publish your offered subjects or help request', `${me.canOffer ? field('Topics you offer · comma-separated, up to five', 'specialties', 250, list(me.specialties).join(', '), false, false) : ''}${me.canSeek ? field('What you want help understanding', 'helpSubject', 120, me.helpSubject || '', false, false) : ''}${checkbox('Publish these chosen subjects to authenticated players for 30 days', 'publish', !!me.publishedUntil && Date.parse(me.publishedUntil) > Date.now())}`, 'Update my published subjects')}<div class="ux-community-mentor-subjects">${mentors.people.map((p) => `<article><h4>${esc(p.name)}</h4>${p.specialties.length ? `<p><b>Offers help with:</b> ${p.specialties.map(esc).join(' · ')}</p>` : ''}${p.helpSubject ? `<p><b>Asks for help with:</b> ${esc(p.helpSubject)}</p>` : ''}<small>Publication expires ${esc(local(p.publishedUntil))}</small>${me.canOffer && p.helpSubject && !p.mine ? `<button type="button" class="act" data-community-mentor-offer="${esc(p.characterId)}">Offer mentorship for this subject</button>` : ''}</article>`).join('') || '<p>No players have published active help subjects yet.</p>'}</div>`;
  }
  function paint() {
   reset(); const tab = getState().currentTab, parent = document.getElementById(`tab-${tab}`); if (!parent || !account || !character) return;
   let root;
   if (tab === 'discover' && mentors && parent.querySelector('#lfg-toggle')) root = mount('ux-community-mentors', parent, mentorMarkup());
   else if (['crew', 'fieldwork'].includes(tab) && board && (tab !== 'crew' || parent.querySelector('#crew-room'))) root = mount('ux-community', parent, crewMarkup());
   else if (tab === 'map' && board) root = mount('ux-community-pins', parent, `<h3>The crew's public planning pins</h3>${pinsMarkup()}<p>Player planning marks · public district destinations, never live player locations.</p>`);
   if (root) { bind(root); document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed')); }
  }
  async function post(body, button, draftSnapshot = [], formId = '', target = route) {
   reset(); if (busy || !account || !character) return; busy = true; if (button) button.disabled = true; const requested = context();
   try {
    const r = await action('POST', target, body, { label: target === mentorRoute ? 'Publish chosen help subjects' : 'Update crew community' });
    if (!current(requested)) return;
    if (r?.code >= 200 && r.code < 300) {
     if (target === mentorRoute) { mentors = r.body; mentorLoaded = Date.now(); } else { board = r.body; loaded = Date.now(); }
     for (const [key, value] of draftSnapshot) if (drafts.get(key) === value) drafts.delete(key);
     bases.delete(formId); if (body.type === 'crest') preview = null; notify(target === mentorRoute ? 'Your chosen help subjects are updated.' : 'The crew community record is updated.');
    } else if (r?.body?.error === 'community_conflict') notify('A crewmate updated this document. Your draft is preserved; refresh and compare before saving.', true);
   } catch { if (current(requested)) notify('The community update could not be confirmed. Your draft is preserved.', true); }
   finally { if (current(requested)) { busy = false; if (button?.isConnected) button.disabled = false; paint(); } }
  }
  function bind(root) {
   for (const f of root.querySelectorAll('form[data-community-form]')) {
    const type = f.dataset.communityForm;
    f.dataset.revision = String(board?.documents[type]?.revision || 0);
    f.onsubmit = (event) => {
     event.preventDefault(); const values = Object.fromEntries(new FormData(f)), subject = f.dataset.subject, snapshot = [...f.querySelectorAll('input[name],textarea[name],select[name]')].map((i) => [fieldKey(f, i), bodyValue(i)]);
     let body = { type };
     if (type === 'thread') { const [kind, id] = values.anchor.split('|'); body = { type, title: values.title, body: values.body, spoiler: !!values.spoiler, anchorKind: kind, ...(id ? { anchorId: id } : {}), ...(kind !== 'operation' ? { steps: String(values.steps || '').split('\n').map((s) => s.trim()).filter(Boolean) } : {}) }; }
     if (type === 'reply') body = { type, threadId: subject, body: values.body, spoiler: !!values.spoiler, ...(values.stepId ? { stepId: values.stepId } : {}) };
     if (type === 'emote') body = { type, emote: values.emote, ...(subject ? { threadId: subject } : {}) };
     if (type === 'pin') body = { type, title: values.title, destinationId: values.destinationId, note: values.note || '', spoiler: !!values.spoiler };
     if (type === 'manual') body = { type, revision: bases.get(formKey(f)) ?? Number(f.dataset.revision), sections: Array.from({ length: manualRows }, (_, i) => ({ heading: values[`heading${i}`] || '', body: values[`body${i}`] || '', spoiler: !!values[`spoiler${i}`] })).filter((s) => s.heading || s.body) };
     if (type === 'crest') { preview = { shape: values.shape, symbol: values.symbol, primary: values.primary, secondary: values.secondary, motto: values.motto || '' }; paint(); return; }
     if (type === 'portrait') body = { type, caption: values.caption, participants: [...f.querySelectorAll('[name=participant]:checked')].map((i) => i.value), consentSelf: !!values.consentSelf };
     if (type === 'mentor') { post({ specialties: String(values.specialties || '').split(',').map((s) => s.trim()).filter(Boolean), helpSubject: values.helpSubject || '', publish: !!values.publish }, f.querySelector('[type=submit]'), snapshot, formKey(f), mentorRoute); return; }
     post(body, f.querySelector('[type=submit]'), snapshot, formKey(f));
    };
   }
   click(root, '[data-community-add-section]', () => { const f = root.querySelector('[data-community-form=manual]'); if (!bases.has('manual:')) bases.set('manual:', Number(f.dataset.revision)); manualRows = Math.min(8, manualRows + 1); root._markup = ''; paint(); });
   click(root, '[data-community-reload-manual]', () => { for (const key of drafts.keys()) if (key.startsWith('manual:')) drafts.delete(key); bases.delete('manual:'); manualRows = Math.max(1, board.documents.manual?.data.sections.length || 0); root._markup = ''; loaded = 0; render(); });
   click(root, '[data-community-publish-crest]', (e) => { if (!preview) return notify('Preview your design before publishing it.'); post({ type: 'crest', revision: bases.get('crest:') ?? Number(board.documents.crest?.revision || 0), ...preview }, e.currentTarget, [...drafts].filter(([k]) => k.startsWith('crest:')), 'crest:'); });
   for (const type of ['close', 'remove']) for (const b of root.querySelectorAll(`[data-community-${type}]`)) b.onclick = () => post({ type, entryId: b.dataset[type === 'close' ? 'communityClose' : 'communityRemove'] }, b);
   for (const b of root.querySelectorAll('[data-community-consent]')) b.onclick = () => post({ type: 'consent', portraitId: b.dataset.communityConsent, accept: b.dataset.accept === 'true' }, b);
   for (const b of root.querySelectorAll('[data-community-download]')) b.onclick = async () => {
    const requested = context(), r = await read(`${route}/portraits/${encodeURIComponent(b.dataset.communityDownload)}`); if (!current(requested)) return; if (r?.code !== 200) return notify(r?.body?.message || 'The current consents could not be verified.', true);
    const url = URL.createObjectURL(new Blob([r.body.svg], { type: 'image/svg+xml' })), a = document.createElement('a'); a.href = url; a.download = 'omerta-consenting-crew-portrait.svg'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
   };
   click(root, '[data-community-map]', () => navigate('map'));
   for (const b of root.querySelectorAll('[data-community-mentor-offer]')) b.onclick = () => action('POST', `/v1/mentor/offer/${encodeURIComponent(b.dataset.communityMentorOffer)}`, {}, { label: 'Offer mentorship for a published subject' });
   click(root, '[data-community-refresh]', () => { loaded = 0; render(); });
   click(root, '[data-community-load-playback]', async () => {
    const id = root.querySelector('[data-community-operation]').value, requested = context(); if (!id) return;
    const r = await read(`${route}/operations/${encodeURIComponent(id)}/playback`); if (!current(requested)) return; if (r?.code === 200) { stop(); playback = r.body; playIndex = 0; paint(); } else notify('Those operation records could not be loaded.', true);
   });
   click(root, '[data-community-back]', () => { stop(); playIndex = Math.max(0, playIndex - 1); paint(); });
   click(root, '[data-community-next]', () => { stop(); playIndex = Math.min(playback.events.length - 1, playIndex + 1); paint(); });
   click(root, '[data-community-play]', () => { if (playTimer) stop(); else if (playback?.events.length) { if (playIndex === playback.events.length - 1) playIndex = 0; playTimer = setInterval(() => { if (playIndex >= playback.events.length - 1 || !['crew', 'fieldwork'].includes(getState().currentTab)) stop(); else playIndex++; paint(); }, 1200); } paint(); });
   for (const d of root.querySelectorAll('[data-community-spoiler]')) d.ontoggle = () => { const value = prefs(), ids = new Set(list(value.revealed)); d.open ? ids.add(d.dataset.communitySpoiler) : ids.delete(d.dataset.communitySpoiler); workspace?.set('community', { ...value, revealed: [...ids].slice(-100) }); };
  }
  async function render() {
   reset(); const tab = getState().currentTab, requested = context(); if (!account || !character) return; if (!['crew', 'fieldwork'].includes(tab)) stop();
   if (tab === 'discover' && !mentorLoading && (!mentors || Date.now() - mentorLoaded > 30000)) {
    mentorLoading = true; try { const r = await read(mentorRoute); if (current(requested) && r?.code === 200) { mentors = r.body; mentorLoaded = Date.now(); } } finally { if (current(requested)) mentorLoading = false; }
   }
   if (['crew', 'fieldwork', 'map'].includes(tab) && !loading && (!board && !loaded || Date.now() - loaded > 30000)) {
    loading = true; try { const r = await read(route); if (current(requested)) { loaded = Date.now(); if (r?.code === 200) { board = r.body; error = ''; } else error = r?.body?.message || 'Join a crew to share its community record.'; } } finally { if (current(requested)) loading = false; }
   }
   if (current(requested) && getState().currentTab === tab) paint();
  }
  function observe(path, body) {
   reset(); if (!account || !character) return;
   if (path === route && body?.crew && body.members?.some((m) => m.mine && m.characterId === character)) { board = body; loaded = Date.now(); }
   if (path === mentorRoute && body?.me?.characterId === character) { mentors = body; mentorLoaded = Date.now(); }
   if (path === '/v1/crew' && board && body?.crew?.id !== board.crew.id) { board = null; loaded = 0; document.getElementById('ux-community')?.remove(); }
   if ([route, mentorRoute].includes(path) && !queued) { const requested = context(); queued = true; requestAnimationFrame(() => { if (current(requested)) { queued = false; paint(); } }); }
  }
  return { render, observe, recordOperation(receipt, _before, _after, result) { reset(); if (result?.code >= 200 && result.code < 300 && String(receipt.path).startsWith('/v1/worldgraph/')) { loaded = 0; } }, destroy() { epoch++; stop(); document.removeEventListener('input', remember); document.removeEventListener('change', remember); document.removeEventListener('toggle', rememberDisclosure, true); document.removeEventListener('click', rememberDisclosureIntent, true); document.removeEventListener('focusin', rememberFocus); } };
 };
})();
