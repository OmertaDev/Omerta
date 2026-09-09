# Buyback executor and bond liquidity boundary review

Date: 2026-09-08. Status: source review, genuine pre-fix reproduction and targeted regression execution
completed. The scoped run passed all 32 tests, with 512 runs for each of its three fuzz properties.
No production transaction, activation, funding or deployment occurred.

## Scope and source

Working-tree review based on commit `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`; the implementation
is dirty/new relative to that commit. Snapshot SHA-256 values before coordinated compilation:

| File | SHA-256 |
| --- | --- |
| `src/LiquidityBuybackExecutor.sol` | `ff24f0ff41713554bededc993c05208b93835f4a78be3bb117740c3f88163473` |
| `src/OmertaBond.sol` | `6e6a9fd871464222b764a5e618dd9d06d10aad37b085967161688e8cea287d9b` |
| `src/interfaces/ILiquidityHealth.sol` | `a46298162aa57c61afd75af2722220ec38a8654b4d7a070364afff3bfe3cecd2` |
| `test/LiquidityBuybackExecutor.t.sol` | `34aec7f6c1788eecfe182615eb0d626ffef997465051eb362a5e311961414ff6` |
| `test/BondLiquidityHealth.t.sol` | `38b48a9c74a04a661df7ab6a2e32f9d6d97ab63601e485f882a04dbb8f99e5c6` |

The review covers the complete new buyback executor and the new bond health/guardian boundary,
plus its existing oracle timestamp validation. It follows actual PoolManager unlock/swap/settlement,
OMR token transfer, OmertaHook initialization/observation and OpenZeppelin guard/token behavior.
It does not re-audit unrelated bond economics, the complete v4 implementation, the separately
reviewed POL custodian, backend revenue booking or the deployment's concrete addresses.

Methods were adapted from the repository-pinned Pashov Solidity review/shared adversarial rules
(`c577eb7799c349de0acb187ba00ca98e14e436fd`), Plamen EVM oracle-analysis/token-flow tracing
(`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`), and Trail of Bits audit-context-building
(`d3323cefbcf645678b8dc481de204b02ad3d02dc`). Applied passes: caller/asset/authority mapping,
receipt and token-flow tracing, temporal oracle boundaries, callback inversion, independent
accounting assertions and concrete hypothesis verification. These are bounded review methods;
the upstream multi-agent orchestrators were not executed. This subreview ran alongside the root's
backend/deployment work and the separate POL review. Native Windows tooling replaces Unix examples.

## Trust and asset model

| Surface | Caller and authority | Effect and failure behavior |
| --- | --- | --- |
| `deposit` / native receive | Anyone | Adds native funding; creates no token entitlement or off-chain credit. |
| `execute` | Owner-allowlisted keeper; unpaused | Spends at most per-action/day policy and actual funding, subject to global cooldown, five-minute deadline, health and oracle floor. Pool and destinations are immutable. |
| `unlockCallback` | Exact PoolManager during the one active unlock only | One exact-input native/OMR swap, native settlement and OMR receipt. The callback flag is consumed before the swap. |
| `distributeTokenRevenue` | Owner-allowlisted keeper; unpaused | Delivers the already-held OMR balance to fixed stream destinations. No ETH spending, oracle price or ETH-budget entry is implied. Shares and sequence are evented separately. |
| `recover` | Owner only while paused | Returns funded native/token assets to governance; keeper has no withdrawal destination choice. |
| `setKeeper`, pause/unpause | Owner | Changes execution authority or stops/resumes the buyer; cannot change pool, policy or destinations. |
| Bond `priceCeiling` / `bond` | Public price read; signed quote bound to payer for execution | Installed liquidity guard must report healthy; oracle must be positive, nonfuture and recent. Rejection rolls back quote nonce and all other issuance state. |
| Bond `claim` | Recorded bond owner | Releases previously escrowed vested OMR independently of pause, health or oracle. |
| Bond guard management | Owner | Nonzero deployed code required. After first installation, replacement requires pause; zero cannot remove the boundary. |
| Bond emergency pause | Exact governance-appointed guardian | Pause only. Guardian cannot resume, change guard, recipients, oracle or economic caps. |

