# RC1-02 operation-capital proof

Owner: Codex/resource_proof. `tools/rc1-resource-capital.js` exercises the canonical
Family-operation service against a fresh isolated PostgreSQL database. It grants
only a scoped native result. RC1-02 and its full-resource simulation proof remain
open. Existing sealed evidence is unchanged.

Run from a clean committed checkout with lockfile-matched dependencies and an
existing loopback PostgreSQL server. The runner creates and retains a random
database; the supplied URL names an administrative database. Credentials are not
written to artifacts.

```powershell
$env:RC1_RESOURCE_DATABASE_URL = 'postgresql://postgres@127.0.0.1:55438/postgres'
node tools/rc1-resource-capital.js
```

`RC1_RESOURCE_OUTPUT` optionally selects a fresh directory. The default is a
private run directory below the operating-system temporary directory, outside the
checkout. Existing results cannot be overwritten. `--development` permits a dirty
checkout and explicitly labels the result diagnostic. The runner records HEAD and
raw source hashes, rechecks both at completion, and fails if either changes.

The initial fixture supplies four synthetic accounts with 100,000 cash each,
eligibility stats, a Family, a crew and two junker cars. It creates no precompleted
operation. Actual travel, authored knowledge discovery/sharing, salvage, crafting,
role assignment, contribution and approval satisfy the operation's prerequisites.
The capital requirement is the original nonzero 100 cash. Fixture definitions use
separate IDs and world objects. The expiry fixture sets the validated lifetime to
60 seconds; the harness waits until both unmodified application and database
clocks pass the untouched persisted deadline. The production pilot's 24-hour
lifetime remains untested. There is no Family-operation expiry worker; its
canonical `expire` command performs recovery.

Measured branches cover deposit, withdrawal refund, cancellation refund, expiry
refund, successful spend, and original-depositor death followed by replacement
character cancellation and forfeiture. Death uses the real `runEstate` transaction
and heir creation; it never rewrites an `alive` flag. The heir must receive none of
the original capital. Every disposition has an exact same-key replay. A concurrent
deposit duplicate must produce one debit and one held balance. A new execute key
after completion is refused. Closing/reopening the pool and service proves durable
forfeiture replay; this is not a process-crash or backup-restore test.

Real PostgreSQL triggers fail the ledger insert after the relevant debit, credit
or custody mutation. Deposit, refund, cancellation, expiry, spend and forfeiture
must roll back all observed balances, operations, commitments, item custody,
world-object state, receipts and guards. Retrying the failed key must succeed once.
Exact decimal equations attribute each personal and held-custody movement to the
canonical ledger receipts. The final disposition is 300 refunded, 100 spent,
100 forfeited and zero held. The full canonical invariant suite runs at every
boundary; disclosed initial cash/car fixture drift may not change.

Retain `result.json`, `actions.json`, `movements.ndjson`, `initial-state.json` and
`final-state.json`. The result hashes each artifact. Movement journals retain
ordered operation requests/responses, transaction and item receipts, exact
equations, snapshot hashes and clock boundaries. The first unexpected failure
retains its complete observed before/after state and available action context.
Every failed assertion exits nonzero; successful output is `SCOPED_PASS`.

The direct account-scoped service proves canonical mutations, not HTTP transport,
session authentication or the full Player Command dispatcher. Natural formation,
natural material acquisition, combat-earned death, the original 24-hour lifecycle,
full-resource simulation, deployed flags/integrations and crash/backup recovery
remain explicitly excluded. Service flags are recorded; complete operator
configuration is not attested. Scenario names in the inventory identify runnable
proofs and grant no pass without retained execution at the selected revision.
