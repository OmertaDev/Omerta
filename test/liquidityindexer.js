// Real PostgreSQL atomicity/recovery tests; RPC is an explicit deterministic fixture.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { encodeAbiParameters, encodeEventTopics, keccak256, parseAbi } from 'viem';
import { Pool } from 'pg';
import { createHash } from 'node:crypto';
import { syncLiquidityReceipts, liquidityIndexerDomain } from '../src/liquidityindexer.js';
import { LIQUIDITY_EVENTS } from '../src/liquidityaccounting.js';

const url = new URL(process.env.DATABASE_URL || 'http://invalid');
assert.ok(['localhost', '127.0.0.1'].includes(url.hostname), 'local audit database is required');
assert.equal(url.pathname, '/omerta_liquidity_indexer_test', 'use only the dedicated disposable indexer database');
const a = (n) => `0x${n.toString(16).padStart(40, '0')}`;
const h = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const CODE = '0x60006000', RUNTIME = keccak256(CODE), ETH = 10n ** 18n, TIME = 1_750_000_000n;
const SAFE = a(1), KEEPER = a(2), OUTER = a(3), CLAIM = a(4);
const contracts = Object.fromEntries(['omr', 'poolManager', 'oracle', 'polVault', 'hook', 'vig', 'desk', 'community', 'polBuyback', 'claim'].map((name, i) => [name, { address: name === 'claim' ? CLAIM : a(i + 10), runtimeHash: RUNTIME }]));
const addr = (name) => contracts[name].address;
const recipients = { dev: a(31), rwa: a(32), community: addr('community'), lp: addr('polVault') };
const job = (v) => ({ intervalSeconds: 60, minNativeValue: String(ETH / 1000n), ...v });
const TEST_EVENTS = [...LIQUIDITY_EVENTS, ...parseAbi(['event RecipientsSet(address dev,address rwa,address community,address lp)'])];
function manifest() {
  return { schemaVersion: 1, chainId: 4663, governanceSafe: SAFE, keeper: KEEPER, poolId: h(700),
    contracts: structuredClone(contracts), indexing: { startL2Block: '100', maxBlocks: 2000 },
    gas: { maxGas: '100000', maxFeePerGas: '1000', maxPriorityFeePerGas: '100', dailyBudget: String(ETH), confirmations: 2, maxSnapshotAgeSeconds: 60 },
    jobs: [
      job({ id: 'hookNative', kind: 'hook_sweep', target: 'hook', asset: 'native', recipients }),
      job({ id: 'hookOmr', kind: 'hook_sweep', target: 'hook', asset: 'omr', recipients }),
      job({ id: 'collect', kind: 'pol_collect', target: 'polVault', deskRecipient: addr('desk'), vigRecipient: addr('vig') }),
      job({ id: 'increase', kind: 'pol_increase', target: 'polVault', maxNative: String(ETH), maxOmr: String(ETH), dailyNativeBudget: String(ETH * 3n), dailyOmrBudget: String(ETH * 3n), slippageBps: 300 }),
      job({ id: 'fund', kind: 'pol_fund_inventory', target: 'polVault', executor: 'polBuyback', maxNative: String(ETH), dailyNativeBudget: String(ETH * 3n) }),
      ...[0, 1, 2, 3].flatMap((stream) => ['buyback', 'token_revenue'].map((kind) => job({
        id: `${kind}${stream}`, kind, target: ['vig', 'desk', 'community', 'polBuyback'][stream], stream,
        primaryRecipient: stream < 2 ? CLAIM : stream === 2 ? a(35) : addr('polVault'),
        secondaryRecipient: stream === 0 ? CLAIM : a(0),
        ...(kind === 'buyback' ? { maxAmount: String(ETH), dailyBudget: String(ETH * 2n) } : {}),
      }))),
    ] };
}
function log(name, args, index, { emitter = 'hook', tx = 1, block = 100, txIndex = 0 } = {}) {
  const abi = TEST_EVENTS.find((e) => e.name === name);
  return { address: contracts[emitter]?.address || emitter, logIndex: index, transactionIndex: txIndex,
    transactionHash: h(tx), blockHash: h(block), blockNumber: BigInt(block), removed: false,
    topics: encodeEventTopics({ abi: TEST_EVENTS, eventName: name, args }),
    data: encodeAbiParameters(abi.inputs.filter((e) => !e.indexed), abi.inputs.filter((e) => !e.indexed).map((e) => args[e.name])) };
}
const transfer = (from, to, amount, index, options = {}) => log('Transfer', { from: contracts[from]?.address || from, to: contracts[to]?.address || to, value: amount }, index, { ...options, emitter: 'omr' });
const swept = (index = 0, options = {}, amounts = {}) => log('Swept', { currency: a(0), dev: 1n, rwa: 2n, community: 3n, lp: 4n, ...amounts }, index, options);
function tokenFill(stream, sequence, amount, index, options = {}) {
  const emitter = ['vig', 'desk', 'community', 'polBuyback'][stream];
  const primary = stream < 2 ? CLAIM : stream === 2 ? a(35) : addr('polVault');
  const secondary = stream === 0 ? CLAIM : a(0), first = stream === 0 ? amount / 2n : amount;
  return [transfer(emitter, primary, amount, index, options), log('TokenRevenueDistributed', { sequence, stream, omrAmount: amount,
    primaryAmount: first, secondaryAmount: amount - first, primaryRecipient: primary, secondaryRecipient: secondary }, index + 1, { ...options, emitter })];
}
function deskBuy(index = 0, amount = 100n * ETH, sequence = 1n) {
  return [transfer('desk', CLAIM, amount, index), log('BuybackExecuted', { sequence, stream: 1,
    ethSpent: ETH / 1000n, omrBought: amount, primaryAmount: amount, secondaryAmount: 0n,
    primaryRecipient: CLAIM, secondaryRecipient: a(0) }, index + 1, { emitter: 'desk' })];
}
function fixture(receiptLogs = [swept()], options = {}) {
  const m = manifest(), receipts = new Map();
  for (const entry of receiptLogs) {
    if (!receipts.has(entry.transactionHash)) receipts.set(entry.transactionHash, { status: 'success', transactionHash: entry.transactionHash,
      to: OUTER, from: a(999), transactionIndex: entry.transactionIndex, blockNumber: entry.blockNumber, blockHash: entry.blockHash, logs: [] });
    receipts.get(entry.transactionHash).logs.push(entry);
  }
  const counters = { blocks: new Map(), code: [], logs: [] }, names = Object.fromEntries(Object.entries(contracts).map(([n, c]) => [c.address, n]));
  const block = (n) => ({ number: n, hash: h(Number(n)), timestamp: TIME + n });
  const pub = {
    getChainId: async () => options.wrongChain ? 1 : 4663,
    getBlock: async ({ blockTag, blockNumber }) => {
      const n = blockTag ? BigInt(options.latest || 102) : blockNumber;
      const seen = (counters.blocks.get(String(n)) || 0) + 1; counters.blocks.set(String(n), seen);
      if (options.changedCursor && n === 101n || options.reorgDuring && n === 100n && seen > 2) return { ...block(n), hash: h(9999) };
      return block(n);
    },
    getCode: async ({ address, blockNumber }) => { counters.code.push({ address, blockNumber }); return options.badCode && blockNumber === 100n ? '0x6001' : CODE; },
    getLogs: async (args) => {
      counters.logs.push(args);
      const addresses = Array.isArray(args.address) ? args.address : [args.address];
      const topics = args.events.map((e) => encodeEventTopics({ abi: [e], eventName: e.name })[0]);
      let found = receiptLogs.filter((e) => BigInt(e.blockNumber) >= args.fromBlock && BigInt(e.blockNumber) <= args.toBlock && addresses.includes(e.address) && topics.includes(e.topics[0]));
      if (options.missingPageLog) found = found.slice(0, -1);
      if (options.duplicate && found.length) found.push(structuredClone(found[0]));
      if (options.conflict && found.length) found.push({ ...structuredClone(found[0]), data: '0x01' });
      if (options.removed && found.length) found[0] = { ...found[0], removed: true };
      return options.reverse ? found.reverse() : found;
    },
    getTransactionReceipt: async ({ hash }) => {
      const r = structuredClone(receipts.get(hash));
      if (options.receiptReorg) r.blockHash = h(9999);
      if (options.changedLog) r.logs[0].data = '0x01';
      if (options.receiptFailed) r.status = 'reverted';
      if (options.missingTimestamp) r.blockTimestamp = null;
      return r;
    },
    readContract: async ({ address, functionName: fn, blockNumber }) => {
      assert.equal(blockNumber, 100n, 'binding reads use the actual receipt block');
      const name = names[address], stream = ['vig', 'desk', 'community', 'polBuyback'].indexOf(name);
      const fixed = { owner: SAFE, omr: addr('omr'), poolManager: addr('poolManager'), poolId: h(700), oracle: addr('oracle'),
        healthGuard: addr('polVault'), positionId: 7n, deskRecipient: addr('desk'), vigRecipient: addr('vig'),
        inventoryExecutor: addr('polBuyback'), inventoryExecutorCodeHash: RUNTIME };
      if (fn in fixed) return fixed[fn];
      if (fn.endsWith('Recipient') && name === 'hook') return options.wrongRecipient ? a(999) : recipients[fn.slice(0, -9)];
      if (fn === 'stream') return stream;
      if (fn === 'primaryRecipient') return stream < 2 ? CLAIM : stream === 2 ? a(35) : addr('polVault');
      if (fn === 'secondaryRecipient') return stream === 0 ? CLAIM : a(0);
      throw new Error(`Unhandled fixture read ${name}.${fn}`);
    },
  };
  return { m, clients: { publicClient: pub }, counters };
}

