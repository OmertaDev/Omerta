# CHAIN-AUDIT-PACKET (O1) — what goes to the third-party reviewer, and what to attack

> **LIVE PACKET — measured 2026-09-06 at release head `b0a214ca`.** This supersedes
> `CHAIN-AUDIT-PACKET.md`, which is retained unmodified as historical audit evidence from the
> pre-O1 tree and must not be sent as a current engagement scope. **`CHAIN-DEPLOY.md` remains the
> operational runbook**; this document is the SCOPE and the ATTACK SURFACE.

**This is gate 2 of the three in `CHAIN-DEPLOY.md` §0.** Gate 1 (`forge test`) is green and gate 3
(the launch review) is signed; the external audit is what remains, plus gate 4 (Uniswap Labs routing
approval for `OmertaHook`), which is a separate submission and not this engagement.

**Read this beside `CHAIN-DEPLOY.md`, never instead of it.** That document is the deploy order, the
arm order, the env and the kill switches. This one is what is in the batch, what each contract's
walls actually *claim*, what has already been proven and by what, and — the part worth an auditor's
time — the properties that are load-bearing and are **not** proven by anything we can run ourselves.

---

## 0. PROVENANCE — every figure below, and what produced it

A frozen figure with no toolchain beside it is not evidence. The predecessor packet's own test count
could not be reproduced, because the workflow's compiler was unpinned and `stable` resolved at run
time; the count is version-DEPENDENT, so a reader re-running that tree could not tell whether the
TREE had changed or the COUNTER had. That ambiguity is what left the forge gate red and
unreproducible for 19 hours on 2026-08-29. Hence:

| what | value | how it was measured |
|---|---|---|
| release head | `b0a214ca` | the commit whose `forge test (contracts)` run is cited below; `39937a12` (current `main`) is contract-identical — its diff touches `knowledge/generated/` only |
| toolchain | **forge v1.7.1** | pinned in `.github/workflows/forge.yml`, which also prints `forge --version` as its own step |
| compiler | **solc 0.8.26**, optimizer on, `optimizer_runs = 800`, `evm_version = "cancun"` | `omerta-contracts/foundry.toml` |
| fuzz | **512 runs** | `foundry.toml [fuzz]` |
| invariants | **forge defaults** — there is no `[invariant]` section | `foundry.toml`; stated rather than implying tuned depth |
| suite result | **896 tests across 43 suites, 0 failed, 0 skipped** | the CI forge job on `b0a214ca`, measured 2026-09-06; the 43 per-suite lines sum to exactly 896 |

**The version fingerprint, concretely.** `test/SettlementGasPoolInvariant.t.sol` holds six
`invariant_*` functions and zero `test_*` functions. Under 1.7.1 it reports **6**; under the older
aggregated reporting model it reports **1**. A count quoted without its compiler is not a count.

> **Three documents disagreed about this figure and all three are now reconciled to the line above.**
> `CHAIN-DEPLOY.md` carried 305/305 (2026-08-21), `CHAIN-AUDIT-PACKET.md` 387/22 (2026-08-27) and
> `LAUNCH-READINESS.md` 531/531 across 27 suites (2026-08-27) — two of them claiming the same date.
> None was dishonest; each was measured at its own head under an unnamed compiler, and none could be
> reconciled with the others. That is the failure this section exists to end.

---

## 1. SCOPE — 31 contracts + 9 interfaces, one engagement

*"Batch, not dribble"* (`omerta-dynasty-machine-design.md`): the scope must be KNOWN before it is
sent, because a contract added afterwards means paying to re-audit. The set below is the complete
`omerta-contracts/src` tree at the release head — 40 Solidity files, 31 contracts and 9 interfaces.

