import {hasFinalServicesCommerceSource,finalServicesOverCommerceSourceBaseline} from '../../tools/finalservices-commerce-source-compatibility.js';
const selectFinalServicesCommerceTestSource=(file,input)=>hasFinalServicesCommerceSource(file)?finalServicesOverCommerceSourceBaseline(file,String(input)):input;
import {hasCommerceCurrentEnterpriseSource,commerceOverCurrentEnterpriseSourceBaseline} from "../../tools/commerce-current-enterprise-source-compatibility.js";
import {enterpriseOverGuiSourceBaseline} from '../../tools/enterprise-current-source-compatibility.js';
// Closed pure-control fixtures. Historical source execution never admits the current release.
import {enterpriseOverRootSourceBaseline,ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES} from '../../tools/enterprise-current-source-compatibility.js';
import { economyReleaseSource } from '../../tools/economy-release-composition.js';
import { fourthBatchSourceBaseline } from '../../tools/rc1-fourth-batch-source-compatibility.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import tls from 'node:tls';
import dgram from 'node:dgram';
import dns from 'node:dns';
import { execFileSync, spawnSync } from 'node:child_process';
import { createRequire, registerHooks, syncBuiltinESMExports } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { cityPlaySourceBaseline } from '../../tools/city-play-source-transfer.js';
import { assertDeedQuestSourceTransfer, DEED_QUEST_SOURCE_DOMAINS } from '../../tools/deed-quest-source-transfer.js';
import { CITY_ACTIVITY_SOURCE_INVERSES, CITY_ACTIVITY_SOURCE_TRANSFER, cityActivitySourceBaseline,
  qualifyCityActivitySource } from '../../tools/rc1-city-activity-source-compatibility.js';
import { qualifyCityActivityMarketSource } from '../../tools/rc1-city-activity-market-source-compatibility.js';
import { marketOverDeedSourceBaseline } from '../../tools/deed-market-source-compatibility.js';

