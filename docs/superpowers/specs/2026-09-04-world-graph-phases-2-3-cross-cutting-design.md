# World Graph Phases 2–3 Cross-Cutting Architecture and Verification Design

- **Status:** Approved architecture, written-spec review candidate
- **Date:** 2026-09-04
- **Branch:** `codex/world-graph-phases-2-3`
- **Foundation:** Phase 1 commit `0bdc0af79261fbbb00acab5e4516747f40cbe365`

## Purpose

This document defines the binding architecture, safety boundaries, compatibility rules, engineering workflow, and verification gates shared by every Phase 2 and Phase 3 sub-phase of the OMERTÀ world-graph expansion.

It deliberately does not repeat the detailed product catalog for materials, professions, workshops, recipes, equipment, mysteries, or social cases. Those details belong in the Phase 2A–2E and Phase 3A–3E specifications and implementation plans. A sub-phase specification may narrow or add requirements inside this contract, but it may not weaken a rule in this document without a new explicit design review and user approval.

The central architectural choice is **staged convergence**:

- one declarative authored-package and compiler plane;
- one authoritative, PostgreSQL-backed item ownership and provenance plane;
- a small set of allowlisted runtime capability adapters;
- exact-hash activation and continuation of in-flight work;
- a public package source plus a separately access-controlled production-secret overlay;
- separately sealed server and public projections;
- automatic structural, economy, privacy, social, reachability, and difficulty reports before activation.

## Normative language

The words **must**, **must not**, **required**, and **forbidden** are release-blocking requirements. **Should** identifies the default that may be changed only when the relevant sub-phase specification documents a concrete reason and preserves every binding invariant. **May** identifies optional behavior.

## Scope

This specification governs:

- authored package discovery, compilation, imports, exports, lockfiles, reports, and activation;
- the boundary between author-controlled data and server-controlled executable behavior;
- canonical material, item, escrow, and provenance authority;
- transaction, replay, and lock-order rules for value-bearing mutations;
- definition versioning and migration of Phase 1 state;
- compatibility for existing authored content and Phase 1 world-graph routes;
- private projections and server-owned mystery truth;
- public-repository and private-overlay custody for authored secrets;
- task-level TDD and independent review;
- Phase 2 and Phase 3 verification, red-team, release, and stop gates;
- Task 0, the Windows CRLF baseline portability defect.

The following remain out of scope:

- Phase 4 OMR mystery rewards or seasonal OMR vault activation;
- NFT contract deployment, minting, bridging, or live export routes;
- broad on-chain inventory;
- production cross-Family diplomacy or cross-Family reward allocation;
- arbitrary authored JavaScript, SQL, expression languages, templates with execution authority, shell commands, network calls, or dynamically loaded modules;
- a wholesale rewrite of all existing content before Phase 2 work can begin.

## Binding invariants

Every implementation and content package must preserve all of these invariants.

1. `collection_log` is a status and completion ledger. It is never authoritative inventory, escrow, recipe knowledge, blueprint custody, durability, or ownership.
2. A logical material quantity or unique object has exactly one authoritative ownership state at a time.
3. Materials, unique items, cash costs, cash transfers, and other value-bearing effects mutate atomically with their domain action and provenance.
4. An HTTP idempotency record is not sufficient economic authority. Every value-bearing domain action has a transaction-local domain mutation guard and deterministic replay result.
5. A failed or rolled-back mutation leaves no consumed input, created output, ownership transfer, event fragment, escrow residue, cash ledger residue, or reserved domain guard.
6. Normal materials and routine items remain off-chain.
7. NFT eligibility is metadata on selected unique items. It does not create a second spendable representation and grants no export transition during Phases 2 or 3.
8. Phase 2 and Phase 3 content cannot emit, mint, award, transfer from a hidden reserve, randomly drop, time-emit, or otherwise mutate OMR.
9. Social minimums use distinct durable account IDs and server-observed meaningful participation. Character IDs, role labels, action counts, elapsed time, and client claims do not substitute for distinct accounts.
10. Secrets and role-private evidence are filtered on the server for every projection path. Client secrecy is never an authority boundary.
11. No raw authored package can load into a production runtime. Only an exact-hash compiled and validated server bundle can be activated.
12. Source files and successful builds do not activate content. Activation is a separate, explicit, auditable operator action.
13. A package cannot introduce executable behavior. It can only select from the capability, condition, effect, dynamic-signal, and projection vocabularies registered by server code.
14. Existing in-flight jobs, markets, projects, and mysteries remain pinned to their immutable compiled definitions unless an explicit recovery migration moves them.
15. PostgreSQL is the production authority. pg-mem must remain supported as a deterministic compatibility test harness, but its emulation behavior cannot weaken PostgreSQL transaction requirements.
16. Static validation must finish before a package is activatable and must fail closed on uncertainty, unsupported capabilities, unresolved dependencies, ambiguous ownership, or exceeded exact-analysis budgets.
17. All definition IDs, output identities, event identities, and replay identities used in an economic mutation are server-derived.
18. Authored mystery rewards in Phases 2 and 3 are value-neutral unless a separately reviewed existing game adapter transfers already-authorized non-OMR value. A graph package cannot create a new currency source.
19. This repository is public. Production answers, private evidence bodies, secret node and edge structure, verifier inputs, and secret-bearing dependency details must never be committed here, included in public CI artifacts, or exposed to an author or reviewer that does not require them.

## Existing foundation and convergence decision

Phase 1 currently has two intentionally separate content lanes:

1. The generic world-graph lane uses JavaScript package objects, `src/worldgraph.js`, `src/worldgraph-validate.js`, `src/items.js`, and the direct crafting, mystery, and operation runtimes. Its item ledger is value-bearing.
2. The JSON authored-content lane uses `src/content/compiler.js`, exact-hash activation, `src/content/runtime.js`, and the Bellini workshop modules. Bellini inventory and barter are intentionally gameplay-inert and exact-hash isolated.

Maintaining those lanes as independent Phase 2 authorities is forbidden. The same logical material, blueprint, crafted item, or mystery object must not be mirrored between the Bellini lot tables and the generic item ledger.

Rewriting all existing content and APIs before Phase 2 is also rejected. It would combine compiler replacement, state migration, public API migration, and economy expansion in one unsafe cutover.

Staged convergence therefore proceeds as follows:

1. New Phase 2 and Phase 3 definitions are authored as declarative packages and compiled into the canonical intermediate representation described below.
2. Value-bearing outputs and custody always enter the canonical item module and its PostgreSQL tables.
3. New runtime behaviors are implemented as small allowlisted adapters that consume the compiled intermediate representation.
4. Phase 1 direct world-graph packages and routes remain a compatibility lane while their behavior is covered by regression tests.
5. No new Phase 2 or Phase 3 product feature is authored into the Phase 1 JavaScript package format.
6. Existing Bellini packages remain an isolated, inert compatibility surface. They may be ported later through an explicit migration, but are not generalized into the Phase 2 economy.
7. Once equivalent compiled packages and migration tests exist, a later reviewed task may retire a compatibility path. Retirement is not implicit in this project.

## Canonical compiler and intermediate representation

### Artifact flow

The trusted build joins two data-only inputs. The public package source lives in this repository. A separately access-controlled secret overlay lives in an operator-approved private repository or secret artifact store and is never copied into the public worktree or public CI cache.

The build path is:

```text
public declarative package + access-controlled secret overlay
  -> deterministic dual-source discovery and pairing
  -> source schema validation
  -> package-qualified canonical IDs
  -> import resolution
  -> canonical indexed IR
  -> exact dependency lock
  -> structural and semantic validators
  -> server-sealed bundle
  -> safe public manifest
  -> runtime indexes
  -> validation, economy, difficulty, privacy, and knowledge reports
  -> explicit operator activation by exact hash
```

The compiler is deterministic. Given the same canonical public authored bytes, canonical private-overlay bytes, compiler/format versions, and exact dependency-catalog/lock inputs, it must produce byte-identical canonical IR, lockfile content, reports, and the explicitly named hashes below. The trusted build independently verifies the resulting exact `secretOverlayHash`; a hash alone is never treated as compiler input. An overlay's display version is not an identity substitute for its bytes. Source-file enumeration and map/set serialization use stable ordering. Wall-clock time, filesystem order, absolute paths, machine names, random IDs, and network responses cannot enter canonical output.

Reproducibility of a production mystery is verified inside the trusted build environment using the exact public commit and private-overlay immutable version. Public CI can compile public-only economy packages and synthetic mystery overlays, validate public manifests, and verify signed/hash attestations for production secret overlays; it cannot reconstruct or print production answers.

### Automatic discovery

All public packages under the approved public roots are discovered automatically. Trusted production builds also discover and pair the corresponding overlays from an approved private root by namespace, version, public-source hash, and overlay contract version. A developer must not maintain a hand-written list of packages in `package.json`, a test, or a deployment script.

Discovery must:

- follow a documented filename and directory convention;
- sort paths canonically;
- ignore only explicitly documented non-package fixture roots;
- fail if a manifest is malformed, duplicated, or shadowed;
- fail if a production package exists but is absent from the compiled corpus;
- distinguish non-activatable adversarial, synthetic-scale, and test fixture packages through a server-owned fixture profile, not an author-selected production flag;
- fail when a production mystery that declares a secret contract has no exact private overlay, has an overlay for a different public hash, or exposes a secret field in the public source;
- fail when an unexpected private overlay has no matching public package, preventing shadow content from entering a bundle.

