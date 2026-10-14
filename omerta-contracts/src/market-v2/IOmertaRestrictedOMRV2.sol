// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

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
    function isRecipient(address recipient) external view returns (bool);
    function registerWallet(address wallet) external;
}
