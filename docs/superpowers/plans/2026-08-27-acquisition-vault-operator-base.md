# Acquisition Vault Operator and Custody Base Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> `superpowers:subagent-driven-development` (recommended) or
> `superpowers:executing-plans` to execute this plan one task at a time. Use
> `superpowers:test-driven-development` for every source task. Do not begin a
> dependent task until the preceding independent review gate is approved.

**Goal:** Implement and independently approve the dormant O1 operator-authority
and A1 native-ETH custody/provenance base of one final, non-upgradeable
`AcquisitionVault`, without exposing any native-ETH outflow, purchase,
reservation, reconciliation disposition, token movement, deployment, funding,
signing, or production reachability.

**Architecture:** O1 establishes the Safe-owned role state machine, EIP-712
payloads, one operator generation, one future shared outflow nonce, and bounded
EOA/ERC-1271 successor consent while exposing no financial transfer. Only after
O1 is independently approved does A1 add exact scalar native-ETH accounting,
forced-surplus classification, Safe reclassification, one delayed code-pinned
canonical ingress, capped replay-safe deposits, and immutable pre-vote budget
evidence. A1 keeps all future reservation/reconciliation totals at zero and
exposes no purchase or outflow path. A3, R, and O2 later add bounded records and
the only operator ETH-transfer surface; no intermediate source milestone is a
deployable release.

**Tech Stack:** Solidity `0.8.26`, OpenZeppelin `Ownable2Step`, `EIP712`,
`Pausable`, `ReentrancyGuard`, `ECDSA`, `IERC1271`, Foundry unit/fuzz/stateful
invariant tests, Cancun EVM, optimizer runs `800`.

**Authority:**
`docs/superpowers/specs/2026-08-26-grill-completion.md` and
`docs/superpowers/plans/2026-08-26-grill-completion-umbrella.md`. Planning
evidence:
`.superpowers/sdd/2026-08-26-grill-completion-umbrella/operator-acquisition-plan-recon.md`.

## Completion and deployment truth

- The production artifact is one final, immutable-code `AcquisitionVault`.
  There is no proxy, initializer, upgrade hook, storage gap, wrapper fallback,
  delegate target, linked mutable library, or intermediate deployment.
- O1 and A1 commits are source/test milestones only. They remain unimplemented
  until their tasks land, and remain undeployed, unfunded, unsigned,
  unconfigured, unactivated, and unreachable from production after they land.
- This plan adds no deploy script, address manifest, Safe transaction, signature,
  funding operation, private key, provider credential, RPC worker, backend route,
  UI control, feature selector, publisher, or cutover. It does not change the
  currently reachable legacy RWA path.
- The exact supported chain is `4663`. This is a repository compatibility
  constraint and EIP-712/deployment wall, not a recovered interview fact about
  another canonical chain.
- No task may deploy, push, fund, sign, send a Safe transaction, change a live
  role, move ETH/tokens, or claim external audit/finality/provider evidence.

## Frozen authority boundary

| Capability | Safe owner | active `mainOperator` | nominee | public/backend | O1/A1 result |
|---|---:|---:|---:|---:|---|
| Nominate/cancel/disable operator | yes | no | no | no | O1 |
| Accept delayed nomination | no | only if exact nominee | exact nominee | no | O1 |
| Direct renounce/replace/invalidate nonce | no | yes | no | no | O1 |
| Pause | yes | yes | no | no | O1 |
| Unpause | yes | no | no | no | O1/A1 local gates only |
| Propose/cancel/activate/disable ingress | yes | no | no | expiry only | A1 |
| Reclassify unattributed ETH | yes | no | no | no | A1 |
| Authorize pre-vote budget evidence | yes | no | no | no | A1 |
| Canonical deposit | no | no | no | exact active ingress only | A1 |
| Transfer native ETH | **no** | **no until O2** | no | no | absent |
| Create reservation/purchase/attempt | no | no | no | no | absent until A3 |
| Reconcile/dispose uncertain facts | no | no | no | no | absent until R |
| Move/approve OMR or Stock Tokens | no | no | no | no | permanently absent |
| Gas-pool/gameplay/upgrade/recovery authority | no surface | no surface | no | no | absent |
| Burn/zero recipient/arbitrary calldata | no surface | no surface | no | no | absent |

The browser/backend may eventually prepare exact packages or relay already-signed
O2 messages. It never receives Safe authority, and active-operator replacement
remains a direct wallet transaction rather than a backend relay.

Role separation is bidirectional and revalidated whenever a role is proposed,
accepted, activated, or used:

- every nonzero owner candidate remains a contract Safe and cannot equal the
  current owner, vault, RegistryV2, current/pending operator, or active/pending
  ingress;
  validate at both `transferOwnership` and `acceptOwnership` because code and
  other pending roles can change between those calls;
- `transferOwnership(address(0))` is allowed only to cancel an existing pending
  ownership transfer, matching the necessary `Ownable2Step` cancellation seam;
  zero can never accept, become owner, or reach `renounceOwnership`;
- operator nomination, acceptance, and replacement reject the owner,
  `pendingOwner`, vault, RegistryV2, active ingress, and pending ingress;
- ingress proposal, activation, and every canonical deposit reject the owner,
  `pendingOwner`, vault, RegistryV2, current operator, and pending operator; and
- every direction rechecks the other live/pending identities. No earlier valid
  proposal gains authority after a colliding role changes during its delay.

## Frozen reason-code ABI

The V1 enum ordering is exact. `NONE` and an action-incompatible reason revert;
there is no `OTHER`, `UNKNOWN`, or burn reason.

```solidity
enum ReasonCode {
    NONE,                          // 0
    OUTFLOW_ACQUISITION,           // 1 — future O2 only
    OUTFLOW_TREASURY_REBALANCE,    // 2 — future O2 only
    OUTFLOW_SECURITY_RESPONSE,     // 3 — future O2 only
    OPERATOR_NOMINATION,           // 4
    OPERATOR_NOMINATION_CANCELLED, // 5
    OPERATOR_NOMINATION_EXPIRED,   // 6
    OPERATOR_DISABLED,             // 7
    OPERATOR_RENOUNCED,            // 8
    OPERATOR_REPLACED,             // 9
    OUTFLOW_NONCE_INVALIDATED,     // 10
    RISK_PAUSED,                   // 11
    RISK_UNPAUSED,                 // 12
    INGRESS_PROPOSED,              // 13
    INGRESS_PROPOSAL_CANCELLED,    // 14
    INGRESS_PROPOSAL_EXPIRED,      // 15
    INGRESS_ACTIVATED,             // 16
    INGRESS_DISABLED,              // 17
    UNATTRIBUTED_RECLASSIFIED,     // 18
    BALLOT_BUDGET_AUTHORIZED,      // 19 — pre-vote evidence semantics
    RECONCILIATION_DISPOSITION     // 20 — future R, Safe only
}
```

O1 accepts only `4..12` on their mapped actions. A1 accepts only `13..19` on
their mapped actions. Future O2 alone accepts `1..3`; future R alone activates
`20`. Every caller-supplied mutation has a nonzero `detailsHash`.
Permissionless expiry derives its details from the exact proposal ID and accepts
no caller-authored descriptive reason.

## Frozen accounting model and future bounds

All quantities are exact `uint256` wei:

```text
A = available
U = unattributed
R = sum live ordinary-reservation backing
L = sum live reconciliation liability
P = sum live reconciliation backing, P <= L
S = L - P
B = A + U + R + P
V = address(this).balance
D = max(B - V, 0)
F = max(V - B, 0)

totalLiability  = L
backedLiability = P
shortfall       = S
V + D           = B + F
V + D + S       = A + U + R + L + F
```

Ordinary reservations are encumbrances, not liabilities. A1 stores the scalar
totals but has no record constructor, so `R == L == P == S == 0` throughout A1.
Later nodes retain these literal bounds:

```solidity
uint256 public constant MAX_ACTIVE_ORDINARY_RESERVATIONS = 32;
uint256 public constant MAX_ACTIVE_RECONCILIATIONS = 32;
uint256 public constant MAX_OPERATOR_OUTFLOW_COMPONENTS = 67;
```

The future O2 ceiling is 67, not 66: one forced-surplus classification, one
available debit, one unattributed debit, 32 whole ordinary-reservation
cancellations, and 32 reconciliation-backing debits. A1 exposes none of those
record mutations or outflows. Deposit and budget history may grow only in keyed
mappings that are never scanned on chain; complete pagination/export belongs to
the later finalized backend mirror.

## Corrected pre-vote budget provenance

The vault authorizes a ceiling **before** the database ballot opens. It does not
know or bind the later winner, asset version, activation generation, token,
decimals, tally hash, catalog version, vote count, or result. Freeze:

```solidity
struct PreVoteBudgetInput {
    uint256 ballotDay;
    uint256 maxEthWei;
    uint64 purchaseUntil;
}

struct PreVoteBudgetAuthorization {
    bytes32 budgetId;
    uint256 ballotDay;
    uint256 maxEthWei;
    uint64 purchaseUntil;
    uint256 availableAtAuthorizationWei;
    uint256 accountingSequence;
    uint64 authorizedAt;
    bytes32 detailsHash;
}

function authorizePreVoteBudget(
    PreVoteBudgetInput calldata input,
    bytes32 detailsHash
) external returns (bytes32 budgetId);

function getPreVoteBudget(uint256 ballotDay)
    external view returns (PreVoteBudgetAuthorization memory);
```

The ID is independent of an unknown result:

```text
budgetId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_PRE_VOTE_BUDGET_V1"),
  uint256(4663),
  address(this),
  address(stockTokenRegistryV2),
  ballotDay,
  maxEthWei,
  purchaseUntil,
  accountingSequence
))
```

One record is immutable per `ballotDay`; there is no overwrite, cancel,
replacement, rollover, substitution, catch-up, reservation, or promise that
funds remain. The contract requires a current/future day, exact deterministic
`purchaseUntil == (ballotDay + 1) * 1 days + 2 hours`, safe `uint64`
arithmetic, nonzero amount/details, `maxEthWei <= available`, and zero current
`D` and `S`. It records the current accounting sequence but does not increment
it or move a bucket.

Contract authorization alone cannot prove finality or that a database ballot has
not opened. The later CB bridge must use its own Finalized Observation consumer
identity, lock, immutable inbox, applied checkpoint, and reducer. Before the DB
open transaction commits, it must prove the exact vault event is canonical,
finalized, fresh, gap-free, and applied, and match only:

```text
open.day           == budget.ballotDay
open.maxEthWei     == budget.maxEthWei
open.purchaseUntil == budget.purchaseUntil
finalized budget event time/block precedes openedAt
```

After close, the publisher separately joins the immutable budget record to the
independent winner/tally/catalog result. No RegistryV2, health, or getter cursor
may be borrowed; no backend timestamp, optimistic receipt, manual production
budget, fallback signer, inferred winner, or double-running authority substitutes
for that later bridge. CB is not implemented by this plan.

## Canonical V1 interface and evidence appendix

This appendix is the sole tracked ABI/evidence authority for O1/A1 RED tests.
Ignored recon is explanatory only. Implementers must not add aliases or copy the
obsolete closed-ballot result fields from earlier proposals.

### Constants and exact struct order

The following getters are generated by `public constant` declarations with the
shown Solidity return types:

