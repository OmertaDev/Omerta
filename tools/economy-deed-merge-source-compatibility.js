// Exact source reconstruction/provenance only. Native admission and execution use current bytes.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { ECONOMY_DEED_MERGE_SOURCE, ECONOMY_DEED_MERGE_SOURCE_SHA256,
  ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 }
  from './economy-deed-merge-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as PREDECESSOR_NATIVE_INPUTS,
  ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as PREDECESSOR_NATIVE_DEFINITION_SHA256 }
  from './enterprise-native-ux-b35-inputs.js';
export { ECONOMY_DEED_MERGE_SOURCE, ECONOMY_DEED_MERGE_SOURCE_SHA256,
  ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256 };
export const ECONOMY_DEED_MERGE_FILES = Object.freeze([
  'package.json', 'public/index.html', 'public/omerta-ui.css', 'src/game.js', 'src/preflight.js',
  'test/economy-hardening-source-compatibility.js',
  'test/lib/enterprise-ux-native-guard.js', 'test/lib/ux-native-reader-source-compatibility.js',
  'test/sale-source-compatibility.js', 'test/ux-expanded-browser.js',
  'tools/economy-ux-merge-source-compatibility.js', 'tools/enterprise-native-ux.js',
  'tools/enterprise-native-ux-seal.js', 'tools/enterprise-native.js', 'tools/mobile.js',
  'tools/pgquery.js', 'tools/ux-release-phase2-native-catalog.js',
]);
// Closed review scope from the three immutable parents, intersected with the immutable B35 native
// inventory, plus the two bounded operational-classification successors below. Integration changes
// outside this list must be reviewed explicitly, never auto-admitted.
export const ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES = Object.freeze([
  'AGENTS.md', 'package.json', 'public/index.html', 'public/omerta-ui.css', 'public/sale.html',
  'public/ux-coordination.css', 'public/ux-coordination.js', 'public/ux-feedback.js', 'public/ux-navigation.css',
  'public/ux-navigation.js', 'public/ux-progression.css', 'public/ux-progression.js',
  'public/ux-tactics.css', 'public/ux-tactics.js', 'public/ux-world.js', 'schema.sql', 'src/accrual.js', 'src/age.js',
  'src/content/city-quest-presentation.js', 'src/content/phase1-policy.js', 'src/content/phase1.js',
  'src/db.js', 'src/deedbuildings.js', 'src/deeddiscovery.js', 'src/deeds.js', 'src/engagement.js', 'src/game.js',
  'src/invariants.js', 'src/legal.js', 'src/preflight.js', 'src/server.js', 'src/ux-story.js', 'src/ux-tactics.js',
  'src/worker.js', 'src/worldgraph-ui.js', 'test/client.js', 'test/commerce-current-native-guard.js',
  'test/companyworkflows.js', 'test/director-migration.js', 'test/gates.js',
  'test/lib/enterprise-ux-native-guard.js', 'test/lib/phase2-definition-fixtures.js',
  'test/lib/player-command-support.js', 'test/lib/ux-native-director-guard.js',
  'test/lib/ux-native-reader-source-compatibility.js', 'test/sale-source-compatibility.js',
  'test/ux-source-compatibility.js', 'test/worldgraph-validation.js',
  'tools/commerce-current-native-guard.js', 'tools/economy-ux-merge-source-compatibility.js',
  'tools/enterprise-native-ux-seal.js', 'tools/enterprise-native-ux.js', 'tools/enterprise-native.js',
  'tools/pgquery.js', 'tools/ux-release-phase2-native-catalog.js', 'tools/ux-source-compatibility.js',
]);
export const ECONOMY_DEED_MERGE_NOIR_NATIVE_FILES = Object.freeze([
  'public/omerta-ui.css', 'public/ux-feedback.js', 'public/ux-world.js',
]);
// This existing input was identical in both reviewed parents. Its sole later correction classifies
// the already implemented alert thresholds; these forward checks grant no native-result alias.
export const ECONOMY_DEED_MERGE_PREFLIGHT_SUCCESSOR = Object.freeze({
  file: 'src/preflight.js',
  anchor: "  'WS_PING_MS', 'WS_MAX_BUFFER', 'INVARIANT_WEBHOOK_URL', 'CITY_WIRE_WEBHOOK_URL',\n",
  addition: '  // Economic anomaly alert thresholds; the monitor validates positive finite values and defaults.\n'
    + "  'ECONOMY_MONITOR_LEDGER_ROWS_WARN', 'ECONOMY_MONITOR_NET_CASH_WARN', 'ECONOMY_MONITOR_NET_OMR_WARN',\n",
});
export const ECONOMY_DEED_MERGE_ENGAGEMENT_SUCCESSOR = Object.freeze({
  file: 'src/engagement.js',
  anchor: "  'mod_kill_reason',\n",
  addition: '  // Source payout integrity diagnostics are operational observations.\n'
    + "  'economy_payout_bound',\n",
});
export const ECONOMY_DEED_MERGE_PROFILES = Object.freeze({
  monitor: 'c771f5ba73453a57e24e31f8eeb920933fe7544c',
  deed: '4e5f7fdb1cc4d2055ac613d2d4cb562a8007c364',
  noir: 'a87217d664d52eb119683ed305c564ee3cf9deb0',
});
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update('blob ' + Buffer.byteLength(text) + '\0').update(text).digest('hex');
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const normalize = input => {
  assert.equal(typeof input, 'string', 'Complete physical source text required');
  assert.equal(Buffer.from(input).toString('utf8'), input, 'lossless UTF-8 physical source required');
  assert(!input.includes('\ufeff') && !input.includes('\0'));
  const current = input.replaceAll('\r\n', '\n');
  assert(!current.includes('\r') && (input === current || input === current.replaceAll('\n', '\r\n')),
    'Whole uniform LF/CRLF source required');
  return current;
};
const assertSourceDefinition = pin => {
  assert.equal(pin, ECONOMY_DEED_MERGE_SOURCE, 'Only the imported integration source definition');
  assert.equal(pin.status, 'SEALED', 'Integration source definition must be sealed');
  assert.equal(sha(JSON.stringify(pin)), ECONOMY_DEED_MERGE_SOURCE_SHA256);
  keys(pin, ['version', 'status', 'phase', 'sourceRevision', 'sourceTree', 'profiles', 'files', 'sourceOnly', 'runtime', 'native']);
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_ECONOMY_DEED_MERGE_SOURCE_ONLY');
  assert.equal(pin.sourceOnly, true); assert.equal(pin.runtime, false); assert.equal(pin.native, false);
  assert.match(pin.sourceRevision, /^[a-f0-9]{40}$/); assert.match(pin.sourceTree, /^[a-f0-9]{40}$/);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.profiles) && Object.isFrozen(pin.files));
  assert.deepEqual(Object.keys(pin.profiles), ['monitor', 'deed', 'noir']);
  for (const profile of Object.keys(ECONOMY_DEED_MERGE_PROFILES)) {
    keys(pin.profiles[profile], ['revision', 'tree']);
    assert.equal(pin.profiles[profile].revision, ECONOMY_DEED_MERGE_PROFILES[profile]);
    assert.match(pin.profiles[profile].tree, /^[a-f0-9]{40}$/); assert(Object.isFrozen(pin.profiles[profile]));
  }
  assert.deepEqual(pin.files.map(row => row.file), ECONOMY_DEED_MERGE_FILES);
  assert(pin.files.every(row => Object.isFrozen(row) && Object.isFrozen(row.current) && Object.isFrozen(row.parents)));
};
export function assertEconomyDeedMergeSource(file, input, profile, pin = ECONOMY_DEED_MERGE_SOURCE) {
  assert(typeof profile === 'string' && Object.hasOwn(ECONOMY_DEED_MERGE_PROFILES, profile), 'Closed integration source profile');
  assert(typeof file === 'string' && ECONOMY_DEED_MERGE_FILES.includes(file), 'Closed integration source file');
  assertSourceDefinition(pin);
  const row = pin.files.find(row => row.file === file), current = normalize(input), expected = row.current;
  keys(row, ['file', 'current', 'parents']); keys(row.parents, ['monitor', 'deed', 'noir']);
  keys(expected, ['mode', 'sha256', 'blob', 'bytes', 'rawSha256']);
  keys(expected.rawSha256, ['lf', 'crlf']); assert(Object.isFrozen(expected.rawSha256));
  assert(['100644', '100755'].includes(expected.mode));
  assert.equal(sha(input), expected.rawSha256[input === current ? 'lf' : 'crlf']);
  assert.equal(sha(current), expected.sha256); assert.equal(blob(current), expected.blob);
  assert.equal(Buffer.byteLength(current), expected.bytes);
  const parent = row.parents[profile]; assert(Object.isFrozen(parent) && Object.isFrozen(parent.inverses));
  keys(parent, ['mode', 'sha256', 'blob', 'bytes', 'inverses']); assert(['100644', '100755'].includes(parent.mode));
  assert(parent.inverses.every(Object.isFrozen)); let restored = current, end = -1;
  for (const inverse of parent.inverses) {
    keys(inverse, ['current', 'baseline']); assert(inverse.current.length);
    assert.equal(current.split(inverse.current).length, 2, 'Unique complete integration inverse');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping integration inverses'); end = at + inverse.current.length;
    assert.equal(restored.split(inverse.current).length, 2); restored = restored.replace(inverse.current, () => inverse.baseline);
  }
  assert.equal(sha(restored), parent.sha256); assert.equal(blob(restored), parent.blob);
  assert.equal(Buffer.byteLength(restored), parent.bytes);
  return Object.freeze({ file, baselineText: restored, sourceRevision: pin.sourceRevision,
    predecessorRevision: pin.profiles[profile].revision, profile, sourceOnly: true, runtime: false, native: false });
}
export function economyDeedMergeHistoricalInput(file, input, profile) {
  assert(typeof profile === 'string' && Object.hasOwn(ECONOMY_DEED_MERGE_PROFILES, profile), 'Closed integration source profile');
  if (typeof file !== 'string' || !ECONOMY_DEED_MERGE_FILES.includes(file)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'lossless UTF-8 physical source required');
  let current; try { current = normalize(text); } catch { return input; }
  assertSourceDefinition(ECONOMY_DEED_MERGE_SOURCE);
  const row = ECONOMY_DEED_MERGE_SOURCE.files.find(row => row.file === file);
  if (sha(current) !== row.current.sha256) return input;
  const restored = assertEconomyDeedMergeSource(file, text, profile).baselineText;
  return buffer ? Buffer.from(restored) : restored;
}
const assertNativePin = value => {
  keys(value, ['file', 'mode', 'blob', 'sha256']); assert.equal(typeof value.file, 'string');
  assert(['100644', '100755'].includes(value.mode)); assert.match(value.blob, /^[a-f0-9]{40}$/);
  assert.match(value.sha256, /^[a-f0-9]{64}$/); assert(Object.isFrozen(value));
};
export function assertEconomyDeedNativeProvenanceDefinition(pin = ECONOMY_DEED_MERGE_NATIVE_PROVENANCE) {
  assert.equal(pin, ECONOMY_DEED_MERGE_NATIVE_PROVENANCE, 'Only the imported native source-provenance definition');
  assert.equal(pin.status, 'SEALED', 'Native source-provenance definition must be sealed');
  assert.equal(sha(JSON.stringify(pin)), ECONOMY_DEED_MERGE_NATIVE_PROVENANCE_SHA256);
  keys(pin, ['version', 'status', 'phase', 'sourceRevision', 'sourceTree', 'predecessorRevision',
    'predecessorDefinitionSha256', 'predecessorMetadataSha256', 'reviewedFiles', 'files',
    'sourceOnly', 'nativeAdmission', 'priorResultsTransferred']);
  assert.equal(pin.version, 1); assert.equal(pin.phase, 'EXACT_ECONOMY_DEED_MERGE_SOURCE_PROVENANCE_ONLY');
  assert.equal(pin.sourceOnly, true); assert.equal(pin.nativeAdmission, false); assert.equal(pin.priorResultsTransferred, false);
  assert.equal(pin.predecessorRevision, PREDECESSOR_NATIVE_INPUTS.authoredRevision);
  assert.equal(pin.predecessorDefinitionSha256, PREDECESSOR_NATIVE_DEFINITION_SHA256);
  assert.equal(sha(JSON.stringify(PREDECESSOR_NATIVE_INPUTS)), PREDECESSOR_NATIVE_DEFINITION_SHA256);
  assert.match(pin.predecessorMetadataSha256, /^[a-f0-9]{64}$/);
  assert.match(pin.sourceRevision, /^[a-f0-9]{40}$/); assert.match(pin.sourceTree, /^[a-f0-9]{40}$/);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.files) && Object.isFrozen(pin.reviewedFiles));
  assert.deepEqual(pin.reviewedFiles, ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES);
  const names = pin.files.map(row => row.file); assert.deepEqual(names, [...new Set(names)].sort());
  for (const row of pin.files) {
    assert(Object.isFrozen(row)); keys(row, ['file', 'current', 'predecessor']);
    assert(ECONOMY_DEED_MERGE_NATIVE_REVIEW_FILES.includes(row.file), 'No unreviewed existing-native source path');
    assertNativePin(row.current); assertNativePin(row.predecessor);
    assert.equal(row.current.file, row.file); assert.equal(row.predecessor.file, row.file);
    assert.deepEqual(row.predecessor, PREDECESSOR_NATIVE_INPUTS.files.find(previous => previous.file === row.file));
    assert.notDeepEqual(row.current, row.predecessor, 'Only changed existing native sources need provenance');
  }
  return pin;
}
export function assertEconomyDeedNativeProvenance(file, current, previous, pin = ECONOMY_DEED_MERGE_NATIVE_PROVENANCE) {
  assertEconomyDeedNativeProvenanceDefinition(pin);
  const row = pin.files.find(row => row.file === file); assert(row, 'No reviewed existing-native source provenance: ' + file);
  assert.deepEqual(current, row.current); assert.deepEqual(previous, row.predecessor);
  return Object.freeze({ ...row, sourceRevision: pin.sourceRevision, predecessorRevision: pin.predecessorRevision,
    relation: 'exact-reviewed-economy-deed-merge-source-provenance-only', nativeAdmission: false, priorResultsTransferred: false });
}
