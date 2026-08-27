# Acquisition Constellation Task 2 — Authority Architecture Freeze

**Status:** architecture freeze pending independent approval; no Task 2 implementation or production approval is claimed

**Inputs:** the approved constellation architecture, the Task 0 ownership/collision crosswalk, historical O1 Tasks 1–3A, and the Task 1 deployment proof at `f6a21dcc` (independently approved C0/I0/M0 as a development proof only).

## 1. Replacement boundary and graph edge

Task 1 proved the deployment mechanism; it was never a production-approved constellation. Task 2 does not upgrade, migrate, or refinalize a Task 1 shell. It deploys a fresh Factory and five fresh children. Any Task-1-only deployment is abandoned, inert, and carries no state or migration claim into Task 2.

The Factory external constructor, four-function public ABI, ordinary-CREATE child order and nonces, phase ordinals, manifest formula, `CONSTELLATION_TAG`, and `DEPLOYMENT_TAG` remain unchanged except for the three snapshot errors frozen below. Configuration alone advances:

- `TASK2_CONFIG_TAG = keccak256("OMERTA_ACQUISITION_TASK2_CONFIG_V1")`;
- configuration schema version is `2`;
- the configuration root is exactly `keccak256(abi.encode(TASK2_CONFIG_TAG, uint256(2), registry, registryRuntimeHash))`, using the same Registry address and Registry runtime-hash fields;
- the Authority initcode/runtime, all five initcode hashes, predicted fresh child addresses, manifest hash, and deployment commitment are regenerated;
- the four unaffected child runtime bytecodes remain exact Task 1 shells.

The CREATE sequence is still Authority, Core, BudgetBook, IntentExecution, Reconciliation at Factory nonces 1–5. Finalization remains BudgetBook, Reconciliation, IntentExecution, Core, Authority (indices 2, 4, 3, 1, 0).

## 2. Authority construction and identity

The exact constructor is:

```solidity
constructor(
    address factory,
    bytes32 manifestHash,
    address safe,
    address registry,
    address core,
    address budgetBook,
    address intentExecution,
    address reconciliation
)
```

`factory`, `manifestHash`, `registry`, `core`, `budgetBook`, `intentExecution`, and `reconciliation` are private immutables. Safe is mutable `Ownable2Step` owner state rather than an immutable. Every address and the manifest hash is nonzero. Safe and Registry must contain code. Safe is the recognized governance-proxy exception and is not runtime pinned; Registry remains runtime pinned. Core, BudgetBook, IntentExecution, and Reconciliation are predicted, not-yet-deployed peers and are deliberately not code-checked in this constructor.

Factory, Safe, Registry, and the five predicted children must be pairwise distinct, and the executing Authority must equal the predicted Authority child at index 0. Thus “Authority” and “predicted child 0” are one identity, not two identities that could be required to differ. Collision validation uses the already-derived predicted children and checks candidates in the frozen constructor ladder. The constructor performs no `CALL` or `STATICCALL`, makes no peer call, and begins paused and unfinalized with zero operator, generations, nonces, nominations, ingress state, and ingress records.

The EIP-712 domain name is `OMERTA AcquisitionAuthority`, domain version is `2`, `version()` returns `2`, and the supported chain is 4663.

## 3. Exact Authority snapshot and Factory preflight

Authority adds exactly one fixed-output view with the canonical descriptor `authoritySnapshot() returns (uint256,address,bytes32,address,address,address,address,address,bool,address,address,bool,address,address,uint256,uint256,uint256,uint256,uint256,address,bytes32,address,bytes32)`. Its 23 words (736 bytes) are returned in this exact order:

