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
