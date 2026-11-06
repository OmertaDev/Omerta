// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {GenesisPlayerSale, IGenesisPlayerIntegration} from "./GenesisPlayerSale.sol";
import {GenesisCharacterEligibility} from "./genesis-auction/GenesisCharacterEligibility.sol";

/// @notice Snapshot player tranche with character ownership required for fresh contributions.
/// @dev Ownership loss never prevents settlement, refunds or claims of an existing allocation.
contract GenesisCharacterPlayerSale is GenesisPlayerSale, GenesisCharacterEligibility {
    constructor(
        IERC20 token_, IGenesisPlayerIntegration integration_, bytes32 root_, uint256 inventory_,
        uint256 openDeadline_, uint256 migrationDeadline_, address unsoldRecipient_, IERC721 characterNft_
    )
        GenesisPlayerSale(token_, integration_, root_, inventory_, openDeadline_, migrationDeadline_, unsoldRecipient_)
        GenesisCharacterEligibility(characterNft_)
    {}

    function _validateContributor(address contributor) internal view override {
        _requireCharacter(contributor);
    }
}
