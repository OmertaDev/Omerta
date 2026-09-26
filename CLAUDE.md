# CLAUDE.md — OMERTÀ project context

OMERTÀ is a server-authoritative multiplayer mafia game with an EVM settlement rail targeting Robinhood Chain. Use the current implementation and its tests to establish behavior.

Use the current market in `omerta-contracts/src/market-v2/` as the sole economic model. Public game and investor material should use unversioned wording and omit superseded model comparisons, following `AGENTS.override.md`.

## Sources of truth

- `AGENTS.override.md` contains repository working instructions.
- `SPEC.md` inventories current implementation and technical debt.
- `AGENTS.md` and `docs/WIKI.md` describe player and agent interfaces.
- `omerta-backend-spec.md` describes runtime architecture and consistency rules.
- `omerta-economy-design.md` describes current economic boundaries.
- `src/rules.js`, `src/rules.tail.js`, and `data/rules.js` define actual rules and values.
- `DEPLOY.md`, `CHAIN-DEPLOY.md`, and contract runbooks govern release activation.

## Implementation rules

1. Preserve server authority: client input selects actions, never outcomes or values. Record server randomness in `rng_audit`.
2. Keep rules maintenance separate from game logic. Edit data tables in `data/rules.js`, then run `node tools/extract-rules.js`. The extractor writes only `src/rules.generated.js`. Hand-maintained helpers and balance levers belong in `src/rules.tail.js`; `src/rules.js` re-exports both.
3. Every value movement belongs in the transaction ledger. Preserve conservation, custody, and recognized reason vocabularies. Historical reasons remain readable even when no current action may create them.
4. Use lazy accrual from timestamps. Extend the existing accrual machinery instead of adding global per-player ticks.
5. Keep each action transactional. Use `withCharacter` or the corresponding multi-actor helper, and preserve stable lock order and idempotent replay.
6. Keep post-commit notifications non-fatal. A failed notification must not undo or duplicate an already committed action.
7. Preserve unrelated work. Use an isolated checkout when another task has unfinished changes. Do not discard or publish another task's changes.
8. Run relevant regression tests and required release checks. `pg-mem` cannot prove production PostgreSQL locking or migration behavior; SQL changes require real-PostgreSQL validation.
9. Check CI after publishing changes. A local passing suite does not establish that hosted or production-specific checks passed.
10. Keep secrets, credentials, private keys, and personal data out of commits and generated knowledge.

## Current system navigation

| Concern | Start here |
| --- | --- |
| API and discovery | `src/server.js`, `src/routes/`, `src/agentgateway.js` |
| Transaction and accrual rules | `src/game.js`, `src/accrual.js` |
| Economy and ledger | `src/economy.js`, `src/invariants.js`, `src/rules.tail.js` |
| Authored content | `content/README.md`, `src/content/` |
| Coordination | `docs/coordination-engine/README.md` |
| Commands and projections | `docs/core-architecture/IMPLEMENTATION.md` |
| Living world | `docs/living-world-director/HANDOFF.md` |
| Chain integration | `src/chain.js`, `src/watcher.js`, `omerta-contracts/README.md` |
| Canonical market | `omerta-contracts/docs/market/DESIGN.md` |
| Source navigation | `knowledge/README.md`, `GRAPH.md` |

## Evidence and availability

Implemented, reviewed, deployed, funded, and activated are distinct states. Preserve explicit activation gates. A disabled system must not be advertised as live merely because its source exists.

`BALANCE.md` and `SIGN-OFF.md` retain dated decision records. Their historical rows do not override current source or later decisions. `docs/AUDITS.md` indexes point-in-time security evidence; findings and test counts apply to the recorded scope and revision.

Use historical commit records only when investigating a specific regression or decision. Current contributor instructions must not depend on a discarded prototype or a chronological development log.
