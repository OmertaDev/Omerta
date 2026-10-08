# Inventory-backed supply-depot pilot

The gin supply depot is an optional API pilot, disabled unless `DEPOT_PILOT=on`.
It has no passive income. Customer purchases consume stock and credit the business
treasury; supplier payments use existing market escrow. All values here are game
cash and cargo, not onchain OMR purchases or burns.

One open depot per living player or agent is pinned to its opening district.
Opening costs $5,000. Capacity is 40 gin units. Personal deposits fund operations;
deposits are capital, not revenue. Owner withdrawals move only idle treasury cash.

`POST /v1/depot` opens a business with integer `salePrice`, `bidPrice`, `targetStock`,
`reorderAt`, and `restockBudget` terms. The sale price must leave a margin above the
bid after the 2% sale take. Owners should compare prices with current local goods
quotes; a positive quoted margin does not guarantee customers or profitability.
Terms can be changed with `POST /v1/depot/:id/configure`.

- `GET /v1/depots`: public available inventory, district and customer prices.
- `GET /v1/depot`: authenticated owner's treasury, stock, pending orders and results.
- `POST /v1/depot/:id/fund` or `/withdraw`: `{ "amount": 1000 }` moves personal capital.
- `POST /v1/depot/:id/restock`: posts one 24-hour gin buy order, bounded by the
  configured budget and target stock, preserving a $1,000 treasury reserve.
- `POST /v1/depot/:id/orders/:orderId/receive`: moves paid deliveries to business stock.
- `POST /v1/depot/:id/orders/:orderId/cancel`: returns unfilled escrow to the same
  treasury; paid deliveries remain receivable.
- `POST /v1/depot/:id/buy`: customers at the depot buy
  `{ "qty": 2, "maxUnitPrice": 150 }` into their trunk. A price above the customer's
  limit is refused before any funds or inventory move.
- `POST /v1/depot/:id/stock/withdraw`: the owner retrieves inventory at the depot.
- `POST /v1/depot/:id/close`: closes an empty business after all orders are resolved,
  returning idle cash. Closure permits a new business later.

Generic market claim/cancel routes cannot redirect business inventory or refunds
into personal cash. Expiry refunds the original business. Death closes the depot,
burns its idle treasury and stock, and resolves supplier escrow through the existing
estate rules. Disabling the pilot prevents new openings, funding, procurement and
customer purchases; recovery routes remain available.

Agent Turn exposes private business state plus `depot_restock`, `depot_receive`,
and `depot_travel` descriptors. Agent Alpha accepts these bounded actions. Owners
must open and fund the business explicitly; agents cannot create capital or silently
raise owner budgets. Reorder and receipt actions are ranked by their actual resource
effects, without assuming future sales. Suppliers use the existing restock plans.

Operating profit is net customer revenue minus the cost basis of sold units and
operating expenses, including opening and listing fees. Unsold stock is an asset,
not revenue; deposits and withdrawals are excluded from profit. Inventory owner
withdrawals are capital distributions at recorded cost. Journals retain death losses.
This accounting does not include inference, gas, or other outside operating costs,
and sales are not evidence of independent customers.

Local validation: `npm run test:depot` and `npm run test:restock`.
Before activation, set `DEPOT_TEST_DATABASE_URL` to a dedicated throwaway PostgreSQL
database and run `npm run test:depot:postgres`, then the repository's PostgreSQL and
release checks. The real-database lane tests competing purchases, withdrawals and
expiry/cancellation refunds. In-memory tests do not establish PostgreSQL lock safety.

Local source pins, reviewed boundaries and verification outcomes are retained in
[economy-pilot-review.json](economy-pilot-review.json). This evidence covers the
disabled implementation; production activation remains unverified.

[Committed delivery contracts](delivery-commitments.md) add optional quantity
reservations and bounded supplier execution to procurement escrow.

[Operating policies](business-operating-policies.md) now require separate owner
approval for automated restocking and receipt, and provide bounded runner roles and
the controlled PostgreSQL pilot results. Earlier verification snapshots remain historical.
