# Authored Content Runtime and The Sixth Chair — Implementation Plan

> **Execution discipline:** test-driven, sub-agent parallelized by non-overlapping ownership, integrated and verified by the primary agent.

**Goal:** Ship a capability-gated, hash-pinned authored-content runtime and a playable, value-neutral The Sixth Chair v2 narrative spine.

**Architecture:** Immutable bundle registry and activation pointer; relational account-level party instances; revision-checked server-issued actions; deterministic graph cascade; exact-once per-member reward claims. Player mutations reuse `withCharacter`; operator activation uses `modAuth` and database semantic idempotency.

**Tech stack:** Node.js ESM, Fastify, PostgreSQL/pg-mem, existing compiler and schema boot system, Node assertions, ContextPlus static analysis.

---

## Task 1: Lock the runtime authoring contract with failing tests

**Files:**

- Modify: `test/content-graph.js`
- Modify: `src/content/compiler.js`
- Create: `test/fixtures/content/runtime-minimal.json`
- Create: `content/packs/sixth-chair-v2/pack.json`

**Red tests:**

- runtime manifest references missing/wrong-type nodes;
- canonical puzzle lacks an answer spec;
- answer spec uses an unsupported verifier or empty accepted values;
- choice lacks stable options;
- runtime profile contains unsupported node/gate/effect kinds;
- terminal status/collectible effect lacks recipient/claim policy;
- player projection cannot include answer-spec payloads.

**Green implementation:**

- export runtime capability constants and `validateRuntimeContentPack`;
- keep compile-only packs valid when no runtime manifest exists;
- add strict manifest/reference/payload/edge checks for runtime packs;
- author the v2 runtime manifest, prompts, answer specs, Witness options, and single reward path;
- preserve v1 unchanged.

**Focused verification:**

```powershell
node test/content-graph.js
node tools/content.js check content/packs/sixth-chair-v2/pack.json
```

## Task 2: Add the immutable runtime schema and pure registry/core tests

**Files:**

- Modify: `schema.sql`
- Create: `src/content/runtime.js`
- Create: `test/content-runtime.js`

**Red tests:**

- tampered/old-hash bundle activation;
- namespace/version hash substitution;
- active version regression;
- exact activation replay;
- instance pin unaffected by later activation;
- duplicate organization run;
- exact-once node/fact/effect keys.

**Green implementation:**

- add `content_bundles`, `content_activations`, `content_instances`, `content_instance_members`, `content_instance_nodes`, `content_instance_facts`, and `content_instance_effects`;
- implement safe bundle re-verification by stripping claimed hash, recompiling, and comparing;
- implement semantic activation idempotency and monotonic versioning;
- implement bundle loading and runtime projection helpers;
- implement instance state projection that strips private data.

**Focused verification:**

```powershell
node test/content-runtime.js
node test/migrate.js
```

## Task 3: Implement party lifecycle and revision authority

**Files:**

- Modify: `src/content/runtime.js`
- Modify: `test/content-runtime.js`

**Red tests:**

- authoritative Crew/Family scope derivation;
- one account cannot occupy two roles;
- one role cannot have two accounts;
- agent/NPC cannot be Witness;
- another account cannot submit Witness consent;
- three seats cannot start;
- four valid seats can start and roles lock;
- consent revocation blocks actions and reaffirmation restores them;
- stale revision returns replacement state;
- forming leave frees a role; leader leave abandons.

**Green implementation:**

- create, join, consent, leave, and start operations;
- derive participant kinds and organization membership from server state;
- lock instance then revalidate all aggregate constraints;
- issue stable action IDs from the safe projection;
- increment revision exactly once per successful mutation.

**Focused verification:**

```powershell
node test/content-runtime.js
node test/crew.js
node test/gates.js
```

## Task 4: Implement deterministic graph actions and cascade

**Files:**

- Modify: `src/content/runtime.js`
- Modify: `test/content-runtime.js`

**Red tests:**

- unavailable and wrong-role nodes refuse;
- wrong answers reveal nothing;
- correct answers normalize and complete once;
- Witness valid choice is immutable and Witness-only;
- evidence visibility respects scope;
- three contributions do not complete testimony;
- four contributions complete once;
- world fact is instance-scoped;
- deterministic cascade reaches reward and terminal;
- concurrent/fresh-key replay still creates one completion/effect.

