# Company logistics hubs registered-runtime integration proof

Date: 2026-10-12. Phase: signed gameplay API/global canonical invariant/actual estate integration; real financial activation remains unchanged and OFF.
Runtime source: `880f494311b3aad625ce06af99fcb245b146a351` (`codex/company-logistics-hubs-release`). Validated proof source: `451dc5dfe33e70d246a555b585f84a59aaef8f54`. Changes are restricted to `test/companylogisticshubs.js`, new `test/companylogisticshubs-integration.js` and this review. No shared runtime, worker, estate, invariant, gateway, schema, package, CI, census/catalog/source guard or knowledge-graph edits were made.

Included runtime traces: actual hub route registration/authentication/replay, canonical character pairs, paid premises occupancy, owned warehouse custody, real funded delivery advance offer/take/delivery/repayment, global cash/gin/canonical source invariants and `runEstate` lifecycle. Runtime and test hashes are retained. Excluded: unrelated game/financial surfaces, final merged release gates and deployment. No new worker job exists: signed agents and humans explicitly execute the bounded frozen bundle through real routes.

## Real source basket and actor boundaries

The core test requires the actual registered hub route and no longer injects a raw-JWT fallback. Its first manual `voidLogisticsHubsAtDeath` invocation was removed; actual `runEstate` now performs invalidation. The new integration test obtains genuine human guest and agent JWTs from the registered authentication endpoints and uses the actual company metadata, Depot, commercial premises, warehouse, goods, delivery commitment and delivery finance HTTP endpoints to establish the source basket. Only controlled initial game property/capital are seeded: estate holdings in the authoritative existing table and ledger-backed fixture cash. No property acquisition, external provider, asset mint or chain operation is claimed.

The supported financier is exactly the original paid-premises landlord and the same owned warehouse provider. Every hub execution uses the canonical supplier/landlord pair; there is no framework locking more than two living actors. Buyer identity, funded procurement order and delivered quantity are validated by existing source APIs and their order/commitment locks. Foreign operators cannot set up, accept, execute or see the supplier's private plan; read boards are account-scoped. Extra wallet fields, duplicate references and an active advance placed after an offered source are rejected.

The two-source positive fixture has four actual owned gin units deposited into the paid warehouse, a current paid premises lease, and two fully funded original-financier advances. Source one is taken and active; source two remains funded/offered and untaken. The test explicitly verifies `LOAN.MAX_ACTIVE===1` and that prematurely taking source two is rejected. Acceptance freezes the actual terms and moves no money. A deliberate human run withdraws two owned units and canonically delivers/repays source one. Only after that loan is repaid does a deliberate agent run take the offered second advance, withdraw the remaining two units and deliver/repay it. The cap is never increased.

For each two-unit source at the existing 5000 unit price, canonical gross is 10000, net delivery credit is 9800 and actual repayment is 5500. Lender cash receives repayment minus canonical `loanVig`; borrower cash reflects actual delivery/repayment and, on the staged source only, the canonical loan take. Setup/accept charge no hub fee or create cash. Final warehouse gin is zero, borrower cargo is zero, buyer order contains all four fulfilled units, both loans are repaid and both finance records are settled. Actual warehouse withdrawal journal counts are exactly one per execution.

## Replay, revocation, cancellation and estate

Real HTTP replay preserves the original receipt whether served by the generic middleware or core replay helper; an optional core `replayed` flag is not mistaken for another payment. Full snapshots of actual cash, cargo, warehouse quantity, loans, finance settlements, market quantity, source progress, withdrawal journals and transaction count remain unchanged on run retry. Frozen revision guards prevent competing source execution, and foreign private operations fail before money/custody work.

Cancellation closes only the plan, without refunding paid rent, taking another advance, releasing someone else's cargo or cancelling underlying canonical obligations. Current paid occupancy revocation prevents a run with unchanged funds, gin and source state. The adapted core additionally proves foreign warehouse custody, changed original financier, warehouse expiry and catch-up of an already canonically settled source without extra withdrawal or payment. Historical metadata is not standalone paid evidence.

Actual supplier and landlord estate executions are tested through canonical character pair wrappers. Source inspection confirms hub invalidation occurs after ordinary warehouse/loan/paid-premises transitions and before heir insertion. Draft/active hubs close; paid occupancy follows its existing estate state; owned gin/cash/loan rights follow ordinary canonical estate bookkeeping. Both resulting heirs receive exactly the canonical `500 + 100 * prestige` wallet stake, with no extra hub cash. Same-account historical setup receipt recovery does not reactivate old authority; a new acceptance by the supplier heir is rejected and a supplier cannot run the old landlord's closed hub. Legitimate underlying inherited loan/custody rights are not reclassified as new hub permission.

## Global evidence and native transactions

The new proof calls the actual registered global invariant collector and requires **all** checks to pass, including cash, gin, custody, known-source and `company logistics hub canonical work`. It deliberately corrupts completed-source settlement JSON and proves the actual global collector rejects fabricated progress, then restores and reconciles the canonical record. The core test independently retains its source-level negative invariant regression.

