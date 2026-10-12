# Integrated company game-cash portfolio qualification

Reviewed test source `cd2ccdf96ced0960378786aad37d334ee0ee6bf0`, against coordinator runtime `c0dfd2b56db4991bd56d4a5ce1ce29d7fe24e5d1`, originating from reviewed core `80b06c49687a051c2b6b169fd7f9a6e7bfecf8bd`. Date 2026-10-12. Phase: actual isolated game-cash API/dispatcher/estate proof, before deployment/financial activation. Only `test/companybankportfolios.js`, new `test/companybankportfolio-integration.js` and this review were changed here; runtime/schema/worker/gateway/catalog/migration/package/CI/source guards/KG remain coordinator-owned and unedited.

The new proof requires actual `buildServer` registration and its signed JWT authentication, with no route-registration or test-auth seam. A separate owner session grants the explicit bounded portfolio policy; its agent credential is refused at the policy route and can only run the current bounded grant. Actual canonical Loans owns every offer debit and open escrow, borrower take, repayment, cancellation/refund, and overdue collection. The proof observes corresponding real state, balances and sticky lifetime spend through these API operations. It adds no customer deposits, money bucket, currency reasons, spending authority or provider/real payment.

The lifecycle funds a $5,000 offer, takes/repays it, funds/cancels another, then funds/takes/collects an overdue third. The $15,000 lifetime budget remains spent after repayment/cancellation/default; another run refuses. Controlled due-time advancement exercises actual overdue collection without claiming a one-hour wall-clock wait. A separate real foreign lender's active debt counts toward the portfolio owner's committed repayment reserve but is not misclassified as owned lending history; the $5,999 starting-capital case refuses another $5,000 offer despite borrowed cash. Stranger authenticated boards expose no portfolio policy/history.

Actual authenticated mod estate runs canonical loan disposition, transfers a legitimate active lender receivable to the canonical heir, and disables the old portfolio grant. The heir can replay exact original-account HTTP receipts, but cannot run that grant with a new key. Known fixture ledger credit supplies independent new working capital, not inherited dead cash. Fresh owner consent preserves the $5,000 lifetime spend and inherited $5,000 active principal; a new $5,000 offer then refuses against the declared $5,000 exposure limit. No old grant authority, refund faucet or invented receivable is inherited.

The proof invokes the actual `runCompanyBankPortfolios` function wired into the 30-second guarded company tick. Its default/worker call is finite20; `limit1` exercises selection/fairness. An earlier policy targets a borrower legitimately busy with another lender's active canonical loan, so its result is idle/funded0, unchanged cash and a new 60-second dispatch timestamp. A later eligible account funds next. Canonical repayment releases the busy borrower; simulated next cadence yields a different auto key and an actual new $5,000 offer rather than permanent replay of the old idle receipt. A real reserve error also rolls back, reschedules and yields the later funded candidate. No policy consent/cap is expanded by dispatch metadata.

Native tests contend two distinct run keys for one lifetime-budget offer and prove exactly one $5,000 debit. Forced enclosing transaction failure restores owner cash, loan count and lifetime spend. Holding an existing canonical loan row while the policy expires proves fresh expiry after source-lock wait. Deterministic stale-candidate interleavings update a future next-run timestamp or execute actual owner policy disable/revision change after the due-row read; real dispatcher CAS preserves those concurrent changes. These are PostgreSQL interleavings against the actual dispatcher, not a claim of multiple launched daemon processes.

Production `runLedgerInvariants` passes across loan lifecycle, actual estate/account receivable exposure, idle/error fairness, and native rollback/contention/CAS cases; its integrated named portfolio authority/lifetime check must be present. The test does not manually append a checker. Inherited seeded core component fixtures remain scoped to domain regressions, not whole-platform money qualification; all existing negative controls and seed1947/300 rate-bound cases remain. Its former manual loan-estate/portfolio-close/dead-row/heir scaffold now uses actual canonical `runEstate` and asserts the actual disabled policy.

