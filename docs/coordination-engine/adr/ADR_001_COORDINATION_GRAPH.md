# ADR 001 — Bounded coordination graph profile

Accepted for Phase 00, 2026-09-13. Existing world-graph registries and authored-content bundles have distinct item, story and escrow authorities. Expanding their executable vocabulary to match every speculative node in the brief would expand their trust boundary unnecessarily.

Decision: add a small coordination profile under `src/coordination` with canonical source, a branded frozen registry, strict predicates and persisted hash-pinned runs. Reuse canonical encoding and transaction infrastructure. Keep authoritative ledgers separate. Future knowledge/operation adapters extend only the reviewed coordination profile.

Consequences: a small amount of graph-specific validation is separate from existing compilers, but item/content execution and current policies remain explicit. No shared generic `eval` or all-purpose effect engine is introduced. We intentionally do not require a new graph database, ORM, TypeScript migration or queue service.
