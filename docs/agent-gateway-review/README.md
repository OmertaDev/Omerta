# Agent Gateway implementation review

Phase: local implementation and release-candidate verification, 2026-09-21. Base revision:
`e56cf576065c5f1bbb9bb55115f5961267f7d654`, with the working-tree changes pinned in
`source-manifest.json`. No deployment, vendor enrollment, wallet signature, contract
activation, or live economic transaction was performed.

The scope is the provider-neutral Gateway, its HTTP and Muse adapters, the Consigliere
player controls, additive persistence, discovery projections, bounded organization
reads, and the shared mission eligibility helper. Existing game services remain the
authority for ownership, inventory, recipes, discoveries, current membership, payouts,
and mutations. Existing unrelated `SPEC.md` changes and `docs/release/` work were preserved.

## Trust boundaries and methods

The [context dossier](context.md) and its function records map the player-session,
delegated-token, scope, provider, proposal, confirmation, durable receipt, and game-service
boundaries. The [consent review](adversarial.md) retains an initial failing proof and its
remediation. The [PostgreSQL supplement](postgres.md) records actual database concurrency
and recovery tests. The [independent projection review](projection.md) records privacy,
read-only and bounded-query checks. [Capability coverage](../agent-gateway-capabilities.md) distinguishes
authoritative support, bounded/partial projections, and unavailable adapters.

The repository's pinned review methods were adapted to this JavaScript HTTP/database
scope: pashov access-control and invariant passes (confused deputies, scope escalation,
state coupling and replay); Plamen variable/write-site and state-transition analysis
(pending/executing/completed proposals, retries and committed receipts); Trail of Bits
context-building, call tracing, explicit assumptions and executable false-positive checks.
The repository policy pins are unchanged. These are the specific methods used, not claims
that the upstream Solidity orchestration or all of its tools ran. Solidity compiler,
transfer callbacks, oracle manipulation, gas, and contract fuzzing are outside this
change: no contract or signer implementation was modified.

## Retained findings and corrections

- **GATEWAY-001, high, resolved:** retry after a known refusal could bypass the approved
  preview. A committed receipt is now recovered without dispatch; otherwise the current
  preview must match. Refused, throttled, uncertain, expired, and revoked scenarios are
  executable regressions in `test/gateway-consent.js` and `test/gateway-postgres.js`.
- **GATEWAY-002, resolved:** pending preparation replay must recheck current visibility.
  It now recomputes the authorized preview; non-pending replies return only status/link.
- **GATEWAY-003, resolved before release:** legacy HTTP replay storage would retain a
  newly issued connection token if a player supplied an Idempotency-Key. Credential
  issuance refuses that header before the global reservation hook. `test/gateway-api.js`
  proves that no replay row is created; only the credential hash enters connection storage.
- **GATEWAY-004, medium, resolved:** a concurrent throttle could leave a successfully
  committed proposal pending. Committed success now dominates delayed refusals, and
  receipt lookup can repair a pending or refused metadata row without new execution.
  `test/gateway-security.js` exercises both delayed-state interleavings.
- The organization-bound finding and its bounded-query regression are retained in the
  independent projection review. Pagination filters graph edges to permitted returned
  endpoints and never uses hidden records as model context.

## Static analysis

`static-analysis.json` retains Acorn 8.18.0 parse results and bounded AST diagnostics for
new Gateway, adapter, HTTP and client code. Rules inspected dynamic evaluation, HTML
injection sinks, and constructed SQL. The three SQL interpolation findings in
`src/gateway/events.js` are reviewed safe construction: column expressions come from
fixed source literals and `dbCaps.timestampText`; IN-list interpolation generates numeric
parameter placeholders; topic strings, owners and cursors remain bound parameters.
No SQL identifier or expression originates in agent input. No eval, Function constructor,
innerHTML or outerHTML sink was found. This limited scan is not represented as a complete
static-security analysis. Native syntax checks, test/route symbol analysis, targeted
adversarial tests and independent projection inspection supplement it.

## Verification and open release limits

Executed focused checks cover scoped delegation, revocation, schema rejection, cross-account
and cross-provider denial, discovered-only graph/clue data, own/shared knowledge, read-only
state, deterministic mission eligibility, stale consent, replay, concurrency, crash recovery,
event scope changes, timestamp precision, bounded streaming, actual HTTP routing and a real
browser approval against the local game server. The [browser recovery retest](ui-recovery-retest.md)
also covers expired pending/refused metadata, committed receipts and no-receipt refusal.

The PostgreSQL gate passed **203 checks, zero failures**; the economy simulation reported
exact ledger invariants. Invite and preflight checks passed. The cold-start suite now
explicitly tests the delegated credential perimeter rather than incorrectly treating a
player JWT as a connection token.

The full `npm test` run completed its pretest and gameplay chain through the mounted route
authentication/envelope checks. It exited 1 at the later homepage-art assertion, which
is an existing failure: `test/routes.js:351` expects three OMR PNG links absent from both
HEAD and the current homepage. `route-baseline.json` retains the comparison. The Gateway
change adds only the Consigliere navigation link to that page and does not rewrite the
unrelated artwork expectation. Overall regression status and final checkpoint hashes are
recorded in `verification.json`; no blanket green-suite claim is made.

Separately executing the checks after that route failure found two more existing failures:
`test/gates.js` flags the unchanged `bondQuoteBudgetAmount` price helper, and
`tools/knowledge-test.js` expects `servePage` where the unchanged root handler uses
`serveLaunchPage`. `regression-baseline.json` retains source/test comparisons against HEAD.
The new file census and cold-start authentication expectations were corrected and retested.

Native Muse identity, protocol, enrollment and interoperability are unverified pending the
platform URL/specification. The manifest advertises Omerta's REST adapter and explicitly
sets `nativeMuseVerified:false`. Trade/unsigned transaction preparation, RBS projection,
liquidity-to-territory mapping, and unsupported event transitions fail closed. Existing
timestamp event logs cannot guarantee late-commit completeness or exactly-once delivery;
source retention and multi-process stream admission limitations remain documented. No
production-ready claim is made for these unavailable or unverified integrations.
