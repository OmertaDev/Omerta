// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IAcquisitionIntentExecutionV2 {
    struct IntentIdentityInput {
        uint256 ballotDay;
        bytes32 assetVersionKey;
    }

    struct AttemptIdentityInput {
        uint256 operatorGeneration;
        uint256 attemptIndex;
        bytes32 intentId;
        address adapter;
        bytes32 runtimeCodeHash;
        bytes32 routeHash;
    }

    struct ImmutableIntentCommitment {
        bytes32 intentId;
        bytes32 budgetId;
        uint256 ballotDay;
        bytes32 assetVersionKey;
        address token;
        uint8 tokenDecimals;
        uint256 maxEthWei;
        uint64 purchaseUntil;
        uint256 ingressGeneration;
        bytes32 oracleCommitment;
        uint256 minimumOutput;
        address adapter;
        bytes32 adapterRuntimeCodeHash;
        bytes32 routeHash;
    }
}
