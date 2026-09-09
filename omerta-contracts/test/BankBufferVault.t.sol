// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {BankBufferVault} from "../src/BankBufferVault.sol";
import {Transmuter} from "../src/Transmuter.sol";
import {Denari} from "../src/Denari.sol";

/// @dev Explicit test-only backing asset. Bank authorities and debt accounting use real contracts.
contract BufferTestAsset is ERC20 {
    uint8 private immutable _precision;
    uint256 public fee;
    uint256 public extraDebit;
    bool public ignoreAllowanceReset;
    BankBufferVault public callback;
    bool public attemptedReentry;
    bool public reentrySucceeded;

    constructor(uint8 precision) ERC20("Test backing asset", "BACK") { _precision = precision; }
    function decimals() public view override returns (uint8) { return _precision; }
    function mint(address to, uint256 amount) external { _mint(to, amount); }
    function setBehavior(uint256 fee_, uint256 extraDebit_, bool ignoreReset_) external {
        fee = fee_; extraDebit = extraDebit_; ignoreAllowanceReset = ignoreReset_;
    }
    function setCallback(BankBufferVault target) external { callback = target; }
    function approve(address spender, uint256 value) public override returns (bool) {
        if (value == 0 && ignoreAllowanceReset) return true;
        return super.approve(spender, value);
    }
    function transferFrom(address from, address to, uint256 amount) public override returns (bool) {
        if (address(callback) != address(0)) {
            attemptedReentry = true;
            (reentrySucceeded,) = address(callback).call(abi.encodeCall(callback.fundDeficit, ()));
        }
        // Nonstandard allowance-retaining tokens must still be explicitly reset to zero.
        if (ignoreAllowanceReset) _transfer(from, to, amount);
        else super.transferFrom(from, to, amount);
        if (fee > 0) _burn(to, fee);
        if (extraDebit > 0) _burn(from, extraDebit);
        return true;
    }
}

abstract contract BufferFixture is Test {
    BufferTestAsset internal backing;
    Denari internal debt;
    Transmuter internal transmuter;
    BankBufferVault internal vault;
    address internal constant ALICE = address(0xA11CE);
    address internal constant OUTSIDER = address(0xBAD);

    function setUp() public virtual {
        vm.warp(10 days + 1 hours);
        backing = new BufferTestAsset(6);
        debt = new Denari("Denari", "DNR", address(this));
        transmuter = new Transmuter(debt, IERC20(address(backing)), address(this));
        vault = new BankBufferVault(IERC20(address(backing)), transmuter, address(this), 50e6, 120e6);
        debt.setMinter(address(this));
        debt.setBurner(address(transmuter));
        debt.mint(ALICE, 1000e18);
        backing.mint(address(vault), 1000e6);
        transmuter.setFunder(address(vault), true);
    }

    function _assertUnspent() internal view {
        assertEq(vault.totalFunded(), 0);
        assertEq(vault.spentInPeriod(block.timestamp / 1 days), 0);
        assertEq(backing.balanceOf(address(vault)), 1000e6);
        assertEq(transmuter.reserves(), 0);
        assertEq(backing.balanceOf(address(transmuter)), 0);
        assertEq(backing.allowance(address(vault), address(transmuter)), 0);
    }
}

