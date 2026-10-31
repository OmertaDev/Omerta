// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaSwapRouterV2} from "../../src/market-v2/OmertaSwapRouterV2.sol";
import {OmertaWbtcConverterV2} from "../../src/market-v2/OmertaWbtcConverterV2.sol";
import {OmertaWbtcRewardsV2, IWbtcRewardsConverterV2} from "../../src/market-v2/OmertaWbtcRewardsV2.sol";

contract RewardsTokenFixtureV2 is ERC20 {
    uint8 private immutable _decimals;
    uint8 public mode; // 1=no receipt, 2=one-unit transfer fee, 3=blacklist, 4=false return
    address public callback;
    bytes public callbackData;
    bool public callbackAccepted;
    bytes4 public callbackFailure;
    constructor(uint8 value) ERC20("Synthetic reward asset", "TEST") { _decimals = value; }
    function decimals() public view override returns (uint8) { return _decimals; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function burn(address from, uint256 amount) external { _burn(from, amount); }
    function setMode(uint8 value) external { mode = value; }
    function setCallback(address target, bytes calldata data) external { callback = target; callbackData = data; }
    function transfer(address to, uint256 amount) public override returns (bool) {
        if (mode == 4) return false;
        _deliver(msg.sender, to, amount);
        return true;
    }
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (mode == 4) return false;
        _spendAllowance(from, msg.sender, amount);
        _deliver(from, to, amount);
        return true;
    }
    function _deliver(address from, address to, uint256 amount) private {
        require(mode != 3, "blacklisted");
        if (callback != address(0)) {
            (bool ok, bytes memory reason) = callback.call(callbackData);
            callbackAccepted = ok;
            if (reason.length >= 4) {
                bytes4 selector;
                assembly ("memory-safe") { selector := mload(add(reason, 32)) }
                callbackFailure = selector;
            }
        }
        if (mode == 1) return;
        if (mode == 2 && amount != 0) { _burn(from, 1); _transfer(from, to, amount - 1); }
        else _transfer(from, to, amount);
    }
}

contract RewardsConverterFixtureV2 {
    address public authorizedVault;
    IERC20Metadata public wbtc;
    uint256 public output = 100_000;
    uint8 public mode; // 1=no delivery, 2=wrong report, 3=short delivery, 4=revert, 5=refund
    constructor(IERC20Metadata token) { wbtc = token; }
    function configure(address vault, IERC20Metadata token) external { authorizedVault = vault; wbtc = token; }
    function setMode(uint8 value) external { mode = value; }
    function setOutput(uint256 value) external { output = value; }
    function convertNativeToWbtc(uint256, uint64) external payable returns (uint256) {
        require(msg.sender == authorizedVault, "only vault");
        require(mode != 4, "adapter failed");
        uint256 sent = mode == 1 ? 0 : mode == 3 ? output - 1 : output;
        if (sent != 0) require(wbtc.transfer(msg.sender, sent));
        if (mode == 5) { (bool ok,) = msg.sender.call{value: 1}(""); require(ok); }
        return mode == 2 ? output + 1 : output;
    }
}

contract RewardsRouterFixtureV2 {
    IERC20 public immutable omr;
    uint256 public output = 1 ether;
    uint8 public mode; // 1=partial, 2=wrong OMR delta, 3=no ETH receipt, 4=wrong ETH delta
    bytes32 public lastPoolHash;
    int256 public lastSpecified;
    uint160 public lastLimit;
    uint256 public lastMaximum;
    bool public lastDirection;
    constructor(IERC20 token) { omr = token; }
    function setMode(uint8 value) external { mode = value; }
    function swap(PoolKey memory pool, SwapParams memory params, uint256, uint256 maximum, uint64)
        external payable returns (BalanceDelta)
    {
        lastPoolHash = keccak256(abi.encode(pool));
        lastSpecified = params.amountSpecified; lastDirection = params.zeroForOne;
        lastLimit = params.sqrtPriceLimitX96; lastMaximum = maximum;
        uint256 amount = uint256(-params.amountSpecified);
        uint256 spent = mode == 1 ? amount / 2 : amount;
        require(omr.transferFrom(msg.sender, address(this), spent));
        if (mode != 3) { (bool ok,) = msg.sender.call{value: output}(""); require(ok); }
        return toBalanceDelta(int128(int256(mode == 4 ? output + 1 : output)), -int128(int256(mode == 2 ? amount - 1 : spent)));
    }
    receive() external payable {}
}

