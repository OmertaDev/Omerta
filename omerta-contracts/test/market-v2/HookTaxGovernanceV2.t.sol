// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {OmertaHookV2Fixture, MockOmrMarketV2} from "./OmertaHookV2.t.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// @dev Retains the prior policy-review filename; the current policy is immutable.
contract HookFixedPolicyV2Test is OmertaHookV2Fixture {
    function testFormerTaxGovernanceCannotChangePolicyAfterDelay() public {
        bytes[] memory mutations = new bytes[](8);
        mutations[0] = abi.encodeWithSignature("queueTaxConfig((uint16,uint16,uint16,uint16))", uint16(0), uint16(0), uint16(0), uint16(0));
        mutations[1] = abi.encodeWithSignature("executeTaxConfig((uint16,uint16,uint16,uint16),uint256)", uint16(0), uint16(0), uint16(0), uint16(0), uint256(1));
        mutations[2] = abi.encodeWithSignature("cancelTaxConfig()");
        mutations[3] = abi.encodeWithSignature("setSellTax(uint256,uint256,uint256,uint256)", 1000, 0, 0, 0);
        mutations[4] = abi.encodeWithSignature("setRecipients(address,address,address,address)", address(0xBAD), address(0xBAD), address(0xBAD), address(0xBAD));
        mutations[5] = abi.encodeWithSignature("setRewardsRecipient(address)", address(0xBAD));
        mutations[6] = abi.encodeWithSignature("setBaseSellBps(uint16)", uint16(0));
        mutations[7] = abi.encodeWithSignature("setRecipients(address,address,address,address,address)", address(0xBAD), address(0xBAD), address(0xBAD), address(0xBAD), address(0xBAD));
        for (uint256 round; round < 2; ++round) {
            for (uint256 i; i < mutations.length; ++i) {
                (bool success,) = address(hook).call(mutations[i]);
                assertFalse(success, "removed governance entry point remained callable");
            }
            vm.warp(block.timestamp + 48 hours);
        }
        assertEq(hook.BASE_SELL_BPS(), 350);
        assertEq(hook.REWARDS_BPS(), 50);
        assertEq(hook.BASE_SELL_BPS() + hook.REWARDS_BPS(), 400);
        assertEq(hook.MAX_SURGE_BPS(), 50);
        assertEq(hook.MAX_HOOK_BPS(), 450);
        assertEq(hook.openingEndsAtBlock(), 300);
        for (uint256 i; i < 5; ++i) assertEq(hook.recipients(i), recipients[i]);
        assertEq(hook.rewardsRecipient(), rewardsRecipient);
        _swap(false, -int256(1 ether));
        _assertConserved(eth);
    }

    function testChainChangesCannotCreateTaxExecutionAuthority() public {
        vm.chainId(block.chainid + 1);
        vm.warp(block.timestamp + 48 hours);
        (bool success,) = address(hook).call(abi.encodeWithSignature("executeTaxConfig((uint16,uint16,uint16,uint16),uint256)",
            uint16(800), uint16(0), uint16(0), uint16(0), uint256(1)));
        assertFalse(success);
        assertEq(hook.BASE_SELL_BPS(), 350);
        assertEq(hook.REWARDS_BPS(), 50);
        assertEq(hook.BASE_SELL_BPS() + hook.REWARDS_BPS(), 400);
        assertEq(hook.MAX_SURGE_BPS(), 50);
        assertEq(hook.MAX_HOOK_BPS(), 450);
        assertEq(hook.rewardsRecipient(), rewardsRecipient);
    }
}

