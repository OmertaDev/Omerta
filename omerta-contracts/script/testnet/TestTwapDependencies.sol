// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IUniswapV2Factory, IUniswapV2Pair} from "../../src/OmrTwapOracle.sol";

/// @notice Virtual test token for the Robinhood Chain Testnet TWAP rehearsal only.
contract TestTwapWeth is ERC20 {
    constructor(address recipient) ERC20("Virtual Test Wrapped Ether", "vtWETH") {
        require(block.chainid == 46630, "TestTwapWeth: wrong chain");
        require(recipient != address(0), "TestTwapWeth: zero recipient");
        _mint(recipient, 1_000 ether);
    }
}

/// @notice Non-trading, fixed-reserve observation pair for testing OmrTwapOracle only.
/// @dev It holds no assets and intentionally has no swap, mint, burn, sync, or reserve setter.
contract TestFixedOmrV2Pair is IUniswapV2Pair {
    address public immutable override token0;
    address public immutable override token1;

    uint112 private immutable _reserve0;
    uint112 private immutable _reserve1;
    uint32 private immutable _blockTimestampLast;

    uint256 public constant override price0CumulativeLast = 0;
    uint256 public constant override price1CumulativeLast = 0;

    constructor(address omr, address weth) {
        require(block.chainid == 46630, "TestFixedOmrV2Pair: wrong chain");
        require(omr != address(0) && weth != address(0), "TestFixedOmrV2Pair: zero token");
        require(omr != weth, "TestFixedOmrV2Pair: same token");

        if (omr < weth) {
            token0 = omr;
            token1 = weth;
            _reserve0 = uint112(500_000 ether);
            _reserve1 = uint112(100 ether);
        } else {
            token0 = weth;
            token1 = omr;
            _reserve0 = uint112(100 ether);
            _reserve1 = uint112(500_000 ether);
        }
        _blockTimestampLast = uint32(block.timestamp % 2 ** 32);
    }

    function getReserves() external view override returns (uint112 reserve0, uint112 reserve1, uint32 timestampLast) {
        return (_reserve0, _reserve1, _blockTimestampLast);
    }
}

    /// @notice Minimal testnet-only factory attestation for the fixed observation pair.
    contract TestFixedV2Factory is IUniswapV2Factory {
        address public immutable tokenA;
        address public immutable tokenB;
        address public immutable pair;

        constructor(address tokenA_, address tokenB_, address pair_) {
            require(block.chainid == 46630, "TestFixedV2Factory: wrong chain");
            require(tokenA_ != address(0) && tokenB_ != address(0) && pair_ != address(0), "TestFixedV2Factory: zero");
            tokenA = tokenA_;
            tokenB = tokenB_;
            pair = pair_;
        }

        function getPair(address token0, address token1) external view returns (address) {
            if ((token0 == tokenA && token1 == tokenB) || (token0 == tokenB && token1 == tokenA)) return pair;
            return address(0);
        }
    }
