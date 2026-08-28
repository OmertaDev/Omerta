// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {RwaHealthOverlay} from "../../src/RwaHealthOverlay.sol";
import {IRwaHealthOverlay} from "../../src/interfaces/IRwaHealthOverlay.sol";
import {IStockTokenRegistryV2} from "../../src/interfaces/IStockTokenRegistryV2.sol";
import {StockTokenRegistryV2} from "../../src/StockTokenRegistryV2.sol";

contract RwaHealthOverlaySafe {
    function activate(IStockTokenRegistryV2 registry, IStockTokenRegistryV2.Activation calldata value)
        external
        returns (bytes32)
    {
        return registry.activateVersion(value);
    }

    function deactivate(IStockTokenRegistryV2 registry, bytes32 assetVersionKey, bytes32 reasonHash) external {
        registry.deactivateVersion(assetVersionKey, reasonHash);
    }

    function record(IRwaHealthOverlay overlay, IRwaHealthOverlay.Clearance calldata value) external returns (bytes32) {
        return overlay.recordClearance(value);
    }
}

contract RwaHealthOverlayStockToken is ERC20 {
    constructor() ERC20("Overlay Stock Token", "OST") {}
}

contract RwaHealthOverlayRegistryMock {
    uint256 public supportedChainId = 4663;
    uint256 public generation;
    bytes32 public versionKey;
    bytes32 public tickerHead;
    bytes32 public tokenHead;
    bytes32 public providerHead;
    IStockTokenRegistryV2.AssetVersion private _version;

    function configure(bytes32 key, IStockTokenRegistryV2.AssetVersion calldata version_, uint256 generation_)
        external
    {
        versionKey = key;
        _version = version_;
        generation = generation_;
        tickerHead = key;
        tokenHead = key;
        providerHead = key;
    }

    function setSupportedChainId(uint256 chainId) external {
        supportedChainId = chainId;
    }

    function setGeneration(uint256 generation_) external {
        generation = generation_;
    }

    function setVersion(IStockTokenRegistryV2.AssetVersion calldata version_) external {
        _version = version_;
    }

    function setHeads(bytes32 ticker, bytes32 token, bytes32 provider) external {
        tickerHead = ticker;
        tokenHead = token;
        providerHead = provider;
    }

    function activationGeneration(bytes32 key) external view returns (uint256) {
        if (key != versionKey) return 0;
        return generation;
    }

    function getVersion(bytes32 key) external view returns (IStockTokenRegistryV2.AssetVersion memory) {
        if (key != versionKey) revert();
        return _version;
    }

    function activeVersionForTickerHash(bytes32) external view returns (bytes32) {
        return tickerHead;
    }

    function activeVersionForToken(address) external view returns (bytes32) {
        return tokenHead;
    }

    function activeVersionForProviderIdHash(bytes32) external view returns (bytes32) {
        return providerHead;
    }
}

abstract contract RwaHealthOverlayTestBase is Test {
    uint256 internal constant CHAIN_ID = 4663;
    uint64 internal constant TTL = 7 days;
    uint64 internal constant NOW = 200 days;

    bytes32 internal constant CATALOG = keccak256("overlay-catalog");
    bytes32 internal constant PROVIDER = keccak256("overlay-provider");
    bytes32 internal constant ACTIVATION_EVIDENCE = keccak256("overlay-activation-evidence");
    bytes32 internal constant ACTIVATION_REVIEW = keccak256("overlay-activation-review");

    RwaHealthOverlaySafe internal safe;
    StockTokenRegistryV2 internal registry;
    RwaHealthOverlayStockToken internal token;
    RwaHealthOverlay internal overlay;
    bytes32 internal assetVersionKey;

    function setUp() public virtual {
        vm.chainId(CHAIN_ID);
        vm.warp(NOW);
        safe = new RwaHealthOverlaySafe();
        registry = new StockTokenRegistryV2(address(safe), makeAddr("overlay-publisher"));
        token = new RwaHealthOverlayStockToken();
        assetVersionKey = _activate(registry, safe, token);
        overlay = new RwaHealthOverlay(address(safe), registry);
    }

    function _activate(StockTokenRegistryV2 registry_, RwaHealthOverlaySafe safe_, RwaHealthOverlayStockToken token_)
        internal
        returns (bytes32)
    {
        IStockTokenRegistryV2.Activation memory activation = IStockTokenRegistryV2.Activation({
            token: address(token_),
            robinhoodAssetIdHash: PROVIDER,
            ticker: "OST",
            name: "Overlay Stock Token",
            tokenDecimals: 18,
            evidenceHash: ACTIVATION_EVIDENCE,
            reviewId: ACTIVATION_REVIEW,
            approvedAt: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + TTL)
        });
        return safe_.activate(registry_, activation);
    }

    function _validClearance() internal view returns (IRwaHealthOverlay.Clearance memory value) {
        value = IRwaHealthOverlay.Clearance({
            catalogSnapshotHash: CATALOG,
            assetVersionKey: assetVersionKey,
            activationGeneration: registry.activationGeneration(assetVersionKey),
            episodeId: keccak256("overlay-episode"),
            episodeGeneration: 3,
            currentSeverity: 2,
            stateSequence: 42,
            latestEpisodeEventId: keccak256("overlay-episode-event"),
            latestMaterialEvidenceHash: keccak256("overlay-material-evidence"),
            recoveryEvidenceHash: keccak256("overlay-recovery-evidence"),
            freshHealthyEvaluationId: keccak256("overlay-healthy-evaluation"),
            freshHealthyEvidenceHash: keccak256("overlay-healthy-evidence"),
            reviewerIdHash: keccak256("overlay-reviewer"),
            approvedAt: uint64(block.timestamp),
            clearanceDeadline: uint64(block.timestamp + TTL),
            expectedOverlayGeneration: overlay.clearanceGeneration(assetVersionKey) + 1
        });
    }

    function _record(IRwaHealthOverlay.Clearance memory value) internal returns (bytes32) {
        return safe.record(overlay, value);
    }

    function _assertEmpty(bytes32 key) internal view {
        assertEq(overlay.clearanceGeneration(key), 0);
        assertEq(overlay.latestClearanceId(key), bytes32(0));
    }

    function _expectSafeReject(IRwaHealthOverlay.Clearance memory value) internal {
        bytes32 predicted = overlay.clearanceId(value);
        uint256 generationBefore = overlay.clearanceGeneration(value.assetVersionKey);
        bytes32 latestBefore = overlay.latestClearanceId(value.assetVersionKey);
        bool usedBefore = overlay.usedClearanceId(predicted);
        vm.expectRevert();
        safe.record(overlay, value);
        assertEq(overlay.clearanceGeneration(value.assetVersionKey), generationBefore);
        assertEq(overlay.latestClearanceId(value.assetVersionKey), latestBefore);
        assertEq(overlay.usedClearanceId(predicted), usedBefore);
    }
}
