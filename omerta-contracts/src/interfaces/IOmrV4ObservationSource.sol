// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId} from "v4-core/types/PoolId.sol";

/// @notice The immutable v4 hook surface consumed by the OMR bond oracle.
/// @dev The hook integrates tick over time on every successful swap. An oracle may therefore sample
///      this cumulative lazily without losing price changes between keeper calls.
interface IOmrV4ObservationSource {
    function poolManager() external view returns (IPoolManager);

    function currentTickCumulative(PoolId poolId)
        external
        view
        returns (int56 tickCumulative, uint32 blockTimestamp, bool initialized);
}
