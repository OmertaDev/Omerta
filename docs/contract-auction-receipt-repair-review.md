# Contract auction receipt fixture repair

Proposal baseline: `6cfb087392d868c72502e44d6f0c107f85d31d3b`. Scope is only `test/contractauctions.js`; runtime, schema, qualification gates, package and CI are unchanged. This is a test-harness finding, not a runtime double-award finding.

## Finding and correction

Hosted run `38459248492`, PostgreSQL 16 job `115510346203` and PostgreSQL 18.4 job `115510345872`, both failed the same-key concurrent award assertion: the second request returned canonical `409 in_progress` while the first was processing. `src/server.js` explicitly returns this response with `Retry-After: 1`; completed receipts replay the original response. The general fixture helper incorrectly required immediate 200 from both concurrent requests.

The general helper remains strict. Only this same-key award control retries, using the unchanged original actor, URL, body and request key, at most ten calls. It waits one second only for exact 409/in_progress with the canonical header; all other errors fail immediately. A real PostgreSQL row blocker must make the actual handler wait on `contract_auctions`; a raw duplicate and the retry helper must both observe the genuine transient response. Release then permits one canonical award; returned commitment IDs agree and the original single-commitment/global accounting assertions remain.

All existing funded-order, sealed consent/ranking, loser-no-cash, canonical procurement/fulfillment, replay, eight-bid bound, cancellation, estate, source/policy drift, late rollback and post-lock expiry assertions are retained. No simulated provider, new financial authority or external activation is involved.

## Review and evidence

Three adapted policy passes cover the HTTP receipt boundary and failure traces (Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd`), canonical reservation/accounting preservation (Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69`), and specification/static diff/invariant comparison (Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`). These are focused manual methods, not claims of upstream tool execution or Solidity fuzzing.

Exact release lockfile dependencies were installed with `npm ci`. Memory suite passed. On 2026-10-13, unchanged executable source `20e8cc3f1a8e9d1136e049905727a4b0ce26d3d0` passed the full native fixture with exit 0 against fresh owned `contract_auction_test_receipt_20261013_2118` on loopback port 35449, role `pilot_runner`, verified PostgreSQL 18.4. The fixture's initial empty-public-schema guard passed. It delivered actual 409/in_progress/Retry-After=1 during the canonical row wait, required the retry helper to observe that response, and then verified one commitment plus all existing lifecycle/accounting controls. No local PostgreSQL 16 proof is claimed. Syntax and whitespace checks pass. Hosted failure logs and local evidence are retained outside the managed checkout under `agent-economy-state/team-evidence/company-operators/contract-auction-receipt-repair-20261013`; `native-proof-manifest.json` records source and log hashes.

The focused fixture repair is qualified by memory and native PostgreSQL 18.4 proof at that executable pin. Coordinator-owned final-source and hosted release checks remain separate requirements. Runtime/schema were unchanged; this result grants no broader release, deployment or financial activation authority.
