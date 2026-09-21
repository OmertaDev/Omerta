# Shared observer: three ordinary cash routes

Owner: Codex/resource_proof. Base:
`202117080c2b210450538e015c4870353b5f2bf2`. Observer/test changes only;
no production route, amount, timer, status or authority changes.

The pressure probes previously retained `checkin`, cash `ammo:buy` and
`bank:deposit:<amount>` as unknown receipt reasons. This increment classifies
only exact relationships established by their original implementations:

| Route | Original authority and checked disposition |
| --- | --- |
| `/v1/checkin` | `game.checkinQuoteOf` evaluated from prior respect, streak and check-in day at stored receipt time; one exact owner cash reward, original day/streak latch and that account's lifetime counter increment |
| `/v1/armory/ammo` | `economy.buyAmmo`: same-owner, same-transaction cash-2000 and ammo+50 receipts, exact actual pocket and ammo changes |
| `/v1/bank/deposit` | `game.bank`: positive floored integer embedded in the zero-valued marker; exact pocket debit, vault credit and transit accumulation/reset, including the original two-hour clear rule |

These actions do not pay a house tax or fund an exchange pool. For isolated
classified cash boundaries the observer checks zero change to street-tax cash
and exchange balance/funded/paid counters. `exchange_pool` is now included in
the read-only snapshot, raising the inventory to56 tables. A mixed boundary
with unrelated cash receipts retains an explicit unknown pool-disposition
classification. Exact amounts are retained; no observer rounding or balancing
entry is introduced. Original bank interest remains unauthorized by this
classifier even when its separate receipt keeps the bank destination explicit.

The shared observer has no durable HTTP request identity. For bank deposits it
can prove the marker and custody amount, not what a particular HTTP caller
requested. `test/rc1-world-pressure-cash.js --evidence=<fresh-pressure-run>`
separately binds every native classified movement to the observed actual actor,
route and response, and checks the original floored requested deposit amount.
This distinction is retained in its evidence and scope limits.

Twenty-five pure negative controls include balanced wrong reward/price/quantity,
wrong owner/account counter, missing latch or reciprocal cash/ammo/bank/transit,
stale and duplicate receipts, and tax/pool diversion. Positive pure controls
include original missed-day streak halving, capped reward at streak8, exact
two-hour transit clearing and one millisecond before clearing. Those pure cases
are not native elapsed-time evidence. Fresh native scarcity/abundance exercise
their existing original15-minute workers and declared starting states.

An initial deliberate stale-bank control escaped: a zero receipt was moved into
the before snapshot while an equal cash-to-bank transfer preserved the old
aggregate equation. The retained development failure is an observer limitation,
not a production defect. The observer now requires fresh owner receipts for a
vault change; bank movement outside the bounded deposit classifier is explicitly
unknown. Historical/rewritten receipt checks and exact personal parity remain.

```powershell
$env:COORDINATION_TEST_DATABASE_URL='postgres://postgres@127.0.0.1:55438/postgres'
$env:RC1_PRESSURE_OUTPUT='<fresh restricted pressure directory>'
node test/rc1-native-resource-pressure.js --postgres --scenario=resource_scarcity
node test/rc1-world-pressure-cash.js --evidence=$env:RC1_PRESSURE_OUTPUT
node test/rc1-world-ammo-escrow.js --evidence=$env:RC1_PRESSURE_OUTPUT
# Repeat in a distinct output for resource_abundance; run the existing native
# rc1-world-resource-observer regression against a separate local database.
```

All native runs require clean committed source and retain immutable manifests,
full restricted snapshots, commands and corruption inputs. Other cash sinks,
bank withdrawal/interest authorization, cash/OMR/Family/season transitions,
ambiguous compounds, concurrency, full matrix, natural progression, deployment
and provider/chain backing remain open. A pressure run with no unknown receipts
does not qualify all resources or the release. Installed dependencies are
reused locally; a source/lockfile pin is not installed dependency attestation.

Relevant manual security passes follow the repository policy's pinned Pashov
`c577eb7799c349de0acb187ba00ca98e14e436fd`, Plamen
`795962b96e254f2e423a2635fe7f8cb8ea1e6d69`, and Trail of Bits
`d3323cefbcf645678b8dc481de204b02ad3d02dc`: trace original callers,
storage and timestamps; attack owner/amount/receipt freshness; retain failed
hypotheses and exact native retests. No upstream orchestration or Solidity
analysis is claimed for this JavaScript/PostgreSQL observer increment.
