# Bounded three-Family turf contention

The canonical war model stores one `war_with` counterpart and rejects declaration if either Family is already at war. A three-way declaration triangle is therefore unsupported. This component uses the authored nearest valid contention: the incumbent and two rival Families each stake on one player-held district. `stakeClaim` explicitly permits incumbent defense, and the incumbent wins equal highest stakes. No fourth Family or invented war state is needed.

`tools/rc1-turf-policy.js` selects a sealed total using only the actor's own treasury, configured commitment basis points, deterministic seed jitter and the public district floor. It records exact pending request identity before dispatch, restores it unchanged, and distinguishes the live contest, expired-but-unsettled escrow, and an actual own terminal notification. Unknown completed replays block new selections. The policy never receives hidden bids, observer reports or rival treasury reads.

`tools/rc1-turf-custody.js` independently reconciles complete custody boundaries for the bounded unchartered contest. Canonical claim receipts bind each owner treasury debit to its own district escrow. Original worker sweep authority, the actual holder transition and per-owner refund/burn receipts establish terminal disposition. Exact decimal equations reject residual drift. The incumbent tie rule is tested; the native scenario uses distinct stakes. Dissolved bidders, charter modifiers, other districts, war and OMR are explicitly outside this journal. The existing Family journal continues to report turf branches as unsupported, and its output is preserved alongside this focused journal.

The native setup uses four ordinary entrants, three founding Families and one ordinary outsider. Only founder respect is initialized to level400 before baseline. Actual $140,000 check-ins fund actual $25,000 formations and $100,000 tributes. The incumbent canonically seizes naturally unoccupied Cathedral before measurement. There are no direct balance, item, membership, district-state or deadline grants. Three independent policies select at 70%, 60% and 80% of their own available treasuries plus seeded jitter, bounded by the published floor and available cash. Their canonical claim requests execute concurrently against the same district.

The proof observes one second before the original returned deadline, the expired window before the hourly resolver, the original first hourly settlement and the original second hourly no-op sweep. Every due original local worker callback runs through the shared application/SQL clock seam; no resolver is directly invoked and no deadline is rewritten. One winner receives district control; the winner's stake burns, while each loser gets the authored refund and forfeiture. Exact retries before and after settlement must preserve the full canonical state.

Private-fact isolation is narrow and explicit: the public district response exposes the count and deadline but no sealed stakes, and policy inputs contain no rival balances. Public Family treasury endpoints can permit balance-delta inference. This component does not claim absolute secrecy. Invocation/completion ordering is retained; PostgreSQL total commit order is not inferred from response timing.

Run `node test/rc1-turf-policy.js` for policy, tie and corrupted-lineage controls. Run `node test/rc1-turf-native.js --postgres` with `COORDINATION_TEST_DATABASE_URL` pointing to the disposable local control database and `RC1_TURF_OUTPUT` naming a fresh restricted output. A clean immutable source is required through sealing. The unchanged global observer, all canonical invariants, both custody journals, full snapshots, exact responses and worker job traces remain in restricted evidence.

Ancestry continues from completed alliance branch `ee025782` (root `9e05bf08` plus the documented Family journal dependencies). Only these new turf files require integration once those dependencies exist. No runtime, shared observer, package or workflow files change. Full war archetypes, the 25-actor/90-day/three-seed matrix, other resources and production remain unqualified.

## Sealed native result

Clean immutable source `ab7c9e2ff603e98d18d55963f2ddf875b55ac7e4` passed on 2026-09-21, 08:36:43.907–08:37:10.054 UTC. Restricted output is `turf-ab7c9e2f-native`. The initial canonical seizure cost $22,500. The epoch fell in the authored Reckoning phase: its existing 0.5 contest-duration multiplier made the original returned window 900 seconds, and its price modifier applied without an environment override. The contest expired at 15 minutes; all $194,424 stayed in escrow until the first original hourly sweep 2,700 seconds later.

| Participant | Actual stake | Terminal result | Refund | Burn |
| --- | ---: | --- | ---: | ---: |
| Incumbent | $54,292 | Lost Cathedral | $27,146 | $27,146 |
| Rival one | $60,044 | Lost contest | $30,022 | $30,022 |
| Rival two | $80,088 | Won Cathedral | $0 | $80,088 |

The journal reconciled $194,424 treasury-to-escrow, $57,168 refunds and $137,256 destruction to exact per-Family endpoints and receipts. The three requests overlapped: invocation orders 32/33/34 completed in orders 34/32/33 respectively. These observations do not establish a PostgreSQL total commit trace. The public district projection changed only by adding the public contest count/deadline; the actor policies never received rival balances or hidden bids. The ordinary outsider's claim failed with the authored rank refusal.

The original two-hour callback schedule completed 24 Director, two hourly, two season and 24 health callbacks. Exactly one original turf sweep settled the contest; the second hourly sweep resolved zero. Own canonical notifications agreed with the public winner and exact refunds. Two exact claim retries, before expiry and after settlement, preserved the full canonical snapshot and created no new escrow.

All 55 canonical invariants passed at 77 boundaries. The unchanged global observer recorded 1,254 checks over 93 boundaries and retained 26 unknown classifications. The focused turf journal retained complete inputs at 73 measured boundaries and passed 216 owner equations. The existing Family journal retained eight unsupported turf classifications (three deposits, two refunds, three burns); its scope was not silently expanded. The exact owned database was removed, and all 194 indexed artifacts plus 234 hash-chained history records verified. The unit suite passed pending/replay/settlement controls, incumbent tie priority and ten escrow-corruption controls. No failed native attempt preceded this result.

Configuration SHA-256: `cbe385a17f7163c8957c76e7d79b82a674eb984b56ad4484de82ac5ac88b08e7`.

Sealed `run.json` SHA-256: `4a3bac465b4d62bdde87a149a18830b24cf77a583143181b869cf80ded3f95dd`.

Final canonical state SHA-256: `1d84aea4561df95834ae39c060d2967cc752fdd190ead645cb13f6d43756ffac`.