The `content:check`, build, CI, activation, and release-preflight paths must all use the same discovery and validation entry point. The current split where a CLI can call `compileContentPack` while activation applies an additional `validateActivatableContentPack` check must be removed. A package cannot pass CI and then fail an already-known activation rule.

### Canonical identities

Every exported definition has:

- a package-qualified logical ID;
- a positive definition version;
- a canonical definition hash;
- an owning package ID and exact `bundleHash`;
- a declared definition kind;
- an activation profile;
- immutable authored fields;
- optional compatibility metadata that is itself hashed.

Unqualified local names may be used inside one source package for author convenience, but the compiler resolves them to package-qualified IDs before validation. Runtime code, database rows, dependency locks, provenance events, and cross-package imports use canonical IDs.

A logical ID is never reused for a semantically different object. A changed economic rule, ownership rule, recipe input/output, secret solution, role requirement, or runtime effect produces a new definition version and hash. Purely presentational text may be treated as definition-compatible only when the relevant sub-phase schema explicitly marks it non-authoritative; its authored-input `sourceHash` or `secretOverlayHash`, applicable `publicManifestHash`, and root `bundleHash` still record the change.

Packages use one closed discriminated kind:

- `experience` has exactly one primary experience and may be activated under an approved runtime profile;
- `library` exports definitions but has no runtime entry point and cannot be activated as an experience;
- `fixture` is assigned only by server-owned approved fixture roots and CI configuration and can never select or promote itself into a production profile through authored data.

The closed production profile registry for this program contains `phase2_economy` and `phase3_mystery`. A sub-phase may declare a server-owned capability subset inside one of these profiles, but cannot invent a third alias or weaken the parent profile's safety and OMR exclusions.

### Imports, exports, and lockfile

Packages can consume only declared exports from declared dependencies. Reaching into an unexported node or referring to another package by undeclared raw ID is a compiler error.

An authored dependency may state an allowed compatibility range, but compilation resolves that range to one exact dependency `bundleHash` and exact exported definition hashes. The generated lock records at least:

- root package ID, version, profile, and `sourceHash`;
- compiler/IR format version;
- every transitive dependency package ID, version, and exact hash;
- every imported exported ID and exact definition hash;
- compatibility declarations used during resolution;
- the hash of the complete resolved dependency set.

Public dependency entries that reveal no secret structure are source-controlled next to the public package and reviewed like code. Secret imports, hidden node identities, and secret-bearing dependency structure live only in the private exact lock stored with the overlay. The public repository stores the safe lock subset plus a non-oracular trusted-build attestation ID/status. The signed attestation in the access-controlled registry binds the public commit, overlay version, private `dependencyLockHash`, and `bundleHash` without publishing those private digest values as equality or topology oracles. Builds never resolve dependencies from the network. A changed resolution modifies the applicable lock and requires review even if visible source did not change.

In-flight state pins the root `bundleHash` and `dependencyLockHash`. A dependency activation change cannot alter an existing run.

Hash domains are explicit and non-self-referential. `Frame(tag, fields...)` is a canonical byte encoding with a versioned ASCII domain tag, fixed field order, explicit type, and length prefix for every field; concatenation of ambiguous unframed strings is forbidden:

```text
definitionHash = H(Frame("omerta:definition:v1", definitionFormatVersion,
                   packageQualifiedLogicalId, definitionVersion,
                   canonicalImmutableDefinition))
sourceHash = H(Frame("omerta:source:v1", canonicalPublicAuthoredInputs))
secretOverlayHash = H(Frame("omerta:secret-overlay:v1", canonicalPrivateOverlay))
dependencyLockHash = H(Frame("omerta:dependency-lock:v1",
                       canonicalResolvedDependencyClosure))
irHash = H(Frame("omerta:compiled-ir:v1", canonicalCompiledIR))
bundleHash = H(Frame("omerta:bundle:v1", formatVersion, compilerVersion,
               sourceHash, secretOverlayHash, dependencyLockHash, irHash))
publicManifestHash = H(Frame("omerta:public-manifest:v1",
                       canonicalSafePublicManifest))
```

Every canonical payload above excludes its own output field and all generated copies of that output. `canonicalPublicAuthoredInputs` excludes generated artifacts and hashes. `canonicalPrivateOverlay` excludes its own hash, bundle/IR/lock hashes, generated indexes, attestations, reports, paths, and timestamps. `canonicalResolvedDependencyClosure` excludes its own hash and the final bundle hash. `canonicalCompiledIR` excludes generated hash fields, reports, indexes not used by runtime semantics, attestations, paths, and timestamps. `canonicalSafePublicManifest` excludes its own hash, private digests, sealed fields, generated attestations/reports, paths, and timestamps. `canonicalImmutableDefinition` includes the definition's behavior, compatible imported `definitionHash` references, and hashed compatibility metadata. It excludes its own `definitionHash`, the owning `bundleHash`, package/lock/IR hashes, generated indexes, reports, attestations, build paths, and timestamps. The resulting `definitionHash` may be embedded in canonical IR; `bundleHash` can therefore depend on `irHash` without a cycle back into definition identity.

The lock may contain the root ID, version, profile, `sourceHash`, and `irHash`; it must not contain the final `bundleHash` of an artifact that includes the lock. Database and server-internal compatibility columns currently called `content_hash` store or map explicitly to `bundleHash`; new internal code and reports use the exact domain names above rather than overloading “package hash” or “content hash.” A public response never exposes a secret-bearing `bundleHash`, whether the bundle uses the Phase 2 or Phase 3 profile: it returns `publicManifestHash` or a safe public version field plus opaque cursor and action tokens. Existing public `contentHash` fields remain unchanged only for legacy or no-secret bundles; new secret-capability projections are versioned rather than silently changing that field's meaning. Economy packages with no secret overlay use the canonical hash of an empty overlay value, not a missing or ambiguous field, and may expose their non-secret `bundleHash` where the existing expected-content contract requires it. An economy package with a confidential recipe/discovery overlay follows the same private-hash and opaque-action rules as a mystery bundle.

### Indexed IR

The canonical IR contains normalized, non-executable data plus indexes required by validators and runtimes. It must include:

- stable numeric node ordinals local to the compiled bundle;
- node kind and package-qualified logical ID;
- normalized incoming and outgoing adjacency indexes;
- explicit dependency class: hard prerequisite, optional branch, consumes, produces, discovers, reveals, shares, contributes, aggregates, rewards, or recovery;
- explicit visibility and audience descriptors;
- capability descriptors with schema-validated arguments;
- item definition and recipe references pinned by exact hash;
- branch, choice, convergence, terminal, and recovery annotations;
- social role constraints and minimum distinct-account requirements;
- dynamic-signal descriptors from the registered allowlist;
- server-only secret payload references;
- public projection metadata that contains no secret value.

Validation algorithms must use iterative graph traversal and compact predecessor or component witnesses. They must not recursively walk arbitrary-depth authored graphs or copy a full witness set into every reachable node.

### Compiled outputs

One compilation produces distinct artifacts:

1. **Server-sealed bundle:** complete canonical IR created only inside the trusted build environment from the public package and matching private overlay; it contains private evidence, canonical answers, hidden truth, runtime capability descriptors, the private exact lock, and immutable indexes. It is stored only in an access-controlled server artifact store or database. Only trusted server code can read it.
2. **Safe public manifest:** discoverable titles, summaries, eligibility hints, declared public nodes, client rendering metadata, and public dependency information. It contains no answer, private evidence, undiscovered node identity, private node count, hidden branch shape, or internal account/organization identifier unless the package explicitly declares that datum public and the privacy validator permits it.
3. **Validation reports:** a safe public structural/status report and an access-controlled exact report containing secret-bearing reachability, recovery, safety-boundary, classification, and activation-profile witnesses.
4. **Economy report:** sources, sinks, recipes, conservation equations, scarcity/value-cycle findings, item ownership transitions, and OMR/cash authority scan.
5. **Social/privacy reports:** a safe aggregate status report and an access-controlled exact report containing role compatibility, classification/declassification flow, contribution, replacement/recovery, and private-data noninterference witnesses.
6. **Difficulty report:** graph depth, distinct systems, professions, unique items, minimum accounts, required branches, irreversible choices, time gates, critical dependencies, and an explicitly labeled approximation score.
7. **Knowledge manifest:** public architecture and content relationships suitable for repository knowledge-graph ingestion. It excludes secret nodes, edges, dependency shape, and solution material. It is diagnostic documentation, not runtime authority.

Reports are deterministic build artifacts. Public reports contain only safe summaries, counts that cannot disclose hidden structure, `sourceHash`/`publicManifestHash`, and non-oracular trusted attestations. `secretOverlayHash`, private `dependencyLockHash`, secret-bearing `irHash`/`bundleHash`, detailed solvability, privacy-flow, and secret-dependency reports stay in the private review store except where an operator-only artifact registry requires them. A package with an error-severity finding cannot be built as activatable content. Difficulty warnings require human review but do not claim to prove intellectual difficulty.

## Authored-package safety boundary

### Data-only source

Public source packages and private overlays are parsed as data. They may contain schema-bounded strings, numbers, booleans, arrays, objects, canonical IDs, enum values, and narrative markup explicitly supported by the client sanitizer. Production private overlays are never written into this public repository, public pull-request patches, public CI logs, source maps, test snapshots, or public build artifacts.

The following are forbidden anywhere in an activatable package or its dependency lock:

