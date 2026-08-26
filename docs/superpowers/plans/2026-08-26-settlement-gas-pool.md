# Settlement Gas Pool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the first deployable, non-upgradeable `SettlementGasPool` slice that lets community contributors fund capped native-gas credits for successful permissionless gameplay settlements without exposing gameplay custody, choosing submitters, or risking already-recorded executor liabilities.

**Architecture:** A standalone Solidity 0.8.26 pull-payment contract receives native ETH, accepts credit records only from one immutable gameplay-vault address, and treats every recorded credit as an exact liability. Governance is deliberately narrow: the Safe may pause credit creation and reduce caps immediately, while cap increases, a chain-native data-fee source, and successor migration use exact 48-hour proposals with a fixed seven-day execution window. Migration retires new credit creation in the old pool, moves only unreserved ETH to one code-hash-verified successor, and leaves all old credits withdrawable from the old pool.

**Tech Stack:** Solidity 0.8.26, Foundry/Forge 1.7.1, OpenZeppelin Contracts 5.6.1 (`Ownable2Step`, `Ownable`, `Pausable`, `ReentrancyGuard`), `forge-std/Test.sol`.

**Spec:** `C:/Users/Jorge/Documents/Omerta/omerta-brokers-design.md:1000` and `C:/Users/Jorge/Documents/Omerta/CHAIN-DEPLOY.md:1393`

## Global Constraints

- Submission is permissionless; do not build an approved-relayer registry, allowlist, three-relayer cap, operator relayer management, or Safe relayer-set controls.
- The pool is a dedicated, non-upgradeable contract accepting only the supported chain's native gas asset; it has no custody of, approval over, or call authority into OMR, gameplay principal, player liabilities, RWA acquisition ETH, Stock Tokens, or unrelated treasury funds.
- Contributions are final: they create no sponsor balance, refund, yield, priority, allocation weight, governance power, repayment claim, or other economic credit. The Safe has no treasury sweep.
- Only the immutable gameplay vault may record a credit, and the credit recipient is the address supplied by that trusted vault as the winning outer settlement executor; the pool does not verify gameplay EIP-712 authorizations or choose the winner.
- Every event-ID/victim-account/victim-nonce settlement key is processed at most once, including legitimate zero-loot settlements and zero-credit outcomes caused by pause, retirement, caps, or depleted sponsorship.
- The contract accepts no caller-supplied gas bill. It derives `reimbursableGasPrice = min(tx.gasprice, block.basefee + priorityFeeCapWei)` and `verifiedGasCost = measuredSettlementGas * reimbursableGasPrice + approvedChainNativeDataFee`, using a fixed immutable audited overhead and saturating/capped arithmetic.
- A recorded credit is `min(verifiedGasCost, perSettlementWeiCap, address(this).balance - totalOutstandingCredits)`. Empty sponsorship produces zero; insufficient sponsorship produces a partial credit.
- `totalOutstandingCredits` is an exact liability. Normal successful paths preserve `address(this).balance >= totalOutstandingCredits`; unreserved balance excludes liabilities and saturates to zero if impossible external balance corruption is observed.
- Settlement crediting never pushes ETH. Executors pull only their own accumulated credit to `msg.sender` using checks-effects-interactions plus `ReentrancyGuard`; withdrawals stay live while credit creation is paused or the pool is retired.
- The Safe may immediately pause new credits and reduce caps. Unpause requires a nonzero public reason hash, a solvent pool, and a non-retired pool. Cap increases and a new chain-native data-fee source require an exact public 48-hour proposal.
- The first deployed configuration has no data-fee source: `dataFeeSource == address(0)`, `dataFeeSourceRuntimeCodeHash == bytes32(0)`, and `dataFeeWeiCap == 0`. Any later source must be a reviewed on-chain contract pinned to its exact runtime code hash and queried by bounded-gas `staticcall`; failure, malformed return data, or code-hash drift contributes zero data fee rather than reverting credit recording.
- A migration proposal waits exactly 48 hours and expires seven days after becoming executable. It binds supported chain, current pool, exact successor, successor runtime code hash, exact amount, nonzero reason hash, proposal time, earliest execution, and expiry.
- Migration moves only unreserved ETH. The successor must expose the same version, supported chain, gameplay vault, and Safe owner; its immutable predecessor must equal the current pool. The first executed successor is permanently latched; later partial migrations may target only that same successor.
- Executing the first migration permanently retires new credits in the old pool and pauses them if necessary. The old pool retains exact backing for every outstanding credit and keeps withdrawals live.
- There is no owner sweep, manual reimbursement, arbitrary credit recipient, credit redirection, ERC-20 rescue/approval path, proxy, initializer, `delegatecall`, `tx.origin`, `selfdestruct`, or functional ownership renunciation.
- Constructor deployment starts credit creation paused. Direct contributions and predecessor migration receipts are accepted while paused; the Safe explicitly unpauses after funding and configuration checks.
- Use custom errors and events, match repository OpenZeppelin ownership/pause conventions, follow test-driven development, and leave existing deployment scripts/manifests unchanged in this slice.

