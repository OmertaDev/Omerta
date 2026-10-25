/* Personal progression uses server facts; browser keepsakes never grant game rewards. */
(function () {
  'use strict';
  const list = value => Array.isArray(value) ? value : [];
  const number = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const count = value => Math.floor(number(value)).toLocaleString();
  const trackTabs = { larceny: 'streets', wetwork: 'pvp', chemistry: 'kitchen', wheels: 'garage',
    seamanship: 'port', gambling: 'den', muscle: 'pvp', commerce: 'streets', scores: 'scores', fists: 'boxing' };
  const tabTracks = { streets: ['larceny', 'commerce'], pvp: ['wetwork', 'muscle'], kitchen: ['chemistry'],
    garage: ['wheels'], races: ['wheels'], port: ['seamanship'], den: ['gambling'], market: ['commerce'],
    scores: ['scores'], boxing: ['fists'], speakeasy: ['muscle'], pen: ['gambling', 'wetwork'] };
  const themes = { amber: 'Old gold', blue: 'Midnight blue', green: 'Bottle green' };
  const covers = { ledger: 'The ledger', skyline: 'City silhouette', dispatch: 'The dispatch' };

  function goals(me, boards) {
    const choices = list(me?.trades).filter(t => t.nextAt != null).map(t => ({
      id: `trade:${t.id}`, kind: 'trade', track: t.id, title: `${t.name} · level ${number(t.lvl) + 1}`,
      target: number(t.nextAt), start: number(t.xp), tab: trackTabs[t.id] || 'life',
    }));
    for (const skill of list(boards.skills?.tree).filter(s => !s.known)) choices.push({
      id: `skill:${skill.id}`, kind: 'skill', skill: skill.id, title: `Learn ${skill.name}`, tab: 'life',
    });
    for (const entry of list(boards.content?.instances).filter(c => ['active', 'forming'].includes(c.status))) choices.push({
      id: `case:${entry.id}`, kind: 'case', caseId: entry.id, title: `Close ${entry.title}`, tab: 'desk',
    });
    return choices;
  }
  function goalStatus(goal, me, boards) {
    if (!goal) return null;
    if (goal.kind === 'trade') {
      const track = list(me?.trades).find(t => t.id === goal.track);
      if (!track) return { pct: 0, text: 'Open the Trades to refresh this goal.', done: false };
      const now = number(track.xp), target = number(goal.target), start = number(goal.start);
      return { pct: Math.max(0, Math.min(100, (now - start) / Math.max(1, target - start) * 100)),
        text: now >= target ? 'Goal reached. Choose your next move.' : `${count(target - now)} XP to go · ${count(now)} / ${count(target)} XP`, done: now >= target };
    }
    if (goal.kind === 'skill') {
      const skill = list(boards.skills?.tree).find(s => s.id === goal.skill);
      const known = !!skill?.known;
      return { pct: known ? 100 : 0, text: known ? 'Learned. Put your new skill to work.' : skill
        ? `${count(skill.cost)} skill points required · ${count(boards.skills?.points?.available)} available`
        : 'Open the Life to refresh skill requirements.', done: known };
    }
    const entry = list(boards.content?.instances).find(c => c.id === goal.caseId);
    const done = entry?.status === 'completed';
    return { pct: done ? 100 : 0, text: done ? 'Case closed. Your record is filed.' : 'Continue your case at the Content Desk.', done };
  }
  function earnedTitles(me, boards) {
    const titles = new Map();
    const add = (id, title, scope) => { if (title) titles.set(id, { id, title, scope }); };
    for (const t of list(me?.trades)) if (number(t.lvl) > 1) add(`trade:${t.id}`, `${t.rank} · ${t.name}`, 'This character');
    if (number(me?.honor?.value) !== 0) add('honor', me.honor.tier, 'This character');
    for (const g of list(boards.skills?.grandmasteries).filter(g => g.unlocked)) add(`grand:${g.id}`, g.name, 'This character');
    for (const s of list(boards.seasons?.recaps)) add(`season:${s.season}`, s.title, 'Bloodline');
    return [...titles.values()];
  }
  function nextUnlocks(me, rules) {
    return list(rules?.crimes).filter(c => number(c.lvl) > number(me?.level))
      .sort((a, b) => number(a.lvl) - number(b.lvl)).slice(0, 2)
      .map(c => ({ id: c.id, title: c.name, level: number(c.lvl), tab: 'streets', detail: `Costs ${count(c.nerve)} nerve per attempt` }));
  }
  function skillBranches(board) {
    const groups = new Map();
    for (const skill of list(board?.tree)) {
      if (!groups.has(skill.branch)) groups.set(skill.branch, []);
      groups.get(skill.branch).push(skill);
    }
    return [...groups].map(([name, nodes]) => ({ name, nodes: nodes.sort((a, b) => number(a.tier) - number(b.tier)).map((skill, i, branch) => {
      const parent = branch[i - 1];
      return { ...skill, parent: parent?.name || null,
        available: !skill.known && (!parent || parent.known) && number(skill.cost) <= number(board?.points?.available) };
    }) }));
  }
  function milestoneChanges(before, after) {
    if (!before?.id || before.id !== after?.id) return [];
    const changes = [];
    if (number(after.level) > number(before.level)) changes.push({ id: `level:${after.id}:${after.level}`,
      title: `Level ${count(before.level)} → ${count(after.level)}`, detail: after.leveled?.rank || 'Your name carries further.', tab: 'streets', kind: 'level' });
    for (const track of list(after.trades)) {
      const old = list(before.trades).find(t => t.id === track.id);
      if (old && number(track.lvl) > number(old.lvl)) changes.push({ id: `trade:${after.id}:${track.id}:${track.lvl}`,
        title: `${track.name}: ${old.rank} L${count(old.lvl)} → ${track.rank} L${count(track.lvl)}`,
        detail: `${count(track.xp)} XP earned in this trade.`, tab: trackTabs[track.id] || 'life', kind: 'trade' });
    }
    return changes;
  }
  function seasonKeepsakeSvg(name, season) {
    const xml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
    }[character]));
    return `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600" viewBox="0 0 900 600" role="img" aria-labelledby="title description">
  <title id="title">OMERTÀ — ${xml(name)} · Season ${xml(count(season.season))}</title>
  <desc id="description">A season dossier with a city silhouette and portrait outline. ${xml(season.title || 'Your season')}. Level ${xml(count(season.level))}, ${xml(count(season.kills))} kills, ${xml(count(season.prestigeGained))} prestige gained.</desc>
  <rect width="900" height="600" fill="#13110e"/>
  <path d="M0 168h48V98h46v70h34V60h68v108h24V122h48v46h42V84h52v84h29V33h62v135h36V108h58v60h29V74h46v94h39V114h62v54h27V48h73v120h35V99h56v69h47V140h49v460H0Z" fill="#211e17"/>
  <path d="M410 33V15m317 33V28M71 110v18m76-52v18m31 19v18m140-34v19m98-66v17m23 20v17m179 21v20m88-70v18m25 29v18m69 5v19" stroke="#51452e" stroke-width="3"/>
  <rect x="28" y="28" width="844" height="544" rx="2" fill="none" stroke="#8a7145"/>
  <rect x="40" y="40" width="820" height="520" fill="none" stroke="#3e3526"/>
  <text x="66" y="91" fill="#d6bc87" font-family="Georgia,serif" font-size="37" letter-spacing="7">OMERTÀ</text>
  <text x="68" y="120" fill="#a5987d" font-family="sans-serif" font-size="11" letter-spacing="4">YOUR NAME IN THE CITY</text>
  <path d="M66 145h768" stroke="#705b38"/>
  <g transform="translate(679 75) rotate(-7)"><rect width="143" height="36" fill="none" stroke="#d6bc87"/><text x="71.5" y="24" text-anchor="middle" fill="#d6bc87" font-family="sans-serif" font-size="15" letter-spacing="2">SEASON ${xml(count(season.season))}</text></g>
  <rect x="66" y="182" width="164" height="210" fill="#1a1712" stroke="#5f5036"/>
  <g transform="translate(79 195)" fill="none" stroke="#9a8460" stroke-width="2">
    <path d="M12 175c3-37 23-54 56-54s54 17 58 54M50 113l18 25 18-25M68 138v37M52 109v15m33-15v15"/>
    <path d="M42 60v21c0 23 12 35 26 35s26-12 26-35V60M31 61h74M43 57l7-28 19 5 17-5 9 28Z"/>
    <path d="M44 80h15m19 0h14M62 100h12" opacity=".7"/>
  </g>
  <text x="148" y="416" text-anchor="middle" fill="#a5987d" font-family="sans-serif" font-size="10" letter-spacing="2">BLOODLINE ARCHIVE</text>
  <text x="268" y="211" fill="#a5987d" font-family="sans-serif" font-size="11" letter-spacing="3">FILED FOR</text>
  <text x="268" y="251" fill="#eee0c1" font-family="Georgia,serif" font-size="33">${xml(name)}</text>
  <text x="268" y="304" fill="#d6bc87" font-family="Georgia,serif" font-size="25">${xml(season.title || 'Your name in the city')}</text>
  <path d="M268 325h550" stroke="#51452e"/>
  <text x="268" y="359" fill="#a5987d" font-family="sans-serif" font-size="10" letter-spacing="2">LEVEL REACHED</text>
  <text x="461" y="359" fill="#a5987d" font-family="sans-serif" font-size="10" letter-spacing="2">KILLS</text>
  <text x="645" y="359" fill="#a5987d" font-family="sans-serif" font-size="10" letter-spacing="2">PRESTIGE GAINED</text>
  <text x="268" y="405" fill="#eee0c1" font-family="Georgia,serif" font-size="40">${xml(count(season.level))}</text>
  <text x="461" y="405" fill="#eee0c1" font-family="Georgia,serif" font-size="40">${xml(count(season.kills))}</text>
  <text x="645" y="405" fill="#eee0c1" font-family="Georgia,serif" font-size="40">${xml(count(season.prestigeGained))}</text>
  <path d="M66 459h768" stroke="#705b38"/>
  <text x="66" y="495" fill="#b8a98c" font-family="Georgia,serif" font-size="16" font-style="italic">The season ends. The name stays in the book.</text>
  <text x="66" y="532" fill="#8e826c" font-family="sans-serif" font-size="10" letter-spacing="2">A KEEPSAKE OF YOUR RECORDED SEASON · DISPLAY ONLY</text>
</svg>`;
  }
  window.OmertaProgressionModel = { goals, goalStatus, earnedTitles, nextUnlocks, skillBranches, milestoneChanges };

  window.createOmertaProgression = function ({ getState, read, navigate, notify, workspace }) {
    let scope = '', data = {}, boards = {}, loaded = {}, pending = {}, failed = {}, revision = 0, lastTab = '';
    const openPanels = new Map();
    const document = window.document;
    const el = (tag, cls, text) => {
      const node = document.createElement(tag); if (cls) node.className = cls;
      if (text !== undefined) node.textContent = String(text); return node;
    };
    const button = (text, run, cls = '') => {
      const node = el('button', `act ux-progress-button ${cls}`, text); node.type = 'button';
      node.addEventListener('click', run); return node;
    };
    function activeScope() {
      const state = getState();
      return state.me?.id ? String(state.me.accountId || state.accountId || state.me.id) : '';
    }
    function ensureScope() {
      const next = activeScope();
      if (next === scope) return !!scope;
      scope = next; boards = {}; loaded = {}; pending = {}; failed = {}; lastTab = ''; openPanels.clear(); revision++;
      try { data = JSON.parse(window.localStorage.getItem(`omerta_progression_v1:${scope}`) || '{}') || {}; } catch { data = {}; }
      if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
      data.visits = data.visits && typeof data.visits === 'object' && !Array.isArray(data.visits) ? data.visits : {};
      data.scrapbook = list(data.scrapbook).filter(x => x && typeof x.id === 'string').slice(-100);
      data.records = data.records && typeof data.records === 'object' ? data.records : {};
      document.querySelectorAll('[data-ux-progression]').forEach(node => node.remove());
      return !!scope;
    }
    function save(passive = false) {
      if (!scope) return;
      workspace?.set('progression', data, { passive });
      try { window.localStorage.setItem(`omerta_progression_v1:${scope}`, JSON.stringify(data)); } catch { /* browser storage is optional */ }
    }
    function remember(entry) {
      if (data.scrapbook.some(item => item.id === entry.id)) return false;
      data.scrapbook.push({ ...entry, at: new Date().toISOString() });
      data.scrapbook = data.scrapbook.slice(-100); return true;
    }
    const endpoint = { mastery: '/v1/mastery', skills: '/v1/skills', underworld: '/v1/underworld',
      collection: '/v1/collection', seasons: '/v1/season/recap', content: '/v1/content' };
    function observe(path, body) {
      if (!ensureScope()) return;
      const key = Object.keys(endpoint).find(k => path.split('?')[0] === endpoint[k]);
      if (!key || !body || typeof body !== 'object') return;
      boards[key] = body; loaded[key] = Date.now(); delete failed[key];
      if (key === 'seasons') for (const s of list(body.recaps)) remember({ id: `season:${s.season}`,
        title: `Season ${s.season} · ${s.title || 'Your season'}`, detail: `Level ${s.level} · ${count(s.prestigeGained)} prestige gained`, kind: 'season', tab: 'life' });
      if (key === 'content') for (const c of list(body.instances).filter(c => c.status === 'completed')) remember({
        id: `case:${c.id}`, title: c.title, detail: 'Case closed · server record', kind: 'case', tab: 'desk' });
      save(true);
    }
    async function load(key) {
      if (loaded[key] && Date.now() - loaded[key] < 60000) return;
      if (pending[key]) return pending[key];
      const requestedScope = scope;
      pending[key] = Promise.resolve(read(endpoint[key])).then(response => {
        if (requestedScope !== activeScope()) return;
        if (response.code === 200) observe(endpoint[key], response.body);
        else failed[key] = true;
      }).catch(() => { if (requestedScope === activeScope()) failed[key] = true; }).finally(() => { if (requestedScope === scope) delete pending[key]; });
      return pending[key];
    }
    function mount(parent, key, factory) {
      if (!parent) return;
      let host = parent.querySelector(`[data-ux-progression="${key}"]`);
      const me = getState().me;
      const signature = JSON.stringify([{ id: me?.id, name: me?.name, generation: me?.generation,
        level: me?.level, loc: me?.loc, honor: me?.honor, trades: me?.trades }, boards, data, key]);
      if (host?.dataset.signature === signature) return;
      // Do not replace a form while its user is interacting with it.
      if (host && host.contains(document.activeElement) && /^(SELECT|INPUT)$/.test(document.activeElement.tagName)) return;
      if (!host) { host = el('section', 'ux-progression'); host.dataset.uxProgression = key; parent.append(host); }
      host.dataset.signature = signature;
      host.querySelectorAll('details').forEach(node => openPanels.set(`${key}:${node.dataset.panel}`, node.open));
      host.replaceChildren(factory());
      host.querySelectorAll('details').forEach(node => {
        const panelKey = `${key}:${node.dataset.panel}`;
        if (openPanels.has(panelKey)) node.open = openPanels.get(panelKey);
        node.addEventListener('toggle', () => openPanels.set(panelKey, node.open));
      });
    }
    function heading(title, note) {
      const node = el('div', 'ux-progress-heading'); node.append(el('h3', '', title));
      if (note) node.append(el('small', '', note)); return node;
    }
    function details(title, id, note) {
      const node = el('details', 'ux-progress-details'); node.dataset.panel = id;
      const summary = el('summary', '', title); node.append(summary);
      if (note) node.append(el('p', 'ux-progress-note', note)); return node;
    }
    function bar(pct, label) {
      const node = el('div', 'ux-progress-meter'); node.setAttribute('role', 'progressbar');
      node.setAttribute('aria-label', label); node.setAttribute('aria-valuemin', '0'); node.setAttribute('aria-valuemax', '100');
      node.setAttribute('aria-valuenow', String(Math.round(pct))); const fill = el('span'); fill.style.width = `${Math.max(0, Math.min(100, pct))}%`;
      node.append(fill); return node;
    }
    async function go(tab, selector) {
      await navigate(tab);
      if (selector) {
        const target = document.querySelector(selector);
        if (target) { target.scrollIntoView({ block: 'center', behavior: 'auto' }); target.focus({ preventScroll: true }); }
      }
    }
    function selectControl(label, options, selected, onChange) {
      const wrap = el('label', 'ux-progress-field'); wrap.append(el('span', '', label));
      const select = el('select'); select.setAttribute('aria-label', label);
      for (const option of options) { const node = el('option', '', option.title); node.value = option.id; select.append(node); }
      select.value = selected || ''; select.addEventListener('change', () => { const value = select.value; select.blur(); onChange(value); }); wrap.append(select); return wrap;
    }
    function pin(goal) { data.goal = goal || null; save(); render(); if (goal) notify(`Goal pinned: ${goal.title}`); }
    function goalPicker() {
      const root = el('div'), choices = goals(getState().me, boards);
      root.append(selectControl('Choose your next achievement', [{ id: '', title: 'Choose a goal' }, ...choices], data.goal?.id,
        value => pin(choices.find(goal => goal.id === value))));
      root.append(el('p', 'ux-progress-note', 'Pinned goals and cosmetic choices are saved for your account in this browser.'));
      if (!boards.skills || !boards.content) root.append(button('Include skills and cases', async event => {
        event.currentTarget.disabled = true;
        await Promise.all(['skills', 'content'].filter(key => !boards[key]).map(load)); render();
      }));
      return root;
    }
    function goalTracker() {
      const root = el('div', 'ux-goal-card'), goal = data.goal, me = getState().me;
      root.append(heading('Your next achievement', 'Personal goal'));
      if (!goal) { const picker = details('Pin a goal', 'goal-picker'); picker.append(goalPicker()); root.append(picker); return root; }
      const status = goalStatus(goal, me, boards);
      root.append(el('strong', '', goal.title), el('p', 'ux-progress-note', status.text), bar(status.pct, goal.title));
      const actions = el('div', 'ux-progress-actions');
      actions.append(button(status.done ? 'Review achievement' : 'Work toward this', () => go(goal.tab || 'life')));
      actions.append(button('Change goal', () => { data.goal = null; save(); render(); })); root.append(actions);
      if (goal.tab === getState().currentTab && !status.done) root.append(el('p', 'ux-goal-context', goal.kind === 'trade'
        ? `Actions here can develop ${list(me.trades).find(t => t.id === goal.track)?.name || 'this trade'}. Successful qualifying actions award the XP shown in your result.`
        : 'Your pinned achievement is available on this screen.'));
      return root;
    }
    function unlockPreview() {
      const me = getState().me, root = el('div', 'ux-unlock-preview');
      root.append(heading('Your next opening', 'Unlocked by progress'));
      const unlocks = nextUnlocks(me, getState().rules);
      if (!unlocks.length) root.append(el('p', 'ux-progress-note', 'Your next trade milestone can deepen a perk. Pick a trade below to make it your goal.'));
      for (const unlock of unlocks) {
        const row = el('article', 'ux-unlock-row'); row.append(el('strong', '', unlock.title),
          el('span', '', `Level ${unlock.level} · ${count(unlock.level - number(me.level))} levels away`), el('small', '', unlock.detail)); root.append(row);
      }
      const abilities = list(boards.skills?.actives).filter(a => a.unlocked);
      if (abilities.length) root.append(button('Try an unlocked ability', () => go('life', '[data-active]')));
      const recent = data.scrapbook.filter(entry => entry.kind === 'level').slice(-1)[0];
      if (recent) {
        const opened = list(getState().rules?.crimes).filter(c => number(c.lvl) === number(me.level));
        if (opened.length) root.append(button(`Try ${opened[0].name}`, () => go('streets')));
      }
      return root;
    }
    function treePanel() {
      const root = details('Your connected skill tree', 'tree', 'Lines connect each prerequisite to the skill it opens. Skills and active abilities belong to this character.');
      const branches = el('div', 'ux-skill-branches');
      for (const branch of skillBranches(boards.skills)) {
        const column = el('div', 'ux-skill-branch'); column.append(el('h4', '', branch.name));
        const chain = el('ol', 'ux-skill-chain');
        for (const skill of branch.nodes) {
          const node = el('li', `ux-skill-node ${skill.known ? 'is-earned' : skill.available ? 'is-available' : 'is-locked'}`);
          node.append(el('span', 'ux-skill-state', skill.known ? 'Learned' : skill.available ? 'Available' : 'Locked'), el('strong', '', skill.name), el('p', '', skill.desc));
          if (skill.parent) node.append(el('small', '', `Requires ${skill.parent}`));
          node.append(el('small', '', `${count(skill.cost)} points${number(skill.tier) === 4 ? ' · Capstone' : ''}`));
          if (!skill.known) node.append(button(skill.available ? 'Review and learn' : 'Review requirements', () => go('life', `[data-learn="${CSS.escape(skill.id)}"]`)));
          chain.append(node);
        }
        column.append(chain); branches.append(column);
      }
      root.append(branches); return root;
    }
    function permanencePanel() {
      const root = el('div', 'ux-permanence-grid'), me = getState().me;
      const current = el('article'); current.append(el('span', 'ux-scope-label', 'This character'), el('strong', '', 'The work you do today'),
        el('p', '', `Level ${count(me.level)}, learned skills and NPC standing belong to this life. Trade schooling passes on at the inheritance rate shown on the Trades board.`));
      const lasting = el('article'); lasting.append(el('span', 'ux-scope-label is-lasting', 'Bloodline'), el('strong', '', 'A name that lasts'),
        el('p', '', `Generation ${count(me.generation)} · ${count(boards.mastery?.legend?.total)} lifetime trade XP. Your collection, season records and estate survive through your heirs.`));
      root.append(current, lasting); return root;
    }
    function npcPanel() {
      const root = details('The people who know your name', 'npcs', 'Standing belongs to this character. Earn the next introduction through the business listed below.');
      const grid = el('div', 'ux-npc-grid'), thresholds = list(boards.underworld?.thresholds).map(number).sort((a, b) => a - b);
      for (const npc of list(boards.underworld?.npcs)) {
        const row = el('article', 'ux-npc-card'); const image = el('img'); image.src = `/v1/art/npc/${encodeURIComponent(npc.id)}`; image.alt = ''; image.loading = 'lazy';
        row.append(image, el('strong', '', npc.name), el('span', '', `${count(npc.standing)} standing · tier ${count(npc.tier)}`));
        const next = thresholds.find(value => value > number(npc.standing));
        row.append(el('p', '', next == null ? 'You have earned their highest standing tier.' : `${count(next - number(npc.standing))} standing until your next introduction (${next}).`));
        const perk = list(npc.perks)[number(npc.tier)]; if (next != null && perk) row.append(el('small', '', `Next favor: ${perk}`));
        if (number(npc.standing) > 0) row.append(el('p', 'ux-npc-ack', number(npc.tier) >= 3 ? 'Your work has earned a place in their inner circle.' : 'Your business has put your name in their book.'));
        row.append(el('small', '', `Build the relationship: ${npc.earn}`)); grid.append(row);
      }
      root.append(grid); return root;
    }
    function journalPanel() {
      const root = details('Your illustrated discovery journal', 'journal', 'Only discoveries in your server record and visits observed in this browser appear here.');
      const grid = el('div', 'ux-journal-grid');
      const places = list(boards.collection?.categories).find(c => c.id === 'districts');
      const people = list(boards.collection?.categories).find(c => c.id === 'fixtures');
      const entries = [...list(places?.items).filter(item => item.got).map(item => ({ ...item, kind: 'district', label: 'Visited district' })),
        ...list(people?.items).filter(item => item.got).map(item => ({ ...item, kind: 'npc', label: 'Underworld contact' })),
        ...list(boards.content?.instances).filter(c => c.status === 'completed').map(c => ({ id: c.id, name: c.title, kind: 'case', label: 'Closed case' }))];
      for (const entry of entries.slice(0, 36)) {
        const card = el('article', 'ux-journal-entry');
        if (entry.kind !== 'case') { const image = el('img'); image.src = `/v1/art/${entry.kind}/${encodeURIComponent(entry.id)}`; image.alt = ''; image.loading = 'lazy'; card.append(image); }
        else card.append(el('span', 'ux-case-stamp', 'CASE CLOSED'));
        card.append(el('strong', '', entry.name), el('small', '', entry.label)); grid.append(card);
      }
      if (!entries.length) root.append(el('p', 'ux-progress-note', 'Your journal starts with the places you visit and the cases you close.'));
      root.append(grid, button('Continue a case', () => go('desk'))); return root;
    }
    function seasonPanel() {
      const root = details('Your season keepsakes', 'seasons', 'Season records belong to your bloodline. Save an illustrated SVG dossier that opens offline, or share your season when you choose.');
      for (const season of list(boards.seasons?.recaps)) {
        const card = el('article', 'ux-season-keepsake'); card.append(el('span', 'ux-case-stamp', `SEASON ${season.season}`),
          el('h4', '', season.title || 'Your name in the city'), el('p', '', `Level ${count(season.level)} · ${count(season.kills)} kills · ${count(season.prestigeGained)} prestige gained`));
        const text = `OMERTÀ — ${getState().me.name}\nSeason ${season.season}: ${season.title || 'Your season'}\nLevel ${season.level}\nKills ${season.kills}\nPrestige gained ${season.prestigeGained}\n`;
        card.append(button('Save dossier', () => download(seasonKeepsakeSvg(getState().me.name, season), `omerta-season-${number(season.season)}.svg`)));
        if (window.navigator?.share) card.append(button('Share keepsake', async () => {
          try { await window.navigator.share({ title: `My OMERTÀ season ${season.season}`, text }); }
          catch (error) { if (error.name !== 'AbortError') notify('Sharing is unavailable. You can save the dossier instead.', true); }
        })); root.append(card);
      }
      if (!list(boards.seasons?.recaps).length) root.append(el('p', 'ux-progress-note', 'Your first keepsake appears after a season you played comes to a close.'));
      return root;
    }
    function download(text, filename) {
      const url = window.URL.createObjectURL(new Blob([text], { type: 'image/svg+xml;charset=utf-8' }));
      const link = el('a'); link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
      window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
    }
    function scrapbookPanel() {
      const root = details('Your scrapbook of firsts', 'scrapbook', 'Observed milestones, saved for this account in this browser. Server season and case records are also filed here when you open them.');
      for (const item of data.scrapbook.slice(-20).reverse()) {
        const card = el('article', 'ux-scrapbook-entry'); card.append(el('span', 'ux-scrapbook-date', new Date(item.at).toLocaleDateString()), el('strong', '', item.title), el('p', '', item.detail));
        if (item.tab) card.append(button('Revisit', () => go(item.tab))); root.append(card);
      }
      if (!data.scrapbook.length) root.append(el('p', 'ux-progress-note', 'Your next level, mastery milestone, discovery or completed case will leave a page here.'));
      return root;
    }
    function dossierPanel() {
      const me = getState().me, root = details('Style your personal dossier', 'dossier', 'Display only, saved in this browser. Earned titles reflect your current server record.');
      const titles = earnedTitles(me, boards), title = titles.find(t => t.id === data.title);
      const preview = el('article', `ux-dossier-preview ux-dossier-cover-${covers[data.cover] ? data.cover : 'ledger'} ux-dossier-theme-${themes[data.theme] ? data.theme : 'amber'}`);
      const portrait = el('img', data.frame && titles.length ? 'ux-earned-frame' : ''); portrait.src = `/v1/avatar/${encodeURIComponent(me.id)}`; portrait.alt = `${me.name}'s portrait`;
      preview.append(portrait, el('span', 'ux-scope-label', 'Personal dossier'), el('h4', '', me.name));
      if (title) preview.append(el('strong', '', title.title), el('small', '', title.scope));
      const badges = titles.slice(0, 3); if (data.badgeOrder === 'recent') badges.reverse();
      const badgeRow = el('div', 'ux-dossier-badges'); for (const badge of badges) badgeRow.append(el('span', 'chip', badge.title));
      preview.append(badgeRow); root.append(preview);
      const update = (key, value) => { data[key] = value; save(); render(); };
      root.append(selectControl('Display an earned title', [{ id: '', title: 'No title' }, ...titles], data.title, value => update('title', value)),
        selectControl('Accent', Object.entries(themes).map(([id, value]) => ({ id, title: value })), data.theme || 'amber', value => update('theme', value)),
        selectControl('Cover', Object.entries(covers).map(([id, value]) => ({ id, title: value })), data.cover || 'ledger', value => update('cover', value)),
        selectControl('Badge arrangement', [{ id: 'first', title: 'Trades first' }, { id: 'recent', title: 'Reverse order' }], data.badgeOrder || 'first', value => update('badgeOrder', value)));
      const label = el('label', 'ux-progress-check'), toggle = el('input'); toggle.type = 'checkbox'; toggle.checked = !!data.frame; toggle.disabled = !titles.length;
      toggle.addEventListener('change', () => { const checked = toggle.checked; toggle.blur(); update('frame', checked); }); label.append(toggle, document.createTextNode('Show earned portrait frame'));
      root.append(label); if (!titles.length) root.append(el('small', 'ux-progress-note', 'Reach a trade level or earn a season title to unlock a frame.'));
      return root;
    }
    function mapPanel() {
      const root = details('Your city, explored', 'visited', 'Solid stamps come from your account collection. Dated stamps record visits seen in this browser.');
      const districts = list(getState().rules?.districts), got = new Set(list(boards.collection?.categories).find(c => c.id === 'districts')?.items?.filter(x => x.got).map(x => x.id) || []);
      const grid = el('div', 'ux-visited-map');
      for (const district of districts) {
        const visited = got.has(district.id) || Object.hasOwn(data.visits, district.id), tile = el('article', `ux-map-stamp${visited ? ' is-visited' : ''}`);
        tile.append(el('span', 'ux-case-stamp', visited ? 'VISITED' : 'UNEXPLORED'), el('strong', '', district.name || district.id));
        if (data.visits[district.id]?.at) tile.append(el('small', '', `Observed ${new Date(data.visits[district.id].at).toLocaleDateString()}`));
        if (district.id === getState().me.loc) tile.append(el('span', 'ux-current-location', 'You are here'));
        grid.append(tile);
      }
      root.append(grid, button('Travel in the City', () => go('city'))); return root;
    }
    function contextualTracks() {
      const me = getState().me, ids = tabTracks[getState().currentTab] || [], root = el('div', 'ux-context-trades');
      root.append(heading('The work is schooling you', 'This character'));
      for (const id of ids) {
        const track = list(me.trades).find(t => t.id === id); if (!track) continue;
        const row = el('div', 'ux-context-trade'); row.append(el('strong', '', `${track.name} · L${count(track.lvl)}`),
          el('span', '', track.nextAt == null ? 'Mastered' : `${count(number(track.nextAt) - number(track.xp))} XP to next level`), bar(number(track.pct), track.name));
        if (track.perkWhat && track.perkNextAt) row.append(el('small', '', `At L${count(track.perkNextAt)}: improves ${track.perkWhat}`));
        const record = data.records[track.id];
        if (record) row.append(el('small', '', `Your observed best: L${count(record.level)} · ${record.rank}`));
        if (data.goal?.track === id) row.append(el('small', 'ux-goal-context', 'Contributes to your pinned goal'));
        root.append(row);
      }
      root.append(button('Choose a trade goal', () => go('life'))); return root;
    }
    function recordOperation(receipt, before, after, result) {
      if (!ensureScope()) return;
      const response = result?.body || result || {}, successful = !(result?.code >= 400) && response.ok !== false;
      if (!successful) return;
      for (const item of milestoneChanges(before, after)) {
        const track = item.kind === 'trade' && list(after?.trades).find(t => item.id === `trade:${after.id}:${t.id}:${t.lvl}`);
        if (track && number(track.lvl) > number(data.records[track.id]?.level)) item.detail += ' A new personal high in this browser.';
        remember(item);
      }
      if (response.learned) remember({ id: `skill:${after?.id}:${response.learned}`, title: `Learned ${response.name || response.learned}`,
        detail: 'A new branch of your build is open.', tab: 'life', kind: 'skill' });
      if (response.npcName && response.standing !== undefined) remember({ id: `npc:${after?.id}:${response.npc}:${response.tier || 0}`,
        title: `${response.npcName} · standing ${count(response.standing)}`, detail: response.tier ? `You earned tier ${response.tier} standing.` : 'Your business is on their record.', tab: 'life', kind: 'npc' });
      // Recheck server boards after a write, without issuing background requests.
      for (const key of Object.keys(loaded)) loaded[key] = 0;
      save();
    }
    function loadingNote(needs) {
      const missing = needs.filter(key => failed[key]);
      if (!missing.length) return null;
      const root = el('div', 'ux-progress-load-error'); root.setAttribute('role', 'status');
      root.append(el('p', 'ux-progress-note', 'Some progression records could not be refreshed. Your existing game screens are still available.'),
        button('Retry progression records', async event => { event.currentTarget.disabled = true; await Promise.all(missing.map(load)); render(); }));
      return root;
    }
    async function render() {
      if (!ensureScope()) return;
      const me = getState().me, tab = getState().currentTab, requestedScope = scope, currentRevision = revision;
      const entered = tab !== lastTab; lastTab = tab;
      if (me.loc && !Object.hasOwn(data.visits, me.loc)) {
        data.visits[me.loc] = { at: new Date().toISOString() };
        const name = list(getState().rules?.districts).find(d => d.id === me.loc)?.name || me.loc;
        remember({ id: `visit:${me.loc}`, title: `Set foot in ${name}`, detail: 'Visit observed in this browser.', tab: 'map', kind: 'discovery' }); save(true);
      }
      let updatedRecords = false;
      for (const track of list(me.trades)) if (number(track.lvl) > number(data.records[track.id]?.level)) {
        data.records[track.id] = { level: number(track.lvl), rank: String(track.rank || ''), at: new Date().toISOString() }; updatedRecords = true;
      }
      if (updatedRecords) save(true);
      mount(document.querySelector('#sheet-body'), 'goal', goalTracker);
      const active = document.getElementById(`tab-${tab}`);
      if (tabTracks[tab]?.length) mount(active, 'context-trades', contextualTracks);
      // Life's renderer already reads its four progression boards. Reuse observe() instead of
      // racing those reads from refresh(). Extra archives load on entry, never on sheet polls.
      const needs = tab === 'profile' ? ['skills', 'seasons', 'collection', 'content']
        : ['map', 'city', 'estate'].includes(tab) ? ['collection'] : [];
      if (entered) await Promise.all(needs.map(load));
      if (requestedScope !== activeScope() || currentRevision !== revision || getState().currentTab !== tab) return;
      mount(document.querySelector('#sheet-body'), 'goal', goalTracker);
      if (tab === 'life') mount(active, 'life', () => {
        const root = el('div', 'ux-progress-hub'); root.append(heading('Make your next move count', 'Your progression dossier'), goalPicker(), unlockPreview(), permanencePanel());
        if (boards.skills) root.append(treePanel()); if (boards.underworld) root.append(npcPanel());
        if (boards.seasons) root.append(seasonPanel()); root.append(scrapbookPanel());
        const failure = loadingNote(needs); if (failure) root.append(failure); return root;
      });
      if (tab === 'profile') mount(active, 'profile', () => {
        const root = el('div', 'ux-progress-hub'); root.append(heading('A record you earned', 'Your personal archive'), dossierPanel());
        if (boards.collection) root.append(journalPanel()); if (boards.seasons) root.append(seasonPanel()); root.append(scrapbookPanel());
        const failure = loadingNote(needs); if (failure) root.append(failure); return root;
      });
      if (['map', 'city'].includes(tab)) mount(active, 'map', mapPanel);
      if (tab === 'estate') mount(active, 'estate-journal', journalPanel);
      // The selected earned title stays close to the character portrait.
      const title = earnedTitles(getState().me, boards).find(t => t.id === data.title);
      if (title) mount(document.querySelector('#sheet-body'), 'earned-title', () => {
        const root = el('div', 'ux-sheet-title'); root.append(el('span', 'ux-scope-label', 'Earned title'), el('strong', '', title.title)); return root;
      });
      else document.querySelector('[data-ux-progression="earned-title"]')?.remove();
    }
    function beforeRender(parent) {
      if (!ensureScope()) return;
      for (const host of (parent || document).querySelectorAll('[data-ux-progression]'))
        host.querySelectorAll('details').forEach(node => openPanels.set(`${host.dataset.uxProgression}:${node.dataset.panel}`, node.open));
    }
    return { render, observe, recordOperation, beforeRender, reloadWorkspace() { scope = ''; return render(); } };
  };
})();
