// Durable transaction transport for the dedicated liquidity keeper wallet. Every job sharing
// that wallet shares one PostgreSQL lock and one nonce domain. Raw signed bytes are persisted
// before broadcasting; a retry never invents a replacement transaction or another nonce.
import { createHash } from 'node:crypto';
import {
  getAddress, isAddress, keccak256, parseTransaction, recoverTransactionAddress, stringToHex,
} from 'viem';

const LOCAL_WALLETS = new Set();
const TERMINAL = new Set(['settled', 'reverted']);
const HASH = /^0x[0-9a-f]{64}$/i;
const UINT256_MAX = (1n << 256n) - 1n;
const json = (value) => JSON.stringify(value, (_key, item) => typeof item === 'bigint' ? item.toString() : item);
const lower = (value) => String(value || '').toLowerCase();
const digest = (value) => keccak256(stringToHex(json(value)));
const fail = (code, message) => Object.assign(new Error(message), { keeperCode: code });
const codeOf = (error) => error?.keeperCode || 'rpc_or_storage_unavailable';
const positiveInt = (value, name) => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0) throw fail('invalid_policy', `${name} must be a positive safe integer`);
  return n;
};
const uint = (value, name, { zero = false } = {}) => {
  if (!/^(0|[1-9][0-9]*)$/.test(String(value ?? ''))) throw fail('invalid_policy', `${name} must be an integer`);
  const n = BigInt(value);
  if ((!zero && n === 0n) || n > UINT256_MAX) throw fail('invalid_policy', `${name} is out of range`);
  return n;
};
const address = (value, name) => {
  if (!isAddress(value, { strict: true }) || /^0x0{40}$/i.test(value)) throw fail('invalid_policy', `${name} must be a nonzero address`);
  return getAddress(value).toLowerCase();
};

function publicRow(row) {
  if (!row) return null;
  return {
    id: row.id, chainId: Number(row.chain_id), wallet: row.wallet, target: row.target,
    targetCodeHash: row.target_code_hash, jobKey: row.job_key, state: row.status,
    txHash: row.tx_hash, nonce: Number(row.nonce), request: JSON.parse(row.request_json),
    budgets: JSON.parse(row.budget_json), metadata: JSON.parse(row.metadata_json),
    confirmations: Number(row.confirmations), blockNumber: row.block_number == null ? null : String(row.block_number),
    blockHash: row.block_hash, accountingRequired: row.accounting_required,
    receipt: row.receipt_json ? JSON.parse(row.receipt_json) : null,
    lastError: row.last_error, broadcastAttempts: Number(row.broadcast_attempts),
  };
}

function result(row, reason = null) {
  return { ...publicRow(row), reason,
    alert: ['ambiguous', 'nonce_conflict', 'reorged', 'confirmed'].includes(row.status) || !!reason };
}

async function update(q, row, values) {
  // This private patch path changes only journal progress, never signed authority. Every
  // column is explicitly admitted here and every value is a bound parameter.
  const allowedColumns = new Set(['status','broadcast_attempts','last_broadcast_at','last_error',
    'block_number','block_hash','receipt_json']);
  const entries = Object.entries(values);
  if (!entries.length || entries.some(([key]) => !allowedColumns.has(key))) throw fail('journal_integrity', 'Unapproved journal update column');
  const columns = entries.map(([key], i) => key + '=$' + (i + 2)).join(',');
  await q.query(`UPDATE keeper_transactions SET ${columns}, updated_at=now() WHERE id=$1`,
    [row.id, ...entries.map(([, value]) => value)]);
  Object.assign(row, values);
}

async function withWalletLock(pool, chainId, wallet, run) {
  const key = `${chainId}:${wallet}`;
  if (LOCAL_WALLETS.has(key)) return { state: 'locked', alert: false, wallet, chainId };
  LOCAL_WALLETS.add(key);
  let connection, locked = false;
  const lockId = createHash('sha256').update(`omerta:liquidity-keeper:${key}`).digest().readInt32BE(0);
  try {
    connection = await pool.connect();
    if (process.env.DATABASE_URL) {
      const row = (await connection.query('SELECT pg_try_advisory_lock($1,$2) AS acquired', [0x4b545831, lockId])).rows[0];
      if (!row?.acquired) return { state: 'locked', alert: false, wallet, chainId };
      locked = true;
    } else if (process.env.NODE_ENV === 'production') {
      throw fail('postgres_required', 'Production keeper transport requires PostgreSQL');
    }
    return await run(connection);
  } finally {
    if (locked) await connection.query('SELECT pg_advisory_unlock($1,$2)', [0x4b545831, lockId]).catch(() => {});
    connection?.release();
    LOCAL_WALLETS.delete(key);
  }
}

