// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IValidationHook} from "./vendor/cca/interfaces/IValidationHook.sol";

/// @notice Ownership is required when purchasing, never when recovering an existing position.
abstract contract GenesisCharacterEligibility {
    IERC721 public immutable characterNft;
    bytes32 public immutable characterNftCodeHash;
    uint256 public immutable eligibilityChainId;

    error InvalidCharacterNft();
    error CharacterNftRequired();

    constructor(IERC721 characterNft_) {
        if (address(characterNft_).code.length == 0) revert InvalidCharacterNft();
        characterNft = characterNft_;
        characterNftCodeHash = address(characterNft_).codehash;
        eligibilityChainId = block.chainid;
    }

    function _requireCharacter(address recipient) internal view {
        if (block.chainid != eligibilityChainId
            || address(characterNft).codehash != characterNftCodeHash
            || recipient == address(0) || characterNft.balanceOf(recipient) == 0) {
            revert CharacterNftRequired();
        }
    }
}

/// @notice The auction validates the token recipient, allowing wallet relayers without bypassing ownership.
contract GenesisCharacterBidValidation is GenesisCharacterEligibility, IValidationHook {
    constructor(IERC721 characterNft_) GenesisCharacterEligibility(characterNft_) {}

    function validate(uint256, uint128, address owner, address, bytes calldata) external view {
        _requireCharacter(owner);
    }
}
