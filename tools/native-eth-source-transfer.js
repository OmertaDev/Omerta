// Historical source inspection only. Current ETH runtime and deployment checks use physical source.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

export const NATIVE_ETH_PREDECESSOR_REVISION = 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e';
export const NATIVE_ETH_PREDECESSOR_TREE = '2fb48b34fdb9fab7f630844205d035b29ee063c0';
export const NATIVE_ETH_SOURCE_FILES = Object.freeze([
  'src/genesisauction.js', 'public/genesis-deploy-client.js', 'tools/genesis-auction-preflight.js',
  'docs/WIKI.md', 'public/wiki.html', 'public/index.html', 'public/defi.html', 'public/fee-flows.html',
  'src/server.js', 'package.json', 'src/worker.js', 'src/preflight.js',
]);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
export const NATIVE_ETH_SOURCE_TRANSFER = freeze(JSON.parse(fs.readFileSync(
  new URL('./native-eth-source-transfer.json', import.meta.url), 'utf8')));
const root = fileURLToPath(new URL('../', import.meta.url));
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
const sha = input => crypto.createHash('sha256').update(input).digest('hex');
const blob = input => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(input)}\0`).update(input).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const uniform = text => !lf(text).includes('\r') && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));
const checked = new Map();

function textOf(input) {
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : input;
  if (Buffer.isBuffer(input)) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 source required');
  assert(typeof text === 'string', 'Native ETH source text required');
  return text;
}
function checkPin(text, pin, prefix) {
  const key = suffix => prefix ? prefix + suffix : suffix[0].toLowerCase() + suffix.slice(1);
  assert.equal(sha(text), pin[key('Sha256')], 'Complete native ETH source SHA256 drift');
  assert.equal(blob(text), pin[key('Blob')], 'Complete native ETH source Git blob drift');
  assert.equal(Buffer.byteLength(text), pin[key('Bytes')], 'Complete native ETH source byte count drift');
}
function predecessor(file, pin) {
  if (checked.has(file)) return checked.get(file);
  const manifest = NATIVE_ETH_SOURCE_TRANSFER;
  assert.equal(manifest.predecessorRevision, NATIVE_ETH_PREDECESSOR_REVISION);
  assert.equal(manifest.predecessorTree, NATIVE_ETH_PREDECESSOR_TREE);
  assert.equal(git('rev-parse', `${manifest.predecessorRevision}^{tree}`).toString().trim(), manifest.predecessorTree);
  const previous = textOf(git('show', `${manifest.predecessorRevision}:${file}`));
  checkPin(previous, pin, 'baseline');
  assert.equal(git('rev-parse', `${manifest.predecessorRevision}:${file}`).toString().trim(), pin.baselineBlob);
  if (manifest.sourceRevision !== 'WORKTREE_PROPOSAL') {
    assert.match(manifest.sourceRevision, /^[0-9a-f]{40}$/);
    git('merge-base', '--is-ancestor', manifest.predecessorRevision, manifest.sourceRevision);
    const authored = textOf(git('show', `${manifest.sourceRevision}:${file}`));
    checkPin(authored, pin, 'authored');
    checkPin(lf(authored), pin, 'current');
    assert.equal(git('rev-parse', `${manifest.sourceRevision}:${file}`).toString().trim(), pin.authoredBlob);
  }
  checked.set(file, previous);
  return previous;
}

export function assertNativeEthSourceTransfer(file, input) {
  assert(NATIVE_ETH_SOURCE_FILES.includes(file) && Object.hasOwn(NATIVE_ETH_SOURCE_TRANSFER.files, file),
    'Unknown native ETH source-transfer domain');
  const pin = NATIVE_ETH_SOURCE_TRANSFER.files[file], text = textOf(input);
  assert.notEqual(pin.currentSha256, pin.baselineSha256, 'Only changed source postimages require a bridge');
  assert(!text.includes('\ufeff') && !text.includes('\0'), 'No BOM or NUL source');
  if (!uniform(text)) {
    assert(pin.exactWorkingEncoding, 'Uniform whole LF/CRLF or explicit exact mixed encoding required');
    checkPin(text, pin.exactWorkingEncoding, '');
  }
  const current = lf(text);
  checkPin(current, pin, 'current');
  const baselineText = predecessor(file, pin);
  assert.equal(NATIVE_ETH_SOURCE_TRANSFER.sourceOnly, true);
  assert.equal(NATIVE_ETH_SOURCE_TRANSFER.runtime, false);
  assert.equal(NATIVE_ETH_SOURCE_TRANSFER.native, false);
  return Object.freeze({ file, baselineText, sourceRevision: NATIVE_ETH_SOURCE_TRANSFER.sourceRevision,
    predecessorRevision: NATIVE_ETH_PREDECESSOR_REVISION, actualSha256: pin.currentSha256,
    sourceBlob: pin.currentBlob, baselineSha256: pin.baselineSha256, predecessorBlob: pin.baselineBlob,
    phase: 'exact historical source transfer only; no runtime, native, financial or deployment qualification',
    sourceOnly: true, runtime: false, native: false });
}

// Unknown bytes retain their original identity and must reach the existing rejecting guard.
export function nativeEthHistoricalInput(file, input) {
  if (!NATIVE_ETH_SOURCE_FILES.includes(file) || !Object.hasOwn(NATIVE_ETH_SOURCE_TRANSFER.files, file)) return input;
  if (typeof input !== 'string' && !Buffer.isBuffer(input)) return input;
  const text = Buffer.isBuffer(input) ? input.toString('utf8') : input, pin = NATIVE_ETH_SOURCE_TRANSFER.files[file];
  if (Buffer.isBuffer(input) && !Buffer.from(text).equals(input)) return input;
  if ((!uniform(text) && sha(text) !== pin.exactWorkingEncoding?.sha256) || sha(lf(text)) !== pin.currentSha256) return input;
  const previous = assertNativeEthSourceTransfer(file, input).baselineText;
  return Buffer.isBuffer(input) ? Buffer.from(previous) : previous;
}
