// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {OmertaHookV2} from "./OmertaHookV2.sol";
import {IOmertaMarketStateV2} from "./IOmertaMarketStateV2.sol";

/// @notice Permissionless finalized-epoch market measurements, deliberately outside swap settlement.
/// @dev A snapshot summarizes a complete FIXED interval, never the current partially observed one.
///      Refresh spam cannot accelerate epoch progression. Time-weighted tick variance is price
///      dispersion, not a statistical forecast; volume imbalance can be wash traded and is only a
///      bounded risk signal. Raw active liquidity minimum is a prerequisite, not executable depth.
contract OmertaMarketStateV2 is IOmertaMarketStateV2 {
    OmertaHookV2 public immutable source;
    uint128 public immutable requiredLiquidity;
    uint64 public immutable maxAge;
    uint24 public immutable fullStressTicks;
    Snapshot private _snapshot;

    error InvalidConfiguration();
    event Updated(uint64 indexed epoch, int24 meanTick, uint24 volatilityTicks, uint16 stressBps, bool valid);

    constructor(OmertaHookV2 source_, uint128 requiredLiquidity_, uint64 maxAge_, uint24 fullStressTicks_) {
        if (address(source_) == address(0) || requiredLiquidity_ == 0 || fullStressTicks_ == 0
            || fullStressTicks_ > 100_000 || maxAge_ < source_.epochDuration() || maxAge_ > 7 days) {
            revert InvalidConfiguration();
        }
        source = source_;
        requiredLiquidity = requiredLiquidity_;
        maxAge = maxAge_;
        fullStressTicks = fullStressTicks_;
    }

    function refresh() external returns (Snapshot memory reading) {
        source.checkpoint();
        OmertaHookV2.Epoch memory e = source.latestEpoch();
        if (e.end == 0 || (_snapshot.observedAt != 0 && e.id <= _snapshot.epoch)) return snapshot();
        reading.epoch = e.id;
        reading.observedAt = e.end;
        reading.minLiquidity = e.minLiquidity;
        if (e.observedSeconds == source.epochDuration() && e.minLiquidity >= requiredLiquidity
            && e.end <= block.timestamp && block.timestamp - e.end <= maxAge) {
            int256 denom = int256(uint256(e.observedSeconds));
            int256 mean = int256(e.tickSeconds) / denom;
            if (e.tickSeconds < 0 && int256(e.tickSeconds) % denom != 0) --mean;
            reading.meanTick = int24(mean);
            // E[(tick - floor(mean))^2] avoids a negative variance caused by signed mean rounding.
            int256 varianceNumerator = int256(uint256(e.tickSquaredSeconds)) - 2 * mean * int256(e.tickSeconds)
                + mean * mean * denom;
            reading.volatilityTicks = uint24(Math.sqrt(uint256(varianceNumerator / denom)));
            uint256 sqrtPrice = TickMath.getSqrtPriceAtTick(reading.meanTick);
            reading.omrPerEth = Math.mulDiv(sqrtPrice, sqrtPrice * 1e18, uint256(1) << 192);
            uint256 volume = uint256(e.buyQuote) + e.sellQuote;
            if (e.sellQuote > e.buyQuote && volume > 0) {
                // A single dust sell must not declare a crisis. Scale directional imbalance by
                // turnover against 1% of minimum virtual ETH depth at the mean price. This is a
                // bounded flow-intensity signal, not actual executable depth through price ranges.
                uint256 virtualQuote = Math.mulDiv(e.minLiquidity, uint256(1) << 96, sqrtPrice);
                uint256 meaningfulVolume = Math.max(virtualQuote / 100, 1);
                uint256 imbalance = (uint256(e.sellQuote) - e.buyQuote) * 10_000 / volume;
                reading.sellImbalanceBps = uint16(Math.mulDiv(imbalance, Math.min(volume, meaningfulVolume), meaningfulVolume));
            }
            uint256 volatilityStress = uint256(reading.volatilityTicks) * 10_000 / fullStressTicks;
            uint256 stress = Math.max(volatilityStress, reading.sellImbalanceBps);
            reading.stressBps = uint16(Math.min(stress, 10_000));
            reading.valid = reading.omrPerEth > 0;
        }
        _snapshot = reading;
        emit Updated(reading.epoch, reading.meanTick, reading.volatilityTicks, reading.stressBps, reading.valid);
    }

    function snapshot() public view returns (Snapshot memory reading) {
        reading = _snapshot;
        if (reading.observedAt == 0 || reading.observedAt > block.timestamp
            || block.timestamp - reading.observedAt > maxAge) reading.valid = false;
    }
}
