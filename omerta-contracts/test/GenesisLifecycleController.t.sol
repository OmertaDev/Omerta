// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {Actions} from "../lib/v4-periphery/src/libraries/Actions.sol";
import {OMR} from "../src/OMR.sol";
import {IOmrOracle} from "../src/IOmrOracle.sol";
import {GenesisProceedsSplitter} from "../src/GenesisProceedsSplitter.sol";
import {GenesisLifecycleController, IGenesisAuction, IGenesisStrategy, IGenesisFoundation}
    from "../src/GenesisLifecycleController.sol";
import {ProtocolLiquidityVault, IProtocolPositionManager} from "../src/ProtocolLiquidityVault.sol";

interface ILifecyclePositionManager {
    function nextTokenId() external view returns (uint256);
    function modifyLiquidities(bytes calldata unlockData, uint256 deadline) external payable;
    function ownerOf(uint256 id) external view returns (address);
    function getApproved(uint256 id) external view returns (address);
}

// Exact tuple shape of the pinned LBP v3.1.1 MigratorParameters, independently declared for fixtures.
struct LifecyclePoolParameters { uint24 fee; int24 tickSpacing; address hook; }
struct LifecycleMigrationParameters {
    address token; address currency; uint64 migrationBlock; uint128 reservedTokenAmountForLP;
    address recipient; address positionRecipient; LifecyclePoolParameters poolParameters;
    bytes positionDefinitions; bytes lpAllocationSchedule;
}

contract LifecycleOracleFixture is IOmrOracle {
    uint256 public price; uint256 public timestamp; bool public reject;
    function set(uint256 p, uint256 t, bool r) external { price = p; timestamp = t; reject = r; }
    function consult() external view returns (uint256, uint256) {
        require(!reject, "oracle unavailable"); return (price, timestamp);
    }
}

/// Explicit controller-boundary fixture. Actual NFT custody is covered separately in the POL suite.
contract LifecycleFoundationFixture {
    address public immutable omr; bytes32 public immutable poolId;
    address public immutable poolManager; address public immutable oracle;
    address public genesisController; uint256 public positionId;
    uint256 public activationTimestamp; uint256 public warmup = 1 hours;
    bool public emergencyLatched; bool public healthy;
    constructor(address token, bytes32 id, address manager, address oracle_) {
        omr = token; poolId = id; poolManager = manager; oracle = oracle_;
    }
    function setController(address c) external { genesisController = c; }
    function setState(bool h, bool emergency, uint256 activated, uint256 delay) external {
        healthy = h; emergencyLatched = emergency; activationTimestamp = activated; warmup = delay;
    }
    function adoptGenesisFoundation(uint256 id) external {
        require(msg.sender == genesisController && positionId == 0 && id != 0 && !emergencyLatched, "bad adoption");
        positionId = id; activationTimestamp = block.timestamp;
    }
}

contract LifecycleArbSysFixture {
    uint256 public blockNumber;
    function set(uint256 b) external { blockNumber = b; }
    function arbBlockNumber() external view returns (uint256) { return blockNumber; }
}

/// Mimics the exact recipient-only and one-shot CCA sweep boundary, not CCA bidding economics.
contract LifecycleAuctionFixture {
    address public token; address public currency;
    address public fundsRecipient; address public tokensRecipient;
    uint64 public startBlock = 100; uint64 public endBlock = 200;
    uint256 public sweepUnsoldTokensBlock;
    uint256 public checkpoints; uint256 public sweeps;
    bool public rejectSweep; address public reenter; bool public reentrySucceeded;
    constructor(address t, address funds, address tokens) { token = t; fundsRecipient = funds; tokensRecipient = tokens; }
    function configure(address t, address c, address f, address u, uint64 s, uint64 e) external {
        token = t; currency = c; fundsRecipient = f; tokensRecipient = u; startBlock = s; endBlock = e;
    }
    function setSweepFailure(bool value) external { rejectSweep = value; }
    function setSweepBlock(uint256 value) external { sweepUnsoldTokensBlock = value; }
    function setReentry(address target) external { reenter = target; }
    function checkpoint() external { ++checkpoints; }
    function sweepUnsoldTokens() external {
        require(msg.sender == tokensRecipient && sweepUnsoldTokensBlock == 0 && !rejectSweep, "cannot sweep");
        sweepUnsoldTokensBlock = block.number; ++sweeps;
        if (reenter != address(0)) (reentrySucceeded,) = reenter.call(abi.encodeWithSignature("sweepUnsoldTokens()"));
        IERC20(token).transfer(tokensRecipient, IERC20(token).balanceOf(address(this)));
    }
}