**Green implementation:**

- action resolution from server-issued IDs;
- supported gate evaluation;
- puzzle/choice completion;
- `UNLOCKS`, `REVEALS`, `CONTRIBUTES_TO`, and `REWARDS` fixpoint cascade;
- sparse node/fact materialization;
- terminal completion and per-participant pending effects.

**Focused verification:**

```powershell
node test/content-runtime.js
node test/content-graph.js
```

## Task 5: Implement self-claim status and collectible effects

**Files:**

- Modify: `src/content/runtime.js`
- Modify: `test/content-runtime.js`

**Red tests:**

- only a completed participant can claim;
- each pending effect applies once;
- replay returns no duplicate award;
- status projects to the caller's living character title;
- collectible remains account-level and survives street identity;
- full run changes no cash/OMR and writes no `transactions` rows.

**Green implementation:**

- claim only caller-subject pending rows under `withCharacter`;
- use the effect table as canonical ownership;
- set the living character title for an applied status;
- return safe applied/pending award summaries;
- never call the currency ledger for this runtime profile.

**Focused verification:**

```powershell
node test/content-runtime.js
node test/migrate.js
```

## Task 6: Mount the authenticated API and operator activation

**Files:**

- Create: `src/routes/content.js`
- Modify: `src/server.js`
- Modify: `test/content-runtime.js`
- Modify: `test/routes.js` only if route-count documentation requires it

**Red tests:**

- anonymous player access is `401`;
- player body cannot nominate account/organization/effects;
- operator activation requires `modAuth`;
- inactive namespace refuses creation;
- all mutations honor global idempotency;
- stale instance response is `409` with replacement projection;
- state projection never leaks private answers/raw accounts.

**Green implementation:**

- add the content route registrar;
- register it once in `server.js`;
- route reads through `readCharacter` and writes through `withCharacter`;
- map expected runtime errors to stable HTTP responses through existing error handling.

**Focused verification:**

```powershell
node test/content-runtime.js
node test/routes.js
node test/hardening.js
```

## Task 7: Publish a strict machine contract

**Files:**

- Modify: `src/agentgateway.js`
- Modify: `test/content-runtime.js`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `SPEC.md` if the mounted-route count crosses the existing tolerance

**Red tests:**

- `/openapi.json` includes all player content routes with bearer security;
- strict request/response schemas reject additional properties;
- mod activation remains absent from public OpenAPI;
- schema never exposes answer specs or effect internals.

**Green implementation:**

- add content tag/operation contracts and reusable schemas;
- bump the package minor version as required for new API surface, merging rather than replacing current user edits;
- update only the necessary route-count documentation.

**Focused verification:**

```powershell
node test/content-runtime.js
node test/docs.js
node test/routes.js
```

## Task 8: Graph/static/invariant verification and documentation

**Files:**

- Modify: `content/README.md`
- Modify generated knowledge artifacts only through their generator if required

**Checks:**

```powershell
node test/content-runtime.js
node test/content-graph.js
node test/migrate.js
node test/routes.js
node test/gates.js
node test/hardening.js
npm run content:check
npm run knowledge:check
```

Run ContextPlus `run_static_analysis` on all changed runtime/compiler/route files. Run native syntax and focused tests alongside it. Inspect `git diff --check` and the final diff, preserving pre-existing user changes in `package.json`, `package-lock.json`, and `omerta-contracts/.gas-snapshot`.

## Sub-agent ownership

- **Content-contract agent:** compiler runtime validator, runtime fixture, Sixth Chair v2, compiler tests.
- **Runtime-core agent:** additive schema, runtime service, core lifecycle/graph/claim tests.
- **API-contract agent:** route registrar, OpenAPI contracts, API assertions.
- **Primary agent:** design/plan docs, server integration, package/spec merge, cross-track review, ContextPlus blast/static analysis, and final verification.

Agents may not edit outside their ownership without coordinating first. The primary agent integrates only after each track provides fresh focused test evidence.