| # | contract | what it is | its tests |
|---|---|---|---|
| 1 | `OMR` | the token. Fixed genesis supply + a single owner-set `minter`; a four-way sell tax on transfers into registered AMM pairs, armed at zero | `Omerta.t.sol`, `OMRTax.t.sol` |
| 2 | `VoucherClaim` | the $OMR withdrawal bridge. EIP-712, nonce-replay-proof, deadline-bound, daily-capped, pausable, tranche-funded | `Omerta.t.sol` |
| 3 | `GearVault` | ERC-1155 gear. Mint gated to `VoucherClaim`, per-`gearId` supply cap, fail-closed at 0, one-at-a-time `redeem` | `GearVault.t.sol` |
| 4 | `OMRStaking` | pre-funded reward pool, APY ceiling, principal always withdrawable | `Omerta.t.sol` |
| 5 | `OmertaFees` | the inbound ETH tollbooth. Exact-fee, forwards in-tx, custodies nothing, monotonic nonce; carries `payForPackage` | `Omerta.t.sol` |
| 6 | `OmertaBond` | **the only mint.** Server-signed `BondQuote`, four walls (§2.1), four-way ETH split forwarded in-tx, linear vesting | `OmertaBond.t.sol` |
| 7 | `OmrTwapOracle` | legacy V2 arithmetic-price TWAP. Permissionless `update()`, bounded window, fail-closed | `OmrTwapOracle.t.sol` |
| 8 | `OmrV4TwapOracle` | ownerless canonical v4 geometric-tick TWAP. Samples the hook cumulative, bounded on both sides, preserves `IOmrOracle` | `OmrV4TwapOracle.t.sol`, `OmertaHook.t.sol` |
| 9 | `GenesisOracle` | a fixed-price `IOmrOracle` for a deliberately bounded pre-market window; not a perpetual live feed | `GenesisOracle.t.sol` |
| 10 | `OmertaHook` | the Uniswap v4 hook. LBP-only initialization, sell tax, anti-snipe window, impact surge, permissionless sweep, exact tick-time cumulative | `OmertaHook.t.sol`, `audit/OmertaHookObserverDoS.t.sol` |
| 11 | `GenesisProceedsSplitter` | ownerless CCA/LBP proceeds branch: revenue only after canonical pool initialization; failed-launch recovery only before it | `GenesisProceedsSplitter.t.sol` |
| 12 | `StreetDeed` | ERC-721 street deeds. Self-verifying EIP-712 mint, `tokenId = keccak(name)`, never-pausable `redeem`, default-ON transfer lock | `StreetDeed.t.sol` |
| 13 | `DynastyNFT` | ERC-721 identity. Self-verifying EIP-712 mint, no owner mint, EIP-2981 royalty — **and gates NOTHING on `balanceOf`** | `DynastyNFT.t.sol` |
| 14 | `StockTokenRegistry` | v1 Safe-curated tokenized-stock identity catalog and immutable closed-day family ballot | `RwaStockMachine.t.sol`, `audit/RwaStockMachineRedTeam.t.sol` |
| 15 | `StockTokenRegistryV2` | v2 registry — immutable Stock Token versions and exact closed-day ballot snapshots | `StockTokenRegistryV2.t.sol`, `StockTokenRegistryV2Invariant.t.sol`, `RwaHealthOverlay.t.sol` |
| 16 | `RwaStockBuyer` | paused-by-default, daily-capped adapter purchase bound to registry ballot, independent quote floor, StockVault delivery | `RwaStockMachine.t.sol`, `audit/RwaStockMachineRedTeam.t.sol` |
| 17 | `StockVault` | the stock distributor. **Never mints** — every delivery is a pre-held `SafeERC20.transfer`; authorization-bound, idempotent, per-token daily cap | `StockVault.t.sol`, `RwaStockMachine.t.sol` |
| 18 | `RwaHealthOverlay` | pure health/identity overlay over registry v2, with a cross-language vector suite | `RwaHealthOverlay.t.sol`, `RwaHealthOverlayFuzz.t.sol`, `RwaHealthOverlayInvariant.t.sol`, `RwaHealthIdentityVectors.t.sol` |
| 19 | `SettlementGasPool` | community-funded native-gas credits for successful settlements. Credits are exact pull-payment liabilities; contributors and owner acquire no withdrawal right over unreserved sponsorship | `SettlementGasPoolCore.t.sol`, `SettlementGasPoolConfig.t.sol`, `SettlementGasPoolMigration.t.sol`, `SettlementGasPoolInvariant.t.sol` |
| 20 | `AcquisitionVault` | O1 acquisition custody. EIP-712, `Ownable2Step`, pausable, reentrancy-guarded; the tightest deployable in the tree (§1c) | `AcquisitionVaultAccounting.t.sol`, `AcquisitionVaultOperator.t.sol` |
| 21 | `AcquisitionVaultCore` | the vault's reentrancy-guarded core, deployed by the constellation factory | the six constellation suites |
| 22 | `AcquisitionAuthority` | O1 authority. EIP-712, `Ownable2Step`, pausable, reentrancy-guarded; the largest contract in the tree at 1,148 lines | `AcquisitionAuthorityTask2.t.sol`, `AcquisitionAuthoritySnapshotTask2.t.sol`, the constellation suites |
| 23 | `AcquisitionConstellationFactory` | deploys the constellation from CALLDATA with raw `create` — see §1c for why a typed `new` is impossible here | the six constellation suites |
| 24 | `AcquisitionIntentExecution` | intent execution leg of the constellation | `AcquisitionConstellationTask5IntentIdentity.t.sol`, the constellation suites |
| 25 | `AcquisitionReconciliation` | reconciliation leg of the constellation | the six constellation suites |
| 26 | `PreVoteBudgetBook` | one immutable record per day, with no core or fund movement (its own invariant) | `AcquisitionConstellationTask4BudgetBook.t.sol`, the constellation suites |
| 27 | `Alchemist` | THE BANK — the DNR collateral market | `Bank.t.sol`, `audit/AlchemistRedTeam.t.sol` |
| 28 | `Transmuter` | THE BANK — the redemption side | `Bank.t.sol`, `audit/TransmuterFundingRedTeam.t.sol` |
| 29 | `Denari` | THE BANK — the DNR debt token | `Bank.t.sol` |
| 30 | `CollateralEscrow` | THE BANK — collateral custody | `Bank.t.sol` |
| 31 | `FlashGuard` | THE BANK — the flash-loan guard | `FlashGuard.t.sol`, `Bank.t.sol` |
| 32 | `IOmrOracle` | the interface all bond-price feeds implement — **interface, not a contract** | (implementations' tests) |
| 33 | `IInitializerHook` | the exact ERC-165 surface Liquidity Launcher's LBP strategy requires — **interface only** | `OmertaHook.t.sol` |
| 34 | `IOmrV4ObservationSource` | the exact ERC-165 cumulative source surface pinned by `OmrV4TwapOracle` — **interface only** | `OmrV4TwapOracle.t.sol`, `OmertaHook.t.sol` |
| 35 | `IAcquisitionAuthorityV2` | the authority surface the constellation pins — **interface only** | the constellation suites |
| 36 | `IAcquisitionIntentExecutionV2` | the intent-execution surface the constellation pins — **interface only** | the constellation suites |
| 37 | `IAcquisitionVaultV1` | the vault surface `AcquisitionVault` implements — **interface only** | the vault suites |
| 38 | `IRwaHealthOverlay` | the overlay surface `RwaHealthOverlay` implements — **interface only** | the overlay suites |
| 39 | `IStockTokenRegistryV2` | the registry surface the vault and overlay pin — **interface only** | registry v2 + overlay suites |
| 40 | `ISettlementDataFeeSource` | the data-fee source surface the gas pool pins — **interface only** | the gas-pool suites |

**896 Foundry tests across 43 suites, green** under **forge v1.7.1** at head `b0a214ca`, including
**19 parameterised 512-run fuzz** properties and **9 `invariant_` properties** across token, bond,
oracle, Bank, stock-delivery, hook, overlay, gas-pool and constellation surfaces.

**Deliberately NOT in the batch, and each for a reason:**
- **ERC-6551** (`test/vendor/ERC6551Registry.sol`, `ERC6551Account.sol`) — the reference
  implementation, **vendored unmodified from npm and never imported by `src/`**. Deploy config, not
  our code; it is in the tree only so the provers can stand a real registry up.
- **A merkle distributor** — there is none. The airdrop's delivery decision (D1) is in-game SIWE
  credit, so no distributor contract exists to review.
- **The off-chain EIP-712 signer** — in scope for gate 2 but not a contract; see §5.

### 1a. WHERE THE TESTS ACTUALLY ARE — the map, not the claim

`CHAIN-DEPLOY.md` states that every contract carries tests. That is true and it is useless to an
auditor trying to *find* them: **19 of the 31 contracts have no `<Name>.t.sol`** and are covered
inside a shared suite. Twelve have a dedicated suite; the rest are here.

| covered inside | contracts |
|---|---|
| `Omerta.t.sol` (53 tests) | `OmertaFees`, `VoucherClaim`, `OMRStaking`, and `OMR`/`GearVault` alongside their own suites |
| `Bank.t.sol` (45 tests) | `Alchemist`, `Transmuter`, `Denari`, `CollateralEscrow`, `FlashGuard` |
| `RwaStockMachine.t.sol` (19) + `audit/RwaStockMachineRedTeam.t.sol` (2) | `RwaStockBuyer`, `StockTokenRegistry` (v1) |
| the six constellation suites (188 tests total) | `AcquisitionAuthority`, `AcquisitionConstellationFactory`, `AcquisitionIntentExecution`, `AcquisitionReconciliation`, `AcquisitionVaultCore`, `PreVoteBudgetBook` |
| `AcquisitionVaultAccounting.t.sol` (38) + `AcquisitionVaultOperator.t.sol` (84) | `AcquisitionVault` |
| the four `SettlementGasPool*` suites (65) | `SettlementGasPool` |

The three thinnest cases were checked individually rather than assumed, because "it is referenced in
a shared suite" and "it is tested" are different claims: `OMRStaking` is constructed and exercised in
`Omerta.t.sol`; `RwaStockBuyer` and `StockTokenRegistry` v1 are both constructed in
`RwaStockMachine.t.sol` **with real revert-selector assertions** (`BallotAssetInactive`,
`TickerKeyMismatch`), not merely instantiated.

### 1b. WHAT COMPILES DIFFERENTLY, AND WHY IT MATTERS TO A REVIEWER

**Seven contracts and three interfaces compile under `via_ir`** — the whole Acquisition
constellation (`AcquisitionAuthority`, `AcquisitionConstellationFactory`, `AcquisitionVaultCore`,
`AcquisitionIntentExecution`, `AcquisitionReconciliation`), plus `PreVoteBudgetBook` and
`RwaHealthOverlay`. That is a different codegen pipeline from the rest of the tree, and a reviewer
should know which half of the batch they are reading bytecode for.

### 1c. THE SIZE MARGIN, AND THE ONE CONTRACT THAT CANNOT BE DEPLOYED THE OBVIOUS WAY

Measured from the CI `forge build --sizes` table at the release head. Runtime margins against
EIP-170's 24,576:

| contract | runtime | margin |
|---|---|---|
| `AcquisitionVault` | 23,212 | **1,364** |
| `AcquisitionAuthority` | 16,300 | 8,276 |
| `SettlementGasPool` | 14,458 | 10,118 |
| `StreetDeed` | 12,690 | 11,886 |

**`AcquisitionVault`'s INITCODE is 25,120 bytes — over EIP-170 by itself.** A typed
`new AcquisitionVault(...)` embeds that whole initcode in the *calling* contract's runtime code, so
any factory doing it is over the limit **by construction**, and no amount of trimming the factory
fixes it. That is why `AcquisitionConstellationFactory` deploys from CALLDATA with raw `create` plus
`returndatacopy` to bubble the constructor's revert. A reviewer should confirm the revert bubbling
and the absence of any typed-`new` path back.

Related, and structural: `forge build --sizes` is all-or-nothing, so one over-limit row fails the
step. It therefore runs as its **own step, last**, after `forge test` and both e2e provers, so a size
regression cannot skip the suites beneath it.

---

## 2. THE WALLS — what each one CLAIMS, so a reviewer can attack the claim rather than the code

The pre-O1 walls (§2.1–§2.6 of `CHAIN-AUDIT-PACKET.md`) are unchanged and are carried forward in
full; that document remains the long-form text for them. In brief, and then the new surfaces:

### 2.1 The mint: four walls, and the claim is that 3 and 4 COMPOSE rather than substitute
Tokenomics v2 step 4 **deleted the property every prior review of this suite rested on** — "nothing
mints". Bonds mint now. What replaced it: **(1)** `OMR.mint` is callable only by a single owner-set
`minter`, with **no owner mint path**, so "the Safe was compromised" and "supply was inflated" stay
two separate events and `setMinter(0)` is a one-transaction stop; **(2)** `OmertaBond.dailyCapOMR`
bounds the blast radius of a leaked quote-signer; **(3)** `MAX_DISCOUNT_BPS` (2000, compile-time);
**(4)** `maxOmrPerEth`, the post-discount mint-RATE ceiling, **fail-closed at 0**. Walls 3 and 4 are
checked independently in `bond()`, so a manipulated oracle should only ever TIGHTEN the bound.
**An auditor who reads the old sentence will review the wrong contract.**

*Recorded deviation, deliberate:* the literal reading of "accretive-only" forbids **every discounted
bond**, and treasury-backing accretion is unknowable in a contract that custodies nothing and
forwards every wei in-tx — an oracle on the mint path would put a feed between a leaked key and
unbounded supply. Wall 3 is therefore a hard Safe-set rate ceiling: weaker as economics, stronger as
a wall, and documented in-contract as a decision rather than an omission.

### 2.2 The oracles: fail-closed on four failure modes, bounded on BOTH sides
Unset / zero / stale / reverting all refuse; **there is no fallback price**, because "we do not know
what OMR costs" must never become "use the default". The window is bounded at both ends: an interval
longer than `PERIOD × MAX_WINDOW_MULT` is **DISCARDED, not averaged**, and the oracle re-baselines
and reports "no usable reading" — a multi-day interval closed one second ago is one second old by a
staleness check and four times spot in substance.

### 2.3 The v4 hook: three claims worth attacking directly
**(a)** `beforeInitialize` reverts unless one side is OMR and the other a Safe-approved quote —
without it a stranger creates an (OMR, WORTHLESS) pool naming this hook and emits a genuine
`SellTaxTaken` with a genuine tx hash, i.e. **fabricated revenue wearing the exact credential the
backend's anti-fabrication gate trusts**. **(b)** The fee ACCRUES and is swept separately rather than
forwarded in-tx, because three pushes inside a swap means one reverting recipient **bricks the pool**;
`sweep` is permissionless and pays only Safe-set recipients. **(c)** The contract deliberately has
**no pause**, so the claim is that no configuration can halt the canonical pool.

### 2.4 The NFTs: the split that makes them safe to trade
The game entitlement (`account_persistent.minted`) is account-bound **off-chain**; `DynastyNFT` gates
nothing on `balanceOf`. `StreetDeed.redeem` is **never pausable** — a paused contract must not trap a
holder's asset — and the transfer lock is default-ON with owner-only unlock (an approved marketplace
operator deliberately cannot unlock, because operator-unlock *is* the drain vector).

