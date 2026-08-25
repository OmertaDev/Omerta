# Operations and quality

The project treats the in-memory suite, real PostgreSQL, browser behavior, concurrency, recovery and
chain execution as different evidence classes. A green result in one class does not substitute for
the others.

## Delivery topology

`render.yaml` declares three production pieces:

- one `omerta-api` web service;
- one `omerta-worker` background worker;
- one high-availability PostgreSQL database.

Both processes use the same database and shared deterministic secrets. The chain variables are
absent from the off-chain deployment by design. `autoDeployTrigger: checksPass` holds deployment for
CI when a workflow runs.

The full operational authority is [DEPLOY.md](../DEPLOY.md); the no-terminal checklist is
[DEPLOY-CHECKLIST.md](../DEPLOY-CHECKLIST.md). Chain activation is a separate runbook in
[CHAIN-DEPLOY.md](../CHAIN-DEPLOY.md).

## Verification matrix

| Evidence class | Commands / artifacts | What it establishes |
|---|---|---|
| In-memory integration | `npm test` | Broad gameplay and regression behavior on `pg-mem`. |
| Ledger structure | `npm run graph`, `node tools/graph.js check`, `npm run invariants` | Reason/lever coverage and runtime conservation checks. |
| Knowledge integrity | `npm run knowledge:check`, `test/knowledge.js` | Repository/GitHub graph provenance, link integrity and generated-doc freshness. |
| Real PostgreSQL syntax | `npm run pgquery` | SQL strings parse on PostgreSQL. |
| Real PostgreSQL behavior | `npm run pgcheck`, `npm run concurrency` | Migrations, lock order, exactly-once behavior and contended-object correctness. |
| Resilience | `npm run chaos`, backup self-test | Interrupted transactions, restart behavior and recoverability. |
| Performance | `npm run loadtest`, `boardcost`, `pollcost`, `workercost`, `pageweight` | Measured capacity and known cost centers. |
| Browser/mobile | `test/client.js`, `npm run mobile`, PWA tests | Control-to-route wiring, response rendering and viewport behavior. |
| Solidity | `.github/workflows/forge.yml`, Foundry scripts | Contract build, unit/fuzz properties and real-chain encoding provers. |
| Environment | `npm run preflight` | Required, optional and forbidden production settings. |

The generated [command graph](generated/graph.json) links `Command` nodes from `package.json` to the
entry-point artifacts they execute.

## CI workflows

- `.github/workflows/ci.yml` runs the JavaScript suite and the real-PostgreSQL correctness/resilience
  gates on relevant changes.
- `.github/workflows/forge.yml` installs pinned Solidity dependencies, builds/tests the contracts and
  runs the DEX and stock-rail encoding provers.
- `.github/workflows/publish-mcp.yml` manually publishes `omerta-mcp`, preferring npm trusted
  publishing/OIDC after the bootstrap release.

See the generated [document catalog](generated/documents.md) for every audit and runbook, and
`docs/AUDITS.md` for the explicit warning that audits are point-in-time.

## Observability and recovery

- `/health` reports API/database/worker state and request metrics.
- The worker heartbeat makes stalled timed settlements observable.
- `INVARIANT_WEBHOOK_URL` receives private economy/ops alarms; `CITY_WIRE_WEBHOOK_URL` is a separate
  public-safe community feed and must never share the alarm destination.
- Backup tooling creates, verifies and rotates PostgreSQL dumps; the restore rehearsal is part of
  the runbook, not an optional afterthought.
- Chain watchers persist their block cursor and stay behind the head by a confirmation window.
- Kill switches are documented in `LAUNCH-READINESS.md` and `CHAIN-DEPLOY.md`.

## Release gates

There are three intentionally separate doors:

1. The off-chain game can launch after engineering, configuration and operational readiness.
2. The agent channel can launch after the game is populated and the MCP package is verified.
3. The chain cannot arm until Foundry is green, the external audit is complete and the launch review
   is cleared.

At the current documentary snapshot, the external chain security audit is the hard red gate. Never
infer production chain activation from compiled contracts, devnet proof or a green backend suite.

## Known operating constraints

- Keep one API instance until event fan-out, presence and rate-limit state are shared across
  processes.
- Keep one worker until sweeps have distributed ownership.
- Treat PostgreSQL as the capacity and correctness boundary; `pg-mem` is a developer convenience.
- Read CI after every relevant push. A configured gate no one observes is not an operational gate.
- Treat backup secrets and signer material as part of disaster recovery, but never place their values
  in repository documentation or graph memory.

