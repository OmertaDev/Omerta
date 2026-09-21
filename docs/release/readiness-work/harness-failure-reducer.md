# Bounded native causal failure reduction

Owner: Codex/native_harness. This is a direct-authority counterexample linked to the archived world replay failure. It is not a minimized 90-day worker trajectory or a proof about seasonal waiting periods.

The input is immutable retained PostgreSQL ranking data: source-bound artifact index, chunk hash, occurrence, exact typed ranking rows and both actual observed row orders. The scoped fixture preserves every ranking column and uses the existing native test fixture for the other columns. Both sides must have identical complete initial canonical state and must produce the requested native row order without rewriting query results. The canonical source tree, schema and lockfile must match the retained input's source; the new harness revision is recorded separately and stays fixed throughout reduction.

The target is the same failed complete-state equality assertion and the same two crown recipients. Unrelated failures cannot count as reproduction. Every native trial uses fresh owned PostgreSQL databases and retains full snapshots, canonical authority invocations, native query records, RNG tape, assertion output, source/configuration hashes and verified cleanup. Trial errors stop reduction. The original world failures and their source identities remain unchanged.

The declared candidate dimensions are:

- Population: ordered subsets of the retained eligible actors. Removing an actor occurs only during initial fixture construction.
- Events: ordered subsets of the existing native causal case's standing read, market due read, `recordReckoning` and `sweepMarket` operations. These are a newly frozen causal baseline, not the archived world's event history.
- Logical delay: the diagnostic delay before the direct crown authority, initially derived from the retained seasonal timestamp. A zero-delay candidate is tested without assuming temporal monotonicity. No original worker callbacks are registered in this component test and no elapsed-season equivalence is claimed.

The reducer preserves every trial and cached-trial reference. It retests deletion minimality of each remaining actor and event after time reduction. A trial or wall limit produces `INCOMPLETE_BOUNDED`, never a qualifying pass. The native campaign is limited to 48 paired trials and 20 minutes, with a running trial allowed to finish retaining diagnostics and cleanup.

Commands:

```text
node test/rc1-native-failure-reducer.js
node test/rc1-native-failure-reduction-postgres.js --postgres --recorded-run=<sealed c38 replay directory> --world-failure=<sealed 2ac failed replay directory> --standing-sequence=2024 --season=740 --output=<fresh restricted directory>
```

The native command requires `COORDINATION_TEST_DATABASE_URL` for disposable loopback database creation. Synthetic initial resources are not resource qualification. The acceptance target for this bounded exercise is a retained native baseline failure and a smaller reproduced case with two actors, one crown event and zero diagnostic delay, plus negative minimality checks. Full world-history reduction, due-worker time minimization, automatic arbitrary failure classification and the 225-cell matrix remain open.
