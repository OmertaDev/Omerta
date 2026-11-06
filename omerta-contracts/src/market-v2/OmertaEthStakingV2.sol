// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";

interface IEthStakingDistributorV2 {
    function omr() external view returns (address);
    function rewardVault() external view returns (address);
}

interface IEthStakingTokenPolicyV2 {
    function genesisTreasury() external view returns (address);
    function contractHolderRuntimeHash(address account) external view returns (bytes32);
}

/// @notice Per-deposit 30-day OMR locks with stake-seconds native ETH reward epochs.
/// @dev Funding belongs to its receipt-time epoch. Closed budgets never change; empty epochs
/// roll into the next full future epoch. Historical checkpoints and claims have no expiry.
/// Every held OMR earns rewards until actually withdrawn, including matured principal. Maturity
/// permits withdrawal without ending rewards or renewing the lock. Adding a deposit never extends
/// an existing lock. Staking, matured principal exits and reward claims have no protocol tax.
contract OmertaEthStakingV2 is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant EPOCH_DURATION = 30 days;
    uint256 public constant LOCK_DURATION = 30 days;
    uint256 public constant MAX_CLAIM_EPOCHS = 24;

    struct FlowCheckpoint {
        uint64 timestamp;
        uint256 cumulativeAmount;
    }

    struct RewardCheckpoint {
        uint64 timestamp;
        uint192 balance;
        uint256 cumulative;
    }

    struct LockPosition {
        uint256 amount;
        uint64 lockedAt;
        uint64 unlocksAt;
    }

    struct Epoch {
        uint256 budget;
        uint256 totalStakeSeconds;
        bool finalized;
    }

    IOmertaRestrictedOMRV2 public immutable omr;
    address public immutable governanceSafe;
    address public distributor;
    bytes32 public distributorRuntimeHash;
    bool public active;
    bool public paused;
    uint64 public epochOrigin;
    /// @notice Held principal, including matured principal awaiting withdrawal or relock.
    uint256 public totalStaked;
    uint256 public totalEthFunded;
    uint256 public totalEthClaimed;
    mapping(address => uint256) public stakedBalance;
    mapping(uint64 => mapping(address => bool)) public claimed;
    mapping(address => LockPosition[]) private _locks;
    mapping(address => FlowCheckpoint[]) private _accountFlows;
    FlowCheckpoint[] private _totalFlows;
    mapping(address => RewardCheckpoint[]) private _accountRewards;
    RewardCheckpoint[] private _totalRewards;
    mapping(uint64 => Epoch) private _epochs;

    error InvalidConfiguration();
    error DistributorAlreadySet();
    error InvalidDistributor();
    error Inactive();
    error AlreadyActive();
    error StakingPaused();
    error ExcludedStaker();
    error InvalidAmount();
    error InvalidRecipient();
    error InexactTransfer();
    error EthTransferFailed();
    error InvalidEpoch();
    error EpochStillOpen();
    error EpochAlreadyFinalized();
    error EpochNotFinalized();
    error AlreadyClaimed();
    error InvalidClaimBatch();
    error InvalidLock();
    error LockNotMature();

    event DistributorSet(address indexed distributor, bytes32 runtimeHash);
    event Activated(uint64 epochOrigin);
    event PauseChanged(bool paused);
    event Staked(address indexed account, uint256 amount, uint256 balance);
    event Withdrawn(address indexed account, address indexed recipient, uint256 amount);
    event EthFunded(uint64 indexed epoch, uint256 amount);
    event EpochFinalized(uint64 indexed epoch, uint256 budget, uint256 totalStakeSeconds);
    event EthRolledForward(uint64 indexed fromEpoch, uint64 indexed toEpoch, uint256 amount);
    event RewardClaimed(address indexed account, address indexed recipient, uint64 indexed epoch, uint256 amount);
    event LockCreated(address indexed account, uint256 indexed lockId, uint256 amount, uint64 lockedAt, uint64 unlocksAt);
    event Relocked(address indexed account, uint256 indexed fromLockId, uint256 indexed newLockId, uint256 amount);

    constructor(IOmertaRestrictedOMRV2 omr_, address safe) Ownable(safe) {
        if (address(omr_).code.length == 0
            || IEthStakingTokenPolicyV2(address(omr_)).genesisTreasury() != safe) {
            revert InvalidConfiguration();
        }
        omr = omr_;
        governanceSafe = safe;
    }

    function setDistributor(address distributor_, bytes32 runtimeHash) external onlyOwner {
        if (distributor != address(0)) revert DistributorAlreadySet();
        if (active) revert AlreadyActive();
        _checkDistributor(distributor_, runtimeHash);
        distributor = distributor_;
        distributorRuntimeHash = runtimeHash;
        emit DistributorSet(distributor_, runtimeHash);
    }

    function activate() external onlyOwner {
        if (active) revert AlreadyActive();
        _checkDistributor(distributor, distributorRuntimeHash);
        if (!omr.policySealed() || !omr.isOperator(address(this))
            || omr.operatorRole(address(this)) != IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody) {
            revert InvalidConfiguration();
        }
        epochOrigin = _timestamp();
        active = true;
        _writeRewardCheckpoint(_totalRewards, 0);
        emit Activated(epochOrigin);
    }

    /// @notice Pauses deposits and relocks. Mature exits, funding and earned claims remain available.
    function setPaused(bool paused_) external onlyOwner {
        paused = paused_;
        emit PauseChanged(paused_);
    }

    function stake(uint256 amount) external nonReentrant returns (uint256 lockId) {
        _checkStaker(msg.sender);
        if (amount == 0) revert InvalidAmount();
        uint256 balance = stakedBalance[msg.sender] + amount;
        uint256 total = totalStaked + amount;
        if (balance > type(uint192).max || total > type(uint192).max) revert InvalidAmount();
        uint256 balanceBefore = omr.balanceOf(address(this));
        stakedBalance[msg.sender] = balance;
        totalStaked = total;
        _writeRewardCheckpoint(_accountRewards[msg.sender], uint192(balance));
        _writeRewardCheckpoint(_totalRewards, uint192(total));
        lockId = _createLock(msg.sender, amount);
        IERC20(address(omr)).safeTransferFrom(msg.sender, address(this), amount);
        if (omr.balanceOf(address(this)) - balanceBefore != amount) revert InexactTransfer();
        emit Staked(msg.sender, amount, stakedBalance[msg.sender]);
    }

    /// @notice Principal returns only to its staker; this operator cannot forward OMR between wallets.
    /// Neither pauses nor reward/oracle state can block withdrawal after this position matures.
    function withdraw(uint256 lockId, uint256 amount, address recipient) external nonReentrant {
        if (recipient != msg.sender) revert InvalidRecipient();
        LockPosition storage position = _position(msg.sender, lockId);
        _checkMatureAmount(position, amount);
        position.amount -= amount;
        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        _writeRewardCheckpoint(_accountRewards[msg.sender], uint192(stakedBalance[msg.sender]));
        _writeRewardCheckpoint(_totalRewards, uint192(totalStaked));
        IERC20(address(omr)).safeTransfer(recipient, amount);
        emit Withdrawn(msg.sender, recipient, amount);
    }

    /// @notice Optionally locks matured principal again; does not increase or interrupt reward weight.
    function relock(uint256 lockId, uint256 amount) external nonReentrant returns (uint256 newLockId) {
        _checkStaker(msg.sender);
        LockPosition storage position = _position(msg.sender, lockId);
        _checkMatureAmount(position, amount);
        position.amount -= amount;
        newLockId = _createLock(msg.sender, amount);
        emit Relocked(msg.sender, lockId, newLockId, amount);
    }

    function lockCount(address account) external view returns (uint256) { return _locks[account].length; }

    function lockPosition(address account, uint256 lockId) external view returns (LockPosition memory) {
        return _position(account, lockId);
    }

    /// @notice Principal still within its withdrawal lock. Mature held principal also earns rewards.
    function lockedBalance(address account) external view returns (uint256) {
        return _lockedAmount(_accountFlows[account], _timestamp());
    }

    function totalLocked() external view returns (uint256) { return _lockedAmount(_totalFlows, _timestamp()); }

    /// @notice Only the pinned distributor credits actual received ETH to the open receipt-time epoch.
    /// Forced ETH and unsolicited balance changes never create reward budget or stake credits.
    function fundEth() external payable nonReentrant {
        if (!active) revert Inactive();
        if (msg.sender != distributor || msg.sender.codehash != distributorRuntimeHash) revert InvalidDistributor();
        if (msg.value == 0) revert InvalidAmount();
        uint64 id = currentEpoch();
        _epochs[id].budget += msg.value;
        totalEthFunded += msg.value;
        emit EthFunded(id, msg.value);
    }

    function finalizeEpoch(uint64 id) external nonReentrant {
        if (!active) revert Inactive();
        if (id >= currentEpoch()) revert EpochStillOpen();
        Epoch storage e = _epochs[id];
        if (e.finalized) revert EpochAlreadyFinalized();
        uint256 weight = totalStakeSeconds(id);
        e.totalStakeSeconds = weight;
        e.finalized = true;
        if (weight == 0 && e.budget != 0) {
            uint256 amount = e.budget;
            uint64 nextFullEpoch = currentEpoch() + 1;
            e.budget = 0;
            _epochs[nextFullEpoch].budget += amount;
            emit EthRolledForward(id, nextFullEpoch, amount);
        }
        emit EpochFinalized(id, e.budget, weight);
    }

    /// @notice Pull payment; a rejecting ETH recipient rolls back its complete claim batch.
    function claim(uint64[] calldata ids, address recipient) external nonReentrant {
        if (ids.length == 0 || ids.length > MAX_CLAIM_EPOCHS) revert InvalidClaimBatch();
        if (recipient == address(0) || recipient == address(this)) revert InvalidRecipient();
        uint256 amount;
        for (uint256 i; i < ids.length; ++i) {
            uint64 id = ids[i];
            if (i != 0 && id <= ids[i - 1]) revert InvalidClaimBatch();
            Epoch storage e = _epochs[id];
            if (!e.finalized) revert EpochNotFinalized();
            if (claimed[id][msg.sender]) revert AlreadyClaimed();
            claimed[id][msg.sender] = true;
            uint256 reward = e.totalStakeSeconds == 0 ? 0
                : Math.mulDiv(e.budget, stakeSeconds(msg.sender, id), e.totalStakeSeconds);
            amount += reward;
            emit RewardClaimed(msg.sender, recipient, id, reward);
        }
        if (amount != 0) {
            totalEthClaimed += amount;
            (bool success,) = payable(recipient).call{value: amount}("");
            if (!success) revert EthTransferFailed();
        }
    }

    function currentEpoch() public view returns (uint64) {
        if (!active) revert Inactive();
        return uint64((block.timestamp - epochOrigin) / EPOCH_DURATION);
    }

    function epoch(uint64 id) external view returns (Epoch memory) { return _epochs[id]; }

    function stakeSeconds(address account, uint64 id) public view returns (uint256) {
        (uint64 start, uint64 end) = _elapsedBounds(id);
        if (end <= start) return 0;
        return _rewardIntegralAt(_accountRewards[account], end) - _rewardIntegralAt(_accountRewards[account], start);
    }

    function totalStakeSeconds(uint64 id) public view returns (uint256) {
        (uint64 start, uint64 end) = _elapsedBounds(id);
        if (end <= start) return 0;
        return _rewardIntegralAt(_totalRewards, end) - _rewardIntegralAt(_totalRewards, start);
    }

    function claimable(address account, uint64 id) external view returns (uint256) {
        Epoch storage e = _epochs[id];
        if (!e.finalized || e.totalStakeSeconds == 0 || claimed[id][account]) return 0;
        return Math.mulDiv(e.budget, stakeSeconds(account, id), e.totalStakeSeconds);
    }

    function _checkDistributor(address account, bytes32 runtimeHash) private view {
        if (account == address(0) || runtimeHash == bytes32(0) || account.code.length == 0
            || account.codehash != runtimeHash) revert InvalidDistributor();
        IEthStakingDistributorV2 candidate = IEthStakingDistributorV2(account);
        if (candidate.omr() != address(omr) || candidate.rewardVault() != address(this)) revert InvalidDistributor();
    }

    function _checkStaker(address account) private view {
        if (!active) revert Inactive();
        if (paused) revert StakingPaused();
        if (account == governanceSafe || account == owner() || account == distributor
            || omr.operatorRole(account) != IOmertaRestrictedOMRV2.OperatorRole.None
            || IEthStakingTokenPolicyV2(address(omr)).contractHolderRuntimeHash(account) != bytes32(0)
            || !omr.isRecipient(account)) revert ExcludedStaker();
    }

    function _position(address account, uint256 lockId) private view returns (LockPosition storage position) {
        if (lockId >= _locks[account].length) revert InvalidLock();
        return _locks[account][lockId];
    }

    function _checkMatureAmount(LockPosition storage position, uint256 amount) private view {
        if (amount == 0 || amount > position.amount) revert InvalidAmount();
        if (block.timestamp < position.unlocksAt) revert LockNotMature();
    }

    function _createLock(address account, uint256 amount) private returns (uint256 lockId) {
        uint64 now_ = _timestamp();
        uint256 end = uint256(now_) + LOCK_DURATION;
        if (end > type(uint64).max) revert InvalidEpoch();
        lockId = _locks[account].length;
        _locks[account].push(LockPosition(amount, now_, uint64(end)));
        _appendFlow(_accountFlows[account], now_, amount);
        _appendFlow(_totalFlows, now_, amount);
        emit LockCreated(account, lockId, amount, now_, uint64(end));
    }

    // Flow prefixes describe withdrawal locks only. No principal leaves before expiry; a mature
    // exit cannot alter active locks. Optional relocking appends a new lock flow. Reward histories
    // remain separate, so mature held principal continues accruing without any relock or keeper.
    function _appendFlow(FlowCheckpoint[] storage history, uint64 timestamp, uint256 amount) private {
        uint256 length = history.length;
        uint256 cumulativeAmount = amount;
        if (length != 0) {
            FlowCheckpoint storage prior = history[length - 1];
            if (prior.timestamp > timestamp) revert InvalidEpoch();
            cumulativeAmount += prior.cumulativeAmount;
            if (prior.timestamp == timestamp) {
                prior.cumulativeAmount = cumulativeAmount;
                return;
            }
        }
        history.push(FlowCheckpoint(timestamp, cumulativeAmount));
    }

    function _flowIndex(FlowCheckpoint[] storage history, uint64 timestamp) private view returns (uint256 low) {
        uint256 high = history.length;
        while (low < high) {
            uint256 mid = low + (high - low) / 2;
            if (history[mid].timestamp > timestamp) high = mid;
            else low = mid + 1;
        }
    }

    function _lockedAmount(FlowCheckpoint[] storage history, uint64 timestamp) private view returns (uint256 amount) {
        uint256 index = _flowIndex(history, timestamp);
        if (index != 0) amount = history[index - 1].cumulativeAmount;
        if (timestamp >= LOCK_DURATION) {
            index = _flowIndex(history, uint64(timestamp - LOCK_DURATION));
            if (index != 0) amount -= history[index - 1].cumulativeAmount;
        }
    }

    function _writeRewardCheckpoint(RewardCheckpoint[] storage history, uint192 balance) private {
        uint64 now_ = _timestamp();
        uint256 length = history.length;
        uint256 cumulative;
        if (length != 0) {
            RewardCheckpoint storage prior = history[length - 1];
            if (prior.timestamp > now_) revert InvalidEpoch();
            cumulative = prior.cumulative + uint256(prior.balance) * (now_ - prior.timestamp);
            if (prior.timestamp == now_) {
                prior.balance = balance;
                return;
            }
        }
        history.push(RewardCheckpoint(now_, balance, cumulative));
    }

    function _rewardIntegralAt(RewardCheckpoint[] storage history, uint64 timestamp) private view returns (uint256) {
        uint256 low;
        uint256 high = history.length;
        while (low < high) {
            uint256 mid = low + (high - low) / 2;
            if (history[mid].timestamp > timestamp) high = mid;
            else low = mid + 1;
        }
        if (low == 0) return 0;
        RewardCheckpoint storage prior = history[low - 1];
        return prior.cumulative + uint256(prior.balance) * (timestamp - prior.timestamp);
    }

    function _elapsedBounds(uint64 id) private view returns (uint64 start, uint64 end) {
        if (!active) revert Inactive();
        uint256 start_ = uint256(epochOrigin) + uint256(id) * EPOCH_DURATION;
        uint256 end_ = start_ + EPOCH_DURATION;
        if (end_ > type(uint64).max) revert InvalidEpoch();
        start = uint64(start_);
        end = uint64(Math.min(end_, block.timestamp));
    }

    function _timestamp() private view returns (uint64) {
        if (block.timestamp > type(uint64).max) revert InvalidEpoch();
        return uint64(block.timestamp);
    }
}