### 2.5 `StockVault`: the wall is physical
Never mints; every delivery is a pre-held `SafeERC20.transfer`, so `balanceOf(this)` per token is the
physical half of `allocated ≤ held` and the ERC-20 itself reverts on over-delivery. Keeper-only,
idempotent on `deliveryId`, per-token daily cap with a `defaultDailyCap` so a newly-added ticker is
not the one a leaked keeper drains in a block. **§3.3's delivery is a gateless push**, so the ADDRESS
is the only thing between the treasury and a permanent loss.

### 2.6 Ownership, pausing and the shared key
Sixteen contracts inherit `Ownable2Step`; the renounce hatch ("freeze the configuration forever")
survives, since `Ownable2Step` overrides `transferOwnership` and `_transferOwnership` but never
`renounceOwnership`. **One `VOUCHER_SIGNER_PK` signs four contracts**, so its blast radius is the SUM
of four daily caps; every signer-bearing contract takes its cap as a **constructor argument** (0 is
still legal and still means unlimited — the point is to force a DECISION at deploy, not a number),
and `CHAIN-DEPLOY.md` carries the ordered rotation runbook. The pause matrix's claim is that **no
contract can be paused into a state where value is unreachable by anybody**.

### 2.7 THE O1 CONSTELLATION AND THE NEW SURFACES — what is new since the frozen packet

