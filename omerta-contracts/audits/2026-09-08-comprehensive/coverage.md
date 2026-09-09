# Source and behavior coverage — 2026-09-08

All **40 local production Solidity files** are assigned below: 31 implementation-bearing files (including abstract FlashGuard) and nine interface-only files. This is not 40 deployable contracts. The entry inventory includes constructors, receive/fallback methods, modifiers, internal/private functions and inline interface declarations; inherited implementations were followed as recorded by each reviewer. Declarations and file counts alone do not establish behavior coverage.

| File | Group | Lexical entry declarations | Review |
| --- | --- | ---: | --- |
| [src/AcquisitionAuthority.sol](../../src/AcquisitionAuthority.sol) | acquisition | 64 | [acquisition review](acquisition-review.md) |
| [src/AcquisitionConstellationFactory.sol](../../src/AcquisitionConstellationFactory.sol) | acquisition | 29 | [acquisition review](acquisition-review.md) |
| [src/AcquisitionIntentExecution.sol](../../src/AcquisitionIntentExecution.sol) | acquisition | 6 | [acquisition review](acquisition-review.md) |
| [src/AcquisitionReconciliation.sol](../../src/AcquisitionReconciliation.sol) | acquisition | 3 | [acquisition review](acquisition-review.md) |
| [src/AcquisitionVault.sol](../../src/AcquisitionVault.sol) | acquisition | 56 | [acquisition review](acquisition-review.md) |
| [src/AcquisitionVaultCore.sol](../../src/AcquisitionVaultCore.sol) | acquisition | 23 | [acquisition review](acquisition-review.md) |
| [src/Alchemist.sol](../../src/Alchemist.sol) | market | 14 | [market review](market-review.md) |
| [src/CollateralEscrow.sol](../../src/CollateralEscrow.sol) | market | 6 | [market review](market-review.md) |
| [src/Denari.sol](../../src/Denari.sol) | market | 5 | [market review](market-review.md) |
| [src/DynastyNFT.sol](../../src/DynastyNFT.sol) | core | 11 | [core review](core-review.md) |
| [src/FlashGuard.sol](../../src/FlashGuard.sol) | market | 5 | [market review](market-review.md) |
| [src/GearVault.sol](../../src/GearVault.sol) | core | 17 | [core review](core-review.md) |
| [src/GenesisOracle.sol](../../src/GenesisOracle.sol) | core | 3 | [core review](core-review.md) |
| [src/GenesisProceedsSplitter.sol](../../src/GenesisProceedsSplitter.sol) | core | 7 | [core review](core-review.md) |
| [src/IOmrOracle.sol](../../src/IOmrOracle.sol) | core | 1 | [core review](core-review.md) |
| [src/OMR.sol](../../src/OMR.sol) | core | 8 | [core review](core-review.md) |
| [src/OMRStaking.sol](../../src/OMRStaking.sol) | core | 9 | [core review](core-review.md) |
| [src/OmertaBond.sol](../../src/OmertaBond.sol) | core | 18 | [core review](core-review.md) |
| [src/OmertaFees.sol](../../src/OmertaFees.sol) | core | 12 | [core review](core-review.md) |
| [src/OmertaHook.sol](../../src/OmertaHook.sol) | market | 30 | [market review](market-review.md) |
| [src/OmrTwapOracle.sol](../../src/OmrTwapOracle.sol) | market | 11 | [market review](market-review.md) |
| [src/OmrV4TwapOracle.sol](../../src/OmrV4TwapOracle.sol) | market | 7 | [market review](market-review.md) |
| [src/PreVoteBudgetBook.sol](../../src/PreVoteBudgetBook.sol) | acquisition | 11 | [acquisition review](acquisition-review.md) |
| [src/RwaHealthOverlay.sol](../../src/RwaHealthOverlay.sol) | acquisition | 10 | [acquisition review](acquisition-review.md) |
| [src/RwaStockBuyer.sol](../../src/RwaStockBuyer.sol) | market | 19 | [market review](market-review.md) |
| [src/SettlementGasPool.sol](../../src/SettlementGasPool.sol) | acquisition | 44 | [acquisition review](acquisition-review.md) |
| [src/StockTokenRegistry.sol](../../src/StockTokenRegistry.sol) | market | 11 | [market review](market-review.md) |
| [src/StockTokenRegistryV2.sol](../../src/StockTokenRegistryV2.sol) | acquisition | 18 | [acquisition review](acquisition-review.md) |
| [src/StockVault.sol](../../src/StockVault.sol) | core | 15 | [core review](core-review.md) |
| [src/StreetDeed.sol](../../src/StreetDeed.sol) | core | 15 | [core review](core-review.md) |
| [src/Transmuter.sol](../../src/Transmuter.sol) | market | 9 | [market review](market-review.md) |
| [src/VoucherClaim.sol](../../src/VoucherClaim.sol) | core | 11 | [core review](core-review.md) |
| [src/interfaces/IAcquisitionAuthorityV2.sol](../../src/interfaces/IAcquisitionAuthorityV2.sol) | acquisition | 0 | [acquisition review](acquisition-review.md) |
| [src/interfaces/IAcquisitionIntentExecutionV2.sol](../../src/interfaces/IAcquisitionIntentExecutionV2.sol) | acquisition | 0 | [acquisition review](acquisition-review.md) |
| [src/interfaces/IAcquisitionVaultV1.sol](../../src/interfaces/IAcquisitionVaultV1.sol) | acquisition | 60 | [acquisition review](acquisition-review.md) |
| [src/interfaces/IInitializerHook.sol](../../src/interfaces/IInitializerHook.sol) | market | 1 | [market review](market-review.md) |
| [src/interfaces/IOmrV4ObservationSource.sol](../../src/interfaces/IOmrV4ObservationSource.sol) | market | 2 | [market review](market-review.md) |
| [src/interfaces/IRwaHealthOverlay.sol](../../src/interfaces/IRwaHealthOverlay.sol) | acquisition | 10 | [acquisition review](acquisition-review.md) |
| [src/interfaces/ISettlementDataFeeSource.sol](../../src/interfaces/ISettlementDataFeeSource.sol) | acquisition | 1 | [acquisition review](acquisition-review.md) |
| [src/interfaces/IStockTokenRegistryV2.sol](../../src/interfaces/IStockTokenRegistryV2.sol) | acquisition | 18 | [acquisition review](acquisition-review.md) |

