// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {SettlementGasPool} from "../../src/SettlementGasPool.sol";

abstract contract SettlementGasPoolTestBase is Test {
    address internal safe = makeAddr("safe");
    address internal vault = makeAddr("gameplayVault");
    address internal executor = makeAddr("executor");
    address internal sponsor = makeAddr("sponsor");
    bytes32 internal constant EVENT_ID = keccak256("event-1");
    bytes32 internal constant VICTIM_ID = keccak256("victim-1");
    uint256 internal constant VICTIM_NONCE = 7;
    uint64 internal constant OVERHEAD_GAS = 21_000;
    uint128 internal constant PRIORITY_CAP = 2 gwei;
    uint128 internal constant SETTLEMENT_CAP = 0.02 ether;

    SettlementGasPool internal pool;

    function setUp() public virtual {
        pool = new SettlementGasPool(safe, vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0);
        vm.deal(sponsor, 100 ether);
        vm.deal(vault, 1 ether);
    }

    function request(uint256 measuredGas) internal view returns (SettlementGasPool.CreditRequest memory) {
        return SettlementGasPool.CreditRequest({
            eventId: EVENT_ID,
            victimAccountId: VICTIM_ID,
            victimNonce: VICTIM_NONCE,
            executor: executor,
            measuredSettlementGas: measuredGas
        });
    }

    function fund(uint256 amount) internal {
        vm.prank(sponsor);
        pool.contribute{value: amount}(keccak256("community"));
    }

    function unpause() internal {
        vm.prank(safe);
        pool.unpauseCredits(keccak256("launch checks complete"));
    }
}
