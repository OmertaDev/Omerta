// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IOmertaRestrictedOMRV2 is IERC20 {
    enum OperatorRole {
        None,
        SettlementInput,
        ProtocolCustody,
        SettlementManager
    }

    function settlementManager() external view returns (address);
    function policySealed() external view returns (bool);
    function isOperator(address operator) external view returns (bool);
    function operatorRole(address operator) external view returns (OperatorRole);
    function isRecipient(address recipient) external view returns (bool);
    function registerWallet(address wallet) external;
    function POLICY_UPDATE_DELAY() external view returns (uint64);
    function pendingPolicyUpdates() external view returns (uint256);
    function operatorProposal(address operator)
        external
        view
        returns (OperatorRole role, bytes32 runtimeHash, uint64 executableAt);
    function contractHolderProposal(address holder) external view returns (bytes32 runtimeHash, uint64 executableAt);
    function proposeOperator(address operator, OperatorRole role, bytes32 expectedRuntimeHash) external;
    function cancelOperatorProposal(address operator) external;
    function executeOperatorProposal(address operator) external;
    function proposeContractHolder(address holder, bytes32 expectedRuntimeHash) external;
    function cancelContractHolderProposal(address holder) external;
    function executeContractHolderProposal(address holder) external;
}
