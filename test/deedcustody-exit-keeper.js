// Adversarial keeper regressions with real EIP-712 owner signatures and the
// durable EIP-1559 journal. Deterministic RPC receipts; no network sends.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { newDb } from 'pg-mem';
import { ContractFunctionRevertedError, decodeFunctionData, keccak256, parseTransaction,
  recoverTransactionAddress, recoverTypedDataAddress, zeroHash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { DEED_CUSTODY_ABI, runCharacterDeedKeeper } from '../src/deedcustodychain.js';

const schema = fs.readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
const keeperSchema = schema.match(/CREATE TABLE IF NOT EXISTS keeper_transactions \([\s\S]*?\n\);/)?.[0];
const custodySchema = schema.match(/-- Character-life deed custody\.[\s\S]*?-- End character-life deed custody\./)?.[0];
assert(keeperSchema && custodySchema);
const addr = n => `0x${BigInt(n).toString(16).padStart(40, '0')}`;
const code = '0x60006000';
const config = { address: addr(99), deed: addr(98), dynasty: addr(97), implementation: addr(96), omr: addr(93),
  chainId: 4663, confirmations: 1, startBlock: 1n, codeHash: keccak256(code) };
const owner = privateKeyToAccount(`0x${'1a'.repeat(32)}`);
const attacker = privateKeyToAccount(`0x${'1b'.repeat(32)}`);
const operator = privateKeyToAccount(`0x${'17'.repeat(32)}`);
const lifeHash = `0x${'a'.repeat(64)}`;
const exitTypes = { ExitRequest: [
  { name: 'lifeId', type: 'bytes32' }, { name: 'deedId', type: 'uint256' },
  { name: 'nonce', type: 'uint256' }, { name: 'issuedAt', type: 'uint256' },
  { name: 'deadline', type: 'uint256' },
] };
const domain = { name: 'OmertaDeedCustody', version: '1', chainId: config.chainId, verifyingContract: config.address };
const env = {
  CHARACTER_DEED_MAX_GAS: '100000', CHARACTER_DEED_MAX_FEE_WEI: '10',
  CHARACTER_DEED_PRIORITY_FEE_WEI: '1', CHARACTER_DEED_DAILY_GAS_WEI: '10000000',
  ERC6551_REGISTRY: addr(94), ERC6551_SALT: zeroHash, NODE_ENV: 'test', DATABASE_URL: undefined,
};
const before = Object.fromEntries(Object.keys(env).map(key => [key, process.env[key]]));
for (const [key, value] of Object.entries(env)) {
  if (value === undefined) delete process.env[key]; else process.env[key] = value;
}

async function fixture() {
  const db = newDb();
  db.public.none(keeperSchema);
  db.public.none(custodySchema);
  db.public.none(`CREATE TABLE characters(id TEXT PRIMARY KEY,alive BOOLEAN);
    CREATE TABLE dynasty_tokens(token_id TEXT PRIMARY KEY,account_id TEXT);`);
  const adapter = db.adapters.createPg(), pool = new adapter.Pool();
  await pool.query("INSERT INTO characters VALUES ('living-life',true)");
  await pool.query(`INSERT INTO character_deed_lives(life_id,life_hash,account_id,generation,status,custody_address,dynasty_token_id)
    VALUES ('living-life',$1,'account',1,'alive',$2,'1')`, [lifeHash, addr(1)]);
  let nonce = 0, head = 100n, chainTime = BigInt(Math.floor(Date.now() / 1000));
  const receipts = new Map(), sends = [], simulations = [];
  const blockTimes = new Map();
  const controls = { noMine: false, rpcFailure: false };
  const blockHash = n => `0x${BigInt(n).toString(16).padStart(64, '0')}`;
  async function mine(raw) {
    const tx = parseTransaction(raw), hash = keccak256(raw);
    const call = decodeFunctionData({ abi: DEED_CUSTODY_ABI, data: tx.data });
    const [intent, signature] = call.args;
    const signer = await recoverTypedDataAddress({ domain, types: exitTypes, primaryType: 'ExitRequest', message: intent, signature });
    const status = signer.toLowerCase() === owner.address.toLowerCase()
      && chainTime >= intent.issuedAt && chainTime <= intent.deadline ? 'success' : 'reverted';
    ++head; nonce = Number(tx.nonce) + 1;
    blockTimes.set(String(head), chainTime);
    receipts.set(hash, { transactionHash: hash, from: await recoverTransactionAddress({ serializedTransaction: raw }),
      to: tx.to, blockNumber: head, blockHash: blockHash(head), status,
      gasUsed: 45000n, effectiveGasPrice: 1n, logs: [] });
  }
  const pub = {
    getChainId: async () => config.chainId, getCode: async () => code, getBlockNumber: async () => head,
    getBlock: async ({ blockNumber }) => ({ number: blockNumber, hash: blockHash(blockNumber),
      timestamp: blockTimes.get(String(blockNumber)) || chainTime }),
    getTransactionCount: async () => nonce, estimateGas: async () => 50000n,
    readContract: async ({ functionName }) => {
      if (functionName === 'lifeState') return { account: addr(1), wallet: owner.address, dynastyId: 1n,
        dead: false, killer: zeroHash, deathSequence: 0n };
      return { deed: config.deed, dynasty: config.dynasty, accountImplementation: config.implementation,
        lifecycleOperator: operator.address, accountRegistry: addr(94), equippedLife: lifeHash, ESTATE_DELAY: 86400n,
        activeLifeByDynasty: lifeHash, exitNonce: 0n, omr:config.omr, volumeSource:addr(92),
        volumeSourceRuntimeHash:keccak256(code), settlementManager:addr(92) }[functionName];
    },
    simulateContract: async ({ functionName, args, account }) => {
      assert.equal(functionName, 'unequip');
      assert.equal(account, operator.address);
      const [message, signature] = args;
      simulations.push(String(message.deedId));
      if (controls.rpcFailure) throw new Error('temporary RPC failure');
      const signer = await recoverTypedDataAddress({ domain, types: exitTypes, primaryType: 'ExitRequest', message, signature });
      if (signer.toLowerCase() !== owner.address.toLowerCase()) {
        // Real viem error, nested exactly as a contract-execution wrapper is.
        throw new Error('contract execution rejected', { cause: new ContractFunctionRevertedError({
          abi: DEED_CUSTODY_ABI, functionName, message: 'DC: owner signature',
        }) });
      }
      return { request: { functionName, args } };
    },
    getTransactionReceipt: async ({ hash }) => {
      if (!receipts.has(hash)) throw Object.assign(new Error('not found'), { name: 'TransactionReceiptNotFoundError' });
      return receipts.get(hash);
    },
    sendRawTransaction: async ({ serializedTransaction: raw }) => {
      const hash = keccak256(raw);
      const saved = (await pool.query('SELECT raw_tx FROM keeper_transactions WHERE tx_hash=$1', [hash])).rows[0];
      assert.equal(saved?.raw_tx, raw, 'exact signed transaction is durable before broadcasting');
      assert.equal(parseTransaction(raw).type, 'eip1559');
      sends.push(raw);
      if (!controls.noMine) await mine(raw);
      return hash;
    },
  };
  const clients = { account: operator, publicClient: pub, walletClient: {
    prepareTransactionRequest: async request => request,
    signTransaction: async request => operator.signTransaction(request),
  } };
  const now = Math.floor(Date.now() / 1000);
  async function addExit(tokenId, { signed = true, expired = false, invalidOwner = false, age = 20 } = {}) {
    const request = { lifeId: lifeHash, deedId: BigInt(tokenId), nonce: 0n,
      issuedAt: BigInt(now - age), deadline: BigInt(expired ? now - 1 : now + 180) };
    const signer = invalidOwner ? attacker : owner;
    const signature = signed ? await signer.signTypedData({ domain, types: exitTypes, primaryType: 'ExitRequest', message: request }) : null;
    const requested = new Date((now - 90000) * 1000), available = new Date((now - 3600) * 1000);
    await pool.query(`INSERT INTO character_deed_exits(life_id,deed_token_id,status,requested_at,available_at,
      user_nonce,user_issued_at,user_deadline,user_signature) VALUES ('living-life',$1,'pending',$2,$3,'0',$4,$5,$6)`,
    [String(tokenId), requested, available, String(request.issuedAt), String(request.deadline), signature]);
    await pool.query(`INSERT INTO character_deed_equipment(deed_token_id,life_hash,active,ref,tx_hash,last_block_number,last_log_index)
      VALUES ($1,$2,true,$3,$4,1,0)`, [String(tokenId), lifeHash, `equip-${tokenId}`, `0x${'22'.repeat(32)}`]);
    return { request, signature, requested, available };
  }
  const row = async tokenId => (await pool.query('SELECT * FROM character_deed_exits WHERE deed_token_id=$1', [String(tokenId)])).rows[0];
  return { pool, pub, clients, controls, sends, simulations, mine, addExit, row,
    advanceTime: seconds => { chainTime += BigInt(seconds); },
    run: () => runCharacterDeedKeeper(pool, { config, clients }) };
}

try {
  // More than a batch of ineligible rows precede both eligible intents. A bad
  // older owner's signature must neither consume a nonce nor starve a valid one.
  {
    const f = await fixture();
    try {
      for (let i = 1; i <= 101; ++i) await f.addExit(i, { signed: false, age: 100 });
      for (let i = 102; i <= 202; ++i) await f.addExit(i, { expired: true, age: 100 });
      const invalid = await f.addExit(203, { invalidOwner: true, age: 50 });
      await f.addExit(204, { age: 20 });
      const oldBoundedRows = (await f.pool.query("SELECT deed_token_id FROM character_deed_exits WHERE status='pending' ORDER BY user_issued_at LIMIT 100")).rows;
      assert(!oldBoundedRows.some(row => row.deed_token_id === '204'), 'legacy unfiltered bounded query starves the valid exit');
      const result = await f.run();
      assert.equal(result.state, 'settled');
      assert.deepEqual(f.simulations, ['203', '204'], 'unsigned/expired rows are filtered before LIMIT; contract rejection continues to next valid consent');
      const rejected = await f.row(203);
      assert.equal(rejected.status, 'pending');
      assert.equal(rejected.user_signature, null, 'invalid consent cannot poison later ticks');
      assert.equal(rejected.available_at.getTime(), invalid.available.getTime(), 'completed notice survives bad consent');
      assert.equal((await f.row(204)).status, 'releasing');
      assert.equal(f.sends.length, 1);
      const tx = parseTransaction(f.sends[0]);
      assert.equal(Number(tx.nonce), 0, 'bad owner signature consumes no operator wallet nonce');
      assert.equal(decodeFunctionData({ abi: DEED_CUSTODY_ABI, data: tx.data }).args[0].deedId, 204n);
      assert.equal((await f.pool.query('SELECT count(*) AS n FROM keeper_transactions')).rows[0].n, 1);
    } finally { await f.pool.end(); }
  }
  // Network errors are not proof of a bad owner intent. No consent is discarded
  // and no later user is sent while this attempt has an unresolved RPC failure.
  {
    const f = await fixture();
    try {
      const first = await f.addExit(301, { age: 50 });
      await f.addExit(302, { age: 20 });
      f.controls.rpcFailure = true;
      await assert.rejects(f.run, /temporary RPC failure/);
      assert.equal((await f.row(301)).user_signature, first.signature);
      assert.deepEqual(f.simulations, ['301']);
      assert.equal(f.sends.length, 0);
    } finally { await f.pool.end(); }
  }
  // A valid simulation can become stale before mining. Exercise durable signed
  // transport through submitted -> mined revert -> recovery, for live and dead
  // characters; neither recovery grants asset release nor restarts the notice.
  for (const alive of [true, false]) {
    const f = await fixture();
    try {
      const intent = await f.addExit(401);
      f.controls.noMine = true;
      const submitted = await f.run();
      assert.equal(submitted.state, 'submitted');
      assert.equal((await f.row(401)).status, 'releasing');
      if (!alive) {
        await f.pool.query("UPDATE characters SET alive=false WHERE id='living-life'");
        await f.pool.query("UPDATE character_deed_lives SET status='dead' WHERE life_id='living-life'");
      }
      f.advanceTime(301);
      await f.mine(f.sends[0]);
      const receipt = await f.pub.getTransactionReceipt({ hash: keccak256(f.sends[0]) });
      assert.equal(receipt.status, 'reverted', 'independent chain-time check rejects the formerly valid intent');
      assert((await f.pub.getBlock({ blockNumber: receipt.blockNumber })).timestamp > intent.request.deadline);
      const recovered = await f.run();
      assert.equal(recovered.state, 'reverted');
      const exit = await f.row(401);
      assert.equal(exit.status, alive ? 'pending' : 'cancelled');
      for (const key of ['user_signature', 'user_nonce', 'user_issued_at', 'user_deadline', 'tx_hash'])
        assert.equal(exit[key], null, `reverted transaction clears ${key}`);
      assert.equal(exit.available_at.getTime(), intent.available.getTime());
      assert.equal(exit.requested_at.getTime(), intent.requested.getTime());
      assert.equal((await f.pool.query("SELECT active FROM character_deed_equipment WHERE deed_token_id='401'")).rows[0].active, true);
      assert.equal((await f.pool.query('SELECT status FROM keeper_transactions')).rows[0].status, 'reverted');
      assert.equal(f.sends.length, 1, 'recovery does not broadcast a replacement or release assets');
    } finally { await f.pool.end(); }
  }
  console.log('deedcustody-exit-keeper: PASS (204-row starvation proof, nested real contract revert, valid signed journal send, transient RPC preservation, submitted/mined-reverted live/dead recovery with unchanged notice and locked equipment)');
} finally {
  for (const [key, value] of Object.entries(before)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
}
