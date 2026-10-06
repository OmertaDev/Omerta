// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {GenesisCharacterMock} from "../helpers/GenesisCharacterMock.sol";
import {Test} from "forge-std/Test.sol";
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
import {GenesisCoordinatorToken} from "./GenesisCoordinatorV2.t.sol";
import {GenesisPlayerSale} from "../../src/GenesisPlayerSale.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaGenesisCoordinatorV2, IGenesisGatedAuction} from "../../src/market-v2/OmertaGenesisCoordinatorV2.sol";
import {OmertaGuardedAuction} from "../../src/genesis-auction/OmertaGuardedAuction.sol";
import {AuctionParameters} from "../../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";
import {IOmertaGenesisClaimGate} from "../../src/genesis-auction/OmertaGuardedAuction.sol";

contract PlayerGenesisIntegrationV2Test is Test, DeployPermit2 {
    GenesisCharacterMock characterNft;
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for *;
    uint256 constant Q96 = 1 << 96;
    IPoolManager manager;
    PositionManager positions;
    GenesisCoordinatorToken token;
    OmertaGenesisCoordinatorV2 coordinator;
    OmertaGuardedAuction auction;
    GenesisPlayerSale sale;
    address alice = address(0xA11CE);
    address bob = address(0xB0B);
    uint256 bid;

    function setUp() public {
        characterNft = new GenesisCharacterMock();
        characterNft.mint(alice); characterNft.mint(bob);
        vm.warp(3600); vm.roll(100); vm.deal(alice, 10 ether); vm.deal(bob, 10 ether);
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        token = new GenesisCoordinatorToken();
        IAllowanceTransfer permit = IAllowanceTransfer(deployPermit2());
        positions = new PositionManager(manager, permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address hook = address(uint160((uint256(0xDADA) << 144) | flags));
        coordinator = new OmertaGenesisCoordinatorV2(manager, positions, permit, token, IHooks(hook),
            3000, 60, 1000 ether, address(0xBEEF), address(0x11), address(0x12), address(0x13));
        address[5] memory recipients = [address(0x11),address(0x12),address(0x13),address(0x14),address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(coordinator),
            uint24(3000), int24(60), recipients, OmertaHookV2.OpeningConfig(200,500,10 ether),uint24(100),uint32(60)), hook);
        AuctionParameters memory p = AuctionParameters(address(0), address(0x11), address(coordinator),
            110,120,130,2,address(0),(Q96 / 1000) / 2 * 2,1,
            abi.encodePacked(uint24(1_000_000),uint40(10)));
        auction = new OmertaGuardedAuction(address(token),1000 ether,p,IOmertaGenesisClaimGate(address(coordinator)),characterNft);
        address predicted = vm.computeCreateAddress(address(this),vm.getNonce(address(this)));
        bytes32 root = keccak256(bytes.concat(keccak256(abi.encode(block.chainid,predicted,alice,uint8(2)))));
        sale = new GenesisPlayerSale(token,coordinator,root,100 ether,block.timestamp + 1 days,
            block.timestamp + 10 days,address(0x11), characterNft);
        token.mint(address(auction),1000 ether); auction.onTokensReceived();
        token.mint(address(sale),100 ether); token.mint(address(coordinator),1000 ether);
        coordinator.bind(IGenesisGatedAuction(address(auction)),sale);
        vm.roll(110); vm.prank(bob);
        bid = auction.submitBid{value:2 ether}(Q96,uint128(2 ether),bob,bytes(""));
        vm.roll(120); coordinator.checkpointAuction(); auction.exitBid(bid); sale.open();
        vm.prank(alice); sale.contribute{value:1 ether}(2,new bytes32[](0));
    }
    function testRealAuctionAndPoolSettleBeforeBothClaims() public {
        vm.roll(130);
        vm.expectRevert(OmertaGuardedAuction.LaunchClaimsClosed.selector); auction.claimTokens(bid);
        vm.warp(sale.closesAt()); sale.settle(alice);
        uint256 playerAccepted = sale.totalAccepted();
        coordinator.migrate();
        assertTrue(coordinator.playerClaimsOpen()); assertTrue(sale.released());
        assertEq(positions.ownerOf(1),address(0xBEEF));
        assertGt(positions.getPositionLiquidity(1),0);
        assertGe(address(manager).balance,(2 ether + playerAccepted) * 3750 / 10_000 * 99 / 100);
        auction.claimTokens(bid); assertGt(token.balanceOf(bob),0);
        vm.prank(alice); sale.claim(); assertGt(token.balanceOf(alice),0);
        uint256 expectedRefund = 1 ether - sale.accepted(alice);
        vm.prank(alice); sale.refund(); assertEq(alice.balance,9 ether + expectedRefund);
    }
    function testRealAuctionPlayerTimeoutRefundsAndPublicMigrationRecovers() public {
        vm.roll(130); vm.warp(sale.migrationDeadline()); sale.cancel();
        coordinator.migratePublicAfterCancellation();
        assertFalse(sale.released()); assertTrue(coordinator.playerClaimsOpen());
        vm.prank(alice); sale.refund(); assertEq(alice.balance,10 ether);
        auction.claimTokens(bid); assertGt(token.balanceOf(bob),0);
    }
    function testRealAuctionFailedPoolFundingRetainsPrincipalAndCanRetry() public {
        vm.warp(sale.closesAt()); sale.settle(alice);
        vm.prank(address(coordinator)); token.transfer(address(this),1000 ether);
        uint256 auctionBalance = address(auction).balance;
        vm.expectRevert(); coordinator.migrate();
        assertEq(address(auction).balance,auctionBalance); assertEq(address(sale).balance,1 ether);
        assertFalse(sale.released()); assertEq(auction.sweepCurrencyBlock(),0);
        (uint160 price,,,) = manager.getSlot0(coordinator.poolKey().toId()); assertEq(price,0);
        token.transfer(address(coordinator),1000 ether); coordinator.migrate();
        assertTrue(coordinator.playerMigrationSucceeded());
    }
}