export const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';
const releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';
const treePins = Object.freeze({
  historical: { src: 'cdedb35ef954d65542a0d868aeab0a4dcaa4a9c0', data: 'fb65393d36a7dc7375078dc6abe417653b4e73bb' },
  release: { src: '8865ac9d3cc8b1f99fe5782bae292f2b5ad5e13c', data: 'b5fa73b743fde33f0dece71116781e193f168f76' },
});
// Only these exact reviewed composition helpers bridge to immutable b12 tool bodies.
// Historical controls never execute the newer source-normalization dependency graph.
const composedHistoricalHelperPins = Object.freeze({
  "tools/rc1-first-batch-source-compatibility.js": Object.freeze({"sha256":"41ca8a1a01a1d1d456d0f19643e8634bdf5d6169b4d9acd91e391ca714c7b258","blob":"562619d11db7f42397d577fc247695dc6b12b2e3"}),
  "tools/rc1-second-batch-source-compatibility.js": Object.freeze({"sha256":"e8a81539af29d3f1c7662141bb32c61b211881ee954f900bf7bb03e173d5d2f8","blob":"8fda1bc4a43c0ce906a3e0b48986963e9eaba026"}),
  "tools/rc1-third-batch-source-compatibility.js": Object.freeze({"sha256":"a2040f0c71187914b91c10826a026ba6ba2cc669bbe10d07b554966ce6daad47","blob":"e46e3056591d37bf611727f834f06a4f603764e8"}),
  "tools/release-source-transfer.js": Object.freeze({"sha256":"7024f1267fc392189111beb9cf1fa328490f81ae227fd7fe17fc2c030f3facef","blob":"7a74deb2e809c3ab2c70a962f1efc4f2c0547a29"}),
});
// The already-admitted qualification tool keeps its exact b12 evaluated body.
// These three source-only inverses do not admit its newer dependency graph.
const cityActivityWorldHelper = Object.freeze({
  file: 'tools/rc1-world-qualification.js',
  currentSha256: 'e677b7080fd37428d211254f5f042b7b0e0a9f18ed052bbb86da446a4a45f8d9',
  currentBlob: '6a81639df0d4fae11be126f574197a8e924d426e',
  predecessorRevision: 'f89df180aa54e71cb17431d5324d3d9344ca7de0',
  predecessorSha256: '97168b579fb5b864e787045e7c9d88066c79b0c8fe54dfb35a68305560d5f4a1',
  predecessorBlob: '0b63c8dd253b92954cfe6a7bcd285cba4496c19f',
  inverses: Object.freeze([
    [
      "import { cityGameplaySourceBaseline } from './rc1-city-gameplay-source-compatibility.js';\nimport { CITY_ACTIVITY_SOURCE_TRANSFER, cityActivitySourceBaseline } from './rc1-city-activity-source-compatibility.js';\nimport { playerIntelSourceBaseline } from './player-intel-source-compatibility.js';\n",
      "import { cityGameplaySourceBaseline } from './rc1-city-gameplay-source-compatibility.js';\nimport { playerIntelSourceBaseline } from './player-intel-source-compatibility.js';\n",
    ],
    [
      "export const WORLD_RECOVERY_REVIEW = Object.freeze({ version: 34, reviewedRevision: GENESIS_SNAPSHOT_REVIEWED_REVISION, sourceFiles,\n  cityActivitySourceReviewTransfer: CITY_ACTIVITY_SOURCE_TRANSFER,\n  businessSeasonSourceReviewTransfer: BUSINESS_SEASON_SOURCE_TRANSFER,\n",
      "export const WORLD_RECOVERY_REVIEW = Object.freeze({ version: 33, reviewedRevision: GENESIS_SNAPSHOT_REVIEWED_REVISION, sourceFiles,\n  businessSeasonSourceReviewTransfer: BUSINESS_SEASON_SOURCE_TRANSFER,\n",
    ],
    [
      "  for (const [file, expected] of Object.entries(sourceFiles)) {\n    const raw = companyOperatorSourceBaseline(file, playerIntelSourceBaseline(file, cityGameplaySourceBaseline(file, cityActivitySourceBaseline(file, String(await readFile(file))))));\n    const homeBaseline = file === 'src/server.js' && sha256(raw) === CITY_HOMES_LEAGUE_SERVER_PIN\n",
      "  for (const [file, expected] of Object.entries(sourceFiles)) {\n    const raw = companyOperatorSourceBaseline(file, playerIntelSourceBaseline(file, cityGameplaySourceBaseline(file, String(await readFile(file)))));\n    const homeBaseline = file === 'src/server.js' && sha256(raw) === CITY_HOMES_LEAGUE_SERVER_PIN\n",
    ],
  ].map(pair => Object.freeze(pair))),
});
const npcEntries = new Set([
  'test/rc1-npc-retirement-journal.js', 'test/rc1-car-melt-provenance.js',
  'test/rc1-world-car-melt-witness.js', 'test/rc1-npc-car-acquisition.js',
  'test/rc1-npc-boat-journal.js', 'test/rc1-npc-market-order-journal.js',
  'test/rc1-npc-provenance-composition.js',
]);
const entries = new Set([...npcEntries, 'test/rc1-lifecycle-applicability.js',
  'test/rc1-checkpoint-recovery-review.js', 'test/rc1-world-backlog-review.js']);
const root = fileURLToPath(new URL('../../', import.meta.url));
const helperPath = fileURLToPath(import.meta.url);
const childFlag = '--rc1-historical-source-fixture';
const originalRead = fs.readFileSync;
const originalPromiseRead = fs.promises.readFile;
const git = args => execFileSync('git', args, { cwd: root, maxBuffer: 8 * 1024 * 1024 });
const sha256 = value => crypto.createHash('sha256').update(value).digest('hex');
const blobHash = bytes => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const canonical = value => String(value).replaceAll('\r\n', '\n');
const relative = candidate => {
  if (!(typeof candidate === 'string' || candidate instanceof URL || Buffer.isBuffer(candidate))) return null;
  let value = candidate instanceof URL ? fileURLToPath(candidate) : String(candidate);
  if (value.startsWith('file:')) value = fileURLToPath(new URL(value));
  return path.relative(root, path.resolve(value)).replaceAll('\\', '/');
};
const target = relative(process.argv[1]);
const cold = process.argv[2] === childFlag;
let hook, active = false, history, release;
const attempts = { database: 0, network: 0 };
const content = new Map(), checked = new Set();

