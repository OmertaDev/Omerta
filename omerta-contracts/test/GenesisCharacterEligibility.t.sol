// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {GenesisPlayerSaleTest} from "./GenesisPlayerSale.t.sol";
import {OmertaGuardedAuctionTest} from "./OmertaGuardedAuction.t.sol";
import {GenesisCharacterEligibility, GenesisCharacterBidValidation} from "../src/genesis-auction/GenesisCharacterEligibility.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ValidationHookLib} from "../src/genesis-auction/vendor/cca/libraries/ValidationHookLib.sol";
import {OmertaGuardedAuction} from "../src/genesis-auction/OmertaGuardedAuction.sol";
import {AuctionParameters} from "../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";

contract CharacterPlayerAdmissionTest is GenesisPlayerSaleTest {
    function testOwnershipRequiredDespiteValidProof() public {
        vm.prank(alice); characterNft.transferFrom(alice, bob, 1);
        vm.expectRevert(GenesisCharacterEligibility.CharacterNftRequired.selector);
        contribute(alice, 1, 0.1 ether);
        assertEq(sale.totalRequested(), 0);
    }

    function testEveryAdditionalContributionChecksOwnership() public {
        contribute(alice, 1, 0.1 ether);
        vm.prank(alice); characterNft.transferFrom(alice, bob, 1);
        vm.expectRevert(GenesisCharacterEligibility.CharacterNftRequired.selector);
        contribute(alice, 1, 0.1 ether);
        assertEq(sale.requested(alice), 0.1 ether);
    }

    function testTransferDoesNotBlockSettlementClaimOrRefund() public {
        contribute(alice, 1, 0.1 ether);
        vm.prank(alice); characterNft.transferFrom(alice, bob, 1);
        vm.warp(sale.closesAt()); sale.settle(alice);
        integration.release(sale); integration.setClaims(true);
        vm.prank(alice); sale.claim();
        vm.prank(alice); sale.refund();
        assertEq(token.balanceOf(alice), 0.1 ether);
    }

    function testTransferDoesNotBlockCancelledRefund() public {
        contribute(alice, 1, 0.1 ether);
        vm.prank(alice); characterNft.transferFrom(alice, bob, 1);
        vm.warp(sale.migrationDeadline()); sale.cancel();
        uint256 before = alice.balance;
        vm.prank(alice); sale.refund();
        assertEq(alice.balance - before, 0.1 ether);
    }

    function testChangedNftCodeFailsClosed() public {
        vm.etch(address(characterNft), hex"00");
        vm.expectRevert(GenesisCharacterEligibility.CharacterNftRequired.selector);
        contribute(alice, 1, 0.1 ether);
    }
    function testChangedChainRejectsContribution() public {
        vm.chainId(block.chainid + 1);
        vm.expectRevert(); contribute(alice, 1, 0.1 ether);
        assertEq(sale.totalRequested(), 0);
    }
}

contract CharacterAuctionAdmissionTest is OmertaGuardedAuctionTest {
    function expectIneligibleBid() internal {
        vm.expectRevert(abi.encodeWithSelector(ValidationHookLib.ValidationHookCallFailed.selector,
            abi.encodeWithSelector(GenesisCharacterEligibility.CharacterNftRequired.selector)));
    }
    function testBothOverloadsRejectRecipientWithoutNft() public {
        vm.roll(10);
        address recipient = address(0xDEAD);
        uint256 previousTick = auction.floorPrice();
        expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), recipient, bytes(""));
        expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), recipient,
            previousTick, bytes(""));
    }

    function testRelayerCannotSubstituteOwnNftForRecipient() public {
        vm.roll(10);
        address recipient = address(0xDEAD);
        expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), recipient, bytes(""));
    }

    function testRelayerCanFundNftOwner() public {
        vm.roll(10);
        address relayer = address(0xDEAD); vm.deal(relayer, 1 ether);
        vm.prank(relayer); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), alice, bytes(""));
    }

    function testTransferDoesNotBlockExistingClaim() public {
        uint256 id = completedBid();
        vm.prank(alice); characterNft.transferFrom(alice, address(0xDEAD), 1);
        gate.setOpen(true); vm.roll(30); auction.claimTokens(id);
        assertGt(token.balanceOf(alice), 0);
    }

    function testChangedNftCodeFailsClosed() public {
        vm.roll(10); vm.etch(address(characterNft), hex"00");
        expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), alice, bytes(""));
    }

    function testFuzzNoNonholderCanBid(address recipient) public {
        vm.assume(recipient != address(0) && recipient != alice);
        vm.roll(10);
        expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), recipient, bytes(""));
    }

    function testInvalidNftRejected() public {
        vm.expectRevert(GenesisCharacterEligibility.InvalidCharacterNft.selector);
        new GenesisCharacterBidValidation(IERC721(address(0xDEAD)));
    }
    function testCallerCannotInstallPermissiveHook() public {
        AuctionParameters memory p = parameters(address(gate));
        p.validationHook = address(0xBEEF);
        vm.expectRevert(OmertaGuardedAuction.InvalidLaunchGate.selector);
        new OmertaGuardedAuction(address(token), 1000 ether, p, gate, characterNft);
    }
    function testChangedChainRejectsBid() public {
        vm.roll(10); vm.chainId(block.chainid + 1); expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), alice, bytes(""));
    }
}
