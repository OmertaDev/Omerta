# Acquisition Constellation Task 0 Crosswalk

**Status:** normative Task 0 crosswalk; Task 1 topology/deployment node implemented and locally verified, later business nodes pending independent review

**Architecture source:** `2026-08-27-acquisition-constellation.md`

**Frozen oracle:** Task 5 `AcquisitionVault` at runtime 23,212 bytes. Its ABI census is exactly 67 functions, 55 errors, 21 events, one constructor, and 144 total entries. Its semantic storage ends at mapping root 39. It has one payable function, `depositCanonical(bytes32)`, and no receive or fallback.

This document assigns each legacy descriptor and semantic state item once. It does not authorize production contracts, deployment, or any later-node surface.

## Categories and collision rules

`MOVE` assigns one legacy descriptor to one final contract. `INHERITED` records framework surface. `RETIRED` removes a monolith-only construction while preserving its successor obligations. `FUTURE_RESERVED` is noncompiled until its implementation node.

Uniqueness is checked across callable function `bytes4` selectors, semantic error `bytes4` selectors, and full event signatures/topics. Constructors are counted and verified separately and are excluded only from callable cross-artifact comparisons. `ReentrancyGuardReentrantCall()` is the sole descriptor allowed to repeat, as named inherited infrastructure. Future-reserved descriptors participate in the collision universe even while absent from Task 0/Task 1 ABIs and runtimes.

## Functions — 67

### AcquisitionAuthority — 47 `MOVE`

| IDs | Ordered descriptors |
|---|---|
| F001–F007 | `owner()`; `pendingOwner()`; `transferOwnership(address)`; `acceptOwnership()`; `renounceOwnership()`; `paused()`; `eip712Domain()` |
| F008–F020 | `supportedChainId()`; `OPERATOR_NOMINATION_DELAY()`; `OPERATOR_ACCEPTANCE_WINDOW()`; `INGRESS_PROPOSAL_DELAY()`; `INGRESS_ACCEPTANCE_WINDOW()`; `MAX_AUTHORIZATION_LIFETIME()`; `MAX_SIGNATURE_BYTES()`; `ERC1271_CALL_GAS()`; `ERC1271_POST_CALL_GAS_RESERVE()`; `ERC1271_MIN_PRECALL_GAS()`; `OUTFLOW_AUTHORIZATION_TYPEHASH()`; `SUCCESSOR_CONSENT_TYPEHASH()`; `version()` |
| F021–F025 | `mainOperator()`; `operatorGeneration()`; `outflowNonce()`; `nominationNonce()`; `pendingMainOperatorNomination()` |
| F026–F033 | `nominateMainOperator(address,bytes32)`; `cancelMainOperatorNomination(bytes32,bytes32)`; `expireMainOperatorNomination(bytes32)`; `acceptMainOperatorNomination(bytes32)`; `disableMainOperator(bytes32)`; `renounceMainOperator(bytes32)`; `replaceMainOperator((address,address,uint256,uint256,uint64,uint64,uint8,bytes32),bytes)`; `invalidateOutflowNonce(uint256,bytes32)` |
| F034–F037 | `pause(bytes32)`; `unpause(bytes32)`; `hashOutflowAuthorization((address,address,uint256,uint256,uint256,uint64,uint64,uint8,bytes32))`; `hashSuccessorConsent((address,address,uint256,uint256,uint64,uint64,uint8,bytes32))` |
| F038–F047 | `ingressProposalNonce()`; `ingressGeneration()`; `activeIngressGeneration()`; `pendingIngressProposal()`; `getIngress(uint256)`; `proposeIngress((address,bytes32,uint256,uint256,uint256),bytes32)`; `cancelIngressProposal(bytes32,bytes32)`; `expireIngressProposal(bytes32)`; `activateIngress(bytes32)`; `disableIngress(bytes32)` |

### AcquisitionVaultCore — 20 `MOVE`

