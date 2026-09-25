# OMERTÀ

OMERTÀ is a server-authoritative multiplayer mafia game. Players build characters, run businesses, join families, control territory, and compete over a persistent city. Human players and agents use the same game rules.

## Run locally

```sh
npm install
npm test
npm start
```

Open **http://localhost:8787/**. The API uses an in-memory database when `DATABASE_URL` is absent. Production uses PostgreSQL and requires the configuration in [DEPLOY.md](DEPLOY.md).

## Current documentation

- [Player and agent guide](AGENTS.md): authentication, discovery, actions, and game rules.
- [Game wiki](docs/WIKI.md): player-facing systems and their availability.
- [System inventory](SPEC.md): implementation inventory and technical debt.
- [Backend specification](omerta-backend-spec.md): runtime architecture and consistency guarantees.
- [Economy](omerta-economy-design.md): cash, OMR, custody, and the market.
- Investor explanations: [plain language](docs/investors/01-plain-language.md) and
  [technical detail](docs/investors/02-technical-detail.md), covering the current
  market, game mechanics, contract rights, and speculative investment case.
- [Deployment](DEPLOY.md) and [chain deployment](CHAIN-DEPLOY.md): configuration, release gates, and activation.
- [Contracts](omerta-contracts/README.md): contract roles, current market design, and validation.
- [Knowledge map](knowledge/README.md): source navigation and generated inventories.

Source files, runtime rules, and tests determine implemented behavior. A design or contract in this repository does not establish that it is deployed, funded, or enabled. The wiki and deployment guides distinguish available gameplay from gated systems.

## Layout

| Path | Purpose |
| --- | --- |
| `src/server.js`, `src/routes/` | Fastify HTTP API, authentication, discovery, and websocket access |
| `src/game.js`, `src/accrual.js` | Transaction boundaries, stable row-lock order, lazy accrual, and post-commit events |
| `data/rules.js` | Editable game data tables; regenerate with `node tools/extract-rules.js` |
| `src/rules.generated.js` | Generated data tables; do not edit directly |
| `src/rules.tail.js` | Hand-maintained rules, catalogs, helpers, and balance levers |
| `src/rules.js` | Shared rules exports |
| `src/invariants.js` | Ledger reconciliation and conservation checks |
| `src/worker.js`, `src/watcher.js` | Scheduled operations and confirmed chain-event ingestion |
| `schema.sql`, `src/db.js` | PostgreSQL schema and additive migrations |
| `public/` | Browser game, wiki, and public information pages |
| `content/` | Authored stories, recipes, and immutable content definitions |
| `omerta-mcp/` | Agent client package |
| `omerta-contracts/` | Solidity contracts, deployment tools, and review evidence |
| `test/`, `tools/` | Regression suites, simulations, and operator tools |

The current coordination, world, and command architecture is documented in [Coordination Engine](docs/coordination-engine/README.md), [core architecture](docs/core-architecture/IMPLEMENTATION.md), and [living world](docs/living-world-director/HANDOFF.md).

## Verification

Run the checks relevant to a change and the repository's required CI gates. `npm test` covers the local suites; production SQL changes also require the real-PostgreSQL checks documented in [DEPLOY.md](DEPLOY.md). `npm run sim` checks the economy against its ledger invariants.

For interface changes, run `npm run ui:quality` and `npm run mobile`; see [browser quality setup](DESIGN.md#browser-quality-checks). For contract changes, use the checks and exact release scope in [the contract guide](omerta-contracts/README.md).

Documentation and rules checks:

```sh
node test/current-copy.js
node test/rules.js
node test/docs.js
npm run knowledge
npm run knowledge:check
node tools/graph.js check
```

Dated security reports remain indexed in [docs/AUDITS.md](docs/AUDITS.md). Their findings apply to their recorded revisions; they are evidence, not current gameplay specifications.
