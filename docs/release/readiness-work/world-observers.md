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

`tools/rc1-knowledge-diagnostics.js` separately measures current access by calling
the canonical Knowledge board for each declared actor and following every page.
It requires a quiescent serial checkpoint; concurrent pages are not a consistent
world snapshot. A failed read, repeated claim/cursor or exhausted page bound fails
the observation instead of becoming an empty board. Restricted results contain
synthetic claim/actor identifiers and exact counts, but omit claim values, grant
principals and cursor tokens. Ownership, shared access and distinct claim counts
remain separate. They do not establish future acquisition or prerequisite reachability.
The native three-actor exercise observes counts `[1,1,0]`, then `[2,1,0]` after
canonical sharing across two pages, then `[1,1,0]` after revocation. Complete
canonical state is unchanged by each observation. The first run failed evidence
sealing because it omitted invocation history; the retained repair adds that
history and passes. Exact sources and artifact hashes are recorded in
`integrated-8c2e4418-results.json`.

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
