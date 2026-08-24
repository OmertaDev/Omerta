// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {OmrTwapOracle, IUniswapV2Pair} from "../src/OmrTwapOracle.sol";

/// @notice Phase 3: deploy the normal-operation oracle after the OMR/WETH V2-compatible pair exists.
contract DeployTwapOracle is Script {
    function run() external returns (OmrTwapOracle oracle) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address safe = _requiredAddress("SAFE");
        address omr = _requiredContract("OMR_ADDRESS");
        address pair = _requiredContract("OMR_V2_PAIR");
        uint256 period = vm.envUint("TWAP_PERIOD_SECONDS");

        require(block.chainid == expectedChainId, "DeployTwapOracle: RPC chain id mismatch");
        require(period <= type(uint32).max, "DeployTwapOracle: period overflows uint32");

        vm.startBroadcast();
        oracle = new OmrTwapOracle(safe, IUniswapV2Pair(pair), omr, uint32(period));
        vm.stopBroadcast();

        console.log("OmrTwapOracle:", address(oracle));
        console.log("Wait one full TWAP period, call update(), verify consult(), then use the Safe to setOracle().");
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployTwapOracle: zero ", key));
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = _requiredAddress(key);
        require(value.code.length != 0, string.concat("DeployTwapOracle: no code at ", key));
    }
}