contract WbtcRewardsV2Test is Test {
    RewardsTokenFixtureV2 internal wbtc;
    RewardsTokenFixtureV2 internal omr;
    RewardsConverterFixtureV2 internal converter;
    RewardsRouterFixtureV2 internal router;
    OmertaWbtcRewardsV2 internal vault;
    address internal alice = address(0xA1);
    address internal bob = address(0xB1);
    bytes32 internal constant MANIFEST = keccak256("synthetic public eligibility manifest");

    function setUp() public {
        vm.warp(1000);
        vm.deal(address(this), 100 ether);
        wbtc = new RewardsTokenFixtureV2(8); omr = new RewardsTokenFixtureV2(18);
        converter = new RewardsConverterFixtureV2(wbtc); router = new RewardsRouterFixtureV2(omr);
        vault = new OmertaWbtcRewardsV2(_config());
        converter.configure(address(vault), wbtc);
        wbtc.mint(address(this), 1_000_000_000); wbtc.mint(address(converter), 1e20);
        wbtc.approve(address(vault), type(uint256).max); vault.fundRewards(500_000_000);
        omr.mint(address(vault), 100 ether);
        vm.deal(address(vault), 10 ether); vm.deal(address(router), 20 ether);
    }
    function _config() internal view returns (OmertaWbtcRewardsV2.Config memory cfg) {
        cfg.safe = address(this); cfg.wbtc = wbtc; cfg.omr = omr;
        cfg.omrRouter = OmertaSwapRouterV2(payable(address(router)));
        cfg.omrPool = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3000, 60, IHooks(address(0)));
        cfg.converter = IWbtcRewardsConverterV2(address(converter));
        cfg.routerRuntimeHash = address(router).codehash; cfg.converterRuntimeHash = address(converter).codehash;
    }
    function _publish(uint256 id, address account, uint256 amount, uint256 budget) internal {
        bytes32 leaf = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, address(vault), id, account, amount))));
        vault.publishEpoch(id, uint64(id * 100), uint64((id + 1) * 100), leaf, MANIFEST, budget);
    }
    function _claim(address who, uint256 id, uint256 amount) internal {
        vm.prank(who); vault.claim(id, amount, new bytes32[](0));
    }
    function _pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }

    function testConstructorPinsEightConfigFieldsAndEightDecimalAsset() public view {
        assertEq(vault.safe(), address(this)); assertEq(address(vault.wbtc()), address(wbtc));
        assertEq(address(vault.omr()), address(omr)); assertEq(address(vault.omrRouter()), address(router));
        assertEq(address(vault.converter()), address(converter));
        assertEq(vault.routerRuntimeHash(), address(router).codehash);
        assertEq(vault.converterRuntimeHash(), address(converter).codehash);
        assertEq(keccak256(abi.encode(vault.omrPool())), keccak256(abi.encode(_config().omrPool)));
    }
    function testCounterfactualDependenciesDoNotBlockPrefundedClaimsButCannotConvert() public {
        OmertaWbtcRewardsV2.Config memory cfg = _config();
        cfg.omr = IERC20(address(0xC001)); cfg.omrPool.currency1 = Currency.wrap(address(cfg.omr));
        cfg.omrRouter = OmertaSwapRouterV2(payable(address(0xC002))); cfg.routerRuntimeHash = bytes32(uint256(1));
        cfg.converter = IWbtcRewardsConverterV2(address(0xC003)); cfg.converterRuntimeHash = bytes32(uint256(2));
        OmertaWbtcRewardsV2 next = new OmertaWbtcRewardsV2(cfg);
        wbtc.transfer(address(next), 1000);
        next.publishEpoch(1, 100, 200, next.claimLeaf(1, alice, 1000), MANIFEST, 1000);
        vm.prank(alice); next.claim(1, 1000, new bytes32[](0));
        assertEq(wbtc.balanceOf(alice), 1000);
        vm.deal(address(next), 1 ether);
        vm.expectRevert(OmertaWbtcRewardsV2.RuntimeMismatch.selector); next.convertNative(1 ether, 1, 1001);
    }
    function testConstructorRejectsInvalidAssetSafeHashesAndPool() public {
        OmertaWbtcRewardsV2.Config memory cfg = _config();
        cfg.safe = address(0); vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
        cfg = _config(); cfg.wbtc = IERC20Metadata(address(omr)); vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
        cfg = _config(); cfg.wbtc = IERC20Metadata(address(0x123)); vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
        cfg = _config(); cfg.routerRuntimeHash = 0; vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
        cfg = _config(); cfg.converterRuntimeHash = 0; vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
        cfg = _config(); cfg.omrPool.currency0 = Currency.wrap(address(wbtc)); vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
        cfg = _config(); cfg.omrPool.tickSpacing = 0; vm.expectRevert(); new OmertaWbtcRewardsV2(cfg);
    }
    function testFundingAndDirectDonationsIncreaseOnlyUnreservedActualWbtc() public {
        uint256 beforeAvailable = vault.availableRewards();
        vault.fundRewards(1000); wbtc.transfer(address(vault), 2000);
        assertEq(vault.availableRewards(), beforeAvailable + 3000); assertEq(vault.totalReserved(), 0);
    }
    function testFundingRejectsZeroAndNonExactReceiptAtomically() public {
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); vault.fundRewards(0);
        uint256 beforeVault = wbtc.balanceOf(address(vault));
        uint256 beforeDonor = wbtc.balanceOf(address(this));
        for (uint8 mode = 1; mode <= 4; ++mode) {
            wbtc.setMode(mode); vm.expectRevert(); vault.fundRewards(1000);
            assertEq(wbtc.balanceOf(address(vault)), beforeVault); assertEq(wbtc.balanceOf(address(this)), beforeDonor);
        }
    }
    function testOnlyImmutableSafeCanPublishOrConvert() public {
        vm.startPrank(bob);
        vm.expectRevert(OmertaWbtcRewardsV2.OnlySafe.selector); vault.publishEpoch(1, 100, 200, MANIFEST, MANIFEST, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.OnlySafe.selector); vault.convertNative(1, 1, 1001);
        vm.expectRevert(OmertaWbtcRewardsV2.OnlySafe.selector); vault.convertOmr(1, 1, 1, 1001);
        vm.stopPrank();
    }
    function testSequentialCompletedNonoverlappingEpochsReserveActualFunding() public {
        _publish(1, alice, 1000, 1000); _publish(2, bob, 2000, 2000);
        assertEq(vault.lastEpochId(), 2); assertEq(vault.totalReserved(), 3000);
        assertEq(vault.availableRewards(), 500_000_000 - 3000);
        (bytes32 root, bytes32 digest, uint64 start, uint64 end, uint256 budget, uint256 claimed) = vault.epochs(1);
        assertEq(root, vault.claimLeaf(1, alice, 1000)); assertEq(digest, MANIFEST);
        assertEq(start, 100); assertEq(end, 200); assertEq(budget, 1000); assertEq(claimed, 0);
    }
    function testCannotRewriteSkipOverlapOrPublishFutureEmptyPeriod() public {
        _publish(1, alice, 1000, 1000);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); _publish(1, bob, 2000, 2000);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); _publish(3, bob, 2000, 2000);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); vault.publishEpoch(2, 199, 300, MANIFEST, MANIFEST, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); vault.publishEpoch(2, 1000, 1001, MANIFEST, MANIFEST, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); vault.publishEpoch(2, 200, 200, MANIFEST, MANIFEST, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); vault.publishEpoch(2, 200, 300, 0, MANIFEST, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); vault.publishEpoch(2, 200, 300, MANIFEST, 0, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidEpoch.selector); vault.publishEpoch(2, 200, 300, MANIFEST, MANIFEST, 0);
    }
    function testEpochBudgetsCannotReuseReservedWbtc() public {
        _publish(1, alice, 400_000_000, 400_000_000);
        vm.expectRevert(OmertaWbtcRewardsV2.InsufficientRewards.selector); _publish(2, bob, 100_000_001, 100_000_001);
        _claim(alice, 1, 400_000_000);
        assertEq(vault.availableRewards(), 100_000_000, "claiming does not create unallocated funding");
        assertEq(vault.totalReserved(), 0);
    }
    function testClaimsNeverExpireAndCannotReplay() public {
        _publish(1, alice, 1000, 1000); vm.warp(1000 + 100 * 365 days);
        _claim(alice, 1, 1000);
        assertEq(wbtc.balanceOf(alice), 1000); assertTrue(vault.hasClaimed(1, alice)); assertEq(vault.totalReserved(), 0);
        vm.expectRevert(OmertaWbtcRewardsV2.AlreadyClaimed.selector); _claim(alice, 1, 1000);
    }
    function testSortedMerkleProofBindsBeneficiaryAndAmount() public {
        bytes32 a = vault.claimLeaf(1, alice, 1000);
        bytes32 b = vault.claimLeaf(1, bob, 2000);
        vault.publishEpoch(1, 100, 200, _pair(a, b), MANIFEST, 3000);
        bytes32[] memory proof = new bytes32[](1); proof[0] = b;
        vm.prank(bob); vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); vault.claim(1, 1000, proof);
        vm.prank(alice); vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); vault.claim(1, 1001, proof);
        vm.prank(alice); vault.claim(1, 1000, proof); proof[0] = a; vm.prank(bob); vault.claim(1, 2000, proof);
        assertEq(vault.totalReserved(), 0); assertEq(wbtc.balanceOf(bob), 2000);
    }
    function testLeafBindsChainVaultAndEpochDomains() public {
        vm.chainId(4663);
        _publish(1, alice, 1000, 1000); bytes32 root = vault.claimLeaf(1, alice, 1000);
        vm.chainId(4664);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); _claim(alice, 1, 1000); vm.chainId(4663);
        vault.publishEpoch(2, 200, 300, root, MANIFEST, 1000);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); _claim(alice, 2, 1000);
        OmertaWbtcRewardsV2 other = new OmertaWbtcRewardsV2(_config());
        wbtc.transfer(address(other), 1000); other.publishEpoch(1, 100, 200, root, MANIFEST, 1000);
        vm.prank(alice); vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); other.claim(1, 1000, new bytes32[](0));
        _claim(alice, 1, 1000);
    }
    function testActualOfflineBuilderWalletAndBackedGameProofsPayExactClaims() public {
        // Generated by tools/wbtc-reward-epoch.js; retained claim-interop.output.json in this phase.
        vm.chainId(4663); vm.warp(1020);
        address fixedVault = address(0x5151);
        deployCodeTo("OmertaWbtcRewardsV2.sol:OmertaWbtcRewardsV2", abi.encode(_config()), fixedVault);
        OmertaWbtcRewardsV2 vectorVault = OmertaWbtcRewardsV2(payable(fixedVault));
        bytes32 aliceLeaf = 0x73687e1d10dd37f5a96136f46f69dea30dd50433cbf0d75d22bfe13733310c7e;
        bytes32 bobLeaf = 0xf7630fa09f68c4e8e4160e3b025043ed0e47f16587c9ea9df8fd9bd937743f71;
        bytes32 root = 0x02f345c4b323c0fd88494d690a9db4287d9e92aba9df6d8d9fc1dbfa7148987e;
        bytes32 manifest = 0xfbd7be081962a0b217840276d36e8f3de0b1784749b6fa2f6a7b6074a8a59d9c;
        assertEq(vectorVault.claimLeaf(1, alice, 1000), aliceLeaf);
        assertEq(vectorVault.claimLeaf(1, bob, 2000), bobLeaf);
        assertEq(_pair(aliceLeaf, bobLeaf), root);
        wbtc.transfer(fixedVault, 3000); vectorVault.publishEpoch(1, 1000, 1020, root, manifest, 3000);
        bytes32[] memory proof = new bytes32[](1); proof[0] = bobLeaf;
        vm.prank(alice); vectorVault.claim(1, 1000, proof);
        proof[0] = aliceLeaf; vm.prank(bob); vectorVault.claim(1, 2000, proof);
        assertEq(wbtc.balanceOf(alice), 1000); assertEq(wbtc.balanceOf(bob), 2000);
        assertEq(vectorVault.totalReserved(), 0); assertEq(vectorVault.availableRewards(), 0);
    }
    function testRejectsUnknownZeroLongProofAndOverBudgetClaims() public {
        _publish(1, alice, 1000, 999);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); _claim(alice, 1, 1000);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); _claim(alice, 99, 1);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); _claim(alice, 1, 0);
        bytes32[] memory proof = new bytes32[](65);
        vm.prank(alice); vm.expectRevert(OmertaWbtcRewardsV2.InvalidClaim.selector); vault.claim(1, 999, proof);
        assertFalse(vault.hasClaimed(1, alice)); assertEq(vault.totalReserved(), 999);
    }
    function testBlacklistTransferFeeZeroReceiptAndFalseReturnRollBackClaimState() public {
        _publish(1, alice, 1000, 1000); uint256 before = wbtc.balanceOf(address(vault));
        for (uint8 mode = 1; mode <= 4; ++mode) {
            wbtc.setMode(mode); vm.expectRevert(); _claim(alice, 1, 1000);
            assertFalse(vault.hasClaimed(1, alice)); assertEq(vault.totalReserved(), 1000);
            assertEq(wbtc.balanceOf(address(vault)), before); assertEq(wbtc.balanceOf(alice), 0);
        }
        wbtc.setMode(0); _claim(alice, 1, 1000);
    }
    function testReentryDuringTokenTransferCannotClaimTwice() public {
        _publish(1, alice, 1000, 1000);
        wbtc.setCallback(address(vault), abi.encodeCall(vault.claim, (1, 1000, new bytes32[](0))));
        _claim(alice, 1, 1000);
        assertFalse(wbtc.callbackAccepted());
        assertEq(wbtc.callbackFailure(), bytes4(keccak256("ReentrancyGuardReentrantCall()")));
        assertEq(wbtc.balanceOf(alice), 1000); assertEq(vault.totalReserved(), 0);
    }
    function testRuntimeDriftAndLostBackingFailClosed() public {
        _publish(1, alice, 1000, 1000);
        wbtc.burn(address(vault), 500_000_000 - 999);
        vm.expectRevert(OmertaWbtcRewardsV2.InsufficientRewards.selector); _claim(alice, 1, 1000);
        assertFalse(vault.hasClaimed(1, alice));
        vm.etch(address(wbtc), hex"00");
        vm.expectRevert(OmertaWbtcRewardsV2.RuntimeMismatch.selector); vault.availableRewards();
    }
    function testNativeConversionAddsOnlyActualWbtcAndPreservesReservedClaims() public {
        _publish(1, alice, 1000, 1000); uint256 before = wbtc.balanceOf(address(vault));
        assertEq(vault.convertNative(2 ether, 1, 1001), 100_000);
        assertEq(address(vault).balance, 8 ether); assertEq(wbtc.balanceOf(address(vault)), before + 100_000);
        assertEq(vault.totalReserved(), 1000); _claim(alice, 1, 1000);
    }
    function testNativeConversionRejectsBadBudgetMinimumDeadlineAndRuntime() public {
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidConversion.selector); vault.convertNative(0, 1, 1001);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidConversion.selector); vault.convertNative(11 ether, 1, 1001);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidConversion.selector); vault.convertNative(1, 0, 1001);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidDeadline.selector); vault.convertNative(1, 1, 1000);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidDeadline.selector); vault.convertNative(1, 1, 1000 + 1 days + 1);
        vm.etch(address(converter), hex"00");
        vm.expectRevert(OmertaWbtcRewardsV2.RuntimeMismatch.selector); vault.convertNative(1, 1, 1001);
    }
    function testForeignConverterAuthorityOrAssetFailsBeforeSpending() public {
        converter.configure(bob, wbtc);
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidConfiguration.selector); vault.convertNative(1, 1, 1001);
        converter.configure(address(vault), IERC20Metadata(address(omr)));
        vm.expectRevert(OmertaWbtcRewardsV2.InvalidConfiguration.selector); vault.convertNative(1, 1, 1001);
        assertEq(address(vault).balance, 10 ether);
    }
    function testMaliciousConverterReceiptReportRefundAndFailureAreAtomic() public {
        _publish(1, alice, 1000, 1000); uint256 before = wbtc.balanceOf(address(vault));
        for (uint8 mode = 1; mode <= 5; ++mode) {
            converter.setMode(mode); vm.expectRevert(); vault.convertNative(1 ether, 1, 1001);
            assertEq(address(vault).balance, 10 ether); assertEq(wbtc.balanceOf(address(vault)), before);
            assertEq(vault.totalReserved(), 1000); assertFalse(vault.hasClaimed(1, alice));
        }
    }
    function testOmrConversionUsesFixedExactInputPoolAndZeroResidualAllowance() public {
        uint256 before = wbtc.balanceOf(address(vault));
        assertEq(vault.convertOmr(1 ether, 1, 1, 1001), 100_000);
        assertEq(omr.balanceOf(address(vault)), 99 ether); assertEq(omr.balanceOf(address(router)), 1 ether);
        assertEq(omr.allowance(address(vault), address(router)), 0);
        assertEq(address(vault).balance, 10 ether, "old native fees excluded");
        assertEq(wbtc.balanceOf(address(vault)), before + 100_000);
        assertEq(router.lastPoolHash(), keccak256(abi.encode(_config().omrPool)));
        assertEq(router.lastSpecified(), -1 ether); assertFalse(router.lastDirection());
        assertEq(router.lastLimit(), TickMath.MAX_SQRT_PRICE - 1); assertEq(router.lastMaximum(), 1 ether);
    }
    function testPartialWrongDeltaNoReceiptAndMinimumFailureRollBackOmrLeg() public {
        for (uint8 mode = 1; mode <= 4; ++mode) {
            router.setMode(mode); vm.expectRevert(); vault.convertOmr(1 ether, 1, 1, 1001);
            assertEq(omr.balanceOf(address(vault)), 100 ether); assertEq(address(vault).balance, 10 ether);
            assertEq(omr.allowance(address(vault), address(router)), 0);
        }
        router.setMode(0); vm.expectRevert(); vault.convertOmr(1 ether, 2 ether, 1, 1001);
        vm.expectRevert(); vault.convertOmr(1 ether, 1, 100_001, 1001);
    }
    function testConverterFailureAfterOmrSaleRollsBackBothLegsAndClaims() public {
        _publish(1, alice, 1000, 1000); converter.setMode(4);
        vm.expectRevert(); vault.convertOmr(1 ether, 1, 1, 1001);
        assertEq(omr.balanceOf(address(vault)), 100 ether); assertEq(omr.balanceOf(address(router)), 0);
        assertEq(address(router).balance, 20 ether); assertEq(address(vault).balance, 10 ether);
        assertEq(omr.allowance(address(vault), address(router)), 0); assertEq(vault.totalReserved(), 1000);
    }
    function testOmrAmountBoundsAndRouterRuntimeFailBeforeAllowance() public {
        vm.expectRevert(); vault.convertOmr(0, 1, 1, 1001);
        vm.expectRevert(); vault.convertOmr(uint256(uint128(type(int128).max)) + 1, 1, 1, 1001);
        vm.expectRevert(); vault.convertOmr(101 ether, 1, 1, 1001);
        vm.etch(address(router), hex"00"); vm.expectRevert(); vault.convertOmr(1 ether, 1, 1, 1001);
        assertEq(omr.allowance(address(vault), address(router)), 0);
    }
    function testNoWithdrawalRescueRootMutationOrUpgradeEntryPoint() public {
        _publish(1, alice, 1000, 1000);
        bytes[5] memory calls = [abi.encodeWithSignature("withdraw(uint256)", 1), abi.encodeWithSignature("sweep(address)", address(wbtc)),
            abi.encodeWithSignature("rescue(address,address,uint256)", address(wbtc), bob, 1),
            abi.encodeWithSignature("setRoot(uint256,bytes32)", 1, MANIFEST), abi.encodeWithSignature("upgradeTo(address)", bob)];
        for (uint256 i; i < calls.length; ++i) { (bool ok,) = address(vault).call(calls[i]); assertFalse(ok); }
        assertEq(vault.totalReserved(), 1000);
    }
    function testFuzzPrefundedClaimConservesEveryRawWbtcUnit(uint96 seed) public {
        uint256 amount = bound(uint256(seed), 1, 500_000_000);
        uint256 before = wbtc.balanceOf(address(vault));
        _publish(1, alice, amount, amount); _claim(alice, 1, amount);
        assertEq(wbtc.balanceOf(alice), amount); assertEq(wbtc.balanceOf(address(vault)), before - amount);
        assertEq(vault.totalReserved(), 0); assertEq(vault.availableRewards(), before - amount);
    }
    function testFuzzNativeConversionConservesInputAndNewOutput(uint64 nativeSeed, uint64 outputSeed) public {
        uint256 amount = bound(uint256(nativeSeed), 1, 10 ether);
        uint256 output = bound(uint256(outputSeed), 1, 1e12);
        converter.setOutput(output); uint256 before = wbtc.balanceOf(address(vault));
        assertEq(vault.convertNative(amount, output, 1001), output);
        assertEq(address(vault).balance, 10 ether - amount); assertEq(wbtc.balanceOf(address(vault)), before + output);
    }
    receive() external payable {}
}

