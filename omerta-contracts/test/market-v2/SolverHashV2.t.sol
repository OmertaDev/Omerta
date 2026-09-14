// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {IPoolManager} from "v4-core/interfaces/IPoolManager.sol";
import {IHooks} from "v4-core/interfaces/IHooks.sol";
import {PoolKey} from "v4-core/types/PoolKey.sol";
import {Currency} from "v4-core/types/Currency.sol";
import {OmertaArbitrageV2} from "../../src/market-v2/OmertaArbitrageV2.sol";

/// Cross-language ABI vector shared with test/marketv2solver.js. No swap or dependency behavior
/// is claimed here: the etched constructor sentinels are only for testing the real hashPlan method.
contract SolverHashV2Test is Test {
    function test_javascript_reveal_hash_matches_actual_solidity_plan_domain() public {
        vm.chainId(31337);
        vm.etch(address(0x6000), hex"00");
        vm.etch(address(0x7000), hex"00");
        vm.etch(address(0x3000), hex"00");
        PoolKey memory canonical = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(0x7000)), 3000, 60, IHooks(address(0x3000)));
        OmertaArbitrageV2 implementation = new OmertaArbitrageV2(IPoolManager(address(0x6000)), canonical, address(0x9000), 2000, 1_000_000);
        vm.etch(address(0x4444), address(implementation).code);
        OmertaArbitrageV2.Plan memory p = OmertaArbitrageV2.Plan({
            alternative: PoolKey(Currency.wrap(address(0)), Currency.wrap(address(0x7000)), 500, 60, IHooks(address(0))),
            canonicalFirst: true, amount: 200000, minimumProfit: 376563, deadline: 1800000180,
            salt: 0x1111111111111111111111111111111111111111111111111111111111111111
        });
        assertEq(OmertaArbitrageV2(payable(address(0x4444))).hashPlan(address(0x1000), p),
            0xded4db9766aac20f1ad83050d6d37219876d06b7b3d0aa5b4c65aede445ccd78);
        vm.etch(address(0x1000), address(implementation).code);
        p.alternative = PoolKey(Currency.wrap(address(0)), Currency.wrap(address(0x3000)), 500, 10, IHooks(address(0)));
        p.canonicalFirst = false;
        p.amount = 1 ether;
        p.minimumProfit = 123;
        p.deadline = 1800000300;
        p.salt = bytes32(uint256(7));
        assertEq(OmertaArbitrageV2(payable(address(0x1000))).hashPlan(address(0x2000), p),
            0x77be99e7a5d7b1c5887002bbd3e5356e45e0bd821db2b10250497e7003470d59);
    }
}
