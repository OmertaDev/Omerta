import assert from 'node:assert/strict';
import { recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { makeDb } from '../src/db.js';
import { drainLiquidityQueue } from '../src/liquidityqueue.js';
import { buildLiquidityManifestExample } from '../tools/liquidity-manifest-example.js';

if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const url = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1'].includes(url.hostname));
  assert.equal(url.pathname, '/omerta_liquidity_indexer_test', 'use only the dedicated disposable indexer database');
}
const KEY = `0x${'0'.repeat(63)}1`; // public synthetic fixture; never read or replace a production key
const SIGNER = privateKeyToAccount(KEY).address;
const h = (n) => `0x${n.toString(16).padStart(64, '0')}`;
const manifest = buildLiquidityManifestExample({ placeholders: false });
const pool = await makeDb();
const envKeys = ['VOUCHER_SIGNER_PK', 'VOUCHER_CLAIM_ADDRESS', 'CHAIN_ID'];
const saved = Object.fromEntries(envKeys.map((key) => [key, process.env[key]]));
const configure = () => { process.env.VOUCHER_SIGNER_PK = KEY; process.env.VOUCHER_CLAIM_ADDRESS = manifest.contracts.claim.address; process.env.CHAIN_ID = String(manifest.chainId); };
const options = (clients) => ({ manifest, clients, indexed: { caughtUp: true }, keeperResult: { state: 'idle', alert: false } });
function fixture(changes = {}) {
  let reads = 0;
  const now = BigInt(Math.floor(Date.now() / 1000)), block = { number: 100n, hash: h(100), timestamp: now };
  const pub = {
    getChainId: async () => changes.wrongChain ? 1 : 4663,
    getBlock: async () => { reads++; return { ...block, timestamp: changes.stale ? now - 120n : now, hash: changes.reorg && reads > 1 ? h(999) : block.hash }; },
    getCode: async ({ address, blockNumber }) => { assert.ok([manifest.contracts.claim.address, manifest.contracts.omr.address].includes(address)); assert.equal(blockNumber, 100n); return changes.wrongCode ? '0x6001' : '0x60006000'; },
    readContract: async ({ functionName, blockNumber }) => {
      assert.equal(blockNumber, 100n);
      if (functionName === 'signer') return changes.wrongSigner ? manifest.keeper : SIGNER;
      if (functionName === 'owner') return changes.wrongOwner ? manifest.keeper : manifest.governanceSafe;
      if (functionName === 'omr') return changes.wrongToken ? manifest.contracts.oracle.address : manifest.contracts.omr.address;
      if (functionName === 'balanceOf') return changes.balanceWei ?? 10n ** 40n;
      if (functionName === 'paused') {
        if (changes.changeConfig) process.env.VOUCHER_CLAIM_ADDRESS = manifest.contracts.oracle.address;
        return !!changes.paused;
      }
      throw new Error(`Unhandled queue fixture read ${functionName}`);
    },
  };
  return { publicClient: pub };
}
let passed = 0, nonce = 0;
const add = async (amount, status = 'queued', claimed = false) => {
  const n = ++nonce;
  await pool.query('INSERT INTO vouchers(id,account_id,kind,amount,nonce,to_address,deadline,status,claimed_onchain,created_at) VALUES($1,$2,$3,$4,$5,$6,1,$7,$8,$9)',
    [`queue-${n}`, 'synthetic-account', 'omr', amount, n, `0x${'22'.repeat(20)}`, status, claimed, new Date(1_750_000_000_000 + n)]);
};
const queued = async () => Number((await pool.query("SELECT COUNT(*) n FROM vouchers WHERE status='queued'")).rows[0].n);
const check = async (name, run) => {
  configure(); nonce = 0; await pool.query('DELETE FROM vouchers'); await pool.query('UPDATE chain_reserve SET funded_omr=0 WHERE id=1');
  await run(); passed++; console.log(`PASS ${name}`);
};
try {
  await check('missing existing signer or extraction domain remains dormant without RPC or queue writes', async () => {
    await add('10');
    for (const key of envKeys) {
      configure(); delete process.env[key];
      const result = await drainLiquidityQueue({ connect: async () => { throw new Error('dormant queue touched DB'); } }, { manifest });
      assert.equal(result.enabled, false); assert.equal(result.signed, 0);
    }
    assert.equal(await queued(), 1);
  });
  await check('backlog and unresolved keeper receipts cannot cause signing', async () => {
    await add('10'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    for (const override of [{ indexed: { caughtUp: false } }, { keeperResult: { state: 'confirmed', alert: true } }])
      assert.equal((await drainLiquidityQueue(pool, { ...options(fixture()), ...override })).reason, 'liquidity_reconciliation_incomplete');
    assert.equal(await queued(), 1);
  });
  await check('funded existing queue drains FIFO with exact EIP-712 signer and domain', async () => {
    await add('10'); await add('95'); await add('1'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    assert.equal((await drainLiquidityQueue(pool, options(fixture()))).signed, 1); assert.equal(await queued(), 2);
    const row = (await pool.query("SELECT signed_payload FROM vouchers WHERE status='signed'")).rows[0];
    const payload = JSON.parse(row.signed_payload);
    assert.equal(payload.voucher.amount, '10000000000000000000');
    const recovered = await recoverTypedDataAddress({ domain: { name: 'OmertaVoucherClaim', version: '1', chainId: 4663, verifyingContract: manifest.contracts.claim.address },
      types: { Voucher: [{ name: 'to', type: 'address' }, { name: 'amount', type: 'uint256' }, { name: 'kind', type: 'uint8' }, { name: 'gearId', type: 'uint256' }, { name: 'nonce', type: 'uint256' }, { name: 'deadline', type: 'uint256' }] },
      primaryType: 'Voucher', message: payload.voucher, signature: payload.signature });
    assert.equal(recovered.toLowerCase(), SIGNER.toLowerCase());
    assert.equal((await drainLiquidityQueue(pool, options(fixture()))).signed, 0);
  });
  await check('already claimed obligations continue to consume lifetime funding', async () => {
    await add('90', 'claimed', true); await add('11'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    assert.equal((await drainLiquidityQueue(pool, options(fixture()))).signed, 0); assert.equal(await queued(), 1);
  });
  await check('physical claim balance bounds unclaimed signatures and new queue completion together', async () => {
    await add('90', 'signed'); await add('11'); await add('1'); await pool.query('UPDATE chain_reserve SET funded_omr=1000 WHERE id=1');
    assert.equal((await drainLiquidityQueue(pool, options(fixture({ balanceWei: 100n * 10n ** 18n })))).signed, 0);
    assert.equal(await queued(), 2);
    const deficit = await drainLiquidityQueue(pool, options(fixture({ balanceWei: 89n * 10n ** 18n })));
    assert.equal(deficit.alert, true); assert.equal(deficit.reason, 'physical_claim_backing_unavailable');
    assert.equal(await queued(), 2);
  });
  await check('claimed history is excluded from physical obligations but cannot restore lifetime capacity', async () => {
    await add('90', 'claimed', true); await add('10'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    assert.equal((await drainLiquidityQueue(pool, options(fixture({ balanceWei: 10n * 10n ** 18n })))).signed, 1);
    assert.equal(await queued(), 0);
  });
  await check('configured chain and claim must exactly match the approved manifest', async () => {
    await add('10');
    process.env.CHAIN_ID = '46630'; await assert.rejects(drainLiquidityQueue(pool, options(fixture())), /voucher_manifest_domain_mismatch/);
    configure(); process.env.VOUCHER_CLAIM_ADDRESS = manifest.contracts.oracle.address;
    await assert.rejects(drainLiquidityQueue(pool, options(fixture())), /voucher_manifest_domain_mismatch/);
    assert.equal(await queued(), 1);
  });
  await check('wrong RPC chain, runtime, signer, token and owner preserve all queued requests', async () => {
    await add('10'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    for (const [flag, expected] of [['wrongChain', /wrong_chain/], ['wrongCode', /claim_runtime_mismatch/], ['wrongSigner', /voucher_signer_binding/], ['wrongToken', /claim_dependency_binding/], ['wrongOwner', /claim_dependency_binding/]])
      await assert.rejects(drainLiquidityQueue(pool, options(fixture({ [flag]: true }))), expected);
    assert.equal(await queued(), 1);
  });
  await check('claim pause and stale or reorganized reads never sign', async () => {
    await add('10'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    assert.equal((await drainLiquidityQueue(pool, options(fixture({ paused: true })))).reason, 'claim_paused');
    await assert.rejects(drainLiquidityQueue(pool, options(fixture({ stale: true }))), /stale_queue_chain_head/);
    await assert.rejects(drainLiquidityQueue(pool, options(fixture({ reorg: true }))), /queue_claim_block_reorg/);
    assert.equal(await queued(), 1);
  });
  await check('a signing configuration change during verification cannot change the approved domain', async () => {
    await add('10'); await pool.query('UPDATE chain_reserve SET funded_omr=100 WHERE id=1');
    await assert.rejects(drainLiquidityQueue(pool, options(fixture({ changeConfig: true }))), /voucher_signing_configuration_changed/);
    assert.equal(await queued(), 1);
  });
  if (process.env.DATABASE_URL) await check('large adjacent micro amounts cannot make an underfunded voucher signable', async () => {
    await add('9000000000.000002'); await pool.query('UPDATE chain_reserve SET funded_omr=$1 WHERE id=1', ['9000000000.000001']);
    // pg-mem internally stores NUMERIC as Number, so the exact storage boundary is a real-PG proof.
    assert.equal((await drainLiquidityQueue(pool, options(fixture()))).signed, 0); assert.equal(await queued(), 1);
  });
  if (process.env.DATABASE_URL) await check('concurrent queue completions serialize on the existing reserve lock', async () => {
    await add('10'); await add('10'); await add('10'); await pool.query('UPDATE chain_reserve SET funded_omr=25 WHERE id=1');
    const results = await Promise.all(Array.from({ length: 4 }, () => drainLiquidityQueue(pool, options(fixture()))));
    assert.equal(results.reduce((n, r) => n + r.signed, 0), 2); assert.equal(await queued(), 1);
  });
  console.log(JSON.stringify({ suite: 'confirmed liquidity queue completion', passed, postgres: !!process.env.DATABASE_URL, signer: 'public synthetic fixture only' }));
} finally {
  for (const key of envKeys) if (saved[key] == null) delete process.env[key]; else process.env[key] = saved[key];
  await pool.end();
}
