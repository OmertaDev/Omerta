# RC1-04 legacy authority batch and moderator ingress repair

Owner: Codex/source_repairs. Phase: RC1 readiness engineering. This is a
**partial review**, covering 81 explicitly mapped mutation routes: all 42
mounted MOD_KEY mutations, all four separately credentialed RWA reviewer
mutations, and 35 selected account/character/direct inventory surfaces.
It does not clear the 529-route census or all ownership-transfer families.

The [per-route review and evidence index](authority-legacy-review.json) records
each route's entry point, authority/target/cost requirements, replay domain,
actual denial assertions, remaining privileged branches and retained hashes.
Call-site references are distinguished from executed proof. Privileged economic
branches are marked **MISSING_PRIVILEGED_BRANCH_PROOF** even when their common
credential boundary passed. External signer/provider/Safe paths were disabled.

## Resolved finding: RC1-04-LEGACY-01

**Medium: moderator authentication and rate limiting ran after JSON parsing.**
At `f6ab61a53c5692eba3282cb0bc6f32a6988d0424`, an unauthenticated
1,048,677-byte malformed JSON body reached the special 48 MiB drop-loader
parser and returned a JSON parse error. The normal moderator endpoint returned
413 for the same body. After a small request exhausted a one-token moderator
rate budget, the malformed large body still returned a parse error rather than
429. No audit row or privileged game mutation occurred. This proves unintended
pre-authentication parser/resource access; it does not measure denial-of-service
capacity or demonstrate availability loss.

Commit `baea17e331cb5a0c39ebd3accdda15814af24a56` authenticates mounted
`authKind=modAuth` mutations in `onRequest`, ahead of parsing. A private request
Symbol prevents the retained named `preHandler` from repeating authentication,
rate consumption or audit. Route metadata and authorized body limits remain.
The moderator route outside `/v1/mod` is covered by metadata rather than a URL
prefix assumption. Authorized malformed attempts now receive one audit entry;
invalid credentials and rate rejections receive none.

The native retest passes nine assertions: unauthorized large/malformed requests
return401, exhaustion returns429 before parsing, authorized >1 MiB valid JSON
still loads, two authorized requests consume exactly two tokens and two audit
rows, the third is429, authorized malformed JSON remains400, and the normal
authorized body limit remains413. All42 moderator mutation IDs match the prior
census. The original input generator, request/response evidence and runtime hash
remain under `output/mod-ingress-probe.mjs` and
`output/source-reconciliation/mod-ingress-before.*`.

## Executed evidence

The first four rows used clean source
`539c869a8e0b8ff6d2e513d5749efb0dfc6189a3`; the reviewer supplement used clean
`0a5b84518410cfc86ce969fe7f3173b5f7d96e36`. The runtime and dependency files are
identical between those revisions. All commands exited0 on Node24.19.0.

| Command after `node` | Result and limit |
| --- | --- |
| `test/rc1-legacy-authority-postgres.js` | PASS_SCOPED,370 denials,77 route mappings,368 application tables compared. Native PostgreSQL18.4. |
| `test/rc1-mod-ingress-postgres.js` | PASS_SCOPED,9 ingress cases and42 unchanged mounted moderator IDs. Native PostgreSQL18.4. |
| `test/auth.js` and `test/security.js` | Existing suites pass with pg-mem. Includes provider/account binding, token revocation, audit, names, escrow and key/body binding. Not native transaction proof. |
| `test/hardening.js` | Existing suite passes with pg-mem. Exact reused assertions include confiscation125–138 and browser-cookie/PKCE callback896–988 with mocked provider. |
| `test/rc1-reviewer-authority-postgres.js` | PASS_SCOPED,28 denials across4 routes,all369 tables compared,correct distinct reviewer credential reaches queue and latches configured identity. Native PostgreSQL18.4. |

The native commands require `COORDINATION_TEST_DATABASE_URL`. Their optional
output variables are `RC1_LEGACY_AUTHORITY_OUTPUT`, `RC1_MOD_INGRESS_OUTPUT`, and
`RC1_REVIEWER_AUTHORITY_OUTPUT`; each refuses to overwrite existing results.
Runs used private schemas in the explicit loopback database
`postgres://postgres@127.0.0.1:55441/rc1_golden_browser_0359`. Evidence is retained
under `output/rc1-legacy-frozen-1/`, `output/rc1-mod-ingress-frozen-1/`,
`output/rc1-reviewer-frozen-1/`, and the indexed source-reconciliation logs.
Raw snapshots, results, source/test/lockfile hashes and log hashes are indexed
in the JSON review. They are local ignored evidence requiring final custody;
the index alone is not a verifier or a public artifact upload.

Every moderator route rejects anonymous, new-account, ordinary, forged-admin
JWT, wrong-key and cookie-only callers. Every reviewer mutation separately
rejects those credential substitutions, including the correct MOD_KEY. Selected
ownership routes reject known foreign cars/listings/items/vouchers, missing
inventory, self-purchase, unaffordable/capped quantities, invalid entitlement,
injected IDs, prototype-pollution JSON and oversized bodies. Additional local
rate checks verify429 plus Retry-After with unchanged authority.

Positive controls prove caller binding for wallet challenges, new characters
and inventory listings despite supplied foreign IDs; server listing price wins
over supplied price; item custody moves only to the current character; exact
exchange-buy and custody retries preserve state. A changed body under the same
exchange key returns422. Authorized revoke invalidates a live token. Moderator
routes intentionally bypass player HTTP idempotency: repeating revoke under
the same key increments twice. This is recorded explicitly and is not an
exactly-once administrative-effect claim.

## Fixtures, retained failures and remaining work

The legacy fixture declares funded characters, initial assets and one foreign
unsigned voucher. Canonical services/API calls establish authored materials,
listings and an assignable item before measurement. A pre-baseline future
`last_accrued_at` checkpoint isolates action effects from `withCharacter`'s
intentional independently committed clock settlement. No post-baseline SQL
balance/status rewrites or state-value normalization hide economic changes.
One native MVCC query reads every table and sorts rows/table names. Only the
legacy HTTP `idempotency` cache is excluded; reviewer denials exclude no tables.
Sequences and external service state are outside the comparison.

Development failures are retained, not rewritten: wrong import/setup policy;
wrong barter receipt shape; nondeterministic UNION table order; normal clock
accrual; a negative inventory probe that actually had sufficient default ammo;
and an empty allocation fixture correctly rejected by the loader. Their
corrections change fixture expectations/comparison order, not game authority.
The inventory probe now exceeds actual holdings and has a positive caller-bound
listing counterpart. Final clean runs include those corrections.

Remaining scope includes privileged financial/domain branches, real configured
chain/provider/wallet flows, all authored exchange definitions, concurrent and
restart permutations for these legacy routes, auction/consignment and vendor
asset/boat/gun sale families, full browser DOM XSS/CSRF behavior, and every route
outside the enumerated81. Existing native Knowledge/revocation tests remain
mapped separately in [the command matrix](authority-command-matrix.md).
The shared server change requires integrated security, recovery and CI retests
and reassessment of retained mobile/end-to-end evidence at the final revision.