## State Machines

### Credit lifecycle

`unprocessed -> processed/full | processed/partial | processed/zero_paused | processed/zero_unfunded | processed/zero_cap | processed/zero_retired`

Every `processed/*` state is terminal for the settlement key. A positive credit also changes the executor balance and liability totals; a zero state changes only the replay guard and emits evidence.

### Configuration proposal

`none -> waiting_48h -> executable -> executed | cancelled | expired`

An immediate cap reduction cancels a live configuration proposal before applying the reduction so a stale proposal cannot silently restore larger values.

### Migration proposal and pool lifecycle

`none -> waiting_48h -> executable -> executed | cancelled | expired`

`active -> retired` occurs on the first successful migration execution and is irreversible. Retirement disables direct contributions, configuration changes, unpause, and new positive credits; it does not disable executor withdrawals or additional exact partial migrations to the latched successor.

## File Structure

- `omerta-contracts/src/SettlementGasPool.sol` — native ETH accounting, settlement replay protection, pull credits, governance proposal state machines, and successor migration.
- `omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol` — one-method read-only boundary for the reviewed canonical chain-native data-fee source.
- `omerta-contracts/test/utils/SettlementGasPoolTestBase.sol` — shared addresses, pool deployment, funding, vault-call, time-warp, and assertion helpers used by focused suites.
- `omerta-contracts/test/SettlementGasPoolCore.t.sol` — contributions, formula, replay, pause/reduction, exact liabilities, and withdrawals.
- `omerta-contracts/test/SettlementGasPoolConfig.t.sol` — 48-hour config state machine and defensive data-fee source behavior.
- `omerta-contracts/test/SettlementGasPoolMigration.t.sol` — successor validation, exact unreserved migration, retirement, and retained old credits.
- `omerta-contracts/test/SettlementGasPoolInvariant.t.sol` — stateful accounting invariants and adversarial regression cases.

---

### Task 1: Core Native-Gas Credit Accounting and Pull Withdrawals

**Files:**
- Create: `omerta-contracts/src/SettlementGasPool.sol`
- Create: `omerta-contracts/test/utils/SettlementGasPoolTestBase.sol`
- Create: `omerta-contracts/test/SettlementGasPoolCore.t.sol`

**Interfaces:**
- Consumes: OpenZeppelin `Ownable2Step`, `Ownable`, `Pausable`, and `ReentrancyGuard`; a constructor-supplied Safe owner and immutable gameplay-vault address.
- Produces: `CreditRequest`, `Config`, `CreditStatus`, immutable getters `supportedChainId()`, `gameplayVault()`, `predecessor()`, `auditedOverheadGas()`, pure getter `version()`, `recordSettlementCredit(CreditRequest)`, `withdrawCredit()`, `contribute(bytes32)`, `unreservedBalance()`, `settlementKey(bytes32,bytes32,uint256)`, `previewCredit(uint256)`, `pauseCredits(bytes32)`, `unpauseCredits(bytes32)`, and `reduceCaps(uint128,uint128,uint128)`.

- [ ] **Step 1: Write the failing core tests and name the production break each catches**

Create `SettlementGasPoolTestBase.sol` with literal defaults and a constructor helper:

