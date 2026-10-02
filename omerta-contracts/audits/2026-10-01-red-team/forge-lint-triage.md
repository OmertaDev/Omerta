# Forge lint triage — 2026-10-01

Fresh per-position lint triage; historical dispositions reused only if exact source SHA and rule/path/line/column match. Current market/genesis checked bounds and sign/check ordering explicitly. All raw warning blocks retained; no new tests claimed.

464 warnings from successful required size build. Native build exit 0 does not mean lint warning free. Raw input SHA256: `b6f6b575b99c506534f265e5c514e5c1d9deb3bd318b9ab6833f24ca5315d384`.

| Scope | Warnings |
|---|---:|
| test | 252 |
| production-source | 188 |
| vendored-source | 19 |
| operator-script | 5 |

| Rule | Warnings |
|---|---:|
| erc20-unchecked-transfer | 57 |
| block-timestamp | 127 |
| unsafe-typecast | 270 |
| divide-before-multiply | 9 |
| unchecked-call | 1 |

All unchecked ERC20 calls and the unchecked low-level call in this log are test fixtures. Market casts distinguish explicit range/sign guards, bounded fees/epoch integrals, and intentional oracle modulo wrapping. Permit2 expiration and uint64 chain times retain distant numeric-horizon assumptions. Vendored schedule casts follow total-MPS validation; unused Solady helpers are scoped by caller search, not declared mathematically safe.

## Open leads

No unresolved lint leads after source/phase triage. This is not an absence-of-defects guarantee.

## Source diagnostics

