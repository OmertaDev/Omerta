// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title KeeperGasVault — operations-funded, bounded gas refills for approved keeper wallets.
/// @notice The owner supplies ETH separately from fee routing. Anyone can trigger a refill, but ETH
///         goes only to the named allowlisted keeper and only toward its configured balance target.
///         Immutable limits bound each refill and aggregate spending per UTC day. A compromised
///         keeper can consume that finite allowance; this contract does not attest how it uses gas.
contract KeeperGasVault is Ownable2Step, Pausable, ReentrancyGuard {
    uint256 public constant PERIOD = 1 days;
    uint256 public immutable periodBudget;
    uint256 public immutable perRefillCap;
    uint256 public immutable targetBalance;
    uint256 public immutable minInterval;
    mapping(address => bool) public allowedKeeper;
    mapping(address => uint256) public nextRefillAt;
    mapping(uint256 => uint256) public spentInPeriod;
    uint256 public totalRefilled;

    event Funded(address indexed sender, uint256 amount);
    event KeeperAllowed(address indexed keeper, bool allowed);
    event KeeperRefilled(address indexed keeper, uint256 amount, uint256 indexed period, uint256 spent);
    event Recovered(address indexed owner, uint256 amount);

    error InvalidLimits();
    error InvalidKeeper();
    error KeeperNotAllowed();
    error RefillTooSoon(uint256 nextRefillAt);
    error NothingToRefill();
    error TransferFailed();
    error InvalidAmount();

    constructor(
        address owner_, uint256 periodBudget_, uint256 perRefillCap_,
        uint256 targetBalance_, uint256 minInterval_
    ) Ownable(owner_) {
        if (periodBudget_ == 0 || perRefillCap_ == 0 || targetBalance_ == 0 || minInterval_ == 0
            || perRefillCap_ > periodBudget_ || perRefillCap_ > targetBalance_) revert InvalidLimits();
        periodBudget = periodBudget_;
        perRefillCap = perRefillCap_;
        targetBalance = targetBalance_;
        minInterval = minInterval_;
    }

    receive() external payable { emit Funded(msg.sender, msg.value); }

    function setKeeperAllowed(address keeper, bool allowed) external onlyOwner {
        if (keeper == address(0) || keeper == address(this)) revert InvalidKeeper();
        allowedKeeper[keeper] = allowed;
        // Revoking and reallowing a keeper cannot reset its cooldown or the shared daily budget.
        emit KeeperAllowed(keeper, allowed);
    }

    /// @notice The exact refill possible now, without a transaction. Zero means no funded refill is due.
    function refillAmount(address keeper) public view returns (uint256 amount) {
        if (paused() || !allowedKeeper[keeper] || block.timestamp < nextRefillAt[keeper]
            || keeper.balance >= targetBalance) return 0;
        uint256 remaining = periodBudget - spentInPeriod[block.timestamp / PERIOD];
        amount = Math.min(targetBalance - keeper.balance, perRefillCap);
        amount = Math.min(amount, remaining);
        amount = Math.min(amount, address(this).balance);
    }

    /// @notice Pay only an approved keeper's deficit. The caller cannot redirect, increase or refund
    ///         this payment to itself. Every external effect follows durable budget/cooldown updates.
    function topUp(address payable keeper) external nonReentrant whenNotPaused returns (uint256 amount) {
        if (!allowedKeeper[keeper]) revert KeeperNotAllowed();
        if (block.timestamp < nextRefillAt[keeper]) revert RefillTooSoon(nextRefillAt[keeper]);
        amount = refillAmount(keeper);
        if (amount == 0) revert NothingToRefill();
        uint256 period = block.timestamp / PERIOD;
        spentInPeriod[period] += amount;
        totalRefilled += amount;
        nextRefillAt[keeper] = block.timestamp + minInterval;
        (bool ok,) = keeper.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit KeeperRefilled(keeper, amount, period, spentInPeriod[period]);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Paused emergency recovery goes only to the current governance owner.
    function recover(uint256 amount) external onlyOwner whenPaused nonReentrant {
        if (amount == 0 || amount > address(this).balance) revert InvalidAmount();
        (bool ok,) = payable(owner()).call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Recovered(owner(), amount);
    }
}