| Field | Type | Ordinal | Pre-final expected value |
|---|---|---:|---|
| `snapshotVersion` | `uint256` | 0 | `2` |
| `factory` | `address` | 1 | committed Factory |
| `manifestHash` | `bytes32` | 2 | committed manifest |
| `registry` | `address` | 3 | committed Registry |
| `core` | `address` | 4 | predicted Core |
| `budgetBook` | `address` | 5 | predicted BudgetBook |
| `intentExecution` | `address` | 6 | predicted IntentExecution |
| `reconciliation` | `address` | 7 | predicted Reconciliation |
| `finalized` | `bool` | 8 | `false` |
| `owner` | `address` | 9 | Safe |
| `pendingOwner` | `address` | 10 | zero |
| `paused` | `bool` | 11 | `true` |
| `mainOperator` | `address` | 12 | zero |
| `pendingOperator` | `address` | 13 | zero |
| `operatorGeneration` | `uint256` | 14 | zero |
| `sharedO2Nonce` | `uint256` | 15 | zero |
| `cancelNonce` | `uint256` | 16 | zero |
| `ingressGeneration` | `uint256` | 17 | zero |
| `activeIngressGeneration` | `uint256` | 18 | zero |
| `activeIngress` | `address` | 19 | zero |
| `activeIngressConfigHash` | `bytes32` | 20 | zero |
| `pendingIngress` | `address` | 21 | zero |
| `pendingIngressConfigHash` | `bytes32` | 22 | zero |

The return is static: no dynamic tail. Factory calls it with zero value, a 120,000 gas cap, a fixed 736-byte output area, no dynamic returndata copy, no revert bubbling, and exact returndata length. Address words require zero high 96 bits and bool words must be exactly zero or one.

Factory adds these unique errors:

```solidity
error FactoryAuthoritySnapshotCallFailed();
error FactoryAuthoritySnapshotReturnLength(uint256 actualLength);
error FactoryAuthoritySnapshotSemanticMismatch(uint8 field);
```

The semantic mismatch payload is the first failing tuple ordinal, 0–22. Finalization precedence is exact: phase; child-count invariant; Registry code, runtime hash, call, return length, and chain result; child runtime/topology preflight at indices 0–4; Authority snapshot call, return length, canonical ABI, and field comparisons in ordinal order; transition to `FINALIZING`; finalizers in order 2,4,3,1,0; final flag rechecks; `FINALIZED` and event.

## 4. Storage and immutable layout

Task 2 is a fresh deployment, so the following declaration layout is normative rather than an upgrade layout:

| Root/slot | Exact semantic owner |
|---:|---|
| 0–1 | EIP-712 fallback name/version slots |
| 2 | Ownable owner |
| 3 offset 0 | pending owner |
| 3 offset 20 | paused |
| 4 offset 0 | `mainOperator` |
| 4 offset 20 | `_finalized` |
| 5 | `operatorGeneration` |
| 6 | `_sharedO2Nonce` |
| 7 | `_cancelNonce` |
| 8 | `nominationNonce` |
| 9–14 | pending-operator nomination fields |
| 15 | `ingressProposalNonce` |
| 16 | `ingressGeneration` |
| 17 | `activeIngressGeneration` |
| 18–28 | pending/active ingress fields |
| 29 | ingress-record mapping root |

ReentrancyGuard uses only its namespaced slot. The verifier must bind actual compiler-0.8.26 labels, slots, offsets, type identifiers, encodings, and byte widths to this semantic table, and bind every private peer immutable’s identity, Solidity type, bytecode reference positions, and lengths. No Core/accounting/cap storage may appear.

## 5. Exact surface and staging rule

Authority has exactly 50 functions: the 47 legacy `MOVE` functions, its unique topology getter, its unique finalizer, and `authoritySnapshot()`. `outflowNonce()` returns `_sharedO2Nonce`; there is no `sharedO2Nonce()` or `cancelNonce()` getter. `_cancelNonce` is initialized to zero and appears only in the snapshot during Task 2. Task 7 introduces and freezes cancellation consumption. Task 2 performs no O2 execution.

The error surface is the 35 legacy Authority custom errors; the five exact unique topology/constructor/finalizer errors `AuthorityFactoryZero()`, `AuthorityManifestHashZero()`, `AuthorityFinalizerUnauthorized(address)`, `AuthorityManifestHashMismatch(bytes32,bytes32)`, and `AuthorityAlreadyFinalized()`; and:

```solidity
error AuthorityNotFinalized();
error AuthorityInitialStateMismatch(uint8 field);
```

The seven inherited errors remain unchanged. Events are the 12 legacy Authority events, five inherited events, and the unique `AuthorityFinalized` event: exactly 18 events and no new nonce event. Full function-selector, semantic-error-selector, and event-topic collision checks remain mandatory.

Every state-changing function except the finalizer checks `AuthorityNotFinalized` first and then enters the same nonReentrant guard. This includes ownership, pause, permissionless expiries, operator, and ingress mutations, so ERC-1271 callbacks cannot interleave any Authority mutation. Read-only getters, hash helpers, topology, and snapshot remain callable before finalization.

