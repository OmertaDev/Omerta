// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ContinuousClearingAuction} from "./vendor/cca/ContinuousClearingAuction.sol";
import {AuctionParameters} from "./vendor/cca/interfaces/IContinuousClearingAuction.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IGenesisInventoryToken} from "../GenesisPlayerSale.sol";
import {IOmertaRestrictedOMRV2} from "../market-v2/IOmertaRestrictedOMRV2.sol";

interface IOmertaGenesisClaimGate {
    function playerClaimsOpen() external view returns (bool);
    function genesisBidsOpen() external view returns (bool);
}

/// @notice Pinned CCA with a common launch-success gate on both public token claim paths.
/// @dev Deploy directly for the guarded public launch. The existing external CCA factory does not
/// deploy this implementation. Bid exits and currency refunds retain upstream semantics.
contract OmertaGuardedAuction is ContinuousClearingAuction {
    using SafeERC20 for IERC20;
    IOmertaGenesisClaimGate public immutable launchGate;
    bytes32 public immutable launchGateCodeHash;
    uint256 public immutable launchChainId;
    bool public inventoryFunded;

    error InvalidLaunchGate();
    error LaunchClaimsClosed();
    error InvalidInventoryFunding();
    error UnsupportedBidOwner();
    error LaunchBidsClosed();
    event InventoryFunded(address indexed treasury, uint256 amount);

    constructor(address token_, uint128 totalSupply_, AuctionParameters memory parameters_,
        IOmertaGenesisClaimGate gate_)
        ContinuousClearingAuction(token_, totalSupply_, parameters_, address(0))
    {
        if (address(gate_).code.length == 0 || parameters_.fundsRecipient != address(gate_)
            || parameters_.currency != address(0) || parameters_.validationHook != address(0))
            revert InvalidLaunchGate();
        launchGate = gate_;
        launchGateCodeHash = address(gate_).codehash;
        launchChainId = block.chainid;
    }

    /// @notice Pull only the immutable auction inventory; no arbitrary treasury transfers are exposed.
    function fundInventory() external nonReentrant {
        IGenesisInventoryToken policy = IGenesisInventoryToken(address(TOKEN));
        address source = policy.genesisTreasury();
        if (msg.sender != source || !policy.policySealed() || inventoryFunded
            || block.chainid != launchChainId || _getBlockNumberish() >= START_BLOCK
            || address(launchGate).codehash != launchGateCodeHash) revert InvalidInventoryFunding();
        inventoryFunded = true;
        uint256 beforeBalance = TOKEN.balanceOf(address(this));
        IERC20(address(TOKEN)).safeTransferFrom(source, address(this), TOTAL_SUPPLY);
        if (TOKEN.balanceOf(address(this)) - beforeBalance != TOTAL_SUPPLY) revert InvalidInventoryFunding();
        this.onTokensReceived();
        emit InventoryFunded(source, TOTAL_SUPPLY);
    }

    /// @notice Native auction-clock cliff; coordinator uses this without replacing the chain clock.
    function claimsReady() external view returns (bool) {
        return _getBlockNumberish() >= CLAIM_BLOCK;
    }

    function blockNumberish() external view returns (uint256) {
        return _getBlockNumberish();
    }

    /// @notice Actual upstream activation state, including inventory notified without the pull helper.
    function tokensReceived() external view returns (bool) {
        return $_tokensReceived;
    }

    function _validateBidOwner(address owner) internal view override {
        if (block.chainid != launchChainId || address(launchGate).codehash != launchGateCodeHash
            || !launchGate.genesisBidsOpen()) revert LaunchBidsClosed();
        if (!IOmertaRestrictedOMRV2(address(TOKEN)).isRecipient(owner)) revert UnsupportedBidOwner();
    }

    function _internalClaimTokens(uint256 bidId)
        internal override returns (address owner, uint256 tokensFilled)
    {
        if (block.chainid != launchChainId || address(launchGate).codehash != launchGateCodeHash
            || !launchGate.playerClaimsOpen()) revert LaunchClaimsClosed();
        return super._internalClaimTokens(bidId);
    }
}
