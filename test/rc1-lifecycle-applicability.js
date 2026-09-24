import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { verifyLifecycleSources, reviewWorkloadLifecycleApplicability } from '../tools/rc1-lifecycle-applicability.js';

const hash = value => sha256(canonicalJson(value)), copy = value => structuredClone(value);
const source = await verifyLifecycleSources({ sourceRevision: '92f09bb436d9e7cacb874adb60f7238c0b1d709d', readFile: file => fs.readFile(file) });
for (const ending of ['\n', '\r\n']) assert.deepEqual(await verifyLifecycleSources({ sourceRevision: source.sourceRevision,
  readFile: async file => (await fs.readFile(file, 'utf8')).replace(/\r?\n/g, ending) }), source);
await assert.rejects(verifyLifecycleSources({ sourceRevision: source.sourceRevision,
  readFile: file => file === 'src/brokers.js' ? 'changed' : fs.readFile(file) }), /source changed/);
const reference = path => ({ path, sha256: hash(path) }), startAt = 1790204400000, endAt = 1790208000000;
function snapshot(account = {}) {
  const data = { tables: { characters: [JSON.stringify({ alive: true, is_npc: false })],
    account_persistent: [JSON.stringify({ account_id: 'a', ...account })], broker_activations: [] }, sequences: [] };
  return { ...data, stateSha256: hash(data) };
}
function fixture() {
  const configurationSha256 = hash('isolated local config'), initialSnapshot = snapshot(), finalSnapshot = snapshot();
  const binding = { sourceRevision: source.sourceRevision, configurationSha256 };
  return { source, configurationSha256, startAt, endAt, initialSnapshot, finalSnapshot, reviewEvidence: reference('review.json'),
    configurationEvidence: { binding, evidence: reference('config.json'), external: { chainWatcher: 'DORMANT_UNCONFIGURED',
      liquidityAutomation: 'DISABLED_LOCAL_CONFIG', rwaRegistry: 'UNAVAILABLE_LOCAL_CONFIG' } },
    workload: { binding: { ...binding, initialStateSha256: initialSnapshot.stateSha256, finalStateSha256: finalSnapshot.stateSha256,
      fromLogicalAt: startAt, throughLogicalAt: endAt }, complete: true, canonicalDispatchOnly: true, originalWorkersOnly: true,
      evidence: reference('sealed-invocation-union.json'), calls: [{ kind: 'http', method: 'GET', path: '/v1/me' },
        { kind: 'http', method: 'POST', path: '/v1/commands' }, { kind: 'player-command', commandType: 'knowledge.share' },
        { kind: 'canonical-crime', handler: 'game.doCrime' },
        { kind: 'canonical-read', handler: 'game.readCharacter' }, { kind: 'canonical-read', handler: 'player.snapshot' },
        { kind: 'canonical-read', handler: 'knowledge.board' }] } };
}
const input = fixture(), before = JSON.stringify(input), result = reviewWorkloadLifecycleApplicability(input);
assert.equal(JSON.stringify(input), before); assert.equal(result.complete, true); assert.equal(result.matrixQualifying, false);
assert.equal(result.lifecycles.find(row => row.id === 'season').applicability, 'APPLICABLE');
assert(result.lifecycles.filter(row => row.id !== 'season').every(row => row.applicability === 'NOT_APPLICABLE'));
for (const [path, body, ids] of [['/v1/made', {}, ['made-membership']], ['/v1/brokers/activate', {}, ['broker-activation']],
  ['/v1/stake/lock', { tier: 'quarter' }, ['stake-lock-quarter']], ['/v1/stake/lock', {}, ['stake-lock-week', 'stake-lock-month', 'stake-lock-quarter']]]) {
  const changed = fixture(); changed.workload.calls.push({ kind: 'http', method: 'POST', path, body });
  const reviewed = reviewWorkloadLifecycleApplicability(changed);
  for (const id of ids) assert.equal(reviewed.lifecycles.find(row => row.id === id).applicability, 'APPLICABLE', 'An intermediate opened-and-expired timer remains applicable even with empty endpoint snapshots');
}
{
  const changed = fixture(); changed.initialSnapshot = snapshot({ stake_lock_until: new Date(startAt + 86400000).toISOString(), stake_lock_mult: 1.5 });
  changed.workload.binding.initialStateSha256 = changed.initialSnapshot.stateSha256;
  assert.equal(reviewWorkloadLifecycleApplicability(changed).lifecycles.find(row => row.id === 'stake-lock-month').applicability, 'APPLICABLE');
}
for (const mutate of [row => row.workload.complete = false, row => row.workload.originalWorkersOnly = false,
  row => row.workload.calls.push({ kind: 'direct-domain', handler: 'unknown' }), row => row.workload.calls.push({ kind: 'http', method: 'POST', path: '/v1/%6dade' })]) {
  const changed = fixture(); mutate(changed); const reviewed = reviewWorkloadLifecycleApplicability(changed);
  assert.equal(reviewed.complete, false); assert(reviewed.lifecycles.some(row => row.applicability === 'UNKNOWN'));
}
{
  const changed = fixture(); delete changed.configurationEvidence.external;
  assert.equal(reviewWorkloadLifecycleApplicability(changed).complete, false, 'Dormant external scope needs actual configuration evidence');
  changed.workload.binding.throughLogicalAt++;
  assert.throws(() => reviewWorkloadLifecycleApplicability(changed));
}
const corrupt = copy(input); corrupt.finalSnapshot.tables.account_persistent.push('{}');
assert.throws(() => reviewWorkloadLifecycleApplicability(corrupt), /snapshot changed/);
console.log('PASS rc1-lifecycle-applicability: source/config/snapshot/invocation joins; scoped dormant paid rails; initialized/intermediate locks preserved; unknown dispatch remains unknown; no duration extraction');
