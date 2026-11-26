// Confirmed StreetDeed events can reach independent watcher streams out of order.
// Synthetic chain snapshots follow the contract callback mint/burn log order. Actual signer,
// schema, watcher cursors, transactions and recovery run here; deployed chain/SIWE are not qualified.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { recoverTypedDataAddress, keccak256, stringToHex, encodeErrorResult, ContractFunctionRevertedError } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'fixture requires loopback Postgres');
  assert.equal(target.pathname, '/omerta_audit_deed_recovery', 'fixture requires its dedicated scratch database');
}
process.env.CHAIN_ID = '46630';
process.env.STREET_DEED_ADDRESS = '0x3333333333333333333333333333333333333333';
const fixtureCode = '0x60016000', fixtureRuntimeHash = keccak256(fixtureCode);
process.env.STREET_DEED_RUNTIME_HASH = fixtureRuntimeHash;
process.env.CHAIN_CONFIRMATIONS = '3';
// Public fixture key only; no client sends a transaction or reads an external RPC.
process.env.VOUCHER_SIGNER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const { makeDb } = await import('../../src/db.js');
const { requestDeedWithdraw, sweepDeedReimports, readDeedClaimQuote, deedTokenId, DEED_VOUCHER_TYPES } = await import('../../src/chain.js');
const { reservePaidDeed } = await import('../../src/deeds.js');
const { buildingAtlas } = await import('../../src/deedbuildings.js');
const { syncDeedExtractedEvents, syncDeedRedeemedEvents, getCursor } = await import('../../src/watcher.js');
const pool = await makeDb();
const postgres = Boolean(process.env.DATABASE_URL);
const originalFetch = globalThis.fetch;
let networkAttempts = 0;
globalThis.fetch = async () => { networkAttempts++; throw new Error('Unexpected deed-order fixture network request'); };

