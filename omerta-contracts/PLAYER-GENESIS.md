# Player Genesis contract preparation

For the approved launch, follow [Genesis auction](GENESIS-AUCTION.md) and the
[deployment steps](GENESIS-LAUNCH-STEPS.md). This file describes the retained
two-leg implementation and its source review; it is not the selected deployment route.

Source implementation for the player-first launch. No production deployment, funding or activation
is performed by this work. The [review package](audits/2026-10-01-player-genesis/report.md) states
the exact verified scope and outstanding release work.

## Contracts and enforceable rules

- `GenesisPlayerSale`: immutable eligibility root and inventory, cumulative per-wallet ETH caps,
  character NFT ownership on each contribution, a 48-hour purchase window, proportional settlement,
  pull refunds and gated OMR claims.
- `OmertaGuardedAuction`: pinned public CCA implementation with an immutable common claim gate.
  Both single and batch token claims require successful pool creation and the auction claim cliff.
  Bid exits and unspent-currency refunds preserve the pinned CCA's behavior.
  Every bid also requires the token recipient to own a character NFT; relayers may fund that recipient.
- `OmertaGenesisCoordinatorV2`: the current market's authorized initializer. It atomically sweeps
  public proceeds and accepted player proceeds, initializes the pool and mints a real full-range
  PositionManager NFT to the approved liquidity owner. Any failure rolls the transaction back.

One play day allows 0.5 ETH, two 1 ETH, three 2.5 ETH, and four or five 5 ETH. Qualifying gameplay
is verified off-chain during the maximum 120-hour play window. The contract verifies the snapshot
proof, not gameplay or uniqueness of a human. Publish exact UTC opening/cutoff timestamps and
the meaningful-action definition before charging for character creation.

Both free-credit and paid character mints qualify. Ownership is checked at purchase time, not when
settling, refunding or claiming an accepted purchase. NFTs are transferable: this admission rule does
not establish one human per wallet or prevent an NFT from being transferred between purchasers.
The gameplay snapshot and per-wallet caps remain separate checks. Both sale legs must bind the same
reviewed character NFT address; its deployed runtime and chain must be verified before release.

Player caps apply to requested contributions across all transactions in this tranche. Public
auction bids remain uncapped. Oversubscription scales token quantities proportionally; accepted
ETH is rounded up to cover the allocated token base units and excess ETH is refundable after
successful migration. No refundable ETH enters the liquidity budget.

## Deployment and settlement order

1. Pin the current market dependencies and recipient addresses. Predict the coordinator and mined
   hook addresses so the hook's `authorized` initializer is the coordinator. Deploy and verify them.
   Choose an LP token reserve sufficient for both approved sale inventories and final price bounds.
2. Deploy `OmertaGuardedAuction` directly, with OMR, native ETH, the coordinator as `fundsRecipient`
   and `launchGate`, an approved unsold-token recipient, the reviewed character NFT, and the approved public
   schedule/graduation/claim parameters. Fund its inventory and call `onTokensReceived()`.
   Pass zero as the caller-supplied validation hook: the guarded constructor deploys and installs its
   fixed ownership validator internally. Arbitrary caller-supplied validators are rejected.
   This guarded variant intentionally has no protocol fee controller.
3. Freeze the gameplay snapshot. Predict the player sale's CREATE address from the deployer's
   exact nonce; construct double-hashed leaves:
   `keccak256(bytes.concat(keccak256(abi.encode(chainId, saleAddress, wallet, uint8(playDays)))))`.
   Export `playDays` as `min(distinct qualifying UTC dates inside the window, 5)`; a 120-hour
   window can touch six UTC dates if it opens between midnights. Sort sibling hashes when building
   proofs. Each wallet must appear exactly once. CREATE2 with
   a root in constructor arguments creates a root/address circular dependency; use the reviewed
   CREATE nonce sequence instead. Deploy/fund the sale and bind both legs before public bidding.
4. Set the sale's `openDeadline` after expected public completion, and `migrationDeadline` strictly
   later than `openDeadline + 48 hours`, with enough time for settlement and operational recovery.
   Publish these immutable deadlines. Convert the public claim cliff using the native auction
   block clock; its cliff is absolute, not a new delay measured from migration.
5. After the public auction ends and graduates, call `checkpointAuction()` to pin its final Q96
   price. Then permissionlessly `open()` the player sale. Opening fixes the 48-hour payment window.
6. After that window, permissionlessly `settle(wallet)` for every contributor. No unbounded loop
   runs inside the contract. Keep a contributor index from events and settle all wallets before
   the migration deadline. Call `migrate()`; both sale legs and liquidity initialization are atomic.
7. After successful migration and the public claim cliff, both legs can claim. Player contributors
   withdraw refunds individually. Fixed residual recipients withdraw their own credits. Recover
   unused player inventory and coordinator OMR dust to their fixed recipients.
8. If the player migration deadline expires before success, anyone can `cancel()` the player sale.
   Players receive full ETH refunds. `migratePublicAfterCancellation()` permits atomic public-only
   liquidity creation so player cancellation cannot veto the public launch. Public failed-graduation
   refunds follow the auction's normal bid-exit paths.

The liquidity budget is 37.5% of combined accepted proceeds. Actual full-range ETH spending must
be between 99% and 100% of that budget; arithmetic dust joins residual proceeds. Those residuals
split 40% treasury, 36% Vig and the exact remaining 24% founder. Recipient calls cannot block launch
because credits are withdrawn afterward. Matching OMR inventory is required; ETH cannot silently
substitute for insufficient LP tokens. Temporary ERC20/Permit2 allowances are revoked atomically.

## Release boundaries

Existing external CCA/LBP factories and the older Genesis deployment/configuration/keeper tools
do not implement this guarded route. Do not broadcast their calldata for this plan. Prepare new
unsigned deployment/preflight/keeper integration, exact runtime/recipient verification and a
production-stack fork rehearsal before release. Keep unrelated market economics unchanged.

The eligibility exporter and UI are separate work: enforce one account/wallet slot, record meaningful
play days, resolve appeals and produce reproducible proofs. These contracts do not supply that data.
The 10% player inventory share remains a planning proposal; constructors take explicit inventories
and do not mint or silently move inventory out of an existing public commitment.

The public CCA does not refund spent, graduated bids because pool configuration later fails.
Cancellation recovery makes public-only initialization retryable, but cannot repair permanently
wrong immutable dependencies. Verify dependency identities, hook authorization, inventories, price
bounds, custody and real liquidity execution before accepting public bids.

Run focused verification with Solidity 0.8.26, optimizer 800, Cancun. The current-market coordinator
and its integration tests use the existing via-IR restriction; auction and sale use the default
compiler profile. Source changes require the scoped policy review and retained test evidence.

The [source red-team report](audits/2026-10-01-red-team/report.md) records the reviewed
implementation, fixes, regressions and remaining deployment boundaries. Passing source tests
does not replace the unsigned preflight and production-stack rehearsal required above.
