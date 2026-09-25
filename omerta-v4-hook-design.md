# OMR core hook and oracle

`omerta-contracts/src/OmertaHook.sol` is the core hook used by the committed bootstrap deployment path. `OmrV4TwapOracle.sol` provides its bounded observation-based oracle. Both implementations and their tests exist; release validation must measure the selected revision rather than reuse an old test count.

The current canonical market architecture is documented separately in [the market design](omerta-contracts/docs/market/DESIGN.md) and [runbook](omerta-contracts/docs/market/RUNBOOK.md). This document describes the core hook dependency and does not authorize replacing the deployed pool, enabling a keeper, or activating a game route.

## Deployment and review

Use [GENESIS-LAUNCH.md](omerta-contracts/GENESIS-LAUNCH.md), [DEPLOYMENT.md](omerta-contracts/DEPLOYMENT.md), and [CHAIN-DEPLOY.md](CHAIN-DEPLOY.md) for chain selection, addresses, constructors, initialization, and funding. The target is Robinhood Chain; configuration and manifests determine the exact network.

Security work follows [the repository review policy](omerta-contracts/SECURITY-REVIEW-POLICY.md). Evidence applies to its pinned source, dependencies, artifact hashes, scope, and release phase. Source existence or a passing unit suite alone does not establish production activation.

## Settlement boundaries

- The hook taxes supported sells inside the Uniswap v4 swap. Exact-input sells charge the quote output; exact-output sells charge the OMR input, according to the actual settled delta.
- Pool initialization, permitted quotes, hook-address permissions, and the bootstrap strategy are checked by the contract and deployment plan.
- Permanent buy taxation is not part of the approved core-hook policy. The bounded opening anti-snipe fee is a separate launch control.
- Fee accrual, sweeping, recipient identity, and accounting must match the contract and its backend ingestion. Do not infer revenue from arbitrary pools or unconfirmed events.
- Avoid enabling both the token transfer tax and the hook tax for the same canonical transfer path.

## Oracle boundaries

The core hook records observations; `OmrV4TwapOracle` applies its own bounded sampling and freshness policy. Fail-closed behavior and keeper cadence belong to the actual oracle configuration. Do not substitute an instantaneous quote for a required time-weighted observation or claim readiness before the warmup and release checks pass.

## Bond discount guard

For the core `OmertaBond` route, keep `BONDS.DISCOUNT_BPS` strictly below the applicable canonical sell tax and preserve the contract's oracle, cap, and signer checks. A pool-local fee cannot guarantee taxation at every venue, so this guard does not promise risk-free economics or a price floor.

The canonical market inventory bond has its own funded-inventory policy and no mint authority. Use its market runbook rather than treating the core minting bond and inventory bond as interchangeable deployments.

## Verification

Run the scoped contract tests and deployment checks named in the current runbooks. Preserve compiled source, ABI, event, and typed-data identities unless a separately reviewed implementation change requires them. Retained dated audit reports describe their original revision, not an automatic clearance for a later one.
