// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Original-wallet USDG custody and voluntary funder allocation for immutable work.
/// @dev Acceptance is not guaranteed payment. Allocation creates an irrevocable payee entitlement.
/// No admin, outcome oracle, redirect, upgrade or sweep. Native ETH is gas, not a payout asset.
/// Source only: deployment, actual finalized timing and financial activation require separate proof.
contract OmertaWorkEscrowRobinhood is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public constant USDG = 0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168;
    // An initial bounded ceiling, not a claim that finalized observation/work fits every term.
    uint64 public constant MAX_TERM = 24 hours;
    enum State { Empty, Funded, Accepted, Allocated, Settled, Refunded }
    struct Work {
        address funder;
        address payee;
        address asset;
        uint64 deadline;
        uint256 amount;
        bytes32 workHash;
        bytes32 outcomeHash;
        State state;
    }
    mapping(bytes32 => Work) private _works;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedWork;
    mapping(address => uint256) public liability;
    error InvalidTerms();
    error Unauthorized();
    error InvalidState();
    error TransferFailed();
    event Funded(bytes32 indexed id, address indexed funder, address indexed payee, address asset,
        uint256 amount, bytes32 workHash, uint64 deadline, uint256 nonce);
    event Accepted(bytes32 indexed id, address indexed payee);
    event Allocated(bytes32 indexed id, address indexed funder, address indexed payee, bytes32 outcomeHash, uint256 amount);
    event Settled(bytes32 indexed id, address indexed payee, address asset, uint256 amount);
    event Refunded(bytes32 indexed id, address indexed funder, address asset, uint256 amount);

    constructor() {
        if (block.chainid != 4663 || USDG.code.length == 0) revert InvalidTerms();
    }
    function work(bytes32 id) external view returns (Work memory) { return _works[id]; }
    function fund(uint256 nonce, address payee, address asset, uint256 amount, bytes32 workHash, uint64 deadline)
        external nonReentrant returns (bytes32 id)
    {
        if (payee == address(0) || payee == msg.sender || asset != USDG || amount == 0 || workHash == bytes32(0)
            || deadline < block.timestamp + 60 || deadline > block.timestamp + MAX_TERM) revert InvalidTerms();
        bytes32 source = keccak256(abi.encode(msg.sender, workHash));
        if (usedNonce[msg.sender][nonce] || usedWork[source]) revert InvalidState();
        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, nonce));
        usedNonce[msg.sender][nonce] = true;
        usedWork[source] = true;
        _works[id] = Work(msg.sender, payee, asset, deadline, amount, workHash, bytes32(0), State.Funded);
        uint256 beforeBalance = IERC20(USDG).balanceOf(address(this));
        IERC20(USDG).safeTransferFrom(msg.sender, address(this), amount);
        if (IERC20(USDG).balanceOf(address(this)) != beforeBalance + amount) revert TransferFailed();
        liability[USDG] += amount;
        emit Funded(id, msg.sender, payee, asset, amount, workHash, deadline, nonce);
    }
    function accept(bytes32 id) external nonReentrant {
        Work storage w = _works[id];
        if (msg.sender != w.payee) revert Unauthorized();
        if (w.state != State.Funded || block.timestamp >= w.deadline) revert InvalidState();
        w.state = State.Accepted;
        emit Accepted(id, msg.sender);
    }
    function allocate(bytes32 id, bytes32 outcomeHash) external nonReentrant {
        Work storage w = _works[id];
        if (msg.sender != w.funder) revert Unauthorized();
        if (w.state != State.Accepted || outcomeHash == bytes32(0) || block.timestamp >= w.deadline) revert InvalidState();
        w.outcomeHash = outcomeHash;
        w.state = State.Allocated;
        emit Allocated(id, msg.sender, w.payee, outcomeHash, w.amount);
    }
    function settle(bytes32 id) external nonReentrant {
        Work storage w = _works[id];
        if (msg.sender != w.payee) revert Unauthorized();
        if (w.state != State.Allocated) revert InvalidState();
        w.state = State.Settled;
        liability[USDG] -= w.amount;
        _pay(w.payee, w.amount);
        emit Settled(id, w.payee, USDG, w.amount);
    }
    function recover(bytes32 id) external nonReentrant {
        Work storage w = _works[id];
        if (msg.sender != w.funder) revert Unauthorized();
        if ((w.state != State.Funded && w.state != State.Accepted) || block.timestamp < w.deadline) revert InvalidState();
        w.state = State.Refunded;
        liability[USDG] -= w.amount;
        _pay(w.funder, w.amount);
        emit Refunded(id, w.funder, USDG, w.amount);
    }
    function _pay(address recipient, uint256 amount) private {
        uint256 beforeBalance = IERC20(USDG).balanceOf(address(this));
        uint256 beforeRecipient = IERC20(USDG).balanceOf(recipient);
        IERC20(USDG).safeTransfer(recipient, amount);
        if (IERC20(USDG).balanceOf(address(this)) + amount != beforeBalance
            || IERC20(USDG).balanceOf(recipient) != beforeRecipient + amount) revert TransferFailed();
    }
}