## Dynamic evidence mapping

| Behavior boundary | Existing suites and added proof |
| --- | --- |
| Token issuance, tax, staking and paid fees | Omerta, OMRTax, CharacterLaunchAudit; ComprehensiveCoreAudit |
| Signed bridge, deed and identity issuance, callback burns/transfers, replay and caps | GearVault, StreetDeed, DynastyNFT, CharacterLaunchAudit; ComprehensiveCoreAudit; deed watcher/database regression identified by root report |
| Bond issuance, rate/oracle constraints, vesting, sweep surplus and recipient rollback | OmertaBond, GenesisOracle; ComprehensiveCoreAudit; local genesis fork |
| Genesis residual/failure custody and actual launcher migration | GenesisProceedsSplitter; ComprehensiveCoreAudit; mainnet fork and external LBP/CCA integration reviews |
| Stock held-balance distribution and authorization | StockVault; ComprehensiveCoreAudit; stock-e2e; chain/watcher/stockdeliver JavaScript suites |
| Bank collateral, debt, buffer, flow, donation, fees, withdrawal and hostile vault behavior | Bank, FlashGuard, AlchemistRedTeam, TransmuterFundingRedTeam; collateral/debt conservation properties in those suites |
| Real v4 swaps, tax, opening, surge, observation failure, TWAP windows and price conversion | OmertaHook, OmertaHookObserverDoS, OmrV4TwapOracle, OmrTwapOracle; ComprehensiveMarketAudit; local genesis fork |
| RWA catalog, bounded buyer, authority and realized output | RwaStockMachine, RwaStockMachineRedTeam; concrete live adapter/token dependencies remain open |
| Legacy and constellation authority, custody, factory commitments, staged intent identity and budget snapshots | AcquisitionVaultAccounting, AcquisitionVaultOperator, AcquisitionAuthorityTask2, AcquisitionAuthoritySnapshotTask2, AcquisitionConstellationTask1/Task3A/Task3B/Task4BudgetBook/Task5IntentIdentity/Crosswalk; ComprehensiveAcquisitionAudit |
| Registry version/reverse-head identity, expiry and closed-day history | StockTokenRegistryV2 and StockTokenRegistryV2Invariant; RwaHealthIdentityVectors |
| Health-overlay generation/authority/expiry | RwaHealthOverlay, RwaHealthOverlayFuzz, RwaHealthOverlayInvariant; ComprehensiveAcquisitionAudit |
| Settlement gas-pool liabilities, credit calculation, caller callbacks, delayed configuration and migration | SettlementGasPoolCore/Config/Migration/Invariant; ComprehensiveAcquisitionAudit |

Execution outcomes, budgets and raw logs are in the root report and evidence manifest. Interfaces do not receive independent stateful tests; they are exercised through their implementations and consumers. Deployment/test-only mocks are compiled and tested as fixtures but are not included in the production-contract count.

## External scope and limits

The content manifest includes the vendored OpenZeppelin and v4 files and test/reference dependencies. Shared dependency review follows actual access control, signature, token update, math, transfer and Hook call paths. It does not claim independent full review of every unused vendored function. The external integration report pins CCA, Safe and reference ERC-6551 source and used paths; the root report adds LBP/Launcher migration and mainnet runtime observations. Exact addresses, Safe state, an actual Bank vault/asset, RWA token/adapter/feed and production ERC-6551 implementation remain deployment-specific inputs.

The autonomous game API, all gameplay routes, browser UI, every infrastructure component, arbitrary upstream protocols and future acquisition/gas-pool integrations are not independently audited by this contract review. Signer, watcher, database and keeper code is included where it crosses the reviewed contract boundaries, with precisely named tests. No production transaction was broadcast.
