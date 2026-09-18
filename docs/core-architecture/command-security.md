# Player Command Engine security evidence

Review date: 2026-09-17 (America/New_York). Release phase: local milestone verification; no deployment or activation. Parent revision: `bca01026b642a2632cc9476e8a664287eac281ea`; this report reviews the working-tree content over that parent in `.worktrees/player-command-engine`. The source commit containing this report is the release checkpoint; the file fingerprints below identify the exact reviewed content. This report covers the command orchestration, opportunity derivation, HTTP boundary and narrowly changed native authority checks, not unrelated contracts or the whole game.

## Method and scope

The [repository review policy](../../omerta-contracts/SECURITY-REVIEW-POLICY.md) applies. Local method checkouts under the original repository's `output/audit-methods` were checked with `git rev-parse HEAD` against all three policy pins:

| Method | Verified revision | Applied pass |
| --- | --- | --- |
| pashov/skills | `c577eb7799c349de0acb187ba00ca98e14e436fd` | `solidity-auditor/references/hacking-agents/access-control-agent.md`: map permission surfaces, inconsistent guards and confused-deputy paths. Adapted to authenticated server/domain calls. |
| PlamenTSV/plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | `codex-adapter/agents/semantic-invariant.toml`: conservation, temporal ordering, authorization and monotonic branch invariants. Adapted to PostgreSQL transactions and durable receipts. |
| trailofbits/skills | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | `audit-context-building/.../resources/ANALYSIS_FORMAT.md`: inputs, assumptions, effects, callees and shared-state dependencies; native integration proofs and false-positive triage. |

These are scoped manual methods, not claims that complete upstream orchestration or Solidity tooling ran. Solidity compiler, proxy, callback, token-transfer, reentrancy and chain-deployment checks are inapplicable: this change has no on-chain mutation. The included economic boundary is existing server inventory/resource/operation services.

## Authority and execution model

1. `GET /v1/commands` authenticates the account, applies rollout/cohort policy, selects one living character and reads authorized projection/domain catalogs. Bounded commands and ranked opportunities are suggestions. Unknown prerequisites use generic undiscovered blockers; secret nodes, evidence source roots, recipe outputs and opposite-branch blueprints are omitted until authorized.
2. `player_command_boards` stores immutable, expiring account/character-bound suggestions. The execution identity binds the board and command. Clients send exactly the identity and confirmation, with the same identity as their HTTP idempotency key; they cannot substitute targets, role requirements, items or actor IDs.
3. `execute` rechecks current account and character, then checks the existing domain receipt. New execution checks expiry and current projected state before dispatch. Native services recheck locked account, character, ownership, membership, knowledge, operation and resource authority. Their transactions and receipts remain the sole effect/replay framework.
4. Successful dispatch is already committed before consequence projection. A later projection failure returns `COMPLETED`, `projection: null` and `feedback.refreshRequired: true`. Retrying the original identity reconciles the domain receipt. A new engine/database connection does not mint a new economic effect.
5. Exact HTTP retries bypass the generic cached player-response body using the server's private receipt-trust symbol. They still preserve the existing request-body binding and must pass current command authorization/projection again.
6. Knowledge commands store the intended Crew/Family identity and ACL revision. `shareKnowledgeWithGroup` verifies the expected character inside the existing command transaction; `currentGroupTarget` matches the group against that transaction's trusted current context before creating its short-lived sealed recipient token. The existing knowledge service verifies the seal, owner, group and ACL revision again. No sealed token is persisted as the stable command input. Exact receipt replay survives a process restart and cannot reinstate a later-revoked grant. The projection event hook resolves recipients from the stored authorized command and actual claim grants, not from a caller-selected audience.

Inputs trusted only after server derivation: admitted content definitions, command parameters and rollout policy. Untrusted inputs: bearer identity until authentication, query selectors, execution IDs, confirmation and idempotency headers. Assets protected: inventory, cars, capital/material commitments, knowledge grants, irreversible story choice, world state and private player metadata. Bus events are invalidation hints; they cannot authorize mutations or convert a committed effect into failure.

## Findings and retests

