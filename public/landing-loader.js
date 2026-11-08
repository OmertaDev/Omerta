export function landingLoader() {
  'use strict';
  /* OMERTA_LANDING_CONFIG */
  /* OMERTA_LANDING_LANGUAGES */
  /* OMERTA_LANDING_SCENES */
  const $ = selector => document.querySelector(selector);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const entries = '#btn-guest, #btn-guest2, #btn-xoauth, #btn-provider, #btn-wallet-onboard';
  const status = $('#guest-status');
  const pendingAssets = new Map();
  let loading = null, ready = false, partial = false, lastTarget = null, unmount = () => {};
  const announce = text => { status.hidden = !text; status.textContent = text; };
  const setBusy = on => document.querySelectorAll(entries).forEach(button => {
    button.disabled = on;
    if (on) button.setAttribute('aria-busy', 'true'); else button.removeAttribute('aria-busy');
  });
  function asset(url, stylesheet = false) {
    if (pendingAssets.has(url)) return pendingAssets.get(url);
    const promise = new Promise((resolve, reject) => {
      const node = document.createElement(stylesheet ? 'link' : 'script');
      let settled = false;
      const finish = error => {
        if (settled) return;
        settled = true; clearTimeout(timeout); node.onload = node.onerror = null;
        if (error) { node.remove(); pendingAssets.delete(url); reject(error); } else resolve();
      };
      const timeout = setTimeout(() => finish(new Error('An optional interface asset did not respond.')), 8000);
      if (stylesheet) { node.rel = 'stylesheet'; node.href = url; }
      else { node.async = false; node.src = url; }
      node.onload = () => finish();
      node.onerror = () => finish(new Error('An optional interface asset could not load.'));
      document.head.append(node);
    });
    pendingAssets.set(url, promise);
    return promise;
  }
  function mountLanding() {
    const events = new AbortController(), cleanup = [];
    const listen = (node, type, handler) => node?.addEventListener(type, handler, { signal: events.signal });
    const menu = $('#screen-auth .public-nav__menu');
    listen(menu, 'click', event => { if (event.target.closest('a')) menu.open = false; });
    listen(menu, 'keydown', event => {
      if (event.key !== 'Escape' || !menu.open) return;
      event.preventDefault(); menu.open = false; menu.querySelector('summary').focus();
    });
    let lang = 'en';
    try { const saved = localStorage.getItem('omerta_lang'); if (I18N[saved]) lang = saved; } catch { /* storage is optional */ }
    document.documentElement.lang = lang;
    document.documentElement.dir = I18N[lang]?.rtl ? 'rtl' : 'ltr';
    for (const node of document.querySelectorAll('#screen-auth [data-i18n]'))
      node.textContent = I18N[lang][node.dataset.i18n] || I18N.en[node.dataset.i18n] || node.textContent;
    const picker = document.createElement('span'); picker.id = 'landing-language-controls';
    const label = document.createElement('label'); label.className = 'visually-hidden'; label.htmlFor = 'landing-language';
    label.textContent = 'Language — menus only (the game text stays English)';
    const select = document.createElement('select'); select.id = 'landing-language'; select.className = 'langpick'; select.title = label.textContent;
    for (const [key, value] of Object.entries(I18N)) {
      const option = document.createElement('option'); option.value = key;
      option.textContent = value.name + (key === 'en' ? '' : ' (menus)'); option.selected = key === lang; select.append(option);
    }
    listen(select, 'change', () => { try { localStorage.setItem('omerta_lang', select.value); location.reload(); } catch { /* preferences cannot persist */ } });
    picker.append(label, select); $('#screen-auth .lfoot')?.append(picker); cleanup.push(() => picker.remove());
    const reveal = node => {
      if (node.dataset.art) node.style.setProperty('--art', `url(${node.dataset.art})`);
      if (node.parentElement?.tagName === 'PICTURE') for (const source of node.parentElement.querySelectorAll('source[data-srcset]')) source.srcset = source.dataset.srcset;
      if (node.dataset.lazySrc) node.src = node.dataset.lazySrc;
      if (node.dataset.videoPoster) {
        node.poster = matchMedia('(max-width: 760px)').matches ? (node.dataset.videoPosterMobile || node.dataset.videoPoster) : node.dataset.videoPoster;
        for (const source of node.querySelectorAll('source[data-src]')) source.src = source.dataset.src;
      }
      node.dataset.artLoaded = 'true';
    };
    const plates = [...document.querySelectorAll('#screen-auth [data-art], #screen-auth [data-lazy-src], #screen-auth [data-video-poster]')].filter(node => !node.dataset.artLoaded);
    if ('IntersectionObserver' in window) {
      const observer = new IntersectionObserver(entries => entries.filter(entry => entry.isIntersecting).forEach(entry => { reveal(entry.target); observer.unobserve(entry.target); }), { rootMargin: '80px 0px' });
      plates.forEach(node => observer.observe(node)); cleanup.push(() => observer.disconnect());
    } else plates.forEach(reveal);
    const line = $('#wire-line'), toggle = $('#wire-toggle');
    let scene = Math.floor(Date.now() / 1000) % scenes.length, paused = false;
    const advance = () => { if (line) line.textContent = scenes[scene++ % scenes.length]; };
    advance();
    if (reduced.matches) {
      toggle.textContent = 'next'; toggle.setAttribute('aria-label', 'Show next city scene'); listen(toggle, 'click', advance);
    } else {
      const timer = setInterval(() => { if (!paused) advance(); }, 4200); cleanup.push(() => clearInterval(timer));
      listen(toggle, 'click', () => { paused = !paused; toggle.textContent = paused ? 'resume' : 'pause'; toggle.setAttribute('aria-pressed', String(paused)); toggle.setAttribute('aria-label', paused ? 'Resume city scenes' : 'Pause city scenes'); });
    }
    const hero = $('#screen-auth .hero'), motion = $('#hero-motion'); let video;
    const pause = () => { video?.pause(); if (motion) { motion.textContent = 'Animate scene'; motion.setAttribute('aria-pressed', 'false'); } };
    if (hero && motion && !reduced.matches && !navigator.connection?.saveData && matchMedia('(min-width: 960px)').matches) {
      motion.classList.remove('hidden');
      motion.textContent = 'Animate scene'; motion.setAttribute('aria-pressed', 'false');
      listen(motion, 'click', async () => {
        if (video && !video.paused) { pause(); return; }
        if (!video) {
          video = document.createElement('video'); video.className = 'herovid'; video.src = '/art/hero-ambient-v2.mp4';
          video.muted = true; video.loop = true; video.playsInline = true; video.preload = 'none'; video.setAttribute('aria-hidden', 'true'); video.tabIndex = -1; hero.prepend(video);
        }
        motion.disabled = true; motion.setAttribute('aria-busy', 'true'); motion.textContent = 'Loading scene…';
        try { await video.play(); video.classList.add('live'); motion.textContent = 'Pause scene'; motion.setAttribute('aria-pressed', 'true'); }
        catch { video.remove(); video = null; motion.textContent = 'Scene unavailable'; }
        finally { motion.disabled = false; motion.removeAttribute('aria-busy'); }
      });
      listen(document, 'visibilitychange', () => { if (document.hidden) pause(); });
      listen(reduced, 'change', () => { if (reduced.matches) { pause(); motion.classList.add('hidden'); } });
      const observer = new IntersectionObserver(([entry]) => { if (!entry.isIntersecting) pause(); }); observer.observe(hero);
      cleanup.push(() => { observer.disconnect(); video?.pause(); video?.remove(); });
    }
    return () => { events.abort(); cleanup.forEach(fn => fn()); };
  }
  function failed(error) {
    if (partial) {
      ['#screen-main', '#screen-create', '#screen-down'].forEach(selector => $(selector)?.classList.add('hidden'));
      $('#screen-auth').classList.remove('hidden');
    }
    announce(partial ? 'The city could not start. Reload the page to try again.' : 'The city could not load. Check your connection, then try again.');
    let retry = $('#city-load-retry');
    if (!retry) { retry = document.createElement('button'); retry.id = 'city-load-retry'; retry.className = 'act'; retry.type = 'button'; status.after(retry); }
    retry.textContent = partial ? 'Reload the page' : 'Try loading again';
    retry.onclick = () => partial ? location.reload() : openCity(lastTarget);
    console.warn('City client unavailable', error.message);
  }
  async function openCity(target) {
    if (loading) return loading;
    if (ready) { target?.click(); return; }
    lastTarget = target;
    $('#city-load-retry')?.remove(); setBusy(true); announce('Loading the city…');
    loading = (async () => {
      const [, response] = await Promise.all([
        Promise.allSettled([...CONFIG.styles.map(url => asset(url, true)), ...CONFIG.scripts.map(url => asset(url))]),
        fetch(CONFIG.runtime, { credentials: 'omit', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) }),
      ]);
      if (!response.ok) {
        if (response.status === 409) partial = true;
        throw new Error('The city program could not be loaded.');
      }
      const program = await response.text();
      unmount();
      partial = true;
      const script = document.createElement('script'); script.textContent = program; document.body.append(script);
      if (window.OmertaGameReady !== true) { partial = true; throw new Error('The game did not complete initialization.'); }
      await window.OmertaGameBoot;
      ready = true; document.removeEventListener('click', enter, true); setBusy(false); announce('');
      target?.click();
    })().catch(error => { setBusy(false); if (!partial) { unmount(); unmount = mountLanding(); } failed(error); })
      .finally(() => { loading = null; });
    return loading;
  }
  function enter(event) {
    const target = event.target.closest(entries); if (!target || ready) return;
    event.preventDefault(); event.stopImmediatePropagation();
    if (loading) return;
    if (partial) { location.reload(); return; }
    void openCity(target);
  }
  unmount = mountLanding(); document.addEventListener('click', enter, true);
  let restore = false;
  try { restore = !!localStorage.getItem('omerta_token'); } catch { /* public landing still works */ }
  const fragment = new URLSearchParams(location.hash.slice(1));
  restore ||= ['token', 'claimed', 'autherr'].some(key => fragment.has(key));
  window.OmertaLandingReady = true;
  if (restore) void openCity(null);
  else fetch('/site-entry.json', { credentials: 'omit', referrerPolicy: 'no-referrer' }).then(response => response.ok ? response.json() : null)
    .then(config => { if (config?.xOAuth === true) $('#xoauth-row')?.classList.remove('hidden'); }).catch(() => {});
}
