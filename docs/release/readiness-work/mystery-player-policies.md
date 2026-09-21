# Scoped mystery participation policies

This is an actor selection component for RC1-03, not a qualifying matrix run.
`tools/rc1-mystery-policies.js` accepts only an actor ID, seed, scenario ID, logical
time and that actor's public PlayerCommand projection. It neither imports game
services nor accepts a database/observer. `src/player-commands.js` remains the
authority: descriptor syntax cannot cryptographically prove issuance, and every
chosen execution identity must be sent unchanged to the canonical dispatcher.

Source review covers `commandsFor`/`dispatch` in `src/player-commands.js` and the
projected actions in `src/coordination/operations.js`. Direct investigation means
`mystery.start`, `.discover`, `.complete`, `.choice`, `discovery.start` or `.act`.
Knowledge sharing/revocation have separate type counters and count as other
choices, so propagation does not inflate direct investigation. Crafting, items,
world objects, situations and operations also count as other choices; hidden
dependencies never change their classification. New AVAILABLE command types fail
closed until reviewed. `mystery.inspect` is a locked/read descriptor, not an action.

The denominator is **fresh COMPLETED PlayerCommand selections**. Reads, denials,
replays and waits do not count. Legacy crime, travel and other domain choices are
outside this component's denominator; the integrated world policy must account
for them before claiming the whole-archetype percentage. An AVAILABLE descriptor
can still fail its canonical revalidation. Such a denial does not spend quota.

The constraints are fixed before execution:

- **High:** when both classes have issued AVAILABLE alternatives, the first `n`
  fresh completions contain `floor(7*n/10)` investigation choices. Every completed
  block of ten has exactly seven. Incomplete blocks use the lower integer. A
  single available class is a forced choice with separate counters; therefore the
  actual total percentage can differ from 70% and is reported as observed.
- **Low:** every prefix of `n` fresh completions has at most `floor(n/20)` direct
  investigations. A cap-blocked actor chooses a legal other command or deliberately
  waits. Waiting never creates quota. A new actor seeing only investigations can
  therefore remain at zero selections until other legal progress is possible.
  This is deliberate abstention, not a dead-world finding. The caller may still
  attempt its separately authorized legacy actions. No grants or invented commands
  are used to manufacture alternatives.

Expired, locked, blocked, missing-identity and already-settled descriptors are
ineligible. The policy checks the projection's actor ID and schema version, retains
the selected server-issued identity, and ranks equivalent alternatives using the
seed, actor, scenario, decision count and command ID. Projection array ordering
does not affect selection. Truncated projections remain a limited view of available
choices; this component does not infer unseen alternatives or global reachability.

## Integration and restart

Create one policy per actor. Call `choose(view, { logicalAt })`; a command result
contains the unchanged execution identity and public parameters needed for the
runner's existing selected-case options. Persist `checkpoint()` before dispatch.
Pass the exact canonical result to `settle(result)`, then persist again. For a
classified rejection, settle `{ executionId, status: 'DENIED' }`; unknown outcomes
stay pending. Calling `choose` while pending returns the same identity.

`restore(checkpoint)` checks the checksum, policy/actor/seed and counter invariants.
It restores the pending identity and quota counters. It does not restore database
state. A crash after a database commit but before fresh settlement can return a
replay receipt: that result increments `unresolvedReplayCompletions`, excludes it
from the denominator, and blocks further choices. The runner must reconcile its
durable command journal/receipt before continuing; this helper never guesses that
the original fresh completion was counted. Full crash-window reconciliation is open.

## Verification and remaining scope

`node test/rc1-mystery-policies.js` checks 1,000-choice prefixes for both policies,
forced/incomplete choices, waits, unauthorized/locked/unissued descriptors, unknown
types, denial/replay accounting, seed/order determinism and checkpoint corruption.

With `--postgres`, the same test requires `COORDINATION_TEST_DATABASE_URL` on
loopback and a new restricted `RC1_MYSTERY_POLICY_OUTPUT`. It creates an isolated
schema with two declared default-birth character fixtures, uses the real command
engine, checks canonical ledger invariants after each mutation, and records native
choices, full snapshots and policy checkpoints against a clean committed source.
It compares resumed decisions on the same authorized projection; it does not claim
database replay. Native quota alternatives are observed, never fabricated.

The first native execution at `a2688ba6da4cba5bf41476177c1bc637143b43b4`
failed after three commands because scenario underscores violated the recorder's
artifact filename grammar. The failed run and snapshot remain retained. The
filename repair at `972e7f46` passed: 12 fresh discovery commands for high, 12
deliberate cap waits for low, and all 55 canonical invariants. Both native views
offered only investigation, so this is **100% forced high investigation and zero
low selections**, not evidence of 70%/5% native mixed-choice workloads. The next
revision additionally records the exact foreign-actor denial and its unchanged
full-state snapshots.

All 90-day runs, complete whole-policy choice accounting, Knowledge contention,
late-entry recovery, all resource journals, worker lifecycles, full-game replay,
225-cell completion and the production-equivalent soak remain open.
