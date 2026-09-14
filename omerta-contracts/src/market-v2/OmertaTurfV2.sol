// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IOmertaMarketStateV2} from "./IOmertaMarketStateV2.sol";

/// @notice Seasonal territorial rights to already funded fees. Never custodies LP principal.
/// @dev The game adjudicator is trusted for future ownership and bounded game status only.
/// Every fee deposit checkpoints recipient addresses immediately; treasury changes are prospective.
/// An active siege freezes both recipient lists and its victory split until resolution or expiry.
contract OmertaTurfV2 is Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant BPS = 10_000;
    uint32 public constant MAX_TURFS = 64;
    uint32 public constant MIN_SIEGE = 1 hours;
    uint32 public constant MAX_SIEGE = 7 days;

    struct Split { uint64[4] families; uint16[4] shares; uint8 count; }
    struct Recipients { address[4] wallets; uint16[4] shares; uint8 count; }
    struct Season { uint64 startsAt; uint64 endsAt; uint32 turfCount; }
    struct Turf {
        int24 lowerTick;
        int24 upperTick;
        uint64 revision;
        uint64 lastEpoch;
        uint64 corridors;
        uint16 loyaltyBps;
        uint8 fortification;
        Split owners;
    }
    struct Siege {
        uint64 expiresAt;
        uint16 attackerVictoryBps;
        uint256 nativeEscrow;
        uint256 omrEscrow;
        Split attacker;
        Recipients defenderRecipients;
        Recipients attackerRecipients;
    }
    struct Credit { uint256 nativeAmount; uint256 omrAmount; }
    struct FeeLane { uint64 seasonId; uint32 turfId; bool bound; }

    IERC20 public immutable omr;
    address public immutable game;
    IOmertaMarketStateV2 public immutable marketState;
    int24 public immutable tickSpacing;
    uint32 public immutable maxObservationAge;
    uint64 public seasonCount;
    uint256 public nativeLiability;
    uint256 public omrLiability;
    mapping(uint64 => Season) public seasons;
    mapping(uint64 => mapping(uint32 => Turf)) private _turfs;
    mapping(uint64 => mapping(uint32 => Siege)) private _sieges;
    mapping(uint64 => address) public familyTreasury;
    mapping(uint64 => uint64) public familyRevision;
    mapping(bytes32 => bool) public settlementUsed;
    mapping(address => Credit) public credits;
    mapping(address => FeeLane) public feeSources;
    mapping(uint64 => mapping(uint32 => address)) public laneSource;

    error Unauthorized();
    error InvalidConfiguration();
    error InvalidSettlement();
    error StaleRevision();
    error InvalidSeason();
    error ActiveSiege();
    error InvalidSiege();
    error InvalidTransfer();
    error NothingToClaim();
    event FeeSourceBound(address indexed source, uint64 indexed seasonId, uint32 indexed turfId);
    event FamilyTreasurySet(uint64 indexed family, address indexed treasury, uint64 revision);
    event SeasonCreated(uint64 indexed season, uint64 startsAt, uint64 endsAt);
    event TurfCreated(uint64 indexed season, uint32 indexed turf, int24 lowerTick, int24 upperTick);
    event OwnershipSettled(uint64 indexed season, uint32 indexed turf, uint64 revision, bytes32 settlementId);
    event StatusSettled(uint64 indexed season, uint32 indexed turf, uint64 revision, uint64 corridors, uint8 fortification, uint16 loyaltyBps);
    event FeesFunded(uint64 indexed season, uint32 indexed turf, uint256 nativeAmount, uint256 omrAmount, bool escrowed);
    event SiegeStarted(uint64 indexed season, uint32 indexed turf, uint64 expiresAt, uint16 attackerVictoryBps);
    event SiegeEnded(uint64 indexed season, uint32 indexed turf, bool attackerWon, bool expired);
    event Claimed(address indexed account, address indexed recipient, uint256 nativeAmount, uint256 omrAmount);

    constructor(address safe, IERC20 token, address adjudicator, IOmertaMarketStateV2 state, int24 spacing, uint32 maxAge)
        Ownable(safe)
    {
        if (address(token).code.length == 0 || adjudicator == address(0) || address(state).code.length == 0
            || spacing <= 0 || spacing > 32767 || maxAge == 0 || maxAge > 1 days) revert InvalidConfiguration();
        omr = token;
        game = adjudicator;
        marketState = state;
        tickSpacing = spacing;
        maxObservationAge = maxAge;
    }

    /// @notice A bridge receives authority over exactly one immutable fee attribution lane.
    function bindFeeSource(address source, uint64 seasonId, uint32 turfId) external onlyOwner {
        if (source.code.length == 0 || feeSources[source].bound || seasons[seasonId].endsAt == 0
            || turfId >= seasons[seasonId].turfCount || block.timestamp >= seasons[seasonId].startsAt
            || laneSource[seasonId][turfId] != address(0)) revert InvalidConfiguration();
        feeSources[source] = FeeLane(seasonId, turfId, true);
        laneSource[seasonId][turfId] = source;
        emit FeeSourceBound(source, seasonId, turfId);
    }

    /// @notice Historical credits remain owned by their previous treasury address.
    function setFamilyTreasury(uint64 family, address treasury, uint64 expectedRevision) external {
        if (msg.sender != game) revert Unauthorized();
        if (family == 0 || treasury == address(0) || treasury == address(this)) revert InvalidConfiguration();
        if (familyRevision[family] != expectedRevision) revert StaleRevision();
        familyRevision[family] = expectedRevision + 1;
        familyTreasury[family] = treasury;
        emit FamilyTreasurySet(family, treasury, expectedRevision + 1);
    }

    function createSeason(uint64 startsAt, uint64 endsAt) external onlyOwner returns (uint64 id) {
        if (startsAt < block.timestamp || endsAt <= startsAt || endsAt - startsAt > 365 days
            || (seasonCount != 0 && startsAt < seasons[seasonCount].endsAt)) revert InvalidSeason();
        id = ++seasonCount;
        seasons[id] = Season(startsAt, endsAt, 0);
        emit SeasonCreated(id, startsAt, endsAt);
    }

    /// @dev Ranges must be ordered and non-overlapping and become immutable at creation.
    function createTurf(uint64 seasonId, int24 lower, int24 upper, Split calldata initialOwners)
        external onlyOwner returns (uint32 turfId)
    {
        Season storage s = seasons[seasonId];
        if (s.endsAt == 0 || block.timestamp >= s.startsAt || s.turfCount == MAX_TURFS) revert InvalidSeason();
        if (lower < -887272 || upper > 887272 || lower >= upper || lower % tickSpacing != 0 || upper % tickSpacing != 0)
            revert InvalidConfiguration();
        if (s.turfCount != 0 && lower < _turfs[seasonId][s.turfCount - 1].upperTick) revert InvalidConfiguration();
        _recipients(initialOwners);
        turfId = s.turfCount++;
        Turf storage t = _turfs[seasonId][turfId];
        t.lowerTick = lower;
        t.upperTick = upper;
        t.owners = initialOwners;
        t.revision = 1;
        emit TurfCreated(seasonId, turfId, lower, upper);
    }

    function turf(uint64 seasonId, uint32 turfId) external view returns (Turf memory) { return _turfs[seasonId][turfId]; }
    function siege(uint64 seasonId, uint32 turfId) external view returns (Siege memory) { return _sieges[seasonId][turfId]; }

    function settleOwnership(uint64 seasonId, uint32 turfId, Split calldata nextOwners, uint64 expectedRevision,
        uint64 epoch, bytes32 settlementId) external
    {
        Turf storage t = _settlement(seasonId, turfId, expectedRevision, epoch, settlementId);
        if (_sieges[seasonId][turfId].expiresAt != 0) revert ActiveSiege();
        _recipients(nextOwners);
        t.owners = nextOwners;
        t.corridors = 0;
        t.loyaltyBps = 0;
        t.fortification = 0;
        emit OwnershipSettled(seasonId, turfId, t.revision, settlementId);
    }

    /// @notice Status is bounded game data, never a multiplier on a funded claim.
    /// Corridors can identify only immediately adjacent, touching, same-syndicate territories.
    function settleStatus(uint64 seasonId, uint32 turfId, uint64 corridors, uint8 fortification, uint16 loyaltyBps,
        uint64 expectedRevision, uint64 epoch, bytes32 settlementId) external
    {
        Turf storage t = _settlement(seasonId, turfId, expectedRevision, epoch, settlementId);
        if (fortification > 10 || loyaltyBps > BPS) revert InvalidConfiguration();
        uint64 allowed;
        if (turfId > 0 && _connected(t, _turfs[seasonId][turfId - 1], false)) allowed |= uint64(1) << (turfId - 1);
        if (turfId + 1 < seasons[seasonId].turfCount && _connected(t, _turfs[seasonId][turfId + 1], true))
            allowed |= uint64(1) << (turfId + 1);
        if (corridors & ~allowed != 0) revert InvalidConfiguration();
        t.corridors = corridors;
        t.fortification = fortification;
        t.loyaltyBps = loyaltyBps;
        emit StatusSettled(seasonId, turfId, t.revision, corridors, fortification, loyaltyBps);
    }

    function startSiege(uint64 seasonId, uint32 turfId, Split calldata attacker, uint32 duration,
        uint16 attackerVictoryBps, uint64 expectedRevision, uint64 epoch, bytes32 settlementId) external
    {
        Turf storage t = _settlement(seasonId, turfId, expectedRevision, epoch, settlementId);
        Siege storage s = _sieges[seasonId][turfId];
        if (s.expiresAt != 0) revert ActiveSiege();
        if (duration < MIN_SIEGE || duration > MAX_SIEGE || block.timestamp + duration > seasons[seasonId].endsAt
            || attackerVictoryBps > BPS || attackerVictoryBps == 0
            || keccak256(abi.encode(attacker)) == keccak256(abi.encode(t.owners))) revert InvalidSiege();
        s.defenderRecipients = _recipients(t.owners);
        s.attackerRecipients = _recipients(attacker);
        s.attacker = attacker;
        s.expiresAt = uint64(block.timestamp + duration);
        s.attackerVictoryBps = attackerVictoryBps;
        emit SiegeStarted(seasonId, turfId, s.expiresAt, attackerVictoryBps);
    }

    function resolveSiege(uint64 seasonId, uint32 turfId, bool attackerWon, uint64 expectedRevision,
        uint64 epoch, bytes32 settlementId) external
    {
        _settlement(seasonId, turfId, expectedRevision, epoch, settlementId);
        Siege storage s = _sieges[seasonId][turfId];
        if (s.expiresAt == 0 || block.timestamp >= s.expiresAt) revert InvalidSiege();
        _finishSiege(seasonId, turfId, attackerWon, false);
    }

    /// @notice The game adapter exposes a permissionless expiry which checkpoints the fee source first.
    /// No market observation or adjudicator signature is needed to select the default defender outcome.
    function expireSiege(uint64 seasonId, uint32 turfId) external {
        if (msg.sender != game) revert Unauthorized();
        uint64 deadline = _sieges[seasonId][turfId].expiresAt;
        if (deadline == 0 || block.timestamp < deadline) revert InvalidSiege();
        ++_turfs[seasonId][turfId].revision;
        _finishSiege(seasonId, turfId, false, true);
    }

    /// @notice Only the controller can label received assets as territorial fees.
    /// @dev Late collected fees can still be attributed to their historical season.
    function depositFees(uint64 seasonId, uint32 turfId, uint256 omrAmount) external payable nonReentrant {
        FeeLane memory lane = feeSources[msg.sender];
        if (!lane.bound || lane.seasonId != seasonId || lane.turfId != turfId)
            revert Unauthorized();
        Season storage season = seasons[seasonId];
        if (season.endsAt == 0 || block.timestamp < season.startsAt || turfId >= season.turfCount) revert InvalidSeason();
        if (msg.value == 0 && omrAmount == 0) revert InvalidTransfer();
        uint256 beforeBalance = omr.balanceOf(address(this));
        if (omrAmount != 0) omr.safeTransferFrom(msg.sender, address(this), omrAmount);
        if (omr.balanceOf(address(this)) - beforeBalance != omrAmount) revert InvalidTransfer();
        nativeLiability += msg.value;
        omrLiability += omrAmount;
        Siege storage s = _sieges[seasonId][turfId];
        if (s.expiresAt != 0 && block.timestamp >= s.expiresAt) {
            // Expiry permits finalization at an atomic fee checkpoint. The last uncollected batch
            // belongs to the frozen siege recipients, including when a family wallet has rotated.
            s.nativeEscrow += msg.value;
            s.omrEscrow += omrAmount;
            ++_turfs[seasonId][turfId].revision;
            _finishSiege(seasonId, turfId, false, true);
            emit FeesFunded(seasonId, turfId, msg.value, omrAmount, true);
            return;
        }
        bool escrowed = s.expiresAt != 0;
        if (escrowed) { s.nativeEscrow += msg.value; s.omrEscrow += omrAmount; }
        else _credit(_recipients(_turfs[seasonId][turfId].owners), msg.value, omrAmount);
        emit FeesFunded(seasonId, turfId, msg.value, omrAmount, escrowed);
    }

    function claim(address payable recipient) external nonReentrant {
        if (recipient == address(0) || recipient == address(this)) revert InvalidTransfer();
        Credit memory c = credits[msg.sender];
        if (c.nativeAmount == 0 && c.omrAmount == 0) revert NothingToClaim();
        delete credits[msg.sender];
        nativeLiability -= c.nativeAmount;
        omrLiability -= c.omrAmount;
        if (c.omrAmount != 0) omr.safeTransfer(recipient, c.omrAmount);
        if (c.nativeAmount != 0) {
            (bool ok,) = recipient.call{value: c.nativeAmount}("");
            if (!ok) revert InvalidTransfer();
        }
        emit Claimed(msg.sender, recipient, c.nativeAmount, c.omrAmount);
    }

    function _settlement(uint64 seasonId, uint32 turfId, uint64 revision, uint64 epoch, bytes32 id)
        internal returns (Turf storage t)
    {
        if (msg.sender != game) revert Unauthorized();
        Season storage s = seasons[seasonId];
        if (block.timestamp < s.startsAt || block.timestamp >= s.endsAt || turfId >= s.turfCount) revert InvalidSeason();
        t = _turfs[seasonId][turfId];
        if (t.revision != revision) revert StaleRevision();
        bytes32 replayKey = keccak256(abi.encode(block.chainid, address(this), seasonId, turfId, id));
        if (id == bytes32(0) || settlementUsed[replayKey]) revert InvalidSettlement();
        IOmertaMarketStateV2.Snapshot memory observation = marketState.snapshot();
        if (!observation.valid || epoch != observation.epoch || epoch < t.lastEpoch
            || observation.observedAt > block.timestamp || block.timestamp - observation.observedAt > maxObservationAge)
            revert InvalidSettlement();
        settlementUsed[replayKey] = true;
        t.lastEpoch = epoch;
        ++t.revision;
    }

    function _recipients(Split memory split) internal view returns (Recipients memory r) {
        if (split.count == 0 || split.count > 4) revert InvalidConfiguration();
        uint256 total;
        r.count = split.count;
        for (uint256 i; i < 4; ++i) {
            if (i >= split.count) {
                if (split.families[i] != 0 || split.shares[i] != 0) revert InvalidConfiguration();
                continue;
            }
            if (split.shares[i] == 0 || familyTreasury[split.families[i]] == address(0)) revert InvalidConfiguration();
            for (uint256 j; j < i; ++j) if (split.families[j] == split.families[i]) revert InvalidConfiguration();
            r.wallets[i] = familyTreasury[split.families[i]];
            r.shares[i] = split.shares[i];
            total += split.shares[i];
        }
        if (total != BPS) revert InvalidConfiguration();
    }

    function _credit(Recipients memory r, uint256 nativeAmount, uint256 omrAmount) internal {
        uint256 nativeLeft = nativeAmount;
        uint256 omrLeft = omrAmount;
        for (uint256 i; i < r.count; ++i) {
            uint256 n = i + 1 == r.count ? nativeLeft : nativeAmount * r.shares[i] / BPS;
            uint256 o = i + 1 == r.count ? omrLeft : omrAmount * r.shares[i] / BPS;
            nativeLeft -= n;
            omrLeft -= o;
            credits[r.wallets[i]].nativeAmount += n;
            credits[r.wallets[i]].omrAmount += o;
        }
    }

    function _finishSiege(uint64 seasonId, uint32 turfId, bool attackerWon, bool expired) internal {
        Siege memory s = _sieges[seasonId][turfId];
        delete _sieges[seasonId][turfId];
        uint256 attackerNative = attackerWon ? s.nativeEscrow * s.attackerVictoryBps / BPS : 0;
        uint256 attackerOmr = attackerWon ? s.omrEscrow * s.attackerVictoryBps / BPS : 0;
        _credit(s.defenderRecipients, s.nativeEscrow - attackerNative, s.omrEscrow - attackerOmr);
        if (attackerWon) {
            _credit(s.attackerRecipients, attackerNative, attackerOmr);
            Turf storage t = _turfs[seasonId][turfId];
            t.owners = s.attacker;
            t.corridors = 0;
            t.loyaltyBps = 0;
            t.fortification = 0;
        }
        emit SiegeEnded(seasonId, turfId, attackerWon, expired);
    }

    function _connected(Turf storage a, Turf storage b, bool right) internal view returns (bool) {
        return (right ? a.upperTick == b.lowerTick : a.lowerTick == b.upperTick)
            && keccak256(abi.encode(a.owners)) == keccak256(abi.encode(b.owners));
    }
}
