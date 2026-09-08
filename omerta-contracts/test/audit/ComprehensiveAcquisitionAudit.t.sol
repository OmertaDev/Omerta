// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Test} from "forge-std/Test.sol";
import {AcquisitionAuthority} from "../../src/AcquisitionAuthority.sol";
import {AcquisitionVaultCore} from "../../src/AcquisitionVaultCore.sol";
import {PreVoteBudgetBook} from "../../src/PreVoteBudgetBook.sol";
import {IAcquisitionAuthorityV2} from "../../src/interfaces/IAcquisitionAuthorityV2.sol";
import {StockTokenRegistryV2} from "../../src/StockTokenRegistryV2.sol";
import {SettlementGasPool} from "../../src/SettlementGasPool.sol";
import {RwaHealthOverlayTestBase} from "../utils/RwaHealthOverlayTestBase.sol";
import {IRwaHealthOverlay} from "../../src/interfaces/IRwaHealthOverlay.sol";

/// Test-only nonce deployment harness. Production Factory topology/hash validation
/// is covered separately by its existing real-Factory suites.
contract AcquisitionAuditNonceFactory {
    function deploy(bytes memory initcode) external returns (address child) {
        assembly ("memory-safe") { child := create(0, add(initcode, 32), mload(initcode)) }
        require(child != address(0), "audit fixture CREATE failed");
    }

    function finalize(address child, string calldata signature, bytes32 manifest) external {
        (bool ok, bytes memory reason) = child.call(abi.encodeWithSignature(signature, manifest));
        if (!ok) assembly ("memory-safe") { revert(add(reason, 32), mload(reason)) }
    }
}

contract AcquisitionAuditSafe {}

contract AcquisitionAuditIngress {
    function deposit(AcquisitionVaultCore core, bytes32 sourceId) external payable returns (bytes32) {
        return core.depositCanonical{value: msg.value}(sourceId);
    }
}

contract AcquisitionAuditForcedEther {
    constructor(address payable target) payable {
        selfdestruct(target);
    }
}

