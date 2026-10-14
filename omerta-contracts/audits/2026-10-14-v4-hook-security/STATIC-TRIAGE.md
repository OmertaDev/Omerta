# Scoped Slither triage — 2026-10-14

This triage applies to the working-tree source analyzed in the adjacent JSON/log files.
The parent report and manifest pin the source revision, file hashes and compiler inputs.
It is code-review evidence, not deployed-runtime verification or launch approval.

## Execution and totals

| Retained output | JSON `success` | Raw diagnostics |
| --- | --- | ---: |
| `slither-hook-v2.json` | true | 15 |
| `slither-hook.json` | true | 13 |
| `slither-router.json` | true | 8 |
| `slither-manager.json` | true | 6 |
| `slither-coordinator-ir.json` | true | 21 |
| **Total** | | **63** |

All 63 diagnostics are dispositioned below by contract/rule. No confirmed exploitable
security defect was established from these diagnostics. Informational observations,
intentional rounding and time-dependent economic behavior remain explicitly identified.
Detector labels such as High/Medium are the tool's classifications, not accepted finding
severities.

The initial native coordinator analysis failed compilation with `Stack too deep` at
`OmertaGenesisCoordinatorV2.sol:202`; retain `slither-coordinator.log` and its exit file
(`1`). It supplied no usable detector verdict. The subsequent optimizer-800, solc-0.8.26,
Cancun, `--via-ir` run produced the successful 21-diagnostic JSON. The five completed
analyses have raw exit files containing `-1` while their JSON reports `success: true`
and their logs finish with detector totals. Preserve both facts; no zero process exit or
zero-finding result is claimed.

## Trust assumptions and limits

- Manager, hook, token, Permit2, PositionManager, auction and sale addresses must resolve
  to the reviewed implementations and intended immutable configuration. A getter or a
  captured runtime hash alone does not prove benign behavior or exclude a proxy whose
  implementation can change behind stable runtime. Deployment verification is separate.
- Router transfer reasoning follows `OmertaRestrictedOMRV2.registerWallet` and `_update`:
  they perform local accounting/policy checks without recipient callbacks. The sealed
  policy/runtime checks must admit the intended reviewed operators. Arbitrary malicious
  tokens or operators are not silently treated as equivalent dependencies.
- Coordinator reasoning follows production `GenesisPlayerSale`, the guarded auction and
  vendored core/periphery callees. Graduation regression fixtures use real PoolManager,
  PositionManager and Permit2, but mock auction/ERC20 implementations. Those tests prove
  the exercised rollback/accounting behavior; they do not prove all production auction
  economics or restricted-manager launch integration.
- Timestamps, price impact and integer rounding are economic inputs. Bounded fees and
  observation records do not provide sandwich immunity, manipulation-resistant volume,
  executable liquidity depth, or identical currency economics across swap modes.

## OmertaHookV2 — 15 diagnostics

| Rule | Count | Disposition and source reasoning |
| --- | ---: | --- |
| `divide-before-multiply` | 2 | Intentional integer semantics. `_surgeRate` floors decayed tick pressure before calculating its bounded 0–50 bps surcharge; precision loss can reduce the charge but cannot create an unbounded rate or unfunded claim. `_advance` divides time into an epoch number and multiplies back to obtain its boundary; retaining a remainder is the purpose of this operation. |
| `incorrect-equality` | 4 | Not security findings. `_integrate` skips zero duration; `_collectFee` skips zero fees; `_advance` distinguishes the same timestamp and the same epoch. No flagged condition demands equality with an attacker-controlled token balance. |
| `unused-return` | 2 | Intentional partial `StateLibrary.getSlot0` reads. `beforeSwap` and `_adoptPoolState` need the tick; unrelated price/protocol-fee/LP-fee tuple fields are not validation results. |
| `timestamp` | 4 | Accepted clock dependence in pressure decay and epoch integration, including conservatively tainted comparisons elsewhere. Ordinary chain timestamp discretion can change epoch placement or a bounded surcharge; it supplies no fee destination, authorization or collateral bypass. |
| `assembly` | 2 | Informational. `beforeSwap` writes a fixed transient tick slot; `_surgeRate` reads and sign-extends its int24 value. Canonical pool checks and the reviewed callback path prevent a user callback from overwriting it between snapshot and use. |
| `low-level-calls` | 1 | Checked constructor policy probes. `_managerRevenuePolicy` checks call success and 32-byte return lengths, then validates OMR and the fixed base fee. A matching policy getter selects accounting mode; source comments correctly require separate manager-runtime verification. |

