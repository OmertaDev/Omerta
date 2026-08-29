// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {PoolManager} from "v4-core/PoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {OMR} from "../src/OMR.sol";
import {GenesisProceedsSplitter} from "../src/GenesisProceedsSplitter.sol";

contract GenesisProceedsSplitterTest is Test {
    using PoolIdLibrary for PoolKey;

    uint160 internal constant SQRT_PRICE_1_1 = 79228162514264337593543950336;

    address payable internal treasury = payable(address(0x7E45));
    address payable internal vig = payable(address(0x716));
    address payable internal founder = payable(address(0xF0A));

    PoolManager internal manager;
    OMR internal omr;
    PoolKey internal key;
    GenesisProceedsSplitter internal splitter;

    function setUp() public {
        manager = new PoolManager(address(this));
        omr = new OMR(address(this));
        Currency native = Currency.wrap(address(0));
        Currency token = Currency.wrap(address(omr));
        key = native < token
            ? PoolKey(native, token, 3_000, 60, IHooks(address(0)))
            : PoolKey(token, native, 3_000, 60, IHooks(address(0)));
        splitter = new GenesisProceedsSplitter(manager, key.toId(), treasury, vig, founder);
    }

    function test_successful_residual_reproduces_the_original_non_lp_split_without_dust() public {
        manager.initialize(key, SQRT_PRICE_1_1);
        vm.deal(address(splitter), 5 ether + 7 wei);

        splitter.distributeResidual();

        uint256 total = 5 ether + 7 wei;
        uint256 expectedTreasury = total * 4_000 / 10_000;
        uint256 expectedVig = total * 3_600 / 10_000;
        assertEq(treasury.balance, expectedTreasury);
        assertEq(vig.balance, expectedVig);
        assertEq(founder.balance, total - expectedTreasury - expectedVig);
        assertEq(address(splitter).balance, 0, "a rounding remainder was stranded");
    }

    function test_residual_cannot_be_paid_as_revenue_before_the_pool_exists() public {
        vm.deal(address(splitter), 1 ether);
        vm.expectRevert(GenesisProceedsSplitter.PoolNotInitialized.selector);
        splitter.distributeResidual();
        assertEq(address(splitter).balance, 1 ether);
    }

    function test_failed_migration_recovery_returns_all_eth_to_treasury() public {
        vm.deal(address(splitter), 3 ether + 1 wei);
        splitter.recoverFailedLaunch();
        assertEq(treasury.balance, 3 ether + 1 wei);
        assertEq(vig.balance, 0);
        assertEq(founder.balance, 0);
    }

    function test_failure_recovery_closes_permanently_after_pool_initialization() public {
        manager.initialize(key, SQRT_PRICE_1_1);
        vm.deal(address(splitter), 1 ether);
        vm.expectRevert(GenesisProceedsSplitter.PoolAlreadyInitialized.selector);
        splitter.recoverFailedLaunch();
    }

    function test_omr_dust_and_failed_lp_reserves_return_only_to_treasury() public {
        omr.transfer(address(splitter), 1_653_750e18);
        splitter.recoverToken(omr);
        assertEq(omr.balanceOf(treasury), 1_653_750e18);
        assertEq(omr.balanceOf(address(splitter)), 0);
    }

    function test_no_empty_distribution_or_recovery_call_succeeds() public {
        vm.expectRevert(GenesisProceedsSplitter.NothingToDistribute.selector);
        splitter.recoverFailedLaunch();

        vm.expectRevert(GenesisProceedsSplitter.NothingToDistribute.selector);
        splitter.recoverToken(omr);

        manager.initialize(key, SQRT_PRICE_1_1);
        vm.expectRevert(GenesisProceedsSplitter.NothingToDistribute.selector);
        splitter.distributeResidual();
    }
}
