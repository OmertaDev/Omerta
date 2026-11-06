// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Vm} from "forge-std/Vm.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaSwapRouterV2} from "../../src/market-v2/OmertaSwapRouterV2.sol";

interface IRewardsRevenueManagerV2 {
    function owed(Currency, uint8) external view returns (uint256);
    function totalOwed(Currency) external view returns (uint256);
    function sweep(Currency, uint8) external returns (uint256);
    function claim(Currency, uint8, address) external returns (uint256);
}

contract RefusingRewardsFeeRecipientV2 {
    receive() external payable { revert("no ETH"); }
}

/// @dev Real restricted token, manager, canonical hook and production router; no reward conversion.
contract RewardsFeeV2Test is Test {
    using TransientStateLibrary for IPoolManager;
    uint160 private constant Q96 = 79228162514264337593543950336;
    bytes32 private constant SWAP_TOPIC = keccak256("Swap(bytes32,address,int128,int128,uint160,uint128,int24,uint24)");
    IPoolManager private manager;
    IRewardsRevenueManagerV2 private revenue;
    OmertaRestrictedOMRV2 private omr;
    OmertaHookV2 private hook;
    OmertaSwapRouterV2 private router;
    PoolKey private key;
    Currency private eth = Currency.wrap(address(0));
    Currency private token;
    address private trader = address(0xCAFE);
    address private rewardRecipient;

    function setUp() public {
        vm.roll(100);
        vm.warp(3600);
        omr = new OmertaRestrictedOMRV2(address(this));
        rewardRecipient = address(new RefusingRewardsFeeRecipientV2());
        address[4] memory recipients = [address(0xD), address(0xE), address(0xF), address(0x10)];
        manager = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2", abi.encode(address(omr), address(this), recipients, rewardRecipient)));
        revenue = IRewardsRevenueManagerV2(address(manager));
        token = Currency.wrap(address(omr));
        router = new OmertaSwapRouterV2(manager, omr);
        PoolModifyLiquidityTest lpRouter = new PoolModifyLiquidityTest(manager);
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
            | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address target = address(uint160((uint256(0xABC1) << 144) | flags));
        address[5] memory hookRecipients = [recipients[0], recipients[1], recipients[2], recipients[3], address(0x11)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(omr), address(this), uint24(3000), int24(60),
            hookRecipients, OmertaHookV2.OpeningConfig(200, 50, 10 ether), uint24(100), uint32(60), rewardRecipient), target);
        hook = OmertaHookV2(payable(target));
        key = hook.poolKey();
        _register(address(this), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(hook), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(rewardRecipient, IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(lpRouter), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        omr.bindSettlementManager(address(manager), address(manager).codehash);
        omr.sealPolicy();
        vm.prank(trader, trader);
        omr.registerWallet(trader);
        omr.transfer(trader, 10_000 ether);
        manager.initialize(key, Q96);
        vm.deal(address(this), 1_000_000 ether);
        vm.deal(trader, 10_000 ether);
        omr.approve(address(lpRouter), type(uint256).max);
        vm.prank(trader, trader);
        omr.approve(address(router), type(uint256).max);
        lpRouter.modifyLiquidity{value: 1001 ether}(key, ModifyLiquidityParams(-887220, 887220, 1000e18, bytes32(0)), "");
        vm.roll(301);
    }

    function _register(address account, IOmertaRestrictedOMRV2.OperatorRole role) private {
        omr.setOperator(account, role, account.codehash);
    }

    function _swap(bool buy, bool exactInput, uint256 amount, uint160 limit)
        private returns (BalanceDelta delta, int128 raw0, int128 raw1)
    {
        vm.recordLogs();
        vm.prank(trader, trader);
        delta = router.swap{value: buy ? 1000 ether : 0}(key,
            SwapParams(buy, exactInput ? -int256(amount) : int256(amount), limit), 0, type(uint256).max, uint64(block.timestamp));
        Vm.Log[] memory logs = vm.getRecordedLogs();
        for (uint256 i; i < logs.length; ++i) {
            if (logs[i].emitter == address(manager) && logs[i].topics[0] == SWAP_TOPIC) {
                (raw0, raw1,,,,) = abi.decode(logs[i].data, (int128, int128, uint160, uint128, int24, uint24));
                return (delta, raw0, raw1);
            }
        }
        revert("missing raw swap");
    }

    function _assertSwap(bool buy, bool exactInput, bool isPartial) private {
        bool nativeFee = exactInput ? !buy : buy;
        Currency currency = nativeFee ? eth : token;
        uint256[3] memory beforeFees = [revenue.totalOwed(currency) - revenue.owed(currency, 4),
            revenue.owed(currency, 4), hook.owed(currency, hook.STABILITY())];
        uint160 limit = isPartial ? TickMath.getSqrtPriceAtTick(buy ? int24(-10) : int24(10)) : buy ? Q96 / 2 : Q96 * 2;
        uint256 amount = isPartial ? 100 ether : 1 ether;
        (BalanceDelta delta, int128 raw0, int128 raw1) = _swap(buy, exactInput, amount, limit);
        int256 raw = nativeFee ? int256(raw0) : int256(raw1);
        uint256 magnitude = uint256(raw < 0 ? -raw : raw);
        uint256 base = magnitude * 350 / 10_000;
        uint256 rewards = magnitude * 50 / 10_000;
        uint256 stability = hook.owed(currency, hook.STABILITY()) - beforeFees[2];
        assertEq(revenue.totalOwed(currency) - revenue.owed(currency, 4) - beforeFees[0], base, "unchanged base");
        assertEq(revenue.owed(currency, 4) - beforeFees[1], rewards, "mandatory manager reward50");
        assertEq(hook.owed(currency, hook.REWARDS()), 0, "hook never duplicates manager rewards");
        assertLe(stability, magnitude * 50 / 10_000, "unchanged pressure/opening budget");
        assertEq(nativeFee ? int256(delta.amount0()) : int256(delta.amount1()), raw - int256(base + rewards + stability));
        assertEq(nativeFee ? delta.amount1() : delta.amount0(), nativeFee ? raw1 : raw0, "other leg unchanged");
        if (isPartial) assertLt(exactInput ? uint256(-int256(buy ? raw0 : raw1)) : uint256(int256(buy ? raw1 : raw0)), amount);
        for (uint8 i; i < 4; ++i) assertEq(hook.owed(currency, i), 0, "no duplicated base in hook");
        uint256 sum;
        for (uint8 i; i < 6; ++i) sum += hook.owed(currency, i);
        assertEq(sum, hook.totalOwed(currency));
        assertEq(nativeFee ? address(hook).balance : omr.balanceOf(address(hook)), sum, "hook assets cover six buckets");
        assertEq(manager.getNonzeroDeltaCount(), 0, "all ETH/OMR settled");
    }

    function testAllFourModesCollectRewardsWithOriginalBase() public {
        for (uint8 i; i < 4; ++i) _assertSwap(i < 2, i % 2 == 0, false);
    }

    function testFuzzIndependentFeeRoundingFitsCapAndInt128(uint128 magnitudeSeed, uint16 stabilitySeed) public pure {
        uint256 magnitude = bound(uint256(magnitudeSeed), 0, uint256(1) << 127);
        uint256 stabilityBps = bound(uint256(stabilitySeed), 0, 50);
        uint256 rewards = magnitude * 50 / 10_000;
        uint256 stability = magnitude * stabilityBps / 10_000;
        uint256 base = magnitude * 350 / 10_000;
        assertEq((base + rewards) / 8, rewards, "sumfloors recovers exact reward and hook limit");
        assertLe(base + rewards, magnitude * 400 / 10_000, "mandatory nominal400bound");
        assertLe(stability, magnitude * 50 / 10_000, "canonical hook retains original50cap");
        assertLe(rewards + stability, magnitude * 100 / 10_000, "separate reward plus stability budget");
        assertLe(base + rewards + stability, magnitude * 450 / 10_000, "combined budget");
        assertLe(base + rewards + stability, uint256(uint128(type(int128).max)), "even abs(int128.min) fee fits positive int128");
    }

    function testMinimumInt128RawMagnitudeHasBoundedExactFeeComponents() public pure {
        uint256 magnitude = uint256(-int256(type(int128).min));
        assertEq(magnitude, uint256(1) << 127);
        uint256 base = magnitude * 350 / 10_000;
        uint256 reward = magnitude * 50 / 10_000;
        assertEq((base + reward) / 8, reward);
        assertLe(base + reward, magnitude * 400 / 10_000);
        assertLt(base + reward, uint256(1) << 124);
        assertLe(base + 2 * reward, uint256(uint128(type(int128).max)));
    }

    function testFuzzPartialFillUsesActualRewardLeg(bool buy, bool exactInput) public {
        _assertSwap(buy, exactInput, true);
    }

    function testOpeningExactOutputQuoteCapIncludesRewardEth() public {
        uint256 snapshot = vm.snapshotState();
        (, int128 raw0,) = _swap(true, false, 9.49 ether, Q96 / 2);
        uint256 rawInput = uint256(-int256(raw0));
        uint256 withoutRewards = rawInput + rawInput * 350 / 10_000 + rawInput * 50 / 10_000;
        assertLe(withoutRewards, 10 ether, "old cap calculation would accept");
        assertGt(withoutRewards + rawInput * 50 / 10_000, 10 ether, "reward takes actual input over cap");
        assertTrue(vm.revertToState(snapshot));
        vm.roll(101);
        vm.expectRevert(abi.encodeWithSignature("WrappedError(address,bytes4,bytes,bytes)", address(hook), IHooks.afterSwap.selector,
            abi.encodeWithSelector(OmertaHookV2.OpeningBuyTooLarge.selector), abi.encodeWithSelector(Hooks.HookCallFailed.selector)));
        _swap(true, false, 9.49 ether, Q96 / 2);
        assertEq(hook.totalOwed(eth), 0, "failed opening swap rolls back all buckets");
        assertEq(revenue.totalOwed(eth), 0, "failed opening swap rolls back mandatory rewards too");
        assertEq(manager.getNonzeroDeltaCount(), 0);
    }

    function testRewardRecipientFailureIsIsolatedAndRedirectRequiresThatRecipient() public {
        _assertSwap(false, true, false);
        uint256 amount = revenue.owed(eth, 4);
        vm.expectRevert();
        revenue.sweep(eth, 4);
        assertEq(revenue.owed(eth, 4), amount);
        vm.expectRevert(bytes4(keccak256("OnlyRevenueRecipient()")));
        revenue.claim(eth, 4, trader);
        vm.prank(rewardRecipient);
        revenue.claim(eth, 4, trader);
        assertEq(revenue.owed(eth, 4), 0);
        _assertSwap(true, false, false);
    }

    function testRewardTokenSweepPaysOnlyImmutableTypedRecipient() public {
        _assertSwap(true, true, false);
        uint256 amount = revenue.owed(token, 4);
        revenue.sweep(token, 4);
        assertEq(omr.balanceOf(rewardRecipient), amount);
        assertEq(revenue.owed(token, 4), 0);
        assertEq(hook.totalOwed(token), 0);
    }

    receive() external payable {}
}
