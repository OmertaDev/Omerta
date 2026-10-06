// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {GenesisCharacterMock} from "./helpers/GenesisCharacterMock.sol";
import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {GenesisPlayerSale, IGenesisPlayerIntegration} from "../src/GenesisPlayerSale.sol";

contract PlayerTokenMock is ERC20 {
    constructor() ERC20("OMR", "OMR") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
contract PlayerIntegrationMock is IGenesisPlayerIntegration {
    uint256 public playerPriceX96 = 1 << 96;
    bool public playerMigrationSucceeded;
    bool public playerClaimsOpen;
    bool public fail;
    function setFailure(bool value) external { fail = value; }
    function setClaims(bool value) external { playerClaimsOpen = value; }
    function finalizePlayerProceeds() external payable { require(!fail); playerMigrationSucceeded = true; }
    function release(GenesisPlayerSale sale) external { sale.releaseProceeds(); }
}
contract PlayerRefundReentrant {
    receive() external payable {
        try GenesisPlayerSale(msg.sender).refund() {} catch {}
    }
}
contract GenesisPlayerSaleTest is Test {
    GenesisCharacterMock characterNft;
    GenesisPlayerSale sale;
    PlayerTokenMock token;
    PlayerIntegrationMock integration;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    bytes32 aliceLeaf;
    bytes32 bobLeaf;
    function setUp() public {
        characterNft = new GenesisCharacterMock();
        characterNft.mint(alice); characterNft.mint(bob);
        token = new PlayerTokenMock(); integration = new PlayerIntegrationMock();
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        aliceLeaf = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, predicted, alice, uint8(1)))));
        bobLeaf = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, predicted, bob, uint8(5)))));
        bytes32 root = aliceLeaf < bobLeaf ? keccak256(abi.encodePacked(aliceLeaf, bobLeaf))
            : keccak256(abi.encodePacked(bobLeaf, aliceLeaf));
        sale = new GenesisPlayerSale(token, integration, root, 1 ether, block.timestamp + 1 days,
            block.timestamp + 5 days, address(0xCAFE), characterNft);
        assertEq(address(sale), predicted); token.mint(address(sale), 1 ether);
        vm.deal(alice, 10 ether); vm.deal(bob, 10 ether); sale.open();
    }
    function contribute(address who, uint8 daysPlayed, uint256 amount) internal {
        bytes32[] memory proof = new bytes32[](1); proof[0] = who == alice ? bobLeaf : aliceLeaf;
        vm.prank(who); sale.contribute{value: amount}(daysPlayed, proof);
    }
    function settleBoth() internal { vm.warp(sale.closesAt()); sale.settle(alice); sale.settle(bob); }
    function testTiersAndCumulativeCap() public {
        assertEq(sale.cap(1), 0.5 ether); assertEq(sale.cap(2), 1 ether);
        assertEq(sale.cap(3), 2.5 ether); assertEq(sale.cap(4), 5 ether); assertEq(sale.cap(5), 5 ether);
        contribute(alice, 1, 0.25 ether); contribute(alice, 1, 0.25 ether);
        vm.expectRevert(GenesisPlayerSale.InvalidEligibility.selector); contribute(alice, 1, 1);
        vm.expectRevert(GenesisPlayerSale.InvalidEligibility.selector); sale.cap(0);
        vm.expectRevert(GenesisPlayerSale.InvalidEligibility.selector); sale.cap(6);
    }
    function testWrongTierProofRejected() public {
        vm.expectRevert(GenesisPlayerSale.InvalidEligibility.selector); contribute(alice, 5, 1 ether);
    }
    function testChainReplayRejected() public {
        vm.chainId(block.chainid + 1);
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector); contribute(alice, 1, 0.5 ether);
    }
    function testRefundReentrancyCannotDrainOtherPrincipal() public {
        PlayerRefundReentrant receiver = new PlayerRefundReentrant(); vm.etch(alice, address(receiver).code);
        contribute(alice, 1, 0.5 ether); contribute(bob, 5, 1 ether);
        vm.warp(sale.migrationDeadline()); sale.cancel();
        vm.prank(alice); sale.refund(); assertEq(address(sale).balance, 1 ether);
        vm.prank(bob); sale.refund(); assertEq(address(sale).balance, 0);
    }
    function testWindowClosesExactlyAt48Hours() public {
        assertEq(sale.closesAt(), block.timestamp + 48 hours); vm.warp(sale.closesAt());
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector); contribute(alice, 1, 0.5 ether);
    }
    function testFuzzRoundingAtArbitraryPrice(uint128 deposit, uint128 supply, uint128 price) public pure {
        // Oversubscription rounding proof: per-wallet ceil(cost(floor(share))) never exceeds deposit.
        uint256 d = uint256(deposit) / 2 + 1; uint256 s = uint256(supply) / 2 + 1;
        uint256 p = uint256(price) / 2 + 1;
        uint256 q = 1 << 96;
        uint256 capacity = (s * p) / q;
        uint256 total = capacity + d + 1;
        uint256 tokens = (d * s) / total;
        uint256 payment = (tokens * p + q - 1) / q;
        assert(payment <= d);
    }
    function testProportionalRefundAndDelayedClaims() public {
        contribute(alice, 1, 0.5 ether); contribute(bob, 5, 1.5 ether); settleBoth();
        assertEq(sale.accepted(alice), 0.25 ether); assertEq(sale.allocation(bob), 0.75 ether);
        integration.release(sale); assertEq(address(integration).balance, 1 ether);
        vm.prank(alice); sale.refund(); assertEq(address(sale).balance, 0.75 ether);
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector); vm.prank(alice); sale.claim();
        integration.setClaims(true); vm.prank(alice); sale.claim(); assertEq(token.balanceOf(alice), 0.25 ether);
        vm.prank(bob); sale.refund(); assertEq(address(sale).balance, 0);
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector); vm.prank(bob); sale.refund();
    }
    function testMigrationFailureRollsBackAndTimeoutRefundsPrincipal() public {
        contribute(alice, 1, 0.5 ether); contribute(bob, 5, 1.5 ether); settleBoth(); integration.setFailure(true);
        vm.expectRevert(); integration.release(sale); assertFalse(sale.released()); assertEq(address(sale).balance, 2 ether);
        vm.warp(sale.migrationDeadline()); sale.cancel(); vm.prank(alice); sale.refund();
        vm.prank(bob); sale.refund(); assertEq(address(sale).balance, 0);
        sale.recoverUnsold(); assertEq(token.balanceOf(address(0xCAFE)), 1 ether);
    }
    function testUnsettledWalletBlocksReleaseAndAnyoneCanSettle() public {
        contribute(alice, 1, 0.5 ether); contribute(bob, 5, 1 ether); vm.warp(sale.closesAt()); sale.settle(alice);
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector); integration.release(sale);
        vm.prank(alice); sale.settle(bob); integration.release(sale);
    }
    function testFuzzSettlementSolvency(uint128 a, uint128 b) public {
        uint256 x = bound(a, 1, 0.5 ether); uint256 y = bound(b, 1, 5 ether);
        contribute(alice, 1, x); contribute(bob, 5, y); settleBoth();
        assertLe(sale.totalAllocated(), sale.inventory()); assertLe(sale.accepted(alice), x); assertLe(sale.accepted(bob), y);
        integration.release(sale); assertEq(address(sale).balance, x + y - sale.totalAccepted());
        vm.prank(alice); sale.refund(); vm.prank(bob); sale.refund(); assertEq(address(sale).balance, 0);
    }
}
