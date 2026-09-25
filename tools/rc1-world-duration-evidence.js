// Measurements from the existing native worker trace; no clock or worker changes.
import assert from 'node:assert/strict';
import { canonicalJson, sha256 } from './rc1-native-proof.js';
import { WORKER_SOURCE_PINS } from './rc1-native-worker.js';

const SEASON_MS = 28 * 86400000;
const hash = value => sha256(canonicalJson(value));
const digest = value => /^[a-f0-9]{64}$/.test(value || '');

export function measureWorldWorkerDuration({ sourceRevision, configurationSha256, startAt, endAt,
  trace, evidence, expectedDormant = [] }) {
  assert(/^[a-f0-9]{40}$/.test(sourceRevision) && digest(configurationSha256));
  assert(evidence?.path && digest(evidence.sha256));
  assert(Number.isSafeInteger(startAt) && Number.isSafeInteger(endAt) && endAt >= startAt);
  assert(trace.start <= startAt && trace.logicalAt === endAt);
  assert.equal(trace.failures.length, 0, 'Original worker reported a failure');
  assert.equal(trace.scheduleSha256, hash(trace.events.filter(row => row.kind !== 'callback.wall-duration')));
  for (const [file, pinnedLfSha256] of Object.entries(WORKER_SOURCE_PINS)) {
    const edit = trace.transformations.find(row => row.file === file);
    assert(edit && edit.pinnedLfSha256 === pinnedLfSha256, 'Worker transformation source mismatch: ' + file);
    assert.equal(sha256(edit.originalSource.replaceAll('\r\n', '\n')), pinnedLfSha256);
    assert.equal(sha256(edit.transformedSource), edit.transformedSourceSha256);
  }
  const timers = new Map(), counts = {}, callbackCounts = {};
  let priorAt = trace.start, pendingFire = null, callback = null;
  for (const [index, event] of trace.events.entries()) {
    assert.equal(event.sequence, index + 1, 'Worker event sequence gap');
    assert(Number.isSafeInteger(event.logicalAt) && event.logicalAt >= priorAt && event.logicalAt <= endAt);
    priorAt = event.logicalAt;
    if (event.kind === 'timer.register') {
      assert(!timers.has(event.id) && Number.isSafeInteger(event.period) && event.period > 0);
      assert.equal(event.due, event.logicalAt + event.period);
      timers.set(event.id, { id: event.id, label: event.label, repeat: event.repeat, period: event.period,
        due: event.due, callbackSha256: event.callbackSha256 });
    } else if (event.kind === 'timer.clear') {
      assert(timers.delete(event.id), 'Unknown timer cancellation');
    } else if (event.kind === 'timer.fire') {
      assert(!pendingFire && !callback, 'Overlapping scheduler callback');
      const timer = [...timers.values()].sort((a, b) => a.due - b.due || a.id - b.id)[0];
      assert(timer && timer.id === event.id && timer.label === event.label, 'Skipped/reordered original deadline');
      assert.equal(event.logicalAt, timer.due, 'Original deadline shifted');
      pendingFire = event.label;
      if (event.logicalAt > startAt) counts[event.label] = (counts[event.label] || 0) + 1;
      if (timer.repeat) timer.due += timer.period; else timers.delete(timer.id);
    } else if (event.kind === 'callback.start') {
      assert(!callback);
      assert(event.label.startsWith('boot:') || pendingFire === event.label, 'Callback lacks original timer');
      callback = { label: event.label, logicalAt: event.logicalAt }; pendingFire = null;
    } else if (event.kind === 'callback.complete') {
      assert(callback && callback.label === event.label && callback.logicalAt === event.logicalAt);
      if (event.logicalAt > startAt) callbackCounts[event.label] = (callbackCounts[event.label] || 0) + 1;
      callback = null;
    }
  }
  assert(!callback && !pendingFire, 'Uncompleted original callback');
  const outstanding = [...timers.values()].sort((a, b) => a.id - b.id);
  assert(outstanding.every(timer => timer.due > endAt), 'A due worker interval was not executed');
  assert.deepEqual(outstanding, [...trace.activeTimers].sort((a, b) => a.id - b.id), 'Final timer state differs');
  for (const [label, count] of Object.entries(counts)) assert.equal(callbackCounts[label], count);
  for (const job of trace.jobs) {
    assert(job.logicalAt >= trace.start && job.logicalAt <= endAt);
    assert(job.status === 'RETURNED' || (job.status === 'EXPECTED_DORMANT'
      && expectedDormant.some(row => row.label === job.label && row.code === job.code)), 'Incomplete/undeclared worker job');
  }
  // A result is the original runSeasonRollover return value, not one count per actor.
  const seasonalRollovers = [], seen = new Set();
  for (const job of trace.jobs.filter(row => row.label === 'season rollover' && row.status === 'RETURNED')) {
    const { season, converted } = job.result || {};
    assert(Number.isSafeInteger(season) && Number.isSafeInteger(converted) && converted >= 0);
    assert.equal(season, Math.floor(job.logicalAt / SEASON_MS));
    if (job.logicalAt <= startAt || season <= Math.floor(startAt / SEASON_MS) || !converted || seen.has(season)) continue;
    seen.add(season); seasonalRollovers.push({ season, logicalAt: job.logicalAt, authority: 'original-worker', evidence });
  }
  const executions = [];
  for (let index = 1; index < seasonalRollovers.length; index++) {
    const opening = seasonalRollovers[index - 1], completion = seasonalRollovers[index];
    if (completion.season !== opening.season + 1) continue;
    const startedAt = opening.season * SEASON_MS, dueAt = completion.season * SEASON_MS;
    if (startedAt < startAt) continue;
    executions.push({ lifecycleId: 'season', cycleId: String(opening.season), startedAt, dueAt,
      completedAt: completion.logicalAt, authority: 'original-worker', openingEvidence: evidence, completionEvidence: evidence });
  }
  return { format: 1, workerCoverage: { binding: { sourceRevision, configurationSha256 }, evidence,
    fromLogicalAt: startAt, throughLogicalAt: endAt, complete: true, originalTimerCounts: counts,
    originalJobs: trace.jobs.filter(row => row.logicalAt >= startAt).length }, seasonalRollovers, executions,
    scope: 'Exact original timer coverage and observed full season cycles only. Applicability, backlog and stabilization require the existing separate review.',
    matrixQualifying: false };
}
