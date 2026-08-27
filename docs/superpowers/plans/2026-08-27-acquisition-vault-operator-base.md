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

- [ ] **Step 1: Freeze literal O1 selectors and typed payloads in the tests**

  The O1 test must reference only this external mutator/view surface:

  ```solidity
  nominateMainOperator(address nominee, bytes32 detailsHash)
  cancelMainOperatorNomination(uint256 expectedId, bytes32 detailsHash)
  expireMainOperatorNomination(uint256 expectedId)
  acceptMainOperatorNomination(uint256 expectedId)
  disableMainOperator(bytes32 detailsHash)
  renounceMainOperator(bytes32 detailsHash)
  replaceMainOperator(SuccessorConsent calldata consent, bytes calldata signature)
  invalidateOutflowNonce(uint256 newNextNonce, bytes32 detailsHash)
  pause(bytes32 detailsHash)
  unpause(bytes32 detailsHash)
  hashOutflowAuthorization(OutflowAuthorization calldata authorization)
  hashSuccessorConsent(SuccessorConsent calldata consent)
  pendingMainOperatorNomination()
  version()
  renounceOwnership() // always reverts for the owner
  ```

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

  Prove wrong chain, zero Safe, and EOA Safe fail; a distinct contract Safe is
  owner from construction; the contract starts paused with zero operator,
  generation, nonce, and nomination. Prove `Ownable2Step` remains independent,
  pending/accepted owner rotation does not change operator state, and
  `renounceOwnership` always reverts.

  Parse the compiled ABI/method identifiers and fail if O1 contains an ETH
  outflow/withdraw/sweep/generic call, `receive`, payable fallback, token
  transfer/approval, Registry activation/publication, allocation, gameplay,
  gas-pool, upgrade, recovery, `delegatecall`, or burn selector.

- [ ] **Step 3: Add nomination lifecycle boundary tests**

  Cover nomination only by the Safe from zero with no pending proposal;
  nonzero/distinct contract-or-EOA nominee and nonzero details; no overwrite;
  exact proposal ID; one bounded pending slot; exact `48h - 1`, `48h`,
  `expiresAt - 1`, and `expiresAt` behavior where
  `expiresAt = validAfter + 7 days`; exact nominee and ID acceptance; Safe
  cancellation; permissionless expiry with contract-derived details; and no
  appointment on cancel/expiry.

- [ ] **Step 4: Add generation and direct-transition tests**

  Prove Safe disable of an active operator or pending nomination is immediate,
  clears pending state, increments generation exactly once, preserves the
  global next-outflow nonce, and rejects a no-state disable. Prove only the
  direct active operator may renounce or replace; renounce reaches zero;
  replacement rejects zero/same/wrong caller/relay and atomically installs one
  successor with no overlap. Both increment generation exactly once and
  preserve the next nonce.

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
  - for contracts require gas for an exact `100_000`-gas `staticcall` plus a
    `50_000` post-call reserve;
  - copy at most 32 return bytes, require call success and
    `returndatasize == 32`, and accept only the ABI-left-aligned first four bytes
    `0x1626ba7e`;
  - collapse wrong magic, 0/4/31/33/64-byte return, revert, deliberate >100k
    consumption, insufficient outer gas, and malformed signature to one
    `InvalidSignature` without bubbling wallet-controlled data;
  - signature-consuming mutators are `nonReentrant`, validate before their first
    state write, and call a private transition core afterward.

  Assert every failure leaves operator, generation, nonce, nomination, pause
  state, and event history unchanged.

- [ ] **Step 7: Add nonce and pause tests**

  Prove `outflowNonce` means the next usable future O2 nonce, is shared by future
  direct/relayed outflows, never resets, and is preserved by every role,
  ownership, and pause transition. Only the direct active operator may
  invalidate to a strictly greater, non-maximum value with mapped reason and
  nonzero details. Invalidation moves no funds and writes no accounting
  sequence. Safe or active operator may pause; only Safe may unpause; pending
  nominee has no authority.

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
`expiresAt`, and details hash. Historical evidence lives in events, never an
enumerable array. O1's temporary constructor accepts only the contract Safe;
A1 changes it to the final three-argument constructor before any deployment.

