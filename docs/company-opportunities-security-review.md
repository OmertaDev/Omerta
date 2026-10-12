# Company opportunities security review

Date: 2026-10-12. Phase: source integration candidate; financial activation remains OFF.
Reviewed executable/test/schema source: `72910ce24756276db6862e024e0fe1bd603a09f4`, clean source commit, based on `2ba42a8282cefd3e0f6357b7ad334946ec983b30`.
Scope: new `src/companyopportunities.js`, `src/routes/companyopportunities.js`, their two tests, and appended `company_opportunity_*` tables/indexes only. Included read dependencies: existing public Depot, warehouse, tender and employment boards; market-order visibility projection and reservation aggregation. Excluded: coordinator server/worker/gateway/census/invariant integration, generated knowledge graph, live deployment, external messages/providers and financial activation.

## Model and source classes

Both authenticated human and agent sessions act as the same game account. A subscription is an account preference with expected revision, enabled flag, a unique list of closed opportunity kinds, and explicit catalog district/good or null filters. It gives no capital, employment acceptance, trade, invitation or execution authority. An account's replacement living character may use this informational preference; there is no inherited financial grant.

The subscription and notice tables are **informational preference/projection records**. Neither belongs in a monetary conservation bucket. They store no account cash, business treasury, escrow liability, provider credential or signer authority. Read-only source classifications:

| Kind | Visibility and deliberately limited content |
| --- | --- |
| depot | Canonical public stocked/live-owner Depot board; stock and sale unit price |
| warehouse | Canonical public available warehouse offers; advertised quantity, tariff, revision and term |
| delivery | Public live market procurement orders whose seller character exists; available wanted quantity, district, good, unit price and expiry; accepted private delivery commitments are never copied |
| tender | Canonical public tender board; quantity, unit price and public close time; construct a fresh projection and strip owner bids, ownOffer, spending limits and award/private finance metadata |
| employment | Canonical public employment offers, requiring an open job, living employer, open owned Depot and published company profile; slots, wage, accepted session kinds and expiry; no profile identity, escrow or assignment/invitation details |

District lookups occur only for already visible tender/employment Depot references. No caller supplies URLs, SQL, DSL or source adapters. Quotes remain informational; the existing canonical gameplay APIs revalidate any action against their current locked terms.

## Bounds, replay and failures

The canonical source boards return at most 100 offers per kind (employment at most 50); the dedicated procurement query limits 100 and avoids the unbounded auxiliary collections of `marketBoard`. There are at most five kinds, 20 notice insertions/changes per refresh, 100 notice rows per account, 50 rows per page plus one pagination sentinel, and 25 due account candidates. Existing canonical source helpers retain their own internal custody/capacity/offer scans; this review bounds returned sources and our call counts, not the cost of all historical rows inside those existing dependencies.

One notice records the latest hash/quote for each account, kind and source ID. Content hashes include only normalized public quote fields and stable timestamps, never observation clocks or private fields. Refresh under the character→subscription→notice lock sequence deduplicates an identical current hash, preserving acknowledgment. A changed quote updates that record and resets acknowledgment. Acknowledgment must name the current hash, so a stale client cannot acknowledge a newly changed quote. No append-only event archive or claim of all-time hash suppression is made. With a full inbox, refresh retires only an acknowledged source missing from the current subscribed window; otherwise it reports `inboxFull`. A source returning after such retirement can create a new notice.

The caller must own a transaction and canonical character lock through `G.withCharacter`. Concurrent operations on one account serialize at that character and subscription. Notice updates and the next-refresh timestamp commit atomically. Refresh scheduling advances five minutes; authenticated manual refresh is permitted. The finite due helper is a snapshot, not a worker implementation; coordinator code must re-enter through `G.withCharacter` for the returned account.

Inbox reads recheck public visibility and current filters. A matching hash is `observed`; a different current hash is `changed` with no stale quote; an absent source is `not_observed` with no quote. Absence from a bounded window does not assert closure or revocation. A known captured deadline that has elapsed is `expired`. Publication withdrawal or subscription disable immediately redacts cached quote contents at read time. Reads use a current bounded snapshot, not a promise of atomic quotes or an authorization to execute them.