| IDs | Ordered descriptors |
|---|---|
| F048–F050 | `MAX_ACTIVE_ORDINARY_RESERVATIONS()`; `MAX_ACTIVE_RECONCILIATIONS()`; `MAX_OPERATOR_OUTFLOW_COMPONENTS()` |
| F051–F052 | `stockTokenRegistryV2()`; `globalLifetimeCanonicalDepositCapWei()` |
| F053–F064 | `availableWei()`; `unattributedWei()`; `ordinaryReservedWei()`; `reconciliationLiabilityWei()`; `reconciliationBackingWei()`; `accountingSequence()`; `lastObservedBalanceDeficitWei()`; `accountingTotals()`; `syncBalance()`; `reclassifyUnattributed(uint256,bytes32)`; `globalLifetimeCanonicalDepositedWei()`; `ingressLifetimeDepositedWei(uint256)` |
| F065–F067 | `ingressEpochDepositedWei(uint256,uint256)`; `getDeposit(bytes32)`; `depositCanonical(bytes32)` |

No Task 5 function moves to Factory, BudgetBook, Intent, or Reconciliation.

## Errors — 55

### Custom errors — 48 `MOVE`

| Owner | IDs | Ordered names |
|---|---|---|
| Factory | ER001–ER002 | `WrongChain`; `RegistryChainMismatch` |
| Authority | ER003–ER037 | `ZeroAddress`; `ContractRequired`; `RoleIdentityCollision`; `OwnershipRenunciationDisabled`; `NoPendingOwnershipTransfer`; `EmptyDetailsHash`; `InvalidActionReason`; `CounterExhausted`; `TimestampOverflow`; `MainOperatorActive`; `NoMainOperator`; `OperatorNominationPending`; `OperatorNominationMissing`; `ProposalIdMismatch`; `NotNominee`; `ProposalNotReady`; `ProposalExpired`; `NoOperatorStateChange`; `InvalidOperatorReplacement`; `InvalidOutflowNonceStep`; `OutflowNonceExhausted`; `InvalidAuthorizationWindow`; `AuthorizationNotYetValid`; `AuthorizationExpired`; `InvalidAuthorizationFields`; `InvalidSignature`; `InsufficientSignatureValidationGas`; `LocalReadinessFailed`; `IngressProposalPending`; `IngressProposalMissing`; `InvalidIngressConfig`; `IngressCodeHashMismatch`; `IngressActive`; `NoActiveIngress`; `IngressNotFound` |
| Core | ER038–ER048 | `InvalidGlobalLifetimeCap`; `NoBalanceDelta`; `InvalidAmount`; `InsufficientUnattributed`; `BalanceDeficitActive`; `ReconciliationShortfallActive`; `NotActiveIngress`; `DepositSourceRequired`; `DepositReplay`; `DepositCapExceeded`; `DepositNotFound` |

The canonical signatures are frozen in the verifier. Similar failures in another module require unique module-specific errors; callees may propagate their authoritative errors without redeclaring them.

### Inherited errors — 7 `INHERITED`

Authority owns `OwnableUnauthorizedAccount(address)`, `OwnableInvalidOwner(address)`, `EnforcedPause()`, `ExpectedPause()`, `InvalidShortString()`, and `StringTooLong(string)`. `ReentrancyGuardReentrantCall()` is the only approved repeatable inherited descriptor.

## Events — 21

Authority owns 12 custom events `MOVE`: `MainOperatorNominationCreated`, `MainOperatorNominationCancelled`, `MainOperatorNominationExpired`, `MainOperatorChanged`, `OutflowNonceInvalidated`, `RiskPaused`, `RiskUnpaused`, `IngressProposalCreated`, `IngressProposalCancelled`, `IngressProposalExpired`, `IngressActivated`, and `IngressDisabled`.

Core owns four custom events `MOVE`: `AccountingMutation`, `AccountingComponent`, `UnattributedReclassified`, and `CanonicalDeposit`.

Authority owns five inherited events `INHERITED`: `OwnershipTransferStarted`, `OwnershipTransferred`, `Paused`, `Unpaused`, and `EIP712DomainChanged`.

The verifier freezes all 21 full canonical signatures and topics.

## Storage, constants, and types