| ID | Rule | Source | Disposition |
|---|---|---|---|
| FORGE-LINT-003 | block-timestamp | src/AcquisitionAuthority.sol:481:13 | intentional-chain-time-boundary |
| FORGE-LINT-004 | block-timestamp | src/AcquisitionAuthority.sol:497:13 | intentional-chain-time-boundary |
| FORGE-LINT-005 | unsafe-typecast | src/genesis-auction/vendor/cca/BidStorage.sol:38:25 | bounded-or-intentional-cast |
| FORGE-LINT-006 | block-timestamp | src/AcquisitionAuthority.sol:498:13 | intentional-chain-time-boundary |
| FORGE-LINT-007 | unsafe-typecast | src/genesis-auction/vendor/cca/libraries/StepLib.sol:24:22 | bounded-or-intentional-cast |
| FORGE-LINT-009 | unsafe-typecast | src/OmertaHook.sol:552:44 | bounded-or-intentional-cast |
| FORGE-LINT-010 | block-timestamp | src/AcquisitionAuthority.sol:705:13 | intentional-chain-time-boundary |
| FORGE-LINT-012 | unsafe-typecast | src/genesis-auction/vendor/cca/StepStorage.sol:80:29 | bounded-or-intentional-cast |
| FORGE-LINT-014 | block-timestamp | src/AcquisitionAuthority.sol:809:13 | intentional-chain-time-boundary |
| FORGE-LINT-016 | unsafe-typecast | src/OmertaHook.sol:552:51 | bounded-or-intentional-cast |
| FORGE-LINT-018 | block-timestamp | src/KeeperGasVault.sol:61:51 | intentional-chain-time-boundary |
| FORGE-LINT-019 | block-timestamp | src/AcquisitionAuthority.sol:815:13 | intentional-chain-time-boundary |
| FORGE-LINT-020 | block-timestamp | src/StockVault.sol:188:17 | intentional-chain-time-boundary |
| FORGE-LINT-022 | block-timestamp | src/KeeperGasVault.sol:73:13 | intentional-chain-time-boundary |
| FORGE-LINT-024 | block-timestamp | src/AcquisitionAuthority.sol:1082:13 | intentional-chain-time-boundary |
| FORGE-LINT-025 | block-timestamp | src/AcquisitionAuthority.sol:1083:13 | intentional-chain-time-boundary |
| FORGE-LINT-027 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:201:40 | unreachable-library-helper |
| FORGE-LINT-028 | unsafe-typecast | src/OmertaHook.sol:570:59 | bounded-or-intentional-cast |
| FORGE-LINT-029 | block-timestamp | src/LiquidityBuybackExecutor.sol:125:31 | intentional-chain-time-boundary |
| FORGE-LINT-030 | block-timestamp | src/LiquidityBuybackExecutor.sol:125:62 | intentional-chain-time-boundary |
| FORGE-LINT-031 | block-timestamp | src/StreetDeed.sol:169:17 | intentional-chain-time-boundary |
| FORGE-LINT-032 | unsafe-typecast | src/OmertaHook.sol:570:92 | bounded-or-intentional-cast |
| FORGE-LINT-034 | unsafe-typecast | src/AcquisitionAuthority.sol:1134:34 | intentional-abi-selector-extraction |
| FORGE-LINT-035 | block-timestamp | src/LiquidityBuybackExecutor.sol:137:13 | intentional-chain-time-boundary |
| FORGE-LINT-037 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:269:18 | unreachable-library-helper |
| FORGE-LINT-038 | block-timestamp | src/LiquidityBuybackExecutor.sol:138:13 | intentional-chain-time-boundary |
| FORGE-LINT-042 | block-timestamp | src/LiquidityBuybackExecutor.sol:138:43 | intentional-chain-time-boundary |
| FORGE-LINT-043 | block-timestamp | src/StreetDeed.sol:170:17 | intentional-chain-time-boundary |
| FORGE-LINT-044 | unsafe-typecast | src/OmertaHook.sol:585:43 | bounded-or-intentional-cast |
| FORGE-LINT-045 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:269:85 | unreachable-library-helper |
| FORGE-LINT-048 | unsafe-typecast | src/OmertaHook.sol:585:76 | bounded-or-intentional-cast |
| FORGE-LINT-050 | unsafe-typecast | src/LiquidityBuybackExecutor.sol:177:31 | bounded-or-intentional-cast |
| FORGE-LINT-051 | unsafe-typecast | src/AcquisitionConstellationFactory.sol:330:41 | explicit-high-bit-check |
| FORGE-LINT-053 | unsafe-typecast | src/OmertaHook.sol:628:43 | bounded-or-intentional-cast |
| FORGE-LINT-054 | block-timestamp | src/VoucherClaim.sol:124:17 | intentional-chain-time-boundary |
| FORGE-LINT-055 | block-timestamp | src/VoucherClaim.sol:125:17 | intentional-chain-time-boundary |
| FORGE-LINT-058 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:357:39 | unreachable-library-helper |
| FORGE-LINT-059 | unsafe-typecast | src/AcquisitionConstellationFactory.sol:344:41 | explicit-high-bit-check |
| FORGE-LINT-062 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:366:24 | unreachable-library-helper |
| FORGE-LINT-063 | block-timestamp | src/market-v2/OmertaArbitrageV2.sol:106:20 | intentional-chain-time-boundary |
| FORGE-LINT-064 | unsafe-typecast | src/OmertaHook.sol:628:51 | bounded-or-intentional-cast |
| FORGE-LINT-065 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1079:18 | unreachable-library-helper |
| FORGE-LINT-066 | block-timestamp | src/market-v2/OmertaArbitrageV2.sol:106:55 | intentional-chain-time-boundary |
| FORGE-LINT-068 | unsafe-typecast | src/market-v2/OmertaArbitrageV2.sol:145:26 | bounded-or-intentional-cast |
| FORGE-LINT-069 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1079:31 | unreachable-library-helper |
| FORGE-LINT-073 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:112:13 | intentional-chain-time-boundary |
| FORGE-LINT-075 | unsafe-typecast | src/OmertaHook.sol:628:77 | bounded-or-intentional-cast |
| FORGE-LINT-076 | block-timestamp | src/AcquisitionVault.sol:180:13 | intentional-chain-time-boundary |
| FORGE-LINT-077 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:126:36 | intentional-chain-time-boundary |
| FORGE-LINT-080 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1079:52 | unreachable-library-helper |
| FORGE-LINT-081 | unsafe-typecast | src/OmertaHook.sol:628:85 | bounded-or-intentional-cast |
| FORGE-LINT-083 | block-timestamp | src/AcquisitionVault.sol:230:13 | intentional-chain-time-boundary |
| FORGE-LINT-084 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1197:39 | unreachable-library-helper |
| FORGE-LINT-086 | block-timestamp | src/AcquisitionVault.sol:241:13 | intentional-chain-time-boundary |
| FORGE-LINT-087 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:140:13 | intentional-chain-time-boundary |
| FORGE-LINT-088 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:140:45 | intentional-chain-time-boundary |
| FORGE-LINT-089 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:141:16 | intentional-chain-time-boundary |
| FORGE-LINT-090 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1197:63 | unreachable-library-helper |
| FORGE-LINT-093 | block-timestamp | src/AcquisitionVault.sol:242:13 | intentional-chain-time-boundary |
| FORGE-LINT-094 | divide-before-multiply | src/OmrTwapOracle.sol:234:37 | intentional-fixed-point-rounding |
| FORGE-LINT-095 | divide-before-multiply | src/OmrTwapOracle.sol:235:37 | intentional-fixed-point-rounding |
| FORGE-LINT-097 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1198:17 | unreachable-library-helper |
| FORGE-LINT-099 | block-timestamp | script/Deploy.s.sol:191:21 | intentional-chain-time-boundary |
| FORGE-LINT-100 | block-timestamp | src/AcquisitionVault.sol:479:13 | intentional-chain-time-boundary |
| FORGE-LINT-103 | unsafe-typecast | src/OmrTwapOracle.sol:178:82 | bounded-or-intentional-cast |
| FORGE-LINT-104 | block-timestamp | src/AcquisitionVault.sol:544:13 | intentional-chain-time-boundary |
| FORGE-LINT-107 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:181:13 | intentional-chain-time-boundary |
| FORGE-LINT-108 | block-timestamp | src/AcquisitionVault.sol:913:13 | intentional-chain-time-boundary |
| FORGE-LINT-109 | unsafe-typecast | script/DeployTestnetTwap.s.sol:37:13 | exact-testnet-constant-bound |
| FORGE-LINT-110 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1198:37 | unreachable-library-helper |
| FORGE-LINT-112 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:202:36 | intentional-chain-time-boundary |
| FORGE-LINT-113 | unsafe-typecast | src/OmrV4TwapOracle.sol:173:82 | bounded-or-intentional-cast |
| FORGE-LINT-114 | unsafe-typecast | script/DeployTwapOracle.s.sol:22:103 | explicit-operator-input-bound |
| FORGE-LINT-117 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1199:27 | unreachable-library-helper |
| FORGE-LINT-118 | block-timestamp | src/AcquisitionVault.sol:914:13 | intentional-chain-time-boundary |
| FORGE-LINT-119 | unsafe-typecast | script/DeployV4TwapOracle.s.sol:51:80 | operator-input-bound |
| FORGE-LINT-121 | unsafe-typecast | src/OmrV4TwapOracle.sol:192:28 | bounded-or-intentional-cast |
| FORGE-LINT-122 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:235:16 | intentional-chain-time-boundary |
| FORGE-LINT-123 | block-timestamp | src/market-v2/OmertaCommitmentVaultV2.sol:235:50 | intentional-chain-time-boundary |
| FORGE-LINT-124 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1199:51 | unreachable-library-helper |
| FORGE-LINT-127 | unsafe-typecast | src/market-v2/OmertaCommitmentVaultV2.sol:223:94 | bounded-or-intentional-cast |
| FORGE-LINT-128 | block-timestamp | script/UpdateTestnetTwap.s.sol:29:17 | intentional-chain-time-boundary |
| FORGE-LINT-129 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1200:17 | unreachable-library-helper |
| FORGE-LINT-130 | unsafe-typecast | src/AcquisitionVault.sol:821:16 | explicit-bound-check |
| FORGE-LINT-131 | block-timestamp | src/PreVoteBudgetBook.sol:127:13 | intentional-chain-time-boundary |
| FORGE-LINT-132 | unsafe-typecast | src/market-v2/OmertaCommitmentVaultV2.sol:224:86 | bounded-or-intentional-cast |
| FORGE-LINT-134 | unsafe-typecast | src/genesis-auction/vendor/solady/utils/FixedPointMathLib.sol:1200:37 | unreachable-library-helper |
| FORGE-LINT-135 | block-timestamp | src/market-v2/OmertaInventoryBondV2.sol:170:36 | intentional-chain-time-boundary |
| FORGE-LINT-136 | block-timestamp | src/market-v2/OmertaInventoryBondV2.sol:170:66 | intentional-chain-time-boundary |
| FORGE-LINT-138 | unsafe-typecast | src/AcquisitionVault.sol:939:34 | intentional-abi-selector-extraction |
| FORGE-LINT-141 | block-timestamp | src/PreVoteBudgetBook.sol:129:13 | intentional-chain-time-boundary |
| FORGE-LINT-143 | block-timestamp | src/market-v2/OmertaInventoryBondV2.sol:224:44 | intentional-chain-time-boundary |
| FORGE-LINT-144 | unsafe-typecast | src/market-v2/OmertaCommitmentVaultV2.sol:227:64 | bounded-or-intentional-cast |
| FORGE-LINT-145 | block-timestamp | src/AcquisitionVaultCore.sol:276:13 | intentional-chain-time-boundary |
| FORGE-LINT-146 | block-timestamp | src/market-v2/OmertaInventoryBondV2.sol:226:13 | intentional-chain-time-boundary |
| FORGE-LINT-148 | unsafe-typecast | src/PreVoteBudgetBook.sol:259:20 | explicit-bound-check |
| FORGE-LINT-149 | block-timestamp | src/market-v2/OmertaGameSettlementV2.sol:53:13 | intentional-chain-time-boundary |
| FORGE-LINT-150 | block-timestamp | src/market-v2/OmertaInventoryBondV2.sol:258:82 | intentional-chain-time-boundary |
| FORGE-LINT-151 | block-timestamp | src/market-v2/OmertaInventoryBondV2.sol:259:20 | intentional-chain-time-boundary |
| FORGE-LINT-152 | block-timestamp | src/market-v2/OmertaGameSettlementV2.sol:141:37 | intentional-chain-time-boundary |
| FORGE-LINT-155 | unsafe-typecast | src/market-v2/OmertaInventoryBondV2.sol:201:68 | bounded-or-intentional-cast |
| FORGE-LINT-156 | block-timestamp | src/ProtocolLiquidityVault.sol:265:16 | intentional-chain-time-boundary |
| FORGE-LINT-157 | block-timestamp | src/GenesisLifecycleController.sol:171:31 | intentional-chain-time-boundary |
| FORGE-LINT-160 | block-timestamp | src/ProtocolLiquidityVault.sol:299:13 | intentional-chain-time-boundary |
| FORGE-LINT-161 | block-timestamp | src/GenesisLifecycleController.sol:171:62 | intentional-chain-time-boundary |
| FORGE-LINT-163 | block-timestamp | src/DynastyNFT.sol:147:17 | intentional-chain-time-boundary |
| FORGE-LINT-164 | block-timestamp | src/ProtocolLiquidityVault.sol:299:43 | intentional-chain-time-boundary |
| FORGE-LINT-165 | unsafe-typecast | src/market-v2/OmertaGenesisCoordinatorV2.sol:181:71 | bounded-or-intentional-cast |
| FORGE-LINT-167 | block-timestamp | src/GenesisOracle.sol:66:28 | intentional-chain-time-boundary |
| FORGE-LINT-168 | unsafe-typecast | src/market-v2/OmertaInventoryBondV2.sol:216:22 | bounded-or-intentional-cast |
| FORGE-LINT-172 | block-timestamp | src/ProtocolLiquidityVault.sol:380:55 | intentional-chain-time-boundary |
| FORGE-LINT-173 | block-timestamp | src/ProtocolLiquidityVault.sol:381:16 | intentional-chain-time-boundary |
| FORGE-LINT-174 | block-timestamp | src/GenesisOracle.sol:80:28 | intentional-chain-time-boundary |
| FORGE-LINT-175 | unsafe-typecast | src/market-v2/OmertaInventoryBondV2.sol:265:26 | bounded-or-intentional-cast |
| FORGE-LINT-177 | block-timestamp | src/ProtocolLiquidityVault.sol:540:17 | intentional-chain-time-boundary |
| FORGE-LINT-178 | block-timestamp | src/DynastyNFT.sol:148:17 | intentional-chain-time-boundary |
| FORGE-LINT-180 | block-timestamp | src/market-v2/OmertaMarketStateV2.sol:43:16 | intentional-chain-time-boundary |
| FORGE-LINT-181 | block-timestamp | src/GenesisOracle.sol:88:27 | intentional-chain-time-boundary |
| FORGE-LINT-182 | block-timestamp | src/ProtocolLiquidityVault.sol:550:36 | intentional-chain-time-boundary |
| FORGE-LINT-184 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:239:16 | bounded-or-intentional-cast |
| FORGE-LINT-185 | block-timestamp | src/market-v2/OmertaMarketStateV2.sol:43:44 | intentional-chain-time-boundary |
| FORGE-LINT-187 | unsafe-typecast | src/ProtocolLiquidityVault.sol:421:82 | bounded-or-intentional-cast |
| FORGE-LINT-188 | block-timestamp | src/GenesisPlayerSale.sol:67:35 | intentional-chain-time-boundary |
| FORGE-LINT-189 | block-timestamp | src/market-v2/OmertaMarketStateV2.sol:75:40 | intentional-chain-time-boundary |
| FORGE-LINT-190 | block-timestamp | src/market-v2/OmertaMarketStateV2.sol:76:16 | intentional-chain-time-boundary |
| FORGE-LINT-191 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:239:23 | bounded-or-intentional-cast |
| FORGE-LINT-194 | unsafe-typecast | src/market-v2/OmertaMarketStateV2.sol:47:32 | bounded-or-intentional-cast |
| FORGE-LINT-195 | block-timestamp | src/FlashGuard.sol:108:13 | intentional-chain-time-boundary |
| FORGE-LINT-196 | block-timestamp | src/GenesisPlayerSale.sol:87:43 | intentional-chain-time-boundary |
| FORGE-LINT-198 | unsafe-typecast | src/ProtocolLiquidityVault.sol:437:38 | bounded-or-intentional-cast |
| FORGE-LINT-200 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:289:17 | bounded-or-intentional-cast |
| FORGE-LINT-203 | block-timestamp | src/GenesisPlayerSale.sol:96:43 | intentional-chain-time-boundary |
| FORGE-LINT-207 | unsafe-typecast | src/market-v2/OmertaMarketStateV2.sol:51:56 | bounded-or-intentional-cast |
| FORGE-LINT-208 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:331:60 | bounded-or-intentional-cast |
| FORGE-LINT-209 | unsafe-typecast | src/ProtocolLiquidityVault.sol:438:35 | bounded-or-intentional-cast |
| FORGE-LINT-210 | block-timestamp | src/GenesisPlayerSale.sol:105:55 | intentional-chain-time-boundary |
| FORGE-LINT-214 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:336:35 | bounded-or-intentional-cast |
| FORGE-LINT-215 | block-timestamp | src/RwaHealthOverlay.sol:99:13 | intentional-chain-time-boundary |
| FORGE-LINT-216 | block-timestamp | src/GenesisPlayerSale.sol:106:16 | intentional-chain-time-boundary |
| FORGE-LINT-219 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:340:20 | bounded-or-intentional-cast |
| FORGE-LINT-220 | block-timestamp | src/RwaHealthOverlay.sol:99:51 | intentional-chain-time-boundary |
| FORGE-LINT-221 | block-timestamp | src/GenesisPlayerSale.sol:118:16 | intentional-chain-time-boundary |
| FORGE-LINT-222 | block-timestamp | src/GenesisPlayerSale.sol:118:46 | intentional-chain-time-boundary |
| FORGE-LINT-223 | block-timestamp | src/GenesisPlayerSale.sol:127:38 | intentional-chain-time-boundary |
| FORGE-LINT-225 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:358:28 | bounded-or-intentional-cast |
| FORGE-LINT-228 | block-timestamp | src/RwaStockBuyer.sol:210:55 | intentional-chain-time-boundary |
| FORGE-LINT-229 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:358:54 | bounded-or-intentional-cast |
| FORGE-LINT-231 | block-timestamp | src/RwaStockBuyer.sol:211:13 | intentional-chain-time-boundary |
| FORGE-LINT-232 | block-timestamp | src/market-v2/OmertaStabilityControllerV2.sol:278:35 | intentional-chain-time-boundary |
| FORGE-LINT-235 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:363:62 | bounded-or-intentional-cast |
| FORGE-LINT-239 | block-timestamp | src/market-v2/OmertaStabilityControllerV2.sol:278:72 | intentional-chain-time-boundary |
| FORGE-LINT-240 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:376:26 | bounded-or-intentional-cast |
| FORGE-LINT-245 | block-timestamp | src/SettlementGasPool.sol:490:13 | intentional-chain-time-boundary |
| FORGE-LINT-246 | block-timestamp | src/market-v2/OmertaStabilityControllerV2.sol:288:49 | intentional-chain-time-boundary |
| FORGE-LINT-248 | block-timestamp | src/SettlementGasPool.sol:491:13 | intentional-chain-time-boundary |
| FORGE-LINT-249 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:377:33 | bounded-or-intentional-cast |
| FORGE-LINT-250 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:377:41 | bounded-or-intentional-cast |
| FORGE-LINT-251 | block-timestamp | src/SettlementGasPool.sol:586:13 | intentional-chain-time-boundary |
| FORGE-LINT-253 | block-timestamp | src/market-v2/OmertaStabilityControllerV2.sol:329:13 | intentional-chain-time-boundary |
| FORGE-LINT-254 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:389:43 | bounded-or-intentional-cast |
| FORGE-LINT-255 | block-timestamp | src/SettlementGasPool.sol:587:13 | intentional-chain-time-boundary |
| FORGE-LINT-257 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:391:57 | bounded-or-intentional-cast |
| FORGE-LINT-259 | block-timestamp | src/market-v2/OmertaStabilityControllerV2.sol:462:82 | intentional-chain-time-boundary |
| FORGE-LINT-260 | block-timestamp | src/market-v2/OmertaStabilityControllerV2.sol:463:20 | intentional-chain-time-boundary |
| FORGE-LINT-261 | block-timestamp | src/StockTokenRegistry.sol:160:13 | intentional-chain-time-boundary |
| FORGE-LINT-264 | block-timestamp | src/StockTokenRegistryV2.sol:139:13 | intentional-chain-time-boundary |
| FORGE-LINT-265 | block-timestamp | src/StockTokenRegistryV2.sol:146:13 | intentional-chain-time-boundary |
| FORGE-LINT-266 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:420:29 | bounded-or-intentional-cast |
| FORGE-LINT-267 | unsafe-typecast | src/market-v2/OmertaHookV2.sol:398:52 | bounded-or-intentional-cast |
| FORGE-LINT-268 | block-timestamp | src/StockTokenRegistryV2.sol:237:13 | intentional-chain-time-boundary |
| FORGE-LINT-270 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:421:26 | bounded-or-intentional-cast |
| FORGE-LINT-274 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:471:13 | bounded-or-intentional-cast |
| FORGE-LINT-275 | block-timestamp | src/StockTokenRegistryV2.sol:238:13 | intentional-chain-time-boundary |
| FORGE-LINT-277 | block-timestamp | src/market-v2/OmertaTurfV2.sol:101:57 | intentional-chain-time-boundary |
| FORGE-LINT-278 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:494:39 | bounded-or-intentional-cast |
| FORGE-LINT-281 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:494:63 | bounded-or-intentional-cast |
| FORGE-LINT-282 | block-timestamp | src/market-v2/OmertaTurfV2.sol:119:13 | intentional-chain-time-boundary |
| FORGE-LINT-283 | block-timestamp | src/OmertaBond.sol:333:31 | intentional-chain-time-boundary |
| FORGE-LINT-284 | block-timestamp | src/OmertaBond.sol:334:17 | intentional-chain-time-boundary |
| FORGE-LINT-288 | block-timestamp | src/market-v2/OmertaTurfV2.sol:131:30 | intentional-chain-time-boundary |
| FORGE-LINT-290 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:517:17 | bounded-or-intentional-cast |
| FORGE-LINT-292 | block-timestamp | src/market-v2/OmertaTurfV2.sol:185:61 | intentional-chain-time-boundary |
| FORGE-LINT-295 | block-timestamp | src/OmertaBond.sol:371:13 | intentional-chain-time-boundary |
| FORGE-LINT-296 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:517:28 | bounded-or-intentional-cast |
| FORGE-LINT-301 | block-timestamp | src/OmertaBond.sol:372:13 | intentional-chain-time-boundary |
| FORGE-LINT-302 | block-timestamp | src/market-v2/OmertaTurfV2.sol:201:33 | intentional-chain-time-boundary |
| FORGE-LINT-303 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:546:53 | bounded-or-intentional-cast |
| FORGE-LINT-307 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:546:87 | bounded-or-intentional-cast |
| FORGE-LINT-312 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:549:31 | bounded-or-intentional-cast |
| FORGE-LINT-314 | block-timestamp | src/market-v2/OmertaTurfV2.sol:210:30 | intentional-chain-time-boundary |
| FORGE-LINT-316 | block-timestamp | src/market-v2/OmertaTurfFeeBridgeV2.sol:77:13 | intentional-chain-time-boundary |
| FORGE-LINT-317 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:550:31 | bounded-or-intentional-cast |
| FORGE-LINT-321 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:555:33 | bounded-or-intentional-cast |
| FORGE-LINT-325 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:556:30 | bounded-or-intentional-cast |
| FORGE-LINT-330 | block-timestamp | src/market-v2/OmertaTurfFeeBridgeV2.sol:91:17 | intentional-chain-time-boundary |
| FORGE-LINT-332 | block-timestamp | src/market-v2/OmertaTurfV2.sol:222:35 | intentional-chain-time-boundary |
| FORGE-LINT-340 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:564:29 | bounded-or-intentional-cast |
| FORGE-LINT-344 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:565:26 | bounded-or-intentional-cast |
| FORGE-LINT-345 | block-timestamp | src/market-v2/OmertaTurfV2.sol:230:33 | intentional-chain-time-boundary |
| FORGE-LINT-348 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:566:32 | bounded-or-intentional-cast |
| FORGE-LINT-350 | block-timestamp | src/market-v2/OmertaTurfV2.sol:266:13 | intentional-chain-time-boundary |
| FORGE-LINT-351 | block-timestamp | src/market-v2/OmertaTurfV2.sol:266:45 | intentional-chain-time-boundary |
| FORGE-LINT-352 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:567:29 | bounded-or-intentional-cast |
| FORGE-LINT-355 | block-timestamp | src/market-v2/OmertaTurfV2.sol:273:16 | intentional-chain-time-boundary |
| FORGE-LINT-356 | block-timestamp | src/market-v2/OmertaTurfV2.sol:273:60 | intentional-chain-time-boundary |
| FORGE-LINT-363 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:568:33 | bounded-or-intentional-cast |
| FORGE-LINT-367 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:569:30 | bounded-or-intentional-cast |
| FORGE-LINT-370 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:570:69 | bounded-or-intentional-cast |
| FORGE-LINT-385 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:570:90 | bounded-or-intentional-cast |
| FORGE-LINT-389 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:586:51 | bounded-or-intentional-cast |
| FORGE-LINT-392 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:586:59 | bounded-or-intentional-cast |
| FORGE-LINT-396 | unsafe-typecast | src/market-v2/OmertaStabilityControllerV2.sol:588:30 | bounded-or-intentional-cast |
