# Restricted CI artifact envelope

This helper transports one opaque regular file, such as an already-created private
artifact archive. It does not create or extract archives. It adds confidentiality
and ciphertext integrity; it does **not** attest the sender, source revision,
truth of a run, or completeness of the enclosed evidence. Anyone with the public
key can encrypt a payload and claim a context. Independent artifact/source
verification is still required after decryption.

The helper was developed from `4b9db47901c143f94bd31d9d3159f33695d729c0` in an
isolated checkout. Only the helper, focused test and this guide are changed.
Workflow retention, repository variables, key generation/custody, upload policy,
and TOOL38 remain separate work. This does not resolve the cause of the hosted
PG18.4 replay failure or recover its lost private artifacts.

## CLI

```text
node tools/rc1-ci-envelope.js encrypt --input=<payload-file> --output=<new-envelope-file> --context=<context-json-file> --public-key=<public-pem-file>
node tools/rc1-ci-envelope.js decrypt --input=<envelope-file> --output=<new-plaintext-file> --context=<expected-context-json-file> --private-key=<private-pem-file>
```

Each flag is required exactly once and uses `--name=value`. Quote the entire
argument when a path contains spaces. Context contains exactly these fields:

```json
{
  "sourceRevision": "4b9db47901c143f94bd31d9d3159f33695d729c0",
  "runId": "35586586182",
  "jobId": "pg18.4",
  "attemptId": "1"
}
```

`sourceRevision` is exactly 40 lowercase hexadecimal characters. `runId` and
`jobId` are required; `attemptId` is optional. Each ID is 1–128 ASCII characters
from letters, digits, `.`, `_`, `:`, `-`. Field order in the context file does not
matter. Decryption requires the exact same fields and values. Context files are
capped at 4 KiB and key files at 16 KiB. These metadata fields and payload length
are public in the envelope, so never put secrets in them.

Provision the recipient RSA3072 private key outside CI in a restricted private
directory. Only its public key belongs in the CI repository variable. The helper
does not generate, rotate, or persist recipient keys. The focused tests generate
throwaway private keys in memory and never write their private PEMs.

Successful CLI output is one JSON record with `ENCRYPTED` or `VERIFIED`, byte
count, recipient fingerprint and context. Failure exits 1 and emits only a stable
code, plus `unverifiedPartialPath` if staging was created. It emits no plaintext,
key bytes, exception stack, or raw crypto error. Never upload plaintext or
`.unverified` files as a fallback when encryption fails.

## Format and publication boundary

The fixed layout is eight ASCII bytes `OMRC1E01`, a four-byte unsigned big-endian
header length, canonical UTF-8 JSON header, ciphertext, and a 16-byte tag. The
header is at most 4,096 bytes, uses sorted object keys with compact JSON, and has
exactly `format`, `cipher`, `wrap`, `context`, `keyFingerprint`, `plaintextBytes`,
`nonce`, and `wrappedKey`. Noncanonical encodings, duplicate/unknown fields,
malformed UTF-8, unsupported algorithms, noncanonical base64 and size mismatch
are rejected. There are no optional cipher suites or trailing bytes.

