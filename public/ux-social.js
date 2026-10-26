/* Social UX uses existing boards and deliberate, server-authorized crew messages. */
(() => {
  'use strict';
  const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const number = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
  const fmt = (value) => number(value).toLocaleString(undefined, { maximumFractionDigits: 0 });
  const groupOf = (cat) => ({ market: 'money', den: 'money', race: 'money', crime: 'money' }[cat] || cat);
  const tradesOf = (me) => new Map((Array.isArray(me?.trades) ? me.trades : []).map((t) => [t.id, t]));
  const GROWTH = { mastery_up: 'mastery advances', protege_milestone: 'protégé milestones', protege_graduated: 'protégé graduations', mentor_accepted: 'new mentorships', crew_objective_done: 'crew objectives completed', crew_joined: 'crew arrivals', vouch: 'new votes of confidence' };

  window.createOmertaSocial = ({ getState, read, navigate, notify, action, workspace }) => {
    let account = null, boards = {}, baseline = null, operations = 0, summaryOpen = false;
    let milestones = [], sent = new Set(), pending = false, objectiveStart = null;
    const settings = () => {
      try { return JSON.parse(localStorage.getItem(`omerta_ux_social_${account}`) || '{}'); } catch { return {}; }
    };
    const saveSettings = (patch) => {
      if (!account) return;
      workspace?.set('social', { ...settings(), ...patch });
      try { localStorage.setItem(`omerta_ux_social_${account}`, JSON.stringify({ ...settings(), ...patch })); } catch { /* private browsing may disable storage */ }
    };
    const sync = () => {
      const me = getState().me;
      const next = me?.accountId || me?.id;
      if (!next) return null;
      if (account && account !== next) {
        boards = {}; baseline = null; operations = 0; milestones = []; sent = new Set(); objectiveStart = null; summaryOpen = false;
        ['ux-crew-welcome', 'ux-crew-payoff', 'ux-circle-highlights', 'ux-mentor-journeys', 'ux-session-endpoint'].forEach((id) => document.getElementById(id)?.remove());
        document.querySelectorAll('.ux-paper-growth').forEach((node) => node.remove());
      }
      account = next;
      if (!baseline || baseline.id !== me.id) baseline = { id: me.id, level: number(me.level), respect: number(me.respect) };
      return me;
    };
    const put = (id, parent, html, where = 'append') => {
      if (!parent) return null;
      let node = document.getElementById(id);
      if (!node || !parent.contains(node)) {
        node?.remove(); node = document.createElement('section'); node.id = id; node.className = 'card ux-social-card';
        if (where === 'prepend') parent.prepend(node); else parent.append(node);
      }
      if (node._uxMarkup !== html) { node.innerHTML = html; node._uxMarkup = html; }
      return node;
    };
    const crew = () => boards.crew?.crew;
    const queueMilestone = (text) => {
      const clean = String(text || '').trim().slice(0, 220);
      if (clean && !milestones.includes(clean)) milestones = [clean, ...milestones].slice(0, 5);
    };
    const sendToCrew = async (button, text) => {
      if (pending || !crew()) return;
      pending = true; button.disabled = true;
      try {
        const result = await action('POST', '/v1/crew/chat', { text });
        if (!result || number(result.code) < 200 || number(result.code) >= 300 || result.body?.error) return;
        sent.add(text); notify('Your note is in the Crew Room.');
        const reply = await read('/v1/circle');
        if (reply?.code < 400) boards.circle = reply.body;
      } catch { notify('The note could not be sent. Try again from the Crew Room.'); }
      finally { pending = false; button.disabled = false; render(); }
    };

    function renderCrew(me) {
      const tab = document.getElementById('tab-crew'), c = crew();
      if (!tab || !c) {
        document.getElementById('ux-crew-welcome')?.remove(); document.getElementById('ux-crew-payoff')?.remove();
        if (tab) renderHighlights(me, tab);
        return;
      }
      const prefs = settings(), leader = (c.members || []).find((m) => m.leader), o = c.objective;
      const newCrew = prefs.welcomedCrew !== c.id;
      const welcome = put('ux-crew-welcome', tab, `<div class="ux-social-eyebrow">${newCrew ? 'A seat at the table' : 'Your people'}</div><h3>${newCrew ? 'Welcome to ' : ''}${esc(c.name)}</h3><p>${leader ? `${esc(leader.isMe ? 'You lead' : leader.name + ' leads')} this crew. ` : ''}${(c.members || []).length} ${c.members?.length === 1 ? 'member' : 'members'} · a private room to plan together.</p>${o ? `<p><b>Current objective:</b> ${esc(o.label)} · ${fmt(o.pct)}% complete.</p>` : ''}<div class="row"><button type="button" class="act" data-crew-room>Meet in the Crew Room</button>${newCrew ? '<button type="button" class="act" data-crew-welcome>Got it</button>' : ''}</div>`, 'prepend');
      welcome.querySelector('[data-crew-room]').onclick = () => { const room = document.getElementById('crew-say'); room?.scrollIntoView({ block: 'center', behavior: 'smooth' }); room?.focus({ preventScroll: true }); };
      const dismiss = welcome.querySelector('[data-crew-welcome]');
      if (dismiss) dismiss.onclick = () => { saveSettings({ welcomedCrew: c.id }); render(); };
      if (o) {
        const amount = (n) => `${o.unit === '$' ? '$' : ''}${fmt(n)}${o.unit && o.unit !== '$' ? ' ' + esc(o.unit) : ''}`;
        const contributors = (o.contributions || []).filter((p) => number(p.n) > 0);
        const payoff = put('ux-crew-payoff', tab, `<div class="ux-social-eyebrow">${o.done ? 'You did this together' : 'Your part in the job'}</div><h3>${o.done ? 'Objective complete' : esc(o.label)}</h3><p class="ux-contribution">You supplied <strong>${amount(o.mine)}</strong> of the crew's <strong>${amount(o.progress)}</strong>.</p><p>${amount(o.progress)} / ${amount(o.target)} · ${o.done ? 'Completed' : `${fmt(o.pct)}% complete`}</p><div class="ux-contributors">${contributors.map((p) => `<div><span>${esc(p.name)}${p.name === me.name ? ' · you' : ''}</span><b>${amount(p.n)}</b><progress max="${Math.max(1, number(o.progress))}" value="${number(p.n)}" aria-label="${esc(p.name)} contribution"></progress></div>`).join('') || '<p>Your next contribution starts the story.</p>'}</div>${o.done ? `<p>${number(o.mine) > 0 ? (o.claimed ? 'Your cut has been collected.' : `Your contribution earned a $${fmt(o.reward)} cut. Collect it from this week's job below.`) : 'Your crew finished the job. Contribute to the next one to earn a cut.'}</p>` : `<p>Every member's qualifying play moves this objective forward.</p>`}`);
        if (welcome.nextElementSibling !== payoff) welcome.after(payoff);
      }
      renderHighlights(me, tab);
    }

    function renderHighlights(me, tab) {
      const highlights = boards.circle?.highlights || [], c = crew();
      if (!highlights.length && !milestones.length) { document.getElementById('ux-circle-highlights')?.remove(); return; }
      const items = highlights.slice(0, 10).map((h) => {
        const teammate = (c?.members || []).find((m) => !m.isMe && m.name === h.who);
        const kudos = `Well done, ${h.who} — ${h.text}!`.slice(0, 240);
        return `<li><div><strong>${esc(h.who)}</strong> ${esc(h.text)}</div><small>${esc(h.relation)} · ${h.source === 'crew message' ? 'shared in the Crew Room' : 'from your inbox'}</small>${teammate ? `<details class="ux-note-preview"><summary>Congratulate ${esc(h.who)}</summary><p>${esc(kudos)}</p><button type="button" class="act" data-crew-note="${esc(kudos)}"${sent.has(kudos) ? ' disabled' : ''}>${sent.has(kudos) ? 'Sent to the crew' : 'Send congratulations to crew'}</button></details>` : ''}</li>`;
      }).join('');
      const node = put('ux-circle-highlights', tab, `<div class="ux-social-eyebrow">The moments between the jobs</div><h3>Circle highlights</h3>${items ? `<ul class="ux-highlight-list">${items}</ul>` : '<p>Your confirmed milestone is ready to share.</p>'}${c && milestones.length ? `<details class="ux-note-preview"><summary>Share a milestone with your crew</summary>${milestones.map((text) => { const message = `[Milestone] ${text}`; return `<div class="ux-share-milestone"><p>${esc(message)}</p><button type="button" class="act" data-crew-note="${esc(message)}"${sent.has(message) ? ' disabled' : ''}>${sent.has(message) ? 'Shared to the crew' : 'Share to Crew Room'}</button></div>`; }).join('')}</details>` : ''}`);
      node.querySelectorAll('[data-crew-note]').forEach((button) => { button.onclick = () => sendToCrew(button, button.dataset.crewNote); });
    }

    function renderMentor() {
      const tab = document.getElementById('tab-discover'), board = boards.mentor;
      if (!tab || !board || (!board.mentor && !board.proteges?.length)) return;
      const milestones = board.milestones || [];
      const journey = (name, level, graduated) => `<div class="ux-mentor-journey"><h4>${esc(name)}${graduated ? ' · graduated' : ''}</h4><ol class="ux-mentor-timeline">${milestones.map((m) => `<li class="${number(level) >= number(m.lvl) ? 'reached' : ''}"><span aria-hidden="true">${number(level) >= number(m.lvl) ? '✓' : '○'}</span><b>Level ${fmt(m.lvl)}</b><small>${m.graduate ? (graduated ? 'Graduated' : number(level) >= number(m.lvl) ? 'Ready to graduate' : 'Graduation') : number(level) >= number(m.lvl) ? 'Reached' : 'Ahead'} · $${fmt(m.cash)}</small></li>`).join('')}</ol></div>`;
      const own = board.mentor ? journey(`Your journey with ${board.mentor.name}`, board.me?.level, board.mentor.graduated) : '';
      const proteges = (board.proteges || []).map((p) => journey(p.name, p.level, p.graduated)).join('');
      put('ux-mentor-journeys', tab, `<div class="ux-social-eyebrow">Someone has your back</div><h3>The mentorship journey</h3>${own}${proteges}<p class="d">Reached milestones show progress. Claim available rewards in The Mentor panel.</p>`, 'prepend');
    }

    function renderPaper() {
      const paper = boards.paper, card = document.getElementById('paper-fold')?.closest('.card');
      if (!card || !paper?.fresh) return;
      const growth = (paper.headlines || []).filter((h) => GROWTH[h.type]);
      if (!growth.length) return;
      let node = card.querySelector('.ux-paper-growth');
      if (!node) { node = document.createElement('div'); node.className = 'ux-paper-growth'; card.querySelector('.row')?.before(node); }
      node.innerHTML = `<strong>More than the books</strong><ul>${growth.map((h) => `<li>${fmt(h.n)} ${esc(GROWTH[h.type])}</li>`).join('')}</ul>`;
    }

    function renderSession(me, tabName) {
      const tab = document.getElementById(`tab-${tabName}`);
      if (!tab || !operations) return;
      const respect = number(me.respect) - number(baseline?.respect), levels = number(me.level) - number(baseline?.level);
      const contribution = crew()?.objective && objectiveStart != null ? Math.max(0, number(crew().objective.mine) - objectiveStart) : 0;
      const node = put('ux-session-endpoint', tab, `<div class="ux-social-eyebrow">A good place to pause</div><h3>Your session</h3><p>${fmt(operations)} confirmed ${operations === 1 ? 'action' : 'actions'}${levels > 0 ? ` · ${fmt(levels)} ${levels === 1 ? 'level' : 'levels'} gained` : ''}${respect > 0 ? ` · +${fmt(respect)} respect` : ''}${contribution > 0 ? ' · you moved your crew objective forward' : ''}.</p>${summaryOpen ? `<ul class="ux-session-milestones">${milestones.map((m) => `<li>${esc(m)}</li>`).join('')}</ul><p>Your confirmed actions are already recorded. You can leave the city whenever you choose.</p><button type="button" class="act" data-session-close>Done for now</button>` : '<button type="button" class="act" data-session-open>Wrap up this session</button>'}`);
      const open = node.querySelector('[data-session-open]'), close = node.querySelector('[data-session-close]');
      if (open) open.onclick = () => { summaryOpen = true; render(); };
      if (close) close.onclick = () => { summaryOpen = false; render(); notify('Your session is wrapped up. Come back when it suits you.'); };
    }

    function applyFeedPreferences() {
      const prefs = settings(), people = new Set((boards.circle?.people || crew()?.members || []).map((p) => p.name?.toLowerCase()).filter(Boolean));
      document.querySelectorAll('#feed > .ev').forEach((line) => {
        const mine = line.classList.contains('me'), urgent = line.classList.contains('urgent');
        const name = String(line.dataset.uxWho || '').toLowerCase();
        const personal = mine || line.dataset.uxPersonal === 'true' || people.has(name);
        const group = groupOf(line.dataset.cat);
        line.classList.toggle('ux-feed-hidden', !urgent && ((!personal && prefs.feedScope === 'circle') || (!mine && (prefs.mutedInterests || []).includes(group))));
      });
    }

    function renderFeed() {
      const feed = document.getElementById('feed');
      if (!feed) return;
      let node = document.getElementById('ux-feed-preferences');
      if (!node) { node = document.createElement('details'); node.id = 'ux-feed-preferences'; node.className = 'ux-feed-preferences'; feed.before(node); }
      const prefs = settings(), groups = ['combat', 'law', 'money', 'family', 'world'];
      const markup = `<summary>Your wire preferences</summary><label>Show <select data-feed-scope aria-label="Activity feed audience"><option value="all"${prefs.feedScope !== 'circle' ? ' selected' : ''}>The whole city</option><option value="circle"${prefs.feedScope === 'circle' ? ' selected' : ''}>My events and my people</option></select></label><fieldset><legend>Public interests</legend>${groups.map((group) => `<label><input type="checkbox" data-feed-interest="${group}"${(prefs.mutedInterests || []).includes(group) ? '' : ' checked'}> ${group}</label>`).join('')}</fieldset><small>Your events and urgent notices stay visible. Preferences apply to this account on this browser.</small>`;
      if (node._uxMarkup !== markup) { node.innerHTML = markup; node._uxMarkup = markup; }
      node.querySelector('[data-feed-scope]').value = prefs.feedScope === 'circle' ? 'circle' : 'all';
      node.querySelectorAll('[data-feed-interest]').forEach((input) => { input.checked = !(prefs.mutedInterests || []).includes(input.dataset.feedInterest); });
      node.querySelector('[data-feed-scope]').onchange = (e) => { saveSettings({ feedScope: e.target.value }); applyFeedPreferences(); };
      node.querySelectorAll('[data-feed-interest]').forEach((input) => { input.onchange = () => { saveSettings({ mutedInterests: [...node.querySelectorAll('[data-feed-interest]:not(:checked)')].map((i) => i.dataset.feedInterest) }); applyFeedPreferences(); }; });
      applyFeedPreferences();
    }

    function render() {
      const me = sync();
      if (!me) return;
      const tab = getState().currentTab;
      renderFeed();
      if (tab === 'crew') renderCrew(me);
      if (tab === 'discover') renderMentor();
      if (tab === 'start') renderPaper();
      if (tab === 'start' || tab === 'profile') renderSession(me, tab);
    }

    function observe(path, body) {
      sync();
      const route = String(path).split('?')[0];
      if (route === '/v1/home') { boards.crew = body?.crew; boards.paper = body?.paper; }
      else if (route === '/v1/crew') boards.crew = body;
      else if (route === '/v1/circle') boards.circle = body;
      else if (route === '/v1/mentor') boards.mentor = body;
      else if (route === '/v1/paper') boards.paper = body;
      if (objectiveStart == null && crew()?.objective) objectiveStart = number(crew().objective.mine);
    }

    function recordOperation(receipt, before, after, result) {
      if (!sync() || !result || number(result.code) < 200 || number(result.code) >= 300 || result.body?.error) return;
      operations += 1;
      if (number(after?.level) > number(before?.level)) queueMilestone(`Reached level ${fmt(after.level)}`);
      const oldTrades = tradesOf(before);
      for (const [id, trade] of tradesOf(after)) if (number(trade.lvl) > number(oldTrades.get(id)?.lvl)) queueMilestone(`${trade.name || id} reached ${trade.rank || `level ${fmt(trade.lvl)}`}`);
      const body = result.body || {};
      if (body.graduated === true) queueMilestone('Graduated from my mentorship');
      if (body.status === 'completed' && body.node?.status === 'completed') queueMilestone(`Closed a case: ${String(body.node.id || 'case').replace(/[_:-]+/g, ' ')}`);
      if (body.crew === 'objective_claimed') queueMilestone('Collected my cut from our completed crew objective');
      render();
    }

    function decorateFeed(line, { channel, ev, mine }) {
      line.dataset.uxWho = String(ev?.who || ev?.payload?.from || ev?.from || '');
      line.dataset.uxPersonal = String(!!mine || channel === 'gang' || channel === 'crew');
      const prefs = settings();
      const people = (boards.circle?.people || crew()?.members || []).map((p) => p.name);
      const personal = mine || channel === 'gang' || channel === 'crew' || people.includes(line.dataset.uxWho);
      line.classList.toggle('ux-feed-hidden', !line.classList.contains('urgent') && ((!personal && prefs.feedScope === 'circle') || (!mine && (prefs.mutedInterests || []).includes(groupOf(line.dataset.cat)))));
    }

    return { render, observe, recordOperation, decorateFeed, applyFeedPreferences, queueMilestone, reloadWorkspace: render };
  };
})();
