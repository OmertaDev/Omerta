# Decisions, gates and risks

This page records the cross-cutting state a new contributor needs before changing the project. It is
a map to authoritative evidence, not a replacement for the detailed registers.

## Stable decisions

| Decision | Current posture | Authority |
|---|---|---|
| Server authority | Clients submit choices; the server owns values, RNG and state transitions. | `AGENTS.md`, `src/server.js`, domain modules |
| Persistence | PostgreSQL is production truth; `pg-mem` is the zero-setup test fallback. | `src/db.js`, `schema.sql`, CI |
| Economy | Every value movement is ledgered and reconciled; unknown reasons are alarms. | `src/game.js`, `src/invariants.js`, `GRAPH.md` |
| Accrual | Timestamp-driven lazy accrual; no global player tick. | `src/accrual.js`, transaction helpers |
| Concurrency | Stable lock order and idempotency at the HTTP boundary. | `src/game.js`, `src/server.js`, concurrency tests |
| Cash ↔ $OMR | General cash-to-$OMR swapping/laundering is retired; the live window is one-way $OMR-to-cash. | rules, exchange/economy modules, agent guide |
| Process topology | One API and one worker until process-local state is externalized. | `render.yaml`, `DEPLOY.md` |
| Chain launch | Code may exist and be devnet-proven or independently reviewed while production remains dormant. Exact release scope, external audit and the launch ceremony are separate non-negotiable gates. | `CHAIN-DEPLOY.md`, `LAUNCH-READINESS.md`, subsystem plans |
| Agent fairness | Agent accounts use agent keys and stricter cadence. Qualified direct human recruitment may use a separately budgeted one-time claim; raw reach, agent recruits, downstream commissions and human-only faucets remain excluded. | `AGENTS.md`, auth/rate-limit/growth code |
| Acquisition authority | O1 Safe/main-operator authority is implemented and independently approved, but remains dormant and has no ETH outflow. A1 accounting/ingress/budget and A3/R/O2 composition are still pending. | `docs/superpowers/plans/2026-08-27-acquisition-vault-operator-base.md` |

## Current gates

- **Off-chain launch:** engineering is broadly built; environment activation, operational ownership,
  backup/alert verification and a real first-player rehearsal remain operational checks.
- **Agent channel:** the MCP package exists and the machine surfaces are live-shaped; package/version
  and clean-machine verification should precede promotion.
- **Chain:** Foundry/devnet evidence does not clear the third-party security audit. Do not arm chain
  variables, minters, caps or keepers until the runbook’s complete gate sequence passes.
- **Current implementation branch:** RegistryV2/finality foundations, the standalone settlement-gas
  pool and AcquisitionVault O1 exist as reviewed dormant code. Compare the exact recorded revision
  with `main` and deployment manifests before treating any source fact as deployed or active.

## Risk register pointers

| Risk class | Where it is tracked |
|---|---|
| Technical debt and rewrite assessment | `SPEC.md` §4–§6 |
| Balance decisions and signed levers | `BALANCE.md`, `SIGN-OFF.md`, `test/levers.js` |
| Point-in-time security/game audits | `docs/AUDITS.md`, `AUDIT*.md` |
| Chain threat model and external-review scope | current `CHAIN-DEPLOY.md`; superseded 2026-08-21 `CHAIN-AUDIT-PACKET.md`; subsystem plans |
| Launch configuration and operating readiness | `LAUNCH-READINESS.md`, `DEPLOY.md` |
| Specialized graph gaps | `GRAPH.md` §5 |
| Current remote work | `knowledge/github-snapshot.json` |

## Risks that should stay visible

- The browser console and server registry remain unusually large, high-change artifacts. Their
  regression guards are valuable, but change surface is still concentrated.
- Schema evolution is additive rather than managed by a conventional ordered migration framework.
  Fresh-schema success and live-database migration are different properties.
- The API process owns presence and fan-out in memory, which caps horizontal scaling.
- The documentary corpus is much larger than the code navigation layer and contains point-in-time
  statements. Source priority and generated counts are required to prevent stale prose becoming
  authority.
- Some static graph edges are structural leads rather than semantic proof: a table-name mention does
  not say read vs write, and a test import does not prove behavioral coverage.
- Chain systems combine contracts, signer logic, watchers, keepers and operational configuration.
  Auditing only Solidity leaves a material part of the extraction boundary out of scope.
- The current `CHAIN-AUDIT-PACKET.md` file is intentionally historical and excludes later chain
  foundations. A release engagement needs a newly frozen packet; silently extending the old counts
  would falsely imply those later contracts received the earlier review.

When closing a risk, retain the old record and add a superseding source. Deleting the history makes
the same decision expensive again.

