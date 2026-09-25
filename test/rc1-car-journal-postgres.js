import assert from 'node:assert/strict';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime, serialDatabaseOptions } from '../tools/rc1-native-determinism.js';
import { snapshotWorldResources, reconcileWorldResources, worldResourceHash } from '../tools/rc1-world-resource-observer.js';
import { reconcileCarResources } from '../tools/rc1-car-journal.js';
import { commandDatabase, addPlayer, characterId } from './lib/player-command-support.js';
import { withCharacter } from '../src/game.js';
import { boostCar, meltCar } from '../src/economy.js';
import { listItem, cancelListing } from '../src/market.js';
import { withItemTransaction } from '../src/items.js';
import { salvageCar } from '../src/crafting.js';
import { spawnResident, retireResident } from '../src/population.js';
import { CONSTANTS, POPULATION } from '../src/rules.js';

assert(process.argv.includes('--postgres'), 'Native PostgreSQL is mandatory');
const output = process.argv.find(value => value.startsWith('--output='))?.slice(9) || process.env.RC1_CAR_OUTPUT; assert(output);
const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL; assert(controlUrl);
const source = await sourceIdentity(), epoch = '2026-09-23T23:00:00.000Z', seed = 'car-journal-native';
const lease = planOwnedWorldDatabase({ controlUrl, runId: 'native-car-journal', sourceRevision: source.revision });
const proof = await createProofRecorder({ directory: output, source, configuration: { epoch, seed, database: lease.descriptor,
  scope: 'Native canonical authority boundaries and terminal deliberate SQL-trigger corruption. No resource/matrix qualification.',
  fixture: 'Two synthetic initial actors, three junker cars for salvage/melt/custody; resource ledger qualification is not claimed. No fixture changes after initialization.',
  clock: 'Shared test-only app/SQL logical clock; no worker registered in this focused component. Separate original-worker world pair covers worker integration.' },
  runId: 'native-car-journal', seed, scenarioId: 'scoped-car-journal', population: 2 });
