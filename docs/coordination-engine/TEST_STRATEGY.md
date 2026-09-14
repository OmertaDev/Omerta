# Coordination test strategy

## Phase 00 checks

`npm run test:coordination` runs the compiler, foundation service/API and Phase 01 knowledge helper/runtime/API suites. The compiler covers canonical identity, deep immutability, branded registries, all three-condition M-of-N truth tables, malformed predicates/fields, hostile JavaScript shapes, missing/dangling/cyclic references and exact bounds. Schema-2 cases add typed claim closure, valid original-source references and independent-evidence envelopes while preserving the schema-1 pilot hash. These are deterministic finite tests, not a claim of exhaustive state-space or fuzz coverage.

The service suite runs a real pilot to completion, compares hidden/private projections, exercises stale/forged inputs and same-revision races, checks key reuse/exact replay, proves definition pinning across successor/removal, tests original-character execution and account cancellation, verifies server-derived time/location/level predicates, and compares economic state before/after. Fault injection covers every create and terminal-completion write plus definitive failed COMMIT. A separate lost-acknowledgement case verifies receipt recovery without re-execution.

`test/coordination-api.js` checks raw validation before Fastify coercion, auth/route wiring, explicit machine contracts, private error shapes and HTTP idempotency. Run the relevant existing integration guards after touching shared files: `test/preflight.js`, `test/migrate.js`, `test/agentturn.js`, `test/worldgraph-api.js`, `test/content-api.js`, `test/routes.js`, and `test/docs.js`. Existing unrelated failures must be identified from evidence rather than silently waived.

## Real PostgreSQL

Use a disposable loopback PostgreSQL cluster and set only `COORDINATION_TEST_DATABASE_URL` for the test process. Run `npm run test:coordination:postgres`. The script refuses non-loopback endpoints and creates a random schema, then removes only that schema. It applies the additive schema twice. It never reads or falls back to the game's `DATABASE_URL`.

Run real transaction/row-lock races and actual rollback before enabling a release cohort. pg-mem does not implement PostgreSQL rollback or row locking; its passing inverse-write tests are separate evidence. Record the PostgreSQL version and actual results in the review. Additional probes should include a held character lock during death/replacement and ambiguous COMMIT recovery. Stop an agent-created scratch database after testing.

`npm run test:coordination:knowledge` runs the three Phase 01 memory/API suites. The complete PostgreSQL command additionally runs `test/coordination-knowledge-runtime.js --postgres` and `test/coordination-knowledge-postgres.js`. The latter uses `pg_stat_activity` to observe actual Lock waits in both disclosure/revoke and disclosure/membership-removal orderings. It invokes existing Crew/family kick implementations under their established route lock order, tests a gate losing pending evidence, reciprocal claim links, the real Family removal helper during a death/heir transaction, private archive filtering and absence of economic events. Its connection target is explicit loopback-only and each run removes only its own random schema.

The existing `pgcheck` CI job invokes the combined coordination PostgreSQL command against its disposable service through `COORDINATION_TEST_DATABASE_URL`. This adds no service or production connection. The checked-in job uses PostgreSQL 16/Node 22; local Phase 01 evidence uses PostgreSQL 18.4/Node 24.19.0. Workflow parsing and script wiring were verified locally; no remote CI result is inferred from that check.

Phase 01 service cases also cover source authenticity, typed contradictions, same-account/heir independence, retained exact-hash history, forged caller-bound tokens, stale ACL/targets, reconstruction from durable events, private projection fields, per-account/claim bounds, revocation capacity, atomic fault boundaries and ambiguous COMMIT recovery. API tests cover current auth/cohort/flags, closed inputs and no-store responses, safe receipt serialization and HTTP/domain replay. An isolated database fixture is not a production load benchmark.

## Evidence and later phases

Retain source revision and working-file hashes, commands, exit status, diagnostic dispositions and actual limitations. `REVIEW.md` and its original source manifest remain the historical Phase 00 record; `PHASE_01_REVIEW.md` and a separate Phase 01 manifest cover the extension. Generated evidence should not contain tokens or player data. `node --check` is a syntax check, not semantic security analysis. ContextPlus structural/blast-radius checks are navigation aids; unavailable static-analysis tools must be recorded as unavailable.

Do not add redundant tests merely to increase totals. Each new phase contributes tests at its new trust boundary and runs the existing affected suites. Economic adapters require conservation properties and real transaction tests; mass operations require measured concurrency/latency budgets; AI candidates require invalid-schema/permission/economy/reference and solvability rejection cases. Production activation and merge require their own exact-revision evidence.