function inventory(revision, pins) {
  for (const [name, pin] of Object.entries(pins))
    assert.equal(String(git(['rev-parse', `${revision}:${name}`])).trim(), pin, 'Historical fixture tree binding changed');
  const result = new Map();
  for (const entry of String(git(['ls-tree', '-rz', '--full-tree', revision, '--', 'src', 'data', 'tools', 'schema.sql'])).split('\0')) {
    if (!entry) continue;
    const match = /^100(?:644|755) blob ([a-f0-9]{40})\t(.+)$/.exec(entry);
    assert(match, 'Unsupported historical fixture tree entry');
    result.set(match[2], match[1]);
  }
  return result;
}
function loadInventories() {
  history ??= inventory(HISTORICAL_SOURCE_FIXTURE_REVISION, treePins.historical);
  release ??= inventory(releaseRevision, treePins.release);
}
function blob(file, sources) {
  const id = sources.get(file);
  assert(id, 'Unknown historical fixture dependency: ' + file);
  if (!content.has(id)) {
    const bytes = git(['cat-file', 'blob', id]);
    assert.equal(blobHash(bytes), id, 'Historical fixture complete Git blob changed');
    assert.equal(canonical(bytes), String(bytes), 'Historical fixture Git bytes must be LF');
    content.set(id, bytes);
  }
  return content.get(id);
}
function uniformHistoricalInput(file, input) {
  const raw = String(input);
  assert(!/\r(?!\n)/.test(raw) && (!raw.includes('\r\n') || !/(?<!\r)\n/.test(raw)),
    'Reviewed tool source must have uniform line endings: ' + file);
  return raw;
}
function composedHistoricalHelperSource(file, input) {
  const raw = uniformHistoricalInput(file, input), pin = composedHistoricalHelperPins[file];
  const current = canonical(raw);
  if (file === cityActivityWorldHelper.file) return cityActivityWorldHelperSource(file, raw);
  if (!pin) return null;
  let reviewed = current;
  if (file === 'tools/release-source-transfer.js' && sha256(current) !== pin.sha256
    && sha256(current) !== sha256(blob(file, release))) {
    // This exact current wrapper is provenance only. Neither it nor its witness executes.
    reviewed = assertDeedQuestSourceTransfer(file, raw).baselineText;
  }
  if (sha256(reviewed) === pin.sha256) {
    assert.equal(blobHash(Buffer.from(reviewed)), pin.blob, 'Reviewed composed helper blob changed');
    return blob(file, release);
  }
  assert.equal(sha256(current), sha256(blob(file, release)), 'Reviewed tool implementation changed: ' + file);
  return null;
}
function cityActivityWorldHelperSource(file, input) {
  const spec = cityActivityWorldHelper;
  assert.equal(file, spec.file, 'City activity qualification helper domain changed');
  const current = canonical(uniformHistoricalInput(file, input)), frozen = blob(file, release);
  assert.equal(release.get(file), spec.predecessorBlob, 'Frozen qualification helper blob changed');
  assert.equal(sha256(frozen), spec.predecessorSha256, 'Frozen qualification helper source changed');
  assert.equal(String(frozen), String(git(['cat-file', 'blob', spec.predecessorRevision + ':' + file])),
    'Qualification helper immutable predecessor bytes changed');
  if (sha256(current) === spec.predecessorSha256) return null;
  assert.equal(sha256(current), spec.currentSha256, 'Reviewed qualification helper source changed');
  assert.equal(blobHash(Buffer.from(current)), spec.currentBlob, 'Reviewed qualification helper blob changed');
  let prior = current;
  for (const [added, previous] of spec.inverses) {
    assert.equal(prior.split(added).length, 2, 'Qualification helper inverse must occur exactly once');
    prior = prior.replace(added, previous);
  }
  assert.equal(prior, String(frozen), 'Complete frozen qualification helper bytes changed');
  assert.equal(blobHash(Buffer.from(prior)), spec.predecessorBlob, 'Qualification helper reconstructed blob changed');
  return frozen;
}
function historicalApplicationSource(file, input) {
  assert(file.startsWith('src/') || file.startsWith('data/') || file === 'schema.sql',
    'Historical application provenance excludes tool and test domains');
  const expected = blob(file, release), domain = DEED_QUEST_SOURCE_DOMAINS[file];
  let witness = marketOverDeedSourceBaseline(file, cityActivitySourceBaseline(file, String(input)));
  if (domain) {
    const raw = uniformHistoricalInput(file, witness);
    if (sha256(canonical(raw)) === domain.currentSha256)
      witness = assertDeedQuestSourceTransfer(file, raw).baselineText;
  }
  // Exact outer provenance comes first; only independently pinned historical bodies execute.
  let reviewed = economyReleaseSource('main', file, cityPlaySourceBaseline(file, witness));
  if (sha256(canonical(reviewed)) !== sha256(expected)) reviewed = fourthBatchSourceBaseline(file, reviewed);
  assert.equal(sha256(canonical(reviewed)), sha256(expected), 'Current release input changed outside historical fixture: ' + file);
  assert.equal(blobHash(Buffer.from(canonical(reviewed))), release.get(file), 'Current release input blob changed outside historical fixture: ' + file);
  return blob(file, history);
}