let database, runtime, result, at = Date.parse(epoch), firstFailure = false;
const cases = [], controls = [], saved = new Map();
const actor = 'car-owner', other = 'car-other', cid = characterId(actor);
const invoke = (name, action) => withCharacter(database.pool, actor, (ch, client, h) => action(ch, client, h));
async function observe(name, work, verify = () => {}) {
  const before = await snapshotWorldResources(database.pool); let after;
  try {
    const value = await proof.invoke(name, { logicalAt: at }, work); after = await snapshotWorldResources(database.pool);
    const journal = reconcileWorldResources(before, after, { identity: { authority: name, logicalAt: at }, includeRestrictedChanges: true });
    await verify({ before, after, value, journal });
    const row = { name, before, after, value, journal };
    await proof.artifact(`boundary-${String(cases.length + 1).padStart(3, '0')}.json`, row);
    saved.set(name, row); cases.push({ name, checks: journal.checks.length, carChecks: journal.cars.checks.length,
      exact: journal.cars.fullyClassifiedChanges, unsupported: journal.unsupported }); return value;
  } catch (error) {
    after ||= await snapshotWorldResources(database.pool);
    if (!firstFailure) { firstFailure = true; await proof.artifact('first-unexpected-failure.json', { name, before, after, error: error.message, stack: error.stack }); }
    throw error;
  }
}
function reject(name, boundary, edit, pattern) {
  const { before, after } = structuredClone(saved.get(boundary)); edit(before, after);
  let error;
  try { reconcileCarResources(before, after); } catch (caught) { error = caught; }
  assert(error, `Counterfactual corruption accepted: ${name}`); assert.match(error.message, pattern);
  controls.push({ name, type: 'counterfactual alteration of retained native boundary', boundary, result: 'REJECTED', error: error.message,
    beforeSha256: worldResourceHash(before), afterSha256: worldResourceHash(after) });
  return proof.artifact(`control-${name}.json`, { before, after, expectedRejection: error.message });
}
try {
  await proof.record({ kind: 'database-created', ...await lease.create() });
  process.env.COORDINATION_TEST_DATABASE_URL = lease.url;
  runtime = installSerialRuntime(seed, epoch); runtime.bindClock(() => at);
  database = await commandDatabase('car_journal', serialDatabaseOptions());
  await addPlayer(database.pool, actor, actor, 'foundry'); await addPlayer(database.pool, other, other, 'foundry');
  await database.pool.query('UPDATE characters SET season=$1', [Math.floor(at / 2419200000)]);
  for (const id of ['salvage-car', 'melt-car', 'custody-car'])
    await database.pool.query("INSERT INTO cars(id,character_id,model_id,trim_id,dmg) VALUES($1,$2,'junker','stock',20)", [id, cid]);
  await proof.record({ kind: 'initialization-complete', noFurtherFixtureWrites: true });
  await proof.snapshot(database.pool, 'initial');
  const salvage = () => withItemTransaction(database.pool, client => salvageCar(client, { accountId: actor }, 'salvage-car', 'recipe:car_salvage_basic', 'salvage-native-key'));
  const salvaged = await observe('basic-salvage', salvage, ({ journal }) => {
    assert.equal(journal.cars.fullyClassifiedChanges, 1); assert.equal(journal.cars.unsupported.length, 0);
  });
  await observe('salvage-exact-replay', salvage, ({ before, after, value }) => {
    assert.equal(worldResourceHash(before), worldResourceHash(after)); assert.deepEqual(value, salvaged);
  });
  const listing = await observe('market-list', () => invoke('market-list', (ch, client, h) => listItem(ch, { carId: 'custody-car', minBid: 100, buyNow: 200, hours: 1 }, client, h)),
    ({ journal }) => assert.equal(journal.cars.lineage[0].kind, 'market-lock'));
  await observe('market-cancel', () => invoke('market-cancel', (ch, client, h) => cancelListing(ch, listing.id, client, h)),
    ({ journal }) => assert.equal(journal.cars.lineage[0].kind, 'market-cancel-release'));
  await observe('legacy-melt', () => invoke('legacy-melt', (ch, client, h) => meltCar(ch, 'melt-car', client, h)),
    ({ journal }) => assert(journal.cars.unsupported.some(row => row.kind === 'car-sink-identity-yield-provenance')));
  let boosted;
  for (let attempt = 0; attempt < 10 && !boosted?.success; attempt++) {
    at += CONSTANTS.GTA_CD_MS + 60000;
    boosted = await observe(`legacy-boost-${attempt}`, () => invoke('legacy-boost', boostCar), ({ value, journal }) => {
      if (value.success) assert(journal.cars.unsupported.some(row => row.kind === 'car-acquisition-identity-provenance'));
    });
  }
  assert(boosted?.success, 'Bounded ordinary boost attempts did not produce a car');
  const transaction = async action => { const client = await database.pool.connect();
    try { await client.query('BEGIN'); const value = await action(client); await client.query('COMMIT'); return value; }
    catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); } };
  const resident = await observe('resident-grant', () => transaction(client => spawnResident(client,
    { band: POPULATION.BANDS.find(band => band.id === 'made'), marks: { car: true } })),
    ({ journal }) => assert(journal.cars.unsupported.some(row => row.kind === 'car-acquisition-identity-provenance')));
  assert(resident);
  await observe('resident-retirement', () => transaction(client => retireResident(client, resident.id)),
    ({ journal }) => assert(journal.cars.unsupported.some(row => row.kind === 'car-sink-identity-yield-provenance')));
  await reject('salvage-wrong-car', 'basic-salvage', (_, after) => {
    const guard = after.tables.item_mutation_guards.find(row => row.mutation_kind === 'salvage_car'), result = JSON.parse(guard.result_json);
    result.car.id = 'custody-car'; result.inputs[0].id = 'custody-car'; guard.result_json = JSON.stringify(result);
  }, /exact prior car/);
  await reject('salvage-wrong-request-digest', 'basic-salvage', (_, after) => { after.tables.item_mutation_guards.find(row => row.mutation_kind === 'salvage_car').request_hash = 'f'.repeat(64); }, /request digest/);
  await reject('salvage-wrong-output-owner', 'basic-salvage', (_, after) => { after.tables.item_events[0].to_owner_id = other; }, /strictly equal/);
  await reject('salvage-missing-output', 'basic-salvage', (_, after) => { after.tables.item_events.pop(); }, /cardinality/);
  await reject('salvage-duplicated-output', 'basic-salvage', (_, after) => { after.tables.item_events.push({ ...after.tables.item_events[0], id: 'duplicate-event' }); }, /cardinality/);
  await reject('salvage-wrong-input-owner', 'basic-salvage', (before) => { before.tables.cars.find(row => row.id === 'salvage-car').character_id = characterId(other); }, /guard account/);
  await reject('custody-wrong-owner', 'market-list', (_, after) => { after.tables.cars.find(row => row.id === 'custody-car').character_id = characterId(other); }, /ownership/);
  await reject('custody-unrelated-damage', 'market-list', (_, after) => { after.tables.cars.find(row => row.id === 'custody-car').dmg++; }, /unrelated car fields/);
  await reject('source-duplicate-receipt', 'resident-grant', (_, after) => {
    const grant = after.tables.rng_audit.find(row => row.action === 'npc:car' && row.character_id === resident.id);
    after.tables.rng_audit.push({ ...grant, id: 'duplicate-grant' });
  }, /cardinality/);
  await reject('source-wrong-owner', 'resident-grant', (_, after) => { after.tables.cars.find(row => row.character_id === resident.id).character_id = characterId(other); }, /cardinality/);
  await reject('sink-missing-disposition', 'legacy-melt', (before, after) => { after.tables.cars.push(before.tables.cars.find(row => row.id === 'melt-car')); }, /cardinality/);
  // Actual PostgreSQL corruption control. The injected trigger is installed only
  // after all positive cases; the committed corrupt state is retained, not fixed
  // and folded back into the successful trajectory.
  await database.pool.query(`CREATE FUNCTION rc1_corrupt_car_custody() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF NEW.id='custody-car' AND NEW.listed AND NOT OLD.listed THEN NEW.dmg=OLD.dmg+1; END IF; RETURN NEW; END $$`);
  await database.pool.query('CREATE TRIGGER rc1_car_corruption BEFORE UPDATE ON cars FOR EACH ROW EXECUTE FUNCTION rc1_corrupt_car_custody()');
  const before = await snapshotWorldResources(database.pool);
  await proof.invoke('deliberate-native-custody-corruption', { trigger: 'rc1_car_corruption' }, () => invoke('corrupt-list',
    (ch, client, h) => listItem(ch, { carId: 'custody-car', minBid: 100, buyNow: 200, hours: 1 }, client, h)));
  const after = await snapshotWorldResources(database.pool);
  let detected;
  try { reconcileWorldResources(before, after); } catch (error) { detected = error; }
  assert(detected); assert.match(detected.message, /unrelated car fields/);
  await proof.artifact('native-corruption-rejected.json', { before, after, error: detected.message, stack: detected.stack });
  controls.push({ name: 'native-committed-custody-corruption', type: 'actual PostgreSQL trigger', result: 'REJECTED', error: detected.message });
  await proof.snapshot(database.pool, 'final-with-deliberate-corruption');
  await proof.artifact('random-tape.json', { draws: runtime.tape });
  result = { status: 'PASS_SCOPED', cases, controls, positiveBoundaries: cases.length, deliberateNativeCorruptionsRejected: 1,
    fullResourceQualification: false, statement: 'Exact salvage/custody only; acquisition and melt/retirement identity/yield gaps remain explicit.' };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack, cases, controls }; process.exitCode = 1;
  await proof.record({ kind: 'failure', ...result });
  if (database) await proof.snapshot(database.pool, 'failure');
  if (runtime) await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
} finally {
  try { if (database) await database.cleanup(database.pool); await proof.record({ kind: 'database-cleanup', ...await lease.close() }); }
  catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
  runtime?.restore(); process.env.COORDINATION_TEST_DATABASE_URL = controlUrl;
  const sealed = await proof.finish(result); await verifyArtifactIndex(output, sealed);
}
console.log(JSON.stringify({ source: source.revision, status: result.status, boundaries: cases.length, controls: controls.length, error: result.error, matrixQualifying: false }));
