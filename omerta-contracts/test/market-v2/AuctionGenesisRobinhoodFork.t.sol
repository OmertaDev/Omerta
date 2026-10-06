// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {IPositionManager} from "../../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionInfo, PositionInfoLibrary} from "../../lib/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaAuctionCoordinatorV2, ISingleGenesisAuction} from "../../src/market-v2/OmertaAuctionCoordinatorV2.sol";
import {OmertaGuardedAuction, IOmertaGenesisClaimGate} from "../../src/genesis-auction/OmertaGuardedAuction.sol";
import {AuctionParameters} from "../../src/genesis-auction/vendor/cca/interfaces/IContinuousClearingAuction.sol";

/// @notice Opt-in public RPC fork, no signing or broadcasting. Live NFT/OMR/v4 dependencies keep code.
/// @dev ArbSys removed locally BEFORE auction construction so vm.roll selects block.number fallback.
/// This explicit simulated clock is NOT a production native-clock migration rehearsal. Safe/NFT holder
/// impersonation, fresh coordinator/hook/auction deployment and NFT transfers occur only on the fork.
contract AuctionGenesisRobinhoodForkTest is Test {
    using PositionInfoLibrary for PositionInfo;
    uint256 constant Q96 = 1 << 96;
    address constant SAFE = 0xBe225658718DCb3865902437887a11830E4a9b10;
    address constant HOLDER = 0xA87b7A7eEcB6f4c771445f5cBa5bb0d4b29E5ceD;
    IERC20 constant TOKEN = IERC20(0x2e82f8C1cFD5172612b3aF56088d7D68d920545D);
    IERC721 constant NFT = IERC721(0x669C8878A2Db3C3d0f7A447f398dAA3178a0200B);
    IPoolManager constant MANAGER = IPoolManager(0x8366a39CC670B4001A1121B8F6A443A643e40951);
    IPositionManager constant POSITIONS = IPositionManager(0x58daec3116aae6D93017bAAea7749052E8a04fA7);
    IAllowanceTransfer constant PERMIT = IAllowanceTransfer(0x000000000022D473030F116dDEE9F6B43aC78BA3);
    OmertaAuctionCoordinatorV2 coordinator;
    OmertaGuardedAuction auction;
    uint256 bid;
    uint256 positionId;
    address outsider = address(0xB0B);

    function setUp() public {
        if (!vm.envOr("GENESIS_ROBINHOOD_FORK", false)) { vm.skip(true); return; }
        uint256 requestedBlock = vm.envOr("GENESIS_ROBINHOOD_FORK_BLOCK", uint256(0));
        if (requestedBlock == 0) vm.createSelectFork("https://rpc.mainnet.chain.robinhood.com/");
        else vm.createSelectFork("https://rpc.mainnet.chain.robinhood.com/", requestedBlock);
        emit log_named_uint("Fork snapshot block",block.number);
        emit log_named_uint("Fork snapshot timestamp",block.timestamp);
        emit log_named_bytes32("Live OMR runtime",address(TOKEN).codehash);
        emit log_named_bytes32("Live NFT runtime",address(NFT).codehash);
        emit log_named_bytes32("Live PoolManager runtime",address(MANAGER).codehash);
        emit log_named_bytes32("Live PositionManager runtime",address(POSITIONS).codehash);
        emit log_named_bytes32("Live Permit2 runtime",address(PERMIT).codehash);
        assertEq(block.chainid,4663); assertEq(NFT.ownerOf(1),HOLDER);
        assertGe(TOKEN.balanceOf(SAFE),2000 ether);
        assertEq(address(POSITIONS.poolManager()),address(MANAGER));
        vm.etch(address(0x64),bytes("")); vm.deal(HOLDER,10 ether); vm.deal(outsider,10 ether);
        address predicted = vm.computeCreateAddress(address(this),vm.getNonce(address(this)));
        address[5] memory recipients = [SAFE,SAFE,SAFE,SAFE,SAFE];
        bytes memory hookCode = abi.encodePacked(type(OmertaHookV2).creationCode,abi.encode(
            MANAGER,address(TOKEN),predicted,uint24(3000),int24(60),recipients,
            OmertaHookV2.OpeningConfig(0,0,0),uint24(100),uint32(60)));
        bytes32 codeHash = keccak256(hookCode);
        bytes32 salt;
        address hookAddress;
        for (uint256 i; i < 1_000_000; ++i) {
            salt = bytes32(i);
            hookAddress = address(uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff),address(this),salt,codeHash)))));
            if (uint160(hookAddress) & 0x3fff == 0x35c4) break;
        }
        assertEq(uint160(hookAddress) & 0x3fff,0x35c4);
        coordinator = new OmertaAuctionCoordinatorV2(MANAGER,POSITIONS,PERMIT,TOKEN,
            IHooks(hookAddress),3000,60,1000 ether,SAFE,SAFE,SAFE,SAFE,NFT);
        assertEq(address(coordinator),predicted);
        address deployed;
        assembly { deployed := create2(0,add(hookCode,32),mload(hookCode),salt) }
        assertEq(deployed,hookAddress);
        uint64 start = uint64(block.number + 10);
        AuctionParameters memory p = AuctionParameters(address(0),SAFE,address(coordinator),
            start,start+10,start+20,2,address(0),(Q96/1000)/2*2,1,
            abi.encodePacked(uint24(1_000_000),uint40(10)));
        auction = new OmertaGuardedAuction(address(TOKEN),1000 ether,p,IOmertaGenesisClaimGate(address(coordinator)),NFT);
        vm.startPrank(SAFE); TOKEN.transfer(address(auction),1000 ether);
        TOKEN.transfer(address(coordinator),1000 ether); vm.stopPrank();
        auction.onTokensReceived(); coordinator.bind(ISingleGenesisAuction(address(auction)));
        vm.roll(start); vm.prank(outsider); vm.expectRevert();
        auction.submitBid{value:1 ether}(Q96,uint128(1 ether),outsider,bytes(""));
        vm.prank(HOLDER); bid = auction.submitBid{value:2 ether}(Q96,uint128(2 ether),HOLDER,bytes(""));
        vm.roll(start+10); coordinator.checkpointAuction(); auction.exitBid(bid);
        positionId = POSITIONS.nextTokenId();
    }
    function testLiveNftAndDependencyAuctionMigrationAndClaim() public {
        uint256 proceeds = address(auction).balance;
        uint256 managerBefore = address(MANAGER).balance;
        coordinator.migrate(); assertTrue(coordinator.migrationSucceeded());
        assertFalse(coordinator.playerClaimsOpen());
        assertEq(IERC721(address(POSITIONS)).ownerOf(positionId),SAFE);
        assertGt(POSITIONS.getPositionLiquidity(positionId),0);
        PositionInfo info = POSITIONS.positionInfo(positionId);
        assertEq(info.tickLower(),-887220); assertEq(info.tickUpper(),887220);
        assertEq(TOKEN.allowance(address(coordinator),address(PERMIT)),0);
        (uint160 amount,,) = PERMIT.allowance(address(coordinator),address(TOKEN),address(POSITIONS)); assertEq(amount,0);
        uint256 spent = address(MANAGER).balance - managerBefore;
        assertGe(spent,proceeds*3750/10_000*99/100); assertLe(spent,proceeds*3750/10_000);
        assertEq(spent+address(coordinator).balance,proceeds);
        assertEq(coordinator.residualCredit(SAFE),address(coordinator).balance);
        vm.roll(auction.claimBlock()); assertTrue(coordinator.playerClaimsOpen());
        vm.prank(HOLDER); NFT.transferFrom(HOLDER,outsider,1);
        auction.claimTokens(bid); assertGt(TOKEN.balanceOf(HOLDER),0);
    }
}
