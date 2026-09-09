// Disposable local proof of the character NFT rail. Starts its own Anvil, deploys only
// OmertaFees + DynastyNFT, and uses pg-mem. Never accepts an RPC, wallet, or database.
// Run: npm run character:rehearsal (requires Foundry; optional ANVIL_BIN/FORGE_BIN/SOLC_BIN).
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import net from 'node:net';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { randomBytes, randomUUID, createHash } from 'node:crypto';
import { createPublicClient, createWalletClient, http, parseEther } from 'viem';
import { mnemonicToAccount } from 'viem/accounts';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CONTRACTS = path.join(ROOT, 'omerta-contracts');
const REPORT = path.join(ROOT, 'output', 'character-nft', 'rehearsals',
  `${new Date().toISOString().replaceAll(':', '-').replaceAll('.', '-')}-mint-dev.json`);
const suffix = process.platform === 'win32' ? '.exe' : '';
const binary = (name) => {
  const local = path.join(os.homedir(), '.foundry', 'bin', name + suffix);
  return process.env[name.toUpperCase() + '_BIN'] || (fs.existsSync(local) ? local : name);
};
const forge = binary('forge'), anvil = binary('anvil');
const cachedSolc = path.join(CONTRACTS, 'cache', 'verify', 'solc-0.8.26' + suffix);
const solc = process.env.SOLC_BIN || (fs.existsSync(cachedSolc) ? cachedSolc : null);
if (process.argv.length !== 2) throw new Error('This local-only rehearsal accepts no arguments or remote target.');

