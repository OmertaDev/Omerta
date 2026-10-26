/* A scratchpad for decisions. Previews never submit a game action. */
(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const num = value => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = value => num(value).toLocaleString(undefined, { maximumFractionDigits: 2 });
  const money = value => `$${fmt(value)}`;
  const pct = value => `${(Math.max(0, Math.min(1, num(value))) * 100).toFixed(1)}%`;
  const duration = value => value == null ? 'Not estimated' : num(value) <= 0 ? 'Immediate' : `${Math.ceil(num(value) / 60)} min`;
  const array = value => Array.isArray(value) ? value : [];
  function evaluateFormula(node, inputs) {
    if (typeof node === 'number') return node;
    if (node?.input) return num(inputs[node.input]);
    const args = array(node?.args).map(value => evaluateFormula(value, inputs));
    if (node?.op === 'add') return args.reduce((a, b) => a + b, 0);
    if (node?.op === 'mul') return args.reduce((a, b) => a * b, 1);
    if (node?.op === 'min') return Math.min(...args);
    if (node?.op === 'max') return Math.max(...args);
    return 0;
  }
  function analyzePlan(plan, catalog, resources, now = Date.now()) {
    const balances = { energy: num(resources.energy), nerve: num(resources.nerve), cash: num(resources.cash) };
    const clocks = new Map(); let at = now;
    return array(plan).slice(0, 3).map((entry, index) => {
      at += Math.max(0, Math.min(86400, num(entry.wait))) * 1000;
      const move = catalog.find(item => item.id === entry.id), conflicts = [];
      if (!move) return { index, entry, move: null, conflicts: ['This move is no longer on the current board.'], balances: { ...balances }, at };
      for (const blocker of array(move.blockers)) if (!/street clock|gym cooldown|requires \d+(?:\.\d+)? nerve|insufficient energy/i.test(blocker)) conflicts.push(blocker);
      for (const resource of Object.keys(balances)) {
        const cost = num(move.cost?.[resource]);
        if (cost > balances[resource]) conflicts.push(`${resource}: ${fmt(cost)} needed; ${fmt(Math.max(0, balances[resource]))} left in this plan.`);
        balances[resource] -= cost;
      }
      const group = move.cooldown?.group;
      if (group) {
        const readyAt = Math.max(num(move.cooldown.readyAt), clocks.get(group) || 0);
        if (at < readyAt) conflicts.push(`${group} clock conflicts: wait ${Math.ceil((readyAt - at) / 1000)} more seconds before this move.`);
        clocks.set(group, at + num(move.cooldown.seconds) * 1000);
      }
      return { index, entry, move, conflicts, balances: { ...balances }, at };
    });
  }

  function create({ getState, read, navigate, notify = () => {}, workspace }) {
    let owner = '', board = null, loadedAt = 0, request = 0, pending = false, requestedPath = '', error = '', draft = {}, workspaceValue = '';
    const eligibleTabs = ['start', 'streets', 'garage', 'life', 'port', 'law', 'pen'];
    const state = () => getState() || {};
    const accountOf = () => String(state().session?.accountId || state().me?.accountId || state().me?.id || '');
    const panel = () => document.getElementById(`tab-${state().currentTab}`);
    const storeKey = () => `ux-tactics:${owner}`;
    function readDraft() {
      try { return workspace?.get ? workspace.get('tactics', {}) : JSON.parse(localStorage.getItem(`omerta_${storeKey()}`) || '{}'); } catch { return {}; }
    }
    function save(passive = false) {
      try { if (workspace?.set) { workspaceValue = JSON.stringify(draft); workspace.set('tactics', draft, { passive }); } else localStorage.setItem(`omerta_${storeKey()}`, JSON.stringify(draft)); } catch { /* A private scratchpad remains usable without storage. */ }
    }
    function ensureOwner() {
      const next = accountOf();
      if (next === owner) return;
      owner = next; board = null; loadedAt = 0; request++; pending = false; requestedPath = ''; error = '';
      const stored = readDraft() || {}; workspaceValue = JSON.stringify(stored);
      draft = normalizeDraft(stored);
    }
    function normalizeDraft(stored) {
      return { open: !!stored.open, tab: typeof stored.tab === 'string' ? stored.tab : '', view: typeof stored.view === 'string' ? stored.view : '', job: stored.job || '', approach: stored.approach || 'standard',
        plan: array(stored.plan).filter(p => typeof p?.id === 'string').slice(0, 3).map(p => ({ id: p.id, wait: Math.max(0, Math.min(86400, num(p.wait))) })),
        energy: stored.energy == null ? null : Math.max(0, num(stored.energy)), nerve: stored.nerve == null ? null : Math.max(0, num(stored.nerve)),
        gear: Array.isArray(stored.gear) ? stored.gear : null, skills: Array.isArray(stored.skills) ? stored.skills : null,
        unowned: !!stored.unowned, gearStat: stored.gearStat || '', boat: stored.boat || '', escort: !!stored.escort, setback: stored.setback || null };
    }
    const catalog = () => {
      const result = [...array(board?.planner), ...array(board?.jobs).flatMap(job => array(job.actual))];
      return result.filter((item, index) => result.findIndex(other => other.id === item.id) === index);
    };
    function budgets() {
      const me = state().me || {};
      return { energy: Math.min(num(me.energy), draft.energy == null ? num(me.energy) : draft.energy), nerve: Math.min(num(me.nerve), draft.nerve == null ? num(me.nerve) : draft.nerve), cash: num(me.cash) };
    }
    function pathForPreview() {
      const params = new URLSearchParams();
      if (draft.gear) params.set('gear', draft.gear.join(',') || 'none');
      if (draft.skills) params.set('skills', draft.skills.join(',') || 'none');
      if (state().currentTab === 'port') params.set('sea', '1');
      return '/v1/ux/tactics' + (params.size ? `?${params}` : '');
    }
    async function load(force = false) {
      ensureOwner();
      if (!owner || pending || (!force && board && Date.now() - loadedAt < 30000 && (state().currentTab !== 'port' || board.sea))) return;
      const identity = owner, character = state().me?.id, sequence = ++request, path = pathForPreview();
      pending = true; error = ''; requestedPath = path; paint();
      try {
        const result = await read(path);
        if (identity !== accountOf() || character !== state().me?.id || sequence !== request) return;
        if (result.code >= 400 || !result.body?.tactics) throw new Error(result.body?.message || 'This comparison could not be loaded.');
        board = result.body.tactics; loadedAt = Date.now();
      } catch (failure) { if (sequence === request && identity === accountOf()) error = failure.message || 'This comparison could not be loaded.'; }
      finally { if (sequence === request) { pending = false; paint(); } }
    }
    function mount() {
      const current = panel();
      if (!current || !eligibleTabs.includes(state().currentTab) || !state().me) return null;
      let host = current.querySelector(':scope > [data-ux-tactics]');
      if (host?.dataset.uxOwner !== owner) { host?.remove(); host = null; }
      if (!host) {
        host = document.createElement('details'); host.className = 'ux-tactics'; host.dataset.uxTactics = ''; host.dataset.uxPanel = 'tactics'; host.dataset.uxOwner = owner;
        host.innerHTML = '<summary>THE PLANNING TABLE <span>Compare · preview · plan</span></summary><div class="ux-tactics-body"></div>';
        current.prepend(host);
        host.addEventListener('toggle', () => { if (draft.open !== host.open) { draft.open = host.open; save(); } if (host.open) { paint(); load(); } });
      }
      if (host.open !== draft.open) host.open = draft.open;
      return host;
    }
    function defaultView() {
      return state().currentTab === 'port' ? 'sea' : state().currentTab === 'garage' ? 'loadout' : state().currentTab === 'life' ? 'skills' : ['pen', 'law'].includes(state().currentTab) ? 'recovery' : state().currentTab === 'start' ? 'plan' : 'jobs';
    }
    function selectedJob() {
      const budget = budgets();
      const available = array(board?.jobs).filter(job => job.actual.some(q => q.cost.nerve <= budget.nerve && q.cost.energy <= budget.energy));
      const found = available.find(job => job.id === draft.job) || available.filter(job => job.minLevel <= num(state().me?.level)).at(-1) || available[0];
      return { available, found };
    }
    function budgetMarkup() {
      const values = budgets();
      return `<fieldset class="ux-tactics-budget"><legend>Use only this much of your current resources</legend><label>Energy <input data-tactics-field="energy" type="number" min="0" max="${num(state().me?.energy)}" value="${values.energy}"></label><label>Nerve <input data-tactics-field="nerve" type="number" min="0" max="${num(state().me?.nerve)}" value="${values.nerve}"></label><span>Comparisons and plans respect this budget. No regeneration or rewards are assumed.</span></fieldset>`;
    }
    function jobsMarkup() {
      const { available, found } = selectedJob();
      return `${budgetMarkup()}<label class="ux-tactics-label">Compare a job <select data-tactics-field="job">${available.map(job => `<option value="${esc(job.id)}"${job.id === found?.id ? ' selected' : ''}>${esc(job.name)} · level ${job.minLevel}</option>`).join('')}</select></label>
        ${!found ? '<p>No jobs fit this resource budget. Raise the budget or compare recovery options.</p><button class="act" type="button" data-tactics-view="recovery">Compare recovery</button>' : `<div class="ux-tactics-table-wrap"><table class="ux-tactics-comparison"><caption>${esc(found.name)} · current live loadout</caption><thead><tr><th scope="col">Terms</th>${found.actual.map(q => `<th scope="col">${esc(q.approachName)}</th>`).join('')}</tr></thead><tbody>
          <tr><th scope="row">Nerve</th>${found.actual.map(q => `<td>${q.cost.nerve}</td>`).join('')}</tr>
          <tr><th scope="row">Success chance</th>${found.actual.map(q => `<td>${pct(q.probability)}</td>`).join('')}</tr>
          <tr><th scope="row">Success payout</th>${found.actual.map(q => `<td>${money(q.cashRange.min)}–${money(q.cashRange.upperBound)}<small>conditional upper bound</small></td>`).join('')}</tr>
          <tr><th scope="row">Added heat</th>${found.actual.map(q => `<td>+${fmt(q.heat)}</td>`).join('')}</tr>
          <tr><th scope="row">Jail on failure</th>${found.actual.map(q => `<td>${duration(q.jailSeconds)}</td>`).join('')}</tr>
          <tr><th scope="row">Requirements</th>${found.actual.map(q => `<td>${q.blockers.length ? esc(q.blockers.join(' ')) : 'Current checks pass'}</td>`).join('')}</tr>
          <tr><th scope="row">Plan</th>${found.actual.map(q => `<td><button class="act" type="button" data-tactics-add="${esc(q.id)}">Add to plan</button></td>`).join('')}</tr>
          </tbody></table></div>${board.hypothetical ? `<div class="ux-tactics-hypothetical"><b>HYPOTHETICAL PREVIEW</b><p>Proposed gear and skills change this job’s estimates as follows. No inventory or skill points have changed.</p><div class="ux-tactics-table-wrap"><table><thead><tr><th>Approach</th><th>Success chance</th><th>Jail on failure</th></tr></thead><tbody>${found.proposed.map((q, i) => `<tr><th>${esc(q.approachName)}</th><td>${pct(found.actual[i].probability)} → ${pct(q.probability)}</td><td>${duration(found.actual[i].jailSeconds)} → ${duration(q.jailSeconds)}</td></tr>`).join('')}</tbody></table></div></div>` : ''}
          <p class="ux-tactics-note">Rewards exist only after a successful, server-recorded action. Failed attempts can still spend nerve, add heat and start cooldowns.</p><button class="act" type="button" data-tactics-view="formula">Explain these odds</button> <button class="act" type="button" data-tactics-open="streets">Review the live job controls →</button>`}`;
    }
    function seaMarkup() {
      const sea = board?.sea;
      if (!sea) return '<p>Open the planning table at the Port to load current boat and sea-lane quotes.</p><button class="act" data-tactics-open="port" type="button">Open the Port →</button>';
      const fleet = array(sea.fleet);
      const boat = fleet.find(b => b.id === draft.boat) || fleet.find(b => b.status === 'docked') || fleet[0];
      if (!boat) return '<p>Your working fleet is empty. Read the boat catalog and costs at the Port before acquiring a vessel.</p><button class="act" data-tactics-open="port" type="button">Review the Port →</button>';
      return `<label class="ux-tactics-label">Working boat <select data-tactics-field="boat">${fleet.map(b => `<option value="${esc(b.id)}"${b.id === boat.id ? ' selected' : ''}>${esc(b.name)} · ${esc(b.status)} · ${fmt(b.hold)} hold / ${fmt(b.speed)} knots</option>`).join('')}</select></label><label class="ux-tactics-check"><input type="checkbox" data-tactics-field="escort"${draft.escort ? ' checked' : ''}> Preview an escort · ${money(sea.escort.cost)} extra cargo-launch cost</label><p class="ux-tactics-note">Escort toggles are reversible previews. They do not hire an escort or launch a boat.</p><div class="ux-tactics-table-wrap"><table><caption>Launch now · collect under current conditions</caption><thead><tr><th>Sea lane</th><th>Cargo + escort</th><th>Clean proceeds</th><th>Clean margin</th><th>Interception</th><th>Time</th><th>Restrictions</th></tr></thead><tbody>${array(sea.quotes).filter(q => q.boatId === boat.id && q.escorted === draft.escort).map(q => `<tr><th>${esc(q.routeName)}</th><td>${money(q.cost)} + ${money(q.escortCost)}</td><td>${money(q.proceeds)}<small>${money(q.toll)} projected toll</small></td><td>${money(q.cleanMargin)}</td><td>${pct(q.interceptionProbability)}</td><td>${duration(q.seconds)}</td><td>${q.blockers.length ? esc(q.blockers.join(' ')) : 'Current launch checks pass'}</td></tr>`).join('')}</tbody></table></div><p class="ux-tactics-note">${esc(array(sea.quotes)[0]?.assumption || '')} Clean margin is conditional on a clean landing; losses, fines and sinking can occur.</p>`;
    }
    function planMarkup() {
      const entries = catalog(), analysis = analyzePlan(draft.plan, entries, budgets());
      return `${budgetMarkup()}<p>Plan up to three moves, then review and execute each one yourself through its live control. This scratchpad never runs a sequence.</p><label class="ux-tactics-label">Add a move <select data-tactics-field="plan-choice">${entries.filter(move => move.cost.nerve <= budgets().nerve && move.cost.energy <= budgets().energy).map(move => `<option value="${esc(move.id)}">${esc(move.name)}${move.approach ? ` · ${esc(move.approachName || move.approach)}` : ''} · ${move.cost.nerve || 0} nerve / ${move.cost.energy || 0} energy</option>`).join('')}</select></label><button class="act" type="button" data-tactics-add-choice>Add to plan</button>
        ${analysis.length ? `<ol class="ux-tactics-plan">${analysis.map((step, i) => `<li><div class="ux-tactics-plan-head"><b>${esc(step.move?.name || step.entry.id)}${step.move?.approach ? ` · ${esc(step.move.approachName || step.move.approach)}` : ''}</b><span><button class="act" data-tactics-up="${i}" type="button"${i === 0 ? ' disabled' : ''} aria-label="Move step ${i + 1} earlier">↑</button><button class="act" data-tactics-remove="${i}" type="button" aria-label="Remove step ${i + 1}">Remove</button></span></div><label>Wait before this move <input type="number" min="0" max="86400" data-tactics-wait="${i}" value="${step.entry.wait}"> seconds</label><p>After this move’s costs: ${fmt(Math.max(0, step.balances.nerve))} nerve · ${fmt(Math.max(0, step.balances.energy))} energy · ${money(Math.max(0, step.balances.cash))} cash</p>${step.conflicts.length ? `<ul class="ux-tactics-conflicts">${step.conflicts.map(conflict => `<li>${esc(conflict)}</li>`).join('')}</ul>` : '<p class="ux-tactics-clear">No conflict under these assumptions.</p>'}${step.move ? `<button class="act" data-tactics-open="${esc(step.move.tab)}" type="button">Review move ${i + 1} →</button>` : ''}</li>`).join('')}</ol>` : '<p class="ux-tactics-note">The plan is empty. Add moves here or from the approach comparison.</p>'}`;
    }
    function loadoutMarkup() {
      const loadout = board.loadout, selected = draft.gear || loadout.proposed;
      const candidates = array(loadout.catalog).filter(g => (draft.unowned || g.owned || selected.includes(g.id)) && (!draft.gearStat || g.stat === draft.gearStat));
      return `<p>${esc(loadout.note)}</p><div class="ux-tactics-hypothetical"><b>HYPOTHETICAL LOADOUT BENCH · NO EQUIP OR PURCHASE</b><div class="ux-tactics-table-wrap"><table><thead><tr><th>Effective stat</th><th>Current in-play</th><th>Proposed preview</th><th>Delta</th></tr></thead><tbody>${['muscle', 'cunning', 'speed'].map(stat => `<tr><th>${stat}</th><td>${fmt(loadout.actualStats[stat])}</td><td>${fmt(loadout.proposedStats[stat])}</td><td>${loadout.proposedStats[stat] - loadout.actualStats[stat] >= 0 ? '+' : ''}${fmt(loadout.proposedStats[stat] - loadout.actualStats[stat])}</td></tr>`).join('')}</tbody></table></div></div><label class="ux-tactics-check"><input type="checkbox" data-tactics-field="unowned"${draft.unowned ? ' checked' : ''}> Include catalog gear not currently in play (hypothetical only)</label><label class="ux-tactics-label">Stat <select data-tactics-field="gearStat"><option value="">All stats</option>${['muscle', 'cunning', 'speed'].map(stat => `<option${draft.gearStat === stat ? ' selected' : ''}>${stat}</option>`).join('')}</select></label><fieldset class="ux-tactics-gear"><legend>Include in proposed preview</legend>${candidates.map(g => `<label><input type="checkbox" data-tactics-gear="${esc(g.id)}"${selected.includes(g.id) ? ' checked' : ''}> ${esc(g.name)} · +${g.boost} ${esc(g.stat)} <small>${g.owned ? 'currently in play' : g.extracted ? 'extracted · not in play' : 'not owned'}</small></label>`).join('') || '<p>No gear matches this filter.</p>'}</fieldset><button class="act prime" type="button" data-tactics-preview>Calculate preview</button> <button class="act" type="button" data-tactics-reset>Reset to live setup</button><p class="ux-tactics-note">Stat changes and job estimates update after Calculate preview. Use Compare jobs to inspect the resulting chance and jail terms.</p>`;
    }
    function skillsMarkup() {
      const skills = board.skills, selected = draft.skills || skills.selected, spent = skills.tree.filter(s => selected.includes(s.id)).reduce((total, skill) => total + skill.cost, 0);
      return `<div class="ux-tactics-hypothetical"><b>HYPOTHETICAL SKILLS · NO POINTS SPENT</b><p><span id="ux-tactics-skill-spent">${spent}</span> points proposed / ${skills.points.total} current point budget. Known skills stay unchanged.</p>${skills.conflicts.length ? `<ul class="ux-tactics-conflicts">${skills.conflicts.map(text => `<li>${esc(text)}</li>`).join('')}</ul>` : ''}</div><div class="ux-tactics-skills">${[...new Set(skills.tree.map(s => s.branch))].map(branch => `<fieldset><legend>${esc(branch)}</legend>${skills.tree.filter(s => s.branch === branch).sort((a, b) => a.tier - b.tier).map(skill => `<label><input type="checkbox" data-tactics-skill="${esc(skill.id)}"${selected.includes(skill.id) ? ' checked' : ''}><b>${esc(skill.name)}</b> · ${skill.cost} points${skills.known.includes(skill.id) ? ' · known' : ''}<span>${esc(skill.desc)}</span><small>Tier ${skill.tier}${skill.tier > 1 ? ` · requires ${esc(skills.tree.find(s => s.branch === skill.branch && s.tier === skill.tier - 1)?.name || 'previous tier')}` : ''}</small></label>`).join('')}</fieldset>`).join('')}</div><button class="act prime" type="button" data-tactics-preview>Calculate hypothetical effects</button> <button class="act" type="button" data-tactics-reset>Reset to live setup</button><p class="ux-tactics-note">The preview checks prerequisites and your current point budget. Getaway changes projected crime jail time; the Doc’s Friend changes a live healing quote. Skills that do not enter the success-roll formula never raise the displayed job chance.</p>`;
    }
    function formulaMarkup() {
      const { found } = selectedJob();
      if (!found) return '<p>No job fits this resource budget. Adjust the budget in Compare jobs.</p>';
      const quote = found.actual.find(q => q.approach === draft.approach) || found.actual[1] || found.actual[0];
      const input = quote.formula.inputs, coeff = quote.formula.coefficients;
      return `<h4>Why these odds? ${esc(found.name)}</h4><label class="ux-tactics-label">Approach <select data-tactics-field="approach">${found.actual.map(q => `<option value="${q.approach}"${q.approach === quote.approach ? ' selected' : ''}>${esc(q.approachName)}</option>`).join('')}</select></label><div class="ux-tactics-table-wrap"><table><thead><tr><th>Actual input or condition</th><th>Current value</th><th>Role</th></tr></thead><tbody>${quote.modifiers.map(m => `<tr><th>${esc(m.label)}</th><td>${m.value == null ? '—' : fmt(m.value)}</td><td>${esc(m.effect)}</td></tr>`).join('')}</tbody></table></div><details class="ux-tactics-explorer" open><summary>Explore the published job-roll formula</summary><p>Hypothetical effective stats only. Other current modifiers stay fixed. The explorer evaluates the server-provided formula; it does not roll a job.</p><label>Cunning <output data-explorer-cunning>${input.cunning}</output><input type="range" min="0" max="${Math.max(100, Math.ceil(input.cunning + 50))}" step="1" value="${input.cunning}" data-tactics-explorer="cunning"></label><label>Speed <output data-explorer-speed>${input.speed}</output><input type="range" min="0" max="${Math.max(100, Math.ceil(input.speed + 50))}" step="1" value="${input.speed}" data-tactics-explorer="speed"></label><p class="ux-tactics-formula">min(97%, (base + cunning × ${coeff.cunning} + speed × ${coeff.speed} − ${coeff.offset} + family + turf + rank) × approach)</p><p><b>Hypothetical success chance: <output data-explorer-result>${pct(quote.probability)}</output></b></p><small>${esc(quote.formula.source)} · <a href="/wiki#coreloop" target="_blank" rel="noopener">Read the job rules ↗</a>. Probability can never guarantee the next roll.</small></details>`;
    }
    function recoveryMarkup() {
      return `<p>Compare the current costs and restrictions before choosing a recovery route. An activity timer and a resource shortage are separate requirements.</p><div class="ux-tactics-table-wrap"><table><thead><tr><th>Option</th><th>Resource cost</th><th>Time</th><th>Effect</th><th>Restrictions</th><th>Review</th></tr></thead><tbody>${array(board.recovery?.options).map(option => `<tr><th>${esc(option.name)}</th><td>${esc(option.cost)}</td><td>${duration(option.seconds)}</td><td>${esc(option.effect)}</td><td>${array(option.restrictions).map(esc).join(' ')}</td><td><button class="act" data-tactics-open="${esc(option.tab)}" type="button">Review →</button></td></tr>`).join('')}</tbody></table></div>`;
    }
    function setbackMarkup() {
      const setback = draft.setback;
      if (!setback) return '';
      return `<details class="ux-tactics-setback"><summary>Understand the last setback</summary><p><b>${esc(setback.label)}</b> · ${esc(setback.summary)}</p>${setback.random ? `<p>The server recorded an unsuccessful random roll. The pre-action projection was ${setback.probability == null ? 'not available' : pct(setback.probability)} success. No individual modifier is proven to have caused the failure.</p>` : '<p>This was an explicit server refusal or connection failure. It is separate from losing a random outcome.</p>'}${setback.factors?.length ? `<ul>${setback.factors.map(m => `<li>${esc(m.label)}: ${m.value == null ? '' : esc(fmt(m.value))} · ${esc(m.effect)}</li>`).join('')}</ul>` : ''}<p>Known result: ${esc(setback.known || 'No additional state change is confirmed.')}</p><button class="act" data-tactics-view="recovery" type="button">Compare recovery routes</button></details>`;
    }
    function paint() {
      const host = mount();
      if (!host?.open) return;
      const body = host.querySelector('.ux-tactics-body'), focus = document.activeElement;
      const focusKey = host.contains(focus) ? ['data-tactics-view', 'data-tactics-field', 'data-tactics-preview', 'data-tactics-reset', 'data-tactics-wait'].map(key => focus.hasAttribute?.(key) ? [key, focus.getAttribute(key)] : null).find(Boolean) : null;
      const active = draft.view || defaultView();
      if (!board) body.innerHTML = `<p role="status">${error ? esc(error) : 'Reading current costs and conditions…'}</p>${error ? '<button class="act" data-tactics-retry type="button">Try again</button>' : ''}`;
      else {
        const views = [['jobs', 'Compare jobs'], ['sea', 'Sea lanes'], ['loadout', 'Loadout bench'], ['skills', 'Skill sandbox'], ['plan', 'Three moves'], ['formula', 'Explain odds'], ['recovery', 'Recovery']];
        const coach = board.coach;
        body.innerHTML = `<div class="ux-tactics-toolbar" aria-label="Planning views">${views.map(([id, name]) => `<button class="act" type="button" data-tactics-view="${id}" aria-pressed="${active === id}">${name}</button>`).join('')}</div><p class="ux-tactics-note">Read ${esc(new Date(board.generatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))} · ${esc(board.note)} ${pending ? '<span role="status">Updating preview…</span>' : ''}</p>${error ? `<p role="alert">${esc(error)}</p>` : ''}
          ${coach ? `<details class="ux-tactics-coach"><summary>Why did the city recommend “${esc(coach.label)}”?</summary><p>${esc(coach.explanation)}</p><blockquote>${esc(coach.hint || '')}</blockquote><p>Level ${coach.resources.level} · ${coach.resources.nerve} nerve · ${coach.resources.energy} energy · ${money(coach.resources.cash)} cash</p>${array(coach.eligibility).length ? `<ul>${coach.eligibility.map(item => `<li>${esc(item.name)}: ${item.blockers.length ? esc(item.blockers.join(' ')) : 'listed checks currently pass'}</li>`).join('')}</ul>` : ''}<button class="act" type="button" data-tactics-open="${esc(coach.tab)}">Review the recommended screen →</button></details>` : ''}
          ${setbackMarkup()}<div class="ux-tactics-view">${({ jobs: jobsMarkup, sea: seaMarkup, loadout: loadoutMarkup, skills: skillsMarkup, plan: planMarkup, formula: formulaMarkup, recovery: recoveryMarkup }[active] || jobsMarkup)()}</div>`;
      }
      body.onclick = onClick; body.onchange = onChange; body.oninput = onInput;
      if (focusKey) [...body.querySelectorAll(`[${focusKey[0]}]`)].find(node => node.getAttribute(focusKey[0]) === focusKey[1])?.focus({ preventScroll: true });
    }
    function add(id) {
      if (draft.plan.length >= 3) { notify('The plan already has three moves. Remove a move to make room.'); return; }
      if (!catalog().some(move => move.id === id)) return;
      draft.plan.push({ id, wait: 0 }); draft.view = 'plan'; save(); paint();
    }
    function onClick(event) {
      const button = event.target.closest('button'); if (!button) return;
      if (button.hasAttribute('data-tactics-view')) { draft.view = button.dataset.tacticsView; save(); paint(); if (draft.view === 'sea' && !board?.sea && state().currentTab === 'port') load(true); }
      else if (button.hasAttribute('data-tactics-open')) navigate(button.dataset.tacticsOpen);
      else if (button.hasAttribute('data-tactics-add')) add(button.dataset.tacticsAdd);
      else if (button.hasAttribute('data-tactics-add-choice')) add(panel()?.querySelector('[data-tactics-field="plan-choice"]')?.value);
      else if (button.hasAttribute('data-tactics-remove')) { draft.plan.splice(num(button.dataset.tacticsRemove), 1); save(); paint(); }
      else if (button.hasAttribute('data-tactics-up')) { const i = num(button.dataset.tacticsUp); if (i > 0) [draft.plan[i - 1], draft.plan[i]] = [draft.plan[i], draft.plan[i - 1]]; save(); paint(); }
      else if (button.hasAttribute('data-tactics-preview') || button.hasAttribute('data-tactics-retry')) load(true);
      else if (button.hasAttribute('data-tactics-reset')) { draft.gear = null; draft.skills = null; save(); load(true); }
    }
    function onChange(event) {
      const input = event.target;
      if (input.hasAttribute('data-tactics-wait')) { const entry = draft.plan[num(input.dataset.tacticsWait)]; if (entry) entry.wait = Math.max(0, Math.min(86400, num(input.value))); save(); paint(); }
      else if (input.hasAttribute('data-tactics-gear')) {
        const selected = new Set(draft.gear || board.loadout.proposed); input.checked ? selected.add(input.dataset.tacticsGear) : selected.delete(input.dataset.tacticsGear); draft.gear = [...selected]; save();
      } else if (input.hasAttribute('data-tactics-skill')) {
        const selected = new Set(draft.skills || board.skills.selected); input.checked ? selected.add(input.dataset.tacticsSkill) : selected.delete(input.dataset.tacticsSkill); draft.skills = [...selected]; save();
        const spent = board.skills.tree.filter(s => selected.has(s.id)).reduce((sum, skill) => sum + skill.cost, 0);
        const output = panel()?.querySelector('#ux-tactics-skill-spent'); if (output) output.textContent = spent;
      } else if (input.hasAttribute('data-tactics-field')) {
        const key = input.dataset.tacticsField;
        if (key === 'plan-choice') return;
        draft[key] = ['energy', 'nerve'].includes(key) ? Math.max(0, num(input.value)) : input.type === 'checkbox' ? input.checked : input.value;
        save(); paint();
      }
    }
    function onInput(event) {
      if (!event.target.hasAttribute('data-tactics-explorer')) return;
      const { found } = selectedJob(), quote = found?.actual.find(q => q.approach === draft.approach) || found?.actual[1] || found?.actual[0];
      if (!quote) return;
      const host = event.target.closest('.ux-tactics-explorer'), values = { ...quote.formula.inputs };
      host.querySelectorAll('[data-tactics-explorer]').forEach(input => { values[input.dataset.tacticsExplorer] = num(input.value); host.querySelector(`[data-explorer-${input.dataset.tacticsExplorer}]`).textContent = input.value; });
      host.querySelector('[data-explorer-result]').textContent = pct(evaluateFormula(quote.formula.expression, values));
    }
    function observe(path, body) {
      if (!path.startsWith('/v1/ux/tactics') || !body?.tactics || body.tactics.characterId !== state().me?.id) return;
      ensureOwner();
      if (requestedPath && path !== requestedPath) return;
      board = body.tactics; loadedAt = Date.now();
    }
    function recordOperation(receipt, before, after, result) {
      ensureOwner(); loadedAt = 0;
      if (result?.body?.success === false || num(result?.code) >= 400) {
        const context = result.body?.decisionContext;
        draft.setback = { label: receipt.label || 'Move', summary: receipt.summary || '', random: result.body?.success === false && num(result.code) < 400,
          probability: context?.probability ?? null, factors: array(context?.modifiers),
          known: result.body?.jailSeconds != null ? `${result.body.jailSeconds} seconds of lockup recorded.` : result.body?.message || receipt.delta || '' };
        save();
      }
      render();
    }
    function render() {
      ensureOwner();
      if (!owner || !eligibleTabs.includes(state().currentTab)) return;
      if (workspace?.get) {
        const stored = readDraft() || {}, serialized = JSON.stringify(stored);
        if (serialized !== workspaceValue) {
          workspaceValue = serialized; draft = normalizeDraft(stored); board = null; loadedAt = 0; request++; pending = false; requestedPath = '';
        }
      }
      if (draft.tab !== state().currentTab) { draft.tab = state().currentTab; draft.view = defaultView(); save(true); }
      mount(); if (draft.open) { paint(); load(); }
    }
    document.addEventListener('omerta:tactics-apply-plan', event => {
      ensureOwner();
      if (!owner || event.detail?.characterId !== state().me?.id) return;
      const plan = array(event.detail.plan).filter(move => typeof move?.id === 'string').slice(0, 3).map(move => ({ id: move.id, wait: Math.max(0, Math.min(86400, num(move.wait))) }));
      draft.plan = plan; draft.open = true; draft.view = 'plan'; draft.tab = 'streets'; save(); render();
    });
    document.addEventListener('omerta:tactics-open', event => {
      ensureOwner(); if (!owner) return;
      draft.open = true; draft.view = event.detail?.view === 'plan' ? 'plan' : defaultView(); draft.tab = state().currentTab; save(); render();
    });
    return { render, observe, recordOperation, afterRender: render, load };
  }
  create.analyzePlan = analyzePlan; create.evaluateFormula = evaluateFormula;
  window.createOmertaTactics = create;
})();
