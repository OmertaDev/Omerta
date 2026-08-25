// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {OmrTwapOracle, IUniswapV2Factory, IUniswapV2Pair} from "../src/OmrTwapOracle.sol";
import {TestTwapWeth, TestFixedOmrV2Pair, TestFixedV2Factory} from "./testnet/TestTwapDependencies.sol";

/// @notice Robinhood Chain Testnet-only deployment of a virtual observation pair and OmrTwapOracle.
contract DeployTestnetTwap is Script {
    struct Deployment {
        TestTwapWeth testWeth;
        TestFixedOmrV2Pair testPair;
        TestFixedV2Factory testFactory;
        OmrTwapOracle oracle;
    }

    function run() external returns (Deployment memory d) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address safe = _requiredAddress("SAFE");
        address omr = _requiredContract("OMR_ADDRESS");
        uint256 period = vm.envUint("TWAP_PERIOD_SECONDS");

        require(expectedChainId == 46630, "DeployTestnetTwap: testnet only");
        require(block.chainid == expectedChainId, "DeployTestnetTwap: RPC chain id mismatch");
        require(period == 600, "DeployTestnetTwap: period must be 600");

        vm.startBroadcast();
        d.testWeth = new TestTwapWeth(safe);
        d.testPair = new TestFixedOmrV2Pair(omr, address(d.testWeth));
        d.testFactory = new TestFixedV2Factory(omr, address(d.testWeth), address(d.testPair));
        d.oracle = new OmrTwapOracle(
            safe,
            IUniswapV2Factory(address(d.testFactory)),
            IUniswapV2Pair(address(d.testPair)),
            omr,
            address(d.testWeth),
            uint32(period)
        );
        vm.stopBroadcast();

        console.log("TestTwapWeth:        ", address(d.testWeth));
        console.log("TestFixedOmrV2Pair:  ", address(d.testPair));
        console.log("TestFixedV2Factory:  ", address(d.testFactory));
        console.log("OmrTwapOracle:       ", address(d.oracle));
        console.log("TESTNET ONLY: virtual reserves, no AMM, no liquidity, and never wire this feed to OmertaBond.");
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployTestnetTwap: zero ", key));
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = _requiredAddress(key);
        require(value.code.length != 0, string.concat("DeployTestnetTwap: no code at ", key));
    }
}
