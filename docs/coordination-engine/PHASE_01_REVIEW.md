# Coordination Phase 01 review

Review date: 2026-09-13. Release phase: additive distributed knowledge, disabled by default.

This review covers schema-2 claim declarations and evidence predicates, The Split Ledger pilot, the knowledge service and its eight additive tables, runtime integration, closed HTTP contracts, feature/cohort controls, aggregate metrics and the shared HTTP receipt finalization correction. It does not clear Phases 02–09, production activation, financial/item adapters, delegated organization authority, a public knowledge feed or the wider OMERTÀ application.

Baseline HEAD is `2b3feb7c807848564094c9b56d13fd7e41f97bae`. The working tree includes preexisting unrelated tracked changes and untracked market-v2/DeFi/campaign work. The separate [Phase 01 source manifest](evidence/PHASE_01_SOURCE_MANIFEST.json) pins the reviewed files; those hashes describe a working snapshot, not a commit or deployment. The [original Phase 00 review](REVIEW.md) and its manifest remain unchanged historical evidence.

## Method and trust model

The review follows [the repository security policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md). The reviewer verified these local method checkout revisions:

| Source | Pinned commit | Applied method |
| --- | --- | --- |
| pashov/skills | `c577eb7799c349de0acb187ba00ca98e14e436fd` | Access-control surface mapping, execution traces, interleavings, parameter binding and proof/lead separation |
| PlamenTSV/plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | Cross-function read/write consistency, outside assumptions, numeric limits and canonical transaction identity/binding |
| trailofbits/skills | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | Call-following, framework/auth boundaries and persistent database concurrency coupling |

Exact files read, source anchors and the initial adversarial lock analysis are retained in [the membership design record](evidence/phase1-membership-design.txt). The methods were adapted to JavaScript and SQL. Their Solidity orchestration, twelve-specialist census, vulnerability databases, Slither, chain fuzzers and deployment workflows were not run. ContextPlus structural/skeleton/blast-radius navigation supported source inspection; no callable ContextPlus static-analysis command was available. Native syntax and executable tests are not represented as a static security analyzer.

The asset boundary is private inert evidence. Only a compiled hidden-task discovery executed by its original living owner creates a claim. The service rechecks the claim against the immutable graph/version/hash, discovered instance state, original event, source receipt, typed value and original actor. An ACL grants reading; a link remains an explicitly labeled player assertion; an archive references the same original record. Neither sharing nor confidence replaces original-source validation. Existing Crew/Family tables determine membership; this phase cannot spend currency, transfer items, grant organization command roles or invoke Agent Act.

## Concurrency and lifecycle conclusions

The caller's current character and account precede Crew and Family membership `FOR SHARE` locks. No Crew, Family, foreign-character or foreign-account lock is acquired afterward. This is compatible with the existing Crew-before-character and Family-after-character mutation paths. Existing Crew and Family kicks delete target membership without locking the target character; testing only the actor lock would have missed that race.

Relevant immutable claim rows serve as ordered `FOR UPDATE` mutexes. The service re-reads grants after those locks and validates original provenance before projecting or authorizing. Catalog entries use separate short transactions so they do not hold one graph's claim locks while collecting another graph. A gate command retains its complete initial candidate set and adds only its own newly inserted claim to its post-action projection. Rebuild locks its union of owned claims and archived foreign references before writing FK-backed projections. These decisions avoid introducing the identified opposite-order claim/membership lock paths; they do not assert that unrelated application locks are globally deadlock-free.

The PostgreSQL harness observes actual `pg_stat_activity` Lock waits in both disclosure/revoke orderings and both read/membership-removal orderings. It calls the existing Crew/family kick functions under their route lock order. If disclosure acquires authority first, removal waits; if removal is pending first, disclosure waits and then refuses. A stale or waiting gate action loses revoked evidence without partially advancing its instance. A death/heir fixture uses the existing Family removal helper and verifies current-character relookup, preserved historical own evidence and no old-run/Family action inheritance.

