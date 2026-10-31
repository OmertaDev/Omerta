// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PositionManager} from "../../lib/v4-periphery/src/PositionManager.sol";
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

/// @dev Exercises contract treasury callers without granting the treasury a token operator role.
/// This fixture does not test Safe signatures, thresholds or production deployment infrastructure.
contract GenesisLaunchTreasuryFixture {
    address private immutable operator = msg.sender;

    function execute(address target, bytes calldata data) external returns (bytes memory result) {
        require(msg.sender == operator);
        bool ok;
        (ok, result) = target.call(data);
        if (!ok) assembly ("memory-safe") { revert(add(result, 32), mload(result)) }
    }

    receive() external payable {}
}

/// @dev Local native auction clock fixture; it does not prove Robinhood production block cadence.
contract GenesisArbSysClockFixture {
    uint256 private number;
    function setBlockNumber(uint256 value) external { number = value; }
    function arbBlockNumber() external view returns (uint256) { return number; }
}

/// @dev Real restricted token, custom settlement manager, paired PositionManager and Permit2,
/// canonical hook, guarded CCA, player sale and coordinator. No token mint/funding shortcuts.
contract PlayerGenesisProductionStackV2Test is Test, DeployPermit2 {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for *;

    uint256 private constant Q96 = 1 << 96;
    uint256 private constant PUBLIC_INVENTORY = 1000 ether;
    uint256 private constant PLAYER_INVENTORY = 100 ether;
    uint128 private constant LP_RESERVE = 1000 ether;
    GenesisLaunchTreasuryFixture private treasury;
    GenesisArbSysClockFixture private clock;
    OmertaRestrictedOMRV2 private token;
    IPoolManager private manager;
    PositionManager private positions;
    IAllowanceTransfer private permit;
    OmertaGenesisCoordinatorV2 private coordinator;
    OmertaGuardedAuction private auction;
    GenesisPlayerSale private sale;
    address private alice = address(0xA11CE);
    address private bob = address(0xB0B);
    address[4] private recipients = [address(0x11), address(0x12), address(0x13), address(0x14)];

    function setUp() public {
        vm.warp(3600);
        vm.roll(100);
        vm.etch(address(0x64), type(GenesisArbSysClockFixture).runtimeCode);
        clock = GenesisArbSysClockFixture(address(0x64));
        clock.setBlockNumber(100);
        vm.deal(alice, 10 ether);
        vm.deal(bob, 10 ether);
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
        // Explicit artifact paths preserve the release's non-IR auction/sale profiles even though
        // this integration harness itself uses the market's required via-IR test profile.
        auction = OmertaGuardedAuction(deployCode("out/OmertaGuardedAuction.sol/OmertaGuardedAuction.json",
            abi.encode(address(token), uint128(PUBLIC_INVENTORY), p, IOmertaGenesisClaimGate(address(coordinator)))));
        address predicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        bytes32 root = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, predicted, alice, uint8(2)))));
        sale = GenesisPlayerSale(deployCode("out/GenesisPlayerSale.sol/GenesisPlayerSale.json",
            abi.encode(token, coordinator, root, PLAYER_INVENTORY, block.timestamp + 1 days,
                block.timestamp + 10 days, address(treasury))));
        assertEq(address(sale), predicted);
        coordinator.bind(IGenesisGatedAuction(address(auction)), sale);
        _register(hook, IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(coordinator), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(auction), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(sale), IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody);
        _register(address(positions), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _register(address(permit), IOmertaRestrictedOMRV2.OperatorRole.SettlementInput);
        _safe(address(token), abi.encodeCall(token.bindSettlementManager, (address(manager), address(manager).codehash)));
        _enroll(alice);
        _enroll(bob);
        for (uint256 i; i < recipients.length; ++i) _enroll(recipients[i]);
    }

    function _safe(address target, bytes memory data) private {
        treasury.execute(target, data);
    }

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

    function _sealAndFund() private {
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY());
        assertEq(uint256(token.operatorRole(address(treasury))), uint256(IOmertaRestrictedOMRV2.OperatorRole.None));
        _safe(address(token), abi.encodeCall(token.sealPolicy, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(coordinator), LP_RESERVE)));
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(sale), PLAYER_INVENTORY)));
        _safe(address(sale), abi.encodeCall(sale.fundInventory, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(auction), PUBLIC_INVENTORY)));
        _safe(address(auction), abi.encodeCall(auction.fundInventory, ()));
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY() - PUBLIC_INVENTORY - PLAYER_INVENTORY - LP_RESERVE);
        assertEq(token.allowance(address(treasury), address(coordinator)), 0);
        assertEq(token.allowance(address(treasury), address(sale)), 0);
        assertEq(token.allowance(address(treasury), address(auction)), 0);
    }

    function _bid(uint256 amount) private returns (uint256 id) {
        _auctionBlock(110);
        vm.prank(bob);
        id = auction.submitBid{value: amount}(Q96, uint128(amount), bob, bytes(""));
        _auctionBlock(120);
    }

    function _openPlayerSale() private returns (uint256 id) {
        id = _bid(4 ether);
        coordinator.checkpointAuction();
        auction.exitBid(id);
        sale.open();
        vm.prank(alice);
        sale.contribute{value: 1 ether}(2, new bytes32[](0));
    }

    function testTypedFundingRequiresSealTreasuryAndOneTimeBounds() public {
        vm.expectRevert(OmertaGuardedAuction.InvalidInventoryFunding.selector);
        _safe(address(auction), abi.encodeCall(auction.fundInventory, ()));
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector);
        _safe(address(sale), abi.encodeCall(sale.fundInventory, ()));
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        _sealAndFund();
        assertTrue(auction.inventoryFunded());
        assertTrue(sale.inventoryFunded());
        assertTrue(coordinator.inventoryFunded());
        vm.expectRevert(OmertaGuardedAuction.InvalidInventoryFunding.selector);
        _safe(address(auction), abi.encodeCall(auction.fundInventory, ()));
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector);
        _safe(address(sale), abi.encodeCall(sale.fundInventory, ()));
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        vm.expectRevert(OmertaRestrictedOMRV2.UnauthorizedTransfer.selector);
        _safe(address(token), abi.encodeCall(token.transfer, (alice, 1 ether)));
        vm.expectRevert(GenesisPlayerSale.WrongPhase.selector);
        sale.fundInventory();
        assertEq(token.totalSupply(), token.SUPPLY());
    }

    function testRestrictedStackMigratesAndBothClaimWithNoResidualAllowance() public {
        _sealAndFund();
        uint256 id = _openPlayerSale();
        _auctionBlock(130);
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector);
        auction.claimTokens(id);
        vm.warp(sale.closesAt());
        sale.settle(alice);
        uint256 accepted = sale.totalAccepted();
        (, , uint256 publicProceeds) = IGenesisGatedAuction(address(auction)).lbpInitializationParams();
        uint256 total = publicProceeds + accepted;
        coordinator.migrate();
        assertTrue(coordinator.playerClaimsOpen());
        assertTrue(sale.released());
        assertEq(positions.ownerOf(1), address(coordinator));
        assertGt(positions.getPositionLiquidity(1), 0);
        assertGe(address(manager).balance, total * 5000 / 10_000 * 9900 / 10_000);
        assertLe(address(manager).balance, total * 5000 / 10_000);
        uint256 residual = total - address(manager).balance;
        assertEq(coordinator.residualCredit(address(treasury)), residual * 4000 / 10_000);
        assertEq(coordinator.residualCredit(recipients[1]), residual * 3600 / 10_000);
        assertEq(coordinator.residualCredit(recipients[2]), residual - residual * 4000 / 10_000 - residual * 3600 / 10_000);
        assertEq(token.allowance(address(coordinator), address(permit)), 0);
        (uint160 remaining, uint48 expiration,) = permit.allowance(address(coordinator), address(token), address(positions));
        assertEq(remaining, 0);
        // Permit2 normalizes an expiration input of zero to the current timestamp; amount zero revokes access.
        assertEq(expiration, block.timestamp);
        // Bid acceptance already required the restricted recipient to be enrolled.
        auction.claimTokens(id);
        assertGt(token.balanceOf(bob), 0);
        vm.prank(alice);
        sale.claim();
        assertEq(token.balanceOf(alice), sale.allocation(alice));
        vm.prank(alice);
        sale.refund();
        assertEq(alice.balance, 10 ether - accepted);
        sale.recoverUnsold();
        coordinator.recoverTokenDust();
        assertEq(token.balanceOf(address(coordinator)), 0);
        assertEq(token.totalSupply(), token.SUPPLY());
    }

    function testPlayerCancellationPreservesPublicMigrationAndFullRefund() public {
        _sealAndFund();
        uint256 id = _openPlayerSale();
        _auctionBlock(130);
        vm.warp(sale.migrationDeadline());
        sale.cancel();
        vm.expectRevert(OmertaGenesisCoordinatorV2.WrongPhase.selector);
        coordinator.recoverTokenDust();
        coordinator.migratePublicAfterCancellation();
        vm.prank(alice);
        sale.refund();
        assertEq(alice.balance, 10 ether);
        assertFalse(sale.released());
        assertTrue(coordinator.playerClaimsOpen());
        _enroll(bob);
        auction.claimTokens(id);
        assertGt(token.balanceOf(bob), 0);
        sale.recoverUnsold();
        assertEq(token.balanceOf(address(sale)), 0);
    }

    function testUnsuccessfulPublicAuctionRefundsAndFixedInventoryCanRecover() public {
        _sealAndFund();
        uint256 id = _bid(2 ether);
        auction.checkpoint();
        assertFalse(auction.isGraduated());
        auction.exitBid(id);
        assertEq(bob.balance, 10 ether);
        vm.warp(sale.migrationDeadline());
        sale.cancel();
        coordinator.recoverTokenDust();
        sale.recoverUnsold();
        _safe(address(auction), abi.encodeCall(auction.sweepUnsoldTokens, ()));
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY());
        assertEq(token.balanceOf(address(coordinator)), 0);
        assertEq(token.balanceOf(address(sale)), 0);
        assertEq(token.balanceOf(address(auction)), 0);
        assertFalse(coordinator.playerMigrationSucceeded());
    }

    function testPositionManagerPermit2MismatchRejectedBeforeFunding() public {
        address different = address(0xA551);
        vm.etch(different, address(permit).code);
        IAllowanceTransfer differentPermit = IAllowanceTransfer(different);
        IHooks hook = coordinator.poolKey().hooks;
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector);
        new OmertaGenesisCoordinatorV2(manager, positions, differentPermit, IERC20(address(token)),
            hook, 3000, 60, LP_RESERVE, address(treasury), address(treasury), recipients[1], recipients[2]);
    }

    function testNonTreasuryCannotPullApprovedInventory() public {
        _safe(address(token), abi.encodeCall(token.sealPolicy, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(auction), PUBLIC_INVENTORY)));
        vm.expectRevert(OmertaGuardedAuction.InvalidInventoryFunding.selector);
        auction.fundInventory();
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY());
        assertEq(token.balanceOf(address(auction)), 0);
        assertFalse(auction.inventoryFunded());
    }

    function testNeverActivatedAuctionReturnsReserveAfterCancellation() public {
        _safe(address(token), abi.encodeCall(token.sealPolicy, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(coordinator), LP_RESERVE)));
        _safe(address(coordinator), abi.encodeCall(coordinator.fundInventory, ()));
        _safe(address(token), abi.encodeCall(token.approve, (address(sale), PLAYER_INVENTORY)));
        _safe(address(sale), abi.encodeCall(sale.fundInventory, ()));
        _auctionBlock(120);
        vm.warp(sale.migrationDeadline());
        sale.cancel();
        coordinator.recoverTokenDust();
        sale.recoverUnsold();
        assertFalse(auction.tokensReceived());
        assertEq(token.balanceOf(address(treasury)), token.SUPPLY());
        assertEq(token.balanceOf(address(coordinator)), 0);
    }

    function testFundingUsesNativeAuctionClockAndHookUsesLocalOpeningClock() public {
        vm.roll(10_000);
        assertEq(auction.blockNumberish(), 100);
        _sealAndFund();
        uint256 id = _openPlayerSale();
        vm.warp(sale.closesAt());
        sale.settle(alice);
        // The auction claim cliff is native-clock 130 while the hook opens on local L2 block 10,000.
        clock.setBlockNumber(130);
        vm.roll(10_000);
        coordinator.migrate();
        OmertaHookV2 hook = OmertaHookV2(payable(address(coordinator.poolKey().hooks)));
        assertEq(hook.openedAtBlock(), 10_000);
        assertEq(hook.openingEndsAtBlock(), 10_000 + hook.openingBlocks());
        assertTrue(coordinator.playerClaimsOpen());
        _enroll(bob);
        auction.claimTokens(id);
    }
}