function validateDomain(opts) {
  const chainId = positiveInt(opts.chainId, 'chainId');
  const wallet = address(opts.wallet, 'wallet');
  const clients = opts.clients;
  if (!clients?.publicClient || !clients?.walletClient || !clients?.account) throw fail('invalid_policy', 'Keeper clients and signer are required');
  if (address(clients.account.address, 'signer') !== wallet) throw fail('signer_mismatch', 'Configured keeper wallet differs from signer');
  return { chainId, wallet, clients };
}

async function validateClient(domain) {
  if (Number(await domain.clients.publicClient.getChainId()) !== domain.chainId) throw fail('wrong_chain', 'RPC does not match the keeper chain');
}

async function verifyTarget(pub, target, expectedHash) {
  if (!HASH.test(expectedHash || '')) throw fail('invalid_policy', 'A pinned target runtime hash is required');
  const code = await pub.getCode({ address: getAddress(target) }) || '0x';
  if (lower(keccak256(code)) !== lower(expectedHash)) throw fail('target_code_mismatch', 'Keeper target runtime differs from the approved deployment');
}

async function validateSigned(row) {
  if (!/^0x[0-9a-f]+$/i.test(row.raw_tx || '') || lower(keccak256(row.raw_tx)) !== lower(row.tx_hash)) {
    throw fail('journal_integrity', 'Stored signed transaction hash is inconsistent');
  }
  let tx, sender;
  try { tx = parseTransaction(row.raw_tx); sender = await recoverTransactionAddress({ serializedTransaction: row.raw_tx }); }
  catch { throw fail('journal_integrity', 'Stored signed transaction cannot be verified'); }
  const request = JSON.parse(row.request_json);
  if (lower(sender) !== row.wallet || Number(tx.chainId) !== Number(row.chain_id)
    || lower(tx.to) !== row.target || Number(tx.nonce) !== Number(row.nonce)
    || lower(tx.data || '0x') !== lower(request.data) || BigInt(tx.value || 0) !== BigInt(request.value)
    || BigInt(tx.gas || 0) !== BigInt(row.gas_limit)
    || BigInt(tx.maxFeePerGas || 0) !== BigInt(row.max_fee_per_gas)
    || BigInt(tx.maxPriorityFeePerGas || 0) !== BigInt(row.priority_fee_per_gas)
    || tx.type !== 'eip1559') throw fail('journal_integrity', 'Stored signed transaction changed its authorized request');
}

async function receiptFor(pub, hash) {
  try { return await pub.getTransactionReceipt({ hash }); }
  catch (error) {
    if (error?.name === 'TransactionReceiptNotFoundError') return null;
    throw error;
  }
}

async function canonicalReceipt(pub, row, receipt) {
  if (lower(receipt.transactionHash) !== lower(row.tx_hash) || !HASH.test(receipt.blockHash || '')
    || receipt.blockNumber == null || !['success', 'reverted'].includes(receipt.status)
    || lower(receipt.from) !== row.wallet || lower(receipt.to) !== row.target) {
    throw fail('receipt_mismatch', 'Receipt does not identify the signed keeper transaction');
  }
  const [block, head] = await Promise.all([
    pub.getBlock({ blockNumber: BigInt(receipt.blockNumber) }), pub.getBlockNumber(),
  ]);
  if (lower(block.hash) !== lower(receipt.blockHash)) return { canonical: false, final: false };
  if (block.timestamp == null || BigInt(block.timestamp) <= 0n) throw fail('receipt_timestamp_unavailable', 'Canonical block timestamp is unavailable');
  // Historical financial prints retain their actual chain time after a delayed reconciliation.
  // Never stamp a fill with the keeper's restart/indexing wall clock.
  receipt.blockTimestamp = BigInt(block.timestamp);
  return { canonical: true, final: BigInt(head) >= BigInt(receipt.blockNumber) + BigInt(row.confirmations) - 1n };
}

