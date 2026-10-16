// Test/tool-only source comparison. Reconstructed text is never executed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const normalize = input => {
  const text = String(input);
  assert(!/\r(?!\n)/.test(text) && !(text.includes('\r\n') && /(?<!\r)\n/.test(text)),
    'City activity source changed: mixed or bare-CR line endings');
  return text.replaceAll('\r\n', '\n');
};
export const CITY_ACTIVITY_SOURCE_TRANSFER = Object.freeze({
  file: 'src/server.js',
  actualServerSha256: 'c208ba209099eed9e1de654bd81b3bd5f24ce55ab64af4b2b860d9d30ad2fde7',
  actualServerBlob: '9a20ce92ec08499ad58a1f3227cfda6fe66f3642',
  actualRawServerSha256: Object.freeze({
    lf: 'c208ba209099eed9e1de654bd81b3bd5f24ce55ab64af4b2b860d9d30ad2fde7',
    crlf: '6ba1c75d12d1cce1f5127dcac2e197439faef1d82292460598d55ef61d330ffd',
  }),
  predecessorRevision: 'f89df180aa54e71cb17431d5324d3d9344ca7de0',
  predecessorServerSha256: '7647459f9c99c23c224e22439a9d79fe4f4e608eb91622e840d538308ce01419',
  predecessorServerBlob: '06baca87fc653ce4c3fc03326b1a89e2b7aa6cea',
  inverseChunks: 5,
  scope: 'Exact server envelope comparison only. New City activity, privacy, replay, owner projection and new-module behavior require separate current-source proofs; no historical execution, world-soak, native, financial, economic, deployment or onchain qualification is inherited.',
});
export const CITY_ACTIVITY_PACKAGE_SOURCE_TRANSFER = Object.freeze({
  file: 'package.json',
  actualSha256: '3d4005905e2ebb374e02be9f6ce70026110c4bfb2ec5f385a6c864b9844b508a',
  actualBlob: '73d18260ce840f7ae6fa19072d1da86c7ab18091',
  actualRawSha256: Object.freeze({
    lf: '3d4005905e2ebb374e02be9f6ce70026110c4bfb2ec5f385a6c864b9844b508a',
    crlf: '65cdc8a180f42798e94b712e3808d13d4e01d30dd66b137e9849670f9fd61f16',
  }),
  predecessorRevision: 'f89df180aa54e71cb17431d5324d3d9344ca7de0',
  predecessorSha256: '267a95d8f4178a850e61000f91349f71c93e3ea503b4d759dee61e361174b08a',
  predecessorBlob: 'de048eb000416b391b7ea17f89c72907c637c381',
  inverseChunks: 3,
  scope: 'Exact test-script registration comparison only; reconstructed package source is never executed and no test result, runtime, native, financial or deployment qualification is inherited.',
});
export const CITY_ACTIVITY_PACKAGE_SOURCE_INVERSES = Object.freeze([
  { key: 'test',
    currentLineSha256: '36f6ef65955ce230b2a9d463572bd2b4af9d9f772c3944cc67bdf22849613634',
    priorLineSha256: '2a84fd251a51fb92016da66991d572ced4833e4a589141c530d20bf49d1813da',
    current: 'node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js',
    prior: 'node test/city-presence-api.js && node test/city-social-api.js' },
  { key: 'test:city',
    currentLineSha256: '1bfdedd2125a948f236c0bec6440bfeea72ce81a5bdf7d5ad74bd4589f61c87a',
    priorLineSha256: 'ea688d0c2691c8b50ff4909923775d9d2933d40ef781acb279348b0813969668',
    current: 'node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js',
    prior: 'node test/city-presence-api.js && node test/city-social-api.js' },
  { key: 'test:city:browser',
    currentLineSha256: 'f39f397c5a94e1979514bb867bbf59dcb39f655e336792a3fab3769314c7eb0b',
    priorLineSha256: 'd6386bd2e16b9717bb3ffc540a9319b48c1fc10dc2ee1d0f4c92bd41796f59b6',
    current: 'node test/city-scene-browser.js && node test/city-activity-browser.js && node test/city-dashboard-host-browser.js && node test/world-fieldwork-browser.js',
    prior: 'node test/city-scene-browser.js && node test/world-fieldwork-browser.js' },
].map(spec => Object.freeze(spec)));
export const CITY_ACTIVITY_SOURCE_INVERSES = Object.freeze([
  [
    "import { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\nimport { isDbDown, pingDb } from './dbhealth.js';\n",
    "import { makeDb } from './db.js';\nimport { isDbDown, pingDb } from './dbhealth.js';\n",
  ],
  [
    "  const pool = await makeDb();\n  app.decorate('pool', pool);\n  const cityActivity = createCityActivityRegistry();\n  const cityOwnerActivity = createCityActivityRegistry({ ownerOnly: true });\n  const cityActivityRequest = Symbol('cityActivityRequest');\n  const cityActivityReplay = Symbol('cityActivityReplay');\n",
    "  const pool = await makeDb();\n  app.decorate('pool', pool);\n",
  ],
  [
    "    // Capture before execution so a completed request cannot animate a successor.\n    const activityKey = `${req.method} ${req.routeOptions?.url || ''}`;\n    const activityHit = Object.hasOwn(ACTIVITY_WIRE, activityKey) ? ACTIVITY_WIRE[activityKey] : null;\n    if (activityHit || cityOwnerActivityCategory(activityKey)) {\n      try { req[cityActivityRequest] = await readCityActivityActor(pool, req.user.sub); }\n      catch { /* optional presentation never fails gameplay on a read failure */ }\n    }\n  };\n  // Mod endpoints (§10.3) authenticate with the MOD_KEY header, never a player JWT.\n",
    "  };\n  // Mod endpoints (§10.3) authenticate with the MOD_KEY header, never a player JWT.\n",
  ],
  [
    "  registerWorldGraph(app, { pool, auth });\n  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()],\n    activityRegistry: cityActivity, ownerActivityRegistry: cityOwnerActivity });\n  registerCityHomes(app, { pool, auth });\n",
    "  registerWorldGraph(app, { pool, auth });\n  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()] });\n  registerCityHomes(app, { pool, auth });\n",
  ],
  [
    "  app.addHook('onSend', async (req, reply, payload) => {\n    if (reply.statusCode < 200 || reply.statusCode >= 300 || !req.user?.sub || reply.getHeader('x-idempotent-replay')) return payload;\n    const key = `${req.method} ${req.routeOptions?.url || ''}`;\n    if (!Object.hasOwn(ACTIVITY_WIRE, key) && !cityOwnerActivityCategory(key)) return payload;\n    try {\n      // Domain receipts can reproject current private facts without an HTTP\n      // replay header. Trust only the serialized server response, never input.\n      const body = /\\bgzip\\b/i.test(String(reply.getHeader('content-encoding') || ''))\n        ? zlib.gunzipSync(payload).toString('utf8')\n        : (Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));\n      reply[cityActivityReplay] = JSON.parse(body)?.replayed === true;\n    } catch { reply[cityActivityReplay] = true; /* undecodable responses produce no activity */ }\n    return payload;\n  });\n  app.addHook('onResponse', async (req, reply) => {\n    try {\n      if (reply.statusCode < 200 || reply.statusCode >= 300 || !req.user?.sub\n        || reply.getHeader('x-idempotent-replay') || reply[cityActivityReplay]) return;\n      const key = `${req.method} ${req.routeOptions?.url || ''}`;\n      const hit = Object.hasOwn(ACTIVITY_WIRE, key) ? ACTIVITY_WIRE[key] : null;\n      const ownerCategory = hit?.[0] || cityOwnerActivityCategory(key);\n      if (!ownerCategory) return;\n      const before = req[cityActivityRequest];\n      if (before) {\n        try {\n          const after = await readCityActivityActor(pool, req.user.sub);\n          cityOwnerActivity.record(before, after, ownerCategory, req.params?.district, req.headers['idempotency-key']);\n          if (hit) cityActivity.record(before, after, hit[0], req.params?.district);\n        } catch { /* district activity is disposable; keep the existing wire independent */ }\n      }\n      if (!hit) return;\n      const who = await actorName(req.user.sub);\n",
    "  app.addHook('onResponse', async (req, reply) => {\n    try {\n      if (reply.statusCode < 200 || reply.statusCode >= 300 || !req.user?.sub) return;\n      const key = `${req.method} ${req.routeOptions?.url || ''}`;\n      const hit = ACTIVITY_WIRE[key];\n      if (!hit) return;\n      const who = await actorName(req.user.sub);\n",
  ],
].map(pair => Object.freeze(pair)));

