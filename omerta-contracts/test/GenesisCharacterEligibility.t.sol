// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {GenesisPlayerSaleTest} from "./GenesisPlayerSale.t.sol";
import {Test} from "forge-std/Test.sol";
import {GenesisPlayerSale} from "../src/GenesisPlayerSale.sol";
import {GenesisCharacterPlayerSale} from "../src/GenesisCharacterPlayerSale.sol";
import {AuctionClaimGateMock, GuardedAuctionToken} from "./OmertaGuardedAuction.t.sol";
import {GenesisCharacterEligibility, GenesisCharacterBidValidation} from "../src/genesis-auction/GenesisCharacterEligibility.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {ValidationHookLib} from "../src/genesis-auction/vendor/cca/libraries/ValidationHookLib.sol";
import {OmertaCharacterGuardedAuction} from "../src/genesis-auction/OmertaCharacterGuardedAuction.sol";
import {AuctionParameters} from "../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";

contract AdmissionCharacterNft is ERC721 {
    constructor() ERC721("Character", "CHAR") {}
    function mint(address account, uint256 id) external { _mint(account, id); }
}

contract CharacterPlayerAdmissionTest is GenesisPlayerSaleTest {
    AdmissionCharacterNft characterNft;

    function _beforeSaleDeployment() internal override {
        characterNft = new AdmissionCharacterNft();
        characterNft.mint(alice, 1); characterNft.mint(bob, 2);
    }
    function _deploySale(bytes32 root) internal override returns (GenesisPlayerSale) {
        return new GenesisCharacterPlayerSale(token, integration, root, 1 ether, block.timestamp + 1 days,
            block.timestamp + 5 days, address(0xCAFE), characterNft);
    }
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

contract CharacterAuctionToken is GuardedAuctionToken {
    function burn(address from, uint256 amount) external { _burn(from, amount); }
}

contract CharacterAuctionClaimGateMock is AuctionClaimGateMock {
    function sweepCharacter(OmertaCharacterGuardedAuction target) external { target.sweepCurrency(); }
}

contract CharacterAuctionAdmissionTest is Test {
    OmertaCharacterGuardedAuction auction;
    CharacterAuctionClaimGateMock gate;
    CharacterAuctionToken token;
    AdmissionCharacterNft characterNft;
    address alice = address(0xA11CE);
    uint256 constant Q96 = 1 << 96;

    function parameters(address recipient) internal pure returns (AuctionParameters memory p) {
        p = AuctionParameters(address(0), address(0xCAFE), recipient, 10, 20, 30,
            2, address(0), (Q96 / 1000) / 2 * 2, 1,
            abi.encodePacked(uint24(1_000_000), uint40(10)));
    }
    function setUp() public {
        token = new CharacterAuctionToken(); gate = new CharacterAuctionClaimGateMock();
        characterNft = new AdmissionCharacterNft(); characterNft.mint(alice, 1);
        token.mint(address(this), 2000 ether);
        auction = new OmertaCharacterGuardedAuction(address(token), 1000 ether, parameters(address(gate)), gate, characterNft);
        token.transfer(address(auction), 1000 ether); auction.onTokensReceived();
        vm.deal(alice, 10 ether);
    }
    function completedBid() internal returns (uint256 id) {
        vm.roll(10);
        vm.prank(alice); id = auction.submitBid{value: 2 ether}(Q96, uint128(2 ether), alice, bytes(""));
        vm.roll(20); auction.checkpoint();
        assertTrue(auction.isGraduated()); auction.exitBid(id);
    }
    function testSingleClaimBlockedUntilGateAndCliff() public {
        uint256 id = completedBid(); gate.setOpen(true);
        vm.expectRevert(); auction.claimTokens(id);
        vm.roll(30); gate.setOpen(false);
        vm.expectRevert(OmertaCharacterGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(id);
        assertEq(token.balanceOf(alice), 0);
        gate.setOpen(true); auction.claimTokens(id); assertGt(token.balanceOf(alice), 0);
    }
    function testBatchClaimCannotBypassGate() public {
        uint256 id = completedBid(); vm.roll(30);
        uint256[] memory ids = new uint256[](1); ids[0] = id;
        vm.expectRevert(OmertaCharacterGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokensBatch(alice, ids);
        gate.setOpen(true); auction.claimTokensBatch(alice, ids); assertGt(token.balanceOf(alice), 0);
    }
    function testGateRuntimeAndChainArePinned() public {
        uint256 id = completedBid(); vm.roll(30); gate.setOpen(true);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(OmertaCharacterGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(id);
        vm.chainId(block.chainid - 1); vm.etch(address(gate), hex"00");
        vm.expectRevert(OmertaCharacterGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(id);
    }
    function testSweepRequiresCoordinatorAndWorksBeforeClaims() public {
        completedBid(); vm.expectRevert(); auction.sweepCurrency();
        gate.sweepCharacter(auction); assertGt(address(gate).balance, 0);
        assertEq(token.balanceOf(alice), 0);
    }
    function testRejectWrongGateConfiguration() public {
        AuctionParameters memory p = parameters(address(1));
        vm.expectRevert(OmertaCharacterGuardedAuction.InvalidLaunchGate.selector);
        new OmertaCharacterGuardedAuction(address(token), 1000 ether, p, gate, characterNft);
    }
    function expectSupplyChanged() internal {
        vm.expectRevert(abi.encodeWithSelector(ValidationHookLib.ValidationHookCallFailed.selector,
            abi.encodeWithSelector(GenesisCharacterBidValidation.AuctionSupplyChanged.selector)));
    }
    function testMintDriftRejectsBothDirectBidOverloads() public {
        vm.roll(10); token.mint(address(this),1);
        expectSupplyChanged(); vm.prank(alice);
        auction.submitBid{value:1 ether}(Q96,uint128(1 ether),alice,bytes(""));
        uint256 floor = auction.floorPrice(); expectSupplyChanged(); vm.prank(alice);
        auction.submitBid{value:1 ether}(Q96,uint128(1 ether),alice,floor,bytes(""));
        assertEq(auction.nextBidId(),0);
    }
    function testBurnDriftRejectsNewBid() public {
        vm.roll(10); token.burn(address(this),1); expectSupplyChanged(); vm.prank(alice);
        auction.submitBid{value:1 ether}(Q96,uint128(1 ether),alice,bytes(""));
    }
    function testRuntimeDriftRejectsBothBidOverloads() public {
        vm.roll(10); vm.etch(address(token),hex"00");
        expectSupplyChanged(); vm.prank(alice);
        auction.submitBid{value:1 ether}(Q96,uint128(1 ether),alice,bytes(""));
        uint256 floor = auction.floorPrice(); expectSupplyChanged(); vm.prank(alice);
        auction.submitBid{value:1 ether}(Q96,uint128(1 ether),alice,floor,bytes(""));
    }
    function testExistingClaimSurvivesSupplyDrift() public {
        uint256 id = completedBid(); token.mint(address(this),1);
        vm.roll(30); gate.setOpen(true); auction.claimTokens(id);
        assertGt(token.balanceOf(alice),0);
    }
    function testUngradulatedRefundSurvivesSupplyDrift() public {
        AuctionParameters memory p = parameters(address(gate)); p.requiredCurrencyRaised = 100 ether;
        OmertaCharacterGuardedAuction failed = new OmertaCharacterGuardedAuction(address(token),1000 ether,p,gate,characterNft);
        token.transfer(address(failed),1000 ether); failed.onTokensReceived();
        vm.roll(10); vm.prank(alice);
        uint256 id = failed.submitBid{value:1 ether}(Q96,uint128(1 ether),alice,bytes(""));
        token.mint(address(this),1); vm.roll(20); failed.exitBid(id);
        assertEq(alice.balance,10 ether); assertEq(failed.bids(id).tokensFilled,0);
    }
    function testValidatorSnapshotGettersAndZeroSupplyRejected() public {
        GenesisCharacterBidValidation validator = GenesisCharacterBidValidation(address(auction.validationHook()));
        assertEq(address(validator.omr()),address(token)); assertEq(validator.omrCodeHash(),address(token).codehash);
        assertEq(validator.approvedSupply(),2000 ether);
        GuardedAuctionToken empty = new GuardedAuctionToken();
        vm.expectRevert(GenesisCharacterBidValidation.InvalidAuctionSupply.selector);
        new GenesisCharacterBidValidation(characterNft,empty);
    }
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
        new GenesisCharacterBidValidation(IERC721(address(0xDEAD)),token);
    }
    function testCallerCannotInstallPermissiveHook() public {
        AuctionParameters memory p = parameters(address(gate));
        p.validationHook = address(0xBEEF);
        vm.expectRevert(OmertaCharacterGuardedAuction.InvalidLaunchGate.selector);
        new OmertaCharacterGuardedAuction(address(token), 1000 ether, p, gate, characterNft);
    }
    function testChangedChainRejectsBid() public {
        vm.roll(10); vm.chainId(block.chainid + 1); expectIneligibleBid();
        vm.prank(alice); auction.submitBid{value: 1 ether}(Q96, uint128(1 ether), alice, bytes(""));
    }
}
