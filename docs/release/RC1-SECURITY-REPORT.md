# RC1 scoped security and contract gate evidence

Date: 2026-09-20 UTC. Frozen source: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
Final hosted source candidate: `21d0589a8b1f15cbb712e574becd507b813e4b0c`.
Phase: local release-candidate verification; no live-chain configuration, deployment,
transaction broadcast, signer activation, or player-cohort experiment.

This report covers the bounded surfaces and executed evidence below. It does not
certify every game route, every command variant, all contract deployment parameters,
or production infrastructure. The aggregate release decision belongs to
[RC1-RELEASE-REPORT.md](RC1-RELEASE-REPORT.md).

## Scope and source identity

Working directory: `C:/Users/Jorge/.codex/worktrees/omerta-rc1-closure/Omerta`.
The initial 13 targeted regression suites ran against the frozen source before
the RC1 diagnostics repair. The native PostgreSQL HTTP proof also ran against
the working tree containing that repair. No authorization, economic or replay
implementation repair was necessary in this scoped pass.

Reviewed entry points and callees:

- `src/server.js`: bearer authentication, account status/token-version checks,
  HTTP idempotency reservation and receipt recovery, request bounds.
- `src/auth.js`: configured identity-provider boundary; regression coverage below.
- `src/routes/commands.js` and `src/player-commands.js`: strict opaque execution
  identities, account/character binding, persisted boards, board locks, domain
  dispatch, receipts and current-authority reprojection.
- `src/routes/coordination.js`, `src/coordination/knowledge.js`,
  `src/world-knowledge.js`: checked contexts, private claim visibility, authenticated
  encrypted target tokens, ACL revision locks, immutable source provenance,
  allowlisted responses and stale-access denial.
- Relevant World Graph, projection, Family-operation and Director trust boundaries
  exercised through the named suites; these are not a line-by-line audit of every
  module in those systems.
- `omerta-contracts/src/VoucherClaim.sol`: focused signature/nonce/recipient/cap
  boundary inspection and seven-detector static pass. The complete Foundry gate
  is recorded separately below; passing tests are not a new comprehensive manual
  contract audit.
- `src/command-diagnostics.js` and changed command call sites: privacy and failure
  behavior review of the release-gate repair owned by the release coordinator.
  The final request-scoped, module-private Symbol preserves the same allowlisted
  log schema; caller JSON cannot select or replace that Symbol.

Working-tree source hashes, dependency pins and evidence hashes are retained in
`evidence/security/source-and-evidence-hashes.json`. The report applies to those
bytes when they differ from the frozen SHA.

## Methods actually used

The three local method checkouts were verified with `git rev-parse HEAD`:

| Source | Pin | Applied method |
| --- | --- | --- |
| pashov/skills | `c577eb7799c349de0acb187ba00ca98e14e436fd` | `solidity-auditor/references/hacking-agents/access-control-agent.md`: enumerate privilege boundaries, compare guards and trace concrete unauthorized access hypotheses |
| PlamenTSV/plamen | `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` | `agents/skills/evm/verification-protocol/SKILL.md`: require a reachable entry point, an observable invariant and a concrete assertion; separate local-code, mock and deployed evidence |
| trailofbits/skills | `d3323cefbcf645678b8dc481de204b02ad3d02dc` | `plugins/audit-context-building/skills/audit-context-building/SKILL.md` and `resources/DOMAIN_NOTES.md`: map middleware, callers, persisted authority and concurrency coupling before interpreting a helper as validation |

Adaptation: these were focused method passes within the existing release team,
not execution of upstream orchestration or every upstream checklist. No external
production behavior is inferred from mocked providers or a local chain VM.

## System and trust model

The HTTP boundary derives the account from a verified bearer. A Player Command
accepts only `{executionId, confirmed}` and requires the identical idempotency key.
The identifier selects an account-bound persisted board; the current living
character must still match. Stored costs, prerequisites, targets and effects are
not replaced by client fields. The current board fingerprint is compared before
dispatch, and the selected native domain service rechecks authority while mutating.

For PostgreSQL, the issued board uses `FOR UPDATE NOWAIT`; domain mutation receipts
persist separately. Replays read those receipts and build a new authorized
projection. A process-local admission counter limits connection pressure; it is
not the economic receipt or authoritative game state. PostgreSQL concurrency
evidence is required in addition to the memory fallback.

Knowledge ownership and active current-group grants derive visibility. Sources
are checked against their pinned compiled definitions and source events. Knowing
a claim ID is insufficient. Share targets use authenticated encryption bound to
the acting account; target/ACL freshness is rechecked. Revoked knowledge also
disappears from archive/link projections. Process-local target encryption makes
uncommitted target tokens refreshable after restart; durable grants and claims
remain database state.

