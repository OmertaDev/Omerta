import assert from 'node:assert/strict';
import { computeBidCommitment, clearComputeAuction } from '../src/resourceauction.js';

const bid = (id, amount) => ({ accountId: `account-${id}`, bidId: `bid-${id}`, bidUsdMicros: amount });
assert.deepEqual(clearComputeAuction({ capacity: 2, reserveUsdMicros: 10, bids: [bid('c', 9), bid('b', 20), bid('a', 30)] }), {
  clearingUsdMicros: 10,
  winners: [{ accountId: 'account-a', bidId: 'bid-a', priceUsdMicros: 10 }, { accountId: 'account-b', bidId: 'bid-b', priceUsdMicros: 10 }],
  losers: ['bid-c'],
});
assert.deepEqual(clearComputeAuction({ capacity: 2, reserveUsdMicros: 10, bids: [bid('c', 20), bid('b', 20), bid('a', 30)] }), {
  clearingUsdMicros: 20,
  winners: [{ accountId: 'account-a', bidId: 'bid-a', priceUsdMicros: 20 }, { accountId: 'account-b', bidId: 'bid-b', priceUsdMicros: 20 }],
  losers: ['bid-c'],
});
assert.deepEqual(clearComputeAuction({ capacity: 1, reserveUsdMicros: 10, bids: [] }), { clearingUsdMicros: 10, winners: [], losers: [] });

// Reproducible pseudo-random permutations exercise ties and allocation invariants.
let seed = 1947;
const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
for (let trial = 0; trial < 200; trial++) {
  const bids = Array.from({ length: Math.floor(random() * 80) }, (_, i) => bid(String(i).padStart(3, '0'), 1 + Math.floor(random() * 20)));
  const capacity = 1 + Math.floor(random() * 20);
  const reserveUsdMicros = 1 + Math.floor(random() * 10);
  const result = clearComputeAuction({ capacity, reserveUsdMicros, bids });
  const shuffled = [...bids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  assert.deepEqual(clearComputeAuction({ capacity, reserveUsdMicros, bids: shuffled }), result);
  assert(result.winners.length <= capacity);
  assert.equal(result.winners.length + result.losers.length, bids.length);
  for (const winner of result.winners) {
    assert(winner.priceUsdMicros <= bids.find(b => b.bidId === winner.bidId).bidUsdMicros);
    assert(winner.priceUsdMicros >= reserveUsdMicros);
    assert(!result.losers.includes(winner.bidId));
  }
  assert(result.losers.every(id => typeof id === 'string')); // No loser charge is emitted.
}

const valid = { capacity: 1, reserveUsdMicros: 1, bids: [bid('a', 1)] };
for (const capacity of [0, 101, 1.5, NaN, '1']) assert.throws(() => clearComputeAuction({ ...valid, capacity }));
for (const reserveUsdMicros of [0, -1, 1e12 + 1, Infinity]) assert.throws(() => clearComputeAuction({ ...valid, reserveUsdMicros }));
for (const bids of [null, {}, Array(1001).fill(bid('a', 1)), [null], [bid('a', 1), bid('a', 2)],
  [bid('a', 1), { ...bid('b', 2), bidId: 'bid-a' }], [bid('a', 0)], [bid('a', 1e12 + 1)],
  [{ ...bid('a', 1), accountId: 'a\nb' }]]) assert.throws(() => clearComputeAuction({ ...valid, bids }));
assert.equal(clearComputeAuction({ ...valid, bids: [bid('a', 1e12)] }).winners[0].priceUsdMicros, 1);

const commitment = { roundId: 'round-a', accountId: 'account-a', bidUsdMicros: 123, nonce: 'abcdef0123456789'.repeat(4) };
const hash = computeBidCommitment(commitment);
assert.match(hash, /^[a-f0-9]{64}$/);
assert.equal(hash, computeBidCommitment({ ...commitment, nonce: commitment.nonce.toUpperCase() }));
for (const patch of [{ roundId: 'round-b' }, { accountId: 'account-b' }, { bidUsdMicros: 124 }, { nonce: '1'.repeat(64) }]) {
  assert.notEqual(hash, computeBidCommitment({ ...commitment, ...patch }));
}
for (const nonce of ['', 'a'.repeat(31), 'a'.repeat(129), 'z'.repeat(64)]) assert.throws(() => computeBidCommitment({ ...commitment, nonce }));
assert.throws(() => computeBidCommitment({ ...commitment, bidUsdMicros: 0 }));
assert.throws(() => computeBidCommitment({ ...commitment, roundId: 'a|b' }));
console.log('resourceauction: allocation, permutation, bounds, and commitment checks passed');