/// Executes real v4 pool initialization and splitter settlement. The inner-failure branch models
/// pinned LBP semantics: clear registration; catch a reverted inner initialization; return success.
contract LifecycleStrategyFixture {
    using PoolIdLibrary for PoolKey;
    mapping(bytes32 => address) public registeredPoolIds;
    mapping(address => LifecycleMigrationParameters) internal _parameters;
    IPoolManager public immutable manager; PoolKey internal _key;
    bool public innerFailure; bool public outerFailure; bool public retainRegistration;
    uint256 public migrations;
    constructor(IPoolManager m, PoolKey memory key_) { manager = m; _key = key_; }
    receive() external payable {}
    function register(address a, LifecycleMigrationParameters calldata p) external {
        _parameters[a] = p; registeredPoolIds[PoolId.unwrap(_key.toId())] = a;
    }
    function initializers(address a) external view returns (LifecycleMigrationParameters memory) { return _parameters[a]; }
    function setBehavior(bool inner, bool outer, bool retain) external {
        innerFailure = inner; outerFailure = outer; retainRegistration = retain;
    }
    function clear() external { registeredPoolIds[PoolId.unwrap(_key.toId())] = address(0); }
    function migrate(address a) external {
        require(!outerFailure, "outer failure"); ++migrations;
        if (!retainRegistration) registeredPoolIds[PoolId.unwrap(_key.toId())] = address(0);
        try this.tryMigrate() {} catch {}
        LifecycleMigrationParameters memory p = _parameters[a];
        if (address(this).balance != 0) {
            (bool ok,) = payable(p.recipient).call{value: address(this).balance}(""); require(ok, "recipient failed");
        }
        uint256 amount = IERC20(p.token).balanceOf(address(this));
        if (amount != 0) IERC20(p.token).transfer(p.recipient, amount);
    }
    function tryMigrate() external {
        require(msg.sender == address(this), "only self");
        manager.initialize(_key, uint160(1 << 96));
        require(!innerFailure, "deterministic inner failure");
    }
}

