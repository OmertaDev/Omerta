// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IGameCustodyTokenV2 is IERC20 {
    function policySealed() external view returns (bool);
    function isOperator(address) external view returns (bool);
    function isRecipient(address) external view returns (bool);
}

interface IGameCustodyGenesisV2 {
    function omr() external view returns (address);
    function treasury() external view returns (address);
    function playerClaimsOpen() external view returns (bool);
}

/// @notice Fixed-token game deposits and reserve-backed, signed OMR withdrawals.
/// @dev A ProtocolCustody operator: every token movement is to or from this vault.
/// The game signer attests ledger withdrawals; its onchain authority is bounded by
/// the actual balance, a mandatory UTC-day cap, and a one-day voucher lifetime.
contract OmertaGameCustodyV2 is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint256 public constant MAX_VOUCHER_TTL = 1 days;
    uint256 public constant LEDGER_SCALE = 1e12;
    bytes32 public constant VOUCHER_TYPEHASH =
        keccak256("Voucher(address to,uint256 amount,uint8 kind,uint256 gearId,uint256 nonce,uint256 deadline)");

    struct Voucher {
        address to;
        uint256 amount;
        uint8 kind;
        uint256 gearId;
        uint256 nonce;
        uint256 deadline;
    }

    IGameCustodyTokenV2 public immutable omr;
    IGameCustodyGenesisV2 public immutable genesis;
    bytes32 public immutable genesisRuntimeHash;
    address public signer;
    uint256 public dailyCapOMR;
    bool public activated;
    uint256 public cumulativeFunded;
    uint256 public cumulativeReserveFunded;
    uint256 public requiredReserve;
    uint256 public cumulativeClaimed;
    mapping(uint256 => bool) public usedNonce;
    mapping(uint256 => uint256) public claimedOnDay;

    error InvalidConfiguration();
    error NotReady();
    error InvalidAmount();
    error InvalidVoucher();
    error DailyCapExceeded();
    event Activated();
    event SignerSet(address indexed signer);
    event DailyCapSet(uint256 cap);
    event RequiredReserveSet(uint256 amount);
    event Deposited(address indexed payer, uint256 amount);
    event ReserveFunded(address indexed payer, uint256 amount);
    event Claimed(uint256 indexed nonce, address indexed to, uint8 kind, uint256 amount, uint256 gearId);

    constructor(address safe_, address signer_, IGameCustodyTokenV2 omr_, IGameCustodyGenesisV2 genesis_, uint256 cap_)
        EIP712("OmertaVoucherClaim", "1")
        Ownable(safe_)
    {
        if (signer_ == address(0) || address(omr_).code.length == 0 || address(genesis_).code.length == 0
            || cap_ == 0 || cap_ % LEDGER_SCALE != 0 || genesis_.omr() != address(omr_)
            || genesis_.treasury() != safe_) revert InvalidConfiguration();
        signer = signer_;
        omr = omr_;
        genesis = genesis_;
        genesisRuntimeHash = address(genesis_).codehash;
        dailyCapOMR = cap_;
    }

    function activate() external onlyOwner {
        if (activated || !omr.policySealed() || !omr.isOperator(address(this))
            || address(genesis).codehash != genesisRuntimeHash || !genesis.playerClaimsOpen()
            || requiredReserve == 0 || cumulativeReserveFunded < requiredReserve
            || omr.balanceOf(address(this)) < requiredReserve) revert NotReady();
        activated = true;
        emit Activated();
    }

    function setSigner(address next) external onlyOwner {
        if (next == address(0)) revert InvalidConfiguration();
        signer = next;
        emit SignerSet(next);
    }

    function setDailyCap(uint256 cap) external onlyOwner {
        if (cap == 0 || cap % LEDGER_SCALE != 0) revert InvalidConfiguration();
        dailyCapOMR = cap;
        emit DailyCapSet(cap);
    }

    /// @notice Freeze the approved existing-game backing requirement before activation.
    /// Player deposits cannot satisfy this treasury funding requirement.
    function setRequiredReserve(uint256 amount) external onlyOwner {
        if (activated || amount == 0 || amount % LEDGER_SCALE != 0) revert InvalidConfiguration();
        requiredReserve = amount;
        emit RequiredReserveSet(amount);
    }

    function pause() external onlyOwner { _pause(); }
    function unpause() external onlyOwner { _unpause(); }

    /// @dev Credit the depositing wallet only after the confirmed event is indexed.
    function deposit(uint256 amount) external nonReentrant whenNotPaused {
        if (!activated || !omr.isRecipient(msg.sender)) revert NotReady();
        _receive(amount);
        emit Deposited(msg.sender, amount);
    }

    /// @dev Treasury funding is not a player credit. No arbitrary sweep exists.
    function fundReserve(uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        _receive(amount);
        cumulativeReserveFunded += amount;
        emit ReserveFunded(msg.sender, amount);
    }

    function _receive(uint256 amount) private {
        if (amount == 0 || amount % LEDGER_SCALE != 0) revert InvalidAmount();
        uint256 beforeBalance = omr.balanceOf(address(this));
        IERC20(address(omr)).safeTransferFrom(msg.sender, address(this), amount);
        if (omr.balanceOf(address(this)) - beforeBalance != amount) revert InvalidAmount();
        cumulativeFunded += amount;
    }

    function hashVoucher(Voucher calldata v) public view returns (bytes32) {
        return _hashTypedDataV4(keccak256(abi.encode(VOUCHER_TYPEHASH,
            v.to, v.amount, v.kind, v.gearId, v.nonce, v.deadline)));
    }

    function claim(Voucher calldata v, bytes calldata signature) external nonReentrant whenNotPaused {
        if (!activated) revert NotReady();
        if (v.kind != 0 || v.gearId != 0 || v.to == address(0) || v.to == address(this) || v.amount == 0
            || v.amount % LEDGER_SCALE != 0 || usedNonce[v.nonce] || v.deadline < block.timestamp
            || v.deadline > block.timestamp + MAX_VOUCHER_TTL
            || ECDSA.recover(hashVoucher(v), signature) != signer) revert InvalidVoucher();
        uint256 day = block.timestamp / 1 days;
        uint256 next = claimedOnDay[day] + v.amount;
        if (next > dailyCapOMR) revert DailyCapExceeded();
        usedNonce[v.nonce] = true;
        claimedOnDay[day] = next;
        cumulativeClaimed += v.amount;
        IERC20(address(omr)).safeTransfer(v.to, v.amount);
        emit Claimed(v.nonce, v.to, 0, v.amount, 0);
    }
}
