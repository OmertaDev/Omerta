// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

/// @notice Closed observation interface shared by the V2 market and funded strategy contracts.
/// @dev Prices are OMR base units per 1 ETH (18 decimals); a larger tick means cheaper OMR.
///      Consumers must validate valid, observedAt, epoch, and their own minimum liquidity policy.
interface IOmertaMarketStateV2 {
    struct Snapshot {
        uint64 epoch;
        uint64 observedAt;
        int24 meanTick;
        uint24 volatilityTicks;
        uint128 minLiquidity;
        uint256 omrPerEth;
        uint16 stressBps;
        uint16 sellImbalanceBps;
        bool valid;
    }

    function snapshot() external view returns (Snapshot memory);
}
