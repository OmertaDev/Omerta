// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {RwaHealthOverlay} from "../src/RwaHealthOverlay.sol";
import {IRwaHealthOverlay} from "../src/interfaces/IRwaHealthOverlay.sol";
import {IStockTokenRegistryV2} from "../src/interfaces/IStockTokenRegistryV2.sol";
import {StockTokenRegistryV2} from "../src/StockTokenRegistryV2.sol";
import {RwaHealthOverlaySafe, RwaHealthOverlayStockToken} from "./utils/RwaHealthOverlayTestBase.sol";

contract RwaHealthOverlayHandler is Test {
    uint64 private constant TTL = 7 days;

    RwaHealthOverlay public immutable overlay;
    RwaHealthOverlaySafe public immutable safe;
    StockTokenRegistryV2 public immutable registry;
    bytes32 public immutable assetVersionKey;

    uint256 public successfulRecords;
    uint256 public unauthorizedAttempts;
    uint256 public replayAttempts;
    uint256 public scenarioCalls;
    bytes32 public expectedLatestClearanceId;
    bytes32[] private _successfulIds;
    mapping(bytes32 clearanceId => IRwaHealthOverlay.Clearance value) private _values;

    constructor(
        RwaHealthOverlay overlay_,
        RwaHealthOverlaySafe safe_,
        StockTokenRegistryV2 registry_,
        bytes32 assetVersionKey_
    ) {
        overlay = overlay_;
        safe = safe_;
        registry = registry_;
        assetVersionKey = assetVersionKey_;
    }

    function record(uint256 seed) external {
        if (!_enterScenario()) return;
        if (successfulRecords == 16) return;
        IRwaHealthOverlay.Clearance memory value = _next(seed);
        bytes32 id = safe.record(overlay, value);
        ++successfulRecords;
        expectedLatestClearanceId = id;
        _successfulIds.push(id);
        _values[id] = value;
        _assertState();
    }

    function unauthorized(uint256 seed) external {
        if (!_enterScenario()) return;
        IRwaHealthOverlay.Clearance memory value = _next(seed);
        uint256 beforeGeneration = overlay.clearanceGeneration(assetVersionKey);
        bytes32 beforeLatest = overlay.latestClearanceId(assetVersionKey);
        bytes32 id = overlay.clearanceId(value);
        try overlay.recordClearance(value) {
            fail();
        } catch {}
        ++unauthorizedAttempts;
        assertEq(overlay.clearanceGeneration(assetVersionKey), beforeGeneration);
        assertEq(overlay.latestClearanceId(assetVersionKey), beforeLatest);
        assertFalse(overlay.usedClearanceId(id));
        _assertState();
    }

    function replay(uint256 seed) external {
        if (!_enterScenario()) return;
        if (_successfulIds.length == 0) return;
        bytes32 id = _successfulIds[seed % _successfulIds.length];
        IRwaHealthOverlay.Clearance memory value = _values[id];
        uint256 beforeGeneration = overlay.clearanceGeneration(assetVersionKey);
        bytes32 beforeLatest = overlay.latestClearanceId(assetVersionKey);
        try safe.record(overlay, value) {
            fail();
        } catch {}
        ++replayAttempts;
        assertEq(overlay.clearanceGeneration(assetVersionKey), beforeGeneration);
        assertEq(overlay.latestClearanceId(assetVersionKey), beforeLatest);
        assertTrue(overlay.usedClearanceId(id));
        _assertState();
    }

    function assertState() external view {
        _assertState();
    }

    function successfulIdCount() external view returns (uint256) {
        return _successfulIds.length;
    }

    function successfulIdAt(uint256 index) external view returns (bytes32) {
        return _successfulIds[index];
    }

    function _next(uint256 seed) private view returns (IRwaHealthOverlay.Clearance memory value) {
        uint256 nextGeneration = overlay.clearanceGeneration(assetVersionKey) + 1;
        value = IRwaHealthOverlay.Clearance({
            catalogSnapshotHash: keccak256(abi.encode("invariant-catalog", nextGeneration, seed)),
            assetVersionKey: assetVersionKey,
            activationGeneration: registry.activationGeneration(assetVersionKey),
            episodeId: keccak256(abi.encode("invariant-episode", nextGeneration, seed)),
            episodeGeneration: nextGeneration,
            currentSeverity: uint8(seed % 2 + 1),
            stateSequence: uint64(nextGeneration % uint256(uint64(type(int64).max)) + 1),
            latestEpisodeEventId: keccak256(abi.encode("invariant-event", nextGeneration, seed)),
            latestMaterialEvidenceHash: keccak256(abi.encode("invariant-material", nextGeneration, seed)),
            recoveryEvidenceHash: keccak256(abi.encode("invariant-recovery", nextGeneration, seed)),
            freshHealthyEvaluationId: keccak256(abi.encode("invariant-evaluation", nextGeneration, seed)),
            freshHealthyEvidenceHash: keccak256(abi.encode("invariant-healthy", nextGeneration, seed)),
            reviewerIdHash: keccak256(abi.encode("invariant-reviewer", nextGeneration, seed)),
            approvedAt: uint64(block.timestamp),
            clearanceDeadline: uint64(block.timestamp + TTL),
            expectedOverlayGeneration: nextGeneration
        });
    }

    function _enterScenario() private returns (bool) {
        if (scenarioCalls == 32) return false;
        ++scenarioCalls;
        return true;
    }

    function _assertState() private view {
        assertEq(overlay.clearanceGeneration(assetVersionKey), successfulRecords);
        assertEq(overlay.latestClearanceId(assetVersionKey), expectedLatestClearanceId);
        assertEq(_successfulIds.length, successfulRecords);
        if (_successfulIds.length != 0) {
            assertTrue(overlay.usedClearanceId(_successfulIds[0]));
            assertTrue(overlay.usedClearanceId(_successfulIds[_successfulIds.length - 1]));
        }
    }
}

