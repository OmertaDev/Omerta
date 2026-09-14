// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StabilityV2Fixture} from "./StabilityV2.t.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {OmertaReserveFundingV2 as Funding} from "../../src/market-v2/OmertaReserveFundingV2.sol";

contract ReserveFundingV2Test is StabilityV2Fixture {
    Funding funding;

    function setUp() public override {
        super.setUp();
        funding = new Funding(safe, token, RESERVE);
        vm.prank(safe);
        funding.bindController(controller);
    }

    function testReserveFlushConservesActualAssetsAndCannotResetCapacity() public {
        Controller.Account memory beforeA = controller.account(RESERVE);
        (bool ok,) = address(funding).call{value: 2 ether}("");
        assertTrue(ok);
        token.transfer(address(funding), 3 ether);
        vm.prank(address(0xBAD));
        funding.flush();
        Controller.Account memory afterA = controller.account(RESERVE);
        assertEq(afterA.idleNative - beforeA.idleNative, 2 ether);
        assertEq(afterA.idleOmr - beforeA.idleOmr, 3 ether);
        assertEq(afterA.nativeCapacity, beforeA.nativeCapacity);
        assertEq(afterA.omrCapacity, beforeA.omrCapacity);
        assertEq(funding.totalNativeFunded(), 2 ether);
        assertEq(funding.totalOmrFunded(), 3 ether);
        assertEq(address(funding).balance, 0);
        assertEq(token.balanceOf(address(funding)), 0);
        assertEq(token.allowance(address(funding), address(controller)), 0);
        funding.flush();
        _assertCustody();
    }

    function testFundingBindingIsOwnerOnlyOneTimeAndChecksSafe() public {
        Funding second = new Funding(safe, token, CORE);
        vm.expectRevert(Funding.Unauthorized.selector);
        second.bindController(controller);
        Controller.Config memory c = _config(recipient);
        c.safe = address(0x999);
        Controller foreign = new Controller(c);
        vm.prank(safe);
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        second.bindController(foreign);
        vm.prank(safe);
        second.bindController(controller);
        vm.prank(safe);
        vm.expectRevert(Funding.AlreadyBound.selector);
        second.bindController(controller);
    }

    function testFundingCanAccumulateBeforeBindingAndFlushWhileStrategyPaused() public {
        Funding second = new Funding(safe, token, CORE);
        (bool ok,) = address(second).call{value: 1 ether}("");
        assertTrue(ok);
        vm.expectRevert(Funding.Unbound.selector);
        second.flush();
        vm.prank(safe);
        second.bindController(controller);
        vm.prank(safe);
        controller.setPaused(true);
        second.flush();
        assertEq(controller.account(CORE).idleNative, 11 ether);
        _assertCustody();
    }
}
