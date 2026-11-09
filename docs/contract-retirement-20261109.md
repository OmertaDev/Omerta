# Contract retirement boundary, 2026-11-09

## Scope

Base: `0a45705bb34acb5a0a9b620802e042eaa4609259`. This change removes
superseded market tuning and `omr.pair` registration from the active admin panel.
Pair calldata requests are refused before address lookup, including stale clients.
The other 17 deployed-service and recovery controls remain unchanged.
Two emergency shortcuts, `hook.sellTax` and `omr.sellTax`, remain but accept only
`setSellTax(0,0,0,0)`. They cannot increase or retune the legacy base tax. Their
old policy mirrors and bond/transfer-tax relation notice are removed. These are
legacy recovery controls, not current-market configuration.

The parity warning identifies its legacy/account-service scope and no longer
prescribes changing environment values as a generic remedy. Named OMR/OmertaHook
mismatches concern legacy tax bookkeeping; OmertaFees and VoucherClaim mismatches
can affect separate live account/claim obligations. Neither is a measurement of
the current market manager. Comparisons, hourly cadence, alert latch and delivery
remain unchanged; do not suppress a warning merely because a market is superseded.

This is application-source retirement, not an on-chain transaction. It changes no
fee values, contract addresses, credentials, balances, reserves, indexing cursors,
deployment settings or activation flags. No Solidity source or ABI is deleted.

## Classification

- **Current market, retain:** every contract under `src/market-v2/`. Its actual
  source is the authority for current fee behavior. `GenesisPlayerSale.sol` is
  directly imported by `OmertaGenesisCoordinatorV2`; it is not retired because it
  lacks a V2 suffix. The current market also imports the shared initializer and
  observation interfaces.
- **Superseded market controls:** remove taxed-pair registration and transfer-tax
  tuning. Retain only the two all-zero base-tax emergency builders. The current
  restricted-token/custom-manager market does not use these setters.
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

## Emergency base-tax recovery runbook

This cleanup does not execute recovery. For a separately authorized incident:

1. Identify the exact chain ID, existing deployed OMR/OmertaHook address and
   verified bytecode/ABI from deployment records. Environment addresses alone
   are not proof. If an address is absent, verify the existing deployment; do not
   deploy a retired contract to populate this panel.
2. Read `owner()` on each target and verify the owning Safe, its current owners,
   threshold and available signing path. Both source setters are `onlyOwner`;
   an admin login is not transaction authority. Live ownership/signing access
   has **not** been verified by this source-only review.
3. Prepare four explicit zeros. Independently decode the exact target calldata as
   `setSellTax(uint256,uint256,uint256,uint256)`, with zero ETH value. Simulate
   from the verified owner against the actual deployment before any approval.
4. Inspect the hook's separate `surgeMaxBps` and opening-window charges. The
   base-tax call does **not** disable surge or opening buy charges and is not a
   promise that all fees stop. Assess any additional recovery separately using
   the actual deployed contract; do not assume changing future-pool opening
   configuration clears already initialized pool deadlines.
5. Obtain incident-specific authorization and the Safe signatures, then verify
   receipt/events and read back all four base-tax fields on each intended target.
   Reconcile preserved claims and bookkeeping. A parity warning after emergency
   action is a diagnostic to investigate, not permission to re-enable a tax.

No signing, simulation against a live deployment, or transaction was performed.
Balances, accrued fee claims, reserves and recovery/claim routes remain intact.

## Verification

Earlier local commits removed all three panel shortcuts. Review identified the
lost base-tax emergency path; this correction restores only the all-zero calls.
Regression tests independently decode both destinations and four uint256 zeros,
reject each nonzero argument and malformed/missing values, preserve the 17 other
controls, and reject obsolete pair calls. The new missing-address regression
first failed on guidance to deploy OmertaHook; the correction instead directs
operators to verify an existing deployment and forbids deploying for this shortcut.
Existing no-signing, live-mirror and dormant-board assertions remain.

The alert regression exercises the actual scoped worker note through the webhook
formatter. Injected drift, failed-network and recovery messages in the hardening
output are fixtures, not production observations. No Solidity, ABI, zero-tax
arithmetic, economic configuration, claim accounting or activation flag changed.
Solidity fuzzing, native persistence and deployment simulation are outside this
application-only regression scope; source inspection does not qualify bytecode
or demonstrate live emergency authority.

Required before deployment: independent review, current-source/native declaration
updates and the repository's full exact-candidate CI (including npm lifecycle,
worker/simulation, native PostgreSQL and applicable browser/contract gates).
Focused checks alone do not qualify production. Earlier source hashes and review
results must not be relabeled as evidence for this changed candidate.

## Documentation discrepancy

The current market manager source declares 350 bps base plus 50 bps rewards and
a maximum 50 bps hook charge. Some older market README/design/bootstrap prose still
says 500/550 bps. That prose is not grounds to change the current contract values
or to configure the old transfer-tax contracts. Economic configuration is outside
this cleanup.
