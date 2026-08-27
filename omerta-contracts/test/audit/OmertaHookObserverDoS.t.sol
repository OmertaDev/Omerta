// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";

import {OMR} from "../../src/OMR.sol";
import {OmertaHook, IOmrHookObserver} from "../../src/OmertaHook.sol";

interface IObserverPoke {
    function pokeObserver(PoolKey calldata key) external;
}

/// @dev Negative control: records that the observer returned within the hook's gas stipend.
contract NoOpGasObserver is IOmrHookObserver {
    uint256 public calls;
    uint256 public gasAtEntry;

    function observe(PoolKey calldata) external {
        gasAtEntry = gasleft();
        calls++;
    }
}

/// @dev Calls an unlocked-only PoolManager function successfully, then deliberately leaves the
///      resulting transient currency delta unsettled. Nothing in this callback reverts.
contract UnsettledTakeObserver is IOmrHookObserver {
    IPoolManager public immutable manager;

    constructor(IPoolManager manager_) {
        manager = manager_;
    }

    receive() external payable {}

    function observe(PoolKey calldata) external {
        manager.take(Currency.wrap(address(0)), address(this), 1);
    }
}

/// @notice Reproduces the observer's deferred-delta DoS against the production hook and production
///         v4 PoolManager. The hook catches immediate observer reverts, but a callback can return
///         normally after contaminating PoolManager's transient settlement state. The failure is
///         raised only later, when PoolManager.unlock checks NonzeroDeltaCount.
contract OmertaHookObserverDoSTest is Test {
    uint160 internal constant FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
    );

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;
    int24 internal constant TICK_SPACING = 60;
    int24 internal constant MIN_TICK = -887220;
    int24 internal constant MAX_TICK = 887220;

    address internal safe = address(0x5AFE);
    address internal dev = address(0xD3F);
    address internal rwa = address(0x67A);
    address internal community = address(0xC0117);
    address internal lp = address(0x1BB);
    address internal trader = address(0x7EAD);

    PoolManager internal manager;
    OMR internal omr;
    OmertaHook internal hook;
    PoolSwapTest internal swapRouter;
    PoolModifyLiquidityTest internal lpRouter;
    PoolKey internal key;
    Currency internal eth = Currency.wrap(address(0));
    Currency internal omrCurrency;

    function setUp() public {
        manager = new PoolManager(address(this));
        omr = new OMR(safe);
        omrCurrency = Currency.wrap(address(omr));

        address hookAddress = address(uint160((uint256(0xBEEF) << 144) | uint256(FLAGS)));
        deployCodeTo("OmertaHook.sol:OmertaHook", abi.encode(manager, address(omr), safe, address(this)), hookAddress);
        hook = OmertaHook(payable(hookAddress));

        vm.startPrank(safe);
        hook.setRecipients(dev, rwa, community, lp);
        hook.setAllowedQuote(eth, true);
        hook.setSellTax(900, 200, 400, 0);
        omr.transfer(address(this), 10_000_000e18);
        omr.transfer(trader, 1_000_000e18);
        vm.stopPrank();

        swapRouter = new PoolSwapTest(manager);
        lpRouter = new PoolModifyLiquidityTest(manager);

        key = PoolKey(eth, omrCurrency, 3000, TICK_SPACING, IHooks(hookAddress));
        manager.initialize(key, SQRT_PRICE_1_1);

        vm.deal(address(this), 10_000 ether);
        vm.deal(trader, 1_000 ether);
        omr.approve(address(lpRouter), type(uint256).max);
        vm.prank(trader);
        omr.approve(address(swapRouter), type(uint256).max);

        lpRouter.modifyLiquidity{value: 5_000 ether}(
            key, ModifyLiquidityParams(MIN_TICK, MAX_TICK, 1_000e18, bytes32(0)), ""
        );
    }

    receive() external payable {}

    function _sellExactIn(uint256 omrIn) internal returns (BalanceDelta) {
        vm.prank(trader);
        return swapRouter.swap(
            key,
            SwapParams({zeroForOne: false, amountSpecified: -int256(omrIn), sqrtPriceLimitX96: SQRT_PRICE_1_1 * 2}),
            PoolSwapTest.TestSettings({takeClaims: false, settleUsingBurn: false}),
            ""
        );
    }

    function test_negative_control_noop_observer_is_poked_outside_swap_settlement() public {
        NoOpGasObserver observer = new NoOpGasObserver();
        vm.prank(safe);
        hook.setObserver(observer);

        uint256 ethBefore = trader.balance;
        _sellExactIn(50e18);

        assertGt(trader.balance, ethBefore, "negative-control swap did not settle");
        assertEq(observer.calls(), 0, "a swap synchronously entered the observer");

        IObserverPoke(address(hook)).pokeObserver(key);
        assertEq(observer.calls(), 1, "observer did not return normally");
        assertLe(observer.gasAtEntry(), hook.OBSERVER_GAS(), "observer received more than the stipend");
        assertGt(observer.gasAtEntry(), 100_000, "fixture did not exercise the 150k stipend");
        emit log_named_uint("observer gas at entry", observer.gasAtEntry());
    }

    function test_regression_unsettled_observer_cannot_poison_a_swap_unlock() public {
        UnsettledTakeObserver observer = new UnsettledTakeObserver(manager);
        vm.prank(safe);
        hook.setObserver(observer);

        uint256 ethBefore = trader.balance;
        uint256 omrBefore = omr.balanceOf(trader);

        _sellExactIn(50e18);
        assertGt(trader.balance, ethBefore, "observer poisoned native settlement");
        assertLt(omr.balanceOf(trader), omrBefore, "observer poisoned OMR settlement");
        assertEq(address(observer).balance, 0, "the observer ran synchronously during the swap");

        // Outside PoolManager.unlock, `take` reverts immediately as ManagerLocked and the isolated
        // poke swallows it. No deferred transient delta can survive into an unrelated swap.
        vm.expectCall(
            address(manager), abi.encodeCall(IPoolManager.take, (Currency.wrap(address(0)), address(observer), 1))
        );
        IObserverPoke(address(hook)).pokeObserver(key);

        uint256 ethAfterFirst = trader.balance;
        _sellExactIn(50e18);
        assertGt(trader.balance, ethAfterFirst, "an isolated observer failure poisoned the next swap");
    }
}
