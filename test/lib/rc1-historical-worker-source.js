// Closed historical loader fixtures only; release C2 is a rejection control.
// These bytes never grant current runtime, native, financial or deployment admission.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import {
  COVERAGE_SOURCE_REVIEWED_REVISION, COVERAGE_SOURCE_PREDECESSOR_REVISION,
  COVERAGE_SOURCE_CURRENT_PINS, COVERAGE_SOURCE_BASELINE_PINS,
  COVERAGE_SOURCE_CURRENT_BLOBS, COVERAGE_SOURCE_BASELINE_BLOBS,
} from '../../tools/rc1-logistics-coverage-source-compatibility.js';

const file = 'src/db.js';
const fixtures = Object.freeze({
  current: Object.freeze({ revision: COVERAGE_SOURCE_REVIEWED_REVISION,
    blob: COVERAGE_SOURCE_CURRENT_BLOBS[file], sha256: COVERAGE_SOURCE_CURRENT_PINS[file] }),
  prior: Object.freeze({ revision: COVERAGE_SOURCE_PREDECESSOR_REVISION,
    blob: COVERAGE_SOURCE_BASELINE_BLOBS[file], sha256: COVERAGE_SOURCE_BASELINE_PINS[file] }),
  'release-c2': Object.freeze({ revision: 'b90bd95dee6e0fda851247cc660288f4bbf8fdc0',
    blob: 'ce9dd3d53b9c6e22b409b1ca7150a27dad16ea13',
    sha256: 'dabe71959257fe28a99c08be900e5b9ad0979144af41a121b0fcab24f9326808' }),
});

export function historicalWorkerDatabaseSource(name) {
  assert(Object.hasOwn(fixtures, name), 'Unknown historical worker source fixture');
  const expected = fixtures[name];
  const git = args => execFileSync('git', args, { maxBuffer: 4 * 1024 * 1024 });
  assert.equal(String(git(['rev-parse', `${expected.revision}:${file}`])).trim(), expected.blob,
    'Historical worker fixture revision/blob binding changed');
  const bytes = git(['cat-file', 'blob', expected.blob]);
  assert.equal(crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), expected.blob,
    'Historical worker fixture complete Git blob changed');
  const source = String(bytes);
  assert.equal(source.replaceAll('\r\n', '\n'), source, 'Pinned Git fixture must be canonical LF');
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'), expected.sha256,
    'Historical worker fixture canonical source hash changed');
  return source;
}
