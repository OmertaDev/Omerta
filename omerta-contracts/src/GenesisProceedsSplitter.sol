// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {PoolId} from "v4-core/types/PoolId.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";

/// @title GenesisProceedsSplitter
/// @notice Ownerless recipient for the currency and token dust returned by Uniswap's LBPStrategy.
///
/// @dev LBPStrategy uses one `recipient` for two materially different outcomes:
///        1. after a successful migration, residual currency and unused LP-token dust; and
///        2. after a failed migration, all recovered currency and the complete LP-token reserve.
///
///      Treating (2) as revenue would pay out a launch that never established its market. This
///      contract distinguishes the outcomes by reading the committed pool directly. OmertaHook
///      permits only the configured LBPStrategy to initialize that pool, and a failed inner
///      migration reverts the initialization with it, so a nonzero pool price is the authoritative
///      success signal.
///
///      Successful residual ETH is split 40% treasury / 36% Vig / 24% founder. Since the launcher
///      allocated 37.5% of raised ETH to LP first, those residual shares reproduce the original
///      whole-raise allocation: 25% treasury / 22.5% Vig / 15% founder. ERC-20 dust always returns
///      to treasury; on failure, both recovered ETH and the reserved OMR return there as well.
contract GenesisProceedsSplitter is ReentrancyGuard {
    using SafeERC20 for IERC20;
    using StateLibrary for IPoolManager;

    uint256 public constant BPS = 10_000;
    uint256 public constant TREASURY_BPS = 4_000;
    uint256 public constant VIG_BPS = 3_600;
    // Founder receives the exact remainder (2,400 bps), so rounding never strands wei.

    IPoolManager public immutable poolManager;
    PoolId public immutable canonicalPoolId;
    address payable public immutable treasuryRecipient;
    address payable public immutable vigRecipient;
    address payable public immutable founderRecipient;

    event ResidualDistributed(uint256 total, uint256 treasury, uint256 vig, uint256 founder);
    event FailedLaunchRecovered(uint256 amount, address indexed treasury);
    event TokenRecovered(address indexed token, uint256 amount, address indexed treasury);

    error ZeroAddress();
    error NothingToDistribute();
    error PoolNotInitialized();
    error PoolAlreadyInitialized();
    error TransferFailed(address recipient, uint256 amount);

    constructor(
        IPoolManager poolManager_,
        PoolId canonicalPoolId_,
        address payable treasuryRecipient_,
        address payable vigRecipient_,
        address payable founderRecipient_
    ) {
        if (
            address(poolManager_) == address(0) || treasuryRecipient_ == address(0) || vigRecipient_ == address(0)
                || founderRecipient_ == address(0)
        ) revert ZeroAddress();
        poolManager = poolManager_;
        canonicalPoolId = canonicalPoolId_;
        treasuryRecipient = treasuryRecipient_;
        vigRecipient = vigRecipient_;
        founderRecipient = founderRecipient_;
    }

    receive() external payable {}

    /// @notice True only after the committed v4 pool has been initialized successfully.
    function canonicalPoolInitialized() public view returns (bool) {
        (uint160 sqrtPriceX96,,,) = poolManager.getSlot0(canonicalPoolId);
        return sqrtPriceX96 != 0;
    }

    /// @notice Permissionlessly split all residual native currency after successful migration.
    function distributeResidual() external nonReentrant {
        if (!canonicalPoolInitialized()) revert PoolNotInitialized();
        uint256 total = address(this).balance;
        if (total == 0) revert NothingToDistribute();

        uint256 treasury = (total * TREASURY_BPS) / BPS;
        uint256 vig = (total * VIG_BPS) / BPS;
        uint256 founder = total - treasury - vig;

        _send(treasuryRecipient, treasury);
        _send(vigRecipient, vig);
        _send(founderRecipient, founder);
        emit ResidualDistributed(total, treasury, vig, founder);
    }

    /// @notice Return all native currency to treasury while migration has not succeeded.
    /// @dev Permissionless and non-redirectable. This is also safe before launch if ETH is sent here
    ///      accidentally. Once the canonical pool exists, the residual split is the only path.
    function recoverFailedLaunch() external nonReentrant {
        if (canonicalPoolInitialized()) revert PoolAlreadyInitialized();
        uint256 amount = address(this).balance;
        if (amount == 0) revert NothingToDistribute();
        _send(treasuryRecipient, amount);
        emit FailedLaunchRecovered(amount, treasuryRecipient);
    }

    /// @notice Return any ERC-20 dust or failed-migration token reserve to treasury.
    /// @dev The launch currency is native ETH. Tokens are never part of the revenue split.
    function recoverToken(IERC20 token) external nonReentrant {
        if (address(token) == address(0)) revert ZeroAddress();
        uint256 amount = token.balanceOf(address(this));
        if (amount == 0) revert NothingToDistribute();
        token.safeTransfer(treasuryRecipient, amount);
        emit TokenRecovered(address(token), amount, treasuryRecipient);
    }

    function _send(address payable recipient, uint256 amount) private {
        if (amount == 0) return;
        (bool ok,) = recipient.call{value: amount}("");
        if (!ok) revert TransferFailed(recipient, amount);
    }
}
