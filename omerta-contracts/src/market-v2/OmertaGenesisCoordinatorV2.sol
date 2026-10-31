// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

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
import {GenesisPlayerSale, IGenesisPlayerIntegration, IGenesisInventoryToken} from "../GenesisPlayerSale.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";

interface IGenesisPositionManager {
    function permit2() external view returns (IAllowanceTransfer);
}

interface IGenesisAuctionOutcome {
    function endBlock() external view returns (uint64);
    function isGraduated() external view returns (bool);
    function tokensReceived() external view returns (bool);
}

interface IGenesisGatedAuction {
    function checkpoint() external;
    function lbpInitializationParams() external view returns (uint256, uint256, uint256);
    function fundsRecipient() external view returns (address);
    function launchGate() external view returns (address);
    function token() external view returns (address);
    function currency() external view returns (address);
    function claimsReady() external view returns (bool);
    function startBlock() external view returns (uint64);
    function blockNumberish() external view returns (uint256);
    function totalSupply() external view returns (uint128);
    function floorPrice() external view returns (uint256);
    function MAX_BID_PRICE() external view returns (uint256);
    function requiredCurrencyRaised() external view returns (uint256);
    function sweepCurrency() external;
}

interface IGenesisMarketHook {
    function authorized() external view returns (address);
    function poolKey() external view returns (PoolKey memory);
}

