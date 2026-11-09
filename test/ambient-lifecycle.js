import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

// Execute the shipped engine, not a duplicate implementation. Fake only browser media and time.
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  const AMBIENT = (() => {');
const end = html.indexOf('\n  const sfx =', start);
assert(start > 0 && end > start);
const source = html.slice(start, end) + '\nglobalThis.engine = AMBIENT;';
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

function fixture({ deferredPlay = false } = {}) {
  const beds = [], timers = new Map(); let now = 0, nextId = 0, enabled = true;
  const events = () => ({ listeners: new Map(), addEventListener(name, callback) {
    const callbacks = this.listeners.get(name) || []; callbacks.push(callback); this.listeners.set(name, callbacks);
  }, dispatch(name) { for (const callback of this.listeners.get(name) || []) callback(); } });
  const document = Object.assign(events(), { hidden: false }), window = events();
  const preferences = { ambience: true }, navigator = { connection: { saveData: false } };
  const schedule = (callback, delay, interval) => {
    const id = ++nextId; timers.set(id, { callback, at: now + delay, interval }); return id;
  };
  class FakeAudio {
    constructor(src) { this.src = src; this._volume = 1; this.paused = true; this.removed = false; this.loads = 0; beds.push(this); }
    get volume() { return this._volume; }
    set volume(value) { if (!this.stalledVolume) this._volume = value; }
    play() { this.paused = false; return deferredPlay ? new Promise(resolve => { this.resolvePlay = resolve; }) : Promise.resolve(); }
    pause() { this.paused = true; }
    removeAttribute(name) { assert.equal(name, 'src'); this.removed = true; this.src = ''; }
    load() { this.loads++; }
  }
  const context = vm.createContext({ Audio: FakeAudio, document, window, navigator,
    addEventListener: window.addEventListener.bind(window), SFX: { enabled: () => enabled },
    feedbackPreferences: () => preferences, MOTION: { beds: new Set(['bed-streets', 'bed-docks', 'bed-den', 'bed-law']) },
    setInterval: (callback, delay) => schedule(callback, delay, delay), clearInterval: id => timers.delete(id),
    setTimeout: (callback, delay) => schedule(callback, delay, 0), clearTimeout: id => timers.delete(id) });
  vm.runInContext(source, context);
  const advance = ms => {
    const until = now + ms;
    for (;;) {
      const entry = [...timers].filter(([, timer]) => timer.at <= until).sort((a, b) => a[1].at - b[1].at)[0];
      if (!entry) break;
      const [id, timer] = entry; now = timer.at;
      if (timer.interval) timer.at += timer.interval; else timers.delete(id);
      timer.callback();
    }
    now = until;
  };
  const begin = async () => { context.engine.set('streets', 'streets'); document.dispatch('pointerdown'); await flush(); advance(600); };
  return { engine: context.engine, beds, timers, document, window, preferences, navigator, advance, begin,
    mute: () => { enabled = false; }, unmute: () => { enabled = true; } };
}
function released(bed) {
  assert.equal(bed.paused, true, 'retired audio must be paused');
  assert.equal(bed.removed, true, 'remove src instead of assigning the page URL as audio');
  assert.equal(bed.loads, 1, 'release the detached media resource once');
}
function silent(f) { for (const bed of f.beds) released(bed); assert.equal(f.timers.size, 0, 'silence leaves no audio timers'); }

// Removing the first-gesture/verified-asset guards or the custom-volume bridge breaks this.
test('gesture, verified assets and custom soundscape volume survive independent crossfades', async () => {
  const f = fixture(); f.engine.set('streets', 'streets'); assert.equal(f.beds.length, 0);
  await f.begin(); assert.equal(f.beds[0].volume, .11);
  assert.equal(f.engine.soundscape({ enabled: true, key: 'unverified', volume: 100 }), false);
  assert.equal(f.beds.length, 1);
  assert.equal(f.engine.soundscape({ enabled: true, key: 'bed-docks', volume: 60 }), true);
  await flush(); f.advance(600); released(f.beds[0]); assert.equal(f.beds[1].volume, .11 * .6);
  f.engine.set('den', 'vice'); assert.equal(f.beds.length, 2, 'custom soundscape survives navigation');
  f.engine.soundscape({ enabled: false }); await flush(); f.advance(600);
  released(f.beds[1]); assert.equal(f.beds[2].src, '/art/hype/bed-den.m4a'); assert.equal(f.timers.size, 0);
});

test('zero-volume outgoing audio is released without waiting for a fade tick', async () => {
  const f = fixture({ deferredPlay: true }); await f.begin();
  f.engine.set('port', 'city'); released(f.beds[0]);
  f.beds[0].resolvePlay(); await flush();
  assert.equal(f.timers.size, 0, 'late play resolution cannot resurrect a retired fade');
});

test('rapid navigation retires every previous bed and releases all completed fade timers', async () => {
  const f = fixture(); await f.begin();
  for (const tab of ['port', 'den', 'law', 'port']) { f.engine.set(tab, 'city'); await flush(); f.advance(120); }
  assert.equal(f.beds.length, 5, 'the test must exercise real crossfades');
  f.advance(1500); for (const bed of f.beds.slice(0, -1)) released(bed);
  assert.equal(f.beds.at(-1).paused, false); assert.equal(f.timers.size, 0);
});

test('retirement has a hard deadline even when a media element ignores volume writes', async () => {
  const f = fixture(); await f.begin(); const outgoing = f.beds[0]; outgoing.stalledVolume = true;
  f.engine.set('port', 'city'); await flush(); f.advance(1200);
  released(outgoing); assert.equal(f.beds[1].paused, false); assert.equal(f.timers.size, 0);
});

for (const gate of ['master mute', 'ambience preference', 'data saver']) test(`${gate} immediately releases current and retiring beds`, async () => {
  const f = fixture(); await f.begin(); f.engine.set('port', 'city'); await flush(); f.advance(120);
  assert.equal(f.beds.filter(bed => !bed.paused).length, 2, 'mute must interrupt an active crossfade');
  if (gate === 'master mute') f.mute();
  if (gate === 'ambience preference') f.preferences.ambience = false;
  if (gate === 'data saver') f.navigator.connection.saveData = true;
  f.engine.sync(); silent(f); f.advance(2000); silent(f);
});

for (const event of ['visibilitychange', 'pagehide', 'freeze']) test(`${event} releases every bed immediately and returns with one fresh bed`, async () => {
  const f = fixture(); await f.begin(); f.engine.soundscape({ enabled: true, key: 'bed-docks', volume: 40 });
  await flush(); f.advance(120); const old = [...f.beds];
  if (event === 'visibilitychange') { f.document.hidden = true; f.document.dispatch(event); }
  else (event === 'freeze' ? f.document : f.window).dispatch(event);
  silent(f);
  if (event === 'visibilitychange') { f.document.hidden = false; f.document.dispatch(event); }
  else (event === 'freeze' ? f.document : f.window).dispatch(event === 'freeze' ? 'resume' : 'pageshow');
  await flush(); f.advance(600);
  for (const bed of old) released(bed);
  assert.equal(f.beds.length, 3); assert.equal(f.beds.at(-1).src, '/art/hype/bed-docks.m4a');
  assert.equal(f.beds.at(-1).volume, .11 * .4); assert.equal(f.beds.filter(bed => !bed.paused).length, 1);
});

test('late play promises after hide do not restart audio or schedule fades', async () => {
  const f = fixture({ deferredPlay: true }); await f.begin();
  f.document.hidden = true; f.document.dispatch('visibilitychange');
  f.beds[0].resolvePlay(); await flush(); silent(f);
  f.engine.set('port', 'city'); f.window.dispatch('pageshow'); assert.equal(f.beds.length, 1);
});

test('restoring a page while muted does not create a new bed', async () => {
  const f = fixture(); await f.begin(); f.mute(); f.engine.sync();
  f.window.dispatch('pagehide'); f.window.dispatch('pageshow'); f.document.dispatch('resume'); silent(f);
  assert.equal(f.beds.length, 1); f.unmute(); f.engine.sync(); await flush(); f.advance(600);
  assert.equal(f.beds.length, 2); assert.equal(f.beds.at(-1).paused, false);
});
