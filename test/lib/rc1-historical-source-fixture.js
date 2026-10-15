// Closed pure-control fixtures. Historical source execution never admits the current release.
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

export const HISTORICAL_SOURCE_FIXTURE_REVISION = 'fe4a75a8b21fc41fd3d3bc75cf7720612c581463';
const releaseRevision = 'b12c1cbcbcf88bd4510cc8316c5cd5ca08eb4e16';
const treePins = Object.freeze({
  historical: { src: 'cdedb35ef954d65542a0d868aeab0a4dcaa4a9c0', data: 'fb65393d36a7dc7375078dc6abe417653b4e73bb' },
  release: { src: '8865ac9d3cc8b1f99fe5782bae292f2b5ad5e13c', data: 'b5fa73b743fde33f0dece71116781e193f168f76' },
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
function historical(file) {
  loadInventories();
  if (!checked.has(file)) {
    const actual = originalRead(path.join(root, file));
    assert.equal(sha256(cityPlaySourceBaseline(file, canonical(actual))), sha256(blob(file, release)), 'Current release input changed outside historical fixture: ' + file);
    checked.add(file);
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
      const prior = cityPlaySourceBaseline(file, canonical(originalRead(path.join(root, file))));
      assert.equal(sha256(prior), sha256(blob(file, release)), 'Reviewed tool implementation changed: ' + file);
      return { ...nextLoad(url, context), source: prior };
    }
    return nextLoad(url, context);
  } });
} else if (target === relative(import.meta.url)) {
  assert.deepEqual(process.argv.slice(2), ['--npc-rule-rejections'], 'Unsupported historical fixture helper command');
  await rejectCurrentNpcRules();
}