Vig token output divides into a floored 50% primary reserve share and the remaining prize share;
the two fixed destinations may intentionally be the same custody address. Desk, community and POL
streams have one destination. Every delivery verifies its recipient's actual balance delta and the
buyer's resulting balance. Ordinary transfers, rebasing/fee behavior that alters receipt amounts,
or a recipient callback cannot silently change accounting: mismatch or rejection reverts the whole
transaction. A canonical, reviewed OMR implementation and canonical manager are still required;
arbitrary tokens can lie in `balanceOf`, and code existence is not runtime authentication.

The swap measures actual native spending and token receipt, reconciles the final daily debit to
actual spending, and leaves preexisting direct token revenue in place. Token-revenue distribution
uses the same monotonically increasing event sequence, a distinct event type and no fabricated
purchase price. Downstream accounting must preserve that distinction and verify receipts/address
domains before crediting either stream.

## Finding AUT-BOND-01: a future-dated oracle observation was accepted

Severity: **Low, conditional oracle validation defect**. Status: prior behavior reproduced with the
actual archived pre-fix creation code; source corrected; regression execution passed.

The old `_oraclePrice` verified positive price and the expression
`block.timestamp > updatedAt + maxOracleAge`. An oracle reporting an observation timestamp in the
future passed that test. A faulty or governance-selected replacement oracle could therefore keep
a price acceptable beyond the intended observation age. The canonical ownerless v4 oracle reports
chain time and does not expose an arbitrary timestamp setter, so this is not an unprivileged
production manipulation or proof of a bond drain. Existing signer, price/rate and issuance caps
remain separate bounds.

Exact previous code:

```solidity
if (price == 0) revert OracleUnavailable();
if (block.timestamp > updatedAt + maxOracleAge) revert OracleStale(updatedAt, maxOracleAge);
```

Correction:

```solidity
if (price == 0 || updatedAt > block.timestamp) revert OracleUnavailable();
if (block.timestamp - updatedAt > maxOracleAge) revert OracleStale(updatedAt, maxOracleAge);
```

The future comparison precedes subtraction, so the age computation cannot underflow. It also
avoids overflow in `updatedAt + maxOracleAge`. A reading at exactly the configured maximum age
remains accepted.

Executed reproduction retained under
[`output/liquidity-automation/before-bond-future-fix`](../../../output/liquidity-automation/before-bond-future-fix):

- Exact archived source SHA-256: `2b1232d81517988ac4b3d579ca09c297d431bc500dfe6c634845524c338ede98`.
- The proof checks its source Keccak against the archived artifact metadata:
  `0xa6316550d35a965beb46cf9e35d01e11dbec78eded4f3626e83df7ca224c26df`.
- Archived pre-fix artifact SHA-256: `63a473456c55fb68523373835bb05936c0b5546f799f647d6ebfd49c68e42c7e`.
- Disposable Anvil only: `127.0.0.1:18659`, chain ID 31337; public Anvil test key.
- Chain timestamp `1788896014`; oracle observation `1820432014` (365 days ahead);
  configured maximum age `3600`; accepted price ceiling `1000e18`.
- A valid independently signed 1 ETH bond executed and minted exactly `1000e18` OMR into its
  vesting escrow. Transaction `0x8755742daa77d3f677b43249fadea30fa2597d10ec49f8534489c04cf7c2f437`.
- Command `node output/liquidity-automation/before-bond-future-fix/proof.mjs` exited 0. Script,
  artifact, source, dependency artifacts, stdout, exit code and structured result are retained.
- The local Anvil process was stopped after the proof. No state-changing request used a remote RPC.

New regression `testFuzz_futureOracleTimestampIsRejectedWithOrWithoutGuard` covers both the
legacy unguarded mode and installed healthy guard; `test_oracleAgeBoundaryIsInclusiveAndMaximumFutureValueIsRejected`
covers exact-age, stale and maximum-integer boundaries. Both passed in the recorded run below.