interface IRewardsLocalRevenueV2 {
    function owed(Currency, uint8) external view returns (uint256);
    function sweep(Currency, uint8) external returns (uint256);
}

/// @dev CREATE ordering is deliberate: converter nonce1, vault nonce2; not a CREATE2 fixed point.
contract RewardsLocalDeploymentFixtureV2 {
    bool private used;
    function deploy(OmertaWbtcRewardsV2.Config memory cfg, address predictedVault, IPoolManager externalManager,
        PoolKey memory externalPool) external returns (OmertaWbtcRewardsV2 vault, OmertaWbtcConverterV2 converter)
    {
        require(!used); used = true;
        converter = new OmertaWbtcConverterV2(predictedVault, cfg.wbtc, externalManager, externalPool,
            address(externalManager).codehash, address(cfg.wbtc).codehash);
        cfg.converter = IWbtcRewardsConverterV2(address(converter));
        cfg.converterRuntimeHash = address(converter).codehash;
        vault = new OmertaWbtcRewardsV2(cfg);
        require(address(vault) == predictedVault, "explicit CREATE nonce prediction");
    }
}

/// @dev Synthetic local prices/balances; this is not a live pool or funded production rehearsal.
contract WbtcRewardsLocalIntegrationV2Test is Test {
    using TransientStateLibrary for IPoolManager;
    RewardsTokenFixtureV2 private wbtc;
    OmertaRestrictedOMRV2 private omr;
    IPoolManager private manager;
    IPoolManager private externalManager;
    OmertaWbtcRewardsV2 private vault;
    OmertaWbtcConverterV2 private converter;
    address private alice = address(0xA1);

    function setUp() public {
        vm.warp(1000); vm.deal(address(this), 100_000 ether);
        wbtc = new RewardsTokenFixtureV2(8); omr = new OmertaRestrictedOMRV2(address(this));
        RewardsLocalDeploymentFixtureV2 factory = new RewardsLocalDeploymentFixtureV2();
        address predictedVault = vm.computeCreateAddress(address(factory), 2);
        address[4] memory recipients = [address(0xD), address(0xE), address(0xF), address(0x10)];
        manager = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(omr), address(this), recipients, predictedVault)));
        OmertaSwapRouterV2 router = new OmertaSwapRouterV2(manager, omr);
        PoolKey memory omrPool = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3000, 60, IHooks(address(0)));
        externalManager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        PoolKey memory externalPool = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(wbtc)), 3000, 60, IHooks(address(0)));
        OmertaWbtcRewardsV2.Config memory cfg;
        cfg.safe = address(this); cfg.wbtc = wbtc; cfg.omr = IERC20(address(omr)); cfg.omrRouter = router;
        cfg.omrPool = omrPool; cfg.routerRuntimeHash = address(router).codehash;
        (vault, converter) = factory.deploy(cfg, predictedVault, externalManager, externalPool);
        assertEq(converter.authorizedVault(), address(vault));
        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(manager);
        omr.setOperator(address(this), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(this).codehash);
        omr.setOperator(address(vault), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(vault).codehash);
        omr.setOperator(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(router).codehash);
        omr.setOperator(address(lp), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(lp).codehash);
        omr.bindSettlementManager(address(manager), address(manager).codehash); omr.sealPolicy();
        manager.initialize(omrPool, uint160(1 << 96)); omr.approve(address(lp), type(uint256).max);
        lp.modifyLiquidity{value: 1001 ether}(omrPool, ModifyLiquidityParams(-887220, 887220, 1000e18, bytes32(0)), "");
        externalManager.initialize(externalPool, uint160(1 << 96));
        PoolModifyLiquidityTest externalLp = new PoolModifyLiquidityTest(externalManager);
        wbtc.mint(address(this), 1e30); wbtc.approve(address(externalLp), type(uint256).max);
        externalLp.modifyLiquidity{value: 200 ether}(externalPool, ModifyLiquidityParams(-887220, 887220, 1 ether, bytes32(0)), "");
        omr.transfer(address(vault), 10 ether);
        (bool ok,) = address(vault).call{value: 2 ether}(""); require(ok);
    }
    function testActualNativeConversionThenPrefundedEpochClaim() public {
        uint256 received = vault.convertNative(1 ether, 1, 1001);
        assertGt(received, 0); assertEq(vault.availableRewards(), received); assertEq(address(vault).balance, 1 ether);
        vault.publishEpoch(1, 100, 200, vault.claimLeaf(1, alice, received), keccak256("synthetic epoch"), received);
        vm.prank(alice); vault.claim(1, received, new bytes32[](0));
        assertEq(wbtc.balanceOf(alice), received); assertEq(vault.totalReserved(), 0);
        assertEq(externalManager.getNonzeroDeltaCount(), 0);
    }
    function testActualOmrSellConvertsOnlyNewEthAndFixedRewardSweepReturnsToVault() public {
        uint256 received = vault.convertOmr(1 ether, 1, 1, 1001);
        assertGt(received, 0); assertEq(wbtc.balanceOf(address(vault)), received);
        assertEq(omr.balanceOf(address(vault)), 9 ether); assertEq(address(vault).balance, 2 ether);
        assertEq(omr.allowance(address(vault), address(vault.omrRouter())), 0);
        uint256 reward = IRewardsLocalRevenueV2(address(manager)).owed(Currency.wrap(address(0)), 4);
        assertGt(reward, 0, "OMR conversion sale still pays mandatory reward tax");
        IRewardsLocalRevenueV2(address(manager)).sweep(Currency.wrap(address(0)), 4);
        assertEq(address(vault).balance, 2 ether + reward);
        assertEq(manager.getNonzeroDeltaCount(), 0); assertEq(externalManager.getNonzeroDeltaCount(), 0);
    }
    function testActualSecondLegMinimumFailureRollsBackOmrNativeAndFeeLiabilities() public {
        vm.expectRevert(); vault.convertOmr(1 ether, 1, 1e30, 1001);
        assertEq(omr.balanceOf(address(vault)), 10 ether); assertEq(address(vault).balance, 2 ether);
        assertEq(wbtc.balanceOf(address(vault)), 0);
        assertEq(IRewardsLocalRevenueV2(address(manager)).owed(Currency.wrap(address(0)), 4), 0);
        assertEq(omr.allowance(address(vault), address(vault.omrRouter())), 0);
        assertEq(manager.getNonzeroDeltaCount(), 0); assertEq(externalManager.getNonzeroDeltaCount(), 0);
    }
    receive() external payable {}
}

