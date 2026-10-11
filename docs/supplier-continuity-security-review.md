# Supplier commitment continuity source review

Date: 2026-10-11. Phase: bounded client source review and local execution;
hosted release checks and deployment are separate gates.

## Source and dependency

Reviewed feature source: `6e3515c8d72e9e2391f2a27320e96044218aefb4`.
Integrated published storefront parent #229 at
`0f15a64abbbd4e615a011dcde31156c015be709d` in clean merge
`10338ec2bee6ea022ae589362633bc36c3e007e6`. The reviewed client and test bytes
are unchanged by integration. Git source blobs:

- `tools/agent-alpha.js`: `2d40700fed1797e5e3e4f631531f435b7de736a1`.
- `test/agent-alpha.js`: `98c570b386763d48d89c5b2ed1fdba11a2839984`.

Executed working-file SHA-256 (Git normalizes line endings):

- Client: `97412CAF1B890529455610272F17CC67C8586A26F0A868DC36EBC0720B9AAFDB`.
- Tests: `CAEAC97D1917ADFDD2C34DFA64B266EAEE37BAAA94A12A3B14D4020B5F13B7C7`.

## Trust boundary and behavior

Only the supplier profile changes its preference among currently issued actions.
`supplierContinuation` reads the observed identity, accepted commitments with
positive integer remaining quantity, and deadlines after the turn's observation
time. It matches executable progress actions through closed commitment-specific
IDs: purchase, storefront purchase, travel to buy/deliver, and delivery. Earliest
deadline wins; equal deadlines preserve the existing action rank. Missing or
malformed metadata falls back to the existing restricted-role selection.

Metadata selects a candidate and confers no authority. The unchanged allowlist
and conservative-policy check still gate execution. The runner submits only
`turnId` and `actionId` to the fixed Agent Turn executor; it does not execute
descriptor methods, paths or bodies. Native authorization remains the parent
game's recomputation under its canonical locks. General/business profiles,
credential storage, role-bound recovery, idempotency, cadence, owner authorization
and all spending limits remain unchanged. No direct transaction, treasury or
database operation is added.

## Review and executed evidence

Coordinator independent review of exact `6e3515c8` found no confirmed finding.
It checked native restock statuses against the closed matcher, own accepted
commitment/deadline/remaining checks, stable deadline ranking, unchanged policy
and recovery boundaries, and inclusion of the new tests in the default full
Agent Alpha chain and the focused HTTP test coverage.

Adapted pinned methods from `omerta-contracts/SECURITY-REVIEW-POLICY.md`:
Pashov `c577eb7799c349de0acb187ba00ca98e14e436fd` privilege/replay/boundary
passes; Plamen `795962b96e254f2e423a2635fe7f8cb8ea1e6d69` client state/identity
transition inspection; Trail of Bits `d3323cefbcf645678b8dc481de204b02ad3d02dc`
context, specification comparison and adversarial/property checks. This is a
JavaScript client adaptation, not an upstream orchestration or automated broad
SAST claim. Blockchain callbacks, custody proofs and new PostgreSQL concurrency
proofs are inapplicable to this preference-only client change.

Node v24.19.0 on Windows: on feature revision `6e3515c8`, both
`node test/agent-alpha.js --supplier-continuity` and the full
`node test/agent-alpha.js` returned exit status 0. The focused proof covers
priority over new acceptance/open fills, ownership, stale/invalid deadlines,
malformed quantities and identities, executable/closed-ID restrictions, excluded
kinds, policy refusal, and deadline ties. Its finite real loopback HTTP sequence
chooses purchase, travel and delivery despite higher-ranked new work, submitting
only server-issued IDs with distinct idempotency keys. This tests client behavior
against a finite fake API, not new native game-cash settlement.

After integrating the final parent, the focused test again returned exit status 0;
raw output is retained in ignored `output/supplier-continuity-focused-alpha.log`.
The combined full `node test/agent-alpha.js` also returned exit status 0 on
integrated runtime `10338ec2`, with raw output retained in
`output/supplier-continuity-full-alpha.log`, SHA-256
`6A50E71EA7969B6E054D3C79C25A62C924EF5DB24B04E6141FD5120DED95C6D7`.
Focused output SHA-256 is
`3A115DF5016FF94B6B80FA421AA1AF65061226768749D8CB3F87AC437891E095`.
The full suite exercises the inherited credential/ACL, recovery, stale-turn,
transport, exact allowlist and cadence regressions alongside the new continuity
sequence. `node test/docs.js` and `node test/gates.js` returned exit status 0
after integration and the new review document; no new test script mirrors an
already executed test. Structured execution scope is retained separately in
ignored `output/supplier-continuity-proof.json`.

No financial activation, real compute purchase, customer message or owner
spending-authority change occurred. Exact-head hosted checks and a separately
verified release remain required before claiming this behavior live.
