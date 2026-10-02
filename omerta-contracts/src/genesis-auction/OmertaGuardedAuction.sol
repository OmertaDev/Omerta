// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ContinuousClearingAuction} from "./vendor/cca/ContinuousClearingAuction.sol";
import {AuctionParameters} from "./vendor/cca/interfaces/IContinuousClearingAuction.sol";

interface IOmertaGenesisClaimGate {
    function playerClaimsOpen() external view returns (bool);
}

/// @notice Pinned CCA with a common launch-success gate on both public token claim paths.
/// @dev Deploy directly for the player-first route. The existing external CCA factory does not
/// deploy this implementation. Bid exits and currency refunds retain upstream semantics.
contract OmertaGuardedAuction is ContinuousClearingAuction {
    IOmertaGenesisClaimGate public immutable launchGate;
    bytes32 public immutable launchGateCodeHash;
    uint256 public immutable launchChainId;

    error InvalidLaunchGate();
    error LaunchClaimsClosed();

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

    /// @notice Native auction-clock cliff; coordinator uses this without replacing the chain clock.
    function claimsReady() external view returns (bool) {
        return _getBlockNumberish() >= CLAIM_BLOCK;
    }

    function blockNumberish() external view returns (uint256) {
        return _getBlockNumberish();
    }

    function _internalClaimTokens(uint256 bidId)
        internal override returns (address owner, uint256 tokensFilled)
    {
        if (block.chainid != launchChainId || address(launchGate).codehash != launchGateCodeHash
            || !launchGate.playerClaimsOpen()) revert LaunchClaimsClosed();
        return super._internalClaimTokens(bidId);
    }
}
