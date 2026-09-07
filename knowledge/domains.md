# Domain map

The repository is intentionally organized as many narrow domain modules around a small transaction
spine. The graph assigns every artifact to a subsystem and assigns source modules to the following
controlled domains. This is a navigation taxonomy, not a claim that domains are runtime-isolated.

| Domain | What belongs here | Representative implementation |
|---|---|---|
| `platform-core` | Auth, route registration, database selection, rules, locking, rate limits, idempotency, health and moderation | `src/server.js`, `src/game.js`, `src/db.js`, `src/auth.js`, `src/ratelimit.js`, `src/rules*.js` |
| `economy-ledger` | Cash/$OMR movements, market/exchange, fees, tax, treasury, emissions, money routing and conservation | `src/economy.js`, `src/exchange.js`, `src/market.js`, `src/invariants.js`, `src/router.js`, `src/treasury.js`, `src/vig.js` |
| `social-combat` | Characters, streets, families, crews, contracts, PvP, heists, soldiers and social bonds | `src/social/`, `src/streets.js`, `src/crew.js`, `src/heists.js`, `src/soldiers.js`, `src/vouch.js` |
| `world-progression` | Skills, mastery, NPC world, seasons, population, standing, discovery and long-horizon progression | `src/world.js`, `src/population.js`, `src/skills.js`, `src/mastery.js`, `src/season.js`, `src/standing.js` |
| `world-graph` | Conserved item custody, static graph validation, graph recipes, mysteries and multi-account operations | `src/worldgraph*.js`, `src/items.js`, `src/crafting.js`, `src/mysteries.js`, `src/operations.js`, `src/routes/worldgraph.js` |
| `enterprise-logistics` | Fronts, rackets, territory, convoys, port, shipping, loans, estates and productive assets | `src/business.js`, `src/territory.js`, `src/convoy.js`, `src/port.js`, `src/shipment.js`, `src/loans.js`, `src/estate.js` |
| `vice-competition` | Casino tables, poker, races, stable, boxing, speakeasy and competitive ladders | `src/casino.js`, `src/ring.js`, `src/races.js`, `src/stable.js`, `src/boxing.js`, `src/speakeasy.js` |
| `law-intelligence` | RICO/law, prison, wiretaps, secrets, dossiers and counter-intelligence | `src/law.js`, `src/pen.js`, `src/wire.js`, `src/secrets.js`, `src/collection.js` |
| `chain-economy` | Wallets, fees, vouchers, finalized event observation, NFTs/deeds, staking, bonds, DEX automation, stock acquisition/allocation, settlement gas and bank protocol | `src/chain.js`, `src/watcher.js`, `src/finalizedobservation.js`, `src/fees.js`, `src/nft.js`, `src/dexbot.js`, `omerta-contracts/src/` |
| `engagement-growth` | Onboarding, coach, opportunities, retention, push, community, referral and public discovery loops | `src/growth.js`, `src/engagement.js`, `src/opportunities.js`, `src/community.js`, `src/push.js`, `src/home.js` |
| `client-experience` | Main console, admin/wiki/arena/play, PWA behavior, art and accessible interaction copy | `public/` |
| `agent-experience` | Machine onboarding, MCP, OpenAPI and ranked opportunity discovery | `AGENTS.md`, `omerta-mcp/`, `/openapi.json`, `/v1/opportunities` |
| `delivery-assurance` | Tests, audits, invariants, CI, performance/concurrency harnesses and recovery evidence | `test/`, `tools/`, `.github/workflows/`, `AUDIT*.md` |

## Product capability index

The complete product list is too deep to repeat in every navigation page. Use this sequence:

1. [SPEC.md](../SPEC.md) §3 for the human capability inventory.
2. [Generated module map](generated/modules.md) for the current implementation footprint.
3. [Generated route catalog](generated/routes.md) for the exposed HTTP surface.
4. [Generated database catalog](generated/schema.md) for persisted state.
5. Search [graph.json](generated/graph.json) or run `node tools/knowledge.js query <term>` for the
   connected neighborhood.

## Important cross-domain dependencies

- Nearly every stateful domain depends on `platform-core` for rules and transaction boundaries.
- `economy-ledger` crosses every money-moving system; a domain feature is not complete until its
  reasons reconcile in `src/invariants.js` or another named bucket check.
- `world-graph` uses its own canonical production manifest and append-only item event authority. It
  crosses `economy-ledger` only for the exact `$300` hardened-steel sink; every other Phase 1 action
  is cash-neutral and all are $OMR-neutral.
- `client-experience` is intentionally thin in authority but very broad in reach: it exposes most of
  the route surface and has historically been a high-change hotspot.
- `chain-economy` spans both backend and Solidity. Tests must prove encoding/parity on both sides,
  not merely unit-test each side in isolation. Implemented dormant foundations are not production
  reachability: RegistryV2/finality, SettlementGasPool and AcquisitionVault O1 each retain explicit
  dependency and launch gates.
- `delivery-assurance` is a first-class domain because real PostgreSQL, browser, concurrency and
  chain behavior cannot be reduced to the in-memory unit suite.

The weighted domain dependency diagram is generated in [graph.mmd](generated/graph.mmd).

