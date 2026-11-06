// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IPositionDescriptor} from "../../lib/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IPositionManager} from "../../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PositionInfo, PositionInfoLibrary} from "../../lib/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {Base64} from "@openzeppelin/contracts/utils/Base64.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice LP metadata reads the same immutable custom manager used by PositionManager.
contract OmertaPositionDescriptorV2 is IPositionDescriptor {
    using PositionInfoLibrary for PositionInfo;
    IPoolManager public immutable poolManager;
    address public immutable wrappedNative;
    error BadConfiguration();

    constructor(IPoolManager manager, address wrappedNative_) {
        if (address(manager) == address(0) || wrappedNative_ == address(0)) revert BadConfiguration();
        poolManager = manager;
        wrappedNative = wrappedNative_;
    }

    function nativeCurrencyLabel() external pure returns (string memory) { return "ETH"; }

    function currencyRatioPriority(address currency) public view returns (int256) {
        return currency == address(0) || currency == wrappedNative ? int256(1) : int256(0);
    }

    function flipRatio(address currency0, address currency1) external view returns (bool) {
        return currencyRatioPriority(currency0) > currencyRatioPriority(currency1);
    }

    function tokenURI(IPositionManager positions, uint256 tokenId) external view returns (string memory) {
        if (address(positions.poolManager()) != address(poolManager)) revert BadConfiguration();
        (PoolKey memory key, PositionInfo info) = positions.getPoolAndPositionInfo(tokenId);
        if (info.poolId() == bytes25(0)) revert InvalidTokenId(tokenId);
        // All inserted values are generated addresses or numbers; no untrusted JSON text is accepted.
        return string.concat("data:application/json;base64,", Base64.encode(bytes(string.concat(
            '{"name":"OMERTA Liquidity Position #', Strings.toString(tokenId),
            '","description":"Robinhood Chain liquidity position managed by ',
            Strings.toHexString(address(poolManager)),
            '. Principal and fees are controlled by the NFT owner.","attributes":[{"trait_type":"Chain ID","value":',
            Strings.toString(block.chainid), '},{"trait_type":"Pool Fee","value":',
            Strings.toString(key.fee), '},{"trait_type":"Lower Tick","value":',
            Strings.toStringSigned(info.tickLower()), '},{"trait_type":"Upper Tick","value":',
            Strings.toStringSigned(info.tickUpper()), '}]}'
        ))));
    }
}