These have had no external review at all, and two of them are the largest contracts in the tree.

- **`AcquisitionVault` / `AcquisitionVaultCore` / `AcquisitionAuthority` / `AcquisitionIntentExecution`
  / `AcquisitionReconciliation` / `AcquisitionConstellationFactory` / `PreVoteBudgetBook`** — the O1
  acquisition constellation, 3,591 lines, deployed as a unit by a raw-`create` factory (§1c), most of
  it compiled under `via_ir`. `AcquisitionVault` and `AcquisitionAuthority` are both EIP-712 +
  `Ownable2Step` + `Pausable` + `ReentrancyGuard`, so §2.6's pause claim and §5's domain-separation
  claim both extend here and should be re-checked rather than assumed to inherit.
- **`SettlementGasPool`** — the claim in its own words: *"Credits are exact pull-payment liabilities.
  The immutable gameplay vault records them; contributors and the owner acquire no withdrawal right
  over unreserved sponsorship."* It carries six invariants asserting exactly that
  (`invariant_balance_always_backs_outstanding_credits`,
  `invariant_unreserved_is_exact_balance_minus_liability`, and four ghost-conservation properties).
  Attack the claim that **no path lets a contributor or the owner reach reserved credit**.
- **`StockTokenRegistryV2` + `RwaHealthOverlay`** — an immutable version catalog with exact
  closed-day ballot snapshots, and a pure overlay over it with a cross-language vector suite. The
  overlay is pure, so the reviewable question is whether the *identity* it computes can disagree with
  the backend's, which is a parity question (§4) rather than a solvency one.

