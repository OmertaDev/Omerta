# Reproducing the RC1 decision

This package is validation evidence for a blocked candidate. It does not enable a
cohort, deploy a service, or activate chain functionality. Read
[RC1-READINESS.md](RC1-READINESS.md) for the decision and unresolved gates.

## Source identities

- Frozen main: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
- Corrected application and hosted gate revision:
  `f31b5290080506f6407a9b7f9a514e2ea020a9d4`.
- Later validation-package commits contain completed evidence and corrections
  to the supplemental browser harness. They do not silently replace the source
  identity of an earlier test. Individual results retain their own provenance.

Use a fresh checkout with full history and `npm ci`. The hosted application
gate uses Ubuntu, Node 22 and PostgreSQL 16. Local browser and population
evidence uses Windows, Node 24.19.0 and PostgreSQL 18. The database used for
native release harnesses must be disposable and bound to loopback. Production
credentials are neither needed nor appropriate.

```sh
git fetch origin
git worktree add --detach ../omerta-rc1-reproduction f31b5290080506f6407a9b7f9a514e2ea020a9d4
cd ../omerta-rc1-reproduction
npm ci
npm test
npm run test:rc1
```

`npm test` includes its `pretest` lifecycle. Running just the `test` string
skips required World Graph, Coordination, item/crafting, Mystery, Player
Command, Director, campaign, opportunity and consequence suites.

## Hosted release gates

The exact commands, service images, environment and dependency pins are in
`.github/workflows/ci.yml`, `forge.yml`, `liquidity-postgres.yml` and
`rc1-recovery.yml` at the recorded source revision. The retained run metadata
and logs in `evidence/gates/` and `evidence/graceful-shutdown/` identify what
actually ran. `gh run rerun RUN_ID` repeats the original workflow and commit;
dispatching a mutable branch later is not an exact reproduction.

The application workflow includes the full suite, SQL parsing, real
PostgreSQL migration and domain lanes, concurrency, chaos, economic
conservation, invite admission and browser/mobile checks. Contract and
liquidity workflows remain separate gates. The Linux recovery workflow adds
nine production server/worker SIGTERM barriers; see its
[reproduction notes](evidence/graceful-shutdown/README.md).

## Player and simulation evidence

Run these from a checkout of the final validation package so its supplemental
browser harness includes the recorded synchronization corrections. Set
`CHROMIUM_PATH` to an installed Chromium executable. Native harnesses use
`COORDINATION_TEST_DATABASE_URL`; they create isolated schemas and clean up
their own fixtures.

```sh
node tools/rc1-mobile-journeys.js
node tools/rc1-campaign-mobile.js
node test/rc1-journeys.js --postgres
node tools/rc1-sim.js --postgres --populations=25,100,500,1000 --seeds=rc1-alpha,rc1-beta --replicates=2 --rounds=2 --output=docs/release/evidence/simulation/native
node tools/rc1-sim-model.js
node tools/rc1-sim-report.js
```

The isolated environmental retest retained its exact wrapper at
`evidence/simulation/retest/runner.mjs`. It was executed as
`tools/rc1-sim-retest.mjs` in the frozen checkout after copying the unchanged
`tools/rc1-sim.js` harness there. Its absolute output path records the original
Windows workspace; adjust that output path when reproducing elsewhere. The
standard matrix command above also executes the same population/seed/replicate.
Run native harnesses serially on the disposable cluster when reproducing the
retained default PostgreSQL lock-table configuration.

The solo browser command is expected to exit nonzero at the documented Family
authority gate. Keep that failure visible. The native population harness
reports `PASS_SCOPED` for its measured workload; its report separately records
the incomplete Phase 4 release gate. Neither a scoped pass nor a fixture-assisted
browser story establishes the entire requested launch journey.

Model seeds reproduce policy inputs. Native operation randomness, UUIDs,
timestamps and operating-system scheduling can differ; compare invariants and
recorded outcomes, not identical database bytes. Evidence must retain the
tested revision, harness identity, runtime, database version, command, exit
status and any fixture limitations.

## Packaging and verification

The final package retains the immutable freeze, corrected source identity,
reports, raw logs, screenshots and machine-readable run results. A source
bundle can be reproduced from the final package commit with:

```sh
git bundle create Omerta-RC1-validation.bundle 626e61b9ab2b14a9dc45566983b70cdc65692839..HEAD
git bundle verify Omerta-RC1-validation.bundle
```

This incremental bundle requires the frozen main commit already present in
the receiving repository. Fetch it into a new local validation branch rather
than overwriting an existing checkout. The output archive's SHA-256 identifies
its exact bytes. No generated archive is a claim that the release gates pass.