async function settle(q, row, receipt, onConfirmed) {
  if (row.accounting_required && typeof onConfirmed !== 'function') return result(row, 'accounting_handler_required');
  await q.query('BEGIN');
  try {
    const fresh = (await q.query('SELECT * FROM keeper_transactions WHERE id=$1 FOR UPDATE', [row.id])).rows[0];
    if (fresh.status === 'settled') { await q.query('COMMIT'); Object.assign(row, fresh); return result(row); }
    if (fresh.status !== 'confirmed') throw fail('journal_integrity', 'Only a confirmed transaction can be settled');
    // The handler may perform only database work. Its writes and this marker commit together;
    // a crash/rejection rolls both back and leaves the whole wallet blocked until reconciliation.
    const acknowledgement = onConfirmed ? await onConfirmed(q, publicRow(fresh), receipt) : null;
    if (fresh.accounting_required && acknowledgement?.settled !== true) {
      throw fail('accounting_handler_required', 'The typed settlement handler did not acknowledge this action');
    }
    await q.query("UPDATE keeper_transactions SET status='settled', accounted_at=now(), last_error=NULL, updated_at=now() WHERE id=$1", [row.id]);
    await q.query('COMMIT');
    row.status = 'settled'; row.last_error = null;
    return result(row);
  } catch (error) {
    await q.query('ROLLBACK').catch(() => {});
    await update(q, row, { last_error: 'accounting_failed' });
    return result(row, 'accounting_failed');
  }
}

async function acceptReceipt(q, row, receipt, pub, opts) {
  const check = await canonicalReceipt(pub, row, receipt);
  if (!check.canonical) {
    await update(q, row, { status: 'reorged', last_error: 'receipt_not_canonical' });
    return result(row, 'receipt_not_canonical');
  }
  if (row.status === 'settled' || row.status === 'reverted') {
    if (lower(row.block_hash) !== lower(receipt.blockHash) || !check.final) {
      await update(q, row, { status: 'reorged', last_error: 'settled_receipt_changed' });
      return result(row, 'settled_receipt_changed');
    }
    return result(row);
  }
  // A detected post-settlement reorg requires review; no automatic accounting reversal or replay.
  if (row.accounted_at) return result(row, 'settled_reorg_requires_review');
  const values = { receipt_json: json(receipt), block_number: String(receipt.blockNumber), block_hash: lower(receipt.blockHash),
    status: check.final ? (receipt.status === 'success' ? 'confirmed' : 'reverted') : 'mined', last_error: null };
  await update(q, row, values);
  if (!check.final) return result(row, null);
  if (receipt.status === 'reverted') return result(row, 'transaction_reverted');
  // Native Hook logs do not name their paid recipients. They require historical recipient
  // verification before their ETH can become revenue. This network work runs before BEGIN;
  // failed or unavailable proofs leave the mined transaction durable and block the wallet.
  const metadata = JSON.parse(row.metadata_json);
  const requiresProof = metadata.kind === 'hook_sweep' && metadata.asset === 'native';
  if (requiresProof && typeof opts.preSettlement !== 'function') {
    await update(q, row, { last_error: 'pre_settlement_verifier_required' });
    return result(row, 'pre_settlement_verifier_required');
  }
  if (opts.preSettlement) {
    try {
      const proof = await opts.preSettlement(publicRow(row), receipt);
      if (requiresProof && proof?.verified !== true) throw fail('pre_settlement_verifier_required', 'Native Hook delivery proof is required');
    }
    catch (error) {
      const reason = error.keeperCode || 'pre_settlement_verification_failed';
      await update(q, row, { last_error: reason });
      return result(row, reason);
    }
    const verified = await canonicalReceipt(pub, row, receipt);
    if (!verified.canonical || !verified.final) {
      await update(q, row, { status: 'reorged', last_error: 'receipt_changed_during_verification' });
      return result(row, 'receipt_changed_during_verification');
    }
  }
  return settle(q, row, receipt, opts.onConfirmed);
}

