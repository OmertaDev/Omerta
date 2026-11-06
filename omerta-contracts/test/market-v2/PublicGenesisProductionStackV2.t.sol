// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {PoolSwapTest} from "v4-core/test/PoolSwapTest.sol";
import {SqrtPriceMath} from "v4-core/libraries/SqrtPriceMath.sol";
import {PositionManager} from "../../lib/v4-periphery/src/PositionManager.sol";
import {IPositionManager} from "../../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {LiquidityAmounts} from "../../lib/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {Actions} from "../../lib/v4-periphery/src/libraries/Actions.sol";
import {IPositionDescriptor} from "../../lib/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "../../lib/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {GenesisPlayerSale} from "../../src/GenesisPlayerSale.sol";
import {OmertaGenesisCoordinatorV2, IGenesisGatedAuction} from "../../src/market-v2/OmertaGenesisCoordinatorV2.sol";
import {OmertaGuardedAuction, IOmertaGenesisClaimGate} from "../../src/genesis-auction/OmertaGuardedAuction.sol";
import {AuctionParameters} from "../../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";
import {GenesisLaunchTreasuryFixture, GenesisArbSysClockFixture} from "./PlayerGenesisProductionStackV2.t.sol";

/// @dev Real restricted-token production stack with no player-sale deployment or inventory.
/// The local treasury/ArbSys fixtures do not prove production Safe signing or native block cadence.
contract PublicGenesisProductionStackV2Test is Test, DeployPermit2 {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for *;

    uint256 private constant Q96 = 1 << 96;
    uint256 private constant PUBLIC_INVENTORY = 1000 ether;
    uint128 private constant LP_RESERVE = 1000 ether;
    GenesisLaunchTreasuryFixture private treasury;
    GenesisArbSysClockFixture private clock;
    OmertaRestrictedOMRV2 private token;
    IPoolManager private manager;
    PositionManager private positions;
    IAllowanceTransfer private permit;
    OmertaGenesisCoordinatorV2 private coordinator;
    OmertaGuardedAuction private auction;
    address private bob = address(0xB0B);
    address[4] private recipients = [address(0x11), address(0x12), address(0x13), address(0x14)];

    function setUp() public {
        vm.warp(3600);
        vm.roll(100);
        vm.etch(address(0x64), type(GenesisArbSysClockFixture).runtimeCode);
        clock = GenesisArbSysClockFixture(address(0x64));
        clock.setBlockNumber(100);
        vm.deal(bob, 1000 ether);
        treasury = new GenesisLaunchTreasuryFixture();
        token = new OmertaRestrictedOMRV2(address(treasury));
        manager = IPoolManager(deployCode("OmertaPoolManagerV2.sol:OmertaPoolManagerV2",
            abi.encode(address(token), address(treasury), recipients, recipients[2])));
        permit = IAllowanceTransfer(deployPermit2());
        positions = new PositionManager(manager, permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address hook = address(uint160((uint256(0xDADC) << 144) | flags));
        coordinator = new OmertaGenesisCoordinatorV2(manager, positions, permit, token, IHooks(hook),
            3000, 60, LP_RESERVE, address(treasury), address(treasury), recipients[1], recipients[2]);
        address[5] memory hookRecipients = [recipients[0], recipients[1], recipients[2], recipients[3], address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(coordinator),
            uint24(3000), int24(60), hookRecipients, OmertaHookV2.OpeningConfig(200, 50, 10 ether),
            uint24(100), uint32(60), hookRecipients[2]), hook);
        AuctionParameters memory p = AuctionParameters(address(0), address(treasury), address(coordinator),
            110, 120, 130, 2, address(0), (Q96 / 1000) / 2 * 2, 3 ether,
            abi.encodePacked(uint24(1_000_000), uint40(10)));
        // Preserve the release's default non-IR CCA artifact inside this via-IR integration test.
        auction = OmertaGuardedAuction(deployCode("out/OmertaGuardedAuction.sol/OmertaGuardedAuction.json",
            abi.encode(address(token), uint128(PUBLIC_INVENTORY), p, IOmertaGenesisClaimGate(address(coordinator)))));
        _register(hook, IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(coordinator), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(auction), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(positions), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(permit), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _safe(address(token), abi.encodeCall(token.bindSettlementManager, (address(manager), address(manager).codehash)));
        for (uint256 i; i < recipients.length; ++i) _enroll(recipients[i]);
        _enroll(bob);
    }

    function _safe(address target, bytes memory data) private { treasury.execute(target, data); }

    function _register(address operator, IOmertaRestrictedOMRV2.OperatorRole role) private {
        _safe(address(token), abi.encodeCall(token.setOperator, (operator, role, operator.codehash)));
    }

    function _enroll(address wallet) private {
        vm.prank(wallet, wallet);
        token.registerWallet(wallet);
    }

    function _auctionBlock(uint64 number) private {
        clock.setBlockNumber(number);
        vm.roll(number);
    }

    function _bindPublic() private { coordinator.bindPublicAuction(IGenesisGatedAuction(address(auction))); }

    function _sealAndFund(bool activateAuction) private {
        _bindPublic();
        _safe(address(token), abi.encodeCall(token.sealPolicy, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(coordinator), LP_RESERVE)));
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        if (activateAuction) {
            _safe(address(token), abi.encodeCall(token.approve, (address(auction), PUBLIC_INVENTORY)));
            _safe(address(auction), abi.encodeCall(auction.fundInventory, ()));
        }
    }

    function _bid(uint256 amount) private returns (uint256 id) {
        _auctionBlock(110);
        vm.prank(bob);
        id = auction.submitBid{value: amount}(Q96, uint128(amount), bob, bytes(""));
        _auctionBlock(120);
    }

    function _graduate(uint256 amount) private returns (uint256 id, uint256 publicProceeds) {
        id = _bid(amount);
        coordinator.checkpointAuction();
        auction.exitBid(id);
        (,, publicProceeds) = IGenesisGatedAuction(address(auction)).lbpInitializationParams();
    }

    function _assertAccounting(uint256 publicProceeds) private view {
        uint256 budget = publicProceeds * 5000 / 10_000;
        uint256 spent = address(manager).balance;
        assertGe(spent, budget * 9900 / 10_000);
        assertLe(spent, budget);
        uint256 residual = publicProceeds - spent;
        assertEq(coordinator.residualCredit(address(treasury)), residual * 4000 / 10_000);
        assertEq(coordinator.residualCredit(recipients[1]), residual * 3600 / 10_000);
        assertEq(coordinator.residualCredit(recipients[2]), residual - residual * 4000 / 10_000 - residual * 3600 / 10_000);
        assertEq(address(coordinator).balance, residual);
        assertEq(token.allowance(address(coordinator), address(permit)), 0);
        (uint160 remaining,,) = permit.allowance(address(coordinator), address(token), address(positions));
        assertEq(remaining, 0);
        assertEq(positions.ownerOf(1), address(coordinator));
        assertGt(positions.getPositionLiquidity(1), 0);
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY() - PUBLIC_INVENTORY - LP_RESERVE);
        assertEq(token.totalSupply(), token.SUPPLY());
    }

    function testPublicBindingHasNoPlayerContractAndCannotChangeMode() public {
        _bindPublic();
        assertTrue(coordinator.publicOnly());
        assertEq(address(coordinator.playerSale()), address(0));
        assertEq(coordinator.saleCodeHash(), bytes32(0));
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        _bindPublic();
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(IGenesisGatedAuction(address(auction)), GenesisPlayerSale(address(0)));
    }

    function testBindingRequiresConfiguratorValidAuctionAndPreStartClock() public {
        vm.prank(bob);
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        coordinator.bindPublicAuction(IGenesisGatedAuction(address(auction)));
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        coordinator.bindPublicAuction(IGenesisGatedAuction(address(0)));
        _auctionBlock(110);
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        _bindPublic();
        assertEq(address(coordinator.auction()), address(0));
        assertFalse(coordinator.publicOnly());
    }

    function testPublicFundingRequiresSealTreasuryAndOneTimeExactInventory() public {
        _bindPublic();
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        _safe(address(token), abi.encodeCall(token.sealPolicy, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(coordinator), LP_RESERVE)));
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.fundInventory();
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        assertTrue(coordinator.inventoryFunded());
        assertEq(token.balanceOf(address(coordinator)), LP_RESERVE);
        assertEq(token.allowance(address(treasury), address(coordinator)), 0);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(auction), PUBLIC_INVENTORY)));
        _auctionBlock(110);
        vm.expectRevert(OmertaGuardedAuction.InvalidInventoryFunding.selector);
        _safe(address(auction), abi.encodeCall(auction.fundInventory, ()));
    }

    function testPublicMigrationHasNoFollowOnWindowAndClaimsKeepOriginalCliff() public {
        _sealAndFund(true);
        (uint256 id, uint256 proceeds) = _graduate(4 ether);
        assertEq(block.timestamp, 3600);
        coordinator.migrate();
        assertTrue(coordinator.playerMigrationSucceeded());
        assertFalse(coordinator.playerClaimsOpen());
        _assertAccounting(proceeds);
        _enroll(bob);
        _auctionBlock(129);
        vm.expectRevert();
        auction.claimTokens(id);
        _auctionBlock(130);
        assertTrue(coordinator.playerClaimsOpen());
        auction.claimTokens(id);
        assertGt(token.balanceOf(bob), 0);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.migrate();
    }

    function testClaimRemainsClosedAtCliffUntilPublicMigrationSucceeds() public {
        _sealAndFund(true);
        (uint256 id,) = _graduate(4 ether);
        _enroll(bob);
        _auctionBlock(130);
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector);
        auction.claimTokens(id);
        coordinator.migrate();
        auction.claimTokens(id);
        assertGt(token.balanceOf(bob), 0);
    }

    function testFuzzPublicProceedsPreserveLiquidityAndResidualAccounting(uint128 bid) public {
        uint256 amount = bound(bid, 4 ether, 100 ether);
        _sealAndFund(true);
        (uint256 id, uint256 proceeds) = _graduate(amount);
        coordinator.migrate();
        _assertAccounting(proceeds);
        _auctionBlock(130);
        _enroll(bob);
        uint256[] memory ids = new uint256[](1);
        ids[0] = id;
        auction.claimTokensBatch(bob, ids);
        assertGt(token.balanceOf(bob), 0);
    }

    function testPublicModeRejectsPlayerCallbacksAndCancellationMigration() public {
        _bindPublic();
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.finalizePlayerProceeds();
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.migratePublicAfterCancellation();
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.migrate();
    }

    function testUnsuccessfulPublicAuctionRefundAndReserveRecoveryNeedNoPlayerCancellation() public {
        _sealAndFund(true);
        _auctionBlock(109);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.recoverTokenDust();
        uint256 id = _bid(2 ether);
        auction.checkpoint();
        assertFalse(auction.isGraduated());
        auction.exitBid(id);
        assertEq(bob.balance, 1000 ether);
        coordinator.recoverTokenDust();
        _safe(address(auction), abi.encodeCall(auction.sweepUnsoldTokens, ()));
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY());
        assertEq(token.balanceOf(address(coordinator)), 0);
        assertEq(block.timestamp, 3600);
        assertFalse(coordinator.playerMigrationSucceeded());
    }

    function testNeverActivatedReserveRecoversOnlyAfterAuctionEnd() public {
        _sealAndFund(false);
        _auctionBlock(119);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.recoverTokenDust();
        _auctionBlock(120);
        coordinator.recoverTokenDust();
        assertFalse(auction.tokensReceived());
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY());
        assertEq(token.balanceOf(address(coordinator)), 0);
    }

    function testGraduatedAuctionCannotRecoverItsMatchingReserveBeforeMigration() public {
        _sealAndFund(true);
        _graduate(4 ether);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.recoverTokenDust();
        assertEq(token.balanceOf(address(coordinator)), LP_RESERVE);
        coordinator.migrate();
        coordinator.recoverTokenDust();
        assertEq(token.balanceOf(address(coordinator)), 0);
    }

    function testMigrationFailureRollsBackSweepPoolApprovalsAndCreditsThenRetries() public {
        _sealAndFund(true);
        (, uint256 proceeds) = _graduate(4 ether);
        uint256 auctionBalance = address(auction).balance;
        vm.mockCallRevert(address(positions), abi.encodeWithSelector(IPositionManager.modifyLiquidities.selector),
            abi.encodeWithSignature("Error(string)", "position mint failed"));
        vm.expectRevert();
        coordinator.migrate();
        assertEq(address(auction).balance, auctionBalance);
        assertEq(address(coordinator).balance, 0);
        assertEq(coordinator.residualCredit(address(treasury)), 0);
        assertEq(token.balanceOf(address(coordinator)), LP_RESERVE);
        assertEq(token.allowance(address(coordinator), address(permit)), 0);
        (uint160 sqrtPrice,,,) = manager.getSlot0(coordinator.poolKey().toId());
        assertEq(sqrtPrice, 0);
        assertFalse(coordinator.playerMigrationSucceeded());
        vm.clearMockedCalls();
        coordinator.migrate();
        _assertAccounting(proceeds);
    }

    function testRuntimeDriftCannotMigratePublicAuction() public {
        _sealAndFund(true);
        _graduate(4 ether);
        vm.etch(address(positions), hex"00");
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.migrate();
        assertFalse(coordinator.playerMigrationSucceeded());
        assertEq(token.balanceOf(address(coordinator)), LP_RESERVE);
    }

    function testFuzzLifecycleOrderingPreservesReserveAndClaimGates(bytes32 sequence, bool graduates) public {
        _sealAndFund(true);
        uint256 id = _bid(graduates ? 4 ether : 2 ether);
        _enroll(bob);
        for (uint256 i; i < 32; ++i) {
            uint8 action = uint8(sequence[i]) % 7;
            if (action == 0) { try coordinator.checkpointAuction() {} catch {} }
            else if (action == 1) { try coordinator.migrate() {} catch {} }
            else if (action == 2) { try coordinator.recoverTokenDust() {} catch {} }
            else if (action == 3) _auctionBlock(130);
            else if (action == 4) { try auction.exitBid(id) {} catch {} }
            else if (action == 5) { try auction.claimTokens(id) {} catch {} }
            else { try coordinator.migratePublicAfterCancellation() { fail(); } catch {} }
            assertTrue(coordinator.publicOnly());
            assertEq(address(coordinator.playerSale()), address(0));
            if (token.balanceOf(bob) > 0) {
                assertTrue(coordinator.playerMigrationSucceeded());
                assertTrue(auction.claimsReady());
            }
            if (!coordinator.playerMigrationSucceeded() && token.balanceOf(address(coordinator)) == 0) {
                assertFalse(auction.isGraduated());
                assertFalse(graduates);
            }
            if (coordinator.playerMigrationSucceeded()) {
                assertTrue(graduates);
                assertEq(positions.ownerOf(1), address(coordinator));
                assertGt(positions.getPositionLiquidity(1), 0);
                assertEq(token.allowance(address(coordinator), address(permit)), 0);
            }
        }
    }

    function testNativeAuctionAndHookOpeningClocksRemainSeparate() public {
        vm.roll(10_000);
        _sealAndFund(true);
        _graduate(4 ether);
        clock.setBlockNumber(120);
        vm.roll(10_000);
        coordinator.migrate();
        OmertaHookV2 hook = OmertaHookV2(payable(address(coordinator.poolKey().hooks)));
        assertEq(hook.openedAtBlock(), 10_000);
        assertFalse(coordinator.playerClaimsOpen());
        clock.setBlockNumber(130);
        assertTrue(coordinator.playerClaimsOpen());
    }

    function _replacementAuction(OmertaGenesisCoordinatorV2 gate, uint64 duration, uint128 requiredRaise)
        private returns (OmertaGuardedAuction)
    {
        AuctionParameters memory p = AuctionParameters(address(0), address(treasury), address(gate),
            110, 110 + duration, 120 + duration, 2, address(0), (Q96 / 1000) / 2 * 2, requiredRaise,
            abi.encodePacked(uint24(10_000_000 / duration), uint40(duration)));
        return OmertaGuardedAuction(deployCode("out/OmertaGuardedAuction.sol/OmertaGuardedAuction.json",
            abi.encode(address(token), uint128(PUBLIC_INVENTORY), p, IOmertaGenesisClaimGate(address(gate)))));
    }

    function testUnderReservedLaunchIsRejectedBeforeFundingOrBids() public {
        IHooks hook = coordinator.poolKey().hooks;
        OmertaGenesisCoordinatorV2 underReserved = new OmertaGenesisCoordinatorV2(manager, positions, permit,
            token, hook, 3000, 60, 1 ether, address(treasury), address(treasury), recipients[1], recipients[2]);
        address[5] memory hookRecipients = [recipients[0], recipients[1], recipients[2], recipients[3], address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(underReserved),
            uint24(3000), int24(60), hookRecipients, OmertaHookV2.OpeningConfig(200, 50, 10 ether),
            uint24(100), uint32(60), hookRecipients[2]), address(hook));
        OmertaGuardedAuction unsupported = _replacementAuction(underReserved, 10, 3 ether);
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        underReserved.bindPublicAuction(IGenesisGatedAuction(address(unsupported)));
        assertEq(address(underReserved.auction()), address(0));
        assertEq(address(unsupported).balance, 0);
    }

    function testDustGraduationThresholdIsRejectedBeforeBids() public {
        auction = _replacementAuction(coordinator, 10, 1);
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        _bindPublic();
    }

    function testFuzzMinimumReserveFundsFullNativeLegAcrossSupportedPrices(uint256 candidate) public {
        _bindPublic();
        uint256 price = bound(candidate, auction.floorPrice(), auction.MAX_BID_PRICE());
        uint160 sqrtPrice = uint160(Math.sqrt(Math.mulDiv(uint256(1) << 192, Q96, price)));
        uint160 lower = TickMath.getSqrtPriceAtTick(TickMath.minUsableTick(60));
        uint160 upper = TickMath.getSqrtPriceAtTick(TickMath.maxUsableTick(60));
        uint256 nativeBudget = Math.mulDiv(Math.mulDiv(PUBLIC_INVENTORY, price, Q96), 5000, 10_000);
        uint128 expected = LiquidityAmounts.getLiquidityForAmount0(sqrtPrice, upper, nativeBudget);
        assertGt(expected, 0);
        assertEq(LiquidityAmounts.getLiquidityForAmounts(sqrtPrice, lower, upper, nativeBudget,
            coordinator.minimumTokenReserve()), expected);
        uint256 spent = SqrtPriceMath.getAmount0Delta(sqrtPrice, upper, expected, true);
        assertLe(spent, nativeBudget);
        assertGe(spent, Math.mulDiv(nativeBudget, 9900, 10_000));
    }

    function testTinyClosingBidCannotRepriceThePublicLiquidityAboveSaleAverage() public {
        uint64 duration = 1_000_000;
        auction = _replacementAuction(coordinator, duration, 3 ether);
        _register(address(auction), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _sealAndFund(true);
        _auctionBlock(110);
        vm.prank(bob);
        auction.submitBid{value: 4 ether}(Q96, uint128(4 ether), bob, bytes(""));
        _auctionBlock(110 + duration - 1);
        vm.prank(bob);
        auction.submitBid{value: 0.0004 ether}(Q96, uint128(0.0004 ether), bob, bytes(""));
        _auctionBlock(110 + duration);
        coordinator.checkpointAuction();
        (, uint256 sold, uint256 proceeds) = IGenesisGatedAuction(address(auction)).lbpInitializationParams();
        uint256 average = Math.mulDiv(proceeds, Q96, sold, Math.Rounding.Ceil);
        assertGt(coordinator.playerPriceX96(), average * 100);
        assertEq(coordinator.liquidityPriceX96(), average);
        coordinator.migrate();
        assertGt(token.balanceOf(address(manager)), sold * 49 / 100);
        assertGt(address(manager).balance, proceeds * 49 / 100);
    }

    function testGenesisLiquidityWaitsForClaimCliffAndNinetyDaysAfterMigrationAndReleasesOnce() public {
        _sealAndFund(true);
        _graduate(4 ether);
        coordinator.migrate();
        uint256 migratedAt = block.timestamp;
        assertEq(coordinator.migrationTimestamp(), migratedAt);
        assertEq(coordinator.liquidityUnlockTimestamp(), migratedAt + 90 days);
        uint128 liquidity = positions.getPositionLiquidity(1);
        bytes[] memory params = new bytes[](2);
        params[0] = abi.encode(uint256(1), uint256(liquidity), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(coordinator.poolKey().currency0, coordinator.poolKey().currency1, address(treasury));
        bytes memory remove = abi.encodeCall(positions.modifyLiquidities, (abi.encode(
            abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR)), params), block.timestamp));
        vm.expectRevert(); _safe(address(positions), remove);
        vm.expectRevert();
        _safe(address(positions), abi.encodeCall(positions.transferFrom, (address(coordinator), address(treasury), uint256(1))));
        vm.expectRevert();
        _safe(address(positions), abi.encodeCall(positions.approve, (address(treasury), uint256(1))));
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector); coordinator.releaseLiquidity();
        assertEq(positions.ownerOf(1), address(coordinator));
        assertEq(positions.getPositionLiquidity(1), liquidity);
        _auctionBlock(130);
        assertTrue(auction.claimsReady());
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector); coordinator.releaseLiquidity();
        vm.warp(migratedAt + 90 days - 1);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector); coordinator.releaseLiquidity();
        vm.warp(migratedAt + 90 days);
        coordinator.releaseLiquidity();
        assertEq(positions.ownerOf(1), address(treasury));
        assertEq(coordinator.liquidityPositionId(), 0);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector); coordinator.releaseLiquidity();
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector); coordinator.collectLiquidityFees();
        remove = abi.encodeCall(positions.modifyLiquidities, (abi.encode(
            abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR)), params), block.timestamp));
        _safe(address(positions), remove);
        assertEq(positions.getPositionLiquidity(1), 0);
    }

    function testNinetyDaysCannotBypassTheNativeAuctionClaimCliff() public {
        _sealAndFund(true);
        _graduate(4 ether);
        coordinator.migrate();
        vm.warp(coordinator.liquidityUnlockTimestamp());
        assertFalse(auction.claimsReady());
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.releaseLiquidity();
        assertEq(positions.ownerOf(1), address(coordinator));
        _auctionBlock(130);
        coordinator.releaseLiquidity();
        assertEq(positions.ownerOf(1), address(treasury));
    }

    function testLateMigrationBeginsANewFullNinetyDayPrincipalLock() public {
        _sealAndFund(true);
        _graduate(4 ether);
        _auctionBlock(130);
        vm.warp(block.timestamp + 100 days);
        uint256 migratedAt = block.timestamp;
        coordinator.migrate();
        assertTrue(auction.claimsReady());
        assertEq(coordinator.migrationTimestamp(), migratedAt);
        assertEq(coordinator.liquidityUnlockTimestamp(), migratedAt + 90 days);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.releaseLiquidity();
        vm.warp(migratedAt + 90 days);
        coordinator.releaseLiquidity();
        assertEq(positions.ownerOf(1), address(treasury));
    }

    function testActualRestrictedSwapFeesCanBeCollectedWhilePrincipalAndNftStayLocked() public {
        PoolSwapTest router = new PoolSwapTest(manager);
        _register(address(router), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _sealAndFund(true);
        _graduate(4 ether);
        coordinator.migrate();
        uint128 principal = positions.getPositionLiquidity(1);
        uint256 nativeBefore = address(treasury).balance;
        uint256 coordinatorBefore = address(coordinator).balance;
        vm.startPrank(bob);
        router.swap{value: 0.1 ether}(coordinator.poolKey(), SwapParams(true, -int256(0.1 ether), TickMath.MIN_SQRT_PRICE + 1),
            PoolSwapTest.TestSettings(false, false), bytes(""));
        vm.stopPrank();
        assertGt(token.balanceOf(bob), 0, "the registered buyer receives the actual swap output");
        assertFalse(auction.claimsReady());
        vm.prank(bob);
        coordinator.collectLiquidityFees();
        assertGt(address(treasury).balance, nativeBefore, "actual earned LP fees reach only the fixed owner");
        assertEq(address(coordinator).balance, coordinatorBefore, "residual credits cannot be collected as fees");
        assertEq(positions.ownerOf(1), address(coordinator));
        assertEq(positions.getPositionLiquidity(1), principal);
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.releaseLiquidity();
    }

    function testUnsupportedSmartWalletCannotBuyAndReviewedWalletCanClaim() public {
        GenesisLaunchTreasuryFixture wallet = new GenesisLaunchTreasuryFixture();
        _safe(address(token), abi.encodeCall(token.setContractHolder, (address(wallet), address(wallet).codehash)));
        _sealAndFund(true);
        _auctionBlock(110);
        vm.startPrank(bob);
        vm.expectRevert(OmertaGuardedAuction.UnsupportedBidOwner.selector);
        auction.submitBid{value: 4 ether}(Q96, uint128(4 ether), address(clock), bytes(""));
        uint256 id = auction.submitBid{value: 4 ether}(Q96, uint128(4 ether), address(wallet), bytes(""));
        vm.stopPrank();
        assertEq(bob.balance, 996 ether);
        _auctionBlock(120);
        coordinator.checkpointAuction(); auction.exitBid(id); coordinator.migrate();
        _auctionBlock(130); auction.claimTokens(id);
        assertGt(token.balanceOf(address(wallet)), 0);
    }
}
