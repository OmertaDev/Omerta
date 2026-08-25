# Maintenance

The knowledge base is useful only if adding and checking it is part of normal engineering work.

## Ownership and cadence

- The author of a cross-cutting change updates the relevant curated page in the same PR.
- The generator owns everything under `knowledge/generated/`; never hand-edit those files.
- Refresh the GitHub snapshot when remote state is material, especially before releases, audits or
  planning reviews.
- Review taxonomy, stale current claims and superseded decisions quarterly.
- Archive and supersede historical evidence; do not delete the record of why a decision changed.

## Normal change workflow

1. Change the code, schema, contracts, tests or documentation.
2. Update curated knowledge if the architecture, domain ownership, decision, gate or runbook changed.
3. Run `npm run knowledge`.
4. Inspect generated diffs. Large unexpected route/table/import changes are investigation signals.
5. Run `npm run knowledge:check` and `node tools/graph.js check`.
6. Run the smallest native tests, then the environment-specific gates required by the change.

`tools/knowledge-test.js` is part of the main suite and fails when generated artifacts drift, provenance is
missing, an edge dangles, or a major surface unexpectedly collapses.

## Refreshing GitHub state

`knowledge/github-snapshot.json` is deliberately explicit rather than fetched inside the generator.
That keeps offline builds deterministic and avoids turning a documentation check into a networked
credential dependency.

Use the GitHub connector to replace the snapshot with:

- repository identity, visibility, default branch and merge policy;
- all pull requests with number, title, state, merge state, dates, branches, author and URL;
- issues with state, labels, dates and URL;
- a `fetchedAt` date.

Never persist access tokens, private email addresses, secrets or unpublished personal data. After
refreshing, rebuild and inspect the generated GitHub history.

## Adding a durable insight

A new curated insight should include:

- one specific statement;
- confidence (`high`, `medium`, `low`);
- method/evidence class;
- date and scope;
- controlled tags from `taxonomy.md`;
- source links to code, tests, measurements, audits, decisions or GitHub;
- related, conflicting or superseding insights.

Promote only facts that will matter across sessions. Transient debugging logs, credentials and
one-off speculation do not belong here or in the ContextPlus memory graph.

## Integrity expectations

- Every graph node has file, commit or canonical-URL provenance.
- Every current artifact has a version.
- Every graph edge resolves at both ends.
- Every current artifact belongs to a subsystem.
- Deleted historical paths remain addressable through commit lineage.
- Static extraction limitations are stated; no inferred edge is sold as stronger evidence.
- Generated counts outrank old prose counts.

If the generator cannot represent a new relationship honestly, extend the ontology and its tests
before adding a guessed edge.
