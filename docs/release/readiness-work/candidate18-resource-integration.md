# Candidate 18 resource observer integration

Base: `b5c80a4ed921e58792e78f8c4b51de5635182b74`. This isolated integration combines
the tested season conversion, NPC Family formation and NPC car-acquisition classifiers.
It changes evidence tooling only. Production, actor policy, gameplay initialization,
original deadlines, worker callbacks and operational limits are unchanged. Separate
season crown classifier work is excluded.

There is one base native COMMIT observer. `createNpcFamilyCommitObserver` wraps
`createNpcCarAcquisitionCommitObserver`, which extends the existing car collector.
The car witness remains callback argument two; the Family witness is argument three.
The Family adapter captures inside the inner observer's native query call, before its
COMMIT callback. It adds neither a serializer nor database queries. Both collectors'
source pins and separate authority checks remain mandatory.

Each Family, car-acquisition or car-melt candidate gets a restricted artifact containing the complete before/after
resource snapshots, actual boundary and returned-query witness. Its canonical witness
hash and artifact name are included in the resource journal. First-failure capture keeps
both witnesses and full state. Abort checks still require identical resource hashes.
The exact runner-block control inherited from `d33b4606` remains hash-bound; reviewed
changes must rebind it and preserve its existing disabled-path, single-collector,
parameter, retention, failure, overflow and digest controls. Additional Family controls
exercise argument preservation, rollback, failure retention and identity-sensitive hashes.
These synthetic controls prove integration behavior, not canonical gameplay authority.

The predeclared native pair is `quiet_world`, `rc1-alpha`, 25 actors, two logical hours,
all original callbacks and resource observation enabled. Each run retains the existing
1,200,000ms wall limit, 536,870,912-byte output limit and 536,870,912-byte free-space
floor. Gzip decoded/stored/line limits remain 536,870,912 / 134,217,728 / 8,388,608 bytes,
with 64 outstanding invocations and 64 pending records. The external watchdog remains
1,500,000ms. A watchdog or failed assertion is a failure, never a partial success.

Independent verification must check every indexed artifact and history chain, complete
initial/final tables and sequences, all 18 actor-replay fields, exact canonical resource
journal strings including their newline separators, restricted changed-row/witness
references, independent reclassification from exact candidate snapshots, source immutability and verified owned-database cleanup. Actual supported
movements and remaining unknowns are counted from executed evidence; no action is
forced to increase coverage. Positive prestige grants are separate from zero-gain
recap status. NPC war pool remains nonmonetary standing. Full resource, seasonal-duration,
matrix, chain/backing, deployment and human-entry qualification remain false.

Run results and hashes belong to a separate report after the clean implementation
revision is frozen and tested. Prior component passes are retained as historical scope,
not inherited as a pass for this integration.

TOOL56: the first integrated native observation at `65ee96b8` failed on the first
Family COMMIT. Default ten-frame stack capture retained ledger/createGang but truncated
the required population ancestor after the additional composed wrappers. The original
caller check correctly refused it. Diagnostic capture now uses a synchronous 40-frame
limit with `finally` restoration; success and throwing-formatter controls enforce no
global leak. No caller assertion or runtime behavior is relaxed. The failed run has no
seal: its 364-event gzip prefix and full first-resource failure are retained. A subsequent
diagnostic snapshot hit COMMIT-without-BEGIN; that is distinct from the initiating
provenance rejection. The owned database was independently found already absent, so the
audit's ownership guard refused dump/drop. No replacement seal or dump was manufactured.

The fresh native observation and recorded replay both passed at tested source
`94a1a6cda2491747dee2690a597f8b4ec9a0c71c` on PostgreSQL 18.4. The independent
audit passed before this separate report change. Each lane retained 38 indexed artifacts,
1,290 history events and 1,085 resource boundaries: 295 committed, 752 autocommitted and
38 rolled back. All 18 replay fields, complete initial/final contents of 369 tables and
three sequences, and every canonical resource journal string including its LF separator
matched. Resource journal SHA256:
`04f675fe4b431ccd0e59d4530555636e28eef274ca973eb4c94c9dc5007637ff`.

Each lane independently reclassified six NPC car grants and two NPC Family formations
from complete retained candidate snapshots and source-pinned returned-query witnesses.
For all eight actual candidates, the audit required witness boundary = artifact event =
the exact enclosing history resource event, plus journal/witness digest agreement.
The stale-boundary negative control exercises this audit helper; it does not add a
substituted-car-witness rejection inside the composed callback. The reviewed runner
block hash is `7938cd870c9ece7913e15b71266453cbf5de89f53a5a0af9b093f4aae546f14c`;
all 17 integration controls passed. Ambient stack-limit restoration passed on success
and error. The intermediate `ebfc52ee` formatter-control failure is retained separately.

Four NPC seasonal conversions granted exactly 24 prestige; 25 player recaps granted
zero and are status-only. The quiet policy executed eight fresh commands and two
successful crimes in two actor sessions. No car melt or Family rollback candidate
occurred in this workload. The collector's 295 committed witnesses are not 295 car
actions. Both owned databases were independently confirmed absent after cleanup.

Every actual remaining unknown appears below; observation and replay counts are equal.
Both have kind `observed-table-change`, table `season_records`, authority
`original-worker`, and logical time `2026-09-24T00:00:00.000Z`.

| Count per lane | History / native sequence | Outcome | Exact observed change still unsupported |
| --- | --- | --- | --- |
| 1 | 984 / 8251 | AUTOCOMMITTED INSERT | Initial season record and chosen standings, crowned=false |
| 1 | 985 / 8257 | COMMITTED, transaction 226 | Stored crowned false→true and one account season_crowns 0→1 |

Source review identifies `runSeasonRollover` → `recordReckoning` for these changes;
this integration does not add an authoritative query witness or classify their election,
crown or notification lineage. Notifications are outside this source's 58 resource
tables, while complete world-state comparison still includes all 369 tables.

The public-safe result is [harness-candidate18-resource-index.json](harness-candidate18-resource-index.json).
Its SHA256 is `170ee4f6d5248d2a6060a39ef247a8eb50d8b464290bc98404389978064ce8f6`.
The restricted evidence directory is `candidate18-resource-integration-94a1a6cd-1`
under the operator's private RC1 evidence root. It contains the rerunnable audit,
the exact candidate snapshots, 145-file custody index covering this pair and the prior
failure, and the public summary. Custody index SHA256:
`2c5cfdf7799183bfe4ebd80a10a9e706281d036baf3651d0b389ffd4306d4925`.
The summary contains no raw actors, private state or credentials; 100 exact private
identifier values from retained states/failure were checked against it.

Scope remains serial-only: the Family collector's last-query handoff proves neither
concurrent execution nor total concurrent commit order. Counts of remaining unknowns
describe observed changes only; absent branches remain unexecuted. Full resource,
matrix and release qualification remain false. The failed `65ee96b8` observation is
still unsealed and failed; this successful fresh pair does not rewrite it.
