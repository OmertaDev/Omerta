# RC1-02 escrow disposition proof

Owner: Codex/resource_proof. The separate `tools/rc1-resource-escrow.js` runner
executes scoped native PostgreSQL market, loan-paper, estate and scheduled-event
transitions. It does not clear the full resource or release gate.

```powershell
$env:RC1_RESOURCE_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55438/postgres'
node tools/rc1-resource-escrow.js --terminal-fixtures
node tools/rc1-resource-escrow.js --terminal-fixtures --short-field
node tools/rc1-resource-escrow.js
node tools/rc1-resource-escrow.js --short-field
```

Use a clean committed checkout and an isolated loopback administrative database.
Every execution creates and retains its own random database. Output defaults to
a fresh private operating-system temporary directory outside the checkout;
`RC1_RESOURCE_OUTPUT` can select another fresh private path. Results cannot be
overwritten. Secrets are generated per execution and omitted from the artifacts.
Raw requests, snapshots and journals remain private. `--development` explicitly
labels an uncommitted diagnostic; it cannot substitute for a committed run.

The initial fixture grants seven synthetic characters eligibility, one million
cash and 2,000 OMR each, plus ten fixture cars. All measured escrow starts empty.
Racers are acquired through the canonical purchase route after baseline. No
balance, deadline, singleton pointer, life state, outcome or eligibility is
rewritten after baseline. Failure injection creates temporary PostgreSQL triggers
that abort existing canonical transactions, then removes those triggers.

The modes deliberately distinguish timing evidence:

- `--terminal-fixtures` starts with empty poker, Grand Prix and Stakes events
  whose fixture deadlines are sixty real seconds away. Canonical entry funds
  each pool. This does not prove their production registration lifetimes.
- The default mode starts only poker as an empty sixty-second fixture. Grand Prix
  and Stakes materialize through their canonical entry routes and retain their
  original thirty-minute deadlines. Market listings and a secured loan also run
  their original one-hour lifetime, so allow at least 61 minutes.
- `--short-field` registers only one living entrant and proves refunds instead
  of payouts/rake/death. With original timers, allow at least 31 minutes. With
  terminal fixtures, allow about two minutes.

The native server's preflight continues to reject test-only timer environment
flags. The proof never bypasses it. Application and database clocks must pass the
untouched deadlines. The existing event sweep dispatchers perform settlements,
including failure-and-retry and concurrent worker calls. Canonical resolvers are
also retried directly after settlement to prove their terminal guards.

The immediate branch group includes market outbid and standing-bid buy-now
refunds, sale/take, unmet-reserve cancellation, buy-order cancellation, loan offer
refund, OMR pledge/return, loan-paper sale/take and repayment to the new lender.
It tests duplicate requests, exact cached replay, owner/terminal refusals and
ledger failures. Event entry duplicates charge once. Market, loan-paper and
event receipts replay unchanged after server reopening.

The compound death case uses the actual `withTwoCharacters` transaction wrapper
and `runEstate`, explicitly selecting the canonical loot/nonloot terminal mode.
It is not a natural fire-combat or target-eligibility proof. A victim holds an
order, a standing bid, an open loan offer, an OMR pledge, a lender claim, a listed
car and (in the full-field mode) entries in all three events. The estate loots
and destroys the prescribed escrow, refunds the killer's standing bid, splits
the OMR pledge, and transfers the lender claim to the newly created heir. A late
pledge-credit failure rolls back all earlier dispositions. The inherited claim
is repaid canonically; a separate nonlooting estate destroys its held cash. Four
full-field entrants leave three living participants after death, satisfying all
three events' original minimum-field requirements without forcing a winner.

Original-timer full-field runs additionally exercise market auction expiry sale,
reserve expiry refund, buy-order expiry refund, and secured-loan collection with
cash and car/OMR collateral. The market sweep commits each listing independently;
its injected refund failure may coexist with a successful unrelated sale. Every
observed transition still reconciles, and the failed listings remain live until
retry. Terminal retries cannot dispose of custody twice.

Every serial action or complete concurrent batch gets one committed before/after
snapshot, exact decimal equations and the complete canonical invariant set. Only
the disclosed initial cash, OMR and car invariant drift may persist. The journal
separates personal balances, loan/market/event custody, desk recycling, street-tax
custody and the loan-house pool. A global cash equation additionally cancels all
internal transfers and checks exact destruction and canonical heir creation.
Market and event fees split between tax custody and destruction; loan-paper
fees go entirely to tax custody; loan vig splits between tax and loan-house
custody. Historical settled pools and repaid pledges are not counted as held
value. Estate OMR duty recycles to the desk rather than destroying supply.

HEAD and relevant source bytes are pinned before and after execution. Unexpected
failure retains the complete first failing boundary and action context. Results
hash the artifacts, and the public coverage summary omits private actor/request
data. Retain the command log too: canonical sweep workers log deliberately
injected transaction failures and retry them on the next sweep.

Poker's original 24-hour lifetime and bracket format, natural progression and
combat, 48-hour untaken loan expiry, 24-hour collateral grace, other market/game
variants, full resource simulations, deployed dependencies/configuration and
crash/backup restoration remain open. Each execution is at most `SCOPED_PASS`.
