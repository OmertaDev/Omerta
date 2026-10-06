// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;
import {GenesisCharacterMock} from "../helpers/GenesisCharacterMock.sol";
import {Test} from "forge-std/Test.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Hooks} from "v4-core/libraries/Hooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PositionManager} from "../../lib/v4-periphery/src/PositionManager.sol";
import {IPositionDescriptor} from "../../lib/v4-periphery/src/interfaces/IPositionDescriptor.sol";
import {IWETH9} from "../../lib/v4-periphery/src/interfaces/external/IWETH9.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {DeployPermit2} from "permit2/test/utils/DeployPermit2.sol";
import {GenesisPlayerSale} from "../../src/GenesisPlayerSale.sol";
import {OmertaHookV2} from "../../src/market-v2/OmertaHookV2.sol";
import {OmertaGenesisCoordinatorV2, IGenesisGatedAuction} from "../../src/market-v2/OmertaGenesisCoordinatorV2.sol";

contract GenesisCoordinatorToken is ERC20 {
    constructor() ERC20("OMR", "OMR") {}
    function mint(address who, uint256 amount) external { _mint(who, amount); }
}
contract CoordinatorAuctionFixture is IGenesisGatedAuction {
    address public immutable launchGate;
    address public immutable token;
    IERC721 public immutable characterNft;
    bool public claimsReady;
    bool public swept;
    constructor(address gate, address token_, IERC721 characterNft_) { launchGate = gate; token = token_; characterNft = characterNft_; }
    function fundsRecipient() external view returns (address) { return launchGate; }
    function currency() external pure returns (address) { return address(0); }
    function checkpoint() external {}
    function startBlock() external pure returns (uint64) { return 101; }
    function blockNumberish() external view returns (uint256) { return block.number; }
    function lbpInitializationParams() external pure returns (uint256, uint256, uint256) {
        return (uint256(1) << 96, 10 ether, 10 ether);
    }
    function setClaimsReady() external { claimsReady = true; }
    function sweepCurrency() external {
        require(msg.sender == launchGate && !swept); swept = true;
        (bool ok,) = launchGate.call{value: 10 ether}(""); require(ok);
    }
}

