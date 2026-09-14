// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {OmertaTurfV2} from "./OmertaTurfV2.sol";
import {OmertaTurfFeeBridgeV2} from "./OmertaTurfFeeBridgeV2.sol";

/// @notice Typed game settlement boundary: earned fees settle before future rights change.
/// @dev The adjudicator decides game outcomes. It cannot withdraw principal or create unbacked fees.
contract OmertaGameSettlementV2 is ReentrancyGuard {
    uint256 public constant MAX_ACTIVE_LANES = 64;
    address public immutable safe;
    address public immutable adjudicator;
    OmertaTurfV2 public registry;
    mapping(uint64 => mapping(uint32 => OmertaTurfFeeBridgeV2)) public bridges;
    OmertaTurfFeeBridgeV2[] private _active;
    error Unauthorized();
    error InvalidBinding();
    event RegistryBound(address indexed registry);
    event LaneRegistered(uint64 indexed seasonId, uint32 indexed turfId, address bridge);
    event LaneArchived(address indexed bridge);

    constructor(address safe_, address adjudicator_) {
        if (safe_ == address(0) || adjudicator_ == address(0)) revert InvalidBinding();
        safe = safe_;
        adjudicator = adjudicator_;
    }
    modifier onlyGame() {
        if (msg.sender != adjudicator) revert Unauthorized();
        _;
    }

    function bindRegistry(OmertaTurfV2 registry_) external {
        if (msg.sender != safe) revert Unauthorized();
        if (
            address(registry) != address(0) || address(registry_).code.length == 0 || registry_.game() != address(this)
                || registry_.owner() != safe
        ) revert InvalidBinding();
        registry = registry_;
        emit RegistryBound(address(registry_));
    }

    function registerLane(OmertaTurfFeeBridgeV2 bridge) external {
        if (msg.sender != safe) revert Unauthorized();
        if (
            address(registry) == address(0) || address(bridge).code.length == 0
                || address(bridge.registry()) != address(registry) || bridge.safe() != safe
                || address(bridge.source()) == address(0) || bridge.closed() || _active.length >= MAX_ACTIVE_LANES
        ) revert InvalidBinding();
        uint64 season = bridge.seasonId();
        uint32 turf = bridge.turfId();
        (uint64 startsAt,,) = registry.seasons(season);
        if (block.timestamp >= startsAt) revert InvalidBinding();
        (uint64 laneSeason, uint32 laneTurf, bool bound) = registry.feeSources(address(bridge));
        if (!bound || laneSeason != season || laneTurf != turf || address(bridges[season][turf]) != address(0)) {
            revert InvalidBinding();
        }
        bridges[season][turf] = bridge;
        _active.push(bridge);
        emit LaneRegistered(season, turf, address(bridge));
    }

    function activeLanes() external view returns (OmertaTurfFeeBridgeV2[] memory) {
        return _active;
    }

    /// @dev Free capacity for later seasons only after all source fees have reached their recipients.
    function archiveLane(uint256 index) external nonReentrant {
        if (index >= _active.length) revert InvalidBinding();
        OmertaTurfFeeBridgeV2 bridge = _active[index];
        bridge.close();
        _active[index] = _active[_active.length - 1];
        _active.pop();
        emit LaneArchived(address(bridge));
    }

    function setFamilyTreasury(uint64 family, address treasury, uint64 expectedRevision)
        external
        onlyGame
        nonReentrant
    {
        if (address(registry) == address(0)) revert InvalidBinding();
        // A wallet change affects every currently earning lane; cap bounds the work.
        for (uint256 i; i < _active.length; ++i) {
            _active[i].checkpointFees();
        }
        registry.setFamilyTreasury(family, treasury, expectedRevision);
    }

    function settleOwnership(
        uint64 season,
        uint32 turf,
        OmertaTurfV2.Split calldata owners,
        uint64 revision,
        uint64 epoch,
        bytes32 receipt
    ) external onlyGame nonReentrant {
        _checkpoint(season, turf);
        registry.settleOwnership(season, turf, owners, revision, epoch, receipt);
    }

    function settleStatus(
        uint64 season,
        uint32 turf,
        uint64 corridors,
        uint8 fortification,
        uint16 loyalty,
        uint64 revision,
        uint64 epoch,
        bytes32 receipt
    ) external onlyGame nonReentrant {
        registry.settleStatus(season, turf, corridors, fortification, loyalty, revision, epoch, receipt);
    }

    function startSiege(
        uint64 season,
        uint32 turf,
        OmertaTurfV2.Split calldata attacker,
        uint32 duration,
        uint16 victoryBps,
        uint64 revision,
        uint64 epoch,
        bytes32 receipt
    ) external onlyGame nonReentrant {
        _checkpoint(season, turf);
        registry.startSiege(season, turf, attacker, duration, victoryBps, revision, epoch, receipt);
    }

    function resolveSiege(uint64 season, uint32 turf, bool attackerWon, uint64 revision, uint64 epoch, bytes32 receipt)
        external
        onlyGame
        nonReentrant
    {
        _checkpoint(season, turf);
        registry.resolveSiege(season, turf, attackerWon, revision, epoch, receipt);
    }

    /// @notice Permissionless expiry still checkpoints the frozen fee recipients atomically.
    function expireSiege(uint64 season, uint32 turf) external nonReentrant {
        OmertaTurfV2.Siege memory siege = registry.siege(season, turf);
        if (siege.expiresAt == 0 || block.timestamp < siege.expiresAt) revert InvalidBinding();
        _checkpoint(season, turf);
        if (registry.siege(season, turf).expiresAt != 0) registry.expireSiege(season, turf);
    }

    function _checkpoint(uint64 season, uint32 turf) private {
        OmertaTurfFeeBridgeV2 bridge = bridges[season][turf];
        if (address(bridge) == address(0)) revert InvalidBinding();
        bridge.checkpointFees();
    }
}
