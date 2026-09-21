// Executes the exact runner observer block against a synthetic native driver.
// This tests integration/retention, not gameplay; the real PG/world proofs do that.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createCarMeltCommitObserver } from '../tools/rc1-car-melt-provenance.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

const runner = fs.readFileSync(new URL('./rc1-native-world-workload.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const start = '// BEGIN source-bound car witness integration control.\n', end = '// END source-bound car witness integration control.';
assert.equal(runner.split(start).length, 2); assert.equal(runner.split(end).length, 2);
const block = runner.split(start)[1].split(end)[0];
assert.equal(sha256(block), 'a6ea7170965b139b437d908699259137222ce546e2310b896b77e3022679c7e3', 'Runner witness block changed; review and rebind control');
assert.match(runner, /const seam = installWorkerInstrumentation\(controller, \{ namespace, queryOrder, commitObserver \}\);/);
assert.match(runner, /assert\.deepEqual\(result\.carMeltWitnessObservation, replayRun\.result\.carMeltWitnessObservation/);
const worker = fs.readFileSync(new URL('../tools/rc1-native-worker.js', import.meta.url), 'utf8');
assert(worker.indexOf('const clock = serialDatabaseOptions({ commitObserver });') < worker.indexOf('if (queryOrder) pool = queryOrder.wrapPool(pool);'));

const instantiate = new Function('env', `const {observeResources,createCarMeltCommitObserver,currentInvocation,at,allianceEnabled,
 snapshotWorldResources,diagnosticPool,reconcileWorldResources,worldResourceHash,proof,resourceSummary,resourceCost,
 resourceStream,carMeltWitnessSummary,canonicalJson,sha256,assert}=env;
 let priorResources=env.initial,firstResourceError=null;
 ${block}
 return {commitObserver,getError:()=>firstResourceError};`);
async function exercise({ enabled = true, carId = 'native-car', scope = 'car', failure = false, overflow = false } = {}) {
  const artifacts = [], records = [], calls = [], native = [];
  let factoryCalls = 0;
  const summary = { boundaries: 0, unsupportedEntries: 0, unsupportedKinds: {}, qualifyingFullResourcePass: false };
  const witnessSummary = { committedWitnesses: 0, retainedCandidateWitnesses: 0, collectorUnsupportedWitnesses: 0, exactMeltTransitions: 0, unclassifiedCandidateBoundaries: 0 };
  const stream = crypto.createHash('sha256'), initial = { state: 'unchanged' };
  const originalNow = Date.now; Date.now = () => 1000;
  try {
    const { commitObserver, getError } = instantiate({ observeResources: enabled,
      createCarMeltCommitObserver: options => { factoryCalls++; return createCarMeltCommitObserver({ ...options, ...(overflow ? { maxQueries: 1 } : {}) }); },
      currentInvocation: { id: 'ordinary-call' }, at: 1000, allianceEnabled: false,
      snapshotWorldResources: async () => structuredClone(initial), diagnosticPool: {}, initial,
      worldResourceHash: sha256, reconcileWorldResources(before, after, options) {
        calls.push(options);
        if (failure) throw Error('CONTROL_NATIVE_BOUNDARY_RECONCILIATION_FAILURE');
        return { checks: [], unsupported: options.carMeltProvenance ? [{ kind: 'declared-synthetic-unknown' }] : [], cars: { lineage: [] } };
      },
      proof: { async artifact(name, data) { artifacts.push({ name, data: structuredClone(data) }); },
        async record(data) { records.push(structuredClone(data)); } },
      resourceSummary: summary, resourceCost: { serializedRestrictedChangeBytes: 0, serializedJournalBytes: 0, observedBoundaryWallMs: 0, maximumBoundaryWallMs: 0 },
      resourceStream: stream, carMeltWitnessSummary: witnessSummary, canonicalJson, sha256, assert });
    if (!enabled) { assert.equal(commitObserver, null); assert.equal(factoryCalls, 0); return { disabled: true }; }
    const query = commitObserver.wrapQuery({}, async (sql, values) => {
      native.push({ sql, values: structuredClone(values ?? []) });
      return { command: sql.split(' ')[0], rowCount: sql.startsWith('DELETE') ? 1 : null, rows: [] };
    });
    commitObserver.arm(); await query('BEGIN');
    await query(scope === 'car' ? 'DELETE FROM cars WHERE id=$1' : 'SELECT $1', [carId]);
    if (failure) {
      await assert.rejects(query('COMMIT'), /CONTROL_NATIVE_BOUNDARY_RECONCILIATION_FAILURE/);
      assert(getError()); assert.equal(artifacts.at(-1).name, 'first-resource-failure.json');
      assert.equal(artifacts.at(-1).data.carMeltProvenance.queries[1].parameters[0], carId);
    } else { await query('COMMIT'); commitObserver.assertComplete(); }
    commitObserver.disarm();
    assert.equal(factoryCalls, 1); assert.equal(calls.length, 1);
    if (scope === 'car' && !overflow) assert.equal(calls[0].carMeltProvenance.queries[1].parameters[0], carId);
    if (scope !== 'car' && !overflow) assert.equal(calls[0].carMeltProvenance, null);
    if (overflow) assert.equal(calls[0].carMeltProvenance.unsupported, 'bounded-trace-overflow');
    if (!failure && (scope === 'car' || overflow)) {
      assert.equal(artifacts.length, 1); assert.match(artifacts[0].name, /^restricted-car-melt-witness-/);
      const reference = records[0].journal.carMeltWitness;
      assert.equal(reference.artifact, artifacts[0].name);
      assert.equal(reference.sha256, sha256(canonicalJson(artifacts[0].data.carMeltProvenance)));
      assert.equal(witnessSummary.retainedCandidateWitnesses, 1); assert.equal(witnessSummary.unclassifiedCandidateBoundaries, 1);
    }
    return { digest: stream.digest('hex'), witnessSummary, native, artifacts, records };
  } finally { Date.now = originalNow; }
}
await exercise({ enabled: false });
const observed = await exercise(), replayed = await exercise();
assert.equal(observed.digest, replayed.digest); assert.deepEqual(observed.witnessSummary, replayed.witnessSummary);
const changed = await exercise({ carId: 'different-native-car' }); assert.notEqual(observed.digest, changed.digest);
const ordinary = await exercise({ scope: 'ordinary' }); assert.equal(ordinary.artifacts.length, 0);
assert.equal(ordinary.witnessSummary.committedWitnesses, 1); assert.equal(ordinary.witnessSummary.retainedCandidateWitnesses, 0);
await exercise({ failure: true });
const overflow = await exercise({ overflow: true }); assert.equal(overflow.witnessSummary.collectorUnsupportedWitnesses, 1);
console.log(JSON.stringify({ status: 'PASS', sourceBoundBlockSha256: sha256(block), controls: [
  'disabled-path-no-collector', 'actual-native-parameters-forwarded', 'candidate-witness-artifact-and-stream-binding',
  'same-driver-replay-equality', 'changed-native-identity-changes-stream', 'noncandidate-keeps-ordinary-classification',
  'failure-retains-full-witness', 'overflow-retained-as-unsupported', 'existing-query-wrapper-order-preserved'],
  scope: 'Synthetic integration controls only; existing car tests/native proof provide branch-authority checks.' }));