The finalizer precedence is caller authorization, manifest match, already-finalized error, then initial-state checks. It sets `_finalized` only after all checks and emits `AuthorityFinalized`. `AuthorityInitialStateMismatch(field)` uses the snapshot ordinals: owner 9; pending owner 10; paused 11; main operator 12; pending operator 13; operator generation 14; shared nonce 15; cancel nonce 16; ingress generation 17; active generation 18; active ingress 19; active config hash 20; pending ingress 21; pending config hash 22. `_finalized == true` is handled only by the earlier already-finalized error (snapshot ordinal 8 is therefore not reused). Immutable identity fields 0–7 are construction invariants and are not mutable finalizer branches.

## 6. Ownership and operator state machine

Historical Task 3A behavior is preserved:

- ownership acceptance preserves the active operator, operator generation, shared O2 nonce, cancellation nonce, pause state, and active and pending ingress;
- it cancels only a pending operator nomination, emitting the inherited ownership-transfer event before the nomination-cancellation event;
- Safe candidates must contain code; ownership renunciation is disabled; `transferOwnership(address(0))` cancels an actual pending transfer and otherwise reports no pending transfer;
- Safe alone nominates/cancels/disables an operator; the nominee alone accepts after the delay and before expiry; expiry is permissionless;
- only the active operator renounces, directly replaces itself with exact successor consent, or invalidates the shared nonce;
- Safe or the active operator may pause;
- replacement is never relayed or unilateral: it is a direct current-operator call plus valid successor consent.

Every nonzero mutable role must be pairwise disjoint from owner, pending owner, active operator, pending operator, active ingress, pending ingress, Factory, Registry, and all five children. The complete set is rechecked both when proposed and when accepted or activated. Every mutation is nonReentrant.

## 7. Ingress lifecycle and caps

Only Safe may propose, cancel, activate, or disable ingress; expiry is permissionless. Proposal, cancellation, expiry, and disable are pause-independent. Activation is Safe-only and paused-only, with the existing half-open window. Cancellation, expiry, and disable remain possible through code absence or runtime-hash drift. Active ingress A and pending ingress B may coexist, and disabling A preserves pending B.

Task 2 validates nonzero ingress and runtime hash, nonzero caps, and `perDepositCapWei <= epochDepositCapWei <= lifetimeDepositCapWei`. Authority owns configuration and records but no consumed-cap totals. The Core-owned global lifetime cap is deliberately neither copied nor consulted until Task 3 deposit enforcement. This is a pre-production staging rule, not permission to accept deposits.

## 8. Pause and deliberately fail-closed unpause

Pause retains its historical authorization, state validation, and event order. Although the legacy `unpause(bytes32)` selector exists, it cannot succeed in Task 2. Its exact precedence is:

1. finalized check;
2. shared nonReentrant guard;
3. `onlyOwner`;
4. `ExpectedPause`;
5. `EmptyDetailsHash`;
6. `LocalReadinessFailed(11)`.

Readiness enum ordinal 11 is `CONSTELLATION_READINESS_UNAVAILABLE`. Task 2 makes no peer call and performs no partial or local-only unpause. A later readiness node must explicitly amend this behavior with the complete bounded protocol; Task 2 adds no readiness error.

## 9. IDs, EIP-712 hashes, and signature validation

### 9.1 Proposal and details IDs

Task 2 immediately uses V2 catalog IDs. Every preimage uses `abi.encode`, never packed encoding, and binds chain 4663, immutable Core, and Authority (`address(this)`). Literal tag constants and ordered preimages are:

- `AUTH_OPERATOR_PROPOSAL_V2_TAG = keccak256("OMERTA_AUTH_OPERATOR_PROPOSAL_V2")`:
  `(tag, 4663, core, authority, operatorGeneration, proposalNonce, proposedBy, nominee, proposedAt, validAfter, expiresAt, detailsHash)`.
- `AUTH_INGRESS_PROPOSAL_V2_TAG = keccak256("OMERTA_AUTH_INGRESS_PROPOSAL_V2")`:
  `(tag, 4663, core, authority, ingressGeneration, ingressProposalNonce, proposedBy, ingress, runtimeCodeHash, perDepositCapWei, epochDepositCapWei, lifetimeDepositCapWei, proposedAt, validAfter, expiresAt, detailsHash)`.
