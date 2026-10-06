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

contract AuctionCoordinatorV2Test is Test, DeployPermit2 {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for *;
    uint256 constant Q96 = 1 << 96;
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
        token = new AuctionCoordinatorToken(); permit = IAllowanceTransfer(deployPermit2());
        positions = new PositionManager(manager, permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        hook = address(uint160((uint256(0xDADE) << 144) | flags));
        coordinator = new OmertaAuctionCoordinatorV2(manager, positions, permit, token, IHooks(hook),
            3000, 60, 1000 ether, owner, treasury, vig, founder, nft);
        address[5] memory recipients = [treasury, vig, founder, address(0x14), address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(coordinator),
            uint24(3000), int24(60), recipients, OmertaHookV2.OpeningConfig(0,0,0),uint24(100),uint32(60)), hook);
        auction = deployAuction(nft);
    }
    function deployAuction(IERC721 character) internal returns (OmertaGuardedAuction result) {
        AuctionParameters memory p = AuctionParameters(address(0), treasury, address(coordinator),
            110,120,130,2,address(0),(Q96 / 1000) / 2 * 2,1,
            abi.encodePacked(uint24(1_000_000),uint40(10)));
        result = new OmertaGuardedAuction(address(token),1000 ether,p,IOmertaGenesisClaimGate(address(coordinator)),character);
        token.mint(address(result),1000 ether); result.onTokensReceived();
    }
    function finalize(uint256 amount) internal returns (uint256 id) {
        coordinator.bind(ISingleGenesisAuction(address(auction)));
        token.mint(address(coordinator),1000 ether);
        vm.roll(110); vm.prank(alice);
        id = auction.submitBid{value:amount}(Q96,uint128(amount),alice,bytes(""));
        vm.roll(120); coordinator.checkpointAuction(); auction.exitBid(id);
    }
    function testOneAuctionMigratesBeforeCliffAndClaimsAfterward() public {
        uint256 id = finalize(2 ether);
        uint256 beforeManager = address(manager).balance;
        uint256 publicProceeds = address(auction).balance;
        coordinator.migrate();
        assertTrue(coordinator.migrationSucceeded()); assertFalse(coordinator.playerClaimsOpen());
        assertEq(positions.ownerOf(1),owner); assertGt(positions.getPositionLiquidity(1),0);
        uint256 spent = address(manager).balance - beforeManager;
        assertGe(spent, publicProceeds * 3750 / 10_000 * 99 / 100);
        assertLe(spent, publicProceeds * 3750 / 10_000);
        uint256 residual = publicProceeds - spent;
        assertEq(coordinator.residualCredit(treasury), residual * 4000 / 10_000);
        assertEq(coordinator.residualCredit(vig), residual * 3600 / 10_000);
        assertEq(coordinator.residualCredit(founder), residual - residual * 4000 / 10_000 - residual * 3600 / 10_000);
        assertEq(address(coordinator).balance, residual);
        assertEq(token.allowance(address(coordinator),address(permit)),0);
        (uint160 allowance,,) = permit.allowance(address(coordinator),address(token),address(positions));
        assertEq(allowance,0);
        vm.roll(130); assertTrue(coordinator.playerClaimsOpen());
        vm.prank(alice); nft.transferFrom(alice,address(0xDEAD),1);
        auction.claimTokens(id); assertGt(token.balanceOf(alice),0);
    }
    function testInsufficientReserveRollsBackSweepPoolAndAllowanceThenRetries() public {
        finalize(2 ether);
        vm.prank(address(coordinator)); token.transfer(address(this),1000 ether);
        uint256 principal = address(auction).balance;
        vm.expectRevert(); coordinator.migrate();
        assertEq(address(auction).balance,principal); assertEq(auction.sweepCurrencyBlock(),0);
        assertFalse(coordinator.migrationSucceeded()); assertEq(address(coordinator).balance,0);
        (uint160 price,,,) = manager.getSlot0(coordinator.poolKey().toId()); assertEq(price,0);
        assertEq(token.allowance(address(coordinator),address(permit)),0);
        token.transfer(address(coordinator),1000 ether); coordinator.migrate(); assertTrue(coordinator.migrationSucceeded());
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
        finalize(2 ether);
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
        finalize(2 ether);
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.recoverTokenDust();
        coordinator.migrate();
        uint256 credit = coordinator.residualCredit(treasury);
        uint256 before = treasury.balance;
        vm.prank(treasury); coordinator.withdrawResidual();
        assertEq(treasury.balance,before+credit); assertEq(coordinator.residualCredit(treasury),0);
        uint256 tokens = token.balanceOf(address(coordinator)); coordinator.recoverTokenDust();
        assertEq(token.balanceOf(treasury),tokens); assertEq(token.balanceOf(address(coordinator)),0);
        vm.expectRevert(OmertaAuctionCoordinatorV2.WrongPhase.selector); coordinator.migrate();
    }
    function testRevertingResidualRecipientCannotBlockMigrationOrOtherRecipients() public {
        finalize(2 ether);
        vm.etch(founder,hex"60006000fd");
        coordinator.migrate(); assertTrue(coordinator.migrationSucceeded());
        uint256 credit = coordinator.residualCredit(founder);
        vm.prank(founder); vm.expectRevert(OmertaAuctionCoordinatorV2.SettlementMismatch.selector);
        coordinator.withdrawResidual();
        assertEq(coordinator.residualCredit(founder),credit);
        uint256 treasuryCredit = coordinator.residualCredit(treasury);
        vm.prank(treasury); coordinator.withdrawResidual();
        assertEq(treasury.balance,treasuryCredit);
    }
    function testAllPinnedRuntimeChangesRollBackBeforeSweep() public {
        finalize(2 ether);
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
        uint256 amount = bound(rawAmount,1 ether,10 ether); finalize(amount);
        uint256 proceeds = address(auction).balance;
        uint256 before = address(manager).balance;
        coordinator.migrate();
        uint256 spent = address(manager).balance-before;
        assertGe(spent,proceeds*3750/10_000*99/100); assertLe(spent,proceeds*3750/10_000);
        assertEq(spent+address(coordinator).balance,proceeds);
        assertEq(coordinator.residualCredit(treasury)+coordinator.residualCredit(vig)+coordinator.residualCredit(founder),
            address(coordinator).balance);
        assertEq(positions.ownerOf(1),owner); assertGt(positions.getPositionLiquidity(1),0);
    }
}
