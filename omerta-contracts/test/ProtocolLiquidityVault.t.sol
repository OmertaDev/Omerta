// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {PositionManager} from "../lib/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "../lib/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "../lib/v4-periphery/src/interfaces/external/IWETH9.sol";
import {Actions} from "../lib/v4-periphery/src/libraries/Actions.sol";
import {LiquidityAmounts} from "../lib/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {OMR} from "../src/OMR.sol";
import {OmertaHook} from "../src/OmertaHook.sol";
import {LiquidityBuybackExecutor} from "../src/LiquidityBuybackExecutor.sol";
import {ILiquidityHealth} from "../src/interfaces/ILiquidityHealth.sol";
import {IOmrOracle} from "../src/IOmrOracle.sol";
import {ProtocolLiquidityVault, IProtocolPositionManager} from "../src/ProtocolLiquidityVault.sol";

/// The AMM and NFT/allowance custody run against the real pinned upstream code.
/// This explicit oracle fixture drives stale/future/deviation failure boundaries;
/// its observations do not claim to demonstrate a production TWAP.
contract PolOracleFixture is IOmrOracle {
    uint256 public price;
    uint256 public observedAt;
    bool public unavailable;

    function set(uint256 nextPrice, uint256 nextTimestamp) external {
        price = nextPrice;
        observedAt = nextTimestamp;
    }

    function setUnavailable(bool next) external { unavailable = next; }

    function consult() external view returns (uint256, uint256) {
        require(!unavailable, "fixture unavailable");
        return (price, observedAt);
    }
}

/// Exercises the fixed deposit integration independently of swap implementation.
/// Actual inventory swaps have their own BuybackExecutor real-AMM suite.
contract PolInventoryFixture {
    address public immutable omr;
    address public immutable poolManager;
    bytes32 public immutable poolId;
    address public immutable destination;
    uint256 public deposited;
    bool public reject;
    uint8 public constant stream = 3;
    address public constant secondaryRecipient = address(0);

    constructor(address token, address manager, bytes32 id, address to) {
        omr = token;
        poolManager = manager;
        poolId = id;
        destination = to;
    }

    function setReject(bool next) external { reject = next; }
    function oracle() external view returns (address) {
        return address(ProtocolLiquidityVault(payable(destination)).oracle());
    }
    function healthGuard() external view returns (address) { return destination; }
    function deposit() external payable {
        require(!reject, "fixture deposit unavailable");
        deposited += msg.value;
    }
}

contract PolRejectNative {
    receive() external payable { revert("reject native"); }
}

contract PolFeeCallback {
    ProtocolLiquidityVault public vault;
    bool public sawUnhealthy;
    bool public reentryRejected;

    function set(ProtocolLiquidityVault target) external { vault = target; }

    receive() external payable {
        sawUnhealthy = !vault.healthy();
        (bool success, bytes memory result) = address(vault).call(
            abi.encodeCall(vault.collectFees, (block.timestamp))
        );
        reentryRejected = !success && bytes4(result) == ReentrancyGuard.ReentrancyGuardReentrantCall.selector;
    }
}

contract PolEmergencySafe is IERC721Receiver {
    ProtocolLiquidityVault public vault;
    bool public unhealthyAtNftReceipt;
    bool public unhealthyAtNativeReceipt;
    function set(ProtocolLiquidityVault target) external { vault = target; }
    function onERC721Received(address, address, uint256, bytes calldata) external returns (bytes4) {
        unhealthyAtNftReceipt = !vault.healthy() && vault.emergencyLatched();
        return IERC721Receiver.onERC721Received.selector;
    }
    receive() external payable { unhealthyAtNativeReceipt = !vault.healthy() && vault.emergencyLatched(); }
}

/// Isolates the vault's controller authority, including rollback of the caller's
/// state. GenesisLifecycleController's auction/migration gates have their own
/// suite; this fixture deliberately does not pretend to reproduce those gates.
contract PolGenesisFixture {
    address public immutable foundation;
    address public immutable omr;
    bytes32 public immutable poolId;
    uint256 public attempts;
    constructor(address target, address token, bytes32 id) {
        foundation = target; omr = token; poolId = id;
    }
    function adopt(uint256 id) external {
        ++attempts;
        ProtocolLiquidityVault(payable(foundation)).adoptGenesisFoundation(id);
    }
}

