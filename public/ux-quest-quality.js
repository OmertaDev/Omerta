/* Revealed casework, private drafts and explicit commitments over the quality API. */
(() => {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const text = value => typeof value === 'string' ? value : '';
  const el = (tag, cls, value) => { const node = document.createElement(tag); if (cls) node.className = cls; if (value != null) node.textContent = String(value); return node; };
  const button = (label, run) => { const node = el('button', 'act', label); node.type = 'button'; node.onclick = run; return node; };
  const field = (labelText, tag = 'input') => { const label = el('label', 'quest-field'), input = el(tag); input.setAttribute('aria-label', labelText); label.append(el('span', '', labelText), input); return { label, input }; };
  const option = (id, label) => { const node = el('option', '', label); node.value = id; return node; };
  const check = (labelText, checked = false) => { const label = el('label', 'quest-check'), input = el('input'); input.type = 'checkbox'; input.checked = checked; input.setAttribute('aria-label', labelText); label.append(input, el('span', '', labelText)); return { label, input }; };
  const caption = value => el('p', 'quest-muted', value);
  const same = (first, second) => JSON.stringify(first) === JSON.stringify(second);

  window.createOmertaQuestQuality = ({ getState, onOperation, onSubmit, repaint }) => {
    const drafts = new Map(), impressions = new Map(), proofDrafts = new Map(), opened = new Map();
    let identity = '';
    function scope() {
      const state = getState?.() || {}, next = JSON.stringify([state.session?.accountId || state.me?.accountId, state.me?.id, state.me?.generation]);
      if (next !== identity) { reset(); identity = next; }
    }
    function reset() { drafts.clear(); impressions.clear(); proofDrafts.clear(); opened.clear(); identity = ''; }
    const participants = instance => list(instance.quality?.participants);
    const person = (instance, id) => participants(instance).find(candidate => candidate.id === id)?.name || 'A case participant';
    const evidenceName = (quality, id) => list(quality.evidence).find(candidate => candidate.id === id)?.title || id;
    function section(instance, id, title, content, initiallyOpen = false) {
      const key = instance.id + ':' + id, node = el('details', 'quest-disclosure quest-quality-section');
      node.dataset.qualitySection = id; node.open = opened.has(key) ? opened.get(key) : initiallyOpen;
      node.append(el('summary', '', title), content);
      node.addEventListener('toggle', () => opened.set(key, node.open));
      return node;
    }
    function currentDraft(instance) {
      const saved = instance.quality.draft || { text: '', evidenceIds: [] };
      let draft = drafts.get(instance.id);
      if (!draft || (!draft.dirty && !same(draft.saved, saved))) {
        draft = { text: text(saved.text), evidenceIds: [...list(saved.evidenceIds)], conclusionId: text(saved.conclusionId), saved: structuredClone(saved), dirty: false };
        drafts.set(instance.id, draft);
      }
      return draft;
    }
    async function operate(instance, operation, payload, label, success) {
      const reply = await onOperation(instance, { operation, ...payload }, label);
      if (reply?.code >= 200 && reply.code < 300 && reply.body?.instance) success?.(reply.body.instance);
      repaint?.();
      return reply;
    }
    function preview(host, title, lines, commit, blocker = '') {
      host.replaceChildren();
      const box = el('aside', 'quest-quality-preview'); box.setAttribute('aria-label', title);
      const heading = el('strong', '', title); heading.tabIndex = -1; box.append(heading);
      for (const line of lines) box.append(el('p', 'quest-quality-verbatim', line));
      box.append(caption('Review this intent. Nothing is sent until you confirm.'));
      const controls = el('div', 'quest-quality-controls');
      const confirm = button('Confirm ' + title.toLowerCase(), async () => { confirm.disabled = true; try { await commit(); } finally { confirm.disabled = false; } });
      if (blocker) { confirm.disabled = true; box.append(el('p', 'quest-blockers', blocker)); }
      controls.append(confirm, button('Keep editing · undo this intent', () => { host.replaceChildren(); host.previousElementSibling?.focus(); }));
      box.append(controls); host.append(box); heading.focus({ preventScroll: true });
    }
    function search(instance) {
      const quality = instance.quality, body = el('div'), query = field('Search your revealed questions', 'input'), results = el('div', 'quest-quality-search-results');
      query.input.type = 'search'; query.input.autocomplete = 'off'; results.setAttribute('aria-live', 'polite');
      const paint = () => {
        results.replaceChildren(); const term = query.input.value.trim().toLocaleLowerCase();
        const matches = list(quality.questions).filter(question => !term || question.text.toLocaleLowerCase().includes(term));
        if (!matches.length) results.append(caption('No revealed question matches. Unseen questions are not searched.'));
        for (const question of matches) {
          const jump = button(question.text, () => {
            const action = [...document.querySelectorAll('[data-quest-node]')].find(node => node.dataset.questNode === question.nodeId);
            const target = action?.querySelector('h4') || results;
            target.tabIndex = -1; target.focus(); target.scrollIntoView({ block: 'nearest' });
          });
          jump.dataset.qualityQuestion = question.id; results.append(jump);
        }
      };
      query.input.oninput = paint; paint(); body.append(query.label, caption('Only questions already revealed to your role appear here.'), results); return body;
    }
    function workbench(instance) {
      const quality = instance.quality, draft = currentDraft(instance), body = el('div', 'quest-quality-workbench');
      const notes = el('div'), theory = field('Your private case theory', 'textarea'), state = el('p', 'quest-muted');
      theory.input.maxLength = 4000; theory.input.value = draft.text;
      const status = () => { state.textContent = draft.dirty ? 'Unsaved changes on this device.' : 'Showing your last server-saved draft.'; };
      theory.input.oninput = () => { draft.text = theory.input.value; draft.dirty = true; status(); };
      notes.append(caption('A theory is your interpretation. It does not turn testimony into a confirmed fact.'), theory.label);
      const conclusions = [...new Map(list(instance.actions).flatMap(action => list(action.interaction?.conclusions)).map(candidate => [candidate.id, candidate])).values()];
      if (conclusions.length) {
        const conclusion = field('Your working conclusion', 'select'); conclusion.input.append(option('', 'Keep the conclusion open'));
        conclusions.forEach(candidate => conclusion.input.append(option(candidate.id, candidate.label))); conclusion.input.value = draft.conclusionId;
        conclusion.input.onchange = () => { draft.conclusionId = conclusion.input.value; draft.dirty = true; status(); }; notes.append(conclusion.label);
      }
      const controls = el('div', 'quest-quality-controls');
      controls.append(button('Save private case draft', () => operate(instance, 'save_draft', {
        text: draft.text, evidenceIds: draft.evidenceIds.filter(id => list(quality.evidence).some(record => record.id === id)),
        ...(conclusions.some(record => record.id === draft.conclusionId) ? { conclusionId: draft.conclusionId } : {}),
      }, 'Save private case draft', fresh => { drafts.delete(instance.id); currentDraft(fresh); for (const key of proofDrafts.keys()) if (key.startsWith(instance.id + ':')) proofDrafts.delete(key); })),
        button('Undo unsaved draft changes', () => { drafts.delete(instance.id); repaint?.(); }));
      status(); notes.append(controls, state);
      const evidence = el('div', 'quest-quality-evidence'); evidence.append(el('h5', '', 'Evidence beside your theory'));
      if (!list(quality.evidence).length) evidence.append(caption('No evidence has been revealed to your role.'));
      for (const record of list(quality.evidence)) {
        const card = el('article', 'quest-evidence'), selection = check('Use ' + record.title + ' in my draft', draft.evidenceIds.includes(record.id));
        selection.input.onchange = () => { draft.evidenceIds = selection.input.checked ? [...new Set([...draft.evidenceIds, record.id])] : draft.evidenceIds.filter(id => id !== record.id); draft.dirty = true; status(); };
        card.dataset.qualityEvidence = record.id; card.append(el('strong', '', record.title));
        if (record.evidenceKind) card.append(el('small', 'quest-muted', record.evidenceKind === 'testimony' ? 'Witness testimony · an attributed account' : 'Confirmed evidence'));
        card.append(el('p', 'quest-quality-verbatim', record.text), selection.label); evidence.append(card);
      }
      body.append(notes, evidence); return body;
    }
    function framing(instance) {
      const quality = instance.quality, body = el('div');
      body.append(el('h5', '', 'Known assumptions'));
      for (const assumption of list(quality.assumptions)) { const record = el('p', 'quest-quality-assumption', assumption.text); record.dataset.qualityAssumption = assumption.id; body.append(record); }
      if (!list(quality.assumptions).length) body.append(caption('No additional assumptions are stated in this brief.'));
      body.append(el('h5', '', 'Read the exact clauses'));
      for (const clause of list(quality.clauses)) {
        const card = el('article', 'quest-quality-clause'); card.dataset.qualityClause = clause.id;
        card.append(el('p', 'quest-quality-verbatim', clause.text));
        if (clause.evidenceNodeId) card.append(el('small', 'quest-muted', 'Source: ' + evidenceName(quality, clause.evidenceNodeId))); body.append(card);
      }
      if (!list(quality.clauses).length) body.append(caption('No source clauses have been revealed.'));
      body.append(caption('Conditions, exceptions and negation are shown verbatim. This view does not simplify them into a verdict.'));
      return body;
    }
    function motives(instance) {
      const quality = instance.quality, body = el('div'), motive = field('Why are you taking this case?', 'select'), intent = el('div');
      body.append(caption('The employer’s framing is open to question. Choose the authored reason that matches your own intent.'));
      motive.input.append(option('', 'Choose your motive')); motive.input.required = true;
      for (const record of list(quality.motives)) motive.input.append(option(record.id, record.label));
      motive.input.value = quality.motiveId || '';
      const detail = el('p', 'quest-muted');
      const describe = () => { detail.textContent = list(quality.motives).find(record => record.id === motive.input.value)?.description || ''; intent.replaceChildren(); };
      motive.input.onchange = describe; describe();
      const prepare = button('Review my motive', () => { if (!motive.input.reportValidity()) return; const chosen = list(quality.motives).find(record => record.id === motive.input.value); preview(intent, 'My motive', [chosen.label, chosen.description || ''], () => operate(instance, 'set_motive', { motiveId: chosen.id }, 'Record my motive')); });
      prepare.disabled = !list(quality.motives).length; body.append(motive.label, detail, prepare, intent); return body;
    }
    function firstImpression(instance) {
      const quality = instance.quality, body = el('form', 'quest-form'), note = field('Your first impression', 'textarea');
      let draft = impressions.get(instance.id);
      if (!draft) { draft = { text: text(quality.firstImpression?.text), unsure: quality.firstImpression?.unsure ?? true, share: quality.firstImpression?.shared ?? false }; impressions.set(instance.id, draft); }
      note.input.maxLength = 1000; note.input.required = true; note.input.value = draft.text;
      const unsure = check('I am unsure of this interpretation', draft.unsure), share = check('Share this impression with case participants', draft.share);
      note.input.oninput = () => { draft.text = note.input.value; }; unsure.input.onchange = () => { draft.unsure = unsure.input.checked; }; share.input.onchange = () => { draft.share = share.input.checked; };
      const save = button('Record first impression'); save.type = 'submit';
      body.append(caption('Write independently before comparing interpretations. “Unsure” is a valid starting point. Sharing is an explicit choice.'), note.label, unsure.label, share.label, save);
      body.onsubmit = event => { event.preventDefault(); operate(instance, 'first_impression', { text: draft.text, unsure: draft.unsure, share: draft.share }, 'Record first impression', () => impressions.delete(instance.id)); };
      if (list(quality.sharedImpressions).length) {
        const shared = el('div'); shared.append(el('h5', '', 'Impressions participants chose to share'));
        for (const record of list(quality.sharedImpressions)) { const card = el('article', 'quest-case-note'); card.append(el('strong', '', person(instance, record.accountId) + (record.unsure ? ' · unsure' : '')), el('p', 'quest-quality-verbatim', record.text)); shared.append(card); }
        body.append(shared);
      }
      return body;
    }
    function disclosures(instance) {
      const quality = instance.quality, body = el('div'), options = list(quality.disclosureOptions || quality.disclosures).filter(record => list(record.recipients).length);
      if (options.length && instance.status === 'active') {
        const evidence = field('Evidence to disclose', 'select'), recipient = field('Who should receive it?', 'select'), intent = el('div');
        options.forEach(record => evidence.input.append(option(record.evidenceId, evidenceName(quality, record.evidenceId))));
        const sync = () => { recipient.input.replaceChildren(); for (const npc of list(options.find(record => record.evidenceId === evidence.input.value)?.recipients)) recipient.input.append(option(npc.npcId, npc.label)); intent.replaceChildren(); };
        sync(); evidence.input.onchange = sync; recipient.input.onchange = () => intent.replaceChildren();
        const prepare = button('Review disclosure intent', () => {
          const record = options.find(candidate => candidate.evidenceId === evidence.input.value), npc = list(record.recipients).find(candidate => candidate.npcId === recipient.input.value);
          if (!npc) return;
          preview(intent, 'Disclosure', ['Give “' + evidenceName(quality, record.evidenceId) + '” to ' + npc.label + '.', 'Intent: let this recipient consider that evidence in this case.'], () => operate(instance, 'disclose', { evidenceId: record.evidenceId, npcId: npc.npcId }, 'Disclose selected evidence'));
        });
        body.append(evidence.label, recipient.label, prepare, intent);
      } else body.append(caption(instance.status === 'completed' ? 'This case is closed. Recorded disclosures remain below.' : 'No disclosure is currently offered for the evidence your role can see.'));
      for (const record of list(quality.npcs)) {
        if (!list(record.principles).length) continue;
        const card = el('article', 'quest-case-note'); card.append(el('strong', '', record.label));
        for (const principle of list(record.principles)) card.append(el('p', '', principle)); body.append(card);
      }
      for (const record of list(quality.disclosureReports || quality.disclosureLog)) body.append(el('p', 'quest-quality-report', record.report));
      return body;
    }
    function fieldwork(instance) {
      const quality = instance.quality, body = el('div');
      for (const assignment of instance.status === 'active' ? list(quality.fieldworkAssignments) : []) {
        const card = el('article', 'quest-quality-assignment'), question = field(assignment.title + ' · question', 'select'), method = field(assignment.title + ' · method', 'select'), intent = el('div');
        card.append(el('h5', '', assignment.title));
        list(assignment.questions).forEach(record => question.input.append(option(record.id, record.label))); list(assignment.methods).forEach(record => method.input.append(option(record.id, record.label)));
        question.input.onchange = method.input.onchange = () => intent.replaceChildren();
        const prepare = button('Review fieldwork · ' + assignment.title, () => {
          const selectedQuestion = list(assignment.questions).find(record => record.id === question.input.value), selectedMethod = list(assignment.methods).find(record => record.id === method.input.value);
          if (!selectedQuestion || !selectedMethod) return;
          preview(intent, 'Fieldwork', [assignment.title, 'Question: ' + selectedQuestion.label, 'Method: ' + selectedMethod.label], () => operate(instance, 'fieldwork', { assignmentId: assignment.id, questionId: selectedQuestion.id, methodId: selectedMethod.id }, 'Record fieldwork approach'));
        });
        card.append(question.label, method.label, prepare, intent); body.append(card);
      }
      for (const report of list(quality.fieldworkReports)) body.append(el('p', 'quest-quality-report', report.report));
      if (!body.childNodes.length) body.append(caption('No fieldwork assignment is currently revealed.')); return body;
    }
    function cooperation(instance) {
      const quality = instance.quality, body = el('div'), members = participants(instance), me = members.find(member => member.isMe), decisions = list(instance.actions).filter(action => action.kind === 'choose');
      body.append(el('h5', '', 'Your next contribution'));
      if (me) body.append(caption(me.name + ' · ' + me.roleId));
      for (const action of list(instance.actions)) if (action.kind !== 'start_instance') body.append(el('p', '', action.title || 'A move is issued to your role.'));
      body.append(caption('Only your role’s issued moves are shown. Other participants choose their own contributions.'));
      if (members.length > 1 && decisions.length) {
        const node = field('Decision to delegate', 'select'), delegate = field('Proposed decision maker', 'select'), intent = el('div');
        decisions.forEach(action => node.input.append(option(action.nodeId, action.title))); members.forEach(member => delegate.input.append(option(member.id, member.name + ' · ' + member.roleId)));
        const prepare = button('Review decision mandate', () => preview(intent, 'Decision mandate', ['Propose ' + person(instance, delegate.input.value) + ' for “' + decisions.find(action => action.nodeId === node.input.value)?.title + '”.', 'Required participants must acknowledge before a delegated commitment.'], () => operate(instance, 'propose_mandate', { nodeId: node.input.value, delegateAccountId: delegate.input.value }, 'Propose scene decision mandate')));
        body.append(node.label, delegate.label, prepare, intent);
      }
      for (const mandate of list(quality.delegations)) {
        const record = el('article', 'quest-case-note'); record.dataset.qualityMandate = mandate.nodeId;
        record.append(el('strong', '', 'Proposed decision maker: ' + person(instance, mandate.delegateAccountId)));
        for (const id of list(mandate.requiredAccountIds)) record.append(el('p', '', person(instance, id) + ' · ' + (list(mandate.acknowledgedAccountIds).includes(id) ? 'acknowledged' : 'acknowledgement needed')));
        if (me && list(mandate.requiredAccountIds).includes(me.id) && !list(mandate.acknowledgedAccountIds).includes(me.id)) record.append(button('Acknowledge this mandate', () => operate(instance, 'acknowledge_mandate', { nodeId: mandate.nodeId }, 'Acknowledge scene decision mandate')));
        record.append(button('Withdraw mandate · keep the decision open', () => operate(instance, 'clear_mandate', { nodeId: mandate.nodeId }, 'Withdraw scene decision mandate'))); body.append(record);
      }
      return body;
    }
    function debrief(instance) {
      const state = instance.quality.debrief || {}, body = el('div');
      if (state.opened && typeof state.text === 'string') body.append(el('p', 'quest-quality-verbatim', state.text));
      else if (state.available) body.append(caption('The explanation is available when you choose to reveal your debrief.'), button('Reveal my debrief', () => operate(instance, 'open_debrief', {}, 'Reveal my case debrief')));
      else body.append(caption('Your debrief becomes available when the case is complete. Its explanation is not loaded into this view.'));
      return body;
    }
    function study(instance) {
      const state = instance.quality.study || {}, body = el('div');
      body.append(caption('Optional study participation does not affect your case outcome. Participant type is self-reported; an automated run is not counted as an observed human session.'));
      if (!state.consented) {
        if (instance.status === 'completed') { body.append(caption('Enrollment is closed for this completed case. Join the study before completing a case if you want to take part.')); return body; }
        const form = el('form', 'quest-form'), consent = check('I consent to the optional comprehension and delayed recall study'), type = field('Study participant type', 'select'), familiarity = field('Prior familiarity with this case', 'select');
        consent.input.required = true; type.input.append(option('unspecified', 'Not specified'), option('self_reported_human', 'Human tester · self-reported'), option('ai', 'AI or automated test participant'));
        familiarity.input.append(option('new', 'New to this case'), option('familiar', 'Familiar with this case'));
        const enroll = button('Enroll in optional study'); enroll.type = 'submit'; form.append(consent.label, type.label, familiarity.label, enroll);
        form.onsubmit = event => { event.preventDefault(); operate(instance, 'study_consent', { consent: true, evidenceType: type.input.value, familiarity: familiarity.input.value }, 'Enroll in optional quest study'); }; body.append(form); return body;
      }
      body.append(el('p', 'quest-quality-study-state', 'Enrolled · ' + (state.evidenceType === 'self_reported_human' ? 'human tester, self-reported' : state.evidenceType === 'ai' ? 'AI or automated test participant' : 'participant type not specified')));
      body.append(button('Withdraw study consent', () => operate(instance, 'study_consent', { consent: false, evidenceType: state.evidenceType, familiarity: state.familiarity }, 'Withdraw optional study consent')));
      if (!state.comprehensionSubmitted && state.canSubmitComprehension) {
        const form = el('form', 'quest-form'), answers = {};
        form.append(el('h5', '', 'Explain the case in your own words'), caption('Answer from your current understanding before reopening evidence. “I do not know” is an acceptable answer.'));
        for (const [id, label] of [['what', 'What are you investigating?'], ['why', 'Why does it matter?'], ['next', 'What would you do next?']]) { const entry = field(label, 'textarea'); entry.input.required = true; entry.input.maxLength = 1200; answers[id] = entry.input; form.append(entry.label); }
        const submit = button('Submit my understanding'); submit.type = 'submit'; form.append(submit);
        form.onsubmit = event => { event.preventDefault(); operate(instance, 'study_comprehension', { answers: Object.fromEntries(Object.entries(answers).map(([id, input]) => [id, input.value])) }, 'Submit optional case comprehension'); }; body.append(form);
      } else if (state.comprehensionSubmitted) body.append(caption('Your comprehension response is recorded.'));
      else body.append(caption(instance.quality.debrief?.opened ? 'Blind comprehension is unavailable after revealing the debrief.' : 'Blind comprehension opens after completing the case, before you reveal its debrief.'));
      const due = Date.parse(state.eligibleAt || '');
      if (state.recallSubmitted) { body.append(caption('Your delayed recall response is recorded.')); return body; }
      if (!state.recallEligible) {
        const pending = el('p', 'quest-quality-study-state', 'Delayed recall pending · at least 24 hours after your comprehension response.'); pending.setAttribute('role', 'status'); body.append(pending);
        if (Number.isFinite(due)) body.append(caption('Earliest return: ' + new Date(due).toLocaleString() + '. The server checks eligibility when you submit.')); return body;
      }
      const form = el('form', 'quest-form'), memory = field('What do you remember about the case?', 'textarea'), enjoyment = field('Enjoyment · 1 low to 5 high', 'select'), understanding = field('Understanding · 1 low to 5 high', 'select');
      memory.input.required = true; memory.input.maxLength = 2000;
      for (const entry of [enjoyment, understanding]) { entry.input.required = true; entry.input.append(option('', 'Choose a response')); for (let value = 1; value <= 5; value++) entry.input.append(option(String(value), String(value))); }
      const submit = button('Submit delayed recall'); submit.type = 'submit'; form.append(el('h5', '', 'Delayed recall'), memory.label, enjoyment.label, understanding.label, submit);
      form.onsubmit = event => { event.preventDefault(); operate(instance, 'study_recall', { memory: memory.input.value, enjoyment: Number(enjoyment.input.value), understanding: Number(understanding.input.value) }, 'Submit optional delayed recall'); }; body.append(form); return body;
    }
    function render(instance) {
      scope(); if (!instance.quality) return null;
      const quality = instance.quality, root = el('section', 'quest-quality'); root.dataset.questQuality = instance.id; root.setAttribute('aria-label', 'Investigation workbench');
      const heading = el('header', 'quest-quality-heading'); heading.append(el('span', 'quest-kicker', 'Your investigation'), el('h4', '', quality.currentQuestion || quality.question || 'Work the question'));
      if (quality.identity?.activity) heading.append(caption(quality.identity.activity));
      const recap = el('div'); for (const line of list(quality.recap)) recap.append(el('p', '', line));
      if (quality.currentQuestion) recap.append(el('strong', '', 'Current question: ' + quality.currentQuestion));
      root.append(heading, section(instance, 'reentry', 'Re-entry brief and revealed questions', (() => { recap.append(search(instance)); return recap; })()),
        section(instance, 'framing', 'Assumptions and exact clauses', framing(instance)),
        section(instance, 'workbench', 'Theory and evidence · private workbench', workbench(instance), true),
        section(instance, 'impression', 'Your independent first impression', firstImpression(instance)),
        section(instance, 'motives', 'Your motive and the employer’s brief', motives(instance)),
        section(instance, 'disclosure', 'Choose what to disclose, and to whom', disclosures(instance)),
        section(instance, 'fieldwork', 'Question-led fieldwork', fieldwork(instance)),
        section(instance, 'cooperation', 'Roles and decision mandates', cooperation(instance)),
        section(instance, 'debrief', 'Your spoiler-controlled debrief', debrief(instance)),
        section(instance, 'study', 'Optional comprehension and delayed recall', study(instance)));
      return root;
    }
    function interaction(instance, item) {
      scope(); const spec = item.interaction, form = el('form', 'quest-form quest-quality-proof'), conclusion = field('Conclusion to test', 'select'), evidence = el('fieldset', 'quest-item-choices'), intent = el('div');
      const key = instance.id + ':' + item.nodeId, working = currentDraft(instance);
      let draft = proofDrafts.get(key);
      if (!draft) { draft = { conclusionId: working.conclusionId, evidenceIds: list(spec.items).filter(candidate => working.evidenceIds.includes(candidate.evidenceNodeId)).map(candidate => candidate.id) }; proofDrafts.set(key, draft); }
      conclusion.input.required = true; conclusion.input.append(option('', 'Choose a conclusion'));
      for (const record of list(spec.conclusions)) conclusion.input.append(option(record.id, record.label)); conclusion.input.value = draft.conclusionId;
      conclusion.input.onchange = () => { draft.conclusionId = conclusion.input.value; intent.replaceChildren(); };
      evidence.append(el('legend', '', 'Evidence supporting this conclusion'));
      for (const record of list(spec.items)) {
        const choice = check(record.label, draft.evidenceIds.includes(record.id)); choice.input.value = record.id;
        if (record.description) choice.label.append(el('small', 'quest-muted', record.description));
        choice.input.onchange = () => { draft.evidenceIds = choice.input.checked ? [...new Set([...draft.evidenceIds, record.id])] : draft.evidenceIds.filter(id => id !== record.id); intent.replaceChildren(); }; evidence.append(choice.label);
      }
      const prepare = button('Review deduction intent'); prepare.type = 'submit';
      const copy = button('Copy this reasoning to my private draft', () => { working.conclusionId = draft.conclusionId; working.evidenceIds = list(spec.items).filter(candidate => draft.evidenceIds.includes(candidate.id)).map(candidate => candidate.evidenceNodeId); working.dirty = true; repaint?.(); });
      form.append(caption('Choose both a conclusion and its support. Selecting an answer does not make it established evidence.'), conclusion.label, evidence, copy, prepare, intent);
      form.onsubmit = event => {
        event.preventDefault(); const submission = { conclusionId: draft.conclusionId, evidenceIds: [...draft.evidenceIds] }, chosen = list(spec.conclusions).find(candidate => candidate.id === submission.conclusionId);
        if (!chosen) return;
        preview(intent, 'Deduction', ['Conclusion: ' + chosen.label, 'Support: ' + list(spec.items).filter(candidate => submission.evidenceIds.includes(candidate.id)).map(candidate => candidate.label).join(' · ')], () => onSubmit(instance, item, { submission }, 'Commit evidence-backed deduction'));
      };
      return form;
    }
    function choice(instance, item) {
      scope(); const root = el('div'), choices = el('div', 'quest-choices'), intent = el('div'), quality = instance.quality;
      for (const option of list(item.options)) {
        const pick = button(option.label, () => {
          let blocker = '';
          if (quality.canDelegate) {
            const mandate = list(quality.delegations).find(record => record.nodeId === item.nodeId);
            if (!mandate) blocker = 'Propose a decision mandate in Roles and decision mandates before committing this shared choice.';
            else if (!list(mandate.requiredAccountIds).every(id => list(mandate.acknowledgedAccountIds).includes(id))) blocker = 'Every current participant must acknowledge this mandate before the decision is committed.';
            else if (mandate.delegateAccountId !== quality.ownMemberId) blocker = 'The acknowledged decision maker must commit this choice.';
          }
          preview(intent, 'Decision', [item.title || 'Current decision', option.label], () => onSubmit(instance, item, { choiceId: option.id }, 'Commit case decision'), blocker);
        });
        pick.disabled = option.available === false; choices.append(pick);
      }
      root.append(choices, intent); return root;
    }
    return { render, interaction, choice, reset };
  };
})();