| Legacy location | Semantic item | Successor owner |
|---|---|---|
| slots 0–1 | EIP-712 name/version fallback | Authority |
| slot 2 | owner | Authority |
| slot 3 offsets 0/20 | pending owner / paused | Authority |
| slots 4–7 | main operator, operator generation, outflow nonce, nomination nonce | Authority |
| slots 8–13 | pending operator nomination | Authority |
| slots 14–20 | `A/U/R/L/P`, accounting sequence, observed deficit | Core |
| slot 21 | global lifetime canonical deposited | Core |
| slots 22–24 | ingress proposal nonce, generation, active generation | Authority |
| slots 25–35 | pending ingress proposal | Authority |
| root 36 | ingress records | Authority |
| root 37 | ingress lifetime deposited | Core |
| root 38 | ingress epoch deposited | Core |
| root 39 | deposit records | Core |

OpenZeppelin ReentrancyGuard’s namespaced slot is `INHERITED` address-isolated guard infrastructure. Final layouts are fresh layouts, not upgrade-compatible preservation of legacy physical slots.

Authority owns operator/ingress/EIP-712/1271 timing, bounds, typehashes, tags, and `version`. Core owns Registry and global-cap immutables, accounting/deposit tags, sequence tags, and O1 bounds. `stockTokenRegistryV2()` is exposed only by Core; `version()` only by Authority.

Authority semantically owns `ReasonCode`, `LocalReadinessCondition`, `PendingOperatorNomination`, `OutflowAuthorization`, `SuccessorConsent`, `IngressConfig`, `PendingIngressProposal`, and `IngressRecord`. Core semantically owns `AccountingTotals`, `AccountingMutationKind`, `AccountingComponentKind`, `DepositCapKind`, and `DepositRecord`. A type-only source library may share encodings without becoming runtime authority.

Factory and manifest immutables are private. Each module has a unique topology getter returning exactly `(factory, manifestHash, finalized)`, plus a unique one-shot finalizer, error, and event. Finalizers return zero bytes. Factory uses fixed typed calls, not a uniform selector loop or probing fallback.

Task 1 supersedes any earlier aggregate/opaque topology assumption with the exact
nonrecursive commitments, reproducible configuration root, five-phase machine,
Factory ABI, validation precedence, gas/return policy, and topology-only child
constructors frozen in section 3.0 of the architecture amendment. Task 1 shells
prove no future Authority or Core business state. The combined collision universe
must include every Factory descriptor and every unique child constructor error.

## Constructor, payable, and forced ETH

The one legacy nonpayable constructor is `RETIRED` and split among Factory launch checks, Authority initialization, and Core registry/cap/accounting initialization. All successor constructors and `deployNext` are nonpayable; every CREATE uses value zero. `depositCanonical(bytes32)` on Core is the sole legacy payable function. No contract has receive or fallback. Forced ETH at Core is not credited by construction: initial stored buckets/sequence/records are zero while `V == F`; first sync maps `F -> U`. Forced balances at noncustodial children are inert and unrecoverable.

## Task 6 `FUTURE_RESERVED`

The never-landed historical Task 6 BudgetBook surface is noncompiled in Task 0/Task 1 but collision-checked now. Its exact source is the operator-base plan’s corrected pre-vote budget section, event catalog, and closed error set:

- functions: `authorizePreVoteBudget((uint256,uint256,uint64),bytes32)`, `getPreVoteBudget(uint256)`;
- errors: `BudgetDayClosed(uint256)`, `BudgetDeadlineOverflow()`, `InvalidPurchaseUntil(uint64,uint64)`, `BudgetAlreadyAuthorized(uint256)`, `InsufficientAvailable(uint256,uint256)`, `BudgetNotFound(uint256)`;
- event: `PreVoteBudgetAuthorized(bytes32,uint256,uint256,uint64,uint256,uint256,uint64,uint8,bytes32)`.

Budget Authorization is the approved closed literal exception to generic V2 ID templates. These entries do not change the 67/55/21/1 legacy census.

## IDs and intentional hash changes

Every implementation-node ID table must state its literal preimage, Core vault identity, owner/emitter, and EIP-712 domain when applicable. There is no mechanical `address(this) -> Core` rewrite.

