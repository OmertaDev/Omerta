# Genesis deployment checklist

Preparation checklist for the approved five-day NFT-gated auction. The signing packet is not ready until review, hosted checks and final-plan verification pass. Do not use the superseded nonce-27 preview.

1. Select deployer 0x5aE54B5555ae5dC9F899e03cB9aaC74dCcDc4E7E in MetaMask on Robinhood Chain (4663). Verify gas funding. Confirm two owners can approve the Safe's token funding.
2. Receive the verified signing packet: source/artifact and report pins, fresh nonce, predicted addresses, gas estimates, dependencies, Safe roles, schedule and simulations. Review the 40M sale / 20M LP / 40M retained bonds, 50% accepted ETH LP budget, Family Yield remainder, 10 ETH graduation and floor, and claims at closure. LP opens at its funded price, which can differ from the final auction price.
3. Keep the deployer idle once this final packet's nonce is pinned. A new outgoing transaction requires regeneration. Before that final pin, old preview nonces need not be preserved.
4. Sign deployment 1: Core liquidity funding adapter. Wait for confirmation and verify the deployed code/settings.
5. Sign deployment 2: reserve funding adapter. Verify before continuing.
6. Sign deployment 3: the approved single-auction coordinator. Verify its Safe, NFT, token reserve and immutable dependencies.
7. Sign deployment 4: the mined market hook through the verified CREATE2 factory. Verify its address, permissions, coordinator authorization and pool key.
8. Sign deployment 5: the NFT-gated auction. Verify inventory, native start/end, claim block equal to end, minimum raise, floor, fixed validator and stored release schedule.
9. With two Safe owner approvals, execute the verified funding batch: transfer 40M OMR to the auction, transfer 20M OMR to the coordinator, and call auction onTokensReceived(). Verify 40M remains in the Safe for bonds. Bond operation is not activated by retaining these tokens.
10. From the deployer, sign coordinator bind(auction). Verify successful binding before the opening block.
11. Verify every deployed runtime and immutable policy, funded balances and registered inventory. Configure the API's pinned production manifest and verify the site rollout. Payments remain unavailable without this verification.
12. Before opening, test refusal of early bids and verify NFT/account/network details. After opening, conduct one agreed small user-signed bid and verify its transaction hash and bid ID. Keep unknown or pending payments locked until their outcome is confirmed.
13. At successful closure, owners exit their bids to recover unused ETH and claim filled tokens. Migration is not a prerequisite for their claims. Failed graduation uses full bid refunds.
14. The assigned operator checkpoints the final auction and executes simulated migration. Verify actual 50% ETH funding, approximately 20M OMR paired within the rounding bound, Safe LP custody, zero temporary allowances and all remaining accepted ETH credited to the Family Yield Safe. Recover tightly bounded LP token dust and unused sale inventory to the Safe, separately from the bond allocation.

There are five EOA deployment transactions and four funding/configuration calls before opening. Safe owner approvals are additional signatures; the funding calls can be batched. Five main contracts plus the internally created NFT validator and read-only auction schedule store produce seven addresses. The earlier six-address count omitted the schedule store; deployment transaction count stays five.

Existing OMR, character NFT and character-fee contracts are reused after verification. Core/reserve adapters are created without activating their future strategy controllers. No automatic Family Yield conversion/distribution or bond activation is part of genesis deployment.

No private keys or recovery phrases are requested. The user reviews and signs wallet transactions; the agent prepares and verifies them. A failed deployment or changed nonce stops the sequence for regeneration. All step addresses, values and data must match the final verified packet.
