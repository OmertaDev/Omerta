// Structured clue trails render issued observations and choices. Answers always
// go through the authenticated action callback and the server's current scroll.
(() => {
  'use strict';
  const element = (tag, text, className) => { const node = document.createElement(tag); if (text != null) node.textContent = String(text); if (className) node.className = className; return node; };
  window.renderOmertaCluePuzzle = (slot, board, { action, refresh } = {}) => {
    const scroll = board?.scroll, puzzle = scroll?.interaction;
    if (!slot || puzzle?.version !== 2) return false;
    const card = element('section', null, 'card clue-puzzle');
    card.dataset.cluePuzzle = puzzle.kind;
    const heading = element('h3', 'The treasure trail');
    card.append(heading, element('p', `${scroll.tierName} · Step ${scroll.step} of ${scroll.of} · ${puzzle.kind}`, 'clue-puzzle-meta'),
      element('p', scroll.riddle, 'clue-puzzle-riddle'), element('p', puzzle.prompt));
    const observations = element('ul');
    for (const text of puzzle.observations || []) observations.append(element('li', text));
    card.append(observations);
    const hint = element('details'), hintTitle = element('summary', 'A hint, if you need it');
    hint.append(hintTitle, element('p', puzzle.hint)); card.append(hint);
    const form = element('form'), fieldset = element('fieldset'), legend = element('legend', 'Your deduction');
    fieldset.append(legend);
    for (const choice of puzzle.choices || []) {
      const label = element('label', null, 'clue-puzzle-choice'), input = element('input');
      input.type = 'radio'; input.name = 'clue-answer'; input.value = choice.id; input.required = true;
      label.append(input, element('span', choice.label)); fieldset.append(label);
    }
    const submit = element('button', `${puzzle.actionLabel || 'Submit deduction'} (${board.digEnergy} energy)`, 'act');
    submit.type = 'submit';
    const result = element('p', '', 'clue-puzzle-result'); result.setAttribute('role', 'status'); result.setAttribute('aria-live', 'polite');
    form.append(fieldset, submit, result); card.append(form);
    card.append(element('p', 'Travel to the district in the riddle first. Each deduction costs energy; a wrong answer keeps the current step.', 'clue-puzzle-meta'));
    let busy = false;
    form.onsubmit = async (event) => {
      event.preventDefault();
      const selected = form.querySelector('input[name="clue-answer"]:checked');
      if (busy || !selected || typeof action !== 'function') return;
      busy = true; submit.disabled = true; fieldset.disabled = true; result.textContent = 'Checking the evidence…';
      try {
        const reply = await action('POST', '/v1/clues/answer', { step: scroll.step, answerId: selected.value }, { label: 'Answer treasure trail clue' });
        // A replaced board belongs to a newer request or session. Never project
        // late action feedback into that replacement.
        if (!card.isConnected || !slot.contains(card)) return;
        const body = reply?.body || {};
        result.textContent = reply?.code >= 200 && reply.code < 300
          ? body.casket ? `Casket found: $${Number(body.take || 0).toLocaleString()}.` : body.ok ? 'The trail continues.' : body.hint || 'Review the evidence and try again.'
          : body.message || 'The deduction could not be confirmed. Refresh the trail.';
        if (typeof refresh === 'function') await refresh();
      } catch {
        if (card.isConnected && slot.contains(card)) result.textContent = 'The deduction could not be confirmed. Refresh the trail before trying again.';
      } finally { busy = false; submit.disabled = false; fieldset.disabled = false; }
    };
    slot.replaceChildren(card);
    return true;
  };
})();
