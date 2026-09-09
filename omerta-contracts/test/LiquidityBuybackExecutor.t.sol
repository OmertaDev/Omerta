// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OMR} from "../src/OMR.sol";
import {OmertaHook} from "../src/OmertaHook.sol";
import {OmrV4TwapOracle} from "../src/OmrV4TwapOracle.sol";
import {IOmrOracle} from "../src/IOmrOracle.sol";
import {ILiquidityHealth} from "../src/interfaces/ILiquidityHealth.sol";
import {LiquidityBuybackExecutor} from "../src/LiquidityBuybackExecutor.sol";

contract BuybackOracle is IOmrOracle {
    uint256 public price = 1 ether;
    uint256 public updatedAt = block.timestamp;
    bool public broken;
    function set(uint256 price_, uint256 updatedAt_) external { price = price_; updatedAt = updatedAt_; }
    function setBroken(bool value) external { broken = value; }
    function consult() external view returns (uint256, uint256) {
        require(!broken, "oracle failed");
        return (price, updatedAt);
    }
}

contract BuybackHealth is ILiquidityHealth {
    bool public value = true;
    bool public broken;
    function set(bool value_, bool broken_) external { value = value_; broken = broken_; }
    function healthy() external view returns (bool) { require(!broken, "health failed"); return value; }
}

contract BuybackNonconformingHealth {}

interface IBuybackTokenReceiver { function onTokensReceived() external; }

/// @dev Used only in boundary tests. The primary suite uses real OMR; both suites use the real
///      PoolManager, real OmertaHook and actual v4 swap/settlement accounting.
contract BuybackBoundaryToken is ERC20 {
    address public taxFrom;
    address public rejectTo;
    address public callbackTo;
    error Rejected();
    constructor() ERC20("Boundary", "BOUND") { _mint(msg.sender, 1_000_000 ether); }
    function configure(address taxFrom_, address rejectTo_, address callbackTo_) external {
        taxFrom = taxFrom_; rejectTo = rejectTo_; callbackTo = callbackTo_;
    }
    function _update(address from, address to, uint256 amount) internal override {
        if (rejectTo != address(0) && to == rejectTo) revert Rejected();
        if (taxFrom != address(0) && from == taxFrom && amount > 1) {
            super._update(from, to, amount - 1);
            super._update(from, address(0), 1);
        } else super._update(from, to, amount);
        if (callbackTo != address(0) && to == callbackTo) IBuybackTokenReceiver(to).onTokensReceived();
    }
}

contract BuybackReentrantRecipient is IBuybackTokenReceiver {
    LiquidityBuybackExecutor public target;
    bytes public data;
    bool public nestedSucceeded;
    bytes4 public nestedError;
    function arm(LiquidityBuybackExecutor target_, bytes calldata data_) external { target = target_; data = data_; }
    function onTokensReceived() external {
        bytes memory reason;
        (nestedSucceeded, reason) = address(target).call(data);
        if (reason.length >= 4) nestedError = bytes4(reason);
    }
}