Executed commands on Node v24.19.0: `node test/companybankportfolios.js`, `node test/companybankportfolio-integration.js`, and corresponding `--postgres` commands with explicit `COMPANY_BANK_PORTFOLIO_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/company_bank_portfolio_core_integrated_20261012_a` and `COMPANY_BANK_PORTFOLIO_INTEGRATION_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35449/company_bank_portfolio_api_integrated_20261012_a`. All four exited 0. Native PostgreSQL18.4 was verified read-only before fresh owned database creation; native preflight requires empty public schemas. Both test syntax checks and `git diff --check` passed. The native integrated initial successful log is retained and copied unchanged as final evidence; no failure was relabelled.

Guards reject ambient `DATABASE_URL`, remote hosts, arbitrary names and populated targets. Only explicit `company_bank_portfolio_*` loopback databases are allowed: local `pilot_runner` ports35439/35449 on PG18.4, or hosted-CI `postgres`/`pgcheck` port5432 on PG16/18.4. Output reports the observed native version. PostgreSQL16 was not run locally; mandatory hosted CI remains separate and no local PG16 qualification is claimed.

No runtime finding or failing integrated run was discovered in this bounded qualification. Source/runtime trust boundaries, owner-session authority, canonical money signs, account-generation ownership, portfolio budget/exposure invariants, native persistence and causal-negative methods from the agent-led policy were reapplied. The daemon timer was inspected as wiring, not launched. No external finance/provider/contract scope or whole-platform deployment conclusion is claimed.

Observed Windows working-file SHA-256 values (commits are immutable text authority):

| Runtime/test | SHA-256 |
| --- | --- |
| `test/companybankportfolios.js` | `19a7fbc69ede90a2a782dd7c016b18d48e01eb941bb19ea808a19ecdddba963a` |
| `test/companybankportfolio-integration.js` | `1f1d72b54ac84b2b4c47120632bfe8d7f9df339ecf03d8fc2c712ef4f2e2b05f` |
| `src/companybankportfoliorunner.js` | `f6153a3e4c356fa9391d50440aef6bf30e9a9a1ec09f668d640406c01a1480c8` |
| `src/companybankportfolios.js` | `6460053e75c534ae430c2d2c9fe1b133d379391ced81124af59633899a1521be` |
| `src/social/estate.js` | `42500787fa2b8fa424030d92a338e8714b0a728dc95f9383f5a3f97818551c07` |
| `src/invariants.js` | `53d4119046d2a581d1dd2aac28105a7f9320950946b6314a783db4ef224261c2` |
| `src/server.js` | `2ce12b1c96c1115875fc39eea58103feb7c0c4b85207bb8470706a206b32ad4b` |
| `src/worker.js` | `6a7b07828e32e11c6c8cb277195b9738d9b16eac98348d0f63cc6637d878f642` |

Retained ignored evidence under `output/portfolio-integration-review/`:

| Evidence | SHA-256 |
| --- | --- |
| `memory-core-final.txt` | `74d3c057f3e1f8b1f5c294b3a0a7fff4296168164c408256a69a276cee19d024` |
| `memory-integration-final.txt` | `f4d42cc0babab74d504cb48f76a4da4555d6e3db4ca6a4bd6feeb77454358027` |
| `native-core-final.txt` | `5dc1a862cf94493f000e387681e5b29118cf4799c9ce42179dc06ec18e0a5067` |
| `native-integration-final.txt` | `1196a21bf579bf9605296a3f52d9e440528a271e64926fadfa19f9b6b4235320` |
| `static-triage.txt` | `fee33c51b0edce257a75943b9e95b414c389e8730a3f40ed8cf8e303cfd90f0c` |

Conclusions apply only to the pinned supplied runtime/tests and isolated local PG18.4 phase. Coordinator hosted CI, catalog/gateway/migration/guards/KG/PR/release work remain separate. No push, merge, PR, deployment or activation was performed here.
