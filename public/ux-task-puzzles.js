(function () {
  'use strict';
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Only public constraints and a local draft live here. The server verifies and executes the job.
  window.createOmertaTaskPuzzles = function ({ read, action, issue, getActor, refresh, focusFallback }) {
    let active = null;
    const inflight = new Set();
    const key = v => `omerta_task_puzzle:${v.actor}:${v.puzzle.id}`;
    const stored = v => { try { return JSON.parse(localStorage.getItem(key(v)) || '{}'); } catch { return {}; } };
    const save = v => { try { localStorage.setItem(key(v), JSON.stringify({ draft: v.draft, attempt: v.attempt })); } catch { /* Play remains available without browser storage. */ } };
    const current = v => active === v && getActor() === v.actor && v.dialog.open;
    const query = v => '/v1/task-puzzles?' + new URLSearchParams(v.selector);
    const blank = p => p.kind === 'route' ? { path: [p.constraints.start] } : p.kind === 'matching' ? { pairs: [] } : {};
    function close(v) {
      if (active === v) active = null;
      v.dialog.close(); v.dialog.remove();
      const replacement = v.restoreSelector && document.querySelector(v.restoreSelector);
      const available = node => node?.isConnected && !node.disabled && node.getClientRects().length;
      if (available(v.trigger)) v.trigger.focus(); else if (available(replacement)) replacement.focus(); else focusFallback?.();
    }
    function message(v, text) {
      v.message = text;
      const status = v.dialog.querySelector('[role="status"]');
      if (status) status.textContent = text;
    }
    function controls(v) {
      const p = v.puzzle, c = p.constraints, d = v.draft;
      const label = (items, id) => items.find(n => n.id === id)?.label || id;
      if (p.kind === 'patrol') return `<p>Crossing: <b>${c.duration} minutes</b>. Finish by minute <b>${c.deadline}</b>.</p><p>Blocked patrol intervals (start included, end excluded): ${c.blocked.map(b => `${b.start} to ${b.end}`).join('; ')}.</p><fieldset><legend>Choose a start minute</legend><div class="task-puzzle-options">${p.controls.options.map(n => `<label class="task-puzzle-choice"><input type="radio" name="start" value="${n}"${d.start === n ? ' checked' : ''}>Minute ${n}</label>`).join('')}</div></fieldset>`;
      if (p.kind === 'route') {
        const path = Array.isArray(d.path) ? d.path : [c.start], last = path.at(-1);
        const cost = path.slice(1).reduce((total, to, i) => total + (c.edges.find(e => e.from === path[i] && e.to === to)?.cost || 0), 0);
        return `<p>Start: <b>${esc(label(c.nodes, c.start))}</b>. Finish: <b>${esc(label(c.nodes, c.end))}</b>. Budget: <b>${c.budget}</b>.</p><p>Required stops: ${c.required.map(id => esc(label(c.nodes, id))).join(', ')}.</p><details class="task-puzzle-map" open><summary>Directed connections and costs</summary><ul>${c.edges.map(e => `<li>${esc(label(c.nodes, e.from))} → ${esc(label(c.nodes, e.to))}: ${e.cost}</li>`).join('')}</ul></details><fieldset><legend>Your ordered route</legend><ol>${path.map(id => `<li>${esc(label(c.nodes, id))}</li>`).join('')}</ol><p role="note">Cost ${cost} of ${c.budget}. ${path.length} stops chosen.</p><div class="task-puzzle-options">${c.edges.filter(e => e.from === last && !path.includes(e.to)).map(e => `<button type="button" class="act" data-route-add="${esc(e.to)}">Add ${esc(label(c.nodes, e.to))} (${e.cost})</button>`).join('') || '<p>No further connections from this stop.</p>'}</div><div class="task-puzzle-options"><button type="button" class="act" data-route-undo${path.length < 2 ? ' disabled' : ''}>Undo last stop</button><button type="button" class="act" data-route-reset>Reset route</button></div></fieldset>`;
      }
      if (p.kind === 'matching') return `<fieldset><legend>Assign each parcel once</legend>${p.controls.leftIds.map(id => {
        const allowed = c.allowed.find(row => row.left === id).rights, value = d.pairs?.find(pair => pair.left === id)?.right;
        return `<label class="task-puzzle-match">${esc(label(c.left, id))}<span>Allowed: ${allowed.map(right => esc(label(c.right, right))).join(', ')}</span><select name="${esc(id)}" data-match="${esc(id)}"><option value="">Choose a parcel</option>${p.controls.rightIds.filter(right => allowed.includes(right)).map(right => `<option value="${esc(right)}"${right === value ? ' selected' : ''}>${esc(label(c.right, right))}</option>`).join('')}</select></label>`;
      }).join('')}<p>Every contact needs a different parcel. You can change any assignment.</p></fieldset>`;
      if (p.kind === 'evidence') return `<p>Exactly <b>${c.trueCount} statements</b> must be true.</p><ol>${c.statements.map(s => `<li>The carrier is ${s.op === 'not-in' ? '<b>not</b> ' : ''}one of: ${s.suspects.map(id => esc(label(c.suspects, id))).join(', ')}.</li>`).join('')}</ol><fieldset><legend>Who carried the envelope?</legend><div class="task-puzzle-options">${p.controls.options.map(o => `<label class="task-puzzle-choice"><input type="radio" name="suspect" value="${esc(o.id)}"${d.suspect === o.id ? ' checked' : ''}>${esc(o.label)}</label>`).join('')}</div></fieldset>`;
      return '<p>This puzzle version is unavailable. Keep this task and try again after the service is updated.</p>';
    }
    function paint(v, focus = '') {
      if (!current(v)) return;
      const p = v.puzzle, locked = v.pending || v.uncertain || v.done || v.stale;
      v.dialog.setAttribute('data-task-puzzle', p?.kind || 'loading');
      v.dialog.innerHTML = `<header><p class="task-puzzle-eyebrow">${esc(v.label)}</p><h2 id="task-puzzle-title">Task puzzle${p ? ': ' + esc(p.title) : ''}</h2><button type="button" class="act" data-close>Close puzzle</button></header><div role="status" aria-live="polite" aria-atomic="true" tabindex="-1">${esc(v.message || '')}</div>${p ? `<p>${esc(p.instructions)}</p><p class="task-puzzle-terms">${v.selector.scope === 'crime' ? 'Optional preparation gives feedback only, with no odds or reward bonus. Solving and submitting attempts the crime, spends its usual resources and can fail.' : 'Solving and submitting executes this job with its usual requirements, costs and rewards.'} Closing never executes a job. There is no timer or fast-reaction test.</p><form aria-busy="${!!v.pending}"><fieldset class="task-puzzle-edit"${locked ? ' disabled' : ''}>${controls(v)}${v.selector.scope === 'crime' ? `<label class="task-puzzle-match">Crime approach<select name="approach" data-approach>${v.approaches.map(a => `<option value="${esc(a.id)}"${a.id === v.body.approach ? ' selected' : ''}>${esc(a.name || a.id)}</option>`).join('')}</select></label>` : ''}<details class="task-puzzle-hint"${v.hint ? ' open' : ''}><summary>A hint, if you need it</summary><p>${esc(p.hint)}</p></details><div class="task-puzzle-actions"><button class="act prime" type="submit">${esc(v.submitLabel)}</button><button class="act" type="button" data-clear>Clear answer</button></div></fieldset></form>${v.uncertain ? '<button type="button" class="act prime" data-check>Check task status</button>' : ''}${v.retry ? '<button type="button" class="act" data-retry>Retry same submission</button>' : ''}${v.stale ? '<button type="button" class="act prime" data-reopen>Reopen current task</button>' : ''}` : '<button type="button" class="act" data-reopen>Retry opening puzzle</button>'}`;
      v.dialog.querySelector('[data-close]').onclick = () => close(v);
      v.dialog.querySelector('[data-reopen]')?.addEventListener('click', () => load(v));
      v.dialog.querySelector('[data-check]')?.addEventListener('click', () => check(v));
      v.dialog.querySelector('[data-retry]')?.addEventListener('click', () => submit(v, true));
      v.dialog.querySelector('form')?.addEventListener('submit', e => { e.preventDefault(); submit(v); });
      v.dialog.querySelector('[data-clear]')?.addEventListener('click', () => { v.draft = blank(p); save(v); paint(v, '[data-clear]'); });
      v.dialog.querySelector('.task-puzzle-hint')?.addEventListener('toggle', e => { v.hint = e.target.open; });
      v.dialog.querySelectorAll('input, select').forEach(input => input.addEventListener('change', () => {
        if (input.name === 'start') v.draft = { start: Number(input.value) };
        if (input.name === 'suspect') v.draft = { suspect: input.value };
        if (input.dataset.match) v.draft = { pairs: [...v.dialog.querySelectorAll('[data-match]')].filter(n => n.value).map(n => ({ left: n.dataset.match, right: n.value })) };
        if (input.name === 'approach') v.body.approach = input.value;
        save(v);
      }));
      v.dialog.querySelectorAll('[data-route-add], [data-route-undo], [data-route-reset]').forEach(button => button.addEventListener('click', () => {
        if (button.hasAttribute('data-route-add')) v.draft.path.push(button.dataset.routeAdd);
        if (button.hasAttribute('data-route-undo')) v.draft.path.pop();
        if (button.hasAttribute('data-route-reset')) v.draft = blank(p);
        save(v); paint(v, v.draft.path.length > 1 ? '[data-route-undo]' : '[data-route-reset]');
      }));
      if (focus) v.dialog.querySelector(focus)?.focus();
    }
    async function load(v) {
      if (!current(v) || v.pending) return;
      v.pending = true; v.puzzle = null; v.message = 'Opening the current task puzzle…'; paint(v);
      try {
        const result = await issue('POST', '/v1/task-puzzles', v.selector, { isCurrent: () => current(v) });
        if (!current(v)) return;
        if (result.code >= 400 || !result.body?.puzzle) throw new Error(result.body?.message || 'The puzzle could not be opened. Try again.');
        v.puzzle = result.body.puzzle;
        const local = stored(v); v.draft = local.draft || blank(v.puzzle); v.attempt = local.attempt || null;
        if (v.attempt?.body?.approach) v.body.approach = v.attempt.body.approach;
        v.done = v.puzzle.status === 'consumed'; v.stale = false; v.retry = false; v.uncertain = !!v.attempt && !v.done;
        v.message = v.done ? 'This task completion is already recorded. Review the current board.' : v.uncertain ? 'A submission was interrupted. Check task status before continuing. Nothing will be sent again automatically.' : 'Your issued challenge is saved. You can close and return to it.';
      } catch (error) { if (current(v)) v.message = error.message || 'The puzzle could not be opened. Try again.'; }
      finally { v.pending = false; if (current(v)) paint(v, '[data-close]'); }
    }
    async function check(v) {
      if (!current(v) || v.pending) return;
      v.pending = true; v.retry = false; message(v, 'Checking the server receipt. No job is being submitted.'); paint(v);
      try {
        const result = await read('GET', query(v));
        if (!current(v)) return;
        if (result.code >= 400) throw new Error('Status is unavailable. Check again when connected; no job was resent.');
        const p = result.body?.puzzle;
        if (p?.id === v.puzzle.id && p.status === 'consumed') {
          v.done = true; v.uncertain = false; v.attempt = null; save(v);
          v.message = 'Task completion recorded. The job will not be sent again.';
          await refresh();
        } else if (!p || p.id !== v.puzzle.id) {
          v.stale = true; v.uncertain = false; v.message = 'The task occurrence changed. Review your current board, then explicitly reopen the current task. No job was resent.';
        } else {
          v.retry = !!v.attempt && !inflight.has(v.puzzle.id);
          v.message = inflight.has(v.puzzle.id) ? 'The submission is still pending. Check status again shortly.' : 'No completion is recorded for this puzzle. Check again or retry the exact same submission with its original request key.';
        }
      } catch (error) { if (current(v)) v.message = error.message; }
      finally { v.pending = false; if (current(v)) paint(v, '[role="status"]'); }
    }
    async function submit(v, retry = false) {
      if (!current(v) || v.pending || v.done || v.stale || inflight.has(v.puzzle.id) || (v.uncertain && !retry)) return;
      const p = v.puzzle;
      if (!retry) v.attempt = { key: crypto.randomUUID(), body: { ...v.body, puzzle: { id: p.id, answer: v.draft } } };
      if (!v.attempt) return;
      // Persist BEFORE dispatch. Reload or a lost response can only read status or retry this exact key/body.
      save(v); v.pending = true; v.retry = false; inflight.add(p.id); v.message = 'Submitting the answer and executing the job…'; paint(v);
      try {
        const result = await action('POST', v.path, v.attempt.body, { idempotencyKey: v.attempt.key, isCurrent: () => getActor() === v.actor });
        if (result.code >= 500 || result.code === 499 || result.body?.error === 'idempotency_in_progress') {
          v.uncertain = true; v.message = 'The response was interrupted. The job may have completed. Check task status; do not submit another job.';
        } else if (result.code < 400) {
          v.done = true; v.uncertain = false; v.attempt = null; v.message = 'Task completion recorded. Review the result and your updated board.'; save(v);
        } else {
          v.attempt = null; v.uncertain = false; save(v);
          v.stale = ['stale_task_puzzle', 'task_puzzle_consumed', 'task_puzzle_context', 'done', 'hustle_step'].includes(result.body?.error);
          v.message = result.body?.message || 'The job could not proceed. Check its requirements and try again.';
        }
      } catch { v.uncertain = true; v.message = 'The response was interrupted. The job may have completed. Check task status before continuing.'; }
      finally { inflight.delete(p.id); v.pending = false; if (current(v)) paint(v, '[role="status"]'); }
    }
    return {
      open(options) {
        if (active) close(active);
        const dialog = document.createElement('dialog'); dialog.className = 'task-puzzle-dialog'; dialog.setAttribute('aria-labelledby', 'task-puzzle-title');
        const restoreSelector = options.selector.scope === 'mission' ? `[data-mission="${CSS.escape(options.selector.targetId)}"]`
          : options.selector.scope === 'hustle' ? '#hu-go' : `[data-task-crime="${CSS.escape(options.selector.targetId)}"]`;
        const v = { ...options, restoreSelector, dialog, actor: getActor(), body: { ...options.body }, draft: {}, message: '', pending: false, approaches: options.approaches || [] };
        active = v; document.body.append(dialog); dialog.showModal();
        dialog.addEventListener('cancel', e => { e.preventDefault(); close(v); });
        load(v);
      },
    };
  };
})();
