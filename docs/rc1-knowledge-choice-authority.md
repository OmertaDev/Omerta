# Scoped Knowledge revocation and irreversible-choice HTTP proof

This component adds missing direct Knowledge-revoke authority controls and a
separate authored Furnace-choice confirmation probe. It changes no production
runtime, route, progression rule, package script, workflow or shared registry.
The development base is `0f34f6a46e7a565a40734fa6fb2b3ab2e3f07cd7`.

Run each case in its own clean committed checkout invocation and new restricted
output directory. `RC1_TEST_DATABASE_URL` is an explicit loopback control database;
the runner creates and closes a separate database with an exact name/OID/comment
ownership check. `RC1_KNOWLEDGE_AUTHORITY_OUTPUT` must be outside the checkout.

```powershell
$env:RC1_TEST_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55441/rc1_native_harness'
$env:RC1_KNOWLEDGE_AUTHORITY_OUTPUT = '<new restricted private path>/knowledge'
node test/rc1-knowledge-authority-postgres.js --knowledge
$env:RC1_KNOWLEDGE_AUTHORITY_OUTPUT = '<new restricted private path>/confirmation'
node test/rc1-knowledge-authority-postgres.js --confirmation
node test/rc1-command-redteam.js
```

Knowledge adds 14 refusals: reader/outsider revocation of an actual owner's live
grant, paired missing-claim nondisclosure comparisons, four actor-field injections
for each nonowner, a reader-owned claim paired with another claim's valid grant,
and an owner's stale ACL revision. The positive owner revoke must increment ACL
revision once. Existing role, revoked-view, archive/link, direct action,
PlayerCommand and two server reconstruction/replay controls remain intact.
Author/grant identifiers in malicious requests are explicitly supplied test attack
knowledge; they are not asserted to be disclosed by recipient views.

The separate confirmation case uses two initially funded eligible characters and
an initial shared Crew fixture. Before measurement only, the researcher performs
the canonical HTTP boost with disclosed `Math.random=0.01`; the original RNG is
restored before baseline. Original costs, car receipt and RNG audit remain.
There are no inserted claims, mystery nodes, choices or crafted items. The
measured full-HTTP prefix earns the docks source, salvages the car, crafts the key,
earns the foundry source, shares independent evidence and reaches the authored
Furnace deduction. A current preserve command with `confirmed:false` must refuse
without authority changes; the same issued identity with `true` commits one
preserve branch, discovers preserve and excludes expose. The stale opposite
command must refuse before and after reconstruction. Exact committed-command
retries after branch completion and reconstruction preserve the result and state.

Complete relevant before/after snapshots and exact sanitized request/response
bodies are retained for each denial and replay. Knowledge compares all rows and
columns of the existing named 30-table authority scope; confirmation adds only
`mystery_node_state` and `mystery_choices` (32). These serial comparisons retain the
existing JSON row representation. HTTP caches, passive telemetry, current
projection issuance, unlisted tables and sequences are not equality inputs.
Complete canonical baseline/final and reconstruction snapshots are also retained
with the existing SQL-text canonical snapshot tool, without claiming bootstrap
equality. An appended terminal hook awaits all original response hooks. Evidence
contains no bearer tokens. Stream verification checks every indexed byte and the
complete history chain after sealing; launcher failure remains failure.

Trust boundaries reviewed: JWT sub/account token-version admission in
`src/server.js`; strict revoke shape and account-bound routing in
`src/routes/coordination.js` and `src/coordination/http-contract.js`; locked actor
and fingerprinted receipts in `src/coordination/runtime.js`; phase-bound context,
claim ownership before revision/grant lookup, exact claim/grant pairing and ACL
event author in `src/coordination/knowledge.js`; issued board/account admission,
confirmation before receipt/dispatch, current-state fingerprint and historical
receipt in `src/player-commands.js`; authored independent evidence and branch
effects in `src/content/furnace-ledger.js`. No test assertion treats a client actor
field, visible claim or grant identifier as authority.

The repository's pinned Pashov access-control, Plamen evidence-verification and
Trail of Bits audit-context-building methods were applied as bounded source and
callee tracing followed by native adversarial controls. Upstream per-function
agent orchestration was adapted to the already occupied team slots. Solidity/EVM
proxy, token, delegatecall and compiler checks do not apply to these JavaScript
HTTP boundaries. These are current-source `[CODE]` proofs, not production evidence.

Scoped Family-operation and world-kernel invariants run. This does not claim full
resource conservation for numeric fixtures, all authority tables/routes, the
successful expose branch, concurrent choice races, Family operation execution,
natural entry, original worker deadlines, deployed behavior, physical devices,
or any 90-day matrix/release gate. Native results and failed development attempts
must be reported separately with their exact source and private evidence hashes.
