// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {StreetDeed} from "../src/StreetDeed.sol";

contract GameplayDeedRejectingReceiver is IERC721Receiver {
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        revert("reject deed");
    }
}

contract GameplayDeedReentrantReceiver is IERC721Receiver {
    StreetDeed private immutable _deed;
    bool public reentrySucceeded;

    constructor(StreetDeed deed_) { _deed = deed_; }

    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        StreetDeed.DeedVoucher memory voucher = StreetDeed.DeedVoucher(address(this), "Reentry", "Docks", 999, block.timestamp);
        (reentrySucceeded,) = address(_deed).call(abi.encodeCall(StreetDeed.claimGameplay, (voucher, bytes(""))));
        return IERC721Receiver.onERC721Received.selector;
    }
}

contract StreetDeedGameplayTest is Test {
    using Strings for uint256;

    uint256 private constant SIGNER_KEY = 0xA11CE;
    StreetDeed private deed;
    address private alice = makeAddr("gameplay owner");
    address private partner = makeAddr("partnership owner");
    address payable private proceeds = payable(makeAddr("paid proceeds"));
    uint256 private nonce;

    function setUp() public {
        vm.deal(address(this), 1_000 ether);
        deed = new StreetDeed(address(this), vm.addr(SIGNER_KEY), "image/", "external/", 0);
        deed.configurePrimarySale(partner, proceeds, false);
    }

    function _voucher(string memory name) private returns (StreetDeed.DeedVoucher memory) {
        return StreetDeed.DeedVoucher(alice, name, "The Docks", ++nonce, block.timestamp + 1 hours);
    }

    function _sign(StreetDeed collection, StreetDeed.DeedVoucher memory voucher, bool gameplay) private view returns (bytes memory) {
        bytes32 digest = gameplay ? collection.hashGameplayVoucher(voucher) : collection.hashVoucher(voucher);
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(SIGNER_KEY, digest);
        return abi.encodePacked(r, s, v);
    }

    function _earn(string memory name) private returns (uint256) {
        StreetDeed.DeedVoucher memory voucher = _voucher(name);
        bytes memory signature = _sign(deed, voucher, true);
        deed.claimGameplay(voucher, signature);
        return deed.tokenIdFor(name);
    }

    function testEarnedIssuanceIsFreeAndDoesNotAdvancePaidPrice() public {
        uint256 id = _earn("Earned Title");
        assertEq(deed.ownerOf(id), alice);
        assertEq(deed.gameplayMintedCount(), 1);
        assertEq(deed.paidPublicCount(), 0);
        assertEq(deed.totalDeedIdentities(), 1);
        assertEq(deed.publicMintPrice(), 0.01 ether);
        assertTrue(deed.gameplayIdentity(id));
        assertTrue(deed.transferLocked(id));
        assertEq(address(deed).balance + proceeds.balance, 0);
        assertEq(deed.MAX_PAID_IDENTITIES() + deed.MAX_GAMEPLAY_IDENTITIES(), deed.MAX_PUBLIC_IDENTITIES());
    }

    function testSignaturesCannotSwitchIssuanceRoute() public {
        StreetDeed.DeedVoucher memory voucher = _voucher("Signed Route");
        bytes memory paid = _sign(deed, voucher, false);
        bytes memory gameplay = _sign(deed, voucher, true);
        vm.expectRevert("SD: bad signature");
        deed.claimGameplay(voucher, paid);
        vm.expectRevert("SD: bad signature");
        deed.claim{value: 0.01 ether}(voucher, gameplay);
        assertFalse(deed.usedNonce(voucher.nonce));
        deed.claimGameplay(voucher, gameplay);
        assertEq(deed.gameplayMintedCount(), 1);
        assertEq(deed.paidPublicCount(), 0);
    }

    function testReplayProtectionIsSharedByBothSignedTypes() public {
        StreetDeed.DeedVoucher memory gameplay = _voucher("Earned Nonce");
        StreetDeed.DeedVoucher memory paid = gameplay;
        paid.name = "Paid Nonce";
        bytes memory earnedSignature = _sign(deed, gameplay, true);
        bytes memory paidSignature = _sign(deed, paid, false);
        deed.claimGameplay(gameplay, earnedSignature);
        vm.expectRevert("SD: replay");
        deed.claim{value: 0.01 ether}(paid, paidSignature);
        vm.expectRevert("SD: replay");
        deed.claimGameplay(gameplay, earnedSignature);
    }

    function testFuzzGameplayRejectsEveryNonzeroPayment(uint96 amountSeed) public {
        uint256 amount = bound(uint256(amountSeed), 1, 1 ether);
        StreetDeed.DeedVoucher memory voucher = _voucher("No Purchase Required");
        bytes memory signature = _sign(deed, voucher, true);
        vm.expectRevert(abi.encodeWithSelector(StreetDeed.IncorrectPublicPayment.selector, amount, 0));
        deed.claimGameplay{value: amount}(voucher, signature);
        assertEq(deed.gameplayMintedCount(), 0);
        assertEq(deed.totalDeedIdentities(), 0);
        assertFalse(deed.usedNonce(voucher.nonce));
        assertFalse(deed.gameplayIdentity(deed.tokenIdFor(voucher.name)));
        assertEq(deed.mintedOnDay(block.timestamp / 1 days), 0);
    }

    function testGameplayNeedsConfiguredCollectionAndValidRecipientNameAndDeadline() public {
        StreetDeed fresh = new StreetDeed(address(this), vm.addr(SIGNER_KEY), "", "", 0);
        StreetDeed.DeedVoucher memory voucher = _voucher("Configured Earned Title");
        bytes memory signature = _sign(fresh, voucher, true);
        vm.expectRevert(StreetDeed.PrimarySaleNotConfigured.selector);
        fresh.claimGameplay(voucher, signature);
        assertFalse(fresh.usedNonce(voucher.nonce));
        voucher.to = address(0);
        signature = _sign(deed, voucher, true);
        vm.expectRevert("SD: zero recipient");
        deed.claimGameplay(voucher, signature);
        voucher.to = alice;
        voucher.name = "";
        signature = _sign(deed, voucher, true);
        vm.expectRevert("SD: empty name");
        deed.claimGameplay(voucher, signature);
        voucher.name = "Expired Earned Title";
        voucher.deadline = block.timestamp - 1;
        signature = _sign(deed, voucher, true);
        vm.expectRevert("SD: expired");
        deed.claimGameplay(voucher, signature);
        voucher.deadline = block.timestamp + 30 days + 1;
        signature = _sign(deed, voucher, true);
        vm.expectRevert("SD: deadline too far");
        deed.claimGameplay(voucher, signature);
        assertEq(deed.gameplayMintedCount(), 0);
    }

    function testGameplaySignatureBindsCollectionChainRecipientNameAndDistrict() public {
        StreetDeed other = new StreetDeed(address(this), vm.addr(SIGNER_KEY), "", "", 0);
        other.configurePrimarySale(partner, proceeds, false);
        StreetDeed.DeedVoucher memory voucher = _voucher("Bound Title");
        bytes memory signature = _sign(deed, voucher, true);
        vm.expectRevert("SD: bad signature");
        other.claimGameplay(voucher, signature);
        uint256 chain = block.chainid;
        vm.chainId(chain + 1);
        vm.expectRevert("SD: bad signature");
        deed.claimGameplay(voucher, signature);
        vm.chainId(chain);
        voucher.to = partner;
        vm.expectRevert("SD: bad signature");
        deed.claimGameplay(voucher, signature);
        voucher.to = alice;
        voucher.name = "Changed Title";
        vm.expectRevert("SD: bad signature");
        deed.claimGameplay(voucher, signature);
        voucher.name = "Bound Title";
        voucher.district = "Neon Mile";
        vm.expectRevert("SD: bad signature");
        deed.claimGameplay(voucher, signature);
        assertFalse(deed.usedNonce(voucher.nonce));
    }

    function testAllThreeAllocationsShareDailyCapAndPause() public {
        deed.setDailyMintCap(1);
        _earn("Daily Earned Title");
        StreetDeed.DeedVoucher memory voucher = _voucher("Daily Paid Title");
        bytes memory signature = _sign(deed, voucher, false);
        vm.expectRevert("SD: daily cap");
        deed.claim{value: 0.01 ether}(voucher, signature);
        StreetDeed.DeedIdentity[] memory identities = new StreetDeed.DeedIdentity[](1);
        identities[0] = StreetDeed.DeedIdentity("Daily Partner Title", "The Docks");
        vm.expectRevert("SD: daily cap");
        deed.mintPartnership(identities);
        vm.warp(block.timestamp + 1 days);
        voucher = _voucher("Tomorrow Earned Title");
        signature = _sign(deed, voucher, true);
        deed.pause();
        vm.expectRevert();
        deed.claimGameplay(voucher, signature);
        uint256 id = deed.tokenIdFor("Daily Earned Title");
        vm.prank(alice);
        deed.redeem(id);
        deed.unpause();
        deed.claimGameplay(voucher, signature);
        assertEq(deed.gameplayMintedCount(), 2);
    }

    function testReceiverRejectionRollsBackAllIssuanceState() public {
        StreetDeed.DeedVoucher memory voucher = _voucher("Rejected Earned Title");
        voucher.to = address(new GameplayDeedRejectingReceiver());
        bytes memory signature = _sign(deed, voucher, true);
        vm.expectRevert("reject deed");
        deed.claimGameplay(voucher, signature);
        assertEq(deed.gameplayMintedCount(), 0);
        assertEq(deed.totalDeedIdentities(), 0);
        assertEq(deed.mintedOnDay(block.timestamp / 1 days), 0);
        assertFalse(deed.usedNonce(voucher.nonce));
        assertFalse(deed.gameplayIdentity(deed.tokenIdFor(voucher.name)));
    }

    function testGameplayReceiverCannotReenterMinting() public {
        GameplayDeedReentrantReceiver receiver = new GameplayDeedReentrantReceiver(deed);
        StreetDeed.DeedVoucher memory voucher = _voucher("Callback Earned Title");
        voucher.to = address(receiver);
        bytes memory signature = _sign(deed, voucher, true);
        deed.claimGameplay(voucher, signature);
        assertFalse(receiver.reentrySucceeded());
        assertEq(deed.gameplayMintedCount(), 1);
        assertEq(deed.balanceOf(address(receiver)), 1);
    }

    function testGameplaySupplyCannotBeReopenedByBurnOrConsumeThePaidAllocation() public {
        for (uint256 i; i < 1_000; ++i) _earn(string.concat("Earned Limit ", i.toString()));
        assertEq(deed.gameplayMintedCount(), 1_000);
        assertEq(deed.totalDeedIdentities(), 1_000);
        assertEq(deed.publicMintPrice(), 0.01 ether);
        uint256 id = deed.tokenIdFor("Earned Limit 0");
        vm.prank(alice);
        deed.redeem(id);
        StreetDeed.DeedVoucher memory voucher = _voucher("Excess Earned Title");
        bytes memory signature = _sign(deed, voucher, true);
        vm.expectRevert(StreetDeed.GameplaySupplyExceeded.selector);
        deed.claimGameplay(voucher, signature);
        assertFalse(deed.usedNonce(voucher.nonce));
        assertEq(deed.gameplayMintedCount(), 1_000);
        _earn("Earned Limit 0");
        assertEq(deed.gameplayMintedCount(), 1_000);
        assertTrue(deed.gameplayIdentity(id));
        voucher = _voucher("Independent Paid Title");
        signature = _sign(deed, voucher, false);
        deed.claim{value: 0.01 ether}(voucher, signature);
        assertEq(deed.paidPublicCount(), 1);
        assertEq(deed.totalDeedIdentities(), 1_001);
        assertFalse(deed.gameplayIdentity(deed.tokenIdFor(voucher.name)));
    }

    function testRemintsKeepOriginalAllocationAndDistrictThroughEitherSignedRoute() public {
        uint256 id = _earn("Permanent Earned Origin");
        vm.prank(alice);
        deed.redeem(id);
        StreetDeed.DeedVoucher memory voucher = _voucher("Permanent Earned Origin");
        bytes memory signature = _sign(deed, voucher, false);
        assertEq(deed.quoteClaim(voucher.name), 0);
        deed.claim(voucher, signature);
        assertTrue(deed.gameplayIdentity(id));
        assertEq(deed.gameplayMintedCount(), 1);
        assertEq(deed.paidPublicCount(), 0);
        vm.prank(alice);
        deed.redeem(id);
        voucher = _voucher("Permanent Earned Origin");
        voucher.district = "Neon Mile";
        signature = _sign(deed, voucher, true);
        vm.expectRevert("SD: identity changed");
        deed.claimGameplay(voucher, signature);
        assertFalse(deed.usedNonce(voucher.nonce));
        assertEq(deed.totalDeedIdentities(), 1);
    }
}
