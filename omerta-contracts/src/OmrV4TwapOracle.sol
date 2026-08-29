// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {IOmrOracle} from "./IOmrOracle.sol";
import {IOmrHookObserver} from "./OmertaHook.sol";
import {IOmrV4ObservationSource} from "./interfaces/IOmrV4ObservationSource.sol";

/// @title OmrV4TwapOracle — a geometric TWAP for the canonical native ETH/OMR Uniswap v4 pool.
///
/// @notice Feeds the unchanged `IOmrOracle` surface consumed by OmertaBond. Uniswap v4's
///         PoolManager exposes current slot0 state but does not maintain the v2/v3 historical
///         observation series the bond mint wall needs. The canonical OmertaHook therefore keeps a
///         minimal tick-time accumulator on every successful swap; this contract closes bounded
///         windows over that cumulative and converts the arithmetic mean tick into OMR per ETH.
///
///         MISSED POKES DO NOT LOSE THE PRICE PATH. Keeper calls only decide when a completed window
///         is published. Every swap updates the source accumulator, and quiet time is brought forward
///         counterfactually at read time. A keeper outage makes the oracle stale; it cannot make a
///         spot price masquerade as a TWAP.
///
///         BOTH SIDES OF THE WINDOW ARE BOUNDED. A call before `PERIOD` reverts (or no-ops when it
///         arrives through the hook's observer seam). A call after `PERIOD * MAX_WINDOW_MULT`
///         discards the obsolete interval, clears the public reading, and re-baselines. Recovery is
///         one honest window. This is the same fail-closed policy as OmrTwapOracle's audited V2 path.
///
///         The result is a geometric time-weighted mean, the standard tick-cumulative construction:
///         ticks are logarithms of price, so averaging tick and converting once yields geometric
///         rather than arithmetic mean price. OMR and native ETH both use 18 decimals, making the
///         v4 currency1/currency0 raw-unit ratio exactly OMR-wei per ETH-wei.
contract OmrV4TwapOracle is IOmrOracle, IOmrHookObserver {
    using PoolIdLibrary for PoolKey;

    uint32 public immutable PERIOD;
    uint32 public constant MIN_PERIOD = 10 minutes;
    uint32 public constant MAX_WINDOW_MULT = 4;

    IOmrV4ObservationSource public immutable source;
    IPoolManager public immutable poolManager;
    address public immutable omr;
    uint24 public immutable fee;
    int24 public immutable tickSpacing;
    PoolId public immutable poolId;

    // These three values pack into one slot. The cumulative and timestamp deliberately follow the
    // v3 int56/uint32 wrapping convention; their differences remain correct across timestamp wrap.
    int56 public tickCumulativeLast;
    uint32 public blockTimestampLast;
    int24 public arithmeticMeanTick;

    uint256 public priceAverage;
    uint256 public lastUpdate;

    event Updated(int24 arithmeticMeanTick, uint256 omrPerEth, uint32 timeElapsed);
    event Rebaselined(uint32 discardedWindow);
    event Invalidated(int24 arithmeticMeanTick);

    error PeriodTooShort();
    error PeriodNotElapsed(uint32 elapsed, uint32 required);
    error ZeroAddress();
    error ContractRequired(address target);
    error UnsupportedObservationSource();
    error UnsupportedTokenDecimals(address token, uint8 decimals);
    error PoolNotInitialized();
    error WrongPool();
    error NotObservationSource();

    /// @param source_ the exact OmertaHook used by the canonical v4 pool
    /// @param omr_ OMR; native ETH is fixed as currency0 and OMR as currency1
    /// @param fee_ the canonical pool fee committed by the launch configuration
    /// @param tickSpacing_ the canonical pool tick spacing committed by the launch configuration
    /// @param period_ minimum number of chain seconds in one published observation window
    constructor(IOmrV4ObservationSource source_, address omr_, uint24 fee_, int24 tickSpacing_, uint32 period_) {
        if (address(source_) == address(0) || omr_ == address(0)) revert ZeroAddress();
        if (address(source_).code.length == 0) revert ContractRequired(address(source_));
        if (omr_.code.length == 0) revert ContractRequired(omr_);
        if (period_ < MIN_PERIOD) revert PeriodTooShort();
        if (!IERC165(address(source_)).supportsInterface(type(IOmrV4ObservationSource).interfaceId)) {
            revert UnsupportedObservationSource();
        }

        IPoolManager poolManager_ = source_.poolManager();
        if (address(poolManager_) == address(0)) revert ZeroAddress();
        if (address(poolManager_).code.length == 0) revert ContractRequired(address(poolManager_));

        uint8 omrDecimals = IERC20Metadata(omr_).decimals();
        if (omrDecimals != 18) revert UnsupportedTokenDecimals(omr_, omrDecimals);

        PoolKey memory key = PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(omr_),
            fee: fee_,
            tickSpacing: tickSpacing_,
            hooks: IHooks(address(source_))
        });
        PoolId poolId_ = key.toId();
        (int56 cumulative, uint32 timestamp, bool initialized) = source_.currentTickCumulative(poolId_);
        if (!initialized) revert PoolNotInitialized();

        source = source_;
        poolManager = poolManager_;
        omr = omr_;
        fee = fee_;
        tickSpacing = tickSpacing_;
        poolId = poolId_;
        PERIOD = period_;
        tickCumulativeLast = cumulative;
        blockTimestampLast = timestamp;
    }

    /// @notice Permissionless keeper entry point. Nobody can close a window early.
    function update() external {
        _update(true);
    }

    /// @inheritdoc IOmrHookObserver
    /// @dev Called through OmertaHook.pokeObserver after PoolManager settlement. Frequent swap
    ///      notifications simply no-op until a full window is available, avoiding a revert on every
    ///      trade while preserving the strict behavior of the direct keeper entry point.
    function observe(PoolKey calldata key) external {
        if (msg.sender != address(source)) revert NotObservationSource();
        if (PoolId.unwrap(key.toId()) != PoolId.unwrap(poolId)) revert WrongPool();
        _update(false);
    }

    /// @inheritdoc IOmrOracle
    function consult() external view returns (uint256 omrPerEth, uint256 updatedAt) {
        return (priceAverage, lastUpdate);
    }

    function _update(bool revertIfEarly) private {
        (int56 cumulative, uint32 timestamp, bool initialized) = source.currentTickCumulative(poolId);
        if (!initialized) revert PoolNotInitialized();

        uint32 timeElapsed;
        unchecked {
            timeElapsed = timestamp - blockTimestampLast;
        }
        if (timeElapsed < PERIOD) {
            if (revertIfEarly) revert PeriodNotElapsed(timeElapsed, PERIOD);
            return;
        }

        if (timeElapsed > PERIOD * MAX_WINDOW_MULT) {
            _setBaseline(cumulative, timestamp);
            arithmeticMeanTick = 0;
            priceAverage = 0;
            lastUpdate = 0;
            emit Rebaselined(timeElapsed);
            return;
        }

        int56 cumulativeDelta;
        unchecked {
            cumulativeDelta = cumulative - tickCumulativeLast;
        }
        int56 denominator = int56(uint56(timeElapsed));
        int56 meanTick = cumulativeDelta / denominator;
        // Solidity rounds signed division toward zero. Tick TWAPs conventionally round toward
        // negative infinity so a negative fractional tick does not become a more favorable price.
        if (cumulativeDelta < 0 && (cumulativeDelta % denominator != 0)) meanTick--;

        int24 meanTick24 = int24(meanTick);
        uint256 price = _omrPerEthAtTick(meanTick24);
        _setBaseline(cumulative, timestamp);
        arithmeticMeanTick = meanTick24;
        if (price == 0) {
            // At an extreme negative tick the 18-decimal quote genuinely rounds below one OMR wei
            // per ETH. Publishing the prior reading as fresh would be unsafe, so invalidate instead.
            priceAverage = 0;
            lastUpdate = 0;
            emit Invalidated(meanTick24);
            return;
        }

        priceAverage = price;
        lastUpdate = block.timestamp;
        emit Updated(meanTick24, price, timeElapsed);
    }

    function _setBaseline(int56 cumulative, uint32 timestamp) private {
        tickCumulativeLast = cumulative;
        blockTimestampLast = timestamp;
    }

    /// @dev v4 tick price is currency1/currency0 in raw units. Here that is OMR-wei/ETH-wei.
    ///      `mulDiv` supplies the 512-bit intermediate for sqrtPriceX96^2.
    function _omrPerEthAtTick(int24 tick) private pure returns (uint256) {
        uint256 sqrtPriceX96 = uint256(TickMath.getSqrtPriceAtTick(tick));
        return Math.mulDiv(sqrtPriceX96, sqrtPriceX96 * 1e18, uint256(1) << 192);
    }
}