contract HookFixedPolicyHandler is Test {
    OmertaHookV2 public immutable hook;
    MockOmrMarketV2 public immutable omr;
    PoolSwapTest private immutable _router;
    PoolKey private _key;
    uint256 public expectedOpsEth;
    uint256 public expectedOpsToken;
    uint256 public swaps;
    uint256 public rejectedMutations;
    uint256[6] public accruedEth;
    uint256[6] public accruedToken;
    uint256[6] public paidEth;
    uint256[6] public paidToken;

    constructor(OmertaHookV2 hook_, PoolSwapTest router_, MockOmrMarketV2 token_) {
        hook = hook_; _router = router_; omr = token_; _key = hook_.poolKey();
        token_.approve(address(router_), type(uint256).max);
    }

    receive() external payable {}

    function attemptMutation(uint16 rwa, uint16 community, uint16 pol, uint16 surge) external {
        (bool success,) = address(hook).call(abi.encodeWithSignature("queueTaxConfig((uint16,uint16,uint16,uint16))", rwa, community, pol, surge));
        assertFalse(success, "immutable policy accepted a proposal");
        ++rejectedMutations;
    }

    function progress(uint32 timeForward) external {
        vm.warp(block.timestamp + bound(timeForward, 0, 3 days));
    }

    function trade(uint64 seed, bool buy, bool exactOutput) external {
        vm.deal(address(this), 1000 ether); omr.mint(address(this), 1000 ether);
        uint256 amount = bound(seed, 1e9, 0.1 ether);
        // Hooks charge the unspecified currency, which depends on direction as well as exactness.
        bool nativeFee = exactOutput ? buy : !buy;
        Currency currency = nativeFee ? _key.currency0 : _key.currency1;
        uint256 oldTotal = hook.totalOwed(currency);
        BalanceDelta result = _router.swap{value: buy ? 100 ether : 0}(_key,
            SwapParams(buy, exactOutput ? int256(amount) : -int256(amount),
                buy ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), "");
        uint256 fees = hook.totalOwed(currency) - oldTotal;
        int256 chargedDelta = nativeFee ? int256(result.amount0()) : int256(result.amount1());
        uint256 gross = chargedDelta > 0 ? uint256(chargedDelta) + fees : uint256(-chargedDelta) - fees;
        // This standard-manager fixture uses the standalone fallback: base on sells, rewards on both.
        // The canonical restricted manager's both-direction base collection is covered separately.
        uint256 base = buy ? 0 : gross * 350 / 10_000;
        uint256 rewards = gross * 50 / 10_000;
        uint256 extra = fees - base - rewards;
        uint256 extraRate = buy && block.number < hook.openingEndsAtBlock() ? hook.openingBuyBps() : (buy ? 0 : 50);
        assertLe(extra, gross * extraRate / 10_000);
        assertLe(fees, gross * (buy ? extraRate + 50 : 450) / 10_000);
        uint256 ops = base * 127 / 350;
        uint256 rwa = base * 51 / 350;
        uint256 community = base * 76 / 350;
        uint256[6] storage accrued = nativeFee ? accruedEth : accruedToken;
        accrued[0] += ops;
        accrued[1] += rwa;
        accrued[2] += community;
        accrued[3] += base - ops - rwa - community; // POL includes the base split's rounding remainder.
        accrued[4] += extra;
        accrued[5] += rewards;
        if (nativeFee) expectedOpsEth += ops;
        else expectedOpsToken += ops;
        ++swaps;
    }

    function sweep(uint8 rawBucket, bool tokenFee) external {
        uint8 bucket = uint8(bound(rawBucket, 1, 5)); // OPS remains unswept for its cumulative invariant.
        Currency currency = Currency.wrap(tokenFee ? address(omr) : address(0));
        uint256 beforeOwed = hook.owed(currency, bucket);
        uint256 beforeTotal = hook.totalOwed(currency);
        try hook.sweep(currency, bucket) returns (uint256 amount) {
            assertEq(amount, beforeOwed);
            if (tokenFee) paidToken[bucket] += amount;
            else paidEth[bucket] += amount;
        } catch {
            // The shared fixture deliberately makes the immutable rewards recipient refuse ETH.
            assertTrue(!tokenFee && bucket == 5, "unexpected sweep failure");
            assertEq(hook.owed(currency, bucket), beforeOwed);
            assertEq(hook.totalOwed(currency), beforeTotal);
        }
    }
}

contract HookFixedPolicyInvariantTest is OmertaHookV2Fixture {
    HookFixedPolicyHandler private _handler;

    function setUp() public override {
        super.setUp();
        _handler = new HookFixedPolicyHandler(hook, router, omr);
        targetContract(address(_handler));
    }

    function invariantFixedOpsAndFundedLiabilitiesSurviveMutationAttempts() public view {
        _assertConserved(eth); _assertConserved(token);
        assertEq(hook.owed(eth, 0), _handler.expectedOpsEth());
        assertEq(hook.owed(token, 0), _handler.expectedOpsToken());
        for (uint256 i; i < 6; ++i) {
            assertEq(hook.owed(eth, uint8(i)) + _handler.paidEth(i), _handler.accruedEth(i), "ETH fee allocation");
            assertEq(hook.owed(token, uint8(i)) + _handler.paidToken(i), _handler.accruedToken(i), "OMR fee allocation");
        }
        for (uint256 i; i < 5; ++i) assertEq(hook.recipients(i), recipients[i]);
        assertEq(hook.BASE_SELL_BPS(), 350); assertEq(hook.REWARDS_BPS(), 50);
        assertEq(hook.BASE_SELL_BPS() + hook.REWARDS_BPS(), 400);
        assertEq(hook.MAX_SURGE_BPS(), 50); assertEq(hook.MAX_HOOK_BPS(), 450);
        assertEq(hook.rewardsRecipient(), rewardsRecipient);
        assertEq(hook.openingEndsAtBlock(), 300); assertEq(hook.poolFee(), 3000); assertEq(hook.tickSpacing(), 60);
        assertFalse(hook.managerCollectsRevenue()); // Standard-manager accounting compatibility fixture.
    }
}