abstract contract ProtocolLiquidityVaultFixture is Test, DeployPermit2 {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;

    OMR internal omr;
    IPoolManager internal manager;
    PositionManager internal positionManager;
    IAllowanceTransfer internal permit;
    PoolSwapTest internal swapRouter;
    PolOracleFixture internal oracle;
    ProtocolLiquidityVault internal vault;
    PoolKey internal key;
    address internal safe = makeAddr("POL safe");
    address internal keeper = makeAddr("POL keeper");
    address payable internal desk = payable(makeAddr("POL desk"));
    address payable internal vig = payable(makeAddr("POL vig"));
    address internal stranger = makeAddr("POL stranger");
    uint128 internal constant SEED = 10 ether;

    function setUp() public virtual {
        vm.warp(1_700_000_000);
        vm.deal(address(this), 10_000 ether);
        // PoolManager is built under the repository's normal 0.8.26 non-IR
        // profile. Deploying its real artifact avoids a known 0.8.26 IR compiler
        // failure in upstream Pool.swap while the periphery uses its IR build.
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        omr = new OMR(safe);
        permit = IAllowanceTransfer(deployPermit2());
        // Neither metadata nor WETH wrapping is exercised by native-ETH actions.
        positionManager = new PositionManager(
            IPoolManager(address(manager)), permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0))
        );
        swapRouter = new PoolSwapTest(IPoolManager(address(manager)));
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3000, 60, IHooks(address(0)));
        manager.initialize(key, uint160(1 << 96));
        oracle = new PolOracleFixture();
        oracle.set(1 ether, block.timestamp);
        vault = new ProtocolLiquidityVault(_config(desk));
        _fund(vault);
        vm.prank(safe);
        omr.transfer(address(this), 10_000 ether);
        omr.approve(address(swapRouter), type(uint256).max);
        omr.approve(address(permit), type(uint256).max);
        permit.approve(address(omr), address(positionManager), type(uint160).max, type(uint48).max);
    }

    receive() external payable {}

    function _config(address payable recipient) internal view returns (ProtocolLiquidityVault.Config memory c) {
        c.safe = safe;
        c.keeper = keeper;
        c.positionManager = IProtocolPositionManager(address(positionManager));
        c.permit2 = permit;
        c.oracle = oracle;
        c.key = key;
        c.deskRecipient = recipient;
        c.vigRecipient = vig;
        c.minLiquidity = 1 ether;
        c.warmup = 40 minutes;
        c.maxOracleAge = 10 minutes;
        c.maxDeviationBps = 500;
        c.budgetWindow = 1 days;
        c.maxNativePerAction = 20 ether;
        c.maxNativePerWindow = 40 ether;
        c.maxOmrPerAction = 20 ether;
        c.maxOmrPerWindow = 40 ether;
    }

    function _fund(ProtocolLiquidityVault target) internal {
        vm.deal(address(target), 1_000 ether);
        vm.prank(safe);
        omr.transfer(address(target), 1_000 ether);
    }

    function _seed(ProtocolLiquidityVault target) internal returns (uint256 id, uint128 liquidity) {
        vm.prank(safe);
        (id, liquidity,,) = target.mintFoundation(SEED, SEED, SEED, block.timestamp);
    }

    function _ready() internal returns (uint256 id, uint128 liquidity) {
        (id, liquidity) = _seed(vault);
        vm.warp(block.timestamp + vault.warmup());
        oracle.set(1 ether, block.timestamp);
        assertTrue(vault.healthy());
    }

    function _swaps() internal {
        swapRouter.swap{value: 0.1 ether}(
            key, SwapParams(true, -int256(0.1 ether), TickMath.MIN_SQRT_PRICE + 1),
            PoolSwapTest.TestSettings(false, false), bytes("")
        );
        swapRouter.swap(
            key, SwapParams(false, -int256(0.1 ether), TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), bytes("")
        );
    }

    function _directMint(address recipient, PoolKey memory pool, int24 lower, int24 upper, uint128 liquidity)
        internal returns (uint256 id)
    {
        id = positionManager.nextTokenId();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(pool, lower, upper, uint256(liquidity), uint128(20 ether), uint128(20 ether), recipient, bytes(""));
        params[1] = abi.encode(pool.currency0, pool.currency1);
        params[2] = abi.encode(pool.currency0, address(this));
        positionManager.modifyLiquidities{value: 20 ether}(
            abi.encode(abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP)), params),
            block.timestamp
        );
    }

    function _bind() internal returns (PolInventoryFixture executor) {
        executor = new PolInventoryFixture(address(omr), address(manager), vault.poolId(), address(vault));
        vm.prank(safe);
        vault.setInventoryExecutor(address(executor));
    }
}

