# OMERTÀ — market hook and observations

The canonical ETH/OMR market uses [`OmertaHookV2`](omerta-contracts/src/market-v2/OmertaHookV2.sol) and [`OmertaMarketStateV2`](omerta-contracts/src/market-v2/OmertaMarketStateV2.sol). The [market design](omerta-contracts/docs/market/DESIGN.md) defines their settlement boundaries; the [runbook](omerta-contracts/docs/market/RUNBOOK.md) defines deployment, funding, runtime checks and activation. Technical identifiers are retained for source and ABI compatibility.

## Settlement and fees

The hook charges a **9% base sell fee**: 2% developer, 1.6% RWA recipient, 2.4% community and 3% protocol liquidity. An additional pressure charge of **0–1%** goes to stability. Pool LP fees are additional. Fees follow actual settled deltas and may arrive in ETH or OMR; accounting must not assume ETH-only receipts.

The separately configured opening window may charge buys and bound purchase size. Outside that finite window there is no hook buy fee. Rates, recipients and opening policy are immutable for a deployment. Fee buckets can be claimed independently, so one recipient's failure does not block swaps or another recipient.

These rules apply to the canonical PoolKey, not every independent OMR venue. Keep the token's `ammPairs(PoolManager)` false for this market: transfer taxation of the singleton would also reach liquidity operations and could overlap the hook fee.

## Observations and inventory

The hook records finalized epochs with mean tick, dispersion, gross ETH turnover, volume imbalance, minimum active liquidity and liquidity-time integration. The market-state contract enforces observation validity. Controller and bond execution also check current liquidity and spot deviation. These are historical pool measurements, not an external fair-value oracle or a guaranteed floor.

The [inventory bond](omerta-reserve-bond-design.md) reserves prefunded tokens, applies bounded discounts and limits, and preserves vested claims independently of sale readiness. Stability actions consume finite compartment inventory and capacity. A favorable market observation does not create new reserves.

## Deployment and review

Use the [current runbook](omerta-contracts/docs/market/RUNBOOK.md) for constructor inputs, custody, bindings, funding, oracle readiness and activation. Verify the selected network, addresses and runtime code; source existence or a passing unit suite does not establish production activation.

Security work follows [the repository review policy](omerta-contracts/SECURITY-REVIEW-POLICY.md). Preserve exact source, ABI, event and typed-data identities. Review evidence applies only to its pinned dependencies, artifact hashes, scope and release phase.
