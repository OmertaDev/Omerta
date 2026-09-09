# Fee routing, keeper funding, and liquidity static review

Review date: 2026-09-08. Release phase: local predeployment implementation. Source base commit:
`e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`, with the explicitly hashed working-tree changes below.
This review ran no remote-chain transactions, deployment, funding, role configuration, or activation.

The reviewed fee and keeper contracts satisfy the tested allocation, atomicity, replay, and finite
subsidy properties. No additional confirmed defect was identified in this subreview. All ten scoped
Slither scans completed with `success: true`; all returned diagnostics have retained dispositions.
This conclusion is limited to the source/configuration model below, and does not clear an unreviewed
runtime, arbitrary router, live database/indexer, production deployment, or the broader economy.

## Source and entry-point scope

| File | Working-tree SHA256 | Reviewed entry points |
| --- | --- | --- |
| `src/FeeRevenueRouter.sol` | `9c8839cdf09973e1f2469c508430d65e4d6ddeecd1eddb64ad7d807005b222a9` | constructor, `route`, `recoverForcedETH`, all policy/recipient bindings, `_checkRecipient`, `_send` |
| `src/KeeperGasVault.sol` | `343038aa0304a5ceee695b72f66b3160f71677b87e7f32c8b88917c4626b5722` | constructor, funding receive, allowlist, `refillAmount`, `topUp`, pause/resume, paused recovery, inherited ownership |
| `src/OmertaFees.sol` | `c08fa731db192a1af41ce3b68fe19c2a3575066c6f22a8ea2a836168701f1480` | all four payment entry points, legacy forwarding, non-mint router binding/revalidation, recipient and price administration, forced-balance sweep |
| `test/LiquidityRevenueAutomation.t.sol` | `db89bf782d43024388825f1c975b41198112cfbac0d9167b683634e2877901c2` | real fee/router/gas contracts, hostile recipients, mutable policy fixture, forced ETH, independent stateful accounting models |