- [ ] **Step 1: Define the narrow interface first**

  Add only the exact O1 structs, constants, errors, events, getters, mutators,
  and EIP-712 hash views required by Task 1. Use explicit custom errors and
  closed reason codes. Do not add convenience aliases, generic execution,
  payable functions, token interfaces, admin sweeps, recovery, or future A1/A3/
  R/O2 selectors.

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

  Require `block.chainid == 4663`, a nonzero contract Safe, initialize
  `Ownable(safeOwner)`, `EIP712("OMERTA AcquisitionVault", "1")`, and start
  paused. Override `renounceOwnership` to always revert, including for owner.

- [ ] **Step 3: Implement delayed Safe nomination and generation transitions**

  Implement the exact transition table:

  | Action | Preconditions | Generation | Next outflow nonce | Pending |
  |---|---|---:|---:|---|
  | nominate | Safe; operator zero; no pending; nonzero distinct nominee/details | unchanged | unchanged | create `[+48h, +48h+7d)` |
  | cancel | Safe; exact live ID/details | unchanged | unchanged | clear |
  | expire | anyone; exact ID; `now >= expiresAt` | unchanged | unchanged | clear |
  | accept | exact nominee/ID; `validAfter <= now < expiresAt` | +1 | preserve | clear |
  | disable | Safe; active or pending real state | +1 once | preserve | clear |
  | renounce | direct active operator/details | +1 | preserve | defensive clear |
  | replace | direct active operator; distinct successor; valid consent | +1 | preserve | defensive clear |
  | invalidate | direct active operator; strictly greater nonmax nonce/details | unchanged | set target | absent |
  | pause | Safe or active operator | unchanged | unchanged | unchanged |
  | unpause | Safe and local readiness | unchanged | unchanged | unchanged |

  Failed transitions must perform no partial write or event emission.

- [ ] **Step 4: Implement exact typed hashes and bounded signature validation**

  Encode fields in the literal Task-1 order. Public hash helpers return
  `_hashTypedDataV4(structHash)`. Replacement is direct-only and validates only
  the successor's same-transaction consent. There is no separate consent nonce:
  a successful role change invalidates through generation, while an intervening
  future outflow/invalidation changes the bound `outflowNonce`.

  Implement the EOA/ERC-1271 validator exactly as tested, with `4_096` bytes,
  `100_000` call gas, `50_000` reserve, exact 32-byte return, left-aligned magic,
  one closed error, no returndata bubbling, and no state write before validation.

- [ ] **Step 5: Make the O1 RED suite GREEN**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/AcquisitionVaultOperator.t.sol -vvv
  forge fmt --check
  forge build --sizes
  forge inspect AcquisitionVault abi
  forge inspect AcquisitionVault methods
  forge inspect AcquisitionVault storageLayout
  ```

  Every command exits `0`. Inspect method identifiers explicitly and record the
  absence of outflow/sweep/payable/token/upgrade/burn surfaces.

- [ ] **Step 6: Run deliberate mutation checks**

  Locally mutate one condition at a time, run the focused suite, and revert only
  the deliberate mutation: 48-hour delay, exclusive expiry, generation +1,
  nonce preservation, direct caller, domain chain/address, one struct-field
  order, signature max, ERC-1271 gas, return length, magic alignment, and
  pending-clear. Each mutation must be killed by a named test.

- [ ] **Step 7: Run repository-coupled contract checks**

  ```powershell
  Set-Location omerta-contracts
  forge test --match-path test/StockTokenRegistryV2.t.sol
  forge test --match-path test/SettlementGasPool*.t.sol
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
  nomination boundaries, generation invalidation, global nonce semantics,
  direct-only replacement, typed field/domain exactness, EOA malleability,
  ERC-1271 gas/return/reentrancy handling, reason/details evidence, failure
  atomicity, ABI authority absence, runtime size, and no production reachability.

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

  Require chain `4663`; distinct, nonzero contract Safe and RegistryV2;
  `IStockTokenRegistryV2(registry).supportedChainId() == 4663`; nonzero global
  lifetime cap; paused, zero-funded, zero operator/nomination/ingress/budget; and
  all accounting scalars zero. Use test contract fixtures, not invented
  production addresses.

  Freeze `accountingTotals()` fields for `A/U/R/L/P/S/B/V/D/F`,
  `accountingSequence`, immutable registry, immutable global cap, and the public
  future constants `32/32/67`.

