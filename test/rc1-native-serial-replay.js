import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { installSerialRuntime, serialDatabaseOptions, SERIAL_EPOCH, SERIAL_SEAMS } from '../tools/rc1-native-determinism.js';
import { runNativeSimulation } from '../tools/rc1-sim.js';
import { sourceIdentity, createProofRecorder, verifyArtifactIndex, sha256, canonicalJson } from '../tools/rc1-native-proof.js';
import { commandDatabase } from './lib/player-command-support.js';

const originals = { Date: globalThis.Date, random: Math.random, bytes: crypto.randomBytes, uuid: crypto.randomUUID };
const samples = [];
for (let run = 0; run < 2; run++) {
  const runtime = installSerialRuntime('runtime-regression');
  try {
    samples.push({ time: new Date().toISOString(), now: Date.now(), uuid: crypto.randomUUID(), bytes: crypto.randomBytes(5).toString('hex'), random: Math.random() });
    assert.equal(new Date('2000-01-01T00:00:00.000Z').toISOString(), '2000-01-01T00:00:00.000Z');
    runtime.bindClock(() => originals.Date.parse(SERIAL_EPOCH) + 1234);
    assert.equal(new Date().getTime(), Date.now());
  } finally { runtime.restore(); }
  assert.equal(globalThis.Date, originals.Date); assert.equal(Math.random, originals.random);
  assert.equal(crypto.randomBytes, originals.bytes); assert.equal(crypto.randomUUID, originals.uuid);
}
assert.deepEqual(samples[0], samples[1]);
console.log('PASS: seeded UUID/bytes/random and application clock reproduce; globals restored');

if (process.argv.includes('--postgres')) {
  const directory = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length);
  assert(directory, 'Provide an exclusive restricted output directory outside the source checkout');
  const source = await sourceIdentity(), seed = 'rc1-alpha';
  const clockRuntime = installSerialRuntime('transaction-clock-contract');
  let contractDatabase, contractClient, clockTime = originals.Date.parse(SERIAL_EPOCH);
  const clockChecks = [];
  try {
    clockRuntime.bindClock(() => clockTime);
    contractDatabase = await commandDatabase('serial_clock_contract', serialDatabaseOptions());
    contractClient = await contractDatabase.pool.connect();
    await contractClient.query('BEGIN');
    const first = (await contractClient.query('SELECT now() AS tx,clock_timestamp() AS statement')).rows[0];
    await contractClient.query('SAVEPOINT clock_probe');
    clockTime += 1000;
    await assert.rejects(() => contractClient.query('SELECT 1/0'), { code: '22012' });
    await contractClient.query('ROLLBACK TO SAVEPOINT clock_probe');
    const resumed = (await contractClient.query('SELECT now() AS tx,clock_timestamp() AS statement')).rows[0];
    assert.equal(resumed.tx.getTime(), first.tx.getTime());
    assert.equal(resumed.statement.getTime(), clockTime);
    await contractClient.query('COMMIT');
    const next = (await contractClient.query('SELECT now() AS tx')).rows[0];
    assert.equal(next.tx.getTime(), clockTime);
    await assert.rejects(() => contractClient.query('SELECT CURRENT_TIMESTAMP'), /Uncontrolled SQL clock keyword/);
    clockChecks.push('transaction time retained across savepoint rollback', 'statement clock advances', 'next transaction sees new logical time',
      'uncontrolled SQL clock rejected');
  } finally {
    contractClient?.release(); if (contractDatabase) await contractDatabase.cleanup(contractDatabase.pool); clockRuntime.restore();
  }
  const records = [];
  for (const label of ['serial-a', 'serial-b']) {
    const output = path.join(directory, label);
    const proof = await createProofRecorder({ directory: output, source,
      configuration: { serial: true, population: 25, seed, replicate: 0, rounds: 1, epoch: SERIAL_EPOCH, seams: SERIAL_SEAMS },
      runId: label, seed, scenarioId: 'scoped-same-seed-serial-replay', population: 25 });
    const runtime = installSerialRuntime(seed);
    let result;
    try {
      await proof.record({ kind: 'deterministic-initialization', seed, epoch: runtime.epoch, seams: SERIAL_SEAMS,
        fixtureRandomness: 'Existing canonical boost fixture temporarily chooses Math.random=0.01; no balance/status mutation introduced.' });
      result = await runNativeSimulation({ population: 25, seed, replicate: 0, rounds: 1, serial: true, proof,
        clockScope: 'Controlled test application and isolated-schema SQL clocks; only explicitly scheduled work is covered',
        fixtureOptions: { databaseOptions: serialDatabaseOptions() }, fixtureReady: (fixture) => runtime.bindClock(fixture.clock) });
      await proof.record({ kind: 'random-decisions', tape: runtime.tape });
    } catch (error) {
      result = { status: 'FAIL', error: { message: error.message, stack: error.stack } };
    } finally { runtime.restore(); }
    assert.equal(globalThis.Date, originals.Date); assert.equal(Math.random, originals.random);
    assert.equal(crypto.randomBytes, originals.bytes); assert.equal(crypto.randomUUID, originals.uuid);
    const record = await proof.finish(result);
    await verifyArtifactIndex(output, record);
    assert.equal(result.status, 'PASS_SCOPED', result.error?.message);
    records.push({ directory: label, record, snapshot: JSON.parse(await fs.readFile(path.join(output, 'final-state.json'), 'utf8')) });
  }
  const comparison = { format: 1, source, seed, epoch: SERIAL_EPOCH, seams: SERIAL_SEAMS, clockChecks,
    runs: records.map(({ directory: name, record, snapshot }) => ({ directory: name, status: record.status,
      stateSha256: snapshot.stateSha256, metrics: record.result.metrics, artifacts: record.artifacts })),
    equal: records[0].snapshot.stateSha256 === records[1].snapshot.stateSha256, matrixQualifying: false };
  await fs.writeFile(path.join(directory, 'serial-comparison.json'), `${JSON.stringify(comparison, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  assert.equal(comparison.equal, true, 'Same-seed serial runs differ in complete canonical state; retain both raw snapshots');
  const state = records[0].snapshot;
  for (const [table, column, mutation] of [['characters', 'cash', (v) => Number(v) + 1],
    ['coordination_claim_grants', 'active', (v) => !v], ['world_kernel_objects', 'state', () => 'injected-wrong-state'],
    ['world_operations', 'status', () => 'injected-wrong-outcome']]) {
    const changed = structuredClone(state), originalText = changed.tables[table][0], row = JSON.parse(originalText);
    assert(Object.hasOwn(row, column));
    // Change exactly the tested field's bytes, preserving every other field's SQL
    // numeric representation and whitespace. Do not manufacture a formatting diff.
    const expression = new RegExp(`("${column}":)([^,}]+)`), match = originalText.match(expression);
    assert(match); assert.deepEqual(JSON.parse(match[2]), row[column]);
    changed.tables[table][0] = originalText.replace(expression, (_, prefix) => `${prefix}${JSON.stringify(mutation(row[column]))}`);
    const mutatedHash = sha256(canonicalJson({ tables: changed.tables, sequences: changed.sequences }));
    assert.notEqual(mutatedHash, state.stateSha256, `${table}.${column} mutation was normalized away`);
  }
  console.log(JSON.stringify({ status: 'PASS_SCOPED_SERIAL_REPLAY', source: source.revision,
    stateSha256: state.stateSha256, semanticMutationChecks: 4, fieldExclusions: [], matrixQualifying: false }));
}