- `AUTH_INGRESS_CONFIG_V2_TAG = keccak256("OMERTA_AUTH_INGRESS_CONFIG_V2")`:
  `(tag, 4663, core, authority, ingress, runtimeCodeHash, perDepositCapWei, epochDepositCapWei, lifetimeDepositCapWei)`.
- `AUTH_OPERATOR_EXPIRY_DETAILS_V2_TAG = keccak256("OMERTA_AUTH_OPERATOR_EXPIRY_DETAILS_V2")`:
  `(tag, 4663, core, authority, proposalId, proposalNonce, nominee, expiresAt)`.
- `AUTH_OWNERSHIP_ACCEPT_OPERATOR_CANCELLATION_DETAILS_V2_TAG = keccak256("OMERTA_AUTH_OWNERSHIP_ACCEPT_OPERATOR_CANCELLATION_DETAILS_V2")`:
  `(tag, 4663, core, authority, proposalId, proposalNonce, previousOwner, newOwner, nominee)`.
- `AUTH_INGRESS_EXPIRY_DETAILS_V2_TAG = keccak256("OMERTA_AUTH_INGRESS_EXPIRY_DETAILS_V2")`:
  `(tag, 4663, core, authority, proposalId, ingressProposalNonce, ingress, expiresAt)`.

The proposal nonce named in each derived-details preimage is the stored proposal’s exact nonce, not a current counter read after mutation.

### 9.2 V2 typed data

Existing external ABI tuple shapes are preserved, but their typehashes are intentionally superseded. The literal type strings are:

```text
OutflowAuthorizationV2(address authority,address core,address targetModule,bytes32 action,address operator,address destination,uint256 amountWei,uint256 generation,uint256 nonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)
SuccessorConsentV2(address authority,address core,address targetModule,bytes32 action,address currentOperator,address successor,uint256 generation,uint256 outflowNonce,uint64 issuedAt,uint64 deadline,uint8 reasonCode,bytes32 detailsHash)
```

For outflow authorization, `targetModule = core` and `action = keccak256("OMERTA_O2_AUTHORIZATION_V2")`. For successor consent, `targetModule = address(this)` and `action = keccak256("OMERTA_OPERATOR_REPLACEMENT_V2")`. The implicit immutable/context fields precede the preserved tuple fields in the hash encoding. Authority is the EIP-712 verifying contract. Hash helpers only compute; they authorize nothing. Direct replacement validates the current operator generation and current shared O2 nonce. Task 2 does not consume an outflow authorization.

EOA signatures are exactly 65-byte canonical signatures validated with the current OpenZeppelin ECDSA behavior. ERC-1271 signatures are 1–4096 bytes. Validation performs one zero-value `STATICCALL` to the code-checked signer, selector `isValidSignature(bytes32,bytes)`, a 100,000 gas cap, exact 32-byte return, and left-aligned ERC-1271 magic. It enforces 160,000 gas before the call and 50,000 immediately after it, uses a bounded fixed output, dynamically copies neither success nor revert data, and never bubbles signer reverts. The shared nonReentrant guard covers the entire mutator during this callback.

Relayed cancellation signer and relay semantics are explicitly deferred to Task 7. Task 2 merely reserves `_cancelNonce == 0` and exposes it through the snapshot.

## 10. Prohibitions, sizes, and attestation

Authority has no Core behavior, ETH accounting, custody, global cap, deposit, receive, fallback, payable entry, generic execution, proxy, upgrade hook, `delegatecall`, `callcode`, `CREATE`, `CREATE2`, `selfdestruct`, token transfer/approval, or sweep. Its runtime external-call inventory is limited to the ecrecover precompile path and the exact ERC-1271 `STATICCALL`; ingress validation uses only `EXTCODESIZE`/`EXTCODEHASH` observations.

The Authority runtime target is at most 18,000 bytes and the hard Task 2 gate is 20,000 bytes. Initcode target is at most 30,000 bytes and the absolute gate remains 49,152 bytes. Factory and every other child retain the existing EIP-170/EIP-3860 gates.

Factory snapshot preflight and Authority’s independent finalizer checks are both mandatory. No business mutation is possible before finalization. Forced ETH at Factory or any child is inert and must not change any snapshot, finalization, role, or phase decision.

