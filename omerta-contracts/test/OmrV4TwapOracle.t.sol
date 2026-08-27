// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC165} from "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {OmrV4TwapOracle} from "../src/OmrV4TwapOracle.sol";
import {IOmrV4ObservationSource} from "../src/interfaces/IOmrV4ObservationSource.sol";

contract MockV4OracleToken is ERC20 {
    uint8 private immutable _tokenDecimals;

    constructor(string memory symbol_, uint8 decimals_) ERC20(symbol_, symbol_) {
        _tokenDecimals = decimals_;
    }

    function decimals() public view override returns (uint8) {
        return _tokenDecimals;
    }
}

/// @dev A deterministic stand-in for the hook's cumulative source. It has the same one-slot state
///      machine: accrue the old tick until now, then adopt the new tick. Oracle tests can therefore
///      isolate windowing and conversion without mocking PoolManager slot layout.
contract MockV4ObservationSource is IOmrV4ObservationSource, IERC165 {
    IPoolManager public immutable poolManager;

    PoolId private _poolId;
    int56 private _tickCumulative;
    int24 private _tick;
    uint32 private _blockTimestamp;
    bool private _initialized;

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == type(IOmrV4ObservationSource).interfaceId || interfaceId == type(IERC165).interfaceId;
    }

    function initialize(PoolId poolId_, int24 tick_) external {
        _poolId = poolId_;
        _tick = tick_;
        _blockTimestamp = uint32(block.timestamp);
        _initialized = true;
    }

    function setTick(int24 tick_) external {
        _accrue();
        _tick = tick_;
    }

    function currentTickCumulative(PoolId poolId_)
        external
        view
        returns (int56 tickCumulative, uint32 blockTimestamp, bool initialized)
    {
        if (!_initialized || PoolId.unwrap(poolId_) != PoolId.unwrap(_poolId)) return (0, 0, false);
        blockTimestamp = uint32(block.timestamp);
        uint32 elapsed;
        unchecked {
            elapsed = blockTimestamp - _blockTimestamp;
            tickCumulative = _tickCumulative + int56(_tick) * int56(uint56(elapsed));
        }
        initialized = true;
    }

    function _accrue() private {
        uint32 timestamp = uint32(block.timestamp);
        uint32 elapsed;
        unchecked {
            elapsed = timestamp - _blockTimestamp;
            _tickCumulative += int56(_tick) * int56(uint56(elapsed));
        }
        _blockTimestamp = timestamp;
    }
}

contract UnsupportedV4ObservationSource {
    IPoolManager public immutable poolManager;

    constructor(IPoolManager poolManager_) {
        poolManager = poolManager_;
    }

    function supportsInterface(bytes4) external pure returns (bool) {
        return false;
    }
}

