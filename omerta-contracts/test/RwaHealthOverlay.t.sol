// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {RwaHealthOverlay} from "../src/RwaHealthOverlay.sol";
import {IRwaHealthOverlay} from "../src/interfaces/IRwaHealthOverlay.sol";
import {IStockTokenRegistryV2} from "../src/interfaces/IStockTokenRegistryV2.sol";
import {StockTokenRegistryV2} from "../src/StockTokenRegistryV2.sol";
import {Vm} from "forge-std/Vm.sol";
import {
    RwaHealthOverlayRegistryMock,
    RwaHealthOverlaySafe,
    RwaHealthOverlayStockToken,
    RwaHealthOverlayTestBase
} from "./utils/RwaHealthOverlayTestBase.sol";

contract RwaHealthOverlayUnitTest is RwaHealthOverlayTestBase {
    function test_constructorPinsClosedImmutableAuthority() external view {
        assertEq(overlay.supportedChainId(), CHAIN_ID);
        assertEq(overlay.SAFE(), address(safe));
        assertEq(address(overlay.REGISTRY()), address(registry));
        _assertEmpty(assetVersionKey);
    }

    function test_constructorRejectsWrongChainZeroEoaAndWrongRegistryChain() external {
        vm.chainId(CHAIN_ID + 1);
        vm.expectRevert();
        new RwaHealthOverlay(address(safe), registry);
        vm.chainId(CHAIN_ID);

        vm.expectRevert();
        new RwaHealthOverlay(address(0), registry);
        vm.expectRevert();
        new RwaHealthOverlay(makeAddr("safe-eoa"), registry);
        vm.expectRevert();
        new RwaHealthOverlay(address(safe), IStockTokenRegistryV2(address(0)));
        vm.expectRevert();
        new RwaHealthOverlay(address(safe), IStockTokenRegistryV2(makeAddr("registry-eoa")));

        RwaHealthOverlayRegistryMock wrongChainRegistry = new RwaHealthOverlayRegistryMock();
        wrongChainRegistry.setSupportedChainId(CHAIN_ID + 1);
        vm.expectRevert();
        new RwaHealthOverlay(address(safe), IStockTokenRegistryV2(address(wrongChainRegistry)));
    }

    function test_recordClearanceEmitsExactCanonicalEventAndAdvancesExactlyOnce() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        bytes32 payloadHash = overlay.clearancePayloadHash(value);
        bytes32 callIntentHash = overlay.safeCallIntentHash(value);
        bytes32 id = overlay.clearanceId(value);

        vm.recordLogs();
        assertEq(_record(value), id);
        Vm.Log[] memory entries = vm.getRecordedLogs();
        assertEq(entries.length, 1);
        assertEq(entries[0].emitter, address(overlay));
        assertEq(entries[0].topics.length, 4);
        assertEq(
            entries[0].topics[0],
            keccak256(
                "ClearanceApplied(bytes32,bytes32,uint256,address,uint256,bytes32,bytes32,uint256,uint8,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,uint64)"
            )
        );
        assertEq(entries[0].topics[1], id);
        assertEq(entries[0].topics[2], value.assetVersionKey);
        assertEq(entries[0].topics[3], bytes32(uint256(1)));
        assertEq(
            entries[0].data,
            abi.encode(
                address(registry),
                value.activationGeneration,
                value.catalogSnapshotHash,
                value.episodeId,
                value.episodeGeneration,
                value.currentSeverity,
                value.stateSequence,
                value.latestEpisodeEventId,
                value.latestMaterialEvidenceHash,
                value.recoveryEvidenceHash,
                value.freshHealthyEvaluationId,
                value.freshHealthyEvidenceHash,
                value.reviewerIdHash,
                payloadHash,
                callIntentHash,
                value.approvedAt,
                value.clearanceDeadline
            )
        );
        assertEq(overlay.clearanceGeneration(assetVersionKey), 1);
        assertEq(overlay.latestClearanceId(assetVersionKey), id);
        assertTrue(overlay.usedClearanceId(id));
    }

    function test_onlySafeCanRecordAndEveryUnauthorizedRevertIsAtomic() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        bytes32 id = overlay.clearanceId(value);
        vm.expectRevert();
        overlay.recordClearance(value);
        _assertEmpty(assetVersionKey);
        assertFalse(overlay.usedClearanceId(id));

        address stranger = makeAddr("overlay-stranger");
        vm.prank(stranger);
        vm.expectRevert();
        overlay.recordClearance(value);
        _assertEmpty(assetVersionKey);
        assertFalse(overlay.usedClearanceId(id));
    }

    function test_rejectsEveryZeroHashAndClosedIntegerDomainWithoutWrites() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();

        bytes32 original = value.catalogSnapshotHash;
        value.catalogSnapshotHash = bytes32(0);
        _expectSafeReject(value);
        value.catalogSnapshotHash = original;
        original = value.assetVersionKey;
        value.assetVersionKey = bytes32(0);
        _expectSafeReject(value);
        value.assetVersionKey = original;
        original = value.episodeId;
        value.episodeId = bytes32(0);
        _expectSafeReject(value);
        value.episodeId = original;
        original = value.latestEpisodeEventId;
        value.latestEpisodeEventId = bytes32(0);
        _expectSafeReject(value);
        value.latestEpisodeEventId = original;
        original = value.latestMaterialEvidenceHash;
        value.latestMaterialEvidenceHash = bytes32(0);
        _expectSafeReject(value);
        value.latestMaterialEvidenceHash = original;
        original = value.recoveryEvidenceHash;
        value.recoveryEvidenceHash = bytes32(0);
        _expectSafeReject(value);
        value.recoveryEvidenceHash = original;
        original = value.freshHealthyEvaluationId;
        value.freshHealthyEvaluationId = bytes32(0);
        _expectSafeReject(value);
        value.freshHealthyEvaluationId = original;
        original = value.freshHealthyEvidenceHash;
        value.freshHealthyEvidenceHash = bytes32(0);
        _expectSafeReject(value);
        value.freshHealthyEvidenceHash = original;
        original = value.reviewerIdHash;
        value.reviewerIdHash = bytes32(0);
        _expectSafeReject(value);
        value.reviewerIdHash = original;

        value.activationGeneration = 0;
        _expectSafeReject(value);
        value.activationGeneration = 1;
        value.episodeGeneration = 0;
        _expectSafeReject(value);
        value.episodeGeneration = 3;
        value.expectedOverlayGeneration = 0;
        _expectSafeReject(value);
        value.expectedOverlayGeneration = 1;
        value.stateSequence = 0;
        _expectSafeReject(value);
        value.stateSequence = uint64(type(int64).max) + 1;
        _expectSafeReject(value);
        value.stateSequence = 42;
        value.currentSeverity = 0;
        _expectSafeReject(value);
        value.currentSeverity = 3;
        _expectSafeReject(value);
    }

    function test_exactSevenDayTtlAndHalfOpenExecutionWindow() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.clearanceDeadline -= 1;
        _expectSafeReject(value);
        value.clearanceDeadline += 2;
        _expectSafeReject(value);

        value = _validClearance();
        value.approvedAt += 1;
        value.clearanceDeadline += 1;
        _expectSafeReject(value);

        value = _validClearance();
        vm.warp(value.clearanceDeadline);
        _expectSafeReject(value);
    }

    function test_uint64TtlOverflowAndCrossedTimesRejectAtomically() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.approvedAt = type(uint64).max - TTL + 1;
        value.clearanceDeadline = type(uint64).max;
        _expectSafeReject(value);

        value = _validClearance();
        value.clearanceDeadline = value.approvedAt - 1;
        _expectSafeReject(value);
    }

    function test_overlayGenerationRejectsZeroFutureStaleAndIndependentReplay() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.expectedOverlayGeneration = 2;
        _expectSafeReject(value);
        value.expectedOverlayGeneration = 1;
        bytes32 id = _record(value);

        _expectSafeReject(value);
        IRwaHealthOverlay.Clearance memory other = _validClearance();
        other.expectedOverlayGeneration = 1;
        other.episodeId = keccak256("different-episode-same-generation");
        _expectSafeReject(other);

        bytes32 generationSlot = keccak256(abi.encode(value.assetVersionKey, uint256(0)));
        vm.store(address(overlay), generationSlot, bytes32(0));
        _expectSafeReject(value);
        assertTrue(overlay.usedClearanceId(id));

        vm.store(address(overlay), generationSlot, bytes32(uint256(1)));
        other.expectedOverlayGeneration = 2;
        other.approvedAt = uint64(block.timestamp);
        other.clearanceDeadline = uint64(block.timestamp + TTL);
        bytes32 second = _record(other);
        assertEq(overlay.clearanceGeneration(assetVersionKey), 2);
        assertEq(overlay.latestClearanceId(assetVersionKey), second);
    }

    function test_overlayGenerationAcceptsUint256MaxOnceThenRejectsTerminalState() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        bytes32 generationSlot = keccak256(abi.encode(value.assetVersionKey, uint256(0)));
        vm.store(address(overlay), generationSlot, bytes32(type(uint256).max - 1));
        value.expectedOverlayGeneration = type(uint256).max;

        assertNotEq(_record(value), bytes32(0));
        assertEq(overlay.clearanceGeneration(value.assetVersionKey), type(uint256).max);

        IRwaHealthOverlay.Clearance memory terminal = value;
        terminal.episodeId = keccak256("terminal-overlay-generation");
        _expectSafeReject(terminal);
        assertEq(overlay.clearanceGeneration(value.assetVersionKey), type(uint256).max);
    }

    function test_registryGenerationDeactivationAndReactivationInvalidatePreparedPackage() external {
        IRwaHealthOverlay.Clearance memory prepared = _validClearance();
        safe.deactivate(registry, assetVersionKey, keccak256("overlay-deactivation"));
        _expectSafeReject(prepared);

        assertEq(_activate(registry, safe, token), assetVersionKey);
        assertEq(registry.activationGeneration(assetVersionKey), 2);
        _expectSafeReject(prepared);

        IRwaHealthOverlay.Clearance memory current = prepared;
        current.activationGeneration = 2;
        current.approvedAt = uint64(block.timestamp);
        current.clearanceDeadline = uint64(block.timestamp + TTL);
        assertNotEq(_record(current), bytes32(0));
    }

    function test_eachBrokenRegistryHeadActiveFlagChainAndGenerationRejects() external {
        RwaHealthOverlayRegistryMock mock = new RwaHealthOverlayRegistryMock();
        bytes32 key = keccak256("mock-version");
        IStockTokenRegistryV2.AssetVersion memory version = IStockTokenRegistryV2.AssetVersion({
            chainId: CHAIN_ID,
            tickerHash: keccak256("MOCK"),
            token: address(token),
            robinhoodAssetIdHash: keccak256("mock-provider"),
            ticker: "MOCK",
            name: "Mock Version",
            tokenDecimals: 18,
            active: true,
            registeredAt: uint64(block.timestamp),
            activatedAt: uint64(block.timestamp),
            deactivatedAt: 0
        });
        mock.configure(key, version, 1);
        RwaHealthOverlay checked = new RwaHealthOverlay(address(safe), IStockTokenRegistryV2(address(mock)));
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        value.assetVersionKey = key;
        value.activationGeneration = 1;
        value.expectedOverlayGeneration = 1;

        mock.setSupportedChainId(CHAIN_ID + 1);
        _expectRejectOn(checked, value);
        mock.setSupportedChainId(CHAIN_ID);
        mock.setGeneration(2);
        _expectRejectOn(checked, value);
        mock.setGeneration(1);
        version.active = false;
        mock.setVersion(version);
        _expectRejectOn(checked, value);
        version.active = true;
        version.chainId = CHAIN_ID + 1;
        mock.setVersion(version);
        _expectRejectOn(checked, value);
        version.chainId = CHAIN_ID;
        mock.setVersion(version);

        mock.setHeads(bytes32(0), key, key);
        _expectRejectOn(checked, value);
        mock.setHeads(key, bytes32(0), key);
        _expectRejectOn(checked, value);
        mock.setHeads(key, key, bytes32(0));
        _expectRejectOn(checked, value);
        mock.setHeads(key, key, key);
        assertNotEq(safe.record(checked, value), bytes32(0));
    }

    function test_recordRejectsWhenPinnedRegistryRuntimeCodeDisappears() external {
        (RwaHealthOverlayRegistryMock mock, RwaHealthOverlay checked, IRwaHealthOverlay.Clearance memory value) =
            _mockBackedOverlay(1);
        vm.etch(address(mock), hex"");
        _expectRejectOn(checked, value);
    }

    function test_activationGenerationAcceptsUint256Maximum() external {
        (, RwaHealthOverlay checked, IRwaHealthOverlay.Clearance memory value) = _mockBackedOverlay(type(uint256).max);
        assertEq(value.activationGeneration, type(uint256).max);
        assertNotEq(safe.record(checked, value), bytes32(0));
    }

    function test_hashesBindSafeRegistryOverlayChainAndEveryPayloadField() external {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        bytes32 payload = overlay.clearancePayloadHash(value);
        bytes32 intent = overlay.safeCallIntentHash(value);
        bytes32 id = overlay.clearanceId(value);

        assertEq(payload, _expectedPayloadHash(CHAIN_ID, address(registry), address(overlay), value));
        assertEq(intent, _expectedCallIntentHash(CHAIN_ID, address(safe), address(overlay), value));
        assertEq(id, _expectedClearanceId(CHAIN_ID, address(registry), value, intent));

        RwaHealthOverlay secondOverlay = new RwaHealthOverlay(address(safe), registry);
        assertNotEq(secondOverlay.clearancePayloadHash(value), payload);
        assertNotEq(secondOverlay.safeCallIntentHash(value), intent);
        assertNotEq(secondOverlay.clearanceId(value), id);

        RwaHealthOverlaySafe secondSafe = new RwaHealthOverlaySafe();
        bytes32 substitutedSafeIntent = _expectedCallIntentHash(CHAIN_ID, address(secondSafe), address(overlay), value);
        assertNotEq(substitutedSafeIntent, intent);
        assertNotEq(_expectedClearanceId(CHAIN_ID, address(registry), value, substitutedSafeIntent), id);

        StockTokenRegistryV2 secondRegistry = new StockTokenRegistryV2(address(safe), makeAddr("publisher-two"));
        assertEq(_activate(secondRegistry, safe, token), assetVersionKey);
        bytes32 substitutedRegistryPayload =
            _expectedPayloadHash(CHAIN_ID, address(secondRegistry), address(overlay), value);
        assertNotEq(substitutedRegistryPayload, payload);
        assertNotEq(_expectedClearanceId(CHAIN_ID, address(secondRegistry), value, intent), id);

        vm.chainId(CHAIN_ID + 1);
        assertNotEq(overlay.clearancePayloadHash(value), payload);
        assertNotEq(overlay.safeCallIntentHash(value), intent);
        assertNotEq(overlay.clearanceId(value), id);
        _expectRejectOn(overlay, value);
    }

    function test_safeCallIntentCommitsExactSelectorCalldataAndClosedCallTuple() external view {
        IRwaHealthOverlay.Clearance memory value = _validClearance();
        bytes memory data = abi.encodeWithSelector(IRwaHealthOverlay.recordClearance.selector, value);
        bytes32 expected = keccak256(
            abi.encode(
                keccak256("OMERTA_RWA_HEALTH_SAFE_CALL_INTENT_V2"),
                CHAIN_ID,
                address(safe),
                address(overlay),
                uint256(0),
                uint8(0),
                IRwaHealthOverlay.recordClearance.selector,
                keccak256(data)
            )
        );
        assertEq(overlay.safeCallIntentHash(value), expected);
    }

    function test_closedRuntimeRejectsEthAndUnknownSelectorsAndFitsEip170() external {
        assertLt(address(overlay).code.length, 24_576);
        (bool paid,) = address(overlay).call{value: 1}("");
        assertFalse(paid);
        (bool unknown,) = address(overlay).call(hex"ffffffff");
        assertFalse(unknown);
    }

    function test_exactClosedAbiAndRuntimeCensus() external view {
        string memory json = vm.readFile("out/RwaHealthOverlay.sol/RwaHealthOverlay.json");
        assertTrue(vm.keyExistsJson(json, ".abi[11]"));
        assertFalse(vm.keyExistsJson(json, ".abi[12]"));
        string[12] memory rows = [
            "constructor|",
            "function|REGISTRY",
            "function|SAFE",
            "function|clearanceGeneration",
            "function|clearanceId",
            "function|clearancePayloadHash",
            "function|latestClearanceId",
            "function|recordClearance",
            "function|safeCallIntentHash",
            "function|supportedChainId",
            "function|usedClearanceId",
            "event|ClearanceApplied"
        ];
        for (uint256 i; i < rows.length; ++i) {
            string memory root = string.concat(".abi[", vm.toString(i), "]");
            string memory kind = vm.parseJsonString(json, string.concat(root, ".type"));
            string memory name = i == 0 ? "" : vm.parseJsonString(json, string.concat(root, ".name"));
            assertEq(string.concat(kind, "|", name), rows[i]);
        }

        string[16] memory clearanceTypes = [
            "bytes32",
            "bytes32",
            "uint256",
            "bytes32",
            "uint256",
            "uint8",
            "uint64",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "uint64",
            "uint64",
            "uint256"
        ];
        string[16] memory clearanceNames = [
            "catalogSnapshotHash",
            "assetVersionKey",
            "activationGeneration",
            "episodeId",
            "episodeGeneration",
            "currentSeverity",
            "stateSequence",
            "latestEpisodeEventId",
            "latestMaterialEvidenceHash",
            "recoveryEvidenceHash",
            "freshHealthyEvaluationId",
            "freshHealthyEvidenceHash",
            "reviewerIdHash",
            "approvedAt",
            "clearanceDeadline",
            "expectedOverlayGeneration"
        ];
        for (uint256 entry = 4; entry <= 8; ++entry) {
            if (entry == 6) continue;
            string memory inputRoot = string.concat(".abi[", vm.toString(entry), "].inputs[0]");
            assertEq(vm.parseJsonString(json, string.concat(inputRoot, ".name")), "value");
            assertEq(vm.parseJsonString(json, string.concat(inputRoot, ".type")), "tuple");
            for (uint256 i; i < clearanceTypes.length; ++i) {
                string memory component = string.concat(inputRoot, ".components[", vm.toString(i), "]");
                assertEq(vm.parseJsonString(json, string.concat(component, ".type")), clearanceTypes[i]);
                assertEq(vm.parseJsonString(json, string.concat(component, ".name")), clearanceNames[i]);
            }
        }
        string[20] memory eventTypes = [
            "bytes32",
            "bytes32",
            "uint256",
            "address",
            "uint256",
            "bytes32",
            "bytes32",
            "uint256",
            "uint8",
            "uint64",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "bytes32",
            "uint64",
            "uint64"
        ];
        string[20] memory eventNames = [
            "clearanceId",
            "assetVersionKey",
            "overlayGeneration",
            "registryAddress",
            "activationGeneration",
            "catalogSnapshotHash",
            "episodeId",
            "episodeGeneration",
            "currentSeverity",
            "stateSequence",
            "latestEpisodeEventId",
            "latestMaterialEvidenceHash",
            "recoveryEvidenceHash",
            "freshHealthyEvaluationId",
            "freshHealthyEvidenceHash",
            "reviewerIdHash",
            "clearancePayloadHash",
            "safeCallIntentHash",
            "approvedAt",
            "clearanceDeadline"
        ];
        for (uint256 i; i < eventTypes.length; ++i) {
            string memory eventInput = string.concat(".abi[11].inputs[", vm.toString(i), "]");
            assertEq(vm.parseJsonString(json, string.concat(eventInput, ".type")), eventTypes[i]);
            assertEq(vm.parseJsonString(json, string.concat(eventInput, ".name")), eventNames[i]);
            assertEq(vm.parseJsonBool(json, string.concat(eventInput, ".indexed")), i < 3);
        }
        assertEq(
            keccak256(
                "ClearanceApplied(bytes32,bytes32,uint256,address,uint256,bytes32,bytes32,uint256,uint8,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,uint64)"
            ),
            0xda9118bfbb750eb109fbcd8e639664c2c42b9669b49381d6a4f40bc09a696db7
        );
        assertEq(vm.getDeployedCode("RwaHealthOverlay.sol:RwaHealthOverlay").length, 3_825);
        assertEq(vm.getCode("RwaHealthOverlay.sol:RwaHealthOverlay").length, 4_205);
    }

    function _expectRejectOn(RwaHealthOverlay target, IRwaHealthOverlay.Clearance memory value) private {
        uint256 beforeGeneration = target.clearanceGeneration(value.assetVersionKey);
        bytes32 beforeLatest = target.latestClearanceId(value.assetVersionKey);
        bytes32 id = target.clearanceId(value);
        bool beforeUsed = target.usedClearanceId(id);
        vm.expectRevert();
        safe.record(target, value);
        assertEq(target.clearanceGeneration(value.assetVersionKey), beforeGeneration);
        assertEq(target.latestClearanceId(value.assetVersionKey), beforeLatest);
        assertEq(target.usedClearanceId(id), beforeUsed);
    }

    function _mockBackedOverlay(uint256 generation)
        private
        returns (RwaHealthOverlayRegistryMock mock, RwaHealthOverlay checked, IRwaHealthOverlay.Clearance memory value)
    {
        mock = new RwaHealthOverlayRegistryMock();
        bytes32 key = keccak256(abi.encode("boundary-version", generation));
        IStockTokenRegistryV2.AssetVersion memory version = IStockTokenRegistryV2.AssetVersion({
            chainId: CHAIN_ID,
            tickerHash: keccak256(abi.encode("BOUNDARY", generation)),
            token: address(token),
            robinhoodAssetIdHash: keccak256(abi.encode("boundary-provider", generation)),
            ticker: "BOUNDARY",
            name: "Boundary Version",
            tokenDecimals: 18,
            active: true,
            registeredAt: uint64(block.timestamp),
            activatedAt: uint64(block.timestamp),
            deactivatedAt: 0
        });
        mock.configure(key, version, generation);
        checked = new RwaHealthOverlay(address(safe), IStockTokenRegistryV2(address(mock)));
        value = _validClearance();
        value.assetVersionKey = key;
        value.activationGeneration = generation;
        value.expectedOverlayGeneration = 1;
    }

    function _expectedPayloadHash(
        uint256 chainId,
        address registryAddress,
        address overlayAddress,
        IRwaHealthOverlay.Clearance memory value
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("OMERTA_RWA_HEALTH_CLEARANCE_PAYLOAD_V2"),
                chainId,
                registryAddress,
                overlayAddress,
                value.catalogSnapshotHash,
                value.assetVersionKey,
                value.activationGeneration,
                value.episodeId,
                value.episodeGeneration,
                value.currentSeverity,
                value.stateSequence,
                value.latestEpisodeEventId,
                value.latestMaterialEvidenceHash,
                value.recoveryEvidenceHash,
                value.freshHealthyEvaluationId,
                value.freshHealthyEvidenceHash,
                value.reviewerIdHash,
                value.approvedAt,
                value.clearanceDeadline,
                value.expectedOverlayGeneration
            )
        );
    }

    function _expectedCallIntentHash(
        uint256 chainId,
        address safeAddress,
        address overlayAddress,
        IRwaHealthOverlay.Clearance memory value
    ) private pure returns (bytes32) {
        bytes memory data = abi.encodeWithSelector(IRwaHealthOverlay.recordClearance.selector, value);
        return keccak256(
            abi.encode(
                keccak256("OMERTA_RWA_HEALTH_SAFE_CALL_INTENT_V2"),
                chainId,
                safeAddress,
                overlayAddress,
                uint256(0),
                uint8(0),
                IRwaHealthOverlay.recordClearance.selector,
                keccak256(data)
            )
        );
    }

    function _expectedClearanceId(
        uint256 chainId,
        address registryAddress,
        IRwaHealthOverlay.Clearance memory value,
        bytes32 callIntentHash
    ) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                keccak256("OMERTA_RWA_HEALTH_CLEARANCE_ATTESTATION_V2"),
                chainId,
                registryAddress,
                value.catalogSnapshotHash,
                value.assetVersionKey,
                value.activationGeneration,
                value.episodeId,
                value.episodeGeneration,
                value.currentSeverity,
                value.stateSequence,
                value.latestEpisodeEventId,
                value.latestMaterialEvidenceHash,
                value.recoveryEvidenceHash,
                value.freshHealthyEvaluationId,
                value.freshHealthyEvidenceHash,
                value.reviewerIdHash,
                value.approvedAt,
                value.clearanceDeadline,
                value.expectedOverlayGeneration,
                callIntentHash
            )
        );
    }
}