Overlapping reads authorized before revocation can finish. Calls acquiring authority after revocation commits must deny. Information already delivered cannot be recalled. Knowledge responses use `no-store`, and persisted link/archive receipts omit foreign endpoint IDs and evidence payloads. Owner share/revoke receipts may return that owner's safe claim. Historical receipts never authorize a new transition.

Board/archive selection that loses a candidate's permission before the claim mutex returns retryable `contention`, preserving pagination semantics without disclosing the removed claim. Focused adapter tests inject that exact prefilter-to-lock revocation boundary. Disabled target discovery returns an empty read, which keeps the cold-start read surface available while sharing mutations remain disabled.

## Findings and remediation

| ID | Classification and prerequisite | Finding, correction and evidence |
| --- | --- | --- |
| C01-R01 | Receipt integrity; delayed HTTP finalization encounters an already replaced or finalized reservation. | The shared `onSend` UPDATE previously matched account/key alone, so a delayed success could store its response under a replacement request's body hash; the failure DELETE could remove the replacement reservation. Root's controlled in-memory callback-boundary fixture failed before correction. UPDATE now compares the original body hash and requires pending status; DELETE compares the original body hash. The three-case regression preserves replacement-before-success, replacement-before-failure and an already finalized receipt. [Before](evidence/phase1-http-receipts-before.txt), [after](evidence/phase1-http-receipts-after.txt), `test/coordination-http-receipts.js`. |

C01-R01 is supported by an explicit callback-boundary state-transition fixture, not a demonstrated complete concurrent production exploit or an observed production incident. A delegated attempt ended without producing a usable probe; the root agent then implemented and executed the recorded defensive regression locally. The review does not count the unfinished delegated attempt as validation.

Design risks corrected before the final source snapshot include Crew/character order reversal from unnecessary organization locks; actor-only permission checks that do not block kicks; snapshot-only knowledge reads; opposite graph/claim batch ordering; post-action expansion into newly committed foreign candidates; and unbounded ACL history that could exhaust future revocation capacity. These are source-traced design corrections and tested final invariants. No unexecuted pre-fix exploit is asserted for them.

## Executed evidence

Runtime: Node.js `v24.19.0`. Real database: PostgreSQL `18.4` on Windows, an isolated cluster under `tmp/coordination-review/pgdata`, bound only to `127.0.0.1:55483` with scratch user `coordination_review`. Tests require explicit loopback `COORDINATION_TEST_DATABASE_URL`, create a fresh random schema and remove only that schema. No live `DATABASE_URL` was read by these runners.

| Check | Result and practical coverage |
| --- | --- |
| `node test/coordination-graph.js` | Passed: schema-1 hash compatibility; schema-2 typed declarations, exact source references, canonical identity, hostile shapes and finite predicate/bounds cases. |
| `node test/coordination-knowledge.js` | Passed: checked-client context, provenance validation, caller/purpose-bound tokens, stale ACL/target, safe claims/links/archive, projection reconstruction, explicit limits and inverse-write faults. |
| `node test/coordination-knowledge-runtime.js` | Passed on pg-mem: complete pilot journeys, original-account independence, exact-hash history, contradiction, live revoke/gates, flags and discovery fault/receipt behavior. |
| `node test/coordination-knowledge-runtime.js --postgres` | Passed on PostgreSQL 18.4, including actual transaction rollback and duplicate/ambiguous command outcomes. [Raw output](evidence/phase1-runtime-postgres.txt). |
| `node test/coordination-knowledge-postgres.js` | Passed: observed revoke/read and real Crew/family kick/read lock waits in both orderings, gate/revoke race, reciprocal links, Family death/heir handling, safe archives/receipts, unchanged economic/item event counts. [Raw output](evidence/phase1-membership-postgres.txt). |
| `node test/coordination-knowledge-api.js` | Passed focused HTTP integration: strict fields/types, auth/cohort/flags, safe schemas/errors, direct-only discovery, no-store and replay. |
| `node test/coordination-http-receipts.js` | Failed before C01-R01 correction, passed after it; three controlled finalization/cleanup cases. |
| `node test/migrate.js` | Passed: schema reapplication and existing death-disposition audit; no unrelated migration-test changes were required. The new original-character claim identity remains historical ledger state. |

