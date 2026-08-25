// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Script, console} from "forge-std/Script.sol";

interface ISafeProxyFactory {
    function createProxyWithNonce(address singleton, bytes calldata initializer, uint256 saltNonce)
        external
        returns (address proxy);
}

interface ISafe {
    function setup(
        address[] calldata owners,
        uint256 threshold,
        address to,
        bytes calldata data,
        address fallbackHandler,
        address paymentToken,
        uint256 payment,
        address payable paymentReceiver
    ) external;

    function VERSION() external view returns (string memory);
    function getOwners() external view returns (address[] memory);
    function getThreshold() external view returns (uint256);
    function nonce() external view returns (uint256);
}

/// @notice Phase 0: deploy a fresh Safe v1.4.1 proxy through the canonical Safe proxy factory.
/// @dev SAFE_OWNERS is a comma-delimited list of public addresses. No private key belongs in .env.
contract DeploySafe is Script {
    bytes32 internal constant EXPECTED_VERSION_HASH = keccak256("1.4.1");

    function run() external returns (address safeAddress) {
        uint256 expectedChainId = vm.envUint("EXPECTED_CHAIN_ID");
        address singleton = _requiredContract("SAFE_SINGLETON");
        address factory = _requiredContract("SAFE_PROXY_FACTORY");
        address fallbackHandler = _requiredContract("SAFE_FALLBACK_HANDLER");
        address[] memory owners = vm.envAddress("SAFE_OWNERS", ",");
        uint256 threshold = vm.envUint("SAFE_THRESHOLD");
        uint256 saltNonce = vm.envUint("SAFE_SALT_NONCE");

        require(block.chainid == expectedChainId, "DeploySafe: RPC chain id mismatch");
        require(owners.length != 0, "DeploySafe: no owners");
        require(threshold != 0 && threshold <= owners.length, "DeploySafe: bad threshold");
        require(saltNonce != 0, "DeploySafe: SAFE_SALT_NONCE must be nonzero");
        _validateOwners(owners);

        bytes memory initializer = abi.encodeCall(
            ISafe.setup, (owners, threshold, address(0), bytes(""), fallbackHandler, address(0), 0, payable(address(0)))
        );

        vm.startBroadcast();
        safeAddress = ISafeProxyFactory(factory).createProxyWithNonce(singleton, initializer, saltNonce);
        vm.stopBroadcast();

        require(safeAddress.code.length != 0, "DeploySafe: proxy has no code");
        ISafe safe = ISafe(safeAddress);
        require(keccak256(bytes(safe.VERSION())) == EXPECTED_VERSION_HASH, "DeploySafe: wrong Safe version");
        require(safe.getThreshold() == threshold, "DeploySafe: threshold mismatch");
        require(safe.nonce() == 0, "DeploySafe: unexpected initial nonce");

        address[] memory deployedOwners = safe.getOwners();
        require(deployedOwners.length == owners.length, "DeploySafe: owner count mismatch");
        for (uint256 i; i < owners.length; ++i) {
            require(deployedOwners[i] == owners[i], "DeploySafe: owner mismatch");
        }

        console.log("Safe v1.4.1: ", safeAddress);
        console.log("Owner count:  ", owners.length);
        console.log("Threshold:    ", threshold);
        console.log("Record this address as SAFE, fund it only after explorer verification, then deploy Phase 1.");
    }

    function _validateOwners(address[] memory owners) private pure {
        for (uint256 i; i < owners.length; ++i) {
            require(owners[i] != address(0), "DeploySafe: zero owner");
            for (uint256 j; j < i; ++j) {
                require(owners[i] != owners[j], "DeploySafe: duplicate owner");
            }
        }
    }

    function _requiredContract(string memory key) private view returns (address value) {
        value = vm.envAddress(key);
        require(value != address(0), string.concat("DeploySafe: zero ", key));
        require(value.code.length != 0, string.concat("DeploySafe: no code at ", key));
    }
}
