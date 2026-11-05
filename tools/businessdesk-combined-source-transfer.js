// Exact historical comparison views only. Never pass a projection to native/runtime execution.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 } from './businessdesk-combined-source-data.js';

export { BUSINESS_DESK_COMBINED_SOURCE, BUSINESS_DESK_COMBINED_SOURCE_SHA256 };
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const BUSINESS_DESK_COMBINED_PROFILES = freeze({
  desk: { revision: 'de84c0f7b3dfb18b8cb44e9b3a4563ad890d0660', tree: '147add1847b8b34e019f1a24afaa9c1d48e538f7' },
  monitor: { revision: '2cab2105b679ff6ddf4723bea37bc5c0f4ce2335', tree: '4394bdd69c211291a767ac0a4d810b8dc00dfc8f' },
  wiki: { revision: '6c4d37842f4d7ebd7f96d5fee9935720f442007a', tree: 'ca38e8e705f4d48df651a843b7f28d93d720a963' },
});
export const BUSINESS_DESK_COMBINED_READER_FILES = freeze({
  desk: ['.github/workflows/ci.yml', 'package.json', 'public/index.html', 'public/omerta-ui.css', 'public/ux-feedback.js',
    'public/ux-navigation.js', 'public/ux-tactics.js', 'public/ux-world.js', 'src/server.js', 'test/classic-interface-browser.js',
    'test/deed-allocation-source-compatibility.js', 'test/gates.js', 'test/lib/enterprise-ux-native-guard.js',
    'test/ux-community-browser.js', 'test/ux-expanded-browser.js', 'test/ux-experience-browser.js',
    'test/ux-personality-browser.js', 'test/ux-shell-browser.js', 'test/ux-story-browser.js',
    'tools/deed-allocation-source-transfer.js', 'tools/enterprise-native-ux-seal.js', 'tools/enterprise-native-ux.js'],
  monitor: ['.github/workflows/economy-hardening.yml', 'package.json', 'public/index.html', 'public/omerta-ui.css',
    'public/ux-feedback.js', 'public/ux-navigation.js', 'public/ux-tactics.js', 'public/ux-world.js', 'schema.sql',
    'src/economy-monitor.js', 'src/game.js', 'src/invariants.js', 'src/preflight.js', 'src/worker.js',
    'test/classic-interface-browser.js', 'test/client.js', 'test/economy-composition-restart.js', 'test/economy-composition.js',
    'test/economy-hardening-source-compatibility.js', 'test/economy-monitor.js', 'test/lib/enterprise-ux-native-guard.js',
    'test/lib/ux-native-reader-source-compatibility.js', 'test/sale-source-compatibility.js', 'test/ux-community-browser.js',
    'test/ux-expanded-browser.js', 'test/ux-experience-browser.js', 'test/ux-personality-browser.js',
    'test/ux-shell-browser.js', 'test/ux-story-browser.js', 'tools/economy-ux-merge-source-compatibility.js',
    'tools/enterprise-native-ux-seal.js', 'tools/enterprise-native-ux.js', 'tools/enterprise-native.js',
    'tools/mobile.js', 'tools/pgquery.js', 'tools/ux-release-phase2-native-catalog.js'],
  wiki: ['MARKETING-POSTS.md', 'SPEC.md', 'docs/WIKI.md', 'package.json', 'public/index.html', 'public/omerta-ui.css',
    'public/ux-feedback.js', 'public/ux-navigation.js', 'public/ux-tactics.js', 'public/ux-world.js', 'public/wiki.html',
    'src/server.js', 'test/classic-interface-browser.js', 'test/client.js', 'test/decision-guide-client.js',
    'test/deed-allocation-source-compatibility.js', 'test/economy-hardening-source-compatibility.js',
    'test/lib/enterprise-ux-native-guard.js', 'test/lib/ux-journeys.js', 'test/lib/ux-native-reader-source-compatibility.js',
    'test/noir-ui-source-compatibility.js', 'test/sale-source-compatibility.js', 'test/ux-community-browser.js',
    'test/ux-expanded-browser.js', 'test/ux-experience-browser.js', 'test/ux-feedback.js', 'test/ux-personality-browser.js',
    'test/ux-story-browser.js', 'test/vig.js', 'test/wiki-media-source-transfer.js', 'tools/deed-allocation-source-transfer.js',
    'tools/economy-social-proof-cutover-source-transfer.js', 'tools/economy-ux-merge-source-compatibility.js',
    'tools/enterprise-native-ux-seal.js', 'tools/enterprise-native-ux.js', 'tools/mobile.js',
    'tools/noir-ui-source-transfer.js', 'tools/public-ui.js', 'tools/wiki-media-source-transfer.js'],
});
// The Monitor's separately pinned release-roster proof reads this existing file
// outside its base 10/18/Noir union. It already belongs to the global 55 paths.
export const BUSINESS_DESK_COMBINED_EXTRA_READERS = freeze({ desk: [], monitor: ['test/gates.js'], wiki: [] });
export const BUSINESS_DESK_COMBINED_SOURCE_FILES = Object.freeze([...new Set(Object.values(BUSINESS_DESK_COMBINED_READER_FILES).flat())].sort());
export const BUSINESS_DESK_COMBINED_EXCLUDED_FILES = Object.freeze([
  'tools/enterprise-native-deed-inputs.js', 'tools/enterprise-native-ux-b35-inputs.js',
  'tools/enterprise-native-ux-inputs.js', 'tools/businessdesk-deed-native-inputs.js',
  'tools/businessdesk-desk-parent-native-inputs.js', 'tools/businessdesk-monitor-parent-native-inputs.js',
  'tools/businessdesk-wiki-parent-native-inputs.js',
]);
export const BUSINESS_DESK_COMBINED_PHASE = 'EXACT_MONITOR_WIKI_DESK_SOURCE_ONLY';
const keys = (value, expected) => assert.deepEqual(Object.keys(value).sort(), [...expected].sort());
const sha = text => crypto.createHash('sha256').update(text).digest('hex');
const blob = text => crypto.createHash('sha1').update(`blob ${Buffer.byteLength(text)}\0`).update(text).digest('hex');
const lf = text => text.replaceAll('\r\n', '\n');
const uniform = text => typeof text === 'string' && !text.includes('\ufeff') && !text.includes('\0')
  && Buffer.from(text).toString('utf8') === text && !lf(text).includes('\r')
  && (text === lf(text) || text === lf(text).replaceAll('\n', '\r\n'));
