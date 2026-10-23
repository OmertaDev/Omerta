// Explicit maintainer tool. The emitted envelope reconstructs source bytes only;
// it does not inherit historical runtime, native, migration or release clearance.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const revision = 'aaab91ff6bec4c8a0ec53e0ef88682b317a7a182';
const predecessor = '9f39df80598d38507c9f6b4ea2414312eb8e7700';
const bindingRevision = 'c94bb20cf84de303a34730f4723cff17192d6923';
const bindingRevisionTree = 'e0f65c75eab02d2cbdc69d1da13047217d6651ce';
const bindingSuccessorRevision = '66b4c6008e6b9c192ae20006c59bc591be82a27a';
const bindingSuccessorTree = '38d87c3be5fdd4890ab5a9cdc7309a4332b50a14';
const lf = text => text.replaceAll('\r\n', '\n');
const git = (...args) => lf(execFileSync('git', args, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  stdio: ['ignore', 'pipe', 'pipe'] }));
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');

assert.equal(process.argv[2], '--write', 'Use --write only for the fixed reviewed economy-hardening candidate');
execFileSync('git', ['merge-base', '--is-ancestor', predecessor, revision]);
execFileSync('git', ['merge-base', '--is-ancestor', revision, bindingRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', bindingRevision, bindingSuccessorRevision]);
execFileSync('git', ['merge-base', '--is-ancestor', bindingSuccessorRevision, 'HEAD']);
assert.equal(git('rev-parse', `${bindingRevision}^{tree}`).trim(), bindingRevisionTree,
  'Frozen economy binding revision tree changed');
assert.equal(git('rev-parse', `${bindingSuccessorRevision}^{tree}`).trim(), bindingSuccessorTree,
  'Frozen economy binding successor revision tree changed');
// Closed physical-source readers reached by the current Commerce and RC1 chains.
// Other candidate files are tested as current gameplay and are not historical source namespaces.
const files = Object.freeze([
  '.github/workflows/ci.yml',
  'public/index.html', 'schema.sql', 'src/accrual.js', 'src/agentreferrals.js', 'src/auth.js', 'src/boxing.js', 'src/db.js',
  'src/economy.js', 'src/explore.js', 'src/game.js', 'src/goodsquote.js', 'src/invariants.js', 'src/kitchen.js', 'src/market.js',
  'src/routes/gateway.js', 'src/routes/rwa.js', 'src/rules.tail.js', 'src/server.js',
  'src/pen.js', 'src/population.js', 'src/preflight.js', 'src/races.js', 'src/social/estate.js', 'src/stable.js',
  'test/gates.js', 'test/growth.js', 'test/phase2-postgres.js', 'test/rc1-native-world-workload.js',
  'tools/arena.js', 'tools/commerce-deed-release-phase2-native-catalog.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/continuous-city-source-compatibility.js', 'test/enterprise-release-phase2-migration-catalog.js',
  'test/lib/rc1-historical-source-fixture.js',
  'tools/commerce-current-enterprise-source-compatibility.js',
  'tools/deed-quest-source-transfer.js', 'tools/enterprise-deed-release-phase2-migration-catalog.js',
  'tools/player-intel-source-compatibility.js', 'tools/rc1-company-operator-source-compatibility.js',
  'tools/rc1-deed-source-compatibility.js', 'tools/rc1-invoice-source-compatibility.js',
  'tools/rc1-npc-cargo-journal.js', 'tools/rc1-player-car-provenance.js',
  'tools/rc1-world-market-resources.js', 'tools/rc1-world-qualification.js', 'tools/rc1-world-resource-observer.js',
]);

const domains = {};
for (const file of files) {
  const current = git('show', `${revision}:${file}`), baseline = git('show', `${predecessor}:${file}`);
  assert.notEqual(current, baseline, `Closed candidate domain has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', predecessor, revision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty current inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete predecessor reconstruction: ${file}`);
  domains[file] = {
    mode: git('ls-tree', revision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// Source-only adapters added after the authored gameplay revision. Their exact
// postimages reconstruct that revision before any older frozen reader executes.
const bindingFiles = Object.freeze([
  'package.json', 'test/lib/rc1-historical-source-fixture.js',
]);
const bindingDomains = {};
for (const file of bindingFiles) {
  const current = git('show', `${bindingRevision}:${file}`), baseline = git('show', `${revision}:${file}`);
  assert.notEqual(current, baseline, `Binding postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', revision, bindingRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty binding inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Binding inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete authored-source reconstruction: ${file}`);
  bindingDomains[file] = {
    mode: git('ls-tree', bindingRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}

// A later reviewed fixture execution change is a separate outer hop. Keeping it
// separate prevents regeneration from rewriting or collapsing the frozen binding.
const bindingSuccessorFiles = Object.freeze(['test/lib/rc1-historical-source-fixture.js']);
const bindingSuccessorDomains = {};
for (const file of bindingSuccessorFiles) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  const authored = git('show', `${bindingSuccessorRevision}:${file}`), baseline = git('show', `${bindingRevision}:${file}`);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed binding successor line endings: ${file}`);
  assert.equal(current, authored, `Binding successor physical source differs from the reviewed commit: ${file}`);
  assert.notEqual(current, baseline, `Binding successor postimage has no change: ${file}`);
  const inverses = []; let hunk = null;
  for (const line of git('diff', '--no-ext-diff', '--unified=3', bindingRevision, bindingSuccessorRevision, '--', file).split('\n')) {
    if (line.startsWith('@@')) { hunk = { current: '', baseline: '' }; inverses.push(hunk); }
    else if (hunk && /^[ +\-]/.test(line)) {
      if (line[0] !== '-') hunk.current += line.slice(1) + '\n';
      if (line[0] !== '+') hunk.baseline += line.slice(1) + '\n';
    }
  }
  let reconstructed = current;
  for (const inverse of inverses) {
    assert(inverse.current.length, `Empty binding successor inverse context: ${file}`);
    assert.equal(reconstructed.split(inverse.current).length - 1, 1, `Binding successor inverse context must occur once: ${file}`);
    reconstructed = reconstructed.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(reconstructed, baseline, `Complete binding predecessor reconstruction: ${file}`);
  bindingSuccessorDomains[file] = {
    mode: git('ls-tree', bindingSuccessorRevision, '--', file).trim().split(/\s+/)[0],
    currentSha256: hash(current), currentBlob: blob(current), baselineSha256: hash(baseline), baselineBlob: blob(baseline),
    contextLines: 3, inverses,
  };
}
for (const file of bindingFiles.filter(file => !bindingSuccessorFiles.includes(file))) {
  const raw = fs.readFileSync(file, 'utf8'), current = lf(raw);
  assert(raw === current || raw === current.replaceAll('\n', '\r\n'), `Mixed binding line endings: ${file}`);
  assert.equal(current, git('show', `${bindingRevision}:${file}`),
    `Unsealed physical binding successor requires its own reviewed outer hop: ${file}`);
}

const revisionTree = git('rev-parse', `${revision}^{tree}`).trim();
const predecessorTree = git('rev-parse', `${predecessor}^{tree}`).trim();
const output = `// Generated exact source-only envelope for the economy-hardening candidate. Never imported by game runtime.
// Historical pins remain unchanged; unknown or non-exact bytes pass through.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
export const ECONOMY_HARDENING_SOURCE_REVISION = ${JSON.stringify(revision)};
export const ECONOMY_HARDENING_SOURCE_TREE = ${JSON.stringify(revisionTree)};
export const ECONOMY_HARDENING_SOURCE_PREDECESSOR = ${JSON.stringify(predecessor)};
export const ECONOMY_HARDENING_SOURCE_PREDECESSOR_TREE = ${JSON.stringify(predecessorTree)};
export const ECONOMY_HARDENING_SOURCE_PHASE = 'exact-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance';
export const ECONOMY_HARDENING_SOURCE_DOMAINS = ${JSON.stringify(domains, null, 2)};
export const ECONOMY_HARDENING_BINDING_DOMAINS = ${JSON.stringify(bindingDomains, null, 2)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION = ${JSON.stringify(bindingSuccessorRevision)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_TREE = ${JSON.stringify(bindingSuccessorTree)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR = ${JSON.stringify(bindingRevision)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR_TREE = ${JSON.stringify(bindingRevisionTree)};
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE = 'exact-authored-binding-successor-source-transfer-only; no historical runtime, native, migration, financial, genesis or deployment clearance';
export const ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS = ${JSON.stringify(bindingSuccessorDomains, null, 2)};
for (const pin of [...Object.values(ECONOMY_HARDENING_SOURCE_DOMAINS), ...Object.values(ECONOMY_HARDENING_BINDING_DOMAINS),
  ...Object.values(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS)]) {
  for (const inverse of pin.inverses) Object.freeze(inverse);
  Object.freeze(pin.inverses); Object.freeze(pin);
}
Object.freeze(ECONOMY_HARDENING_SOURCE_DOMAINS);
Object.freeze(ECONOMY_HARDENING_BINDING_DOMAINS);
Object.freeze(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS);
const lf = text => text.replaceAll('\\r\\n', '\\n');
const hash = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\\0').update(text).digest('hex');
const uniform = text => typeof text === 'string' && !text.includes('\\0') && !text.startsWith('\\ufeff')
  && !lf(text).includes('\\r') && (text === lf(text) || text === lf(text).replaceAll('\\n', '\\r\\n'));
export function assertEconomyHardeningSourceTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_SOURCE_DOMAINS, file), 'Unknown economy-hardening source domain');
  assert(uniform(input), 'Uniform whole economy-hardening LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_SOURCE_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening current source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening current blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening predecessor blob mismatch: ' + file);
  return { file, baselineText, candidateSha256: pin.currentSha256, sourceRevision: ECONOMY_HARDENING_SOURCE_REVISION,
    predecessorRevision: ECONOMY_HARDENING_SOURCE_PREDECESSOR, inverseChunks: pin.inverses.length,
    phase: ECONOMY_HARDENING_SOURCE_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningBindingTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_BINDING_DOMAINS, file), 'Unknown economy-hardening binding domain');
  assert(uniform(input), 'Uniform whole economy-hardening binding LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_BINDING_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening binding source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening binding blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening binding inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening authored binding source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening authored binding blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256, predecessorRevision: ECONOMY_HARDENING_SOURCE_REVISION,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_SOURCE_PHASE, sourceOnly: true };
}
export function assertEconomyHardeningBindingSuccessorTransfer(file, input) {
  assert(Object.hasOwn(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS, file), 'Unknown economy-hardening binding successor domain');
  assert(uniform(input), 'Uniform whole economy-hardening binding successor LF/CRLF source text required');
  const pin = ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[file], text = lf(input);
  assert.equal(hash(text), pin.currentSha256, 'Complete economy-hardening binding successor source drift: ' + file);
  assert.equal(blob(text), pin.currentBlob, 'Complete economy-hardening binding successor blob drift: ' + file);
  let baselineText = text;
  for (const inverse of pin.inverses) {
    assert(inverse.current.length);
    assert.equal(baselineText.split(inverse.current).length - 1, 1, 'Missing or duplicate economy-hardening binding successor inverse: ' + file);
    baselineText = baselineText.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(hash(baselineText), pin.baselineSha256, 'Complete economy-hardening binding successor predecessor source mismatch: ' + file);
  assert.equal(blob(baselineText), pin.baselineBlob, 'Complete economy-hardening binding successor predecessor blob mismatch: ' + file);
  return { file, baselineText, postimageSha256: pin.currentSha256,
    sourceRevision: ECONOMY_HARDENING_BINDING_SUCCESSOR_REVISION,
    predecessorRevision: ECONOMY_HARDENING_BINDING_SUCCESSOR_PREDECESSOR,
    inverseChunks: pin.inverses.length, phase: ECONOMY_HARDENING_BINDING_SUCCESSOR_PHASE, sourceOnly: true };
}
export function economyHardeningSourceBaseline(file, input) {
  if (!uniform(input)) return input;
  let text = input;
  if (Object.hasOwn(ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_BINDING_SUCCESSOR_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningBindingSuccessorTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_BINDING_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_BINDING_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningBindingTransfer(file, text).baselineText;
  if (Object.hasOwn(ECONOMY_HARDENING_SOURCE_DOMAINS, file)
      && hash(lf(text)) === ECONOMY_HARDENING_SOURCE_DOMAINS[file].currentSha256)
    text = assertEconomyHardeningSourceTransfer(file, text).baselineText;
  return text;
}
`;
fs.writeFileSync(new URL('./economy-hardening-source-transfer.js', import.meta.url), output);
console.log(`Generated ${files.length} authored, ${bindingFiles.length} binding, and ${bindingSuccessorFiles.length} successor source domains; historical pins remain unchanged.`);
