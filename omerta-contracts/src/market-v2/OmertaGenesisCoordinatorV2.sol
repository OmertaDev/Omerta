// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {IAllowanceTransfer} from "permit2/src/interfaces/IAllowanceTransfer.sol";
import {IPositionManager} from "../../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {LiquidityAmounts} from "../../lib/v4-periphery/src/libraries/LiquidityAmounts.sol";
import {Actions} from "../../lib/v4-periphery/src/libraries/Actions.sol";
import {GenesisPlayerSale, IGenesisPlayerIntegration} from "../GenesisPlayerSale.sol";

interface IGenesisGatedAuction {
    function characterNft() external view returns (IERC721);
    function checkpoint() external;
    function lbpInitializationParams() external view returns (uint256, uint256, uint256);
    function fundsRecipient() external view returns (address);
    function launchGate() external view returns (address);
    function token() external view returns (address);
    function currency() external view returns (address);
    function claimsReady() external view returns (bool);
    function startBlock() external view returns (uint64);
    function blockNumberish() external view returns (uint256);
    function sweepCurrency() external;
}

interface IGenesisMarketHook {
    function authorized() external view returns (address);
    function poolKey() external view returns (PoolKey memory);
}

/// @notice Atomically joins both Genesis sale legs into the current market's initial liquidity.
/// @dev Requires the guarded auction, not the deployed CCA/LBP factory. No best-effort migration:
/// initialization, position minting and player proceeds all roll back together on any failure.
contract OmertaGenesisCoordinatorV2 is IGenesisPlayerIntegration, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    IPoolManager public immutable poolManager;
    IPositionManager public immutable positionManager;
    IAllowanceTransfer public immutable permit2;
    IERC20 public immutable omr;
    address public immutable configurator;
    address public immutable liquidityOwner;
    address public immutable treasury;
    address public immutable vig;
    address public immutable founder;
    uint128 public immutable tokenReserve;
    uint256 public immutable chainId;
    bytes32 private immutable _managerHash;
    bytes32 private immutable _positionsHash;
    bytes32 private immutable _permitHash;
    bytes32 private immutable _tokenHash;
    bytes32 public auctionCodeHash;
    bytes32 public saleCodeHash;
    bytes32 public hookCodeHash;
    PoolKey private _key;
    IGenesisGatedAuction public auction;
    GenesisPlayerSale public playerSale;
    uint256 public override playerPriceX96;
    bool public override playerMigrationSucceeded;
    bool private _migrating;
    mapping(address => uint256) public residualCredit;
    event Bound(address auction, address playerSale);
    event AuctionFinalized(uint256 priceX96);
    event Migrated(uint256 positionId, uint128 liquidity, uint256 publicProceeds, uint256 playerProceeds);
    error BadConfiguration();
    error WrongPhase();
    error SettlementMismatch();

    constructor(IPoolManager manager_, IPositionManager positions_, IAllowanceTransfer permit2_,
        IERC20 token_, IHooks hook_, uint24 fee_, int24 spacing_, uint128 reserve_,
        address liquidityOwner_, address treasury_, address vig_, address founder_) {
        if (address(manager_).code.length == 0 || address(positions_).code.length == 0
            || address(permit2_).code.length == 0 || address(token_).code.length == 0
            || address(hook_) == address(0) || spacing_ <= 0 || reserve_ == 0
            || reserve_ > uint128(type(int128).max) || liquidityOwner_ == address(0)
            || treasury_ == address(0) || vig_ == address(0) || founder_ == address(0)
            || address(positions_.poolManager()) != address(manager_)) revert BadConfiguration();
        poolManager = manager_; positionManager = positions_; permit2 = permit2_; omr = token_;
        configurator = msg.sender; liquidityOwner = liquidityOwner_; tokenReserve = reserve_;
        treasury = treasury_; vig = vig_; founder = founder_;
        chainId = block.chainid;
        _managerHash = address(manager_).codehash; _positionsHash = address(positions_).codehash;
        _permitHash = address(permit2_).codehash; _tokenHash = address(token_).codehash;
        _key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token_)), fee_, spacing_, hook_);
    }

    function poolKey() external view returns (PoolKey memory) { return _key; }

    /// @notice One-time deployment binding; addresses cannot be changed once the sale is configured.
    function bind(IGenesisGatedAuction auction_, GenesisPlayerSale sale_) external {
        if (msg.sender != configurator || address(auction) != address(0)
            || address(auction_).code.length == 0 || address(sale_).code.length == 0
            || auction_.fundsRecipient() != address(this) || auction_.launchGate() != address(this)
            || auction_.currency() != address(0) || auction_.token() != address(omr)
            || address(auction_.characterNft()) != address(sale_.characterNft())
            || auction_.blockNumberish() >= auction_.startBlock()
            || address(_key.hooks).code.length == 0
            || address(sale_.integration()) != address(this) || address(sale_.token()) != address(omr)) {
            revert BadConfiguration();
        }
        IGenesisMarketHook marketHook = IGenesisMarketHook(address(_key.hooks));
        if (marketHook.authorized() != address(this)
            || PoolId.unwrap(marketHook.poolKey().toId()) != PoolId.unwrap(_key.toId())) revert BadConfiguration();
        auctionCodeHash = address(auction_).codehash; saleCodeHash = address(sale_).codehash;
        hookCodeHash = address(_key.hooks).codehash;
        auction = auction_; playerSale = sale_; emit Bound(address(auction_), address(sale_));
    }

    /// @notice Finality and graduation are enforced by the auction's initialization-parameter read.
    function checkpointAuction() external nonReentrant {
        if (address(auction) == address(0) || playerPriceX96 != 0) revert WrongPhase();
        auction.checkpoint();
        (uint256 price,,) = auction.lbpInitializationParams();
        if (price == 0) revert SettlementMismatch();
        playerPriceX96 = price; emit AuctionFinalized(price);
    }

    function playerClaimsOpen() external view override returns (bool) {
        return playerMigrationSucceeded && auction.claimsReady();
    }

    function migrate() external nonReentrant {
        if (playerPriceX96 == 0 || playerMigrationSucceeded || _migrating) revert WrongPhase();
        _migrating = true;
        playerSale.releaseProceeds();
        _migrating = false;
        if (!playerMigrationSucceeded) revert SettlementMismatch();
    }

    /// @dev Callback intentionally has no second reentrancy guard: migrate holds the outer guard.
    function finalizePlayerProceeds() external payable override {
        if (!_migrating || msg.sender != address(playerSale) || playerMigrationSucceeded
            || !playerSale.released() || msg.value != playerSale.totalAccepted()) revert WrongPhase();
        _initializeLiquidity(msg.value);
    }

    /// @notice A timed-out player tranche refunds its buyers without permanently locking public buyers.
    function migratePublicAfterCancellation() external nonReentrant {
        if (playerPriceX96 == 0 || playerMigrationSucceeded || !playerSale.cancelled()) revert WrongPhase();
        _initializeLiquidity(0);
    }

    function _initializeLiquidity(uint256 playerProceeds) private {
        if (block.chainid != chainId || address(auction).codehash != auctionCodeHash
            || address(playerSale).codehash != saleCodeHash || address(_key.hooks).codehash != hookCodeHash
            || address(poolManager).codehash != _managerHash || address(positionManager).codehash != _positionsHash
            || address(permit2).codehash != _permitHash || address(omr).codehash != _tokenHash) revert WrongPhase();
        uint256 beforeSweep = address(this).balance;
        (uint256 price,, uint256 publicProceeds) = auction.lbpInitializationParams();
        if (price != playerPriceX96) revert SettlementMismatch();
        auction.sweepCurrency();
        if (address(this).balance - beforeSweep != publicProceeds) revert SettlementMismatch();
        uint256 total = publicProceeds + playerProceeds;
        uint256 nativeBudget = Math.mulDiv(total, 3750, 10_000);
        if (nativeBudget == 0 || nativeBudget > uint128(type(int128).max)
            || omr.balanceOf(address(this)) < tokenReserve) revert SettlementMismatch();
        uint160 sqrtPrice = uint160(Math.sqrt(Math.mulDiv(uint256(1) << 192, uint256(1) << 96, price)));
        if (sqrtPrice < TickMath.MIN_SQRT_PRICE || sqrtPrice >= TickMath.MAX_SQRT_PRICE) revert SettlementMismatch();
        PoolKey memory key = _key;
        (uint160 existing,,,) = poolManager.getSlot0(key.toId());
        if (existing != 0) revert WrongPhase();
        poolManager.initialize(key, sqrtPrice);
        int24 lower = TickMath.minUsableTick(key.tickSpacing);
        int24 upper = TickMath.maxUsableTick(key.tickSpacing);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(sqrtPrice,
            TickMath.getSqrtPriceAtTick(lower), TickMath.getSqrtPriceAtTick(upper), nativeBudget, tokenReserve);
        // OMR must fund the ETH budget; insufficient matching tokens cannot silently reduce LP.
        if (liquidity == 0 || liquidity != LiquidityAmounts.getLiquidityForAmount0(
            sqrtPrice, TickMath.getSqrtPriceAtTick(upper), nativeBudget)) revert SettlementMismatch();
        uint256 positionId = positionManager.nextTokenId();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(key, lower, upper, uint256(liquidity), uint128(nativeBudget), tokenReserve, liquidityOwner, bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1);
        params[2] = abi.encode(key.currency0, address(this));
        omr.forceApprove(address(permit2), tokenReserve);
        permit2.approve(address(omr), address(positionManager), tokenReserve, uint48(block.timestamp));
        uint256 nativeBefore = address(this).balance;
        uint256 positionManagerDust = address(positionManager).balance;
        uint256 tokenBefore = omr.balanceOf(address(this));
        positionManager.modifyLiquidities{value: nativeBudget}(abi.encode(
            abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP)), params), block.timestamp);
        permit2.approve(address(omr), address(positionManager), 0, 0);
        omr.forceApprove(address(permit2), 0);
        (PoolKey memory positionKey,) = positionManager.getPoolAndPositionInfo(positionId);
        if (PoolId.unwrap(positionKey.toId()) != PoolId.unwrap(key.toId())
            || IERC721(address(positionManager)).ownerOf(positionId) != liquidityOwner) revert SettlementMismatch();
        if (positionManager.getPositionLiquidity(positionId) != liquidity
            || address(this).balance >= nativeBefore + positionManagerDust
            || omr.balanceOf(address(this)) >= tokenBefore) revert SettlementMismatch();
        uint256 spent = nativeBefore + positionManagerDust - address(this).balance;
        // Full-range liquidity arithmetic leaves rounding dust; bound it to 1% of the LP budget.
        if (spent > nativeBudget || spent < Math.mulDiv(nativeBudget, 9900, 10_000)) revert SettlementMismatch();
        uint256 residual = total - spent;
        residualCredit[treasury] += Math.mulDiv(residual, 4000, 10_000);
        residualCredit[vig] += Math.mulDiv(residual, 3600, 10_000);
        residualCredit[founder] += residual - Math.mulDiv(residual, 4000, 10_000) - Math.mulDiv(residual, 3600, 10_000);
        playerMigrationSucceeded = true;
        emit Migrated(positionId, liquidity, publicProceeds, playerProceeds);
    }

    function withdrawResidual() external nonReentrant {
        uint256 amount = residualCredit[msg.sender]; residualCredit[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert SettlementMismatch();
    }

    function recoverTokenDust() external nonReentrant {
        if (!playerMigrationSucceeded) revert WrongPhase();
        omr.safeTransfer(treasury, omr.balanceOf(address(this)));
    }

    receive() external payable {
        if (msg.sender != address(auction) && msg.sender != address(positionManager)) revert WrongPhase();
    }
}
