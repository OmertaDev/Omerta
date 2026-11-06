// Exact comparison-only successor. Runtime and native checks always use physical source.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { recoverySource } from './ci-deed-recovery-source-data.js';

const sha = value => createHash('sha256').update(value).digest('hex');
const blob = value => createHash('sha1').update('blob ' + Buffer.byteLength(value) + '\0').update(value).digest('hex');
const expectedDigest = 'a6ddd58b762c38c92a08df5a774570c2d26caf83547718db08111b6faf93c478';
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export const CI_DEED_RECOVERY_SOURCE = freeze(recoverySource);
function definition() {
  assert.equal(recoverySource.status, 'SEALED', 'Bind the authored CI/Deed successor before source comparison');
  assert.equal(sha(JSON.stringify(recoverySource)), expectedDigest, 'The reviewed CI/Deed comparison envelope changed');
  assert.equal(recoverySource.predecessor, '0ce6ab96a34e6061232980ad60bfdbc94cf98fdb');
}
function canonical(input) {
  const buffer = Buffer.isBuffer(input), text = buffer ? input.toString('utf8') : input;
  if (buffer) assert(Buffer.from(text).equals(input), 'Lossless UTF-8 physical source only; lossless UTF-8 required');
  if (typeof text !== 'string') return null;
  const lf = text.replaceAll('\r\n', '\n');
  if (lf.includes('\r') || (text !== lf && text !== lf.replaceAll('\n', '\r\n'))) return null;
  return { buffer, text, lf };
}
function fingerprint(text, pin) {
  assert.equal(Buffer.byteLength(text), pin.bytes); assert.equal(sha(text), pin.sha256); assert.equal(blob(text), pin.blob);
}
export function qualifyCiDeedRecoverySource(file, input) {
  definition();
  assert(typeof file === 'string' && Object.hasOwn(recoverySource.files, file), 'Only the closed CI/Deed successor domains');
  const source = canonical(input); assert(source, 'Complete uniform LF/CRLF source required');
  const row = recoverySource.files[file]; fingerprint(source.lf, row.current);
  let baseline = source.lf;
  for (const hunk of row.inverses.toReversed()) {
    assert.equal(baseline.slice(hunk.at, hunk.at + hunk.current.length), hunk.current);
    baseline = baseline.slice(0, hunk.at) + hunk.baseline + baseline.slice(hunk.at + hunk.current.length);
  }
  fingerprint(baseline, row.baseline);
  return Object.freeze({ baselineText: baseline, sourceRevision: recoverySource.revision,
    sourceTree: recoverySource.tree, predecessor: recoverySource.predecessor,
    sourceOnly: true, runtime: false, native: false, priorResultsTransferred: false });
}
export function ciDeedRecoveryHistoricalInput(file, input) {
  if (typeof file !== 'string' || !Object.hasOwn(recoverySource.files, file)) return input;
  const source = canonical(input), row = recoverySource.files[file];
  if (!source || sha(source.lf) !== row.current.sha256) return input;
  const baseline = qualifyCiDeedRecoverySource(file, input).baselineText;
  return source.buffer ? Buffer.from(baseline) : baseline;
}
// Call only at explicit historical-comparison assertions. Actual entry bytes qualify first.
export function ciDeedRecoveryHistoricalEntry(file, entry, kind) {
  assert(kind === 'tree' || kind === 'index', 'Explicit current Git identity shape required');
  if (!Object.hasOwn(recoverySource.files, file)) return entry;
  definition();
  const row = recoverySource.files[file], format = pin => kind === 'tree'
    ? pin.mode + ' blob ' + pin.blob + '\t' + file
    : pin.mode + ' ' + pin.blob + ' 0\t' + file;
  assert(typeof entry === 'string' && (entry === format(row.current) || entry === format(row.current) + '\n'),
    'Exact actual current Git identity qualifies before the CI/Deed comparison');
  return format(row.baseline) + (entry.endsWith('\n') ? '\n' : '');
}
export function ciDeedRecoveryHistoricalRecord(file, record) {
  if (!Object.hasOwn(recoverySource.files, file)) return record;
  assert(record && Buffer.isBuffer(record.raw));
  const row = recoverySource.files[file];
  assert.equal(typeof record.content, 'string');
  assert(!record.content.includes('\r'), 'Committed Git records require canonical LF; physical LF/CRLF is admitted separately');
  fingerprint(record.content, row.current);
  assert(record.raw.equals(Buffer.from(record.content)), 'Complete current Git record bytes qualify first');
  assert.deepEqual(record.pin, { ...row.current, rawSha256: { lf: row.current.sha256,
    crlf: sha(record.content.replaceAll('\n', '\r\n')) } }, 'Every actual current Git-record field qualifies first');
  const content = qualifyCiDeedRecoverySource(file, record.raw).baselineText, raw = Buffer.from(content);
  return { raw, content, pin: { ...row.baseline, rawSha256: { lf: sha(raw), crlf: sha(content.replaceAll('\n', '\r\n')) } } };
}
