# Original worker NPC boat grant evidence

Base source: `15393a86f863b2dedf8d119b40bb05393561b763`. Scope is a serial,
read-only diagnostic classifier for one newly born NPC's original dinghy grant.
Production, actor policy, timers and resource initialization rules are unchanged.

The earlier `22cca6279c37fbe328e943ae2838d4acae1ab4d5` Family proof retained
one boat change at history sequence 881, native sequence 19582, transaction 228,
logical `2026-09-24T03:00:00Z`. It added a dinghy alongside a new NPC, cash seed
and car. That earlier boat evidence remains state-only and unsupported: it did
not retain the new executed-query/RNG witness and cannot inherit classification.

`spawnResident` writes no boat grant or rarity receipt. This tool does not add one.
Authority is the source-pinned executed account, persistent-account, character and
boat INSERTs, native result counts, exact original default worker caller frames,
and the existing deterministic runtime's actual recorded inputs. At boat dispatch,
the last two Math.random entries are the authored eligibility and rarity rolls;
the next UUID entry generated the boat ID. The pinned source establishes that
ordering. The verifier reproduces all three seed/counter values, checks the band's
actual probability and rarity function, and requires exact owner, asset ID, fresh
birth identities and every stored boat default. Native audit separately binds
these entries to the complete retained random tape and the exact enclosing event.
This does not prove a production randomness distribution.

The optional origin/namespace hook reuses the existing car transaction collector.
There is one base native COMMIT observer: Family wraps boat/car; car and boat
share callback argument two and Family retains argument three. No extra SQL,
second query collector or actor-visible diagnostics are introduced. The runner
keeps a full before/after artifact only for candidates and binds its reference and
witness hash into the resource journal. Missing, compound, overflow, copied-SQL
and direct-fixture paths stay unsupported; corrupted qualified evidence fails.
Every other boat change remains visible through `boat-identity-provenance`.

The focused native proof predeclares a maximum twelve original logical hours,
25 ordinary birth-default fixtures, an AFTER INSERT fault and diagnostic sequence
installed before baseline. The first boat attempt aborts after the original birth,
cash receipt and boat write; complete resource snapshots must remain equal.
Only the diagnostic trigger is removed afterward. Later original callbacks must
produce two distinct native grants. A full observation/replay uses the original
quiet-world policy for eight logical hours, without forced actions or new resource
fixtures. Operational bounds remain unchanged. No original boat timer is edited.

Run `node test/rc1-npc-boat-journal.js` for pure negative controls and
`node test/rc1-world-car-melt-witness.js` for the source-bound composed callback.
Native entry: `node test/rc1-native-npc-boat-lineage.js --postgres` with a local
`RC1_RESOURCE_DATABASE_URL` and private `RC1_NPC_BOAT_OUTPUT`. The full world
uses `test/rc1-native-world-workload.js --postgres --hours=8 --population=25
--seed=rc1-alpha --policy=quiet_world --observe-resources` and recorded replay.
Results and exact tested revision are added only after execution, separately.

Manual review follows the repository's pinned Pashov trace/invariant, Plamen
accounting/authority and Trail of Bits trust-boundary/false-positive methods.
Controls cover wrong owner despite balanced totals, duplicate/stale identities,
missing or rewritten birth writes, wrong native results, boundary substitution,
source/caller changes, RNG tape corruption and unearned boat state. Solidity,
external transfers, production RNG fairness and concurrency are out of scope.
Boat sale, retirement, estate, NFT, cargo and compound dispositions remain open;
this is neither full resource coverage nor release/matrix qualification.
