// Confirmed public-log recovery. No signing, broadcasting, or caller-supplied value claims.
// A page's accounting and canonical cursor commit in one PostgreSQL transaction.
import { createHash } from 'node:crypto';
import { decodeEventLog, isAddress, keccak256, parseAbi, zeroAddress } from 'viem';
import { validateLiquidityManifest } from './liquiditykeeper.js';
import { LIQUIDITY_EVENTS, bookConfirmedLiquidityAction } from './liquidityaccounting.js';
import { DESK_AUCTION } from './rules.js';

const lower = (v) => String(v || '').toLowerCase();
const HASH = /^0x[0-9a-f]{64}$/i;
const fail = (code) => { throw Object.assign(new Error(code), { keeperCode: code }); };
const active = new Set();
const EVENT_KINDS = {
  Swept: ['hook_sweep'], FeesCollected: ['pol_collect', 'pol_increase'], LiquidityAdded: ['pol_increase'],
  InventoryFunded: ['pol_fund_inventory'], BuybackExecuted: ['buyback'], TokenRevenueDistributed: ['token_revenue'],
  KeeperRefilled: ['gas_topup'], Harvested: ['bank_harvest'], FeesSwept: ['bank_sweep'], BufferFunded: ['bank_fund_buffer'],
};
const observedEvents = LIQUIDITY_EVENTS.filter((e) => EVENT_KINDS[e.name]);
const HOOK_RECIPIENTS_EVENT = parseAbi(['event RecipientsSet(address dev,address rwa,address community,address lp)'])[0];
const stable = (v) => Array.isArray(v) ? v.map(stable) : v && typeof v === 'object'
  ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, stable(v[k])])) : v;
export const liquidityIndexerDomain = (m) => `liquidity:${createHash('sha256').update(JSON.stringify(stable(validateLiquidityManifest(m)))).digest('hex')}`;

function eventOf(log) {
  try { return decodeEventLog({ abi: observedEvents, topics: log.topics, data: log.data, strict: true }); }
  catch { return null; }
}
function canonicalLog(log, receipt) {
  if (!isAddress(log.address) || !HASH.test(log.transactionHash || '') || !HASH.test(log.blockHash || '')
      || log.blockNumber == null || !Number.isSafeInteger(Number(log.logIndex)) || Number(log.logIndex) < 0
      || log.logIndex == null || log.transactionIndex == null || !Number.isSafeInteger(Number(log.transactionIndex))
      || Number(log.transactionIndex) < 0 || log.removed) fail('noncanonical_liquidity_log');
  if (receipt && (lower(log.transactionHash) !== lower(receipt.transactionHash)
      || lower(log.blockHash) !== lower(receipt.blockHash) || BigInt(log.blockNumber) !== BigInt(receipt.blockNumber)
      || Number(log.transactionIndex) !== Number(receipt.transactionIndex))) fail('receipt_log_metadata_mismatch');
  return `${lower(log.transactionHash)}:${Number(log.logIndex)}`;
}
const rawLogIdentity = (log) => JSON.stringify([lower(log.address), lower(log.transactionHash), lower(log.blockHash),
  String(log.blockNumber), Number(log.transactionIndex), Number(log.logIndex), log.topics.map(lower), lower(log.data)]);
function chooseJob(m, target, event) {
  let candidates = m.jobs.filter((j) => m.contracts[j.target].address === target && EVENT_KINDS[event.eventName]?.includes(j.kind));
  if (event.eventName === 'Swept') candidates = candidates.filter((j) => lower(event.args.currency) === (j.asset === 'native' ? zeroAddress : m.contracts.omr.address));
  if (event.eventName === 'Harvested') candidates = candidates.filter((j) => lower(event.args.user) === j.user);
  if (event.eventName === 'FeesCollected' && candidates.some((j) => j.kind === 'pol_collect')) candidates = candidates.filter((j) => j.kind === 'pol_collect');
  if (candidates.length !== 1) fail('undeclared_liquidity_event');
  return candidates[0];
}

