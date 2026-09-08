import assert from 'node:assert/strict';
import { verifyCharacterMintPolicy } from '../tools/character-nft-preflight.js';

const policy = await verifyCharacterMintPolicy(async (name) => {
  assert.equal(name, 'mintDevBps');
  return 10_000n;
});
assert.deepEqual(policy, { mintDevBps: 10_000n, mintVigBps: 0n,
  recipientGetter: 'feeRecipient', verified: true });

for (const value of [0n, 2500n, 7500n, 10_001n]) {
  await assert.rejects(() => verifyCharacterMintPolicy(async () => value),
    (error) => error.code === 'character_mint_policy_mismatch');
}
await assert.rejects(() => verifyCharacterMintPolicy(async () => {
  throw new Error('legacy deployment does not implement mintDevBps');
}), (error) => error.code === 'character_mint_policy_unavailable');
await assert.rejects(() => verifyCharacterMintPolicy(async () => {
  throw new Error('RPC unavailable');
}), (error) => error.code === 'character_mint_policy_unavailable');

console.log('PASS character mint preflight: exact 10000 DEV policy; stale or unreadable deployments unready');
