// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Ownable2Step, Ownable} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {IOmertaRestrictedOMRV2} from "./IOmertaRestrictedOMRV2.sol";

interface IOperatingCustodyV2 {
    function omr() external view returns (address);
    function owner() external view returns (address);
    function operatingSink() external view returns (address);
    function settleOperatingCost(bytes32 operationId, uint256 amount) external;
}

/// @notice Exact OMR operating-cost payments bound to a quoted game operation.
/// @dev The game signer prices and authorizes the operation. The payer separately consents
/// by submitting it and approving this contract. Confirmed events authorize game effects;
/// an indexer must not also debit the payer's in-game OMR balance for the same payment.
/// This module collects revenue, not a totalSupply burn. Both token movements are to/from
/// this module, as required by the restricted token's ProtocolCustody role.
contract OmertaOperatingSinksV2 is EIP712, Ownable2Step, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum Action {
        BusinessUpkeep,
        CrewWages,
        TerritoryUpkeep,
        Repair,
        Heal,
        Travel,
        Craft
    }

    struct Quote {
        address payer;
        bytes32 accountId;
        uint8 action;
        bytes32 operationId;
        uint256 amount;
        uint256 nonce;
        uint256 deadline;
    }

    uint256 public constant LEDGER_SCALE = 1e12;
    uint256 public constant MAX_QUOTE_TTL = 15 minutes;
    bytes32 public constant QUOTE_TYPEHASH = keccak256(
        "Quote(address payer,bytes32 accountId,uint8 action,bytes32 operationId,uint256 amount,uint256 nonce,uint256 deadline)"
    );
    bytes32 public constant CUSTODY_QUOTE_TYPEHASH = keccak256(
        "CustodyQuote(address payer,bytes32 accountId,uint8 action,bytes32 operationId,uint256 amount,uint256 nonce,uint256 deadline)"
    );

    IOmertaRestrictedOMRV2 public immutable omr;
    address public immutable recipient;
    address public immutable signer;
    IOperatingCustodyV2 public immutable custody;
    bool public activated;
    uint256 public cumulativePaid;
    mapping(address => mapping(uint256 => bool)) public usedNonce;
    mapping(bytes32 => bool) public usedOperation;
    mapping(uint8 => uint256) public paidByAction;

    error InvalidConfiguration();
    error NotReady();
    error InvalidQuote();
    error InexactPayment();
    event Activated();
    event OperatingCostPaid(
        bytes32 indexed operationId,
        bytes32 indexed accountId,
        address indexed payer,
        uint8 action,
        uint256 amount,
        uint256 nonce,
        bool fromCustody
    );

    constructor(
        address safe_,
        address signer_,
        IOmertaRestrictedOMRV2 omr_,
        address recipient_,
        IOperatingCustodyV2 custody_
    ) EIP712("OmertaOperatingSinks", "1") Ownable(safe_) {
        if (
            signer_ == address(0) || address(omr_).code.length == 0 || recipient_ == address(0)
                || recipient_ == address(this) || address(custody_).code.length == 0 || recipient_ == address(custody_)
                || custody_.omr() != address(omr_) || custody_.owner() != safe_
        ) revert InvalidConfiguration();
        signer = signer_;
        omr = omr_;
        recipient = recipient_;
        custody = custody_;
    }

    function activate() external onlyOwner {
        if (
            activated || !omr.policySealed() || !omr.isOperator(address(this))
                || omr.operatorRole(address(this)) != IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody
                || !omr.isRecipient(recipient) || custody.operatingSink() != address(this)
        ) revert NotReady();
        activated = true;
        emit Activated();
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function hashQuote(Quote calldata q) public view returns (bytes32) {
        return _hashQuote(q, QUOTE_TYPEHASH);
    }

    function hashCustodyQuote(Quote calldata q) public view returns (bytes32) {
        return _hashQuote(q, CUSTODY_QUOTE_TYPEHASH);
    }

    function _hashQuote(Quote calldata q, bytes32 typehash) private view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(typehash, q.payer, q.accountId, q.action, q.operationId, q.amount, q.nonce, q.deadline)
            )
        );
    }

    /// @notice Pay one signed quote. No relayer can spend a payer's standing allowance.
    function pay(Quote calldata q, bytes calldata signature) external nonReentrant whenNotPaused {
        if (q.payer != msg.sender || q.payer == recipient) revert InvalidQuote();
        _consume(q, signature, false);

        IERC20 token = IERC20(address(omr));
        uint256 payerBefore = token.balanceOf(q.payer);
        uint256 heldBefore = token.balanceOf(address(this));
        token.safeTransferFrom(q.payer, address(this), q.amount);
        if (
            token.balanceOf(address(this)) != heldBefore + q.amount
                || token.balanceOf(q.payer) + q.amount != payerBefore
        ) revert InexactPayment();
        _forward(q, heldBefore, false);
    }

    /// @notice Settle an already-debited game cost. Only a separate custody quote authorizes it.
    /// @dev Anyone may relay the signature; its account, action, amount and recipient cannot change.
    function settleCustody(Quote calldata q, bytes calldata signature) external nonReentrant whenNotPaused {
        if (q.payer != address(custody)) revert InvalidQuote();
        _consume(q, signature, true);
        uint256 heldBefore = omr.balanceOf(address(this));
        custody.settleOperatingCost(q.operationId, q.amount);
        if (omr.balanceOf(address(this)) != heldBefore + q.amount) revert InexactPayment();
        _forward(q, heldBefore, true);
    }

    function _consume(Quote calldata q, bytes calldata signature, bool fromCustody) private {
        if (!activated) revert NotReady();
        if (
            q.payer == address(0) || q.accountId == bytes32(0) || q.operationId == bytes32(0)
                || q.action > uint8(Action.Craft) || q.amount == 0 || q.amount % LEDGER_SCALE != 0
                || usedNonce[q.payer][q.nonce] || usedOperation[q.operationId] || q.deadline < block.timestamp
                || q.deadline > block.timestamp + MAX_QUOTE_TTL
                || ECDSA.recover(_hashQuote(q, fromCustody ? CUSTODY_QUOTE_TYPEHASH : QUOTE_TYPEHASH), signature)
                    != signer
        ) {
            revert InvalidQuote();
        }

        usedNonce[q.payer][q.nonce] = true;
        usedOperation[q.operationId] = true;
        cumulativePaid += q.amount;
        paidByAction[q.action] += q.amount;
    }

    function _forward(Quote calldata q, uint256 heldBefore, bool fromCustody) private {
        IERC20 token = IERC20(address(omr));
        uint256 recipientBefore = token.balanceOf(recipient);
        token.safeTransfer(recipient, q.amount);
        if (token.balanceOf(address(this)) != heldBefore || token.balanceOf(recipient) != recipientBefore + q.amount) {
            revert InexactPayment();
        }

        emit OperatingCostPaid(q.operationId, q.accountId, q.payer, q.action, q.amount, q.nonce, fromCustody);
    }
}
