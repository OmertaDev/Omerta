# Coordination engine task index

This is a bounded implementation roadmap derived from the [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707) and the repository's actual runtime boundaries. The 50 packages below are reviewable units, not a promise that later phases are implemented. Coordination Phases 00–01 are implemented for scoped review; Phases 02–09 remain planned. The [historical Phase 00 review](../REVIEW.md) and [Phase 01 review](../PHASE_01_REVIEW.md) record their separate source scope, evidence and limitations. Implementation does not imply production activation. Their numbering is independent of world-graph Phase 1 and sealed-content Phase 2.

## How to use this index

The [master specification](../MASTER_SPEC.md) explains the program and its phase boundaries.

Start a task with its phase spec, the relevant shared coordination contract, and the listed source/test files. Read another domain only when the task crosses its stated authority boundary. Do not reload the entire roadmap for each edit or split a coherent invariant across many tiny tickets.

Paths beginning `src/coordination/`, `test/coordination-`, and `tools/coordination-` below are proposed extensions unless present in the checkout. Existing anchors are identified explicitly. Every package must preserve the Phase 00 pinned-definition, historical-owner, idempotency, direct-action, and feature-flag contracts. A dependency means its acceptance criteria are met, not merely that its file exists. A feature gate never substitutes for tests.

The three detailed cards following the index retain the Phase 01 implementation criteria. Their code is now present and actual verification is recorded in the Phase 01 review. Expand later rows into the same format only when their predecessors are ready. Do not implement speculative tables and empty handlers for future phases.

## Phase 00 — Bounded private foundation

Read [Phase 00](../phases/PHASE_00_FOUNDATION.md).

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-00-01 | Canonical graph profile and one pilot. No coordination dependency. | `src/coordination/graph.js`, `pilot.js`; existing `src/content/canonical.js`. | Strict bounded graph schema, deterministic content hash, no arbitrary effects or source mutation, one terminating value-neutral pilot. |
| CE-00-02 | Transactional instances, commands, and events. Depends CE-00-01. | `src/coordination/runtime.js`, `schema.sql`; existing `src/content/phase2-transactions.js`. | Pinned immutable definition, historical account/character identity, atomic revision/event/receipt, same-key replay and conflicting-key rejection. |
| CE-00-03 | Authenticated direct API and admission flags. Depends CE-00-02. | `src/routes/coordination.js`, `src/server.js`, API tests. | Strict bodies, caller-private board, stale revision handling, engine/cohort admission, historical inspect/cancel after death or disable. |
| CE-00-04 | Foundation regression and release evidence. Depends CE-00-01–03. | Coordination runtime/API tests; existing `test/worldgraph-api.js`, `test/phase2-postgres.js` as references. | Terminal/replay/privacy/lifecycle tests, stored-data validation, documented real-database gaps, no item/economy or Agent Turn authority. |

## Phase 01 — Distributed knowledge

Read [Phase 01](../phases/PHASE_01_KNOWLEDGE.md). CE-01-01 through CE-01-06 are implemented behind default-off flags; test coverage is consolidated into helper, runtime, API and real-PostgreSQL suites rather than one script per package.

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-01-01 | Immutable claims and discovery origins. Depends CE-00-04. | `src/coordination/knowledge.js`, graph/runtime, schema; `test/coordination-knowledge.js`. | One claim per issued discovery receipt; copies preserve the root; persisted provenance and command/event writes are atomic. |
| CE-01-02 | Dynamic claim ACL and safe projections. Depends CE-01-01. | Knowledge service/routes; existing `src/crew.js`, `src/social/gangs.js`; `test/coordination-knowledge.js`, `test/coordination-knowledge-postgres.js`. | Share/revoke under live membership, no hidden-claim enumeration, stale ACL rejection, revoked cache/board access, immutable provenance. |
| CE-01-03 | Independent evidence gate and pilot. Depends CE-01-01–02. | Graph/runtime/pilot; `test/coordination-knowledge-runtime.js` and PostgreSQL race suite. | Two distinct configured source roots and accounts unlock one node; copies, directly conflicting authoritative values, stale authority, and single-account duplicates cannot. |
| CE-01-04 | Typed corroboration/contradiction and owner archive. Depends CE-01-03. | Knowledge service/schema; `test/coordination-knowledge.js`, `test/coordination-knowledge-api.js`, PostgreSQL race suite. | Links never rewrite claims; hidden endpoints stay hidden; archive entries do not create new discoveries; rebuild preserves source semantics. |
| CE-01-05 | Bounded discovery/sharing HTTP contract. Depends CE-01-02–04. | Coordination routes, API specification, `test/coordination-knowledge-api.js`. | Only issued discovery/share targets accepted, strict shapes/cursors, caller-safe receipts/errors, direct-only machine discovery. |
| CE-01-06 | Knowledge cohort rollout and recovery. Depends CE-01-05. | Knowledge flags, fixture, release notes; PostgreSQL ACL/death race tests. | Private pilot then sharing cohort; disable retains read/revoke/cancel; tables outside coordination remain unchanged. |

