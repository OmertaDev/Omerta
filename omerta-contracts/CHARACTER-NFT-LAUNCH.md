# Character NFT release preparation

This is the first activation workstream for OmertaFees and DynastyNFT. The local rehearsal is
working; the public checkout is not released. This document does not replace the existing
[mainnet deployment scope and review gates](DEPLOYMENT.md) or authorize a new broadcast.
The current [agent-led security review policy](SECURITY-REVIEW-POLICY.md) governs this work.
The [September 8 review](audits/character-nft-2026-09-08.md) records findings, fixes and open items.

**Character mint allocation amendment — September 8:** character creation payments through
`payMintFee()` now go **100% to `DEV_WALLET`**, stored on-chain as `feeRecipient`.
The [amendment review](audits/2026-09-08-mint-dev-allocation/report.md) binds this change and its
retests separately from the earlier reviews. No Vig, treasury or community share is booked from
these mint payments. Respawn, reroll and package fees keep their existing splits. The intended
production chain remains Robinhood mainnet **4663**; its final public DEV address is still required.

## What the first release does

A player creates an invited game account and character, proves their wallet with the current EIP-191 link challenge, pays
`OmertaFees.payMintFee()`, and spends the confirmed mint credit at `POST /v1/character/mint`.
An eligible made account requests its one DynastyNFT voucher at `POST /v1/identity/mint`,
then submits `DynastyNFT.claim(voucher, signature)` from its wallet. The worker records
the mint against the originating account. Existing made accounts are also eligible; the
NFT route does not charge another identity fee. Existing gameplay methods of earning a
mint credit remain in place.

The NFT is a transferable portrait. The game account, login, and made entitlement stay
with the original account. The first transfer freezes the portrait when it is confirmed and indexed;
the snapshot contains the account state observed then, not reconstructed transfer-time history. The collection has no
lifetime supply cap; the current testnet mint rate is capped at ten per day. This workstream
does not require OMR issuance, a liquidity pool, a bond sale, the Bank, or token withdrawals.

## Existing testnet deployment (historical fee policy)

