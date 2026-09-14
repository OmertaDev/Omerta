# ADR 005 — Models propose content; deterministic code owns resolution

Accepted as the Phase 07 boundary, 2026-09-13. No model service is wired into Phase 00.

Decision: AI outputs are untrusted candidates. They must pass the closed schema, reference/privacy/economy checks, solvability simulation and deliberate activation before any player can execute them. Runtime predicates and state transitions remain deterministic and server-owned. Candidate generation has no database write credential, wallet signer, admin mutation, player-ban or reward authority.

Consequences: generation and runtime can evolve independently, validation can reject plausible but impossible stories, and prompt injection in generated content cannot become executable code. A validator's natural-language approval never substitutes for an enforceable compiled capability boundary.
