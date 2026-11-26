// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {StreetDeed} from "../src/StreetDeed.sol";
import {FeeRevenueRouter} from "../src/FeeRevenueRouter.sol";

contract DeedSaleRejectingRecipient {
    receive() external payable { revert("payment rejected"); }
}

contract StreetDeedPrimarySaleTest is Test {
    using Strings for uint256;
    uint256 private constant SIGNER_KEY = 0xA11CE;
    StreetDeed private deed;
    address private partner = makeAddr("partnership developer");
    address payable private proceeds = payable(makeAddr("sale proceeds"));
    address private alice = makeAddr("public buyer");
    uint256 private nonce;

    function setUp() public {
        vm.deal(address(this), 1_000 ether);
        deed = _collection();
        deed.configurePrimarySale(partner, proceeds, false);
    }

    function _collection() private returns (StreetDeed) {
        return new StreetDeed(address(this), vm.addr(SIGNER_KEY), "image/", "external/", 0);
    }

    function _voucher(string memory name) private returns (StreetDeed.DeedVoucher memory) {
        return StreetDeed.DeedVoucher(alice, name, "The Docks", ++nonce, block.timestamp + 1 hours);
    }

    function _sign(StreetDeed collection, StreetDeed.DeedVoucher memory voucher) private view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, collection.hashVoucher(voucher));
        return abi.encodePacked(r, s, v);
    }

    function _buy(StreetDeed collection, string memory name) private returns (uint256) {
        StreetDeed.DeedVoucher memory voucher = _voucher(name);
        bytes memory signature = _sign(collection, voucher);
        uint256 fee = collection.quoteClaim(name);
        collection.claim{value: fee}(voucher, signature);
        return collection.tokenIdFor(name);
    }

    function _identities(uint256 start, uint256 count) private pure returns (StreetDeed.DeedIdentity[] memory list) {
        list = new StreetDeed.DeedIdentity[](count);
        for (uint256 i; i < count; ++i) {
            list[i] = StreetDeed.DeedIdentity(string.concat("Partnership Street ", (start + i).toString()), "The Docks");
        }
    }

    function testSaleMustBeConfiguredAndOnlyOwnerCanFixItOnce() public {
        StreetDeed fresh = _collection();
        StreetDeed.DeedVoucher memory voucher = _voucher("Unconfigured Street");
        bytes memory signature = _sign(fresh, voucher);
        vm.expectRevert(StreetDeed.PrimarySaleNotConfigured.selector);
        fresh.claim{value: 0.01 ether}(voucher, signature);
        assertFalse(fresh.usedNonce(voucher.nonce));
        assertEq(fresh.totalDeedIdentities(), 0);
        vm.prank(alice);
        vm.expectRevert();
        fresh.configurePrimarySale(partner, proceeds, false);
        vm.expectRevert(StreetDeed.InvalidPrimarySaleConfiguration.selector);
        fresh.configurePrimarySale(address(0), proceeds, false);
        fresh.configurePrimarySale(partner, proceeds, false);
        vm.expectRevert(StreetDeed.PrimarySaleAlreadyConfigured.selector);
        fresh.configurePrimarySale(alice, payable(alice), false);
        _buy(fresh, "Configured Street");
        assertEq(proceeds.balance, 0.01 ether, "failed reconfiguration cannot redirect proceeds");
        assertEq(alice.balance, 0);
    }

    function testFirstHundredPublicMintsHaveOnePriceAndPartnershipsDoNotAdvanceIt() public {
        for (uint256 i; i < 99; ++i) _buy(deed, string.concat("Public Street ", i.toString()));
        deed.mintPartnership(_identities(0, 25));
        assertEq(deed.publicMintPrice(), 0.01 ether);
        _buy(deed, "Public Street 99");
        assertEq(proceeds.balance, 1 ether);
        assertEq(deed.paidPublicCount(), 100);
        assertEq(deed.partnershipMintedCount(), 25);
        assertEq(deed.publicMintPrice(), 0.02 ether);

        StreetDeed.DeedVoucher memory voucher = _voucher("Public Street 100");
        bytes memory signature = _sign(deed, voucher);
        vm.expectRevert(abi.encodeWithSelector(StreetDeed.IncorrectPublicPayment.selector, 0.01 ether, 0.02 ether));
        deed.claim{value: 0.01 ether}(voucher, signature);
        assertFalse(deed.usedNonce(voucher.nonce), "stale quote cannot consume its nonce");
        deed.claim{value: 0.02 ether}(voucher, signature);
        assertEq(deed.paidPublicCount(), 101);
        assertEq(proceeds.balance, 1.02 ether);
        assertEq(address(deed).balance, 0);
    }

    function testPartnershipAllocationIsFixedAtFiveHundredEvenAfterBurns() public {
        for (uint256 batch; batch < 20; ++batch) deed.mintPartnership(_identities(batch * 25, 25));
        assertEq(deed.balanceOf(partner), 500);
        assertEq(deed.totalDeedIdentities(), 500);
        assertEq(deed.paidPublicCount(), 0);
        assertEq(deed.publicMintPrice(), 0.01 ether);
        assertEq(proceeds.balance, 0);
        uint256 id = deed.tokenIdFor("Partnership Street 0");
        vm.prank(partner);
        deed.redeem(id);
        vm.expectRevert(StreetDeed.PartnershipSupplyExceeded.selector);
        deed.mintPartnership(_identities(500, 1));
        _buy(deed, "Partnership Street 0");
        assertEq(deed.ownerOf(id), alice);
        assertEq(deed.partnershipMintedCount(), 500);
        assertEq(deed.paidPublicCount(), 0);
        assertEq(deed.totalDeedIdentities(), 500);
        assertEq(proceeds.balance, 0, "partnership remint is free");
    }

    function testPartnershipBatchesRequireOwnerNewNamesAndAtMostTwentyFive() public {
        StreetDeed.DeedIdentity[] memory one = _identities(0, 1);
        vm.prank(alice);
        vm.expectRevert();
        deed.mintPartnership(one);
        StreetDeed.DeedIdentity[] memory empty = new StreetDeed.DeedIdentity[](0);
        vm.expectRevert(StreetDeed.InvalidPartnershipBatch.selector);
        deed.mintPartnership(empty);
        StreetDeed.DeedIdentity[] memory oversized = _identities(0, 26);
        vm.expectRevert(StreetDeed.InvalidPartnershipBatch.selector);
        deed.mintPartnership(oversized);
        StreetDeed.DeedIdentity[] memory duplicate = _identities(0, 2);
        duplicate[1] = StreetDeed.DeedIdentity(duplicate[0].name, "The Docks");
        vm.expectRevert(StreetDeed.IdentityAlreadyIssued.selector);
        deed.mintPartnership(duplicate);
        assertEq(deed.totalDeedIdentities(), 0, "the entire batch rolls back");
        assertEq(deed.partnershipMintedCount(), 0);
        assertEq(deed.mintedOnDay(block.timestamp / 1 days), 0);
        assertEq(deed.balanceOf(partner), 0);
        deed.mintPartnership(one);
        vm.expectRevert(StreetDeed.IdentityAlreadyIssued.selector);
        deed.mintPartnership(one);
        assertTrue(deed.transferLocked(deed.tokenIdFor(one[0].name)), "partnership mints preserve the listing lock");
    }

    function testPublicVoucherCannotConsumeTheFreePartnershipAllocation() public {
        StreetDeed.DeedVoucher memory voucher = _voucher("Unsigned Partnership Allocation");
        bytes memory signature = _sign(deed, voucher);
        vm.expectRevert(abi.encodeWithSelector(StreetDeed.IncorrectPublicPayment.selector, 0, 0.01 ether));
        deed.claim(voucher, signature);
        assertEq(deed.partnershipMintedCount(), 0);
        assertEq(deed.paidPublicCount(), 0);
        assertFalse(deed.usedNonce(voucher.nonce));
    }

    function testBothAllocationsShareDailyCapAndPauseButRedeemRemainsAvailable() public {
        deed.setDailyMintCap(1);
        StreetDeed.DeedIdentity[] memory two = _identities(0, 2);
        vm.expectRevert("SD: daily cap");
        deed.mintPartnership(two);
        assertEq(deed.partnershipMintedCount(), 0);
        deed.mintPartnership(_identities(0, 1));
        StreetDeed.DeedVoucher memory voucher = _voucher("Daily Public Street");
        bytes memory signature = _sign(deed, voucher);
        vm.expectRevert("SD: daily cap");
        deed.claim{value: 0.01 ether}(voucher, signature);
        deed.pause();
        StreetDeed.DeedIdentity[] memory next = _identities(1, 1);
        vm.expectRevert();
        deed.mintPartnership(next);
        uint256 id = deed.tokenIdFor("Partnership Street 0");
        vm.prank(partner);
        deed.redeem(id);
        deed.unpause();
        vm.warp(block.timestamp + 1 days);
        _buy(deed, "Partnership Street 0");
        assertEq(deed.ownerOf(id), alice);
        assertEq(deed.partnershipMintedCount(), 1);
        assertEq(deed.paidPublicCount(), 0);
    }

    function testBurnedPublicIdentityNeverPaysAgainOrAdvancesThePrice() public {
        uint256 id = _buy(deed, "Round Trip Street");
        vm.prank(alice);
        deed.redeem(id);
        StreetDeed.DeedVoucher memory voucher = _voucher("Round Trip Street");
        bytes memory signature = _sign(deed, voucher);
        assertEq(deed.quoteClaim(voucher.name), 0);
        vm.expectRevert(abi.encodeWithSelector(StreetDeed.IncorrectPublicPayment.selector, 0.01 ether, 0));
        deed.claim{value: 0.01 ether}(voucher, signature);
        deed.claim(voucher, signature);
        assertEq(deed.paidPublicCount(), 1);
        assertEq(deed.totalDeedIdentities(), 1);
        assertEq(proceeds.balance, 0.01 ether);
        assertTrue(deed.transferLocked(id));
    }

    function testRejectedPaymentRollsBackIdentityNonceDailyAndAllocationState() public {
        StreetDeed fresh = _collection();
        DeedSaleRejectingRecipient rejecting = new DeedSaleRejectingRecipient();
        fresh.configurePrimarySale(partner, payable(address(rejecting)), false);
        StreetDeed.DeedVoucher memory voucher = _voucher("Rejected Proceeds Street");
        bytes memory signature = _sign(fresh, voucher);
        vm.expectRevert(StreetDeed.SalePaymentFailed.selector);
        fresh.claim{value: 0.01 ether}(voucher, signature);
        assertEq(fresh.totalDeedIdentities(), 0);
        assertEq(fresh.paidPublicCount(), 0);
        assertEq(fresh.mintedOnDay(block.timestamp / 1 days), 0);
        assertFalse(fresh.usedNonce(voucher.nonce));
        assertEq(fresh.deedName(fresh.tokenIdFor(voucher.name)), "");
        assertEq(address(fresh).balance, 0);
    }

    function testDedicatedRouterBindsCollectionAndSplitsOnlyFirstPublicPayments() public {
        StreetDeed fresh = _collection();
        address payable dev = payable(makeAddr("router developer"));
        address payable vig = payable(makeAddr("router vig"));
        address payable treasury = payable(makeAddr("router treasury"));
        address payable community = payable(makeAddr("router community"));
        FeeRevenueRouter router = new FeeRevenueRouter(address(fresh), dev, vig, treasury, community);
        StreetDeed other = _collection();
        vm.expectRevert(StreetDeed.InvalidPrimarySaleConfiguration.selector);
        other.configurePrimarySale(partner, payable(address(router)), true);
        fresh.configurePrimarySale(partner, payable(address(router)), true);
        uint256 id = _buy(fresh, "Routed Public Street");
        assertEq(dev.balance, 0.005 ether);
        assertEq(vig.balance, 0.0025 ether);
        assertEq(treasury.balance, 0.001 ether);
        assertEq(community.balance, 0.0015 ether);
        assertEq(router.lastNonce(), 1);
        fresh.mintPartnership(_identities(0, 25));
        vm.prank(alice);
        fresh.redeem(id);
        _buy(fresh, "Routed Public Street");
        assertEq(router.lastNonce(), 1, "partnership and re-extraction do not create router payments");
        assertEq(dev.balance + vig.balance + treasury.balance + community.balance, 0.01 ether);
        assertEq(address(fresh).balance + address(router).balance, 0);
    }

    function testFuzzNonExactPublicPaymentNeverIssuesAnIdentity(uint96 amountSeed) public {
        uint256 amount = bound(uint256(amountSeed), 0, 0.02 ether);
        if (amount == 0.01 ether) ++amount;
        StreetDeed.DeedVoucher memory voucher = _voucher("Exact Payment Street");
        bytes memory signature = _sign(deed, voucher);
        vm.expectRevert(abi.encodeWithSelector(StreetDeed.IncorrectPublicPayment.selector, amount, 0.01 ether));
        deed.claim{value: amount}(voucher, signature);
        assertEq(deed.totalDeedIdentities(), 0);
        assertEq(deed.paidPublicCount(), 0);
        assertFalse(deed.usedNonce(voucher.nonce));
        assertEq(proceeds.balance, 0);
    }
}

