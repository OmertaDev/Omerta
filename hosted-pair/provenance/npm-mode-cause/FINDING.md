# HO-NPM-UMASK-R1 — fresh reference extraction masked approved modes

**Confirmed proof-preparation blocker, not a production npm content change.** The retained job39004762233 fails during materialization before canonical M6. At `2026-10-17T05:09:22.8719602Z` its first mismatch is installed `.npmrc` mode420/0644 versus reference384/0600, with identical bytes/hash. Original failure remains retained. No source, workflow, setting, variable, key or runtime was changed in this analysis.

Root supplied the already AEAD-verified plaintext archive at `H/hosted-health-39004762233/payload.tar.gz`. This review did not repeat decryption or read a key. It independently streamed all194,730,116 compressed bytes and confirmed SHA256 `682e0ad1d7ed65908daaacd8313c76a9e1207fb81ec3385d253998d98562f35d`. The12,714 semantic tar paths exactly match the retained Root list, in order. All paths were validated safe relative; no extraction, link following or payload execution occurred. Existing installed npm tar7.5.16's strict Parser was used, not an installed new dependency or an untrusted payload program.

One pass over the outer gzip/tar also streamed its preserved `rc1-hosted-runtime/node.tar.gz` through a second in-memory tar parser. The preserved official Node22.23.3 archive is exactly SHA256 `1084aa36196bba4c3a5e69a1ee388a6e4ff729dad09445fbcd434b28fe3c24af`, matching the approved installer/materializer pin. All three npm trees—installed runtime, extracted reference and official archive—have2,464 root-inclusive members. Membership, entry type, link target, size, SHA256 and **literal in-memory Buffer byte equality** match for every member. No npm symlink or hardlink member exists; the recorded types are directories and regular files. No filesystem link was followed.

Installed runtime matches the official archive's modes exactly. All2,464 reference modes differ from installed/official by precisely `mode & ~0077`:

| Root-inclusive tar members | Installed/official | Reference |
| --- | --- | --- |
| 500 directories | 0755 | 0700 |
| 1,925 regular files | 0644 | 0600 |
| 39 executable files | 0755 | 0700 |

The real materializer's `tree(root)` excludes the npm root entry itself, so **its actual comparator vector contains2,463 members:499 directories +1,925 files +39 executable files**. All2,463 compared modes show the same077 mask, and every compared path/type/link/byte matches. The additional root directory has the same mode change but is outside that vector. Runtime/reference uid, gid and mtime also match. The official archive carries different uid/gid on all2,464 entries, as expected for an unpacked unprivileged runtime; these ownership fields are recorded, not part of `tree()`'s comparison and not claimed equal to the official archive. Mtimes match all three.

## Exact actual source procedure

Immutable workflow commit is `398e2a6cca3ce439a633cde6f62d06761b69a09f`, `.github/workflows/rc1-recovery.yml` SHA256 `b14593d3ee14e3ec375d0e8af76f20366ddf99897ef30ba1800de90b230fad05`. It checks retention tools out at `github.sha`. Its `hosted-pair/materialize-hosted.cjs` is byte-exact to frozen health-none source, SHA256 `f5f731f0ece24a110f22b6284a8a921c3366ea8f33a88b45613ec42027edde61`. The installer bytes are also exact to that source packet.

The approved-runtime installer runs in a separate earlier shell step; it has no explicit077 umask and its actual extracted npm modes match the official archive. The later materialization step explicitly runs `umask 077` to protect the approval/evidence files. Its fresh reference extraction inherits that mask:

```js
cp.execFileSync('tar',['--extract','--gzip','--file',job.nodeArchive,'--directory',runtimeOutput],{timeout:60000,maxBuffer:65536});
```

The materializer then compares installed versus reference modes and full file content strictly; it correctly refuses the incorrectly masked reference. `source-and-procedure.json` pins exact source locations, full source hashes, the actual failure-log hash and bounded excerpt. `comparison.json` and three complete npm inventories retain all measured results. The entire original archive remains retained at its hash-bound H path; it was not rewritten or copied into an executable fixture.

## Minimum proposed correction, not executed

Only the fresh reference extraction should request the verified archive's original permissions:

```js
cp.execFileSync('tar',['--extract','--same-permissions','--gzip','--file',job.nodeArchive,'--directory',runtimeOutput],{timeout:60000,maxBuffer:65536});
```

Keep the restrictive evidence `umask077`, installer, complete Node archive/binary/npm-cli/Git pins, membership/content/link/**mode** comparison, source/guard approvals and timeouts unchanged. Do not filter, remap, ignore or normalize modes in the comparator. This proposed one-span delta is recorded in JSON only; Root/RCI own any separately reviewed materializer successor and its changed approval/hash bindings. No fixed-source protocol was executed here. A successful fresh Linux extraction/materialization and subsequent actual canonical proof remain pending; this archive analysis is not a hosted M6 pass.

Actual analysis completed normally0 (`f4a8a1`), then source/log joins completed normally0 (`a07b81`). An initial PowerShell inventory command had a foreach-pipeline parse error before execution and is retained as a reviewer-only limitation; tar API discovery found the installed export is Parser, not Parse, before archive parsing. Neither changed input or finding. No keys, decryption repeat, installation, actual SQL/PG/CIM, runtime process, network, canonical edit or dispatch was performed.
