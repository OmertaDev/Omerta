// Test/tool-only exact merged-source comparison. Reconstructed text is never executed.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const CITY_ACTIVITY_MARKET_SOURCE_REVISION = '3217dd945b5c5641ab0414630c58c1f97ef40ec1';
export const CITY_ACTIVITY_MARKET_SOURCE_PREDECESSOR = 'b6be98c7e0233c4b35a74467828e24080b16b0eb';
export const CITY_ACTIVITY_MARKET_SOURCE_PHASE = 'exact-two-file-source-comparison-only; no runtime, native, migration, financial, economic, deployment or onchain qualification';
export const CITY_ACTIVITY_MARKET_SOURCE_DOMAINS = Object.freeze(Object.fromEntries(Object.entries({
  "package.json": {
    "currentSha256": "a81009962454326c1c276c95101084f1a44c9d1ef3b7b8642f65478f7142ada2",
    "currentBlob": "d72e7efd8a0bca679a19588ab718ce8330633b07",
    "currentRawSha256": {
      "lf": "a81009962454326c1c276c95101084f1a44c9d1ef3b7b8642f65478f7142ada2",
      "crlf": "7fe1b97dbb21bf1c1a38cd1462ce4981cf309dae9109f7b8d504110c5f1441bf"
    },
    "baselineSha256": "d6d83610d52e7f7e4480e157f71ec06ea5c7e7673a1cdada8c749a713d01e3e7",
    "baselineBlob": "9f43c08b9da8740a6246cf37711cc723aecaa715"
  },
  "src/server.js": {
    "currentSha256": "a5fa8e95a82b34c9a8d1b144246eac958f58b4478172ae4bfa50e16f03265eab",
    "currentBlob": "081830f360fff504bb901a10eadb6dbd9c45ca6d",
    "currentRawSha256": {
      "lf": "a5fa8e95a82b34c9a8d1b144246eac958f58b4478172ae4bfa50e16f03265eab",
      "crlf": "1d62fc2332e9a3973073d01c3e6eade107e3a86db9162d370be5ccc2255734f7"
    },
    "baselineSha256": "ef3902b3b874d8cba6f7706a37764bd26da607cf4b41e1d35e1b4166d406a639",
    "baselineBlob": "9c3483649cd771bc5769b27a3d45fc5456e3598b"
  }
}).map(([file, pin]) => [file, Object.freeze({ ...pin, currentRawSha256: Object.freeze(pin.currentRawSha256) })])));
export const CITY_ACTIVITY_MARKET_SERVER_INVERSES = Object.freeze([
  [
    "import { makeDb } from './db.js';\nimport { createCityActivityRegistry, readCityActivityActor, cityOwnerActivityCategory } from './city-activity.js';\nimport { isDbDown, pingDb } from './dbhealth.js';\n",
    "import { makeDb } from './db.js';\nimport { isDbDown, pingDb } from './dbhealth.js';\n"
  ],
  [
    "  const pool = await makeDb();\n  app.decorate('pool', pool);\n  const cityActivity = createCityActivityRegistry();\n  const cityOwnerActivity = createCityActivityRegistry({ ownerOnly: true });\n  const cityActivityRequest = Symbol('cityActivityRequest');\n  const cityActivityReplay = Symbol('cityActivityReplay');\n",
    "  const pool = await makeDb();\n  app.decorate('pool', pool);\n"
  ],
  [
    "    // Capture before execution so a completed request cannot animate a successor.\n    const activityKey = `${req.method} ${req.routeOptions?.url || ''}`;\n    const activityHit = Object.hasOwn(ACTIVITY_WIRE, activityKey) ? ACTIVITY_WIRE[activityKey] : null;\n    if (activityHit || cityOwnerActivityCategory(activityKey)) {\n      try { req[cityActivityRequest] = await readCityActivityActor(pool, req.user.sub); }\n      catch { /* optional presentation never fails gameplay on a read failure */ }\n    }\n  };\n  // Mod endpoints (§10.3) authenticate with the MOD_KEY header, never a player JWT.\n",
    "  };\n  // Mod endpoints (§10.3) authenticate with the MOD_KEY header, never a player JWT.\n"
  ],
  [
    "  registerWorldGraph(app, { pool, auth });\n  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()],\n    activityRegistry: cityActivity, ownerActivityRegistry: cityOwnerActivity });\n  registerCityHomes(app, { pool, auth });\n",
    "  registerWorldGraph(app, { pool, auth });\n  registerCity(app, { pool, auth, onlineIds: () => [...wsClients.keys()] });\n  registerCityHomes(app, { pool, auth });\n"
  ],
  [
    "  app.addHook('onSend', async (req, reply, payload) => {\n    if (reply.statusCode < 200 || reply.statusCode >= 300 || !req.user?.sub || reply.getHeader('x-idempotent-replay')) return payload;\n    const key = `${req.method} ${req.routeOptions?.url || ''}`;\n    if (!Object.hasOwn(ACTIVITY_WIRE, key) && !cityOwnerActivityCategory(key)) return payload;\n    try {\n      // Domain receipts can reproject current private facts without an HTTP\n      // replay header. Trust only the serialized server response, never input.\n      const body = /\\bgzip\\b/i.test(String(reply.getHeader('content-encoding') || ''))\n        ? zlib.gunzipSync(payload).toString('utf8')\n        : (Buffer.isBuffer(payload) ? payload.toString('utf8') : String(payload));\n      reply[cityActivityReplay] = JSON.parse(body)?.replayed === true;\n    } catch { reply[cityActivityReplay] = true; /* undecodable responses produce no activity */ }\n    return payload;\n  });\n  app.addHook('onResponse', async (req, reply) => {\n    try {\n      if (reply.statusCode < 200 || reply.statusCode >= 300 || !req.user?.sub\n        || reply.getHeader('x-idempotent-replay') || reply[cityActivityReplay]) return;\n      const key = `${req.method} ${req.routeOptions?.url || ''}`;\n      const hit = Object.hasOwn(ACTIVITY_WIRE, key) ? ACTIVITY_WIRE[key] : null;\n      const ownerCategory = hit?.[0] || cityOwnerActivityCategory(key);\n      if (!ownerCategory) return;\n      const before = req[cityActivityRequest];\n      if (before) {\n        try {\n          const after = await readCityActivityActor(pool, req.user.sub);\n          cityOwnerActivity.record(before, after, ownerCategory, req.params?.district, req.headers['idempotency-key']);\n          if (hit) cityActivity.record(before, after, hit[0], req.params?.district);\n        } catch { /* district activity is disposable; keep the existing wire independent */ }\n      }\n      if (!hit) return;\n      const who = await actorName(req.user.sub);\n",
    "  app.addHook('onResponse', async (req, reply) => {\n    try {\n      if (reply.statusCode < 200 || reply.statusCode >= 300 || !req.user?.sub) return;\n      const key = `${req.method} ${req.routeOptions?.url || ''}`;\n      const hit = ACTIVITY_WIRE[key];\n      if (!hit) return;\n      const who = await actorName(req.user.sub);\n"
  ]
].map(pair => Object.freeze(pair)));
export const CITY_ACTIVITY_MARKET_PACKAGE_INVERSES = Object.freeze([
  {
    "key": "test",
    "currentLineSha256": "36f6ef65955ce230b2a9d463572bd2b4af9d9f772c3944cc67bdf22849613634",
    "priorLineSha256": "2a84fd251a51fb92016da66991d572ced4833e4a589141c530d20bf49d1813da",
    "current": "node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js",
    "prior": "node test/city-presence-api.js && node test/city-social-api.js"
  },
  {
    "key": "test:city",
    "currentLineSha256": "1bfdedd2125a948f236c0bec6440bfeea72ce81a5bdf7d5ad74bd4589f61c87a",
    "priorLineSha256": "ea688d0c2691c8b50ff4909923775d9d2933d40ef781acb279348b0813969668",
    "current": "node test/city-presence-api.js && node test/city-activity.js && node test/city-social-api.js",
    "prior": "node test/city-presence-api.js && node test/city-social-api.js"
  },
  {
    "key": "test:city:browser",
    "currentLineSha256": "f39f397c5a94e1979514bb867bbf59dcb39f655e336792a3fab3769314c7eb0b",
    "priorLineSha256": "d6386bd2e16b9717bb3ffc540a9319b48c1fc10dc2ee1d0f4c92bd41796f59b6",
    "current": "node test/city-scene-browser.js && node test/city-activity-browser.js && node test/city-dashboard-host-browser.js && node test/world-fieldwork-browser.js",
    "prior": "node test/city-scene-browser.js && node test/world-fieldwork-browser.js"
  }
].map(spec => Object.freeze(spec)));

