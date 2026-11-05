// Pure canonical data-module format. This never reconstructs a historical source view.
import crypto from 'node:crypto';

export const CONTRACT_RELEASE_SOURCE_DATA_FILE = 'tools/contract-release-source-data.js';
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');

export function contractReleaseSourceDataBytes(value) {
  const digest = sha256(JSON.stringify(value));
  return Buffer.from('// Generated closed contract-release source binding; UNBOUND is deliberately unaccepted.\n'
    + '// Source views never grant runtime, native, migration, financial or deployment clearance.\n'
    + "const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };\n"
    + 'export const CONTRACT_RELEASE_SOURCE_DATA = freeze(' + JSON.stringify(value, null, 2) + ');\n'
    + 'export const CONTRACT_RELEASE_SOURCE_DATA_SHA256 = ' + JSON.stringify(digest) + ';\n');
}

export function contractReleaseSourceDataPin(value) {
  const bytes = contractReleaseSourceDataBytes(value);
  return Object.freeze({ file: CONTRACT_RELEASE_SOURCE_DATA_FILE, mode: '100644',
    blob: crypto.createHash('sha1').update('blob ' + bytes.length + '\0').update(bytes).digest('hex'),
    sha256: sha256(bytes) });
}