// Native transfers have no ERC-20 delivery logs. End-of-block getters alone are
// insufficient when governance rotates and restores recipients within the block.
// Conservatively hold every sweep block containing a recipient change; resolving
// those exceptional blocks requires explicit historical trace review.
export async function verifyHookSweepReceipt(clients, row, receipt) {
  const meta = row.metadata || JSON.parse(row.metadata_json || '{}');
  if (meta.kind !== 'hook_sweep' || meta.asset !== 'native') return { required: false };
  const pub = clients.publicClient, target = lower(row.target), blockNumber = BigInt(receipt.blockNumber);
  const expectedCode = lower(row.targetCodeHash || row.target_code_hash);
  if (!isAddress(target) || !HASH.test(expectedCode) || !HASH.test(receipt.blockHash || '')) fail('invalid_hook_receipt_pin');
  const code = await pub.getCode({ address: target, blockNumber });
  if (!code || code === '0x' || lower(keccak256(code)) !== expectedCode) fail('historical_runtime_mismatch');
  for (const name of ['dev', 'rwa', 'community', 'lp']) {
    const expected = meta.recipients?.[name];
    if (!isAddress(expected) || lower(expected) === zeroAddress) fail('hook_recipient_policy_required');
    const actual = await pub.readContract({ address: target, abi: parseAbi([`function ${name}Recipient() view returns (address)`]),
      functionName: `${name}Recipient`, blockNumber });
    if (lower(actual) !== lower(expected)) fail('historical_liquidity_binding_mismatch');
  }
  const changes = await pub.getLogs({ address: target, events: [HOOK_RECIPIENTS_EVENT], fromBlock: blockNumber, toBlock: blockNumber, strict: true });
  if (changes.length) fail('hook_recipients_changed_in_sweep_block');
  const block = await pub.getBlock({ blockNumber });
  if (block.number == null || BigInt(block.number) !== blockNumber || lower(block.hash) !== lower(receipt.blockHash)) fail('liquidity_receipt_reorg');
  return { required: true, verified: true, blockHash: lower(block.hash) };
}