const root = fileURLToPath(new URL('../', import.meta.url));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const normalize = input => {
  const text = String(input);
  assert(!/\r(?!\n)/.test(text) && !(text.includes('\r\n') && /(?<!\r)\n/.test(text)),
    'City activity market source changed: mixed or bare-CR line endings');
  return text.replaceAll('\r\n', '\n');
};
const bindings = new Map();
function immutableBinding(revision, file, sha256, object) {
  const key = revision + ':' + file;
  if (!bindings.has(key)) {
    const read = spec => execFileSync('git', ['cat-file', 'blob', spec], { cwd: root, encoding: 'utf8', maxBuffer: 4 * 1024 * 1024 });
    const text = read(key);
    assert.equal(text, read(object), 'City activity market immutable Git binding changed');
    assert.equal(hash(text), sha256, 'City activity market immutable source changed');
    assert.equal(blob(text), object, 'City activity market immutable blob changed');
    bindings.set(key, text);
  }
  return bindings.get(key);
}
export function qualifyCityActivityMarketSource(file, input) {
  assert(Object.hasOwn(CITY_ACTIVITY_MARKET_SOURCE_DOMAINS, file), 'City activity market source domain is closed');
  const pin = CITY_ACTIVITY_MARKET_SOURCE_DOMAINS[file], raw = String(input), text = normalize(raw);
  assert.equal(hash(text), pin.currentSha256, 'City activity market source changed');
  assert.equal(blob(text), pin.currentBlob, 'City activity market source blob changed');
  assert.equal(hash(raw), pin.currentRawSha256[raw.includes('\r\n') ? 'crlf' : 'lf'], 'City activity market raw source changed');
  assert.equal(text, immutableBinding(CITY_ACTIVITY_MARKET_SOURCE_REVISION, file, pin.currentSha256, pin.currentBlob),
    'City activity market complete current bytes changed');
  let baselineText = text, inverseChunks = 0;
  if (file === 'src/server.js') {
    for (const [current, prior] of CITY_ACTIVITY_MARKET_SERVER_INVERSES) {
      assert.equal(baselineText.split(current).length, 2, 'City activity market inverse must occur exactly once');
      baselineText = baselineText.replace(current, () => prior);
      inverseChunks++;
    }
  } else {
    for (const spec of CITY_ACTIVITY_MARKET_PACKAGE_INVERSES) {
      const prefix = '    ' + JSON.stringify(spec.key) + ': ';
      const lines = baselineText.split('\n').filter(line => line.startsWith(prefix));
      assert.equal(lines.length, 1, 'City activity market script key must occur exactly once');
      const current = lines[0];
      assert.equal(hash(current), spec.currentLineSha256, 'City activity market complete script entry changed');
      assert.equal(current.split(spec.current).length, 2, 'City activity market script inverse must occur exactly once');
      const prior = current.replace(spec.current, () => spec.prior);
      assert.equal(hash(prior), spec.priorLineSha256, 'City activity market prior script entry changed');
      baselineText = baselineText.replace(current, () => prior);
      inverseChunks++;
    }
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'City activity market predecessor reconstruction changed');
  assert.equal(blob(baselineText), pin.baselineBlob, 'City activity market predecessor reconstruction blob changed');
  assert.equal(baselineText, immutableBinding(CITY_ACTIVITY_MARKET_SOURCE_PREDECESSOR, file, pin.baselineSha256, pin.baselineBlob),
    'City activity market complete predecessor bytes changed');
  return { actualSha256: hash(text), rawSha256: hash(raw), sourceBlob: blob(text), baselineSha256: hash(baselineText),
    predecessorBlob: pin.baselineBlob, predecessorRevision: CITY_ACTIVITY_MARKET_SOURCE_PREDECESSOR,
    sourceRevision: CITY_ACTIVITY_MARKET_SOURCE_REVISION, phase: CITY_ACTIVITY_MARKET_SOURCE_PHASE,
    sourceOnly: true, inverseChunks, baselineText };
}
export function cityActivityMarketSourceBaseline(file, input) {
  if (!Object.hasOwn(CITY_ACTIVITY_MARKET_SOURCE_DOMAINS, file)) return input;
  const text = normalize(input);
  return hash(text) === CITY_ACTIVITY_MARKET_SOURCE_DOMAINS[file].currentSha256
    ? qualifyCityActivityMarketSource(file, input).baselineText : input;
}
