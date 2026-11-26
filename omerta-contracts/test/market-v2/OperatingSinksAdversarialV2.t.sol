// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {IOmertaRestrictedOMRV2} from "../../src/market-v2/IOmertaRestrictedOMRV2.sol";
import {OmertaOperatingSinksV2, IOperatingCustodyV2} from "../../src/market-v2/OmertaOperatingSinksV2.sol";

/// Adversarial boundary fixtures, not substitutes for the real restricted-token suite.
contract OperatingHostileTokenV2 is ERC20 {
    bool public constant policySealed = true;
    address public taxedRecipient;
    bool public taxInput;
    bool public taxOutput;
    constructor() ERC20("Hostile fixture", "HOSTILE") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    function isOperator(address) external pure returns (bool) {
        return true;
    }

    function isRecipient(address) external pure returns (bool) {
        return true;
    }

    function operatorRole(address) external pure returns (IOmertaRestrictedOMRV2.OperatorRole) {
        return IOmertaRestrictedOMRV2.OperatorRole.ProtocolCustody;
    }

    function setTax(address sink, bool input, bool output) external {
        taxedRecipient = sink;
        taxInput = input;
        taxOutput = output;
    }

    function _update(address from, address to, uint256 amount) internal override {
        uint256 tax = (taxInput && to == taxedRecipient) || (taxOutput && from == taxedRecipient) ? amount / 100 : 0;
        super._update(from, to, amount - tax);
        if (tax > 0) super._update(from, address(0xBEEF), tax);
    }
}

contract OperatingHostileCustodyV2 {
    OperatingHostileTokenV2 public immutable omr;
    address public immutable owner;
    address public operatingSink;
    bytes public callback;
    bool public reentrySucceeded;
    uint256 public underpayment;

    constructor(OperatingHostileTokenV2 token) {
        omr = token;
        owner = msg.sender;
    }

    function configure(address sink, bytes memory data, uint256 shortfall) external {
        operatingSink = sink;
        callback = data;
        underpayment = shortfall;
    }

    function settleOperatingCost(bytes32, uint256 amount) external {
        require(msg.sender == operatingSink, "sink only");
        if (callback.length > 0) (reentrySucceeded,) = operatingSink.call(callback);
        omr.transfer(operatingSink, amount - underpayment);
    }
}

contract OperatingSinksAdversarialV2Test is Test {
    OperatingHostileTokenV2 token;
    OperatingHostileCustodyV2 custody;
    OmertaOperatingSinksV2 sink;
    address alice = address(0xA11CE);
    address recipient = address(0xFEE);
    uint256 constant SIGNER_KEY = 0xABCD02;

    function setUp() public {
        vm.warp(10 days);
        token = new OperatingHostileTokenV2();
        custody = new OperatingHostileCustodyV2(token);
        sink = new OmertaOperatingSinksV2(
            address(this),
            vm.addr(SIGNER_KEY),
            IOmertaRestrictedOMRV2(address(token)),
            recipient,
            IOperatingCustodyV2(address(custody))
        );
        custody.configure(address(sink), "", 0);
        sink.activate();
        token.mint(alice, 10 ether);
        token.mint(address(custody), 10 ether);
        vm.prank(alice);
        token.approve(address(sink), type(uint256).max);
    }

    function quote() internal view returns (OmertaOperatingSinksV2.Quote memory) {
        return OmertaOperatingSinksV2.Quote(
            alice, keccak256("account"), 0, keccak256("operation"), 2 ether, 1, block.timestamp + 1 minutes
        );
    }

    function signature(OmertaOperatingSinksV2.Quote memory q, bool fromCustody) internal view returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) =
            vm.sign(SIGNER_KEY, fromCustody ? sink.hashCustodyQuote(q) : sink.hashQuote(q));
        return abi.encodePacked(r, s, v);
    }

    function testInputTransferTaxCannotCreateAFullPaymentReceipt() public {
        token.setTax(address(sink), true, false);
        OmertaOperatingSinksV2.Quote memory q = quote();
        bytes memory sig = signature(q, false);
        vm.prank(alice);
        vm.expectRevert(OmertaOperatingSinksV2.InexactPayment.selector);
        sink.pay(q, sig);
        assertEq(token.balanceOf(alice), 10 ether);
        assertEq(token.balanceOf(recipient), 0);
        assertFalse(sink.usedOperation(q.operationId));
    }

    function testOutputTransferTaxCannotCreateAFullPaymentReceipt() public {
        token.setTax(address(sink), false, true);
        OmertaOperatingSinksV2.Quote memory q = quote();
        bytes memory sig = signature(q, false);
        vm.prank(alice);
        vm.expectRevert(OmertaOperatingSinksV2.InexactPayment.selector);
        sink.pay(q, sig);
        assertEq(token.balanceOf(alice), 10 ether);
        assertEq(token.balanceOf(recipient), 0);
        assertFalse(sink.usedOperation(q.operationId));
    }

    function testUnderpayingCustodyCannotCreateAFullPaymentReceipt() public {
        custody.configure(address(sink), "", 1e12);
        OmertaOperatingSinksV2.Quote memory q = quote();
        q.payer = address(custody);
        bytes memory sig = signature(q, true);
        vm.expectRevert(OmertaOperatingSinksV2.InexactPayment.selector);
        sink.settleCustody(q, sig);
        assertEq(token.balanceOf(address(custody)), 10 ether);
        assertFalse(sink.usedOperation(q.operationId));
    }

    function testCustodyReentryCannotSettleTwice() public {
        OmertaOperatingSinksV2.Quote memory q = quote();
        q.payer = address(custody);
        bytes memory sig = signature(q, true);
        custody.configure(address(sink), abi.encodeCall(sink.settleCustody, (q, sig)), 0);
        sink.settleCustody(q, sig);
        assertFalse(custody.reentrySucceeded());
        assertEq(token.balanceOf(recipient), 2 ether);
        assertEq(token.balanceOf(address(custody)), 8 ether);
        assertEq(sink.cumulativePaid(), 2 ether);
    }
}