- JavaScript, TypeScript, WebAssembly, SQL, shell, bytecode, serialized functions, or module paths;
- dynamic imports, callbacks, event-handler strings, or function names outside closed adapter enums;
- general expression languages or templating capable of property access, loops, calls, evaluation, or I/O;
- database table, column, query, or transaction names supplied as runtime instructions;
- filesystem paths, URLs used as runtime code/data imports, network fetches, or environment-variable references;
- author-supplied random seeds, server timestamps, item IDs, event IDs, account IDs, owner IDs, or idempotency keys;
- authored regular expressions of any JavaScript-compatible form;
- markup that bypasses the existing sanitization and Content Security Policy model.

The raw JSON decoder must reject duplicate member names at every object depth before ordinary object materialization, so a later key can never shadow a field already inspected. The same duplicate-aware decoder and dangerous-key policy run in `content:check`, build, registry ingestion, and activation. The parser must also reject dangerous object keys such as `__proto__`, `prototype`, and `constructor` in structures that are later mapped into ordinary objects. Compiler code must not merge untrusted objects into prototypes. Malicious fixtures cover duplicate profile/adapter/identity fields at the root and nested levels plus prototype keys.

Each compiler profile defines server-owned limits for source bytes, nesting depth, string bytes, node count, edge count, per-node references, exact-analysis component size, and report witnesses. Limits are enforced before expensive traversal and cannot be raised by a package. Production limits and synthetic scale-fixture limits are separate versioned compiler configuration, so a fixture cannot grant a production package a larger attack surface.

Authored answer and matching rules use only normalized exact strings, finite enum/set membership, and schema-bounded token sequences. If a future feature requires pattern matching, it needs a separately reviewed mechanically linear-time matcher such as a restricted RE2-compatible engine with pattern, state, and input limits; heuristic approval of ordinary regular expressions is forbidden.

### Closed capability registries

Server code owns separately versioned registries for:

- conditions and gates;
- economic sources, sinks, costs, and transfers;
- inventory consume, create, escrow, release, and repair effects;
- profession, blueprint, facility, and recipe checks;
- mystery evidence, choice, theory, sharing, and contribution effects;
- dynamic world signals;
- projections and redaction policies.

An adapter declares its argument schema, transaction class, lock classes, replay behavior, visibility behavior, allowed activation profiles, and whether it can touch value. The compiler rejects an unknown adapter, unknown argument, incompatible node kind, wrong activation profile, or adapter version outside the package's exact dependency lock.

Adapters receive resolved server-side identities and a branded transaction context. Raw content never receives a database client or lower-level inventory primitive.

### OMR boundary

The compiler has explicit `phase2_economy` and `phase3_mystery` activation profiles. Both profiles reject every OMR-related node, field, input, output, effect, cost, reward, allocation, reserve reference, currency alias, or adapter.

This is stricter than older generic compiler behavior that can describe finite precommitted OMR allocations. That older capability is not available to these profiles. Runtime adapters used by Phase 2 or Phase 3 do not receive an OMR mutation capability. Static source scanning, canonical IR scanning, adapter-capability scanning, database-ledger assertions, and simulation must all independently show zero OMR movement.

Phase 4 requires a new approved specification, compiler profile, finite allocation authority, implementation, review, and explicit activation. Phase 2/3 data cannot become OMR-capable merely by activating it under a later server version.

### Cash and other value

A recipe or mystery package cannot directly grant arbitrary cash. Cash costs, item-market settlements, service settlements, and approved business/contraband sale adapters must use existing transaction-ledger conventions and an explicitly modeled source, sink, or counterparty. The economy report identifies every cash-moving adapter and classifies whether it is a transfer, sink, or separately authorized bounded source.

Content compilation fails for an unclassified cash path. Replays cannot create a second transaction row. Failure after a provisional cash debit must roll back the debit with the item and domain state.

## Activation and runtime definition lifecycle

### Bundle storage

The server stores every activatable bundle by exact `bundleHash` in an access-controlled artifact store or database and retains every hash referenced by live or historical state. Production server bundles and private overlay bytes are never emitted as public release artifacts. Bundles are immutable. An attempt to store different bytes under an existing hash is a fatal integrity error.

Activation records are append-only audit events that identify:

- namespace or package family;
- exact bundle and lock hashes;
- compiler/IR version;
- activation profile;
- operator identity;
- activation timestamp;
- the previously active hash, if any;
- validation-report hashes.

### Activation

Activation must:

1. load the stored server-sealed bundle by exact hash;
2. verify canonical bytes and all recorded hashes;
3. execute the same complete content-validity validator entry point used by `content:check` and build;
4. confirm every exact dependency bundle remains stored and compatible;
5. confirm the activation profile is permitted in the current environment;
6. record the activation event transactionally;
7. make the new hash available only for new instances, jobs, offers, or projects unless a migration explicitly says otherwise.

Activation is idempotent for the same namespace and hash. It never recompiles mutable source on the production server and never silently migrates in-flight state.

Activation may add environment authorization checks—such as whether an operator can activate in production—but it cannot contain a content-validity rule absent from check/build. Anything knowable from the bundle, lock, profile, or adapter registry belongs to the shared validator.

### Continuation and rollback

Every job, recipe run, facility operation, market offer, service order, social project, mystery instance, and seasonal case stores the exact root bundle hash, lock hash, and relevant definition hashes it began with.

After a new activation:

- new state uses the newly active hash;
- old in-flight state continues with its pinned immutable definitions;
- an already-live hash-pinned parent mystery, project, or service may issue a *dependent start* for the exact archived recipe, repair, service, or facility revision stored in its immutable dependency lock even though that dependency is no longer globally active; the issued action and mutation digest bind the parent aggregate ID, parent `bundleHash`, exact lock entry, dependency definition hashes, and resulting job/service ID, and this authority cannot be used by an unrelated caller or standalone new work;
- old inventory remains visible and historically valid;
- incompatible lots cannot enter new recipes unless the new definition explicitly declares and validates a conversion or compatibility rule;
- old market offers remain cancelable or fillable according to their pinned rules and old services/projects retain their pinned valid transitions, never stranded merely because a new version activated, except when the exact transition is placed in the registered incident recovery freeze below;
- a previous bundle may be reactivated for new state as an operational rollback, while already-started state stays pinned.

If a pinned definition contains a security or economy defect that cannot safely continue, a registered incident state identifies the exact hash, aggregate/transition capability, reason class, and recovery policy. It may recovery-freeze an unsafe new dependent start, offer fill, service accept/start/complete, project transition, scheduled effect, or other executable pinned transition, while safe read, cancel, refund, custody release, collection of already-created non-defective value, and explicit recovery remain available as the incident policy permits. A freeze never silently runs the transition under current definitions or leaves custody without a terminal owner.

An explicit recovery migration must enumerate affected state, prove conservation and mystery solvability, define refunds or compatible substitutions, be replay-safe, and produce provenance. Silent mutation, floating to the currently active dependency, generally reopening an archived recipe, or cancel-only abandonment without full settlement is forbidden. Real-PostgreSQL and route tests activate revision R2, race an R1 incident freeze against an open R1 offer fill, service accept/start/complete, project transition, and dependent craft/repair/service start, and prove each unsafe transition either commits entirely before the freeze or is refused into its exact conservation-safe recovery. Positive-path tests still start and finish an unfrozen R1 craft, repair, and service from a live R1 parent; mixed old/new reachable loops are rechecked for positive cycles.

## Canonical item authority

### Authority boundary

`src/items.js` and its successor modules remain the only mutation authority for Phase 2 value-bearing inventory. Specialized runtimes can request an allowlisted mutation through a branded transaction context; they cannot write inventory tables directly.

The canonical inventory model consists of:

- immutable item-definition versions;
- fungible or quality-banded lots with exact definition hashes;
- unique item instances with exact definition hashes and one custody state;
- domain escrow/custody records that reference canonical lots or instances;
- compact provenance summaries for hot projections;
- append-only item and lot events for complete history;
- global domain mutation guards and deterministic mutation output ordinals.

The exact Phase 2A schema plan may split modules for maintainability, but it must implement this single authority model.

### Phase 1 stack migration

The current `item_stacks` primary key merges by owner, template, and quality and does not pin an item-definition hash. Phase 2 materials cannot safely use that shape because package revisions with the same logical template could merge.

Phase 2A must perform a one-way, verified migration to lot authority:

The approved [Lot Integration Amendment](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md) governs execution order for this conceptual list: only artifact admission and additive nullable-schema preparation precede the fence. Holding receipts, lot parts, unique attachments/backfill, final reconciliation and constraints, obsolete-writer rejection, and epoch publication all occur inside the same final locked cutover transaction. The list does not authorize committed provisional holdings before that fence; a failed final cutover rolls back without a stale receipt-repair phase.

1. create immutable definition-version and lot tables additively;
2. generate a deterministic compatibility manifest mapping every existing Phase 1 template to an exact Phase 1 definition hash;
3. backfill each nonzero Phase 1 stack into deterministic canonical parts capped by the exact compatibility definition, with source-row receipts and stable part ordinals, without changing total quantity, quality or owner, as defined by the Phase 2A lot-integration amendment;
4. verify per-owner, per-template, per-quality totals and global totals before cutover;
5. enter an explicit maintenance-window or deployment-epoch fence that prevents every legacy writer before final reconciliation;
6. perform a final locked reconciliation and switch all item reads and writes to the new authority in one reviewed release boundary;
7. install database write blocking or equivalent privilege enforcement in the same cutover transaction and require every new process to verify the lot-authority epoch before accepting value mutations;
8. retain the old table only as a compatibility read model or archived migration evidence, never as a second mutable authority.

