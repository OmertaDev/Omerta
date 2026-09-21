# Bounded OMR custody journal

This independent read-only module classifies an explicit local subset. It is not
an all-resource observer or release clearance. Source starts at
`43b86f77d68e0e371a5de100aa6537815044ee65`; each retained native run records its
own committed revision, complete checkout hash, configuration and artifact hashes.

The journal takes complete rows from its declared seventeen tables in one native
repeatable-read snapshot. It preserves every decimal digit and rejects nonzero
precision below one micro-OMR. Integer equations cover each personal liquid,
staked and unbonding bucket, every currently enumerated house/Family OMR bucket,
active loan collateral and live auction escrow. Historic `rewards` remains a
liability; counting it again as supply is forbidden. Unknown movement fails strict
reconciliation. Diagnostic `allowUnsupported` retains exact unexplained owner
deltas and does not relabel them as classified.

## Authority and claimed subset

| Branch | Durable authority and exact checks |
| --- | --- |
| Window redemption | Account's `yield:window`/`window:burn`, exact paired `desk:recycle`, completed HTTP receipt bound to owner/method/URL/body, actual recipient cash and till. Six-decimal 5% rounding; remainder belongs to desk; cash floors at500 per OMR. |
| Rename sink | Owner's `vanity:name` and exact desk recycle multiset, plus owner-bound request receipt. No supply burn is claimed. |
| Stake / unstake | These canonical functions have no ledger rows. Completed idempotency receipt, full route/body hash and owner bind the exact floor/min amount and bucket transfer. Original unbond deadline is six hours. |
| Unbond release | Prior committed principal/deadline and observed non-replayed canonical character read after that deadline. Original `accrue` rule, not an invented receipt or changed timer. |
| Loan pledge / repay | Original loan ownership/terms and open→active→repaid transitions, exact account/counterparty receipt, bound borrower request and durable response. An open demand is not custody. |

Recycled rows have no unique foreign key back to the debit. Pairing is therefore
an explicit exact reason/amount multiset within a completed boundary. It never
invents a durable one-to-one source identity. Snapshots include every observed
owner, so unexplained cross-owner movement cannot hide behind aggregate equality.
The module does not classify arbitrary transaction commits between a committed
game action and its later HTTP receipt-store operation.

## Native proof and controls

Run `node test/rc1-omr-journal.js`, then from clean committed source run
`node test/rc1-native-omr-journal.js --postgres --output=<private-new-directory>`
with a loopback administrative `RC1_RESOURCE_DATABASE_URL`. It allocates its own
database and retains it; it never broadcasts, enables a rail or contacts a
provider. External integration environment values are refused.

Initial fixtures allocate5000/5000/10.011 OMR to three accounts from the retired20000
OMR AMM seed, leaving9989.989; they do not add in-game supply. Default characters have
cash500/ammo25. The initial exchange cash till and lifetime funding100000 are a
declared fixture, not naturally earned revenue. All later world changes are
canonical. The existing logical clock drives all original local worker deadlines
through six hours; two untouched unbond deadlines are tested one millisecond
early and at expiry. This is not six hours of literal wall time.

The campaign includes fractional round-up/down redemption, replay and mismatched
body refusal, a late SQL abort after sink/recycle writes, same-key concurrency,
staking floor and negative refusal, loan ownership refusal and collateral return,
and repeat release reads. Exact snapshots and HTTP receipts are retained at each
complete boundary; first failures are preserved. Negative controls corrupt copies
of actual native snapshots, never world rows: receipt omission/owner/body hash,
fractional rounding, missing/duplicate recycle, loan owner, subatomic quantity,
early deadline and immutable history. Independently rerun each saved input through
`reconcileOmr` to verify the journal result.

## Scoped accounting review

The repository security-review policy applies to this exact test/accounting scope.
Method checkouts were verified at policy pins: Pashov
`c577eb7799c349de0acb187ba00ca98e14e436fd` (senior-auditor concrete trace,
assumption and inversion pass); Plamen
`795962b96e254f2e423a2635fe7f8cb8ea1e6d69` (`depth-token-flow` entry/exit,
ownership and actual-constant checks); Trail of Bits
`d3323cefbcf645678b8dc481de204b02ad3d02dc` (audit-context function/callee and
authority mapping). These are manual JavaScript/PostgreSQL adaptations, not a
claim that upstream agent orchestration, Solidity fuzzers or static analyzers ran.

Inspected boundaries: authenticated actor→global request reservation/store→
`withCharacter`/`withTwoCharacters` locks and persistence; `spendOmr`→`ledger`→desk
recycling; `redeem`→Family yield and cash till; stake/unstake→`accrue`; loan
offer/take/repay→active escrow. Fixed-string native searches and native controls
are the scoped static/property checks. Any executed failure stays attached to its source.

Native run8558ac56 confirmed **RC1-OMR-PRECISION-01 (P2)**: redeeming6.000011
from5000 persisted4993.999989000001 while receiving buckets gained6.000011.
Independent native SQL and arbitrary-scale integer sums confirmed a global
0.000000000001 excess. The column is unconstrained NUMERIC, contrary to the old
comment. Runtime-only repair94a802b7 keeps window split/cash-floor arithmetic in
integer micro-OMR and subtracts its debit exactly from the original decimal balance.
Historical subatomic value is preserved, not cleaned up. No explicit subatomic
request-rounding contract was found in the route/design/tests; such input now
receives a precision refusal before mutation. Trailing-zero and scientific decimal
representations remain accepted. `test/rc1-omr-exchange.js` covers these arithmetic
boundaries and old dust preservation; native retests determine the repair status.

The separate native `test/rc1-native-omr-window-boundaries.js --postgres` proof
uses declared arbitrary-scale historical balance fixtures. At52671886 it reproduced
an additional affordability boundary: a6.0000099999999996 balance could redeem
6.000010 and persist-0.0000000000000004 because the shared Number comparison
rounded the available value upward. The local window now checks its exact
remaining balance before any debit. This does not change shared `spendOmr`.
The runner retains full-balance half-micro split, maximum cap, exact cash-floor,
numeric/decimal-string/scientific/trailing-zero input, old-dust preservation and
precision/finite/min/cap refusal evidence. Huge positive/negative exponent unit
controls prove finite/min validation precedes exponent BigInt work.

The original bounded journal passed at39b39973:37 completed native boundaries,
632 exact owner equations,20 nonzero movements,11 rejected native-input
corruptions and3 canonical invariant checks. Two original six-hour unbond
releases ran after72 Director,6 hourly,6 seasonal and72 health callbacks.
This result predates the additional affordability repair and requires a fresh
source-bound rerun for that change. All earlier failures remain retained:
preflight fixture seed, subatomic production residual, undefined bodyless
receipt serialization (unsealed), below-minimum loan fixture, missing native
fixture season and the exact insufficient-balance production case.

Cross-domain dependencies remain explicit: correct authentication and request
binding, native transaction rollback/locking, complete original logical clocks,
and deployed reserve/oracle/provider authority. The first three receive bounded
native evidence here; the last does not. Privileged desk sales/buybacks,
withdrawals, external backing, mints, other sinks, Family redistribution, stake
commitment/loot and other loan terminal branches remain unsupported. None may be
inferred from a zero aggregate drift or from pre-baseline fixture allocation.
