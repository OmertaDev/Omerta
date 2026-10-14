# Market tax policy

The market charges a fixed 5% through `OmertaPoolManagerV2` on buys and sells, including supported unhooked ETH/OMR pools. The fixed buckets are 2% founder/operations, 1% RWA, 1% community and 1% POL; the POL bucket receives rounding remainder. Exact-input trades pay from actual output, and exact-output trades pay on actual input. LP fees are additional.

The canonical hook adds at most 0.5% opening or sell-pressure surcharge, and the manager independently enforces that bound. Manager and hook recipients are immutable. The founder/operations production recipient remains an explicit runtime/manifest verification requirement; no getter or source declaration proves deployment.

There is no queue, cancellation or execution authority for changing market tax percentages. Neither the Safe nor another caller can change fixed rates, redirect accrued buckets, extend an initialized opening window or replace these implementations. Each fixed recipient can collect its own bucket to another destination; this does not change other recipients' rights.

The launch LP fee remains static at 0.3%. Auction proceeds allocation, NFT eligibility, bidder refunds and claims, bond custody, liquidity ownership and Family Yield authority retain their separate contract rules.

This policy requires the sealed restricted token, its reviewed bound settlement manager and a PositionManager paired to that manager. Verify the source revision, constructor-specific runtimes, complete operator/recipient policy and actual deployments before sealing or funding. Source integration and successful local tests do not activate a live market. See [restricted bootstrap](docs/market/RESTRICTED-BOOTSTRAP.md).
