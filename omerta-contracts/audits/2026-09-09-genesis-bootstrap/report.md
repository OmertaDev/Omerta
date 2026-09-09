# Genesis bootstrap and launch-integration amendment — 2026-09-09

This review addresses the production deployment-order defect discovered while preparing the owner's
Genesis setup. The v4 oracle can now exist before the auction without supplying a price. The
controller and fixed POL vault can therefore bind that final oracle before CCA creation, bind the
created auction before bidding, and advance through migration and a complete oracle warmup.

This is a source and local rehearsal conclusion. It does not authorize or attest a mainnet
deployment, Safe signing ceremony, funding, production key installation, or activation. The existing
September 8 evidence packages remain unchanged and describe their original revisions and limits.

## Revision and scope

Base commit: `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`. The working tree includes earlier staged work
and this amendment. The final package's source manifest, compiler metadata, artifact hashes and
copied source bytes identify the reviewed state; the base commit alone does not identify it.

The material changes are the v4 oracle and deployment script; the v4 worker's bootstrap, snapshot
and recovery handling; automated CCA preflight, auction binding and release evidence; unsigned
liquidity deployment startup verification; and the real-stack fork harness. Current caller/dependency
snapshots are retained without asserting that every snapshotted file received a new full audit.

The release inventory now covers 75 source paths and 13 contract artifacts. The compiled-source
snapshot also includes imported Solidity dependencies. Existing liquidity contracts retain their
economic parameters and responsibilities: character mint fees remain 100% DEV, and the previously
approved revenue and LP-fee splits are unchanged. Optional Bank activation is excluded.

## System and authority model

The oracle permanently binds the exact OmertaHook, PoolManager, OMR, native-ETH pool key and period.
Before initialization, its quote is `(0,0)` and `baselineInitialized` is false. Its first real
initialized sample changes only its baseline. A later sample requires a full `PERIOD`; overdue
windows are discarded and must warm again. Direct early updates revert; exact-source observer
calls can no-op. No keeper supplies a price or chooses another pool.

The POL vault holds the actual PositionManager NFT, pins the oracle and dependency runtimes, and
enforces its custody, liquidity floor, warmup and spending restrictions. The lifecycle controller
must be owner-bound to the exact auction before bidding starts. Its permissionless jobs can
checkpoint, migrate, adopt a qualifying vault-owned position and release funds only to the fixed
recipients. Transaction success alone never establishes successful LBP migration.

The unsigned tooling verifies runtime and getter bindings from a single canonical snapshot,
rechecks freshness and the controller's ArbSys clock, verifies the official CCA factory's CREATE2
prediction from exact nested launch bytes, and simulates the Safe-only binding. Full-artifact
commitments include identities such as the keeper and oracle that do not appear in launch calldata.
The release manifest distinguishes pending creation from a simulated, still-unsubmitted binding.

The dedicated oracle worker uses same-block source observations. Bootstrap uses journal key `-1`,
outside the real uint32 timestamp domain, so a valid timestamp-zero baseline remains usable. Signed
transactions are persisted before broadcast. A prepared update waits if canonical state no longer
allows execution. If a confirmed update is no longer reflected in canonical oracle state, the
worker alerts `reorg_requires_review` and blocks new signing pending explicit reconciliation.

## Review method

