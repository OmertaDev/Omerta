// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {OmertaRestrictedOMRV2 as RestrictedOMR} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2 as Policy} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {RestrictedRoleProbeV2, RestrictedManagerPolicyMockV2} from "./RestrictedOMRV2.t.sol";

contract PolicyLifecycleHandlerV2 is Test {
    RestrictedOMR public immutable token;
    address public immutable safe;
    address[4] public candidates;
    mapping(address => Policy.OperatorRole) public admittedRole;
    mapping(address => bytes32) public admittedHash;

    constructor(RestrictedOMR token_, address safe_) {
        token = token_;
        safe = safe_;
        for (uint256 i; i < candidates.length; ++i) {
            candidates[i] = address(new RestrictedRoleProbeV2());
        }
    }

    function propose(uint8 seed, bool holder, bool custody) external {
        address candidate = candidates[seed % candidates.length];
        vm.prank(safe);
        if (holder) {
            try token.proposeContractHolder(candidate, candidate.codehash) {} catch {}
        } else {
            try token.proposeOperator(
                candidate,
                custody ? Policy.OperatorRole.ProtocolCustody : Policy.OperatorRole.SettlementInput,
                candidate.codehash
            ) {}
                catch {}
        }
    }

    function cancel(uint8 seed, bool holder) external {
        address candidate = candidates[seed % candidates.length];
        vm.prank(safe);
        if (holder) {
            try token.cancelContractHolderProposal(candidate) {} catch {}
        } else {
            try token.cancelOperatorProposal(candidate) {} catch {}
        }
    }

    function execute(uint8 seed, bool holder) external {
        address candidate = candidates[seed % candidates.length];
        if (holder) {
            try token.executeContractHolderProposal(candidate) {
                admittedHash[candidate] = token.contractHolderRuntimeHash(candidate);
            } catch {}
        } else {
            try token.executeOperatorProposal(candidate) {
                admittedRole[candidate] = token.operatorRole(candidate);
                admittedHash[candidate] = token.operatorRuntimeHash(candidate);
            } catch {}
        }
    }

    function advance(uint32 seconds_) external {
        vm.warp(vm.getBlockTimestamp() + bound(seconds_, 0, 8 days));
    }
}

contract PolicyLifecycleInvariantV2Test is Test {
    RestrictedOMR token;
    RestrictedManagerPolicyMockV2 manager;
    PolicyLifecycleHandlerV2 handler;

    function setUp() public {
        token = new RestrictedOMR(address(this));
        manager = new RestrictedManagerPolicyMockV2(address(token), 400, token.REVENUE_POLICY_ID());
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.sealPolicy();
        handler = new PolicyLifecycleHandlerV2(token, address(this));
        targetContract(address(handler));
    }

    function invariantPendingCountMatchesLiveProposalsAndAdmissionsRemainImmutable() public view {
        uint256 pending;
        for (uint256 i; i < 4; ++i) {
            address candidate = handler.candidates(i);
            (,, uint64 operatorAt) = token.operatorProposal(candidate);
            (, uint64 holderAt) = token.contractHolderProposal(candidate);
            if (operatorAt != 0) ++pending;
            if (holderAt != 0) ++pending;
            assertTrue(operatorAt == 0 || holderAt == 0);
            bytes32 admittedHash = handler.admittedHash(candidate);
            if (admittedHash != bytes32(0)) {
                Policy.OperatorRole role = handler.admittedRole(candidate);
                assertEq(uint8(token.operatorRole(candidate)), uint8(role));
                if (role == Policy.OperatorRole.None) {
                    assertEq(token.contractHolderRuntimeHash(candidate), admittedHash);
                    assertFalse(token.isOperator(candidate));
                } else {
                    assertEq(token.operatorRuntimeHash(candidate), admittedHash);
                }
            }
        }
        assertEq(token.pendingPolicyUpdates(), pending);
        assertEq(token.settlementManager(), address(manager));
        assertEq(token.operatorRuntimeHash(address(manager)), address(manager).codehash);
        assertEq(token.totalSupply(), token.SUPPLY());
    }
}