## OmertaHook — 13 diagnostics

| Rule | Count | Disposition and source reasoning |
| --- | ---: | --- |
| `divide-before-multiply` | 1 | Intentional quantization in `_sellRate`: price impact is floored in bps before interpolation. The configured compile-time fee ceiling still binds; a small precision discount is not an extraction or accounting defect. |
| `incorrect-equality` | 3 | Uninitialized-state sentinels. `_guardOpening`, `_openingBuyRate` and `pokeObserver` use `openedAt == 0`; an initialized pool on the deployment chain has a nonzero block number. The opening deadline is checked separately and cannot be extended for an existing pool. |
| `uninitialized-local` | 3 | Intentional Solidity zero initialization for `dev`, `rwa` and `community` in `_accrue`. When `sellTaxBps == 0`, those shares remain zero and the remainder goes to LP; the branch avoids division by zero during an independently configured opening buy fee. |
| `unused-return` | 2 | Intentional partial slot0 reads for the pre-swap price and accumulator's post-swap price/tick. Discarded fee fields do not authorize an operation. |
| `assembly` | 2 | Informational fixed-slot transient pre-price snapshot/read. Operative callbacks require the immutable PoolManager. No external observer or recipient executes from the reviewed swap callbacks. |
| `unindexed-event-address` | 2 | `RecipientsSet` and `ObserverSet` have less convenient address filtering. Event indexing does not change access control or fund movement. |

## OmertaSwapRouterV2 — 8 diagnostics

| Rule | Count | Disposition and source reasoning |
| --- | ---: | --- |
| `arbitrary-send-erc20` | 1 | False positive for unauthorized payer selection. `swap` constructs `request.payer` exclusively from `msg.sender`; it hashes the complete payload. `unlockCallback` requires the immutable manager, a pending callback and the identical hash, then consumes the pending flag before interactions. The input token and transfer destination are fixed OMR/manager, and outputs go to that same payer. A caller cannot substitute an approved third-party payer. |
| `reentrancy-balance` | 1 | No demonstrated reentrant stale-balance path for the reviewed token. OMR `safeTransferFrom` has no recipient callback; the surrounding balance difference and `manager.settle()` must each equal the actual requested input. The before-transfer balance intentionally measures the transfer, rather than valuing temporary manager custody as free assets. |
| `reentrancy-benign` | 3 | Guarded lifecycle. `swap` is `nonReentrant`, including wallet registration and manager unlock. The callback is manager-only/hash-bound and consumes its one-shot flag before `manager.swap`; `_nativeSpent` comes from its authenticated actual delta. After unlock the router clears temporary accounting before refunding. A payout recipient cannot start another router swap while the outer guard is held or impersonate the manager callback. |
| `timestamp` | 1 | Intentional caller-supplied expiry. Deadline discretion does not waive separately enforced actual-delta `minOut`, `maxInput` or native-funding limits. |
| `cyclomatic-complexity` | 1 | Informational control-flow complexity in the two-currency settlement callback. No vulnerability follows from the branch count. |
| `low-level-calls` | 1 | Checked native refund to the original caller after temporary state is cleared, while `nonReentrant` remains active. Failure atomically reverts the transaction; it cannot redirect another caller's funds. |

## OmertaPoolManagerV2 / OmertaProtocolFeesV2 — 6 diagnostics

| Rule | Count | Disposition and source reasoning |
| --- | ---: | --- |
| `divide-before-multiply` | 3 | Intentional split of the already-rounded fee in `_accrueTradeRevenue`. Developer/RWA/community shares round down and POL receives the remainder, so their sum equals the exact collected fee. Replacing this with independently rounded gross-volume shares would change that policy. |
| `missing-zero-check` | 1 | `setProtocolFeeController(0)` is owner-only and disables the optional controller. Normal swaps and the immutable trade-revenue fee are not conditioned on a nonzero controller; no attacker receives authority or funds from zeroing it. Operational configuration remains separately reviewable. |
| `dead-code` | 1 | `_isUnlocked` is an unused internal override in the local ProtocolFees abstraction. Informational cleanup, not a reachable bypass. |
| `low-level-calls` | 1 | `_checkPoolKey` first requires the approved hook operator and forbids before-swap return-delta permission, then checks the hook `poolManager()` probe's success, 32-byte length and exact manager address. Runtime approval remains a trust boundary, not something a getter proves by itself. |

