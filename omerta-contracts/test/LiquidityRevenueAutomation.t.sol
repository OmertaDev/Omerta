// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Vm} from "forge-std/Vm.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OmertaFees} from "../src/OmertaFees.sol";
import {FeeRevenueRouter, IFeeRevenueRouter} from "../src/FeeRevenueRouter.sol";
import {KeeperGasVault} from "../src/KeeperGasVault.sol";

contract LiquidityAutomationReceiver {
    bool public rejects;
    uint256 public received;
    uint256 public callbacks;
    address public nestedTarget;
    bytes public nestedData;
    uint256 public nestedValue;
    bool public nestedSucceeded;
    bytes4 public nestedError;

    function setReject(bool value) external { rejects = value; }
    function arm(address target, bytes calldata data, uint256 value) external {
        nestedTarget = target;
        nestedData = data;
        nestedValue = value;
    }
    function spend(address payable recipient, uint256 amount) external {
        (bool ok,) = recipient.call{value: amount}("");
        require(ok);
    }
    receive() external payable {
        if (rejects) revert("recipient rejected");
        received += msg.value;
        callbacks++;
        if (nestedTarget != address(0)) {
            bytes memory reason;
            (nestedSucceeded, reason) = nestedTarget.call{value: nestedValue}(nestedData);
            if (reason.length >= 4) nestedError = bytes4(reason);
        }
    }
}

/// @dev Mutable policy pretender proves binding checks rerun at payment time. Runtime verification
///      is a deployment responsibility: matching getters alone do not make a router trustworthy.
contract LiquidityAutomationMutableRouter is IFeeRevenueRouter {
    bytes32 public policyId = keccak256("OMERTA_NON_MINT_FEE_ROUTER_V1_5000_2500_1000_1500");
    address public feeContract;
    address payable public devRecipient;
    address payable public vigRecipient;
    address payable public treasuryRecipient;
    address payable public communityRecipient;
    uint256 public devBps = 5000;
    uint256 public vigBps = 2500;
    uint256 public treasuryBps = 1000;
    uint256 public communityBps = 1500;
    uint256 public calls;
    constructor(OmertaFees fees, address payable treasury, address payable community) {
        feeContract = address(fees);
        devRecipient = fees.feeRecipient();
        vigRecipient = fees.vigRecipient();
        treasuryRecipient = treasury;
        communityRecipient = community;
    }
    function corrupt(uint8 field) external {
        if (field == 0) policyId = bytes32(0);
        else if (field == 1) feeContract = address(0);
        else if (field == 2) devRecipient = payable(address(1));
        else if (field == 3) vigRecipient = payable(address(1));
        else if (field == 4) treasuryRecipient = payable(address(0));
        else if (field == 5) communityRecipient = payable(address(0));
        else if (field == 6) devBps = 4999;
        else if (field == 7) vigBps = 2501;
        else if (field == 8) treasuryBps = 1001;
        else communityBps = 1501;
    }
    function route(uint256) external payable { calls++; }
}

contract LiquidityAutomationForceETH {
    constructor(address payable destination) payable { selfdestruct(destination); }
}