## 11. RED/GREEN evidence matrix

Task 2 implementation is incomplete until focused tests and the machine verifier cover at least:

1. fresh Factory/configuration/manifest/deployment commitments and proof that Task 1 addresses cannot be reused, upgraded, migrated, or refinalized;
2. every constructor zero/code/collision case in deterministic precedence, no peer calls, initial pause/zero state, and Safe proxy exception versus Registry runtime pinning;
3. exact 23-word snapshot encoding, every field, dirty address padding, dirty bool, 735/737/large return lengths, call failure/OOG, field-ordinal precedence, and atomic Factory rollback;
4. Authority initial-state mismatch ordinals and finalizer caller/manifest/already/state precedence;
5. unchanged historical Task 3A ownership behavior and event order;
6. full operator delay/window, counter/timestamp overflow, generation/shared-nonce rules, replay, replacement consent, EOA/1271 signature boundaries, gas boundaries, malformed return/revert bombs, and callback attempts against every mutator;
7. full ingress proposal/cancel/expire/activate/disable lifecycle, half-open time boundaries, code absence/hash drift liveness, A-active/B-pending behavior, role/constellation collisions at proposal and activation, and local cap inequalities without a copied global cap;
8. pause authorization/event order and the exact fail-closed unpause ladder ending in `LocalReadinessFailed(11)` with no peer call/state change;
9. ABI census, names/types/mutability/outputs/indexedness, storage roots/packing/types, immutable identities/reference positions, source/build provenance, selector/error/topic collisions, and compiler/optimizer/Cancun settings;
10. AST/optimized-IR/opcode mutations proving no hidden payable/receive/fallback, business state, unexpected external call, dynamic returndata copy/bubble, proxy/delegation/create/selfdestruct/token operation, or forbidden source-set drift;
11. size mutations at 18,000 target, 20,000 hard runtime gate, 30,000 target initcode, and 49,152 absolute initcode gate;
12. unchanged historical Accounting (38), Operator (84), and RegistryV2 (22) suites as behavioral oracles, without editing those suites.

The collision verifier must include all 50 Authority functions, all frozen Authority/inherited/topology/snapshot/Factory errors, all 18 Authority events, Factory events, every other topology descriptor, and historical `FUTURE_RESERVED` descriptors. No descriptor is admitted until full signature collision checks pass.

## 12. Verifier phase semantics and implementation edges

Task 2 adds a `-ValidatePhase Task1|Task2` mode. Before Task 2 lands, historical Task 1 remains reproducible with `-ValidatePhase Task1`. With the Task 2 verifier committed, the default phase is Task 2:

- complete conforming Task 2 artifacts: default/Task2 exit `0`;
- the current complete Task 1 six-artifact set under Task2 validation: exit `1` (conformance drift), not success;
- complete Task 1 under explicit Task1 historical validation: exit `0`;
- complete artifacts plus `-ExpectTask0Red`: exit `44`;
- no six artifacts: default phase exit `42`, while `-ExpectTask0Red` exits `0` after legacy/self-checks;
- partial artifact set: exit `43` in either phase;
- malformed, provenance-drifted, or otherwise nonconforming complete set: exit `1`.

Dependency order is: this independently approved freeze; Task 2 RED tests/verifier mutations; fresh Factory/Authority implementation; refreshed commitments and source hashes; Task 2 GREEN and unchanged oracle suites; independent security/spec rereview. Task 3 Core behavior is a separate node and must not enter this implementation.

## 13. Frozen ambiguity resolutions

This freeze resolves the previously open choices as follows:

- Initial-state mismatch payloads reuse snapshot ordinals rather than introducing a second ordinal language.
- V2 detail IDs use stored proposal nonces and explicit Core/Authority binding.
- The Core global cap is intentionally absent from Authority ingress validation until Task 3.
- Task 2’s unpause selector is deliberately nonfunctional and fail-closed rather than performing an incomplete local readiness check.
- Historical Task 1 verification remains available through an explicit verifier phase; it is not treated as Task 2 conformance.

No selector, semantic-error selector, event topic, storage-owner collision, or EVM impossibility is knowingly accepted by this document. Actual compiler-derived collision and layout evidence remains a mandatory RED gate before Solidity implementation.
