import { parse as parseCatalogueSource } from 'acorn';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
// Exact complete GUI and fixture-reader source proofs; no native/runtime admission.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { CONTINUOUS_CITY_SOURCE_REVISION, CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_DOMAINS,
  CONTINUOUS_CITY_FIXTURE_DOMAINS, qualifyContinuousCitySource, qualifyContinuousCityFixtureSource,
  continuousCityHistoricalInput } from '../tools/continuous-city-source-compatibility.js';
import { CONTINUOUS_CITY_FIXTURE_PREDECESSOR } from '../tools/continuous-city-fixture-source-data.js';
import { hasEnterpriseOverRootSource, enterpriseOverRootSourceBaseline } from '../tools/enterprise-current-source-compatibility.js';
assert.deepEqual(process.argv.slice(2), [], 'Source-only proof has no native or retained modes');
const git = (...args) => execFileSync('git', ['-c', 'core.safecrlf=false', ...args], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
// This local physical-reader hop admits only exact reviewed current UI bytes; frozen GUI/fixture proofs below are unchanged.
const CURRENT_UI_OVER_GUI59 = Object.freeze({
  "version": 1,
  "phase": "EXACT_CURRENT_UI_OVER_FROZEN_GUI59_TEST_SOURCE_ONLY",
  "file": "public/index.html",
  "revision": "6b5e0ceca4b3a3409746d3e069ee193a3925d0da",
  "tree": "fc788ba7b6153b49c71b8192903b6defe97820b3",
  "currentMode": "100644",
  "currentBlob": "cb1e87f6f5035dd51dd762f6d4f1346486ba2c3a",
  "currentSha256": "eeebe188efb53e3d2aa34af40868d6d757955479ad9ea039b00f4bc5deb8aa52",
  "currentRawSha256": Object.freeze({"lf":"eeebe188efb53e3d2aa34af40868d6d757955479ad9ea039b00f4bc5deb8aa52","crlf":"15671499a37c37ecc3d9965fdf5a01462512c76650b11702c59a77d5dce2f02a"}),
  "currentBytes": 1468339,
  "targetRevision": "59dbb6d99312fa44dba1fbec5bdf24948740e0dc",
  "targetTree": "558374c74221edeb57b9ff0588171a8b16aa1080",
  "targetMode": "100644",
  "targetBlob": "6221711be794023ee60c53f2039795d14be7cf65",
  "targetSha256": "9f8baaf26731853d89fde6015e51f5355f23ef0347fb0a850f3ad4edfa771951",
  "targetBytes": 1468176,
  "contextLines": 3,
  "inverses": Object.freeze([
    Object.freeze({"current":"    font-size: 16px;\n  }\n  * { box-sizing: border-box; }\n  html { scroll-behavior: auto; }\n  body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--serif); line-height: 1.5;\n    -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }\n  /* the room: a faint overhead lamp + street-level vignette (fixed, zero-cost atmosphere) */\n","baseline":"    font-size: 16px;\n  }\n  * { box-sizing: border-box; }\n  html { scroll-behavior: smooth; }\n  body { margin: 0; background: var(--bg); color: var(--ink); font-family: var(--serif); line-height: 1.5;\n    -webkit-font-smoothing: antialiased; -webkit-tap-highlight-color: transparent; }\n  /* the room: a faint overhead lamp + street-level vignette (fixed, zero-cost atmosphere) */\n"}),
    Object.freeze({"current":"    box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 1px 2px rgba(0,0,0,.4);\n    transition: border-color .18s, transform .18s var(--ease), box-shadow .18s; }\n  .card:hover { border-color: var(--line2); transform: translateY(-1px); box-shadow: var(--shadow); }\n  #tab-deeds .card:hover { transform: none; }\n  /* THE HERO BAND — a focal header so a screen has a headline number to rest the eye on, instead of a\n     flat grid where every row weighs the same. A row of 1–3 big stats, each a large value + a dim label.\n     (class 'hband', NOT 'hero' — '.hero' already belongs to the landing page's hero SECTION.) */\n","baseline":"    box-shadow: inset 0 1px 0 rgba(255,255,255,.035), 0 1px 2px rgba(0,0,0,.4);\n    transition: border-color .18s, transform .18s var(--ease), box-shadow .18s; }\n  .card:hover { border-color: var(--line2); transform: translateY(-1px); box-shadow: var(--shadow); }\n  /* THE HERO BAND — a focal header so a screen has a headline number to rest the eye on, instead of a\n     flat grid where every row weighs the same. A row of 1–3 big stats, each a large value + a dim label.\n     (class 'hband', NOT 'hero' — '.hero' already belongs to the landing page's hero SECTION.) */\n"}),
    Object.freeze({"current":"  function travelTo(district, operationOptions = {}) {\n    const place = (rules?.districts || []).find((d) => (d.id || d) === district);\n    return act('POST', `/v1/travel/${district}`, {}, { label: `travel to ${place?.name || district}`, ...operationOptions })\n      .then((r) => { if (r.code < 400 && operationOptions.refreshBoard !== false) renderActive({ afterAction: true }); return r; });\n  }\n  function openTravel() {\n    const here = me?.loc;\n","baseline":"  function travelTo(district, operationOptions = {}) {\n    const place = (rules?.districts || []).find((d) => (d.id || d) === district);\n    return act('POST', `/v1/travel/${district}`, {}, { label: `travel to ${place?.name || district}`, ...operationOptions })\n      .then((r) => { if (r.code < 400) renderActive({ afterAction: true }); return r; });\n  }\n  function openTravel() {\n    const here = me?.loc;\n"}),
    Object.freeze({"current":"      // which reads as \"the button did nothing\" — a tester reported exactly that. Debounced and\n      // input-safe (renderActive skips while a field has focus), so this costs one board fetch on the\n      // screen already in front of you.\n      if (r.code < 400 && options.refreshBoard !== false) renderActive({ afterAction: true });\n      return r;\n    } finally {\n      acting = false;\n","baseline":"      // which reads as \"the button did nothing\" — a tester reported exactly that. Debounced and\n      // input-safe (renderActive skips while a field has focus), so this costs one board fetch on the\n      // screen already in front of you.\n      if (r.code < 400) renderActive({ afterAction: true });\n      return r;\n    } finally {\n      acting = false;\n"}),
    Object.freeze({"current":"        if (investigate) investigate.onclick = async () => {\n          if (!valid()) return;\n          investigate.disabled = true;\n          try { await act('POST', '/v1/deeds/investigate', { buildingId: p.id, actionId: objective.actionId }, { label: objective.title, beforeDispatch: valid, retryBeforeDispatch: current, isCurrent: current, refreshBoard: false }); }\n          finally { if (current() && currentTab === 'deeds' && navigation === navigationRevision) await renderDeeds({ district, buildingId: p.id }); }\n        };\n        const travel = $('#deed-objective-travel');\n        if (travel) travel.onclick = async () => {\n          if (!valid()) return;\n          travel.disabled = true;\n          try { await travelTo(requiredDistrict, { beforeDispatch: valid, retryBeforeDispatch: current, isCurrent: current, refreshBoard: false }); }\n          finally { if (current() && currentTab === 'deeds' && navigation === navigationRevision) await renderDeeds({ district, buildingId: p.id }); }\n        };\n        const claim = $('#deed-property-claim');\n","baseline":"        if (investigate) investigate.onclick = async () => {\n          if (!valid()) return;\n          investigate.disabled = true;\n          try { await act('POST', '/v1/deeds/investigate', { buildingId: p.id, actionId: objective.actionId }, { label: objective.title, beforeDispatch: valid, retryBeforeDispatch: current, isCurrent: current }); }\n          finally { if (current() && currentTab === 'deeds' && navigation === navigationRevision) await renderDeeds({ district, buildingId: p.id }); }\n        };\n        const travel = $('#deed-objective-travel');\n        if (travel) travel.onclick = async () => {\n          if (!valid()) return;\n          travel.disabled = true;\n          try { await travelTo(requiredDistrict, { beforeDispatch: valid, retryBeforeDispatch: current, isCurrent: current }); }\n          finally { if (current() && currentTab === 'deeds' && navigation === navigationRevision) await renderDeeds({ district, buildingId: p.id }); }\n        };\n        const claim = $('#deed-property-claim');\n"})
  ])
});
function qualifyCurrentUIOverGUI59(file, input, expected, mode, pin = CURRENT_UI_OVER_GUI59) {
  const keys = (value, names) => {
    assert(value && typeof value === 'object' && !Array.isArray(value) && Object.isFrozen(value), 'Frozen exact TEST source binding required');
    assert([Object.prototype, null].includes(Object.getPrototypeOf(value)));
    assert.deepEqual(Reflect.ownKeys(value).sort(), names.slice().sort());
    for (const property of Object.values(Object.getOwnPropertyDescriptors(value))) assert(Object.hasOwn(property, 'value'), 'Source binding accessors refuse');
  };
  keys(pin, ["version","phase","file","revision","tree","currentMode","currentBlob","currentSha256","currentRawSha256","currentBytes","targetRevision","targetTree","targetMode","targetBlob","targetSha256","targetBytes","contextLines","inverses"]);
  keys(pin.currentRawSha256, ['lf', 'crlf']);
  const header = { ...pin }; delete header.inverses;
  assert.equal(hash(JSON.stringify(header)), "ede789e752a7abbb5ba6d2c05469ec8e229ec3eb776c0342f80a5503e244b8c6", 'Exact reviewed current D and frozen GUI59 identities only');
  assert.equal(file, 'public/index.html'); assert.equal(file, pin.file); assert.equal(mode, pin.currentMode);
  assert.equal(typeof input, 'string', 'UTF8 physical source String only');
  assert.equal(Buffer.from(input, 'utf8').toString('utf8'), input, 'Lossless UTF8 source only');
  assert(!input.includes('\ufeff') && !input.includes('\0'), 'BOM/NUL source refuses');
  const canonical = input.replaceAll('\r\n', '\n');
  assert(!canonical.includes('\r') && (input === canonical || input === canonical.replaceAll('\n', '\r\n')), 'Uniform whole LF or CRLF only');
  assert.equal(hash(input), pin.currentRawSha256[input === canonical ? 'lf' : 'crlf']);
  assert.equal(hash(canonical), pin.currentSha256); assert.equal(blob(canonical), pin.currentBlob); assert.equal(Buffer.byteLength(canonical), pin.currentBytes);
  assert.equal(typeof expected, 'string'); assert.equal(hash(expected), pin.targetSha256); assert.equal(blob(expected), pin.targetBlob); assert.equal(Buffer.byteLength(expected), pin.targetBytes);
  assert(Array.isArray(pin.inverses) && Object.isFrozen(pin.inverses)); assert.equal(pin.inverses.length, 5);
  assert.deepEqual(Reflect.ownKeys(pin.inverses), Array.from({ length: 5 }, (_, i) => String(i)).concat('length'));
  const contextSHA256 = ["04beeee8cb46525947c68e1976bd578746867ffaa24d27cb240c1e35babaeba9","36131166458007e0c1baa418030731a489e3b154a67d1c592aefda0f58c3a63b","de65784029d0343e561a13e74a08439e19801155b72849418f4e01f7b73cfce3","7f8f5a53a1d117f0de72180f848b7e2f54b11b56bc507cfd605f894f810b3893","d62419f4533a35c80115de96f8be3ec2dc20fc958f491090569efe77a8520620"];
  let restored = canonical, end = -1;
  for (const [index, inverse] of pin.inverses.entries()) {
    keys(inverse, ['current', 'baseline']); assert.equal(hash(JSON.stringify(inverse)), contextSHA256[index], 'Exact complete direct Git context3 only');
    assert.equal(typeof inverse.current, 'string'); assert(inverse.current.length > 0); assert.equal(typeof inverse.baseline, 'string');
    assert.equal(canonical.split(inverse.current).length, 2); const at = canonical.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping current contexts'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(restored), pin.targetSha256); assert.equal(blob(restored), pin.targetBlob); assert.equal(restored, expected, 'Whole actual frozen GUI59 must reconstruct');
  return Object.freeze({ baselineText: restored, sourceRevision: pin.revision, targetRevision: pin.targetRevision, sourceOnly: true, native: false, runtime: false });
}
assert.equal(git('--no-replace-objects', 'rev-parse', CURRENT_UI_OVER_GUI59.revision + '^{tree}').trim(), CURRENT_UI_OVER_GUI59.tree);
assert.equal(git('--no-replace-objects', 'ls-tree', CURRENT_UI_OVER_GUI59.revision, '--', CURRENT_UI_OVER_GUI59.file).trim(), '100644 blob ' + CURRENT_UI_OVER_GUI59.currentBlob + '\t' + CURRENT_UI_OVER_GUI59.file);
assert.equal(hash(git('--no-replace-objects', 'show', CURRENT_UI_OVER_GUI59.revision + ':' + CURRENT_UI_OVER_GUI59.file)), CURRENT_UI_OVER_GUI59.currentSha256);
assert.equal(git('--no-replace-objects', 'rev-parse', CURRENT_UI_OVER_GUI59.targetRevision + '^{tree}').trim(), CURRENT_UI_OVER_GUI59.targetTree);
assert.equal(git('--no-replace-objects', 'ls-tree', CURRENT_UI_OVER_GUI59.targetRevision, '--', CURRENT_UI_OVER_GUI59.file).trim(), '100644 blob ' + CURRENT_UI_OVER_GUI59.targetBlob + '\t' + CURRENT_UI_OVER_GUI59.file);
assert.equal(hash(git('--no-replace-objects', 'show', CURRENT_UI_OVER_GUI59.targetRevision + ':' + CURRENT_UI_OVER_GUI59.file)), CURRENT_UI_OVER_GUI59.targetSha256);
function hunks(diff) {
  const result = []; let current;
  for (const line of diff.split('\n')) {
    if (line.startsWith('@@')) { if (current) result.push(current); current = { current: '', baseline: '' }; }
    else if (current && line.startsWith(' ')) { current.current += line.slice(1) + '\n'; current.baseline += line.slice(1) + '\n'; }
    else if (current && line.startsWith('+')) current.current += line.slice(1) + '\n';
    else if (current && line.startsWith('-')) current.baseline += line.slice(1) + '\n';
    else if (current && line.startsWith('\\ No newline')) assert.fail('Unexpected non-newline source hunk');
  }
  if (current) result.push(current); return result;
}
let positives = 0, refusals = 0, inverseHunks = 0, additions = 0;
function verify(file, pin, actual, baseline, qualify, diff) {
  assert.equal(hash(actual), pin.currentSha256); assert.equal(blob(actual), pin.currentBlob);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.currentRawSha256) && Object.isFrozen(pin.inverses) && pin.inverses.every(Object.isFrozen));
  for (const input of [actual, actual.replaceAll('\n', '\r\n')]) {
    const proof = qualify(file, input);
    assert.equal(proof.sourceOnly, true); assert.equal(proof.native, false);
    assert.equal(proof.predecessorAbsent, baseline === null); assert.equal(proof.baselineText, baseline);
    assert.equal(hash(input), pin.currentRawSha256[input.includes('\r\n') ? 'crlf' : 'lf']); positives++;
  }
  for (const input of [actual + '\n// unknown\n', '\n// unknown\n' + actual, actual.slice(1), '\ufeff' + actual,
    actual + '\0', actual.replace('\n', '\r\n'), actual.replace('\n', '\r'), Buffer.from(actual), null]) {
    assert.throws(() => qualify(file, input)); refusals++;
  }
  for (const inverse of pin.inverses) {
    for (const input of [actual.replace(inverse.current, ''), actual.replace(inverse.current, () => inverse.current + inverse.current), actual.replace(inverse.current, () => inverse.baseline)]) {
      assert.throws(() => qualify(file, input)); refusals++;
    }
    inverseHunks++;
  }
  if (baseline === null) {
    assert.equal(pin.baselineMode, null); assert.equal(pin.baselineBlob, null); assert.equal(pin.baselineSha256, null);
    assert.deepEqual(pin.inverses, []); assert.throws(() => continuousCityHistoricalInput(file, actual)); refusals++; additions++;
  } else {
    assert.equal(pin.baselineMode, '100644'); assert.equal(hash(baseline), pin.baselineSha256); assert.equal(blob(baseline), pin.baselineBlob);
    assert.deepEqual(pin.inverses, hunks(diff), 'Inverses must be actual complete Git diff contexts: ' + file);
    assert.throws(() => qualify(file, baseline)); refusals++;
    assert.throws(() => continuousCityHistoricalInput(file, baseline)); refusals++;
    assert.throws(() => continuousCityHistoricalInput(file, Buffer.concat([Buffer.from(actual), Buffer.from([0xff])])), /lossless UTF-8/); refusals++;
    assert.equal(continuousCityHistoricalInput(file, actual), baseline);
    assert.deepEqual(continuousCityHistoricalInput(file, Buffer.from(actual)), Buffer.from(baseline)); positives += 2;
    for (const input of [actual + '\n// physical mutation\n', '\ufeff' + actual, actual + '\0', actual.replace('\n', '\r\n')]) {
      assert.throws(() => continuousCityHistoricalInput(file, input)); refusals++;
    }
  }
}
assert.equal(Object.keys(CONTINUOUS_CITY_SOURCE_DOMAINS).length, 16);
// A separate exact HOME physical-reader proof; frozen GUI16/fixture36 and the HTML proof remain unchanged.
const CURRENT_HOME_OVER_GUI59 = Object.freeze({"version":1,"phase":"EXACT_CURRENT_HOME_OVER_FROZEN_GUI59_TEST_SOURCE_ONLY","file":"test/city-world-host-browser.js","revision":"e2ebf9bcb2f1cf7a3e82d32a94d7144ab962432d","tree":"af60f8ff2107b7654c1f70a5e68114232173cd61","currentMode":"100644","currentBlob":"8ba4806fc138b06a0e4b0a5d2686c29245d913ce","currentSha256":"962208e525a06a2caad7d438d6c09c1681c52a0982749f68e2a5a3bc6729a3cf","currentRawSha256":Object.freeze({"lf":"962208e525a06a2caad7d438d6c09c1681c52a0982749f68e2a5a3bc6729a3cf","crlf":"6f8c37062fdeb15e71f569b723a766a1c17e4468b18f002aaafc348763bfb789"}),"currentBytes":154141,"targetRevision":"59dbb6d99312fa44dba1fbec5bdf24948740e0dc","targetTree":"558374c74221edeb57b9ff0588171a8b16aa1080","targetMode":"100644","targetBlob":"ee52f1db91f49961389b3ca5da987884eedb6d75","targetSha256":"794e402e95d80d3f91fa1707f5443cfaf9310d0113e4f3cbaccafdbb7366d6c6","targetBytes":150736,"contextLines":3,"inverses":Object.freeze([Object.freeze({"current":"\n  // Selecting the actual owned home is only a presentation hint. An explicit\n  // confirmed ride precedes the fresh directory read and real entrance walk.\n  // Diagnostic-only passive observations: no route, handler, timer or UI replacement.\n  await cityPage.evaluate(() => {\n    const trace = { started: performance.now(), frames: 0, samples: [], events: [], stopped: false }, stops = [];\n    const active = () => ({ tag: document.activeElement?.tagName, id: document.activeElement?.id });\n    const sample = (now) => {\n      const record = window.__worldHandles.at(-1), state = record?.handle.getState(), game = window.__worldGames.at(-1);\n      return { at: now, frames: trace.frames, destroyed: record?.destroyed, ready: state?.ready, region: state?.region,\n        position: state?.position, pathLength: state?.pathLength, routeActive: state?.routeActive, route: state?.route?.slice(0, 64),\n        selectedHome: state?.selectedHome, selectedVenue: state?.selectedVenue, gameDock: state?.gameDock,\n        homes: state?.homes.slice(0, 32).map(home => ({ key: home.key, entrance: home.entrance })), scope: window.__worldReadScope?.(),\n        visibility: document.visibilityState, focused: document.hasFocus(), active: active(),\n        busy: !!document.querySelector('#busy.on'), game: { booted: game?.isBooted, running: game?.isRunning,\n          actualFps: game?.loop?.actualFps, delta: game?.loop?.delta, targetFps: game?.loop?.targetFps } };\n    };\n    const listen = (target, kind) => { const handler = event => { if (trace.events.length < 16) trace.events.push({ at: performance.now(),\n      kind, target: event.target?.id || event.target?.tagName || 'window', active: active(), visibility: document.visibilityState }); };\n      target.addEventListener(kind, handler, true); stops.push(() => target.removeEventListener(kind, handler, true)); };\n    for (const kind of ['blur', 'focus']) listen(window, kind); listen(document, 'visibilitychange');\n    let last = -Infinity, raf;\n    const step = now => { if (trace.stopped) return; trace.frames++; if (now - last >= 250 && trace.samples.length < 80) { trace.samples.push(sample(now)); last = now; }\n      raf = requestAnimationFrame(step); }; raf = requestAnimationFrame(step);\n    trace.finish = () => { if (!trace.stopped) { trace.stopped = true; cancelAnimationFrame(raf); stops.forEach(stop => stop()); }\n      return { ...trace, finish: undefined, final: sample(performance.now()), handles: window.__worldHandles.slice(-8).map(row => ({ destroyed: row.destroyed,\n        ready: row.handle.getState().ready })) }; };\n    window.__homeArrivalTrace = trace;\n  });\n  const beforeHomeRide = await currentActor(neighbor), homeFares = await fares(neighbor);\n  const homeRide = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/travel/brick');\n  confirmation = await travelPrompt(propertyDistrict); await activate(confirmation.locator('[data-yes]'));\n","baseline":"\n  // Selecting the actual owned home is only a presentation hint. An explicit\n  // confirmed ride precedes the fresh directory read and real entrance walk.\n  const beforeHomeRide = await currentActor(neighbor), homeFares = await fares(neighbor);\n  const homeRide = cityPage.waitForResponse(reply => reply.request().method() === 'POST' && new URL(reply.url()).pathname === '/v1/travel/brick');\n  confirmation = await travelPrompt(propertyDistrict); await activate(confirmation.locator('[data-yes]'));\n"}),Object.freeze({"current":"  const homeMoving = await state(cityPage), homePlot = homeMoving.homes.find(home => home.key === key);\n  assert(Math.hypot(homeMoving.position.x - homePlot.entrance.x, homeMoving.position.y - homePlot.entrance.y) > 40,\n    'A confirmed ride followed by the real home entry starts walking instead of teleporting to the property.');\n  const homeArrivalStarted = Date.now();\n  try {\n  await cityPage.waitForFunction(key => window.__worldHandles.at(-1).handle.getState().selectedHome === key\n    && window.__worldHandles.at(-1).handle.getState().pathLength === 0, key, { timeout: 15000 });\n    try { console.log('Home arrival passive diagnostic:', JSON.stringify({ outcome: 'success', elapsedMS: Date.now() - homeArrivalStarted,\n      initial: homeMoving, plot: homePlot, trace: await cityPage.evaluate(() => window.__homeArrivalTrace.finish()) })); }\n    catch (diagnosticError) { console.log('Home arrival diagnostic unavailable:', diagnosticError.message); }\n  } catch (error) {\n    try { console.error('Home arrival passive diagnostic:', JSON.stringify({ outcome: 'failure', elapsedMS: Date.now() - homeArrivalStarted,\n      initial: homeMoving, plot: homePlot, trace: await cityPage.evaluate(() => window.__homeArrivalTrace.finish()) })); }\n    catch (diagnosticError) { console.error('Home arrival diagnostic unavailable:', diagnosticError.message); }\n    throw error;\n  } finally { await cityPage.evaluate(() => window.__homeArrivalTrace?.finish()).catch(() => {}); }\n  const homeArrived = await state(cityPage);\n  assert.equal(homeArrived.homes.filter(home => home.key === key).length, 1);\n  assert(Math.hypot(homeArrived.position.x - homePlot.entrance.x, homeArrived.position.y - homePlot.entrance.y) < 42);\n","baseline":"  const homeMoving = await state(cityPage), homePlot = homeMoving.homes.find(home => home.key === key);\n  assert(Math.hypot(homeMoving.position.x - homePlot.entrance.x, homeMoving.position.y - homePlot.entrance.y) > 40,\n    'A confirmed ride followed by the real home entry starts walking instead of teleporting to the property.');\n  await cityPage.waitForFunction(key => window.__worldHandles.at(-1).handle.getState().selectedHome === key\n    && window.__worldHandles.at(-1).handle.getState().pathLength === 0, key, { timeout: 15000 });\n  const homeArrived = await state(cityPage);\n  assert.equal(homeArrived.homes.filter(home => home.key === key).length, 1);\n  assert(Math.hypot(homeArrived.position.x - homePlot.entrance.x, homeArrived.position.y - homePlot.entrance.y) < 42);\n"})])});
const CURRENT_HOME_OVER_GUI59_BINDING_SHA256 = "9078d10cd9f5e18dfe183d48e74f0f95c9838b0d9d317330f6bcf1a6b1cdb71b";
function qualifyCurrentHomeOverGUI59(file, input, expected, mode, pin = CURRENT_HOME_OVER_GUI59) {
  const keys = (value, names) => {
    assert(value && typeof value === 'object' && !Array.isArray(value) && Object.isFrozen(value), 'Frozen exact HOME source binding required');
    assert([Object.prototype, null].includes(Object.getPrototypeOf(value)));
    assert.deepEqual(Reflect.ownKeys(value).sort(), names.slice().sort());
    for (const property of Object.values(Object.getOwnPropertyDescriptors(value))) assert(Object.hasOwn(property, 'value'), 'HOME binding accessors refuse');
  };
  keys(pin, ['version','phase','file','revision','tree','currentMode','currentBlob','currentSha256','currentRawSha256','currentBytes','targetRevision','targetTree','targetMode','targetBlob','targetSha256','targetBytes','contextLines','inverses']);
  assert.match(pin.revision || '', /^[a-f0-9]{40}$/, 'HOME source revision remains unbound');
  assert.match(pin.tree || '', /^[a-f0-9]{40}$/, 'HOME source tree remains unbound');
  assert.match(CURRENT_HOME_OVER_GUI59_BINDING_SHA256 || '', /^[a-f0-9]{64}$/, 'HOME whole binding remains unbound');
  assert.equal(hash(JSON.stringify(pin)), CURRENT_HOME_OVER_GUI59_BINDING_SHA256, 'Exact reviewed current HOME binding only');
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_CURRENT_HOME_OVER_FROZEN_GUI59_TEST_SOURCE_ONLY');
  assert.equal(file, 'test/city-world-host-browser.js'); assert.equal(file, pin.file); assert.equal(mode, pin.currentMode); assert.equal(mode, '100644');
  assert.equal(typeof input, 'string', 'UTF8 physical HOME String only');
  assert.equal(Buffer.from(input, 'utf8').toString('utf8'), input); assert(!input.startsWith('\ufeff') && !input.includes('\0'));
  const text = lf(input); assert(!text.includes('\r') && (input === text || input === text.replaceAll('\n', '\r\n')), 'Uniform whole LF or CRLF HOME source only');
  keys(pin.currentRawSha256, ['lf', 'crlf']); assert.equal(hash(input), pin.currentRawSha256[input.includes('\r\n') ? 'crlf' : 'lf']);
  assert.equal(Buffer.byteLength(text), pin.currentBytes); assert.equal(hash(text), pin.currentSha256); assert.equal(blob(text), pin.currentBlob);
  assert.equal(git('rev-parse', pin.revision + '^{tree}').trim(), pin.tree); git('merge-base', '--is-ancestor', pin.revision, 'HEAD');
  for (const revision of [pin.revision, 'HEAD']) {
    const row = git('ls-tree', revision, '--', file).trim().split(/\s+/);
    assert.deepEqual(row, [pin.currentMode, 'blob', pin.currentBlob, file], 'HOME actual authored/HEAD row must match the full reviewed input');
    assert.equal(git('show', revision + ':' + file), text, 'HOME authored/HEAD whole body must match physical canonical bytes');
  }
  assert.equal(pin.targetRevision, '59dbb6d99312fa44dba1fbec5bdf24948740e0dc'); assert.equal(pin.targetTree, '558374c74221edeb57b9ff0588171a8b16aa1080');
  assert.equal(pin.targetMode, '100644'); assert.equal(git('rev-parse', pin.targetRevision + '^{tree}').trim(), pin.targetTree);
  const target = git('show', pin.targetRevision + ':' + file);
  assert.equal(target, expected, 'Frozen GUI reader target remains whole-byte exact'); assert.equal(hash(target), pin.targetSha256); assert.equal(blob(target), pin.targetBlob); assert.equal(Buffer.byteLength(target), pin.targetBytes);
  assert.deepEqual(git('ls-tree', pin.targetRevision, '--', file).trim().split(/\s+/), [pin.targetMode, 'blob', pin.targetBlob, file]);
  assert.equal(pin.contextLines, 3); assert(Array.isArray(pin.inverses) && Object.isFrozen(pin.inverses));
  assert.deepEqual(Reflect.ownKeys(pin.inverses), [...pin.inverses.keys()].map(String).concat('length')); assert.equal(pin.inverses.length, 2);
  let result = text, previous = -1;
  for (const inverse of pin.inverses) {
    keys(inverse, ['current', 'baseline']); assert(typeof inverse.current === 'string' && inverse.current && typeof inverse.baseline === 'string');
    assert.equal(text.split(inverse.current).length, 2, 'Each whole current HOME context occurs once'); const index = text.indexOf(inverse.current); assert(index >= previous); previous = index + inverse.current.length;
    assert.equal(result.split(inverse.current).length, 2); result = result.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(result, target, 'Complete HOME inverse must reconstruct the exact frozen GUI59 body');
  return Object.freeze({ sourceOnly: true, native: false, runtime: false, baselineText: result });
}
for (const [file, pin] of Object.entries(CONTINUOUS_CITY_SOURCE_DOMAINS)) {
  const current = git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file);
  const physical = fs.readFileSync(file, 'utf8');
  const actualPhysical = file === 'public/index.html'
    ? qualifyCurrentUIOverGUI59(file, physical, current, git('ls-files', '--stage', '--', file).split(' ')[0]).baselineText
    : file === 'test/city-world-host-browser.js'
      ? qualifyCurrentHomeOverGUI59(file, physical, current, git('ls-files', '--stage', '--', file).split(' ')[0]).baselineText
      : lf(physical);
  assert.equal(actualPhysical, current, 'Actual GUI source must remain exactly frozen: ' + file);
  assert.equal(git('ls-tree', CONTINUOUS_CITY_SOURCE_REVISION, '--', file).split(' ')[0], pin.currentMode);
  const priorTree = git('ls-tree', CONTINUOUS_CITY_SOURCE_PREDECESSOR, '--', file);
  assert.equal(priorTree === '', pin.predecessorAbsent);
  if (!pin.predecessorAbsent) assert.equal(priorTree.split(' ')[0], pin.baselineMode);
  const baseline = pin.predecessorAbsent ? null : git('show', CONTINUOUS_CITY_SOURCE_PREDECESSOR + ':' + file);
  verify(file, pin, current, baseline, qualifyContinuousCitySource,
    git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_SOURCE_PREDECESSOR, CONTINUOUS_CITY_SOURCE_REVISION, '--', file));
  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, current)); refusals++; }
}
assert.equal(additions, 5);
assert.equal(Object.keys(CONTINUOUS_CITY_FIXTURE_DOMAINS).length, 36);
for (const [file, pin] of Object.entries(CONTINUOUS_CITY_FIXTURE_DOMAINS)) {
  assert(file.startsWith('test/'), 'Reader proofs cannot admit production source');
  assert(!Object.hasOwn(CONTINUOUS_CITY_SOURCE_DOMAINS, file), 'GUI and reader domains stay disjoint');
  const actual = lf(fs.readFileSync(file, 'utf8')), baseline = git('show', CONTINUOUS_CITY_FIXTURE_PREDECESSOR + ':' + file);
  assert.equal(git('ls-files', '--stage', '--', file).split(' ')[0], pin.currentMode);
  assert.equal(git('ls-tree', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file).split(' ')[0], pin.baselineMode);
  verify(file, pin, actual, baseline, qualifyContinuousCityFixtureSource,
    git('diff', '--no-ext-diff', '--unified=3', CONTINUOUS_CITY_FIXTURE_PREDECESSOR, '--', file));
  if (hasEnterpriseOverRootSource(file)) { assert.throws(() => enterpriseOverRootSourceBaseline(file, actual)); refusals++; }
}
for (const file of ['__proto__', 'constructor', 'toString', '../package.json', 'src/unknown.js', 'schema.sql.extra']) {
  for (const fn of [qualifyContinuousCitySource, qualifyContinuousCityFixtureSource]) { assert.throws(() => fn(file, 'unknown')); refusals++; }
  const raw = Buffer.from('unknown\r\nbytes\n'); assert.equal(continuousCityHistoricalInput(file, raw), raw);
}
// TEST-only catalogue normalization. Only the separately sealed initializer may vary; no native admission.
const COMBINED_NATIVE_REFERENCE = Object.freeze({"revision":"b8b9d514625d9dd9031bcc4dde05c32258c3898a","file":"tools/enterprise-native-inputs.js","mode":"100644","blob":"658d7d9c7df1233276b889b4161ce9eb1886f516","sha256":"e5f6e872591ec45678dbd0bf8305e4773487a38b8fef17baf68efac7baa8d6c7","bytes":390940});
const LEGACY_NATIVE_REFERENCE = Object.freeze({"revision":"3fd8f15280c5d14b4580d90706df2e93d42437a3","file":"tools/enterprise-native-inputs.js","mode":"100644","blob":"c73580084370d27d4776beb3d301d1c8d6a7514a","sha256":"0b48fd7ba46c4b39f1dec0b61148236fa6f2b174a13518e6ce21d66267075447","bytes":390371});
const COMBINED_NATIVE_APPEND = Object.freeze({"bytes":569,"sha256":"b5fb5478b4bb4ff1ec574bd70a0adac42521e4a35cc959e0e50e762a384021ea"});
const COMBINED_NATIVE_SUPPORT_PINS = Object.freeze([{"revision":"bfc3baf69d030771dceb59fec9c44ca9652660c3","file":"tools/enterprise-native.js","mode":"100644","blob":"fb7186cd9be309169d067ee344b5d7babb57e882","sha256":"f3e1a5a0505b2aec9a9f3639d4be6cffcd71b067bb22f6637eb34bd8d35c65f5","bytes":43727},{"revision":"59dbb6d99312fa44dba1fbec5bdf24948740e0dc","file":"tools/enterprise-native-continuous-city-inputs.js","mode":"100644","blob":"1af546bd54ac00f7dbc5db4d2c6e77ddefe1cf95","sha256":"804f29d96f31767fb3447dc61ed01ca243d9770357923ded125493bb19e71f58","bytes":16048}].map(Object.freeze));
const COMBINED_NATIVE_AUTHORED_REFERENCE = Object.freeze({"revision":"de10cc612a19edfcca6714a70489bf45a40c1f87","file":"tools/enterprise-native-inputs.js","mode":"100644","blob":"cf616ddf4255966738125cef58dfa2d2fff844af","sha256":"58504b77fb8ff2c479b27576c4eff380bb86662e48bb776ca59426deac8208de","bytes":407379});
function catalogueLF(input) {
  assert.equal(typeof input, 'string', 'Catalogue source must be complete text');
  const text = lf(input);
  assert(!text.includes('\r') && !text.includes('\0') && !text.startsWith('\ufeff')
    && (input === text || input === text.replaceAll('\n', '\r\n')), 'Uniform whole catalogue LF/CRLF only');
  assert(Buffer.byteLength(text) <= COMBINED_NATIVE_REFERENCE.bytes + 1024 * 1024, 'Bounded catalogue initializer');
  return text;
}
function combinedCatalogueInitializer(source) {
  const tree = parseCatalogueSource(source, {ecmaVersion:'latest', sourceType:'module'}), matches = [];
  for (const statement of tree.body) if (statement.type === 'ExportNamedDeclaration'
      && statement.declaration?.type === 'VariableDeclaration') {
    for (const declaration of statement.declaration.declarations) if (declaration.id.type === 'Identifier'
        && declaration.id.name === 'ENTERPRISE_NATIVE_COMMERCE_GUI_INPUTS') matches.push(declaration.init);
  }
  assert.equal(matches.length, 1, 'Exactly one known combined catalogue initializer');
  return matches[0];
}
function decodeCombinedCatalogueLiteral(root) {
  let count = 0;
  function decode(node, depth) {
    assert(node && depth <= 64 && ++count <= 50000, 'Bounded closed catalogue literal');
    if (node.type === 'Literal') {
      assert(node.value === null || ['string','boolean'].includes(typeof node.value)
        || (typeof node.value === 'number' && Number.isFinite(node.value)), 'JSON literal only');
      return node.value;
    }
    if (node.type === 'ArrayExpression') {
      assert(node.elements.every(Boolean), 'No holes in catalogue arrays');
      return Object.freeze(node.elements.map(value => decode(value, depth + 1)));
    }
    if (node.type === 'ObjectExpression') {
      const result = {};
      for (const property of node.properties) {
        assert(property.type === 'Property' && property.kind === 'init' && !property.computed
          && !property.method && !property.shorthand, 'Closed catalogue properties only');
        const key = property.key.type === 'Identifier' ? property.key.name : property.key.value;
        assert(typeof key === 'string' && !['__proto__','constructor','prototype'].includes(key)
          && !Object.hasOwn(result, key), 'Unique safe catalogue property');
        result[key] = decode(property.value, depth + 1);
      }
      return Object.freeze(result);
    }
    assert(node.type === 'CallExpression' && !node.optional && node.arguments.length === 1
      && node.callee.type === 'MemberExpression' && !node.callee.computed && !node.callee.optional
      && node.callee.object.type === 'Identifier' && node.callee.object.name === 'Object'
      && node.callee.property.type === 'Identifier' && node.callee.property.name === 'freeze',
      'Only Object.freeze of closed literal data; no evaluation');
    return decode(node.arguments[0], depth + 1);
  }
  return decode(root, 0);
}
function inspectCombinedCatalogueText(input, reference) {
  const text = catalogueLF(input), known = catalogueLF(reference);
  assert.equal(hash(known), COMBINED_NATIVE_REFERENCE.sha256);
  assert.equal(blob(known), COMBINED_NATIVE_REFERENCE.blob);
  const expected = combinedCatalogueInitializer(known), current = combinedCatalogueInitializer(text);
  const normalizedText = text.slice(0, current.start) + known.slice(expected.start, expected.end) + text.slice(current.end);
  assert.equal(normalizedText, known, 'All original five C exports and static combined append stay byte-exact');
  const manifest = decodeCombinedCatalogueLiteral(current);
  assert(manifest && ['UNSEALED','SEALED'].includes(manifest.status), 'Known catalogue state only');
  if (manifest.status === 'UNSEALED') assert.equal(text, known, 'UNSEALED initializer must remain the exact reviewed B form');
  return {normalizedText, manifest};
}
function readPinnedCatalogueReference(pin) {
  assert.equal(git('ls-tree', pin.revision, '--', pin.file).trim(), pin.mode + ' blob ' + pin.blob + '\t' + pin.file);
  const text = catalogueLF(git('show', pin.revision + ':' + pin.file));
  assert.equal(Buffer.byteLength(text), pin.bytes); assert.equal(hash(text), pin.sha256); assert.equal(blob(text), pin.blob);
  return text;
}
function assertCurrentCatalogueSupport(pin) {
  const directory = fs.lstatSync('tools'), physical = fs.lstatSync(pin.file);
  assert(directory.isDirectory() && !directory.isSymbolicLink(), 'Pinned support directory must be ordinary and not redirected');
  assert(physical.isFile() && !physical.isSymbolicLink(), 'Pinned support must be an ordinary non-symlink file');
  readPinnedCatalogueReference(pin);
  const text = catalogueLF(fs.readFileSync(pin.file, 'utf8'));
  assert.equal(git('ls-files', '--stage', '--', pin.file), pin.mode + ' ' + pin.blob + ' 0\t' + pin.file + '\n');
  assert.equal(Buffer.byteLength(text), pin.bytes); assert.equal(hash(text), pin.sha256); assert.equal(blob(text), pin.blob);
}
async function normalizeCombinedCatalogueForLegacyProof(input) {
  const reference = readPinnedCatalogueReference(COMBINED_NATIVE_REFERENCE);
  const inspected = inspectCombinedCatalogueText(input, reference), current = catalogueLF(input);
  assert.equal(git('ls-files', '--stage', '--', COMBINED_NATIVE_REFERENCE.file),
    '100644 ' + blob(current) + ' 0\t' + COMBINED_NATIVE_REFERENCE.file + '\n', 'Regular exact current catalogue index/body required');
  if (inspected.manifest.status === 'SEALED') {
    for (const pin of COMBINED_NATIVE_SUPPORT_PINS) assertCurrentCatalogueSupport(pin);
    assert.notEqual(path.resolve(process.argv[1] || '').toLowerCase(),
      fileURLToPath(new URL('../tools/enterprise-native.js', import.meta.url)).toLowerCase(), 'Pure validator import cannot invoke the native CLI');
    const {assertEnterpriseCombinedInputDefinition} = await import('../tools/enterprise-native.js');
    assertEnterpriseCombinedInputDefinition(inspected.manifest);
  }
  const legacy = readPinnedCatalogueReference(LEGACY_NATIVE_REFERENCE), append = reference.slice(legacy.length);
  assert.equal(reference.slice(0, legacy.length), legacy);
  assert.equal(Buffer.byteLength(append), COMBINED_NATIVE_APPEND.bytes); assert.equal(hash(append), COMBINED_NATIVE_APPEND.sha256);
  assert(inspected.normalizedText.endsWith(append), 'Exact known reviewed append only');
  const normalized = inspected.normalizedText.slice(0, inspected.normalizedText.length - append.length);
  assert.equal(normalized, legacy, 'Whole actual catalogue reconstructs the immutable A definition');
  return normalized;
}
// The authored catalogue is an immutable earlier seal. Only this TEST proof maps it to the fixed legacy reference.
// Actual current source capture still reads its complete bytes and requires the current native validator.
function authoredCombinedCatalogueLegacyProof() {
  assert.equal(CONTINUOUS_CITY_SOURCE_REVISION, COMBINED_NATIVE_AUTHORED_REFERENCE.revision,
    'One explicitly pinned authored source catalogue only');
  const authored = readPinnedCatalogueReference(COMBINED_NATIVE_AUTHORED_REFERENCE);
  assert.equal(git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + COMBINED_NATIVE_AUTHORED_REFERENCE.file), authored);
  const reference = readPinnedCatalogueReference(COMBINED_NATIVE_REFERENCE);
  assert.equal(inspectCombinedCatalogueText(authored, reference).normalizedText, reference,
    'Whole authored catalogue differs from the fixed reference only in its closed initializer');
  return readPinnedCatalogueReference(LEGACY_NATIVE_REFERENCE);
}
for (const file of ['tools/enterprise-current-source-compatibility.js', 'tools/enterprise-current-source-data.js', 'tools/enterprise-native-inputs.js']) {
  assert.equal(lf(file === 'tools/enterprise-native-inputs.js' ? await normalizeCombinedCatalogueForLegacyProof(fs.readFileSync(file, 'utf8')) : fs.readFileSync(file, 'utf8')),
    file === 'tools/enterprise-native-inputs.js'
      ? authoredCombinedCatalogueLegacyProof()
      : git('show', CONTINUOUS_CITY_SOURCE_REVISION + ':' + file), 'Predecessor guard/data is immutable: ' + file);
}
console.log(JSON.stringify({ phase: 'CONTINUOUS_CITY_EXACT_SOURCE_ONLY', source: CONTINUOUS_CITY_SOURCE_REVISION,
  predecessor: CONTINUOUS_CITY_SOURCE_PREDECESSOR, sourceFiles: 16, addedFiles: additions, fixtureReaders: 36,
  positives, refusals, inverseHunks, native: false, postgres: false, release: false }));
