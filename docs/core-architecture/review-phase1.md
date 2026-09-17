# Phase 1 kernel security and invariant review

Date: 2026-09-17. Baseline: `e56cf576065c5f1bbb9bb55115f5961267f7d654`; working tree contains the uncommitted Phase 1 implementation. This independent pass found **no additional confirmed security defect** in the scoped revision below. This is scoped review evidence, not a phase-pass declaration or deployment authorization. The root integration owner retains the full-suite gate.

## Scope and methods

Reviewed the kernel/query/knowledge/invariant modules, route and pilot content, and the changes to crafting, coordination knowledge, items, schema, validator, server registration, invariant integration and test scripts. Followed the relevant existing item transaction/replay/owner checks, knowledge authenticity/ACL/context helpers, and operation read authorization. Reviewed all six new tests and the native runner. Existing unrelated gameplay, contracts, token rails, frontend and production infrastructure are excluded.

The local method checkouts were checked with `git rev-parse HEAD`; all match [SECURITY-REVIEW-POLICY.md](../../omerta-contracts/SECURITY-REVIEW-POLICY.md):

| Source and exact pin | Targeted material actually applied |
| --- | --- |
| Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` | `solidity-auditor/references/hacking-agents/access-control-agent.md` and `invariant-agent.md`: guard consistency, deputy/owner boundaries, state coupling, replay, ordering and view/write consistency. |
| Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | `agents/depth-state-trace.md`: entry-point-to-state traces, cross-function constraints, stale state and boundary cases. |
| Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` | `plugins/audit-context-building/skills/audit-context-building/SKILL.md` and `plugins/fp-check/skills/fp-check/SKILL.md`: trust-boundary/callee mapping followed by claim restatement and source-to-sink false-positive checks. |

Adaptation: one independent reviewer used targeted manual passes, the native JavaScript tests and retained PostgreSQL evidence. Upstream Solidity analyzers, full orchestration, fuzzing and nested agent dispatch were not run. There are no contract compiler, chain, deployed address, token-transfer or external-callback claims in this scope. Static review used focused `rg`, diffs and direct source reads; no automated static analyzer was invoked, so there is no claimed clean analyzer result.

## System model and adversarial checks

* **Entry points and authority:** `src/routes/world-kernel.js:54` mounts six routes. Authentication supplies `req.user.sub`; feature/cohort admission precedes handlers. Request query fields and undeclared body fields are rejected. Object/action IDs select immutable server definitions, never an owner, family, crew, recipe output or knowledge claim. `WORLD_GRAPH_KERNEL` is off unless exactly `on`.
* **Assets and durable authority:** accounts/characters, social membership, coordination claims and item ledgers remain authoritative. The new object row holds authored physical state/revision/control; its event links an exact item mutation receipt and consumed item. The process-local event contains object ID/revision only and is emitted after transaction completion. There is no currency or item faucet in the pilot.
* **Read boundaries:** `src/world-kernel-query.js:60` selects the caller's current living character and account assets; historical character inventory does not become heir inventory. Mystery references require both the authority account and an owner tied to that account. Operation references follow the existing opener/assignment/current-Crew read rule (`src/operations.js:864`). Public definition edges require two visible endpoints. Item provenance omits prior owners, free-text reasons and mutation keys; knowledge projection omits discoverer identity. Explicit per-batch truncation flags avoid asserting a complete neighborhood. The query uses a repeatable-read snapshot; it is a snapshot, not a guarantee that concurrent revocation cannot commit before its response arrives.
* **Knowledge and hidden objects:** `src/coordination/knowledge.js:181` normalizes exact content hash/domain/proposition/source/value requirements, selects only live ACL candidates, locks a globally sorted claim set and rechecks access. The existing `authentic` helper verifies pinned definition, executed discovery event, account/character origin, source, value and discovery receipt. Caller preview sets never authorize crafting. `src/world-kernel.js:151` batches private visibility predicates; every nonpublic state requires nonempty knowledge. Raw requirements are absent from API projections.
* **Mutation and stale state:** `src/world-kernel.js:186` copies the scalar command before hashing/awaiting. Its authenticated account plus logical key forms the replay domain; the guard binds mutation kind, owner, command and definition hash. Exact completed replay returns a receipt without spending or notifying again, including after an ACL change. A fresh command rechecks current character/account, Crew roster, every living member's Family and caller boss/underboss role, caller location, authentic knowledge, object revision and the active account-owned item/template.
* **Atomicity and lock order:** the existing branded item transaction encloses guard, social/claim/object locks, stack/item consumption, state revision, world event and receipt. The kernel takes Crew, sorted characters, accounts, Family, memberships, sorted claims, object and inventory in that order; membership is rechecked after parent locks. An item mutation cannot spend another owner through its composite token. PostgreSQL serializes the competing writes; rollback compensations are specific to pg-mem. Native SQL serialization/deadlock failures become retryable contention, not partial success. The two injected post-write failures verify that world state, inventory and receipts recover together.
* **Restart, migration and audit:** rows pin the authored definition hash and reject mismatched runtime definitions. Reopening the service preserves object state and exact replay. Schema constraints enforce positive/unique event revisions and unique mutation linkage; Family dissolution nulls present control but retains historical event identity. `src/world-kernel-invariants.js:5` checks contiguous positive revision counts and the current state/event/receipt/consumed-item relationship. It is an audit check, not a complete historical event-content verifier or an independent mutation authority.

