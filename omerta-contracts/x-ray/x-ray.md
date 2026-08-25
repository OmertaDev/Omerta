# X-Ray Report

> OMERTA | 1,952 in-scope nSLOC | `dee7593` (`codex/site-copy-ui-upgrade`) | Foundry / Solidity 0.8.26 | 24/08/26

> **Scope-drift addendum:** This structural snapshot was generated before the untracked
> `StockTokenRegistry.sol` and `RwaStockBuyer.sol` files appeared in the worktree later
> on 24/08/26. Both contracts, `test/RwaStockMachine.t.sol`, and the still-later
> `script/DeployRwaStockMachine.s.sol` were added to the manual, unit-test, static-analysis,
> and deployment-boundary audit scope; they are not included in the 1,952 nSLOC count or
> the diagrams below. No deployed-address mapping was found for either production contract.

---

## 1. Protocol Overview

**What it does:** A multi-rail game economy combines a taxed OMR token, signed asset/voucher issuance, ETH bond sales, staking, treasury delivery, a denomination-matched DNR bank, and a Uniswap v4 tax hook.

- **Users**: Players deposit collateral, borrow/redeem DNR, bond ETH for vested OMR, stake OMR, claim signed assets, and pay game fees.
- **Core flow**: Off-chain authorities sign bounded EIP-712 entitlements while on-chain contracts enforce replay, rate, supply, and daily caps.
- **Key mechanism**: Per-user ERC-4626 escrows and tracked redemption reserves avoid pooled share accounting for the DNR bank.
- **Token model**: OMR is a capped-mint-role ERC-20 with configurable sell tax; DNR is the bank's 18-decimal debt/redeem token; Gear is ERC-1155 and identity assets are ERC-721.
- **Admin model**: OpenZeppelin two-step ownership is intended for a Safe; signer, keeper, minter, burner, and funder roles are separately configurable and immediate.

For a visual overview, see the [architecture diagram](architecture.svg).

### Contracts in Scope

| Subsystem | Key Contracts | nSLOC | Role |
|---|---|---:|---|
| DNR Bank | Alchemist, CollateralEscrow, Denari, Transmuter, FlashGuard | ~650 | Collateral custody, debt issuance, repayment/harvest, and reserve redemption |
| OMR Monetary | OMR, OMRStaking, OmertaBond, GenesisOracle, OmrTwapOracle | ~520 | Token issuance/tax, rewards, ETH bonding, and rate ceilings |
| Signed Assets | VoucherClaim, GearVault, StreetDeed, DynastyNFT | ~430 | EIP-712 OMR/gear/NFT claims and lifetime/daily caps |
| Market & Treasury | OmertaHook, OmertaFees, StockVault | ~352 | v4 tax/launch controls, ETH fee forwarding, and capped inventory delivery |

### Backwards-Compatibility Code

- `OMR._update` sell-tax path — retained for registered legacy AMM pairs while the v4 hook handles fee-on-swap pools; both surfaces remain active for their configured venues.

### How It Fits Together

The core trick: economic entitlements originate off-chain or in external yield/market systems, while immutable dependencies and hard on-chain walls bound what can be issued or released.

### DNR collateral and redemption

```text
Alchemist.deposit(assets, minSharesOut)
├─ CollateralEscrow created per user
└─ exact asset receipt → CollateralEscrow.deployToVault() → measured ERC4626.deposit() shares
   *principal and same-block entry stamp update*
next block → Alchemist.mint() → Denari.mint()
   *per-user LTV and flow limits; buffer checked before and after supply expands*
Alchemist.repay()/harvest() → Transmuter.fund()
Transmuter.redeem() → Denari.burn() + reserve asset transfer
```

### ETH bond issuance

```text
backend-signed BondQuote → OmertaBond.bond()
├─ GenesisOracle/OmrTwapOracle.consult()
├─ OMR.mint(OmertaBond)
└─ ETH forwarded to four configured recipients
   *quote digest, rate ceiling, and daily issuance recorded first*
vesting time → OmertaBond.claim() → OMR transfer
```

