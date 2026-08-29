// THE v4 BOND-ORACLE KEEPER — close complete OmrV4TwapOracle windows and say plainly when
// that automation is unhealthy. The hook owns the complete tick path; this worker only chooses
// when a bounded window is published. Missing a poll therefore makes the feed stale, never spot.
//
// Safety posture:
//   • read-only health needs no key and resolves the bond's oracle independently;
//   • writes require an exact chain, contract code, valid dedicated key, and simulation;
//   • one DB row per (oracle, baseline timestamp) claims a window across deploy overlaps;
//   • the signed raw transaction is persisted before broadcast and is what retries rebroadcast;
//   • receipt success, revert, timeout and replacement remain distinct machine states.
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  encodeFunctionData,
  getAddress,
  http,
  isAddress,
  keccak256,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { isHardened } from './preflight.js';

export const V4_ORACLE_LATE_MULT = 2;
export const V4_ORACLE_MAX_WINDOW_MULT = 4;
const UINT32_MOD = 2 ** 32;
const ZERO_ADDRESS = `0x${'0'.repeat(40)}`;
const DEFAULT_LEASE_MS = 10 * 60 * 1000;
const DEFAULT_TX_TIMEOUT_MS = 20 * 1000;
const IN_FLIGHT_WINDOWS = new Set(); // same-process guard; the DB primary key is the cross-process guard

