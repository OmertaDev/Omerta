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
| `Alchemist` | contract | [omerta-contracts/src/Alchemist.sol:40](../../omerta-contracts/src/Alchemist.sol#L40) | `Ownable2Step`, `ReentrancyGuard`, `FlashGuard` |
| `CollateralEscrow` | contract | [omerta-contracts/src/CollateralEscrow.sol:40](../../omerta-contracts/src/CollateralEscrow.sol#L40) | — |
| `Denari` | contract | [omerta-contracts/src/Denari.sol:43](../../omerta-contracts/src/Denari.sol#L43) | `ERC20`, `ERC20Permit`, `Ownable2Step` |
| `DynastyNFT` | contract | [omerta-contracts/src/DynastyNFT.sol:49](../../omerta-contracts/src/DynastyNFT.sol#L49) | `ERC721`, `ERC2981`, `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `FlashGuard` | abstract contract | [omerta-contracts/src/FlashGuard.sol:52](../../omerta-contracts/src/FlashGuard.sol#L52) | — |
| `GearVault` | contract | [omerta-contracts/src/GearVault.sol:24](../../omerta-contracts/src/GearVault.sol#L24) | `ERC1155`, `Ownable2Step` |
| `GenesisOracle` | contract | [omerta-contracts/src/GenesisOracle.sol:49](../../omerta-contracts/src/GenesisOracle.sol#L49) | `IOmrOracle`, `Ownable2Step` |
| `GenesisProceedsSplitter` | contract | [omerta-contracts/src/GenesisProceedsSplitter.sol:28](../../omerta-contracts/src/GenesisProceedsSplitter.sol#L28) | `ReentrancyGuard` |
| `IAcquisitionAuthorityV2` | interface | [omerta-contracts/src/interfaces/IAcquisitionAuthorityV2.sol:3](../../omerta-contracts/src/interfaces/IAcquisitionAuthorityV2.sol#L3) | — |
| `IAcquisitionIntentExecutionV2` | interface | [omerta-contracts/src/interfaces/IAcquisitionIntentExecutionV2.sol:3](../../omerta-contracts/src/interfaces/IAcquisitionIntentExecutionV2.sol#L3) | — |
| `IAcquisitionVaultV1` | interface | [omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol:3](../../omerta-contracts/src/interfaces/IAcquisitionVaultV1.sol#L3) | — |
| `IGearVault` | interface | [omerta-contracts/src/VoucherClaim.sol:11](../../omerta-contracts/src/VoucherClaim.sol#L11) | — |
| `IInitializerHook` | interface | [omerta-contracts/src/interfaces/IInitializerHook.sol:10](../../omerta-contracts/src/interfaces/IInitializerHook.sol#L10) | `IERC165` |
| `IOmrHookObserver` | interface | [omerta-contracts/src/OmertaHook.sol:24](../../omerta-contracts/src/OmertaHook.sol#L24) | — |
| `IOMRMintable` | interface | [omerta-contracts/src/OmertaBond.sol:15](../../omerta-contracts/src/OmertaBond.sol#L15) | — |
| `IOmrOracle` | interface | [omerta-contracts/src/IOmrOracle.sol:18](../../omerta-contracts/src/IOmrOracle.sol#L18) | — |
| `IOmrV4ObservationSource` | interface | [omerta-contracts/src/interfaces/IOmrV4ObservationSource.sol:10](../../omerta-contracts/src/interfaces/IOmrV4ObservationSource.sol#L10) | — |
| `IRwaHealthOverlay` | interface | [omerta-contracts/src/interfaces/IRwaHealthOverlay.sol:5](../../omerta-contracts/src/interfaces/IRwaHealthOverlay.sol#L5) | — |
| `ISettlementDataFeeSource` | interface | [omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol:3](../../omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol#L3) | — |
| `ISettlementGasPoolMigrationCandidate` | interface | [omerta-contracts/src/SettlementGasPool.sol:9](../../omerta-contracts/src/SettlementGasPool.sol#L9) | — |
| `IStockQuoteOracle` | interface | [omerta-contracts/src/RwaStockBuyer.sol:28](../../omerta-contracts/src/RwaStockBuyer.sol#L28) | — |
| `IStockSwapAdapter` | interface | [omerta-contracts/src/RwaStockBuyer.sol:20](../../omerta-contracts/src/RwaStockBuyer.sol#L20) | — |
| `IStockTokenRegistry` | interface | [omerta-contracts/src/RwaStockBuyer.sol:9](../../omerta-contracts/src/RwaStockBuyer.sol#L9) | — |
| `IStockTokenRegistryV2` | interface | [omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol:3](../../omerta-contracts/src/interfaces/IStockTokenRegistryV2.sol#L3) | — |
| `IUniswapV2Factory` | interface | [omerta-contracts/src/OmrTwapOracle.sol:8](../../omerta-contracts/src/OmrTwapOracle.sol#L8) | — |
| `IUniswapV2Pair` | interface | [omerta-contracts/src/OmrTwapOracle.sol:12](../../omerta-contracts/src/OmrTwapOracle.sol#L12) | — |
| `OmertaBond` | contract | [omerta-contracts/src/OmertaBond.sol:73](../../omerta-contracts/src/OmertaBond.sol#L73) | `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `OmertaFees` | contract | [omerta-contracts/src/OmertaFees.sol:18](../../omerta-contracts/src/OmertaFees.sol#L18) | `Ownable2Step`, `ReentrancyGuard` |
| `OmertaHook` | contract | [omerta-contracts/src/OmertaHook.sol:118](../../omerta-contracts/src/OmertaHook.sol#L118) | `IHooks`, `IInitializerHook`, `IOmrV4ObservationSource`, `Ownable2Step` |
| `OMR` | contract | [omerta-contracts/src/OMR.sol:76](../../omerta-contracts/src/OMR.sol#L76) | `ERC20Permit`, `Ownable2Step` |
| `OMRStaking` | contract | [omerta-contracts/src/OMRStaking.sol:15](../../omerta-contracts/src/OMRStaking.sol#L15) | `Ownable2Step`, `ReentrancyGuard` |
| `OmrTwapOracle` | contract | [omerta-contracts/src/OmrTwapOracle.sol:49](../../omerta-contracts/src/OmrTwapOracle.sol#L49) | `IOmrOracle`, `Ownable2Step` |
| `OmrV4TwapOracle` | contract | [omerta-contracts/src/OmrV4TwapOracle.sol:39](../../omerta-contracts/src/OmrV4TwapOracle.sol#L39) | `IOmrOracle`, `IOmrHookObserver` |
| `PreVoteBudgetBook` | contract | [omerta-contracts/src/PreVoteBudgetBook.sol:3](../../omerta-contracts/src/PreVoteBudgetBook.sol#L3) | — |
| `RwaHealthOverlay` | contract | [omerta-contracts/src/RwaHealthOverlay.sol:6](../../omerta-contracts/src/RwaHealthOverlay.sol#L6) | `IRwaHealthOverlay` |
| `RwaStockBuyer` | contract | [omerta-contracts/src/RwaStockBuyer.sol:43](../../omerta-contracts/src/RwaStockBuyer.sol#L43) | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `SettlementGasPool` | contract | [omerta-contracts/src/SettlementGasPool.sol:24](../../omerta-contracts/src/SettlementGasPool.sol#L24) | `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `StockTokenRegistry` | contract | [omerta-contracts/src/StockTokenRegistry.sol:18](../../omerta-contracts/src/StockTokenRegistry.sol#L18) | `Ownable2Step` |
| `StockTokenRegistryV2` | contract | [omerta-contracts/src/StockTokenRegistryV2.sol:10](../../omerta-contracts/src/StockTokenRegistryV2.sol#L10) | `IStockTokenRegistryV2`, `Ownable2Step` |
| `StockVault` | contract | [omerta-contracts/src/StockVault.sol:44](../../omerta-contracts/src/StockVault.sol#L44) | `Ownable2Step`, `Pausable`, `ReentrancyGuard`, `EIP712` |
| `StreetDeed` | contract | [omerta-contracts/src/StreetDeed.sol:37](../../omerta-contracts/src/StreetDeed.sol#L37) | `ERC721`, `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
| `Transmuter` | contract | [omerta-contracts/src/Transmuter.sol:58](../../omerta-contracts/src/Transmuter.sol#L58) | `Ownable2Step`, `ReentrancyGuard`, `FlashGuard` |
| `VoucherClaim` | contract | [omerta-contracts/src/VoucherClaim.sol:28](../../omerta-contracts/src/VoucherClaim.sol#L28) | `EIP712`, `Ownable2Step`, `Pausable`, `ReentrancyGuard` |
