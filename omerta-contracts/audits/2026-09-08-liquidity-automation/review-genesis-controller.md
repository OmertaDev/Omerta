# Genesis lifecycle controller boundary review

Date: 2026-09-08. Release phase: local implementation and regression evidence. No live auction,
deployment, funding, privileged configuration or activation transaction was performed.

## Scope, source and dependencies

Reviewed the complete new `GenesisLifecycleController`, its calls to the pinned CCA/LBP interfaces,
real `GenesisProceedsSplitter`, and real `ProtocolLiquidityVault` adoption/health boundary. Base
repository commit: `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`; reviewed work is dirty/new.

| File | SHA-256 at final executed regression |
| --- | --- |
| `src/GenesisLifecycleController.sol` | `de24da542644dd904ce9b3ccee2d2ad4b0864b432a35bd3a2aa0f023ac19945a` |
| `test/GenesisLifecycleController.t.sol` | `8824063a0d01b88da74a3322ed9ef0fbab0a1948b77f912de0d998b9912281a3` |
| `src/GenesisProceedsSplitter.sol` | `e1530a96908d359935e46f3f9a201a62950b74ba0b5fde6bdb19c15af004bc32` |
| `src/ProtocolLiquidityVault.sol` | `a769361fbd3926f4a360ae726722d5f830a30251e932fe01f2f01f60dfa276e0` |
| `out/GenesisLifecycleController.sol/GenesisLifecycleController.json` | `e8a3d25d6f81947cb41d75fa866a12bba61d24a722b1d6ff7266a564f5e3d450` |

Controller artifact: Solidity 0.8.26, optimizer enabled with 800 runs, Cancun target, normal
non-IR profile; deployed-bytecode template length 11,146 bytes. No concrete deployed address or
runtime identity is implied by a template hash. Forge 1.7.1 commit
`4072e48705af9d93e3c0f6e29e93b5e9a40caed8` executed the tests.

Read actual pinned callees under `output/comprehensive-audit/external`:

- LBP v3.1.1 commit `5ef0262b8e191360a212aac864a525dcf7a06605`: `MigratorParams.sol`,
  `PositionPlannerTypes.sol`, `ILBPStrategy`, `ILBPInitializer`, registration, `migrate`,
  `tryMigrate`, registration consumption and failure recovery. `MigratorParams.sol` SHA-256
  `2d9b159ea538ad32f9bd8b6d03a789b8e6946829aefc38e5d96b84109cc2a15e`;
  `LBPStrategy.sol` SHA-256 `e46086942efb106578d10e0e3b1e39cfd0cffeb6c3fef77c7d1e4933a5b4a435`.
- CCA commit `a56d42231e7bf048136d9d88fa61e8518c10c5ff`: concrete storage/getters,
  checkpoint and recipient-only currency/unsold sweeps. `AuctionStorage.sol` SHA-256
  `cb187d3139df99369f1289bed72bce6f157c709b27adb976ba61bfd8a5dbedaa`.
- Retained actual `cca-BlockNumberish.sol`, SHA-256
  `199200adf6482e85e401f16c2301d785a754f29dfb1281c424c012f43ebf0fad`.

The pinned Pashov access/execution passes, Plamen state/accounting/callback passes and Trail of
Bits trust-boundary/specification/property methods were applied as scoped in the repository review
policy. This is not a repeat of the complete upstream auction review. Excluded: full CCA bidding
economics, complete LBP planning, production fork behavior, concrete addresses/roles/Safe acceptance,
database locking/receipt ingestion and keeper operation. No independent static-analyzer run is
claimed in this subreport; the coordinating release package owns raw diagnostics and triage.

## System model and constraints

The owner commits exactly one future auction. The controller owns no token mint authority, core
ownership, arbitrary execution permission or LP transfer approval. Anyone may subsequently call
checkpoint, migration, foundation acceptance, unsold sweep and residual distribution; every path
has fixed destinations and phase/stop/dependency guards.

Binding checks the actual strategy's ABI-exact `MigratorParameters`: OMR/native pair, canonical pool
tuple, splitter residual recipient, foundation LP recipient, 1,653,750 OMR LP reserve, exact
`endBlock + 1` migration clock, ABI-encoded empty position list (the pinned strategy's full-range
fallback), and one allocation bracket starting at zero with a 3,750,000/10,000,000 rate (37.5%).
The constructor binds treasury to the splitter treasury, and foundation to the same manager,
pool, OMR and oracle. On-chain bytecode checks pin the provided direct runtimes.