async function reconcile(q, row, domain, opts) {
  const pub = domain.clients.publicClient;
  await validateSigned(row);
  const receipt = await receiptFor(pub, row.tx_hash);
  if (receipt) return acceptReceipt(q, row, receipt, pub, opts);
  if (TERMINAL.has(row.status) || row.accounted_at) {
    await update(q, row, { status: 'reorged', last_error: 'settled_receipt_missing' });
    return result(row, 'settled_receipt_missing');
  }
  if (row.status === 'reorged') return result(row, 'reorg_requires_review');
  const minedNonce = Number(await pub.getTransactionCount({ address: getAddress(row.wallet), blockTag: 'latest' }));
  if (minedNonce > Number(row.nonce)) {
    // Unknown replacement or inconsistent RPC: either way the safe answer is to halt, not to
    // allocate another nonce. A later receipt for our exact hash can still reconcile this row.
    await update(q, row, { status: 'nonce_conflict', last_error: 'nonce_consumed_without_receipt' });
    return result(row, 'nonce_consumed_without_receipt');
  }
  if (row.status === 'nonce_conflict') return result(row, 'nonce_conflict_requires_review');
  await verifyTarget(pub, row.target, row.target_code_hash);
  const retryMs = opts.retryMs == null ? 30_000 : Number(opts.retryMs);
  if (!Number.isFinite(retryMs) || retryMs < 0) throw fail('invalid_policy', 'retryMs is invalid');
  if (row.last_broadcast_at && Date.now() - new Date(row.last_broadcast_at).getTime() < retryMs) return result(row);
  await update(q, row, { status: 'submitted', broadcast_attempts: Number(row.broadcast_attempts) + 1,
    last_broadcast_at: new Date(), last_error: null });
  try {
    const hash = await pub.sendRawTransaction({ serializedTransaction: row.raw_tx });
    if (lower(hash) !== lower(row.tx_hash)) throw fail('broadcast_hash_mismatch', 'RPC returned a different transaction hash');
  } catch (error) {
    await update(q, row, { status: 'ambiguous', last_error: error.keeperCode || 'broadcast_result_unknown' });
  }
  // A lost broadcast response can still have mined; only our persisted hash identifies success.
  const after = await receiptFor(pub, row.tx_hash);
  if (after) return acceptReceipt(q, row, after, pub, opts);
  return result(row, row.last_error);
}

async function checkLastFinalized(q, domain) {
  const row = (await q.query("SELECT * FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2 AND (status='settled' OR status='reverted') ORDER BY nonce DESC LIMIT 1",
    [domain.chainId, domain.wallet])).rows[0];
  if (!row) return null;
  const receipt = await receiptFor(domain.clients.publicClient, row.tx_hash);
  if (!receipt) {
    await update(q, row, { status: 'reorged', last_error: 'finalized_receipt_missing' });
    return result(row, 'finalized_receipt_missing');
  }
  const check = await canonicalReceipt(domain.clients.publicClient, row, receipt);
  if (!check.canonical || !check.final || lower(row.block_hash) !== lower(receipt.blockHash)) {
    await update(q, row, { status: 'reorged', last_error: 'finalized_chain_changed' });
    return result(row, 'finalized_chain_changed');
  }
  return null;
}

function spendBudgets(opts, gas, fee) {
  if (!opts.gasBudget) throw fail('invalid_policy', 'A bounded gas budget is required');
  const supplied = [...(opts.budgets || []).map((x) => ({ ...x, kind: 'spend' })),
    { ...opts.gasBudget, amount: gas * fee, kind: 'gas' }];
  const seen = new Set();
  return supplied.map((b) => {
    if (!/^[a-zA-Z0-9:_-]{1,128}$/.test(b.key || '') || !/^[a-zA-Z0-9:_-]{1,128}$/.test(String(b.period || ''))) {
      throw fail('invalid_policy', 'Budget key and period must be explicit stable identifiers');
    }
    const key = `${b.key}:${b.period}`;
    if (seen.has(key)) throw fail('invalid_policy', 'A budget cannot be repeated in one action');
    seen.add(key);
    const amount = uint(b.amount, 'budget amount', { zero: true });
    const limit = uint(b.limit, 'budget limit');
    if (amount > limit) throw fail('budget_exceeded', 'The action exceeds its configured budget');
    return { key: b.key, period: String(b.period), amount: String(amount), limit: String(limit), kind: b.kind };
  });
}

async function enforceBudgets(q, domain, budgets) {
  const rows = (await q.query('SELECT budget_json,status FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2',
    [domain.chainId, domain.wallet])).rows;
  for (const budget of budgets) {
    let allocated = 0n;
    for (const row of rows) for (const other of JSON.parse(row.budget_json)) {
      if (other.key !== budget.key || other.period !== budget.period) continue;
      // Reverts release the asset reservation after finality, but their gas still cost money.
      if (row.status === 'reverted' && other.kind !== 'gas') continue;
      if (other.limit !== budget.limit) throw fail('budget_policy_changed', 'An active budget period changed its approved limit');
      allocated += BigInt(other.amount);
    }
    if (allocated + BigInt(budget.amount) > BigInt(budget.limit)) throw fail('budget_exceeded', 'The budget is already spent or reserved');
  }
}

