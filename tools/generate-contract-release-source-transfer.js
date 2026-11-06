// Maintainer generator only. No diff, branch name, or clock establishes release acceptance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { contractReleaseSourceDataBytes } from './contract-release-source-format.js';
import { CONTRACT_RELEASE_MIN_CONTEXT_LINES, CONTRACT_RELEASE_MAX_CONTEXT_LINES } from './contract-release-source-transfer.js';
export { contractReleaseSourceDataBytes };

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACT = 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e';
const CONTRACT_BASE = 'c4b626b631b04e594097fb6bb416c36fdfea00f3';
const UI = 'f3b1fe4768fe2a6ef18dba5edb45bfdb090a04b7';
const CONTRACT_ORIGIN = Object.freeze({ revision: CONTRACT, baseRevision: CONTRACT_BASE });
const UI_ORIGIN = Object.freeze({ revision: UI, baseRevision: CONTRACT });
export const CONTRACT_RELEASE_MOBILE_ORIGIN = Object.freeze({
  revision: '6c4d37842f4d7ebd7f96d5fee9935720f442007a',
  baseRevision: '4fc2f4100dbe0dca019cab2c4a13b18e5bee93e5',
  files: Object.freeze(['public/index.html', 'public/omerta-ui.css', 'tools/mobile.js', 'tools/public-ui.js']),
});
export const CONTRACT_RELEASE_ETH_ORIGIN = Object.freeze({
  revision: '03d6a65a9f9ffaaca2573b15236592ade91de0ea',
  baseRevision: 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e',
  files: Object.freeze([
    ".github/workflows/forge.yml",
    "docs/WIKI.md",
    "public/defi.html",
    "public/eth-staking.js",
    "public/fee-flows.html",
    "public/genesis-deploy-artifact.js",
    "public/genesis-deploy-client.js",
    "public/index.html",
    "public/wiki.html",
    "src/data/market-v2-eth-abis.json",
    "src/ethrewardsworker.js",
    "src/ethstaking.js",
    "src/genesisauction.js",
    "src/marketv2abi.js",
    "src/marketv2keeper.js",
    "src/preflight.js",
    "src/routes/ethstaking.js",
    "src/server.js",
    "src/worker.js",
    "test/native-eth-source-transfer.js",
    "tools/economy-hardening-source-transfer.js",
    "tools/generate-native-eth-source-transfer.js",
    "tools/genesis-auction-deployment-plan.js",
    "tools/genesis-auction-preflight.js",
    "tools/genesis-fee-readiness-source-transfer.js",
    "tools/market-fee-copy-source-transfer.js",
    "tools/market-v2-deployment-plan.js",
    "tools/native-eth-source-transfer.js"
  ]),
});
export const CONTRACT_RELEASE_START_ORDER_ORIGIN = Object.freeze({
  revision: '7e2ce748912e9c4422432fb684e4454a23f18978',
  baseRevision: 'd80412c5f2cf6b597f9832825293cdae9d7d3480',
  files: Object.freeze(['public/index.html']),
});
export const CONTRACT_RELEASE_CENSUS_ORIGIN = Object.freeze({
  revision: 'ecf48c4c69817546b484fced0404aa28d5e02697',
  baseRevision: '68a4d92d810ee17c192abb8a8c2a3fcbf87c4c52',
  files: Object.freeze(['MARKETING-POSTS.md', 'SPEC.md']),
});
// The released Desk preserves consumed Escape events. Keep that exact reviewed
// integration when composing the earlier mobile origin; never resolve arbitrary conflicts.
export const CONTRACT_RELEASE_MOBILE_ESCAPE_RESOLUTION = Object.freeze({
  baseRevision: '8d60765b0a0f28be1696be108ff47683ff22eef5',
  baseTree: '1a17883bbc63430b3c27bde6675f60eb26e091aa',
  file: 'public/index.html',
  baseBlob: 'cb87163f7b87389596a737e18be397ce6a1af02a',
  baseSha256: 'e2795f78d407109a4b2e8e12f09b3eedd5d640fa6d7f3cecc435c0dd273e5f28',
  variantBlob: 'd3c1a10defdb23c025a7ec689f1f5c26f0fd562d',
  variantSha256: '92c1e91b83a58b77134dd5d11115dc2777addc58be4fce0b995962511b0c3e49',
});
// Exact source-composition checkpoint for the accepted main integration. This
// authorizes only these complete postimages, never a caller-supplied product pin.
export const CONTRACT_RELEASE_MAIN_RESOLUTION = Object.freeze({
  revision: '863d990b33c2d02bb2c6e2e886bcd7ba88c8c2cc',
  tree: '2c43cecd3713a5e6deecdfbca973da049a8a1bc8',
  baseRevision: 'aeae575a9a6a9c874840f0a4481d11cc303b9d0a',
  baseTree: 'b45024815077a564ecb48eb35e4835b830d44c2f',
  files: Object.freeze(['MARKETING-POSTS.md', 'SPEC.md', 'public/defi.html',
    'public/fee-flows.html', 'public/index.html', 'src/server.js']),
});
const DATA = 'tools/contract-release-source-data.js';
const CURRENT_MANIFEST = 'tools/enterprise-native-contract-release-inputs.js';
const ACCEPTED_BASE_REVISION = 'aeae575a9a6a9c874840f0a4481d11cc303b9d0a';
const ACCEPTED_BASE_TREE = 'b45024815077a564ecb48eb35e4835b830d44c2f';
const ACCEPTED_NATIVE_METADATA = Object.freeze({
  file: 'tools/enterprise-native-economic-release-inputs.js', mode: '100644',
  blob: '00cde6bac960e8c5de75f7d88c7031438844e000',
  sha256: 'ce732a483247679bd77567f28677163218400f01ae536bcf8f4b9b93f0f17771',
});
// This immutable catalog is an ordinary raw input, never a full native manifest.
const HISTORICAL_CATALOG = Object.freeze({
  file: 'tools/enterprise-native-continuous-city-inputs.js', mode: '100644',
  blob: '1af546bd54ac00f7dbc5db4d2c6e77ddefe1cf95',
  sha256: '804f29d96f31767fb3447dc61ed01ca243d9770357923ded125493bb19e71f58',
});
const HISTORY = Object.freeze(['tools/enterprise-native-ux-b35-inputs.js', 'tools/enterprise-native-ux-inputs.js',
  'tools/businessdesk-deed-native-inputs.js', 'tools/businessdesk-desk-parent-native-inputs.js',
  'tools/businessdesk-monitor-parent-native-inputs.js', 'tools/businessdesk-wiki-parent-native-inputs.js',
  'tools/enterprise-native-deed-inputs.js',
  'tools/enterprise-native-economic-release-inputs.js', 'tools/enterprise-native-economic-inputs.js',
  'tools/economic-deed-parent-native-inputs.js', 'tools/enterprise-native-continuous-city-inputs.js']);
