// Direct-authority native reduction, linked to retained world evidence. This is
// not a replay/minimization of the full world trajectory or seasonal waiting.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { canonicalJson, sha256, sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';
import { reduceNativeFailure } from '../tools/rc1-native-failure-reducer.js';
import { createRecordedQueryOrder, replayRowOrder, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';
import { planOwnedWorldDatabase } from '../tools/rc1-native-database.js';
import { installSerialRuntime, serialDatabaseOptions } from '../tools/rc1-native-determinism.js';
import { commandDatabase, addPlayer } from './lib/player-command-support.js';
import { recordReckoning } from '../src/season.js';
import { sweepMarket } from '../src/market.js';
import { STANDING_PILLARS } from '../src/standing.js';

const argument = name => process.argv.find(value => value.startsWith(`--${name}=`))?.slice(name.length + 3);
assert(process.argv.includes('--postgres'), 'Real PostgreSQL required');
const directory = argument('output'), retainedDirectory = argument('recorded-run'), failedDirectory = argument('world-failure');
const sequence = Number(argument('standing-sequence')), season = Number(argument('season'));
const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL;
assert(directory && retainedDirectory && failedDirectory && controlUrl);
assert(Number.isSafeInteger(sequence) && sequence > 0 && Number.isSafeInteger(season) && season > 0);
const source = await sourceIdentity(), read = async file => JSON.parse(await fs.readFile(file, 'utf8'));
const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();
const retained = await read(path.join(retainedDirectory, 'run.json'));
const failed = await read(path.join(failedDirectory, 'run.json'));
await verifyArtifactIndex(retainedDirectory, retained); await verifyArtifactIndex(failedDirectory, failed);
assert.equal(retained.status, 'PASS_SCOPED'); assert.equal(failed.status, 'FAIL');
assert.match(failed.result.error, /Actor replay differs: finalStateSha256/);
assert.equal(git('rev-parse', 'HEAD:src'), git('rev-parse', `${retained.source.revision}:src`), 'Canonical source tree differs from retained native input');
assert.equal(source.schemaSha256, retained.source.schemaSha256); assert.equal(source.lockfileSha256, retained.source.lockfileSha256);
const retainedOrder = await read(path.join(retainedDirectory, 'query-order.json'));
assert.deepEqual(retainedOrder.scope, QUERY_ORDER_SCOPE);
const descriptor = retainedOrder.tape.chunks.find(chunk => sequence >= chunk.firstEntry && sequence <= chunk.lastEntry);
assert(descriptor, 'Requested retained occurrence is missing');
const chunk = await read(path.join(retainedDirectory, descriptor.path));
assert.equal(sha256(canonicalJson(chunk)), descriptor.semanticSha256);
const occurrence = chunk.entries.find(entry => entry.sequence === sequence);
assert.equal(occurrence?.accepted, true); assert.equal(occurrence.record.queryId, 'standing-population');
replayRowOrder(occurrence.arrival.rows, occurrence.record.rows);
const columns = [...new Set(STANDING_PILLARS.flatMap(pillar => pillar.cols))];
assert(occurrence.record.rows.every(row => columns.every(column => Number(row[column]) === 0)), 'This bounded reducer requires the retained zero-standing tie');
const winners = [occurrence.record.rows[0].account_id, occurrence.arrival.rows[0].account_id];
assert.notEqual(...winners, 'Selected occurrence has no tied-winner counterexample');
const epoch = retained.configuration.start;
const witness = await read(path.join(retainedDirectory, 'day-29.json'));
const savedSeason = witness.tables.season_records.map(JSON.parse).find(row => Number(row.season) === season);
assert(savedSeason && savedSeason.champion_account === winners[0]);
const logicalDelayMs = Date.parse(savedSeason.at) - Date.parse(epoch); assert(logicalDelayMs >= 0);
const input = { format: 1, assertionIdentity: 'RC1-01.complete-canonical-state-equality/crown-recipient', source,
  canonicalSource: { retainedRevision: retained.source.revision, srcTree: git('rev-parse', 'HEAD:src'), schemaSha256: source.schemaSha256 },
  configuration: { epoch, seed: 'retained-crown-reduction', season, standingCacheMs: 0,
    fixture: 'Only initial synthetic fixture construction. Retain every recorded ranking input column/type; other canonical columns use the existing addPlayer fixture. No writes outside canonical authorities after initialization.',
    eventSource: 'Four operations of the existing bounded native query-order case: standing read, market due read, recordReckoning, sweepMarket. This is a newly frozen causal baseline, not the archived world event list.',
    timeScope: 'Direct-authority diagnostic delay, initially from the retained seasonal timestamp. No worker is registered and no seasonal waiting-period equivalence is claimed.',
    maximumTrials: 48, maximumWallMs: 1200000, resourceQualification: false },
  lineage: { retainedDirectory: path.resolve(retainedDirectory), retainedRunSha256: sha256(await fs.readFile(path.join(retainedDirectory, 'run.json'))),
    chunk: descriptor, sequence, occurrenceSha256: sha256(canonicalJson(occurrence)),
    failedDirectory: path.resolve(failedDirectory), failedSource: failed.source, failedRunSha256: sha256(await fs.readFile(path.join(failedDirectory, 'run.json'))) },
  failureFingerprint: { mismatch: 'canonical-crown-recipient', recordedChampion: winners[0], nativeChampion: winners[1] },
  rankingRows: occurrence.record.rows, nativeOrder: occurrence.arrival.rows.map(row => row.account_id),
  candidate: { actorIds: occurrence.record.rows.map(row => row.account_id),
    eventIds: ['standing-read', 'market-read', 'crown', 'market-sweep'], logicalDelayMs } };
const inputSha256 = sha256(canonicalJson(input));
const proof = await createProofRecorder({ directory, source, configuration: { inputSha256, assertionIdentity: input.assertionIdentity,
  limits: { maximumTrials: 48, maximumWallMs: 1200000 }, mutableDimensions: ['actorIds', 'eventIds', 'logicalDelayMs'],
  scope: 'Direct-authority causal reduction linked to retained world failure. No minimized full-world history, elapsed season, resource or matrix qualification.' },
  runId: 'native-crown-failure-reduction', seed: input.configuration.seed, scenarioId: 'scoped-native-failure-reduction', population: input.candidate.actorIds.length });
await proof.artifact('immutable-failure-input.json', input);
const oldCache = process.env.STANDING_CACHE_MS; process.env.STANDING_CACHE_MS = '0';
const standing = QUERY_ORDER_SCOPE.queries.find(query => query.id === 'standing-population');
const market = QUERY_ORDER_SCOPE.queries.find(query => query.id === 'market-due');

async function nativeCase(candidate, trial, side) {
  const caseDirectory = path.join(directory, `trial-${String(trial.trial).padStart(4, '0')}-${side}`);
  const lease = planOwnedWorldDatabase({ controlUrl, runId: `reduce-${trial.trial}-${side}`, sourceRevision: source.revision });
  const caseProof = await createProofRecorder({ directory: caseDirectory, source, configuration: { inputSha256,
    candidateSha256: trial.candidateSha256, assertionIdentity: input.assertionIdentity, candidate, side,
    database: lease.descriptor, frozenConfiguration: input.configuration },
    runId: `trial-${trial.trial}-${side}`, seed: input.configuration.seed, scenarioId: 'scoped-native-reduction-trial', population: candidate.actorIds.length });
  let database, runtime, order, result, logicalAt = Date.parse(epoch);
  try {
    await caseProof.record({ kind: 'database-created', ...await lease.create() });
    process.env.COORDINATION_TEST_DATABASE_URL = lease.url;
    runtime = installSerialRuntime(input.configuration.seed, epoch); runtime.bindClock(() => logicalAt);
    database = await commandDatabase('failure_reducer', serialDatabaseOptions());
    const pool = database.pool;
    const rows = input.rankingRows.filter(row => candidate.actorIds.includes(row.account_id));
    const desired = side === 'recorded' ? rows : input.nativeOrder.filter(id => candidate.actorIds.includes(id)).map(id => rows.find(row => row.account_id === id));
    for (const row of desired) {
      await addPlayer(pool, row.account_id, row.name);
      await pool.query('UPDATE characters SET respect=$2 WHERE account_id=$1', [row.account_id, row.respect]);
      await pool.query(`UPDATE account_persistent SET ${columns.map((column, index) => `${column}=$${index + 2}`).join(',')} WHERE account_id=$1`,
        [row.account_id, ...columns.map(column => row[column])]);
    }
    order = createRecordedQueryOrder({ artifact: caseProof.artifact }); order.wrapPool(pool);
    const actual = (await pool.query(standing.originalSql)).rows;
    assert.deepEqual(actual, desired, 'Native insertion order must reproduce the retained eligible rows and order without rewriting query results');
    await caseProof.artifact('native-ranking-input.json', actual);
    await caseProof.record({ kind: 'initialization-complete', inputSha256, candidateSha256: trial.candidateSha256 });
    const initial = await caseProof.snapshot(pool, 'initial');
    for (const event of candidate.eventIds) {
      logicalAt = Date.parse(epoch) + (['crown', 'market-sweep'].includes(event) ? candidate.logicalDelayMs : 0);
      await caseProof.invoke(event, { logicalAt, season }, async () => {
        if (event === 'standing-read') return (await pool.query(standing.originalSql)).rows;
        if (event === 'market-read') return (await pool.query(market.originalSql)).rows;
        if (event === 'crown') return recordReckoning(pool, season);
        if (event === 'market-sweep') return sweepMarket(pool);
        assert.fail('Unsupported retained event');
      });
    }
    const final = await caseProof.snapshot(pool, 'final');
    const crown = final.tables.season_records.map(JSON.parse).find(row => Number(row.season) === season) || null;
    await caseProof.artifact('query-order.json', await order.finish());
    await caseProof.artifact('random-tape.json', { draws: runtime.tape });
    result = { status: 'PASS_SCOPED', initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256,
      champion: crown?.champion_account || null, logicalDelayMs: candidate.logicalDelayMs, executedEvents: candidate.eventIds };
  } catch (error) {
    result = { status: 'FAIL', error: error.message, stack: error.stack }; await caseProof.record({ kind: 'failure', ...result });
    if (order) await caseProof.artifact('failure-query-order.json', await order.diagnostic());
    if (runtime) await caseProof.artifact('failure-random-tape.json', { draws: runtime.tape });
    if (database) await caseProof.snapshot(database.pool, 'failure');
  } finally {
    try { if (database) await database.cleanup(database.pool); await caseProof.record({ kind: 'database-cleanup', ...await lease.close() }); }
    catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; await caseProof.record({ kind: 'cleanup-failure', message: error.message }); }
    runtime?.restore(); process.env.COORDINATION_TEST_DATABASE_URL = controlUrl;
  }
  const sealed = await caseProof.finish(result); await verifyArtifactIndex(caseDirectory, sealed);
  return { directory: caseDirectory, runSha256: sha256(await fs.readFile(path.join(caseDirectory, 'run.json'))), result };
}

