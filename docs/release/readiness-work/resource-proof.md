# RC1-02 native resource proof

Owner: Codex/resource_proof. This package adds a read-only resource observer and a
fixture-assisted PostgreSQL API workload. It does not declare RC1-02 complete.
The previous sealed evidence is unchanged.

Run from a clean committed checkout with an existing isolated loopback PostgreSQL
server. The runner creates a fresh random database and retains it for reproduction.
The URL identifies an administrative database; its credentials are never written
to evidence. The Node dependencies must match the selected lockfile.

```powershell
$env:RC1_RESOURCE_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55438/postgres'
node test/rc1-resource-journal.js
node tools/rc1-resource-proof.js
```

`RC1_RESOURCE_OUTPUT` can select a new output directory. Existing result files are
never overwritten. `--development` permits an uncommitted checkout but marks the
result diagnostic. No development result qualifies as release evidence.

The workload covers both legacy campaign cash branches; OMR paid rarity and desk
recycling; Family cash/OMR tribute; loan offer/cancel/take/repay with OMR collateral;
car salvage and exact hardening inputs/cash/output; daily shipment cap exhaustion
and a commission. It retains canonical HTTP keys, request/completion order,
transaction and item receipts, exact decimal equations, initial/final snapshots,
and hashes. Concurrent identical HTTP requests are checked at one post-batch
committed boundary; a permitted in-progress conflict is followed by an exact retry.

Each command boundary runs the full canonical invariant set. Fixture cash, OMR and
cars produce disclosed baseline drift; the runner asserts that this drift never
changes and every other invariant starts valid. The observer preserves PostgreSQL
NUMERIC decimals without IEEE-754 conversion or tolerance. Internal stack events
must satisfy their own before/delta/after equations. A PostgreSQL trigger aborts
hardening between debit and output; no resource, receipt or guard may survive.
A separate unreceipted-cash negative probe executes in a transaction that is always
rolled back. Server close/reopen proves durable retries but is not a process-crash,
database backup, Linux SIGTERM or checkpoint-restore rehearsal.

`tools/rc1-resource-inventory.js` maps all 13 categories and nine gaps to authorities,
authorization, replay identities, existing test candidates, native scenario names,
and explicit missing native/simulation work. Every simulation column remains
missing until a retained full-game workload executes it. Test-source existence
and a scoped API pass grant no automatic gate clearance.

The next source-bound run must retain `result.json`, `movements.ndjson`,
`requests.json`, `initial-state.json`, `final-state.json`, and
`coverage-inventory.json`. Every failed assertion exits nonzero. The successful
outcome is deliberately `SCOPED_PASS`, with gate status still
`REQUIRED_TRANSITION_PROOF_MISSING`. Remaining branches and deployment-dependent
backing requirements are listed in the inventory, not converted to passing skips.
