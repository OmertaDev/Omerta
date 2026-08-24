// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {OmrTwapOracle} from "../src/OmrTwapOracle.sol";

/// @notice Closes the first fixed-price TWAP window in the Robinhood Chain Testnet rehearsal.
contract UpdateTestnetTwap is Script {
    function run() external returns (uint256 price, uint256 updatedAt) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address oracleAddress = vm.envAddress("TWAP_ORACLE");
        uint256 expectedPrice = vm.envUint("EXPECTED_TWAP_PRICE_OMR_PER_ETH_WEI");

        require(expectedChainId == 46630, "UpdateTestnetTwap: testnet only");
        require(block.chainid == expectedChainId, "UpdateTestnetTwap: RPC chain id mismatch");
        require(oracleAddress.code.length != 0, "UpdateTestnetTwap: oracle has no code");
        require(expectedPrice == 5_000 ether, "UpdateTestnetTwap: unexpected fixed price");

        OmrTwapOracle oracle = OmrTwapOracle(oracleAddress);
        require(oracle.PERIOD() == 600, "UpdateTestnetTwap: unexpected period");
        require(oracle.lastUpdate() == 0, "UpdateTestnetTwap: first window already closed");

        vm.startBroadcast();
        oracle.update();
        vm.stopBroadcast();

        (price, updatedAt) = oracle.consult();
        require(price == expectedPrice, "UpdateTestnetTwap: wrong fixed price");
        require(updatedAt == block.timestamp, "UpdateTestnetTwap: wrong update timestamp");

        console.log("OmrTwapOracle:       ", oracleAddress);
        console.log("OMR per ETH (wei):   ", price);
        console.log("Updated at:          ", updatedAt);
        console.log("TESTNET ONLY: do not wire this virtual feed to OmertaBond.");
    }
}
