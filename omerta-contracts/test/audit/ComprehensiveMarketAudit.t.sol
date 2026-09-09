// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaHook} from "../../src/OmertaHook.sol";
import {OmrV4TwapOracle} from "../../src/OmrV4TwapOracle.sol";
import {OMR} from "../../src/OMR.sol";

/// @notice Additional adversarial traces for the 2026-09-08 review. All swaps execute through
///         the actual v4 PoolManager and test router; no hook deltas or pool state are mocked.
contract ComprehensiveMarketAuditTest is Test {
    using PoolIdLibrary for PoolKey;

    uint160 private constant FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
    );
    uint160 private constant Q96 = 79228162514264337593543950336;
    address private constant SAFE = address(0x5AFE);
    address private constant DEV = address(0xDE01);
    address private constant RWA = address(0xDE02);
    address private constant COMMUNITY = address(0xDE03);
    address private constant LP = address(0xDE04);

    PoolManager private manager;
    OMR private omr;
    OmertaHook private hook;
    PoolSwapTest private router;
    PoolModifyLiquidityTest private liquidityRouter;
    PoolKey private key;
    Currency private nativeCurrency = Currency.wrap(address(0));

    function setUp() public {
        vm.roll(1_000);
        vm.warp(1_000_000);
        vm.deal(address(this), 10_000 ether);
        manager = new PoolManager(address(this));
        omr = new OMR(SAFE);
        address hookAddress = address(uint160((uint256(0xCAFE) << 144) | uint256(FLAGS)));
        deployCodeTo("OmertaHook.sol:OmertaHook", abi.encode(manager, address(omr), SAFE, address(this)), hookAddress);
        hook = OmertaHook(payable(hookAddress));
        vm.startPrank(SAFE);
        hook.setRecipients(DEV, RWA, COMMUNITY, LP);
        hook.setAllowedQuote(nativeCurrency, true);
        hook.setSellTax(900, 200, 400, 100);
        omr.transfer(address(this), 1_000_000e18);
        vm.stopPrank();
        router = new PoolSwapTest(manager);
        liquidityRouter = new PoolModifyLiquidityTest(manager);
        omr.approve(address(router), type(uint256).max);
        omr.approve(address(liquidityRouter), type(uint256).max);
        key = PoolKey(nativeCurrency, Currency.wrap(address(omr)), 3_000, 60, IHooks(hookAddress));
        manager.initialize(key, Q96);
    }

    receive() external payable {}

    function _addLiquidity() private {
        liquidityRouter.modifyLiquidity{value: 2_000 ether}(
            key, ModifyLiquidityParams(-887220, 887220, 1_000e18, bytes32(0)), ""
        );
    }

    function _sell(uint256 amount, uint160 limit) private returns (BalanceDelta) {
        return router.swap(
            key,
            SwapParams(false, -int256(amount), limit),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function test_regression_eachSelfRecipientRejectedAndAccruedFeesRemainRecoverable() public {
        _addLiquidity();
        _sell(100e18, Q96 * 2);
        (uint256 devFee, uint256 rwaFee, uint256 communityFee, uint256 lpFee) = hook.owed(nativeCurrency);
        assertGt(devFee, 0);
        for (uint256 i; i < 4; ++i) {
            address[4] memory recipients = [DEV, RWA, COMMUNITY, LP];
            recipients[i] = address(hook);
            vm.prank(SAFE);
            vm.expectRevert(OmertaHook.InvalidRecipient.selector);
            hook.setRecipients(recipients[0], recipients[1], recipients[2], recipients[3]);
        }
        assertEq(hook.devRecipient(), DEV);
        assertEq(hook.rwaRecipient(), RWA);
        assertEq(hook.communityRecipient(), COMMUNITY);
        assertEq(hook.lpRecipient(), LP);
        hook.sweep(nativeCurrency);
        (uint256 d, uint256 r, uint256 c, uint256 l) = hook.owed(nativeCurrency);
        assertEq(d + r + c + l, 0);
        assertEq(DEV.balance, devFee);
        assertEq(RWA.balance, rwaFee);
        assertEq(COMMUNITY.balance, communityFee);
        assertEq(LP.balance, lpFee);
        assertEq(address(hook).balance, 0, "no fee is stranded");
        vm.expectRevert(OmertaHook.NothingToSweep.selector);
        hook.sweep(nativeCurrency);
    }

    function test_risk_emptyLiquidityProducesZeroCostFreshTwap() public {
        // Initialization is authorized, but the public swap below is permissionless. The tested
        // condition is that the canonical pool has no active liquidity, e.g. before funding.
        OmrV4TwapOracle oracle = new OmrV4TwapOracle(hook, address(omr), 3_000, 60, 600);
        uint256 omrBefore = omr.balanceOf(address(this));
        uint256 ethBefore = address(this).balance;
        BalanceDelta delta = _sell(1e18, Q96 * 2);
        assertEq(delta.amount0(), 0);
        assertEq(delta.amount1(), 0);
        assertEq(omr.balanceOf(address(this)), omrBefore);
        assertEq(address(this).balance, ethBefore);
        (uint160 sqrtPrice,,,) = StateLibrary.getSlot0(manager, key.toId());
        assertEq(sqrtPrice, Q96 * 2, "empty swap changes the quoted price by 4x");
        vm.warp(block.timestamp + 600);
        oracle.update();
        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertApproxEqRel(price, 4e18, 2e14);
        assertEq(updatedAt, block.timestamp, "empty-pool price is published as fresh");
    }
}
