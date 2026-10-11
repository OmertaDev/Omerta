# Delivery advances — implementation review

Phase: game-cash implementation; external payments, real compute purchases and financial activation remain disabled. Runtime implementation `cb0b5a1c93ee83e622843607341eae98fca8ec7d`; release wiring `f9fa44d1c991306c635eed40cf5005fdbbac235e`. Conclusions apply to the listed runtime scope; later exact release checks remain separate. Complete source compatibility predecessor `df4e87984066a296889fbf0173f9179187445b26` preserves the original scope of historical evidence.

## Model and authority

A supplier requests a directed advance against an existing accepted gin delivery commitment. The original independent lender explicitly funds a canonical loan offer; the supplier accepts that actual escrow. The consent/history table creates neither money nor another debt ledger. Canonical loans own capital, repayment, transfers, defaults and estate obligations. Loan terms retain existing bounds and one active borrower loan. No quote or game-cash balance backs an external asset.

The private board and five closed agent gateway operations share the human APIs. Directed requests have exact bounded fields and durable supplier/key uniqueness. The original lender retains consent history; the current canonical loan creditor receives repayment, including paper transfer and lawful succession. Sorted character/account locks precede existing loan, market order, commitment and consent-row locks; row identities and authority are rechecked under those locks.

A complete actual delivery settles the existing market order and repays the full debt in one transaction. The bounded fixture earns 9,800 game cash from 10,000 gross after the canonical 200 fee, then repays 5,500 debt: 275 house vig and 5,225 to the actual creditor. Partial financed delivery is refused. Manual canonical repayment releases the reservation. Buyer interruption does not forgive supplier debt. Deleted/terminal debt projects closed history without recreating value; disabled intake preserves cancellation, take and settlement recovery.

Transaction-local unforgeable permits bind the exact client, request, loan, commitment and supplier. They expire after the authorized callback. Canonical loan take, delivery and lower market fill reject a funded reservation outside this scope; invented JSON fields and deferred callbacks confer no authority. Binding invariants verify immutable quote, canonical debt and terminal receipt relationships alongside the unchanged cash and loan escrow conservation checks.

## Executed evidence

Repository-policy methods were adapted to JavaScript/SQL: caller and asset mapping; authority/replay/recovery traces; numerical and temporal property tests; native concurrency/rollback; invariant corruption controls and static gate triage. This is not a claim that upstream orchestration or a contract audit ran.

- Pure terms: eight cases and 1,500 property trials, including supplied-clock jail/safe-house boundaries and valid fractional balances.
- Domain proof `ef682107c9fafeb7aa374262ad0fa2c12e5e5c23`: memory and fresh PostgreSQL 18.4 funding, actual settlement, creditor transfer, concurrent offer/settlement, manual recovery and injected transactional rollback.
- Bypass proof `dfe8e601220c366d1333008a97216bfc0f232ee0`: memory/native actual canonical loan take, ordinary delivery and lower market fill; fake client authority/deferred contexts leave complete snapshots unchanged. Existing handler bytes at composition revision `1b9ec624afe0092ae1f59ea72f47383ce7ed58b0` matched this bounded proof. It does not qualify later planner/invariant changes.
- API proof `284dcccbcb70356f4f90abe470d2daf5c2f077d1`: memory/native authorization, human/agent parity, exact replay, fractional issued-agent delivery, current creditor and heir, borrower estate deletion/history, disabled intake/recovery, invariant quote/debt/receipt tampering, and real repayment failure followed by one successful retry. Native log SHA-256 `279e36f31759de53149097ed65950ba72a9f00a9dafcdc49afbe568a80bec71c`; memory `4298aa246996e6c511daebb43dc40a88c2780562c07a3cec6bd02653dc97371e`.
- Populated Director qualification at `1b9ec624afe0092ae1f59ea72f47383ce7ed58b0`: two production migrations, existing canonical tables retained, finite ten semantic and eleven native NOT NULL constraints for the new consent table, plus missing/altered/unknown controls. Migration disposition is a historical ledger, not inheritable capital.
- Frozen compatibility proof `4b7e361853d5137ce76dad6822930b9a73db5ae6`: seven complete runtime files, eighteen unique inverse hunks and 67 negative controls. Actual observers compose the invoice inverse before historical guards. Query instrumentation still executes current bytes and records their actual hash. This transfers no new native/financial qualification.

Gateway proof `a72d6dcd58b74512f0347c2c10c589793f4473d5` checks actual OpenAPI operation IDs, Bearer authentication, exact request bounds and empty consent schemas, then invokes the real financial operations through those discovered identities.

Final composition proof at `f9fa44d1c991306c635eed40cf5005fdbbac235e` passed all eight focused runs: five memory/static and three fresh PostgreSQL 18.4 domain, bypass and API runs. Actual source hashes, database identities, commands, statuses and retained log hashes are in `output/invoice-final-evidence.json`, SHA-256 `1b570c266787a058f83fb19e80738b568677eebc2398a234aab40228e8523313`. Hosted full CI remains required.

## Findings and release boundary

**INVOICE-CLOCK-1 resolved:** pure eligibility used wall clock for jail/safe-house helpers despite a supplied quote clock. `c4078abfcb12713388b26ff00b58304726f15b6f` threads the supplied clock; boundary reproduction/retest passes.

**INVOICE-READ-1 resolved:** the initial base lacked the canonical locked private-read helper. Integration of the qualified feature stack supplies that existing helper; actual private board API passes.

**INVOICE-FRACTION-1 resolved:** valid 0.5 pocket cash suppressed issued delivery actions. `ea654f61659e38acfc09b55cf8c95a4f971e054e` admits finite bounded cash totals without rounding; quantity/expense bounds remain integer. Pure and actual issued-agent API controls pass.

**INVOICE-LOCK-1 resolved:** the release gate detected order/commitment-before-loan versus canonical NPC retirement's loan-before-market order. Repair `cb0b5a1c93ee83e622843607341eae98fca8ec7d` takes existing debt first and performs existing-binding cleanup before direct market locks. Exact take and stale-debt/new-request traces pass memory/native; native races and injected repayment rollback pass. Before native log `2dcf1910f7dbf3b97980fef83a3d0e532bb4dd968865c8497b48bdcc36c8d46f`, after `d8fb0ceac8ec745ec85db12171097c8728b10fc003feea8f374548237c7eaf6b`. No lock-gate waiver was introduced.

Hosted PostgreSQL 16/18.4, complete required CI and browser checks, final exact source review, serialized merge/deployment and actual API/worker revision/health verification remain mandatory. No release or activation is claimed here.
