// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {StockTokenRegistryV2} from "../src/StockTokenRegistryV2.sol";
import {IStockTokenRegistryV2} from "../src/interfaces/IStockTokenRegistryV2.sol";

contract RegistryStockToken is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}
}

contract StockTokenRegistryV2Test is Test {
    uint256 internal constant CHAIN_ID = 4663;
    uint64 internal constant TTL = 7 days;
    bytes32 internal constant AAPL_PROVIDER = keccak256("rhj-asset-aapl");
    bytes32 internal constant TSLA_PROVIDER = keccak256("rhj-asset-tsla");
    bytes32 internal constant EVIDENCE = keccak256("public-evidence-cid");
    bytes32 internal constant REVIEW_ID = keccak256("review-42");
    bytes32 internal constant TALLY = keccak256("closed-public-tally");
    bytes32 internal constant REASON = keccak256("provider-rotation");
    uint256 internal constant MAX_ETH_WEI = 3 ether;

    address internal safe = makeAddr("safe");
    address internal publisher = makeAddr("publisher");
    address internal stranger = makeAddr("stranger");

    StockTokenRegistryV2 internal registry;
    RegistryStockToken internal apple;
    RegistryStockToken internal tesla;

    function setUp() public {
        vm.warp(30 days + 12 hours);
        registry = new StockTokenRegistryV2(safe, publisher);
        apple = new RegistryStockToken("Apple Stock Token", "AAPL");
        tesla = new RegistryStockToken("Tesla Stock Token", "TSLA");
    }

    // Mutation caught: constructor drops or misroutes one immutable authority/config value.
    function test_constructorPinsChainOwnerPublisherAndEmptyCatalog() public view {
        assertEq(registry.supportedChainId(), CHAIN_ID);
        assertEq(registry.owner(), safe);
        assertEq(registry.publisher(), publisher);
        assertEq(registry.versionCount(), 0);
        assertEq(registry.catalogVersion(), 0);
    }

    // Mutation caught: key omits/reorders a dimension or hashes unnormalized identity differently.
    function test_assetVersionKeyBindsChainTickerTokenAndProvider() public view {
        bytes32 expected =
            keccak256(abi.encode(uint256(4663), keccak256(bytes("AAPL")), address(apple), bytes32(AAPL_PROVIDER)));
        bytes32 actual = registry.assetVersionKey("AAPL", address(apple), AAPL_PROVIDER);
        assertEq(actual, expected);
        assertNotEq(actual, registry.assetVersionKey("TSLA", address(apple), AAPL_PROVIDER));
        assertNotEq(actual, registry.assetVersionKey("AAPL", address(tesla), AAPL_PROVIDER));
        assertNotEq(actual, registry.assetVersionKey("AAPL", address(apple), TSLA_PROVIDER));
    }

    // Mutation caught: ticker validation accepts text that is not normalized [A-Z0-9._-]{1,24}.
    function test_rejectsMalformedTickers() public {
        string[6] memory invalid = [string("aapl"), " AAPL", unicode"AÄPL", "", "ABCDEFGHIJKLMNOPQRSTUVWXY", "AAP/L"];
        for (uint256 i; i < invalid.length; ++i) {
            IStockTokenRegistryV2.Activation memory request =
                _activation(address(apple), AAPL_PROVIDER, invalid[i], "Apple");
            vm.expectRevert(IStockTokenRegistryV2.InvalidTicker.selector);
            vm.prank(safe);
            registry.activateVersion(request);
        }
    }

    // Mutation caught: required identity/provenance fields or ERC-20 metadata checks are skipped.
    function test_rejectsInvalidIdentityEvidenceNameAndDecimals() public {
        IStockTokenRegistryV2.Activation memory request = _activation(address(0), AAPL_PROVIDER, "AAPL", "Apple");
        _expectActivationError(request, IStockTokenRegistryV2.ZeroAddress.selector);

        request = _activation(stranger, AAPL_PROVIDER, "AAPL", "Apple");
        vm.expectRevert(abi.encodeWithSelector(IStockTokenRegistryV2.ContractRequired.selector, stranger));
        vm.prank(safe);
        registry.activateVersion(request);

        request = _activation(address(apple), bytes32(0), "AAPL", "Apple");
        _expectActivationError(request, IStockTokenRegistryV2.EmptyProviderId.selector);

        request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        request.evidenceHash = bytes32(0);
        _expectActivationError(request, IStockTokenRegistryV2.EmptyEvidence.selector);

        request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        request.reviewId = bytes32(0);
        _expectActivationError(request, IStockTokenRegistryV2.EmptyReviewId.selector);

        request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "");
        _expectActivationError(request, IStockTokenRegistryV2.EmptyName.selector);

        request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        request.tokenDecimals = 6;
        vm.expectRevert(abi.encodeWithSelector(IStockTokenRegistryV2.DecimalsMismatch.selector, uint8(18), uint8(6)));
        vm.prank(safe);
        registry.activateVersion(request);
    }

    // Mutation caught: activation TTL is not exactly seven days or temporal inclusion is not [approvedAt, validUntil).
    function test_activationUsesExactSevenDayTtlAndStrictExpiryBoundary() public {
        IStockTokenRegistryV2.Activation memory request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        request.validUntil += 1;
        _expectActivationError(request, IStockTokenRegistryV2.InvalidActivationTtl.selector);

        request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        request.approvedAt = uint64(block.timestamp + 1);
        request.validUntil = request.approvedAt + TTL;
        _expectActivationError(request, IStockTokenRegistryV2.ApprovalNotYetValid.selector);

        request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        vm.warp(request.validUntil - 1);
        vm.prank(safe);
        registry.activateVersion(request);

        IStockTokenRegistryV2.Activation memory stale = _activation(address(tesla), TSLA_PROVIDER, "TSLA", "Tesla");
        vm.warp(stale.validUntil);
        _expectActivationError(stale, IStockTokenRegistryV2.ApprovalStale.selector);
    }

    // Mutation caught: first activation fails to register immutable enumerable history or increments twice.
    function test_firstActivationRegistersOneImmutableEnumerableVersion() public {
        IStockTokenRegistryV2.Activation memory request =
            _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple Inc.");
        bytes32 expected =
            keccak256(abi.encode(uint256(4663), keccak256(bytes("AAPL")), address(apple), bytes32(AAPL_PROVIDER)));

        vm.prank(safe);
        bytes32 key = registry.activateVersion(request);

        assertEq(key, expected);
        assertEq(registry.versionCount(), 1);
        assertEq(registry.versionKeyAt(0), expected);
        assertEq(registry.catalogVersion(), 1);
        IStockTokenRegistryV2.AssetVersion memory version = registry.getVersion(key);
        assertEq(version.chainId, 4663);
        assertEq(version.tickerHash, keccak256(bytes("AAPL")));
        assertEq(version.token, address(apple));
        assertEq(version.robinhoodAssetIdHash, AAPL_PROVIDER);
        assertEq(version.ticker, "AAPL");
        assertEq(version.name, "Apple Inc.");
        assertEq(version.tokenDecimals, 18);
        assertTrue(version.active);
        assertEq(version.registeredAt, block.timestamp);
        assertEq(version.activatedAt, block.timestamp);
        assertEq(version.deactivatedAt, 0);
    }

    // Mutation caught: reactivation appends a duplicate key or permits immutable metadata drift.
    function test_reactivationReusesHistoryAndRejectsImmutableFieldChanges() public {
        IStockTokenRegistryV2.Activation memory request =
            _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple Inc.");
        bytes32 key = _activate(request);
        _deactivate(key, REASON);
        uint64 registeredAt = registry.getVersion(key).registeredAt;

        request = _fresh(request);
        vm.prank(safe);
        bytes32 reactivated = registry.activateVersion(request);
        assertEq(reactivated, key);
        assertEq(registry.versionCount(), 1);
        assertEq(registry.getVersion(key).registeredAt, registeredAt);
        assertEq(registry.catalogVersion(), 3);

        _deactivate(key, REASON);
        request = _fresh(request);
        request.name = "Apple Incorporated";
        _expectActivationError(request, IStockTokenRegistryV2.ImmutableVersionMismatch.selector);

        request = _fresh(request);
        request.tokenDecimals = 17;
        _expectActivationError(request, IStockTokenRegistryV2.ImmutableVersionMismatch.selector);
    }

    // Mutation caught: changed identity overwrites the old record rather than creating a distinct key.
    function test_changedIdentityCreatesNewHistoryInsteadOfOverwrite() public {
        bytes32 first = _activate(_activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple"));
        bytes32 second = _activate(_activation(address(tesla), TSLA_PROVIDER, "TSLA", "Tesla"));

        assertNotEq(first, second);
        assertEq(registry.versionCount(), 2);
        assertEq(registry.versionKeyAt(0), first);
        assertEq(registry.versionKeyAt(1), second);
        assertEq(registry.getVersion(first).token, address(apple));
        assertEq(registry.getVersion(second).token, address(tesla));
    }

    // Mutation caught: conflict replacement handles only one reverse dimension or increments per conflict.
    function test_activationAtomicallyDeactivatesDistinctTickerTokenAndProviderConflicts() public {
        RegistryStockToken third = new RegistryStockToken("Third Stock", "THIRD");
        RegistryStockToken targetToken = new RegistryStockToken("Target Stock", "TARGET");
        bytes32 thirdProvider = keccak256("rhj-third");

        bytes32 tickerConflict = _activate(_activation(address(apple), AAPL_PROVIDER, "AAPL", "Ticker old"));
        bytes32 tokenConflict = _activate(_activation(address(targetToken), TSLA_PROVIDER, "TSLA", "Token old"));
        bytes32 providerConflict = _activate(_activation(address(third), thirdProvider, "THIRD", "Provider old"));
        uint256 beforeVersion = registry.catalogVersion();

        IStockTokenRegistryV2.Activation memory target =
            _activation(address(targetToken), thirdProvider, "AAPL", "Target");
        bytes32 targetKey = _activate(target);

        assertEq(registry.catalogVersion(), beforeVersion + 1);
        assertFalse(registry.getVersion(tickerConflict).active);
        assertFalse(registry.getVersion(tokenConflict).active);
        assertFalse(registry.getVersion(providerConflict).active);
        assertTrue(registry.getVersion(targetKey).active);
        assertEq(registry.activeVersionForTickerHash(keccak256(bytes("AAPL"))), targetKey);
        assertEq(registry.activeVersionForToken(address(targetToken)), targetKey);
        assertEq(registry.activeVersionForProviderIdHash(thirdProvider), targetKey);
        assertEq(registry.versionCount(), 4);
    }

    // Mutation caught: deactivation deletes history, leaves a reverse head, accepts zero reason, or bumps on no-op.
    function test_deactivationRequiresReasonClearsHeadsAndPreservesHistory() public {
        bytes32 key = _activate(_activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple"));
        vm.expectRevert(IStockTokenRegistryV2.EmptyDeactivationReason.selector);
        vm.prank(safe);
        registry.deactivateVersion(key, bytes32(0));

        _deactivate(key, REASON);
        assertEq(registry.catalogVersion(), 2);
        assertEq(registry.activeVersionForTickerHash(keccak256(bytes("AAPL"))), bytes32(0));
        assertEq(registry.activeVersionForToken(address(apple)), bytes32(0));
        assertEq(registry.activeVersionForProviderIdHash(AAPL_PROVIDER), bytes32(0));
        assertEq(registry.versionCount(), 1);
        IStockTokenRegistryV2.AssetVersion memory historical = registry.getVersion(key);
        assertEq(historical.token, address(apple));
        assertFalse(historical.active);
        assertEq(historical.deactivatedAt, block.timestamp);

        vm.prank(safe);
        registry.deactivateVersion(key, keccak256("second-no-op"));
        assertEq(registry.catalogVersion(), 2);
    }

    // Mutation caught: owner/publisher boundaries permit an unauthorized mutation.
    function test_authorizationBoundaries() public {
        IStockTokenRegistryV2.Activation memory request = _activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple");
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.activateVersion(request);

        bytes32 key = _activate(request);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.deactivateVersion(key, REASON);

        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.setPublisher(stranger);

        uint256 currentCatalogVersion = registry.catalogVersion();
        vm.expectRevert(IStockTokenRegistryV2.NotPublisher.selector);
        vm.prank(stranger);
        registry.publishBallot(
            block.timestamp / 1 days - 1,
            key,
            TALLY,
            currentCatalogVersion,
            MAX_ETH_WEI,
            uint64(block.timestamp + 2 days)
        );
    }

    // Mutation caught: publication accepts current/future days, replay, inactive keys, or absent catalog entries.
    function test_publisherCanPublishOnlyPriorDayOnceAndOnlyActiveVersion() public {
        bytes32 key = _activate(_activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple"));
        uint256 today = block.timestamp / 1 days;
        uint256 currentCatalogVersion = registry.catalogVersion();

        vm.expectRevert(IStockTokenRegistryV2.DayNotClosed.selector);
        vm.prank(publisher);
        registry.publishBallot(today, key, TALLY, currentCatalogVersion, MAX_ETH_WEI, uint64(block.timestamp + 2 days));

        vm.expectRevert(IStockTokenRegistryV2.VersionNotActive.selector);
        vm.prank(publisher);
        registry.publishBallot(
            today - 1,
            bytes32(uint256(123)),
            TALLY,
            currentCatalogVersion,
            MAX_ETH_WEI,
            uint64(block.timestamp + 2 days)
        );

        vm.expectRevert(IStockTokenRegistryV2.EmptyMaxEthWei.selector);
        vm.prank(publisher);
        registry.publishBallot(today - 1, key, TALLY, currentCatalogVersion, 0, uint64(block.timestamp + 2 days));

        vm.expectRevert(IStockTokenRegistryV2.InvalidPurchaseUntil.selector);
        vm.prank(publisher);
        registry.publishBallot(today - 1, key, TALLY, currentCatalogVersion, MAX_ETH_WEI, uint64(block.timestamp));

        vm.prank(publisher);
        registry.publishBallot(
            today - 1, key, TALLY, currentCatalogVersion, MAX_ETH_WEI, uint64(block.timestamp + 2 days)
        );
        vm.expectRevert(IStockTokenRegistryV2.BallotAlreadyPublished.selector);
        vm.prank(publisher);
        registry.publishBallot(today - 1, key, keccak256("rewrite"), 999, 99 ether, uint64(block.timestamp + 9 days));

        _deactivate(key, REASON);
        currentCatalogVersion = registry.catalogVersion();
        vm.expectRevert(IStockTokenRegistryV2.VersionNotActive.selector);
        vm.prank(publisher);
        registry.publishBallot(
            today - 2, key, TALLY, currentCatalogVersion, MAX_ETH_WEI, uint64(block.timestamp + 2 days)
        );
    }

    // Mutation caught: ballot stores a live pointer or resolve redirects after deactivation/replacement.
    function test_ballotSnapshotsExactVersionAndNeverRedirects() public {
        bytes32 key = _activate(_activation(address(apple), AAPL_PROVIDER, "AAPL", "Apple"));
        uint256 day = block.timestamp / 1 days - 1;
        uint256 snapshotCatalog = 777;
        uint64 purchaseUntil = uint64(block.timestamp + 2 days);
        vm.prank(publisher);
        registry.publishBallot(day, key, TALLY, snapshotCatalog, MAX_ETH_WEI, purchaseUntil);

        IStockTokenRegistryV2.Ballot memory ballot = registry.getBallot(day);
        assertEq(ballot.assetVersionKey, key);
        assertEq(ballot.token, address(apple));
        assertEq(ballot.tokenDecimals, 18);
        assertEq(ballot.tallyHash, TALLY);
        assertEq(ballot.catalogVersion, snapshotCatalog);
        assertEq(ballot.maxEthWei, MAX_ETH_WEI);
        assertEq(ballot.purchaseUntil, purchaseUntil);
        assertEq(ballot.publishedAt, block.timestamp);

        _deactivate(key, REASON);
        _activate(_fresh(_activation(address(tesla), AAPL_PROVIDER, "AAPL", "Replacement")));

        (
            bytes32 resolvedKey,
            address token,
            uint8 decimals_,
            bytes32 tally,
            uint256 catalog,
            uint256 resolvedMaxEthWei,
            uint64 resolvedPurchaseUntil,
            bool active
        ) = registry.resolveBallot(day);
        assertEq(resolvedKey, key);
        assertEq(token, address(apple));
        assertEq(decimals_, 18);
        assertEq(tally, TALLY);
        assertEq(catalog, snapshotCatalog);
        assertEq(resolvedMaxEthWei, MAX_ETH_WEI);
        assertEq(resolvedPurchaseUntil, purchaseUntil);
        assertFalse(active);

        ballot = registry.getBallot(day);
        assertEq(ballot.assetVersionKey, key);
        assertEq(ballot.token, address(apple));
        assertEq(ballot.tokenDecimals, 18);
        assertEq(ballot.tallyHash, TALLY);
        assertEq(ballot.catalogVersion, snapshotCatalog);
        assertEq(ballot.maxEthWei, MAX_ETH_WEI);
        assertEq(ballot.purchaseUntil, purchaseUntil);
    }

    // Mutation caught: an empty catalog resolves/publishes a phantom candidate instead of failing closed.
    function test_emptyCatalogIsRepresentableAndCannotPublishBallot() public {
        assertEq(registry.versionCount(), 0);
        assertEq(registry.catalogVersion(), 0);
        assertEq(registry.activeVersionForTickerHash(keccak256("AAPL")), bytes32(0));
        vm.expectRevert(IStockTokenRegistryV2.VersionNotActive.selector);
        vm.prank(publisher);
        registry.publishBallot(
            block.timestamp / 1 days - 1, bytes32(uint256(1)), TALLY, 0, MAX_ETH_WEI, uint64(block.timestamp + 2 days)
        );
        vm.expectRevert(IStockTokenRegistryV2.BallotNotFound.selector);
        registry.resolveBallot(block.timestamp / 1 days - 1);
    }

    // Mutation caught: ownership becomes one-step or zero publisher still has publication authority.
    function test_twoStepOwnershipAndZeroPublisherDisablePublication() public {
        address nextSafe = makeAddr("nextSafe");
        vm.prank(safe);
        registry.transferOwnership(nextSafe);
        assertEq(registry.owner(), safe);
        assertEq(registry.pendingOwner(), nextSafe);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, stranger));
        vm.prank(stranger);
        registry.acceptOwnership();
        vm.prank(nextSafe);
        registry.acceptOwnership();
        assertEq(registry.owner(), nextSafe);

        vm.prank(nextSafe);
        registry.setPublisher(address(0));
        assertEq(registry.publisher(), address(0));
        vm.expectRevert(IStockTokenRegistryV2.NotPublisher.selector);
        vm.prank(publisher);
        registry.publishBallot(
            block.timestamp / 1 days - 1, bytes32(uint256(1)), TALLY, 0, MAX_ETH_WEI, uint64(block.timestamp + 2 days)
        );
    }

    function _activation(address token, bytes32 providerId, string memory ticker, string memory name)
        internal
        view
        returns (IStockTokenRegistryV2.Activation memory request)
    {
        uint64 approvedAt = uint64(block.timestamp);
        request = IStockTokenRegistryV2.Activation({
            token: token,
            robinhoodAssetIdHash: providerId,
            ticker: ticker,
            name: name,
            tokenDecimals: 18,
            evidenceHash: EVIDENCE,
            reviewId: REVIEW_ID,
            approvedAt: approvedAt,
            validUntil: approvedAt + TTL
        });
    }

    function _fresh(IStockTokenRegistryV2.Activation memory request)
        internal
        view
        returns (IStockTokenRegistryV2.Activation memory)
    {
        request.approvedAt = uint64(block.timestamp);
        request.validUntil = request.approvedAt + TTL;
        return request;
    }

    function _activate(IStockTokenRegistryV2.Activation memory request) internal returns (bytes32 key) {
        vm.prank(safe);
        key = registry.activateVersion(request);
    }

    function _deactivate(bytes32 key, bytes32 reason) internal {
        vm.prank(safe);
        registry.deactivateVersion(key, reason);
    }

    function _expectActivationError(IStockTokenRegistryV2.Activation memory request, bytes4 selector) internal {
        vm.expectRevert(selector);
        vm.prank(safe);
        registry.activateVersion(request);
    }
}
