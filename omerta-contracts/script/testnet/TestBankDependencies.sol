// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";

/// @notice Fixed-supply, testnet-only USD-shaped asset for the Bank deployment rehearsal.
/// @dev This is not a faucet, production stablecoin, or mainnet deployment candidate.
contract TestBankAsset is ERC20 {
    constructor(address recipient, uint256 initialSupply) ERC20("Test Bank USD", "tbUSD") {
        require(block.chainid == 46630, "TestBankAsset: testnet only");
        require(recipient != address(0) && initialSupply != 0, "TestBankAsset: bad genesis");
        _mint(recipient, initialSupply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}

/// @notice Standard testnet-only ERC-4626 vault denominated in TestBankAsset.
/// @dev It has no synthetic yield controls; this deployment proves Bank wiring, not a yield strategy.
contract TestBankVault is ERC4626 {
    constructor(IERC20 asset_) ERC20("Vault Test Bank USD", "vtbUSD") ERC4626(asset_) {
        require(block.chainid == 46630, "TestBankVault: testnet only");
    }
}
