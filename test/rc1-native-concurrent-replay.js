import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { createTransactionScheduler, validateSchedule, SCHEDULE_SCOPE } from '../tools/rc1-native-scheduler.js';
import { installSerialRuntime, serialDatabaseOptions, SERIAL_EPOCH } from '../tools/rc1-native-determinism.js';
import { sourceIdentity, createProofRecorder, canonicalJson, sha256, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { campaignNetworkFixture } from './lib/campaign-network-support.js';
import { findCommand, executeIssued } from './lib/player-command-support.js';
import { createPlayerCommandEngine } from '../src/player-commands.js';
import { boostCar } from '../src/economy.js';
import { runLedgerInvariants } from '../src/invariants.js';
import { verifyLedgerChecks } from '../tools/rc1-sim.js';

const tinyEvents = [{ key: 'a:start', type: 'command.start', request: 'a' },
  { key: 'a:end', type: 'command.end', request: 'a' }];
const tiny = { format: 1, events: tinyEvents, scheduleSha256: sha256(canonicalJson(tinyEvents)) };
validateSchedule(tiny);
assert.throws(() => validateSchedule({ ...tiny, events: [...tinyEvents, tinyEvents[0]] }), /Duplicate schedule/);
assert.throws(() => validateSchedule({ ...tiny, scheduleSha256: 'corrupt' }), /schedule hash mismatch/);
const unfinished = { format: 1, events: tinyEvents.slice(0, 1), scheduleSha256: sha256(canonicalJson(tinyEvents.slice(0, 1))) };
assert.throws(() => validateSchedule(unfinished), /Unfinished scheduled command/);
const malformedEvents = [tinyEvents[0], { key: 'q:end', type: 'query.complete', query: 'q' }, tinyEvents[1]];
assert.throws(() => validateSchedule({ format: 1, events: malformedEvents, scheduleSha256: sha256(canonicalJson(malformedEvents)) }), /Unmatched query completion/);
const simple = createTransactionScheduler();
await simple.run('a', async () => ({ status: 'COMPLETED', replayed: false, retainedOutcome: 12 }));
const simpleTrace = simple.finish();
await assert.rejects(createTransactionScheduler({ replay: simpleTrace }).run('a', async () => ({ status: 'COMPLETED', replayed: false, retainedOutcome: 13 })), /schedule diverged/);
await assert.rejects(createTransactionScheduler({ replay: simpleTrace, deadlineMs: 10 }).run('wrong-request', async () => ({})), /Schedule timed out/);
console.log('PASS: schedule integrity, unfinished work, semantic divergence and fail-closed timeout checks');

if (process.argv.includes('--postgres')) {
  const output = process.argv.find((arg) => arg.startsWith('--output='))?.slice('--output='.length) || process.env.RC1_CONCURRENT_OUTPUT;
  assert(output, 'Provide a new restricted output directory outside the clean source checkout');
  const source = await sourceIdentity(), url = process.env.COORDINATION_TEST_DATABASE_URL || process.env.WORLD_KERNEL_TEST_DATABASE_URL;
  const results = [];
  async function scenario({ fault, replay = null }) {
    const label = `${fault ? 'fault' : 'commit'}-${replay ? 'replay' : 'observe'}`;
    const directory = path.join(output, label), seed = `rc1-concurrent-${fault ? 'fault' : 'commit'}`;
    const proof = await createProofRecorder({ directory, source, runId: label, seed, population: 5,
      scenarioId: 'scoped-native-salvage-contention', configuration: { seed, epoch: SERIAL_EPOCH, fault,
        mode: replay ? 'recorded-schedule-replay' : 'controlled-observation', scheduleScope: SCHEDULE_SCOPE } });
    const runtime = installSerialRuntime(seed), scheduler = createTransactionScheduler({ replay, injectAfterCarDebit: fault });
    const options = serialDatabaseOptions(), factory = options.poolFactory;
    options.poolFactory = (configuration, namespace) => scheduler.wrapPool(factory(configuration, namespace));
    let fixture, pool, result, schedule, initial, final;
    try {
      fixture = await campaignNetworkFixture('recorded_race', { databaseOptions: options }); pool = fixture.pool;
      runtime.bindClock(fixture.clock);
      const actor = fixture.actors.outsider;
      await fixture.move(actor, 'foundry');
      const originalRandom = Math.random;
      let acquired;
      try { Math.random = () => .01; acquired = await fixture.social(actor, (character, client, hooks) => boostCar(character, client, hooks)); }
      finally { Math.random = originalRandom; }
      assert.equal(acquired.car.model, 'junker');
      const engine = () => createPlayerCommandEngine({ pool, content: fixture.content, enabled: true, knowledgeEnabled: true, sharingEnabled: true });
      const firstEngine = engine(), secondEngine = engine();
      const command = findCommand(await firstEngine.snapshot(actor), 'item.salvage', { carId: acquired.car.id });
      const baseline = await runLedgerInvariants(pool, { alert: false });
      initial = await proof.snapshot(pool, 'initial-state');
      await proof.checkpoint(pool, 'initial', url);
      await proof.record({ kind: 'measured-initialization', actor, command, fixtureAssisted: true,
        grantedCashPerFixtureActor: 100000, canonicalAcquiredCar: acquired.car.id,
        randomCounterTapeBeforeMeasurement: runtime.tape, clock: fixture.clock() });
      scheduler.start();
      let race;
      const winner = () => scheduler.run('winner', () => executeIssued(firstEngine, actor, command));
      const contender = () => scheduler.run('contender', () => executeIssued(secondEngine, actor, command));
      if (replay) {
        // Deliberately reversed launch order. Only the retained schedule establishes
        // the overlap and result; no observation-specific latch is used here.
        const second = contender(); const first = winner(); race = await Promise.allSettled([first, second]);
      } else {
        const first = winner(); const observedFirst = Promise.allSettled([first]);
        await scheduler.waitForWinnerLock();
        const second = await Promise.allSettled([contender()]);
        scheduler.releaseWinner(); race = [...await observedFirst, ...second];
      }
      assert.equal(race[1].status, 'rejected'); assert.equal(race[1].reason.code, 'contention');
      if (fault) {
        assert.equal(race[0].status, 'rejected'); assert.equal(race[0].reason.code, 'P0001');
        const failedState = await proof.snapshot(pool, 'first-failure-state');
        assert.equal(sha256(canonicalJson(failedState.tables)), sha256(canonicalJson(initial.tables)),
          'Injected failed transaction left committed game mutations');
        await proof.checkpoint(pool, 'first-failure', url);
      } else { assert.equal(race[0].status, 'fulfilled'); assert.equal(race[0].value.replayed, false); }
      const afterRace = await proof.snapshot(pool, 'after-race-state');
      // Close every connection and construct a new command engine. This proves
      // connection/engine restart; process restart is a separate required gate.
      await pool.end(); pool = fixture.db.reopen();
      const retry = await scheduler.run('restart-retry', () => executeIssued(engine(), actor, command));
      assert.equal(retry.replayed, !fault);
      if (!fault) assert.equal((await proof.snapshot(pool, 'after-restart-state')).stateSha256, afterRace.stateSha256,
        'Restarted replay changed canonical state');
      const repeated = await scheduler.run('exact-retry', () => executeIssued(engine(), actor, command));
      assert.equal(repeated.replayed, true);
      schedule = scheduler.finish(); scheduler.stop();
      const lockErrors = schedule.events.filter((entry) => entry.type === 'query.complete' && entry.request === 'contender' && entry.code === '55P03');
      assert.equal(lockErrors.length, 1, 'The race must encounter an actual PostgreSQL row-lock conflict');
      const held = schedule.physicalTransactions.find((entry) => entry.request === 'winner' && entry.rowLockAcquired);
      const other = schedule.physicalTransactions.find((entry) => entry.request === 'contender' && entry.began);
      assert(held?.postgresTransactionId, 'Winner must retain a real PostgreSQL transaction identity');
      assert.notEqual(held.backendPid, other?.backendPid, 'The contenders must use different PostgreSQL backends');
      assert(schedule.commitOrder.some((entry) => entry.postgresTransactionId), 'Economic commit identity must be retained');
      assert.equal(schedule.injectionFired, fault);
      assert.equal(schedule.driverCompletions.length, schedule.events.filter((entry) => entry.type === 'query.complete').length,
        'Every actual driver completion must be retained independently of its scheduled delivery');
      const invariantChecks = verifyLedgerChecks(baseline, await runLedgerInvariants(pool, { alert: false }), 5);
      assert.equal(Number((await pool.query('SELECT count(*) AS n FROM cars WHERE id=$1', [acquired.car.id])).rows[0].n), 0);
      final = await proof.snapshot(pool, 'final-state'); await proof.checkpoint(pool, 'final', url);
      await proof.artifact('transaction-schedule.json', schedule);
      await proof.record({ kind: 'assertions', invariantChecks, actualPostgresLockConflicts: lockErrors.length,
        distinctBackends: true, allChangesAfterInitialization: 'canonical commands, plus an explicit SQL exception injection inside the canonical transaction',
        scope: SCHEDULE_SCOPE, randomDecisions: runtime.tape });
      result = { status: 'PASS_SCOPED', recordedConcurrentReplay: !!replay, controlledObservation: !replay,
        faultRollbackVerified: fault, postgresLockConflicts: 1, initialStateSha256: initial.stateSha256,
        finalStateSha256: final.stateSha256, scheduleSha256: schedule.scheduleSha256,
        events: schedule.events.length, commits: schedule.commitOrder.length, invariantChecks, matrixQualifying: false };
    } catch (error) {
      scheduler.releaseWinner(); scheduler.stop();
      await proof.artifact('failure-schedule.json', scheduler.diagnostic());
      await proof.record({ kind: 'failure', message: error.message, stack: error.stack });
      result = { status: 'FAIL', error: { message: error.message, stack: error.stack } };
    } finally {
      if (fixture && pool) await fixture.db.cleanup(pool);
      runtime.restore();
    }
    const record = await proof.finish(result); await verifyArtifactIndex(directory, record);
    assert.equal(result.status, 'PASS_SCOPED', result.error?.message);
    console.log(JSON.stringify({ run: label, status: result.status, events: result.events, finalStateSha256: result.finalStateSha256 }));
    return { label, result, schedule, artifacts: record.artifacts };
  }
  for (const fault of [false, true]) {
    const observed = await scenario({ fault }); const reproduced = await scenario({ fault, replay: observed.schedule });
    assert.equal(reproduced.result.initialStateSha256, observed.result.initialStateSha256, 'Replay did not start from identical canonical state');
    assert.equal(reproduced.result.finalStateSha256, observed.result.finalStateSha256, 'Recorded schedule did not reproduce complete canonical state');
    assert.equal(reproduced.result.scheduleSha256, observed.result.scheduleSha256, 'Recorded request/transaction schedule changed');
    results.push(observed, reproduced);
  }
  const summary = { format: 1, source, status: 'PASS_SCOPED_RECORDED_CONCURRENT_REPLAY', scope: SCHEDULE_SCOPE,
    matrixQualifying: false, results: results.map(({ schedule, ...entry }) => entry) };
  await fs.writeFile(path.join(output, 'concurrent-comparison.json'), `${JSON.stringify(summary, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  console.log(JSON.stringify({ status: summary.status, source: source.revision, scenarios: results.length, matrixQualifying: false }));
}