contract RwaHealthOverlayVectorRegistry {
    function supportedChainId() external pure returns (uint256) {
        return 4663;
    }
}

contract RwaHealthOverlayCrossLanguageVectorTest is RwaHealthOverlayTestBase {
    address private constant VECTOR_SAFE = 0x1111111111111111111111111111111111111111;
    address private constant VECTOR_REGISTRY = 0x2222222222222222222222222222222222222222;
    address private constant VECTOR_OVERLAY = 0x3333333333333333333333333333333333333333;

    function test_frozenJavascriptSolidityVector() external {
        RwaHealthOverlayVectorRegistry stub = new RwaHealthOverlayVectorRegistry();
        vm.etch(VECTOR_SAFE, hex"00");
        vm.etch(VECTOR_REGISTRY, address(stub).code);
        RwaHealthOverlay implementation = new RwaHealthOverlay(VECTOR_SAFE, IStockTokenRegistryV2(VECTOR_REGISTRY));
        vm.etch(VECTOR_OVERLAY, address(implementation).code);
        RwaHealthOverlay vectorOverlay = RwaHealthOverlay(VECTOR_OVERLAY);

        IRwaHealthOverlay.Clearance memory value = IRwaHealthOverlay.Clearance({
            catalogSnapshotHash: 0x4444444444444444444444444444444444444444444444444444444444444444,
            assetVersionKey: 0x5555555555555555555555555555555555555555555555555555555555555555,
            activationGeneration: 7,
            episodeId: 0x6666666666666666666666666666666666666666666666666666666666666666,
            episodeGeneration: 3,
            currentSeverity: 2,
            stateSequence: 42,
            latestEpisodeEventId: 0x7777777777777777777777777777777777777777777777777777777777777777,
            latestMaterialEvidenceHash: 0x8888888888888888888888888888888888888888888888888888888888888888,
            recoveryEvidenceHash: 0x05ce08662bf79204955f0d2e7a8319fba7dd0fffaa882ca5f617bdb6000f1637,
            freshHealthyEvaluationId: 0x9999999999999999999999999999999999999999999999999999999999999999,
            freshHealthyEvidenceHash: 0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa,
            reviewerIdHash: 0x315f2799b390280582dd955e8507634e70dd1b7c6a94845978bd6e294d7bb38f,
            approvedAt: 1_893_456_000,
            clearanceDeadline: 1_894_060_800,
            expectedOverlayGeneration: 4
        });

        bytes memory data = abi.encodeWithSelector(IRwaHealthOverlay.recordClearance.selector, value);
        assertEq(bytes32(IRwaHealthOverlay.recordClearance.selector), bytes32(bytes4(0x95af85ca)));
        assertEq(
            keccak256(
                "ClearanceApplied(bytes32,bytes32,uint256,address,uint256,bytes32,bytes32,uint256,uint8,uint64,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,bytes32,uint64,uint64)"
            ),
            0xda9118bfbb750eb109fbcd8e639664c2c42b9669b49381d6a4f40bc09a696db7
        );
        assertEq(keccak256(data), 0x0c1b5a46bf4917c77d6279948be5ecdc3c4aebb70f356cc65e0ad3e0104c0b05);
        assertEq(
            vectorOverlay.clearancePayloadHash(value),
            0xdfcc82ff057e14d16214511afe37aa044a72eaeb58f40315e25cfe604001b076
        );
        assertEq(
            vectorOverlay.safeCallIntentHash(value), 0xf02634af9d67a948be4a64982c55e4652ae81494c5fef4eeaf752d94a050b8d5
        );
        assertEq(vectorOverlay.clearanceId(value), 0x16cc772c9fbc9bf41aa205022069e76fb6cbae36665a71436a46acf7c0378583);
        assertEq(
            keccak256(abi.encode(keccak256("OMERTA_RWA_HEALTH_REVIEWER_V2"), keccak256("reviewer-main"))),
            value.reviewerIdHash
        );
        assertEq(keccak256("rwa recovered: provider and reserve checks passed"), value.recoveryEvidenceHash);
    }
}
