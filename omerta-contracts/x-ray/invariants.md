# Invariant Map

> OMERTA | 24 guards | 17 inferred | 7 not enforced on-chain

---

## 1. Enforced Guards (Reference)

Per-call preconditions. Heading IDs below are anchor targets from the readiness report.

#### G-1
`vault_.asset() == address(asset_)` · `Alchemist.sol:158` · Prevents denomination mismatch between collateral and the immutable ERC-4626 dependency.

#### G-2
`address(transmuter_.asset()) == address(asset_)` · `Alchemist.sol:159` · Keeps issued DNR and redemption reserves in the same underlying denomination.

#### G-3
`uint256(ltv) + uint256(fee) <= BPS` · `Alchemist.sol:197-199` · Prevents permissionless harvest from making a ceiling position unhealthy solely through its fee.

#### G-4
`assets != 0 && minSharesOut != 0` · `Alchemist.deposit` · Excludes empty deposits and requires the caller to bind ERC-4626 execution slippage.

#### G-5
`debtOf[msg.sender] <= maxDebtOf(msg.sender)` · `Alchemist.sol:288-291` · Preserves per-user collateralization after collateral leaves an escrow.

#### G-6
`transmuter.bufferHealthy()` before and after `Denari.mint` · `Alchemist.mint` · Blocks both issuance from an already-thin buffer and issuance that would itself cross the floor.

#### G-7
`newDebt <= maxDebtOf(msg.sender)` · `Alchemist.sol:305-307` · Caps each user's outstanding debt by current collateral value and LTV.

#### G-8
`msg.sender == controller` · `CollateralEscrow.sol:55-58` · Makes each per-user escrow operable only through its Alchemist controller.

#### G-9
`msg.sender == minter` · `Denari.sol:76-79` · Limits DNR supply expansion to the configured issuer.

#### G-10
`msg.sender == burner` · `Denari.sol:85-88` · Limits arbitrary-address DNR burns to the configured redemption rail.

#### G-11
`bps <= BPS` · `Transmuter.sol:115-118` · Bounds the required reserve ratio to 100%.

#### G-12
`funder[msg.sender]` · `Transmuter.sol:145-147` · Restricts which actors may credit reserve accounting.

#### G-13
`reserves >= assetsOut` · `Transmuter.sol:164-176` · Prevents redemptions from exceeding tracked reserves.

#### G-14
`bps <= MAX_APY_BPS` · `OMRStaking.sol:45-47` · Bounds the reward-rate parameter used by the global index.

#### G-15
`amount <= staked[msg.sender]` · `OMRStaking.sol:89-93` · Prevents principal withdrawals above the caller's credited stake.

#### G-16
`payout <= maxPayout` · `OmertaBond.sol:303-346` · Constrains signed bond output by the live oracle ceiling and configured rate wall.

#### G-17
`block.timestamp <= q.deadline` · `OmertaBond.sol:303-307` · Limits replay of otherwise-valid off-chain bond quotes.

#### G-18
`spent + payout <= dailyCap` · `OmertaBond.sol:340-349` · Enforces the configured daily OMR issuance budget.

#### G-19
`signer != address(0)` · `VoucherClaim.sol:119-126` · Keeps the voucher rail fail-closed until a signer is configured.

#### G-20
`used[digest] == false` · `VoucherClaim.sol:119-129` · Makes each EIP-712 voucher digest one-shot.

#### G-21
`redeemed[tokenId] + amount <= cap[tokenId]` · `GearVault.sol:113-137` · Preserves the live per-ID supply wall across mint and burn/remint cycles.

#### G-22
`msg.sender == keeper` · `StockVault.sol:75-78` · Limits operational inventory delivery to the configured backend actor.

#### G-23
`delivered[deliveryId] == false` · `StockVault.sol:150-157` · Makes a delivery identifier one-shot across single and batch entry points.

#### G-24
`msg.sender == address(poolManager)` · `OmertaHook.sol:246-249` · Restricts stateful swap callbacks to the canonical v4 settlement coordinator.

---

## 2. Inferred Invariants (Single-Contract)

#### I-1

`Bound` · On-chain: **Yes**

> `ltvBps + harvestFeeBps <= 10_000` after every configuration change.

**Derivation** — guard-lift: `_assertLtvFeeCompatible` at `Alchemist.sol:197-199`; all write sites are `setLtvBps:170-175` and `setHarvestFee:203-215`.

**If violated** — harvesting can leave an otherwise ceiling-compliant position above its debt limit.

#### I-2

`Bound` · On-chain: **Yes**

> `debtOf[user] <= maxDebtOf(user)` after mint, withdrawal, repayment, and harvest.

**Derivation** — NatSpec: `Alchemist.sol:37-39`; writes enumerated at `mint:305-310`, `repay:344-347`, and `harvest:407-410`, with post-withdraw check at `288-291`.

**If violated** — a user can hold debt above the market's configured collateral ceiling.

#### I-3

`Conservation` · On-chain: **Yes**

