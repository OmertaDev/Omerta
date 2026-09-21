# Family OMR custody subset

`tools/rc1-family-omr-journal.js` is a read-only exact per-owner and per-Family
journal. `test/rc1-native-family-omr.js` invokes canonical routes and original
local worker callbacks against a uniquely owned PostgreSQL database. The source
base is `da35b64360e4b48d4612046da0b72d0e14e02623`. No gameplay authority,
mint, balance adjustment or deadline/status rewrite is introduced.

```powershell
$env:RC1_RESOURCE_DATABASE_URL='postgres://postgres@127.0.0.1:55438/postgres'
node test/rc1-native-family-omr.js --postgres --output=C:/private/new-family-run
```

Commit a clean source revision before running. Outputs default outside the
checkout and must be fresh. Each boundary retains full consistent authoritative
snapshots, observed requests and immutable receipts. A source-bound manifest,
hash chain, artifact index, worker/random tapes and first failed before/after
state remain available independently. Private artifacts include fixture actor
identities and HTTP bodies, but no bearer/mod tokens. Public summaries omit both.

## Authored authorities

| Flow | Exact authority |
| --- | --- |
| Tribute | Integer-floor amount, original membership, durable request owner/body, account debit and Family reserve credit; `gang:tribute` |
| Reserve spending | Boss-only sequential seal; boss/underboss foundation; free first charter and paid change with original cooldown; each debit pairs with `desk:recycle` |
| Ranked yield | Original hourly worker job; seasonal tribute plus10000 per season war; descending weights5/4/3/2/1; cent payouts backed by exact pool units |
| Succession | Original boss departure promotes underboss then existing seniority rule; reserve stays with its Family |
| Dissolution | All remaining members leave canonically; entire reserve goes to desk, never to a personal account; one `gang:dissolved` debit and matching recycle |

The full OMR custody bucket set from the existing journal is checked without
double counting. Every changed balance requires a supported movement with its
owner and authority. Unrecognized OMR receipts or unexplained owner changes
fail. Immutable receipts cannot disappear or be rewritten. A paired recycle is
an exact reason/amount multiset within the observed boundary; no unique foreign
key is fabricated where the schema does not supply one.

War spoils are CASH only. This fixture declares war, scores through a canonical
jump and reaches the original30-minute deadline; the OMR journal proves no OMR
movement and uses the resulting original standing in subsequent ranking.
Native spot checks retain the cash result; they do not prove the full war or
cash ecology. Although an old source comment says12h, `src/worker.js` invokes
Family yield every hourly tick. The proof follows the actual callbacks.

Initial4920OMR is explicitly reallocated from the retired AMM20000 seed.
The1000000cash till is declared. Three canonical window redemptions fund Family
formation and cash tribute before baseline; they also fund the actual Family
yield pool. Six accounts start with defaultcash500/ammo25 and declared respect
and physical-stat eligibility. No Family, reserve, membership, war score or
deadline is seeded. Population generation is disabled by its deployment switch.
Every original local callback still runs; no random outcome is overridden.

The native design covers exact retry, same-key concurrent tribute, unauthorized
reserve use, late seal/recycle rollback, late yield rollback and next original
hour retry, succession, late dissolution rollback and concurrent last departures.
It also exercises canonical fractional window funding:6.19OMR gives0.3095 to
the Family pool. The journal rejects any distribution larger than that backing;
it never rounds observer balances or silently discards a remainder.

Security method adaptation follows the repository policy: Pashov
`c577eb7799c349de0acb187ba00ca98e14e436fd` concrete traces and boundary attacks;
Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` asset-flow and recovery analysis;
Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` caller/storage authority
and property checks. Methods are applied manually to JavaScript/PostgreSQL;
upstream agent orchestration, Solidity analysis and chain audit are not claimed.

Unexecuted branches remain OPEN: weekly OMR reward, legacy pool merges, Levy
redirection, all rank counts/ties, yield racing dissolution/ranking, death/kick
dissolution, full cash/ammo/turf/war custody, unrelated OMR systems, natural
progression, provider/local-chain backing, dependency/deployment attestation and
the full simulation matrix. Source inventory alone is not execution evidence.

