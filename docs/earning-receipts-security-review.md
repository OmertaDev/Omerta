# Earning receipt graph release review

Date: 2026-10-10. Scope: src/earningreceipts.js and test/earningreceipts.js at551dcffb3ad688c443bfd3a9a34d063e964b77d3, plus main/native test wiring through existing test/resourcework.js. Clean base16a55ff2f30c2f583ba8f3bbe5e409b4a126d9ec. Phase: pre-release, no financial activation. Exact feature/review commits are retained in the PR; generated artifacts do not broaden this review.

## Dependency graph and release ownership

The root coordinates a directed acyclic release graph: receipt reconciliation precedes the private earnings API; authored delivery PR223 precedes its execution client. Each feature has its own managed worktree and branch, with agents owning disjoint source files. Only the release coordinator updates shared test wiring, documentation and generated artifacts, integrates dependency commits, publishes PRs, and serializes merges/deployments. Dependency source must be reviewed and committed before consumers test it. A changed reviewed revision requires fresh affected checks. Financial activation is a separate operation and remains disabled.

Current receipt graph: accepted service job -> buyer reserved-ledger debit job_payment:ID -> seller available-ledger credit job_revenue:ID. Both edges must match their account identities, kinds, exact amounts and zero counterpart delta. Missing or mismatched edges cannot contribute to matched page revenue. Source funding allocation, recipient verification, external cost reconciliation and payout settlement are missing downstream dependencies; internal receipt balance is not proof of externally settled or withdrawable money.

## Methods, scope and trust boundaries

Applied relevant methods pinned by omerta-contracts/SECURITY-REVIEW-POLICY.md: Pashov c577eb7799c349de0acb187ba00ca98e14e436fd identity/boundary/replay passes; Plamen795962b96e254f2e423a2635fe7f8cb8ea1e6d69 asset/accounting transitions adapted to JavaScript; Trail of Bits d3323cefbcf645678b8dc481de204b02ad3d02dc context/specification/property checks. No upstream orchestration or automated whole-repository SAST is claimed. This pure module has no storage, credentials, provider calls or native locking. Contract/chain execution and financial activation are excluded. Its SQL consumer requires its own persistence/privacy review.

Bounded input is at most100 receipt rows, IDs1..128ASCII identifier characters, exact-cent job prices10,000..1,000,000,000USDmicros, and ledger deltas within schema bounds +/-1,000,000,000,000. Duplicate or malformed rows reject; valid but wrong graph edges remain visible as unbalanced. Private output whitelists receipt identity, fulfillment, matched amounts and issue codes without questions, text, counterpart identity or arbitrary input fields. Aggregate matched values remain exact safe integers. Historical balanced transfer can remain visible when current buyer funding is frozen or unknown; those flags are distinct observations. Withdrawable amount stays zero, withdrawals unsupported, source provenance unverified and outside costs/net profit incomplete for every mode.

## Finding and executed evidence

ER1low: initial ledger validation reused the job-price1e9 bound, causing a valid larger schema delta to reject the entire observation rather than identify an unmatched edge. Fixed in551dcffb by using the ledger1e12 bound without relaxing exact transfer matching. Tests exercise credit/debit1e9+1 and1e12 as mismatch/no matched revenue, and values outside +/-1e12 as malformed.

Nodev24.19.0: node test/earningreceipts.js passes unit/adversarial/privacy/input bounds and500 deterministic conservation pages seed0x5eed1234. node test/resourcework.js passes with the new suite imported; the same existing native script also imports it. Syntax and gitdiff checks pass. Raw local retained output: output/receipt-main-wiring.log. Parent independently inspected closed authority, identity matching, bounded arithmetic and output projection; no unresolved finding. Native concurrency is inapplicable to this pure module and is explicitly required for its earnings API consumer. Source/test hashes are retained with the dependency commits; Git normalizes line endings.

Ready within this exact pure reconciliation scope, subject to fresh required hosted checks before merge. It does not authorize a payout, establish customer funding provenance, certify quality or promise real income. Live payments, real compute purchases and financial activation remain disabled.

Reviewed working-tree SHA256 after ER1: source796891bdf47497355035397e1913ac33ce789a04129c2c46a8ca278ad7a43a3f; testef4f39d26f7bdd4855e66ec21b404f426dcc1677ae0d059a24078774c85570e5. Initial documentation check detected the newly added module/test counts; SPEC was remeasured and the required guard then passed without relaxation.