There is no steady-state dual-write period. If a compatibility projection is required, it is derived from canonical lots and can be rebuilt. A real-PostgreSQL migration test races a legacy writer against the fence and proves the write is either included before final reconciliation or cleanly rejected, never lost. A surviving old process fails its authority-epoch check rather than writing stale storage.

Existing unique `item_instances` are extended or migrated so every row pins a deterministic definition hash, quality rule, eligibility policy, and compact provenance version. A legacy sentinel such as `unknown` is forbidden. Every migrated item must map to an immutable compatibility definition.

### Ownership and custody

Direct spendable ownership initially remains character or account scoped. Nonspendable custody is explicit and purpose-bound, including operation, market, service order, and social project escrow. Each custody table has a complete create, use/fill, cancel, expiry, recovery, and owner-death or organization-dissolution lifecycle before that scope can be enabled.

Phase 2 does not introduce unrestricted Crew-owned inventory. Crew and Family production uses project custody, contribution records, and an explicit final recipient or installed facility asset. Family-owned facilities and shared knowledge are separate authorities and do not imply a generic Family item wallet.

An item or lot in escrow remains included in conservation and ownership-cap accounting. It cannot be simultaneously spendable by its depositor. Cancellation or failure returns exactly the escrowed identity/lot remainder to the recorded recovery owner.

### Social independence authority

Distinct durable accounts remain the minimum identity rule. A content requirement tagged `real_independent_participants`—mandatory for high-value or scarce social production and for every Crew/Family critical-path minimum—also requires distinct server-derived **social-independence subjects**. The server maps each account to the current generation of an opaque independence subject using an access-controlled anti-abuse authority informed by reviewed common-control evidence such as the same verified wallet or credential and high-confidence durable account-control linkage. Several characters on one account and several accounts in one high-confidence common-control subject count once. Network origin, device similarity, location, or household membership alone is never decisive, because unrelated household players must remain eligible.

Authored packages cannot read anti-abuse signals, choose subject IDs, lower the policy, or branch narrative content on suspected linkage. Player projections reveal only the participant's safe eligible/ineligible blocker and appeal/review state; subject IDs, cluster membership, evidence, confidence, and other accounts are sealed. The authority is generationed, minimally retained, access-audited, and has an operator-review and account-appeal/correction path.

The authority maintains append-only account-to-subject generation mappings and current subject-generation rows; the sensitive common-control evidence lives separately under stricter retention/access policy. Every qualifying join, contribution, replacement, completion, and claim locks and rechecks distinct accounts, distinct effective independence subjects, current authority, and meaningful participation under the global order. Merge/split/correction writers lock every affected account-to-subject mapping by account ID/generation first, then every affected subject-generation row by subject ID/generation, exactly matching readers/completions, so a completion cannot race an independence change. A subject merge while work is active cannot confiscate conserved contributions or leak the linked accounts: it blocks completion/claim until a valid independent replacement or compiled recovery path restores the minimum. A reviewed correction may split a subject prospectively through a new generation; it cannot replay an already-settled reward. Tests cover same-account characters, common-wallet and high-confidence linked sockpuppets, unrelated same-origin household accounts, appeal/correction, a mid-run subject merge, privacy/noninterference, and concurrent completion while independence changes.

### Lots and stackability

Authoritative lots are never physically coalesced by mutating an existing lot's original quantity or deleting another lot identity. Compatible lots are aggregated only in read projections and deterministic consumption selection. A future physical consolidation would itself have to consume its input lots and create one derived lot with lineage as a replay-safe economic mutation.

Two quantities can appear in one aggregate projection only when all merge-key fields match, including:

- exact item-definition hash;
- quality band and any quality-relevant numeric state;
- trade policy;
- binding or transfer restriction;
- expiration or season identity when economically relevant;
- provenance class when the content declares provenance materially relevant;
- current custody scope and owner.

Quantity is a nonnegative safe integer within database and application limits. Splitting a lot preserves definition hash, quality, restrictions, and provenance linkage. Splitting and recombining cannot create quantity, improve quality, reset age, remove restrictions, or erase ownership history.

### Unique items

A unique item has one permanent server ID and one state row. It is not deleted when consumed. Its state transition is conditional on the expected current owner, custody, and state.

Unique output identity is derived from the domain mutation ID plus an output ordinal. A retry therefore refers to the same output rather than constructing another item.

The item row carries only compact current state. Creation, modification, repair, transfer, project use, mystery use, major operation association, and eligibility changes append provenance events. Full history is not appended to a JSON array on the hot row.

### NFT readiness

Phase 2 may add a compiler-validated export-eligibility policy and an off-chain eligibility state for selected unique definitions. The only enabled runtime state throughout Phases 2 and 3 is off-chain authority.

No package, route, admin action, job, market, or mystery can transition an item to exported state. No contract is deployed. No token ID is assigned. No eligibility flag removes the item from ordinary single-owner checks. Future export requires a separately approved state machine that locks or transfers the same canonical item rather than copying it.

## Transaction, replay, and lock-order contract

### One domain action, one transaction

Every value-bearing action—including salvage, craft start, craft collect, repair, modification, source claim, market list/fill/cancel, service start/complete/cancel, project contribution/completion, and value-bearing mystery use—has:

- one server-derived mutation kind;
- one globally unique logical mutation key;
- one digest binding the complete normalized request and server-resolved authority;
- one database transaction;
- one stored deterministic result;
- one set of item, cash, domain, and provenance writes;
- deterministic output and event ordinals.

The caller's textual `Idempotency-Key` is transport input, not the permanent economic ID. Transport identity is scoped by authenticated account and server-owned endpoint/action kind. On first use the server creates an immutable `mutation_id` and binds it to the issued action, resolved owner/aggregate, normalized request digest, and exact definition hashes. The same account/action/key plus identical digest resolves the same `mutation_id`; a changed digest conflicts. The same textual key used by another account or another action kind cannot preempt or replay this mutation.

The domain guard is reserved and completed inside the same transaction as the economic writes. A repeated scoped transport identity and identical digest returns the stored result. The same scoped identity with a different digest fails. A competing transaction observing an unresolved reservation fails or waits according to the domain's documented contention policy; it cannot execute a second mutation.

HTTP idempotency may cache the final HTTP response after commit, but it is a transport optimization. If the server commits and crashes before storing the HTTP cache, retrying the domain key still returns or reconstructs the committed domain result.

The mutation identity, digest, completion status, and stable result reference are permanent for at least the lifetime of every derived item, cash entry, entitlement, or provenance edge. Large serialized responses may move to immutable archival storage, but the guard tombstone and globally unique mutation/output identities are not pruned. Replay after archival retrieves or reconstructs the original semantic result. Backup, restore, and invariants include these tombstones and result references.

### Canonical lock order

Every Phase 2/3 value mutation follows this global lock order. A sub-phase may omit unused classes but cannot reorder them.

The approved [Lot Integration Amendment](2026-09-07-world-graph-phase-2a-lot-integration-amendment.md) adds one optional precedence between immutable resolution at step 1 and the first character lock at step 2: lock the complete server-resolved set of exact Crew-authority rows in sorted Crew-ID order. Recheck the relevant invitation/membership after account locks; drift or late Crew/participant discovery aborts and restarts the whole logical transaction rather than acquiring an out-of-order row. This prefix is specific to Crew authority and leaves the numbered suffix, social mapping/subject order, organization/aggregate/item order and step references unchanged. Complete lock traces include the prefix. Task 5 converges invite acceptance through exact target-Crew hooks while preserving the production opener's `FOR NO KEY UPDATE` behavior and accrual's no-late-Crew-write rule; no new invitation or gameplay authority follows.

1. Resolve package hashes, definition hashes, public IDs, and immutable configuration without locks. Client-supplied IDs are resolved to server-owned authority at this stage, but all mutable prerequisites are rechecked under lock.
2. Lock affected character rows in canonical character-ID order.
3. Lock affected account rows in canonical account-ID order.
4. Lock affected social-independence account-mapping rows by account ID then mapping generation, followed by subject-generation rows by subject ID then generation, when the mutation relies on independent participation.
5. Lock affected organization and organizational-authority rows in canonical organization-ID order.
6. Reserve and lock the domain mutation guard.
7. Lock the primary domain aggregate—job, facility slot, project, service order, market offer, mystery instance, or operation—in canonical type then ID order.
8. Lock canonical item lots and unique item instances in canonical item-kind then ID order.
9. Lock shared budgets, counters, scarcity caps, or singleton world rows in canonical key order.
10. Revalidate mutable prerequisites, write domain state, item state, cash ledger entries, contribution records, provenance events, and the completed replay result, then commit.

Within any lock class, IDs are sorted before the first lock. Code must not discover and lock additional lower-order rows after acquiring a higher-order class. If late discovery is unavoidable, the transaction aborts and restarts from resolved authority rather than taking locks out of order.

Shared transaction helpers record a test-only lock-class trace. Real-PostgreSQL concurrency tests require the complete trace to be monotonically nondecreasing across every lock class, require canonical subrow type/key/ID/generation order within each class—including social mapping rows before subject-generation rows—and reject discovery of a lower-sorted member after that class's first lock. The same assertions cover request handlers; independence merge/split/correction races against start/convergence/claim; and background expiry, recovery, maintenance, scheduled-economy, archival, and consequence workers, while exercising the documented contention retry behavior.

Read-only projections never hold a database lock while calling external services. Value transactions perform no network I/O.

### Conservation record