/**
 * Only internal typed planners call this transport. It is never an arbitrary-call HTTP API.
 * preSettlement(publicJournalRow, receipt) performs required historical RPC proofs before BEGIN.
 * onConfirmed(dbClient, publicJournalRow, receipt) MUST be database-only and deterministic.
 */
export async function runKeeperTransaction(pool, opts) {
  let domain;
  try {
    domain = validateDomain(opts);
    const target = address(opts.target, 'target');
    const targetCodeHash = lower(opts.targetCodeHash);
    if (!HASH.test(targetCodeHash)) throw fail('invalid_policy', 'Target runtime hash is required');
    if (!/^[a-zA-Z0-9:._/-]{1,256}$/.test(opts.jobKey || '')) throw fail('invalid_policy', 'jobKey must be a stable identifier');
    const data = lower(opts.request?.data || '0x');
    if (!/^0x(?:[0-9a-f]{2})*$/.test(data) || data.length > 131074) throw fail('invalid_policy', 'Call data is invalid');
    const value = String(uint(opts.request?.value ?? 0, 'value', { zero: true }));
    const request = { data, value };
    const id = digest([domain.chainId, domain.wallet, target, targetCodeHash, opts.jobKey]);
    const actionHash = digest([id, request]);
    return await withWalletLock(pool, domain.chainId, domain.wallet, async (q) => {
      await validateClient(domain);
      const existing = (await q.query('SELECT * FROM keeper_transactions WHERE id=$1', [id])).rows[0];
      if (existing) {
        if (existing.action_hash !== actionHash) throw fail('action_rebound', 'An existing job cannot change its transaction request');
        return reconcile(q, existing, domain, opts);
      }
      const active = (await q.query("SELECT * FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2 AND status NOT IN ('settled','reverted') ORDER BY nonce LIMIT 1",
        [domain.chainId, domain.wallet])).rows[0];
      if (active) return { ...result(active, 'wallet_has_pending_transaction'), state: 'blocked' };
      const changed = await checkLastFinalized(q, domain);
      if (changed) return changed;
      await verifyTarget(domain.clients.publicClient, target, targetCodeHash);
      const [latest, pending] = await Promise.all(['latest', 'pending'].map((blockTag) =>
        domain.clients.publicClient.getTransactionCount({ address: getAddress(domain.wallet), blockTag })));
      if (Number(latest) !== Number(pending)) throw fail('unknown_pending_nonce', 'The keeper wallet has an unjournaled pending transaction');
      const nonce = Number(latest);
      if (!Number.isSafeInteger(nonce) || nonce < 0) throw fail('invalid_nonce', 'RPC nonce is invalid');
      const lastNonce = (await q.query('SELECT nonce FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2 ORDER BY nonce DESC LIMIT 1',
        [domain.chainId, domain.wallet])).rows[0];
      if (lastNonce && nonce !== Number(lastNonce.nonce) + 1) {
        throw fail('unknown_consumed_nonce', 'The wallet nonce moved outside the shared keeper journal');
      }
      const maxGas = uint(opts.maxGas, 'maxGas');
      const maxFee = uint(opts.maxFeePerGas, 'maxFeePerGas');
      const priority = uint(opts.maxPriorityFeePerGas ?? 0, 'maxPriorityFeePerGas', { zero: true });
      if (priority > maxFee) throw fail('invalid_policy', 'Priority fee exceeds the total gas price cap');
      const confirmations = positiveInt(opts.confirmations, 'confirmations');
      const estimated = BigInt(await domain.clients.publicClient.estimateGas({ account: getAddress(domain.wallet),
        to: getAddress(target), data, value: BigInt(value) }));
      if (estimated <= 0n || estimated > maxGas) throw fail('gas_limit_exceeded', 'Simulation exceeds the approved gas limit');
      const gas = estimated + estimated / 5n < maxGas ? estimated + estimated / 5n : maxGas;
      const budgets = spendBudgets(opts, gas, maxFee);
      await enforceBudgets(q, domain, budgets);
      const prepared = await domain.clients.walletClient.prepareTransactionRequest({
        account: domain.clients.account, chainId: domain.chainId, type: 'eip1559', to: getAddress(target),
        data, value: BigInt(value), nonce, gas, maxFeePerGas: maxFee, maxPriorityFeePerGas: priority,
      });
      const raw = await domain.clients.walletClient.signTransaction({ ...prepared, account: domain.clients.account });
      const row = { id, chain_id: domain.chainId, wallet: domain.wallet, target,
        target_code_hash: targetCodeHash, job_key: opts.jobKey, action_hash: actionHash,
        nonce, raw_tx: raw, tx_hash: lower(keccak256(raw)), request_json: json(request), budget_json: json(budgets),
        metadata_json: json(opts.metadata || {}), gas_limit: String(gas), max_fee_per_gas: String(maxFee),
        priority_fee_per_gas: String(priority), confirmations, accounting_required: !!opts.accountingRequired,
        status: 'prepared', broadcast_attempts: 0, last_broadcast_at: null, last_error: null,
        block_number: null, block_hash: null, receipt_json: null, accounted_at: null };
      await validateSigned(row);
      await q.query('INSERT INTO keeper_transactions (id,chain_id,wallet,target,target_code_hash,job_key,action_hash,nonce,raw_tx,tx_hash,request_json,budget_json,metadata_json,gas_limit,max_fee_per_gas,priority_fee_per_gas,confirmations,accounting_required,status,broadcast_attempts,last_broadcast_at,last_error,block_number,block_hash,receipt_json,accounted_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)',
        [row.id,row.chain_id,row.wallet,row.target,row.target_code_hash,row.job_key,row.action_hash,row.nonce,
          row.raw_tx,row.tx_hash,row.request_json,row.budget_json,row.metadata_json,row.gas_limit,row.max_fee_per_gas,
          row.priority_fee_per_gas,row.confirmations,row.accounting_required,row.status,row.broadcast_attempts,
          row.last_broadcast_at,row.last_error,row.block_number,row.block_hash,row.receipt_json,row.accounted_at]);
      // INSERT is committed before this function can reach sendRawTransaction.
      return reconcile(q, row, domain, opts);
    });
  } catch (error) {
    return { state: 'blocked', alert: true, reason: codeOf(error), chainId: domain?.chainId, wallet: domain?.wallet };
  }
}

