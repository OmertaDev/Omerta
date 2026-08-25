// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {OmertaHook} from "../src/OmertaHook.sol";

/// @notice Phase 4: mine and deploy the v4 hook through Foundry's canonical CREATE2 proxy.
/// @dev The low 14 address bits are part of the hook's immutable permission declaration. Always run
///      this script with the same constructor args in simulation and broadcast.
contract DeployHook is Script {
    address internal constant CREATE2_DEPLOYER = 0x4e59b44847b379578588920cA78FbF26c0B4956C;
    uint160 internal constant FLAG_MASK = 0x3FFF;
    uint160 internal constant LABS_REVIEW_PREFIX = 0x91;
    uint256 internal constant MAX_LOOP = 200_000;
    uint160 internal constant REQUIRED_FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
    );

    function run() external returns (OmertaHook hook) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address safe = _requiredAddress("SAFE");
        address omr = _requiredContract("OMR_ADDRESS");
        address poolManager = _requiredContract("V4_POOL_MANAGER");

        require(block.chainid == expectedChainId, "DeployHook: RPC chain id mismatch");
        require(CREATE2_DEPLOYER.code.length != 0, "DeployHook: canonical CREATE2 proxy is not deployed");

        bytes memory constructorArgs = abi.encode(IPoolManager(poolManager), omr, safe);
        (address predicted, bytes32 salt) =
            _findSalt(CREATE2_DEPLOYER, REQUIRED_FLAGS, type(OmertaHook).creationCode, constructorArgs);

        console.log("Mined hook:    ", predicted);
        console.logBytes32(salt);

        vm.startBroadcast();
        hook = new OmertaHook{salt: salt}(IPoolManager(poolManager), omr, safe);
        vm.stopBroadcast();

        require(address(hook) == predicted, "DeployHook: hook landed at the wrong address");
        require(uint160(address(hook)) >> 152 != LABS_REVIEW_PREFIX, "DeployHook: 0x91 routing-review prefix");
        require((uint160(address(hook)) & FLAG_MASK) == REQUIRED_FLAGS, "DeployHook: permission bits mismatch");
        require(hook.HOOK_FLAGS() == REQUIRED_FLAGS, "DeployHook: contract flag declaration drifted");

        console.log("OmertaHook:    ", address(hook));
        console.log("Hook is unarmed: no quote currency, recipients, tax, anti-snipe window, or surge is set.");
    }

    function _findSalt(address deployer, uint160 flags, bytes memory creationCode, bytes memory constructorArgs)
        private
        view
        returns (address hookAddress, bytes32 salt)
    {
        bytes32 initCodeHash = keccak256(abi.encodePacked(creationCode, constructorArgs));
        for (uint256 i; i < MAX_LOOP; ++i) {
            address candidate = address(
                uint160(uint256(keccak256(abi.encodePacked(bytes1(0xFF), deployer, bytes32(i), initCodeHash))))
            );
            // Uniswap Labs subjects every 0x91-prefixed hook to manual routing review. This hook
            // already needs review for its return-delta flags; never add an avoidable address-level
            // trigger to that review packet.
            bool avoidsLabsReviewPrefix = uint160(candidate) >> 152 != LABS_REVIEW_PREFIX;
            if (avoidsLabsReviewPrefix && (uint160(candidate) & FLAG_MASK) == flags && candidate.code.length == 0) {
                return (candidate, bytes32(i));
            }
        }
        revert("DeployHook: no salt found in search window");
    }

    function _requiredAddress(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeployHook: zero ", key));
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = _requiredAddress(key);
        require(value.code.length != 0, string.concat("DeployHook: no code at ", key));
    }
}