const profileOf = profile => assert(typeof profile === 'string' && Object.hasOwn(BUSINESS_DESK_COMBINED_PROFILES, profile), 'An explicit reviewed Desk/Monitor/Wiki profile is required');
export const businessDeskCombinedReaderFiles = profile => {
  profileOf(profile);
  return Object.freeze([...new Set([...BUSINESS_DESK_COMBINED_READER_FILES[profile], ...BUSINESS_DESK_COMBINED_EXTRA_READERS[profile]])].sort());
};

function definition(pin) {
  assert.strictEqual(pin, BUSINESS_DESK_COMBINED_SOURCE, 'Only the imported combined source definition');
  assert.equal(pin.status, 'SEALED', 'Combined source catalog is unbound');
  assert.equal(sha(JSON.stringify(pin)), BUSINESS_DESK_COMBINED_SOURCE_SHA256, 'Combined source definition drift');
  keys(pin, ['version', 'status', 'phase', 'sourceRevision', 'sourceTree', 'contextLines', 'profiles', 'files', 'sourceOnly', 'runtime', 'native']);
  assert.equal(pin.version, 1); assert.equal(pin.phase, BUSINESS_DESK_COMBINED_PHASE); assert.equal(pin.contextLines, 8);
  assert.equal(pin.sourceOnly, true); assert.equal(pin.runtime, false); assert.equal(pin.native, false);
  assert.match(pin.sourceRevision, /^[a-f0-9]{40}$/); assert.match(pin.sourceTree, /^[a-f0-9]{40}$/);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.profiles) && Object.isFrozen(pin.files));
  assert.deepEqual(pin.profiles, BUSINESS_DESK_COMBINED_PROFILES);
  assert(Object.values(pin.profiles).every(Object.isFrozen));
  const names = pin.files.map(row => row.file); assert.deepEqual(names, [...new Set(names)].sort());
  assert(names.every(file => BUSINESS_DESK_COMBINED_SOURCE_FILES.includes(file) && !BUSINESS_DESK_COMBINED_EXCLUDED_FILES.includes(file)));
}
function fingerprint(text, pin) {
  keys(pin, ['mode', 'blob', 'sha256', 'bytes', 'rawSha256']);
  assert(Object.isFrozen(pin) && Object.isFrozen(pin.rawSha256));
  keys(pin.rawSha256, ['lf', 'crlf']); assert(['100644', '100755'].includes(pin.mode));
  const normalized = lf(text);
  assert.equal(sha(text), pin.rawSha256[text === normalized ? 'lf' : 'crlf'], 'Whole raw comparison source drift');
  assert.equal(sha(normalized), pin.sha256); assert.equal(blob(normalized), pin.blob); assert.equal(Buffer.byteLength(normalized), pin.bytes);
}
export function assertBusinessDeskCombinedSourceTransfer(file, input, profile, pin = BUSINESS_DESK_COMBINED_SOURCE) {
  profileOf(profile); definition(pin);
  assert(typeof file === 'string' && BUSINESS_DESK_COMBINED_SOURCE_FILES.includes(file), 'Unknown combined comparison domain');
  assert(businessDeskCombinedReaderFiles(profile).includes(file), 'The file is outside this parent reader profile');
  const row = pin.files.find(value => value.file === file);
  assert(row && Object.hasOwn(row.parents, profile), 'No changed reviewed parent source for this file/profile');
  keys(row, ['file', 'current', 'parents']); assert(Object.isFrozen(row) && Object.isFrozen(row.parents));
  assert(Object.keys(row.parents).length > 0 && Object.keys(row.parents).every(name => Object.hasOwn(BUSINESS_DESK_COMBINED_PROFILES, name)));
  assert(uniform(input), 'Complete uniform LF/CRLF lossless UTF-8 comparison source required');
  fingerprint(input, row.current);
  const parent = row.parents[profile]; assert(Object.isFrozen(parent) && Object.isFrozen(parent.inverses));
  keys(parent, ['mode', 'blob', 'sha256', 'bytes', 'rawSha256', 'inverses']);
  assert(parent.inverses.every(Object.isFrozen));
  const current = lf(input); let targetText = current, end = -1;
  for (const inverse of parent.inverses) {
    keys(inverse, ['current', 'target']); assert.equal(typeof inverse.current, 'string'); assert.equal(typeof inverse.target, 'string');
    assert(inverse.current.length && !inverse.current.includes('\r') && !inverse.target.includes('\r'));
    assert.equal(current.split(inverse.current).length, 2, 'Unique complete combined comparison context');
    const at = current.indexOf(inverse.current); assert(at >= end, 'Ordered nonoverlapping combined comparison contexts'); end = at + inverse.current.length;
    assert.equal(targetText.split(inverse.current).length, 2, 'Missing or duplicate combined inverse');
    targetText = targetText.replace(inverse.current, () => inverse.target);
  }
  const { inverses, ...targetPin } = parent;
  fingerprint(targetText, Object.freeze(targetPin));
  fingerprint(targetText.replaceAll('\n', '\r\n'), Object.freeze(targetPin));
  assert(row.current.mode !== parent.mode || row.current.blob !== parent.blob, 'Unchanged parents need no top-level projection');
  return Object.freeze({ file, targetText, profile, parentRevision: pin.profiles[profile].revision,
    sourceRevision: pin.sourceRevision, sourceTree: pin.sourceTree, inverseChunks: inverses.length,
    phase: pin.phase, sourceOnly: true, runtime: false, native: false });
}

export function businessDeskCombinedHistoricalInput(file, input, profile) {
  profileOf(profile);
  if (BUSINESS_DESK_COMBINED_SOURCE.status !== 'SEALED' || typeof file !== 'string') return input;
  const row = BUSINESS_DESK_COMBINED_SOURCE.files.find(value => value.file === file);
  if (!row || !Object.hasOwn(row.parents, profile)) return input;
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical comparison source required');
  if (!uniform(text) || sha(text) !== row.current.rawSha256[text === lf(text) ? 'lf' : 'crlf'] || sha(lf(text)) !== row.current.sha256) return input;
  const target = assertBusinessDeskCombinedSourceTransfer(file, text, profile).targetText;
  return buffer ? Buffer.from(target) : target;
}
