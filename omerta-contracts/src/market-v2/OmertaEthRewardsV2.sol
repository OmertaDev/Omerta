// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";
import {IOmertaMarketStateV2} from "./IOmertaMarketStateV2.sol";
import {OmertaSwapRouterV2} from "./OmertaSwapRouterV2.sol";

interface IEthTaxManagerV2 {
    function omr() external view returns (address);
    function rewardsRecipient() external view returns (address);
    function sweep(Currency currency, uint8 bucket) external returns (uint256);
}
interface IEthRewardHookV2 {
    function poolKey() external view returns (PoolKey memory);
    function poolManager() external view returns (address);
    function omr() external view returns (address);
    function rewardsRecipient() external view returns (address);
    function managerCollectsRevenue() external view returns (bool);
}
interface IEthRewardMarketStateV2 {
    function source() external view returns (address);
}
interface IEthRewardVaultV2 {
    function omr() external view returns (address);
    function distributor() external view returns (address);
    function active() external view returns (bool);
    function totalEthFunded() external view returns (uint256);
    function fundEth() external payable;
}

/// @notice Collects the extra 0.5% trading allocation and funds native ETH rewards for OMR stakers.
/// @dev Only OMR conversion needs activation, fresh market data and a bounded Safe health attestation.
/// The lease is operational trust, not automatic sequencer detection. Collection and forwarding ETH
/// to the fixed vault remain available while conversion is paused or unhealthy. No owner sweep,
/// external purchase route or arbitrary recipient/call facility exists. Staker exits are independent.
contract OmertaEthRewardsV2 is Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    uint16 public constant MAX_CANONICAL_TRADE_COST_BPS = 450;

    struct Policy {
        uint256 maxOmrPerCall;
        uint256 maxOmrPerDay;
        uint256 maxNativePerCall;
        uint256 maxNativePerDay;
        uint16 maxSlippageBps;
        uint16 maxStressBps;
        uint64 maxMarketAge;
        uint64 maxDeadlineDelay;
        uint64 maxHealthLease;
        uint64 recoveryGrace;
    }

    address public immutable safe;
    address public keeper;
    IOmertaRestrictedOMRV2 public immutable omr;
    address public immutable rewardVault;
    address public immutable manager;
    OmertaSwapRouterV2 public immutable canonicalRouter;
    IOmertaMarketStateV2 public immutable marketState;
    bytes32 public immutable canonicalPoolId;
    bytes32 public immutable omrRuntimeHash;
    bytes32 public immutable rewardVaultRuntimeHash;
    bytes32 public immutable managerRuntimeHash;
    bytes32 public immutable canonicalRouterRuntimeHash;
    bytes32 public immutable marketStateRuntimeHash;
    bytes32 public immutable canonicalHookRuntimeHash;
    bool public active;
    uint64 public healthValidUntil;
    uint64 public healthySince;
    mapping(uint256 => uint256) public omrConvertedOnDay;
    mapping(uint256 => uint256) public nativeFundedOnDay;
    uint256 public totalNativeCollected;
    uint256 public totalOmrCollected;
    uint256 public totalEthFunded;
    PoolKey private _key;
    Policy private _policy;

    error InvalidConfiguration();
    error Unauthorized();
    error NotReady();
    error RuntimeChanged();
    error HealthUnavailable();
    error MarketUnavailable();
    error InvalidDeadline();
    error CapExceeded();
    error OutputBelowMinimum();
    error SettlementMismatch();

    event TaxCollected(uint256 nativeAmount, uint256 omrAmount);
    event OmrConverted(uint256 amount, uint256 nativeReceived);
    event RewardsFunded(uint256 amount);
    event HealthLeaseConfirmed(uint64 healthySince, uint64 validUntil);
    event HealthRevoked();
    event KeeperChanged(address indexed keeper);
    event Activated();

    constructor(
        IOmertaRestrictedOMRV2 omr_, address safe_, address keeper_, address rewardVault_,
        address manager_, OmertaSwapRouterV2 canonicalRouter_, IOmertaMarketStateV2 marketState_,
        PoolKey memory canonicalKey_, Policy memory policy_
    ) {
        if (safe_ == address(0) || keeper_ == address(0) || address(omr_).code.length == 0
            || rewardVault_.code.length == 0 || manager_.code.length == 0
            || address(canonicalRouter_).code.length == 0 || address(marketState_).code.length == 0
            || Currency.unwrap(canonicalKey_.currency0) != address(0)
            || Currency.unwrap(canonicalKey_.currency1) != address(omr_) || address(canonicalKey_.hooks).code.length == 0
            || canonicalKey_.tickSpacing <= 0 || canonicalKey_.fee >= 1_000_000
            || address(canonicalRouter_.manager()) != manager_ || address(canonicalRouter_.omr()) != address(omr_)
            || IEthTaxManagerV2(manager_).omr() != address(omr_)
            || IEthRewardVaultV2(rewardVault_).omr() != address(omr_)) revert InvalidConfiguration();
        _validatePolicy(policy_);
        safe = safe_; keeper = keeper_; omr = omr_; rewardVault = rewardVault_;
        manager = manager_; canonicalRouter = canonicalRouter_; marketState = marketState_;
        _key = canonicalKey_; canonicalPoolId = PoolId.unwrap(canonicalKey_.toId()); _policy = policy_;
        omrRuntimeHash = address(omr_).codehash; rewardVaultRuntimeHash = rewardVault_.codehash;
        managerRuntimeHash = manager_.codehash; canonicalRouterRuntimeHash = address(canonicalRouter_).codehash;
        marketStateRuntimeHash = address(marketState_).codehash;
        canonicalHookRuntimeHash = address(canonicalKey_.hooks).codehash;
        _checkCanonicalMarket();
        _pause();
    }

    modifier onlySafe() { if (msg.sender != safe) revert Unauthorized(); _; }
    modifier onlyExecutor() { if (msg.sender != safe && msg.sender != keeper) revert Unauthorized(); _; }
    function policy() external view returns (Policy memory) { return _policy; }
    function poolKey() external view returns (PoolKey memory) { return _key; }

    function minimumNativeFor(uint256 amount) external view whenNotPaused returns (uint256) {
        _requireActive(uint64(block.timestamp));
        IOmertaMarketStateV2.Snapshot memory s = _checkHealthAndMarket();
        _checkCap(amount, true);
        return _nativeFloor(amount, s.omrPerEth);
    }
    function setKeeper(address next) external onlySafe {
        if (next == address(0)) revert InvalidConfiguration();
        keeper = next; emit KeeperChanged(next);
    }
    function confirmHealthyUntil(uint64 until) external onlySafe {
        if (until <= block.timestamp || until > block.timestamp + _policy.maxHealthLease) revert InvalidConfiguration();
        if (healthValidUntil <= block.timestamp || healthySince == 0) healthySince = uint64(block.timestamp);
        healthValidUntil = until; emit HealthLeaseConfirmed(healthySince, until);
    }
    function revokeHealth() external onlyExecutor {
        healthValidUntil = 0; healthySince = 0; emit HealthRevoked();
    }
    function healthReady() public view returns (bool) {
        return healthySince != 0 && block.timestamp < healthValidUntil
            && block.timestamp >= uint256(healthySince) + _policy.recoveryGrace;
    }
    function activate() external onlySafe {
        if (active) revert NotReady();
        _checkConversionCore(); _checkHealthAndMarket(); _checkVault();
        active = true; _unpause(); emit Activated();
    }
    function pause() external onlyExecutor { _pause(); }
    function unpause() external onlySafe {
        if (!active) revert NotReady();
        _checkConversionCore(); _checkHealthAndMarket(); _checkVault(); _unpause();
    }

    /// @notice Permissionless collection of only the extra trading allocation into this fixed receiver.
    function collectTax() external nonReentrant {
        _checkFundingCore();
        uint256 nativeBefore = address(this).balance;
        uint256 omrBefore = omr.balanceOf(address(this));
        uint256 nativeAmount = IEthTaxManagerV2(manager).sweep(Currency.wrap(address(0)), 4);
        uint256 omrAmount = IEthTaxManagerV2(manager).sweep(Currency.wrap(address(omr)), 4);
        if (address(this).balance - nativeBefore != nativeAmount || omr.balanceOf(address(this)) - omrBefore != omrAmount) {
            revert SettlementMismatch();
        }
        totalNativeCollected += nativeAmount; totalOmrCollected += omrAmount;
        emit TaxCollected(nativeAmount, omrAmount);
    }

    /// @notice Held ETH enters the fixed vault without a swap or conversion-health dependency.
    /// Funding caps bound releases; paused conversion never blocks this path or earned vault claims.
    function fundRewards(uint256 amount) external nonReentrant {
        _checkFundingCore(); _checkVault(); _consumeCap(amount, false);
        uint256 beforeBalance = address(this).balance;
        uint256 beforeFunded = IEthRewardVaultV2(rewardVault).totalEthFunded();
        IEthRewardVaultV2(rewardVault).fundEth{value: amount}();
        if (beforeBalance - address(this).balance != amount
            || IEthRewardVaultV2(rewardVault).totalEthFunded() - beforeFunded != amount) revert SettlementMismatch();
        totalEthFunded += amount; emit RewardsFunded(amount);
    }

    /// @notice Restricted OMR settles only through the pinned canonical game manager/router/key.
    function convertOmr(uint256 amount, uint256 minNative, uint64 deadline)
        external onlyExecutor nonReentrant whenNotPaused returns (uint256 received)
    {
        _requireActive(deadline);
        IOmertaMarketStateV2.Snapshot memory s = _checkHealthAndMarket();
        _consumeCap(amount, true);
        if (minNative == 0 || minNative < _nativeFloor(amount, s.omrPerEth)) revert OutputBelowMinimum();
        uint256 nativeBefore = address(this).balance;
        uint256 omrBefore = omr.balanceOf(address(this));
        IERC20(address(omr)).forceApprove(address(canonicalRouter), amount);
        canonicalRouter.swap(_key, SwapParams(false, -int256(amount), TickMath.MAX_SQRT_PRICE - 1), minNative, amount, deadline);
        IERC20(address(omr)).forceApprove(address(canonicalRouter), 0);
        received = address(this).balance - nativeBefore;
        if (omrBefore - omr.balanceOf(address(this)) != amount || received < minNative) revert SettlementMismatch();
        emit OmrConverted(amount, received);
    }

    function _requireActive(uint64 deadline) private view {
        if (!active) revert NotReady();
        if (deadline < block.timestamp || deadline > block.timestamp + _policy.maxDeadlineDelay) revert InvalidDeadline();
        _checkConversionCore();
    }
    function _checkFundingCore() private view {
        if (address(omr).codehash != omrRuntimeHash || rewardVault.codehash != rewardVaultRuntimeHash
            || manager.codehash != managerRuntimeHash) revert RuntimeChanged();
        if (IEthTaxManagerV2(manager).rewardsRecipient() != address(this)) revert NotReady();
    }
    function _checkConversionCore() private view {
        _checkFundingCore();
        if (address(canonicalRouter).codehash != canonicalRouterRuntimeHash
            || address(marketState).codehash != marketStateRuntimeHash) revert RuntimeChanged();
        _checkCanonicalMarket();
    }
    function _checkCanonicalMarket() private view {
        address hook = address(_key.hooks);
        if (hook.codehash != canonicalHookRuntimeHash) revert RuntimeChanged();
        IEthRewardHookV2 source = IEthRewardHookV2(hook);
        if (source.poolManager() != manager || source.omr() != address(omr)
            || PoolId.unwrap(source.poolKey().toId()) != canonicalPoolId
            || address(IEthRewardMarketStateV2(address(marketState)).source()) != hook
            || !source.managerCollectsRevenue()) revert InvalidConfiguration();
    }
    function _checkVault() private view {
        if (!IEthRewardVaultV2(rewardVault).active()
            || IEthRewardVaultV2(rewardVault).distributor() != address(this)) revert NotReady();
    }
    function _checkHealthAndMarket() private view returns (IOmertaMarketStateV2.Snapshot memory s) {
        if (!healthReady()) revert HealthUnavailable();
        s = marketState.snapshot();
        if (!s.valid || s.epoch == 0 || s.observedAt == 0 || s.observedAt > block.timestamp
            || block.timestamp - s.observedAt > _policy.maxMarketAge || s.minLiquidity == 0
            || s.omrPerEth == 0 || s.stressBps > _policy.maxStressBps) revert MarketUnavailable();
        if (IEthRewardHookV2(address(_key.hooks)).rewardsRecipient() != address(this)
            || !omr.policySealed() || omr.settlementManager() != manager
            || !omr.isRecipient(address(this))) revert NotReady();
    }
    function _consumeCap(uint256 amount, bool isOmr) private {
        uint256 day = block.timestamp / 1 days;
        uint256 next = _checkCap(amount, isOmr);
        if (isOmr) omrConvertedOnDay[day] = next;
        else nativeFundedOnDay[day] = next;
    }
    function _checkCap(uint256 amount, bool isOmr) private view returns (uint256 next) {
        uint256 day = block.timestamp / 1 days;
        if (amount == 0 || amount > uint256(type(int256).max)) revert CapExceeded();
        uint256 perCall = isOmr ? _policy.maxOmrPerCall : _policy.maxNativePerCall;
        uint256 perDay = isOmr ? _policy.maxOmrPerDay : _policy.maxNativePerDay;
        uint256 spent = isOmr ? omrConvertedOnDay[day] : nativeFundedOnDay[day];
        if (amount > perCall || amount > perDay - spent) revert CapExceeded();
        return spent + amount;
    }
    function _nativeFloor(uint256 amount, uint256 omrPerEth) private view returns (uint256) {
        uint256 quote = Math.mulDiv(amount, 1 ether, omrPerEth);
        quote = Math.mulDiv(quote, 1_000_000 - _key.fee, 1_000_000);
        quote = Math.mulDiv(quote, 10_000 - MAX_CANONICAL_TRADE_COST_BPS, 10_000);
        uint256 minimum = Math.mulDiv(quote, 10_000 - _policy.maxSlippageBps, 10_000);
        if (minimum == 0) revert OutputBelowMinimum();
        return minimum;
    }
    function _validatePolicy(Policy memory p) private pure {
        if (p.maxOmrPerCall == 0 || p.maxOmrPerDay < p.maxOmrPerCall || p.maxNativePerCall == 0
            || p.maxNativePerDay < p.maxNativePerCall || p.maxSlippageBps > 1000 || p.maxStressBps > 10_000
            || p.maxMarketAge == 0 || p.maxMarketAge > 7 days || p.maxDeadlineDelay == 0
            || p.maxDeadlineDelay > 1 hours || p.recoveryGrace == 0 || p.maxHealthLease > 1 hours
            || p.maxHealthLease <= p.recoveryGrace) revert InvalidConfiguration();
    }
    receive() external payable {
        if (msg.sender != manager && msg.sender != address(canonicalRouter)) revert Unauthorized();
    }
}
