// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import {GenesisCharacterEligibility} from "./genesis-auction/GenesisCharacterEligibility.sol";

interface IGenesisPlayerIntegration {
    /// @return Final, graduated native ETH auction price in Q96 wei per token base unit; zero before finality.
    function playerPriceX96() external view returns (uint256);
    /// @notice Must verify successful pool migration and the common public claim cliff.
    function playerClaimsOpen() external view returns (bool);
    function playerMigrationSucceeded() external view returns (bool);
    /// @notice Atomically complete migration; revert on failure, returning sale ETH on rollback.
    function finalizePlayerProceeds() external payable;
}

/// @notice Fixed snapshot player tranche. Off-chain gameplay determines the Merkle list, never this contract.
/// @dev Exact per-wallet settlement avoids aggregate rounding releasing refundable ETH. Anyone may
/// settle another wallet; all participants must settle before migration. No privileged refund override.
contract GenesisPlayerSale is ReentrancyGuard, GenesisCharacterEligibility {
    using SafeERC20 for IERC20;
    uint256 public constant Q96 = 1 << 96;
    uint256 public constant PURCHASE_WINDOW = 48 hours;
    IERC20 public immutable token;
    IGenesisPlayerIntegration public immutable integration;
    bytes32 public immutable integrationCodeHash;
    bytes32 public immutable merkleRoot;
    uint256 public immutable chainId;
    uint256 public immutable inventory;
    uint256 public immutable openDeadline;
    uint256 public immutable migrationDeadline;
    address public immutable unsoldRecipient;
    uint256 public priceX96;
    uint256 public closesAt;
    uint256 public totalRequested;
    uint256 public participantCount;
    uint256 public settledCount;
    uint256 public totalAccepted;
    uint256 public totalAllocated;
    bool public released;
    bool public cancelled;
    bool public unsoldRecovered;
    mapping(address => uint256) public requested;
    mapping(address => uint256) public accepted;
    mapping(address => uint256) public allocation;
    mapping(address => bool) public settled;
    mapping(address => bool) public refunded;
    mapping(address => bool) public claimed;
    event Opened(uint256 priceX96, uint256 closesAt);
    event Contributed(address indexed wallet, uint256 amount);
    event Settled(address indexed wallet, uint256 accepted, uint256 tokens);
    event Cancelled();
    event ProceedsReleased(uint256 amount);
    event Refunded(address indexed wallet, uint256 amount);
    event Claimed(address indexed wallet, uint256 amount);
    error InvalidConfiguration();
    error WrongPhase();
    error InvalidEligibility();
    error TransferFailed();

    constructor(IERC20 token_, IGenesisPlayerIntegration integration_, bytes32 root_, uint256 inventory_,
        uint256 openDeadline_, uint256 migrationDeadline_, address unsoldRecipient_, IERC721 characterNft_)
        GenesisCharacterEligibility(characterNft_) {
        if (address(token_).code.length == 0 || address(integration_).code.length == 0 || root_ == bytes32(0)
            || inventory_ == 0 || openDeadline_ <= block.timestamp
            || migrationDeadline_ <= openDeadline_ + PURCHASE_WINDOW || unsoldRecipient_ == address(0)
            || unsoldRecipient_ == address(this)) revert InvalidConfiguration();
        token = token_; integration = integration_; integrationCodeHash = address(integration_).codehash;
        merkleRoot = root_; chainId = block.chainid; inventory = inventory_;
        openDeadline = openDeadline_; migrationDeadline = migrationDeadline_; unsoldRecipient = unsoldRecipient_;
    }
    function cap(uint8 daysPlayed) public pure returns (uint256) {
        if (daysPlayed == 1) return 0.5 ether;
        if (daysPlayed == 2) return 1 ether;
        if (daysPlayed == 3) return 2.5 ether;
        if (daysPlayed == 4 || daysPlayed == 5) return 5 ether;
        revert InvalidEligibility();
    }
    /// @dev Standard double-hashed Merkle leaf. Predict the CREATE address from the deployer's nonce
    /// before building the root; CREATE2 initcode includes the root and is not a simple prediction.
    function leaf(address wallet, uint8 daysPlayed) public view returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(chainId, address(this), wallet, daysPlayed))));
    }
    function open() external nonReentrant {
        if (cancelled || closesAt != 0 || block.timestamp >= openDeadline
            || block.chainid != chainId || address(integration).codehash != integrationCodeHash
            || token.balanceOf(address(this)) < inventory) revert WrongPhase();
        uint256 price = integration.playerPriceX96();
        if (price == 0 || Math.mulDiv(inventory, price, Q96) == 0) revert InvalidConfiguration();
        priceX96 = price; closesAt = block.timestamp + PURCHASE_WINDOW;
        emit Opened(price, closesAt);
    }
    function contribute(uint8 daysPlayed, bytes32[] calldata proof) external payable nonReentrant {
        if (cancelled || closesAt == 0 || block.timestamp >= closesAt || block.chainid != chainId) revert WrongPhase();
        _requireCharacter(msg.sender);
        uint256 maximum = cap(daysPlayed);
        if (msg.value == 0 || requested[msg.sender] + msg.value > maximum
            || !MerkleProof.verifyCalldata(proof, merkleRoot, leaf(msg.sender, daysPlayed))) revert InvalidEligibility();
        if (requested[msg.sender] == 0) participantCount++;
        requested[msg.sender] += msg.value; totalRequested += msg.value;
        emit Contributed(msg.sender, msg.value);
    }
    function settle(address wallet) external {
        if (cancelled || released || closesAt == 0 || block.timestamp < closesAt
            || block.timestamp >= migrationDeadline || requested[wallet] == 0 || settled[wallet]) revert WrongPhase();
        uint256 capacity = Math.mulDiv(inventory, priceX96, Q96);
        uint256 tokens = totalRequested > capacity
            ? Math.mulDiv(requested[wallet], inventory, totalRequested)
            : Math.mulDiv(requested[wallet], Q96, priceX96);
        uint256 payment = Math.mulDiv(tokens, priceX96, Q96, Math.Rounding.Ceil);
        settled[wallet] = true; settledCount++; allocation[wallet] = tokens; accepted[wallet] = payment;
        totalAllocated += tokens; totalAccepted += payment;
        emit Settled(wallet, payment, tokens);
    }
    function releaseProceeds() external nonReentrant {
        if (msg.sender != address(integration) || cancelled || released || closesAt == 0
            || block.timestamp < closesAt || block.timestamp >= migrationDeadline
            || settledCount != participantCount || address(integration).codehash != integrationCodeHash
            || block.chainid != chainId) revert WrongPhase();
        released = true;
        integration.finalizePlayerProceeds{value: totalAccepted}();
        if (!integration.playerMigrationSucceeded()) revert WrongPhase();
        emit ProceedsReleased(totalAccepted);
    }
    function cancel() external {
        if (released || cancelled || block.timestamp < migrationDeadline) revert WrongPhase();
        cancelled = true; emit Cancelled();
    }
    function refund() external nonReentrant {
        if ((!cancelled && !released) || refunded[msg.sender] || requested[msg.sender] == 0) revert WrongPhase();
        refunded[msg.sender] = true;
        uint256 amount = requested[msg.sender] - (cancelled ? 0 : accepted[msg.sender]);
        (bool ok,) = msg.sender.call{value: amount}("");
        if (!ok) revert TransferFailed();
        emit Refunded(msg.sender, amount);
    }
    function claim() external nonReentrant {
        if (!released || cancelled || claimed[msg.sender] || allocation[msg.sender] == 0
            || block.chainid != chainId || address(integration).codehash != integrationCodeHash
            || !integration.playerClaimsOpen()) revert WrongPhase();
        claimed[msg.sender] = true; token.safeTransfer(msg.sender, allocation[msg.sender]);
        emit Claimed(msg.sender, allocation[msg.sender]);
    }
    function recoverUnsold() external nonReentrant {
        if ((!released && !cancelled) || unsoldRecovered) revert WrongPhase();
        unsoldRecovered = true; token.safeTransfer(unsoldRecipient, inventory - (cancelled ? 0 : totalAllocated));
    }
}
