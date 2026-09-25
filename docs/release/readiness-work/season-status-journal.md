# Scoped seasonal status and progression journal

`tools/rc1-season-journal.js` exports `snapshotSeasonState(pool)`, `readSeasonRows(client)`, `seasonStateHash(state)` and pure `reconcileSeason(before, after, { logicalAt })`. Inputs contain all columns from characters, account_persistent, season_records, season_recaps, notifications, telemetry, gangs and transactions. Native numeric values retain their exact decimal representation. This sufficient projection covers the declared seasonal checks; it is not a full resource inventory.

Reconciliation requires a complete original seasonal job boundary. A conversion writes its recap before its character/account updates, and the dueling champion is selected from the original eligible roster. Individual internal commit integration requires equivalent invocation context; treating arbitrary partial queries as complete conversions is invalid.

Stored standings are immutable except their one-way crown latch. Each newly committed crown requires exactly one increment on its stored champion account and the matching living-character notification where applicable. First election selection remains explicitly unsupported: this journal does not independently reproduce cached City Standing rankings or Family election. A preserved record is award intent, not proof of ranking correctness.

Character conversion must cross the unchanged original 28-day season boundary. Its original respect determines `levelOf`, recap title and exact `floor(level/2)` prestige units. Recap ownership, kills, conversion telemetry, respect/kills/ELO resets, per-account seasonal spend reset, duel title/notification and Family seasonal marker resets are checked. Crowns, titles and resets are nonmonetary status checks. Prestige uses a separate exact-unit equation. No currency reward is invented or classified.

Unexpected table additions, deletions and fields remain explicit unsupported changes with complete restricted before/after details. In particular, cash movement is returned as unsupported even if every seasonal check passes. The module never grants full resource qualification. It is not yet integrated into the shared world observer.

Run `node test/rc1-season-journal.js`. From a clean committed checkout with a local administrative `RC1_RESOURCE_DATABASE_URL`, run:

```
node test/rc1-native-season-journal.js --postgres
```

The native driver owns a unique database and private external output (`--output=PATH`, `--seed=VALUE` optional). Source is bound before execution and at sealing. It drives all original local worker callbacks for 673 logical hours, starting one hour before a seasonal boundary and crossing two original boundaries 28 days apart. Initial progression, listed-duel and zero-resource Family status fixtures are explicit. Population is disabled by its deployment switch. No post-baseline world status, deadline, outcome or balance is rewritten.

Every seasonal job retains full independently rerunnable inputs and the journal. Corruption controls copy the first native transition into separate native tables, then test missing, rewritten, duplicate and wrong-owner rows/increments. Each copied-table mutation rolls back; the world snapshot must remain unchanged. Native primary-key-free copied tables deliberately admit duplicate evidence rows that the production keys would otherwise reject. Unknown cash is preserved as unclassified. Full canonical invariants accompany the actual world boundaries. Failures and source identities remain retained.

This is fixture-assisted logical-clock coverage on the repaired seasonal source, not natural progression, literal wall-time, HTTP, a concurrency campaign, hosted deployment, dependency attestation or a full simulation/resource pass.