VoucherClaim verifies an EIP-712 signature over recipient, amount, kind, gear ID,
nonce and deadline; marks nonce use before external transfers; and uses
nonReentrant. OMR transfers come from the funded tranche. Gear minting is bounded
by configured class caps and redeemed quantities. Owner configuration and the
off-chain signer remain trusted; this review did not inspect a live Safe, signer,
tranche, address or deployed bytecode.

## Executed adversarial evidence

All commands below ran from the worktree root unless stated otherwise. Exact
start times, exits and log names for the first 13 commands are in
`evidence/security/regression-results.json`. All 13 exited 0.

| Command | Evidence and scope |
| --- | --- |
| `node test/auth.js` | `auth.log`: provider refusal, OAuth state, token revocation and moderator authority regression |
| `node test/security.js` | `security.log`: existing economic exploit regressions, idempotency, invite/identity races, throttling and websocket revocation; pg-mem, not transaction proof |
| `node test/player-commands.js` | `player-commands.log`: 10 groups including forged IDs, stale state, expiry, confirmation, receipt loss, consumed asset and replay |
| `node test/player-command-api.js` | `player-command-api.log`: actual mounted server, strict shape, foreign account, cohort, no-store, live projection and character isolation |
| `node test/director-security.js` | `director-security.log`: outsider enumeration, ACL revocation, Crew/Family departure, stale/forged actions, definition tamper and expiry |
| `node test/coordination-knowledge.js` | `coordination-knowledge.log`: checked contexts, encrypted targets, immutable provenance, 12 rollback boundaries and bounded rebuild |
| `node test/coordination-knowledge-runtime.js` | `coordination-knowledge-runtime.log`: sharing lifecycle, incompatible/retired source, hash isolation and rollback/recovery regression |
| `node test/coordination-knowledge-api.js` | `coordination-knowledge-api.log`: unauthenticated routes, foreign/missing claim equivalence, private DTOs, sharing rights, current ACL and opaque cursor binding |
| `node test/world-kernel-input.js` | `world-kernel-input.log`: strict data boundary regression |
| `node test/world-kernel-api.js` | `world-kernel-api.log`: mounted World Graph authority boundary |
| `node test/world-projection-api.js` | `world-projection-api.log`: authenticated/private projection boundary |
| `node test/world-projection-mysteries-api.js` | `world-projection-mysteries-api.log`: hidden mystery projection boundary |
| `node test/family-operations-api.js` | `family-operations-api.log`: current leadership, foreign operation and custody API boundary |

Five additional targeted commands also exited 0; timestamps and exits are in
`additional-regression-results.json`: `node test/hardening.js`,
`node test/chain.js`, `node test/coordination-http-receipts.js`,
`node test/coordination-api.js`, and `node test/director-api.js`. Their same-name
logs retain rate-limit/idempotency/ledger checks, SIWE and signing boundary
regressions, durable HTTP receipt behavior, coordination access and Director
audience redaction respectively. The chain suite uses local provider/test data;
it does not establish live RPC, finality or deployed signer configuration.

### New native PostgreSQL full-server proof

PowerShell reproduction against an isolated local PostgreSQL installation:

```powershell
$env:RC1_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55439/postgres'
node test/rc1-command-redteam.js
```

The harness refuses non-loopback URLs, creates and drops its own random database,
boots the complete server against PostgreSQL 18 and uses generated test secrets.
It enables the scoped World Graph/Coordination/Knowledge/operations flags and
disables throttling for the attack batch. Rate-limit correctness is covered by
the separate existing security suite, not this high-volume input run.

Result: **PASS**, exit 0. `evidence/security/rc1-command-redteam.log` contains:

- 42 denied cases: cost/reward/prerequisite/participant/target/account/character
  overrides, availability and authorization claims, command/type substitution,
  prototype keys, nonboolean confirmations, malformed or SQL-like execution IDs,
  malformed/oversized JSON, foreign query fields, mismatched keys, missing/invalid
  bearer, stolen execution identity and modified identity segments.
- Denials preserve characters, item stacks/instances, mystery instances, domain
  mutation receipts, operations, world objects, coordination commands and the
  transaction ledger.
- Eight simultaneous submissions produce exactly **one fresh execution**. Other
  attempts return contention or a completed safe replay. Exactly one native
  mystery instance exists.
- Success retry and full server/pool reconstruction return the existing receipt
  and leave the captured authoritative/economic state unchanged.

This new run covers the common command entry boundary and a representative
mystery command; it does not claim an independent timeout/restart/concurrency
attack for every individual command subtype. Broader native suites and fault
injection belong to the PostgreSQL evidence package.

The independent PostgreSQL workstream also completed these current-source gates
with exit 0 (the command/start/finish/status records are appended to each log):

- `npm run test:coordination:postgres`,
  [`test-coordination-postgres.log`](evidence/postgres/test-coordination-postgres.log).