Each successful mutation records normalized inputs and outputs. For lots, the mutation evidence identifies source lot, amount before, amount removed, amount after, destination or consuming sink, and derived output lot ordinals. For unique items, it identifies expected prior state, next state, prior owner, next owner, and event ordinal.

The conservation equation for every material definition and hash is:

```text
closing quantity = opening quantity
                 + authorized source creation
                 + transfers in
                 - declared consumption
                 - transfers out
```

Transfers and escrow movements net to zero globally. Recipe conversion consumes declared input definitions and creates declared output definitions in the same mutation. The economy report separately evaluates whether cycles increase modeled scarcity, quality, power, or reference value even when raw unit counts differ.

### pg-mem and PostgreSQL

The existing branded transaction boundary and pg-mem compensation/serialization path remain valid test infrastructure. New mutations must register all non-item compensation required by pg-mem when pg-mem cannot emulate rollback.

Real PostgreSQL tests are mandatory for row locking, isolation, unique constraints, check constraints, deadlock behavior, transaction rollback, concurrent fills, and schema migration. A pg-mem pass cannot substitute for a PostgreSQL concurrency pass.

## Projection, privacy, and secret-state contract

Server state is partitioned into:

- canonical hidden graph truth;
- participant-private evidence and actions;
- explicitly shared group evidence;
- public discovery metadata;
- value-bearing inventory and contribution state;
- derived client presentation.

Every response is built from the caller's durable account, current character, current organization authority, assigned role, explicit shares, and the exact pinned bundle. Projection code starts from an empty safe object and copies allowlisted fields. It does not clone a server node and delete known secret fields.

The instance keeps an internal monotonic `canonical_mutation_revision` for transaction serialization and audit. That value is never exposed to players. Each viewer or audience instead receives an opaque signed projection cursor bound internally to endpoint/projection kind, resource kind and exact resource/instance/list ID, `bundleHash`, projection-policy version, account ID, current character ID/generation, organization kind and ID plus the exact membership/office authority row and generation/revision, role-assignment ID/generation, an evidence/fact/share-grant-set digest, normalized query/filter/sort/page/region/locale inputs, and the last viewer-visible change. These values are authenticated cursor inputs, not necessarily projected fields. A cursor advances only when that caller's authorized projection for that exact resource and query changes.

Issued actions are bound to an opaque server-owned precondition vector containing only the exact state dependencies relevant to that action. An unrelated actor-private mutation does not stale another viewer's action, advance that viewer's cursor, change an empty delta, or alter cache metadata. When private activity legitimately changes shared state, only the declared shared consequence becomes viewer-visible.

The same projection function or policy layer must cover:

- normal instance reads;
- discovery lists;
- post-action responses;
- stale-revision replacement projections;
- idempotent replay responses;
- validation and authorization errors that include replacement state;
- live/poll updates;
- archived and completed instances;
- admin/operator previews at their separately authenticated scope.

Role-private evidence is private by default. Unless a package explicitly declares a safe placeholder, an unauthorized caller cannot infer its text, answer, internal ID, branch position, number of hidden nodes, completion time, holder account, or canonical relationship.

Every evidence, signal, candidate, board entity, and output field has an information classification represented as a typed audience predicate over an authenticated principal and exact scope/generation context—not as a scalar label. Account A, account B, Crew A, Crew B, a role assignment, a Family office generation, and sealed runtime are therefore distinct or incomparable audiences. Public is the universal player audience; sealed runtime authorizes no player principal. Ordinary derivation intersects the complete source audience predicates while preserving subject/scope IDs and generations. An empty intersection stays sealed/unprojectable. Any union, scope substitution, subject removal, office-following expansion, or other widening requires an explicit schema-bounded declassification transform from a closed registry, such as an approved enum mapping, boolean receipt, count bucket, safe alias, or separately authored and reviewed summary. Raw secret IDs, equality-oracle hashes, sealed provenance digests, candidate ordering derived from secrets, and arbitrary copied text cannot be declassified. The private privacy report lists every source predicate, intersection, declassification, transform, output predicate, and review approval.

An explicit evidence-sharing action is server-authorized, revision-checked, and audience-bounded. Sharing creates a ledgered disclosure record; it does not mutate canonical truth or duplicate a physical unique item.

Private-state noninterference tests compare all response shapes available to different roles before and after reads, actions, stale requests, replays, failures, replacement, and completion.

Caches, search indexes, pagination cursors, deltas, and loading metadata use the complete cursor binding above plus response/media type and normalized request identity. Search operates over an authorized ID set or audience-qualified index; it never searches sealed rows and filters only after totals, timing, or ordering are computed. Cache keys cannot collide across endpoints, resources/instances/lists, organizations, role assignments, queries, filters, sorting, pages/regions, or locales even when authority generations are numerically equal. Membership, office, role-generation, grant, resource, or normalized-query changes invalidate incompatible cursors and cache entries without revealing the hidden cause.

## Versioning, migration, and compatibility

### Definition version rules

Logical identity, integer version, definition hash, `bundleHash`, and `dependencyLockHash` serve different purposes:

- logical ID identifies the enduring concept;
- version identifies an authored compatibility generation;
- definition hash identifies exact immutable behavior;
- `bundleHash` identifies the exact compiled executable bundle under the explicit domain formula above;
- `dependencyLockHash` identifies the exact resolved dependency closure and never contains the resulting `bundleHash`.

Database state that can outlive a request stores the exact hashes needed to interpret it. Looking up only the currently active logical ID is forbidden for historical state.

### Schema migration rules

Every schema task must provide:

- additive or staged DDL compatible with current PostgreSQL conventions;
- explicit pg-mem coverage or a documented emulation helper;
- deterministic backfill logic;
- pre-cutover and post-cutover invariants;
- rollback or forward-recovery procedure;
- backup and restore inclusion;
- clean-start schema verification;
- migration from the exact Phase 1 schema and data fixtures;
- rerun/idempotency behavior;
- production-sized query-plan or index review for new hot paths.

Constraints are installed only after backfill validation when existing data could violate them. A migration must not assign a vague `legacy`, `unknown`, or current-active hash to old value-bearing state; it uses a source-controlled immutable compatibility definition.

No migration deletes historical item or provenance state merely to simplify a new schema. Destructive cleanup requires separate explicit approval.

### API compatibility

Existing Phase 1 routes and authored-content APIs remain stable during staged convergence unless a sub-phase specification explicitly versions them. Compatibility responses may be derived from the canonical IR or lot ledger, but they cannot maintain a second mutable authority.

New write endpoints must use stable string error codes and the repository's existing authentication, authorization, rate-limit, optimistic-concurrency, and `Idempotency-Key` conventions. Economic/domain actions use exact condition revisions or commitments appropriate to the aggregate. Mystery actions use an opaque audience cursor plus server-issued dependency/precondition vectors; the internal canonical mutation revision is never projected or treated as a viewer-visible global freshness token. Clients never nominate quantities, outputs, durability gains, quality results, owner identities, role qualification, private evidence, or reward eligibility unless the operation is explicitly a player-authored market/service offer and the selected values are constrained by the active compiled definition.

### Dynamic and cross-season facts

Authored content accesses world state only through the registered dynamic-signal catalog. Each signal declares type, visibility, snapshot policy, volatility, recovery requirements, and query implementation in server code.

The default is snapshot-at-instance-start. Live signals are allowed only when a package supplies a validator-proven recovery route so normal world change cannot create a permanent soft lock.

Cross-season state uses a logical case key plus server-derived season identity, independent of package version. Packages export only declared durable facts. Imports pin the exact fact schema and producer `bundleHash`. Critical-path prior evidence always has an in-game recovery mechanism; external screenshots, chat history, or community archives can support optional archaeology but cannot be required authority.

## Delivery decomposition and dependency order

The work remains decomposed into independently reviewable specifications and plans:

1. Task 0: Windows CRLF baseline portability.
2. Phase 2A: compiler/corpus foundation, definition versions/lots, material taxonomy, and salvage.
3. Phase 2B: professions, recipe knowledge, and blueprints.
4. Phase 2C: facilities, deep jobs/crafting, quality, durability, and repair.
5. Phase 2D: abstract ammunition, fictional contraband, equipment, and consumption loops.
6. Phase 2E: item markets, service orders, social production, provenance, and NFT-eligibility state.
7. Phase 2 whole-economy and exploit gate.
8. Phase 3A: mystery runtime, evidence, boards, privacy, indexes, and deltas.
9. Phase 3B: Crew role, sharing, contribution, concurrency, and replacement primitives.
10. Phase 3C: Family aggregation and hierarchical information flow.
11. Phase 3D: dynamic signals, package imports/exports, recovery, and cross-season state.
12. Phase 3E: authoring pipeline, initial corpus, evidence/production UI, and scale fixtures.
13. Final whole-branch review and verification gate.

Runtime and schema foundations are sequential dependencies. Independent packages may be authored in parallel only after the package schema, compiler, runtime vocabulary, and fixture contract they use are stable and committed.

## Task-level TDD and review protocol

Every implementation task, including migrations, content packages, simulations, UI work, and test infrastructure, follows this sequence:

