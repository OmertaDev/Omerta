# RC1 frozen source manifest

Frozen on 2026-09-18 from fetched `origin/main`, before RC1 corrections:

- Commit: `626e61b9ab2b14a9dc45566983b70cdc65692839`.
- Tree: `d8521e6de0c8952234f95f1283ac99aebec0fa63`.
- Application/schema application version: `1.2.0`.
- `schema.sql` SHA-256: `b126f2832cc793bdca43b5655500cd123bcf884cd5f715aa63bf7af3eb5d6fba`.
- Linux LF `schema_meta.schema_sha`: `b126f2832cc793bd`. The implementation hashes checkout bytes, so a CRLF Windows checkout has a different stamp; this is not a separate migration.
- Phase 1 content hash: `96dddeba8d52768298b4b57fe5c0dec303afd7eab604b852a834ccfc4b500ea7`.
- Compiled definition snapshot SHA-256: `628d1a9ac5a7a4b7972a3bdb1e8c207b1b34d2836f8a2211ea4260478e9221c0`.

[manifest.json](evidence/freeze/manifest.json) records 370 source/configuration/dependency blob hashes, all nine Situation hashes and all five Campaign hashes. [definitions.json](evidence/freeze/definitions.json) retains the actual compiled World Graph, operation, Situation, Campaign, mystery package, recipe, and consequence-policy definitions, including dependencies. Hashes of files use exact Git blob bytes, independent of platform line endings. The full commit pins public UI, tests, and every other tracked file as well.

## Change control

The freeze is immutable. Corrected candidates identify their own tested source in [RC1-READINESS.md](RC1-READINESS.md). Permitted correction classes are P0 security/data/economic/authorization/progression integrity, and P1 severe UX/mobile/campaign/deployment/observability failure. No signed economic parameters, schema, World Graph design, Coordination design, or Player Command authority are changed by the freeze. New test harnesses provide release evidence; they do not authorize gameplay or economic activation.

## Director and cohort configuration

Configuration authority: `src/director/config.js`, `src/director/selection.js`, `src/director/runtime.js` (all pinned in the JSON manifest).

| Input | Frozen default | Proposed internal cohort only after gates pass |
| --- | --- | --- |
| `LIVING_WORLD_DIRECTOR` | `DIRECTOR_DISABLED` | `LIMITED_COHORT` |
| `DIRECTOR_ACCOUNT_IDS` | empty | explicit admitted account IDs |
| `COORDINATION_ACCOUNT_IDS` | empty | exactly the same admitted account IDs |
| `CORE_PROGRESSION` | off | on |
| `WORLD_GRAPH_KERNEL` | off | on |
| `COORDINATION_ENGINE` | off | on |
| `COORDINATION_KNOWLEDGE` | off | on |
| `COORDINATION_KNOWLEDGE_SHARING` | off | on |
| `COORDINATION_OPERATIONS` | off | on |
| `INVITE_MODE` | blueprint/example on | on |
| `LIQUIDITY_AUTOMATION_ENABLED` | off | off |

Limited Director and world admission lists must be identical and nonempty; server validation rejects mismatches. Tests turn foundations on in disposable databases. No live flag update or cohort admission is part of this manifest. Actual deployed runtime values and database schema stamp are **not attested** by repository defaults.

## Contracts and economic isolation

Pinned compiler: Solidity `0.8.26`, Cancun, optimizer 800 runs; per-file via-IR restrictions and storage/IR outputs are in `omerta-contracts/foundry.toml`. CI Foundry: `v1.7.1` (`4072e48705af9d93e3c0f6e29e93b5e9a40caed8`); 512 fuzz runs. Dependencies: forge-std `v1.9.6`, OpenZeppelin `v5.6.1`, v4-core npm `1.0.2`, v4-periphery `ad04c9f24a170accf5ea1b2836bbafd514537ca6`, Permit2 `cc56ad0f3439c502c246fc5cfcc3db92bb8b7219`.

This package does not bind a chain ID, deployed address, live runtime bytecode or Safe configuration. It authorizes no chain activation. The cohort configuration must omit chain RPC/signers/contract activation inputs, including `CHAIN_RPC_URL`, `VOUCHER_SIGNER_PK`, `DEX_BOT_PK`, `V4_ORACLE_KEEPER_PK`, and `LIQUIDITY_KEEPER_PK`; liquidity remains off. A separately enabled chain environment requires its existing release manifest and review gates. Source economic rules and contract configuration remain pinned, not retuned for these tests.

## Environment and reproduction

Hosted gate baseline: clean Ubuntu runners, Node 22, lockfile `npm ci`; PostgreSQL 16 for application/concurrency/recovery and PostgreSQL 18 for liquidity/contract integration. Local supplemental runs use Windows, Node 24.19.0 and a new PostgreSQL 18 cluster bound only to `127.0.0.1:55439`. Local runs are labelled separately and are not Linux signal proof.

Production requires `NODE_ENV=production`, a real PostgreSQL database, strong `JWT_SECRET`, `MARKET_SEED` and `MOD_KEY`, and an explicit `SOCIAL_VERIFY_MODE`. Use one API instance and its matching worker source revision, `npm ci --omit=dev`, `npm start`, and `npm run worker`. Preserve the existing rate limits, proxy configuration, database pool limits and shutdown grace. No credentials are included in this package.

To reproduce the freeze, create a clean worktree at the frozen commit, copy `tools/rc1-manifest.mjs` from this package into its tools directory, run `npm ci`, then `node tools/rc1-manifest.mjs 626e61b9ab2b14a9dc45566983b70cdc65692839`. The helper refuses changed source. Compare `evidence/freeze/manifest.json` and `definitions.json` byte-for-byte. Reproduce release gates using the pinned workflows and the individual commands recorded with each evidence file.

## Migration and rollback boundary

Startup uses the existing additive `schema.sql` plus `src/db.js` compatibility migrations and the boot advisory lock. There is no RC1-specific destructive migration. Fresh and historical migration gates must pass against real PostgreSQL. Before admitting accounts, verify the deployed schema stamp, backup/restore rehearsal and matching API/worker revisions.

Rollback follows `DEPLOY.md` section 8c: stop cohort expansion; disable Director exposure; restore both API and worker to the same last verified deploy, retaining the database. A code rollback does not undo committed consequences or refunds. Reconcile pending work through its existing receipt identity. Restore a backup only through the established outage procedure after accounting for mutations committed after that backup.
