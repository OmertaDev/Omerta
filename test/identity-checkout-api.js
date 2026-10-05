import assert from 'node:assert/strict';
import http from 'node:http';
import crypto from 'node:crypto';
import { encodeAbiParameters, encodeFunctionData } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { MINT_VOUCHER_TYPES } from '../src/chain.js';
import pg from 'pg';

const prior = { ...process.env };
const postgres = process.argv.includes('--postgres');
if (!postgres) assert(!process.env.DATABASE_URL, 'Character checkout API test uses only its isolated memory database');
if (postgres) {
  const url = new URL(process.env.IDENTITY_CHECKOUT_E2E_DATABASE_URL || process.env.DATABASE_URL || '');
  assert(['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname));
  assert(url.pathname === '/omerta_identity_checkout_test' || /^\/omerta_liquidity_[a-z0-9_]*e2e_test$/.test(url.pathname), 'Use a dedicated local disposable database');
  const probe = new pg.Pool({ connectionString: url.href });
  try { assert.equal(Number((await probe.query("SELECT count(*) n FROM information_schema.tables WHERE table_schema='public'")).rows[0].n), 0, 'Disposable test database must be empty'); }
  finally { await probe.end(); }
  process.env.DATABASE_URL = url.href;
}
const signer = privateKeyToAccount(`0x${'11'.repeat(32)}`), wallet = `0x${'22'.repeat(20)}`;
const fees = `0x${'33'.repeat(20)}`, nft = `0x${'44'.repeat(20)}`;
const values = new Map();
for (const [name, type, value] of [['signer', 'address', signer.address], ['paused', 'bool', false],
  ['mintFee', 'uint256', 10000000000000000n], ['mintDevBps', 'uint256', 10000n], ['feeRecipient', 'address', wallet]]) {
  const abi = [{ type: 'function', name, stateMutability: 'view', inputs: [], outputs: [{ type }] }];
  values.set(encodeFunctionData({ abi, functionName: name }), encodeAbiParameters([{ type }], [value]));
}
const nonceAbi = [{ type: 'function', name: 'usedNonce', stateMutability: 'view', inputs: [{ type: 'uint256' }], outputs: [{ type: 'bool' }] }];
const nonceSelector = encodeFunctionData({ abi: nonceAbi, functionName: 'usedNonce', args: [0n] }).slice(0, 10);
let wrongChain = false;
const rpcTimestamp = BigInt(Math.floor(Date.now() / 1000));
const rpc = http.createServer(async (request, response) => {
  let input = ''; for await (const chunk of request) input += chunk;
  const body = JSON.parse(input);
  const answer = (call) => {
    let result;
    if (call.method === 'eth_chainId') result = wrongChain ? '0x1' : '0x1237';
    else if (call.method === 'eth_blockNumber') result = '0x64';
    else if (call.method === 'eth_getCode') result = '0x6000';
    else if (call.method === 'eth_getBlockByNumber') result = { number: call.params[0] === 'latest' ? '0x64' : call.params[0],
      timestamp: `0x${(call.params[0] === 'latest' ? rpcTimestamp : rpcTimestamp - 1n).toString(16)}`, hash: `0x${'66'.repeat(32)}` };
    else if (call.method === 'eth_call') result = call.params[0].data.startsWith(nonceSelector)
      ? encodeAbiParameters([{ type: 'bool' }], [false]) : values.get(call.params[0].data);
    else throw Error(`Unexpected RPC method ${call.method}`);
    return { jsonrpc: '2.0', id: call.id, result };
  };
  response.setHeader('content-type', 'application/json'); response.end(JSON.stringify(Array.isArray(body) ? body.map(answer) : answer(body)));
});
await new Promise((resolve) => rpc.listen(0, '127.0.0.1', resolve));
Object.assign(process.env, { NODE_ENV: 'test', INVITE_MODE: 'off', RATE_LIMIT: 'off',
  MARKET_SEED: crypto.randomBytes(32).toString('hex'), SOCIAL_VERIFY_MODE: 'off',
  JWT_SECRET: crypto.randomBytes(32).toString('hex'), MOD_KEY: crypto.randomBytes(32).toString('hex'),
  CHAIN_RPC_URL: `http://127.0.0.1:${rpc.address().port}`, CHAIN_ID: '4663',
  VOUCHER_SIGNER_PK: `0x${'11'.repeat(32)}`, OMERTA_FEES_ADDRESS: fees, DYNASTY_NFT_ADDRESS: nft });
let app;
try {
  const { buildServer } = await import('../src/server.js'); app = await buildServer();
  await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('checkout-api','test','checkout-api')");
  await app.pool.query('INSERT INTO account_persistent(account_id,wallet_address) VALUES($1,$2)', ['checkout-api', wallet]);
  await app.pool.query("INSERT INTO chain_cursor(stream,last_block) VALUES('fees',95),('dynasty_minted',95),('dynasty_transfer',95)");
  const token = app.jwt.sign({ sub: 'checkout-api', tv: 0 });
  const call = (method, url, auth = true, payload = {}) => app.inject({ method, url, headers: auth ? { authorization: `Bearer ${token}` } : {}, ...(method === 'POST' ? { payload } : {}) });
  for (const [method, path] of [['GET', '/v1/identity/readiness'], ['POST', '/v1/identity/checkout'], ['POST', '/v1/identity/claim/calldata']])
    assert.equal((await call(method, path, false)).statusCode, 401, path);
  const ready = await call('GET', '/v1/identity/readiness'); assert.equal(ready.statusCode, 200, ready.body); assert.equal(ready.json().signerMatches, true);
  if (process.argv.includes('--print-readiness')) console.log('CHARACTER_READINESS_FIXTURE ' + ready.body);
  const payment = await call('POST', '/v1/identity/checkout', true, { address: nft, value: '0x0', contract: nft });
  assert.equal(payment.statusCode, 200, payment.body); assert.equal(payment.json().from.toLowerCase(), wallet);
  assert.equal(payment.json().to.toLowerCase(), fees); assert.equal(payment.json().feeWei, '10000000000000000');
  assert.notEqual((await call('POST', '/v1/identity/claim/calldata')).statusCode, 200, 'Unconfirmed fee cannot issue a claim');
  await app.pool.query("UPDATE account_persistent SET minted=true WHERE account_id='checkout-api'");
  assert.equal((await call('POST', '/v1/identity/checkout')).json().error, 'already');
  const optional = await call('POST', '/v1/identity/checkout', true, { purpose: 'reveal' });
  assert.equal(optional.statusCode, 200, optional.body); assert.equal(optional.json().action, 'optional_portrait_reveal');
  assert.equal((await call('POST', '/v1/identity/checkout', true, { purpose: false })).json().error, 'invalid');
  await app.pool.query("INSERT INTO fee_payments(nonce,kind,payer_address,amount_wei,tx_hash,account_id,credited) VALUES(6000,'mint',$1,'1',$2,'checkout-api',true)",
    [wallet, `0x${'99'.repeat(32)}`]);
  assert.equal((await call('POST', '/v1/identity/checkout', true, { purpose: 'reveal' })).json().error, 'already', 'Confirmed paid portraits never pay for optional reveal again');
  assert.equal((await call('GET', '/v1/identity/readiness')).json().hasPaidPortraitFee, true);
  const oldSigner = privateKeyToAccount(`0x${'77'.repeat(32)}`);
  const domain = { name: 'OmertaDynasty', version: '1', chainId: 4663, verifyingContract: nft };
  const makeSaved = async (deadline) => {
    const voucher = { to: wallet, nonce: '5000', deadline: String(deadline) };
    const signature = await oldSigner.signTypedData({ domain, types: MINT_VOUCHER_TYPES, primaryType: 'MintVoucher',
      message: { to: wallet, nonce: 5000n, deadline: BigInt(deadline) } });
    return JSON.stringify({ domain, voucher, signature });
  };
  const future = Math.floor(Date.now() / 1000) + 600;
  await app.pool.query("INSERT INTO vouchers(id,account_id,kind,amount,nonce,to_address,deadline,status,signed_payload) VALUES('rotated-old','checkout-api','dynasty',1,5000,$1,$2,'signed',$3)",
    [wallet, future, await makeSaved(future)]);
  assert.equal((await call('POST', '/v1/identity/claim/calldata')).json().error, 'unavailable', 'Live old-signer voucher remains rejected');
  const past = Math.floor(Date.now() / 1000) - 60;
  await app.pool.query("UPDATE vouchers SET deadline=$1,signed_payload=$2 WHERE id='rotated-old'", [past, await makeSaved(past)]);
  const replaced = await call('POST', '/v1/identity/claim/calldata');
  assert.equal(replaced.statusCode, 200, replaced.body);
  assert.equal((await app.pool.query("SELECT status FROM vouchers WHERE id='rotated-old'")).rows[0].status, 'expired', 'Confirmed unused expiry retires old signer voucher');
  await app.pool.query("INSERT INTO dynasty_tokens(token_id,minter_address,owner_address,account_id) VALUES('42',$1,$1,'checkout-api')", [wallet]);
  const recorded = (await call('GET', '/v1/identity/readiness')).json().nftToken;
  assert.equal(recorded.tokenId, '42'); assert.equal(recorded.ownerAddress.toLowerCase(), wallet);
  assert.equal((await call('POST', '/v1/identity/claim/calldata')).json().error, 'already');
  assert.equal((await call('POST', '/v1/identity/checkout')).json().error, 'already');
  if (postgres) {
    const concurrentWallet = `0x${'88'.repeat(20)}`;
    await app.pool.query("INSERT INTO accounts(id,auth_provider,auth_subject) VALUES('checkout-concurrent','test','checkout-concurrent')");
    await app.pool.query("INSERT INTO account_persistent(account_id,wallet_address,mint_credits) VALUES('checkout-concurrent',$1,1)", [concurrentWallet]);
    await app.pool.query("INSERT INTO characters(id,account_id,name,season,loc) VALUES('checkout-concurrent-character','checkout-concurrent','Checkout',1,'docks')");
    const parallelToken = app.jwt.sign({ sub: 'checkout-concurrent', tv: 0 });
    const invoke = () => app.inject({ method: 'POST', url: '/v1/identity/claim/calldata', headers: { authorization: `Bearer ${parallelToken}` }, payload: {} });
    const results = await Promise.all(Array.from({ length: 4 }, invoke));
    assert(results.some((result) => result.statusCode === 200), results.map((result) => result.body).join('\n'));
    for (const result of results) if (result.statusCode !== 200) assert(['pending', 'contention'].includes(result.json().error), result.body);
    const account = (await app.pool.query("SELECT minted,mint_credits FROM account_persistent WHERE account_id='checkout-concurrent'")).rows[0];
    assert.equal(account.minted, true); assert.equal(Number(account.mint_credits), 0, 'Concurrent wrappers consume one confirmed credit');
    const issued = (await app.pool.query("SELECT nonce FROM vouchers WHERE account_id='checkout-concurrent' AND kind='dynasty' AND status='signed'")).rows;
    assert.equal(issued.length, 1, 'Concurrent wrappers issue exactly one live trophy voucher');
    assert.equal(new Set(results.filter((result) => result.statusCode === 200).map((result) => result.json().data)).size, 1);
    console.log('character PostgreSQL: four concurrent authenticated claims consume one credit and issue one voucher PASS');
  }
  wrongChain = true; assert.equal((await call('GET', '/v1/identity/readiness')).json().error, 'chain_unconfigured'); wrongChain = false;
  delete process.env.VOUCHER_SIGNER_PK; assert.equal((await call('GET', '/v1/identity/readiness')).json().error, 'chain_unconfigured');
  console.log('character HTTP: authenticated readiness/payment/claim, live RPC fee, body overrides ignored, unpaid claim and repeat payment rejected, signer/network failclosed PASS');
} finally {
  if (app) await app.close(); await new Promise((resolve) => rpc.close(resolve));
  for (const name of Object.keys(process.env)) if (!(name in prior)) delete process.env[name]; Object.assign(process.env, prior);
}