The final `npm run test:coordination` passed all seven scripts. The final combined `npm run test:coordination:postgres` runs foundation, knowledge runtime and the explicit lock harness; [its retained output](evidence/phase1-combined-postgres.txt) is the final database result. An earlier combined run found a harness mismatch after disabled target discovery intentionally changed to an empty successful list: the helper demanded a target before it could test a refused sharing mutation. The corrected test separately asserts empty targets and directly checks the disabled mutation. [The failed attempt](evidence/phase1-combined-postgres-before-harness-fix.txt) is retained; it was a test expectation failure, not a service defect.

Affected shared checks passed: security, hardening, RWA HTTP integration, mounted routes (786), cold-start reads (175), preflight, migration, authored-content API and world-graph API. The [Phase 01 verification record](evidence/phase1-verification-summary.json) links their retained logs and results. There was no full `npm test` rerun for Phase 01.

The final documentation check passed the current census (235 source modules, 204 test files, 352 tables, 566 markdown files), then failed the already known unrelated O1 audit-packet scope assertion for eleven preexisting market-v2 contracts/interfaces. [Raw result](evidence/phase1-docs-check.txt). The wider contract packet and unrelated files were not changed to bypass that gate. `SPEC.md` and `MARKETING-POSTS.md` received checked census updates only and retain the workspace/preexisting-file caveat.

An additional `node test/gates.js` rerun passed its initial 73 gate requirements and then stopped at the existing `src/bonds.js:bondQuoteBudgetAmount` price-bound classification assertion, before later suite-ledger checks. [Raw result](evidence/phase1-gates-check.txt). That source and guard are unchanged from the baseline. This targeted rerun reproduces the known limitation; it is not a full gate-suite pass.

The new optional PostgreSQL harness initially lacked a workflow invocation. The existing `pgcheck` job now runs `npm run test:coordination:postgres` with only its disposable service's explicit loopback test URL. All five workflow files parse with `js-yaml`, and scoped coordination wiring assertions pass. [Targeted check](evidence/phase1-ci-targeted-check.txt). A read-only equivalent of the full suite-ledger check confirmed coordination coverage but found three preexisting unrelated orphan scripts: `test/market-v2-deployment-plan.js`, `test/marketv2keeper.js`, and `test/marketv2solver.js`. [Full equivalent result](evidence/phase1-ci-check.txt). No unrelated declaration or test was changed. The checked-in job uses PostgreSQL 16/Node 22; local runtime evidence uses PostgreSQL 18.4/Node 24.19.0. Remote CI itself was not run.

The complete focused command, shared-route/auth/hardening checks, source syntax, whitespace, census and documentation results are recorded with final snapshot evidence. The prior Phase 00 full-repository run and its unrelated failures remain historical; they are not claimed as a full Phase 01 suite pass.

## Limits and release boundary

The evidence is finite deterministic testing and controlled fault/interleaving testing, not exhaustive model checking, a broad fuzz campaign, or a measured production workload. The code assumes the established authentication perimeter, an honest database administrator and trusted source registry. Application append-only behavior does not protect against a SQL superuser rewriting history. Encrypted tokens are process-local and expire after ten minutes, so clients refresh after restart; the tests do not establish a multi-process shared-token deployment design.

The resolver fails closed on incomplete evidence scans. Private grant, claim, archive and ACL-history caps bound the pilot, reserve capacity for revocation and avoid presenting a mass-operation claim. Institution custody/succession, stronger human independence, external evidence adapters, permission delegation and background delivery remain out of scope. No production server, chain, deployment, commit or feature flag was activated by this work.
