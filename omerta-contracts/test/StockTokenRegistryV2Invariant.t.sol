// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {StockTokenRegistryV2} from "../src/StockTokenRegistryV2.sol";
import {IStockTokenRegistryV2} from "../src/interfaces/IStockTokenRegistryV2.sol";

contract InvariantStockToken is ERC20 {
    constructor() ERC20("Invariant Stock Token", "IST") {}
}

contract StockTokenRegistryV2Handler is Test {
    uint64 internal constant TTL = 7 days;
    bytes32 internal constant EVIDENCE = keccak256("invariant-evidence");
    bytes32 internal constant REVIEW = keccak256("invariant-review");

    StockTokenRegistryV2 public immutable registry;
    address public immutable safe;
    address public immutable publisher;
    address[6] public tokens;

    uint256 public expectedCatalogVersion;
    uint256 public successfulActivations;
    uint256 public successfulDeactivations;
    uint256 public revertedCalls;
    uint256 public publishedDay;
    bool public hasPublishedBallot;

    bytes32[] private _observedKeys;
    mapping(bytes32 => bool) private _observed;
    mapping(bytes32 => bytes32) public immutableDigest;
    IStockTokenRegistryV2.Ballot private _ballotSnapshot;

    constructor(StockTokenRegistryV2 registry_, address safe_, address publisher_) {
        registry = registry_;
        safe = safe_;
        publisher = publisher_;
        for (uint256 i; i < tokens.length; ++i) {
            tokens[i] = address(new InvariantStockToken());
        }
    }

    function activate(uint256 tokenSeed, uint256 tickerSeed, uint256 providerSeed, bool corruptTtl) external {
        uint256 identitySlot = (tokenSeed ^ tickerSeed ^ providerSeed) % tokens.length;
        uint256 tokenIndex = identitySlot == 2 ? 0 : identitySlot;
        uint256 tickerIndex = identitySlot == 3 ? 1 : identitySlot;
        uint256 providerIndex = identitySlot == 4 ? 0 : identitySlot;
        IStockTokenRegistryV2.Activation memory request = IStockTokenRegistryV2.Activation({
            token: tokens[tokenIndex],
            robinhoodAssetIdHash: keccak256(abi.encode("provider", providerIndex)),
            ticker: _ticker(tickerIndex),
            name: _name(tokenIndex, tickerIndex, providerIndex),
            tokenDecimals: 18,
            evidenceHash: EVIDENCE,
            reviewId: REVIEW,
            approvedAt: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + TTL + (corruptTtl ? 1 : 0))
        });
        uint256 catalogBefore = registry.catalogVersion();
        vm.prank(safe);
        try registry.activateVersion(request) returns (bytes32 key) {
            ++successfulActivations;
            ++expectedCatalogVersion;
            assertEq(registry.catalogVersion(), catalogBefore + 1);
            _remember(key);
        } catch {
            ++revertedCalls;
            assertEq(registry.catalogVersion(), catalogBefore);
        }
        _assertState();
    }

    function reactivate(uint256 keySeed, bool corruptName) external {
        if (_observedKeys.length == 0) return;
        bytes32 key = _observedKeys[keySeed % _observedKeys.length];
        IStockTokenRegistryV2.AssetVersion memory version = registry.getVersion(key);
        IStockTokenRegistryV2.Activation memory request = IStockTokenRegistryV2.Activation({
            token: version.token,
            robinhoodAssetIdHash: version.robinhoodAssetIdHash,
            ticker: version.ticker,
            name: corruptName ? string.concat(version.name, " drift") : version.name,
            tokenDecimals: version.tokenDecimals,
            evidenceHash: EVIDENCE,
            reviewId: REVIEW,
            approvedAt: uint64(block.timestamp),
            validUntil: uint64(block.timestamp + TTL)
        });
        uint256 catalogBefore = registry.catalogVersion();
        vm.prank(safe);
        try registry.activateVersion(request) returns (bytes32 returnedKey) {
            assertEq(returnedKey, key);
            ++successfulActivations;
            ++expectedCatalogVersion;
            assertEq(registry.catalogVersion(), catalogBefore + 1);
        } catch {
            ++revertedCalls;
            assertEq(registry.catalogVersion(), catalogBefore);
        }
        _assertState();
    }

    function deactivate(uint256 keySeed, bool zeroReason) external {
        if (_observedKeys.length == 0) return;
        bytes32 key = _observedKeys[keySeed % _observedKeys.length];
        bool wasActive = registry.getVersion(key).active;
        uint256 catalogBefore = registry.catalogVersion();
        vm.prank(safe);
        try registry.deactivateVersion(key, zeroReason ? bytes32(0) : keccak256(abi.encode("reason", keySeed))) {
            if (wasActive) {
                ++successfulDeactivations;
                ++expectedCatalogVersion;
                assertEq(registry.catalogVersion(), catalogBefore + 1);
            } else {
                assertEq(registry.catalogVersion(), catalogBefore);
            }
        } catch {
            ++revertedCalls;
            assertEq(registry.catalogVersion(), catalogBefore);
        }
        _assertState();
    }

    function publish(uint256 keySeed) external {
        if (_observedKeys.length == 0 || hasPublishedBallot) return;
        bytes32 key = _observedKeys[keySeed % _observedKeys.length];
        if (!registry.getVersion(key).active) return;
        uint256 day = block.timestamp / 1 days - 1;
        uint256 currentCatalogVersion = registry.catalogVersion();
        vm.prank(publisher);
        try registry.publishBallot(
            day, key, keccak256("invariant-tally"), currentCatalogVersion, 2 ether, uint64(block.timestamp + 3 days)
        ) {
            publishedDay = day;
            hasPublishedBallot = true;
            _ballotSnapshot = registry.getBallot(day);
        } catch {
            ++revertedCalls;
        }
        _assertState();
    }

    function assertState() external view {
        _assertState();
    }

    function observedKeyCount() external view returns (uint256) {
        return _observedKeys.length;
    }

    function observedKeyAt(uint256 index) external view returns (bytes32) {
        return _observedKeys[index];
    }

    function ballotSnapshot() external view returns (IStockTokenRegistryV2.Ballot memory) {
        return _ballotSnapshot;
    }

    function _remember(bytes32 key) private {
        if (_observed[key]) return;
        _observed[key] = true;
        _observedKeys.push(key);
        IStockTokenRegistryV2.AssetVersion memory version = registry.getVersion(key);
        immutableDigest[key] = _immutableDigest(version);
    }

    function _assertState() private view {
        assertEq(registry.catalogVersion(), expectedCatalogVersion);
        assertEq(registry.versionCount(), _observedKeys.length);
        for (uint256 i; i < _observedKeys.length; ++i) {
            bytes32 key = _observedKeys[i];
            assertEq(registry.versionKeyAt(i), key);
            IStockTokenRegistryV2.AssetVersion memory version = registry.getVersion(key);
            assertEq(_immutableDigest(version), immutableDigest[key]);

            bytes32 tickerHead = registry.activeVersionForTickerHash(version.tickerHash);
            bytes32 tokenHead = registry.activeVersionForToken(version.token);
            bytes32 providerHead = registry.activeVersionForProviderIdHash(version.robinhoodAssetIdHash);
            if (version.active) {
                assertEq(tickerHead, key);
                assertEq(tokenHead, key);
                assertEq(providerHead, key);
            }
            _assertHead(tickerHead, 0, version.tickerHash, address(0));
            _assertHead(tokenHead, 1, bytes32(0), version.token);
            _assertHead(providerHead, 2, version.robinhoodAssetIdHash, address(0));
        }

        if (hasPublishedBallot) {
            IStockTokenRegistryV2.Ballot memory current = registry.getBallot(publishedDay);
            assertEq(current.assetVersionKey, _ballotSnapshot.assetVersionKey);
            assertEq(current.token, _ballotSnapshot.token);
            assertEq(current.tokenDecimals, _ballotSnapshot.tokenDecimals);
            assertEq(current.tallyHash, _ballotSnapshot.tallyHash);
            assertEq(current.catalogVersion, _ballotSnapshot.catalogVersion);
            assertEq(current.maxEthWei, _ballotSnapshot.maxEthWei);
            assertEq(current.purchaseUntil, _ballotSnapshot.purchaseUntil);
            assertEq(current.publishedAt, _ballotSnapshot.publishedAt);
        }
    }

    function _assertHead(bytes32 head, uint256 dimension, bytes32 hashValue, address tokenValue) private view {
        if (head == bytes32(0)) return;
        assertTrue(_observed[head]);
        IStockTokenRegistryV2.AssetVersion memory pointed = registry.getVersion(head);
        assertTrue(pointed.active);
        if (dimension == 0) assertEq(pointed.tickerHash, hashValue);
        if (dimension == 1) assertEq(pointed.token, tokenValue);
        if (dimension == 2) assertEq(pointed.robinhoodAssetIdHash, hashValue);
    }

    function _immutableDigest(IStockTokenRegistryV2.AssetVersion memory version) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                version.chainId,
                version.tickerHash,
                version.token,
                version.robinhoodAssetIdHash,
                version.ticker,
                version.name,
                version.tokenDecimals,
                version.registeredAt
            )
        );
    }

    function _ticker(uint256 index) private pure returns (string memory) {
        if (index == 0) return "AAA";
        if (index == 1) return "BBB";
        if (index == 2) return "CCC";
        if (index == 3) return "DDD";
        if (index == 4) return "EEE";
        return "FFF";
    }

    function _name(uint256 tokenIndex, uint256 tickerIndex, uint256 providerIndex)
        private
        pure
        returns (string memory)
    {
        tokenIndex;
        tickerIndex;
        providerIndex;
        return "Invariant Asset";
    }
}

contract StockTokenRegistryV2InvariantTest is StdInvariant, Test {
    StockTokenRegistryV2 internal registry;
    StockTokenRegistryV2Handler internal handler;
    address internal safe = makeAddr("invariant-safe");
    address internal publisher = makeAddr("invariant-publisher");

    function setUp() public {
        vm.warp(100 days);
        registry = new StockTokenRegistryV2(safe, publisher);
        handler = new StockTokenRegistryV2Handler(registry, safe, publisher);

        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.activate.selector;
        selectors[1] = handler.reactivate.selector;
        selectors[2] = handler.deactivate.selector;
        selectors[3] = handler.publish.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_reverseHeadsHistoryCatalogAndBallotsRemainHonest() public view {
        handler.assertState();
    }
}
