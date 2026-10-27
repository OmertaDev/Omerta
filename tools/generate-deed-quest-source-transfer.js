// Explicit maintainer tool. Generation never runs from a test, runtime import or source guard.
// The resulting literal envelope reconstructs source bytes only; it grants no release clearance.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const predecessor = '2c8eaacf104e8555d5140136b5ed19027ecd4766';
const files = ['package.json', 'schema.sql', 'src/agentgateway.js', 'src/content/phase1.js',
  'src/content/phase1-policy.js', 'src/content/city-quest-presentation.js', 'src/db.js', 'src/deeds.js', 'src/explore.js', 'tools/release-source-transfer.js',
  'test/gates.js', '.github/workflows/ci.yml', 'test/phase2-postgres.js'];
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
assert.equal(process.argv[2], '--write', 'Use --write after freezing the exact reviewed candidate source');
git('merge-base', '--is-ancestor', predecessor, 'HEAD'); // Keep the fixed predecessor; never infer or refresh it.
const domains = {};
for (const file of files) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw), baseline = git('show', `${predecessor}:${file}`);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed candidate line endings: ${file}`);
  assert.notEqual(current, baseline, `Closed candidate domain has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', predecessor, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Inverse context must occur exactly once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete predecessor reconstruction: ${file}`);
  domains[file] = { currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline),
    baselineBlob: blob(baseline), contextLines: 3, inverses };
}
const output = `// Generated exact source-only envelope for earned property quests. Never imported by game runtime.
// Historical pins and native migration admission remain unchanged; unknown bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { economyHardeningSourceBaseline } from './economy-hardening-source-transfer.js';
export const DEED_QUEST_SOURCE_PREDECESSOR = ${JSON.stringify(predecessor)};
export const DEED_QUEST_SOURCE_PHASE = 'exact-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance';
export const DEED_QUEST_SOURCE_DOMAINS = ${JSON.stringify(domains, null, 2)};
for (const pin of Object.values(DEED_QUEST_SOURCE_DOMAINS)) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(DEED_QUEST_SOURCE_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n');
export function assertDeedQuestSourceTransfer(file, input) {
  assert(Object.hasOwn(DEED_QUEST_SOURCE_DOMAINS, file), 'Unknown property quest source domain');
  assert.equal(typeof input, 'string'); assert(uniform(input), 'Mixed property quest source line endings');
  const pin = DEED_QUEST_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete property quest current source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete property quest current blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate property quest inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete property quest predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete property quest predecessor blob mismatch: ' + file);
  return { file, baselineText, candidateSha256: pin.currentSha256, predecessorRevision: DEED_QUEST_SOURCE_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: DEED_QUEST_SOURCE_PHASE, sourceOnly: true };
}
export function deedQuestSourceBaseline(file, input) {
  input = economyHardeningSourceBaseline(file, input);
  if (!Object.hasOwn(DEED_QUEST_SOURCE_DOMAINS, file) || typeof input !== 'string' || !uniform(input)) return input;
  return hash(lf(input)) === DEED_QUEST_SOURCE_DOMAINS[file].currentSha256
    ? assertDeedQuestSourceTransfer(file, input).baselineText : input;
}
`;
fs.writeFileSync(new URL('./deed-quest-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} exact property quest source domains; historical pins remain unchanged.`);
