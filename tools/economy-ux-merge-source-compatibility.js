// Exact source reconstruction only. Runtime and native checks always use physical current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ECONOMY_UX_MERGE_SOURCE, ECONOMY_UX_MERGE_SOURCE_SHA256 } from './economy-ux-merge-source-data.js';
import { saleHistoricalInput } from './sale-source-compatibility.js';
import { economyMonitorHistoricalInput } from './economy-monitor-source-transfer.js';
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
  input = economyMonitorHistoricalInput(file, input);
  input = economyBankInterestHardeningHistoricalInput(file, input);
  input = economySocialProofCutoverHistoricalInput(file, input);
  input = economySocialReceiptSafetyHistoricalInput(file, input);
  input = economySocialReceiptHistoricalInput(file, input);
  input = saleHistoricalInput(file, input);
  return historicalInput(file, input, 'main');
}
