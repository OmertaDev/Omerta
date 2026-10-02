# Pinned auction dependency closure

These 35 Solidity files are the reachable source dependencies of the public CCA. Upstream
commits and original file SHA-256 values are recorded in `SOURCE-MANIFEST.json`; license
notices are included per package. Package roots in that manifest describe the preparation
checkouts, not runtime dependencies.

Imports between vendored files are rewritten to relative paths. Existing OpenZeppelin and
v4-core imports resolve through the repository's pinned dependencies. Local changes are adding `virtual` to
`cca/ContinuousClearingAuction.sol:_internalClaimTokens`. The guarded subclass overrides
that helper to gate both public claim entry points without modifying bid accounting.

The 2026-10-01 review additionally clamps `lbpInitializationParams` protocol fees to
currency raised, matching the existing `sweepCurrency` behavior. This prevents an excessive
fee-controller quote from reverting the initialization read. `OmertaGuardedAuction` uses a
zero fee controller. Original upstream pins and hashes remain unchanged in the manifest;
the `localPatches` entry records this local divergence.

This source is compiled locally into `OmertaGuardedAuction`. It is not the implementation
deployed by the existing external CCA factory. Do not treat historic factory runtime hashes
or deployment attestations as evidence for this custom auction.