The [deployment manifest](deployments/46630/manifest.json) records the contracts already
deployed on Robinhood Chain Testnet. The network is chain **46630**, with ETH as its gas
currency; see [Robinhood's deployment documentation](https://docs.robinhood.com/chain/deploy-smart-contracts/).

| Component | Address / value |
| --- | --- |
| OmertaFees | `0xf89405e54F699bE14bff01d3c2edb017029B3F7A` |
| DynastyNFT | `0x13B76A0F73b6879423Cf4fB69B09F75e5c9b01f0` |
| Owner Safe | `0x895fC13973f66Aa39A1fB27F4a3245c6aC9717B0` |
| NFT voucher signer | `0x5CCD83A89b9cd1C4544679dec2087dfe04c06b62` |
| Mint fee | `10000000000000000` wei = 0.01 test ETH |
| Historical fee distribution | 75% dev recipient, 25% Vig recipient, including mint fees |
| NFT daily cap | 10 |
| NFT royalty | 5% to the Safe, subject to marketplace support |

This immutable fee deployment predates the 100% DEV amendment and is not eligible for the current
paid character checkout. It cannot be changed to the new mint routing with `setRecipients` or
`setFees`; deploy the revised OmertaFees and verify its runtime and `mintDevBps() == 10000`.
The read-only tool checks this historical target against current policy and reports it unready:

```sh
npm run character:preflight
```

The [historical readiness report](deployments/46630/character-nft-readiness.json) records the
earlier observed block, chain configuration, contract state and code hashes. It is retained as
evidence of that earlier policy, not current activation readiness. `--write-report` now retains a
separate timestamped result under `output/character-nft/preflight/`; it does not overwrite the old
report. A missing or incorrect `mintDevBps()` leaves the current check unready. Source review,
explorer verification, and an actual user payment and mint are separate evidence.
The initial September 8 verification observed no fee payments and no NFTs yet.

## Repeatable local evidence

```sh
npm run character:rehearsal
node test/chain.js
node test/watcher.js
node test/portrait.js
node test/preflight.js
node test/character-mint-policy.js
```

The rehearsal requires Foundry (`forge` and `anvil`) and Solidity 0.8.26. It discovers the
usual `~/.foundry/bin` installation, with `FORGE_BIN`, `ANVIL_BIN`, and `SOLC_BIN` overrides
for local executable paths. It builds the two current contracts, starts a fresh loopback
Anvil chain, and uses a disposable in-memory database. It accepts no remote RPC, wallet,
or database target; deployment secrets and service settings from the caller's environment
do not reach the backend. The process closes the backend and its node on completion.

Each report is retained in `output/character-nft/rehearsals/<timestamp>-mint-dev.json`. It records the source
commit, dirty/clean state, relevant source and artifact hashes, and passed checks:

- Invited account creation and wallet proofs for the minter and a later recipient.
- Rejection before account mint and of a wrong fee, 100% DEV delivery, zero Vig delivery,
  and absence of mint allocations in Vig, treasury and community revenue.
- Real fee-event decoding, single credit, and repeat-safe credit consumption.
- Voucher issuance only to the linked wallet, one pending voucher, and actual EIP-712 claim.
- Rejection of replay, correct account attribution, and a durable claimed voucher.
- Metadata resolution, portrait freezing after transfer, and account entitlement separation.

This proof uses the real contracts and watcher decoders with pg-mem and zero local
confirmations. It does not prove PostgreSQL concurrency, public RPC availability, a browser
wallet flow, or production finality. Run the targeted Solidity suites with the pinned
Foundry toolchain in `omerta-contracts` as well:

```sh
forge test --match-contract DynastyNFTTest
forge test --match-contract OmertaTest --match-test 'test_(.*fee.*|.*package.*|.*recipient.*|.*forward.*|.*reentra.*)'
```

## Backend fixes included in this workstream

Previously a voucher could target an arbitrary address, while the mint recorder assigned
the account by whichever account had that wallet linked when the event arrived. A token
could lose its originating account attribution, and a claimed voucher was not marked
claimed. Once its deadline passed, the original account could obtain another voucher.

The recipient must now match the linked wallet. The mint recorder uses the persisted nonce
to recover the originating account and marks the voucher claimed in the same transaction.
A changed wallet or a Transfer-created registry row cannot reassign the account authority.
Replacement after expiry requires an unused nonce at a confirmation-depth block whose
timestamp is past the old deadline. An unavailable or wrong chain leaves the prior request
pending instead of issuing a second NFT authorization.

The follow-up review persists the original EIP-712 domain with each authorization and refuses
replacement against another deployment or an unbound legacy record. Transfer indexing waits for
Minted provenance and stores block/log order so older backfills cannot roll ownership backwards.
Reconciliation clears an incorrect legacy snapshot if wallet reassignment had attached it to a
different account. Real fee and store indexing also refuse a Vig split that disagrees with the
contract's immutable non-mint split. The amended mint rail additionally requires
`mintDevBps() == 10000`; a legacy fee contract cannot pass by changing the backend environment.

## Next activation milestone

Prepare a separate testnet web service, worker, and database using the same amended release,
with a new OmertaFees deployment implementing the current policy. Do not point the production
player database at testnet: fee/voucher nonces and watcher cursors are durable database state
and are not portable between chain deployments. A fee contract replacement also needs fresh
deployment-scoped indexing state or a reviewed migration; do not merely replace its address in
an existing database. The testnet service will need verified values for:

```dotenv
CHAIN_ID=46630
CHAIN_RPC_URL=https://rpc.testnet.chain.robinhood.com
OMERTA_FEES_ADDRESS=<NEW_REVIEWED_FEE_DEPLOYMENT>
DYNASTY_NFT_ADDRESS=<VERIFIED_NFT_DEPLOYMENT>
CHAIN_START_BLOCK=<REVIEWED_DEPLOYMENT_START_BLOCK>
CHAIN_CONFIRMATIONS=5
VIG_BPS=2500
```

These are placeholders for a future testnet rehearsal, not a complete deploy environment. Both services
must retain their normal hardened settings and share the separate testnet database.
Load the dedicated testnet voucher signer through the service's secret manager
and verify its derived address against the target NFT and manifest. Do not put its private key in this
file. Do not configure the other contract addresses for this milestone. Start block and
confirmation depth affect only new watcher cursors; existing cursors need explicit review.
Five confirmations mirrors the current watcher default; it is not a mainnet finality decision.
Robinhood describes its public RPC as rate-limited and recommends a provider for production;
see [network configuration](https://docs.robinhood.com/chain/connecting/).

Before opening that checkout to players, finish these specific release items:

1. **Wallet checkout and claim.** The existing UI proves a wallet, but has no fee-payment
   transaction flow. Its portrait button requests a voucher and reports it as signed; it
   does not submit `claim`. Add explicit network/fee display, correct-chain verification,
   fee submission and confirmation, then NFT claim submission. Recover an existing signed
   voucher after refresh or wallet rejection instead of requesting another one. Show the
   transaction receipt and NFT only after their respective confirmations.
2. **Testnet metadata routing.** The contract's live base URI must resolve to the service
   whose worker indexes these testnet token IDs. Token IDs alone do not distinguish chains.
   Verify the actual URI before the first testnet mint and prepare a Safe `setBaseUri`
   transaction if needed; keep JSON and portrait SVG public through the invite gate.
3. **Persistent database rehearsal.** Exercise restart/backfill, delayed claim indexing,
   expiry replacement, and concurrent requests on PostgreSQL using the dedicated testnet
   account. Record the actual fee and claim transaction hashes, metadata, and worker cursor
   evidence. A local passing report cannot substitute for this rehearsal.
4. **Mainnet release package.** Freeze the exact source revision and deployment scope,
   complete the scoped contract plus off-chain signer review required by `DEPLOYMENT.md`,
   and record the Safe ceremony, final fee/cap/royalty/metadata parameters, confirmation
   policy, and monitoring. Bind the review report hash to the actual retained artifact and source;
   the existing scripts check the hash's format but do not verify the report contents or scope.
5. **Wallet proof and deployment binding.** Upgrade the custom EIP-191 wallet-link message to
   origin-bound ERC-4361 before public paid checkout, with explicit wallet support. Enforce a durable
   chain/contract database fingerprint before enabling indexers; the current dedicated-database rule
   must also survive an accidental environment change. These findings remain open in the review.

If minting needs to stop after activation, disable new voucher issuance and have the Safe
pause DynastyNFT mints. Pausing does not stop NFT transfers. The fee contract has no pause:
closing the web checkout alone does not prevent direct fee payments, so keep fee indexing
running and retain a documented recovery path for any payment already sent.
