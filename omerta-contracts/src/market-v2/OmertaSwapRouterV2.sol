// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";

/// @notice Single ETH/OMR swap entry point that settles the manager's fee-adjusted deltas for its caller.
contract OmertaSwapRouterV2 is IUnlockCallback, ReentrancyGuard {
    using SafeERC20 for IERC20;

    struct SwapRequest {
        address payer;
        PoolKey key;
        SwapParams params;
        uint256 minOut;
        uint256 maxInput;
        uint256 fundedNative;
    }

    error InvalidConfiguration();
    error InvalidPool();
    error PolicyUnavailable();
    error DeadlineExpired();
    error UnauthorizedCallback();
    error InvalidSwapDelta();
    error OutputBelowMinimum();
    error InputAboveMaximum();
    error InsufficientNativeFunding();
    error SettlementMismatch();
    error NativeTransferFailed();

    IPoolManager public immutable manager;
    IOmertaRestrictedOMRV2 public immutable omr;
    bytes32 private _activePayloadHash;
    bool private _callbackPending;
    uint256 private _nativeSpent;

    constructor(IPoolManager manager_, IOmertaRestrictedOMRV2 token_) {
        if (address(manager_).code.length == 0 || address(token_).code.length == 0) revert InvalidConfiguration();
        manager = manager_;
        omr = token_;
    }

    /// @dev Partial fills are accepted when their actual fee-adjusted input and output satisfy the caller's limits.
    ///      OMR inputs go directly from the caller to the manager; the router never takes custody of OMR.
    function swap(PoolKey calldata key, SwapParams calldata params, uint256 minOut, uint256 maxInput, uint64 deadline)
        external
        payable
        nonReentrant
        returns (BalanceDelta delta)
    {
        if (block.timestamp > deadline) revert DeadlineExpired();
        if (Currency.unwrap(key.currency0) != address(0) || Currency.unwrap(key.currency1) != address(omr)) {
            revert InvalidPool();
        }
        if (
            !omr.policySealed() || omr.settlementManager() != address(manager) || !omr.isOperator(address(this))
                || !omr.isOperator(address(manager))
        ) {
            revert PolicyUnavailable();
        }
        if (msg.sender == tx.origin && msg.sender.code.length == 0) omr.registerWallet(msg.sender);
        if (!omr.isRecipient(msg.sender)) revert PolicyUnavailable();
        bytes memory payload = abi.encode(SwapRequest(msg.sender, key, params, minOut, maxInput, msg.value));
        _activePayloadHash = keccak256(payload);
        _callbackPending = true;
        bytes memory result = manager.unlock(payload);
        if (_callbackPending) revert UnauthorizedCallback();
        delta = abi.decode(result, (BalanceDelta));
        uint256 refund = msg.value - _nativeSpent;
        _nativeSpent = 0;
        _activePayloadHash = bytes32(0);
        if (refund != 0) {
            (bool ok,) = msg.sender.call{value: refund}("");
            if (!ok) revert NativeTransferFailed();
        }
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(manager) || !_callbackPending || keccak256(data) != _activePayloadHash) {
            revert UnauthorizedCallback();
        }
        _callbackPending = false;
        SwapRequest memory request = abi.decode(data, (SwapRequest));
        BalanceDelta delta = manager.swap(request.key, request.params, "");
        int128 input = request.params.zeroForOne ? delta.amount0() : delta.amount1();
        int128 output = request.params.zeroForOne ? delta.amount1() : delta.amount0();
        if (input > 0 || output < 0) revert InvalidSwapDelta();
        if (uint256(-int256(input)) > request.maxInput) revert InputAboveMaximum();
        if (uint256(int256(output)) < request.minOut) revert OutputBelowMinimum();

        int128 nativeDelta = delta.amount0();
        int128 omrDelta = delta.amount1();
        if (nativeDelta < 0) {
            uint256 amount = uint256(-int256(nativeDelta));
            if (amount > request.fundedNative) revert InsufficientNativeFunding();
            _nativeSpent = amount;
            manager.sync(request.key.currency0);
            if (manager.settle{value: amount}() != amount) revert SettlementMismatch();
        }
        if (omrDelta < 0) {
            uint256 amount = uint256(-int256(omrDelta));
            manager.sync(request.key.currency1);
            uint256 balanceBefore = omr.balanceOf(address(manager));
            IERC20(address(omr)).safeTransferFrom(request.payer, address(manager), amount);
            if (omr.balanceOf(address(manager)) - balanceBefore != amount || manager.settle() != amount) {
                revert SettlementMismatch();
            }
        }
        if (nativeDelta > 0) manager.take(request.key.currency0, request.payer, uint256(int256(nativeDelta)));
        if (omrDelta > 0) manager.take(request.key.currency1, request.payer, uint256(int256(omrDelta)));
        return abi.encode(delta);
    }

    receive() external payable {
        if (msg.sender != address(manager)) revert NativeTransferFailed();
    }
}