function currentHistoricalApplicationSource(file,input){
  const p=Object.hasOwn(ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS,file)?ENTERPRISE_OVER_ROOT_SOURCE_DOMAINS[file]:Object.hasOwn(ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES,file)?ENTERPRISE_OVER_ROOT_IDENTITY_SOURCES[file]:null;
  // Only exact declared current bytes take the new layer; every other input still faces the unchanged full Root historical-body guards.
  if(p&&typeof input==='string'&&sha256(canonical(input))===p.currentSha256)return historicalApplicationSource(file,enterpriseOverRootSourceBaseline(file,input));
  return historicalApplicationSource(file,input);
}

function historical(file) {
  loadInventories();
  if (!checked.has(file)) {
    const actualCurrentRaw = String(selectFinalServicesCommerceTestSource(file,originalRead(path.join(root, file))));
    const selected = currentHistoricalApplicationSource(file, hasCommerceCurrentEnterpriseSource(file) ? commerceOverCurrentEnterpriseSourceBaseline(file, actualCurrentRaw) : actualCurrentRaw);
    checked.add(file);
    return selected;
  }
  return blob(file, history);
}
function fixtureRead(candidate, options) {
  const file = relative(candidate);
  if (!file?.startsWith('src/') && !file?.startsWith('data/') && file !== 'schema.sql') return originalRead(candidate, options);
  const bytes = historical(file);
  const encoding = typeof options === 'string' ? options : options?.encoding;
  return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
}

export function isHistoricalSourceFixture() { return cold; }

export function runHistoricalSourceFixture(entryUrl) {
  const entry = relative(entryUrl);
  assert(entries.has(entry), 'Unsupported historical fixture entry');
  assert(!cold, 'Historical fixture child must execute its existing control body');
  assert.equal(process.argv.length, 2, 'Historical fixture forbids native, retained or other arguments');
  assert.equal(target, entry, 'Historical fixture entry must be the direct test');
  if (npcEntries.has(entry)) {
    const refusal = spawnSync(process.execPath, [helperPath, '--npc-rule-rejections'], { cwd: root, stdio: 'inherit' });
    assert.ifError(refusal.error); assert.equal(refusal.signal, null); assert.equal(refusal.status, 0, 'Current rule rejection controls failed');
  }
  const child = spawnSync(process.execPath, ['--import', import.meta.url, fileURLToPath(entryUrl), childFlag], { cwd: root, stdio: 'inherit' });
  assert.ifError(child.error); assert.equal(child.signal, null); assert.equal(child.status, 0, 'Historical fixture control failed');
  return true;
}

function forbidNetwork() {
  const restore = [];
  const block = (object, name) => {
    if (typeof object?.[name] !== 'function') return;
    const prior = Object.getOwnPropertyDescriptor(object, name);
    Object.defineProperty(object, name, { ...prior, value() {
      attempts.network++;
      throw new Error('Network access is outside a pure historical fixture: ' + name);
    } });
    restore.push(() => Object.defineProperty(object, name, prior));
  };
  for (const [object, names] of [[net.Socket.prototype, ['connect']], [net.Server.prototype, ['listen']],
    [tls, ['connect']], [dgram.Socket.prototype, ['bind', 'connect', 'send']], [globalThis, ['fetch']]])
    for (const name of names) block(object, name);
  for (const object of [dns, dns.promises])
    for (const name of Object.keys(object)) if (/^(lookup|resolve|reverse)/.test(name)) block(object, name);
  syncBuiltinESMExports();
  return () => { for (const undo of restore.reverse()) undo(); syncBuiltinESMExports(); };
}

function forbidDatabase() {
  const pg = createRequire(import.meta.url)('pg');
  const restore = [];
  const denied = () => { attempts.database++; throw new Error('Database pool/connect/query access is outside a pure historical fixture'); };
  for (const name of ['Pool', 'Client']) {
    const descriptor = Object.getOwnPropertyDescriptor(pg, name), implementation = pg[name];
    Object.defineProperty(pg, name, { ...descriptor, value: new Proxy(implementation, { construct: denied, apply: denied }) });
    restore.push(() => Object.defineProperty(pg, name, descriptor));
    for (const method of ['connect', 'query']) {
      const prior = Object.getOwnPropertyDescriptor(implementation.prototype, method);
      if (!prior) continue;
      Object.defineProperty(implementation.prototype, method, { ...prior, value: denied });
      restore.push(() => Object.defineProperty(implementation.prototype, method, prior));
    }
  }
  return () => { for (const undo of restore.reverse()) undo(); };
}

