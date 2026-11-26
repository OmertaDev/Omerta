// SPDX-License-Identifier: MIT
pragma solidity 0.8.38;

import {Test} from "forge-std/Test.sol";
import {OperatingSinksV2Fixture} from "./OperatingSinksV2.t.sol";
import {OmertaRestrictedOMRV2} from "../../src/market-v2/OmertaRestrictedOMRV2.sol";
import {OmertaGameCustodyV2} from "../../src/market-v2/OmertaGameCustodyV2.sol";
import {OmertaOperatingSinksV2} from "../../src/market-v2/OmertaOperatingSinksV2.sol";

contract OperatingSinksHandlerV2 is Test {
    OmertaRestrictedOMRV2 private immutable token;
    OmertaGameCustodyV2 private immutable custody;
    OmertaOperatingSinksV2 private immutable sink;
    address private immutable payer;
    uint256 private sequence = 100;
    uint256 public paid;

    constructor(
        OmertaRestrictedOMRV2 token_,
        OmertaGameCustodyV2 custody_,
        OmertaOperatingSinksV2 sink_,
        address payer_
    ) {
        token = token_;
        custody = custody_;
        sink = sink_;
        payer = payer_;
    }

    function sign(uint256 key, bytes32 digest) private pure returns (bytes memory) {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(key, digest);
        return abi.encodePacked(r, s, v);
    }

    function makeQuote(uint8 action, uint256 amount) private returns (OmertaOperatingSinksV2.Quote memory) {
        uint256 nonce = sequence++;
        return OmertaOperatingSinksV2.Quote(
            payer,
            keccak256("alice-account"),
            action % 7,
            keccak256(abi.encode("stateful-operation", nonce)),
            amount,
            nonce,
            block.timestamp + 1 minutes
        );
    }

    function settle(uint8 action, uint32 micros) external {
        uint256 dayUsed = custody.operatingPaidOnDay(block.timestamp / 1 days);
        uint256 available = custody.operatingDailyCapOMR() - dayUsed;
        available = available < token.balanceOf(address(custody)) ? available : token.balanceOf(address(custody));
        if (available < 1e12) return;
        uint256 amount = bound(uint256(micros), 1, available / 1e12) * 1e12;
        OmertaOperatingSinksV2.Quote memory q = makeQuote(action, amount);
        q.payer = address(custody);
        sink.settleCustody(q, sign(0xABCD02, sink.hashCustodyQuote(q)));
        paid += amount;
    }

    function walletPay(uint8 action, uint32 micros) external {
        uint256 balance = token.balanceOf(payer);
        if (balance < 1e12) return;
        uint256 amount = bound(uint256(micros), 1, balance / 1e12) * 1e12;
        OmertaOperatingSinksV2.Quote memory q = makeQuote(action, amount);
        bytes memory signature = sign(0xABCD02, sink.hashQuote(q));
        vm.prank(payer);
        sink.pay(q, signature);
        paid += amount;
    }

    function deposit(uint32 micros) external {
        uint256 balance = token.balanceOf(payer);
        if (balance < 1e12) return;
        uint256 amount = bound(uint256(micros), 1, balance / 1e12) * 1e12;
        vm.startPrank(payer);
        token.approve(address(custody), amount);
        custody.deposit(amount);
        vm.stopPrank();
    }

    function withdraw(uint32 micros) external {
        uint256 balance = token.balanceOf(address(custody));
        uint256 dayUsed = custody.claimedOnDay(block.timestamp / 1 days);
        uint256 available = custody.dailyCapOMR() - dayUsed;
        available = available < balance ? available : balance;
        if (available < 1e12) return;
        uint256 amount = bound(uint256(micros), 1, available / 1e12) * 1e12;
        OmertaGameCustodyV2.Voucher memory v =
            OmertaGameCustodyV2.Voucher(payer, amount, 0, 0, sequence++, block.timestamp + 1 minutes);
        custody.claim(v, sign(0xABCD01, custody.hashVoucher(v)));
    }

    function nextDay() external {
        vm.warp(block.timestamp + 1 days);
    }
}

contract OperatingSinksV2InvariantTest is OperatingSinksV2Fixture {
    OperatingSinksHandlerV2 handler;

    function setUp() public override {
        super.setUp();
        handler = new OperatingSinksHandlerV2(token, custody, sink, alice);
        bytes4[] memory selectors = new bytes4[](5);
        selectors[0] = handler.settle.selector;
        selectors[1] = handler.walletPay.selector;
        selectors[2] = handler.deposit.selector;
        selectors[3] = handler.withdraw.selector;
        selectors[4] = handler.nextDay.selector;
        targetSelector(FuzzSelector(address(handler), selectors));
        targetContract(address(handler));
    }

    function invariantTokenSupplyAndCompleteAssetConservation() public view {
        assertEq(token.totalSupply(), 100_000_000 ether);
        assertEq(
            token.balanceOf(address(this)) + token.balanceOf(address(custody)) + token.balanceOf(alice),
            token.totalSupply()
        );
        assertEq(token.balanceOf(address(sink)), 0);
    }

    function invariantCustodyFlowsNeverCountOperatingRevenueTwice() public view {
        assertEq(
            token.balanceOf(address(custody)),
            custody.cumulativeFunded() - custody.cumulativeClaimed() - custody.cumulativeOperatingSettled()
        );
        assertEq(sink.cumulativePaid(), handler.paid());
    }
}
