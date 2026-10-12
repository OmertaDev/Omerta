# Integrated company workflow API, dispatcher and estate proof

Reviewed test source `4b7933a62618cb047565dfcfdc71ebf03440d97b`, against coordinator runtime `129ab229990c2b9c0d3a460ed75f731081fd1f5c`. Date 2026-10-12. Phase: actual isolated game-cash integration proof before deployment/activation. Only `test/companyworkflows.js`, new `test/companyworkflow-integration.js` and this review were changed by this agent. Shared runtime, schema, worker, gateway, catalog, package, CI, migration and source-guard work remain coordinator-owned and unedited.

The integrated test requires actual `buildServer` workflow routes; no manual route registration is used. It enrolls signed owner/agent JWTs, configures company identity through the separate owner route, opens actual supplier/merchant/buyer depots, and builds merchant inventory with canonical goods purchase → funded market fill → depot receive. It pays for a real warehouse claim, accepts the supplier's real delivery commitment and canonical funded loan offer/take, then creates the workflow through the actual agent API. These are real canonical source operations, not invented cargo, stock, financial rows or completion metadata.

Actual procurement uses committed depot purchase, custody uses canonical paid warehouse deposit/withdraw journal sequences, and the existing delivery route performs full financed delivery/repayment. Workflow advancement observes these authoritative receipts and pays zero. Before/after cash and transaction-count snapshots prove metadata advancement, completion/replay and worker observation do not add payment. HTTP replay is verified through the actual `x-idempotent-replay` header. Foreign JWT board/cancel/advance requests fail appropriately. Actual cancel is terminal; receipt replay does not reopen it.

The proof invokes the same `runCompanyWorkflows` function wired into the worker, not a substitute loop. Its source default/worker call is bounded at 20; controlled `limit1` runs exercise finite selection and fairness: an earlier pending chain reschedules 60 seconds, then a later ready chain advances. A second real error candidate uses ordinary stock purchase without committed-procurement spend authority; its journal cannot serve as valid workflow procurement. The worker rejects that proof, rolls back, reschedules and lets the later ready chain advance. Cash/transaction snapshots remain unchanged during both dispatcher cases. It observes canonical work; it does not purchase, deposit, deliver, invoke providers or initiate extra spending.

Native evidence exercises exact same-key API concurrency with one canonical consumed proof and replay (a legitimate `409 in_progress`, if observed, is retried without relaxing the single-proof assertion), enclosing proof transaction rollback, and source-depot lock wait followed by freshly observed deadline expiry. Controlled stale-candidate interleavings capture an actual due-row read, then apply a concurrent future dispatch timestamp or actual authenticated API cancellation before the real worker executes. Its real CAS preserves the newer schedule and terminal status; it cannot overwrite/reopen concurrent changes. These are deterministic interleavings against PostgreSQL, not a claim of launching multiple daemon processes.

Actual authenticated mod estate invokes canonical `runEstate`, whose shared hook closes the original active chain as failed. The original account's JWT resolves to the heir, which cannot advance that chain; exact historical create receipt replay remains metadata only. Production `runLedgerInvariants` passes after the actual source lifecycle, worker fairness/estate and native concurrency/rollback/CAS cases; the integrated named `company workflow provenance` check must be present and pass, with no manually appended checker. There is no new money/cargo bucket or financial activation.

The inherited core test retains its seeded component fixtures and all old/foreign proof, stage order, bound, concurrency, rollback and expiry controls. Its dead-row/manual-heir scaffold was replaced with actual canonical `runEstate`; completed historical metadata remains replayable. Its synthetic source rows are not claimed as a global cash/real loan origination proof. The new integration fixture supplies that stronger canonical source and whole-ledger evidence. The core seeded boundary budget remains seed1947 / 300 valid-invalid quantity cases.

Executed final commands on Node v24.19.0: `node test/companyworkflows.js`, `node test/companyworkflow-integration.js`, and both corresponding `--postgres` commands using explicit `COMPANY_WORKFLOW_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/company_workflow_core_integrated_20261012_b` and `COMPANY_WORKFLOW_INTEGRATION_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/company_workflow_api_integrated_20261012_b`. All four exited 0. Fresh owned native PostgreSQL 18.4 was verified read-only before database creation; native preflight requires empty public schemas. Both owned tests passed syntax checks and `git diff --check`.