| Domain | Legacy literal/preimage authority | Successor ruling |
|---|---|---|
| operator nomination/proposal/expiry | legacy tag, chain, monolith, nonce/config | Authority identity; intentional hash change |
| outflow authorization/successor consent | frozen EIP-712 typehash and monolith domain | Authority frozen EIP-712 domain; intentional domain/verifying-contract change |
| accounting mutation/component | legacy tag, monolith, sequence/subject | explicit Core vault identity; Core owns/emits; intentional hash change |
| canonical deposit | legacy deposit tag, monolith, ingress generation/source | explicit Core identity plus Authority ingress evidence; Core owns/emits; intentional hash change |
| future intent/attempt/reconciliation/repair/O2 | no Task 5 descriptor | each node freezes a literal V2 preimage with explicit Core identity and record owner/emitter |
| Budget authorization | no Task 5 descriptor | closed literal Budget exception; no generic V2 rewrite |

The undeployed monolith creates no legacy-record compatibility obligation. ABI descriptor preservation does not imply hash preservation.

## Deployment/finalization and dependency attestation

CREATE is banned everywhere except one future audited raw CREATE callsite in nonpayable `Factory.deployNext`. It uses value zero and verifies phase, supplied initcode hash, committed size bounds, exact expected address, returned address, nonzero deployment, and committed runtime hash before advancement; failure rolls back. Creation-time and runtime AST/IR/opcode inventories are separate. CREATE2 is globally banned.

After five deployments the factory is ready to finalize. One atomic Task 1 transaction checks only the frozen runtime identity, Registry health, and topology-shell state, enters exact `FINALIZING`, and finalizes in fixed order `BudgetBook -> Reconciliation -> Intent -> Core -> Authority`. It checks zero-length finalizer returns and every final flag, then marks the factory final. Task 1 has no Authority/Core business state, guards, forced-ETH accounting, or BudgetBook/Intent/Reconciliation business state to inspect. Those checks belong to their versioned future production nodes. Any failure rolls back all child activations. Every finalizer and every factory phase mutator permanently reverts afterward.

Launch attestation categorically proves nonproxy/nondelegating behavior for Registry, circuit-breaker/health, canonical ingress, oracle, adapter, and Stock Token. No proxy exception exists in the current architecture. Any future proxy allowance requires a separate approved architecture amendment that binds and rechecks both proxy and implementation identities and hashes. Constellation children can never use such an exception.

## Prohibitions and call allowlist

All six runtimes forbid proxy/fallback/receive/delegatecall/callcode/create2/selfdestruct, generic execution, upgrades, arbitrary target/calldata, hidden payable functions, role mirrors, and accounting mirrors. Runtime must be `<= 24,576`; initcode `<= 49,152`.

Task 0/Task 1 admits no business calls. The only future CREATE exception is Factory `deployNext`; later typed Authority/Core/finalizer, adapter, reconciliation leaf, and O2 calls are introduced by their own nodes and exact allowlist amendments. Opcode presence is checked with a PUSH-aware scanner; target, selector, value, gas, returndata, and failure policy are checked through AST/IR.

Task 1's callsite rows are phase-complete rather than single-use labels. The
Registry helper policy covers both constructor validation and finalization
revalidation. The unique topology helper policy covers deploy-time validation,
finalization preflight, the check immediately after each finalizer, and the final
all-flags recheck. The unique finalizer CALL policy covers the fixed five-call
order only. Every phase use retains the same frozen target provenance, selector,
value, gas, fixed output/return-length handling, canonical tuple validation,
no-bubble policy, and normalized error family.

## RED boundary

Task 0 is green only when the literal census, collision universe, ownership manifest, mutation fixtures, and oracle artifact checks pass, while an explicit artifact-missing RED test proves the six final artifacts are absent. Verifier exit semantics are frozen: with all six artifacts absent, default exits `42` and `-ExpectTask0Red` exits `0`; with a partial set in either mode, exit `43`; with all six conforming, default exits `0` and `-ExpectTask0Red` exits `44`; with all six present but any conformance drift, either mode exits `1`. Artifact cardinality is classified before conformance, while complete-set conformance is evaluated before the `-ExpectTask0Red` complete-set rejection so drift never masquerades as exit `44`. Task 1 replaces absence with exact six-artifact conformance. Linux CI later invokes PowerShell 7 with the same script and arguments.
