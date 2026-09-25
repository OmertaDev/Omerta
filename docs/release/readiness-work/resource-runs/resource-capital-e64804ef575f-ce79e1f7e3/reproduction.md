# Retained native operation-capital run

Source: `e64804ef575f1afaa6582ab4f704b614adb926ad`, clean at start and unchanged
through completion. Evidence class: `NATIVE_FIXTURE_ASSISTED`. Outcome:
`SCOPED_PASS`, exit 0. This is not RC1-02 or release clearance.

Executed on PostgreSQL 18.4 at 2026-09-21T03:17:08.113Z through
2026-09-21T03:18:15.113Z (67 seconds). The database name and Node version are in
`result.json`. The original raw artifact hashes all verified before retention.

```powershell
$env:RC1_RESOURCE_DATABASE_URL='postgresql://postgres@127.0.0.1:55438/postgres'
$env:RC1_RESOURCE_OUTPUT=''
node tools/rc1-resource-capital.js
```

The run passed 70 observed boundaries and recorded 60 Family-operation calls,
including nine expected exceptions: six real ledger fault injections, an early
expiry refusal, unauthorized contribution and a new-key terminal execution
refusal. Both concurrent same-key deposits completed with the same response;
only one debit and one custody row persisted. Every canonical capital terminal
disposition was replayed without further movement.

Five nonzero deposits ended with exactly 300 refunded, 100 spent, 100 forfeited
and zero held. The original depositor was killed through the canonical estate
transaction, and the actual replacement received no held capital. Unmodified
application and database clocks passed the expiry fixture's persisted 60-second
deadline. Canonical invariant drift remained at its explicitly declared fixture
baseline throughout. Pool/service reopening preserved exact forfeiture replay.

Fixtures and omissions are authoritative in `result.json` and the
[runner documentation](../../resource-capital-proof.md). In particular, this is a
direct canonical-service proof with a shortened validated expiry fixture. The
production 24-hour lifecycle, natural progression/combat death, HTTP transport and
Player Command, full simulation matrix, deployed operator configuration, and
process-crash/backup-restore recovery remain unproved.