| Getter | Type/value |
|---|---|
| `supportedChainId()` | `uint256`, exactly `4663` |
| `OPERATOR_NOMINATION_DELAY()` | `uint64`, exactly `48 hours` |
| `OPERATOR_ACCEPTANCE_WINDOW()` | `uint64`, exactly `7 days` |
| `INGRESS_PROPOSAL_DELAY()` | `uint64`, exactly `48 hours` |
| `INGRESS_ACCEPTANCE_WINDOW()` | `uint64`, exactly `7 days` |
| `MAX_AUTHORIZATION_LIFETIME()` | `uint64`, exactly `1 hours` |
| `MAX_SIGNATURE_BYTES()` | `uint256`, exactly `4_096` |
| `ERC1271_CALL_GAS()` | `uint256`, exactly `100_000` |
| `ERC1271_POST_CALL_GAS_RESERVE()` | `uint256`, exactly `50_000` |
| `ERC1271_MIN_PRECALL_GAS()` | `uint256`, exactly `160_000` |
| `MAX_ACTIVE_ORDINARY_RESERVATIONS()` | `uint256`, exactly `32` |
| `MAX_ACTIVE_RECONCILIATIONS()` | `uint256`, exactly `32` |
| `MAX_OPERATOR_OUTFLOW_COMPONENTS()` | `uint256`, exactly `67` |
| `OUTFLOW_AUTHORIZATION_TYPEHASH()` | `bytes32`, literal type hash above |
| `SUCCESSOR_CONSENT_TYPEHASH()` | `bytes32`, literal type hash above |

Struct fields are ABI-ordered exactly as follows:

```solidity
struct PendingOperatorNomination {
    bytes32 proposalId;
    uint256 proposalNumber;
    address nominee;
    address proposedBy;
    uint64 proposedAt;
    uint64 validAfter;
    uint64 expiresAt;
    bytes32 detailsHash;
}

struct OutflowAuthorization {
    address operator;
    address destination;
    uint256 amountWei;
    uint256 generation;
    uint256 nonce;
    uint64 issuedAt;
    uint64 deadline;
    uint8 reasonCode;
    bytes32 detailsHash;
}

struct SuccessorConsent {
    address currentOperator;
    address successor;
    uint256 generation;
    uint256 outflowNonce;
    uint64 issuedAt;
    uint64 deadline;
    uint8 reasonCode;
    bytes32 detailsHash;
}

struct IngressConfig {
    address ingress;
    bytes32 runtimeCodeHash;
    uint256 perDepositCapWei;
    uint256 epochDepositCapWei;
    uint256 lifetimeDepositCapWei;
}

struct PendingIngressProposal {
    bytes32 proposalId;
    uint256 proposalNumber;
    address proposedBy;
    IngressConfig config;
    bytes32 configHash;
    uint64 proposedAt;
    uint64 validAfter;
    uint64 expiresAt;
    bytes32 detailsHash;
}

struct IngressRecord {
    uint256 generation;
    address ingress;
    bytes32 runtimeCodeHash;
    uint256 perDepositCapWei;
    uint256 epochDepositCapWei;
    uint256 lifetimeDepositCapWei;
    uint64 activatedAt;
    uint64 disabledAt;
}

struct AccountingTotals {
    uint256 availableWei;
    uint256 unattributedWei;
    uint256 ordinaryReservedWei;
    uint256 reconciliationLiabilityWei;
    uint256 reconciliationBackingWei;
    uint256 reconciliationShortfallWei;
    uint256 accountedBackingWei;
    uint256 actualBalanceWei;
    uint256 balanceDeficitWei;
    uint256 forcedSurplusWei;
    uint256 accountingSequence;
}

enum AccountingMutationKind {
    NONE,
    SYNC_BALANCE,
    UNATTRIBUTED_RECLASSIFICATION,
    CANONICAL_DEPOSIT
}

enum AccountingComponentKind {
    NONE,
    FORCED_SURPLUS_TO_UNATTRIBUTED,
    BALANCE_DEFICIT_OBSERVATION_SET,
    UNATTRIBUTED_TO_AVAILABLE,
    CANONICAL_DEPOSIT_DEFICIT_REPAIR,
    CANONICAL_DEPOSIT_AVAILABLE_CREDIT
}

enum DepositCapKind {
    NONE,
    PER_DEPOSIT,
    EPOCH,
    GENERATION_LIFETIME,
    GLOBAL_LIFETIME
}

enum LocalReadinessCondition {
    NONE,
    WRONG_CHAIN,
    OWNER_CODE_MISSING,
    REGISTRY_CODE_MISSING,
    ROLE_COLLISION,
    BALANCE_DEFICIT,
    RECONCILIATION_SHORTFALL,
    ACTIVE_INGRESS_MISSING,
    INGRESS_CODE_MISSING,
    INGRESS_CODE_HASH_MISMATCH,
    INGRESS_PROPOSAL_PENDING
}

struct DepositRecord {
    bytes32 depositId;
    uint256 ingressGeneration;
    address ingress;
    bytes32 sourceEventId;
    uint256 amountWei;
    uint256 balanceDeficitRepairWei;
    uint256 availableCreditWei;
    uint256 epochDay;
    uint256 accountingSequence;
    uint64 depositedAt;
}

struct PreVoteBudgetInput {
    uint256 ballotDay;
    uint256 maxEthWei;
    uint64 purchaseUntil;
}

struct PreVoteBudgetAuthorization {
    bytes32 budgetId;
    uint256 ballotDay;
    uint256 maxEthWei;
    uint64 purchaseUntil;
    uint256 availableAtAuthorizationWei;
    uint256 accountingSequence;
    uint64 authorizedAt;
    bytes32 detailsHash;
}
```

Milestone interface reconciliation is exact:

- the O1 `IAcquisitionVaultV1` source declares the full frozen `ReasonCode` and
  `LocalReadinessCondition` enums with the ordinals above, the three O1 structs
  (`PendingOperatorNomination`, `OutflowAuthorization`, `SuccessorConsent`), and
  every constant/getter assigned to O1 in the allowlist—including the future
  ingress-delay and `32/32/67` bound constants;
- O1 declares only O1 mutators/views/errors/events. It does **not** yet declare
  `IngressConfig`, `PendingIngressProposal`, `IngressRecord`, accounting enums or
  structs, `DepositRecord`, pre-vote structs, A1 mutators/views, or A1-only
  errors/events; and
- A1 adds those already-frozen appendix declarations when their implementation
  lands. The combined appendix documents the final O1+A1 interface but does not
  expand the earlier O1 source milestone.

### Complete O1/A1 public selector allowlist

The ABI contains only the following custom and inherited/public selectors. The
return types below are binding; autogenerated scalar getters have the obvious
named value shown.

| Milestone | Selector | Return type |
|---|---|---|
| inherited | `owner()` | `address` |
| inherited | `pendingOwner()` | `address` |
| inherited | `transferOwnership(address)` | none |
| inherited | `acceptOwnership()` | none |
| overridden | `renounceOwnership()` | always reverts |
| inherited | `paused()` | `bool` |
| inherited | `eip712Domain()` | `(bytes1,string,string,uint256,address,bytes32,uint256[])` |
| O1 | every constant getter listed above | exact type in the constants table |
| O1 | `stockTokenRegistryV2()` | `address` |
| O1 | `version()` | `string` (`"1"`) |
| O1 | `mainOperator()` | `address` |
| O1 | `operatorGeneration()` | `uint256` |
| O1 | `outflowNonce()` | `uint256` next nonce |
| O1 | `nominationNonce()` | `uint256` last-issued proposal number |
| O1 | `pendingMainOperatorNomination()` | `PendingOperatorNomination` |
| O1 | `nominateMainOperator(address,bytes32)` | `bytes32 proposalId` |
| O1 | `cancelMainOperatorNomination(bytes32,bytes32)` | none |
| O1 | `expireMainOperatorNomination(bytes32)` | none |
| O1 | `acceptMainOperatorNomination(bytes32)` | none |
| O1 | `disableMainOperator(bytes32)` | none |
| O1 | `renounceMainOperator(bytes32)` | none |
| O1 | `replaceMainOperator(SuccessorConsent,bytes)` | none |
| O1 | `invalidateOutflowNonce(uint256,bytes32)` | none; supplied nonce must be current + 1 |
| O1 | `pause(bytes32)` | none |
| O1 | `unpause(bytes32)` | none |
| O1 | `hashOutflowAuthorization(OutflowAuthorization)` | `bytes32` |
| O1 | `hashSuccessorConsent(SuccessorConsent)` | `bytes32` |
| A1 | `globalLifetimeCanonicalDepositCapWei()` | `uint256` |
| A1 | `globalLifetimeCanonicalDepositedWei()` | `uint256` |
| A1 | `availableWei()` | `uint256` |
| A1 | `unattributedWei()` | `uint256` |
| A1 | `ordinaryReservedWei()` | `uint256` (always zero in A1) |
| A1 | `reconciliationLiabilityWei()` | `uint256` (always zero in A1) |
| A1 | `reconciliationBackingWei()` | `uint256` (always zero in A1) |
| A1 | `accountingSequence()` | `uint256` |
| A1 | `lastObservedBalanceDeficitWei()` | `uint256` |
| A1 | `accountingTotals()` | `AccountingTotals` |
| A1 | `syncBalance()` | `bytes32 mutationId` |
| A1 | `reclassifyUnattributed(uint256,bytes32)` | `bytes32 mutationId` |
| A1 | `ingressProposalNonce()` | `uint256` last-issued proposal number |
| A1 | `ingressGeneration()` | `uint256` last activated generation |
| A1 | `activeIngressGeneration()` | `uint256`, zero if disabled |
| A1 | `pendingIngressProposal()` | `PendingIngressProposal` |
| A1 | `getIngress(uint256)` | `IngressRecord` |
| A1 | `proposeIngress(IngressConfig,bytes32)` | `bytes32 proposalId` |
| A1 | `cancelIngressProposal(bytes32,bytes32)` | none |
| A1 | `expireIngressProposal(bytes32)` | none |
| A1 | `activateIngress(bytes32)` | `uint256 generation` |
| A1 | `disableIngress(bytes32)` | none |
| A1 | `ingressLifetimeDepositedWei(uint256)` | `uint256` |
| A1 | `ingressEpochDepositedWei(uint256,uint256)` | `uint256` |
| A1 | `getDeposit(bytes32)` | `DepositRecord` |
| A1 | `depositCanonical(bytes32)` payable | `bytes32 depositId` |
| A1 | `authorizePreVoteBudget(PreVoteBudgetInput,bytes32)` | `bytes32 budgetId` |
| A1 | `getPreVoteBudget(uint256)` | `PreVoteBudgetAuthorization` |

There is no `receive` or fallback ABI entry; empty-calldata and unknown-selector
calls therefore revert. ABI/method allowlist inspection proves only this external
surface. It does not prove the absence of hidden internal calls; the
opcode/AST/IR gates below provide separate evidence.

### Counters, IDs, timestamps, and canonical preimages

`nominationNonce` and `ingressProposalNonce` are last-issued counters. Each starts
at zero, advances by checked `+1` exactly once on a successful proposal, and is
unchanged by failed/cancelled/expired/accepted proposals. First proposal number is
one. `ingressGeneration` starts at zero and advances by checked `+1` only on a
successful activation. `operatorGeneration` starts at zero and advances exactly
as the transition table specifies. Counter exhaustion reverts before any write.

`CounterExhausted(bytes32)` arguments are literal `keccak256` hashes of these
UTF-8 labels; no public label getter is added:

