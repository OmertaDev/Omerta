# Candidate 18 resource observer integration

Base: `b5c80a4ed921e58792e78f8c4b51de5635182b74`. This isolated integration combines
the tested season conversion, NPC Family formation and NPC car-acquisition classifiers.
It changes evidence tooling only. Production, actor policy, gameplay initialization,
original deadlines, worker callbacks and operational limits are unchanged. The unverified
season crown work is excluded.

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
