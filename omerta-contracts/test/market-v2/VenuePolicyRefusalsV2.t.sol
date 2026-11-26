// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {VenueNotAllowed} from "../../src/interfaces/IVenuePolicy.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";

contract RefusalPoolFixtureV2 {
    address public immutable token0;
    address public immutable token1;

    constructor(address first, address second) {
        token0 = first;
        token1 = second;
    }

    function approve(OmertaRestrictedOMRV2 token, address spender, uint256 amount) external {
        token.approve(spender, amount);
    }

    function transfer(OmertaRestrictedOMRV2 token, address to, uint256 amount) external {
        token.transfer(to, amount);
    }
}

contract RefusalRoleFixtureV2 {
    function transfer(OmertaRestrictedOMRV2 token, address to, uint256 amount) external {
        token.transfer(to, amount);
    }

    function transferFrom(OmertaRestrictedOMRV2 token, address from, address to, uint256 amount) external {
        token.transferFrom(from, to, amount);
    }
}

contract RefusalManagerFixtureV2 is RefusalRoleFixtureV2 {
    address public immutable omr;
    uint16 public constant TRADE_FEE_BPS = 400;
    bytes32 public constant revenuePolicyId = keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS");
    bool public constant settlementPoolConfigured = true;

    constructor(address token) {
        omr = token;
    }
}

contract RefusalHostileGetterV2 {
    uint256 private _writes;
    address private immutable _token;
    uint256 private immutable _mode;

    constructor(address token, uint256 mode) {
        _token = token;
        _mode = mode;
    }

    fallback() external {
        uint256 word = uint160(_token);
        uint256 mode = _mode;
        if (mode == 0) revert();
        if (mode == 4) {
            while (gasleft() > 100) { }
            revert();
        }
        if (mode == 5) ++_writes;
        if (msg.sig == 0xd21220a7 && mode != 8) word = 1;
        if (mode == 3) word |= uint256(1) << 200;
        assembly ("memory-safe") {
            mstore(0, word)
            switch mode
            case 1 { return(0, 31) }
            case 2 { return(0, 64) }
            case 6 { return(0, 65536) }
            default { return(0, 32) }
        }
    }

    function writes() external view returns (uint256) { return _writes; }
}