This amendment follows [the repository's agent-led policy](../../SECURITY-REVIEW-POLICY.md). It uses
the pinned Pashov invariant, boundary and execution-trace methods; Plamen cross-function state and
multi-step operation tracing; and Trail of Bits authority/call/assumption mapping. Their exact
commits, inspected resources, adaptations and source hashes are retained in `oracle-review.json`
and `review-genesis-integration.md` in the raw evidence. This was an adapted four-agent workflow,
not an invocation of every upstream orchestrator or tool.

The review followed source callees through the pinned Launcher, LBP strategy, CCA factory,
controller, vault, hook, worker journal and receipt accounting. It tested time boundaries, immutable
identity, creation and binding domains, stale snapshots, recipient substitution, source/manifest
replay, timestamp wrap, reorg-related recovery and delayed receipt handling.

## Findings and disposition

| ID | Impact and evidence | Disposition |
| --- | --- | --- |
| GBOOT-01 | Launch-blocking deployment cycle: the vault/controller require the final oracle before the auction, while the original oracle required pool initialization that occurs only after the auction. The old-source regression fails with `PoolNotInitialized`. | Fixed with explicit unavailable bootstrap and a real baseline plus full subsequent period. Unit, real-hook, invariant and full fork retests pass. |
| GBOOT-02 | The optional controller launch fields lacked the complete deployed binding preflight and generated pre-start auction-binding operation. The old release inventory omitted the integrated lifecycle scope. | Explicit automated mode, full runtime/getter checks, factory-derived binding payload and expanded release requirements. Adversarial checks and the real created-CCA binding pass. |
| GBOOT-03 | The splitter's immutable Vig address depends on a reserved CREATE sequence. Prerequisite transactions or pending nonce collisions could invalidate an offline prediction. | Added approved-plan startup verification; 16 checks cover nonce, code, empty destinations, canonical snapshot and splitter commitments. The verifier cannot reserve a nonce or replace exclusive deployer control. |
| GBOOT-REVIEW-01 | P2: readiness could be published after awaited RPC work crossed the start or freshness deadline. An independent pre-fix clock proof was accepted incorrectly. | Freshness and live-clock checks run after the final awaited read. Boundary proofs reject crossed start, aging during reads and reorged snapshots. |
| GBOOT-REVIEW-02 | P2: release ceremony compared L2 block identity with the distinct ArbSys auction clock. | Separate `blockNumberish` evidence governs scheduling; L2 block/hash remains snapshot identity. Independent distinct-clock tests pass. |
| GBOOT-REVIEW-03 | P2: old binding evidence could be reused after changing keeper or oracle while leaving the launch calldata digest unchanged. Both variants were reproduced. | Binding/readiness evidence commits to the complete rebuilt artifact; both replay variants are rejected. |
| GBOOT-K01 | A prepared bootstrap update could be rebroadcast after pool initialization was reorged out, wasting gas on a known-invalid update. | Hold the same prepared bytes while initialization is absent; resume those exact bytes when eligible. Independent proof and native PostgreSQL regression pass. |
| GBOOT-K02 | An orphaned confirmed seed could silently remain in the current journal domain and stall further work. This also exposed an inherited confirmed-receipt finality assumption. | Explicit alert and signing block replace silent retry. Canonical receipt/history repair remains an operator reconciliation step, not an automatic replacement signature. |

No unresolved high or critical finding remains in this amended source/local-rehearsal scope. That
statement is not a guarantee of defect absence or a blanket review of all OMERTÀ rails.

## Executed validation

- The original oracle deployment regression: **expected failure, exit 1**, retained before the fix.
- Final oracle suites: **28 passed, zero failed**, including two fuzz tests at 512 runs and one
  stateful invariant at 512 runs × depth 500, reporting 256,000 calls and zero reverts.
- Coupled controller, POL vault, buyback and bond-health regressions: **99 passed, zero failed**.
  Three vault invariants each report 256,000 calls; five additional fuzz tests ran 512 cases each.
- Oracle worker regressions passed on both pg-mem and a newly created native PostgreSQL database.
  The independent final recovery proof passed 26 assertions. Chain, watcher, deployment perimeter,
  Genesis keeper, liquidity keeper and documentation regressions passed.
- CCA/preflight checks passed, including 46 adversarial rejection cases. Release checks passed for
  automated and legacy modes. Seven independent review checks, including three proof drivers,
  passed. The startup verifier's 16 checks use deterministic RPC mocks; its RPC integration is
  not represented as a production deployment or a nonce reservation.
- The complete real-stack fork uses the public Robinhood chain only for reads, then performs every
  mutation on its own loopback Anvil. It verifies the initial fork block hash and six official
  runtime hashes, keeps contract-size enforcement enabled, and uses native PostgreSQL with the
  production advisory-lock branches enabled. Five typed Genesis jobs settle in the durable journal
  with two-confirmation policy. Actual migration, POL NFT custody/adoption, first full oracle
  window, stale/rebaseline/retry recovery, independent price reconstruction and a 0.001 ETH local
  bond settlement pass. Final block, receipts and evidence hashes are in `validation.json` and the
  retained fork directory.

Focused checks are appropriate to these material changes. The unrelated full game suite was not
rerun for this amendment; prior full-suite totals are not represented as a new run.

## Static analysis and harness corrections

Slither 0.11.6 with native Solidity 0.8.26, optimizer 800 and Cancun completed successfully and
emitted 118 diagnostics. All 118 are assigned, none is untriaged: 99 unchanged dependency rows with
matching prior source hashes, 13 adjacent unchanged hook rows, five compiler-range informational
rows and one existing ABI naming-style row. The detector exit signal is retained as `-1`, distinct
from compilation success. Direct deployment-script AST compilation passed with exit 0. The initial
missing-Forge PATH failure and corrected scan are both retained.

Test-harness failures are retained separately from contract defects. The first Solidity integration
fixture contaminated process-wide environment between tests; the corrected fixture passes. Early
fork iterations exposed cached chain-head reads and an undrained Anvil stdout pipe; the harness now
disables read caching and drains both bounded diagnostic streams. The final rehearsal also enables
the native PG lock path, verifies initial fork identity, enforces code size, and requires the exact
decoded `NotPoolManager` and `PeriodNotElapsed` errors for its negative probes.

## Limits and remaining production work

The fork uses a disposable EOA in place of Safe governance and a documented ArbSys shim because
Anvil does not implement the precompile. It compresses auction blocks and advances oracle time;
it does not prove public-chain cadence, RPC liveness or Safe signing behavior. It deploys and
configures all four buyback executors but does not execute their operating jobs in this harness.
The earlier separately pinned liquidity-operation evidence and current coupled tests address those
paths; this amendment does not silently relabel them as this fork's coverage.

A TWAP establishes a price observation, not liquidity by itself. The separate vault custody/floor/
warmup checks remain essential. A post-confirmation reorg requires receipt/history reconciliation.
Startup proof is a point-in-time read; nonce exclusivity, each creation's receipt/runtime verification
and fresh pre-broadcast simulation remain mandatory.

Production still needs a clean release revision, final public budgets and caps, exact deployed
addresses/runtimes, fresh Safe and signer checks, the derived nonce sequence, actual Safe approval,
funding, deployment acceptance and explicit phase activation. No production key was read, no
production transaction was sent, and no production configuration was changed by this amendment.
