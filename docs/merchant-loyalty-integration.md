# Merchant loyalty programs

This component lets a merchant offer a bounded discount on a real consignment purchase after a customer has paid for two to five different tools from that same original merchant. Both ordinary authenticated humans and agents use the same actions.

The buyer pays less and the merchant receives less. The host receives the original listing's floor-rounded contractual fee. There are no loyalty points, credits, cash grants, withdrawable balances, external purchases or new payment dependencies.

Programs fix their original merchant, required prior purchases, discount rate (at most 20%), per-sale cash cap, maximum uses (at most 20) and expiry (at most one day). Each original customer can redeem once per program. A merchant may close a program before a purchase. A quote reserves no money or inventory; purchase still requires the active program, genuine parties, available cash, inventory and an unexpired quote. A quote lasts at most 60 seconds and cannot outlive its program or listing.

Customers nominate the exact prior sale IDs from their receipts. The server verifies actual N01 source/receipt/request/item-guard/release/transfer/three-cash-leg witnesses. Qualifying tools must be distinct UIDs still held by that original customer, with the original purchase as their latest title transfer and no live return right. Discounted purchases do not qualify as new ordinary purchase history. Transferring a qualifying tool away and back does not create repeat credit. Previously earned sale history survives later legitimate transfers, returns and estates.

The component exposes create/close/quote/buy and an authenticated board at `/v1/items/merchant-loyalty`. The board exposes public program terms and only the requester's quotes; it does not expose qualifying purchase IDs, private original-character IDs or private sale proofs.

## Coordinator integration

The owned files deliberately fail closed on fresh writes until canonical N01 exports `consignmentEconomyListing`, `consignmentEconomySaleWitness`, `buyConsignmentWithEconomyContext` and `assertFreshConsignmentSaleProof`. An off-repository prototype composes those fixed leaves and the N10 witness adapter; it is not a release.

The N01 leaf accepts opaque module-minted contexts, never caller pricing, executable callbacks or caller-installed resolvers. The loyalty context binds the exact branded Items transaction, original buyer, program, quote, listing source, trusted amounts and fresh reservation. A historical receipt or replay cannot become a fresh proof. The immutable discounted sale adds only a five-field `loyalty` attestation. Ordinary sales retain their exact old receipt, settlement, replay and hash shape.

N10 must call the same full canonical historical sale witness and use its `sellerPaid` as the return limit. It must retain its original funds, irrevocable acceptance, original-party estate and same-UID return rules. A 101-cash listing at a 10% host fee and 10% loyalty discount debits the buyer 91, credits the merchant 81 and the host 10; a merchant-funded return may promise at most 81.

Install exactly the three DDL blocks and two consumed-use indexes exported by `src/merchantloyalty-schema.js` through the coordinator's canonical schema and native catalog work. The component reserves no cash or UID and adds no estate counterpart roots or cash DELTAs. Death does not grant heirs authority over an old program or transfer old-character repeat history. Exact account/key/body acknowledgments retain their old receipt recovery rights.

The coordinator owns canonical registration, closed gateway action/response schemas, agent discovery, shared hooks, census, graph whole-module source pins, test and CI wiring, catalogs, full-server integration, independent review, native concurrency and release. Native component tests require a fresh strictly guarded `merchant_loyalty_test_` database; they do not create a database or start PostgreSQL.

The component tests cover genuine canonical gameplay, JWT parity/privacy/contracts, missing-capability denial, 14 actual accounting boundary cases, a real elapsed 60-second expiry, source/journal/ownership tampering, caught/late rollback, normalized funded returns and actual sorted-original estates. Memory evidence does not qualify PostgreSQL locks, races, all-world estate rollback, deployment or activation. Financial activation remains disabled.
