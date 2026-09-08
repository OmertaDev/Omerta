# Acquisition, registry, health overlay, and settlement gas pool review

Date: 2026-09-08. Source commit: `e1d0e8476b6f1ebf590b13bd07c072d9d9d33aee`.

This review covers the exact working-tree sources enumerated and SHA-256 pinned in
[`acquisition-inventory.json`](acquisition-inventory.json). The overall worktree was
dirty when review began; its state is retained in [`source-before.json`](source-before.json).
No production Solidity was changed by this review. New executable evidence lives in
`test/audit/ComprehensiveAcquisitionAudit.t.sol`.

**Disposition:** manual review found no confirmed exploitable vulnerability in the
implemented scope. This is a constrained conclusion about the source and release
phase below. The acquisition constellation remains an intentionally incomplete
development milestone and must remain unfunded and inactive. Settlement gas credit
integration and finalized RWA consumer correctness are separate, unproven boundaries
of this contract-only review. Test execution and static-analysis evidence are recorded
below; absence of a finding does not prove absence of defects.

## 1. Source coverage and method

The entire 4,860 lines of implementation and 851 lines of associated interfaces were
read. The machine inventory includes every explicitly declared function, modifier,
constructor, receive/fallback declaration and its source line. Generated public
getters were reviewed through their underlying state and relevant artifact tests.

| Implementation | Lines | Covered behavior |
| --- | ---: | --- |
| `AcquisitionVault.sol` | 994 | Legacy monolith: two-step ownership, operator lifecycle and signatures, ingress proposal/rotation, pause/readiness, native accounting and deposits |
| `AcquisitionAuthority.sol` | 1,148 | Constellation roles, exact assembly snapshots/getters/events, typed hashes and signatures, ingress caps and governance, finalization, deliberately closed unpause |
| `AcquisitionVaultCore.sol` | 542 | Live authority reads, exact ingress records, native custody/accounting, canonical caps/replay, unsolicited value, finalization |
| `AcquisitionConstellationFactory.sol` | 508 | Chain/configuration commitments, predicted CREATE topology, exact initcode/runtime hashes, bounded peer reads, atomic finalization |
| `PreVoteBudgetBook.sol` | 284 | One immutable authorization per day, current owner/pause checks, closed time calculation, accounting verification, evidence identity |
| `AcquisitionIntentExecution.sol` | 82 | Finalization and deterministic intent/attempt identities only |
| `AcquisitionReconciliation.sol` | 33 | Finalization/topology only |
| `StockTokenRegistryV2.sol` | 286 | Immutable version identity, first-registration decimals, three reverse indexes, conflict invalidation, closed-day snapshots and activation generations |
| `RwaHealthOverlay.sol` | 185 | Exact Safe caller, registry generation/head validation, seven-day inclusion interval, monotonic overlay generations and domain-bound evidence |
| `SettlementGasPool.sol` | 798 | Native contributions, terminal replay protection, bounded credit calculation, exact liabilities, recipient callbacks, delayed governance and successor migration |

Included interfaces: `IAcquisitionVaultV1`, `IAcquisitionAuthorityV2`,
`IAcquisitionIntentExecutionV2`, `IStockTokenRegistryV2`, `IRwaHealthOverlay`,
`ISettlementDataFeeSource`, and the migration interface declared inside the pool.

Methods were taken from the repository security policy's fixed checkouts:

- Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`: the senior-auditor plain-language
  model, reverse-path adversarial review, concrete attack tracing, and the
  execution/reachability/trigger/impact judging gates.
- Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`: the EVM token-flow-tracing skill,
  including unsolicited custody, accounting transitions, output validation and
  recipient side effects.
- Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`: context-building,
  specification comparison and property-based-testing skills. Checks followed
  callees and separated enforced invariants from external assumptions before
  producing a verdict.

Adaptation: this bounded subreview used direct source analysis and Foundry evidence
inside the root audit's parallel assignment. It did not execute the upstream Claude
workflow/orchestration scripts, create a separate agent for every function, or claim
their specific fan-out or independent-refutation artifacts. The tool instructions
and compiler semantics controlled over inaccurate upstream advice; in particular,
Solidity narrowing casts truncate and do not generally revert automatically.

Normative documents checked include the constellation amendment and Task 3, 4 and 5
freezes, the Registry V2 plan and lifecycle amendment, the H2 plan and clarification
addendum, and the settlement gas pool plan with its `CHAIN-DEPLOY.md` requirements.
Future-scope statements in these documents were not treated as implemented features.

## 2. System and privilege model

**Native acquisition custody.** Core is the only native custodian in the new
constellation. Let A/U/R/L/P denote available, unattributed, ordinary reserved,
reconciliation liability and reconciliation backing. The implemented accounting
reports backing `B = A + U + R + P`, shortfall `S = L - P`, deficit
`D = max(B - actualBalance, 0)`, and forced surplus
`F = max(actualBalance - B, 0)`. R/L/P cannot currently be changed by a production
entry point. A canonical deposit first repairs D, credits only the excess to A,
and consumes its *entire* received value from per-deposit, day, ingress-generation
and global lifetime caps. Donation synchronization adds only F to U. Current-Safe
reclassification moves U to A without moving native value or creating a canonical
deposit. Only the exact active, code-matching ingress can deposit canonically.

**Authority.** A contract owner controls proposals, disabling and ownership handoff;
the active operator has only the explicitly implemented operator capabilities.
Owner/pending-owner/operator/pending-operator/active-ingress/pending-ingress and
constellation addresses are reciprocally separated. Operator replacement requires
successor consent, the live generation/nonce, a maximum one-hour interval and a
chain/verifying-contract/action-bound EIP-712 digest. ERC-1271 uses bounded static
calls and exact return length. Core reads one fresh authoritative snapshot instead
of storing role mirrors. The assembly storage offsets are dependency/compiler
sensitive; existing artifact-backed storage/getter suites are part of the required
evidence whenever these dependencies change.

**Factory.** Anyone may advance a deployment, but only with the exact committed next
initcode; a public caller cannot nominate code or rearrange children. Every deployed
runtime must match its commitment and size limit. CREATE is phase guarded. Finalizer
calls are fixed, bounded, checked for empty return data, and followed by exact
topology validation. A failure reverts all finalization mutations atomically. These
checks prove consistency with supplied commitments; the owner still must verify
the intended source/bytecode when preparing those commitments.

**Registry and health.** Registry owner and publisher are trusted for their separate
curation and snapshot functions. Version identity fixes chain/ticker/token/provider;
name and decimals cannot be rewritten under an existing key. Activation can evict
up to three distinct conflicts and advances the activation generation. A published
snapshot retains its original identity and becomes unusable after a generation
change, including same-key reactivation. The overlay is an evidence contract: it
validates current registry generation and all three reverse heads, the exact Safe
caller and an increasing overlay generation. It does not authenticate provider
evidence or inspect a database episode. Finalized off-chain matching supplies those
semantics; arbitrary Safe-supplied nonzero hashes do not independently prove health.

**Settlement sponsorship.** Contributors receive no refund or ownership right.
Only the immutable gameplay-vault address may record a settlement key or choose its
executor and measured settlement span. Recorded credit is bounded by capped native
cost and unreserved balance. Credits are exact native liabilities, paid only to
their owner. The pool consumes a key even when paused, unfunded, capped or retired;
later funding does not retroactively pay it. Withdrawals use checks-effects-
interactions and a shared reentrancy guard. A recipient may donate received funds
back, but that is new unreserved sponsorship, not restored credit. Migration moves
only unreserved value, pins one successor, retires new credits, and leaves old
liabilities withdrawable from the predecessor.

## 3. Adversarial results and activation gates

No severity-rated exploitable finding was confirmed. The following limitations are
material release facts, not attacks manufactured from intentional staged behavior.

### AQ-PHASE-01 — Acquisition is deposit-capable but not an executable purchase rail

`AcquisitionAuthority.sol:589-593` always rejects unpause with
`LocalReadinessFailed(11)`. `PreVoteBudgetBook.sol:116-129` requires unpaused
authority, so its successful authorization logic is unreachable through the real
current authority even after finalization and funding. The Intent implementation
has only four public functions; its two business getters derive identities.
Reconciliation has only topology/finalization. Neither Core nor the legacy vault
contains a native outflow, refund or token recovery entry point.

Impact if mistakenly funded: the deployed immutable milestone has no implemented
spending/recovery path for that value. This is documented in Task 3 and Task 5 and is
not a newly discovered unprivileged exploit. **Disposition:** keep dormant; complete
the remaining intent/reconciliation/outflow/readiness work and re-review that exact
revision before funding or activation. The new real-authority dormancy test makes
the boundary executable without editing the production pause state.

### AQ-INTEGRATION-02 — Gas-pool correctness stops at the trusted gameplay-vault call

`SettlementGasPool.sol:282-314` accepts executor and measured gas only from the
immutable vault. A complete `src` search finds no call to `recordSettlementCredit`
outside this declaration. The current pool therefore does not establish outer
executor identity, the measured span, the one-outcome-per-transaction constraint,
or the guarantee that an isolated credit-hook failure cannot revert gameplay.

**Disposition:** these are mandatory tests and implementation work for the future
gameplay integration. The standalone pool suite cannot establish them. A future
canonical data-fee adapter also needs a chain-specific review, including excluding
unrelated calldata/computation and repeated whole-transaction fee charging. No
adapter is enabled by the pool constructor, and this review activates none.

### AQ-INTEGRATION-03 — Health evidence is not an on-chain oracle of off-chain truth

`RwaHealthOverlay.sol:45-115` applies exact local checks and registry identity, but
the private episode head, evidence provenance, reviewer identity and finalized
database state are outside the contract. A previously applied clearance remains
historically visible across a later registry activation; consumers must use the
generation and identity bound in the event, not merely a nonzero latest-ID getter.

**Disposition:** retain the H2 finalized consumer's generation/head comparison and
post-clearance reevaluation as required launch evidence. The new tests prove an
old payload cannot be resubmitted across reactivation even with a fresh overlay
counter; they do not prove PostgreSQL or finality behavior.

### AQ-CONFIG-04 — Runtime hash checks are identity checks, not semantic verification

`SettlementGasPool.sol:745-758` checks successor version, chain, gameplay vault,
predecessor, current owner and paused state. The source explicitly delegates
non-proxy semantics, pending ownership and complete successor behavior to deployment
review. Equivalent trust applies to ingress, source and registry runtime hashes.

**Disposition:** accepted documented trust boundary, not an arbitrary-Safe theft
finding. Do not interpret a hash match as a proof that a proxy implementation,
mutable dependency, data-fee formula or facade implements the reviewed semantics.
No concrete successor, active ingress, fee source or mainnet configuration was
provided to this subreview.

### Invalidated exploit hypotheses

| Hypothesis | Disposition and decisive enforcement |
| --- | --- |
| Force ETH to manufacture canonical deposits or reset global limits | Rejected: F enters U only; only active ingress creates deposits; the lifetime cap is stored separately from ingress generations. Fresh fuzz and cap-rotation tests cover the sequence. |
| Duplicate source event pays twice | Rejected within an ingress generation by the domain-bound deposit record sentinel; a new generation deliberately has a distinct deposit identity, while total value still consumes the global cap. |
| A deficit-repair deposit credits already-accounted value again | Rejected: `repair=min(value,D)`, `credit=value-repair`; fault-injection fuzz checks the independent accounting property. The forced balance decrease is not claimed reachable in current code. |
| A callback withdraws credit twice or a reverted recipient loses its claim | Rejected: liability is consumed before value transfer, nonreentrancy blocks repeat withdrawal, revert restores all state. New tests combine recovery with a contribution callback. |
| Ownership or ingress change leaves stale cached Core authority | Rejected: Core reads exact fresh Authority state and active ingress record on each call. |
| Same-key registry reactivation revives an old snapshot or pending clearance | Rejected: snapshot activation generation must equal the current generation; overlay compares current generation and three exact heads. |
| Lack of a reentrancy guard in BudgetBook or Registry metadata read permits writes during validation | Rejected for these call paths: external reads run under EVM `STATICCALL`, whose whole subtree cannot write. |
| Unpermissioned Factory deployment exposes arbitrary execution | Rejected: exact next initcode/runtime commitments, predicted addresses, phase guards and fixed finalizers constrain the public calls. |

## 4. Transfer and dependency analysis

| Asset / receipt | Entry | Exit | Accounting / unsolicited effect |
| --- | --- | --- | --- |
| Core and legacy-vault native value | Active canonical ingress; forced value | None in current milestone | Canonical caps account full incoming value; unsolicited value remains F/U until explicit classification |
| Passive ERC-20 at acquisition custody | Token transfer to predictable address | None | No token query, allocation or transfer exists; physical balance alone creates no protocol inventory |
| Gas-pool native sponsorship | `receive`, `contribute`, exact predecessor receipt, forced value | Self-only credit withdrawal; exact successor migration | `balance - outstanding` bounds new credits/migration; donations do not create a contributor liability |
| Registry/overlay | No payable entry | No value transfer | Record/evidence state only |

| External call | Expected output / side effects | Reviewed enforcement |
| --- | --- | --- |
| Authority snapshot, ingress record and Core accounting/cap | Fixed-width data; no writes | Fixed gas, exact byte length, canonical/semantic validation; no unbounded returndata copying |
| Successor ERC-1271 | 32-byte return beginning with magic value | Signature length cap, bounded static call, minimum pre/post gas; no mutation callback |
| Registry token `decimals()` | ABI `uint8`; no writes | Static metadata read on first registration; real token semantics are an external deployment dependency |
| Overlay Registry reads | Exact generation/version/reverse heads | Pinned immutable Registry; all relevant heads compared; no token transfer |
| Pool data-fee source | One 32-byte fee; no writes | 30,000 gas static call; exact runtime; malformed/revert/drift returns zero; result capped |
| Credit recipient | Arbitrary native callback | CEI, shared nonreentrancy and atomic revert; new refund-callback tests |
| Migration successor | Exact payable receipt | Old state committed before guarded call; a failed receipt rolls back; semantic provenance remains the declared configuration trust boundary |

Plamen pass completion: entry points, balance tracking, exits, unsolicited native
and ERC-20 matrix, output checks and callback side effects were completed. Native
and ERC-20 are separate: there is no mixed sentinel-token branch, ERC-20 swap,
approval or wrapped-native conversion in this scope. Staking-receipt, ERC-4626 share,
AMM, leverage and liquidation mechanics are inapplicable. Unknown concrete token
or adapter semantics were not assumed verified. No production token-returning call
exists in this implemented scope.

Relevant imported implementation boundaries include OpenZeppelin `Ownable`,
`Ownable2Step`, `Pausable`, `ReentrancyGuard`, `EIP712`, `ECDSA`, the typed-hash helper,
short strings and storage slots. Direct access/signature/guard implementations were
read and their calls followed. The repository vendors these files without a verified
single OpenZeppelin package-release pin; inspected headers identify updates through
v5.6.0, and the root manifest pins the actual dependency/source bytes. This report is not an independent audit
of all unused OpenZeppelin functions or of the Safe implementation. Native EVM
transfer/revert semantics, Keccak collision resistance and secp256k1 remain standard
cryptographic/runtime assumptions.

## 5. Executed evidence

Compiler: Solidity 0.8.26, optimizer enabled with 800 runs, Cancun EVM. Canonical
Foundry restrictions compile constellation and health-overlay files via IR; other
files retain their configured compilation profile. Foundry binary:
`C:/Users/Jorge/.foundry/bin/forge.exe`, version 1.7.1.

The root audit owns the full-suite baseline and aggregate static-analysis output.
The new focused suite has eight tests in three contracts. Two are input-domain
fuzz properties; none claims a live exploit. It uses a clearly labeled nonce
factory to deploy the real production Authority/Core/Budget modules and mock Safe
callers; production Factory commitments remain covered by the existing real-Factory
and artifact-conformance suites. The only artificial corruption test uses `vm.deal`
to remove native backing and explicitly reports that precondition.

All eight focused tests passed in the retained affected regression run: four
`ComprehensiveAcquisitionAuditTest` tests, two `ComprehensiveRwaGenerationAuditTest`
tests and two `ComprehensiveSettlementCallbackAuditTest` tests. The two acquisition
fuzz properties each completed 512 runs. The inspected result is
[`affected-retest.log`](../../../output/comprehensive-audit/affected-retest.log);
the root package retains the command, seed and compiler settings.

The full baseline completed with 927 passed, one failed and zero skipped across
46 suites (928 tests). The failure was the AcquisitionVaultOperator artifact-source
hash assertion: the artifact binds LF source bytes, while the Windows read returned
CRLF. The narrow harness correction normalizes only CRLF pairs for that hash and
preserves the original source-vocabulary checks. The affected regression subsequently
passed all 169 tests across nine suites, including all 84 AcquisitionVaultOperator
tests and 19 supplementary tests (nine core, eight acquisition and two market).
The four supplementary fuzz properties comprise two core and two acquisition
properties; they are not four acquisition properties. The original failed baseline
remains retained separately from the passing regression.

The baseline's Registry V2 stateful campaign also passed its invariant over 512
runs and 256,000 handler calls, with zero reverts; its suite duration was 1,383.95
seconds. Full static accounting, other invariant campaigns and raw-log hashes are
recorded by the parent package and [`evidence-consistency.md`](evidence-consistency.md).

## 6. Scope-specific conclusion

The implemented permission, replay, arithmetic and custody boundaries reviewed
here did not yield a confirmed exploit. The result applies to the pinned source
with its dormant acquisition phase and standalone settlement/health boundaries.
It does not approve funding, deployment, migrations, a chosen fee source or
ingress, RWA execution/delivery, gameplay gas integration, an off-chain signer,
finality/indexer/database correctness or economic asset valuation.

Future stateful acquisition features, a change to snapshot layout or compiler,
new external adapters, different Safe/ingress/source implementations and the
gameplay credit hook reopen the affected review. Fee-recipient wallet selection
is separate from this subreview; no live destination was inserted or transaction
broadcast.