const RELEASE = Object.freeze(['.github/workflows/forge.yml', 'docs/WIKI.md',
  'public/defi.html', 'public/fee-flows.html', 'public/genesis-deploy-artifact.js',
  'public/genesis-deploy-client.js', 'public/index.html', 'public/wiki.html',
  'src/fundedworkescrowartifact.js', 'src/genesisauction.js', 'src/marketv2keeper.js',
  'test/lib/rc1-historical-source-fixture.js', 'tools/economy-hardening-source-transfer.js',
  'tools/economy-social-proof-cutover-source-transfer.js', 'tools/genesis-auction-deployment-plan.js',
  'tools/genesis-auction-preflight.js', 'tools/market-v2-deployment-plan.js',
  'tools/age-policy-source-transfer.js', 'tools/genesis-fee-readiness-source-transfer.js',
  'tools/genesis-historical-reader-source-transfer.js', 'tools/market-fee-copy-source-transfer.js']);
const INTEGRATION = Object.freeze(['package.json', 'tools/enterprise-native-ux.js', 'tools/enterprise-native-ux-seal.js',
  'tools/deed-allocation-source-transfer.js', 'test/deed-allocation-source-compatibility.js',
  // This source-only reader composes both frozen histories; its catalog pins stay unchanged.
  'tools/economy-social-proof-cutover-source-transfer.js',
  'test/noir-ui-source-compatibility.js', 'test/businessdesk-noir-source-compatibility.js',
  'test/economy-hardening-source-compatibility.js', 'test/lib/enterprise-ux-native-guard.js',
  'test/businessdesk-native-provenance.js', 'test/companyopportunities.js', 'tools/contract-release-native-provenance.js',
  'tools/contract-release-source-format.js',
  'tools/contract-release-source-transfer.js', 'tools/generate-contract-release-source-transfer.js',
  'test/contract-release-source-compatibility.js',
  'test/businessdesk-combined-source-compatibility.js', 'test/businessdesk-combined-native-provenance.js',
  'test/economy-deed-merge-source-compatibility.js', 'test/wiki-media-source-transfer.js',
  'test/economy-monitor-source-compatibility.js', 'test/age-eligibility-source-compatibility.js',
  'test/lib/ux-journeys.js',
  // Generated source-authority data only; product files always retain fixed reviewed origins.
  'tools/native-eth-source-transfer.json']);