### Signed game assets

```text
backend-signed voucher → VoucherClaim.claim()
├─ prefunded OMR transfer
└─ GearVault.mint()
   *both claim-layer and vault-layer caps apply*
backend-signed deed/dynasty voucher → ERC721 mint
```

### v4 swap fees

```text
PoolManager.beforeSwap() → OmertaHook.beforeSwap()
├─ opening guard
└─ transient pre-price snapshot
PoolManager.afterSwap() → OmertaHook.afterSwap()
├─ observer callback
├─ base/opening/surge fee calculation
└─ PoolManager.take() + owed-recipient accounting
permissionless OmertaHook.sweep() → fixed recipients
```

---

## 2. Threat & Trust Model

### Protocol Threat Profile

> Protocol classified as: **Hybrid lending/issuance protocol** with **signed-distribution, staking, oracle, and AMM-hook** characteristics

The highest-value state crosses contract boundaries: collateral valuation and reserve backing govern DNR, oracle interpretation governs OMR issuance, signatures govern claims, and PoolManager callback deltas govern swap taxation.

### Actors & Adversary Model

| Actor | Trust Level | Capabilities |
|---|---|---|
| Protocol Safe / owner | Trusted | Immediate parameter, signer, role, recipient, pause, cap, oracle, pair/exemption, and inventory sweep powers; no on-chain timelock |
| Voucher/bond signers | Bounded (hard caps and replay walls) | Authorize recipients, amounts, deadlines, metadata, vesting, and bond rates within contract limits |
| Stock keeper | Bounded (inventory and daily caps) | Selects delivery token, recipient, amount, and unique ID from pre-held balances |
| DNR minter/burner/funders | Bounded (singular/allowlisted roles) | Expand or destroy DNR and credit reserve accounting through configured rails |
| v4 PoolManager | Trusted immutable dependency | Sole caller of stateful hook lifecycle and swap callbacks |
| ERC-4626 vault / reserve tokens | Trusted immutable dependencies | Determine share-to-asset collateral value and token transfer behavior |

**Adversary Ranking**

1. **Compromised signer or backend** — can exercise every signed entitlement up to hard on-chain walls and choose timing/recipients.
2. **Atomic economic attacker** — can compose bank, token, oracle, and AMM actions around same-block and flow limits.
3. **Callback/reentrancy actor** — can exploit ERC token, ERC-721/1155 receiver, v4 callback, or configured observer control flow.
4. **Compromised operational role** — keeper, minter, burner, or funder may abuse its narrower but value-moving authority.
5. **Configuration/deployment error** — immutable token, vault, oracle, pair, recipient, and exemption choices can invalidate economic assumptions.

See [entry-points.md](entry-points.md) for the full permissionless entry point map.

### Trust Boundaries

- **Safe boundary** — two-step ownership protects handoff but operational actions execute immediately; `OMR.setMinter` and `OmertaBond.setOracle` are among the largest blast-radius calls (`OMR.sol:125`, `OmertaBond.sol:258`).
- **Backend signature boundary** — replay and daily/lifetime caps limit issuance, but signed payloads still define destination and economic amount (`VoucherClaim.sol:113-153`, `OmertaBond.sol:294-368`).
- **External vault boundary** — immutable asset matching is checked, but the vault's conversion and withdrawal behavior define collateral value and liveness (`Alchemist.sol:147-163`, `CollateralEscrow.sol:71-96`).
- **v4 callback boundary** — only PoolManager may call stateful hooks, while an owner-configured observer receives control mid-afterSwap (`OmertaHook.sol:246-249`, `477-613`).
- **Token configuration boundary** — OMR pair/exemption settings are instant and shared by staking, bonds, vouchers, and liquidity operations (`OMR.sol:146-205`).

### Key Attack Surfaces