```solidity
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
        pool = new SettlementGasPool(
            safe, vault, address(0), OVERHEAD_GAS, PRIORITY_CAP, SETTLEMENT_CAP, 0
        );
        vm.deal(sponsor, 100 ether);
        vm.deal(vault, 1 ether);
    }

    function request(uint256 measuredGas)
        internal
        view
        returns (SettlementGasPool.CreditRequest memory)
    {
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
```

Create `SettlementGasPoolCore.t.sol` with focused tests whose assertions are hand-derived literals:

```solidity
contract SettlementGasPoolCoreTest is SettlementGasPoolTestBase {
    function test_constructor_starts_paused_and_pins_authority() public;
    function test_contribution_creates_no_sponsor_balance_or_refund_right() public;
    function test_receive_and_contribute_reject_zero_and_fallback_rejects_calldata() public;
    function test_only_immutable_vault_can_record_and_executor_must_be_nonzero() public;
    function test_credit_formula_caps_priority_fee_and_adds_fixed_overhead() public;
    function test_per_settlement_cap_limits_verified_cost() public;
    function test_insufficient_unreserved_balance_records_partial_credit() public;
    function test_empty_pool_processes_zero_credit_without_reverting() public;
    function test_paused_pool_processes_zero_credit_and_cannot_backfill_after_unpause() public;
    function test_same_event_victim_nonce_key_cannot_be_processed_twice() public;
    function test_distinct_victim_nonce_has_a_distinct_key() public;
    function test_withdraw_pays_only_callers_full_credit_and_updates_exact_totals() public;
    function test_failed_withdrawal_restores_credit_and_liability() public;
    function test_withdraw_remains_live_while_paused() public;
    function test_pause_requires_reason_and_reduction_cannot_increase_any_cap() public;
    function test_unpause_requires_reason_and_solvency() public;
    function test_renounce_ownership_is_disabled_and_transfer_is_two_step() public;
    function testFuzz_record_never_exceeds_cap_or_unreserved(uint256 measuredGas, uint256 funding) public;
}
```

For the formula test, use `vm.fee(20 gwei)` and `vm.txGasPrice(30 gwei)`. With `measuredSettlementGas = 79_000`, immutable overhead `21_000`, and priority cap `2 gwei`, assert a `100_000 * 22 gwei = 0.0022 ether` credit. For the partial test, contribute exactly `0.001 ether` and assert credit and outstanding liabilities are exactly `0.001 ether`. Before writing production code, state beside each test which mutation it catches: authority check removed, replay write removed, overhead omitted, priority cap ignored, per-settlement cap ignored, liabilities omitted from availability, CEI order reversed, or pause incorrectly blocking withdrawals.

- [ ] **Step 2: Run the core suite and verify RED for the missing production contract**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolCore.t.sol' -vv
```

Expected: compilation fails because `src/SettlementGasPool.sol` and its declared types/functions do not exist. Fix only test syntax or test setup errors until the failure is attributable to the missing production feature; preserve this RED output in the task report.

- [ ] **Step 3: Implement the minimal core contract that satisfies the failing behaviors**

Create the contract with these exact public types and signatures:

```solidity
enum CreditStatus { FULL, PARTIAL, ZERO_PAUSED, ZERO_UNFUNDED, ZERO_CAP, ZERO_RETIRED }

struct CreditRequest {
    bytes32 eventId;
    bytes32 victimAccountId;
    uint256 victimNonce;
    address executor;
    uint256 measuredSettlementGas;
}

struct Config {
    uint128 priorityFeeCapWei;
    uint128 perSettlementWeiCap;
    uint128 dataFeeWeiCap;
    address dataFeeSource;
    bytes32 dataFeeSourceRuntimeCodeHash;
}

function contribute(bytes32 memo) external payable;
function recordSettlementCredit(CreditRequest calldata request)
    external returns (uint256 credit, CreditStatus status);
function withdrawCredit() external nonReentrant returns (uint256 amount);
function unreservedBalance() public view returns (uint256);
function settlementKey(bytes32 eventId, bytes32 victimAccountId, uint256 victimNonce)
    public view returns (bytes32);
function previewCredit(uint256 measuredSettlementGas)
    external view
    returns (
        uint256 billableGas,
        uint256 reimbursableGasPrice,
        uint256 approvedDataFee,
        uint256 verifiedGasCost,
        uint256 available,
        uint256 credit,
        CreditStatus status
    );