contract ProtocolLiquidityVaultTest is ProtocolLiquidityVaultFixture {
    function test_foundation_mints_real_fullrange_position_and_waits_entire_warmup() public {
        assertFalse(vault.healthy());
        (uint256 id, uint128 liquidity) = _seed(vault);
        assertEq(positionManager.ownerOf(id), address(vault));
        assertEq(vault.currentLiquidity(), liquidity);
        assertGe(liquidity, SEED);
        assertFalse(vault.healthy());
        vm.warp(block.timestamp + vault.warmup() - 1);
        assertFalse(vault.healthy());
        vm.warp(block.timestamp + 1);
        assertTrue(vault.healthy());
        assertEq(vault.totalNativeAdded(), SEED);
        assertEq(vault.totalOmrAdded(), SEED);
        assertEq(omr.allowance(address(vault), address(permit)), 0);
        (uint160 allowance,,) = permit.allowance(address(vault), address(omr), address(positionManager));
        assertEq(allowance, 0);
        assertEq(positionManager.getApproved(id), address(0));
        assertFalse(positionManager.isApprovedForAll(address(vault), keeper));
    }

    function test_foundation_only_owner_and_once() public {
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.mintFoundation(SEED, SEED, SEED, block.timestamp);
        _seed(vault);
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.FoundationAlreadySet.selector);
        vault.mintFoundation(SEED, SEED, SEED, block.timestamp);
    }

    function test_increase_cannot_run_before_warmup_or_by_untrusted_caller() public {
        _seed(vault);
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.NotHealthy.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp);
        vm.prank(stranger);
        vm.expectRevert(ProtocolLiquidityVault.NotKeeper.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp);
    }

    function test_increase_uses_actual_refunds_and_never_restarts_custody_warmup() public {
        (uint256 id, uint128 original) = _ready();
        uint256 activated = vault.activationTimestamp();
        uint256 nativeBefore = address(vault).balance;
        uint256 omrBefore = omr.balanceOf(address(vault));
        vm.prank(keeper);
        (uint128 added, uint256 nativeUsed, uint256 omrUsed) = vault.increase(10 ether, 5 ether, 5 ether, block.timestamp);
        assertEq(nativeUsed, 5 ether);
        assertEq(omrUsed, 5 ether);
        assertEq(address(vault).balance, nativeBefore - nativeUsed);
        assertEq(omr.balanceOf(address(vault)), omrBefore - omrUsed);
        assertEq(positionManager.getPositionLiquidity(id), original + added);
        assertEq(vault.activationTimestamp(), activated);
        assertTrue(vault.healthy());
        assertEq(vault.totalNativeAdded(), 15 ether);
        assertEq(vault.totalOmrAdded(), 15 ether);
        assertEq(address(positionManager).balance, 0);
        assertEq(omr.allowance(address(vault), address(permit)), 0);
        (uint160 allowance,,) = permit.allowance(address(vault), address(omr), address(positionManager));
        assertEq(allowance, 0);
    }

    function test_position_manager_native_dust_cannot_offset_accounted_spending() public {
        _ready();
        vm.deal(address(positionManager), 7 ether);
        uint256 beforeNative = address(vault).balance;
        vm.prank(keeper);
        (, uint256 nativeUsed,) = vault.increase(2 ether, 2 ether, 2 ether, block.timestamp);
        assertEq(nativeUsed, 2 ether);
        assertEq(vault.totalNativeAdded(), 12 ether);
        assertEq(address(vault).balance, beforeNative + 5 ether);
        assertEq(address(positionManager).balance, 0);
    }

    function test_real_swap_fees_route_75_25_in_each_currency_without_principal() public {
        (uint256 id, uint128 liquidity) = _ready();
        _swaps();
        (uint256 pendingNative, uint256 pendingOmr) = vault.pendingFees();
        assertGt(pendingNative, 0);
        assertGt(pendingOmr, 0);
        uint256 nativePrincipal = address(vault).balance;
        uint256 omrPrincipal = omr.balanceOf(address(vault));
        vm.prank(stranger);
        (uint256 nativeFees, uint256 omrFees) = vault.collectFees(block.timestamp);
        assertEq(nativeFees, pendingNative);
        assertEq(omrFees, pendingOmr);
        assertEq(desk.balance, nativeFees * 7500 / 10_000);
        assertEq(vig.balance, nativeFees - desk.balance);
        assertEq(omr.balanceOf(desk), omrFees * 7500 / 10_000);
        assertEq(omr.balanceOf(vig), omrFees - omr.balanceOf(desk));
        assertEq(address(vault).balance, nativePrincipal);
        assertEq(omr.balanceOf(address(vault)), omrPrincipal);
        assertEq(positionManager.getPositionLiquidity(id), liquidity);
        assertEq(vault.totalCollectedNative(), nativeFees);
        assertEq(vault.totalCollectedOmr(), omrFees);
        (uint256 againNative, uint256 againOmr) = vault.collectFees(block.timestamp);
        assertEq(againNative, 0);
        assertEq(againOmr, 0);
    }

    function test_increase_routes_preexisting_fees_without_compounding_them() public {
        (uint256 id, uint128 original) = _ready();
        _swaps();
        (uint256 nativeFees, uint256 omrFees) = vault.pendingFees();
        uint256 nativeBefore = address(vault).balance;
        uint256 omrBefore = omr.balanceOf(address(vault));
        vm.prank(keeper);
        (uint128 added, uint256 nativeUsed, uint256 omrUsed) = vault.increase(2 ether, 2 ether, 1 ether, block.timestamp);
        assertEq(vault.totalCollectedNative(), nativeFees);
        assertEq(vault.totalCollectedOmr(), omrFees);
        assertEq(desk.balance + vig.balance, nativeFees);
        assertEq(omr.balanceOf(desk) + omr.balanceOf(vig), omrFees);
        assertEq(address(vault).balance, nativeBefore - nativeUsed);
        assertEq(omr.balanceOf(address(vault)), omrBefore - omrUsed);
        assertEq(positionManager.getPositionLiquidity(id), original + added);
    }

    function test_donated_vault_assets_are_not_collected_as_fees() public {
        _ready();
        vm.deal(address(vault), address(vault).balance + 19 ether);
        omr.transfer(address(vault), 23 ether);
        uint256 beforeNative = address(vault).balance;
        uint256 beforeOmr = omr.balanceOf(address(vault));
        (uint256 nativeFees, uint256 omrFees) = vault.collectFees(block.timestamp);
        assertEq(nativeFees, 0);
        assertEq(omrFees, 0);
        assertEq(address(vault).balance, beforeNative);
        assertEq(omr.balanceOf(address(vault)), beforeOmr);
        assertEq(desk.balance + vig.balance, 0);
    }

    function test_fee_callback_observes_unhealthy_and_cannot_reenter() public {
        PolFeeCallback callback = new PolFeeCallback();
        vault = new ProtocolLiquidityVault(_config(payable(address(callback))));
        callback.set(vault);
        _fund(vault);
        _ready();
        _swaps();
        vault.collectFees(block.timestamp);
        assertTrue(callback.sawUnhealthy());
        assertTrue(callback.reentryRejected());
        assertTrue(vault.healthy());
    }

    function test_rejecting_fee_recipient_reverts_without_losing_fees_or_principal() public {
        vault = new ProtocolLiquidityVault(_config(payable(address(new PolRejectNative()))));
        _fund(vault);
        (uint256 id, uint128 liquidity) = _ready();
        _swaps();
        (uint256 beforeNative, uint256 beforeOmr) = vault.pendingFees();
        vm.expectRevert(ProtocolLiquidityVault.NativeTransferFailed.selector);
        vault.collectFees(block.timestamp);
        (uint256 afterNative, uint256 afterOmr) = vault.pendingFees();
        assertEq(beforeNative, afterNative);
        assertEq(beforeOmr, afterOmr);
        assertEq(positionManager.getPositionLiquidity(id), liquidity);
        assertEq(vault.totalCollectedNative(), 0);
        assertEq(vault.totalCollectedOmr(), 0);
    }

    function test_stale_future_zero_or_reverting_oracle_fails_closed() public {
        _ready();
        oracle.set(1 ether, block.timestamp - vault.maxOracleAge() - 1);
        vm.expectRevert(ProtocolLiquidityVault.OracleUnavailable.selector);
        vault.quoteLiquidity(1 ether, 1 ether);
        oracle.set(1 ether, block.timestamp + 1);
        vm.expectRevert(ProtocolLiquidityVault.OracleUnavailable.selector);
        vault.quoteLiquidity(1 ether, 1 ether);
        oracle.set(0, block.timestamp);
        vm.expectRevert(ProtocolLiquidityVault.OracleUnavailable.selector);
        vault.quoteLiquidity(1 ether, 1 ether);
        oracle.setUnavailable(true);
        vm.expectRevert("fixture unavailable");
        vault.quoteLiquidity(1 ether, 1 ether);
    }

    function test_oracle_spot_deviation_fails_before_spend() public {
        _ready();
        oracle.set(2 ether, block.timestamp);
        uint256 beforeNative = address(vault).balance;
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.PriceDeviation.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp);
        assertEq(address(vault).balance, beforeNative);
        assertEq(vault.totalNativeAdded(), SEED);
    }

    function test_amount_and_deadline_and_inventory_limits_fail_closed() public {
        _ready();
        vm.startPrank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.BadDeadline.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp - 1);
        vm.expectRevert(ProtocolLiquidityVault.BadDeadline.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp + 10 minutes + 1);
        vm.expectRevert(ProtocolLiquidityVault.BadAmounts.selector);
        vault.increase(0, 1 ether, 1 ether, block.timestamp);
        vm.expectRevert(ProtocolLiquidityVault.BadAmounts.selector);
        vault.increase(1 ether, 1 ether, 0, block.timestamp);
        vm.expectRevert(ProtocolLiquidityVault.BadAmounts.selector);
        vault.increase(1 ether, 1 ether, 2 ether, block.timestamp);
        vm.expectRevert(ProtocolLiquidityVault.BudgetExceeded.selector);
        vault.increase(21 ether, 21 ether, 1 ether, block.timestamp);
        vm.deal(address(vault), 0);
        vm.expectRevert(ProtocolLiquidityVault.InsufficientInventory.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp);
        vm.stopPrank();
    }

    function test_inventory_binding_is_once_fixed_to_token_pool_and_destination() public {
        PolInventoryFixture wrong = new PolInventoryFixture(address(omr), address(manager), vault.poolId(), stranger);
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setInventoryExecutor(address(wrong));
        PolInventoryFixture executor = _bind();
        assertEq(vault.inventoryExecutor(), address(executor));
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InventoryExecutorAlreadySet.selector);
        vault.setInventoryExecutor(address(executor));
    }

    function test_inventory_funding_uses_shared_native_cap_and_deposit_only() public {
        _ready();
        PolInventoryFixture executor = _bind();
        uint256 beforeNative = address(vault).balance;
        vm.prank(keeper);
        vault.fundInventory(20 ether);
        assertEq(executor.deposited(), 20 ether);
        assertEq(address(vault).balance, beforeNative - 20 ether);
        assertEq(vault.totalInventoryNativeFunded(), 20 ether);
        (uint256 nativeAvailable, uint256 omrAvailable) = vault.budgetAvailable();
        assertEq(nativeAvailable, 10 ether);
        assertEq(omrAvailable, 20 ether);
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.BudgetExceeded.selector);
        vault.increase(11 ether, 11 ether, 1 ether, block.timestamp);
    }

    function test_failed_deposit_rolls_back_spend_and_native_funding_counter() public {
        _ready();
        PolInventoryFixture executor = _bind();
        executor.setReject(true);
        uint256 beforeNative = address(vault).balance;
        vm.prank(keeper);
        vm.expectRevert("fixture deposit unavailable");
        vault.fundInventory(20 ether);
        assertEq(vault.totalInventoryNativeFunded(), 0);
        assertEq(address(vault).balance, beforeNative);
        executor.setReject(false);
        vm.prank(keeper);
        vault.fundInventory(20 ether);
        assertEq(executor.deposited(), 20 ether);
    }

    function test_trailing_window_does_not_reset_at_calendar_boundary() public {
        _ready();
        _bind();
        uint256 seededAt = vault.activationTimestamp();
        vm.warp(seededAt + 1 days - 1);
        vm.prank(keeper);
        vault.fundInventory(20 ether);
        vm.warp(seededAt + 1 days);
        vm.prank(keeper);
        vault.fundInventory(20 ether);
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.BudgetExceeded.selector);
        vault.fundInventory(1);
        vm.warp(seededAt + 2 days - 1);
        vm.prank(keeper);
        vault.fundInventory(20 ether);
    }

    function test_spend_ring_is_bounded_and_expires() public {
        _ready();
        _bind();
        for (uint256 i; i < 63; ++i) {
            vm.prank(keeper);
            vault.fundInventory(1);
        }
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.ActionWindowFull.selector);
        vault.fundInventory(1);
        vm.warp(vault.activationTimestamp() + 1 days);
        vm.prank(keeper);
        vault.fundInventory(1);
    }

    function test_pause_resume_restarts_warmup_and_rotation_requires_pause() public {
        _ready();
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setKeeper(stranger);
        vm.prank(keeper);
        vault.pauseAutomation();
        assertFalse(vault.healthy());
        assertEq(vault.activationTimestamp(), 0);
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.AutomationPaused.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp);
        vm.startPrank(safe);
        vault.setKeeper(stranger);
        vault.resumeAutomation();
        vm.stopPrank();
        assertFalse(vault.healthy());
        vm.warp(block.timestamp + vault.warmup());
        assertTrue(vault.healthy());
    }

    function test_emergency_latch_is_permanent_and_keeper_cannot_recover() public {
        (uint256 id,) = _ready();
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.EmergencyNotLatched.selector);
        vault.recoverEmergency();
        vm.prank(keeper);
        vault.latchEmergency();
        assertFalse(vault.healthy());
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.recoverEmergency();
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.EmergencyLatched.selector);
        vault.resumeAutomation();
        uint256 beforeNative = address(vault).balance;
        uint256 beforeOmr = omr.balanceOf(address(vault));
        uint256 safeOmr = omr.balanceOf(safe);
        vm.prank(safe);
        vault.recoverEmergency();
        assertEq(positionManager.ownerOf(id), safe);
        assertEq(safe.balance, beforeNative);
        assertEq(omr.balanceOf(safe), safeOmr + beforeOmr);
        assertEq(vault.positionId(), 0);
        assertEq(address(vault).balance, 0);
        assertEq(omr.balanceOf(address(vault)), 0);
        assertFalse(vault.healthy());
    }

    function test_emergency_recipient_remains_original_safe_after_owner_rotation() public {
        (uint256 id,) = _ready();
        vm.prank(safe);
        vault.transferOwnership(stranger);
        vm.prank(stranger);
        vault.acceptOwnership();
        vm.startPrank(stranger);
        vault.latchEmergency();
        vault.recoverEmergency();
        vm.stopPrank();
        assertEq(positionManager.ownerOf(id), safe);
        assertEq(vault.emergencyRecipient(), safe);
    }

    function test_adoption_validates_real_custody_pool_and_range() public {
        uint256 foreign = _directMint(safe, key, vault.tickLower(), vault.tickUpper(), SEED);
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        vault.adoptFoundation(foreign);
        uint256 narrow = _directMint(address(vault), key, -60, 60, SEED);
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        vault.adoptFoundation(narrow);
        PoolKey memory other = key;
        other.fee = 500;
        manager.initialize(other, uint160(1 << 96));
        uint256 wrongPool = _directMint(address(vault), other, vault.tickLower(), vault.tickUpper(), SEED);
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        vault.adoptFoundation(wrongPool);
        uint256 belowFloor = _directMint(address(vault), key, vault.tickLower(), vault.tickUpper(), 1);
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        vault.adoptFoundation(belowFloor);
        uint256 valid = _directMint(address(vault), key, vault.tickLower(), vault.tickUpper(), SEED);
        vm.prank(safe);
        vault.adoptFoundation(valid);
        assertEq(vault.positionId(), valid);
        assertFalse(vault.healthy());
    }

    function test_safe_transfer_receiver_rejects_untrusted_operator_and_accepts_safe() public {
        uint256 id = _directMint(safe, key, vault.tickLower(), vault.tickUpper(), SEED);
        vm.prank(safe);
        positionManager.approve(stranger, id);
        vm.prank(stranger);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        positionManager.safeTransferFrom(safe, address(vault), id);
        vm.prank(safe);
        positionManager.safeTransferFrom(safe, address(vault), id);
        assertEq(vault.positionId(), id);
        assertEq(positionManager.ownerOf(id), address(vault));
        vm.prank(stranger);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        vault.onERC721Received(safe, safe, id, bytes(""));
    }

    function test_keeper_cannot_transfer_or_approve_position() public {
        (uint256 id,) = _ready();
        vm.startPrank(keeper);
        vm.expectRevert();
        positionManager.transferFrom(address(vault), keeper, id);
        vm.expectRevert();
        positionManager.approve(keeper, id);
        vm.stopPrank();
        assertEq(positionManager.ownerOf(id), address(vault));
    }

    function test_runtime_or_chain_change_fails_health_and_live_actions() public {
        _ready();
        uint256 chain = vault.configuredChainId();
        vm.chainId(chain + 1);
        assertFalse(vault.healthy());
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.DependencyChanged.selector);
        vault.increase(1 ether, 1 ether, 1 ether, block.timestamp);
        vm.chainId(chain);
        assertTrue(vault.healthy());
        vm.etch(address(oracle), hex"00");
        assertFalse(vault.healthy());
        vm.expectRevert(ProtocolLiquidityVault.DependencyChanged.selector);
        vault.collectFees(block.timestamp);
    }

    function test_inventory_runtime_change_fails_before_spend() public {
        _ready();
        PolInventoryFixture executor = _bind();
        vm.etch(address(executor), hex"00");
        vm.prank(keeper);
        vm.expectRevert(ProtocolLiquidityVault.DependencyChanged.selector);
        vault.fundInventory(1 ether);
        assertEq(vault.totalInventoryNativeFunded(), 0);
    }

    function test_actual_inventory_executor_buys_into_locked_vault_then_pairs_assets() public {
        (uint256 id, uint128 initial) = _ready();
        LiquidityBuybackExecutor executor = new LiquidityBuybackExecutor(
            safe, manager, key, oracle, ILiquidityHealth(address(vault)), LiquidityBuybackExecutor.Stream.Pol,
            address(vault), address(0), LiquidityBuybackExecutor.Policy(0.05 ether, 0.1 ether, 60, 600, 100)
        );
        vm.startPrank(safe);
        executor.setKeeper(keeper, true);
        vault.setInventoryExecutor(address(executor));
        vm.stopPrank();
        uint256 beforeOmr = omr.balanceOf(address(vault));
        vm.prank(keeper);
        vault.fundInventory(0.05 ether);
        uint256 minimum = executor.quoteFloor(0.05 ether);
        vm.prank(keeper);
        (uint256 spent, uint256 bought) = executor.execute(0.05 ether, minimum, block.timestamp);
        assertEq(spent, 0.05 ether);
        assertEq(omr.balanceOf(address(vault)), beforeOmr + bought);
        assertEq(omr.balanceOf(address(executor)), 0);
        assertEq(address(executor).balance, 0);
        vm.prank(keeper);
        (uint128 added,,) = vault.increase(0.05 ether, uint128(bought), 0.04 ether, block.timestamp);
        assertEq(positionManager.getPositionLiquidity(id), initial + added);
        assertGt(vault.totalCollectedNative(), 0);
        vm.prank(keeper);
        vault.latchEmergency();
        vm.expectRevert(LiquidityBuybackExecutor.Unhealthy.selector);
        executor.quoteFloor(0.01 ether);
    }

    function test_inventory_binding_rejects_split_stream_and_foreign_oracle_or_health_guard() public {
        LiquidityBuybackExecutor.Policy memory policy = LiquidityBuybackExecutor.Policy(1 ether, 2 ether, 60, 600, 100);
        LiquidityBuybackExecutor splitStream = new LiquidityBuybackExecutor(
            safe, manager, key, oracle, ILiquidityHealth(address(vault)), LiquidityBuybackExecutor.Stream.Vig,
            address(vault), stranger, policy
        );
        LiquidityBuybackExecutor foreignOracle = new LiquidityBuybackExecutor(
            safe, manager, key, new PolOracleFixture(), ILiquidityHealth(address(vault)), LiquidityBuybackExecutor.Stream.Pol,
            address(vault), address(0), policy
        );
        LiquidityBuybackExecutor foreignHealth = new LiquidityBuybackExecutor(
            safe, manager, key, oracle, ILiquidityHealth(address(oracle)), LiquidityBuybackExecutor.Stream.Pol,
            address(vault), address(0), policy
        );
        vm.startPrank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setInventoryExecutor(address(splitStream));
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setInventoryExecutor(address(foreignOracle));
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setInventoryExecutor(address(foreignHealth));
        vm.stopPrank();
        assertEq(vault.inventoryExecutor(), address(0));
    }

    function test_original_safe_observes_emergency_latch_before_any_asset_callback() public {
        PolEmergencySafe receiver = new PolEmergencySafe();
        ProtocolLiquidityVault.Config memory c = _config(desk);
        c.safe = address(receiver);
        vault = new ProtocolLiquidityVault(c);
        receiver.set(vault);
        _fund(vault);
        vm.prank(address(receiver));
        vault.mintFoundation(SEED, SEED, SEED, block.timestamp);
        uint256 id = vault.positionId();
        vm.startPrank(address(receiver));
        vault.latchEmergency();
        vault.recoverEmergency();
        vm.stopPrank();
        assertEq(positionManager.ownerOf(id), address(receiver));
        assertTrue(receiver.unhealthyAtNftReceipt());
        assertTrue(receiver.unhealthyAtNativeReceipt());
    }

    function test_hooked_pool_add_and_collect_keep_sell_tax_separate_from_lp_fees() public {
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
                | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        address hookAddress = address(uint160((uint256(0xC0FFEE) << 128) | uint256(flags)));
        deployCodeTo("OmertaHook.sol:OmertaHook", abi.encode(manager, address(omr), safe, address(this)), hookAddress);
        OmertaHook hook = OmertaHook(payable(hookAddress));
        address hookDev = makeAddr("hook dev");
        address hookRwa = makeAddr("hook RWA");
        address hookCommunity = makeAddr("hook community");
        address hookLp = makeAddr("hook LP");
        vm.startPrank(safe);
        hook.setRecipients(hookDev, hookRwa, hookCommunity, hookLp);
        hook.setAllowedQuote(Currency.wrap(address(0)), true);
        hook.setSellTax(900, 200, 400, 0);
        vm.stopPrank();
        key.hooks = IHooks(hookAddress);
        manager.initialize(key, uint160(1 << 96));
        vault = new ProtocolLiquidityVault(_config(desk));
        _fund(vault);
        (uint256 id, uint128 original) = _ready();
        _swaps();
        (uint256 nativeFees, uint256 omrFees) = vault.pendingFees();
        hook.sweep(Currency.wrap(address(0)));
        assertGt(hookDev.balance, 0);
        assertGt(hookRwa.balance, 0);
        assertGt(hookLp.balance, 0);
        assertEq(desk.balance + vig.balance, 0);
        vm.prank(keeper);
        (uint128 added,,) = vault.increase(1 ether, 1 ether, 0.9 ether, block.timestamp);
        assertEq(desk.balance + vig.balance, nativeFees);
        assertEq(omr.balanceOf(desk) + omr.balanceOf(vig), omrFees);
        assertEq(positionManager.getPositionLiquidity(id), original + added);
        assertTrue(vault.healthy());
    }

    function test_liquidity_callback_hook_is_rejected_at_configuration() public {
        ProtocolLiquidityVault.Config memory c = _config(desk);
        c.key.hooks = IHooks(address(uint160(Hooks.BEFORE_ADD_LIQUIDITY_FLAG)));
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        new ProtocolLiquidityVault(c);
    }

    function test_zero_address_native_donation_cannot_change_zero_hook_health() public {
        _ready();
        vm.deal(address(0), 1);
        assertTrue(vault.healthy());
    }

    function test_genesis_binding_requires_owner_and_exact_vault_token_pool_and_is_once() public {
        PolGenesisFixture controller = new PolGenesisFixture(address(vault), address(omr), vault.poolId());
        vm.prank(keeper);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, keeper));
        vault.setGenesisController(address(controller));
        PolGenesisFixture wrongVault = new PolGenesisFixture(stranger, address(omr), vault.poolId());
        PolGenesisFixture wrongToken = new PolGenesisFixture(address(vault), stranger, vault.poolId());
        PolGenesisFixture wrongPool = new PolGenesisFixture(address(vault), address(omr), bytes32(uint256(1)));
        vm.startPrank(safe);
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setGenesisController(stranger);
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setGenesisController(address(wrongVault));
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setGenesisController(address(wrongToken));
        vm.expectRevert(ProtocolLiquidityVault.InvalidConfiguration.selector);
        vault.setGenesisController(address(wrongPool));
        vault.setGenesisController(address(controller));
        vm.expectRevert(ProtocolLiquidityVault.GenesisControllerAlreadySet.selector);
        vault.setGenesisController(address(controller));
        vm.stopPrank();
        assertEq(vault.genesisController(), address(controller));
        assertEq(vault.genesisControllerCodeHash(), address(controller).codehash);
    }

    function test_genesis_adoption_validates_custody_and_rolls_back_both_contracts_on_failure() public {
        PolGenesisFixture controller = new PolGenesisFixture(address(vault), address(omr), vault.poolId());
        vm.prank(safe);
        vault.setGenesisController(address(controller));
        uint256 foreign = _directMint(safe, key, vault.tickLower(), vault.tickUpper(), SEED);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        controller.adopt(foreign);
        assertEq(controller.attempts(), 0);
        assertEq(vault.positionId(), 0);
        assertEq(vault.activationTimestamp(), 0);
        uint256 narrow = _directMint(address(vault), key, -60, 60, SEED);
        vm.expectRevert(ProtocolLiquidityVault.InvalidFoundation.selector);
        controller.adopt(narrow);
        assertEq(controller.attempts(), 0);
        uint256 valid = _directMint(address(vault), key, vault.tickLower(), vault.tickUpper(), SEED);
        vm.prank(stranger);
        vm.expectRevert(ProtocolLiquidityVault.NotGenesisController.selector);
        vault.adoptGenesisFoundation(valid);
        controller.adopt(valid);
        assertEq(controller.attempts(), 1);
        assertEq(vault.positionId(), valid);
        assertFalse(vault.healthy());
        vm.warp(block.timestamp + vault.warmup());
        assertTrue(vault.healthy());
        vm.expectRevert(ProtocolLiquidityVault.FoundationAlreadySet.selector);
        controller.adopt(valid);
        assertEq(controller.attempts(), 1);
    }

    function test_genesis_controller_code_change_and_emergency_prevent_adoption() public {
        PolGenesisFixture controller = new PolGenesisFixture(address(vault), address(omr), vault.poolId());
        vm.prank(safe);
        vault.setGenesisController(address(controller));
        uint256 valid = _directMint(address(vault), key, vault.tickLower(), vault.tickUpper(), SEED);
        vm.etch(address(controller), hex"00");
        vm.prank(address(controller));
        vm.expectRevert(ProtocolLiquidityVault.DependencyChanged.selector);
        vault.adoptGenesisFoundation(valid);
        vm.prank(keeper);
        vault.latchEmergency();
        vm.prank(address(controller));
        vm.expectRevert(ProtocolLiquidityVault.EmergencyLatched.selector);
        vault.adoptGenesisFoundation(valid);
        assertEq(vault.positionId(), 0);
    }

    function test_genesis_controller_cannot_be_added_after_foundation_exists() public {
        _seed(vault);
        PolGenesisFixture controller = new PolGenesisFixture(address(vault), address(omr), vault.poolId());
        vm.prank(safe);
        vm.expectRevert(ProtocolLiquidityVault.FoundationAlreadySet.selector);
        vault.setGenesisController(address(controller));
    }

    function test_pause_before_bootstrap_can_resume_without_starting_warmup() public {
        vm.prank(keeper);
        vault.pauseAutomation();
        vm.prank(safe);
        vault.resumeAutomation();
        assertFalse(vault.paused());
        assertEq(vault.activationTimestamp(), 0);
        assertFalse(vault.healthy());
        _seed(vault);
        assertEq(vault.activationTimestamp(), block.timestamp);
        assertFalse(vault.healthy());
    }

    function testFuzz_collected_fee_conservation(uint96 nativeSwap, uint96 omrSwap) public {
        nativeSwap = uint96(bound(nativeSwap, 1e6, 0.5 ether));
        omrSwap = uint96(bound(omrSwap, 1e6, 0.5 ether));
        (uint256 id, uint128 original) = _ready();
        swapRouter.swap{value: nativeSwap}(
            key, SwapParams(true, -int256(uint256(nativeSwap)), TickMath.MIN_SQRT_PRICE + 1),
            PoolSwapTest.TestSettings(false, false), bytes("")
        );
        swapRouter.swap(
            key, SwapParams(false, -int256(uint256(omrSwap)), TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), bytes("")
        );
        (uint256 expectedNative, uint256 expectedOmr) = vault.pendingFees();
        (uint256 nativeFees, uint256 omrFees) = vault.collectFees(block.timestamp);
        assertEq(nativeFees, expectedNative);
        assertEq(omrFees, expectedOmr);
        assertEq(desk.balance + vig.balance, nativeFees);
        assertEq(omr.balanceOf(desk) + omr.balanceOf(vig), omrFees);
        assertEq(desk.balance, nativeFees * 3 / 4);
        assertEq(omr.balanceOf(desk), omrFees * 3 / 4);
        assertEq(positionManager.getPositionLiquidity(id), original);
    }
}

