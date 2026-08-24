# Knowledge taxonomy

The repository uses a controlled vocabulary so search results remain comparable across sessions.

## Repository graph ontology

| Node type | Meaning |
|---|---|
| `Repository` | The Omerta repository and its snapshot metadata. |
| `Subsystem` | Runtime/delivery ownership boundary: backend, database, web, contracts, agents, quality, operations or documentation. |
| `Domain` | Product/engineering navigation area defined in `domains.md`. |
| `Artifact` | Every current repository file, including media and otherwise-unclassified files. |
| `HistoricalArtifact` | A path present in Git history but absent from the current tree. |
| `Module` | A current backend JavaScript module. |
| `Route` | A unique literal HTTP method/path registration. |
| `Table` | A unique PostgreSQL table declared in `schema.sql`. |
| `Contract` | A Solidity contract, abstract contract, interface or library declaration. |
| `TestSuite` | A JavaScript or Solidity test artifact. |
| `Workflow` | A GitHub Actions workflow. |
| `Command` | A `package.json` script entry point. |
| `Document` | A Markdown knowledge, design, audit, operations or reference document. |
| `ExternalDependency` | A non-relative JavaScript package import. |
| `Commit` | A commit in the local Git lineage. |
| `PullRequest` / `Issue` | Remote collaboration objects from the dated GitHub snapshot. |

## Relationship vocabulary

| Edge | Narrow interpretation |
|---|---|
| `CONTAINS` | Repository/subsystem contains the target; subsystem assignment covers every current artifact. |
| `BELONGS_TO` | Artifact or route is assigned to a controlled domain. |
| `REPRESENTS` | A richer typed node is the semantic view of an `Artifact`. |
| `IMPORTS` | Static JavaScript relative/package import. |
| `TESTS` | A test artifact directly imports a source artifact. This is not complete behavioral coverage. |
| `DEFINED_IN` | Route/table/contract declaration has this source. |
| `HANDLED_BY` | Best-resolved namespaced domain handler in the route registration. |
| `USES_TABLE` | A source module contains an exact current table name. Direction is intentionally unspecified. |
| `INHERITS` | A Solidity declaration names another local declaration in its base list. |
| `DECLARES` / `EXECUTES` | A package declares a command; the command invokes a repository entry point. |
| `REFERENCES` | A Markdown link or backticked repository path resolves to a current artifact. |
| `HAS_COMMIT` / `CHANGED` | Git lineage and per-commit file touch. |
| `TRACKS` / `IMPLEMENTS` | Repository tracks a GitHub object; a merge-style commit names a PR. |
| `DEPENDS_ON` | Aggregate domain-to-domain import relationship, with a structural weight. |

The specialized graph adds `Lever`, `Reason`, `Check` and `Pattern` nodes with `DEFINES`, `READS`,
`PINS`, `EMITS`, `RECONCILES`, `COVERS`, `CITES` and `MENTIONS` edges. The two ontologies are
complementary rather than duplicated.

## Document status vocabulary

- `current` — intended to describe the present tree; must name its revision/date.
- `generated` — deterministic output; edit the source/generator and rebuild.
- `design` — intended future or pre-implementation behavior.
- `audit` — point-in-time evaluation; findings need an explicit status elsewhere.
- `decision` — an accepted founder/team choice with date and source.
- `runbook` — operational procedure whose live environment must still be verified.
- `historical` — retained for provenance; not current authority.
- `superseded` — replaced by a named newer source, never silently deleted.

## Tags for new curated findings

Use five to eight lowercase tags across these dimensions:

- domain: one value from `domains.md`;
- surface: `api`, `browser`, `database`, `worker`, `contracts`, `agents`, `operations`;
- concern: `correctness`, `security`, `performance`, `usability`, `economy`, `reliability`, `growth`;
- status: `current`, `accepted`, `open`, `fixed`, `superseded`, `conflicting`;
- evidence: `source`, `test`, `measurement`, `audit`, `decision`, `github`;
- recency: `evergreen` or `time-bound`.

Each durable finding should state one sentence, confidence, date, method, scope, tags, source links
and related/superseding findings. Do not mix a raw observation with its conclusion in one unlabeled
paragraph.

