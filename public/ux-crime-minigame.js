// Every street job passes through this interactive lock. Only the server grades
// the submitted moves; the browser's progress and alarm display are feedback.
(() => {
  'use strict';
  const symbols = ['I', 'II', 'III', 'IV'];
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text != null) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  let active = false;

  window.playOmertaCrimeMinigame = async ({ path, approach = 'standard', request, label = 'Street job', returnFocus, isCurrent = () => true }) => {
    if (active || typeof request !== 'function') return null;
    active = true;
    const previousFocus = returnFocus || document.activeElement;
    const dialog = node('dialog', null, 'crime-minigame');
    dialog.setAttribute('aria-labelledby', 'crime-lock-title');
    dialog.setAttribute('aria-describedby', 'crime-lock-rules');
    const frame = node('div', null, 'crime-lock-frame');
    const eyebrow = node('p', 'REQUIRED · STREET JOB', 'crime-lock-eyebrow');
    const heading = node('h2', 'Crack the lock'); heading.id = 'crime-lock-title';
    const job = node('p', label, 'crime-lock-job');
    const rules = node('p', 'Memorize each signal, then repeat it on the pins. Each mistake cuts your crime odds by 15%. Three alarms fail the job.', 'crime-lock-rules');
    rules.id = 'crime-lock-rules';
    const status = node('p', 'Casing the lock…', 'crime-lock-status');
    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true');
    const board = node('div', null, 'crime-lock-board'); board.setAttribute('aria-busy', 'true');
    const terms = node('p', 'A clean lock keeps your full crime odds. Nerve and the street cooldown apply when the minigame ends.', 'crime-lock-terms');
    const cancel = node('button', 'Back out', 'act crime-lock-cancel'); cancel.type = 'button';
    frame.append(eyebrow, heading, job, rules, board, status, terms, cancel);
    dialog.append(frame); document.body.append(dialog);
    let finish;
    const result = new Promise(resolve => { finish = resolve; });
    let settled = false;
    const close = value => {
      if (settled) return;
      settled = true;
      finish(value);
    };
    cancel.onclick = () => close(null);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(null); });
    try {
      dialog.showModal();
      const response = await Promise.race([
        request('GET', `${path}/challenge?approach=${encodeURIComponent(approach)}`),
        result.then(() => null),
      ]);
      if (settled || !isCurrent()) return null;
      const game = response?.body?.minigame;
      if (response?.code !== 200 || game?.kind !== 'signal-lock' || !game.rounds?.length) {
        status.textContent = response?.body?.message || 'The lock could not be loaded. Back out and try again.';
        board.setAttribute('aria-busy', 'false');
        cancel.focus();
        return await result;
      }
      board.setAttribute('aria-busy', 'false');
      const moves = [];
      let round = 0, progress = 0, mistakes = 0, entering = false;
      const stages = node('ol', null, 'crime-lock-stages');
      const alarm = node('div', null, 'crime-lock-alarm');
      const sequence = node('div', null, 'crime-lock-sequence'); sequence.dataset.crimeSequence = '';
      const begin = node('button', 'Enter sequence', 'act prime crime-lock-begin');
      begin.type = 'button'; begin.dataset.crimeBegin = '';
      const pad = node('div', null, 'crime-lock-pads'); pad.setAttribute('role', 'group'); pad.setAttribute('aria-label', 'Lock pins');
      const buttons = symbols.map((symbol, index) => {
        const button = node('button', null, 'crime-lock-pad');
        button.type = 'button'; button.dataset.crimePad = String(index);
        button.setAttribute('aria-label', `Pin ${symbol} (${index + 1})`);
        button.append(node('span', symbol), node('small', `PIN ${index + 1}`));
        button.onclick = () => press(index);
        pad.append(button);
        return button;
      });
      board.append(stages, alarm, sequence, begin, pad);
      const render = () => {
        stages.replaceChildren(...game.rounds.map((_, index) => {
          const stage = node('li', `${index < round ? '✓' : index + 1} · ${['Outer lock', 'Inner lock', 'The release'][index] || 'Lock'}`);
          if (index === round) stage.setAttribute('aria-current', 'step');
          if (index < round) stage.className = 'complete';
          return stage;
        }));
        alarm.replaceChildren(node('span', 'ALARM'));
        for (let index = 0; index < game.maxMistakes; index++) alarm.append(node('i', null, index < mistakes ? 'tripped' : ''));
        alarm.append(node('span', `${mistakes}/${game.maxMistakes} · ${100 - mistakes * 15}% of crime odds`));
        alarm.setAttribute('aria-label', `${mistakes} of ${game.maxMistakes} alarms`);
        sequence.replaceChildren(...game.rounds[round].map((value, index) => {
          const chip = node('span', entering ? index < progress ? '✓' : '·' : symbols[value], entering && index < progress ? 'matched' : '');
          if (!entering) chip.dataset.crimeValue = String(value);
          return chip;
        }));
        sequence.setAttribute('aria-label', entering ? `${progress} of ${game.rounds[round].length} pins entered` : `Memorize: ${game.rounds[round].map(value => symbols[value]).join(', ')}`);
        begin.hidden = entering;
        buttons.forEach(button => { button.disabled = !entering; });
      };
      function press(value) {
        if (!entering || settled) return;
        if (!isCurrent()) { close(null); return; }
        if (Date.now() >= new Date(game.expiresAt).getTime()) {
          entering = false; render(); begin.hidden = true;
          status.textContent = 'The lock changed. Back out and start a fresh attempt.';
          cancel.focus(); return;
        }
        moves.push(value);
        if (value === game.rounds[round][progress]) {
          progress++;
          status.textContent = `Pin set. ${progress} of ${game.rounds[round].length}.`;
          if (progress === game.rounds[round].length) {
            round++; progress = 0; entering = false;
            if (round === game.rounds.length) { close({ token: game.token, moves }); return; }
            status.textContent = `Lock ${round} cleared. Memorize the next signal.`;
          }
        } else {
          mistakes++; progress = 0;
          if (mistakes >= game.maxMistakes) { close({ token: game.token, moves }); return; }
          status.textContent = `Wrong pin. Alarm ${mistakes} of ${game.maxMistakes}. Repeat this signal from the start.`;
        }
        render();
        if (!entering) begin.focus();
      }
      begin.onclick = () => {
        entering = true; render();
        status.textContent = `Repeat the ${game.rounds[round].length}-pin signal. Use the buttons or keys 1 to 4.`;
        buttons[0].focus();
      };
      dialog.addEventListener('keydown', event => {
        if (entering && /^[1-4]$/.test(event.key) && !event.ctrlKey && !event.altKey && !event.metaKey && !event.repeat) {
          event.preventDefault(); press(Number(event.key) - 1);
        }
      });
      render(); status.textContent = 'Study the signal. Select “Enter sequence” when you are ready.'; begin.focus();
      return await result;
    } catch {
      if (!settled) {
        board.setAttribute('aria-busy', 'false');
        status.textContent = 'The lock could not be loaded. Back out and try again.';
        cancel.focus();
        return await result;
      }
      return null;
    } finally {
      dialog.close(); dialog.remove(); active = false;
      if (previousFocus?.isConnected) previousFocus.focus();
      else {
        const replacement = [...document.querySelectorAll('[data-do]')].find(button => {
          if (button.dataset.do !== `POST ${path}`) return false;
          try { return (JSON.parse(button.dataset.body || '{}').approach || 'standard') === approach; }
          catch { return false; }
        });
        replacement?.focus();
      }
    }
  };
})();
