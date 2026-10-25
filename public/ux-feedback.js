/* Action feedback uses confirmed server snapshots. Preferences contain no balances or credentials. */
(() => {
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const format = value => Math.abs(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const signed = (value, cash = false) => `${value < 0 ? '−' : '+'}${cash ? '$' : ''}${format(value)}`;
  const readPreferences = () => {
    try { return JSON.parse(localStorage.getItem('omerta_feedback') || '{}') || {}; } catch { return {}; }
  };
  const preferences = () => {
    const saved = readPreferences();
    return { volume: Math.max(0, Math.min(100, number(saved.volume ?? 70))), ambience: saved.ambience !== false,
      haptics: saved.haptics !== false, celebration: ['full', 'brief', 'quiet'].includes(saved.celebration) ? saved.celebration : 'full' };
  };
  function summarize(before, after, result) {
    if (!before || !after || result?.code >= 400) return { verified: false, changes: [], trades: [], milestones: [] };
    // A new generation is a different character, not a payday or a negative XP award.
    if (before.id && after.id && before.id !== after.id) return { verified: true, changedCharacter: true, changes: [], trades: [], milestones: [] };
    const changes = ['cash', 'bank', 'omr', 'respect', 'nerve', 'energy', 'health', 'heat'].flatMap(key => {
      if (before[key] == null || after[key] == null) return [];
      const delta = number(after[key]) - number(before[key]);
      return delta ? [{ key, delta }] : [];
    });
    const trades = (after.trades || []).flatMap(trade => {
      const previous = (before.trades || []).find(item => item.id === trade.id);
      if (!previous) return [];
      const xp = number(trade.xp) - number(previous.xp);
      return xp > 0 ? [{ id: trade.id, name: trade.name || trade.id, xp, level: number(trade.lvl),
        previousLevel: number(previous.lvl), remaining: trade.nextAt == null ? null : Math.max(0, number(trade.nextAt) - number(trade.xp)) }] : [];
    });
    const milestones = [];
    if (number(after.level) > number(before.level)) milestones.push({ label: `Level ${before.level} → ${after.level}`, tab: 'life' });
    for (const trade of trades) if (trade.level > trade.previousLevel) milestones.push({ label: `${trade.name} · rank ${trade.previousLevel} → ${trade.level}`, tab: 'life' });
    return { verified: true, changes, trades, milestones, netCash: changes.find(item => item.key === 'cash')?.delta || 0 };
  }
  function receiptMarkup(receipt) {
    const facts = receipt.feedback;
    if (!facts) return null;
    const result = receipt.outcome;
    const tone = receipt.state === 'error' ? 'error' : result === false ? 'setback' : 'success';
    const cash = facts.changes.find(change => change.key === 'cash');
    const hero = receipt.state === 'error' ? 'Move not confirmed' : result === false ? 'The job went sideways' : facts.changedCharacter ? 'A new chapter' :
      cash ? `${signed(cash.delta, true)} pocket change` : facts.milestones[0]?.label || 'Move recorded';
    const changes = facts.changes.filter(change => change.key !== 'cash').map(change =>
      `<span class="ux-change">${escape(change.key === 'omr' ? '$OMR' : change.key)} <b>${signed(change.delta, change.key === 'bank')}</b></span>`).join('');
    const trades = facts.trades.map(trade => `<div class="ux-receipt-trade"><b>${escape(trade.name)} +${format(trade.xp)} XP</b><span>${trade.remaining == null ? 'Mastered' : `${format(trade.remaining)} XP to next rank`}</span></div>`).join('');
    const recovery = receipt.recovery;
    return `<article class="operation-receipt operation-receipt--${tone} ux-receipt" data-operation-receipt="${receipt.id}">
      <div class="operation-receipt__head"><b>${escape(receipt.label)}</b><time datetime="${escape(receipt.atIso)}">${escape(receipt.at)}</time></div>
      <div class="ux-receipt-outcome">${escape(hero)}</div>
      ${tone !== 'success' ? `<div class="operation-receipt__summary">${escape(receipt.summary)}</div>` : ''}
      ${facts.verified ? `<div class="ux-changes">${changes}</div>${trades}` : `<div class="d">${escape(receipt.delta)}</div>`}
      ${facts.milestones.length ? `<div class="ux-milestone">${facts.milestones.map(item => escape(item.label)).join(' · ')}</div>` : ''}
      ${recovery ? `<div class="operation-receipt__recovery"><span>${escape(recovery.text)}</span>${recovery.run ? `<button class="act" data-operation-retry="${receipt.id}">${escape(recovery.label || 'try again')}</button>` : ''}${recovery.tab ? `<button class="act" data-operation-tab="${escape(recovery.tab)}">${escape(recovery.label || 'show me')}</button>` : ''}</div>` : ''}
      ${receipt.next && tone === 'success' ? `<button class="act ux-next" data-operation-tab="${escape(receipt.next.tab)}">${escape(receipt.next.label)} →</button>` : ''}
      ${tone === 'success' ? `<details class="ux-receipt-details"><summary>Full result and ledger</summary><div class="operation-receipt__summary">${escape(receipt.summary)}</div>${receipt.flavour ? `<p class="ux-receipt-flavour">${escape(receipt.flavour)}</p>` : ''}${receipt.cashBreakdown ? `<div class="ux-receipt-books">${escape(receipt.cashBreakdown)}</div>` : ''}</details>` : ''}
    </article>`;
  }
  function create({ getState, navigate, notify, getOrigin, syncAudio, celebrate }) {
    const repeats = new Map();
    const barWidths = new Map();
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches || preferences().celebration === 'quiet';
    let settings, settingsReturn;
    function openSettings() {
      if (settings?.open) return;
      settingsReturn = document.activeElement;
      if (!settings) {
        settings = document.createElement('dialog'); settings.className = 'ux-feedback-settings';
        settings.setAttribute('aria-labelledby', 'ux-feedback-title');
        document.body.append(settings);
        settings.addEventListener('close', () => settingsReturn?.isConnected && settingsReturn.focus());
      }
      const prefs = preferences();
      settings.innerHTML = `<form method="dialog"><div class="ux-settings-head"><h2 id="ux-feedback-title">Make yourself comfortable</h2><button class="act" aria-label="Close feedback preferences">Close</button></div>
        <p class="d">Presentation preferences for this browser. Your game rules stay the same.</p>
        <label>Effects volume <output id="ux-volume-output">${prefs.volume}%</output><input id="ux-effects-volume" type="range" min="0" max="100" value="${prefs.volume}"></label>
        <label><input id="ux-ambience" type="checkbox" ${prefs.ambience ? 'checked' : ''}> Ambient soundtrack</label>
        <label><input id="ux-haptics" type="checkbox" ${prefs.haptics ? 'checked' : ''}> Touch feedback on supported devices</label>
        <label>Celebrations <select id="ux-celebration"><option value="full">Full · cinematic milestones</option><option value="brief">Brief · inline milestones</option><option value="quiet">Quiet · static feedback</option></select></label>
        <p class="d">Your device’s reduced-motion preference always takes priority. The top-bar sound switch mutes all audio.</p></form>`;
      settings.querySelector('#ux-celebration').value = prefs.celebration;
      settings.oninput = saveSettings;
      settings.showModal();
    }
    function saveSettings() {
      const next = { volume: number(settings.querySelector('#ux-effects-volume').value), ambience: settings.querySelector('#ux-ambience').checked,
        haptics: settings.querySelector('#ux-haptics').checked, celebration: settings.querySelector('#ux-celebration').value };
      try { localStorage.setItem('omerta_feedback', JSON.stringify(next)); } catch { notify('Browser preferences could not be saved.', true); }
      settings.querySelector('#ux-volume-output').textContent = `${next.volume}%`;
      document.body.dataset.celebration = next.celebration;
      syncAudio?.();
    }
    function render() {
      document.body.dataset.celebration = preferences().celebration;
      const top = document.querySelector('#top');
      if (top && !top.querySelector('[data-feedback-settings]')) {
        const button = document.createElement('button'); button.type = 'button'; button.className = 'act ux-feedback-button';
        button.dataset.feedbackSettings = ''; button.textContent = 'Feel'; button.title = 'Sound, touch, and celebration preferences';
        button.setAttribute('aria-label', button.title); button.onclick = openSettings; top.append(button);
      }
      const me = getState().me;
      if (!me) return;
      const meters = '#sheet-body .bar, #tabbodies > .on .bar, #sheet-body .ux-progress-meter, #tabbodies > .on .ux-progress-meter';
      for (const node of document.querySelectorAll(meters)) {
        const bar = node.querySelector(':scope > i, :scope > .fill, :scope > span'); if (!bar) continue;
        const owner = node.closest('#sheet-body, #tabbodies > .on');
        const siblings = [...(owner?.querySelectorAll('.bar, .ux-progress-meter') || [])];
        const key = `${me.id}:${owner?.id}:${siblings.indexOf(node)}:${node.getAttribute('aria-label') || node.className}`;
        const target = bar.style.width, previous = barWidths.get(key); barWidths.set(key, target);
        if (previous && previous !== target && !reduced()) {
          bar.animate?.([{ width: previous }, { width: target }], { duration: 320, easing: 'ease-out' });
        }
      }
    }
    function enrich(receipt, before, after, result) {
      receipt.feedback = summarize(before, after, result);
      receipt.outcome = result?.body?.success;
      const facts = receipt.feedback;
      if (receipt.state !== 'error' && receipt.outcome !== false && /^\/v1\/crimes\//.test(receipt.path || '')) {
        const lines = ['You leave the scene. The books tell the rest.', 'Another entry in your street’s ledger.', 'The work is done. Your reputation carries on.'];
        const count = repeats.get(receipt.label) || 0; repeats.set(receipt.label, count + 1); receipt.flavour = lines[count % lines.length];
      }
      if (facts.verified && !facts.changedCharacter) {
        const gross = result?.body?.take ?? result?.body?.earned ?? result?.body?.payout;
        if (typeof gross === 'number' && gross > 0) receipt.cashBreakdown = `Reported payout $${format(gross)} · net pocket change ${signed(facts.netCash, true)} (all confirmed changes during this move).`;
        const milestone = facts.milestones[0];
        const coach = after?.coach;
        if (milestone) {
          const pathUnlocked = number(before.level) < 5 && number(after.level) >= 5;
          receipt.next = { tab: pathUnlocked ? 'streets' : milestone.tab, label: pathUnlocked ? 'Explore your Path unlock' : 'Review your new rank' };
        }
        else if (coach?.tab && coach.label) receipt.next = { tab: coach.tab, label: coach.label };
      }
      return receipt;
    }
    function recordOperation(receipt, before, after, result) {
      const facts = receipt.feedback || summarize(before, after, result);
      // The Sheet already celebrates character level-ups with their real unlock details.
      if (facts.milestones.length && number(after?.level) === number(before?.level) && preferences().celebration === 'full' && !reduced()) {
        celebrate?.({ kicker: 'YOUR WORK ADDS UP', title: facts.milestones[0].label, sub: 'A new milestone, recorded by the city.', fx: 'title' });
      }
      if (!facts.verified || facts.netCash <= 0 || reduced() || receipt.outcome === false || !getOrigin?.()) return;
      const origin = getOrigin(), target = [...document.querySelectorAll('#vitals .v-cash, #sheet-body .money')].find(node => {
        const rect = node.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.top < innerHeight && rect.right > 0 && rect.left < innerWidth;
      });
      if (!target) return;
      const end = target.getBoundingClientRect(); if (!end.width || !end.height) return;
      const token = document.createElement('span'); token.className = 'ux-reward-transfer'; token.textContent = signed(facts.netCash, true); token.setAttribute('aria-hidden', 'true');
      token.style.left = `${origin.left + origin.width / 2}px`; token.style.top = `${origin.top}px`; document.body.append(token);
      const animation = token.animate?.([{ transform: 'translate(-50%,0)', opacity: 1 }, { transform: `translate(${end.left - origin.left}px,${end.top - origin.top}px) scale(.7)`, opacity: 0 }], { duration: 480, easing: 'ease-out' });
      if (animation) animation.finished.catch(() => {}).finally(() => token.remove()); else token.remove();
      target.classList.add('ux-resource-changed'); setTimeout(() => target.classList.remove('ux-resource-changed'), 500);
    }
    return { render, enrich, recordOperation, receiptMarkup, openSettings };
  }
  create.summarize = summarize; create.receiptMarkup = receiptMarkup; create.preferences = preferences;
  window.createOmertaFeedback = create;
})();
