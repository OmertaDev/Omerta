# ADR 002 — Transactional private audit before delivery

Accepted for Phase 00, 2026-09-13. The existing in-process notification bus does not supply durable cross-process delivery, and private graph events cannot safely be forwarded wholesale.

Decision: persist closed versioned coordination events with state and command receipts in one transaction. Derive pilot counters from those rows. Add no event consumer or websocket emission in Phase 00. A later consumer must implement its own idempotency, authorized projection, retry/retention and failure policy.

Consequences: audit and telemetry survive restart and cannot commit ahead of state. The phase provides no push latency guarantee and needs no worker. An events table alone must never be described as an implemented delivery bus.
