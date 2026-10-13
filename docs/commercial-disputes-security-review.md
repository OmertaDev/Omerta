# Commercial disputes: component review and integration contract

Reviewed source: `07fbca688da3f7e997fb5969c22d26e51b45eb35`, clean source tree, based on coordinator runtime `69cd5395eed906ab6eca5b994419975d4105af22`. Phase: isolated component qualification, not shared-route release or financial activation. Files: `src/commercialdisputes.js`, `src/routes/commercialdisputes.js`, `test/commercialdisputes.js`. Included callees: canonical Delivery expiry, Depot cancellation/bookkeeping, game cash ledger, Items transaction ownership/compensation, actual registered F10 auction award and ordinary estate. Exact file hashes are retained with proof logs.

## Bounded effect and authority

This is a consensual overdue, unstarted GIN delivery unwind. It supports only one full, sole, accepted commitment with zero procurement spend, zero delivered stock, no financing request history, an original open buyer-owned Depot, and its still-live funded order. The genuine canonical delivery deadline must have elapsed. It cannot terminate a delivery early, arbitrate damages, reward a supplier, refund the listing fee, or redirect money.

The original buyer or supplier proposes an exact canonical quote. Both current living original actors must consent to that quote before settlement. A proposal alone does not freeze gameplay. An agreement freezes supported alternative paths for at most 600 seconds; either original actor can withdraw without moving funds. Three active cases per account, one active case per order, bounded source reads and a 20-row private history board keep work finite. Heirs can replay exact historical acknowledgments but cannot consent or settle for deceased originals. Existing buyer delegation restrictions remain enforced on opening and buyer consent.

Settlement executes the unchanged `expireCommitment` and `cancelDepotOrder`. Only the currently backed order escrow returns to the original Depot treasury. Its exact `restock_refund` journal and NULL-character `market:refund` transaction are verified. Supplier compensation and listing-fee refund are zero. Depot title, stock, stock cost and policy spend remain unchanged. Original personal balances remain unchanged, verified by tests and existing global cash/GIN books. No new ledger bucket, cash mint, custody transfer, provider, key or external message exists.

Lock order is branded Items root → sorted original characters → sorted accounts → Depot → order → policy → commitment → case. Pending request reservation contains no early character/account FK; completed history receives those references after owner locks. Account-salted immutable request body hashes reserve before eligibility and replay before fresh authority checks. Fresh database clocks after source/case locks and after canonical refund prevent stale-wait settlement. Canonical source identity, original terms, backing/fee journal IDs, current policy terms and the finite quote hash are revalidated.

Native rollback uses the actual PostgreSQL transaction. Memory rollback uses the existing Items compensation contract: restore only original commitment status/order quantity/status/Depot treasury and remove only the exact newly-created refund journal and ledger transaction. The narrow fallback journal lookup is bounded to two rows with the original order/Depot/reason and exact neutral-column amount checks; ambiguity fails recovery. Guarded leaves poison the owning transaction even when a caller catches their error. No generic undo or table deletion exists.

## Required coordinator integration

1. Append the exact two-table/index `commercialDisputeDDL` exported by the module to shared schema and the frozen migration catalog. Source order and commitment references deliberately remain plain immutable text because ordinary estate deletes volatile orders. Completed account/actor and Depot history retain canonical FKs. No additional cash table or reason is required.
2. Register the authenticated route module with `{pool, auth, workflowGuard: assertCommercialDisputeAccess}`. Closed routes are GET `/v1/company/disputes` and POST `/open`, `/consent`, `/settle`, `/withdraw` beneath that base. Each write owns `withItemTransaction`; normal human and agent JWTs use the same account scope. POST requires an exact idempotency key and closed body. Open requires `consent:true`; consent action explicitly signs the original `disputeId`, `expectedRevision`, `quoteHash`.
3. Inject the actual guard after canonical order locks, before mutations, into Delivery accept/procure/travel/deliver/expire; Market fill/cancel; Depot cancel/receive; and corresponding execution adapters. Context is `{orderId, commitmentId?, action}` with a server-fixed action. The private recovery scope permits only this module's exact original `expire` and `cancel_order` sequence. Callers cannot create that scope. Do not accept an action name from request bodies.
4. Canonical death/estate recovery must bypass the consensual freeze using its fixed trusted `estate` context. Invoke `voidCommercialDisputesAtDeath(client, actualVictim)` within the same branded estate root after actual original death and while required actor/account locks are held. It verifies persisted original death/account, closes at most three active metadata cases, moves no cash, and poisons failures. The component fixture executes actual estate followed by a separately branded metadata cleanup; it does **not** prove a shared same-transaction estate bridge.
5. Shared source guards, gateway catalog, public discovery, native CI commands and optional metadata invariant integration remain coordinator-owned. No worker, automatic court or release is claimed here.

