// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// @notice Solver-funded atomic ETH -> OMR -> ETH arbitrage with measured profit sharing.
/// @dev Both pools live in one PoolManager. The alternative pool must be an unhooked ETH/OMR
///      pool; no executor, arbitrary calldata, token approvals or treasury capital is accepted.
///      The canonical hook still charges its normal fees. The caller posts collateral equal
///      to maximum input, then v4 nets the two trades and only realized net profit is taken.
///      A commitment binds the plan to its solver. It does not promise private order flow,
///      exclusive arbitrage rights, censorship resistance, or protection from price competition.
contract OmertaArbitrageV2 is IUnlockCallback, ReentrancyGuard {
    using PoolIdLibrary for PoolKey;

    struct Commitment {
        bytes32 planHash;
        uint64 blockNumber;
    }

    struct Plan {
        PoolKey alternative;
        bool canonicalFirst;
        uint128 amount;
        uint128 minimumProfit;
        uint64 deadline;
        bytes32 salt;
    }

    IPoolManager public immutable manager;
    address public immutable omr;
    address public immutable stabilityRecipient;
    uint16 public immutable reserveProfitBps;
    uint128 public immutable maxInput;
    PoolKey private _canonical;
    mapping(address => Commitment) public commitments;
    mapping(address => uint256) public claimable;
    uint256 public totalClaimable;
    bytes32 private _activePlan;

    error InvalidConfiguration();
    error InvalidPlan();
    error InvalidCommitment();
    error InvalidCallback();
    error IncompleteCycle();
    error InsufficientProfit();
    error TransferFailed();

    event Committed(address indexed solver, bytes32 indexed planHash, uint64 blockNumber);
    event ArbitrageSettled(
        address indexed solver,
        PoolId indexed alternativePool,
        bool canonicalFirst,
        uint256 inputCollateral,
        uint256 realizedProfit,
        uint256 stabilityShare
    );
    event Claimed(address indexed beneficiary, address indexed receiver, uint256 amount);

    constructor(
        IPoolManager manager_,
        PoolKey memory canonical_,
        address stabilityRecipient_,
        uint16 reserveProfitBps_,
        uint128 maxInput_
    ) {
        if (
            address(manager_).code.length == 0 || Currency.unwrap(canonical_.currency0) != address(0)
                || Currency.unwrap(canonical_.currency1).code.length == 0 || address(canonical_.hooks).code.length == 0
                || stabilityRecipient_ == address(0) || stabilityRecipient_ == address(this) || reserveProfitBps_ > 5000
                || maxInput_ == 0 || maxInput_ > uint128(type(int128).max) || canonical_.tickSpacing <= 0
        ) revert InvalidConfiguration();
        manager = manager_;
        _canonical = canonical_;
        omr = Currency.unwrap(canonical_.currency1);
        stabilityRecipient = stabilityRecipient_;
        reserveProfitBps = reserveProfitBps_;
        maxInput = maxInput_;
    }

    function poolKey() external view returns (PoolKey memory) {
        return _canonical;
    }

    function hashPlan(address solver, Plan calldata plan) public view returns (bytes32) {
        return keccak256(abi.encode(block.chainid, address(this), solver, plan));
    }

    function commit(bytes32 planHash) external {
        if (planHash == bytes32(0)) revert InvalidPlan();
        commitments[msg.sender] = Commitment(planHash, uint64(block.number));
        emit Committed(msg.sender, planHash, uint64(block.number));
    }

    function execute(Plan calldata plan) external payable nonReentrant returns (uint256 profit) {
        if (
            plan.amount == 0 || plan.amount > maxInput || msg.value != plan.amount || plan.minimumProfit == 0
                || plan.deadline < block.timestamp || plan.deadline > block.timestamp + 5 minutes
                || Currency.unwrap(plan.alternative.currency0) != address(0)
                || Currency.unwrap(plan.alternative.currency1) != omr || address(plan.alternative.hooks) != address(0)
                || plan.alternative.fee > 10_000 || plan.alternative.tickSpacing <= 0
                || plan.alternative.tickSpacing > TickMath.MAX_TICK_SPACING
        ) revert InvalidPlan();
        bytes32 h = hashPlan(msg.sender, plan);
        Commitment memory c = commitments[msg.sender];
        if (c.planHash != h || block.number <= c.blockNumber || block.number > uint256(c.blockNumber) + 64) {
            revert InvalidCommitment();
        }
        delete commitments[msg.sender];
        bytes memory payload = abi.encode(plan);
        _activePlan = keccak256(payload);
        profit = abi.decode(manager.unlock(payload), (uint256));
        delete _activePlan;
        uint256 reserve = profit * reserveProfitBps / 10_000;
        claimable[stabilityRecipient] += reserve;
        claimable[msg.sender] += msg.value + profit - reserve;
        totalClaimable += msg.value + profit;
        emit ArbitrageSettled(msg.sender, plan.alternative.toId(), plan.canonicalFirst, msg.value, profit, reserve);
    }

    function unlockCallback(bytes calldata data) external returns (bytes memory) {
        if (msg.sender != address(manager) || _activePlan == bytes32(0) || keccak256(data) != _activePlan) {
            revert InvalidCallback();
        }
        delete _activePlan; // one callback, including when a pool unexpectedly re-enters
        Plan memory plan = abi.decode(data, (Plan));
        PoolKey memory first = plan.canonicalFirst ? _canonical : plan.alternative;
        PoolKey memory second = plan.canonicalFirst ? plan.alternative : _canonical;
        BalanceDelta buy =
            manager.swap(first, SwapParams(true, -int256(uint256(plan.amount)), TickMath.MIN_SQRT_PRICE + 1), "");
        if (buy.amount0() != -int128(plan.amount) || buy.amount1() <= 0) revert IncompleteCycle();
        BalanceDelta sell =
            manager.swap(second, SwapParams(false, -int256(buy.amount1()), TickMath.MAX_SQRT_PRICE - 1), "");
        if (int256(sell.amount1()) + int256(buy.amount1()) != 0) revert IncompleteCycle();
        int256 net = int256(buy.amount0()) + int256(sell.amount0());
        if (net < int256(uint256(plan.minimumProfit))) revert InsufficientProfit();
        uint256 profit = uint256(net);
        manager.take(Currency.wrap(address(0)), address(this), profit);
        return abi.encode(profit);
    }

    function claim(address payable receiver) external nonReentrant {
        _claim(msg.sender, receiver);
    }

    /// @notice Anyone can settle a recipient's funded balance to that exact recipient.
    function claimFor(address payable beneficiary) external nonReentrant {
        _claim(beneficiary, beneficiary);
    }

    function _claim(address beneficiary, address payable receiver) private {
        if (receiver == address(0) || receiver == address(this)) revert InvalidPlan();
        uint256 amount = claimable[beneficiary];
        claimable[beneficiary] = 0;
        totalClaimable -= amount;
        (bool ok,) = receiver.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Claimed(beneficiary, receiver, amount);
    }

    receive() external payable {
        if (msg.sender != address(manager)) revert InvalidCallback();
    }
}
