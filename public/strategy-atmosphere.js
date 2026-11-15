/* Original city artwork. Ambient video plays only after an explicit request. */
(function () {
  'use strict';
  const districtIds = ['foundry', 'cathedral', 'neon', 'brick', 'canal', 'docks'];
  const scenes = [...districtIds.map(id => ({ id, file: `district-${id}` })), { id: 'city-atlas', file: 'city-atlas', name: 'The city atlas' }, { id: 'council-chamber', file: 'council-chamber', name: 'The council chamber' }];
  const base = '/art/grand-strategy/';

  window.createOmertaStrategyAtmosphere = function ({ getState }) {
    let dialog = null, mounted = null, selected = '', opener = null, destroyed = false;
    let playing = false, playEpoch = 0, atmosphere = 'ambient', library = null, libraryRequest = null;
    const state = () => getState() || {};
    const nameFor = scene => scene.name || state().rules?.districts?.find(district => district.id === scene.id)?.name || scene.id.charAt(0).toUpperCase() + scene.id.slice(1);
    const currentScene = () => scenes.find(scene => scene.id === selected) || scenes[0];
    const availableMotion = scene => library ? library.get(scene.id)?.motion || [] : [{ id: 'ambient', label: 'Ambient', src: `${base}${scene.file}.mp4` }];
    const localAsset = (value, extension) => typeof value === 'string' && value.startsWith(base) && !value.includes('..') && !value.includes('?') && !value.includes('#') && value.endsWith(extension);

    function paintAtmospheres() {
      if (!dialog) return;
      const options = availableMotion(currentScene()), select = dialog.querySelector('[data-strategy-atmosphere]');
      if (!options.some(option => option.id === atmosphere)) atmosphere = options.find(option => option.id === 'ambient')?.id || options[0]?.id || '';
      select.replaceChildren();
      for (const option of options) {
        const element = document.createElement('option'); element.value = option.id; element.textContent = option.label; select.append(element);
      }
      select.value = atmosphere; select.disabled = options.length < 2;
      dialog.querySelector('[data-strategy-ambient]').disabled = options.length === 0;
      if (!options.length) dialog.querySelector('[data-strategy-art-status]').textContent = 'This illustration has no ambience.';
    }

    function loadLibrary() {
      if (libraryRequest) return libraryRequest;
      libraryRequest = fetch(`${base}scene-library.json`, { credentials: 'same-origin', signal: AbortSignal.timeout(8000) }).then(async response => {
        if (!response.ok || Number(response.headers.get('content-length')) > 65536) throw new Error('Scene library unavailable');
        const content = await response.text();
        if (content.length > 65536) throw new Error('Scene library too large');
        const value = JSON.parse(content);
        if (!Array.isArray(value.scenes) || value.scenes.length > 8) throw new Error('Invalid scene library');
        const records = new Map();
        for (const entry of value.scenes) {
          if (!scenes.some(scene => scene.id === entry.id) || !Array.isArray(entry.motion) || entry.motion.length > 16) continue;
          const motion = entry.motion.filter(option => typeof option.id === 'string' && /^[a-z0-9-]{1,32}$/.test(option.id) && typeof option.label === 'string' && option.label.length <= 50 && localAsset(option.src, '.mp4'));
          records.set(entry.id, { image: localAsset(entry.image, '.webp') ? entry.image : null, motion });
        }
        library = records;
        if (!destroyed && dialog?.open) {
          stop();
          const scene = currentScene(), source = library.get(scene.id)?.image;
          if (source) dialog.querySelector('.strategy-art-image').src = source;
          dialog.querySelector('[data-strategy-art-status]').textContent = '';
          paintAtmospheres();
        }
      }).catch(() => { /* The original ambient clip remains available when the optional library cannot load. */ });
      return libraryRequest;
    }

    function stop() {
      playing = false; playEpoch++;
      if (!dialog) return;
      const video = dialog.querySelector('video');
      video.pause(); video.hidden = true;
      video.removeAttribute('src'); video.load();
      const button = dialog.querySelector('[data-strategy-ambient]');
      button.textContent = 'Play ambience'; button.setAttribute('aria-pressed', 'false');
    }

    async function toggleMotion() {
      if (playing) { stop(); return; }
      const scene = currentScene(), video = dialog.querySelector('video');
      const motion = availableMotion(scene).find(option => option.id === atmosphere);
      if (!motion) return;
      const request = ++playEpoch;
      playing = true;
      video.src = motion.src; video.hidden = false;
      const button = dialog.querySelector('[data-strategy-ambient]');
      button.textContent = 'Stop ambience'; button.setAttribute('aria-pressed', 'true');
      dialog.querySelector('[data-strategy-art-status]').textContent = 'Loading ambience…';
      try {
        await video.play();
        if (request === playEpoch) dialog.querySelector('[data-strategy-art-status]').textContent = 'Muted ambience playing';
      } catch {
        if (request !== playEpoch) return;
        stop(); dialog.querySelector('[data-strategy-art-status]').textContent = 'Ambience is unavailable. The illustration is still available.';
      }
    }

    function selectScene(id) {
      if (!scenes.some(scene => scene.id === id)) return;
      stop(); selected = id;
      const scene = currentScene(), title = nameFor(scene), image = dialog.querySelector('.strategy-art-image');
      dialog.querySelector('h2').textContent = title;
      dialog.querySelector('.strategy-art-caption').textContent = districtIds.includes(id) ? 'District illustration · Explore the character of the city.' : 'City illustration · Original Omerta environment artwork.';
      image.alt = `${title} — an illustrated view of Omerta`;
      image.src = library?.get(scene.id)?.image || `${base}${scene.file}.webp`;
      dialog.querySelector('[data-strategy-art-status]').textContent = '';
      paintAtmospheres();
      for (const button of dialog.querySelectorAll('[data-strategy-scene]')) button.setAttribute('aria-pressed', String(button.dataset.strategyScene === id));
    }

    function createDialog() {
      const root = document.createElement('dialog'); root.className = 'strategy-art-dialog';
      root.setAttribute('aria-labelledby', 'strategy-art-title');
      root.innerHTML = '<header class="strategy-art-heading"><div><p class="strategy-art-eyebrow">OMERTA · THE CITY</p><h2 id="strategy-art-title"></h2></div><button type="button" class="strategy-art-close" aria-label="Close district view">×</button></header><div class="strategy-art-stage"><img class="strategy-art-image" alt=""><video muted loop playsinline preload="none" hidden aria-label="District ambience"></video></div><footer class="strategy-art-footer"><p class="strategy-art-caption"></p><label class="strategy-art-atmosphere">Atmosphere<select data-strategy-atmosphere></select></label><button type="button" data-strategy-ambient aria-pressed="false">Play ambience</button><p data-strategy-art-status role="status" aria-live="polite"></p></footer><nav class="strategy-art-scenes" aria-label="City illustrations"></nav>';
      const video = root.querySelector('video'); video.muted = true;
      video.addEventListener('error', () => {
        if (!playing) return;
        stop(); root.querySelector('[data-strategy-art-status]').textContent = 'Ambience is unavailable. The illustration is still available.';
      });
      root.querySelector('.strategy-art-image').addEventListener('error', () => { root.querySelector('[data-strategy-art-status]').textContent = 'This illustration is unavailable.'; });
      root.querySelector('.strategy-art-close').onclick = () => root.close();
      root.querySelector('[data-strategy-ambient]').onclick = toggleMotion;
      root.querySelector('[data-strategy-atmosphere]').onchange = event => {
        stop(); atmosphere = event.target.value;
        root.querySelector('[data-strategy-art-status]').textContent = 'Atmosphere selected. Press Play ambience to view it.';
      };
      root.addEventListener('close', () => { stop(); if (opener?.isConnected) opener.focus(); });
      root.addEventListener('click', event => { if (event.target === root) root.close(); });
      root.querySelector('.strategy-art-scenes').addEventListener('keydown', event => {
        if (!event.target.matches('[data-strategy-scene]')) return;
        const buttons = [...root.querySelectorAll('[data-strategy-scene]')], index = buttons.indexOf(event.target);
        let next;
        if (event.key === 'ArrowRight') next = (index + 1) % buttons.length;
        else if (event.key === 'ArrowLeft') next = (index + buttons.length - 1) % buttons.length;
        else if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = buttons.length - 1;
        else return;
        event.preventDefault(); buttons[next].focus(); buttons[next].click();
      });
      for (const scene of scenes) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.strategyScene = scene.id;
        button.textContent = nameFor(scene); button.setAttribute('aria-pressed', 'false');
        button.onclick = () => selectScene(scene.id); root.querySelector('nav').append(button);
      }
      document.body.append(root); return root;
    }

    function open(event) {
      opener = event.currentTarget;
      const id = mounted?.querySelector('[data-strategy-district][aria-pressed="true"]')?.dataset.strategyDistrict;
      if (!dialog) dialog = createDialog();
      selectScene(id || state().me?.loc || districtIds[0]);
      if (!dialog.open) dialog.showModal();
      loadLibrary();
    }

    function render() {
      if (destroyed) return;
      const next = document.getElementById('strategy-command');
      if (!state().me || state().currentTab !== 'start' || !next?.isConnected) {
        if (dialog?.open) dialog.close();
        return;
      }
      mounted = next;
      const image = next.querySelector('.strategy-district-art');
      if (!image || image.closest('.strategy-art-frame')) return;
      const frame = document.createElement('div'); frame.className = 'strategy-art-frame';
      image.before(frame); frame.append(image);
      const button = document.createElement('button'); button.type = 'button'; button.className = 'strategy-art-open';
      button.textContent = 'View district'; button.setAttribute('aria-haspopup', 'dialog'); button.onclick = open; frame.append(button);
    }

    return {
      render,
      destroy() { destroyed = true; stop(); dialog?.close(); dialog?.remove(); dialog = null; for (const frame of document.querySelectorAll('.strategy-art-frame')) { const image = frame.querySelector('.strategy-district-art'); if (image) frame.replaceWith(image); } },
    };
  };
})();
