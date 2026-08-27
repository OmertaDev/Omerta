// THE v4 ORACLE KEEPER — the off-chain half of the ownerless OmrV4TwapOracle.
// Pure health-state coverage plus the real pg-mem journal/claim path. The EVM client is a deterministic
// viem-shaped seam: production still simulates, signs, persists raw bytes, broadcasts, and confirms in
// that exact order; the chain-4663 fork rehearsal proves the RPC implementation itself.
import assert from 'node:assert/strict';
import { keccak256 } from 'viem';
import { makeDb } from '../src/db.js';
import {
  classifyV4OracleHealth,
  runV4OracleKeeper,
  uint32Elapsed,
  v4OracleConfig,
} from '../src/v4oraclekeeper.js';

const ORACLE = `0x${'1'.repeat(40)}`;
const BOND = `0x${'2'.repeat(40)}`;
const ACCOUNT = { address: `0x${'3'.repeat(40)}` };
const PERIOD = 600;
const base = {
  oracleAddress: ORACLE,
  bondOracleAddress: ORACLE,
  bondOracleMismatch: false,
  periodS: PERIOD,
  maxWindowMult: 4,
  baselineS: 1_000,
  priceAverage: 2_000n * 10n ** 18n,
  lastUpdateS: 1_000,
  maxOracleAgeS: 1_800,
  keeperConfigured: true,
};

assert.equal(uint32Elapsed(5, 2 ** 32 - 5), 10, 'uint32 timestamp wrap preserves elapsed seconds');
assert.equal(classifyV4OracleHealth({ ...base, priceAverage: 0n, lastUpdateS: 0, chainNowS: 1_599 }).state,
  'warming', 'an unpublished partial window is WARMING');
assert.equal(classifyV4OracleHealth({ ...base, chainNowS: 1_600 }).state,
  'due', 'the exact PERIOD boundary is DUE');
assert.equal(classifyV4OracleHealth({ ...base, chainNowS: 2_201 }).state,
  'keeper_late', 'past 2× PERIOD is KEEPER_LATE with lead time');
assert.equal(classifyV4OracleHealth({ ...base, chainNowS: 3_401 }).state,
  'rebaselining', 'past PERIOD×4 is REBASELINING, never a giant average');
assert.equal(classifyV4OracleHealth({ ...base, maxOracleAgeS: 500, chainNowS: 1_501 }).state,
  'stale', 'bond maxOracleAge expiry outranks an otherwise ordinary window');
assert.equal(classifyV4OracleHealth({ ...base, chainNowS: 1_600,
  journal: { baseline_timestamp: 1_000, status: 'reverted', last_error: 'revert' } }).state,
  'tx_failed', 'a failed transaction on the current baseline is named');
assert.equal(classifyV4OracleHealth({ ...base, chainNowS: 1_600, keeperConfigured: false }).alert,
  true, 'a due window with no sender alerts instead of waiting for staleness');
assert.equal(classifyV4OracleHealth({ ...base, chainNowS: 1_200 }).state,
  'healthy', 'a nonzero recent reading inside its next window is HEALTHY');

assert.throws(() => v4OracleConfig({
  NODE_ENV: 'production', CHAIN_RPC_URL: 'http://rpc.example', CHAIN_ID: '4663',
  OMR_V4_ORACLE_ADDRESS: ORACLE,
}), /must use HTTPS/, 'a production keeper refuses plaintext RPC');
assert.throws(() => v4OracleConfig({
  CHAIN_RPC_URL: 'https://rpc.example', CHAIN_ID: '4663', OMR_V4_ORACLE_ADDRESS: ORACLE,
  V4_ORACLE_KEEPER_PK: 'not-a-key',
}, { write: true }), /32-byte private key/, 'the sender refuses a malformed key before viem sees it');
assert.throws(() => v4OracleConfig({
  CHAIN_RPC_URL: 'https://rpc.example', CHAIN_ID: '4663', OMR_V4_ORACLE_ADDRESS: ORACLE,
  V4_ORACLE_KEEPER_PK: `0x${'0'.repeat(64)}`,
}, { write: true }), /not a usable secp256k1/, 'the sender refuses an out-of-range scalar, not just bad hex');