contract GenesisCoordinatorV2Test is Test, DeployPermit2 {
    GenesisCharacterMock characterNft;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    IPoolManager manager;
    PositionManager positions;
    GenesisCoordinatorToken token;
    OmertaGenesisCoordinatorV2 coordinator;
    GenesisPlayerSale sale;
    CoordinatorAuctionFixture auction;
    address alice = address(0xAAA);
    function setUp() public {
        characterNft = new GenesisCharacterMock();
        characterNft.mint(alice);
        vm.warp(3600); vm.roll(100); vm.deal(alice, 20 ether);
        manager = IPoolManager(deployCode("PoolManager.sol:PoolManager", abi.encode(address(this))));
        token = new GenesisCoordinatorToken();
        IAllowanceTransfer permit = IAllowanceTransfer(deployPermit2());
        positions = new PositionManager(manager, permit, 100_000, IPositionDescriptor(address(0)), IWETH9(address(0)));
        uint160 flags = uint160(Hooks.BEFORE_INITIALIZE_FLAG | Hooks.AFTER_INITIALIZE_FLAG
            | Hooks.AFTER_ADD_LIQUIDITY_FLAG | Hooks.AFTER_REMOVE_LIQUIDITY_FLAG
            | Hooks.BEFORE_SWAP_FLAG | Hooks.AFTER_SWAP_FLAG | Hooks.AFTER_SWAP_RETURNS_DELTA_FLAG);
        address hookAddress = address(uint160((uint256(0xCAFE) << 144) | flags));
        coordinator = new OmertaGenesisCoordinatorV2(manager, positions, permit, token, IHooks(hookAddress),
            3000, 60, 20 ether, address(0xBEEF), address(0x11), address(0x12), address(0x13));
        address[5] memory recipients = [address(0x11),address(0x12),address(0x13),address(0x14),address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(coordinator),
            uint24(3000), int24(60), recipients, OmertaHookV2.OpeningConfig(200,500,10 ether),uint24(100),uint32(60)), hookAddress);
        auction = new CoordinatorAuctionFixture(address(coordinator), address(token), characterNft);
        vm.deal(address(auction), 10 ether);
        address salePredicted = vm.computeCreateAddress(address(this), vm.getNonce(address(this)));
        bytes32 root = keccak256(bytes.concat(keccak256(abi.encode(block.chainid, salePredicted, alice, uint8(2)))));
        sale = new GenesisPlayerSale(token, coordinator, root, 10 ether, block.timestamp + 1 days,
            block.timestamp + 10 days, address(0x11), characterNft);
        token.mint(address(sale), 10 ether); token.mint(address(coordinator), 20 ether);
        coordinator.bind(auction, sale); coordinator.checkpointAuction(); sale.open();
    }
    function _buyAndSettle() private {
        vm.prank(alice); sale.contribute{value: 1 ether}(2, new bytes32[](0));
        vm.warp(sale.closesAt()); sale.settle(alice);
    }
    function testRealPositionCombinesBothLegsAndClaimsWaitForCliff() public {
        _buyAndSettle(); coordinator.migrate();
        assertTrue(coordinator.playerMigrationSucceeded());
        assertFalse(coordinator.playerClaimsOpen());
        assertEq(positions.ownerOf(1), address(0xBEEF));
        assertGt(positions.getPositionLiquidity(1), 0);
        assertGt(address(manager).balance, 4 ether);
        auction.setClaimsReady();
        vm.prank(alice); sale.claim(); assertEq(token.balanceOf(alice), 1 ether);
        vm.expectRevert(); coordinator.migrate();
    }
    function testNoEarlyMigration() public {
        vm.expectRevert(); coordinator.migrate(); assertFalse(auction.swept());
    }
    function testInsufficientMatchingInventoryRollsBackAllLegs() public {
        _buyAndSettle(); vm.prank(address(coordinator)); token.transfer(address(this), 20 ether);
        vm.expectRevert(); coordinator.migrate();
        assertFalse(sale.released()); assertFalse(auction.swept());
        assertEq(address(sale).balance, 1 ether);
        (uint160 sqrtPrice,,,) = manager.getSlot0(coordinator.poolKey().toId()); assertEq(sqrtPrice, 0);
    }
    function testCancelledPlayersRefundAndPublicSaleStillMigrates() public {
        vm.prank(alice); sale.contribute{value: 1 ether}(2,new bytes32[](0));
        vm.warp(sale.migrationDeadline()); sale.cancel(); coordinator.migratePublicAfterCancellation();
        assertTrue(coordinator.playerMigrationSucceeded()); assertFalse(sale.released());
        vm.prank(alice); sale.refund(); assertEq(alice.balance, 20 ether);
    }
    function testCannotRebindOrSpoofPlayerCallback() public {
        vm.expectRevert(); coordinator.bind(auction,sale);
        vm.expectRevert(); coordinator.finalizePlayerProceeds();
    }
    function testBindingRejectsWrongHookPoolBeforeBidding() public {
        IHooks hook = coordinator.poolKey().hooks;
        OmertaGenesisCoordinatorV2 other = new OmertaGenesisCoordinatorV2(manager, positions,
            coordinator.permit2(), token, hook, 3000, 60, 20 ether,
            address(0xBEEF), address(0x11), address(0x12), address(0x13));
        address[5] memory recipients = [address(0x11),address(0x12),address(0x13),address(0x14),address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(other),
            uint24(500), int24(10), recipients, OmertaHookV2.OpeningConfig(200,500,10 ether),
            uint24(100),uint32(60)), address(hook));
        CoordinatorAuctionFixture otherAuction = new CoordinatorAuctionFixture(address(other),address(token),characterNft);
        GenesisPlayerSale otherSale = new GenesisPlayerSale(token, other, bytes32(uint256(1)),
            10 ether, block.timestamp + 1 days, block.timestamp + 10 days, address(0x11), characterNft);
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector); other.bind(otherAuction,otherSale);
    }
    function testBindingRejectsDifferentCharacterNft() public {
        IHooks hook = coordinator.poolKey().hooks;
        OmertaGenesisCoordinatorV2 other = new OmertaGenesisCoordinatorV2(manager, positions,
            coordinator.permit2(), token, hook, 3000, 60, 20 ether,
            address(0xBEEF), address(0x11), address(0x12), address(0x13));
        address[5] memory recipients = [address(0x11),address(0x12),address(0x13),address(0x14),address(0x15)];
        deployCodeTo("OmertaHookV2.sol:OmertaHookV2", abi.encode(manager, address(token), address(other),
            uint24(3000), int24(60), recipients, OmertaHookV2.OpeningConfig(200,500,10 ether),
            uint24(100),uint32(60)), address(hook));
        CoordinatorAuctionFixture otherAuction = new CoordinatorAuctionFixture(address(other), address(token),
            new GenesisCharacterMock());
        GenesisPlayerSale otherSale = new GenesisPlayerSale(token, other, bytes32(uint256(1)),
            10 ether, block.timestamp + 1 days, block.timestamp + 10 days, address(0x11), characterNft);
        vm.expectRevert(OmertaGenesisCoordinatorV2.BadConfiguration.selector); other.bind(otherAuction, otherSale);
    }
    function testFuzzBothLegsFundLiquidityAndResiduals(uint96 amount_) public {
        uint256 amount = bound(uint256(amount_), 1, 1 ether);
        vm.prank(alice); sale.contribute{value: amount}(2,new bytes32[](0));
        vm.warp(sale.closesAt()); sale.settle(alice); coordinator.migrate();
        uint256 total = 10 ether + amount;
        uint256 budget = total * 3750 / 10_000;
        assertGe(address(manager).balance, budget * 9900 / 10_000);
        assertLe(address(manager).balance, budget);
        uint256 credit = coordinator.residualCredit(address(0x11))
            + coordinator.residualCredit(address(0x12)) + coordinator.residualCredit(address(0x13));
        assertEq(credit + address(manager).balance, total);
        assertEq(address(coordinator).balance, credit);
        assertEq(address(sale).balance, 0);
    }
}
