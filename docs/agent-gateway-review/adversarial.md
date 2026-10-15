# Gateway authorization adversarial follow-up

Phase transition: context-building completed before this adversarial pass. Scope is the authority/replay/confirmation flow pinned in [context.md](context.md), not a complete game or contract audit. Proofs use Node v24.19.0 and disposable pg-mem on 2026-09-21. No PostgreSQL concurrency claim is made.

## GATEWAY-001 — changed terms can execute after a known refusal

Priority: P1 / high for the approval boundary. At the context checkpoint, `confirm` classified HTTP 409, 429 and all 5xx as `executing`; all `executing` retries skipped the preview digest check (`src/gateway/service.js:L89-L102` at that checkpoint).

Executed trace: create a crafting preparation whose authoritative cost is 1; player confirms the exact nonce/digest; dispatch returns 429 before a game action; cost changes to 2; retry with the original nonce/digest returns completed and dispatches again without a current preview check. Thus the original confirmation can authorize new current terms after a rate-limit/refusal, including a change across deployment. The proof uses injected context/dispatch to isolate the actual production Gateway state machine rather than claim a new game-specific cost mutation API.

Observed proof output:

```text
CONFIRMED GATEWAY-001: initial HTTP 429 set executing; changed authoritative cost from 1 to 2; retry completed using original nonce/digest without current preview validation.
```

Required property: known pre-execution refusals must require current approved terms before a later command. Unknown-commit recovery must retrieve/replay a bound authoritative receipt without converting missing receipt into permission to execute newly changed terms.

Regression retained in `test/gateway-consent.js`. At first execution it is expected to fail until the root's remediation changes this boundary. Remediation and retest results are recorded below when available; this checkpoint alone is not release clearance.

Remediation: the root added authoritative committed-receipt lookup before uncertain retry. A missing receipt now requires the current preview and original digest to match before dispatch; 429/contention returns to pending, terminal conflict becomes refused. Recorded receipts can be recovered after proposal expiry without dispatching another game action. This separates receipt recovery from renewed execution authority.

Retest: `node test/gateway-consent.js`, exit 0. Cases exercise 429, terminal 409, and uncertain 503 followed by changed authoritative costs; none can redispatch with old consent. A lost post-commit response followed by expiry and changed costs resolves its stored receipt without another dispatch. Initial failure output was `Missing expected rejection: A known HTTP 429 refusal cannot authorize changed terms on retry.`; the correction is retained rather than erasing the earlier finding.

## GATEWAY-002 — prior preparation visibility assumption

At the context checkpoint, an identical request ID returned the old private preview before invoking current projection checks (`service.js:L27-L31`). The root changed the implementation during review: pending proposals now rerun current context and digest checks; terminal proposals return minimal status metadata. A subsequent attempted stale-preview proof instead threw the current context's `entity_unavailable` refusal. This invalidated the proof against the changed implementation, and the regression is retained in `test/gateway-consent.js`.

Disposition: corrected and retested by `node test/gateway-consent.js`, exit 0. The first combined proof command exited 1 at this refusal after confirming GATEWAY-001; that was not a successful run of all its cases.

## Open recovery limitation

At the context checkpoint, expiry was checked before both pending and executing dispatch (`service.js:L84-L89`). An unresolved executing proposal therefore has no Gateway receipt reconciliation path after ten minutes. This is a recovery/open-question record, not a claim that a double spend was demonstrated. Production receipt recovery and PostgreSQL concurrency tests remain separate evidence requirements.

Follow-up: receipt lookup now precedes expiry for an executing proposal. The focused regression confirms an already committed receipt can be recovered after ten minutes with no new command. An expired proposal without an authoritative receipt still cannot execute. Production PostgreSQL concurrency remains unverified by this memory proof.

## Retest checkpoint and observed UI/API behavior

The following hashes identify the root remediation inspected and used for the passing consent regression, before any later changes:

| File | SHA-256 |
| --- | --- |
| `src/gateway/service.js` | `296bd494b9eeb6ad46ffd4a16ffa495b3fdf1c0b29e482cd9e43d9b7819f5ee1` |
| `src/routes/gateway.js` | `ccf1822c164b5d799bc8dd8564b7bc8c106643ad92e1370abac2d34dfe3d74e9` |

Additional executed checks:

- `node test/muse-gateway.js`: exit 0, actual registry aliases, scopes, confirmation-link framing and untrusted game-content separation.
- `node --check public/consigliere.js`: exit 0.
- Real Fastify server with pg-mem and Chromium: created a delegated Muse grant, called mapped player context, called mapped coordination preparation, followed the reconstructed official client link, clicked player approval, and observed exactly one newly created authoritative coordination instance. The UI rendered the completed receipt and hid the approval button. No browser exceptions occurred.
- The same HTTP smoke verified credential issuance carrying `Idempotency-Key` returns 400 `credential_not_replayable`. This checks the root's guard against putting a one-time plaintext credential in the legacy full-response replay store; the dedicated API suite owns its retained regression.

Observed final focused-test output:

```text
gateway-consent: refused/uncertain retries require approved terms; current visibility and expired receipt recovery pass
REAL SERVER MUSE/UI PASS: opaque grant, no replayable credential issuance, mapped read, mapped prepare, trusted approval link, player-browser nonce/digest approval, exactly one authoritative coordination instance.
```

These results support the bounded corrected consent flow. They do not certify native Muse compatibility or PostgreSQL locking/replay behavior.

## Other inspected paths

Opaque delegated tokens are separate from JWT authority; current grants, account bans, expiry and credential version are checked at call time. Scope checks and caller-independent owner IDs precede context execution. Target URLs come from the allowlist, encoded identifiers and fixed bodies. Returned error framing excludes raw SQL/game error payloads. These observations follow the functions and references in the context dossier; they are bounded inspection results rather than a claim that no defects remain.