function fakeViem(pool, state, controls = {}) {
  const sentRaw = [];
  let signed = 0;
  let simulated = 0;
  let nonce = 0;
  const publicClient = {
    getChainId: async () => controls.chainId ?? 4663,
    getCode: async () => '0x6000',
    getBlock: async () => ({ timestamp: BigInt(state.nowS) }),
    readContract: async ({ address, functionName }) => {
      if (address.toLowerCase() === BOND.toLowerCase()) {
        if (functionName === 'oracle') return ORACLE;
        if (functionName === 'maxOracleAge') return 1_800n;
      }
      if (functionName === 'PERIOD') return BigInt(PERIOD);
      if (functionName === 'MAX_WINDOW_MULT') return 4n;
      if (functionName === 'blockTimestampLast') return BigInt(state.baselineS);
      if (functionName === 'priceAverage') return state.priceAverage;
      if (functionName === 'lastUpdate') return BigInt(state.lastUpdateS);
      throw new Error(`unexpected read ${functionName}`);
    },
    simulateContract: async () => {
      simulated++;
      if (uint32Elapsed(state.nowS, state.baselineS) < PERIOD) throw new Error('PeriodNotElapsed');
    },
    waitForTransactionReceipt: async ({ hash }) => {
      if (controls.receiptPending) throw new Error('receipt timeout');
      if (controls.receiptReverts) return { status: 'reverted', blockNumber: 9n, transactionHash: hash };
      const elapsed = uint32Elapsed(state.nowS, state.baselineS);
      state.baselineS = state.nowS;
      if (elapsed > PERIOD * 4) {
        state.priceAverage = 0n;
        state.lastUpdateS = 0;
      } else {
        state.priceAverage = 2_100n * 10n ** 18n;
        state.lastUpdateS = state.nowS;
      }
      return { status: 'success', blockNumber: 9n, transactionHash: hash };
    },
  };
  const walletClient = {
    prepareTransactionRequest: async (request) => ({ ...request, nonce: BigInt(nonce++) }),
    signTransaction: async () => {
      signed++;
      return `0x${signed.toString(16).padStart(4, '0')}`;
    },
    sendRawTransaction: async ({ serializedTransaction }) => {
      const row = (await pool.query(
        "SELECT status, raw_tx, tx_hash FROM v4_oracle_keeper_attempts WHERE status='prepared' ORDER BY claimed_at DESC LIMIT 1"
      )).rows[0];
      assert(row && row.raw_tx === serializedTransaction && row.tx_hash === keccak256(serializedTransaction),
        'the signed raw transaction and hash are durable BEFORE broadcast');
      sentRaw.push(serializedTransaction);
      if (controls.failSends > 0) {
        controls.failSends--;
        throw new Error('rpc send failed');
      }
      if (controls.advanceOnSend) {
        const elapsed = uint32Elapsed(state.nowS, state.baselineS);
        state.baselineS = state.nowS;
        if (elapsed > PERIOD * 4) {
          state.priceAverage = 0n;
          state.lastUpdateS = 0;
        } else {
          state.priceAverage = 2_100n * 10n ** 18n;
          state.lastUpdateS = state.nowS;
        }
      }
      return keccak256(serializedTransaction);
    },
  };
  return {
    clients: { publicClient, walletClient, account: ACCOUNT },
    counts: { get sent() { return sentRaw.length; }, get signed() { return signed; },
      get simulated() { return simulated; }, sentRaw },
  };
}

const config = {
  rpcUrl: 'https://rpc.example/', chainId: 4663, oracleAddress: ORACLE, bondAddress: BOND,
  privateKey: null, confirmations: 1, timeoutMs: 1, leaseMs: 60_000,
};

