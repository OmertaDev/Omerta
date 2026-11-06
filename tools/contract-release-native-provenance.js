// Identity-only provenance. The native caller admits actual current/authored raw bytes first.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { CONTRACT_RELEASE_SOURCE_DATA as source, CONTRACT_RELEASE_SOURCE_DATA_SHA256 } from './contract-release-source-data.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as current } from './enterprise-native-contract-release-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as desk, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as deskDefinition } from './enterprise-native-deed-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as predecessor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as predecessorDefinition } from './enterprise-native-ux-b35-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as qualifiedUx, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as qualifiedUxDefinition } from './enterprise-native-ux-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as deed, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as deedDefinition } from './businessdesk-deed-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as accepted, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as acceptedDefinition } from './enterprise-native-economic-release-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as economic, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as economicDefinition } from './enterprise-native-economic-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as economicDeed, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as economicDeedDefinition } from './economic-deed-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_CONTINUOUS_CITY_INPUTS as continuousCity } from './enterprise-native-continuous-city-inputs.js';
import { economicReleaseNativeProvenance, assertEconomicReleaseNativeDefinition } from './economic-release-native-provenance.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as archivedDesk, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as archivedDeskDefinition } from './businessdesk-desk-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as archivedMonitor, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as archivedMonitorDefinition } from './businessdesk-monitor-parent-native-inputs.js';
import { ENTERPRISE_NATIVE_UX_INPUTS as archivedWiki, ENTERPRISE_NATIVE_UX_INPUTS_SHA256 as archivedWikiDefinition } from './businessdesk-wiki-parent-native-inputs.js';
import { CONTRACT_RELEASE_SOURCE_DATA_FILE, contractReleaseSourceDataPin } from './contract-release-source-format.js';

export const CONTRACT_RELEASE_DATA_FILE = CONTRACT_RELEASE_SOURCE_DATA_FILE;
export const CONTRACT_RELEASE_METADATA = 'tools/enterprise-native-contract-release-inputs.js';
export const CONTRACT_RELEASE_DESK_METADATA = 'tools/enterprise-native-deed-inputs.js';
export const CONTRACT_RELEASE_PREDECESSOR_METADATA = 'tools/enterprise-native-economic-release-inputs.js';
export const CONTRACT_RELEASE_CATALOG_METADATA = 'tools/enterprise-native-continuous-city-inputs.js';
export const CONTRACT_RELEASE_HISTORICAL_METADATA = Object.freeze([
  'tools/enterprise-native-ux-b35-inputs.js', 'tools/enterprise-native-ux-inputs.js',
  'tools/businessdesk-deed-native-inputs.js', 'tools/businessdesk-desk-parent-native-inputs.js',
  'tools/businessdesk-monitor-parent-native-inputs.js', 'tools/businessdesk-wiki-parent-native-inputs.js',
  CONTRACT_RELEASE_DESK_METADATA, CONTRACT_RELEASE_PREDECESSOR_METADATA,
  'tools/enterprise-native-economic-inputs.js', 'tools/economic-deed-parent-native-inputs.js',
  CONTRACT_RELEASE_CATALOG_METADATA,
]);
const history = Object.freeze([
  [CONTRACT_RELEASE_HISTORICAL_METADATA[0], predecessor, predecessorDefinition],
  [CONTRACT_RELEASE_HISTORICAL_METADATA[1], qualifiedUx, qualifiedUxDefinition],
  [CONTRACT_RELEASE_HISTORICAL_METADATA[2], deed, deedDefinition],
  [CONTRACT_RELEASE_HISTORICAL_METADATA[3], archivedDesk, archivedDeskDefinition],
  [CONTRACT_RELEASE_HISTORICAL_METADATA[4], archivedMonitor, archivedMonitorDefinition],
  [CONTRACT_RELEASE_HISTORICAL_METADATA[5], archivedWiki, archivedWikiDefinition],
  [CONTRACT_RELEASE_DESK_METADATA, desk, deskDefinition],
  [CONTRACT_RELEASE_PREDECESSOR_METADATA, accepted, acceptedDefinition],
  ['tools/enterprise-native-economic-inputs.js', economic, economicDefinition],
  ['tools/economic-deed-parent-native-inputs.js', economicDeed, economicDeedDefinition],
]);
const digest = value => crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
const record = value => {
  assert(value && Object.getPrototypeOf(value) === Object.prototype, 'Plain contract-release record required');
  for (const key of Reflect.ownKeys(value)) {
    assert.equal(typeof key, 'string', 'No hidden symbol authority');
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    assert(descriptor.enumerable && own(descriptor, 'value'), 'Only enumerable data properties are allowed');
  }
};
const fields = (value, keys) => { record(value); assert.deepEqual(Reflect.ownKeys(value).sort(), keys.slice().sort(), 'Closed contract-release record'); };
const own = (object, key) => Object.hasOwn(object, key);
function frozenData(value, seen = new Set()) {
  if (value === null || ['string', 'boolean'].includes(typeof value)) return;
  if (typeof value === 'number') { assert(Number.isFinite(value)); return; }
  assert(value && typeof value === 'object' && !seen.has(value), 'Only acyclic immutable data is allowed');
  seen.add(value); assert(Object.isFrozen(value));
  if (Array.isArray(value)) {
    assert.equal(Object.getPrototypeOf(value), Array.prototype);
    assert.deepEqual(Reflect.ownKeys(value), [...Array.from({ length: value.length }, (_, index) => String(index)), 'length']);
    for (let index = 0; index < value.length; index++) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      assert(descriptor.enumerable && own(descriptor, 'value')); frozenData(descriptor.value, seen);
    }
  } else {
    record(value);
    for (const key of Reflect.ownKeys(value)) frozenData(Object.getOwnPropertyDescriptor(value, key).value, seen);
  }
  seen.delete(value);
}
const same = (a, b) => a && b && a.file === b.file && a.mode === b.mode && a.blob === b.blob && a.sha256 === b.sha256;
const canonical = file => typeof file === 'string' && !file.includes('\\') && !file.includes(':')
  && !file.includes('\0') && file.split('/').every(part => part && !['.', '..', '.git'].includes(part));
