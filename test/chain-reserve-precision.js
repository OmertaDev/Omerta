import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

// Execute the unchanged production function bodies with explicit fake boundaries.
// No module imports from chain.js, signing SDK, SQL engine, RPC or real keys.
const source = readFileSync(new URL('../src/chain.js', import.meta.url), 'utf8');
function body(name, optional = false) {
  const match = new RegExp(`^(?:export )?(?:async )?function ${name}\\(`, 'm').exec(source);
  if (!match && optional) return '';
  assert.ok(match, `Production function ${name} is present`);
  const end = source.indexOf('\n}', match.index);
  assert.ok(end > match.index);
  return source.slice(match.index, end + 2).replace(/^export /, '');
}
class GameError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
const address = '0x' + '12'.repeat(20);
const sumSQL = "SELECT COALESCE(SUM(amount),0) s FROM vouchers WHERE kind='omr' AND (status='signed' OR claimed_onchain)";

function fixture(options = {}) {
  const {queued = [], live = '0', taxBps = 0, amount = 1} = options;
  const funded = Object.hasOwn(options, 'funded') ? options.funded : '1';
  const committed = Object.hasOwn(options, 'committed') ? options.committed : '0';
  const trace = [], signs = [], entries = [], tolls = [];
  let transaction = null, state = {nonce: 1, debits: [], vouchers: [], signedRows: []}, released = 0;
  const client = {
    async query(sql, params = []) {
      trace.push({sql, params: [...params]});
      if (sql === 'BEGIN') { assert.equal(transaction, null); transaction = structuredClone(state); return {rows: []}; }
      if (sql === 'COMMIT') { assert.ok(transaction); state = transaction; transaction = null; return {rows: []}; }
      if (sql === 'ROLLBACK') { transaction = null; return {rows: []}; }
      assert.ok(transaction, 'All production queries remain inside the transaction');
      if (sql === 'SELECT * FROM account_persistent WHERE account_id=$1 FOR UPDATE') {
        return {rows: [{account_id: 'synthetic-account', minted: true, wallet_address: address, omr: '1000'}]};
      }
      if (sql === 'UPDATE account_persistent SET omr = omr - $2 WHERE account_id=$1') {
        transaction.debits.push([...params]); return {rows: []};
      }
      if (sql === 'SELECT * FROM chain_reserve WHERE id=1 FOR UPDATE') {
        return {rows: [{id: 1, funded_omr: funded, next_nonce: transaction.nonce}]};
      }
      if (sql === 'UPDATE chain_reserve SET next_nonce = next_nonce + 1 WHERE id=1') {
        transaction.nonce++; return {rows: []};
      }
      if (sql === sumSQL) return {rows: Object.hasOwn(options, 'sumRows') ? options.sumRows : [{s: committed}]};
      if (sql === "SELECT COALESCE(SUM(amount),0) s FROM vouchers WHERE kind='omr' AND status='signed' AND NOT claimed_onchain") return {rows: [{s: live}]};
      if (sql === "SELECT * FROM vouchers WHERE kind='omr' AND status='queued' ORDER BY created_at, nonce") return {rows: queued};
      if (sql.startsWith('INSERT INTO vouchers (id, account_id, kind, amount, nonce,')) {
        transaction.vouchers.push([...params]); return {rows: []};
      }
      if (sql === "UPDATE vouchers SET status='signed', signed_payload=$2, deadline=$3 WHERE id=$1") {
        transaction.signedRows.push([...params]); return {rows: []};
      }
      assert.fail('Unexpected production SQL in the finite fake client');
    },
    release() { released++; }
  };
  const context = vm.createContext({
    GameError, process: {env: Object.freeze(options.dailyCapWei === undefined ? {} : {DAILY_CAP_OMR: options.dailyCapWei})}, WITHDRAW_TTL_SEC: 86400,
    Date: {now: () => 1700000000000},
    withdrawTaxBps: () => taxBps,
    earlySurcharge: async () => ({surcharge: 0, freshSold: 0}),
    splitToll: tax => ({devCut: tax / 2, buyCut: tax / 2}),
    creditTollBuckets: async (_client, dev, buy) => { tolls.push({dev, buy}); },
    ledger: async (_client, entry) => { entries.push({...entry}); },
    isAddress: value => value === address, getAddress: value => value,
    uid: () => 'synthetic-voucher',
    signVoucher: async row => { signs.push({...row}); return {voucher: {amount: String(row.amount)}, signature: 'synthetic-only'}; }
  });
  vm.runInContext([
    body('reserveMicros', true), body('committedOutstanding'), body('requestWithdraw'), body('drainQueue'),
    'globalThis.production = {requestWithdraw, drainQueue};'
  ].join('\n'), context, {filename: 'production-chain-reserve-functions.js', timeout: 1000});
  const pool = {connect: async () => client};
  return {trace, signs, entries, tolls, state: () => state, released: () => released,
    request: () => context.production.requestWithdraw(pool, 'synthetic-account', amount, address),
    drain: options => context.production.drainQueue(pool, options)};
}
const refuses = async run => assert.rejects(run, error => error.code === 'reserve_precision'
  && !/PRIVATE|99999999999|100000000000/.test(error.message));