- **Observer isolation (resolved)** &nbsp;[[I-16](invariants.md#i-16), [X-6](invariants.md#x-6)] — `afterSwap` now emits an observation request without yielding control; the bounded external call occurs only through `pokeObserver` after settlement.

- **Reserve credits measure exact token receipt (resolved)** &nbsp;[[X-1](invariants.md#x-1), [E-2](invariants.md#e-2)] — `Transmuter.fund` compares the physical balance delta with the requested amount and atomically rejects fee-on-transfer funding.

- **Staking credits nominal taxed-token amounts** &nbsp;[[I-7](invariants.md#i-7), [X-2](invariants.md#x-2), [E-3](invariants.md#e-3)] — `OMRStaking.stake:80-87` assumes receipt equals input; trace deployment pair/exemption configuration and future pair changes.

- **Oracle counterasset identity is deployment-enforced** &nbsp;[[X-5](invariants.md#x-5), [E-4](invariants.md#e-4)] — `OmrTwapOracle.constructor:62-92` verifies OMR membership but not WETH identity; confirm script/config and post-deploy verification bind the denomination.

- **ERC-4626 execution remains a dependency boundary** &nbsp;[[X-3](invariants.md#x-3)] — collateral is now valued through fee-aware `previewRedeem`, deposits enforce a caller share floor, and harvest rechecks post-state LTV; the chosen vault still requires independent review for losses and non-standard behavior.

- **DNR supply invariant wording versus reserve lifecycle** &nbsp;[[I-2](invariants.md#i-2), [E-1](invariants.md#e-1)] — `Alchemist:37-39` states supply against collateral alone while repayment moves debt into reserves; reconcile the documented and executable system-wide conservation law.

- **Signer/cap state changes are immediate** &nbsp;[[I-11](invariants.md#i-11), [I-12](invariants.md#i-12)] — voucher and NFT contracts permit instant signer, cap, pause, and metadata changes; trace already-signed payloads across rotations and cap reductions.

- **Burn/remint identity metadata lifecycle** &nbsp;[[I-17](invariants.md#i-17)] — `StreetDeed.redeem:194-202` permits a name-derived ID to be claimed again with a fresh district field; confirm intended canonical identity semantics.

- **Hook exact-output launch behavior** — `OmertaHook._guardOpening:450-475` blocks exact-output buys during the opening window even when max-buy is the documented disabled value; confirm launch liveness expectations.

- **Reference-only hook settlement draft** — `reference/OmertaTradeFeeHook.sol` takes currency in `afterSwap` without returning the corresponding hook delta; prevent this noncompiled draft from being promoted into deployment code.

### Protocol-Type Concerns

**As a lending/issuance protocol:**

- `Alchemist.maxDebtOf:253-255` and `Transmuter.redeem:164-182` use floor rounding in opposite asset/debt decimal domains; exercise dust and near-cap transitions.
- `Alchemist.harvest:353-412` changes collateral, debt, fee accrual, and reserves in one permissionless flow; verify the compatible LTV/fee bound under vault loss and yield edge cases.

**As a signed-distribution protocol:**

- Voucher domains bind chain and contract through EIP-712, while signer rotation invalidates all outstanding signatures without an epoch; test operational rotation and replay boundaries.
- Daily caps use block timestamps and zero-as-unlimited semantics in several contracts; deployment configuration, rollover edges, and differing fail-open/fail-closed defaults require explicit checks.

### Temporal Risk Profile

**Deployment & Initialization:**

- Core contracts deliberately deploy unarmed; role wiring, reserve seeding, signer/cap setup, exemptions, recipient configuration, oracle maturation, and hook initialization are separate privileged transactions (`script/Deploy*.s.sol`).
- `OmrTwapOracle` has no price until one full period and `update`, while `GenesisOracle` expires by time; the handoff must avoid a bond issuance gap (`OmrTwapOracle.sol:107-159`, `GenesisOracle.sol:79-91`).

**Market Stress:**

- Flow meters use per-block and rolling-reset daily counters with zero-as-unlimited controls; timestamp rollover and block-cap behavior should be fuzzed at exact boundaries (`FlashGuard.sol:101-132`).

### Composability & Dependency Risks

**Dependency Risk Map:**

> **External ERC-4626 vault** — via `CollateralEscrow.deployToVault/withdraw/totalAssets`
> - Assumes: exact compatible asset, reliable conversion, available withdrawals, and intended donation/loss behavior
> - Validates: immutable `vault.asset()` match
> - Mutability: external; upgradeability depends on chosen deployment
> - On failure: bank deposit/withdraw/harvest reverts or collateral value changes

> **Reserve ERC-20** — via `Transmuter.fund/redeem`
> - Assumes: requested transfer amount equals received/sent amount and decimals remain stable
> - Validates: decimals at construction; uses SafeERC20
> - Mutability: external token governance may retain blocklist/upgrade powers
> - On failure: transfer reverts or reserve ledger diverges

> **Uniswap v4 PoolManager** — via `OmertaHook` callbacks and `take`
> - Assumes: canonical callback ordering, delta semantics, and transient-storage transaction scope
> - Validates: immutable caller address and hook permission bits
> - Mutability: immutable address
> - On failure: pool unlock/swap reverts

> **Uniswap-v2-compatible pair** — via `OmrTwapOracle.update`
> - Assumes: OMR/WETH reserves and cumulative-price semantics
> - Validates: pair contains OMR; nonzero reserves during update
> - Mutability: immutable address, mutable market state
> - On failure: update reverts or consult remains unavailable/stale

**Token Assumptions:**

- OMR protocol integrations assume 1:1 transfers. That is true for ordinary OMR transfers, but the
  Safe must never register a protocol receiver (staking, bond, claim, or treasury rail) as an AMM
  pair; protocol addresses should also remain explicitly tax-exempt in the production checklist.
- `Alchemist.deposit` and `Transmuter.fund` measure exact balance deltas and reject fee-on-transfer
  input. `CollateralEscrow` measures the actual ERC-4626 share delta rather than trusting a return
  value. The configured reserve asset and vault remain trusted, immutable dependencies: rebases,
  blocklists, upgrades, changed decimals, or a transfer fee on the outbound redemption leg can still
  change availability or what a recipient ultimately receives.
- `RwaStockBuyer` measures the StockVault's actual post-trade token delta and enforces the stronger
  of keeper and independent-oracle minimum output. `StockVault` then transfers exact nominal units
  with `SafeERC20`; therefore the Safe-curated stock registry must exclude fee-on-transfer, rebasing,
  callback-bearing, or otherwise non-standard delivery tokens unless a new adapter/vault review
  explicitly models them.
- OMR and Denari passed Slither's ERC-20 and ERC-2612 interface/event checks. Their permit support is
  the OpenZeppelin implementation; integrations still carry the normal ERC-20 allowance-replacement
  race and should use permit, allowance deltas, or zero-first/`forceApprove` patterns as appropriate.
- OMR has one role-gated bond mint path and a bounded sell-tax hook; Denari has singular, fail-closed
  minter and burner roles and no tax, rebase, blacklist, pause, or proxy surface. Neither contract is
  upgradeable. No deployed-address holder/concentration analysis was possible because production
  chain execution is deliberately unconfigured and dormant.

**Shared State Exposure:**

- OMR pair registration affects token-level taxation across all callers, while v4 pools additionally apply hook-level fees; venue configuration determines which mechanism is active.
- The TWAP pair is publicly tradeable and shared with all market participants; the minimum period reduces but does not eliminate liquidity-dependent manipulation cost.

---

## 3. Invariants

> ### Full invariant map: **[invariants.md](invariants.md)**
>
> - **24 Enforced Guards** (`G-1` … `G-24`)
> - **17 Single-Contract Invariants** (`I-1` … `I-17`)
> - **6 Cross-Contract Invariants** (`X-1` … `X-6`)
> - **4 Economic Invariants** (`E-1` … `E-4`)
>
> Every inferred block cites concrete source structure; On-chain=No blocks are investigation leads, not automatically confirmed vulnerabilities.

---

## 4. Documentation Quality

| Aspect | Status | Notes |
|---|---|---|
| README | Present | Root README plus contract-specific CLAUDE/DEPLOYMENT guidance |
| NatSpec | Thorough | Security assumptions, cap semantics, and trust decisions are unusually explicit; some global claims need system-level reconciliation |
| Spec/Whitepaper | Present | SPEC.md, CHAIN-DEPLOY.md, LAUNCH-READINESS.md, and subsystem design documents |
| Inline Comments | Thorough | Dense rationale helps review but occasionally makes an intended property sound stronger than its code-level enforcement |

---

## 5. Test Analysis

| Metric | Value | Source |
|---|---:|---|
| Test files | 14 | File scan |
| Passing tests | 319/319 | `forge test --fuzz-runs 512` normal build |
| Line coverage | Core files mostly 77.78–100%; aggregate 72.28% includes scripts/dependencies | `forge coverage --ir-minimum` |
| Branch coverage | Core files 10–100%; aggregate 36.25% includes scripts/dependencies | `forge coverage --ir-minimum` |

### Test Depth

| Category | Count | Contracts Covered |
|---|---:|---|
| Unit/integration tests | 319 passing | All 18 source files through 14 suites |
| Stateless fuzz | 11 | Bank, token tax, oracle/bond and selected asset paths |
| Stateful fuzz (Foundry) | 0 | None at acquisition time |
| Stateful fuzz (Medusa/Echidna) | 0 | No harness/config at acquisition time |
| Formal verification | 0 | None |

Coverage instrumentation passed 318/319 tests; one stale-timestamp bond assertion failed only under `--ir-minimum`, while the same suite passes under the configured compiler pipeline.

### Gaps

- No pre-existing stateful invariants exercise cross-contract reserve, debt, staking-liability, cap, signer-rotation, or hook callback sequences.
- No fork tests validate the selected ERC-4626 vault, reserve token controls, Safe deployment, or canonical Uniswap deployments.
- No formal properties cover the math-heavy issuance, vesting, index, and multi-decimal accounting paths.

---

## 6. Developer & Git History

> Repo shape: normal development — 36 source-touching commits across 43 days on analyzed branch `codex/site-copy-ui-upgrade` at `dee7593`.

### Contributors

| Author identity | Share of source additions |
|---|---:|
| crvydev | 44.4% |
| CRVYDEV | 29.5% |
| OmertaDev | 26.1% |

These may be aliases for one developer; identity consolidation could not be confirmed from git metadata alone.

### Review & Process Signals

- 97.2% of source-touching commits co-modified tests; no fix-scored source commit lacked tests in the analyzed history.
- Average source-touching commit size is 122.7 changed lines, with several focused red-team/fix commits and several large feature introductions.

### File Hotspots

- `OmertaHook.sol` has repeated late security-oriented changes after its 419-line introduction and remains the highest callback/integration hotspot.
- `Alchemist.sol`, `OmertaBond.sol`, `OmrTwapOracle.sol`, and signed-asset contracts also show focused guard/accounting changes with accompanying tests.

### Security-Relevant Commits

- `75bab0b` — runtime guards, access, signature, transfer, and accounting changes across Alchemist/GenesisOracle/OmertaBond.
- `5f1dc68` and `1583187` — fee double-credit and withdrawal/fee-split hardening in OmertaFees.
- `06cfeab` — TWAP clamp and period-bound fixes.
- `16a74ee` — late correction for retroactive staking APY repricing.

### Dangerous Area Evolution

- 23 source commits landed in the last 30 days; 22 co-modified tests, and the only exception introduced the initial FlashGuard design rather than a production mutation.
- Hook, bank, NFT, oracle, and staking code all changed late enough to warrant regression-oriented stateful fuzzing before deployment.

### Forked Dependencies

- No locally forked dependency was detected by git analysis; OpenZeppelin and Uniswap code are vendored/imported through Foundry libraries.

### Technical Debt Markers

- Automated TODO/FIXME scan found no source markers; deployment checklists rather than inline debt tags carry most deferred operational work.

### Security Observations

- Strong test co-change is positive but does not substitute for stateful, fork, or adversarial callback coverage.
- Security-themed fixes cluster around precisely the trust boundaries with the largest economic blast radius.

### Cross-Reference Synthesis

- Late repeated hook work aligns with the observer/transient-state callback surface in Section 2.
- Recent staking and bank changes align with the nominal-transfer and cross-contract conservation invariants in `invariants.md`.
- Oracle clamp history aligns with the deployment-only counterasset and maturation checks.

---

## Post-Sweep Verification Addendum — 25/08/26

The release sweep expanded the scope after the structural snapshot above:

- Foundry 1.7.1 compiled the full Solidity tree with solc 0.8.26 and passed **352/352 tests
  across 20 suites**, including the RWA Stock Machine, four red-team regression suites, the
  existing 512-run stateless fuzz cases, and the new stateful/property harness.
- `forge build --sizes --skip FuzzTester` passed. `FuzzTester` is the synthetic all-handler
  Medusa/Echidna target and is never deployed; every production and ordinary test contract remains
  inside the EIP-170 size gate.
- Echidna and Medusa configurations plus their shared handler/property harness are now checked in.
  The targeted properties run through Foundry in this environment; long-running Echidna/Medusa
  campaigns remain a separate release operation.
- Slither completed successfully and produced the machine-readable detector, inheritance,
  variable/authorization, function-summary, ERC-20/ERC-721/ERC-1155, and ERC-2612 reports in this
  directory. OMR and Denari passed every ERC-2612 function, return-type, view, and event check.

### Slither High-Signal Triage

Slither reported three High/Medium heuristic signals. Manual review found no unresolved High issue:

1. `RwaStockBuyer._acquire` / `arbitrary-send-eth` — the destination is an owner-selected adapter,
   not caller input; stock output is forced to the immutable `stockVault`, measured by balance
   delta, bounded by the independent oracle floor, and protected by pause, daily-cap, one-shot,
   effects-before-interaction, and `nonReentrant` gates.
2. `RwaStockBuyer._acquire` / `reentrancy-balance` — the public entry point is `nonReentrant`, and
   the purchase latch plus daily spend are written before the adapter call. Adapter or output
   failure reverts those effects atomically.
3. `OmrTwapOracle._currentCumulativePrices` / `weak-prng` — the flagged modulo operation is the
   canonical 32-bit timestamp wrap used for cumulative-price elapsed time; it is not randomness.

The Medium `Alchemist.harvest` reentrancy signal is likewise covered by `nonReentrant`; the
post-withdraw collateral invariant is intentionally checked after the ERC-4626 share burn. The
remaining medium/low reports are arithmetic-order, strict-equality, timestamp, role-disable, and
ignored-return heuristics whose relevant boundary behavior is pinned by the unit, fuzz, and
red-team suites. This triage does not relax the existing third-party-audit and deployment-review
gates for real adapters, vaults, oracles, multisig ownership, and mainnet addresses.

---

## X-Ray Verdict

**Tier: High complexity / elevated integration risk.** The contracts are non-upgradeable, heavily documented, and backed by a broad passing unit suite, but value safety depends on several external systems and immediate trust roots whose assumptions are not all enforced locally. The highest-priority audit work is stateful cross-contract conservation, v4 callback nesting, exact-transfer token configuration, ERC-4626 valuation behavior, oracle denomination/deployment parity, and signed-authorization lifecycle testing before any production arming.