contract RewardsEpochInvariantHandlerV2 is Test {
    RewardsTokenFixtureV2 public immutable wbtc;
    OmertaWbtcRewardsV2 public vault;
    uint256 public totalFunded;
    uint256 public totalPublished;
    uint256 public totalClaimed;
    mapping(uint256 => uint256) public amounts;
    constructor(RewardsTokenFixtureV2 token) { wbtc = token; }
    function configure(OmertaWbtcRewardsV2 value) external {
        require(address(vault) == address(0)); vault = value; wbtc.approve(address(value), type(uint256).max);
    }
    function fund(uint64 seed) external {
        uint256 amount = bound(uint256(seed), 1, 1_000_000);
        wbtc.mint(address(this), amount); vault.fundRewards(amount); totalFunded += amount;
    }
    function publish(uint64 seed) external {
        uint256 available = vault.availableRewards(); if (available == 0) return;
        uint256 amount = bound(uint256(seed), 1, available); uint256 id = vault.lastEpochId() + 1;
        vm.warp(block.timestamp + 1);
        vault.publishEpoch(id, uint64(block.timestamp - 1), uint64(block.timestamp), vault.claimLeaf(id, address(this), amount),
            keccak256("synthetic invariant manifest"), amount);
        amounts[id] = amount; totalPublished += amount;
    }
    function claim(uint64 seed) external {
        uint256 last = vault.lastEpochId(); if (last == 0) return;
        uint256 id = bound(uint256(seed), 1, last); if (vault.hasClaimed(id, address(this))) return;
        uint256 amount = amounts[id]; vault.claim(id, amount, new bytes32[](0)); totalClaimed += amount;
    }
}