## Methods, findings and triage

Adapted all three methods pinned by `omerta-contracts/SECURITY-REVIEW-POLICY.md`: Trail of Bits trust-boundary/caller mapping, specification comparison and property/invariant tests; Pashov access-control, replay, configuration and boundary execution traces; Plamen protocol visibility/state-transition and verified failure hypotheses. This is a native JavaScript/PostgreSQL adaptation; no claim that upstream orchestration or Solidity tooling ran.

- Access-control/visibility pass: every route authenticates; all subscription, inbox and acknowledgment persistence predicates bind the authenticated account; public projection allowlists strip richer private tender data; publication withdrawal is rechecked before quote display.
- State/replay pass: current-hash dedup, stale acknowledgment rejection, optimistic subscription revision, bounded notice retention and pagination; native concurrent writers and injected rollback prove persistence behavior.
- Boundary pass: reject unknown fields, kinds, catalog filters, duplicate kinds, invalid scalar pagination, arbitrary source URLs and non-object refresh bodies. Cap tests execute 120 public order sources while proving returned source, emission, inbox and page bounds.
- Static diagnostics: Node syntax checks and `git diff --check` pass, without actionable findings. Manual SQL triage: only fixed parameterized SQL; no untrusted interpolation. Source inspections follow the canonical board callees rather than assuming their names prove visibility.
- Inapplicable: funds accounting transitions, EVM callbacks/reentrancy, signers, external providers and messaging delivery; this node introduces none. Existing monetary APIs are excluded from the informational execution surface.

OPP-001 (resolved design lead): reading a canonical tender view by spreading it could persist private owner/own bids and spending limits. Correction: build a minimal public quote with explicit fields. Retest excludes seeded private bid ID and value, private spend fields and award metadata.

OPP-002 (resolved visibility lead): a dedicated procurement query must retain the public market board's seller-character existence join. Correction: add that join and retain only public order columns, bounded reservations and unexpired live orders. No private commitment projections are loaded.

OPP-003 (resolved boundary lead): scalar coercion or an empty array could bypass closed pagination/refresh shapes. Correction: explicitly validate scalar query values and reject non-object refresh bodies. Memory and route retests pass.

Harness correction: minimal character fixtures initially omitted required `season`. The fixture now supplies season 1; no runtime/schema change was made for this failure.

## Executed evidence and conclusion

Ignored retained package: `output/company-opportunity-20261012/`, including `source-revision.log`, `source-hashes.log`, `memory-final.log`, `routes-final.log`, `static-final.log`, `native-probe.log` and `native-final.log`. Node `v24.19.0`. Native PostgreSQL `18.4`, role `pilot_runner`, loopback port `35439`, verified read-only before creating the fresh owned `company_opportunity_test_6c634851816e908c` database. Native tests use explicitly staged `COMPANY_OPPORTUNITY_TEST_DATABASE_URL`, require the local owned-name prefix and overwrite any ambient `DATABASE_URL`; memory tests discard ambient `DATABASE_URL`.

Commands, exit 0: `node test/companyopportunities.js`; `node test/companyopportunities-api.js`; `node test/companyopportunities.js --postgres`; Node syntax checks of both new source files; `git diff --check`. Memory/native suites verify opt-in, exact filters, account privacy, unpublished and withdrawn employment visibility, stripping seeded private tender values, real clock expiry, disappearance without false closure, hash replay/acknowledgment, changed quote rejection, 120-source bounds and unchanged character cash/bank. Native additionally proves concurrent refresh dedup, same-revision subscription exclusion and rollback of already changed notices when the final scheduling write fails. Source hashes identify the retained reviewed files.

No confirmed high/critical finding remains in this reviewed core. Ready for coordinator integration, conditional on authenticated HTTP/gateway/schema metadata, finite worker scheduling and integrated release checks at the final merged revision. Capacity pressure and bounded-window absence are exposed honestly; notices provide no delivery guarantee or all-time archive. This review authorizes neither external messaging nor financial activation or deployment.