contract VenuePolicyRefusalsV2Test is Test {
    OmertaRestrictedOMRV2 private token;
    RefusalPoolFixtureV2 private pool;
    RefusalManagerFixtureV2 private manager;
    RefusalRoleFixtureV2 private input;
    RefusalRoleFixtureV2 private custody;
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);

    function setUp() public {
        token = new OmertaRestrictedOMRV2(address(this));
        pool = new RefusalPoolFixtureV2(address(0), address(token));
        manager = new RefusalManagerFixtureV2(address(token));
        input = new RefusalRoleFixtureV2();
        custody = new RefusalRoleFixtureV2();
        vm.prank(alice, alice);
        token.registerWallet(alice);
        vm.prank(bob, bob);
        token.registerWallet(bob);
    }

    function testInboundPoolRefusalUsesStandardErrorBeforeSeal() public {
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(pool), bytes32(0), true));
        token.transfer(address(pool), 1 ether);
        assertEq(token.balanceOf(address(pool)), 0);
        assertEq(token.balanceOf(address(this)), token.SUPPLY());
    }

    function testInboundPoolRefusalAfterSealPreservesAllowanceAndBalances() public {
        _seal();
        vm.prank(alice, alice);
        token.approve(address(input), 2 ether);
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(pool), bytes32(0), true));
        input.transferFrom(token, alice, address(pool), 1 ether);
        assertEq(token.allowance(alice, address(input)), 2 ether);
        assertEq(token.balanceOf(alice), 20 ether);
        assertEq(token.balanceOf(address(pool)), 0);
    }

    function testOutboundPoolRefusalUsesCorrectDirectionAndZeroPoolId() public {
        _seal();
        // Outbound is unreachable through supported funding paths; inject a balance to test refusal.
        deal(address(token), address(pool), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(pool), bytes32(0), false));
        pool.transfer(token, alice, 1 ether);
        assertEq(token.balanceOf(address(pool)), 1 ether);
        assertEq(token.balanceOf(alice), 20 ether);
    }

    function testWhenBothEndpointsArePoolsOutboundRefusalHasPrecedence() public {
        _seal();
        RefusalPoolFixtureV2 other = new RefusalPoolFixtureV2(address(token), address(9));
        deal(address(token), address(pool), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(pool), bytes32(0), false));
        pool.transfer(token, address(other), 1 ether);
        assertEq(token.balanceOf(address(other)), 0);
    }

    function testFuzzPoolTokenOrderingAndOtherAsset(address other, bool omrFirst) public {
        vm.assume(other != address(token));
        RefusalPoolFixtureV2 candidate = new RefusalPoolFixtureV2(
            omrFirst ? address(token) : other, omrFirst ? other : address(token)
        );
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(candidate), bytes32(0), true));
        token.transfer(address(candidate), 1);
        assertFalse(token.isRecipient(address(candidate)));
        assertFalse(token.venueAllowed(address(candidate), bytes32(0), true));
    }

    function testNonOmrAndDuplicateAssetPoolsKeepCustodyFailure() public {
        RefusalPoolFixtureV2 nonOmr = new RefusalPoolFixtureV2(address(1), address(2));
        RefusalPoolFixtureV2 duplicate = new RefusalPoolFixtureV2(address(token), address(token));
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer(address(nonOmr), 1);
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer(address(duplicate), 1);
    }

    function testFuzzHostileGettersCannotChangeAdmissionOrExhaustCallerGas(uint8 mode) public {
        mode = uint8(bound(mode, 0, 8));
        RefusalHostileGetterV2 hostile = new RefusalHostileGetterV2(address(token), mode);
        uint256 beforeGas = gasleft();
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer{gas: 150_000}(address(hostile), 1);
        assertLt(beforeGas - gasleft(), 120_000);
        assertEq(hostile.writes(), 0);
        assertFalse(token.isRecipient(address(hostile)));
        assertEq(token.balanceOf(address(hostile)), 0);
    }

    function testOrdinaryRegisteredWalletsKeepAuthorizationErrors() public {
        _seal();
        vm.prank(alice, alice);
        vm.expectRevert(OmertaRestrictedOMRV2.UnauthorizedTransfer.selector);
        token.transfer(bob, 1);
        vm.prank(alice, alice);
        token.approve(address(input), 1);
        vm.expectRevert(OmertaRestrictedOMRV2.UnauthorizedTransfer.selector);
        input.transferFrom(token, alice, bob, 1);
        assertEq(token.allowance(alice, address(input)), 1);
    }

    function testUnknownOrdinaryContractAndUnregisteredWalletKeepRecipientErrors() public {
        RefusalRoleFixtureV2 wallet = new RefusalRoleFixtureV2();
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer(address(wallet), 1);
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer(address(0xBAD), 1);
    }

    function testRegisteredWalletWithNewPoolShapedRuntimeKeepsRecipientError() public {
        vm.etch(alice, address(pool).code);
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer(alice, 1);
        assertFalse(token.isRecipient(alice));
    }

    function testConfiguredHolderWithChangedPoolShapedRuntimeKeepsRecipientError() public {
        RefusalRoleFixtureV2 holder = new RefusalRoleFixtureV2();
        token.setContractHolder(address(holder), address(holder).codehash);
        vm.etch(address(holder), address(pool).code);
        vm.expectRevert(OmertaRestrictedOMRV2.InvalidRecipient.selector);
        token.transfer(address(holder), 1);
        assertFalse(token.isRecipient(address(holder)));
    }

    function testOperatorWithChangedPoolShapedRuntimeKeepsAuthorizationError() public {
        _seal();
        vm.etch(address(custody), address(pool).code);
        vm.prank(address(custody));
        vm.expectRevert(OmertaRestrictedOMRV2.UnauthorizedTransfer.selector);
        token.transfer(alice, 1);
        assertFalse(token.isOperator(address(custody)));
    }

    function testPermitCannotBypassVenueRefusalOrConsumeAllowance() public {
        uint256 key = 0xA11CE;
        address holder = vm.addr(key);
        vm.prank(holder, holder);
        token.registerWallet(holder);
        _seal();
        custody.transfer(token, holder, 2 ether);
        uint256 deadline = block.timestamp + 1 days;
        bytes32 permitHash = keccak256(abi.encode(
            keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"),
            holder, address(input), 1 ether, token.nonces(holder), deadline
        ));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, keccak256(abi.encodePacked("\x19\x01", token.DOMAIN_SEPARATOR(), permitHash)));
        token.permit(holder, address(input), 1 ether, deadline, v, r, s);
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(pool), bytes32(0), true));
        input.transferFrom(token, holder, address(pool), 1 ether);
        assertEq(token.allowance(holder, address(input)), 1 ether);
        assertEq(token.balanceOf(holder), 2 ether);
    }

    function testSuccessfulCanonicalAndCustodyTransfersDoNotProbeRecipients() public {
        RefusalHostileGetterV2 holder = new RefusalHostileGetterV2(address(token), 5);
        token.setContractHolder(address(holder), address(holder).codehash);
        _seal();
        vm.prank(alice, alice);
        token.approve(address(input), 1 ether);
        input.transferFrom(token, alice, address(manager), 1 ether);
        vm.expectCall(address(holder), abi.encodeWithSelector(bytes4(0x0dfe1681)), uint64(0));
        vm.expectCall(address(holder), abi.encodeWithSelector(bytes4(0xd21220a7)), uint64(0));
        custody.transfer(token, address(holder), 1 ether);
        manager.transfer(token, bob, 1 ether);
        assertEq(token.balanceOf(address(manager)), 20 ether);
        assertEq(token.balanceOf(address(holder)), 1 ether);
        assertEq(token.balanceOf(bob), 1 ether);
        assertEq(holder.writes(), 0);
    }

    function testDelayedCustodyAdmissionDoesNotPublishAnotherVenue() public {
        _seal();
        RefusalRoleFixtureV2 module = new RefusalRoleFixtureV2();
        token.proposeOperator(address(module), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(module).codehash);
        vm.warp(block.timestamp + token.POLICY_UPDATE_DELAY());
        token.executeOperatorProposal(address(module));
        assertTrue(token.isOperator(address(module)));
        assertFalse(token.venueAllowed(address(module), bytes32(0), true));
        custody.transfer(token, address(module), 1 ether);
        vm.expectRevert(abi.encodeWithSelector(VenueNotAllowed.selector, address(pool), bytes32(0), true));
        module.transfer(token, address(pool), 1 ether);
        assertEq(token.balanceOf(address(module)), 1 ether);
    }

    function _seal() private {
        token.setOperator(address(input), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(input).codehash);
        token.setOperator(address(custody), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(custody).codehash);
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.sealPolicy();
        token.approve(address(custody), 100 ether);
        custody.transferFrom(token, address(this), address(custody), 100 ether);
        custody.transfer(token, alice, 20 ether);
        custody.transfer(token, address(manager), 20 ether);
    }
}