async function metadataAt(q, m, pub, receipt, job, event) {
  const contract = m.contracts[job.target];
  const read = (name, signature, args = []) => pub.readContract({ address: m.contracts[name].address,
    abi: parseAbi([`function ${signature}`]), functionName: signature.split('(')[0], args, blockNumber: receipt.blockNumber });
  const r = (signature, args) => read(job.target, signature, args);
  const equal = (actual, expected) => { if (lower(actual) !== lower(expected)) fail('historical_liquidity_binding_mismatch'); };
  equal(await r('owner() view returns (address)'), m.governanceSafe);
  const meta = { kind: job.kind, jobId: job.id, omr: m.contracts.omr.address };
  if (job.kind === 'hook_sweep') {
    equal(await r('omr() view returns (address)'), m.contracts.omr.address);
    equal(await r('poolManager() view returns (address)'), m.contracts.poolManager.address);
    if (job.initializer) equal(await r('authorized() view returns (address)'), m.contracts[job.initializer].address);
    for (const name of ['dev', 'rwa', 'community', 'lp']) equal(await r(`${name}Recipient() view returns (address)`), job.recipients[name]);
    Object.assign(meta, { asset: job.asset, recipients: job.recipients });
    await verifyHookSweepReceipt({ publicClient: pub }, { target: contract.address, targetCodeHash: contract.runtimeHash, metadata: meta }, receipt);
  } else if (['buyback', 'token_revenue'].includes(job.kind)) {
    for (const [signature, expected] of [
      ['omr() view returns (address)', m.contracts.omr.address], ['poolManager() view returns (address)', m.contracts.poolManager.address],
      ['poolId() view returns (bytes32)', m.poolId], ['healthGuard() view returns (address)', m.contracts.polVault.address],
      ['oracle() view returns (address)', m.contracts.oracle.address], ['primaryRecipient() view returns (address)', job.primaryRecipient],
      ['secondaryRecipient() view returns (address)', job.secondaryRecipient], ['stream() view returns (uint8)', job.stream],
    ]) equal(await r(signature), expected);
    Object.assign(meta, { stream: job.stream, primaryRecipient: job.primaryRecipient, secondaryRecipient: job.secondaryRecipient,
      ...(job.stream < 2 ? { claimRecipient: m.contracts.claim.address } : {}) });
    if (job.kind === 'buyback' && job.stream === 1) {
      const saved = (await q.query('SELECT metadata_json,wallet,target,target_code_hash FROM keeper_transactions WHERE chain_id=$1 AND tx_hash=$2', [m.chainId, lower(receipt.transactionHash)])).rows[0];
      if (saved) {
        equal(saved.wallet, m.keeper); equal(saved.target, contract.address); equal(saved.target_code_hash, contract.runtimeHash);
        const prior = JSON.parse(saved.metadata_json);
        if (prior.kind !== 'buyback' || prior.stream !== 1 || prior.jobId !== job.id) fail('desk_journal_policy_mismatch');
        meta.anchorEthPerOmr = prior.anchorEthPerOmr;
        if (prior.strategyMinOutWei != null) meta.strategyMinOutWei = prior.strategyMinOutWei;
      } else {
        // Historical recovery never makes a newer print available to an older fill.
        const at = new Date(Number(receipt.blockTimestamp) * 1000);
        const prior = (await q.query('SELECT price_omr_per_eth,created_at FROM vig_buyback WHERE real AND created_at <= $1 ORDER BY created_at DESC LIMIT 1', [at])).rows[0];
        const age = at.getTime() - new Date(prior?.created_at || 0).getTime(), price = Number(prior?.price_omr_per_eth);
        if (!(price > 0 && Number.isFinite(price)) || age < 0 || age > DESK_AUCTION.ORACLE_MAX_AGE_MS) fail('historical_desk_anchor_unavailable');
        meta.anchorEthPerOmr = Math.round(1 / price * 1e8) / 1e8;
      }
    }
  } else if (job.kind.startsWith('pol_')) {
    for (const [signature, expected] of [
      ['omr() view returns (address)', m.contracts.omr.address], ['poolManager() view returns (address)', m.contracts.poolManager.address],
      ['poolId() view returns (bytes32)', m.poolId], ['oracle() view returns (address)', m.contracts.oracle.address],
    ]) equal(await r(signature), expected);
    meta.positionId = String(await r('positionId() view returns (uint256)'));
    meta.poolManager = m.contracts.poolManager.address;
    meta.deskRecipient = lower(await r('deskRecipient() view returns (address)'));
    meta.vigRecipient = lower(await r('vigRecipient() view returns (address)'));
    const collectPolicy = m.jobs.find((j) => j.kind === 'pol_collect' && j.target === job.target);
    if (!collectPolicy) fail('pol_fee_recipient_policy_required');
    equal(meta.deskRecipient, collectPolicy.deskRecipient); equal(meta.vigRecipient, collectPolicy.vigRecipient);
    if (job.kind === 'pol_fund_inventory') {
      meta.executor = m.contracts[job.executor].address;
      equal(await r('inventoryExecutor() view returns (address)'), meta.executor);
      equal(await r('inventoryExecutorCodeHash() view returns (bytes32)'), m.contracts[job.executor].runtimeHash);
    }
  } else if (job.kind === 'gas_topup') Object.assign(meta, { recipient: job.recipient, maxRefill: job.maxAmount });
  else if (job.kind.startsWith('bank_')) {
    for (const name of job.kind === 'bank_fund_buffer' ? ['asset', 'transmuter', 'debtToken'] : ['asset', 'vault', 'transmuter', 'debtToken'])
      equal(await r(`${name}() view returns (address)`), m.contracts[job[name]].address);
    equal(await read(job.asset, 'decimals() view returns (uint8)'), job.assetDecimals);
    Object.assign(meta, { asset: m.contracts[job.asset].address, transmuter: m.contracts[job.transmuter].address,
      assetDecimals: job.assetDecimals, user: job.user, feeRecipient: job.feeRecipient, maxFundAmount: job.maxAssetAmount });
    if (job.kind !== 'bank_fund_buffer') equal(await r('feeRecipient() view returns (address)'), job.feeRecipient);
  }
  return meta;
}