- [ ] **Step 2: Write RED balance-operation tests**

  Add `syncBalance()` and
  `reclassifyUnattributed(uint256 amountWei, bytes32 detailsHash)` tests.
  `receive()` and fallback always revert, but a dedicated force-send mock proves
  forced ETH remains possible.

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

  At proposal, activation, and every deposit, require nonzero contract code and
  the exact pinned `address.codehash`. Reject vault, RegistryV2, Safe, and current
  operator as ingress. V1 is non-proxy/non-delegating; mechanically reject known
  wrong/drifted/proxy-like bytecode fixtures, while stating truthfully that a
  code hash cannot prove semantics and launch still needs source reproduction
  and delegation review.

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
  consumption. Prove there is no refund, purchase, reservation,
  reconciliation, outflow, generic call, token, approval, migration/import, or
  sweep selector.

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
  ingress rotations so every invariant run terminates with useful coverage.

- [ ] **Step 2: Add reference-model fuzz tests**

  Fuzz exact uint256-wei boundaries and caps; deposit/force/sync/reclassify
  sequences against a small independent Solidity model; day/deadline/uint64
  calculations; code-hash and ID field mutations; and repeated failing calls.
  Avoid deriving expected values through contract helpers.

- [ ] **Step 3: Add required stateful invariants**

  Prove after every handler action:

  ```text
  operatorGeneration and outflowNonce never decrease
  active operator and pending nomination never coexist
  V + D == B + F
  V + D + S == A + U + R + L + F
  L == P + S and P <= L
  R == L == P == S == 0 throughout A1
  global deposited == sum successful canonical-deposit values
  per-generation/day/lifetime totals never exceed immutable caps
  every successful deposit ID is unique and immutable
  accountingSequence increments exactly once per successful financial mutation
  failed actions change no nonce/sequence/ID/cap/bucket/event state
  forced ETH never becomes A without Safe reclassification
  pre-vote budgets move no funds and contain no result authority
  no O1/A1 actor can move native ETH, ERC-20, OMR, or Stock Tokens
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
  forge inspect AcquisitionVault storageLayout > acquisition-vault-storage-layout.txt
  ```

  Inspection output is temporary review evidence and must not be committed
  unless a later X artifact explicitly requires it. Delete only those exact
  temporary files after recording hashes/results; do not clean broad paths.

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
  ABI/method surface, and storage layout. A clean static result supplements but
  never replaces behavioral tests.

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
  - budget timing/overflow/immutability and absence of future result authority;
  - O1 authority/replay properties after A1 expansion;
  - pause behavior and operations that intentionally remain available;
  - bounded storage/work, reentrancy, payable/forced-ETH behavior, ABI negatives,
    runtime size, and storage layout;
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
  forge inspect AcquisitionVault storageLayout
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
- ABI-negative checks prove O1 has no ETH outflow and A1 has no reservation,
  attempt, reconciliation disposition, operator outflow, token, gas-pool,
  upgrade, burn, arbitrary-call, legacy import, deploy, or cutover surface;
- conservation, unique capped repair-first deposits, sequence continuity,
  32/32 future bounds, and the future 67-component ceiling are proven exactly;
- the pre-vote record is proven finalized-before-open only by the later dedicated
  CB consumer, never overclaimed by this contract plan;
- generated knowledge is normalized/verified by the controller and the tracked
  worktree is clean; and
- the final report distinguishes implemented, reviewed, configured, deployed,
  Safe-executed, finalized, funded, and active without unsupported claims.
