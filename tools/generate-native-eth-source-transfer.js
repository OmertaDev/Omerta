// Explicitly refresh exact authored postimages; this does not qualify runtime or deployment behavior.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { NATIVE_ETH_PREDECESSOR_REVISION, NATIVE_ETH_PREDECESSOR_TREE, NATIVE_ETH_SOURCE_FILES,
  NATIVE_ETH_SOURCE_TRANSFER } from './native-eth-source-transfer.js';

const args = process.argv.slice(2);
assert(args[0] === '--revision' && args[1] && args.slice(2).every(arg => ['--allow-exact-mixed', '--append'].includes(arg)),
  'Usage: node tools/generate-native-eth-source-transfer.js --revision WORKTREE_PROPOSAL|<full-authored-commit> [--allow-exact-mixed] [--append]');
const revision = args[1], root = fileURLToPath(new URL('../', import.meta.url));
assert(revision === 'WORKTREE_PROPOSAL' || /^[0-9a-f]{40}$/.test(revision), 'Explicit full authored commit required');
const git = (...argv) => execFileSync('git', argv, { cwd: root, maxBuffer: 16 * 1024 * 1024 });
if (revision !== 'WORKTREE_PROPOSAL') {
  assert.equal(git('rev-parse', `${revision}^{commit}`).toString().trim(), revision);
  git('merge-base', '--is-ancestor', NATIVE_ETH_PREDECESSOR_REVISION, revision);
}
const lf = text => text.replaceAll('\r\n', '\n');
const text = buffer => { const value = buffer.toString('utf8'); assert(Buffer.from(value).equals(buffer)); return value; };
const pins = (value, prefix) => {
  const key = suffix => prefix ? prefix + suffix : suffix[0].toLowerCase() + suffix.slice(1);
  return { [key('Sha256')]: crypto.createHash('sha256').update(value).digest('hex'),
    [key('Blob')]: crypto.createHash('sha1').update(`blob ${Buffer.byteLength(value)}\0`).update(value).digest('hex'),
    [key('Bytes')]: Buffer.byteLength(value) };
};
const append = args.includes('--append');
if (append) assert(revision === 'WORKTREE_PROPOSAL' && NATIVE_ETH_SOURCE_TRANSFER.sourceRevision === revision,
  'Append preserves existing proposal pins only; authored sealing must regenerate the full manifest');
const files = append ? structuredClone(NATIVE_ETH_SOURCE_TRANSFER.files) : {};
for (const file of NATIVE_ETH_SOURCE_FILES) {
  if (append && Object.hasOwn(files, file)) continue;
  const previous = text(git('show', `${NATIVE_ETH_PREDECESSOR_REVISION}:${file}`));
  const physical = text(fs.readFileSync(new URL('../' + file, import.meta.url)));
  const authored = revision === 'WORKTREE_PROPOSAL' ? physical : text(git('show', `${revision}:${file}`));
  const current = lf(authored);
  assert(!current.includes('\r') && !current.includes('\ufeff') && !current.includes('\0'), 'Unexpected source encoding: ' + file);
  if (current === previous) continue;
  const pin = { ...pins(current, 'current'), ...pins(authored, 'authored'), ...pins(previous, 'baseline') };
  const mixed = physical !== lf(physical) && physical !== lf(physical).replaceAll('\n', '\r\n');
  if (mixed) {
    assert(args.includes('--allow-exact-mixed'), 'Explicit --allow-exact-mixed required for ' + file);
    assert.equal(lf(physical), current, 'Physical mixed source differs from authored source: ' + file);
    pin.exactWorkingEncoding = pins(physical, '');
  }
  files[file] = pin;
}
const manifest = { sourceRevision: revision, predecessorRevision: NATIVE_ETH_PREDECESSOR_REVISION,
  predecessorTree: NATIVE_ETH_PREDECESSOR_TREE,
  phase: 'exact historical source transfer only; no runtime, native, financial or deployment qualification',
  sourceOnly: true, runtime: false, native: false, files };
fs.writeFileSync(new URL('./native-eth-source-transfer.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
console.log(`Native ETH historical source pins: ${Object.keys(files).length} exact domains; ${revision}; sourceOnly=true; native=false`);
