/* Optional authored scenes and private reading tools. All case facts arrive authorized. */
(function () {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const node = (tag, cls, text) => { const element = document.createElement(tag); if (cls) element.className = cls; if (text != null) element.textContent = String(text); return element; };
  const button = (text, run) => { const element = node('button', 'act', text); element.type = 'button'; element.onclick = run; return element; };
  const detail = title => { const element = node('details', 'story-disclosure'); element.append(node('summary', '', title)); return element; };
  const field = (text, tag = 'input') => { const label = node('label', 'story-field'), input = node(tag); label.append(node('span', '', text), input); input.setAttribute('aria-label', text); return { label, input }; };
  function clockLighting(clock) {
    const hour = Number(clock?.hour); if (!Number.isInteger(hour) || hour < 0 || hour > 23) return '';
    return hour < 5 ? 'night' : hour < 8 ? 'dawn' : hour < 18 ? 'day' : hour < 21 ? 'dusk' : 'night';
  }
  function validAnnotation(document, quote, noteText) {
    if (typeof quote !== 'string' || !quote.trim() || quote.length > 1000 || typeof noteText !== 'string' || noteText.length > 600) return null;
    const start = document.text.indexOf(quote); if (start < 0) return null;
    return { start, end: start + quote.length, quote, note: noteText.trim(), documentId: document.id, graphId: document.graphId };
  }
  const caseState = board => JSON.stringify([board.status, list(board.nodes).map(node => [node.id, node.status, node.available, node.blockedBy || [], node.uiActions || node.actions || []]), board.choices || []]);
  window.OmertaStoryModel = { clockLighting, validAnnotation };
  window.createOmertaStory = function ({ getState, read, navigate, notify, workspace }) {
    let owner = '', character = '', epoch = 0, context = null, overview = null, clock = null, dialog = null, lastTab = '', error = '';
    const cases = new Map(), pending = new Map(), memory = {}, openPanels = new Map();
    const state = () => getState() || {};
    const preferences = () => workspace?.get('story', {}) || memory[owner] || {};
    const update = patch => { const value = { ...preferences(), ...patch }; memory[owner] = value; workspace?.set('story', value); };
    const activeOwner = () => String(state().session?.accountId || state().me?.accountId || state().me?.id || '');
    const activeCharacter = () => String(state().me?.id || '');
    function scope() {
      const next = activeOwner(), actor = activeCharacter();
      if (next !== owner || actor !== character) {
        owner = next; character = actor; epoch++; context = null; overview = clock = null; lastTab = ''; error = ''; cases.clear(); pending.clear(); openPanels.clear();
        dialog?.close(); dialog?.remove(); dialog = null;
        document.querySelectorAll('[data-ux-story]').forEach(element => element.remove()); delete document.body.dataset.storyLighting;
      }
      return !!owner && !!state().me;
    }
    async function request(path) {
      if (pending.has(path)) return pending.get(path);
      const who = owner, actor = character, version = epoch;
      const result = Promise.resolve(read(path)).then(reply => {
        if (activeOwner() !== who || activeCharacter() !== actor || epoch !== version) return null;
        if (reply?.code !== 200) { error = 'The optional story file could not be read. You can continue using the issued case controls.'; return null; }
        error = ''; if (reply.body?.clock) clock = reply.body.clock; return reply.body;
      }).catch(() => { if (epoch === version) error = 'The optional story file is unavailable. Try again when you choose.'; return null; }).finally(() => { if (epoch === version) pending.delete(path); });
      pending.set(path, result); return result;
    }
    function lighting() {
      const value = clockLighting(clock || state().me?.city); if (value) document.body.dataset.storyLighting = value;
    }
    function mount(parent, key, factory, signature) {
      if (!parent) return;
      let root = parent.querySelector(`:scope > [data-ux-story="${key}"]`);
      if (root?.dataset.signature === signature) return;
      if (root?.contains(document.activeElement) && document.activeElement.matches('input,select,textarea')) return;
      if (!root) { root = node('section', 'ux-story'); root.dataset.uxStory = key; root.dataset.uxPanel = 'story-' + key; parent.append(root); }
      root.querySelectorAll('details[data-story-section]').forEach(element => openPanels.set(`${key}:${element.dataset.storySection}`, element.open));
      root.replaceChildren(factory()); root.dataset.signature = signature;
      root.querySelectorAll('details[data-story-section]').forEach(element => {
        const id = `${key}:${element.dataset.storySection}`; if (openPanels.has(id)) element.open = openPanels.get(id);
        element.querySelector(':scope > summary')?.addEventListener('click', () => openPanels.set(id, !element.open));
        element.addEventListener('toggle', () => { if (element.isConnected) openPanels.set(id, element.open); });
      });
      document.dispatchEvent(new CustomEvent('omerta:story-rendered', { detail: { root, graphId: key === 'case' ? context?.mysteryDetail?.graph?.id || '' : '', nodes: key === 'case' ? list(context?.mysteryDetail?.nodes) : [] } }));
      document.dispatchEvent(new CustomEvent('omerta:ux-panels-changed'));
    }
    function constellation(cast) {
      const root = detail('The residents in your story'); root.dataset.storySection = 'cast';
      root.append(node('p', 'story-note', 'These are authored city residents known from your revealed case dialogue. Lines mean they appear in the same case file; they do not measure affection, online presence or another player’s activity.'));
      const graph = node('div', 'story-constellation');
      graph.append(node('strong', 'story-constellation-center', state().me.name));
      for (const person of cast) {
        const card = button(person.name, () => residentScene(person)); card.className = 'story-cast-node';
        const portrait = node('img'); portrait.src = `/v1/avatar/${encodeURIComponent('story:' + person.name)}`; portrait.alt = ''; portrait.loading = 'lazy';
        card.prepend(portrait); card.append(node('small', '', person.role), node('span', 'story-resident-label', 'RESIDENT · NPC'));
        graph.append(card);
      }
      root.append(graph);
      if (!cast.length) root.append(node('p', '', 'Open a case and read a resident’s revealed dialogue to begin this constellation.'));
      const connections = node('ul', 'story-relationship-list');
      for (const person of cast) connections.append(node('li', '', `${person.name}: ${person.references?.some(reference => reference.status === 'completed') ? 'you completed a conversation or step in their file' : 'mentioned in dialogue revealed to you'} · ${person.place}`));
      root.append(connections); return root;
    }
    function newDialog(title) {
      dialog?.remove(); dialog = node('dialog', 'story-dialog'); dialog.setAttribute('aria-label', title);
      const heading = node('header'); heading.append(node('h2', '', title), button('Close story reading', () => dialog.close())); dialog.append(heading); document.body.append(dialog); return dialog;
    }
    function residentScene(person) {
      const panel = newDialog(person.name); panel.append(node('span', 'story-resident-label', 'AUTHORED RESIDENT SCENE · NPC'), node('p', '', `${person.role} · ${person.place}`));
      const portrait = node('img', 'story-resident-portrait'); portrait.src = `/v1/avatar/${encodeURIComponent('story:' + person.name)}`; portrait.alt = `${person.name}, ${person.expression}`;
      panel.append(portrait, node('p', 'story-scene-prose', person.scene), node('p', 'story-note', 'A reading scene unlocked by known dialogue. It asserts no live player presence and changes no relationship score or reward.')); panel.showModal();
    }
    function coldOpen(story) {
      if (!story.opening) return null;
      const saved = preferences(), skipped = list(saved.skippedOpenings).includes(story.instanceId);
      const root = node('section', 'story-cold-open');
      if (skipped) { root.append(button('Reread the opening vignette', () => { update({ skippedOpenings: list(saved.skippedOpenings).filter(id => id !== story.instanceId) }); render(); })); return root; }
      root.append(node('span', 'story-eyebrow', 'OPTIONAL OPENING VIGNETTE'), node('h3', '', story.opening.title), node('p', '', story.opening.text),
        button('Skip this opening', () => { update({ skippedOpenings: [...new Set([...list(saved.skippedOpenings), story.instanceId])] }); render(); }));
      return root;
    }
    function epilogue(story) {
      if (!story.epilogue) return null;
      const root = detail('After the case: your recorded approach'); root.dataset.storySection = `epilogue:${story.instanceId}`;
      root.append(node('span', 'story-eyebrow', 'ACTUAL COMPLETED CASE · AUTHORED EPILOGUE'), node('h3', '', story.epilogue.title), node('p', '', story.epilogue.text)); return root;
    }
    function letters(entries) {
      const root = detail('Letters from completed stories'); root.dataset.storySection = 'letters';
      if (!entries.length) root.append(node('p', '', 'Letters open only when their case milestone has actually been completed.'));
      for (const letter of entries) {
        const read = list(preferences().readLetters).includes(letter.id), article = detail(`${read ? 'Read · ' : 'Unread · '}${letter.subject}`); article.className += ' story-letter'; article.dataset.storySection = letter.id;
        article.append(node('span', 'story-eyebrow', `FROM ${letter.from.toUpperCase()} · AUTHORED NPC LETTER`), node('p', '', letter.text),
          node('small', 'story-note', 'Unlocked by your confirmed completed case. This is story prose, not a player message or an additional reward.'),
          button(read ? 'Mark letter unread' : 'Mark letter read', () => { const ids = list(preferences().readLetters); update({ readLetters: read ? ids.filter(id => id !== letter.id) : [...new Set([...ids, letter.id])] }); render(); })); root.append(article);
      }
      return root;
    }
    function crossover(scene) {
      if (!scene) return null;
      const root = detail('An encounter between two completed stories'); root.dataset.storySection = 'crossover';
      root.append(node('span', 'story-eyebrow', 'OPTIONAL CROSSOVER · BOTH CASES COMPLETED'), node('h3', '', scene.title), node('p', 'story-scene-prose', scene.text), node('small', 'story-note', 'An authored reading scene unlocked by both actual case records. No further action, reward or relationship change is implied.')); return root;
    }
    function expressive(story) {
      const root = detail('Read optional expressive dialogue'); root.dataset.storySection = 'expressive';
      const label = node('label', 'story-check'), toggle = node('input'); toggle.type = 'checkbox'; toggle.checked = !!preferences().expressive;
      label.append(toggle, document.createTextNode('Show the authored expressive reading beside the original case')); toggle.onchange = () => { const enabled = toggle.checked; toggle.blur(); update({ expressive: enabled }); render(); };
      root.append(label, node('p', 'story-note', 'This changes only an optional reading. The original dialogue, choices, costs, consequences and issued controls remain the authority.'));
      if (toggle.checked) for (const variant of list(story.variants)) {
        const article = node('article', 'story-dialogue-variant'); article.dataset.storyNode = variant.nodeId;
        article.append(node('strong', '', `${variant.speaker} · ${variant.expression || 'speaking'}`), node('p', '', variant.text));
        const terms = node('aside', 'story-action-terms'); terms.append(node('strong', '', 'Actual issued action terms'));
        if (!list(variant.actionTerms).length) terms.append(node('p', '', 'This recorded step currently has no issued action.'));
        for (const action of list(variant.actionTerms)) terms.append(node('p', '', `${action.label} · ${action.available ? 'currently listed as available' : 'currently unavailable'} · ${action.consequence}`));
        article.append(terms); root.append(article);
      }
      return root;
    }
    function appendAnnotated(parent, documentRecord) {
      const source = documentRecord.text, annotations = list(preferences().annotations).filter(annotation => annotation.documentId === documentRecord.id
        && annotation.graphId === documentRecord.graphId && source.slice(annotation.start, annotation.end) === annotation.quote).sort((a, b) => a.start - b.start);
      let at = 0;
      for (const annotation of annotations) {
        if (annotation.start < at) continue;
        parent.append(document.createTextNode(source.slice(at, annotation.start))); const mark = node('mark', 'story-private-highlight', annotation.quote); mark.title = annotation.note || 'Your private highlight'; parent.append(mark); at = annotation.end;
      }
      parent.append(document.createTextNode(source.slice(at)));
    }
    function annotationForm(documents, onSaved) {
      const root = detail('Highlight and annotate a revealed passage'); root.open = true;
      const selected = field('Document to annotate', 'select'), quote = field('Exact passage to highlight', 'textarea'), noteText = field('Your private annotation', 'textarea'); quote.input.maxLength = 1000; noteText.input.maxLength = 600;
      for (const entry of documents) { const option = node('option', '', entry.title); option.value = entry.id; selected.input.append(option); }
      root.append(selected.label, quote.label, noteText.label, node('p', 'story-note', 'Paste an exact passage or select text in a transcription and use its highlight button. Notes are private account workspace data; they submit no case answer.'),
        button('Save private highlight', () => {
          const source = documents.find(entry => entry.id === selected.input.value), annotation = source && validAnnotation(source, quote.input.value, noteText.input.value);
          if (!annotation) { notify('Choose an exact passage present in the revealed document.'); return; }
          update({ annotations: [...list(preferences().annotations), { ...annotation, id: crypto.randomUUID() }].slice(-80) }); onSaved();
        }));
      return { root, select: (id, text) => { selected.input.value = id; quote.input.value = text; quote.input.focus(); } };
    }
    function compareDocuments(documents) {
      if (documents.length < 2) return;
      const panel = newDialog('Compare found documents'), selectors = node('div', 'story-compare-selectors');
      const left = field('Left found document', 'select'), right = field('Right found document', 'select'), zoom = field('Synchronized document zoom'); zoom.input.type = 'range'; zoom.input.min = 100; zoom.input.max = 220; zoom.input.value = 100;
      for (const entry of documents) for (const input of [left.input, right.input]) { const option = node('option', '', entry.title); option.value = entry.id; input.append(option); }
      left.input.value = documents[0].id; right.input.value = documents[1].id; selectors.append(left.label, right.label); panel.append(selectors, zoom.label);
      const columns = node('div', 'story-document-columns'), forms = node('div'), transcriptState = new Map(); panel.append(columns, forms);
      const annotation = annotationForm(documents, () => paint()); forms.append(annotation.root);
      const paint = () => {
        columns.querySelectorAll('details').forEach(element => transcriptState.set(element.dataset.storyTranscript, element.open)); columns.replaceChildren();
        for (const id of [left.input.value, right.input.value]) {
          const entry = documents.find(document => document.id === id), section = node('section', 'story-found-document'); section.dataset.storyDocument = id;
          section.append(node('h3', '', entry.title));
          const viewport = node('div', 'story-document-viewport'), art = node('article', `story-document-paper story-document-paper--${['letter', 'receipt', 'ledger', 'notice', 'survey', 'telegram'].includes(entry.form) ? entry.form : 'letter'}`);
          art.append(node('span', 'story-eyebrow', entry.form || 'document'), node('h4', '', entry.title)); const passage = node('p'); appendAnnotated(passage, entry); art.append(passage); art.style.transform = `scale(${Number(zoom.input.value) / 100})`; viewport.append(art); section.append(viewport);
          const transcript = detail(`Transcription: ${entry.title}`); transcript.dataset.storyTranscript = id; transcript.open = transcriptState.has(id) ? transcriptState.get(id) : true;
          const text = node('p', 'story-transcript-text'); appendAnnotated(text, entry); transcript.append(text,
            button('Highlight selected passage', () => { const selection = window.getSelection(); if (!selection?.toString() || !text.contains(selection.anchorNode) || !text.contains(selection.focusNode)) { notify('Select a passage within this document’s transcription first.'); return; } annotation.select(id, selection.toString()); }));
          for (const item of list(preferences().annotations).filter(item => item.documentId === id && item.graphId === entry.graphId && entry.text.slice(item.start, item.end) === item.quote)) {
            const noteRow = node('aside', 'story-annotation-note'); noteRow.append(node('strong', '', 'Your note'), node('p', '', item.note || 'Private highlight'),
              button('Remove private annotation', () => { update({ annotations: list(preferences().annotations).filter(value => value.id !== item.id) }); paint(); })); transcript.append(noteRow);
          }
          section.append(transcript); columns.append(section);
        }
        document.dispatchEvent(new CustomEvent('omerta:story-rendered', { detail: { root: panel, graphId: documents[0]?.graphId, nodes: documents.map(entry => ({ id: entry.id, title: entry.title, text: entry.text })) } }));
      };
      const choose = event => { if (left.input.value === right.input.value) { notify('Choose two different found documents.'); event.target.value = documents.find(entry => entry.id !== (event.target === left.input ? right.input.value : left.input.value)).id; } paint(); };
      left.input.onchange = choose; right.input.onchange = choose; zoom.input.oninput = () => columns.querySelectorAll('.story-document-paper').forEach(element => element.style.transform = `scale(${Number(zoom.input.value) / 100})`);
      paint(); panel.showModal();
    }
    function documentsPanel(story) {
      const root = detail('Read and compare your found documents'); root.dataset.storySection = 'documents';
      const documents = list(story.documents);
      if (documents.length >= 2) root.append(button('Compare two found documents', () => compareDocuments(documents)));
      else root.append(node('p', 'story-note', 'Side-by-side comparison opens after two distinct documents are actually revealed.'));
      for (const entry of documents) {
        const article = detail(entry.title); article.dataset.storyTranscript = entry.id;
        const text = node('p', 'story-transcript-text'); appendAnnotated(text, entry); article.append(text); root.append(article);
      }
      if (documents.length) {
        const form = annotationForm(documents, () => render()); root.append(form.root);
        for (const item of list(preferences().annotations).filter(item => documents.some(entry => entry.id === item.documentId && entry.graphId === item.graphId && entry.text.slice(item.start, item.end) === item.quote))) {
          const note = node('aside', 'story-annotation-note'); note.append(node('strong', '', 'Your private annotation'), node('blockquote', '', item.quote), node('p', '', item.note),
            button('Remove private annotation', () => { update({ annotations: list(preferences().annotations).filter(value => value.id !== item.id) }); render(); })); root.append(note);
        }
      }
      return root;
    }
    function casePanel(story) {
      const root = node('div'); const opening = coldOpen(story); if (opening) root.append(opening);
      root.append(constellation(story.cast), documentsPanel(story), expressive(story)); const ending = epilogue(story); if (ending) root.append(ending); root.append(letters(story.letters));
      return root;
    }
    async function onFieldwork(event) {
      if (!scope() || !event.detail?.root?.isConnected) return;
      if (event.detail.characterId && event.detail.characterId !== character) return;
      context = event.detail; const graphId = context.mysteryDetail?.graph?.id;
      if (!graphId || context.view !== 'mysteries' || context.loading || context.busy) return;
      const expected = caseState(context.mysteryDetail);
      if (cases.get(graphId)?.caseState !== expected) cases.delete(graphId);
      const version = epoch, result = cases.get(graphId) || await request('/v1/ux/story/' + encodeURIComponent(graphId));
      if (version !== epoch || context?.mysteryDetail?.graph?.id !== graphId) return;
      if (result?.caseState === caseState(context.mysteryDetail)) cases.set(graphId, result);
      render();
    }
    async function render() {
      if (!scope()) return; lighting(); const tab = state().currentTab;
      if (tab === 'fieldwork' && context?.root?.isConnected && context.view === 'mysteries' && !context.loading && !context.busy) {
        const graphId = context.mysteryDetail?.graph?.id, story = cases.get(graphId);
        if (story) mount(context.root, 'case', () => casePanel(story), JSON.stringify([story, preferences()]));
        else if (error) mount(context.root, 'case', () => { const root = node('div'); root.append(node('p', '', error), button('Retry optional story file', () => onFieldwork({ detail: context }))); return root; }, error);
      }
      if (!['profile', 'map', 'city'].includes(tab)) { lastTab = tab; return; }
      const entered = tab !== lastTab; lastTab = tab;
      const version = epoch;
      if (!overview && entered) { const result = await request('/v1/ux/story'); if (version === epoch) overview = result; }
      if (version !== epoch || state().currentTab !== tab || !scope()) return; lighting();
      const parent = document.getElementById(`tab-${tab}`);
      if (!overview) {
        if (error) mount(parent, 'overview', () => { const root = node('div'); root.append(node('p', '', error), button('Retry optional story records', async () => { const version = epoch, result = await request('/v1/ux/story'); if (version === epoch && result) overview = result; render(); })); return root; }, error);
        return;
      }
      mount(parent, 'overview', () => {
        const root = node('div'); root.append(node('h3', '', 'The people between the pages'), node('p', 'story-clock', `City lighting: ${clockLighting(clock)} · server city hour ${clock?.hour ?? 'unavailable'} UTC`), constellation(overview.cast));
        for (const story of list(overview.cases)) { const ending = epilogue(story); if (ending) root.append(ending); }
        root.append(letters(list(overview.cases).flatMap(story => list(story.letters)))); const scene = crossover(overview.crossover); if (scene) root.append(scene);
        root.append(button('Refresh confirmed story records', async () => { const version = epoch, updated = await request('/v1/ux/story'); if (version === epoch && updated) overview = updated; render(); })); return root;
      }, JSON.stringify([overview, preferences(), clock]));
    }
    function observe(path, body) {
      if (!scope()) return;
      if (path === '/v1/me') { const me = body?.character || body; if (me?.city && clockLighting(me.city)) clock = { ...clock, ...me.city }; lighting(); }
      else if (path === '/v1/city' && body?.clock) { clock = { ...clock, ...body.clock }; lighting(); }
      else if (/^\/v1\/worldgraph\/mysteries\/[^/]+$/.test(path) && body?.graph?.id) {
        const old = cases.get(body.graph.id); if (old?.caseState !== caseState(body)) cases.delete(body.graph.id);
      }
    }
    document.addEventListener('omerta:fieldwork-rendered', onFieldwork);
    return { render, observe, reloadWorkspace() { openPanels.clear(); document.querySelectorAll('[data-ux-story]').forEach(element => element.remove()); render(); },
      recordOperation(receipt) { if (/\/worldgraph\/mysteries\//.test(receipt.path || '')) overview = null; },
      destroy() { document.removeEventListener('omerta:fieldwork-rendered', onFieldwork); dialog?.remove(); delete document.body.dataset.storyLighting; } };
  };
})();
