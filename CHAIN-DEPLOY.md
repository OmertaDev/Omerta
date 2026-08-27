# OMERTÀ — chain go-live runbook (the on-chain rail)

The mainnet-prep sequence for the §11 chain layer — the counterpart to `DEPLOY.md` (which covers the
off-chain game). The chain layer is **dormant by default**: the backend runs the full game with ZERO chain
config, and each on-chain rail activates only when its env vars are set. This runbook is how you deploy the
contracts, hand them to the Safe, fund the reserves, and switch the rails on — **after** the three hard gates
below clear.

Everything here is REHEARSABLE on a devnet/testnet today (that's what `tools/chain-e2e.js` does). **Nothing
touches mainnet** until §0 is satisfied.

> **RWA AUTOMATION AMENDMENT — 2026-08-24 (authoritative over older “gateless StockVault” passages).**
> The RWA surface now includes `StockTokenRegistry`, `RwaStockBuyer`, and StockVault's EIP-712
> `allocationSigner`. Production delivery is not keeper-asserted: once the Safe sets that signer,
> legacy `deliver`/`deliverBatch` are disabled and every push binds the frozen epoch, account, exact
> token, deed TBA, units, delivery id, and deadline. The Safe curates the candidate registry; the
> server publishes one closed-day family result; the buyer resolves its token from that day and cannot
> accept a keeper-supplied address. All three deploy/operate disabled until the ceremony below. The
> venue adapter, independent quote/TWAP oracle, third-party audit, mainnet funding, and written launch
> review of the founder's no-in-game-KYC posture are still open gates. Historical “gateless keeper” text
> below describes the superseded 2026-08-14 authorization posture; delivery itself intentionally has no
> identity, residency, sanctions, or jurisdiction check.

---

## 0. The three HARD GATES (no mainnet step proceeds until all three are green)

1. **`forge test` passes on a real Foundry toolchain. ✅ EXECUTED 2026-07-23 — 73/73 PASS; 128/128 after
   the v4 sell-tax hook** (incl. five 512-run fuzzes: OMR sell-tax conservation, the OmertaBond
   anti-Ponzi bound, the four-wall mint-rate bound, TWAP decode overflow, and the hook's fee-split
   dust) via the official
   npm-distributed forge 1.7.1 in the sandbox (`cd omerta-contracts && ./run-forge-test-sandboxed.sh`
   — forge-std/OZ from npm, solc via a solc-js 0.8.26 stdio shim: the emscripten build of the SAME
   compiler version+commit as native). The run surfaced and fixed a latent test-harness class (inline
   `_sign(...)` staticcalls consuming `vm.prank`/`vm.expectRevert` in OmertaBond.t.sol — 14 tests +
   one silently false-passing fuzz, all now genuinely exercising the contract). BELT-AND-BRACES: the
   third-party audit should re-run `./run-forge-test.sh` on an open-internet machine with NATIVE solc
   as part of its own verification — but the Foundry-VM gate itself is now green. NOTE: NATIVE solc is
   no longer only belt-and-braces. The hook's suite deploys a real v4 `PoolManager` and the emscripten
   compiler runs out of heap on it, so a shim-only box silently runs every suite EXCEPT that one.
2. **A third-party audit of the CONTRACTS *and* the off-chain EIP-712 signer.** The signer (`src/chain.js`) is
   as security-critical as the contracts — it mints withdrawal authority. Audit both.
   ⚠ **The audit clock was RESET by tokenomics v2 step 4 (2026-07-29).** Until then OMR had no mint
   function and "nothing mints" was the property every prior review of this suite rested on. Supply is now
   unbounded and bonds mint it. Any auditor must be pointed at that specifically, and at the FOUR walls
   that replaced the fixed cap: `OMR.minter` (one path, no owner mint) plus OmertaBond's `dailyCapOMR`,
   `MAX_DISCOUNT_BPS`, `maxOmrPerEth` and the `oracle`. **The single most important property to review is
   the COMPOSITION of walls 3 and 4** — a price feed sits on the mint path, and what makes that safe is
   that `maxOmrPerEth` is checked independently, so a manipulated oracle can only ever TIGHTEN the ceiling,
   never raise it. Also review `OmrTwapOracle` (a Uniswap V2 cumulative-price TWAP) and the keeper
   dependency it creates.
   ⚠ **The gate also WIDENED with `OmertaHook.sol` (economy v3 step 6).** v4 hook auditing is its own
   specialty with its own attack surface, and this one holds three claims worth attacking directly:
   (a) `beforeInitialize`'s pool gate is what makes `SellTaxTaken` unforgeable — anyone can create a
   pool naming a hook, so without it a stranger emits real-looking revenue events from a worthless
   pool; (b) the fee is taken as an `afterSwap` delta on the *unspecified* currency and then `take`n,
   with the accrual written before the interaction; (c) the contract deliberately has NO pause, so the
   claim is that no configuration can halt the pool. MEV around a fee-taking hook is worth an explicit
   look. **Do not treat the hook as a variant of the ERC-20 tax** — it is a different mechanism at a
   different layer, and the ERC-20 path survives armed at zero as its backstop.

   ### THE BATCH — what goes out, and why it is drawn here
   **The packet itself is `CHAIN-AUDIT-PACKET.md`** — the enumerated scope, what each wall CLAIMS,
   what the four provers already prove against what stays config-only, and the properties an auditor
   should attack. Send that; this section is the summary of it.
   *"Batch, not dribble" (`omerta-dynasty-machine-design.md`) means the scope must be KNOWN before it
   is sent. Enumerated 2026-08-11; `forge test` **305/305** green on this exact set, measured 2026-08-21
   (StreetDeed added 2026-08-14; `DynastyNFT` + `StockVault` + `OmertaFees.payForPackage` added
   2026-08-14; the count has since grown with the red-team regressions — RT#5's constructor daily
   caps, RT#8's two-step ownership, the four-way sell tax — so re-measure rather than quoting this
   figure, and if the two disagree the tree is right and this line is stale.)*

   **In the batch — 20 contracts + 1 interface, every one carrying tests:**

   | subsystem | contracts | the thing to attack |
   |---|---|---|
   | the $OMR rail | `OMR`, `VoucherClaim`, `GearVault`, `OMRStaking`, `OmertaFees` | the mint path (rule 2) and the two supply caps that survive a minter swap; **plus `OmertaFees.payForPackage`** — the on-chain Store leg: fail-closed on an unpriced sku, exact-value, forwards dev/Vig, custodies nothing |
   | issuance | `OmertaBond`, `OmrTwapOracle`, `GenesisOracle`, `IOmrOracle` | the four walls, and specifically that 3 and 4 COMPOSE rather than substitute |
   | the market | `OmertaHook` | the pool gate, the `afterSwap` delta, the absence of a pause |
   | THE BANK | `Denari` (the DNR debt token, né `nUSD`), `CollateralEscrow`, `Alchemist`, `Transmuter`, `FlashGuard` | that no oracle sits on the borrow path and no `liquidate()` exists anywhere — the design's central claim, and the class that cost Inverse ~$21M twice |
   | Street Deeds | `StreetDeed` | the EIP-712 self-mint (name↔tokenId bijection, the daily cap, replay/deadline; NO owner mint), that `redeem` (the burn-to-re-import) is never pausable so a paused contract can never trap a holder's asset, and the **default-ON per-token transfer lock** (added 2026-08-14, the drain-before-sale mitigation): mint locks, every transfer arrival RE-LOCKS, only the OWNER may unlock (an approved operator deliberately cannot — operator-unlock IS the drain vector), `redeem` is never blocked by it, and the unlock emits `TransferLockSet` — the public "listing" act a buyer anchors TBA-content checks on |
   | the identity NFT | `DynastyNFT` | the EIP-712 self-mint (NO owner mint, nonce/deadline/daily-cap walls), that it gates **NOTHING on `balanceOf`** (the entitlement is account-bound off-chain — the token is a transferable trophy), and the uncapped sequential supply + EIP-2981 royalty |
   | the stock machine | `StockTokenRegistry`, `RwaStockBuyer`, `StockVault` | Safe-curated provider identity/address; one immutable closed-day family result; ballot-bound exact-token purchase through a Safe-approved adapter; daily ETH/slippage/one-shot walls; pre-held transfer only; EIP-712 allocation authorization; per-token delivery caps, pause, rotation, and sweep |
   | gameplay settlement gas | `SettlementGasPool` | immutable gameplay-vault credit authority; terminal replay keys; exact executor liabilities and self-only pull withdrawals; bounded gas/data-fee accounting; delayed configuration; and migration of unreserved ETH only to one exact successor while old credits stay backed |

   **NOW IN THE BATCH (added 2026-08-14, founder-directed).** `DynastyNFT`, `StockVault` and
   `OmertaFees.payForPackage` were previously held out; the founder cleared every design choice and lifted
   the launch-schedule constraint ("we will launch when I feel we are complete"), which removed each hold:
   - **`DynastyNFT`** — the tranche-schedule question that its "uncapped + escalating pricing" hinged on
     is settled (the published five-wave schedule with a hard 0.05-ETH ceiling; the mint fee lives in
     `OmertaFees`, not this contract, so it carries no pricing constant to audit).
   - **`StockVault`** — automatic push remains (there is no player claim transaction), but the old
     keeper-only authorization is superseded. In production the Safe sets `allocationSigner`, which
     disables both legacy delivery functions and requires an EIP-712 server-authority attestation for
     the exact frozen allocation. This proves gameplay authorization. Per the founder's 2026-08-24
     posture, neither the signer nor the game performs recipient KYC/compliance screening; launch review
     must evaluate that exact model rather than assuming an unwritten eligibility service exists.
   - **`ERC-6551` account contract** — NOT written and correctly so: the canonical registry singleton
     (`0x000000006551c19487814612e58FE06813775758`) + the ecosystem reference account implementation are
     used unmodified (deploy config, not a fork). Nothing to audit here beyond wiring.
   - **`MerkleDistributor`** — still NOT written, and still correctly so: launch **D1** resolved to
     variant (b) (in-game SIWE credit), which needs no contract at all.

   **`GenesisOracle` was written specifically so it would not become a straggler** — it is launch-blocking
   (the genesis window bonds before the pool its TWAP would read exists), carries no launch gate at all,
   and was the one contract the launch plan needed that nobody had enumerated. With the two NFTs and the
   Store leg now in, the batch is the WHOLE on-chain surface — a single engagement, which is what the
   "batch, not dribble" discipline asks for.
3. **Launch review sign-off** on the Risk-to-Earn line (see the "Sensitive design notes" in `CLAUDE.md`).
   **✅ CLEARED 2026-08-12; scope WIDENED to the whole checklist 2026-08-13** — the founder reports
   the tokenomics are approved and the on-chain details; on 2026-08-13 the founder further stated the
   outside review cleared the ENTIRE launch checklist (every value-moving surface — the stock buys,
   the TBA drops, the claim rail, THE BANK's four — not only the $OMR side first recorded here).
   Recorded as the founder's statements, which is what closes this gate.
   **This gate does NOT unlock mainnet on its own, and the distinction is worth keeping
   sharp: gate 2 is a SECURITY review — a different thing entirely.** It is also the gate with the freshest reason to
   exist — tokenomics v2 step 4 deleted the property every prior contract review rested on ("nothing
   mints") and replaced it with four walls, and on 2026-08-12 two unbounded-mint holes were found in the
   BACKEND keepers (`AUDIT-family-buyback.md`) that had shipped with green tests and passing invariants.
   That is precisely the class an external auditor exists to catch in the contracts, where it cannot be
   patched after the fact. **Nothing on this checklist should be armed until gate 2 also clears.**
   **What this gate covers has moved TWICE, and the current position is the second one.** The stock
   layer was retired 2026-07-31 (`omerta-stock-layer-retirement.md`) and **reinstated 2026-08-10**
   (`omerta-brokers-design.md`, founder decision). Buying, holding and eventually delivering Stock
   Tokens is back in scope. The once-open eligibility-list/verification-depth question is now founder-
   resolved as **no in-game KYC or recipient-compliance check**; this resolves the product implementation
   question but does not assert legal clearance for mainnet distribution.
   **What is built TODAY, amended 2026-08-24:** the bounded contracts and most server orchestration are
   built and **chain-DORMANT**. `StockVault.sol` (2026-08-14,
   in the batch above) never mints — every `deliver` is a pre-held `SafeERC20.transfer`, so
   `balanceOf(this)` per token is the PHYSICAL half of the wall — and the off-chain half is complete
   too: `brokers.js:distributeBuy` writes the owed side through the clamped `allocateStock`,
   `stockdeliver.js` stages→confirms against the `Delivered` log, `runStockDeliveryKeeper` is the tx
   sender, and `delivered ≤ allocated` joins `allocated ≤ held` in the nightly sweep. There is no player
   claim route, but production pushes require the signed allocation authorization described above.
   `StockTokenRegistry` and `RwaStockBuyer` additionally bind acquisition to the Safe-approved canonical
   address selected by the closed family ballot. Nothing moves until
   `STOCK_VAULT_ADDRESS` + `STREET_DEED_ADDRESS` + the ERC-6551 config are set (the watcher) and
   `STOCK_KEEPER_PK` + `STOCK_ALLOCATION_SIGNER_PK` besides (sender and isolated allocation attestor),
   so **no stock has been delivered to anybody** — but the
   reason is unset env, not unwritten code, and the two are different things to review. The ETH
   VAULT is the same shape one asset over: a player burns earned $OMR for a share of ETH the treasury
   already holds, same asset both sides, allocation-only. The $OMR side and the stock side are
   different questions; as of 2026-08-13 the founder states BOTH are cleared by the outside review
   (still owed regardless: the claim-rail parameters — the eligibility list + verification depth —
   and gate 2). The in-game Portfolio remains a status collectible with no sell and no
   cash-out, using real ticker SYMBOLS for flavour (a flagged, undecided founder question).

Devnet + testnet rehearsal may proceed now. **Mainnet is blocked on 1 + 2 + 3.**

---

## 0.5 RESOLVED — the bond's fourth slice (now the treasury's) leaves on-chain

Found 2026-07-30 while scoping the v4 hook work; **fixed 2026-07-31** before the third-party audit, so
it costs nothing extra (the audit clock was already reset by tokenomics v2 step 4 — changing the
contract AFTER an audit would mean paying to re-audit it).

> **Note (2026-07-31, later the same day):** the founder retired the stock layer and kept the vault,
> backed with ETH. The fourth slice, its bps and this whole fix are unchanged — only the DESTINATION is
> now a treasury Safe rather than a stock-buy bot, and that Safe is what the vault's `allocated ≤ held`
> is measured against (see §7b). The `rwaBps`/`rwaRecipient`/`rwa_eth` names are historical.

**What was wrong.** `OmertaBond` split ETH three ways (`toPol`/`toDev`/`toVig` = remainder) and had no
RWA recipient. The backend booked four. On the on-chain path `recordBond` read an `onchainRwa` the
watcher could not supply, so `rwa_eth` was **0 on every real bond** and the contract's whole 4750 bps
remainder landed as Vig (signed split: 2250 Vig / 2500 RWA). The ETH was not lost — it reached
`vigRecipient` — but the slice that went missing is the one that keeps the stock float growing when DEX
volume is thin, and **neither bond invariant could see it**: check (4) sums because the Vig remainder
absorbs the missing slice exactly, and the mirror check compared 0 to 0.

**The fix, and why this one and not the cheaper one.** The contract now splits FOUR ways —
`rwaBps` + `rwaRecipient`, `Bonded` emits `toRwa`, the watcher reads it, `recordBond` books it. The
cheaper alternative (split the event's `toVig` backend-side) was **ruled out by a founder decision that
the Vig wallet and the stock-buy bot are SEPARATE keys** — the bot trades, so it is hot; the Vig funds
the withdrawal reserve and can be colder. With separate custody, booking the fourth slice's ETH against
the Vig's wallet claims a position the destination does not hold, which is the exact class
`allocated <= held` and the `txHash` gate exist to prevent.

Regressions: `test_the_float_gets_its_own_wallet_not_the_vigs` + `test_four_way_split_leaves_no_dust`
(Foundry), and `test/watcher.js` asserts a real on-chain bond funds BOTH `bond_reserve.rwa_eth` and
`rwa_revenue` (the treasury's inflow ledger). Mutation-verified: drop `onchainRwa` from the watcher
and the suite fails by name.

**Deploy requirement:** `rwaRecipient` MUST be the **treasury Safe's** own address, distinct from
`vigRecipient`. Setting them to the same address re-creates the defect silently — the split would be
correct on-chain and the books would still be right, but the founder's custody separation is gone.
It should be the coldest key in the system: this destination only ever RECEIVES, so it has no reason to
share a key with anything that spends — and it is now the Safe whose balance backs the vault (§7b), which
makes co-mingling it with a spending key strictly worse than before.

## 1. Build + test the contracts
- [ ] `cd omerta-contracts && ./run-forge-test.sh` → all `[PASS]` (Gate 0.1). Suite: OMR, VoucherClaim,
      GearVault, OMRStaking, OmertaFees (incl. `payForPackage`), OmertaBond, OmrTwapOracle, GenesisOracle,
      OmertaHook + THE BANK + StreetDeed + DynastyNFT + StockVault (288 tests, seven fuzzes).
      The hook's tests deploy a REAL Uniswap v4 `PoolManager`, which the emscripten solc cannot compile —
      **use native solc** (`./run-forge-test.sh`, or the sandboxed runner, which now fetches the native
      binary and says so if it cannot).
- [ ] No-Foundry compile path (artifacts for the deployer/e2e): `node tools/compile-contracts.js` → writes
      `omerta-contracts/out-js/` (used by `tools/chain-e2e.js`). Artifacts are gitignored — they must never
      drift from source; recompile before every deploy.

## 2. Deploy order + wiring (Safe-owned from deploy — no hot-deployer window)
Deploy from the deployer account, but pass the Safe to every ownable constructor so ownership is correct
from the first block. Use `omerta-contracts/DEPLOYMENT.md` and its Foundry scripts for the exact calls/args;
`tools/chain-e2e.js` remains the end-to-end behavior reference.
- [ ] **`OMR(treasurySafe)`** — founding supply `100_000_000e18` minted once to the Safe. **No longer a
      fixed-supply token** (tokenomics v2 §4): it has ONE mint path, the `minter` address, which ships
      **unset (= minting off)** and is armed deliberately below. There is no owner mint.
- [ ] **`GearVault(safe, imageBase)`** — ERC-1155; mint gated to VoucherClaim (set in the next step);
      per-tokenId supply caps set by the Safe (set caps BEFORE signing any gear voucher — an uncapped id
      is fail-closed). `imageBase` is the IPFS base for the pinned plates, e.g. `ipfs://<CID>/`, so the
      per-tokenId image resolves to `<imageBase><tokenId>.png` (settable later via `setImageBase`).
      **Metadata is on-chain**: `uri(id)` returns a self-contained JSON data URI whose Type/Class/Rarity
      traits are derived from the tokenId (provable, no per-token storage); only the image is off-chain.
      OPTIONAL but recommended for marketplace readability: `setClassNames(classKeys, names)` gives each
      car/boat/gear class a display name (unset falls back to "Car #<idx>" etc.). A class key is the
      class's BASE tokenId (rarity digit 0). The encoding constants `CAR_BASE`/`BOAT_BASE`/`STRIDE` and
      the rarity names MIRROR `RARITY.TOKEN`/`RARITY.TIERS` in `src/rules.tail.js` — keep them in lockstep.
      **NFT RE-IMPORT (Option A, `omerta-nft-reimport-design.md`)**: GearVault also has `redeem(tokenId,
      amount)` — a holder BURNS an extracted CAR/BOAT back toward the game (gear is one-way, rejected), and
      the backend re-creates the live in-game row. Wire the backend to it by setting **`GEARVAULT_ADDRESS`**
      (this contract's address) on the WORKER so the `Redeemed` watcher (`syncRedeemedEvents` → `reimportItem`
      + the `sweepReimports` retry) runs; dormant until set. The `redeem` burn is new audit surface — it is
      part of THIS deploy's audit batch (rule 2 clock), not a later add. No env is needed on the API for it.
- [ ] **`VoucherClaim(safe, signer, omr, gearVault, dailyCapOMR)`** — the only $OMR bridge. Then
       `gearVault.setMinter(voucherClaim)` so gear mints route through it.
- [ ] **`OMRStaking(safe, omr, apyBps)`** — pre-funded reward pool; principal always withdrawable.
- [ ] **`OmertaFees(safe, feeRecipient=devWallet, vigRecipient, vigBps=2500, mintFeeWei, respawnFeeWei)`** —
      the ETH tollbooth. It splits each fee ON-CHAIN in one tx: `vigBps` → `vigRecipient`, the remainder →
      `feeRecipient` (dev); it custodies nothing. **`vigBps=2500` is the Path A fee split** (fee vig 2500 —
      down from 6000); it is IMMUTABLE, so set it at deploy and keep it in lockstep with the backend
      `VIG_BPS` in `deploy/fee-splits.env` (the treasury + community slices of the fee are backend earmarks
      carved from the dev remainder — not on-chain). Fees: `MINT = 0.01 ETH` (wave 1 of the published
      `MINT_TRANCHES` schedule — five waves to a capped 0.05; each boundary is ONE owner `setFees` tx,
      watched on `/admin`), `RESPAWN = 0.10 ETH`, `reroll` defaults to `mintFee` (owner-settable).
- [ ] **`OmertaBond(safe, signer, omr, polBps=7500, devBps=1500, rwaBps=500, polRecipient, devRecipient,
      rwaRecipient, vigRecipient, dailyCapOMR, maxOmrPerEth)`** — POL bonding with the four-way ETH split.
      **Path A: 75% POL / 15% dev wallet / 5% treasury / the REMAINDER, 5%, to Vig** (POL-heavy for
      liquidity depth — up from 37.5% POL). All four leave the contract in the same tx; it custodies no
      ETH. **`rwaRecipient` must be the TREASURY Safe's own address, distinct from `vigRecipient`** (founder
      ruling on key separation — §0.5; the `rwa` name is historical, see
      `omerta-stock-layer-retirement.md`). **This contract MINTS** — see below. Keep
      `polBps`/`devBps`/`rwaBps`/`maxDiscountBps` in lockstep with the backend `BONDS.*` in `src/rules.js`
      / `deploy/fee-splits.env`.
      **Operating rule (`omerta-v4-hook-design.md` §9.6): keep `BONDS.DISCOUNT_BPS` strictly BELOW
      `SELL_TAX.BPS`.** At today's 800 vs 900 an immediate bond-and-flip nets `1.08 × 0.91 = 0.983` — a
      ~1.7% loss, which is what makes a bond a hold rather than an arbitrage. Invert the two and every
      bond becomes a subsidised sell. (`MAX_DISCOUNT_BPS` 2000 against a 900 tax would be a +9% guaranteed
      flip — it is a rogue-signer backstop, never a setting.)
      **Run `npm run dials` FIRST for the two cap arguments** — they derive from LIVE POOL DEPTH and are
      not fixed numbers. At a 100-ETH pool it gives `dailyCapOMR` **~27,000 OMR/day** (≈5% of the pool's
      OMR reserve, sized so a full day's cap dumped moves the price ≤10%) and `maxOmrPerEth` **~15,000**
      (3× the launch price — a circuit breaker, not a price). Re-run it whenever POL materially deepens
      and raise the cap with it.
      **At the planned genesis raise (21.38 ETH → POL 0.375R = 8.0175 ETH) the rule gives `dailyCapOMR`
      ≈ 82,500/day.** Derive it against the ACTUAL POL at deploy, never from a figure written down
      earlier: the raise is a founder lever and this cap moves with it (BALANCE.md § THE GENESIS RAISE —
      a smaller raise means a shallower pool means the same cap does MORE price damage, which is exactly
      why the number is a function of depth and not of supply).
- [ ] **`GenesisOracle(safe, price, validUntil)`** — WALL 4's feed for the GENESIS WINDOW ONLY, and the
      reason the window can exist at all: `OmertaBond` fails closed without an oracle, but the TWAP
      cannot be deployed before the pool it reads, and the window is what FUNDS that pool. So the
      window runs on an administered price. `price` is the published genesis rate (OMR per 1 ETH),
      `validUntil` the window's hard end. **Set `validUntil` to the window's real close and no
      further**: this feed answers `updatedAt = block.timestamp` while open — deliberately, because an
      administered price has no keeper and cannot go stale in the sense `maxOracleAge` guards, and
      pinning it to the set-time would silently halt bonding one `maxOracleAge` in, during the single
      event that funds the pool (`test_bonding_works_for_the_whole_window_not_one_max_age`). The
      window is what replaces time-staleness, so it is the ONLY thing bounding this feed. Past it,
      `consult()` reports the interface's own "no usable reading" and bonding refuses. `setPrice(0,0)`
      is the kill switch — zero is already "unavailable", so there is no pause flag and no second path.
      **This contract is retired by being unreferenced** at the `setOracle(twap)` cutover below;
      nothing needs tearing down.
- [ ] **`OmrTwapOracle(safe, v2Factory, omrWethPair, omr, weth, period)`** — WALL 4's price feed for NORMAL OPERATION,
      deployed AFTER the pool exists (it reads that pool's cumulative price). `period >= MIN_PERIOD` (10 min); **30 min
      recommended** — past that the manipulation-cost curve flattens for a thin pool while the lag grows,
      and what actually makes this expensive is POOL DEPTH, not the clock (see `npm run dials`). The
      constructor works out which side of the pair OMR sits on rather than being told, requires the
      pair assets to be exactly the reviewed 18-decimal OMR and WETH contracts, and requires the reviewed
      factory's `getPair(omr,weth)` to attest the supplied pair. It reports **no
      usable reading until a full period has been closed**, so bonding cannot start on a price derived
      from nothing.
- [ ] **`OmertaBond.setOracle(oracle, priceToleranceBps, maxOracleAge)`** — arm WALL 4. Recommended
      **500 bps (5%)** and **90 minutes** against a 30-minute keeper (3× the poke interval tolerates two
      consecutive misses and no more). Tolerance is how far a signed quote may sit ABOVE the TWAP —
      non-zero because a TWAP lags spot, so 0 rejects honest quotes exactly when the market moves; 0 is
      nonetheless a legitimate choice if you would rather bonding stall than drift. Hard-capped at 2000.
- [ ] **Start the oracle keeper.** `OmrTwapOracle.update()` is permissionless and must be poked at least
      once per `maxOracleAge`, or the feed goes stale and bonding halts. That failure direction is
      deliberate — a dead keeper must stop the mint, never leave it running on an unmaintained price —
      but it does mean **the keeper is a production dependency, not a nice-to-have**. The backend
      WATCHES it: the worker's `bondOracleHealth` check (hourly, dormant without a bond chain) flags
      `keeper-late` at 2× PERIOD — while bonding still works, so there is lead time — and `down` when
      `priceCeiling()` starts reverting, alerting through the same latched channel as a §10.4 drift
      and surfacing on `/admin` (Chain panel) + `GET /v1/mod/bonds`.
- [ ] **Arm the mint — the step that turns issuance on.** `OMR.setMinter(omertaBond)`. Do this LAST, and
      only after `dailyCapOMR`, `maxOmrPerEth` AND the oracle are all set to real values: those, plus the
      compile-time `MAX_DISCOUNT_BPS`, are the entire wall between a leaked quote-signer and unbounded
      supply. `maxOmrPerEth` and the oracle are both **fail-closed**, so bonding stays off until each is
      set — but `dailyCapOMR = 0` means UNLIMITED, so a deploy that forgets it has no daily wall at all.
      Set it. `setMinter(address(0))` is the one-transaction emergency stop.
- [ ] **Fund VoucherClaim's tranche (a plain OMR transfer — the bridge NEVER mints):** transfer OMR from the
      Safe into `VoucherClaim` to back signed withdrawal vouchers. Its `balanceOf` IS its cap.
      **OmertaBond no longer needs funding** — it mints each payout at bond time, which is what keeps
      `committedOMR ≤ balanceOf(this)` true at every instant so `sweep` can never strand a bonder.
- [ ] **Arm the DEX sell tax (after the pool exists):**
      `OMR.setTaxRecipients(devWallet, rwaWallet, communityWallet, lpWallet)` →
      `setExempt` for the POL manager + OmertaBond + VoucherClaim + the Safe → `setPair(pool, true)` →
      `setSellTax(bps, devBps, rwaBps, communityBps)` — the total is hard-capped at 10% and defaults to
      0 = off; LP takes the remainder after dev + rwa + community. **Path A: ship
      `setSellTax(900, 200, 160, 240)`** (dev 200 / rwa 160 / community 240 / lp remainder), matching
      `deploy/fee-splits.env`'s `SELL_TAX_RWA_BPS=160` + `SELL_TAX_COMMUNITY_BPS=240`. The **community
      slice is now a 4th ON-CHAIN recipient** (2026-08-15 — it was a backend carve before the contracts
      gained it): its wallet MUST be the **community-buyback keeper's** — a SEPARATE key from the
      treasury's and the Vig's (the §0.5 custody rule: `runFamilyBuybackInvariants` publishes
      `walletMustHold` against THAT wallet, so pointing the slice anywhere else books family backing
      against ETH the family keeper does not hold). The backend `recordSellTax` carve
      (`SELL_TAX_COMMUNITY_BPS`) covers only the mod-ingest rail until the SellTaxTaken watcher lands —
      keep the two numbers in lockstep. Only transfers INTO registered pools are taxed; buys and wallet transfers are clean. **HARD REQUIREMENT: the canonical pool must be
      Uniswap V2-COMPATIBLE** (sell-taxed tokens need the *SupportingFeeOnTransferTokens router path;
      Uniswap V3 does not support them). RESOLVED (verified July 2026): Uniswap deployed **v2, v3, v4 +
      UniswapX on Robinhood Chain at its July 1, 2026 mainnet launch** — so a V2 pool is available. Still
      CONFIRM ON-CHAIN at deploy: pull the addresses from Uniswap's deployment docs
      (developers.uniswap.org → Robinhood Chain deployments) and run `node tools/check-dex.js` against
      the live RPC (probes bytecode + the right view calls; prints a go/no-go verdict for the taxed pool).
      **This V2 requirement dies the day the v4 hook becomes the canonical venue** (§7) — the fee then
      lives in the pool, not in `_update`, and V3/V4 routers and every aggregator work normally. Keep the
      `_update` path anyway, ARMED AT ZERO: a hook tax is a property of ONE pool and anyone may open an
      unhooked one, so the token tax is the universal backstop the Safe arms if that starts to matter.
      **ONE VENUE, ONE LAYER (red-team C3).** `MAX_SELL_TAX_BPS` (10%) is a ceiling on EACH layer and
      neither contract can see the other, so a seller pays the SUM of what is armed on the venue they
      traded. Registering the v4 PoolManager as an `ammPairs` entry while the hook is armed doubles the
      rate past the ceiling both contracts advertise AND taxes protocol flows into the pool (the
      POL-pairing bot's LP add) unless each is `taxExempt`. So: arm the hook for the canonical pool and
      leave `_update` at zero; arm `_update` only for a venue the hook does not cover.

### 2a. STREET DEEDS — the on-chain tradeable deed (only when it ships; dormant until env-set)
- [ ] **`StreetDeed(safe, signer, imageBase, externalBase)`** — the ERC-721 Street Deed
      (`omerta-street-deeds-design.md` §2/§3). SELF-MINTING on the SAME `signer` as VoucherClaim (no owner
      mint — a deed mints only against a server-signed EIP-712 `DeedVoucher`), Safe-owned. `imageBase` →
      the game's block-plate route (`https://<host>/v1/deeds/plate/`), `externalBase` → the deed's legend
      page (`https://<host>/deed/`); both take `<tokenId>` appended. **NO wiring needed** (it verifies its
      own voucher — the OmertaBond precedent, since a deed voucher carries name+district strings the
      fixed VoucherClaim struct can't). **RATE WALL — pass `DEED_DAILY_MINT_CAP` (0 = unlimited).** It is a
      CONSTRUCTOR argument, so a deploy must STATE it: this contract self-mints on the SAME signer key as
      VoucherClaim/OmertaBond/DynastyNFT, so that key's blast radius is the SUM of the four daily caps.
      (Before R33 this read "optional" and the field was setter-only, so a fresh deploy minted unbounded
      deeds per day with nobody doing anything wrong — and a deed's ERC-6551 vault is where real tokenized
      stock lands. Both siblings that take their cap at construction could never be forgotten; these two
      could, and the runbook said not to bother.)
      **Backend activation:** set **`STREET_DEED_ADDRESS`** on BOTH the API (so `POST /v1/deeds/extract`
      signs the DeedVoucher — needs `CHAIN_ID` + the shared `VOUCHER_SIGNER_PK` too) AND the WORKER (so the
      `Extracted` watcher `syncDeedExtractedEvents` → `markDeedExtracted` frees the extractor, the
      `Redeemed` watcher `syncDeedRedeemedEvents` → `reimportDeed` brings a burned deed back into the game,
      and the **`Transfer` watcher `syncDeedTransferEvents`** (cursor stream `deed_transfer`) →
      `recordDeedTransfer` maintains `street_deeds.onchain_owner` — a deed SOLD on a secondary market
      stops being its extractor's STOCK-DELIVERY target (the plan + board both apply the exclusion,
      case-insensitive vs the SIWE wallet; a NULL owner fails OPEN so a chain-dormant deploy keeps
      delivering) and the sale lands on the deed's public legend; the worker also needs
      `CHAIN_RPC_URL`). The **default-ON per-token transfer lock** (`transferLocked`) is the
      drain-before-sale mitigation: a freshly minted or freshly received deed cannot move until its
      OWNER calls `setTransferLock(tokenId, false)` — the emitted `TransferLockSet` is the public
      "listing" moment a buyer checks TBA contents against. Dormant until set. The deed goes INERT in-game while
      extracted (no rent/control — the car/boat v3-step-7 precedent); a holder RE-IMPORTS by calling
      `redeem(tokenId)` (burn), which the `Redeemed` watcher hands to a deedless linked account.
      §10.4-NEUTRAL: a deed is ownership, never a currency — zero `transactions` rows. `tokenId =
      uint256(keccak256(bytes(name)))` (a name↔id bijection enforced on-chain), so a name mints at most
      once; a re-import (burn) frees the same id for re-extraction. `redeem` is NEVER pausable — a paused
      contract must never trap a holder's asset.

### 2c. THE IDENTITY NFT + THE STOCK DELIVERY VAULT (only when they ship; dormant until env-set)
- [ ] **`DynastyNFT(safe, signer, baseUri, royaltyRecipient, royaltyBps)`** — the uncapped identity NFT
      (`omerta-dynasty-machine-design.md` §4). SELF-MINTING on the SAME `signer` as VoucherClaim/StreetDeed
      (no owner mint — a token exists ONLY against a server-signed EIP-712 `MintVoucher`), Safe-owned.
      `baseUri` → the account's metadata endpoint (`https://<host>/v1/identity/`, `<tokenId>` appended);
      `royaltyRecipient` = the treasury Safe, `royaltyBps` = **500** (5%, EIP-2981). **THE WALL: the
      contract gates NOTHING on `balanceOf`** — the game entitlement (`account_persistent.minted`) stays
      account-bound OFF-CHAIN, so the token is a freely transferable trophy carrying no on-chain power.
      **NO wiring needed on the CONTRACT side** (it verifies its own voucher). Optional rate-cap:
      **pass `DYNASTY_DAILY_MINT_CAP`** — with no supply cap this is the entire blast radius of a leaked
      signer key, so **set it**. It is a CONSTRUCTOR argument (0 = unlimited), so a deploy must state it. **Backend activation:** the ENTRANCE is `POST /v1/identity/mint`
      (`chain.js:requestDynastyMint` — a made account with a SIWE-proven wallet gets one signed
      MintVoucher, one per account ever; added 2026-08-17 by red team #9, which found the contract
      deployable, watchable and **unusable** — three of the four contracts sharing this signer key had
      a signing route and this one did not, while this step said the rail was done). Set
      **`DYNASTY_NFT_ADDRESS`** on the **API** (signs) and the **WORKER** — the `Minted` + `Transfer` watchers (cursors `dynasty_minted`/`dynasty_transfer`)
      maintain the token registry (`dynasty_tokens`, minter resolved via the SIWE wallet) and **FREEZE the
      portrait at the first owner→owner transfer** (the snapshot stores the portrait ROW, so a sold token
      is a photograph of the bloodline as it stood — one-way; a buy-back does not unfreeze). The identity
      metadata routes (`/v1/identity/:param`) take the all-digits tokenId form, so the deployed `baseUri`
      contract holds. Dormant until set. §10.4-NEUTRAL (art/status only).
      *ERC-6551:* the canonical registry singleton (`0x000000006551c19487814612e58FE06813775758`) + the
      ecosystem reference **account implementation** are used UNMODIFIED — deploy config, not a fork. A
      player's token-bound account is `registry.account(accountImpl, salt, chainId, DynastyNFT, tokenId)`;
      nothing here is a new contract to deploy.
- [ ] **`StockVault(safe, keeper, defaultDailyCap)`** — the automatic-push Stock Token delivery vault
      (`omerta-brokers-design.md` §3.3). **NEVER mints** — every delivery is a pre-held
      `SafeERC20.transfer`, so `balanceOf(this)` per token is the physical `allocated ≤ held` wall. Pass
      **`keeper = address(0)` at deploy** (deliveries OFF) and a reviewed nonzero default daily cap.
      **⚠ ORDER (fail-safe):** the Safe (1) pre-funds the vault, (2) sets a per-token
      `setDailyCap(token, cap)`, (3) sets and verifies `setAllocationSigner(attestor)`, and only then
      (4) `setKeeper(bot)`. Once the signer is nonzero, legacy `deliver`/`deliverBatch` are disabled;
      every automatic push must carry an EIP-712 authorization for the frozen gameplay allocation.
      This is gameplay/server-authority verification. It intentionally performs no KYC, sanctions,
      residency, jurisdiction, or other recipient-compliance check.
      **DELIVERY TARGET REDIRECTED to the STREET DEED (`omerta-brokers-design.md` §3.4, founder-directed
      2026-08-14):** stock lands in the player's on-chain **Street Deed's** ERC-6551 TBA, not the Dynasty
      NFT's — so a player must own AND extract a Street Deed to receive stock (an account with none accrues
      its allocation as owed and waits permanently—no expiry, inactivity forfeiture, treasury clawback,
      or redistribution). The identity NFT holds no stock, so its `balanceOf`-gates-nothing
      entitlement wall is intact. **Backend activation:** set **`STOCK_VAULT_ADDRESS`** on the WORKER +
      API, and **`STREET_DEED_ADDRESS`** + the ERC-6551 env (`ERC6551_REGISTRY` /
      `ERC6551_ACCOUNT_IMPL` / `ERC6551_SALT`, defaulting to the canonical registry singleton) so
      `src/stockdeliver.js` can resolve the deed's TBA; the worker runs the two watchers
      (`Delivered` → `confirmStockDelivered`, the deed's `Extracted` → `markDeedExtracted`). **The
      delivery KEEPER is BUILT (2026-08-15):** `runStockDeliveryKeeper` (worker tick + `POST
      /v1/mod/treasury/deliveries/run`) stages each owed allocation, CLAIMS it atomically
      (claim-then-send — `sent_at` stamped before the tx, released on a failed send, `RESEND_MS` 10min
      retry with the SAME deterministic `deliveryId` so the contract's `usedDeliveryId` bounds any lost
      race to a clean revert), and sends `StockVault.deliverAuthorized` with an isolated EIP-712
      allocation signature; it NEVER confirms — only the
      `Delivered` watcher flips `stock_allocations.delivered`. Arm it with **`STOCK_KEEPER_PK`** (a
      SECRET — the on-chain `keeper` bot key) + **`STOCK_ALLOCATION_SIGNER_PK`** (a different SECRET)
      + **`STOCK_TOKEN_REGISTRY_ADDRESS`**. Value-moving token addresses come from the mirrored
      Safe registry, never from an environment ticker map; a missing registry address is a named
      `no_token_address` skip, never a silent one. `STOCK_TOKEN_ADDRESSES` remains only a legacy
      read-only vault-balance display fallback. In addition,
      each token's decimals are read off the token itself (never configured — a tokenized stock is not
      reliably 18dp). Dormant until wired. §10.4-NEUTRAL (out-of-band real value —
      zero `transactions` rows; the backend's `allocateStock` clamp + the nightly `allocated ≤ held` AND
      `delivered ≤ allocated` checks in `runTreasuryInvariants` are the owed-side half of the wall).
      **CORPORATE ACTION RUNBOOK (`omerta-brokers-design.md` §3.4b, founder-approved 2026-08-25):**
      ordinary split/dividend multipliers do not mutate raw vault balances or allocation rows. For a
      non-multiplier terminal/conversion action, disable the registry entry and the affected token's
      delivery cap first; snapshot the vault balance `B`, outstanding per-account units `u_i`, total
      `U`, staged sends, and block numbers; require `U ≤ B`; wait for the issuer's `COMPLETED` status and
      prove actual successor receipt `P` from transaction hashes plus on-chain balance deltas. The
      player-backed pool is `C=floor(P×U/B)`, each account starts at `floor(C×u_i/U)`, and all dust inside
      `C` is assigned by largest remainder with `keccak256(account_id)` as the stable tie-break. The Safe
      must approve an immutable reconciliation record before delivery or source-row closure. The cohort's
      `C` can never enter general treasury inventory or another epoch; ambiguous or incomplete settlement
      leaves the original allocation pending. Already delivered assets remain in player-controlled deed
      TBAs. **No automatic terminal-action handler is to be armed until RHJ activates and documents the
      settlement type and that new value-moving path passes audit plus end-to-end rehearsal.**
      **✅ BOTH ON-CHAIN LEGS ARE PROVEN (2026-08-16)** — `npm run stock-e2e` (the forge CI job, beside
      dexbot-e2e) stands the whole rail up on anvil and runs `resolveTbaOnchain` + `sendDeliverOnchain`
      UNSEAMED against the REAL ERC-6551 registry (the reference implementation, vendored unmodified at
      `omerta-contracts/test/vendor`) plus StreetDeed and StockVault off the forge build. 14 asserted
      steps: a deed minted from a server-signed EIP-712 voucher, the backend's computed TBA equal to the
      registry's own answer (and the account deployed there reporting THIS deed as its token), the units
      landing in that account, the keeper sending but never settling, and the `Delivered` log — not the
      keeper — flipping the allocation. The EIP-712 authorization cases are additionally pinned in
      `StockVault.t.sol`; extend `stock-e2e` to the signed path before arming mainnet. **Why this leg gets
      its own prover:** the ADDRESS is still the physical destination, and a wrong one is
      invisible to every wall we have (they are denominated in UNITS; who received them is not a
      quantity). **Residual, as with the DEX bots:** the prover deploys the registry it then checks
      against, so a MISCONFIGURED `ERC6551_REGISTRY` / `ERC6551_ACCOUNT_IMPL` / `ERC6551_SALT` at deploy
      is a config error it cannot see — resolve one real deed's TBA against the live registry by hand
      before the first delivery.

- [ ] **`StockTokenRegistry` + `RwaStockBuyer`** — deploy additively with
      `DeployRwaStockMachine.s.sol`; the script accepts only Robinhood Chain mainnet **4663** or rehearsal
      testnet **46630**, requires a nonzero Safe, StockVault, and buyer daily ETH cap, and deliberately
      deploys the ballot publisher, buy keeper, and venue adapter as zero. On mainnet:
      (1) run `npm run stock-catalog` to inspect Robinhood's official chain-4663 discovery feed;
      (2) generate the one-time initial top-15 proposal with
      `npm run stock-catalog -- --initial-top-volume --registry <registry>`; this ranks Robinhood's
      documented **underlying daily share volume**, not Stock Token DEX or mint/burn volume, and fails
      unless every selected entry is active, fractional-tradable, fresh, non-halted, positive-market,
      and address-matched; its ranked registry insertion order sets the production fallback order;
      (3) have the Safe verify provider IDs/addresses plus legal/product eligibility, venue/oracle
      support, and exposure caps, then execute those calls. The tool never signs/sends, and the snapshot
      never rotates merely because tomorrow's volume changes; later changes use explicit `--tickers`;
      (4) set the isolated ballot publisher only after a closed-day rehearsal;
      (5) audit and set one venue adapter plus an independent quote/TWAP oracle with a nonzero freshness window;
      (6) pre-fund the buyer with only the bounded tranche; and only then
      (7) set the buy keeper. The keeper calls `buy(ballotDay, ethIn, minUnits, routeData)` and has no
      ticker/address argument. The contract accepts only the immediately preceding UTC day's ballot,
      permits one buy for it, enforces the daily ETH cap, and buys the exact token address snapshotted
      when that result was published. Disabling or rotating the catalog entry makes the old ballot fail
      closed; it cannot silently redirect the buy. The buyer measures that exact token's balance increase
      at StockVault. **The generic buyer is built; the production venue adapter and
      quote/TWAP runner are not yet approved or armed.**
      The buyer now deploys paused, rejects a zero daily ETH cap, rejects adapter/oracle EOAs,
      permits dependency and cap changes only while paused, and refuses `unpause()` until the keeper,
      reviewed adapter bytecode, fresh quote-oracle contract/window, and nonzero cap are all present.
      The Safe activation order is therefore: pause (already true at birth), configure and read back
      every dependency/cap, pre-fund only the reviewed tranche, then unpause last. Any later rotation
      begins by pausing; a live buyer cannot have its execution boundary silently replaced.
      **PRE-CLOSE DEACTIVATION (founder-approved 2026-08-25):** do not cancel, restart, or extend the
      open ballot. Invalidate votes for the removed candidate immediately, exclude them from the public
      lead and closing tally, and allow each affected family to recast through the existing route until
      the normal cutoff. Ignore any invalid vote left unrecast; then resolve the remaining active votes,
      using the active default only for a tie or silence. This remains an implementation and rehearsal
      gate: `tallyTickerDay`, the ballot board, and deterministic tests must prove active-only counting
      before the publisher and buyer are armed.
      **POST-CLOSE INELIGIBILITY (founder-approved 2026-08-25):** if the committed token becomes inactive,
      halted, or otherwise ineligible before execution, skip the purchase. Do not republish that day,
      substitute the registry default, or aim the keeper at another token. Leave the bounded ETH unspent
      inside the existing treasury/buyer funding and cap walls; unused authority must not enlarge a later
      daily cap. Preserve the immutable ballot result and record a public skipped-purchase status with the
      reason. The contract's revert is the value wall; the status/reason and operator alert are still an
      implementation and launch-rehearsal requirement before this rail may be armed.
      **CARRIED ACQUISITION BUDGET (founder-approved 2026-08-25):** skipped-day ETH remains pooled,
      non-expiring Stock Token acquisition capital by default, never a ticker-specific entitlement. The later
      founder-approved `mainOperator` arbitrary-transfer authority may remove any or all of it to any
      destination. Later valid ballots may consume the remaining backlog gradually, but each remains
      one exact-winner purchase under that day's unchanged `dailyEthCap`; missed capacity never stacks and
      no catch-up batch is permitted. A skipped token has no preferred claim and receives nothing unless
      it wins a future eligible ballot. Replace/reframe `RwaStockBuyer.sweepEth`: the current unrestricted Safe
      path must become the explicit main-operator-only, evented/accounted `operator_outflow` path rather than
      an acquisition-custody guarantee. Rehearse a skipped day, operator removal, remaining later capped buy,
      a different winner, and a multi-day backlog.
      **FORWARD-ONLY CATALOG LIFECYCLE (founder-approved 2026-08-25):** Robinhood API observations never
      reactivate or replace an entry. Reactivating the same exact identity requires a fresh Safe review of
      token address, provider status, venue, oracle, and exposure limits. A changed token address or
      provider identity requires a Safe-reviewed new immutable registry version. Apply either
      only to future open ballots; never rewrite, repair, or replay closed/skipped days, and never redirect
      pending allocations outside the separate corporate-action reconciliation. Preserve all inactive
      identities and ballot outcomes on the public audit surface. Each version's address and provider
      identity are immutable; same-identity reactivation only toggles that version; a successor gets a new
      permanent `assetKey`; the old version remains inactive/enumerable; and at most one version per ticker
      may be active. This is an activation gate: current `keyOf(ticker)`, `upsertAsset`, reverse mappings,
      ticker-derived proposal helpers, `stock_token_catalog.ticker UNIQUE`, and in-place mirror sync do not
      implement that model. `ballotToken` already prevents closed-ballot redirection, but the registry,
      tooling, schema, public history, and tests must be migrated before deployment. Rehearse exact-version
      reactivation, atomic successor rotation, permanent old-version enumeration, active-ticker uniqueness,
      closed/skipped non-replay, and allocation non-redirection.
      **DETERMINISTIC VERSION KEY (founder-approved 2026-08-25):** derive and contract-verify
      `assetKey = keccak256(abi.encode(chainId, keccak256(bytes(normalizedTicker)), token,
      robinhoodAssetIdHash))`; do not accept a Safe-selected opaque alias. Use the existing validated
      uppercase ticker grammar. Chain, ticker, exact token address, and RHJ provider-id hash are immutable
      identity fields, so changing any one creates a new version. Display-name corrections and active
      status toggles retain the same key. Update the Safe proposal/deactivation tooling to select exact
      version keys, and test independent recomputation, wrong-key rejection, mainnet/rehearsal namespace
      separation, ticker-rename versioning, and metadata/status stability before activation.
      **ACTIVE-SET UNIQUENESS (founder-approved 2026-08-25):** inactive history may repeat ticker, token
      address, or RHJ provider-id hash, but no two active versions may share any one of those fields.
      Activating a version must atomically deactivate every distinct active conflict across all three
      indexes, then bind the ticker/address/provider active indexes to the new key; reactivating the exact
      version toggles its existing record and never appends a duplicate. Enforce this in
      `StockTokenRegistry`, not only in the Safe batch or database. Replace the current reverse-mapping
      assumptions and ensure every activation/deactivation emits indexable lifecycle events. Rehearse
      three separate collision cases, one successor colliding on multiple fields, ticker rename with
      shared address/provider history, exact-version reactivation, idempotent already-active activation,
      and invariant checks after every registry mutation and failed transaction.
      **EMPTY ACTIVE CATALOG (founder-approved 2026-08-25):** expose no candidates and no default, refuse
      casts, and have rollover durably record a public `catalog_empty` skipped day without publishing a
      purchasable winner or calling the buyer. Keep all ETH in the pooled Stock Token acquisition budget.
      Never restore SPY, an old default, or the development allowlist after production registry sync.
      Explicit Safe activation resumes future open ballots only; never replay the empty days. Current
      `resolveTickerBallotDay` returns transient `no_tickers` and writes no durable skipped result, so add
      the status/history surface and rehearse zero-candidate casting, rollover, publisher/buyer silence,
      budget preservation, recovery, and non-backfill before arming either keeper.
      **CURRENT SUBMISSION TOOL IS LEGACY-SHAPED:** `npm run stock-catalog -- --tickers ... --registry ...`
      correctly produces unsigned Safe calldata and never self-approves, but it still derives
      `keccak256(ticker)` and calls mutable `upsertAsset`. Do not execute it for production catalog changes
      until it emits the deterministic immutable-version registration/activation calls approved above.
      **PUBLIC FAMILY NOMINATIONS (founder-approved 2026-08-25):** provide a public, non-binding queue on
      which a currently seated boss/underboss may submit an RHJ ticker plus short reason and other seated
      families may publicly endorse it. Persist the submitter family/seat authority, timestamps, rationale,
      endorsements, and a snapshot of Robinhood discovery identity/status as evidence. The queue must not
      call the registry, mutate ballot candidates, or imply Safe approval. Only an executed Safe version
      approval followed by worker sync may move an item into `GET /v1/commission/ticker` candidates.
      Rate-limit submission and endorsement, preserve review/moderation/disposition history, and prove a
      nomination cannot rewrite closed/skipped ballots or redirect allocations. No nomination schema,
      route, or board exists yet; implement and rehearse the full non-authoritative boundary before launch.
      **NOMINATION CLOCKS (founder-approved 2026-08-25):** enforce one new nomination per family per
      rolling 168 hours and a 30-day pending lifetime. Give each seated family one endorsement slot per
      pending nomination, writable/replaceable/removable only by its current boss or underboss. Safe
      dispositions `approved`, `rejected`, and `not_eligible` close immediately; `expired` archives at the
      deadline. An approved disposition is still non-authoritative until the Safe transaction executes
      and registry sync confirms the active version. After cooldown, renomination creates a new linked
      record with a fresh discovery snapshot; never reopen or overwrite the archived item. Rehearse the
      family-keyed cooldown across boss changes, exact deadline races, endorsement changes/withdrawals,
      each terminal disposition, post-close write refusal, delayed Safe execution, expiry without side
      effects, and fresh-evidence renomination.
      **SEAT TURNOVER DURING REVIEW (founder-approved 2026-08-25):** keep a valid nomination pending and
      public when its submitting family loses its seat or dissolves, but revoke that family's nomination
      and endorsement write authority immediately. Preserve its endorsement event in history while
      excluding it from the current seated-support count. Reseating must not reactivate the old event;
      require a fresh endorsement from the current boss/underboss. Allow newly seated families to endorse
      still-pending items, and expose both current support and historical events without implying either
      binds the Safe. Recheck seat/rank under the write transaction lock. Rehearse seat loss and dissolution
      between authorization and commit, leadership replacement, reseating, concurrent endorsement/rollover,
      and current-count recomputation from immutable history.
      **EXACT-IDENTITY DEDUPLICATION (founder-approved 2026-08-25):** allow at most one pending nomination
      per deterministic version key citywide. A duplicate submission must return the existing item and
      offer its endorsement path without inserting a row or consuming the family's seven-day nomination
      allowance; endorsement requires an explicit authorized confirmation and may carry that family's
      rationale. Enforce pending-key uniqueness with a database constraint plus transaction-safe conflict
      handling, not a preflight read. Permit different version keys with the same ticker, but group/mark
      them `identity_conflict` and disclose that no more than one can be active. Terminal/expired history
      does not block a fresh linked nomination with new evidence. Rehearse simultaneous first submissions,
      retry/idempotency, duplicate redirect without endorsement, confirmed endorsement, cooldown
      preservation, same-ticker/different-identity grouping, and post-terminal renomination.
      **SPONSOR COUNTING (founder-approved 2026-08-25):** persist exactly one immutable sponsor family per
      nomination and forbid that family from endorsing its own item. Count one live sponsor only while it
      is seated with current sponsor support, plus at most one affirmative endorsement from each other
      currently seated family; assert the total is always `0..5` and no family appears twice. Seat loss or
      dissolution retains sponsor history but removes live support. Reseating requires an explicit
      `sponsor_support_renewed` write by the current boss/underboss and must not create an endorsement or
      revive support on read. Expose sponsor identity/currentness, current supporting families/count, and
      immutable history separately. Rehearse self-endorsement refusal, five-family maximum, seat-loss and
      reseating races, leadership replacement, dissolution, duplicate retries, and derived-count audits.
      **REVIEW-REQUESTED THRESHOLD (founder-approved 2026-08-25):** at three current supporting families,
      including a current sponsor, transition an unclaimed item to `review_requested`, refresh and persist
      timestamped RHJ discovery evidence, and alert operators. Do not generate/sign/submit Safe calldata or
      imply approval. A failed evidence refresh must remain visible and must not masquerade as fresh.
      Before claim, live support below three returns the item to `pending`; after an operator claims
      `under_review`, support/seat changes update public state but never auto-cancel review. Permit an
      authorized operator to claim below threshold for risk, timing, or catalog health. Sort pending work
      by `current_support DESC, created_at ASC, id ASC`. Rehearse threshold crossing/falling, concurrent
      endorsement and claim, failed/slow evidence refresh, manual below-threshold claim, support churn
      during review, alert idempotency, and deterministic pagination/order.
      **FIXED REVIEW QUORUM (founder-approved 2026-08-25):** require three distinct currently seated
      supporting family ids for automatic `review_requested`, regardless of how many of the five seats are
      occupied. Never calculate a majority of occupied seats or weight support by seat rank. With fewer
      than three seated families, only an authorized manual claim may begin review. Recompute live support
      on seat fill/vacancy without changing the constant or disturbing `under_review`. Rehearse chambers
      with 0–5 occupied seats, duplicate-family exclusion, weighted-rank irrelevance, third-seat arrival,
      pre-claim vacancy, concurrent seat rollover/endorsement, manual sparse-chamber claim, and claimed
      review persistence.
      **HARD 30-DAY NOMINATION DEADLINE (founder-approved 2026-08-25):** write immutable
      `pending_until=created_at+30 days` and apply it to `pending`, `review_requested`, and `under_review`.
      Claim, reassignment, evidence refresh, support churn, and progress updates must not pause/reset/extend
      it. Under the nomination row lock, allow unresolved writes only while database `now() < pending_until`;
      at/after the boundary, expiry wins and snapshots assigned reviewer plus latest public note. Expiry has
      no Safe/registry/ballot effect and later work requires a fresh linked nomination/evidence snapshot.
      Terminal `approved`, `rejected`, and `not_eligible` records do not expire; expose approved-but-
      unexecuted Safe/sync status separately and as non-voteable. Rehearse exact-boundary races against
      every write, worker/request idempotency, reassignment/update non-extension, under-review expiry,
      terminal-before-deadline survival, approved-but-delayed execution, and absence of reopen/extension.
      **SEVEN-DAY SAFE EXECUTION TTL (founder-approved 2026-08-25):** freeze the exact deterministic
      `asset_key`, final `evidence_hash`, `approved_at`, and immutable `valid_until=approved_at+7 days` in
      both the approval record and generated Safe calldata. The registry must verify the key/evidence
      binding and reject activation unless `block.timestamp <= validUntil`; emit the evidence hash and
      deadline with the lifecycle event. Mining before the boundary remains valid despite delayed mirror
      sync. If unexecuted after the boundary, retain nomination status `approved` but set execution status
      `approval_stale`; forbid deadline extension, calldata regeneration, or replay from that review. A
      fresh linked nomination/evidence/review is required. Expose approval/deadline, Safe tx id/hash,
      execution block/time/hash, and sync state separately. Current registry and proposal helpers have no
      TTL/evidence parameters, so replace them and rehearse exact timestamp boundaries, delayed inclusion,
      delayed sync, reverted/failed Safe execution, idempotent stale transition, old-calldata rejection,
      and fresh-review recovery before launch.
      **PRE-EXECUTION EVIDENCE DRIFT (founder-approved 2026-08-25):** from approval until execution, run an
      off-chain watcher over the bound RHJ identity/status and every approved venue/oracle/exposure
      prerequisite. On material drift, persist public `evidence_drift` with field-level reason and observed
      timestamp, alert Safe owners, and hard-block first-party proposal/presentation/broadcast tooling. Do
      not give the watcher or RHJ feed registry authority and do not claim it can invalidate signed
      calldata. Display residual executability until explicit Safe cancellation or TTL expiry; if the Safe
      executes before expiry despite the warning, accept the contract result and raise a durable
      Safe-governance incident. Rehearse API outage versus verified drift, repeated alerts, cancellation,
      TTL expiry, and deliberately executed drifted calldata.
      **ATOMIC REGISTRY ACTIVATION (founder-approved 2026-08-25):** expose one Safe-callable atomic transition
      that deactivates every conflicting active ticker/token/provider id, creates or selects the exact
      immutable version, rechecks all active-set uniqueness constraints, and activates it. Revert the whole
      call on any failure and emit deterministic conflict-deactivation plus activation events. Apply the
      transaction as one mirror unit. Rehearse two- and three-field conflicts, exact-version reactivation,
      concurrent attempts, failed creation/activation, event ordering, idempotent indexing, and the absence
      of both duplicate-active and replacement-missing intermediate states.
      **FINALIZED-CHAIN VOTEABILITY (founder-approved 2026-08-25):** model `safe_submitted`,
      `executed_pending_finality`, and `synced_active` separately. Only a canonical activation event that
      passes the configured chain-finality policy and has been synchronized is voteable; submission,
      transaction-service status, a receipt, or optimistic indexing is insufficient. Preserve an inclusion
      that met `block.timestamp <= validUntil` even when finality/sync lands after the deadline. On a
      pre-finality reorg, return to non-voteable, alert, and apply the existing pre-close candidate
      deactivation/recast rule to any open ballot that observed the version. Rehearse delayed mining,
      deadline-edge inclusion, delayed finality, delayed indexing, shallow/deep reorg handling, duplicate
      logs, and ballot creation racing the finality transition.
      **SINGLE-REVIEWER TERMINAL DISPOSITION (founder-approved 2026-08-25):** permit one authenticated
      authorized RWA reviewer to set `approved`, `rejected`, or `not_eligible` without a second reviewer or
      co-signature. Atomically freeze reviewer identity, terminal status, public rationale, evidence
      references, and final evidence hash; an approval writes `approved_at` and starts its seven-day Safe
      TTL. Keep this role incapable of catalog activation: Safe threshold, execution, finality, and sync
      remain independent required gates. Rehearse single-reviewer approval/rejection/ineligibility,
      unauthorized access, replay, reassignment races, immutable disposition, and exact approval timestamp.
      **POST-ACTIVATION OPERATIONAL QUARANTINE (founder-approved 2026-08-25):** continuously monitor
      `synced_active` versions. Verified material drift sets `operational_quarantine`; an unavailable or
      otherwise unverifiable critical predicate sets `health_unknown`. Both statuses immediately block new
      ballot inclusion, new/changed votes, purchases, and automatic delivery. Apply the existing open-ballot
      invalidation/recast rule; if purchase has not executed for a closed winner, skip without substitute
      and retain the ETH in the pooled Stock Token acquisition budget. Preserve all ownership and permanent
      allocation records without seizure, substitution, redirection, or expiry. Expose registry-active and
      operationally-blocked states together. The watcher gets no activation, permanent-deactivation,
      transfer, or reassignment authority. Rehearse verified drift, source outage, repeated/idempotent
      quarantine, each blocked surface, open/closed ballot races, paused delivery, and allocation survival.
      **QUARANTINE CLEARANCE VERSUS REACTIVATION (founder-approved 2026-08-25):** when the exact version is
      still active on-chain, require no new nomination but require fresh reason-resolving evidence, one
      authorized reviewer approval, an evidence-bound Safe clearance action with a fresh seven-day TTL,
      canonical finality, and mirror sync before unblocking. When the Safe deactivated the version, require
      a fresh linked public nomination with zero carried endorsements/support, fresh RHJ evidence/review,
      new TTL-bound Safe approval, atomic registry execution, finality, and sync. Reactivate an unchanged
      immutable identity in place rather than creating a duplicate, and link the complete old nomination,
      quarantine, deactivation, and recovery history. Rehearse clearance expiry/replay, unresolved reasons,
      reviewer/Safe races, reactivation conflicts, no-support carryover, and exact-version history linkage.
      **QUARANTINE-ENTRY AUTHORITY (founder-approved 2026-08-25):** let deterministic watcher predicates
      automatically set `operational_quarantine` on verified drift and `health_unknown` on unverifiable
      critical health; also let one authenticated authorized RWA reviewer impose either immediately. Require
      stable reason code, public explanation, exact asset key, actor, evidence/source observations, and
      observed timestamp. Deny families, nominees, endorsers, ordinary operators, agents, and clients. Entry
      requires no Safe action because it only removes permission; clearance still follows the Safe recovery
      gate. Make repeats idempotent, preserving original `quarantined_at` while appending observations.
      Rehearse concurrent auto/manual entry, authorization boundaries, evidence redaction, repeat triggers,
      monotonic original time, status escalation, and no entry-side asset or registry mutation.
      **FIVE-MINUTE MONITOR / TEN-MINUTE FRESHNESS (founder-approved 2026-08-25):** check each
      `synced_active` version at least every five minutes and synchronously revalidate immediately before
      candidate-snapshot publication, purchase broadcast, delivery-batch start, and clearance broadcast.
      Treat critical health older than ten minutes as unusable `health_unknown`; never let an earlier ballot
      check authorize a later purchase/delivery. Fail closed on timeout, malformed response, signature
      failure, identity mismatch, or unverifiable chain/token/provider tuple, distinguishing outage from
      verified drift. Allow tighter production values but reject ordinary configuration that loosens the
      ceilings; require a documented founder/Safe policy change. Expose `last_checked_at`, `last_healthy_at`,
      status, and redacted reason. Rehearse clock boundaries, scheduler delay, process restart, provider
      outage/recovery, stale cache, action/preflight races, and forbidden production override.
      **IN-FLIGHT PURCHASE/QUARANTINE RACE (founder-approved 2026-08-25):** before broadcast, atomically
      persist the exact health/catalog/ballot/quote-oracle snapshots, intended spend, and transaction intent;
      any known quarantine blocks broadcast, skips without substitute, and retains pooled ETH. Quarantine
      after broadcast but before mining sets `purchase_at_risk`; attempt same-nonce cancellation/replacement
      only when signer/chain architecture makes it safe, label it best effort, and never broadcast a
      substitute ticker. Cancellation success or purchase revert leaves the day skipped and ETH unspent. A
      canonically finalized purchase wins the race: preserve the trade, allocate units to that day's cohort,
      pause delivery, and forbid unwind/substitution/reassignment. Publish observation/broadcast/inclusion/
      finality chronology and forbid later rebuy/catch-up. If ordering cannot be proven, set
      `ordering_uncertain`, preserve canonical assets and ledger, pause delivery, and require operator review.
      Rehearse every ordering, mempool replacement loss/win, dropped/replaced transactions, reorgs, duplicate
      callbacks, allocation idempotency, unknown ordering, and delivery resumption after valid clearance.
      **QUARANTINE DELIVERY-BACKLOG RESUMPTION (founder-approved 2026-08-25):** resume only after clearance
      canonical finality, mirror sync, and a new synchronous health preflight. Preserve exact asset key,
      cohort, amount, creation time, and FIFO priority ordered by allocation creation time then stable id;
      newer rows cannot jump older eligible paused rows, while held/ineligible rows do not head-of-line block.
      Use idempotent stage-then-confirm batches. If quarantine returns, block new stages, release an
      unbroadcast stage without changing `delivered`, and resolve a broadcast transfer from canonical chain
      outcome before pausing the rest. Grant no substitute/cash/yield/bonus/enlargement for delay. Expose
      backlog size, oldest paused time, latest completed batch, and blocker. Rehearse clearance-before-
      finality, stale post-clear health, FIFO ties, held-row skipping, crash/restart, duplicate callbacks,
      re-quarantine at each stage, broadcast finality/reorg, and exactly-once delivered accounting.
      **PERMANENTLY UNDELIVERABLE STOCK TOKEN (founder-approved 2026-08-25):** set
      `delivery_impossible_pending_resolution` when the exact token is permanently frozen,
      non-transferable, irrecoverable, or unsupported; preserve every allocation and cohort indefinitely.
      Forbid unrelated Stock Tokens, general treasury ETH, $OMR, game cash, and synthetic internal credit.
      Permit Safe resolution only from value actually recovered from the exact holding—verified RHJ
      redemption/liquidation, successor corporate-action consideration, or recovered original units—and
      distribute at most that amount pro rata by original cohort weights. Keep deterministic rounding residue
      with the same cohort. With no recovery, retain the public unresolved liability. Require fresh evidence,
      one authorized reviewer, exact Safe calldata, finality/sync, and a public conservation proof. Rehearse
      zero/partial/multiple recoveries, decimals and rounding, duplicate resolution, over-distribution,
      treasury commingling rejection, cohort isolation, successor asset identity, and permanent zero recovery.
      **USER DELIVERY HOLD (founder-approved 2026-08-25):** default to automatic Street Deed TBA delivery,
      but permit the authenticated owner to set reversible `delivery_hold` globally or per immutable version.
      Preserve the allocation without forfeiture/expiry/redirection/sale/redemption/substitution/conversion or
      any cash, interest, yield, priority, compensation, or vote. Clearing restores original FIFO position.
      Recheck before staging and before broadcast; release a newly held unbroadcast stage without changing
      `delivered`, while a post-broadcast hold cannot cancel/reverse canonical execution. Make toggles
      idempotent and prevent batch reservation/starvation; skip held rows so later eligible rows proceed.
      Expose public `user_held` without leaking authenticated controls. Death, inactivity, logout, and
      indefinite hold never forfeit the allocation tied to the designated deed TBA. Rehearse global/version
      precedence, rapid toggles, stage/broadcast races, clearing into FIFO, death/account recovery, and no
      double delivery.
      **STREET DEED DELIVERY-DESTINATION BINDING (founder-approved 2026-08-25):** hold unbound allocations as
      account-beneficial `awaiting_deed`. Accept a deed only after canonical extraction finality,
      deterministic ERC-6551 TBA derivation, and current ownership. Auto-select exactly one eligible deed as
      `rwa_delivery_deed`; when multiple exist, require authenticated explicit selection and forbid silent
      oldest/newest/value defaults. On establishment, bind every unbound and future allocation to exact chain
      id/deed contract/token id/TBA, whole and unsplit. A later primary change affects only still-unbound and
      future rows; bound destinations are immutable. Selection itself moves no asset/value and charges no
      fee/tax. Rehearse zero/one/multiple deeds, simultaneous extraction/selection/transfer, invalid ownership,
      TBA derivation mismatch, bulk unbound binding, primary changes, split rejection, and idempotent selection.
      **BOUND RIGHTS FOLLOW DEED TRANSFER (founder-approved 2026-08-25):** a finalized Street Deed transfer
      transfers control of its TBA holdings, already-bound pending allocations, and their delivery holds.
      Preserve original qualifier/activity/cohort audit history without re-scoring the recipient. Persist holds
      across transfer; after finality, authorize only the new owner and immediately reject the former owner.
      Keep staged/broadcast delivery addressed to the unchanged TBA. Before transfer, publicly disclose
      aggregate pending allocations, exact versions, delivered/undelivered amounts, quarantine/health/
      impossible statuses, and holds; do not price, guarantee, or intermediate the sale. Rehearse ownership
      finality/reorg, hold-control races, staged delivery, disclosure completeness, cache invalidation, and no
      reallocation/double allocation/substitution/scoring/cohort mutation.
      **BOUND BENEFICIARY IMMUTABILITY / PROTOCOL MIGRATION ONLY (founder-approved 2026-08-25):** forbid user,
      reviewer, support, database admin, keeper, and ordinary Safe redirection to any other deed, EOA, TBA,
      character, or account. Lost wallet, recovery request, inactivity, death, sanctions, and sale dispute do
      not create discretion; use deed control/transfer and owner wallet recovery. Permit only a verified
      protocol-wide defect/chain migration with deterministic one-to-one old-to-new mapping, preserved current
      deed owner plus all allocation fields/history, exact Safe calldata, public mapping and conservation
      proof, canonical finality, and mirror sync. Forbid individual rescue through the migration path and pause
      delivery until completion. Rehearse every denied actor/reason, attempted partial migration, owner change
      during migration, mapping collision/omission, conservation failure, Safe expiry, reorg, and resume.
      **DEDICATED RWA DELIVERY-GAS BUDGET (founder-approved 2026-08-25):** pay automatic Stock Token delivery
      gas by default from separately accounted operations ETH funded by operator/Safe or an explicitly designated
      protocol-operations source. Charge no post-extraction user delivery fee. Forbid deductions from user
      allocation, cohort holdings, pooled Stock Token acquisition ETH, withdrawal reserves, $OMR, game cash,
      or balances; funding grants no allocation/priority/claim/repayment/yield. Enforce a Safe-set fee ceiling.
      Set `delivery_gas_unfunded` or `delivery_gas_above_ceiling` when blocked, preserving allocations/FIFO
      and exposing reason, budget balance, ceiling, and oldest delay. Forbid keeper token sale/skimming.
      Record tx hash, gas used, effective gas price, ETH spent, funding-source category, and remaining balance.
      This automated-gas restriction does not constrain the separate `mainOperator` arbitrary ETH-transfer
      authority; if used to fund gas or any other destination, record a pool-reducing `operator_outflow`.
      Rehearse empty/partial funding, high-fee pause/recovery, ceiling boundaries, fee estimation drift,
      accounting/reorg/replacement, prohibited-source attempts, and restart without priority loss.
      **INTEGER ATOMIC UNITS / LARGEST REMAINDER (founder-approved 2026-08-25):** read actual token
      `decimals()`, bound the supported range, and cache by exact version. Store purchase/allocation quantities
      only as integer atomic units. For each daily cohort, floor exact activity-weighted pro-rata entitlement,
      distribute all remaining units by largest fractional remainder, and break equal remainders by stable
      immutable account id ascending. Require allocation sum exactly equals cohort purchased units. When units
      are fewer than eligible accounts, persist public `qualified_rounded_zero` with weight/result but no
      liability. Carry no fraction across day/version/cohort. Preserve every positive atomic unit regardless
      of value and allow same-deed/version delivery aggregation without losing row history. Rehearse decimals
      bounds/cache drift, huge integers, zero purchase, fewer units than accounts, equal remainders, stable-id
      ordering, exact conservation, no fractional carry, and one-unit delivery.
      **PER-ITEM ISOLATED DELIVERY BATCHES (founder-approved 2026-08-25):** aggregate all currently eligible
      positive undelivered rows for one deed TBA/exact version into one immutable delivery-item id for the full
      staged amount. Bound multiple items per transaction, but isolate recipient-specific revert/false-return/
      restriction so unrelated successes stand. Emit canonical result per item with asset key, deed/TBA,
      atomic units, id, and tx. After finality confirm success rows exactly once; for failure increment nothing,
      expose stable reason, release/retain stage safely, and link a new transaction attempt to the same logical
      id. Halt the entire version on token-wide or inventory/conservation failure. Enforce delivered <=
      allocated and staged + delivered <= held across retry, duplicate log, reorg, and restart. Batch caps may
      not change FIFO, permanently skip an inconvenient recipient, or favor size. Rehearse mixed success,
      recipient revert/false return, token-wide pause, gas exhaustion, malformed token, reorg, duplicate event,
      partial worker crash, repeated retry, inventory deficit, and bounded-batch fairness.
      **ACTUAL CUSTODY BALANCE-DELTA ACQUISITION TRUTH (founder-approved 2026-08-25):** after canonical
      finality, serialize against every movement of the exact token and record pre/post custody balance,
      transaction, asset key, vault, and block references; set `receivedUnits = postPurchaseBalance -
      prePurchaseBalance`. Treat router return, quote, venue receipt, and events as evidence only. Freeze
      allocations only on verified positive delta. On claimed/actual mismatch set public
      `acquisition_amount_mismatch` and halt allocation until reconciled. Default-deny rebasing,
      fee-on-transfer, reflection, elastic-supply, and other non-standard balance behavior; future support
      requires new immutable version, purpose-built Safe-approved accounting adapter, fresh nomination/review,
      and conservation suite. Rehearse concurrent delivery/recovery/acquisition, balance-read block pinning,
      mismatched logs/returns, zero/negative/impossible delta, reorg, cache/indexer lag, and every denied token.
      **ACQUISITION SPEND / REFUND / SLIPPAGE ACCOUNTING (founder-approved 2026-08-25):** apply the daily ETH
      cap to total ballot trade input including venue/router/liquidity fees deducted from input; book network
      gas only to delivery/operations gas accounting. Allocate every net received atomic unit and permit no
      protocol token skim. Return canonical unconsumed/refunded ETH to the pooled acquisition budget without
      enlarging the day's allocation or authorizing a second ticker. Accept in-bound slippage through lower
      actual units; revert out-of-bound execution. Forbid treasury/operator/Safe-owner/family/broker/keeper
      compensation for ordinary slippage or capture of favorable execution. Publish intended input, actual
      consumed/refunded ETH, units, effective price, oracle/reference, deviation, venue/adapter, and separate
      gas. Rehearse exact cap, fee-on-input, refunds, favorable/adverse bounds, price decimals, no skim,
      accounting conservation, and acquisition-versus-gas source separation.
      **HARD TWO-HOUR PURCHASE WINDOW / ONE SUCCESS (founder-approved 2026-08-25):** freeze
      `purchase_until=closed_at+2 hours` per ballot and enforce `block.timestamp <= purchaseUntil` in buyer
      calldata/contract. Never extend for worker/provider outage, gas, quarantine, quote, contention, failed/
      replaced transaction, or operator delay. Let one logical intent retry reverted/dropped/cancelled/safely
      replaced attempts before the boundary, while admitting exactly one canonical success. Any positive
      output satisfying `minOut` and price bounds, including partial fill, closes the intent with no top-up;
      return unused/refunded ETH to the pool. If none succeeds on time, set `purchase_window_missed`, skip with
      no substitute/replay, and make late inclusion revert on-chain. Preserve on-time inclusion despite later
      finality/sync. Link all attempt statuses publicly. Current buyer lacks this deadline binding, so rehearse
      exact timestamp edges, inclusion-before/finality-after, multiple pending attempts, replacement races,
      partial output, zero/below-min output, duplicate success, late mining, worker restart, and permanent miss.
      **INDEPENDENT FIVE-MINUTE PRICE ORACLE / 500-BPS HARD CEILING (founder-approved 2026-08-25):** forbid
      execution venue/router/pool from serving as its own independent reference. Safe-approve source sets per
      exact asset version; require at least one independently governed valid price and median multiple valid
      sources after decimal/quote-direction normalization. Bind asset key, source, price, decimals, quote
      currency, observation time, round/sequence id, and evidence hash; expire after five minutes. Let Safe
      set tighter per-version deviation but enforce a contract hard maximum of 500 bps (5%) that only reviewed
      upgrade can raise. Enforce `minOut` plus effective-price deviation and direction/decimal guards on-chain.
      Fail closed on missing/stale/malformed/zero/negative/inconsistent/wrong-asset data without venue quote,
      prior close/day, operator value, or unverified cache fallback. Publish used source/median and rejected
      sources/reasons. Rehearse one/many/no source, median outlier, decimal inversion, round replay, exact
      five-minute and 500-bps edges, stale fallback attempts, Safe over-cap config, and contract-upgrade gate.
      **CALENDAR-NEUTRAL MARKET AVAILABILITY (founder-approved 2026-08-25):** continue daily ballot lifecycle
      and permanent vote record, but purchase within its two-hour window only with healthy transferable exact
      token, executable approved venue, <=5-minute independent reference, and passing price/exposure/liquidity/
      inventory gates. If conditions never converge, set `market_unavailable`, buy/substitute nothing, and
      pool ETH. Do not use a human calendar or stale close as authority. Weekend, holiday, halt, oracle
      maintenance, and RHJ pause grant no extension or later catch-up; permit genuine off-hours trading only
      with live venue and fresh oracle. Expose `underlying_market_closed`, `venue_unavailable`,
      `oracle_unavailable`, `oracle_stale`, `asset_halted`, and combined reasons. Rehearse each single/combined
      outage, recovery just before/after deadline, valid off-hours market, stale prior-close rejection, and no
      Monday replay.
      **ADAPTER / ATTEMPT CONFINEMENT (founder-approved 2026-08-25):** allow only exact Safe-approved adapter
      address and deployed code hash per chain; forbid arbitrary targets/calldata and `delegatecall`. Bind every
      attempt to chain id, ballot/intent ids, asset key/output token, custody vault, max input, `minOut`, oracle
      snapshot/evidence, max deviation, `purchaseUntil`, and attempt deadline <= now+5 minutes and <= purchase
      deadline. Forbid output redirect/retention, unrelated spender, unbounded approval, and residual ETH
      outside approved acquisition/custody paths. Prefer private submission but allow public mempool only with
      every on-chain wall. Retry may refresh quote/oracle and lower input within remaining authority, never
      increase above it or automatically widen slippage/deviation. Revocation affects future attempts only.
      Require fresh Safe approval/security verification for adapter code, proxy implementation, or code-hash
      change; create no new asset version unless immutable token identity changes. Publish targets, hashes,
      parameters, submission route, replacements, and outcomes. Rehearse code-hash drift, proxy upgrade,
      arbitrary-call/delegatecall attempts, recipient/residual redirect, allowance abuse, public/private paths,
      five-minute attempt boundary, lowered-input retry, widening rejection, revoke race, and finalized survival.
      **DEDICATED ACQUISITION VAULT + MAIN-OPERATOR ARBITRARY ETH EXIT (founder-approved 2026-08-25):** default
      all acquisition ETH into a separate `RwaAcquisitionVault` accounting canonical inflow, reservations,
      purchases, refunds, available capital, and unattributed surplus. Normal release is buyer-only for exact
      ballot/asset/max-input/deadline/adapter/intent; refund only to vault. Let Safe pause/tighten/revoke but not
      arbitrary-sweep. Separately grant one public `mainOperator` address unilateral ability to transfer any
      amount of available, unattributed, or reserved vault ETH to any address/purpose without Safe approval,
      destination allowlist, purchase/exposure caps, or timelock. Atomically cancel/invalidate affected
      reservations before reserved funds leave. Emit `operator_outflow` with operator/recipient/amount/reason
      code/nonzero details hash/pre-post balance/buckets/impacted intents; adjust accounting invariant and forbid
      Stock Token or
      allocation mutation. Rehearse every bucket, full/partial drain, reserved cancellation, purchase race,
      transfer failure, reentrancy, accounting underflow, and public disclosure. Treat this as an explicit
      unilateral trust assumption; do not claim the vault is unsweepable or strictly acquisition-only.
      **ONE PUBLIC OPERATOR / TWO-STEP ROTATION (founder-approved 2026-08-25):** store and expose exactly one
      current `mainOperator` (zero means disabled), any `pendingMainOperator`, proposal time, acceptance time,
      nomination expiry, and role generation. Bind the initial operator in the deployment manifest. Permit the
      Safe to set the current operator to zero immediately; zeroing atomically cancels any pending nomination,
      increments generation, and invalidates every outstanding signed authorization. Re-enabling even the same
      address requires a fresh public Safe nomination, a wait of at least 48 hours, and acceptance by the
      nominated address itself. Expire that nomination seven days after its acceptance time and require a fresh
      nomination after expiry. Let Safe cancel before expiry. Keep the old operator live until acceptance unless
      disabled first; atomically replace on acceptance and emit old/new/generation. Treat this as the Safe-driven
      and zero-role restoration path, separate from active-operator instant replacement below. Rehearse zero-
      disable races, atomic pending cancellation, signature invalidation,
      same-address re-enable, early/wrong-address/late acceptance, old-operator ordering, and accepted rotation.
      **INSTANT CURRENT-OPERATOR SELF-REPLACEMENT (founder-approved 2026-08-25):** let the active operator directly
      install any nonzero successor immediately through `replaceMainOperator`, without Safe approval, nomination,
      acceptance delay, or timelock. Never relay the call; require `msg.sender == mainOperator`. In the same
      transaction require the successor's EIP-712 acceptance binding action, chain ID, verifying vault, current
      operator, proposed operator, current generation, `issuedAt`, and acceptance deadline. Require the nominee
      to be nonzero and different from current. Enforce `issuedAt <= block.timestamp <= deadline`,
      `deadline > issuedAt`, and `deadline - issuedAt <= 1 hour`; reject future/expired/zero/reversed/over-hour
      consent before mutation. Validate the nominee by exact
      ECDSA recovery or exact ERC-1271 magic under the existing fail-closed type rules. Atomically clear any
      pending Safe nomination, set successor, increment generation, invalidate old signatures, preserve
      `nextOutflowNonce`, and emit old/new/generation. Old authority ends immediately in canonical ordering; Safe
      retains immediate zero-disable. Move no ETH and mutate no bucket/reservation/allocation/cap. Rehearse EOA/
      smart-wallet combinations, no/malformed/wrong nominee consent, direct/relay attempts, pending Safe proposal,
      same-address/zero nominee, every consent-time boundary, outflow signature invalidation with nonce
      preservation, transaction ordering, and Safe zero after handoff.
      **ADDRESS-BASED SMART-WALLET OPERATOR IDENTITY (founder-approved 2026-08-25):** bind operator authority to
      the installed address, not runtime code hash, proxy implementation, owners, modules, or signature policy.
      Do not auto-rotate/disable/increment generation when those change. Validate current caller or ERC-1271
      behavior on every action. Publicly monitor and surface code hash, detectable implementation, owner/module/
      configuration changes, validation failures, code appearance/disappearance, and last-check time as warnings,
      specifically `operator_wallet_changed` and `operator_wallet_health_unknown`, without changing authority or
      pausing action. Permit direct action when current caller equality holds and relay when current EOA/ERC-1271
      validation succeeds on-chain. Preserve immediate Safe zero-disable. Rehearse Safe owner/module threshold
      changes, proxy upgrades, code appearance/disappearance, ERC-1271 loss/recovery, direct-call loss, warning
      staleness, and Safe restoration after an operator wallet becomes unusable.
      **FIVE-MINUTE OPERATOR-WALLET WATCH / TEN-MINUTE FRESHNESS (founder-approved 2026-08-25):** check code,
      detectable implementation, owners/modules/configuration, and validation behavior at least every five
      minutes; after ten minutes mark `operator_wallet_health_unknown`. Before the server constructs or relays an
      operator transaction, synchronously attempt refresh and publish `last_checked_at`, `last_changed_at`,
      `last_healthy_at`, observed identity/configuration, warning, and failure reason. A watcher/refresh failure
      warns but does not veto; on-chain caller/signature validation is authoritative. Direct chain calls never
      depend on watcher/server/API. Rehearse exact cadence/freshness boundaries, failed/partial reads, reorg,
      provider disagreement, stale recovery, server relay under warning, and direct action during total outage.
      **PUBLIC REASON + DETAILS COMMITMENT FOR EVERY OPERATOR-ROLE CHANGE (founder-approved 2026-08-25):** require
      one code from the existing closed `operations`/`security`/`purchase_recovery`/`migration_bypass`/
      `retirement`/`other` taxonomy plus nonzero `detailsHash` for instant replacement, direct renunciation, Safe
      zero-disable, Safe nomination, nomination cancellation, and nominee acceptance. Bind both into relevant
      EIP-712/ERC-1271 digests and direct/Safe calldata; emit immutable actor/old/new/pending/generation/transition/
      reason/details fields. Do not gate execution on off-chain text availability or permit public surfaces to
      rewrite the commitment. Rehearse missing/unknown/zero reason fields, signature substitution, every role
      path, lost explanation text, and immutable historical rendering.
      **UNATTRIBUTED ETH QUARANTINE + SAFE RECLASSIFICATION (founder-approved 2026-08-25):** classify forced ETH,
      mistaken transfers, and every unexplained positive balance surplus as `unattributed`, unavailable to buyer
      or reservation. Book plain receipts immediately and provide permissionless `syncUnattributed()` to book a
      positive `balance - accountedBuckets` delta without spend authority. Let only Safe publicly reclassify a
      specified amount to available acquisition ETH with reason/details and old/new buckets; keep every normal
      ballot/oracle/adapter/purchase/daily/rolling wall, and never revive or retro-fund an intent. Preserve the
      main operator's existing ability to withdraw unattributed ETH through `operator_outflow`. Treat negative
      drift as invariant failure/pause, never implicit haircut. Rehearse receive, forced self-destruct-style
      balance, mistaken transfer, repeated/partial sync, Safe partial/full reclassification, cap enforcement,
      operator withdrawal race, reorg, and negative-drift alarm.
      **IMMUTABLE PERMISSIONLESS RESERVATION EXPIRY (founder-approved 2026-08-25):** bind every reservation to one
      immutable deadline inside the two-hour attempt window and require `block.timestamp < deadline` to execute.
      At/after deadline let anyone idempotently `expireIntent(intentId)`, mark terminal `intent_expired`, and
      release the entire remaining reservation to available ETH except any uncertain portion already quarantined as
      `reconciliation_pending`; release proven unaffected value immediately and retain uncertainty until Safe
      reconciliation. Never extend/revive/re-reserve/execute the
      intent and grant no substitute/catch-up; released ETH is usable only by later fresh capped authority.
      Rehearse pre/exact/post-deadline blocks, pre-deadline broadcast mined late, repeated expiry, expiry versus
      purchase/operator-cancel ordering, partial prior state, restart, and released-balance reconciliation.
      **DETERMINISTIC SINGLETON PURCHASE INTENT (founder-approved 2026-08-25):** permit at most one logical intent for
      each closed ballot and exact asset version, identified by
      `keccak256(abi.encode(chainId, vault, ballotId, assetVersionKey))`. Preserve that lifecycle record permanently.
      Serialize transaction attempts under monotonic `attemptNonce`, allow at most one registered live attempt, and
      link every replacement/retry so only one can settle canonically. Reject every second/parallel intent, split,
      asset change, second success, and recreation after success/partial-fill/expiry/operator-cancel/other terminal
      state without mutating reservation, bucket, clock, or history. Rehearse duplicate/concurrent creation, same-
      block contention, dropped/replaced/reverted attempts, one-live-attempt enforcement, partial-fill finality,
      every terminal state, restart/reorg, and conflicting ID fields.
      **ATOMIC POST-WALL INTENT CREATION (founder-approved 2026-08-25):** authorize only the currently Safe-approved
      `RwaStockBuyer` to create intent/reservation. In the same transaction revalidate finalized closed ballot,
      deterministic ID, exact active/healthy asset version, zero deficit, sufficient unreserved available ETH,
      per-buy/daily/rolling/concentration caps, approved adapter/current code identity, fresh independent oracle and
      deviation, and future immutable deadline. Persist intent, reserve funds, initialize attempts, and consume
      `accountingSequence` only after all checks pass. Any failure/contention reverts with no intent/tombstone,
      reservation, bucket, attempt nonce, or sequence; permit retry only before the unchanged deadline. Rehearse each
      wall independently, unauthorized buyer, concurrent creation, exact-deadline boundary, stale mirror, code drift,
      partial state injection, revert atomicity, and later valid retry.
      **PERMISSIONLESS EXECUTION OF FULLY BOUND INTENTS (founder-approved 2026-08-25):** allow any address to call
      `executeIntent(intentId)` before deadline, but accept no caller-selected asset/recipient/input ceiling/adapter/
      oracle/deviation/output destination/deadline. Revalidate active state, health, deficit, reservation, caps,
      adapter/code identity, fresh oracle/deviation, and time at inclusion. Caller pays gas and receives no fee,
      rebate, refund, Stock Token, approval, or benefit; route all output to `StockVault` and all unused/returned ETH
      to `RwaAcquisitionVault`. Deny create/edit/cancel/reserve/redirect authority. Protect atomically against
      reentrancy; first valid canonical execution wins and every competing/stale/failing/terminal call reverts without
      state or sequence. Rehearse adversarial timing at every allowed wall, parameter injection, output/refund
      redirection, same-block callers, callback reentrancy, failed adapter, no-benefit accounting, and post-terminal.
      **IMMUTABLE ADAPTER-ATTEMPT RESULTS + RECONCILIATION GATE (founder-approved 2026-08-25):** make every
      pre-adapter validation failure revert without attempt nonce, record, or accounting mutation. Once the approved
      adapter is actually invoked, consume `attemptNonce` and publish one immutable result. Classify revert/false/zero
      output as retryable `attempt_failed` only when canonical pre/post vault and custody balances prove zero ETH debit
      and zero Stock Token output; preserve the active intent/reservation and permit only a sequential retry before the
      same deadline. Any nonzero/unexplained ETH debit/refund/token/custody delta becomes `attempt_reconciliation` and
      blocks new execution/final settlement until an explicit public reconciliation accounts for it. Never overwrite
      a consumed nonce/result. Rehearse pre-adapter failures, all clean failure shapes, partial debit, late refund,
      unexpected token receipt, callback/reentrancy, replacement, reorg, restart, and attempted result rewriting.
      **SAFE-ONLY ATTEMPT-RECONCILIATION FINALITY (founder-approved 2026-08-25):** permit only Safe to finalize
      `attempt_reconciliation`, classify value, release quarantine, or declare resolution. Let current main operator
      append evidence and a proposed disposition only; that submission must not mutate buckets/custody/terminal state/
      `accountingSequence` or authorize operator/relayer finality. Bind Safe finality to exact intent, consumed attempt
      nonce, closed public reason, and nonzero details hash. Rehearse operator evidence spam/replacement, false proposal,
      direct/relayed self-finalization, wrong intent/attempt, Safe smart-wallet call, replay, and public evidence history.
      **EXACT RECONCILIATION EVIDENCE + FINAL-FILL ACCOUNTING (founder-approved 2026-08-25):** publish actual ETH
      debit, cumulative verified refund, Stock Token custody delta, canonical transaction provenance, resulting
      disposition, and complete pre/post balance/buckets/deficit/intent state; consume the next
      `accountingSequence`. Treat any positive valid custody delta as the final fill at actual received units, allocate
      no more, and permit no top-up/second fill/substitute/catch-up. Never represent zero/invalid output as acquired
      stock or infer away unexplained residual value. Rehearse every debit/refund/output combination, partial fill,
      false/missing/duplicate provenance, token-decimal mismatch, reorg, restart, and sequence/mirror parity.
      **TERMINAL RECONCILIATION-PENDING QUARANTINE (founder-approved 2026-08-25):** when cancellation or deadline
      arrives during reconciliation, end execution immediately, release proven unaffected value, and move the
      unresolved portion from reservation to nonspendable `reconciliation_pending`. Do not make it available or let
      it fund another reservation. Only later Safe reconciliation may release proven-unspent value while booking
      actual debit/refund/output; permit no revival/retry/replacement/substitute/catch-up. Rehearse cancellation and
      exact-deadline ordering, partial known/unknown amounts, repeated terminal calls, late refund/output, Safe
      resolution, reorg, operator outflow pressure, bucket conservation, and permanent intent history.
      **CONTRACT-DERIVED RECONCILIATION VALUE BOUNDS (founder-approved 2026-08-25):** derive or strictly cap debit,
      verified refund, and Stock Token output from immutable pre-attempt balance snapshots, current canonical
      acquisition-vault/StockVault balances, and already-recorded canonical refund/provenance records. Let Safe choose
      disposition and commit reason/details/evidence, but never override observations, over-credit output/refund, hide
      debit, or enter unsupported value. Revert inconsistency before bucket/intent/allocation/sequence/custody mutation.
      Rehearse inflated/deflated values, stale/current balance substitution, duplicate refund, wrong token/vault,
      unsupported token behavior, partial evidence, Safe replay, reorg, and exact conservation.
      **NO-TIMEOUT RECONCILIATION QUARANTINE (founder-approved 2026-08-25):** give
      `reconciliation_pending` no timeout, abandonment, presumed outcome, or automatic release. Time/deadline age,
      Safe inactivity, unavailable signers, and missing evidence must never create available ETH. Publish amount and
      age indefinitely until valid contract-bounded Safe reconciliation; signer recovery and incident escalation own
      liveness. Rehearse long duration, signer loss/recovery, repeated expiry/cancel, restarts, UI aging, and attempts
      to use time or missing evidence as release authority.
      **OPERATOR QUARANTINE OUTFLOW / LIABILITY SURVIVES (founder-approved 2026-08-25):** preserve current main
      operator's raw `operator_outflow` authority over actual ETH accounted in `reconciliation_pending`, but never let
      that transfer finalize/classify reconciliation, release available value, erase/reduce unresolved liability, or
      label missing ETH reconciled. Consume normal outflow nonce and `accountingSequence`; publish affected records
      and complete pre/post balance/quarantine/liability/deficit. Carry resulting unbacked liability as explicit
      accounting deficit under existing pause/repair rules until canonical evidence and actual funding resolve it.
      Rehearse full/partial quarantine drain, mixed-bucket outflow, relayed/direct races, Safe reconciliation before/
      after outflow, refund after drain, deficit repair, reorg, and public mirror parity.
      **RECONCILIATION LIABILITY / BACKING / SHORTFALL INVARIANT (founder-approved 2026-08-25):** expose per attempt
      and aggregate `reconciliationLiability`, `backedQuarantineEth`, and `reconciliationShortfall`; enforce
      `reconciliationLiability = backedQuarantineEth + reconciliationShortfall` after every mutation. Make every
      positive shortfall part of vault-wide `accountingDeficit` and immediately pause new intent creation/execution
      while preserving recovery paths. Rehearse zero/partial/full backing, rounding boundaries, aggregate parity,
      outflow/reconciliation ordering, and attempts to hide shortfall from deficit or pause state.
      **DETERMINISTIC QUARANTINE DEBIT + SHORTFALL REPAIR (founder-approved 2026-08-25):** when an outflow reaches
      reconciliation backing, debit greatest backing first, then oldest `reconciliationStartedAt`, then lowest intent
      ID, fully exhausting records before at most one partial debit; caller chooses neither bucket nor record. Assign
      generic canonical repair through one queue ordered by `firstObservedAt`/`shortfallCreatedAt`, numeric
      `componentTypeCode`, then record ID, fully repairing components before at most one partial repair; an exact late
      refund repairs its own attempt first. Maintain contract-controlled bounded priority indexes or audited equivalent;
      trust no caller order/proof and perform no unbounded historical scan. Publish every affected record and aggregate
      pre/post value. Rehearse every tie, partial boundary, many-record batch, front-running attempt, replay, index
      corruption/rebuild, gas ceiling, reorg, and mirror parity.
      **UNDERFUNDED FACTUAL RECONCILIATION CLOSURE (founder-approved 2026-08-25):** allow Safe to finalize a factual,
      contract-bounded reconciliation even when proven-unspent ETH is absent. Store the absent amount as durable
      terminal `reconciled_shortfall`, create no available ETH, reduce no liability, and close the intent forever with
      no revival/retry/replacement/substitute/catch-up. Rehearse zero/full/partial funding, Safe replay, terminal intent
      rendering, later repair, and attempts to credit spendable value without backing.
      **AUTOMATIC EXACT-PRINCIPAL RELEASE AFTER TERMINAL REPAIR (founder-approved 2026-08-25):** when real repair ETH
      reaches a Safe-finalized, proven-unspent `reconciled_shortfall`, atomically reduce exact repaired shortfall and
      liability and credit exactly that principal to available ETH under the immutable disposition, with no second Safe
      action or intent reopening/edit. Create no interest, penalty, opportunity-cost compensation, damages, yield, or
      extra credit. Repair still-unresolved reconciliation as backing only. Rehearse partial/multiple repairs, exact
      completion, overpayment, generic versus exact refund, reorg, sequence parity, and attempts to double release.
      **EXACT LATE REFUND + LATE STOCK QUARANTINE (founder-approved 2026-08-25):** apply a late canonical refund to
      its exact attempt shortfall before any remainder becomes available; classify value above proven debit as
      unattributed. Append only and never reopen/edit/catch up the old intent. Route Stock Tokens received after
      terminal/final reconciliation into `unattributed_stock` keyed by exact token/version/sender/provenance. Limit Safe
      classification to continued hold, transfer of that exact token to the fixed Safe-approved recovery vault, or
      redemption/liquidation of that exact token through a Safe-approved recovery adapter. Forbid arbitrary recipient,
      retroallocation, substitution, and old-intent/allocation mutation. Exclude quarantined units from distributable
      inventory/player allocations/fulfilled-acquisition totals but include them in gross custody, concentration risk,
      and applicable exact-version exposure caps. Rehearse exact/partial/excess refunds, duplicate provenance, wrong
      token/version/sender, every allowed/forbidden classification, cap accounting, and Safe replay.
      **EXACT-PROVENANCE LATE-STOCK RECOVERY PROCEEDS (founder-approved 2026-08-25):** apply canonical ETH recovered
      from `unattributed_stock` first to the exact originating attempt shortfall and classify all remainder as
      `unattributed` ETH. Grant no automatic availability, historical-cohort allocation, reopening, substitute, or
      catch-up. Emit stock provenance/units, actual ETH output, exact repair, remainder classification, and full pre/post
      accounting. Rehearse zero/partial/full shortfall, zero/equal/excess output, duplicate recovery, and reorg.
      **ONE CODE-PINNED 48-HOUR RECOVERY VAULT (founder-approved 2026-08-25):** keep exactly one active recovery-vault
      version bound to chain/address/runtime code hash and proxy implementation address/code hash when applicable.
      Require a public Safe proposal at least 48 hours before atomic old-to-new rotation; emergency fallback is continued
      quarantine, never immediate redirection. Rehearse zero/old/new version, code/implementation drift, exact-time
      boundaries, same-block ordering, reorg, failed rotation rollback, and attempts to bypass delay.
      **CONFINED EXACT-STOCK TO CANONICAL-ETH RECOVERY ADAPTER (founder-approved 2026-08-25):** approve each adapter by
      exact address/runtime code hash and bind one exact input token/version, canonical ETH output path, fresh independent
      price, `minEthOut`, maximum slippage, immutable deadline, and fixed route. Forbid arbitrary calldata, caller path,
      `delegatecall`, persistent approval, and residual authority. Count success only when canonical ETH arrives
      atomically at the acquisition vault; keep intermediates inside the adapter and quarantine any unexpected ERC-20
      output without recovery credit. Rehearse every identity/price/output/deadline/slippage failure, malicious tokens,
      approvals, reentrancy, and transfer rollback.
      **CONSERVATIVE QUARANTINED-STOCK EXPOSURE VALUE (founder-approved 2026-08-25):** value `unattributed_stock` for
      custody/concentration/applicable exact-version walls at the greater of fresh independent-oracle market value and
      last valid acquisition price. If neither is usable, block new purchases of that exact version until valuation is
      available. Rehearse each source alone, equal/divergent values, staleness, missing decimals, extreme price,
      corporate action, and valuation recovery.
      **IMMUTABLE ONE-HOUR RECOVERY AUTHORIZATION (founder-approved 2026-08-25):** derive a unique domain-separated
      `recoveryId` for each tranche binding action, chain, active recovery-vault/code/proxy identity, incident and exact
      quarantine provenance, Stock Token version, exact input units, adapter/code, acquisition-vault destination,
      independent-oracle observation, `minEthOut`, slippage, route, Safe generation/nonce, issue time, and deadline.
      Only Safe may create/activate/cancel/replace it. Expire at the earlier of one hour after approval and oracle
      validity; every change or refresh needs a new one-use ID. At execution recheck all pinned identities and apply the
      stricter authorized/current-fresh-oracle floor. Rehearse cross-chain/vault/version/incident/record/adapter/oracle/
      destination replay, proxy implementation drift, one-second boundaries, future issue time, cancellation, renewal,
      signature malleability where signatures exist, ERC-1271 Safe validation, nonce gaps, and same-block races.
      **MONOTONIC PARTIAL RECOVERY / NO STOCK SWEEP / SEPARATE GAS (founder-approved 2026-08-25):** allow multiple exact
      partial tranches only through separate active `recoveryId` values; monotonically reduce `remainingUnits`, never
      exceed it, and resolve only at zero. Give neither Safe nor operator an arbitrary Stock Token sweep. Prefer direct
      transfer; if approval is unavoidable, approve exact units immediately before use and consume/reset to zero
      atomically. Let anyone execute only the exact authorized ID with no payload/discretion/reward/refund/output and no
      caller-selected amount/route/recipient. Caller or a separately accounted operations wallet pays gas; never net it
      from recovery credit, acquisition backing, allocations, or player value. Rehearse zero/one/final/excess units,
      interleaved tranches, approvals that return false/no value/require zero-first, leftover allowance, executor revert,
      forced ETH, and attempts by every authority to sweep or redirect stock.
      **BLACKHAT- AND GRIEF-RESISTANT RECOVERY EXECUTION (founder-approved 2026-08-25):** only Safe can create/enqueue an
      authorization. Make execution a constant-time exact-ID lookup with positive-unit, active/unexpired/uncancelled/
      unconsumed checks, same-call vault/token/adapter/oracle code-identity checks, exact pre/post stock and ETH deltas,
      checked arithmetic, `nonReentrant`, and checks-effects-interactions that consume/decrement before calls with atomic
      rollback. Permit no attacker-sized array/loop/scan, dynamic route decode, caller callback/payment, arbitrary call,
      or state/event/alert/storage effect from a malformed, reverted, duplicate, expired, cancelled, or losing-race
      attempt. The caller alone pays failed-call gas; same-ID front-running can only execute the identical approved
      action. Enforce fresh-oracle `minEthOut`, slippage, short expiry, and fixed route at execution and support
      MEV-protected submission without relying on it. Require separately pinned adapters and adversarial balance-delta
      tests for rebasing, fee-on-transfer, callback-capable, nonstandard-return, or revert-griefing tokens; otherwise keep
      the exact version quarantined and preserve unrelated-version liveness. Let Safe/current `mainOperator` pause
      recovery immediately and only Safe resume; pause cannot redirect, consume, extend, or credit. Rehearse reentrancy
      from token/adapter/oracle/acquisition vault, recursive and concurrent execute, gas exhaustion, returndata bombs,
      revert bombs, sandwich/back-run, mempool duplication, code/proxy mutation, pause/front-run order, and one bad token
      beside a healthy recovery.
      **PUBLIC FINALIZED RECOVERY HISTORY / API SPAM WALL (founder-approved 2026-08-25):** publish structured canonical
      IDs, versions, sequences/components, actor/authority, transaction hashes, units/ETH, blocker transitions, code
      identities, and finality while storing sensitive/bulky/restricted evidence off-chain by immutable content hash.
      Separate provisional and finalized streams; default accounting/UI/export to finalized and permit reorg replacement
      only in provisional state. Retain canonical history permanently, bound the recent UI window, and provide complete
      checksum-addressed cursor exports. Keep anonymous recovery/incident APIs read-only with strict cursor validation,
      fixed page/body limits, indexed lookup, per-origin/token quotas, caching, and precomputed content-addressed exports.
      Invalid cursors, duplicate/rejected execution traffic, and transport abuse must cause no unbounded scan, canonical
      write, alert, storage amplification, or export regeneration; sample retention-bounded infrastructure metrics
      separately. Load-test invalid/old/random cursors, maximum pages/bodies, parallel scrapers, export stampedes, cache
      eviction, reorg churn, watcher restart, and sustained rejected execution spam before enabling the route.
      **CRITICAL RECONCILIATION INCIDENT UI (founder-approved 2026-08-25):** emit an immediate critical alert for
      any shortfall or operator debit of reconciliation backing. Keep the RWA operator UI red while the canonical
      incident exists and show liabilities, backing, shortfall, age, affected intent/attempt IDs, last quarantine
      outflow, deficit, and purchase-pause state. Create immutable `incidentId` on each zero-to-positive transition;
      append alerts/acknowledgments/outflows/repairs/reconciliation, close only after finalized/synchronized zero, and
      give recurrence a new ID. Permit signed public acknowledgment by Safe or current operator, binding exact ID and
      operator generation when applicable; it silences repeat notifications only and cannot clear/downgrade/conceal/
      resolve/unpause/mutate. Rehearse restart, alert retry/deduplication, Safe/operator/former authority, recurrence,
      reorg, partial repair, and zero-resolution rendering.
      **TEN-MINUTE STALE INCIDENT MIRROR FAILS RED (founder-approved 2026-08-25):** if the accounting mirror is over
      ten minutes stale or cannot prove finalized `accountingSequence` continuity, show red
      `incident_state_unknown_stale`, never green. Disable new purchase-risk controls but retain recovery funding,
      reconciliation, cancellation, expiry, and otherwise-authorized operator outflow controls. Do not invent an
      on-chain incident or clear a real one. Rehearse exact age boundary, gaps/duplicates, watcher outage/restart,
      stale-to-fresh transition, reorg, direct-chain truth, and attempted green rendering.
      **EXACT INCIDENT CLOSURE + COMPOSABLE PURCHASE BLOCKERS (founder-approved 2026-08-25):** close only when finalized
      canonical state simultaneously proves aggregate shortfall zero, vault deficit zero, every affected record
      liability/backing invariant, continuous `accountingSequence`, and synchronized mirror state; acknowledgments do
      not count. Track manual Safe/operator pause, deficit, stale mirror, token quarantine, oracle failure, exposure cap,
      and future blockers independently. Clearing one removes only itself; resume only when the set is empty. Rehearse
      every overlap/order, automatic deficit clearance under manual pause, recurrence, and mirror delay.
      **PERMISSIONLESS INDEX REBUILD + MAX-COMPONENT ATOMICITY (founder-approved 2026-08-25):** when a debit/repair
      priority index disagrees with immutable records, pause purchases and let anyone rebuild in deterministic bounded
      chunks until the resulting root equals the records-derived root. Give Safe/operator no ordering choice and block
      dependent mutations until completion. Require every operator outflow and generic repair to bind positive public
      `maxComponents`; revert the complete action before mutation/transfer unless fully processable within the bound.
      Permit sequential ordered transactions for large actions. Rehearse corrupt/missing/duplicate nodes, every chunk
      boundary, competing rebuilders, stale root, reorg, low/high bound, partial-fund temptation, and all-balance sweep.
      **CANONICAL INCIDENT CURSOR + FULL HISTORY EXPORT (founder-approved 2026-08-25):** expose immutable incident events
      by cursor `(accountingSequence, componentIndex, stableEventId)`. Forbid offset pagination and mutable latest-first
      authority. Default UI to active/most-recent incident while allowing full export of every generation with cursor
      continuity and reorg/finality state. Rehearse concurrent append, page boundary, duplicate/missing cursor, deep
      history, reorg rollback, finalized replay, and export parity.
      **RECOVERY IMPLEMENTATION / INDEPENDENT AUDIT ACTIVATION GATE (founder-approved 2026-08-25):** treat quarantine
      and indefinite hold as complete launch behavior. Recovery is optional, deferred until a real material balance makes
      it worth building, and is not an ordinary RWA-launch blocker. If later activated, keep recovery unavailable and
      every recovery mutation disabled until the exact production vault/adapter/oracle/API code and deployment manifest
      exist. Require contract unit tests, stateful fuzz/invariant tests, malicious token/adapter/oracle/receiver
      and reentrancy tests, forked-route MEV/slippage/reorg tests, API authorization/idempotency/concurrency/body/cursor/
      export/load/DoS tests, and independent third-party review of exact source and bytecode. Fix every critical/high
      finding and publicly disposition every remainder. Pin chain, addresses, compiler/settings, source commit, runtime/
      implementation code hashes, adapter/oracle identities, test reports, and audit artifacts in the manifest. Any
      material contract/proxy/adapter/oracle/auth/accounting/write-route change resets the applicable gate. Deploy no
      placeholder generic executor or recovery write endpoint from design prose alone.
      **CONDITIONAL MINIMAL RECOVERY SECURITY (founder-approved 2026-08-25):** if recovery is ever built, record Safe
      authorization on-chain. Permit proxies—there is no non-upgradeable requirement—but pin and recheck exact proxy and
      implementation identities. Enforce Safe-set hard per-tranche, per-version rolling-24-hour, and global
      rolling-24-hour caps with no operator bypass over Stock Token recovery; preserve the operator's separate ETH
      authority after canonical receipt. Require two fresh independent price sources, use the more conservative output
      floor, and fail closed above 500-bps divergence. Limit v1 to conventional balance-delta ERC-20s; require zero
      attributable post-execution adapter token/ETH residue and allowance, excluding/quarantining forced dust without
      recovery credit. Return unsigned calldata only and never sponsor/relay anonymous gas. Derive canonical history
      only from finalized events of pinned contracts. Throttle/alert failed, duplicate, or malformed spam operationally
      but never let it auto-pause recovery, open a financial incident, or write canonical history. Before activation,
      publish a bounty/disclosure channel, monitor code identity/balances/allowances/oracle divergence/recovery rate/
      sequence gaps independently, and rehearse pause/cancel/rotation. Rehearse every cap boundary, oracle disagreement,
      proxy upgrade, nonstandard token, residue/allowance, forged tx hash, gas-relay request, spam burst, and monitor drill.
      **FIXED PRE-VOTE BUDGET / NO REVENUE FORMULA OR RESERVE FLOOR (founder-approved 2026-08-25):** do not derive the
      ordinary acquisition budget from a percentage of prior-day protocol revenue and do not enforce a mandatory
      acquisition-vault ETH reserve or policy minimum purchase size. Before opening the ballot, publish and atomically
      snapshot one exact maximum ETH budget from backed available acquisition ETH under existing caps. Make it immutable
      after voting starts; do not let the winner, later deposits, operator edits, or price movement resize it. Preserve
      actual-balance, venue-minimum, cap, quote, slippage, health, and execution walls. Rehearse zero/tiny/full available
      balances, deposits before/after the snapshot, concurrent ballot opening, attempted mid-vote edits, and spend never
      exceeding actual backed availability.
      **SPOT-ONLY MVP / NO DISCRETIONARY SELLING (founder-approved 2026-08-25):** permit only the Safe-approved
      provider-native spot Stock Token for the voted underlying. Reject LP tokens, lending receipts, yield wrappers,
      synthetic equities, derivatives, and bridged wrappers. Do not sell, rebalance, rotate, or market-time an allocated
      holding; permit only delivery and the existing mandatory corporate-action, provider-retirement, legal, or
      worthless-removal paths. Leverage, borrowing, shorting, options, perpetuals, leveraged tokens, lending,
      rehypothecation, and collateral use are not permanently prohibited, but this decision authorizes none for MVP.
      **OMR-STAKING MULTIPLICATIVE WEIGHT / FULL-EPOCH TWA — COMPLETE RULE, IMPLEMENTATION PENDING (founder direction 2026-08-25, completed 2026-08-26):** change
      no shipped allocation code yet. When implemented, retain active-play qualification for human and agent accounts, NPC/resident exclusion, and
      recurring 30-day Broker activation. Compute
      `finalWeight = activationMult × activityScore × stakeMult`; failing activity remains zero. Use fixed public
      `stakeMult` tiers derived only from finalized time-weighted-average eligible staked principal across the complete
      seven-day epoch. Add no separate 72-hour maturity delay: accepted principal contributes pro rata from entry to
      exit. Bind one verified allocation wallet per account/epoch and defer wallet changes to the next epoch. Exclude
      liquid OMR, pending/unclaimed rewards, claimed-but-not-restaked rewards, and Broker-activation spend. The founder
      rejected a 2× maximum and approved a 1.50× cap with exact 300/1,000/5,000/20,000 OMR thresholds. The source
      direction is now a unified actual on-chain OMR gameplay stake; `account_persistent.staked` cannot remain a separate
      balance. Until the unified vault and finalized history are complete, retain the
      shipped `activationMult × activityScore` formula. Never read only the current balance at allocation time, because
      immediate stake/unstake around the snapshot is flash-weightable. Rehearse zero-play/large-stake, duplicate wallet
      claims, wallet changes, source rotation/code drift, tier edges, stake/unstake races, short-lived pro-rata stake,
      finality/reorgs, and repeat snapshot idempotency.
      **UNIFIED ON-CHAIN OMR GAMEPLAY STAKE (founder direction 2026-08-25):** replace every independent database-only
      stake mutation with actual OMR custody and canonical on-chain transitions. Scope includes stake/unstake, Made Ladder
      and effective/locked stake, commitment upgrades, Den access, career/coach/UI reads, RWA weighting, committed-rate
      kill loot, unbonding, death/inheritance continuity, ops/token-health reporting, and conservation. Keep only a
      finalized database mirror plus explicit pending-chain-settlement journal; a database write never fabricates or
      settles stake. The existing `OMRStaking` contract is insufficient: it guarantees immediately withdrawable principal
      under a user-only unstake path and lacks gameplay-loss authority, commitment locks, six-hour unbonding, account/
      wallet binding, and per-user stake history. Do not add a generic owner/operator sweep.
      **AGENT-WALLET PARITY (founder direction 2026-08-26):** `agent_flag` must never deny gameplay-vault or RWA
      economics. A verified agent-controlled EOA or ERC-1271 wallet may deposit, stake, commit, partially unbond,
      withdraw, retain the permanent account position through death/inheritance, receive idle loot, lose eligible
      principal through canonical gameplay settlement, build finalized Broker stake TWA, and receive Stock Token
      allocation/delivery on the exact same rules as a human-controlled wallet. Keep the ordinary activation, activity,
      wallet-uniqueness, finality, consent, exposure, solvency, and launch gates. Agent exclusions remain valid only for
      explicitly human anti-Sybil faucets/status, never vault authorization, settlement, checkpoints, Broker weights,
      allocation, or delivery.
      **PURPOSE-BUILT OMRGAMEPLAYVAULT BASELINE (founder-approved 2026-08-25):** deploy a new `OMRGameplayVault`, not a
      retrofit of `OMRStaking`. Retire vault-level personal APY/reward claims; family yield and separately backed utility
      rewards remain outside principal. Require game-earned database OMR to complete an exact reserve-backed on-chain
      extraction/claim before staking; an atomic claim-and-stake path must prove one receipt and no double credit.
      Enforce and event `deposit_pending -> active -> committed | unbonding -> withdrawable -> withdrawn`, published
      commitment locks, canonical finality, and six-hour unbonding. Pending deposits do not qualify.
      Use one Safe-pausable/rotatable gameplay-settlement signer with typed outcome authority only and no sweep, rescue,
      approval, arbitrary-recipient, upgrade, or custody power. Reassign authorized loot inside the vault from victim
      active/committed/unbonding principal to the killer's on-chain idle gameplay balance. Each one-use EIP-712 outcome
      must bind action, chain, vault, signer generation, immutable event ID, both game accounts and verified wallets,
      source bucket, exact amount, maximum rate, victim settlement nonce, issue time, and deadline. Reject every wrong,
      stale, expired, replayed, or consumed authorization without mutation.
      Settle chain-first: prepare but do not irreversibly commit the game result or consume ammunition, energy, cooldown,
      or another one-use resource until canonical vault finality and continuous finalized mirror state. Chain, vault,
      signer-authorization service, or mirror unavailability/staleness fails the action before resource consumption. Crash recovery
      consumes each finalized event exactly once. Migrate legacy `staked`/`unbonding` only against actual OMR reserved and
      deposited into the vault; never mint merely to honor rows, never raid another reserve, and publish legacy claims,
      backing, imports, aggregate conservation, and the explicit unfunded liability. Unfunded rows do not qualify as
      principal. Rehearse direct-call bypass, compromised signer, duplicate kill, stake/unstake/kill races, lock expiry, partial
      slash, insufficient principal, wallet/account change, death during pending settlement, reorg, outage, and aggregate
      vault OMR = idle gameplay balances + active + committed + unbonding + withdrawable + other explicitly backed
      liabilities, with pending debits represented as reservations rather than double-counted principal.
      **GAMEPLAY-VAULT IDENTITY / CONSENT / EXACTLY-ONCE SETTLEMENT (founder-approved 2026-08-25):** accept position
      increases only from the account's current verified controller wallet or exact reserve-backed claim-and-stake rail.
      A caller cannot name another beneficiary; direct bypass transfers become separately accounted unattributed OMR and
      create no position, qualification, consent, or checkpoint. Key the position by permanent non-transferable game
      account ID plus one controller wallet, preserving principal/history through death, respawn, and inheritance.
      Controller recovery rotates authority without moving principal or resetting consent, nonce, or checkpoints; decide
      its authority/delay before launch.
      Bind first deposit/commitment to an immutable public risk-ruleset hash/version. Contract-compute typed losses under
      hard ceilings of 20% active/committed and 50% idle/unbonding. Signer never chooses an effective rate above the bound.
      Safe may lower/pause immediately; increases or new loss classes require a new version and fresh consent.
      Enforce `prepared -> submitted -> finalized -> game_committed`, reserving immutable event ID and victim settlement
      nonce without consuming the gameplay resource. Move `min(calculatedLoss, eligibleBalance)` at execution, emit actual
      loot, allow the underlying outcome to resolve with partial/zero loot, and never overdraw. Canonical vault event is
      the sole recovery authority: commit it exactly once after a crash and never issue a replacement debit.
      Checkpoint every deposit, commitment, unbond, withdrawal, loss, loot reassignment, and controller change on-chain.
      Made Ladder uses latest finalized history and RWA derives its complete-epoch TWA from those checkpoints, never a
      mutable database balance. Implement separate deposit/commitment/settlement/withdrawal pauses. Default incident
      posture stops new risk and debits but leaves exits live; withdrawal pause requires a separately declared custody-
      integrity incident.
      **UPGRADEABLE GAMEPLAY VAULT (founder direction 2026-08-25):** the founder rejected a non-upgradeable, migration-
      only vault. Implement an upgradeable `OMRGameplayVault` and disclose proxy implementation plus upgrade authority as
      custody/consent trust boundaries capable of changing rates, transitions, signer checks, pauses, and withdrawals.
      Do not claim the gameplay rules are technically immutable across upgrades.
      **TRANSPARENT PROXY + DELAYED UPGRADE GOVERNOR (founder-approved 2026-08-25):** use OpenZeppelin Transparent Proxy
      plus dedicated `ProxyAdmin`, not UUPS/Beacon/Diamond/custom proxy. A non-upgradeable
      `GameplayVaultUpgradeGovernor` owns the admin; only the Safe proposes, cancels, and executes. Give no upgrade or
      governor-control authority to `mainOperator`, gameplay signer, relayer, server/API key, individual EOA, or
      implementation. Apply the same state machine to implementation and governor-control changes:
      `upgrade_proposed -> waiting_48h -> executable -> executed_validated | cancelled | expired`. Enforce at least 48
      public hours. Emergency response is immediate scoped pause only; there is no hot-upgrade or delay bypass.
      Bind each proposal to exact chain, proxy, current implementation/code hash, new implementation/code hash, semantic
      version, initialization-calldata hash, storage-layout commitment, reason, audit/evidence hash, earliest execution,
      and expiry. Mismatch reverts; edits require a fresh proposal/delay. Disable each implementation initializer,
      initialize the proxy once, and allow a versioned reinitializer only once inside the exact committed
      `upgradeAndCall`. Atomically validate pinned OMR token, vault balance, total accounted liabilities, ruleset,
      settlement-nonce continuity, pause state, controller bindings, and implementation version; any continuity failure
      reverts the upgrade. Because a malicious implementation can lie, also require independent audit, storage-layout
      comparison, deployed-bytecode reproduction, and fork rehearsal.
      Treat rollback as another complete delayed proposal; no instant switch-back or preauthorized old code. A material
      increase in loss, withdrawal restriction, signer scope, or other economic risk creates a new ruleset, requires fresh
      consent, and preserves a prior-terms exit for nonconsenting positions; behavior-preserving security fixes may apply
      globally through the ordinary process. Public surfaces show proxy, implementation/code hash/version, governor,
      Safe, delay, pending exact package/evidence/timing, validation, and complete history. Any unexplained code/admin/
      governor/timelock mismatch stays red and disables first-party deposits/commitments without silently changing the
      independent withdrawal-pause state.
      **CONTROLLER ROTATION + LOST-WALLET RECOVERY (founder-approved 2026-08-26):** ordinary rotation requires paired
      current-controller release and proposed-controller acceptance, each EIP-712/EOA or ERC-1271 authorization binding
      account, chain, vault, current generation, exact rotation nonce, both controllers, issue time, and deadline. First
      valid execution wins and increments generation; login/server/relayer/support/operator authority substitutes for
      neither signature. Lost-wallet fallback requires authenticated permanent-account control and new-wallet proof,
      opens a public seven-day request, and notifies every available account channel. Current controller may contest;
      only Safe resolves a contested request against public evidence and cannot shorten seven days. Individual operator
      cannot choose/approve/accelerate/hide it. Rehearse `recovery_pending -> finalized | cancelled | contested`, then
      contested `safe_approved -> finalized | safe_rejected`, plus terminal expiry and every exact-boundary race.
      Pending/contested recovery freezes withdrawal, new deposit, new commitment, and controller changes, but existing
      commitments, unbond clocks, gameplay exposure, and valid gameplay-loss settlement continue. Recovery is no shield.
      Finalization increments monotonic controller generation, invalidates every unfinalized old-generation authorization,
      never resets a nonce, safely abandons provisional old-generation gameplay without resource consumption, and never
      rewrites finalized events/checkpoints. Support EOA and ERC-1271 across verify/rotate/recover/deposit/withdraw; failed,
      reverting, malformed, non-magic, or signer-mismatched ERC-1271 fails closed without ECDSA fallback.
      **CONTROLLER-ONLY PULL WITHDRAWALS + PARTIAL TRANCHES (founder-approved 2026-08-26):** pay only the current verified
      controller; expose no arbitrary recipient or support/signer/operator/relayer override. Withdraw directly on-chain
      without server signature/API/signer/relayer/operator availability. Apply checks-effects-interactions,
      `ReentrancyGuard`, `SafeERC20`, and atomic failure. Stake, unbond, and withdraw take explicit positive amounts;
      reject zero/excess/precision-invalid inputs without mutation. Each partial unstake appends an independent amount,
      start, six-hour unlock, accepted-ruleset, and exposure-history tranche. A later request cannot reset, extend, merge,
      shorten, or rewrite an earlier tranche. Apply earliest-unlock/lowest-ID loss order, the 16-live-tranche bound, and
      0.01 OMR partial minimum approved below; rehearse partial/whole/exact-boundary/concurrent loss/withdraw and
      non-receiving ERC-1271.
      **EXACT OMR RECEIPT + VAULT SOLVENCY (founder-approved 2026-08-26):** pin one exact OMR address and use `SafeERC20`.
      Derive each receipt from balance-after minus balance-before; never credit the request by assumption. Nonpositive or
      mismatched receipt, fee/rebase/elastic balance, hook, false/missing result, or unsupported behavior creates no
      position and reverts or explicitly quarantines when atomic revert is impossible. Direct bypass transfer is
      unattributed OMR and creates no liability/account/qualification/checkpoint/consent/repair. Continuously enforce
      `actual OMR balance >= total accounted liabilities`; surplus is unattributed, deficit is persistent red custody-
      integrity state that stops new deposits/commitments/gameplay debits, and the withdrawal response remains a separate
      explicit decision. Rehearse donation, fee token, rebase up/down, false/no return, hook reentrancy, exact receipt,
      rounding, surplus, deficit, and attempts by database/operator state to hide drift.
      **TRANCHE BOUNDS + SURPLUS RECOVERY + DEFICIT FINALITY (founder-approved 2026-08-26):** for gameplay loss against
      eligible unbonding principal, consume earliest `unlockAt` first, tie by lowest immutable tranche ID, and exhaust a
      tranche before the next. Signer/caller chooses no order. Enforce `MAX_LIVE_UNBONDING_TRANCHES = 16`; matured
      tranches no longer count, and reject an over-cap unstake before mutation. Enforce `MIN_PARTIAL_UNBOND = 0.01 OMR`,
      except exact full remaining eligible stake may always unbond. Aggregate matured amounts into one withdrawable
      balance while immutable events/checkpoints retain each tranche's amount, time, ruleset, exposure, consumption, and
      withdrawal provenance.
      Keep solvent unattributed OMR nonqualifying and nonspendable. The Safe alone may propose/cancel/execute an exact
      verified-surplus recovery to one immutable OMR recovery-treasury address through
      `surplus_recovery_proposed -> waiting_48h -> executable -> executed | cancelled | expired`. Bind exact amount,
      fixed destination, reason/evidence commitment, earliest execution, and expiry; changes require a fresh delay. Never
      credit an account, settle gameplay, select an arbitrary recipient, or grant authority to `mainOperator`, signer,
      relayer, server, or EOA. Add permissionless `fundDeficit(amount)` using actual balance delta: repair deficit first,
      grant no player balance/qualification/yield/repayment/game credit, and classify any excess as unattributed.
      Any positive custody deficit automatically applies the deficit-specific withdrawal pause and stops deposits, new
      commitments, and gameplay debits. Preserve every liability at full face amount; prohibit haircut, pro rata,
      first-come payout, operator write-off, and database adjustment. Clear only deficit-specific pauses automatically
      after canonical zero reaches configured finality and continuous mirror sync; no acknowledgment or cooldown, and
      unrelated pauses remain. Check solvency pre/post every value-changing entrypoint. Expose permissionless
      `syncSolvency()` and `syncUnattributed()`, create a new immutable incident ID on each zero-to-positive transition,
      and monitor actual balance, full liabilities, incident generation, finality, mirror freshness, and sequence
      continuity. Rehearse same-block tranche races, cap/minimum boundaries, full-exit exception, partial tranche loss,
      matured aggregation, premature/forked surplus execution, deficit donation/excess, bank-run ordering, finality/reorg,
      recurrence, and independent-pause composition.
      **EXECUTION-TIME LOSS + SINGLE-OUTCOME SETTLEMENT (founder-approved 2026-08-26):** calculate loss in
      the vault from every eligible bucket's execution-time pre-settlement balance, with signed amount/rate fields acting
      only as ceilings. Round down to OMR atomic units; never round a positive fraction up to one. A legitimate zero-loot
      outcome still finalizes. If one outcome touches multiple buckets, calculate them independently and atomically in one
      transaction, apply the approved unbonding-tranche order, credit the killer once with combined actual loot, and
      revert all state on any bucket, signature, nonce, controller, pause, or solvency failure.
      Credit finalized loot to the killer's idle on-chain gameplay balance under idle-rate exposure. Do not auto-commit,
      auto-stake, or include it in Broker eligible-stake TWA until a separate killer-authorized action qualifies it.
      Reject future `issuedAt`; cap authorization lifetime at five minutes from issue to canonical inclusion, while
      allowing a timely included transaction to reach configured finality after its deadline. Keep `prepared` as an
      expiring off-chain journal entry with no vault reservation, nonce consumption, withdrawal pause, victim lock, or
      custody effect. Prepared races are allowed; only canonical submission mutates and stale losers consume no gameplay
      resource.
      Bind one globally unique immutable gameplay event ID and the victim's exact next monotonic settlement nonce. Consume
      the nonce on every successful canonical settlement, including zero actual loot; consume nothing for preparation,
      rejection, expiry, or revert. MVP accepts one outcome and emits one complete record per transaction; do not batch
      without a separately justified, specified, reviewed, and audited design with deterministic failure semantics.
      **SIGNER OVERLAP + PERMISSIONLESS SUBMISSION (founder-approved 2026-08-26):** on ordinary rotation, activate the new
      signer generation immediately and accept an old-generation authorization only when `issuedAt` precedes canonical
      rotation and current time is no later than both its original deadline and rotation plus five minutes. Emergency Safe
      revocation has zero overlap and invalidates every old-generation authorization not canonically included; finalized
      settlements remain immutable. Let any address submit an exact valid authorization. Submission grants no signer,
      custody, recipient, amount/rate, controller, pause, upgrade, or ruleset authority. Do not build an approved-relayer
      registry, three-relayer cap, main-operator relayer management, or Safe relayer-set lifecycle. Reject invalid, stale,
      expired, replayed, malformed, and losing-race calls before economic mutation; the caller pays that gas. Spam alone
      never pauses settlement, creates an incident, or writes canonical history.
      **NON-UPGRADEABLE COMMUNITY SETTLEMENTGASPOOL (founder-approved 2026-08-26):** deploy a dedicated contract accepting
      only the supported chain's native gas asset. Give it no custody of, approval over, or call authority into OMR
      gameplay principal, player liabilities, RWA acquisition ETH, Stock Tokens, or unrelated treasury funds. Treat every
      sponsorship deposit as a final community contribution with no sponsor balance, refund, yield, priority, allocation
      weight, governance power, repayment claim, or other economic credit. Give the Safe no treasury sweep. Permit only a
      48-hour exact successor migration that moves only unreserved ETH and binds chain/current pool/successor/code hash/
      amount/reason/timing;
      leave the old pool live with exact backing for all outstanding executor credits.
      **CANONICAL-SUCCESS GAS CREDIT / PULL WITHDRAWAL (founder-approved 2026-08-26):** credit only the `msg.sender` whose
      valid call creates the canonical event-ID/victim-nonce settlement, including a legitimate zero-loot outcome. Credit
      invalid, expired, malformed, wrong-chain/vault, reverted, replayed, stale, and losing-race calls zero. Complete vault
      economic effects before the fixed pool records credit; never push ETH during settlement or expose an arbitrary
      credit recipient. Let the submitter pull accumulated credit only to itself using checks-effects-interactions and
      `ReentrancyGuard`. Account `totalOutstandingCredits` as an exact liability; require actual native balance at least
      that liability and exclude it from later reimbursement availability. Pool pause, depletion, insufficiency, or an
      isolated credit-hook failure cannot revert or invalidate an otherwise canonical gameplay settlement.
      **CAPPED CONTRACT-DERIVED REIMBURSEMENT (founder-approved 2026-08-26):** accept no caller-supplied gas cost. Derive
      `reimbursableGasPrice = min(tx.gasprice, block.basefee + PRIORITY_FEE_CAP)` and `verifiedGasCost =
      measuredSettlementGas × reimbursableGasPrice + approvedChainNativeDataFee`. Measure only the audited settlement span
      plus fixed audited overhead; permit a data-fee component only from the supported chain's canonical reviewed source.
      Credit `min(verifiedGasCost, PER_SETTLEMENT_WEI_CAP, actualBalance - totalOutstandingCredits)`. Exclude arbitrary
      caller computation, excess calldata, unrelated external calls, deliberate gas burning, failed work, and fee above
      caps. Empty/insufficient pool gives partial or zero credit and never closes permissionless settlement. If nobody
      self-funds, leave the game uncommitted and consume no irreversible resource. Publish unreserved ETH, credits,
      estimate/status, contributions, and reimbursements.
      **GAS-POOL GOVERNANCE + PERMISSIONLESS ABUSE BOUNDARY (founder-approved 2026-08-26):** Safe may immediately pause new
      credits or reduce caps; existing credits remain withdrawable. Cap increases, a new chain-native fee source, or pool
      migration require an exact 48-hour public proposal. Unpause requires a public reason and solvency. Safe cannot select
      submitters, manually reimburse a chosen call, redirect credits, or replenish from OMR/RWA custody. Bound direct
      settlement with the exact EIP-712 fields, five-minute inclusion expiry, signer generation, event/nonce uniqueness,
      vault-computed loss, cheap pre-mutation rejection, 16-tranche maximum, no caller-selected external call, and one
      canonical settlement per event/nonce. Invalid spam remains caller-funded and unreimbursed. HTTP auth, idempotency,
      rate limits, and abuse controls may protect hosted surfaces but never restrict direct on-chain submission. Alerts
      from failed-call volume cannot reserve authority, lock a victim, consume resources, auto-pause, or create an incident.
      **FINALITY + REORG + EVENT EVIDENCE (founder-approved 2026-08-26):** pin one public
      `SETTLEMENT_FINALITY_BLOCKS` per supported chain; server/signer/submitter/operator cannot select less per action. Use
      one Safe-only `finality_change_proposed -> waiting_48h -> executable -> executed | cancelled | expired` process for
      every increase and decrease. Bind chain/current+proposed counts/reason/evidence/proposal time/earliest execution/
      expiry/effective block. Apply prospectively only to transactions first included after the boundary; pending and
      finalized settlements retain their inclusion-time rule. Emergency response pauses new value-taking settlement and
      never hot-edits finality. If a
      transaction disappears before finality, return the same immutable event ID/victim nonce to retryable state; resubmit
      the original while valid, or issue a fresh authorization for the same event/nonce only after proving canonical
      absence. Emit event/ruleset, signer/controller generations, victim nonce, submitter, issue/deadline/inclusion times,
      per-bucket pre-balances, amount/rate ceilings, rounded debits, tranche consumption, combined killer credit, and
      post-settlement solvency totals.
      **BROKER STAKE MULTIPLIER COMPLETE RULE (founder-approved 2026-08-26):** cap `stakeMult` at 1.50×. Full-epoch
      finalized seven-day TWA tiers are `<300 OMR = 1.00×`, `300–999.999… = 1.10×`, `1,000–4,999.999… = 1.20×`,
      `5,000–19,999.999… = 1.35×`, and `20,000+ = 1.50×`. Count only finalized active and committed principal; exclude
      pending deposit, idle loot, unbonding, withdrawable, withdrawn, unattributed, quarantined, and unfunded legacy value.
      One verified wallet qualifies one permanent account per epoch; conflicting claims all receive zero stake multiplier
      until resolved. Finalized transitions affect TWA prospectively at canonical time with no backfill/snapshot shortcut.
      Only Safe may change tiers/thresholds, with seven public days' notice and effect no earlier than the first later full
      epoch. Freeze per epoch the schedule, wallet bindings, eligible buckets, activity formula, activation requirement,
      and ruleset. Pause or cancel a critically defective epoch; never rewrite known weights. Rehearse tier edges, wallet
      collisions, checkpoint order/reorg, loss/unbond/loot eligibility, schedule-boundary races, and cancelled epochs.
      Rehearse changed execution-time balances,
      fractional and zero loss, every multi-bucket failure point, prepared-action spam/races, exact deadline inclusion,
      same-victim nonce races, zero-loot reimbursement/replay, signer rotation with pending transactions, permissionless
      submitter races, invalid-call reimbursement farming, gas-price and calldata inflation, reentrant credit withdrawal,
      credit liabilities versus balance, empty/partial pool, pause with outstanding credits, delayed cap/fee/migration
      changes, finality-threshold boundaries, gas exhaustion, and attempted batch encoding.
      **UNITS-FIRST PORTFOLIO / EVIDENCE-BASED COMPLEXITY (founder-approved 2026-08-25):** lead player and operator
      portfolio views with actual Stock Token units, acquisition reference/cost, allocation epoch, delivery state, and
      custody destination. Show estimated market value only as secondary, timestamped, source-labeled, and stale-aware;
      never frame it as guaranteed cash, yield, or redeemability. Add an RWA subsystem only for demonstrated recurring
      material value, measured user demand, or an actual failure mode, with written Safe scope, authority, invariants,
      tests, and operating owner.
      **ACQUISITION DEFICIT DOES NOT BLOCK HEALTHY DELIVERY (founder-approved 2026-08-25):** pause new intent creation
      and execution for reconciliation shortfall/acquisition deficit, but continue already-acquired and allocated Stock
      Token delivery when exact StockVault custody and every independent delivery wall are healthy. Keep asset
      quarantine, custody mismatch, delivery hold, gas budget/fee ceiling, stale health, and other delivery blockers
      effective. Rehearse each wall alone and combined, active staged/broadcast batches, and no-new-allocation proof.
      **SAFE + MAIN-OPERATOR EXPLICIT INTENT CANCELLATION (founder-approved 2026-08-25):** let Safe or the current
      `mainOperator` immediately call `cancelIntent(intentId, reasonCode, detailsHash)` on an active intent without
      moving ETH. Require the closed reason taxonomy and nonzero details hash; mark terminal `intent_cancelled`,
      release the full remaining reservation to available ETH except unresolved `reconciliation_pending` value,
      consume `accountingSequence`, and emit actor/authority,
      reason/details, release, intent/attempt state, and full pre/post accounting. Grant no revival/substitute/
      extension/replay/split/re-reservation/allocation/catch-up and rewrite no ballot/asset/prior attempt/deposit.
      Canonical inclusion order decides cancel versus execute/expire/refund/outflow; first valid wins, later conflict
      fails without mutation. Rehearse Safe/operator/zero/former authority, every reason field, partial reservation,
      every race order, repeated cancel, smart-wallet direct call, no-transfer invariant, and historical rendering.
      **SEPARATE EIP-712 INTENT-CANCEL NONCE (founder-approved 2026-08-25):** let current `mainOperator` cancel
      directly or through EIP-712/ERC-1271 relay authorization binding action, chain, vault, operator generation,
      exact intent, reason, nonzero details hash, exact `nextIntentCancelNonce`, issue time, and deadline. Cap lifetime
      at one hour, reject future issue time, and make direct/relayed operator cancellation consume the same monotonic
      cancellation nonce independently of `nextOutflowNonce`; Safe cancellation consumes neither operator nonce.
      Invalidate older signatures on replacement/renunciation/zero-disable. Rehearse direct/relay races, replay,
      wrong action/chain/vault/generation/intent/reason/details/nonce/time, ERC-1271 failure, and Safe concurrency.
      **SAFE/OPERATOR PAUSE + SAFE-ONLY RESUME (founder-approved 2026-08-25):** allow Safe or current main operator
      to pause new intent creation and execution immediately with closed public reason and nonzero details hash, but
      allow only Safe to unpause. Keep canonical deposits, deficit repair, matched refunds, reconciliation,
      permissionless expiry, explicit cancellation, and otherwise-authorized operator outflows available. Let all
      existing deadlines run without tolling/extension/revival/substitute/catch-up and leave reservations under normal
      expiry/cancellation. Emit actor/authority/generation/reason/details/inclusion time for every pause transition.
      Rehearse each authority, former/zero operator, repeated pause, unauthorized resume, every still-live recovery
      path, pre/exact/post-deadline behavior while paused, and canonical ordering with execution/create/unpause.
      **MATCHED ACTIVE / LATE TERMINAL / UNMATCHED REFUNDS (founder-approved 2026-08-25):** match refund only by
      exact intent, approved attempt, adapter/sender, and canonical transaction provenance; cap cumulative matched
      refund at actual debited ETH. For an active intent restore its remaining reserved capacity only up to the
      original bound, allowing only a still-valid retry before the unchanged deadline. After cancel/expiry/
      success/other terminal state repair the exact attempt's shortfall first, then classify only the remainder as
      available without reopening intent/ballot/
      allocation/window/substitute/catch-up. Classify unknown intent, unprovable sender/provenance, and excess
      above debit as `unattributed`. Emit sender/amount/known intent+attempt/provenance/cumulative debit+refund/
      classification/pre-post buckets. Rehearse active full/partial refund and retry, every terminal state, late
      arrival across reorg/restart, spoofed adapter/sender/intent, excess and cumulative over-refund, duplicate
      event, Safe reclassification, and operator withdrawal.
      **UNIQUE SAFE-APPROVED CANONICAL ACQUISITION DEPOSITS (founder-approved 2026-08-25):** allow only currently
      Safe-approved ingress contracts to credit canonical acquisition ETH. Derive
      `depositId = keccak256(abi.encode(chainId, sourceContract, externalPaymentReferenceHash))`; require positive
      exact `msg.value`, caller/source equality, nonzero well-formed reference, and unused ID. Duplicate ID must
      revert, never replay/double-credit. Credit available and emit ID/chain/source/reference/amount/approval
      version/pre-post buckets. Make Safe source approve/revoke public and forward-only. Classify direct,
      unapproved, malformed/mismatched, and forced ETH as unattributed with no later sync identity upgrade.
      Rehearse each field mismatch, duplicate/reorg, approval/revocation ordering, source upgrade, zero/excess
      value, plain receive, forced balance, and event/accounting parity.
      **EXACT INGRESS ADDRESS/CODE/IMPLEMENTATION IDENTITY (founder-approved 2026-08-25):** bind every Safe ingress
      approval version to exact chain, source address, source runtime code hash, and, for a proxy, resolved
      implementation address plus implementation runtime code hash. Revalidate all fields before consuming a deposit
      ID or bucket credit. Require a fresh public Safe approval after any source/proxy/implementation change; revert
      mismatched canonical calls, while plain/forced value that reaches the vault remains unattributed. Keep approval
      and revocation forward-only: prior canonical deposits stay canonical and prior deposit IDs remain permanently
      consumed. Rehearse direct contract, proxy, implementation upgrade, proxy-admin upgrade race, metamorphic/code-
      hash drift, revocation/reapproval, historical rendering, and attempted ID reuse across approval versions.
      **ONE ACTIVE CANONICAL INGRESS VERSION (founder-approved 2026-08-25):** keep at most one exact active ingress
      approval version per vault, or zero/disabled. Safe rotation must atomically deactivate old and activate new,
      with no overlap, grace period, or dual-source window. Validate the named version at transaction inclusion;
      broadcast/mempool time never grandfathers an old-source call. Revert stale-version canonical calls before ETH
      acceptance, deposit-ID consumption, or accounting change; book any plain/forced arrival as unattributed.
      Resolve same-block rotation/deposit ordering canonically and preserve all prior deposits, IDs, and approval
      history. Rehearse zero state, atomic rotation rollback, old/new calls on both sides of rotation, same-block
      transaction ordering, pending mempool calls, reorg, plain/forced arrival, and immutable history.
      **IMMUTABLE DEFICIT-REPAIR DEPOSIT SPLIT (founder-approved 2026-08-25):** during a positive deficit, consume the
      canonical deposit ID once and compute `deficitRepairAmount = min(msg.value, deficitBefore)` plus
      `availableCreditAmount = msg.value - deficitRepairAmount`. Apply repair without bucket credit and credit only
      the remainder to available ETH. Assign repair through the unified `firstObservedAt`/`shortfallCreatedAt`, numeric
      component-type, record-ID queue; exact refunds remain bound to their own attempts. If an assigned component is a
      finalized proven-unspent shortfall, atomically retire repaired principal and credit that exact amount to available
      under its immutable disposition. Emit total, both portions, deficit before/after, approval version, and pre/post
      buckets in the immutable deposit record. A repair-only deposit remains canonical but creates zero spendable
      value. Rehearse below/equal/above-deficit deposits, concurrent inflow/outflow, duplicate retry, reorg, rounding,
      event/ledger parity, and the invariant that no surface reports full `msg.value` as available.
      **IMMEDIATE ACCOUNTING-ONLY SAFE RECLASSIFICATION (founder-approved 2026-08-25):** Safe may immediately
      reclassify positive `amount <= unattributed` with public reason/details. Permit only
      `unattributed -> available`: transfer no ETH, create no reservation, target no ballot/asset/intent, revive
      nothing, bypass no cap/oracle/adapter/deadline, and never book purchased value. Keep the classification event
      immutable/non-deletable/non-reversible; later movement occurs only through valid purchase or operator
      outflow. Rehearse zero/over-balance, partial/full, repeated classification, every prohibited side effect,
      concurrent deposit/outflow, and historical rendering.
      **PUBLIC ACCOUNTING DEFICIT / OPERATOR SURVIVAL (founder-approved 2026-08-25):** when
      `accountedBuckets > vault.balance`, publish `accounting_deficit` with amount, first block/time, cause, last
      reconciliation, and pre/post. While positive, block automated buys, new reservations, Safe reclassification,
      and canonical migration; retain expiry/cancellation/refund reconciliation and inflows. Apply every incoming
      wei to actual-balance deficit repair before crediting any bucket; only post-repair canonical remainder becomes
      available and other remainder unattributed. Still permit main operator outflow up to actual remaining balance
      using fixed available/unattributed/ordinary-reserved/reconciliation-pending debit and intent cancellation;
      publish deficit before/after.
      Debiting balance and buckets together must leave deficit explicit. Resume automation/migration only after
      public zero-deficit reconciliation. No role may silently haircut/erase buckets or deficit. Rehearse each
      blocked/allowed path, partial/full repair, post-repair remainder, all-balance outflow, zero balance, reservation
      cancellation, concurrent inflow/outflow, reorg, and recovery.
      **FINALIZED ZERO-DEFICIT AUTOMATIC RESUMPTION (founder-approved 2026-08-25):** clear deficit mode only after a
      canonical-chain reconciliation computes zero, its block reaches configured finality, and the finalized event
      synchronizes into the public mirror. Then resume automation/migration immediately under all ordinary walls,
      with no Safe/operator acknowledgment or added cooldown. Never revive expired/cancelled intents, extend windows,
      replay missed ballots, or create catch-up. Emit reconciliation block/transaction/finality/sync time and pre/post
      deficit, buckets, and balance. A later deficit must pause again immediately; no role may declare zero manually
      or bypass finality. Rehearse pre-finality waiting, finality/sync, reorg, restart, delayed mirror, immediate normal
      execution, expired work staying terminal, and recurrence in the first resumed action.
      **ONE VAULT-WIDE ACCOUNTING SEQUENCE (founder-approved 2026-08-25):** assign exactly the next monotonic
      `accountingSequence` to every successful atomic accounting entrypoint: canonical deposit/repair, unattributed
      sync, Safe reclassification, reservation/intent creation, purchase debit/finalization, refund, expiry/cancel,
      operator outflow, deficit reconciliation, and canonical migration. Give component effects one shared sequence
      plus deterministic `componentIndex`. Emit action/actor/transaction/block position and complete pre/post actual
      balance, available, unattributed, reserved, accounted total, deficit, and affected intent/bucket deltas. Reverts
      and true no-ops consume no sequence. Canonical inclusion order is authoritative; worker/API/database time cannot
      reorder or invent state. Roll mirrors back on reorg and expose finalized order; surface duplicate, gap, or
      pre/post discontinuity as sync failure. Rehearse every mutation, compound outflow cancellation, same-block order,
      reverted/no-op call, restart/backfill, reorg/finality, duplicate event, missing event, and mirror discontinuity.
      **DIRECT OR FULLY BOUND EIP-712 OUTFLOW AUTHORIZATION (founder-approved 2026-08-25):** permit only a direct
      call from the current operator or a relayed typed authorization by that same current operator. Bind action,
      chain ID, verifying vault, operator generation, recipient, amount, reason code, nonzero details hash, exact
      current global nonce, `issuedAt`, and deadline. Never reset nonces across rotation; consume once and reject expired/
      replayed/wrong-chain/wrong-vault/former-
      operator signatures before mutation. A backend key, bearer token, server session, or relayer identity is
      never authority by itself. Rehearse each field substitution, signature replay, rotation resurrection,
      direct caller mismatch, expired deadline, and relayer substitution.
      **ONE-HOUR RELAYED AUTHORIZATION WINDOW (founder-approved 2026-08-25):** require
      `issuedAt <= block.timestamp <= deadline`, `deadline > issuedAt`, and `deadline - issuedAt <= 1 hour`.
      Reject future issue time, expiry, zero/reversed window, or an over-hour interval before signer, nonce, or
      accounting mutation. Direct operator calls have no signature-lifetime window but consume the same current
      nonce and carry the same public reason. Rehearse every timestamp boundary and miner timestamp skew.
      **CLOSED REASON TAXONOMY + ONE GLOBAL NONCE (founder-approved 2026-08-25):** require exactly one public
      reason code from `operations`, `security`, `purchase_recovery`, `migration_bypass`, `retirement`, `other`, or
      `reconciliation_outflow`, plus a nonzero `detailsHash` commitment to canonical explanation bytes. Require the
      dedicated code exactly when reconciliation backing is debited; reject it when no such backing is touched and
      reject every generic reason when it is. The caller may not choose a bucket or reconciliation record. Persist both immutably in
      the event; never depend on off-chain text availability for execution. Make direct and relayed outflows
      require the exact `nextOutflowNonce` and increment the same global counter on success. Give only the
      current operator `invalidateOutflowNonces(newNextNonce)`, require a strict increase, move no ETH, mutate no
      bucket/reservation/allocation/cap, and emit old/new nonce. Rehearse zero/unknown reason, zero/details hash,
      direct-versus-relayed ordering, stale/future nonce, skip invalidation, and post-invalidation replay.
      **EOA + ERC-1271 MAIN OPERATOR (founder-approved 2026-08-25):** allow an EOA or smart-contract wallet.
      Direct execution always requires `msg.sender == mainOperator`. For relay, recover exact ECDSA signer when
      the operator has no code; when it has code, require the exact ERC-1271 `isValidSignature` magic value for
      the same EIP-712 digest. Fail closed before nonce/accounting mutation on revert, out-of-gas, malformed
      return, non-magic value, or signer-type mismatch. Never fall back from failed ERC-1271 to ECDSA or failed
      ECDSA to arbitrary contract validation. Rehearse EOA, Safe/smart wallet, upgradeable proxy, malformed/revert/
      gas-bomb responses, code-presence changes, and both prohibited fallbacks.
      **NONZERO RECIPIENT / NO ETH BURN PATH (founder-approved 2026-08-25):** reject `address(0)` for every
      operator outflow and expose no `operator_burn` or other intentional ETH-destruction entry point. Document
      that the vault cannot prove an arbitrary nonzero address is recoverable. Rehearse zero recipient through
      direct and relay paths and confirm no alternative vault path can intentionally burn ETH.
      **DIRECT OPERATOR SELF-RENUNCIATION (founder-approved 2026-08-25):** let only the current operator directly
      renounce; do not relay it. Atomically set operator to zero, cancel pending nomination, increment generation,
      and invalidate every signed authorization exactly as Safe zero-disable. Move no ETH and mutate no nonce,
      bucket, reservation, allocation, or cap. Emit former operator/new generation. Renunciation names no
      successor; orderly handoff uses instant `replaceMainOperator` first.
      Rehearse direct caller mismatch, smart-wallet direct call, pending nomination, signatures, and zero state.
      **ETH-ONLY EMPTY-CALLDATA OUTFLOW (founder-approved 2026-08-25):** send ETH to the arbitrary recipient with
      empty calldata only. Expose no arbitrary calldata, `delegatecall`, token approval, token transfer, or Stock
      Token/NFT movement through the vault. Permit a contract recipient's payable `receive`/fallback to execute,
      using checks-effects-interactions plus a reentrancy guard, and atomically revert all accounting/cancellation
      state if transfer fails. Richer calls happen after the ETH leaves, without vault authority. Rehearse EOA,
      payable/nonpayable/malicious/reentrant recipients, revert/bomb behavior, and attempts to smuggle calldata,
      approvals, tokens, NFTs, or delegate execution.
      **DETERMINISTIC OUTFLOW DEBIT + IMMEDIATE DISCLOSURE (founder-approved 2026-08-25):** debit available ETH
      first, unattributed ETH second, ordinary reserved ETH third, and `reconciliation_pending` ETH last, with no
      caller bucket choice. When ordinary reservations are required,
      cancel the minimum number of whole intents by sorting live reservations amount-descending, then later
      execution deadline first, then intent ID ascending, and cancelling until covered. Never leave a partially
      funded intent; reclassify cancelled excess remaining after transfer as available. If reconciliation backing is
      still required, debit greatest backing first, then oldest `reconciliationStartedAt`, then lowest intent ID,
      exhausting records before at most one partial debit. Emit each cancellation
      plus one immediate `operator_outflow` carrying operator/auth path/recipient/amount/reason code/details
      hash/nonce,
      affected intents, and pre/post balance and buckets. Roll all state back if ETH transfer fails. Expose
      current/pending operator and clocks, outflows, and cancellations on public API/boards. Rehearse exact and
      excess coverage, all ties, multi-intent cancellation, event completeness, and rollback.
      **SPEND-BASED CONCENTRATION CAPS (founder-approved 2026-08-25):** normal buys must fit ballot input,
      per-purchase ETH cap, citywide daily cap, exact-version rolling-30-day cap, and available unreserved
      balance. Count actual trade input plus input fees; exclude separate gas and failed/reverted/cancelled/
      replaced/expired attempts. Atomically consume daily/rolling capacity on success. Allow immediate Safe
      reductions without sale/reallocation/retroactive invalidation; block until capacity returns. Require
      public finalized/synced Safe execution for increases. On failure set `exposure_cap_reached`, buy no
      substitute, and pool remaining ETH. Prevent split evasion and expose cap/consumed/remaining/window/wall.
      Main-operator ETH outflows bypass purchase caps but must never be booked as purchases. Rehearse every cap
      intersection, rolling boundary, cap reduction below use, increase finality race, split attempts, and
      outflow-versus-purchase classification.
      **STATE-PRESERVING VAULT MIGRATION / OPERATOR BYPASS (founder-approved 2026-08-25):** canonical migration
      remains an at-least-48-hour public Safe proposal binding old/successor vault, successor chain/code hash,
      expected full amount, old/new state hashes, evidence, earliest time, and expiry. Require no pending intent
      or deterministic reservation recreation, same buyer restrictions, full reconciliation, atomic complete
      state/balance move, preserved surplus class, retired old reservations, finality/sync, and public proof.
      Immediate response is pause. Independently, main operator may move any/all ETH immediately without those
      migration constraints; label only `operator_outflow`, transfer no state/certification, and cancel impacted
      intents. On permanent retirement the operator may dispose of pool ETH arbitrarily; otherwise it remains.
      Rehearse canonical delay/expiry/state mismatch and operator partial/full bypass, ensuring boards never call
      outflow locked, acquisition-only, purchase, refund, or migration.

### 2b. THE BANK — the Denari (DNR) market (only when it ships; not part of the first cut)
Order matters more here than anywhere else in this file, because **two of these steps fail SILENTLY**:
omit them and the market looks healthy from the outside and is not.
- [ ] **`Denari("Denari", "DNR", safe)`** → **`Transmuter(denari, asset, safe)`** →
      **`Alchemist(denari, asset, vault, transmuter, safe)`**, then wire:
      `denari.setMinter(alchemist)`, `denari.setBurner(transmuter)`, `transmuter.setFunder(alchemist, true)`,
      `transmuter.setFunder(safe, true)` (the launch seeder).
      *(The debt token was founder-named **Denari / DNR** on 2026-08-13 — pre-rename docs and every
      audit report call it `nUSD`; same contract. Pass the name and symbol EXACTLY as above — the
      constructor takes both, and the ERC-2612 permit domain is derived from the name.)*
- [ ] **`alchemist.setLtvBps(bps)`.** Bounded by `MAX_LTV_BPS` **and** by the harvest fee — the pair must
      satisfy `ltv + fee <= 10000`, enforced in both setters, so at the shipped 20% fee the reachable
      ceiling is 80%, not 90%.
- [ ] **⚠ SEED THE BUFFER BEFORE ANY BORROW.** `transmuter.fund(seed)` from the Safe. `Alchemist.mint`
      checks the reserve floor both before and after issuance, so an unseeded market now refuses the
      FIRST borrow atomically—no DNR or debt survives. This is fail-closed, but still means the market is
      unusable until real backing is seeded. `test_an_unseeded_market_refuses_the_first_borrow` pins it.
- [ ] **⚠ SET THE MINT CAPS.** `alchemist.setMintCaps(perBlock, perDay)`. **Zero means UNLIMITED here** —
      these fail OPEN, unlike `maxOmrPerEth` and the gear caps. Skipping this does not stop the market;
      it runs it with no rate limit on issuance.
- [ ] **`alchemist.setHarvestFee(bps, recipient)`** — the performance fee on realised yield, capped by
      `MAX_HARVEST_FEE_BPS`. A ZERO recipient disables the fee (fail-safe: an unset recipient
      under-charges rather than burning a borrower's yield), so this is the one bank setter whose
      omission costs revenue and nothing else.
- [ ] Backend: set `ALCHEMIST_ADDRESS` + `ALCHEMIST_ASSET` so the worker (the market's DECIMALS are read off the chain — never configured)
      syncs `HarvestFeeTaken` into `bank_revenue`. The decimals matter: the fee is denominated in the
      market's UNDERLYING (6dp for USDC), and `bank_revenue` is deliberately NOT mirrored into the
      ETH-denominated `rwa_revenue`, whose sum is the vault's `allocated <= held` wall.

## 3. Verify ownership at the Safe
- [ ] Every ownable contract receives the Safe in its constructor. Verify `owner() == safe` on every
      deployed ownable before any wiring transaction. A production deployment must not rely on a later
      `transferOwnership`/`acceptOwnership` handoff from a hot deployer.

## 4. Backend env — activate the dormant rails (production API + worker, same DB)
Each rail is OFF until its address/config is present. Set on BOTH processes.

| Env var | Turns on | Notes |
|---|---|---|
| `CHAIN_RPC_URL` | the whole chain sync + signer | absent ⇒ fully dormant |
| `CHAIN_ID` | EIP-712 domain + `assertChainId` | **must equal the RPC's real chainId** — a mismatch DISABLES chain sync fail-closed (never signs under the wrong domain) but does NOT crash the worker |
| `CHAIN_CONFIRMATIONS` | reorg depth (default 5) | the watcher stays this far behind head |
| `CHAIN_START_BLOCK` | first-scan seed | set to the contracts' deploy block (don't scan from genesis) |
| `CHAIN_POLL_MS` | sync cadence | optional |
| `VOUCHER_CLAIM_ADDRESS` | `Claimed` sync (frees reserve) + it's the voucher `verifyingContract` | — |
| `VOUCHER_SIGNER_PK` | EIP-712 signing — vouchers (`POST /v1/withdraw`, gear) AND bond quotes (`POST /v1/bond/quote`) | **the crown jewel — HSM/KMS in prod, audited (Gate 0.2)**; the same signer must be set as OmertaBond's `signer` |
| `BOND_QUOTE_TTL_SEC` | bond-quote validity window (default 3600s) | must stay under the contract's `MAX_QUOTE_TTL` (30d) |
| `VOUCHER_RECLAIM_GRACE_SEC` | expired-voucher reclaim grace | optional (worker sweep) |
| `DAILY_CAP_OMR` | per-day withdrawal cap (wei) | mirrors the contract's `dailyCapOMR` |
| `OMERTA_FEES_ADDRESS` | fee sync (`MintFeePaid`/`RespawnFeePaid`/`RerollFeePaid` → credits) | — |
| `OMERTA_BOND_ADDRESS` | **the `Bonded` → `recordBond` bond sync (NEW — now wired)** | books the event's authoritative payout + POL/Vig split; idempotent on nonce |
| `STREET_DEED_ADDRESS` | API: `POST /v1/deeds/extract` signs the DeedVoucher (needs `CHAIN_ID` + `VOUCHER_SIGNER_PK`) + it's the deed `verifyingContract`. WORKER: `Extracted` → `markDeedExtracted` (frees the extractor) + `Redeemed` → `reimportDeed` (burn brings the deed back) | set on BOTH processes; dormant until set. §10.4-neutral (ownership, not currency) |
| `ALCHEMIST_ADDRESS` (+ `ALCHEMIST_ASSET`, the label only — decimals come from the chain) | THE BANK's harvest-fee sync → `bank_revenue` | only when the bank market ships |
| `MINT_FEE_ETH` / `RESPAWN_FEE_ETH` | the PLEX price quote | ETH-denominated; keep == the contract fees |
| `WALLETCONNECT_PROJECT_ID` | the console's **WalletConnect (mobile)** option — the ONLY way a phone can link a wallet (desktop browser wallets are auto-discovered via EIP-6963 and need nothing) | a PUBLIC WalletConnect/Reown project id, free from https://dashboard.reown.com; unset ⇒ the console hides the option. Surfaced in `/v1/rules`. Not chain-gated: linking is a signature, so the chain is requested as OPTIONAL and a wallet that has never heard of the OMERTÀ chain still connects |
| `PLEX_RESPAWN_OMR` | the respawn's PLEX floor price (pre-market) | a sign-off lever. **There is no `PLEX_MINT_OMR`** — the mint is ETH only (it is the Sybil bound and the extraction gate, so it gets one rail and one published price); setting it does nothing |
| `VIG_BPS` / `VIG_RESERVE_BPS` / `VIG_MAX_PRICE_JUMP` | Vig split + the buyback price-sanity bound | — |

**`ALLOW_MOD_REAL_REVENUE` — leave UNSET/off in production.** It is a QA-only flag that lets the mod
comp/simulate routes inject *real* revenue; in prod the ONLY legitimate real-revenue source is a real on-chain
event carrying a txHash (fees, `Bonded`, `HarvestFeeTaken`). With it off, a comp books zero POL/Vig — no fabricated,
unbacked reserve. (Red-team D-MED2.)

- [ ] **THE PATH A REVENUE SPLIT — the env flip (`deploy/fee-splits.env`).** The founder-signed fee split
      (`deploy/fee-splits.json`, 2026-08-13) is a coherent SET of ~17 backend levers. Apply them on **BOTH
      the api and worker** at go-live — never piecemeal: several are validated by rules.tail.js load guards
      at boot (`SELL_TAX` four-way sum, `BOND` sum, the fee sum), so a partial set crash-loops the process.
      **Run `node tools/validate-fee-splits.js` first** — it loads the router with exactly these values and
      asserts they reproduce the JSON and pass every guard. The code DEFAULTS stay byte-identical (community
      slices 0), so this file IS the "env flip with sign-off" (`omerta-treasury-to-family-design.md` §8
      Phase 2); do NOT set these in the pre-chain render.yaml. The three IMMUTABLE contract args that must
      match — `OmertaFees.vigBps=2500`, `OmertaBond(polBps=7500,devBps=1500,rwaBps=500)` — are in the deploy
      steps above; the sell-tax `setSellTax(900,200,160,240)` matches too — the 240-bps community slice
      is a 4th ON-CHAIN recipient as of 2026-08-15 (the community-buyback keeper's wallet; it was a
      backend carve before the contracts gained it).

## 5. Fund + reconcile the backend accounting to MIRROR the chain
The backend keeps its own reserve records; they must track the on-chain balances, or the invariants flag a gap.
- [ ] `POST /v1/mod/reserve/fund` → set `chain_reserve.funded_omr` to match the OMR held by `VoucherClaim`
      (the withdrawal full-reserve queue signs only within `funded_omr`).
- [ ] `POST /v1/mod/bond/fund` → set `bond_reserve.capacity_omr` to the OMR budget you intend bonds to issue.
      Since step 4 this is a **backend-side budget, not a mirror of a balance** — OmertaBond mints its payouts,
      so there is no on-chain tranche to match. The on-chain wall is `dailyCapOMR` + `maxOmrPerEth`; keep the
      backend budget in step with them or `GET /v1/mod/bonds` (`runBondInvariants`) reports the gap. The
      `Bonded` watcher **bypasses** the backend cap on ingest (the contract already enforced its own walls), so
      a real bond is always recorded and can never stall the sync cursor. Same discipline for
      `runVigInvariants` / `GET /v1/mod/vig` (extraction ≤ inflow).

## 6. Post-deploy verification (testnet, then the same on mainnet after the gates)
- [ ] `CHAIN_RPC_URL=… CHAIN_ID=… DEPLOYER_PK=… PLAYER_PK=… VOUCHER_SIGNER_PK=… node tools/chain-e2e.js`
      → all 27 asserted steps green (deploy → SIWE link → pay a fee → watcher credits → mint → earn $OMR →
      fund reserve → withdraw signs an EIP-712 voucher → `claim()` on-chain → replay/tamper REVERT → the
      `Claimed` watcher frees reserve → gear voucher mints → uncapped gearId fails closed → §10.4 holds).
- [ ] Boot the worker; confirm the sync logs advance (`💰 fee sync`, `👁 claimed sync`, `🏦 bond sync` once a
      `Bonded` fires, `🏛  bank sync` if the Alchemist is live) and the cursors persist (`chain_cursor`).
- [ ] `GET /v1/mod/reserve`, `/v1/mod/vig`, `/v1/mod/bonds`, `/v1/mod/emission` read green (backed / within
      caps). The `/admin` §10.4 banner reads OK. `npm run invariants` all `ok:true`.
- [ ] Do one real player round-trip on testnet: pay the mint fee → mint a character → earn $OMR → link wallet
      (SIWE) → `POST /v1/withdraw` → `claim()` the voucher → 25 real OMR in the wallet.

## 7. NOT part of the first mainnet cut (still deferred / gated)
- **The bond QUOTE SIGNER is BUILT** (`src/chain.js:quoteBond` + `POST /v1/bond/quote`) — a player requests a
  signed `BondQuote` bound to their linked wallet (`Chain.BOND_QUOTE_TYPES` / `bondChainConfig()`, exact parity
  with `OmertaBond.QUOTE_TYPEHASH`: `payer, principal, priceOmrPerEth, discountBps, vestSeconds, nonce, deadline`;
  domain `OmertaBond`/`1`; verifyingContract = `OMERTA_BOND_ADDRESS`), submits `bond(quote, signature)` on-chain,
  and the `Bonded` watcher recovers the quote's exact price/discount from the persisted `bond_quotes` row. It is
  **chain-dormant** (400s `chain_unconfigured` unless `CHAIN_ID` + `OMERTA_BOND_ADDRESS` + `VOUCHER_SIGNER_PK`
  are set) and pre-checks the backend tranche (`bond_reserve.capacity_omr`) so a player never gets a quote whose
  `bond()` would revert `TrancheExhausted`. Quote-nonce space is `bond_reserve.next_nonce` (independent of the
  withdrawal `chain_reserve` nonce). `BOND_QUOTE_TTL_SEC` (default 1h) sets the quote deadline (< contract
  `MAX_QUOTE_TTL`). **The in-browser wallet flow is BUILT**: the console (EIP-6963 multi-wallet discovery —
  MetaMask / Robinhood Wallet / any injected wallet, with a picker) requests a quote, then `POST /v1/bond/calldata`
  server-encodes `bond(quote, sig)` (viem) and the connected wallet `eth_sendTransaction`s it after switching to
  the quote's chain. It is DORMANT until this rail is configured. Still deferred: the DEX-TWAP oracle below (for a
  live quote board) — today the oracle is the latest manual Vig-buyback print.
- **The Uniswap v4 migration** (`omerta-v4-hook-design.md`) — `OmertaHook.sol` is BUILT, tested, and
  rehearsed unarmed on testnet, but **not deployed on mainnet and not launchable yet**. The remaining
  work is deliberately ordered. `UNISWAP-ROUTING.md` is the routing-specific release gate:
  - **The address must be MINED.** v4 encodes a hook's permissions in the low 14 bits of its address, and
    the constructor refuses to exist anywhere that does not carry exactly `HOOK_FLAGS` (`0x30CC`). So the
    deploy is a CREATE2 salt search, and the permission set can NEVER be extended afterwards — a missing
    flag is a new hook plus a full liquidity migration. The miner also rejects every `0x91…` candidate,
    avoiding Uniswap Labs' address-prefix review trigger.
  - **Routing approval is a launch blocker, not a post-launch listing task.** The hook's essential
    `afterSwapReturnsDelta` flag (and reserved `beforeSwapReturnsDelta` flag) means it is not automatically
    eligible for Uniswap Labs routing. Deploy the final audited bytecode to a Labs-supported mainnet early,
    verify the exact source on the explorer, initialize a minimally funded static-fee review pool (the live
    form requires a pool address), submit the Labs allowlist form with the full tax/admin/window disclosure,
    and record affirmative approval before announcing or seeding canonical liquidity. A Uniswap hooklist
    entry only supplies interface metadata; it does not grant routing approval.
  - **Wire before arming:** `setRecipients(dev, rwa, community, lp)` → `setAllowedQuote(quote, true)` for
    each quote currency the Safe is willing to HOLD (the empty allow-list is the deploy default, and until
    it is set NO pool can be created on this hook at all) → configure `setAntiSnipe(...)` **before**
    `initialize` if the new pool needs an opening window (the deadline is snapshotted at initialization
    and can never be extended) → `initialize` the pool →
    `setSellTax(900, 200, 160, 240)` (Path A — rwa 400→160 with the 240-bps community slice a 4th ON-CHAIN
    recipient; the community wallet is the family-buyback keeper's, per the OMR sell-tax step above).
    `setObserver` once the hook-native oracle exists. The observer is event-driven: listen for
    `ObservationRequested(poolId)` and call `pokeObserver(poolKey)` after PoolManager settlement; it is
    deliberately never entered synchronously from `afterSwap`.
  - **✅ THE LP LEAGUE reader is BUILT AND PROVEN (2026-08-16)** — `src/dexbot.js:readLpPositions`,
    installed at worker boot (`lpReaderReady()`, a WEAKER condition than the bots': it is read-only
    and needs no `DEX_BOT_PK`, so a box that never sends a transaction still accrues the league).
    It enumerates through the poolId-filtered `ModifyLiquidity` stream rather than scanning every
    token the PositionManager ever minted — v4 passes `bytes32(tokenId)` as the position SALT and
    PoolManager indexes that event by poolId — and resolves the PoolManager from the
    PositionManager's own `poolManager` getter (one less address env to drift). `npm run dexbot-e2e`
    pins it against a real pool: the POL positions read 1.8518 ETH against the 1.851788 ETH they
    actually consumed, and a narrow position carrying 34× the liquidity is credited only the 1 ETH
    it put in (the anti-gaming property — depth is priced by TOKENS, never by raw L).
    **Config at launch:** `POSITION_MANAGER_ADDRESS` + `STATE_VIEW_ADDRESS` + `OMR_ADDRESS` +
    `OMERTA_HOOK_ADDRESS` + the pool params on the WORKER, plus `DEX_POOL_FROM_BLOCK` (the pool's
    deploy block — the log scan starts there; leaving it 0 works but re-scans the whole chain every
    12h tick). Then size `BOND_LP_SCORE_PER_ETH_DAY` (BALANCE.md § THE LP LEAGUE — the shipped 300
    is a proposed default; the ratio depends on LP fee income and impermanent loss at the live
    volatility, so it cannot be sized before there are real LPs).
  - **Sequencing that is not optional** (§9.2): deploy the hook-native oracle → let it accumulate a FULL
    window → `OmertaBond.setOracle` → *then* migrate liquidity. Doing the migration first points wall 4 at
    a pool where price is no longer discovered, which is worse than an outage because it still returns a
    number. And re-derive `dailyCapOMR` (`npm run dials`) against the new depth afterwards.
  - **Seed POL into the hooked pool BEFORE migrating** (§4b). Pool-local enforcement means the moat is
    depth; it is thinnest at launch, which is exactly when a rival untaxed pool is cheapest to stand up.
  - **CLOSED 2026-08-11 (founder: "get rid of the Vig trade fee") — the sell tax is the canonical
    pool's ONE hook and the trade fee is RETIRED, not folded.** The earlier fold (D1 = A) was never
    built because its ETH-on-buys fee needs the input-side `beforeSwap` path, which breaks partial
    fills. Consequence to carry into deploy: the Vig has no trading leg, so withdrawal backing is
    gameplay fees + Store + bonds only (sim P9.15 prints it). **Nothing to configure and nothing left
    to build here** — `OmertaHook` already IS the canonical pool's hook, so the address may be mined
    against it as it stands.
- **The two DEX bots are BUILT (2026-08-15, `src/dexbot.js`)** — chain-dormant keepers on the worker's
  chain-sync tick (their own cadence, `DEX_BOT_EVERY_MS`, default 12h):
  - **The DEX buyback bot** (`runDexBuyback`) swaps unspent Vig revenue for hard OMR on the canonical v4
    pool via the Universal Router and books the **ACHIEVED** price through the audited `runVigBuyback`
    (inheriting its continuity wall, root cap, reserve split + fundReserve). The price comes from the
    SAME oracle the bond reads (resolved from `OmertaBond.oracle()` — the setOracle cutover repoints the
    bot automatically), FAIL-CLOSED on no/zero/stale readings, and every swap carries a hard `minOmrOut`
    slippage floor (`DEX_MAX_SLIPPAGE_BPS`, default 3%). Two-phase swap-then-book (`dex_swaps` journal,
    idempotent on the tx hash): a crash between the real swap and the accounting loses nothing and never
    re-swaps. The manual `mod/vig/buyback` price stays as the QA/fallback rail.
  - **The POL-pairing bot** (`runPolPairing`) pairs the bond-delivered POL ETH into the OMR-ETH pool as a
    full-range v4 position minted to the SAFE (`POL_POSITION_OWNER` — POL belongs to the treasury, never
    the hot bot key). Root cap: Σ real `pol_pairings` ≤ `bond_reserve.pol_eth` — the bot can never pair
    ETH the bond programme did not deliver. The OMR side is the bot wallet's own hard OMR
    (Safe-allocated genesis supply — nothing mints).
  - **Activation (worker):** `DEX_BOT_PK` (SECRET — fund it with the POL ETH stream + Safe-allocated OMR
    for the pairing side) + `UNIVERSAL_ROUTER_ADDRESS` + `POSITION_MANAGER_ADDRESS` +
    `STATE_VIEW_ADDRESS` + `POL_POSITION_OWNER` (the Safe) + the pool params (`DEX_POOL_FEE` /
    `DEX_POOL_TICK_SPACING` — must match the initialized pool EXACTLY) on top of the existing
    `CHAIN_RPC_URL` + `OMERTA_BOND_ADDRESS` + `OMR_ADDRESS` + `OMERTA_HOOK_ADDRESS`. Nightly invariants
    (`runDexBotInvariants` → alertDrift: the POL root cap, orphan-fill freshness, comps-book-nothing,
    the swaps↔buybacks reconciliation); ops board + run-now triggers at `GET/POST /v1/mod/dexbot*`.
  - **✅ THE v4 ENCODINGS ARE PROVEN (2026-08-16).** `npm run dexbot-e2e` stands up a REAL Uniswap v4 on
    anvil — the actual PoolManager / PositionManager / StateView / Universal Router / Permit2 bytecode,
    the canonical OMR/ETH pool behind the REAL OmertaHook — and runs BOTH bots with their senders
    UNSEAMED, so `src/dexbot.js`'s own encoders build the calldata that executes (18 asserted steps).
    **It found a real defect:** the mint over-sent ETH and v4 never refunds it (`DeltaResolver` settles
    native ETH out of the periphery contract's own balance), so the remainder was stranded in the
    PositionManager — unreachable by anyone, in bonded POL money, **0.148 ETH of 1 ETH at a 15%
    oracle-vs-spot gap**, with the journal still booking the full ETH as paired. Fixed (a `SWEEP`
    action + booking what the position actually consumed), both halves mutation-pinned.
    **Still do a live smoke on the real chain before the first real run** — this proves the encodings,
    not your deploy: one small swap and one small pairing, then read the position and the fill back.
    A wrong `DEX_POOL_FEE`/`DEX_POOL_TICK_SPACING` misses the pool entirely and is a config error the
    prover cannot see.
- **The on-chain Store** — `OmertaFees.payForPackage` is **BUILT** (2026-08-14, in the audit batch:
  fail-closed on an unpriced sku, exact-value, forwards dev/Vig, custodies nothing; `setPackagePrice(sku,
  wei)` prices a package on-chain, `0` retires it). **The BACKEND watcher is BUILT (2026-08-15):**
  `syncStorePaidEvents` (worker, cursor `store`, dormant until `OMERTA_FEES_ADDRESS`) credits the paying
  account through the audited `recordStorePurchase` (idempotent on `nonce`, pay-before-link reconciled).
  The on-chain sku is **`uint256(keccak256(bytes(skuString)))`** (the StreetDeed tokenId convention — no
  lockstep registry; `skuChainId(sku)` in store.js computes it, `skuFromChainId` reverses it over live +
  RETIRED skus). A REAL payment for a retired/unknown sku **HOLDS THE CURSOR** (re-thrown, not
  poison-skipped) so a human looks — money arrived for something we don't sell. **Deploy:** the Safe
  calls `setPackagePrice(skuChainId(sku), wei)` per live sku in lockstep with the backend
  `STORE.PACKAGES` prices, and sets `OMERTA_FEES_ADDRESS` on the worker.
- **Liquidity bonds** (LP-token deposits) — launch-gated (§0.3).
- **The tokenized-stock layer** — RETIRED 2026-07-31 (`omerta-stock-layer-retirement.md`) and
  **REINSTATED 2026-08-10** (`omerta-brokers-design.md`, founder decision). The treasury BUYS tokenized
  stock, `allocated ≤ held` (per ticker, in units) holds, and `StockVault` (now in the audit batch, §2c)
  is the GATELESS delivery leg. The BACKEND is now COMPLETE: the buy keeper (`runStockBuyback`), the
  per-account allocation ledger (`allocateStock` + nightly `runTreasuryInvariants`), and the delivery
  keeper (`runStockDeliveryKeeper`, 2026-08-15 — §2c) that drives `StockVault.deliverAuthorized` is built
  and chain-dormant. The ETH VAULT is the same shape one asset over
  (`omerta-stock-layer-retirement.md`) — allocation-only, same asset both sides.

## 7b. Standing duty — reconcile the treasury Safe against what the vault owes

The vault (`omerta-stock-layer-retirement.md`) lets a player burn earned $OMR to claim allocation of
**ETH the treasury holds**. `allocated ≤ held` is enforced in code and alarmed nightly, and it proves the
vault never owes more than the books say **arrived**. It cannot prove the ETH is **still there** — the
treasury Safe is a wallet a human controls, and ETH spent out of it writes no row in this database.

So this is an operational duty, not a code guarantee:

- `GET /v1/mod/treasury` publishes **`safeMustHold`** — the ETH currently allocated to players. The
  /admin dashboard renders it beside the wall's ✓/⚠.
- **The treasury Safe's real balance must never fall below `safeMustHold`.** Spending down to it is
  spending players' allocation.
- Reconcile on the same cadence as any other treasury movement, and before any withdrawal from the Safe.

The vault is allocation-only today (nothing is delivered), so a shortfall is a broken promise rather than
a failed payment — which is exactly the window in which it is cheap to fix.

## 8. Rollback / kill switches
- Every contract is **pausable** by the Safe (`pause()`), stopping claims/bonds/fees without touching balances.
- The rails are **dormant-by-unsetting**: remove `CHAIN_RPC_URL` (or a specific address var) and that rail goes
  quiet — the off-chain game keeps running unaffected.
- The **withdrawal queue** (`chain_reserve`) never signs beyond `funded_omr`; a queued-but-unsigned withdrawal is
  cancellable (`POST /v1/withdraw/:id/cancel`, reverses the burn net-0). `sweep()` on VoucherClaim/OmertaBond can
  reclaim only the UNCOMMITTED tranche (never OMR backing outstanding obligations).
- **Stopping issuance** has two independent switches, either of which is one transaction from the Safe and
  neither of which touches a balance or a bonder's vested claim: `OMR.setMinter(address(0))` revokes the mint
  privilege at the token, and `OmertaBond.setMaxRate(0)` fails every new bond closed at the bond contract. Use
  the token-side one if the bond contract itself is what you distrust.
- **ROTATING THE VOUCHER SIGNER IS FOUR TRANSACTIONS, NOT ONE (red-team C1).** `VOUCHER_SIGNER_PK` is a
  single backend key and it signs for **four** contracts, each of which stores its own `signer` and must be
  rotated separately. There is no shared registry on purpose (one more contract, one more audit surface, one
  more single point of failure), so the containment is this list — and a PARTIAL rotation silently leaves a
  door open, with nothing on-chain to tell you which. On any suspicion, in this order:
  1. `VoucherClaim.pause()` · `OmertaBond.pause()` · `DynastyNFT.pause()` · `StreetDeed.pause()` — stops new
     issuance everywhere first, so the rotation is not a race. (`StreetDeed.redeem()` deliberately still works;
     a pause must never trap a holder's asset.)
  2. `setSigner(newSigner)` on **all four**: `VoucherClaim`, `OmertaBond`, `DynastyNFT`, `StreetDeed`.
  3. Rotate `VOUCHER_SIGNER_PK` on the API (the worker does not sign), redeploy, then unpause.
  Until step 2 completes on every one, pre-signed vouchers stay valid at whichever contract was missed, bounded
  only by that contract's own `dailyCap*` and `MAX_*_TTL` — so the blast radius of the key is the SUM of the
  four daily caps, which is the number to size them against rather than each in isolation.
- **RECOVERING A STRANDED DEED VAULT (founder-directed 2026-08-16).** Burning a Street Deed **freezes** its
  ERC-6551 vault, it never empties it: the account's address is a pure function of the tokenId, the tokenId is
  `keccak(NAME)`, and nothing ever deletes a `street_deeds` row or frees its unique name — so re-minting the
  same street restores control with the contents intact (`test_the_same_street_re_extracts_to_the_same_id_after_a_burn`).
  In the ordinary case **nobody has to act**: the re-import stays `pending` and `sweepDeedReimports` retries it
  every worker tick, forever, until the burner links a wallet or frees their deed slot.
  The case that never resolves is a burn from a wallet that will **never** link — a lost key, a redeem from the
  wrong address, a player who does not come back. Then real stock sits frozen at a known address with no route.
  - `GET /v1/mod/deeds/stranded` lists what is genuinely stuck (and how long it has waited).
  - `POST /v1/mod/deeds/recover {street}` signs a `DeedVoucher` for that street to **`DEED_RECOVERY_ADDRESS`**,
    the treasury holding address. Claim it from that wallet: it re-mints the SAME tokenId, which unfreezes the
    vault. Returning a recovered street to a player is a **separate, deliberate act** by whoever holds the
    treasury — deliberately not something this route can be aimed at.
  - Four walls, because the lever is strong: the destination is fixed (never caller-supplied), only a deed with
    a **recorded burn** still in the on-chain state qualifies (so it can never be a confiscation — and the
    contract backstops it, since `_safeMint` reverts on a live id), not before `DEED_RECOVER_AFTER_MS` (30d
    default — the wait is what distinguishes stranded from in-flight), and it **supersedes** the pending
    re-import so the sweep can never later hand the street to the burner while the treasury holds the NFT.
  - It is mod-gated, so every recovery lands in `mod_actions`. **Set `DEED_RECOVERY_ADDRESS` before you need
    it**; unset, the route refuses rather than guessing a destination.
- **VESTING IS A PRODUCT FEATURE, NOT A SECURITY CONTROL — do not count it as one.** There is deliberately no
  minimum `vestSeconds`, and adding one would buy nothing: `claim()` is intentionally NOT `whenNotPaused`, so
  pausing stops new bonds but never stops already-vested OMR being claimed — a vest is therefore not a window in
  which the Safe can intervene, only a window in which an attacker waits. And the blast radius is `dailyCapOMR`
  whatever the vest is: a vest changes WHEN the capped amount lands, not HOW MUCH. `npm run dials` sizes the cap
  on the assumption it is realised immediately, which is the conservative reading and stays correct with no
  minimum. The server signs the full `BONDS.VEST_HOURS` for honest bonders; a floor would only constrain them.
  (Decided in `AUDIT-oracle.md`.)

---
*Off-chain alpha ships independently of all of this — see `DEPLOY.md`. This runbook is the chain rail only, and
mainnet stays blocked on §0's three gates.*
