# RC1-02 Family resource proof

Owner: Codex/resource_proof. `tools/rc1-resource-family.js` runs a scoped native
PostgreSQL workload for Family tribute, reserve spending, war spoils, turf custody
and dissolution. It does not clear the full resource or release gate.

```powershell
$env:RC1_RESOURCE_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55438/postgres'
node tools/rc1-resource-family.js
```

Run from a clean committed checkout with dependencies matching the lockfile. The
endpoint must be an isolated loopback administrative database. The runner creates
a fresh random database and retains it. Output defaults to a private directory
under the operating-system temporary directory, outside the checkout;
`RC1_RESOURCE_OUTPUT` may select a fresh path. Existing results are never
overwritten. JWT/moderator secrets are generated per run and excluded from the
artifacts. Raw requests and snapshots still belong in private evidence storage.

The default workload uses the original production timers. It declares a war
through HTTP, scores it through a real canonical jump, seizes two initially
unheld districts, and starts two new sealed contests. The original war lifetime
is 30 minutes; each contest uses the production duration and current real season
modifier. Shorter branches run while those deadlines elapse. Neither clocks nor
persisted deadlines, outcomes, scores or balances are rewritten after baseline.
Both application and database clocks must pass the untouched deadlines before
terminal resolution. Allow at least 31 minutes for this mode.

The optional `--terminal-fixtures` mode initializes a scored war and two empty,
already-open contests with 60-second deadlines before baseline. All subsequent
stakes, dispositions and waits remain canonical. This mode does not prove
declaration/scoring or the original production lifetime. `--development` permits
uncommitted code and labels the result diagnostic. Neither option can silently
qualify as a full native game simulation.

Initialization supplies five synthetic accounts, four Families and membership,
one junker car, eligibility stats, 1,000,000 cash per character and 2,000 OMR for
one account. Every Family treasury, OMR reserve and ammo bank starts at zero;
contests contain no initial bids. Canonical tribute and car melting fund the
measured buckets. Natural progression and Family formation are excluded.

The workload measures:

- Cash tribute and OMR tribute into Family custody, including duplicate OMR
  submissions, retry, and a real ledger-insert abort.
- A seal purchase funded by the pooled reserve, authorization refusal, rollback
  and exact replay. OMR goes to the desk through the existing recycling hook.
- A real car melt that creates personal ammo and a Family ammo/cash tithe.
- Treasury-to-turf escrow, raising an existing stake, replay/refusal and rollback.
  A challenger wins one contest, the defender wins a tie in the other, and a
  departed bidder's dissolved Family forfeits its entire outstanding stake.
  Living losers receive the canonical partial refund and the remainder burns.
- Last-member dissolution with nonzero cash, OMR and ammo, including a late ammo
  ledger failure after earlier disposal steps, concurrent final departures,
  retries and server reopening.
- Due war resolution with a nonzero paired spoils transfer, a failure after the
  loser debit but before the winner credit, concurrent resolvers and retries.

Every observed boundary snapshots the authoritative buckets and runs the full
canonical invariant set. Only the disclosed initial cash, OMR and car baseline
drift is permitted, and it must remain constant. Exact decimal equations account
for each character, account, Family, turf escrow and desk bucket. A dissolved
bidder stays in the escrow equations even after its Family row disappears.

War spoils are a canonical internal treasury transfer without a currency ledger
row. Their proof binds the actual locked resolver outcome to both treasury
changes and checks the paired amount and winner. The observer creates no new
gameplay receipt or authority. Seal spending and dissolution OMR also transfer
to the desk; they are not supply burns. Dissolution cash/ammo and turf forfeitures
use their canonical destruction receipts.

Retain `result.json`, `requests.json`, `movements.ndjson`, `initial-state.json`,
`final-state.json` and `coverage-summary.json`. The first unexpected failure
retains complete observed before/after state and action context. Result manifests
hash the artifacts. HEAD, source bytes and the committed source inventory are
checked before and after execution; changes or failed assertions exit nonzero.
The public coverage summary excludes credentials and raw actor/request data.

Full simulation, natural progression, deployed source/configuration/dependencies,
process-crash/backup restore, broader Family systems and unexecuted charter
variants remain open. Server reopening proves durable responses only. A successful
run is `SCOPED_PASS`, never release clearance.
