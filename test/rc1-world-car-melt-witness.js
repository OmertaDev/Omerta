// Executes the exact runner observer block against a synthetic native driver.
// This tests integration/retention, not gameplay; the real PG/world proofs do that.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { createNpcCarAcquisitionCommitObserver } from '../tools/rc1-npc-car-acquisition.js';
import { createNpcFamilyCommitObserver, NPC_FORMATION_SQL } from '../tools/rc1-npc-family-provenance.js';
import { canonicalJson, sha256 } from '../tools/rc1-native-proof.js';

const runner = fs.readFileSync(new URL('./rc1-native-world-workload.js', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
const start = '// BEGIN source-bound car witness integration control.\n', end = '// END source-bound car witness integration control.';
assert.equal(runner.split(start).length, 2); assert.equal(runner.split(end).length, 2);
const block = runner.split(start)[1].split(end)[0];
assert.equal(sha256(block), '7938cd870c9ece7913e15b71266453cbf5de89f53a5a0af9b093f4aae546f14c', 'Runner witness block changed; review and rebind control');
assert.match(runner, /const seam = installWorkerInstrumentation\(controller, \{ namespace, queryOrder, commitObserver \}\);/);
assert.match(runner, /assert\.deepEqual\(result\.carMeltWitnessObservation, replayRun\.result\.carMeltWitnessObservation/);
const worker = fs.readFileSync(new URL('../tools/rc1-native-worker.js', import.meta.url), 'utf8');
assert(worker.indexOf('const clock = serialDatabaseOptions({ commitObserver });') < worker.indexOf('if (queryOrder) pool = queryOrder.wrapPool(pool);'));

const instantiate = new Function('env', `const {observeResources,createNpcFamilyCommitObserver,createNpcCarAcquisitionCommitObserver,currentInvocation,at,allianceEnabled,
 snapshotWorldResources,diagnosticPool,reconcileWorldResources,worldResourceHash,proof,resourceSummary,resourceCost,
 resourceStream,carMeltWitnessSummary,carAcquisitionWitnessSummary,npcFamilyWitnessSummary,canonicalJson,sha256,assert}=env;
 let priorResources=env.initial,firstResourceError=null;
 ${block}
 return {commitObserver,getError:()=>firstResourceError};`);
function verifyWitnessBoundary(data) {
  for (const field of ['carMeltProvenance', 'carAcquisitionProvenance', 'npcFamilyProvenance'])
    if (data[field]) assert.deepEqual(data[field].boundary, data.event, 'Candidate witness boundary differs from artifact event');
}
async function exercise({ enabled = true, carId = 'native-car', scope = 'car', failure = false, overflow = false, rollback = false } = {}) {
  const artifacts = [], records = [], calls = [], native = [];
  let factoryCalls = 0, outerFactoryCalls = 0;
  const summary = { boundaries: 0, unsupportedEntries: 0, unsupportedKinds: {}, qualifyingFullResourcePass: false };
  const witnessSummary = { committedWitnesses: 0, retainedCandidateWitnesses: 0, collectorUnsupportedWitnesses: 0, exactMeltTransitions: 0, unclassifiedCandidateBoundaries: 0 };
  const acquisitionSummary = { retainedCandidateWitnesses: 0, exactAcquisitions: 0, unclassifiedCandidateBoundaries: 0 };
  const familySummary = { retainedCandidateWitnesses: 0, exactFormations: 0, rolledBackCandidates: 0, unclassifiedCandidateBoundaries: 0 };
  const stream = crypto.createHash('sha256'), initial = { state: 'unchanged' };
  const originalNow = Date.now; Date.now = () => 1000;
  try {
    const { commitObserver, getError } = instantiate({ observeResources: enabled,
      createNpcFamilyCommitObserver: options => { outerFactoryCalls++; return createNpcFamilyCommitObserver(options); },
      createNpcCarAcquisitionCommitObserver: options => { factoryCalls++; return createNpcCarAcquisitionCommitObserver({ ...options, ...(overflow ? { maxQueries: 1 } : {}) }); },
      currentInvocation: { id: 'ordinary-call' }, at: 1000, allianceEnabled: false,
      snapshotWorldResources: async () => structuredClone(initial), diagnosticPool: {}, initial,
      worldResourceHash: value => sha256(canonicalJson(value)), reconcileWorldResources(before, after, options) {
        calls.push(options);
        if (failure) throw Error('CONTROL_NATIVE_BOUNDARY_RECONCILIATION_FAILURE');
        return { checks: [], unsupported: options.carMeltProvenance || options.carAcquisitionProvenance || options.npcFamilyProvenance ? [{ kind: 'declared-synthetic-unknown' }] : [], cars: { lineage: [] }, familyEntry: { movements: [] } };
      },
      proof: { async artifact(name, data) { artifacts.push({ name, data: structuredClone(data) }); },
        async record(data) { records.push(structuredClone(data)); } },
      resourceSummary: summary, resourceCost: { serializedRestrictedChangeBytes: 0, serializedJournalBytes: 0, observedBoundaryWallMs: 0, maximumBoundaryWallMs: 0 },
      resourceStream: stream, carMeltWitnessSummary: witnessSummary, carAcquisitionWitnessSummary: acquisitionSummary, npcFamilyWitnessSummary: familySummary, canonicalJson, sha256, assert });
    if (!enabled) { assert.equal(commitObserver, null); assert.equal(factoryCalls, 0); assert.equal(outerFactoryCalls, 0); return { disabled: true }; }
    const query = commitObserver.wrapQuery({}, async (sql, values) => {
      native.push({ sql, values: structuredClone(values ?? []) });
      return { command: sql.split(' ')[0], rowCount: sql.startsWith('DELETE') ? 1 : null, rows: [] };
    });
    commitObserver.arm(); await query('BEGIN');
    await query(scope === 'car' ? 'DELETE FROM cars WHERE id=$1' : scope === 'acquisition' ? 'INSERT INTO cars VALUES ($1)' : scope === 'family' ? NPC_FORMATION_SQL[11] : 'SELECT $1', scope === 'family' ? [carId, 120000] : [carId]);
    if (failure) {
      await assert.rejects(query('COMMIT'), /CONTROL_NATIVE_BOUNDARY_RECONCILIATION_FAILURE/);
      assert(getError()); assert.equal(artifacts.at(-1).name, 'first-resource-failure.json');
      assert.equal(artifacts.at(-1).data.carMeltProvenance.queries[1].parameters[0], carId);
      if (scope === 'family') assert.equal(artifacts.at(-1).data.npcFamilyProvenance.statements[1].parameters[0], carId);
    } else { await query(rollback ? 'ROLLBACK' : 'COMMIT'); commitObserver.assertComplete(); }
    commitObserver.disarm();
    assert.equal(factoryCalls, 1); assert.equal(outerFactoryCalls, 1); assert.equal(calls.length, 1);
    assert.equal(native.length, 3, 'Composition added native queries');
    if (scope === 'car' && !overflow) assert.equal(calls[0].carMeltProvenance.queries[1].parameters[0], carId);
    if (scope !== 'car' && !overflow) assert.equal(calls[0].carMeltProvenance, null);
    if (scope === 'acquisition') assert.equal(calls[0].carAcquisitionProvenance.queries[1].parameters[0], carId);
    if (overflow) assert.equal(calls[0].carMeltProvenance.unsupported, 'bounded-trace-overflow');
    if (scope !== 'family') assert.equal(calls[0].npcFamilyProvenance, null, 'Unrelated transaction acquired a Family witness');
    else assert.equal(calls[0].npcFamilyProvenance.statements[1].parameters[0], carId, 'Family argument lost or replaced by car witness');
    if (!failure && (scope === 'car' || overflow)) {
      assert.equal(artifacts.length, 1); assert.match(artifacts[0].name, /^restricted-car-melt-witness-/);
      const reference = records[0].journal.carMeltWitness;
      assert.equal(reference.artifact, artifacts[0].name);
      assert.equal(reference.sha256, sha256(canonicalJson(artifacts[0].data.carMeltProvenance)));
      assert.equal(witnessSummary.retainedCandidateWitnesses, 1); assert.equal(witnessSummary.unclassifiedCandidateBoundaries, 1);
    }
    if (!failure && scope === 'acquisition') {
      assert.equal(artifacts.length, 1); assert.match(artifacts[0].name, /^restricted-car-acquisition-witness-/);
      assert.equal(records[0].journal.carAcquisitionWitness.sha256, sha256(canonicalJson(artifacts[0].data.carAcquisitionProvenance)));
      assert.equal(acquisitionSummary.retainedCandidateWitnesses, 1); assert.equal(acquisitionSummary.unclassifiedCandidateBoundaries, 1);
    }
    if (!failure && scope === 'family') {
      assert.equal(artifacts.length, 1); assert.match(artifacts[0].name, /^restricted-npc-family-witness-/);
      assert.equal(records[0].journal.npcFamilyWitness.sha256, sha256(canonicalJson(artifacts[0].data.npcFamilyProvenance)));
      assert.equal(familySummary.retainedCandidateWitnesses, 1); assert.equal(familySummary.exactFormations, 0, 'Synthetic retention control cannot claim exact gameplay authority');
      assert.equal(familySummary.rolledBackCandidates, rollback ? 1 : 0);
      assert.equal(familySummary.unclassifiedCandidateBoundaries, rollback ? 0 : 1);
      assert.equal(artifacts[0].data.event.outcome, rollback ? 'ROLLED_BACK' : 'COMMITTED');
    }
    for (const artifact of artifacts) {
      verifyWitnessBoundary(artifact.data);
      assert.deepEqual(artifact.data.before, initial, 'Candidate/failure lost its exact prior snapshot');
      assert.deepEqual(artifact.data.after, initial, 'Candidate/failure lost its exact final snapshot');
    }
    return { digest: stream.digest('hex'), witnessSummary, acquisitionSummary, familySummary, native, artifacts, records };
  } finally { Date.now = originalNow; }
}
await exercise({ enabled: false });
const observed = await exercise(), replayed = await exercise();
const staleCarWitness = structuredClone(observed.artifacts[0].data);
staleCarWitness.carMeltProvenance.boundary.transactionId++;
assert.throws(() => verifyWitnessBoundary(staleCarWitness), /witness boundary/);
assert.equal(observed.digest, replayed.digest); assert.deepEqual(observed.witnessSummary, replayed.witnessSummary);
const changed = await exercise({ carId: 'different-native-car' }); assert.notEqual(observed.digest, changed.digest);
const ordinary = await exercise({ scope: 'ordinary' }); assert.equal(ordinary.artifacts.length, 0);
assert.equal(ordinary.witnessSummary.committedWitnesses, 1); assert.equal(ordinary.witnessSummary.retainedCandidateWitnesses, 0);
await exercise({ failure: true });
const overflow = await exercise({ overflow: true }); assert.equal(overflow.witnessSummary.collectorUnsupportedWitnesses, 1);
const acquisition = await exercise({ scope: 'acquisition' });
assert.equal(acquisition.digest, (await exercise({ scope: 'acquisition' })).digest);
assert.notEqual(acquisition.digest, (await exercise({ scope: 'acquisition', carId: 'wrong-native-created-car' })).digest);
const family = await exercise({ scope: 'family' });
const staleFamilyWitness = structuredClone(family.artifacts[0].data);
staleFamilyWitness.npcFamilyProvenance.boundary.transactionId++;
assert.throws(() => verifyWitnessBoundary(staleFamilyWitness), /witness boundary/);
assert.equal(family.digest, (await exercise({ scope: 'family' })).digest);
assert.notEqual(family.digest, (await exercise({ scope: 'family', carId: 'different-native-family' })).digest);
await exercise({ scope: 'family', rollback: true });
await exercise({ scope: 'family', failure: true });
console.log(JSON.stringify({ status: 'PASS', sourceBoundBlockSha256: sha256(block), controls: [
  'disabled-path-no-collector', 'actual-native-parameters-forwarded', 'candidate-witness-artifact-and-stream-binding',
  'same-driver-replay-equality', 'changed-native-identity-changes-stream', 'noncandidate-keeps-ordinary-classification',
  'failure-retains-full-witness', 'overflow-retained-as-unsupported', 'existing-query-wrapper-order-preserved',
  'acquisition-shares-native-witness', 'acquisition-artifact-and-digest-binding',
  'single-inner-collector-and-no-extra-native-queries', 'Family-argument-preservation-and-native-identity-digest',
  'Family-rollback-and-failure-retention', 'full-candidate-and-failure-snapshots', 'synthetic-candidate-remains-unclassified',
  'witness-boundary-event-binding-and-stale-rejection'],
  scope: 'Synthetic integration controls only; existing car tests/native proof provide branch-authority checks.' }));
