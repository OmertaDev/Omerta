// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {StabilityV2Fixture, StabilityObservationFixture} from "./StabilityV2.t.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {OMR} from "../../src/OMR.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

contract StabilityV2Handler is Test {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    Controller public immutable controller;
    StabilityObservationFixture public immutable observations;
    IPoolManager public immutable manager;
    PoolSwapTest public immutable swaps;
    OMR public immutable token;
    PoolKey private _key;
    address public immutable safe;
    uint256 public successfulPlacements;
    uint256 public successfulExits;
    uint256 public successfulTrades;

    constructor(
        Controller c,
        StabilityObservationFixture o,
        IPoolManager m,
        PoolSwapTest router,
        OMR coin,
        PoolKey memory k,
        address s
    ) {
        controller = c;
        observations = o;
        manager = m;
        swaps = router;
        token = coin;
        _key = k;
        safe = s;
        coin.approve(address(router), type(uint256).max);
        coin.approve(address(c), type(uint256).max);
    }
    receive() external payable {}

    function nextObservation(bool stress) external {
        vm.warp(vm.getBlockTimestamp() + 60);
        vm.roll(vm.getBlockNumber() + 1);
        (uint160 sqrtPrice, int24 tick,,) = manager.getSlot0(_key.toId());
        if (sqrtPrice == 0) return;
        IOmertaMarketStateV2.Snapshot memory s = observations.snapshot();
        observations.set(
            IOmertaMarketStateV2.Snapshot(
                s.epoch + 1,
                uint64(vm.getBlockTimestamp()),
                tick,
                0,
                1000 ether,
                1 ether,
                stress ? 8000 : 0,
                stress ? 8000 : 0,
                true
            )
        );
    }

    function place(uint8 seed) external {
        Controller.Tranche t = Controller.Tranche(seed % 7);
        try controller.deploy(t, observations.snapshot().epoch) {
            ++successfulPlacements;
        }
            catch {}
    }

    function remove(uint8 seed) external {
        vm.prank(safe);
        try controller.exit(Controller.Tranche(seed % 7)) {
            ++successfulExits;
        }
            catch {}
    }

    function collect(uint8 seed) external {
        try controller.collect(Controller.Tranche(seed % 7)) {} catch {}
    }

    function claim(uint8 seed) external {
        controller.claimFees(Controller.Tranche(seed % 7));
    }

    function recovery(uint8 seed) external {
        Controller.Tranche t = Controller.Tranche(seed % 7);
        uint64 epoch = observations.snapshot().epoch;
        try controller.observeRecovery(t, epoch) {} catch {}
        try controller.regenerate(t, epoch) {} catch {}
    }

    function trade(bool sell, uint96 seed) external {
        uint256 amount = bound(seed, 1e12, 0.25 ether);
        (uint160 sqrtPrice, int24 tick,,) = manager.getSlot0(_key.toId());
        if (sqrtPrice == 0 || tick < -10000 || tick > 10000) return;
        SwapParams memory p =
            SwapParams(!sell, -int256(amount), TickMath.getSqrtPriceAtTick(tick + (sell ? int24(60) : int24(-60))));
        try swaps.swap{value: sell ? 0 : amount}(_key, p, PoolSwapTest.TestSettings(false, false), "") {
            ++successfulTrades;
        }
            catch {}
    }

    function pause(bool value) external {
        vm.prank(safe);
        controller.setPaused(value);
    }
}

contract StabilityV2InvariantTest is StabilityV2Fixture {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    StabilityV2Handler handler;

    function setUp() public override {
        super.setUp();
        handler = new StabilityV2Handler(controller, observations, manager, swaps, token, key, safe);
        vm.deal(address(handler), 1000 ether);
        token.transfer(address(handler), 1000 ether);
        // Establish an actual owned position so every run starts with meaningful custody.
        controller.deploy(CORE, epoch);
        targetContract(address(handler));
    }

    function invariantCompartmentAndFeeLiabilitiesEqualHeldAssets() public view {
        _assertCustody();
    }

    function invariantOwnedLiquidityMatchesRealManagerPositions() public view {
        for (uint256 i; i < 7; ++i) {
            Controller.Tranche t = Controller.Tranche(i);
            Controller.Position memory p = controller.position(t);
            if (p.nonce == 0) continue;
            (uint128 actual,,) = manager.getPositionInfo(
                key.toId(), address(controller), p.lower, p.upper, keccak256(abi.encode(t, p.nonce))
            );
            assertEq(actual, p.liquidity);
        }
    }
}
