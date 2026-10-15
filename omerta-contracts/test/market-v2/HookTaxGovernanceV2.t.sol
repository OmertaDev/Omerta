// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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
        bytes[] memory mutations = new bytes[](5);
        mutations[0] = abi.encodeWithSignature("queueTaxConfig((uint16,uint16,uint16,uint16))", uint16(0), uint16(0), uint16(0), uint16(0));
        mutations[1] = abi.encodeWithSignature("executeTaxConfig((uint16,uint16,uint16,uint16),uint256)", uint16(0), uint16(0), uint16(0), uint16(0), uint256(1));
        mutations[2] = abi.encodeWithSignature("cancelTaxConfig()");
        mutations[3] = abi.encodeWithSignature("setSellTax(uint256,uint256,uint256,uint256)", 1000, 0, 0, 0);
        mutations[4] = abi.encodeWithSignature("setRecipients(address,address,address,address)", address(0xBAD), address(0xBAD), address(0xBAD), address(0xBAD));
        for (uint256 round; round < 2; ++round) {
            for (uint256 i; i < mutations.length; ++i) {
                (bool success,) = address(hook).call(mutations[i]);
                assertFalse(success, "removed governance entry point remained callable");
            }
            vm.warp(block.timestamp + 48 hours);
        }
        assertEq(hook.BASE_SELL_BPS(), 500);
        assertEq(hook.MAX_SURGE_BPS(), 50);
        assertEq(hook.openingEndsAtBlock(), 300);
        for (uint256 i; i < 5; ++i) assertEq(hook.recipients(i), recipients[i]);
        _swap(false, -int256(1 ether));
        _assertConserved(eth);
    }

    function testChainChangesCannotCreateTaxExecutionAuthority() public {
        vm.chainId(block.chainid + 1);
        vm.warp(block.timestamp + 48 hours);
        (bool success,) = address(hook).call(abi.encodeWithSignature("executeTaxConfig((uint16,uint16,uint16,uint16),uint256)",
            uint16(800), uint16(0), uint16(0), uint16(0), uint256(1)));
        assertFalse(success);
        assertEq(hook.BASE_SELL_BPS(), 500);
        assertEq(hook.MAX_SURGE_BPS(), 50);
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
        Currency currency = exactOutput ? _key.currency1 : _key.currency0;
        uint256 oldTotal = hook.totalOwed(currency);
        BalanceDelta result = _router.swap{value: buy ? 100 ether : 0}(_key,
            SwapParams(buy, exactOutput ? int256(amount) : -int256(amount),
                buy ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), "");
        if (!buy) {
            uint256 fees = hook.totalOwed(currency) - oldTotal;
            uint256 gross = exactOutput ? uint256(-int256(result.amount1())) - fees : uint256(uint128(result.amount0())) + fees;
            assertLe(fees, gross * 550 / 10_000);
            uint256 ops = (gross * 500 / 10_000) * 200 / 500;
            if (exactOutput) expectedOpsToken += ops;
            else expectedOpsEth += ops;
        }
        ++swaps;
    }

    function sweep(uint8 rawBucket, bool tokenFee) external {
        hook.sweep(Currency.wrap(tokenFee ? address(omr) : address(0)), uint8(bound(rawBucket, 1, 4)));
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
        for (uint256 i; i < 5; ++i) assertEq(hook.recipients(i), recipients[i]);
        assertEq(hook.BASE_SELL_BPS(), 500); assertEq(hook.MAX_SURGE_BPS(), 50);
        assertEq(hook.openingEndsAtBlock(), 300); assertEq(hook.poolFee(), 3000); assertEq(hook.tickSpacing(), 60);
        assertFalse(hook.managerCollectsRevenue()); // Standard-manager accounting compatibility fixture.
    }
}
