// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice A custody-backed liquidity floor. A fresh price is a separate requirement.
interface ILiquidityHealth {
    function healthy() external view returns (bool);
}
