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
        pool = deployPool(address(0), PRIORITY_CAP, SETTLEMENT_CAP);
        vm.deal(sponsor, 100 ether);
        vm.deal(vault, 1 ether);
    }

    function deployPool(address predecessor_, uint128 priorityFeeCapWei, uint128 perSettlementWeiCap)
        internal
        returns (SettlementGasPool deployed)
    {
        deployed = new SettlementGasPool(
            safe, vault, predecessor_, OVERHEAD_GAS, priorityFeeCapWei, perSettlementWeiCap, 0
        );
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

    function currentConfig() internal view returns (SettlementGasPool.Config memory config_) {
        (
            config_.priorityFeeCapWei,
            config_.perSettlementWeiCap,
            config_.dataFeeWeiCap,
            config_.dataFeeSource,
            config_.dataFeeSourceRuntimeCodeHash
        ) = pool.config();
    }

    function configHash(SettlementGasPool.Config memory config_) internal pure returns (bytes32) {
        return keccak256(abi.encode(config_));
    }

    function propose(SettlementGasPool.Config memory nextConfig, bytes32 reasonHash)
        internal
        returns (bytes32 proposalId)
    {
        vm.prank(safe);
        proposalId = pool.proposeConfig(nextConfig, reasonHash);
    }

    function executeAfterDelay(bytes32 proposalId) internal {
        vm.warp(block.timestamp + pool.CONFIG_DELAY());
        vm.prank(safe);
        pool.executeConfigProposal(proposalId);
    }
}