const NEW_SUPPORT = Object.freeze(['tools/age-policy-source-transfer.js', 'tools/genesis-fee-readiness-source-transfer.js',
  'tools/genesis-historical-reader-source-transfer.js', 'tools/market-fee-copy-source-transfer.js',
  'tools/contract-release-native-provenance.js', 'tools/contract-release-source-transfer.js',
  'tools/contract-release-source-format.js',
  'tools/generate-contract-release-source-transfer.js', 'test/contract-release-source-compatibility.js',
  "public/eth-staking.js",
  "src/data/market-v2-eth-abis.json",
  "src/ethrewardsworker.js",
  "src/ethstaking.js",
  "src/marketv2abi.js",
  "src/routes/ethstaking.js",
  "test/native-eth-source-transfer.js",
  "tools/generate-native-eth-source-transfer.js",
  "tools/native-eth-source-transfer.js",
  "tools/native-eth-source-transfer.json"]);
const FEE = Object.freeze(['docs/WIKI.md', 'public/wiki.html', 'public/index.html', 'public/defi.html', 'public/fee-flows.html']);
const UI_FILE = 'test/ux-expanded-browser.js';
const canonicalPath = file => typeof file === 'string' && !file.includes('\\') && !file.includes(':') && !file.includes('\0')
  && file.split('/').every(part => part && !['.', '..', '.git', '__proto__', 'constructor', 'prototype'].includes(part));
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const blob = bytes => crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex');
const git = (...args) => execFileSync('git', ['--no-replace-objects', ...args], {
  cwd: root, windowsHide: true, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
});
const gitText = (...args) => git(...args).toString('utf8').replaceAll('\r\n', '\n');
const own = (value, keys) => {
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'Plain explicit approval record required');
  const names = Reflect.ownKeys(value); assert(names.every(key => typeof key === 'string'));
  assert.deepEqual(names.sort(), keys.slice().sort(), 'Closed explicit approval record');
};
const pin = (row, file) => {
  own(row, ['file', 'mode', 'blob', 'sha256']); assert(canonicalPath(file)); assert.equal(row.file, file);
  assert(['100644', '100755'].includes(row.mode)); assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);
};
const record = (revision, file, absent = false) => {
  assert(canonicalPath(file));
  const line = gitText('ls-tree', '-z', revision, '--', file);
  if (!line) { assert(absent, 'Committed source required: ' + file); return null; }
  const match = line.match(/^(100644|100755) blob ([a-f0-9]{40})\t([^\0]+)\0$/);
  assert(match && match[3] === file, 'Regular exact Git source required: ' + file);
  const bytes = git('show', revision + ':' + file);
  return { pin: { file, mode: match[1], blob: match[2], sha256: sha256(bytes) }, bytes };
};
const sourceText = row => {
  const text = row.bytes.toString('utf8'); assert(Buffer.from(text).equals(row.bytes), 'Lossless UTF-8 source only');
  assert(!text.includes('\r') && !text.includes('\ufeff') && !text.includes('\0') && text.endsWith('\n'),
    'Canonical complete LF source required for generation');
  assert.equal(blob(row.bytes), row.pin.blob); return text;
};
const detailed = row => ({ ...row.pin, bytes: row.bytes.length });
const currentDetailed = row => ({ ...detailed(row), rawSha256: {
  lf: row.pin.sha256, crlf: sha256(sourceText(row).replaceAll('\n', '\r\n')),
} });
const parseManifest = bytes => {
  const text = bytes.toString('utf8'), match = text.match(/export const ENTERPRISE_NATIVE_UX_INPUTS = freeze\(([\s\S]*?)\);\r?\nexport const ENTERPRISE_NATIVE_UX_INPUTS_SHA256 = "([a-f0-9]{64})";/);
  assert(match, 'Exact old manifest declaration required');
  const value = JSON.parse(match[1]); assert.equal(sha256(JSON.stringify(value)), match[2]); assert.equal(value.status, 'SEALED');
  assert(Array.isArray(value.files) && value.files.every(row => canonicalPath(row.file)));
  return value;
};
const inverseHunksAtContext = (before, current, contextLines) => {
  const result = []; let hunk;
  for (const line of gitText('diff', '--no-ext-diff', '--unified=' + contextLines, before.pin.blob, current.pin.blob).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; result.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  return result;
};
export function deriveContractReleaseInverseHunks(before, current) {
  const currentText = sourceText(current), targetText = sourceText(before);
  assert.notEqual(current.pin.blob, before.pin.blob, 'A view must describe a real source change');
  for (let contextLines = CONTRACT_RELEASE_MIN_CONTEXT_LINES; contextLines <= CONTRACT_RELEASE_MAX_CONTEXT_LINES; contextLines++) {
    const inverses = inverseHunksAtContext(before, current, contextLines);
    assert(inverses.length, 'A source change has complete Git hunks');
    let restored = currentText, end = -1, unique = true;
    for (const hunk of inverses) {
      assert(hunk.current.length && hunk.current.endsWith('\n') && hunk.baseline.endsWith('\n'));
      const at = currentText.indexOf(hunk.current);
      if (currentText.split(hunk.current).length !== 2 || at < end || restored.split(hunk.current).length !== 2) {
        unique = false; break;
      }
      end = at + hunk.current.length;
      restored = restored.replace(hunk.current, () => hunk.baseline);
    }
    if (!unique) continue;
    assert.equal(restored, targetText, 'Every complete view restores exact source');
    return { contextLines, inverses };
  }
  assert.fail('No unique ordered complete Git context within ' + CONTRACT_RELEASE_MIN_CONTEXT_LINES + '..'
    + CONTRACT_RELEASE_MAX_CONTEXT_LINES + ': ' + current.pin.file);
}
export function deriveContractReleaseReviewedSource(base, original, reviewed) {
  if (!base) { assert(!original, 'An absent base cannot drop original reviewed source'); return reviewed.bytes; }
  assert(original, 'Reviewed source has its exact original base');
  if (base.pin.blob === reviewed.pin.blob) return base.bytes;
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-contract-source-'));
  const currentFile = path.join(directory, 'accepted-base'), originalFile = path.join(directory, 'reviewed-base'),
    reviewedFile = path.join(directory, 'reviewed-change');
  try {
    fs.writeFileSync(currentFile, base.bytes); fs.writeFileSync(originalFile, original.bytes); fs.writeFileSync(reviewedFile, reviewed.bytes);
    return execFileSync('git', ['--no-replace-objects', 'merge-file', '-p', currentFile, originalFile, reviewedFile], {
      cwd: directory, windowsHide: true, maxBuffer: 32 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'],
    });
  } finally {
    for (const file of [currentFile, originalFile, reviewedFile]) fs.rmSync(file, { force: true });
    fs.rmdirSync(directory);
  }
}

export function contractReleaseReviewedOrigins(file) {
  const origins = [];
  if (RELEASE.includes(file)) origins.push(CONTRACT_ORIGIN);
  if (file === UI_FILE) origins.push(UI_ORIGIN);
  if (CONTRACT_RELEASE_MOBILE_ORIGIN.files.includes(file)) origins.push(CONTRACT_RELEASE_MOBILE_ORIGIN);
  if (CONTRACT_RELEASE_ETH_ORIGIN.files.includes(file)) origins.push(CONTRACT_RELEASE_ETH_ORIGIN);
  if (CONTRACT_RELEASE_START_ORDER_ORIGIN.files.includes(file)) origins.push(CONTRACT_RELEASE_START_ORDER_ORIGIN);
  if (CONTRACT_RELEASE_CENSUS_ORIGIN.files.includes(file)) origins.push(CONTRACT_RELEASE_CENSUS_ORIGIN);
  return Object.freeze(origins);
}
export function deriveContractReleaseApprovedSource(file, base) {
  assert(canonicalPath(file), 'Canonical fixed reviewed source path required');
  const origins = contractReleaseReviewedOrigins(file);
  assert(origins.length, 'No fixed reviewed source origin: ' + file);
  if (base) { assert.equal(base.pin.file, file); sourceText(base); }
  const resolution = CONTRACT_RELEASE_MAIN_RESOLUTION;
  if (base && resolution.files.includes(file)) {
    const accepted = record(resolution.baseRevision, file);
    if (base.pin.blob === accepted.pin.blob) {
      assert.equal(gitText('rev-parse', resolution.baseRevision + '^{tree}').trim(), resolution.baseTree);
      assert.deepEqual(base.pin, accepted.pin); assert(base.bytes.equals(accepted.bytes));
      assert.equal(gitText('rev-parse', resolution.revision + '^{tree}').trim(), resolution.tree);
      git('merge-base', '--is-ancestor', resolution.baseRevision, resolution.revision);
      return record(resolution.revision, file);
    }
  }
  let expected = base;
  for (const origin of origins) {
    const original = record(origin.baseRevision, file, true);
    let reviewed = record(origin.revision, file);
    const resolution = CONTRACT_RELEASE_MOBILE_ESCAPE_RESOLUTION;
    if (base && file === resolution.file && origin === CONTRACT_RELEASE_MOBILE_ORIGIN
      && base.pin.blob === resolution.baseBlob) {
      assert.equal(gitText('rev-parse', resolution.baseRevision + '^{tree}').trim(), resolution.baseTree);
      const accepted = record(resolution.baseRevision, file);
      assert.deepEqual(base.pin, accepted.pin); assert(base.bytes.equals(accepted.bytes));
      const before = "    if (event.key !== 'Escape') return;\n";
      const after = "    if (event.key !== 'Escape' || event.defaultPrevented) return;\n";
      const text = sourceText(reviewed); assert.equal(text.split(before).length, 2);
      const bytes = Buffer.from(text.replace(before, () => after));
      assert.equal(blob(bytes), resolution.variantBlob); assert.equal(sha256(bytes), resolution.variantSha256);
      reviewed = { pin: { ...reviewed.pin, blob: resolution.variantBlob, sha256: resolution.variantSha256 }, bytes };
    }
    const bytes = deriveContractReleaseReviewedSource(expected, original, reviewed);
    expected = { pin: { file, mode: reviewed.pin.mode, blob: blob(bytes), sha256: sha256(bytes) }, bytes };
  }
  return expected;
}
export function assertContractReleaseApprovedSource(file, base, actual) {
  const expected = deriveContractReleaseApprovedSource(file, base);
  assert.equal(actual.pin.file, file); assert.equal(actual.pin.mode, expected.pin.mode);
  sourceText(actual); assert.equal(actual.pin.sha256, sha256(actual.bytes));
  assert(actual.bytes.equals(expected.bytes), 'Only the ordered independently reviewed edits at their exact contexts are approved: ' + file);
  return expected;
}

// Pure output-scope check; main always supplies this module's actual repository root.
export function resolveContractReleasePrototypeOutput(output, repositoryRoot = root) {
  assert.equal(typeof output, 'string');
  const absolute = path.resolve(output), realRoot = fs.realpathSync(repositoryRoot);
  const resolved = path.join(fs.realpathSync(path.dirname(absolute)), path.basename(absolute));
  const relative = path.relative(realRoot, resolved);
  assert(relative.startsWith('..' + path.sep) || path.isAbsolute(relative),
    'Prototype output must remain outside the real repository');
  return resolved;
}

function main() {
  const flags = new Map();
  for (const arg of process.argv.slice(2)) {
    const match = arg.match(/^--([a-z-]+)(?:=(.+))?$/); assert(match && !flags.has(match[1]), 'Unique named generator arguments only');
    flags.set(match[1], match[2] ?? true);
  }
  const allowed = ['prototype', 'bind', 'source', 'base', 'accepted-base', 'integration-pins', 'output', 'write'];
  assert([...flags.keys()].every(key => allowed.includes(key)), 'Unknown source generator argument');
  const prototype = flags.get('prototype') === true, bind = flags.get('bind') === true;
  assert(prototype !== bind, 'Choose explicit --prototype or --bind');
  const source = flags.get('source'), base = flags.get(bind ? 'accepted-base' : 'base');
  assert.match(source || '', /^[a-f0-9]{40}$/); assert.match(base || '', /^[a-f0-9]{40}$/);
  assert(!flags.has(bind ? 'base' : 'accepted-base'), 'No ambiguous base acceptance');
  assert(bind ? flags.get('write') === true && !flags.has('output') : !flags.has('write') && typeof flags.get('output') === 'string',
    'Prototype is external-only; accepted binding requires explicit --bind --write');
  const approvalFile = flags.get('integration-pins'); assert(typeof approvalFile === 'string' && path.isAbsolute(approvalFile));
  const approval = JSON.parse(fs.readFileSync(approvalFile, 'utf8'));
  own(approval, ['version', 'sourceRevision', 'pins']); assert.equal(approval.version, 1); assert.equal(approval.sourceRevision, source);
  assert(approval.pins && Object.getPrototypeOf(approval.pins) === Object.prototype);
  for (const [file, row] of Object.entries(approval.pins)) {
    assert(INTEGRATION.includes(file), 'No unlisted integration approval: ' + file); pin(row, file);
    assert.deepEqual(record(source, file).pin, row, 'Approved integration source must be exact committed code');
  }
  assert.equal(base, ACCEPTED_BASE_REVISION, 'Exact accepted economic release base required');
  assert.equal(gitText('rev-parse', base + '^{tree}').trim(), ACCEPTED_BASE_TREE, 'Exact accepted economic release tree required');
  git('merge-base', '--is-ancestor', base, source);
  git('merge-base', '--is-ancestor', CONTRACT, source);
  git('merge-base', '--is-ancestor', UI, source);
  git('merge-base', '--is-ancestor', CONTRACT_RELEASE_ETH_ORIGIN.revision, source);
  const history = {};
  for (const file of HISTORY) {
    const prior = record(base, file), actual = record(source, file);
    assert.deepEqual(actual.pin, prior.pin, 'Never bind rewritten historical metadata: ' + file);
    if (file === HISTORICAL_CATALOG.file) {
      assert.deepEqual(prior.pin, HISTORICAL_CATALOG, 'Exact immutable source-only catalog pin required');
    } else parseManifest(prior.bytes);
    history[file] = prior.pin;
  }
  const acceptedRecord = record(base, ACCEPTED_NATIVE_METADATA.file);
  assert.deepEqual(acceptedRecord.pin, ACCEPTED_NATIVE_METADATA, 'Exact accepted V7 metadata pin required');
  const accepted = parseManifest(acceptedRecord.bytes);
  assert.equal(accepted.version, 7);
  assert.equal(accepted.phase, 'ACTUAL_ENTERPRISE_ECONOMIC_BUSINESS_DESK_NATIVE_INPUTS');
  assert.equal(accepted.authoredRevision, '77839fd65fa5d629bbedbe819444136a00452a89');
  assert.equal(sha256(JSON.stringify(accepted)), '605ee77c542b220fb5d28cf003a27d4b06964e641bd52ff8468da7f0054ea75d');
  const old = new Map(accepted.files.map(row => [row.file, row]));
  assert.equal(old.size, accepted.files.length, 'No duplicate accepted native subjects');
  const checked = new Set();
  const authorize = file => {
    assert(!HISTORY.includes(file) && file !== DATA && file !== CURRENT_MANIFEST, 'No immutable/self subject');
    const actual = record(source, file), prior = record(base, file, true);
    if (INTEGRATION.includes(file)) {
      assert(Object.hasOwn(approval.pins, file), 'Exact explicit integration approval required: ' + file);
      assert.deepEqual(actual.pin, approval.pins[file]);
    } else if (contractReleaseReviewedOrigins(file).length) {
      assertContractReleaseApprovedSource(file, prior, actual);
    } else assert.fail('No approved contract or support source: ' + file);
    checked.add(file); return actual;
  };
  const nativeChanges = {}, approvedAdditions = {}, sourceViews = {};
  for (const [file, previous] of old) {
    if (file === DATA || file === CURRENT_MANIFEST) assert.fail('Old manifest unexpectedly contains new self subjects');
    const actual = record(source, file);
    if (HISTORY.includes(file)) continue;
    const prior = record(base, file); assert.deepEqual(prior.pin, previous, 'Frozen Desk manifest matches its exact base source');
    if (actual.pin.blob === prior.pin.blob && actual.pin.mode === prior.pin.mode) continue;
    const approved = authorize(file); nativeChanges[file] = { current: approved.pin, predecessor: previous };
  }
  for (const file of NEW_SUPPORT) {
    const actual = record(source, file);
    if (old.has(file)) continue;
    assert.equal(record(base, file, true), null, 'New contract support is absent from accepted Desk');
    authorize(file); approvedAdditions[file] = actual.pin;
  }
  // Validate the separately reviewed UI change even when it is outside the native closure.
  const uiCurrent = record(source, UI_FILE), uiBase = record(base, UI_FILE);
  if (uiCurrent.pin.blob !== uiBase.pin.blob) authorize(UI_FILE);
  const viewFiles = [...new Set([...RELEASE, ...INTEGRATION, ...FEE, ...CONTRACT_RELEASE_MOBILE_ORIGIN.files,
    ...CONTRACT_RELEASE_ETH_ORIGIN.files, ...CONTRACT_RELEASE_CENSUS_ORIGIN.files])].sort();
  for (const file of viewFiles) {
    const actual = record(source, file, true), prior = record(base, file, true);
    if (!actual || !prior) continue;
    const targets = {};
    if (actual.pin.blob !== prior.pin.blob || actual.pin.mode !== prior.pin.mode) {
      if (!checked.has(file)) authorize(file);
      targets.desk = { revision: base, pin: detailed(prior), ...deriveContractReleaseInverseHunks(prior, actual) };
    }
    if (FEE.includes(file)) {
      const fee = record(CONTRACT, file);
      if (actual.pin.blob !== fee.pin.blob) {
        if (!checked.has(file) && (actual.pin.blob !== prior.pin.blob || actual.pin.mode !== prior.pin.mode)) authorize(file);
        targets.fee = { revision: CONTRACT, pin: detailed(fee), ...deriveContractReleaseInverseHunks(fee, actual) };
      }
    }
    if (Object.keys(targets).length) sourceViews[file] = { current: currentDetailed(actual), targets };
  }
  const value = { version: 1, status: 'BOUND', phase: 'EXACT_CONTRACT_RELEASE_SOURCE_ONLY',
    reviewedContractRevision: CONTRACT, reviewedUiRevision: UI, baseRevision: base,
    baseTree: gitText('rev-parse', base + '^{tree}').trim(), sourceRevision: source,
    sourceTree: gitText('rev-parse', source + '^{tree}').trim(), historicalManifests: history,
    nativeChanges, approvedAdditions, sourceViews };
  if (prototype) {
    const output = resolveContractReleasePrototypeOutput(flags.get('output'), root);
    fs.writeFileSync(output, JSON.stringify({ accepted: false, phase: 'UNACCEPTED_CONTRACT_RELEASE_PROTOTYPE', proposedData: value }, null, 2) + '\n', { flag: 'wx' });
  } else {
    fs.writeFileSync(path.join(root, DATA), contractReleaseSourceDataBytes(value));
  }
  console.log(JSON.stringify({ acceptedBinding: bind, base, source, nativeChanges: Object.keys(nativeChanges).length,
    additions: Object.keys(approvedAdditions).length, views: Object.keys(sourceViews).length,
    sourceOnly: true, runtime: false, native: false }));
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