export async function executeHistoricalSourceFixture() {
  assert(cold && entries.has(target) && hook && !active, 'Historical fixture wrapper is not active');
  active = true;
  const restoreNetwork = forbidNetwork();
  const restoreDatabase = forbidDatabase();
  fs.readFileSync = fixtureRead;
  fs.promises.readFile = async (candidate, options) => {
    const file = relative(candidate);
    return file?.startsWith('src/') || file?.startsWith('data/') || file === 'schema.sql' ? fixtureRead(candidate, options) : originalPromiseRead(candidate, options);
  };
  syncBuiltinESMExports();
  try {
    const pg = createRequire(import.meta.url)('pg'), namespace = await import('pg');
    assert.equal(namespace.default, pg, 'Cached default pg export bypassed the historical guard');
    for (const name of ['Pool', 'Client']) assert.equal(namespace[name], pg[name], 'Cached named pg export bypassed the historical guard');
    await import(pathToFileURL(path.join(root, target)).href + '?rc1HistoricalBody=' + HISTORICAL_SOURCE_FIXTURE_REVISION);
    assert.deepEqual(attempts, { database: 0, network: 0 }, 'Pure historical control attempted database or network access');
    console.log('PASS_HISTORICAL_FIXTURE: ' + target + '; exact fe4 application inputs; b12 tools; database/network attempts=0/0; no current native or financial qualification');
  } finally {
    fs.readFileSync = originalRead;
    fs.promises.readFile = originalPromiseRead;
    restoreDatabase();
    restoreNetwork();
    hook.deregister(); hook = null; active = false;
  }
}

async function rejectCurrentNpcRules() {
  loadInventories();
  rejectComposedHistoricalHelperSources();
  rejectCityActivityWorldHelperSources();
  rejectHistoricalApplicationSources();
  rejectCityActivityHistoricalSources();
  const { assertNpcCarSources } = await import('../../tools/rc1-npc-car-acquisition.js');
  const { assertNpcBoatSources } = await import('../../tools/rc1-npc-boat-journal.js');
  const { assertNpcMarketSources } = await import('../../tools/rc1-npc-market-order-journal.js');
  const files = ['src/rules.tail.js', 'src/rules.generated.js'];
  const base = new Map(files.map(file => [file, String(blob(file, history))]));
  let refusals = 0;
  try {
    for (const file of files) {
      const current = String(blob(file, release));
      assert.equal(canonical(originalRead(path.join(root, file))), current);
      for (const supplied of [current, current.replaceAll('\n', '\r\n'), current + '\n// unreviewed rule source\n']) {
        fs.readFileSync = (candidate, options) => {
          const name = relative(candidate);
          if (!base.has(name)) return originalRead(candidate, options);
          assert.equal(options, 'utf8');
          return name === file ? supplied : base.get(name);
        };
        for (const guard of [assertNpcCarSources, assertNpcBoatSources, assertNpcMarketSources]) {
          assert.throws(() => guard(), error => error.message.includes('source changed: ' + file)
            && error.actual === sha256(canonical(supplied)), 'Each changed file must independently reject before classification');
          refusals++;
        }
      }
    }
  } finally { fs.readFileSync = originalRead; }
  assert.throws(() => runHistoricalSourceFixture(new URL('../rc1-native-world-workload.js', import.meta.url)), /Unsupported historical fixture entry/);
  const prior = process.argv;
  try {
    process.argv = [process.execPath, path.join(root, 'test/rc1-npc-retirement-journal.js'), '--retained=forbidden'];
    assert.throws(() => runHistoricalSourceFixture(pathToFileURL(process.argv[1])), /forbids native, retained or other arguments/);
  } finally { process.argv = prior; }
  console.log(`PASS_HISTORICAL_RULE_GUARDS: ${refusals} independent C2 LF/CRLF/tamper refusals across both files; native/argument rejection`);
}