Each encryption draws a fresh 32-byte AES key and 12-byte nonce from Node crypto.
The AES key is wrapped with RSA3072 OAEP using explicit SHA-256 for OAEP/MGF1.
The public key fingerprint is SHA-256 of SPKI DER, represented as 64 lowercase
hexadecimal characters. AES-256-GCM authenticates the complete prefix and header
as AAD. The GCM tag length is explicitly 16 bytes; decryption publishes only
after `final()` authenticates and the expected context matches. These choices
follow the [Node crypto API](https://nodejs.org/api/crypto.html): `setAAD` precedes
updates, `setAuthTag` precedes GCM finalization, and OAEP SHA-256 is explicit
because the API default is SHA-1.

The physical plaintext/ciphertext payload limit is **32 GiB (34,359,738,368
bytes)**. Framing overhead is separately bounded. File size is checked before
reading, the parser checks exact physical length, streaming byte counts are
checked, and file identity/size/timestamps are checked again before publication.
Production processing uses at most 1 MiB input chunks and awaits each write;
there is no whole-payload buffer. Exported `maxPayloadBytes` may only tighten the
fixed limit. Tests use a smaller cap to exercise physical and streamed rejection;
they do not claim a full 32 GiB throughput or memory benchmark.

Inputs must be regular files, including context/key files. Symlinks and special
files are rejected using `lstat`, the open handle's metadata, a second path check,
and `O_NOFOLLOW` where supported. Source replacement or observable mutation is
rejected. Callers must supply stable inputs and **trusted, private parent
directories**: these checks do not secure hostile ancestor directories or a
same-user process that can rewrite staging and restore file metadata.

Both operations create an adjacent, exclusive
`<output>.<random-uuid>.unverified` staging file with POSIX mode `0600`. On Windows,
the caller must provision the directory ACL; POSIX mode is not a Windows ACL
guarantee. Plaintext staging may contain unauthenticated bytes and is never a
verified artifact. Failures retain staging for private diagnosis and identify
its path. A crash can likewise leave `.unverified` files; inspect/clean them only
under the private retention policy. Do not treat a failed decrypt's partial as
authenticated data.

After authentication and context validation, `copyFile` with `COPYFILE_EXCL`
publishes into the requested absent destination, then removes staging. An
existing destination, including a symlink or a competing publisher, is never
overwritten. Publication is a verified copy, **not an atomic rename, a promise of
atomic visibility, or fsync durability**. A copy/cleanup failure is reported;
operators must not infer success from the presence of a destination alone.
Provision enough private disk for the input, staging and final copy. Archive
extraction and its path-traversal/size controls belong to a separate operation.

## Focused evidence and exclusions

Run `node test/rc1-ci-envelope.js`. On 2026-09-21, Node 24.19.0 on Windows passed
14 test groups with no skipped controls: independent OAEP/GCM decoding; a
4 MiB-plus payload; awaited slow-sink backpressure; fresh key/nonce; empty payload;
cipher/header/tag tamper; wrong key and forged fingerprint; each expected context
field; malformed/duplicate/noncanonical headers; truncation at every framing
class; appended data; fixed and tightened limits; invalid key/context; regular
file/symlink checks; existing outputs and concurrent exclusive publication; CLI
encryption and strict argument parsing. The decryption API is exercised directly;
the test deliberately does not write a private-key file for a CLI-decrypt smoke.

The first development run failed after nine groups because the test used the
strict canonical serializer to manufacture a forbidden fractional byte length.
The serializer rejected the fixture before parsing. The corrected test emits
malformed JSON directly and verifies parser rejection. The failed log and random
test fixtures remain retained privately; no actual CI key/evidence was involved.
Private log SHA-256:

| Run | Result | SHA-256 |
| --- | --- | --- |
| `ci-envelope-development-01.log` | Failed fixture construction, exit 1 | `735d11852b265579ba9b72870ace64e437f382c32134322dc8e6103b063468fa` |
| `ci-envelope-development-02.log` | 14 groups, no skips, exit 0 | `b90428ea498ed2995c3a30f3c4317462e47d7f749949f883d8ec15d81ed3eb8c` |

The source review follows the repository's
[agent-led policy](../omerta-contracts/SECURITY-REVIEW-POLICY.md), with manual
boundary, state-transition, adversarial trace and invariant passes adapted from
its pinned Pashov, Plamen and Trail of Bits methods. These are scoped review
passes, not executions of their full audit orchestration or static analyzers.
The assets are the payload and recipient key; boundaries are untrusted envelope
bytes, expected context/key configuration, private staging, and exclusive final
publication. Each negative test requires the requested plaintext destination to
remain absent. Concurrent publication must have exactly one winner. Mutation
attacks are rejected by parsing, OAEP, or GCM rather than by trusting metadata.
There are no game/database transitions, network requests, runtime dependencies,
archive extraction, contract changes, or sender-authentication claims in scope.
Remaining operational assumptions are private directory/key custody, an honest
OS/Node crypto implementation, stable source files, and sufficient disk space.
