// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OmertaStabilityControllerV2 as Controller} from "./OmertaStabilityControllerV2.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";

/// @notice A typed funding lane for hook revenues, realized solver profits, bond proceeds,
/// LP revenue, or donations. Only actual held assets can flow into its immutable compartment.
/// @dev Funding never resets episode capacity or lifetime spend in the strategy controller.
contract OmertaReserveFundingV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    uint64 public constant CONTROLLER_UPDATE_DELAY = 7 days;
    address public immutable safe;
    IERC20 public immutable omr;
    Controller.Tranche public immutable tranche;
    Controller public controller;
    Controller public pendingController;
    bytes32 public pendingControllerRuntimeHash;
    uint64 public controllerExecutableAt;
    uint256 public totalNativeFunded;
    uint256 public totalOmrFunded;

    error InvalidConfiguration();
    error Unauthorized();
    error AlreadyBound();
    error Unbound();
    error ControllerUpdateNotReady();
    event ControllerBound(address indexed controller);
    event Funded(uint256 nativeAmount, uint256 omrAmount);
    event ControllerProposed(address indexed controller, bytes32 runtimeHash, uint64 executableAt);
    event ControllerProposalCancelled(address indexed controller);
    event ControllerChanged(address indexed previous, address indexed current);

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
            address(controller_) == address(this) || address(controller_).code.length == 0 || controller_.safe() != safe
                || address(controller_.omr()) != address(omr)
        ) revert InvalidConfiguration();
        controller = controller_;
        emit ControllerBound(address(controller_));
    }

    /// @notice New immutable budgets require a separately reviewed successor, never a counter reset.
    /// @dev Proposal replacement restarts the full delay. Token admission has its own public delay.
    function proposeController(Controller candidate, bytes32 expectedRuntimeHash) external {
        if (msg.sender != safe) revert Unauthorized();
        _checkSuccessor(candidate, expectedRuntimeHash);
        pendingController = candidate;
        pendingControllerRuntimeHash = expectedRuntimeHash;
        controllerExecutableAt = uint64(block.timestamp + CONTROLLER_UPDATE_DELAY);
        emit ControllerProposed(address(candidate), expectedRuntimeHash, controllerExecutableAt);
    }

    function cancelControllerProposal() external {
        if (msg.sender != safe) revert Unauthorized();
        address candidate = address(pendingController);
        if (candidate == address(0)) revert ControllerUpdateNotReady();
        delete pendingController;
        delete pendingControllerRuntimeHash;
        delete controllerExecutableAt;
        emit ControllerProposalCancelled(candidate);
    }

    /// @notice Flush every asset held at execution to the old controller before changing future inflows.
    /// No principal, fee debt, or spent authority is transferred out of either controller.
    function executeControllerProposal() external nonReentrant {
        Controller candidate = pendingController;
        if (address(candidate) == address(0) || block.timestamp < controllerExecutableAt) {
            revert ControllerUpdateNotReady();
        }
        _checkSuccessor(candidate, pendingControllerRuntimeHash);
        IOmertaRestrictedOMRV2 policy = IOmertaRestrictedOMRV2(address(omr));
        if (
            !policy.policySealed() || !policy.isOperator(address(candidate))
                || policy.operatorRole(address(candidate)) != IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody
        ) {
            revert InvalidConfiguration();
        }
        Controller previous = controller;
        _flush();
        delete pendingController;
        delete pendingControllerRuntimeHash;
        delete controllerExecutableAt;
        controller = candidate;
        emit ControllerChanged(address(previous), address(candidate));
    }

    function _checkSuccessor(Controller candidate, bytes32 expectedRuntimeHash) private view {
        if (address(controller) == address(0)) revert Unbound();
        // A Turf fee recipient is a seasonal bridge whose source is bound once to this controller.
        // Reusing it would reject native fees from the successor; a new bridge cannot satisfy the
        // same-recipient check. Rotate Turf through a separately reviewed seasonal lane instead.
        if (tranche == Controller.Tranche.Turf) revert InvalidConfiguration();
        if (
            address(candidate) == address(controller) || address(candidate).code.length == 0
                || expectedRuntimeHash == bytes32(0) || address(candidate).codehash != expectedRuntimeHash
                || candidate.safe() != safe || address(candidate.omr()) != address(omr)
                || address(candidate.manager()) != address(controller.manager())
                || address(candidate.marketState()) != address(controller.marketState())
                || PoolId.unwrap(candidate.poolKey().toId()) != PoolId.unwrap(controller.poolKey().toId())
                || candidate.feeRecipients(uint256(tranche)) != controller.feeRecipients(uint256(tranche))
        ) {
            revert InvalidConfiguration();
        }
    }

    /// @notice Anyone can deliver pending assets, but cannot choose a recipient or amount.
    function flush() external nonReentrant {
        _flush();
    }

    function _flush() private {
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
