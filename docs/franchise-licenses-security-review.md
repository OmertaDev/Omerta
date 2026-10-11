# Game franchise licence source review

Date: 2026-10-11. Phase: source review and isolated native proofs; exact hosted
revision and production verification remain separate release gates. Domain
source `76b9216005e0d203f7bced466db9688a8e03f530`, canonical sale integration
`27df3ddd`, journal invariants `6416b1fc`, integration
`f6dddbfa6b3a475b94b21bb308b91ea8a77d2329`, domain proof
`a9b1aebd1a0191f4ce04e8f97f546ce4e47135ae` and API proof
`39b75f68d8a92249156a2419e3ff58e2d94fe329`.

Scope: finite, mutually consented brand licences between independently owned
game storefronts. Published company revision and name are immutable snapshots;
the gin_storefront preset grants no executable policy or arbitrary code. Fixed
royalty terms are capped at ten percent, one million game cash and thirty days.
Existing owner-control guards apply to offers, acceptance and ending. Licences
neither transfer ownership nor create new spending grants, principal or escrow.

Only actual canonical customer sale proceeds after the market fee bear royalty.
Funding, rentals, procurement, transfers and royalty income are excluded. The
canonical sale journal remains unchanged. Cumulative integer rounding produces
paired operator expense and recipient income entries, including zero pairs;
replays cannot charge twice. Operating profit counts each expense and income
once. Journal reconciliation binds both entries to original parties, one sale,
the licence and earned/paid counters. Historical receipts survive character death;
heirs acquire no licence authority. Dead or closed businesses receive no new fee.

Both storefront rows lock in sorted order before mutation and delivery commitment
locks. Settlement refreshes already locked rows after the absolute sale write;
it cannot overwrite current inventory or treasury with a stale prepare snapshot.
Only opaque client-bound contexts and the freshly returned canonical journal ID
reach settlement. Public requests accept no context or source-journal authority.

Memory and PostgreSQL 18.4 proofs passed: consent, caps, cumulative small-sale
rounding, zero-pair replay, lifecycle cutoff, inventory/treasury preservation,
concurrent replay and acceptance, complete journal-failure rollback, and actual
invariant tampering with restored clean state. Authenticated human/agent API
proofs cover privacy, current-heir isolation, owner-policy negatives, exact
retries, ending and profit counted once. Test balances are isolated game fixtures.

Finding FRANCHISE-API-1: original route `832e3bec` forwarded the target storefront
ID as a sixth field to the strict five-field royalty-term validator. A valid
authenticated offer returned 400. Repair `34d795b3` separates target selection
from immutable domain terms; the same actual HTTP assertion passes. No native
authority guard was weakened. Frozen sixteen-constraint and sixteen-not-null
migration additions passed native definition and causal checks.

Repository security policy review focused on consent, accounting, replay,
rounding and lock ordering. Exact source inverses reconstruct complete preceding
Crew, warehouse and tender files and preserve historical qualification limits;
those reviews do not qualify this new feature. No outside earnings, crypto
backing, real payment, compute purchase or financial activation is asserted.
