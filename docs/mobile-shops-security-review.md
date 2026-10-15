# N11 mobile shops — component checkpoint

Base: `fa2f87e8115383ce5e736d4ea0ba497a6a3ca6c9`. Phase: owned component only;
shared integration and native effects are unqualified. No release/activation claim.
Owned source checkpoint: `135a24032d3fd59bd422a2aa736149ed856729ae`.

The initial cargo is actual carried GIN, not a vehicle, UID, warehouse, or lease.
One active shop per original character, 1–10 units, gross at most 1,000,000 game
cash, and a fixed 60–3600-second enrollment inside the canonical one-hour listing.
Existing market floors, fees, trunk capacity, seller proceeds, tax and estate
rules remain authoritative. No extra payment bucket or stall fee exists.

`runMobileShop` uses actual Game single/pair transactions; it does not synthesize
Game contexts. Open invokes Market.listItem; buy invokes Market.buyListing; close
and expire invoke Market.cancelListing. Sale uses genuine ledger-generated IDs,
checks exact canonical cash legs and cargo deltas, and merges the seller's actual
SQL cash delta into its real Game object without losing unsaved accrual. Full
receipt is stored internally. Public projection has original character/listing
handles, quantities, terms and status, without account IDs or journal IDs.

Historical account/body/key-bound replay precedes fresh character/backend
eligibility. No replay grants a new life authority. Current market listing
custody remains the sole stock source. A seller may travel normally: enrolled
sales suspend while away, and can resume only before the fixed deadline.
No relocate action or new vehicle/property permission is introduced.

## Required coordinator seams (not installed)

1. Market exports literal `mobileShopHookRevision='mobile_shop_market_v1'` ONLY
   together with the following real calls. Before goods listing effects, invoke
   `assertMobileShopMarketAdmission(client,{action:'list_good'})`. Before buy's
   seller/source locks, invoke it with `buy_good,listingId`; before cancel locks,
   invoke `cancel_good,listingId`. Linked sources require the exact private
   transaction scope created inside runMobileShop. Unlinked sources are unchanged.
2. After canonical sold/cancelled transitions call retireMobileShopSource with
   `sold`/`cancelled`. It verifies the actual terminal source. Root must route
   enrolled alternate HTTP buy/cancel through the original-source resolver and
   real Game pair/single wrapper; direct alternate calls refuse linked sources.
3. Canonical estate captures the exact affected listing IDs before deletion,
   then calls retireMobileShopSource(...,'estate_scattered',actualEstateScope)
   after deletion. The genuine private estate scope is mandatory. Goods scatter
   under existing policy; no return-to-heir or new cash recovery is introduced.
   Modban and other genuine canonical disposal paths need equivalent exact-source
   metadata retirement; no blanket permission/consent guard may block recovery.
4. Apply only the proposed two-table DDL, registrar and closed DTO wiring. No
   listing FK: estate deletes listings; retained metadata is historical, not
   stock. No extra actor counterpart or custom actor prelocker is required.

Fresh mutations are closed when these hooks are missing. They are also closed
on pg-mem: legacy Market writes cargo, tax, standing and notifications without
registered compensation. A successful pg-mem BEGIN/ROLLBACK cannot demonstrate
cross-book rollback. A real native transactional prototype is required before
claiming actual shop gameplay, concurrent sales, travel interleaving, death,
late-fault rollback, or global cash/GIN invariants. Root currently reserves PG39;
this checkpoint makes no native call and changes no shared source.

## Executed checks and retained failures

Node 24.19.0 on Windows. `node test/mobileshops.js` passes memory term closure,
default refusal without mutations, direct linked-source scope refusal, unrelated
source noninterference, geographic availability, stale quantity refusal, terminal
source check, idempotent terminal metadata and historical account/body replay.
Its manually inserted rows are explicitly administrative read/negative fixtures,
not evidence of acquired goods, real sales, or funded cash.

`node test/mobileshops-api.js` passes component JWT human/agent parity, unauthenticated
refusal, closed query/body/board projection, and fresh-action refusal with no source
or request writes. It is a component Fastify registrar, not root server integration.

Initial DDL execution failed because pg-mem lacks length(text); proposal now uses
already-registered char_length. Initial exact-message assertion failed because
canonical composed reads sanitize exception messages; dedicated error codes now
preserve the precise conflict predicate through that boundary. Both failures are
retained in output/mobile-shops-n11. No runtime workaround or test gate changed.

Manual source tracing covers Game actor locks/persistence, Market goods purchase,
fee/tax/cancellation and estate deletion, and Items transaction/read branding.
Static triage: no external call, provider, signing key, client SQL, dynamic query,
new cash source, or mutable authority string. No automated scanner/fuzzer or
three-method completed security clearance is claimed at this checkpoint. Material
open checks are the four shared seams and actual native effects listed above.
