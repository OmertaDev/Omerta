// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @notice The explicit non-mint policy accepted by OmertaFees. Getter checks bind configuration;
///         deployment must separately verify the router's reviewed runtime code.
interface IFeeRevenueRouter {
    function policyId() external view returns (bytes32);
    function feeContract() external view returns (address);
    function devRecipient() external view returns (address payable);
    function vigRecipient() external view returns (address payable);
    function treasuryRecipient() external view returns (address payable);
    function communityRecipient() external view returns (address payable);
    function devBps() external view returns (uint256);
    function vigBps() external view returns (uint256);
    function treasuryBps() external view returns (uint256);
    function communityBps() external view returns (uint256);
    function route(uint256 nonce) external payable;
}

/// @title FeeRevenueRouter — atomic distribution of respawn, reroll and store revenue.
/// @notice The bound OmertaFees rail sends one gross payment. Vig receives 25%, treasury 10%,
///         community 15%, and DEV the remaining 50% plus rounding dust. Mint fees never enter here.
///         There is no owner, parameter setter, approval or arbitrary-call facility. Any failed
///         recipient rolls back the complete fee payment, including both contracts' nonce state.
contract FeeRevenueRouter is IFeeRevenueRouter, ReentrancyGuard {
    bytes32 public constant policyId = keccak256("OMERTA_NON_MINT_FEE_ROUTER_V1_5000_2500_1000_1500");
    uint256 public constant devBps = 5000;
    uint256 public constant vigBps = 2500;
    uint256 public constant treasuryBps = 1000;
    uint256 public constant communityBps = 1500;

    address public immutable feeContract;
    address payable public immutable devRecipient;
    address payable public immutable vigRecipient;
    address payable public immutable treasuryRecipient;
    address payable public immutable communityRecipient;
    uint256 public lastNonce;

    event RevenueRouted(
        uint256 indexed nonce, uint256 gross,
        address dev, uint256 toDev, address vig, uint256 toVig,
        address treasury, uint256 toTreasury, address community, uint256 toCommunity
    );
    /// @dev Forced ETH is not a fee entitlement or fee revenue event.
    event ForcedETHRecovered(uint256 amount, address indexed treasury);

    error InvalidAddress();
    error NotFeeContract();
    error Replay();
    error ZeroAmount();
    error TransferFailed(address recipient);

    constructor(
        address feeContract_, address payable dev_, address payable vig_,
        address payable treasury_, address payable community_
    ) {
        if (feeContract_.code.length == 0) revert InvalidAddress();
        _checkRecipient(dev_, feeContract_);
        _checkRecipient(vig_, feeContract_);
        _checkRecipient(treasury_, feeContract_);
        _checkRecipient(community_, feeContract_);
        feeContract = feeContract_;
        devRecipient = dev_;
        vigRecipient = vig_;
        treasuryRecipient = treasury_;
        communityRecipient = community_;
    }

    function route(uint256 nonce) external payable nonReentrant {
        if (msg.sender != feeContract) revert NotFeeContract();
        if (nonce <= lastNonce) revert Replay();
        if (msg.value == 0) revert ZeroAmount();
        lastNonce = nonce;
        uint256 toVig = Math.mulDiv(msg.value, vigBps, 10000);
        uint256 toTreasury = Math.mulDiv(msg.value, treasuryBps, 10000);
        uint256 toCommunity = Math.mulDiv(msg.value, communityBps, 10000);
        uint256 toDev = msg.value - toVig - toTreasury - toCommunity;
        _send(vigRecipient, toVig);
        _send(treasuryRecipient, toTreasury);
        _send(communityRecipient, toCommunity);
        _send(devRecipient, toDev);
        emit RevenueRouted(nonce, msg.value, devRecipient, toDev, vigRecipient, toVig,
            treasuryRecipient, toTreasury, communityRecipient, toCommunity);
    }

    /// @notice Anyone may return force-sent ETH to the fixed treasury. Ordinary transfers revert;
    ///         this cannot redirect fees or consume an in-progress payment because of the guard.
    function recoverForcedETH() external nonReentrant {
        uint256 amount = address(this).balance;
        if (amount == 0) revert ZeroAmount();
        _send(treasuryRecipient, amount);
        emit ForcedETHRecovered(amount, treasuryRecipient);
    }

    function _checkRecipient(address recipient, address rail) private view {
        if (recipient == address(0) || recipient == address(this) || recipient == rail) revert InvalidAddress();
    }

    function _send(address payable recipient, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed(recipient);
    }
}
