// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {OMR} from "../../src/OMR.sol";
import {OmertaHook} from "../../src/OmertaHook.sol";
import {OmertaArbitrageV2} from "../../src/market-v2/OmertaArbitrageV2.sol";

contract ArbitrageV2Test is Test {
    using PoolIdLibrary for PoolKey;
    IPoolManager manager;
    OMR token;
    OmertaHook hook;
    PoolModifyLiquidityTest lp;
    OmertaArbitrageV2 arb;
    PoolKey canonical;
    PoolKey alternative;
    address solver = address(0x501);
    address reserve = address(0x502);

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.roll(100);
        vm.deal(address(this), 100_000 ether);
        vm.deal(solver, 100 ether);
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        token = new OMR(address(this));
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        address deployed = address(uint160(0xBEEF << 144) | flags);
        deployCodeTo(
            "OmertaHook.sol:OmertaHook", abi.encode(manager, address(token), address(this), address(this)), deployed
        );
        hook = OmertaHook(payable(deployed));
        hook.setRecipients(address(0xD), address(0xE), address(0xF), address(0x10));
        hook.setAllowedQuote(Currency.wrap(address(0)), true);
        hook.setSellTax(900, 200, 160, 240);
        canonical = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(deployed));
        alternative = PoolKey(canonical.currency0, canonical.currency1, 500, 10, IHooks(address(0)));
        manager.initialize(canonical, TickMath.getSqrtPriceAtTick(0));
        manager.initialize(alternative, TickMath.getSqrtPriceAtTick(-10_000));
        lp = new PoolModifyLiquidityTest(manager);
        token.approve(address(lp), type(uint256).max);
        lp.modifyLiquidity{value: 10_000 ether}(
            canonical, ModifyLiquidityParams(-887220, 887220, 1_000 ether, bytes32(0)), ""
        );
        lp.modifyLiquidity{value: 10_000 ether}(
            alternative, ModifyLiquidityParams(-887270, 887270, 1_000 ether, bytes32(0)), ""
        );
        arb = new OmertaArbitrageV2(manager, canonical, reserve, 2000, 10 ether);
    }

    function _plan() internal view returns (OmertaArbitrageV2.Plan memory p) {
        p = OmertaArbitrageV2.Plan(
            alternative, true, uint128(1 ether), 1, uint64(block.timestamp + 120), bytes32(uint256(7))
        );
    }

    function _commit(address who, OmertaArbitrageV2.Plan memory p) internal {
        bytes32 h = arb.hashPlan(who, p);
        vm.prank(who);
        arb.commit(h);
        vm.roll(block.number + 1);
    }

    function testRealTwoPoolCycleSharesOnlyRealizedProfitAndReturnsCollateral() public {
        OmertaArbitrageV2.Plan memory p = _plan();
        uint256 poolBefore = address(manager).balance;
        uint256 solverBefore = solver.balance;
        _commit(solver, p);
        vm.prank(solver);
        uint256 profit = arb.execute{value: p.amount}(p);
        assertGt(profit, 0);
        assertEq(poolBefore - address(manager).balance, profit);
        assertEq(arb.totalClaimable(), p.amount + profit);
        assertEq(address(arb).balance, arb.totalClaimable());
        assertEq(arb.claimable(reserve), profit / 5);
        vm.prank(solver);
        arb.claim(payable(solver));
        assertEq(solver.balance, solverBefore + profit - profit / 5);
        vm.prank(reserve);
        arb.claim(payable(reserve));
        assertEq(address(arb).balance, 0);
    }

    function testCanonicalSellStillPaysExistingFundingTax() public {
        PoolKey memory cheap = PoolKey(canonical.currency0, canonical.currency1, 1000, 20, IHooks(address(0)));
        manager.initialize(cheap, TickMath.getSqrtPriceAtTick(10_000));
        lp.modifyLiquidity{value: 10_000 ether}(
            cheap, ModifyLiquidityParams(-887260, 887260, 1_000 ether, bytes32(0)), ""
        );
        OmertaArbitrageV2.Plan memory p = _plan();
        p.alternative = cheap;
        p.canonicalFirst = false;
        _commit(solver, p);
        vm.prank(solver);
        arb.execute{value: p.amount}(p);
        (uint256 dev, uint256 rwa, uint256 community, uint256 pol) = hook.owed(canonical.currency0);
        assertGt(dev, 0);
        assertGt(rwa, 0);
        assertGt(community, 0);
        assertGt(pol, 0);
        assertEq(address(arb).balance, arb.totalClaimable());
    }

    function testPermissionlessClaimForCannotRedirectAnotherBeneficiary() public {
        OmertaArbitrageV2.Plan memory p = _plan();
        _commit(solver, p);
        vm.prank(solver);
        uint256 profit = arb.execute{value: p.amount}(p);
        uint256 reserveBefore = reserve.balance;
        uint256 attackerBefore = address(0xBAD).balance;
        vm.prank(address(0xBAD));
        arb.claimFor(payable(reserve));
        assertEq(reserve.balance - reserveBefore, profit / 5);
        assertEq(address(0xBAD).balance, attackerBefore);
        assertEq(arb.claimable(reserve), 0);
        assertEq(address(arb).balance, arb.totalClaimable());
    }

    function testUnprofitableOrBelowMinimumCycleRevertsBothSwapsAndKeepsCommitment() public {
        OmertaArbitrageV2.Plan memory p = _plan();
        p.minimumProfit = uint128(100 ether);
        _commit(solver, p);
        (uint160 beforePrice,,,) = StateLibrary.getSlot0(manager, canonical.toId());
        uint256 beforeBalance = solver.balance;
        vm.prank(solver);
        vm.expectRevert(OmertaArbitrageV2.InsufficientProfit.selector);
        arb.execute{value: p.amount}(p);
        (uint160 afterPrice,,,) = StateLibrary.getSlot0(manager, canonical.toId());
        assertEq(beforePrice, afterPrice);
        assertEq(solver.balance, beforeBalance);
        (bytes32 h,) = arb.commitments(solver);
        assertEq(h, arb.hashPlan(solver, p));
        assertEq(arb.totalClaimable(), 0);
    }

    function testCopiedCommitmentCannotClaimAnotherSolversCycle() public {
        OmertaArbitrageV2.Plan memory p = _plan();
        _commit(solver, p);
        address copier = address(0xBAD);
        vm.deal(copier, 2 ether);
        bytes32 h = arb.hashPlan(solver, p);
        vm.prank(copier);
        arb.commit(h);
        vm.roll(block.number + 1);
        vm.prank(copier);
        vm.expectRevert(OmertaArbitrageV2.InvalidCommitment.selector);
        arb.execute{value: p.amount}(p);
    }

    function testSameBlockRevealRejected() public {
        OmertaArbitrageV2.Plan memory p = _plan();
        bytes32 h = arb.hashPlan(solver, p);
        vm.prank(solver);
        arb.commit(h);
        vm.prank(solver);
        vm.expectRevert(OmertaArbitrageV2.InvalidCommitment.selector);
        arb.execute{value: p.amount}(p);
    }

    function testForgedCallbackRejected() public {
        vm.expectRevert(OmertaArbitrageV2.InvalidCallback.selector);
        arb.unlockCallback(abi.encode(_plan()));
    }

    function testFuzzProfitCreditsConserveNative(uint96 input) public {
        OmertaArbitrageV2.Plan memory p = _plan();
        p.amount = uint128(bound(input, 0.00001 ether, 9 ether));
        _commit(solver, p);
        vm.prank(solver);
        uint256 profit = arb.execute{value: p.amount}(p);
        assertEq(arb.claimable(solver) + arb.claimable(reserve), p.amount + profit);
        assertEq(address(arb).balance, arb.totalClaimable());
        assertEq(token.balanceOf(address(arb)), 0);
    }

    receive() external payable {}
}
