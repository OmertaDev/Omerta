(() => {
  'use strict';
  const key = 'omerta_site_analytics';
  const pages = new Set(['/', '/wiki', '/arena', '/play', '/sale', '/path', '/defi', '/fee-flows', '/guides/getting-started', '/privacy', '/terms', '/dmca', '/resources',
    ...['gun', 'ledger', 'kitchen', 'wheel', 'shadow', 'ring'].map(id => `/path/${id}`)]);
  const targets = new Set(['/', '/wiki', '/arena', '/play', '/sale', '/path', '/agents', '/defi', '/fee-flows', '/guides/getting-started']);
  const page = location.pathname;
  if (!pages.has(page)) return;
  const blocked = () => navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  let preference;
  try { preference = localStorage.getItem(key); } catch { /* storage access is optional */ }
  let viewed = false;
  const send = (event, target) => {
    if (blocked() || preference !== 'accepted') return false;
    fetch('/site-analytics/event', { method: 'POST', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ consent: true, page, event, ...(target ? { target } : {}) }) }).catch(() => {});
    return true;
  };
  const successful = result => Number.isInteger(result?.code) && result.code >= 200 && result.code < 300
    && result.ignored !== true && result.replayed !== true && result.body?.replayed !== true;
  // Call only with a confirmed, current game response. No response fields enter analytics.
  window.OmertaSiteAnalytics = Object.freeze({
    signupResult(result) {
      return page === '/' && successful(result) && typeof result.body?.token === 'string' && result.body.token.length > 0
        ? send('completion', 'signup_success') : false;
    },
    firstJobResult(method, path, result) {
      // This account-level reward is claimable once, after a successful street job. It survives death.
      return page === '/' && method === 'POST' && path === '/v1/onboard/ob_crime/claim' && successful(result) && result.body?.ok === true && result.body.task === 'ob_crime'
        ? send('completion', 'first_job_completed') : false;
    },
  });
  const view = () => {
    if (viewed || blocked() || preference !== 'accepted') return;
    viewed = true;
    send('pageview');
  };
  const controls = document.createElement('details');
  controls.id = 'site-analytics-choices';
  controls.innerHTML = '<summary>Analytics choices</summary><div><p>Help improve OMERTÀ with optional counts of page views, public link clicks and confirmed onboarding milestones. No tracking cookies, account details or visitor identifiers.</p><p><a href="/privacy">Privacy policy</a></p><p class="site-analytics-actions"><button type="button" data-choice="accepted">Allow counts</button><button type="button" data-choice="declined">Decline</button></p><p role="status" class="site-analytics-status"></p></div>';
  const style = document.createElement('style');
  style.textContent = '#site-analytics-choices{position:relative;margin:12px;width:max-content;max-width:min(340px,calc(100vw - 24px));font:13px/1.5 system-ui,sans-serif;color:#e6dfd2;background:#141214;border:1px solid #695c44;border-radius:6px;box-shadow:0 4px 16px #0005}#site-analytics-choices summary{cursor:pointer;padding:8px 12px;font-size:12px}#site-analytics-choices>div{padding:0 12px 10px}#site-analytics-choices p{margin:8px 0}#site-analytics-choices a{color:#e0bd72}#site-analytics-choices .site-analytics-actions{display:flex;gap:8px}#site-analytics-choices button{flex:1;min-height:44px;cursor:pointer;border:1px solid #86734e;border-radius:4px;background:#242024;color:#eee7dc;font:inherit;padding:8px}#site-analytics-choices button:focus-visible,#site-analytics-choices summary:focus-visible{outline:2px solid #e0bd72;outline-offset:2px}#site-analytics-choices button:disabled{opacity:.65;cursor:default}';
  document.head.append(style);
  (document.querySelector('.lfoot') || document.querySelector('footer') || document.body).append(controls);
  const update = () => {
    controls.querySelector('.site-analytics-status').textContent = blocked() ? 'Your browser privacy signal has disabled optional counts.'
      : preference === 'accepted' ? 'Optional counts are on. You can decline at any time.' : 'Optional counts are off.';
    controls.querySelector('[data-choice="accepted"]').disabled = blocked();
  };
  controls.addEventListener('click', event => {
    const button = event.target.closest('button[data-choice]');
    if (!button) return;
    preference = button.dataset.choice;
    try { localStorage.setItem(key, preference); } catch { /* choice remains effective for this page */ }
    update();
    view();
  });
  document.addEventListener('click', event => {
    if (event.target.closest('#btn-guest, #btn-guest2')) {
      send('cta', 'guest_start');
      return;
    }
    const link = event.target.closest('a[href]');
    if (!link || controls.contains(link)) return;
    let url;
    try { url = new URL(link.href, location.origin); } catch { return; }
    if (url.origin === location.origin && targets.has(url.pathname)) send('cta', url.pathname);
  });
  window.addEventListener('storage', event => {
    if (event.key !== key) return;
    preference = event.newValue;
    update();
    view();
  });
  update();
  view();
})();