contract RwaHealthOverlayInvariantTest is StdInvariant, Test {
    RwaHealthOverlay internal overlay;
    RwaHealthOverlaySafe internal safe;
    StockTokenRegistryV2 internal registry;
    RwaHealthOverlayHandler internal handler;
    bytes32 internal assetVersionKey;

    function setUp() public {
        vm.chainId(4663);
        vm.warp(400 days);
        safe = new RwaHealthOverlaySafe();
        registry = new StockTokenRegistryV2(address(safe), makeAddr("invariant-publisher"));
        RwaHealthOverlayStockToken token = new RwaHealthOverlayStockToken();
        IStockTokenRegistryV2.Activation memory activation = IStockTokenRegistryV2.Activation({
            token: address(token),
            robinhoodAssetIdHash: keccak256("invariant-provider"),
            ticker: "INV",
            name: "Invariant Stock Token",
            tokenDecimals: 18,
            evidenceHash: keccak256("invariant-activation-evidence"),
            reviewId: keccak256("invariant-activation-review"),
            approvedAt: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + 7 days)
        });
        assetVersionKey = safe.activate(registry, activation);
        overlay = new RwaHealthOverlay(address(safe), registry);
        handler = new RwaHealthOverlayHandler(overlay, safe, registry, assetVersionKey);

        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = handler.record.selector;
        selectors[1] = handler.unauthorized.selector;
        selectors[2] = handler.replay.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_generationLatestAndUsedIdsAreMonotone() external view {
        handler.assertState();
        uint256 count = handler.successfulIdCount();
        assertEq(overlay.clearanceGeneration(assetVersionKey), count);
        if (count != 0) {
            assertTrue(overlay.usedClearanceId(handler.successfulIdAt(0)));
            assertTrue(overlay.usedClearanceId(handler.successfulIdAt(count - 1)));
        }
    }
}