> A successful repayment moves `assets * scale` from user debt into Transmuter redemption reserves, capped by debt outstanding.

**Derivation** — Δ-pair: `debtOf -= debtCleared` at `Alchemist.sol:344-347` ↔ `Transmuter.reserves += credited assets` through `fund` at `145-154`.

**If violated** — repaid DNR debt would cease to correspond to redeemable reserve assets.

#### I-4

`Conservation` · On-chain: **Yes**

> Redeeming DNR decreases `reserves` by exactly `debtAmount / scale` and burns exactly `debtAmount`.

**Derivation** — Δ-pair: `reserves -= assetsOut` at `Transmuter.sol:176-182` ↔ `debtToken.burn(..., debtAmount)` at `180`.

**If violated** — DNR supply and the redemption reserve ledger diverge.

#### I-5

`Bound` · On-chain: **Yes**

> `bufferFloorBps <= 10_000` at every write site.

**Derivation** — guard-lift: `bps > BPS` reverts at `Transmuter.sol:115-118`; this setter is the only write site after initialization.

**If violated** — the system could require more reserves than total DNR supply represents.

#### I-6

`Conservation` · On-chain: **Yes**

> `totalStaked == Σ staked[user]` across stake and unstake transitions.

**Derivation** — Δ-pairs: `staked += amount` with `totalStaked += amount` at `OMRStaking.sol:80-87`; equal decrements at `89-96`.

**If violated** — global-index rewards would use a denominator different from credited principal.

#### I-7

`Conservation` · On-chain: **No**

> The staking contract's OMR principal balance is at least `totalStaked`.

**Derivation** — NatSpec/integration claim at `OMR.sol:16-21`; stake credits the requested amount at `OMRStaking.sol:80-87` without measuring the received balance, while OMR taxation is independently configured at `OMR.sol:146-177`.

**If violated** — credited principal can exceed tokens held by the staking contract.

#### I-8

`Bound` · On-chain: **Yes**

> `apyBps <= MAX_APY_BPS` after every APY update.

**Derivation** — guard-lift: `bps > MAX_APY_BPS` reverts at `OMRStaking.sol:45-52`; this setter is the only write site after initialization.

**If violated** — reward liabilities could grow beyond the hard-coded economic envelope.

#### I-9

`Conservation` · On-chain: **Yes**

> Bonded OMR minted but not yet claimed equals `totalCommitted - totalClaimed` and remains unsweepable.

**Derivation** — Δ-pair: `totalCommitted += payout` at `OmertaBond.sol:350-353` ↔ `totalClaimed += amount` at `370-379`; sweep bound uses the same difference at `419-425`.

**If violated** — owner sweeps or claims could consume OMR committed to other bonds.

#### I-10

`Temporal` · On-chain: **Yes**

> A bond quote expires at its deadline and may be no more than `MAX_QUOTE_TTL` into the future.

**Derivation** — temporal: `block.timestamp > q.deadline` and `q.deadline > block.timestamp + MAX_QUOTE_TTL` at `OmertaBond.sol:303-307`.

**If violated** — old rate authorizations could remain usable through changed market conditions.

#### I-11

`StateMachine` · On-chain: **Yes**

> Each signed voucher digest transitions once from unused to used before its external value transfer or mint.

**Derivation** — edge: `used[digest] == false` → `used[digest] = true` at `VoucherClaim.sol:119-134`, `DynastyNFT.sol:149-164`, and `StreetDeed.sol:159-180`.

**If violated** — one authorization could be redeemed more than once.

#### I-12

`Bound` · On-chain: **Yes**

> For every gear ID with a nonzero cap, `redeemed[id] <= cap[id]` after mint and redeem.

**Derivation** — guard-lift: mint checks the resulting lifetime counter at `GearVault.sol:113-137`; cap lowering checks existing redeemed supply at `80-87`; redeem does not decrement the counter at `142-154`.

**If violated** — burn/remint cycles could exceed the configured lifetime issuance wall.

#### I-13

`StateMachine` · On-chain: **Yes**

> Each StockVault delivery ID transitions once from undelivered to delivered before token transfer.

**Derivation** — edge: `delivered[deliveryId] == false` → `delivered[deliveryId] = true` at `StockVault.sol:150-165`.

**If violated** — the same off-chain delivery instruction could release inventory repeatedly.

#### I-14

`Bound` · On-chain: **Yes**

> Base sell tax and surge tax are each capped at 10%, and recipient shares sum to 100% when enabled.

**Derivation** — guard-lift: setter checks at `OmertaHook.sol:265-280` and `334-350`; these are the only post-constructor write sites.

**If violated** — hook settlement deltas could exceed the intended swap-fee envelope.

#### I-15

`Temporal` · On-chain: **Yes**

> Same-block deposit→mint and deposit→withdraw are rejected per Alchemist user.

**Derivation** — temporal: `_recordEntry` at `Alchemist.sol:267-270` and `notSameBlockAsEntry` on `withdraw:277` and `mint:296` via `FlashGuard.sol:64-78`.

