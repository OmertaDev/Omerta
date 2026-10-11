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

## Private earnings API consumer — 2026-10-10

Scope: API source/routes/contract and existing resourcebusiness suite at6f269dcba93f816ddfe06ce6e102349498e0f8da, composed with reviewed receipt dependency551dcffb and its main/native test wiring. GET /v1/resources/earnings takes account identity from existing auth, not query input. Limit1..100(default50) and bounded afterJobId reject unsupported terms before SQL. Only an existing seller treasury is locked; reads create no treasury, ledger or permission. Accepted seller jobs are read as a bounded keyset page. Global recorded revenue, including any orphan credits, remains separate from matched page transfers. Settled non-simulated and simulated compute costs and pending caps are labeled independently; none verifies invoices or net profit.

Independent API inspection reused the pinned methods above and native evidence. Its seller lock synchronizes normal settlement writers; observation time follows lock. Current buyer freeze status can change and does not authorize cash-out. SQL loads no raw questions/reports or buyer balances, and output omits counterpart identity. HTTP auth/delegate fixtures exercise inherited auth wiring with an injected test seam, not fresh JWT verification. Source JWT/account status/cadence remain the existing shared implementation.

EA1low: initial method classification inferred authored work from a missing call_id. Fixed in6f269dcb by selecting only COALESCE(input->>'fulfillment','compute') and using the customer's contract mode. Legacy accepted jobs with missing compute receipts remain compute; authored fixtures explicitly carry the consent. Historical transfer matching is independent of fulfilled-work quality. Memory/native suites pass after remediation.

Executed Nodev24.19.0: node test/resourcebusiness.js and COORDINATION_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35439/postgres node test/resourcebusiness.js --postgres exit0. Coverage: no-write/empty account, auth and delegated identity, pre-SQL query rejection,100+ pagination, balanced/missing/tampered edges, orphan totals, method distinctions, test/live observations and private output. Native proof holds the seller lock and confirms the read waits for its release before timestamp/observation. No new native storage or execution path; C pure tests remain wired into the existing resourcework chain. Retest outputs retained locally by feature worktree. No provider or financial activation occurred.

Final working-tree SHA256 after EA1: API5a05b49ede4652ed98962e2c886451f37609f937d299708404907e2f2cfb3a0e; API suitefdb9668138562a4647b21c7aa5d6bd44c6e16159aa410ee8a8a1360c37f4fa5a. Route096950fa64686a7ec760c55ea2ddb314c9b173d1cc295efeeec99d4306b3596c and contract4bc8c2c59066aaed58f3acef21f2b1b2f2da8838c517893170da2924c54dae57 unchanged from independent review. Git normalizes line endings. Current route census and both checked public drafts are updated together. Private ledger observation is ready within this scope pending fresh exact-head hosted checks and separate deployment verification; it provides no funding provenance, payout authority or profitability claim.
## PR224 CI gate repair and retest

