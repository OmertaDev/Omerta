// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StabilityV2Fixture} from "./StabilityV2.t.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {OmertaInventoryBondV2 as Bond} from "../../src/market-v2/OmertaInventoryBondV2.sol";

contract InventoryBondV2Test is StabilityV2Fixture {
    Bond bond;
    address buyer = address(0xB01);
    address reserveRecipient = address(0xB02);

    function setUp() public override {
        super.setUp();
        vm.deal(buyer, 100 ether);
        Bond.Config memory c;
        c.safe = safe;
        c.proceedsRecipient = reserveRecipient;
        c.manager = manager;
        c.key = key;
        c.marketState = observations;
        c.maxObservationAge = 600;
        c.vestingSeconds = 7 days;
        c.minLiquidity = 1 ether;
        c.maxSpotDeviationTicks = 100;
        c.discountBps = 500;
        c.minNativePurchase = 0.1 ether;
        c.maxNativePurchase = 2 ether;
        c.maxNativePerEpoch = 3 ether;
        c.maxNativeLifetime = 5 ether;
        c.maxOmrPerPurchase = 3 ether;
        c.maxOmrPerEpoch = 4 ether;
        c.maxOmrLifetime = 7 ether;
        c.maxOmrPerEth = 2 ether;
        bond = new Bond(c);
        token.approve(address(bond), type(uint256).max);
        bond.fundInventory(10 ether);
    }

    function _purchase(uint256 amount, uint256 nonce) internal returns (bytes32 id, uint256 reserved) {
        vm.prank(buyer);
        return bond.purchase{value: amount}(epoch, 1, uint64(vm.getBlockTimestamp() + 60), bytes32(nonce));
    }

    function _assertBondCustody() internal view {
        assertEq(token.balanceOf(address(bond)), bond.availableInventory() + bond.outstandingClaims());
        assertEq(address(bond).balance, bond.proceedsOwed());
    }

    function testBondReservesFundedInventoryWithoutMinting() public {
        uint256 supply = token.totalSupply();
        (bytes32 id, uint256 amount) = _purchase(1 ether, 1);
        assertEq(amount, uint256(1 ether) * 10000 / 9500);
        assertEq(token.totalSupply(), supply);
        assertEq(token.balanceOf(buyer), 0);
        assertEq(bond.claimable(id), 0);
        assertEq(bond.outstandingClaims(), amount);
        _assertBondCustody();
    }

    function testBondLinearVestingSurvivesPauseAndOracleOutage() public {
        (bytes32 id, uint256 amount) = _purchase(1 ether, 1);
        vm.prank(safe);
        bond.setPaused(true);
        observations.setBroken(true);
        vm.warp(vm.getBlockTimestamp() + 3.5 days);
        bond.claim(id);
        assertEq(token.balanceOf(buyer), amount / 2);
        _assertBondCustody();
        vm.warp(vm.getBlockTimestamp() + 3.5 days);
        bond.claim(id);
        assertEq(token.balanceOf(buyer), amount);
        assertEq(bond.outstandingClaims(), 0);
        vm.expectRevert(Bond.NoClaim.selector);
        bond.claim(id);
        _assertBondCustody();
    }

    function testBondClaimsCannotBeRetiredOrRedirected() public {
        (bytes32 id, uint256 amount) = _purchase(1 ether, 1);
        vm.prank(safe);
        vm.expectRevert(Bond.InsufficientInventory.selector);
        bond.retireInventory(10 ether);
        vm.prank(safe);
        bond.retireInventory(10 ether - amount);
        assertEq(token.balanceOf(address(bond)), amount);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        vm.prank(address(0xBAD));
        bond.claim(id);
        assertEq(token.balanceOf(buyer), amount);
        _assertBondCustody();
    }

    function testBondNativeProceedsFixedRecipientAndIndependentClaims() public {
        _purchase(1 ether, 1);
        vm.prank(address(0xBAD));
        bond.claimProceeds();
        assertEq(reserveRecipient.balance, 1 ether);
        assertEq(bond.proceedsOwed(), 0);
        _assertBondCustody();
    }

    function testBondDuplicateNonceCannotReserveTwice() public {
        _purchase(1 ether, 1);
        vm.expectRevert(Bond.Replay.selector);
        _purchase(1 ether, 1);
        assertEq(bond.nativePurchased(), 1 ether);
        _assertBondCustody();
    }

    function testBondAggregateEpochAndLifetimeCapsAcrossAccounts() public {
        _purchase(2 ether, 1);
        vm.expectRevert(Bond.BudgetExceeded.selector);
        _purchase(2 ether, 2);
        _purchase(1 ether, 3);
        _next(0, 0);
        _purchase(2 ether, 4);
        _next(0, 0);
        vm.expectRevert(Bond.BudgetExceeded.selector);
        _purchase(0.1 ether, 5);
        assertEq(bond.nativePurchased(), 5 ether);
        _assertBondCustody();
    }

    function testBondMinimumOutAndExpectedEpochAreBinding() public {
        vm.prank(buyer);
        vm.expectRevert(Bond.InvalidQuote.selector);
        bond.purchase{value: 1 ether}(epoch, 2 ether, uint64(vm.getBlockTimestamp() + 60), bytes32(uint256(1)));
        vm.prank(buyer);
        vm.expectRevert(Bond.InvalidObservation.selector);
        bond.purchase{value: 1 ether}(epoch + 1, 1, uint64(vm.getBlockTimestamp() + 60), bytes32(uint256(1)));
        _assertBondCustody();
    }

    function testBondRefusesUnfundedPurchaseAndExcessOracleRate() public {
        vm.prank(safe);
        bond.retireInventory(10 ether);
        vm.expectRevert(Bond.InsufficientInventory.selector);
        _purchase(1 ether, 1);
        observations.set(
            IOmertaMarketStateV2.Snapshot(
                ++epoch, uint64(vm.getBlockTimestamp()), 0, 0, 1000 ether, 3 ether, 0, 0, true
            )
        );
        vm.expectRevert(Bond.InvalidObservation.selector);
        _purchase(1 ether, 2);
    }

    function testBondRejectsStaleDataAndCurrentSpotManipulation() public {
        vm.warp(vm.getBlockTimestamp() + 601);
        vm.expectRevert(Bond.InvalidObservation.selector);
        _purchase(1 ether, 1);
        _reading(0, 0, 0);
        _sellTo(200);
        vm.expectRevert(Bond.InvalidObservation.selector);
        _purchase(1 ether, 2);
    }

    function testBondEpochNumberCannotRefreshBudgetAtSameObservationTime() public {
        _purchase(2 ether, 1);
        _purchase(1 ether, 2);
        _reading(0, 0, 0);
        vm.expectRevert(Bond.InvalidObservation.selector);
        _purchase(1 ether, 3);
        assertEq(bond.nativePurchased(), 3 ether);
        _assertBondCustody();
    }

    function testBondPauseOnlyStopsNewPurchases() public {
        _purchase(1 ether, 1);
        vm.prank(safe);
        bond.setPaused(true);
        vm.expectRevert(Bond.Paused.selector);
        _purchase(1 ether, 2);
        bond.fundInventory(1 ether);
        bond.claimProceeds();
        assertEq(reserveRecipient.balance, 1 ether);
        _assertBondCustody();
    }

    function testFuzzBondVestingNeverExceedsFundedClaims(uint32 elapsed, uint96 nativeAmount) public {
        uint256 paid = bound(nativeAmount, 0.1 ether, 2 ether);
        (bytes32 id, uint256 amount) = _purchase(paid, 1);
        vm.warp(vm.getBlockTimestamp() + bound(elapsed, 1, 14 days));
        uint256 due = bond.claimable(id);
        assertLe(due, amount);
        if (due > 0) bond.claim(id);
        assertEq(token.balanceOf(buyer) + bond.outstandingClaims(), amount);
        _assertBondCustody();
    }
}
