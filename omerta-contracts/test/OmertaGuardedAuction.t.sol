// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {GenesisCharacterMock} from "./helpers/GenesisCharacterMock.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {OmertaGuardedAuction, IOmertaGenesisClaimGate} from "../src/genesis-auction/OmertaGuardedAuction.sol";
import {AuctionParameters} from "../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";

contract GuardedAuctionToken is ERC20 {
    constructor() ERC20("OMR", "OMR") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function burn(address from, uint256 amount) external { _burn(from, amount); }
}
contract AuctionClaimGateMock is IOmertaGenesisClaimGate {
    bool public playerClaimsOpen;
    function setOpen(bool value) external { playerClaimsOpen = value; }
    function sweep(OmertaGuardedAuction auction) external { auction.sweepCurrency(); }
    receive() external payable {}
}

contract OmertaGuardedAuctionTest is Test {
    GenesisCharacterMock characterNft;
    OmertaGuardedAuction auction;
    AuctionClaimGateMock gate;
    GuardedAuctionToken token;
    address alice = address(0xA11CE);
    uint256 constant Q96 = 1 << 96;
    function parameters(address recipient) internal pure returns (AuctionParameters memory p) {
        p = AuctionParameters(address(0), address(0xCAFE), recipient, 10, 20, 30,
            2, address(0), (Q96 / 1000) / 2 * 2, 1,
            abi.encodePacked(uint24(1_000_000), uint40(10)));
    }
    function setUp() public {
        characterNft = new GenesisCharacterMock();
        characterNft.mint(alice);
        token = new GuardedAuctionToken(); token.mint(address(this),2000 ether); gate = new AuctionClaimGateMock();
        auction = new OmertaGuardedAuction(address(token), 1000 ether, parameters(address(gate)), gate, characterNft);
        token.transfer(address(auction),1000 ether); auction.onTokensReceived();
        vm.deal(alice, 10 ether);
    }
    function completedBid() internal returns (uint256 id) {
        vm.roll(10);
        vm.prank(alice); id = auction.submitBid{value: 2 ether}(Q96, uint128(2 ether), alice, bytes(""));
        vm.roll(20); auction.checkpoint();
        assertTrue(auction.isGraduated()); auction.exitBid(id);
    }
    function testSingleClaimBlockedUntilGateAndCliff() public {
        uint256 id = completedBid();
        gate.setOpen(true);
        vm.expectRevert(); auction.claimTokens(id);
        vm.roll(30); gate.setOpen(false);
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(id);
        assertEq(token.balanceOf(alice), 0);
        gate.setOpen(true); auction.claimTokens(id);
        assertGt(token.balanceOf(alice), 0);
    }
    function testBatchClaimCannotBypassGate() public {
        uint256 id = completedBid(); vm.roll(30);
        uint256[] memory ids = new uint256[](1); ids[0] = id;
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokensBatch(alice, ids);
        gate.setOpen(true); auction.claimTokensBatch(alice, ids);
        assertGt(token.balanceOf(alice), 0);
    }
    function testGateRuntimeAndChainArePinned() public {
        uint256 id = completedBid(); vm.roll(30); gate.setOpen(true);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(id);
        vm.chainId(block.chainid - 1); vm.etch(address(gate), hex"00");
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(id);
    }
    function testSweepRequiresCoordinatorAndWorksBeforeClaims() public {
        completedBid();
        vm.expectRevert(); auction.sweepCurrency();
        gate.sweep(auction); assertGt(address(gate).balance, 0);
        assertEq(token.balanceOf(alice), 0);
    }
    function testUngradulatedAuctionRefundUnaffectedByClaimGate() public {
        AuctionParameters memory p = parameters(address(gate)); p.requiredCurrencyRaised = 100 ether;
        OmertaGuardedAuction failed = new OmertaGuardedAuction(address(token), 1000 ether, p, gate, characterNft);
        token.transfer(address(failed),1000 ether); failed.onTokensReceived(); vm.roll(10);
        vm.prank(alice); uint256 id = failed.submitBid{value: 1 ether}(Q96, uint128(1 ether), alice, bytes(""));
        vm.prank(alice); characterNft.transferFrom(alice, address(0xDEAD), 1);
        vm.roll(20); failed.checkpoint(); assertFalse(failed.isGraduated());
        uint256 beforeRefund = alice.balance; failed.exitBid(id);
        assertEq(alice.balance, beforeRefund + 1 ether);
    }
    function testRejectWrongGateConfiguration() public {
        AuctionParameters memory p = parameters(address(1));
        vm.expectRevert(OmertaGuardedAuction.InvalidLaunchGate.selector);
        new OmertaGuardedAuction(address(token), 1000 ether, p, gate, characterNft);
    }
}