function pauseCredits(bytes32 reasonHash) external onlyOwner;
function unpauseCredits(bytes32 reasonHash) external onlyOwner;
function reduceCaps(uint128 priorityFeeCapWei, uint128 perSettlementWeiCap, uint128 dataFeeWeiCap)
    external onlyOwner;
function version() public pure returns (bytes32);
```

Use `keccak256(abi.encode(supportedChainId, gameplayVault, eventId, victimAccountId, victimNonce))` for the replay key. Validate nonzero owner, vault, audited overhead, event ID, victim account ID, executor, initial priority cap, and initial per-settlement cap; validate a nonzero predecessor has code. Initialize `Config` with the three constructor caps and a zero source/hash, then call `_pause()`.

The recording order is: validate immutable authority and request identity; reject a previously processed key; mark the key processed; derive the capped cost; return and emit a terminal zero status for retirement, pause, zero per-settlement cap, or zero availability; otherwise add the exact positive credit to `credits[executor]`, `totalCreditsRecorded`, and `totalOutstandingCredits`. The function performs no external call.

Implement saturating helpers that stop at the per-settlement cap rather than overflowing:

```solidity
function _addCapped(uint256 a, uint256 b, uint256 cap) private pure returns (uint256) {
    if (a >= cap || b >= cap - a) return cap;
    return a + b;
}

function _mulCapped(uint256 a, uint256 b, uint256 cap) private pure returns (uint256) {
    if (a == 0 || b == 0) return 0;
    if (a > cap / b) return cap;
    uint256 product = a * b;
    return product > cap ? cap : product;
}
```

In Task 1 `_approvedDataFee()` returns zero because the source is disabled. `unreservedBalance()` returns zero when `balance <= totalOutstandingCredits`; otherwise it returns the difference. `withdrawCredit()` checks a nonzero caller balance, zeroes it and decrements outstanding before the call, increments `totalCreditsWithdrawn`, then sends only to `payable(msg.sender)` and reverts atomically on failure. Do not put `whenNotPaused` on withdrawal or contribution receipt.

Emit complete contribution, pause/unpause/reduction, credit, and withdrawal evidence. Override `renounceOwnership()` as `public view override onlyOwner` and revert `OwnershipRenunciationDisabled()`.

- [ ] **Step 4: Run focused and baseline tests to verify GREEN**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolCore.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/OMRTax.t.sol' -vv
```

Expected: all core tests and all 12 baseline `OMRTax` tests pass with zero failures and no compiler warnings. Record exact counts and output in the report.

- [ ] **Step 5: Self-review the core accounting mutations and commit**

Confirm a mental mutation of each authority, replay, cap, liability, and CEI line makes at least one named test fail. Confirm `git diff --check` is clean and no existing deployment or backend file changed. Commit:

```powershell
git add omerta-contracts/src/SettlementGasPool.sol omerta-contracts/test/utils/SettlementGasPoolTestBase.sol omerta-contracts/test/SettlementGasPoolCore.t.sol
git commit -m "feat: add settlement gas credit accounting"
```

---

### Task 2: Delayed Configuration and Defensive Native Data-Fee Source

**Files:**
- Create: `omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol`
- Modify: `omerta-contracts/src/SettlementGasPool.sol`
- Create: `omerta-contracts/test/SettlementGasPoolConfig.t.sol`
- Modify: `omerta-contracts/test/utils/SettlementGasPoolTestBase.sol`

**Interfaces:**
- Consumes: Task 1 `Config`, `previewCredit`, `recordSettlementCredit`, direct cap reductions, pause state, and exact-liability accounting.
- Produces: `ProposalState`, `ConfigProposal`, `CONFIG_DELAY == 48 hours`, `PROPOSAL_EXECUTION_WINDOW == 7 days`, `proposeConfig(Config,bytes32)`, `cancelConfigProposal(bytes32)`, `executeConfigProposal(bytes32)`, `getConfigProposal(bytes32)`, `configProposalState(bytes32)`, and a bounded-gas `ISettlementDataFeeSource.currentTransactionNativeDataFee()` read.

- [ ] **Step 1: Write failing configuration state-machine and data-source tests**