contract BankBufferVaultTest is BufferFixture {
    function test_constructorPinsAssetDestinationRuntimeAndImmutableLimits() public view {
        assertEq(address(vault.asset()), address(backing));
        assertEq(address(vault.transmuter()), address(transmuter));
        assertEq(vault.assetCodeHash(), address(backing).codehash);
        assertEq(vault.transmuterCodeHash(), address(transmuter).codehash);
        assertEq(vault.perActionCap(), 50e6);
        assertEq(vault.periodBudget(), 120e6);
        assertEq(vault.owner(), address(this));
    }

    function test_constructorRejectsAbsentOrMismatchedAssetAndInvalidLimits() public {
        vm.expectRevert(BankBufferVault.InvalidDependency.selector);
        new BankBufferVault(IERC20(address(0)), transmuter, address(this), 1, 2);
        vm.expectRevert(BankBufferVault.InvalidDependency.selector);
        new BankBufferVault(IERC20(address(backing)), Transmuter(address(0)), address(this), 1, 2);
        BufferTestAsset other = new BufferTestAsset(6);
        vm.expectRevert(BankBufferVault.InvalidDependency.selector);
        new BankBufferVault(IERC20(address(other)), transmuter, address(this), 1, 2);
        vm.expectRevert(BankBufferVault.InvalidLimits.selector);
        new BankBufferVault(IERC20(address(backing)), transmuter, address(this), 0, 2);
        vm.expectRevert(BankBufferVault.InvalidLimits.selector);
        new BankBufferVault(IERC20(address(backing)), transmuter, address(this), 2, 1);
    }

    function test_permissionlessFundingCannotMintOrPayCallerAndUsesExactApproval() public {
        assertEq(vault.fundingAmount(), 50e6);
        vm.prank(OUTSIDER);
        assertEq(vault.fundDeficit(), 50e6);
        assertEq(backing.balanceOf(address(vault)), 950e6);
        assertEq(backing.balanceOf(address(transmuter)), 50e6);
        assertEq(transmuter.reserves(), 50e6);
        assertEq(backing.balanceOf(OUTSIDER), 0);
        assertEq(debt.balanceOf(OUTSIDER), 0);
        assertEq(debt.totalSupply(), 1000e18);
        assertEq(debt.minter(), address(this));
        assertEq(backing.allowance(address(vault), address(transmuter)), 0);
        assertEq(vault.totalFunded(), 50e6);
    }

    function test_dailyBudgetIsSharedAcrossCallersAndResetsOnlyAtUtcDayBoundary() public {
        vault.fundDeficit();
        vm.prank(ALICE); vault.fundDeficit();
        vm.prank(OUTSIDER); assertEq(vault.fundDeficit(), 20e6);
        assertEq(vault.spentInPeriod(10), 120e6);
        assertEq(vault.fundingAmount(), 0);
        vm.expectRevert(BankBufferVault.NothingToFund.selector); vault.fundDeficit();
        vm.warp(11 days - 1);
        assertEq(vault.fundingAmount(), 0);
        vm.warp(11 days);
        assertEq(vault.fundDeficit(), 50e6);
        assertEq(vault.fundDeficit(), 30e6);
        assertEq(transmuter.reserves(), 200e6);
        assertEq(vault.fundingAmount(), 0);
        assertEq(vault.spentInPeriod(10), 120e6);
        assertEq(vault.spentInPeriod(11), 80e6);
    }

    function test_directDonationDoesNotSubstituteForTrackedReserveFunding() public {
        backing.mint(address(transmuter), 500e6);
        assertEq(transmuter.reserves(), 0);
        assertEq(vault.fundDeficit(), 50e6);
        assertEq(backing.balanceOf(address(transmuter)), 550e6);
        assertEq(transmuter.reserves(), 50e6);
    }

    function test_availablePrefundingBoundsActualFunding() public {
        vault.pause(); vault.recover(993e6); vault.unpause();
        assertEq(vault.fundDeficit(), 7e6);
        assertEq(vault.fundingAmount(), 0);
        assertEq(transmuter.reserves(), 7e6);
    }

    function test_healthyOrZeroSupplyBufferIsNeverOverfundedOrSeeded() public {
        transmuter.setFunder(address(this), true);
        backing.mint(address(this), 201e6);
        backing.approve(address(transmuter), 201e6);
        transmuter.fund(201e6);
        assertEq(vault.fundingAmount(), 0);
        vm.expectRevert(BankBufferVault.NothingToFund.selector); vault.fundDeficit();
        Denari emptyDebt = new Denari("Empty", "EMPTY", address(this));
        Transmuter emptyMarket = new Transmuter(emptyDebt, IERC20(address(backing)), address(this));
        BankBufferVault emptyVault = new BankBufferVault(IERC20(address(backing)), emptyMarket, address(this), 1, 2);
        backing.mint(address(emptyVault), 10e6);
        assertEq(emptyMarket.requiredBuffer(), 0);
        assertEq(emptyVault.fundingAmount(), 0);
        vm.expectRevert(BankBufferVault.NothingToFund.selector); emptyVault.fundDeficit();
    }

    function test_actualRedemptionReopensOnlyTheNewConservedDeficit() public {
        transmuter.setFunder(address(this), true);
        backing.mint(address(this), 200e6);
        backing.approve(address(transmuter), 200e6);
        transmuter.fund(200e6);
        vm.startPrank(ALICE);
        debt.approve(address(transmuter), 100e18);
        transmuter.redeem(100e18);
        vm.stopPrank();
        assertEq(debt.totalSupply(), 900e18);
        assertEq(transmuter.requiredBuffer(), 180e6);
        assertEq(transmuter.reserves(), 100e6);
        assertEq(vault.fundDeficit(), 50e6);
        assertEq(vault.fundDeficit(), 30e6);
        assertEq(vault.fundingAmount(), 0);
        assertEq(backing.balanceOf(ALICE), 100e6);
        assertEq(debt.totalSupply(), 900e18);
    }

    function test_revokedFunderRollsBackAllowanceAndBudget() public {
        transmuter.setFunder(address(vault), false);
        vm.expectRevert(Transmuter.NotFunder.selector); vault.fundDeficit();
        _assertUnspent();
        transmuter.setFunder(address(vault), true);
        assertEq(vault.fundDeficit(), 50e6);
    }

    function test_feeOnTransferIsRefusedAtomicallyByActualTransmuter() public {
        backing.setBehavior(1, 0, false);
        vm.expectRevert(abi.encodeWithSelector(Transmuter.AssetTransferMismatch.selector, 50e6 - 1, 50e6));
        vault.fundDeficit();
        _assertUnspent();
    }

    function test_extraSenderDebitCannotConsumeUnmeteredBacking() public {
        backing.setBehavior(0, 1, false);
        vm.expectRevert(BankBufferVault.FundingMismatch.selector); vault.fundDeficit();
        _assertUnspent();
    }

    function test_tokenCannotRetainSpendingApprovalByIgnoringReset() public {
        backing.setBehavior(0, 0, true);
        vm.expectRevert(BankBufferVault.FundingMismatch.selector); vault.fundDeficit();
        _assertUnspent();
    }

    function test_underlyingCallbackCannotReenterPermissionlessFunding() public {
        backing.setCallback(vault);
        assertEq(vault.fundDeficit(), 50e6);
        assertTrue(backing.attemptedReentry());
        assertFalse(backing.reentrySucceeded());
        assertEq(vault.totalFunded(), 50e6);
        assertEq(transmuter.reserves(), 50e6);
    }

    function test_runtimeChangesToEitherDependencyStopFundingBeforeApproval() public {
        bytes memory original = address(backing).code;
        vm.etch(address(backing), hex"60006000fd");
        vm.expectRevert(BankBufferVault.DependencyChanged.selector); vault.fundDeficit();
        vm.etch(address(backing), original);
        vm.etch(address(transmuter), hex"60006000fd");
        vm.expectRevert(BankBufferVault.DependencyChanged.selector); vault.fundDeficit();
        assertEq(backing.allowance(address(vault), address(transmuter)), 0);
        assertEq(vault.totalFunded(), 0);
    }

    function test_onlyGovernanceCanPauseResumeAndRecoverToItsCurrentOwner() public {
        vm.startPrank(OUTSIDER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, OUTSIDER));
        vault.pause();
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, OUTSIDER));
        vault.recover(1);
        vm.stopPrank();
        vm.expectRevert(Pausable.ExpectedPause.selector); vault.recover(1);
        vault.pause();
        assertEq(vault.fundingAmount(), 0);
        vm.expectRevert(Pausable.EnforcedPause.selector); vault.fundDeficit();
        vault.transferOwnership(ALICE);
        vm.prank(ALICE); vault.acceptOwnership();
        vm.prank(ALICE); vault.recover(7e6);
        assertEq(backing.balanceOf(ALICE), 7e6);
        assertEq(backing.balanceOf(address(vault)), 993e6);
        assertEq(vault.totalFunded(), 0);
        vm.prank(ALICE); vault.unpause();
        assertEq(vault.fundDeficit(), 50e6);
    }

    function test_pauseResumeDoesNotResetConsumedBudget() public {
        vault.fundDeficit();
        vault.pause(); vault.unpause();
        assertEq(vault.spentInPeriod(block.timestamp / 1 days), 50e6);
        vault.fundDeficit();
        assertEq(vault.fundDeficit(), 20e6);
    }

    function testFuzz_fundingIsMinimumOfDeficitActionDayAndBalance(uint64 supplyUnits, uint64 available) public {
        supplyUnits = uint64(bound(supplyUnits, 1, 1e12));
        available = uint64(bound(available, 1, 1e12));
        Denari token = new Denari("Fuzz debt", "FD", address(this));
        Transmuter market = new Transmuter(token, IERC20(address(backing)), address(this));
        BankBufferVault buffer = new BankBufferVault(IERC20(address(backing)), market, address(this), 50e6, 120e6);
        token.setMinter(address(this));
        token.mint(ALICE, uint256(supplyUnits) * 1e12);
        backing.mint(address(buffer), available);
        market.setFunder(address(buffer), true);
        uint256 expected = uint256(supplyUnits) / 5;
        if (expected > 50e6) expected = 50e6;
        if (expected > available) expected = available;
        assertEq(buffer.fundingAmount(), expected);
        if (expected == 0) {
            vm.expectRevert(BankBufferVault.NothingToFund.selector); buffer.fundDeficit();
        } else {
            assertEq(buffer.fundDeficit(), expected);
            assertEq(market.reserves(), expected);
            assertEq(backing.balanceOf(address(buffer)), uint256(available) - expected);
            assertEq(token.totalSupply(), uint256(supplyUnits) * 1e12);
        }
    }
}

