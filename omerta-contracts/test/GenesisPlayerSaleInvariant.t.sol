// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {GenesisCharacterMock} from "./helpers/GenesisCharacterMock.sol";
import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {GenesisPlayerSale} from "../src/GenesisPlayerSale.sol";
import {PlayerTokenMock, PlayerIntegrationMock} from "./GenesisPlayerSale.t.sol";

contract PlayerSaleHandler is Test {
    GenesisPlayerSale public immutable sale;
    PlayerIntegrationMock public immutable integration;
    bytes32[4] internal leaves;
    uint256 public refundedETH;
    uint256 public paidETH;
    uint256 public attempts;

    constructor(GenesisPlayerSale sale_, PlayerIntegrationMock integration_, bytes32[4] memory leaves_) {
        sale = sale_; integration = integration_; leaves = leaves_;
    }
    function wallet(uint256 i) public pure returns (address) { return address(uint160(0x1000 + i)); }
    function pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
    function contribute(uint8 index, uint128 amount, bool wrongTier) external {
        attempts++;
        uint256 i = index % 4; address who = wallet(i);
        bytes32[] memory proof = new bytes32[](2);
        proof[0] = leaves[i ^ 1]; proof[1] = i < 2 ? pair(leaves[2], leaves[3]) : pair(leaves[0], leaves[1]);
        uint256 value = bound(amount, 1, 6 ether);
        uint256 beforeRequested = sale.requested(who);
        bool ownsCharacter = sale.characterNft().balanceOf(who) != 0;
        vm.prank(who);
        try sale.contribute{value: value}(wrongTier ? uint8(5) : uint8(i + 1), proof) {} catch {}
        if (!ownsCharacter) assertEq(sale.requested(who), beforeRequested);
    }
    function transferCharacter(uint8 tokenIndex, uint8 recipientIndex) external {
        uint256 id = uint256(tokenIndex % 4) + 1;
        address owner = sale.characterNft().ownerOf(id);
        vm.prank(owner);
        sale.characterNft().transferFrom(owner, wallet(recipientIndex % 4), id);
    }
    function settle(uint8 index, bool closeFirst) external {
        if (closeFirst && block.timestamp < sale.closesAt()) vm.warp(sale.closesAt());
        try sale.settle(wallet(index % 4)) {} catch {}
    }
    function release(bool forceFailure) external {
        if (block.timestamp < sale.closesAt()) vm.warp(sale.closesAt());
        for (uint256 i; i < 4; ++i) {
            try sale.settle(wallet(i)) {} catch {}
        }
        integration.setFailure(forceFailure);
        try integration.release(sale) { paidETH = sale.totalAccepted(); } catch {}
    }
    function timeout(bool expire) external {
        if (expire) vm.warp(sale.migrationDeadline());
        try sale.cancel() {} catch {}
    }
    function refund(uint8 index) external {
        address who = wallet(index % 4);
        uint256 beforeBalance = who.balance;
        vm.prank(who);
        try sale.refund() { refundedETH += who.balance - beforeBalance; } catch {}
    }
    function claim(uint8 index, bool openClaims) external {
        // The production adapter owns this gate; only this handler drives the trusted mock.
        integration.setClaims(openClaims && sale.released());
        vm.prank(wallet(index % 4));
        try sale.claim() {} catch {}
    }
}

contract GenesisPlayerSaleInvariantTest is StdInvariant, Test {
    GenesisCharacterMock characterNft;
    GenesisPlayerSale sale;
    PlayerTokenMock token;
    PlayerIntegrationMock integration;
    PlayerSaleHandler handler;
    function pair(bytes32 a, bytes32 b) internal pure returns (bytes32) {
        return a < b ? keccak256(abi.encodePacked(a, b)) : keccak256(abi.encodePacked(b, a));
    }
    function setUp() public {
        characterNft = new GenesisCharacterMock();
        token = new PlayerTokenMock(); integration = new PlayerIntegrationMock();
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        bytes32[4] memory leaves;
        for (uint256 i; i < 4; ++i) {
            address who = address(uint160(0x1000 + i)); vm.deal(who, 1000 ether); characterNft.mint(who);
            leaves[i] = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, predicted, who, uint8(i + 1)))));
        }
        sale = new GenesisPlayerSale(token, integration, pair(pair(leaves[0], leaves[1]), pair(leaves[2], leaves[3])),
            2 ether, block.timestamp + 1 days, block.timestamp + 5 days, address(0xCAFE), characterNft);
        token.mint(address(sale), 2 ether); sale.open();
        handler = new PlayerSaleHandler(sale, integration, leaves);
        vm.deal(address(handler), 1000 ether);
        // Begin every history with live liabilities for every tier; empty escrow cannot
        // make the conservation and cancellation properties pass vacuously.
        for (uint8 i; i < 4; ++i) handler.contribute(i, 0.25 ether, false);
        assertEq(sale.participantCount(), 4);
        targetContract(address(handler));
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = handler.contribute.selector; selectors[1] = handler.settle.selector;
        selectors[2] = handler.release.selector; selectors[3] = handler.timeout.selector;
        selectors[4] = handler.refund.selector; selectors[5] = handler.claim.selector;
        selectors[6] = handler.transferCharacter.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }
    function invariantCapsAndSettlementAccounting() public view {
        uint256 requests; uint256 accepted; uint256 allocations;
        for (uint256 i; i < 4; ++i) {
            address who = handler.wallet(i);
            uint256 deposited = sale.requested(who);
            assertLe(deposited, sale.cap(uint8(i + 1)));
            assertLe(sale.accepted(who), deposited);
            requests += deposited; accepted += sale.accepted(who); allocations += sale.allocation(who);
            if (sale.claimed(who)) assertTrue(sale.released() && !sale.cancelled());
        }
        assertEq(requests, sale.totalRequested()); assertEq(accepted, sale.totalAccepted());
        assertEq(allocations, sale.totalAllocated()); assertLe(accepted, requests); assertLe(allocations, sale.inventory());
        assertLe(sale.settledCount(), sale.participantCount());
    }
    function invariantETHReservesAlwaysCoverLiabilities() public view {
        assertEq(address(sale).balance, sale.totalRequested() - handler.paidETH() - handler.refundedETH());
        assertEq(address(integration).balance, handler.paidETH());
        if (sale.released()) {
            assertFalse(sale.cancelled()); assertTrue(integration.playerMigrationSucceeded());
            assertEq(sale.participantCount(), sale.settledCount());
        } else assertEq(handler.paidETH(), 0);
    }
    function invariantTokenCustodyCoversUnclaimedAllocations() public view {
        uint256 claimedTokens;
        for (uint256 i; i < 4; ++i) claimedTokens += token.balanceOf(handler.wallet(i));
        assertEq(token.balanceOf(address(sale)) + claimedTokens, sale.inventory());
    }
    function afterInvariant() public {
        // Every generated history must retain a complete exit, even if settlement stalled.
        if (!sale.released() && !sale.cancelled()) {
            vm.warp(sale.migrationDeadline()); sale.cancel();
        }
        for (uint256 i; i < 4; ++i) handler.refund(uint8(i));
        assertEq(address(sale).balance, 0);
        if (!sale.released()) assertEq(handler.refundedETH(), sale.totalRequested());
    }
}
