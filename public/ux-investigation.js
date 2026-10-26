/* A private reading desk over already-authorized fieldwork projections. */
(function () {
  'use strict';
  const list = x => Array.isArray(x) ? x : [];
  const number = x => Number.isFinite(Number(x)) ? Number(x) : 0;
  const label = x => x?.title || x?.name || String(x?.templateId || x?.id || '').replace(/^[^:]+:/, '').replace(/[_-]/g, ' ');
  const el = (tag, cls, text) => { const node = document.createElement(tag); if (cls) node.className = cls; if (text != null) node.textContent = String(text); return node; };
  const button = (text, run) => { const node = el('button', 'act', text); node.type = 'button'; node.onclick = run; return node; };
  function recipeTrace(template, recipes, seen = new Set()) {
    if (seen.has(template)) return [];
    const next = new Set(seen).add(template);
    return list(recipes).filter(recipe => list(recipe.outputs).some(output => output.templateId === template)).map(recipe => ({
      id: recipe.id, title: label(recipe), inputs: list(recipe.inputs).map(input => ({ ...input,
        sources: input.templateId ? recipeTrace(input.templateId, recipes, next) : [] })),
    }));
  }
  function revealedUses(item, recipes, metadata, operations) {
    const template = item.templateId;
    return [
      ...list(recipes).filter(recipe => list(recipe.inputs).some(input => input.templateId === template)).map(recipe => ({ title: label(recipe), kind: 'Consumed by recipe' })),
      ...list(metadata?.nodes).filter(node => list(node.uses).includes(template) || list(node.commits).includes(template) || list(node.consumes).includes(template))
        .map(node => ({ title: node.id, kind: list(node.commits).includes(template) ? 'Held by revealed case step' : list(node.consumes).includes(template) ? 'Consumed by revealed case step' : 'Required by revealed case step' })),
      ...list(operations?.nodes).filter(node => list(node.blockedBy).some(blocker => blocker.templateId === template)).map(node => ({ title: label(node), kind: 'Required by authorized operation' })),
    ];
  }
  window.OmertaInvestigationModel = { recipeTrace, revealedUses };
  window.createOmertaInvestigation = function ({ getState, read, navigate, notify, workspace }) {
    let account = '', context = null, metadata = {}, catalog = null, custody = null, indexPending = false;
    let filter = 'all', selectedTrail = '', pending = new Map(), dialog = null, serial = 0;
    const memory = {}, readingState = new Map(), hintPages = new Map();
    const state = () => getState() || {};
    const get = () => {
      const value = workspace?.get('investigation', {}) || memory[account] || {};
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    };
    const set = value => { memory[account] = value; workspace?.set('investigation', value); };
    const caseState = graphId => get()[graphId] || { pins: [], links: [], hypotheses: [], positions: {}, hintRequests: 0 };
    const changeCase = (graphId, mutate) => { const all = structuredClone(get()), value = all[graphId] || { pins: [], links: [], hypotheses: [], positions: {}, hintRequests: 0 }; mutate(value); all[graphId] = value; set(all); };
    function sync() {
      const me = state().me, next = me?.accountId || me?.id || '';
      if (next !== account) {
        account = next; context = null; metadata = {}; catalog = custody = null; pending.clear(); readingState.clear(); hintPages.clear(); serial++;
        dialog?.close(); dialog?.remove(); dialog = null;
        document.querySelectorAll('[data-investigation-ux]').forEach(node => node.remove());
      }
      return !!account;
    }
    async function request(path) {
      if (pending.has(path)) return pending.get(path);
      const who = account, epoch = serial;
      const promise = Promise.resolve(read(path)).then(response => {
        if (who !== (state().me?.accountId || state().me?.id) || epoch !== serial) return null;
        if (response?.code >= 400) { notify('That reading aid is unavailable. Your issued case actions remain available.', true); return null; }
        return response?.body || null;
      }).catch(() => { notify('The reading desk did not answer. Try again when you choose.', true); return null; }).finally(() => pending.delete(path));
      pending.set(path, promise); return promise;
    }
    const heading = (text, note) => { const node = el('header', 'investigation-heading'); node.append(el('h3', '', text)); if (note) node.append(el('p', '', note)); return node; };
    const details = (text, cls = '') => { const node = el('details', `investigation-details ${cls}`); node.append(el('summary', '', text)); return node; };
    function field(labelText, type = 'input') {
      const wrap = el('label', 'investigation-field'); wrap.append(el('span', '', labelText)); const input = el(type); input.setAttribute('aria-label', labelText); wrap.append(input); return { wrap, input };
    }
    function emitNavigate(view, extra = {}) {
      navigate('fieldwork'); document.dispatchEvent(new CustomEvent('omerta:fieldwork-navigate', { detail: { view, ...extra } }));
    }
    function knownNodes() {
      return [...list(context?.mysteryDetail?.nodes), ...list(context?.roleDetail?.nodes)].filter((node, index, all) => all.findIndex(other => other.id === node.id) === index);
    }
    function currentGraph() { return context?.mysteryDetail?.graph?.id || ''; }
    const readingKey = () => `${context?.view || ''}:${currentGraph()}`;
    function rememberReading() {
      const root = context?.root; if (!root?.isConnected) return;
      const fields = [...root.querySelectorAll('[data-investigation-ux] input,[data-investigation-ux] select,[data-investigation-ux] textarea')];
      readingState.set(readingKey(), { fields: fields.map((node, index) => ({ key: `${node.getAttribute('aria-label')}:${index}`, value: node.value, focus: node === document.activeElement })),
        details: [...root.querySelectorAll('[data-investigation-ux] details')].map((node, index) => ({ key: `${node.querySelector('summary')?.textContent}:${index}`, open: node.open })) });
    }
    function restoreReading(root) {
      const saved = readingState.get(readingKey()); if (!saved) return;
      [...root.querySelectorAll('[data-investigation-ux] input,[data-investigation-ux] select,[data-investigation-ux] textarea')].forEach((node, index) => {
        const field = saved.fields.find(entry => entry.key === `${node.getAttribute('aria-label')}:${index}`); if (!field) return;
        if (node.tagName !== 'SELECT' || [...node.options].some(option => option.value === field.value)) node.value = field.value;
        if (field.focus) node.focus({ preventScroll: true });
      });
      [...root.querySelectorAll('[data-investigation-ux] details')].forEach((node, index) => {
        const panel = saved.details.find(entry => entry.key === `${node.querySelector('summary')?.textContent}:${index}`); if (panel) node.open = panel.open;
      });
    }
    function boardWorkspace(graphId) {
      const root = el('section', 'investigation-workspace'); root.dataset.investigationUx = 'workspace';
      root.append(heading('Your private deduction board', 'Arrange evidence and revise your interpretation. Notes are yours; they do not submit a case answer.'));
      const saved = caseState(graphId), nodes = knownNodes(), found = nodes.filter(node => node.type === 'evidence' && ['discovered', 'completed'].includes(node.status));
      const picker = field('Pin a found clue', 'select'); picker.input.append(el('option', '', 'Choose a clue'));
      picker.input.firstChild.value = '';
      for (const node of found) { const option = el('option', '', label(node)); option.value = node.id; picker.input.append(option); }
      picker.input.onchange = () => { if (picker.input.value) { changeCase(graphId, value => { if (!list(value.pins).includes(picker.input.value)) value.pins = [...list(value.pins), picker.input.value]; }); drawWorkspace(root, graphId); } };
      root.append(picker.wrap);
      const content = el('div', 'investigation-workspace-content'); root.append(content); paintBoard(content, graphId, saved, found);
      return root;
    }
    function drawWorkspace(root, graphId) {
      const found = knownNodes().filter(node => node.type === 'evidence' && ['discovered', 'completed'].includes(node.status));
      const content = root.querySelector('.investigation-workspace-content'); if (content) { content.replaceChildren(); paintBoard(content, graphId, caseState(graphId), found); }
    }
    function paintBoard(root, graphId, saved, found) {
      found = [...found, ...list(saved.suspects).map(suspect => ({ id: suspect.id, title: suspect.name, dialogue: `Your hypothesis about this person: ${suspect.note}`, personal: true }))];
      const pins = list(saved.pins).map(id => found.find(node => node.id === id)).filter(Boolean);
      const cork = el('div', 'investigation-corkboard'); cork.setAttribute('aria-label', 'Pinned evidence');
      const positions = saved.positions || {};
      pins.forEach((node, index) => {
        const pin = el('article', 'investigation-pin'); pin.draggable = true; pin.dataset.clueId = node.id;
        pin.style.gridColumn = String(Math.min(3, Math.max(1, number(positions[node.id]) || index % 3 + 1)));
        pin.append(el('strong', '', label(node)), el('p', '', node.dialogue || node.description || 'Evidence recorded by this case.'));
        pin.append(button('Inspect clue', () => inspect(node, metadata[graphId]?.nodes?.find(entry => entry.id === node.id))));
        const controls = el('div', 'investigation-pin-controls');
        for (const [text, delta] of [['Move left', -1], ['Move right', 1]]) controls.append(button(text, () => {
          changeCase(graphId, value => { value.positions ||= {}; value.positions[node.id] = Math.min(3, Math.max(1, (number(value.positions[node.id]) || index % 3 + 1) + delta)); });
          drawWorkspace(root.parentElement, graphId);
        }));
        controls.append(button('Unpin', () => { changeCase(graphId, value => { value.pins = list(value.pins).filter(id => id !== node.id); }); drawWorkspace(root.parentElement, graphId); })); pin.append(controls);
        pin.ondragstart = event => event.dataTransfer.setData('text/plain', node.id); cork.append(pin);
      });
      cork.ondragover = event => event.preventDefault();
      cork.ondrop = event => { event.preventDefault(); const id = event.dataTransfer.getData('text/plain'); if (!pins.some(node => node.id === id)) return;
        const bounds = cork.getBoundingClientRect(), column = Math.min(3, Math.max(1, Math.floor((event.clientX - bounds.left) / bounds.width * 3) + 1));
        changeCase(graphId, value => { value.positions ||= {}; value.positions[id] = column; }); drawWorkspace(root.parentElement, graphId); };
      if (!pins.length) cork.append(el('p', 'investigation-empty', 'Pin evidence you have actually found to begin comparing it.'));
      root.append(cork);
      const suspectPanel = details('Add a person or possibility to compare'), suspectName = field('Person or suspect'), suspectNote = field('Why are you considering them?');
      suspectName.input.maxLength = 100; suspectNote.input.maxLength = 300;
      suspectPanel.append(el('p', 'investigation-note', 'These are your own possibilities, not characters accused by the case.'), suspectName.wrap, suspectNote.wrap, button('Pin my possibility', () => {
        if (!suspectName.input.value.trim() || !suspectNote.input.value.trim()) { notify('Name the person and record why you are considering them.'); return; }
        changeCase(graphId, value => { const id = 'personal:' + crypto.randomUUID(); value.suspects = [...list(value.suspects), { id, name: suspectName.input.value.trim(), note: suspectNote.input.value.trim() }].slice(-20); value.pins = [...list(value.pins), id]; }); drawWorkspace(root.parentElement, graphId);
      })); root.append(suspectPanel);
      const linkPanel = details('Connect two clues');
      const from = field('First clue', 'select'), to = field('Second clue', 'select'), relation = field('What connects them?'); relation.input.maxLength = 180;
      for (const node of pins) for (const control of [from.input, to.input]) { const option = el('option', '', label(node)); option.value = node.id; control.append(option); }
      linkPanel.append(from.wrap, to.wrap, relation.wrap, button('Save connection', () => {
        if (!from.input.value || from.input.value === to.input.value || !relation.input.value.trim()) { notify('Choose two different pinned clues and explain the connection.'); return; }
        changeCase(graphId, value => { value.links = [...list(value.links), { from: from.input.value, to: to.input.value, text: relation.input.value.trim() }].slice(-30); }); drawWorkspace(root.parentElement, graphId);
      }));
      for (const [index, link] of list(saved.links).entries()) {
        const a = found.find(node => node.id === link.from), b = found.find(node => node.id === link.to); if (!a || !b) continue;
        const row = el('p', 'investigation-connection', `${label(a)} ↔ ${label(b)}: ${link.text}`);
        row.append(button('Remove connection', () => { changeCase(graphId, value => value.links.splice(index, 1)); drawWorkspace(root.parentElement, graphId); })); linkPanel.append(row);
      }
      root.append(linkPanel, hypotheses(graphId, saved, root.parentElement));
    }
    function hypotheses(graphId, saved, workspaceRoot) {
      const root = details('Competing hypotheses'); root.open = true;
      const claim = field('I think…'), because = field('Because…', 'textarea'); claim.input.maxLength = 180; because.input.maxLength = 1000;
      root.append(claim.wrap, because.wrap, button('Add hypothesis', () => {
        if (!claim.input.value.trim() || !because.input.value.trim()) { notify('Write both your interpretation and its supporting reason.'); return; }
        changeCase(graphId, value => { value.hypotheses = [...list(value.hypotheses), { claim: claim.input.value.trim(), because: because.input.value.trim(), status: 'open' }].slice(-12); }); drawWorkspace(workspaceRoot, graphId);
      }));
      for (const [index, hypothesis] of list(saved.hypotheses).entries()) {
        const article = el('article', 'investigation-hypothesis'), edit = field('Revise hypothesis'), reason = field('Revise supporting reason', 'textarea');
        edit.input.value = hypothesis.claim; reason.input.value = hypothesis.because; edit.input.maxLength = 180; reason.input.maxLength = 1000;
        const status = field('Hypothesis standing', 'select');
        for (const value of ['open', 'supported', 'contradicted']) { const option = el('option', '', value); option.value = value; status.input.append(option); }
        status.input.value = hypothesis.status || 'open'; article.append(edit.wrap, reason.wrap, status.wrap,
          button('Save revision', () => { changeCase(graphId, value => { value.hypotheses[index] = { claim: edit.input.value.trim(), because: reason.input.value.trim(), status: status.input.value }; }); drawWorkspace(workspaceRoot, graphId); })); root.append(article);
      }
      root.append(el('p', 'investigation-note', 'Supported and contradicted are your judgments, not server-validated conclusions.'));
      return root;
    }
    function inspect(node, presentation = {}) {
      dialog?.remove(); dialog = el('dialog', 'investigation-inspector'); dialog.setAttribute('aria-label', `Inspect ${label(node)}`);
      const head = el('header'); head.append(el('h2', '', label(node)), button('Close inspection', () => dialog.close())); dialog.append(head);
      const documentType = presentation.document || (/telegram/i.test(label(node)) ? 'telegram' : /letter|note|notebook/i.test(label(node)) ? 'letter' : 'tool');
      const art = el('div', `investigation-document investigation-document--${documentType}`), viewport = el('div', 'investigation-zoom-viewport'), plate = el('div', 'investigation-zoom-plate');
      plate.append(el('span', 'investigation-document-mark', documentType.toUpperCase()), el('h3', '', label(node)), el('p', 'investigation-art-detail', presentation.detail || node.dialogue || node.description || 'Inspect the description in your authorized inventory record.'));
      if (documentType === 'survey') { const diagram = el('div', 'investigation-survey'); diagram.append(el('span', '', 'Recorded parcel'), el('span', '', 'Shared wall'), el('span', '', 'Public alley easement')); plate.append(diagram); }
      if (/clock|timing/i.test(node.id)) { const clock = el('div', 'investigation-stopped-clock'); clock.setAttribute('aria-label', 'Illustration of a stopped clock hand; no numeric time is asserted'); clock.append(el('i')); plate.append(clock); }
      viewport.append(plate); art.append(viewport); dialog.append(art);
      const zoom = field('Clue detail zoom'), horizontal = field('Pan horizontally'), vertical = field('Pan vertically');
      for (const [control, min, max, value] of [[zoom.input, 100, 240, 100], [horizontal.input, -120, 120, 0], [vertical.input, -100, 100, 0]]) { control.type = 'range'; control.min = min; control.max = max; control.value = value; }
      const update = () => { plate.style.transform = `translate(${horizontal.input.value}px,${vertical.input.value}px) scale(${number(zoom.input.value) / 100})`; };
      for (const control of [zoom.input, horizontal.input, vertical.input]) control.oninput = update;
      dialog.append(zoom.wrap, horizontal.wrap, vertical.wrap);
      const transcript = details('Accessible transcription'); transcript.open = true;
      transcript.append(el('p', '', node.dialogue || node.description || 'No additional text is recorded for this object.'));
      if (presentation.detail) transcript.append(el('p', '', presentation.detail)); dialog.append(transcript);
      dialog.append(el('p', 'investigation-note', 'Illustrated reading aid. Only the text from your revealed case or held item is represented.'));
      document.body.append(dialog); dialog.showModal();
    }
    function scene(graphId) {
      const root = details('Inspect the objects on your case desk', 'investigation-scene');
      root.append(el('p', 'investigation-note', 'Select a found document or carried tool. Each object opens an inspection with transcription and detail zoom.'));
      const desk = el('div', 'investigation-desk-scene'); desk.setAttribute('role', 'group'); desk.setAttribute('aria-label', 'Illustrated case desk');
      const nodes = knownNodes(), presentation = metadata[graphId]?.nodes || [];
      const objects = nodes.filter(node => ['evidence'].includes(node.type) && ['discovered', 'completed'].includes(node.status));
      const tools = [...list(context?.boards?.inventory?.items), ...list(context?.boards?.inventory?.currentCharacterItems)];
      for (const object of [...objects, ...tools].slice(0, 12)) {
        const info = presentation.find(entry => entry.id === object.id) || {}, hotspot = button(label(object), () => inspect(object, info));
        hotspot.className = `investigation-desk-object investigation-desk-object--${info.document || 'tool'}`; desk.append(hotspot);
      }
      if (!desk.children.length) desk.append(el('p', '', 'Your found documents and held tools will appear here.'));
      root.append(desk); return root;
    }
    function authoredAids(root, graphId) {
      const board = context.mysteryDetail, info = metadata[graphId]; if (!board || !info) return;
      for (const node of list(board.nodes)) {
        const card = root.querySelector(`[data-fieldwork-node="${CSS.escape(node.id)}"]`), aid = list(info.nodes).find(entry => entry.id === node.id); if (!card || !aid) continue;
        card.querySelectorAll('[data-investigation-node-aid]').forEach(element => element.remove());
        const side = el('aside', 'investigation-node-aid'); side.dataset.investigationNodeAid = '';
        if (aid.speaker) {
          const speaker = el('div', 'investigation-speaker'), portrait = el('img'); portrait.src = `/v1/avatar/${encodeURIComponent('story:' + aid.speaker)}`; portrait.alt = `${aid.speaker}, ${aid.expression || 'speaking'}`; portrait.loading = 'lazy';
          speaker.append(portrait, el('strong', '', aid.speaker), el('span', '', aid.expression || '')); side.append(speaker);
        }
        for (const id of list(aid.evidence)) { const evidence = board.nodes.find(entry => entry.id === id); if (!evidence) continue;
          const excerpt = el('blockquote', 'investigation-evidence-beside'); excerpt.append(el('strong', '', label(evidence)), el('p', '', evidence.dialogue || evidence.description)); side.append(excerpt);
        }
        if (aid.document) side.append(button('Inspect this document', () => inspect(node, aid)));
        if (aid.lore || node.description) { const lore = details('Optional background'); lore.append(el('p', '', aid.lore || node.description)); side.append(lore); }
        if (aid.hintCount && board.status === 'active' && node.status !== 'completed' && node.status !== 'excluded') {
          const hints = details('Request guidance for this step'); hints.append(el('p', 'investigation-note', 'Each rung is requested separately. Guidance may explain the current clue; it changes no game state.'));
          const hintKey = `${graphId}:${node.id}`, revealed = hintPages.get(hintKey) || [];
          let level = revealed.length;
          const next = button('Request a nudge', async () => {
            next.disabled = true; const result = await request(`/v1/ux/investigations/${encodeURIComponent(graphId)}/nodes/${encodeURIComponent(node.id)}/hints/${level + 1}`);
            if (!result) { next.disabled = false; return; } level++;
            hintPages.set(hintKey, [...(hintPages.get(hintKey) || []), result]);
            changeCase(graphId, saved => { saved.hintRequests = number(saved.hintRequests) + 1; });
            const hint = el('p', 'investigation-hint'); hint.append(el('strong', '', result.label + ': '), document.createTextNode(result.text)); hints.insertBefore(hint, next);
            next.textContent = level === 1 ? 'Request a clue reference' : 'Request explicit guidance'; next.disabled = level >= aid.hintCount;
          }); hints.append(next); side.append(hints);
          for (const result of revealed) { const hint = el('p', 'investigation-hint'); hint.append(el('strong', '', result.label + ': '), document.createTextNode(result.text)); hints.insertBefore(hint, next); }
          next.textContent = level === 0 ? 'Request a nudge' : level === 1 ? 'Request a clue reference' : 'Request explicit guidance'; next.disabled = level >= aid.hintCount;
        }
        card.append(side);
      }
    }
    function branches(graphId) {
      const root = details('Branches you have discovered'), board = context.mysteryDetail;
      for (const node of list(board?.nodes).filter(node => node.type === 'choice')) {
        const choice = list(board.choices).find(choice => choice.nodeId === node.id), article = el('article', 'investigation-branch'); article.append(el('h4', '', label(node)));
        for (const option of list(node.options)) article.append(el('p', choice?.choiceId === option.id ? 'investigation-chosen' : '', `${choice?.choiceId === option.id ? 'Chosen: ' : choice ? 'Other revealed option: ' : 'Unresolved: '}${option.title || option.id}`)); root.append(article);
      }
      const unresolved = list(board?.nodes).filter(node => !['completed', 'excluded', 'failed'].includes(node.status));
      root.append(el('p', '', `${unresolved.length} currently revealed steps remain unresolved. Unseen branches are not shown.`)); return root;
    }
    function challenge(graphId) {
      const root = details('A voluntary mastery challenge'), saved = caseState(graphId), complete = context.mysteryDetail?.status === 'completed';
      root.append(el('p', '', 'Close the remaining case without requesting another hint. This awards a cosmetic workspace stamp only. Your case rewards and available actions stay the same.'));
      if (saved.challenge && complete) {
        const won = number(saved.hintRequests) === number(saved.challenge.hints);
        root.append(el('strong', 'investigation-challenge-stamp', won ? 'UNAIDED FINISH · cosmetic stamp earned' : 'CASE CLOSED · guidance was requested'));
      } else if (saved.challenge) root.append(el('p', '', 'Challenge accepted. You can still request guidance whenever you want.'));
      else if (!complete) root.append(button('Accept the no-further-hints challenge', () => { changeCase(graphId, value => { value.challenge = { hints: number(value.hintRequests), acceptedAt: new Date().toISOString() }; }); decorate(context); }));
      else root.append(el('p', '', 'Choose this challenge while a case is active. Completed cases do not earn a retroactive stamp.'));
      return root;
    }
    function explanation(graphId) {
      const explanation = metadata[graphId]?.explanation; if (!explanation) return null;
      const root = details('How your evidence supported the final record'); root.open = true;
      for (const evidence of list(explanation.evidence)) { const row = el('article', 'investigation-final-evidence'); row.append(el('strong', '', evidence.title), el('p', '', evidence.text)); root.append(row); }
      for (const conclusion of list(explanation.conclusions)) { const row = el('article', 'investigation-conclusion'); row.append(el('strong', '', `Final record: ${conclusion.title}`), el('p', '', conclusion.text)); root.append(row); }
      root.append(el('p', 'investigation-note', 'These are the actual completed evidence and final steps in this case. Your private hypotheses were not graded by the case engine.')); return root;
    }
    function recipeAids(root) {
      const recipes = list(context.boards?.recipes?.recipes);
      for (const recipe of recipes) {
        const card = root.querySelector(`[data-fieldwork-recipe="${CSS.escape(recipe.id)}"]`); if (!card || card.querySelector('[data-investigation-recipe]')) continue;
        const preview = details('Exact consumption and dependency preview'); preview.dataset.investigationRecipe = '';
        preview.append(el('strong', '', 'Consumed on confirmation'));
        for (const input of list(recipe.inputs)) {
          preview.append(el('p', '', `${number(input.quantity ?? input.qty)} × ${label(input) || input.assetType}${input.quality ? ` · ${input.quality}` : ''}`));
          const trace = recipeTrace(input.templateId, recipes); if (trace.length) {
            const tree = details(`Trace sources for ${label(input)}`);
            const draw = (entries, parent, depth = 0) => { if (depth > 6) return;
              for (const entry of entries) { const row = el('div', 'investigation-recipe-step'); row.append(el('strong', '', entry.title));
                for (const material of entry.inputs) { row.append(el('p', '', `${number(material.quantity ?? material.qty)} × ${label(material) || material.assetType}`)); draw(material.sources, row, depth + 1); } parent.append(row); }
            }; draw(trace, tree); tree.append(el('p', 'investigation-note', `You are still preparing ${label(recipe)}. This trace uses only your revealed recipe catalog.`)); preview.append(tree);
          }
        }
        preview.append(el('p', '', `Cash consumed: $${number(recipe.cashCost).toLocaleString()}`), el('strong', '', 'Retained tools'), el('p', '', 'No retained tools are listed in this recipe projection. Only the inputs above are declared consumed.'), el('strong', '', 'Result'));
        for (const output of list(recipe.outputs)) preview.append(el('p', '', `${number(output.quantity ?? output.qty)} × ${label(output)}`));
        preview.append(el('p', 'investigation-note', 'For salvage, the confirmation names the exact selected car. Recheck the issued action before confirming.')); card.append(preview);
      }
    }
    function inventoryAids(root) {
      root.querySelector('[data-investigation-ux="inventory"]')?.remove();
      const panel = el('section', 'investigation-inventory-aids'); panel.dataset.investigationUx = 'inventory'; panel.append(heading('What your items are for', 'Uses shown here come from revealed recipes, case requirements and authorized operation blockers.'));
      const items = [...list(context.boards?.inventory?.stacks), ...list(context.boards?.inventory?.items), ...list(context.boards?.inventory?.currentCharacterItems)];
      for (const item of items) {
        const article = details(label(item)), uses = revealedUses(item, context.boards?.recipes?.recipes, metadata[currentGraph()], context.roleDetail || context.operationDetail);
        article.append(button('Inspect object', () => inspect(item)));
        for (const use of uses) article.append(el('p', '', `${use.kind}: ${knownNodes().find(node => node.id === use.title)?.title || use.title}`));
        if (!uses.length) article.append(el('p', '', 'No use is declared in the records currently revealed to you. This is not a claim that the item has no other use.')); panel.append(article);
      }
      const committed = details('Item origins and committed equipment');
      if (!custody) committed.append(button('Read my item custody records', async () => { custody = await request('/v1/ux/investigation-items'); decorate(context); }));
      else for (const item of list(custody.items)) {
        const row = el('article', 'investigation-custody-item'); row.append(el('strong', '', item.title), el('p', '', item.origin ? `Origin: ${item.origin}` : `Held by ${item.titleOfWork}`));
        if (item.operationId) { row.append(el('p', '', `Committed to ${item.titleOfWork}`), el('p', '', item.returnConditions), button(`Open ${item.titleOfWork}`, () => emitNavigate(item.kind === 'operation' ? 'operations' : 'mysteries', item.kind === 'operation' ? { operationId: item.operationId } : { graphId: item.graphId }))); }
        committed.append(row);
      }
      panel.append(committed); root.append(panel);
    }
    function indexAids(root) {
      if (!catalog) return;
      const toolbar = el('section', 'investigation-case-filters'); toolbar.dataset.investigationUx = 'filters';
      const selector = field('Case experience', 'select');
      for (const [id, text] of [['all', 'All revealed cases'], ['solo', 'Solo investigations'], ['short', 'Short authored introductions'], ['coordination', 'Crew coordination operations']]) { const option = el('option', '', text); option.value = id; selector.input.append(option); }
      selector.input.value = filter; selector.input.onchange = () => { filter = selector.input.value; decorate(context); };
      toolbar.append(selector.wrap); if (filter === 'coordination') toolbar.append(button('Open Crew operations', () => emitNavigate('operations')));
      root.querySelector('.fieldwork-intro')?.after(toolbar);
      for (const card of root.querySelectorAll('[data-fieldwork-case]')) {
        const entry = list(catalog.cases).find(entry => entry.graphId === card.dataset.fieldworkCase), experience = entry?.experience;
        card.hidden = filter === 'coordination' || filter === 'solo' && experience?.mode !== 'solo' || filter === 'short' && experience?.length !== 'short';
        if (experience && !card.querySelector('.investigation-case-length')) card.append(el('small', 'investigation-case-length', `${experience.mode} · ${experience.label}`));
      }
      const trails = details('Follow a discovery trail at your own pace'); trails.dataset.investigationUx = 'trails';
      trails.append(el('p', 'investigation-note', 'These authored routes use existing permanent stories and places. No timer, streak, or extra reward is attached.'));
      for (const entry of list(catalog.cases).filter(entry => entry.experience?.nonexpiring && list(entry.experience.trail).length)) {
        const route = details(entry.title); route.open = selectedTrail === entry.graphId;
        const path = el('ol'); for (const step of entry.experience.trail) { const stop = el('li', '', step.title); stop.append(button('Visit the neighborhood', () => { selectedTrail = entry.graphId; navigate('map'); })); path.append(stop); }
        route.append(path, button('Keep this trail beside my case', () => { selectedTrail = entry.graphId; notify(`Following ${entry.title} at your pace.`); decorate(context); })); trails.append(route);
      }
      root.append(trails);
    }
    function decorate(next) {
      if (!sync() || !next?.root?.isConnected || state().currentTab !== 'fieldwork') return;
      if (context?.root?.isConnected && context.root.querySelector('[data-investigation-ux]')) rememberReading();
      context = next; const root = context.root;
      root.querySelectorAll('[data-investigation-ux]').forEach(node => node.remove());
      if (context.view === 'mysteries') {
        indexAids(root); const graphId = currentGraph();
        if (graphId) {
          const panel = el('section', 'investigation-reading-desk'); panel.dataset.investigationUx = 'reading';
          panel.append(boardWorkspace(graphId), scene(graphId), branches(graphId), challenge(graphId));
          const solved = explanation(graphId); if (solved) panel.append(solved); root.append(panel); authoredAids(root, graphId);
        }
      }
      if (context.view === 'recipes') recipeAids(root);
      if (context.view === 'inventory') inventoryAids(root);
      restoreReading(root);
    }
    async function afterFieldwork(event) {
      if (!sync()) return;
      context = event.detail; const epoch = serial, graphId = currentGraph();
      decorate(context);
      if (!catalog && !indexPending) { indexPending = true; catalog = await request('/v1/ux/investigations'); indexPending = false; }
      if (graphId && !metadata[graphId]) { const result = await request('/v1/ux/investigations/' + encodeURIComponent(graphId)); if (result) metadata[graphId] = result; }
      if (epoch === serial) decorate(context);
    }
    document.addEventListener('omerta:fieldwork-rendered', afterFieldwork);
    document.addEventListener('omerta:fieldwork-before-render', rememberReading);
    function observe(path, body) {
      if (!sync()) return;
      if (/^\/v1\/worldgraph\/mysteries\/[^/]+$/.test(path)) {
        const graphId = body?.graph?.id;
        if (graphId && metadata[graphId] && metadata[graphId].visibleState !== list(body.nodes).map(node => `${node.id}:${node.status}`).join('|')) delete metadata[graphId];
      }
    }
    function render() { if (!sync()) return; if (state().currentTab === 'fieldwork' && context?.root?.isConnected) decorate(context); }
    return { render, observe, reloadWorkspace() {
      readingState.clear();
      context?.root?.querySelectorAll('[data-investigation-ux]').forEach(node => node.remove());
      render();
    }, recordOperation(receipt) { if (/\/worldgraph\//.test(receipt.path || '')) custody = null; },
      destroy() { document.removeEventListener('omerta:fieldwork-rendered', afterFieldwork); document.removeEventListener('omerta:fieldwork-before-render', rememberReading); dialog?.remove(); } };
  };
})();
