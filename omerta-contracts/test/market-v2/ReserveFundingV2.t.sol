// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {StabilityV2Fixture} from "./StabilityV2.t.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {OmertaReserveFundingV2 as Funding} from "../../src/market-v2/OmertaReserveFundingV2.sol";
import {IOmertaRestrictedOMRV2 as Policy} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";

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

    function testFundingBindingRejectsItselfAndCanStillBindTheActualController() public {
        Funding second = new Funding(safe, token, CORE);
        vm.prank(safe);
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        second.bindController(Controller(payable(address(second))));
        assertEq(address(second.controller()), address(0));
        vm.prank(safe);
        second.bindController(controller);
        assertEq(address(second.controller()), address(controller));
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

    function _admit(Controller candidate, bool admitted) private {
        // This fixture uses the unrestricted OMR test token. The full restricted-token admission
        // and successor flow is exercised without mocks in PolicyLifecycleIntegrationV2Test.
        vm.mockCall(address(token), abi.encodeCall(Policy.policySealed, ()), abi.encode(true));
        vm.mockCall(address(token), abi.encodeCall(Policy.isOperator, (address(candidate))), abi.encode(admitted));
        vm.mockCall(
            address(token),
            abi.encodeCall(Policy.operatorRole, (address(candidate))),
            abi.encode(Policy.OperatorRole.ProtocolCustody)
        );
    }

    function testSuccessorFlushesPendingAssetsToOldControllerWithoutResettingBudgets() public {
        Controller candidate = new Controller(_config(recipient));
        _admit(candidate, true);
        Controller.Account memory oldBefore = controller.account(RESERVE);
        vm.prank(safe);
        funding.proposeController(candidate, address(candidate).codehash);
        vm.expectRevert(Funding.ControllerUpdateNotReady.selector);
        funding.executeControllerProposal();
        vm.deal(address(funding), 2 ether);
        token.transfer(address(funding), 3 ether);
        vm.warp(funding.controllerExecutableAt());
        vm.prank(address(0xBAD));
        funding.executeControllerProposal();
        Controller.Account memory oldAfter = controller.account(RESERVE);
        assertEq(address(funding.controller()), address(candidate));
        assertEq(oldAfter.idleNative - oldBefore.idleNative, 2 ether);
        assertEq(oldAfter.idleOmr - oldBefore.idleOmr, 3 ether);
        assertEq(oldAfter.nativeCapacity, oldBefore.nativeCapacity);
        assertEq(oldAfter.omrCapacity, oldBefore.omrCapacity);
        assertEq(oldAfter.nativeDeployed, oldBefore.nativeDeployed);
        assertEq(oldAfter.omrDeployed, oldBefore.omrDeployed);
        assertEq(candidate.account(RESERVE).idleNative, 0);
        assertEq(address(funding.pendingController()), address(0));
        assertEq(funding.controllerExecutableAt(), 0);
        vm.deal(address(funding), 1 ether);
        funding.flush();
        assertEq(candidate.account(RESERVE).idleNative, 1 ether);
        assertEq(controller.account(RESERVE).idleNative, oldAfter.idleNative);
    }

    function testSuccessorChecksRuntimeAdmissionAuthorityAndPreservesOldRouteOnFailure() public {
        Controller candidate = new Controller(_config(recipient));
        vm.expectRevert(Funding.Unauthorized.selector);
        funding.proposeController(candidate, address(candidate).codehash);
        vm.prank(safe);
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        funding.proposeController(candidate, bytes32(uint256(1)));
        vm.prank(safe);
        funding.proposeController(candidate, address(candidate).codehash);
        _admit(candidate, false);
        vm.warp(funding.controllerExecutableAt());
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        funding.executeControllerProposal();
        assertEq(address(funding.controller()), address(controller));
        _admit(candidate, true);
        bytes memory runtime = address(candidate).code;
        vm.etch(address(candidate), hex"00");
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        funding.executeControllerProposal();
        vm.etch(address(candidate), runtime);
        funding.executeControllerProposal();
        assertEq(address(funding.controller()), address(candidate));
    }

    function testSuccessorRejectsChangingMarketPoolOrFeeBeneficiary() public {
        Controller.Config memory c = _config(recipient);
        c.feeRecipients[5] = address(0xDEAD);
        Controller candidate = new Controller(c);
        vm.prank(safe);
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        funding.proposeController(candidate, address(candidate).codehash);
        c = _config(recipient);
        c.marketState = controller.marketState();
        c.key.fee += 1;
        candidate = new Controller(c);
        vm.prank(safe);
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        funding.proposeController(candidate, address(candidate).codehash);
    }

    function testSuccessorProposalReplacementRestartsDelayAndCancellationIsOwnerOnly() public {
        Controller candidate = new Controller(_config(recipient));
        vm.prank(safe);
        funding.proposeController(candidate, address(candidate).codehash);
        uint64 originalReadyAt = funding.controllerExecutableAt();
        vm.warp(vm.getBlockTimestamp() + 1 days);
        vm.prank(safe);
        funding.proposeController(candidate, address(candidate).codehash);
        assertEq(funding.controllerExecutableAt(), originalReadyAt + 1 days);
        vm.warp(originalReadyAt);
        vm.expectRevert(Funding.ControllerUpdateNotReady.selector);
        funding.executeControllerProposal();
        vm.expectRevert(Funding.Unauthorized.selector);
        funding.cancelControllerProposal();
        vm.prank(safe);
        funding.cancelControllerProposal();
        vm.warp(originalReadyAt + 10 days);
        vm.expectRevert(Funding.ControllerUpdateNotReady.selector);
        funding.executeControllerProposal();
        assertEq(address(funding.controller()), address(controller));
    }

    function testOldControllerFlushFailureRollsBackSuccessorSwitchAndAllAccounting() public {
        Controller candidate = new Controller(_config(recipient));
        _admit(candidate, true);
        vm.prank(safe);
        funding.proposeController(candidate, address(candidate).codehash);
        vm.deal(address(funding), 1 ether);
        vm.mockCallRevert(address(controller), abi.encodeCall(Controller.fund, (RESERVE, 0)), bytes("old fund failed"));
        vm.warp(funding.controllerExecutableAt());
        vm.expectRevert(bytes("old fund failed"));
        funding.executeControllerProposal();
        assertEq(address(funding.controller()), address(controller));
        assertEq(address(funding.pendingController()), address(candidate));
        assertEq(address(funding).balance, 1 ether);
        assertEq(funding.totalNativeFunded(), 0);
        assertEq(candidate.account(RESERVE).idleNative, 0);
    }

    function testInputOnlyAdmissionCannotReceiveFundingRoute() public {
        Controller candidate = new Controller(_config(recipient));
        _admit(candidate, true);
        vm.mockCall(
            address(token),
            abi.encodeCall(Policy.operatorRole, (address(candidate))),
            abi.encode(Policy.OperatorRole.SettlementInput)
        );
        vm.prank(safe);
        funding.proposeController(candidate, address(candidate).codehash);
        vm.warp(funding.controllerExecutableAt());
        vm.expectRevert(Funding.InvalidConfiguration.selector);
        funding.executeControllerProposal();
        assertEq(address(funding.controller()), address(controller));
    }
}
