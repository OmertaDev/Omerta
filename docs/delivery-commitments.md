# Committed depot deliveries

New acceptance is disabled unless `DELIVERY_CONTRACTS=on`; depot intake has its
separate `DEPOT_PILOT` gate. Already-accepted work remains procureable and settleable
when acceptance is disabled. All values are game cash and cargo, not onchain OMR.

Acceptance reserves quantity inside existing depot order escrow. It captures the
good, district, unit price, fee rate, quantity, buyer, supplier, deadline and spending
cap. It creates no new money or second cash claim. Open fills see only unreserved
quantity. Buyers cannot cancel an order with live accepted quantities, and idle
treasury withdrawals cannot touch its escrow.

Limits: 1–40 units, 60 seconds–6 hours, and 1–100,000 game cash per commitment.
Each supplier can hold at most two active commitments and 40 outstanding units.
The order must remain funded through the deadline. Suppliers cannot voluntarily
release an accepted quantity early. No collateral or failure compensation is added.

## API

- `GET /v1/deliveries`: authenticated buyer/supplier obligations plus up to 100 recent
  terminal records. Active obligations are never hidden by the history limit.
- `POST /v1/market/:id/accept-delivery`:
  `{ "qty": 3, "unitPrice": 123, "deadlineSeconds": 3600, "maxProcurementCash": 1000 }`.
  The price must match and the quantity must still be available.
- `POST /v1/deliveries/:id/deliver`: `{ "qty": 1 }`. Actual cargo moves to the order
  warehouse and the supplier is paid from its escrow in the same transaction.
- `POST /v1/deliveries/:id/expire`: either party closes an elapsed commitment without
  payment. A passed deadline also removes the reservation from fill/cancel capacity
  before this status update. Funds stay in the original order until its ordinary
  fill, cancellation or expiry.

Use fresh idempotency keys per logical mutation and the exact same key/body after
ambiguous responses. Terminal commitments refuse another settlement. Cumulative
fee rounding makes the final net payout identical across partial deliveries.
Changes to future depot bids cannot reprice accepted work.

Agent Turn offers acceptance before procurement, then contract-specific purchase,
travel and settlement actions with matching plans. The canonical executor records
purchase and travel costs against the cumulative cap and preserves the supplier's
$1,000 personal reserve. Over-budget steps are refused. Existing goods can be
delivered directly. Ordinary player purchases outside the contract executor are
outside this cap; inference and gas are not included.

## Default, death and release gates

Missing a deadline releases the unfulfilled reservation with no payout. Death
remains an explicit game-risk exception: supplier death releases remaining quantity;
buyer death terminates commitments and resolves escrow through existing estate
rules. Records retain original identities and terminal outcomes. The guarantee is
against ordinary cancellation, not death or supplier default.

`npm run test:delivery` covers reservations, ownership, fixed partial payouts, retries,
price changes, budgets, deadlines, disabled-intake fulfillment, the canonical agent
sequence, death and exact cross-domain custody. The normal npm test script includes it.

For real concurrency, set `DELIVERY_TEST_DATABASE_URL` to a dedicated throwaway
PostgreSQL database and run `npm run test:delivery:postgres`. Additional races test
competing reservations and final settlement under distinct logical keys. Isolated
PostgreSQL verification has now passed, including buyer death racing settlement.
See [operating policies and pilot results](business-operating-policies.md) for the
current verification phase and remaining broader release failures. Production
activation remains off.

Source pins and local outcomes are retained in
[delivery-commitments-review.json](delivery-commitments-review.json). The earlier
depot review remains evidence for its earlier working-tree snapshot.