Compiler: Solidity `0.8.26+commit.8a97fa7a`; optimizer enabled, 800 runs; EVM Cancun. Forge 1.7.1
commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`. Exact artifact hashes and test-output hash are in
[`revenue-gas-evidence.json`](../../../output/liquidity-automation/revenue-gas-evidence.json).
No deployed runtime/address is inferred from a constructor bytecode template.

The static scope also includes `LiquidityBuybackExecutor`, `ProtocolLiquidityVault`,
`GenesisLifecycleController`, `BankBufferVault`, `OmertaBond`, `OmertaHook`, and
`GenesisProceedsSplitter`, plus their imported compilation closure. Their exact source hashes appear
in [`slither-runs.json`](../../../output/liquidity-automation/static/slither-runs.json); the recursive
source inventory and every diagnostic are in [`triage.json`](../../../output/liquidity-automation/static/triage.json).
The full behavioral reviews of these adjacent contracts remain in their separate scoped reports.
Included Denari/Transmuter/FlashGuard dependency diagnostics do not expand this into a new complete
THE BANK or ERC-4626-adapter audit.

## System model and adversarial passes

`OmertaFees` is the entitlement-event source. A successful payment increments its monotonic nonce
once; every nonzero native delivery and router call must succeed before the gross entitlement event
survives. Mint always sends the complete payment to DEV and emits a zero Vig share. It does not enter
the optional router, even when that router's advertised policy has drifted or another recipient rejects.

For respawn, reroll and package fees, an enabled reviewed router receives exactly `msg.value` and the
fee nonce. Only its immutable fee rail can call `route`. The router rejects zero payments and replayed
or older nonces, then sends 25% to Vig, 10% to treasury, 15% to community and the remaining 50% plus
rounding dust to DEV. A recipient's rejection reverts all previous transfers and both contracts'
nonce changes. Zero-value legs are skipped. Duplicate recipients accumulate their declared shares
without losing value. Direct ordinary transfers revert; force-sent ETH is separate from fee revenue
and can only be returned to the immutable treasury through guarded recovery.

The fee owner may explicitly disable or replace the non-mint router. Recipient rotation while a
router is active is rejected, preventing accidental stale binding. Configuration and every routed
payment check the router's policy ID, fee rail, DEV/Vig recipients and all four fractions. These are
configuration checks: a hostile owner-chosen implementation can lie in its getters. The deployment
workflow must verify the actual reviewed direct router bytecode and intended treasury/community
destinations. Mint remains independent of that optional implementation.

`KeeperGasVault` holds separately supplied operations ETH and no claim on fee entitlements. Any caller
may trigger payment only to an owner-allowlisted keeper. The amount is the minimum of target-balance
deficit, per-refill cap, remaining shared UTC-day budget and available vault balance. The contract
records the global spend and the keeper's next refill time before calling it. A rejecting receiver
rolls everything back; reentrant same-keeper or other-keeper attempts are guarded. Reallowlisting,
adding a recipient, pausing or resuming does not reset the budget or prior cooldown. Only the owner
may pause/recover, and recovery is allowed only while paused and only to that owner.

Passes applied from the pinned policy methods:

- Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: access-control, execution-trace, arithmetic,
  invariant and boundary reasoning over exact native flows, nonce order and mutable configuration.
- Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: the `agents/depth-token-flow.md` entry/exit,
  donation and callback checks, with explicit external assumptions rather than treating a helper name
  as proof. The tests use real local production contract code and explicitly hostile fixtures; no
  production-on-chain evidence is claimed.
- Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: scoped context/trust-boundary building,
  independent invariant models, and the `fp-check` claim→caller→sink→guard verification approach for
  static leads.

These are selected passes adapted to native Windows, Forge and the available team. They are not a
claim that a full upstream orchestration, twelve additional agents, external vulnerability database,
or full dependency audit ran. PostgreSQL concurrency, voucher signing, NFTs and AMM pricing are not
part of these native fee/gas contracts; adjacent reviews cover applicable integration behavior.

## Executed fee/gas evidence

Command, run 2026-09-08:

```text
FOUNDRY_INVARIANT_RUNS=128
FOUNDRY_INVARIANT_DEPTH=64
forge test --match-path test/LiquidityRevenueAutomation.t.sol --fuzz-seed 0x20260908 -vv
```

Result: **28 passed, 0 failed, 0 skipped, exit 0**. There are 17 revenue unit/fuzz tests, 9 gas
unit/fuzz tests, and 2 stateful invariant properties. Four fuzz properties each ran 512 cases. Each
invariant ran 128 sequences of 64 calls, totaling **16,384 handler calls, zero reverts**. Successful
fee payments and gas refills are primed in setup; invariants also assert independent expected
recipient balances, nonce state, operation funding conservation, per-period spend and cooldown state.

The retained [`forge-revenue-gas-final.txt`](../../../output/liquidity-automation/forge-revenue-gas-final.txt)
covers exact-value and all fee kinds, gross entitlement/distribution events, one-wei dust, mint bypass,
all recipient failures, wrong caller/replay, each recipient reentering all four payment paths and router
recovery, ten mutable-router policy fields, disable/rotation/re-enable transitions, forced balances,
keeper shared-cap exhaustion, UTC-day change, cooldown persistence, callback rejection, insufficient
funding and paused owner recovery. The only compiler warning is `selfdestruct` in the test-only
constructor used to produce a force-sent native balance. No production `selfdestruct` was added.

## Static execution and complete triage

Slither 0.11.6 ran the ten targets through direct solc, avoiding Crytic Compile's incompatible split
Foundry build-info reader. All scans use optimizer 800 and Cancun; only `ProtocolLiquidityVault`
uses via-IR. Crytic Compile rereads Foundry configuration and selects the solc-select executable;
the raw logs show that actual command. Its SHA256 equals the requested native compiler's SHA256:
`537fd8d8d4a0433a971bf456fc06f7b021cdcee27b252f74da49e0d8559aeb67`.

| Target | Returned diagnostics | JSON success |
| --- | ---: | --- |
| FeeRevenueRouter | 41 | true |
| KeeperGasVault | 45 | true |
| OmertaFees | 46 | true |
| LiquidityBuybackExecutor | 95 | true |
| ProtocolLiquidityVault | 138 | true |
| GenesisLifecycleController | 77 | true |
| BankBufferVault | 88 | true |
| OmertaBond | 85 | true |
| OmertaHook | 82 | true |
| GenesisProceedsSplitter | 70 | true |

There are **767 diagnostic occurrences, 293 unique detector IDs and zero untriaged IDs**. Repeated
dependency diagnostics appear in multiple compilation units despite `--exclude-dependencies`; none
were silently omitted. Dispositions are 80 false positives, 38 accepted design constraints and 175
informational items. Raw Slither exits are `-1` because diagnostics exist; JSON success and retained
detector records establish completed analysis, not a zero process exit or a claim of a clean scan.

[`triage.md`](../../../output/liquidity-automation/static/triage.md) contains every full detector ID,
claim, source location, occurrence and reasoning. The companion JSON can be reconciled directly to
each raw scan. [`run-static.ps1`](run-static.ps1) reproduces acquisition without overwriting existing
evidence. [`build-static-triage.mjs`](build-static-triage.mjs) materializes the explicit manual decisions
and refuses unknown rules, missing raw results or stale target hashes; it does not perform an audit.

Material leads were checked rather than dismissed by rule name: keeper arbitrary-send is constrained
by its owner allowlist; POL native sends reach only fixed recipients; the reentrancy-family results
are bounded by shared guards, one-use v4 callback authority and exact settlement checks; router zero
checks occur in a helper; optional guardian/role zero values revoke authority; strict zero equalities
reject empty actions; full-precision `mulDiv` XOR/division and BitMath shifts implement deliberate
algorithms; ignored hook return bytes are already selector-validated by their callee. Timestamp,
integer rounding, naming, complexity and assembly inventory signals retain their explicit scope and
operational limitations instead of being described as unconditionally safe.

## Residual conditions and conclusion

- A compromised allowlisted keeper can spend its finite operations allowance by repeatedly reducing
  its balance and waiting out the cooldown. The contract does not attest gas usage. UTC-day budgets
  are calendar buckets, so two adjacent days can each spend a full budget; they are not rolling-day caps.
- Fixed fee recipients may reject ETH and stop a routed payment. This is atomic availability failure,
  not partial entitlement issuance. The Safe must disable/replace the router to rotate those destinations.
- Router policy getters cannot authenticate arbitrary implementation semantics. Actual direct code,
  constructors, Safe ownership and recipients must be verified before configuration. No live policy
  snapshot or funding level was asserted here.
- Inherited ownership renunciation remains possible for the gas vault and fee rail. Governance must
  not renounce ownership while future administration or paused recovery is required; no ordinary caller
  can cause that governance action. The genesis/POL contracts' separate renunciation protections and
  recovery semantics are documented in their own reviews.
- A successful review of these files does not promise historical active AMM depth, production keeper
  availability, claim-funding reconciliation, real ERC-4626 adapter behavior or signer correctness.
  Those properties require their corresponding scoped evidence and exact deployment parameters.

For the hashed working-tree implementation and local release phase, the fee allocation and keeper
subsidy paths have passing adversarial and invariant evidence, and the ten-target static inventory is
fully triaged. No in-scope unresolved confirmed vulnerability emerged from this subreview. Material
source, dependency, recipient, router or authority changes reopen the affected conclusions.