The reviewed trust assumptions are an authenticated server account, authentic immutable registries, trusted database writers, and use of the existing transaction wrappers. Forged in-process service implementations and arbitrary database writes are not remote client capabilities. Corrupt rows fail closed where checked; the invariant test deliberately corrupts current state and detects it.

## Resolved issues retained from the implementation review

These issues were already corrected when this independent pass began. Their original observations were supplied by the integration owner; this pass inspected the current corrections and exercised the listed regressions. They are not newly discovered defects or unresolved findings.

| ID / severity | Corrected failure and evidence |
| --- | --- |
| WK-R01 / medium, command integrity | Caller mutation after replay reservation could separate the spent item from the hashed command. The scalar snapshot at `execute` entry now binds both. `test/world-kernel-input.js` changes the original object while execution is paused and proves only the original item/event/receipt is used. |
| WK-R02 / medium, hidden-state authorization | Empty knowledge could make a later nonpublic state pass a vacuous predicate. Compilation now rejects **any** nonpublic state without knowledge, regardless of initial state. `test/world-kernel.js:297` checks both initial-state arrangements and a valid wholly public definition. |
| WK-R03 / medium, emulator integrity | pg-mem `ON CONFLICT DO NOTHING RETURNING` could incorrectly register an existing object for deletion on rollback. The kernel checks for an existing locked row before registering insertion compensation. `test/world-kernel.js:262` proves stale/replayed commands preserve the previously committed object, and the post-write failure cases verify compensation. This was a pg-mem discrepancy; native PostgreSQL is separately tested. |
| WK-R04 / medium, lifecycle integrity | Deleted Families must not retain live object control or block dissolution. `controller_family_id` now references `gangs(id) ON DELETE SET NULL`; historical `family_id` remains in events. `test/world-kernel.js:448` runs real Family departure/dissolution and preserves state/events; migration coverage repeats the database constraint check. |
| WK-R05 / low, request contract | Explicit JSON `null` was treated as an empty crafting request. Only an absent body defaults to `{}`; `test/world-kernel-api.js:94` requires `400 bad_world_request` for literal `null`. |
| WK-R06 / medium, native migration availability | The event mutation foreign key must match the existing UUID mutation ID. `schema.sql` uses `mutation_id UUID`, and `test/world-kernel-migration.js` successfully upgrades the exact populated old baseline, reapplies migration, executes and replays a world command. |

No additional regression is requested by this pass. Keep these cases in the normal targeted suite and the native gate; pg-mem alone cannot establish PostgreSQL transaction or lock behavior.

## Executed and inspected evidence

Independent run on 2026-09-17: Node `v24.19.0`, `pg 8.22.0`, `pg-mem 3.0.14`, Fastify `5.12.1`.

`npm run test:world-kernel` **exit 0**. Its five suites passed: knowledge crafting (definition/source/ACL/receipt checks), bounded query privacy and authority, mutable command regression, kernel vertical slice/rollback/replay/dissolution, and mounted HTTP auth/cohort/input/hidden-state/receipt recovery. The intentional lost-HTTP-receipt tests printed two `idempotency: store UPDATE failed` messages and successfully recovered through domain replay; those messages are fault-injection evidence, not unexplained failures. This reviewer did not run the full `npm test` gate.

The integration owner separately executed `npm run test:world-kernel:postgres` on PostgreSQL 18; this reviewer read its retained output and inspected the native tests. It passed knowledge crafting, query, the full kernel slice, and migration from the exact baseline. The kernel test observes actual `pg_stat_activity` lock waits and exercises **both orders** for real Family kick, Crew departure and claim revocation, instead of assuming order after a delay. The native run also verifies independent service reconnection, competing keys, identical-key replay and both write rollback points. Migration verifies preserved old item provenance, repeated boot, constraints, dissolution and invariant corruption detection. The owner's PostgreSQL 16 run for parity with the declared CI major is pending; this report makes no claim that it has passed.

Retained external evidence, relative to this checkout:

| Evidence | SHA-256 |
| --- | --- |
| `../evidence/kernel-postgres-suite.log` | `b230b458dfb541a5d30b3410466bebb55c6f680ada410c1b375589928c2ecb39` |
| `../evidence/kernel-migration.log` | `c8e74448ab4522aa17b1f6a17de29fb913cae176663ad2ba083e22f9aeb487d6` |

The full gate was still in progress when this report was prepared. The root owner also retains baseline failure comparisons in `../evidence/baseline-main-gates.log` and `../evidence/baseline-main-routes.log`; this report does not independently adjudicate those unrelated baseline failures. Full-suite outcome and final preflight remain integration decisions. No deployment or feature activation is authorized here.

## Reviewed working-tree SHA-256 manifest

Captured 2026-09-17 at 15:33 America/New_York. Material changes to these files reopen affected conclusions.

```text
src/world-kernel.js d159aef74601e3e0a6d8d89d6db9ada491ecad1d63ebfc40df604c66a73f557c
src/world-kernel-query.js ef5afcbbe7e7520728e7e1e129d629a147d9809d8bdacd56ccf4b6e12cd6b0ae
src/world-knowledge.js 14b610b6264ccc27ad7e25665a6aefb38e768613961536806025be5deef57cef
src/world-kernel-invariants.js d6b3702ba8eb0fc36e983336f44595b97993b15e12a2e1ef3c9df301a8f5a67a
src/routes/world-kernel.js 2ecb6829c603443c03967911be48443168735a960d701e83ee56531d74b17f8f
src/content/world-kernel-pilot.js fba26a24f29b05fea2d64717a733b58f6d5dee98cd059bbebe1f12d19d790ce3
src/crafting.js 265969522340eb10ea20e8f24f7f62f6b67aedb189ff0090a950871a5ea7b894
src/coordination/knowledge.js c3f816dfa1dadf2cbb770da330c6f8118c9335524092270529d70feb07124291
src/items.js f3635087063243919f3ad0fed38d52c8d683539101eebacc4a99eb0f93991bc1
src/invariants.js 5da4bd04388bdea3a3cc5f359cf1907a137096557f9ef96cc28031c3059a69e1
src/worldgraph-validate.js 2a7df803573e5b97b3761b880d33f772f06a6871aec45858757386a9b5b1f1b3
src/server.js 46f5f5bdf9c8d2d53254d9a234ab462ee44e59e94e0bb2305d37cbf75ee727fd
schema.sql c3aa2b87af8e4381c54c2bb4d03cca4be7155a7403732b852c2bb861b27d2af9
package.json a5ea01f749ad92e87d16a974afb0c2d986499931b4b768ce9cf94b5e32b99b15
test/world-kernel.js afbd765baa3d25886794f7e7d6ef2a4cc1eafc18af8d5677b64c0ea7c8d643f8
test/world-kernel-input.js 3716d175e0564b3679b88f3c7774110b66b6981d577f51ae5dca5827a56fe124
test/world-kernel-query.js 7131bd8813b5c4a9fc591fda37120dceea4943257e229215958e3ae116fc6d61
test/world-kernel-api.js dbb9445ca1f6c15f515f03bd88679fc72c417a9e87006db95fa7e78e22ac34e6
test/world-kernel-migration.js 77c8bf9348c640ed95dae0202c4ec993d7ebefbf59a63d2b84c22ad819c79430
test/world-knowledge-crafting.js 13b3958805a97a596ab7c1c601015a077fae2604bc2cc15b7c002c8e36e17b9f
tools/world-kernel-postgres.js 495ae98cf383b43d0320fdcd98226f15d5f6a4411f933c3973ad5b135449a64b
```

## Follow-up addendum — 2026-09-17 15:58 America/New_York

This bounded follow-up covers the final query facade extension, SQL parameterization and static-gate integration. The earlier manifest remains historical; only the query source/test entries are superseded by the hashes below. Test-owner fixture corrections add active account setup and missing/banned-account regressions; they do not relax the production account guard. No broader production security review was repeated.

**Facade review:** no new confirmed security defect. Current-Family pacts require `kind='pact'`, acceptance and future expiry; pending, expired and other Families' pacts are excluded. War rivalry uses only the caller's current Family and a live target row. As in `diplomacyBoard`, active coalitions publicly expose target, expiry, count and armed status, while the only member identity projected is the caller's own Family. A bounded coalition-ID subquery feeds one grouped query: `COUNT(m.gang_id)` correctly gives zero for an empty left join, and the conditional aggregate compares only the authenticated Family parameter. No other membership identities or founder IDs leave that query. The grouped query removes the intermediate per-coalition round trips; the regression compares total query count at limits 1 and 3.