contract ComprehensiveAcquisitionAuditTest is Test {
    bytes32 private constant MANIFEST = keccak256("comprehensive acquisition audit 2026-09-08");
    bytes32 private constant DETAILS = keccak256("audit-only details");
    uint256 private constant CAP = 100 ether;
    AcquisitionAuditNonceFactory private factory;
    AcquisitionAuditSafe private safe;
    AcquisitionAuthority private authority;
    AcquisitionVaultCore private core;
    PreVoteBudgetBook private budget;
    AcquisitionAuditIngress private ingress;

    function setUp() public {
        vm.chainId(4663);
        vm.warp(200 days);
        vm.deal(address(this), 1_000 ether);
        factory = new AcquisitionAuditNonceFactory();
        safe = new AcquisitionAuditSafe();
        StockTokenRegistryV2 registry = new StockTokenRegistryV2(address(safe), address(0));
        address[5] memory peers;
        for (uint8 i; i < 5; ++i) {
            peers[i] = address(uint160(uint256(keccak256(abi.encodePacked(hex"d694", address(factory), i + 1)))));
        }
        authority = AcquisitionAuthority(
            _deploy(
                "AcquisitionAuthority.sol:AcquisitionAuthority",
                abi.encode(
                    address(factory), MANIFEST, address(safe), address(registry), peers[1], peers[2], peers[3], peers[4]
                )
            )
        );
        core = AcquisitionVaultCore(
            _deploy(
                "AcquisitionVaultCore.sol:AcquisitionVaultCore",
                abi.encode(address(factory), MANIFEST, peers[0], address(registry), peers[2], peers[3], peers[4], CAP)
            )
        );
        budget = PreVoteBudgetBook(
            _deploy(
                "PreVoteBudgetBook.sol:PreVoteBudgetBook",
                abi.encode(address(factory), MANIFEST, peers[0], peers[1], address(registry))
            )
        );
        address intent = _deploy(
            "AcquisitionIntentExecution.sol:AcquisitionIntentExecution",
            abi.encode(address(factory), MANIFEST, peers[1])
        );
        address reconciliation =
            _deploy("AcquisitionReconciliation.sol:AcquisitionReconciliation", abi.encode(address(factory), MANIFEST));
        factory.finalize(address(budget), "finalizeBudgetBook(bytes32)", MANIFEST);
        factory.finalize(reconciliation, "finalizeReconciliation(bytes32)", MANIFEST);
        factory.finalize(intent, "finalizeIntentExecution(bytes32)", MANIFEST);
        factory.finalize(address(core), "finalizeCore(bytes32)", MANIFEST);
        factory.finalize(address(authority), "finalizeAuthority(bytes32)", MANIFEST);
        ingress = new AcquisitionAuditIngress();
        _activateIngress(ingress);
    }

    // An unsolicited native donation must never alter canonical ingress limits,
    // and rotating ingress must never reset the global lifetime bound.
    function testFuzz_conservationAcrossDonationReclassificationAndIngressRotation(
        uint96 firstRaw,
        uint96 secondRaw,
        uint96 donationRaw,
        uint96 classifiedRaw
    ) public {
        uint256 first = bound(firstRaw, 1, 20 ether);
        uint256 second = bound(secondRaw, 1, 20 ether);
        uint256 donation = bound(donationRaw, 1, 20 ether);
        uint256 classified = bound(classifiedRaw, 1, donation);
        new AcquisitionAuditForcedEther{value: donation}(payable(address(core)));
        ingress.deposit{value: first}(core, bytes32(uint256(1)));
        assertEq(core.availableWei(), first);
        assertEq(core.accountingTotals().forcedSurplusWei, donation);
        core.syncBalance();
        vm.prank(address(safe));
        core.reclassifyUnattributed(classified, DETAILS);
        vm.prank(address(safe));
        authority.disableIngress(DETAILS);
        AcquisitionAuditIngress successor = new AcquisitionAuditIngress();
        _activateIngress(successor);
        successor.deposit{value: second}(core, bytes32(uint256(1)));
        AcquisitionVaultCore.AccountingTotals memory totals = core.accountingTotals();
        assertEq(totals.availableWei, first + second + classified);
        assertEq(totals.unattributedWei, donation - classified);
        assertEq(totals.actualBalanceWei, first + second + donation);
        assertEq(totals.accountedBackingWei, totals.actualBalanceWei);
        assertEq(totals.balanceDeficitWei, 0);
        assertEq(totals.forcedSurplusWei, 0);
        assertEq(core.globalLifetimeCanonicalDepositedWei(), first + second);
        assertEq(core.ingressLifetimeDepositedWei(1), first);
        assertEq(core.ingressLifetimeDepositedWei(2), second);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionVaultCore.NotActiveIngress.selector, address(ingress)));
        ingress.deposit{value: 1}(core, bytes32(uint256(2)));
    }

    function test_globalCapCannotBeResetByGovernanceIngressRotation() public {
        ingress.deposit{value: CAP}(core, bytes32(uint256(1)));
        vm.prank(address(safe));
        authority.disableIngress(DETAILS);
        AcquisitionAuditIngress successor = new AcquisitionAuditIngress();
        _activateIngress(successor);
        vm.expectRevert(abi.encodeWithSelector(AcquisitionVaultCore.DepositCapExceeded.selector, 4, CAP, CAP + 1));
        successor.deposit{value: 1}(core, bytes32(uint256(1)));
        assertEq(address(core).balance, CAP);
        assertEq(core.availableWei(), CAP);
        assertEq(core.globalLifetimeCanonicalDepositedWei(), CAP);
    }

    // Explicit fault injection: no current production path can remove this ETH.
    // Proves repair accounting if a future custody/outflow path creates a deficit.
    function testFuzz_injectedBalanceDeficitRepairNeverDoubleCredits(uint96 repairRaw) public {
        ingress.deposit{value: 10 ether}(core, bytes32(uint256(1)));
        vm.deal(address(core), 3 ether);
        uint256 repair = bound(repairRaw, 1, 10 ether);
        bytes32 id = ingress.deposit{value: repair}(core, bytes32(uint256(2)));
        AcquisitionVaultCore.DepositRecord memory record = core.getDeposit(id);
        assertEq(record.amountWei, record.balanceDeficitRepairWei + record.availableCreditWei);
        assertEq(record.balanceDeficitRepairWei, repair < 7 ether ? repair : 7 ether);
        assertEq(core.availableWei(), 10 ether + record.availableCreditWei);
        assertEq(core.globalLifetimeCanonicalDepositedWei(), 10 ether + repair);
        assertEq(core.accountingTotals().balanceDeficitWei, repair < 7 ether ? 7 ether - repair : 0);
    }

    // This is a release-phase proof, not an exploit: the current normative
    // milestone deliberately provides no readiness implementation or outflow.
    function test_realAuthorityKeepsBudgetUnreachableWhileStageIsDormant() public {
        ingress.deposit{value: 1 ether}(core, bytes32(uint256(1)));
        vm.expectRevert(abi.encodeWithSelector(IAcquisitionAuthorityV2.LocalReadinessFailed.selector, 11));
        vm.prank(address(safe));
        authority.unpause(DETAILS);
        uint256 day = block.timestamp / 1 days;
        PreVoteBudgetBook.PreVoteBudgetInput memory input =
            PreVoteBudgetBook.PreVoteBudgetInput(day, 1 ether, uint64((day + 1) * 1 days + 2 hours));
        vm.expectRevert(PreVoteBudgetBook.BudgetBookPaused.selector);
        vm.prank(address(safe));
        budget.authorizePreVoteBudget(input, DETAILS);
        assertTrue(authority.paused());
        assertEq(core.availableWei(), 1 ether);
    }

    function _activateIngress(AcquisitionAuditIngress next) private {
        IAcquisitionAuthorityV2.IngressConfig memory config =
            IAcquisitionAuthorityV2.IngressConfig(address(next), address(next).codehash, CAP, CAP, CAP);
        vm.prank(address(safe));
        bytes32 id = authority.proposeIngress(config, DETAILS);
        vm.warp(block.timestamp + 48 hours);
        vm.prank(address(safe));
        authority.activateIngress(id);
    }

    function _deploy(string memory artifact, bytes memory args) private returns (address) {
        return factory.deploy(abi.encodePacked(vm.getCode(artifact), args));
    }
}

