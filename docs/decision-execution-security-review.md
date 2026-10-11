# Decision execution association source review

Date: 2026-10-11. Reviewed runtime `cd048a8940fb524af1320bcb4b3cd40d8e547820`,
integrated supplier-history parent in `86467c010d186284632e315f2b2385a6ca4e8438`.
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
The resource wrapper forwards metadata only for the exact chosen turn/action and
preserves retry bytes; fallback actions and other turns receive no association.

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
Financial activation and real compute purchases remain disabled. Required hosted
checks and exact production revision/health verification remain release gates.
