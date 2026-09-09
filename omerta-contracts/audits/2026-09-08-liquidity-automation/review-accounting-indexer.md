# Liquidity accounting, confirmed recovery, and queued withdrawal review

Review date: 2026-09-08. Scope: the uncommitted restricted-liquidity implementation built on repository revision `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`, with the individual source hashes below. This report is a supplement to the new liquidity review. It does not modify, extend, or reissue any previously sealed review conclusion.

## Source boundary

| File | SHA-256 |
|---|---|
| `src/liquidityaccounting.js` | `c7dd052b74eb9d2f69e7c2c59f7ec595b6c350762459717054e3dc1aa79b6894` |
| `src/liquidityindexer.js` | `74c79035129b602e1705ad45766ff898ab80c38e3473bff63892211a1aeaa151` |
| `src/liquidityqueue.js` | `4d6b7145d901a138c07be52c8c662330fd3472968cc683c351f24ee59cada012` |
| `test/liquidityaccounting-review.js` | `35d40b2349384d1f7b04b95b0209b220b1b27e7a1e42033c274c6a07d8013038` |
| `test/liquidityindexer.js` | `19200200e63818c95bab1f7fa22308f985bd7903bf3948a1a9023576a4a0e8de` |
| `test/liquidityqueue.js` | `7e3f7028ea18841c7f7efc8ff6a688642b4a7f913e52887a48fb8d91e1577786` |
| `test/liquidityqueue-review.js` | `fccbd1bd887466924837cb4379da9593c455a84dee17c78f0b24759ef9b151e6` |
| `test/liquiditypolicy-review.js` | `3943144cffaeb797ca1d33e4e453863947cfe074508387cb8eb0987ba2904af3` |

The review also changed the existing `drainQueue` section in `src/chain.js`, added the index cursor's preceding block hash and removed the new executor-per-transaction uniqueness constraint in `schema.sql`, and added required `indexing.startL2Block` / `indexing.maxBlocks` validation and fixture policy. The parent review seals those shared files after all contributors finish. It separately covers worker integration, transport, policy implementation, deployment tools, actual EVM rehearsals, and production release configuration.

## Confirmed authority and accounting

The indexer accepts only the fixed chain 4663 manifest, with runtime pins, declared jobs, and a required inclusive starting L2 block. Each invocation scans at most the approved block-page size through the configured confirmed head. `caughtUp` is false while pages remain; the wrapper must not authorize new keeper work or queue completion during that backlog.

Each discovered log must carry canonical block, transaction, transaction-index, and log-index metadata and match the corresponding raw receipt entry exactly. Removed logs, conflicting RPC duplicates, failed receipts, undeclared watched events, or omitted supported events in a discovered receipt stop the page. Identical duplicate provider entries are deduplicated. Runtime pins are checked at the confirmed head and each relevant receipt block; bindings are read at the receipt's block. The page rechecks its receipt blocks and confirmed head before commit. The cursor records the preceding canonical hash so a later reorganization behind that cursor stops recovery.

One PostgreSQL transaction contains the complete page's economic books and cursor advance. A per-manifest transaction advisory lock serializes indexers; sorted per-contract advisory locks also coordinate with direct keeper settlement. Two independent Node processes were observed waiting on the same PostgreSQL advisory lock, then one booked the page and the other saw the advanced cursor. A failed later event rolls back earlier revenue, reserve, and settlement writes from that page.

An outer transaction may invoke the watched contracts indirectly. Recovery separately pins the emitter and validates the outer receipt target; direct keeper rows retain their direct-target requirement. An executor sequence is selected by canonical event log index and sequence, and its OMR delivery proof uses only the segment preceding that event since the prior terminal event from the same executor. This permits multiple executor fills in one transaction without attributing another fill's transfers to it. Settlement identity remains chain, executor, and sequence.