## Phase 02 — Organizations and delegated authority

Read [Phase 02](../phases/PHASE_02_ORGANIZATIONS.md).

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-02-01 | Typed references to existing organizations. Depends CE-01-06. | `src/coordination/organizations.js`; existing Crew/family/circle sources and membership schema. | Correct current membership resolution without shadow membership writes; private and nonexistent organization responses are equivalent. |
| CE-02-02 | Private capability grants and revocation. Depends CE-02-01. | Organization service/routes/schema; `test/coordination-organizations.js`. | Exact role/policy scope, explicit actor authority, immediate live revocation, privacy, death/replacement policy. |
| CE-02-03 | Evidence-derived trust dimensions. Depends CE-02-01. | Organization service and coordination events; `test/coordination-trust.js`. | Unique source receipt, bounded dimension rules, append-only corrections, reproducible totals, no capability from score alone. |
| CE-02-04 | Threshold authorization and consume-once execution. Depends CE-02-02–03. | Organization service/runtime; `test/coordination-authorizations.js`, PostgreSQL races. | Votes bind exact command/policy/revision; distinct eligible accounts, consent recheck, and atomic unique consumption survive revocation races. |
| CE-02-05 | Succession, dissolution, API and rollout. Depends CE-02-04. | Organization routes/history policy; `test/coordination-organizations-api.js`. | Explicit institution custody transition, no personal-secret inheritance, cancelled proposals remain historical, disable preserves revocation. |

## Phase 03 — Asynchronous operations

Read [Phase 03](../phases/PHASE_03_OPERATIONS.md).

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-03-01 | Closed operation lifecycle and compiler checks. Depends CE-02-05. | `src/coordination/operations.js`, graph; existing `src/operations.js` as separate-domain reference. | Legal lifecycle edges, bounded branches, deadline/partial-outcome rules, terminal or cancellation path from every nonterminal state. |
| CE-03-02 | Exact plan commitments and lock transition. Depends CE-03-01. | Operation service/schema; `test/coordination-operations.js`. | Consent binds frozen plan revision; role uniqueness and live membership rechecked atomically; no post-lock silent plan edit. |
| CE-03-03 | Private branch contribution and board API. Depends CE-03-02. | Coordination operation routes/service; `test/coordination-operations-api.js`. | Caller-issued branch action only, shared summary redaction, one atomic contribution receipt, cross-role and hidden-ID rejection. |
| CE-03-04 | Deadline, failure, partial resolution, cancellation. Depends CE-03-03. | Operation service, bounded scanner; `test/coordination-operation-resolution.js`. | Manual/scanner races converge on one deterministic resolution; death/absence paths terminate; pinned cancellation remains usable. |
| CE-03-05 | End-to-end operation cohort release. Depends CE-03-04. | Pilot fixture, coordination flags; PostgreSQL operation races and fault injection. | Two participants finish asynchronously; no economy writes; disabled new starts do not strand active participants or cancellation. |

## Phase 04 — Agreements and economic boundaries

Read [Phase 04](../phases/PHASE_04_ECONOMY.md). Value-moving adapters require their own domain release evidence.

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-04-01 | Value-neutral agreements and exact terms consent. Depends CE-03-05. | `src/coordination/agreements.js`, schema/routes; `test/coordination-agreements.js`. | Frozen typed terms, explicit parties/deadlines, deterministic settle/cancel, no balance or inventory columns. |
| CE-04-02 | Receipt-only crafting dependencies. Depends CE-04-01. | Agreements; existing `src/crafting.js`, `src/content/crafting.js`, `src/content/artifacts.js`. | Exact owner/hash/domain receipt checks; read cannot consume input, transfer custody, or fabricate output; no cross-domain definition coercion. |
| CE-04-03 | One reviewed item escrow adapter. Depends CE-04-02 and item-domain gate. | Agreements; existing `src/items.js`, `src/mysteries.js`; `test/coordination-item-agreements.js`. | One compatible transaction owner/context; conservation, historical depositor recovery, no nested wrapper authority, ambiguity/replay proof. |
| CE-04-04 | Optional cash/OMR agreement adapter. Depends CE-04-03 and scoped economy review. | Agreements; existing `src/economy.js`, ledger invariants and relevant cash/OMR service. | Reviewed exact debit/reservation/release receipt, budget authority unchanged, race/conservation tests, independent disabled-by-default flag. |
| CE-04-05 | Optional bond/POL receipt integration. Depends CE-04-04 and chain release gate. | Existing `src/bonds.js`, liquidity accounting/policy/queue; coordination adapter tests. | Domain-owned intent/finality reconciliation, no reserve bypass or coordinator signing, unknown outcomes do not duplicate transfers. |

