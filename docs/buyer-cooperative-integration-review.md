# Buyer cooperative integrated review

Phase: pre-release game-cash/GIN integration; financial activation remains OFF. Scope is the real registered JWT API, canonical Market order/fill/sweep, canonical runEstate and global conservation checks. No external provider/payment/message calls are exercised or authorized.

Runtime baseline: ac843ad2c444784a78cae377ab3b99aebb9f8a8f. Owned proof: test/buyercooperative-integration.js. Existing test/buyercooperatives.js remains an accurately scoped custody/core test; no source changes or removed negative controls.

Actual proof starts three original members, explicitly funds each cash share and posts a canonical depot-NULL purchase order against the joint treasury. It checks NULL-character journal debits, no organizer pocket debit, canonical paid GIN purchase and market fill, integer partial allocations, original-member claims, personal claim/cancel rejection, public projection privacy, sweep capture, and actual founder/nonfounder estates. Living members retain their rights and bound source order; heirs replay account history without receiving dead-member cash/GIN authority. All three named global joint checks run while custody is nonzero and after claims.

Native additions cover concurrent funding/replayed launch, atomic canonical launch rollback, observed PostgreSQL source-lock wait followed by refreshed expiry, launch versus actual estate source_changed rollback and whole transaction retry, and sweep versus API settle. Worker proof calls the real finite funding-expiry dispatcher, checks no early close and no automatic payout, then original-member claims of partial funding. It does not claim that the worker supplies or purchases GIN.

Manual adapted security passes follow pinned pashov c577eb7799c349de0acb187ba00ca98e14e436fd (authority/replay/economic boundaries), Plamen 795962b96e254f2e423a2635fe7f8cb8ea1e6d69 (state transitions and verified failure traces), and Trail of Bits d3323cefbcf645678b8dc481de204b02ad3d02dc (caller context, invariants, specification comparison and static false-positive triage). No upstream orchestration is claimed. Static inspection found no external authority or fake GIN backing: fixture pocket cash uses an explicit known QA crime journal; GIN always comes through buyGood. Direct domain calls in native races use actual game transaction wrappers and precise source waits; HTTP and the dispatcher are also exercised independently.

COOP-INT01: baseline runner imports dueBuyerCooperativeFunding but core exports buyerCooperativeDueCandidates. Actual dynamic runner import fails before any worker execution. Retained output/cooperative-integration-review/COOP-INT01-runner-missing-export.txt. Coordinator owns correction; no shared runtime change made by this proof branch.

Executed initial memory API/estate/global proof passed before introducing the runner. Existing core memory and fresh native18.4 proof passed, including 500 seeded conservation allocations. Native endpoint verified SHOW server_version=18.4, role pilot_runner, 127.0.0.1:35449, fresh owned database buyer_cooperative_core_integrated_20261012_a. API target buyer_cooperative_api_integrated_20261012_a created fresh and empty. Local PostgreSQL16 is not claimed. Hosted CI guards permit only owned loopback PostgreSQL16/18.4 service credentials; ambient, remote and unowned endpoints are refused.
Correction/retest: COOP-INT01 fixed in coordinator runtime 4fbf49d01e011118a1b64bbac2b9912cf97e7276 by importing/calling actual buyerCooperativeDueCandidates. Final proof source 961374bfe7cdbe1992ced122783b53cea39969b4 includes that baseline; owned test committed clean before the final fresh native run. Actual /v1/buyer-cooperatives routes and all three named global checks pass. Worker-inclusive memory now passes. Native API database buyer_cooperative_api_integrated_20261012_e passed complete proof and exited0; final source-pinned repeat uses fresh buyer_cooperative_api_integrated_20261012_f.

Harness finding COOP-H01: initial native query interceptor accepted only two arguments, dropping pg's callback when a released pooled client was reused. SQL completed while its caller stalled. Corrected forwarding of all query arguments, retained native-harness-callback-initial.txt. This was an owned proof defect, not a runtime money/estate defect. All race/expiry assertions then passed. Early retained native-harness-short-key-initial.txt is a diagnostic attempt; changing its request key did not resolve the stall (request keys of length1 are allowed). No unsupported key-length runtime finding is claimed.

Commands: node --check test/buyercooperative-integration.js; node test/buyercooperatives.js; node test/buyercooperative-integration.js; explicit BUYER_COOPERATIVE_TEST_DATABASE_URL node test/buyercooperatives.js --postgres; explicit BUYER_COOPERATIVE_INTEGRATION_TEST_DATABASE_URL node test/buyercooperative-integration.js --postgres; git diff --check. Node v24.19.0. Evidence lives in ignored output/cooperative-integration-review; no ambient endpoints, shared source edits, deployment, CI16 execution, external economic activation or broad repository audit is claimed.

SHA256 of reviewed working files and retained raw logs (Windows working-tree bytes):

- test/buyercooperative-integration.js: 6b7f384469b8d1f6aa9312e7d09f20b1b8dc05f1aa4075969eef3fe56d657475
- src/buyercooperativerunner.js: 6ca171f4c8a14acfc48d7cb069098c25caea4869fdaa061ffc76d39bee3cf982
- src/server.js: 9f85432bc2baaa9f16809056a23d38679074257415ab20380c1367b14fa553c5
- src/worker.js: e007448eb030fc04c8ecfbca87f849ad091280cf84169705a107344c57725089
- src/market.js: f19b44b32113100633950d810bbadd263d79205db6bf80eb68db18fb093082e2
- src/invariants.js: 7b8659ca937ca11c8b62ad6639fd7c7f31e4ec7cd4070fef274f8889527a1f02
- src/social/estate.js: f7f3c6d64c7622ad7207867c38751205e07b9b2a13846aec6c2a81dfbf0ea30d
- output/cooperative-integration-review/memory-core.txt: 6c840dd0375448073d7b8f3efd448a2a1bd66d3b15639f59555abeed821e44ad
- output/cooperative-integration-review/memory-integration-final.txt: 5e4aa00346e35e39e507fb65cc819b2af3d4ce909d0e3c99abf947aec297e5be
- output/cooperative-integration-review/native-core.txt: 98c152b5dd14485d13a50b7f2af8a6241234fa61e441a3b10db60bea8d3c486e
- output/cooperative-integration-review/native-integration-pinned.txt: 81094ad3f61ac6c1cc3cba4d5bfeb157450137ece5e555675c3430c5fdf53780
- output/cooperative-integration-review/COOP-INT01-runner-missing-export.txt: 822d312243050ac91de7c02d5e7fd53baad4bed6c8f96ba3e57a160abc3a991f
- output/cooperative-integration-review/native-harness-callback-initial.txt: eaf84666b2c30b9f9974d8a9f2973b2ad08ed6d12b136c3a14ac48978807c79d

Final source-pinned fresh native18.4 repeat on buyer_cooperative_api_integrated_20261012_f passed and exited0. Memory final, native core and API passed; no open finding remains in this bounded proof scope.
