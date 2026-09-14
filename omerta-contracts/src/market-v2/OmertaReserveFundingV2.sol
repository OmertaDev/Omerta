// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OmertaStabilityControllerV2 as Controller} from "./OmertaStabilityControllerV2.sol";

/// @notice A fixed funding lane for hook revenues, realized solver profits, bond proceeds,
/// LP revenue, or donations. Only actual held assets can flow into its immutable compartment.
/// @dev Funding never resets episode capacity or lifetime spend in the strategy controller.
contract OmertaReserveFundingV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public immutable safe;
    IERC20 public immutable omr;
    Controller.Tranche public immutable tranche;
    Controller public controller;
    uint256 public totalNativeFunded;
    uint256 public totalOmrFunded;

    error InvalidConfiguration();
    error Unauthorized();
    error AlreadyBound();
    error Unbound();
    event ControllerBound(address indexed controller);
    event Funded(uint256 nativeAmount, uint256 omrAmount);

    constructor(address safe_, IERC20 omr_, Controller.Tranche tranche_) {
        if (safe_ == address(0) || address(omr_).code.length == 0) revert InvalidConfiguration();
        safe = safe_;
        omr = omr_;
        tranche = tranche_;
    }

    receive() external payable {}

    function bindController(Controller controller_) external {
        if (msg.sender != safe) revert Unauthorized();
        if (address(controller) != address(0)) revert AlreadyBound();
        if (
            address(controller_).code.length == 0 || controller_.safe() != safe
                || address(controller_.omr()) != address(omr)
        ) revert InvalidConfiguration();
        controller = controller_;
        emit ControllerBound(address(controller_));
    }

    /// @notice Anyone can deliver pending assets, but cannot choose a recipient or amount.
    function flush() external nonReentrant {
        if (address(controller) == address(0)) revert Unbound();
        uint256 nativeAmount = address(this).balance;
        uint256 omrAmount = omr.balanceOf(address(this));
        if (nativeAmount == 0 && omrAmount == 0) return;
        totalNativeFunded += nativeAmount;
        totalOmrFunded += omrAmount;
        if (omrAmount != 0) omr.forceApprove(address(controller), omrAmount);
        controller.fund{value: nativeAmount}(tranche, omrAmount);
        if (omrAmount != 0) omr.forceApprove(address(controller), 0);
        emit Funded(nativeAmount, omrAmount);
    }
}