Create the interface first only as a test import boundary:

```solidity
interface ISettlementDataFeeSource {
    function currentTransactionNativeDataFee() external view returns (uint256);
}
```

Create `SettlementGasPoolConfig.t.sol` with local real contracts `FixedDataFeeSource`, `RevertingDataFeeSource`, and `MalformedDataFeeSource`. Add these tests:

```solidity
function test_config_proposal_binds_current_and_next_config_reason_and_times() public;
function test_config_cannot_execute_before_exact_48_hour_boundary() public;
function test_config_executes_at_48_hours_and_expires_after_7_day_window() public;
function test_config_proposal_can_be_cancelled_only_by_owner() public;
function test_only_one_live_config_proposal_exists() public;
function test_immediate_cap_reduction_cancels_live_config_proposal() public;
function test_noop_or_decrease_only_proposal_is_rejected() public;
function test_source_requires_contract_exact_runtime_hash_and_positive_data_cap() public;
function test_execute_rechecks_source_code_hash() public;
function test_reviewed_source_fee_is_capped_and_added_to_verified_cost() public;
function test_reverting_malformed_or_drifted_source_returns_zero_fee_without_reverting_credit() public;
function test_config_changes_do_not_mutate_existing_credits_or_liabilities() public;
```

At `proposedAt + 48 hours - 1`, assert `configProposalState(id) == WAITING` and execution reverts `ProposalNotExecutable`. At exactly `+48 hours`, assert `EXECUTABLE`. At `executableAt + 7 days + 1`, assert `EXPIRED`. For the fee calculation, use a literal source response of `0.0004 ether`, data cap `0.0001 ether`, and a gas component of `0.0022 ether`; assert verified cost is exactly `0.0023 ether`.

- [ ] **Step 2: Run the config suite and verify RED**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolConfig.t.sol' -vv
```

Expected: compilation fails because the proposal types/functions and production data-fee interface behavior are absent. Preserve the expected failure output.

- [ ] **Step 3: Implement the exact delayed configuration state machine**

Add:

```solidity
enum ProposalState { NONE, WAITING, EXECUTABLE, EXECUTED, CANCELLED, EXPIRED }

struct ConfigProposal {
    bytes32 id;
    bytes32 baseConfigHash;
    Config nextConfig;
    bytes32 reasonHash;
    uint64 proposedAt;
    uint64 executableAt;
    uint64 expiresAt;
    bool executed;
    bool cancelled;
}

uint64 public constant CONFIG_DELAY = 48 hours;
uint64 public constant PROPOSAL_EXECUTION_WINDOW = 7 days;

function proposeConfig(Config calldata nextConfig, bytes32 reasonHash)
    external onlyOwner returns (bytes32 proposalId);
function cancelConfigProposal(bytes32 proposalId) external onlyOwner;
function executeConfigProposal(bytes32 proposalId) external onlyOwner;
function getConfigProposal(bytes32 proposalId) external view returns (ConfigProposal memory);
function configProposalState(bytes32 proposalId) public view returns (ProposalState);
```

Use a monotonically increasing private proposal nonce in the ID:

```solidity
keccak256(abi.encode(
    "OMERTA_SETTLEMENT_GAS_POOL_CONFIG_V1",
    supportedChainId,
    address(this),
    proposalNonce,
    _configHash(config),
    _configHash(nextConfig),
    reasonHash,
    block.timestamp
));
```

Reject zero reason, no-op proposals, decrease-only proposals, a second waiting/executable proposal, and any proposal on a retired pool. For a zero source require zero source hash and zero data cap. For a nonzero source require code, exact `extcodehash`, and a positive data cap. On execution recheck time, base config hash, code existence, and exact runtime hash before assigning `config`. Mark executed before assignment and emit old/new config hashes plus reason and timestamps. A direct `reduceCaps` that changes any cap first marks a live proposal cancelled and emits the cancellation reason `keccak256("immediate cap reduction")`.

Implement `_approvedDataFee()` with a maximum 30,000-gas static call using the interface selector. Return zero if the configured source is zero, its current `extcodehash` differs, the call fails, or return data is not exactly 32 bytes. Decode the uint256 only after the length check and return `min(reportedFee, dataFeeWeiCap)`. This external view call is the only caller-selected-code boundary and the Safe, not a settlement submitter, selects it through the delayed proposal.

- [ ] **Step 4: Run focused, core, and baseline tests to verify GREEN**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolConfig.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolCore.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/OMRTax.t.sol' -vv
```