function rejectComposedHistoricalHelperSources() {
  let positives = 0, refusals = 0;
  for (const [file, pin] of Object.entries(composedHistoricalHelperPins)) {
    const frozen = blob(file, release), composed = git(['cat-file', 'blob', pin.blob]);
    assert.equal(blobHash(composed), pin.blob);
    assert.equal(sha256(composed), pin.sha256);
    const current = canonical(originalRead(path.join(root, file)));
    for (const text of new Set([current, String(composed)])) {
      for (const raw of [text, text.replaceAll('\n', '\r\n')]) {
        const selected = composedHistoricalHelperSource(file, raw);
        assert(Buffer.isBuffer(selected), 'Reviewed composition must select the frozen tool body');
        assert.equal(sha256(selected), sha256(frozen));
        assert.equal(blobHash(selected), release.get(file));
        positives++;
      }
    }
    for (const raw of [String(frozen), String(frozen).replaceAll('\n', '\r\n')]) {
      assert.equal(composedHistoricalHelperSource(file, raw), null, 'Frozen fallback remains unchanged');
      positives++;
    }
  }
  const file = 'tools/release-source-transfer.js', pin = composedHistoricalHelperPins[file];
  const current = canonical(originalRead(path.join(root, file)));
  const witness = assertDeedQuestSourceTransfer(file, String(originalRead(path.join(root, file)))).baselineText;
  assert.equal(sha256(witness), pin.sha256);
  assert.equal(blobHash(Buffer.from(witness)), pin.blob);
  const reject = raw => { assert.throws(() => composedHistoricalHelperSource(file, raw)); refusals++; };
  for (const source of [current, witness, String(blob(file, release))]) {
    for (const raw of ['\n// unreviewed prefix\n' + source, source + '\n// unreviewed suffix\n',
      source.replace(/\S/, '?'), '\ufeff' + source, source.replace('\n', '\r\n'), source.replace('\n', '\r')]) reject(raw);
  }
  for (const inverse of DEED_QUEST_SOURCE_DOMAINS[file].inverses) {
    assert(current.includes(inverse.current));
    reject(current.replace(inverse.current, ''));
    reject(current.replace(inverse.current, () => inverse.current + inverse.current));
  }
  assert.throws(() => composedHistoricalHelperSource('tools/rc1-first-batch-source-compatibility.js', current));
  refusals++;
  console.log(`PASS_HISTORICAL_HELPER_GUARDS: ${positives} frozen-body LF/CRLF controls; ${refusals} raw tamper/domain refusals; no current helper execution`);
}

function rejectCityActivityWorldHelperSources() {
  const spec = cityActivityWorldHelper, raw = String(originalRead(path.join(root, spec.file)));
  const current = canonical(raw), frozen = blob(spec.file, release);
  let positives = 0, refusals = 0;
  for (const supplied of [current, current.replaceAll('\n', '\r\n')]) {
    const selected = composedHistoricalHelperSource(spec.file, supplied);
    assert.equal(sha256(selected), spec.predecessorSha256);
    assert.equal(blobHash(selected), spec.predecessorBlob);
    assert.equal(String(selected), String(frozen));
    positives++;
  }
  for (const supplied of [String(frozen), String(frozen).replaceAll('\n', '\r\n')]) {
    assert.equal(composedHistoricalHelperSource(spec.file, supplied), null, 'Frozen helper fallback remains unchanged');
    positives++;
  }
  const reject = supplied => { assert.throws(() => composedHistoricalHelperSource(spec.file, supplied)); refusals++; };
  for (const source of [current, String(frozen)]) {
    for (const supplied of ['\n// unreviewed prefix\n' + source, source + '\n// unreviewed suffix\n',
      source.replace(/\S/, '?'), '\ufeff' + source, source.replace('\n', '\r\n'), source.replace('\n', '\r')]) reject(supplied);
  }
  for (const [chunk] of spec.inverses) {
    assert.equal(current.split(chunk).length, 2);
    reject(current.replace(chunk, ''));
    reject(current.replace(chunk, () => chunk + chunk));
  }
  for (const [before, after] of [
    ['version: 34', 'version: 35'],
    ['cityActivitySourceReviewTransfer: CITY_ACTIVITY_SOURCE_TRANSFER', 'cityActivitySourceReviewTransfer: {}'],
    ['cityActivitySourceBaseline(file, String(await readFile(file)))', 'String(await readFile(file))'],
    ['assert.equal(sha256(text), expected', 'assert.equal(sha256(text), sha256(text)'],
  ]) {
    assert(current.includes(before), 'Semantic control must change actual current helper');
    reject(current.replace(before, after));
  }
  for (const file of ['tools/unreviewed-helper.js', 'src/server.js', 'test/rc1-lifecycle-applicability.js']) {
    assert.throws(() => cityActivityWorldHelperSource(file, raw), /domain changed/);
    refusals++;
  }
  assert.throws(() => composedHistoricalHelperSource('tools/rc1-first-batch-source-compatibility.js', raw));
  refusals++;
  console.log(`PASS_HISTORICAL_ACTIVITY_HELPER_GUARDS: ${positives} current/frozen LF/CRLF controls; ${refusals} raw/inverse/semantic/domain refusals; unchanged b12 tool body only`);
}

