// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {OMR} from "../../src/OMR.sol";
import {OmertaHook} from "../../src/OmertaHook.sol";
import {OmrV4TwapOracle} from "../../src/OmrV4TwapOracle.sol";
import {DeployV4TwapOracle} from "../../script/DeployV4TwapOracle.s.sol";
import {MockV4OracleToken, MockV4ObservationSource} from "../OmrV4TwapOracle.t.sol";

/// @notice Fresh 2026-09-09 bootstrap evidence. Hook and PoolManager initialization are real;
///         these tests do not claim to exercise CCA bidding, LP migration or liquidity health.
contract GenesisOracleBootstrapIntegrationTest is Test {
    using PoolIdLibrary for PoolKey;

    uint160 private constant FLAGS = uint160(
        Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG | Hooks.BEFORE_SWAP_FLAG
            | Hooks.BEFORE_SWAP_RETURNS_DELTA_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG
    );
    uint32 private constant PERIOD = 600;
    address private constant SAFE = address(0x5AFE);
    PoolManager private manager;
    OMR private omr;
    OmertaHook private hook;
    PoolKey private key;

    function setUp() public {
        vm.warp(1_000_000);
        manager = new PoolManager(address(this));
        omr = new OMR(SAFE);
        address hookAddress = address(uint160((uint256(0xB007) << 144) | uint256(FLAGS)));
        deployCodeTo("OmertaHook.sol:OmertaHook", abi.encode(manager, address(omr), SAFE, address(this)), hookAddress);
        hook = OmertaHook(payable(hookAddress));
        vm.prank(SAFE);
        hook.setAllowedQuote(Currency.wrap(address(0)), true);
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3_000, 60, IHooks(hookAddress));
    }

    function test_real_hook_can_bind_oracle_before_pool_opens_then_seed_and_warm_up() public {
        OmrV4TwapOracle oracle = new OmrV4TwapOracle(hook, address(omr), 3_000, 60, PERIOD);
        vm.prank(SAFE);
        hook.setObserver(oracle);
        assertFalse(oracle.baselineInitialized());
        vm.warp(block.timestamp + 7 days);
        vm.expectRevert(OmrV4TwapOracle.PoolNotInitialized.selector);
        oracle.update();
        manager.initialize(key, uint160(1) << 96);
        assertFalse(oracle.baselineInitialized(), "pool initialization must not fabricate an oracle window");
        hook.pokeObserver(key);
        assertTrue(oracle.baselineInitialized());
        (uint256 seedPrice, uint256 seedAt) = oracle.consult();
        assertEq(seedPrice, 0);
        assertEq(seedAt, 0);
        vm.warp(block.timestamp + PERIOD - 1);
        hook.pokeObserver(key);
        (uint256 earlyPrice,) = oracle.consult();
        assertEq(earlyPrice, 0);
        vm.warp(block.timestamp + 1);
        hook.pokeObserver(key);
        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertEq(price, 1e18);
        assertEq(updatedAt, block.timestamp);
    }

    function test_deploy_script_accepts_unopened_canonical_pool_and_preserves_identity() public {
        _setScriptEnvironment();
        OmrV4TwapOracle oracle = (new DeployV4TwapOracle()).run();
        assertFalse(oracle.baselineInitialized());
        assertEq(address(oracle.source()), address(hook));
        assertEq(address(oracle.poolManager()), address(manager));
        assertEq(PoolId.unwrap(oracle.poolId()), PoolId.unwrap(key.toId()));
        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertEq(price, 0);
        assertEq(updatedAt, 0);
    }

    function test_deploy_script_retains_seed_for_initialized_canonical_pool() public {
        manager.initialize(key, uint160(1) << 96);
        _setScriptEnvironment();
        OmrV4TwapOracle oracle = (new DeployV4TwapOracle()).run();
        assertTrue(oracle.baselineInitialized());
        assertEq(oracle.blockTimestampLast(), uint32(block.timestamp));
    }

    function test_deploy_script_refuses_wrong_manager_before_oracle_deployment() public {
        _setScriptEnvironment();
        PoolManager wrongManager = new PoolManager(address(this));
        // Mock only this test's source response; vm.setEnv is process-wide, so changing an env
        // address to a bad value here could contaminate concurrently running script tests.
        vm.mockCall(address(hook), abi.encodeCall(hook.poolManager, ()), abi.encode(address(wrongManager)));
        DeployV4TwapOracle script = new DeployV4TwapOracle();
        vm.expectRevert(bytes("DeployV4TwapOracle: wrong PoolManager"));
        script.run();
    }

    function _setScriptEnvironment() private {
        vm.setEnv("EXPECTED_CHAIN_ID", vm.toString(block.chainid));
        vm.setEnv("OMR_ADDRESS", vm.toString(address(omr)));
        vm.setEnv("OMERTA_HOOK_ADDRESS", vm.toString(address(hook)));
        vm.setEnv("V4_POOL_MANAGER", vm.toString(address(manager)));
        vm.setEnv("TWAP_PERIOD_SECONDS", vm.toString(PERIOD));
    }
}