// Do not let the caller's deployment, DB, push, Redis, signer, or auth settings reach
// the test backend. No .env file is read. Only operating-system/tool lookup survives.
const keep = new Set(['PATH', 'SYSTEMROOT', 'WINDIR', 'COMSPEC', 'PATHEXT', 'TEMP', 'TMP',
  'TMPDIR', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA', 'HOMEDRIVE', 'HOMEPATH']);
for (const key of Object.keys(process.env)) if (!keep.has(key.toUpperCase())) delete process.env[key];
Object.assign(process.env, { NODE_ENV: 'test', INVITE_MODE: 'on', RATE_LIMIT: 'off',
  JWT_SECRET: randomBytes(32).toString('hex'), MOD_KEY: randomBytes(32).toString('hex') });

const report = { schemaVersion: 1, status: 'running', startedAt: new Date().toISOString(),
  scope: 'disposable-local-anvil-and-pg-mem', liveTransactions: 0, chainId: 31337,
  sourceCommit: spawnSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).stdout?.trim(),
  workingTree: spawnSync('git', ['status', '--porcelain'], { cwd: ROOT, encoding: 'utf8', windowsHide: true }).stdout?.trim() ? 'dirty' : 'clean',
  sourceSha256: Object.fromEntries(['src/chain.js', 'src/fees.js', 'src/watcher.js', 'schema.sql',
    'omerta-contracts/src/OmertaFees.sol', 'tools/character-nft-rehearsal.js'].map((file) => [file, createHash('sha256').update(fs.readFileSync(path.join(ROOT, file))).digest('hex')])),
  checks: [], contracts: {} };
let node, app, nodeExited;
const check = (name) => { report.checks.push(name); console.log(`PASS ${name}`); };
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  const build = spawnSync(forge, ['build', 'src/OmertaFees.sol', 'src/DynastyNFT.sol',
    ...(solc ? ['--use', solc] : [])], { cwd: CONTRACTS, encoding: 'utf8', windowsHide: true, timeout: 180_000 });
  assert.equal(build.status, 0, `Foundry build failed: ${build.error?.message || build.stderr || build.stdout}`);
  report.forgeVersion = spawnSync(forge, ['--version'], { encoding: 'utf8', windowsHide: true }).stdout?.split('\n')[0];
  const artifact = Object.fromEntries(['OmertaFees', 'DynastyNFT'].map((name) => {
    const raw = fs.readFileSync(path.join(CONTRACTS, 'out', name + '.sol', name + '.json'));
    return [name, { ...JSON.parse(raw), artifactSha256: createHash('sha256').update(raw).digest('hex') }];
  }));
  check('Current fee and NFT Solidity sources compile');

  const port = await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => { const p = server.address().port; server.close(() => resolve(p)); });
  });
  const rpc = `http://127.0.0.1:${port}`;
  // These public development accounts are created afresh here and never used outside this node.
  const mnemonic = 'test test test test test test test test test test test junk';
  node = spawn(anvil, ['--host', '127.0.0.1', '--port', String(port), '--chain-id', '31337',
    '--mnemonic', mnemonic, '--silent'], { stdio: 'ignore', windowsHide: true });
  nodeExited = new Promise((resolve) => node.once('exit', resolve));
  let nodeError;
  node.once('error', (err) => { nodeError = err; });
  const chain = { id: 31337, name: 'Disposable character NFT rehearsal',
    nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: { default: { http: [rpc] } } };
  const pub = createPublicClient({ chain, transport: http(rpc, { retryCount: 0 }), cacheTime: 0 });
  let ready = false;
  for (let n = 0; n < 50; n++) {
    if (nodeError) throw nodeError;
    try { ready = (await pub.getChainId()) === 31337; } catch { /* node still starting */ }
    if (ready) break;
    await delay(100);
  }
  assert(ready, 'Fresh local Anvil did not start');
  assert.equal(await pub.getBlockNumber(), 0n, 'Refuse any pre-existing chain');
  const wallets = Array.from({ length: 5 }, (_, addressIndex) => createWalletClient({ chain,
    transport: http(rpc), account: mnemonicToAccount(mnemonic, { addressIndex }) }));
  const [owner, player, buyer, signing, vig] = wallets;
  const read = (name, fn, args = []) => pub.readContract({ address: report.contracts[name].address,
    abi: artifact[name].abi, functionName: fn, args });
  const write = async (wallet, name, fn, args = [], value) => {
    const hash = await wallet.writeContract({ address: report.contracts[name].address,
      abi: artifact[name].abi, functionName: fn, args, ...(value !== undefined ? { value } : {}) });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success', `${name}.${fn} reverted`);
    return receipt;
  };
  const mintFee = parseEther('0.01');
  for (const [name, args] of [
    ['OmertaFees', [owner.account.address, owner.account.address, vig.account.address, 2500n, mintFee, parseEther('0.1')]],
    ['DynastyNFT', [owner.account.address, signing.account.address, 'http://local.invalid/v1/identity/', owner.account.address, 500n, 10n]],
  ]) {
    const hash = await owner.deployContract({ abi: artifact[name].abi, bytecode: artifact[name].bytecode.object, args });
    const receipt = await pub.waitForTransactionReceipt({ hash });
    assert.equal(receipt.status, 'success');
    report.contracts[name] = { address: receipt.contractAddress, transactionHash: hash,
      artifactSha256: artifact[name].artifactSha256 };
  }
  check('Only OmertaFees and DynastyNFT deployed on the fresh local chain');
  assert.equal(await read('OmertaFees', 'mintDevBps'), 10_000n);
  assert.equal(await read('OmertaFees', 'vigBps'), 2500n);
  check('Character mint policy is 100% DEV; respawn, reroll and package Vig rate remains 25%');

  Object.assign(process.env, { CHAIN_RPC_URL: rpc, CHAIN_ID: '31337', CHAIN_CONFIRMATIONS: '0',
    CHAIN_START_BLOCK: '0', VIG_BPS: '2500', OMERTA_FEES_ADDRESS: report.contracts.OmertaFees.address,
    DYNASTY_NFT_ADDRESS: report.contracts.DynastyNFT.address,
    VOUCHER_SIGNER_PK: '0x' + Buffer.from(signing.account.getHdKey().privateKey).toString('hex') });
  const { buildServer } = await import('../src/server.js');
  const { makeViemSource, syncFeeEvents, syncDynastyMintEvents, syncDynastyTransferEvents } = await import('../src/watcher.js');
  const { generateInviteCode } = await import('../src/invites.js');
  app = await buildServer();
  const api = async (method, url, token, body) => {
    const response = await app.inject({ method, url, ...(body === undefined ? {} : { payload: body }),
      headers: { ...(token ? { authorization: 'Bearer ' + token } : {}),
        ...(method === 'GET' ? {} : { 'idempotency-key': randomUUID() }) } });
    return { code: response.statusCode, body: response.json() };
  };
  const ok = (r) => { assert.equal(r.code, 200, JSON.stringify(r.body)); return r.body; };
  const bootstrap = async (name, wallet) => {
    const inviteCode = generateInviteCode();
    await app.pool.query('INSERT INTO invite_codes (code, uses_left) VALUES ($1,1)', [inviteCode]);
    const token = ok(await api('POST', '/v1/access/redeem', null,
      { inviteCode, bootstrapSecret: randomBytes(32).toString('base64url') })).token;
    ok(await api('POST', '/v1/character', token, { name }));
    const challenge = ok(await api('POST', '/v1/wallet/challenge', token, {}));
    ok(await api('POST', '/v1/wallet/verify', token, { address: wallet.account.address,
      signature: await wallet.signMessage({ message: challenge.message }) }));
    return token;
  };
  const token = await bootstrap('Mint Rehearsal', player);
  const accountId = app.jwt.verify(token).sub;
  const buyerToken = await bootstrap('Portrait Collector', buyer);
  check('Two fresh invited accounts created and wallets proved through SIWE');
  assert.equal((await api('POST', '/v1/character/mint', token, {})).body.error, 'no_mint_credit');
  assert.equal((await api('POST', '/v1/identity/mint', token, {})).body.error, 'not_minted');
  check('Unmade accounts cannot mint the NFT');

  await assert.rejects(() => pub.simulateContract({ account: player.account,
    address: report.contracts.OmertaFees.address, abi: artifact.OmertaFees.abi,
    functionName: 'payMintFee', value: mintFee - 1n }), /WrongFee/);
  const beforeDev = await pub.getBalance({ address: owner.account.address });
  const beforeVig = await pub.getBalance({ address: vig.account.address });
  await write(player, 'OmertaFees', 'payMintFee', [], mintFee);
  assert.equal((await pub.getBalance({ address: owner.account.address })) - beforeDev, mintFee);
  assert.equal((await pub.getBalance({ address: vig.account.address })) - beforeVig, 0n);
  assert.equal(await pub.getBalance({ address: report.contracts.OmertaFees.address }), 0n);
  check('Exact 0.01 local ETH character mint fee forwarded entirely to DEV; Vig receives zero; wrong amount rejected');
  // The watcher's transport caches block numbers for four seconds; use an uncached head
  // while keeping its production ABI/log decoders, so this proof can run without wall-time sleeps.
  const source = { ...await makeViemSource(), head: () => pub.getBlockNumber() };
  const syncOpts = { confirmations: 0, startBlock: 0 };
  assert.equal((await syncFeeEvents(app.pool, source, syncOpts)).processed, 1);
  assert.equal((await syncFeeEvents(app.pool, source, syncOpts)).processed, 0);
  for (const table of ['vig_revenue', 'rwa_revenue', 'community_revenue']) {
    assert.equal((await app.pool.query(`SELECT * FROM ${table} WHERE source='fee'`)).rows.length,
      0, `${table} must not book any character mint revenue`);
  }
  const bookedFee = (await app.pool.query("SELECT amount_wei, mint_dev_only FROM fee_payments WHERE kind='mint'")).rows[0];
  assert.equal(BigInt(bookedFee.amount_wei), mintFee);
  assert.equal(bookedFee.mint_dev_only, true);
  check('Mint payment records the full DEV policy with no Vig, treasury or community revenue');
  assert.equal(ok(await api('GET', '/v1/fees/status', token)).mintCredits, 1);
  assert.equal(ok(await api('POST', '/v1/character/mint', token, {})).minted, true);
  assert.equal(ok(await api('POST', '/v1/character/mint', token, {})).alreadyMinted, true);
  assert.equal(ok(await api('GET', '/v1/fees/status', token)).mintCredits, 0);
  check('Real fee log credited once and account mint consumed exactly one credit');
  const wrongRecipient = await api('POST', '/v1/identity/mint', token, { address: buyer.account.address });
  assert.equal(wrongRecipient.code, 400);
  check('NFT voucher cannot be redirected to another wallet');
  const signed = ok(await api('POST', '/v1/identity/mint', token, {}));
  assert.equal((await api('POST', '/v1/identity/mint', token, {})).body.error, 'pending');
  const tuple = { to: signed.voucher.to, nonce: BigInt(signed.voucher.nonce), deadline: BigInt(signed.voucher.deadline) };
  const receipt = await write(player, 'DynastyNFT', 'claim', [tuple, signed.signature]);
  report.mintTransactionHash = receipt.transactionHash;
  assert.equal((await read('DynastyNFT', 'ownerOf', [1n])).toLowerCase(), player.account.address.toLowerCase());
  await assert.rejects(() => pub.simulateContract({ account: player.account,
    address: signed.contract, abi: artifact.DynastyNFT.abi, functionName: 'claim', args: [tuple, signed.signature] }), /DN: replay/);
  check('Backend EIP-712 voucher claimed as NFT #1; duplicate issue and on-chain replay rejected');
  assert.equal((await syncDynastyMintEvents(app.pool, source, syncOpts)).processed, 1);
  await syncDynastyTransferEvents(app.pool, source, syncOpts);
  const recorded = (await app.pool.query('SELECT * FROM dynasty_tokens WHERE token_id=$1', ['1'])).rows[0];
  const voucherRow = (await app.pool.query('SELECT * FROM vouchers WHERE nonce=$1', [signed.nonce])).rows[0];
  assert.equal(recorded.account_id, accountId);
  assert.equal(voucherRow.claimed_onchain, true);
  assert.equal((await api('POST', '/v1/identity/mint', token, {})).body.error, 'already');
  assert.equal(ok(await api('GET', '/v1/identity/1')).name.includes('Mint Rehearsal'), true);
  assert.equal(await read('DynastyNFT', 'tokenURI', [1n]), 'http://local.invalid/v1/identity/1');
  check('Mint watcher binds NFT to voucher account, marks claimed, and serves metadata');

  await write(player, 'DynastyNFT', 'transferFrom', [player.account.address, buyer.account.address, 1n]);
  await syncDynastyTransferEvents(app.pool, source, syncOpts);
  const sold = (await app.pool.query('SELECT * FROM dynasty_tokens WHERE token_id=$1', ['1'])).rows[0];
  assert.equal(sold.frozen, true);
  assert.equal(sold.account_id, accountId);
  assert.equal(sold.owner_address, buyer.account.address.toLowerCase());
  assert.equal(ok(await api('GET', '/v1/me', token)).character.minted, true);
  assert.equal(ok(await api('GET', '/v1/me', buyerToken)).character.minted, false);
  assert.equal((await api('POST', '/v1/identity/mint', token, {})).body.error, 'already');
  const frozenMetadata = ok(await api('GET', '/v1/identity/1'));
  await app.pool.query('UPDATE characters SET name=$2 WHERE account_id=$1', [accountId, 'Later Character']);
  assert.deepEqual(ok(await api('GET', '/v1/identity/1')), frozenMetadata);
  check('Transfer freezes portrait; seller keeps account entitlement, buyer receives trophy only');
  assert.equal(process.env.VOUCHER_CLAIM_ADDRESS, undefined);
  assert.equal(process.env.OMR_ADDRESS, undefined);
  check('Token withdrawal and OMR contract configuration remain absent');
  report.status = 'passed';
} catch (err) {
  report.status = 'failed';
  // Record assertion context only; never serialize signer, environment, headers, or RPC requests.
  report.failure = { name: err.name, message: String(err.shortMessage || err.message).slice(0, 2500) };
  console.error(report.failure.message);
  process.exitCode = 1;
} finally {
  if (app) await app.close();
  if (node && node.exitCode === null) {
    node.kill();
    await Promise.race([nodeExited, delay(3000)]);
    if (node.exitCode === null) node.kill('SIGKILL');
  }
  report.completedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 2) + '\n');
  console.log(`${report.status.toUpperCase()}: ${report.checks.length} checks; report ${REPORT}`);
}
