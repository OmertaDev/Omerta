# Canonical company acquisition seam

Source base: `1377a4483289705ec5f26047240cee0a17042023`. Depot has canonical opening, configuration, funding, withdrawal, procurement, inventory receipt, purchases and closure, but no ownership transfer export. `own()` locks an open Depot belonging to the acting character. `openDepot` enforces one open Depot per character, backed by the unique partial owner index. `closeDepotsAtDeath` closes/burns the deceased owner's business; it does not give the heir an operating business. Overwriting `owner_character` in this feature would invent unsupported authority. This component therefore supplies no such SQL and refuses every acquisition route requiring settlement eligibility when no canonical registrar is supplied.

The coordinator must register `canonicalAcquisition` with exactly:

```js
{
  kind: 'canonical_depot_acquisition_v1',
  assertEligible: async ({client, depot, seller, buyer}) => ({
    kind: 'canonical_depot_acquisition_v1', eligible: true, sourceHash
  }),
  settle: async ({client, helpers, depot, seller, buyer,
    acquisitionId, price, termsHash, acceptedAt, expiresAt}) => ({
    kind: 'canonical_depot_acquisition_v1', payJournal, receiveJournal
  })
}
```

This is trusted server registration, never request data. `assertEligible` must be side-effect free, acquire the closed existing source locks after sorted actor/account → owned Depot → current operating policy and before the acquisition row, and return a hash of all canonical eligibility bindings. Repeated calls must reread already locked sources, never acquire a new differently ordered source lock. It must fail on unsupported, old, foreign, reserved or unsettled sources. Narrow initial support should refuse outstanding market orders and filled-but-unreceived inventory, delivery commitments, warehouse occupancy/custody, loans/financed receipts, franchise/supply/workflow/operator obligations, financed procurement and any other live canonical claim. Enumerate actual source tables/functions in the integrated seam review; the component's fixture does not prove those conditions. Buyer must be alive, active, distinct and have no open Depot. Ordinary Depot pilot, mobility and district restrictions must be applied canonically, with no invented override.

The seller creates the hash-pinned one-hour-maximum offer using current original-owner authority; an owner agent passes the existing `guardDelegatedControl`. The original buyer separately accepts the exact price and immutable deadline/source/party terms. `maxPrice` must equal that price: it authorizes one specifically identified acquisition payment, not generic owner actions. Only the original seller executes, authenticated afresh with the current delegated-control guard, while both original actors/accounts remain alive and active. Neither F13 nor F14 is an acquisition grant. Expiry, changed ownership/assets/policy/source proof or current cash insufficiency rejects. Heirs receive historical receipts only, never fresh consent or a business takeover.

`settle` must perform one atomic canonical transfer under the same `G.withTwoCharacters` transaction and already acquired locks. Revalidate freshness and the exact accepted terms immediately before effects. Debit the buyer's real pocket by price and credit the seller's pocket equally using actual canonical ledger IDs, reasons `company_acquisition:pay` and `company_acquisition:receive`, currency `cash`, original character IDs and counterparty acquisition ID. There is no Depot treasury debit, escrow mint, fee, share or outside payment. Canonical ownership changes exactly once, preserving every Depot field except its owner. Existing G character persistence must receive those actual cash deltas. Source IDs and paired payment rows must not be reusable for another purchase.

Retire all original seller operating grants and any F13/F14 metadata associated with the sold Depot in the same transaction, with no partner cash writes, principal refunds or fictitious dividends. F13 at-risk capital remains actual Depot capital; retirement does not create wealth for seller, partner or heir. If an outstanding claim cannot be retired legally under its original consent without another participant lock, refuse that acquisition until supported. Do not copy seller company/account identity, agent policy, consent, franchises, loans or independent premises rights. A new owner needs new grants. Metadata retirement alone cannot resolve a funded obligation.

The component validates the actual post-transfer owner, exact unchanged custody/configuration, original actors' paired cash deltas, exactly two matching canonical receipt rows, no enabled old policy, terminal old F13 agreements and retired F14 metadata. It then records the receipt and historical original-account request ACK. Failure after any effect must roll the entire transaction back; no memory rollback claim substitutes for native proof. The seam must additionally export its accounting/binding invariant and be proven through actual integrated JWT routes, canonical purchases/withdrawal, original-party estates, late failures, simultaneous accept/execute, lock-wait expiry/source drift, debt/custody refusal, replay and money conservation before release.

Coordinator integration: two exported metadata tables, authenticated route registrar, exact discovery descriptors, canonical transfer seam and retirement hooks, estate `retireAcquisitionsAtDeath(client, victimId)` after death, mandatory native/API CI and source/catalog registration. This document proposes that bounded seam; it does not claim it exists or that any company was acquired. F13/F14 and parent graph release prerequisites remain explicit. No external finance or customer messages are introduced.
