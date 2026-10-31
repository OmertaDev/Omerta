// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {OmertaSwapRouterV2} from "./OmertaSwapRouterV2.sol";

interface IWbtcRewardsConverterV2 {
    function authorizedVault() external view returns (address);
    function wbtc() external view returns (IERC20Metadata);
    function convertNativeToWbtc(uint256 minOut, uint64 deadline) external payable returns (uint256);
}

/// @notice Prefunded WBTC epochs with immutable roots, budgets and beneficiary-bound claims.
/// @dev The immutable Safe attests to the off-chain time-weighted wallet/game eligibility manifest.
///      Merkle inclusion does not independently prove backend backing or beneficial ownership.
///      No claim expires, and neither allocated nor unallocated WBTC has an administrative withdrawal.
contract OmertaWbtcRewardsV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct Config {
        address safe;
        IERC20Metadata wbtc;
        IERC20 omr;
        OmertaSwapRouterV2 omrRouter;
        PoolKey omrPool;
        IWbtcRewardsConverterV2 converter;
        bytes32 routerRuntimeHash;
        bytes32 converterRuntimeHash;
    }

    struct Epoch {
        bytes32 merkleRoot;
        bytes32 manifestDigest;
        uint64 start;
        uint64 end;
        uint256 budget;
        uint256 claimed;
    }

    error InvalidConfiguration();
    error OnlySafe();
    error InvalidEpoch();
    error InsufficientRewards();
    error InvalidClaim();
    error AlreadyClaimed();
    error InvalidConversion();
    error InvalidDeadline();
    error RuntimeMismatch();
    error SettlementMismatch();

    uint256 public constant MAX_PROOF_LENGTH = 64;
    uint256 public constant MAX_DEADLINE_DELAY = 1 days;
    address public immutable safe;
    IERC20Metadata public immutable wbtc;
    IERC20 public immutable omr;
    OmertaSwapRouterV2 public immutable omrRouter;
    IWbtcRewardsConverterV2 public immutable converter;
    bytes32 public immutable routerRuntimeHash;
    bytes32 public immutable converterRuntimeHash;
    bytes32 public immutable wbtcRuntimeHash;
    PoolKey private _omrPool;

    uint256 public lastEpochId;
    uint256 public totalReserved;
    mapping(uint256 => Epoch) public epochs;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;

    event RewardsFunded(address indexed donor, uint256 amount);
    event EpochPublished(uint256 indexed epochId, bytes32 indexed merkleRoot, bytes32 indexed manifestDigest,
        uint64 start, uint64 end, uint256 budget);
    event RewardClaimed(uint256 indexed epochId, address indexed account, uint256 amount);
    event NativeConverted(uint256 nativeAmount, uint256 wbtcReceived);
    event OmrConverted(uint256 omrAmount, uint256 nativeReceived, uint256 wbtcReceived);

    constructor(Config memory cfg) {
        if (cfg.safe == address(0) || cfg.safe == address(this) || address(cfg.wbtc).code.length == 0
            || cfg.wbtc.decimals() != 8 || address(cfg.omr) == address(0) || address(cfg.omr) == address(cfg.wbtc)
            || address(cfg.omrRouter) == address(0) || address(cfg.converter) == address(0)
            || cfg.routerRuntimeHash == bytes32(0) || cfg.converterRuntimeHash == bytes32(0)
            || Currency.unwrap(cfg.omrPool.currency0) != address(0)
            || Currency.unwrap(cfg.omrPool.currency1) != address(cfg.omr) || cfg.omrPool.fee >= 1_000_000
            || cfg.omrPool.tickSpacing <= 0 || cfg.omrPool.tickSpacing > TickMath.MAX_TICK_SPACING) {
            revert InvalidConfiguration();
        }
        safe = cfg.safe;
        wbtc = cfg.wbtc;
        omr = cfg.omr;
        omrRouter = cfg.omrRouter;
        converter = cfg.converter;
        routerRuntimeHash = cfg.routerRuntimeHash;
        converterRuntimeHash = cfg.converterRuntimeHash;
        wbtcRuntimeHash = address(cfg.wbtc).codehash;
        _omrPool = cfg.omrPool;
    }

    modifier onlySafe() {
        if (msg.sender != safe) revert OnlySafe();
        _;
    }

    receive() external payable {}

    function omrPool() external view returns (PoolKey memory) { return _omrPool; }

    function availableRewards() public view returns (uint256) {
        _checkWbtc();
        uint256 balance = wbtc.balanceOf(address(this));
        if (balance < totalReserved) revert InsufficientRewards();
        return balance - totalReserved;
    }

    /// @notice Funds in raw eight-decimal WBTC units; direct token donations are also recognized.
    function fundRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidClaim();
        _checkWbtc();
        uint256 vaultBefore = wbtc.balanceOf(address(this));
        uint256 donorBefore = wbtc.balanceOf(msg.sender);
        IERC20(address(wbtc)).safeTransferFrom(msg.sender, address(this), amount);
        uint256 vaultAfter = wbtc.balanceOf(address(this));
        uint256 donorAfter = wbtc.balanceOf(msg.sender);
        if (vaultAfter < vaultBefore || vaultAfter - vaultBefore != amount || donorAfter > donorBefore
            || donorBefore - donorAfter != amount) revert SettlementMismatch();
        emit RewardsFunded(msg.sender, amount);
    }

    function publishEpoch(uint256 epochId, uint64 start, uint64 end, bytes32 merkleRoot, bytes32 manifestDigest,
        uint256 budget) external onlySafe nonReentrant
    {
        if (epochId != lastEpochId + 1 || start >= end || end > block.timestamp || merkleRoot == bytes32(0)
            || manifestDigest == bytes32(0) || budget == 0 || (lastEpochId != 0 && start < epochs[lastEpochId].end)) {
            revert InvalidEpoch();
        }
        if (budget > availableRewards()) revert InsufficientRewards();
        epochs[epochId] = Epoch(merkleRoot, manifestDigest, start, end, budget, 0);
        lastEpochId = epochId;
        totalReserved += budget;
        emit EpochPublished(epochId, merkleRoot, manifestDigest, start, end, budget);
    }

    function claimLeaf(uint256 epochId, address account, uint256 amount) public view returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(block.chainid, address(this), epochId, account, amount))));
    }

    function claim(uint256 epochId, uint256 amount, bytes32[] calldata proof) external nonReentrant {
        Epoch storage epoch = epochs[epochId];
        if (hasClaimed[epochId][msg.sender]) revert AlreadyClaimed();
        if (amount == 0 || proof.length > MAX_PROOF_LENGTH || epoch.merkleRoot == bytes32(0)
            || amount > epoch.budget - epoch.claimed
            || !MerkleProof.verifyCalldata(proof, epoch.merkleRoot, claimLeaf(epochId, msg.sender, amount))) {
            revert InvalidClaim();
        }
        _checkWbtc();
        uint256 vaultBefore = wbtc.balanceOf(address(this));
        if (vaultBefore < totalReserved) revert InsufficientRewards();
        uint256 recipientBefore = wbtc.balanceOf(msg.sender);
        hasClaimed[epochId][msg.sender] = true;
        epoch.claimed += amount;
        totalReserved -= amount;
        IERC20(address(wbtc)).safeTransfer(msg.sender, amount);
        uint256 vaultAfter = wbtc.balanceOf(address(this));
        uint256 recipientAfter = wbtc.balanceOf(msg.sender);
        if (vaultAfter > vaultBefore || vaultBefore - vaultAfter != amount || recipientAfter < recipientBefore
            || recipientAfter - recipientBefore != amount) revert SettlementMismatch();
        emit RewardClaimed(epochId, msg.sender, amount);
    }

    function convertNative(uint256 amount, uint256 minWbtcOut, uint64 deadline)
        external onlySafe nonReentrant returns (uint256 received)
    {
        received = _convertNative(amount, minWbtcOut, deadline);
        emit NativeConverted(amount, received);
    }

    function convertOmr(uint256 amount, uint256 minEthOut, uint256 minWbtcOut, uint64 deadline)
        external onlySafe nonReentrant returns (uint256 received)
    {
        _checkDeadline(deadline);
        if (amount == 0 || amount > uint256(uint128(type(int128).max)) || minEthOut == 0 || minWbtcOut == 0
            || address(omr).code.length == 0 || amount > omr.balanceOf(address(this))) revert InvalidConversion();
        if (address(omrRouter).codehash != routerRuntimeHash || address(omrRouter).code.length == 0) revert RuntimeMismatch();
        if (address(omrRouter.omr()) != address(omr)) revert InvalidConfiguration();
        uint256 omrBefore = omr.balanceOf(address(this));
        uint256 nativeBefore = address(this).balance;
        omr.forceApprove(address(omrRouter), amount);
        BalanceDelta delta = omrRouter.swap(_omrPool,
            SwapParams(false, -int256(amount), TickMath.MAX_SQRT_PRICE - 1), minEthOut, amount, deadline);
        omr.forceApprove(address(omrRouter), 0);
        uint256 omrAfter = omr.balanceOf(address(this));
        if (omrAfter > omrBefore || omrBefore - omrAfter != amount || omr.allowance(address(this), address(omrRouter)) != 0
            || int256(delta.amount1()) != -int256(amount) || delta.amount0() <= 0 || address(this).balance < nativeBefore) {
            revert SettlementMismatch();
        }
        uint256 actualEth = address(this).balance - nativeBefore;
        if (actualEth < minEthOut || actualEth != uint256(uint128(delta.amount0()))) revert SettlementMismatch();
        received = _convertNative(actualEth, minWbtcOut, deadline);
        emit OmrConverted(amount, actualEth, received);
    }

    function _convertNative(uint256 amount, uint256 minWbtcOut, uint64 deadline) private returns (uint256 received) {
        _checkDeadline(deadline);
        if (amount == 0 || amount > uint256(uint128(type(int128).max)) || amount > address(this).balance || minWbtcOut == 0) {
            revert InvalidConversion();
        }
        _checkWbtc();
        if (address(converter).code.length == 0 || address(converter).codehash != converterRuntimeHash) revert RuntimeMismatch();
        if (converter.authorizedVault() != address(this) || address(converter.wbtc()) != address(wbtc)) revert InvalidConfiguration();
        uint256 nativeBefore = address(this).balance;
        uint256 tokenBefore = wbtc.balanceOf(address(this));
        uint256 reported = converter.convertNativeToWbtc{value: amount}(minWbtcOut, deadline);
        uint256 tokenAfter = wbtc.balanceOf(address(this));
        if (tokenAfter < tokenBefore) revert SettlementMismatch();
        received = tokenAfter - tokenBefore;
        if (received < minWbtcOut || received != reported || address(this).balance != nativeBefore - amount) revert SettlementMismatch();
    }

    function _checkDeadline(uint64 deadline) private view {
        if (deadline <= block.timestamp || uint256(deadline) > block.timestamp + MAX_DEADLINE_DELAY) revert InvalidDeadline();
    }

    function _checkWbtc() private view {
        if (address(wbtc).code.length == 0 || address(wbtc).codehash != wbtcRuntimeHash) revert RuntimeMismatch();
    }
}
