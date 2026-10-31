// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

interface ISettlementDataFeeSource {
    function currentTransactionNativeDataFee() external view returns (uint256);
}
