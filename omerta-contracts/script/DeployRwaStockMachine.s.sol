// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {StockTokenRegistry} from "../src/StockTokenRegistry.sol";
import {RwaStockBuyer} from "../src/RwaStockBuyer.sol";

/// @notice Additive deployment for the RWA Stock Machine. Both automation keys, the venue adapter,
///         and the independent quote oracle are OFF at birth; the Safe verifies bytecode/catalog/limits, then arms them in a reviewed
///         batch. This avoids coupling the RWA venue to the core-contract deployment ceremony.
contract DeployRwaStockMachine is Script {
    function run() external returns (address registryAddress, address buyerAddress) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address safe = _requiredContract("SAFE");
        address stockVault = _requiredContract("STOCK_VAULT_ADDRESS");
        uint256 dailyCap = vm.envUint("RWA_BUYER_DAILY_CAP_WEI");

        require(block.chainid == expectedChainId, "DeployRwa: RPC chain id != EXPECTED_CHAIN_ID");
        require(expectedChainId == 4663 || expectedChainId == 46630, "DeployRwa: Robinhood Chain only");
        require(dailyCap > 0, "DeployRwa: daily cap must be nonzero");

        vm.startBroadcast();
        StockTokenRegistry registry = new StockTokenRegistry(safe, address(0));
        RwaStockBuyer buyer = new RwaStockBuyer(
            safe,
            address(0), // buy keeper OFF
            address(registry),
            address(0), // venue adapter OFF
            stockVault,
            dailyCap
        );
        vm.stopBroadcast();

        registryAddress = address(registry);
        buyerAddress = address(buyer);
        console.log("StockTokenRegistry:", registryAddress);
        console.log("RwaStockBuyer:     ", buyerAddress);
        console.log("Publisher, buy keeper, venue adapter, and quote oracle remain OFF pending the Safe ceremony.");
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployRwa: zero ", key));
        require(value.code.length != 0, string.concat("DeployRwa: no code at ", key));
    }
}