Current-Crew objective identity is `[crewId, week]`; only the current weekly objective and the caller's own contribution/claim flag are exposed. Unmaterialized objectives use the existing deterministic `crewObjectiveOf` result without inserting state. All expiry predicates and the week derive from one server-chosen instant, using strict future comparisons and `weekOf(dayOf(at.getTime()))`. Existing repeatable-read and membership boundaries remain. Query SQL now binds limits, owners and timestamps as parameters; event provenance selects the same bounded owned-item set inside the snapshot. The implementation owner reports the final expanded query test passed on pg-mem and PostgreSQL 16, including privacy, expiry, membership loss, empty coalition and fixed-query-count regressions; this reviewer inspected the source/tests rather than repeating those runs.

**Static-gate comparison:** the ordinary gate stops at a baseline bond assertion. An external Acorn 8.18.0 probe preserved original assertions and continued after failures at independent statement/block boundaries, without editing tracked tests. Assertions inside helper functions and callbacks retain normal throw behavior, including the gate's self-tests. Both the clean original checkout (`e56cf576065c5f1bbb9bb55115f5961267f7d654`, clean status verified) and final checkout used this same probe on Node v24.19.0. Generated copies, raw diagnostics and the script are retained under `../evidence/`.

The initial comparison found three kernel-specific gate integration gaps: the new native command was absent from the expected CI list, `CRAFTING_KNOWLEDGE` lacked a storage-posture declaration, and ten new SQL interpolation occurrences lacked classification. All three are resolved. Parameterization removes the eight query occurrences; exact declarations classify the fixed `visibleSql` predicate and constant `MAX_EVIDENCE + 1`. These two expression declarations also classify four equivalent pre-existing occurrences. This was reviewed gate metadata, not evidence of a reachable SQL-injection exploit.

Final diagnostic: **8 assertion failures, all already present in the baseline; no remaining kernel-attributable delta.** Baseline had 13 assertion failures, including five related CI-inventory assertions now corrected. Remaining categories are:

* `bonds.js:bondQuoteBudgetAmount` price-bound declaration.
* Two `defi.js` catalog membership lookups.
* A stale `v4oraclekeeper.js` Promise.all waiver, plus 13 pre-existing unclassified Promise.all sites.
* Seven `coordination/graph.js` display-name diagnostics.
* Twelve pre-existing `coordination/knowledge.js` interpolation diagnostics (baseline had sixteen).
* Four dormant suites: `current-copy`, `market-v2-deployment-plan`, `marketv2keeper`, `marketv2solver`.
* Three undeclared mutable collections: `coordination/graph.js:REGISTRIES`, `coordination/knowledge.js:contexts`, `defi.js:ABI_CACHE`.

Both diagnostic runs intentionally exit 1. Continuing after the missing-posture assertion also produces the same derivative `undefined.startsWith` error in each checkout; it skips the remaining unchanged worker/env checks inside that block, while subsequent top-level blocks still execute. This limitation is retained rather than presented as a complete gate pass. Raw logs give every exact source location and message. These baseline diagnostics were compared, not independently certified as exploitable security findings.

PostgreSQL 16 parity is no longer pending: the owner-run kernel suite passed all four lanes, and the inspected dump/restore log verifies state, control, consumed-item provenance, exact replay, event count and invariants in a different database. The root owner separately reports native `pgcheck` 203/203. Those are integration evidence; this addendum does not declare the entire phase or full repository suite passed.

| Follow-up artifact | SHA-256 |
| --- | --- |
| `src/world-kernel-query.js` | `1af67892fbfd4adba0f1466f45dc35d50fbe01af63c039bb5d4e7719d2a0e41b` |
| `test/world-kernel-query.js` | `252534ffcf1892c781a95e857ceb166c4cf42a44b1cdd289400ea97322594ef2` |
| `test/gates.js` | `407f9f2f022d5120ebe4e6c59357fcfe0706578b04a63be95a8740b6788cd121` |
| `../evidence/gates-probe-final-aggregate.log` | `aa74a58861acfea172d152a942cf639b87ad46145f7a500598d8fc92bfc304e6` |
| `../evidence/gates-probe-baseline-assertions.log` | `672fa3892bf016695f0a7317e63387113099b520666e71648f018fd737f7c388` |
| `../evidence/inspect-all-gates.cjs` | `2cbb39bc1caef572589e7a1922b7c0e79166c387df9c95dba00b3f53800cc7ed` |
| `../evidence/kernel-postgres16-final.log` | `a56d70fc19b5aa7e9e5d8c87b774807d8791346bff522d376aa2002e28542461` |
| `../evidence/world-kernel-restore16.log` | `bfdce225e0c0214ad12dbf25320ba9cfadac270ae3b6daf972d3fd60734dc529` |
