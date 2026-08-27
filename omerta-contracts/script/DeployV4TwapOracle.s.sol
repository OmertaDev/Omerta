// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {OmrV4TwapOracle} from "../src/OmrV4TwapOracle.sol";
import {IOmrV4ObservationSource} from "../src/interfaces/IOmrV4ObservationSource.sol";

/// @notice Deploy the ownerless post-genesis oracle for the canonical native ETH/OMR v4 pool.
/// @dev Foundry sends only when the operator explicitly adds `--broadcast`. The pool must already
///      have migrated successfully; this script refuses an unopened or mismatched hook source.
contract DeployV4TwapOracle is Script {
    using PoolIdLibrary for PoolKey;

    uint24 internal constant POOL_FEE = 3_000;
    int24 internal constant POOL_TICK_SPACING = 60;

    function run() external returns (OmrV4TwapOracle oracle) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address omr = _requiredContract("OMR_ADDRESS");
        address hook = _requiredContract("OMERTA_HOOK_ADDRESS");
        address expectedPoolManager = _requiredContract("V4_POOL_MANAGER");
        uint256 period = vm.envUint("TWAP_PERIOD_SECONDS");

        require(block.chainid == expectedChainId, "DeployV4TwapOracle: RPC chain id mismatch");
        require(period <= type(uint32).max, "DeployV4TwapOracle: period overflows uint32");

        IOmrV4ObservationSource source = IOmrV4ObservationSource(hook);
        require(address(source.poolManager()) == expectedPoolManager, "DeployV4TwapOracle: wrong PoolManager");
        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(omr),
            fee: POOL_FEE,
            tickSpacing: POOL_TICK_SPACING,
            hooks: IHooks(hook)
        });
        PoolId expectedPoolId = key.toId();
        (,, bool initialized) = source.currentTickCumulative(expectedPoolId);
        require(initialized, "DeployV4TwapOracle: canonical pool is not initialized");

        console.logBytes32(PoolId.unwrap(expectedPoolId));
        console.log("Observation source:", hook);
        console.log("PoolManager:       ", expectedPoolManager);
        console.log("Period:            ", period);

        vm.startBroadcast();
        oracle = new OmrV4TwapOracle(source, omr, POOL_FEE, POOL_TICK_SPACING, uint32(period));
        vm.stopBroadcast();

        require(address(oracle.source()) == hook, "DeployV4TwapOracle: wrong source");
        require(address(oracle.poolManager()) == expectedPoolManager, "DeployV4TwapOracle: wrong manager");
        require(oracle.omr() == omr, "DeployV4TwapOracle: wrong OMR");
        require(PoolId.unwrap(oracle.poolId()) == PoolId.unwrap(expectedPoolId), "DeployV4TwapOracle: wrong pool id");
        require(oracle.PERIOD() == period, "DeployV4TwapOracle: wrong period");
        (uint256 price, uint256 updatedAt) = oracle.consult();
        require(price == 0 && updatedAt == 0, "DeployV4TwapOracle: fresh oracle published a price");

        console.log("OmrV4TwapOracle:", address(oracle));
        console.log("Next: Safe setObserver(oracle), wait one full period, then call update() and verify consult().");
        console.log("Keep OmertaBond paused/unset until the separate setOracle activation batch is approved.");
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployV4TwapOracle: zero ", key));
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = _requiredAddress(key);
        require(value.code.length != 0, string.concat("DeployV4TwapOracle: no code at ", key));
    }
}