const pool = await makeDb();
try {
  // Early is read-only: no journal row, no simulation, no signature, no transaction.
  const earlyState = { nowS: 1_599, baselineS: 1_000, priceAverage: 0n, lastUpdateS: 0 };
  const earlyViem = fakeViem(pool, earlyState);
  const early = await runV4OracleKeeper(pool, { config, clients: earlyViem.clients });
  assert.equal(early.action, 'none');
  assert.equal(early.health.state, 'warming');
  assert.equal(earlyViem.counts.sent, 0);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM v4_oracle_keeper_attempts')).rows[0].n), 0);

  // Two worker instances see the same due baseline. The DB PK/claim lets only one sign and send.
  const dueState = { nowS: 1_600, baselineS: 1_000, priceAverage: 0n, lastUpdateS: 0 };
  const dueViem = fakeViem(pool, dueState);
  const [first, second] = await Promise.all([
    runV4OracleKeeper(pool, { config, clients: dueViem.clients }),
    runV4OracleKeeper(pool, { config, clients: dueViem.clients }),
  ]);
  assert.equal(dueViem.counts.sent, 1, 'racing workers broadcast once for one baseline');
  assert.equal(dueViem.counts.signed, 1, 'racing workers sign once for one baseline');
  assert([first.action, second.action].includes('confirmed'));
  assert.equal(Number((await pool.query(
    "SELECT COUNT(*) n FROM v4_oracle_keeper_attempts WHERE baseline_timestamp=1000 AND status='confirmed'"
  )).rows[0].n), 1);

  // A send outage leaves the SAME signed bytes prepared. Recovery rebroadcasts them without signing
  // a different nonce/fee transaction for the same window.
  const retryState = { nowS: 2_200, baselineS: 1_600,
    priceAverage: 2_100n * 10n ** 18n, lastUpdateS: 1_600 };
  const controls = { failSends: 1 };
  const retryViem = fakeViem(pool, retryState, controls);
  const failed = await runV4OracleKeeper(pool, { config, clients: retryViem.clients });
  assert.equal(failed.action, 'prepared');
  assert.equal(failed.health.state, 'tx_failed');
  const raw = retryViem.counts.sentRaw[0];
  const recovered = await runV4OracleKeeper(pool, { config, clients: retryViem.clients });
  assert.equal(recovered.action, 'confirmed');
  assert.equal(retryViem.counts.signed, 1, 'recovery reuses the persisted signature');
  assert.equal(retryViem.counts.sentRaw[1], raw, 'recovery rebroadcasts byte-identical raw tx');
  assert.equal(recovered.health.state, 'healthy');

  // Receipt timeout is not failure and must never cause a new signature. The next tick watches the
  // same hash; once the receipt is visible it confirms the original transaction.
  const pendingState = { nowS: 2_800, baselineS: 2_200,
    priceAverage: 2_100n * 10n ** 18n, lastUpdateS: 2_200 };
  // Real auto-mining chains advance the oracle baseline even if the first receipt wait times out.
  // The next tick must confirm the submitted original hash, not mislabel it as superseded.
  const pendingControls = { receiptPending: true, advanceOnSend: true };
  const pendingViem = fakeViem(pool, pendingState, pendingControls);
  const pending = await runV4OracleKeeper(pool, { config, clients: pendingViem.clients });
  assert.equal(pending.action, 'pending');
  assert.equal(pending.health.state, 'tx_pending');
  pendingControls.receiptPending = false;
  const pendingConfirmed = await runV4OracleKeeper(pool, { config, clients: pendingViem.clients });
  assert.equal(pendingConfirmed.action, 'confirmed');
  assert.equal(pendingViem.counts.signed, 1, 'receipt recovery watches the original hash without re-signing');

  // A mined revert is terminal for the lease window. Do not hot-loop a fresh fee/nonce transaction
  // every 30 seconds; operator health names the failure while a later tick may retry after cooldown.
  const revertState = { nowS: 3_400, baselineS: 2_800,
    priceAverage: 2_100n * 10n ** 18n, lastUpdateS: 2_800 };
  const revertViem = fakeViem(pool, revertState, { receiptReverts: true });
  const reverted = await runV4OracleKeeper(pool, { config, clients: revertViem.clients });
  assert.equal(reverted.action, 'reverted');
  assert.equal(reverted.health.state, 'tx_failed');
  const cooled = await runV4OracleKeeper(pool, { config, clients: revertViem.clients });
  assert.equal(cooled.action, 'in_flight', 'a revert waits for the recovery lease before a new attempt');
  assert.equal(revertViem.counts.signed, 1, 'a mined revert cannot trigger an immediate re-sign loop');

  // An overlong window sends update(), but success intentionally returns to WARMING with no price.
  const longState = { nowS: 6_401, baselineS: 3_400,
    priceAverage: 2_100n * 10n ** 18n, lastUpdateS: 3_400 };
  const longViem = fakeViem(pool, longState);
  const rebaseline = await runV4OracleKeeper(pool, { config, clients: longViem.clients });
  assert.equal(rebaseline.action, 'confirmed');
  assert.equal(rebaseline.health.state, 'warming');
  assert.equal(rebaseline.health.priceAverage, '0');

  const wrongState = { nowS: 7_200, baselineS: 6_401, priceAverage: 0n, lastUpdateS: 0 };
  const wrongViem = fakeViem(pool, wrongState, { chainId: 1 });
  const wrong = await runV4OracleKeeper(pool, { config, clients: wrongViem.clients });
  assert.equal(wrong.health.state, 'misconfigured', 'wrong-chain RPC refuses before simulation/sign/send');
  assert.equal(wrongViem.counts.sent, 0);
} finally {
  await pool.end();
}

console.log('✅ v4 oracle keeper passed — health states, uint32 wrap, early no-op, atomic race, persist-before-send, byte-identical retry, pending/revert recovery, overlong rebaseline, and wrong-chain refusal');
