// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {SwapParams} from "v4-core/types/PoolOperation.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {BalanceDelta} from "v4-core/types/BalanceDelta.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// @notice Converts a reward vault's native ETH through one fixed, hookless standard v4 ETH/WBTC pool.
/// @dev Deployment requires a separately verified manager, initialized liquid pool and exact predicted vault.
///      Runtime hashes pin proxy bytecode only; they do not freeze a proxy's implementation or bridge authority.
contract OmertaWbtcConverterV2 is IUnlockCallback, ReentrancyGuard {
    error InvalidConfiguration();
    error UnauthorizedVault();
    error InvalidConversion();
    error InvalidDeadline();
    error RuntimeMismatch();
    error UnauthorizedCallback();
    error InvalidSwapDelta();
    error OutputBelowMinimum();
    error SettlementMismatch();
    error NativeTransferRejected();

    uint256 public constant MAX_DEADLINE_DELAY = 1 days;

    address public immutable authorizedVault;
    IERC20Metadata public immutable wbtc;
    IPoolManager public immutable externalManager;
    uint24 public immutable poolFee;
    int24 public immutable poolTickSpacing;
    bytes32 public immutable managerRuntimeHash;
    bytes32 public immutable wbtcRuntimeHash;

    bytes32 private _activePayloadHash;
    bool private _callbackPending;
    uint256 private _reportedOutput;

    constructor(
        address authorizedVault_,
        IERC20Metadata wbtc_,
        IPoolManager externalManager_,
        PoolKey memory pool_,
        bytes32 managerRuntimeHash_,
        bytes32 wbtcRuntimeHash_
    ) {
        if (
            authorizedVault_ == address(0) || address(wbtc_).code.length == 0
                || address(externalManager_).code.length == 0 || address(wbtc_) == address(externalManager_)
                || managerRuntimeHash_ == bytes32(0) || wbtcRuntimeHash_ == bytes32(0)
                || address(externalManager_).codehash != managerRuntimeHash_
                || address(wbtc_).codehash != wbtcRuntimeHash_ || wbtc_.decimals() != 8
                || Currency.unwrap(pool_.currency0) != address(0) || Currency.unwrap(pool_.currency1) != address(wbtc_)
                || address(pool_.hooks) != address(0) || pool_.fee >= 1_000_000
                || pool_.tickSpacing <= 0 || pool_.tickSpacing > TickMath.MAX_TICK_SPACING
        ) revert InvalidConfiguration();
        // A nonzero counterfactual address is allowed to resolve immutable vault/converter deployment ordering.
        authorizedVault = authorizedVault_;
        wbtc = wbtc_;
        externalManager = externalManager_;
        poolFee = pool_.fee;
        poolTickSpacing = pool_.tickSpacing;
        managerRuntimeHash = managerRuntimeHash_;
        wbtcRuntimeHash = wbtcRuntimeHash_;
    }

    function poolKey() public view returns (PoolKey memory key) {
        key.currency0 = Currency.wrap(address(0));
        key.currency1 = Currency.wrap(address(wbtc));
        key.fee = poolFee;
        key.tickSpacing = poolTickSpacing;
    }

    /// @notice Returns the exact new WBTC delivered directly to the authorized vault.
    /// @dev Existing adapter ETH and vault WBTC are never counted as conversion input or output.
    function convertNativeToWbtc(uint256 minOut, uint64 deadline)
        external
        payable
        nonReentrant
        returns (uint256 actualWbtc)
    {
        if (msg.sender != authorizedVault) revert UnauthorizedVault();
        if (minOut == 0 || msg.value == 0 || msg.value > uint256(uint128(type(int128).max))) {
            revert InvalidConversion();
        }
        if (deadline <= block.timestamp || uint256(deadline) > block.timestamp + MAX_DEADLINE_DELAY) {
            revert InvalidDeadline();
        }
        if (address(externalManager).codehash != managerRuntimeHash || address(wbtc).codehash != wbtcRuntimeHash) {
            revert RuntimeMismatch();
        }

        uint256 nativeBefore = address(this).balance - msg.value;
        uint256 balanceBefore = wbtc.balanceOf(authorizedVault);
        bytes memory payload = abi.encode(msg.value, minOut);
        _activePayloadHash = keccak256(payload);
        _callbackPending = true;
        externalManager.unlock(payload);
        if (_callbackPending || _reportedOutput == 0) revert UnauthorizedCallback();

        uint256 balanceAfter = wbtc.balanceOf(authorizedVault);
        if (balanceAfter < balanceBefore) revert SettlementMismatch();
        actualWbtc = balanceAfter - balanceBefore;
        if (actualWbtc < minOut) revert OutputBelowMinimum();
        if (actualWbtc != _reportedOutput || address(this).balance != nativeBefore) revert SettlementMismatch();
        _reportedOutput = 0;
        _activePayloadHash = bytes32(0);
    }

    function unlockCallback(bytes calldata data) external override returns (bytes memory) {
        if (msg.sender != address(externalManager) || !_callbackPending || keccak256(data) != _activePayloadHash) {
            revert UnauthorizedCallback();
        }
        _callbackPending = false;
        (uint256 amountIn, uint256 minOut) = abi.decode(data, (uint256, uint256));
        BalanceDelta delta = externalManager.swap(
            poolKey(), SwapParams(true, -int256(amountIn), TickMath.MIN_SQRT_PRICE + 1), ""
        );
        if (int256(delta.amount0()) != -int256(amountIn) || delta.amount1() <= 0) revert InvalidSwapDelta();
        uint256 output = uint256(uint128(delta.amount1()));
        if (output < minOut) revert OutputBelowMinimum();

        externalManager.sync(Currency.wrap(address(0)));
        if (externalManager.settle{value: amountIn}() != amountIn) revert SettlementMismatch();
        externalManager.take(Currency.wrap(address(wbtc)), authorizedVault, output);
        _reportedOutput = output;
        return abi.encode(output);
    }

    receive() external payable {
        revert NativeTransferRejected();
    }
}