Expected: all three suites pass, and the source failure/drift cases prove credit recording remains nonreverting with `approvedDataFee == 0`.

- [ ] **Step 5: Self-review proposal transitions and commit**

Verify every state has a tested exit; an immediate reduction cannot later be overwritten by its cancelled increase; timestamp edges are literal; no source failure can strand a settlement key between replay check and terminal processing. Run `git diff --check`, then commit:

```powershell
git add omerta-contracts/src/SettlementGasPool.sol omerta-contracts/src/interfaces/ISettlementDataFeeSource.sol omerta-contracts/test/utils/SettlementGasPoolTestBase.sol omerta-contracts/test/SettlementGasPoolConfig.t.sol
git commit -m "feat: govern settlement gas pool configuration"
```

---

### Task 3: Exact Successor Migration, Retirement, and Retained Credits

**Files:**
- Modify: `omerta-contracts/src/SettlementGasPool.sol`
- Create: `omerta-contracts/test/SettlementGasPoolMigration.t.sol`
- Modify: `omerta-contracts/test/utils/SettlementGasPoolTestBase.sol`

**Interfaces:**
- Consumes: Task 1 immutable version/chain/vault/predecessor getters and unreserved-liability accounting; Task 2 `ProposalState` and 48-hour/seven-day timing constants.
- Produces: `MigrationProposal`, `successor()`, `retired()`, `proposeMigration(address,uint256,bytes32)`, `cancelMigrationProposal(bytes32)`, `executeMigration(bytes32)`, `getMigrationProposal(bytes32)`, `migrationProposalState(bytes32)`, and `acceptMigration(bytes32)` payable only by the immutable predecessor.

- [ ] **Step 1: Write failing successor validation, timing, and retained-liability tests**

Create `SettlementGasPoolMigration.t.sol` and add:

```solidity
function test_migration_proposal_binds_successor_codehash_amount_reason_and_times() public;
function test_migration_cannot_execute_before_48_hours_and_expires_after_window() public;
function test_migration_can_be_cancelled_only_by_owner() public;
function test_migration_rejects_zero_amount_or_amount_above_unreserved() public;
function test_migration_rejects_eoa_wrong_chain_wrong_vault_wrong_predecessor_wrong_owner_or_version() public;
function test_execute_rechecks_successor_codehash_and_identity() public;
function test_execution_moves_exact_unreserved_amount_and_preserves_old_liability() public;
function test_first_execution_latches_successor_retires_and_pauses_old_pool() public;
function test_retired_pool_processes_new_key_as_zero_retired_and_never_backfills() public;
function test_old_executor_withdraws_full_credit_after_retirement() public;
function test_later_partial_migration_can_only_target_latched_successor() public;
function test_direct_contribution_reverts_after_retirement_but_forced_eth_can_be_migrated() public;
function test_successor_accepts_migration_only_from_exact_predecessor() public;
function test_migration_reentrancy_or_failed_successor_receipt_reverts_atomically() public;
```

Deploy the old pool through a custom base helper with `priorityFeeCapWei = 1_000 gwei` and `perSettlementWeiCap = 1 ether`. Fund it with `3 ether`, set `block.basefee = 0`, set transaction gas price to `1_000 gwei`, record `measuredSettlementGas = 979_000` so the `21_000` audited overhead makes exactly `1_000_000` billable gas and an exact `1 ether` executor credit, then propose `1.5 ether`. After execution assert: old balance `1.5 ether`, old outstanding `1 ether`, old unreserved `0.5 ether`, successor balance `1.5 ether`, old executor credit `1 ether`, and no successor credit. After the old executor withdraws, assert old balance and old outstanding both decrease by exactly `1 ether`.

