// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";

/// @notice The ERC-165 surface Uniswap Liquidity Launcher v3.1+ requires from a
///         nonzero hook selected as an LBP migration target.
/// @dev Interface-compatible with Uniswap/liquidity-launcher
///      src/interfaces/IInitializerHook.sol at v3.2.0.
interface IInitializerHook is IERC165 {
    /// @notice The singleton LBP strategy authorized to initialize pools using the hook.
    function authorized() external view returns (address);
}