## OmertaGenesisCoordinatorV2 / GenesisPlayerSale — 21 diagnostics

| Rule | Count | Disposition and source reasoning |
| --- | ---: | --- |
| `reentrancy-balance` | 2 | Intentional before/after token-spend checks around fixed PositionManager/Permit2 calls. Vendored `Permit2.approve` only changes allowance storage and emits an event; it calls no token or recipient. PositionManager uses ordinary ERC721 `_mint`, not a receiver callback. Reviewed hook/token paths add no recipient callback. Both migration entry points hold the coordinator guard, dependencies are codehash checked, and final position key/owner/liquidity plus native/token spending are verified. Preexisting PositionManager native dust is included in the spend baseline; forced-balance regression verifies surplus does not create residual claims. |
| `reentrancy-no-eth` | 2 | `migrate` intentionally admits exactly the bound sale's `finalizePlayerProceeds` callback while `_migrating` is true; it additionally requires released state, exact accepted ETH and no prior success. The outer guard remains held, `GenesisPlayerSale.releaseProceeds` is guarded, and errors propagate without a catch that turns failed migration into refund eligibility. `checkpointAuction` itself is `nonReentrant`; price storage occurs only after the fixed auction's finalized/graduated parameter read returns a nonzero price. |
| `incorrect-equality` | 1 | `GenesisPlayerSale.settle` checks `closesAt == 0` and `requested[wallet] == 0` as unopened/nonparticipant sentinels. Valid contributions require positive ETH; phase, deadline and one-time settlement conditions apply separately. |
| `unused-return` | 5 | Intentional unused values: the manager's returned initialization tick, auction `tokensSold` in the migration read, both unused auction fields in the price checkpoint, PositionManager's packed position metadata, and slot0's non-price fields. The coordinator supplies the initial sqrt price, verifies finalized price/proceeds, independently computes matching reserved-token liquidity, and checks minted position key/owner/liquidity. None of the ignored values is a transfer-success or authorization boolean. |
| `reentrancy-benign` | 1 | Success and residual-credit writes occur only after the verified atomic migration path. The outer guard, authenticated sale callback, reviewed fixed callees and postconditions prevent a second migration before these writes; a failure rolls back sale release, auction sweep and pool initialization together. Exact nested-unlock rollback and successful retry are tested. |
| `reentrancy-events` | 1 | `Migrated` deliberately follows successful external settlement and all postconditions. The guarded, one-time migration path prevents an attacker from obtaining a second successful migration event through a recipient callback. A later revert removes the event. |
| `timestamp` | 6 | Intended sale phase schedule: constructor deadlines, `open`, `contribute`, `settle`, `releaseProceeds` and `cancel`. Release/settlement require time strictly before migration deadline; cancellation requires reaching it. Timestamp discretion at a boundary can determine which specified phase is available but cannot make both release and cancellation succeed or create a privileged refund override. |
| `low-level-calls` | 2 | `withdrawResidual` zeros only the caller's own credit before its checked transfer and holds `nonReentrant`. Sale `refund` sets the caller's one-time refunded flag before its checked transfer, holds `nonReentrant`, and enforces released/cancelled phase plus requested/accepted accounting. Failure reverts the accounting change. |
| `unindexed-event-address` | 1 | `Bound` omits address indexing. Informational log-filtering ergonomics; binding remains one-time and configurator-only. |

## Verification method

Manually traced callers, payload provenance, fixed dependencies, side effects, state writes,
integer bounds and rollback behavior for each rule group. The source-to-sink and
false-positive checks were informed by the pinned Trail of Bits `fp-check` skill and its
standard-verification/false-positive-pattern references. Hook review also used the
recorded Pashov execution/access/boundary/invariant and Plamen external/state-trace passes.
This does not claim the full upstream orchestration or every available detector/proof ran.
The parent report retains executed regression/fuzz/invariant commands and their results.