| ID | Severity / disposition | Evidence and correction |
| --- | --- | --- |
| CMD-01 | Medium, resolved | Command generation included absent `itemId` in a Family-only world action. Canonical hashing rejected `undefined`, crashing an informed player's board. The real Furnace journey reproduced the exception. Undefined action parameters are now removed before hashing; both branches exercise the affected world visibility transition. |
| CMD-02 | High, resolved | Existing generic HTTP receipt caching could return an old full player projection after authority changed. Command execution now marks its route with the source-owned current-projection trust symbol and repeats authorization/projection on receipt replay. `player-command-api` proves a replay sees the new district and denies the old character's response after succession. This is a new integration hazard, not classified as a baseline failure. |
| CMD-03 | Medium, resolved | A projected command could target a former current character if succession occurred between final command admission and the domain transaction. Command adapters now pass the expected character through trusted arguments; native crafting, coordination, operation and world entry points check it under their authority locks. A PostgreSQL interleaving replaces the character after the final admission query has returned its rows; the actual salvage service rejects it with `crafting_unavailable`, with unchanged economy and no additional command board. |
| CMD-04 | Invalidated test hypothesis | Initial concurrency assertion assumed salvage yielded at most three scrap. Admitted production content actually yields six scrap, two wire and two parts. Replaced the guessed bound with exact equality to one isolated real salvage's resource delta. Eight concurrent submissions match that single effect. No implementation defect was claimed. |
| CMD-05 | Medium, resolved | Projection, discovery and vehicle reads use separate bounded authority snapshots. Succession crossing those reads could compose different character generations. `read` now repeats admission for the character selected by the world projection after the other reads. A PostgreSQL interleaving replaces the character immediately after the vehicle read; `snapshot` refuses with `command_unavailable` before issuing any board. This complements the later native-lock proof in CMD-03. |
| CMD-06 | Medium, resolved | Fastify query objects have a non-plain prototype. Forwarding them directly caused valid selected-case requests to fail the projection's strict options validation. The route now copies already-validated query fields into a plain object, retaining the strict domain validator. Authenticated HTTP regressions open the selected case before and after starting it, check its graph and owner, and preserve malformed/extra-query denials. |
| CMD-07 | Low, resolved mixed verification debt | The native Phase 2 upgrade test's expected constraint catalog stopped before later schema families. The same stopping assertion reproduces at checkpoint `bca01026` and earlier `e56cf576`; this proves a prior gate failure, not that every missing expectation predates this architecture. The explicit fixture now accounts for 119 additions and three removed/replaced constraints spanning older financial tables, Coordination/World Graph/operation/recipe additions, and this milestone's three command-board PK/FK constraints. Complete catalog equality remains enforced; the original nine causal negatives remain and three more reject command PK removal, knowledge-audience alteration and restoration of the retired Crew-only identity. No table is excluded and no database constraint changed. |
| CMD-08 | Low, resolved prior test-fixture defect | Full-outage chaos scenario 3 and drain scenario 6 both created `Chaos D${RUN}`. A focused native reproduction returned `name_taken` for the second character and `no_character` (HTTP 400) for its supposed blocked deposit. Both names already exist in `e56cf576` and `bca01026`; `chaos-fixture-provenance.log` retains the exact source evidence. The drain now uses its own distinct name and asserts successful creation and the exact held row before preserving all original parked-request and shutdown checks. This corrects the test setup, not production shutdown behavior. |

The command layer contains no client-selected SQL identifiers. Reviewed board and entity lookup values use bound parameters; namespace interpolation in native fixtures is generated and regex-validated. Repository SQL/security diagnostics and baseline provenance are tracked in the milestone closure evidence; this report does not substitute for those gates.

## Executed evidence

Runtime: Node.js `v24.19.0`; PostgreSQL 16 in a loopback-only isolated test database. Every native suite creates a random private schema and drops it afterward. Memory suites use pg-mem only; memory results are not used to claim transaction isolation or concurrency.

