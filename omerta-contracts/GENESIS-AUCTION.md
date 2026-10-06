# Genesis auction

The approved launch uses one native ETH auction for OMR. Every bid recipient must own a minted character NFT when bidding; paid and free-credit mints qualify. NFT transfers do not revoke existing refund or claim rights. Ownership is admission, not a unique-person guarantee.

The public target is October 9, 2026 noon New York through October 12 noon New York, 72 hours. The auction uses native chain blocks and requires fresh calibration; exact UTC boundaries are not enforced.

`OmertaGuardedAuction` deploys its fixed `GenesisCharacterBidValidation` internally, rejects caller-supplied validators and gates both token claim paths on successful liquidity migration and the auction claim cliff. Bid exits retain the pinned auction semantics.

`OmertaAuctionCoordinatorV2` binds one auction before bidding, pins its dependencies and hook, checkpoints the graduated clearing price and atomically creates initial market liquidity. There is no player tranche, gameplay snapshot, second purchase window or per-wallet player settlement dependency. The technical `playerClaimsOpen()` function remains solely for compatibility with the guarded auction's claim interface.

Deploy the two funding adapters, coordinator, mined hook and auction: five deployment transactions, six new addresses including the validator. Transfer OMR to the auction and coordinator reserve, register auction inventory and bind the auction. Reuse existing OMR, character NFT and fee deployments after verification.

Liquidity receives 37.5% of accepted ETH proceeds; full-range spending must consume 99–100% of that budget. Remaining ETH is credited 40% treasury, 36% Vig and the exact remainder 24% founder. Matching OMR reserve is mandatory. Temporary allowances are revoked atomically and LP custody uses the approved fixed owner. Funding adapter deployment does not activate reserve strategies.

After auction completion and graduation, checkpoint and migrate. Migration need not wait for the claim cliff; claims require both success and the cliff. Owners exit to obtain unspent ETH and claim filled OMR under the auction rules. Failed graduation provides bid-exit refunds. Failed migration rolls back and can be retried for recoverable conditions; graduated, spent bids are not refunded solely because later pool configuration fails.

Follow the [deployment steps](GENESIS-LAUNCH-STEPS.md). Use the new `tools/genesis-auction-deployment-plan.js`, verified preflight and final-configuration simulations. Older external CCA/LBP factories and legacy deployment/configuration scripts do not construct this route.

Review conclusions apply to exact source and phase. Source checks, example dependency forks, final-plan rehearsals, deployed runtime verification, funding, website activation and a signed production bid are distinct gates. Other market rails remain separate activation work.
