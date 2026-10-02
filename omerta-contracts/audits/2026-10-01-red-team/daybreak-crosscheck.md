## Source-review assessment

The review’s narrow conclusion—no new unprivileged critical/high defect—was not contradicted. However, several correctness and evidence claims need correction.

### Confirmed overlooked defects

1. **StreetDeed identity is not immutable across burn/remint.**  
   The district is documented as immutable at [StreetDeed.sol:50](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/StreetDeed.sol:50), but `claim()` unconditionally overwrites both stored fields before minting at [StreetDeed.sol:182](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/StreetDeed.sol:182). After `redeem()` burns while retaining metadata ([StreetDeed.sol:203](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/StreetDeed.sol:203)), a fresh valid voucher can remint the same name/token ID with a different district. The existing remint test only reuses the same district ([StreetDeed.t.sol:247](C:/Users/Jorge/Documents/Omerta/omerta-contracts/test/StreetDeed.t.sol:247)).  
   This is a signer-dependent integrity defect, not an unprivileged theft path. `core-review.md:76` says remint was reviewed but does not disclose it.

2. **Vendored CCA has a generic fee-controller liveness defect.**  
   [ContinuousClearingAuction.sol:139](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/genesis-auction/vendor/cca/ContinuousClearingAuction.sol:139) subtracts the controller-returned fee without clamping. A controller returning `currencyRaised + 1` makes `lbpInitializationParams()` panic. The sweep path recognizes and clamps exactly this condition at [ContinuousClearingAuction.sol:674](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/genesis-auction/vendor/cca/ContinuousClearingAuction.sol:674).  
   This is unreachable through current `OmertaGuardedAuction`, which fixes the controller to zero at [OmertaGuardedAuction.sol:22](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/genesis-auction/OmertaGuardedAuction.sol:22), but it remains a confirmed defect in scoped vendored source. It was historically documented, but omitted from the current report.

3. **Extreme oracle periods are accepted but later brick updates.**  
   Both constructors accept any `uint32 period >= 10 minutes`, while update evaluates checked `PERIOD * 4` at [OmrTwapOracle.sol:162](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmrTwapOracle.sol:162) and [OmrV4TwapOracle.sol:167](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OmrV4TwapOracle.sol:167). Periods above `1,073,741,823` seconds overflow once an update becomes eligible. This is an extreme trusted-configuration liveness limitation, acknowledged in `core-review.md:118` but absent from the final report.

The retained RT-M02 zero-liquidity oracle finding and RT-P01 acquisition funding blocker were independently confirmed and remain correctly open.

### Missing or unsupported evidence

- [report.md:78](C:/Users/Jorge/Documents/Omerta/omerta-contracts/audits/2026-10-01-red-team/report.md:78) claims `evidence-manifest.json` SHA-256-binds retained results. That file does not exist, and principal outputs such as the full-suite, fixed-seed and cap-domain logs have no equivalent hash binding elsewhere. This is material, not merely a broken link.
- “All dispositioned” at [report.md:68](C:/Users/Jorge/Documents/Omerta/omerta-contracts/audits/2026-10-01-red-team/report.md:68) overstates the static evidence:

  - The Stability `_range` warning at [static-triage.json:22742](C:/Users/Jorge/Documents/Omerta/omerta-contracts/audits/2026-10-01-red-team/static-triage.json:22742) receives an unrelated MarketState variance rationale at line 22825.
  - The guarded-auction batch-loop warning at [static-triage.json:29419](C:/Users/Jorge/Documents/Omerta/omerta-contracts/audits/2026-10-01-red-team/static-triage.json:29419) receives unrelated game-settlement lane rationale at line 29457.

  All IDs have labels, but these examples lack substantive per-diagnostic disposition evidence.
- The 64×64 run at [report.md:66](C:/Users/Jorge/Documents/Omerta/omerta-contracts/audits/2026-10-01-red-team/report.md:66) should be called a separate same-seed campaign, not independent random coverage.
- At final read, the retained bounded log now records 1,275/1,275 passing with exit 0. I did not run Forge. All 97 current Solidity files independently match `source-hashes.json`.

### Leads, not confirmed defects

- Marking `OMRStaking` as an OMR taxed pair makes `stake()` and `fundRewards()` credit nominal rather than received amounts ([OMRStaking.sol:60](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OMRStaking.sol:60), [OMRStaking.sol:84](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/OMRStaking.sol:84)), creating insolvency. This requires owner misconfiguration; deployment evidence must prove exact-transfer treatment.
- Permissionless splitter recovery can prematurely route prefunded ETH—and, separately, any ERC-20—to the fixed treasury before a non-atomic launch. The ETH case is reported; the token-prefunding variant at [GenesisProceedsSplitter.sol:106](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/GenesisProceedsSplitter.sol:106) is only implicit.
- A documentedly unsupported 1–2 wei graduated sale makes the coordinator’s 37.5% native budget round to zero at [OmertaGenesisCoordinatorV2.sol:162](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol:162), permanently preventing migration and gated claims.
- Commitment recovery can precede a still-valid final checkpoint, but published semantics explicitly make rewards first-come at checkpoint. Therefore this is not a confirmed defect; the claim that grace “covers the last valid observation window” at [OmertaCommitmentVaultV2.sol:198](C:/Users/Jorge/Documents/Omerta/omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol:198) is merely imprecise unless stronger preservation was intended.

No contracts were changed, deployed, or exercised against a chain. This assessment does not establish absence of further defects.