if (process.argv.includes('--concurrency-worker')) {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try { const f = fixture(); console.log('READY'); console.log(`RESULT ${JSON.stringify(await syncLiquidityReceipts(pool, { manifest: f.m, clients: f.clients }))}`); }
  finally { await pool.end(); }
} else {
  const { makeDb } = await import('../src/db.js');
  const pool = await makeDb();
  let passed = 0;
  const count = async (table) => Number((await pool.query(`SELECT COUNT(*) n FROM ${table}`)).rows[0].n);
  const reset = async () => {
    await pool.query('TRUNCATE liquidity_sync_cursors,liquidity_flow_receipts,liquidity_settlements,keeper_transactions,vig_revenue,vig_buyback,dex_swaps,pol_fees,desk_buys,family_buybacks,community_revenue,rwa_revenue,sell_tax_events,transactions');
    await pool.query('UPDATE chain_reserve SET funded_omr=0 WHERE id=1');
    await pool.query('UPDATE vig_prize_pool SET balance=0 WHERE id=1');
    await pool.query('UPDATE desk_inventory SET balance=0,lifetime_bought=0 WHERE id=1');
    await pool.query('UPDATE family_yield_pool SET balance=0,lifetime_funded=0 WHERE id=1');
  };
  const check = async (name, run) => { await reset(); await run(); passed++; console.log(`PASS ${name}`); };
  const sync = (f, options = {}) => syncLiquidityReceipts(pool, { manifest: f.m, clients: f.clients, ...options });
  const rejectsEmpty = async (f, match) => { await assert.rejects(sync(f), match); assert.equal(await count('liquidity_sync_cursors'), 0); assert.equal(await count('liquidity_flow_receipts'), 0); assert.equal(await count('liquidity_settlements'), 0); };
  try {
    await check('nested permissionless native sweep books exact wei and canonical time', async () => {
      const f = fixture(); const result = await sync(f);
      assert.equal(result.caughtUp, true); assert.equal(result.booked, 1);
      const revenue = (await pool.query('SELECT rwa_eth,created_at FROM rwa_revenue')).rows[0];
      assert.equal(revenue.rwa_eth, '0.000000000000000002');
      assert.equal(revenue.created_at.getTime(), Number(TIME + 100n) * 1000);
      assert.equal((await sync(f)).reason, 'caught_up'); assert.equal(await count('rwa_revenue'), 1);
    });
    await check('OMR hook sweep proves all four deliveries without fabricating native revenue', async () => {
      const logs = Object.keys(recipients).map((key, i) => transfer('hook', recipients[key], BigInt(i + 1), i));
      logs.push(swept(4, {}, { currency: addr('omr') }));
      assert.equal((await sync(fixture(logs))).booked, 1);
      assert.equal(await count('rwa_revenue'), 0); assert.equal(await count('community_revenue'), 0);
    });
    await check('missing OMR fee deliveries reject a forged event and keep the cursor', async () => {
      await rejectsEmpty(fixture([swept(0, {}, { currency: addr('omr') })]), /delivery|Transfer/);
    });
    await check('POL collection and immediate nested token distribution settle in canonical order', async () => {
      const logs = [transfer('polVault', 'desk', 75n * ETH, 0), transfer('polVault', 'vig', 25n * ETH, 1),
        log('FeesCollected', { tokenId: 7n, nativeFees: ETH, omrFees: 100n * ETH }, 2, { emitter: 'polVault' }),
        ...tokenFill(1, 1n, 75n * ETH, 3), ...tokenFill(0, 1n, 25n * ETH, 5)];
      const result = await sync(fixture(logs, { reverse: true }));
      assert.equal(result.booked, 3);
      assert.equal((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr, '87.5');
      assert.equal((await pool.query('SELECT eth FROM pol_fees')).rows[0].eth, '0.75');
      assert.equal((await pool.query('SELECT vig_eth FROM vig_revenue')).rows[0].vig_eth, '0.25');
    });
    await check('one outer transaction may contain two independently delivered executor sequences', async () => {
      const f = fixture([...tokenFill(3, 1n, 5n * ETH, 0), ...tokenFill(3, 2n, 7n * ETH, 2)]);
      assert.equal((await sync(f)).booked, 2); assert.equal(await count('liquidity_settlements'), 2);
      assert.equal((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr, '0');
    });
    await check('one missing later delivery rolls back earlier receipt accounting and cursor', async () => {
      const logs = [swept(), ...tokenFill(1, 1n, ETH, 1)]; logs.splice(1, 1);
      await rejectsEmpty(fixture(logs), /delivery|Transfer/); assert.equal(await count('rwa_revenue'), 0);
    });
    await check('exact RPC duplicate logs are deduplicated', async () => {
      assert.equal((await sync(fixture([swept()], { duplicate: true }))).booked, 1);
    });
    await check('conflicting RPC duplicates cannot enter accounting', async () => {
      await rejectsEmpty(fixture([swept()], { conflict: true }), /unexpected_liquidity_log|conflicting_duplicate/);
    });
    await check('removed logs are rejected before cursor advancement', async () => {
      await rejectsEmpty(fixture([swept()], { removed: true }), /noncanonical/);
    });
    await check('wrong chain and historical code changes fail closed', async () => {
      await rejectsEmpty(fixture([swept()], { wrongChain: true }), /wrong_chain/);
      await rejectsEmpty(fixture([swept()], { badCode: true }), /historical_runtime/);
    });
    await check('historical fixed recipient mismatch cannot relabel native inflow', async () => {
      await rejectsEmpty(fixture([swept()], { wrongRecipient: true }), /historical_liquidity_binding/);
    });
    await check('same-block Hook recipient rotation and restoration cannot fabricate native revenue', async () => {
      const changed = log('RecipientsSet', { dev: a(901), rwa: a(902), community: a(903), lp: a(904) }, 0);
      const restored = log('RecipientsSet', recipients, 2);
      await rejectsEmpty(fixture([changed, swept(1), restored]), /hook_recipients_changed_in_sweep_block/);
      assert.equal(await count('rwa_revenue'), 0);
    });
    await check('changed canonical receipt hash and failed receipts are rejected', async () => {
      await rejectsEmpty(fixture([swept()], { receiptReorg: true }), /receipt_reorg/);
      await rejectsEmpty(fixture([swept()], { receiptFailed: true }), /invalid_liquidity_receipt/);
    });
    await check('an indexed log must exactly occur in its canonical receipt', async () => {
      await rejectsEmpty(fixture([swept()], { changedLog: true }), /indexed_log_missing/);
    });
    await check('partial provider pages cannot omit another supported event from a discovered receipt', async () => {
      await rejectsEmpty(fixture([swept(), swept(1)], { missingPageLog: true }), /incomplete_liquidity_log_page/);
    });
    await check('reorg observed after accounting rolls back both book and cursor', async () => {
      await rejectsEmpty(fixture([swept()], { reorgDuring: true }), /liquidity_page_reorg/);
      assert.equal(await count('rwa_revenue'), 0);
    });
    await check('a reorg behind the saved cursor is detected before scanning onward', async () => {
      await sync(fixture());
      await assert.rejects(sync(fixture([], { changedCursor: true })), /liquidity_cursor_reorg/);
      assert.equal((await pool.query('SELECT next_block FROM liquidity_sync_cursors')).rows[0].next_block, '102');
    });
    await check('backlog keeps caughtUp false and pages never exceed confirmed head', async () => {
      const f = fixture([], { latest: 105 });
      const first = await sync(f, { maxBlocks: 2 }); assert.equal(first.caughtUp, false); assert.equal(first.nextBlock, '102');
      const second = await sync(f, { maxBlocks: 2 }); assert.equal(second.caughtUp, false); assert.equal(second.nextBlock, '104');
      const final = await sync(f, { maxBlocks: 2 }); assert.equal(final.caughtUp, true); assert.equal(final.nextBlock, '105');
      assert.equal(f.counters.logs.at(-1).toBlock, 104n);
    });
    await check('same-transaction token flows can be replayed after cursor recovery without double credit', async () => {
      const f = fixture([...tokenFill(1, 1n, ETH, 0), ...tokenFill(1, 2n, ETH, 2)]);
      await sync(f); await pool.query('UPDATE liquidity_sync_cursors SET next_block=100,previous_block_hash=NULL');
      const again = await sync(f); assert.equal(again.booked, 0); assert.equal(again.duplicates, 2);
      assert.equal((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr, '2');
    });
    await check('POL principal and fee legs use separate receipt delivery segments', async () => {
      const logs = [transfer('polVault', 'poolManager', ETH, 0),
        log('LiquidityAdded', { tokenId: 7n, liquidityAdded: 100n, nativeUsed: ETH, omrUsed: ETH }, 1, { emitter: 'polVault' }),
        transfer('polVault', 'desk', 75n, 2), transfer('polVault', 'vig', 25n, 3),
        log('FeesCollected', { tokenId: 7n, nativeFees: 10n, omrFees: 100n }, 4, { emitter: 'polVault' }),
        log('InventoryFunded', { executor: addr('polBuyback'), nativeAmount: 9n }, 5, { emitter: 'polVault' })];
      assert.equal((await sync(fixture(logs))).booked, 3);
      assert.equal(await count('liquidity_flow_receipts'), 3);
    });
    await check('undeclared watched-currency events hold the whole page', async () => {
      const f = fixture([swept(0, {}, { currency: a(999) })]);
      await rejectsEmpty(f, /undeclared_liquidity_event/);
    });
    await check('historical Desk recovery uses only a preceding real price and preserves receipt time', async () => {
      await pool.query("INSERT INTO pol_fees(ref,eth,real) VALUES('seed',1,true)");
      for (const [id, price, timestamp] of [['prior', 50000, TIME + 50n], ['future', 1000, TIME + 200n]])
        await pool.query('INSERT INTO vig_buyback(id,eth_spent,omr_bought,price_omr_per_eth,to_reserve,to_prize,real,created_at) VALUES($1,0,0,$2,0,0,true,$3)', [id, price, new Date(Number(timestamp) * 1000)]);
      assert.equal((await sync(fixture(deskBuy()))).booked, 1);
      const booked = (await pool.query('SELECT anchor_eth_per_omr,at FROM desk_buys')).rows[0];
      assert.equal(booked.anchor_eth_per_omr, '0.00002'); assert.equal(booked.at.getTime(), Number(TIME + 100n) * 1000);
    });
    await check('a future Vig print cannot authorize historical Desk recovery', async () => {
      await pool.query("INSERT INTO pol_fees(ref,eth,real) VALUES('seed',1,true)");
      await pool.query("INSERT INTO vig_buyback(id,eth_spent,omr_bought,price_omr_per_eth,to_reserve,to_prize,real,created_at) VALUES('future',0,0,50000,0,0,true,$1)", [new Date(Number(TIME + 200n) * 1000)]);
      await rejectsEmpty(fixture(deskBuy()), /historical_desk_anchor_unavailable/);
      assert.equal(await count('desk_buys'), 0);
    });
    await check('an approved matching keeper journal supplies the historical Desk strategy', async () => {
      await pool.query("INSERT INTO pol_fees(ref,eth,real) VALUES('seed',1,true)");
      await pool.query(`INSERT INTO keeper_transactions(id,chain_id,wallet,target,target_code_hash,job_key,action_hash,nonce,raw_tx,tx_hash,request_json,budget_json,metadata_json,gas_limit,max_fee_per_gas,priority_fee_per_gas,confirmations,status)
        VALUES('desk-journal',4663,$1,$2,$3,'buyback1',$4,1,'0x',$5,'{}','[]',$6,'100000','1000','100',2,'confirmed')`,
        [KEEPER, addr('desk'), RUNTIME, h(222), h(1), JSON.stringify({ kind: 'buyback', stream: 1, jobId: 'buyback1', anchorEthPerOmr: 0.00002, strategyMinOutWei: String(99n * ETH) })]);
      assert.equal((await sync(fixture(deskBuy()))).booked, 1);
      assert.equal((await pool.query('SELECT anchor_eth_per_omr FROM desk_buys')).rows[0].anchor_eth_per_omr, '0.00002');
    });
    await check('PostgreSQL micro-unit credits never exceed a large exact physical delivery', async () => {
      const micros = 9_000_000_000_000_001n;
      assert.equal((await sync(fixture(tokenFill(1, 1n, micros * 10n ** 12n, 0)))).booked, 1);
      assert.equal((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr, '9000000000.000001');
    });
    await check('sub-micro physical token receipts settle with zero signable credit', async () => {
      assert.equal((await sync(fixture(tokenFill(1, 1n, 1n, 0)))).booked, 1);
      assert.equal((await pool.query('SELECT funded_omr FROM chain_reserve WHERE id=1')).rows[0].funded_omr, '0');
      assert.equal((await pool.query('SELECT omr_wei FROM liquidity_settlements')).rows[0].omr_wei, '1');
    });
    await check('two independent processes serialize on PostgreSQL domain locks and settle once', async () => {
      const lock = await pool.connect(), domain = liquidityIndexerDomain(manifest());
      const key = createHash('sha256').update(domain).digest().readInt32BE(0);
      const children = [];
      try {
        await lock.query('BEGIN'); await lock.query('SELECT pg_advisory_xact_lock($1,$2)', [0x4c514958, key]);
        for (let i = 0; i < 2; i++) children.push(new Promise((resolve, reject) => {
          const child = spawn(process.execPath, [new URL(import.meta.url).pathname.replace(/^\/(.:\/)/, '$1'), '--concurrency-worker'], { env: process.env, windowsHide: true });
          let output = ''; child.stdout.on('data', (s) => { output += s; }); child.stderr.on('data', (s) => { output += s; });
          child.on('error', reject); child.on('exit', (code) => code ? reject(new Error(`concurrency worker failed: ${output}`)) : resolve(output));
        }));
        let waiters = 0;
        for (let i = 0; i < 100 && waiters < 2; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          waiters = Number((await pool.query("SELECT COUNT(*) n FROM pg_stat_activity WHERE datname=current_database() AND wait_event='advisory' AND query LIKE '%pg_advisory_xact_lock%'")).rows[0].n);
        }
        assert.equal(waiters, 2, 'both independent workers must wait on the held PostgreSQL lock');
        await lock.query('COMMIT');
        const outputs = await Promise.all(children), results = outputs.map((s) => JSON.parse(s.split('RESULT ')[1].trim()));
        assert.equal(results.reduce((n, r) => n + (r.booked || 0), 0), 1);
        assert.equal(await count('liquidity_flow_receipts'), 1); assert.equal(await count('rwa_revenue'), 1);
      } finally { await lock.query('ROLLBACK'); lock.release(); }
    });
    console.log(JSON.stringify({ suite: 'canonical liquidity indexer', passed, postgres: true, rpc: 'deterministic fixture', crossProcessLock: true }));
  } finally { await pool.end(); }
}
