/* Account-synced presentation; the server still owns all game decisions and balances. */
(() => {
  const clone = value => value == null ? value : JSON.parse(JSON.stringify(value));
  const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);
  window.createOmertaWorkspace = ({ getState, read, write, notify, onHydrate }) => {
    let account = '', revision = 0, values = {}, dirty = {}, hydrated = false, syncing = false, timer = null, state = 'local', pending = null, epoch = 0, legacySeeds = new Set(), changesLog = [], changeSequence = 0;
    const listeners = new Set();
    const localKey = () => `omerta_workspace:${account}`;
    const oldKeys = () => ({ navigation: `omerta_ux_navigation:${account}`, navigationTour: `omerta_ux_navigation:${account}:tour`, progression: `omerta_progression_v1:${account}`, social: `omerta_ux_social_${account}` });
    const emit = () => { listeners.forEach(callback => { try { callback(); } catch {} }); };
    const persist = () => { try { localStorage.setItem(localKey(), JSON.stringify({ schema: 1, values, dirty, revision, history: changesLog })); } catch {} };
    function remember(key, label) {
      changesLog.push({ id: `${Date.now()}-${++changeSequence}`, namespace: key, label: String(label || `Edit ${key}`).slice(0, 100), at: new Date().toISOString(), before: clone(values[key] ?? null) });
      while (changesLog.length > 16 || JSON.stringify(changesLog).length > 500000) changesLog.shift();
    }
    const applyOld = (changes, replace = false) => {
      for (const [key, storage] of Object.entries(oldKeys())) try {
        if (Object.hasOwn(changes, key)) localStorage.setItem(storage, JSON.stringify(changes[key]));
        else if (replace) localStorage.removeItem(storage);
      } catch {}
    };
    function scope() {
      const next = String(getState().session?.accountId || '');
      if (next === account) return !!next;
      account = next; revision = 0; dirty = {}; values = {}; changesLog = []; hydrated = false; state = 'local'; syncing = false; pending = null; epoch++;
      clearTimeout(timer);
      legacySeeds = new Set();
      if (account) {
        try { const stored = JSON.parse(localStorage.getItem(localKey()) || '{}') || {}; values = stored.schema === 1 ? stored.values || {} : stored; dirty = stored.schema === 1 ? stored.dirty || {} : {}; revision = stored.schema === 1 ? Number(stored.revision || 0) : 0; changesLog = Array.isArray(stored.history) ? stored.history.filter(item => item && typeof item.namespace === 'string').slice(-16) : []; } catch {}
        for (const [key, storage] of Object.entries(oldKeys())) try { if (localStorage.getItem(storage)) legacySeeds.add(key); } catch {}
      }
      return !!account;
    }
    function capture(explicit = false) {
      if (!scope()) return;
      for (const [key, storage] of Object.entries(oldKeys())) {
        let value;
        try { const raw = localStorage.getItem(storage); if (!raw) continue; value = JSON.parse(raw); } catch { continue; }
        if (!hydrated && !explicit && !legacySeeds.has(key) && !Object.hasOwn(values, key)) continue;
        if (!same(value, values[key])) { if (explicit) remember(key); values[key] = value; dirty[key] = clone(value); }
      }
      persist(); if (Object.keys(dirty).length && state !== 'conflict') schedule();
    }
    function schedule() { clearTimeout(timer); state = 'pending'; timer = setTimeout(flush, 1200); emit(); }
    async function hydrate() {
      if (!scope() || hydrated || pending) return pending;
      const requested = account, requestedEpoch = epoch;
      pending = Promise.resolve(read('/v1/ux/workspace')).then(reply => {
        if (requested !== account || requestedEpoch !== epoch) return;
        if (reply.code !== 200) { state = 'offline'; emit(); return; }
        capture();
        const remote = reply.body.values || {};
        // Existing local customizations seed a new account workspace. Remote records win on a
        // new device, while edits made during the request are kept as pending local changes.
        const local = { ...values }, edits = { ...dirty };
        if (reply.body.revision > 0) {
          const conflicts = Object.keys(edits).some(key => Object.hasOwn(remote, key) && !same(remote[key], edits[key]));
          if (conflicts) {
            revision = Number(reply.body.revision); hydrated = true; state = 'conflict';
            pending = { remote: reply.body }; clearTimeout(timer); emit(); return;
          }
          const merged = { ...remote };
          for (const [key, value] of Object.entries(edits)) if (!Object.hasOwn(remote, key)) merged[key] = value;
          for (const [key, value] of Object.entries(local)) if (!Object.hasOwn(merged, key)) merged[key] = value;
          values = merged;
          dirty = Object.fromEntries(Object.entries(edits).filter(([key]) => !Object.hasOwn(remote, key)));
        } else { values = local; dirty = { ...values, ...edits }; }
        revision = Number(reply.body.revision || 0); hydrated = true;
        applyOld(values); persist(); state = Object.keys(dirty).length ? 'pending' : 'saved';
        onHydrate?.(); emit(); if (Object.keys(dirty).length) schedule();
      }).catch(() => { if (requested === account && requestedEpoch === epoch) { state = 'offline'; emit(); } }).finally(() => { if (requested === account && requestedEpoch === epoch && state !== 'conflict') pending = null; });
      return pending;
    }
    async function flush() {
      if (!scope() || syncing || state === 'conflict') return;
      if (!hydrated) { await hydrate(); if (!hydrated || state === 'conflict') return; }
      capture(); clearTimeout(timer);
      const changes = clone(dirty); if (!Object.keys(changes).length) { state = 'saved'; emit(); return; }
      const requested = account, requestedEpoch = epoch; syncing = true; state = 'syncing'; emit();
      try {
        const reply = await write('/v1/ux/workspace', { revision, changes });
        if (requested !== account || requestedEpoch !== epoch) return;
        if (reply.code === 409) {
          // Namespace-level conflict requires a choice. Never silently overwrite another device.
          state = 'conflict'; pending = { remote: reply.body }; emit(); return;
        }
        if (reply.code !== 200) { state = 'offline'; emit(); return; }
        revision = Number(reply.body.revision);
        for (const [key, value] of Object.entries(changes)) if (same(dirty[key], value)) delete dirty[key];
        state = Object.keys(dirty).length ? 'pending' : 'saved'; persist(); emit();
      } catch { if (requested === account && requestedEpoch === epoch) { state = 'offline'; emit(); } }
      finally { if (requested === account && requestedEpoch === epoch) { syncing = false; if (state === 'pending') schedule(); } }
    }
    function resolveConflict(useLocal) {
      const remote = pending?.remote;
      if (!remote || !remote.values) { hydrated = false; pending = null; return hydrate(); }
      revision = Number(remote.revision || 0);
      if (useLocal) values = { ...remote.values, ...dirty };
      else { values = { ...remote.values }; dirty = {}; changesLog = []; }
      applyOld(values, true); onHydrate?.();
      pending = null; state = useLocal ? 'pending' : 'saved'; persist(); emit(); if (useLocal) schedule();
    }
    const service = {
      get(key, fallback) { scope(); return clone(Object.hasOwn(values, key) ? values[key] : fallback); },
      set(key, value, options = {}) { if (!scope() || same(values[key], value) || (options.passive && !hydrated && Object.hasOwn(dirty, key))) return; if (!options.passive) remember(key, options.label); values[key] = clone(value); if (!options.passive || hydrated) dirty[key] = clone(value); persist(); if (!Object.keys(dirty).length) return; if (state === 'conflict') emit(); else schedule(); },
      history(namespace) { scope(); return changesLog.filter(item => !namespace || item.namespace === namespace).map(({ before, ...item }) => clone(item)).reverse(); },
      undo(id) {
        if (!scope()) return false;
        const entry = id ? changesLog.find(item => item.id === id) : changesLog.at(-1); if (!entry) return false;
        const previous = clone(values[entry.namespace] ?? null);
        values[entry.namespace] = clone(entry.before); dirty[entry.namespace] = clone(entry.before);
        const index = changesLog.indexOf(entry);
        changesLog = changesLog.filter((item, i) => i < index || item.namespace !== entry.namespace);
        changesLog.push({ id: `${Date.now()}-${++changeSequence}`, namespace: entry.namespace, label: `Restore the state before undoing ${entry.namespace}`, at: new Date().toISOString(), before: previous });
        while (changesLog.length > 16 || JSON.stringify(changesLog).length > 500000) changesLog.shift();
        applyOld(values); persist(); onHydrate?.(); if (state === 'conflict') emit(); else schedule();
        document.dispatchEvent(new CustomEvent('omerta:workspace-undo', { detail: { namespace: entry.namespace } })); return true;
      },
      subscribe(callback) { listeners.add(callback); return () => listeners.delete(callback); },
      status() { return { account, state, revision }; }, hydrate, flush, resolveConflict,
      render() { if (scope()) { capture(); hydrate(); } },
      observe(path) { if (path === '/v1/session') queueMicrotask(() => { scope(); hydrate(); }); },
    };
    for (const name of ['change', 'click']) document.addEventListener(name, () => queueMicrotask(() => capture(true)));
    window.addEventListener('online', () => { if (state !== 'conflict') { hydrated = false; pending = null; hydrate(); } });
    return service;
  };
})();