| Counter | Exact error argument |
|---|---|
| `nominationNonce` | `keccak256(bytes("nominationNonce"))` |
| `operatorGeneration` | `keccak256(bytes("operatorGeneration"))` |
| `ingressProposalNonce` | `keccak256(bytes("ingressProposalNonce"))` |
| `ingressGeneration` | `keccak256(bytes("ingressGeneration"))` |

```text
nominationId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_OPERATOR_NOMINATION_V1"),
  uint256(4663), address(this), nextNominationNumber, owner(), nominee,
  proposedAt, validAfter, expiresAt, detailsHash
))

ingressConfigHash = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_INGRESS_CONFIG_V1"),
  ingress, runtimeCodeHash, perDepositCapWei, epochDepositCapWei,
  lifetimeDepositCapWei
))

ingressProposalId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_INGRESS_PROPOSAL_V1"),
  uint256(4663), address(this), nextIngressProposalNumber, owner(),
  ingressConfigHash, proposedAt, validAfter, expiresAt, detailsHash
))

operatorExpiryDetailsHash = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_OPERATOR_EXPIRY_DETAILS_V1"), nominationId
))

ingressExpiryDetailsHash = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_INGRESS_EXPIRY_DETAILS_V1"), ingressProposalId
))

depositId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_DEPOSIT_V1"),
  uint256(4663), address(this), ingressGeneration, ingress,
  sourceEventId
))

budgetId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_PRE_VOTE_BUDGET_V1"),
  uint256(4663), address(this), address(stockTokenRegistryV2), ballotDay,
  maxEthWei, purchaseUntil, accountingSequence
))
```

Every locally derived or stored `uint64` is checked before conversion. For
nomination and ingress proposals require
`block.timestamp <= type(uint64).max - 48 hours - 7 days`; for activation,
disable, deposit, and budget records require
`block.timestamp <= type(uint64).max`; and budget day/deadline multiplication and
addition are checked before the exact `uint64` conversion. Boundary RED tests use
the last valid value and the first invalid value for every rule.

`outflowNonce` is a next-nonce counter. `invalidateOutflowNonce` retains its
explicit parameter for package clarity but succeeds only when
`newNextNonce == outflowNonce + 1`; it rejects when the current value is
`type(uint256).max` and never permits a jump. From zero, no single transaction or
bounded handler run can reach `type(uint256).max - 1`. The finite uint256 domain
is not mathematically inexhaustible: reaching the boundary would require that
many successful one-step changes, and future O2 must specify checked consumption
and fail closed rather than wrap. No Safe/role transition resets the counter.

### Accounting evidence schema and IDs

For every successful A1 financial mutation, `nextSequence =
accountingSequence + 1`; the following preimages are exact:

```text
mutationId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_ACCOUNTING_MUTATION_V1"),
  uint256(4663), address(this), nextSequence, uint8(mutationKind), subjectId
))

componentId = keccak256(abi.encode(
  keccak256("OMERTA_ACQUISITION_ACCOUNTING_COMPONENT_V1"),
  uint256(4663), address(this), mutationId, componentIndex,
  uint8(componentKind), componentSubjectId, amountWei
))
```

For `SYNC_BALANCE`, `subjectId` is
`keccak256(abi.encode(keccak256("OMERTA_ACQUISITION_SYNC_BALANCE_V1"),
preTotals, postTotals))`; for reclassification it is the caller's `detailsHash`;
for a canonical deposit it is `depositId`. Component indexes are contiguous from zero.
Zero-value components are omitted except
`BALANCE_DEFICIT_OBSERVATION_SET`, whose zero amount is permitted only to record
an observed deficit clearing in a `SYNC_BALANCE` mutation. A deposit or
reclassification that changes the live derived deficit records the exact change
in its pre/post totals and own economic components; it never mislabels one as a
sync component. `componentCount` is exact.

`componentSubjectId` is not implementation-selected. It follows this exact table:

| `AccountingComponentKind` | Exact `componentSubjectId` |
|---|---|
| `FORCED_SURPLUS_TO_UNATTRIBUTED` | parent `SYNC_BALANCE` mutation `subjectId` |
| `BALANCE_DEFICIT_OBSERVATION_SET` | the same parent `SYNC_BALANCE` mutation `subjectId`, including when `amountWei == 0` |
| `UNATTRIBUTED_TO_AVAILABLE` | parent reclassification mutation `subjectId`, exactly the caller's nonzero `detailsHash` |
| `CANONICAL_DEPOSIT_DEFICIT_REPAIR` | parent canonical-deposit mutation `subjectId`, exactly `depositId` |
| `CANONICAL_DEPOSIT_AVAILABLE_CREDIT` | the same parent canonical-deposit `depositId` |

`AccountingComponentKind.NONE` is forbidden in every stored/emitted component.
RED tests independently derive the literal parent mutation ID and every component
ID from the preimages and table above; they never call a production mutation-ID,
component-ID, subject-ID, or hashing helper to obtain an expected value.

Readiness errors are equally closed: A1 `unpause` with no live active ingress
reverts exactly
`LocalReadinessFailed(uint8(LocalReadinessCondition.ACTIVE_INGRESS_MISSING))`.
`NoActiveIngress` is used only by ingress lifecycle/deposit operations and never
by `unpause` readiness evaluation.

```solidity
event AccountingMutation(
    uint256 indexed accountingSequence,
    bytes32 indexed mutationId,
    uint8 indexed mutationKind,
    AccountingTotals preTotals,
    AccountingTotals postTotals,
    uint256 componentCount
);

event AccountingComponent(
    uint256 indexed accountingSequence,
    uint256 indexed componentIndex,
    bytes32 indexed componentId,
    uint8 componentKind,
    bytes32 componentSubjectId,
    uint256 amountWei
);
```

### Exact events

Indexed fields are marked explicitly; no additional indexed field is permitted.

```solidity
event MainOperatorNominationCreated(
    bytes32 indexed proposalId, address indexed nominee, address indexed proposedBy,
    uint256 proposalNumber, uint64 proposedAt, uint64 validAfter, uint64 expiresAt,
    uint8 reasonCode, bytes32 detailsHash
);
event MainOperatorNominationCancelled(
    bytes32 indexed proposalId, address indexed nominee, address indexed actor,
    uint8 reasonCode, bytes32 detailsHash
);
event MainOperatorNominationExpired(
    bytes32 indexed proposalId, address indexed nominee, address indexed actor,
    uint8 reasonCode, bytes32 detailsHash
);
event MainOperatorChanged(
    address indexed previousOperator, address indexed newOperator,
    uint256 indexed operatorGeneration, uint256 outflowNonce,
    uint8 reasonCode, bytes32 detailsHash
);
event OutflowNonceInvalidated(
    address indexed operator, uint256 indexed operatorGeneration,
    uint256 previousNonce, uint256 newNonce, uint8 reasonCode, bytes32 detailsHash
);
event RiskPaused(address indexed actor, uint8 reasonCode, bytes32 detailsHash);
event RiskUnpaused(address indexed actor, uint8 reasonCode, bytes32 detailsHash);

event IngressProposalCreated(
    bytes32 indexed proposalId, address indexed ingress, address indexed proposedBy,
    uint256 proposalNumber, bytes32 configHash, uint64 proposedAt,
    uint64 validAfter, uint64 expiresAt, uint8 reasonCode, bytes32 detailsHash
);
event IngressProposalCancelled(
    bytes32 indexed proposalId, address indexed ingress, address indexed actor,
    uint8 reasonCode, bytes32 detailsHash
);
event IngressProposalExpired(
    bytes32 indexed proposalId, address indexed ingress, address indexed actor,
    uint8 reasonCode, bytes32 detailsHash
);
event IngressActivated(
    uint256 indexed ingressGeneration, address indexed ingress,
    bytes32 indexed proposalId, bytes32 runtimeCodeHash,
    uint256 perDepositCapWei, uint256 epochDepositCapWei,
    uint256 lifetimeDepositCapWei, uint64 activatedAt,
    uint8 reasonCode, bytes32 detailsHash
);
event IngressDisabled(
    uint256 indexed ingressGeneration, address indexed ingress, address indexed actor,
    uint64 disabledAt, uint8 reasonCode, bytes32 detailsHash
);
event UnattributedReclassified(
    bytes32 indexed mutationId, uint256 indexed accountingSequence,
    address indexed actor, uint256 amountWei, uint8 reasonCode, bytes32 detailsHash
);
event CanonicalDeposit(
    bytes32 indexed depositId, uint256 indexed ingressGeneration,
    bytes32 indexed sourceEventId, address ingress, uint256 amountWei,
    uint256 balanceDeficitRepairWei, uint256 availableCreditWei,
    uint256 epochDay, uint256 accountingSequence, uint64 depositedAt
);
event PreVoteBudgetAuthorized(
    bytes32 indexed budgetId,
    uint256 indexed ballotDay,
    uint256 maxEthWei,
    uint64 purchaseUntil,
    uint256 availableAtAuthorizationWei,
    uint256 accountingSequence,
    uint64 authorizedAt,
    uint8 reasonCode,
    bytes32 detailsHash
);
```

Inherited/public events are exactly
`OwnershipTransferStarted(address indexed previousOwner,address indexed
newOwner)`, `OwnershipTransferred(address indexed previousOwner,address indexed
newOwner)`, `Paused(address account)`, `Unpaused(address account)`, and
`EIP712DomainChanged()`.

Safe disable has one exact evidence sequence. If a nomination is pending, emit
`MainOperatorNominationCancelled(proposalId, nominee, msg.sender,
uint8(ReasonCode.OPERATOR_DISABLED), detailsHash)` and clear it first. Then
increment `operatorGeneration` exactly once and always emit
`MainOperatorChanged(previousOperator, address(0), newGeneration,
preservedOutflowNonce, uint8(ReasonCode.OPERATOR_DISABLED), detailsHash)`. The
second event is mandatory even for the pending-only `address(0) -> address(0)`
case. Active and pending operator state cannot coexist in valid state.

### Complete closed error set

Custom errors are exactly:

```solidity
error WrongChain(uint256 actualChainId);
error ZeroAddress();
error ContractRequired(address target);
error RoleIdentityCollision(address candidate);
error RegistryChainMismatch(uint256 actualChainId);
error OwnershipRenunciationDisabled();
error NoPendingOwnershipTransfer();
error EmptyDetailsHash();
error InvalidActionReason(uint8 supplied);
error CounterExhausted(bytes32 counterName);
error TimestampOverflow();
error MainOperatorActive(address operator);
error NoMainOperator();
error OperatorNominationPending(bytes32 proposalId);
error OperatorNominationMissing();
error ProposalIdMismatch(bytes32 expectedId, bytes32 actualId);
error NotNominee(address caller);
error ProposalNotReady(uint64 eligibleAt);
error ProposalExpired(uint64 expiresAt);
error NoOperatorStateChange();
error InvalidOperatorReplacement();
error InvalidOutflowNonceStep(uint256 currentNonce, uint256 suppliedNonce);
error OutflowNonceExhausted(uint256 currentNonce);
error InvalidAuthorizationWindow();
error AuthorizationNotYetValid();
error AuthorizationExpired();
error InvalidAuthorizationFields();
error InvalidSignature();
error InsufficientSignatureValidationGas();
error LocalReadinessFailed(uint8 condition);
error InvalidGlobalLifetimeCap();
error NoBalanceDelta();
error InvalidAmount();
error InsufficientUnattributed(uint256 availableWei, uint256 requestedWei);
error BalanceDeficitActive(uint256 deficitWei);
error ReconciliationShortfallActive(uint256 shortfallWei);
error IngressProposalPending(bytes32 proposalId);
error IngressProposalMissing();
error InvalidIngressConfig();
error IngressCodeHashMismatch(address ingress, bytes32 expected, bytes32 actual);
error NoActiveIngress();
error IngressNotFound(uint256 generation);
error NotActiveIngress(address caller);
error DepositSourceRequired();
error DepositReplay(bytes32 depositId);
error DepositCapExceeded(uint8 capKind, uint256 capWei, uint256 attemptedTotalWei);
error DepositNotFound(bytes32 depositId);
error BudgetDayClosed(uint256 ballotDay);
error BudgetDeadlineOverflow();
error InvalidPurchaseUntil(uint64 expected, uint64 supplied);
error BudgetAlreadyAuthorized(uint256 ballotDay);
error InsufficientAvailable(uint256 availableWei, uint256 requestedWei);
error BudgetNotFound(uint256 ballotDay);
```