| Entry point | Authority and boundary |
| --- | --- |
| `bindAuction` | Owner only, once, before the auction starts, exact strategy/auction/controller/foundation commitments. |
| `checkpoint` | Permissionless after the bound auction starts, while dependencies match and controller is running. |
| `migrate` | Permissionless in Migration; invokes only the fixed strategy and auction. A cleared registration and actual canonical pool state distinguish inner success/failure. |
| `acceptFoundation(id)` | Permissionless after successful migration. Actual vault independently proves NFT custody, canonical full-range pool, minimum liquidity, absent subscription and one-time adoption. No ownership or transfer permission is granted to caller/controller. |
| `sweepUnsoldTokens` | Permissionless wrapper around the CCA's recipient-only sweep. All received OMR, including later direct donations, goes only to the fixed treasury. |
| `distributeResidual` | Success splits actual splitter ETH by its fixed shares; failure returns ETH/token reserve to treasury. Already-recovered state is a no-op. |
| `setStopped` | Owner pause/resume of controller calls. Recovery through the controller requires resume. |
| Ownership | Two-step rotation retained. Renunciation rejected so a stop cannot become an irreversible loss of recovery authority. |

The block clock matches the pinned library's constructor-time detection of the ArbSys precompile
at address 100, including exact successful 32-byte responses. The selected mode is immutable and
the chain ID is separately pinned. ArbSys returns the Orbit chain block number; it is not interchangeable
with `block.number` on those networks. Oracle ages and POL warmup use timestamps, not block numbers.

`Live` requires initialized canonical pool, healthy actual foundation, positive/fresh/nonfuture oracle
observation and an observation at or after the foundation's entire warmup. Pool creation alone,
a successful outer migration receipt, or a recent observation made before foundation warmup cannot
establish live readiness. Core ownership remains with governance throughout.

## Confirmed findings and correction

### AUT-GEN-01 — incomplete owner commitment validation

Severity: **Low, owner-configured binding/economic-policy and liveness defect**. Before correction,
`bindAuction` checked auction getters and pool registration but never read `strategy.initializers`.
It accepted a registered auction whose strategy residual recipient differed from the committed
splitter, or whose actual migration clock differed from the announced clock. The same omitted
tuple contained LP ownership and allocation policy. Misconfigured owner-approved input could
therefore bypass the controller's claimed fixed launch policy or stall progression. No arbitrary
unprivileged rewrite of a correctly configured canonical strategy was established.

Correction: decode the exact pinned tuple and reject differing recipients, pool, reserve, clock,
full-range plan and 37.5% allocation. Constructor cross-contract treasury/manager/oracle bindings
were added. Focused regressions plus final integration suite passed.

### AUT-GEN-02 — chain-name clock switch differed from pinned Orbit detection

Severity: **Low, configuration-dependent liveness defect outside the two named networks**.
The previous implementation chose ArbSys only for chain IDs 4663/46630. The pinned library detects
it on every Orbit chain. A rehearsal/other Orbit deployment could thus compare parent-domain
`block.number` to CCA's different chain-block clock. The reproduced case returned 10 while ArbSys
returned 77. The two named production/test chains already selected the correct endpoint.

Correction: match pinned detection, pin the mode and reject failed/malformed subsequent reads.
Tests cover general Orbit detection, immutable behavior as `block.number` changes, both named
Robinhood chain IDs and precompile failure.

### AUT-GEN-03 — wrong declared width for the CCA sweep marker

Severity: **Informational ABI mismatch, theoretical upper-range liveness failure**.
Actual CCA `sweepUnsoldTokensBlock` is `uint256`; the controller declared `uint64`. Selectors match,
but a completed value above `uint64.max` made decoding revert and blocked onward token forwarding.
Such a block count is not a realistic current-network scenario. The exact boundary was reproduced
and corrected to `uint256`; the upper-range completed-marker test passes.

The genuine pre-fix source, artifact, test input and four failed regression outputs for the first
three findings are retained under
[`before-genesis-binding-fix`](../../../output/liquidity-automation/before-genesis-binding-fix/forge-before.txt).
Pre-fix source SHA-256 `a69d59d7cdd56092bbae34f44f828be8faa0391a504b48e3b488a447e894d871`;
artifact SHA-256 `8e87a087f5b076807d243d0ea54d10b85bea2fbec94182254c85a380b4f4df62`.
The command selected misrouted recipient, wrong migration/allocation, Orbit detection and upper-range
sweep tests against the actual pre-fix implementation: **0 passed, 4 failed, exit 1**, with the
expected missing rejection/incorrect clock/decode failure rather than a compiler failure.

