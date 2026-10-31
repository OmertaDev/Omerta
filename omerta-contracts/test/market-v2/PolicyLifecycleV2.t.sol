// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {OmertaRestrictedOMRV2 as RestrictedOMR} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2 as Policy} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {RestrictedRoleProbeV2, RestrictedManagerPolicyMockV2} from "./RestrictedOMRV2.t.sol";

contract PolicyLifecycleV2Test is Test {
    RestrictedOMR token;
    RestrictedManagerPolicyMockV2 manager;
    RestrictedRoleProbeV2 custody;
    address alice = address(0xA11CE);

    function setUp() public {
        token = new RestrictedOMR(address(this));
        manager = new RestrictedManagerPolicyMockV2(address(token), 400, token.REVENUE_POLICY_ID());
        custody = new RestrictedRoleProbeV2();
        token.setOperator(address(custody), Policy.OperatorRole.ProtocolCustody, address(custody).codehash);
        token.bindSettlementManager(address(manager), address(manager).codehash);
        vm.prank(alice, alice);
        token.registerWallet(alice);
    }

    function testNewCustodyRequiresFullDelayAndPreservesOriginalSettlementPolicy() public {
        token.sealPolicy();
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        (Policy.OperatorRole role, bytes32 runtimeHash, uint64 executableAt) =
            token.operatorProposal(address(candidate));
        assertEq(uint8(role), uint8(Policy.OperatorRole.ProtocolCustody));
        assertEq(runtimeHash, address(candidate).codehash);
        assertEq(executableAt, vm.getBlockTimestamp() + 7 days);
        assertEq(token.pendingPolicyUpdates(), 1);
        assertFalse(token.isOperator(address(candidate)));
        vm.warp(executableAt - 1);
        vm.expectRevert(RestrictedOMR.PolicyUpdateNotReady.selector);
        token.executeOperatorProposal(address(candidate));
        vm.warp(executableAt);
        vm.prank(alice);
        token.executeOperatorProposal(address(candidate));
        assertEq(token.pendingPolicyUpdates(), 0);
        assertTrue(token.isOperator(address(candidate)));
        assertEq(token.operatorAt(2), address(candidate));
        assertEq(token.operatorCount(), 3);
        assertEq(token.settlementManager(), address(manager));
        assertEq(token.operatorRuntimeHash(address(manager)), address(manager).codehash);
        token.approve(address(candidate), 2 ether);
        candidate.transferFrom(token, address(this), address(candidate), 2 ether);
        candidate.transfer(token, alice, 1 ether);
        assertEq(token.balanceOf(alice), 1 ether);
        assertEq(token.totalSupply(), token.SUPPLY());
        vm.expectRevert(RestrictedOMR.PolicyUpdateNotReady.selector);
        token.executeOperatorProposal(address(candidate));
    }

    function testNewInputRetainsTransferRoleRestrictions() public {
        token.sealPolicy();
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        token.proposeOperator(address(candidate), Policy.OperatorRole.SettlementInput, address(candidate).codehash);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        token.executeOperatorProposal(address(candidate));
        token.approve(address(candidate), 2 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        candidate.transferFrom(token, address(this), alice, 1 ether);
        candidate.transferFrom(token, address(this), address(manager), 1 ether);
        assertEq(token.balanceOf(address(manager)), 1 ether);
    }

    function testReceivingOnlyAdditionCannotGainTransferAuthority() public {
        token.sealPolicy();
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        token.proposeContractHolder(address(holder), address(holder).codehash);
        assertFalse(token.isRecipient(address(holder)));
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeOperator(address(holder), Policy.OperatorRole.ProtocolCustody, address(holder).codehash);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        token.executeContractHolderProposal(address(holder));
        assertTrue(token.isRecipient(address(holder)));
        assertFalse(token.isOperator(address(holder)));
        assertEq(token.contractHolderAt(0), address(holder));
        token.approve(address(custody), 2 ether);
        custody.transferFrom(token, address(this), address(custody), 2 ether);
        custody.transfer(token, address(holder), 1 ether);
        vm.expectRevert(RestrictedOMR.UnauthorizedTransfer.selector);
        holder.transfer(token, alice, 1 ether);
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeOperator(address(holder), Policy.OperatorRole.ProtocolCustody, address(holder).codehash);
        assertEq(token.pendingPolicyUpdates(), 0);
    }

    function testProposalReplacementRestartsDelayAndCancellationRemovesAuthority() public {
        token.sealPolicy();
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        token.proposeOperator(address(candidate), Policy.OperatorRole.SettlementInput, address(candidate).codehash);
        token.proposeContractHolder(address(holder), address(holder).codehash);
        assertEq(token.pendingPolicyUpdates(), 2);
        uint256 firstProposalAt = vm.getBlockTimestamp();
        vm.warp(firstProposalAt + 1 days);
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        assertEq(token.pendingPolicyUpdates(), 2);
        (,, uint64 replacementReadyAt) = token.operatorProposal(address(candidate));
        assertEq(replacementReadyAt, firstProposalAt + 8 days);
        vm.warp(firstProposalAt + 7 days);
        vm.expectRevert(RestrictedOMR.PolicyUpdateNotReady.selector);
        token.executeOperatorProposal(address(candidate));
        token.cancelOperatorProposal(address(candidate));
        token.cancelContractHolderProposal(address(holder));
        assertEq(token.pendingPolicyUpdates(), 0);
        vm.warp(firstProposalAt + 30 days);
        vm.expectRevert(RestrictedOMR.PolicyUpdateNotReady.selector);
        token.executeOperatorProposal(address(candidate));
        vm.expectRevert(RestrictedOMR.PolicyUpdateNotReady.selector);
        token.executeContractHolderProposal(address(holder));
        assertFalse(token.isOperator(address(candidate)));
    }

    function testExecutionRechecksLiveRuntimeForBothProposalTypes() public {
        token.sealPolicy();
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        bytes memory runtime = address(candidate).code;
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        token.proposeContractHolder(address(holder), address(holder).codehash);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.etch(address(candidate), hex"00");
        vm.etch(address(holder), hex"00");
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.executeOperatorProposal(address(candidate));
        vm.expectRevert(RestrictedOMR.InvalidRuntimeHash.selector);
        token.executeContractHolderProposal(address(holder));
        assertEq(token.pendingPolicyUpdates(), 2);
        vm.etch(address(candidate), runtime);
        vm.etch(address(holder), runtime);
        token.executeOperatorProposal(address(candidate));
        token.executeContractHolderProposal(address(holder));
        assertEq(token.pendingPolicyUpdates(), 0);
    }

    function testExistingRolesHashesManagerAndGenesisCannotBeReplaced() public {
        RestrictedRoleProbeV2 holder = new RestrictedRoleProbeV2();
        token.setContractHolder(address(holder), address(holder).codehash);
        token.sealPolicy();
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeOperator(address(custody), Policy.OperatorRole.SettlementInput, address(custody).codehash);
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeOperator(address(manager), Policy.OperatorRole.None, bytes32(0));
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeOperator(address(this), Policy.OperatorRole.ProtocolCustody, address(this).codehash);
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeContractHolder(address(holder), address(holder).codehash);
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeContractHolder(address(custody), address(custody).codehash);
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.proposeOperator(address(candidate), Policy.OperatorRole.SettlementManager, address(candidate).codehash);
        assertEq(token.pendingPolicyUpdates(), 0);
    }

    function testOnlyOriginalGovernanceCanPublishOrCancelAndOwnershipChangeStopsExecution() public {
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        vm.expectRevert(RestrictedOMR.PolicyNotSealed.selector);
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        token.sealPolicy();
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, alice));
        token.cancelOperatorProposal(address(candidate));
        token.transferOwnership(alice);
        vm.prank(alice);
        token.acceptOwnership();
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.expectRevert(RestrictedOMR.InvalidPolicyUpdate.selector);
        token.executeOperatorProposal(address(candidate));
    }

    function testFuzzCannotExecuteBeforeDelay(uint32 elapsed) public {
        elapsed = uint32(bound(elapsed, 0, 7 days - 1));
        token.sealPolicy();
        RestrictedRoleProbeV2 candidate = new RestrictedRoleProbeV2();
        token.proposeOperator(address(candidate), Policy.OperatorRole.ProtocolCustody, address(candidate).codehash);
        vm.warp(vm.getBlockTimestamp() + elapsed);
        vm.expectRevert(RestrictedOMR.PolicyUpdateNotReady.selector);
        token.executeOperatorProposal(address(candidate));
        assertEq(token.pendingPolicyUpdates(), 1);
    }
}
