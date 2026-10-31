// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {GenesisPlayerSale} from "../src/GenesisPlayerSale.sol";
import {GenesisCharacterPlayerSale} from "../src/GenesisCharacterPlayerSale.sol";
import {GenesisCharacterEligibility} from "../src/genesis-auction/GenesisCharacterEligibility.sol";
import {GenesisCharacterMock} from "./helpers/GenesisCharacterMock.sol";
import {PlayerTokenMock, PlayerIntegrationMock} from "./GenesisPlayerSale.t.sol";

contract GenesisCharacterPlayerSaleTest is Test {
    PlayerTokenMock token;
    PlayerIntegrationMock integration;
    GenesisCharacterMock character;
    GenesisCharacterPlayerSale sale;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);

    function setUp() public {
        token = new PlayerTokenMock();
        integration = new PlayerIntegrationMock();
        character = new GenesisCharacterMock();
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        bytes32 root = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, predicted, alice, uint8(2)))));
        sale = new GenesisCharacterPlayerSale(token, integration, root, 0.5 ether,
            block.timestamp + 1 days, block.timestamp + 5 days, address(0xCAFE), character);
        assertEq(address(sale), predicted);
        token.mint(address(sale), 0.5 ether);
        vm.deal(alice, 3 ether);
        vm.deal(bob, 1 ether);
        sale.open();
    }

    function _contribute(uint256 amount) internal {
        vm.prank(alice);
        sale.contribute{value: amount}(2, new bytes32[](0));
    }

    function testCharacterOwnershipRequiredForEveryContribution() public {
        vm.expectRevert(GenesisCharacterEligibility.CharacterNftRequired.selector);
        _contribute(0.25 ether);
        assertEq(address(sale).balance, 0);
        character.mint(alice);
        _contribute(0.25 ether);
        vm.prank(alice);
        character.transferFrom(alice, bob, 1);
        vm.expectRevert(GenesisCharacterEligibility.CharacterNftRequired.selector);
        _contribute(0.25 ether);
        assertEq(sale.requested(alice), 0.25 ether);
        assertEq(address(sale).balance, 0.25 ether);
    }

    function testNftOwnershipDoesNotReplaceSnapshotProof() public {
        character.mint(bob);
        vm.prank(bob);
        vm.expectRevert(GenesisPlayerSale.InvalidEligibility.selector);
        sale.contribute{value: 1 wei}(2, new bytes32[](0));
        assertEq(sale.participantCount(), 0);
    }

    function testCharacterRuntimeChangeStopsFreshContributions() public {
        character.mint(alice);
        vm.etch(address(character), hex"00");
        vm.expectRevert(GenesisCharacterEligibility.CharacterNftRequired.selector);
        _contribute(0.25 ether);
        assertEq(sale.participantCount(), 0);
    }

    function testAllocationAndRefundRemainAvailableAfterOwnershipLoss() public {
        character.mint(alice);
        _contribute(1 ether);
        uint256 beforeRefund = alice.balance;
        vm.prank(alice);
        character.transferFrom(alice, bob, 1);
        vm.warp(sale.closesAt());
        sale.settle(alice);
        integration.release(sale);
        integration.setClaims(true);
        vm.prank(alice);
        sale.claim();
        vm.prank(alice);
        sale.refund();
        assertEq(token.balanceOf(alice), 0.5 ether);
        assertEq(alice.balance, beforeRefund + 0.5 ether);
        assertEq(address(sale).balance, 0);
        assertEq(character.balanceOf(alice), 0);
    }

    function testCancellationRefundDoesNotQueryCharacterContract() public {
        character.mint(alice);
        _contribute(1 ether);
        uint256 beforeRefund = alice.balance;
        vm.etch(address(character), hex"00");
        vm.warp(sale.migrationDeadline());
        sale.cancel();
        vm.prank(alice);
        sale.refund();
        assertEq(alice.balance, beforeRefund + 1 ether);
        assertEq(address(sale).balance, 0);
    }

    function testBasePlayerSaleRetainsPublicSnapshotEligibility() public {
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        bytes32 root = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, predicted, alice, uint8(2)))));
        GenesisPlayerSale publicSale = new GenesisPlayerSale(token, integration, root, 1 ether,
            block.timestamp + 1 days, block.timestamp + 5 days, address(0xCAFE));
        token.mint(address(publicSale), 1 ether);
        publicSale.open();
        vm.prank(alice);
        publicSale.contribute{value: 0.5 ether}(2, new bytes32[](0));
        assertEq(publicSale.requested(alice), 0.5 ether);
        assertEq(character.balanceOf(alice), 0);
    }

    function testCharacterSaleRejectsMissingCharacterContract() public {
        vm.expectRevert(GenesisCharacterEligibility.InvalidCharacterNft.selector);
        new GenesisCharacterPlayerSale(token, integration, bytes32(uint256(1)), 1 ether,
            block.timestamp + 1 days, block.timestamp + 5 days, address(0xCAFE), IERC721(address(0)));
    }
}