export async function syncLiquidityFlows(pool, { manifest, clients, startBlock, maxBlocks, endBlock } = {}) {
  const m = validateLiquidityManifest(manifest), pub = clients?.publicClient;
  startBlock ??= m.indexing?.startL2Block;
  maxBlocks ??= m.indexing?.maxBlocks ?? 2000;
  if (!pub || !/^(0|[1-9][0-9]*)$/.test(String(startBlock ?? '')) || !Number.isSafeInteger(maxBlocks) || maxBlocks < 1 || maxBlocks > 10000
      || endBlock != null && !/^(0|[1-9][0-9]*)$/.test(String(endBlock))) fail('invalid_liquidity_sync_range');
  if (m.indexing && (String(startBlock) !== m.indexing.startL2Block || maxBlocks > m.indexing.maxBlocks)) fail('liquidity_sync_range_exceeds_manifest');
  if (!process.env.DATABASE_URL) fail('liquidity_indexer_requires_postgres');
  const domain = liquidityIndexerDomain(m);
  if (active.has(domain)) return { synced: false, caughtUp: false, reason: 'liquidity_sync_busy' };
  active.add(domain);
  let q;
  try {
    if (Number(await pub.getChainId()) !== m.chainId) fail('wrong_chain');
    const latest = await pub.getBlock({ blockTag: 'latest' });
    if (latest.number == null || !HASH.test(latest.hash || '')) fail('invalid_liquidity_head');
    const confirmed = BigInt(latest.number) - BigInt(m.gas.confirmations) + 1n;
    if (confirmed < 0n) return { synced: false, caughtUp: false, reason: 'awaiting_confirmations' };
    const canonical = async (number) => {
      const b = await pub.getBlock({ blockNumber: number });
      if (b.number == null || BigInt(b.number) !== number || !HASH.test(b.hash || '') || b.timestamp == null) fail('invalid_canonical_block');
      return b;
    };
    const head = await canonical(confirmed);
    const pinsAt = async (number) => {
      await Promise.all(Object.values(m.contracts).map(async (pin) => {
        const code = await pub.getCode({ address: pin.address, blockNumber: number });
        if (!code || code === '0x' || lower(keccak256(code)) !== pin.runtimeHash) fail('historical_runtime_mismatch');
      }));
    };
    await pinsAt(confirmed);
    q = await pool.connect(); await q.query('BEGIN');
    await q.query('SELECT pg_advisory_xact_lock($1,$2)', [0x4c514958, createHash('sha256').update(domain).digest().readInt32BE(0)]);
    let cursor = (await q.query('SELECT next_block,previous_block_hash FROM liquidity_sync_cursors WHERE domain=$1 FOR UPDATE', [domain])).rows[0];
    if (cursor?.previous_block_hash) {
      const previous = await canonical(BigInt(cursor.next_block) - 1n);
      if (lower(previous.hash) !== lower(cursor.previous_block_hash)) fail('liquidity_cursor_reorg');
    }
    const from = cursor ? BigInt(cursor.next_block) : BigInt(startBlock);
    const end = endBlock == null || BigInt(endBlock) > confirmed ? confirmed : BigInt(endBlock);
    if (from > end) {
      await q.query('COMMIT');
      const caughtUp = !!cursor && from > confirmed;
      return { synced: false, caughtUp, reason: caughtUp ? 'caught_up' : 'awaiting_sync_range', nextBlock: String(from), confirmedHead: String(confirmed) };
    }
    const to = from + BigInt(maxBlocks) - 1n > end ? end : from + BigInt(maxBlocks) - 1n;
    const targets = [...new Set(m.jobs.filter((j) => Object.values(EVENT_KINDS).some((kinds) => kinds.includes(j.kind))).map((j) => m.contracts[j.target].address))].sort();
    if (!targets.length) fail('no_liquidity_event_targets');
    // Acquire source locks in one order, including against simultaneous keeper settlement.
    for (const target of targets) await q.query('SELECT pg_advisory_xact_lock($1,$2)', [0x4c514143,
      createHash('sha256').update(`${m.chainId}:${target}`).digest().readInt32BE(0)]);
    const discovered = await pub.getLogs({ address: targets, events: observedEvents, fromBlock: from, toBlock: to, strict: true });
    const logs = new Map();
    for (const log of discovered) {
      const id = canonicalLog(log);
      if (!targets.includes(lower(log.address)) || BigInt(log.blockNumber) < from || BigInt(log.blockNumber) > to || !eventOf(log)) fail('unexpected_liquidity_log');
      if (logs.has(id) && rawLogIdentity(log) !== rawLogIdentity(logs.get(id))) fail('conflicting_duplicate_liquidity_log');
      logs.set(id, log);
    }
    const ordered = [...logs.values()].sort((a, b) => Number(BigInt(a.blockNumber) - BigInt(b.blockNumber)) || Number(a.transactionIndex) - Number(b.transactionIndex) || Number(a.logIndex) - Number(b.logIndex));
    const receipts = new Map(), blocks = new Map();
    for (const log of ordered) {
      const tx = lower(log.transactionHash);
      if (!receipts.has(tx)) {
        const receipt = await pub.getTransactionReceipt({ hash: tx });
        if (receipt.status !== 'success' || lower(receipt.transactionHash) !== tx || !isAddress(receipt.to)
            || !isAddress(receipt.from) || receipt.transactionIndex == null || BigInt(receipt.blockNumber) < from || BigInt(receipt.blockNumber) > to) fail('invalid_liquidity_receipt');
        const n = String(receipt.blockNumber);
        if (!blocks.has(n)) { blocks.set(n, await canonical(BigInt(n))); await pinsAt(BigInt(n)); }
        const block = blocks.get(n);
        if (lower(receipt.blockHash) !== lower(block.hash)) fail('liquidity_receipt_reorg');
        receipt.blockTimestamp = block.timestamp;
        let previous = -1;
        for (const entry of receipt.logs || []) {
          canonicalLog(entry, receipt);
          if (Number(entry.logIndex) <= previous) fail('unordered_receipt_logs');
          previous = Number(entry.logIndex);
          const e = eventOf(entry);
          if (targets.includes(lower(entry.address)) && e && !logs.has(canonicalLog(entry))) fail('incomplete_liquidity_log_page');
        }
        receipts.set(tx, receipt);
      }
      const receipt = receipts.get(tx);
      const match = receipt.logs.find((entry) => Number(entry.logIndex) === Number(log.logIndex));
      if (!match || rawLogIdentity(match) !== rawLogIdentity(log)) fail('indexed_log_missing_from_receipt');
    }
    let booked = 0, duplicates = 0;
    for (const log of ordered) {
      const event = eventOf(log), receipt = receipts.get(lower(log.transactionHash)), target = lower(log.address);
      const job = chooseJob(m, target, event);
      const metadata = await metadataAt(q, m, pub, receipt, job, event);
      const result = await bookConfirmedLiquidityAction(q, { chainId: m.chainId, target, receiptTarget: receipt.to,
        txHash: receipt.transactionHash, eventLogIndex: Number(log.logIndex), expectedSequence: event.args.sequence?.toString(), metadata }, receipt);
      if (!result.settled) fail('liquidity_event_not_settled');
      booked += result.booked === true ? 1 : result.booked || 0;
      duplicates += result.duplicate ? 1 : result.duplicates || 0;
    }
    // No accounting survives a canonical change observed during this page.
    for (const [number, block] of blocks) if (lower((await canonical(BigInt(number))).hash) !== lower(block.hash)) fail('liquidity_page_reorg');
    if (lower((await canonical(confirmed)).hash) !== lower(head.hash)) fail('liquidity_head_reorg');
    const last = await canonical(to);
    await q.query('INSERT INTO liquidity_sync_cursors (domain,next_block,previous_block_hash) VALUES ($1,$2,$3) ON CONFLICT (domain) DO UPDATE SET next_block=EXCLUDED.next_block,previous_block_hash=EXCLUDED.previous_block_hash,updated_at=now()', [domain, String(to + 1n), lower(last.hash)]);
    await q.query('COMMIT');
    return { synced: true, caughtUp: to === confirmed, confirmedHead: String(confirmed), fromBlock: String(from), toBlock: String(to), nextBlock: String(to + 1n), events: ordered.length, booked, duplicates };
  } catch (error) { if (q) await q.query('ROLLBACK'); throw error; }
  finally { q?.release(); active.delete(domain); }
}

export const syncLiquidityReceipts = syncLiquidityFlows;
