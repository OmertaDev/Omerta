// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {ModifyLiquidityParams} from "v4-core/types/PoolOperation.sol";
import {PoolModifyLiquidityTest} from "v4-core/test/PoolModifyLiquidityTest.sol";
import {OmertaRestrictedOMRV2 as RestrictedOMR} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2 as Policy} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaStabilityControllerV2 as Controller} from "../../src/market-v2/OmertaStabilityControllerV2.sol";
import {OmertaReserveFundingV2 as Funding} from "../../src/market-v2/OmertaReserveFundingV2.sol";
import {OmertaTurfV2 as Turf} from "../../src/market-v2/OmertaTurfV2.sol";
import {OmertaTurfFeeBridgeV2 as Bridge} from "../../src/market-v2/OmertaTurfFeeBridgeV2.sol";
import {OmertaGameSettlementV2 as Game} from "../../src/market-v2/OmertaGameSettlementV2.sol";
import {IOmertaMarketStateV2} from "../../src/market-v2/IOmertaMarketStateV2.sol";
import {StabilityObservationFixture} from "./StabilityV2.t.sol";

/// @dev Actual restricted token, reviewed manager, hook, controllers and seasonal fee bridge.
/// Only the observation feed is a fixture; token admission and settlement are not mocked.
contract PolicyLifecycleIntegrationV2Test is Test {
    RestrictedOMR token;
    IPoolManager manager;
    OmertaHookV2 hook;
    StabilityObservationFixture observations;
    Funding funding;
    Game game;
    Turf registry;
    Bridge firstBridge;
    Controller first;
    PoolKey key;
    uint64 firstStart;
    uint64 firstEnd;
    uint64 epoch;

    receive() external payable {}

    function setUp() public {
        vm.warp(1_800_000_000);
        vm.roll(100);
        vm.deal(address(this), 1000 ether);
        token = new RestrictedOMR(address(this));
        funding = new Funding(address(this), token, Controller.Tranche.Core);
        address[4] memory recipients = [address(0xD), address(0xE), address(0xF), address(funding)];
        manager = IPoolManager(
            deployCode(
                "OmertaPoolManagerV2.sol:OmertaPoolManagerV2", abi.encode(address(token), address(this), recipients, recipients[2])
            )
        );
        uint160 flags = uint160(
            Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.AFTER_ADD_LIQUIDITY_FLAG
                | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG
                | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
        );
        address target = address(uint160((uint256(0x9876) << 144) | flags));
        address[5] memory hookRecipients =
            [recipients[0], recipients[1], recipients[2], address(funding), address(funding)];
        deployCodeTo(
            "OmertaHookV2.sol:OmertaHookV2",
            abi.encode(
                manager,
                address(token),
                address(this),
                uint24(3000),
                int24(60),
                hookRecipients,
                OmertaHookV2.OpeningConfig(0, 0, 0),
                uint24(100),
                uint32(60)
            , hookRecipients[2]),
            target
        );
        hook = OmertaHookV2(payable(target));
        key = hook.poolKey();
        observations = new StabilityObservationFixture();
        game = new Game(address(this), address(this));
        registry = new Turf(address(this), token, address(game), observations, 60, 600);
        game.bindRegistry(registry);
        vm.prank(address(0xA11CE), address(0xA11CE));
        token.registerWallet(address(0xA11CE));
        game.setFamilyTreasury(1, address(0xA11CE), 0);
        firstStart = uint64(vm.getBlockTimestamp() + 1);
        firstEnd = firstStart + 28 days;
        registry.createSeason(firstStart, firstEnd);
        registry.createTurf(1, -600, 600, _owners());
        firstBridge = new Bridge(address(this), registry, 1, 0);
        first = new Controller(_config(firstStart, firstEnd, address(firstBridge)));
        firstBridge.bindSource(first);
        registry.bindFeeSource(address(firstBridge), 1, 0);
        game.registerLane(firstBridge);
        funding.bindController(first);
        _operator(address(hook));
        _operator(address(first));
        _operator(address(registry));
        PoolModifyLiquidityTest bootstrap = new PoolModifyLiquidityTest(manager);
        token.setOperator(address(bootstrap), Policy.OperatorRole.SettlementInput, address(bootstrap).codehash);
        token.setContractHolder(address(firstBridge), address(firstBridge).codehash);
        token.setContractHolder(address(funding), address(funding).codehash);
        token.bindSettlementManager(address(manager), address(manager).codehash);
        token.sealPolicy();
        manager.initialize(key, 79228162514264337593543950336);
        token.approve(address(bootstrap), 1 ether);
        bootstrap.modifyLiquidity{value: 1 ether}(key, ModifyLiquidityParams(-887220, 887220, 1 ether, bytes32(0)), "");
        token.approve(address(first), 4 ether);
        first.fund{value: 2 ether}(Controller.Tranche.Core, 2 ether);
        first.fund{value: 2 ether}(Controller.Tranche.Turf, 2 ether);
        vm.warp(firstStart);
        _reading();
        first.deploy(Controller.Tranche.Core, epoch);
        first.deploy(Controller.Tranche.Turf, epoch);
    }

    function _operator(address candidate) private {
        token.setOperator(candidate, Policy.OperatorRole.ProtocolCustody, candidate.codehash);
    }

    function _owners() private pure returns (Turf.Split memory owners) {
        owners.families[0] = 1;
        owners.shares[0] = 10000;
        owners.count = 1;
    }

    function _config(uint64 startsAt, uint64 endsAt, address bridge) private view returns (Controller.Config memory c) {
        c.safe = address(this);
        c.manager = manager;
        c.key = key;
        c.marketState = observations;
        c.maxObservationAge = 600;
        c.cooldown = 60;
        c.recoveryInterval = 60;
        c.minLiquidity = 1;
        c.maxSpotDeviationTicks = 100;
        c.minBandTicks = 120;
        c.maxBandTicks = 1200;
        c.stressOnBps = 6000;
        c.stressOffBps = 2000;
        c.recoveryX = 2;
        c.recoveryY = 3;
        c.turfLower = -600;
        c.turfUpper = 600;
        c.turfSeasonStart = startsAt;
        c.turfSeasonEnd = endsAt;
        for (uint256 i; i < 7; ++i) {
            c.feeRecipients[i] = i == 6 ? bridge : address(funding);
            c.limits[i] = Controller.Limits(1 ether, 1 ether, 2 ether, 2 ether, 4 ether, 4 ether, 0.5 ether, 0.5 ether);
        }
    }

    function _reading() private {
        observations.set(
            IOmertaMarketStateV2.Snapshot(
                ++epoch, uint64(vm.getBlockTimestamp()), 0, 0, 1000 ether, 1 ether, 0, 0, true
            )
        );
    }

    function testNextSeasonCanBeAdmittedAfterSealWithoutChangingOldClaimsOrBudgets() public {
        vm.warp(firstEnd);
        Controller.Account memory oldCore = first.account(Controller.Tranche.Core);
        Controller.Account memory oldTurf = first.account(Controller.Tranche.Turf);
        game.archiveLane(0);
        assertTrue(firstBridge.closed());
        assertEq(first.position(Controller.Tranche.Turf).liquidity, 0);
        uint64 nextStart = uint64(vm.getBlockTimestamp() + 8 days);
        registry.createSeason(nextStart, nextStart + 28 days);
        registry.createTurf(2, -600, 600, _owners());
        Bridge nextBridge = new Bridge(address(this), registry, 2, 0);
        Controller next = new Controller(_config(nextStart, nextStart + 28 days, address(nextBridge)));
        nextBridge.bindSource(next);
        registry.bindFeeSource(address(nextBridge), 2, 0);
        game.registerLane(nextBridge);
        token.proposeOperator(address(next), Policy.OperatorRole.ProtocolCustody, address(next).codehash);
        token.proposeContractHolder(address(nextBridge), address(nextBridge).codehash);
        funding.proposeController(next, address(next).codehash);
        token.approve(address(next), 2 ether);
        vm.expectRevert(RestrictedOMR.InvalidRecipient.selector);
        next.fund{value: 2 ether}(Controller.Tranche.Turf, 2 ether);
        vm.warp(vm.getBlockTimestamp() + 7 days);
        token.executeOperatorProposal(address(next));
        token.executeContractHolderProposal(address(nextBridge));
        funding.executeControllerProposal();
        assertEq(address(funding.controller()), address(next));
        assertEq(token.pendingPolicyUpdates(), 0);
        next.fund{value: 2 ether}(Controller.Tranche.Turf, 2 ether);
        assertEq(first.account(Controller.Tranche.Core).nativeDeployed, oldCore.nativeDeployed);
        assertEq(first.account(Controller.Tranche.Core).omrDeployed, oldCore.omrDeployed);
        assertEq(first.account(Controller.Tranche.Turf).nativeDeployed, oldTurf.nativeDeployed);
        assertEq(first.account(Controller.Tranche.Turf).omrDeployed, oldTurf.omrDeployed);
        vm.warp(nextStart);
        _reading();
        next.deploy(Controller.Tranche.Turf, epoch);
        assertGt(next.position(Controller.Tranche.Turf).liquidity, 0);
        assertEq(address(firstBridge.source()), address(first));
        assertEq(address(nextBridge.source()), address(next));
        assertEq(token.balanceOf(address(firstBridge)), 0);
        assertEq(token.totalSupply(), token.SUPPLY());
    }
}