// Reconciliation ignores newly planned deadlines and always uses the exact persisted request.
// A deployment allowlist prevents a changed config from silently resuming an unrelated target.
export async function reconcileKeeperTransactions(pool, opts) {
  let domain;
  try {
    domain = validateDomain(opts);
    return await withWalletLock(pool, domain.chainId, domain.wallet, async (q) => {
      await validateClient(domain);
      const rows = (await q.query("SELECT * FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2 AND status NOT IN ('settled','reverted') ORDER BY nonce",
        [domain.chainId, domain.wallet])).rows;
      if (!rows.length) return (await checkLastFinalized(q, domain)) || { state: 'idle', alert: false };
      const row = rows[0];
      const allowed = opts.allowedTargets?.[row.target];
      if (!allowed || lower(allowed) !== row.target_code_hash) return result(row, 'pending_target_not_approved');
      return reconcile(q, row, domain, opts);
    });
  } catch (error) { return { state: 'blocked', alert: true, reason: codeOf(error), chainId: domain?.chainId, wallet: domain?.wallet }; }
}

export async function keeperTransactionStatus(pool, { chainId, wallet, jobKeys }) {
  const params=[positiveInt(chainId,'chainId'),address(wallet,'wallet')];
  let rows;
  if(jobKeys!==undefined) {
    if(!Array.isArray(jobKeys)||jobKeys.length>32||jobKeys.some(key=>!/^[a-zA-Z0-9:._/-]{1,256}$/.test(key)))throw fail('invalid_policy','Planning job keys must be bounded identifiers');
    if(!jobKeys.length)return[];
    // Fixed capacity equals the closed manifest's maximum job count. NULL padding cannot match
    // a non-null job key and keeps this statement PREPARE-checkable in the real PostgreSQL gate.
    params.push(...jobKeys,...Array(32-jobKeys.length).fill(null));
    rows=(await pool.query('SELECT * FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2 AND job_key IN ($3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27,$28,$29,$30,$31,$32,$33,$34) ORDER BY nonce DESC LIMIT 100',params)).rows;
  } else rows=(await pool.query('SELECT * FROM keeper_transactions WHERE chain_id=$1 AND wallet=$2 ORDER BY nonce DESC LIMIT 100',params)).rows;
  return rows.map(publicRow); // Never expose signed raw transaction bytes to status surfaces.
}
