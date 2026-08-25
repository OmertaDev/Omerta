# GitHub collaboration guide

The remote repository is [OmertaDev/Omerta](https://github.com/OmertaDev/Omerta), public, with `main`
as the default branch. The connector snapshot is stored in [github-snapshot.json](github-snapshot.json)
so GitHub-derived claims are reproducible and visibly dated.

## Current snapshot

The snapshot dated 2026-08-23 contains 126 pull requests: 124 merged, one closed without merge and
one open. The open change is [PR #126, “Redesign OMERTA interface system”](https://github.com/OmertaDev/Omerta/pull/126).
The issue search returned no issue records. That means the issue tracker was empty to the connector;
it does **not** mean the project has no debt, gates or deferred decisions—those are historically kept
in `SPEC.md`, `SIGN-OFF.md`, `BALANCE.md`, launch documents and audits.

For the full PR table, commit authors, first/latest commit and historical hotspots, use
[generated/github-history.md](generated/github-history.md). Every local commit is also a `Commit`
node connected to the artifacts it changed in [graph.json](generated/graph.json).

## What the history says

Recent work clusters into several recurring programs:

- play-session and client-copy verification, especially controls that were silent, misleading or
  exposed despite a server gate;
- deterministic guards that turn each discovered defect class into a permanent check;
- PostgreSQL/concurrency hardening and cost measurement;
- browser security, accessibility, discovery metadata and responsive UI;
- chain/accounting audits, voucher/oracle/hook tests and backend–contract parity;
- content depth, economy design and founder-sign-off records.

The highest-change artifacts are the chronological log, browser console, server registry, schema,
balance register, specification, rules and transaction spine. Treat changes to these hotspots as
cross-cutting even when the diff is small.

## Branch and PR conventions visible in history

- Feature work commonly lands through short-lived `claude/*` or `codex/*` branches.
- Merge, rebase and squash are all permitted by repository policy; auto-merge is disabled.
- PR descriptions often contain the motivation, exact defect shape, mutation evidence and the
  commands run. Preserve that evidence in the PR, but promote durable architectural facts into this
  knowledge base or the specialized graph.
- Savepoint/rescue branches exist because local work has historically needed recoverable handoff.
  They are history/operational aids, not product environments.

## Refresh rule

Before using GitHub counts or open-state claims for a release, audit or roadmap decision:

1. refresh `knowledge/github-snapshot.json` through the GitHub connector;
2. run `npm run knowledge`;
3. inspect the diff in the snapshot and generated history;
4. run `npm run knowledge:check`.

Do not scrape PR bodies into “current truth” automatically. Link them to commits and artifacts, then
validate the claim against the current tree.

