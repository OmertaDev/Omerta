# Company operator native migration qualification

Reviewed source: `f208404b0060c4ee6a9c2eadd1c566eec9c65624`, clean owned source; base/runtime schema revision `4bd478a866d36b4fa645c82a9855c551f7816d85`. Date: 2026-10-12. Scope: `test/director-migration.js`, frozen `test/lib/phase2-architecture-upgrade-catalog.json`, and this review. No production schema/runtime, server, worker, package, CI, census, KG or other layer files changed.

Inspected actual source definitions for `company_operators` and `company_operator_receipts`, including nullable `price_policy`. Captured the two tables' PostgreSQL 18.4 catalog once in a fresh owned schema after applying the pinned full schema. Manually compared every captured PK/FK/CHECK and required column with source. These reviewed values were then added literally to the committed frozen catalog. The migration test reads only that frozen file for expectations; it never learns/blesses expected definitions from the live backend at test time.

Exact reviewed inventory: `company_operators` has six constraints and eight NOT NULL columns; `company_operator_receipts` has five constraints and seven NOT NULL columns. `price_policy` remains optional. All prior 440 added constraint entries, removed entries, and 68 existing required-column inventories were preserved exactly; the catalog now has 451 added entries and 70 required-column inventories. Existing optional feature manifest counts remain unchanged; the two explicitly named additions make the tested optional slice 15 tables / 165 constraints.

All preexisting migration and negative controls remain in place. The generic missing/altered/unknown-constraint and required-column removal/addition controls now cover the two new tables too. Additional targeted controls remove and alter each of their eleven PK/FK/CHECK constraints individually, and assert that making `price_policy` mandatory fails exact nullability verification. Unknown tables remain outside recognized optional features and still fail preservation checks. No wildcard or backend-discovered expected table/constraint exemptions were introduced.

Executed `COORDINATION_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/postgres node test/director-migration.js`, exit 0, on Node v24.19.0 and native PostgreSQL 18.4 (`server_version_num=180004`). Read-only version/user/database verification preceded catalog creation. The owned loopback proof cluster is separate from production; the actual test creates its own random `director_migration_*` namespace and drops it in `finally`. The one-time catalog namespace was also fresh and dropped. No ambient `DATABASE_URL` or live production target was supplied. PostgreSQL 16 was **not** executed locally, and no PostgreSQL 16 qualification is claimed.

Actual proof output: populated baseline `44f48a743e549591bd125a1f678099b8382dd78f`, two production `migrateSchemaUnderLock` passes, original/canonical/Director populated history preservation, exact frozen optional 15-table/165-constraint/nullability slice, missing/altered/unknown causal negatives PASS. Director replay and native invalid revision/FK/duplicate receipt controls remain executed. `node --check test/director-migration.js` and `git diff --check` passed.

This bounded test-only qualification applies the existing agent-led review policy's source/trust-boundary, specification comparison, native persistence and causal negative-control methods. It does not claim another upstream orchestration, broad operator audit, deployment or activation. Runtime operator behavior and worker qualification remain their separate parent review; the new checks qualify only exact additive migration shape/preservation at this pinned source.

Retained ignored evidence in `output/company-operator-migration-review/` includes the once-only capture/freeze scripts, raw capture and preservation proof, and actual Director migration output. SHA-256 hashes below refer to observed Windows working files/evidence; the source commit is the immutable text authority:

| Artifact | SHA-256 |
| --- | --- |
| `test/director-migration.js` | `7610aee9f4d3afc9f485d8266827cf9dc839c79b57f8f9d0c21365b530438dc3` |
| `test/lib/phase2-architecture-upgrade-catalog.json` | `1c83cbcc7b31bd8d2e1551ae41b8f975fbdbe37f92b570e7aaa9596ede66e7a2` |
| Pinned `schema.sql` (unchanged) | `b4cdf1855502c362ce15d87f2c7ba86cc9d1279796876a6b8e7e040c1ffbf3a1` |
| `catalog-capture.json` | `61ade13ad9c497e04087a768a5b9471c4a34e236327fc8c3a7eb7bb8c58bb4f8` |
| `catalog-preservation.txt` | `aef9105bd3b655f5e9dd2d69b4fc3a2cdfbd556b9dd965e22340056697dd9b78` |
| `director-migration-native.txt` | `008e0a694934a6354367b989b4ab38a467bdd8f17757b72d7b5cac7f61c74daa` |

No unresolved failure remains in this bounded PostgreSQL 18.4 migration qualification. Coordinator merge/KG/PR/release work and any PostgreSQL 16 CI execution remain separate.