- [ ] **Step 2: Run the migration suite and verify RED**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolMigration.t.sol' -vv
```

Expected: compilation fails because the migration types/functions and retirement transitions do not exist. Preserve the RED output.

- [ ] **Step 3: Implement exact migration validation and irreversible retirement**

Add:

```solidity
struct MigrationProposal {
    bytes32 id;
    address successor;
    bytes32 successorRuntimeCodeHash;
    uint256 amount;
    bytes32 reasonHash;
    uint64 proposedAt;
    uint64 executableAt;
    uint64 expiresAt;
    bool executed;
    bool cancelled;
}

function proposeMigration(address successor_, uint256 amount, bytes32 reasonHash)
    external onlyOwner returns (bytes32 proposalId);
function cancelMigrationProposal(bytes32 proposalId) external onlyOwner;
function executeMigration(bytes32 proposalId) external onlyOwner nonReentrant;
function getMigrationProposal(bytes32 proposalId) external view returns (MigrationProposal memory);
function migrationProposalState(bytes32 proposalId) public view returns (ProposalState);
function acceptMigration(bytes32 migrationProposalId) external payable;
```

Use a migration-specific monotonic nonce and ID domain `"OMERTA_SETTLEMENT_GAS_POOL_MIGRATION_V1"`, binding `supportedChainId`, `address(this)`, exact successor, exact runtime code hash, exact amount, reason, and timestamps. At proposal and execution call a narrow successor interface to require:

```solidity
candidate.version() == version()
candidate.supportedChainId() == supportedChainId
candidate.gameplayVault() == gameplayVault
candidate.predecessor() == address(this)
candidate.owner() == owner()
candidate.paused() == true
```

Also require the candidate has code and exactly matches the proposed runtime code hash at execution. An existing latched successor must equal the candidate. The amount must be nonzero and no greater than current `unreservedBalance()` both when proposed and when executed.

`acceptMigration` requires `predecessor != address(0)`, `msg.sender == predecessor`, and positive value, then emits a migration receipt without creating sponsor or executor rights. `executeMigration` marks the proposal executed, latches the successor if this is the first execution, sets `retired = true`, pauses if not already paused, then calls `acceptMigration{value: amount}(proposalId)`. Any failed external call reverts all effects atomically. Later migrations remain available only to the latched successor. Direct `receive` and `contribute` revert after retirement; forced ETH remains reflected by `address(this).balance` and may be migrated.

`recordSettlementCredit` continues to mark a fresh key processed but returns `ZERO_RETIRED` before any cost/source read. `unpauseCredits`, config proposal creation/execution, and cap changes revert on a retired pool. Withdrawal logic is unchanged.

- [ ] **Step 4: Run migration, config, core, and baseline suites to verify GREEN**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolMigration.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolConfig.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolCore.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/OMRTax.t.sol' -vv
```

Expected: all focused and baseline suites pass with exact retained-liability assertions after retirement.

- [ ] **Step 5: Self-review migration authority and commit**

Verify that changing any successor identity getter, code hash, amount, or timing makes a named test fail; no path moves outstanding-credit backing; no owner function sends ETH except an executable exact migration; and the first successful successor cannot be replaced. Run `git diff --check`, then commit:

```powershell
git add omerta-contracts/src/SettlementGasPool.sol omerta-contracts/test/utils/SettlementGasPoolTestBase.sol omerta-contracts/test/SettlementGasPoolMigration.t.sol
git commit -m "feat: add delayed settlement pool migration"
```

---

### Task 4: Stateful Invariants and Adversarial Hardening

**Files:**
- Create: `omerta-contracts/test/SettlementGasPoolInvariant.t.sol`
- Modify: `omerta-contracts/test/SettlementGasPoolCore.t.sol`
- Modify: `omerta-contracts/test/SettlementGasPoolConfig.t.sol`
- Modify: `omerta-contracts/test/SettlementGasPoolMigration.t.sol`
- Modify only if a new failing adversarial test requires a fix: `omerta-contracts/src/SettlementGasPool.sol`

**Interfaces:**
- Consumes: all Tasks 1–3 public APIs and events.
- Produces: executable evidence for liability conservation, replay terminality, no sponsor rights, withdrawal isolation, saturating arithmetic, source-failure isolation, migration reservation, and the absence of an owner sweep/manual-credit path.

- [ ] **Step 1: Write failing stateful invariants and concrete red-team regressions**