---

## 3. WHAT IS ALREADY PROVEN, AND BY WHAT — the four provers

An auditor's time is best spent where nothing we can run reaches. These four are what we can.

| prover | what it stands up | what it PROVES |
|---|---|---|
| `forge test` | the Foundry VM under **pinned forge v1.7.1** | **896 tests / 43 suites**, incl. 19 parameterised 512-run fuzz properties and 9 invariants. Unit + property behaviour of every contract |
| `npm run chain-e2e` | a real EVM, the REAL backend booted against it | 27 asserted steps: deploy → SIWE link → a real on-chain fee → the watcher crediting it → mint → **a real EIP-712 voucher claimed for 25 real ERC-20 OMR** → replay REVERTS → tampered voucher REVERTS → the watcher closing the reserve exact → a gear voucher minting the ERC-1155 → an UNCAPPED gearId failing closed even with a valid signature |
| `npm run dexbot-e2e` | a **real Uniswap v4** — real `PoolManager`, real liquidity, real swaps, behind the real `OmertaHook` at a mined permission address | 23 asserted steps with both bots' senders **UNSEAMED**, so `src/dexbot.js`'s own encoders build the calldata that executes. This is what closed the ⚠ on the raw v4 encodings |
| `npm run stock-e2e` | the real ERC-6551 registry (vendored reference impl) + StreetDeed + StockVault | 14 asserted steps: a deed minted from a server-signed voucher, **the backend's computed TBA equal to the registry's own answer**, units landing in it, the keeper sending but never settling, the `Delivered` log flipping the allocation |

