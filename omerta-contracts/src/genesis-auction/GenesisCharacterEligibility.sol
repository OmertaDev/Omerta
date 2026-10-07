// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
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
    IERC20 public immutable omr;
    bytes32 public immutable omrCodeHash;
    uint256 public immutable approvedSupply;
    error InvalidAuctionSupply();
    error AuctionSupplyChanged();

    constructor(IERC721 characterNft_, IERC20 token_) GenesisCharacterEligibility(characterNft_) {
        if (address(token_).code.length == 0) revert InvalidAuctionSupply();
        uint256 supply = token_.totalSupply();
        if (supply == 0) revert InvalidAuctionSupply();
        omr = token_; omrCodeHash = address(token_).codehash; approvedSupply = supply;
    }

    function validate(uint256, uint128, address owner, address, bytes calldata) external view {
        if (address(omr).codehash != omrCodeHash || omr.totalSupply() != approvedSupply)
            revert AuctionSupplyChanged();
        _requireCharacter(owner);
    }
}