Inherited errors reachable through the allowlisted functions are exactly
`OwnableUnauthorizedAccount(address)`, `OwnableInvalidOwner(address)`,
`EnforcedPause()`, `ExpectedPause()`, `ReentrancyGuardReentrantCall()`,
`InvalidShortString()`, and `StringTooLong(string)`. The last two are emitted
into the compiled ABI by the mandated OpenZeppelin `EIP712`/`ShortStrings`
inheritance even though the fixed constructor literals cannot trigger them in
normal O1 operation; omitting them would make the exact compiled-ABI gate
incompatible with the required inheritance. ECDSA and wallet-controlled errors
never escape the closed `InvalidSignature` boundary, and no OpenZeppelin ECDSA
custom error is part of the compiled O1 ABI because the implementation uses the
non-reverting `tryRecoverCalldata` path.

### Exact validation and error partition

Constructor tests isolate one invalid predicate at a time. Compound-invalid
precedence is not public API and must not be asserted. The isolated mappings are:

1. `Ownable(safeOwner)` runs as a base constructor, so zero Safe reverts
   `OwnableInvalidOwner(address(0))`.
2. With a valid contract Safe, wrong `block.chainid` reverts
   `WrongChain(actualChainId)` before body-level Safe/Registry checks.
3. On chain 4663, an EOA Safe reverts `ContractRequired(safeOwner)`.
4. Zero RegistryV2 reverts `ZeroAddress()`; an EOA RegistryV2 reverts
   `ContractRequired(registry)`; Safe/Registry/vault identity collisions revert
   `RoleIdentityCollision(candidate)`.
5. Registry chain probing uses a low-level `STATICCALL` with exactly the
   `IStockTokenRegistryV2.supportedChainId.selector`, copies at most 32 bytes,
   requires call success and `returndatasize == 32`, and never bubbles Registry
   returndata. Revert, malformed, short, or oversized return data maps to
   `RegistryChainMismatch(0)`; a well-formed decoded value other than 4663 maps
   to `RegistryChainMismatch(actualChainId)`.

Owner-only calls use inherited `OwnableUnauthorizedAccount(caller)`. For
`renounceOwnership`, a non-owner gets that inherited error and the current owner
gets `OwnershipRenunciationDisabled()`. Direct-operator functions (`renounce`,
`replace`, and nonce invalidation) first return `NoMainOperator()` when no active
operator exists; when one exists but `msg.sender` is different they return
`OwnableUnauthorizedAccount(msg.sender)`. `pause` accepts only owner or active
operator and maps every other caller—including when no operator is active—to
`OwnableUnauthorizedAccount(msg.sender)`.

Proposal expiry checks missing proposal, then exact ID, then time. A permissionless
operator or ingress expiry attempted before `expiresAt` reverts
`ProposalNotReady(expiresAt)`. Nominee acceptance before `validAfter` separately
uses `ProposalNotReady(validAfter)`; acceptance at/after `expiresAt` uses
`ProposalExpired(expiresAt)`.

Successor replacement validation uses this exact first-failure order; the first
failing check determines the error and implementations may not reorder it:

1. Require an active operator or revert `NoMainOperator()`.
2. Require the direct caller to equal that operator or revert inherited
   `OwnableUnauthorizedAccount(msg.sender)`.
3. Require successor nonzero, different from the current operator, and
   role-disjoint or revert `InvalidOperatorReplacement()`.
4. Require consent `currentOperator`, `generation`, and `outflowNonce` to match
   exactly or revert `InvalidAuthorizationFields()`. The consent's `successor`
   is the action's sole successor input and was already validated for identity
   and role separation at stage 3; there is no independent successor argument
   against which it could mismatch. A different otherwise-valid successor is
   therefore bound at stage 8 by that successor's signature, not rejected as a
   stage-4 field mismatch.
5. Require reason exactly `OPERATOR_REPLACED` or revert
   `InvalidActionReason(supplied)`.
6. Require nonzero `detailsHash` or revert `EmptyDetailsHash()`.
7. Validate the authorization time window using the frozen time errors.
8. Validate signature maximum length, EOA/ERC-1271 path, gas guards, and
   cryptography. Signature length remains checked before any external work;
   the preceding pure field/time checks do not perform external work. Signature
   failures use `InvalidSignature()` except for the explicit gas-guard partition
   below.

For an ERC-1271 candidate, calldata/memory construction happens first. Immediately
before the wallet call require
`gasleft() >= ERC1271_CALL_GAS + ERC1271_POST_CALL_GAS_RESERVE + 10_000`, exactly
`160_000`. The additional 10,000 covers call/access/return bookkeeping and the
EIP-150 forwarding constraint. Request exactly 100,000 gas for the `STATICCALL`;
after validation require `gasleft() >= 50_000`. Either gas-guard failure reverts
`InsufficientSignatureValidationGas()`. Wallet-controlled revert, wrong magic,
or malformed return remains `InvalidSignature()`. Every failure restores the
reentrancy guard and leaves all domain state, counters, and logs unchanged.
Because the exact `160_000` pre-call guard exceeds the `100_000` wallet stipend
plus the `50_000` reserve by the explicit 10,000 overhead allowance, a correctly
bounded wallet call cannot normally drive the production path below the
post-call reserve. The post-call guard remains a required defensive assertion,
but its exact `49_999`/`50_000` boundary is proven through the same internal
production helper exposed only by a test-derived harness; tests must not require
an arithmetically unreachable full replacement call to trigger that guard.

Runtime `STATICCALL` evidence is target-family based, never an optimizer-dependent
raw opcode count. Exactly two runtime families are allowed: compiler-emitted
`ecrecover` precompile use at address `0x0000000000000000000000000000000000000001`
for the EOA branch, and the bounded ERC-1271 wallet call above. The constructor's
exact RegistryV2 selector read is a third creation-only family and must not survive
in deployed runtime. PUSH-aware disassembly still bans runtime
`CALL`/`CALLCODE`/`DELEGATECALL`/`SELFDESTRUCT`; source/build-info AST/IR review
proves the permitted targets, calldata, gas, and return handling.

---

### Task 1: Write the O1 operator-authority RED suite

**Files:**

- Add: `omerta-contracts/test/AcquisitionVaultOperator.t.sol`
- Do not add or modify contract/interface source in this task.

**Interfaces under test:**

- Future `omerta-contracts/src/AcquisitionVault.sol`
- Future `omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol`
- Test-local Safe, EOA signer, ERC-1271 response/gas/reentrancy mocks, and a
  test-only validator harness where an internal seam needs isolated proof.

- [ ] **Step 1: Freeze the literal appendix ABI and typed payloads in tests**

  Generate expected selectors, tuple return order, constants, errors, events,
  indexed fields, counter transitions, and ID preimages independently from the
  canonical V1 appendix. The test allowlist must include every custom and
  inherited/public O1 selector there and no others.

  The exact EIP-712 structs/type strings are:

  ```solidity
  struct OutflowAuthorization {
      address operator;
      address destination;
      uint256 amountWei;
      uint256 generation;
      uint256 nonce;
      uint64 issuedAt;
      uint64 deadline;
      uint8 reasonCode;
      bytes32 detailsHash;
  }

  keccak256(
    "OutflowAuthorization(address operator,address destination,uint256 amountWei,uint256 generation,uint256 nonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
  )

  struct SuccessorConsent {
      address currentOperator;
      address successor;
      uint256 generation;
      uint256 outflowNonce;
      uint64 issuedAt;
      uint64 deadline;
      uint8 reasonCode;
      bytes32 detailsHash;
  }

  keccak256(
    "SuccessorConsent(address currentOperator,address successor,uint256 generation,uint256 outflowNonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)"
  )
  ```

  Independently calculate literal struct hashes and domain separator in tests;
  do not use a production hash helper to derive expected values.

- [ ] **Step 2: Add constructor, ownership, and selector-negative tests**

  Isolate one constructor-invalid predicate per test and prove the appendix's
  exact mapping: zero Safe reaches inherited `OwnableInvalidOwner(address(0))`;
  a valid contract Safe on a non-4663 chain reaches `WrongChain(actual)`; an EOA
  Safe reaches `ContractRequired(safe)`; zero RegistryV2 reaches
  `ZeroAddress()`; and EOA/colliding RegistryV2 candidates reach their exact
  appendix errors. Compound-invalid precedence is not an API and is not tested.
  Exercise the low-level RegistryV2 read with revert, failure, empty/short, and
  oversized return fixtures and expect `RegistryChainMismatch(0)`; a well-formed
  non-4663 word reports `RegistryChainMismatch(actual)`. No returndata bubbles.
  A distinct contract Safe and exact RegistryV2 are immutable
  from construction; the contract starts paused with zero operator, generation,
  nonce, and nomination. Override both ownership steps. A nonzero owner candidate
  must be a contract Safe distinct from the current owner, vault, RegistryV2,
  main/pending operator, and, once A1 exists, active/pending ingress. Check at
  proposal and acceptance; a current-owner self-proposal and its event noise are
  rejected at both gates.
  Permit zero only to cancel an existing pending ownership proposal; reject a
  zero no-op cancellation and prove zero can never accept or become owner.
  `renounceOwnership` always reverts.

  Parse the compiled ABI/method identifiers and require the exact appendix
  allowlist. This proves the external selector boundary only; do not claim it
  detects internal calls or opcodes.

  Add the RED PUSH-aware runtime disassembler assertion here: walk deployed
  bytecode by opcode, skip every `PUSH1..PUSH32` payload, reject CALL/CALLCODE/
  DELEGATECALL/SELFDESTRUCT, and separately inventory STATICCALL by reviewed
  target family rather than asserting an optimizer-dependent raw count. Runtime
  permits exactly compiler-emitted `ecrecover` precompile calls to `address(1)`
  for the EOA branch and bounded ERC-1271 wallet validation. The constructor's
  exact RegistryV2 read is the third creation-only family and must not survive
  runtime. Do not search raw bytes. The test is RED until the O1 runtime exists.

- [ ] **Step 3: Add nomination lifecycle boundary tests**

  Cover nomination only by the Safe from zero with no pending proposal;
  a nonzero EOA/ERC-1271 nominee distinct from owner, pending owner, vault,
  RegistryV2, and, after A1, active/pending ingress; nonzero details; no
  overwrite; exact counter and proposal-ID preimage; one bounded pending slot;
  exact `48h - 1`, `48h`,
  `expiresAt - 1`, and `expiresAt` behavior where
  `expiresAt = validAfter + 7 days`; exact nominee and ID acceptance; Safe
  cancellation; permissionless expiry with contract-derived details; and no
  appointment on cancel/expiry. For expiry, missing/exact-ID validation runs
  first and an early exact-ID call reverts `ProposalNotReady(expiresAt)`.
  Recheck every reciprocal role exclusion at
  acceptance so a role change during the delay cannot collapse authority.

  Test `block.timestamp == type(uint64).max - 48 hours - 7 days` and the next
  second. The first produces exact derived timestamps; the second reverts
  `TimestampOverflow` without consuming the proposal counter or history.