**The residual is the same shape for all three e2e provers and is stated rather than smoothed over:
each prover CONFIGURES the thing it then checks against.** So a wrong `DEX_POOL_FEE` /
`DEX_POOL_TICK_SPACING`, or a wrong `ERC6551_REGISTRY` / `_ACCOUNT_IMPL` / `_SALT`, is a **config
error no prover can see**. Resolve one real deed's TBA against the live registry by hand, and do one
small live swap and pairing, before the first real value moves.

**A second residual, now narrower than it was:** the sandboxed runner compiles through a solc-js shim.
CI does not — the figures in §0 are from the pinned CI toolchain — but a third-party review should
still re-run with native solc and confirm the count and the size table match §0 and §1c.

---

## 4. WHAT THE BACKEND OWES THE CONTRACTS — the parity surface

Several walls are only as good as an off-chain value that must agree with an on-chain one. These have
their own crossing check (`chainParity`, hourly, alarming through the same channel as a §10.4 drift),
and an auditor should understand that they exist rather than re-deriving them:

- **`OmertaFees.vigBps`** — `MintFeePaid` carries the gross ALONE, so the backend DERIVES the share.
  A divergence directly mis-books the withdrawal reserve's funding source, and **every downstream
  check sums correctly because they all descend from the same restated number.**
