# Decision execution association source review

Date: 2026-10-11. Reviewed runtime `cd048a8940fb524af1320bcb4b3cd40d8e547820`,
integrated supplier-history parent in `86467c010d186284632e315f2b2385a6ca4e8438`.
Corrected durable client runtime: `117278fd6e02cf03527f164fbcc48db6cbb1a6a7`;
fresh-wrapper regression: `481ef6aa9a7f80a0dea309c75c77e6897bdc295e`.
Current integration `ead72ef5633c3754b09b981ab0ea0b70635f3bf0` also preserves
the separately released City panel changes. Server bytes remain unchanged.
Phase: source review and local native proof; hosted release and deployment are
separate gates. Server blob `79771473a82bc7a088921dc254031b5e6a10801e`;
normalized SHA-256 `7e599c49c28b6549182cb72f9e3ed7178b40549dea872bc7178ebb67a240ac8c`.

Scope: optional decisionCallId on the existing native action executor, private
resource-call receipt storage, helper validation and resource-agent forwarding.
It grants no new action, spending, compute or payment authority. Calls without
metadata preserve the native result shape and existing execution behavior.

The executor first recomputes the issued action under canonical character locks.
It then locks the caller's succeeded compute call and verifies game_decision
purpose, exact turn and strict JSON selected-action output. A recorded call cannot
be used again. The actual native action executes before its bounded canonical
result digest is recorded, inside the same database transaction. Original error
and rollback behavior is preserved. All solo, loan and storefront lock paths
forward the optional association without bypassing native authority.

Public proof is nine fixed fields. It reveals no provider output, prompt, account,
character, result digest, private result or paid-job data. reasoningVerified and
monetaryProof are false; causalEffect is null. A recorded association does not
prove that additional reasoning improved an outcome or generated external income.
The resource wrapper annotates only the exact chosen turn/action. Alpha validates
that tuple and journals its optional call ID before dispatch. Transport never
changes the journaled request body; fallback actions receive no association.

Adapted pinned methods in the repository security policy: Pashov ownership/replay
and boundary passes; Plamen execution/identity transitions; Trail of Bits context,
specification, adversarial and property checks. Independent integration review
found no confirmed findings. This is not broad SAST or upstream orchestration.
Blockchain transfer/callback proofs are inapplicable to this record-only layer.

Node v24.19.0: helper tests including 100 seeded canonicalization cases passed.
Resource agent selection/retry tests and the full existing Agent Turn suite passed.
Native API tests passed in pg-mem and PostgreSQL 18.4. PostgreSQL evidence injected
a receipt UPDATE trigger failure and proved both native reward and receipt rolled
back; competing human/agent commands with different idempotency keys executed once.
Authentication, foreign ownership, wrong purpose, exact retry, stale replay and
private-field checks passed. Local fixtures made no real provider request or payment.
Raw outputs: output/decisionproofs-api-memory.log, decisionproofs-api-postgres.log,
decisionproofs-api-postgres-race.log, decisionproofs-agentturn.log. The first native
boot lacked the test MOD_KEY; the fixture was corrected before these successful proofs.

The exact twelve server inverses restore the entire previous storefront/City
server blob. Historical pins remain unchanged; their scopes do not qualify this
new execution association. Current tests and source review cover the new behavior.
Finding DECISION-RECOVERY-1 (P2), confirmed on published `4df5ece0`: transport-side
injection retained call metadata only in process memory. A fresh wrapper after a
crash replayed the durable pending key without decisionCallId, triggering
`422 idempotency_key_reuse` instead of recovering cached success. Server guards
prevented duplicate execution, but durable acknowledgement was blocked. A two-wrapper
read-only reproduction confirmed changed request bytes. The remedy removes transport
injection and persists validated association metadata before dispatch. Corrected
wrapper `4254103e`, Alpha `117278fd` and composed restart test `481ef6aa` close this
finding locally. Focused and full current Alpha tests passed: the child computes,
journals the association before POST, is killed after the fake native server caches
one mutation, and a fresh process plus fresh resource wrapper replays identical key
and body. There is one inference and one mutation. Strict malformed metadata and
journals reject before dispatch; legacy four-field pending journals remain valid.
Raw focused evidence: output/decisionproofs-fresh-wrapper-recovery.log. The author's
full current test source is `4fdd74b5960def64c5743e94ca233e1d6873626f`; its separate
full output is retained with source scope, rather than implying the earlier run
contained the stronger composed test. Required fresh hosted checks remain open.

Financial activation and real compute purchases remain disabled. Required hosted
checks and exact production revision/health verification remain release gates.
