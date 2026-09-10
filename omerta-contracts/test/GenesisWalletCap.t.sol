// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {GenesisWalletCap, IGenesisCapController, IGenesisBidValidation} from "../src/GenesisWalletCap.sol";

contract CapControllerMock is IGenesisCapController {
    address public auction;
    bytes32 public auctionCodeHash;
    function bind(address a) external { require(auction == address(0)); auction = a; auctionCodeHash = a.codehash; }
}

contract CapAuctionMock {
    GenesisWalletCap public immutable cap;
    constructor(GenesisWalletCap cap_) { cap = cap_; }
    function submit(uint128 amount, address owner, uint256 price, bytes calldata data) external {
        cap.validate(price, amount, owner, msg.sender, data);
    }
    function failAfterValidation(uint128 amount) external {
        cap.validate(1, amount, msg.sender, msg.sender, "");
        revert("downstream auction failure");
    }
    function exit() external pure { /* exiting has no cap mutation path */ }
}

contract CapSmartWallet {
    function bid(CapAuctionMock a, uint128 amount) external { a.submit(amount, address(this), 1, ""); }
}

contract GenesisWalletCapTest is Test {
    CapControllerMock internal controller;
    GenesisWalletCap internal cap;
    CapAuctionMock internal auction;
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    function setUp() public {
        controller = new CapControllerMock();
        cap = new GenesisWalletCap(controller);
        auction = new CapAuctionMock(cap);
        controller.bind(address(auction));
    }
    function bid(address who, uint128 amount) internal { vm.prank(who); auction.submit(amount, who, 1, ""); }
    function testSplitBidsExactlyHalfEthThenOneWeiRejected() public {
        bid(alice, 0.2 ether); bid(alice, 0.3 ether);
        assertEq(cap.committed(alice), 0.5 ether); assertEq(cap.remainingCommitment(alice), 0);
        vm.expectRevert(abi.encodeWithSelector(GenesisWalletCap.WalletCapExceeded.selector, alice, 0, 1));
        bid(alice, 1);
        assertEq(cap.totalCommitted(), 0.5 ether);
    }
    function testOversizedFirstBidLeavesAllowanceIntact() public {
        vm.expectRevert(abi.encodeWithSelector(GenesisWalletCap.WalletCapExceeded.selector, alice, 0.5 ether, 0.5 ether + 1));
        bid(alice, 0.5 ether + 1); assertEq(cap.committed(alice), 0); assertEq(cap.totalCommitted(), 0);
    }
    function testWalletsAreIndependent() public { bid(alice, 0.5 ether); bid(bob, 0.5 ether); assertEq(cap.totalCommitted(), 1 ether); }
    function testDirectCallerCannotBurnVictimAllowance() public {
        vm.expectRevert(GenesisWalletCap.UnauthorizedAuction.selector);
        cap.validate(1, 0.5 ether, alice, alice, ""); assertEq(cap.committed(alice), 0);
    }
    function testForeignAuctionCannotBurnAllowance() public {
        CapAuctionMock foreign = new CapAuctionMock(cap);
        vm.expectRevert(GenesisWalletCap.UnauthorizedAuction.selector);
        vm.prank(alice); foreign.submit(0.5 ether, alice, 1, "");
    }
    function testCannotBidForAnotherWalletOrRotateRecipient() public {
        bid(alice, 0.5 ether);
        vm.expectRevert(GenesisWalletCap.BidderMustOwnBid.selector);
        vm.prank(alice); auction.submit(1, bob, 1, ""); assertEq(cap.committed(bob), 0);
    }
    function testVictimCannotBeGriefedThroughAuction() public {
        vm.expectRevert(GenesisWalletCap.BidderMustOwnBid.selector);
        vm.prank(bob); auction.submit(0.5 ether, alice, 1, ""); assertEq(cap.committed(alice), 0);
    }
    function testChangedPriceAndHookDataDoNotResetAllowance() public {
        bid(alice, 0.5 ether);
        vm.expectRevert(abi.encodeWithSelector(GenesisWalletCap.WalletCapExceeded.selector, alice, 0, 1));
        vm.prank(alice); auction.submit(1, alice, type(uint256).max, hex"deadbeef");
    }
    function testExitDoesNotResetAllowance() public {
        bid(alice, 0.5 ether); vm.prank(alice); auction.exit(); assertEq(cap.remainingCommitment(alice), 0);
    }
    function testDownstreamRevertRollsBackCommitment() public {
        vm.expectRevert("downstream auction failure"); vm.prank(alice); auction.failAfterValidation(0.5 ether);
        assertEq(cap.committed(alice), 0); assertEq(cap.totalCommitted(), 0); bid(alice, 0.5 ether);
    }
    function testSmartWalletCanBidForItself() public {
        CapSmartWallet wallet = new CapSmartWallet(); wallet.bid(auction, 0.5 ether);
        assertEq(cap.committed(address(wallet)), 0.5 ether); assertEq(cap.committed(tx.origin), 0);
    }
    function testUnboundAuctionFailsClosed() public {
        CapControllerMock c = new CapControllerMock(); GenesisWalletCap h = new GenesisWalletCap(c);
        CapAuctionMock a = new CapAuctionMock(h);
        vm.expectRevert(GenesisWalletCap.UnauthorizedAuction.selector); vm.prank(alice); a.submit(1, alice, 1, "");
    }
    function testChangedControllerRuntimeRejected() public {
        vm.etch(address(controller), hex"00"); vm.expectRevert(GenesisWalletCap.InvalidController.selector); bid(alice, 1);
    }
    function testChangedAuctionRuntimeRejected() public {
        vm.etch(address(auction), hex"00"); vm.prank(address(auction));
        vm.expectRevert(GenesisWalletCap.UnauthorizedAuction.selector); cap.validate(1, 1, alice, alice, "");
    }
    function testConstructorRejectsEOAOrAlreadyBoundController() public {
        vm.expectRevert(GenesisWalletCap.InvalidController.selector); new GenesisWalletCap(IGenesisCapController(alice));
        vm.expectRevert(GenesisWalletCap.InvalidController.selector); new GenesisWalletCap(controller);
    }
    function testZeroAmountAndRecipientRejected() public {
        vm.expectRevert(GenesisWalletCap.InvalidAmount.selector); bid(alice, 0);
        vm.expectRevert(GenesisWalletCap.BidderMustOwnBid.selector); vm.prank(alice); auction.submit(1, address(0), 1, "");
    }
    function testInterfaceDiscovery() public view {
        assertTrue(cap.supportsInterface(type(IGenesisBidValidation).interfaceId));
        assertTrue(cap.supportsInterface(0x01ffc9a7)); assertFalse(cap.supportsInterface(0xffffffff));
    }
    function testFuzzSplitCommitment(uint128 first, uint128 second) public {
        first = uint128(bound(first, 1, 0.5 ether)); second = uint128(bound(second, 1, 2 ether));
        bid(alice, first);
        if (uint256(first) + second > 0.5 ether) {
            vm.expectRevert(abi.encodeWithSelector(GenesisWalletCap.WalletCapExceeded.selector, alice, 0.5 ether - first, second));
            bid(alice, second); assertEq(cap.committed(alice), first);
        } else { bid(alice, second); assertEq(cap.committed(alice), uint256(first) + second); }
    }
}

