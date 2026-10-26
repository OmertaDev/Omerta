/* Navigation comforts are local presentation. Game actions keep their original controls. */
(function () {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const list = (value) => Array.isArray(value) ? value : [];
  const INTERESTS = {
    gun: { name: 'The Gun', tabs: ['streets', 'crew', 'pvp'], why: ['Read the gym costs and improve your build.', 'Find allies before choosing a fight.', 'Read target protections, costs, and risks before acting.'] },
    ledger: { name: 'The Ledger', tabs: ['streets', 'empire', 'portfolio'], why: ['Read a job’s costs and take.', 'Explore operations and their requirements.', 'Understand the separate cash and $OMR ledgers.'] },
    kitchen: { name: 'The Kitchen', tabs: ['streets', 'kitchen', 'crew'], why: ['Learn how nerve and heat work.', 'Read ingredients, batch timers, and dealing costs.', 'Learn how people work together.'] },
    wheel: { name: 'The Wheel', tabs: ['garage', 'city', 'port'], why: ['Read the shared vehicle theft timer and costs.', 'Compare the districts before traveling.', 'Explore freight requirements and risks.'] },
    shadow: { name: 'The Shadow', tabs: ['streets', 'law', 'wire'], why: ['Compare quiet and standard job approaches.', 'Learn how heat changes your options.', 'Read intelligence requirements before spending.'] },
    ring: { name: 'The Ring', tabs: ['streets', 'boxing', 'crew'], why: ['Read the training costs and cooldown.', 'Explore fighter training and card requirements.', 'Meet people who share your interests.'] },
  };
  const RULES = {
    streets: ['Jobs, nerve, and heat', 'Read COST, PAY, and RISK on the job before choosing an approach. Nerve and any cooldown listed by the current board are separate requirements.', '/wiki#coreloop'],
    life: ['Training and Paths', 'Training uses energy and the gym clock. A quiz result is an interest: declare a Path through the in-game selector only after its level and cost requirements are met.', '/wiki#paths'],
    garage: ['Vehicle theft', 'Boosts and vehicle theft share one clock. Read the costs and chance shown on the activity before attempting it.', '/wiki#cars'],
    kitchen: ['Batches and dealing', 'Check the ingredients, current batch timer, and dealing costs before acting. A finished batch has its own collection control.', '/wiki#kitchen'],
    empire: ['Operations', 'An operation needs an available slot and its listed purchase price. Read its income and recurring obligations before buying.', '/wiki#business'],
    portfolio: ['Two ledgers', 'Street cash and $OMR have separate ledgers. Read the current feature status and the quote before committing funds.', '/wiki#economy'],
    pvp: ['Target protections', 'Read the target’s protection, equipment requirements, and action costs. A cooldown ending alone does not make a target eligible.', '/wiki#pvp'],
    crew: ['Working together', 'Read the current objective and its contribution requirements. Joining a crew does not automatically contribute resources.', '/wiki#families'],
    law: ['Your current case', 'Review your current heat and docket before selecting a response. Read the cost and consequences beside the action.', '/wiki#law'],
    desk: ['Cases and evidence', 'Follow the choices issued for the current case. Read an action’s requirements before submitting evidence or materials.', '/wiki#worldgraph'],
    fieldwork: ['Fieldwork', 'Use the choices and item requirements on the current board. Explore the journal to keep your place in an investigation.', '/wiki#worldgraph'],
  };
  const PATHS = {
    cash: '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="12" cy="12" r="3"/><path d="M5 12h1m12 0h1"/>',
    respect: '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
    energy: '<path d="m14 2-9 12h7l-2 8 9-12h-7Z"/>',
    nerve: '<path d="M9 4a3 3 0 0 0-5 3v2a4 4 0 0 0 0 6v2a3 3 0 0 0 5 3m6-16a3 3 0 0 1 5 3v2a4 4 0 0 1 0 6v2a3 3 0 0 1-5 3M12 3v18M5 10h3m8 4h3M8 17v-3m8-7v3"/>',
    heat: '<path d="M12 3c1 5 6 6 6 12a6 6 0 0 1-12 0c0-3 2-6 3-7 0 3 1 4 2 4 2-2 2-5 1-9Z"/>',
    health: '<path d="M20 5c-3-3-6 0-8 2-2-2-5-5-8-2-4 4 1 9 8 15 7-6 12-11 8-15Z"/>',
  };
  const icon = (kind) => PATHS[kind] ? `<svg class="ux-resource-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[kind]}</svg>` : '';
  const readStore = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } };
  const writeStore = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Private browsing remains usable. */ } };
  const fieldKey = (el, index) => `${el.tagName}:${el.type || ''}:${el.id || el.name || index}`;
  const safeField = (el) => !el.disabled && !el.readOnly && !['password', 'hidden', 'file'].includes(el.type)
    && !/token|secret|password|provider|credential/i.test(`${el.id} ${el.name}`);

  window.createOmertaNavigation = function ({ getState, navigate, notify = () => {}, workspace }) {
    let account = '', key = '', favorites = [], resume = null, lastActivity = null, previousTab = '', lastMe = null;
    let clocks = [], snapshot = null, mobilePocket = null, activeInterest = '', tourStep = 0;
    const dirty = new WeakSet(), delivered = new Set();
    const $ = (selector) => document.querySelector(selector);
    const catalog = () => [...document.querySelectorAll('#tabs [data-tab]')].map((b) => ({ id: b.dataset.tab, name: b.textContent.trim() || b.dataset.tab }));
    const title = (id) => catalog().find((c) => c.id === id)?.name || String(id).replace(/[_-]/g, ' ');
    const go = (id) => { if (catalog().some((c) => c.id === id)) navigate(id); };
    const state = () => getState() || {};
    const activePanel = () => document.getElementById(`tab-${state().currentTab}`);
    const ensureAccount = () => {
      const me = state().me;
      const next = me ? String(me.accountId || me.id || me.name || '') : '';
      if (next === account) return;
      restorePocket(); account = next; key = `omerta_ux_navigation:${next}`;
      const saved = readStore(key, {});
      favorites = list(saved.favorites).filter((id) => typeof id === 'string').slice(0, 3);
      resume = saved.resume && typeof saved.resume.tab === 'string' ? saved.resume : null;
      lastActivity = resume; previousTab = ''; lastMe = null; snapshot = null; clocks = []; delivered.clear(); activeInterest = ''; tourStep = 0;
    };
    const save = (passive = false) => { if (account) { const value = { favorites, resume: lastActivity || resume }; writeStore(key, value); workspace?.set('navigation', value, { passive }); } };
    function mountStrip() {
      let strip = $('#ux-navigation');
      const tabs = $('#tabs');
      if (!tabs) return null;
      let tools = $('#ux-screen-tools');
      if (!tools) {
        tools = document.createElement('details'); tools.id = 'ux-screen-tools'; tools.className = 'ux-screen-tools';
        tools.innerHTML = '<summary>Screen tools</summary><div class="ux-screen-tools-body"><button class="act ux-screen-tools-close" type="button">Close screen tools</button></div>';
        const mobile = matchMedia('(max-width:760px)'); tools.open = !mobile.matches;
        mobile.addEventListener('change', () => { tools.open = !mobile.matches; });
        tools.querySelector('.ux-screen-tools-close').onclick = () => { tools.open = false; tools.querySelector(':scope > summary').focus(); };
        tools.addEventListener('keydown', event => { if (event.key === 'Escape' && mobile.matches) { tools.open = false; tools.querySelector(':scope > summary').focus(); } });
        tabs.before(tools);
      }
      if (!strip) { strip = document.createElement('nav'); strip.id = 'ux-navigation'; strip.className = 'ux-navigation'; strip.setAttribute('aria-label', 'Your shortcuts'); tools.querySelector('.ux-screen-tools-body').append(strip); }
      return strip;
    }
    function renderStrip() {
      const strip = mountStrip();
      if (!strip) return;
      const { currentTab } = state(), ids = new Set(catalog().map((c) => c.id));
      // Workspace hydration can complete before boot builds the operation tabs.
      // An empty, not-yet-mounted catalog cannot invalidate intentional favorites.
      if (!ids.size) return;
      favorites = favorites.filter((id) => ids.has(id));
      const pinned = favorites.includes(currentTab);
      const resumeValid = resume && ids.has(resume.tab) && resume.tab !== currentTab && Date.now() - Number(resume.at) < 30 * 86400000;
      const markup = `<div class="ux-shortcuts"><span class="ux-kicker">FAVORITES</span>${favorites.map((id) => `<button type="button" class="act ux-shortcut" data-ux-go="${esc(id)}"${id === currentTab ? ' aria-current="page"' : ''}>${esc(title(id))}</button>`).join('')}
        <button type="button" class="act ux-pin" data-ux-pin aria-pressed="${pinned}" title="Keep up to three activities close">${pinned ? 'Unpin' : 'Pin this screen'}</button>
        <button type="button" class="act ux-search" data-ux-search>Find an activity <kbd>Ctrl K</kbd></button></div>
        ${resumeValid ? `<button type="button" class="ux-resume" data-ux-go="${esc(resume.tab)}">Continue ${esc(title(resume.tab))} <span>last visited ${esc(new Date(resume.at).toLocaleDateString())}</span> →</button>` : ''}
        <div id="ux-readiness" class="ux-readiness" aria-label="Activity clocks"></div>`;
      // Avoid replacing a focused shortcut when live state changes.
      if (strip.dataset.markup !== markup) {
        const focused = strip.contains(document.activeElement) ? document.activeElement?.getAttribute('data-ux-go') || (document.activeElement?.hasAttribute('data-ux-pin') ? 'pin' : 'search') : '';
        strip.innerHTML = markup; strip.dataset.markup = markup;
        strip.querySelectorAll('[data-ux-go]').forEach((b) => b.onclick = () => go(b.dataset.uxGo));
        strip.querySelector('[data-ux-pin]').onclick = () => {
          const pinnedTab = state().currentTab;
          if (favorites.includes(pinnedTab)) favorites = favorites.filter((id) => id !== pinnedTab);
          else if (favorites.length < 3) favorites.push(pinnedTab);
          else { notify('Three favorites are pinned. Unpin a screen to make room.'); return; }
          save(); renderStrip(); tickClocks();
        };
        strip.querySelector('[data-ux-search]').onclick = () => $('#btn-jump')?.click();
        if (focused) [...strip.querySelectorAll('button')].find((b) => b.dataset.uxGo === focused || (focused === 'pin' && b.hasAttribute('data-ux-pin')) || (focused === 'search' && b.hasAttribute('data-ux-search')))?.focus({ preventScroll: true });
      }
    }
    function syncClocks() {
      const { me } = state();
      if (!me) return;
      // The host may return a fresh presentation copy of me on every read. Only a new
      // cooldown projection or an observed /me response may restart these clocks.
      const signature = JSON.stringify([me.id, me.streetActionSeconds, me.trainSeconds, me.gtaSeconds,
        me.heistSeconds, !!me.gang, me.missionSeconds, me.batch?.drug, me.batch?.readySeconds]);
      if (signature === lastMe) return;
      lastMe = signature;
      const now = Date.now(), old = new Map(clocks.map((c) => [c.id, c]));
      const specs = [
        ['street', 'Street jobs', 'streets', me.streetActionSeconds],
        ['gym', 'Gym', 'streets', me.trainSeconds],
        ['vehicles', 'Vehicle theft', 'garage', me.gtaSeconds],
        ['heist', 'Heist', 'scores', me.heistSeconds],
        ...(me.gang ? [['mission', 'Family mission', 'family', me.missionSeconds]] : []),
        ...(me.batch ? [['batch', 'Batch collection', 'kitchen', me.batch.readySeconds]] : []),
      ];
      clocks = specs.filter((c) => c[3] != null && Number.isFinite(Number(c[3]))).map(([id, label, tab, seconds]) => {
        const end = now + Math.max(0, Number(seconds)) * 1000;
        const prior = old.get(id);
        const wasWaiting = Number(seconds) > 0 || !!prior?.wasWaiting;
        if (Number(seconds) > 0 && (!prior || prior.end < now)) delivered.delete(id);
        return { id, label, tab, end, wasWaiting };
      });
    }
    function tickClocks() {
      const dock = $('#ux-readiness');
      if (!dock || !state().me) return;
      const now = Date.now();
      const available = clocks.filter((c) => catalog().some((d) => d.id === c.tab));
      const waiting = available.filter((c) => c.end > now).sort((a, b) => a.end - b.end);
      const done = available.filter((c) => c.end <= now);
      const show = [...done.filter((c) => c.wasWaiting), ...waiting, ...done.filter((c) => !c.wasWaiting)].slice(0, 3);
      const markup = `<span class="ux-kicker">ACTIVITY CLOCKS</span>${show.map((c) => {
        const remaining = Math.max(0, Math.ceil((c.end - now) / 1000));
        const changed = c.wasWaiting && remaining === 0 && !delivered.has(c.id);
        if (changed) { delivered.add(c.id); notify(`${c.label} cooldown ended. Check the board for current requirements.`); }
        const time = remaining ? `${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2, '0')}` : c.id === 'batch' ? 'Check collection' : 'Clock clear';
        return `<button type="button" class="ux-clock${changed ? ' ux-clock--ready' : ''}" data-ux-clock="${esc(c.tab)}" title="The server checks all requirements when you act"><span>${esc(c.label)}</span><b>${time}</b></button>`;
      }).join('')}<small>Clocks only · open a board to check all requirements.</small>`;
      if (dock.dataset.markup !== markup) {
        const focus = dock.contains(document.activeElement) ? document.activeElement?.dataset.uxClock : '';
        dock.innerHTML = markup; dock.dataset.markup = markup;
        dock.querySelectorAll('[data-ux-clock]').forEach((b) => b.onclick = () => {
          const acknowledged = clocks.find((c) => c.tab === b.dataset.uxClock && c.end <= Date.now());
          if (acknowledged) acknowledged.wasWaiting = false;
          go(b.dataset.uxClock);
        });
        if (focus) [...dock.querySelectorAll('button')].find((b) => b.dataset.uxClock === focus)?.focus({ preventScroll: true });
      }
    }
    function restorePocket() {
      if (!mobilePocket) return;
      for (const entry of mobilePocket.entries) {
        if (entry.placeholder.isConnected) entry.placeholder.replaceWith(entry.node);
      }
      mobilePocket.pocket.remove(); mobilePocket = null;
      document.body.classList.remove('ux-has-action-pocket');
    }
    function reachAction(panel) {
      // Enhancement passes can run repeatedly while other boards settle. Keep the live
      // controls and their containing region stable until the renderer actually replaces them.
      if (mobilePocket?.pocket.isConnected && mobilePocket.pocket.parentElement === panel && panel === activePanel()
        && window.matchMedia('(max-width: 760px)').matches
        && mobilePocket.entries.every(entry => entry.node.parentElement === mobilePocket.pocket)
        && mobilePocket.pocket.querySelector('.act.prime:not([disabled])')) return;
      restorePocket();
      if (!panel || !window.matchMedia('(max-width: 760px)').matches || panel !== activePanel()) return;
      const primary = panel.querySelector('.verbrow .act.prime[data-do]:not([disabled]), .verbrow .act.prime[data-operation-label]:not([disabled])');
      const row = primary?.closest('.verbrow'), described = primary?.getAttribute('aria-describedby');
      const terms = described ? document.getElementById(described) : null;
      if (!row || !terms || !panel.contains(terms)) return;
      const pocket = document.createElement('div'); pocket.id = 'ux-action-pocket'; pocket.className = 'ux-action-pocket';
      pocket.setAttribute('role', 'region'); pocket.setAttribute('aria-label', 'Current job costs and actions');
      const heading = document.createElement('div'); heading.className = 'ux-action-pocket-title';
      heading.textContent = primary.closest('.card')?.querySelector('.t,b')?.textContent.trim() || primary.dataset.operationLabel || 'Current job';
      pocket.append(heading);
      const entries = [terms, row].map((node) => { const placeholder = document.createComment('original action position'); node.before(placeholder); pocket.append(node); return { node, placeholder }; });
      // Keep the first activity first in document and keyboard order while its controls float.
      panel.prepend(pocket); mobilePocket = { pocket, entries };
      document.body.classList.add('ux-has-action-pocket');
    }
    function resourceIcons() {
      document.querySelectorAll('#sheet [data-stathelp], #vitals [data-stathelp]').forEach((el) => {
        const target = el.querySelector('.k') || el;
        if (!target.querySelector('.ux-resource-icon')) target.insertAdjacentHTML('afterbegin', icon(el.dataset.stathelp));
      });
      const cash = $('#vitals .v-cash');
      if (cash && !cash.querySelector('.ux-resource-icon')) cash.insertAdjacentHTML('afterbegin', icon('cash'));
      const respect = [...document.querySelectorAll('#sheet .row .k')].find((el) => /^respect\b/i.test(el.textContent.trim()));
      if (respect && !respect.querySelector('.ux-resource-icon')) respect.insertAdjacentHTML('afterbegin', icon('respect'));
    }
    function explainBlockers(panel) {
      if (!panel) return;
      panel.querySelectorAll('[data-ux-blocker]').forEach((el) => el.remove());
      const grouped = new Map();
      panel.querySelectorAll('button[disabled][title],button[aria-disabled="true"][title]').forEach((button) => {
        if (!button.title.trim() || button.closest('[hidden],details:not([open])')) return;
        const parent = button.closest('.card') || button.parentElement;
        const reasons = grouped.get(parent) || [];
        if (!reasons.includes(button.title.trim())) reasons.push(button.title.trim());
        grouped.set(parent, reasons);
      });
      let count = 0;
      for (const [parent, reasons] of grouped) {
        if (++count > 8) break;
        const text = reasons.slice(0, 2).join(' ');
        const destination = /jail|lockup|sentence/i.test(text) ? 'pen' : /heat|wanted|indict/i.test(text) ? 'law' : /energy|nerve|heal|health|level/i.test(text) ? 'life' : '';
        const note = document.createElement('div'); note.className = 'ux-blocker'; note.dataset.uxBlocker = '';
        note.innerHTML = `<span>${esc(text)}</span>${destination && destination !== state().currentTab ? ` <button type="button" class="ux-text-button" data-ux-resolve="${destination}">Open ${esc(title(destination))} →</button>` : ''}`;
        note.querySelector('[data-ux-resolve]')?.addEventListener('click', () => go(destination)); parent.append(note);
      }
    }
    function contextualRules(panel) {
      if (!panel || panel.querySelector('[data-ux-rules]')) return;
      const entry = RULES[state().currentTab];
      if (!entry) return;
      const details = document.createElement('details'); details.className = 'ux-context-rules'; details.dataset.uxRules = '';
      details.innerHTML = `<summary>Before you act · ${esc(entry[0])}</summary><p>${esc(entry[1])}</p><a href="${entry[2]}" target="_blank" rel="noopener">Read the full rules ↗</a>`;
      panel.prepend(details);
    }
    function landing() {
      const main = $('#landing-main');
      if (!main || main.dataset.uxLanding) return;
      main.dataset.uxLanding = '1';
      const economy = $('#omr-economy .omr-pillars');
      if (economy) {
        const details = document.createElement('details'); details.className = 'ux-landing-details';
        details.innerHTML = '<summary>Read the economy, API, and feature details</summary>';
        economy.before(details); details.append(economy);
        // The production status stays above the closed disclosure.
        const hash = location.hash;
        if (hash && [...economy.querySelectorAll('[id]')].some((n) => '#' + n.id === hash)) details.open = true;
      }
      const agentBody = $('#agent-players .agent-showcase__body');
      if (agentBody) {
        const details = document.createElement('details'); details.className = 'ux-landing-details';
        details.innerHTML = '<summary>Explore agent capabilities and setup</summary>'; agentBody.before(details); details.append(agentBody);
      }
      const practice = document.createElement('details'); practice.id = 'ux-practice'; practice.className = 'ux-practice';
      practice.innerHTML = `<summary>Try a practice job · no account needed</summary><div class="ux-practice-body"><span class="ux-kicker">LOCAL PRACTICE · SCRIPTED EXAMPLE</span><h3>A note under the door</h3><p>Choose an approach to see how an action becomes a receipt. This example changes no game state and awards nothing.</p><div class="ux-practice-choices" role="group" aria-label="Choose a practice approach"><button type="button" class="act" data-practice="quiet">Case it</button><button type="button" class="act prime" data-practice="standard">Do it</button><button type="button" class="act" data-practice="loud">Go loud</button></div><div class="ux-practice-receipt" aria-live="polite" aria-atomic="true"></div></div>`;
      ($('#enter-city')?.parentElement || main).append(practice);
      const outcomes = {
        quiet: ['QUIET APPROACH', 'You read the room before moving. A live receipt would show the outcome, nerve spent, heat, and funded reward.'],
        standard: ['STANDARD APPROACH', 'The job is complete in this scripted example. A live result can succeed or fail and always uses the current server rules.'],
        loud: ['LOUD APPROACH', 'The room turns toward you. Compare the live job’s heat and jail terms before choosing this approach in the city.'],
      };
      practice.querySelectorAll('[data-practice]').forEach((button) => button.onclick = () => {
        const [label, detail] = outcomes[button.dataset.practice];
        practice.querySelector('.ux-practice-receipt').innerHTML = `<strong>PRACTICE RECEIPT · ${label}</strong><p>${detail}</p><dl><div><dt>Reward</dt><dd>None · practice only</dd></div><div><dt>Cost</dt><dd>None · no game resources used</dd></div><div><dt>Next move</dt><dd>Compare another approach or enter the city.</dd></div></dl>`;
        practice.querySelectorAll('[data-practice]').forEach((b) => b.setAttribute('aria-pressed', String(b === button)));
      });
    }
    function interestHint() {
      try { const hint = JSON.parse(sessionStorage.getItem('omerta_path_interest') || 'null'); return hint && INTERESTS[hint.path] && Date.now() - Number(hint.at) < 30 * 86400000 ? hint.path : ''; } catch { return ''; }
    }
    function tour(panel) {
      if (!panel || state().currentTab !== 'start' || panel.querySelector('#ux-interest-tour')) return;
      const saved = readStore(`${key}:tour`, null);
      if (!activeInterest) activeInterest = interestHint() || (saved && INTERESTS[saved.interest] ? saved.interest : '');
      if (saved?.done) return;
      const host = document.createElement('section'); host.id = 'ux-interest-tour'; host.className = 'ux-interest-tour'; host.setAttribute('aria-label', 'Explore your interests');
      panel.prepend(host);
      const paint = () => {
        const route = INTERESTS[activeInterest];
        host.innerHTML = `<div class="ux-kicker">YOUR FIRST TOUR</div><h3>${route ? `Explore ${esc(route.name)}` : 'What interests you?'}</h3><p>${route ? 'Your quiz interest shapes these suggestions. This tour never declares or switches a Path.' : 'Use the same six interests as the Path quiz to pick a short tour. You can explore every part of the city.'}</p>
          <label for="ux-interest-select">Tour interest</label><select id="ux-interest-select"><option value="">Choose an interest</option>${Object.entries(INTERESTS).map(([id, entry]) => `<option value="${id}"${id === activeInterest ? ' selected' : ''}>${esc(entry.name)}</option>`).join('')}</select>
          ${route ? `<ol>${route.tabs.map((id, i) => `<li${i === tourStep ? ' aria-current="step"' : ''}><b>${esc(title(id))}</b><span>${esc(route.why[i])}</span>${i === tourStep ? `<button class="act" type="button" data-ux-tour-go="${id}">Explore ${esc(title(id))} →</button>` : ''}</li>`).join('')}</ol><div class="ux-tour-controls"><button type="button" class="act" data-ux-tour-next>${tourStep < 2 ? 'Next suggestion' : 'Finish tour'}</button><button type="button" class="ux-text-button" data-ux-tour-dismiss>Dismiss</button></div>` : '<p><a href="/path?source=first-tour">Take the full Path quiz ↗</a></p>'}`;
        host.querySelector('select').onchange = (e) => { activeInterest = e.target.value; tourStep = 0; writeStore(`${key}:tour`, { interest: activeInterest, done: false }); paint(); };
        host.querySelector('[data-ux-tour-go]')?.addEventListener('click', (e) => go(e.currentTarget.dataset.uxTourGo));
        host.querySelector('[data-ux-tour-next]')?.addEventListener('click', () => { if (tourStep < 2) { tourStep++; paint(); } else { writeStore(`${key}:tour`, { interest: activeInterest, done: true }); host.remove(); } });
        host.querySelector('[data-ux-tour-dismiss]')?.addEventListener('click', () => { writeStore(`${key}:tour`, { interest: activeInterest, done: true }); host.remove(); });
      };
      paint();
    }
    function beforeRender(root) {
      ensureAccount(); restorePocket();
      const panel = root?.nodeType === 1 ? root : activePanel();
      // A destination's retained DOM belongs to an earlier visit. Its defaults and explicit
      // deep-link intent must win; preserve reader state only on the same screen's refresh.
      if (!panel || panel !== activePanel() || previousTab !== state().currentTab) { snapshot = null; return; }
      const focus = document.activeElement;
      snapshot = { account, tab: state().currentTab, panel, at: Date.now(), scroll: window.scrollY, panelScroll: panel.scrollTop,
        fields: [...panel.querySelectorAll('input,select,textarea')].filter(safeField).map((el, i) => ({ key: fieldKey(el, i), value: el.value, checked: el.checked, dirty: dirty.has(el), focus: el === focus, start: el.selectionStart, end: el.selectionEnd })),
        details: [...panel.querySelectorAll('details')].map((el, i) => ({ key: el.id || el.dataset.view || el.querySelector('summary')?.textContent.trim() || String(i), open: el.open })),
      };
    }
    function afterRender(root) {
      ensureAccount();
      const panel = root?.nodeType === 1 ? root : activePanel();
      if (!panel || panel !== activePanel()) return;
      contextualRules(panel); tour(panel);
      if (snapshot && snapshot.account === account && snapshot.tab === state().currentTab && snapshot.panel === panel && Date.now() - snapshot.at < 120000) {
        const fields = [...panel.querySelectorAll('input,select,textarea')].filter(safeField);
        for (let i = 0; i < fields.length; i++) {
          const el = fields[i], saved = snapshot.fields.find((v) => v.key === fieldKey(el, i));
          if (!saved?.dirty) continue;
          if (el.tagName !== 'SELECT' || [...el.options].some((o) => o.value === saved.value)) el.value = saved.value;
          if (['checkbox', 'radio'].includes(el.type)) el.checked = saved.checked;
          dirty.add(el);
          if (saved.focus) { el.focus({ preventScroll: true }); if (saved.start != null && typeof el.setSelectionRange === 'function') try { el.setSelectionRange(saved.start, saved.end); } catch { /* Numeric fields have no selection. */ } }
        }
        [...panel.querySelectorAll('details')].forEach((el, i) => { const k = el.id || el.dataset.view || el.querySelector('summary')?.textContent.trim() || String(i); const saved = snapshot.details.find((v) => v.key === k); if (saved) el.open = saved.open; });
        panel.scrollTop = snapshot.panelScroll; window.scrollTo({ top: snapshot.scroll, behavior: 'instant' });
      }
      snapshot = null;
      const tab = state().currentTab;
      if (previousTab && previousTab !== tab && !['start', 'profile', 'deck', 'store'].includes(previousTab)) resume = { tab: previousTab, at: Date.now() };
      if (!['start', 'profile', 'deck', 'store'].includes(tab)) { lastActivity = { tab, at: Date.now() }; save(true); }
      previousTab = tab;
      render(); explainBlockers(panel); reachAction(panel);
    }
    function render() { ensureAccount(); landing(); if (!state().me) return; syncClocks(); renderStrip(); tickClocks(); resourceIcons(); }
    document.addEventListener('input', (event) => { if (event.target.closest?.('#tabbodies') && safeField(event.target)) dirty.add(event.target); });
    document.addEventListener('change', (event) => { if (event.target.closest?.('#tabbodies') && safeField(event.target)) dirty.add(event.target); });
    document.addEventListener('keydown', (event) => {
      if (event.isComposing || !(event.ctrlKey || event.metaKey) || event.altKey || event.key.toLowerCase() !== 'k' || !state().me || document.querySelector('.modal-bg:not(.hidden),dialog[open]')) return;
      event.preventDefault(); $('#btn-jump')?.click();
    });
    const media = window.matchMedia('(max-width: 760px)');
    media.addEventListener?.('change', () => reachAction(activePanel()));
    const clock = window.setInterval(() => { if (!document.hidden) tickClocks(); }, 1000);
    return { render, beforeRender, afterRender, observe(path) { if (path === '/v1/me') lastMe = null; }, icon,
      reloadWorkspace() { account = ''; render(); afterRender(); },
      destroy() { window.clearInterval(clock); restorePocket(); } };
  };
})();