test('production immediate withdrawal queues a one-micro underfunded cumulative claim without signing', async () => {
  const run = fixture({funded: '100000000000.000000', committed: '99999999999.000001'});
  const result = await run.request();
  assert.equal(result.status, 'queued');
  assert.equal(result.queuedReason, 'reserve_insufficient');
  assert.equal(run.signs.length, 0);
  assert.equal(run.state().vouchers.length, 1);
  assert.equal(run.state().vouchers[0][7], 'queued');
  assert.equal(run.state().vouchers[0][8], null);
  assert.equal(run.trace.at(-1).sql, 'COMMIT');
  assert.equal(run.released(), 1);
});

test('production exact-fit and one-micro spare capacity retain the existing signing branch', async () => {
  for (const committed of ['99999999999.000000', '99999999998.999999']) {
    const run = fixture({funded: '100000000000.000000', committed});
    const result = await run.request();
    assert.equal(result.status, 'signed');
    assert.equal(result.queuedReason, undefined);
    assert.equal(run.signs.length, 1);
    assert.equal(run.signs[0].amount, 1);
    assert.equal(run.signs[0].to_address, address);
    assert.equal(run.state().vouchers[0][7], 'signed');
    assert.equal(JSON.parse(run.state().vouchers[0][8]).signature, 'synthetic-only');
    assert.equal(run.released(), 1);
  }
});

test('production funding comparison preserves arbitrary-size exact SQL decimal text', async () => {
  for (const whole of [100000000000n, 9007199254740993n, 100000000000000000000000000000000n]) {
    const run = fixture({funded: `${whole}.000000`, committed: `${whole - 1n}.000001`});
    assert.equal((await run.request()).status, 'queued');
    assert.equal(run.signs.length, 0);
  }
});

test('numeric database counter aliases refuse instead of signing an actually underfunded claim', async () => {
  const funded = '8589934592.000001', committed = '8589934591.000002';
  const exact = fixture({funded, committed});
  assert.equal((await exact.request()).status, 'queued');
  assert.equal(exact.signs.length, 0);
  assert.equal(String(Number(funded)), '8589934592.000002');
  const aliased = fixture({funded: Number(funded), committed: Number(committed)});
  await refuses(aliased.request);
  assert.equal(aliased.signs.length, 0);
  assert.deepEqual(aliased.state(), {nonce: 1, debits: [], vouchers: [], signedRows: []});
  assert.equal(aliased.trace.at(-1).sql, 'ROLLBACK');
});

test('malformed funding and committed totals fail closed without durable fake writes or signing', async () => {
  const invalid = [null, undefined, '', 'PRIVATE_BAD_AMOUNT', '-1', '-0', '01', '1.', '1e6', ' 1', '1.0000001',
    NaN, Infinity, -0, 0, 1, 1.000001, 100000000000, Number.MAX_SAFE_INTEGER + 1];
  for (const field of ['funded', 'committed']) for (const value of invalid) {
    const run = fixture({[field]: value});
    await refuses(run.request);
    assert.equal(run.signs.length, 0);
    assert.deepEqual(run.state(), {nonce: 1, debits: [], vouchers: [], signedRows: []});
    assert.equal(run.trace.at(-1).sql, 'ROLLBACK');
    assert.equal(run.released(), 1);
  }
});

