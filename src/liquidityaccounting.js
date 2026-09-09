// Confirmed, receipt-authoritative accounting for the restricted liquidity executor.
// Called inside keepertransactions' settlement transaction; this module never sends a transaction.
import { createHash } from 'node:crypto';
import { decodeEventLog, parseAbi, formatUnits, isAddress } from 'viem';
import { BAND, DESK_BUYBACK } from './rules.js';

export const LIQUIDITY_EVENTS = parseAbi([
  'event BuybackExecuted(uint256 indexed sequence,uint8 indexed stream,uint256 ethSpent,uint256 omrBought,uint256 primaryAmount,uint256 secondaryAmount,address primaryRecipient,address secondaryRecipient)',
  'event TokenRevenueDistributed(uint256 indexed sequence,uint8 indexed stream,uint256 omrAmount,uint256 primaryAmount,uint256 secondaryAmount,address primaryRecipient,address secondaryRecipient)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Swept(address indexed currency,uint256 dev,uint256 rwa,uint256 community,uint256 lp)',
  'event FeesCollected(uint256 indexed tokenId,uint256 nativeFees,uint256 omrFees)',
  'event LiquidityAdded(uint256 indexed tokenId,uint128 liquidityAdded,uint256 nativeUsed,uint256 omrUsed)',
  'event InventoryFunded(address indexed executor,uint256 nativeAmount)',
  'event KeeperRefilled(address indexed keeper,uint256 amount,uint256 indexed period,uint256 spent)',
  'event Harvested(address indexed user,uint256 assets,uint256 debtCleared)',
  'event FeesSwept(address indexed to,uint256 amount)',
  'event BufferFunded(uint256 amount,uint256 indexed period,uint256 spent,uint256 reserves)',
  'event MigrationObserved(bool succeeded)',
  'event UnsoldReturned(uint256 amount)',
]);
const EVENTS = LIQUIDITY_EVENTS;
const lower = (v) => String(v || '').toLowerCase();
const ZERO = '0x0000000000000000000000000000000000000000';
const fail = (message) => { throw Object.assign(new Error(message), { keeperCode: 'settlement_mismatch' }); };
// SQL NUMERIC receives decimal strings. Number(wholeMicros)/1e6 can round UP,
// even when wholeMicros is still below MAX_SAFE_INTEGER.
const floor6 = (wei) => formatUnits(wei / 1000000000000n, 6);
const asNumber = (wei) => Number(formatUnits(wei, 18));
const HASH = /^0x[0-9a-f]{64}$/i;
const TERMINALS = new Set(['BuybackExecuted', 'TokenRevenueDistributed', 'Swept', 'FeesCollected',
  'LiquidityAdded', 'InventoryFunded', 'KeeperRefilled', 'Harvested', 'FeesSwept', 'BufferFunded', 'UnsoldReturned']);

