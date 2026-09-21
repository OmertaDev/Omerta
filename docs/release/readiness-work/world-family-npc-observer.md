# TOOL46: NPC formation entered the ordinary player classifier

At original worker `runFamilies` COMMIT, `foundNpcFamily` calls `createGang`,
persists its founder's cash debit, and then sets `npc_flag`, `war_pool` and
`war_pool_at`. The shared observer's ordinary formation subset asserted a false
NPC flag and player defaults. Both frozen root 6368339e and serialization-test
74b29180 worlds retained this rejection before actor sessions. This is a
diagnostic scope defect; the existing runtime transaction is unchanged.

The corrected observer detects NPC formation before applying player defaults.
It still requires stable living NPC character/account ownership, a fresh Family,
one boss membership, original level eligibility, the exact 25000 sink and receipt
owner, unchanged bank custody and exact personal pocket parity. A newly founded
Family cannot acquire cash, ammo or OMR custody. Duplicate/stale receipts and
balanced wrong-owner changes still fail. This is **not NPC Family resource
closure**: receipt reason, full Family fields, war-pool standing/creation and
membership remain explicitly unsupported and retain all restricted before/after
rows. No supported player-formation movement is emitted.

`test/rc1-world-family-npc.js` has sixteen corruption controls, unknown-field
preservation, and loss-of-war-pool-detail rejection. It can independently verify
the exact retained native failures and write private controls:

```powershell
node test/rc1-world-family-npc.js --failure=C:/private/original/first-resource-failure.json --output=C:/private/fresh-npc-retest
```

Source and input/artifact hashes are retained. The old rejection must be preserved
at its original source. Native original-worker observation and exact recorded
replay are separate required integration runs; rerunning saved snapshots alone
does not establish them. Keep any later unrelated native failures visible.

Review phase is pre-release diagnostic repair under the pinned repository
security review policy: caller/transaction trace, scope and ownership boundaries,
exact equations, adversarial amount/owner/replay controls and false-positive
reproduction. No gameplay, provider, chain, full matrix or release claim follows.
