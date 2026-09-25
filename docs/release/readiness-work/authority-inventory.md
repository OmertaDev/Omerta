# RC1-04 authority review queue

Owner: **Codex/source_repairs**. Status: **MISSING REVIEW**.

Generate with `node tools/rc1-authority-inventory.js --out=output/authority.json`
from the intended candidate without `DATABASE_URL`. The tool uses actual Fastify
registrations in disposable pg-mem, locates every mutation registration with
Acorn, extracts dispatcher and operation action types, and records source hashes.
Exit zero confirms census generation only; it does not qualify RC1-04.

The retained JSON describes runtime `3207df3b` with no changed runtime files:
529 mounted mutation routes, 24 dispatched command types, and eight families.
All routes have registration/callee references; family entries point to canonical
authority, prerequisite, accounting, effect and receipt code. Candidate test
references are explicit review leads, never assumed coverage.

Bounded anonymous requests observed 489 authentication denials, 29 other 4xx
rejections that may precede authentication, and four `rwa_reviewer_disabled` 503s.
Seven public mutations were not invoked. Disabled rails are not enabled-path
proof. Every row retains an explicit denial state and missing role/branch review.
Empty requests to synthetic identifiers do not establish IDOR resistance, secrecy,
replay safety, state conservation, or denial of valid-shaped malicious requests.

Complete the listed review axes per route/family on the final source, including
ordinary/social/operation roles, hidden/stale/revoked Knowledge, costs and effects,
valid-shaped tampering, all replay schedules, and terminal branches. Retain native
PostgreSQL tests for transaction/lock behavior. GET side effects, websocket writes,
workers and externally enabled callback configurations need separate inventory.