contract GenesisLifecycleControllerTest is Test, DeployPermit2 {
    using PoolIdLibrary for PoolKey;
    OMR internal omr; IPoolManager internal manager; PoolKey internal key;
    LifecycleOracleFixture internal oracle; LifecycleFoundationFixture internal foundation;
    LifecycleStrategyFixture internal strategy; LifecycleAuctionFixture internal auction;
    GenesisProceedsSplitter internal splitter; GenesisLifecycleController internal controller;
    address payable internal constant TREASURY = payable(address(0x7E45));
    address payable internal constant VIG = payable(address(0x716));
    address payable internal constant DEV = payable(address(0xF0A));
    address internal constant STRANGER = address(0xBAD);
    receive() external payable {}

    function setUp() public {
        vm.warp(1_800_000_000); vm.roll(10);
        // Use the real non-IR manager artifact: importing its creation code into POL's
        // required IR profile triggers the existing Solidity 0.8.26 upstream swap Yul bug.
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        omr = new OMR(address(this));
        key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(omr)), 3000, 60, IHooks(address(0)));
        oracle = new LifecycleOracleFixture(); oracle.set(1 ether, block.timestamp, false);
        foundation = new LifecycleFoundationFixture(address(omr), PoolId.unwrap(key.toId()), address(manager), address(oracle));
        strategy = new LifecycleStrategyFixture(manager, key);
        splitter = new GenesisProceedsSplitter(manager, key.toId(), TREASURY, VIG, DEV);
        controller = _controller(foundation, splitter, TREASURY);
        foundation.setController(address(controller));
        auction = new LifecycleAuctionFixture(address(omr), address(strategy), address(controller));
        strategy.register(address(auction), _params());
    }
    function _controller(LifecycleFoundationFixture f, GenesisProceedsSplitter s, address treasury)
        internal returns (GenesisLifecycleController)
    {
        return new GenesisLifecycleController(address(this), IGenesisStrategy(address(strategy)), s,
            IGenesisFoundation(address(f)), oracle, IERC20(address(omr)), treasury, 10 minutes);
    }
    function _params() internal view returns (LifecycleMigrationParameters memory p) {
        p = LifecycleMigrationParameters(address(omr), address(0), 201, 1_653_750e18,
            address(splitter), address(foundation), LifecyclePoolParameters(3000, 60, address(0)),
            abi.encode(uint256(32), uint256(0)),
            abi.encode(uint256(32), uint256(1), uint256(0), uint256(3_750_000)));
    }
    function _bind() internal { controller.bindAuction(IGenesisAuction(address(auction))); }
    function _migrate() internal { _bind(); vm.roll(201); controller.migrate(); }
    function _live() internal {
        _migrate(); controller.acceptFoundation(7);
        uint256 activated = foundation.activationTimestamp();
        vm.warp(activated + 1 hours);
        foundation.setState(true, false, activated, 1 hours);
        oracle.set(1 ether, block.timestamp, false);
    }

    function test_bindingRejectsMisroutedResidualRecipient() public {
        LifecycleMigrationParameters memory p = _params(); p.recipient = STRANGER;
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
    }
    function test_bindingRejectsWrongLpRecipientAndOverriddenPositionPlan() public {
        LifecycleMigrationParameters memory p = _params(); p.positionRecipient = STRANGER;
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
        p = _params(); p.positionDefinitions = hex"1234";
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
    }
    function test_bindingRejectsWrongMigrationClockAndAllocation() public {
        LifecycleMigrationParameters memory p = _params(); p.migrationBlock = 299;
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
        p = _params(); p.lpAllocationSchedule = abi.encode(uint256(32), uint256(1), uint256(0), uint256(5_000_000));
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
    }
    function test_bindingRejectsWrongTokenReserveAndPoolTuple() public {
        LifecycleMigrationParameters memory p = _params(); p.reservedTokenAmountForLP -= 1;
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
        p = _params(); p.poolParameters.fee = 500;
        strategy.register(address(auction), p);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
    }
    function test_constructorRejectsDifferentTreasuryAndFoundationManager() public {
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector);
        _controller(foundation, splitter, STRANGER);
        LifecycleFoundationFixture wrong = new LifecycleFoundationFixture(address(omr), PoolId.unwrap(key.toId()), STRANGER, address(oracle));
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector);
        _controller(wrong, splitter, TREASURY);
    }
    function test_bindingOnlyOwnerBeforeStartAndExactlyOnce() public {
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, STRANGER));
        controller.bindAuction(IGenesisAuction(address(auction)));
        _bind(); assertEq(controller.migrationBlock(), 201);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
    }
    function test_bindingRejectsStartedForeignTokenCurrencyAndRecipients() public {
        vm.roll(100); vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
        vm.roll(10);
        auction.configure(STRANGER, address(0), address(strategy), address(controller), 100, 200);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
        auction.configure(address(omr), STRANGER, address(strategy), address(controller), 100, 200);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
        auction.configure(address(omr), address(0), address(strategy), STRANGER, 100, 200);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); _bind();
    }
    function test_checkpointPermissionlessOnlyOnceAuctionStarted() public {
        vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.checkpoint();
        _bind(); vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.checkpoint();
        vm.roll(100); vm.prank(STRANGER); controller.checkpoint();
        assertEq(auction.checkpoints(), 1);
    }
    function test_successReceiptAfterInnerFailureMarksFailedAndAllowsExactRecovery() public {
        _bind(); strategy.setBehavior(true, false, false);
        vm.deal(address(strategy), 3 ether + 7);
        omr.transfer(address(strategy), 100 ether); omr.transfer(address(auction), 7 ether);
        vm.roll(201); vm.prank(STRANGER); controller.migrate();
        assertTrue(controller.failed()); assertFalse(splitter.canonicalPoolInitialized());
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Failed));
        assertEq(strategy.registeredPoolIds(PoolId.unwrap(key.toId())), address(0));
        controller.distributeResidual(); controller.sweepUnsoldTokens();
        assertEq(TREASURY.balance, 3 ether + 7);
        assertEq(omr.balanceOf(TREASURY), 107 ether);
        assertEq(VIG.balance, 0); assertEq(DEV.balance, 0);
        assertEq(omr.balanceOf(STRANGER), 0);
        vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.migrate();
    }
    function test_outerFailureRollsBackAndCanBeRetried() public {
        _bind(); vm.roll(201); strategy.setBehavior(false, true, false);
        vm.expectRevert("outer failure"); controller.migrate();
        assertFalse(controller.failed()); assertEq(strategy.migrations(), 0);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Migration));
        strategy.setBehavior(false, false, false); controller.migrate();
        assertTrue(splitter.canonicalPoolInitialized()); assertEq(strategy.migrations(), 1);
    }
    function test_registrationMustClearOrSuccessAndPoolInitializationRollBack() public {
        _bind(); vm.roll(201); strategy.setBehavior(false, false, true);
        vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.migrate();
        assertFalse(splitter.canonicalPoolInitialized()); assertEq(strategy.migrations(), 0);
    }
    function test_successUsesActualPoolSignalAndFixedResidualSplit() public {
        vm.deal(address(strategy), 5 ether + 7); omr.transfer(address(strategy), 11 ether);
        _migrate(); assertFalse(controller.failed()); assertTrue(splitter.canonicalPoolInitialized());
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
        controller.distributeResidual();
        uint256 total = 5 ether + 7;
        assertEq(TREASURY.balance, total * 4000 / 10_000);
        assertEq(VIG.balance, total * 3600 / 10_000);
        assertEq(DEV.balance, total - total * 4000 / 10_000 - total * 3600 / 10_000);
        assertEq(omr.balanceOf(TREASURY), 11 ether);
        assertEq(omr.minter(), address(0)); assertEq(omr.owner(), address(this));
        controller.distributeResidual(); // recovered state is an idempotent no-op
    }
    function test_externalMigrationIsObservedAndCanProceedOrRecoverWithoutControllerReceipt() public {
        _bind(); vm.roll(201); strategy.setBehavior(true, false, false);
        vm.deal(address(strategy), 2 ether); strategy.migrate(address(auction));
        assertFalse(controller.failed()); // local flag is not the entire authoritative state
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Failed));
        controller.distributeResidual(); assertEq(TREASURY.balance, 2 ether);
    }
    function test_unsoldOneShotSweepReentryAndLateDonationsGoOnlyToTreasury() public {
        _bind(); vm.roll(201); omr.transfer(address(auction), 100 ether);
        auction.setReentry(address(controller)); vm.prank(STRANGER); controller.sweepUnsoldTokens();
        assertFalse(auction.reentrySucceeded()); assertEq(auction.sweeps(), 1);
        assertEq(omr.balanceOf(TREASURY), 100 ether);
        omr.transfer(address(controller), 13); controller.sweepUnsoldTokens();
        assertEq(auction.sweeps(), 1); assertEq(omr.balanceOf(TREASURY), 100 ether + 13);
    }
    function test_uint256CcaSweepGetterDoesNotTruncateCompletedUpperRangeBlock() public {
        _bind(); vm.roll(201); auction.setSweepBlock(uint256(type(uint64).max) + 1);
        omr.transfer(address(controller), 7); controller.sweepUnsoldTokens();
        assertEq(omr.balanceOf(TREASURY), 7); assertEq(auction.sweeps(), 0);
    }
    function test_sweepFailureIsAtomicAndResumable() public {
        _bind(); vm.roll(201); omr.transfer(address(auction), 7 ether); auction.setSweepFailure(true);
        vm.expectRevert("cannot sweep"); controller.sweepUnsoldTokens();
        assertEq(omr.balanceOf(TREASURY), 0); assertEq(auction.sweeps(), 0);
        auction.setSweepFailure(false); controller.sweepUnsoldTokens(); assertEq(omr.balanceOf(TREASURY), 7 ether);
    }
    function test_stopBlocksProgressAndRecoveryUntilGovernanceResumes() public {
        _bind(); vm.roll(201); controller.setStopped(true);
        vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.migrate();
        vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.sweepUnsoldTokens();
        vm.expectRevert(GenesisLifecycleController.WrongPhase.selector); controller.distributeResidual();
        vm.prank(STRANGER);
        vm.expectRevert(abi.encodeWithSelector(Ownable.OwnableUnauthorizedAccount.selector, STRANGER));
        controller.setStopped(false);
        controller.setStopped(false); controller.migrate();
    }
    function test_renunciationCannotDestroyStoppedRecoveryAuthority() public {
        _bind(); vm.roll(201); omr.transfer(address(auction), 7 ether);
        controller.setStopped(true);
        vm.expectRevert(GenesisLifecycleController.InvalidConfiguration.selector); controller.renounceOwnership();
        assertEq(controller.owner(), address(this));
        controller.transferOwnership(STRANGER); vm.prank(STRANGER); controller.acceptOwnership();
        vm.prank(STRANGER); controller.setStopped(false);
        controller.sweepUnsoldTokens(); assertEq(omr.balanceOf(TREASURY), 7 ether);
    }
    function test_healthOracleWarmupAndEmergencyMustAllAgreeBeforeLive() public {
        _migrate(); controller.acceptFoundation(7);
        uint256 at = foundation.activationTimestamp(); vm.warp(at + 1 hours);
        foundation.setState(true, false, at, 1 hours);
        oracle.set(1 ether, at + 1 hours - 1, false);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
        oracle.set(1 ether, at + 1 hours, false);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Live));
        foundation.setState(true, true, at, 1 hours);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Failed));
    }
    function test_zeroStaleFutureAndBrokenOracleCannotKeepLive() public {
        _live(); assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Live));
        oracle.set(0, block.timestamp, false);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
        oracle.set(1 ether, block.timestamp + 1, false);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
        oracle.set(1 ether, block.timestamp, true);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
        oracle.set(1 ether, block.timestamp, false); vm.warp(block.timestamp + 601);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
    }
    function test_chainAndDependencyDriftFailClosed() public {
        _bind(); vm.chainId(999);
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Failed));
        vm.expectRevert(GenesisLifecycleController.DependencyChanged.selector); controller.checkpoint();
        vm.chainId(controller.chainId()); vm.etch(address(strategy), hex"60006000fd");
        vm.expectRevert(GenesisLifecycleController.DependencyChanged.selector); controller.checkpoint();
    }
    function testFuzz_permissionlessUnsoldConservation(uint96 amount) public {
        amount = uint96(bound(amount, 0, 1_000_000 ether)); _bind(); vm.roll(201);
        omr.transfer(address(auction), amount);
        uint256 supply = omr.totalSupply(); vm.prank(STRANGER); controller.sweepUnsoldTokens();
        assertEq(omr.balanceOf(TREASURY), amount);
        assertEq(omr.balanceOf(address(controller)), 0); assertEq(omr.balanceOf(STRANGER), 0);
        assertEq(omr.totalSupply(), supply);
    }
    function test_orbitClockMatchesPinnedArbSysDetectionOutsideNamedMainnet() public {
        LifecycleArbSysFixture implementation = new LifecycleArbSysFixture();
        vm.etch(address(100), address(implementation).code);
        LifecycleArbSysFixture(address(100)).set(77);
        GenesisLifecycleController orbit = _controller(foundation, splitter, TREASURY);
        assertEq(orbit.currentBlock(), 77);
        vm.roll(999); assertEq(orbit.currentBlock(), 77);
        LifecycleArbSysFixture(address(100)).set(88); assertEq(orbit.currentBlock(), 88);
        vm.etch(address(100), hex"60006000fd"); vm.expectRevert(); orbit.currentBlock();
    }
    function test_namedRobinhoodNetworksUseArbSysRatherThanParentBlockNumber() public {
        LifecycleArbSysFixture implementation = new LifecycleArbSysFixture();
        vm.etch(address(100), address(implementation).code);
        LifecycleArbSysFixture(address(100)).set(10);
        vm.roll(500_000);
        vm.chainId(4663);
        GenesisLifecycleController mainnet = _controller(foundation, splitter, TREASURY);
        assertEq(mainnet.currentBlock(), 10);
        vm.chainId(46630);
        GenesisLifecycleController testnet = _controller(foundation, splitter, TREASURY);
        assertEq(testnet.currentBlock(), 10);
        LifecycleArbSysFixture(address(100)).set(201);
        assertEq(testnet.currentBlock(), 201);
    }
    function test_tokenAndPoolManagerRuntimeDriftAlsoStopProgress() public {
        _bind(); bytes memory tokenCode = address(omr).code;
        vm.etch(address(omr), hex"60006000fd");
        vm.expectRevert(GenesisLifecycleController.DependencyChanged.selector); controller.checkpoint();
        vm.etch(address(omr), tokenCode); vm.etch(address(manager), hex"60006000fd");
        vm.expectRevert(GenesisLifecycleController.DependencyChanged.selector); controller.checkpoint();
    }

    /// Full controller-to-POL composition with real PositionManager, Permit2, PoolManager and OMR.
    /// Auction/strategy remain explicit deterministic fixtures; no upstream auction simulation claim.
    function test_realPolCustodyAdoptionAndWarmupGrantsNoNftOrMintAuthority() public {
        IAllowanceTransfer permit = IAllowanceTransfer(deployPermit2());
        ILifecyclePositionManager pm = ILifecyclePositionManager(deployCode("PositionManager.sol:PositionManager",
            abi.encode(address(manager), address(permit), uint256(100_000), address(0), address(0))));
        ProtocolLiquidityVault.Config memory c;
        c.safe = address(this); c.keeper = STRANGER;
        c.positionManager = IProtocolPositionManager(address(pm)); c.permit2 = permit; c.oracle = oracle; c.key = key;
        c.deskRecipient = DEV; c.vigRecipient = VIG; c.minLiquidity = 1 ether;
        c.warmup = 1 hours; c.maxOracleAge = 10 minutes; c.maxDeviationBps = 500;
        c.budgetWindow = 1 days; c.maxNativePerAction = 20 ether; c.maxNativePerWindow = 40 ether;
        c.maxOmrPerAction = 20 ether; c.maxOmrPerWindow = 40 ether;
        ProtocolLiquidityVault actual = ProtocolLiquidityVault(payable(deployCode(
            "ProtocolLiquidityVault.sol:ProtocolLiquidityVault", abi.encode(c))));
        controller = new GenesisLifecycleController(address(this), IGenesisStrategy(address(strategy)), splitter,
            IGenesisFoundation(address(actual)), oracle, IERC20(address(omr)), TREASURY, 10 minutes);
        actual.setGenesisController(address(controller));
        auction = new LifecycleAuctionFixture(address(omr), address(strategy), address(controller));
        LifecycleMigrationParameters memory p = _params(); p.positionRecipient = address(actual);
        strategy.register(address(auction), p); _migrate();

        omr.approve(address(permit), type(uint256).max);
        permit.approve(address(omr), address(pm), type(uint160).max, type(uint48).max);
        uint256 id = pm.nextTokenId();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(key, TickMath.minUsableTick(60), TickMath.maxUsableTick(60),
            uint256(10 ether), uint128(20 ether), uint128(20 ether), address(actual), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);
        params[2] = abi.encode(key.currency0, address(this));
        vm.deal(address(this), 20 ether);
        pm.modifyLiquidities{value: 20 ether}(abi.encode(
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP)), params),
            block.timestamp);
        assertEq(pm.ownerOf(id), address(actual)); assertEq(actual.positionId(), 0);
        vm.prank(STRANGER); controller.acceptFoundation(id);
        assertEq(actual.positionId(), id); assertEq(actual.owner(), address(this));
        assertEq(pm.getApproved(id), address(0)); assertEq(omr.minter(), address(0));
        assertFalse(actual.healthy());
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.OracleWarmup));
        vm.warp(actual.activationTimestamp() + actual.warmup()); oracle.set(1 ether, block.timestamp, false);
        assertTrue(actual.healthy());
        assertEq(uint256(controller.phase()), uint256(GenesisLifecycleController.Phase.Live));
        vm.expectRevert(ProtocolLiquidityVault.FoundationAlreadySet.selector); controller.acceptFoundation(id);
    }
}
