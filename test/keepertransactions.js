// Deterministic RPC failures with real EIP-1559 signatures and the real journal schema.
// Set DATABASE_URL to the isolated test database to also exercise PostgreSQL advisory locks.
import assert from 'node:assert/strict';
import { keccak256, parseTransaction, recoverTransactionAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { makeDb } from '../src/db.js';
import { keeperTransactionStatus, reconcileKeeperTransactions, runKeeperTransaction } from '../src/keepertransactions.js';

const pool = await makeDb();
await pool.query('CREATE TABLE IF NOT EXISTS keeper_transport_test_bookings (id TEXT PRIMARY KEY, amount TEXT NOT NULL)');
const CODE = '0x60006000';
const TARGET = `0x${'d'.repeat(40)}`;
const CHAIN = 4663;
let caseIndex = 0;
const cases = [];
const check = (label) => { cases.push(label); console.log(`PASS ${label}`); };

function fixture(controls = {}) {
  // Public test-only keys; unique wallets isolate cases even on the same PostgreSQL database.
  const scalar = BigInt(Date.now()) * 100n + BigInt(++caseIndex);
  const account = privateKeyToAccount(`0x${scalar.toString(16).padStart(64, '0')}`);
  let chainId = CHAIN, nonce = 0, pending = 0, head = 100n, signed = 0, sent = 0;
  const receipts = new Map(), blocks = new Map(), rawSends = [];
  const blockHash = (n) => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
  const pub = {
    getChainId: async () => chainId,
    getCode: async () => controls.code || CODE,
    getBlockNumber: async () => head,
    getBlock: async ({ blockNumber }) => ({ number: blockNumber, hash: blocks.get(String(blockNumber)) || blockHash(blockNumber), timestamp: 1000n }),
    getTransactionCount: async ({ blockTag }) => blockTag === 'pending' ? pending : nonce,
    estimateGas: async () => {
      if (controls.pauseEstimate) await controls.pauseEstimate;
      if (controls.simulationFails) throw new Error('simulation refused');
      return 50_000n;
    },
    getTransactionReceipt: async ({ hash }) => {
      if (controls.receiptRpcFails) throw new Error('temporary RPC failure');
      if (controls.hideReceipt || !receipts.has(hash)) throw Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' });
      return receipts.get(hash);
    },
    sendRawTransaction: async ({ serializedTransaction }) => {
      sent++; rawSends.push(serializedTransaction);
      const hash = keccak256(serializedTransaction);
      const stored = (await pool.query('SELECT raw_tx,tx_hash,status FROM keeper_transactions WHERE tx_hash=$1', [hash])).rows[0];
      assert.equal(stored.raw_tx, serializedTransaction, 'raw bytes are durably stored before broadcast');
      if (controls.failBeforeSend) { controls.failBeforeSend--; throw new Error('send timed out before reaching node'); }
      const tx = parseTransaction(serializedTransaction);
      pending = Math.max(pending, Number(tx.nonce) + 1);
      if (!controls.noMine && !receipts.has(hash)) {
        head++;
        nonce = pending;
        blocks.set(String(head), blockHash(head));
        receipts.set(hash, { transactionHash: hash, from: await recoverTransactionAddress({ serializedTransaction }),
          to: tx.to, blockNumber: head, blockHash: blockHash(head), status: controls.revert ? 'reverted' : 'success',
          gasUsed: 45_000n, effectiveGasPrice: 1n, logs: [] });
      }
      if (controls.failAfterSend) { controls.failAfterSend--; throw new Error('send response lost after reaching node'); }
      return controls.wrongHash ? blockHash(987) : hash;
    },
  };
  const walletClient = {
    prepareTransactionRequest: async (request) => request,
    signTransaction: async (request) => {
      signed++;
      return account.signTransaction(controls.mutateSigned ? { ...request, to: `0x${'e'.repeat(40)}` } : request);
    },
  };
  const clients = { publicClient: pub, walletClient, account };
  const options = (extra = {}) => ({ chainId: CHAIN, wallet: account.address, clients, target: TARGET,
    targetCodeHash: keccak256(CODE), jobKey: 'hook:eth:epoch:1', request: { data: '0x12345678', value: 0n },
    maxGas: 100_000n, maxFeePerGas: 10n, maxPriorityFeePerGas: 1n, confirmations: 1, retryMs: 0,
    gasBudget: { key: 'gas', period: 'day:1', limit: '10000000' },
    budgets: [{ key: 'vig', period: 'day:1', amount: '100', limit: '200' }], ...extra });
  return { controls, clients, options, receipts, blocks, rawSends,
    counts: () => ({ signed, sent, nonce, pending }),
    setNonce: (n) => { nonce = n; pending = Math.max(pending, n); },
    setPending: (n) => { pending = n; },
    setChain: (n) => { chainId = n; },
    advance: (n = 1) => { head += BigInt(n); },
    resume: (extra = {}) => reconcileKeeperTransactions(pool, { chainId: CHAIN, wallet: account.address, clients,
      allowedTargets: { [TARGET]: keccak256(CODE) }, retryMs: 0, ...extra }),
  };
}

try {
  {
    const f = fixture(); let booked=0,checked=0;
    const onConfirmed=async()=>{booked++;return {settled:true};};
    const metadata={kind:'hook_sweep',asset:'native',recipients:{dev:TARGET,rwa:TARGET,community:TARGET,lp:TARGET}};
    const first=await runKeeperTransaction(pool,f.options({metadata,accountingRequired:true,onConfirmed}));
    assert.equal(first.state,'confirmed');assert.equal(first.reason,'pre_settlement_verifier_required');assert.equal(booked,0);
    assert.equal((await f.resume({onConfirmed,preSettlement:async()=>({required:false})})).reason,'pre_settlement_verifier_required');
    const refused=await f.resume({onConfirmed,preSettlement:async(row,receipt)=>{
      checked++;assert.equal(row.metadata.kind,'hook_sweep');assert.equal(receipt.blockTimestamp,1000n);
      assert.equal(booked,0);throw Object.assign(new Error('rotation'),{keeperCode:'hook_recipient_rotation_in_block'});
    }});
    assert.equal(refused.state,'confirmed');assert.equal(refused.reason,'hook_recipient_rotation_in_block');
    assert.equal(booked,0);assert.equal(f.counts().signed,1);assert.equal(f.counts().sent,1);
    assert.equal((await runKeeperTransaction(pool,f.options({jobKey:'sibling'}))).reason,'wallet_has_pending_transaction');
    assert.equal((await f.resume({onConfirmed,preSettlement:async()=>{checked++;return {verified:true};}})).state,'settled');
    assert.equal(booked,1);assert.equal(checked,2);assert.equal(f.counts().sent,1);
    check('native Hook settlement requires historical proof; rotation/RPC refusal holds revenue and wallet until verified without rebroadcast');
  }
  {
    const f=fixture();let booked=0;
    const result=await runKeeperTransaction(pool,f.options({accountingRequired:true,onConfirmed:async()=>{booked++;return {settled:true};},
      preSettlement:async(_row,receipt)=>{f.blocks.set(String(receipt.blockNumber),`0x${'f'.repeat(64)}`);return {verified:true};}}));
    assert.equal(result.state,'reorged');assert.equal(result.reason,'receipt_changed_during_verification');assert.equal(booked,0);
    check('canonical receipt is rechecked after historical RPC proof before opening bookkeeping transaction');
  }
  {
    const f = fixture();
    let booked = 0;
    const onConfirmed = async (q, row, receipt) => {
      assert.equal(receipt.blockTimestamp, 1000n, 'bookkeeping uses canonical chain time, not restart wall time');
      booked++; await q.query('INSERT INTO keeper_transport_test_bookings (id,amount) VALUES ($1,$2)', [row.id, '100']); return { settled: true };
    };
    const first = await runKeeperTransaction(pool, f.options({ accountingRequired: true, onConfirmed }));
    assert.equal(first.state, 'settled');
    assert.equal((await runKeeperTransaction(pool, f.options({ accountingRequired: true, onConfirmed }))).state, 'settled');
    assert.equal(booked, 1);
    assert.deepEqual(f.counts(), { signed: 1, sent: 1, nonce: 1, pending: 1 });
    assert.equal((await runKeeperTransaction(pool, f.options({ request: { data: '0xabcdef01', value: 0n } }))).reason, 'action_rebound');
    const status = await keeperTransactionStatus(pool, { chainId: CHAIN, wallet: f.clients.account.address });
    assert.equal(JSON.stringify(status).includes('raw_tx'), false);
    assert.equal(JSON.stringify(status).includes(f.rawSends[0]), false);
    assert.equal(status[0].receipt.blockTimestamp,'1000');
    assert.equal((await keeperTransactionStatus(pool,{chainId:CHAIN,wallet:f.clients.account.address,jobKeys:[first.jobKey]})).length,1);
    assert.equal((await keeperTransactionStatus(pool,{chainId:CHAIN,wallet:f.clients.account.address,jobKeys:['unknown']})).length,0);
    check('real signed request persists before send; replay settles once; payload rebinding and raw status leakage refused');
  }
  {
    const f = fixture({ failBeforeSend: 1 });
    const first = await runKeeperTransaction(pool, f.options());
    assert.equal(first.state, 'ambiguous');
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'pol:second' }))).reason, 'wallet_has_pending_transaction');
    const recovered = await f.resume();
    assert.equal(recovered.state, 'settled');
    assert.equal(f.counts().signed, 1);
    assert.equal(f.rawSends.length, 2);
    assert.equal(f.rawSends[0], f.rawSends[1]);
    check('timeout before broadcast retries identical signed bytes and blocks sibling jobs');
  }
  {
    const f = fixture({ failAfterSend: 1 });
    assert.equal((await runKeeperTransaction(pool, f.options())).state, 'settled');
    assert.equal(f.counts().sent, 1);
    check('lost response after broadcast reconciles exact receipt without a second action');
  }
  {
    const f = fixture({ noMine: true });
    assert.equal((await runKeeperTransaction(pool, f.options())).state, 'submitted');
    f.setNonce(1);
    assert.equal((await f.resume()).state, 'nonce_conflict');
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'next' }))).state, 'blocked');
    assert.equal(f.counts().signed, 1);
    assert.equal(f.counts().sent, 1);
    check('consumed nonce without our receipt halts the wallet and never signs a replacement');
  }
  {
    const f = fixture({ noMine: true });
    const first = await runKeeperTransaction(pool, f.options());
    f.controls.noMine = false;
    assert.equal((await f.resume()).state, 'settled');
    assert.equal(f.counts().signed, 1);
    assert.equal(f.rawSends[0], f.rawSends[1]);
    assert.equal(first.nonce, 0);
    check('pending transaction restart retries the same nonce/hash/bytes');
  }
  {
    const f = fixture();
    const first = await runKeeperTransaction(pool, f.options({ confirmations: 3 }));
    assert.equal(first.state, 'mined');
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'next' }))).state, 'blocked');
    f.advance(2);
    assert.equal((await f.resume()).state, 'settled');
    const receipt = f.receipts.get(first.txHash);
    f.blocks.set(String(receipt.blockNumber), `0x${'f'.repeat(64)}`);
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'next' }))).state, 'reorged');
    assert.equal(f.counts().signed, 1);
    check('confirmation depth precedes settlement; changed finalized block halts future sends');
  }
  {
    const f = fixture();
    const first = await runKeeperTransaction(pool, f.options({ confirmations: 3 }));
    f.blocks.set(first.blockNumber, `0x${'c'.repeat(64)}`);
    assert.equal((await f.resume()).state, 'reorged');
    assert.equal(f.counts().sent, 1);
    check('pre-finality reorg does not book or rebroadcast under uncertain authority');
  }
  {
    const f = fixture({ revert: true });
    let called = 0;
    assert.equal((await runKeeperTransaction(pool, f.options({ onConfirmed: async () => { called++; } }))).state, 'reverted');
    assert.equal(called, 0);
    f.controls.revert = false;
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'retry:new-state', budgets: [{ key: 'vig', period: 'day:1', amount: '200', limit: '200' }] }))).state, 'settled');
    check('finalized revert never books and releases asset reservation while retaining gas budget');
  }
  {
    const f = fixture();
    assert.equal((await runKeeperTransaction(pool, f.options())).state, 'settled');
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'next', budgets: [{ key: 'vig', period: 'day:1', amount: '101', limit: '200' }] }))).reason, 'budget_exceeded');
    assert.equal(f.counts().signed, 1);
    check('confirmed spend and pending reservations share a bounded budget before signing');
  }
  {
    const f = fixture();
    let attempts = 0;
    const first = await runKeeperTransaction(pool, f.options({ accountingRequired: true,
      onConfirmed: async () => { attempts++; throw new Error('DB booking temporarily unavailable'); } }));
    assert.equal(first.state, 'confirmed');
    assert.equal(first.reason, 'accounting_failed');
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'next' }))).state, 'blocked');
    assert.equal((await f.resume({ onConfirmed: async (q, row) => {
      attempts++; await q.query('INSERT INTO keeper_transport_test_bookings (id,amount) VALUES ($1,$2)', [row.id, '100']); return { settled: true };
    } })).state, 'settled');
    assert.equal(attempts, 2);
    assert.equal(f.counts().signed, 1);
    check('failed database booking retains confirmed transaction and blocks all new wallet jobs until settled');
  }
  {
    const f = fixture();
    const held = await runKeeperTransaction(pool, f.options({ accountingRequired: true, onConfirmed: async () => ({ booked: true }) }));
    assert.equal(held.state, 'confirmed');
    assert.equal(held.reason, 'accounting_failed');
    assert.equal((await f.resume({ onConfirmed: async () => ({ settled: true }) })).state, 'settled');
    f.setNonce(5);
    assert.equal((await runKeeperTransaction(pool, f.options({ jobKey: 'after-external-spend' }))).reason, 'unknown_consumed_nonce');
    assert.equal(f.counts().signed, 1);
    check('required typed settlement acknowledgement and unjournaled consumed nonces fail closed');
  }
  {
    const f = fixture({ mutateSigned: true });
    assert.equal((await runKeeperTransaction(pool, f.options())).reason, 'journal_integrity');
    assert.equal(f.counts().sent, 0);
    const wrong = fixture(); wrong.setChain(1);
    assert.equal((await runKeeperTransaction(pool, wrong.options())).reason, 'wrong_chain');
    const changed = fixture({ code: '0x6010' });
    assert.equal((await runKeeperTransaction(pool, changed.options())).reason, 'target_code_mismatch');
    const unknown = fixture(); unknown.setPending(1);
    assert.equal((await runKeeperTransaction(pool, unknown.options())).reason, 'unknown_pending_nonce');
    check('wrong chain, changed runtime, tampered signed payload and external pending nonce refuse before send');
  }
  {
    let release;
    const paused = new Promise((resolve) => { release = resolve; });
    const f = fixture({ pauseEstimate: paused });
    const first = runKeeperTransaction(pool, f.options());
    await new Promise((resolve) => setTimeout(resolve, 20));
    const second = await runKeeperTransaction(pool, f.options({ jobKey: 'parallel' }));
    assert.equal(second.state, 'locked');
    release();
    assert.equal((await first).state, 'settled');
    assert.equal(f.counts().signed, 1);
    check('concurrent same-process jobs serialize across the entire wallet nonce domain');
  }
  {
    const f=fixture();
    const policy={budgets:[],gasBudget:{key:'history-gas',period:'day:1',limit:'1000000000'}};
    const oldest=await runKeeperTransaction(pool,f.options({...policy,jobKey:'long-cadence:1'}));
    assert.equal(oldest.state,'settled');
    for(let i=0;i<101;i++)assert.equal((await runKeeperTransaction(pool,f.options({...policy,jobKey:`short-cadence:${i}`}))).state,'settled');
    const recent=await keeperTransactionStatus(pool,{chainId:CHAIN,wallet:f.clients.account.address});
    assert.equal(recent.length,100);assert(!recent.some(row=>row.jobKey==='long-cadence:1'));
    const exact=await keeperTransactionStatus(pool,{chainId:CHAIN,wallet:f.clients.account.address,jobKeys:['long-cadence:1']});
    assert.equal(exact.length,1);assert.equal(exact[0].txHash,oldest.txHash);
    check('exact planning keys retain long-cadence action authority beyond the 100-row status window');
  }
  if (process.env.DATABASE_URL) {
    const rollback = fixture();
    const failed = await runKeeperTransaction(pool, rollback.options({ accountingRequired: true,
      onConfirmed: async (q, row) => {
        await q.query('INSERT INTO keeper_transport_test_bookings (id,amount) VALUES ($1,$2)', [row.id, '100']);
        throw new Error('crash after bookkeeping before marker');
      } }));
    assert.equal(failed.state, 'confirmed');
    assert.equal((await pool.query('SELECT id FROM keeper_transport_test_bookings WHERE id=$1', [failed.id])).rows.length, 0);
    assert.equal((await rollback.resume({ onConfirmed: async (q, row) => {
      await q.query('INSERT INTO keeper_transport_test_bookings (id,amount) VALUES ($1,$2)', [row.id, '100']);
      return { settled: true };
    } })).state, 'settled');
    check('PostgreSQL rollback atomically undoes bookkeeping before retry and final journal settlement');
    const independent = await import(`../src/keepertransactions.js?independent=${Date.now()}`);
    let release;
    const paused = new Promise((resolve) => { release = resolve; });
    const f = fixture({ pauseEstimate: paused });
    const first = runKeeperTransaction(pool, f.options());
    await new Promise((resolve) => setTimeout(resolve, 50));
    const second = await independent.runKeeperTransaction(pool, f.options({ jobKey: 'other-worker' }));
    assert.equal(second.state, 'locked');
    release();
    assert.equal((await first).state, 'settled');
    assert.equal(f.counts().signed, 1);
    check('PostgreSQL advisory lock serializes independent worker module instances');
  }
  console.log(`PASS keeper transport: ${cases.length} cases (${process.env.DATABASE_URL ? 'PostgreSQL' : 'pg-mem'}); no live transactions`);
} finally { await pool.end(); }
