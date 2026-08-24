// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC4626} from "@openzeppelin/contracts/interfaces/IERC4626.sol";
import {Denari} from "../src/Denari.sol";
import {Transmuter} from "../src/Transmuter.sol";
import {Alchemist} from "../src/Alchemist.sol";

/// @notice Phase 2: deploy THE BANK against an existing denomination-matched asset and ERC-4626 vault.
/// @dev All authority is born at SAFE and every mint/redeem role remains unset after this script.
contract DeployBank is Script {
    function run() external returns (address denariAddress, address transmuterAddress, address alchemistAddress) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address safe = _requiredAddress("SAFE");
        address assetAddress = _requiredContract("BANK_ASSET");
        address vaultAddress = _requiredContract("BANK_ERC4626_VAULT");
        require(block.chainid == expectedChainId, "DeployBank: RPC chain id mismatch");

        IERC20 asset = IERC20(assetAddress);
        IERC4626 vault = IERC4626(vaultAddress);

        vm.startBroadcast();
        Denari denari = new Denari("Denari", "DNR", safe);
        Transmuter transmuter = new Transmuter(denari, asset, safe);
        Alchemist alchemist = new Alchemist(denari, asset, vault, transmuter, safe);
        vm.stopBroadcast();

        denariAddress = address(denari);
        transmuterAddress = address(transmuter);
        alchemistAddress = address(alchemist);

        console.log("Denari:      ", denariAddress);
        console.log("Transmuter:  ", transmuterAddress);
        console.log("Alchemist:   ", alchemistAddress);
        console.log("Bank roles are OFF. Configure caps, seed the buffer, and arm Denari from the Safe LAST.");
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployBank: zero ", key));
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = _requiredAddress(key);
        require(value.code.length != 0, string.concat("DeployBank: no code at ", key));
    }
}
