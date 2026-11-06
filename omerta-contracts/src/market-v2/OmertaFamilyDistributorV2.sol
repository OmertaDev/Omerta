// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IFamilyRegistryV2 {
    function owner() external view returns (address);
    function omr() external view returns (address);
    function game() external view returns (address);
    function familyTreasury(uint64) external view returns (address);
    function credits(address) external view returns (uint256 nativeAmount, uint256 omrAmount);
    function claim(address payable recipient) external;
}
interface IFamilyGameV2 {
    function registry() external view returns (address);
    function adjudicator() external view returns (address);
    function activeLanes() external view returns (address[] memory);
}
interface IFamilyTokenV2 is IERC20 {
    function isRecipient(address) external view returns (bool);
    function isOperator(address) external view returns (bool);
}
interface IFamilyBridgeV2 { function checkpointFees() external; }

/// @notice One family's earned territory fees, split under its leader's signed policy.
/// @dev Game authority attests membership and leadership; it cannot change a split
/// without the current leader's consent. Old wallet credits survive every change.
contract OmertaFamilyDistributorV2 is EIP712, ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 public constant MAX_MEMBERS = 20;
    uint256 public constant MAX_LANES = 64;
    uint256 public constant MEMBER_PAYOUT_GAS = 200000;
    bytes32 public constant SPLIT_TYPEHASH = keccak256(
        "SplitUpdate(uint64 revision,bytes32 recipientsHash,bytes32 weightsHash,uint64 deadline)");
    bytes32 public constant RESERVE_TYPEHASH = keccak256(
        "ReserveAllocation(uint64 revision,bytes32 recipientsHash,bytes32 weightsHash,uint256 nativeAmount,uint256 omrAmount,uint64 deadline)");
    IFamilyRegistryV2 public immutable registry;
    IFamilyGameV2 public immutable game;
    IFamilyTokenV2 public immutable omr;
    address public immutable safe;
    address public immutable operator;
    uint64 public immutable family;
    address public leader;
    uint64 public revision;
    address[] private _members;
    uint16[] private _weights;
    struct Credit { uint256 nativeAmount; uint256 omrAmount; }
    mapping(address => Credit) public credits;
    mapping(bytes32 => bool) public leaderReceiptUsed;
    mapping(bytes32 => bool) public departureReceiptUsed;
    mapping(bytes32 => bool) public dissolutionReceiptUsed;
    mapping(address => bool) public suspended;
    bool public dissolved;
    // Included in total liabilities, but never paid or released by a future split.
    uint256 public nativeReserve;
    uint256 public omrReserve;
    uint256 public nativeLiability;
    uint256 public omrLiability;
    error Unauthorized();
    error InvalidConfiguration();
    error InvalidConsent();
    error InvalidTransfer();
    event SharesSet(uint64 indexed revision, bytes32 recipientsHash, bytes32 weightsHash);
    event LeaderSet(address indexed leader, uint64 revision, bytes32 receipt);
    event MemberSuspended(address indexed member, uint64 revision, bytes32 receipt);
    event ReserveAllocated(uint64 indexed revision, bytes32 recipientsHash, bytes32 weightsHash,
        uint256 nativeAmount, uint256 omrAmount);
    event FamilyDissolved(uint64 indexed revision, address indexed treasury, bytes32 receipt,
        uint256 nativeAmount, uint256 omrAmount);
    event Collected(uint256 nativeAmount, uint256 omrAmount);
    event Paid(address indexed member, uint256 nativeAmount, uint256 omrAmount);
    event PayoutDeferred(address indexed member);

    constructor(address safe_, address operator_, address leader_, uint64 family_, IFamilyRegistryV2 registry_)
        EIP712("OmertaFamilyDistributor", "1")
    {
        if (safe_ == address(0) || operator_ == address(0) || leader_ == address(0) || family_ <= 1
            || address(registry_).code.length == 0 || registry_.owner() != safe_) revert InvalidConfiguration();
        IFamilyGameV2 game_ = IFamilyGameV2(registry_.game());
        IFamilyTokenV2 token_ = IFamilyTokenV2(registry_.omr());
        if (address(game_).code.length == 0 || address(token_).code.length == 0
            || game_.registry() != address(registry_) || game_.adjudicator() != operator_)
            revert InvalidConfiguration();
        safe = safe_; operator = operator_; leader = leader_; family = family_;
        registry = registry_; game = game_; omr = token_;
    }

    modifier onlyGame() { if (msg.sender != operator) revert Unauthorized(); _; }
    receive() external payable { if (msg.sender != address(registry)) revert InvalidTransfer(); }

    function members() external view returns (address[] memory, uint16[] memory) { return (_members, _weights); }
    function departurePolicyVersion() external pure returns (uint8) { return 1; }
    function dissolutionPolicyVersion() external pure returns (uint8) { return 1; }

    function hashSplit(address[] calldata recipients, uint16[] calldata weights, uint64 expectedRevision, uint64 deadline)
        public view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(SPLIT_TYPEHASH, expectedRevision,
            keccak256(abi.encode(recipients)), keccak256(abi.encode(weights)), deadline)));
    }

    function setShares(address[] calldata recipients, uint16[] calldata weights, uint64 expectedRevision,
        uint64 deadline, bytes calldata signature) external onlyGame nonReentrant
    {
        if (dissolved) revert InvalidConfiguration();
        if (revision != expectedRevision || deadline < block.timestamp || deadline > block.timestamp + 1 hours
            || ECDSA.recover(hashSplit(recipients, weights, expectedRevision, deadline), signature) != leader)
            revert InvalidConsent();
        _validateSplit(recipients, weights);
        // Establish the first policy before the game grants any earning rights.
        if (_members.length == 0) {
            if (registry.familyTreasury(family) == address(this)) revert InvalidConfiguration();
            (uint256 n, uint256 o) = registry.credits(address(this));
            if (n != 0 || o != 0) revert InvalidConfiguration();
        } else {
            _checkpoint();
            _collect();
        }
        // Only a fresh leader signature can resume a wallet. Membership/rejoin
        // alone has no onchain effect; historical reserves remain untouched.
        for (uint256 i; i < recipients.length; ++i) suspended[recipients[i]] = false;
        _members = recipients; _weights = weights;
        ++revision;
        emit SharesSet(revision, keccak256(abi.encode(recipients)), keccak256(abi.encode(weights)));
    }

    function _validateSplit(address[] calldata recipients, uint16[] calldata weights) private view {
        if (recipients.length == 0 || recipients.length > MAX_MEMBERS || weights.length != recipients.length)
            revert InvalidConfiguration();
        uint256 total;
        for (uint256 i; i < recipients.length; ++i) {
            if (recipients[i] == address(0) || recipients[i] == address(this)
                || !omr.isRecipient(recipients[i]) || weights[i] == 0) revert InvalidConfiguration();
            for (uint256 j; j < i; ++j) if (recipients[i] == recipients[j]) revert InvalidConfiguration();
            total += weights[i];
        }
        if (total != 10000) revert InvalidConfiguration();
    }

    function _hasMember(address member) private view returns (bool) {
        for (uint256 i; i < _members.length; ++i) if (_members[i] == member) return true;
        return false;
    }

    /// @notice Stop only this member's future share at the confirmed checkpoint.
    /// @dev The old snapshot/10000 denominator stays fixed; no remaining member is boosted.
    function suspendMember(address member, uint64 expectedRevision, bytes32 receipt) external onlyGame nonReentrant {
        if (dissolved) revert InvalidConfiguration();
        if (revision != expectedRevision || receipt == bytes32(0) || departureReceiptUsed[receipt])
            revert InvalidConsent();
        if (suspended[member] || !_hasMember(member)) revert InvalidConfiguration();
        _checkpoint(); _collect();
        departureReceiptUsed[receipt] = true; suspended[member] = true; ++revision;
        emit MemberSuspended(member, revision, receipt);
    }

    function hashReserveAllocation(address[] calldata recipients, uint16[] calldata weights,
        uint256 nativeAmount, uint256 omrAmount, uint64 expectedRevision, uint64 deadline)
        public view returns (bytes32)
    {
        return _hashTypedDataV4(keccak256(abi.encode(RESERVE_TYPEHASH, expectedRevision,
            keccak256(abi.encode(recipients)), keccak256(abi.encode(weights)), nativeAmount, omrAmount, deadline)));
    }

    /// @notice Allocate already-held reserve only under separate, exact leader consent.
    /// @dev Creates fixed-wallet credits, with no transfer, checkpoint, or donation accounting.
    function allocateReserve(address[] calldata recipients, uint16[] calldata weights, uint256 nativeAmount,
        uint256 omrAmount, uint64 expectedRevision, uint64 deadline, bytes calldata signature)
        external onlyGame nonReentrant
    {
        if (dissolved) revert InvalidConfiguration();
        if (revision != expectedRevision || deadline < block.timestamp || deadline > block.timestamp + 1 hours
            || ECDSA.recover(hashReserveAllocation(recipients, weights, nativeAmount, omrAmount,
                expectedRevision, deadline), signature) != leader) revert InvalidConsent();
        _validateSplit(recipients, weights);
        if ((nativeAmount == 0 && omrAmount == 0) || nativeAmount > nativeReserve || omrAmount > omrReserve)
            revert InvalidConfiguration();
        for (uint256 i; i < recipients.length; ++i)
            if (suspended[recipients[i]] || !_hasMember(recipients[i])) revert InvalidConfiguration();
        nativeReserve -= nativeAmount; omrReserve -= omrAmount;
        uint256 nativeLeft = nativeAmount; uint256 omrLeft = omrAmount;
        for (uint256 i = 1; i < recipients.length; ++i) {
            uint256 n = Math.mulDiv(nativeAmount, weights[i], 10000);
            uint256 o = Math.mulDiv(omrAmount, weights[i], 10000);
            credits[recipients[i]].nativeAmount += n; credits[recipients[i]].omrAmount += o;
            nativeLeft -= n; omrLeft -= o;
        }
        credits[recipients[0]].nativeAmount += nativeLeft; credits[recipients[0]].omrAmount += omrLeft;
        ++revision;
        emit ReserveAllocated(revision, keccak256(abi.encode(recipients)), keccak256(abi.encode(weights)), nativeAmount, omrAmount);
    }

    /// @dev The committed game succession determines leadership; existing member credits do not move.
    function setLeader(address next, uint64 expectedRevision, bytes32 receipt) external onlyGame nonReentrant {
        if (dissolved) revert InvalidConfiguration();
        if (next == address(0) || revision != expectedRevision || receipt == bytes32(0) || leaderReceiptUsed[receipt])
            revert InvalidConsent();
        leaderReceiptUsed[receipt] = true;
        leader = next; ++revision;
        emit LeaderSet(next, revision, receipt);
    }

    /// @notice End this family's fee policy and credit its held reserve to the fixed Treasury Safe.
    /// @dev Game authority attests dissolution. All earning wallets must first be suspended;
    /// old wallet credits and total liabilities are unchanged. No Treasury transfer occurs here.
    function dissolve(uint64 expectedRevision, bytes32 receipt) external onlyGame nonReentrant {
        if (dissolved) revert InvalidConfiguration();
        if (revision != expectedRevision || receipt == bytes32(0) || dissolutionReceiptUsed[receipt])
            revert InvalidConsent();
        for (uint256 i; i < _members.length; ++i)
            if (!suspended[_members[i]]) revert InvalidConfiguration();
        // Without an earning snapshot there is no authority to assign past fees.
        bool empty = _members.length == 0;
        if (empty) _requireNoUnallocatedPolicy();
        _checkpoint();
        if (empty) _requireNoUnallocatedPolicy();
        else _collect();
        uint256 nativeAmount = nativeReserve; uint256 omrAmount = omrReserve;
        nativeReserve = 0; omrReserve = 0;
        credits[safe].nativeAmount += nativeAmount; credits[safe].omrAmount += omrAmount;
        dissolutionReceiptUsed[receipt] = true; dissolved = true; ++revision;
        emit FamilyDissolved(revision, safe, receipt, nativeAmount, omrAmount);
    }

    function _requireNoUnallocatedPolicy() private view {
        if (registry.familyTreasury(family) == address(this)) revert InvalidConfiguration();
        (uint256 n, uint256 o) = registry.credits(address(this));
        if (n != 0 || o != 0) revert InvalidConfiguration();
    }

    function collect() external nonReentrant {
        if ((!dissolved && _members.length == 0) || !omr.isOperator(address(this))) revert InvalidConfiguration();
        _checkpoint(); _collect();
    }

    function _checkpoint() private {
        address[] memory lanes = game.activeLanes();
        if (lanes.length > MAX_LANES) revert InvalidConfiguration();
        for (uint256 i; i < lanes.length; ++i) IFamilyBridgeV2(lanes[i]).checkpointFees();
    }

    function _collect() private {
        (uint256 nativeAmount, uint256 omrAmount) = registry.credits(address(this));
        if (nativeAmount == 0 && omrAmount == 0) return;
        uint256 nativeBefore = address(this).balance;
        uint256 omrBefore = omr.balanceOf(address(this));
        registry.claim(payable(address(this)));
        if (address(this).balance - nativeBefore != nativeAmount
            || omr.balanceOf(address(this)) - omrBefore != omrAmount) revert InvalidTransfer();
        if (dissolved) {
            // Only exact, genuinely received registry fees reach Treasury; donations stay surplus.
            credits[safe].nativeAmount += nativeAmount; credits[safe].omrAmount += omrAmount;
        } else {
            uint256 nativeLeft = nativeAmount; uint256 omrLeft = omrAmount;
            // Integer dust stays with the first member of the earning snapshot.
            for (uint256 i = 1; i < _members.length; ++i) {
                uint256 n = Math.mulDiv(nativeAmount, _weights[i], 10000);
                uint256 o = Math.mulDiv(omrAmount, _weights[i], 10000);
                _creditOrReserve(_members[i], n, o);
                nativeLeft -= n; omrLeft -= o;
            }
            _creditOrReserve(_members[0], nativeLeft, omrLeft);
        }
        nativeLiability += nativeAmount; omrLiability += omrAmount;
        emit Collected(nativeAmount, omrAmount);
    }

    function _creditOrReserve(address member, uint256 nativeAmount, uint256 omrAmount) private {
        if (suspended[member]) { nativeReserve += nativeAmount; omrReserve += omrAmount; }
        else { credits[member].nativeAmount += nativeAmount; credits[member].omrAmount += omrAmount; }
    }

    /// @notice Anyone may pay a member, always to that member's earned wallet.
    function payout(address payable member) external nonReentrant {
        _payout(member);
    }

    /// @notice Bounded unattended payouts; a rejecting member cannot block the crew.
    function payoutBatch(address payable[] calldata recipients) external nonReentrant {
        if (recipients.length == 0 || recipients.length > MAX_MEMBERS) revert InvalidConfiguration();
        for (uint256 i; i < recipients.length; ++i) {
            try this.payBatchMember{gas: MEMBER_PAYOUT_GAS}(recipients[i]) {} catch { emit PayoutDeferred(recipients[i]); }
        }
    }

    /// @dev External self-call makes token/native changes atomic for each batch member.
    function payBatchMember(address payable member) external {
        if (msg.sender != address(this)) revert Unauthorized();
        _payout(member);
    }

    function _payout(address payable member) private {
        Credit memory c = credits[member];
        if (c.nativeAmount == 0 && c.omrAmount == 0) return;
        delete credits[member];
        nativeLiability -= c.nativeAmount; omrLiability -= c.omrAmount;
        if (c.omrAmount != 0) IERC20(address(omr)).safeTransfer(member, c.omrAmount);
        if (c.nativeAmount != 0) {
            (bool ok,) = member.call{value: c.nativeAmount}("");
            if (!ok) revert InvalidTransfer();
        }
        emit Paid(member, c.nativeAmount, c.omrAmount);
    }
}
