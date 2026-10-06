# Genesis deployment steps

Operator draft, October 6, 2026. The approved route is one NFT-gated ETH/OMR auction. Contracts are not deployed or funded. This is not a ready-to-sign packet.

## 1. Prepare

Provide your public MetaMask deployment address and fund it with native ETH on Robinhood Chain (4663) for gas. Never share a private key or recovery phrase. Confirm two approvers for the existing Safe, 0xBe225658718DCb3865902437887a11830E4a9b10.

Confirm recipient/custody choices, sale inventory, floor price, graduation threshold, liquidity token reserve, fee settings and claim cliff. Recommended treasury, Vig and LP custody is the Safe; founder proceeds go to 0xA87b7A7eEcB6f4c771445f5cBa5bb0d4b29E5ceD. Confirm hook fee and unsold-token recipients separately. The 4.41 million OMR sale inventory remains a proposed packet input. A 50 ETH raise is a scenario, not committed funding.

Public bidding targets Friday, October 9 noon New York through Monday, October 12 noon New York (16:00 UTC each date), 72 hours. Native chain blocks determine auction timing; fresh calibration is required and exact wall-clock boundaries are not guaranteed. Resolve strict UTC requirements before signing.

There is no player tranche, gameplay snapshot or second sale window. Both paid and free-credit character NFTs qualify. NFT ownership does not establish unique-person identity.

## 2. Review the unsigned packet

I will finish review/checks and merge, then generate the final packet from a clean source revision. It must pin source/artifacts, dependencies, Safe ownership, deployer nonce, predicted addresses, economic bounds and transaction simulations. Rehearse the single-auction route and final configuration, including reserve adequacy; preceding two-leg test results do not prove the changed route.

Keep the deployment account idle once its nonce is pinned. If it sends any other transaction, stop and regenerate predicted addresses and calldata. Do not use older external CCA/LBP factories or legacy configuration scripts.

## 3. Sign five deployments

In MetaMask select Robinhood Chain and the approved account. Review each prepared call and wait for confirmation and verification, in order:

1. Protocol liquidity funding adapter.
2. Reserve funding adapter.
3. Single-auction genesis coordinator.
4. Mined market hook through the verified CREATE2 factory.
5. NFT-gated auction, which internally creates its validator.

Five deployment transactions create six contract addresses. Existing OMR, character NFT and character-fee contracts remain in place. Stop if any account/network/value/destination/data differs or a deployment fails; do not reorder or skip calls.

## 4. Fund and bind

The Safe approves two OMR transfers: sale inventory to the auction and matching liquidity reserve to the coordinator. The packet also calls auction onTokensReceived() to register inventory. These three calls may be Safe-batched after review.

The deployment account separately calls coordinator bind(auction). This configurator permission belongs to that account, not automatically to the Safe. That is four contract calls after five deployments: nine contract actions before opening, potentially fewer wallet transactions through batching.

Verify balances, runtime hashes, immutable settings, NFT validator, hook authorization, dependency identities, custody and schedule before accepting bids. Liquidity ETH comes from actual accepted auction proceeds, not the hypothetical 50 ETH estimate. Matching OMR reserve must cover approved price/raise bounds.

## 5. Enable and test the site

Configure the verified public manifest and its pin using GENESIS_AUCTION_MANIFEST_PATH and GENESIS_AUCTION_MANIFEST_SHA256 in the API service. The file must exist in the running service. Verify the automatic production rollout; missing or unverifiable configuration keeps payments disabled.

Use your OMERTA account and MetaMask to check the live network, wallet, schedule, NFT requirement and refusal of early bids. After opening, perform one agreed small real bid and verify its transaction hash and bid ID against chain events. Never repeat a payment whose outcome is unknown.

## 6. Finalize and recover

After the auction ends and graduates, prepare and sign checkpointAuction(), then the simulated migrate() call. Migration atomically creates liquidity from 37.5% of accepted proceeds. There is no additional 48-hour purchase window. Migration may precede the claim cliff; claims require both migration success and the cliff.

Bid owners exit to collect unspent ETH and claim filled OMR under the auction rules. Fixed recipients withdraw their credits. Recover unused auction inventory and coordinator OMR dust through reviewed paths. Assign an operator and backup before opening; unsigned preparation tools are not an unattended production keeper.

Failed graduation uses bid-exit refund paths. Failed migration rolls back atomically and can be retried for recoverable conditions. Graduated, spent bids are not automatically refundable merely because later pool configuration fails; verify immutable dependencies and reserve adequacy before taking funds.

## Remaining blockers

Public deployment wallet/gas; two Safe approvers; final economics/recipients; native-clock calibration; changed-source review and checks; final-plan simulations; release evidence/merge/rollout; actual deployment/funding/binding; production manifest/live bid verification; settlement operator coverage.

The prior 1,325-test result covers the preceding revision, not the new single-auction coordinator. Existing unrelated withdrawal, bond, reserve strategy and automation activation remains separate.
