// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Test-only replacement for Robinhood Chain's ArbSys block-number precompile.
/// @dev Anvil forks the chain state but does not emulate ArbSys at address(100). The exact pinned
///      CCA/LBP bytecode calls `arbBlockNumber()` through BlockNumberish, so the fork rehearsal
///      installs this runtime at address(100) and records its code hash in the evidence package.
///      This contract is never deployed or referenced by a production deployment script.
contract ForkArbSysShim {
    function arbBlockNumber() external view returns (uint256) {
        return block.number;
    }
}