contract ProtocolLiquidityVaultHandler is Test {
    ProtocolLiquidityVault public immutable vault;
    OMR public immutable omr;
    PolOracleFixture public immutable oracle;
    PoolSwapTest public immutable router;
    address public immutable keeper;
    address public immutable safe;
    PoolKey internal key;
    uint256 public nativeDonated;
    uint256 public omrDonated;
    uint256 public liquidityAdded;
    uint256 public successfulAdds;
    uint256 public successfulCollections;
    uint256 public successfulFunding;
    bool public accountingFailure;
    uint256[] internal spendTimes;
    uint256[] internal nativeSpends;
    uint256[] internal omrSpends;

    constructor(ProtocolLiquidityVault target, OMR token, PolOracleFixture feed, PoolSwapTest swapper, PoolKey memory pool) {
        vault = target;
        omr = token;
        oracle = feed;
        router = swapper;
        keeper = target.keeper();
        safe = target.owner();
        key = pool;
        omr.approve(address(router), type(uint256).max);
        _record(target.totalNativeAdded(), target.totalOmrAdded(), target.activationTimestamp());
    }

    receive() external payable {}

    function _record(uint256 nativeUsed, uint256 omrUsed, uint256 at) private {
        spendTimes.push(at);
        nativeSpends.push(nativeUsed);
        omrSpends.push(omrUsed);
        if (nativeUsed > vault.maxNativePerAction() || omrUsed > vault.maxOmrPerAction()) accountingFailure = true;
        uint256 activeNative;
        uint256 activeOmr;
        for (uint256 i; i < spendTimes.length; ++i) {
            if (at - spendTimes[i] < vault.budgetWindow()) {
                activeNative += nativeSpends[i];
                activeOmr += omrSpends[i];
            }
        }
        if (activeNative > vault.maxNativePerWindow() || activeOmr > vault.maxOmrPerWindow()) accountingFailure = true;
    }

    function add(uint96 nativeAmount, uint96 omrAmount) external {
        uint128 nativeMax = uint128(bound(nativeAmount, 1e12, 5 ether));
        uint128 omrMax = uint128(bound(omrAmount, 1e12, 5 ether));
        uint256 beforeNative = address(vault).balance;
        uint256 beforeOmr = omr.balanceOf(address(vault));
        vm.prank(keeper);
        try vault.increase(nativeMax, omrMax, 1, block.timestamp) returns (uint128 liquidity, uint256 nativeUsed, uint256 omrUsed) {
            if (beforeNative - address(vault).balance != nativeUsed
                || beforeOmr - omr.balanceOf(address(vault)) != omrUsed) accountingFailure = true;
            liquidityAdded += liquidity;
            ++successfulAdds;
            _record(nativeUsed, omrUsed, block.timestamp);
        } catch {}
    }

    function collect() external {
        uint256 beforeNative = address(vault).balance;
        uint256 beforeOmr = omr.balanceOf(address(vault));
        try vault.collectFees(block.timestamp) returns (uint256, uint256) {
            if (address(vault).balance != beforeNative || omr.balanceOf(address(vault)) != beforeOmr) accountingFailure = true;
            ++successfulCollections;
        } catch {}
    }

    function fund(uint96 amount) external {
        uint128 nativeAmount = uint128(bound(amount, 1, 5 ether));
        uint256 beforeNative = address(vault).balance;
        vm.prank(keeper);
        try vault.fundInventory(nativeAmount) {
            if (beforeNative - address(vault).balance != nativeAmount) accountingFailure = true;
            ++successfulFunding;
            _record(nativeAmount, 0, block.timestamp);
        } catch {}
    }

    function swap(bool nativeIn, uint80 amount) external {
        uint256 input = bound(amount, 1e8, 0.01 ether);
        router.swap{value: nativeIn ? input : 0}(
            key,
            SwapParams(nativeIn, -int256(input), nativeIn ? TickMath.MIN_SQRT_PRICE + 1 : TickMath.MAX_SQRT_PRICE - 1),
            PoolSwapTest.TestSettings(false, false), bytes("")
        );
    }

    function donate(uint80 nativeAmount, uint80 omrAmount) external {
        uint256 nativeValue = bound(nativeAmount, 0, 0.1 ether);
        uint256 omrValue = bound(omrAmount, 0, 0.1 ether);
        (bool success,) = address(vault).call{value: nativeValue}(bytes(""));
        if (success) nativeDonated += nativeValue;
        if (omr.transfer(address(vault), omrValue)) omrDonated += omrValue;
    }

    function elapse(uint32 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 0, 2 days));
        oracle.set(1 ether, block.timestamp);
    }

    function pauseResume() external {
        if (vault.paused()) {
            vm.prank(safe);
            vault.resumeAutomation();
        } else {
            vm.prank(keeper);
            vault.pauseAutomation();
        }
    }

    function attemptUnauthorized(uint96 amount) external {
        // The handler has no keeper, owner, NFT or Permit2 authority.
        try vault.fundInventory(uint128(amount)) { accountingFailure = true; } catch {}
        try vault.recoverEmergency() { accountingFailure = true; } catch {}
    }
}

