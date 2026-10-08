# Owner-authorized business operations

Opening or funding a depot no longer implicitly enables automation. The owner
authorizes duties using a separate non-agent owner session. The saved agent key
cannot grant, renew or raise its own authority. This is a credential boundary,
not a claim that the server verifies human presence.

`POST /v1/depot/:id/policy` requires:

```json
{
  "expectedRevision": 0,
  "enabled": true,
  "allowRestock": true,
  "allowReceive": true,
  "businessPriority": true,
  "maxSpend": 3636,
  "reserveCash": 1500,
  "expiresInSeconds": 3600
}
```

The approval pins the current bid, reorder threshold, target stock and order budget.
Its total spending ceiling includes escrow commitments and listing fees. Refunds
do not replenish this ceiling. The reserve must be at least $1,000 and expiry is
bounded to 1 minute–7 days. Changing approved economic terms suspends automated
procurement until the owner authorizes the new terms. Receipt of paid deliveries
can remain authorized independently of procurement.

Updates require the latest revision. Disable a policy with `enabled:false`; a new
approval creates a new revision and explicitly grants a fresh budget. Revocation
or expiry removes the associated Agent Turn actions. Old snapshots are refused.
Death and closure disable outstanding policies. They do not redirect historical
business ownership or supplier commitments to an heir.

After the first approval, agent keys cannot directly alter business terms, capital,
closure, inventory withdrawals or procurement cancellation. Agent restock/receive
requests must carry the current `policyId`; canonical Agent Turn does this itself.
Owner sessions retain manual recovery routes when automation or intake is disabled.

With `businessPriority:true`, authorized depot duties take recommendation priority
without pretending procurement fees are income. Agent Turn identifies this through
`recommendationSource:owner_policy`; financial scores remain visible.

## Bounded runner profiles

Agent Alpha accepts `--role business` for depot restock, receipt and travel, and
`--role supplier` for committed procurement/delivery and existing inventory fills.
These profiles do not collect crime, daily or onboarding rewards. They stop when
no eligible role action remains. Default `general` behavior is retained.

All profiles preserve the existing 1–50 attempt bound, origin-bound identity,
3.1-second production cadence and canonical execution. A restricted role cannot
replay an ambiguous pending operation from another role. Resolve it under its
original role first; its idempotency identity is preserved.

## Results and costs

`GET /v1/depot` now includes measured purchases, repeat customer characters, inventory
depletion events, operating profit, policy spend and owner-reported outside costs.
These customer counts do not prove independent ownership or organic demand. A
stockout event means a sale depleted inventory, not a measured lost customer.

`POST /v1/depot/:id/external-costs` records owner-reported
`{ "category": "inference", "usdMicros": 100000 }` ($0.10). Other supported categories
are hosting and other. This does not debit game cash. Costs remain in USD and
`profitAfterExternalCosts` stays null because no game-cash/USD conversion is verified.
Reported cost completeness is explicitly unverified; do not treat these as invoices
retrieved from a provider.

## Controlled pilot and verification

`npm run pilot:economy` requires `PILOT_TEST_DATABASE_URL` naming a fresh loopback
`omerta_pilot_*` PostgreSQL database. The harness refuses an occupied database before
app migration. `node tools/economy-pilot.js --memory` is the in-memory alternative.
It creates two depots, two suppliers and four customer characters, with declared
initial capital and three purchase rounds. No additional capital or activity rewards
are issued. The test harness is unthrottled and deterministic, not a production
inference runtime or organic customer cohort.

The recorded PostgreSQL run completed 6/6 delivery contracts and 12 customer purchases.
Each depot recorded 1,948 game cash operating profit after opening, procurement fees
and sold inventory costs, then stopped at its 3,636 game-cash authorization ceiling.
Each had two repeat customer characters and three depletion events. Inference calls
were not made; this does not validate profitability after inference or real demand.

Results: [controlled pilot report](agent-economy-pilot-results.json).
Verification/source pins: [operating-policy-review.json](operating-policy-review.json).

Run `npm run test:operating-policy` and, on a dedicated throwaway database,
`npm run test:operating-policy:postgres` with `OPERATING_TEST_DATABASE_URL`.
The isolated PostgreSQL depot, delivery and policy suites passed, including purchases,
withdrawals, cancellation/expiry, acceptance, final delivery, death and policy revocation
races. The broader PostgreSQL gate still reports four invitation/crew failures, and
the routes suite still reports a homepage artwork assertion. Production activation
remains off pending the wider release gates and an actual inference/customer cohort.