- [ ] **Step 4: Add generation and direct-transition tests**

  Prove Safe disable of an active operator or pending nomination is immediate
  and increments generation exactly once while preserving the global next-
  outflow nonce. If pending exists, it first emits
  `MainOperatorNominationCancelled` with `OPERATOR_DISABLED` and caller details,
  then clears it; it always emits `MainOperatorChanged(previousOperator,
  address(0), newGeneration, preservedNonce, OPERATOR_DISABLED, details)`,
  including pending-only `0 -> 0`. Reject a no-state disable. Prove only the
  direct active operator may renounce or replace; no active operator maps to
  `NoMainOperator()`, while a wrong direct caller and unauthorized pause map to
  inherited `OwnableUnauthorizedAccount(caller)`. Renounce reaches zero;
  replacement rejects zero/same/wrong caller/relay plus owner, pending owner,
  vault, RegistryV2, and, after A1, active/pending ingress. It rechecks those
  identities immediately before consent validation and atomically installs one
  successor with no overlap. Freeze replacement failures exactly: zero/same/
  role-colliding successor is `InvalidOperatorReplacement`; mismatched consent
  current-operator/generation/outflow nonce is `InvalidAuthorizationFields`;
  the consent's successor is the sole successor input and a different valid
  value proceeds to that value's stage-8 signature validation;
  wrong reason is `InvalidActionReason`; zero details is `EmptyDetailsHash`;
  time/signature failures retain their appendix errors. Both increment
  generation exactly once and preserve the next nonce.

  Add compound-invalid RED cases that correct one stage at a time and assert the
  first failure: all-invalid with no active operator proves stage 1; then active
  operator/wrong caller proves stage 2; correct caller/invalid successor proves
  stage 3; corrected successor with mismatched current-operator/generation/
  outflow-nonce fields proves stage 4; then
  wrong reason, zero details, invalid time, and invalid signature prove stages
  5 through 8 respectively. Each failure leaves all state and logs unchanged.

- [ ] **Step 5: Add replay, time, and EOA signature tests**

  The domain is exactly name `OMERTA AcquisitionVault`, version `1`, chain
  `4663`, and the vault address. Both payloads require:

  ```text
  issuedAt != 0
  issuedAt <= block.timestamp <= deadline
  issuedAt <= deadline
  deadline - issuedAt <= 1 hour
  ```

  Prove inclusive endpoints and reject future-issued, expired, over-one-hour,
  zero-issued, and reversed windows. Successor consent binds the direct current
  operator, distinct successor, current generation, current next outflow nonce,
  reason `OPERATOR_REPLACED`, and nonzero details. Prove changing any field,
  chain, vault, field order, generation, or nonce changes/rejects the digest.
  Cover canonical 65-byte EOA success and bad length, high-s, invalid-v, zero
  recover, and wrong-key failures.

- [ ] **Step 6: Add bounded ERC-1271 adversarial tests**

  Freeze one fail-closed internal validator:

  - reject empty or more than `4_096` signature bytes before external work;
  - for EOAs use `ECDSA.tryRecoverCalldata`, require exactly 65 bytes and exact
    signer;
  - for contracts, construct calldata first, then require immediate pre-call
    `gasleft() >= 160_000`, request exactly `100_000` gas for `staticcall`, and
    require post-validation `gasleft() >= 50_000`; the extra `10_000` covers
    call/access/return bookkeeping and the EIP-150 forwarding constraint;
  - copy at most 32 return bytes, require call success and
    `returndatasize == 32`, and accept only the ABI-left-aligned first four bytes
    `0x1626ba7e`;
  - collapse wrong magic, 0/4/31/33/64-byte return, revert, deliberate >100k
    consumption, and malformed signature to `InvalidSignature` without bubbling
    wallet-controlled data, but map either outer-gas guard failure exclusively
    to `InsufficientSignatureValidationGas`, never `InvalidSignature`;
  - signature-consuming mutators are `nonReentrant`, validate before their first
    **domain/application-state** write (the guard writes and reverts atomically),
    and call a private transition core afterward.

  The exact pre/post thresholds are implemented by internal pure production
  seams `_requireErc1271PrecallGas(uint256 observedGas)` and
  `_requireErc1271PostcallGas(uint256 observedGas)`. A test-derived harness calls
  those same seams with literal observations to prove `159_999/160_000` and
  `49_999/50_000`. The production validator calls each seam exactly once with
  `gasleft()` at the specified point. Because the pre-call threshold, bounded
  stipend, and overhead allowance make a sub-50,000 post-call result unreachable
  in an otherwise conforming full call, the suite must not demand such a full
  replacement transaction; source/AST/IR plus the shared-seam test prove that
  defensive guard instead.

  Assert every failure leaves operator, generation, nonce, nomination, pause
  state, and event history unchanged.

- [ ] **Step 7: Add nonce and pause tests**

  Prove `outflowNonce` means the next usable future O2 nonce, is shared by future
  direct/relayed outflows, never resets, and is preserved by every role,
  ownership, and pause transition. Only the direct active operator may
  invalidate only by the exact one-step relation
  `newNextNonce == outflowNonce + 1`, with mapped reason and nonzero details.
  Prove jumps of 2, `type(uint256).max - 1` from zero, and maximum fail without
  changes; one successful call advances once; disable/renounce/reappointment
  preserves the result. In a bounded stateful trace, nonce growth is at most the
  count of successful one-step invalidations. Document/test checked failure at
  the theoretical uint256 exhaustion boundary; never wrap or reset.
  Assert `CounterExhausted` carries the literal appendix label hash for each
  reachable O1 counter; derive those hashes independently in the test.

  Invalidation moves no funds and writes no accounting sequence. Safe or active
  operator may pause; pending nominee has no authority. O1 `unpause` is Safe-only
  and requires the exact local stub predicate: paused state, chain 4663, current
  owner still has contract code, RegistryV2 still has contract code, and all
  current/pending owner/operator identities remain disjoint. RegistryV2 chain
  identity was frozen by the constructor-only static read; unpause does not add
  another external call.
  O1 has no financial/ingress/H/FO readiness claim and is never deployed.

- [ ] **Step 8: Run focused tests and preserve literal RED evidence**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultOperator.t.sol -vvv
  ```

  Expected: compile failure because the interface/contract do not exist. Save
  the exact failing command and reason in the task report; do not weaken or
  comment out the tests.

- [ ] **Step 9: Commit the RED suite**

  Commit only the focused test/mocks. A failing RED commit is intentional and
  must be immediately followed by Task 2 on the same bounded implementation
  branch; it is not a merge/deploy candidate.

---

### Task 2: Implement the O1 role and signature kernel

**Files:**

- Add: `omerta-contracts/src/AcquisitionVault.sol`
- Add: `omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol`
- Modify: `omerta-contracts/foundry.toml` only to add read-only
  `fs_permissions` for `./out` and `./src`, which the exact artifact-ABI and
  source/hash evidence tests read. Do not grant write access, FFI, or broader
  filesystem access.
- Modify: `omerta-contracts/test/AcquisitionVaultOperator.t.sol` only for a
  test defect proven independently of production behavior.

**O1 storage:**

```solidity
address public mainOperator;
uint256 public operatorGeneration;
uint256 public outflowNonce;
uint256 public nominationNonce;
PendingOperatorNomination private _pendingMainOperatorNomination;
```

The pending slot contains only ID, nominee, `proposedAt`, `validAfter`,
`expiresAt`, and the remaining exact appendix fields. Historical evidence lives
in events, never an enumerable array. O1's temporary constructor accepts the
contract Safe and exact RegistryV2 so operator/ownership collisions are testable
from the first milestone; A1 adds only the global lifetime cap argument before
any deployment.

- [ ] **Step 1: Define the narrow interface first**

  Add the full frozen `ReasonCode` and `LocalReadinessCondition` enums, the exact
  O1 structs/errors/events/getters/mutators/EIP-712 hash views, and every public
  constant already assigned to the O1 selector allowlist, including future
  ingress-delay and 32/32/67 bounds. Do not yet declare future A1 structs,
  mutators, views, errors, or events; Task 4/5/6 adds those declarations with
  their implementations. Do not add convenience aliases, generic execution,
  payable functions, token interfaces, admin sweeps, recovery, or future A1/A3/
  R/O2 selectors.

  Configure Foundry with exactly:

  ```toml
  fs_permissions = [
    { access = "read", path = "./out" },
    { access = "read", path = "./src" },
  ]
  ```

  This enables only the RED suite's compiled-artifact and source provenance
  reads. FFI remains disabled and no test receives filesystem write authority.

- [ ] **Step 2: Implement immutable ownership/domain construction**

  Use final inheritance:

  ```solidity
  contract AcquisitionVault is
      IAcquisitionVaultV1,
      EIP712,
      Ownable2Step,
      Pausable,
      ReentrancyGuard
  ```

  Initialize `Ownable(safeOwner)` and `EIP712("OMERTA AcquisitionVault", "1")`,
  enforce the appendix's isolated constructor mappings, and start paused. Probe
  RegistryV2 with a low-level exact-selector `STATICCALL`, copy at most 32 bytes,
  and require success plus `returndatasize == 32`: failure/revert/malformed/
  oversized maps to `RegistryChainMismatch(0)`, while a decoded non-4663 value
  maps to `RegistryChainMismatch(actual)`, with no returndata bubbling. This is
  the only constructor external read and it must not survive runtime.

  Override `transferOwnership` and `acceptOwnership` to apply the appendix's
  contract-Safe and reciprocal collision checks at both stages. Preserve
  `transferOwnership(0)` only as an explicit cancellation when a pending owner
  exists. Override `renounceOwnership` to always revert, including for owner.

- [ ] **Step 3: Implement delayed Safe nomination and generation transitions**

  Implement the exact transition table:

  | Action | Preconditions | Generation | Next outflow nonce | Pending |
  |---|---|---:|---:|---|
  | nominate | Safe; operator zero; no pending; appendix role-disjoint nominee/details/timestamp | unchanged | unchanged | create `[+48h, +48h+7d)` |
  | cancel | Safe; exact live ID/details | unchanged | unchanged | clear |
  | expire | anyone; proposal exists, exact ID, otherwise early call is `ProposalNotReady(expiresAt)`; `now >= expiresAt` | unchanged | unchanged | clear |
  | accept | exact nominee/ID; `validAfter <= now < expiresAt`; recheck role disjointness | +1 | preserve | clear |
  | disable | Safe; active or pending real state; cancel-event first when pending, then changed-event even for `0 -> 0` | +1 once | preserve | clear |
  | renounce | direct active operator/details | +1 | preserve | defensive clear |
  | replace | direct active operator; appendix role-disjoint successor; valid consent | +1 | preserve | defensive clear |
  | invalidate | direct active operator; supplied nonce exactly current + 1/details | unchanged | +1 | absent |
  | pause | Safe or active operator | unchanged | unchanged | unchanged |
  | unpause | Safe and exact O1 local stub readiness | unchanged | unchanged | unchanged |

  Failed transitions must perform no partial write or event emission.

- [ ] **Step 4: Implement exact typed hashes and bounded signature validation**

  Encode fields in the literal Task-1 order. Public hash helpers return
  `_hashTypedDataV4(structHash)`. Replacement is direct-only and validates only
  the successor's same-transaction consent. There is no separate consent nonce:
  a successful role change invalidates through generation, while an intervening
  future outflow/invalidation changes the bound `outflowNonce`.
  Execute the appendix's eight replacement checks in their exact stated order;
  do not consolidate or reorder them even when several inputs are invalid. The
  first failure is observable API behavior. The maximum signature length must
  still be rejected before any external work; earlier caller, field, reason,
  details, and time checks are pure/internal validation.

  Implement the EOA/ERC-1271 validator exactly as tested. EOA recovery uses the
  compiler-emitted `ecrecover` precompile family at `address(1)`. For ERC-1271,
  after calldata construction require the exact `160_000` immediate pre-call
  threshold, request exactly `100_000` staticcall gas, copy/accept only the exact
  32-byte left-aligned magic response, and require at least `50_000` gas after
  validation. The threshold's extra `10_000` covers access/call/return work and
  EIP-150. Either guard failure is `InsufficientSignatureValidationGas`; wallet-
  controlled failure is `InvalidSignature`. Bubble no returndata and perform no
  domain/application-state write before validation. The `nonReentrant` guard's
  own entry write is explicitly not misclassified as domain state and reverts
  atomically on failure.

  Implement the exact internal pure seams
  `_requireErc1271PrecallGas(uint256)` and
  `_requireErc1271PostcallGas(uint256)`. The production validator invokes each
  exactly once with `gasleft()`; the test-only derived harness exposes them
  without adding a selector to `AcquisitionVault`. The post-call seam remains a
  defensive assertion even though the preceding 160,000/100,000/10,000 bounds
  make its failure arithmetically unreachable on the conforming full path.

- [ ] **Step 5: Make the O1 RED suite GREEN**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultOperator.t.sol -vvv
  forge fmt --check
  forge build --sizes
  forge inspect AcquisitionVault abi
  forge inspect AcquisitionVault methods
  forge inspect AcquisitionVault errors
  forge inspect AcquisitionVault events
  forge inspect AcquisitionVault storageLayout
  forge build --build-info
  ```

  Every command exits `0`. Inspect method identifiers explicitly and record the
  absence of outflow/sweep/payable/token/upgrade/burn surfaces.

