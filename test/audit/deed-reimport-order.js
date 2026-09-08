// Confirmed StreetDeed events can reach independent watcher streams out of order.
// The event fixture follows ComprehensiveCoreAudit's real-contract mint/burn log order;
// this suite exercises the actual signer, schema, watcher cursors, transactions and recovery sweep.
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { recoverTypedDataAddress } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

if (process.argv.includes('--memory')) delete process.env.DATABASE_URL;
if (process.env.DATABASE_URL) {
  const target = new URL(process.env.DATABASE_URL);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(target.hostname), 'fixture requires loopback Postgres');
  assert.equal(target.pathname, '/omerta_audit_deed_recovery', 'fixture requires its dedicated scratch database');
}
process.env.CHAIN_ID = '46630';
process.env.STREET_DEED_ADDRESS = '0x3333333333333333333333333333333333333333';
// Public fixture key only; no client sends a transaction or reads an external RPC.
process.env.VOUCHER_SIGNER_PK = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';

const { makeDb } = await import('../../src/db.js');
const { requestDeedWithdraw, sweepDeedReimports, DEED_VOUCHER_TYPES } = await import('../../src/chain.js');
const { syncDeedExtractedEvents, syncDeedRedeemedEvents, getCursor } = await import('../../src/watcher.js');
const pool = await makeDb();
const postgres = Boolean(process.env.DATABASE_URL);

try {
  const suffix = crypto.randomUUID();
  const issuerId = `deed-order-issuer-${suffix}`;
  const receiverId = `deed-order-receiver-${suffix}`;
  const issuerWallet = `0x${crypto.randomBytes(20).toString('hex')}`;
  const receiverWallet = `0x${crypto.randomBytes(20).toString('hex')}`;
  const name = `Audit ${suffix}`;
  const txHash = `0x${crypto.randomBytes(32).toString('hex')}`;
  const burnRef = `${txHash}:2`;
  for (const [id, wallet] of [[issuerId, issuerWallet], [receiverId, receiverWallet]]) {
    await pool.query('INSERT INTO accounts (id, auth_provider, auth_subject) VALUES ($1,$2,$1)', [id, 'audit-fixture']);
    // These are existing account/wallet associations, not a test of SIWE or smart-wallet enrollment.
    await pool.query('INSERT INTO account_persistent (account_id, wallet_address, minted) VALUES ($1,$2,true)', [id, wallet]);
  }
  await pool.query('INSERT INTO street_deeds (account_id, name, name_lc, district) VALUES ($1,$2,$3,$4)',
    [issuerId, name, name.toLowerCase(), 'docks']);
  await pool.query('INSERT INTO street_deed_history (account_id, kind, detail) VALUES ($1,$2,$3)',
    [issuerId, 'claim', 'audit extraction-order fixture']);
  const ledgerBefore = Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n);
  const issued = await requestDeedWithdraw(pool, issuerId, receiverWallet, { attest: true });
  const recovered = await recoverTypedDataAddress({
    domain: { name: 'OmertaStreetDeed', version: '1', chainId: 46630,
      verifyingContract: process.env.STREET_DEED_ADDRESS },
    types: DEED_VOUCHER_TYPES, primaryType: 'DeedVoucher',
    message: { ...issued.voucher, nonce: BigInt(issued.voucher.nonce), deadline: BigInt(issued.voucher.deadline) },
    signature: issued.signature,
  });
  assert.equal(recovered.toLowerCase(), privateKeyToAccount(process.env.VOUCHER_SIGNER_PK).address.toLowerCase());
  assert.equal(issued.voucher.to.toLowerCase(), receiverWallet);
  assert.equal((await pool.query('SELECT account_id FROM street_deeds WHERE onchain_token_id=$1', [issued.tokenId])).rows[0].account_id,
    issuerId, 'the real signing path leaves the deed extraction-pending');

  // One confirmed transaction: Redeemed is log 2, Extracted is log 3. Only the RPC
  // adapter is replaced; account authority and every database transition stay real.
  let extractionUnavailable = true;
  const inRange = (from, to) => from <= 101 && to >= 101;
  const source = {
    head: async () => 105,
    deedExtractedLogs: async (from, to) => {
      if (extractionUnavailable) throw new Error('fixture: Extracted RPC read unavailable');
      return inRange(from, to) ? [{ nonce: issued.nonce, tokenId: issued.tokenId }] : [];
    },
    deedRedeemedLogs: async (from, to) => inRange(from, to)
      ? [{ ref: burnRef, from: receiverWallet, tokenId: issued.tokenId, txHash }] : [],
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
  await sweepDeedReimports(pool);
  assert.equal((await pool.query('SELECT status FROM deed_reimports WHERE ref=$1', [burnRef])).rows[0].status,
    'pending', 'sweeping before extraction must keep the recovery claim');

  extractionUnavailable = false;
  await syncDeedExtractedEvents(pool, source, options);
  assert.equal((await pool.query('SELECT account_id FROM street_deeds WHERE onchain_token_id=$1', [issued.tokenId])).rows[0].account_id,
    `onchain:${issued.tokenId}`, 'retrying extraction establishes the on-chain lifecycle');
  const voucher = (await pool.query('SELECT status, claimed_onchain FROM vouchers WHERE id=$1', [issued.id])).rows[0];
  assert.equal(voucher.status, 'claimed');
  assert.equal(voucher.claimed_onchain, true);

  if (postgres) {
    // Two real connections may select the same pending row; its FOR UPDATE lock
    // and status recheck must permit only one committed recovery.
    const sweeps = await Promise.all([sweepDeedReimports(pool), sweepDeedReimports(pool)]);
    assert.equal(sweeps.reduce((n, result) => n + result.applied, 0), 1, 'overlapping Postgres sweeps apply once');
    console.log('real Postgres: concurrent recovery sweeps applied exactly once');
  } else {
    assert.equal((await sweepDeedReimports(pool)).applied, 1);
    console.log('pg-mem: sequential recovery checked; concurrency requires the Postgres run');
  }
  const returned = (await pool.query('SELECT * FROM street_deeds WHERE name=$1', [name])).rows[0];
  assert.equal(returned.account_id, receiverId, 'the actual burn recipient receives the recovered deed');
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
  assert.equal((await sweepDeedReimports(pool)).applied, 0, 'replayed events cannot create another recovery');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM street_deeds WHERE name=$1', [name])).rows[0].n), 1);
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM street_deed_history WHERE account_id=$1 AND kind=$2',
    [receiverId, 'sold'])).rows[0].n), 1, 'the recovery writes one lineage event');
  assert.equal(Number((await pool.query('SELECT COUNT(*) n FROM transactions')).rows[0].n), ledgerBefore,
    'signing, callback-order recovery and replay create no currency ledger movement');
  console.log(`PASS deed reimport event ordering (${postgres ? 'PostgreSQL' : 'pg-mem'}): signed extraction, durable pending burn, exact recipient, once-only recovery and replay`);
} finally {
  await pool.end();
}
