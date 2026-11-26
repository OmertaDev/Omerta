// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {IVenuePolicy, VenueNotAllowed} from "../../src/interfaces/IVenuePolicy.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";

contract VenuePolicyManagerFixtureV2 {
    address public immutable omr;
    uint16 public constant TRADE_FEE_BPS = 400;
    bytes32 public constant revenuePolicyId = keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS");
    bool public settlementPoolConfigured;

    constructor(address token) {
        omr = token;
    }

    function configurePool() external {
        settlementPoolConfigured = true;
    }
}

contract VenuePolicyCustodyFixtureV2 {
    function deposit(IOmertaRestrictedOMRV2 token, address from, uint256 amount) external {
        token.transferFrom(from, address(this), amount);
    }
}

contract VenuePolicyV2Test is Test {
    OmertaRestrictedOMRV2 private token;
    VenuePolicyManagerFixtureV2 private manager;

    function setUp() public {
        token = new OmertaRestrictedOMRV2(address(this));
        manager = new VenuePolicyManagerFixtureV2(address(token));
    }

    function testPinnedInterfaceAndInvalidInterfaceDetection() public view {
        assertEq(type(IVenuePolicy).interfaceId, bytes4(0xfc300520), "pinned Discussion ABI");
        assertEq(VenueNotAllowed.selector, bytes4(0x99b6a9eb), "pinned refusal ABI");
        assertTrue(token.supportsInterface(0xfc300520));
        assertTrue(token.supportsInterface(type(IERC165).interfaceId));
        assertFalse(token.supportsInterface(0xffffffff));
        assertFalse(token.supportsInterface(0x00000000));
    }

    function testUnboundPolicyDisallowsAllVenues() public view {
        assertEq(uint8(token.venueEnforcement()), uint8(IVenuePolicy.VenueEnforcement.Enforced));
        assertEq(token.canonicalPools().length, 0);
        (bool inboundRestricted, bool outboundRestricted, IVenuePolicy.ExternalVenue[] memory allowed) =
            token.externalVenues();
        assertTrue(inboundRestricted);
        assertTrue(outboundRestricted);
        assertEq(allowed.length, 0);
        assertFalse(token.venueAllowed(address(0), bytes32(0), true));
        assertFalse(token.venueAllowed(address(manager), bytes32(0), false));
    }

    function testBindingPublishesBothDirectionsAndInvalidatesCaches() public {
        vm.recordLogs();
        token.bindSettlementManager(address(manager), address(manager).codehash);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        assertEq(logs.length, 5);
        assertEq(logs[2].emitter, address(token));
        assertEq(logs[2].topics[0], keccak256("ExternalVenuesChanged()"));
        for (uint256 i; i < 2; ++i) {
            Vm.Log memory entry = logs[3 + i];
            assertEq(entry.emitter, address(token));
            assertEq(entry.topics[0], keccak256("VenueStatusChanged(address,bytes32,bool,bool)"));
            assertEq(entry.topics[1], bytes32(uint256(uint160(address(manager)))));
            assertEq(entry.topics[2], bytes32(0));
            (bool inbound, bool permitted) = abi.decode(entry.data, (bool, bool));
            assertEq(inbound, i == 0);
            assertTrue(permitted);
        }
        _assertBoundPolicy();
    }

    function testFuzzBulkAndPointPermissionsAgree(address venue, bytes32 poolId, bool inbound) public {
        token.bindSettlementManager(address(manager), address(manager).codehash);
        (,, IVenuePolicy.ExternalVenue[] memory allowed) = token.externalVenues();
        bool member;
        for (uint256 i; i < allowed.length; ++i) {
            if (allowed[i].venue == venue) member = inbound ? allowed[i].inbound : allowed[i].outbound;
        }
        assertEq(token.venueAllowed(venue, bytes32(0), inbound), member);
        if (poolId != bytes32(0)) assertFalse(token.venueAllowed(venue, poolId, inbound));
        assertEq(token.canonicalPools().length, 0, "never resolve custom keys against official manager");
    }

    function testPermissionDoesNotGrantExecutionAuthorization() public {
        token.bindSettlementManager(address(manager), address(manager).codehash);
        assertTrue(token.venueAllowed(address(manager), bytes32(0), true));
        manager.configurePool();
        token.sealPolicy();
        vm.expectRevert(OmertaRestrictedOMRV2.UnauthorizedTransfer.selector);
        token.transfer(address(manager), 1 ether);
        assertEq(token.balanceOf(address(manager)), 0);
        _assertBoundPolicy();
    }

    function testSealRequiresConfiguredPoolAndCannotBeRetriedAfterSealing() public {
        token.bindSettlementManager(address(manager), address(manager).codehash);
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidSettlementManager.selector);
        token.sealPolicy();
        manager.configurePool();
        token.sealPolicy();
        vm.expectRevert(OmertaRestrictedOMRV2.PolicySealed.selector);
        token.sealPolicy();
        _assertBoundPolicy();
    }

    function testDeclaredPolicyDoesNotDriftWithRuntimeAuthorization() public {
        token.bindSettlementManager(address(manager), address(manager).codehash);
        manager.configurePool();
        token.sealPolicy();
        vm.etch(address(manager), hex"00");
        assertFalse(token.isOperator(address(manager)));
        assertTrue(token.venueAllowed(address(manager), bytes32(0), true));
        assertTrue(token.venueAllowed(address(manager), bytes32(0), false));
        _assertBoundPolicy();
    }

    function testCustodyAdmissionNeverAddsAnotherLiquidityVenue() public {
        token.bindSettlementManager(address(manager), address(manager).codehash);
        manager.configurePool();
        token.sealPolicy();
        VenuePolicyCustodyFixtureV2 custody = new VenuePolicyCustodyFixtureV2();
        token.proposeOperator(
            address(custody), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(custody).codehash
        );
        vm.warp(block.timestamp + token.POLICY_UPDATE_DELAY());
        token.executeOperatorProposal(address(custody));
        assertTrue(token.isOperator(address(custody)));
        assertFalse(token.venueAllowed(address(custody), bytes32(0), true));
        assertFalse(token.venueAllowed(address(custody), bytes32(0), false));
        _assertBoundPolicy();
    }

    function _assertBoundPolicy() private view {
        (bool inboundRestricted, bool outboundRestricted, IVenuePolicy.ExternalVenue[] memory allowed) =
            token.externalVenues();
        assertTrue(inboundRestricted);
        assertTrue(outboundRestricted);
        assertEq(allowed.length, 1);
        assertEq(allowed[0].venue, address(manager));
        assertTrue(allowed[0].inbound);
        assertTrue(allowed[0].outbound);
        assertTrue(token.venueAllowed(address(manager), bytes32(0), true));
        assertTrue(token.venueAllowed(address(manager), bytes32(0), false));
        assertFalse(token.venueAllowed(address(manager), bytes32(uint256(1)), true));
    }
}
