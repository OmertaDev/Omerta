import assert from 'node:assert/strict';
import { encodeAbiParameters, encodeEventTopics, parseAbi, parseAbiParameters } from 'viem';
if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/omerta_liquidity_test', 'use only the dedicated disposable database');
}
const { makeDb } = await import('../src/db.js');
const { bookConfirmedLiquidityBuyback, verifiedBuyback } = await import('../src/liquidityaccounting.js');
const { runVigInvariants } = await import('../src/vig.js');
const { runDeskInvariants } = await import('../src/desk.js');
const { runFamilyBuybackInvariants } = await import('../src/community.js');
const ABI = parseAbi([
  'event BuybackExecuted(uint256 indexed sequence,uint8 indexed stream,uint256 ethSpent,uint256 omrBought,uint256 primaryAmount,uint256 secondaryAmount,address primaryRecipient,address secondaryRecipient)',
  'event TokenRevenueDistributed(uint256 indexed sequence,uint8 indexed stream,uint256 omrAmount,uint256 primaryAmount,uint256 secondaryAmount,address primaryRecipient,address secondaryRecipient)',
  'event Transfer(address indexed from,address indexed to,uint256 value)',
]);
const a = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const h = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const OMR = a(10), CLAIM = a(11), COMMUNITY = a(12), POL = a(13), ZERO = a(0);
let counter = 0;
function fixture(stream, { direct = false, amount = 100_000000000000000001n } = {}) {
  const seq = BigInt(++counter), target = a(100 + stream), txHash = h(counter), primaryRecipient = stream < 2 ? CLAIM : stream === 2 ? COMMUNITY : POL;
  const secondaryRecipient = stream === 0 ? CLAIM : ZERO;
  const primary = stream === 0 ? amount / 2n : amount, secondary = amount - primary;
  const eth = direct ? 0n : 1_000000000000000n;
  const eventName = direct ? 'TokenRevenueDistributed' : 'BuybackExecuted';
  const args = direct ? [amount, primary, secondary, primaryRecipient, secondaryRecipient]
    : [eth, amount, primary, secondary, primaryRecipient, secondaryRecipient];
  const receipt = { status: 'success', transactionHash: txHash, to: target, blockNumber: 100n, blockHash: h(999), blockTimestamp: BigInt(Math.floor(Date.now() / 1000)), logs: [
    { address: target, topics: encodeEventTopics({ abi: ABI, eventName, args: { sequence: seq, stream } }),
      data: encodeAbiParameters(parseAbiParameters(direct ? 'uint256,uint256,uint256,address,address' : 'uint256,uint256,uint256,uint256,address,address'), args) },
    { address: OMR, topics: encodeEventTopics({ abi: ABI, eventName: 'Transfer', args: { from: target, to: primaryRecipient } }),
      data: encodeAbiParameters(parseAbiParameters('uint256'), [amount]) },
  ] };
  const row = { id: h(counter + 1000), target, txHash, chainId: 4663, metadata: { kind: direct ? 'token_revenue' : 'buyback', stream,
    omr: OMR, primaryRecipient, secondaryRecipient, claimRecipient: CLAIM, anchorEthPerOmr: 0.00002 } };
  return { row, receipt };
}
const pool = await makeDb();
let passed = 0;
const check = async (name, fn) => { await fn(); console.log(`PASS ${name}`); passed++; };
const settle = async ({ row, receipt }) => {
  const q = await pool.connect();
  try { await q.query('BEGIN'); const result = await bookConfirmedLiquidityBuyback(q, row, receipt); await q.query('COMMIT'); return result; }
  catch (e) { await q.query('ROLLBACK'); throw e; } finally { q.release(); }
};
try {
  await pool.query("INSERT INTO vig_revenue (source,ref,kind,gross_eth,vig_eth) VALUES ('test','liquidity','test',1,1)");
  await pool.query("INSERT INTO pol_fees (ref,eth,tx_hash,real) VALUES ('liquidity',1,$1,true)", [h(10000)]);
  await pool.query("INSERT INTO community_revenue (source,ref,currency,gross,amount) VALUES ('test','liquidity','eth',1,1)");
  await check('all four confirmed swap streams settle actual custody exactly once', async () => {
    for (let stream = 0; stream < 4; stream++) {
      const f = fixture(stream);
      assert.equal((await settle(f)).settled, true);
      assert.equal((await settle(f)).duplicate, true);
    }
    assert.equal(Number((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr), 150);
    assert.equal(Number((await pool.query('SELECT balance FROM vig_prize_pool WHERE id=1')).rows[0].balance), 50);
  });
  await check('direct OMR fees credit only delivered amounts and never invent an ETH price', async () => {
    const before = Number((await pool.query('SELECT COUNT(*) n FROM vig_buyback')).rows[0].n);
    for (let stream = 0; stream < 4; stream++) await settle(fixture(stream, { direct: true }));
    assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM vig_buyback')).rows[0].n), before);
    assert.equal(Number((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr), 300);
  });
  await check('odd wei and sub-micro dust cannot increase signable capacity', async () => {
    const before = Number((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr);
    await settle(fixture(0, { direct: true, amount: 3_000000000001n }));
    const after = Number((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr);
    assert.ok(Math.abs(after - before - 0.000001) < 1e-9);
  });
  await check('missing, forged and wrong-destination transfer receipts are rejected', async () => {
    for (const mutate of [
      (f) => { f.receipt.logs.pop(); },
      (f) => { f.receipt.logs[1].address = a(999); },
      (f) => { f.receipt.logs[1].data = encodeAbiParameters(parseAbiParameters('uint256'), [1n]); },
      (f) => { f.row.metadata.claimRecipient = a(999); },
      (f) => { f.receipt.status = 'reverted'; },
      (f) => { f.receipt.logs[0].removed = true; },
      (f) => { f.receipt.to = a(999); },
      (f) => { f.receipt.transactionHash = h(999); },
    ]) { const f = fixture(0); mutate(f); assert.throws(() => verifiedBuyback(f.row, f.receipt), /./); }
  });
  await check('a receipt from a changed executor sequence cannot replay a settlement', async () => {
    const f = fixture(0); await settle(f);
    f.row.txHash = f.receipt.transactionHash = h(888);
    await assert.rejects(settle(f), /already bound/);
  });
  await check('inflow-index lag holds accounting without partial pool or reserve writes', async () => {
    const f = fixture(2);
    const before = Number((await pool.query('SELECT balance FROM family_yield_pool WHERE id=1')).rows[0].balance);
    await pool.query("UPDATE community_revenue SET amount=0 WHERE ref='liquidity'");
    await assert.rejects(settle(f), /exceeds recorded revenue/);
    assert.equal(Number((await pool.query('SELECT balance FROM family_yield_pool WHERE id=1')).rows[0].balance), before);
    await pool.query("UPDATE community_revenue SET amount=1 WHERE ref='liquidity'");
    assert.equal((await settle(f)).settled, true);
  });
  await check('reserve, desk and community invariants include direct tokens as explicit backing', async () => {
    for (const run of [runVigInvariants, runDeskInvariants, runFamilyBuybackInvariants]) {
      const result = await run(pool);
      assert.equal(result.ok, true, JSON.stringify(result.checks.filter((c) => !c.ok)));
    }
  });
  console.log(JSON.stringify({ suite: 'liquidity accounting', passed, postgres: !!process.env.DATABASE_URL }));
} finally { await pool.end(); }
