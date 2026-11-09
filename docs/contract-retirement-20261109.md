# Contract retirement boundary, 2026-11-09

## Scope

Base: `0a45705bb34acb5a0a9b620802e042eaa4609259`. This change removes three
superseded market controls from the active admin registry: `hook.sellTax`,
`omr.sellTax` and `omr.pair`. Direct requests to build their transaction calldata
are refused before address lookup or encoding, including requests from stale clients.
The other 17 deployed-service and emergency-recovery controls remain unchanged.

This is application-source retirement, not an on-chain transaction. It changes no
fee values, contract addresses, credentials, balances, reserves, indexing cursors,
deployment settings or activation flags. No Solidity source or ABI is deleted.

## Classification

- **Current market, retain:** every contract under `src/market-v2/`. Its actual
  source is the authority for current fee behavior. `GenesisPlayerSale.sol` is
  directly imported by `OmertaGenesisCoordinatorV2`; it is not retired because it
  lacks a V2 suffix. The current market also imports the shared initializer and
  observation interfaces.
- **Superseded market controls, remove from the active panel:** the transfer-tax
  setters on `OMR` and `OmertaHook`, and the old token's taxed-pair registration.
  The current restricted-token/custom-manager market does not use these setters.
  They previously appeared as canonical-market controls, despite belonging to a
  different deployment model.
- **Compatibility and obligation records, retain:** `OMR`, `OmertaHook`,
  `OmertaBond`, their oracle implementations, old deployment records, typed-data
  domains, event ABIs, claim paths and accounting. Superseding a market design
  does not settle outstanding balances, positions, vesting or fee claims.
- **Separate account/asset rails, retain:** `OmertaFees`, `FeeRevenueRouter`,
  `DynastyNFT`, `StreetDeed`, `GearVault`, `VoucherClaim` and `OMRStaking`.
  The current deployment documentation still assigns these independent duties.
- **Separate Bank, RWA and acquisition rails, retain:** Denari/Alchemist/escrow/
  Transmuter/buffer components, stock registries and custody, health/settlement-gas
  components and the acquisition constellation. Dormant, gated or incomplete does
  not mean retired. Some explicitly must not be deployed or funded.
- **Genesis/liquidity dependencies, retain pending deployment-specific evidence:**
  genesis lifecycle, character/player sales, wallet cap, proceeds splitter, gas
  vault, liquidity vault and buyback executors. A conditional oracle cutover is
  not proof that every deployment has completed it.

## Why wholesale deletion is blocked

`omerta-contracts/docs/market/RESTRICTED-BOOTSTRAP.md`, under "Migration and release
boundary", explicitly preserves existing OMR, LP positions, fee claims, bonds and
funded game obligations on their existing contracts. It requires allocation,
custody, reserve and claim reconciliation before migration. That reconciliation
is not supplied by the current bootstrap plan or this change.

`omerta-contracts/DEPLOYMENT.md` separately inventories the core, Bank, genesis,
stock and acquisition dependencies. Old references to a component being retired
cannot override later reinstatement or current dependency evidence.

No full deployed-contract balance/position/claim inventory was performed for this
source-only cleanup. Deleting contract implementations, historical event readers
or recovery routes requires that additional evidence. Existing read-only parity
monitoring therefore remains; this change does not silence an unresolved warning.

## Verification

The new regression first failed because `hook.sellTax` was still an active
control. It then passed after the three controls were removed and their direct
calldata requests were explicitly refused. The test pins the complete remaining
17-key registry, checks the dormant admin board omits the retired controls, and
retains the existing no-signing, independent calldata decoding, live mirror and
argument-validation assertions.

Required before deployment: independent review, current-source/native declaration
updates and the repository's full exact-candidate CI. Focused checks alone do not
qualify production. No source hashes or earlier review results are relabeled as
evidence for changed code.

## Documentation discrepancy

The current market manager source declares 350 bps base plus 50 bps rewards and
a maximum 50 bps hook charge. Some older market README/design/bootstrap prose still
says 500/550 bps. That prose is not grounds to change the current contract values
or to configure the old transfer-tax contracts. Economic configuration is outside
this cleanup.
