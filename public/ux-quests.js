/* Case files and bounded community mysteries over the issued, authoritative quest boards. */
(() => {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const el = (tag, cls, text) => { const element = document.createElement(tag); if (cls) element.className = cls; if (text != null) element.textContent = String(text); return element; };
  const words = value => String(value || '').replace(/[_:-]+/g, ' ');
  const button = (label, run, cls = '') => { const element = el('button', 'act ' + cls, label); element.type = 'button'; element.onclick = run; return element; };
  const field = (labelText, tag = 'input') => { const label = el('label', 'quest-field'), input = el(tag); label.append(el('span', '', labelText), input); input.setAttribute('aria-label', labelText); return { label, input }; };
  const option = (value, text) => { const element = el('option', '', text); element.value = value; return element; };
  const disclosure = title => { const element = el('details', 'quest-disclosure'); element.append(el('summary', '', title)); return element; };
  const encode = value => encodeURIComponent(String(value));
  const asText = value => typeof value === 'string' ? value : value == null ? '' : JSON.stringify(value);
  const safeList = value => list(value).slice(0, 120);

  window.createOmertaQuests = ({ getState, read, action, navigate, notify, workspace }) => {
    let owner = '', actor = '', epoch = 0, board = null, workshop = null, legacy = null, mystery = null, selected = '', view = 'cases';
    let root = null, districtRoot = null, loading = false, busy = false, error = '', destroyed = false, queued = false;
    let legacyReadAt = 0, districtAttemptAt = 0, requestedCase = '';
    const districtTabs = new Set(['streets', 'city', 'map', 'fieldwork']);
    const pending = new Map(), local = new Map(), openSections = new Set(), interactionDrafts = new Map();
    const state = () => getState() || {};
    const qualityUX = window.createOmertaQuestQuality?.({ getState,
      onOperation: (instance, payload, label) => mutate('/v1/content/instances/' + encode(instance.id) + '/quality', {
        expectedRevision: instance.revision, expectedQualityRevision: instance.quality.revision, ...payload,
      }, label), onSubmit: submitAction, repaint: () => paint() });
    const identity = () => [String(state().session?.accountId || state().me?.accountId || ''), String(state().me?.id || '')];
    const saved = () => workspace?.get('quests', {}) || local.get(owner) || {};
    const save = patch => { const next = { ...saved(), ...patch }; local.set(owner, next); workspace?.set('quests', next); };

    function scope() {
      const [next, character] = identity();
      if (next !== owner || character !== actor) {
        owner = next; actor = character; epoch++; board = workshop = legacy = mystery = null; selected = ''; view = 'cases';
        loading = busy = false; error = ''; legacyReadAt = districtAttemptAt = 0; requestedCase = ''; pending.clear(); openSections.clear(); interactionDrafts.clear(); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null;
        qualityUX?.reset();
      }
      return !!owner && !!actor && !destroyed;
    }
    const sameScope = (account, character, generation) => { const current = identity(); return account === current[0] && character === current[1] && epoch === generation && !destroyed; };
    function schedule() { if (queued || destroyed) return; queued = true; queueMicrotask(() => { queued = false; render(); }); }

    async function request(path) {
      if (pending.has(path)) return pending.get(path);
      const account = owner, character = actor, generation = epoch;
      const promise = Promise.resolve(read(path)).then(reply => {
        if (!sameScope(account, character, generation)) return null;
        if (!reply || reply.code < 200 || reply.code >= 300) { error = reply?.body?.message || 'The case file could not be read. Refresh to try again.'; return null; }
        error = ''; return reply.body;
      }).catch(() => { if (sameScope(account, character, generation)) error = 'The case file did not answer. Refresh to try again.'; return null; })
        .finally(() => { if (sameScope(account, character, generation)) pending.delete(path); });
      pending.set(path, promise); return promise;
    }
    async function load(force = false) {
      if (!scope() || loading) return;
      if (!force && (view === 'cases' ? board : view === 'community' ? workshop : legacy)) { paint(); return; }
      const account = owner, character = actor, generation = epoch, kind = view;
      loading = true; paint();
      const value = await request(kind === 'cases' ? '/v1/content' : kind === 'community' ? '/v1/quest-workshop' : '/v1/questing');
      if (!sameScope(account, character, generation)) return;
      if (value) { if (kind === 'cases') board = value; else if (kind === 'community') workshop = value; else { legacy = value; legacyReadAt = Date.now(); } }
      loading = false; paint();
    }
    async function mutate(path, body, label) {
      if (!scope() || busy || typeof action !== 'function') return null;
      const account = owner, character = actor, generation = epoch;
      busy = true; error = ''; paint();
      let reply;
      try {
        reply = await action('POST', path, body, { label });
        if (!sameScope(account, character, generation)) return null;
        if (!reply || reply.code < 200 || reply.code >= 300) error = reply?.body?.message || 'That move was not recorded. Review the current file before trying again.';
        else if (reply.body?.released) { selected = ''; if (board) board = { ...board, instances: list(board.instances).filter(instance => instance.id !== reply.body.instance?.id) }; }
        else if (reply.body?.instance) { selected = 'run:' + reply.body.instance.id; mergeInstance(reply.body.instance); }
        if (reply?.code >= 200 && reply.code < 300 && path.startsWith('/v1/content/')) { legacy = null; legacyReadAt = districtAttemptAt = 0; }
        if (reply?.code >= 400 && reply.body?.instance) mergeInstance(reply.body.instance);
      } catch { if (sameScope(account, character, generation)) error = 'The move could not be confirmed. Refresh the file before trying again.'; }
      finally { if (sameScope(account, character, generation)) { busy = false; paint(); } }
      if (sameScope(account, character, generation)) {
        const priorError = error;
        await load(true);
        if (priorError) { error = priorError; paint(); }
      }
      return reply;
    }
    function mergeInstance(instance) {
      if (!board) return;
      const instances = list(board.instances), index = instances.findIndex(item => item.id === instance.id);
      board = { ...board, instances: index < 0 ? [...instances, instance] : instances.map(item => item.id === instance.id ? instance : item) };
    }
    function section(id, title, content) {
      const panel = disclosure(title); panel.dataset.questSection = id; panel.open = openSections.has(id);
      panel.addEventListener('toggle', () => panel.open ? openSections.add(id) : openSections.delete(id));
      panel.append(content); return panel;
    }
    function blockers(entries) {
      const root = el('ul', 'quest-blockers');
      for (const entry of safeList(entries)) root.append(el('li', '', entry.message || entry.title || words(entry.kind || entry.code) || asText(entry)));
      return root;
    }
    function expectations(value) {
      if (!value || typeof value !== 'object') return null;
      const root = el('aside', 'quest-expectations'); root.setAttribute('aria-label', 'Quest expectations');
      if (value.durationMinutes != null) root.append(el('span', '', 'About ' + value.durationMinutes + ' minutes'));
      for (const key of ['difficulty', 'reasoning', 'combat', 'group']) if (value[key] != null) root.append(el('span', '', words(key) + ': ' + asText(value[key])));
      if (value.summary) root.append(el('p', '', value.summary));
      for (const commitment of list(value.commitments)) root.append(el('p', '', commitment));
      return root.childNodes.length ? root : null;
    }
    function entries() {
      return [
        ...list(board?.instances).map(item => ({ key: 'run:' + item.id, item, kind: 'run', label: item.title + ' · ' + words(item.status) })),
        ...list(board?.experiences).map(item => ({ key: 'case:' + item.namespace, item, kind: 'case', label: item.title + ' · ' + (item.eligible ? 'available' : 'requirements') })),
        ...list(board?.lobbies).map(item => ({ key: 'lobby:' + item.id, item, kind: 'lobby', label: item.title + ' · open seats' })),
      ];
    }
    function caseFiles() {
      const body = el('div', 'quest-files'), choices = entries();
      if (!choices.length) { body.append(el('p', 'quest-muted', 'No authored cases are active. Activated stories will appear here.')); return body; }
      if (requestedCase) { const requested = choices.find(entry => entry.kind === 'run' && entry.item.namespace === requestedCase) || choices.find(entry => entry.kind === 'case' && entry.item.namespace === requestedCase); if (requested) { selected = requested.key; requestedCase = ''; } }
      if (!choices.some(entry => entry.key === selected)) selected = choices[0].key;
      const picker = field('Case file', 'select');
      choices.forEach(entry => picker.input.append(option(entry.key, entry.label))); picker.input.value = selected;
      picker.input.onchange = () => { selected = picker.input.value; error = ''; picker.input.blur(); paint(); };
      body.append(picker.label);
      const chosen = choices.find(entry => entry.key === selected);
      body.append(el('h3', '', chosen.item.title));
      const metadata = expectations(chosen.item.expectations); if (metadata) body.append(metadata);
      if (chosen.kind === 'run') body.append(runFile(chosen.item));
      else body.append(openFile(chosen.item, chosen.kind === 'lobby'));
      return body;
    }
    function openFile(experience, joining) {
      const root = el('div'), form = el('form', 'quest-form');
      root.append(blockers(experience.blockedBy));
      const roles = list(joining ? experience.openRoles : experience.roles), role = field('Your role', 'select');
      for (const item of roles) role.input.append(option(item.id, item.title || words(item.id)));
      const scope = field('Play with', 'select');
      for (const item of list(experience.scopes)) scope.input.append(option(item, words(item)));
      const consent = el('label', 'quest-check'), check = el('input'); check.type = 'checkbox'; check.setAttribute('aria-label', 'Consent to this role');
      consent.append(check, document.createTextNode('I consent to take this role.'));
      const agendaConsent = el('label', 'quest-check'), agendaCheck = el('input'); agendaCheck.type = 'checkbox'; agendaCheck.setAttribute('aria-label', 'Opt in to a private agenda');
      agendaConsent.append(agendaCheck, document.createTextNode('I opt in to a private agenda that may differ from my partners’ objectives.'));
      const invited = field('Invited account IDs · separate with commas or new lines', 'textarea'); invited.input.maxLength = 1800;
      const syncRole = () => { const current = roles.find(item => item.id === role.input.value), invitation = (joining ? experience.scopeKind : scope.input.value) === 'invitation'; consent.hidden = !current?.consentRequired && !invitation; agendaConsent.hidden = !current?.agendaConsentRequired; invited.label.hidden = joining || !invitation; }; syncRole(); role.input.onchange = syncRole; scope.input.onchange = syncRole;
      if (!joining) form.append(scope.label, invited.label); form.append(role.label, consent, agendaConsent);
      const submit = button(joining ? 'Join this case' : 'Open this case'); submit.type = 'submit';
      submit.disabled = busy || !roles.length || (!joining && (!list(experience.scopes).length || experience.eligible === false));
      form.append(submit);
      form.onsubmit = async event => {
        event.preventDefault(); const current = roles.find(item => item.id === role.input.value), invitation = (joining ? experience.scopeKind : scope.input.value) === 'invitation';
        const needsConsent = current?.consentRequired || invitation;
        if (needsConsent && !check.checked) { error = 'This role needs your consent before joining.'; paint(); return; }
        if (current?.agendaConsentRequired && !agendaCheck.checked) { error = 'This role needs your opt-in to its private agenda.'; paint(); return; }
        const payload = joining ? { expectedRevision: experience.revision, roleId: role.input.value } : { scopeKind: scope.input.value, roleId: role.input.value };
        if (needsConsent) payload.consent = true;
        if (current?.agendaConsentRequired) payload.agendaConsent = true;
        if (invitation && !joining) payload.invitedAccountIds = invited.input.value.split(/[\s,]+/).filter(Boolean);
        await mutate(joining ? '/v1/content/instances/' + encode(experience.id) + '/join' : '/v1/content/' + encode(experience.namespace) + '/instances', payload, joining ? 'Join case role' : 'Open authored case');
      };
      root.append(form); return root;
    }
    function evidenceCard(entry) {
      const root = el('article', 'quest-evidence');
      root.append(el('strong', '', entry.title || words(entry.key || entry.id)), el('p', '', entry.text || entry.summary || asText(entry.value)));
      if (entry.source) root.append(el('small', 'quest-muted', 'Source: ' + entry.source));
      return root;
    }
    function visitCase(namespace) {
      requestedCase = namespace; view = 'cases'; error = ''; navigate?.('desk');
      if (state().currentTab === 'desk') { paint(); load(); }
    }
    function paintDistrictAftermath() {
      const current = state(), district = current.me?.loc, tab = current.currentTab;
      const scenes = list(legacy?.districtScenes).filter(scene => scene.scope === 'personal' && scene.districtId === district);
      const host = districtTabs.has(tab) && district ? document.getElementById('tab-' + tab) : null;
      if (!host || !scenes.length) { districtRoot?.remove(); districtRoot = null; return; }
      const signature = JSON.stringify([owner, actor, district, scenes]);
      if (districtRoot?.isConnected && districtRoot.parentElement === host && districtRoot.dataset.signature === signature) return;
      districtRoot?.remove(); districtRoot = el('aside', 'quest-district-aftermath'); districtRoot.id = 'ux-quest-aftermath'; districtRoot.dataset.uxPanel = 'quest-aftermath'; districtRoot.dataset.signature = signature;
      districtRoot.setAttribute('aria-label', 'Your story in this district');
      districtRoot.append(el('span', 'quest-kicker', 'From your casebook · ' + words(district)));
      for (const scene of scenes.slice(0, 6)) {
        const record = el('article'); record.dataset.questAftermath = scene.id;
        record.append(el('h3', '', scene.title), el('p', '', scene.text));
        if (scene.followupNamespace) record.append(button('Revisit the printshop case', () => visitCase(scene.followupNamespace)));
        districtRoot.append(record);
      }
      districtRoot.append(el('small', 'quest-muted', 'Personal aftermath · remembered from your recorded decisions.'));
      host.prepend(districtRoot); document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));
    }
    async function loadDistrictMemory() {
      const now = Date.now();
      if ((legacy && now - legacyReadAt < 60000) || pending.has('/v1/questing') || now - districtAttemptAt < 60000) return;
      districtAttemptAt = now; const account = owner, character = actor, generation = epoch;
      const value = await request('/v1/questing');
      if (!sameScope(account, character, generation)) return;
      if (value) { legacy = value; legacyReadAt = Date.now(); }
      paintDistrictAftermath();
    }
    function journal(instance) {
      const root = el('div', 'quest-journal');
      const known = list(instance.nodes).filter(node => node.state === 'completed' && ['evidence', 'world_fact'].includes(node.type));
      const confirmed = list(instance.journal?.confirmed).length ? instance.journal.confirmed : [...known.filter(node => node.evidenceKind !== 'testimony'), ...list(instance.facts)];
      const testimony = list(instance.journal?.testimony).length ? instance.journal.testimony : known.filter(node => node.evidenceKind === 'testimony');
      for (const [id, title, values] of [['confirmed', 'Confirmed evidence', confirmed], ['testimony', 'Witness testimony', testimony]]) {
        const content = el('div', 'quest-evidence-grid');
        if (!values.length) content.append(el('p', 'quest-muted', id === 'testimony' ? 'No witness account has been recorded.' : 'Completed evidence will be filed here.'));
        values.forEach(entry => content.append(evidenceCard(entry)));
        root.append(section(instance.id + ':' + id, title + ' · ' + values.length, content));
      }
      const theories = el('div'), drafts = saved().theories || {}, note = field('Your private working theory', 'textarea');
      note.input.maxLength = 1200; note.input.value = drafts[instance.id] || '';
      theories.append(el('p', 'quest-muted', 'Your theory is a private note. It does not mark evidence as true or complete the case.'), note.label,
        button('Save private theory', () => { save({ theories: { ...(saved().theories || {}), [instance.id]: note.input.value.slice(0, 1200) } }); notify?.('Your private theory was saved.'); }));
      root.append(section(instance.id + ':theory', 'Your working theory', theories));
      if (Array.isArray(instance.journal) && instance.journal.length) {
        const recorded = el('ol', 'quest-recorded-steps');
        for (const entry of instance.journal) { const step = el('li'); step.append(el('strong', '', entry.title || words(entry.kind))); if (entry.summary) step.append(el('p', '', entry.summary)); if (entry.outcome) step.append(el('small', 'quest-muted', words(entry.outcome))); recorded.append(step); }
        root.append(section(instance.id + ':recorded', 'Recorded casework', recorded));
      }
      return root;
    }
    function recap(instance) {
      const root = el('aside', 'quest-recap'); root.setAttribute('aria-label', 'Case checkpoint');
      root.append(el('strong', '', 'Where you left off'));
      const supplied = instance.recap;
      if (instance.recapText) root.append(el('p', '', instance.recapText));
      else if (typeof supplied === 'string' && supplied) root.append(el('p', '', supplied));
      else if (supplied?.summary) root.append(el('p', '', supplied.summary));
      else {
        const completed = list(instance.nodes).filter(node => node.state === 'completed' && (node.summary || node.title)).slice(-3);
        if (completed.length) { const steps = el('ul'); completed.forEach(node => steps.append(el('li', '', node.summary || node.title))); root.append(steps); }
        else root.append(el('p', '', instance.status === 'forming' ? 'The case is waiting for its required roles to begin.' : 'No completed step is recorded yet.'));
      }
      const next = list(instance.actions).filter(action => action.kind !== 'start_instance');
      if (next.length) root.append(el('p', '', 'Next: ' + next.map(action => action.title || words(action.kind)).join(' · ')));
      root.append(el('small', 'quest-muted', 'Progress is saved by the game after each recorded move.'));
      return root;
    }
    function runFile(instance) {
      const root = el('div', 'quest-run'); root.dataset.questInstance = instance.id;
      root.append(recap(instance));
      if (instance.quality) { const workbench = qualityUX?.render(instance); if (workbench) root.append(workbench); }
      if (instance.agenda?.prompt) { const agenda = el('aside', 'quest-private-agenda'); agenda.append(el('strong', '', 'Your private agenda'), el('p', '', instance.agenda.prompt), el('small', 'quest-muted', instance.agenda.completed ? 'Your objective is recorded as complete.' : 'This objective is private until the case debrief.')); root.append(agenda); }
      if (instance.suspicion != null) {
        const value = typeof instance.suspicion === 'object' ? instance.suspicion.value ?? instance.suspicion.current : instance.suspicion;
        const meter = el('div', 'quest-suspicion'); meter.setAttribute('role', 'status');
        meter.append(el('strong', '', 'Suspicion: ' + (value ?? asText(instance.suspicion))));
        if (instance.suspicion?.description) meter.append(el('p', '', instance.suspicion.description)); root.append(meter);
      }
      root.append(journal(instance));
      if (instance.scopeKind !== 'personal') root.append(sharedNotes(instance));
      if (instance.status === 'completed') {
        root.append(el('p', 'quest-complete', 'Case closed. Your decisions are on the record.'));
        for (const award of list(instance.awards?.mine)) root.append(el('p', '', (award.title || words(award.kind)) + ' · ' + words(award.state)));
        if (list(instance.awards?.mine).some(award => award.state === 'pending')) root.append(button('Claim my case record', () => mutate('/v1/content/instances/' + encode(instance.id) + '/claim', { expectedRevision: instance.revision }, 'Claim case record')));
        if (!instance.quality && list(instance.debrief).length) { const debrief = el('div'); for (const entry of instance.debrief) debrief.append(el('p', '', (entry.name || words(entry.roleId)) + ': ' + entry.prompt + ' · ' + (entry.completed ? 'Objective fulfilled' : 'Objective not fulfilled'))); root.append(section(instance.id + ':debrief', 'The party’s private perspectives', debrief)); }
      } else {
        for (const item of list(instance.actions)) root.append(issuedAction(instance, item));
        if (!list(instance.actions).length) root.append(el('p', 'quest-muted', 'No move is issued to your role yet. Another contribution may be needed.'));
        if (instance.canReleaseRole) { const release = el('aside', 'quest-release'); release.append(el('p', 'quest-muted', 'Release your seat to make room for a replacement. Your completed contributions and shared notes remain in the file; a replacement receives their own role’s issued information.'), button('Release my seat for a replacement', () => mutate('/v1/content/instances/' + encode(instance.id) + '/release', { expectedRevision: instance.revision }, 'Release my case role'))); root.append(release); }
      }
      return root;
    }
    function sharedNotes(instance) {
      const content = el('div');
      content.append(el('p', 'quest-muted', 'Notes are shared with the case participants. Share only information you want the whole party to read.'));
      for (const note of list(instance.notes)) { const article = el('article', 'quest-case-note'); article.append(el('strong', '', note.name || note.author || 'Case participant'), el('p', '', note.text)); content.append(article); }
      if (instance.status === 'active') {
        const form = el('form', 'quest-form'), note = field('Shared case handoff', 'textarea'); note.input.required = true; note.input.maxLength = 500;
        const submit = button('Post shared handoff'); submit.type = 'submit'; submit.disabled = busy; form.append(note.label, submit);
        form.onsubmit = event => { event.preventDefault(); mutate('/v1/content/instances/' + encode(instance.id) + '/notes', { expectedRevision: instance.revision, text: note.input.value }, 'Post shared case handoff'); }; content.append(form);
      }
      return section(instance.id + ':notes', 'Shared case notes · ' + list(instance.notes).length, content);
    }
    function submitAction(instance, item, payload, label) {
      return mutate('/v1/content/instances/' + encode(instance.id) + '/act', { expectedRevision: instance.revision, actionId: item.id, ...payload }, label || item.title || 'Continue case');
    }
    function issuedAction(instance, item) {
      const root = el('section', 'quest-action'); root.dataset.questAction = item.id; if (item.nodeId) root.dataset.questNode = item.nodeId;
      root.append(el('span', 'quest-kicker', item.interaction ? words(item.interaction.kind) : words(item.kind)), el('h4', '', item.title || 'Continue the case'));
      if (instance.quality && item.spotlight?.title) root.append(el('p', 'quest-muted', item.spotlight.title + ' has the spotlight; any participant can volunteer.'));
      if (item.prompt) root.append(el('p', 'quest-prompt', item.prompt));
      if (item.feedback) { const feedback = el('p', 'quest-attempt-feedback', item.feedback); feedback.setAttribute('role', 'status'); root.append(feedback); }
      if (item.kind === 'start_instance') root.append(button('Start the case', () => submitAction(instance, item, {}, 'Start the case')));
      else if (item.kind === 'choose' && instance.quality && qualityUX) root.append(qualityUX.choice(instance, item));
      else if (item.kind === 'choose') {
        const choices = el('div', 'quest-choices');
        for (const choice of list(item.options)) {
          const wrap = el('div'), pick = button(choice.label, () => submitAction(instance, item, { choiceId: choice.id }, choice.label));
          pick.disabled = busy || choice.available === false; wrap.append(pick, blockers(choice.blockedBy)); choices.append(wrap);
        }
        root.append(choices);
      } else if (item.submissionKind === 'proof_sets') {
        if (instance.quality && qualityUX) root.append(qualityUX.interaction(instance, item));
        else root.append(el('p', 'quest-muted', 'The evidence-backed deduction interface could not be opened. Refresh the case file.'));
      } else if (item.interaction) root.append(interactionForm(instance, item));
      else if (item.kind === 'solve') {
        const form = el('form', 'quest-form'), answer = field('Your answer'); answer.input.required = true; answer.input.autocomplete = 'off'; answer.input.maxLength = 2000;
        const draftKey = instance.id + ':' + item.nodeId; answer.input.value = interactionDrafts.get(draftKey)?.answer || '';
        answer.input.oninput = () => interactionDrafts.set(draftKey, { answer: answer.input.value });
        const submit = button('Submit answer'); submit.type = 'submit'; submit.disabled = busy; form.append(answer.label, submit);
        form.onsubmit = event => { event.preventDefault(); submitAction(instance, item, { answer: answer.input.value }, 'Submit case answer'); }; root.append(form);
      }
      const hints = list(item.hints || item.revealedHints);
      if (hints.length || item.hintsAvailable || Number(item.hintsRemaining) > 0) {
        const content = el('div'); hints.forEach((hint, index) => content.append(el('p', '', 'Hint ' + (index + 1) + ': ' + asText(hint))));
        if (item.hintsAvailable || Number(item.hintsRemaining) > 0) { const next = button(hints.length ? 'Ask for a stronger hint' : 'Ask for a small hint', () => submitAction(instance, item, { hint: true }, 'Request case hint')); next.disabled = busy; content.append(next); }
        root.append(section(instance.id + ':hint:' + item.nodeId, 'Optional hints', content));
      }
      root.querySelectorAll('button[type=button]').forEach(control => { if (busy) control.disabled = true; });
      return root;
    }
    function interactionForm(instance, item) {
      const interaction = item.interaction, items = list(interaction.items), form = el('form', 'quest-form quest-interaction');
      const kind = item.submissionKind || (list(interaction.slots).length ? 'mapping' : interaction.kind === 'timeline' ? 'ordered_ids' : 'unordered_ids');
      const draftKey = instance.id + ':' + item.nodeId, draft = interactionDrafts.get(draftKey) || {};
      const selectedIds = list(draft.ids).filter(id => items.some(candidate => candidate.id === id)), assignments = new Map();
      let submission;
      if (kind === 'mapping') {
        const grid = el('div', 'quest-mapping');
        for (const slot of list(interaction.slots)) {
          const entry = field(slot.label, 'select'); entry.input.required = true; entry.input.append(option('', 'Choose an item'));
          for (const candidate of items) entry.input.append(option(candidate.id, candidate.label));
          if (items.some(candidate => candidate.id === draft.assignments?.[slot.id])) entry.input.value = draft.assignments[slot.id];
          entry.input.onchange = () => interactionDrafts.set(draftKey, { assignments: Object.fromEntries([...assignments].map(([id, input]) => [id, input.value])) });
          assignments.set(slot.id, entry.input); grid.append(entry.label);
        }
        const descriptions = el('ul', 'quest-item-descriptions');
        for (const candidate of items) if (candidate.description) descriptions.append(el('li', '', candidate.label + ': ' + candidate.description));
        form.append(grid, descriptions); submission = () => ({ assignments: Object.fromEntries([...assignments].map(([id, input]) => [id, input.value])) });
      } else {
        const choices = el('fieldset', 'quest-item-choices'); choices.append(el('legend', '', kind === 'ordered_ids' ? 'Select evidence, then arrange its order' : 'Select the evidence to use'));
        const sequence = el('ol', 'quest-sequence'); sequence.setAttribute('aria-label', 'Your evidence order');
        const paintSequence = () => {
          interactionDrafts.set(draftKey, { ids: [...selectedIds] });
          sequence.replaceChildren();
          selectedIds.forEach((id, index) => {
            const entry = el('li'), title = items.find(candidate => candidate.id === id)?.label || id;
            entry.append(el('span', '', title));
            const up = button('Move ' + title + ' earlier', () => { [selectedIds[index - 1], selectedIds[index]] = [selectedIds[index], selectedIds[index - 1]]; paintSequence(); sequence.querySelectorAll('li')[index - 1]?.querySelector('button')?.focus(); }, 'quest-order-button');
            const down = button('Move ' + title + ' later', () => { [selectedIds[index + 1], selectedIds[index]] = [selectedIds[index], selectedIds[index + 1]]; paintSequence(); sequence.querySelectorAll('li')[index + 1]?.querySelector('button')?.focus(); }, 'quest-order-button');
            up.disabled = index === 0; down.disabled = index === selectedIds.length - 1; entry.append(up, down); sequence.append(entry);
          });
        };
        for (const candidate of items) {
          const label = el('label', 'quest-item'), check = el('input'); check.type = 'checkbox'; check.value = candidate.id; check.checked = selectedIds.includes(candidate.id);
          label.append(check, el('span', '', candidate.label)); if (candidate.description) label.append(el('small', '', candidate.description));
          check.onchange = () => { const index = selectedIds.indexOf(candidate.id); if (check.checked && index < 0) selectedIds.push(candidate.id); else if (!check.checked && index >= 0) selectedIds.splice(index, 1); paintSequence(); };
          choices.append(label);
        }
        form.append(choices); if (kind === 'ordered_ids') form.append(sequence); paintSequence();
        submission = () => ({ ids: [...selectedIds] });
      }
      const submit = button('Test this deduction'); submit.type = 'submit'; submit.disabled = busy; form.append(submit);
      form.onsubmit = event => { event.preventDefault(); submitAction(instance, item, { submission: submission() }, 'Test ' + words(interaction.kind)); };
      return form;
    }
    function workshopPanel() {
      const root = el('div', 'quest-workshop');
      root.append(el('p', 'quest-muted', 'Write a small mystery with the city’s approved suspects, scenes, and clues. The workshop checks that its evidence identifies one culprit before publication.'));
      if (!workshop) return root;
      const compose = el('div'); compose.append(builder()); root.append(section('workshop:builder', 'Write a community mystery', compose));
      const own = el('div', 'quest-community-grid');
      for (const record of list(workshop.mine)) {
        const card = el('article', 'quest-community-card'); card.append(el('h4', '', record.title), el('p', 'quest-muted', words(record.status)));
        const scene = list(workshop.scenes).find(item => item.id === record.sceneId), culprit = list(workshop.suspects).find(item => item.id === record.culpritId);
        if (scene) card.append(el('p', '', 'Scene: ' + scene.label));
        if (culprit) card.append(el('p', '', 'Your culprit: ' + culprit.label));
        const evidence = el('ul'); for (const id of list(record.clueIds)) { const clue = list(workshop.clues).find(item => item.id === id); if (clue) evidence.append(el('li', '', clue.text)); } card.append(evidence);
        if (record.status === 'draft') { const publish = button('Publish ' + record.title, () => mutate('/v1/quest-workshop/' + encode(record.id) + '/publish', {}, 'Publish community mystery')); publish.disabled = busy; card.append(publish); }
        own.append(card);
      }
      if (!own.childNodes.length) own.append(el('p', 'quest-muted', 'Your authored mysteries will appear here.'));
      root.append(section('workshop:mine', 'Your mysteries · ' + list(workshop.mine).length, own));
      const published = el('div', 'quest-community-grid');
      for (const record of list(workshop.published)) {
        const card = el('article', 'quest-community-card'); card.append(el('h4', '', record.title), el('p', '', 'By ' + record.authorCredit), el('p', 'quest-muted', (record.solved ? 'Solved · ' : '') + (Number(record.ratings) ? Number(record.rating).toFixed(1) + ' / 5 · ' + record.ratings + ' ratings' : 'No ratings yet')),
          button('Investigate ' + record.title, async () => { const value = await request('/v1/quest-workshop/' + encode(record.id)); if (value?.mystery) { mystery = value.mystery; paint(); } })); published.append(card);
      }
      if (!published.childNodes.length) published.append(el('p', 'quest-muted', 'No community mysteries have been published yet.'));
      root.append(el('h3', '', 'Community cases'), published);
      if (mystery) root.append(communityCase(mystery));
      return root;
    }
    function builder() {
      const form = el('form', 'quest-form'), title = field('Mystery title'), template = field('Story template', 'select'), scene = field('Scene', 'select'), culprit = field('Culprit', 'select');
      title.input.required = true; title.input.maxLength = 80; title.input.minLength = 3;
      list(workshop.templates).forEach(item => template.input.append(option(item.id, item.title)));
      list(workshop.scenes).forEach(item => scene.input.append(option(item.id, item.label)));
      list(workshop.suspects).forEach(item => culprit.input.append(option(item.id, item.label)));
      form.append(title.label, template.label, scene.label, culprit.label);
      const clues = el('fieldset', 'quest-item-choices'); clues.append(el('legend', '', 'Evidence available to the solver · choose two to six clues'));
      for (const clue of list(workshop.clues)) {
        const label = el('label', 'quest-item'), check = el('input'); check.type = 'checkbox'; check.value = clue.id; check.name = 'clueId'; label.append(check, el('span', '', clue.text)); clues.append(label);
      }
      form.append(clues); const submit = button('Save mystery draft'); submit.type = 'submit'; submit.disabled = busy; form.append(submit);
      form.onsubmit = async event => {
        event.preventDefault(); const clueIds = [...clues.querySelectorAll('input:checked')].map(input => input.value);
        const reply = await mutate('/v1/quest-workshop', { title: title.input.value, templateId: template.input.value, sceneId: scene.input.value, culpritId: culprit.input.value, clueIds }, 'Save community mystery');
        if (reply?.code >= 200 && reply.code < 300) { openSections.add('workshop:mine'); notify?.('Your mystery draft was saved. Review it in Your mysteries before publication.'); paint(); }
      };
      return form;
    }
    function communityCase(record) {
      const root = el('article', 'quest-community-case'); root.dataset.questCommunityCase = record.id;
      const isAuthor = list(workshop?.mine).some(item => item.id === record.id);
      root.append(el('span', 'quest-kicker', 'Community mystery'), el('h3', '', record.title), el('p', 'quest-muted', 'By ' + record.authorCredit), el('p', '', record.setup), el('p', '', typeof record.scene === 'object' ? record.scene.label : record.scene));
      const clues = el('ul', 'quest-evidence-list'); for (const clue of list(record.clues)) clues.append(el('li', '', typeof clue === 'string' ? clue : clue.text)); root.append(clues, el('p', 'quest-prompt', record.question));
      if (isAuthor) root.append(el('p', 'quest-muted', 'You authored this case. Other players can solve and rate your mystery.'));
      else if (record.solved) root.append(el('p', 'quest-complete', 'Your solution is recorded.'));
      else {
        const form = el('form', 'quest-form'), suspect = field('Your suspect', 'select');
        list(record.suspects).forEach(item => suspect.input.append(option(item.id, item.label)));
        const submit = button('Submit solution'); submit.type = 'submit'; submit.disabled = busy; form.append(suspect.label, submit);
        form.onsubmit = async event => { event.preventDefault(); const reply = await mutate('/v1/quest-workshop/' + encode(record.id) + '/solve', { suspectId: suspect.input.value }, 'Solve community mystery'); if (reply?.code >= 200 && reply.code < 300) { const value = await request('/v1/quest-workshop/' + encode(record.id)); if (value?.mystery) mystery = value.mystery; if (reply.body?.message) notify?.(reply.body.message, !reply.body.solved); paint(); } };
        root.append(form);
      }
      if (record.solved && !isAuthor) {
        const form = el('form', 'quest-form'), stars = field('Your rating', 'select');
        for (let value = 1; value <= 5; value++) stars.input.append(option(String(value), value + (value === 1 ? ' star' : ' stars')));
        stars.input.value = String(record.myRating || 5); const submit = button('Save rating'); submit.type = 'submit'; submit.disabled = busy; form.append(stars.label, submit);
        form.onsubmit = async event => { event.preventDefault(); const reply = await mutate('/v1/quest-workshop/' + encode(record.id) + '/rate', { stars: Number(stars.input.value) }, 'Rate community mystery'); if (reply?.code >= 200 && reply.code < 300) { mystery = { ...mystery, ...reply.body }; notify?.('Your rating was saved.'); paint(); } }; root.append(form);
      }
      return root;
    }
    function legacyPanel() {
      const root = el('div', 'quest-legacy'); if (!legacy) return root;
      const reputation = legacy.reputation || {};
      root.append(el('h3', '', reputation.title || 'Your casework reputation'), el('p', '', Number(reputation.distinctCases || 0) + ' distinct cases recorded'));
      if (Array.isArray(reputation.categories)) for (const category of reputation.categories) root.append(el('span', 'quest-reputation-category', category));
      else for (const [kind, count] of Object.entries(reputation.categories || {})) root.append(el('span', 'quest-reputation-category', words(kind) + ': ' + count));
      const relationships = el('div', 'quest-evidence-grid');
      for (const relationship of list(legacy.relationships)) { const entry = el('article', 'quest-evidence'); entry.append(el('strong', '', relationship.name), el('p', '', relationship.summary), el('small', 'quest-muted', words(relationship.state))); relationships.append(entry); }
      if (relationships.childNodes.length) root.append(section('legacy:relationships', 'People who remember you', relationships));
      const scenes = el('div');
      for (const scene of list(legacy.districtScenes)) { const entry = el('article', 'quest-evidence'); entry.append(el('strong', '', scene.title), el('small', 'quest-muted', words(scene.districtId) + ' · your personal aftermath'), el('p', '', scene.text)); if (scene.followupNamespace) entry.append(button('Open the follow-up file', () => { selected = 'case:' + scene.followupNamespace; view = 'cases'; load(); })); scenes.append(entry); }
      if (scenes.childNodes.length) root.append(section('legacy:scenes', 'What changed in the city', scenes));
      if (legacy.nemesis) { const adversary = el('article', 'quest-evidence'); adversary.append(el('strong', '', legacy.nemesis.name), el('p', '', legacy.nemesis.response)); if (legacy.nemesis.followupNamespace) adversary.append(button('Follow the rival’s next move', () => { selected = 'case:' + legacy.nemesis.followupNamespace; view = 'cases'; load(); })); root.append(section('legacy:nemesis', 'A rival is paying attention', adversary)); }
      for (const service of list(legacy.services)) {
        const entry = el('article', 'quest-service'); entry.append(el('h4', '', service.title), el('p', '', service.summary));
        if (!service.unlocked) { entry.append(el('p', 'quest-muted', 'This service has not been unlocked.')); if (service.unlockNamespace) entry.append(button('Find the unlocking case', () => { selected = 'case:' + service.unlockNamespace; view = 'cases'; load(); })); }
        if (service.exercise) {
          const exercise = service.exercise; entry.append(el('h4', '', exercise.title), el('p', 'quest-prompt', exercise.prompt));
          if (exercise.solved) entry.append(el('p', 'quest-complete', 'Practice deduction solved.'));
          else {
            const form = el('form', 'quest-form'), choices = el('fieldset', 'quest-item-choices'); choices.append(el('legend', '', 'Choose your evidence'));
            for (const item of list(exercise.items)) { const label = el('label', 'quest-item'), check = el('input'); check.type = 'checkbox'; check.value = item.id; label.append(check, el('span', '', item.label)); choices.append(label); }
            const submit = button('Test reading-room deduction'); submit.type = 'submit'; submit.disabled = busy; form.append(choices, submit);
            form.onsubmit = async event => { event.preventDefault(); const ids = [...choices.querySelectorAll('input:checked')].map(input => input.value); const reply = await mutate('/v1/questing/practice', { exerciseId: exercise.id, ids }, 'Practice case deduction'); if (reply?.body?.message) notify?.(reply.body.message, !reply.body.solved); }; entry.append(form);
          }
        }
        root.append(entry);
      }
      return root;
    }
    function paint() {
      if (!scope() || state().currentTab !== 'desk') return;
      const host = document.getElementById('tab-desk'); if (!host) return;
      if (!root || !root.isConnected || !host.contains(root)) { root?.remove(); root = el('section', 'ux-quests'); root.id = 'ux-quests'; root.dataset.uxPanel = 'quests'; host.append(root); }
      if (root.contains(document.activeElement) && document.activeElement.matches('input,textarea,select') && !busy) return;
      const header = el('header', 'quest-heading'); header.append(el('span', 'quest-kicker', 'Bureau of unfinished business'), el('h2', '', 'Your case files'));
      const controls = el('nav', 'quest-tabs'); controls.setAttribute('aria-label', 'Quest tools');
      for (const [id, title] of [['cases', 'Case files'], ['community', 'Community mysteries'], ['legacy', 'Your history']]) { const tab = button(title, () => { view = id; error = ''; load(); }); tab.setAttribute('aria-pressed', String(view === id)); tab.disabled = busy || loading; controls.append(tab); }
      const refresh = button('Refresh quest files', () => load(true)); refresh.disabled = loading || busy; controls.append(refresh);
      const nodes = [header, controls];
      if (error) { const alert = el('p', 'quest-error', error); alert.setAttribute('role', 'alert'); nodes.push(alert); }
      if (loading && !(view === 'cases' ? board : view === 'community' ? workshop : legacy)) nodes.push(el('p', 'quest-muted', 'Opening the file…'));
      else nodes.push(view === 'cases' ? caseFiles() : view === 'community' ? workshopPanel() : legacyPanel());
      root.replaceChildren(...nodes); root.setAttribute('aria-busy', String(loading || busy));
      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));
    }
    function observe(path, body) {
      if (!scope()) return;
      if (path === '/v1/content') { const stamp = value => JSON.stringify([value?.storyFlags, list(value?.instances).map(instance => [instance.id, instance.status])]); if (stamp(board) !== stamp(body)) { legacy = null; legacyReadAt = districtAttemptAt = 0; } board = body; schedule(); }
      else if (/^\/v1\/content\/instances\/[^/]+$/.test(path) && body?.instance) { mergeInstance(body.instance); schedule(); }
      else if (path === '/v1/quest-workshop') { workshop = body; schedule(); }
      else if (path === '/v1/questing') { legacy = body; legacyReadAt = Date.now(); schedule(); }
      else if (path === '/v1/me') schedule();
    }
    function render() {
      if (!scope()) return;
      paintDistrictAftermath();
      if (districtTabs.has(state().currentTab)) { loadDistrictMemory(); return; }
      if (state().currentTab !== 'desk') return;
      paint(); if (!(view === 'cases' ? board : view === 'community' ? workshop : legacy) && !loading && !error) load();
    }
    const openQualityCase = event => {
      if (!scope() || !list(board?.instances).some(instance => instance.id === event.detail?.instanceId && instance.quality)) return;
      selected = 'run:' + event.detail.instanceId; view = 'cases'; paint();
      const target = root?.querySelector('.quest-quality-heading h4');
      if (target) { target.tabIndex = -1; target.focus(); target.scrollIntoView({ block: 'start' }); }
    };
    document.addEventListener('omerta:quality-case', openQualityCase);
    return { render, observe, reloadWorkspace() { if (scope()) { paint(); paintDistrictAftermath(); } }, destroy() { destroyed = true; epoch++; pending.clear(); qualityUX?.reset(); document.removeEventListener('omerta:quality-case', openQualityCase); root?.remove(); root = null; districtRoot?.remove(); districtRoot = null; } };
  };
})();
