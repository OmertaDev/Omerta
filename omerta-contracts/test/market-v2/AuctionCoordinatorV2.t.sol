// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
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
import {GenesisCharacterMock} from "../helpers/GenesisCharacterMock.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaAuctionCoordinatorV2, ISingleGenesisAuction} from "../../src/market-v2/OmertaAuctionCoordinatorV2.sol";
import {OmertaGuardedAuction, IOmertaGenesisClaimGate} from "../../src/genesis-auction/OmertaGuardedAuction.sol";
import {AuctionParameters} from "../../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";

contract AuctionCoordinatorToken is ERC20 {
    constructor() ERC20("Auction OMR", "OMR") {}
    function mint(address to, uint256 amount) external { _mint(to, amount); }
}
contract ForceAuctionEth {
    constructor(address payable target) payable { selfdestruct(target); }
}

contract AuctionCoordinatorV2Test is Test, DeployPermit2 {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for *;
    uint256 constant Q96 = 1 << 96;
    uint128 constant LP_RESERVE = 20_000_000 ether;
    uint128 constant SALE = 40_000_000 ether;
    GenesisCharacterMock nft;
    IPoolManager manager;
    PositionManager positions;
    IAllowanceTransfer permit;
    AuctionCoordinatorToken token;
    OmertaAuctionCoordinatorV2 coordinator;
    OmertaGuardedAuction auction;
    address hook;
    address alice = address(0xA11CE);
    address owner = address(0xBEEF);
    address treasury = address(0x11);
    address vig = address(0x12);
    address founder = address(0x13);

    function setUp() public {
        vm.warp(3600); vm.roll(100); vm.deal(alice, 100 ether);
        nft = new GenesisCharacterMock(); nft.mint(alice);
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        token = new AuctionCoordinatorToken(); token.mint(address(this),100_000_000 ether); permit = IAllowanceTransfer(deployPermit2());
        positions = new PositionManager(manager, permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        hook = address(uint160((uint256(0xDADE) << 144) | flags));
        coordinator = new OmertaAuctionCoordinatorV2(manager, positions, permit, token, IHooks(hook),
            3000, 60, LP_RESERVE, owner, nft);
        address[5] memory recipients = [treasury, vig, founder, address(0x14), address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(coordinator),
            uint24(3000), int24(60), recipients, OmertaHookV2.OpeningConfig(0,0,0),uint24(100),uint32(60)), hook);
        auction = deployAuction(nft); token.transfer(owner,40_000_000 ether);
    }
    function deployAuction(IERC721 character) internal returns (OmertaGuardedAuction result) {
        AuctionParameters memory p = AuctionParameters(address(0), treasury, address(coordinator),
            110,120,120,2,address(0),(Q96 / 4_000_000) / 2 * 2,10 ether,
            abi.encodePacked(uint24(1_000_000),uint40(10)));
        result = new OmertaGuardedAuction(address(token),SALE,p,IOmertaGenesisClaimGate(address(coordinator)),character);
        if (token.balanceOf(address(this)) >= SALE) { token.transfer(address(result),SALE); result.onTokensReceived(); }
    }
    function finalize(uint256 amount) internal returns (uint256 id) {
        coordinator.bind(ISingleGenesisAuction(address(auction)));
        token.transfer(address(coordinator),LP_RESERVE);
        vm.roll(110); vm.prank(alice);
        id = auction.submitBid{value:amount}(Q96,uint128(amount),alice,bytes(""));
        vm.roll(120); coordinator.checkpointAuction(); auction.exitBid(id);
    }
    function testClaimsAtCloseBeforeMigrationAndFixedLpReservesPaired() public {
        uint256 id = finalize(50 ether);
        assertTrue(coordinator.playerClaimsOpen()); assertFalse(coordinator.migrationSucceeded());
        auction.claimTokens(id); assertGt(token.balanceOf(alice),0);
        uint256 beforeManager = address(manager).balance;
        uint256 tokenBefore = token.balanceOf(address(manager));
        uint256 proceeds = address(auction).balance;
        coordinator.migrate();
        assertTrue(coordinator.migrationSucceeded()); assertTrue(coordinator.playerClaimsOpen());
        assertEq(positions.ownerOf(1),owner); assertGt(positions.getPositionLiquidity(1),0);
        uint256 spent = address(manager).balance - beforeManager;
        uint256 paired = token.balanceOf(address(manager)) - tokenBefore;
        assertLe(spent,proceeds/2); assertLe(proceeds/2-spent,proceeds/2/1e12+2);
        assertLe(paired,LP_RESERVE); assertLe(LP_RESERVE-paired,LP_RESERVE/1e12+2);
        assertEq(coordinator.lpNativeBudget(),proceeds/2); assertEq(coordinator.publicProceeds(),proceeds);
        assertEq(coordinator.poolPriceX96(),proceeds/2*Q96/LP_RESERVE);
        uint256 residual = proceeds-spent;
        assertEq(coordinator.residualCredit(owner), residual);
        assertEq(coordinator.residualCredit(treasury),0); assertEq(coordinator.residualCredit(vig),0);
        assertEq(coordinator.residualCredit(founder),0);
        assertEq(address(coordinator).balance, residual);
        assertEq(token.allowance(address(coordinator),address(permit)),0);
        (uint160 allowance,,) = permit.allowance(address(coordinator),address(token),address(positions));
        assertEq(allowance,0);
        vm.prank(alice); nft.transferFrom(alice,address(0xDEAD),1);
        assertTrue(coordinator.playerClaimsOpen());
    }
    function testInsufficientReserveRollsBackSweepPoolAndAllowanceThenRetries() public {
        uint256 id = finalize(20 ether);
        vm.prank(address(coordinator)); token.transfer(address(this),LP_RESERVE);
        uint256 principal = address(auction).balance;
        vm.expectRevert(); coordinator.migrate();
        assertEq(address(auction).balance,principal); assertEq(auction.sweepCurrencyBlock(),0);
        assertFalse(coordinator.migrationSucceeded()); assertEq(address(coordinator).balance,0);
        assertTrue(coordinator.playerClaimsOpen()); auction.claimTokens(id);
        assertGt(token.balanceOf(alice),0);
        (uint160 price,,,) = manager.getSlot0(coordinator.poolKey().toId()); assertEq(price,0);
        assertEq(token.allowance(address(coordinator),address(permit)),0);
        token.transfer(address(coordinator),LP_RESERVE); coordinator.migrate(); assertTrue(coordinator.migrationSucceeded());
    }
    function testNoCheckpointOrEarlyCheckpointCannotMigrate() public {
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
        coordinator.bind(ISingleGenesisAuction(address(auction)));
        vm.roll(110); vm.expectRevert(); coordinator.checkpointAuction();
        assertEq(coordinator.auctionPriceX96(),0);
    }
    function testBindingWrongNftAndUntrustedCallerAndRebindingRejected() public {
        GenesisCharacterMock wrong = new GenesisCharacterMock();
        OmertaGuardedAuction other = deployAuction(wrong);
        vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(other)));
        vm.prank(alice); vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(auction)));
        coordinator.bind(ISingleGenesisAuction(address(auction)));
        vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(auction)));
    }
    function testBindingAtStartIsRejected() public {
        vm.roll(110); vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(auction)));
    }
    function testDependenciesAndEligibilityIdentityFailClosed() public {
        finalize(20 ether);
        vm.chainId(block.chainid + 1);
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
        vm.chainId(block.chainid - 1);
        bytes memory saved = address(nft).code; vm.etch(address(nft),hex"00");
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
        vm.etch(address(nft),saved);
        vm.etch(address(auction.validationHook()),hex"00");
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
        assertEq(auction.sweepCurrencyBlock(),0);
    }
    function testResidualWithdrawAndTokenDustAreFixedRecipientAndSingleUse() public {
        finalize(20 ether);
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.recoverTokenDust();
        coordinator.migrate();
        uint256 credit = coordinator.residualCredit(owner);
        uint256 before = owner.balance;
        vm.prank(owner); coordinator.withdrawResidual();
        assertEq(owner.balance,before+credit); assertEq(coordinator.residualCredit(owner),0);
        uint256 tokens = token.balanceOf(address(coordinator)); coordinator.recoverTokenDust();
        assertEq(token.balanceOf(owner),40_000_000 ether+tokens); assertEq(token.balanceOf(address(coordinator)),0);
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
    }
    function testRevertingSafeCannotBlockMigrationAndWithdrawalRollbackRetainsCredit() public {
        finalize(20 ether);
        vm.etch(owner,hex"60006000fd");
        coordinator.migrate(); assertTrue(coordinator.migrationSucceeded());
        uint256 credit = coordinator.residualCredit(owner);
        vm.prank(owner); vm.expectRevert(OmertaAuctionCoordinatorV2.SettlementMismatch.selector);
        coordinator.withdrawResidual();
        assertEq(coordinator.residualCredit(owner),credit);
        assertEq(coordinator.totalOutstandingCredit(),credit);

    }
    function testAllPinnedRuntimeChangesRollBackBeforeSweep() public {
        finalize(20 ether);
        address[8] memory dependencies = [address(manager),address(positions),address(permit),address(token),
            hook,address(nft),address(auction),address(auction.validationHook())];
        uint256 principal = address(auction).balance;
        for (uint256 i; i < dependencies.length; ++i) {
            bytes memory saved = dependencies[i].code; vm.etch(dependencies[i],hex"00");
            vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
            vm.etch(dependencies[i],saved);
            assertFalse(coordinator.migrationSucceeded()); assertEq(address(auction).balance,principal);
        }
        assertEq(auction.sweepCurrencyBlock(),0);
    }
    function testWrongHookPoolAndValidatorIdentityCannotBind() public {
        vm.mockCall(address(auction.validationHook()),
            abi.encodeWithSignature("characterNftCodeHash()"),abi.encode(bytes32(uint256(1))));
        vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(auction)));
        vm.clearMockedCalls();
        address[5] memory recipients = [treasury,vig,founder,address(0x14),address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2",abi.encode(manager,address(token),address(coordinator),
            uint24(500),int24(10),recipients,OmertaHookV2.OpeningConfig(0,0,0),uint24(100),uint32(60)),hook);
        vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(auction)));
    }
    function testFuzzProceedsBudgetCreditsAndCustody(uint96 rawAmount) public {
        uint256 amount = bound(rawAmount,10 ether,100 ether); finalize(amount);
        uint256 proceeds = address(auction).balance;
        uint256 before = address(manager).balance;
        coordinator.migrate();
        uint256 spent = address(manager).balance-before;
        assertLe(spent,proceeds/2); assertLe(proceeds/2-spent,proceeds/2/1e12+2);
        assertLe(LP_RESERVE-token.balanceOf(address(manager)),LP_RESERVE/1e12+2);
        assertEq(spent+address(coordinator).balance,proceeds);
        assertEq(coordinator.residualCredit(owner),address(coordinator).balance);
        assertEq(positions.ownerOf(1),owner); assertGt(positions.getPositionLiquidity(1),0);
    }
    function testFundedPoolPriceBelowFinalClearingAfterLateDemand() public {
        coordinator.bind(ISingleGenesisAuction(address(auction))); token.transfer(address(coordinator),LP_RESERVE);
        vm.roll(110); vm.prank(alice); auction.submitBid{value:0.1 ether}(Q96,uint128(0.1 ether),alice,bytes(""));
        vm.roll(115); vm.prank(alice); auction.submitBid{value:10 ether}(Q96,uint128(10 ether),alice,bytes(""));
        vm.roll(120); coordinator.checkpointAuction();
        uint256 proceeds = address(auction).balance;
        coordinator.migrate();
        assertLt(coordinator.poolPriceX96(),coordinator.auctionPriceX96());
        assertEq(coordinator.lpNativeBudget(),proceeds/2);
        assertLe(LP_RESERVE-token.balanceOf(address(manager)),LP_RESERVE/1e12+2);
        assertEq(token.balanceOf(owner),40_000_000 ether);
    }
    function testBindingDelayedClaimsIsRejected() public {
        AuctionParameters memory p = AuctionParameters(address(0),treasury,address(coordinator),
            110,120,121,2,address(0),(Q96/4_000_000)/2*2,10 ether,abi.encodePacked(uint24(1_000_000),uint40(10)));
        OmertaGuardedAuction delayed = new OmertaGuardedAuction(address(token),SALE,p,
            IOmertaGenesisClaimGate(address(coordinator)),nft);
        vm.expectRevert(OmertaAuctionCoordinatorV2.BadConfiguration.selector);
        coordinator.bind(ISingleGenesisAuction(address(delayed)));
    }
    function testSafeOnlySurplusRecoveryBeforeAndAfterMigrationProtectsCredit() public {
        vm.deal(address(this),5 ether);
        new ForceAuctionEth{value:1 ether}(payable(address(coordinator)));
        vm.prank(alice); vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector);
        coordinator.recoverEthSurplus();
        vm.prank(owner); coordinator.recoverEthSurplus(); assertEq(owner.balance,1 ether);
        finalize(20 ether); coordinator.migrate();
        uint256 credit = coordinator.residualCredit(owner);
        uint256 before = owner.balance;
        assertEq(coordinator.totalOutstandingCredit(),credit);
        new ForceAuctionEth{value:2 ether}(payable(address(coordinator)));
        vm.prank(owner); coordinator.recoverEthSurplus();
        assertEq(owner.balance,before+2 ether); assertEq(address(coordinator).balance,credit);
        assertEq(coordinator.totalOutstandingCredit(),credit);
        vm.prank(owner); vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector);
        coordinator.recoverEthSurplus();
        vm.prank(owner); coordinator.withdrawResidual();
        assertEq(coordinator.totalOutstandingCredit(),0); assertEq(address(coordinator).balance,0);
        new ForceAuctionEth{value:1 ether}(payable(address(coordinator)));
        vm.prank(owner); coordinator.recoverEthSurplus();
        assertEq(address(coordinator).balance,0); assertEq(coordinator.totalOutstandingCredit(),0);
    }
    function testPositionManagerDustIsSurplusNotAcceptedProceedsOrLpBudget() public {
        vm.deal(address(positions),1 ether);
        finalize(20 ether); coordinator.migrate();
        assertEq(coordinator.publicProceeds(),20 ether); assertEq(coordinator.lpNativeBudget(),10 ether);
        uint256 credit = coordinator.residualCredit(owner);
        assertEq(address(coordinator).balance,credit+1 ether);
        vm.prank(owner); coordinator.recoverEthSurplus();
        assertEq(owner.balance,1 ether); assertEq(address(coordinator).balance,credit);
        assertEq(coordinator.totalOutstandingCredit(),credit);
    }
    function testSurplusRecipientRevertRetainsSurplusAndOutstandingCredit() public {
        finalize(20 ether); coordinator.migrate();
        vm.deal(address(this),1 ether); new ForceAuctionEth{value:1 ether}(payable(address(coordinator)));
        uint256 before = address(coordinator).balance;
        uint256 credit = coordinator.totalOutstandingCredit();
        vm.etch(owner,hex"60006000fd");
        vm.prank(owner); vm.expectRevert(OmertaAuctionCoordinatorV2.SettlementMismatch.selector);
        coordinator.recoverEthSurplus();
        assertEq(address(coordinator).balance,before); assertEq(coordinator.totalOutstandingCredit(),credit);
    }
    function testFuzzSurplusNeverSpendsOutstandingCredit(uint64 rawDonation) public {
        uint256 donation = bound(rawDonation,1,1 ether);
        finalize(20 ether); coordinator.migrate();
        uint256 credit = coordinator.residualCredit(owner);
        vm.deal(address(this),donation); new ForceAuctionEth{value:donation}(payable(address(coordinator)));
        vm.prank(owner); coordinator.recoverEthSurplus();
        assertEq(address(coordinator).balance,credit); assertEq(coordinator.totalOutstandingCredit(),credit);
        vm.prank(owner); coordinator.withdrawResidual(); assertEq(address(coordinator).balance,0);
        assertEq(coordinator.totalOutstandingCredit(),0);
    }
    /// @dev Fixture emitted by uniformGenesisAuctionSchedule(4_320_000), pinned to the approved five-day example.
    function testApprovedUniformScheduleConstructorAndAllStepAdvance() public {
        bytes memory schedule = hex"00000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a5500000300000029810000020000005a55";
        assertEq(schedule.length/8,256);
        uint64 start = 110; uint64 end = start+4_320_000;
        uint256 floor = (Q96+3_999_999)/4_000_000; floor = (floor+99)/100*100;
        AuctionParameters memory p = AuctionParameters(address(0),owner,address(coordinator),
            start,end,end,100,address(0),floor,10 ether,schedule);
        uint256 beforeConstruction = gasleft();
        OmertaGuardedAuction scheduled = new OmertaGuardedAuction(address(token),SALE,p,
            IOmertaGenesisClaimGate(address(coordinator)),nft);
        uint256 constructionGas = beforeConstruction-gasleft();
        assertEq(address(scheduled.validationHook()),vm.computeCreateAddress(address(scheduled),1));
        address scheduleStore = vm.computeCreateAddress(address(scheduled),2);
        assertEq(scheduleStore.codehash,keccak256(abi.encodePacked(hex"00",schedule)));
        emit log_named_uint("Approved schedule auction constructor gas",constructionGas);
        assertLt(constructionGas,15_000_000);
        vm.prank(address(auction)); token.transfer(address(scheduled),SALE); scheduled.onTokensReceived();
        coordinator.bind(ISingleGenesisAuction(address(scheduled)));
        vm.roll(start); vm.prank(alice);
        uint256 id = scheduled.submitBid{value:50 ether}(Q96/100*100,uint128(50 ether),alice,bytes(""));
        assertFalse(coordinator.playerClaimsOpen());
        vm.roll(end); uint256 beforeAdvance = gasleft();
        uint24 cumulative = scheduled.checkpoint().cumulativeMps;
        uint256 advanceGas = beforeAdvance-gasleft();
        emit log_named_uint("Approved schedule all-step advance gas",advanceGas);
        assertLt(advanceGas,15_000_000); assertEq(cumulative,10_000_000);
        assertEq(scheduled.endBlock()-scheduled.startBlock(),4_320_000);
        assertEq(scheduled.claimBlock(),scheduled.endBlock());
        assertTrue(coordinator.playerClaimsOpen()); assertFalse(coordinator.migrationSucceeded());
        scheduled.exitBid(id); scheduled.claimTokens(id); assertGt(token.balanceOf(alice),0);
    }
}