ERC-20 amounts use exact integers through receipt proof and decimal strings for SQL NUMERIC. Each gameplay allocation is floored independently to six decimals before exact addition. Direct OMR distributions create no invented native inflow or execution price. Sub-micro receipts are retained with zero signable credit. Native spending is bounded against recorded native inflow using exact arithmetic. Actual Desk execution is checked against its approved lower-band ceiling, sanity floor, and strategy minimum; historical recovery uses the matching keeper journal or a preceding, non-stale real Vig print. Vig prints preserve the existing configurable continuity circuit breaker using a prior print at or before the actual receipt time. Historical ingestion never makes an old print fresh at ingestion time.

## Native Hook recipient proof

The Hook's `Swept` event omits recipients, and recipients are mutable. A governance rotation followed by restoration within the same block can leave end-of-block getters looking approved while the intermediate native sweep paid other addresses. A normative regression reproduced that incorrect acceptance before the fix.

`verifyHookSweepReceipt` now verifies the native Hook runtime and all four approved recipients at the receipt block, rejects any `RecipientsSet` event in that entire block, and rechecks its canonical hash. The indexer calls it, and the keeper transport contributor wired it as a mandatory pre-settlement verifier for native Hook receipts. Token sweeps separately require exact OMR transfer logs. The conservative block-wide hold is intentional: even a benign recipient update in a native-sweep block requires explicit historical review instead of guessed attribution.

## Existing queued withdrawal completion

`drainLiquidityQueue` completes only existing queued OMR withdrawals. It is dormant before any RPC or database operation unless the existing voucher signer and extraction domain are configured. It requires confirmed-indexer catch-up and a non-alerting keeper result, then checks the exact manifest chain and claim address, current claim and OMR runtime hashes, the claim's token/owner/signer bindings, a signer distinct from the keeper, pause state, fresh chain time, and canonical block identity. It does not generate a signer, rewrite configuration, or submit an on-chain transaction.

The existing FIFO `drainQueue` retains its cumulative-ever-funded gate and now compares exact six-decimal integers. An optional live token balance adds a second gate: unclaimed signed obligations plus newly signed vouchers cannot exceed the observed physical claim balance. Already-claimed obligations still consume lifetime funding; they do not consume live token balance a second time. Claim-history indexing lag is conservative and can hold the queue. An existing physical deficit returns an explicit alert. This observation cannot prevent a privileged sweep or signer rotation after verification.

## Findings and retests

| Reference | Classification | Finding | Disposition |
|---|---|---|---|
| LA-01 | Medium, accounting integrity | Number conversion rounded a physically floored allocation upward at the large six-decimal boundary. | Exact decimal SQL parameters; direct and real-PG large-value regression passes. |
| LA-02 | Medium, policy preservation | Initial receipt booking omitted Desk execution band/floor and Vig continuity checks. | Actual fill checks restored; adverse execution and continuity regressions pass. |
| LA-03 | Medium, price freshness | Historical fills acquired ingestion-time timestamps, potentially reviving an old price. | Canonical block time is stored for prices and revenue; historical/future-anchor tests pass. |
| LA-04 | Medium, attribution integrity | Native Hook rotation and restoration within one block defeated end-of-block recipient attribution. | Block-wide recipient-change hold plus runtime/getter/hash proof; synthetic RPC/real-PG regression passes. The parent retains separate actual-EVM confirmation. |
| LA-05 | Medium, reserve integrity | `drainQueue` signed `9000000000.000002` OMR against `9000000000.000001` OMR backing because both converted to the same Number. | Exact six-decimal FIFO gate; pre-fix oversign and post-fix hold retained. Existing chain suite passes. |
| LA-06 | Low, recovery availability | One transaction could not contain two executor sequences because of transaction-level uniqueness and whole-receipt transfer aggregation. | Per-sequence event segments and uniqueness; real-PG nested/multiple-event replay tests pass. |
| LA-07 | Defense in depth | POL and Hook OMR fee events were accepted without independent exact token-delivery proof. Synthetic incomplete receipts demonstrate the missing check; this is not a claim that the pinned real contracts emitted such receipts. | Exact fixed-recipient Transfer checks added; missing/extra/wrong delivery tests pass. |
| LP-01 | Medium, launch-state consistency | An older healthy observation rejected by the database could still overwrite the newer unhealthy process-local state. | Reproduced independently; parent-owned fix passes the normative regression. |
| LP-02 | Low, strategy/accounting consistency | Float ceiling arithmetic produced minimum output below the exact Desk band requirement. | Parent changed the policy arithmetic; exact-ceiling regression passes. |
| LP-03 | Low, price freshness | A print timestamped after the strategy snapshot could authorize buying. | Parent changed future-print handling; regression passes. |