## Phase 05 — Game-native strategy

Read [Phase 05](../phases/PHASE_05_STRATEGY.md). The value-neutral path does not depend on CE-04-03–05.

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-05-01 | Private commit/reveal rounds. Depends CE-03-05. | `src/coordination/strategy.js`, graph/schema; `test/coordination-commit-reveal.js`. | Domain-bound canonical digest, bounded nonce, one commitment, no pre-reveal leakage, deterministic timeout and replay. |
| CE-05-02 | Canary claim provenance and scenario-local betrayal. Depends CE-05-01, CE-01-04. | Strategy and knowledge service; `test/coordination-canaries.js`. | Server-issued clue lineage, copies retain origin, fictional in-game disclosure receipt required, no inferred external surveillance or punishment. |
| CE-05-03 | Consensus and public-goods/Schelling fixtures. Depends CE-05-01, CE-02-04. | Strategy compiler/runtime/fixtures; `test/coordination-strategy.js`. | Frozen eligible account set, explicit tie/abstention rules, bounded terminal states and inert outcomes under absent participants. |
| CE-05-04 | Strategy adversarial and privacy release. Depends CE-05-02–03. | Strategy API/flags; PostgreSQL round races and projection tests. | Commitment replacement/revocation/death races pass; mechanism-specific rollout, no premature disclosure on rollback. |

## Phase 06 — Large participant sets

Read [Phase 06](../phases/PHASE_06_MASS_COORDINATION.md).

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-06-01 | Partition-local assignments and revisions. Depends CE-03-05. | Coordination operations/schema; `test/coordination-partitions.js`. | Compiler-enforced caps; ordinary contributions avoid parent lock/write; only authorized partition visible. |
| CE-06-02 | Sealed partition receipts and deterministic aggregate. Depends CE-06-01. | `src/coordination/aggregation.js`; `test/coordination-aggregation.js`. | Unique parent-bound receipts, bounded accepted manifest, order-independent outcome, declared missing-partition behavior. |
| CE-06-03 | Bounded scanning, pagination, replay recovery. Depends CE-06-02. | Operation routes/scanner; `test/coordination-aggregation-recovery.js`. | Cursor privacy and limits, duplicate/out-of-order delivery tolerated, durable restart, no authority from a delivered event alone. |
| CE-06-04 | Measured 512-participant cohort release. Depends CE-06-03. | `tools/coordination-load.js`; existing load/concurrency/chaos harness patterns. | Recorded PostgreSQL latency/errors/lock traces at proposed bounds; phased admission and recovery preserve active partition limits. |

## Phase 07 — Constrained mystery director

Read [Phase 07](../phases/PHASE_07_MYSTERY_DIRECTOR.md).

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-07-01 | Offline candidate envelope and curated lore input. Depends CE-03-05. | `tools/coordination-director.js`; existing `src/content/discovery.js`, diagnostics and JSON parser patterns. | Strict bounded data-only candidates, synthetic/curated inputs, no production credentials/player secrets or model activation authority. |
| CE-07-02 | Deterministic compiler/economy/ACL/lore gates. Depends CE-07-01. | `src/coordination/director-validation.js`, graph; existing canonical/compiler/corpus as references. | Reproducible hashes; unknown effects, impossible authority, value movement, hidden-data publication, and invalid lore references rejected. |
| CE-07-03 | Bounded solvability and adversarial simulation. Depends CE-07-02. | Director validator; `test/coordination-director-simulation.js`. | Explicit exhaustive-vs-sampled evidence, reproducible seeds/budgets, terminal path and absent/dead/duplicate participant scenarios. |
| CE-07-04 | Review artifact and exact-hash operator activation. Depends CE-07-03. | Director tooling, new approved-artifact selection/registration boundary and schema; `test/coordination-director-activation.js`. | Approved exact artifact only, retained review provenance, safe secret overlays, no player/model upload authority or implicit activation; Phase 00 code-selected registry remains compatible. |
| CE-07-05 | Director fixture corpus and rejection regression. Depends CE-07-04. | Synthetic candidate fixtures, director tests and release notes. | Malicious/oversized/dead-end candidates rejected, first generated value-neutral mystery matches hand-authored invariants, rollback preserves pinned runs. |

