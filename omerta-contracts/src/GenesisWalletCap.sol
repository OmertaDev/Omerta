// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

interface IGenesisCapController {
    function auction() external view returns (address);
    function auctionCodeHash() external view returns (bytes32);
}

/// @dev ABI-exact interface of the pinned CCA validation hook. No CCA source fork is required.
interface IGenesisBidValidation {
    function validate(uint256 maxPrice, uint128 amount, address owner, address sender, bytes calldata hookData) external;
}

/// @notice One cumulative 0.28 ETH commitment allowance per bidding wallet for the bound Genesis auction.
/// @dev Accepted commitments never replenish on exit, refund, price change or a new bid. The caller
///      and recipient must be the same wallet, including for smart accounts. Relayers/routers that
///      submit on behalf of a different recipient are intentionally unsupported. No tx.origin check.
///      This limits wallets, not people: one person can control multiple wallets.
contract GenesisWalletCap is IGenesisBidValidation {
    uint256 public constant MAX_COMMITMENT = 0.28 ether;
    IGenesisCapController public immutable controller;
    bytes32 public immutable controllerCodeHash;
    mapping(address wallet => uint256 amount) public committed;
    uint256 public totalCommitted;

    error InvalidController();
    error UnauthorizedAuction();
    error BidderMustOwnBid();
    error InvalidAmount();
    error WalletCapExceeded(address wallet, uint256 remaining, uint256 requested);
    event CommitmentRecorded(address indexed wallet, uint256 amount, uint256 cumulative);

    constructor(IGenesisCapController controller_) {
        if (address(controller_).code.length == 0 || controller_.auction() != address(0)) revert InvalidController();
        controller = controller_;
        controllerCodeHash = address(controller_).codehash;
    }

    function validate(uint256, uint128 amount, address owner, address sender, bytes calldata) external {
        // The reviewed controller binds exactly once, before the auction starts. A foreign auction
        // or a direct caller cannot consume allowance, even if it supplies plausible bid fields.
        if (address(controller).codehash != controllerCodeHash) revert InvalidController();
        if (msg.sender != controller.auction() || msg.sender.codehash != controller.auctionCodeHash()) {
            revert UnauthorizedAuction();
        }
        if (owner == address(0) || sender != owner) revert BidderMustOwnBid();
        if (amount == 0) revert InvalidAmount();
        uint256 previous = committed[owner];
        uint256 remaining = MAX_COMMITMENT - previous;
        if (amount > remaining) revert WalletCapExceeded(owner, remaining, amount);
        // The auction transaction rolls these effects back if any later bid validation fails.
        committed[owner] = previous + amount;
        totalCommitted += amount;
        emit CommitmentRecorded(owner, amount, previous + amount);
    }

    function remainingCommitment(address wallet) external view returns (uint256) {
        return MAX_COMMITMENT - committed[wallet];
    }

    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return interfaceId == 0x01ffc9a7 || interfaceId == type(IGenesisBidValidation).interfaceId;
    }
}