const ORACLE_ABI = [
  { type: 'function', name: 'PERIOD', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
  { type: 'function', name: 'MAX_WINDOW_MULT', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
  { type: 'function', name: 'blockTimestampLast', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint32' }] },
  { type: 'function', name: 'priceAverage', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'lastUpdate', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'update', stateMutability: 'nonpayable', inputs: [], outputs: [] },
];

const BOND_ABI = [
  { type: 'function', name: 'oracle', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'maxOracleAge', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
];

const lower = (value) => String(value || '').toLowerCase();
const zeroAddress = (value) => !value || lower(value) === ZERO_ADDRESS;
const finitePositiveInt = (value) => Number.isSafeInteger(Number(value)) && Number(value) > 0;
const errorMessage = (error) => String(error?.shortMessage || error?.message || error || 'unknown error').slice(0, 1000);

// Keep literal reads visible to test/preflight.js's deployment-perimeter drift detector while still
// accepting an injected env object in tests and ceremony tooling.
function runtimeEnv() {
  return {
    ...process.env,
    OMR_V4_ORACLE_ADDRESS: process.env.OMR_V4_ORACLE_ADDRESS,
    V4_ORACLE_KEEPER_PK: process.env.V4_ORACLE_KEEPER_PK,
    V4_ORACLE_CONFIRMATIONS: process.env.V4_ORACLE_CONFIRMATIONS,
    V4_ORACLE_TX_TIMEOUT_MS: process.env.V4_ORACLE_TX_TIMEOUT_MS,
    V4_ORACLE_LEASE_MS: process.env.V4_ORACLE_LEASE_MS,
  };
}

export function uint32Elapsed(nowS, thenS) {
  return ((Number(nowS) >>> 0) - (Number(thenS) >>> 0) + UINT32_MOD) % UINT32_MOD;
}

function validRpcUrl(value, env) {
  let parsed;
  try { parsed = new URL(value); } catch { throw new Error('v4 oracle keeper: CHAIN_RPC_URL is not a valid URL'); }
  const loopback = parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost' || parsed.hostname === '::1';
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && loopback && !isHardened(env))) {
    throw new Error('v4 oracle keeper: CHAIN_RPC_URL must use HTTPS (HTTP is allowed only for a local non-production node)');
  }
  return parsed.toString();
}

function optionalAddress(name, value) {
  if (!value) return null;
  if (!isAddress(value, { strict: true })) throw new Error(`v4 oracle keeper: ${name} is not a valid address`);
  return getAddress(value);
}

export function v4OracleConfig(env = runtimeEnv(), { write = false } = {}) {
  const rpcValue = env.CHAIN_RPC_URL;
  const oracleValue = env.OMR_V4_ORACLE_ADDRESS;
  const bondValue = env.OMERTA_BOND_ADDRESS;
  if (!rpcValue || (!oracleValue && !bondValue)) return null;

  const rpcUrl = validRpcUrl(rpcValue, env);
  const chainId = Number(env.CHAIN_ID);
  if (!finitePositiveInt(chainId)) throw new Error('v4 oracle keeper: CHAIN_ID must be a positive integer');
  const oracleAddress = optionalAddress('OMR_V4_ORACLE_ADDRESS', oracleValue);
  const bondAddress = optionalAddress('OMERTA_BOND_ADDRESS', bondValue);

  let privateKey = null;
  if (write) {
    privateKey = env.V4_ORACLE_KEEPER_PK;
    if (!/^0x[a-fA-F0-9]{64}$/.test(privateKey || '')) {
      throw new Error('v4 oracle keeper: V4_ORACLE_KEEPER_PK must be a 0x-prefixed 32-byte private key');
    }
    try { privateKeyToAccount(privateKey); }
    catch { throw new Error('v4 oracle keeper: V4_ORACLE_KEEPER_PK is not a usable secp256k1 private key'); }
  }

  const confirmations = Number(env.V4_ORACLE_CONFIRMATIONS || 1);
  const timeoutMs = Number(env.V4_ORACLE_TX_TIMEOUT_MS || DEFAULT_TX_TIMEOUT_MS);
  const leaseMs = Number(env.V4_ORACLE_LEASE_MS || DEFAULT_LEASE_MS);
  if (!finitePositiveInt(confirmations) || !finitePositiveInt(timeoutMs) || !finitePositiveInt(leaseMs)) {
    throw new Error('v4 oracle keeper: confirmation, timeout, and lease settings must be positive integers');
  }
  return { rpcUrl, chainId, oracleAddress, bondAddress, privateKey, confirmations, timeoutMs, leaseMs };
}

export function v4OracleKeeperReady(env = runtimeEnv()) {
  try { return !!v4OracleConfig(env, { write: true }); } catch { return false; }
}

export function v4OracleWatchReady(env = runtimeEnv()) {
  try { return !!v4OracleConfig(env); } catch { return true; } // invalid configured input must surface as MISCONFIGURED
}

export function makeV4OracleClients(config) {
  const chain = defineChain({
    id: config.chainId,
    name: 'Omerta chain',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: { default: { http: [config.rpcUrl] } },
  });
  const transport = http(config.rpcUrl, { retryCount: 3, retryDelay: 500, timeout: 10_000 });
  const publicClient = createPublicClient({ chain, transport, cacheTime: 0 });
  if (!config.privateKey) return { publicClient, walletClient: null, account: null };
  const account = privateKeyToAccount(config.privateKey);
  const walletClient = createWalletClient({ account, chain, transport });
  return { publicClient, walletClient, account };
}

async function contractCodeRequired(client, address, label) {
  const code = await client.getCode({ address });
  if (!code || code === '0x') throw new Error(`v4 oracle keeper: no contract code at ${label}`);
}

export async function readV4OracleSnapshot(config, publicClient) {
  const rpcChainId = Number(await publicClient.getChainId());
  if (rpcChainId !== config.chainId) {
    throw new Error(`v4 oracle keeper: RPC chain ${rpcChainId} does not match CHAIN_ID ${config.chainId}`);
  }

  let bondOracleAddress = null;
  let maxOracleAgeS = 0;
  if (config.bondAddress) {
    await contractCodeRequired(publicClient, config.bondAddress, 'OMERTA_BOND_ADDRESS');
    bondOracleAddress = await publicClient.readContract({
      address: config.bondAddress, abi: BOND_ABI, functionName: 'oracle',
    });
    if (zeroAddress(bondOracleAddress)) bondOracleAddress = null;
  }

  const oracleAddress = config.oracleAddress || bondOracleAddress;
  if (!oracleAddress) return { state: 'unset', bondOracleAddress: null };
  await contractCodeRequired(publicClient, oracleAddress, 'OMR_V4_ORACLE_ADDRESS');
  const bondOracleMismatch = !!(config.oracleAddress && bondOracleAddress
    && lower(config.oracleAddress) !== lower(bondOracleAddress));
  if (config.bondAddress && bondOracleAddress && !bondOracleMismatch) {
    maxOracleAgeS = Number(await publicClient.readContract({
      address: config.bondAddress, abi: BOND_ABI, functionName: 'maxOracleAge',
    }));
  }

  const [periodS, maxWindowMult, baselineS, priceAverage, lastUpdateS, block] = await Promise.all([
    publicClient.readContract({ address: oracleAddress, abi: ORACLE_ABI, functionName: 'PERIOD' }),
    publicClient.readContract({ address: oracleAddress, abi: ORACLE_ABI, functionName: 'MAX_WINDOW_MULT' }),
    publicClient.readContract({ address: oracleAddress, abi: ORACLE_ABI, functionName: 'blockTimestampLast' }),
    publicClient.readContract({ address: oracleAddress, abi: ORACLE_ABI, functionName: 'priceAverage' }),
    publicClient.readContract({ address: oracleAddress, abi: ORACLE_ABI, functionName: 'lastUpdate' }),
    publicClient.getBlock({ blockTag: 'latest' }),
  ]);
  return {
    oracleAddress: getAddress(oracleAddress),
    bondOracleAddress: bondOracleAddress ? getAddress(bondOracleAddress) : null,
    bondOracleMismatch,
    periodS: Number(periodS),
    maxWindowMult: Number(maxWindowMult),
    baselineS: Number(baselineS),
    priceAverage: BigInt(priceAverage),
    lastUpdateS: Number(lastUpdateS),
    maxOracleAgeS,
    chainNowS: Number(block.timestamp),
  };
}

export function classifyV4OracleHealth(snapshot = {}) {
  if (snapshot.state === 'dormant') return { state: 'dormant', alert: false };
  if (snapshot.state === 'rpc_down') return { ...snapshot, state: 'rpc_down', alert: true };
  if (snapshot.state === 'misconfigured') return { ...snapshot, state: 'misconfigured', alert: true };
  if (snapshot.state === 'unset' || !snapshot.oracleAddress) {
    return { ...snapshot, state: 'unset', alert: true, note: 'no v4 oracle is configured directly or on OmertaBond' };
  }
  if (snapshot.bondOracleMismatch) {
    return { ...snapshot, state: 'misconfigured', alert: true,
      note: 'OMR_V4_ORACLE_ADDRESS does not match OmertaBond.oracle()' };
  }

  const periodS = Number(snapshot.periodS);
  const maxWindowMult = Number(snapshot.maxWindowMult || V4_ORACLE_MAX_WINDOW_MULT);
  if (!finitePositiveInt(periodS) || !finitePositiveInt(maxWindowMult)) {
    return { ...snapshot, state: 'misconfigured', alert: true, note: 'oracle period/window constants are invalid' };
  }
  const elapsedS = uint32Elapsed(snapshot.chainNowS, snapshot.baselineS);
  const maxWindowS = periodS * maxWindowMult;
  const lateAfterS = periodS * V4_ORACLE_LATE_MULT;
  const lastUpdateS = Number(snapshot.lastUpdateS || 0);
  const ageS = lastUpdateS ? Math.max(0, Number(snapshot.chainNowS) - lastUpdateS) : null;
  const priceAverage = BigInt(snapshot.priceAverage || 0);
  const updateEligible = elapsedS >= periodS;
  const base = {
    ...snapshot,
    priceAverage: priceAverage.toString(),
    elapsedS,
    dueInS: Math.max(0, periodS - elapsedS),
    lateAfterS,
    maxWindowS,
    ageS,
    updateEligible,
  };

  const journal = snapshot.journal && Number(snapshot.journal.baseline_timestamp) === Number(snapshot.baselineS)
    ? snapshot.journal : null;
  if (journal && (journal.status === 'prepared' || journal.status === 'submitted')) {
    if (journal.last_error) return { ...base, state: 'tx_failed', alert: true,
      note: `the signed update transaction could not be submitted or confirmed: ${journal.last_error}` };
    return { ...base, state: 'tx_pending', alert: elapsedS > lateAfterS,
      note: `update transaction ${journal.tx_hash || 'prepared'} is awaiting confirmation` };
  }

  if (elapsedS > maxWindowS) {
    return { ...base, state: 'rebaselining', alert: true,
      note: `the open window is ${elapsedS}s (> ${maxWindowS}s); update() must discard it before one honest window can warm` };
  }
  if (lastUpdateS && snapshot.maxOracleAgeS > 0 && ageS > Number(snapshot.maxOracleAgeS)) {
    return { ...base, state: 'stale', alert: true,
      note: `the published price is ${ageS}s old (> bond maxOracleAge ${snapshot.maxOracleAgeS}s)` };
  }
  if (updateEligible) {
    if (journal && ['failed', 'reverted', 'replaced'].includes(journal.status)) {
      return { ...base, state: 'tx_failed', alert: true,
        note: journal.last_error || `the last update transaction ended ${journal.status}` };
    }
    if (elapsedS > lateAfterS) {
      return { ...base, state: 'keeper_late', alert: true,
        note: `the window has been eligible for ${elapsedS - periodS}s and is approaching forced rebaseline` };
    }
    return { ...base, state: 'due', alert: !snapshot.keeperConfigured,
      note: snapshot.keeperConfigured ? 'a complete window is ready for permissionless update()'
        : 'a complete window is ready, but V4_ORACLE_KEEPER_PK is not configured' };
  }
  if (priceAverage === 0n || !lastUpdateS) {
    return { ...base, state: 'warming', alert: false,
      note: `the oracle needs ${Math.max(0, periodS - elapsedS)}s more chain time before its first usable price` };
  }
  return { ...base, state: 'healthy', alert: false };
}

async function journalForBaseline(pool, oracleAddress, baselineS) {
  if (!pool) return null;
  return (await pool.query(
    `SELECT oracle_address, baseline_timestamp, status, tx_hash, nonce, claimed_at, sent_at,
            confirmed_at, last_error
       FROM v4_oracle_keeper_attempts
      WHERE lower(oracle_address)=lower($1) AND baseline_timestamp=$2`,
    [oracleAddress, baselineS])).rows[0] || null;
}

async function claimBaseline(pool, snapshot, leaseMs, nowMs) {
  const cutoff = new Date(nowMs - leaseMs);
  // Fast-path the cooldown before the atomic INSERT. PostgreSQL's conflict predicate below is the
  // cross-process authority; this read also makes the rule explicit and keeps pg-mem's incomplete
  // ON CONFLICT ... WHERE emulation from hot-looping terminal attempts in tests.
  const existing = await journalForBaseline(pool, snapshot.oracleAddress, snapshot.baselineS);
  if (existing) {
    const claimedAt = new Date(existing.claimed_at).getTime();
    const cooled = Number.isFinite(claimedAt) && claimedAt < cutoff.getTime();
    if (!cooled || ['prepared', 'submitted', 'confirmed'].includes(existing.status)) return null;
  }
  return (await pool.query(
    `INSERT INTO v4_oracle_keeper_attempts
       (oracle_address, baseline_timestamp, status, claimed_at, last_error)
     VALUES ($1,$2,'claimed',now(),NULL)
     ON CONFLICT (oracle_address, baseline_timestamp) DO UPDATE
       SET status='claimed', claimed_at=now(), tx_hash=NULL, raw_tx=NULL, nonce=NULL,
           sent_at=NULL, confirmed_at=NULL, last_error=NULL
       WHERE (v4_oracle_keeper_attempts.status IN ('failed','reverted','superseded','replaced')
              AND v4_oracle_keeper_attempts.claimed_at < $3)
          OR (v4_oracle_keeper_attempts.status='claimed' AND v4_oracle_keeper_attempts.claimed_at < $3)
     RETURNING *`, [lower(snapshot.oracleAddress), snapshot.baselineS, cutoff])).rows[0] || null;
}

async function latestOpenJournal(pool, oracleAddress) {
  return (await pool.query(
    `SELECT * FROM v4_oracle_keeper_attempts
      WHERE lower(oracle_address)=lower($1) AND status IN ('prepared','submitted')
      ORDER BY claimed_at DESC LIMIT 1`, [oracleAddress])).rows[0] || null;
}

async function markJournal(pool, row, fields) {
  const keys = Object.keys(fields);
  if (!keys.length) return;
  const values = keys.map((key) => fields[key]);
  await pool.query(
    `UPDATE v4_oracle_keeper_attempts SET ${keys.map((key, i) => `${key}=$${i + 3}`).join(', ')}
      WHERE lower(oracle_address)=lower($1) AND baseline_timestamp=$2`,
    [row.oracle_address, row.baseline_timestamp, ...values]);
}

async function waitForReceipt(pool, row, config, publicClient) {
  let replacementHash = null;
  try {
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: row.tx_hash,
      confirmations: config.confirmations,
      timeout: config.timeoutMs,
      onReplaced: (replacement) => { replacementHash = replacement?.transaction?.hash || replacement?.transactionReceipt?.transactionHash || null; },
    });
    if (replacementHash && lower(replacementHash) !== lower(row.tx_hash)) {
      await markJournal(pool, row, { tx_hash: replacementHash });
      row.tx_hash = replacementHash;
    }
    if (receipt.status !== 'success') {
      await markJournal(pool, row, { status: 'reverted', confirmed_at: new Date(), last_error: 'update transaction reverted' });
      return { state: 'reverted', txHash: row.tx_hash };
    }
    await markJournal(pool, row, { status: 'confirmed', confirmed_at: new Date(), last_error: null });
    return { state: 'confirmed', txHash: row.tx_hash, blockNumber: receipt.blockNumber?.toString?.() || null };
  } catch (error) {
    const message = errorMessage(error);
    if (/timeout|not found|receipt/i.test(message)) return { state: 'pending', txHash: row.tx_hash };
    await markJournal(pool, row, { last_error: message });
    return { state: 'pending', txHash: row.tx_hash, error: message };
  }
}