abstract contract BuybackMarketFixture is Test {
    using PoolIdLibrary for PoolKey;
    uint160 internal constant Q96 = 79228162514264337593543950336;
    address internal constant KEEPER = address(0xBEEF);
    address internal constant RESERVE = address(0xD001);
    address internal constant PRIZES = address(0xD002);
    PoolManager internal manager;
    IERC20 internal token;
    OmertaHook internal hook;
    PoolKey internal key;
    BuybackOracle internal oracle;
    BuybackHealth internal health;
    LiquidityBuybackExecutor internal executor;

    function _token() internal virtual returns (IERC20);

    function setUp() public virtual {
        vm.roll(1000);
        vm.warp(1_000_000);
        vm.deal(address(this), 10_000 ether);
        manager = new PoolManager(address(this));
        token = _token();
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address hookAddress = address(uint160((uint256(0xCAFE) << 144) | uint256(flags)));
        deployCodeTo("OmertaHook.sol:OmertaHook", abi.encode(manager, address(token), address(this), address(this)), hookAddress);
        hook = OmertaHook(payable(hookAddress));
        hook.setRecipients(address(0xA001), address(0xA002), address(0xA003), address(0xA004));
        hook.setAllowedQuote(Currency.wrap(address(0)), true);
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token)), 3000, 60, IHooks(hookAddress));
        manager.initialize(key, Q96);
        PoolModifyLiquidityTest lp = new PoolModifyLiquidityTest(manager);
        token.approve(address(lp), type(uint256).max);
        lp.modifyLiquidity{value: 2000 ether}(key, ModifyLiquidityParams(-887220, 887220, 1000 ether, bytes32(0)), "");
        oracle = new BuybackOracle();
        health = new BuybackHealth();
        executor = _executor(LiquidityBuybackExecutor.Stream.Vig, RESERVE, PRIZES, oracle, health);
    }
    receive() external payable {}

    function _policy() internal pure returns (LiquidityBuybackExecutor.Policy memory) {
        return LiquidityBuybackExecutor.Policy(1 ether, 2 ether, 600, 3600, 500);
    }
    function _executor(LiquidityBuybackExecutor.Stream stream, address primary, address secondary,
        IOmrOracle oracle_, ILiquidityHealth health_) internal returns (LiquidityBuybackExecutor result)
    {
        result = new LiquidityBuybackExecutor(address(this), manager, key, oracle_, health_, stream, primary, secondary, _policy());
        result.setKeeper(KEEPER, true);
        result.deposit{value: 10 ether}();
    }
    function _execute(uint256 amount) internal returns (uint256 spent, uint256 bought) {
        uint256 minOut = executor.quoteFloor(amount);
        vm.prank(KEEPER);
        return executor.execute(amount, minOut, block.timestamp);
    }
    function _price() internal view returns (uint160 price) { (price,,,) = StateLibrary.getSlot0(manager, key.toId()); }
    function _assertUnspent(uint256 expectedTokenBalance) internal view {
        assertEq(executor.sequence(), 0);
        assertEq(executor.nextExecutionAt(), 0);
        assertEq(executor.spentInDay(block.timestamp / 1 days), 0);
        assertEq(address(executor).balance, 10 ether);
        assertEq(token.balanceOf(address(executor)), expectedTokenBalance);
        assertEq(token.balanceOf(RESERVE), 0);
        assertEq(token.balanceOf(PRIZES), 0);
        assertEq(_price(), Q96);
    }
}

