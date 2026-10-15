// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {OMR} from "../../src/OMR.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";

/// Controlled observations isolate controller boundary tests; swaps, positions and fees
/// use the real pinned PoolManager and actual V2 hook. This fixture does not prove the oracle.
contract StabilityObservationFixture is IOmertaMarketStateV2 {
    Snapshot private _reading;
    bool public broken;

    function set(Snapshot memory reading) external {
        _reading = reading;
    }

    function setBroken(bool value) external {
        broken = value;
    }

    function snapshot() external view returns (Snapshot memory) {
        require(!broken, "oracle offline");
        return _reading;
    }
}

contract StabilityRejectRecipient {
    receive() external payable {
        revert("unavailable");
    }
}

abstract contract StabilityV2Fixture is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    IPoolManager manager;
    OMR token;
    OmertaHookV2 hook;
    PoolModifyLiquidityTest lp;
    PoolSwapTest swaps;
    StabilityObservationFixture observations;
    Controller controller;
    PoolKey key;
    uint64 epoch;
    address safe = address(0x500);
    address recipient = address(0xFEE);
    Controller.Tranche constant CORE = Controller.Tranche.Core;
    Controller.Tranche constant GARRISON = Controller.Tranche.Garrison;
    Controller.Tranche constant DESK = Controller.Tranche.Desk;
    Controller.Tranche constant RESERVE = Controller.Tranche.WarChest;

    receive() external payable {}

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        vm.roll(100);
        vm.deal(address(this), 100_000 ether);
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        token = new OMR(address(this));
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        address hookAddress = address(uint160(0xCAFE << 144) | flags);
        address[5] memory recipients = [address(0xD), address(0xE), address(0xF), address(0x10), address(0x11)];
        deployCodeTo(
            "OmertaHookV2.sol:OmertaHookV2",
            abi.encode(
                manager,
                address(token),
                address(this),
                uint24(3000),
                int24(60),
                recipients,
                OmertaHookV2.OpeningConfig(0, 0, 0),
                uint24(600),
                uint32(60)
            ),
            hookAddress
        );
        hook = OmertaHookV2(payable(hookAddress));
        key = hook.poolKey();
        manager.initialize(key, TickMath.getSqrtPriceAtTick(0));
        lp = new PoolModifyLiquidityTest(manager);
        swaps = new PoolSwapTest(manager);
        token.approve(address(lp), type(uint256).max);
        token.approve(address(swaps), type(uint256).max);
        lp.modifyLiquidity{value: 2000 ether}(key, ModifyLiquidityParams(-887220, 887220, 1000 ether, bytes32(0)), "");
        observations = new StabilityObservationFixture();
        _reading(0, 0, 0);
        controller = new Controller(_config(recipient));
        token.approve(address(controller), type(uint256).max);
        for (uint256 i; i < 7; ++i) {
            controller.fund{value: 10 ether}(Controller.Tranche(i), 10 ether);
        }
    }

    function _config(address fees) internal view returns (Controller.Config memory c) {
        c.safe = safe;
        c.manager = manager;
        c.key = key;
        c.marketState = observations;
        c.maxObservationAge = 10 minutes;
        c.cooldown = 1 minutes;
        c.recoveryInterval = 1 minutes;
        c.minLiquidity = 1 ether;
        c.maxSpotDeviationTicks = 100;
        c.minBandTicks = 120;
        c.maxBandTicks = 1200;
        c.stressOnBps = 6000;
        c.stressOffBps = 2000;
        c.recoveryX = 2;
        c.recoveryY = 3;
        c.turfLower = -600;
        c.turfUpper = 600;
        c.turfSeasonStart = uint64(vm.getBlockTimestamp());
        c.turfSeasonEnd = uint64(vm.getBlockTimestamp() + 30 days);
        for (uint256 i; i < 7; ++i) {
            c.feeRecipients[i] = fees;
            c.limits[i] = Controller.Limits(1 ether, 1 ether, 2 ether, 2 ether, 4 ether, 4 ether, 0.5 ether, 0.5 ether);
        }
    }

    function _reading(int24 mean, uint16 stress, uint16 imbalance) internal {
        observations.set(
            IOmertaMarketStateV2.Snapshot(
                ++epoch, uint64(vm.getBlockTimestamp()), mean, 0, 1000 ether, 1 ether, stress, imbalance, true
            )
        );
    }

    function _assertCustody() internal view {
        assertEq(address(controller).balance, controller.totalIdleNative() + controller.totalNativeFees());
        assertEq(token.balanceOf(address(controller)), controller.totalIdleOmr() + controller.totalOmrFees());
        uint256 total0;
        uint256 total1;
        uint256 fees0;
        uint256 fees1;
        for (uint256 i; i < 7; ++i) {
            Controller.Account memory a = controller.account(Controller.Tranche(i));
            total0 += a.idleNative;
            total1 += a.idleOmr;
            fees0 += a.nativeFees;
            fees1 += a.omrFees;
            Controller.Limits memory l = controller.limits(Controller.Tranche(i));
            assertLe(a.nativeDeployed, l.nativeLifetime);
            assertLe(a.omrDeployed, l.omrLifetime);
            assertLe(a.nativeCapacity, l.nativePerEpisode);
            assertLe(a.omrCapacity, l.omrPerEpisode);
        }
        assertEq(total0, controller.totalIdleNative());
        assertEq(total1, controller.totalIdleOmr());
        assertEq(fees0, controller.totalNativeFees());
        assertEq(fees1, controller.totalOmrFees());
    }

    function _exit(Controller.Tranche t) internal {
        vm.prank(safe);
        controller.exit(t);
    }

    function _next(int24 mean, uint16 stress) internal {
        vm.warp(vm.getBlockTimestamp() + 60);
        vm.roll(vm.getBlockNumber() + 1);
        _reading(mean, stress, 0);
    }

    function _sellTo(int24 tick) internal {
        swaps.swap(
            key,
            SwapParams(false, -int256(100 ether), TickMath.getSqrtPriceAtTick(tick)),
            PoolSwapTest.TestSettings(false, false),
            ""
        );
    }

    function _buyTo(int24 tick) internal {
        swaps.swap{value: 100 ether}(
            key,
            SwapParams(true, -int256(100 ether), TickMath.getSqrtPriceAtTick(tick)),
            PoolSwapTest.TestSettings(false, false),
            ""
        );
    }
}