async function submitPrepared(pool, row, config, clients) {
  if (row.status === 'prepared') {
    try {
      const sentHash = await clients.walletClient.sendRawTransaction({ serializedTransaction: row.raw_tx });
      if (sentHash && lower(sentHash) !== lower(row.tx_hash)) {
        throw new Error(`RPC returned ${sentHash} for signed transaction ${row.tx_hash}`);
      }
      row.tx_hash = sentHash || row.tx_hash;
      row.status = 'submitted';
      await markJournal(pool, row, { status: 'submitted', tx_hash: row.tx_hash, sent_at: new Date(), last_error: null });
    } catch (error) {
      const message = errorMessage(error);
      if (!/already known|nonce too low|known transaction/i.test(message)) {
        await markJournal(pool, row, { last_error: message });
        return { state: 'prepared', txHash: row.tx_hash, error: message };
      }
      row.status = 'submitted';
      await markJournal(pool, row, { status: 'submitted', sent_at: new Date(), last_error: null });
    }
  }
  return waitForReceipt(pool, row, config, clients.publicClient);
}

export async function v4OracleHealth(pool, opts = {}) {
  let config;
  try { config = opts.config || v4OracleConfig(opts.env || process.env); }
  catch (error) { return classifyV4OracleHealth({ state: 'misconfigured', note: errorMessage(error) }); }
  if (!config) return classifyV4OracleHealth({ state: 'dormant' });
  try {
    const clients = opts.clients || makeV4OracleClients(config);
    const snapshot = await readV4OracleSnapshot(config, clients.publicClient);
    if (snapshot.state === 'unset') return classifyV4OracleHealth(snapshot);
    snapshot.keeperConfigured = opts.keeperConfigured ?? v4OracleKeeperReady(opts.env || process.env);
    snapshot.journal = await journalForBaseline(pool, snapshot.oracleAddress, snapshot.baselineS);
    return classifyV4OracleHealth(snapshot);
  } catch (error) {
    const message = errorMessage(error);
    const state = /does not match CHAIN_ID|valid address|no contract code/i.test(message) ? 'misconfigured' : 'rpc_down';
    return classifyV4OracleHealth({ state, note: message });
  }
}