## Phase 08 — Persistent world memory

Read [Phase 08](../phases/PHASE_08_PERSISTENT_WORLD.md).

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-08-01 | Typed historical resolution records. Depends CE-03-05. | `src/coordination/history.js`, events/schema; `test/coordination-history.js`. | Unique source receipt, immutable historical actors, deterministic rebuild, safe versioned rendering after definition retirement. |
| CE-08-02 | Institutional archive custody and disclosure. Depends CE-08-01, CE-02-05. | History and knowledge services; `test/coordination-archives.js`. | Dynamic readership, explicit succession/dissolution policy, private claims never automatically inherit or become public. |
| CE-08-03 | Item-provenance references and bounded history API. Depends CE-08-02, CE-04-02. | History/routes; existing item/authored receipt readers; `test/coordination-history-api.js`. | Authoritative permitted references only, no item mutation/value, private IDs absent from public records, bounded filtered cursors. |
| CE-08-04 | Seasonal state separation and rollover recovery. Depends CE-08-03. | History/schema; existing `src/season.js`, `src/estate.js`; `test/coordination-seasons.js`. | Server-derived frozen season key, permanent receipt uniqueness, active old runs recover, rollover/death/restore causes no duplicate records. |

## Phase 09 — Hardening and release evidence

Read [Phase 09](../phases/PHASE_09_HARDENING.md). Apply each relevant package before enabling its dependent feature; the numbered phase is the final consolidation.

| Task ID | Package and dependencies | Relevant source/tests | Acceptance evidence |
| --- | --- | --- | --- |
| CE-09-01 | Bounded graph/command property suite. Depends CE-00-04; expand with each phase. | Graph/runtime and `test/coordination-properties.js`. | Generated legal/illegal traces prove revision, immutable identity, deterministic replay, terminal states, payload bounds, and closed authority. |
| CE-09-02 | Complete ACL/lifecycle regression matrix. Depends CE-01-06; expand through CE-08-04. | Coordination API/projection tests, membership/death helpers. | Owner/nonowner, hidden IDs, revoke/exit, death/replacement, old versions, disable, custody, and cache privacy cases all recorded. |
| CE-09-03 | PostgreSQL race and lock-order harness. Depends CE-00-04; expand per stateful capability. | `test/coordination-postgres.js`; existing `test/phase2-postgres.js`. | Real row-lock races and authoritative post-state evidence; no pg-mem-only concurrency claims or undocumented lock cycles. |
| CE-09-04 | Economic/domain invariant adapter review. Depends enabled CE-04 packages. | Coordination adapters, `src/invariants.js`, item/liquidity domain suites. | Neutral profiles preserve all domain state; enabled adapters prove conservation/reserves/escrow and exact recovery at pinned scope. |
| CE-09-05 | Load, abuse limits, and redacted observability. Depends CE-06-04 for mass scope, CE-00-04 otherwise. | Coordination load/check tooling, persisted events, route limits. | Measured envelope, bounded bytes/pages/work, low-cardinality secret-free diagnostics, backlog and pending-receipt visibility. |
| CE-09-06 | Fault injection and unknown-commit reconciliation. Depends CE-09-03 and enabled adapter packages. | `test/coordination-chaos.js`, domain receipt recovery. | Failure at write/COMMIT/delivery boundaries never fabricates success or duplicates effects; same logical operation reconciles. |
| CE-09-07 | Additive migration, restore, replay, and rollback rehearsal. Depends CE-09-01–03, CE-09-06. | Schema, `tools/coordination-check.js`, `tools/coordination-replay.js`, migration tests. | Old/new reader compatibility, interrupted upgrade/restore, projection rebuild, disabled admission with retained history/recovery. |
| CE-09-08 | Pinned release report and capability cohort approval. Depends relevant CE-09-01–07 and enabled phase acceptance. | Release manifest/checklist, findings and retest evidence. | Exact revision/schema/hash/flags/cohort stated, findings triaged, skipped environments explicit, verified non-destructive rollback. |