- [ ] **Step 5a: Make the RED runtime opcode and call-site boundary GREEN**

  Use the executable RED helper that disassembles `address(vault).code`, advances
  over each `PUSH1..PUSH32` immediate payload, and fails on opcode `CALL (0xf1)`,
  `CALLCODE (0xf2)`, `DELEGATECALL (0xf4)`, or `SELFDESTRUCT (0xff)`. A raw byte
  substring search is invalid because PUSH data can contain opcode bytes.

  Runtime `STATICCALL (0xfa)` is permitted for exactly two reviewed target
  families: compiler-emitted EOA `ecrecover` at `address(1)`, and the exact
  bounded ERC-1271 validator. Raw opcode count is optimizer-dependent; do not
  gate on it. Instead,
  inspect source plus `forge build --build-info`, the build-info AST, and
  `forge inspect AcquisitionVault ir` / `irOptimized` to enumerate every
  external-call site and prove its target/calldata/gas/returndata shape.
  Separately inspect creation AST/IR: its only external read is the frozen
  exact-selector RegistryV2 `supportedChainId()` constructor check and it cannot survive in
  runtime. Record hashes of the inspected outputs in the task report.

- [ ] **Step 6: Run deliberate mutation checks**

  Locally mutate one condition at a time, run the focused suite, and revert only
  the deliberate mutation: 48-hour delay, exclusive expiry, generation +1,
  nonce preservation/one-step advancement/max-1 jump, reciprocal role collision,
  owner proposal/acceptance check, constructor error mapping/Registry malformed
  response, expiry error ordering, disable dual-event ordering, exact counter
  label, direct caller error mapping, replacement first-failure ordering at each
  of its eight stages, uint64
  derivation, domain chain/address, one struct-field order, signature max,
  ERC-1271 `160_000` pre-call and `50_000` post-call gas guards, return length,
  magic alignment, and
  pending-clear. Also inject one hidden value-bearing low-level call, one token
  transfer call, and one `delegatecall` inside an allowlisted mutator; the
  opcode/call-site and behavioral gates must kill each mutation. Each mutation
  must be killed by a named test or executable static gate.

- [ ] **Step 7: Run repository-coupled contract checks**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/StockTokenRegistryV2.t.sol
  forge test --match-path 'test/SettlementGasPool*.t.sol'
  forge test
  Set-Location ..
  git diff --check
  ```

  If the repository's configured Foundry executable is unavailable, stop with
  an honest tooling blocker; never substitute a syntax check for Forge evidence.

- [ ] **Step 8: Commit O1 GREEN and write the task report**

  Commit only the O1 contract/interface/focused test adjustments. The report
  must state RED, GREEN, mutations, exact commands, ABI-negative result,
  runtime/storage observations, and dormant/undeployed truth.

---

### Task 3: Independent O1 authority and replay review gate

**Files:** read-only review of the Task 1-2 frozen diff/package. Any fix is a
separate focused implementation commit followed by a fresh independent review.

- [ ] **Step 1: Generate a frozen review package**

  Pin the plan path, base commit before Task 1, exact O1 head, diff, and task
  evidence. The reviewer must not review a moving worktree.

- [ ] **Step 2: Review with independent lenses**

  Use a different reviewer from the implementer. Inspect ownership separation,
  reciprocal proposal/acceptance role separation, nomination and checked uint64
  boundaries, generation invalidation, exact one-step global nonce semantics and
  the max-1 attack trace,
  direct-only replacement, typed field/domain exactness, EOA malleability,
  the two-family runtime STATICCALL/constructor-only Registry call boundary,
  ERC-1271 exact pre/post gas errors and return/reentrancy handling, constructor
  and direct-caller error mapping, early-expiry ordering, Safe-disable dual-event
  evidence, literal counter labels, successor error partition, reason/details
  evidence, failure
  atomicity, exact ABI allowlist, PUSH-aware runtime opcode disassembly,
  source/AST/IR external-call inventory, mutation evidence, runtime size, and no
  production reachability.

- [ ] **Step 3: Close findings before A1**

  Every Critical or Important finding blocks Task 4. Apply the smallest test-first
  fix, rerun focused/full O1 verification, regenerate the frozen package, and use
  another independent re-review. Record Minor findings explicitly for later work.

- [ ] **Step 4: Controller verification**

  The controller reruns the O1 focused suite, format, build/size, ABI/method/
  storage inspection, coupled RegistryV2/SettlementGasPool tests, and
  `git diff --check` at the approved commit. Only then mark O1
  implemented/independently approved/dormant and begin A1.

---

### Task 4: Add A1 scalar accounting and forced-balance classification

**Files:**

- Modify: `omerta-contracts/src/AcquisitionVault.sol`
- Modify: `omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol`
- Add: `omerta-contracts/test/AcquisitionVaultAccounting.t.sol`

**Final constructor:**

```solidity
constructor(
    address safeOwner,
    address stockTokenRegistryV2,
    uint256 globalLifetimeCanonicalDepositCapWei
)
```

- [ ] **Step 1: Write RED constructor and accounting-view tests**

  Preserve every O1 constructor predicate/error/precedence test, including the
  isolated `Ownable(safeOwner)` zero-owner result and the low-level exact-selector
  RegistryV2 response-length/sentinel rules; add only a nonzero global lifetime
  cap predicate. Compound-invalid precedence remains outside the API. Require
  paused, zero-funded, zero operator/nomination/ingress/budget, and all accounting
  scalars zero. Use test contract fixtures, not invented production addresses.

  Extend `IAcquisitionVaultV1` only with the A1 structs/enums/mutators/views/
  errors/events introduced by Tasks 4-6. Preserve O1's already-declared complete
  reason/readiness enums and constants without duplicate or speculative ABI.

  Re-run the O1 ownership/operator collision suite after A1 adds active/pending
  ingress. Prove a pending ownership or operator proposal cannot be made
  colliding by a later ingress proposal/activation, and every owner/operator
  acceptance/replacement rechecks active and pending ingress identities.

  Freeze `accountingTotals()` fields for `A/U/R/L/P/S/B/V/D/F`,
  `accountingSequence`, immutable registry, immutable global cap, and the public
  future constants `32/32/67`.

- [ ] **Step 2: Write RED balance-operation tests**

  Add `syncBalance()` and
  `reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)` tests.
  Empty-calldata and unknown-selector low-level calls revert because there is no
  `receive` or fallback ABI entry, but a dedicated force-send mock proves forced
  ETH remains possible.

  - If `F > 0`, `syncBalance` increments `accountingSequence` exactly once and
    classifies exactly `F` to `U`, never `A`.
  - If `D > 0`, it never lowers/rewrites a bucket; it records/emits the changed
    derived deficit observation under one sequence/evidence record.
  - If neither totals nor recorded deficit observation changes, it reverts
    `NoBalanceDelta` and creates no spam history.
  - A later valid financial mutation that repairs a recorded deficit emits the
    coherent changed/zero observation under that mutation's sequence.
  - Safe reclassification transfers no ETH: `U -= x`, `A += x`, one sequence,
    reason 18, nonzero details, nonzero in-range amount, and requires `D == 0`
    and `S == 0`.

  Each financial event carries pre/post totals and contiguous typed component
  indexes. Role/pause/nonce/proposal/budget evidence is nonfinancial and does not
  increment `accountingSequence`.

  Independently derive literal mutation and component IDs for every non-`NONE`
  component kind from the appendix preimages/table. Cover both nonzero and zero
  `BALANCE_DEFICIT_OBSERVATION_SET`, prove the sync kinds use the parent sync
  subject, reclassification uses exact `detailsHash`, and both deposit kinds use
  exact `depositId`. Never use production hash/ID helpers for expected values;
  reject `AccountingComponentKind.NONE` without sequence or history.

  Freeze A1 `unpause` as Safe-only with the O1 local identity/chain predicates
  plus `D == 0`, `S == 0`, one live active ingress, unchanged nonzero ingress
  code, exact pinned runtime code hash, no pending ingress proposal, and complete
  reciprocal owner/operator/ingress separation. Test every failed predicate in
  isolation. Final H/FO/A3/R freshness, health, adapter, oracle, and
  reconciliation readiness remain deferred gates; A1 is never deployed and its
  local unpause success is not launch readiness.

  Before Task 5 there is no active ingress, so the Task-4 scalar milestone must
  prove `unpause` fails exactly
  `LocalReadinessFailed(uint8(LocalReadinessCondition.ACTIVE_INGRESS_MISSING))`;
  the first possible A1 local-unpause success is tested only after Task 5
  activates a valid ingress. `NoActiveIngress` is reserved for ingress
  lifecycle/deposit operations, never readiness evaluation.

- [ ] **Step 3: Preserve RED evidence**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultAccounting.t.sol -vvv
  ```

  Expected failures must point to missing A1 behavior, not fixture or import
  errors.

- [ ] **Step 4: Implement the minimum scalar model**

  Add immutable RegistryV2/global-cap context; `available`, `unattributed`,
  `ordinaryReserved`, reconciliation liability/backing, sequence, and last
  deficit-observation storage. Compute `S/B/V/D/F` rather than storing redundant
  mutable values unless an exact evidence field requires the last observation.
  Checked arithmetic must fail closed; do not silently saturate an accounting
  bucket.