export async function runV4OracleKeeper(pool, opts = {}) {
  let config;
  try { config = opts.config || v4OracleConfig(opts.env || process.env, { write: !opts.clients }); }
  catch (error) { return { action: 'none', health: classifyV4OracleHealth({ state: 'misconfigured', note: errorMessage(error) }) }; }
  if (!config) return { action: 'none', health: classifyV4OracleHealth({ state: 'dormant' }) };
  const clients = opts.clients || makeV4OracleClients(config);
  if (!clients.walletClient || !clients.account) {
    return { action: 'none', health: classifyV4OracleHealth({ state: 'misconfigured',
      note: 'v4 oracle keeper has no wallet client/account' }) };
  }

  try {
    let snapshot = await readV4OracleSnapshot(config, clients.publicClient);
    if (snapshot.state === 'unset') return { action: 'none', health: classifyV4OracleHealth(snapshot) };
    const open = await latestOpenJournal(pool, snapshot.oracleAddress);
    if (open) {
      if (Number(open.baseline_timestamp) !== Number(snapshot.baselineS)) {
        // A receipt timeout does not imply the transaction was unmined. On auto-mining chains the
        // update can advance the baseline before the RPC exposes its receipt. Reconcile an already-
        // submitted hash once before calling it superseded; otherwise the durable journal would
        // mislabel our own successful transaction and lose the receipt evidence. A merely prepared
        // transaction is never rebroadcast after another actor advanced the baseline.
        if (open.status === 'submitted') {
          const receipt = await waitForReceipt(pool, open, config, clients.publicClient);
          if (receipt.state === 'confirmed') {
            snapshot = await readV4OracleSnapshot(config, clients.publicClient);
            return { action: 'confirmed', txHash: receipt.txHash, health: classifyV4OracleHealth({
              ...snapshot, keeperConfigured: true,
              journal: await journalForBaseline(pool, snapshot.oracleAddress, snapshot.baselineS),
            }) };
          }
        }
        await markJournal(pool, open, { status: 'superseded', last_error: null });
      } else {
        const receipt = await submitPrepared(pool, open, config, clients);
        if (receipt.state !== 'confirmed') {
          const journal = await journalForBaseline(pool, snapshot.oracleAddress, snapshot.baselineS);
          return { action: receipt.state, txHash: receipt.txHash, health: classifyV4OracleHealth({
            ...snapshot, keeperConfigured: true, journal,
          }) };
        }
        snapshot = await readV4OracleSnapshot(config, clients.publicClient);
        return { action: 'confirmed', txHash: receipt.txHash, health: classifyV4OracleHealth({
          ...snapshot, keeperConfigured: true,
          journal: await journalForBaseline(pool, snapshot.oracleAddress, snapshot.baselineS),
        }) };
      }
    }

    const health = classifyV4OracleHealth({ ...snapshot, keeperConfigured: true,
      journal: await journalForBaseline(pool, snapshot.oracleAddress, snapshot.baselineS) });
    if (!health.updateEligible) return { action: 'none', health };

    const windowKey = `${lower(snapshot.oracleAddress)}:${snapshot.baselineS}`;
    if (IN_FLIGHT_WINDOWS.has(windowKey)) return { action: 'in_flight', health };
    IN_FLIGHT_WINDOWS.add(windowKey);
    try {
      const claimed = await claimBaseline(pool, snapshot, config.leaseMs, opts.nowMs ?? Date.now());
      if (!claimed) return { action: 'in_flight', health };

      try {
        await clients.publicClient.simulateContract({
          address: snapshot.oracleAddress,
          abi: ORACLE_ABI,
          functionName: 'update',
          account: clients.account,
        });
      } catch (error) {
        const next = await readV4OracleSnapshot(config, clients.publicClient).catch(() => null);
        const superseded = next && next.baselineS !== snapshot.baselineS;
        await markJournal(pool, claimed, { status: superseded ? 'superseded' : 'failed',
          last_error: superseded ? null : errorMessage(error) });
        return { action: superseded ? 'superseded' : 'failed', health: next
          ? classifyV4OracleHealth({ ...next, keeperConfigured: true })
          : classifyV4OracleHealth({ ...snapshot, keeperConfigured: true,
            journal: { ...claimed, status: 'failed', last_error: errorMessage(error) } }) };
      }

      const data = encodeFunctionData({ abi: ORACLE_ABI, functionName: 'update' });
      const request = await clients.walletClient.prepareTransactionRequest({
        account: clients.account,
        to: snapshot.oracleAddress,
        data,
        value: 0n,
      });
      const rawTx = await clients.walletClient.signTransaction(request);
      const txHash = keccak256(rawTx);
      claimed.status = 'prepared';
      claimed.raw_tx = rawTx;
      claimed.tx_hash = txHash;
      await markJournal(pool, claimed, { status: 'prepared', raw_tx: rawTx, tx_hash: txHash,
        nonce: request.nonce == null ? null : request.nonce.toString(), last_error: null });

      const receipt = await submitPrepared(pool, claimed, config, clients);
      const next = receipt.state === 'confirmed'
        ? await readV4OracleSnapshot(config, clients.publicClient)
        : snapshot;
      const journal = await journalForBaseline(pool, next.oracleAddress, next.baselineS);
      return { action: receipt.state, txHash: receipt.txHash || txHash,
        health: classifyV4OracleHealth({ ...next, keeperConfigured: true, journal }) };
    } finally {
      IN_FLIGHT_WINDOWS.delete(windowKey);
    }
  } catch (error) {
    const message = errorMessage(error);
    const state = /does not match CHAIN_ID|valid address|no contract code/i.test(message) ? 'misconfigured' : 'rpc_down';
    return { action: 'failed', health: classifyV4OracleHealth({ state, note: message }) };
  }
}