| Command | Evidence | Result |
| --- | --- | --- |
| `node test/player-commands.js` | `output/player-command-engine/commands-memory.log` | 10 groups pass |
| `node test/player-commands.js --postgres` | `output/player-command-engine/commands-native.log` | 17 groups pass |
| `node test/player-command-api.js` | `output/player-command-engine/commands-api.log` | Production auth/idempotency route checks pass |
| `node test/player-command-journey.js` | `output/player-command-engine/journey-memory.log` | Both authored branches pass |
| `node test/player-command-journey.js --postgres` | `output/player-command-engine/journey-native.log` | Both authored branches pass |
| `node test/projection-events.js` | `output/player-command-engine/command-hints-memory.log` | Command share/revoke hint audiences pass |
| `node test/projection-events.js --postgres` | `output/player-command-engine/command-hints-native.log` | Command share/revoke hint audiences pass |
| `node test/phase2-postgres.js --definitions` | `output/player-command-engine/phase2-definitions-native.log` | Clean, upgrade, scalar and missing-unique modes pass; 12 causal negatives pass |
| `node test/phase2-postgres.js --lots` | `output/player-command-engine/phase2-lots-native.log` | Native boundary, lots, races and populated legacy receipt upgrade pass |
| `node tools/loadtest.js` (`LOAD_PLAYERS=8`) | `output/player-command-engine/loadtest-native.log` | 3,473 operations; no 5xx, pool exhaustion, deadlocks or conservation drift |
| `node tools/concurrency.js` | `output/player-command-engine/concurrency-native.log` | Exactly-once, single-winner escrow, AB-BA, exact house take and conservation pass |
| `bash tools/backup-selftest.sh` | `output/player-command-engine/backup-selftest.log` | 25 pass, one local Windows permission failure: expected `0600`, observed `0644` |
| `node tools/chaos.js` with task-only `PG_CTL` | `output/player-command-engine/chaos-native.log` | Actual database outage/recovery and interruption scenarios pass; Windows graceful SIGTERM proof remains blocked, harness exit 1 |

The native tests cover stale location/state, duplicate and double-click replay, unknown/cross-account IDs, 16 deterministic identity mutations, concurrent execution by eight independent engines, suspended accounts, character death, changed Crew membership, revoked knowledge, consumed assets, expired command/operation, resolved operation, hidden prerequisites, projection/execution races, timeout-style lost response, actual mid-domain PostgreSQL failure, actual post-commit projection failure, pool/engine recreation and applying the populated schema twice. A separate Node.js process additionally imports and starts the full production server against the same isolated PostgreSQL schema, authenticates with its own signed JWT and replays the saved command through `app.inject`; the parent verifies the saved execution identity, `replayed: true`, current projection and identical persisted economic rows. Random per-run test credentials satisfy deployment preflight instead of bypassing it. Thus independent process restart is proven separately from same-process pool/engine recreation. Native database triggers inject the two failures; domain services are not mocked. Every economic check compares persisted rows/events, not UI messages.

Command hint regressions verify that sharing refreshes only the actor and actual grant members, revocation also refreshes former recipients, foreign-board input cannot select a claim audience, failed actions send no hint, and the payload remains a coarse invalidation without private claim content.

Supplemental gates use uniquely owned loopback PostgreSQL databases/schemas. Their `.exit` sidecars preserve final exit statuses. Phase 2 baseline reproductions are retained in `phase2-definitions-checkpoint.log` and `phase2-definitions-baseline.log`; the exact observed catalog delta is retained in `phase2-definitions-delta.log`. The fixture is static expected data, never learned from the live backend during a test. PostgreSQL 18's NOT NULL catalog additions have explicit column expectations; execution evidence here is PostgreSQL 16.

Backup testing used Git Bash with a local CLI adapter that moves a leading connection URI after psql's options for Windows getopt; no SQL/options or backup checks were removed. The dump restored with its complete fixture census and exact custody/provenance/graph state. Windows reports its dump as `0644`, so the POSIX `0600` gate remains failed and the Linux permission proof is **BLOCKED** locally. No usable Docker/WSL Linux runtime was available; this is not a claimed source-baseline failure and the permission check was not weakened.