1. **Approved task contract:** identify the applicable design section, planned files, invariants, and exact acceptance tests.
2. **Fresh implementer:** assign a specialized subagent for the bounded task. That implementer cannot serve as either independent reviewer for the task.
3. **Red test:** add the smallest focused test that fails for the intended reason. For schema or concurrency work, include the corresponding PostgreSQL test before claiming completion.
4. **Minimal green implementation:** implement only the approved task, preserving unrelated work and existing APIs.
5. **Focused verification:** run the new test, adjacent subsystem tests, formatting/linting/static validation used by the repository, and relevant pg-mem checks.
6. **Fresh spec-compliance review:** a different subagent compares the diff and evidence against the approved specification and task plan. It reports omissions, scope creep, or contradictory behavior before general style review. Reviewers receive only the least-privilege source needed: blind solvers do not receive overlays or canonical solutions, while trusted solution/privacy reviewers work in the access-controlled overlay environment and never paste secrets into public findings.
7. **Correction and retest:** the implementer addresses every compliance finding or documents why the reviewer withdrew it.
8. **Fresh code-quality/security review:** another independent review covers transaction safety, concurrency, error behavior, PostgreSQL compatibility, privacy, performance, maintainability, and exploitability.
9. **Correction and retest:** all Critical and Important findings are resolved. Minor findings are fixed when low-risk or recorded with rationale.
10. **Task commit:** commit only the reviewed task and its tests on the isolated branch. Do not bundle unrelated working-tree changes.

The integration agent owns the authoritative branch head. At most three subagents run concurrently in addition to the integration agent's coordination slot. Agents working in parallel receive disjoint file/package ownership. A shared schema or runtime file has only one active writer.

After two review/fix cycles reveal the same architectural problem, implementation pauses and the relevant specification is reconsidered rather than accumulating local exceptions.

No task is called complete based only on a subagent report. The integration agent inspects the diff and independently runs the required evidence.

## Static validation and designer reports

### Required blocking validators

The canonical validator must reject:

- duplicate, malformed, or shadowed package and node IDs;
- undeclared or unresolved package imports;
- lockfile drift or hash mismatch;
- dependency cycles outside an explicitly bounded valid production loop;
- mystery prerequisite cycles;
- missing condition/effect adapters or wrong adapter profiles;
- impossible dependencies or unreachable required terminals;
- inaccessible evidence and evidence required before any valid acquisition path;
- private evidence flowing to an undeclared audience;
- missing material/item sources;
- orphan economic definitions with no meaningful use;
- sinkless renewable materials unless explicitly bounded/collectible and reviewed;
- free positive cycles in quantity, scarcity, quality, power, or reference value;
- dead unique-item dependencies;
- a destructive unique-item path without replacement, refund, or alternate branch;
- impossible facility or location requirements;
- impossible social role assignments or insufficient distinct-account composition;
- passenger rewards without a declared meaningful-contribution rule;
- unrecoverable participant loss or organizational churn;
- one-choice branch patterns that can eliminate every critical path;
- season migration or cross-season fact incompatibility;
- duplicate reward authority or replayable reward claims;
- any Phase 2/3 OMR reference or capability;
- executable or unbounded content;
- packages exceeding an exact-analysis budget without a sound conservative fallback.

Terminal classes are explicit: successful completion, successful recovery, incomplete but restartable, narrative failure without a critical export, and voluntary abandonment. Validation reports both existential `mayReach` and universal `mustPreserveCriticalSuccess` results.

`mustPreserveCriticalSuccess` is evaluated over the correlated product state, not by checking each choice, role, generation, signal, or timer dimension independently. Let `Rnv` be every joint state reachable from a valid entry by any sequence of permitted player actions plus all declared **non-voluntary** irreversible/environment transitions, with actual compatibility constraints preserved. For every `s` in `Rnv`, the validator must produce a bounded witness from `s` to either (a) a declared successful terminal satisfying every required critical export, or (b) a valid recovery contract that preserves authority to reach such a terminal. Equivalently, the checked property is `AG_Rnv(EF(critical_success OR valid_recovery_contract))`. The validator rejects a correlated dead state even when each isolated dimension has some recovery elsewhere.

A valid restart contract is server-derived, bounded, and explicit. It can open a new run only when the old terminal grants that authority and has not consumed the critical season/run key; it carries forward or safely reconstructs required conserved state and resolves every escrow or unique item. A narrative failure is included in the universal property when it can occur automatically or through a non-voluntary transition and therefore must lead to recovery. A voluntary abandon edge is excluded from the universal safety premise, but abandonment must atomically resolve escrow/custody and retain only the restart authority declared by the run policy. An incomplete terminal cannot satisfy a required Family or season import or consume a once-per-season run key unless it produces this valid restart/recovery authority.

Validator fixtures include at least one correlated `choice A + signal outcome Y` dead state that passes naive per-axis checks but must be rejected, automatic narrative-failure recovery, voluntary abandonment with complete custody settlement, restart before/after season-key consumption, and a positive joint-state witness.

### Reachability reports

Reachability reports identify:

- all valid entry points and terminals;
- minimum root-to-terminal depth;
- unreachable optional and required nodes;
- strongly connected components and their declared production-loop rationale;
- branch coverage and convergence;
- recovery paths for irreversible choices and consumed unique items;
- cross-package witnesses with exact hashes;
- minimum required facilities, professions, roles, accounts, and time gates.

Witnesses must be bounded and reconstructable from predecessor indexes. The report must not include server-secret puzzle answers in public CI artifacts.

### Economy reports

For each economic definition hash, reports identify:

- authorized sources and source caps/cadence;
- processing and recipe uses;
- maintenance, consumption, expiration, loss, or project sinks;
- trade and binding rules;
- owner/custody scopes;
- quality transformations;
- source-free and sink-free components;
- conversion cycles and their cash/time/facility/tool costs;
- modeled scarcity/value/power deltas;
- potential accumulation under reference populations;
- every cash-moving adapter;
- a zero-OMR attestation backed by IR and capability scans.

## UI accessibility conformance contract

Every player or operator UI changed by Phases 2/3 must **conform to WCAG 2.2 Level AA**, not merely target it. Each sub-phase that changes UI maintains a criterion-by-criterion conformance matrix covering every Level A and AA success criterion. Every row records `applicable-pass` or `not-applicable`, a rationale, evidence owner, exact automated/manual artifact, browser/device/assistive-technology version where relevant, failure link, and retest result. `not-applicable` requires an independent accessibility reviewer; axe, keyboard journeys, and snapshots are evidence inputs, not a substitute for the matrix or manual judgment.

The matrix explicitly covers orientation (1.3.4); content on hover or focus including dismissible/hoverable/persistent behavior (1.4.13); resize text to 200% (1.4.4); reflow at 320 CSS pixels/400% where applicable (1.4.10); text spacing with line height at least 1.5 times font size, paragraph spacing at least 2 times font size, letter spacing at least 0.12em, and word spacing at least 0.16em without loss (1.4.12); keyboard and no-keyboard-trap behavior; focus order/visible focus; focus not obscured at minimum (2.4.11); status messages; pointer alternatives; and target size of at least 24 by 24 CSS pixels or a documented 2.5.8 spacing/equivalent/inline/user-agent/essential exception. Non-essential time limits can be turned off, adjusted, or extended as required by 2.2.1. A real-time coordination window may claim the essential exception only when the reviewed game mechanic fundamentally depends on that timing and the content supplies a bounded retry/recovery path; the UI still announces the deadline accessibly and never relies on animation alone.

Equivalent graph/list or pointer/keyboard paths expose the same authorized information and actions. Accessibility fixtures use synthetic public data so evidence artifacts cannot leak private content.

## Verification matrix

The following is the minimum branch evidence. Sub-phase plans must map concrete test files and commands to every applicable row.

