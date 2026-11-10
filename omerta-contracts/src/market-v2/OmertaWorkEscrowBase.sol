// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @notice Original-wallet custody and explicit funder allocation for one immutable work identity.
/// @dev No game-outcome oracle: accepted work is not guaranteed payment until its original funder
/// allocates. Allocation is an irrevocable payee entitlement. No admin, redirect, upgrade or sweep.
/// Source only: deployment and public financial activation remain unqualified/OFF.
contract OmertaWorkEscrowBase is ReentrancyGuard {
    using SafeERC20 for IERC20;
    address public constant USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;
    uint64 public constant MAX_TERM = 15 minutes;
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
        if (block.chainid != 8453 || USDC.code.length == 0) revert InvalidTerms();
    }
    function work(bytes32 id) external view returns (Work memory) { return _works[id]; }
    function fund(uint256 nonce, address payee, address asset, uint256 amount, bytes32 workHash, uint64 deadline)
        external payable nonReentrant returns (bytes32 id)
    {
        if (payee == address(0) || payee == msg.sender || amount == 0 || workHash == bytes32(0)
            || deadline < block.timestamp + 60 || deadline > block.timestamp + MAX_TERM
            || (asset != address(0) && asset != USDC)) revert InvalidTerms();
        bytes32 source = keccak256(abi.encode(msg.sender, workHash));
        if (usedNonce[msg.sender][nonce] || usedWork[source]) revert InvalidState();
        id = keccak256(abi.encode(block.chainid, address(this), msg.sender, nonce));
        usedNonce[msg.sender][nonce] = true;
        usedWork[source] = true;
        _works[id] = Work(msg.sender, payee, asset, deadline, amount, workHash, bytes32(0), State.Funded);
        if (asset == address(0)) {
            if (msg.value != amount) revert InvalidTerms();
        } else {
            if (msg.value != 0) revert InvalidTerms();
            uint256 beforeBalance = IERC20(USDC).balanceOf(address(this));
            IERC20(USDC).safeTransferFrom(msg.sender, address(this), amount);
            if (IERC20(USDC).balanceOf(address(this)) != beforeBalance + amount) revert TransferFailed();
        }
        liability[asset] += amount;
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
        liability[w.asset] -= w.amount;
        _pay(w.asset, w.payee, w.amount);
        emit Settled(id, w.payee, w.asset, w.amount);
    }
    function recover(bytes32 id) external nonReentrant {
        Work storage w = _works[id];
        if (msg.sender != w.funder) revert Unauthorized();
        if ((w.state != State.Funded && w.state != State.Accepted) || block.timestamp < w.deadline) revert InvalidState();
        w.state = State.Refunded;
        liability[w.asset] -= w.amount;
        _pay(w.asset, w.funder, w.amount);
        emit Refunded(id, w.funder, w.asset, w.amount);
    }
    function _pay(address asset, address recipient, uint256 amount) private {
        if (asset == address(0)) {
            (bool ok,) = payable(recipient).call{value: amount}("");
            if (!ok) revert TransferFailed();
        } else {
            uint256 beforeBalance = IERC20(USDC).balanceOf(address(this));
            uint256 beforeRecipient = IERC20(USDC).balanceOf(recipient);
            IERC20(USDC).safeTransfer(recipient, amount);
            if (IERC20(USDC).balanceOf(address(this)) + amount != beforeBalance
                || IERC20(USDC).balanceOf(recipient) != beforeRecipient + amount) revert TransferFailed();
        }
    }
}