Chaos used a disposable database and stopped/restarted only the verified task-owned PostgreSQL cluster at `127.0.0.1:55437`. Worker interruption, backend termination, full outage and interrupted two-party transfers preserved ledger invariants; during the outage health returned six `503 db_down` responses and after restart six `200` responses without restarting the API. Scenario 4 concerns the explicitly retired Street Wage and remains labeled inapplicable. The original failed full run and focused fixture reproduction remain in `chaos-before-fixture-fix.log` and `chaos-name-collision.log`. The corrected drain setup proves a real character, its held row and a pending request before the signal. Its three remaining checks fail because Windows forcefully terminates a Node child on `subprocess.kill('SIGTERM')`: the request resets, termination records the signal rather than exit 0, and no drain log appears. This is the behavior documented by [Node's child-process API](https://nodejs.org/api/child_process.html#subprocesskillsignal). The POSIX deploy-drain proof is **BLOCKED** on this host and still required on Linux; no signal check was skipped or weakened. The cluster was restored and the disposable database removed after the run.

The real journeys run both `preserve` and `expose`: personalized projection → public lead → native discovery/knowledge claims → newly revealed recipe → actual garage boost and command salvage → command crafting → independent corroboration and command-issued Crew/Family knowledge sharing/revocation → irreversible mystery choice → command-created Family operation → four roles and resource/item commitments → ready → execution → one persistent world event → authorized aftermath → different outsider projection → restart replay. Family operation and world-kernel invariants are checked after each branch. Supporting travel, social formation and garage boost use existing production domain services directly; the command slice does not yet wrap those actions. Initial characters and the garage outcome's random roll seed the successful journey; a negative probe deliberately expires then restores the operation deadline. All successful progression comes from the real services.

## Reviewed source fingerprints

SHA-256 of the working-tree files reviewed for the final command suite run. Changes to these files require affected retests and refreshed hashes.

| File | SHA-256 |
| --- | --- |
| `src/player-commands.js` | `56963645a0f30780fe5fc6f60e28b681bd10ab7f24df3f09a86e5603c4235935` |
| `src/player-opportunities.js` | `b34326ec1fc57a9ffdb1c5774cea6b9edb6d842a1b6540e6659db36b93db45e4` |
| `src/routes/commands.js` | `6996da22c52e38c00946a65e0dd07709e7ff515315af42a64c8e866b16bda501` |
| `src/server.js` | `8da090fd2736aecea21c4767e97837f31639997b9edaa938e78890de2310b30c` |
| `src/crafting.js` | `b8e04ca906fe8aac4482f36f3ba274bf179f09a2a5999c5be8d869219747332f` |
| `src/coordination/runtime.js` | `f683ea96852eb12c2eccc1fb8cd96b3b7c921d4435c86267e4af2124a18d62c3` |
| `src/coordination/knowledge.js` | `286b1caf79279b9c9b8097c5b518676bc55118aaafb9f01de7d4233e6c0feaa0` |
| `src/coordination/operations.js` | `68f7022488c14193f95811115063395af559192be19ff0362815dd9cefb1717a` |
| `src/world-kernel.js` | `b7c0088a881940f5d21eb813aa094319b5170607af14a8f8eb081c3079c697fd` |
| `src/projection-events.js` | `b5989117dec989af9a251c51f8b00f4999538da8cbc563b194ec51e16b981811` |
| `schema.sql` | `f03fdf0ec42b82626a1cfd1baeb90670f5093b0bd25ac5c21f6fb8789d5ae0a9` |
| `test/player-commands.js` | `0b2659b57569a3a8bd3348d5e244b05f094bff47ced92ad0078ee08547433dc7` |
| `test/player-command-journey.js` | `0f78fb8ec8fb9f7ab004ec1ed282ef0c860ab3d97a3ef0262b2f9b358e6f19fd` |
| `test/player-command-api.js` | `d6417e213243df65eccba424e3ca50d756b01ec039e4d0089b4d503062ae0fcd` |
| `test/lib/player-command-support.js` | `e557b7537d224e22c6a34f3a2256b21180c8b3d60cb4bd3979fbc8cf6730d81a` |
| `test/projection-events.js` | `07d75a49f314b92e527364749cb1a67ef89cb891b70a6f53b8dcc619358f0721` |
| `test/phase2-postgres.js` | `2dad3da83468e3977d261301a7dd1371925833987d350752abfb9d5856a5edb6` |
| `test/lib/phase2-architecture-upgrade-catalog.json` | `fa65560729707e1dfcc40f540ba76c57b1b57138bfb650b9008dd073e9b743e5` |
| `tools/chaos.js` | `4202d6c00639cdd2b1e6d59529df1a681be18594d8b028aa5a39ca711d03078a` |

## Limits and release conclusion

No open high/critical finding remains in this scoped command review. These proofs establish retries of the same execution identity, current authority checks and the tested native transaction interleavings; they are not an exhaustive concurrency proof of every existing domain service. A fresh command after a changed world is a new intent and may legitimately spend resources again.

Per-request opportunity work is bounded and uses existing authorized/indexed projections; snapshot storage still needs a retention policy that preserves enough immutable command identity for the supported replay window. Coarse whole-board freshness can require harmless refreshes after unrelated changes. Replay feedback gives the current authorized projection rather than persisting historic private deltas. Broader trade, transfer, territory combat, social request, market and threat commands remain outside this narrow migration.

Deployment readiness additionally depends on the milestone's complete repository, architecture, SQL, lint/type/build and frontend evidence. Linux backup `0600` permissions and graceful SIGTERM drain remain unproven on this Windows host; both original gates must pass on the deployment platform before release. This review does not activate rollout flags, deploy anything or clear unrelated security baselines.