contract OmrV4TwapOracleTest is Test {
    using PoolIdLibrary for PoolKey;

    uint32 constant PERIOD = 30 minutes;
    uint24 constant FEE = 3000;
    int24 constant TICK_SPACING = 60;
    int24 constant TICK_5000 = 85_176;

    PoolManager manager;
    MockV4OracleToken omr;
    MockV4ObservationSource source;
    PoolKey key;
    OmrV4TwapOracle oracle;

    function setUp() public {
        vm.warp(1_000_000);
        manager = new PoolManager(address(this));
        omr = new MockV4OracleToken("OMR", 18);
        source = new MockV4ObservationSource(manager);
        key = _key(source, address(omr), FEE, TICK_SPACING);
        source.initialize(key.toId(), 0);
        oracle = new OmrV4TwapOracle(source, address(omr), FEE, TICK_SPACING, PERIOD);
    }

    function test_pins_the_native_pool_and_starts_unavailable() public view {
        assertEq(address(oracle.source()), address(source));
        assertEq(address(oracle.poolManager()), address(manager));
        assertEq(oracle.omr(), address(omr));
        assertEq(oracle.fee(), FEE);
        assertEq(oracle.tickSpacing(), TICK_SPACING);
        assertEq(PoolId.unwrap(oracle.poolId()), PoolId.unwrap(key.toId()));
        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertEq(price, 0, "a fresh oracle cannot publish a spot price");
        assertEq(updatedAt, 0);
    }

    function test_direct_update_refuses_to_close_a_short_window() public {
        vm.warp(block.timestamp + PERIOD - 1);
        vm.expectRevert(abi.encodeWithSelector(OmrV4TwapOracle.PeriodNotElapsed.selector, PERIOD - 1, PERIOD));
        oracle.update();
    }

    function test_tick_zero_closes_at_one_omr_per_eth() public {
        vm.warp(block.timestamp + PERIOD);
        oracle.update();
        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertEq(price, 1e18);
        assertEq(updatedAt, block.timestamp);
        assertEq(oracle.arithmeticMeanTick(), 0);
    }

    function test_observer_notifications_noop_early_then_close_the_window() public {
        vm.warp(block.timestamp + 1 minutes);
        vm.prank(address(source));
        oracle.observe(key);
        (uint256 early,) = oracle.consult();
        assertEq(early, 0, "a swap notification shortened the minimum window");

        vm.warp(block.timestamp + PERIOD - 1 minutes);
        vm.prank(address(source));
        oracle.observe(key);
        (uint256 price,) = oracle.consult();
        assertEq(price, 1e18);
    }

    function test_sustained_tick_is_converted_to_omr_per_eth() public {
        source.setTick(TICK_5000);
        vm.warp(block.timestamp + PERIOD);
        oracle.update();

        (uint256 price,) = oracle.consult();
        assertApproxEqRel(price, 5000e18, 2e15, "tick conversion did not preserve OMR/ETH orientation");
    }

    function test_a_short_spike_is_averaged_not_adopted() public {
        vm.warp(block.timestamp + (PERIOD * 9) / 10);
        source.setTick(TICK_5000);
        vm.warp(block.timestamp + PERIOD / 10);
        oracle.update();

        (uint256 price,) = oracle.consult();
        assertGt(price, 1e18, "the spike was ignored rather than time weighted");
        assertLt(price, 3e18, "a short 5000x spike was adopted like a spot price");
    }

    function test_negative_fractional_mean_tick_rounds_toward_negative_infinity() public {
        source.setTick(-1);
        vm.warp(block.timestamp + 1);
        source.setTick(0);
        vm.warp(block.timestamp + PERIOD - 1);
        oracle.update();

        assertEq(oracle.arithmeticMeanTick(), -1, "signed division rounded a negative tick toward zero");
        (uint256 price,) = oracle.consult();
        assertLt(price, 1e18, "negative fractional history became the tick-zero price");
    }

    function test_overlong_window_is_discarded_and_recovers_after_one_honest_window() public {
        vm.warp(block.timestamp + PERIOD);
        oracle.update();
        (uint256 live,) = oracle.consult();
        assertEq(live, 1e18);

        source.setTick(TICK_5000);
        vm.warp(block.timestamp + PERIOD * oracle.MAX_WINDOW_MULT() + 1);
        oracle.update();
        (uint256 dead, uint256 deadAt) = oracle.consult();
        assertEq(dead, 0, "an obsolete interval was stamped fresh");
        assertEq(deadAt, 0);

        vm.warp(block.timestamp + PERIOD);
        oracle.update();
        (uint256 recovered, uint256 recoveredAt) = oracle.consult();
        assertApproxEqRel(recovered, 5000e18, 2e15);
        assertEq(recoveredAt, block.timestamp);
    }

    function test_an_extreme_sub_wei_price_invalidates_instead_of_republishing_old_data() public {
        vm.warp(block.timestamp + PERIOD);
        oracle.update();
        source.setTick(-887_272);
        vm.warp(block.timestamp + PERIOD);
        oracle.update();

        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertEq(price, 0);
        assertEq(updatedAt, 0);
    }

    function test_timestamp_wrap_preserves_the_elapsed_window() public {
        uint256 nearWrap = uint256(type(uint32).max) - PERIOD / 2;
        vm.warp(nearWrap);
        MockV4ObservationSource wrapSource = new MockV4ObservationSource(manager);
        PoolKey memory wrapKey = _key(wrapSource, address(omr), FEE, TICK_SPACING);
        wrapSource.initialize(wrapKey.toId(), TICK_5000);
        OmrV4TwapOracle wrapOracle = new OmrV4TwapOracle(wrapSource, address(omr), FEE, TICK_SPACING, PERIOD);

        vm.warp(nearWrap + PERIOD);
        wrapOracle.update();
        (uint256 price,) = wrapOracle.consult();
        assertApproxEqRel(price, 5000e18, 2e15, "uint32 timestamp wrap corrupted the TWAP");
    }

    function test_only_the_exact_source_and_pool_may_use_the_observer_entry() public {
        vm.expectRevert(OmrV4TwapOracle.NotObservationSource.selector);
        oracle.observe(key);

        PoolKey memory wrongKey = _key(source, address(omr), 500, 10);
        vm.prank(address(source));
        vm.expectRevert(OmrV4TwapOracle.WrongPool.selector);
        oracle.observe(wrongKey);
    }

    function test_constructor_rejects_short_period_unsupported_source_bad_decimals_and_wrong_pool() public {
        vm.expectRevert(OmrV4TwapOracle.PeriodTooShort.selector);
        new OmrV4TwapOracle(source, address(omr), FEE, TICK_SPACING, 1 minutes);

        UnsupportedV4ObservationSource unsupported = new UnsupportedV4ObservationSource(manager);
        vm.expectRevert(OmrV4TwapOracle.UnsupportedObservationSource.selector);
        new OmrV4TwapOracle(IOmrV4ObservationSource(address(unsupported)), address(omr), FEE, TICK_SPACING, PERIOD);

        MockV4OracleToken sixDecimalOmr = new MockV4OracleToken("OMR6", 6);
        vm.expectRevert(
            abi.encodeWithSelector(OmrV4TwapOracle.UnsupportedTokenDecimals.selector, address(sixDecimalOmr), uint8(6))
        );
        new OmrV4TwapOracle(source, address(sixDecimalOmr), FEE, TICK_SPACING, PERIOD);

        vm.expectRevert(OmrV4TwapOracle.PoolNotInitialized.selector);
        new OmrV4TwapOracle(source, address(omr), 500, 10, PERIOD);
    }

    function testFuzz_tick_conversion_matches_the_independent_fixed_point_price(int24 tick) public {
        tick = int24(bound(int256(tick), -400_000, 400_000));
        source.setTick(tick);
        vm.warp(block.timestamp + PERIOD);
        oracle.update();

        uint256 sqrtPriceX96 = uint256(TickMath.getSqrtPriceAtTick(tick));
        uint256 expected = Math.mulDiv(sqrtPriceX96, sqrtPriceX96 * 1e18, uint256(1) << 192);
        (uint256 actual,) = oracle.consult();
        assertEq(actual, expected);
    }

    function _key(MockV4ObservationSource source_, address omr_, uint24 fee_, int24 spacing_)
        private
        pure
        returns (PoolKey memory)
    {
        return PoolKey({
            currency0: Currency.wrap(address(0)),
            currency1: Currency.wrap(omr_),
            fee: fee_,
            tickSpacing: spacing_,
            hooks: IHooks(address(source_))
        });
    }
}
