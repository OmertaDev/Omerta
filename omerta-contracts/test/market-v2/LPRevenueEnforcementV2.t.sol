// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {OMR} from "../../src/OMR.sol";

/// Test-only two-pool route: no ERC20 transfer, approval, or exemption is needed.
contract LPRevenueNettingFixtureV2 is IUnlockCallback {
    IPoolManager private immutable manager;

    constructor(IPoolManager manager_) { manager = manager_; }

    function roundTrip(PoolKey calldata buyKey, PoolKey calldata sellKey, uint128 input)
        external payable returns (uint256 grossSold)
    {
        require(msg.value == input, "wrong funding");
        grossSold = abi.decode(manager.unlock(abi.encode(buyKey, sellKey, input)), (uint256));
        (bool ok,) = msg.sender.call{value: address(this).balance}("");
        require(ok, "refund failed");
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        require(msg.sender == address(manager), "only manager");
        (PoolKey memory buyKey, PoolKey memory sellKey, uint128 input) =
            abi.decode(data, (PoolKey, PoolKey, uint128));
        BalanceDelta buy = manager.swap(
            buyKey, SwapParams(true, -int256(uint256(input)), TickMath.MIN_SQRT_PRICE + 1), ""
        );
        require(buy.amount0() == -int128(input) && buy.amount1() > 0, "incomplete buy");
        BalanceDelta sell = manager.swap(
            sellKey, SwapParams(false, -int256(buy.amount1()), TickMath.MAX_SQRT_PRICE - 1), ""
        );
        require(int256(buy.amount1()) + int256(sell.amount1()) == 0, "OMR not netted");
        int256 nativeDelta = int256(buy.amount0()) + int256(sell.amount0());
        if (nativeDelta < 0) {
            manager.sync(Currency.wrap(address(0)));
            manager.settle{value: uint256(-nativeDelta)}();
        } else if (nativeDelta > 0) {
            manager.take(Currency.wrap(address(0)), address(this), uint256(nativeDelta));
        }
        return abi.encode(uint256(-int256(sell.amount1())));
    }

    receive() external payable {}
}

/// Executable limits of moving canonical swap revenue into OMR's existing transfer tax.
contract LPRevenueEnforcementV2Test is Test {
    IPoolManager private manager;
    OMR private token;
    PoolSwapTest private swaps;
    LPRevenueNettingFixtureV2 private netting;
    PoolKey private first;
    PoolKey private second;
    address[4] private recipients = [address(0xD), address(0xE), address(0xF), address(0x10)];

    receive() external payable {}

    function setUp() public {
        vm.deal(address(this), 10_000 ether);
        // Execute the pinned real PoolManager artifact, matching the other market suites.
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        token = new OMR(address(this));
        swaps = new PoolSwapTest(manager);
        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(manager);
        netting = new LPRevenueNettingFixtureV2(manager);
        first = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 500, 10, IHooks(address(0)));
        second = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(address(0)));
        manager.initialize(first, TickMath.getSqrtPriceAtTick(0));
        manager.initialize(second, TickMath.getSqrtPriceAtTick(0));
        token.approve(address(lp), type(uint256).max);
        token.approve(address(swaps), type(uint256).max);
        lp.modifyLiquidity{value: 2000 ether}(
            first, ModifyLiquidityParams(-887270, 887270, 1000 ether, bytes32(0)), ""
        );
        lp.modifyLiquidity{value: 2000 ether}(
            second, ModifyLiquidityParams(-887220, 887220, 1000 ether, bytes32(0)), ""
        );
        // Arm the existing 9% policy only after LP funding; no account is exempt.
        token.setTaxRecipients(recipients[0], recipients[1], recipients[2], recipients[3]);
        token.setSellTax(900, 200, 160, 240);
    }

    function test_unhookedSalePaysNoRevenueWhenPoolManagerIsUnregistered() public {
        assertEq(token.sellTaxBps(), 900);
        assertFalse(token.ammPairs(address(manager)));
        assertFalse(token.taxExempt(address(this)));
        uint256 beforeBalance = token.balanceOf(address(manager));
        BalanceDelta delta = swaps.swap(
            first, SwapParams(false, -int256(1 ether), TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), ""
        );
        assertEq(-int256(delta.amount1()), int256(1 ether), "real gross OMR sale");
        assertGt(delta.amount0(), 0, "seller receives ETH");
        assertEq(token.balanceOf(address(manager)) - beforeBalance, 1 ether);
        _assertNoRevenue();
    }

    function test_twoPoolNettingBypassesEvenRegisteredPoolManagerTransferTax() public {
        token.setPair(address(manager), true);
        assertFalse(token.taxExempt(address(netting)));
        uint256 beforeBalance = token.balanceOf(address(manager));
        uint256 grossSold = netting.roundTrip{value: 1 ether}(first, second, 1 ether);
        assertGt(grossSold, 0, "real gross OMR sale");
        assertGt(grossSold * token.sellTaxBps() / 10_000, 0, "a transfer would pay tax");
        assertEq(token.balanceOf(address(manager)), beforeBalance, "no OMR transfer to settle");
        assertEq(token.balanceOf(address(netting)), 0);
        _assertNoRevenue();
    }

    function test_registeredPoolManagerBreaksNormalRouterSettlement() public {
        token.setPair(address(manager), true);
        uint256 beforeBalance = token.balanceOf(address(manager));
        // Router sends gross debt, but OMR delivers only 91%; v4 rejects the unsettled debt.
        vm.expectRevert(IPoolManager.CurrencyNotSettled.selector);
        swaps.swap(
            first, SwapParams(false, -int256(1 ether), TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), ""
        );
        assertEq(token.balanceOf(address(manager)), beforeBalance, "entire swap rolled back");
        _assertNoRevenue();
    }

    function _assertNoRevenue() private view {
        for (uint256 i; i < recipients.length; ++i) {
            assertEq(token.balanceOf(recipients[i]), 0, "no OMR revenue");
            assertEq(recipients[i].balance, 0, "no ETH revenue");
        }
    }
}
