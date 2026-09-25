# Scoped Crew authority and persistent replay

The native PostgreSQL run at `64c3245a716912d99a2b42c29b2d91ab6cf9277d`
passes 53 denials, 13 exact replay comparisons and one concurrent same-key kick.
This is a partial RC1-04 review, not release clearance. The
[source-bound summary](authority-crew-summary.json) retains source, configuration,
artifact and failure hashes. Runtime source is unchanged from `6368339e`.

All 14 mounted Crew mutation routes have anonymous and account-without-character
denials. Selected additional cases cover member versus leader permissions,
outsiders forging account/Crew fields, foreign-Crew targets and requests, stolen
invitations, duplicate membership, targeting a crewmate, incomplete objective
claims, private chat and membership revocation. Ordinary members can invite by
design; this is exercised successfully rather than mislabeled escalation.

Every denial compares all 368 current-schema authority tables in one native MVCC
statement. Only the persistent HTTP idempotency cache is outside that comparison.
Numbers remain in PostgreSQL JSON text for the full-state comparisons. The run
retains nine distinct full snapshots and 67 indexed artifacts. An independent
process verifies every artifact, all three passing/failed history chains, every
denial and replay comparison, the actual completed response bodies, the concurrent
fresh-effect count and absence of all test-owned Crew schemas.

Successful request acceptance, invitation decline, request decline, leave,
target/clear and chat calls are retried. A historical accepted request does not
rejoin an actor who subsequently left. Kicked members cannot issue a fresh target
or chat write or read the private room. Their historic successful chat retry
returns its old acknowledgement without another write. Two simultaneous same-key
kicks return one fresh result and one identical replay. Complete server
reconstruction preserves subsequent exact kick, old acceptance, chat and target
retries. The separately retained bootstrap comparison changes only the original
`schema_meta.applied_at` stamp; an independent check requires every other row and
field to match. This is not an assertion that complete bootstrap hashes match.

Seven players start with declared funded, level-eligible fixtures and one account
has no character. Initial accrual timestamps are one hour ahead to isolate normal
pre-action settlement from action denials. All Crew creation, membership,
invitations, requests, targets and chat use canonical HTTP. No worker runs and no
gameplay state is rewritten after initialization. These coordination actions leave
character cash, bank, ammo and CB unchanged. They do not prove natural progression
or successful objective reward conservation.

## Retained harness failures

`RC1-TOOL-45` has two failed revisions. At `547d70e3`, the recorder correctly
rejects a nested snapshot artifact path before measured probes. `dd75db51` fixes
paths but incorrectly expects `no_character` for a route whose Crew-first lock
hook correctly rejects absent membership as `no_crew`. `64c3245a` preserves the
existing hook order and requires its exact denial. Both full failed runs and
their history hashes remain in the summary. Neither failure changed production
behavior; subsequent passing checks do not rewrite either failed result.

## Review method and limits

Phase: local prerelease, 2026-09-21. Owner: Codex/root. Entry points are
`src/server.js` Crew routes/authentication/idempotency, `src/crew.js` membership
and leadership functions, and `src/game.js` actor settlement/locking/persistence.
The separately retained context pass follows these callees before testing.
Authentication derives the actor from verified account identity; target parameters
select candidates but do not grant their permissions. Account-keyed membership,
Crew row locks and the membership primary key define admission and removal.
Persistent exact retries reauthenticate but return historic results without
rerunning current Crew authorization; fresh calls check current membership.

The repository policy's pinned Pashov access-control trace, Plamen outcome/order
checks and Trail of Bits context mapping were adapted to these HTTP/native paths.
An existing independent agent returned a compact context record; this is not the
entire upstream per-function orchestration. Crew capacity is a constant, not an
administrator-lowered or random depletable allocation. No contract callback,
signer, proxy or external value rail is involved. Syntax checking ran; no separate
static analyzer or stateful fuzz campaign is claimed.

Still open: the complete role/route crossproduct; objective success/expiry;
character replacement and stale target IDs; opposite-order concurrent
accept/leave/kick/use; capacity races and leader succession; rollback versus
websocket notification delivery; receipt expiry; browser rendering and production
configuration. The context record keeps those questions separate from confirmed
defects. No runtime security defect was confirmed by this bounded run.