try {
  const suffix = crypto.randomUUID();
  const issuerId = `deed-order-issuer-${suffix}`;
  const receiverId = `deed-order-receiver-${suffix}`;
  const issuerWallet = `0x${crypto.randomBytes(20).toString('hex')}`;
  const receiverWallet = `0x${crypto.randomBytes(20).toString('hex')}`;
  const name = `Audit ${suffix}`.slice(0, 28);
  const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
  const burnRef = `${txHash}:2`;
  for (const [id, wallet] of [[issuerId, issuerWallet], [receiverId, receiverWallet]]) {
    await pool.query('INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$1)', [id, 'audit-fixture']);
    // These are existing account/wallet associations, not a test of SIWE or smart-wallet enrollment.
    await pool.query('INSERT INTO account_persistent (account_id, wallet_address, minted) VALUES ($1,$2,true)', [id, wallet]);
  }
  // The actual prospective reservation creates no owned street or primary-payment evidence.
  // Account minted/link flags above are explicit fixture assistance, not enrollment proof.
  const supplyBefore = Number((await pool.query('SELECT issued FROM street_deed_supply WHERE id=1')).rows[0].issued);
  const reservation = await pool.connect();
  let building;
  try {
    await reservation.query('BEGIN');
    building = (await buildingAtlas(reservation, { district: 'docks' })).buildings
      .find(lot => lot.issuanceKind === 'paid' && !lot.claimed && !lot.reserved);
    assert(building, 'A canonical available paid lot is required.');
    const intent = await reservePaidDeed({ account_id: issuerId }, { name, buildingId: building.id, district: building.district }, reservation);
    assert.equal(intent.status, 'payment_required'); assert.equal(intent.benefitEligible, false);
    await reservation.query('COMMIT');
  } catch (error) { await reservation.query('ROLLBACK'); throw error; }
  finally { reservation.release(); }
  const fixtureTokenId = deedTokenId(name), fixtureTimestamp = BigInt(Math.floor(Date.now() / 1000));
  let fixtureHead = 103n, identityIssued = false, nativeDistrict;
  const usedNonces = new Set(), hash = value => keccak256(stringToHex('deed-order-fixture:' + value));
  const blockHash = number => hash('block:' + number), missingTokenAbi = [
    { type: 'error', name: 'ERC721NonexistentToken', inputs: [{ name: 'tokenId', type: 'uint256' }] },
  ];
  const publicClient = {
    getChainId: async () => 46630,
    getBlockNumber: async () => fixtureHead,
    getBlock: async ({ blockNumber }) => {
      assert.equal(blockNumber, fixtureHead - 3n);
      return { number: blockNumber, hash: blockHash(blockNumber), timestamp: fixtureTimestamp + blockNumber - 100n };
    },
    getCode: async ({ address, blockNumber }) => {
      assert.equal(address.toLowerCase(), process.env.STREET_DEED_ADDRESS.toLowerCase());
      assert.equal(blockNumber, fixtureHead - 3n); return fixtureCode;
    },
    readContract: async ({ address, blockNumber, functionName, args = [], abi }) => {
      assert.equal(address.toLowerCase(), process.env.STREET_DEED_ADDRESS.toLowerCase());
      assert.equal(blockNumber, fixtureHead - 3n);
      assert(abi.some(item => item.type === 'function' && item.name === functionName && item.stateMutability === 'view'));
      if (functionName === 'primarySaleConfigured') { assert.equal(args.length, 0); return true; }
      if (functionName === 'quoteClaim') { assert.deepEqual(args, [name]); assert.equal(identityIssued, false); return 10_000_000_000_000_000n; }
      if (functionName === 'usedNonce') { assert.equal(args.length, 1); return usedNonces.has(String(args[0])); }
      assert.deepEqual(args, [BigInt(fixtureTokenId)], 'Only the exact reserved identity is readable.');
      if (functionName === 'deedName') return identityIssued ? name : '';
      if (functionName === 'deedDistrict') return identityIssued ? nativeDistrict : '';
      if (functionName === 'gameplayIdentity') return false;
      if (functionName === 'ownerOf') {
        assert.equal(identityIssued, true);
        throw new ContractFunctionRevertedError({ abi: missingTokenAbi, functionName: 'ownerOf',
          data: encodeErrorResult({ abi: missingTokenAbi, errorName: 'ERC721NonexistentToken', args: [BigInt(fixtureTokenId)] }) });
      }
      throw new Error('Unexpected deed-order fixture read: ' + functionName);
    },
  };
  const reader = async (readName, district, options = {}) => {
    assert.equal(readName, name); nativeDistrict ??= district; assert.equal(district, nativeDistrict);
    return readDeedClaimQuote(readName, district, { ...options, publicClient });
  };
  const ledgerBefore = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  const issued = await requestDeedWithdraw(pool, issuerId, receiverWallet, { attest: true, reader });
  assert.equal(issued.issuanceRoute, 'paid'); assert.equal(issued.primaryType, 'DeedVoucher');
  assert.equal(issued.transaction.value, '10000000000000000');
  const recovered = await recoverTypedDataAddress({
    domain: { name: 'OmertaStreetDeed', version: '1', chainId: 46630,
      verifyingContract: process.env.STREET_DEED_ADDRESS },
    types: DEED_VOUCHER_TYPES, primaryType: 'DeedVoucher',
    message: { ...issued.voucher, nonce: BigInt(issued.voucher.nonce), deadline: BigInt(issued.voucher.deadline) },
    signature: issued.signature,
  });
  assert.equal(recovered.toLowerCase(), privateKeyToAccount(process.env.VOUCHER_SIGNER_PK).address.toLowerCase());
  assert.equal(issued.voucher.to.toLowerCase(), receiverWallet);
  assert.equal((await pool.query('SELECT account_id FROM street_deed_paid_intents WHERE account_id=$1', [issuerId])).rows[0].account_id,
    issuerId, 'the real signing path leaves its prospective intent owned and extraction-pending');
  assert.equal((await pool.query('SELECT account_id FROM street_deeds WHERE name=$1', [name])).rowCount, 0, 'Signing an unpaid intent grants no street.');
  assert.equal((await pool.query('SELECT building_id FROM street_deed_building_assignments WHERE building_id=$1', [building.id])).rowCount, 0, 'Signing grants no permanent assignment.');
  assert.equal(Number((await pool.query('SELECT issued FROM street_deed_supply WHERE id=1')).rows[0].issued), supplyBefore, 'Signing consumes no lifetime supply.');

  // One confirmed transaction: Redeemed is log 2, Extracted is log 3. Only the RPC
  // adapter is replaced; account authority and every database transition stay real.
  let extractionUnavailable = true;
  identityIssued = true; fixtureHead = 105n; usedNonces.add(String(issued.nonce));
  const event = { confirmed: true, chainId: 46630, contract: process.env.STREET_DEED_ADDRESS, runtimeHash: fixtureRuntimeHash,
    transactionHash: txHash, blockHash: blockHash(101n), blockNumber: '101', tokenId: issued.tokenId };
  const extracted = { ...event, nonce: Number(issued.nonce), logIndex: 3, to: issued.voucher.to, name: issued.voucher.name,
    district: issued.voucher.district, issue: { ...event, logIndex: 4, kind: 'paid', to: issued.voucher.to,
      payer: issuerWallet, count: '1', amount: '10000000000000000' } };
  const burned = { ...event, ref: burnRef, from: receiverWallet, logIndex: 2 };
  const inRange = (from, to) => from <= 101 && to >= 101;
  const source = {
    head: async () => 105,
    deedExtractedLogs: async (from, to) => {
      if (extractionUnavailable) throw new Error('fixture: Extracted RPC read unavailable');
      return inRange(from, to) ? [extracted] : [];
    },
    deedRedeemedLogs: async (from, to) => inRange(from, to)
      ? [burned] : [],
  };
  const options = { startBlock: 100, confirmations: 3 };
  await pool.query("UPDATE chain_cursor SET last_block=100 WHERE stream IN ('deed_extracted','deed_redeemed')");
  await assert.rejects(() => syncDeedExtractedEvents(pool, source, options), /Extracted RPC read unavailable/);
  assert.equal(await getCursor(pool, 'deed_extracted'), 100, 'failed extraction ingestion keeps its cursor');
  await syncDeedRedeemedEvents(pool, source, options);
  const earlyBurn = (await pool.query('SELECT status FROM deed_reimports WHERE ref=$1', [burnRef])).rows[0];
  console.log(`burn before Extracted: status=${earlyBurn.status}`);
  assert.equal(earlyBurn.status, 'pending', 'a confirmed burn must wait for its extraction instead of being discarded');
  assert.equal(await getCursor(pool, 'deed_redeemed'), 102, 'the durable pending burn permits its stream to advance');
  await sweepDeedReimports(pool, { reader });
  assert.equal((await pool.query('SELECT status FROM deed_reimports WHERE ref=$1', [burnRef])).rows[0].status,
    'pending', 'sweeping before extraction must keep the recovery claim');

  extractionUnavailable = false;
  await syncDeedExtractedEvents(pool, source, options);
  assert.equal((await pool.query('SELECT account_id FROM street_deeds WHERE onchain_token_id=$1', [issued.tokenId])).rows[0].account_id,
    `onchain:${issued.tokenId}`, 'retrying extraction establishes the on-chain lifecycle');
  const voucher = (await pool.query('SELECT status, claimed_onchain FROM vouchers WHERE id=$1', [issued.id])).rows[0];
  assert.equal(voucher.status, 'claimed');
  assert.equal(voucher.claimed_onchain, true);
  const extractedRow = (await pool.query('SELECT * FROM street_deeds WHERE name=$1', [name])).rows[0];
  assert.equal(extractedRow.issuance_kind, 'paid'); assert.equal(extractedRow.primary_issuance_receipt.kind, 'paid');
  assert.equal(extractedRow.primary_issuance_receipt.transactionHash, txHash);
  assert.equal(extractedRow.primary_issuance_receipt.pairedExtractLogIndex, 3);
  assert.equal((await pool.query('SELECT account_id FROM street_deed_paid_intents WHERE account_id=$1', [issuerId])).rowCount, 0);
  assert(extractedRow.home_authority_token);

  if (postgres) {
    // Two real connections may select the same pending row; its FOR UPDATE lock
    // and status recheck must permit only one committed recovery.
    const sweeps = await Promise.all([sweepDeedReimports(pool, { reader }), sweepDeedReimports(pool, { reader })]);
    assert.equal(sweeps.reduce((n, result) => n + result.applied, 0), 1, 'overlapping Postgres sweeps apply once');
    console.log('real Postgres: concurrent recovery sweeps applied exactly once');
  } else {
    assert.equal((await sweepDeedReimports(pool, { reader })).applied, 1);
    console.log('pg-mem: sequential recovery checked; concurrency requires the Postgres run');
  }
  const returned = (await pool.query('SELECT * FROM street_deeds WHERE name=$1', [name])).rows[0];
  assert.equal(returned.account_id, receiverId, 'the actual burn recipient receives the recovered deed');
  assert.notEqual(returned.home_authority_token, extractedRow.home_authority_token, 'Recovery retires the extracted home authority.');
  for (const field of ['onchain_token_id', 'extracted_by_account', 'extracted_at', 'onchain_owner', 'controller_account', 'control_until']) {
    assert.equal(returned[field], null, `${field} is cleared on recovery`);
  }
  const recovery = (await pool.query('SELECT status, applied_account FROM deed_reimports WHERE ref=$1', [burnRef])).rows[0];
  assert.equal(recovery.status, 'applied');
  assert.equal(recovery.applied_account, receiverId);

  // Replay both exact events through their real watchers after a cursor rewind.
  await pool.query("UPDATE chain_cursor SET last_block=100 WHERE stream IN ('deed_extracted','deed_redeemed')");
  await syncDeedExtractedEvents(pool, source, options);
  await syncDeedRedeemedEvents(pool, source, options);
  assert.equal((await sweepDeedReimports(pool, { reader })).applied, 0, 'replayed events cannot create another recovery');
  assert.equal((await pool.query('SELECT home_authority_token FROM street_deeds WHERE name=$1', [name])).rows[0].home_authority_token,
    returned.home_authority_token, 'Replay cannot rotate home authority.');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM street_deeds WHERE name=$1', [name])).rows[0].n), 1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM street_deed_history WHERE account_id=$1 AND kind=$2',
    [receiverId, 'sold'])).rows[0].n), 1, 'the recovery writes one lineage event');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), ledgerBefore,
    'signing, callback-order recovery and replay create no currency ledger movement');
  assert.equal(networkAttempts, 0, 'Every quote/sweep used its finite reader; no external request was attempted.');
  console.log(`PASS deed reimport event ordering (${postgres ? 'PostgreSQL' : 'pg-mem'}): signed extraction, durable pending burn, exact recipient, once-only recovery and replay`);
} finally {
  globalThis.fetch = originalFetch;
  await pool.end();
}