- [ ] **Step 5: Implement and verify balance operations**

  Make the focused suite GREEN, then add mutation tests for `F` going to A,
  deficit rewriting a bucket, duplicate sync history, missing sequence increment,
  reclassification during deficit, and noncontiguous components.

  ```powershell
  forge test --match-path test/AcquisitionVaultAccounting.t.sol -vvv
  forge test --match-path test/AcquisitionVaultOperator.t.sol
  forge fmt --check
  forge build --sizes
  ```

- [ ] **Step 6: Commit the focused accounting base**

  Commit only scalar accounting source/interface/tests. Do not add ingress,
  budget, reservation, reconciliation record, outflow, or deploy code yet.

---

### Task 5: Add delayed code-pinned ingress and canonical deposits

**Files:**

- Modify: `omerta-contracts/src/AcquisitionVault.sol`
- Modify: `omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol`
- Modify: `omerta-contracts/test/AcquisitionVaultAccounting.t.sol`

**Ingress interface:**

```solidity
struct IngressConfig {
    address ingress;
    bytes32 runtimeCodeHash;
    uint256 perDepositCapWei;
    uint256 epochDepositCapWei;
    uint256 lifetimeDepositCapWei;
}

depositCanonical(bytes32 sourceEventId)
    external payable returns (bytes32 depositId);
```

- [ ] **Step 1: Write RED ingress lifecycle tests**

  Add one pending proposal and one active ingress generation. Proposal and
  activation use the same 48-hour delay and seven-day half-open acceptance
  window as operator nomination: no overwrite, exact ID, Safe cancel, public
  expiry, Safe activation while paused, immediate Safe disable, and no active
  overlap. Activated generation caps are immutable.
  Missing proposal and wrong-ID checks precede time; early permissionless expiry
  of an exact live proposal reverts `ProposalNotReady(expiresAt)`.

  At proposal, activation, and every deposit, require nonzero contract code and
  the exact pinned `address.codehash`. Reciprocally reject vault, RegistryV2,
  owner, pending owner, main operator, and pending operator, plus the other
  active/pending ingress identity where applicable. Recheck at activation and
  deposit so delayed role changes cannot collapse authority.

  The contract makes **no** mechanical proxy-detection claim. A correctly pinned
  proxy has code and matches its own runtime hash, so these checks alone accept
  it. Tests cover missing code, wrong hash, and post-proposal/post-activation
  code drift only; they must not label a wrong-expected-hash fixture as proxy
  detection. Non-proxy/non-delegating ingress remains a mandatory source
  reproduction, creation/runtime-bytecode review, and launch-rehearsal gate.

- [ ] **Step 2: Write RED cap, identity, and replay tests**

  Freeze:

  ```text
  0 < perDeposit <= epoch <= generationLifetime <= constructorGlobalLifetime
  epoch = block.timestamp / 1 days
  generation totals never reset inside a generation
  constructor-global total never resets across ingress rotation
  ```

  Only the exact active ingress with unchanged code hash may deposit. Require
  nonzero `sourceEventId` and `msg.value`. Derive:

  ```text
  depositId = keccak256(abi.encode(
    keccak256("OMERTA_ACQUISITION_DEPOSIT_V1"),
    uint256(4663),
    address(this),
    ingressGeneration,
    msg.sender,
    sourceEventId
  ))
  ```

  One ID succeeds once. Test per-deposit, UTC-day, generation-lifetime, and
  constructor-global caps at `cap - 1`, `cap`, and `cap + 1`, day rollover, and
  rotation. A failed call consumes no ID, cap, accounting sequence, bucket, or
  event/component history.

  Check `depositedAt` at `type(uint64).max` and reject the first timestamp beyond
  it before consuming ID/cap/sequence. Test ingress proposal derivation at the
  same last-valid/first-invalid boundaries as operator nomination, and activation
  and disable record casts at `type(uint64).max`/first invalid.
  Independently assert `CounterExhausted` carries
  `keccak256(bytes("ingressProposalNonce"))` or
  `keccak256(bytes("ingressGeneration"))` as applicable; production helpers may
  not derive expected arguments.

- [ ] **Step 3: Write RED repair-first deposit tests**

  For a canonical deposit, `msg.value` is already in `V` on function entry, so
  calculate pre-call custody as:

  ```text
  preV = address(this).balance - msg.value
  balanceDeficitRepair = min(msg.value, max(B - preV, 0))
  availableCredit = msg.value - balanceDeficitRepair
  ```

  The repair portion increases backing without increasing a bucket; only the
  residual increases A. Store both values in an immutable `DepositRecord`, emit
  them under one deposit ID and one accounting sequence, and prove conservation.
  Deposits remain permitted while paused or in deficit because they repair
  custody.

  Do not add `depositCausalRefund`. Future R adds it only after exact
  reconciliation identities exist. Unknown/unmatched ETH remains U through
  `syncBalance`; it is never relabeled as canonical.

- [ ] **Step 4: Preserve RED, implement minimally, and turn GREEN**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultAccounting.t.sol -vvv
  ```

  Implement proposal/activation storage as bounded single slots plus keyed
  immutable generation records. Store per-generation lifetime, per-generation/
  UTC-day totals, global lifetime total, and `depositId -> DepositRecord` in
  mappings that no transaction enumerates. Then rerun the focused suite and O1.

- [ ] **Step 5: Run ingress mutations and ABI-negative checks**

  Kill mutations to delay/window inclusivity, activation-generation binding,
  live code-hash recheck, any ID field/order, cap inequality, global-cap reset,
  preV subtraction, repair-first order, one sequence per deposit, and failed-ID
  consumption. Kill reciprocal role-check mutations at propose, activate, and
  deposit. Do not claim a pinned proxy is mechanically distinguishable. Prove
  there is no refund, purchase, reservation,
  reconciliation, outflow, generic call, token, approval, migration/import, or
  sweep selector. Re-run the opcode-aware runtime disassembly and source/AST/IR
  call-site gates: O1/A1 runtime still contains no CALL/CALLCODE/DELEGATECALL/
  SELFDESTRUCT. Runtime STATICCALL remains limited to the two reviewed target
  families: compiler-emitted EOA `ecrecover` at `address(1)` and bounded ERC-1271
  validation. The exact RegistryV2 read remains constructor-only; prove through
  creation/runtime AST/IR/source, not a raw optimizer-dependent opcode count.

- [ ] **Step 6: Commit the ingress/deposit slice**

  Commit only the focused contract/interface/test delta and evidence report.

---

### Task 6: Add immutable pre-vote budget evidence

**Files:**

- Modify: `omerta-contracts/src/AcquisitionVault.sol`
- Modify: `omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol`
- Modify: `omerta-contracts/test/AcquisitionVaultAccounting.t.sol`

- [ ] **Step 1: Write the corrected RED tests before source**

  Test `authorizePreVoteBudget`, `getPreVoteBudget`, and
  `PreVoteBudgetAuthorized` using the exact structs and ID in this plan. Cover:

  - Safe-only, unpaused, nonzero amount/details;
  - `ballotDay >= block.timestamp / 1 days`;
  - exact `(ballotDay + 1) * 1 days + 2 hours` and all uint64/day overflow
    boundaries;
  - `authorizedAt` succeeds at `type(uint64).max` and the first timestamp beyond
    it reverts before any budget record/event;
  - `maxEthWei <= availableAtAuthorizationWei`, `D == 0`, and `S == 0`;
  - one immutable record per day with no cancel/rewrite/replacement;
  - current accounting sequence and available snapshot recorded without bucket,
    balance, or sequence movement;
  - later operator/accounting changes never rewrite the record and may make the
    budget unfundable;
  - an unused/skipped-day record creates no debt, rollover, catch-up, or right.

- [ ] **Step 2: Add result-authority negative tests**

  Inspect the ABI, event topics/data, stored struct, and ID preimage. Fail if
  they contain winner/version key, token, decimals, activation generation,
  tally hash, catalog version, votes, result, reservation, or post-close
  publication fields. Prove changing only day/max/deadline/sequence changes the
  ID, and RegistryV2 address is immutable context rather than winner identity.

- [ ] **Step 3: Preserve RED, implement, and turn GREEN**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultAccounting.t.sol -vvv
  ```

  Add only `ballotDay -> PreVoteBudgetAuthorization`, the exact Safe mutator,
  getter, event, checks, and closed reason 19. Authorization is evidence only.
  It must not reserve, debit, transfer, increment accounting, query ballot
  results, publish RegistryV2 state, or call an external consumer.

- [ ] **Step 4: Kill timing/provenance mutations**

  Mutate current-day comparison, deadline arithmetic, uint64 check, sequence in
  the ID, registry in the ID, overwrite guard, max-to-available check, pause,
  deficit/shortfall gate, and accidental sequence increment. Each mutation must
  fail a named test.

- [ ] **Step 5: Verify coupled slices and commit**

  ```powershell
  forge test --match-path test/AcquisitionVaultAccounting.t.sol -vvv
  forge test --match-path test/AcquisitionVaultOperator.t.sol
  forge test --match-path test/StockTokenRegistryV2.t.sol
  forge fmt --check
  forge build --sizes
  ```

  Commit only the budget source/interface/tests. The later dedicated finalized
  CB consumer remains a separate graph node and cannot be implied by this event.

---

### Task 7: Add A1 fuzz/stateful invariants and integrated contract evidence

**Files:**

- Add: `omerta-contracts/test/AcquisitionVaultInvariant.t.sol`
- Modify focused A1 tests/source only if a RED invariant exposes a real defect.

- [ ] **Step 1: Build a bounded stateful handler**

  Target only O1/A1 actions: nominate/accept/disable/replace/renounce operator,
  invalidate nonce, pause/unpause, propose/cancel/expire/activate/disable ingress,
  canonical deposit, force ETH, sync, reclassify, and authorize a current/future
  pre-vote budget. Bound actor set, amounts, days, time jumps, source IDs, and
  ingress rotations so every invariant run terminates with useful coverage. Add
  adversarial attempts to jump the nonce directly to max-1/max and role changes
  between proposal and acceptance/activation.
  Include insufficient-gas ERC-1271 traces at both exact guards, wrong-caller/no-
  active direct actions, early exact-ID proposal expiry, pending-only Safe
  disable, and counter-exhaustion fixtures with independently derived literal
  label hashes.

- [ ] **Step 2: Add reference-model fuzz tests**

  Fuzz exact uint256-wei boundaries and caps; deposit/force/sync/reclassify
  sequences against a small independent Solidity model; day/deadline/uint64
  calculations; code-hash and ID field mutations; and repeated failing calls.
  Independently derive mutation/component IDs from the exact per-kind subject
  table and preimages; avoid every production hash/ID helper for expected values.

