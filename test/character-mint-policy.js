import assert from 'node:assert/strict';
import { verifyCharacterMintPolicy, verifyCharacterNftPolicy } from '../tools/character-nft-preflight.js';

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

const identityCalls = [];
assert.deepEqual(await verifyCharacterNftPolicy(async (name, args) => {
  identityCalls.push([name, args]);
  return true;
}, 1n), { soulbound: true, interfaceId: '0xb45a3c0e', verified: true });
assert.deepEqual(identityCalls, [['supportsInterface', ['0xb45a3c0e']], ['locked', [1n]]]);
await assert.rejects(() => verifyCharacterNftPolicy(async () => false),
  (error) => error.code === 'character_nft_policy_mismatch');
await assert.rejects(() => verifyCharacterNftPolicy(async (name) => name === 'supportsInterface', 1n),
  (error) => error.code === 'character_nft_policy_mismatch');
await assert.rejects(() => verifyCharacterNftPolicy(async () => { throw new Error('RPC unavailable'); }),
  (error) => error.code === 'character_nft_policy_unavailable');

console.log('PASS character preflight: exact DEV allocation and soulbound NFT policy; stale or unreadable deployments unready');
