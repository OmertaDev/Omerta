import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createRecordedQueryOrder, replayRowOrder, replayCompleteProjection, QUERY_ORDER_SCOPE } from '../tools/rc1-native-query-order.js';
import { canonicalJson, sha256, sourceIdentity, createProofRecorder, verifyArtifactIndex } from '../tools/rc1-native-proof.js';

const standing = QUERY_ORDER_SCOPE.queries.find(query => query.id === 'standing-population');
const market = QUERY_ORDER_SCOPE.queries.find(query => query.id === 'market-due');
const typed = [{ account_id: 'a', kills: '9007199254740993', name: 'A', respect: 0 },
  { account_id: 'b', kills: '0', name: 'B', respect: 0 }];
assert.equal(replayRowOrder([...typed].reverse(), typed)[0], typed[0], 'Replay retains the actual native row object/types');
for (const changed of [[typed[0]], [...typed, typed[0]], [typed[0], typed[0]],
  [{ ...typed[0], kills: '9007199254740992' }, typed[1]]])
  assert.throws(() => replayRowOrder(changed, typed), /row count|membership\/value/);
const listings = ['{"id":"a","kind":"order","seller_character":"alice","bidder":null,"price":9007199254740993}',
  '{"id":"b","kind":"order","seller_character":"bob","bidder":null,"price":2492}'];
const selected = listings.map(text => { const row = JSON.parse(text); return Object.fromEntries(market.projection.map(key => [key, row[key]])); });
const projection = { eligibleRows: listings, nativeRows: selected, projection: market.projection };
assert.deepEqual(replayCompleteProjection({ ...projection, nativeRows: [...selected].reverse() }), [...selected].reverse());
for (const changed of [listings.slice(1), [...listings, listings[0]], [listings[0], listings[0]],
  [listings[0].replace('9007199254740993', '9007199254740992'), listings[1]]])
  assert.throws(() => replayCompleteProjection({ ...projection, eligibleRows: changed, recordedEligibleRows: listings }), /row count|membership\/value/);
assert.throws(() => replayCompleteProjection({ ...projection, recordedRows: [selected[0], selected[0]] }), /membership\/value/);
assert.deepEqual(replayCompleteProjection({ eligibleRows: [], nativeRows: [], projection: market.projection }), []);

// Wrong tape query identity/SQL and original query byte/parameter changes fail
// before any row is delivered. Unrelated SQL remains outside the bounded seam.
const temporary = await fs.mkdtemp(path.join(os.tmpdir(), 'rc1-order-controls-'));
const artifact = async (name, value) => fs.writeFile(path.join(temporary, name), JSON.stringify(value));
function fakePool(rows) { return { connect: async () => ({ query: async () => ({ rows, rowCount: rows.length }), release() {} }) }; }
const observe = createRecordedQueryOrder({ artifact });
const client = await observe.wrapPool(fakePool(typed)).connect();
await client.query(standing.originalSql); const tape = await observe.finish();
const replay = createRecordedQueryOrder({ replay: tape, replayDirectory: temporary, artifact: async () => {} });
const reversed = await replay.wrapPool(fakePool([...typed].reverse())).connect();
assert.deepEqual((await reversed.query(standing.originalSql)).rows, typed); await replay.finish();
for (const sql of [standing.originalSql + ' ', { text: standing.originalSql }]) {
  const control = createRecordedQueryOrder({ artifact: async () => {} });
  const c = await control.wrapPool(fakePool(typed)).connect();
  await assert.rejects(c.query(sql), /bytes changed|Unsupported query configuration/);
}
for (const replacement of [{ queryId: 'wrong-query' }, { sql: 'SELECT wrong' }]) {
  const original = JSON.parse(await fs.readFile(path.join(temporary, tape.tape.chunks[0].path)));
  Object.assign(original.entries[0].record, replacement);
  const changed = structuredClone(tape); changed.tape.chunks[0].semanticSha256 = sha256(canonicalJson(original));
  await artifact(changed.tape.chunks[0].path, original);
  const control = createRecordedQueryOrder({ replay: changed, replayDirectory: temporary, artifact: async () => {} });
  const c = await control.wrapPool(fakePool(typed)).connect();
  await assert.rejects(c.query(standing.originalSql), /query identity differs|query SQL differs/);
}
console.log('PASS: exact typed/full-row order, large numeric values, missing/extra/duplicate rows, query identity and original SQL byte controls');