contract LiquidityBuybackExecutorTest is BuybackMarketFixture {
    function _token() internal override returns (IERC20) { return IERC20(address(new OMR(address(this)))); }

    function testFuzz_realV4SwapConservesNativeAndTokenBalancesToFixedRecipients(uint96 seed) public {
        uint256 amount = bound(seed, 1e12, 1 ether);
        uint256 beforePoolEth = address(manager).balance;
        uint256 beforePoolOmr = token.balanceOf(address(manager));
        uint256 beforeSupply = token.totalSupply();
        (uint256 spent, uint256 bought) = _execute(amount);
        assertEq(spent, amount);
        assertGe(bought, amount * 95 / 100);
        assertEq(address(executor).balance, 10 ether - spent);
        assertEq(address(manager).balance - beforePoolEth, spent);
        assertEq(beforePoolOmr - token.balanceOf(address(manager)), bought);
        assertEq(token.balanceOf(RESERVE), bought / 2);
        assertEq(token.balanceOf(PRIZES), bought - bought / 2);
        assertEq(token.balanceOf(address(executor)), 0);
        assertEq(token.totalSupply(), beforeSupply);
        assertEq(token.balanceOf(KEEPER), 0);
        assertEq(executor.spentInDay(block.timestamp / 1 days), spent);
        assertEq(executor.sequence(), 1);
    }

    function test_realCanonicalTwapFeedsActualSwap() public {
        OmrV4TwapOracle realOracle = new OmrV4TwapOracle(hook, address(token), 3000, 60, 600);
        executor = _executor(LiquidityBuybackExecutor.Stream.Community, RESERVE, address(0), realOracle, health);
        vm.warp(block.timestamp + 600);
        realOracle.update();
        (uint256 price, uint256 updatedAt) = realOracle.consult();
        assertEq(price, 1 ether);
        assertEq(updatedAt, block.timestamp);
        (, uint256 bought) = _execute(0.1 ether);
        assertEq(token.balanceOf(RESERVE), bought);
        assertEq(token.balanceOf(PRIZES), 0);
    }

    function test_threeSingleRecipientStreamsNeverPaySecondary() public {
        for (uint8 i = 1; i < 4; i++) {
            address destination = address(uint160(0xE000 + i));
            executor = _executor(LiquidityBuybackExecutor.Stream(i), destination, address(0), oracle, health);
            (, uint256 bought) = _execute(0.1 ether);
            assertEq(token.balanceOf(destination), bought);
            assertEq(executor.destination(), destination);
            assertEq(executor.secondaryRecipient(), address(0));
        }
        assertEq(token.balanceOf(RESERVE) + token.balanceOf(PRIZES), 0);
    }

    function test_vigMayUseSameCustodyAddressForBothOutputShares() public {
        executor = _executor(LiquidityBuybackExecutor.Stream.Vig, RESERVE, RESERVE, oracle, health);
        (, uint256 bought) = _execute(1 ether);
        assertEq(token.balanceOf(RESERVE), bought);
        assertEq(token.balanceOf(address(executor)), 0);
    }

    function test_unknownKeeperCannotExecuteOrChangeRecipientsViaAnyPublicMethod() public {
        vm.prank(address(0xBAD));
        vm.expectRevert(LiquidityBuybackExecutor.NotKeeper.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp);
        vm.prank(KEEPER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, KEEPER));
        executor.setKeeper(address(0xBAD), true);
        vm.prank(KEEPER);
        (bool changed,) = address(executor).call(abi.encodeWithSignature("setRecipients(address,address)", KEEPER, KEEPER));
        assertFalse(changed);
        _assertUnspent(0);
    }

    function test_globalCooldownAndDailyBudgetApplyAcrossKeepersAndUtcDays() public {
        address other = address(0xBEE2);
        executor.setKeeper(other, true);
        _execute(1 ether);
        vm.prank(other);
        vm.expectRevert(LiquidityBuybackExecutor.TooSoon.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp);
        vm.warp(block.timestamp + 600);
        vm.prank(other);
        executor.execute(1 ether, 0.95 ether, block.timestamp);
        vm.warp(block.timestamp + 600);
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.BudgetExceeded.selector);
        executor.execute(1, 1, block.timestamp);
        uint256 day = block.timestamp / 1 days;
        assertEq(executor.spentInDay(day), 2 ether);
        vm.warp((day + 1) * 1 days);
        oracle.set(1 ether, block.timestamp);
        _execute(0.1 ether);
        assertEq(executor.spentInDay(day), 2 ether);
        assertEq(executor.spentInDay(day + 1), 0.1 ether);
    }

    function test_zeroOverCapUnderfundedAndInvalidDeadlinesRevertBeforeSwap() public {
        vm.startPrank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidAmount.selector);
        executor.execute(0, 0, block.timestamp);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidAmount.selector);
        executor.execute(1 ether + 1, 1 ether, block.timestamp);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidDeadline.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp - 1);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidDeadline.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp + 301);
        vm.stopPrank();
        _assertUnspent(0);
        vm.deal(address(executor), 1);
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidAmount.selector);
        executor.execute(2, 1, block.timestamp);
        assertEq(executor.sequence(), 0);
    }

    function test_keeperCannotWeakenOracleSlippageFloor() public {
        uint256 floor = executor.quoteFloor(1 ether);
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.Slippage.selector);
        executor.execute(1 ether, floor - 1, block.timestamp);
        _assertUnspent(0);
    }

    function test_unachievableMinOutRevertsPoolPriceTransfersAndBudgetAtomically() public {
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.Slippage.selector);
        executor.execute(1 ether, 2 ether, block.timestamp);
        _assertUnspent(0);
    }

    function test_staleZeroFutureAndRevertingOracleAreUnavailable() public {
        for (uint256 i; i < 4; i++) {
            oracle.set(i == 0 ? 0 : 1 ether, i == 1 ? block.timestamp - 3601 : i == 2 ? block.timestamp + 1 : block.timestamp);
            oracle.setBroken(i == 3);
            vm.prank(KEEPER);
            vm.expectRevert(LiquidityBuybackExecutor.OracleUnavailable.selector);
            executor.execute(1 ether, 1 ether, block.timestamp);
            _assertUnspent(0);
        }
    }

    function test_healthyFalseRevertAndMissingAbiAllStopExecution() public {
        health.set(false, false);
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.Unhealthy.selector);
        executor.execute(1 ether, 1 ether, block.timestamp);
        health.set(true, true);
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.Unhealthy.selector);
        executor.execute(1 ether, 1 ether, block.timestamp);
        executor = _executor(LiquidityBuybackExecutor.Stream.Vig, RESERVE, PRIZES, oracle,
            ILiquidityHealth(address(new BuybackNonconformingHealth())));
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.Unhealthy.selector);
        executor.execute(1 ether, 1 ether, block.timestamp);
        _assertUnspent(0);
    }

    function test_callbackRequiresActualManagerAndActiveUnlock() public {
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidCallback.selector);
        executor.unlockCallback(abi.encode(1 ether));
        vm.prank(address(manager));
        vm.expectRevert(LiquidityBuybackExecutor.InvalidCallback.selector);
        executor.unlockCallback(abi.encode(1 ether));
        _assertUnspent(0);
        _execute(0.1 ether);
    }

    function test_pauseAndGovernanceRecoveryDoNotGrantKeeperWithdrawalAuthority() public {
        executor.pause();
        vm.prank(KEEPER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        executor.execute(1 ether, 1 ether, block.timestamp);
        vm.prank(KEEPER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, KEEPER));
        executor.recover(IERC20(address(0)), 1 ether);
        uint256 ownerBefore = address(this).balance;
        executor.recover(IERC20(address(0)), 1 ether);
        assertEq(address(this).balance, ownerBefore + 1 ether);
        token.transfer(address(executor), 101);
        uint256 ownerTokens = token.balanceOf(address(this));
        executor.recover(token, 101);
        assertEq(token.balanceOf(address(this)), ownerTokens + 101);
        executor.unpause();
        vm.expectRevert(Pausable.ExpectedPause.selector);
        executor.recover(token, 1);
        _execute(0.1 ether);
    }

    function testFuzz_directTokenRevenueSplitsOddWeiWithoutSpendingEth(uint96 seed) public {
        uint256 amount = bound(seed, 1, 1000 ether);
        token.transfer(address(executor), amount);
        health.set(false, true);
        oracle.setBroken(true);
        vm.expectEmit(true, true, false, true, address(executor));
        emit LiquidityBuybackExecutor.TokenRevenueDistributed(1, 0, amount, amount / 2, amount - amount / 2, RESERVE, PRIZES);
        vm.prank(KEEPER);
        assertEq(executor.distributeTokenRevenue(), amount);
        assertEq(token.balanceOf(RESERVE), amount / 2);
        assertEq(token.balanceOf(PRIZES), amount - amount / 2);
        assertEq(token.balanceOf(address(executor)), 0);
        assertEq(address(executor).balance, 10 ether);
        assertEq(executor.spentInDay(block.timestamp / 1 days), 0);
        assertEq(executor.nextExecutionAt(), 0);
        assertEq(executor.sequence(), 1);
    }

    function test_directRevenueUsesSharedSequenceAndSwapLeavesPriorTokenRevenueUntouched() public {
        token.transfer(address(executor), 101);
        (, uint256 bought) = _execute(1 ether);
        assertEq(token.balanceOf(address(executor)), 101);
        assertEq(executor.sequence(), 1);
        uint256 cooldown = executor.nextExecutionAt();
        vm.prank(KEEPER);
        executor.distributeTokenRevenue();
        assertEq(executor.sequence(), 2);
        assertEq(token.balanceOf(RESERVE), bought / 2 + 50);
        assertEq(token.balanceOf(PRIZES), bought - bought / 2 + 51);
        assertEq(executor.spentInDay(block.timestamp / 1 days), 1 ether);
        assertEq(executor.nextExecutionAt(), cooldown);
        assertEq(address(executor).balance, 9 ether);
    }

    function test_directRevenueRequiresKeeperUnpausedAndNonzeroTokens() public {
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidAmount.selector);
        executor.distributeTokenRevenue();
        token.transfer(address(executor), 1);
        vm.expectRevert(LiquidityBuybackExecutor.NotKeeper.selector);
        executor.distributeTokenRevenue();
        executor.pause();
        vm.prank(KEEPER);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        executor.distributeTokenRevenue();
        executor.unpause();
        vm.prank(KEEPER);
        executor.distributeTokenRevenue();
        assertEq(token.balanceOf(RESERVE), 0);
        assertEq(token.balanceOf(PRIZES), 1);
    }

    function test_singleRecipientDirectRevenueAndSharedVigCustodyRemainExact() public {
        for (uint8 i = 1; i < 4; i++) {
            address recipient = address(uint160(0xF000 + i));
            executor = _executor(LiquidityBuybackExecutor.Stream(i), recipient, address(0), oracle, health);
            token.transfer(address(executor), 101);
            vm.prank(KEEPER);
            executor.distributeTokenRevenue();
            assertEq(token.balanceOf(recipient), 101);
        }
        executor = _executor(LiquidityBuybackExecutor.Stream.Vig, RESERVE, RESERVE, oracle, health);
        token.transfer(address(executor), 101);
        vm.prank(KEEPER);
        executor.distributeTokenRevenue();
        assertEq(token.balanceOf(RESERVE), 101);
    }

    function test_constructorRejectsAbsentDependenciesAndInvalidStreamDestinations() public {
        LiquidityBuybackExecutor.Policy memory policy = _policy();
        vm.expectRevert(LiquidityBuybackExecutor.InvalidConfiguration.selector);
        new LiquidityBuybackExecutor(address(this), manager, key, oracle, ILiquidityHealth(address(0)),
            LiquidityBuybackExecutor.Stream.Vig, RESERVE, PRIZES, policy);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidConfiguration.selector);
        new LiquidityBuybackExecutor(address(this), manager, key, IOmrOracle(address(0)), health,
            LiquidityBuybackExecutor.Stream.Vig, RESERVE, PRIZES, policy);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidConfiguration.selector);
        new LiquidityBuybackExecutor(address(this), manager, key, oracle, health,
            LiquidityBuybackExecutor.Stream.Vig, RESERVE, address(0), policy);
        vm.expectRevert(LiquidityBuybackExecutor.InvalidConfiguration.selector);
        new LiquidityBuybackExecutor(address(this), manager, key, oracle, health,
            LiquidityBuybackExecutor.Stream.Pol, RESERVE, PRIZES, policy);
        policy.slippageBps = 1001;
        vm.expectRevert(LiquidityBuybackExecutor.InvalidConfiguration.selector);
        new LiquidityBuybackExecutor(address(this), manager, key, oracle, health,
            LiquidityBuybackExecutor.Stream.Vig, RESERVE, PRIZES, policy);
    }
}