### AUT-GEN-04 — renouncing a stopped controller could strand unsold tokens

Severity: **Low, irreversible owner-action-dependent recovery loss**. The inherited owner could
stop the controller then renounce ownership. No account could resume it, while CCA permits only
its fixed `tokensRecipient` (this controller) to sweep unsold tokens. A concrete executed proof
bound an auction holding 7 OMR, stopped and renounced the controller, then proved owner zero,
failed unsold recovery and failed owner resumption with the tokens still held by the auction.

The positive pre-fix reproduction passed, exit 0; retained source, artifact, test and output are in
[`before-genesis-renounce-fix`](../../../output/liquidity-automation/before-genesis-renounce-fix/forge-before.txt).
That intermediate source SHA-256 is `6c3ac320c73e88bf549acdca181f540e2fff754e273e909b3a41fba360bc7255`;
archived artifact SHA-256 `e3adf79d58c8cdab835d260d061dbcd23d31b27cdb7304a65ae3717d78e7568d`.
Correction rejects renunciation while retaining two-step owner rotation. The regression proves a
stopped controller retains governance, can rotate its owner, resume and recover the complete 7 OMR.

## Executed final evidence

```text
forge test --match-contract '^(GenesisLifecycleControllerTest|GenesisProceedsSplitterTest|BondLiquidityHealthTest)$' --fuzz-seed 0x20260908 -vv
```

Final result: **41 passed, 0 failed, 0 skipped; exit 0**. This comprises 26 controller tests,
six existing splitter tests and nine bond-health tests. The controller unsold-conservation property
and bond future-time property each ran 512 fuzz cases. Evidence:
[`forge-genesis-controller.txt`](../../../output/liquidity-automation/forge-genesis-controller.txt) and
[`forge-genesis-controller-exit.txt`](../../../output/liquidity-automation/forge-genesis-controller-exit.txt).

All controller fixtures use real OMR, PoolManager and GenesisProceedsSplitter. The dedicated POL
composition additionally uses the actual ProtocolLiquidityVault, PositionManager and pinned Permit2
runtime: mint a real full-range position into the vault, let a stranger trigger controller adoption,
verify no NFT approval or mint authority was granted, wait the full warmup, then establish Live.
Auction/strategy and oracle inputs remain explicit deterministic fixtures. The failure strategy
initializes the real pool inside a self-call then reverts it, catches that failure and returns an
outer success with consumed registration and recovered funds, matching the reviewed pinned branch.
This tests actual rollback/pool receipt classification without claiming a real CCA bidding run.

Two harness setup failures are retained: importing the real manager creation code into the POL IR
profile triggered the known Solidity 0.8.26 upstream swap Yul failure; the test instead deploys the
real manager's normal-profile artifact. An attempted missing Permit2 creation artifact was replaced
with the pinned `DeployPermit2` helper, as in the existing POL suite. Neither failure indicated a
controller defect. Final compiler output contains only the existing POL `renounceOwnership`
mutability suggestion; it does not affect execution.

No new controller-specific stateful invariant run is claimed. Its tested scope is fixed lifecycle
transitions, one-shot commitments/adoption, atomic rollback, caller neutrality, clock/health boundaries,
recovery, plus the fuzzed token conservation property. POL's independent stateful custody invariants
are recorded in its separate review.

## Residual limitations and conclusion

The controller gates its own calls. It cannot stop the separately permissionless upstream strategy,
splitter or already-live AMM. It observes external migration and permits fixed-destination recovery
after external failure, but it is not an auction cancellation or global market pause mechanism.

Canonical-pool initialization is a migration-success signal only with the reviewed OmertaHook
initialization authority and exact manager/pool deployment. Runtime hashes authenticate bytes against
the supplied initial choice; they do not authenticate that choice or detect unchanged-proxy runtime
with a changed implementation. Concrete dependencies, role bindings, initial auction config,
bytecode/immutable comparison and any upgrade controls remain deployment preflight requirements.

An unhealthy foundation or unavailable oracle keeps issuance readiness closed; this does not create
liquidity or promise market depth. Rejecting fixed recipients can delay atomic distribution.
Governance may stop controller progression and must resume it for its recovery paths. Wrong immutable
bindings require a replacement setup before launch; no retargeting mechanism was added.

All confirmed scoped defects were corrected and their regressions passed at the recorded source.
This evidence supports the local controller implementation, not production activation or a complete
new audit of CCA, LBP, THE BANK, signers or database authority.
