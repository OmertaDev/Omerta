// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title SettlementGasPool
/// @notice Community-funded native-gas credits for successful gameplay settlements.
/// @dev Credits are exact pull-payment liabilities. The immutable gameplay vault records them;
///      contributors and the owner acquire no withdrawal right over unreserved sponsorship.
contract SettlementGasPool is Ownable2Step, Pausable, ReentrancyGuard {
    enum CreditStatus {
        FULL,
        PARTIAL,
        ZERO_PAUSED,
        ZERO_UNFUNDED,
        ZERO_CAP,
        ZERO_RETIRED
    }

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

    struct CreditCalculation {
        uint256 billableGas;
        uint256 reimbursableGasPrice;
        uint256 approvedDataFee;
        uint256 verifiedGasCost;
        uint256 available;
        uint256 credit;
        CreditStatus status;
    }

    uint256 public immutable supportedChainId;
    address public immutable gameplayVault;
    address public immutable predecessor;
    uint64 public immutable auditedOverheadGas;

    Config public config;
    bool public retired;
    mapping(bytes32 settlement => bool processed) public processedSettlements;
    mapping(address executor => uint256 amount) public credits;
    uint256 public totalCreditsRecorded;
    uint256 public totalOutstandingCredits;
    uint256 public totalCreditsWithdrawn;

    error ZeroAddress();
    error ZeroValue();
    error ZeroId();
    error InvalidOverhead();
    error InvalidCap();
    error InvalidPredecessor();
    error NotGameplayVault();
    error AlreadyProcessed();
    error NoCredit();
    error WithdrawalFailed();
    error ZeroReason();
    error CapIncreaseNotAllowed();
    error Insolvent();
    error PoolRetired();
    error OwnershipRenunciationDisabled();

    event ContributionReceived(
        address indexed contributor,
        uint256 amount,
        bytes32 indexed memo,
        uint256 poolBalance,
        uint256 unreservedBalance
    );
    event SettlementProcessed(
        bytes32 indexed settlementKey,
        bytes32 indexed eventId,
        bytes32 indexed victimAccountId,
        uint256 victimNonce,
        address executor,
        CreditStatus status
    );
    event SettlementCreditCalculated(
        bytes32 indexed settlementKey,
        uint256 measuredSettlementGas,
        uint256 billableGas,
        uint256 reimbursableGasPrice,
        uint256 approvedDataFee,
        uint256 verifiedGasCost,
        uint256 available,
        uint256 credit
    );
    event CreditWithdrawn(
        address indexed executor,
        uint256 amount,
        uint256 totalCreditsWithdrawn,
        uint256 totalOutstandingCredits,
        uint256 poolBalance
    );
    event CreditsPaused(bytes32 indexed reasonHash);
    event CreditsUnpaused(bytes32 indexed reasonHash);
    event CapsReduced(
        uint128 oldPriorityFeeCapWei,
        uint128 newPriorityFeeCapWei,
        uint128 oldPerSettlementWeiCap,
        uint128 newPerSettlementWeiCap,
        uint128 oldDataFeeWeiCap,
        uint128 newDataFeeWeiCap
    );

    constructor(
        address safeOwner,
        address gameplayVault_,
        address predecessor_,
        uint64 auditedOverheadGas_,
        uint128 initialPriorityFeeCapWei,
        uint128 initialPerSettlementWeiCap,
        uint128 initialDataFeeWeiCap
    ) Ownable(safeOwner) {
        if (gameplayVault_ == address(0)) revert ZeroAddress();
        if (auditedOverheadGas_ == 0) revert InvalidOverhead();
        if (initialPriorityFeeCapWei == 0 || initialPerSettlementWeiCap == 0) revert InvalidCap();
        if (predecessor_ != address(0) && predecessor_.code.length == 0) revert InvalidPredecessor();

        supportedChainId = block.chainid;
        gameplayVault = gameplayVault_;
        predecessor = predecessor_;
        auditedOverheadGas = auditedOverheadGas_;
        config = Config({
            priorityFeeCapWei: initialPriorityFeeCapWei,
            perSettlementWeiCap: initialPerSettlementWeiCap,
            dataFeeWeiCap: initialDataFeeWeiCap,
            dataFeeSource: address(0),
            dataFeeSourceRuntimeCodeHash: bytes32(0)
        });
        _pause();
    }

    receive() external payable {
        _recordContribution(bytes32(0));
    }

    function contribute(bytes32 memo) external payable {
        _recordContribution(memo);
    }

    function recordSettlementCredit(CreditRequest calldata request)
        external
        returns (uint256 credit, CreditStatus status)
    {
        if (msg.sender != gameplayVault) revert NotGameplayVault();
        if (request.eventId == bytes32(0) || request.victimAccountId == bytes32(0)) revert ZeroId();
        if (request.executor == address(0)) revert ZeroAddress();

        bytes32 key = settlementKey(request.eventId, request.victimAccountId, request.victimNonce);
        if (processedSettlements[key]) revert AlreadyProcessed();
        processedSettlements[key] = true;

        CreditCalculation memory calculation = _calculateCredit(request.measuredSettlementGas);
        credit = calculation.credit;
        status = calculation.status;
        if (credit != 0) {
            credits[request.executor] += credit;
            totalCreditsRecorded += credit;
            totalOutstandingCredits += credit;
        }

        emit SettlementProcessed(
            key, request.eventId, request.victimAccountId, request.victimNonce, request.executor, status
        );
        emit SettlementCreditCalculated(
            key,
            request.measuredSettlementGas,
            calculation.billableGas,
            calculation.reimbursableGasPrice,
            calculation.approvedDataFee,
            calculation.verifiedGasCost,
            calculation.available,
            credit
        );
    }

    function withdrawCredit() external nonReentrant returns (uint256 amount) {
        amount = credits[msg.sender];
        if (amount == 0) revert NoCredit();

        credits[msg.sender] = 0;
        totalOutstandingCredits -= amount;
        totalCreditsWithdrawn += amount;

        (bool sent,) = payable(msg.sender).call{value: amount}("");
        if (!sent) revert WithdrawalFailed();

        emit CreditWithdrawn(msg.sender, amount, totalCreditsWithdrawn, totalOutstandingCredits, address(this).balance);
    }

    function unreservedBalance() public view returns (uint256) {
        uint256 balance = address(this).balance;
        if (balance <= totalOutstandingCredits) return 0;
        return balance - totalOutstandingCredits;
    }

    function settlementKey(bytes32 eventId, bytes32 victimAccountId, uint256 victimNonce)
        public
        view
        returns (bytes32)
    {
        return keccak256(abi.encode(supportedChainId, gameplayVault, eventId, victimAccountId, victimNonce));
    }

    function previewCredit(uint256 measuredSettlementGas)
        external
        view
        returns (
            uint256 billableGas,
            uint256 reimbursableGasPrice,
            uint256 approvedDataFee,
            uint256 verifiedGasCost,
            uint256 available,
            uint256 credit,
            CreditStatus status
        )
    {
        CreditCalculation memory calculation = _calculateCredit(measuredSettlementGas);
        return (
            calculation.billableGas,
            calculation.reimbursableGasPrice,
            calculation.approvedDataFee,
            calculation.verifiedGasCost,
            calculation.available,
            calculation.credit,
            calculation.status
        );
    }

    function pauseCredits(bytes32 reasonHash) external onlyOwner {
        if (reasonHash == bytes32(0)) revert ZeroReason();
        _pause();
        emit CreditsPaused(reasonHash);
    }

    function unpauseCredits(bytes32 reasonHash) external onlyOwner {
        if (reasonHash == bytes32(0)) revert ZeroReason();
        if (retired) revert PoolRetired();
        if (address(this).balance < totalOutstandingCredits) revert Insolvent();
        _unpause();
        emit CreditsUnpaused(reasonHash);
    }

    function reduceCaps(uint128 priorityFeeCapWei, uint128 perSettlementWeiCap, uint128 dataFeeWeiCap)
        external
        onlyOwner
    {
        Config memory oldConfig = config;
        if (
            priorityFeeCapWei > oldConfig.priorityFeeCapWei || perSettlementWeiCap > oldConfig.perSettlementWeiCap
                || dataFeeWeiCap > oldConfig.dataFeeWeiCap
        ) revert CapIncreaseNotAllowed();

        config.priorityFeeCapWei = priorityFeeCapWei;
        config.perSettlementWeiCap = perSettlementWeiCap;
        config.dataFeeWeiCap = dataFeeWeiCap;
        emit CapsReduced(
            oldConfig.priorityFeeCapWei,
            priorityFeeCapWei,
            oldConfig.perSettlementWeiCap,
            perSettlementWeiCap,
            oldConfig.dataFeeWeiCap,
            dataFeeWeiCap
        );
    }

    function version() public pure returns (bytes32) {
        return keccak256("OMERTA_SETTLEMENT_GAS_POOL_V1");
    }

    function renounceOwnership() public view override onlyOwner {
        revert OwnershipRenunciationDisabled();
    }

    function _recordContribution(bytes32 memo) private {
        if (msg.value == 0) revert ZeroValue();
        if (retired) revert PoolRetired();
        emit ContributionReceived(msg.sender, msg.value, memo, address(this).balance, unreservedBalance());
    }

    function _calculateCredit(uint256 measuredSettlementGas)
        private
        view
        returns (CreditCalculation memory calculation)
    {
        uint256 perSettlementCap = config.perSettlementWeiCap;
        calculation.billableGas = _addCapped(measuredSettlementGas, auditedOverheadGas, type(uint256).max);
        uint256 baseAndPriority = _addCapped(block.basefee, config.priorityFeeCapWei, type(uint256).max);
        calculation.reimbursableGasPrice = tx.gasprice < baseAndPriority ? tx.gasprice : baseAndPriority;
        calculation.approvedDataFee = _approvedDataFee();
        calculation.verifiedGasCost =
            _mulCapped(calculation.billableGas, calculation.reimbursableGasPrice, perSettlementCap);
        calculation.verifiedGasCost =
            _addCapped(calculation.verifiedGasCost, calculation.approvedDataFee, perSettlementCap);
        calculation.available = unreservedBalance();

        if (retired) {
            calculation.status = CreditStatus.ZERO_RETIRED;
            return calculation;
        }
        if (paused()) {
            calculation.status = CreditStatus.ZERO_PAUSED;
            return calculation;
        }
        if (perSettlementCap == 0) {
            calculation.status = CreditStatus.ZERO_CAP;
            return calculation;
        }
        if (calculation.available == 0) {
            calculation.status = CreditStatus.ZERO_UNFUNDED;
            return calculation;
        }

        calculation.credit =
            calculation.verifiedGasCost < calculation.available ? calculation.verifiedGasCost : calculation.available;
        calculation.status = calculation.credit < calculation.verifiedGasCost ? CreditStatus.PARTIAL : CreditStatus.FULL;
    }

    function _approvedDataFee() private pure returns (uint256) {
        return 0;
    }

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
}
