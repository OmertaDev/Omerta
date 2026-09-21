# Scoped active quiet-world workload

`test/rc1-native-world-workload.js` connects an actor policy to the source-pinned
original worker scheduler. It requires real PostgreSQL, a clean committed source,
and a new restricted output directory. Its default is 25 actors and 2,160 logical
hours; `--hours=2` is only a smoke run. None of its results qualify a matrix cell.

Every declared worker deadline runs through its original production callback.
One controller advances application and isolated SQL clocks. The actor policy
receives only its own authorized PlayerCommand projection, its canonical character
view, and the public crime catalog fields. A diagnostic observer never feeds hidden
database facts to actors. After initialization, gameplay changes use original
transactions and workers; no balance, deadline, eligibility or status is rewritten.

Each rolling day selects the seeded quiet cohort. For population 25, the lower
integer extreme is two active actors (8%); the impossibility of 2.5 identities is
declared before running. Each selected actor may execute four issued commands and
one eligible canonical crime. Successful and losing crimes both consume canonical
resources; invalid attempts, reads and exact replays do not count as meaningful
actions. Command types, per-actor actions, waits, raw latencies, authorized observed
opportunities and invariant results are retained. Observation age and sightings
separated by the observation window are distinct counters; neither proves
continuous persistence or ignored opportunities. All canonical ledger invariants
run after player mutations, daily sessions and the final worker boundary. The
current harness does not assert them after every individual worker mutation.

The first smoke run at `7f310378a22e6a62a403befb5c0a0a86111db789` passed two
logical hours: two actors executed eight fresh PlayerCommands and two successful
crimes, with 55 invariants and every declared local callback. The source's unused
`observedAuthorizedOpportunities` counter incorrectly stayed zero; its separate
opportunity tracker retained observations. The next source derives that counter
from the tracker. Review also corrected observation-age semantics, added a final
invariant boundary and separated command failure context from later worker
failures. These are harness corrections, not gameplay repairs.

Missing work includes the other archetypes, all required metrics, comprehensive
resource journals after worker transitions, actor-policy restart/replay, longest
lifecycle workloads, dead-world reachability and reduction, enabled external
integrations, and the production-equivalent soak. Local health-registry absence
and disabled chain/liquidity remain explicit exclusions. Idle-worker and bounded
actor smoke results cannot replace these requirements.