## Executed coverage

`LiquidityBuybackExecutor.t.sol` contains 18 tests with the actual OMR, PoolManager and OmertaHook,
including two fuzz properties, plus five hostile-token boundary tests that still use actual v4
swaps and settlement. It covers conservation, fixed recipients/stream behavior, min-out floors,
action/day/cooldown/deadline controls, real canonical TWAP integration, zero/stale/future/reverting
oracle, false/reverting/nonconforming health, unauthorized callbacks, pause/recovery, direct token
receipts, shared sequence, odd wei, fee-on-transfer mismatch, second-recipient rollback and
cross-function receiver reentry.

`BondLiquidityHealth.t.sol` contains nine tests, including one fuzz property. It covers a quote
signed before health loss or emergency pause; still-available vested claims; guard code failure;
nonzero/pause-bound replacement; guardian revocation and limited authority; explicit legacy
absence; and corrected oracle timestamp boundaries. Quote signatures use independently encoded
EIP-712 domains and messages instead of the target's digest helper.

Executed command from `omerta-contracts` on 2026-09-08:

```text
forge test --match-contract '^(LiquidityBuybackExecutorTest|LiquidityBuybackBoundaryTest|BondLiquidityHealthTest)$' --fuzz-seed 0x20260908 -vv
```

Result: **32 passed, 0 failed, 0 skipped**, exit 0. Split: 18 executor tests, five hostile-token
boundary tests and nine bond health tests. Each of the three fuzz properties ran 512 cases.
Compilation used Solidity 0.8.26, optimizer enabled with 800 runs and the Cancun EVM target from
the retained repository profile. Compilation reported success. Raw output is retained in
[`forge-buyback-bond.txt`](../../../output/liquidity-automation/forge-buyback-bond.txt), with exit
status in [`forge-buyback-bond-exit.txt`](../../../output/liquidity-automation/forge-buyback-bond-exit.txt).
The final source/test SHA-256 values still match the snapshot table above.

Static-analysis results and the complete release inventory are retained by the coordinating review;
this subreport does not claim an independent static-analysis run. The separate POL review owns its
stateful custody/health properties. These 32 tests are the executed scope of this subreport.

## Residual constraints and conclusion

1. Initial bond guard installation is deliberately optional for legacy compatibility. The getter
   `liquidityHealthy()` is false when absent, but legacy `priceCeiling()` remains usable. Deployment
   and automation readiness must require the intended nonzero guard; the new release must not
   describe an unguarded deployment as having the liquidity floor.
2. Constructor code checks and fixed values do not establish that the manager, token, oracle and
   health guard are the reviewed runtime or refer to the same canonical pool. Exact runtime,
   immutable and role binding belong to release preflight. Keeper authority cannot change them.
3. Price freshness and the guard serve different purposes. Custody-backed sustained liquidity is
   independently required; the old empty-pool/fresh-TWAP observation remains relevant outside
   the verified guard configuration. No broad claim about all pools is made here.
4. A minimum-output bound limits execution loss but does not promise absence of MEV or economically
   optimal timing. UTC-day budgets are not rolling 24-hour budgets. An approved compromised keeper
   can consume the bounded policy while directing outputs only to fixed destinations.
5. A rejecting/nonstandard recipient or token halts atomic delivery. Governance recovery is available
   while paused, and immutable misconfiguration requires replacement. These are explicit liveness
   and governance conditions, not unrestricted keeper spending paths.
6. Direct token distribution is independent of market health because it exchanges no asset. It
   still requires an approved keeper and unpaused executor. Separate events are necessary to avoid
   creating fake native revenue or a fake oracle price in the backend.

No additional unprivileged asset-redirection or callback exploit was established by source review.
The targeted regression suite passed at the pinned working-tree hashes. This remains a bounded
source-review and regression conclusion; production activation and the concrete runtime/role review
remain separate.