Hosted run [38080208609](https://github.com/OmertaDev/Omerta/actions/runs/38080208609) failed the unchanged suite inventory guard at test/gates.js:3402: test/earningreceipts.js was imported by resourcework but was not explicitly invoked by an npm script. Both native PostgreSQL lanes passed; full pg-mem success is not claimed for that failed head.

After integrating origin/main (including PR221) in merge commit 09a43211, package.json now invokes node test/earningreceipts.js directly in pretest. The redundant resourcework side-effect import was removed. No test guard, receipt source, economic authority or CI timeout was relaxed. The newly visible script increased the measured npm suite count from 278 to 279; MARKETING-POSTS.md was corrected after the unchanged documentation guard detected that difference.

Local Node v24.19.0 retest: receipt unit/adversarial/privacy tests and 500 conservation pages (seed 0x5eed1234), resourcework, gates, chainparams and playthrough-truth passed. The suite inventory reports all 462 suites run or declared. Documentation and generated knowledge checks are rerun after the count correction and clean authored commit; fresh hosted checks remain required for the repaired exact head. Generated merge conflicts are resolved by rebuilding from that clean source, not by weakening compatibility guards or hand-editing graph content.

## Phone fixture failure and bounded retest

At repaired head d456327995a8fc3e681f730c8db51f9e914d24ff, hosted [run 38084068034](https://github.com/OmertaDev/Omerta/actions/runs/38084068034) failed city-presence-browser.js:465 because no actor marker was visible in the open phone inspector map. Native PostgreSQL, recovery and Forge checks passed for that head; the failed browser lane remains recorded.

The runtime hashes issued actor IDs into traversable world slots and an open inspector can reduce either phone map to 96px. The fixture already closed the 320px inspector for this reason but assumed the 375px inspector contained a marker. This is a fixture precondition defect, not evidence of a gameplay rendering defect. Both phones now close the inspector before selecting an actual visible marker, navigating bounded real roster pages only if the current random page does not intersect the full camera. The marker assertion remains mandatory. A real tap must select that exact actor and increment actorOpening exactly once, with no gameplay POST. The 375px post-tap dock-frame assertion retains actual camera/canvas geometry, visible avatar, reachable controls and resize-on-open coverage. No runtime, authority or economic code changes.

Integrated main including authored-delivery PR223 in 9986b7d9 and its generated-only successor 11af7d8f in 8f832e08. Node v24.19.0 focused City presence browser retest and unchanged gates/docs checks passed; the complete City browser chain (City scene, Fieldwork and City presence) passed with the added post-tap geometry assertion. Receipt tests also passed all 500 conservation pages with seed 0x5eed1234. SPEC census is remeasured from the combined tree, and generated artifacts rebuilt from a clean authored commit. Receipt module and test hashes remain 796891bdf47497355035397e1913ac33ce789a04129c2c46a8ca278ad7a43a3f and ef4f39d26f7bdd4855e66ec21b404f426dcc1677ae0d059a24078774c85570e5 respectively. Fresh exact-head hosted checks remain required.

## Unresolved hosted actor-selection timeout

On 2026-10-11, earnings API head 91db4909214338796f96aff174c8f82860f4e6d9 failed [hosted run 38101082954](https://github.com/OmertaDev/Omerta/actions/runs/38101082954), job 114356975610, at the original 30-second selectedActor wait after the real roster click (inspect -> encounter -> the fresh 375px realm scenario). A similar timeout occurred on delivery head 85c. Neither failure supplies pointer-event or scene-state evidence establishing its cause. The previously corrected cropped-map fixture and this roster-selection timeout are distinct observations.

After integrating current main in 5d4dd61f, an unmodified focused City presence run and a temporary pointer-traced run both passed locally on Node v24.19.0. A third focused run passed with the final diagnostic-only helper. No runtime cause or fix is claimed. The test retains the exact real click, selectedActor predicate and original timeout, without retry. Passive bounded observers retain at most 12 pointer/click events, 16 response/failure statuses, 24 roster IDs and current handle readiness/selection/layout. Only on failure are these appended to the original error before rethrowing that same error; diagnostic failure cannot replace it. Listeners are removed afterward. No tokens, body/report text or arbitrary response payloads are captured.

This instrumentation prepares an exact hosted reproduction and leaves the timeout unresolved pending that evidence. Earnings APIs, authored routes, runtime authority and financial activation remain unchanged. Generated artifacts and hosted validation require a fresh clean-source rebuild before publication.

Reviewer correction: the passive event observer now guards a missing current handle and non-Element event target, and catches getState/observation failures as a bounded unavailable marker. Teardown cannot turn diagnostic observation into a page error. The original click, selection assertion and timeout remain unchanged. The focused browser suite is rerun once after this narrow correction before a clean-source generated rebuild and fresh hosted reproduction.

## City integration refresh — 2026-10-11

Integrated main `1c1300fe` with the separately reviewed City social revision.
Private earnings, resource route, receipt reconciliation and resourcebusiness test
bytes remain identical to reviewed branch source `b3cce295`; no privacy, balance,
permission, native treasury lock or financial activation semantics changed.
Conflicts were limited to shared census/public route counts and generated artifacts.
The combined inventory measures 319 source files, 482 test files, 895 public
registrations (844 under `/v1`), 392 tables and 720 Markdown files.

Node v24.19.0: `node test/docs.js`, `node test/gates.js`,
`node test/resourcebusiness.js` and `node test/city-presence-browser.js` all
returned exit status 0. The focused browser run retained actual selection and
touch/keyboard geometry assertions while the diagnostic observer coexisted with
the current City runtime. A local pass does not invalidate the retained historical
hosted failure or prove its production cause. Native earnings proofs retain their
prior exact source scope; this integration adds no native earnings behavior.
Clean authored-source knowledge regeneration and exact-head hosted checks remain
required before merge or deployment.
