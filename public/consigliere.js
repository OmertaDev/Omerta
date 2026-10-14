(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const token = localStorage.getItem('omerta_token');
  let preparation = null;
  let loading = false;
  const friendlyScope = name => name.replace(/^omerta\./, '').split('.').join(' · ');
  function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  function status(message, error = false) {
    $('status').textContent = message;
    $('status').dataset.error = String(error);
  }
  async function api(path, { method = 'GET', body } = {}) {
    const response = await fetch(`/v1/gateway${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const data = await response.json();
    if (!response.ok) {
      if (response.status === 401) {
        $('workspace').hidden = true;
        $('signed-out').hidden = false;
      }
      throw new Error(data.message || data.error || 'The request failed. Try again.');
    }
    return data;
  }
  function showConnections(connections) {
    const target = $('connections');
    target.replaceChildren();
    if (!connections.length) { target.append(element('p', 'No advisers have access yet.', 'muted')); return; }
    for (const connection of connections) {
      const entry = element('article', undefined, 'connection');
      const heading = element('div', undefined, 'row');
      heading.append(element('h3', connection.label || connection.provider));
      const revoked = !!connection.revokedAt || connection.state === 'revoked';
      const expired = connection.expiresAt && new Date(connection.expiresAt).getTime() <= Date.now();
      if (revoked || expired) heading.append(element('span', revoked ? 'Revoked' : 'Expired', 'meta'));
      else {
        const revoke = element('button', 'Revoke access', 'secondary');
        revoke.type = 'button';
        revoke.addEventListener('click', async () => {
          revoke.disabled = true;
          try {
            await api(`/connections/${encodeURIComponent(connection.id)}`, { method: 'DELETE' });
            clearToken();
            await refresh();
            status('Connection revoked. The adviser no longer has access.');
          } catch (error) { status(error.message, true); revoke.disabled = false; }
        });
        heading.append(revoke);
      }
      entry.append(heading);
      if (connection.expiresAt) entry.append(element('p', `Expires ${new Date(connection.expiresAt).toLocaleString()}`, 'meta'));
      const scopes = element('ul', undefined, 'scope-list');
      for (const scope of connection.scopes || []) scopes.append(element('li', friendlyScope(scope)));
      entry.append(scopes);
      target.append(entry);
    }
  }
  function showActivity(activity) {
    const target = $('activity');
    target.replaceChildren();
    if (!activity.length) { target.append(element('p', 'Your adviser’s requests and results will appear here.', 'muted')); return; }
    for (const item of activity.slice(0, 25)) {
      const entry = element('article', undefined, 'activity-entry');
      entry.append(element('h3', (item.capability || 'Agent request').replaceAll('_', ' ')));
      entry.append(element('p', `${item.provider || 'Agent'} · ${item.result || item.status || item.outcome || 'Recorded'}`, 'hint'));
      const date = item.timestamp || item.createdAt;
      if (date) { const time = element('time', new Date(date).toLocaleString()); time.dateTime = date; entry.append(time); }
      target.append(entry);
    }
  }
  function showScopes(data) {
    const defaults = new Set(data.defaultScopes || []);
    for (const entry of data.scopes || []) {
      const name = typeof entry === 'string' ? entry : entry.name;
      if (typeof name !== 'string' || name === 'omerta.actions.commit') continue;
      const prepare = name.endsWith('.prepare');
      if (!prepare && !name.endsWith('.read')) continue;
      const label = element('label', undefined, 'scope');
      const input = document.createElement('input');
      input.type = 'checkbox'; input.name = 'scope'; input.value = name;
      input.checked = !prepare && defaults.has(name);
      label.append(input, element('span', entry.label || entry.description || friendlyScope(name)));
      $(prepare ? 'prepare-scopes' : 'read-scopes').append(label);
    }
  }
  async function refresh() {
    if (loading) return;
    loading = true; $('refresh').disabled = true;
    try {
      const [connections, activity] = await Promise.all([api('/connections'), api('/activity')]);
      showConnections(connections.connections || []);
      showActivity(activity.activity || []);
    } finally { loading = false; $('refresh').disabled = false; }
  }
  async function loadPreparation(id) {
    preparation = await api(`/preparations/${encodeURIComponent(id)}`);
    $('approval-section').hidden = false;
    const target = $('approval-details');
    target.replaceChildren(element('h3', preparation.capability.replaceAll('_', ' ')));
    target.append(element('p', typeof preparation.summary === 'string' ? preparation.summary : JSON.stringify(preparation.summary)));
    const meta = element('p', `Expires ${new Date(preparation.expiresAt).toLocaleString()} · ${preparation.state}`, 'meta');
    meta.id = 'approval-state';
    target.append(meta);
    $('approval-arguments').textContent = JSON.stringify(preparation.arguments, null, 2);
    $('approve').textContent = preparation.state === 'executing' ? 'Check action result' : 'Approve this action';
    $('approve').disabled = !['pending', 'executing'].includes(preparation.state)
      || (preparation.state === 'pending' && new Date(preparation.expiresAt).getTime() <= Date.now());
    if (preparation.result) showReceipt(preparation);
  }
  function showReceipt(result) {
    const retryPending = result.state === 'pending' && new Date(result.expiresAt).getTime() > Date.now();
    $('approval-result').textContent = result.state === 'completed' ? 'Action completed. Review the receipt below.'
      : result.state === 'refused' ? 'The game refused the last attempt. Check the result before proposing another action.'
        : retryPending ? 'Completion has not been confirmed. Retrying may carry out the action you approved.'
          : result.state === 'pending' ? 'Completion has not been confirmed. Check the result before proposing another action.'
          : 'The result is not final. Check it before proposing another action.';
    $('approval-arguments').textContent = JSON.stringify(result, null, 2);
    $('approval-state').textContent = `Proposal ${result.state}`;
    $('approval-kind').textContent = 'Action receipt';
    $('approval-heading').textContent = result.state === 'completed' ? 'Your action is complete' : 'Review the action result';
    $('approval-payload-label').textContent = 'Action receipt';
    $('approval-payload').open = true;
    $('approve').hidden = result.state === 'completed';
    if (result.state !== 'completed' && result.result) {
      preparation = result;
      $('approve').textContent = retryPending ? 'Retry approved action' : 'Check action result';
      $('approve').disabled = false;
    }
  }
  function clearToken() { $('token-value').value = ''; $('token-value').type = 'password'; $('token-result').hidden = true; }
  $('connection-form').addEventListener('submit', async event => {
    event.preventDefault();
    const scopes = Array.from(document.querySelectorAll('input[name="scope"]:checked'), input => input.value);
    if (!scopes.length) { status('Select the information your adviser may access.', true); return; }
    $('create-connection').disabled = true;
    clearToken();
    try {
      const result = await api('/connections', { method: 'POST', body: {
        provider: 'muse', label: $('connection-label').value.trim(), scopes, expiresInSeconds: 604800,
      } });
      $('token-value').value = result.token;
      $('token-result').hidden = false;
      await refresh();
      status('Access token created. Save it before leaving this page.');
    } catch (error) { status(error.message, true); }
    finally { $('create-connection').disabled = false; }
  });
  $('copy-token').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('token-value').value); status('Connection token copied.'); }
    catch { status('Clipboard is unavailable. Select and copy the token from the field.', true); $('token-value').type = 'text'; $('token-value').select(); }
  });
  $('clear-token').addEventListener('click', clearToken);
  $('refresh').addEventListener('click', () => refresh().then(() => status('Connections and activity updated.')).catch(error => status(error.message, true)));
  $('approve').addEventListener('click', async () => {
    if (!preparation) return;
    $('approve').disabled = true;
    try {
      const result = await api(`/preparations/${encodeURIComponent(preparation.id)}/confirm`, {
        method: 'POST', body: { nonce: preparation.nonce, digest: preparation.digest },
      });
      showReceipt(result);
      await refresh();
    } catch (error) {
      $('approval-result').textContent = error.message;
      // Fetch the current proposal before another attempt; never reuse an uncertain confirmation blindly.
      await loadPreparation(preparation.id).catch(() => {});
    }
  });
  addEventListener('pagehide', clearToken);
  if (!token) { $('signed-out').hidden = false; status(''); return; }
  (async () => {
    try {
      showScopes(await api('/scopes'));
      await refresh();
      $('workspace').hidden = false;
      status('Connections and activity loaded.');
      const id = new URLSearchParams(location.search).get('preparation');
      if (id) await loadPreparation(id);
    } catch (error) { status(error.message, true); }
  })();
})();
