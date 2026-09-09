// Real quote signer integration: unlimited daily policy with conserved lifetime authorization.
// Native Postgres additionally proves concurrent callers serialize through bond_reserve.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { encodeAbiParameters, parseUnits, recoverTypedDataAddress, toFunctionSelector } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { buildLiquidityManifestExample } from '../tools/liquidity-manifest-example.js';
if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/omerta_bond_unlimited_test', 'only the dedicated disposable database');
}
const { makeDb } = await import('../src/db.js');
const { quoteBond, bondChainConfig, BOND_QUOTE_TYPES } = await import('../src/chain.js');
const { bondBoard, setBondOffering, recordBond, outstandingBondQuoteUnits, bondQuoteBudgetAmount, bondQuoteBudgetUsage } = await import('../src/bonds.js');
const { buildLiquidityPlanningContext: observe, ensureDailyBondOffering: offer } = await import('../src/liquiditypolicy.js');
const { dayOf } = await import('../src/rules.js');
const pool = await makeDb();
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'omerta-bond-unlimited-'));
let rpcMode = 'okay';
const rpc = http.createServer(async (req, res) => {
  let body = ''; for await (const part of req) body += part;
  const query = JSON.parse(body);
  if (rpcMode === 'expire_on_price' && query.method === 'eth_call')
    await pool.query("UPDATE liquidity_market_status SET expires_at='2000-01-01'");
  const answer = (q) => {
    let result;
    if (q.method === 'eth_chainId') result = rpcMode === 'wrong_chain' ? '0x1' : '0x1237';
    else if (q.method === 'eth_getBlockByNumber' && rpcMode.startsWith('expiry_')) {
      result = { number: '0x64', hash: `0x${'ab'.repeat(32)}`, parentHash: `0x${'cd'.repeat(32)}`,
        timestamp: `0x${(BigInt(Math.floor(Date.now() / 1000)) - 2n).toString(16)}`, transactions: [], uncles: [],
        gasLimit: '0x1000000', gasUsed: '0x0', difficulty: '0x0', extraData: '0x', size: '0x1',
        miner: `0x${'00'.repeat(20)}`, nonce: '0x0000000000000000' };
    } else if (q.method === 'eth_getCode' && rpcMode.startsWith('expiry_')) result = '0x60006000';
    else if (q.method === 'eth_call') {
      if (rpcMode === 'oracle_failure') return { jsonrpc: '2.0', id: q.id, error: { code: -32000, message: 'oracle unavailable' } };
      result = q.params[0].data.startsWith(toFunctionSelector('usedNonce(uint256)'))
        ? encodeAbiParameters([{ type: 'bool' }], [rpcMode === 'expiry_used'])
        : encodeAbiParameters([{ type: 'uint256' }, { type: 'uint256' }], [parseUnits('4692', 18), parseUnits('4600', 18)]);
    } else return { jsonrpc: '2.0', id: q.id, error: { code: -32601, message: 'unsupported fixture method' } };
    return { jsonrpc: '2.0', id: q.id, result };
  };
  res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(Array.isArray(query) ? query.map(answer) : answer(query)));
});
await new Promise((resolve) => rpc.listen(0, '127.0.0.1', resolve));
const manifest = buildLiquidityManifestExample({ placeholders: false });
manifest.bondDailyIssuance = 'unlimited';
const configure = (mode = 'unlimited') => {
  if (mode == null) delete manifest.bondDailyIssuance; else manifest.bondDailyIssuance = mode;
  const bytes = JSON.stringify(manifest);
  fs.writeFileSync(path.join(dir, 'manifest.json'), bytes);
  Object.assign(process.env, { LIQUIDITY_AUTOMATION_ENABLED: 'on', CHAIN_ID: '4663',
    LIQUIDITY_AUTOMATION_MANIFEST_PATH: path.join(dir, 'manifest.json'),
    LIQUIDITY_AUTOMATION_MANIFEST_SHA256: createHash('sha256').update(bytes).digest('hex'),
    CHAIN_RPC_URL: `http://127.0.0.1:${rpc.address().port}`, OMERTA_BOND_ADDRESS: manifest.contracts.bond.address,
    VOUCHER_SIGNER_PK: `0x${'11'.repeat(32)}` }); // public deterministic test key, never production
};
configure();
let observed = Date.now();
const healthy = async (overrides = {}) => {
  observed = Math.max(observed + 1, Date.now());
  await observe(pool, manifest, { health: true, genesisPhase: 5, readAt: observed,
    blockNumber: '100', blockHash: `0x${'22'.repeat(32)}`, oracle: { omrPerEth: parseUnits('4600', 18).toString() }, jobs: {},
    bond: { ready: true, dailyCapOmrWei: manifest.bondDailyIssuance === 'unlimited' ? '0' : parseUnits('1000', 18).toString() }, ...overrides });
  // Avoid publishing a synthetic future heartbeat in tight local loops.
  if (observed > Date.now()) await new Promise((resolve) => setTimeout(resolve, observed - Date.now()));
};
const reset = async (capacity = '15000') => {
  for (const table of ['bonds', 'bond_quotes', 'bond_offerings', 'vig_revenue', 'rwa_revenue', 'vig_buyback', 'liquidity_market_status']) await pool.query(`DELETE FROM ${table}`);
  await pool.query('UPDATE bond_reserve SET capacity_omr=$1,committed_omr=0,pol_eth=0,dev_eth=0,rwa_eth=0,next_nonce=1 WHERE id=1', [capacity]);
  await pool.query("INSERT INTO vig_buyback (id,eth_spent,omr_bought,price_omr_per_eth,to_reserve,to_prize) VALUES ('unlimited-price',1,4600,4600,0,0)");
  rpcMode = 'okay'; configure(); await healthy();
};
const reject = (operation, code) => assert.rejects(operation, (error) => error.code === code || error.error === code);
const quoteCount = async () => Number((await pool.query('SELECT COUNT(*) n FROM bond_quotes')).rows[0].n);
let passed = 0;
const check = async (name, run) => { await run(); console.log(`PASS ${name}`); passed++; };
try {
  for (let i = 1; i <= 6; i++) {
    await pool.query("INSERT INTO accounts (id,auth_provider,auth_subject) VALUES ($1,'guest',$1) ON CONFLICT DO NOTHING", [`bond-user-${i}`]);
    await pool.query('INSERT INTO account_persistent (account_id,wallet_address) VALUES ($1,$2) ON CONFLICT (account_id) DO UPDATE SET wallet_address=EXCLUDED.wallet_address', [`bond-user-${i}`, `0x${i.toString(16).padStart(40, '0')}`]);
  }
  await check('two customers sign 5000 and 10000 OMR on the same day without an offering row', async () => {
    await reset();
    assert.equal((await offer(pool, { dailyOmr: 1 })).reason, 'daily_limit_removed');
    const first = await quoteBond(pool, 'bond-user-1', 1);
    const second = await quoteBond(pool, 'bond-user-2', 2);
    assert.equal(first.payoutOmr, 5000); assert.equal(second.payoutOmr, 10000);
    assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM bond_offerings')).rows[0].n), 0);
    assert.equal(await outstandingBondQuoteUnits(pool), 15000_000000n);
    const message = Object.fromEntries(Object.entries(first.quote).map(([key, value]) => [key, key === 'payer' ? value : BigInt(value)]));
    assert.equal((await recoverTypedDataAddress({ domain: bondChainConfig(), types: BOND_QUOTE_TYPES, primaryType: 'BondQuote', message, signature: first.signature })).toLowerCase(), privateKeyToAccount(process.env.VOUCHER_SIGNER_PK).address.toLowerCase());
    await reject(() => quoteBond(pool, 'bond-user-3', 0.01), 'over_capacity');
    const board = await bondBoard(pool, 'bond-user-1');
    assert.equal(board.daily.unlimited, true); assert.equal(board.daily.remainingOmr, null);
    assert.equal(board.reserve.reservedQuotesOmr, 15000); assert.equal(board.reserve.remainingOmr, 0);
    assert.equal(board.liquidity.bondReady, true);
  });
  await check('used quotes transition to committed without double counting or releasing allocation', async () => {
    await reset(); const q = await quoteBond(pool, 'bond-user-1', 1);
    await recordBond(pool, { nonce: q.nonce, payer: q.quote.payer, principalEth: 1,
      onchainPayout: 5000, onchainPol: 0.375, onchainVig: 0.225, onchainDev: 0.15, onchainRwa: 0.25, txHash: '0xbond-test' });
    assert.equal(await outstandingBondQuoteUnits(pool), 0n);
    assert.equal((await pool.query('SELECT status FROM bond_quotes WHERE nonce=1')).rows[0].status, 'bonded');
    assert.equal((await bondBoard(pool, null)).reserve.remainingOmr, 10000);
    await quoteBond(pool, 'bond-user-2', 2);
    await reject(() => quoteBond(pool, 'bond-user-3', 0.01), 'over_capacity');
  });
  await check('manual booking of a quoted nonce is not counted again as outstanding', async () => {
    await reset(); const q = await quoteBond(pool, 'bond-user-1', 1);
    await recordBond(pool, { nonce: q.nonce, accountId: 'bond-user-1', principalEth: 1, priceOmrPerEth: 4600, discountBps: 800 });
    assert.equal(await outstandingBondQuoteUnits(pool), 0n);
    assert.equal((await bondBoard(pool, null)).reserve.remainingOmr, 10000);
  });
  await check('exact payout rounding cannot overallocate at signing or release dust when booked', async () => {
    await reset('49.990472');
    await pool.query('UPDATE vig_buyback SET price_omr_per_eth=4599.123456');
    assert.equal(bondQuoteBudgetAmount('0.01', '4599.123456', 800), 49990473n);
    await reject(() => quoteBond(pool, 'bond-user-1', 0.01), 'over_capacity');
    await pool.query('UPDATE bond_reserve SET capacity_omr=49.990473');
    const q = await quoteBond(pool, 'bond-user-1', 0.01);
    assert.equal(q.payoutOmr, 49.990472);
    assert.equal(await outstandingBondQuoteUnits(pool), 49990473n);
    await recordBond(pool, { nonce: q.nonce, principalEth: 0.01, onchainPayout: q.payoutOmr,
      onchainPol: 0.00375, onchainDev: 0.0015, onchainVig: 0.00225, onchainRwa: 0.0025, txHash: '0xrounding-bond' });
    const budget = await bondQuoteBudgetUsage(pool);
    assert.equal(budget.outstanding, 0n); assert.equal(budget.settledAdjustment, 1n);
    assert.equal((await bondBoard(pool, null)).reserve.remainingOmr, 0);
    // Even a historically inconsistent expired marker cannot erase an already-booked liability.
    await pool.query("UPDATE bond_quotes SET status='expired' WHERE nonce=$1", [q.nonce]);
    assert.equal((await bondQuoteBudgetUsage(pool)).settledAdjustment, 1n);
  });
  await check('discretionary booking cannot consume another outstanding quote reservation', async () => {
    await reset('7500'); await quoteBond(pool, 'bond-user-1', 1);
    await reject(() => recordBond(pool, { nonce: 999, principalEth: 1, priceOmrPerEth: 4600, discountBps: 800 }), 'over_capacity');
    assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM bonds')).rows[0].n), 0);
    assert.equal(await outstandingBondQuoteUnits(pool), 5000_000000n);
  });
  await check('wall-clock-expired quotes remain reserved when chain proof is unavailable', async () => {
    await reset('5000'); await quoteBond(pool, 'bond-user-1', 1);
    await pool.query('UPDATE bond_quotes SET deadline=1');
    await reject(() => quoteBond(pool, 'bond-user-2', 0.01), 'over_capacity');
    assert.equal(await outstandingBondQuoteUnits(pool), 5000_000000n);
  });
  await check('a later quote automatically releases finalized unused reservations with durable domain proof', async () => {
    await reset('5000'); const old = await quoteBond(pool, 'bond-user-1', 1);
    const clock = Date.now;
    try {
      const future = (old.deadline + 10) * 1000; Date.now = () => future;
      await healthy(); rpcMode = 'expiry_unused';
      const next = await quoteBond(pool, 'bond-user-2', 1);
      assert.notEqual(next.nonce, old.nonce);
      const row = (await pool.query('SELECT status,expiry_proof FROM bond_quotes WHERE nonce=$1', [old.nonce])).rows[0];
      assert.equal(row.status, 'expired');
      const proof = JSON.parse(row.expiry_proof);
      assert.equal(proof.bondAddress, manifest.contracts.bond.address); assert.equal(proof.chainId, 4663);
      assert.equal(proof.usedNonce, false); assert.equal(proof.finality, 'finalized');
      assert.equal(await outstandingBondQuoteUnits(pool), 5000_000000n);
    } finally { Date.now = clock; observed = Date.now(); }
  });
  await check('a used nonce before expiry holds its allocation while the watcher is behind', async () => {
    await reset('5000'); const old = await quoteBond(pool, 'bond-user-1', 1);
    const clock = Date.now;
    try {
      const future = (old.deadline + 10) * 1000; Date.now = () => future;
      await healthy(); rpcMode = 'expiry_used';
      await reject(() => quoteBond(pool, 'bond-user-2', 1), 'over_capacity');
      assert.equal((await pool.query('SELECT status FROM bond_quotes WHERE nonce=$1', [old.nonce])).rows[0].status, 'quoted');
    } finally { Date.now = clock; observed = Date.now(); }
  });
  await check('unlimited mode ignores old daily rows and rejects ineffective daily stop controls', async () => {
    await reset(); await pool.query('INSERT INTO bond_offerings (day,offered_omr,quoted_omr) VALUES ($1,0,0)', [dayOf()]);
    await quoteBond(pool, 'bond-user-1', 1);
    for (const amount of [0, 1000]) await reject(() => setBondOffering(pool, amount), 'daily_offerings_disabled');
    const row = (await pool.query('SELECT offered_omr,quoted_omr FROM bond_offerings')).rows[0];
    assert.equal(Number(row.offered_omr), 0); assert.equal(Number(row.quoted_omr), 0);
  });
  await check('missing or capped manifest policy retains daily offering checks', async () => {
    for (const mode of [null, 'capped']) {
      await reset(); configure(mode); await healthy();
      await reject(() => quoteBond(pool, 'bond-user-1', 1), 'no_offering');
      await setBondOffering(pool, 1000);
      await reject(() => quoteBond(pool, 'bond-user-1', 1), 'offering_spent');
      assert.equal(await quoteCount(), 0);
    }
  });
  await check('paused, unhealthy, stale and cap-mismatched observations never sign', async () => {
    for (const override of [{ bond: { ready: false, dailyCapOmrWei: '0' } }, { health: false },
      { genesisPhase: 4 }, { bond: { ready: true, dailyCapOmrWei: '1000' } }]) {
      await reset(); await healthy(override);
      await reject(() => quoteBond(pool, 'bond-user-1', 1), 'liquidity_unavailable');
      assert.equal(await quoteCount(), 0);
    }
    await reset(); await pool.query("UPDATE liquidity_market_status SET expires_at='2000-01-01'");
    await reject(() => quoteBond(pool, 'bond-user-1', 1), 'liquidity_unavailable');
    const board = await bondBoard(pool, null);
    assert.equal(board.daily.unlimited, true); assert.equal(board.liquidity.bondReady, false); assert.equal(board.quote, null);
  });
  await check('live oracle failure, wrong RPC chain, missing wallet and nonfinite principal cannot sign', async () => {
    await reset();
    for (const mode of ['oracle_failure', 'wrong_chain']) {
      rpcMode = mode; await reject(() => quoteBond(pool, 'bond-user-1', 1), 'oracle');
    }
    rpcMode = 'okay';
    await pool.query("UPDATE account_persistent SET wallet_address=NULL WHERE account_id='bond-user-6'");
    await reject(() => quoteBond(pool, 'bond-user-6', 1), 'wallet');
    for (const value of [Infinity, NaN, -1, 0.001]) await reject(() => quoteBond(pool, 'bond-user-1', value), 'min');
    assert.equal(await quoteCount(), 0);
  });
  await check('heartbeat expiry during price RPC and a different signing contract both refuse quotes', async () => {
    await reset(); rpcMode = 'expire_on_price';
    await reject(() => quoteBond(pool, 'bond-user-1', 1), 'liquidity_unavailable');
    rpcMode = 'okay'; await healthy();
    process.env.OMERTA_BOND_ADDRESS = '0x1111111111111111111111111111111111111111';
    await reject(() => quoteBond(pool, 'bond-user-1', 1), 'liquidity_unavailable');
    assert.equal(await quoteCount(), 0);
  });
  if (process.env.DATABASE_URL) await check('concurrent accounts cannot overallocate a 7500 OMR lifetime budget', async () => {
    await reset('7500');
    const results = await Promise.allSettled(Array.from({ length: 5 }, (_, i) => quoteBond(pool, `bond-user-${i + 1}`, 1)));
    assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
    for (const result of results.filter((result) => result.status === 'rejected')) assert.equal(result.reason.code, 'over_capacity');
    assert.equal(await quoteCount(), 1); assert.equal(await outstandingBondQuoteUnits(pool), 5000_000000n);
  });
  console.log(`${passed} unlimited bond checks passed (${process.env.DATABASE_URL ? 'native Postgres' : 'pg-mem; no concurrency proof'})`);
} finally {
  await pool.end(); await new Promise((resolve) => rpc.close(resolve));
  fs.unlinkSync(path.join(dir, 'manifest.json')); fs.rmdirSync(dir);
}
