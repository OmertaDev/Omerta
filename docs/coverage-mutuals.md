# Merchant coverage mutuals

Two original characters can share a bounded equipment underwriting loss using
their own explicitly contributed game cash. Each contributes the same 1–1,000
cash, chooses an explicit deductible of 1 through that contribution, and names
one genuine public equipment-insurance policy per member. Both policies must
still be offered, unaccepted and source-identical when the second member joins.
The invitation lasts at most five minutes. An invitation alone gives its
recipient no financial obligation or death-recovery counterpart.

The reserve is exactly the two contributions. Each original may hold only one
funded mutual position, including its own pending contribution. Each underlying
policy can enroll globally only once; a pool has exactly two policies and at most
two benefits. Per-policy benefit is:

`min(member contribution, max(0, actual canonical insurance payout − collected premium − deductible))`

The source is the existing `equipmentinsurance.js` claim oracle: original owned
precision tool, actual Belladonna wear, actual two-steel maintenance, paired
maintenance payment, insurer payout, premium and residual journals. Caller loss
amounts, borrowed tool assumptions and synthetic events grant no benefit. Both
the insured account and maintenance provider must be outside the two members;
a genuine related-party claim earns zero mutual benefit. Resolving that policy
still permits original-capital recovery. All underlying source records remain
unchanged.

The creator can cancel its pending invitation and recover only its own capital,
including when the invitee dies or a policy changes before activation. Active
members can close after both underlying risks resolve or expire. Closure first
settles any already verified eligible claims, then splits the unused reserve
equally; the lexicographically first original character receives an odd unit.
Neither original can withdraw the reserve while an underlying risk remains live.

An original's genuine estate terminates this mutual's coverage. The shared
preactor union admits at most one additional mutual counterpart per subject;
recovery revalidates the sealed scope before taking policy locks. Existing
verified claims and unused capital settle before the original's exact death
cash is calculated. Surviving actor cash receives only its actual refund delta;
new heirs receive no new mutual authority. Original immutable action receipts
remain replayable.

The authenticated human and agent API has five operations:

- `GET /v1/company/coverage-mutuals`
- `POST /v1/company/coverage-mutuals`
- `POST /v1/company/coverage-mutuals/join`
- `POST /v1/company/coverage-mutuals/claim`
- `POST /v1/company/coverage-mutuals/close`

Mutations require `Idempotency-Key`, exact closed terms and explicit consent.
The server's OpenAPI contract describes every request and result. The only new
cash reasons are `coverage_mutual:contribute`, `coverage_mutual:payout` and
`coverage_mutual:refund`; suffix aliases and foreign currencies are rejected by
the shared ledger vocabulary. Customer vault principal is never read or used as
member capital. This feature adds no external settlement or paid-compute action.

Component checks are `node test/coverage-mutual-core.js` and
`node test/coverage-mutual-adversarial.js`. The actual shared registration,
OpenAPI, preactor scope, estate and global books check is
`node test/coverage-mutual-integration.js`. Native core and integration checks
accept only `--postgres` with their separately named disposable test endpoints;
they refuse ambient database URLs, unknown arguments and nonempty databases.
Shared schema, hooks, registration, catalogs and release wiring must be integrated
and source-qualified together before release.