/// @dev Drives funded, valid issuance and burn/remint operations through their real authorization paths.
contract StreetDeedSaleHandler is Test {
    using Strings for uint256;
    StreetDeed public immutable deed;
    address public immutable buyer;
    uint256 public publicIssued;
    uint256 public gameplayIssued;
    uint256 public partnerIssued;
    uint256 public publicPayments;
    uint256 public reextractions;
    uint256 private _nonce;
    string[] private _names;

    constructor(StreetDeed deed_, address buyer_) {
        deed = deed_;
        buyer = buyer_;
    }

    function acceptOwnership() external { deed.acceptOwnership(); }

    function buy(uint96) external {
        if (publicIssued == 1_000) return;
        string memory name = string.concat("Invariant Public ", publicIssued.toString());
        uint256 fee = deed.publicMintPrice();
        _claim(name, buyer, fee);
        publicPayments += fee;
        ++publicIssued;
        _names.push(name);
    }

    function gameplay(uint96) external {
        if (gameplayIssued == 1_000) return;
        string memory name = string.concat("Invariant Gameplay ", gameplayIssued.toString());
        StreetDeed.DeedVoucher memory voucher = StreetDeed.DeedVoucher(buyer, name, "The Docks", ++_nonce, block.timestamp + 1 hours);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xA11CE, deed.hashGameplayVoucher(voucher));
        deed.claimGameplay(voucher, abi.encodePacked(r, s, v));
        ++gameplayIssued;
        _names.push(name);
    }

    function partnership(uint8 countSeed) external {
        uint256 remaining = 500 - partnerIssued;
        if (remaining == 0) return;
        uint256 count = bound(uint256(countSeed), 1, remaining < 25 ? remaining : 25);
        StreetDeed.DeedIdentity[] memory identities = new StreetDeed.DeedIdentity[](count);
        for (uint256 i; i < count; ++i) {
            identities[i] = StreetDeed.DeedIdentity(string.concat("Invariant Partner ", (partnerIssued + i).toString()), "The Docks");
        }
        deed.mintPartnership(identities);
        partnerIssued += count;
        for (uint256 i; i < count; ++i) _names.push(identities[i].name);
    }

    function burnAndReextract(uint96 seed) external {
        if (_names.length == 0) return;
        string memory name = _names[uint256(seed) % _names.length];
        uint256 id = deed.tokenIdFor(name);
        address holder = deed.ownerOf(id);
        vm.prank(holder);
        deed.redeem(id);
        _claim(name, holder, 0);
        ++reextractions;
    }

    function _claim(string memory name, address to, uint256 payment) private {
        StreetDeed.DeedVoucher memory voucher = StreetDeed.DeedVoucher(to, name, "The Docks", ++_nonce, block.timestamp + 1 hours);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(0xA11CE, deed.hashVoucher(voucher));
        deed.claim{value: payment}(voucher, abi.encodePacked(r, s, v));
    }
}

