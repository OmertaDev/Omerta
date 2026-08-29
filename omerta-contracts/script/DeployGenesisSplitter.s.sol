// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {GenesisProceedsSplitter} from "../src/GenesisProceedsSplitter.sol";

/// @notice Deploy the ownerless residual/recovery recipient for the committed genesis pool.
/// @dev Foundry scripts only send when the operator explicitly adds `--broadcast`. Run without it
///      first and compare every printed value with the reviewed launch configuration.
contract DeployGenesisSplitter is Script {
    using PoolIdLibrary for PoolKey;

    uint24 internal constant POOL_FEE = 3_000;
    int24 internal constant POOL_TICK_SPACING = 60;

    function run() external returns (GenesisProceedsSplitter splitter) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address poolManager = _requiredContract("V4_POOL_MANAGER");
        address omr = _requiredContract("OMR_ADDRESS");
        address hook = _requiredContract("OMERTA_HOOK_ADDRESS");
        address payable treasury = payable(_requiredAddress("TREASURY_RECIPIENT"));
        address payable vig = payable(_requiredAddress("VIG_RECIPIENT"));
        address payable founder = payable(_requiredAddress("DEV_RECIPIENT"));

        require(block.chainid == expectedChainId, "DeployGenesisSplitter: RPC chain id mismatch");

        Currency native = Currency.wrap(address(0));
        Currency token = Currency.wrap(omr);
        PoolKey memory key = native < token
            ? PoolKey(native, token, POOL_FEE, POOL_TICK_SPACING, IHooks(hook))
            : PoolKey(token, native, POOL_FEE, POOL_TICK_SPACING, IHooks(hook));
        PoolId poolId = key.toId();

        console.logBytes32(PoolId.unwrap(poolId));
        console.log("Treasury:", treasury);
        console.log("Vig:     ", vig);
        console.log("Founder: ", founder);

        vm.startBroadcast();
        splitter = new GenesisProceedsSplitter(IPoolManager(poolManager), poolId, treasury, vig, founder);
        vm.stopBroadcast();

        require(address(splitter.poolManager()) == poolManager, "DeployGenesisSplitter: wrong PoolManager");
        require(
            PoolId.unwrap(splitter.canonicalPoolId()) == PoolId.unwrap(poolId), "DeployGenesisSplitter: wrong pool id"
        );
        require(splitter.treasuryRecipient() == treasury, "DeployGenesisSplitter: wrong treasury");
        require(splitter.vigRecipient() == vig, "DeployGenesisSplitter: wrong Vig");
        require(splitter.founderRecipient() == founder, "DeployGenesisSplitter: wrong founder");
        require(!splitter.canonicalPoolInitialized(), "DeployGenesisSplitter: pool already initialized");

        console.log("GenesisProceedsSplitter:", address(splitter));
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployGenesisSplitter: zero ", key));
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = _requiredAddress(key);
        require(value.code.length != 0, string.concat("DeployGenesisSplitter: no code at ", key));
    }
}
