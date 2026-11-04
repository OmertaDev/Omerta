import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { parseExpressionAt } from 'acorn';

const context = vm.createContext({ window: {}, localStorage: { getItem: () => null } });
vm.runInContext(readFileSync(new URL('../public/ux-feedback.js', import.meta.url), 'utf8'), context);
const { summarize, receiptMarkup, preferences } = context.window.createOmertaFeedback;
const before = { id: 'one', generation: 1, level: 4, cash: 1000, respect: 30, nerve: 8,
  trades: [{ id: 'larceny', name: 'Larceny', xp: 10, lvl: 1 }] };
const after = { ...before, level: 5, cash: 1300, respect: 50, nerve: 6,
  trades: [{ id: 'larceny', name: 'Larceny', xp: 18, lvl: 2, nextAt: 30 }] };
const success = { code: 200, body: { success: true, take: 400 } };
const facts = summarize(before, after, success);
assert.equal(facts.netCash, 300, 'Actual net change takes precedence over reported gross payout.');
assert.equal(facts.trades[0].xp, 8);
assert.equal(facts.trades[0].remaining, 12);
assert.equal(facts.milestones.length, 2);
assert.equal(summarize(before, null, success).verified, false);
assert.equal(summarize(before, after, { code: 503 }).verified, false);
const heir = summarize(before, { ...after, id: 'heir', cash: 10 }, success);
assert.equal(heir.changedCharacter, true);
assert.equal(heir.changes.length, 0, 'Death/heir change cannot masquerade as a cash or XP delta.');
assert.equal(summarize(before, { ...after, trades: [] }, success).trades.length, 0);
const markup = receiptMarkup({ id: 1, state: 'success', label: '<img src=x onerror=alert(1)>',
  summary: '<script>bad</script>', at: '12:00', atIso: '2026-10-24', feedback: facts,
  outcome: true, next: { tab: 'life', label: 'Review mastery' } });
assert(markup.includes('+$300 pocket change'));
assert(markup.includes('Larceny +8 XP'));
assert(markup.includes('data-operation-tab="life"'));
assert(!markup.includes('<img src=x') && !markup.includes('<script>'));
const failed = receiptMarkup({ id: 2, state: 'success', label: 'Job', feedback: facts, outcome: false });
assert(failed.includes('operation-receipt--setback') && failed.includes('went sideways'));
assert(!failed.includes('data-operation-tab='));
const feedback = context.window.createOmertaFeedback({ getState: () => ({ me: after }), notify: () => {} });
const unlocked = feedback.enrich({ id: 3, state: 'success', path: '/v1/crimes/pickpocket', label: 'Job' }, before, after, success);
assert.equal(unlocked.next.tab, 'streets', 'The Path declaration is on Streets, so its unlock must lead there.');
assert.equal(unlocked.feedback.netCash, 300);
const unsafeMilestone = receiptMarkup({ id: 4, state: 'success', label: 'Milestone',
  feedback: { verified: true, changes: [], trades: [], milestones: [{ label: '<img src=x onerror=alert(1)>' }] } });
assert(!unsafeMilestone.includes('<img src=x'), 'Milestone headlines are text, including in the prominent outcome.');
assert.equal(preferences().volume, 70);
context.localStorage.getItem = () => '{"volume":999,"haptics":false,"celebration":"invalid"}';
assert.equal(preferences().volume, 100);
assert.equal(preferences().haptics, false);
assert.equal(preferences().celebration, 'full');
console.log('UX feedback: verified outcomes, net deltas, XP, heir boundaries, escaping, follow-ups, and preferences passed.');

// Exercise the real request boundary: a board begun under one identity cannot be observed
// or returned as successful after the active identity changes while awaiting its response.
const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const start = html.indexOf('  async function apiNow(');
const end = parseExpressionAt(html, start + 2, { ecmaVersion: 'latest' }).end;
assert(start > 0 && end > start);
let observed = 0;
const lifetimes = [];
const boundary = vm.createContext({ token: 'alice', me: { id: 'predecessor' }, uxReadSequence: 0, currentTab: 'life', session: { accountId: 'alice' },
  uxCall: (method, ...args) => { if (method === 'observe') observed++; else lifetimes.push([method, ...args]); },
  fetch: async () => { boundary.token = 'bob'; return { status: 200, headers: { get: () => null }, json: async () => ({ private: 'alice board' }) }; } });