contract LiquidityBuybackBoundaryTest is BuybackMarketFixture {
    BuybackBoundaryToken internal boundary;
    function _token() internal override returns (IERC20) {
        boundary = new BuybackBoundaryToken();
        return IERC20(address(boundary));
    }

    function test_feeOnManagerOutputCannotForgeBoughtAmountOrSpendBudget() public {
        boundary.configure(address(manager), address(0), address(0));
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.TransferMismatch.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp);
        _assertUnspent(0);
    }

    function test_feeOnDistributionCannotUnderfundFixedRecipient() public {
        boundary.configure(address(executor), address(0), address(0));
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.TransferMismatch.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp);
        _assertUnspent(0);
    }

    function test_secondRecipientFailureRollsBackFirstDeliverySwapAndBudget() public {
        boundary.configure(address(0), PRIZES, address(0));
        vm.prank(KEEPER);
        vm.expectRevert(BuybackBoundaryToken.Rejected.selector);
        executor.execute(1 ether, 0.95 ether, block.timestamp);
        _assertUnspent(0);
    }

    function test_directTokenDistributionFailureRollsBackRecipientAndSharedSequence() public {
        token.transfer(address(executor), 101);
        boundary.configure(address(0), PRIZES, address(0));
        vm.prank(KEEPER);
        vm.expectRevert(BuybackBoundaryToken.Rejected.selector);
        executor.distributeTokenRevenue();
        _assertUnspent(101);
        boundary.configure(address(executor), address(0), address(0));
        vm.prank(KEEPER);
        vm.expectRevert(LiquidityBuybackExecutor.TransferMismatch.selector);
        executor.distributeTokenRevenue();
        _assertUnspent(101);
    }

    function test_recipientCallbackCannotReenterSwapDirectDistributionOrUnlock() public {
        BuybackReentrantRecipient recipient = new BuybackReentrantRecipient();
        executor = _executor(LiquidityBuybackExecutor.Stream.Community, address(recipient), address(0), oracle, health);
        executor.setKeeper(address(recipient), true);
        boundary.configure(address(0), address(0), address(recipient));
        recipient.arm(executor, abi.encodeCall(executor.execute, (1 ether, 0.95 ether, block.timestamp)));
        _execute(0.1 ether);
        assertFalse(recipient.nestedSucceeded());
        assertEq(recipient.nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        token.transfer(address(executor), 101);
        recipient.arm(executor, abi.encodeCall(executor.distributeTokenRevenue, ()));
        vm.prank(KEEPER);
        executor.distributeTokenRevenue();
        assertFalse(recipient.nestedSucceeded());
        assertEq(recipient.nestedError(), ReentrancyGuard.ReentrancyGuardReentrantCall.selector);
        token.transfer(address(executor), 101);
        recipient.arm(executor, abi.encodeCall(executor.unlockCallback, (abi.encode(1 ether))));
        vm.prank(KEEPER);
        executor.distributeTokenRevenue();
        assertFalse(recipient.nestedSucceeded());
        assertEq(recipient.nestedError(), LiquidityBuybackExecutor.InvalidCallback.selector);
        assertEq(executor.sequence(), 3);
    }
}
