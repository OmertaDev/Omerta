// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {GenesisCoordinatorV2Test} from "./GenesisCoordinatorV2.t.sol";
import {OmertaGenesisCoordinatorV2} from "../../src/market-v2/OmertaGenesisCoordinatorV2.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IUnlockCallback} from "v4-core/interfaces/callback/IUnlockCallback.sol";
import {StateLibrary} from "v4-core/libraries/StateLibrary.sol";
import {PoolIdLibrary} from "v4-core/types/PoolId.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {TickMath} from "v4-core/libraries/TickMath.sol";

/// @dev A failed nested migration must remain retryable, never enable a refund path.
contract NestedGraduationCallerV2 is IUnlockCallback {
    IPoolManager private immutable _manager;
    OmertaGenesisCoordinatorV2 private immutable _coordinator;
    bytes public failure;

    constructor(IPoolManager manager_, OmertaGenesisCoordinatorV2 coordinator_) {
        _manager = manager_;
        _coordinator = coordinator_;
    }

    function attempt() external {
        _manager.unlock("");
    }

    function unlockCallback(bytes calldata) external returns (bytes memory) {
        require(msg.sender == address(_manager));
        try _coordinator.migrate() {
            revert("nested migration unexpectedly succeeded");
        } catch (bytes memory reason) {
            failure = reason;
        }
        return "";
    }
}

contract GraduationSettlementRegressionV2Test is GenesisCoordinatorV2Test {
    using StateLibrary for IPoolManager;
    using PoolIdLibrary for PoolKey;

    function test_nestedUnlockRollsBackGraduationAndAllowsCleanRetry() public {
        vm.prank(alice);
        sale.contribute{value: 1 ether}(2, new bytes32[](0));
        vm.warp(sale.closesAt());
        sale.settle(alice);

        NestedGraduationCallerV2 caller = new NestedGraduationCallerV2(manager, coordinator);
        caller.attempt();

        assertEq(caller.failure(), abi.encodeWithSelector(IPoolManager.AlreadyUnlocked.selector));
        assertFalse(coordinator.playerMigrationSucceeded());
        assertFalse(sale.released());
        assertFalse(sale.cancelled());
        assertFalse(auction.swept());
        assertEq(address(sale).balance, 1 ether);
        assertEq(address(auction).balance, 10 ether);
        (uint160 price,,,) = manager.getSlot0(coordinator.poolKey().toId());
        assertEq(price, 0);

        coordinator.migrate();
        assertTrue(coordinator.playerMigrationSucceeded());
        assertTrue(sale.released());
        assertTrue(auction.swept());
        assertEq(positions.ownerOf(1), address(coordinator));
    }

    function test_graduationPoolCannotBeInitializedAheadOfCoordinator() public {
        PoolKey memory key = coordinator.poolKey();
        vm.expectRevert();
        manager.initialize(key, TickMath.MIN_SQRT_PRICE + 1);
        (uint160 price,,,) = manager.getSlot0(key.toId());
        assertEq(price, 0);

        vm.prank(alice);
        sale.contribute{value: 1 ether}(2, new bytes32[](0));
        vm.warp(sale.closesAt());
        sale.settle(alice);
        coordinator.migrate();
        assertTrue(coordinator.playerMigrationSucceeded());
    }

    function test_forcedNativeBalancesCannotContaminateGraduationSpendOrCredits() public {
        vm.prank(alice);
        sale.contribute{value: 1 ether}(2, new bytes32[](0));
        vm.warp(sale.closesAt());
        sale.settle(alice);
        // Model unsolicited ETH at both custody layers, including a deterministic child.
        vm.deal(address(coordinator), 7 ether);
        vm.deal(address(positions), 2 ether);

        coordinator.migrate();

        assertTrue(coordinator.playerMigrationSucceeded());
        assertEq(positions.ownerOf(1), address(coordinator));
        assertEq(address(positions).balance, 0);
        uint256 credits = coordinator.residualCredit(address(0x11))
            + coordinator.residualCredit(address(0x12)) + coordinator.residualCredit(address(0x13));
        assertEq(address(coordinator).balance - credits, 9 ether);
        assertGe(credits, 11 ether * 5000 / 10_000);
        assertLe(credits, 11 ether - (11 ether * 5000 / 10_000) * 9900 / 10_000);
    }
}