Unmodified alternative endpoints do not yet call this component guard. Their protection is a release blocker until the coordinator completes item 3; route-only registration is insufficient. The component registrar fails closed without the actual guard function, but function registration itself is not proof that every existing path invokes it.

## Executed evidence

Commands at the reviewed source:

```text
node --check src/commercialdisputes.js
node --check src/routes/commercialdisputes.js
node --check test/commercialdisputes.js
node test/commercialdisputes.js
COMMERCIAL_DISPUTE_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/commercial_dispute_test_20261013_d node test/commercialdisputes.js --postgres
```

Memory and fresh native PostgreSQL **18.4** PASS. The explicit native guard rejects ambient DATABASE_URL, foreign/unowned URLs and nonempty public schemas; local role/port/version are checked before schema initialization. The approved database was freshly created with an admin version probe. No local PostgreSQL16 or hosted CI claim is made.

Actual registered F10 auction routes create and award the complete funded order. Tests wait the real prospective 60-second canonical deadline, with no positive deadline mutation. Actual server-issued human/agent JWTs authenticate the isolated dispute route component. This is not a claim that the shared server registers F17 yet. Actual canonical direct delivery acceptance supplies the second source. Administrative source-price drift and shortened case expiry are negative-only fixtures.

Proofs cover early refusal; foreign original-party authority rejection; immutable replay and body conflict; unilateral settlement refusal; mutual guard and trusted estate exemption; exact refund journal/transaction conservation; complete rollback after a thrown late fault and a caught poisoned late fault; native concurrent same-key settlement; native held Depot lock crossing case expiry with no refund; source quote/price drift; original delegation restrictions; withdrawal; private foreign board; actual estate volatile-order deletion; historical ACK after death; active supplier death and metadata cleanup; no heir fresh consent/settlement; existing global character cash, market escrow, Depot and delivery cash/GIN invariants. There are no property-fuzzing or upstream pipeline claims.

The initial expanded memory fixture expected `source_changed` after administrative price drift; canonical checks correctly returned `unsupported_source`. The assertion was corrected without weakening rejection or changing runtime behavior. Initial logs, the failed expectation, native expanded PASS and exact-source final retests are retained under ignored `output/commercial-disputes-20261013`, copied outside the managed checkout with SHA256 inventories.

## Adapted security methods and findings

Applied the repository's three pinned methods manually to this bounded JavaScript/SQL component: Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` access/economic execution traces; Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` protocol-specific refund/rollback/state transitions; Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` trust boundaries, specification comparison, static triage and invariants. No whole upstream orchestration, external reviewer or fuzz tool ran.

Static triage retained exact SQL/lock/delete/clock/poison/estate matches. Reviewed deletions are narrowly owned compensation; text source references preserve historical estate replay; estate guard exemption is trusted internal-only, never user supplied; replay is historical and grants no new authority. Added exact persisted refund verification, title/stock/cost/policy-spend checks and persisted original death checks before final qualification. The material remaining finding is shared alternative-path and same-transaction estate integration, explicitly excluded above. Scope excludes prizes, external finance, Solidity/token rails, arbitrary evidence uploads, NPC control and general disputes over completed or partially fulfilled work.
