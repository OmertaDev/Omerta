// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {ModifyLiquidityParams, SwapParams} from "v4-core/types/PoolOperation.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {TransientStateLibrary} from "v4-core/libraries/TransientStateLibrary.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaSwapRouterV2} from "../../src/market-v2/OmertaSwapRouterV2.sol";
import {OmertaMarketStateV2} from "../../src/market-v2/OmertaMarketStateV2.sol";
import {OmertaEthStakingV2} from "../../src/market-v2/OmertaEthStakingV2.sol";
import {OmertaEthRewardsV2} from "../../src/market-v2/OmertaEthRewardsV2.sol";

interface IEthRewardsIntegrationRevenueV2 {
    function rewardsRecipient() external view returns (address);
    function owed(Currency currency, uint8 bucket) external view returns (uint256);
    function totalOwed(Currency currency) external view returns (uint256);
}

/// @dev The fixed manager recipient is this factory's first CREATE address.
contract EthRewardsDeploymentFixtureV2 {
    bool private used;

    function deploy(
        IOmertaRestrictedOMRV2 omr,
        address safe,
        address vault,
        address manager,
        OmertaSwapRouterV2 router,
        IOmertaMarketStateV2 marketState,
        PoolKey memory key,
        OmertaEthRewardsV2.Policy memory policy
    ) external returns (OmertaEthRewardsV2 rewards) {
        require(!used);
        used = true;
        rewards = new OmertaEthRewardsV2(omr, safe, safe, vault, manager, router, marketState, key, policy);
    }
}

