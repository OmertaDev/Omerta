// Demonstrates exact six-decimal reserve exhaustion without touching a real account or chain.
import assert from 'node:assert/strict';
import { drainQueue } from '../src/chain.js';
process.env.CHAIN_ID = '4663';
process.env.VOUCHER_CLAIM_ADDRESS = `0x${'11'.repeat(20)}`;
process.env.VOUCHER_SIGNER_PK = `0x${'0'.repeat(63)}1`; // public synthetic test key, never a production credential
const funded = '9000000000.000001', amount = '9000000000.000002';
const writes = [];
const q = { release() {}, query: async (sql, args = []) => {
  if (/SELECT \* FROM chain_reserve/.test(sql)) return { rows: [{ funded_omr: funded }] };
  if (/SUM\(amount\)/.test(sql)) return { rows: [{ s: '0' }] };
  if (/SELECT \* FROM vouchers/.test(sql)) return { rows: [{ id: 'synthetic-queue', kind: 'omr', amount,
    to_address: `0x${'22'.repeat(20)}`, nonce: 1, deadline: 1 }] };
  if (/UPDATE vouchers/.test(sql)) writes.push(args);
  return { rows: [], rowCount: 1 };
} };
const result = await drainQueue({ connect: async () => q });
assert.equal(result.signed, 0, 'a six-decimal claim one micro above exact backing must remain queued');
assert.equal(writes.length, 0);
console.log('PASS exact reserve edge cannot sign a six-decimal claim one micro above backing');