contract WbtcRewardsV2InvariantTest is Test {
    RewardsTokenFixtureV2 private wbtc;
    OmertaWbtcRewardsV2 private vault;
    RewardsEpochInvariantHandlerV2 private handler;
    function setUp() public {
        vm.warp(1000); wbtc = new RewardsTokenFixtureV2(8); handler = new RewardsEpochInvariantHandlerV2(wbtc);
        OmertaWbtcRewardsV2.Config memory cfg;
        cfg.safe = address(handler); cfg.wbtc = wbtc; cfg.omr = IERC20(address(0xC001));
        cfg.omrRouter = OmertaSwapRouterV2(payable(address(0xC002))); cfg.routerRuntimeHash = bytes32(uint256(1));
        cfg.omrPool = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(cfg.omr)), 3000, 60, IHooks(address(0)));
        cfg.converter = IWbtcRewardsConverterV2(address(0xC003)); cfg.converterRuntimeHash = bytes32(uint256(2));
        vault = new OmertaWbtcRewardsV2(cfg); handler.configure(vault);
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = handler.fund.selector; selectors[1] = handler.publish.selector; selectors[2] = handler.claim.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors})); targetContract(address(handler));
    }
    function invariantAllPublishedClaimsRemainFullyReservedWithoutReusingPaidFunds() public view {
        assertEq(vault.totalReserved(), handler.totalPublished() - handler.totalClaimed());
        assertEq(wbtc.balanceOf(address(vault)), handler.totalFunded() - handler.totalClaimed());
        assertGe(wbtc.balanceOf(address(vault)), vault.totalReserved());
        assertEq(vault.availableRewards(), handler.totalFunded() - handler.totalPublished());
    }
}