/// @dev Uses actual restricted OMR, fee accounting, hook observations and canonical swap settlement.
contract EthRewardsIntegrationV2Test is Test {
    using PoolIdLibrary for PoolKey;
    using TransientStateLibrary for IPoolManager;

    uint160 private constant Q96 = 79228162514264337593543950336;
    uint256 private constant DURATION = 30 days;
    address private constant ALICE = address(0xA11CE);
    address private constant BOB = address(0xB0B);
    address private constant TRADER = address(0xCAFE);

    IPoolManager private manager;
    IEthRewardsIntegrationRevenueV2 private revenue;
    OmertaRestrictedOMRV2 private omr;
    OmertaHookV2 private hook;
    OmertaSwapRouterV2 private router;
    OmertaMarketStateV2 private marketState;
    OmertaEthStakingV2 private vault;
    OmertaEthRewardsV2 private rewards;
    PoolModifyLiquidityTest private lpRouter;
    PoolKey private key;
    uint64 private origin;
    Currency private eth = Currency.wrap(address(0));
    Currency private token;
    address[4] private recipients = [address(0xD), address(0xE), address(0xF), address(0x10)];

    function setUp() public {
        vm.roll(100);
        vm.warp(3600);
        vm.deal(address(this), 1_000_000 ether);
        omr = new OmertaRestrictedOMRV2(address(this));
        EthRewardsDeploymentFixtureV2 factory = new EthRewardsDeploymentFixtureV2();
        address predictedRewards = vm.computeCreateAddress(address(factory), 1);
        manager = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(omr), address(this), recipients, predictedRewards)));
        revenue = IEthRewardsIntegrationRevenueV2(address(manager));
        token = Currency.wrap(address(omr));
        router = new OmertaSwapRouterV2(manager, omr);
        lpRouter = new PoolModifyLiquidityTest(manager);
        vault = new OmertaEthStakingV2(omr, address(this));
        hook = _deployHook(predictedRewards, 0xABCD);
        key = hook.poolKey();
        marketState = new OmertaMarketStateV2(hook, 1, 1 days, 1000);
        rewards = factory.deploy(omr, address(this), address(vault), address(manager), router, marketState, key, _policy());
        assertEq(address(rewards), predictedRewards, "fixed fee recipient must match explicit CREATE prediction");
        vault.setDistributor(address(rewards), address(rewards).codehash);

        _register(address(this), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(hook), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(vault), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        omr.setContractHolder(address(rewards), address(rewards).codehash);
        _register(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(lpRouter), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        omr.bindSettlementManager(address(manager), address(manager).codehash);
        omr.sealPolicy();
        _fundWallet(ALICE);
        _fundWallet(BOB);
        _fundWallet(TRADER);
        vm.deal(TRADER, 10_000 ether);
        vm.prank(TRADER, TRADER);
        omr.approve(address(router), type(uint256).max);
        manager.initialize(key, Q96);
        omr.approve(address(lpRouter), type(uint256).max);
        lpRouter.modifyLiquidity{value: 1001 ether}(
            key, ModifyLiquidityParams(-887220, 887220, 1000e18, bytes32(0)), ""
        );
        vault.activate();
        origin = vault.epochOrigin();
        vm.roll(301);
    }

    function testActualTradeAllocationConvertsToNativeStakeTimeClaimsAndMatureExits() public {
        _stake(ALICE, 100 ether);
        _tradeBothDirections();
        uint256 nativeTax = revenue.owed(eth, 4);
        uint256 omrTax = revenue.owed(token, 4);
        uint256 nativeBase = revenue.totalOwed(eth) - nativeTax;
        uint256 omrBase = revenue.totalOwed(token) - omrTax;
        assertGt(nativeTax, 0);
        assertGt(omrTax, 0);
        assertEq(hook.owed(eth, 5), 0);
        assertEq(hook.owed(token, 5), 0);

        rewards.collectTax();
        assertEq(address(rewards).balance, nativeTax);
        assertEq(omr.balanceOf(address(rewards)), omrTax);
        assertEq(revenue.totalOwed(eth), nativeBase);
        assertEq(revenue.totalOwed(token), omrBase);
        assertEq(rewards.totalNativeCollected(), nativeTax);
        assertEq(rewards.totalOmrCollected(), omrTax);
        _activateConversion();
        uint256 received = rewards.convertOmr(omrTax, rewards.minimumNativeFor(omrTax), uint64(vm.getBlockTimestamp()));
        assertGt(received, 0);
        assertEq(address(rewards).balance, nativeTax + received);
        assertEq(omr.balanceOf(address(rewards)), 0);
        assertEq(omr.allowance(address(rewards), address(router)), 0);
        assertEq(manager.getNonzeroDeltaCount(), 0);

        uint256 conversionTax = revenue.owed(eth, 4);
        assertGt(conversionTax, 0, "the canonical conversion sale also pays the fixed reward allocation");
        rewards.pause();
        rewards.revokeHealth();
        rewards.collectTax();
        uint256 budget = nativeTax + received + conversionTax;
        rewards.fundRewards(budget);
        assertEq(address(rewards).balance, 0);
        assertEq(revenue.owed(eth, 4), 0);
        assertEq(revenue.owed(token, 4), 0);
        assertEq(vault.epoch(0).budget, budget);
        assertEq(vault.totalEthFunded(), budget);
        assertEq(rewards.totalEthFunded(), budget);

        vm.warp(origin + 15 days);
        _stake(ALICE, 20 ether);
        _stake(BOB, 100 ether);
        assertEq(vault.lockPosition(ALICE, 0).unlocksAt, origin + DURATION);
        assertEq(vault.lockPosition(ALICE, 1).unlocksAt, origin + 45 days);
        vm.warp(origin + DURATION - 1);
        vm.prank(ALICE);
        vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector);
        vault.withdraw(0, 100 ether, ALICE);
        vm.warp(origin + DURATION);
        vault.finalizeEpoch(0);
        uint256 aliceWeight = 100 ether * DURATION + 20 ether * 15 days;
        uint256 bobWeight = 100 ether * 15 days;
        assertEq(vault.stakeSeconds(ALICE, 0), aliceWeight);
        assertEq(vault.stakeSeconds(BOB, 0), bobWeight);
        assertEq(vault.totalStakeSeconds(0), aliceWeight + bobWeight);
        uint256 aliceReward = Math.mulDiv(budget, aliceWeight, aliceWeight + bobWeight);
        uint256 bobReward = Math.mulDiv(budget, bobWeight, aliceWeight + bobWeight);
        assertEq(vault.claimable(ALICE, 0), aliceReward);
        assertEq(vault.claimable(BOB, 0), bobReward);
        vault.setPaused(true);
        _claim(ALICE);
        _claim(BOB);
        assertEq(ALICE.balance, aliceReward);
        assertEq(BOB.balance, bobReward);
        assertLe(budget - aliceReward - bobReward, 1);
        vm.prank(ALICE);
        vault.withdraw(0, 100 ether, ALICE);
        vm.prank(ALICE);
        vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector);
        vault.withdraw(1, 20 ether, ALICE);
        vm.prank(BOB);
        vm.expectRevert(OmertaEthStakingV2.LockNotMature.selector);
        vault.withdraw(0, 100 ether, BOB);
        vm.warp(origin + 45 days);
        vm.prank(ALICE);
        vault.withdraw(1, 20 ether, ALICE);
        vm.prank(BOB);
        vault.withdraw(0, 100 ether, BOB);
        assertEq(omr.balanceOf(ALICE), 10_000 ether);
        assertEq(omr.balanceOf(BOB), 10_000 ether);
        assertEq(vault.totalStaked(), 0);
        assertEq(vault.totalEthFunded(), vault.totalEthClaimed() + address(vault).balance);
    }

    function testCanonicalBindingsUseTheActualHookAndMarketStateSource() public view {
        assertEq(revenue.rewardsRecipient(), address(rewards));
        assertEq(hook.rewardsRecipient(), address(rewards));
        assertTrue(hook.managerCollectsRevenue());
        assertEq(address(hook.poolManager()), address(manager));
        assertEq(hook.omr(), address(omr));
        assertEq(address(marketState.source()), address(hook));
        assertEq(rewards.canonicalPoolId(), PoolId.unwrap(key.toId()));
        assertEq(rewards.rewardVault(), address(vault));
        assertEq(vault.distributor(), address(rewards));
    }

    function testConstructorRejectsAKeyThatTheCanonicalHookDoesNotServe() public {
        PoolKey memory wrongKey = key;
        wrongKey.fee += 1;
        vm.expectRevert(OmertaEthRewardsV2.InvalidConfiguration.selector);
        new OmertaEthRewardsV2(omr, address(this), address(this), address(vault), address(manager),
            router, marketState, wrongKey, _policy());
    }

    function testConstructorRejectsMarketStateFromAnotherActualHook() public {
        OmertaHookV2 otherHook = _deployHook(address(rewards), 0xBCDE);
        OmertaMarketStateV2 otherState = new OmertaMarketStateV2(otherHook, 1, 1 days, 1000);
        vm.expectRevert(OmertaEthRewardsV2.InvalidConfiguration.selector);
        new OmertaEthRewardsV2(omr, address(this), address(this), address(vault), address(manager),
            router, otherState, key, _policy());
    }

    function _deployHook(address receiver, uint256 prefix) private returns (OmertaHookV2 deployed) {
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address target = address(uint160((prefix << 144) | flags));
        address[5] memory hookRecipients = [recipients[0], recipients[1], recipients[2], recipients[3], address(0x11)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(omr), address(this),
            uint24(3000), int24(60), hookRecipients, OmertaHookV2.OpeningConfig(200, 50, 10 ether),
            uint24(100), uint32(60), receiver), target);
        deployed = OmertaHookV2(payable(target));
    }

    function _policy() private pure returns (OmertaEthRewardsV2.Policy memory) {
        return OmertaEthRewardsV2.Policy({
            maxOmrPerCall: 100 ether,
            maxOmrPerDay: 1000 ether,
            maxNativePerCall: 100 ether,
            maxNativePerDay: 1000 ether,
            maxSlippageBps: 1000,
            maxStressBps: 10_000,
            maxMarketAge: 1 days,
            maxDeadlineDelay: 1 hours,
            maxHealthLease: 1 hours,
            recoveryGrace: 60
        });
    }

    function _register(address operator, IOmertaRestrictedOMRV2.OperatorRole role) private {
        omr.setOperator(operator, role, operator.codehash);
    }

    function _fundWallet(address account) private {
        vm.prank(account, account);
        omr.registerWallet(account);
        omr.transfer(account, 10_000 ether);
        vm.prank(account);
        omr.approve(address(vault), type(uint256).max);
    }

    function _stake(address account, uint256 amount) private {
        vm.prank(account);
        vault.stake(amount);
    }

    function _claim(address account) private {
        uint64[] memory ids = new uint64[](1);
        vm.prank(account);
        vault.claim(ids, account);
    }

    function _tradeBothDirections() private {
        vm.prank(TRADER, TRADER);
        router.swap{value: 10 ether}(key, SwapParams(true, -10 ether, Q96 / 2), 1, 10 ether, uint64(block.timestamp));
        vm.prank(TRADER, TRADER);
        router.swap(key, SwapParams(false, -10 ether, Q96 * 2), 1, 10 ether, uint64(block.timestamp));
    }

    function _activateConversion() private {
        vm.warp(block.timestamp + 120);
        marketState.refresh();
        rewards.confirmHealthyUntil(uint64(block.timestamp + 1 hours));
        vm.warp(block.timestamp + 60);
        marketState.refresh();
        rewards.activate();
    }

    receive() external payable {}
}