- **`OmertaBond`'s four immutable bps** — event-authoritative, so the accounting is safe; a divergence
  moves only the declared waterfall.
- **`OmertaFees.mintFee` / `respawnFee`** — these MOVE at a published tranche boundary, and a
  stale-cheap copy makes $OMR the cheaper rail at a price nobody chose.
- **`VoucherClaim.dailyCapOMR`** — the backend refuses a withdrawal whose NET exceeds it *precisely so
  it never signs a voucher `claim()` will reject forever*; a stale-HIGH copy signs exactly that
  voucher and the player's $OMR is burned and stranded until the reclaim sweep.
- **The sell tax on both layers** — all four slices are DERIVED from levers, so a divergence mis-books
  the treasury's stock budget and the family-buyback inflow at once.

**A same-typed adjacent event-parameter swap is invisible to a type comparison** (`Bonded` has six
adjacent non-indexed `uint256`), so the backend event signatures are crossed against the contracts'
declarations on type, indexed-ness AND positional name (`test/gates.js` THE ABI LEDGER). viem decodes
positionally, so a rename on one side alone yields `undefined` → NaN silently.

---

## 5. THE SIGNER IS IN SCOPE, AND IT IS NOT A CONTRACT

Gate 2 is "a third-party audit of the contracts **AND the signer**". The off-chain half:

- **Four EIP-712 domains, all distinct** (`OmertaVoucherClaim`, `OmertaBond`, `OmertaStreetDeed`,
  `OmertaDynasty`), each with its own `verifyingContract` and nonce space. Parity between the signer
  and each contract is asserted in-suite by **recovering against a HARDCODED domain literal mirroring
  the contract**, never against the same helper the server signs with — that version was vacuous and a
  domain-name mutation survived it. **The O1 constellation adds two more EIP-712 contracts
  (`AcquisitionVault`, `AcquisitionAuthority`); their domain separation should be checked the same
  way rather than assumed.**
- **`assertChainId`** compares `CHAIN_ID` to the RPC's real `getChainId()` and refuses to sign on a
  mismatch, in BOTH the API (which signs) and the worker.
- **The full-reserve queue**: a withdrawal signs only if `signedOutstanding + amt ≤ funded_omr`, else
  it is debited-but-unsigned and queued. Extraction ≤ inflow holds by construction.
- **The comp/`txHash` posture ladder** — every real-value ingest refuses to book revenue for a call
  that carries no transaction hash, because fabricated revenue buys real-looking backing and is
  invisible to the very check meant to catch it. Two unbounded-mint holes in the BACKEND keepers were
  found this way on 2026-08-12 (`AUDIT-family-buyback.md`) *after* they shipped with green tests and
  passing invariants. That is precisely the class an external reviewer exists to catch on the contract
  side, where it cannot be patched after the fact.

