import assert from 'node:assert/strict';
import { validateHistoryStorage } from './rc1-native-proof-gzip.js';

const fields = {
  'history-max-decoded-bytes': 'maximumDecodedBytes', 'history-max-stored-bytes': 'maximumStoredBytes',
  'history-max-line-bytes': 'maximumLineBytes', 'history-max-outstanding-invocations': 'maximumOutstandingInvocations',
  'history-max-pending-records': 'maximumPendingRecords',
};
export function parseWorldHistoryStorage(argv) {
  const keys = ['history-encoding', ...Object.keys(fields)], provided = new Map();
  for (const argument of argv) {
    if (!argument.startsWith('--history-')) continue;
    const match = /^--([^=]+)=(.+)$/.exec(argument);
    assert(match && keys.includes(match[1]), 'Unknown or malformed history storage flag');
    assert(!provided.has(match[1]), 'Duplicate history storage flag'); provided.set(match[1], match[2]);
  }
  if (!provided.size) return undefined;
  assert.equal(provided.size, keys.length, 'Declare gzip encoding and all five history limits together');
  assert.equal(provided.get('history-encoding'), 'gzip', 'Only explicit gzip opt-in is supported; omit flags for identity');
  const result = { encoding: 'gzip', framing: 'event-members-v1' };
  for (const [flag, field] of Object.entries(fields)) {
    assert(/^[1-9][0-9]*$/.test(provided.get(flag)), `History limit must be a positive decimal integer: ${flag}`);
    result[field] = Number(provided.get(flag));
  }
  return validateHistoryStorage(result);
}

export function assertWorldHistoryStorage(run, historyStorage) {
  assert.deepEqual(run.historyStorage, historyStorage, 'Prior history storage choice or limits differ');
  assert.deepEqual(run.configuration.historyStorage, historyStorage, 'Prior configured history storage differs');
  if (historyStorage) assert.equal(run.format, 2, 'Compressed history requires format2');
  else assert.equal(run.format, 1, 'Identity history requires format1');
}

// Failed recording must not short-circuit native cleanup. The default identity
// error behavior is unchanged. Every new capture error remains in FAIL results.
export async function retainWorldFailure(operation, { historyStorage, result }) {
  if (!historyStorage) return operation();
  try { return await operation(); }
  catch (error) { (result.captureErrors ||= []).push({ message: error.message, code: error.code || null }); return undefined; }
}