## Immediate implementation card: CE-01-01

**TASK ID:** CE-01-01

**Objective:** Persist immutable knowledge claims produced by a server-issued coordination discovery and retain their original provenance through replay and later sharing.

**Why:** A future two-source gate needs an authoritative origin, not a count of copied text, duplicated requests, or client-declared discoveries.

**Dependencies:** CE-00-04 and the accepted Phase 01 claim/ACL contract. Verify the baseline source and tests before changing it.

**Relevant files:** `src/coordination/graph.js`, `src/coordination/runtime.js`, `src/coordination/pilot.js`, `src/content/canonical.js`, `src/content/phase2-transactions.js`, `schema.sql`; add `src/coordination/knowledge.js` and `test/coordination-knowledge.js`. Inspect `content_instance_facts` and `item_events` only to preserve the boundary; do not write them.

**Interfaces:** An internal discovery adapter accepts a checked transaction client, original authenticated actor context, pinned graph/source descriptor, and current command correlation. It returns a stored claim ID and safe receipt. There is no public arbitrary-claim creation API.

**Implementation requirements:** Define a closed typed proposition/value vocabulary and a server-derived discovery receipt. Add the immutable claim row with source kind/event/root, definition hash, historical account/character, and discovered time. Enforce unique discovery receipt and source identity consistency. Share/copy operations added later must reference this row, not clone its origin. Create the claim, node transition, command result, and versioned coordination event in the same transaction. Validate persisted claim fields on read.

**Security invariants:** Callers cannot nominate issuer, original source, owner, timestamps, quantities, rewards, or independence. Knowledge discovery moves no item or economy value. Death or replacement never reassigns historical identity. Unknown commit recovery uses the original command key. Raw provenance remains private until a deliberate projection allows it.

**Migration requirements:** Add tables, constraints, and indexes without changing existing histories. Do not backfill existing authored facts as verified coordination discoveries. Missing legacy evidence remains absent. New tables are unused while the feature is off.

**Tests:** Canonical field/type rejection; unique receipt replay; same-key changed-body conflict; duplicate origin attempts; malformed stored provenance; atomic fault rollback; original-character death; definition replacement; table-level assertion of no item/economy writes. Add PostgreSQL receipt/command races to the existing coordination database harness.

**Acceptance criteria:** The pilot produces one claim and one corresponding event for one discovery. Retrying the same command returns its receipt and creates nothing. A second request cannot relabel that claim's origin. The stored claim remains interpretable and owner-private after death and activation change.

**Out of scope:** Sharing, organization roles, arbitrary player assertions, independent-source gates, external document ingestion, economic entitlements, and generic event infrastructure.

**Definition of done:** Source, additive schema, strict tests, and phase-contract updates are reviewed together; targeted tests pass; any PostgreSQL environment gap is stated; the capability stays off outside the admitted pilot cohort.

## Immediate implementation card: CE-01-02

**TASK ID:** CE-01-02

**Objective:** Implement private, current-Crew, current-family, and explicit-account read grants for existing coordination claims, including atomic revocation and safe projections.

**Why:** Distributed clues are useful only if sharing preserves provenance and current membership or revocation actually controls subsequent access.

**Dependencies:** CE-01-01. Confirm the exact existing Crew/family lookup and mutation lock patterns before designing cross-membership races.

**Relevant files:** `src/coordination/knowledge.js`, `src/routes/coordination.js`, `schema.sql`, `src/crew.js`, `src/circle.js`, `src/social.js`, membership schema; add `test/coordination-knowledge-acl.js`. Reference `src/routes/worldgraph.js` and `test/worldgraph-api.js` for non-enumerating projection/error patterns.

**Interfaces:** Internal `projectClaim` and `canReadClaim` helpers receive server-derived actor context. Typed share/revoke commands accept an issued claim/grant target, expected ACL revision, and idempotency key. Organization resolution returns live membership, never a client-authored list of participants.

**Implementation requirements:** Append grant/revoke events with a monotonically increasing per-claim ACL revision and rebuildable current-grant projection. Define owner-only grant authority in this first slice; readers cannot reshare. Revalidate actor, recipient kind, ownership, current organization membership, and revisions under a lock sequence compatible with existing membership writers. Filter before pagination and counts. Version caches by ACL authority or avoid caching until correct invalidation is proved.