let result;
try {
  const reduction = await reduceNativeFailure({ input, maximumTrials: 48, maximumWallMs: 1200000, record: proof.record,
    runTrial: async (candidate, trial) => {
      const cases = [];
      for (const side of ['recorded', 'native']) cases.push(await nativeCase(candidate, trial, side));
      const base = { assertionIdentity: input.assertionIdentity, inputSha256, candidateSha256: trial.candidateSha256, cases };
      if (cases.some(item => item.result.status !== 'PASS_SCOPED')) return { ...base, status: 'ERROR', failureFingerprint: null };
      const [a, b] = cases.map(item => item.result);
      assert.equal(a.initialStateSha256, b.initialStateSha256, 'Paired canonical initial states must match exactly');
      let assertion = { status: 'PASSED', message: null, stack: null };
      try { assert.equal(a.finalStateSha256, b.finalStateSha256, input.assertionIdentity); }
      catch (error) { assertion = { status: 'FAILED', message: error.message, stack: error.stack }; }
      const fingerprint = { mismatch: 'canonical-crown-recipient', recordedChampion: a.champion, nativeChampion: b.champion };
      const reproduced = assertion.status === 'FAILED' && canonicalJson(fingerprint) === canonicalJson(input.failureFingerprint);
      const outcome = { ...base, status: reproduced ? 'REPRODUCED' : 'NOT_REPRODUCED', assertion,
        failureFingerprint: reproduced ? fingerprint : null, canonicalStateExclusions: [] };
      await proof.artifact(`trial-${String(trial.trial).padStart(4, '0')}.json`, outcome);
      if (trial.trial === 1) await proof.artifact('baseline-failure.json', outcome);
      console.log(JSON.stringify({ trial: trial.trial, actors: candidate.actorIds.length, events: candidate.eventIds.length,
        logicalDelayMs: candidate.logicalDelayMs, status: outcome.status }));
      return outcome;
    } });
  await proof.artifact('reduction-result.json', reduction);
  assert.equal(reduction.status, 'REDUCED_SCOPED', 'Bounded or failed reduction cannot pass');
  assert.equal(reduction.reduced.actorIds.length, 2); assert.deepEqual(reduction.reduced.eventIds, ['crown']);
  assert.equal(reduction.reduced.logicalDelayMs, 0);
  result = { status: 'PASS_SCOPED', inputSha256, reduced: reduction.reduced, trials: reduction.trials,
    minimality: reduction.minimality, assertionIdentity: input.assertionIdentity, failureFingerprint: input.failureFingerprint,
    statement: 'Native direct-authority causal reduction only; no minimized90-day worker trajectory or seasonal waiting period.' };
} catch (error) {
  result = { status: 'FAIL', error: error.message, stack: error.stack }; await proof.record({ kind: 'failure', ...result }); process.exitCode = 1;
} finally {
  if (oldCache === undefined) delete process.env.STANDING_CACHE_MS; else process.env.STANDING_CACHE_MS = oldCache;
  const sealed = await proof.finish(result); await verifyArtifactIndex(directory, sealed);
}
console.log(JSON.stringify({ source: source.revision, ...result, matrixQualifying: false }));
