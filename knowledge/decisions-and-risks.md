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
| Cash ↔ $OMR | General cash-to-$OMR swapping/laundering is retired. The implemented one-way $OMR-to-cash window defaults open and remains bounded by its funded cash pool and account cap. | `src/rules.tail.js` `EXCHANGE`, `src/exchange.js`, `test/tokenomics.js` |
| Process topology | One API and one worker until process-local state is externalized. | `render.yaml`, `DEPLOY.md` |
| Chain launch | Source and devnet evidence do not establish production activation. A scoped agent-led security review and the deployment/launch gates are separate requirements. | `omerta-contracts/SECURITY-REVIEW-POLICY.md`, `CHAIN-DEPLOY.md`, `LAUNCH-READINESS.md` |
| Agent fairness | Agent accounts use agent keys and stricter cadence. Qualified direct human recruitment may use a separately budgeted one-time claim; raw reach, agent recruits, downstream commissions and human-only faucets remain excluded. | `AGENTS.md`, auth/rate-limit/growth code |
| Acquisition authority | The constellation implements authority, assembly, ingress accounting and fixed pre-vote budgets. Intent execution has topology/identity derivation only; reconciliation has topology only. Authority unpause deliberately reverts while these flows remain incomplete. | `omerta-contracts/src/AcquisitionAuthority.sol`, `AcquisitionVaultCore.sol`, `AcquisitionConstellationFactory.sol`, `PreVoteBudgetBook.sol`, `AcquisitionIntentExecution.sol`, `AcquisitionReconciliation.sol` |

## Current gates

- **Off-chain launch:** engineering is broadly built; environment activation, operational ownership,
  backup/alert verification and a real first-player rehearsal remain operational checks.
- **Agent channel:** the MCP package exists and the machine surfaces are live-shaped; package/version
  and clean-machine verification should precede promotion.
- **Chain:** Foundry/devnet evidence does not replace the scoped review required by the security policy. Do not arm chain
  variables, minters, caps or keepers until the runbook’s complete gate sequence passes.
- **Current contract scope:** Registry/finality foundations, the standalone settlement-gas
  pool and acquisition constellation have distinct implementation and review boundaries. Compare the exact recorded revision
  with `main` and deployment manifests before treating any source fact as deployed or active.

## Risk register pointers

| Risk class | Where it is tracked |
|---|---|
| Technical debt and rewrite assessment | `SPEC.md` §4–§6 |
| Balance decisions and signed levers | `BALANCE.md`, `SIGN-OFF.md`, `test/levers.js` |
| Point-in-time security/game audits | `docs/AUDITS.md`, `AUDIT*.md` |
| Chain threat model and release-review scope | `CHAIN-DEPLOY.md`, `omerta-contracts/SECURITY-REVIEW-POLICY.md`, dated review packages |
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
- A release review needs a package pinned to its exact source and scope. Extending an earlier
  report's counts would falsely imply that changed contracts received that earlier review.

Keep current guidance aligned with the implementation and remove scrapped designs from the working
tree. Preserve dated security findings and retest evidence; Git commit lineage records replaced designs.

