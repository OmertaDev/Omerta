// SPDX-License-Identifier: CC0-1.0
pragma solidity 0.8.38;

import {PoolKey} from "v4-core/types/PoolKey.sol";

/// @notice URC-5 Token Venue Policy (Discussion), pinned to Uniswap/URCs
/// commit 02b9ab1d2176917f1098eaae300c607da71a78b1, URCs/urc-5.md.
/// @dev ERC-165 interface id: 0xfc300520. This proposal's ABI may change.
interface IVenuePolicy {
    enum VenueEnforcement {
        Preferred,
        Enforced
    }

    struct ExternalVenue {
        address venue;
        bool inbound;
        bool outbound;
    }

    event VenueEnforcementChanged(VenueEnforcement enforcement);
    event CanonicalPoolsChanged();
    event VenueStatusChanged(address indexed venue, bytes32 indexed poolId, bool inbound, bool allowed);
    event ExternalVenuesChanged();

    function venueEnforcement() external view returns (VenueEnforcement);
    function canonicalPools() external view returns (PoolKey[] memory);
    function venueAllowed(address venue, bytes32 poolId, bool inbound) external view returns (bool);
    function externalVenues()
        external
        view
        returns (bool inboundRestricted, bool outboundRestricted, ExternalVenue[] memory allowed);
}

/// @notice Refusal of a venue-directed transfer. Unknown pool identities use zero.
error VenueNotAllowed(address venue, bytes32 poolId, bool inbound);
