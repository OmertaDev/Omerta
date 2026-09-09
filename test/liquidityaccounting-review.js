// Adversarial receipt/accounting regressions. These assertions intentionally failed
// against the first draft; the retained pre-fix log records that execution.
import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, parseAbi, parseUnits } from 'viem';
import { verifiedBuyback, bookConfirmedLiquidityAction, bookConfirmedLiquidityBuyback } from '../src/liquidityaccounting.js';

const ABI = parseAbi([
  'event BuybackExecuted(uint256 indexed sequence,uint8 indexed stream,uint256 ethSpent,uint256 omrBought,uint256 primaryAmount,uint256 secondaryAmount,address primaryRecipient,address secondaryRecipient)',
  'event TokenRevenueDistributed(uint256 indexed sequence,uint8 indexed stream,uint256 omrAmount,uint256 primaryAmount,uint256 secondaryAmount,address primaryRecipient,address secondaryRecipient)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
  'event Swept(address indexed currency,uint256 dev,uint256 rwa,uint256 community,uint256 lp)',
  'event FeesCollected(uint256 indexed tokenId,uint256 nativeFees,uint256 omrFees)',
]);
const a = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const h = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const OMR = a(1), TARGET = a(2), CLAIM = a(3), OUTER = a(4), VIG = a(5), ZERO = a(0);
const receiptBase = () => ({ status: 'success', to: TARGET, from: a(6), transactionHash: h(1), blockHash: h(100), blockNumber: 100n, blockTimestamp: 1_650_000_000n });
function log(name, args, index, address = TARGET) {
  const item = ABI.find((e) => e.name === name);
  return { address, logIndex: index, transactionHash: h(1), blockHash: h(100), blockNumber: 100n,
    topics: encodeEventTopics({ abi: ABI, eventName: name, args }),
    data: encodeAbiParameters(item.inputs.filter((i) => !i.indexed), item.inputs.filter((i) => !i.indexed).map((i) => args[i.name])) };
}
function fill({ stream = 3, sequence = 1n, amount = 100n * 10n ** 18n, direct = false, offset = 0 } = {}) {
  const secondaryAmount = stream === 0 ? amount - amount / 2n : 0n;
  const primaryAmount = amount - secondaryAmount;
  const meta = { kind: direct ? 'token_revenue' : 'buyback', stream, omr: OMR,
    primaryRecipient: CLAIM, secondaryRecipient: stream === 0 ? CLAIM : ZERO, claimRecipient: CLAIM, anchorEthPerOmr: 0.00001 };
  const event = { sequence, stream, ethSpent: 10n ** 15n, omrBought: amount, omrAmount: amount, primaryAmount,
    secondaryAmount, primaryRecipient: CLAIM, secondaryRecipient: meta.secondaryRecipient };
  const logs = [log('Transfer', { from: TARGET, to: CLAIM, value: amount }, offset, OMR),
    log(direct ? 'TokenRevenueDistributed' : 'BuybackExecuted', event, offset + 1)];
  return { row: { target: TARGET, txHash: h(1), chainId: 4663, metadata: meta }, receipt: { ...receiptBase(), logs } };
}
function queryRecorder() {
  const writes = [];
  return { writes, query: async (sql, args = []) => {
    writes.push({ sql, args });
    if (/SUM\(/i.test(sql)) return { rows: [{ s: /revenue|pol_fees/.test(sql) ? '100' : '0' }] };
    return { rows: [], rowCount: 1 };
  } };
}
const results = [];
async function check(name, run) {
  try { await run(); results.push({ name, passed: true }); console.log(`PASS ${name}`); }
  catch (error) { results.push({ name, passed: false }); console.log(`FAIL ${name}: ${error.message}`); }
}

await check('canonical nested target metadata accepts an actual permissionless outer call', async () => {
  const row = { target: TARGET, receiptTarget: OUTER, txHash: h(1), chainId: 4663,
    metadata: { kind: 'hook_sweep', asset: 'native', omr: OMR, recipients: { dev: a(10), rwa: a(11), community: a(12), lp: a(13) } } };
  const receipt = { ...receiptBase(), to: OUTER, logs: [log('Swept', { currency: ZERO, dev: 1n, rwa: 2n, community: 3n, lp: 4n }, 0)] };
  assert.equal((await bookConfirmedLiquidityAction(queryRecorder(), row, receipt)).booked, 1);
});
await check('selected executor sequence validates only its own exact delivery segment', () => {
  const first = fill(), second = fill({ sequence: 2n, amount: 200n * 10n ** 18n, offset: 2 });
  first.receipt.logs.push(...second.receipt.logs);
  first.row.eventLogIndex = 1; first.row.expectedSequence = '1';
  assert.equal(verifiedBuyback(first.row, first.receipt).sequence, 1n);
  first.row.eventLogIndex = 3; first.row.expectedSequence = '2';
  assert.equal(verifiedBuyback(first.row, first.receipt).sequence, 2n);
});
await check('POL token-denominated fees need exact OMR delivery to both fixed recipients', async () => {
  const row = { target: TARGET, txHash: h(1), chainId: 4663, metadata: {
    kind: 'pol_collect', omr: OMR, positionId: '7', deskRecipient: CLAIM, vigRecipient: VIG } };
  const receipt = { ...receiptBase(), logs: [log('FeesCollected', { tokenId: 7n, nativeFees: 1n, omrFees: 100n }, 0)] };
  await assert.rejects(bookConfirmedLiquidityAction(queryRecorder(), row, receipt), /delivery|Transfer|transfer/i);
});
await check('hook token sweeps need exact token delivery instead of an unsupported event-only credit', async () => {
  const row = { target: TARGET, txHash: h(1), chainId: 4663, metadata: { kind: 'hook_sweep', asset: 'omr', omr: OMR,
    recipients: { dev: a(10), rwa: a(11), community: a(12), lp: a(13) } } };
  const receipt = { ...receiptBase(), logs: [log('Swept', { currency: OMR, dev: 1n, rwa: 2n, community: 3n, lp: 4n }, 0)] };
  await assert.rejects(bookConfirmedLiquidityAction(queryRecorder(), row, receipt), /delivery|Transfer|transfer/i);
});
await check('Desk accounting preserves the existing lower-band and sanity-floor gates', async () => {
  const f = fill({ stream: 1, amount: 10n ** 18n });
  await assert.rejects(bookConfirmedLiquidityBuyback(queryRecorder(), f.row, f.receipt), /band|price/i);
});
await check('backfilled Vig prices retain their actual block time instead of becoming fresh at ingestion', async () => {
  const f = fill({ stream: 0 }); const q = queryRecorder();
  await bookConfirmedLiquidityBuyback(q, f.row, f.receipt);
  const insert = q.writes.find((w) => /INSERT INTO vig_buyback/.test(w.sql));
  assert.match(insert.sql, /created_at/);
  assert.ok(insert.args.some((v) => v instanceof Date && v.getTime() === Number(f.receipt.blockTimestamp) * 1000));
});
await check('micro-unit flooring never rounds a physical token allocation upward through Number', async () => {
  const micros = 9_000_000_000_000_001n;
  const f = fill({ stream: 1, direct: true, amount: micros * 10n ** 12n }); const q = queryRecorder();
  await bookConfirmedLiquidityBuyback(q, f.row, f.receipt);
  const update = q.writes.find((w) => /UPDATE chain_reserve/.test(w.sql));
  const bookedMicros = parseUnits(String(update.args[0]), 6);
  assert.ok(bookedMicros <= micros, `${bookedMicros} credited > ${micros} physically delivered`);
});
await check('Vig historical price continuity remains bounded before a new canonical print is published', async () => {
  const f = fill({ stream: 0, amount: 100_000n * 10n ** 18n });
  const recorder = queryRecorder(), q = { query: async (sql, args) => /SELECT price_omr_per_eth/.test(sql)
    ? { rows: [{ price_omr_per_eth: '1000' }] } : recorder.query(sql, args) };
  await assert.rejects(bookConfirmedLiquidityBuyback(q, f.row, f.receipt), /continuity|price/i);
});
console.log(JSON.stringify({ suite: 'liquidity accounting adversarial regressions', passed: results.filter((r) => r.passed).length, failed: results.filter((r) => !r.passed).length }));
if (results.some((r) => !r.passed)) process.exitCode = 1;
