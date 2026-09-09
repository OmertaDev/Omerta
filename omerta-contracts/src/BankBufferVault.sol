// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Transmuter} from "./Transmuter.sol";

/// @title BankBufferVault — bounded use of prefunded backing to repair one bank buffer.
/// @notice Governance transfers the market's backing asset here and separately allows this vault
///         as a Transmuter funder. Anyone may trigger the exact current deficit, constrained by
///         immutable action/day caps and available funds. No caller chooses an amount or recipient.
///         This vault never mints debt or transfers a payout; it only calls the fixed fund() path.
/// @dev Runtime hashes pin the supplied contracts against direct code changes, not proxy upgrades
///      or the correctness of the initial choice. Activation requires reviewed, matching concrete
///      asset/Transmuter runtimes and the separate bank/ERC-4626 backing review. At zero debt supply
///      requiredBuffer() is zero: the first issuance still needs an explicit governance seed.
contract BankBufferVault is Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant PERIOD = 1 days;
    IERC20 public immutable asset;
    Transmuter public immutable transmuter;
    bytes32 public immutable assetCodeHash;
    bytes32 public immutable transmuterCodeHash;
    uint256 public immutable perActionCap;
    uint256 public immutable periodBudget;
    mapping(uint256 => uint256) public spentInPeriod;
    uint256 public totalFunded;

    event BufferFunded(uint256 amount, uint256 indexed period, uint256 spent, uint256 reserves);
    event Recovered(address indexed owner, uint256 amount);

    error InvalidDependency();
    error InvalidLimits();
    error DependencyChanged();
    error NothingToFund();
    error FundingMismatch();
    error InvalidAmount();

    constructor(
        IERC20 asset_, Transmuter transmuter_, address owner_,
        uint256 perActionCap_, uint256 periodBudget_
    ) Ownable(owner_) {
        if (address(asset_).code.length == 0 || address(transmuter_).code.length == 0
            || address(transmuter_.asset()) != address(asset_)) revert InvalidDependency();
        if (perActionCap_ == 0 || periodBudget_ == 0 || perActionCap_ > periodBudget_)
            revert InvalidLimits();
        asset = asset_;
        transmuter = transmuter_;
        assetCodeHash = address(asset_).codehash;
        transmuterCodeHash = address(transmuter_).codehash;
        perActionCap = perActionCap_;
        periodBudget = periodBudget_;
    }

    /// @notice Exact currently fundable amount in backing-asset units. Zero is a funded no-op.
    function fundingAmount() public view returns (uint256 amount) {
        _checkDependencies();
        if (paused()) return 0;
        uint256 required = transmuter.requiredBuffer();
        uint256 current = transmuter.reserves();
        if (current >= required) return 0;
        amount = Math.min(required - current, perActionCap);
        amount = Math.min(amount, periodBudget - spentInPeriod[block.timestamp / PERIOD]);
        amount = Math.min(amount, asset.balanceOf(address(this)));
    }

    /// @notice Move only an existing backing-asset deficit to the immutable Transmuter.
    function fundDeficit() external nonReentrant whenNotPaused returns (uint256 amount) {
        amount = fundingAmount();
        if (amount == 0) revert NothingToFund();
        uint256 period = block.timestamp / PERIOD;
        uint256 sourceBefore = asset.balanceOf(address(this));
        uint256 destinationBefore = asset.balanceOf(address(transmuter));
        uint256 reservesBefore = transmuter.reserves();
        spentInPeriod[period] += amount;
        totalFunded += amount;

        asset.forceApprove(address(transmuter), amount);
        transmuter.fund(amount);
        asset.forceApprove(address(transmuter), 0);

        _checkDependencies();
        if (asset.balanceOf(address(this)) != sourceBefore - amount
            || asset.balanceOf(address(transmuter)) != destinationBefore + amount
            || transmuter.reserves() != reservesBefore + amount
            || asset.allowance(address(this), address(transmuter)) != 0) revert FundingMismatch();
        emit BufferFunded(amount, period, spentInPeriod[period], reservesBefore + amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @notice Paused emergency recovery returns backing only to the current governance owner.
    function recover(uint256 amount) external onlyOwner whenPaused nonReentrant {
        if (amount == 0 || amount > asset.balanceOf(address(this))) revert InvalidAmount();
        uint256 sourceBefore = asset.balanceOf(address(this));
        uint256 recipientBefore = asset.balanceOf(owner());
        asset.safeTransfer(owner(), amount);
        if (asset.balanceOf(address(this)) != sourceBefore - amount
            || asset.balanceOf(owner()) != recipientBefore + amount) revert FundingMismatch();
        emit Recovered(owner(), amount);
    }

    function _checkDependencies() private view {
        if (address(asset).codehash != assetCodeHash
            || address(transmuter).codehash != transmuterCodeHash
            || address(transmuter.asset()) != address(asset)) revert DependencyChanged();
    }
}