Create a `SettlementGasPoolHandler` that owns a fixed array of four executor addresses, invokes contributions, authorized record calls, executor withdrawals, pause/unpause, and immediate reductions with bounded inputs, and maintains ghost values for the sum of executor credits and successful withdrawals. Target only the handler selectors.

Add invariant tests:

```solidity
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
```

Add concrete adversarial regressions before any production change:

```solidity
function test_max_measured_gas_and_max_fee_caps_saturate_without_overflow() public;
function test_reentrant_executor_cannot_double_withdraw() public;
function test_reverting_executor_keeps_exact_credit() public;
function test_forced_eth_creates_unreserved_balance_but_no_sponsor_or_executor_right() public;
function test_zero_credit_key_is_terminal_across_pause_fund_and_unpause() public;
function test_data_source_cannot_reenter_credit_or_withdraw_through_staticcall() public;
function test_owner_cannot_sweep_redirect_or_manually_create_credit() public;
function test_migration_never_reduces_old_balance_below_old_outstanding() public;
function test_two_distinct_victims_with_same_nonce_do_not_collide() public;
```

Run the concrete tests first. If every test passes against the existing implementation, keep them as independent adversarial coverage; if any fails for the intended security reason, preserve that RED evidence before the fix.

- [ ] **Step 2: Run the invariant suite and confirm its first meaningful result**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPoolInvariant.t.sol' -vv
```

Expected before the test harness compiles: RED for missing handler wiring or a real violated invariant. Fix test-only wiring until the handler runs real pool behavior. If the completed harness is green without a production change, record that it is characterization/security evidence rather than fabricate a failure; TDD still applies to every production fix triggered by it.

- [ ] **Step 3: Make only test-demonstrated production fixes**

For each failing regression or invariant, append a minimal focused test that reproduces the exact defect, confirm it fails for that defect, then change only `SettlementGasPool.sol` enough to pass. Do not add rescue functions, token handling, generalized roles, batch crediting, proxy hooks, deployment scripts, backend watchers, or a gameplay-vault integration in this task.

- [ ] **Step 4: Run the complete contract verification matrix**

Run:

```powershell
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' fmt --check
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test --match-path 'test/SettlementGasPool*.t.sol' -vv
& 'C:\Users\Jorge\AppData\Local\Temp\omerta-foundry-npm\node_modules\@foundry-rs\forge-win32-amd64\bin\forge.exe' test -vv
git diff --check
```

Expected: format check exits 0; every settlement pool test and the full Foundry suite report zero failures; `git diff --check` produces no output. Preserve exact suite/test/fuzz/invariant counts in the report.

- [ ] **Step 5: Review public authority surface and commit the hardening evidence**

Run `forge inspect SettlementGasPool methods` and verify the method list contains no sweep, rescue, manual credit, arbitrary recipient withdrawal, token approval, upgrade, initializer, or delegatecall surface. Verify every mutating path is classified as contribution, immutable-vault credit, self-withdrawal, Safe pause/reduction/delayed governance, or exact predecessor/successor migration. Commit:

```powershell
git add omerta-contracts/test/SettlementGasPoolInvariant.t.sol omerta-contracts/test/SettlementGasPoolCore.t.sol omerta-contracts/test/SettlementGasPoolConfig.t.sol omerta-contracts/test/SettlementGasPoolMigration.t.sol omerta-contracts/src/SettlementGasPool.sol
git commit -m "test: harden settlement gas pool invariants"
```

If `SettlementGasPool.sol` did not change in this task, omit it from `git add`.

## Out of Scope for This Plan

- Gameplay-vault EIP-712 settlement authorization, loss derivation, signer generations, victim nonce consumption, and the nonreverting isolated hook call.
- Backend settlement journal/finality watcher, HTTP unsigned-calldata endpoint, hosted rate limits, and operator UI.
- OMR gameplay staking/vault migration, Broker allocation multipliers, RWA delivery gas, Stock Token custody, and any legacy `account_persistent.staked` migration.
- Production deployment manifests/scripts, Safe transaction bundles, chain-specific data-fee adapter activation, or a production pool address.
- A proxy, upgrade administrator, TimelockController, relayer allowlist, gas relay, sponsor refund, or ERC-20 handling.