**Security invariants:** Hidden, foreign, and missing claim identifiers have the same public unavailable behavior. A reader receives no grant authority, hidden link endpoint, private principal, or raw source secret. A Crew/family exit or explicit revocation removes future access. Historical account inspection does not grant a replacement character old-run action authority. No mutation to existing membership systems.

**Migration requirements:** Add ACL event/current-projection records with private-by-default semantics. Existing Phase 01 claims receive no implicit Crew/family grants. Preserve grants as historical events after revocation and never erase claim origins.

**Tests:** Every principal/grant type; private/default deny; unsupported recipient types; reshare rejection; guessed IDs; counts/cursors; concurrent share/revoke; membership exit/rejoin; death/replacement; repeated idempotency keys; stale ACL revisions; old board/cached response after revocation. Run the membership/ACL race cases on PostgreSQL.

**Acceptance criteria:** The owner shares one claim with a permitted recipient and the recipient reads a safe projection. Copying/reading it creates no discovery. Revocation or relevant membership exit prevents the next read/action from using the old grant. No response reveals an inaccessible linked claim.

**Out of scope:** Threshold authority, organization role grants, automatic disclosure, external sharing links, public archives, transferable claims, and retracting information already read.

**Definition of done:** The ACL matrix and PostgreSQL race evidence support the exact implemented membership strategy, API shapes and errors are documented, and feature disable preserves owner inspection and revocation.

## Immediate implementation card: CE-01-03

**TASK ID:** CE-01-03

**Objective:** Add one compiled knowledge gate that unlocks a private node only when two authorized, independent discovery roots support the same compatible proposition.

**Why:** This is the smallest playable demonstration that coordination adds a new capability beyond a private linear graph while retaining proof of where evidence came from.

**Dependencies:** CE-01-01–02. Keep the gate value-neutral and direct-only. It may consume shared read authority but does not create party membership or a multi-party operation.

**Relevant files:** `src/coordination/graph.js`, `runtime.js`, `pilot.js`, `knowledge.js`; `test/coordination-knowledge.js`, `test/coordination-knowledge-acl.js`, and coordination PostgreSQL tests. Existing `src/content/compiler.js` and `src/mysteries.js` are comparison points, not targets for gate injection.

**Interfaces:** Add one closed compiled gate type with exact proposition semantics, allowed source roots, and required distinct-account/source counts. A resolver receives the pinned definition, actor context, and current transaction snapshot; it returns a boolean plus a safe blocker classification, never hidden claim IDs. Act requests continue using board-issued action IDs and expected instance revisions.

**Implementation requirements:** Evaluate only authentic claims that the caller may currently read and that belong to the gate's pinned compatible knowledge domain. Require two different original accounts and two configured origin roots. A grant, archive reference, alternate character, copied claim, or duplicate event cannot add weight. In this first gate, incompatible authoritative typed values for the same proposition block qualification directly from claim rows; this does not depend on CE-01-04's later relation tables. Bind the qualifying claim receipts into the node-transition event for later private reconstruction. Revalidate ACL/membership and claim state under the command locks before advancing.

**Security invariants:** Current account/character and source roots are server-derived. Account-level distinctness must not be represented as proof of two human individuals. Failed gates expose no hidden evidence or participant identity. Gate evaluation grants no item, economy, organization, puzzle-answer, or Agent Turn action authority.

**Migration requirements:** Version the graph profile and source-controlled pilot; preserve existing definitions and active runs. Add only necessary typed event/gate metadata. Do not reinterpret old definitions or auto-unlock historical nodes when the new capability is enabled.

**Tests:** Distinct permitted sources succeed exactly once; one account/two characters, copied origins, repeated receipts, mismatched propositions/hashes, contradicted claims, revoked/foreign evidence, malformed definitions, stale instance state, death, and concurrent acts fail safely. Compare deterministic private event reconstruction. Race revoke/membership exit against gate execution on PostgreSQL.

**Acceptance criteria:** Account A and account B independently earn configured discoveries. After explicit permitted sharing, one original living character can execute the newly unlocked board action once. Removing one required live grant before execution blocks it. The final state and historical evidence remain inspectable after activation change without inheriting action authority.

**Out of scope:** General theorem proving, semantic model judgments, voting, human-identity certification, automated recruitment, multi-party operations, economic rewards, and retroactive authority from shared content.

**Definition of done:** A bounded end-to-end pilot and all negative cases pass, the gate's independence limitations are documented, private response inspection finds no leaks, and the compiled capability remains independently gated for cohort rollout.