/// @notice Atomically joins the public auction proceeds into the current market's initial liquidity.
/// @dev Requires the guarded auction, not the deployed CCA/LBP factory. No best-effort migration:
/// initialization and position minting roll back together on any failure. The optional paired-sale
/// binding remains available for existing integrations; a public-only binding never uses that sale.
contract OmertaGenesisCoordinatorV2 is IGenesisPlayerIntegration, ReentrancyGuard {
    using SafeERC20 for IERC20;
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    uint16 public constant INITIAL_LP_BPS = 5000;
    uint256 public constant LIQUIDITY_LOCK_SECONDS = 90 days;
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
    bool public publicOnly;
    uint256 public override playerPriceX96;
    uint256 public liquidityPriceX96;
    uint256 public liquidityPositionId;
    uint256 public migrationTimestamp;
    bool public override playerMigrationSucceeded;
    bool public inventoryFunded;
    bool private _migrating;
    mapping(address => uint256) public residualCredit;
    event Bound(address auction, address playerSale);
    event AuctionFinalized(uint256 priceX96);
    event Migrated(uint256 positionId, uint128 liquidity, uint256 publicProceeds, uint256 playerProceeds);
    event InventoryFunded(address indexed treasury, uint256 amount);
    event LiquidityReleased(uint256 indexed positionId, address indexed owner);
    event LiquidityLocked(uint256 indexed positionId, uint256 unlockTimestamp);
    event LiquidityFeesCollected(uint256 indexed positionId, address indexed owner);
    error BadConfiguration();
    error WrongPhase();
    error SettlementMismatch();

    constructor(
        IPoolManager manager_,
        IPositionManager positions_,
        IAllowanceTransfer permit2_,
        IERC20 token_,
        IHooks hook_,
        uint24 fee_,
        int24 spacing_,
        uint128 reserve_,
        address liquidityOwner_,
        address treasury_,
        address vig_,
        address founder_
    ) {
        if (
            address(manager_).code.length == 0 || address(positions_).code.length == 0
                || address(permit2_).code.length == 0 || address(token_).code.length == 0
                || address(hook_) == address(0) || spacing_ <= 0 || reserve_ == 0
                || reserve_ > uint128(type(int128).max) || liquidityOwner_ == address(0)
                || liquidityOwner_ == address(this) || treasury_ == address(0) || treasury_ == address(this)
                || vig_ == address(0) || vig_ == address(this) || founder_ == address(0) || founder_ == address(this)
                || address(positions_.poolManager()) != address(manager_)
                || address(IGenesisPositionManager(address(positions_)).permit2()) != address(permit2_)
        ) {
            revert BadConfiguration();
        }
        poolManager = manager_;
        positionManager = positions_;
        permit2 = permit2_;
        omr = token_;
        configurator = msg.sender;
        liquidityOwner = liquidityOwner_;
        tokenReserve = reserve_;
        treasury = treasury_;
        vig = vig_;
        founder = founder_;
        chainId = block.chainid;
        _managerHash = address(manager_).codehash;
        _positionsHash = address(positions_).codehash;
        _permitHash = address(permit2_).codehash;
        _tokenHash = address(token_).codehash;
        _key = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(token_)), fee_, spacing_, hook_);
    }

    function poolKey() external view returns (PoolKey memory) {
        return _key;
    }

    /// @notice Pull the fixed matching LP reserve only after the complete sale binding and policy seal.
    function fundInventory() external nonReentrant {
        IGenesisInventoryToken policy = IGenesisInventoryToken(address(omr));
        address source = policy.genesisTreasury();
        if (
            msg.sender != source || !policy.policySealed() || inventoryFunded || address(auction) == address(0)
                || block.chainid != chainId || address(omr).codehash != _tokenHash
                || address(auction).codehash != auctionCodeHash
                || (!publicOnly && address(playerSale).codehash != saleCodeHash)
                || auction.blockNumberish() >= auction.startBlock() || tokenReserve < minimumTokenReserve()
        ) revert WrongPhase();
        inventoryFunded = true;
        uint256 beforeBalance = omr.balanceOf(address(this));
        omr.safeTransferFrom(source, address(this), tokenReserve);
        if (omr.balanceOf(address(this)) - beforeBalance != tokenReserve) revert SettlementMismatch();
        emit InventoryFunded(source, tokenReserve);
    }

    /// @notice One-time deployment binding; addresses cannot be changed once the sale is configured.
    function bind(IGenesisGatedAuction auction_, GenesisPlayerSale sale_) external {
        _bind(auction_, sale_, false);
    }

    /// @notice Bind a single public auction with no reserved sale, eligibility root or follow-on window.
    function bindPublicAuction(IGenesisGatedAuction auction_) external {
        _bind(auction_, GenesisPlayerSale(address(0)), true);
    }

    function _bind(IGenesisGatedAuction auction_, GenesisPlayerSale sale_, bool publicOnly_) private {
        if (
            msg.sender != configurator || address(auction) != address(0) || address(auction_).code.length == 0
                || auction_.fundsRecipient() != address(this) || auction_.launchGate() != address(this)
                || auction_.currency() != address(0) || auction_.token() != address(omr)
                || auction_.blockNumberish() >= auction_.startBlock() || address(_key.hooks).code.length == 0
                || (!publicOnly_
                    && (address(sale_).code.length == 0
                        || address(sale_.integration()) != address(this)
                        || address(sale_.token()) != address(omr)))
        ) {
            revert BadConfiguration();
        }
        IGenesisMarketHook marketHook = IGenesisMarketHook(address(_key.hooks));
        if (
            marketHook.authorized() != address(this)
                || PoolId.unwrap(marketHook.poolKey().toId()) != PoolId.unwrap(_key.toId())
        ) revert BadConfiguration();
        if (tokenReserve < _minimumTokenReserve(auction_)) revert BadConfiguration();
        auctionCodeHash = address(auction_).codehash;
        if (!publicOnly_) saleCodeHash = address(sale_).codehash;
        hookCodeHash = address(_key.hooks).codehash;
        publicOnly = publicOnly_;
        auction = auction_;
        playerSale = sale_;
        emit Bound(address(auction_), address(sale_));
    }

    /// @notice Public proceeds cannot exceed supply times price. Include the finite upper tick
    /// denominator and atomic rounding instead of assuming an infinite full-range position.
    /// The paired sale retains its exact migration check and timeout-to-public recovery path.
    function minimumTokenReserve() public view returns (uint256) {
        if (address(auction) == address(0)) revert WrongPhase();
        return _minimumTokenReserve(auction);
    }

    function _minimumTokenReserve(IGenesisGatedAuction source) private view returns (uint256) {
        uint256 floor = source.floorPrice();
        uint256 maximum = source.MAX_BID_PRICE();
        uint256 supply = source.totalSupply();
        if (
            floor < (uint256(1) << 32) + 1 || maximum < floor || maximum > type(uint160).max || supply == 0
                || supply > uint256(1) << 100
        ) revert BadConfiguration();
        uint160 upper = TickMath.getSqrtPriceAtTick(TickMath.maxUsableTick(_key.tickSpacing));
        uint160 lower = TickMath.getSqrtPriceAtTick(TickMath.minUsableTick(_key.tickSpacing));
        uint160 largestSqrt = _sqrtPrice(floor);
        uint160 smallestSqrt = _sqrtPrice(maximum);
        if (smallestSqrt <= lower || largestSqrt >= upper / 2) revert BadConfiguration();
        // At any accepted price, floor(supply * price / Q96) bounds public proceeds.
        // The worst token matching ratio is at the floor; dropping the lower-tick
        // subtraction only increases this conservative matching reserve.
        uint256 share = Math.mulDiv(supply, INITIAL_LP_BPS, 10_000, Math.Rounding.Ceil);
        uint256 required = Math.mulDiv(share, upper, upper - largestSqrt, Math.Rounding.Ceil) + 2;
        // Very small graduation thresholds can round the LP's native leg to zero
        // or lose more than the existing 1% utilization allowance at a high price.
        uint256 roundingBudget = 100 * (Math.ceilDiv(uint256(1) << 96, smallestSqrt) + 2);
        uint256 minimumRaise = source.requiredCurrencyRaised();
        if (
            Math.mulDiv(minimumRaise, INITIAL_LP_BPS, 10_000) < roundingBudget
                || minimumRaise < Math.ceilDiv(maximum, uint256(1) << 96)
        ) {
            revert BadConfiguration();
        }
        return required;
    }

    /// @notice Acceptance checks remain effective even if inventory was directly donated/notified.
    function genesisBidsOpen() external view returns (bool) {
        return address(auction) != address(0) && inventoryFunded && !playerMigrationSucceeded
            && block.chainid == chainId && address(auction).codehash == auctionCodeHash
            && IOmertaRestrictedOMRV2(address(omr)).policySealed() && tokenReserve >= minimumTokenReserve()
            && omr.balanceOf(address(this)) >= tokenReserve;
    }

    function _sqrtPrice(uint256 price) private pure returns (uint160) {
        return uint160(Math.sqrt(Math.mulDiv(uint256(1) << 192, uint256(1) << 96, price)));
    }

    /// @notice Finality and graduation are enforced by the auction's initialization-parameter read.
    function checkpointAuction() external nonReentrant {
        if (address(auction) == address(0) || playerPriceX96 != 0) revert WrongPhase();
        auction.checkpoint();
        (uint256 price, uint256 sold, uint256 proceeds) = auction.lbpInitializationParams();
        if (price == 0) revert SettlementMismatch();
        if (publicOnly) {
            if (sold == 0 || proceeds == 0) revert SettlementMismatch();
            // A tiny terminal bid must not reprice the entire LP. Keep the final
            // clearing price separately for the existing paired-sale ABI.
            liquidityPriceX96 = Math.min(
                price, Math.max(auction.floorPrice(), Math.mulDiv(proceeds, uint256(1) << 96, sold, Math.Rounding.Ceil))
            );
        } else {
            liquidityPriceX96 = price;
        }
        playerPriceX96 = price;
        emit AuctionFinalized(price);
    }

    function playerClaimsOpen() external view override returns (bool) {
        return playerMigrationSucceeded && auction.claimsReady();
    }

    function migrate() public nonReentrant {
        if (playerPriceX96 == 0 || playerMigrationSucceeded || _migrating) revert WrongPhase();
        if (publicOnly || playerSale.cancelled()) {
            _initializeLiquidity(0);
            return;
        }
        _migrating = true;
        playerSale.releaseProceeds();
        _migrating = false;
        if (!playerMigrationSucceeded) revert SettlementMismatch();
    }

    /// @dev Callback intentionally has no second reentrancy guard: migrate holds the outer guard.
    function finalizePlayerProceeds() external payable override {
        if (
            publicOnly || !_migrating || msg.sender != address(playerSale) || playerMigrationSucceeded
                || !playerSale.released() || msg.value != playerSale.totalAccepted()
        ) revert WrongPhase();
        _initializeLiquidity(msg.value);
    }

    /// @notice A timed-out player tranche refunds its buyers without permanently locking public buyers.
    function migratePublicAfterCancellation() external {
        if (publicOnly || playerPriceX96 == 0 || playerMigrationSucceeded || !playerSale.cancelled()) {
            revert WrongPhase();
        }
        migrate();
    }

    function _initializeLiquidity(uint256 playerProceeds) private {
        if (
            block.chainid != chainId || address(auction).codehash != auctionCodeHash
                || (!publicOnly && address(playerSale).codehash != saleCodeHash)
                || address(_key.hooks).codehash != hookCodeHash || address(poolManager).codehash != _managerHash
                || address(positionManager).codehash != _positionsHash || address(permit2).codehash != _permitHash
                || address(omr).codehash != _tokenHash
        ) revert WrongPhase();
        uint256 beforeSweep = address(this).balance;
        (uint256 price,, uint256 publicProceeds) = auction.lbpInitializationParams();
        if (price != playerPriceX96) revert SettlementMismatch();
        auction.sweepCurrency();
        if (address(this).balance - beforeSweep != publicProceeds) revert SettlementMismatch();
        uint256 total = publicProceeds + playerProceeds;
        uint256 nativeBudget = Math.mulDiv(total, INITIAL_LP_BPS, 10_000);
        if (
            nativeBudget == 0 || nativeBudget > uint128(type(int128).max) || omr.balanceOf(address(this)) < tokenReserve
        ) revert SettlementMismatch();
        uint160 sqrtPrice = _sqrtPrice(liquidityPriceX96);
        if (sqrtPrice < TickMath.MIN_SQRT_PRICE || sqrtPrice >= TickMath.MAX_SQRT_PRICE) revert SettlementMismatch();
        PoolKey memory key = _key;
        (uint160 existing,,,) = poolManager.getSlot0(key.toId());
        if (existing != 0) revert WrongPhase();
        poolManager.initialize(key, sqrtPrice);
        int24 lower = TickMath.minUsableTick(key.tickSpacing);
        int24 upper = TickMath.maxUsableTick(key.tickSpacing);
        uint128 liquidity = LiquidityAmounts.getLiquidityForAmounts(
            sqrtPrice,
            TickMath.getSqrtPriceAtTick(lower),
            TickMath.getSqrtPriceAtTick(upper),
            nativeBudget,
            tokenReserve
        );
        // OMR must fund the ETH budget; insufficient matching tokens cannot silently reduce LP.
        if (
            liquidity == 0
                || liquidity
                    != LiquidityAmounts.getLiquidityForAmount0(
                        sqrtPrice, TickMath.getSqrtPriceAtTick(upper), nativeBudget
                    )
        ) revert SettlementMismatch();
        uint256 positionId = positionManager.nextTokenId();
        bytes[] memory params = new bytes[](3);
        params[0] = abi.encode(
            key, lower, upper, uint256(liquidity), uint128(nativeBudget), tokenReserve, address(this), bytes("")
        );
        params[1] = abi.encode(key.currency0, key.currency1);
        params[2] = abi.encode(key.currency0, address(this));
        omr.forceApprove(address(permit2), tokenReserve);
        permit2.approve(address(omr), address(positionManager), tokenReserve, uint48(block.timestamp));
        uint256 nativeBefore = address(this).balance;
        uint256 positionManagerDust = address(positionManager).balance;
        uint256 tokenBefore = omr.balanceOf(address(this));
        positionManager.modifyLiquidities{value: nativeBudget}(
            abi.encode(
                abi.encodePacked(uint8(Actions.MINT_POSITION), uint8(Actions.SETTLE_PAIR), uint8(Actions.SWEEP)), params
            ),
            block.timestamp
        );
        permit2.approve(address(omr), address(positionManager), 0, 0);
        omr.forceApprove(address(permit2), 0);
        (PoolKey memory positionKey,) = positionManager.getPoolAndPositionInfo(positionId);
        if (
            PoolId.unwrap(positionKey.toId()) != PoolId.unwrap(key.toId())
                || IERC721(address(positionManager)).ownerOf(positionId) != address(this)
        ) revert SettlementMismatch();
        if (
            positionManager.getPositionLiquidity(positionId) != liquidity
                || address(this).balance >= nativeBefore + positionManagerDust
                || omr.balanceOf(address(this)) >= tokenBefore
        ) revert SettlementMismatch();
        uint256 spent = nativeBefore + positionManagerDust - address(this).balance;
        // Full-range liquidity arithmetic leaves rounding dust; bound it to 1% of the LP budget.
        if (spent > nativeBudget || spent < Math.mulDiv(nativeBudget, 9900, 10_000)) revert SettlementMismatch();
        uint256 residual = total - spent;
        residualCredit[treasury] += Math.mulDiv(residual, 4000, 10_000);
        residualCredit[vig] += Math.mulDiv(residual, 3600, 10_000);
        residualCredit[founder] += residual - Math.mulDiv(residual, 4000, 10_000) - Math.mulDiv(residual, 3600, 10_000);
        playerMigrationSucceeded = true;
        liquidityPositionId = positionId;
        migrationTimestamp = block.timestamp;
        emit Migrated(positionId, liquidity, publicProceeds, playerProceeds);
        emit LiquidityLocked(positionId, liquidityUnlockTimestamp());
    }

    /// @notice The time lock begins only after the complete migration succeeds.
    function liquidityUnlockTimestamp() public view returns (uint256) {
        return playerMigrationSucceeded ? migrationTimestamp + LIQUIDITY_LOCK_SECONDS : 0;
    }

    /// @notice Collect earned LP fees to the fixed owner without removing principal or releasing the NFT.
    function collectLiquidityFees() external nonReentrant {
        uint256 id = liquidityPositionId;
        if (
            !playerMigrationSucceeded || id == 0 || block.chainid != chainId
                || address(poolManager).codehash != _managerHash || address(positionManager).codehash != _positionsHash
                || address(_key.hooks).codehash != hookCodeHash || address(omr).codehash != _tokenHash
                || IERC721(address(positionManager)).ownerOf(id) != address(this)
        ) revert WrongPhase();
        uint128 principal = positionManager.getPositionLiquidity(id);
        (PoolKey memory key,) = positionManager.getPoolAndPositionInfo(id);
        if (principal == 0 || PoolId.unwrap(key.toId()) != PoolId.unwrap(_key.toId())) revert SettlementMismatch();
        bytes[] memory params = new bytes[](2);
        // A zero-liquidity decrease credits only earned fees in the canonical PositionManager.
        params[0] = abi.encode(id, uint256(0), uint128(0), uint128(0), bytes(""));
        params[1] = abi.encode(key.currency0, key.currency1, liquidityOwner);
        positionManager.modifyLiquidities(
            abi.encode(abi.encodePacked(uint8(Actions.DECREASE_LIQUIDITY), uint8(Actions.TAKE_PAIR)), params),
            block.timestamp
        );
        if (
            IERC721(address(positionManager)).ownerOf(id) != address(this)
                || positionManager.getPositionLiquidity(id) != principal
        ) revert SettlementMismatch();
        emit LiquidityFeesCollected(id, liquidityOwner);
    }

    /// @notice Anyone can release the NFT after both the claim cliff and 90 days following migration.
    function releaseLiquidity() external nonReentrant {
        uint256 id = liquidityPositionId;
        if (
            !playerMigrationSucceeded || id == 0 || !auction.claimsReady()
                || block.timestamp < liquidityUnlockTimestamp() || block.chainid != chainId
                || address(auction).codehash != auctionCodeHash || address(positionManager).codehash != _positionsHash
        ) revert WrongPhase();
        liquidityPositionId = 0;
        IERC721(address(positionManager)).transferFrom(address(this), liquidityOwner, id);
        emit LiquidityReleased(id, liquidityOwner);
    }

    function withdrawResidual() external nonReentrant {
        uint256 amount = residualCredit[msg.sender];
        residualCredit[msg.sender] = 0;
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert SettlementMismatch();
    }

    function recoverTokenDust() external nonReentrant {
        if (!playerMigrationSucceeded) {
            if (
                block.chainid != chainId || address(auction) == address(0)
                    || address(auction).codehash != auctionCodeHash
                    || (!publicOnly && (address(playerSale).codehash != saleCodeHash || !playerSale.cancelled()))
                    || auction.blockNumberish() < IGenesisAuctionOutcome(address(auction)).endBlock()
            ) revert WrongPhase();
            // An unactivated auction cannot accept bids, and checkpointing it always reverts.
            if (IGenesisAuctionOutcome(address(auction)).tokensReceived()) {
                auction.checkpoint();
                if (IGenesisAuctionOutcome(address(auction)).isGraduated()) revert WrongPhase();
            }
        }
        omr.safeTransfer(treasury, omr.balanceOf(address(this)));
    }

    receive() external payable {
        if (msg.sender != address(auction) && msg.sender != address(positionManager)) revert WrongPhase();
    }
}