contract CapHandler is Test {
    GenesisWalletCap public immutable cap;
    CapAuctionMock public immutable auction;
    uint256 public accepted;
    constructor(GenesisWalletCap h, CapAuctionMock a) { cap = h; auction = a; }
    function attempt(uint8 wallet, uint128 amount, uint256 price) external {
        address who = address(uint160(0x1000 + uint256(wallet % 16)));
        amount = uint128(bound(amount, 1, 2 ether));
        vm.prank(who);
        try auction.submit(amount, who, price, "") { accepted += amount; } catch {}
    }
}

contract GenesisWalletCapInvariantTest is StdInvariant, Test {
    GenesisWalletCap cap;
    CapHandler handler;
    function setUp() public {
        CapControllerMock controller = new CapControllerMock(); cap = new GenesisWalletCap(controller);
        CapAuctionMock auction = new CapAuctionMock(cap); controller.bind(address(auction));
        handler = new CapHandler(cap, auction); targetContract(address(handler));
    }
    function invariantEveryWalletBoundedAndAggregateConserved() public view {
        uint256 sum;
        for (uint256 i; i < 16; ++i) {
            uint256 used = cap.committed(address(uint160(0x1000 + i))); assertLe(used, 0.5 ether); sum += used;
        }
        assertEq(sum, cap.totalCommitted()); assertEq(sum, handler.accepted());
    }
}
