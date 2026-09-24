# NFT artwork and paid portrait reveal — 2026-09-24

Release scope: local fal paintings, portrait/Deed compositing, confirmed-payment reveal,
profile copy, and operator commissioning defaults. Base:
`32859cf7d198d2a003160b2bb1ef005991697d73`. No contract, signer, fee settlement, worker,
chain configuration or production credential changes are part of this release.

The existing confirmed fee watcher is authoritative. Reveal requires a credited `mint`
receipt attributed to the original character/minter account, a positive canonical integer
amount and a 32-byte transaction hash. Free credits, `minted=true`, an unrelated paid viewer,
the NFT buyer and a snapshot's character ID cannot substitute for that receipt. Both public
identity routes return sealed responses without image bytes or traits until eligible;
sealed responses use `no-store`. Public art routes do not expose the nested source directory.

Independent review applied entry-point/trust-boundary mapping, adversarial receipt/token
traces, invariant regression tests and manual static triage. These adapt the Pashov,
Plamen and Trail of Bits methods pinned in `omerta-contracts/SECURITY-REVIEW-POLICY.md`;
no upstream orchestration or full-system audit is claimed. No blocker was found.

Local checks on Node 24.19.0: `npm ci`, `npm run test:nft-art`, `node test/watcher.js`,
`node test/preflight.js`, JS syntax checks and `git diff --check`. Retained results and
working-tree source hashes: [evidence](evidence/nft-portrait-reveal/verification.json).
The portrait access suite exercises malformed/zero/uncredited/unrelated receipts,
free entitlements, live and frozen tokens, late wallet attribution and read-only rendering.
CI must also pass the full suites/sim and real PostgreSQL jobs before merge/deployment.
No new lock or transaction behavior is introduced; pg-mem alone is not evidence about
the existing fee-ingestion concurrency. No Solidity changes require compilation here.

New commissioned portraits use Klein 4B; Deeds use Pro. Existing Pro assets and their
provenance remain unchanged. This release does not activate automatic signup generation
or configure fal credentials. Receipt reads never call a paid API.

Known boundaries: legacy store-package mint credits without a character-creation fee
receipt remain sealed. Already published images cannot be made secret retroactively.
Frozen tokens preserve game facts, not image binaries; future operators must follow the
documented prohibition on replacing published images or commissioning frozen-token
overrides. Automated generation and image-byte pinning require separate implementation.
