// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary, PoolId} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {BalanceDelta, toBalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {OmertaSwapRouterV2} from "../../src/market-v2/OmertaSwapRouterV2.sol";
import {OmertaEthStakingV2} from "../../src/market-v2/OmertaEthStakingV2.sol";
import {OmertaEthRewardsV2} from "../../src/market-v2/OmertaEthRewardsV2.sol";

contract EthRewardsMarketMock is IOmertaMarketStateV2 {
    Snapshot private _s;
    address public source;
    function setSource(address source_) external { source = source_; }
    function set(bool valid, uint64 at, uint16 stress) external {
        _s = Snapshot(1, at, 0, 0, 1e18, 1000 ether, stress, 0, valid);
    }
    function setPrice(uint256 price) external { _s.omrPerEth = price; }
    function snapshot() external view returns (Snapshot memory) { return _s; }
}

contract EthRewardsHookMock {
    address public immutable poolManager;
    address public immutable omr;
    address public rewardsRecipient;
    bool public constant managerCollectsRevenue = true;
    PoolKey private _key;
    constructor(address manager_, address token_) {
        poolManager = manager_; omr = token_;
        _key = PoolKey(Currency.wrap(address(0)), Currency.wrap(token_), 3000, 60, IHooks(address(this)));
    }
    function poolKey() external view returns (PoolKey memory) { return _key; }
    function setPoolKey(PoolKey memory key_) external { _key = key_; }
    function setRecipient(address recipient) external { rewardsRecipient = recipient; }
}

/// @dev Production restricted token and canonical router settle through this bounded fixture.
contract EthRewardsManagerMock {
    using PoolIdLibrary for PoolKey;
    uint16 public constant TRADE_FEE_BPS = 400;
    address public immutable omr;
    address public rewardsRecipient;
    bytes32 public settlementPoolId;
    bool public settlementPoolConfigured;
    uint256 public nativeTax;
    uint256 public omrTax;
    uint256 public outputBps = 10_000;
    bool public lie;
    bool public reenter;
    bool public reentryRejected;
    uint256 private _nativeOutput;
    uint256 private _syncedOmrBalance;
    constructor(address token) { omr = token; }
    function revenuePolicyId() external pure returns (bytes32) {
        return keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_ETH_STAKERS_BOTH_DIRECTIONS");
    }
    function configure(address recipient, PoolKey memory key) external {
        rewardsRecipient = recipient; settlementPoolId = PoolId.unwrap(key.toId()); settlementPoolConfigured = true;
    }
    function setTax(uint256 nativeAmount, uint256 omrAmount) external { nativeTax = nativeAmount; omrTax = omrAmount; }
    function setMode(uint256 bps, bool lie_, bool reenter_) external { outputBps = bps; lie = lie_; reenter = reenter_; }
    function sweep(Currency currency, uint8 bucket) external returns (uint256 amount) {
        require(bucket == 4);
        if (reenter) {
            (bool ok,) = rewardsRecipient.call(abi.encodeCall(OmertaEthRewardsV2.collectTax, ()));
            reentryRejected = !ok;
        }
        if (Currency.unwrap(currency) == address(0)) {
            amount = nativeTax; nativeTax = 0;
            (bool ok,) = rewardsRecipient.call{value: amount}(""); require(ok);
        } else {
            require(Currency.unwrap(currency) == omr); amount = omrTax; omrTax = 0;
            IERC20(omr).transfer(rewardsRecipient, amount);
        }
        if (lie) ++amount;
    }
    function unlock(bytes calldata data) external returns (bytes memory) { return IUnlockCallback(msg.sender).unlockCallback(data); }
    function swap(PoolKey calldata key, SwapParams calldata p, bytes calldata) external returns (BalanceDelta) {
        require(PoolId.unwrap(key.toId()) == settlementPoolId && !p.zeroForOne && p.amountSpecified < 0);
        uint256 amount = uint256(-p.amountSpecified); _nativeOutput = amount / 1000 * outputBps / 10_000;
        return toBalanceDelta(int128(int256(_nativeOutput)), -int128(int256(amount)));
    }
    function sync(Currency currency) external {
        require(Currency.unwrap(currency) == omr);
        _syncedOmrBalance = IERC20(omr).balanceOf(address(this));
    }
    function settle() external payable returns (uint256) {
        return IERC20(omr).balanceOf(address(this)) - _syncedOmrBalance;
    }
    function take(Currency currency, address to, uint256 amount) external {
        require(Currency.unwrap(currency) == address(0) && amount == _nativeOutput);
        (bool ok,) = to.call{value: amount}(""); require(ok);
    }
    receive() external payable {}
}

