# Hosted economy recovery failure triage

Reviewed source bc5dd9f09d899f1c54fd12f7c0a1b40deeef7bcf; clean branch codex/economy-recovery-hosted-triage before this document. Phase: hosted completed-job cause qualification, not runtime/release clearance. Only this review document changed. Financial/provider/paid-compute activation remains OFF; no real transactions or messages were performed.

| Pull request | Exact head | Run / recovery job | Attempt / outcome |
| --- | --- | --- | --- |
|262|f8657f9c5ce8c19b8af1fdb2c625f712cf07fa57|38306518611 /115001783743|1, completed failure|
|263|bc5dd9f09d899f1c54fd12f7c0a1b40deeef7bcf|38307264576 /115004221395|1, completed failure|

Raw job logs were downloaded with gh api --allow-escape-sequences repos/OmertaDev/Omerta/actions/jobs/JOB/logs; run metadata confirmed exact head_sha/status/conclusion/run_attempt. Job URLs: https://github.com/OmertaDev/Omerta/actions/runs/38306518611/job/115001783743 and https://github.com/OmertaDev/Omerta/actions/runs/38307264576/job/115004221395. Logs retained in ignored output/recovery-hosted-triage. Both services successfully pulled public.ecr.aws/docker/library/postgres:18, became healthy, checked out code and executed native tests. Hosted version is PostgreSQL18.6, Node22.23.3; these are hosted observations, not a local18.4 or mandatory matrix qualification claim.

REC-INT01: deterministic native test fixture failure. Actual next workflow step runs node test/liquidityindexer.js then node test/liquidityqueue.js. test/liquidityindexer.js:125 reset executes TRUNCATE liquidity_sync_cursors,liquidity_flow_receipts,liquidity_settlements,keeper_transactions,vig_revenue,vig_buyback,dex_swaps,pol_fees,desk_buys,family_buybacks,community_revenue,rwa_revenue,sell_tax_events,transactions. Newly present schema.sql:8369 commercial_reputation_settlements.transaction_id REFERENCES transactions(id) prevents truncating the parent without including the child even when empty. PostgreSQL error0A000/routine heap_truncate_check_FKs identifies that exact child/parent and supplies the SQL statement. Both exact heads contain the failing fixture statement. Indexer fails at reset/check before its first case, and queue is not reached.

The preceding separate liquidity accounting step passed all7 cases; liquidity keeper passed11. Initial bounded log search included that preceding group header and led to an incorrect accounting-to-indexer-import chronology in an interim report. Full adjacent log inspection corrected it: there is no such import, accounting passed, and indexer reset is the failing direct caller. Background FATAL role root does not exist entries come from pg_isready health probes; successful service/test execution disproves them as this job's cause.

Recommended coordinator-owned surgical correction: include commercial_reputation_settlements in the SAME isolated fixture TRUNCATE statement, preserving the explicit reset table scope and original tests. Do not weaken the runtime foreign key or use broad TRUNCATE CASCADE as a substitute. A fixture-only retest and fresh hosted exact-head evidence are needed after correction. No source/fixture/CI edit was made by this triage branch and no corrected-test pass is claimed.

The task authorized a single rerun only if the completed job failed on the same pre-checkout external registry quota seen previously. That condition is false for both jobs. No gh run rerun was sent, and attempts remain1; no registry transport workaround is proposed because the official transport actually succeeded. This finding differs from prior PR255 pre-checkout quota failure/retry and cannot be cleared by citing that success.

Review uses bounded actual caller/error/state evidence under the already-read SECURITY-REVIEW-POLICY: manual adapted pinned pashov c577eb7799c349de0acb187ba00ca98e14e436fd dependency boundary pass, Plamen795962b96e254f2e423a2635fe7f8cb8ea1e6d69 concrete failure trace verification, Trail of Bits d3323cefbcf645678b8dc481de204b02ad3d02dc context/schema comparison and false-positive triage. No upstream orchestration, broad code audit, PostgreSQL reset execution, financial activation or deployment claim is made. Only exact-head hosted cause is established here; remediation/retest remain coordinator work.

SHA256 reviewed Windows working-tree source and raw fetched logs:

- test/liquidityindexer.js: b4fbc8779a8bc4fcd563adf62b0fb102732aeaca265bd1b70322469ff972facd
- test/liquidityaccounting.js: b1f438143952b8e869426adfba105c2422bb9723cc1cde9b3ed265f6d429fca4
- schema.sql: ff666405e3f131e91af0099900c94b39dcc646928c389f3c4e3f69bd2d3b5dac
- output/recovery-hosted-triage/job-115001783743-attempt1.log: c6d0b43fb98c77817b6be83a89f26c13422707fad324aa7b0a67898fd12856f6
- output/recovery-hosted-triage/job-115004221395-attempt1.log: 6d03ff7326f33ec95c4a3d1f65f24f04fb8db40e10a2756d0c8568f5a3ba34c0