Native `ac82b5bac1967ebebccc14775c89d8317213c054` retained a harness FAIL
after29 completed boundaries: the war-standing spot check concatenated1 onto
PostgreSQL's NUMERIC string. The control now compares exact BigInt integers.
The production war had correctly settled; this does not turn the failed full
gate into a pass or imply anything about the unexecuted fractional-yield case.

Native `32cb0e035ee2122a3f78452d68bc0a3dbddc8f8a` retained a second harness
FAIL when the scheduler correctly rejected the deliberate yield fault as an
undeclared job failure. The runner now registers only `family yield/RFO01` in
the existing expected-error seam while that trigger is installed, then removes
it. The scheduler calls this status `EXPECTED_DORMANT`; here it is explicitly
an injected abort. Exactly one such job at the first original hourly callback
is required. Other worker errors remain fatal, and original safe()/rollback
behavior is unchanged.

## RC1-FAMILY-YIELD-01 — fractional backing overpayment (P2)

Native source `938651d4e1d9ffbb54e2fa2af97c155e09634a07` reproduced an
original hourly payout of0.31 from a canonically funded0.3095 pot. The persisted
pool became-0.0005, lifetime funding40.3095 and lifetime paid40.31. Both original
canonical invariant reports were green. The Family checks tolerated0.01 backing
and-0.001 negativity, hiding the actual overdraft. Aggregate conservation can
remain balanced when a negative bucket offsets the extra credit; this finding
does not claim a mint or externally backed payout. P2 reflects incorrect
custody distribution and a false-negative alarm on an ordinary reachable cut.

The failed run `family-omr-native-3` retains41 completed boundaries and the first
failed snapshots. Its original `src/exchange.js` SHA256 is
`93b973a2553b1ec884cd22ba3f173ae844a44c2abb2cb1b874ad97bf7c552e4b`.
The independent public-safe finding SHA256 is
`df65f36b99901837ea6232daa51a06836e2ed20a4271c72ca5f22b3756bf5884`.
The original failure and invariant false-negative remain evidence, not replaced
by a repaired-source result.

The surgical runtime repair preserves nearest-cent rank quotas but limits them
to whole cents affordable from the locked NUMERIC value. Exact decimal strings
credit reserves/receipts and subtract the paid total, leaving all historical
sub-cent digits unchanged. The two Family invariant predicates now compare the
stored decimal coefficients exactly; their additional `stored` fields expose
the full values while preserving existing numeric lhs/rhs consumers. No other
yield policy, funding, lock order or exchange-cash predicate changes.

`test/rc1-native-family-yield-precision.js --postgres` independently exercises
six valid native cases with per-case owned databases: fractional funding-sized
backing,18-decimal legacy residuals, sub-cent Number rounding, five-seat quota
clamping and authored below-minimum no-progress. Each calls the canonical
distribution concurrently, validates exact owner receipts and no-value replay.
One fails after reserve/receipt credits and checks atomic rollback. Three
explicit corrupt prebaseline fixtures require rejection of1e-18 negativity,
identity disagreement and overspending. This suite uses declared eligible
Family rows and exact AMM-to-pot initial reallocation; it does not claim natural
formation or worker timing. The main Family proof supplies those scoped
canonical routes and original hourly callbacks separately.

The existing tokenomics test previously overwrote the retained remainder when
adding0.23 funding. Its fixture now adds to both balance and lifetime funding.
After that correction pg-mem stores balance0.0005500000000040473,
funded109.23055000000001 and paid109.23: a separate binary emulator discrepancy.
Only two test assertions permit at most one Number.EPSILON at counter magnitude
on this emulator, while still requiring strict nonnegative/backed balances and
all other checks. DATABASE_URL runs require the exact production result. No
runtime adapter branch or normalization is introduced. Both diagnostic failures
are retained; native precision tests separately require exact stored identities.

Affected reruns: canonical Family OMR native proof, focused native precision
controls, tokenomics, exchange/Family/Commission callers and ledger invariants,
then integrated release/native gates. Unexecuted broader branches above remain
OPEN; no deployed defect or release clearance follows from this local proof.