| Area | Required verification | Blocking evidence |
|---|---|---|
| Baseline | Fresh Windows checkout, dependency install, Phase 1 focused tests, and full suite | Task 0 fixed; no unexplained pre-existing failure hidden by the branch |
| Package discovery | Automatic discovery, deterministic ordering, missing/extra/duplicate manifests, fixture exclusion | One corpus command finds every production package and fails on an unvalidated package |
| Compiler parity | Check/build/activation call the same complete validator | Adversarial pack rejected identically by all three paths |
| Package safety | Duplicate object members, JavaScript, SQL, prototype keys, expressions, unknown adapters, unsafe markup, runtime import paths/URLs, and oversized input | Malicious fixtures fail identically before ordinary object materialization, bundle storage, or activation |
| Package/profile kinds | Experience/library/fixture discrimination and closed production profile registry | Libraries expose no entry point; authored fixtures cannot promote themselves; Phase 2D remains a subset of `phase2_economy` |
| Package test coverage | Compiler-generated obligations for entries, terminal classes, branches/recovery, roles/generations/audiences, theories, dynamics, imports/exports, critical items, contributions, adapters, and beneficiaries | Activation rejects any uncovered obligation; mutation coverage proves transition, replay, and conservation/recovery rather than compile-only success |
| Secret custody | Public-source secret scan, public/private package pairing, access-controlled overlay-digest verification, public non-oracular attestation, least-privilege review, log/cache/artifact scan | No production answer, private evidence, secret edge/ID, verifier input, private digest/lock, or equality oracle appears in this repository or public CI artifacts |
| Locking/versioning | Exact dependency locks, definition pins, lock drift, old-version continuation, rollback activation | Hash-pinned runs produce their original outputs after a new activation |
| Mutation identity/replay | Account/action-scoped transport keys, immutable server `mutation_id`, normalized digest binding, archival replay, crash-window recovery | Same key on another account/action is independent; changed digest conflicts; retries before/after archival reproduce one semantic result |
| Graph algorithms | Missing nodes, prerequisite cycles, legal production SCCs, branches, convergence, recovery, package cycles | Corpus reports clean; synthetic 10,000-node graphs complete within scale gate |
| Item migration | Phase 1 stack/instance backfill, totals, definition hashes, rerun, read compatibility | Pre/post per-owner and global conservation equality on pg-mem and PostgreSQL |
| Inventory | Lot grant/consume/split/merge, quality isolation, binding, caps, negative/overflow refusal | Conservation and property-based tests with event/guard parity |
| Salvage | Condition-based yields, ownership/state gates, exact vehicle consumption, replay and races | One vehicle can produce outputs once under 50 concurrent attempts |
| Recipes/jobs | Inputs, catalysts, tools, cash, timers, collection, output ordinals, old-hash collection | Duplicate start/collect and crash-window tests create one result |
| Professions/knowledge | Prerequisites, progression events, anti-farm behavior, account/character/Family scopes | Client cannot claim skill or knowledge; repeated trivial loop cannot bypass progression |
| Blueprints | Physical custody, fragments, learning, consumption/preservation, trade restrictions, seasonal identity | Knowledge and object custody remain separate and replay-safe |
| Facilities | Access, location, capability, capacity, maintenance, failure/cancel, dissolution | Concurrent slot claims honor capacity; recovery conserves inputs |
| Quality | Deterministic basis, bounded variance, masterwork gates, no quality-upgrade cycle | Low-skill luck cannot produce masterwork; cycle analysis finds injected exploit |
| Durability/repair | Wear, use, repair inputs, cap, concurrent repair/use, provenance | Repair cannot exceed max, reset identity, or duplicate replacement materials |
| Ammunition | Abstract component batches, compatibility, consumption, trade, replay | Batch and combat sinks conserve; fixtures contain no actionable real-world procedure |
| Contraband | Fictional stages, risk/loss, packaging, storage, transport, sales, pressure, shocks | No free positive loop or uncontrolled cash source; failure paths conserve correctly |
| Item market | List/fill/cancel/expiry, full and permitted partial fills, cash/item escrow, taxes | 50-way fill/cancel race settles once and returns exact remainder |
| Services | Commission/repair/modification state machine, provider qualification, item/material/cash escrow | Provider cannot replace nominated item or self-award outputs; cancellation recovers value |
| Social production | Distinct accounts/independence subjects, typed roles, staged contributions, escrow, completion provenance | Same-account characters and high-confidence linked sockpuppets cannot satisfy required independence; same-origin alone does not exclude unrelated players; passengers fail claim eligibility |
| Unique ownership | Transfer, escrow, consume, death, recovery, historical visibility | Invariant scan finds no two spendable owners or state/custody mismatch |
| Provenance | Creation, sources, crafter, transfer, modification, repair, operation, mystery, season | Event chain and compact summary agree; hot row does not grow unbounded |
| NFT readiness | Eligibility policy, unique-only restriction, off-chain authority | No enabled exported transition, route, token ID, contract, or duplicate representation |
| Evidence privacy | Role audiences, hidden counts/IDs, explicit shares, completed/archived state | Noninterference tests cover read, action, stale, replay, error, poll, and completion responses |
| Projection cursors | Hidden-only actions, audience changes, caches, search, pagination, and stale dependencies | Unauthorized snapshot bytes, cursor, actions, empty delta, error shape, cache keys, and totals remain unchanged after hidden-only mutations |
| Mystery reasoning | Evidence acquisition, proposed links, structured theory, false theory, irreversible branch and recovery | Brute-force single field cannot finish; every critical terminal has a valid path |
| Crew social cases | Role-specific views, ordered/concurrent branches, replacement, contribution | Distinct accounts and current authority rechecked inside mutation transaction |
| Family hierarchy | Child-case receipts, exported findings, leader actions, aggregation without raw clue leakage | Boss receives only declared aggregate findings; stale membership cannot act |
| Dynamic state | Snapshot signals, approved live signals, ownership/death/world changes, recovery | Volatile state cannot permanently strand a critical path |
| Cross-season | Logical case key, season identity, exact fact schema, migration, recovery | Version bump cannot duplicate entitlement or erase required historical evidence |
| Contribution | Evidence, deduction, crafted goods, roles, risk, delivery, support actions | Raw action count/time and inactive membership do not qualify by themselves |
| Difficulty | Depth, systems, professions, accounts, items, branches, time, irreversible choices | Reports generated for every production case; suspiciously shallow content reviewed |
| Routes/API | Authentication, authorization, stable errors, aggregate concurrency tokens or audience action-preconditions as applicable, idempotency, response redaction | Direct requests cannot nominate server-derived values or bypass content activation; hidden changes do not invalidate unrelated viewer actions |
| UI | Evidence board, accessible fallback, production/market/service/project views, privacy labels, pagination/deltas, complete WCAG 2.2 A/AA matrix | Every applicable criterion passes with owned evidence; every N/A/exception has reviewed rationale; browser/mobile, keyboard, screen-reader, zoom/reflow, orientation, text-spacing, focus, timing, hover/focus-content, target-size, and privacy tests pass |
| pg-mem | Focused and full pg-mem suites, compensation behavior, clean start | All relevant tests green without silently skipping unsupported behavior |
| PostgreSQL | Schema, migration, constraints, rollback, isolation, locks, deadlocks, race tests | Real supported PostgreSQL version passes from Phase 1 and clean databases |
| Backup/restore | New definitions, lots, instances, escrows, guards, events, jobs, facilities, projects, mysteries | Restored invariant scan and fixture digests match source database |
| Economy simulation | Material flows, sinks, pricing assumptions, facilities, professions, population levels, shocks | No unbounded positive cycle, permanent unsunk renewable accumulation, cash leak, or OMR movement |
| Population scale | 100, 1,000, and 10,000 logical actors with deterministic workloads | Runtime, storage, contention, and market/project completion remain within recorded budgets |
| Full regression | All repository tests, content checks, knowledge tests, and changed browser/mobile surfaces | Clean full-suite run from the final commit |

## Economy and population simulation contract

Simulations use deterministic named seeds and source-controlled scenarios. Each report records code commit, corpus hash, definition lock hash, seed, population, time horizon, initial inventory, action policy, and all modeled external sources/sinks.

Before catalog tuning begins, the implementation plan commits quantitative pass budgets for renewable stock growth per active account, source/sink coverage, gross cash emission per authorized source adapter, top profession and top source share of demand, Masterwork rate and maker concentration, facility utilization and queue percentiles, market concentration/spread/manipulation tolerance, project completion by population, supply-shock recovery time, blocked critical-chain rate, and transaction contention/retry rate. Both pre-tuning and final deterministic reports are retained, with sensitivity runs around material assumptions. Threshold changes after observing results require a reviewed plan/spec amendment rather than silent target movement.

The minimum scenario set includes:

- low-, medium-, and high-activity populations;
- novice-heavy, mixed, and specialist-heavy profession distributions;
- 100, 1,000, and 10,000 logical actors;
- 30-day and 180-day horizons;
- normal, salvage-abundant, rare-source-constrained, law-pressure, and supply-shock conditions;
- low and high player-trade participation;
- Crew- and Family-project demand;
- repair/maintenance participation below, at, and above expected levels.

A simulation is blocking when it shows any of the following without an explicit bounded collectible classification:

- a source-free conversion cycle that increases quantity, modeled scarcity, quality, power, or reference value;
- a renewable material whose stock per active account rises throughout every reference horizon while its declared sinks remain capacity-insufficient;
- a recipe/facility loop whose outputs finance and replenish all inputs while producing uncapped surplus value;
- masterwork production dominated by random rolls rather than deterministic gates;
- one profession or chain dominating all reference demand and making specialization economically irrelevant;
- persistent input starvation that makes a required critical chain unreachable under the reference population;
- unledgered cash, cash created by replay, or an unclassified cash source;
- any nonzero OMR balance or OMR ledger delta attributable to Phase 2/3 actions.

Simulation tuning can change authored quantities and costs only through reviewed package changes. Tests must prove the simulation cannot mutate production state.

## Graph scale and performance gate

The compiler and validator must process both a 10,000-node linear/deep graph and a 10,000-node branching/component graph in a separate Node process without recursion overflow, witness explosion, or nondeterministic output.

On the standard CI worker, each fixture must:

- complete in at most 30 seconds;
- pass with `--max-old-space-size=768`;
- emit bounded witness/report output rather than materializing all paths;
- produce the same content/report hashes on two consecutive runs.

Runtime projections use precompiled indexes and return a bounded frontier or revision delta. Large active histories are paginated. A caller cannot force a full graph scan or unbounded response by choosing query parameters.

Performance evidence records actual elapsed time, peak memory when available, node/edge count, component count, and output size. These are regression budgets, not claims about puzzle quality.

## Red-team matrix

Every row is exercised by an automated adversarial test where practical and reviewed manually in the final pass.

