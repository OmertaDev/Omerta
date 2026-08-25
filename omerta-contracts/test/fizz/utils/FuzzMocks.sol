// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC4626} from "@openzeppelin/contracts/token/ERC20/extensions/ERC4626.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IUniswapV2Pair} from "../../../src/OmrTwapOracle.sol";

contract FuzzUSDC is ERC20 {
    constructor() ERC20("Fuzz USD Coin", "fUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract FuzzVault is ERC4626 {
    constructor(IERC20 asset_) ERC4626(asset_) ERC20("Fuzz Vault USDC", "fvUSDC") {}

    function earn(uint256 amount) external {
        FuzzUSDC(asset()).mint(address(this), amount);
    }
}

contract FuzzPair is IUniswapV2Pair {
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;
    uint256 public price0CumulativeLast;
    uint256 public price1CumulativeLast;

    constructor(address token0_, address token1_, uint112 reserve0_, uint112 reserve1_) {
        token0 = token0_;
        token1 = token1_;
        reserve0 = reserve0_;
        reserve1 = reserve1_;
        blockTimestampLast = uint32(block.timestamp);
    }

    function getReserves() external view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function setReserves(uint112 reserve0_, uint112 reserve1_) external {
        uint32 timestamp = uint32(block.timestamp);
        unchecked {
            uint32 elapsed = timestamp - blockTimestampLast;
            if (elapsed != 0 && reserve0 != 0 && reserve1 != 0) {
                price0CumulativeLast += ((uint256(reserve1) << 112) / reserve0) * elapsed;
                price1CumulativeLast += ((uint256(reserve0) << 112) / reserve1) * elapsed;
            }
        }
        reserve0 = reserve0_;
        reserve1 = reserve1_;
        blockTimestampLast = timestamp;
    }
}