contract BankBufferHandler is Test {
    BufferTestAsset public immutable backing;
    Denari public immutable debt;
    Transmuter public immutable transmuter;
    BankBufferVault public immutable vault;
    uint256 public immutable startingBalance;
    uint256 public totalInput;
    uint256 public totalOutput;
    uint256 public observedFunded;
    uint256 public maxDaySpend;
    bool public violatedBound;

    constructor(BufferTestAsset backing_, Denari debt_, Transmuter transmuter_, BankBufferVault vault_) {
        backing = backing_; debt = debt_; transmuter = transmuter_; vault = vault_;
        startingBalance = backing_.balanceOf(address(vault_));
    }
    function prefund(uint64 raw) external {
        uint256 amount = bound(raw, 0, 1000e6);
        backing.mint(address(vault), amount);
        totalInput += amount;
    }
    function issueTestDebt(uint64 raw) external {
        uint256 amount = bound(raw, 0, 1000e18);
        debt.mint(address(this), amount);
    }
    function redeem(uint64 raw) external {
        uint256 capacity = transmuter.reserves();
        uint256 held = debt.balanceOf(address(this)) / 1e12;
        if (held < capacity) capacity = held;
        if (capacity == 0) return;
        uint256 amount = bound(raw, 1, capacity);
        debt.approve(address(transmuter), amount * 1e12);
        transmuter.redeem(amount * 1e12);
        totalOutput += amount;
    }
    function advance(uint32 raw) external { vm.warp(block.timestamp + bound(raw, 0, 2 days)); }
    function fund() external {
        uint256 required = transmuter.requiredBuffer();
        uint256 beforeReserve = transmuter.reserves();
        uint256 beforeBalance = backing.balanceOf(address(vault));
        uint256 day = block.timestamp / 1 days;
        uint256 spentBefore = vault.spentInPeriod(day);
        try vault.fundDeficit() returns (uint256 amount) {
            if (required <= beforeReserve || amount > required - beforeReserve
                || amount > beforeBalance || amount > 50e6 || spentBefore + amount > 120e6)
                violatedBound = true;
            observedFunded += amount;
            uint256 spent = vault.spentInPeriod(day);
            if (spent > maxDaySpend) maxDaySpend = spent;
        } catch {}
    }
}

contract BankBufferVaultInvariantTest is StdInvariant, BufferFixture {
    BankBufferHandler internal handler;
    function setUp() public override {
        super.setUp();
        handler = new BankBufferHandler(backing, debt, transmuter, vault);
        debt.setMinter(address(handler));
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.prefund.selector;
        selectors[1] = handler.issueTestDebt.selector;
        selectors[2] = handler.redeem.selector;
        selectors[3] = handler.advance.selector;
        selectors[4] = handler.fund.selector;
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
        targetContract(address(handler));
    }
    function invariant_backingConservationNoUnmeteredSpendOrStandingApproval() public view {
        assertFalse(handler.violatedBound());
        assertLe(handler.maxDaySpend(), 120e6);
        assertEq(vault.totalFunded(), handler.observedFunded());
        assertEq(backing.balanceOf(address(vault)) + handler.observedFunded(),
            handler.startingBalance() + handler.totalInput());
        assertEq(transmuter.reserves() + handler.totalOutput(), handler.observedFunded());
        assertEq(backing.balanceOf(address(transmuter)), transmuter.reserves());
        assertEq(backing.balanceOf(address(handler)), handler.totalOutput());
        assertEq(backing.allowance(address(vault), address(transmuter)), 0);
    }
}