Native guards reject ambient `DATABASE_URL`, remote endpoints, arbitrary database names and populated public schemas. Only explicit own `company_workflow_*` loopback databases are allowed: local `pilot_runner` on 35439/35449 with PostgreSQL 18.4 or hosted-CI `postgres` on 5432 with PostgreSQL 16/18.4. Output reports the observed backend version. PostgreSQL 16 was not run locally; mandatory hosted CI remains coordinator-owned and no local PG16 qualification is claimed.

Retained harness observations: WF-HAR01, merchant fixture funding of $1,000 could not preserve the canonical $1,000 treasury reserve while restocking; funding was corrected to $2,000, without changing runtime rules. WF-HAR02, pg-mem does not implement integer × interval in the fixture due-clock expression; the fixture now binds an explicit Date timestamp, while the actual dispatcher SQL remains unchanged and tested. Original failing configurations were reproduced in isolated ignored harness copies and their raw failures retained, rather than relabelled as product defects. No unresolved runtime finding remains in this bounded proof.

Review reapplied the agent-led policy's pinned manual caller/authority, economic source/accounting, specification comparison, static triage, persistence and causal-negative methods to this integration boundary. Scope includes the actual registered API, dispatcher function, canonical estate and global invariant seam; the 30-second daemon timer itself was inspected as wiring, not launched as a background process. No broad operator, provider, contract/token or whole-platform deployment conclusion is claimed.

Observed Windows working-file SHA-256 values (source commits remain immutable text authority):

| Runtime/test | SHA-256 |
| --- | --- |
| `test/companyworkflows.js` | `60537158be666add555de506564faacb8d214a4266a851c56b1ec873649beb5c` |
| `test/companyworkflow-integration.js` | `e986589fcbaee65ac2d775dc5b0999d0b9895eb3a342ab3bf7a4a16ecb1cc871` |
| `src/companyworkflowrunner.js` | `4ea6cf01f4bef7cf7e43ffa3683175b44ede58ea018fb8e6f2454099fb9f41f8` |
| `src/companyworkflows.js` | `9c8afc95df0ebc1c613c99d24c10bf0ecfd1ea7c17b83e053b765618eb516c82` |
| `src/social/estate.js` | `d0f76428efcc93a113752482beaf51538a3be6b8597f766f8e1b6e342da3efa9` |
| `src/invariants.js` | `d1f336289697af14245ae6aff9b965c33cbc5be8979a4a5ecb1741bc59c73de2` |
| `src/server.js` | `b36d28b06bae0e2ac62a90b93691267d8ae5091682b391a2a638eaa7009c372c` |
| `src/worker.js` | `db079d044f9931916dd976c213094df3feb7a7acb4167f2c11fd03bd1b4efd74` |

Retained ignored evidence under `output/workflow-integration-review/`:

| Evidence | SHA-256 |
| --- | --- |
| `memory-core-final.txt` | `0c8a6779140e89273011983937411ae21b17575082c6b34450780903982b7174` |
| `memory-integration-final.txt` | `234f0d3775636b4e287c4ca097d2c4aad2b3e2da44546e7891c435b909181e9e` |
| `native-core-final.txt` | `19dd078eb8fae51c253f2f545acb8cb170fa1d0e86159607b07d5f3de031c938` |
| `native-integration-final.txt` | `fb78bb4257da62366a8bb6265a8d78fbf7e6e95bf594d4d9d4af6df148162792` |
| `static-triage.txt` | `40105bf9c25bb178dfb6efd7297d0f65e651d2166393fdb23f5566f1c6e1badc` |
| `fixture-underfunded-failure.txt` | `f000ce9c45e219a7ca5d3246cbba119d0f584b94938df46f7f636f2ec344acd4` |
| `fixture-interval-failure.txt` | `c5d95dcf3225c5409e567ebce4343532bbd27156bed033771ac89f02f4bbe95d` |

The reproducer copies and initial successful local runs are also retained. Conclusions apply only to the pinned supplied runtime and tests in this isolated local PG18.4 phase; later material changes or hosted CI/deployment remain separate. No push, PR, merge, KG/census regeneration, provider payment or activation was performed here.