## Retained executions

All paths below are relative to `output/liquidity-automation`; each log has a sibling `.exit` file. Pre-fix runs retain exit 1. Final runs retain exit 0.

| Log | Result | SHA-256 |
|---|---|---|
| `accounting-review-before.log` | Initial seven adverse accounting assertions failed as expected | `b4c385b2b908a67aff1ac16f3d1128b33d96744bf28b83799b5db6782722faf4` |
| `accounting-continuity-before.log` | New continuity assertion failed before restoration | `435368b4d2496bcc97ea88e70482f8c906517eb6550cac717bac11b994193331` |
| `indexer-hook-rotation-before.log` | Rotation/restoration incorrectly accepted before fix | `beedb7564b54af699f81548271d500f961101c5444e752e2ee38b45710e2bcd2` |
| `queue-precision-before.log` | One-micro oversign reproduced | `91fb5232a92be5db8b3eb7338025a027dc88ac369c0ab59d4a8081384e64ea7e` |
| `policy-review-before.log` | All three independent policy assertions failed before fixes | `317c213ea977324004d9d1aa7d072a8a1625c3c0e8f8b73b6ba78e0ed5d53d92` |
| `accounting-review-final.log` | 8 adverse accounting assertions pass | `b32cf7130a268871f564f4e486c6668885cc93fd520fa4ada70c5c4c7a455b22` |
| `indexer-postgres-final.log` | 27 real-PG groups pass, including independent-process locking | `3984d4a947c03d7f69aa8e92710f468102400e31086d27eef8aafacc92e24d53` |
| `queue-postgres-final.log` | 12 real-PG groups pass | `b92f6fecf21811d76d2c843034c1ad9b3d0527388683762778d3791bb0f6eadc` |
| `queue-precision-final.log` | Exact backing boundary holds | `3c964a5454e9f05beb4e3bfb8415b15c2b1eaa55e998ed28f222bdcb43fabcd6` |
| `policy-review-final.log` | 3 independent policy assertions pass | `e5e0488272598deeaf9317940c4419a3df228e7b385e3e935eb6e6988175ff99` |
| `chain-queue-retest.log` | Existing full chain regression suite passes | `2a54f1e888b19d5c48d4537730411297b9c0e384494ba09b2566c45c19bb16b2` |

Additional compatibility checks passed: the existing 7 accounting cases under pg-mem, 10 keeper/planner groups, and 4 Genesis planner groups. PostgreSQL tests used only the dedicated local disposable indexer database. The indexer and queue suites must run sequentially against that database because they intentionally reset overlapping reserve tables. Queue signing tests use a public synthetic test key, verify EIP-712 recovery, and never submit a transaction.

## Limits of this conclusion

The indexer RPC in these tests is an explicitly controlled fixture; real PostgreSQL supplies transaction, NUMERIC, and advisory-lock semantics. This report does not itself claim a live RPC, production deployment, real-asset extraction, or a production operating history. The parent review separately retains actual EVM execution evidence and aggregate tests.

The implementation trusts its approved direct-implementation runtime pins and RPC's canonical-chain answers. It does not prove arbitrary proxy implementation state or cryptographically verify receipt inclusion. Runtime/binding mismatches and exceptional same-block configuration changes hold recovery. Native Hook attribution in such a held block requires reviewed historical evidence; there is no automatic cursor bypass. Severe reorganization is detected and held, not automatically unwound after game credits or signatures may already exist. A wholly omitted RPC transaction cannot be detected merely by comparing receipts for transactions the provider did return.

Optional Bank event paths retain exact asset denomination and transfer checks, but the 27-case indexer suite focuses on Hook, POL, and executor recovery; Bank integration has separate contributor tests. The existing production extraction gate remains a separate prerequisite. This scoped review supports the pinned implementation and reviewed release phase only.