function rejectHistoricalApplicationSources() {
  const files = ['schema.sql', 'src/agentgateway.js', 'src/content/phase1.js', 'src/content/phase1-policy.js',
    'src/db.js', 'src/deeds.js', 'src/explore.js'];
  let positives = 0, refusals = 0;
  for (const file of files) {
    const actualCurrentRaw = String(selectFinalServicesCommerceTestSource(file,originalRead(path.join(root, file)))),
      raw = hasCommerceCurrentEnterpriseSource(file) ? commerceOverCurrentEnterpriseSourceBaseline(file, actualCurrentRaw) : actualCurrentRaw, current = canonical(raw);
    const rootRaw = enterpriseOverRootSourceBaseline(file,raw), rootCurrent = canonical(rootRaw);
    const deedRaw = marketOverDeedSourceBaseline(file, rootRaw), deedCurrent = canonical(deedRaw);
    const witness = assertDeedQuestSourceTransfer(file, deedRaw).baselineText;
    const expected = blob(file, history), frozen = String(blob(file, release));
    const reject = supplied => { assert.throws(() => currentHistoricalApplicationSource(file, supplied)); refusals++; };
    for (const source of new Set([current, rootCurrent, deedCurrent, witness, frozen])) {
      for (const supplied of [source, source.replaceAll('\n', '\r\n')]) {
        const selected = currentHistoricalApplicationSource(file, supplied);
        assert.equal(sha256(selected), sha256(expected));
        assert.equal(blobHash(selected), history.get(file));
        positives++;
      }
      for (const supplied of ['\n// unreviewed prefix\n' + source, source + '\n// unreviewed suffix\n',
        source.replace(/\S/, '?'), '\ufeff' + source, source.replace('\n', '\r\n'), source.replace('\n', '\r')]) reject(supplied);
    }
    for (const inverse of DEED_QUEST_SOURCE_DOMAINS[file].inverses) {
      assert(deedCurrent.includes(inverse.current));
      reject(deedCurrent.replace(inverse.current, ''));
      reject(deedCurrent.replace(inverse.current, () => inverse.current + inverse.current));
    }
  }
  const phase1 = String(originalRead(path.join(root, 'src/content/phase1.js')));
  const unsupported = 'src/content/city-quest-presentation.js';
  const unsupportedRaw = canonical(originalRead(path.join(root, unsupported)));
  const denied = [
    [unsupported, unsupportedRaw], [unsupported, unsupportedRaw.replaceAll('\n', '\r\n')],
    ['src/db.js', phase1], ['tools/release-source-transfer.js', phase1],
    ['src/deeddiscovery.js', String(originalRead(path.join(root, 'src/deeddiscovery.js')))],
  ];
  for (const [file, raw] of denied) { assert.throws(() => currentHistoricalApplicationSource(file, raw)); refusals++; }
  console.log(`PASS_HISTORICAL_APPLICATION_GUARDS: ${positives} exact fe4-body controls; ${refusals} raw/inverse/domain refusals; no current runtime execution`);
}