contract EthRewardsV2Test is Test {
    address private constant ALICE = address(0xA11CE);
    address private constant KEEPER = address(0xCAFE);
    OmertaRestrictedOMRV2 private omr;
    EthRewardsManagerMock private manager;
    OmertaSwapRouterV2 private canonical;
    EthRewardsMarketMock private market;
    EthRewardsHookMock private hook;
    OmertaEthStakingV2 private vault;
    OmertaEthRewardsV2 private rewards;
    PoolKey private key;

    function setUp() public {
        vm.warp(10 days); vm.deal(address(this), 20 ether);
        omr = new OmertaRestrictedOMRV2(address(this));
        manager = new EthRewardsManagerMock(address(omr));
        canonical = new OmertaSwapRouterV2(IPoolManager(address(manager)), omr);
        market = new EthRewardsMarketMock(); market.set(true, uint64(block.timestamp), 0);
        hook = new EthRewardsHookMock(address(manager), address(omr)); market.setSource(address(hook));
        vault = new OmertaEthStakingV2(omr, address(this));
        key = hook.poolKey();
        rewards = new OmertaEthRewardsV2(omr, address(this), KEEPER, address(vault), address(manager), canonical, market, key, _policy());
        manager.configure(address(rewards), key); vault.setDistributor(address(rewards), address(rewards).codehash);
        hook.setRecipient(address(rewards));
        omr.setOperator(address(this), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(this).codehash);
        omr.setOperator(address(canonical), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput, address(canonical).codehash);
        omr.setOperator(address(vault), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody, address(vault).codehash);
        omr.setContractHolder(address(rewards), address(rewards).codehash);
        omr.bindSettlementManager(address(manager), address(manager).codehash); omr.sealPolicy(); vault.activate();
        vm.prank(ALICE, ALICE); omr.registerWallet(ALICE);
        omr.transfer(ALICE, 1000 ether); vm.prank(ALICE); omr.approve(address(vault), type(uint256).max);
        vm.deal(address(manager), 10 ether);
    }

    function _policy() private pure returns (OmertaEthRewardsV2.Policy memory) {
        return OmertaEthRewardsV2.Policy(100 ether, 200 ether, 0.1 ether, 0.2 ether, 500, 1000, 1 hours, 10 minutes, 1 hours, 10 minutes);
    }
    function _activate() private {
        rewards.confirmHealthyUntil(uint64(vm.getBlockTimestamp() + 1 hours)); vm.warp(vm.getBlockTimestamp() + 10 minutes);
        market.set(true, uint64(vm.getBlockTimestamp()), 0); rewards.activate();
    }
    function _supplyOmr(uint256 amount) private { omr.transfer(address(rewards), amount); }
    function _collect(uint256 ethAmount, uint256 omrAmount) private {
        if (omrAmount != 0) omr.transfer(address(manager), omrAmount);
        manager.setTax(ethAmount, omrAmount); rewards.collectTax();
    }

    function testStartsInactivePausedWithOnlyNativeMarketDependencies() public {
        assertFalse(rewards.active()); assertTrue(rewards.paused()); assertFalse(rewards.healthReady());
        assertEq(rewards.rewardVault(), address(vault)); assertEq(rewards.manager(), address(manager));
        assertEq(rewards.canonicalPoolId(), PoolId.unwrap(key.toId())); assertLe(address(rewards).code.length, 24_576);
        vm.expectRevert(OmertaEthRewardsV2.HealthUnavailable.selector); rewards.activate();
        vm.expectRevert(Pausable.EnforcedPause.selector); rewards.convertOmr(1 ether, 1, uint64(block.timestamp));
    }

    function testPermissionlessCollectionOnlyUsesExtraAllocationBucket() public {
        omr.transfer(address(manager), 3 ether); manager.setTax(0.1 ether, 3 ether);
        vm.prank(ALICE); rewards.collectTax();
        assertEq(rewards.totalNativeCollected(), 0.1 ether); assertEq(rewards.totalOmrCollected(), 3 ether);
        assertEq(address(rewards).balance, 0.1 ether); assertEq(omr.balanceOf(address(rewards)), 3 ether);
        assertEq(rewards.totalEthFunded(), 0); assertEq(vault.totalEthFunded(), 0);
    }

    function testNativeTaxFundsAndPaysStakerWhileConversionIsInactivePausedAndUnhealthy() public {
        vm.prank(ALICE); vault.stake(100 ether); _collect(0.1 ether, 0);
        market.set(false, 0, type(uint16).max); vault.setPaused(true);
        vm.prank(ALICE); rewards.fundRewards(0.1 ether);
        assertFalse(rewards.active()); assertTrue(rewards.paused()); assertFalse(rewards.healthReady());
        assertEq(vault.totalEthFunded(), 0.1 ether); assertEq(rewards.totalEthFunded(), 0.1 ether);
        assertEq(rewards.nativeFundedOnDay(block.timestamp / 1 days), 0.1 ether);
        vm.warp(vault.lockPosition(ALICE, 0).unlocksAt); vault.finalizeEpoch(0);
        uint64[] memory ids = new uint64[](1); vm.prank(ALICE); vault.claim(ids, ALICE);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        assertEq(ALICE.balance, 0.1 ether); assertEq(omr.balanceOf(ALICE), 1000 ether);
        assertEq(vault.totalEthClaimed(), 0.1 ether); assertEq(address(vault).balance, 0);
    }

    function testFundingIgnoresUnavailableConversionMarketRouterAndHookCodeButRetainsFundingPins() public {
        _collect(0.1 ether, 0); vm.etch(address(canonical), hex"00"); vm.etch(address(market), hex"00");
        vm.etch(address(hook), hex"00");
        rewards.fundRewards(0.1 ether); assertEq(vault.totalEthFunded(), 0.1 ether);
        vm.etch(address(manager), hex"00");
        vm.expectRevert(OmertaEthRewardsV2.RuntimeChanged.selector); rewards.fundRewards(1);
    }

    function testFundingCapsAndFailedTransferNeverConsumeCapacity() public {
        uint256 day = block.timestamp / 1 days;
        vm.expectRevert(); rewards.fundRewards(0.1 ether);
        assertEq(rewards.nativeFundedOnDay(day), 0);
        _collect(0.3 ether, 0);
        vm.expectRevert(OmertaEthRewardsV2.CapExceeded.selector); rewards.fundRewards(0);
        vm.expectRevert(OmertaEthRewardsV2.CapExceeded.selector); rewards.fundRewards(0.1 ether + 1);
        rewards.fundRewards(0.1 ether); rewards.fundRewards(0.1 ether);
        vm.expectRevert(OmertaEthRewardsV2.CapExceeded.selector); rewards.fundRewards(1);
        assertEq(rewards.nativeFundedOnDay(day), 0.2 ether); assertEq(vault.totalEthFunded(), 0.2 ether);
        vm.warp(block.timestamp + 1 days); rewards.fundRewards(0.1 ether);
        assertEq(vault.totalEthFunded(), 0.3 ether);
    }

    function testOnlyFixedNativeSourcesAndSafeConversionAuthorities() public {
        vm.deal(ALICE, 1 ether); vm.prank(ALICE); (bool accepted,) = address(rewards).call{value: 1 wei}(""); assertFalse(accepted);
        vm.prank(ALICE); vm.expectRevert(OmertaEthRewardsV2.Unauthorized.selector); rewards.confirmHealthyUntil(uint64(block.timestamp + 1 hours));
        vm.prank(KEEPER); vm.expectRevert(OmertaEthRewardsV2.Unauthorized.selector); rewards.activate();
        vm.prank(ALICE); vm.expectRevert(OmertaEthRewardsV2.Unauthorized.selector); rewards.setKeeper(ALICE);
        vm.expectRevert(OmertaEthRewardsV2.InvalidConfiguration.selector); rewards.setKeeper(address(0));
        rewards.setKeeper(ALICE); assertEq(rewards.keeper(), ALICE);
    }

    function testConversionUsesRealCanonicalRouterAndLeavesNoApproval() public {
        _activate(); _supplyOmr(100 ether);
        uint256 minimum = rewards.minimumNativeFor(100 ether);
        vm.prank(KEEPER); uint256 received = rewards.convertOmr(100 ether, minimum, uint64(block.timestamp + 1));
        assertEq(received, 0.1 ether); assertEq(address(rewards).balance, 0.1 ether);
        assertEq(omr.allowance(address(rewards), address(canonical)), 0); assertEq(omr.balanceOf(address(rewards)), 0);
        assertEq(rewards.omrConvertedOnDay(block.timestamp / 1 days), 100 ether);
        rewards.fundRewards(0.1 ether); assertEq(vault.totalEthFunded(), 0.1 ether);
    }

    function testConversionFloorIncludesProtocolAndLpFeesBeforeSlippage() public {
        _activate(); _supplyOmr(100 ether); manager.setMode(9200, false, false);
        uint256 expected = uint256(0.1 ether) * 997000 / 1_000_000 * 9550 / 10_000 * 9500 / 10_000;
        assertEq(rewards.minimumNativeFor(100 ether), expected);
        assertGt(expected, 0.09 ether); assertLt(expected, 0.092 ether);
        rewards.convertOmr(100 ether, expected, uint64(block.timestamp));
        assertEq(address(rewards).balance, 0.092 ether); assertEq(omr.allowance(address(rewards), address(canonical)), 0);
    }

    function testConversionSlippageDeadlineAndCapsFailWithoutSpending() public {
        _activate(); _supplyOmr(300 ether); uint64 deadline = uint64(block.timestamp + 1);
        uint256 minimum = rewards.minimumNativeFor(100 ether);
        vm.expectRevert(OmertaEthRewardsV2.OutputBelowMinimum.selector); rewards.convertOmr(100 ether, minimum - 1, deadline);
        vm.expectRevert(OmertaEthRewardsV2.InvalidDeadline.selector); rewards.convertOmr(100 ether, minimum, uint64(block.timestamp - 1));
        vm.expectRevert(OmertaEthRewardsV2.InvalidDeadline.selector); rewards.convertOmr(100 ether, minimum, uint64(block.timestamp + 601));
        vm.expectRevert(OmertaEthRewardsV2.CapExceeded.selector); rewards.convertOmr(101 ether, minimum, deadline);
        rewards.convertOmr(100 ether, minimum, deadline); rewards.convertOmr(100 ether, minimum, deadline);
        vm.expectRevert(OmertaEthRewardsV2.CapExceeded.selector); rewards.convertOmr(1 ether, 1, deadline);
        assertEq(omr.balanceOf(address(rewards)), 100 ether); assertEq(rewards.omrConvertedOnDay(block.timestamp / 1 days), 200 ether);
    }

    function testUnhealthyMarketRuntimeAndPoolBindingPreventConversion() public {
        _activate(); _supplyOmr(100 ether); uint64 deadline = uint64(block.timestamp + 1);
        market.set(false, uint64(block.timestamp), 0);
        vm.expectRevert(OmertaEthRewardsV2.MarketUnavailable.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        market.set(true, uint64(block.timestamp + 1), 0);
        vm.expectRevert(OmertaEthRewardsV2.MarketUnavailable.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        market.set(true, uint64(block.timestamp), 1001);
        vm.expectRevert(OmertaEthRewardsV2.MarketUnavailable.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        market.set(true, uint64(block.timestamp), 0); market.setPrice(0);
        vm.expectRevert(OmertaEthRewardsV2.MarketUnavailable.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        market.set(true, uint64(block.timestamp), 0);
        PoolKey memory wrong = key; wrong.fee = 500; hook.setPoolKey(wrong);
        vm.expectRevert(OmertaEthRewardsV2.InvalidConfiguration.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        hook.setPoolKey(key); vm.etch(address(canonical), hex"00");
        vm.expectRevert(OmertaEthRewardsV2.RuntimeChanged.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        assertEq(rewards.omrConvertedOnDay(block.timestamp / 1 days), 0); assertEq(omr.balanceOf(address(rewards)), 100 ether);
    }

    function testHealthLeaseRecoveryRenewalExpiryAndRevocation() public {
        rewards.confirmHealthyUntil(uint64(vm.getBlockTimestamp() + 1 hours)); uint64 since = rewards.healthySince();
        vm.expectRevert(OmertaEthRewardsV2.HealthUnavailable.selector); rewards.activate();
        vm.warp(vm.getBlockTimestamp() + 10 minutes); market.set(true, uint64(vm.getBlockTimestamp()), 0); rewards.activate();
        rewards.confirmHealthyUntil(uint64(vm.getBlockTimestamp() + 1 hours)); assertEq(rewards.healthySince(), since);
        vm.warp(vm.getBlockTimestamp() + 1 hours); assertFalse(rewards.healthReady());
        rewards.confirmHealthyUntil(uint64(vm.getBlockTimestamp() + 1 hours)); assertEq(rewards.healthySince(), vm.getBlockTimestamp());
        rewards.pause(); vm.expectRevert(OmertaEthRewardsV2.HealthUnavailable.selector); rewards.unpause();
        vm.warp(vm.getBlockTimestamp() + 10 minutes); market.set(true, uint64(vm.getBlockTimestamp()), 0); rewards.unpause();
        vm.prank(KEEPER); rewards.revokeHealth(); assertFalse(rewards.healthReady());
        _collect(0.1 ether, 0); rewards.fundRewards(0.1 ether); assertEq(vault.totalEthFunded(), 0.1 ether);
    }

    function testHookAndMarketSourceDriftBlockConversionWithoutBlockingNativeFunding() public {
        _activate(); _supplyOmr(100 ether); uint64 deadline = uint64(block.timestamp + 1);
        market.setSource(ALICE);
        vm.expectRevert(OmertaEthRewardsV2.InvalidConfiguration.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        _collect(0.1 ether, 0); rewards.fundRewards(0.1 ether);
        assertEq(vault.totalEthFunded(), 0.1 ether);
        market.setSource(address(hook)); hook.setRecipient(ALICE);
        vm.expectRevert(OmertaEthRewardsV2.NotReady.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        hook.setRecipient(address(rewards)); vm.etch(address(hook), hex"00");
        vm.expectRevert(OmertaEthRewardsV2.RuntimeChanged.selector); rewards.convertOmr(100 ether, 0.09 ether, deadline);
        assertEq(rewards.omrConvertedOnDay(block.timestamp / 1 days), 0);
        assertEq(omr.balanceOf(address(rewards)), 100 ether);
    }

    function testPausedConversionDoesNotGatePrincipalOrAlreadyEarnedEth() public {
        _activate(); vm.prank(ALICE); vault.stake(100 ether); _collect(0.1 ether, 0); rewards.fundRewards(0.1 ether);
        vm.prank(KEEPER); rewards.pause(); rewards.revokeHealth(); vault.setPaused(true);
        vm.warp(vault.lockPosition(ALICE, 0).unlocksAt); vault.finalizeEpoch(0);
        uint64[] memory ids = new uint64[](1); vm.prank(ALICE); vault.claim(ids, ALICE);
        vm.prank(ALICE); vault.withdraw(0, 100 ether, ALICE);
        assertEq(ALICE.balance, 0.1 ether); assertEq(omr.balanceOf(ALICE), 1000 ether);
    }

    function testTaxManagerCallbackAndReportedDeltaLieCannotStealOrInflateAccounting() public {
        manager.setMode(10_000, false, true); _collect(0.1 ether, 0);
        assertTrue(manager.reentryRejected()); assertEq(rewards.totalNativeCollected(), 0.1 ether);
        manager.setTax(0.1 ether, 0); manager.setMode(10_000, true, false);
        vm.expectRevert(OmertaEthRewardsV2.SettlementMismatch.selector); rewards.collectTax();
        assertEq(rewards.totalNativeCollected(), 0.1 ether); assertEq(manager.nativeTax(), 0.1 ether);
    }

    function testRecipientStorageDriftBlocksCollectionAndFunding() public {
        manager.configure(ALICE, key);
        vm.expectRevert(OmertaEthRewardsV2.NotReady.selector); rewards.collectTax();
        vm.expectRevert(OmertaEthRewardsV2.NotReady.selector); rewards.fundRewards(1);
    }

    function testFuzzConversionAndFundingConserve(uint96 raw) public {
        uint256 amount = bound(raw, 1 ether, 100 ether); _activate(); _supplyOmr(amount);
        uint256 received = rewards.convertOmr(amount, rewards.minimumNativeFor(amount), uint64(block.timestamp));
        rewards.fundRewards(received);
        assertEq(vault.totalEthFunded(), received); assertEq(address(vault).balance, received);
        assertEq(address(rewards).balance, 0); assertEq(omr.allowance(address(rewards), address(canonical)), 0);
        assertEq(rewards.totalEthFunded(), vault.totalEthFunded());
    }
    receive() external payable {}
}