if (process.argv.includes('--postgres')) {
  const output = process.argv.find(arg => arg.startsWith('--output='))?.slice(9) || process.env.RC1_QUERY_ORDER_OUTPUT;
  const controlUrl = process.env.COORDINATION_TEST_DATABASE_URL; assert(output && controlUrl);
  const source = await sourceIdentity();
  const { planOwnedWorldDatabase } = await import('../tools/rc1-native-database.js');
  const { installSerialRuntime, serialDatabaseOptions } = await import('../tools/rc1-native-determinism.js');
  const { commandDatabase, addPlayer } = await import('./lib/player-command-support.js');
  const { recordReckoning } = await import('../src/season.js');
  const { sweepMarket } = await import('../src/market.js');
  process.env.STANDING_CACHE_MS = '0';
  const results = [], epoch = '2026-09-20T12:00:00.000Z';
  let observedTape;
  for (const scenario of [
    { id: 'observed', reverse: false }, { id: 'native-reversed', reverse: true }, { id: 'replayed', reverse: true, replay: true },
    { id: 'standing-value', replay: true, change: 'standing-value', rejects: /membership\/value/ },
    { id: 'standing-missing', replay: true, change: 'standing-missing', rejects: /row count/ },
    { id: 'standing-extra', replay: true, change: 'standing-extra', rejects: /row count/ },
    { id: 'market-value', replay: true, change: 'market-value', rejects: /membership\/value/ },
    { id: 'market-missing', replay: true, change: 'market-missing', rejects: /row count/ },
    { id: 'market-extra', replay: true, change: 'market-extra', rejects: /row count/ },
    { id: 'query-identity', replay: true, change: 'query-identity', rejects: /query identity/ },
  ]) {
    const directory = path.join(output, scenario.id);
    const lease = planOwnedWorldDatabase({ controlUrl, runId: `query-order-${scenario.id}`, sourceRevision: source.revision });
    const proof = await createProofRecorder({ directory, source, configuration: { scenario: scenario.id, sourceScope: QUERY_ORDER_SCOPE,
      initialization: 'Synthetic two-player and two already-due order fixture before measurement; native schema and canonical recordReckoning/sweepMarket thereafter. No resource qualification or elapsed-hour claim.',
      physicalOrderControl: 'Insert identical initial rows in opposite native heap orders; never rewrite measured state or query results.',
      expectedRejection: scenario.rejects?.source || null, database: lease.descriptor },
      runId: scenario.id, seed: 'query-order-causal', scenarioId: 'scoped-recorded-canonical-query-order', population: 2 });
    let database, runtime, queryOrder, result;
    try {
      await proof.record({ kind: 'database-created', ...await lease.create() });
      process.env.COORDINATION_TEST_DATABASE_URL = lease.url;
      runtime = installSerialRuntime('query-order-causal', epoch);
      database = await commandDatabase('query_order_causal', serialDatabaseOptions());
      const pool = database.pool;
      let actorIds = ['order-a', 'order-b'];
      if (scenario.change === 'standing-missing') actorIds = actorIds.slice(0, 1);
      if (scenario.change === 'standing-extra') actorIds.push('order-c');
      if (scenario.reverse) actorIds.reverse();
      for (const actor of actorIds) await addPlayer(pool, actor);
      if (scenario.change === 'standing-value') await pool.query("UPDATE account_persistent SET kills=1 WHERE account_id='order-a'");
      let orders = [{ id: 'listing-a', owner: 'order-a-character', price: 352 }, { id: 'listing-b', owner: 'order-b-character', price: 2492 }];
      // Missing standing actor is a separate negative control; avoid foreign-key
      // invalid fixtures before the intended eligible-roster check can run.
      orders = orders.filter(order => actorIds.includes(order.owner.replace('-character', '')));
      if (scenario.change === 'market-value') orders[0].price++;
      if (scenario.change === 'market-missing') orders.pop();
      if (scenario.change === 'market-extra') orders.push({ id: 'listing-c', owner: 'order-a-character', price: 50 });
      if (scenario.reverse) orders.reverse();
      for (const order of orders) await pool.query(
        "INSERT INTO market_listings(id,seller_character,kind,good_id,qty,district,price,expires_at) VALUES($1,$2,'order','booze',1,'docks',$3,$4)",
        [order.id, order.owner, order.price, new Date(Date.now() - 1)]);
      await proof.record({ kind: 'initialization-complete', actorIds, orders });
      const initial = await proof.snapshot(pool, 'initial');
      queryOrder = createRecordedQueryOrder({ replay: scenario.replay ? observedTape : null,
        replayDirectory: path.join(output, 'observed'), artifact: proof.artifact });
      queryOrder.wrapPool(pool);
      const readInputs = async () => {
        const first = await pool.query(scenario.change === 'query-identity' ? market.originalSql : standing.originalSql);
        const second = await pool.query(market.originalSql);
        return { standing: first.rows, market: second.rows };
      };
      if (scenario.rejects) {
        await assert.rejects(readInputs(), scenario.rejects);
        const after = await proof.snapshot(pool, 'rejected-input');
        assert.equal(after.stateSha256, initial.stateSha256, 'Rejected replay must not mutate canonical state');
        await proof.artifact('query-order.json', await queryOrder.diagnostic());
        result = { status: 'PASS_SCOPED', expectedReplayRejected: true, stateUnchanged: true, initialStateSha256: initial.stateSha256 };
      } else {
        const inputs = await readInputs(); await proof.artifact('canonical-query-inputs.json', inputs);
        const crown = await proof.invoke('recordReckoning', { season: 738 }, () => recordReckoning(pool, 738));
        const marketResult = await proof.invoke('sweepMarket', {}, () => sweepMarket(pool));
        const final = await proof.snapshot(pool, 'final');
        const tape = await queryOrder.finish(); await proof.artifact('query-order.json', tape);
        if (scenario.id === 'observed') observedTape = tape;
        result = { status: 'PASS_SCOPED', initialStateSha256: initial.stateSha256, finalStateSha256: final.stateSha256,
          nativeOrReplayedStandingOrder: inputs.standing.map(row => row.account_id),
          nativeOrReplayedMarketOrder: inputs.market.map(row => row.id), crown, marketResult };
      }
      await proof.artifact('random-tape.json', { draws: runtime.tape });
    } catch (error) {
      result = { status: 'FAIL', error: error.message, stack: error.stack };
      await proof.record({ kind: 'failure', ...result });
      if (queryOrder) await proof.artifact('failure-query-order.json', await queryOrder.diagnostic());
      if (runtime) await proof.artifact('failure-random-tape.json', { draws: runtime.tape });
      if (database) await proof.snapshot(database.pool, 'failure');
      process.exitCode = 1;
    } finally {
      try { if (database) await database.cleanup(database.pool); await proof.record({ kind: 'database-cleanup', ...await lease.close() }); }
      catch (error) { result.status = 'FAIL'; result.cleanupError = error.message; process.exitCode = 1; }
      runtime?.restore(); process.env.COORDINATION_TEST_DATABASE_URL = controlUrl;
      const run = await proof.finish(result); await verifyArtifactIndex(directory, run); results.push({ id: scenario.id, result, runSha256: sha256(await fs.readFile(path.join(directory, 'run.json'))) });
    }
    assert.equal(result.status, 'PASS_SCOPED', JSON.stringify(result));
  }
  const [observed, nativeReversed, replayed] = results.map(item => item.result);
  assert.equal(observed.initialStateSha256, nativeReversed.initialStateSha256);
  assert.equal(observed.initialStateSha256, replayed.initialStateSha256);
  assert.notDeepEqual(observed.nativeOrReplayedStandingOrder, nativeReversed.nativeOrReplayedStandingOrder);
  assert.notDeepEqual(observed.nativeOrReplayedMarketOrder, nativeReversed.nativeOrReplayedMarketOrder);
  assert.notEqual(observed.crown.champion, nativeReversed.crown.champion);
  assert.notEqual(observed.finalStateSha256, nativeReversed.finalStateSha256);
  assert.deepEqual(replayed, observed, 'Recorded native order must recover all canonical state, outcomes and generated receipt ownership');
  await fs.writeFile(path.join(output, 'comparison.json'), JSON.stringify({ source, scope: QUERY_ORDER_SCOPE, results, matrixQualifying: false }, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify({ status: 'PASS_SCOPED', source: source.revision, nativeCausalCases: results.length,
    finalStateSha256: observed.finalStateSha256, matrixQualifying: false }));
}
