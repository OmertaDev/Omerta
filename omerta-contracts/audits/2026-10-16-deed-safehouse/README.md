# Deed death custody and volume-priced Safe House review

Phase: source implementation before deployment or financial activation. Base revision:
`b8fcce7baaa91b29661921a17e5510a47e9f725a`. Review work used an isolated dirty worktree;
the retained raw-byte manifests pin the actual reviewed source and dependencies. This
package does not describe a deployed contract or authorize activation.

The implementation equips Deeds in restricted character-life accounts, preserves their
canonical asset wallets through successive deaths, and offers voluntary actual OMR burns
for protection. The daily price per Deed is yesterday's canonical OMR swap volume divided
by 20,000, bounded to 1–25 OMR. Protected property follows the victim's exact heir after
24 hours; unprotected player-kill property follows the killer. The game operator remains
the authority for combat, heirs and death timestamps.

## Scope and methods

Production scope: `CharacterDeedCustody`, `CharacterDeedAccount`, `DeedStockAccount`,
restricted OMR's allowance-consuming custody burn, the canonical manager's raw OMR volume
counter, SQL death/coverage/equipment state, authenticated owner consent, durable keeper
and finalized projection, estate/action guards, nested stock targeting and the browser UI.
Existing soulbound identities, ERC-721 locks, ERC-6551 bindings, token roles, journal and
transaction machinery were followed as dependencies. Unrelated market, auction, RWA and
gameplay behavior was not given blanket clearance.

The relevant Pashov, Plamen and Trail of Bits passes from the exact policy pins were used
for access/call traces, state and temporal transitions, trust boundaries, specification
comparison, adversarial hypotheses and diagnostic triage. The independent reports identify
the actual adaptations; full upstream orchestration was not claimed.

- [Design and release conditions](../../../docs/deed-death-safehouse-design.md)
- [Independent backend review](../../../docs/deed-custody-review-backend.md)
- [Independent contract review](../../../docs/deed-custody-review-contracts.md)
- [Contract toolchain, source and artifact pins, static triage and executed checks](evidence/contracts/deed-safehouse-contract-review.json)
- [Backend source and verification receipt](evidence/backend/backend-verification.json)
- [Evidence file hashes](evidence-manifest.json)

Paths to root documentation above traverse from this directory through `audits` and
`omerta-contracts`. Raw Slither diagnostics/invocation logs and standalone compiler JSON are retained as lossless
gzip files alongside the other original logs. The evidence manifest includes both
compressed and uncompressed hashes. It excludes private database files and credentials.

## Executed checks and corrections

The focused `npm run test:deed-custody` and browser suite passed with actual compiled ABI comparison,
signature/day/maximum-burn rejection, ordered kill/heir settlement, keeper recovery,
real browser execution and the actual estate hook. Separate native PostgreSQL proofs
exercised row locks, concurrent death/exit work and transaction rollback. Schema replay,
persistence, preflight, routes, existing Deeds/stock delivery and related core regressions
were checked. Retained logs distinguish earlier failures and fixtures from final retests.

The affected native Forge run passed 138 tests and initially failed two foreign-manager
fixture loads. Building that vendored artifact and rerunning exactly those two cases
passed without source changes: 140 unique affected tests are verified, zero skipped.
Two custody invariants each ran 512 × 64 calls; manager/revenue invariants each ran
512 × 500 calls, with zero reverts. The compiler is native Solidity 0.8.26 with optimizer
800 and Cancun, using the unchanged repository's native/via-IR restrictions. No alternate
compiler or changed gas/code-size limit was used to bypass a failure.

Slither completed on custody, token and manager with 107, 79 and 134 diagnostics. Raw
diagnostics and dispositions remain retained. Findings such as the initialized storage
alias, intentionally strict UTC-day equality, expiry timestamps and fixed-owner native
call were traced; tool success is not presented as an empty diagnostic set.

**ROOT-D01, high, fixed and retested:** a signed withdrawal could be durably broadcast,
then the worker could crash before updating its SQL exit row. A later death could commit
while the earlier transaction still released the Deed. The action/estate barrier now
uses the exact signed keeper-job identity and blocks every unresolved durable raw exit,
including that crash window. Cancellation cannot erase it. Native PostgreSQL and actual
action-wrapper/headless-estate proofs verify rollback, contention and recovery after a
canonical revert or finalized release. The ordinary 24-hour notice does not freeze play.

**ROOT-W01, medium, fixed and retested:** a custody sync/keeper failure could stop
unrelated jobs in the same background tick. Both calls now use the worker's established
error isolation; dependent stock sync/delivery requires explicit healthy custody completion.
The coordinator independently inspected this block and its three RPC-only concurrency
batches and executed the actual-source worker proof. Sync failures, keeper failures,
missing/dormant/blocked results, healthy completion and the disabled feature were exercised;
unrelated identity jobs continued in every case. Browser and native PostgreSQL proofs are
wired to the existing matching CI jobs rather than relying on unavailable suite-job tools.

No confirmed in-scope critical or high finding remains open. Manual review and executed
tests support only the pinned implementation phase; they do not prove absence of defects.

## Remaining conditions

Deployment needs exact immutable addresses/runtime verification, correctly sealed roles,
owner/operator separation, gas budgets, funded ordered keeper, finality and recovery checks.
The new manager excludes its partial deployment day: Safe House pricing first becomes
available at the second UTC midnight after deployment. Trading on other venues is outside
the published volume source; fee-paying wash volume can influence the bounded next-day fee.
Prepaid time is nonrefundable and limited to a seven-day horizon.

An existing immutable token cannot gain the new burn entry point through these source
edits. Existing generic Deed wallets and their approvals need a separately verified
migration; they do not become constrained automatically. The assets' own issuer powers
remain applicable. The manager runtime is 24,555 bytes, 21 bytes below EIP-170, so any
later manager edit requires another size check. The feature remains disabled by default,
and this work performed no deployment, real burn, production configuration or chain transfer.