contract LiquidityRevenueAutomationTest is Test {
    OmertaFees internal fees;
    FeeRevenueRouter internal router;
    LiquidityAutomationReceiver internal dev;
    LiquidityAutomationReceiver internal vig;
    LiquidityAutomationReceiver internal treasury;
    LiquidityAutomationReceiver internal community;
    address internal payer = address(0xA11CE);

    function setUp() public {
        dev = new LiquidityAutomationReceiver();
        vig = new LiquidityAutomationReceiver();
        treasury = new LiquidityAutomationReceiver();
        community = new LiquidityAutomationReceiver();
        fees = new OmertaFees(address(this), payable(address(dev)), payable(address(vig)), 2500, 101, 203);
        router = new FeeRevenueRouter(address(fees), payable(address(dev)), payable(address(vig)),
            payable(address(treasury)), payable(address(community)));
        fees.setNonMintRouter(router);
        fees.setPackagePrice(7, 509);
        vm.deal(payer, 100 ether);
        vm.deal(address(this), 100 ether);
    }
    receive() external payable {}

    function _pay(uint8 kind, uint256 amount) internal {
        vm.prank(payer);
        if (kind == 0) fees.payRespawnFee{value: amount}();
        else if (kind == 1) fees.payRerollFee{value: amount}();
        else fees.payForPackage{value: amount}(7);
    }

    function _assertEmpty() internal view {
        assertEq(fees.nonce(), 0);
        assertEq(router.lastNonce(), 0);
        assertEq(dev.received() + vig.received() + treasury.received() + community.received(), 0);
        assertEq(address(fees).balance, 0);
        assertEq(address(router).balance, 0);
        assertEq(payer.balance, 100 ether);
    }

    function test_mintBypassesRouterAndRejectingNonDevRecipients() public {
        vig.setReject(true);
        treasury.setReject(true);
        community.setReject(true);
        vm.expectEmit(true, false, false, true, address(fees));
        emit OmertaFees.FeeSplit(1, 101, 0);
        vm.expectEmit(true, true, false, true, address(fees));
        emit OmertaFees.MintFeePaid(payer, 1, 101);
        vm.prank(payer);
        fees.payMintFee{value: 101}();
        assertEq(fees.mintDevBps(), 10000);
        assertEq(dev.received(), 101);
        assertEq(router.lastNonce(), 0);
        assertEq(vig.callbacks() + treasury.callbacks() + community.callbacks(), 0);
    }

    function test_threeNonMintKindsEmitTruthfulFourWayDistributionAndGrossEntitlements() public {
        vm.recordLogs();
        _pay(0, 203);
        _pay(1, 101);
        _pay(2, 509);
        Vm.Log[] memory logs = vm.getRecordedLogs();
        bytes32 revenue = keccak256("RevenueRouted(uint256,uint256,address,uint256,address,uint256,address,uint256,address,uint256)");
        bytes32 routed = keccak256("NonMintFeeRouted(uint256,address,uint256)");
        bytes32 oldSplit = keccak256("FeeSplit(uint256,uint256,uint256)");
        uint256 routedEvents;
        uint256 revenueEvents;
        for (uint256 i; i < logs.length; i++) {
            assertTrue(logs[i].topics[0] != oldSplit, "two-leg event must not misstate four-way payments");
            if (logs[i].topics[0] == revenue) {
                assertEq(logs[i].emitter, address(router));
                uint256 gross = revenueEvents == 0 ? 203 : revenueEvents == 1 ? 101 : 509;
                assertEq(logs[i].topics[1], bytes32(revenueEvents + 1));
                assertEq(logs[i].data, abi.encode(gross, address(dev), gross - gross / 4 - gross / 10 - gross * 15 / 100,
                    address(vig), gross / 4, address(treasury), gross / 10, address(community), gross * 15 / 100));
                revenueEvents++;
            }
            if (logs[i].topics[0] == routed) {
                assertEq(logs[i].emitter, address(fees));
                assertEq(address(uint160(uint256(logs[i].topics[2]))), address(router));
                routedEvents++;
            }
        }
        assertEq(revenueEvents, 3);
        assertEq(routedEvents, 3);
        assertEq(dev.received(), 410);
        assertEq(vig.received(), 202);
        assertEq(treasury.received(), 80);
        assertEq(community.received(), 121);
        assertEq(fees.nonce(), 3);
        assertEq(router.lastNonce(), 3);
        assertEq(address(fees).balance + address(router).balance, 0);
    }

    function testFuzz_nonMintDistributionConservesEveryWei(uint96 seed, uint8 kindSeed) public {
        uint256 amount = bound(seed, 1, 100 ether);
        fees.setFees(amount, amount);
        fees.setRerollFee(amount);
        fees.setPackagePrice(7, amount);
        _pay(kindSeed % 3, amount);
        assertEq(vig.received(), amount / 4);
        assertEq(treasury.received(), amount / 10);
        assertEq(community.received(), amount * 15 / 100);
        assertEq(dev.received(), amount - amount / 4 - amount / 10 - amount * 15 / 100);
        assertEq(dev.received() + vig.received() + treasury.received() + community.received(), amount);
        assertEq(address(fees).balance + address(router).balance, 0);
        assertEq(payer.balance, 100 ether - amount);
    }

    function test_oneWeiSkipsEveryZeroShareAndPaysDev() public {
        fees.setRerollFee(1);
        vig.setReject(true);
        treasury.setReject(true);
        community.setReject(true);
        _pay(1, 1);
        assertEq(dev.received(), 1);
        assertEq(dev.callbacks(), 1);
        assertEq(vig.callbacks() + treasury.callbacks() + community.callbacks(), 0);
    }

    function testFuzz_rejectingAnyRecipientRevertsBothNoncesAndAllPriorPayments(uint8 recipientSeed) public {
        LiquidityAutomationReceiver[4] memory recipients = [vig, treasury, community, dev];
        LiquidityAutomationReceiver bad = recipients[recipientSeed % 4];
        bad.setReject(true);
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(FeeRevenueRouter.TransferFailed.selector, address(bad)));
        fees.payRespawnFee{value: 203}();
        _assertEmpty();
        for (uint256 i; i < recipients.length; i++) assertEq(recipients[i].callbacks(), 0);
        bad.setReject(false);
        _pay(0, 203);
        assertEq(fees.nonce(), 1);
        assertEq(router.lastNonce(), 1);
    }

    function test_wrongFeeCannotReachRouter() public {
        vm.prank(payer);
        vm.expectRevert(abi.encodeWithSelector(OmertaFees.WrongFee.selector, 204, 203));
        fees.payRespawnFee{value: 204}();
        _assertEmpty();
    }

    function test_onlyBoundRailMayRouteAndNoncesCannotReplay() public {
        vm.prank(payer);
        vm.expectRevert(FeeRevenueRouter.NotFeeContract.selector);
        router.route{value: 203}(1);
        _assertEmpty();
        _pay(0, 203);
        vm.deal(address(fees), 1000);
        vm.prank(address(fees));
        vm.expectRevert(FeeRevenueRouter.Replay.selector);
        router.route{value: 203}(1);
        vm.prank(address(fees));
        vm.expectRevert(FeeRevenueRouter.Replay.selector);
        router.route{value: 203}(0);
        vm.prank(address(fees));
        vm.expectRevert(FeeRevenueRouter.ZeroAmount.selector);
        router.route(2);
        assertEq(router.lastNonce(), 1);
    }

    function test_mintAndDisabledIntervalsDoNotBreakRouterNonceSequence() public {
        _pay(0, 203);
        vm.prank(payer);
        fees.payMintFee{value: 101}();
        fees.setNonMintRouter(IFeeRevenueRouter(address(0)));
        _pay(1, 101);
        fees.setNonMintRouter(router);
        _pay(2, 509);
        assertEq(fees.nonce(), 4);
        assertEq(router.lastNonce(), 4);
        assertEq(treasury.received(), 70);
        assertEq(community.received(), 106);
    }

    function test_legacyModeStillSplitsDevVigOnly() public {
        fees.setNonMintRouter(IFeeRevenueRouter(address(0)));
        vm.expectEmit(true, false, false, true, address(fees));
        emit OmertaFees.FeeSplit(1, 153, 50);
        _pay(0, 203);
        assertEq(dev.received(), 153);
        assertEq(vig.received(), 50);
        assertEq(treasury.received() + community.received(), 0);
        assertEq(router.lastNonce(), 0);
    }

    function test_routerAndRecipientAdministrationCannotBeCalledByStranger() public {
        vm.startPrank(payer);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        fees.setNonMintRouter(IFeeRevenueRouter(address(0)));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        fees.setFeeRecipient(payable(payer));
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, payer));
        fees.setVigRecipient(payable(payer));
        vm.stopPrank();
    }

    function test_activeRouterRequiresExplicitDisableBeforeRecipientRotationAndFreshBinding() public {
        vm.expectRevert(OmertaFees.RouterActive.selector);
        fees.setFeeRecipient(payable(payer));
        vm.expectRevert(OmertaFees.RouterActive.selector);
        fees.setVigRecipient(payable(payer));
        fees.setNonMintRouter(IFeeRevenueRouter(address(0)));
        fees.setFeeRecipient(payable(payer));
        vm.expectRevert(OmertaFees.InvalidRouter.selector);
        fees.setNonMintRouter(router);
        FeeRevenueRouter replacement = new FeeRevenueRouter(address(fees), payable(payer), payable(address(vig)),
            payable(address(treasury)), payable(address(community)));
        fees.setNonMintRouter(replacement);
        _pay(0, 203);
        assertEq(payer.balance, 100 ether - 100);
        assertEq(replacement.lastNonce(), 1);
        assertEq(router.lastNonce(), 0);
    }

    function test_badFeeBpsAndEoaRoutersCannotBeConfigured() public {
        vm.expectRevert(OmertaFees.InvalidRouter.selector);
        fees.setNonMintRouter(IFeeRevenueRouter(payer));
        OmertaFees other = new OmertaFees(address(this), payable(address(dev)), payable(address(vig)), 6000, 101, 203);
        FeeRevenueRouter candidate = new FeeRevenueRouter(address(other), payable(address(dev)), payable(address(vig)),
            payable(address(treasury)), payable(address(community)));
        vm.expectRevert(OmertaFees.InvalidRouter.selector);
        other.setNonMintRouter(candidate);
        vm.expectRevert(OmertaFees.InvalidRouter.selector);
        fees.setNonMintRouter(candidate);
    }

    function testFuzz_policyDriftIsRejectedAtConfigurationAndBeforePayment(uint8 fieldSeed) public {
        LiquidityAutomationMutableRouter candidate = new LiquidityAutomationMutableRouter(fees,
            payable(address(treasury)), payable(address(community)));
        fees.setNonMintRouter(candidate);
        candidate.corrupt(fieldSeed % 10);
        vm.expectRevert(OmertaFees.InvalidRouter.selector);
        fees.setNonMintRouter(candidate);
        vm.prank(payer);
        vm.expectRevert(OmertaFees.InvalidRouter.selector);
        fees.payRespawnFee{value: 203}();
        _assertEmpty();
        assertEq(candidate.calls(), 0);
        // Invalid non-mint policy cannot obstruct the independent DEV-only mint path.
        vm.prank(payer);
        fees.payMintFee{value: 101}();
        assertEq(dev.received(), 101);
    }

    function test_eachRecipientCannotReenterAnyPaymentOrRouterRecovery() public {
        LiquidityAutomationReceiver[4] memory recipients = [vig, treasury, community, dev];
        bytes[] memory nested = new bytes[](4);
        nested[0] = abi.encodeCall(fees.payMintFee, ());
        nested[1] = abi.encodeCall(fees.payRespawnFee, ());
        nested[2] = abi.encodeCall(fees.payRerollFee, ());
        nested[3] = abi.encodeCall(fees.payForPackage, (7));
        for (uint256 r; r < recipients.length; r++) {
            for (uint256 n; n < nested.length; n++) {
                uint256 value = n == 1 ? 203 : n == 3 ? 509 : 101;
                vm.deal(address(recipients[r]), 1 ether);
                recipients[r].arm(address(fees), nested[n], value);
                _pay(0, 203);
                assertFalse(recipients[r].nestedSucceeded());
                assertEq(recipients[r].nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
            }
            recipients[r].arm(address(router), abi.encodeCall(router.recoverForcedETH, ()), 0);
            _pay(0, 203);
            assertFalse(recipients[r].nestedSucceeded());
            assertEq(recipients[r].nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
            recipients[r].arm(address(0), "", 0);
        }
        assertEq(fees.nonce(), 20);
        assertEq(router.lastNonce(), 20);
    }

    function test_routerForcedBalanceIsNotMixedIntoFeesAndReturnsOnlyToTreasury() public {
        new LiquidityAutomationForceETH{value: 2 ether}(payable(address(router)));
        _pay(0, 203);
        assertEq(address(router).balance, 2 ether);
        assertEq(treasury.received(), 20);
        vm.prank(payer);
        router.recoverForcedETH();
        assertEq(address(router).balance, 0);
        assertEq(treasury.received(), 2 ether + 20);
        assertEq(router.lastNonce(), 1);
        vm.prank(payer);
        (bool ok,) = address(router).call{value: 1}("");
        assertFalse(ok);
    }

    function test_duplicateRecipientsAggregateWithoutLeavingDust() public {
        fees.setNonMintRouter(IFeeRevenueRouter(address(0)));
        fees.setVigRecipient(payable(address(dev)));
        FeeRevenueRouter shared = new FeeRevenueRouter(address(fees), payable(address(dev)), payable(address(dev)),
            payable(address(dev)), payable(address(dev)));
        fees.setNonMintRouter(shared);
        _pay(0, 203);
        assertEq(dev.received(), 203);
        assertEq(dev.callbacks(), 4);
        assertEq(address(shared).balance, 0);
    }

    function test_routerRejectsMissingSourceAndInvalidDestinations() public {
        vm.expectRevert(FeeRevenueRouter.InvalidAddress.selector);
        new FeeRevenueRouter(payer, payable(address(dev)), payable(address(vig)), payable(address(treasury)), payable(address(community)));
        vm.expectRevert(FeeRevenueRouter.InvalidAddress.selector);
        new FeeRevenueRouter(address(fees), payable(address(0)), payable(address(vig)), payable(address(treasury)), payable(address(community)));
        vm.expectRevert(FeeRevenueRouter.InvalidAddress.selector);
        new FeeRevenueRouter(address(fees), payable(address(dev)), payable(address(vig)), payable(address(fees)), payable(address(community)));
    }
}

contract KeeperGasVaultTest is Test {
    KeeperGasVault internal vault;
    LiquidityAutomationReceiver internal keeper;
    LiquidityAutomationReceiver internal second;
    address internal stranger = address(0xBAD);

    function setUp() public {
        vm.warp(10 days);
        keeper = new LiquidityAutomationReceiver();
        second = new LiquidityAutomationReceiver();
        vault = new KeeperGasVault(address(this), 1 ether, 0.4 ether, 0.6 ether, 1 hours);
        vault.setKeeperAllowed(address(keeper), true);
        vault.setKeeperAllowed(address(second), true);
        vm.deal(address(this), 10 ether);
        (bool ok,) = address(vault).call{value: 5 ether}("");
        assertTrue(ok);
    }
    receive() external payable {}

    function test_anyCallerCanFundOnlyAllowlistedKeeperUpToDeficit() public {
        vm.prank(stranger);
        vault.topUp(payable(address(keeper)));
        assertEq(address(keeper).balance, 0.4 ether);
        assertEq(stranger.balance, 0);
        assertEq(vault.spentInPeriod(10), 0.4 ether);
        vm.warp(10 days + 1 hours);
        vm.prank(stranger);
        vault.topUp(payable(address(keeper)));
        assertEq(address(keeper).balance, 0.6 ether);
        assertEq(vault.totalRefilled(), 0.6 ether);
        vm.warp(10 days + 2 hours);
        assertEq(vault.refillAmount(address(keeper)), 0);
        vm.expectRevert(KeeperGasVault.NothingToRefill.selector);
        vault.topUp(payable(address(keeper)));
        vm.expectRevert(KeeperGasVault.KeeperNotAllowed.selector);
        vault.topUp(payable(stranger));
        assertEq(address(vault).balance, 4.4 ether);
    }

    function test_sharedBudgetCannotBeBypassedWithDifferentKeepers() public {
        vault.topUp(payable(address(keeper)));
        vault.topUp(payable(address(second)));
        vm.warp(10 days + 1 hours);
        vault.topUp(payable(address(keeper)));
        assertEq(vault.spentInPeriod(10), 1 ether);
        assertEq(vault.refillAmount(address(second)), 0);
        vm.expectRevert(KeeperGasVault.NothingToRefill.selector);
        vault.topUp(payable(address(second)));
        vm.warp(11 days);
        vault.topUp(payable(address(second)));
        assertEq(vault.spentInPeriod(10), 1 ether);
        assertEq(vault.spentInPeriod(11), 0.2 ether);
        assertEq(vault.totalRefilled(), 1.2 ether);
    }

    function test_allowlistAndPauseChangesCannotResetCooldownOrBudget() public {
        vault.topUp(payable(address(keeper)));
        vault.setKeeperAllowed(address(keeper), false);
        vault.setKeeperAllowed(address(keeper), true);
        vault.pause();
        vault.unpause();
        vm.expectRevert(abi.encodeWithSelector(KeeperGasVault.RefillTooSoon.selector, 10 days + 1 hours));
        vault.topUp(payable(address(keeper)));
        assertEq(vault.spentInPeriod(10), 0.4 ether);
    }

    function test_rejectingKeeperRollsBackBudgetCooldownAndFunds() public {
        keeper.setReject(true);
        vm.expectRevert(KeeperGasVault.TransferFailed.selector);
        vault.topUp(payable(address(keeper)));
        assertEq(vault.spentInPeriod(10), 0);
        assertEq(vault.nextRefillAt(address(keeper)), 0);
        assertEq(vault.totalRefilled(), 0);
        assertEq(address(vault).balance, 5 ether);
        keeper.setReject(false);
        vault.topUp(payable(address(keeper)));
        assertEq(vault.totalRefilled(), 0.4 ether);
    }

    function test_keeperCannotReenterItsOwnOrAnotherRefill() public {
        keeper.arm(address(vault), abi.encodeCall(vault.topUp, (payable(address(second)))), 0);
        vault.topUp(payable(address(keeper)));
        assertFalse(keeper.nestedSucceeded());
        assertEq(keeper.nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        assertEq(address(second).balance, 0);
        assertEq(vault.totalRefilled(), 0.4 ether);
    }

    function test_vaultBalanceCapsRefillAndPauseAllowsOwnerOnlyRecovery() public {
        vm.deal(address(vault), 0.1 ether);
        assertEq(vault.refillAmount(address(keeper)), 0.1 ether);
        vault.topUp(payable(address(keeper)));
        assertEq(address(keeper).balance, 0.1 ether);
        assertEq(address(vault).balance, 0);
        vm.deal(address(vault), 1 ether);
        vm.expectRevert(Pausable.ExpectedPause.selector);
        vault.recover(1 ether);
        vault.pause();
        assertEq(vault.refillAmount(address(second)), 0);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        vault.topUp(payable(address(second)));
        uint256 before = address(this).balance;
        vault.recover(1 ether);
        assertEq(address(this).balance, before + 1 ether);
        assertEq(vault.totalRefilled(), 0.1 ether);
    }

    function test_strangerCannotAllowPauseResumeOrRecover() public {
        bytes4 unauthorized = Ownable.OwnableUnauthorizedAccount.selector;
        vm.startPrank(stranger);
        vm.expectRevert(abi.encodeWithSelector(unauthorized, stranger));
        vault.setKeeperAllowed(stranger, true);
        vm.expectRevert(abi.encodeWithSelector(unauthorized, stranger));
        vault.pause();
        vm.expectRevert(abi.encodeWithSelector(unauthorized, stranger));
        vault.unpause();
        vm.expectRevert(abi.encodeWithSelector(unauthorized, stranger));
        vault.recover(1);
        vm.stopPrank();
    }

    function test_invalidLimitsAndKeeperAddressesReject() public {
        vm.expectRevert(KeeperGasVault.InvalidLimits.selector);
        new KeeperGasVault(address(this), 0, 1, 1, 1);
        vm.expectRevert(KeeperGasVault.InvalidLimits.selector);
        new KeeperGasVault(address(this), 1, 2, 2, 1);
        vm.expectRevert(KeeperGasVault.InvalidLimits.selector);
        new KeeperGasVault(address(this), 2, 2, 1, 1);
        vm.expectRevert(KeeperGasVault.InvalidLimits.selector);
        new KeeperGasVault(address(this), 1, 1, 1, 0);
        vm.expectRevert(KeeperGasVault.InvalidKeeper.selector);
        vault.setKeeperAllowed(address(0), true);
        vm.expectRevert(KeeperGasVault.InvalidKeeper.selector);
        vault.setKeeperAllowed(address(vault), true);
    }

    function testFuzz_refillIsMinimumOfFourIndependentBounds(
        uint96 balanceSeed, uint96 vaultSeed, uint96 spentSeed
    ) public {
        uint256 keeperBalance = bound(balanceSeed, 0, 1 ether);
        uint256 vaultBalance = bound(vaultSeed, 0, 2 ether);
        uint256 alreadySpent = bound(spentSeed, 0, 1 ether);
        // Establish the shared-period budget through actual refills of distinct approved wallets.
        for (uint256 i; alreadySpent > 0; i++) {
            address payable account = payable(address(uint160(0x10000 + i)));
            vault.setKeeperAllowed(account, true);
            uint256 amount = alreadySpent < 0.4 ether ? alreadySpent : 0.4 ether;
            vm.deal(account, 0.6 ether - amount);
            vault.topUp(account);
            alreadySpent -= amount;
        }
        vm.deal(address(keeper), keeperBalance);
        vm.deal(address(vault), vaultBalance);
        uint256 expected = keeperBalance >= 0.6 ether ? 0 : 0.6 ether - keeperBalance;
        if (expected > 0.4 ether) expected = 0.4 ether;
        uint256 remaining = 1 ether - vault.spentInPeriod(10);
        if (expected > remaining) expected = remaining;
        if (expected > vaultBalance) expected = vaultBalance;
        assertEq(vault.refillAmount(address(keeper)), expected);
        if (expected == 0) {
            vm.expectRevert(KeeperGasVault.NothingToRefill.selector);
            vault.topUp(payable(address(keeper)));
        } else {
            vm.prank(stranger);
            assertEq(vault.topUp(payable(address(keeper))), expected);
            assertEq(address(keeper).balance, keeperBalance + expected);
            assertEq(address(vault).balance, vaultBalance - expected);
        }
        assertLe(vault.spentInPeriod(10), 1 ether);
    }
}

contract LiquidityRevenueHandler is Test {
    OmertaFees public fees;
    FeeRevenueRouter public router;
    LiquidityAutomationReceiver[4] public recipients;
    uint256[4] public expectedReceipts;
    uint256 public successfulPayments;
    uint256 public lastRoutedNonce;
    uint256 public grossPaid;
    bool public routerEnabled = true;
    address private constant PAYER = address(0xBEEF);

    constructor() {
        for (uint256 i; i < 4; i++) recipients[i] = new LiquidityAutomationReceiver();
        fees = new OmertaFees(address(this), payable(address(recipients[0])), payable(address(recipients[1])), 2500, 101, 203);
        router = new FeeRevenueRouter(address(fees), payable(address(recipients[0])), payable(address(recipients[1])),
            payable(address(recipients[2])), payable(address(recipients[3])));
        fees.setNonMintRouter(router);
    }

    function configureRouter(bool enabled) public {
        routerEnabled = enabled;
        fees.setNonMintRouter(enabled ? IFeeRevenueRouter(address(router)) : IFeeRevenueRouter(address(0)));
    }

    function reject(uint8 index, bool rejected) public { recipients[index % 4].setReject(rejected); }

    function pay(uint8 kindSeed, uint96 amountSeed, bool underpay) public {
        uint256 price = bound(amountSeed, 1, 10 ether);
        uint256 kind = kindSeed % 4;
        fees.setFees(price, price);
        fees.setRerollFee(price);
        fees.setPackagePrice(7, price);
        uint256 value = underpay ? price - 1 : price;
        bool routed = kind != 0 && routerEnabled;
        uint256[4] memory shares;
        shares[1] = kind == 0 ? 0 : value / 4;
        shares[2] = routed ? value / 10 : 0;
        shares[3] = routed ? value * 15 / 100 : 0;
        shares[0] = value - shares[1] - shares[2] - shares[3];
        bool expected = !underpay;
        for (uint256 i; i < 4; i++) if (shares[i] > 0 && recipients[i].rejects()) expected = false;
        bytes memory data = kind == 0 ? abi.encodeCall(fees.payMintFee, ())
            : kind == 1 ? abi.encodeCall(fees.payRespawnFee, ())
            : kind == 2 ? abi.encodeCall(fees.payRerollFee, ()) : abi.encodeCall(fees.payForPackage, (7));
        vm.deal(PAYER, 10 ether);
        vm.prank(PAYER);
        (bool ok,) = address(fees).call{value: value}(data);
        assertEq(ok, expected);
        if (ok) {
            successfulPayments++;
            grossPaid += value;
            if (routed) lastRoutedNonce = successfulPayments;
            for (uint256 i; i < 4; i++) expectedReceipts[i] += shares[i];
        }
        assertEq(PAYER.balance, 10 ether - (ok ? value : 0));
    }

    function assertModel() public view {
        uint256 total;
        for (uint256 i; i < 4; i++) {
            assertEq(address(recipients[i]).balance, expectedReceipts[i]);
            assertEq(recipients[i].received(), expectedReceipts[i]);
            total += expectedReceipts[i];
        }
        assertEq(total, grossPaid);
        assertEq(fees.nonce(), successfulPayments);
        assertEq(router.lastNonce(), lastRoutedNonce);
        assertEq(address(fees).balance + address(router).balance, 0);
        assertEq(fees.mintDevBps(), 10000);
    }
}

contract KeeperGasHandler is Test {
    KeeperGasVault public vault;
    LiquidityAutomationReceiver[3] public keepers;
    uint256[3] public expectedNextRefill;
    bool[3] public allowed;
    mapping(uint256 => uint256) public expectedSpent;
    uint256[] public periods;
    uint256 public funded = 10 ether;
    uint256 public refilled;
    uint256 public recovered;
    bool public isPaused;
    address private constant SINK = address(0xDEAD);
    address private constant TRIGGER = address(0x1234);

    constructor() {
        vault = new KeeperGasVault(address(this), 1 ether, 0.1 ether, 0.2 ether, 10 minutes);
        vm.deal(address(vault), funded);
        for (uint256 i; i < 3; i++) {
            keepers[i] = new LiquidityAutomationReceiver();
            allowed[i] = true;
            vault.setKeeperAllowed(address(keepers[i]), true);
        }
    }
    receive() external payable {}

    function configure(uint8 index, bool allow, bool reject) public {
        uint256 i = index % 3;
        allowed[i] = allow;
        vault.setKeeperAllowed(address(keepers[i]), allow);
        keepers[i].setReject(reject);
    }

    function advance(uint32 secondsSeed) public { vm.warp(block.timestamp + bound(secondsSeed, 0, 2 days)); }

    function pause(bool value) public {
        if (value == isPaused) return;
        isPaused = value;
        if (value) vault.pause();
        else vault.unpause();
    }

    function spend(uint8 index, uint96 amountSeed) public {
        LiquidityAutomationReceiver keeper = keepers[index % 3];
        uint256 balance = address(keeper).balance;
        if (balance == 0) return;
        keeper.spend(payable(SINK), bound(amountSeed, 0, balance));
    }

    function fund(uint96 amountSeed) public {
        uint256 amount = bound(amountSeed, 1, 1 ether);
        vm.deal(address(this), amount);
        (bool ok,) = address(vault).call{value: amount}("");
        assertTrue(ok);
        funded += amount;
    }

    function recover(uint96 amountSeed) public {
        if (!isPaused || address(vault).balance == 0) return;
        uint256 amount = bound(amountSeed, 1, address(vault).balance);
        vault.recover(amount);
        recovered += amount;
    }

    function refill(uint8 index) public {
        uint256 i = index % 3;
        uint256 period = block.timestamp / 1 days;
        uint256 balance = address(keepers[i]).balance;
        uint256 amount = balance >= 0.2 ether ? 0 : 0.2 ether - balance;
        if (amount > 0.1 ether) amount = 0.1 ether;
        uint256 budgetLeft = 1 ether - expectedSpent[period];
        if (amount > budgetLeft) amount = budgetLeft;
        if (amount > address(vault).balance) amount = address(vault).balance;
        bool due = !isPaused && allowed[i] && block.timestamp >= expectedNextRefill[i];
        bool expected = due && amount > 0 && !keepers[i].rejects();
        assertEq(vault.refillAmount(address(keepers[i])), due ? amount : 0);
        vm.prank(TRIGGER);
        (bool ok,) = address(vault).call(abi.encodeCall(vault.topUp, (payable(address(keepers[i])))));
        assertEq(ok, expected);
        if (ok) {
            if (expectedSpent[period] == 0) periods.push(period);
            expectedSpent[period] += amount;
            expectedNextRefill[i] = block.timestamp + 10 minutes;
            refilled += amount;
        }
        assertEq(address(keepers[i]).balance, balance + (ok ? amount : 0));
        assertEq(TRIGGER.balance, 0);
    }

    function assertModel() public view {
        assertEq(address(vault).balance + refilled + recovered, funded);
        assertEq(vault.totalRefilled(), refilled);
        assertEq(vault.paused(), isPaused);
        for (uint256 i; i < periods.length; i++) {
            assertEq(vault.spentInPeriod(periods[i]), expectedSpent[periods[i]]);
            assertLe(expectedSpent[periods[i]], 1 ether);
        }
        for (uint256 i; i < 3; i++) {
            assertEq(vault.allowedKeeper(address(keepers[i])), allowed[i]);
            assertEq(vault.nextRefillAt(address(keepers[i])), expectedNextRefill[i]);
        }
    }
}

contract LiquidityRevenueInvariantTest is StdInvariant, Test {
    LiquidityRevenueHandler internal handler;
    function setUp() public {
        handler = new LiquidityRevenueHandler();
        for (uint8 i; i < 4; i++) handler.pay(i, 101, false);
        bytes4[] memory selectors = new bytes4[](3);
        selectors[0] = handler.pay.selector;
        selectors[1] = handler.reject.selector;
        selectors[2] = handler.configureRouter.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_eachDestinationMatchesFeeKindAndModeWithAtomicNonceAccounting() public view {
        handler.assertModel();
    }
}

contract KeeperGasInvariantTest is StdInvariant, Test {
    KeeperGasHandler internal handler;
    function setUp() public {
        vm.warp(10 days);
        handler = new KeeperGasHandler();
        handler.refill(0);
        bytes4[] memory selectors = new bytes4[](7);
        selectors[0] = handler.refill.selector;
        selectors[1] = handler.configure.selector;
        selectors[2] = handler.advance.selector;
        selectors[3] = handler.pause.selector;
        selectors[4] = handler.spend.selector;
        selectors[5] = handler.fund.selector;
        selectors[6] = handler.recover.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector(address(handler), selectors));
    }
    /// forge-config: default.invariant.fail-on-revert = true
    function invariant_refillsRespectGlobalBudgetCooldownAndConserveOperationsFunding() public view {
        handler.assertModel();
    }
}
