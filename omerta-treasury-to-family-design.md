# OMERTÀ — community funding and Family fee rights

Family rewards have distinct funding and custody paths. The [market design](omerta-contracts/docs/market/DESIGN.md) is authoritative for the canonical ETH/OMR market, while `src/community.js` and `src/exchange.js` define the in-game community pool. Deployment, actual funding and game integration must each be verified before describing a path as active.

## Canonical sell fees

The hook charges a 9% base sell fee: 2% developer, 1.6% RWA recipient, 2.4% community and 3% protocol liquidity. The additional 0–1% pressure charge goes to stability. These are percentages of the applicable settled trade base; LP fees are additional. Fee receipts can be ETH or OMR, and each recipient has an independent claim bucket.

The 3% liquidity bucket routes to Core funding. Surge, inventory-bond proceeds and the arbitrage reserve share route to War Chest funding. The developer, RWA and community recipients are explicit deployment inputs. These market allocations do not impose one universal split on character fees, Store receipts, Bank harvest fees or withdrawals; each source retains its own authority and accounting.

See [`OmertaHookV2`](omerta-contracts/src/market-v2/OmertaHookV2.sol), [`OmertaReserveFundingV2`](omerta-contracts/src/market-v2/OmertaReserveFundingV2.sol) and the [market runbook](omerta-contracts/docs/market/RUNBOOK.md).

## In-game community pool

Eligible community revenue is recorded by source and asset. A configured keeper can spend only available authorized revenue to acquire actual OMR. `runFamilyBuyback` records the acquired OMR in `family_yield_pool` through the exact ledger reason `yield:buyback`; `runFamilyBuybackInvariants` reconciles credited OMR with purchases. An internal ledger credit is not an ERC-20 mint.

`payFamilyYield` distributes an available funded pool to eligible Families by the current standing rules, with five ranked weights of 5:4:3:2:1. Window redemptions and withdrawal charges have their own specified OMR funding legs. Pool distributions cannot create a larger balance than the pool holds. A Family's in-game OMR reserve is not a personal ETH wallet or a claim on all protocol revenue.

Accounting recognition requires actual custody: a recorded ETH/OMR receipt is not spending authority over an unrelated recipient wallet. Apply confirmed-event and reorg rules before presenting revenue as settled. See [`src/community.js`](src/community.js), [`src/exchange.js`](src/exchange.js) and [`src/invariants.js`](src/invariants.js).

## Seasonal Turf fees

The market's Turf system separately allocates actual collected fees from designated seasonal liquidity lanes. Families can hold fee rights individually or in syndicates of up to four, with shares totaling 10,000 basis points. Principal remains in protocol custody. Status, corridors, loyalty and fortification do not multiply a monetary claim.

The fee bridge checkpoints accrued fees before ownership, siege or treasury transitions. Typed game settlement supplies bounded outcomes with revisions, epochs and replay IDs; it cannot withdraw principal or invent fees. A siege freezes participant wallets and allocates only funded escrow. Already credited balances do not move when a Family changes its treasury. The economic cutoff is the atomic on-chain checkpoint.

These claims may contain ETH or OMR and remain distinct from the server's community pool. They do not authorize an additional game-cash payout. See [`OmertaTurfV2`](omerta-contracts/src/market-v2/OmertaTurfV2.sol), [`OmertaTurfFeeBridgeV2`](omerta-contracts/src/market-v2/OmertaTurfFeeBridgeV2.sol) and [`OmertaGameSettlementV2`](omerta-contracts/src/market-v2/OmertaGameSettlementV2.sol).

## Verification boundary

A proposed split, deployed recipient or recorded game result does not prove receipt of funds. Verify source-specific custody, lane bindings, funding, claim balances and confirmation state. Retain review and retest evidence for the selected revision and release phase under the [security review policy](omerta-contracts/SECURITY-REVIEW-POLICY.md). No path described here guarantees revenue, a personal yield or a token price.