/// @dev Ghost state uses full timestamps independently of the oracle's wrapped uint32 timestamps.
///      Every call checks the transition immediately, so transient early publication cannot be hidden
///      by a later valid sample. Tick changes are real accumulator transitions in the source fixture.
contract GenesisOracleBootstrapHandler is Test {
    using PoolIdLibrary for PoolKey;

    uint32 private constant PERIOD = 600;
    MockV4ObservationSource public immutable source;
    OmrV4TwapOracle public immutable oracle;
    PoolKey private key;
    bool public sourceInitialized;
    bool public ghostSeeded;
    uint256 public ghostBaselineAt;
    uint256 public publications;
    uint256 public resets;
    bool public transitionFailure;

    constructor(MockV4ObservationSource source_, OmrV4TwapOracle oracle_, PoolKey memory key_) {
        source = source_;
        oracle = oracle_;
        key = key_;
    }

    function initialize(int24 tick) external {
        if (sourceInitialized) return;
        source.initialize(key.toId(), int24(bound(int256(tick), -100_000, 100_000)));
        sourceInitialized = true;
    }

    function elapse(uint32 secondsForward) external {
        vm.warp(block.timestamp + bound(secondsForward, 0, PERIOD * 5));
    }

    function changeTick(int24 tick) external {
        if (sourceInitialized) source.setTick(int24(bound(int256(tick), -100_000, 100_000)));
    }

    function poke(bool observer) external {
        (uint256 beforePrice, uint256 beforeAt) = oracle.consult();
        bool wasSeeded = ghostSeeded;
        uint256 elapsed = wasSeeded ? block.timestamp - ghostBaselineAt : 0;
        bool expectedSuccess = observer || (sourceInitialized && (!wasSeeded || elapsed >= PERIOD));
        bytes memory payload = observer ? abi.encodeCall(oracle.observe, (key)) : abi.encodeCall(oracle.update, ());
        if (observer) vm.prank(address(source));
        (bool success, bytes memory result) = address(oracle).call(payload);
        if (success != expectedSuccess) transitionFailure = true;
        if (!success) {
            bytes memory expectedError = !sourceInitialized
                ? abi.encodeWithSelector(OmrV4TwapOracle.PoolNotInitialized.selector)
                : abi.encodeWithSelector(OmrV4TwapOracle.PeriodNotElapsed.selector, uint32(elapsed), PERIOD);
            if (keccak256(result) != keccak256(expectedError)) transitionFailure = true;
        }
        (uint256 price, uint256 updatedAt) = oracle.consult();
        if (!sourceInitialized) {
            if (oracle.baselineInitialized() || price != 0 || updatedAt != 0) transitionFailure = true;
        } else if (!wasSeeded) {
            ghostSeeded = true;
            ghostBaselineAt = block.timestamp;
            if (!oracle.baselineInitialized() || price != 0 || updatedAt != 0) transitionFailure = true;
        } else if (elapsed < PERIOD) {
            if (price != beforePrice || updatedAt != beforeAt) transitionFailure = true;
        } else {
            ghostBaselineAt = block.timestamp;
            if (elapsed > PERIOD * 4) {
                resets++;
                if (price != 0 || updatedAt != 0) transitionFailure = true;
            } else {
                publications++;
                if (price == 0 || updatedAt != block.timestamp) transitionFailure = true;
            }
        }
        if (oracle.baselineInitialized() != ghostSeeded) transitionFailure = true;
        if (ghostSeeded && oracle.blockTimestampLast() != uint32(ghostBaselineAt)) transitionFailure = true;
    }
}

contract GenesisOracleBootstrapInvariantTest is Test {
    using PoolIdLibrary for PoolKey;

    GenesisOracleBootstrapHandler private handler;
    OmrV4TwapOracle private oracle;

    function setUp() public {
        // Cross uint32 wrap in ordinary runs; exercise cold calls, seed, live quote, and stale reset
        // explicitly before random sequences so every retained run proves these paths were reached.
        vm.warp(uint256(type(uint32).max) - 300);
        PoolManager manager = new PoolManager(address(this));
        MockV4OracleToken omr = new MockV4OracleToken("OMR", 18);
        MockV4ObservationSource source = new MockV4ObservationSource(manager);
        PoolKey memory key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3_000, 60, IHooks(address(source)));
        oracle = new OmrV4TwapOracle(source, address(omr), 3_000, 60, 600);
        handler = new GenesisOracleBootstrapHandler(source, oracle, key);
        handler.poke(false);
        handler.poke(true);
        handler.initialize(0);
        handler.poke(false);
        handler.elapse(600);
        handler.poke(true);
        handler.elapse(2401);
        handler.poke(false);
        assertEq(handler.publications(), 1);
        assertEq(handler.resets(), 1);
        assertFalse(handler.transitionFailure());
        bytes4[] memory selectors = new bytes4[](4);
        selectors[0] = handler.initialize.selector;
        selectors[1] = handler.elapse.selector;
        selectors[2] = handler.changeTick.selector;
        selectors[3] = handler.poke.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    function invariant_only_initialized_complete_bounded_windows_publish() public view {
        assertFalse(handler.transitionFailure());
        assertEq(oracle.baselineInitialized(), handler.ghostSeeded());
        assertEq(oracle.blockTimestampLast(), uint32(handler.ghostBaselineAt()));
    }
}