| Attack | Required defense and expected result |
|---|---|
| Reuse a salvage request or race the same vehicle | Domain guard and conditional vehicle consumption permit one output set; every other attempt replays or fails without residue |
| Start or collect the same recipe repeatedly | Exact run state and deterministic output ordinals create one run and one output set |
| Split/merge lots to reset hash, quality, restriction, age, or provenance | Merge key and derived split metadata preserve every economically relevant attribute |
| Race consume, trade, repair, and use on one item | Canonical locks and expected-state updates permit one transition |
| Fill and cancel an offer concurrently | Offer aggregate and escrow settle once; cash and exact item remainder have one destination |
| Replay a service or project completion | Completion guard and output ordinals return the same result without another reward or item |
| Replay a mystery completion or self-claim through a new HTTP key | Instance/effect uniqueness and the domain claim guard return the original entitlement result without another effect, item, status, or currency movement |
| Deposit the same item into two escrows | Canonical item custody state plus unique escrow reference rejects the second deposit |
| Own a unique item off-chain and through NFT/export state | No export transition exists; invariant scan requires one off-chain authority state |
| Nominate another player's item, car, role, output, owner, quality, or durability | Server resolves authority from authenticated account, current character, active bundle, and locked rows |
| Satisfy social roles with alts, several characters on one account, linked sockpuppet accounts, or repeated joins | Distinct durable accounts, distinct server-derived social-independence subjects where required, and current meaningful-participation checks reject the composition without treating network origin alone as proof of common control |
| Join as passenger and claim project/case value | Typed contribution eligibility blocks a claim unsupported by meaningful contribution |
| Act after leaving a Crew/Family or losing leader rank | Current organization authority is rechecked under lock |
| Strand content by killing/leaving/replacing a required participant | Declared timeout/replacement/recovery path preserves prior attribution and permits continuation |
| Infer private evidence through node count, IDs, timing, stale responses, errors, replay, or completion | Safe-from-empty projections and noninterference tests expose only declared audience data |
| Brute-force a single mystery answer | Structured theories, attempt policy, evidence gates, and server-owned canonical truth prevent one-field completion |
| Consume a unique clue on the wrong irreversible branch | Compiler requires alternate path, replacement, or recovery before activation |
| Activate a package whose CLI check was weaker | Shared validator entry point rejects identically at check, build, and activation |
| Smuggle code, SQL, a runtime path/URL import, prototype key, or unknown adapter into a package | Parser/schema/compiler reject before bundle storage |
| Read production answers or hidden graph structure from the public repository, CI, source maps, caches, or build artifacts | Production secrets exist only in the access-controlled overlay and sealed server store; public source contains safe data and opaque non-oracular attestation IDs/status only |
| Turn private evidence into a Boss-visible alias, count, digest, candidate order, error, or copied field | Classification propagation blocks the output unless a closed, reviewed declassification transform explicitly permits it |
| Change a dependency after compiling | Exact lock/hash verification rejects drift; in-flight runs retain stored dependency bundles |
| Merge old and new definition quantities | Exact definition hash in lot merge key prevents cross-version merging |
| Use a positive quality/value cycle with nominal unit conservation | scarcity/quality/power cycle analysis and simulation block activation |
| Create cash through a recipe, failed transaction, or replay | Classified ledger adapter, transaction rollback, and unique ledger reference preserve cash conservation |
| Reference OMR through an alias, nested payload, adapter, reward, cost, or old allocation node | Source, IR, adapter-capability, runtime, ledger, and simulation scans all report zero authority/movement |
| Create a package that passes small tests but exhausts validator memory/stack | iterative algorithms, bounded reports, input limits, component budgets, and 10,000-node fixtures fail closed |

## Task 0: Windows CRLF baseline portability

### Observed defect

On a fresh Windows worktree with Git `core.autocrlf=true`, the Phase 1 baseline reaches `test/worldgraph-api.js` and fails at the source-inspection assertion near line 64. The test's regular expression assumes bare LF delimiters around a route block (`\n}\n`). The checked-out `src/routes/worldgraph.js` contains CRLF delimiters, so the assertion fails even though the route source and behavior are unchanged. The same commit passes that assertion when checked out with LF.

This is a test-portability defect, not evidence of a runtime route failure.

### Required TDD fix

Task 0 changes tests only unless the red test proves a production defect.

1. Add or refactor a focused test that evaluates the route-registration source contract against both LF and CRLF representations and initially fails for CRLF.
2. Make the source inspection line-ending agnostic, using an equivalent portable boundary such as `\r?\n` or a structured exported registration contract if the minimal refactor remains bounded.
3. Prove the test still fails when the protected route registration or mutation-lock wrapper is actually absent. The portability fix must not weaken the assertion into a simple substring check.
4. Run `test/worldgraph-api.js`, adjacent Phase 1 world-graph tests, and the full baseline suite from the Windows worktree.
5. Record the baseline result before starting Phase 2A feature code.

Acceptance requires the exact Phase 1 commit plus the Task 0 test fix to pass under a CRLF checkout and an LF-normalized copy. No repository-wide line-ending rewrite is part of Task 0.

## Phase gates

### Per-task gate

A task is complete only when its red test, focused suite, applicable pg-mem and PostgreSQL evidence, spec-compliance review, code-quality/security review, and integration-agent diff inspection all pass. Critical or Important findings block the task commit.

### Phase 2 gate

Phase 2 is complete only after Phase 2A–2E pass their task gates and a fresh whole-phase review verifies:

- one canonical item/lot authority with successful Phase 1 migration;
- conservation and exactly-once behavior across salvage, crafting, repair, markets, services, and projects;
- coherent source/use/sink coverage and no orphan critical material;
- profession and knowledge separation with meaningful specialization;
- old-hash continuation and compatibility behavior;
- zero OMR authority and movement;
- clean economy and population simulations;
- pg-mem, real PostgreSQL, backup/restore, API, UI, and full regression evidence;
- no unresolved Critical or Important economy, exploit, concurrency, or PostgreSQL finding.

Phase 3 implementation does not use an unreviewed Phase 2 economy surface as a production dependency.

### Phase 3 and final branch gate

Phase 3 is complete only after Phase 3A–3E pass their task gates and the strongest available fresh whole-branch reviewers complete:

- spec-compliance review;
- code-quality and maintainability review;
- security/exploit red-team review;
- item and economy review;
- graph reachability and recovery review;
- mystery solvability and difficulty review;
- privacy and social-abuse review;
- transaction, concurrency, PostgreSQL, migration, and backup review;
- UI accessibility, browser, and mobile regression review.

Every Critical and Important finding must be resolved and retested. The final full repository suite and all matrix evidence run from the final commit, not from an earlier intermediate revision.

## Release and stop gates

Local task commits on `codex/world-graph-phases-2-3` are permitted after their review gates. This project does not authorize any of the following:

- merging or fast-forwarding `main`;
- opening or auto-merging a production release;
- pushing a production tag or release branch;
- deploying any service, worker, database migration, static site, or content bundle;
- activating any Phase 2 or Phase 3 package in production;
- activating seasonal OMR rewards;
- deploying or configuring NFT contracts or export routes.

When the final gate passes, the integration agent must report the architecture created; schemas added; professions; material families; recipes; workshops and facilities; item, trade, service, social-production, provenance, and mystery systems; the number and structure of authored packages; graph-validation and difficulty results; economy and population simulation results; security/red-team findings; test evidence; known deferred work; and the final branch and commits. It then stops. Only a later explicit user instruction can authorize merge, production push, deployment, content activation, OMR work, or NFT deployment.

## Cross-cutting acceptance criteria

This architecture is implemented only when all of the following are true:

- every Phase 2/3 production package is automatically discovered, deterministically compiled, exactly locked, fully validated, server-sealed, and explicitly activated;
- every production-secret package is paired with an exact access-controlled overlay, while the public repository and public CI artifacts contain only safe source, safe public source/manifest hashes, and opaque non-oracular attestation IDs/status;
- check, build, CI, and activation share one complete validation entry point;
- no package can execute code or access a database/network/filesystem capability;
- canonical lots and unique instances pin immutable definition hashes and never have two mutable authorities;
- Phase 1 value-bearing state is migrated without quantity or ownership loss and without steady-state dual writes;
- every value mutation is transactional, domain-replay-safe, provenance-bearing, and compliant with the global lock order;
- old-hash state continues or follows a conservation-proven recovery migration;
- private evidence remains private across every response and failure/replay path;
- dynamic and social dependencies have validator-proven recovery behavior;
- static analysis and simulations show no free positive material, scarcity, quality, power, cash, or OMR path;
- synthetic 10,000-node validation and population-scale simulations pass their budgets;
- every changed player/operator UI conforms to WCAG 2.2 AA with a complete applicable/N/A criterion matrix and independently reviewed evidence;
- pg-mem and real PostgreSQL suites, migration, backup/restore, API, browser/mobile, and full regression suites pass;
- the final review has no unresolved Critical or Important finding;
- the branch stops before merge, production push, deployment, OMR activation, or NFT deployment.

## Resolved design tensions

The following potentially conflicting directions are resolved by this specification:

- **Two Phase 1 content lanes vs. one future authoring plane:** retain compatibility but place every new Phase 2/3 definition in the canonical compiled IR.
- **Current stack aggregation vs. exact-hash lots:** perform a verified one-way migration and prohibit steady-state dual-write authority.
- **Generic compiler knowledge of finite OMR allocations vs. the Phase 3 OMR deferral:** use strict Phase 2/3 activation profiles with zero OMR vocabulary or runtime capability.
- **Organization production vs. unrestricted shared wallets:** use project custody and explicit final recipients; do not introduce general Crew inventory in this wave.
- **Mutable live world puzzles vs. permanent solvability:** snapshot by default and permit live gates only with validated recovery.
- **Content version upgrades vs. in-flight continuity:** pin exact root and dependency hashes; use explicit recovery migrations for unsafe definitions.
- **Large graph validation vs. exact analysis:** use iterative component analysis, bounded witnesses, local constraint solving, and conservative fail-closed budgets.
- **Public source control vs. secret mysteries:** keep safe package source in this repository, keep canonical solutions and hidden structure in an access-controlled overlay, and bind them through exact hashes in the trusted build.

No unresolved architectural conflict remains in this cross-cutting contract. Detailed balance values, exact table/index DDL, endpoint shapes, and package-by-package content remain intentionally delegated to their approved sub-phase specifications and plans.