- `npm run test:player-commands:postgres`,
  [`test-player-commands-postgres.log`](evidence/postgres/test-player-commands-postgres.log).
- `npm run test:director:postgres`,
  [`test-director-postgres.log`](evidence/postgres/test-director-postgres.log).

These include native ACL/membership interleavings, Player Command concurrency
and independent-process replay, Director fact/event sampling races, current
canonical history redaction, and campaign interruption/recovery. They are
current evidence, not results imported from the earlier RC1 branch.

Harness-development failures were not product failures: the first draft queried
the nonexistent table `resource_balances` instead of `item_stacks`; the second
expected one refusal status where Fastify's secure parser emits another generic
refusal; the third accidentally included valid boolean `true` among invalid
confirmations. Their raw logs are preserved as `rc1-command-redteam-harness-initial.log`,
`rc1-command-redteam-parser-status.log` and `rc1-command-redteam-valid-boolean.log`.
They are classification **D, tooling defect**, corrected without weakening any
economic, authorization or replay assertion.

## Static diagnostics and disposition

`backend-static-scan.log` retains a bounded source scan of the scoped command and
Knowledge boundary for dynamic SQL, JSON parsing and executable/HTML sinks.

| Diagnostic | Disposition |
| --- | --- |
| Player Command JSON parsing | Persisted server-issued board/options and domain receipts; route refuses extra client authority fields. JSON parsing alone is not code execution. No exploitable path established. |
| Knowledge JSON parsing | Stored definition/event data, or authenticated decrypted target tokens with purpose/account/expiry checks. Direct JSON cannot impersonate an issued target. |
| Knowledge `insert`/`replace` dynamic table/column text | Callers supply literal internal table names and server-created record keys. Values use SQL parameters. No client-selected SQL identifier path found in the inspected calls. |
| Knowledge visibility SQL interpolation | `visibleSql` generates the predicate and placeholder numbers; actor/group values are parameterized. No client SQL fragment accepted. |

Six scoped `node --check` runs exited 0; commands/exits are retained in
`syntax-results.json`. This is syntax evidence, not semantic security proof.

Slither 0.11.6 reproduction from `omerta-contracts` (Foundry must be on PATH):

```text
slither src/VoucherClaim.sol --compile-force-framework solc --solc C:/Users/Jorge/AppData/Roaming/svm/0.8.26/solc-0.8.26 --solc-remaps @openzeppelin/=lib/openzeppelin-contracts/ --solc-args "--optimize --optimize-runs 800 --evm-version cancun" --detect reentrancy-eth,reentrancy-no-eth,arbitrary-send-erc20,arbitrary-send-erc20-permit,controlled-delegatecall,unprotected-upgrade,suicidal --filter-paths lib/ --json ../docs/release/evidence/security/slither-voucher-final.json
```

Exit 0; 23 contracts analyzed with seven detectors, zero results. Raw JSON and log
are retained. The first two invocations failed because Foundry was not on PATH;
their retained logs are classification **D, tooling defect**, repaired by a
process-local PATH addition. Compiler configuration discovery selected the native
0.8.26 compiler under `.solc-select`; the exact invoked command is in the log.
No broad all-detector or all-contract clean claim follows from this result.

## Foundry gate

Command: `C:/Users/Jorge/.foundry/bin/forge.exe test --root omerta-contracts -vvv`.
Version: Foundry 1.7.1, commit `4072e48705af9d93e3c0f6e29e93b5e9a40caed8`.
Configuration: Solc 0.8.26, optimizer 800, Cancun, configured via-IR restrictions,
512 fuzz cases and 512 invariant runs at depth 500, with the repository's
`fail_on_revert=false` setting. No budget was reduced. No explicit fuzz seed was
supplied (`fuzz.seed=null`); this is a recorded randomized run, not a claim of a
fixed-seed sweep. Full configuration is retained in `foundry-config.json`.

The initial command failed to resolve unprovisioned `lib/` dependencies, retained
in `foundry.log`: classification **E, environment defect**. Dependencies were
provisioned at the CI pins: forge-std v1.9.6, OpenZeppelin v5.6.1, v4-core 1.0.2,
v4-periphery `ad04c9f24a170accf5ea1b2836bbafd514537ca6`, Permit2
`cc56ad0f3439c502c246fc5cfcc3db92bb8b7219`. The provisioned run is retained in
`foundry-provisioned.log`: **PASS, exit 0; 1,247 tests across 82 suites, zero
failures and zero skips**. Test execution took 1,924.00 seconds after compilation.
The final stock-registry invariant completed 512 runs and 256,000 calls with
zero reverts. No test budget or invariant was reduced to obtain this result.
`foundry-results.json` records the terminal command/result, and
`foundry-test-inventory.json` retains the complete test inventory.