vm.runInContext(html.slice(start, end), boundary);
const stale = await boundary.apiNow('GET', '/v1/mastery');
assert.equal(stale.code, 499); assert.equal(stale.ignored, true);
assert.equal(stale.body.error, 'session_changed');
assert.equal(observed, 0, 'Stale account data must never reach presentation caches.');
boundary.fetch = async () => ({ status: 200, headers: { get: () => null }, json: async () => ({ ok: true }) });
assert.equal((await boundary.apiNow('GET', '/v1/mastery')).code, 200);
assert.equal(observed, 1);
assert.equal(lifetimes[0][0], 'readStarted'); assert.equal(lifetimes[1][0], 'readFinished'); assert.equal(lifetimes[1][1].code, 499);
assert.equal(lifetimes[0][1].id, lifetimes[1][1].id, 'a late account reply closes only its original loading lifetime');
boundary.fetch = async () => { throw new Error('offline'); };
assert.equal((await boundary.apiNow('GET', '/v1/mastery')).code, 503);
assert.equal(lifetimes.at(-1)[1].code, 503, 'network failure closes the real loading lifetime');
boundary.fetch = async () => ({ status: 200, json: async () => { throw new Error('HTML response'); } });
assert.equal((await boundary.apiNow('GET', '/v1/mastery')).code, 502);
assert.equal(lifetimes.at(-1)[1].code, 502, 'an unreadable response closes its lifetime and cannot appear successful');
assert.equal(observed, 1, 'failed or unreadable replies never populate presentation caches');
boundary.fetch = async () => { boundary.me = { id: 'successor' }; return { status: 200, json: async () => ({ ancestors: [], private: 'predecessor-only record' }) }; };
const priorLife = await boundary.apiNow('GET', '/v1/bloodline');
assert.equal(priorLife.code, 499); assert.equal(priorLife.ignored, true); assert.equal(priorLife.body.error, 'session_changed');
assert.equal(lifetimes.at(-1)[1].code, 499);
assert.equal(observed, 1, 'a response begun for a previous character cannot populate the successor’s presentation caches');
console.log('UX account request boundary: stale observations and responses rejected.');

// Exercise the actual one-engine bridge, including retiring an old bed during crossfade.
const ambientStart = html.indexOf('  const AMBIENT = (() => {'), ambientEnd = html.indexOf('\n  const sfx =', ambientStart);
assert(ambientStart > 0 && ambientEnd > ambientStart);
const audioInstances = [], audioListeners = {}, audioTimers = new Map(); let audioTimerId = 0, audioEnabled = true;
const audioDocument = { hidden: false, addEventListener(name, callback) { audioListeners[name] = callback; } };
class FakeAudio {
  constructor(src) { this.src = src; this.volume = 1; this.paused = true; audioInstances.push(this); }
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
}
const audioContext = vm.createContext({ Audio: FakeAudio, document: audioDocument, navigator: { connection: {} }, SFX: { enabled: () => audioEnabled },
  feedbackPreferences: () => ({ ambience: true }), MOTION: { beds: new Set(['bed-streets', 'bed-docks']) },
  setInterval(callback) { audioTimers.set(++audioTimerId, callback); return audioTimerId; }, clearInterval(id) { audioTimers.delete(id); } });
vm.runInContext(html.slice(ambientStart, ambientEnd) + '\nglobalThis.audioEngine = AMBIENT;', audioContext);
const advanceAudio = () => { for (let step = 0; step < 30; step++) for (const [id, callback] of [...audioTimers]) if (audioTimers.has(id)) callback(); };
audioContext.audioEngine.set('streets', 'streets'); assert.equal(audioInstances.length, 0, 'soundscapes do not bypass the first user gesture');
audioListeners.pointerdown(); await Promise.resolve(); await Promise.resolve(); advanceAudio();
assert.equal(audioInstances[0].paused, false); assert.equal(audioInstances[0].volume, .11);
assert.equal(audioContext.audioEngine.soundscape({ enabled: true, key: 'bed-docks', volume: 60 }), true);
await Promise.resolve(); await Promise.resolve(); advanceAudio();
assert.equal(audioInstances.length, 2); assert.equal(audioInstances[0].paused, true); assert.equal(audioInstances[0].src, '', 'the old room bed retires instead of becoming orphaned audio');
assert.equal(audioInstances[1].volume, .11 * .6); assert.equal(audioTimers.size, 0);
assert.equal(audioContext.audioEngine.soundscape({ enabled: true, key: 'unverified-file', volume: 100 }), false, 'only boot-verified audio assets can be selected');
audioDocument.hidden = true; audioListeners.visibilitychange(); assert.equal(audioInstances[1].paused, true);
audioDocument.hidden = false; audioListeners.visibilitychange(); await Promise.resolve(); advanceAudio(); assert.equal(audioInstances[1].paused, false);
audioEnabled = false; audioContext.audioEngine.sync(); advanceAudio(); assert.equal(audioInstances[1].paused, true, 'the site master mute stops the custom room bed');
console.log('UX soundscape bridge: gesture, verified assets, independent crossfades, volume, hidden page and master mute passed.');
const { runJourneyModelProof } = await import('./lib/ux-journeys.js');
await runJourneyModelProof();
