# Campaign opportunities and consequence history

The Command Center groups already authorized commands into Urgent, Family, Crew,
Personal, Intelligence and World business. Ranking uses a deterministic tuple of
real opportunity deadline, the viewer's committed role, available action, current
group relevance, active case/operation continuity and action kind. It uses the
projection's timestamp, never behavioral data. Tuple values remain server-side.
The feed explains known requirements, outstanding preparation, collaborators,
progress and time remaining. A ten-minute command refresh expiry is not a campaign
deadline. Inventory pagination never establishes requirement satisfaction.

Commands retain their existing 128-entry bound and opportunities their 80-entry
bound. Group membership/counts derive only from those visible opportunities.
No command means no opportunity. Locked requirements use generic wording. The
browser preserves server order within groups, collapses additional business and
submits the exact issued command identity from every opportunity/consequence card.

`world-consequences.js` reads existing `world_kernel_events` in the aggregate's
read-only snapshot. It creates no event store or mutation path. Only objects
already visible through the Kernel qualify; a public current state does not
authorize private historical states. Each historical state independently requires
its immutable public-state contract or authentic current Knowledge. Actor names,
action IDs, hidden prior states, resource identities, revisions and receipts are
omitted. Only the current character's own canonical event can disclose their own
participation. Active wording compares known current state, not internal revision.

Family and Crew grants authorize private history through the existing Knowledge
service. Grant loss removes that access on the next snapshot. Incoming grant
origin is deliberately absent from the existing Knowledge DTO, so private history
uses the generic `DISCOVERED_INTELLIGENCE` label instead of guessing its source.
Local public aftermath uses `LOCAL_RUMOR`; other public aftermath uses
`PUBLIC_AFTERMATH`.

Trusted `content.consequencePolicies` may specify `{objectId, publicDelaySeconds}`.
The constructor rejects unknown/duplicate objects, extra fields and delays beyond
seven days. A delay only postpones an already public outcome; it never declassifies
private history. Qualifying Knowledge may reveal it earlier. The Canal depot's
authored policy uses one hour. This is presentation timing, not a delay to canonical
mutation or object state visibility.

History uses the `(object_id,next_state,definition_hash,occurred_at,revision)` index.
One read makes at most 64 queries of 25 rows, merging to 24 cards. Windows are ordered
by visible local relevance and stable authored identity. Every query filters
authorized state and publication time before limiting; private/delayed events
cannot crowd out public events or inflate public counts. Truncation only reflects
authorized windows/cards. The command board may associate up to four visible
opportunities with the identical visible world-object subject; this means related
business and does not claim that a particular event caused an opportunity.

## Public contract change

Situation-only `revision` and `situation.act.parameters.expectedRevision` fields
are no longer returned by either player-facing read path. Internal snapshots,
state hashes and immutable stored command descriptors retain them. Current UI
execution already accepts only the opaque execution identity. Existing Kernel and
operation revision contracts are preserved. Revision-only bookkeeping produces no
additional player-visible consequence feedback.

## Verification scope

`test/player-opportunities.js` covers deterministic ordering, real deadlines,
hidden requirements/counts, bounds and related visible work. `test/world-consequences.js`
runs in memory and PostgreSQL using real Kernel mutations, authentic Knowledge,
Crew sharing/departure, persisted history, delayed aftermath, private-state/actor
redaction, hard query budgets and constructor rejection. Existing command,
projection and Director API suites retain stale-state, opaque command, replay,
concurrency, succession and current authorization checks. Client tests execute the
production renderer and verify escaping and issued-action controls. The retained
browser fixture checks production renderer/CSS at 320, 390 and 1440 pixels; it is
layout evidence, while the separate native suites establish domain behavior.
