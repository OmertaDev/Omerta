# Generated Solidity contract catalog

> Declarations extracted from `omerta-contracts/src`. External inherited types remain names, not local graph nodes.

| Declaration | Kind | Source | Inherits / implements |
|---|---|---|---|
| `AcquisitionAuthority` | contract | [omerta-contracts/src/AcquisitionAuthority.sol:10](../../omerta-contracts/src/AcquisitionAuthority.sol#L10) | `IAcquisitionAuthorityV2`, `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `AcquisitionConstellationFactory` | contract | [omerta-contracts/src/AcquisitionConstellationFactory.sol:3](../../omerta-contracts/src/AcquisitionConstellationFactory.sol#L3) | — |
| `AcquisitionIntentExecution` | contract | [omerta-contracts/src/AcquisitionIntentExecution.sol:3](../../omerta-contracts/src/AcquisitionIntentExecution.sol#L3) | — |
| `AcquisitionReconciliation` | contract | [omerta-contracts/src/AcquisitionReconciliation.sol:3](../../omerta-contracts/src/AcquisitionReconciliation.sol#L3) | — |
| `AcquisitionVault` | contract | [omerta-contracts/src/AcquisitionVault.sol:12](../../omerta-contracts/src/AcquisitionVault.sol#L12) | `IAcquisitionVaultV1`, `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `AcquisitionVaultCore` | contract | [omerta-contracts/src/AcquisitionVaultCore.sol:4](../../omerta-contracts/src/AcquisitionVaultCore.sol#L4) | `ReentrancyGuard` |
| `Alchemist` | contract | [omerta-contracts/src/Alchemist.sol:43](../../omerta-contracts/src/Alchemist.sol#L43) | `Ownable2Step`, `ReentrancyGuard`, `FlashGuard` |
| `AuctionStorage` | abstract contract | [omerta-contracts/src/genesis-auction/vendor/cca/AuctionStorage.sol:14](../../omerta-contracts/src/genesis-auction/vendor/cca/AuctionStorage.sol#L14) | `IAuctionStorage` |
| `BankBufferVault` | contract | [omerta-contracts/src/BankBufferVault.sol:21](../../omerta-contracts/src/BankBufferVault.sol#L21) | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `BidLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/BidLib.sol:17](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/BidLib.sol#L17) | — |
| `BidStorage` | abstract contract | [omerta-contracts/src/genesis-auction/vendor/cca/BidStorage.sol:8](../../omerta-contracts/src/genesis-auction/vendor/cca/BidStorage.sol#L8) | `IBidStorage` |
| `BlockNumberish` | contract | [omerta-contracts/src/genesis-auction/vendor/blocknumberish/src/BlockNumberish.sol:8](../../omerta-contracts/src/genesis-auction/vendor/blocknumberish/src/BlockNumberish.sol#L8) | — |
| `CheckpointAccountingLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/CheckpointAccountingLib.sol:11](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/CheckpointAccountingLib.sol#L11) | — |
| `CheckpointLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/CheckpointLib.sol:17](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/CheckpointLib.sol#L17) | — |
| `CheckpointStorage` | abstract contract | [omerta-contracts/src/genesis-auction/vendor/cca/CheckpointStorage.sol:9](../../omerta-contracts/src/genesis-auction/vendor/cca/CheckpointStorage.sol#L9) | `ICheckpointStorage` |
| `CollateralEscrow` | contract | [omerta-contracts/src/CollateralEscrow.sol:40](../../omerta-contracts/src/CollateralEscrow.sol#L40) | — |
| `ConstantsLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/ConstantsLib.sol:6](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/ConstantsLib.sol#L6) | — |
| `ContinuousClearingAuction` | contract | [omerta-contracts/src/genesis-auction/vendor/cca/ContinuousClearingAuction.sol:39](../../omerta-contracts/src/genesis-auction/vendor/cca/ContinuousClearingAuction.sol#L39) | `BidStorage`, `CheckpointStorage`, `StepStorage`, `TickStorage`, `AuctionStorage`, `ReentrancyGuardTransient`, `IContinuousClearingAuction` |
| `CurrencyLibrary` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/CurrencyLibrary.sol:13](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/CurrencyLibrary.sol#L13) | — |
| `DemandLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/DemandLib.sol:12](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/DemandLib.sol#L12) | — |
| `Denari` | contract | [omerta-contracts/src/Denari.sol:44](../../omerta-contracts/src/Denari.sol#L44) | `ERC20`, `ERC20Permit`, `Ownable2Step` |
| `DynastyNFT` | contract | [omerta-contracts/src/DynastyNFT.sol:49](../../omerta-contracts/src/DynastyNFT.sol#L49) | `ERC721`, `ERC2981`, `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `FeeRevenueRouter` | contract | [omerta-contracts/src/FeeRevenueRouter.sol:28](../../omerta-contracts/src/FeeRevenueRouter.sol#L28) | `IFeeRevenueRouter`, `ReentrancyGuard` |
| `FixedPoint96` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/FixedPoint96.sol:7](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/FixedPoint96.sol#L7) | — |
| `FixedPointMathLib` | library | [omerta-contracts/src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:7](../../omerta-contracts/src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol#L7) | — |
| `FlashGuard` | abstract contract | [omerta-contracts/src/FlashGuard.sol:52](../../omerta-contracts/src/FlashGuard.sol#L52) | — |
| `GearVault` | contract | [omerta-contracts/src/GearVault.sol:24](../../omerta-contracts/src/GearVault.sol#L24) | `ERC1155`, `Ownable2Step` |
| `GenesisCharacterBidValidation` | contract | [omerta-contracts/src/genesis-auction/GenesisCharacterEligibility.sol:33](../../omerta-contracts/src/genesis-auction/GenesisCharacterEligibility.sol#L33) | `GenesisCharacterEligibility`, `IValidationHook` |
| `GenesisCharacterEligibility` | abstract contract | [omerta-contracts/src/genesis-auction/GenesisCharacterEligibility.sol:8](../../omerta-contracts/src/genesis-auction/GenesisCharacterEligibility.sol#L8) | — |
| `GenesisLifecycleController` | contract | [omerta-contracts/src/GenesisLifecycleController.sol:59](../../omerta-contracts/src/GenesisLifecycleController.sol#L59) | `Ownable2Step`, `ReentrancyGuard` |
| `GenesisOracle` | contract | [omerta-contracts/src/GenesisOracle.sol:49](../../omerta-contracts/src/GenesisOracle.sol#L49) | `IOmrOracle`, `Ownable2Step` |
| `GenesisPlayerSale` | contract | [omerta-contracts/src/GenesisPlayerSale.sol:25](../../omerta-contracts/src/GenesisPlayerSale.sol#L25) | `ReentrancyGuard`, `GenesisCharacterEligibility` |
| `GenesisProceedsSplitter` | contract | [omerta-contracts/src/GenesisProceedsSplitter.sol:28](../../omerta-contracts/src/GenesisProceedsSplitter.sol#L28) | `ReentrancyGuard` |
| `GenesisWalletCap` | contract | [omerta-contracts/src/GenesisWalletCap.sol:19](../../omerta-contracts/src/GenesisWalletCap.sol#L19) | `IGenesisBidValidation` |
| `IAcquisitionAuthorityV2` | interface | [omerta-contracts/src/interfaces/IAcquisitionAuthorityV2.sol:3](../../omerta-contracts/src/interfaces/IAcquisitionAuthorityV2.sol#L3) | — |
| `IAcquisitionIntentExecutionV2` | interface | [omerta-contracts/src/interfaces/IAcquisitionIntentExecutionV2.sol:3](../../omerta-contracts/src/interfaces/IAcquisitionIntentExecutionV2.sol#L3) | — |
| `IAcquisitionVaultV1` | interface | [omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol:3](../../omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol#L3) | — |
| `IAuctionStorage` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IAuctionStorage.sol:7](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IAuctionStorage.sol#L7) | — |
| `IBidStorage` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IBidStorage.sol:7](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IBidStorage.sol#L7) | — |
| `ICheckpointStorage` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ICheckpointStorage.sol:7](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ICheckpointStorage.sol#L7) | — |
| `ICommitmentPositionManagerV2` | interface | [omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol:18](../../omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol#L18) | `IPositionManager` |
| `IContinuousClearingAuction` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol:31](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol#L31) | `ILBPInitializer`, `ICheckpointStorage`, `ITickStorage`, `IStepStorage`, `IAuctionStorage`, `IBidStorage` |
| `IDistributor` | interface | [omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/IDistributor.sol:8](../../omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/IDistributor.sol#L8) | — |
| `IERC20Minimal` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/external/IERC20Minimal.sol:5](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/external/IERC20Minimal.sol#L5) | — |
| `IFeeRevenueRouter` | interface | [omerta-contracts/src/FeeRevenueRouter.sol:9](../../omerta-contracts/src/FeeRevenueRouter.sol#L9) | — |
| `IGearVault` | interface | [omerta-contracts/src/VoucherClaim.sol:11](../../omerta-contracts/src/VoucherClaim.sol#L11) | — |
| `IGenesisArbSys` | interface | [omerta-contracts/src/GenesisLifecycleController.sol:53](../../omerta-contracts/src/GenesisLifecycleController.sol#L53) | — |
| `IGenesisAuction` | interface | [omerta-contracts/src/GenesisLifecycleController.sol:23](../../omerta-contracts/src/GenesisLifecycleController.sol#L23) | — |
| `IGenesisBidValidation` | interface | [omerta-contracts/src/GenesisWalletCap.sol:10](../../omerta-contracts/src/GenesisWalletCap.sol#L10) | — |
| `IGenesisCapController` | interface | [omerta-contracts/src/GenesisWalletCap.sol:3](../../omerta-contracts/src/GenesisWalletCap.sol#L3) | — |
| `IGenesisFoundation` | interface | [omerta-contracts/src/GenesisLifecycleController.sol:40](../../omerta-contracts/src/GenesisLifecycleController.sol#L40) | — |
| `IGenesisGatedAuction` | interface | [omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol:21](../../omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol#L21) | — |
| `IGenesisMarketHook` | interface | [omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol:35](../../omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol#L35) | — |
| `IGenesisPlayerIntegration` | interface | [omerta-contracts/src/GenesisPlayerSale.sol:11](../../omerta-contracts/src/GenesisPlayerSale.sol#L11) | — |
| `IGenesisStrategy` | interface | [omerta-contracts/src/GenesisLifecycleController.sol:35](../../omerta-contracts/src/GenesisLifecycleController.sol#L35) | — |
| `IInitializerHook` | interface | [omerta-contracts/src/interfaces/IInitializerHook.sol:10](../../omerta-contracts/src/interfaces/IInitializerHook.sol#L10) | `IERC165` |
| `ILBPInitializer` | interface | [omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/ILBPInitializer.sol:20](../../omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/ILBPInitializer.sol#L20) | `IDistributor`, `IERC165` |
| `ILiquidityHealth` | interface | [omerta-contracts/src/interfaces/ILiquidityHealth.sol:5](../../omerta-contracts/src/interfaces/ILiquidityHealth.sol#L5) | — |
| `IOmertaGenesisClaimGate` | interface | [omerta-contracts/src/genesis-auction/OmertaGuardedAuction.sol:8](../../omerta-contracts/src/genesis-auction/OmertaGuardedAuction.sol#L8) | — |
| `IOmertaMarketStateV2` | interface | [omerta-contracts/src/market-v2/IOmertaMarketStateV2.sol:7](../../omerta-contracts/src/market-v2/IOmertaMarketStateV2.sol#L7) | — |
| `IOmrHookObserver` | interface | [omerta-contracts/src/OmertaHook.sol:24](../../omerta-contracts/src/OmertaHook.sol#L24) | — |
| `IOMRMintable` | interface | [omerta-contracts/src/OmertaBond.sol:16](../../omerta-contracts/src/OmertaBond.sol#L16) | — |
| `IOmrOracle` | interface | [omerta-contracts/src/IOmrOracle.sol:18](../../omerta-contracts/src/IOmrOracle.sol#L18) | — |
| `IOmrV4ObservationSource` | interface | [omerta-contracts/src/interfaces/IOmrV4ObservationSource.sol:10](../../omerta-contracts/src/interfaces/IOmrV4ObservationSource.sol#L10) | — |
| `IProtocolFeeController` | interface | [omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/IProtocolFeeController.sol:10](../../omerta-contracts/src/genesis-auction/vendor/launcher/src/interfaces/IProtocolFeeController.sol#L10) | — |
| `IProtocolGenesisController` | interface | [omerta-contracts/src/ProtocolLiquidityVault.sol:43](../../omerta-contracts/src/ProtocolLiquidityVault.sol#L43) | — |
| `IProtocolInventoryExecutor` | interface | [omerta-contracts/src/ProtocolLiquidityVault.sol:31](../../omerta-contracts/src/ProtocolLiquidityVault.sol#L31) | — |
| `IProtocolPositionManager` | interface | [omerta-contracts/src/ProtocolLiquidityVault.sol:25](../../omerta-contracts/src/ProtocolLiquidityVault.sol#L25) | `IPositionManager` |
| `IRwaHealthOverlay` | interface | [omerta-contracts/src/interfaces/IRwaHealthOverlay.sol:5](../../omerta-contracts/src/interfaces/IRwaHealthOverlay.sol#L5) | — |
| `ISettlementDataFeeSource` | interface | [omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol:3](../../omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol#L3) | — |
| `ISettlementGasPoolMigrationCandidate` | interface | [omerta-contracts/src/SettlementGasPool.sol:9](../../omerta-contracts/src/SettlementGasPool.sol#L9) | — |
| `ISingleGenesisAuction` | interface | [omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol:20](../../omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol#L20) | — |
| `ISingleGenesisCharacterGate` | interface | [omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol:41](../../omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol#L41) | — |
| `ISingleGenesisMarketHook` | interface | [omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol:36](../../omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol#L36) | — |
| `IStepStorage` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IStepStorage.sol:7](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IStepStorage.sol#L7) | — |
| `IStockQuoteOracle` | interface | [omerta-contracts/src/RwaStockBuyer.sol:28](../../omerta-contracts/src/RwaStockBuyer.sol#L28) | — |
| `IStockSwapAdapter` | interface | [omerta-contracts/src/RwaStockBuyer.sol:20](../../omerta-contracts/src/RwaStockBuyer.sol#L20) | — |
| `IStockTokenRegistry` | interface | [omerta-contracts/src/RwaStockBuyer.sol:9](../../omerta-contracts/src/RwaStockBuyer.sol#L9) | — |
| `IStockTokenRegistryV2` | interface | [omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol:3](../../omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol#L3) | — |
| `ITickStorage` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ITickStorage.sol:13](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/ITickStorage.sol#L13) | — |
| `IUniswapV2Factory` | interface | [omerta-contracts/src/OmrTwapOracle.sol:8](../../omerta-contracts/src/OmrTwapOracle.sol#L8) | — |
| `IUniswapV2Pair` | interface | [omerta-contracts/src/OmrTwapOracle.sol:12](../../omerta-contracts/src/OmrTwapOracle.sol#L12) | — |
| `IValidationHook` | interface | [omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IValidationHook.sol:5](../../omerta-contracts/src/genesis-auction/vendor/cca/interfaces/IValidationHook.sol#L5) | — |
| `KeeperGasVault` | contract | [omerta-contracts/src/KeeperGasVault.sol:14](../../omerta-contracts/src/KeeperGasVault.sol#L14) | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `LiquidityBuybackExecutor` | contract | [omerta-contracts/src/LiquidityBuybackExecutor.sol:27](../../omerta-contracts/src/LiquidityBuybackExecutor.sol#L27) | `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `IUnlockCallback` |
| `MaxBidPriceLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/MaxBidPriceLib.sol:9](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/MaxBidPriceLib.sol#L9) | — |
| `OmertaArbitrageV2` | contract | [omerta-contracts/src/market-v2/OmertaArbitrageV2.sol:21](../../omerta-contracts/src/market-v2/OmertaArbitrageV2.sol#L21) | `IUnlockCallback`, `ReentrancyGuard` |
| `OmertaAuctionCoordinatorV2` | contract | [omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol:50](../../omerta-contracts/src/market-v2/OmertaAuctionCoordinatorV2.sol#L50) | `ReentrancyGuard` |
| `OmertaBond` | contract | [omerta-contracts/src/OmertaBond.sol:74](../../omerta-contracts/src/OmertaBond.sol#L74) | `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `OmertaCommitmentVaultV2` | contract | [omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol:30](../../omerta-contracts/src/market-v2/OmertaCommitmentVaultV2.sol#L30) | `Ownable2Step`, `ReentrancyGuard`, `IERC721Receiver` |
| `OmertaFees` | contract | [omerta-contracts/src/OmertaFees.sol:21](../../omerta-contracts/src/OmertaFees.sol#L21) | `Ownable2Step`, `ReentrancyGuard` |
| `OmertaGameSettlementV2` | contract | [omerta-contracts/src/market-v2/OmertaGameSettlementV2.sol:10](../../omerta-contracts/src/market-v2/OmertaGameSettlementV2.sol#L10) | `ReentrancyGuard` |
| `OmertaGenesisCoordinatorV2` | contract | [omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol:44](../../omerta-contracts/src/market-v2/OmertaGenesisCoordinatorV2.sol#L44) | `IGenesisPlayerIntegration`, `ReentrancyGuard` |
| `OmertaGuardedAuction` | contract | [omerta-contracts/src/genesis-auction/OmertaGuardedAuction.sol:16](../../omerta-contracts/src/genesis-auction/OmertaGuardedAuction.sol#L16) | `ContinuousClearingAuction` |
| `OmertaHook` | contract | [omerta-contracts/src/OmertaHook.sol:118](../../omerta-contracts/src/OmertaHook.sol#L118) | `IHooks`, `IInitializerHook`, `IOmrV4ObservationSource`, `Ownable2Step` |
| `OmertaHookV2` | contract | [omerta-contracts/src/market-v2/OmertaHookV2.sol:27](../../omerta-contracts/src/market-v2/OmertaHookV2.sol#L27) | `IHooks`, `IInitializerHook`, `IOmrV4ObservationSource`, `ReentrancyGuard` |
| `OmertaInventoryBondV2` | contract | [omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol:20](../../omerta-contracts/src/market-v2/OmertaInventoryBondV2.sol#L20) | `ReentrancyGuard` |
| `OmertaMarketStateV2` | contract | [omerta-contracts/src/market-v2/OmertaMarketStateV2.sol:14](../../omerta-contracts/src/market-v2/OmertaMarketStateV2.sol#L14) | `IOmertaMarketStateV2` |
| `OmertaReserveFundingV2` | contract | [omerta-contracts/src/market-v2/OmertaReserveFundingV2.sol:12](../../omerta-contracts/src/market-v2/OmertaReserveFundingV2.sol#L12) | `ReentrancyGuard` |
| `OmertaStabilityControllerV2` | contract | [omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol:26](../../omerta-contracts/src/market-v2/OmertaStabilityControllerV2.sol#L26) | `ReentrancyGuard`, `IUnlockCallback` |
| `OmertaTurfFeeBridgeV2` | contract | [omerta-contracts/src/market-v2/OmertaTurfFeeBridgeV2.sol:12](../../omerta-contracts/src/market-v2/OmertaTurfFeeBridgeV2.sol#L12) | `ReentrancyGuard` |
| `OmertaTurfV2` | contract | [omerta-contracts/src/market-v2/OmertaTurfV2.sol:15](../../omerta-contracts/src/market-v2/OmertaTurfV2.sol#L15) | `Ownable2Step`, `ReentrancyGuard` |
| `OMR` | contract | [omerta-contracts/src/OMR.sol:76](../../omerta-contracts/src/OMR.sol#L76) | `ERC20Permit`, `Ownable2Step` |
| `OMRStaking` | contract | [omerta-contracts/src/OMRStaking.sol:15](../../omerta-contracts/src/OMRStaking.sol#L15) | `Ownable2Step`, `ReentrancyGuard` |
| `OmrTwapOracle` | contract | [omerta-contracts/src/OmrTwapOracle.sol:49](../../omerta-contracts/src/OmrTwapOracle.sol#L49) | `IOmrOracle`, `Ownable2Step` |
| `OmrV4TwapOracle` | contract | [omerta-contracts/src/OmrV4TwapOracle.sol:44](../../omerta-contracts/src/OmrV4TwapOracle.sol#L44) | `IOmrOracle`, `IOmrHookObserver` |
| `PreVoteBudgetBook` | contract | [omerta-contracts/src/PreVoteBudgetBook.sol:3](../../omerta-contracts/src/PreVoteBudgetBook.sol#L3) | — |
| `PriceLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/PriceLib.sol:9](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/PriceLib.sol#L9) | — |
| `ProtocolFeeLib` | library | [omerta-contracts/src/genesis-auction/vendor/launcher/src/libraries/ProtocolFeeLib.sol:10](../../omerta-contracts/src/genesis-auction/vendor/launcher/src/libraries/ProtocolFeeLib.sol#L10) | — |
| `ProtocolLiquidityVault` | contract | [omerta-contracts/src/ProtocolLiquidityVault.sol:58](../../omerta-contracts/src/ProtocolLiquidityVault.sol#L58) | `Ownable2Step`, `ReentrancyGuard`, `IERC721Receiver` |
| `ReentrancyGuardTransient` | abstract contract | [omerta-contracts/src/genesis-auction/vendor/solady/utils/ReentrancyGuardTransient.sol:9](../../omerta-contracts/src/genesis-auction/vendor/solady/utils/ReentrancyGuardTransient.sol#L9) | — |
| `RwaHealthOverlay` | contract | [omerta-contracts/src/RwaHealthOverlay.sol:6](../../omerta-contracts/src/RwaHealthOverlay.sol#L6) | `IRwaHealthOverlay` |
| `RwaStockBuyer` | contract | [omerta-contracts/src/RwaStockBuyer.sol:43](../../omerta-contracts/src/RwaStockBuyer.sol#L43) | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `SafeTransferLib` | library | [omerta-contracts/src/genesis-auction/vendor/solady/utils/SafeTransferLib.sol:11](../../omerta-contracts/src/genesis-auction/vendor/solady/utils/SafeTransferLib.sol#L11) | — |
| `SettlementGasPool` | contract | [omerta-contracts/src/SettlementGasPool.sol:24](../../omerta-contracts/src/SettlementGasPool.sol#L24) | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `SSTORE2` | library | [omerta-contracts/src/genesis-auction/vendor/solady/utils/SSTORE2.sol:10](../../omerta-contracts/src/genesis-auction/vendor/solady/utils/SSTORE2.sol#L10) | — |
| `StepLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/StepLib.sol:11](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/StepLib.sol#L11) | — |
| `StepStorage` | contract | [omerta-contracts/src/genesis-auction/vendor/cca/StepStorage.sol:13](../../omerta-contracts/src/genesis-auction/vendor/cca/StepStorage.sol#L13) | `BlockNumberish`, `IStepStorage` |
| `StockTokenRegistry` | contract | [omerta-contracts/src/StockTokenRegistry.sol:18](../../omerta-contracts/src/StockTokenRegistry.sol#L18) | `Ownable2Step` |
| `StockTokenRegistryV2` | contract | [omerta-contracts/src/StockTokenRegistryV2.sol:10](../../omerta-contracts/src/StockTokenRegistryV2.sol#L10) | `IStockTokenRegistryV2`, `Ownable2Step` |
| `StockVault` | contract | [omerta-contracts/src/StockVault.sol:44](../../omerta-contracts/src/StockVault.sol#L44) | `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `EIP712` |
| `StreetDeed` | contract | [omerta-contracts/src/StreetDeed.sol:37](../../omerta-contracts/src/StreetDeed.sol#L37) | `ERC721`, `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `TickStorage` | abstract contract | [omerta-contracts/src/genesis-auction/vendor/cca/TickStorage.sol:9](../../omerta-contracts/src/genesis-auction/vendor/cca/TickStorage.sol#L9) | `ITickStorage` |
| `Transmuter` | contract | [omerta-contracts/src/Transmuter.sol:59](../../omerta-contracts/src/Transmuter.sol#L59) | `Ownable2Step`, `ReentrancyGuard`, `FlashGuard` |
| `ValidationHookLib` | library | [omerta-contracts/src/genesis-auction/vendor/cca/libraries/ValidationHookLib.sol:8](../../omerta-contracts/src/genesis-auction/vendor/cca/libraries/ValidationHookLib.sol#L8) | — |
| `VoucherClaim` | contract | [omerta-contracts/src/VoucherClaim.sol:28](../../omerta-contracts/src/VoucherClaim.sol#L28) | `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
