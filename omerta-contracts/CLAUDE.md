# Contract working instructions

Use the current source and the [market design](docs/market/DESIGN.md),
[deployment runbook](DEPLOYMENT.md) and [security review policy](SECURITY-REVIEW-POLICY.md).
Historical audit reports remain evidence for their pinned revisions and must not be rewritten as
current findings. Keep source, ABI, storage, event and signing-domain identifiers compatible with
their consumers; a naming cleanup must not change a deployed protocol.

1. Run the relevant Foundry checks after changes and the full `forge test` suite for a contract
   release. The native runner is `./run-forge-test.sh`; the constrained-environment runner is
   `./run-forge-test-sandboxed.sh`. Native solc is needed for complete PoolManager compilation.
   Preserve compiler profiles, storage-layout and optimized-IR outputs used by the conformance
   tests. Hoist signature generation and external calls above `vm.prank` / `vm.expectRevert`;
   argument evaluation can otherwise consume the cheatcode.
2. Keep all chain IDs, addresses and deployment recipients configuration-driven. Check actual
   chain, code, owners, caps and funding before activation. The presence of a deploy script does
   not authorize a broadcast or funding operation.
3. OMR has one owner-selected `minter`; zero disables issuance. The owner can assign any address,
   including itself, so the Safe remains a trust boundary. The core bond rail independently checks
   its configured daily issuance cap, discount limit, absolute `maxOmrPerEth` and fresh oracle
   bound. Zero daily cap means unlimited; zero absolute rate or unusable oracle fails closed.
   Do not merge the absolute and oracle checks: oracle manipulation must never override the
   absolute ceiling. Purchases reserve their entire OMR obligation immediately, and sweeps cannot
   remove committed assets. The market's inventory bonds sell already funded OMR and have no
   mint authority.
4. VoucherClaim pays only prefunded OMR. GearVault is the authoritative per-class supply bound;
   its cap and the bridge's matching preflight measure live supply (`minted - redeemed`), so a
   redemption frees a slot. Keep replay, deadline, signer, funding and daily-cap checks intact.
   Staking rewards come only from their funded pool; principal remains withdrawable.
5. Maintain exact off-chain/on-chain signing parity. VoucherClaim, OmertaBond, StreetDeed and
   DynastyNFT can share a signer, so assess the combined scope of their issuance caps. Preserve
   constructor caps and exact EIP-712 fields. Character mint payments go entirely to DEV; respawn,
   reroll and package fees follow their configured non-mint route. Preserve exact fee accounting
   and designated remainder recipients.
6. On the canonical market, keep `OMR.ammPairs(PoolManager)` false. Transfer taxation of the
   singleton would also affect liquidity funding and could stack with hook taxation. Preserve
   hard fee ceilings, exempt protocol flows, recipient accounting and event authority. Never
   substitute a freely chosen pool for the exact configured canonical pool.
7. Hook permissions are part of the mined address and immutable pool identity. Preserve pool
   initialization gates, bounded opening policy and recipient isolation. Fee collection must
   not make swap liveness depend on recipient behavior. `OmertaHook` observations are sampled
   outside swap settlement; do not reintroduce synchronous observer calls from `afterSwap`.
   Oracle updates must occur within their freshness bounds; stale data deliberately blocks
   price-sensitive issuance or deployment.
8. Follow the market contracts' separate conservation boundaries: principal, fees, funded family
   credits, bond entitlements and commitment rewards are not interchangeable. Preserve finite
   episode/lifetime capacities, sampled observation requirements and independent maturity exits.
   New funding does not restore consumed deployment authority. Settle accrued Turf fees before
   ownership, siege or treasury transitions and retain replay/revision checks.
9. The Bank borrows denomination-matched assets without a price oracle or liquidation path.
   Each depositor has an individual CollateralEscrow holding external ERC-4626 shares; do not
   introduce pooled internal share accounting or an escrow sweep/owner-withdrawal path. Revoking
   Denari mint authority and the buffer floor stop issuance while preserving redemption.
   Redemption has no caller allowlist or same-block guard; flow caps bound outflow. Seed the
   actual buffer before enabling issuance. Yield-vault losses remain a collateral risk and can
   break the collateralization bound; stopping issuance does not restore lost backing.
10. Keep acquisition readiness and outflow gates closed until their execution and reconciliation
    paths are complete and reviewed. Deployed code, accepted deposits and registry readiness do
    not imply a complete withdrawal or acquisition path.