function scaledDecimal(value, decimals = 18, roundUp = false) {
  const match = /^(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i.exec(String(value));
  if (!match || match[1].length + (match[2]?.length || 0) > 160) fail('Invalid numeric ledger amount');
  const exponent = Number(match[3] || 0);
  if (!Number.isSafeInteger(exponent) || Math.abs(exponent) > 160) fail('Invalid numeric ledger exponent');
  const n = BigInt(match[1] + (match[2] || ''));
  const shift = decimals + exponent - (match[2]?.length || 0);
  if (shift >= 0) return n * 10n ** BigInt(shift);
  const divisor = 10n ** BigInt(-shift);
  return n / divisor + (roundUp && n % divisor ? 1n : 0n);
}
const scalarWei = async (q, sql, roundUp = false) => scaledDecimal((await q.query(sql)).rows[0]?.s || '0', 18, roundUp);
const decimal18 = (wei) => formatUnits(wei, 18);
const microSum = (a, b) => formatUnits(scaledDecimal(a, 6) + scaledDecimal(b, 6), 6);

function receiptTime(receipt) {
  if (!/^[1-9][0-9]*$/.test(String(receipt.blockTimestamp || ''))) fail('Canonical receipt block timestamp is required');
  const seconds = Number(receipt.blockTimestamp);
  if (!Number.isSafeInteger(seconds) || seconds > Math.floor(Date.now() / 1000) + 15) fail('Invalid canonical receipt time');
  const at = new Date(seconds * 1000);
  if (!Number.isFinite(at.getTime())) fail('Invalid canonical receipt time');
  return at;
}

async function settlementLock(q, row) {
  if (!process.env.DATABASE_URL) return;
  const key = createHash('sha256').update(`${Number(row.chainId || row.chain_id)}:${lower(row.target)}`).digest().readInt32BE(0);
  await q.query('SELECT pg_advisory_xact_lock($1,$2)', [0x4c514143, key]);
}

function receiptContext(row, receipt) {
  const target = lower(row.target), txHash = lower(row.txHash || row.tx_hash);
  // receiptTarget is supplied only by the canonical confirmed-log indexer. The
  // event emitter remains the independently pinned row.target; keeper journal
  // rows omit this field and retain their original direct-target requirement.
  const outerTarget = lower(row.receiptTarget || row.target);
  if (Number(row.chainId || row.chain_id) !== 4663 || !isAddress(target) || !isAddress(outerTarget)
      || receipt.status !== 'success' || !HASH.test(txHash) || lower(receipt.transactionHash) !== txHash
      || lower(receipt.to) !== outerTarget || !HASH.test(receipt.blockHash || '') || receipt.blockNumber == null)
    fail('Invalid confirmed liquidity receipt');
  let previous = -1;
  const entries = (receipt.logs || []).map((log, ordinal) => {
    const index = Number(log.logIndex ?? ordinal);
    if (!Number.isSafeInteger(index) || index < 0 || index <= previous || log.removed
        || log.transactionHash && lower(log.transactionHash) !== txHash
        || log.blockHash && lower(log.blockHash) !== lower(receipt.blockHash)
        || log.blockNumber != null && BigInt(log.blockNumber) !== BigInt(receipt.blockNumber)) fail('Noncanonical receipt log');
    previous = index;
    let event = null;
    try { event = decodeEventLog({ abi: EVENTS, topics: log.topics, data: log.data, strict: true }); } catch {}
    return { log, index, event };
  });
  if (row.eventLogIndex != null && (!Number.isSafeInteger(Number(row.eventLogIndex)) || Number(row.eventLogIndex) < 0))
    fail('Invalid selected event log index');
  return { target, txHash, entries, selected: row.eventLogIndex == null ? null : Number(row.eventLogIndex) };
}

function segmentBefore(context, terminal) {
  let start = -1;
  for (const e of context.entries) if (e.index < terminal.index && lower(e.log.address) === context.target
      && TERMINALS.has(e.event?.eventName)) start = e.index;
  return context.entries.filter((e) => e.index > start && e.index < terminal.index);
}

function exactDeliveries(entries, token, from, allocations) {
  const expected = new Map(), delivered = new Map();
  for (const [recipient, amount] of allocations) {
    if (amount === 0n) continue;
    if (!isAddress(recipient) || lower(recipient) === ZERO || lower(recipient) === lower(from)) fail('Invalid token delivery recipient');
    expected.set(lower(recipient), (expected.get(lower(recipient)) || 0n) + amount);
  }
  for (const e of entries) if (lower(e.log.address) === lower(token) && e.event?.eventName === 'Transfer'
      && lower(e.event.args.from) === lower(from)) {
    const to = lower(e.event.args.to);
    delivered.set(to, (delivered.get(to) || 0n) + e.event.args.value);
  }
  for (const [recipient, amount] of expected) if (delivered.get(recipient) !== amount) fail('Exact token delivery Transfer logs are missing');
  for (const [recipient, amount] of delivered) if (expected.get(recipient) !== amount) fail('Unexpected token transfer destination or amount');
}

export function verifiedBuyback(row, receipt) {
  const meta = row.metadata || JSON.parse(row.metadata_json || '{}');
  const context = receiptContext(row, receipt);
  const { target, txHash } = context;
  if (!['buyback', 'token_revenue'].includes(meta.kind) || ![0, 1, 2, 3].includes(Number(meta.stream))) fail('Unknown buyback stream');
  const executions = [];
  for (const entry of context.entries) {
    if (lower(entry.log.address) !== target || context.selected != null && entry.index !== context.selected) continue;
    if (meta.kind === 'buyback' && entry.event?.eventName === 'BuybackExecuted') executions.push(entry);
    if (meta.kind === 'token_revenue' && entry.event?.eventName === 'TokenRevenueDistributed') executions.push(entry);
  }
  if (executions.length !== 1) fail('Exactly one executor fill must be present');
  const terminal = executions[0];
  const event = meta.kind === 'buyback' ? terminal.event.args
    : { ...terminal.event.args, ethSpent: 0n, omrBought: terminal.event.args.omrAmount };
  if (row.expectedSequence != null && String(event.sequence) !== String(row.expectedSequence)) fail('Selected executor sequence changed');
  if (Number(event.stream) !== Number(meta.stream) || (meta.kind === 'buyback' && event.ethSpent <= 0n) || event.omrBought <= 0n
      || event.primaryAmount + event.secondaryAmount !== event.omrBought
      || lower(event.primaryRecipient) !== lower(meta.primaryRecipient)
      || lower(event.secondaryRecipient) !== lower(meta.secondaryRecipient || ZERO)) fail('Executor output differs from its approved stream');
  if (Number(event.stream) === 0) {
    if (event.primaryAmount !== event.omrBought / 2n) fail('Vig reserve allocation differs from 50%');
    // All purchased Vig tokens are already in the claim contract, including earmarked prizes.
    // Prize payment later changes only the ledger reservation, never requires an operator transfer.
    if (lower(meta.primaryRecipient) !== lower(meta.claimRecipient)
        || lower(meta.secondaryRecipient) !== lower(meta.claimRecipient)) fail('Vig custody must physically back both reserve and prizes');
  } else if (event.secondaryAmount !== 0n || event.primaryAmount !== event.omrBought) fail('Single-recipient stream was split');
  if (Number(event.stream) === 1 && lower(meta.primaryRecipient) !== lower(meta.claimRecipient)) fail('Desk output must reach the claim contract');
  // Default keeper receipts must contain only one executor terminal. The indexer
  // explicitly selects one canonical terminal and proves its own preceding slice.
  const entries = context.selected == null ? context.entries : segmentBefore(context, terminal);
  if (context.selected == null && context.entries.filter((e) => lower(e.log.address) === target
      && ['BuybackExecuted', 'TokenRevenueDistributed'].includes(e.event?.eventName)).length !== 1)
    fail('Unselected multiple executor fills');
  exactDeliveries(entries, meta.omr, target, [[event.primaryRecipient, event.primaryAmount], [event.secondaryRecipient, event.secondaryAmount]]);
  return { ...event, meta, txHash, target, logIndex: terminal.index };
}

/// Settlement is idempotent both by keeper action and by chain/executor/sequence.
export async function bookConfirmedLiquidityBuyback(q, row, receipt) {
  const event = verifiedBuyback(row, receipt);
  const at = receiptTime(receipt);
  await settlementLock(q, row);
  const chainId = Number(row.chainId || row.chain_id);
  const id = `liquidity:${chainId}:${event.target}:${event.sequence}`;
  const existing = (await q.query('SELECT tx_hash,receipt_hash FROM liquidity_settlements WHERE id=$1', [id])).rows[0];
  if (existing) {
    if (lower(existing.tx_hash) !== event.txHash) fail('Executor sequence is already bound to another transaction');
    if (lower(existing.receipt_hash) !== lower(receipt.blockHash)) fail('Previously booked executor receipt was reorganized');
    return { settled: true, duplicate: true };
  }
  const stream = Number(event.stream);
  const eth = decimal18(event.ethSpent);
  const primary = floor6(event.primaryAmount), secondary = floor6(event.secondaryAmount);
  const bought = microSum(primary, secondary); // floor each physical allocation before summing
  const direct = event.ethSpent === 0n;
  const price = direct ? null : asNumber(event.omrBought) / asNumber(event.ethSpent);
  if (!direct && !(price > 0 && Number.isFinite(price))) fail('Invalid execution price');
  const ref = id;
  if (stream === 0) {
    await q.query('SELECT balance FROM vig_prize_pool WHERE id=1 FOR UPDATE');
    if (!direct) {
      const prior = (await q.query('SELECT price_omr_per_eth FROM vig_buyback WHERE real AND created_at <= $1 ORDER BY created_at DESC LIMIT 1', [at])).rows[0];
      const jump = Number(process.env.VIG_MAX_PRICE_JUMP) || 10;
      if (!Number.isFinite(jump) || jump < 1) fail('Invalid Vig price continuity policy');
      if (prior) {
        const lastWei = scaledDecimal(prior.price_omr_per_eth), jumpWei = scaledDecimal(String(jump));
        if (lastWei > 0n && (event.omrBought * 10n ** 36n > event.ethSpent * lastWei * jumpWei
            || event.omrBought * jumpWei < event.ethSpent * lastWei)) fail('Vig execution exceeds the historical price continuity bound');
      }
      const revenue = await scalarWei(q, 'SELECT COALESCE(SUM(vig_eth),0) s FROM vig_revenue');
      const spent = await scalarWei(q, 'SELECT COALESCE(SUM(eth_spent),0) s FROM vig_buyback WHERE real', true);
      if (event.ethSpent > revenue - spent) fail('Confirmed Vig spend exceeds recorded revenue; hold until inflow indexing catches up');
      await q.query('INSERT INTO vig_buyback (id,eth_spent,omr_bought,price_omr_per_eth,to_reserve,to_prize,tx_hash,real,created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,true,$8)',
        [id, eth, bought, price, primary, secondary, event.txHash, at]);
      await q.query('INSERT INTO dex_swaps (ref,eth_spent,omr_received,price_omr_per_eth,real,booked,created_at) VALUES ($1,$2,$3,$4,true,true,$5)',
        [ref, eth, bought, price, at]);
    }
    await q.query('UPDATE vig_prize_pool SET balance=balance+$1 WHERE id=1', [secondary]);
    await q.query('UPDATE chain_reserve SET funded_omr=funded_omr+$1,last_funded_at=now() WHERE id=1', [primary]);
  } else if (stream === 1) {
    await q.query('SELECT balance FROM desk_inventory WHERE id=1 FOR UPDATE');
    if (!direct) {
      const earned = await scalarWei(q, 'SELECT COALESCE(SUM(eth),0) s FROM pol_fees WHERE real');
      const spent = await scalarWei(q, 'SELECT COALESCE(SUM(eth_spent),0) s FROM desk_buys WHERE real', true);
      if (event.ethSpent > earned - spent) fail('Confirmed Desk spend exceeds recorded LP fee revenue');
      const anchor = scaledDecimal(event.meta.anchorEthPerOmr || '0');
      if (anchor <= 0n) fail('The approved Desk band anchor is missing');
      const actual = event.ethSpent * 10n ** 18n * 10000n;
      if (actual > anchor * event.omrBought * BigInt(BAND.LOWER_BPS)) fail('Desk execution exceeds its lower-band price');
      if (actual < anchor * event.omrBought * BigInt(DESK_BUYBACK.PRICE_FLOOR_BPS)) fail('Desk execution is below its price sanity floor');
      if (event.meta.strategyMinOutWei != null && event.omrBought < BigInt(event.meta.strategyMinOutWei)) fail('Desk output is below its approved strategy floor');
      await q.query('INSERT INTO desk_buys (ref,eth_spent,omr_bought,price_eth_per_omr,anchor_eth_per_omr,tx_hash,real,at) VALUES ($1,$2,$3,$4,$5,$6,true,$7)',
        [ref, eth, bought, 1 / price, decimal18(anchor), event.txHash, at]);
    }
    await q.query('UPDATE desk_inventory SET balance=balance+$1,lifetime_bought=lifetime_bought+$1 WHERE id=1', [bought]);
    await q.query('UPDATE chain_reserve SET funded_omr=funded_omr+$1,last_funded_at=now() WHERE id=1', [bought]);
    await q.query('INSERT INTO transactions (id,currency,amount,reason,counterparty,at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, 'omr', bought, 'desk:buyback', 'pol_fees', at]);
  } else if (stream === 2) {
    await q.query('SELECT balance FROM family_yield_pool WHERE id=1 FOR UPDATE');
    if (!direct) {
      const earned = await scalarWei(q, "SELECT COALESCE(SUM(amount),0) s FROM community_revenue WHERE currency='eth'");
      const spent = await scalarWei(q, "SELECT COALESCE(SUM(spent),0) s FROM family_buybacks WHERE real AND currency='eth'", true);
      if (event.ethSpent > earned - spent) fail('Confirmed Community spend exceeds recorded revenue');
      await q.query("INSERT INTO family_buybacks (id,currency,spent,price_omr,omr_bought,tx_hash,real,created_at) VALUES ($1,'eth',$2,$3,$4,$5,true,$6)",
        [id, eth, price, bought, event.txHash, at]);
    }
    await q.query('UPDATE family_yield_pool SET balance=balance+$1,lifetime_funded=lifetime_funded+$1 WHERE id=1', [bought]);
    await q.query('INSERT INTO transactions (id,currency,amount,reason,counterparty,at) VALUES ($1,$2,$3,$4,$5,$6)',
      [id, 'omr', bought, 'yield:buyback', 'community', at]);
  }
  // POL inventory creates no gameplay supply and no claim capacity. Its exact spend is kept here;
  // subsequent LP contributions are distinct receipt-authoritative custody events.
  await q.query('INSERT INTO liquidity_settlements (id,chain_id,executor,tx_hash,sequence,stream,eth_wei,omr_wei,primary_wei,secondary_wei,receipt_block,receipt_hash,primary_booked,secondary_booked) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)',
    [id, chainId, event.target, event.txHash, event.sequence.toString(), stream, event.ethSpent.toString(), event.omrBought.toString(),
      event.primaryAmount.toString(), event.secondaryAmount.toString(), String(receipt.blockNumber), receipt.blockHash, primary, secondary]);
  return { settled: true, booked: true, stream, eth, omr: bought, reserve: stream === 0 ? primary : stream === 1 ? bought : 0 };
}

// Treasury/LP receipt bookkeeping uses exact native shares, never a quoted OMR-to-ETH conversion.
// This function also runs for permissionless sweeps discovered by the confirmed-log indexer.
export async function bookConfirmedLiquidityAction(q, row, receipt) {
  const meta = row.metadata || JSON.parse(row.metadata_json || '{}');
  if (['buyback', 'token_revenue'].includes(meta.kind)) return bookConfirmedLiquidityBuyback(q, row, receipt);
  const context = receiptContext(row, receipt), at = receiptTime(receipt);
  await settlementLock(q, row);
  const chainId = Number(row.chainId || row.chain_id);
  let booked = 0, duplicates = 0;
  for (const entry of context.entries) {
    const { log, index: logIndex, event: parsed } = entry;
    if (lower(log.address) !== context.target || !parsed || context.selected != null && logIndex !== context.selected) continue;
    const id = `liquidity-flow:${chainId}:${lower(log.address)}:${lower(receipt.transactionHash)}:${logIndex}`;
    const existing = (await q.query('SELECT id,block_hash FROM liquidity_flow_receipts WHERE id=$1', [id])).rows[0];
    if (existing) {
      if (lower(existing.block_hash) !== lower(receipt.blockHash)) fail('Previously booked flow receipt was reorganized');
      duplicates++; continue;
    }
    let kind, currency = ZERO, gross = 0n;
    const e = parsed.args;
    const segment = segmentBefore(context, entry);
    if (meta.kind === 'hook_sweep' && parsed.eventName === 'Swept') {
      kind = 'hook_sweep'; currency = lower(e.currency);
      if (currency !== ZERO && currency !== lower(meta.omr)) fail('Unapproved hook fee currency');
      if ((meta.asset === 'native') !== (currency === ZERO)) fail('Hook sweep currency changed');
      gross = e.dev + e.rwa + e.community + e.lp;
      if (currency === ZERO) {
        await q.query('INSERT INTO sell_tax_events (ref,omr_taxed,price_omr_per_eth,gross_eth,dev_eth,rwa_eth,lp_eth,community_eth,tx_hash,real,created_at) VALUES ($1,0,0,$2,$3,$4,$5,$6,$7,true,$8)',
          [id, decimal18(gross), decimal18(e.dev), decimal18(e.rwa), decimal18(e.lp), decimal18(e.community), receipt.transactionHash, at]);
        if (e.rwa) await q.query("INSERT INTO rwa_revenue (source,ref,rwa_eth,created_at) VALUES ('tax',$1,$2,$3)", [id, decimal18(e.rwa), at]);
        if (e.community) await q.query("INSERT INTO community_revenue (source,ref,currency,gross,amount,created_at) VALUES ('tax',$1,'eth',$2,$3,$4)", [id, decimal18(gross), decimal18(e.community), at]);
      } else exactDeliveries(segment, meta.omr, row.target, ['dev', 'rwa', 'community', 'lp'].map((name) => [meta.recipients?.[name], e[name]]));
      // OMR taxes are retained in exact asset units here. Their ultimate executor delivery,
      // separately observed, credits gameplay backing; there is no fabricated native inflow.
    } else if (['pol_collect', 'pol_increase'].includes(meta.kind) && parsed.eventName === 'FeesCollected') {
      kind = 'pol_fees'; gross = e.nativeFees;
      if (String(e.tokenId) !== String(meta.positionId)) fail('Collected fee position differs from fixed custody');
      const desk = e.nativeFees * 7500n / 10000n, vig = e.nativeFees - desk;
      const deskOmr = e.omrFees * 7500n / 10000n;
      exactDeliveries(segment, meta.omr, row.target, [[meta.deskRecipient, deskOmr], [meta.vigRecipient, e.omrFees - deskOmr]]);
      if (vig) await q.query("INSERT INTO vig_revenue (source,ref,kind,gross_eth,vig_eth,created_at) VALUES ('polfees',$1,'polfees',$2,$3,$4)",
        [id, decimal18(e.nativeFees), decimal18(vig), at]);
      await q.query('INSERT INTO pol_fees (ref,eth,tx_hash,real,at) VALUES ($1,$2,$3,true,$4)', [id, decimal18(desk), receipt.transactionHash, at]);
    } else if (meta.kind === 'pol_increase' && parsed.eventName === 'LiquidityAdded') {
      kind = 'pol_add'; gross = e.nativeUsed;
      if (String(e.tokenId) !== String(meta.positionId) || e.liquidityAdded <= 0n) fail('Liquidity receipt differs from fixed position');
      if (meta.poolManager) exactDeliveries(segment, meta.omr, row.target, [[meta.poolManager, e.omrUsed]]);
      // ProtocolLiquidityVault's actual principal journal is separate from the old bond-only
      // EOA pairing journal, because this vault also receives Hook/Desk/genesis POL revenue.
    } else if (meta.kind === 'pol_fund_inventory' && parsed.eventName === 'InventoryFunded') {
      kind = 'inventory_funded'; gross = e.nativeAmount;
      if (lower(e.executor) !== lower(meta.executor)) fail('Inventory recipient differs from approved executor');
    } else if (meta.kind === 'gas_topup' && parsed.eventName === 'KeeperRefilled') {
      kind = 'gas_refill'; gross = e.amount;
      if (lower(e.keeper) !== lower(meta.recipient) || e.amount > BigInt(meta.maxRefill || 0)) fail('Gas refill differs from approved policy');
    } else if (meta.kind === 'bank_harvest' && parsed.eventName === 'Harvested') {
      kind = 'bank_harvest'; currency = lower(meta.asset); gross = e.assets;
      if (lower(e.user) !== lower(meta.user)) fail('Bank harvest user differs from the approved service');
    } else if (meta.kind === 'bank_sweep' && parsed.eventName === 'FeesSwept') {
      kind = 'bank_fee_delivery'; currency = lower(meta.asset); gross = e.amount;
      if (lower(e.to) !== lower(meta.feeRecipient)) fail('Bank fee recipient differs from the approved destination');
      exactDeliveries(segment, currency, row.target, [[e.to, e.amount]]);
    } else if (meta.kind === 'bank_fund_buffer' && parsed.eventName === 'BufferFunded') {
      kind = 'bank_buffer'; currency = lower(meta.asset); gross = e.amount;
      if (e.amount > BigInt(meta.maxFundAmount || 0)) fail('Bank buffer fund exceeds approved action cap');
      exactDeliveries(segment, currency, row.target, [[meta.transmuter, e.amount]]);
    } else if (meta.kind === 'genesis_migrate' && parsed.eventName === 'MigrationObserved') {
      kind = e.succeeded ? 'genesis_migrated' : 'genesis_failed';
    } else if (meta.kind === 'genesis_sweep_unsold' && parsed.eventName === 'UnsoldReturned') {
      kind = 'genesis_unsold'; gross = e.amount; currency = lower(meta.omr);
      if (meta.treasury) exactDeliveries(segment, currency, row.target, [[meta.treasury, e.amount]]);
    } else continue;
    await q.query('INSERT INTO liquidity_flow_receipts (id,chain_id,contract_address,tx_hash,log_index,kind,currency,gross_wei,details_json,block_number,block_hash) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [id, chainId, lower(log.address), lower(receipt.transactionHash), logIndex, kind, currency, gross.toString(),
        JSON.stringify(e, (_k, value) => typeof value === 'bigint' ? value.toString() : value), String(receipt.blockNumber), receipt.blockHash]);
    booked++;
  }
  if (['hook_sweep', 'pol_collect', 'pol_increase', 'pol_fund_inventory', 'gas_topup',
    'bank_harvest', 'bank_sweep', 'bank_fund_buffer', 'genesis_checkpoint', 'genesis_migrate',
    'genesis_sweep_unsold', 'genesis_distribute', 'genesis_accept_foundation'].includes(meta.kind)) {
    // A permissionless collector can legitimately collect zero fees after someone else.
    // That successful no-op creates no revenue; the external collection is found by the indexer.
    if (context.selected != null && booked + duplicates !== 1) fail('Selected liquidity event was not booked');
    return { settled: true, booked, duplicates };
  }
  fail('Unsupported liquidity settlement action');
}
