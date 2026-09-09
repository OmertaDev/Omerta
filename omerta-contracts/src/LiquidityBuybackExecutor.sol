// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IOmrOracle} from "./IOmrOracle.sol";
import {ILiquidityHealth} from "./interfaces/ILiquidityHealth.sol";

/// @notice A funded, bounded native-ETH buyer for one immutable OMR pool and revenue stream.
/// @dev Keepers cannot choose the pool, recipients, approvals, arbitrary calldata or output split.
///      VIG output is 50% reserve / 50% prizes; both may be physically held by VoucherClaim,
///      with only the reserve half initially credited as signable by the backend. Other streams
///      have one fixed recipient: Desk -> claim, Community -> community custody, POL -> POL vault.
///      Token delivery and the swap are atomic. No call here mints OMR or credits an off-chain balance.
contract LiquidityBuybackExecutor is Ownable2Step, Pausable, ReentrancyGuard, IUnlockCallback {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;

    enum Stream { Vig, Desk, Community, Pol }
    struct Policy {
        uint128 perAction;
        uint128 perDay;
        uint32 minInterval;
        uint32 maxOracleAge;
        uint16 slippageBps;
    }

    IPoolManager public immutable poolManager;
    IERC20 public immutable omr;
    IOmrOracle public immutable oracle;
    ILiquidityHealth public immutable healthGuard;
    PoolId public immutable poolId;
    PoolKey private _poolKey;
    Stream public immutable stream;
    address public immutable primaryRecipient;
    address public immutable secondaryRecipient;
    uint256 public immutable perAction;
    uint256 public immutable perDay;
    uint256 public immutable minInterval;
    uint256 public immutable maxOracleAge;
    uint256 public immutable slippageBps;
    mapping(address => bool) public keeper;
    mapping(uint256 => uint256) public spentInDay;
    uint256 public nextExecutionAt;
    uint256 public sequence;
    bool private _unlocking;

    error InvalidConfiguration();
    error NotKeeper();
    error Unhealthy();
    error InvalidAmount();
    error BudgetExceeded();
    error TooSoon();
    error InvalidDeadline();
    error OracleUnavailable();
    error Slippage();
    error InvalidCallback();
    error TransferMismatch();
    error RecoveryFailed();

    event KeeperSet(address indexed account, bool allowed);
    event BuybackExecuted(uint256 indexed sequence, uint8 indexed stream, uint256 ethSpent,
        uint256 omrBought, uint256 primaryAmount, uint256 secondaryAmount,
        address primaryRecipient, address secondaryRecipient);
    event TokenRevenueDistributed(uint256 indexed sequence, uint8 indexed stream, uint256 omrAmount,
        uint256 primaryAmount, uint256 secondaryAmount, address primaryRecipient, address secondaryRecipient);
    event Deposit(address indexed sender, uint256 amount);

    constructor(address owner_, IPoolManager manager_, PoolKey memory key_, IOmrOracle oracle_,
        ILiquidityHealth health_, Stream stream_, address primary_, address secondary_, Policy memory policy_)
        Ownable(owner_)
    {
        address token = Currency.unwrap(key_.currency1);
        if (address(manager_).code.length == 0 || address(oracle_).code.length == 0
            || address(health_).code.length == 0 || Currency.unwrap(key_.currency0) != address(0)
            || token.code.length == 0 || key_.tickSpacing <= 0 || key_.fee >= 1_000_000
            || primary_ == address(0) || primary_ == address(this)
            || (stream_ == Stream.Vig ? secondary_ == address(0) || secondary_ == address(this) : secondary_ != address(0))
            || policy_.perAction == 0 || policy_.perDay < policy_.perAction || policy_.minInterval == 0
            || policy_.maxOracleAge == 0 || policy_.slippageBps > 1000) revert InvalidConfiguration();
        poolManager = manager_;
        omr = IERC20(token);
        oracle = oracle_;
        healthGuard = health_;
        poolId = key_.toId();
        _poolKey = key_;
        stream = stream_;
        primaryRecipient = primary_;
        secondaryRecipient = secondary_;
        perAction = policy_.perAction;
        perDay = policy_.perDay;
        minInterval = policy_.minInterval;
        maxOracleAge = policy_.maxOracleAge;
        slippageBps = policy_.slippageBps;
    }

    receive() external payable { emit Deposit(msg.sender, msg.value); }
    function deposit() external payable { emit Deposit(msg.sender, msg.value); }
    function destination() external view returns (address) { return primaryRecipient; }
    function poolKey() external view returns (PoolKey memory) { return _poolKey; }
    function setKeeper(address account, bool allowed) external onlyOwner {
        if (account == address(0)) revert InvalidConfiguration();
        keeper[account] = allowed;
        emit KeeperSet(account, allowed);
    }
    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    function quoteFloor(uint256 amount) public view returns (uint256 floor) {
        try healthGuard.healthy() returns (bool ok) { if (!ok) revert Unhealthy(); }
        catch { revert Unhealthy(); }
        try oracle.consult() returns (uint256 price, uint256 updatedAt) {
            if (price == 0 || updatedAt > block.timestamp || block.timestamp - updatedAt > maxOracleAge)
                revert OracleUnavailable();
            floor = Math.mulDiv(Math.mulDiv(amount, price, 1e18), 10000 - slippageBps, 10000);
            if (floor == 0) revert InvalidAmount();
        } catch { revert OracleUnavailable(); }
    }

    function execute(uint256 amount, uint256 minOut, uint256 deadline)
        external nonReentrant whenNotPaused returns (uint256 spent, uint256 bought)
    {
        if (!keeper[msg.sender]) revert NotKeeper();
        if (amount == 0 || amount > perAction || amount > address(this).balance) revert InvalidAmount();
        if (block.timestamp < nextExecutionAt) revert TooSoon();
        if (deadline < block.timestamp || deadline > block.timestamp + 300) revert InvalidDeadline();
        uint256 day = block.timestamp / 1 days;
        if (spentInDay[day] + amount > perDay) revert BudgetExceeded();
        if (minOut < quoteFloor(amount)) revert Slippage();
        spentInDay[day] += amount;
        nextExecutionAt = block.timestamp + minInterval;
        uint256 beforeOmr = omr.balanceOf(address(this));
        uint256 beforeEth = address(this).balance;
        _unlocking = true;
        (spent, bought) = abi.decode(poolManager.unlock(abi.encode(amount)), (uint256, uint256));
        _unlocking = false;
        if (spent == 0 || spent > amount || beforeEth - address(this).balance != spent
            || omr.balanceOf(address(this)) - beforeOmr != bought) revert TransferMismatch();
        if (bought < minOut) revert Slippage();
        spentInDay[day] -= amount - spent;
        (uint256 primary, uint256 secondary) = _distribute(bought);
        if (omr.balanceOf(address(this)) != beforeOmr) revert TransferMismatch();
        emit BuybackExecuted(++sequence, uint8(stream), spent, bought, primary, secondary,
            primaryRecipient, secondaryRecipient);
    }

    /// @notice Distribute OMR already received from token-denominated hook/LP revenue. No ETH is
    ///         spent and no price is imputed. The separate event lets the backend account direct
    ///         token receipts without inventing buyback consideration or consuming an ETH budget.
    function distributeTokenRevenue() external nonReentrant whenNotPaused returns (uint256 amount) {
        if (!keeper[msg.sender]) revert NotKeeper();
        amount = omr.balanceOf(address(this));
        if (amount == 0) revert InvalidAmount();
        (uint256 primary, uint256 secondary) = _distribute(amount);
        if (omr.balanceOf(address(this)) != 0) revert TransferMismatch();
        emit TokenRevenueDistributed(++sequence, uint8(stream), amount, primary, secondary,
            primaryRecipient, secondaryRecipient);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(poolManager) || !_unlocking) revert InvalidCallback();
        _unlocking = false; // exactly one callback; reentry cannot create a second swap
        uint256 amount = abi.decode(data, (uint256));
        BalanceDelta delta = poolManager.swap(_poolKey,
            SwapParams(true, -int256(amount), TickMath.MIN_SQRT_PRICE + 1), "");
        if (delta.amount0() >= 0 || delta.amount1() <= 0) revert InvalidAmount();
        uint256 spent = uint256(-int256(delta.amount0()));
        uint256 bought = uint256(int256(delta.amount1()));
        if (spent > amount) revert InvalidAmount();
        poolManager.settle{value: spent}();
        poolManager.take(_poolKey.currency1, address(this), bought);
        return abi.encode(spent, bought);
    }

    function _deliver(address recipient, uint256 amount) private {
        if (amount == 0) return;
        uint256 beforeBalance = omr.balanceOf(recipient);
        omr.safeTransfer(recipient, amount);
        if (omr.balanceOf(recipient) - beforeBalance != amount) revert TransferMismatch();
    }

    function _distribute(uint256 amount) private returns (uint256 primary, uint256 secondary) {
        // Odd-wei remainder belongs to prizes: reserve is the floored 50% agreed by the ledger.
        primary = stream == Stream.Vig ? amount / 2 : amount;
        secondary = amount - primary;
        _deliver(primaryRecipient, primary);
        if (secondary != 0) _deliver(secondaryRecipient, secondary);
    }

    /// @notice Emergency governance can recover funded assets only while stopped.
    function recover(IERC20 token, uint256 amount) external onlyOwner whenPaused nonReentrant {
        if (address(token) == address(0)) {
            (bool ok,) = payable(owner()).call{value: amount}("");
            if (!ok) revert RecoveryFailed();
        } else token.safeTransfer(owner(), amount);
    }
}
