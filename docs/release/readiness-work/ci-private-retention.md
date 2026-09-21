# Restricted native CI retention

`RC1-TOOL-38` is a reproduced retention defect in source
`4b9db47901c143f94bd31d9d3159f33695d729c0`: recovery workflow `35586586182`,
job `106291241951`, failed its PostgreSQL18.4 alliance replay but uploaded no
native run record, comparison, history or dump. Its retained public log only
reports completion and failure. PostgreSQL16 and a separate local PostgreSQL18.4
pair passed; neither explains or overrides the hosted failure. The missing
original files cannot be reconstructed from that log.

The recovery workflow now requires a public encryption recipient and passes the
core authenticated-envelope controls on Node22 before native jobs. At each
native job's end, including failure, `tools/rc1-ci-retain.mjs` collects fixed
`rc1-*` evidence roots from runner temporary directories and workspace `tmp`.
It excludes the rollback dependency checkout and retention-tool/archive folders.
Tar does not follow symlinks. A private index records source HEAD, workflow SHA,
helper hashes, runtime and collected paths. Only `evidence.rc1enc` is uploaded,
with 30-day retention. No plaintext or partial-file fallback exists. Existing
nine native job time budgets are unchanged.

The RSA3072 recipient private key is retained only in the restricted local
user/SYSTEM evidence directory. CI receives only repository variable
`RC1_EVIDENCE_PUBLIC_KEY`. Its SPKI SHA256 fingerprint is
`4ea7a531925d95112c463903bfc81a8787bf364fc7a3ea73f3168740017b3b0e`.
The [envelope guide](../../rc1-ci-envelope.md) specifies authenticated decryption,
context matching, limits and custody. Transport authentication does not establish
sender identity, source truth, completeness, run success or release clearance.

To reproduce an older immutable source without changing its tested checkout,
dispatch the existing recovery workflow with `replay_source=<40-hex-SHA>`.
Normal jobs are then skipped. The diagnostic PostgreSQL18.4 job copies the new
retention helpers outside the checkout, checks out the requested source, runs
the original 48-hour alliance observation and replay commands with Node22, and
encrypts the complete resulting private files and logs. The tested source and
new workflow/helper identity remain separate in the archive. This diagnostic
does not retroactively give the original failed run complete retention.

Development validation passed all 14 envelope test groups and a real CLI
archive/encrypt/decrypt control using the configured recipient: runner, OS-temp
and workspace fixtures were recovered, predecessor files were excluded, the
synthetic source and workflow source remained distinct, and a repeated collector
could not overwrite the original encrypted archive. A read-only independent
review found no functional/security issue in the collector and native-job
wiring. Final frozen integration and hosted execution remain required.

Cancellation, timeout, disk exhaustion or archive/encryption/upload failure can
still prevent retention; such a run remains incomplete. An upload's presence is
insufficient: after decryption, verify the expected run/job/source context,
archive index, all native artifact hashes, histories and result comparisons.
Decryption does not automatically extract tar files.