contract ProtocolLiquidityVaultInvariantTest is ProtocolLiquidityVaultFixture {
    ProtocolLiquidityVaultHandler internal handler;
    uint128 internal initialLiquidity;
    uint256 internal initialPosition;
    PolInventoryFixture internal executor;

    function setUp() public override {
        super.setUp();
        (initialPosition, initialLiquidity) = _ready();
        executor = _bind();
        handler = new ProtocolLiquidityVaultHandler(vault, omr, oracle, swapRouter, key);
        vm.deal(address(handler), 1_000 ether);
        omr.transfer(address(handler), 1_000 ether);
        // Prime the actual additions and deposits so the invariants cannot pass
        // solely because a handler selector happened never to reach success.
        handler.add(uint96(1 ether), uint96(1 ether));
        handler.fund(uint96(1 ether));
        handler.swap(true, uint80(0.001 ether));
        handler.collect();
        assertGt(handler.successfulAdds(), 0);
        assertGt(handler.successfulFunding(), 0);
        assertGt(vault.totalCollectedNative(), 0);
        bytes4[] memory selectors = new bytes4[](8);
        selectors[0] = handler.add.selector;
        selectors[1] = handler.collect.selector;
        selectors[2] = handler.fund.selector;
        selectors[3] = handler.swap.selector;
        selectors[4] = handler.donate.selector;
        selectors[5] = handler.elapse.selector;
        selectors[6] = handler.pauseResume.selector;
        selectors[7] = handler.attemptUnauthorized.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    function invariant_principal_custody_and_liquidity_are_monotonic() public view {
        assertEq(vault.positionId(), initialPosition);
        assertEq(positionManager.ownerOf(initialPosition), address(vault));
        assertEq(vault.currentLiquidity(), uint256(initialLiquidity) + handler.liquidityAdded());
        assertGe(vault.currentLiquidity(), vault.minLiquidity());
        assertEq(positionManager.getApproved(initialPosition), address(0));
        assertFalse(positionManager.isApprovedForAll(address(vault), keeper));
        assertEq(omr.allowance(address(vault), address(permit)), 0);
        (uint160 allowance,,) = permit.allowance(address(vault), address(omr), address(positionManager));
        assertEq(allowance, 0);
    }

    function invariant_balances_and_fee_routes_conserve_each_currency() public view {
        assertFalse(handler.accountingFailure());
        assertEq(
            address(vault).balance + vault.totalNativeAdded() + vault.totalInventoryNativeFunded(),
            1_000 ether + handler.nativeDonated()
        );
        assertEq(omr.balanceOf(address(vault)) + vault.totalOmrAdded(), 1_000 ether + handler.omrDonated());
        assertEq(desk.balance + vig.balance, vault.totalCollectedNative());
        assertEq(omr.balanceOf(desk) + omr.balanceOf(vig), vault.totalCollectedOmr());
        assertEq(executor.deposited(), vault.totalInventoryNativeFunded());
    }

    function invariant_paused_and_warming_custody_cannot_report_healthy() public view {
        if (vault.paused() || block.timestamp < vault.activationTimestamp() + vault.warmup()) {
            assertFalse(vault.healthy());
        }
    }
}