- [ ] **Step 3: Add required stateful invariants**

  Prove after every handler action:

  ```text
  operatorGeneration and outflowNonce never decrease
  outflowNonce growth <= successful one-step invalidations in A1
  no single/bounded action can move nonce from zero to max-1
  active operator and pending nomination never coexist
  owner/pendingOwner/operator/pendingOperator/activeIngress/pendingIngress,
    vault, and RegistryV2 remain pairwise disjoint where nonzero
  every nonzero owner/pendingOwner remains a contract
  transferOwnership(current owner) always fails without event/state change
  V + D == B + F
  V + D + S == A + U + R + L + F
  L == P + S and P <= L
  R == L == P == S == 0 throughout A1
  global deposited == sum successful canonical-deposit values
  per-generation/day/lifetime totals never exceed immutable caps
  every successful deposit ID is unique and immutable
  accountingSequence increments exactly once per successful financial mutation
  every component kind is non-NONE and its subject/id matches the exact table
  failed actions change no nonce/sequence/ID/cap/bucket/event state
  signature gas-guard failures are InsufficientSignatureValidationGas and
    wallet-controlled validation failures are InvalidSignature
  pending-only operator disable emits cancellation then 0->0 change, increments
    generation once, and preserves outflowNonce
  forced ETH never becomes A without Safe reclassification
  pre-vote budgets move no funds and contain no result authority
  no O1/A1 actor can move native ETH, ERC-20, OMR, or Stock Tokens
  every compound-invalid replacement returns the error from the earliest failing
    stage in the frozen eight-step order and changes no state/logs
  successful unpause satisfies the exact milestone-local predicate
  missing active ingress during unpause uses LocalReadinessFailed(ACTIVE_INGRESS_MISSING),
    while lifecycle/deposit missing-ingress failures use NoActiveIngress
  ```

- [ ] **Step 4: Preserve invariant RED, fix minimally, and run full A1 checks**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultInvariant.t.sol -vvv
  forge test --match-path 'test/AcquisitionVault*.t.sol' -vvv
  forge fmt --check
  forge build --sizes
  forge inspect AcquisitionVault abi > acquisition-vault-abi.txt
  forge inspect AcquisitionVault methods > acquisition-vault-methods.txt
  forge inspect AcquisitionVault errors > acquisition-vault-errors.txt
  forge inspect AcquisitionVault events > acquisition-vault-events.txt
  forge inspect AcquisitionVault storageLayout > acquisition-vault-storage-layout.txt
  forge build --build-info
  ```

  Inspection output is temporary review evidence and must not be committed
  unless a later X artifact explicitly requires it. Delete only those exact
  temporary files after recording hashes/results; do not clean broad paths.
  Build-info/AST output stays in Foundry's ignored output tree and is not staged.

- [ ] **Step 5: Run full contract regression and static gates**

  ```powershell
  forge test
  forge fmt --check
  forge build --sizes
  Set-Location ..
  git diff --check
  ```

  Run available repository static analysis against the exact head. Confirm
  compiler `0.8.26`, optimizer `800`, Cancun, fuzz runs `512`, runtime size,
  exact ABI/method/error/event surface, storage layout, PUSH-aware forbidden-
  opcode test, and reviewed source/build-info AST/IR/optimized-IR call-site
  inventory. The runtime inventory permits only EOA `ecrecover` at `address(1)`
  and bounded ERC-1271 target families; the RegistryV2 exact-selector read is
  creation-only, and no assertion depends on raw STATICCALL count. A clean static
  result supplements but never replaces behavioral
  tests.

- [ ] **Step 6: Deliberately test the future 67-component architecture guard**

  Assert the public constant is exactly 67 and that no A1 function can populate
  either 32-record set or produce an outflow component. Add a future-facing
  test fixture specification to the O2 report: positive F, A, U, 32 live
  ordinary reservations, 32 live reconciliations, and an amount crossing all
  values must later emit exactly 67 contiguous components. A mutation to 66
  must fail then. Do not add fake records or an outflow now merely to satisfy
  that future test.

- [ ] **Step 7: Commit invariant/integration evidence**

  Commit only the invariant suite and any smallest test-first fixes. Record
  exact suite counts/results, fuzz/invariant runs, runtime bytes, ABI-negative
  proof, and storage-layout hash in the task report.

---

### Task 8: Independent A1 accounting, custody, and authority review gate

**Files:** read-only review of the frozen O1-approved base through Task 7 head.
Fixes use separate focused commits and new independent re-reviews.

- [ ] **Step 1: Generate a frozen A1 review package**

  Pin the approved O1 base, exact A1 head, this plan, full diff, TDD reports,
  mutation evidence, ABI/method identifiers, runtime size, storage layout, and
  focused/full test outputs. Exclude secrets and untracked launch inputs.

- [ ] **Step 2: Review with independent multi-lens Solidity coverage**

  A different reviewer inspects:

  - exact conservation and sequence/component continuity;
  - forced-surplus and live-deficit classification, spam resistance, and
    repair-first deposits;
  - ingress proposal timing, identity exclusions, code-hash rechecks,
    generations, cap monotonicity, deposit replay/ID atomicity;
  - truthful code-hash scope: address/code/hash pinning only, with no mechanical
    proxy-detection claim and an explicit source-reproduction launch gate;
  - budget timing/overflow/immutability and absence of future result authority;
  - O1 authority/replay properties after A1 expansion;
  - pause behavior and operations that intentionally remain available;
  - bounded storage/work, reentrancy, payable/forced-ETH behavior, exact ABI
    allowlist, PUSH-aware opcode scan, source/AST/IR call-site inventory,
    runtime size, and storage layout;
  - exact two-family runtime STATICCALL boundary (EOA `ecrecover` at address 1
    and bounded ERC-1271), constructor-only RegistryV2 read, and absence of any
    optimizer-dependent raw STATICCALL-count claim;
  - exact constructor, direct-caller, expiry, successor-consent, signature-gas,
    Safe-disable event, and literal counter-label error partitions;
  - no legacy import/migration, purchase, reservation, attempt, reconciliation
    disposition, outflow, token, burn, upgrade, deploy, signing, or cutover code.

- [ ] **Step 3: Close every Critical/Important finding**

  Fix test-first, rerun focused fuzz/invariants/full Forge/format/size/static
  gates, regenerate the package, and use another independent re-review. A1 does
  not unblock CB/A3 until all Critical and Important findings are closed.

- [ ] **Step 4: Controller final verification**

  At the approved commit, rerun:

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path 'test/AcquisitionVault*.t.sol' -vvv
  forge test
  forge fmt --check
  forge build --sizes
  forge inspect AcquisitionVault abi
  forge inspect AcquisitionVault methods
  forge inspect AcquisitionVault errors
  forge inspect AcquisitionVault events
  forge inspect AcquisitionVault storageLayout
  forge build --build-info
  Set-Location ..
  git diff --check
  ```

  Confirm the worktree scope and generated repository knowledge only after the
  implementation/review commits are stable. Knowledge normalization is a
  controller task; implementation agents do not hand-edit generated files.

- [ ] **Step 5: Record exact state truth**

  Mark O1 and A1 separately as implemented, independently approved, and dormant.
  Mark configured, deployed, Safe-executed, finalized, funded, and active as
  false unless separately supplied external evidence proves otherwise. State
  that CB, A3, R, and O2 remain pending and no transfer surface exists.

---

## Deferred dependency contracts

This plan intentionally freezes, but does not implement, these seams:

1. **CB bridge:** independent FO consumer for the finalized pre-vote budget event;
   atomic DB-open match before voting; later independent post-close result join;
   exact RegistryV2 publication and finalized replay; no borrowed cursor or
   manual production fallback.
2. **A3:** the only transition from A to ordinary R, after budget/result/catalog/
   health/oracle/adapter gates; maximum 32 live records; bounded active index and
   permanent tombstones; separate cancellation nonce; no public arbitrary insert.
3. **R:** maximum 32 live reconciliation records with liability, backing,
   shortfall, and opening sequence; no timeout erase; Safe-only final
   disposition; causal refund only for an exact open identity.
4. **O2:** the only direct/relayed operator ETH outflow. Both paths share O1's
   next nonce; direct stays available during pause/deficit; relay is paused in an
   emergency. Debit order is F classification, A, U, whole R cancellation, P
   reduction while L survives. Transfer is one empty-calldata call to a nonzero,
   non-vault destination. Recipient revert rolls back nonce, sequence, buckets,
   tombstones, components, and events. The exact maximum vector is 67.

No intermediate deployment occurs between these nodes. Before the first final
deployment, each A3/R/O2 commit must archive/review ABI, method identifiers,
runtime size, storage layout, gas at the 67-component vector, invariants, and
independent security findings. Exceeding the EVM runtime limit or an unapproved
chain-4663 gas fraction returns to architecture review; it does not authorize a
proxy, unbounded loop, partial accounting, skipped tombstone, or weaker signature
policy.

## Unresolved external launch inputs

These do not block O1/A1 source/TDD. They block deployment or a named dependent
node and must not be invented:

- exact production Safe, RegistryV2, ingress, and operator-candidate addresses;
- reproduced source, runtime code hash, modules, proxy/delegation status, and
  ERC-1271 compatibility for each production candidate;
- concrete global/per-deposit/per-day/per-generation cap values;
- the production ingress's truthful `sourceEventId` derivation and replay source;
- deployed vault address/code hash, initial owner/pause/zero-operator evidence,
  Safe execution, funding, and finalized event identities;
- H2 health-overlay readiness and its finalized clearance evidence;
- dedicated finalized budget-consumer address/start block/topics/limits and
  canonical pre-open event evidence;
- final A3/R/O2 runtime size, maximum-vector gas, and approved gas ceiling;
- third-party audit disposition and the separately authorized launch ceremony.

A runtime code hash is necessary but cannot prove non-delegating semantics. The
fixed 100,000-gas ERC-1271 policy is intentionally non-universal: an incompatible
candidate is rejected at launch rather than relaxing the policy or silently
revoking an already-active operator.

## Plan completion gate

This plan is complete only when:

- O1 has literal RED evidence, a focused implementation commit, mutation guards,
  full relevant verification, independent approval, and controller verification;
- A1 accounting, ingress/deposits, budget, fuzz/invariants, and integration each
  have RED/GREEN evidence and focused commits;
- A1 has an independent whole-slice approval with every Critical/Important closed
  and controller verification at the exact approved head;
- the exact ABI allowlist proves no forbidden **external selector**, while the
  executable PUSH-aware runtime disassembly, source/AST/IR call-site inventory,
  behavioral tests, injected hidden-call mutations, and independent review
  jointly prove O1 has no ETH outflow and A1 has no reservation, attempt,
  reconciliation disposition, operator outflow, token, gas-pool, upgrade, burn,
  arbitrary-call, legacy import, deploy, or cutover authority;
- the O1 interface exposes the complete frozen reason/readiness enums and O1-
  assigned constants but no premature A1 declarations; A1 adds only its exact
  appendix declarations, with no capability expansion;
- constructor tests isolate predicates and prove inherited owner errors plus the
  exact non-bubbling RegistryV2 sentinel/actual mapping; direct callers, early
  expiry, pending-only disable evidence, and literal counter labels match the
  appendix exactly; successor replacement obeys the frozen eight-stage first-
  failure order under compound-invalid RED, mutation, and invariant coverage;
- runtime STATICCALL evidence is target-family based: only compiler-emitted EOA
  `ecrecover` at address 1 and bounded ERC-1271 survive; the exact RegistryV2
  read is creation-only, and raw opcode count is never treated as stable;
- ERC-1271 uses the exact post-calldata `160_000` pre-call threshold, exact
  `100_000` requested gas, and `50_000` post-validation guard; gas-guard failures
  are `InsufficientSignatureValidationGas`, wallet failures are
  `InvalidSignature`, and every failure leaves state/logs unchanged;
- conservation, unique capped repair-first deposits, sequence continuity,
  32/32 future bounds, and the future 67-component ceiling are proven exactly;
- the pre-vote record is proven finalized-before-open only by the later dedicated
  CB consumer, never overclaimed by this contract plan;
- generated knowledge is normalized/verified by the controller and the tracked
  worktree is clean; and
- the final report distinguishes implemented, reviewed, configured, deployed,
  Safe-executed, finalized, funded, and active without unsupported claims.