function pin(row, file) {
  assert(row && Object.isFrozen(row)); fields(row, ['file', 'mode', 'blob', 'sha256']);
  assert(canonical(row.file)); if (file !== undefined) assert.equal(row.file, file); assert(['100644', '100755'].includes(row.mode));
  assert.match(row.blob, /^[a-f0-9]{40}$/); assert.match(row.sha256, /^[a-f0-9]{64}$/);
}
let sourceDefinitionChecked = false, acceptedDefinitionChecked = false;
export function assertContractReleaseSourceDefinition() {
  // Once checked, deeply frozen data and const module bindings cannot acquire new authority.
  if (sourceDefinitionChecked) return source;
  frozenData(source);
  fields(source, ['version', 'status', 'phase', 'reviewedContractRevision', 'reviewedUiRevision', 'baseRevision', 'baseTree',
    'sourceRevision', 'sourceTree', 'historicalManifests', 'nativeChanges', 'approvedAdditions', 'sourceViews']);
  assert(Object.isFrozen(source));
  assert.equal(source.status, 'BOUND', 'Contract release source remains UNBOUND until the accepted Desk base is explicit');
  assert.equal(source.version, 1); assert.equal(source.phase, 'EXACT_CONTRACT_RELEASE_SOURCE_ONLY');
  assert.equal(digest(source), CONTRACT_RELEASE_SOURCE_DATA_SHA256, 'Whole contract-release source definition changed');
  assert.equal(source.reviewedContractRevision, 'd70c17d2cd9eb613e8695caf8c6dfc0b60a64a9e');
  assert.equal(source.reviewedUiRevision, 'f3b1fe4768fe2a6ef18dba5edb45bfdb090a04b7');
  for (const key of ['baseRevision', 'baseTree', 'sourceRevision', 'sourceTree']) assert.match(source[key], /^[a-f0-9]{40}$/);
  for (const key of ['historicalManifests', 'nativeChanges', 'approvedAdditions', 'sourceViews']) { record(source[key]); assert(Object.isFrozen(source[key])); }
  assert.deepEqual(Object.keys(source.historicalManifests).sort(), CONTRACT_RELEASE_HISTORICAL_METADATA.slice().sort());
  for (const [file, declaration, definition] of history) {
    record(declaration);
    assert.equal(declaration.status, 'SEALED'); assert(Object.isFrozen(declaration));
    assert.equal(digest(declaration), definition, 'Immutable historical native definition: ' + file);
    pin(source.historicalManifests[file], file);
  }
  frozenData(continuousCity);
  fields(continuousCity, ['status', 'revision', 'predecessor', 'legacyBaseRevision', 'replacements', 'additions']);
  assert.equal(continuousCity.status, 'SEALED');
  assert.equal(digest(continuousCity), '5d3c8f292d7dd378b2e469a431042fd90671fceea3d5b487ce5454a094d80d2b');
  pin(source.historicalManifests[CONTRACT_RELEASE_CATALOG_METADATA], CONTRACT_RELEASE_CATALOG_METADATA);
  assert.equal(source.historicalManifests[CONTRACT_RELEASE_CATALOG_METADATA].sha256, '804f29d96f31767fb3447dc61ed01ca243d9770357923ded125493bb19e71f58');
  assert.equal(source.baseRevision, 'aeae575a9a6a9c874840f0a4481d11cc303b9d0a');
  assert.equal(source.baseTree, 'b45024815077a564ecb48eb35e4835b830d44c2f');
  for (const [file, row] of Object.entries(source.nativeChanges)) {
    assert(canonical(file)); assert(Object.isFrozen(row)); fields(row, ['current', 'predecessor']);
    pin(row.current, file); pin(row.predecessor, file);
    const previous = accepted.files.find(entry => entry.file === file); assert(previous, 'Contract change has an exact Desk subject');
    assert.deepEqual(row.predecessor, previous, 'Contract predecessor is the frozen Desk input');
    assert(!same(row.current, row.predecessor), 'A contract relation must change its exact predecessor');
    assert(!CONTRACT_RELEASE_HISTORICAL_METADATA.includes(file), 'Historical manifests cannot be rewritten');
  }
  for (const [file, row] of Object.entries(source.approvedAdditions)) {
    pin(row, file); assert(!accepted.files.some(entry => entry.file === file), 'Addition cannot replace a Desk input');
    assert(![CONTRACT_RELEASE_DATA_FILE, CONTRACT_RELEASE_METADATA].includes(file), 'No recursive data or metadata identity row');
  }
  sourceDefinitionChecked = true; return source;
}
export function assertContractReleaseCandidatePins(files) {
  assertContractReleaseSourceDefinition();
  assert(Array.isArray(files)); const entries = new Map();
  for (const row of files) { pin(row); assert(!entries.has(row.file), 'No duplicate actual candidate inputs'); entries.set(row.file, row); }
  for (const file of CONTRACT_RELEASE_HISTORICAL_METADATA) assert.deepEqual(entries.get(file), source.historicalManifests[file], 'Frozen historical raw input: ' + file);
  for (const row of accepted.files) assert(entries.has(row.file), 'Every accepted predecessor subject remains in the current closure: ' + row.file);
  const usedChanges = new Set(), usedAdditions = new Set();
  for (const row of files) {
    assert.notEqual(row.file, CONTRACT_RELEASE_METADATA, 'Only the current manifest is self-referential');
    const stage = accepted.files.find(entry => entry.file === row.file);
    if (stage && same(row, stage)) continue;
    if (stage) {
      assert(own(source.nativeChanges, row.file), 'Unlisted change to a Desk input: ' + row.file);
      assert.deepEqual(row, source.nativeChanges[row.file].current); usedChanges.add(row.file);
    } else if (CONTRACT_RELEASE_HISTORICAL_METADATA.includes(row.file)) {
      assert.deepEqual(row, source.historicalManifests[row.file], 'A former self-reference is now an exact ordinary historical input');
    } else if (row.file === CONTRACT_RELEASE_DATA_FILE) {
      // Ordinary raw capture must match the sole canonical data format, not merely its exported object.
      assert.deepEqual(row, contractReleaseSourceDataPin(source), 'Canonical non-executable data-module pin required');
    } else {
      assert(own(source.approvedAdditions, row.file), 'Unlisted new native input: ' + row.file);
      assert.deepEqual(row, source.approvedAdditions[row.file]); usedAdditions.add(row.file);
    }
  }
  assert(entries.has(CONTRACT_RELEASE_DATA_FILE), 'The source data is an ordinary exact authored input');
  assert.deepEqual([...usedChanges].sort(), Object.keys(source.nativeChanges).sort(), 'Every closed native change is captured');
  assert.deepEqual([...usedAdditions].sort(), Object.keys(source.approvedAdditions).sort(), 'Every approved native addition is captured');
  return source;
}
export function assertContractReleaseNativeDefinition(declaration) {
  assert.strictEqual(declaration, current, 'Only the actual current contract manifest');
  assert.equal(declaration.status, 'SEALED'); assert.equal(declaration.version, 4);
  assert.equal(declaration.phase, 'ACTUAL_ENTERPRISE_CONTRACT_RELEASE_NATIVE_INPUTS');
  assertContractReleaseCandidatePins(declaration.files);
  assert.equal(declaration.contractPredecessorRevision, accepted.authoredRevision);
  assert.equal(declaration.contractPredecessorMetadataSha256, source.historicalManifests[CONTRACT_RELEASE_PREDECESSOR_METADATA].sha256);
  assert.equal(declaration.contractSourceDefinitionSha256, CONTRACT_RELEASE_SOURCE_DATA_SHA256);
  assert.equal(declaration.contractSourceRevision, source.sourceRevision); assert.equal(declaration.contractBaseRevision, source.baseRevision);
  assert.equal(declaration.reviewedContractRevision, source.reviewedContractRevision); assert.equal(declaration.reviewedUiRevision, source.reviewedUiRevision);
  return source;
}
export function contractReleaseNativeProvenance(file, previous, expected, declaration = current) {
  assert.strictEqual(declaration, current, 'Caller cannot substitute current native authority');
  assert.equal(declaration.status, 'SEALED', 'An unsealed declaration cannot supply current provenance');
  assertContractReleaseSourceDefinition();
  assert.strictEqual(expected, current.files.find(row => row.file === file), 'Only the canonical actual-current row');
  assert(expected, 'A declared actual current input is required');
  const original = predecessor.files.find(row => row.file === file);
  assert.strictEqual(previous, original, 'Only the canonical original native predecessor');
  const stage = accepted.files.find(row => row.file === file);
  let changed = false;
  if (stage) {
    if (!same(expected, stage)) {
      assert(own(source.nativeChanges, file), 'No unlisted contract native change: ' + file);
      const relation = source.nativeChanges[file]; assert.deepEqual(expected, relation.current); assert.deepEqual(stage, relation.predecessor);
      changed = true;
    }
  } else if (CONTRACT_RELEASE_HISTORICAL_METADATA.includes(file)) {
    assert.deepEqual(expected, source.historicalManifests[file]); assert(!original); changed = true;
  } else if (file === CONTRACT_RELEASE_DATA_FILE) {
    assert.deepEqual(expected, contractReleaseSourceDataPin(source), 'Canonical non-executable data-module pin required');
    // Raw mode/blob/hash have already been checked; this derived pin introduces no self-hash relation.
    assert(!original); changed = true;
  } else {
    assert(own(source.approvedAdditions, file), 'No unlisted contract native addition: ' + file);
    assert.deepEqual(expected, source.approvedAdditions[file]); assert(!original); changed = true;
  }
  if (!original) return changed ? Object.freeze({ file, current: expected, predecessor: null, intermediate: stage || null,
    intermediateRevision: stage ? accepted.authoredRevision : null,
    relation: 'exact-authored-contract-release-addition-only', nativeAdmission: false, priorResultsTransferred: false }) : null;
  assert(stage, 'Every original native input remains in the frozen Desk inventory');
  if (!changed && same(original, expected)) return null;
  let prior = null;
  if (!same(original, stage)) {
    // The upstream helper accepts only its canonical V7 row after Root raw admission.
    if (!acceptedDefinitionChecked) { assertEconomicReleaseNativeDefinition(accepted); acceptedDefinitionChecked = true; }
    prior = economicReleaseNativeProvenance(file, stage);
    assert(prior && Object.isFrozen(prior), 'Changed historical input needs its accepted predecessor proof');
    assert(same(prior.current, stage) || (prior.current.mode === stage.mode && prior.current.blob === stage.blob && prior.current.sha256 === stage.sha256));
    assert.equal(prior.nativeAdmission, false); assert.equal(prior.priorResultsTransferred, false);
  }
  return Object.freeze({ file, current: expected, predecessor: original, predecessorRevision: predecessor.authoredRevision,
    intermediate: stage, intermediateRevision: accepted.authoredRevision, prior,
    relation: 'exact-reviewed-contract-release-source-provenance-only', nativeAdmission: false, priorResultsTransferred: false });
}