function rejectCityActivityHistoricalSources() {
  const file = 'src/server.js', actualCurrentUnionRaw = String(selectFinalServicesCommerceTestSource(file,originalRead(path.join(root, file)))),
    unionRaw = hasCommerceCurrentEnterpriseSource(file) ? commerceOverCurrentEnterpriseSourceBaseline(file, actualCurrentUnionRaw) : actualCurrentUnionRaw;
  const raw = enterpriseOverGuiSourceBaseline(file, unionRaw), current = canonical(raw);
  const combinedProof = qualifyCityActivityMarketSource(file, raw);
  const retained = String(git(['cat-file', 'blob', CITY_ACTIVITY_SOURCE_TRANSFER.actualServerBlob]));
  const proof = qualifyCityActivitySource(retained), frozen = String(blob(file, release)), expected = blob(file, history);
  let positives = 0, refusals = 0;
  // Retain the original GUI controls below, and independently reject mutations of the physical union.
  for (const supplied of [unionRaw, canonical(unionRaw).replaceAll('\n', '\r\n')]) {
    const selected = historicalApplicationSource(file, enterpriseOverGuiSourceBaseline(file, supplied));
    assert.equal(sha256(selected), sha256(expected));
    assert.equal(blobHash(selected), history.get(file));
    positives++;
  }
  for (const supplied of ['\n// unreviewed union prefix\n' + unionRaw, unionRaw + '\n// unreviewed union suffix\n',
    unionRaw.replace(/\S/, '?'), '\ufeff' + unionRaw, unionRaw + '\0', unionRaw.replace('\n', '\r\n'), unionRaw.replace('\n', '\r')]) {
    assert.throws(() => enterpriseOverGuiSourceBaseline(file, supplied));
    refusals++;
  }

  const reject = supplied => { assert.throws(() => historicalApplicationSource(file, supplied)); refusals++; };
  for (const source of [current, combinedProof.baselineText, retained, proof.baselineText, frozen]) {
    for (const supplied of [source, source.replaceAll('\n', '\r\n')]) {
      const selected = historicalApplicationSource(file, supplied);
      assert.equal(sha256(selected), sha256(expected));
      assert.equal(blobHash(selected), history.get(file));
      positives++;
    }
    for (const supplied of ['\n// unreviewed prefix\n' + source, source + '\n// unreviewed suffix\n',
      source.replace(/\S/, '?'), '\ufeff' + source, source.replace('\n', '\r\n'), source.replace('\n', '\r')]) reject(supplied);
  }
  for (const [chunk] of CITY_ACTIVITY_SOURCE_INVERSES) {
    assert.equal(current.split(chunk).length, 2);
    reject(current.replace(chunk, ''));
    reject(current.replace(chunk, () => chunk + chunk));
  }
  for (const [before, after] of [
    ['ownerOnly: true', 'ownerOnly: false'],
    ['activityHit || cityOwnerActivityCategory(activityKey)', 'activityHit'],
    ['JSON.parse(body)?.replayed === true', 'JSON.parse(body)?.replayed === false'],
    ["reply.getHeader('x-idempotent-replay') || reply[cityActivityReplay]", 'false'],
    ['reply.statusCode >= 300', 'reply.statusCode >= 400'],
    ["app.post('/v1/deeds/upgrade', { preHandler: auth }", "app.post('/v1/deeds/upgrade', { preHandler: null }"],
  ]) {
    assert(current.includes(before), 'Semantic control must change actual current source');
    reject(current.replace(before, after));
  }
  for (const [deniedFile, supplied] of [
    ['src/db.js', current], ['schema.sql', current],
    ['src/city-activity.js', String(originalRead(path.join(root, 'src/city-activity.js')))],
    ['tools/rc1-city-activity-source-compatibility.js', current], ['test/rc1-car-melt-provenance.js', current],
  ]) {
    assert.throws(() => historicalApplicationSource(deniedFile, supplied));
    refusals++;
  }
  console.log(`PASS_HISTORICAL_ACTIVITY_GUARDS: ${positives} current/predecessor/frozen LF/CRLF controls; ${refusals} raw/inverse/semantic/domain refusals; unchanged frozen execution only`);
}

if (cold) {
  assert(entries.has(target), 'Unsupported historical fixture entry');
  assert.equal(process.argv.length, 3, 'Historical fixture forbids native, retained or other arguments');
  assert.deepEqual(process.execArgv, ['--import', import.meta.url], 'Historical fixture requires the exact cold preload');
  loadInventories();
  const entryUrl = pathToFileURL(path.join(root, target)).href;
  const bodyUrl = entryUrl + '?rc1HistoricalBody=' + HISTORICAL_SOURCE_FIXTURE_REVISION;
  hook = registerHooks({ resolve(specifier, context, nextResolve) {
    const result = nextResolve(specifier, context);
    if (/^pg(?:-native|-mem)(?:\/|$)/.test(specifier)
      || /\/node_modules\/(?:pg-native|pg-mem)\//.test(result.url)) {
      attempts.database++;
      throw new Error('Database pool/driver access is outside a pure historical fixture');
    }
    return result;
  }, load(url, context, nextLoad) {
    if (url === entryUrl) return { format: 'module', shortCircuit: true,
      source: `import { executeHistoricalSourceFixture } from ${JSON.stringify(import.meta.url)}; await executeHistoricalSourceFixture();` };
    if (url === bodyUrl) return nextLoad(url, context);
    const file = relative(url);
    if (file?.startsWith('src/') || file?.startsWith('data/')) {
      assert(!['src/server.js', 'src/worker.js'].includes(file), 'Native runtime entry execution is outside a pure historical fixture');
      const result = nextLoad(url, context);
      return { ...result, source: historical(file) };
    }
    if (file?.startsWith('tools/') && /\.[cm]?js$/.test(file)) {
      const raw = originalRead(path.join(root, file)), selected = composedHistoricalHelperSource(file, raw);
      if (selected) return { ...nextLoad(url, context), source: selected };
      assert.equal(sha256(canonical(raw)), sha256(blob(file, release)), 'Reviewed tool implementation changed: ' + file);
    }
    return nextLoad(url, context);
  } });
} else if (target === relative(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--npc-rule-rejections'], 'Unsupported historical fixture helper command');
  await rejectCurrentNpcRules();
}
