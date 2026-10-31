// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {ERC20Permit} from "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";

interface IRestrictedSettlementPolicyV2 {
    function omr() external view returns (address);
    function TRADE_FEE_BPS() external view returns (uint16);
    function revenuePolicyId() external view returns (bytes32);
}

/// @notice Fixed-supply OMR with an immutable settlement policy and delayed, runtime-pinned module admissions.
/// @dev Custody operators must be reviewed typed contracts, with fixed runtime and no arbitrary forwarding.
///      Approvals and permits are standard ERC20 approvals; they never bypass the caller's transfer role.
contract OmertaRestrictedOMRV2 is ERC20Permit, Ownable2Step, IOmertaRestrictedOMRV2 {
    uint256 public constant SUPPLY = 100_000_000e18;
    bytes32 public constant REVENUE_POLICY_ID = keccak256("OMERTA_RESTRICTED_LP_REVENUE_V2_350_BASE_50_BTC_REWARDS_BOTH_DIRECTIONS");
    uint64 public constant override POLICY_UPDATE_DELAY = 7 days;

    error PolicySealed();
    error InvalidOperator();
    error InvalidRuntimeHash();
    error InvalidSettlementManager();
    error SettlementManagerAlreadyBound();
    error UnauthorizedTransfer();
    error InvalidRecipient();
    error UnauthorizedWalletRegistration();
    error InvalidGenesisInventory();
    error PolicyNotSealed();
    error InvalidPolicyUpdate();
    error PolicyUpdateNotReady();

    event OperatorSet(address indexed operator, OperatorRole role, bytes32 runtimeHash);
    event SettlementManagerBound(address indexed manager, bytes32 runtimeHash);
    event TransferPolicySealed();
    event ContractHolderSet(address indexed holder, bytes32 runtimeHash);
    event WalletRegistered(address indexed wallet);
    event OperatorProposed(address indexed operator, OperatorRole role, bytes32 runtimeHash, uint64 executableAt);
    event OperatorProposalCancelled(address indexed operator);
    event ContractHolderProposed(address indexed holder, bytes32 runtimeHash, uint64 executableAt);
    event ContractHolderProposalCancelled(address indexed holder);

    struct OperatorProposal {
        OperatorRole role;
        bytes32 runtimeHash;
        uint64 executableAt;
    }

    struct ContractHolderProposal {
        bytes32 runtimeHash;
        uint64 executableAt;
    }

    address public immutable genesisTreasury;
    bytes32 public immutable genesisTreasuryRuntimeHash;
    address public override settlementManager;
    bool public override policySealed;
    mapping(address => OperatorRole) public override operatorRole;
    mapping(address => bytes32) public operatorRuntimeHash;
    address[] private _operators;
    mapping(address => bool) private _operatorListed;
    mapping(address => bytes32) public contractHolderRuntimeHash;
    mapping(address => bool) public registeredWallet;
    address[] private _contractHolders;
    mapping(address => bool) private _contractHolderListed;
    mapping(address => OperatorProposal) public override operatorProposal;
    mapping(address => ContractHolderProposal) public override contractHolderProposal;
    uint256 public override pendingPolicyUpdates;

    modifier onlyUnsealed() {
        if (policySealed) revert PolicySealed();
        _;
    }

    constructor(address treasurySafe) ERC20("OMERTA", "OMR") ERC20Permit("OMERTA") Ownable(treasurySafe) {
        genesisTreasury = treasurySafe;
        genesisTreasuryRuntimeHash = treasurySafe.code.length == 0 ? keccak256("") : treasurySafe.codehash;
        _mint(treasurySafe, SUPPLY);
    }

    /// @notice Configure receiving-only holders before sealing; later additions require the public delay.
    /// @dev A zero hash removes a holder before sealing; enumeration retains its historical entry.
    function setContractHolder(address holder, bytes32 expectedRuntimeHash) external onlyOwner onlyUnsealed {
        if (holder == address(0) || holder == genesisTreasury) revert InvalidRecipient();
        if (expectedRuntimeHash != bytes32(0)) _checkRuntimeHash(holder, expectedRuntimeHash);
        if (!_contractHolderListed[holder]) {
            _contractHolderListed[holder] = true;
            _contractHolders.push(holder);
        }
        contractHolderRuntimeHash[holder] = expectedRuntimeHash;
        emit ContractHolderSet(holder, expectedRuntimeHash);
    }

    /// @notice An EOA proves its own recipient address directly or through a pinned input router.
    /// @dev Registration remains open after sealing and stops being valid if code appears at the address.
    function registerWallet(address wallet) external override {
        if (
            wallet == address(0) || wallet != tx.origin || wallet.code.length != 0
                || (msg.sender != wallet
                    && (operatorRole[msg.sender] != OperatorRole.SettlementInput || !isOperator(msg.sender)))
        ) revert UnauthorizedWalletRegistration();
        if (!registeredWallet[wallet]) {
            registeredWallet[wallet] = true;
            emit WalletRegistered(wallet);
        }
    }

    function contractHolderCount() external view returns (uint256) {
        return _contractHolders.length;
    }

    function contractHolderAt(uint256 index) external view returns (address) {
        return _contractHolders[index];
    }

    function setOperator(address operator, OperatorRole role, bytes32 expectedRuntimeHash)
        external
        onlyOwner
        onlyUnsealed
    {
        if (operator == address(0) || role == OperatorRole.SettlementManager || operator == settlementManager) revert InvalidOperator();
        if (role == OperatorRole.None) {
            if (expectedRuntimeHash != bytes32(0)) revert InvalidRuntimeHash();
        } else {
            _checkRuntimeHash(operator, expectedRuntimeHash);
        }
        _setOperator(operator, role, expectedRuntimeHash);
    }

    function bindSettlementManager(address manager, bytes32 expectedRuntimeHash) external onlyOwner onlyUnsealed {
        if (settlementManager != address(0)) revert SettlementManagerAlreadyBound();
        _checkRuntimeHash(manager, expectedRuntimeHash);
        IRestrictedSettlementPolicyV2 policy = IRestrictedSettlementPolicyV2(manager);
        try policy.omr() returns (address managerOmr) {
            if (managerOmr != address(this)) revert InvalidSettlementManager();
        } catch {
            revert InvalidSettlementManager();
        }
        try policy.TRADE_FEE_BPS() returns (uint16 feeBps) {
            if (feeBps != 400) revert InvalidSettlementManager();
        } catch {
            revert InvalidSettlementManager();
        }
        try policy.revenuePolicyId() returns (bytes32 policyId) {
            if (policyId != REVENUE_POLICY_ID) revert InvalidSettlementManager();
        } catch {
            revert InvalidSettlementManager();
        }
        settlementManager = manager;
        _setOperator(manager, OperatorRole.SettlementManager, expectedRuntimeHash);
        emit SettlementManagerBound(manager, expectedRuntimeHash);
    }

    function sealPolicy() external onlyOwner onlyUnsealed {
        if (settlementManager == address(0)) revert InvalidSettlementManager();
        // No native OMR may pre-fund an independent pool or claim ledger before enforcement.
        // Initial LP/protocol distribution follows sealing through the reviewed operators.
        if (owner() != genesisTreasury || balanceOf(genesisTreasury) != SUPPLY) revert InvalidGenesisInventory();
        if (!_validGenesisTreasury()) revert InvalidRuntimeHash();
        for (uint256 i; i < _operators.length; ++i) {
            address operator = _operators[i];
            if (operatorRole[operator] != OperatorRole.None) {
                _checkRuntimeHash(operator, operatorRuntimeHash[operator]);
            }
        }
        for (uint256 i; i < _contractHolders.length; ++i) {
            address holder = _contractHolders[i];
            bytes32 runtimeHash = contractHolderRuntimeHash[holder];
            if (runtimeHash != bytes32(0)) _checkRuntimeHash(holder, runtimeHash);
        }
        policySealed = true;
        emit TransferPolicySealed();
    }

    /// @notice Admit a new reviewed module after seven days. Existing roles and runtime pins never change.
    /// @dev Runtime pins do not establish that a contract is safe: governance must review its complete
    /// behavior, including proxies and delegation. Replacing a pending proposal restarts its full delay.
    function proposeOperator(address operator, OperatorRole role, bytes32 expectedRuntimeHash)
        external
        override
        onlyOwner
    {
        _checkExtensionAuthority();
        _checkNewOperator(operator, role);
        _checkRuntimeHash(operator, expectedRuntimeHash);
        if (operatorProposal[operator].executableAt == 0) ++pendingPolicyUpdates;
        uint64 executableAt = uint64(block.timestamp + POLICY_UPDATE_DELAY);
        operatorProposal[operator] = OperatorProposal(role, expectedRuntimeHash, executableAt);
        emit OperatorProposed(operator, role, expectedRuntimeHash, executableAt);
    }

    function cancelOperatorProposal(address operator) external override onlyOwner {
        if (operatorProposal[operator].executableAt == 0) revert InvalidPolicyUpdate();
        delete operatorProposal[operator];
        --pendingPolicyUpdates;
        emit OperatorProposalCancelled(operator);
    }

    /// @notice Anyone may execute exactly the published proposal once its delay has elapsed.
    function executeOperatorProposal(address operator) external override {
        _checkExtensionAuthority();
        OperatorProposal memory proposal = operatorProposal[operator];
        if (proposal.executableAt == 0 || block.timestamp < proposal.executableAt) revert PolicyUpdateNotReady();
        _checkNewOperator(operator, proposal.role);
        _checkRuntimeHash(operator, proposal.runtimeHash);
        delete operatorProposal[operator];
        --pendingPolicyUpdates;
        _setOperator(operator, proposal.role, proposal.runtimeHash);
    }

    function proposeContractHolder(address holder, bytes32 expectedRuntimeHash) external override onlyOwner {
        _checkExtensionAuthority();
        _checkNewHolder(holder);
        _checkRuntimeHash(holder, expectedRuntimeHash);
        if (contractHolderProposal[holder].executableAt == 0) ++pendingPolicyUpdates;
        uint64 executableAt = uint64(block.timestamp + POLICY_UPDATE_DELAY);
        contractHolderProposal[holder] = ContractHolderProposal(expectedRuntimeHash, executableAt);
        emit ContractHolderProposed(holder, expectedRuntimeHash, executableAt);
    }

    function cancelContractHolderProposal(address holder) external override onlyOwner {
        if (contractHolderProposal[holder].executableAt == 0) revert InvalidPolicyUpdate();
        delete contractHolderProposal[holder];
        --pendingPolicyUpdates;
        emit ContractHolderProposalCancelled(holder);
    }

    function executeContractHolderProposal(address holder) external override {
        _checkExtensionAuthority();
        ContractHolderProposal memory proposal = contractHolderProposal[holder];
        if (proposal.executableAt == 0 || block.timestamp < proposal.executableAt) revert PolicyUpdateNotReady();
        _checkNewHolder(holder);
        _checkRuntimeHash(holder, proposal.runtimeHash);
        delete contractHolderProposal[holder];
        --pendingPolicyUpdates;
        if (!_contractHolderListed[holder]) {
            _contractHolderListed[holder] = true;
            _contractHolders.push(holder);
        }
        contractHolderRuntimeHash[holder] = proposal.runtimeHash;
        emit ContractHolderSet(holder, proposal.runtimeHash);
    }

    function _checkExtensionAuthority() private view {
        if (!policySealed) revert PolicyNotSealed();
        if (owner() != genesisTreasury || !_validGenesisTreasury()) revert InvalidPolicyUpdate();
    }

    function _checkNewOperator(address operator, OperatorRole role) private view {
        if (
            operator == address(0) || operator == genesisTreasury || operator == settlementManager
                || (role != OperatorRole.SettlementInput && role != OperatorRole.ProtocolCustody)
                || operatorRole[operator] != OperatorRole.None || operatorRuntimeHash[operator] != bytes32(0)
                || contractHolderRuntimeHash[operator] != bytes32(0)
                || contractHolderProposal[operator].executableAt != 0
        ) revert InvalidPolicyUpdate();
    }

    function _checkNewHolder(address holder) private view {
        if (
            holder == address(0) || holder == genesisTreasury || operatorRole[holder] != OperatorRole.None
                || contractHolderRuntimeHash[holder] != bytes32(0) || operatorProposal[holder].executableAt != 0
        ) revert InvalidPolicyUpdate();
    }

    function isOperator(address operator) public view override returns (bool) {
        return operatorRole[operator] != OperatorRole.None && operator.code.length != 0
            && operator.codehash == operatorRuntimeHash[operator];
    }

    function isRecipient(address recipient) public view override returns (bool) {
        if (recipient == genesisTreasury) return _validGenesisTreasury();
        if (isOperator(recipient)) return true;
        if (recipient.code.length == 0) return registeredWallet[recipient];
        bytes32 runtimeHash = contractHolderRuntimeHash[recipient];
        return runtimeHash != bytes32(0) && recipient.codehash == runtimeHash;
    }

    function _validGenesisTreasury() private view returns (bool) {
        bytes32 liveHash = genesisTreasury.code.length == 0 ? keccak256("") : genesisTreasury.codehash;
        return liveHash == genesisTreasuryRuntimeHash;
    }

    /// @notice Enumerates every configured address, including revoked entries, for pre-seal review.
    function operatorCount() external view returns (uint256) {
        return _operators.length;
    }

    function operatorAt(uint256 index) external view returns (address) {
        return _operators[index];
    }

    function _setOperator(address operator, OperatorRole role, bytes32 runtimeHash) private {
        if (!_operatorListed[operator]) {
            _operatorListed[operator] = true;
            _operators.push(operator);
        }
        operatorRole[operator] = role;
        operatorRuntimeHash[operator] = runtimeHash;
        emit OperatorSet(operator, role, runtimeHash);
    }

    function _checkRuntimeHash(address operator, bytes32 expectedRuntimeHash) private view {
        if (operator.code.length == 0 || expectedRuntimeHash == bytes32(0) || operator.codehash != expectedRuntimeHash)
        {
            revert InvalidRuntimeHash();
        }
    }

    function _update(address from, address to, uint256 value) internal override {
        if (from != address(0)) {
            if (!isRecipient(to)) revert InvalidRecipient();
            address caller = _msgSender();
            if (!policySealed) {
                if (caller != owner() || from != owner()) revert UnauthorizedTransfer();
            } else {
                if (!isOperator(caller)) revert UnauthorizedTransfer();
                OperatorRole role = operatorRole[caller];
                if (
                    (role == OperatorRole.SettlementInput && to != settlementManager)
                        || (role == OperatorRole.ProtocolCustody && from != caller && to != caller)
                        || (role == OperatorRole.SettlementManager && from != settlementManager)
                ) revert UnauthorizedTransfer();
            }
        }
        super._update(from, to, value);
    }
}
