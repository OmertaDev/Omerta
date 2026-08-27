// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

contract PreVoteBudgetBook {
    error BudgetBookFactoryZero();
    error BudgetBookManifestHashZero();
    error BudgetBookFinalizerUnauthorized(address caller);
    error BudgetBookManifestHashMismatch(bytes32 expected, bytes32 actual);
    error BudgetBookAlreadyFinalized();
    event BudgetBookFinalized(bytes32 indexed manifestHash);
    address private immutable _factory;
    bytes32 private immutable _manifestHash;
    bool private _finalized;

    constructor(address factory, bytes32 manifestHash) {
        if (factory == address(0)) revert BudgetBookFactoryZero();
        if (manifestHash == bytes32(0)) revert BudgetBookManifestHashZero();
        _factory = factory;
        _manifestHash = manifestHash;
    }

    function budgetBookTopology() external view returns (address factory, bytes32 manifestHash, bool finalized) {
        return (_factory, _manifestHash, _finalized);
    }

    function finalizeBudgetBook(bytes32 manifestHash) external {
        if (msg.sender != _factory) revert BudgetBookFinalizerUnauthorized(msg.sender);
        if (manifestHash != _manifestHash) revert BudgetBookManifestHashMismatch(_manifestHash, manifestHash);
        if (_finalized) revert BudgetBookAlreadyFinalized();
        _finalized = true;
        emit BudgetBookFinalized(_manifestHash);
    }
}
