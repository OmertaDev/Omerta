# Coordination Phase 07 — Constrained mystery director

Status: planned. Depends on the implemented Coordination graph schema and every capability a candidate uses; the first director profile uses only value-neutral Phases 00–03. Product intent: [shared brief](https://chatgpt.com/share/6aa68e3e-9ad8-83ea-ab47-b9c624dce707).

## Result and authority boundary

A model proposes a bounded mystery candidate. Deterministic code compiles and validates it, simulation checks the supported state space, and an operator deliberately activates one exact artifact. The model cannot activate content, issue runtime actions, set balances, inspect live secrets, query production databases, or sign with a wallet.

The repository already has two distinct content compiler surfaces: `src/content/compiler.js` for authored bundles and `src/content/corpus.js`, `discovery.js`, `artifact-storage.js`, and `artifacts.js` for sealed corpus/definition workflows. Coordination's graph compiler remains its own bounded runtime profile. Reuse canonical encoding, validated artifact techniques, and safe diagnostics; do not silently turn an authored or item-definition artifact into a coordination graph.

## Candidate pipeline and proposed records

Implement an offline `tools/coordination-director.js` pipeline and a small `src/coordination/director-validation.js` module. Input is a curated lore bundle, a capability allowlist, size limits, and synthetic scenario constraints. Never send live claim ACLs, secret answers, player identifiers, tokens, or private operation state to the candidate generator.

Pipeline stages are explicit and fail closed:

1. Parse strict JSON; reject unknown fields, arbitrary code, external URLs as executable dependencies, and resource-exhaustion shapes.
2. Compile against the selected coordination profile and immutable dependency hashes.
3. Validate ACL reachability and disclosure rules, role/quorum consistency, and a terminal/cancellation path.
4. Validate value-neutral economy policy or the exact separately reviewed adapter profile; a prose promise of zero reward is insufficient.
5. Check curated lore identifiers and contradiction rules. Mark narrative-quality judgments as review findings, not compiler proof.
6. Check solvability within declared bounds and simulate honest, absent, duplicate, adversarial, and dead participants.
7. Emit reproducible source/artifact hashes, diagnostics, simulation evidence, and a human-review projection.
8. Activate only through a separate explicit operator action bound to that exact hash.

Proposed `coordination_candidate_reviews` records immutable candidate hash, compiler/profile versions, lore hash, test seed/limits, reviewer decision, and evidence references. It is review metadata, not a live definition. Phase 00 selects its registry in source code and persists a definition when its first run is created; it has no operator registration/activation API or database activation pointer. This phase must add a reviewed approved-artifact selection boundary that verifies the exact hash before a generated artifact can enter a new-run registry. Do not add an unauthenticated or player graph-upload endpoint. A future operator route, if needed, must use the existing operator-auth pattern and have no model-accessible credential.

## Determinism, privacy, and lifecycle

The same candidate and dependency manifest must compile to the same bytes. Every stochastic simulation records its seed and budget; a successful sample is evidence, not a proof of all possible paths. Exhaustive bounded reachability and randomized simulation results remain separate. Unsatisfied or unimplemented predicates block activation rather than being interpreted by the model during play.

Keep secret overlays separate from review/public projections and verify no secrets reach diagnostics, generated player descriptions, or publishable manifests. Treat model text as untrusted data throughout. A hidden answer contained in candidate data is never an instruction to tools or a production operator.

In the proposed director workflow, registration stores immutable definitions; activation changes only a future new-run selection pointer after its compare-and-set checks. These registration/pointer records are new Phase 07 work, not existing Phase 00 tables. Existing instances pin their source, rule version, and secrets. Rejected candidates have no runtime side effects. Candidate provenance retains generator/model metadata when available but does not make the model the original discoverer of player evidence.

## Acceptance and rollout

Test malformed candidates, hidden executable instructions, unsupported gates/effects, cyclic dead ends, private-node leaks, impossible quorums, oversized graphs, contradictory lore references, and all value-moving attempts. Reproduce hashes and diagnostics across runs. Simulate membership/death/version/deadline/replay races using the same runtime contract as hand-authored fixtures.

Planned `COORDINATION_DIRECTOR=on` enables offline candidate tooling only; it does not enable runtime activation. Begin with generated fixtures reviewed alongside a hand-authored baseline. Production activation requires explicit approved-hash selection under the engine/cohort gate. Roll back by stopping candidate generation and new activations, preserving review evidence and the cancellation/readability of already pinned runs.

Out of scope: autonomous live content deployment, production database agents, runtime model adjudication, generated smart contracts, arbitrary scripts, unbounded lore scraping, and model-managed economics. Packages: CE-07-01 through CE-07-05.
