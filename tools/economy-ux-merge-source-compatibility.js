// Exact source reconstruction only. Runtime and native checks always use physical current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ECONOMY_UX_MERGE_SOURCE, ECONOMY_UX_MERGE_SOURCE_SHA256 } from './economy-ux-merge-source-data.js';
import { saleHistoricalInput } from './sale-source-compatibility.js';
import { assertEconomyMonitorSourceTransfer, economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';
import { ageEligibilityHistoricalInput } from './age-eligibility-source-transfer.js';
import { economyBankInterestHardeningHistoricalInput } from './economy-bank-interest-source-transfer.js';
import { economySocialProofCutoverHistoricalInput } from './economy-social-proof-cutover-source-transfer.js';
import { economySocialReceiptSafetyHistoricalInput } from './economy-social-proof-receipt-safety-source-transfer.js';
import { economySocialReceiptHistoricalInput } from './economy-social-proof-receipt-source-transfer.js';

export { ECONOMY_UX_MERGE_SOURCE };
export const ECONOMY_UX_MERGE_FILES = Object.freeze([
  '.github/workflows/ci.yml',
  '.github/workflows/economy-hardening.yml',
  'package.json',
  'public/index.html',
  'schema.sql',
  'src/accrual.js',
  'src/actioncooldown.js',
  'src/db.js',
  'src/economy.js',
  'src/game.js',
  'src/growth.js',
  'src/kitchen.js',
  'src/payroll.js',
  'src/rules.tail.js',
  'src/server.js',
  'src/socialproof.js',
  'src/ux-tactics.js',
  'src/verify.js',
  'tools/commerce-deed-release-phase2-native-catalog.js',
  'tools/economy-hardening-source-transfer.js',
  'tools/economy-readiness-merge-source-compatibility.js',
  'tools/economy-release-tail-source-transfer.js',
  'tools/enterprise-native.js',
  'tools/enterprise-native-ux-seal.js',
  'tools/sim.js',
  'test/action-cooldowns.js',
  'test/agent-referral-cash.js',
  'test/classic-interface-source-compatibility.js',
  'test/client.js',
  'test/commerce-release-phase2-migration-catalog.js',
  'test/crew-wage-postgres.js',
  'test/director-migration.js',
  'test/economy-balance.js',
  'test/economy-hardening-source-compatibility.js',
  'test/enterprise-native-guard.js',
  'test/enterprise-release-phase2-migration-catalog.js',
  'test/gates.js',
  'test/growth.js',
  'test/levers.js',
  'test/lib/enterprise-ux-native-guard.js',
  'test/lib/rc1-historical-source-fixture.js',
  'test/migrate.js',
  'test/payroll.js',
  'test/phase2-postgres.js',
  'test/ux-postgres-rls.js',
  'test/ux-tactics-browser.js',
  'test/ux-tactics.js',
]);
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const normalize = input => {
  assert.equal(typeof input, 'string', 'Complete source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'Lossless UTF-8 only');
  assert(!input.startsWith('\ufeff') && !input.includes('\0'), 'No BOM or NUL');
  const text = input.replaceAll('\r\n', '\n');
  assert(!text.includes('\r') && (input === text || input === text.replaceAll('\n', '\r\n')), 'Uniform whole LF/CRLF only');
  return text;
};
// Exact successor admissions for safe()/null, the private constant, CI wiring and child listeners. The
// published monitor envelope remains unchanged: only these complete physical bytes reconstruct
// their 9000f2af sources, checked by the original frozen monitor transfer before chaining.
export const ECONOMY_MONITOR_WORKER_SOURCE = Object.freeze({
  file: 'src/worker.js', sourceRevision: 'fd9ba2014cf7ceb42a7b155bf94a208f9992cfea',
  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
  currentSha256: '8461ccc60c86ccadcda3c2820a9026f8eadacebdd201355f23b09e4b646f38f9',
  currentBlob: '6e0eb2656fb6c815908ddf722a4e8a89dc75f3d2', currentBytes: 87275,
  occurrences: 1,
  current: "      const summary = await safe('economy monitor', () => runEconomyMonitor(pool, { alert: alertDrift }));\n      if (summary) console.log('[economy monitor]', JSON.stringify(summary));\n",
  baseline: "      const summary = await runEconomyMonitor(pool, { alert: alertDrift });\n      console.log('[economy monitor]', JSON.stringify(summary));\n",
});
export const ECONOMY_MONITOR_READER_SOURCE = Object.freeze({
  file: 'src/economy-monitor.js', sourceRevision: '9da329e2be042a105b78c6df089c5c88a4f8ba1f',
  predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
  currentSha256: '2f08e91725b6692a9c846f1528ca099e2ace7461ed29b6d14ae663f4a923095a',
  currentBlob: 'c8fad52af8b3f1ea1d2863bbb85edd2a5e09102a', currentBytes: 16574,
  current: 'COLUMNS', baseline: 'columns', occurrences: 3,
});
export const ECONOMY_MONITOR_RELEASE_SOURCES = Object.freeze({
  '.github/workflows/economy-hardening.yml': Object.freeze({
    file: '.github/workflows/economy-hardening.yml', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',
    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
    currentSha256: '1551813fbb50fb14a3bd9690e5d0d62f09b1605ea4e582612cade095514a57ad',
    currentBlob: '18d9875f1112661aa57148d7f9c7704d4958bb93', currentBytes: 5425,
    current: '          node test/age-eligibility-source-compatibility.js &&\n          node test/economy-monitor-source-compatibility.js &&\n',
    baseline: '', occurrences: 1,
  }),
  'test/gates.js': Object.freeze({
    file: 'test/gates.js', sourceRevision: '9a5c784034a9f543cd32e27fd0b73a23e332ee5b',
    predecessorRevision: '6fdc897851ef23e8c2cf691733ad944a7663242a',
    currentSha256: 'a30914836d5d503aaf0114a5634e183dfec43a0a9c1c799692e2644612d581f8',
    currentBlob: 'a0a4551b721073b1eb33780e3702cd0b8fde6813', currentBytes: 461700,
    baselineSha256: '727b8cfba27ab2b1a69dedaa43aa5d289a09d91aeb27be5f66e87d744f1f4a12',
    baselineBlob: '238e7a38313f54fd09d82df4dedb9a574f04243d', baselineBytes: 461461,
    current: "    'test/economy-composition-restart.js': 'Fresh-process child probe executed by the required native economy-composition suite; it requires an owned disposable PostgreSQL schema and bounded synthetic stdin, so it cannot run standalone.',\n",
    baseline: '', occurrences: 1,
  }),
  'test/economy-composition.js': Object.freeze({
    file: 'test/economy-composition.js', sourceRevision: 'b5155c297f9ab4d097ca4cba1e3ef86babaa449e',
    predecessorRevision: '9000f2afaf4640e018b2d4026fb7b1ff984a8257',
    currentSha256: '20d42640e5f750f6abc35d7631024a132ad56f375e48b268827fb704c55b7022',
    currentBlob: '7f8426a3f112703709e08b8a1b2546c2d72a7896', currentBytes: 21633,
    current: `  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],
    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const exited = new Promise((resolve, reject) => {
    child.once('error', reject); child.once('close', resolve);
  });
  let stdout = '', stderr = '';
  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdin.end(JSON.stringify({ ...probe, wall }));
  try {
    const exitCode = await exited;
`,
    baseline: `  const child = spawn(process.execPath, [fileURLToPath(new URL('./economy-composition-restart.js', import.meta.url))],
    { env: process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  let stdout = '', stderr = '';
  const timeout = setTimeout(() => child.kill(), 90_000); timeout.unref();
  child.stdout.on('data', chunk => { stdout += chunk; });
  child.stderr.on('data', chunk => { stderr += chunk; });
  child.stdin.end(JSON.stringify({ ...probe, wall }));
  try {
    const exitCode = await new Promise((resolve, reject) => {
      child.once('error', reject); child.once('close', resolve);
    });
`, occurrences: 1,
  }),
});
function assertMonitorSuccessor(file, input, pin) {
  assert.equal(file, pin.file, 'Only the exact named economy-monitor successor');
  const current = normalize(input);
  assert.equal(sha(current), pin.currentSha256, 'Whole economy-monitor successor changed');
  assert.equal(blob(current), pin.currentBlob); assert.equal(Buffer.byteLength(current), pin.currentBytes);
  assert.equal(current.split(pin.current).length, pin.occurrences + 1, 'Exact bounded economy-monitor successor replacements');
  const baselineText = current.replaceAll(pin.current, () => pin.baseline);
  if (pin.baselineSha256) {
    assert.equal(sha(baselineText), pin.baselineSha256); assert.equal(blob(baselineText), pin.baselineBlob);
    assert.equal(Buffer.byteLength(baselineText), pin.baselineBytes);
  } else assertEconomyMonitorSourceTransfer(file, baselineText);
  return Object.freeze({ file, baselineText, sourceRevision: pin.sourceRevision, predecessorRevision: pin.predecessorRevision,
    sourceOnly: true, native: false, runtime: false });
}
export function assertEconomyMonitorWorkerSource(file, input) {
  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_WORKER_SOURCE);
}
export function assertEconomyMonitorReaderSource(file, input) {
  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_READER_SOURCE);
}
function monitorSuccessorHistoricalInput(file, input, pin) {
  if (file !== pin.file) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical successor source required');
  let current;
  try { current = normalize(text); } catch { return input; }
  if (sha(current) !== pin.currentSha256) return input;
  const restored = assertMonitorSuccessor(file, text, pin).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export function economyMonitorWorkerHistoricalInput(file, input) {
  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_WORKER_SOURCE);
}
export function economyMonitorReaderHistoricalInput(file, input) {
  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_READER_SOURCE);
}
export function assertEconomyMonitorReleaseSource(file, input) {
  assert(Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file), 'Only the three exact economy-monitor CI/test source domains');
  return assertMonitorSuccessor(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);
}
export function economyMonitorReleaseHistoricalInput(file, input) {
  if (!Object.hasOwn(ECONOMY_MONITOR_RELEASE_SOURCES, file)) return input;
  return monitorSuccessorHistoricalInput(file, input, ECONOMY_MONITOR_RELEASE_SOURCES[file]);
}
const assertPin = pin => {
  assert.equal(pin, ECONOMY_UX_MERGE_SOURCE, 'Only the exact frozen economy+UX merge binding');
  assert.equal(sha(JSON.stringify(pin)), ECONOMY_UX_MERGE_SOURCE_SHA256);
  assert.equal(pin.version, 1); assert.equal(pin.status, 'SEALED');
  assert.equal(pin.phase, 'EXACT_ECONOMY_UX_MERGE_SOURCE_ONLY'); assert.equal(pin.contextLines, 3);
  assert.deepEqual(pin.files.map(row => row.file), ECONOMY_UX_MERGE_FILES);
  for (const value of [pin.sourceRevision, pin.sourceTree, pin.mergeRevision, pin.mergeTree,
    pin.candidateParentRevision, pin.candidateParentTree, pin.mainParentRevision, pin.mainParentTree])
    assert.match(value, /^[a-f0-9]{40}$/);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files) && pin.files.every(Object.isFrozen));
};
export function qualifyEconomyUxMergeSource(file, input, target, pin = ECONOMY_UX_MERGE_SOURCE) {
  assertPin(pin); assert(['candidate', 'main'].includes(target), 'Closed merge parent');
  const row = pin.files.find(item => item.file === file); assert(row, 'Unknown economy+UX merge source');
  const current = normalize(input), parent = row[target];
  assert(Object.isFrozen(parent));
  assert.equal(sha(current), row.currentSha256, `Whole integrated source changed: ${file}`);
  assert.equal(blob(current), row.currentBlob); assert.equal(Buffer.byteLength(current), row.currentBytes);
  if (parent.absent) return Object.freeze({
    baselineText: null, predecessorAbsent: true, sourceRevision: pin.sourceRevision,
    targetRevision: target === 'candidate' ? pin.candidateParentRevision : pin.mainParentRevision,
    target, sourceOnly: true, native: false, runtime: false,
  });
  assert.equal(parent.absent, false); assert(Object.isFrozen(parent.inverses) && parent.inverses.every(Object.isFrozen));
  let restored = current; let end = -1;
  for (const inverse of parent.inverses) {
    assert.deepEqual(Object.keys(inverse).sort(), ['baseline', 'current']);
    assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.baseline, 'string'); assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, `Unique complete integrated hunk: ${file}`);
    const at = current.indexOf(inverse.current); assert(at >= end, `Ordered nonoverlapping integrated hunks: ${file}`); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), parent.sha256, `Complete ${target} parent changed: ${file}`);
  assert.equal(blob(restored), parent.blob); assert.equal(Buffer.byteLength(restored), parent.bytes);
  return Object.freeze({
    baselineText: restored, sourceRevision: pin.sourceRevision,
    targetRevision: target === 'candidate' ? pin.candidateParentRevision : pin.mainParentRevision,
    target, sourceOnly: true, native: false, runtime: false,
  });
}
function historicalInput(file, input, target) {
  const row = ECONOMY_UX_MERGE_SOURCE.files.find(item => item.file === file); if (!row) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (typeof text !== 'string' || sha(text.replaceAll('\r\n', '\n')) !== row.currentSha256) return input;
  if (row[target].absent) return input;
  const restored = qualifyEconomyUxMergeSource(file, text, target).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
export function economyUxMergeCandidateHistoricalInput(file, input) {
  input = ageEligibilityHistoricalInput(file, input);
  input = economyMonitorWorkerHistoricalInput(file, input);
  input = economyMonitorReaderHistoricalInput(file, input);
  input = economyMonitorReleaseHistoricalInput(file, input);
  input = economyMonitorHistoricalInput(file, input);
  input = economyBankInterestHardeningHistoricalInput(file, input);
  input = economySocialProofCutoverHistoricalInput(file, input);
  input = economySocialReceiptSafetyHistoricalInput(file, input);
  input = economySocialReceiptHistoricalInput(file, input);
  input = saleHistoricalInput(file, input);
  return historicalInput(file, input, 'candidate');
}
export function economyUxMergeMainHistoricalInput(file, input) {
  input = ageEligibilityHistoricalInput(file, input);
  input = economyMonitorWorkerHistoricalInput(file, input);
  input = economyMonitorReaderHistoricalInput(file, input);
  input = economyMonitorReleaseHistoricalInput(file, input);
  input = economyMonitorHistoricalInput(file, input);
  input = economyBankInterestHardeningHistoricalInput(file, input);
  input = economySocialProofCutoverHistoricalInput(file, input);
  input = economySocialReceiptSafetyHistoricalInput(file, input);
  input = economySocialReceiptHistoricalInput(file, input);
  input = saleHistoricalInput(file, input);
  return historicalInput(file, input, 'main');
}
