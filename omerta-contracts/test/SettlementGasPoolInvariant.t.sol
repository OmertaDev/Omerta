// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {StdInvariant} from "forge-std/StdInvariant.sol";
import {Test} from "forge-std/Test.sol";
import {SettlementGasPool} from "../src/SettlementGasPool.sol";

contract SettlementGasPoolHandler is Test {
    uint256 internal constant MAX_CONTRIBUTION = 0.25 ether;
    uint256 internal constant MAX_MEASURED_SETTLEMENT_GAS = 5_000_000;

    SettlementGasPool public immutable pool;
    address public immutable safe;
    address public immutable vault;
    address public immutable sponsor;
    address[4] public executors;

    uint256 public settlementNonce;
    uint256 public sumKnownCredits;
    uint256 public successfulWithdrawals;
    uint256 public creditsRecorded;

    constructor(SettlementGasPool pool_, address safe_, address vault_, address sponsor_) {
        pool = pool_;
        safe = safe_;
        vault = vault_;
        sponsor = sponsor_;
        executors = [address(0x1001), address(0x1002), address(0x1003), address(0x1004)];
    }

    function contribute(uint256 rawAmount, bytes32 memo) external {
        uint256 amount = rawAmount % MAX_CONTRIBUTION + 1;
        vm.prank(sponsor);
        pool.contribute{value: amount}(memo);
    }

    function recordSettlement(uint256 executorSeed, uint256 victimSeed, uint256 measuredSettlementGas) external {
        address selectedExecutor = executors[executorSeed % executors.length];
        measuredSettlementGas %= MAX_MEASURED_SETTLEMENT_GAS + 1;
        uint256 nonce = ++settlementNonce;
        SettlementGasPool.CreditRequest memory request = SettlementGasPool.CreditRequest({
            eventId: keccak256(abi.encode("invariant-event", nonce)),
            victimAccountId: keccak256(abi.encode("invariant-victim", victimSeed)),
            victimNonce: nonce,
            executor: selectedExecutor,
            measuredSettlementGas: measuredSettlementGas
        });

        vm.prank(vault);
        (uint256 credit,) = pool.recordSettlementCredit(request);
        sumKnownCredits += credit;
        creditsRecorded += credit;
    }

    function withdraw(uint256 executorSeed) external {
        address selectedExecutor = executors[executorSeed % executors.length];
        uint256 expectedAmount = pool.credits(selectedExecutor);
        if (expectedAmount == 0) return;

        vm.prank(selectedExecutor);
        uint256 withdrawn = pool.withdrawCredit();
        assertEq(withdrawn, expectedAmount);
        sumKnownCredits -= withdrawn;
        successfulWithdrawals += withdrawn;
    }

    function pause(bytes32 reasonSeed) external {
        if (pool.paused()) return;
        vm.prank(safe);
        pool.pauseCredits(keccak256(abi.encode("invariant-pause", reasonSeed)));
    }

    function unpause(bytes32 reasonSeed) external {
        if (!pool.paused()) return;
        vm.prank(safe);
        pool.unpauseCredits(keccak256(abi.encode("invariant-unpause", reasonSeed)));
    }

    function reduceCaps(uint256 prioritySeed, uint256 settlementSeed, uint256 dataFeeSeed) external {
        (uint128 priorityFeeCapWei, uint128 perSettlementWeiCap, uint128 dataFeeWeiCap,,) = pool.config();
        uint128 nextPriorityFeeCapWei = uint128(prioritySeed % (uint256(priorityFeeCapWei) + 1));
        uint128 nextPerSettlementWeiCap = uint128(settlementSeed % (uint256(perSettlementWeiCap) + 1));
        uint128 nextDataFeeWeiCap = uint128(dataFeeSeed % (uint256(dataFeeWeiCap) + 1));

        vm.prank(safe);
        pool.reduceCaps(nextPriorityFeeCapWei, nextPerSettlementWeiCap, nextDataFeeWeiCap);
    }
}

contract SettlementGasPoolInvariantTest is StdInvariant, Test {
    uint64 internal constant OVERHEAD_GAS = 21_000;
    uint128 internal constant PRIORITY_CAP = 2 gwei;
    uint128 internal constant SETTLEMENT_CAP = 0.02 ether;

    address internal safe = makeAddr("invariantSafe");
    address internal vault = makeAddr("invariantGameplayVault");
    address internal sponsor = makeAddr("invariantSponsor");

    SettlementGasPool internal pool;
    SettlementGasPoolHandler internal handler;

    function setUp() public {
        pool = new SettlementGasPool(safe, vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0);
        handler = new SettlementGasPoolHandler(pool, safe, vault, sponsor);
        vm.deal(sponsor, 1_000_000 ether);
        vm.prank(sponsor);
        pool.contribute{value: 10 ether}(keccak256("invariant-seed-funding"));
        vm.prank(safe);
        pool.unpauseCredits(keccak256("invariant-launch"));
        vm.fee(20 gwei);
        vm.txGasPrice(30 gwei);

        bytes4[] memory selectors = new bytes4[](6);
        selectors[0] = handler.contribute.selector;
        selectors[1] = handler.recordSettlement.selector;
        selectors[2] = handler.withdraw.selector;
        selectors[3] = handler.pause.selector;
        selectors[4] = handler.unpause.selector;
        selectors[5] = handler.reduceCaps.selector;
        targetContract(address(handler));
        targetSelector(FuzzSelector({addr: address(handler), selectors: selectors}));
    }

    function invariant_balance_always_backs_outstanding_credits() public view {
        assertGe(address(pool).balance, pool.totalOutstandingCredits());
    }

    function invariant_outstanding_equals_recorded_minus_withdrawn() public view {
        assertEq(pool.totalOutstandingCredits(), pool.totalCreditsRecorded() - pool.totalCreditsWithdrawn());
    }

    function invariant_known_credit_sum_equals_outstanding() public view {
        assertEq(handler.sumKnownCredits(), pool.totalOutstandingCredits());
    }

    function invariant_unreserved_is_exact_balance_minus_liability() public view {
        assertEq(pool.unreservedBalance(), address(pool).balance - pool.totalOutstandingCredits());
    }

    function invariant_withdrawal_ghost_matches_cumulative_withdrawals() public view {
        assertEq(handler.successfulWithdrawals(), pool.totalCreditsWithdrawn());
    }

    function invariant_recorded_ghost_conserves_live_and_withdrawn_credits() public view {
        assertEq(handler.creditsRecorded(), handler.sumKnownCredits() + handler.successfulWithdrawals());
        assertEq(handler.creditsRecorded(), pool.totalCreditsRecorded());
    }
}