contract AcquisitionAuditRefundingExecutor {
    SettlementGasPool private immutable pool;
    bool public attemptedReentry;
    bool public reentrySucceeded;
    bool public reject;

    constructor(SettlementGasPool pool_) {
        pool = pool_;
    }

    function setReject(bool value) external {
        reject = value;
    }

    function withdraw() external {
        pool.withdrawCredit();
    }

    receive() external payable {
        require(!reject, "recipient rejects native funds");
        attemptedReentry = true;
        (reentrySucceeded,) = address(pool).call(abi.encodeWithSelector(pool.withdrawCredit.selector));
        // A contribution callback is allowed and economically independent from
        // the gross withdrawal liability already consumed by this call.
        pool.contribute{value: msg.value / 2}(keccak256("return half"));
    }
}

contract ComprehensiveSettlementCallbackAuditTest is Test {
    SettlementGasPool private pool;
    AcquisitionAuditRefundingExecutor private recipient;
    address private constant VAULT = address(0xaaaa);
    bytes32 private constant REASON = keccak256("audit");

    function setUp() public {
        pool = new SettlementGasPool(address(this), VAULT, address(0), 21_000, 1 gwei, 1 ether, 0);
        recipient = new AcquisitionAuditRefundingExecutor(pool);
        vm.deal(address(this), 10 ether);
        pool.contribute{value: 2 ether}(REASON);
        pool.unpauseCredits(REASON);
        vm.fee(0);
        vm.txGasPrice(1 gwei);
        SettlementGasPool.CreditRequest memory request =
            SettlementGasPool.CreditRequest(REASON, keccak256("victim"), 1, address(recipient), 979_000);
        vm.prank(VAULT);
        pool.recordSettlementCredit(request);
    }

    function test_callbackDonationDoesNotRestoreWithdrawnLiabilityOrPermitDoubleWithdraw() public {
        recipient.withdraw();
        assertTrue(recipient.attemptedReentry());
        assertFalse(recipient.reentrySucceeded());
        assertEq(pool.totalCreditsRecorded(), 0.001 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0.001 ether);
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.credits(address(recipient)), 0);
        assertEq(address(recipient).balance, 0.0005 ether);
        assertEq(address(pool).balance, 1.9995 ether);
        assertEq(pool.unreservedBalance(), address(pool).balance);
    }

    function test_failedRecipientThenCallbackDonationRecoversExactOriginalCredit() public {
        recipient.setReject(true);
        vm.expectRevert(SettlementGasPool.WithdrawalFailed.selector);
        recipient.withdraw();
        assertEq(pool.credits(address(recipient)), 0.001 ether);
        assertEq(pool.totalOutstandingCredits(), 0.001 ether);
        assertEq(pool.totalCreditsWithdrawn(), 0);
        assertEq(address(pool).balance, 2 ether);
        recipient.setReject(false);
        recipient.withdraw();
        assertEq(pool.totalOutstandingCredits(), 0);
        assertEq(pool.totalCreditsWithdrawn(), 0.001 ether);
    }
}

contract ComprehensiveRwaGenerationAuditTest is RwaHealthOverlayTestBase {
    function test_pendingClearanceCannotCrossSameKeyRegistryReactivation() public {
        IRwaHealthOverlay.Clearance memory stale = _validClearance();
        bytes32 staleId = overlay.clearanceId(stale);
        _activate(registry, safe, token);
        _expectSafeReject(stale);
        assertFalse(overlay.usedClearanceId(staleId));
        IRwaHealthOverlay.Clearance memory current = _validClearance();
        bytes32 currentId = _record(current);
        assertNotEq(currentId, staleId);
        assertEq(overlay.clearanceGeneration(assetVersionKey), 1);
        assertEq(overlay.latestClearanceId(assetVersionKey), currentId);
    }

    function test_clearedHistoryStaysImmutableButCannotAuthorizeReactivatedGeneration() public {
        IRwaHealthOverlay.Clearance memory original = _validClearance();
        bytes32 firstId = _record(original);
        _activate(registry, safe, token);
        original.expectedOverlayGeneration = 2;
        _expectSafeReject(original);
        IRwaHealthOverlay.Clearance memory next = _validClearance();
        bytes32 nextId = _record(next);
        assertTrue(overlay.usedClearanceId(firstId));
        assertTrue(overlay.usedClearanceId(nextId));
        assertEq(overlay.clearanceGeneration(assetVersionKey), 2);
        assertEq(overlay.latestClearanceId(assetVersionKey), nextId);
    }
}
