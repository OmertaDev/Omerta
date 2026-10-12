import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createWorkerSchedule, WORKER_SOURCE_PINS } from '../tools/rc1-native-worker.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';
import { measureWorldWorkerDuration } from '../tools/rc1-world-duration-evidence.js';
import { COMPANY_OPERATOR_SOURCE_CURRENT_PINS, companyOperatorSourceBaseline } from '../tools/rc1-company-operator-source-compatibility.js';
import { INTEL_SOURCE_BASELINE_PINS, INTEL_SOURCE_BASELINE_BLOBS, INTEL_SOURCE_CURRENT_PINS, INTEL_SOURCE_INVERSES } from '../tools/rc1-intel-source-compatibility.js';
import { COVERAGE_SOURCE_CURRENT_PINS, COVERAGE_SOURCE_BASELINE_PINS, COVERAGE_SOURCE_BASELINE_BLOBS,
  COVERAGE_SOURCE_INVERSES, coverageSourceBaseline } from '../tools/rc1-logistics-coverage-source-compatibility.js';

const DAY = 86400000, season = 28 * DAY, start = 739 * season - 3600000;
const end = start + 90 * DAY, hash = value => sha256(canonicalJson(value));
let now = start;
const controller = createWorkerSchedule({ start, setClock(value) { now = value; } });
for (const [file, pinnedLfSha256] of Object.entries(WORKER_SOURCE_PINS)) {
  const originalSource = (await fs.readFile(new URL('../' + file, import.meta.url), 'utf8')).replaceAll('\r\n', '\n');
  controller.transformations.push({ file, pinnedLfSha256, originalSource,
    transformedSource: originalSource, transformedSourceSha256: sha256(originalSource) });
}
const rawDbSource = controller.transformations.find(row => row.file === 'src/db.js').originalSource;
const dbSource = coverageSourceBaseline('src/db.js', rawDbSource);
const compatibilityAddition = "  mem.public.registerFunction({\n    name: 'mod', args: [DataType.bigint, DataType.integer], returns: DataType.bigint,\n    implementation: (value, divisor) => value % divisor,\n  });\n";
assert.equal(dbSource.split(compatibilityAddition).length, 2);
assert.equal(sha256(dbSource.replace(compatibilityAddition, '')), '9e6360ea61c840bd92cde9a90330e29156fc137dc27ba5fa1e0d99cb432feb97', 'Only the isolated pg-mem function may differ from the prior native boot pin');
let lastSeason = Math.floor(start / season);
async function guardedSeasonTick() {
  await controller.job('season rollover', () => {
    const current = Math.floor(now / season), changed = current !== lastSeason;
    lastSeason = current; return { season: current, converted: changed ? 25 : 0 };
  });
}
controller.timers.setInterval(guardedSeasonTick, 3600000);
await controller.advanceTo(end);
const fixture = () => ({ sourceRevision: 'a'.repeat(40), configurationSha256: 'b'.repeat(64),
  startAt: start, endAt: end, trace: structuredClone(controller.diagnostic()),
  evidence: { path: 'worker-schedule.json', sha256: 'c'.repeat(64) } });
