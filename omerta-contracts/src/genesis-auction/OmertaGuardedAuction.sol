// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ContinuousClearingAuction} from "./vendor/cca/ContinuousClearingAuction.sol";
import {AuctionParameters} from "./vendor/cca/interfaces/IContinuousClearingAuction.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {GenesisCharacterBidValidation} from "./GenesisCharacterEligibility.sol";

interface IOmertaGenesisClaimGate {
    function playerClaimsOpen() external view returns (bool);
}

/// @notice Pinned CCA with a deployment-selected gate on both token claim paths.
/// @dev Deploy directly for the reviewed NFT-gated route. The existing external CCA factory does not
/// deploy this implementation. Bid exits and currency refunds retain upstream semantics.
contract OmertaGuardedAuction is ContinuousClearingAuction {
    IOmertaGenesisClaimGate public immutable launchGate;
    bytes32 public immutable launchGateCodeHash;
    uint256 public immutable launchChainId;
    IERC721 public immutable characterNft;
    uint128 public immutable minimumRaiseWei;

    error InvalidLaunchGate();
    error LaunchClaimsClosed();

    constructor(address token_, uint128 totalSupply_, AuctionParameters memory parameters_,
        IOmertaGenesisClaimGate gate_, IERC721 characterNft_)
        ContinuousClearingAuction(token_, totalSupply_, _withCharacterGate(parameters_, characterNft_, IERC20(token_)), address(0))
    {
        if (address(gate_).code.length == 0 || parameters_.fundsRecipient != address(gate_)
            || parameters_.currency != address(0) || parameters_.validationHook != address(0))
            revert InvalidLaunchGate();
        launchGate = gate_;
        launchGateCodeHash = address(gate_).codehash;
        launchChainId = block.chainid;
        characterNft = characterNft_;
        minimumRaiseWei = parameters_.requiredCurrencyRaised;
    }

    /// @dev Only the internally deployed ownership validator is accepted; callers cannot supply a permissive hook.
    function _withCharacterGate(AuctionParameters memory parameters_, IERC721 characterNft_, IERC20 token_)
        private returns (AuctionParameters memory gated)
    {
        if (parameters_.validationHook != address(0)) revert InvalidLaunchGate();
        // Copy explicitly: the constructor body must still validate the caller's original parameters.
        gated = AuctionParameters(parameters_.currency, parameters_.tokensRecipient, parameters_.fundsRecipient,
            parameters_.startBlock, parameters_.endBlock, parameters_.claimBlock, parameters_.tickSpacing,
            address(new GenesisCharacterBidValidation(characterNft_, token_)), parameters_.floorPrice,
            parameters_.requiredCurrencyRaised, parameters_.auctionStepsData);
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