---

## 6. THE PROPERTIES TO ATTACK — a starting list, not a limit

1. **Can anything mint OMR other than `OmertaBond` calling `OMR.mint` under all four walls?** This is
   the single most load-bearing claim in the suite, and the property it replaced was "nothing mints".
2. **Do walls 3 and 4 COMPOSE?** They are checked independently in `bond()`, so a manipulated oracle
   should only ever TIGHTEN the bound. Confirm that.
3. **Can a stranger's pool emit a credible `SellTaxTaken`?** (`beforeInitialize`, §2.3a.)
4. **Can any configuration halt the canonical pool?** (§2.3c — the claim is no.)
5. **Can a paused contract trap a holder's asset?** (§2.6 — the claim is no, on every one, and the two
   new O1 pausable contracts have never been checked against it externally.)
6. **Can `StockVault` deliver to an address the treasury did not intend**, or more units than it holds?
7. **Can a voucher signed for one contract be replayed at another** given one shared signer key — now
   across **six** EIP-712 domains rather than four?
8. **Can `sweep` (hook) or `sweepETH` (bond) reach value that backs an outstanding obligation?**
9. **`StreetDeed`'s burn→re-mint cycle**: a burned deed's ERC-6551 account still exists and still holds
   whatever was in it. Re-import → in-game sale → re-extract hands the buyer that vault. Flagged, not
   fixed; the in-game market discloses what was DELIVERED (never a balance — the game cannot see what
   remains). Worth a reviewer's view on whether the disclosure is the right answer.
10. **The ERC-6551 address derivation** — the one input no prover can validate (§3).
11. **`SettlementGasPool`'s pull-payment claim** — can any path let a contributor or the owner reach
    reserved credit, or leave `unreserved` disagreeing with `balance − liability`? (§2.7.)
12. **The constellation's raw-`create` factory** — does it bubble the constructor's revert faithfully,
    and is there any path that reintroduces a typed `new` (which would put it over EIP-170 again)?
13. **`via_ir` vs the rest** — seven contracts compile through a different pipeline (§1b). Confirm the
    reviewed bytecode is the deployed bytecode for both halves.

---

## 7. WHAT THIS PACKET FOUND ABOUT ITSELF

Two things measured while assembling it, both a reviewer's problem rather than a defect:

- **Eight of the 40 source files carry no `@title` and no `@notice` at all** —
  `AcquisitionAuthority`, `AcquisitionVault`, `AcquisitionVaultCore`,
  `AcquisitionConstellationFactory`, `AcquisitionIntentExecution`, `AcquisitionReconciliation`,
  `PreVoteBudgetBook`, `RwaHealthOverlay`. That is **3,776 of 10,675 lines**, including the two
  largest contracts in the tree. This project's own rule from RT#9 is that **the NatSpec IS the spec
  for an audit batch**: a contract with no stated intent is one an auditor must infer intent for, and
  an inferred intent cannot be contradicted. Documenting these before the engagement is the cheapest
  quality improvement available to it.
- **The three-document count disagreement** described in §0. Fixed here; the guard in `test/docs.js`
  now holds this packet's figures to the tree and to the workflow's pin, so it cannot recur silently.

---

## 8. WHAT IS OUT OF SCOPE FOR THIS GATE

- **Gate 3, the launch review** — a separate thing entirely, and cleared. Do not conflate them.
- **Gate 4, Uniswap Labs routing approval** — a separate submission, pending mainnet deploy and
  explorer verification.
- **The economics** — every lever is a founder sign-off item recorded in `BALANCE.md`; a reviewer is
  welcome to comment, but a "the APY is too high" finding is not what blocks mainnet here.
- **The in-game §10.4 conservation set** — audited continuously by `invariants.js` and a nightly
  sweep, and structurally separate: the chain layer writes ZERO `transactions` rows.

**Mainnet is blocked on gates 1 + 2 + 3 (+ 4 for hook routing). Nothing on the deploy checklist
should be armed until gate 2 clears.**
