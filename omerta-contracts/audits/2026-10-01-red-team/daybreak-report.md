# Defensive red-team report

## Scope

Reviewed repository HEAD `e56cf576065c5f1bbb9bb55115f5961267f7d654`, including the dirty working tree:

- 97 Solidity files under `omerta-contracts/src`
- 40 core/acquisition files
- 12 Market V2 files
- 9 interfaces
- 1 guarded-auction wrapper
- 35 vendored auction/dependency files
- 43 untracked Solidity source files, including the player-genesis stack

Methods followed the pinned Pashov, Plamen, and Trail of Bits revisions required by [SECURITY-REVIEW-POLICY.md](C:/Users/Jorge/Documents/Omerta/omerta-contracts/SECURITY-REVIEW-POLICY.md).

## Verified current finding

### M-02 — Medium, conditional oracle manipulation

An initialized legacy v4 pool with zero active liquidity permits a swap that changes the tick without transferring either asset. The resulting interval can later be published as a fresh TWAP.

Trace:

1. [`beforeInitialize`](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmertaHook.sol:439) authorizes pool initialization but does not require liquidity.
2. [`afterSwap`](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmertaHook.sol:532) records the post-swap tick even when both swap deltas are zero.
3. [`currentTickCumulative`](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmertaHook.sol:555) accrues that tick over time without liquidity information.
4. [`OmrV4TwapOracle._update`](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmrV4TwapOracle.sol:146) publishes the derived price and current timestamp.
5. The executable proof at [ComprehensiveMarketAudit.t.sol:113](C:/Users/Jorge/Documents/Omerta/omerta-contracts/test/audit/ComprehensiveMarketAudit.t.sol:113) moves `sqrtPriceX96` from `Q96` to `2*Q96` at zero token/ETH cost and later publishes approximately `4e18` OMR/ETH.

Impact: any bond or other issuance path trusting this oracle while canonical liquidity is absent can accept an economically unsupported price.

Market V2 does not inherit this exact path: its market-state tests reject zero-liquidity epochs. The finding remains live for consumers of the legacy `OmrV4TwapOracle`.

## Verified configuration/liveness risks

- [GenesisProceedsSplitter.sol:80](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/GenesisProceedsSplitter.sol:80): one immutable recipient that permanently rejects ETH makes the atomic success distribution permanently unavailable. No attacker can redirect funds, but deployment configuration can strand them.
- [OmertaFees.sol:128](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmertaFees.sol:128): the contract sends 25% to Vig and 75% to one recipient. Treasury/community subdivisions described off-chain are not enforced on-chain.
- Player genesis requires every participant to be settled before migration. Settlement is permissionless, but large eligible-address sets create keeper/enumeration pressure before the deadline.
- The genesis configurator remains trusted to select semantically correct auction, hook, token, Permit2, PoolManager, and PositionManager implementations. Runtime-codehash pinning does not protect against upgradeable proxies retaining the same proxy runtime.
- Vendored `ReentrancyGuardTransient` requires Cancun/EIP-1153 support. Deployment on a non-supporting chain is not covered by successful local Cancun compilation.

## Unverified leads

- A very large Merkle eligibility set with many dust contributors might turn per-wallet settlement into a deadline-driven operational DoS. No profitable or unavoidable exploit was established because anyone can settle each wallet.
- Forced ETH sent to PositionManager before genesis migration affects its dust accounting. No theft or invariant break was established; the primary remaining concern is dependency-specific migration failure.
- Market V2 economics—stability deployment timing, recovery hysteresis, solver competition, and turf adjudication—remain susceptible to governance/configuration abuse by their designated privileged roles. No privilege-escalation path was found.
- Fee-on-transfer, rebasing, callback-bearing, or proxy-upgradeable production assets can violate assumptions made by several modules. Most constructors expect standard OMR/ERC-20 behavior; production token selection remains an external prerequisite.

## Coverage and evidence

Inspected source and tests across:

- OMR, staking, fees, vouchers, NFTs, stock custody, bonds, bank, Alchemist/Transmuter
- Acquisition authority, vault/core, registry, reconciliation, health and gas modules
- All Market V2 hook, state, stability, arbitrage, bonds, commitments, turf, settlement and funding modules
- Player sale, coordinator, guarded CCA and the complete vendored dependency closure
- Access control, accounting conservation, callbacks/reentrancy, replay domains, oracle freshness/liquidity, rounding, lifecycle recovery, privilege and economic manipulation

Retained exact-source evidence includes:

- Player genesis: 29 tests/properties passed with fixed seed
- Market V2: 124 tests passed with fixed seed
- Earlier tracked-source baseline: 927 passed, one subsequently corrected harness failure
- Existing Slither triage: 31 selected tracked-source analyses; raw diagnostics were dispositioned

A new full-suite run was attempted but collided with another Forge process writing the shared `out/` directory and failed with `Access is denied`. It is recorded as unavailable evidence, not a pass or contract failure. Fresh static analysis was also unavailable for the new vendored/untracked closure.

## Conclusion

No current unprivileged critical/high exploit was confirmed. M-02 remains a verified medium conditional issue for the legacy oracle path. The remaining items are leads or deployment/configuration dependencies, not proven public exploits. This review is bounded to the exact source above and does not claim the contracts are bug-free or authorize deployment.