contract StabilityV2Test is StabilityV2Fixture {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    function testAcceptedLargeRecoveryIntervalDoesNotOverflowOnSecondObservation() public {
        Controller.Config memory c = _config(recipient);
        c.recoveryInterval = type(uint32).max;
        Controller longClock = new Controller(c);
        vm.warp(uint256(type(uint32).max) + 100);
        _reading(0, 0, 0);
        longClock.observeRecovery(GARRISON, epoch);
        vm.warp(vm.getBlockTimestamp() + uint256(type(uint32).max));
        _reading(0, 0, 0);
        longClock.observeRecovery(GARRISON, epoch);
        assertEq(longClock.account(GARRISON).recoverySamples, 2);
    }

    function testRealPoolManagerCorePositionAndExactCustodyConservation() public {
        controller.deploy(CORE, epoch);
        Controller.Position memory p = controller.position(CORE);
        (uint128 actual,,) = manager.getPositionInfo(
            key.toId(), address(controller), p.lower, p.upper, keccak256(abi.encode(CORE, p.nonce))
        );
        assertGt(actual, 0);
        assertEq(actual, p.liquidity);
        (uint256 nativeAmount, uint256 omrAmount) = controller.positionInventory(CORE);
        assertGt(nativeAmount, 0);
        assertGt(omrAmount, 0);
        Controller.Account memory a = controller.account(CORE);
        assertLe(a.nativeDeployed, 1 ether);
        assertLe(a.omrDeployed, 1 ether);
        _assertCustody();
    }

    function testCorrectDownsideAndUpsideRawTickOrientation() public {
        _reading(0, 8000, 8000);
        controller.deploy(GARRISON, epoch);
        Controller.Position memory g = controller.position(GARRISON);
        assertEq(g.lower, 240);
        assertEq(g.upper, 360);
        Controller.Account memory ga = controller.account(GARRISON);
        assertGt(ga.nativeDeployed, 0);
        assertEq(ga.omrDeployed, 0);
        _next(0, 0);
        controller.deploy(DESK, epoch);
        Controller.Position memory d = controller.position(DESK);
        assertEq(d.lower, -360);
        assertEq(d.upper, -240);
        Controller.Account memory da = controller.account(DESK);
        assertEq(da.nativeDeployed, 0);
        assertGt(da.omrDeployed, 0);
        _assertCustody();
    }

    function testInventoryReversesBeforeActualSettlement() public {
        _reading(0, 8000, 8000);
        controller.deploy(GARRISON, epoch);
        _sellTo(400);
        (uint256 n0, uint256 t0) = controller.positionInventory(GARRISON);
        assertEq(n0, 0);
        assertGt(t0, 0);
        _buyTo(0);
        (uint256 n1, uint256 t1) = controller.positionInventory(GARRISON);
        assertGt(n1, 0);
        assertEq(t1, 0);
        Controller.Account memory a = controller.account(GARRISON);
        assertEq(a.nativeReturned, 0);
        assertEq(a.omrReturned, 0);
        _assertCustody();
    }

    function testPermissionlessFinalizeActuallySettlesConvertedPrincipalAndEarnedFees() public {
        _reading(0, 8000, 8000);
        controller.deploy(GARRISON, epoch);
        _sellTo(400);
        vm.roll(vm.getBlockNumber() + 1);
        controller.finalize(GARRISON);
        Controller.Account memory a = controller.account(GARRISON);
        assertEq(a.nativeReturned, 0);
        assertGt(a.omrReturned, 0);
        assertGt(a.omrFees, 0);
        assertEq(controller.position(GARRISON).liquidity, 0);
        assertLt(a.nativeCapacity, 2 ether); // Settlement never restores capacity.
        _assertCustody();
    }

    function testCannotFinalizeUnconvertedOrCorePosition() public {
        controller.deploy(CORE, epoch);
        vm.roll(vm.getBlockNumber() + 1);
        vm.expectRevert(Controller.WrongRegime.selector);
        controller.finalize(CORE);
        _reading(0, 8000, 0);
        controller.deploy(GARRISON, epoch);
        vm.roll(vm.getBlockNumber() + 1);
        vm.expectRevert(Controller.WrongRegime.selector);
        controller.finalize(GARRISON);
    }

    function testPauseAndBrokenOracleDoNotLockExitCollectClaimOrRetire() public {
        controller.deploy(CORE, epoch);
        _sellTo(20);
        vm.prank(safe);
        controller.setPaused(true);
        observations.setBroken(true);
        controller.collect(CORE);
        _exit(CORE);
        controller.claimFees(CORE);
        uint256 safeBefore = safe.balance;
        vm.prank(safe);
        controller.retire(CORE, 1 ether, 1 ether);
        assertEq(safe.balance, safeBefore + 1 ether);
        _assertCustody();
    }

    function testFundingNeverResurrectsEpisodeCapacity() public {
        controller.deploy(CORE, epoch);
        _exit(CORE);
        _next(0, 0);
        controller.deploy(CORE, epoch);
        _exit(CORE);
        _next(0, 0);
        Controller.Account memory beforeA = controller.account(CORE);
        controller.fund{value: 10 ether}(CORE, 10 ether);
        Controller.Account memory afterA = controller.account(CORE);
        assertEq(beforeA.nativeCapacity, afterA.nativeCapacity);
        assertEq(beforeA.omrCapacity, afterA.omrCapacity);
        vm.expectRevert(Controller.BudgetExhausted.selector);
        controller.deploy(CORE, epoch);
    }

    function testCannotReuseObservationOrBypassCooldown() public {
        controller.deploy(CORE, epoch);
        _exit(CORE);
        vm.expectRevert(Controller.Cooldown.selector);
        controller.deploy(CORE, epoch);
        _reading(0, 0, 0);
        vm.expectRevert(Controller.Cooldown.selector);
        controller.deploy(CORE, epoch);
    }

    function testRejectsStaleFutureWrongEpochAndInvalidObservation() public {
        vm.expectRevert(Controller.InvalidObservation.selector);
        controller.deploy(CORE, epoch + 1);
        vm.warp(vm.getBlockTimestamp() + 601);
        vm.expectRevert(Controller.InvalidObservation.selector);
        controller.deploy(CORE, epoch);
        observations.set(
            IOmertaMarketStateV2.Snapshot(
                ++epoch, uint64(vm.getBlockTimestamp() + 1), 0, 0, 1000 ether, 1 ether, 0, 0, true
            )
        );
        vm.expectRevert(Controller.InvalidObservation.selector);
        controller.deploy(CORE, epoch);
        observations.set(
            IOmertaMarketStateV2.Snapshot(
                ++epoch, uint64(vm.getBlockTimestamp()), 0, 0, 1000 ether, 1 ether, 0, 0, false
            )
        );
        vm.expectRevert(Controller.InvalidObservation.selector);
        controller.deploy(CORE, epoch);
    }

    function testRejectsShallowObservationAndManipulatedSpot() public {
        observations.set(
            IOmertaMarketStateV2.Snapshot(++epoch, uint64(vm.getBlockTimestamp()), 0, 0, 1, 1 ether, 0, 0, true)
        );
        vm.expectRevert(Controller.InsufficientDepth.selector);
        controller.deploy(CORE, epoch);
        _reading(0, 0, 0);
        _sellTo(200);
        vm.expectRevert(Controller.SpotDeviation.selector);
        controller.deploy(CORE, epoch);
    }

    function testHysteresisUsesSeparateActivationAndRecoveryThresholds() public {
        _reading(0, 5000, 0);
        vm.expectRevert(Controller.WrongRegime.selector);
        controller.deploy(GARRISON, epoch);
        _reading(0, 6000, 0);
        controller.deploy(GARRISON, epoch);
        assertTrue(controller.stressed());
        _next(0, 5000);
        controller.deploy(CORE, epoch);
        assertTrue(controller.stressed());
        _next(0, 2000);
        controller.deploy(DESK, epoch);
        assertFalse(controller.stressed());
    }

    function testRecoveryRequiresThreeDistinctSpacedObservationsThenFundedPartialRefill() public {
        _reading(0, 8000, 0);
        controller.deploy(GARRISON, epoch);
        _exit(GARRISON);
        _next(0, 0);
        controller.observeRecovery(GARRISON, epoch);
        vm.expectRevert(Controller.Cooldown.selector);
        controller.observeRecovery(GARRISON, epoch);
        vm.expectRevert(Controller.RecoveryNotReady.selector);
        controller.regenerate(GARRISON, epoch);
        _next(0, 5000);
        controller.observeRecovery(GARRISON, epoch);
        _next(0, 0);
        controller.observeRecovery(GARRISON, epoch);
        Controller.Account memory beforeA = controller.account(GARRISON);
        Controller.Account memory reserve = controller.account(RESERVE);
        controller.regenerate(GARRISON, epoch);
        Controller.Account memory afterA = controller.account(GARRISON);
        assertEq(afterA.nativeCapacity - beforeA.nativeCapacity, 0.5 ether);
        assertEq(afterA.idleNative - beforeA.idleNative, 0.5 ether);
        assertEq(controller.account(RESERVE).idleNative, reserve.idleNative - 0.5 ether);
        assertEq(afterA.nativeDeployed, beforeA.nativeDeployed);
        vm.expectRevert(Controller.RecoveryNotReady.selector);
        controller.regenerate(GARRISON, epoch);
        _assertCustody();
    }

    function testRecoveryGapResetsWindowAndEmptyWarChestCannotRegenerate() public {
        _reading(0, 8000, 0);
        controller.deploy(GARRISON, epoch);
        _exit(GARRISON);
        _next(0, 0);
        controller.observeRecovery(GARRISON, epoch);
        vm.warp(vm.getBlockTimestamp() + 180);
        _reading(0, 0, 0);
        controller.observeRecovery(GARRISON, epoch);
        assertEq(controller.account(GARRISON).recoverySamples, 1);
        _next(0, 0);
        controller.observeRecovery(GARRISON, epoch);
        _next(0, 0);
        controller.observeRecovery(GARRISON, epoch);
        vm.prank(safe);
        controller.retire(RESERVE, 10 ether, 10 ether);
        vm.expectRevert(Controller.BudgetExhausted.selector);
        controller.regenerate(GARRISON, epoch);
    }

    function testFeeBeneficiaryCannotDrainPrincipalOrOtherCompartment() public {
        controller.deploy(CORE, epoch);
        _sellTo(20);
        controller.collect(CORE);
        Controller.Account memory beforeA = controller.account(CORE);
        assertGt(beforeA.omrFees, 0);
        controller.claimFees(CORE);
        Controller.Account memory afterA = controller.account(CORE);
        assertEq(afterA.idleNative, beforeA.idleNative);
        assertEq(afterA.idleOmr, beforeA.idleOmr);
        assertEq(token.balanceOf(recipient), beforeA.omrFees);
        assertEq(controller.claimedNativeFees(uint256(CORE)), beforeA.nativeFees);
        assertEq(controller.claimedOmrFees(uint256(CORE)), beforeA.omrFees);
        vm.prank(recipient);
        vm.expectRevert(Controller.Unauthorized.selector);
        controller.retire(CORE, 1, 0);
        _assertCustody();
    }

    function testFeeRecipientFailureCannotBlockLiquidityExit() public {
        Controller another = new Controller(_config(address(new StabilityRejectRecipient())));
        token.approve(address(another), type(uint256).max);
        another.fund{value: 2 ether}(CORE, 2 ether);
        another.deploy(CORE, epoch);
        _buyTo(-20);
        another.collect(CORE);
        vm.expectRevert(Controller.TransferFailed.selector);
        another.claimFees(CORE);
        vm.prank(safe);
        another.exit(CORE);
        assertEq(another.position(CORE).liquidity, 0);
        assertGt(another.account(CORE).nativeFees, 0);
    }

    function testNoArbitraryUnlockCallbackOrNativeTransfer() public {
        vm.expectRevert(Controller.BadCallback.selector);
        controller.unlockCallback("");
        vm.prank(address(manager));
        vm.expectRevert(Controller.BadCallback.selector);
        controller.unlockCallback("");
        (bool ok,) = address(controller).call{value: 1}("");
        assertFalse(ok);
        vm.expectRevert(Controller.InvalidTranche.selector);
        controller.deploy(RESERVE, epoch);
    }

    function testTurfRangeIsFixedGeographyAndSeasonOnlyStopsNewPlacement() public {
        (int24 lower, int24 upper) = controller.previewRange(Controller.Tranche.Turf, epoch);
        assertEq(lower, -600);
        assertEq(upper, 600);
        controller.deploy(Controller.Tranche.Turf, epoch);
        vm.warp(vm.getBlockTimestamp() + 30 days);
        _reading(0, 0, 0);
        controller.collect(Controller.Tranche.Turf);
        _exit(Controller.Tranche.Turf);
        vm.expectRevert(Controller.WrongRegime.selector);
        controller.deploy(Controller.Tranche.Turf, epoch);
        controller.claimFees(Controller.Tranche.Turf);
        _assertCustody();
    }

    function testTurfExpiryIsPermissionlessAndIndependentOfPausedBrokenOracle() public {
        controller.deploy(Controller.Tranche.Turf, epoch);
        vm.expectRevert(Controller.WrongRegime.selector);
        controller.expireTurf();
        vm.prank(safe);
        controller.setPaused(true);
        observations.setBroken(true);
        vm.warp(vm.getBlockTimestamp() + 30 days);
        controller.expireTurf();
        controller.expireTurf();
        assertEq(controller.position(Controller.Tranche.Turf).liquidity, 0);
        assertGt(controller.account(Controller.Tranche.Turf).nativeReturned, 0);
        _assertCustody();
    }

    function testFuzzPrincipalConservationAcrossRealPricePaths(uint96 input, bool sell) public {
        controller.deploy(CORE, epoch);
        uint256 amount = bound(input, 1e10, 2 ether);
        if (sell) {
            swaps.swap(
                key,
                SwapParams(false, -int256(amount), TickMath.getSqrtPriceAtTick(400)),
                PoolSwapTest.TestSettings(false, false),
                ""
            );
        } else {
            swaps.swap{value: amount}(
                key,
                SwapParams(true, -int256(amount), TickMath.getSqrtPriceAtTick(-400)),
                PoolSwapTest.TestSettings(false, false),
                ""
            );
        }
        _assertCustody();
        controller.collect(CORE);
        _assertCustody();
        _exit(CORE);
        _assertCustody();
        Controller.Account memory a = controller.account(CORE);
        assertEq(a.idleNative, 10 ether - a.nativeDeployed + a.nativeReturned);
        assertEq(a.idleOmr, 10 ether - a.omrDeployed + a.omrReturned);
        controller.claimFees(CORE);
        _assertCustody();
    }
}
