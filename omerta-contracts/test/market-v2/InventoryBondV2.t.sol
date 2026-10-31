// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {StabilityV2Fixture} from "./StabilityV2.t.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {OmertaInventoryBondV2 as Bond} from "../../src/market-v2/OmertaInventoryBondV2.sol";
import {OmertaRestrictedOMRV2 as RestrictedOMR} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";

/// Controlled pool reads isolate purchase eligibility; these are not oracle proofs.
contract InventoryBondPolicyFixtureV2 {
    address public immutable omr;
    uint16 public constant TRADE_FEE_BPS = 400;

    constructor(address token) { omr = token; }

    function revenuePolicyId() external pure returns (bytes32) {
        return keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_BTC_REWARDS_BOTH_DIRECTIONS");
    }

    function extsload(bytes32) external pure returns (bytes32) {
        // Sufficient pool liquidity, a nonzero sqrt price, and tick zero.
        return bytes32(uint256(1 ether));
    }
}

contract InventoryBondContractBuyerV2 {
    function buy(Bond bond, uint64 epoch, bytes32 nonce) external payable returns (bytes32 id, uint256 amount) {
        return bond.purchase{value: msg.value}(epoch, 1, uint64(block.timestamp + 60), nonce);
    }
}

contract InventoryBondV2Test is StabilityV2Fixture {
    Bond bond;
    Bond.Config bondConfig;
    address buyer = address(0xB01);
    address reserveRecipient = address(0xB02);

    function setUp() public override {
        super.setUp();
        // Existing pricing/vesting tests use unrestricted OMR; real recipient-policy tests are below.
        vm.mockCall(address(token), abi.encodeWithSelector(IOmertaRestrictedOMRV2.isRecipient.selector), abi.encode(true));
        vm.deal(buyer, 100 ether);
        Bond.Config memory c;
        c.safe = safe;
        c.proceedsRecipient = reserveRecipient;
        c.manager = manager;
        c.key = key;
        c.marketState = observations;
        c.maxObservationAge = 600;
        c.vestingSeconds = 30 days;
        c.minLiquidity = 1 ether;
        c.maxSpotDeviationTicks = 100;
        c.discountBps = 50;
        c.minNativePurchase = 0.1 ether;
        c.maxNativePurchase = 2 ether;
        c.maxNativePerEpoch = 3 ether;
        c.maxNativeLifetime = 5 ether;
        c.maxOmrPerPurchase = 3 ether;
        c.maxOmrPerEpoch = 4 ether;
        c.maxOmrLifetime = 7 ether;
        c.maxOmrPerEth = 2 ether;
        bondConfig = c;
        bond = new Bond(c);
        token.approve(address(bond), type(uint256).max);
        bond.fundInventory(10 ether);
        assertTrue(bond.paused(), "funding alone never enables purchases");
        vm.prank(safe);
        bond.setPaused(false);
    }

    function testBondStartsDormantAndOnlySafeCanEnableFundedSales() public {
        Bond dormant = new Bond(bondConfig);
        token.approve(address(dormant), 2 ether);
        dormant.fundInventory(2 ether);
        assertTrue(dormant.paused());
        vm.prank(buyer);
        vm.expectRevert(Bond.Unauthorized.selector);
        dormant.setPaused(false);
        vm.prank(buyer);
        vm.expectRevert(Bond.Paused.selector);
        dormant.purchase{value: 1 ether}(epoch, 1, uint64(vm.getBlockTimestamp() + 60), bytes32(uint256(1)));
        assertEq(dormant.availableInventory(), 2 ether);
        assertEq(dormant.outstandingClaims(), 0);
        assertEq(address(dormant).balance, 0);
        vm.prank(safe);
        dormant.setPaused(false);
        vm.prank(buyer);
        (, uint256 amount) = dormant.purchase{value: 1 ether}(epoch, 1, uint64(vm.getBlockTimestamp() + 60), bytes32(uint256(1)));
        assertEq(amount, uint256(1 ether) * 10000 / 9950);
        assertEq(dormant.vestingSeconds(), 30 days);
    }

    function testBondRejectsExcessDiscountAndShortVesting() public {
        Bond.Config memory c = bondConfig;
        c.discountBps = 51;
        vm.expectRevert(Bond.BadConfiguration.selector);
        new Bond(c);
        c.discountBps = 50;
        c.vestingSeconds = 30 days - 1;
        vm.expectRevert(Bond.BadConfiguration.selector);
        new Bond(c);
        c.vestingSeconds = 30 days;
        c.discountBps = 0;
        Bond zeroDiscount = new Bond(c);
        assertTrue(zeroDiscount.paused());
        assertEq(zeroDiscount.discountBps(), 0);
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
        assertEq(amount, uint256(1 ether) * 10000 / 9950);
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
        vm.warp(vm.getBlockTimestamp() + 15 days);
        bond.claim(id);
        assertEq(token.balanceOf(buyer), amount / 2);
        _assertBondCustody();
        vm.warp(vm.getBlockTimestamp() + 15 days);
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
        vm.warp(vm.getBlockTimestamp() + 30 days);
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
        vm.warp(vm.getBlockTimestamp() + bound(elapsed, 1, 60 days));
        uint256 due = bond.claimable(id);
        assertLe(due, amount);
        if (due > 0) bond.claim(id);
        assertEq(token.balanceOf(buyer) + bond.outstandingClaims(), amount);
        _assertBondCustody();
    }

    function _restrictedBond(bool admittedBuyer)
        internal
        returns (RestrictedOMR restricted, Bond restrictedBond, address contractBuyer)
    {
        restricted = new RestrictedOMR(address(this));
        InventoryBondPolicyFixtureV2 policy = new InventoryBondPolicyFixtureV2(address(restricted));
        Bond.Config memory c = bondConfig;
        c.manager = IPoolManager(address(policy));
        c.key.currency1 = Currency.wrap(address(restricted));
        restrictedBond = new Bond(c);
        contractBuyer = address(new InventoryBondContractBuyerV2());
        restricted.bindSettlementManager(address(policy), address(policy).codehash);
        restricted.setOperator(
            address(restrictedBond), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(restrictedBond).codehash
        );
        if (admittedBuyer) restricted.setContractHolder(contractBuyer, contractBuyer.codehash);
        restricted.sealPolicy();
        restricted.approve(address(restrictedBond), 10 ether);
        restrictedBond.fundInventory(10 ether);
        vm.prank(safe);
        restrictedBond.setPaused(false);
        vm.deal(contractBuyer, 2 ether);
    }

    function testBondRejectsUnsupportedContractBeforeAcceptingPayment() public {
        (RestrictedOMR restricted, Bond restrictedBond, address contractBuyer) = _restrictedBond(false);
        assertFalse(restricted.isRecipient(contractBuyer));
        vm.expectRevert(Bond.InvalidRecipient.selector);
        InventoryBondContractBuyerV2(contractBuyer).buy{value: 1 ether}(
            restrictedBond, epoch, bytes32(uint256(1))
        );
        assertEq(contractBuyer.balance, 2 ether);
        assertEq(address(restrictedBond).balance, 0);
        assertEq(restrictedBond.proceedsOwed(), 0);
        assertEq(restrictedBond.outstandingClaims(), 0);
        assertEq(restrictedBond.nativePurchased(), 0);
        assertEq(restrictedBond.availableInventory(), 10 ether);
    }

    function testBondWalletCanRegisterThenRetryAndClaimDuringPauseAndOracleOutage() public {
        (RestrictedOMR restricted, Bond restrictedBond,) = _restrictedBond(false);
        assertFalse(restricted.isRecipient(buyer));
        vm.prank(buyer, buyer);
        vm.expectRevert(Bond.InvalidRecipient.selector);
        restrictedBond.purchase{value: 1 ether}(
            epoch, 1, uint64(vm.getBlockTimestamp() + 60), bytes32(uint256(1))
        );
        vm.prank(buyer, buyer);
        restricted.registerWallet(buyer);
        vm.prank(buyer, buyer);
        (bytes32 id, uint256 amount) = restrictedBond.purchase{value: 1 ether}(
            epoch, 1, uint64(vm.getBlockTimestamp() + 60), bytes32(uint256(1))
        );
        vm.prank(safe);
        restrictedBond.setPaused(true);
        observations.setBroken(true);
        vm.warp(vm.getBlockTimestamp() + 30 days);
        restrictedBond.claim(id);
        assertEq(restricted.balanceOf(buyer), amount);
        assertEq(restrictedBond.outstandingClaims(), 0);
    }

    function testBondAdmittedContractCanPurchaseAndReceiveVestedClaim() public {
        (RestrictedOMR restricted, Bond restrictedBond, address contractBuyer) = _restrictedBond(true);
        assertTrue(restricted.isRecipient(contractBuyer));
        (bytes32 id, uint256 amount) = InventoryBondContractBuyerV2(contractBuyer).buy{value: 1 ether}(
            restrictedBond, epoch, bytes32(uint256(1))
        );
        vm.warp(vm.getBlockTimestamp() + 30 days);
        vm.prank(address(0xBAD));
        restrictedBond.claim(id);
        assertEq(restricted.balanceOf(contractBuyer), amount);
        assertEq(restrictedBond.outstandingClaims(), 0);
        assertEq(restricted.balanceOf(address(restrictedBond)), restrictedBond.availableInventory());
    }
}