Native HTTP evidence executes two simultaneous human/agent calls against the same two-source hub revision. Exactly one source completes, exactly one owned withdrawal occurs and one source remains pending. The loser reports revision drift; the next explicit revision completes the second source.

Late rollback is proven through test-only pg connection instrumentation that preserves promise/callback acquisition and restores client query/release methods. The wrapper witnesses an actual owned warehouse withdrawal journal, canonical financed settlement write and hub completion before injecting failure at the final run receipt. The expected injected HTTP 500 is retained in the log. All captured cash/gin/loan/finance/market/progress/journal/transaction state rolls back; the same HTTP key subsequently succeeds. No production hook or runtime fix is introduced.

Two actual financial-source loan row waits are observed through PostgreSQL `pg_stat_activity`: one crosses the hub deadline and returns `hub_expired`, and the other crosses a genuine paid-premises expiry after the initial occupancy check and returns `access_expired`. Neither wait permits withdrawal, repayment, new credit or progress. The second regression specifically validates occupancy rechecking after a blocking financial source read, rather than only changing hub metadata.

## Endpoint guards, source pins and executed runs

The existing core variable was verified as `COMPANY_LOGISTICS_HUB_TEST_DATABASE_URL` and deliberately renamed in the authorized test to the dispatch-requested exact **`LOGISTICS_HUB_TEST_DATABASE_URL`**. The new API suite uses **`LOGISTICS_HUB_INTEGRATION_TEST_DATABASE_URL`**. Root package/CI wiring must use those exact names; no runtime environment variable was changed. Both suites reject ambient `DATABASE_URL` before server construction, require a fresh empty public schema and `logistics_hub_proof_*` database name, forbid remote hosts/query/fragment overrides, and allow only loopback local `pilot_runner` without URL password at 35439/35449 on PostgreSQL 18.4, or configured CI `postgres`/`pgcheck` at 5432 on PostgreSQL 16/18.4. Actual observed versions are printed. No local PostgreSQL 16 execution or claim is made.

Retained ignored package: `output/company-logistics-hubs-integration-20261012/`. Node `v24.19.0`; actual local PostgreSQL `18.4`, role `pilot_runner`, existing loopback port `35439`, verified read-only before database provisioning. Core DB: `logistics_hub_proof_core_50eb0246a53a3e4d`; final API DB: `logistics_hub_proof_api_0ec82373cca47e0c`.

| Executed proof | Result |
| --- | --- |
| `node test/companylogisticshubs.js` | Memory exit 0, actual registered source/estate integration |
| `node test/companylogisticshubs-integration.js` | Memory exit 0, real JWT/source basket/both estate paths and all global checks |
| `node test/companylogisticshubs.js --postgres` | PostgreSQL 18.4 exit 0, source contention/rollback/expiry |
| `node test/companylogisticshubs-integration.js --postgres` | PostgreSQL 18.4 exit 0, HTTP source winner, witnessed rollback and both source-wait deadline regressions |
| Retained `guard-proof.mjs` | Twelve pre-connection rejections across both scripts: ambient, remote, unowned name, wrong role, wrong CI password, URL options |
| Node syntax checks / `git diff --check` | Exit 0, no actionable diagnostics |

Core native proof executed at `fe542c7cfcb21af3284077eaeb1e1c2c3f3b5593`; the core file and all runtime/schema files are unchanged at final proof source. Matching core Git blobs are recorded in `core-proof-blob-identity.log`. Final API native proof is at `451dc5dfe33e70d246a555b585f84a59aaef8f54`. Evidence includes `api-memory.log`, `core-native.log`, `api-native-final.log`, `guard-proof.log`, `native-probe.log`, `source-revision.log`, `source-hashes.log` and `static.log`; the core memory pass is recorded in the execution transcript. The expected injected 500 is not a runtime defect or a failed final suite.

## Review methods and conclusion

Applied native adaptations of all three method sources pinned by `omerta-contracts/SECURITY-REVIEW-POLICY.md`: Trail of Bits actual entry/caller/trust/specification mapping; Pashov authorization, replay, expiry and adversarial ownership/source traces; Plamen canonical cash/gin/settlement/estate transitions and verified failure hypotheses. No upstream orchestration or Solidity tooling is claimed. Static input/SQL triage confirms closed hub bodies and source-based identities; the proof uses only test-controlled local instrumentation and parameterized fixture queries.

No confirmed runtime defect was found, and no runtime/core fix was made. The proof validates actual deliberately executed custody-backed bundles and canonical estate invalidation at the pinned source, not a new worker, blanket audit, fulfillment guarantee or independent proof of fungible gin provenance beyond the canonical owned-withdrawal journal. Root owns final merged source/route schemas/gateway/catalog/census/source guards/package/CI and release gates. No real financial activation, external message/provider, new real asset, infrastructure or blockchain/real-money transaction occurred.