let predecessor;
function immutablePredecessor() {
  if (predecessor) return predecessor;
  const transfer = CITY_ACTIVITY_SOURCE_TRANSFER;
  const read = spec => execFileSync('git', ['cat-file', 'blob', spec], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
  const text = read(transfer.predecessorRevision + ':' + transfer.file);
  assert.equal(text, read(transfer.predecessorServerBlob), 'City activity predecessor Git binding changed');
  assert.equal(hash(text), transfer.predecessorServerSha256, 'City activity predecessor source changed');
  assert.equal(blob(text), transfer.predecessorServerBlob, 'City activity predecessor blob changed');
  predecessor = text;
  return text;
}

export function qualifyCityActivitySource(input) {
  const raw = String(input), text = normalize(raw), transfer = CITY_ACTIVITY_SOURCE_TRANSFER;
  assert.equal(hash(text), transfer.actualServerSha256, 'City activity source changed');
  assert.equal(blob(text), transfer.actualServerBlob, 'City activity source blob changed');
  assert.equal(hash(raw), transfer.actualRawServerSha256[raw.includes('\r\n') ? 'crlf' : 'lf'], 'City activity raw source changed');
  let baselineText = text;
  for (const [current, prior] of CITY_ACTIVITY_SOURCE_INVERSES) {
    assert.equal(baselineText.split(current).length, 2, 'City activity inverse must occur exactly once');
    baselineText = baselineText.replace(current, prior);
  }
  assert.equal(hash(baselineText), transfer.predecessorServerSha256, 'City activity predecessor reconstruction changed');
  assert.equal(blob(baselineText), transfer.predecessorServerBlob, 'City activity predecessor reconstruction blob changed');
  assert.equal(baselineText, immutablePredecessor(), 'City activity complete predecessor bytes changed');
  return { actualSha256: hash(text), rawSha256: hash(raw), sourceBlob: blob(text),
    baselineSha256: hash(baselineText), predecessorRevision: transfer.predecessorRevision,
    predecessorServerBlob: transfer.predecessorServerBlob, inverseChunks: CITY_ACTIVITY_SOURCE_INVERSES.length, baselineText };
}

export function cityActivitySourceBaseline(file, input) {
  if (file === CITY_ACTIVITY_PACKAGE_SOURCE_TRANSFER.file) {
    const text = normalize(input);
    return hash(text) === CITY_ACTIVITY_PACKAGE_SOURCE_TRANSFER.actualSha256
      ? qualifyCityActivityPackageSource(input).baselineText : input;
  }
  if (file !== CITY_ACTIVITY_SOURCE_TRANSFER.file) return input;
  const text = normalize(input);
  return hash(text) === CITY_ACTIVITY_SOURCE_TRANSFER.actualServerSha256
    ? qualifyCityActivitySource(input).baselineText : input;
}

let packagePredecessor;
export function qualifyCityActivityPackageSource(input) {
  const raw = String(input), text = normalize(raw), transfer = CITY_ACTIVITY_PACKAGE_SOURCE_TRANSFER;
  assert.equal(hash(text), transfer.actualSha256, 'City activity package source changed');
  assert.equal(blob(text), transfer.actualBlob, 'City activity package source blob changed');
  assert.equal(hash(raw), transfer.actualRawSha256[raw.includes('\r\n') ? 'crlf' : 'lf'], 'City activity raw package source changed');
  let baselineText = text;
  for (const spec of CITY_ACTIVITY_PACKAGE_SOURCE_INVERSES) {
    const prefix = '    ' + JSON.stringify(spec.key) + ': ';
    const lines = baselineText.split('\n').filter(line => line.startsWith(prefix));
    assert.equal(lines.length, 1, 'City activity script key must occur exactly once');
    const current = lines[0];
    assert.equal(hash(current), spec.currentLineSha256, 'City activity complete script entry changed');
    assert.equal(current.split(spec.current).length, 2, 'City activity script inverse must occur exactly once');
    const prior = current.replace(spec.current, spec.prior);
    assert.equal(hash(prior), spec.priorLineSha256, 'City activity predecessor script entry changed');
    baselineText = baselineText.replace(current, prior);
  }
  assert.equal(hash(baselineText), transfer.predecessorSha256, 'City activity package predecessor reconstruction changed');
  assert.equal(blob(baselineText), transfer.predecessorBlob, 'City activity package predecessor blob changed');
  if (!packagePredecessor) {
    const read = spec => execFileSync('git', ['cat-file', 'blob', spec], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const prior = read(transfer.predecessorRevision + ':' + transfer.file);
    assert.equal(prior, read(transfer.predecessorBlob), 'City activity package predecessor Git binding changed');
    assert.equal(hash(prior), transfer.predecessorSha256, 'City activity immutable package source changed');
    assert.equal(blob(prior), transfer.predecessorBlob, 'City activity immutable package blob changed');
    packagePredecessor = prior;
  }
  assert.equal(baselineText, packagePredecessor, 'City activity complete package predecessor bytes changed');
  return { actualSha256: hash(text), rawSha256: hash(raw), sourceBlob: blob(text), baselineSha256: hash(baselineText),
    predecessorRevision: transfer.predecessorRevision, predecessorBlob: transfer.predecessorBlob,
    inverseChunks: CITY_ACTIVITY_PACKAGE_SOURCE_INVERSES.length, baselineText };
}