**If violated** — atomic entry/issuance/exit sequences would bypass the intended time separation.

#### I-16

`Conservation` · On-chain: **No**

> Hook surge computation uses the pre-swap price written by the matching `beforeSwap` callback.

**Derivation** — NatSpec/state-flow: `beforeSwap` writes one shared transient `PRE_PRICE_SLOT` at `OmertaHook.sol:428-448`; `afterSwap` makes `_observe` external callback at `477-488` before `_sellRate` consumes that slot at `536-560`.

**If violated** — the fee computation can use a snapshot from a different nested swap.

#### I-17

`StateMachine` · On-chain: **No**

> A burned StreetDeed token ID retains its original district classification when reminted.

**Derivation** — NatSpec immutability claim at `StreetDeed.sol:83-88`; `redeem` burns at `194-202`, while a later fresh digest writes `districtOf[tokenId] = v.district` at `159-180`.

**If violated** — canonical metadata for a reused name-derived token ID can change over time.

---

## 3. Inferred Invariants (Cross-Contract)

#### X-1

On-chain: **No**

> The reserve increase credited by `Transmuter.fund(assets)` equals the asset tokens actually received.

**Caller side** — `Alchemist.sol:325-347` — repayment approves and funds the amount returned by debt scaling.

**Callee side** — `Transmuter.sol:145-154` — `reserves += assets` uses the requested amount without a balance delta check.

**If violated** — tracked backing can exceed actual reserve-token holdings.

#### X-2

On-chain: **No**

> `OMRStaking.stake(amount)` receives exactly `amount` OMR before crediting user and global principal.

**Caller side** — `OMRStaking.sol:80-87` — credits `staked` and `totalStaked` by the input amount after `safeTransferFrom`.

**Callee side** — `OMR.sol:146-205` — owner-controlled pair/exemption state can cause a transfer to deliver less than its nominal amount.

**If violated** — the staking principal ledger becomes undercollateralized.

#### X-3

On-chain: **No**

> `CollateralEscrow.totalAssets()` remains a manipulation-resistant value for Alchemist collateral checks.

**Caller side** — `Alchemist.sol:246-255` — uses the ERC-4626 conversion directly to set the borrow and withdrawal ceiling.

**Callee side** — `CollateralEscrow.sol:71-96` — owns vault shares and delegates valuation to the immutable external vault.

**If violated** — collateral capacity follows the dependency's share-price behavior rather than locally measured assets.

#### X-4

On-chain: **Yes**

> Gear voucher issuance cannot exceed GearVault's live per-ID supply cap even if VoucherClaim's own cap differs.

**Caller side** — `VoucherClaim.sol:119-153` — calls `GearVault.mint` after its voucher and optional local-cap checks.

**Callee side** — `GearVault.sol:113-137` — independently checks lifetime redeemed amount against the live vault cap.

**If violated** — a stale backend cap could exceed the canonical on-chain asset wall.

#### X-5

On-chain: **No**

> OmertaBond's normal-operation oracle describes OMR/WETH rather than OMR paired with another counterasset.

**Caller side** — `OmertaBond.sol:272-289` — interprets `consult()` as OMR per ETH for the issuance ceiling.

**Callee side** — `OmrTwapOracle.sol:62-92` — constructor checks that the pair contains OMR but does not identify the other token as WETH.

**If violated** — the rate ceiling is denominated in an unintended counterasset.

#### X-6

On-chain: **Yes**

> An observer callback cannot mutate PoolManager's in-flight swap settlement.

**Caller side** — `OmertaHook.afterSwap` emits `ObservationRequested` and performs no observer call.

**Callee side** — permissionless `pokeObserver` accepts only a pool this hook opened and invokes the
Safe-selected observer with a 150,000-gas stipend after the original PoolManager unlock has ended.

**If violated** — the production PoolManager regression with an observer that leaves an unsettled
currency delta would revert an otherwise-valid outer swap.

---

## 4. Economic Invariants

#### E-1

On-chain: **Yes**

> DNR supply is backed economically by the sum of outstanding scaled debt and tracked Transmuter reserves, while per-user debt stays within collateral LTV.

**Follows from** — `I-2` + `I-3` + `I-4`

**If violated** — DNR redemption liabilities can exceed collateralized debt plus reserve assets.

#### E-2

On-chain: **No**

> Tracked DNR redemption reserves never exceed actual reserve-token balances.

**Follows from** — `I-4` + `X-1`

**If violated** — nominally redeemable DNR can fail due to missing reserve assets.

#### E-3

On-chain: **No**

> OMR staking principal and accrued rewards remain payable from the staking contract's OMR balance.

**Follows from** — `I-6` + `I-7` + `X-2`

**If violated** — principal or rewards become first-come, first-served claims on an insufficient balance.

#### E-4

On-chain: **No**

> Bond issuance never exceeds the intended OMR-per-ETH ceiling derived from an OMR/WETH market.

**Follows from** — `I-9` + `I-10` + `X-5`

**If violated** — signed quotes can satisfy the arithmetic ceiling while using the wrong economic denomination.
