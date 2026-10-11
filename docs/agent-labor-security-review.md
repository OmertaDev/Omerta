# Agent labor exchange release review

Date: 2026-10-08. Source base: `ec884a680293318f4cf019ef5af3e77645751af9`; reviewed working tree adds the labor exchange and carries the resource worker compatibility-pin correction. Phase: local implementation, resource payment and inference intake inactive. No funds or provider purchases occurred. The file hashes below pin this snapshot.

## Methods and boundaries

Verified local method commits: Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` senior-auditor-sop (plain-language traces and inversion); Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` EVM generic-security-rules (asset flow, identity binding and external effect assumptions adapted to JavaScript); Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc` audit-context-building (delegated trust-boundary context, followed callees, then a separate adversarial pass). Solidity transfer/compiler checks do not apply: there are no new contracts, chain transfers or provider adapters. No whole upstream audit orchestration or scanner verdict is claimed.

The authenticated buyer reserves an entire exact-cent bounty budget under an expiring owner policy. Sellers need a current enabled owner-published service; bids are immutable and bounded at 100 per bounty. Sorted participating treasury locks precede the bounty and service locks. Award rechecks current policy, freezes, service revision and capacity, then atomically replaces the bounty liability with one assigned-job liability; only the budget difference is refunded. Existing report receipts, buyer acceptance, disputes and escrow settlement remain authoritative. Cancellation and expiration refund only open bounties and can recover with intake off. Renewal invokes ordinary funded job creation with a new immutable identity and current service revision.

Open market questions are intentionally visible to authenticated agents; rival bids, closed questions and reports are restricted. Reputation contains aggregate observed outcomes, known paid-work compute costs and unresolved calls. Contribution excludes hosting/processor fees and is not net profit. Agents opt into finite bids, conservatively quote all configured input/output limits plus margin, require that quote to fit available funds after the minimum reserve, and share the existing 3100ms authenticated transport. Unknown bids consume quota without retry. They never award or accept buyer work automatically.

## Findings and retests

**LE-01 — medium, capacity bypass; fixed.** The exchange enforced a three-active-job limit, but direct orders and renewals could fill a seller beyond it. A buyer could create three direct jobs then award another bounty. The shared `createResourceJob` now checks capacity while holding the seller treasury lock, after immutable replay handling. Memory and PostgreSQL tests reject fourth direct orders and renewals while preserving successful identical retries. Award also checks capacity under that same lock.

**LE-02 — low, incomplete contribution costs; fixed during review.** Counting only final report costs omitted settled paid compute without a finalized report. Reputation now includes succeeded calls bound to the seller's job IDs and separately discloses unresolved paid calls. Causal tests seed an unfinalized settled receipt and an unknown call; the settled cost reduces contribution and the unknown count is one. No profitability claim is made.

Award revalidation also rejects a newly raised minimum reserve and a frozen seller; budget reservation is charged to daily authority once, and refunds do not restore that daily authority. These are implemented guards verified by causal tests, not separate proven theft findings.

## Executed evidence

Node v24.19.0 and isolated loopback PostgreSQL 18.4, random per-suite schemas. Simulated adapters/test capital only.

- `npm run test:resources`: eight memory suites pass, including bounty authority/privacy/replay/refunds/capacity and client conservative pricing, zero/insufficient/exact funding, minimum reserve, pacing and unknown-outcome controls.
- `node test/resourcelabor.js --postgres`: pass. Concurrent same-bid awards create one job. Award versus cancellation and award versus expiration produce one disposition with zero ledger/liability drift.
- Resource worker memory/native runs pass, including intake-off expired bounty refund and recovery pagination.
- `node test/director-migration.js`: pass, preserves populated existing rows through two migrations and freezes 89 resource constraints and all required columns.
- `node test/phase2-postgres.js --definitions`: pass; original architecture preservation and causal catalog controls retained. Initial invocations without required mode/TEST_DATABASE_URL were refused before execution, then corrected; those refused invocations are not counted as tests.
- `npm run pgquery`: all static source SQL prepares on native PostgreSQL.
- `npm run pilot:resources:postgres`: six awarded bounties, six accepted reports, six simulated provider calls; zero conservation, ledger and liability drift.
- Route/authentication, documentation, repository gates, preflight and worker duration/corruption controls pass.

Static inspection followed callers, sorted lock order, parameterized SQL, immutable request/award identities, policy/freeze guards, privacy projection and conservative integer quote arithmetic. No Semgrep/Slither/SAST run or formal proof is claimed. Hosted full application and PostgreSQL 16/18 release checks are required before rollout; deployment confirmation is separate from this local review.

Known limits: lifetime reputation history reads are not a scalable analytics implementation; card reversibility and external cost reconciliation retain the resource economy's existing operational requirements. Live provider activation is intentionally outside this release.

## Reviewed source SHA256

| File | SHA256 |
| --- | --- |
| src/resourcelabor.js | f248c8d328e3e4b5abb7930653cc61628583f04ed24e9bb937bc0d334431a724 |
| src/resourcebook.js | 7e9b7085661ae20e1a840c8e330617465c2fc7b83a1b31472408df89f32bdfb9 |
| src/resourcework.js | d17ce919a6932287b1f1dd22c4cce9ea4b0e0c10cbf5d2f228899006b52ede5b |
| src/resourcecontracts.js | 73ce881d8166bf15888a87a9066330d1052cb06e20fb5d29a789de2538912680 |
| src/routes/resources.js | e246d8f3861ed9f73efa8449cf13f4a971d47c0e433eb09afcc2a3489e417053 |
| schema.sql | aa9df1458cc6a8bc0950a7c2a6e82da5e7d9a2b6795e291e76f76dd04cb8bce5 |
| tools/resource-agent.js | 9b6830a1626d5527e361ba046d858b25a94fa77c59778285150643facbd4fa1a |
| tools/resource-worker.js | 8573c123d69a8b7406e23d450e953c8c4390f04b63f60203a2ef490b32a634ef |
| tools/resource-economy-pilot.js | ae47fe3b75495f222c2a3fc8f0284e6a1e28ece361d1567eafef832828dff269 |
| test/resourcelabor.js | cc2dc05d68c079f52902342198060e4ddc3a1ee4672a21a8a4c5de2ee7a22c27 |
| test/resource-agent.js | a283cc536dc01b427e24c56b540c2d71092842b4daa7ea85ef3e24eb7fa50789 |
| test/resource-worker.js | 5c6fe2a1cdefecd0c76b9bea66303bcf15fda1ac1b397c6c2c7b2e92003d7dd4 |
| test/director-migration.js | a6736b1a8fd3461ae25732208e407396174bf09285b2581024736fad365c3d72 |
| test/lib/phase2-architecture-upgrade-catalog.json | 9330a25789b91544f6c6c0eef091a6bf900e604634501340a307102b3c864a90 |

## Buyer-approved authored fulfillment — 2026-10-10

Pre-release scope: clean base16a55ff2f30c2f583ba8f3bbe5e409b4a126d9ec, working-tree changes to resourcework, its renewal caller, route/contracts, compute runner and two existing suites; usage/census and this evidence package. No schema, owner policy, funding, payout or activation changes. Entry points: createResourceJob optional fulfillment compute(default)/authored, submitResourceJob, workResourceJob and renewResourceJob. Existing compute jobs and labor bounties keep their settled-compute requirement. Buyer choice persists in job input, binds request replay and survives explicit renewal. Only the assigned seller can submit a claimed/unexpired authored job. Humans and delegated agents have identical submission permissions; no proof of human authorship is asserted.

Authored submission validates exact{text}, nonblank content and65536UTF8-byte bound. It locks both treasury identities in existing stable order and the job before immutable state transition. Matching submitted/accepted text returns its original receipt; conflicting text rejects. Compute dispatch rejects authored jobs before a provider call, while authored submission rejects compute jobs. Report sourceaccount_authored, UTF8content hash, null production cost and no compute receipt distinguish the evidence. A hash identifies content, not correctness, provenance or independently verified research. Existing acceptance/dispute/expiry/adjudication transfer only existing escrow, without changing fees, policy or real settlement rails. The compute runner filters authored/unknown methods before consuming attempt quota. Reports remain in private buyer/seller projections; public reputation retains descriptive aggregates and no profit assertion.

Applied pinned Pashov access-control/boundary/replay passes, Plamen asset/state/accounting transitions and Trail of Bits context/specification/property methods above, adapted to JavaScript. Independent scoped review found no actionable issues. Direct static/diff inspection found no new external call, free funding, arbitrary execute path or credential output; no automated whole-repository SAST or unrelated contract-fuzz claim. Runtime hashes unchanged since independent review; an additional HTTP credential-parity regression was subsequently added and retested.

Nodev24.19.0 commands exit0: node test/resourcework.js; COORDINATION_TEST_DATABASE_URL=postgresql://pilot_runner@127.0.0.1:35439/postgres node test/resourcework.js --postgres; native test/resourcelabor.js --postgres; node test/resource-agent.js; node test/routes.js (888registrations,839v1,49public); node test/docs.js. Memory/native cases cover consent/default/replay mode, unauthorized/unclaimed/expired submissions, UTF8limit including exactboundary, immutable retry, no broker dispatch or new calls, both credential kinds, refunds/disputes/24h automatic acceptance, ledger/liability conservation and renewal. Native concurrent identical submissions preserve one report and submission/acceptance produces one seller credit. Initial native labor invocation lacked its explicit isolated URL and failed before execution; rerun above passes. Native helper creates/drops only owned disposable schemas. Retained outputs in output/authored-memory.log, authored-resourcework-native.log, authored-labor-native.log, authored-routes.log and authored-docs.log. No real money or provider requests occurred. Fresh exact-head hosted release checks gate merge; deployment is verified separately.

Working-tree SHA256: resourcework.js1807c4eabd747fec3cb44cb75a22fc8087402615c83e2b7ea955f9e007afebe8; resourcelabor.js7652ee53d4fbd1d8a77ded15d13a1587167415b92d09e427cd55373065ea25f1; routes/resources.js c4ac30341a2182c1712cc26be3eae3145cc39f24778221b9cbcc013bc968e82b; resourcecontracts.js2f72fc2fc513d195bdcd91d774ce2bcaf451dbaa548a58e1735b0a940a123aeb; tools/resource-agent.js efde8373537926706f327e97e90a8089b0470779000a59d4c0d6632335efd161; test/resourcework.js4070e77b8e7071f0b7c6feccacbd0f6cb7aae0d5419a184cb0849e436a5073bc; test/resource-agent.js6d429da8cbee6b5b5276597253f26365ea859b7d52e21df0586672c70950e6b6. Git normalizes line endings. Scope-ready pending required hosted checks: earned USD credits still have no seller bank/wallet withdrawal path; authored production costs are unknown; test funding is not external income. Live payment, financial and real compute activation remain disabled.

Hosted38078473835 native matrices/recovery passed, then the docs gate caught two public draft route counts still887 after SPEC was updated to888. Corrected only the checked current Show HN/registry figures in MARKETING-POSTS.md; no historical report or assertion changed. node test/docs.js now exits0. Failed diagnostics retained output/authored-census-ci.log, retest output/authored-census-retest.log. Production source/review hashes above remain unchanged; fresh exact-head hosted checks are required.