const measured = measureWorldWorkerDuration(fixture());
assert.equal(measured.workerCoverage.originalTimerCounts.guardedSeasonTick, 2160);
assert.equal(measured.seasonalRollovers.length, 4);
assert.equal(measured.executions.length, 3);
assert(measured.executions.every(row => row.dueAt - row.startedAt === season && row.startedAt >= start));
assert.equal(measured.matrixQualifying, false);
// Raw current worker bytes and the complete predecessor retain the same narrow
// duration scope; accepting additions never loosens the historical source pin.
const workerFile = 'src/worker.js';
assert.equal(WORKER_SOURCE_PINS[workerFile], INTEL_SOURCE_BASELINE_PINS[workerFile]);
const operatorWorker = controller.transformations.find(row => row.file === workerFile).originalSource;
assert.equal(sha256(operatorWorker), COMPANY_OPERATOR_SOURCE_CURRENT_PINS[workerFile]);
const currentWorker = companyOperatorSourceBaseline(workerFile, operatorWorker);
assert.equal(sha256(currentWorker), INTEL_SOURCE_CURRENT_PINS[workerFile]);
for (const changed of [operatorWorker + '\n// unreviewed operator clock suffix\n', operatorWorker.replace('runCompanyOperators(pool, 20)', 'runCompanyOperators(pool, 21)'), operatorWorker.replace('setInterval(guardedCompanyTick, 30000);', 'setInterval(guardedCompanyTick, 60000);')]) {
  assert.notEqual(changed, operatorWorker);
  const value = fixture(); value.trace.transformations.find(row => row.file === workerFile).originalSource = changed;
  assert.throws(() => measureWorldWorkerDuration(value), /source changed/);
}
const baselineWorker = execFileSync('git', ['show', INTEL_SOURCE_BASELINE_BLOBS[workerFile]], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
for (const originalSource of [currentWorker.replaceAll('\n', '\r\n'), baselineWorker, baselineWorker.replaceAll('\n', '\r\n')]) {
  const value = fixture(); value.trace.transformations.find(row => row.file === workerFile).originalSource = originalSource;
  assert.deepEqual(measureWorldWorkerDuration(value), measured);
}
let sourceCorruptions = 0;
for (const chunk of INTEL_SOURCE_INVERSES[workerFile]) for (const changed of [
  currentWorker.replace(chunk, ''), currentWorker.replace(chunk, chunk + chunk),
  currentWorker.replace(chunk, chunk + '// unreviewed change\n'),
]) {
  assert.notEqual(changed, currentWorker);
  const value = fixture(); value.trace.transformations.find(row => row.file === workerFile).originalSource = changed;
  assert.throws(() => measureWorldWorkerDuration(value), /Intel source changed/); sourceCorruptions++;
}
for (const originalSource of [currentWorker, baselineWorker]) {
  const value = fixture(); value.trace.transformations.find(row => row.file === workerFile).originalSource = originalSource + '\n// unreviewed suffix\n';
  assert.throws(() => measureWorldWorkerDuration(value), /Intel source changed/); sourceCorruptions++;
}
const dbFile = 'src/db.js';
assert.equal(sha256(rawDbSource), COVERAGE_SOURCE_CURRENT_PINS[dbFile]);
assert.equal(WORKER_SOURCE_PINS[dbFile], COVERAGE_SOURCE_BASELINE_PINS[dbFile]);
const baselineDb = execFileSync('git', ['show', COVERAGE_SOURCE_BASELINE_BLOBS[dbFile]], { encoding: 'utf8' }).replaceAll('\r\n', '\n');
assert.equal(dbSource, baselineDb, 'Coverage composes complete prior DB bytes before the unchanged mod assertion');
for (const originalSource of [rawDbSource.replaceAll('\n', '\r\n'), baselineDb, baselineDb.replaceAll('\n', '\r\n')]) {
  const value = fixture(); value.trace.transformations.find(row => row.file === dbFile).originalSource = originalSource;
  assert.deepEqual(measureWorldWorkerDuration(value), measured);
}
let dbCorruptions = 0;
const unknownDb = originalSource => {
  assert.equal(coverageSourceBaseline(dbFile, originalSource), originalSource, 'Unknown DB source is never rewritten into reviewed bytes');
  const value = fixture(); value.trace.transformations.find(row => row.file === dbFile).originalSource = originalSource;
  assert.throws(() => measureWorldWorkerDuration(value)); dbCorruptions++;
};
for (const chunk of COVERAGE_SOURCE_INVERSES[dbFile]) {
  for (const originalSource of [rawDbSource.replace(chunk.current, ''), rawDbSource.replace(chunk.current, chunk.current + chunk.current),
    rawDbSource.replace(chunk.current, chunk.current + '// unreviewed DB change\n')]) unknownDb(originalSource);
  const context = chunk.current.split('\n').find(line => line.trim() && chunk.baseline.includes(line + '\n'));
  assert(context); unknownDb(rawDbSource.replace(chunk.current, chunk.current.replace(context, context + ' /* altered context */')));
}
for (const originalSource of [rawDbSource, baselineDb]) unknownDb(originalSource + '\n// unreviewed DB suffix\n');
assert(rawDbSource.includes('export async function makeDb()'));
unknownDb(rawDbSource.replace('export async function makeDb()', 'export async function changedDb()'));
const reseal = value => {
  value.trace.events.forEach((event, index) => { event.sequence = index + 1; });
  value.trace.scheduleSha256 = hash(value.trace.events.filter(row => row.kind !== 'callback.wall-duration'));
};
for (const change of [
  value => { value.trace.events.find(row => row.kind === 'timer.fire').logicalAt++; reseal(value); },
  value => { const at = value.trace.events.find(row => row.kind === 'timer.fire').logicalAt;
    value.trace.events = value.trace.events.filter(row => row.logicalAt !== at); reseal(value); },
  value => { value.trace.events = value.trace.events.filter(row => row.kind !== 'callback.complete'); reseal(value); },
  value => { value.trace.activeTimers[0].due++; },
  value => { value.trace.jobs[0].status = 'RUNNING'; },
  value => { value.trace.jobs[0].result.season++; },
  value => { value.trace.failures.push({ message: 'native failure' }); },
  value => { value.trace.transformations[0].originalSource += '\n'; },
  value => { value.endAt++; value.trace.logicalAt++; value.trace.activeTimers[0].due = value.endAt; },
]) { const value = fixture(); change(value); assert.throws(() => measureWorldWorkerDuration(value)); }
{
  const value = fixture(); value.startAt = start + 80 * DAY;
  const short = measureWorldWorkerDuration(value);
  assert.equal(short.executions.length, 0, 'A partial first season is not a full lifecycle');
  value.trace.jobs[0] = { logicalAt: start, label: 'RWA health', status: 'EXPECTED_DORMANT', code: 'health_registry_unavailable' };
  assert.throws(() => measureWorldWorkerDuration(value));
  value.expectedDormant = [{ label: 'RWA health', code: 'health_registry_unavailable' }];
  assert.equal(measureWorldWorkerDuration(value).workerCoverage.complete, true);
}
await controller.close();
console.log(`PASS rc1-world-duration-evidence: original deadline coverage, complete season cycles, partial-cycle exclusion, 10 schedule controls, ${sourceCorruptions} exact Intel source controls and ${dbCorruptions} closed Coverage DB controls; synthetic unit trace only, no new worker qualification`);
