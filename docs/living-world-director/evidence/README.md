# Director verification evidence

This package covers the disabled Dock War pilot on `codex/living-world-director`, based on `44f48a743e549591bd125a1f678099b8382dd78f`. It does not authorize production activation. The source manifest records reviewed working-tree hashes; the execution record records commands, environment, exit status and output hashes. The implementation was tested without committing or altering the user's preexisting branch.

All PostgreSQL runs use a disposable, loopback-only PostgreSQL 16.15 cluster. No production database or account is involved. Native Director fixtures allocate isolated schemas; the full-server smoke check has a separate test database. Node is 24.19.0 and npm is 11.17.0; the committed package lock supplies dependency pins.

## Reproduction

Install with `npm ci --ignore-scripts`. Use a disposable PostgreSQL endpoint in the variables below; never point these commands at a live database.

| Command | Required environment | Purpose |
| --- | --- | --- |
| `npm test` | Default disabled flags | Full repository memory, property, API, browser-script, migration, gate and knowledge tests, including Director suites |
| `npm run test:director:postgres` | `COORDINATION_TEST_DATABASE_URL` | Native lifecycle, recovery, all three command journeys, security races and populated upgrade |
| `node test/player-commands.js --postgres` | `COORDINATION_TEST_DATABASE_URL` | Shared command adapter regressions, eight concurrent submissions, process restart and HTTP replay |
| `node tools/pgcheck.js` | `DATABASE_URL`, local test-only `JWT_SECRET` and `MOD_KEY` | Full-server native PostgreSQL checks |
| `node tools/pgquery.js` | `DATABASE_URL` | Prepare all static application SQL against PostgreSQL |
| `node test/gates.js` | None | Repository static and release wiring gates |
| `node test/migrate.js` | None | Additive migration and character-disposition inventory |
| `npm run sim` | None | Existing economy simulation and conservation checks |
| `npm run director:check` | None | Authoring compiler admission |
| `node tools/director-sim.js --output docs/living-world-director/evidence/simulation.json` | None | Nine scenarios, each 1, 7, 30 and 180 modeled days |
| `npm run knowledge` then `npm run knowledge:check` | None | Refresh and verify the repository knowledge checkpoint |

Tests use fixed scenarios and seed budgets, not production traffic. The existing inventory property lane runs 100 seeds and 25,000 actions. The Director report retains scenario inputs, outcomes, recovery, repetition, concentration, opportunity/operation volume and exact resource accounting for all 36 modeled runs. Different horizons overlap and are not independent populations.

## Interpretation

PostgreSQL concurrency and transaction tests establish the tested persistence behavior; pg-mem alone does not. The simulation uses production compiler/selection/pressure functions and a modeled canonical-state adapter; it does not execute six months of real SQL or prove deployment capacity. Static SQL preparation lists unprepared dynamic/nonliteral call sites separately and does not count them as passed statements. Literal authored prose still needs confidentiality review.

The security report preserves resolved findings DSEC-01 through DSEC-09. Retained logs are final successful retests unless the execution record explicitly says otherwise. A knowledge drift run before regeneration is expected and is not represented as a successful final check.

The full `npm test` run passed its complete pretest chain and main sequence through cold-start checks, then found the missing classification of `LIVING_WORLD_DIRECTOR` at the preflight gate. Both Director environment variables are now explicitly inventoried, with direct production reads and unchanged injected configuration tests. The exact remaining `package.json` sequence resumes at preflight in `npm-test-tail.txt`. Its documentation gate found stale module/table/test census claims in `SPEC.md` and `MARKETING-POSTS.md`; the figures were remeasured and the documentation plus playthrough checks passed in `docs-fix.txt`. The final knowledge test runs after evidence regeneration. These outputs together cover the full sequence. Original failures are retained, not relabeled as a successful single invocation.
