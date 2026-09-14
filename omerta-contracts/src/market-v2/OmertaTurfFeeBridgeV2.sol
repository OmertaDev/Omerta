// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {OmertaTurfV2} from "./OmertaTurfV2.sol";
import {OmertaStabilityControllerV2} from "./OmertaStabilityControllerV2.sol";

/// @notice One immutable seasonal range's earned LP fees, checkpointed before game ownership changes.
/// @dev Source counters distinguish earned fees from donated balances. Principal never crosses this bridge.
contract OmertaTurfFeeBridgeV2 is ReentrancyGuard {
    using SafeERC20 for IERC20;
    uint256 private constant TURF = 6;
    address public immutable safe;
    OmertaTurfV2 public immutable registry;
    IERC20 public immutable omr;
    uint64 public immutable seasonId;
    uint32 public immutable turfId;
    OmertaStabilityControllerV2 public source;
    uint256 public forwardedNative;
    uint256 public forwardedOmr;
    bool public closed;

    error Unauthorized();
    error InvalidBinding();
    error InvalidAccounting();
    error NotExpired();
    event SourceBound(address indexed controller);
    event FeesForwarded(uint256 nativeAmount, uint256 omrAmount);
    event Closed();

    constructor(address safe_, OmertaTurfV2 registry_, uint64 season_, uint32 turf_) {
        if (safe_ == address(0) || address(registry_).code.length == 0 || registry_.owner() != safe_) {
            revert InvalidBinding();
        }
        (uint64 startsAt, uint64 endsAt, uint32 count) = registry_.seasons(season_);
        if (startsAt == 0 || endsAt <= startsAt || turf_ >= count) revert InvalidBinding();
        safe = safe_;
        registry = registry_;
        omr = registry_.omr();
        seasonId = season_;
        turfId = turf_;
    }

    /// @dev One-time binding permits deployment before its controller names this fee recipient.
    function bindSource(OmertaStabilityControllerV2 controller) external {
        if (msg.sender != safe) revert Unauthorized();
        if (address(source) != address(0) || address(controller).code.length == 0) revert InvalidBinding();
        OmertaTurfV2.Turf memory t = registry.turf(seasonId, turfId);
        (uint64 startsAt, uint64 endsAt,) = registry.seasons(seasonId);
        if (
            controller.safe() != safe || controller.feeRecipients(TURF) != address(this)
                || address(controller.omr()) != address(omr)
                || address(controller.marketState()) != address(registry.marketState())
                || controller.poolKey().tickSpacing != registry.tickSpacing() || controller.turfLower() != t.lowerTick
                || controller.turfUpper() != t.upperTick || controller.turfSeasonStart() != startsAt
                || controller.turfSeasonEnd() != endsAt
        ) {
            revert InvalidBinding();
        }
        source = controller;
        emit SourceBound(address(controller));
    }

    receive() external payable {
        if (msg.sender != address(source)) revert Unauthorized();
    }

    function checkpointFees() external nonReentrant {
        _checkpoint();
    }

    /// @notice Close only after the source range can no longer be deployed or accrue new fees.
    function close() external nonReentrant {
        (, uint64 endsAt,) = registry.seasons(seasonId);
        if (block.timestamp < endsAt) revert NotExpired();
        _checkpoint();
        closed = true;
        emit Closed();
    }

    function _checkpoint() private {
        if (closed) return;
        if (address(source) == address(0)) revert InvalidBinding();
        (uint64 laneSeason, uint32 laneTurf, bool bound) = registry.feeSources(address(this));
        if (!bound || laneSeason != seasonId || laneTurf != turfId) revert InvalidBinding();
        OmertaStabilityControllerV2.Tranche tranche = OmertaStabilityControllerV2.Tranche.Turf;
        OmertaStabilityControllerV2.Position memory p = source.position(tranche);
        if (p.liquidity != 0) {
            if (block.timestamp >= source.turfSeasonEnd()) source.expireTurf();
            else source.collect(tranche);
        }
        OmertaStabilityControllerV2.Account memory a = source.account(tranche);
        if (a.nativeFees != 0 || a.omrFees != 0) source.claimFees(tranche);
        uint256 nativeTotal = source.claimedNativeFees(TURF);
        uint256 omrTotal = source.claimedOmrFees(TURF);
        if (nativeTotal < forwardedNative || omrTotal < forwardedOmr) revert InvalidAccounting();
        uint256 nativeAmount = nativeTotal - forwardedNative;
        uint256 omrAmount = omrTotal - forwardedOmr;
        if (nativeAmount > address(this).balance || omrAmount > omr.balanceOf(address(this))) {
            revert InvalidAccounting();
        }
        if (nativeAmount == 0 && omrAmount == 0) return;
        forwardedNative = nativeTotal;
        forwardedOmr = omrTotal;
        if (omrAmount != 0) omr.forceApprove(address(registry), omrAmount);
        registry.depositFees{value: nativeAmount}(seasonId, turfId, omrAmount);
        if (omrAmount != 0) omr.forceApprove(address(registry), 0);
        emit FeesForwarded(nativeAmount, omrAmount);
    }
}