The final source/evidence hash manifest includes all five dependency Solidity
trees and 98 compiled source artifacts with compiler settings and init/runtime
hashes. Its source comparison confirms the reviewed files match candidate
`21d0589a8b1f15cbb712e574becd507b813e4b0c` and that contract source, tests and
Foundry configuration are unchanged from the frozen main revision.

## Findings, hypotheses and limitations

No new confirmed P0/P1 exploit was established in the bounded authorization,
Knowledge, command-input and voucher inspection described here. The following
claims are deliberately narrower than a whole-product clearance.

### RC1-MOBILE-CONFIRM — passive screen telemetry cancels a pending confirmation

Classification: **A, RC blocker** for the critical-confirmation/mobile gate;
P1 interaction defect, not an unauthorized economic mutation.

Reproduction: `node test/rc1-passive-projection.js` on frozen/current pre-repair
source exits 1. `evidence/security/passive-projection-initial.log` records both
`passiveClientClears:["world"]` and a server-side
`{channel:"projection",changed:true}` hint. This is fresh evidence obtained after
inspecting a historical lead; no historical result is substituted for this run.

Trigger: enter an unreported screen, open a Player Command confirmation, and let
the 15-second screen beacon flush (or background the tab). `api('POST',
'/v1/screens', ...)` invalidates the actual World projection coordinator. Its
production `clear` callback invokes `worldChoiceConfirmation()`, resolving the
pending choice as canceled. A successful screen-beacon request also emits a
websocket projection hint through `src/projection-events.js`, causing another
refresh. Screen telemetry changes no gameplay authority.

Disposition: **repaired and retested**. The repair is an exact `POST /v1/screens`
exception in `public/index.html` client invalidation and `src/projection-events.js`
hint admission. Gameplay-command invalidation remains; the reproducer asserts
that invariant. No new telemetry endpoint was adopted. The regression is chained
in `npm run test:rc1:observability`.

All seven affected commands exited 0; exact commands/start times/exits/logs are
in `evidence/security/passive-retest-results.json`: `node test/rc1-passive-projection.js`,
`node test/projection-events.js`, `node test/projection-events-ws.js`,
`node test/world-projection-client.js`, `node test/player-command-client.js`,
`node test/routes.js`, and `node test/rc1-observability.js`. The repaired regression
observes zero client clears and zero server hints for the passive beacon. Actual
device/mobile confirmation behavior remains part of the browser gate; this
source-level reproduction does not substitute for those browser journeys.

| Hypothesis/observation | Evidence source | Disposition |
| --- | --- | --- |
| Client can set command costs/rewards/participants | `[CODE]` strict production route plus real PostgreSQL HTTP proof | Rejected in 42-case common-boundary run; no client authority persisted |
| Known foreign execution/claim ID grants access | `[CODE]` account-bound lookup/current ACL; mounted API tests and native command proof | Rejected in executed cases |
| Replay/concurrent request duplicates the tested command | `[CODE]` PostgreSQL board/domain locks and receipts; new native proof | One fresh execution and one mystery instance; no duplicate captured state |
| Revoked or incomplete Knowledge remains usable | `[CODE]` current visibility and source checks; Knowledge/Director regressions | Rejected in executed fixtures; native variants recorded in PostgreSQL package |
| Diagnostics can log player secrets | `[CODE]` closed record schema/random correlation ID; coordinator's observability tests | No request/body/account/target/token serialization in inspected module. Direct-return auth denials were identified and the coordinator added the missing 401/403 response-stage observation. |
| Voucher bridge has selected reentrancy/transfer/delegatecall findings | `[CODE]` focused Slither run and source inspection | Zero selected-detector results; no live deployment claim |

Unauthenticated, ordinary/new, foreign, Crew/Family, leadership, participant and
nonparticipant, partial/stale Knowledge cases occur in the named suites. The
entire Cartesian product of roles and all APIs was not exhaustively exercised;
ally/enemy semantics outside the supplied competing-Family fixtures remain
outside this pass. Browser XSS, every legacy economic route, distributed rate
limits, infrastructure exhaustion, all external identity-provider behavior,
production signer/indexer operation and every deployed contract configuration
are not certified here. Bearer-only command requests do not rely on ambient
cookie authority; this does not replace testing other cookie-bearing surfaces.

The prior RC1 branch `36156ace3f4e4600badc8394a205d0e10432d227` was inspected only
as a source of leads. Its `ratelimit.js`/`server.js` changes separate a new passive
observation endpoint from mutation limits; that endpoint is absent on frozen
main, so the branch's observation-rate regression is not a current exploit.
Its `world-consequences.js` changes clarify state descriptions and do not alter
visibility. No historical pass/failure or prior code repair was counted as
current execution evidence.

Complete-game economic conservation, process signals, migration rollback, live
mobile journeys and a real controlled cohort require the separate release gates.
An absent proof is not represented as a demonstrated exploit or as a passing gate.
