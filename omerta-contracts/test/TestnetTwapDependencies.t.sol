// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/interfaces/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/interfaces/IERC20Metadata.sol";
import {OmrTwapOracle, IUniswapV2Pair} from "../src/OmrTwapOracle.sol";

contract TwapCreationHarness {
    function deploy(bytes memory creationCode) external returns (address deployed) {
        assembly ("memory-safe") {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }
        require(deployed != address(0), "TwapCreationHarness: create failed");
    }
}

contract TestnetTwapDependenciesTest is Test {
    string private constant WETH_ARTIFACT = "TestTwapDependencies.sol:TestTwapWeth";
    string private constant PAIR_ARTIFACT = "TestTwapDependencies.sol:TestFixedOmrV2Pair";
    uint256 private constant WETH_SUPPLY = 1_000e18;
    uint32 private constant PERIOD = 600;

    address private safe = address(0x5AFE);
    address private omr = address(0x1000);
    TwapCreationHarness private harness;

    function setUp() public {
        harness = new TwapCreationHarness();
        vm.chainId(46630);
        vm.warp(1_000_000);
    }

    function test_virtual_weth_is_fixed_supply_to_the_safe_and_has_no_mint_surface() public {
        IERC20Metadata weth = IERC20Metadata(_deployWeth());

        assertEq(weth.name(), "Virtual Test Wrapped Ether");
        assertEq(weth.symbol(), "vtWETH");
        assertEq(weth.decimals(), 18);
        assertEq(weth.totalSupply(), WETH_SUPPLY);
        assertEq(weth.balanceOf(safe), WETH_SUPPLY);

        (bool ok,) = address(weth).call(abi.encodeWithSignature("mint(address,uint256)", safe, 1));
        assertFalse(ok);
        assertEq(weth.totalSupply(), WETH_SUPPLY);
    }

    function test_pair_sorts_tokens_and_encodes_exactly_5000_omr_per_eth() public {
        address weth = address(0x2000);
        IUniswapV2Pair pair = IUniswapV2Pair(_deployPair(omr, weth));

        assertEq(pair.token0(), omr);
        assertEq(pair.token1(), weth);
        (uint112 reserve0, uint112 reserve1, uint32 timestampLast) = pair.getReserves();
        assertEq(reserve0, 500_000e18);
        assertEq(reserve1, 100e18);
        assertEq(timestampLast, uint32(block.timestamp));

        uint256 independentlyDerivedOmrPerEth = (uint256(reserve0) * 1e18) / uint256(reserve1);
        assertEq(independentlyDerivedOmrPerEth, 5_000e18);
    }

    function test_pair_has_no_reserve_mutation_surface() public {
        address pair = _deployPair(omr, address(0x2000));

        (bool setReservesOk,) = pair.call(abi.encodeWithSignature("setReserves(uint112,uint112)", 1, 1));
        (bool syncOk,) = pair.call(abi.encodeWithSignature("sync()"));
        (bool swapOk,) = pair.call(abi.encodeWithSignature("swap(uint256,uint256,address,bytes)", 1, 0, safe, ""));

        assertFalse(setReservesOk);
        assertFalse(syncOk);
        assertFalse(swapOk);
        (uint112 reserve0, uint112 reserve1,) = IUniswapV2Pair(pair).getReserves();
        assertEq(reserve0, 500_000e18);
        assertEq(reserve1, 100e18);
    }

    function test_virtual_pair_drives_a_real_oracle_after_one_full_window() public {
        address weth = _deployWeth();
        IUniswapV2Pair pair = IUniswapV2Pair(_deployPair(omr, weth));
        OmrTwapOracle oracle = new OmrTwapOracle(safe, pair, omr, PERIOD);

        (uint256 unavailable, uint256 unavailableAt) = oracle.consult();
        assertEq(unavailable, 0);
        assertEq(unavailableAt, 0);

        vm.warp(block.timestamp + PERIOD + 1);
        oracle.update();
        (uint256 price, uint256 updatedAt) = oracle.consult();
        assertApproxEqRel(price, 5_000e18, 1e15);
        assertEq(updatedAt, block.timestamp);
    }

    function test_dependencies_refuse_non_robinhood_testnet_chains() public {
        vm.chainId(1);
        bytes memory wethCreation = abi.encodePacked(vm.getCode(WETH_ARTIFACT), abi.encode(safe));
        vm.expectRevert("TwapCreationHarness: create failed");
        harness.deploy(wethCreation);

        bytes memory pairCreation =
            abi.encodePacked(vm.getCode(PAIR_ARTIFACT), abi.encode(address(0x1000), address(0x2000)));
        vm.expectRevert("TwapCreationHarness: create failed");
        harness.deploy(pairCreation);
    }

    function _deployWeth() private returns (address) {
        bytes memory creation = abi.encodePacked(vm.getCode(WETH_ARTIFACT), abi.encode(safe));
        return harness.deploy(creation);
    }

    function _deployPair(address omr_, address weth_) private returns (address) {
        bytes memory creation = abi.encodePacked(vm.getCode(PAIR_ARTIFACT), abi.encode(omr_, weth_));
        return harness.deploy(creation);
    }
}
