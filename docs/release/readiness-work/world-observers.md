# World diagnostic and committed-state observers

These tools extend the native harness. They do not clear the world or resource
gates, and their diagnostic results never become player-policy inputs.

`tools/rc1-world-diagnostics.js` reads a single repeatable-read snapshot and records
per-player actions including absent players, campaign/operation states, participation,
owned Knowledge and active grant counts, separate item/stack/lot distributions,
Family concentration, exact ledger activity, and every table's row count. Exact
concentration ratios retain decimal quantities beyond JavaScript's safe integer
range. Physical relation sizes and MVCC snapshot identities remain separate
diagnostics. They are not canonical state or evidence of deterministic allocation.
The native precision fixture verified 369 tables and unchanged full canonical state.

Knowledge ownership does not prove current authorized access; overdue records do
not prove permanent deadlock. Gross ledger activity counts transfer legs and is
not yet deduplicated resource velocity or reward attribution. Those exclusions
are explicit in every diagnostic result.

`tools/rc1-native-commit-observer.js` optionally wraps the existing test SQL clock
proxy. It is disabled during initialization and armed after the measured baseline.
Successful native COMMIT, COMMIT returning ROLLBACK, explicit rollback, savepoint
rollback and autocommitted statements retain distinct identities. The separate
read-only observer connection must bypass the wrapper. SELECT is observed too,
because SQL functions can have effects. Ambiguous multi-statement SQL is refused
before execution. An overlapping query is refused rather than serialized and
reported as production concurrency. This observer is for isolated SQL boundaries.

The native controls verify exact durable values, savepoint restoration, aborted
transactions, refusal before an overlapping write, and an observer error after a
write has committed. Such an error remains a proof failure with committed state;
it cannot be relabeled as a rolled-back game action. The first overlap control
did not overlap because opening its second connection outlasted the query. The
corrected control borrows both connections before launching the same native queries.

Resource classification is separate: recording a committed boundary cannot infer
which rule created, destroyed or transferred value. Complete per-owner receipts,
all resource categories, longest lifecycles and the full matrix remain required.