test('shared reserve parser does not coerce database object values', async () => {
  let coercions = 0;
  const bad = {toString() { coercions++; return '1'; }, valueOf() { coercions++; return 1; }};
  const run = fixture({funded: bad});
  await refuses(run.request);
  assert.equal(coercions, 0);
  assert.equal(run.signs.length, 0);
});

test('missing or malformed aggregate rows never silently become zero capacity used', async () => {
  for (const sumRows of [[], [{}], [{s: undefined}], [{s: null}]]) {
    const run = fixture({funded: '100', sumRows});
    await refuses(run.request);
    assert.equal(run.signs.length, 0);
    assert.equal(run.state().vouchers.length, 0);
    assert.equal(run.trace.at(-1).sql, 'ROLLBACK');
  }
  const zero = fixture({funded: '1', committed: '0'});
  assert.equal((await zero.request()).status, 'signed');
});

test('existing exact decimals, computed net, tolls and lock order remain intact', async () => {
  for (const [funded, committed] of [['2.000000000', '1.0000000'], ['1.000001', '0.000001']]) {
    const run = fixture({funded, committed});
    assert.equal((await run.request()).status, 'signed');
  }
  const run = fixture({funded: '0.900000', taxBps: 1000});
  const result = await run.request();
  assert.equal(result.gross, 1);
  assert.equal(result.net, 0.9);
  assert.equal(result.tax, 0.1);
  assert.equal(run.signs[0].amount, 0.9);
  assert.deepEqual(run.tolls, [{dev: 0.05, buy: 0.05}]);
  assert.deepEqual(run.entries.map(row => [row.reason, row.amount]), [['withdraw:omr', -0.9], ['tax:dev', -0.05], ['tax:buyback', -0.05]]);
  assert.deepEqual(run.trace.filter(row => row.sql.endsWith('FOR UPDATE')).map(row => row.sql), [
    'SELECT * FROM account_persistent WHERE account_id=$1 FOR UPDATE', 'SELECT * FROM chain_reserve WHERE id=1 FOR UPDATE'
  ]);
  assert.equal(run.trace.filter(row => row.sql === sumSQL).length, 1);
  const fractional = fixture({funded: '2.000001', amount: 2.000001});
  const fractionResult = await fractional.request();
  assert.equal(fractionResult.net, 2.000001);
  assert.equal(fractionResult.status, 'signed');
  assert.equal(fractionResult.voucher.amount, '2.000001');
});

test('the existing daily cap still refuses before reserve signing or voucher insertion', async () => {
  const run = fixture({funded: '100', dailyCapWei: '500000000000000000'});
  await assert.rejects(run.request, error => error.code === 'daily_cap');
  assert.equal(run.signs.length, 0);
  assert.equal(run.state().vouchers.length, 0);
  assert.equal(run.trace.at(-1).sql, 'ROLLBACK');
});

test('production FIFO queue reuses exact parsing and preserves its physical backing cap', async () => {
  const queued = [{id: 'synthetic-queued', amount: '1.000000', nonce: 2, to_address: address}];
  const short = fixture({funded: '100000000000', committed: '99999999999.000001', queued});
  assert.equal((await short.drain()).signed, 0);
  assert.equal(short.signs.length, 0);
  const exact = fixture({funded: '100000000000', committed: '99999999999', queued});
  assert.equal((await exact.drain()).signed, 1);
  assert.equal(exact.signs.length, 1);
  const capped = fixture({funded: '100', queued, live: '1'});
  assert.equal((await capped.drain({maxLiveClaimWei: 1999999999999999999n})).signed, 0);
  assert.equal(capped.signs.length, 0);
  const malformed = fixture({funded: '1.0000001', queued});
  await refuses(malformed.drain);
  assert.equal(malformed.trace.at(-1).sql, 'ROLLBACK');
  const numericQueue = fixture({funded: '100', queued: [{...queued[0], amount: 1}]});
  await refuses(numericQueue.drain);
  assert.equal(numericQueue.signs.length, 0);
  const numericLive = fixture({funded: '100', queued, live: 1});
  await refuses(() => numericLive.drain({maxLiveClaimWei: 10n ** 18n}));
  assert.equal(numericLive.signs.length, 0);
});