contract StreetDeedPrimarySaleInvariantTest is Test {
    StreetDeed private deed;
    StreetDeedSaleHandler private handler;
    address private buyer = makeAddr("invariant public buyer");
    address private partner = makeAddr("invariant partnership developer");
    address payable private proceeds = payable(makeAddr("invariant proceeds"));

    function setUp() public {
        deed = new StreetDeed(address(this), vm.addr(0xA11CE), "image/", "external/", 0);
        deed.configurePrimarySale(partner, proceeds, false);
        handler = new StreetDeedSaleHandler(deed, buyer);
        vm.deal(address(handler), 1_000 ether);
        deed.transferOwnership(address(handler));
        handler.acceptOwnership();
        handler.buy(0);
        handler.gameplay(0);
        handler.partnership(1);
        handler.burnAndReextract(0);
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = StreetDeedSaleHandler.buy.selector;
        selectors[1] = StreetDeedSaleHandler.partnership.selector;
        selectors[2] = StreetDeedSaleHandler.burnAndReextract.selector;
        selectors[3] = StreetDeedSaleHandler.gameplay.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }

    function invariantLifetimeAllocationAndDeliveredProceedsRemainConserved() public view {
        uint256 total = deed.totalDeedIdentities();
        assertEq(total, handler.publicIssued() + handler.gameplayIssued() + handler.partnerIssued());
        assertEq(deed.paidPublicCount(), handler.publicIssued());
        assertEq(deed.partnershipMintedCount(), handler.partnerIssued());
        assertEq(deed.gameplayMintedCount(), handler.gameplayIssued());
        assertLe(deed.paidPublicCount(), 1_000);
        assertLe(deed.gameplayMintedCount(), 1_000);
        assertLe(deed.partnershipMintedCount(), 500);
        assertLe(total, 2_500);
        assertEq(deed.balanceOf(buyer) + deed.balanceOf(partner), total);
        assertEq(proceeds.balance, handler.publicPayments());
        assertEq(address(deed).balance, 0);
        assertGt(handler.reextractions(), 0, "the model includes an actual burn/remint");
    }
}
