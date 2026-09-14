// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721Receiver} from "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";
import {FullMath} from "v4-core/libraries/FullMath.sol";
import {IPositionManager} from "../../lib/v4-periphery/src/interfaces/IPositionManager.sol";
import {PositionInfo} from "../../lib/v4-periphery/src/libraries/PositionInfoLibrary.sol";
import {SqrtPriceMath} from "v4-core/libraries/SqrtPriceMath.sol";
import {IOmertaMarketStateV2} from "./IOmertaMarketStateV2.sol";

interface ICommitmentPositionManagerV2 is IPositionManager {
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
}

/// @notice Custodies canonical v4 NFTs for a finite term and pays only prefunded depth-time bounties.
/// @dev Scoring is a conservative sampled-depth incentive, NOT proof of continuous tick occupancy.
/// Two distinct fresh observation epochs are required. Gaps, pause transitions, and invalid samples
/// break accrual. Depth is the smaller ETH-valued inventory on each side of a bounded reference band;
/// raw liquidity L, one-sided positions, and a single initial snapshot never earn a reward.
/// Campaign terms are immutable; payment is first-come from available funds at each checkpoint.
contract OmertaCommitmentVaultV2 is Ownable2Step, ReentrancyGuard, IERC721Receiver {
    using PoolIdLibrary for PoolKey;

    struct CampaignTerms {
        uint64 startsAt;
        uint64 endsAt;
        uint32 minLock;
        uint32 maxLock;
        uint32 maxObservationGap;
        uint24 referenceHalfWidth;
        uint128 maxDepthWei;
        uint128 maxRewardPerPosition;
        uint128 rewardWeiPerEthDay;
    }
    struct Campaign { CampaignTerms terms; uint256 available; uint256 paidOrOwed; }
    struct Commitment {
        address depositor;
        uint64 campaignId;
        uint64 depositedAt;
        uint64 maturesAt;
        uint64 lastEpoch;
        uint64 lastObservedAt;
        uint64 generation;
        uint128 lastDepth;
        uint256 usefulDepthSeconds;
        uint256 rewardCredited;
        bool withdrawn;
    }

    ICommitmentPositionManagerV2 public immutable positionManager;
    IOmertaMarketStateV2 public immutable marketState;
    bytes32 public immutable poolId;
    uint32 public immutable maxObservationAge;
    uint128 public immutable minimumMarketLiquidity;
    uint64 public campaignCount;
    uint64 public pauseGeneration;
    bool public paused;
    uint256 public rewardLiability;
    uint256 public availableBudget;
    mapping(uint64 => Campaign) private _campaigns;
    mapping(uint256 => Commitment) public commitments;
    mapping(address => uint256) public rewards;
    uint256 private _acceptingTokenId;
    address private _acceptingFrom;

    error InvalidConfiguration();
    error InvalidPosition();
    error InvalidCampaign();
    error InvalidObservation();
    error Paused();
    error Unauthorized();
    error NotMature();
    error InvalidTransfer();
    event CampaignCreated(uint64 indexed campaignId, uint256 fundedAmount);
    event CampaignFunded(uint64 indexed campaignId, uint256 fundedAmount);
    event Committed(uint256 indexed tokenId, address indexed depositor, uint64 indexed campaignId, uint64 maturesAt);
    event Checkpointed(uint256 indexed tokenId, uint64 epoch, uint256 depthSeconds, uint256 reward);
    event ObservationSkipped(uint256 indexed tokenId);
    event Withdrawn(uint256 indexed tokenId, address indexed depositor, address indexed recipient);
    event RewardClaimed(address indexed depositor, address indexed recipient, uint256 amount);
    event PauseChanged(bool paused, uint64 generation);
    event UnusedBudgetRecovered(uint64 indexed campaignId, address indexed recipient, uint256 amount);

    constructor(address safe, ICommitmentPositionManagerV2 manager, IOmertaMarketStateV2 state,
        PoolKey memory canonicalKey, uint32 maxAge, uint128 minLiquidity) Ownable(safe)
    {
        if (address(manager).code.length == 0 || address(state).code.length == 0
            || address(manager.poolManager()).code.length == 0 || maxAge == 0 || maxAge > 1 days
            || Currency.unwrap(canonicalKey.currency0) != address(0)
            || Currency.unwrap(canonicalKey.currency1).code.length == 0 || canonicalKey.tickSpacing <= 0
            || minLiquidity == 0) revert InvalidConfiguration();
        positionManager = manager;
        marketState = state;
        poolId = PoolId.unwrap(canonicalKey.toId());
        maxObservationAge = maxAge;
        minimumMarketLiquidity = minLiquidity;
    }

    function campaign(uint64 id) external view returns (Campaign memory) { return _campaigns[id]; }
    function commitment(uint256 id) external view returns (Commitment memory) { return commitments[id]; }

    function createCampaign(CampaignTerms calldata terms) external payable onlyOwner returns (uint64 id) {
        if (terms.startsAt < block.timestamp || terms.endsAt <= terms.startsAt || terms.endsAt - terms.startsAt > 365 days
            || terms.minLock < 1 hours || terms.maxLock < terms.minLock || terms.maxLock > 365 days
            || terms.maxObservationGap == 0 || terms.maxObservationGap > 1 days
            || terms.referenceHalfWidth == 0 || terms.referenceHalfWidth > 50_000
            || terms.maxDepthWei == 0 || terms.maxRewardPerPosition == 0 || terms.rewardWeiPerEthDay == 0
            || msg.value == 0) revert InvalidConfiguration();
        id = ++campaignCount;
        _campaigns[id] = Campaign(terms, msg.value, 0);
        availableBudget += msg.value;
        emit CampaignCreated(id, msg.value);
    }

    function fundCampaign(uint64 id) external payable {
        Campaign storage c = _campaigns[id];
        if (c.terms.endsAt == 0 || block.timestamp >= c.terms.endsAt || msg.value == 0) revert InvalidCampaign();
        c.available += msg.value;
        availableBudget += msg.value;
        emit CampaignFunded(id, msg.value);
    }

    function setPaused(bool value) external onlyOwner {
        if (paused != value) { paused = value; ++pauseGeneration; }
        emit PauseChanged(value, pauseGeneration);
    }

    function commit(uint256 tokenId, uint64 campaignId, uint32 duration) external nonReentrant {
        if (paused) revert Paused();
        CampaignTerms memory t = _campaigns[campaignId].terms;
        if (block.timestamp < t.startsAt || block.timestamp >= t.endsAt || duration < t.minLock || duration > t.maxLock
            || block.timestamp + duration > t.endsAt) revert InvalidCampaign();
        if (commitments[tokenId].depositor != address(0) || positionManager.ownerOf(tokenId) != msg.sender) revert InvalidPosition();
        (PoolKey memory key, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        if (PoolId.unwrap(key.toId()) != poolId || info.hasSubscriber() || positionManager.getPositionLiquidity(tokenId) == 0)
            revert InvalidPosition();
        Commitment storage p = commitments[tokenId];
        p.depositor = msg.sender;
        p.campaignId = campaignId;
        p.depositedAt = uint64(block.timestamp);
        p.maturesAt = uint64(block.timestamp + duration);
        p.generation = pauseGeneration;
        _acceptingTokenId = tokenId;
        _acceptingFrom = msg.sender;
        positionManager.safeTransferFrom(msg.sender, address(this), tokenId);
        _acceptingFrom = address(0);
        if (positionManager.ownerOf(tokenId) != address(this)) revert InvalidPosition();
        // The first sample initializes an anchor only. It creates no entitlement.
        _checkpoint(tokenId, p);
        emit Committed(tokenId, msg.sender, campaignId, p.maturesAt);
    }

    function onERC721Received(address operator, address from, uint256 tokenId, bytes calldata) external view returns (bytes4) {
        if (msg.sender != address(positionManager) || operator != address(this) || from != _acceptingFrom
            || from == address(0) || tokenId != _acceptingTokenId) revert InvalidPosition();
        return IERC721Receiver.onERC721Received.selector;
    }

    /// @notice Permissionless; credits only the immutable original depositor.
    function checkpoint(uint256 tokenId) external nonReentrant {
        if (paused) revert Paused();
        Commitment storage p = commitments[tokenId];
        if (p.depositor == address(0) || p.withdrawn) revert InvalidPosition();
        _checkpoint(tokenId, p);
    }

    /// @notice No pause, oracle, campaign budget, owner approval, or fee payment can block maturity exit.
    /// Fees accumulated inside the position remain attached to its original NFT.
    function withdraw(uint256 tokenId, address recipient) external nonReentrant {
        Commitment storage p = commitments[tokenId];
        if (msg.sender != p.depositor || p.withdrawn) revert Unauthorized();
        if (block.timestamp < p.maturesAt) revert NotMature();
        if (recipient == address(0) || recipient == address(this)) revert InvalidTransfer();
        p.withdrawn = true;
        positionManager.safeTransferFrom(address(this), recipient, tokenId);
        emit Withdrawn(tokenId, p.depositor, recipient);
    }

    function claimReward(address payable recipient) external nonReentrant {
        uint256 amount = rewards[msg.sender];
        if (amount == 0 || recipient == address(0) || recipient == address(this)) revert InvalidTransfer();
        rewards[msg.sender] = 0;
        rewardLiability -= amount;
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert InvalidTransfer();
        emit RewardClaimed(msg.sender, recipient, amount);
    }

    /// @dev Accrual ends at campaign expiry. Grace covers the last valid observation window.
    /// Only funds which never became an entitlement can be recovered, never any NFT.
    function recoverUnusedBudget(uint64 id, address payable recipient) external onlyOwner nonReentrant {
        Campaign storage c = _campaigns[id];
        if (c.terms.endsAt == 0 || block.timestamp <= uint256(c.terms.endsAt) + maxObservationAge
            || recipient == address(0) || recipient == address(this)) revert InvalidCampaign();
        uint256 amount = c.available;
        c.available = 0;
        availableBudget -= amount;
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert InvalidTransfer();
        emit UnusedBudgetRecovered(id, recipient, amount);
    }

    function usefulDepth(uint256 tokenId, IOmertaMarketStateV2.Snapshot memory s, uint24 halfWidth)
        public view returns (uint128)
    {
        (, PositionInfo info) = positionManager.getPoolAndPositionInfo(tokenId);
        int256 lower = int256(s.meanTick) - int256(uint256(halfWidth));
        int256 upper = int256(s.meanTick) + int256(uint256(halfWidth));
        // Require the entire reference band and observed volatility margin to fit the position.
        if (lower < TickMath.MIN_TICK || upper > TickMath.MAX_TICK || lower < info.tickLower() || upper > info.tickUpper()
            || s.volatilityTicks > halfWidth || s.omrPerEth == 0) return 0;
        uint128 liquidity = positionManager.getPositionLiquidity(tokenId);
        uint160 mid = TickMath.getSqrtPriceAtTick(s.meanTick);
        uint256 nativeDepth = SqrtPriceMath.getAmount0Delta(mid, TickMath.getSqrtPriceAtTick(int24(upper)), liquidity, false);
        uint256 omrDepth = SqrtPriceMath.getAmount1Delta(TickMath.getSqrtPriceAtTick(int24(lower)), mid, liquidity, false);
        uint256 quoteDepth = FullMath.mulDiv(omrDepth, 1 ether, s.omrPerEth);
        uint256 depth = nativeDepth < quoteDepth ? nativeDepth : quoteDepth;
        return depth > type(uint128).max ? type(uint128).max : uint128(depth);
    }

    function _checkpoint(uint256 tokenId, Commitment storage p) internal {
        IOmertaMarketStateV2.Snapshot memory s;
        try marketState.snapshot() returns (IOmertaMarketStateV2.Snapshot memory result) { s = result; }
        catch { _breakAnchor(tokenId, p); return; }
        if (!s.valid || s.epoch == 0 || s.minLiquidity < minimumMarketLiquidity || s.omrPerEth == 0
            || s.observedAt > block.timestamp || block.timestamp - s.observedAt > maxObservationAge
            || s.observedAt < p.depositedAt) { _breakAnchor(tokenId, p); return; }
        if (s.epoch <= p.lastEpoch || s.observedAt <= p.lastObservedAt) revert InvalidObservation();
        Campaign storage c = _campaigns[p.campaignId];
        uint128 depth = usefulDepth(tokenId, s, c.terms.referenceHalfWidth);
        if (depth > c.terms.maxDepthWei) depth = c.terms.maxDepthWei;
        uint256 depthSeconds;
        uint256 reward;
        if (p.lastObservedAt != 0 && p.generation == pauseGeneration
            && s.observedAt - p.lastObservedAt <= c.terms.maxObservationGap && p.lastObservedAt < p.maturesAt) {
            uint64 until = s.observedAt < p.maturesAt ? s.observedAt : p.maturesAt;
            uint128 minimumDepth = depth < p.lastDepth ? depth : p.lastDepth;
            depthSeconds = uint256(minimumDepth) * (until - p.lastObservedAt);
            p.usefulDepthSeconds += depthSeconds;
            reward = FullMath.mulDiv(depthSeconds, c.terms.rewardWeiPerEthDay, 1 ether * 1 days);
            uint256 remainingCap = c.terms.maxRewardPerPosition - p.rewardCredited;
            if (reward > remainingCap) reward = remainingCap;
            if (reward > c.available) reward = c.available;
            p.rewardCredited += reward;
            c.available -= reward;
            c.paidOrOwed += reward;
            availableBudget -= reward;
            rewardLiability += reward;
            rewards[p.depositor] += reward;
        }
        p.lastEpoch = s.epoch;
        p.lastObservedAt = s.observedAt;
        p.lastDepth = depth;
        p.generation = pauseGeneration;
        emit Checkpointed(tokenId, s.epoch, depthSeconds, reward);
    }

    function _breakAnchor(uint256 tokenId, Commitment storage p) internal {
        p.lastObservedAt = 0;
        p.lastDepth = 0;
        p.generation = pauseGeneration;
        emit ObservationSkipped(tokenId);
    }
}
